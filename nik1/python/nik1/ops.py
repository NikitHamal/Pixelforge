"""Nik1 numerics: forward + hand-written backward for every layer, in NumPy only.

Design rules that make a sub-million-parameter model fast on a 2-core box and on
a phone:

* **RMSNorm, not LayerNorm** — no mean subtraction, one rsqrt, one scale.
* **RoPE, not learned positions** — no position table to ship, and it degrades
  gracefully past the trained length.
* **Tied embeddings** — the output projection reuses the token table, so a
  500k-parameter model does not waste a third of its budget on a second matrix.
* **Pre-LN blocks** — training stays stable without warmup tricks.
* **Per-channel symmetric int8/int4 quantization** on the way out, with scales
  stored in fp32 so the JS runtime needs no calibration data.

Every backward here is verified against central finite differences in
`tests/test_grad.py`; a hand-written transformer that is only *probably* right
trains to a suspiciously flat loss curve.
"""
from __future__ import annotations

import math
from dataclasses import dataclass

import numpy as np

# --------------------------------------------------------------------------
# small helpers
# --------------------------------------------------------------------------


def rng(seed: int) -> np.random.Generator:
    return np.random.default_rng(seed)


def init_normal(rng_: np.random.Generator, shape, std: float) -> np.ndarray:
    return (rng_.standard_normal(shape) * std).astype(np.float32)


def softmax(x: np.ndarray, axis: int = -1) -> np.ndarray:
    m = np.max(x, axis=axis, keepdims=True)
    e = np.exp(x - m)
    return e / np.sum(e, axis=axis, keepdims=True)


def gelu(x: np.ndarray) -> np.ndarray:
    # tanh approximation: one exp-free path, ~1e-3 of exact GELU
    return 0.5 * x * (1.0 + np.tanh(0.7978845608028654 * (x + 0.044715 * x * x * x)))


def gelu_grad(x: np.ndarray) -> np.ndarray:
    c = 0.7978845608028654
    u = c * (x + 0.044715 * x * x * x)
    t = np.tanh(u)
    du = c * (1.0 + 3 * 0.044715 * x * x)
    return 0.5 * (1.0 + t) + 0.5 * x * (1.0 - t * t) * du


def rmsnorm(x: np.ndarray, w: np.ndarray, eps: float = 1e-6):
    """Returns (out, cache) for the backward pass."""
    ms = np.mean(x * x, axis=-1, keepdims=True)
    inv = 1.0 / np.sqrt(ms + eps)
    xn = x * inv
    return xn * w, (x, w, xn, inv)


def rmsnorm_bwd(dout: np.ndarray, cache):
    x, w, xn, inv = cache
    d = dout * w
    # d/dx of x * inv(x):  inv - x * x * inv^3 / d_model
    dim = x.shape[-1]
    proj = np.sum(d * x, axis=-1, keepdims=True)
    dx = d * inv - x * (inv ** 3) * proj / dim
    dw = np.sum(dout * xn, axis=tuple(range(dout.ndim - 1)))
    return dx.astype(np.float32), dw.astype(np.float32)


# --------------------------------------------------------------------------
# linear / embedding
# --------------------------------------------------------------------------


@dataclass
class Linear:
    """y = x @ W + b, with W stored as (in, out)."""

    w: np.ndarray
    b: np.ndarray | None

    @staticmethod
    def make(rng_, nin: int, nout: int, std: float, bias: bool = True) -> "Linear":
        return Linear(init_normal(rng_, (nin, nout), std),
                      np.zeros(nout, np.float32) if bias else None)

    def forward(self, x: np.ndarray):
        y = x @ self.w
        if self.b is not None:
            y = y + self.b
        return y, (x,)

    def backward(self, dy: np.ndarray, cache):
        (x,) = cache
        flat_x = x.reshape(-1, x.shape[-1])
        flat_dy = dy.reshape(-1, dy.shape[-1])
        dw = flat_x.T @ flat_dy
        db = flat_dy.sum(axis=0) if self.b is not None else None
        dx = dy @ self.w.T
        return dx.astype(np.float32), dw.astype(np.float32), db

    def params(self):
        out = [("w", self.w)]
        if self.b is not None:
            out.append(("b", self.b))
        return out


# --------------------------------------------------------------------------
# RoPE + attention
# --------------------------------------------------------------------------


