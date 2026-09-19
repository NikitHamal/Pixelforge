#!/usr/bin/env python3
"""Distil a bigger teacher into a Nik1 student, then export a `.nik1`.

Two teacher modes, because the honest bottleneck for a task-specialist dataset is
*labels*, not parameters:

  --teacher oracle    label prompts with the deterministic template generator
                      (nik1/data.py). Unlimited pairs, zero cost, and the labels
                      are exactly the behaviour the runtime must reproduce.
  --teacher hf --model <hf-id>
                      label a prompt corpus with a real LLM from the Hub
                      (needs `pip install transformers accelerate`). Use this to
                      teach the router phrasings the templates never covered.

The student trains on (prompt, teacher target) pairs with the same prompt masking
the from-scratch trainer uses, so the two paths are directly comparable.

    python3 nik1/python/torch/distill.py --teacher oracle --steps 4000 --d-model 128
    python3 nik1/python/torch/distill.py --teacher hf --model Qwen/Qwen2.5-0.5B-Instruct --n 20000
"""
from __future__ import annotations

import argparse
import json
import os
import random
import sys
import time

import torch

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, ".."))

from nik1 import grammar  # noqa: E402
from nik1.data import build_route_dataset  # noqa: E402
from nik1.tokenizer import BPE  # noqa: E402
from torch.nik1_torch import Nik1LM, count_params, export_torch_lm  # noqa: E402
from train_router_torch import PROMPT_PREFIX, greedy_batch, make_batch  # noqa: E402

SYSTEM = ("You translate a game developer's request into one tool call. "
          "Reply with a single JSON object and nothing else: "
          '{"tool":"<name>","args":{...}}')


def label_with_hf(prompts, model_id, tools, batch_size=8, max_new=96):
    from transformers import AutoModelForCausalLM, AutoTokenizer
    tok = AutoTokenizer.from_pretrained(model_id)
    model = AutoModelForCausalLM.from_pretrained(model_id, torch_dtype="auto", device_map="auto")
    model.eval()
    schema = json.dumps({t["name"]: {"properties": list(t["properties"]), "required": t["required"]} for t in tools.values()})
    out = []
    for i in range(0, len(prompts), batch_size):
        chunk = prompts[i:i + batch_size]
        msgs = [[{"role": "system", "content": SYSTEM + "\nTools: " + schema},
                 {"role": "user", "content": p}] for p in chunk]
        text = tok.apply_chat_template(msgs, tokenize=False, add_generation_prompt=True)
        enc = tok(text, return_tensors="pt", padding=True).to(model.device)
        with torch.no_grad():
            gen = model.generate(**enc, max_new_tokens=max_new, do_sample=False)
        for j, g in enumerate(gen):
            raw = tok.decode(g[enc["input_ids"].shape[1]:], skip_special_tokens=True)
            call, notes = grammar.repair_call(raw, tools, chunk[j])
            if call is None:
                call, _ = grammar.fallback_route(chunk[j], tools)
            out.append(json.dumps(call, separators=(",", ":")))
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--teacher", choices=["oracle", "hf"], default="oracle")
    ap.add_argument("--model", default="Qwen/Qwen2.5-0.5B-Instruct")
    ap.add_argument("--n", type=int, default=20000, help="labelled prompts to use")
    ap.add_argument("--steps", type=int, default=4000)
    ap.add_argument("--batch", type=int, default=64)
    ap.add_argument("--lr", type=float, default=1e-3)
    ap.add_argument("--d-model", type=int, default=192)
    ap.add_argument("--layers", type=int, default=5)
    ap.add_argument("--heads", type=int, default=6)
    ap.add_argument("--d-ff", type=int, default=512)
    ap.add_argument("--vocab", type=int, default=1024)
    ap.add_argument("--max-len", type=int, default=128)
    ap.add_argument("--bits", type=int, default=8, choices=[4, 8])
    ap.add_argument("--out", default=os.path.join(HERE, "..", "..", "kaggle-out"))
    ap.add_argument("--seed", type=int, default=11)
    args = ap.parse_args()

    torch.manual_seed(args.seed)
    device = "cuda" if torch.cuda.is_available() else "cpu"
    tools = grammar.load_tool_index()
    print(f"nik1 distil ({args.teacher}) on {device}")

    # ---- 1. prompts: the template generator gives natural, in-domain phrasings
    tr, va = build_route_dataset(seed=args.seed, per_tool=max(4, args.n // 400))
    prompts = [e.text for e in tr][:args.n]
    val_prompts = [e.text for e in va][:200]
    val_targets = [e.target for e in va[:200]]

    # ---- 2. labels
    if args.teacher == "oracle":
        labels = [e.target for e in tr][:args.n]
        print(f"  oracle labels: {len(labels)}")
    else:
        print(f"  labelling {len(prompts)} prompts with {args.model} …")
        labels = label_with_hf(prompts, args.model, tools)
        print(f"  teacher labels: {len(labels)}")

    corpus = prompts + labels
    bpe = BPE().fit(corpus, vocab_size=args.vocab, min_pair_freq=2, verbose=True)
    model = Nik1LM(vocab=bpe.vocab_size, d_model=args.d_model, n_layers=args.layers,
                   n_heads=args.heads, d_ff=args.d_ff, max_len=args.max_len).to(device)
    n_params = count_params(model)
    print(f"  student: {n_params:,} parameters ({n_params * args.bits / 8 / 1024:.0f} KB at int{args.bits})")

    opt = torch.optim.AdamW(model.parameters(), lr=args.lr, weight_decay=0.02)
    sched = torch.optim.lr_scheduler.OneCycleLR(opt, max_lr=args.lr, total_steps=args.steps, pct_start=0.05)
    pairs = list(zip(prompts, labels))
    rnd = random.Random(args.seed)
    t0 = time.time()
    model.train()
    for step in range(1, args.steps + 1):
        batch = [pairs[rnd.randrange(len(pairs))] for _ in range(args.batch)]
        x, y = make_batch(batch, bpe, args.max_len, device)
        loss = model.loss(x, y)
        opt.zero_grad(set_to_none=True)
        loss.backward()
        torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
        opt.step()
        sched.step()
        if step % 250 == 0:
            print(f"    step {step:5d}  loss {loss.item():.4f}  ({time.time() - t0:.0f}s)")

    mask_fn = grammar.route_mask_fn(bpe, list(tools.keys()))
    preds = greedy_batch(model, bpe, val_prompts, args.max_len, device, mask_fn=mask_fn)
    exact = sum(p.strip() == t.strip() for p, t in zip(preds, val_targets)) / len(preds)
    print(f"  final: exact {exact:.3f} on {len(preds)} held-out utterances")

    info = export_torch_lm(model, bpe, "nik1-route-distilled", args.out, bits=args.bits,
                           extra={"prompt_prefix": PROMPT_PREFIX, "grammar": "route-v1", "teacher": args.teacher})
    with open(os.path.join(args.out, "nik1-route-distilled.metrics.json"), "w") as fh:
        json.dump({"task": "route", "trainer": "torch-distill", "teacher": args.teacher,
                   "params": n_params, "pairs": len(pairs), "exact": exact, "steps": args.steps,
                   "seconds": round(time.time() - t0, 1)}, fh, indent=1)
    print(f"  exported {info['path']} ({info['bytes'] / 1024:.1f} KB)")


if __name__ == "__main__":
    main()
