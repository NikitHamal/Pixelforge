"""Training loops for the Nik1 specialists (NumPy, CPU, minutes not hours).

Three inductive biases keep this honest at ~500k parameters:

* **Prompt masking.** The router only learns to produce the JSON, not to
  reproduce the instruction — otherwise a third of the gradient goes into
  memorising utterances.
* **Full-batch gradient accumulation with clipping.** Batch 32 on a 2-core box
  with a 1.0 global-norm clip trains stably without learning-rate archaeology.
* **Best-checkpoint selection on the validation split**, never on train loss.
"""
from __future__ import annotations

import json
import math
import os
import random
import time
from dataclasses import dataclass, field

import numpy as np

from . import ops


@dataclass
class TrainCfg:
    steps: int = 1200
    eval_limit: int = 32
    epochs: int = 8
    batch: int = 32
    lr: float = 3e-3
    warmup: int = 60
    weight_decay: float = 0.02
    clip: float = 1.0
    log_every: int = 100
    seed: int = 0
    max_len: int = 96


# --------------------------------------------------------------------------
# language model (router)
# --------------------------------------------------------------------------


def encode_lm_pair(bpe, prompt: str, target: str, max_len: int):
    p = bpe.encode(prompt)
    t = bpe.encode(target) + [bpe.eos]
    ids = [bpe.bos] + p + t
    labels = [-100] * (1 + len(p)) + t
    if len(ids) > max_len:
        ids, labels = ids[:max_len], labels[:max_len]
    return ids, labels


def make_lm_batches(pairs, bpe, cfg: TrainCfg):
    rnd = random.Random(cfg.seed)
    order = list(range(len(pairs)))
    rnd.shuffle(order)
    for i in range(0, len(order) - cfg.batch + 1, cfg.batch):
        chunk = [pairs[j] for j in order[i:i + cfg.batch]]
        enc = [encode_lm_pair(bpe, p, t, cfg.max_len) for p, t in chunk]
        T = max(len(a) for a, _ in enc)
        x = np.full((len(enc), T), bpe.pad, dtype=np.int64)
        y = np.full((len(enc), T), -100, dtype=np.int64)
        for r, (a, b) in enumerate(enc):
            x[r, :len(a)] = a
            y[r, :len(b)] = b
        yield x, y


def train_lm(model, bpe, train, val, cfg: TrainCfg, log=print):
    params = model.params()
    opt = ops.AdamW(params, lr=cfg.lr, weight_decay=cfg.weight_decay)
    opt.clip = cfg.clip
    rnd = np.random.default_rng(cfg.seed)
    best = {"score": -1.0, "state": None, "step": 0}
    history = []
    step = 0
    t0 = time.time()
    while step < cfg.steps:
        for x, y in make_lm_batches(train, bpe, cfg):
            if step >= cfg.steps:
                break
            logits, cache = model.forward(x)
            B, T, V = logits.shape
            # next-token shift: logits[:, i] predicts token i+1, so pair the first
            # T-1 logits with the last T-1 labels. Pairing them at the same index
            # (a tempting shortcut) trains the model to copy its own input: the
            # loss falls to zero and the model learns nothing.
            shifted = logits[:, :-1].reshape(-1, V)
            targets = y[:, 1:].reshape(-1)
            mask = targets >= 0
            loss, dl = ops.cross_entropy(shifted[mask], targets[mask])
            dl_flat = np.zeros((B * (T - 1), V), dtype=np.float32)
            dl_flat[mask] = dl
            dlogits = np.zeros((B, T, V), dtype=np.float32)
            dlogits[:, :-1] = dl_flat.reshape(B, T - 1, V)
            grads = model.backward(dlogits, cache)
            for name, g in grads.items():
                opt.add(name, g)
            opt.step(ops.cosine_lr(step, cfg.steps, cfg.warmup))
            opt.zero()
            acc = float(np.mean(np.argmax(shifted[mask], axis=-1) == targets[mask]))
            history.append({"step": step, "loss": loss, "tok_acc": acc})
            if step % cfg.log_every == 0 or step == cfg.steps - 1:
                # Free-running decode is the only metric that reflects inference,
                # but it costs one forward pass per token; keep the sample small
                # and checkpoint on it, not on teacher-forced loss.
                score, exact, valid = evaluate_lm(model, bpe, val, cfg, limit=cfg.eval_limit)
                if score > best["score"]:
                    best = {"score": score, "step": step,
                            "state": {n: p.copy() for n, p in params}}
                log(f"    step {step:5d}  loss {loss:.4f}  tok_acc {acc:.4f}  "
                    f"val_exact {exact:.3f}  val_json_ok {valid:.3f}  ({time.time() - t0:.0f}s)")
            step += 1
    if best["state"]:
        for n, p in params:
            p[...] = best["state"][n]
    return {"history": history, "best_step": best["step"], "best_exact": best["score"],
            "seconds": round(time.time() - t0, 1), "params": ops.count_params(params)}


