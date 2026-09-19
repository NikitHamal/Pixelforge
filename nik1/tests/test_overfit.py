"""Overfit tests: the cheapest way to catch a broken training path.

A correct transformer with correct gradients can memorise four examples in a few
hundred steps. A model that cannot reproduce four examples it has seen has a
structural bug — misaligned targets, a mask that hides the loss, a frozen
parameter — and no amount of training will fix it.

This is the test that caught the off-by-one in the next-token shift: the loss
curve looked perfect because the model had learned to copy its own input.
"""
from __future__ import annotations

import os
import sys

import numpy as np

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "python"))

from nik1 import train  # noqa: E402
from nik1.model import Nik1LM, Nik1MLP  # noqa: E402
from nik1.tokenizer import BPE  # noqa: E402

FAIL = 0


def ok(cond, msg):
    global FAIL
    print(("PASS " if cond else "FAIL ") + msg)
    FAIL += 0 if cond else 1


def lm_overfit():
    targets = [
        ('{"tool":"load_template","args":{"id":"rpg_knight"}}', "give me the rpg knight"),
        ('{"tool":"export","args":{"format":"gif"}}', "export a gif"),
        ('{"tool":"undo","args":{}}', "undo that"),
        ('{"tool":"set_color","args":{"color":"#ff0044"}}', "use color #ff0044"),
    ]
    bpe = BPE().fit([p + " " + t for t, p in targets], 320, 1)
    pairs = [(p, t) for t, p in targets]
    model = Nik1LM(vocab=bpe.vocab_size, d_model=48, n_layers=2, n_heads=4, d_ff=96, max_len=64, seed=1)
    cfg = train.TrainCfg(steps=400, batch=4, lr=6e-3, seed=1, max_len=64, log_every=100)
    train.train_lm(model, bpe, pairs, pairs, cfg, log=lambda *a: None)
    hits = 0
    for prompt, target in pairs:
        text, _ = train.greedy(model, bpe, prompt, max_new=64)
        hits += text.strip() == target
    ok(hits == len(pairs), f"LM memorises all 4 examples (got {hits}/{len(pairs)})")


def mlp_overfit():
    rng = np.random.default_rng(0)
    X = rng.standard_normal((64, 41)).astype(np.float32)
    W = rng.standard_normal((41, 4)).astype(np.float32)
    Y = np.argmax(X @ W, axis=-1).astype(np.int64)
    model = Nik1MLP(41, (32,), 4, seed=0)
    cfg = train.TrainCfg(steps=600, batch=32, lr=6e-3, seed=0, log_every=200)
    train.train_mlp(model, list(zip(X, Y)), list(zip(X, Y)), cfg, 4, log=lambda *a: None)
    logits, _ = model.forward(X)
    acc = float(np.mean(np.argmax(logits, axis=-1) == Y))
    ok(acc > 0.97, f"MLP fits a separable synthetic problem (acc {acc:.3f})")


if __name__ == "__main__":
    print("Nik1 overfit tests")
    lm_overfit()
    mlp_overfit()
    sys.exit(1 if FAIL else 0)
