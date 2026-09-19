"""Nik1 model family: one decoder LM, one encoder, one MLP head.

All three share the same block so the quantizer, the exported weight format and
the JS runtime each have exactly one code path to support.
"""
from __future__ import annotations

import numpy as np

from . import ops


class Nik1LM:
    """Decoder-only language model. Used for the grammar-constrained router."""

    def __init__(self, vocab: int, d_model: int = 96, n_layers: int = 4, n_heads: int = 4,
                 d_ff: int = 256, max_len: int = 128, seed: int = 0, tie: bool = True, std: float | None = None):
        r = ops.rng(seed)
        std = std if std is not None else 1.0 / np.sqrt(d_model)
        self.cfg = dict(vocab=vocab, d_model=d_model, n_layers=n_layers, n_heads=n_heads,
                        d_ff=d_ff, max_len=max_len, tie=tie)
        self.tok = ops.init_normal(r, (vocab, d_model), std)
        self.blocks = [ops.Block(r, d_model, n_heads, d_ff, causal=True, max_len=max_len, std=std)
                       for _ in range(n_layers)]
        self.norm_f = np.ones(d_model, np.float32)
        if not tie:
            self.head = ops.Linear.make(r, d_model, vocab, std, bias=False)

    # ---------------- forward ----------------
    def forward(self, toks: np.ndarray):
        B, T = toks.shape
        x = self.tok[toks]                                   # (B, T, D)
        caches = []
        for blk in self.blocks:
            x, c = blk.forward(x)
            caches.append(c)
        h, cnorm = ops.rmsnorm(x, self.norm_f)
        if self.cfg["tie"]:
            logits = h @ self.tok.T                          # (B, T, V)
            head_cache = None
        else:
            logits, head_cache = self.head.forward(h)
        return logits, (toks, caches, cnorm, h, head_cache)

    def backward(self, dlogits: np.ndarray, cache):
        toks, caches, cnorm, h, head_cache = cache
        grads: dict[str, np.ndarray] = {}
        if self.cfg["tie"]:
            dtok_out = np.einsum("btv,btd->vd", dlogits, h)
            dh = dlogits @ self.tok
        else:
            dh, dw, db = self.head.backward(dlogits, head_cache)
            grads["head.w"] = dw.astype(np.float32)
            dtok_out = None
        dx, dnorm = ops.rmsnorm_bwd(dh, cnorm)
        grads["norm_f"] = dnorm
        for i in range(len(self.blocks) - 1, -1, -1):
            dx, bg = self.blocks[i].backward(dx, caches[i])
            for k, v in bg.items():
                grads[f"blocks.{i}.{k}"] = v
        # token embedding gradient (+ the tied output projection)
        dtok = np.zeros_like(self.tok)
        np.add.at(dtok, toks.reshape(-1), dx.reshape(-1, dx.shape[-1]))
        if dtok_out is not None:
            dtok += dtok_out
        grads["tok"] = dtok
        return grads

    def params(self):
        out = [("tok", self.tok), ("norm_f", self.norm_f)]
        if not self.cfg["tie"]:
            out += [("head.w", self.head.w)]
        for i, blk in enumerate(self.blocks):
            out += [(f"blocks.{i}.{n}", p) for n, p in blk.params()]
        return out


