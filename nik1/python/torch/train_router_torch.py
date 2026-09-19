#!/usr/bin/env python3
"""Train `nik1-route` on a GPU (free Kaggle T4/P100) and export a `.nik1`.

The data generator and the tokenizer come from the NumPy package — they are pure
Python, so the GPU run sees *exactly* the dataset the laptop run saw, and the
exported container is byte-compatible with the JS runtime.

    python3 nik1/python/torch/train_router_torch.py \
        --d-model 256 --layers 6 --heads 8 --d-ff 768 --steps 6000 --batch 64

Kaggle: Runtime -> Accelerator -> GPU T4 x2 (single GPU is plenty), then run the
notebook in nik1/kaggle/ which wraps this script.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import time

import torch

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, ".."))

from nik1 import grammar  # noqa: E402
from nik1.data import build_route_dataset  # noqa: E402
from nik1.tokenizer import BPE  # noqa: E402
from torch.nik1_torch import Nik1LM, count_params, export_torch_lm  # noqa: E402

PROMPT_PREFIX = "task: route\n"


def encode_pair(bpe, prompt, target, max_len):
    p = bpe.encode(prompt)
    t = bpe.encode(target) + [bpe.eos]
    ids = [bpe.bos] + p + t
    labels = [-100] * (1 + len(p)) + t
    return ids[:max_len], labels[:max_len]


def make_batch(pairs, bpe, max_len, device):
    enc = [encode_pair(bpe, p, t, max_len) for p, t in pairs]
    T = max(len(a) for a, _ in enc)
    x = torch.full((len(enc), T), bpe.pad, dtype=torch.long)
    y = torch.full((len(enc), T), -100, dtype=torch.long)
    for r, (a, b) in enumerate(enc):
        x[r, :len(a)] = torch.tensor(a)
        y[r, :len(b)] = torch.tensor(b)
    return x.to(device), y.to(device)


@torch.no_grad()
def greedy_batch(model, bpe, prompts, max_new, device, mask_fn=None):
    """Greedy decode for a batch of prompts (no KV cache: eval only)."""
    model.eval()
    outs = []
    for prompt in prompts:
        ids = [bpe.bos] + bpe.encode(PROMPT_PREFIX + prompt)
        gen = []
        for _ in range(max_new):
            x = torch.tensor([ids[-model.cfg["max_len"]:]], device=device)
            logits = model(x)[0, -1].float()
            if mask_fn is not None:
                allowed = mask_fn(gen)
                if allowed:
                    mask = torch.full_like(logits, float("-inf"))
                    for t in allowed:
                        mask[t] = logits[t]
                    logits = mask
            nxt = int(logits.argmax())
            if nxt == bpe.eos:
                break
            ids.append(nxt)
            gen.append(nxt)
        outs.append(bpe.decode(gen))
    model.train()
    return outs


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--steps", type=int, default=6000)
    ap.add_argument("--batch", type=int, default=64)
    ap.add_argument("--lr", type=float, default=1e-3)
    ap.add_argument("--d-model", type=int, default=256)
    ap.add_argument("--layers", type=int, default=6)
    ap.add_argument("--heads", type=int, default=8)
    ap.add_argument("--d-ff", type=int, default=768)
    ap.add_argument("--vocab", type=int, default=2048)
    ap.add_argument("--max-len", type=int, default=128)
    ap.add_argument("--per-tool", type=int, default=600)
    ap.add_argument("--bits", type=int, default=8, choices=[4, 8])
    ap.add_argument("--out", default=os.path.join(HERE, "..", "..", "kaggle-out"))
    ap.add_argument("--eval-every", type=int, default=500)
    ap.add_argument("--amp", action="store_true", default=True)
    ap.add_argument("--seed", type=int, default=5)
    args = ap.parse_args()

    torch.manual_seed(args.seed)
    device = "cuda" if torch.cuda.is_available() else "cpu"
    print(f"nik1-route (torch) on {device}")
    tr, va = build_route_dataset(seed=args.seed, per_tool=args.per_tool)
    corpus = [e.text for e in tr] + [e.target for e in tr]
    bpe = BPE().fit(corpus, vocab_size=args.vocab, min_pair_freq=2, verbose=True)
    print(f"  data: {len(tr)} train / {len(va)} val, {len(set(e.tool for e in tr))} tools")

    model = Nik1LM(vocab=bpe.vocab_size, d_model=args.d_model, n_layers=args.layers,
                   n_heads=args.heads, d_ff=args.d_ff, max_len=args.max_len).to(device)
    n_params = count_params(model)
    print(f"  model: {n_params:,} parameters ({n_params * args.bits / 8 / 1024:.0f} KB at int{args.bits})")

    opt = torch.optim.AdamW(model.parameters(), lr=args.lr, weight_decay=0.02, betas=(0.9, 0.95))
    sched = torch.optim.lr_scheduler.OneCycleLR(opt, max_lr=args.lr, total_steps=args.steps, pct_start=0.05)
    scaler = torch.cuda.amp.GradScaler(enabled=args.amp and device == "cuda")

    tools = grammar.load_tool_index()
    mask_fn = grammar.route_mask_fn(bpe, list(tools.keys()))
    val_prompts = [e.text for e in va[:200]]
    val_targets = [e.target for e in va[:200]]

    import random
    rnd = random.Random(args.seed)
    t0 = time.time()
    step = 0
    model.train()
    while step < args.steps:
        batch = [tr[rnd.randrange(len(tr))] for _ in range(args.batch)]
        x, y = make_batch([(e.text, e.target) for e in batch], bpe, args.max_len, device)
        with torch.cuda.amp.autocast(enabled=args.amp and device == "cuda"):
            loss = model.loss(x, y)
        opt.zero_grad(set_to_none=True)
        scaler.scale(loss).backward()
        scaler.unscale_(opt)
        torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
        scaler.step(opt)
        scaler.update()
        sched.step()
        step += 1
        if step % 100 == 0:
            print(f"    step {step:5d}  loss {loss.item():.4f}  ({(time.time() - t0):.0f}s)")
        if step % args.eval_every == 0 or step == args.steps:
            preds = greedy_batch(model, bpe, val_prompts[:64], args.max_len, device, mask_fn=mask_fn)
            exact = sum(p.strip() == t.strip() for p, t in zip(preds, val_targets[:64])) / 64
            print(f"    step {step:5d}  val exact {exact:.3f}")

    preds = greedy_batch(model, bpe, val_prompts, args.max_len, device, mask_fn=mask_fn)
    def parsed(s):
        try:
            return json.loads(s)
        except Exception:
            return None
    tool_ok = sum(1 for p, t in zip(preds, val_targets)
                  if parsed(p) and parsed(t) and parsed(p).get("tool") == parsed(t).get("tool")) / len(preds)
    exact = sum(p.strip() == t.strip() for p, t in zip(preds, val_targets)) / len(preds)
    valid = sum(1 for p in preds if parsed(p)) / len(preds)
    print(f"  final: exact {exact:.3f}  tool {tool_ok:.3f}  valid-json {valid:.3f}")

    info = export_torch_lm(model, bpe, "nik1-route", args.out, bits=args.bits,
                           extra={"prompt_prefix": PROMPT_PREFIX, "grammar": "route-v1"})
    metrics = {"task": "route", "trainer": "torch", "params": n_params, "device": device,
               "train_examples": len(tr), "val_examples": len(va), "exact": exact,
               "tool_accuracy": tool_ok, "valid_json": valid, "steps": args.steps,
               "seconds": round(time.time() - t0, 1)}
    with open(os.path.join(args.out, "nik1-route.metrics.json"), "w") as fh:
        json.dump(metrics, fh, indent=1)
    print(f"  exported {info['path']} ({info['bytes'] / 1024:.1f} KB)")
    print("  copy nik1-route.nik1 + .json into nik1/js/models/ and run: node nik1/tests/test_runtime.js")


if __name__ == "__main__":
    main()
