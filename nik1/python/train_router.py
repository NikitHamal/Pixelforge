#!/usr/bin/env python3
"""Train + export `nik1-route`: utterance -> tool call, grammar-constrained.

    python3 nik1/python/train_router.py [--steps 1200] [--bits 8]

The model is a ~0.5M-parameter decoder. Its whole job is to turn "give me the
knight" into {"tool":"load_template","args":{"id":"rpg_knight"}} in a couple of
milliseconds, on device, with no network.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import time

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from nik1 import ops, train  # noqa: E402
from nik1.data import build_route_dataset  # noqa: E402
from nik1.export import export_lm, save_checkpoint  # noqa: E402
from nik1.grammar import route_mask_fn  # noqa: E402
from nik1.model import Nik1LM  # noqa: E402
from nik1.tokenizer import BPE  # noqa: E402

PROMPT_PREFIX = "task: route\n"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--steps", type=int, default=1500)
    ap.add_argument("--batch", type=int, default=32)
    ap.add_argument("--lr", type=float, default=4e-3)
    ap.add_argument("--bits", type=int, default=8, choices=[4, 8])
    ap.add_argument("--d-model", type=int, default=96)
    ap.add_argument("--layers", type=int, default=4)
    ap.add_argument("--heads", type=int, default=4)
    ap.add_argument("--d-ff", type=int, default=256)
    ap.add_argument("--vocab", type=int, default=1024)
    ap.add_argument("--seed", type=int, default=5)
    ap.add_argument("--eval-limit", type=int, default=32)
    ap.add_argument("--log-every", type=int, default=150)
    args = ap.parse_args()

    t0 = time.time()
    print("nik1-route")
    train_ex, val_ex = build_route_dataset(seed=args.seed, per_tool=260)
    print(f"  data: {len(train_ex)} train / {len(val_ex)} val examples, "
          f"{len(set(e.tool for e in train_ex))} tools")

    corpus = [e.text for e in train_ex] + [e.target for e in train_ex]
    bpe = BPE().fit(corpus, vocab_size=args.vocab, min_pair_freq=2, verbose=True)
    pairs_tr = [(PROMPT_PREFIX + e.text, e.target) for e in train_ex]
    pairs_va = [(PROMPT_PREFIX + e.text, e.target) for e in val_ex]

    model = Nik1LM(vocab=bpe.vocab_size, d_model=args.d_model, n_layers=args.layers,
                   n_heads=args.heads, d_ff=args.d_ff, max_len=96, seed=args.seed)
    n_params = ops.count_params(model.params())
    print(f"  model: {n_params:,} parameters, {args.layers} layers, d={args.d_model}, vocab {bpe.vocab_size}")

    cfg = train.TrainCfg(steps=args.steps, batch=args.batch, lr=args.lr, seed=args.seed, max_len=96,
                        log_every=args.log_every, eval_limit=args.eval_limit)
    print("  training (unconstrained decode for the checkpoint metric)")
    hist = train.train_lm(model, bpe, pairs_tr, pairs_va, cfg)

    # Free-run evaluation, with and without the grammar: the difference is the
    # reliability story this model family is sold on.
    print("  evaluating free-running decode")
    exact_free, _, valid_free = train.evaluate_lm(model, bpe, pairs_va, cfg, limit=250)
    exact_gram, _, valid_gram = train.evaluate_lm(model, bpe, pairs_va, cfg, limit=250, mask_fn_factory=route_mask_fn)
    print(f"    unconstrained: exact {exact_free:.3f}  valid-json {valid_free:.3f}")
    print(f"    grammar      : exact {exact_gram:.3f}  valid-json {valid_gram:.3f}")

    # exact match of the parsed call (args order independent) — the metric that matters
    rows = []
    tools_json = json.load(open(os.path.join(os.path.dirname(__file__), "..", "data", "tools.json")))
    for prompt, target in pairs_va[:200]:
        text, _ = train.greedy(model, bpe, prompt, max_new=96, mask_fn=route_mask_fn(bpe))
        rows.append({"prompt": prompt, "target": target, "pred": text.strip()})
    def parsed(s):
        try:
            return json.loads(s)
        except Exception:
            return None
    call_ok = sum(1 for r in rows if parsed(r["pred"]) is not None
                  and parsed(r["pred"]).get("tool") == parsed(r["target"]).get("tool"))
    args_ok = sum(1 for r in rows if parsed(r["pred"]) == parsed(r["target"]))
    print(f"    tool accuracy {call_ok / len(rows):.3f}   exact-call accuracy {args_ok / len(rows):.3f}")

    metrics = {
        "task": "route",
        "params": n_params,
        "train_examples": len(train_ex),
        "val_examples": len(val_ex),
        "tools": len(set(e.tool for e in train_ex)),
        "train": hist,
        "eval": {
            "exact_free": exact_free, "valid_json_free": valid_free,
            "exact_grammar": exact_gram, "valid_json_grammar": valid_gram,
            "tool_accuracy": call_ok / len(rows), "exact_call_accuracy": args_ok / len(rows),
            "n": len(rows),
        },
        "samples": rows[:25],
        "seconds_total": round(time.time() - t0, 1),
    }
    save_checkpoint(model, bpe, "nik1-route")
    rep = export_lm(model, bpe, "nik1-route", bits=args.bits, metrics=metrics,
                    extra={"prompt_prefix": PROMPT_PREFIX, "tool_index": sorted(set(e.tool for e in train_ex)),
                           "grammar": "route-v1"})
    print(f"  exported: {rep['path']} ({rep['kb']} KB, {rep['params']:,} params, int{args.bits})")


if __name__ == "__main__":
    main()
