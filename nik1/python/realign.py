#!/usr/bin/env python3
"""Re-write a `.nik1` file with 4-byte aligned tensor offsets.

The first version of the container packed payloads back to back, so a float32
tensor could start on an odd offset and `new Float32Array(buffer, offset, n)`
refused it. The writer now aligns; this migrates files written before that.

Safe because quantization is idempotent: a code re-quantized from its own
dequantized value reproduces the same code and the same per-row scale.

    python3 nik1/python/realign.py [path ...]      # default: every model
"""
from __future__ import annotations

import os
import sys

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

from nik1.export import MODELS_DIR  # noqa: E402
from nik1.quantize import read_nik1, size_report, write_nik1  # noqa: E402


def realign(path: str):
    manifest, tensors = read_nik1(path)
    before = size_report(path)
    info = write_nik1(path, tensors, manifest.get("config", {}), bits=manifest["bits"], group=manifest.get("group"))
    after = size_report(path)
    unaligned = sum(1 for t in manifest["tensors"] if t["data_offset"] % 4)
    print(f"  {os.path.basename(path):26} {before['bytes']:>8} B -> {after['bytes']:>8} B "
          f"({unaligned} unaligned payloads before)")
    return after


if __name__ == "__main__":
    files = sys.argv[1:] or sorted(
        os.path.join(MODELS_DIR, f) for f in os.listdir(MODELS_DIR) if f.endswith(".nik1"))
    print("realigning nik1 containers")
    for f in files:
        realign(f)