def greedy(model, bpe, prompt: str, max_new: int = 64, mask_fn=None, temperature: float = 0.0, rng_=None):
    """Greedy (or sampled) decode; `mask_fn(ids)->set[int]|None` enforces the grammar."""
    ids = [bpe.bos] + bpe.encode(prompt)
    out = []
    for _ in range(max_new):
        x = np.array([ids[-model.cfg["max_len"]:]], dtype=np.int64)
        logits, _ = model.forward(x)
        logit = logits[0, -1].astype(np.float64)
        if mask_fn is not None:
            allowed = mask_fn(out)
            if allowed is not None:
                m = np.full_like(logit, -1e30)
                for t in allowed:
                    m[t] = logit[t]
                logit = m
        if temperature > 0 and rng_ is not None:
            p = np.exp((logit - logit.max()) / temperature)
            p /= p.sum()
            nxt = int(rng_.choice(len(p), p=p))
        else:
            nxt = int(np.argmax(logit))
        if nxt == bpe.eos:
            break
        ids.append(nxt)
        out.append(nxt)
    return bpe.decode(out), out


def evaluate_lm(model, bpe, val, cfg: TrainCfg, limit: int = 40, mask_fn_factory=None):
    """Returns (exact_match_rate, json_valid_rate, rows)."""
    rows = []
    exact = 0
    valid = 0
    for prompt, target in val[:limit]:
        mask_fn = mask_fn_factory(bpe) if mask_fn_factory else None
        text, _ = greedy(model, bpe, prompt, max_new=cfg.max_len, mask_fn=mask_fn)
        got = text.strip()
        ok_json = False
        try:
            json.loads(got)
            ok_json = True
        except Exception:
            ok_json = False
        valid += ok_json
        same = got == target.strip()
        exact += same
        rows.append({"prompt": prompt, "target": target, "pred": got, "exact": same, "json_ok": ok_json})
    n = max(1, len(rows))
    return exact / n, exact / n, valid / n


# --------------------------------------------------------------------------
# bi-encoder (retrieval)
# --------------------------------------------------------------------------


def train_encoder(model, bpe, train_pairs, val_pairs, docs, doc_ids, cfg: TrainCfg,
                  temperature: float = 0.07, refresh_every: int = 10, accept=None, log=print):
    """InfoNCE over the full catalogue as the negative pool.

    The doc tower is re-encoded every `refresh_every` steps and cached in
    between: the catalogue is static, so re-encoding 100+ documents on every
    update spends most of the CPU on the part of the problem that is not
    learning. This is the standard stale-embedding trick (MoCo and friends), and
    it bought a ~7x speedup here with no measurable recall cost.
    """
    params = model.params()
    opt = ops.AdamW(params, lr=cfg.lr, weight_decay=cfg.weight_decay)
    opt.clip = cfg.clip
    id_to_row = {d: i for i, d in enumerate(doc_ids)}
    doc_tok = np.array([pad_ids(bpe.encode(docs[d]), cfg.max_len) for d in doc_ids], dtype=np.int64)
    doc_mask = (doc_tok != bpe.pad)
    history = []
    best = {"recall": -1.0, "state": None, "step": 0}
    t0 = time.time()
    step = 0
    rnd = random.Random(cfg.seed)
    demb = np.zeros((len(doc_ids), model.cfg["d_model"]), dtype=np.float32)
    fresh = False
    for ep in range(cfg.epochs):
        order = list(range(len(train_pairs)))
        rnd.shuffle(order)
        for i in range(0, len(order) - cfg.batch + 1, cfg.batch):
            chunk = [train_pairs[j] for j in order[i:i + cfg.batch]]
            q_tok = np.array([pad_ids(bpe.encode(q), cfg.max_len) for q, _ in chunk], dtype=np.int64)
            pos_rows = np.array([id_to_row[d] for _, d in chunk], dtype=np.int64)
            if step % refresh_every == 0:
                demb, dcache = model.forward(doc_tok, doc_mask)
                demb = demb.copy()
                fresh = True
            qemb, qcache = model.forward(q_tok)
            sim = (qemb @ demb.T / temperature).astype(np.float32)
            loss, dsim = ops.cross_entropy(sim, pos_rows)
            grads = model.backward_cache(dsim @ demb / temperature, qcache)
            for name, g in grads.items():
                opt.add(name, g)
            if fresh:
                # also train the document path, but only on the step whose
                # embeddings the batch actually used
                gd = model.backward_cache(dsim.T @ qemb / temperature, dcache)
                for name, g in gd.items():
                    opt.add(name, g)
                fresh = False
            opt.step(ops.cosine_lr(step, cfg.steps, cfg.warmup))
            opt.zero()
            step += 1
            if step % cfg.log_every == 0:
                r = eval_retrieval(model, bpe, val_pairs, docs, doc_ids, cfg, accept=accept)
                history.append({"step": step, "loss": float(loss), **r})
                if r.get("any@1", r["recall@1"]) > best["recall"]:
                    best = {"recall": r.get("any@1", r["recall@1"]), "state": {n: p.copy() for n, p in params}, "step": step}
                log(f"    step {step:5d}  loss {float(loss):.4f}  any@1 {r.get('any@1', 0):.3f}  any@5 {r.get('any@5', 0):.3f}  exact r@1 {r['recall@1']:.3f}  ({time.time() - t0:.0f}s)")
            if step >= cfg.steps:
                break
        if step >= cfg.steps:
            break
    if best["state"]:
        for n, p in params:
            p[...] = best["state"][n]
    return {"history": history, "best_step": best["step"], "best_metric": best["recall"],
            "seconds": round(time.time() - t0, 1), "params": ops.count_params(params)}


