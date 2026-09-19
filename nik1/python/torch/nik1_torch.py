"""Nik1 in PyTorch — the same architecture, for GPU training and distillation.

The NumPy implementation in `nik1/model.py` is what runs on a laptop and what the
gradient tests verify. This file exists so the *same* architecture can be scaled
on a free Kaggle GPU (T4/P100) and exported back into the identical `.nik1`
container, which is what makes the pipeline honest:

    train (torch, GPU)  ->  export (.nik1)  ->  run (JS, on device)

Nothing about the runtime changes because a bigger model was trained.

    pip install torch      # Kaggle images already have it
    python3 nik1/python/torch/train_router_torch.py --d-model 256 --layers 6
"""
from __future__ import annotations

import json
import math
import os
import sys

import torch
import torch.nn as nn
import torch.nn.functional as F

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from nik1.quantize import write_nik1  # noqa: E402

GELU_C = 0.7978845608028654


class RMSNorm(nn.Module):
    def __init__(self, d: int, eps: float = 1e-6):
        super().__init__()
        self.w = nn.Parameter(torch.ones(d))
        self.eps = eps

    def forward(self, x):
        return x * torch.rsqrt(x.pow(2).mean(-1, keepdim=True) + self.eps) * self.w


def rope_tables(head_dim: int, max_len: int, device):
    half = head_dim // 2
    inv = 1.0 / (10000 ** (torch.arange(0, half, device=device, dtype=torch.float32) / half))
    t = torch.arange(max_len, device=device, dtype=torch.float32)
    ang = torch.outer(t, inv)
    return torch.cos(ang), torch.sin(ang)


def apply_rope(x, cos, sin, inverse=False):
    """x: (B, H, T, D). Adjacent pairs, matching the NumPy/JS implementations."""
    x0, x1 = x[..., 0::2], x[..., 1::2]
    c = cos[None, None, :, :]
    s = sin[None, None, :, :]
    if inverse:
        s = -s
    out = torch.empty_like(x)
    out[..., 0::2] = x0 * c - x1 * s
    out[..., 1::2] = x0 * s + x1 * c
    return out


class Block(nn.Module):
    def __init__(self, d_model, n_heads, d_ff, max_len, causal):
        super().__init__()
        assert d_model % n_heads == 0
        self.d, self.h, self.hd = d_model, n_heads, d_model // n_heads
        self.causal = causal
        self.n1, self.n2 = RMSNorm(d_model), RMSNorm(d_model)
        self.qkv = nn.Linear(d_model, 3 * d_model)
        self.proj = nn.Linear(d_model, d_model)
        self.fc1 = nn.Linear(d_model, d_ff)
        self.fc2 = nn.Linear(d_ff, d_model)
        self.register_buffer("cos", rope_tables(self.hd, max_len, torch.device("cpu"))[0], persistent=False)
        self.register_buffer("sin", rope_tables(self.hd, max_len, torch.device("cpu"))[1], persistent=False)

    def forward(self, x):
        B, T, D = x.shape
        h = self.n1(x)
        qkv = self.qkv(h).reshape(B, T, 3, self.h, self.hd).permute(2, 0, 3, 1, 4)
        q, k, v = qkv[0], qkv[1], qkv[2]
        q, k = apply_rope(q, self.cos, self.sin), apply_rope(k, self.cos, self.sin)
        att = (q @ k.transpose(-1, -2)) / math.sqrt(self.hd)
        if self.causal:
            mask = torch.triu(torch.ones(T, T, device=x.device, dtype=torch.bool), 1)
            att = att.masked_fill(mask, float("-inf"))
        att = att.softmax(-1)
        ctx = (att @ v).transpose(1, 2).reshape(B, T, D)
        x = x + self.proj(ctx)
        x = x + self.fc2(F.gelu(self.fc1(self.n2(x)), approximate="tanh"))
        return x


class Nik1LM(nn.Module):
    def __init__(self, vocab, d_model=96, n_layers=4, n_heads=4, d_ff=256, max_len=128, tie=True):
        super().__init__()
        self.cfg = dict(vocab=vocab, d_model=d_model, n_layers=n_layers, n_heads=n_heads,
                        d_ff=d_ff, max_len=max_len, tie=tie)
        self.tok = nn.Embedding(vocab, d_model)
        self.blocks = nn.ModuleList([Block(d_model, n_heads, d_ff, max_len, True) for _ in range(n_layers)])
        self.norm_f = RMSNorm(d_model)
        self.head = None if tie else nn.Linear(d_model, vocab, bias=False)

    def forward(self, ids):
        x = self.tok(ids)
        for b in self.blocks:
            x = b(x)
        h = self.norm_f(x)
        return h @ self.tok.weight.T if self.cfg["tie"] else self.head(h)

    def loss(self, ids, labels):
        logits = self(ids)
        return F.cross_entropy(logits[:, :-1].reshape(-1, logits.shape[-1]),
                               labels[:, 1:].reshape(-1), ignore_index=-100)


