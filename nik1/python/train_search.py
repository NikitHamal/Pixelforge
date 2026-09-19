#!/usr/bin/env python3
"""Train + export `nik1-search`: brief -> asset, on-device retrieval.

    python3 nik1/python/train_search.py [--steps 4000]

A ~200k-parameter bi-encoder trained with InfoNCE over in-batch negatives, then
exported with a precomputed document table (the catalogue is static), so the
runtime cost of a query is one short encode plus a dot product.
"""
from __future__ import annotations

import argparse, os, sys, time
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from nik1 import ops, train
from nik1.data import build_retrieval_dataset, template_docs, load
from nik1.export import export_encoder
from nik1.model import Nik1Encoder
from nik1.tokenizer import BPE


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--steps", type=int, default=4000)
    ap.add_argument("--batch", type=int, default=32)
    ap.add_argument("--lr", type=float, default=4e-3)
    ap.add_argument("--d-model", type=int, default=64)
    ap.add_argument("--layers", type=int, default=2)
    ap.add_argument("--heads", type=int, default=4)
    ap.add_argument("--d-ff", type=int, default=128)
    ap.add_argument("--epochs", type=int, default=8)
    ap.add_argument("--bits", type=int, default=8, choices=[4, 8])
    ap.add_argument("--seed", type=int, default=17)
    ap.add_argument("--vocab", type=int, default=1024)
    ap.add_argument("--log-every", type=int, default=300)
    ap.add_argument("--per-template", type=int, default=24)
    args = ap.parse_args()

    t0 = time.time()
    print("nik1-search")
    tr, va, train_ids, val_ids, by_id = build_retrieval_dataset(seed=args.seed, per_template=args.per_template)
    # an answer is "acceptable" if it shares a tag or the category with the source
    accept = {}
    for t in load("templates.json"):
        tags = set(t["tags"])
        accept[t["id"]] = {u["id"] for u in load("templates.json")
                           if u["id"] == t["id"] or (tags & set(u["tags"])) or u["category"] == t["category"]}
    all_ids = sorted(by_id.keys())
    docs = template_docs(list(by_id.values()))
    # corpus for the tokenizer: every template's text (documents are static)
    corpus = list(docs.values()) + [q for q, _ in tr]
    bpe = BPE().fit(corpus, vocab_size=args.vocab, min_pair_freq=2, verbose=True)
    print(f"  data: {len(tr)} train queries / {len(va)} val queries over {len(all_ids)} templates")
    print(f"  split: {len(train_ids)} train templates / {len(val_ids)} held out")

    model = Nik1Encoder(vocab=bpe.vocab_size, d_model=args.d_model, n_layers=args.layers,
                        n_heads=args.heads, d_ff=args.d_ff, max_len=64, seed=args.seed)
    print(f"  model: {ops.count_params(model.params()):,} parameters, d={args.d_model}, embed dim {args.d_model}")

    cfg = train.TrainCfg(steps=args.steps, batch=args.batch, lr=args.lr, seed=args.seed, max_len=64,
                         epochs=args.epochs, log_every=args.log_every)
    hist = train.train_encoder(model, bpe, tr, va, docs, all_ids, cfg, accept=accept)

    final = train.eval_retrieval(model, bpe, va, docs, all_ids, cfg, accept=accept)
    majority = 1.0 / len(all_ids)
    print(f"  retrieval: any@1 {final['any@1']:.3f}  any@5 {final['any@5']:.3f}  exact r@1 {final['recall@1']:.3f}  MRR {final['mrr']:.3f}  (random r@1 {majority:.4f})")

    demb = train.encode_docs(model, bpe, docs, all_ids, 64)
    metrics = {"task": "search", "params": ops.count_params(model.params()),
               "train_queries": len(tr), "val_queries": len(va), "templates": len(all_ids),
               "random_recall@1": majority, "eval": final, "train": hist, "accept_sets": len(accept),
               "seconds_total": round(time.time() - t0, 1)}
    save_checkpoint(model, bpe, "nik1-search", {"doc_ids": all_ids, "docs": docs})
    rep = export_encoder(model, bpe, "nik1-search", all_ids, docs, demb, bits=args.bits, metrics=metrics)
    print(f"  exported: {rep['path']} ({rep['kb']} KB, {rep['params']:,} params, int{args.bits}) + {rep['docs_bytes']/1024:.1f} KB doc table")


if __name__ == "__main__":
    main()
