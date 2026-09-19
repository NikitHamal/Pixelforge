#!/usr/bin/env python3
"""Train + export `nik1-palette`: sprite features -> palette family.

    python3 nik1/python/train_palette.py [--steps 3000]

Data: every sprite in the library rendered and quantized through each of Nik1's
8 palette families, features computed the same way the browser computes them.
The task answers the question an artist has when importing unknown art: "what
colour budget is this sprite drawn for?"
"""
from __future__ import annotations

import argparse, os, sys, time
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from nik1 import ops, train
from nik1.data import build_palette_dataset, palette_majority_baseline
from nik1.export import FEATURE_SPEC, export_mlp
from nik1.model import Nik1MLP


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--steps", type=int, default=3000)
    ap.add_argument("--batch", type=int, default=128)
    ap.add_argument("--lr", type=float, default=3e-3)
    ap.add_argument("--hidden", type=str, default="64,32")
    ap.add_argument("--bits", type=int, default=8, choices=[4, 8])
    ap.add_argument("--seed", type=int, default=3)
    args = ap.parse_args()

    t0 = time.time()
    print("nik1-palette")
    tr, va, labels = build_palette_dataset(seed=args.seed)
    majority = palette_majority_baseline(va)
    print(f"  data: {len(tr)} train / {len(va)} val, {len(labels)} classes, majority baseline {majority:.3f}")

    hidden = tuple(int(h) for h in args.hidden.split(",") if h)
    model = Nik1MLP(n_in=FEATURE_SPEC["dims"], hidden=hidden, n_out=len(labels), seed=args.seed)
    print(f"  model: {ops.count_params(model.params()):,} parameters, hidden {hidden}")

    cfg = train.TrainCfg(steps=args.steps, batch=args.batch, lr=args.lr, seed=args.seed, log_every=max(200, args.steps // 10))
    hist = train.train_mlp(model, tr, va, cfg, n_classes=len(labels))

    VX = np.array([x for x, _ in va], dtype=np.float32)
    VY = np.array([y for _, y in va], dtype=np.int64)
    logits, _ = model.forward(VX)
    acc = ops.accuracy(logits, VY)
    per_class = {}
    for i, name in enumerate(labels):
        m = VY == i
        if m.sum():
            per_class[name] = round(float(np.mean(np.argmax(logits[m], axis=-1) == i)), 3)
    print(f"  val accuracy {acc:.4f} (majority {majority:.4f}, lift {acc - majority:+.4f})")
    print("  per class:", " ".join(f"{k}:{v}" for k, v in per_class.items()))

    metrics = {"task": "palette", "params": ops.count_params(model.params()),
               "train_rows": len(tr), "val_rows": len(va), "classes": labels,
               "majority_baseline": majority, "val_accuracy": acc, "per_class": per_class,
               "train": hist, "seconds_total": round(time.time() - t0, 1)}
    save_checkpoint(model, None, "nik1-palette", {"feature_spec": FEATURE_SPEC, "labels": labels})
    rep = export_mlp(model, "nik1-palette", FEATURE_SPEC, labels, bits=args.bits, metrics=metrics)
    print(f"  exported: {rep['path']} ({rep['kb']} KB, {rep['params']:,} params, int{args.bits})")


if __name__ == "__main__":
    main()