class Nik1Encoder:
    """Bidirectional transformer + mean pooling -> L2-normalized embedding."""

    def __init__(self, vocab: int, d_model: int = 64, n_layers: int = 2, n_heads: int = 4,
                 d_ff: int = 128, max_len: int = 64, seed: int = 0, std: float | None = None):
        r = ops.rng(seed)
        std = std if std is not None else 1.0 / np.sqrt(d_model)
        self.cfg = dict(vocab=vocab, d_model=d_model, n_layers=n_layers, n_heads=n_heads, d_ff=d_ff, max_len=max_len)
        self.tok = ops.init_normal(r, (vocab, d_model), std)
        self.blocks = [ops.Block(r, d_model, n_heads, d_ff, causal=False, max_len=max_len, std=std)
                       for _ in range(n_layers)]
        self.norm_f = np.ones(d_model, np.float32)

    def forward(self, toks: np.ndarray, mask: np.ndarray | None = None):
        B, T = toks.shape
        x = self.tok[toks]
        caches = []
        for blk in self.blocks:
            x, c = blk.forward(x)
            caches.append(c)
        h, cnorm = ops.rmsnorm(x, self.norm_f)
        if mask is None:
            pooled = h.mean(axis=1)
        else:
            m = mask.astype(np.float32)[..., None]
            pooled = (h * m).sum(axis=1) / np.maximum(m.sum(axis=1), 1e-6)
        norm = np.linalg.norm(pooled, axis=-1, keepdims=True) + 1e-8
        emb = pooled / norm
        return emb, (toks, caches, cnorm, h, mask)

    def backward(self, demb: np.ndarray):
        raise NotImplementedError("use backward_cache for training")

    def backward_cache(self, demb: np.ndarray, cache):
        toks, caches, cnorm, h, mask = cache
        # pooled -> L2-normalized: d/dp of p/|p| is (I - y yᵀ) / |p|
        p = h.mean(axis=1) if mask is None else (h * mask.astype(np.float32)[..., None]).sum(axis=1) / np.maximum(mask.astype(np.float32).sum(axis=1, keepdims=True), 1e-6)
        nrm = np.linalg.norm(p, axis=-1, keepdims=True) + 1e-8
        y = p / nrm
        dp = (demb - y * np.sum(demb * y, axis=-1, keepdims=True)) / nrm
        if mask is None:
            dh = np.repeat(dp[:, None, :], h.shape[1], axis=1) / h.shape[1]
        else:
            m = mask.astype(np.float32)[..., None]
            dh = m * dp[:, None, :] / np.maximum(m.sum(axis=1, keepdims=True), 1e-6)
        grads: dict[str, np.ndarray] = {}
        dx, dnorm = ops.rmsnorm_bwd(dh, cnorm)
        grads["norm_f"] = dnorm
        for i in range(len(self.blocks) - 1, -1, -1):
            dx, bg = self.blocks[i].backward(dx, caches[i])
            for k, v in bg.items():
                grads[f"blocks.{i}.{k}"] = v
        dtok = np.zeros_like(self.tok)
        np.add.at(dtok, toks.reshape(-1), dx.reshape(-1, dx.shape[-1]))
        grads["tok"] = dtok
        return grads

    def params(self):
        out = [("tok", self.tok), ("norm_f", self.norm_f)]
        for i, blk in enumerate(self.blocks):
            out += [(f"blocks.{i}.{n}", p) for n, p in blk.params()]
        return out


class Nik1MLP:
    """Feature -> class head. Used for the on-device style chooser."""

    def __init__(self, n_in: int, hidden: tuple[int, ...], n_out: int, seed: int = 0):
        r = ops.rng(seed)
        dims = (n_in,) + tuple(hidden) + (n_out,)
        self.layers = [ops.Linear.make(r, dims[i], dims[i + 1], 1.0 / np.sqrt(dims[i])) for i in range(len(dims) - 1)]
        self.cfg = dict(n_in=n_in, hidden=list(hidden), n_out=n_out)

    def forward(self, x: np.ndarray):
        caches = []
        h = x
        for i, lin in enumerate(self.layers):
            h, c = lin.forward(h)
            caches.append(c)
            if i < len(self.layers) - 1:
                h = np.maximum(h, 0.0)          # ReLU keeps the on-device path branch-free
                caches.append(("relu", h))
        return h, caches

    def backward(self, dout: np.ndarray, caches):
        grads = {}
        d = dout
        for i in range(len(self.layers) - 1, -1, -1):
            if i < len(self.layers) - 1:
                d = d * (caches[2 * i + 1][1] > 0)
            c = caches[2 * i]
            d, dw, db = self.layers[i].backward(d, c)
            grads[f"layers.{i}.w"] = dw
            grads[f"layers.{i}.b"] = db
        return d, grads

    def params(self):
        out = []
        for i, lin in enumerate(self.layers):
            out += [(f"layers.{i}.w", lin.w), (f"layers.{i}.b", lin.b)]
        return out
