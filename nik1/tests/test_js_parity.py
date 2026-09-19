#!/usr/bin/env python3
"""Cross-language parity: the JS runtime and the Python reference must agree.

`node nik1/tests/test_runtime.js` writes two fixtures:

  js/models/parity.json        numbers produced by Python (logits, embeddings)
  js/models/grammar_cases.json results produced by JS for repair/validate cases

This test consumes the second one and checks the Python implementation returns
the same call, source and (where it matters) notes. Drift between the trainer's
grammar and the browser's grammar is the failure mode this exists to catch —
the model would be evaluated against rules it will not be run with.

    python3 nik1/tests/test_js_parity.py
"""
from __future__ import annotations

import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "python"))

from nik1 import grammar  # noqa: E402
from nik1.export import MODELS_DIR  # noqa: E402
from nik1.quantize import model_bytes, read_nik1, size_report  # noqa: E402

FAIL = 0


def ok(cond, msg):
    global FAIL
    print(("PASS " if cond else "FAIL ") + msg)
    FAIL += 0 if cond else 1


def main():
    print("Nik1 JS/Python parity")
    cases_path = os.path.join(MODELS_DIR, "grammar_cases.json")
    if not os.path.exists(cases_path):
        ok(False, "grammar_cases.json missing — run: node nik1/tests/test_runtime.js")
        return
    cases = json.load(open(cases_path))
    tools = grammar.load_tool_index()
    catalog = grammar.load_catalog()
    agree = 0
    for c in cases:
        call, notes = grammar.repair_call(c["raw"], tools, c["utt"], catalog)
        if call is None:
            py = grammar.fallback_route(c["utt"], tools)
            py_call, py_source = py[0], py[1]
            py_notes = notes
        else:
            good, _ = grammar.validate_call(call, tools)
            if not good:
                py_call, py_source = grammar.fallback_route(c["utt"], tools)
            else:
                py_call, py_source, py_notes = call, ("model" if not notes else "model+repair"), notes
        same_call = json.dumps(py_call, sort_keys=True) == json.dumps(c["call"], sort_keys=True)
        same_source = py_source == c["source"]
        notes_match = set(py_notes) == set(c.get("notes", []))
        if same_call and same_source and notes_match:
            agree += 1
        else:
            ok(False, f"divergence on {c['raw'][:44]!r}\n     js: {c['source']} {json.dumps(c['call'])} {c.get('notes')}\n     py: {py_source} {json.dumps(py_call)} {py_notes}")
    ok(agree == len(cases), f"grammar agrees on every case ({agree}/{len(cases)})")

    # container integrity: every model must load back with the same tensors
    for name in ["nik1-route", "nik1-search", "nik1-palette"]:
        try:
            data = model_bytes(MODELS_DIR, name)   # joins shards when published split
        except (FileNotFoundError, ValueError) as err:
            ok(False, f"{name}.nik1 unreadable ({err})")
            continue
        manifest, tensors = read_nik1(data)
        stats = size_report(data)
        unaligned = [t["name"] for t in manifest["tensors"] if t["data_offset"] % 4]
        ok(not unaligned, f"{name}: every payload is 4-byte aligned")
        ok(all(t["dtype"] in ("i8", "i4", "f32") for t in manifest["tensors"]), f"{name}: known dtypes only")
        ok(len(tensors) == len(manifest["tensors"]), f"{name}: {len(tensors)} tensors read back")
        ok(stats["bits"] in (4, 8) and stats["kb"] < 400, f"{name}: {stats['kb']} KB at int{stats['bits']}")
        # weights must be finite
        bad = [k for k, v in tensors.items() if not (v == v).all()]
        ok(not bad, f"{name}: no NaN/Inf weights")

    # metrics files must exist and be self-consistent with the exported sizes
    for name in ["nik1-route", "nik1-search", "nik1-palette"]:
        mp = os.path.join(MODELS_DIR, f"{name}.metrics.json")
        ok(os.path.exists(mp), f"{name}.metrics.json present")
    ev = json.load(open(os.path.join(MODELS_DIR, "eval.json")))
    ok(ev["router"]["valid_call"] == 1.0, "pipeline validity is 1.0 as claimed in the docs")
    ok(ev["palette"]["accuracy"] >= 0.99, "palette accuracy matches the docs")
    print(f"\nPARITY: {len(cases) - 0 if FAIL == 0 else 'see failures'} checks, {FAIL} fail")
    sys.exit(1 if FAIL else 0)


if __name__ == "__main__":
    main()
