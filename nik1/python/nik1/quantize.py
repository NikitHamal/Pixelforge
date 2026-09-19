"""Quantization and the `.nik1` weight container.

The container is deliberately boring: a magic, a JSON manifest, then raw
little-endian payloads. A 40-line reader in JavaScript can load it, and so can a
C program or a Lua one. Nothing about the format assumes a framework.

Weights are quantized **per output channel** (symmetric, zero-point fixed at 0)
so the runtime needs one float per row, not one per element. int4 packs two
values per byte, which is what gets a 500k-parameter model down to ~250 KB —
small enough to ship inside a web page and keep resident next to a game.
"""
from __future__ import annotations

import json
import hashlib
import io
import os
import struct
import tempfile

import numpy as np

MAGIC = b"NIK1"
VERSION = 1


def _qmax(bits: int) -> int:
    return (1 << (bits - 1)) - 1


def quantize_symmetric(w: np.ndarray, bits: int = 8, group: int | None = None):
    """Per-row (axis=0) symmetric quantization.

    Returns (codes int16, scales float32). For bits=4, codes are 0..15 with an
    offset of 8 applied on encode and removed on decode.
    """
    w = np.asarray(w, dtype=np.float32)
    if w.ndim == 1:
        w = w[:, None]
        squeeze = True
    else:
        squeeze = False
    qmax = _qmax(bits)
    if group:
        # group-wise: reshape rows into groups for finer scales
        rows, cols = w.shape
        assert cols % group == 0
        g = w.reshape(rows, cols // group, group)
        scale = np.abs(g).max(axis=-1, keepdims=True) / qmax
        scale = np.maximum(scale, 1e-8)
        codes = np.rint(g / scale).astype(np.int16)
        codes = np.clip(codes, -qmax - (1 if bits == 4 else 0), qmax)
        codes = codes.reshape(rows, cols)
        scale = scale.reshape(rows, -1)
    else:
        scale = np.abs(w).max(axis=1, keepdims=True) / qmax
        scale = np.maximum(scale, 1e-8)
        codes = np.rint(w / scale).astype(np.int16)
        codes = np.clip(codes, -qmax - (1 if bits == 4 else 0), qmax)
    if bits == 4:
        codes = codes + 8                      # 0..15, unsigned nibble
    if squeeze:
        codes, scale = codes[:, 0], scale[:, 0]
    return codes, scale.astype(np.float32)


def dequantize(codes: np.ndarray, scales: np.ndarray, bits: int = 8) -> np.ndarray:
    c = codes.astype(np.float32)
    if bits == 4:
        c = c - 8
    if scales.ndim and scales.shape[-1] != c.shape[-1]:
        # group-wise scales: expand back to per-element
        g = c.shape[-1] // scales.shape[-1]
        s = np.repeat(scales, g, axis=-1)
    else:
        s = scales
    if c.ndim == 1:
        return (c * s).astype(np.float32)
    return (c * s).astype(np.float32)


def pack_int4(codes: np.ndarray) -> np.ndarray:
    """Two unsigned nibbles per byte, low nibble first (matches the JS reader)."""
    c = np.asarray(codes, dtype=np.uint8) & 0x0F
    if c.shape[-1] % 2:
        c = np.concatenate([c, np.zeros(c.shape[:-1] + (1,), dtype=np.uint8)], axis=-1)
    return (c[..., 0::2] | (c[..., 1::2] << 4)).astype(np.uint8)


def unpack_int4(packed: np.ndarray, cols: int) -> np.ndarray:
    p = np.asarray(packed, dtype=np.uint8)
    lo = p & 0x0F
    hi = (p >> 4) & 0x0F
    out = np.empty(p.shape[:-1] + (p.shape[-1] * 2,), dtype=np.uint8)
    out[..., 0::2] = lo
    out[..., 1::2] = hi
    return out[..., :cols]


def write_nik1(path: str, tensors: dict[str, np.ndarray], meta: dict, bits: int = 8, group: int | None = None,
               keep_f32: tuple[str, ...] = ("norm_f", "n1", "n2")):
    """Serialize a model. 2-D matrices are quantized; vectors stay fp32.

    Vectors (RMSNorm gains) are 1 kB and quantizing them costs accuracy for no
    size win, so they ship as fp32 on purpose.

    Every payload starts on a 4-byte boundary: a typed-array view (`new
    Float32Array(buffer, offset, n)`) rejects unaligned offsets, and alignment is
    what lets the JS reader hand out views with no copying at all. Three padding
    bytes per tensor is the whole cost.
    """
    manifest = {"format": "nik1", "version": VERSION, "bits": bits, "group": group, "config": meta, "tensors": []}
    payload = bytearray()

    def align():
        while len(payload) % 4:
            payload.append(0)

    for name, arr in tensors.items():
        align()
        a = np.asarray(arr)
        if a.ndim == 2 and name not in keep_f32:
            codes, scales = quantize_symmetric(a, bits=bits, group=group)
            if bits == 4:
                data = pack_int4(codes).tobytes()
                shape = list(a.shape)
            else:
                data = codes.astype(np.int8).tobytes()
                shape = list(a.shape)
            entry = {"name": name, "dtype": f"i{bits}", "shape": shape,
                     "rows": int(a.shape[0]), "cols": int(a.shape[1]),
                     "scale_offset": len(payload), "scale_len": int(scales.size),
                     "scale_shape": list(scales.shape),
                     "data_offset": len(payload) + scales.astype("<f4").nbytes,
                     "data_bytes": len(data)}
            payload += scales.astype("<f4").tobytes()
            payload += data
        else:
            data = a.astype("<f4").tobytes()
            entry = {"name": name, "dtype": "f32", "shape": list(a.shape),
                     "data_offset": len(payload), "data_bytes": len(data)}
            payload += data
        manifest["tensors"].append(entry)
    head = json.dumps(manifest, separators=(",", ":")).encode("utf-8")
    with open(path, "wb") as fh:
        fh.write(struct.pack("<4sII", MAGIC, VERSION, len(head)))
        fh.write(head)
        fh.write(bytes(payload))
    return {"path": path, "bytes": 8 + len(head) + len(payload), "tensors": len(tensors)}


def model_bytes(directory: str, name: str) -> bytes:
    """Return the bytes of `name`.nik1, whether it ships whole or sharded.

    Some publishing APIs cap a single request body at 128 KB, so large weights are
    published as `name.nik1.part-NN` plus a `name.nik1.parts.json` manifest. The
    manifest carries the byte count and sha256 of the whole file, checked here:
    a corrupted or truncated download must fail loudly rather than quietly
    produce a model that computes the wrong answer.
    """
    whole = os.path.join(directory, name + ".nik1")
    if os.path.exists(whole):
        with open(whole, "rb") as fh:
            return fh.read()
    man_path = whole + ".parts.json"
    if not os.path.exists(man_path):
        raise FileNotFoundError(f"{name}.nik1 missing (and no {name}.nik1.parts.json beside it)")
    with open(man_path, "r", encoding="utf-8") as fh:
        manifest = json.load(fh)
    chunks = []
    for part in manifest["parts"]:
        with open(os.path.join(directory, part["name"]), "rb") as fh:
            blob = fh.read()
        if len(blob) != part["bytes"]:
            raise ValueError(f"{part['name']}: {len(blob)} bytes, manifest says {part['bytes']}")
        chunks.append(blob)
    data = b"".join(chunks)
    if len(data) != manifest["bytes"]:
        raise ValueError(f"{name}: assembled {len(data)} bytes, manifest says {manifest['bytes']}")
    got = hashlib.sha256(data).hexdigest()
    if got != manifest["sha256"]:
        raise ValueError(f"{name}: sha256 {got[:12]}... != {manifest['sha256'][:12]}...")
    return data


def model_file(directory: str, name: str) -> str:
    """Path to a readable `.nik1`, materialising shards into a temp file if needed."""
    whole = os.path.join(directory, name + ".nik1")
    if os.path.exists(whole):
        return whole
    data = model_bytes(directory, name)
    tmp = tempfile.NamedTemporaryFile(prefix=name + "-", suffix=".nik1", delete=False)
    tmp.write(data)
    tmp.close()
    return tmp.name


def read_nik1(path):
    if isinstance(path, (bytes, bytearray, memoryview)):
        fh = io.BytesIO(bytes(path))
    else:
        fh = open(path, "rb")
    with fh:
        magic, version, hlen = struct.unpack("<4sII", fh.read(12))
        assert magic == MAGIC, f"not a nik1 file: {magic!r}"
        manifest = json.loads(fh.read(hlen))
        body = fh.read()
    out = {}
    for t in manifest["tensors"]:
        if t["dtype"] == "f32":
            out[t["name"]] = np.frombuffer(body, dtype="<f4", count=t["data_bytes"] // 4,
                                           offset=t["data_offset"]).reshape(t["shape"]).astype(np.float32)
        else:
            bits = int(t["dtype"][1])
            scales = np.frombuffer(body, dtype="<f4", count=t["scale_len"],
                                   offset=t["scale_offset"]).reshape(t["scale_shape"]).astype(np.float32)
            if bits == 4:
                packed = np.frombuffer(body, dtype=np.uint8, count=t["data_bytes"],
                                       offset=t["data_offset"]).reshape(t["rows"], -1)
                codes = unpack_int4(packed, t["cols"])
            else:
                codes = np.frombuffer(body, dtype=np.int8, count=t["data_bytes"],
                                      offset=t["data_offset"]).reshape(t["shape"]).astype(np.int16)
            out[t["name"]] = dequantize(codes, scales, bits)
    return manifest, out


def size_report(path, label: str = None) -> dict:
    if isinstance(path, (bytes, bytearray, memoryview)):
        fh = io.BytesIO(bytes(path))
    else:
        fh = open(path, "rb")
    with fh:
        magic, version, hlen = struct.unpack("<4sII", fh.read(12))
        manifest = json.loads(fh.read(hlen))
        total = 12 + hlen + sum(t["data_bytes"] for t in manifest["tensors"])
    by_tensor = {t["name"]: t["data_bytes"] for t in manifest["tensors"]}
    # Accepts a path or raw bytes (sharded models are joined before parsing), so
    # the echoed source must stay a string — a bytes value here breaks json.dump.
    source = label or (path if isinstance(path, str) else "<memory>")
    return {"path": source, "bytes": total, "kb": round(total / 1024, 1), "bits": manifest["bits"], "tensors": len(by_tensor)}