class Nik1Encoder(nn.Module):
    def __init__(self, vocab, d_model=64, n_layers=2, n_heads=4, d_ff=128, max_len=64):
        super().__init__()
        self.cfg = dict(vocab=vocab, d_model=d_model, n_layers=n_layers, n_heads=n_heads, d_ff=d_ff, max_len=max_len)
        self.tok = nn.Embedding(vocab, d_model)
        self.blocks = nn.ModuleList([Block(d_model, n_heads, d_ff, max_len, False) for _ in range(n_layers)])
        self.norm_f = RMSNorm(d_model)

    def forward(self, ids, mask=None):
        h = self.tok(ids)
        for b in self.blocks:
            h = b(h)
        h = self.norm_f(h)
        if mask is None:
            pooled = h.mean(1)
        else:
            m = mask.float().unsqueeze(-1)
            pooled = (h * m).sum(1) / m.sum(1).clamp(min=1e-6)
        return F.normalize(pooled, dim=-1)


# --------------------------------------------------------------------------
# export: torch weights -> the same .nik1 container the JS runtime reads
# --------------------------------------------------------------------------


def state_to_nik1_tensors(state: dict, cfg: dict) -> dict:
    """Translate PyTorch parameter names to the NumPy/JS names."""
    import numpy as np

    out = {}
    out["tok"] = state["tok.weight"].detach().cpu().numpy().astype("float32")
    out["norm_f"] = state["norm_f.w"].detach().cpu().numpy().astype("float32")
    if "head.weight" in state:
        out["head.w"] = state["head.weight"].detach().cpu().numpy().T.astype("float32")
    layers = cfg["n_layers"]
    for i in range(layers):
        p = f"blocks.{i}."
        for src, dst in [("n1.w", "n1"), ("n2.w", "n2"), ("qkv.weight", "att.qkv.w"), ("qkv.bias", "att.qkv.b"),
                         ("proj.weight", "att.proj.w"), ("proj.bias", "att.proj.b"),
                         ("fc1.weight", "fc1.w"), ("fc1.bias", "fc1.b"), ("fc2.weight", "fc2.w"), ("fc2.bias", "fc2.b")]:
            w = state[p + src].detach().cpu().numpy().astype("float32")
            if src.endswith("weight") and w.ndim == 2:
                w = w.T                                  # torch (out, in) -> nik1 (in, out)
            out[f"blocks.{i}.{dst}"] = w
    return out


def export_torch_lm(model: Nik1LM, bpe, name: str, out_dir: str, bits: int = 8, extra: dict | None = None):
    os.makedirs(out_dir, exist_ok=True)
    tensors = state_to_nik1_tensors(model.state_dict(), model.cfg)
    info = write_nik1(os.path.join(out_dir, f"{name}.nik1"), tensors, model.cfg, bits=bits)
    cfg = {"name": name, "kind": "lm", "cfg": model.cfg,
           "tokenizer": {"vocab": bpe.vocab, "merges": [[a, b] for a, b in bpe.merges], "lowercase": bpe.lowercase},
           "specials": {"pad": bpe.pad, "bos": bpe.bos, "eos": bpe.eos, "unk": bpe.unk},
           "quant": {"bits": bits}, **(extra or {})}
    with open(os.path.join(out_dir, f"{name}.json"), "w") as fh:
        json.dump(cfg, fh)
    return info


def export_torch_encoder(model: Nik1Encoder, bpe, name: str, out_dir: str, doc_ids, docs, bits: int = 8):
    import numpy as np

    os.makedirs(out_dir, exist_ok=True)
    state = model.state_dict()
    tensors = {"tok": state["tok.weight"].detach().cpu().numpy().astype("float32"),
               "norm_f": state["norm_f.w"].detach().cpu().numpy().astype("float32")}
    for i in range(model.cfg["n_layers"]):
        p = f"blocks.{i}."
        for src, dst in [("n1.w", "n1"), ("n2.w", "n2"), ("qkv.weight", "att.qkv.w"), ("qkv.bias", "att.qkv.b"),
                         ("proj.weight", "att.proj.w"), ("proj.bias", "att.proj.b"),
                         ("fc1.weight", "fc1.w"), ("fc1.bias", "fc1.b"), ("fc2.weight", "fc2.w"), ("fc2.bias", "fc2.b")]:
            w = state[p + src].detach().cpu().numpy().astype("float32")
            if src.endswith("weight") and w.ndim == 2:
                w = w.T
            tensors[f"blocks.{i}.{dst}"] = w
    info = write_nik1(os.path.join(out_dir, f"{name}.nik1"), tensors, model.cfg, bits=bits)
    cfg = {"name": name, "kind": "encoder", "cfg": model.cfg,
           "tokenizer": {"vocab": bpe.vocab, "merges": [[a, b] for a, b in bpe.merges], "lowercase": bpe.lowercase},
           "specials": {"pad": bpe.pad, "bos": bpe.bos, "eos": bpe.eos, "unk": bpe.unk},
           "quant": {"bits": bits}, "embed_dim": model.cfg["d_model"],
           "docs": [{"id": i, "text": docs[i]} for i in doc_ids]}
    with open(os.path.join(out_dir, f"{name}.json"), "w") as fh:
        json.dump(cfg, fh)
    return info


def count_params(model) -> int:
    return sum(p.numel() for p in model.parameters())
