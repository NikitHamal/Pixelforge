#!/usr/bin/env python3
"""End-to-end evaluation of the exported Nik1 models.

Three things are checked against the *quantized artifacts* (not the fp32
training objects), because those are what ships:

1. **Quantisation delta** — int8 weights must not move the metric materially.
2. **Pipeline reliability** — the router + repair + validate + fallback chain
   must return a schema-valid call on every single validation example.
3. **JS parity fixtures** — a small set of inputs with the expected numbers, so
   the browser runtime can be diffed against this reference implementation.

    python3 nik1/python/eval_pipeline.py [--bits 4] [--fixtures-only]
"""
from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import time

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

from nik1 import grammar, ops, train  # noqa: E402
from nik1.data import DATA, build_palette_dataset, build_retrieval_dataset, build_route_dataset, load, template_docs  # noqa: E402
from nik1.export import CKPT_DIR, load_into, MODELS_DIR  # noqa: E402
from nik1.model import Nik1Encoder, Nik1LM, Nik1MLP  # noqa: E402
from nik1.quantize import model_bytes, read_nik1, size_report  # noqa: E402
from nik1.tokenizer import BPE  # noqa: E402

PROMPT_PREFIX = "task: route\n"

# How many router examples the report keeps. The committed eval.json is a
# summary, not an archive: a run should reproduce its shape, not bury it under
# every per-utterance record. --examples 0 or a big N changes that deliberately.
EXAMPLES = 5


def load_lm(name="nik1-route"):
    cfg = json.load(open(os.path.join(MODELS_DIR, f"{name}.json")))
    bpe = BPE(cfg["tokenizer"]["merges"], cfg["tokenizer"]["vocab"], cfg["tokenizer"]["lowercase"])
    model = Nik1LM(**cfg["cfg"])
    manifest, tensors = read_nik1(model_bytes(MODELS_DIR, name))
    load_into(model, tensors)
    return model, bpe, cfg, manifest


def load_encoder(name="nik1-search"):
    cfg = json.load(open(os.path.join(MODELS_DIR, f"{name}.json")))
    bpe = BPE(cfg["tokenizer"]["merges"], cfg["tokenizer"]["vocab"], cfg["tokenizer"]["lowercase"])
    model = Nik1Encoder(**cfg["cfg"])
    manifest, tensors = read_nik1(model_bytes(MODELS_DIR, name))
    load_into(model, tensors)
    doc_emb = np.fromfile(os.path.join(MODELS_DIR, f"{name}.docs.f32"), dtype="<f4").reshape(-1, cfg["embed_dim"])
    return model, bpe, cfg, doc_emb


def load_mlp(name="nik1-palette"):
    cfg = json.load(open(os.path.join(MODELS_DIR, f"{name}.json")))
    model = Nik1MLP(cfg["cfg"]["n_in"], tuple(cfg["cfg"]["hidden"]), cfg["cfg"]["n_out"])
    manifest, tensors = read_nik1(model_bytes(MODELS_DIR, name))
    load_into(model, tensors)
    return model, cfg


# --------------------------------------------------------------------------


def eval_router(verbose=True):
    model, bpe, cfg, manifest = load_lm()
    _, val = build_route_dataset(seed=5, per_tool=260)
    tools = grammar.load_tool_index()
    pairs = [(PROMPT_PREFIX + e.text, e.target, e) for e in val]
    metrics = json.load(open(os.path.join(MODELS_DIR, "nik1-route.metrics.json")))
    fp32 = metrics["eval"]

    n = min(300, len(pairs))
    rows = []
    t0 = time.time()
    for prompt, target, ex in pairs[:n]:
        mask_fn = grammar.route_mask_fn(bpe, list(tools.keys()))
        raw, _ = train.greedy(model, bpe, prompt, max_new=96, mask_fn=mask_fn)
        res = grammar.route(ex.text, lambda _p, raw=raw: raw, tools=tools)
        want = json.loads(target)
        rows.append({"utt": ex.text, "want": want, "got": res["call"], "source": res["source"],
                     "valid": res["call"] is not None and grammar.validate_call(res["call"], tools)[0],
                     "exact": res["call"] == want})
    secs = time.time() - t0
    valid = sum(r["valid"] for r in rows) / len(rows)
    exact = sum(r["exact"] for r in rows) / len(rows)
    model_only = sum(r["source"] == "model" for r in rows) / len(rows)
    repaired = sum(r["source"] == "model+repair" for r in rows) / len(rows)
    fallback = sum(r["source"].startswith("fallback") for r in rows) / len(rows)
    if verbose:
        print(f"  router  int8 artifacts: exact-call {exact:.3f}  valid-call {valid:.3f}  "
              f"(fp32 free-run was {fp32['exact_call_accuracy']:.3f})")
        print(f"          source mix: model {model_only:.3f}  model+repair {repaired:.3f}  fallback {fallback:.3f}")
        print(f"          {secs / len(rows) * 1000:.1f} ms/utterance on this CPU (Python, unoptimised)")
    return {"exact_call": exact, "valid_call": valid, "model_only": model_only,
            "repaired": repaired, "fallback": fallback, "n": len(rows), "ms_per": secs / len(rows) * 1000,
            "examples": rows[:EXAMPLES]}