class RoPE:
    """Rotary position embedding, precomputed per (max_len, head_dim)."""

    def __init__(self, head_dim: int, max_len: int, base: float = 10000.0):
        assert head_dim % 2 == 0, "head dim must be even for RoPE"
        half = head_dim // 2
        inv = 1.0 / (base ** (np.arange(0, half, dtype=np.float32) / half))
        t = np.arange(max_len, dtype=np.float32)
        ang = np.outer(t, inv)                    # (T, half)
        self.cos = np.cos(ang).astype(np.float32)
        self.sin = np.sin(ang).astype(np.float32)

    @staticmethod
    def _rot(x: np.ndarray, cos: np.ndarray, sin: np.ndarray, inverse: bool = False) -> np.ndarray:
        """x: (B, H, T, D). Pairs are adjacent: (x0, x1) -> (x0 c - x1 s, x0 s + x1 c)."""
        x0, x1 = x[..., 0::2], x[..., 1::2]
        c = cos[None, None, :, :]
        s = sin[None, None, :, :]
        if inverse:
            s = -s
        out = np.empty_like(x)
        out[..., 0::2] = x0 * c - x1 * s
        out[..., 1::2] = x0 * s + x1 * c
        return out

    def apply(self, x: np.ndarray, t0: int = 0) -> np.ndarray:
        T = x.shape[2]
        return self._rot(x, self.cos[t0:t0 + T], self.sin[t0:t0 + T])

    def apply_inverse(self, x: np.ndarray, t0: int = 0) -> np.ndarray:
        T = x.shape[2]
        return self._rot(x, self.cos[t0:t0 + T], self.sin[t0:t0 + T], inverse=True)


class Attention:
    """Multi-head self-attention with RoPE and an optional causal mask."""

    def __init__(self, rng_, d_model: int, n_heads: int, causal: bool, max_len: int, std: float):
        assert d_model % n_heads == 0
        self.d_model, self.n_heads, self.causal = d_model, n_heads, causal
        self.head_dim = d_model // n_heads
        self.qkv = Linear.make(rng_, d_model, 3 * d_model, std)
        self.proj = Linear.make(rng_, d_model, d_model, std)
        self.rope = RoPE(self.head_dim, max_len)

    def forward(self, x: np.ndarray):
        B, T, D = x.shape
        H, hd = self.n_heads, self.head_dim
        qkv, cache_qkv = self.qkv.forward(x)
        q, k, v = np.split(qkv, 3, axis=-1)
        # (B, T, H, hd) -> (B, H, T, hd)
        sh = lambda a: a.reshape(B, T, H, hd).transpose(0, 2, 1, 3)
        q, k, v = sh(q), sh(k), sh(v)
        q = self.rope.apply(q)
        k = self.rope.apply(k)
        scale = 1.0 / math.sqrt(hd)
        scores = (q @ k.transpose(0, 1, 3, 2)) * scale          # (B, H, T, T)
        if self.causal:
            mask = np.triu(np.ones((T, T), dtype=bool), k=1)
            scores = np.where(mask, -np.inf, scores)
        att = softmax(scores, axis=-1)
        ctx = att @ v                                           # (B, H, T, hd)
        ctx = ctx.transpose(0, 2, 1, 3).reshape(B, T, D)
        out, cache_proj = self.proj.forward(ctx)
        return out, (q, k, v, att, scale, sh, cache_qkv, cache_proj, B, T)

    def backward(self, dout: np.ndarray, cache):
        q, k, v, att, scale, sh, cache_qkv, cache_proj, B, T = cache
        dctx, dproj_w, dproj_b = self.proj.backward(dout, cache_proj)
        H, hd = self.n_heads, self.head_dim
        dctx = dctx.reshape(B, T, H, hd).transpose(0, 2, 1, 3)   # (B,H,T,hd)
        datt = dctx @ v.transpose(0, 1, 3, 2)
        dv = att.transpose(0, 1, 3, 2) @ dctx
        dscores = att * (datt - np.sum(datt * att, axis=-1, keepdims=True))
        dscores = dscores * scale
        dq = dscores @ k
        dk = dscores.transpose(0, 1, 3, 2) @ q
        dq = self.rope.apply_inverse(dq)
        dk = self.rope.apply_inverse(dk)
        un = lambda a: a.transpose(0, 2, 1, 3).reshape(B, T, self.d_model)
        dqkv = np.concatenate([un(dq), un(dk), un(dv)], axis=-1)
        dx, dqkv_w, dqkv_b = self.qkv.backward(dqkv, cache_qkv)
        return dx, dqkv_w, dqkv_b, dproj_w, dproj_b

    def params(self):
        return [("qkv." + n, p) for n, p in self.qkv.params()] + [("proj." + n, p) for n, p in self.proj.params()]


# --------------------------------------------------------------------------
# transformer block
# --------------------------------------------------------------------------