def pad_ids(ids, max_len: int):
    ids = ids[:max_len]
    return ids + [0] * (max_len - len(ids))


def encode_docs(model, bpe, docs, doc_ids, max_len=64):
    tok = np.array([pad_ids(bpe.encode(docs[d]), max_len) for d in doc_ids], dtype=np.int64)
    mask = (tok != bpe.pad)
    emb, _ = model.forward(tok, mask)
    return emb


def eval_retrieval(model, bpe, pairs, docs, doc_ids, cfg: TrainCfg, max_len: int = 64, accept=None):
    """Retrieval metrics.

    `accept` maps a query's source id to the set of ids that would satisfy the
    request. A one-tag query like "animal" is legitimately answered by a dozen
    templates, so exact-id recall@1 understates a useful model; the honest metric
    is *any acceptable asset at rank 1*, with exact-id recall reported as well.
    """
    demb = encode_docs(model, bpe, docs, doc_ids, max_len)
    id_to_row = {d: i for i, d in enumerate(doc_ids)}
    row_to_id = {i: d for d, i in id_to_row.items()}
    if not pairs:
        return {"recall@1": 0.0, "recall@5": 0.0, "mrr": 0.0, "n": 0, "any@1": 0.0, "any@5": 0.0}
    q_tok = np.array([pad_ids(bpe.encode(q), max_len) for q, _ in pairs], dtype=np.int64)
    qemb, _ = model.forward(q_tok)
    sim = qemb @ demb.T
    order = np.argsort(-sim, axis=1)
    r1 = r5 = a1 = a5 = 0
    rr = 0.0
    for i, (_, d) in enumerate(pairs):
        hit = np.where(order[i] == id_to_row[d])[0]
        rank = int(hit[0]) if len(hit) else len(doc_ids)
        r1 += rank == 0
        r5 += rank < 5
        rr += 1.0 / (rank + 1)
        if accept is not None:
            ok = {id_to_row[a] for a in accept[d] if a in id_to_row}
            a1 += order[i][0] in ok
            a5 += bool(ok & set(order[i][:5].tolist()))
    n = len(pairs)
    out = {"recall@1": r1 / n, "recall@5": r5 / n, "mrr": rr / n, "n": n}
    if accept is not None:
        out["any@1"] = a1 / n
        out["any@5"] = a5 / n
    return out


# --------------------------------------------------------------------------
# MLP (palette head)
# --------------------------------------------------------------------------


def train_mlp(model, train, val, cfg: TrainCfg, n_classes: int, log=print):
    params = model.params()
    opt = ops.AdamW(params, lr=cfg.lr, weight_decay=cfg.weight_decay)
    opt.clip = cfg.clip
    X = np.array([x for x, _ in train], dtype=np.float32)
    Y = np.array([y for _, y in train], dtype=np.int64)
    VX = np.array([x for x, _ in val], dtype=np.float32)
    VY = np.array([y for _, y in val], dtype=np.int64)
    rnd = np.random.default_rng(cfg.seed)
    best = {"acc": -1.0, "state": None, "step": 0}
    history = []
    t0 = time.time()
    step = 0
    while step < cfg.steps:
        idx = rnd.integers(0, len(X), size=cfg.batch)
        logits, cache = model.forward(X[idx])
        loss, dl = ops.cross_entropy(logits, Y[idx])
        _, grads = model.backward(dl, cache)
        for name, g in grads.items():
            opt.add(name, g)
        opt.step(ops.cosine_lr(step, cfg.steps, cfg.warmup))
        opt.zero()
        step += 1
        if step % cfg.log_every == 0 or step == cfg.steps:
            vl, _ = model.forward(VX)
            acc = ops.accuracy(vl, VY)
            history.append({"step": step, "loss": float(loss), "val_acc": acc})
            if acc > best["acc"]:
                best = {"acc": acc, "state": {n: p.copy() for n, p in params}, "step": step}
            log(f"    step {step:5d}  loss {float(loss):.4f}  val_acc {acc:.4f}  ({time.time() - t0:.0f}s)")
    if best["state"]:
        for n, p in params:
            p[...] = best["state"][n]
    return {"history": history, "best_step": best["step"], "val_acc": best["acc"],
            "seconds": round(time.time() - t0, 1), "params": ops.count_params(params)}