def eval_search(verbose=True):
    model, bpe, cfg, doc_emb = load_encoder()
    tr, va, train_ids, val_ids, by_id = build_retrieval_dataset(seed=17, per_template=24)
    docs = template_docs(list(by_id.values()))
    doc_ids = sorted(by_id.keys())
    id_to_row = {d: i for i, d in enumerate(doc_ids)}
    accept = {}
    for t in load("templates.json"):
        tags = set(t["tags"])
        accept[t["id"]] = {u["id"] for u in load("templates.json")
                           if u["id"] == t["id"] or (tags & set(u["tags"])) or u["category"] == t["category"]}
    q_tok = np.array([train.pad_ids(bpe.encode(q), 64) for q, _ in va], dtype=np.int64)
    t0 = time.time()
    qemb, _ = model.forward(q_tok)
    secs = time.time() - t0
    sim = qemb @ doc_emb.T
    order = np.argsort(-sim, axis=1)
    row_to_id = {i: d for d, i in id_to_row.items()}
    a1 = a5 = e1 = 0
    for i, (_, d) in enumerate(va):
        ok = {id_to_row[a] for a in accept[d] if a in id_to_row}
        a1 += order[i][0] in ok
        a5 += bool(ok & set(order[i][:5].tolist()))
        e1 += order[i][0] == id_to_row[d]
    n = len(va)
    metrics = json.load(open(os.path.join(MODELS_DIR, "nik1-search.metrics.json")))
    if verbose:
        print(f"  search  int8 artifacts: any@1 {a1 / n:.3f} (fp32 {metrics['eval']['any@1']:.3f})  "
              f"any@5 {a5 / n:.3f} (fp32 {metrics['eval']['any@5']:.3f})  exact r@1 {e1 / n:.3f}")
        print(f"          query encode {secs / n * 1000:.2f} ms/query (Python), doc table {doc_emb.shape[0]}x{doc_emb.shape[1]} precomputed")
    return {"any@1": a1 / n, "any@5": a5 / n, "exact@1": e1 / n, "n": n,
            "fp32": {"any@1": metrics["eval"]["any@1"], "any@5": metrics["eval"]["any@5"]},
            "ms_per_query": secs / n * 1000}


def eval_palette(verbose=True):
    model, cfg = load_mlp()
    tr, va, labels = build_palette_dataset(seed=3)
    X = np.array([x for x, _ in va], dtype=np.float32)
    Y = np.array([y for _, y in va], dtype=np.int64)
    t0 = time.time()
    logits, _ = model.forward(X)
    secs = time.time() - t0
    acc = ops.accuracy(logits, Y)
    metrics = json.load(open(os.path.join(MODELS_DIR, "nik1-palette.metrics.json")))
    if verbose:
        print(f"  palette int8 artifacts: accuracy {acc:.4f} (fp32 {metrics['val_accuracy']:.4f}, "
              f"majority {metrics['majority_baseline']:.4f})  {secs / len(va) * 1000:.3f} ms/sprite (Python, batched)")
    return {"accuracy": acc, "fp32": metrics["val_accuracy"], "majority": metrics["majority_baseline"],
            "n": len(va), "ms_per_sprite": secs / len(va) * 1000}


# --------------------------------------------------------------------------


