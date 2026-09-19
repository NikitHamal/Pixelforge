"""Export trained Nik1 models to the on-device format.

One `.nik1` binary (quantized weights) plus one `.json` (config + tokenizer +
label sets). Both are plain files a static server can hand out and a browser can
cache forever, and both are written by the same code path the tests read back.
"""
from __future__ import annotations

import json
import os

import numpy as np

from .quantize import size_report, write_nik1

MODELS_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "js", "models")
CKPT_DIR = os.path.join(os.path.dirname(__file__), "..", "checkpoints")


def save_checkpoint(model, bpe, name: str, extra: dict | None = None):
    """fp32 weights + tokenizer, so int4/int8 variants are an export flag, not a
    retrain. Checkpoints are build artefacts (gitignored); the exports are not."""
    import numpy as np
    os.makedirs(CKPT_DIR, exist_ok=True)
    path = os.path.join(CKPT_DIR, f"{name}.fp32.npz")
    np.savez(path, **{n: p for n, p in model.params()})
    torch_free = {"cfg": getattr(model, "cfg", {}),
                  "tokenizer": {"vocab": bpe.vocab, "merges": [[a, b] for a, b in bpe.merges], "lowercase": bpe.lowercase} if bpe else None,
                  **(extra or {})}
    with open(os.path.join(CKPT_DIR, f"{name}.json"), "w") as fh:
        json.dump(torch_free, fh)
    return path


def load_into(model, tensors):
    for n, p in model.params():
        if n in tensors:
            p[...] = tensors[n]
    return model


def _mkdir():
    os.makedirs(MODELS_DIR, exist_ok=True)
    return MODELS_DIR


def export_lm(model, bpe, name: str, bits: int = 8, extra: dict | None = None, metrics: dict | None = None):
    d = _mkdir()
    tensors = {n: p for n, p in model.params()}
    meta = dict(**model.cfg, name=name, kind="lm")
    info = write_nik1(os.path.join(d, f"{name}.nik1"), tensors, {k: v for k, v in meta.items() if k != "name"}, bits=bits)
    cfg = {"name": name, "kind": "lm", "cfg": model.cfg,
           "tokenizer": {"vocab": bpe.vocab, "merges": [[a, b] for a, b in bpe.merges], "lowercase": bpe.lowercase},
           "specials": {"pad": bpe.pad, "bos": bpe.bos, "eos": bpe.eos, "unk": bpe.unk},
           "quant": {"bits": bits}, **(extra or {})}
    with open(os.path.join(d, f"{name}.json"), "w") as fh:
        json.dump(cfg, fh)
    if metrics:
        with open(os.path.join(d, f"{name}.metrics.json"), "w") as fh:
            json.dump(metrics, fh, indent=1)
    rep = size_report(os.path.join(d, f"{name}.nik1"))
    rep["params"] = int(sum(p.size for p in tensors.values()))
    rep["config"] = os.path.getsize(os.path.join(d, f"{name}.json"))
    return rep


def export_encoder(model, bpe, name: str, doc_ids, docs, doc_emb: np.ndarray,
                   bits: int = 8, metrics: dict | None = None):
    d = _mkdir()
    tensors = {n: p for n, p in model.params()}
    info = write_nik1(os.path.join(d, f"{name}.nik1"), tensors, model.cfg, bits=bits)
    cfg = {"name": name, "kind": "encoder", "cfg": model.cfg,
           "tokenizer": {"vocab": bpe.vocab, "merges": [[a, b] for a, b in bpe.merges], "lowercase": bpe.lowercase},
           "specials": {"pad": bpe.pad, "bos": bpe.bos, "eos": bpe.eos, "unk": bpe.unk},
           "quant": {"bits": bits}, "embed_dim": int(doc_emb.shape[1]),
           "docs": [{"id": i, "text": docs[i]} for i in doc_ids]}
    with open(os.path.join(d, f"{name}.json"), "w") as fh:
        json.dump(cfg, fh)
    # Precomputed document table: the catalogue is static, so retrieval costs one
    # query encode plus a dot product, with no document pass at runtime.
    doc_emb.astype("<f4").tofile(os.path.join(d, f"{name}.docs.f32"))
    if metrics:
        with open(os.path.join(d, f"{name}.metrics.json"), "w") as fh:
            json.dump(metrics, fh, indent=1)
    rep = size_report(os.path.join(d, f"{name}.nik1"))
    rep["params"] = int(sum(p.size for p in tensors.values()))
    rep["docs_bytes"] = int(doc_emb.nbytes)
    rep["config"] = os.path.getsize(os.path.join(d, f"{name}.json"))
    return rep


def export_mlp(model, name: str, feature_spec: dict, labels: list[str], bits: int = 8, metrics: dict | None = None):
    d = _mkdir()
    tensors = {n: p for n, p in model.params()}
    info = write_nik1(os.path.join(d, f"{name}.nik1"), tensors, model.cfg, bits=bits)
    cfg = {"name": name, "kind": "mlp", "cfg": model.cfg, "quant": {"bits": bits},
           "features": feature_spec, "labels": labels}
    with open(os.path.join(d, f"{name}.json"), "w") as fh:
        json.dump(cfg, fh)
    if metrics:
        with open(os.path.join(d, f"{name}.metrics.json"), "w") as fh:
            json.dump(metrics, fh, indent=1)
    rep = size_report(os.path.join(d, f"{name}.nik1"))
    rep["params"] = int(sum(p.size for p in tensors.values()))
    rep["config"] = os.path.getsize(os.path.join(d, f"{name}.json"))
    return rep


FEATURE_SPEC = {
    "version": 1,
    "dims": 41,
    "layout": [
        {"name": "opaque_fraction", "len": 1},
        {"name": "luma_hist", "len": 16, "range": [0, 1]},
        {"name": "saturation_hist", "len": 8, "range": [0, 1]},
        {"name": "hue_hist", "len": 12, "range": [0, 1]},
        {"name": "mean_luma", "len": 1},
        {"name": "std_luma", "len": 1},
        {"name": "distinct_colors_over_64", "len": 1},
        {"name": "mean_saturation", "len": 1},
    ],
    "note": "computed identically in nik1/tools/export-data.js and nik1/js/nik1.js",
}
