"""Gradient checks for the hand-written Nik1 backward passes.

Central finite differences on a random subset of parameters, for every layer and
for the full stack. Run:  python3 nik1/tests/test_grad.py

A hand-written transformer that is only *probably* right still trains — it just
trains badly, and the symptom (a flat loss) is easy to blame on the data. This
test is the cheap insurance.
"""
from __future__ import annotations

import os
import sys

import numpy as np

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "python"))

from nik1 import ops  # noqa: E402
from nik1.model import Nik1Encoder, Nik1LM  # noqa: E402

EPS = 1e-2
TOL = 2e-2          # relative tolerance
ATOL = 3e-4         # absolute floor: float32 FD noise on a loss of order 1


def fd_check(name, params, build_loss, n_probe=6, seed=0):
    """build_loss(params) -> (loss, grads dict)"""
    r = np.random.default_rng(seed)
    loss, grads = build_loss(params)
    worst = 0.0
    worst_at = None
    checked = 0
    for pname, p in params.items():
        flat = p.reshape(-1)
        idx = r.choice(flat.size, size=min(n_probe, flat.size), replace=False)
        for i in idx:
            orig = flat[i]
            flat[i] = orig + EPS
            lp, _ = build_loss(params)
            flat[i] = orig - EPS
            lm, _ = build_loss(params)
            flat[i] = orig
            num = (lp - lm) / (2 * EPS)
            ana = float(grads[pname].reshape(-1)[i])
            # combined relative/absolute test: a near-zero gradient is dominated
            # by float32 finite-difference noise, which is not a backprop bug
            bound = TOL * max(abs(num), abs(ana)) + ATOL
            rel = abs(num - ana) / bound
            if rel > worst:
                worst, worst_at = rel, f"{pname}[{i}] num={num:.3e} ana={ana:.3e}"
            checked += 1
    ok = worst < 1.0
    print(f"  {'PASS' if ok else 'FAIL'} {name:<26} worst rel err {worst:.2e} over {checked} probes ({worst_at})")
    return ok


def check_linear():
    r = ops.rng(1)
    lin = ops.Linear.make(r, 5, 4, 0.3)
    x = r.standard_normal((2, 3, 5)).astype(np.float32)

    def build(params):
        lin.w = params["w"]
        lin.b = params["b"]
        y, cache = lin.forward(x)
        loss = float(np.sum(y * y))
        dy = 2 * y
        _, dw, db = lin.backward(dy, cache)
        return loss, {"w": dw, "b": db}

    return fd_check("linear", {"w": lin.w.copy(), "b": lin.b.copy()}, build)


def check_rmsnorm():
    r = ops.rng(2)
    w = r.standard_normal((6,)).astype(np.float32)
    x = r.standard_normal((3, 4, 6)).astype(np.float32) * 1.7

    def build(params):
        out, cache = ops.rmsnorm(x, params["w"])
        loss = float(np.sum(np.sin(out)))
        dout = np.cos(out)
        dx, dw = ops.rmsnorm_bwd(dout, cache)
        return loss, {"w": dw}

    return fd_check("rmsnorm", {"w": w.copy()}, build)


def check_attention(causal: bool):
    r = ops.rng(3 if causal else 4)
    att = ops.Attention(r, d_model=8, n_heads=2, causal=causal, max_len=6, std=0.3)
    x = r.standard_normal((2, 5, 8)).astype(np.float32)

    def build(params):
        for n, p in att.params():
            p[...] = params[n]
        y, cache = att.forward(x)
        loss = float(np.sum(y * y * 0.5))
        dx, *dps = att.backward(y, cache)
        grads = {n: g for (n, _), g in zip(att.params(), dps)}
        return loss, grads

    return fd_check(f"attention {'causal' if causal else 'full'}", {n: p.copy() for n, p in att.params()}, build, n_probe=3)


def check_block():
    r = ops.rng(5)
    blk = ops.Block(r, d_model=8, n_heads=2, d_ff=16, causal=True, max_len=5, std=0.3)
    x = r.standard_normal((2, 5, 8)).astype(np.float32)

    def build(params):
        for n, p in blk.params():
            p[...] = params[n]
        y, cache = blk.forward(x)
        loss = float(np.sum(y * y * 0.5))
        dx, grads = blk.backward(y, cache)
        return loss, grads

    return fd_check("block (causal)", {n: p.copy() for n, p in blk.params()}, build, n_probe=2)


def check_lm_loss():
    r = ops.rng(6)
    vocab, T = 21, 6
    model = Nik1LM(vocab=vocab, d_model=16, n_layers=1, n_heads=2, d_ff=24, max_len=T, seed=7, tie=True)
    toks = r.integers(0, vocab, size=(3, T)).astype(np.int64)

    def build(params):
        for n, p in model.params():
            p[...] = params[n]
        logits, cache = model.forward(toks)
        flat = logits.reshape(-1, vocab)
        tgt = toks.reshape(-1)
        # predict next token: drop the last logit, drop the first target
        loss, dlogits = ops.cross_entropy(flat[:-1], tgt[1:])
        dlogits_full = np.zeros_like(flat)
        dlogits_full[:-1] = dlogits
        grads = model.backward(dlogits_full.reshape(logits.shape), cache)
        return loss, grads

    return fd_check("lm cross-entropy", {n: p.copy() for n, p in model.params()}, build, n_probe=2)


def check_encoder():
    r = ops.rng(8)
    model = Nik1Encoder(vocab=13, d_model=12, n_layers=1, n_heads=3, d_ff=20, max_len=5, seed=9)
    toks = r.integers(0, 13, size=(2, 5)).astype(np.int64)

    def build(params):
        for n, p in model.params():
            p[...] = params[n]
        emb, cache = model.forward(toks)
        loss = float(np.sum(emb ** 2))
        grads = model.backward_cache(2 * emb, cache)
        return loss, grads

    return fd_check("encoder", {n: p.copy() for n, p in model.params()}, build, n_probe=2)


if __name__ == "__main__":
    print("Nik1 gradient checks")
    results = {
        "linear": check_linear(),
        "rmsnorm": check_rmsnorm(),
        "attention": check_attention(False),
        "attention_causal": check_attention(True),
        "block": check_block(),
        "lm": check_lm_loss(),
        "encoder": check_encoder(),
    }
    bad = [k for k, v in results.items() if not v]
    print(f"\n{len(results) - len(bad)}/{len(results)} gradient checks passed")
    sys.exit(1 if bad else 0)