def write_fixtures():
    """Parity fixtures for the JS runtime: exact inputs, reference numbers."""
    fx = {"generated_by": "nik1/python/eval_pipeline.py", "tolerance": {"logit_abs": 2e-3, "embed_abs": 2e-3},
          "models": {}}
    model, bpe, cfg, _ = load_lm()
    cases = []
    for text in ["give me the knight", "export a gif", "undo", "set color to #ff0044", "zoom to 8"]:
        ids = [bpe.bos] + bpe.encode("task: route\n" + text)
        x = np.array([ids], dtype=np.int64)
        logits, _ = model.forward(x)
        top = np.argsort(-logits[0, -1])[:5]
        cases.append({"text": text, "ids": ids,
                      "expected_top5": [int(t) for t in top],
                      "expected_logits_top5": [round(float(logits[0, -1, t]), 5) for t in top],
                      "expected_mean_logit": round(float(np.mean(logits[0, -1])), 5)})
    fx["models"]["nik1-route"] = {"cases": cases, "vocab": bpe.vocab_size}

    model, bpe, cfg, doc_emb = load_encoder()
    cases = []
    for text in ["cute farm animal", "dungeon tileset", "space shooter"]:
        ids = train.pad_ids(bpe.encode(text), 64)
        toks = np.array([ids], dtype=np.int64)
        # mask the padding exactly as inference does: the pad row is a learned
        # vector, so pooling it in gives a different embedding
        emb, _ = model.forward(toks, toks != bpe.pad)
        cases.append({"text": text, "ids": ids,
                      "expected_embed": [round(float(v), 5) for v in emb[0][:8]],
                      "expected_norm": round(float(np.linalg.norm(emb[0])), 5)})
    fx["models"]["nik1-search"] = {"cases": cases, "doc_embed_dim": int(doc_emb.shape[1]),
                                   "doc_count": int(doc_emb.shape[0]),
                                   "expected_first_doc_q0": [round(float(v), 5) for v in doc_emb[0][:8]]}

    model, cfg = load_mlp()
    tr, va, labels = build_palette_dataset(seed=3)
    cases = []
    for x, y in va[:5]:
        logits, _ = model.forward(np.array([x], dtype=np.float32))
        cases.append({"features": [round(float(v), 5) for v in x], "expected_label": labels[y],
                      "expected_logits": [round(float(v), 4) for v in logits[0]]})
    fx["models"]["nik1-palette"] = {"cases": cases, "labels": labels}
    path = os.path.join(MODELS_DIR, "parity.json")
    with open(path, "w") as fh:
        json.dump(fx, fh)
    print(f"  fixtures: {path} ({os.path.getsize(path) / 1024:.1f} KB)")
    return fx


# The palettes and style datasets are derived from the source art, not hand-kept,
# so they are generated rather than committed (see .gitignore). Generating them at
# the documented setting is what makes the numbers below reproducible from a fresh
# clone instead of only on the machine where they were first produced.
DATASETS = ["tools.json", "templates.json", "style_apply.json", "style_fit.json"]
EXPORT = os.path.join(HERE, "..", "tools", "export-data.js")


def ensure_datasets(frames=3000, regenerate=False):
    missing = [n for n in DATASETS if not os.path.exists(os.path.join(DATA, n))]
    if not missing and not regenerate:
        return False
    why = "regenerating" if regenerate else f"generating missing {', '.join(missing)}"
    print(f"  {why} via export-data.js --frames {frames} ...")
    subprocess.run(["node", os.path.abspath(EXPORT), "--frames", str(frames)], check=True,
                   stdout=subprocess.DEVNULL)
    still = [n for n in DATASETS if not os.path.exists(os.path.join(DATA, n))]
    if still:
        raise SystemExit(f"export-data.js did not produce {', '.join(still)}")
    return True


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--fixtures-only", action="store_true")
    ap.add_argument("--frames", type=int, default=3000,
                    help="dataset size to generate if nik1/data/ is absent (default 3000)")
    ap.add_argument("--regenerate", action="store_true", help="rebuild the datasets first")
    ap.add_argument("--examples", type=int, default=5, help="router examples to keep in eval.json")
    args = ap.parse_args()
    global EXAMPLES
    EXAMPLES = args.examples
    t0 = time.time()
    ensure_datasets(args.frames, args.regenerate)
    print("nik1 evaluation (quantized artifacts)")
    out = {}
    if not args.fixtures_only:
        out["router"] = eval_router()
        out["search"] = eval_search()
        out["palette"] = eval_palette()
    fixture = write_fixtures()
    out["fixtures"] = {k: len(v.get("cases", [])) for k, v in fixture["models"].items()}
    out["sizes"] = {name: size_report(model_bytes(MODELS_DIR, name), label=f"{name}.nik1")
                    for name in ["nik1-route", "nik1-search", "nik1-palette"]}
    path = os.path.join(MODELS_DIR, "eval.json")
    with open(path, "w") as fh:
        json.dump(out, fh, indent=1)
    print(f"  wrote {path} in {time.time() - t0:.1f}s")


if __name__ == "__main__":
    main()