class Block:
    def __init__(self, rng_, d_model: int, n_heads: int, d_ff: int, causal: bool, max_len: int, std: float):
        self.n1 = np.ones(d_model, np.float32)
        self.n2 = np.ones(d_model, np.float32)
        self.att = Attention(rng_, d_model, n_heads, causal, max_len, std)
        self.fc1 = Linear.make(rng_, d_model, d_ff, std)
        self.fc2 = Linear.make(rng_, d_ff, d_model, std)

    def forward(self, x: np.ndarray):
        h, c1 = rmsnorm(x, self.n1)
        a, ca = self.att.forward(h)
        x = x + a
        h2, c2 = rmsnorm(x, self.n2)
        f, cf1 = self.fc1.forward(h2)
        g = gelu(f)
        y, cf2 = self.fc2.forward(g)
        x = x + y
        return x, (c1, ca, c2, cf1, f, cf2)

    def backward(self, dx: np.ndarray, cache):
        """Returns (dx, grads) where grads uses the same names as params()."""
        c1, ca, c2, cf1, f, cf2 = cache
        # second residual branch
        dy, dw2, db2 = self.fc2.backward(dx, cf2)
        dg = dy * gelu_grad(f)
        df, dw1, db1 = self.fc1.backward(dg, cf1)
        dh2, dn2 = rmsnorm_bwd(df, c2)
        dres = dx + dh2
        # attention branch
        da, dqkv_w, dqkv_b, dproj_w, dproj_b = self.att.backward(dres, ca)
        dh, dn1 = rmsnorm_bwd(da, c1)
        grads = {
            "n1": dn1, "n2": dn2,
            "att.qkv.w": dqkv_w, "att.qkv.b": dqkv_b,
            "att.proj.w": dproj_w, "att.proj.b": dproj_b,
            "fc1.w": dw1, "fc1.b": db1,
            "fc2.w": dw2, "fc2.b": db2,
        }
        return dres + dh, grads

    def params(self):
        return ([("n1", self.n1), ("n2", self.n2)]
                + [("att." + n, p) for n, p in self.att.params()]
                + [("fc1." + n, p) for n, p in self.fc1.params()]
                + [("fc2." + n, p) for n, p in self.fc2.params()])


# --------------------------------------------------------------------------
# optimizer
# --------------------------------------------------------------------------


class AdamW:
    """AdamW with decoupled weight decay, cosine schedule and global-norm clipping.

    Gradients are accumulated with `add`, applied with `step`, so a variable
    batch size (or gradient accumulation) needs no changes here.
    """

    def __init__(self, params: list[tuple[str, np.ndarray]], lr: float = 3e-3,
                 betas=(0.9, 0.95), eps: float = 1e-8, weight_decay: float = 0.01):
        self.params = params
        self.lr = lr
        self.b1, self.b2 = betas
        self.eps = eps
        self.wd = weight_decay
        self.t = 0
        self.m = {n: np.zeros_like(p) for n, p in params}
        self.v = {n: np.zeros_like(p) for n, p in params}
        self.g = {n: np.zeros_like(p) for n, p in params}
        self.clip = 1.0

    def zero(self):
        for n, _ in self.params:
            self.g[n].fill(0.0)

    def add(self, name: str, grad: np.ndarray, scale: float = 1.0):
        if name in self.g:
            self.g[name] += grad * scale

    def step(self, lr_scale: float = 1.0):
        total = 0.0
        for n, _ in self.params:
            total += float(np.sum(self.g[n] * self.g[n]))
        norm = math.sqrt(total) + 1e-9
        clip = self.clip / norm if norm > self.clip else 1.0
        self.t += 1
        for n, p in self.params:
            g = self.g[n] * clip
            self.m[n] = self.b1 * self.m[n] + (1 - self.b1) * g
            self.v[n] = self.b2 * self.v[n] + (1 - self.b2) * g * g
            mh = self.m[n] / (1 - self.b1 ** self.t)
            vh = self.v[n] / (1 - self.b2 ** self.t)
            lr = self.lr * lr_scale
            p -= lr * (mh / (np.sqrt(vh) + self.eps) + self.wd * p)
        return norm


def cosine_lr(step: int, total: int, warmup: int) -> float:
    if step < warmup:
        return (step + 1) / max(1, warmup)
    t = (step - warmup) / max(1, total - warmup)
    return 0.5 * (1.0 + math.cos(math.pi * min(1.0, t)))


def cross_entropy(logits: np.ndarray, targets: np.ndarray) -> tuple[float, np.ndarray]:
    """logits (N, V), targets (N,) int64 -> (mean loss, dlogits)."""
    m = logits.max(axis=-1, keepdims=True)
    z = logits - m
    logsumexp = np.log(np.sum(np.exp(z), axis=-1, keepdims=True))
    logp = z - logsumexp
    n = logits.shape[0]
    loss = float(-np.mean(logp[np.arange(n), targets]))
    d = np.exp(logp)
    d[np.arange(n), targets] -= 1.0
    return loss, (d / n).astype(np.float32)


def accuracy(logits: np.ndarray, targets: np.ndarray) -> float:
    return float(np.mean(np.argmax(logits, axis=-1) == targets))


def count_params(params: list[tuple[str, np.ndarray]]) -> int:
    return int(sum(p.size for _, p in params))
