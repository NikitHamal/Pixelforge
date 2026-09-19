# Training Nik1

Three trainers, one pipeline. All of them read datasets generated from this
repository and write the same `.nik1` container.

```bash
node nik1/tools/export-data.js --frames 3000    # datasets (1.2 s)
python3 nik1/python/train_palette.py            #  5 s   (5k params)
python3 nik1/python/train_search.py             #  3 min (132k params)
python3 nik1/python/train_router.py             #  4 min (248k params)
python3 nik1/python/eval_pipeline.py            # 13 s   (metrics on int8 artifacts)
```

Everything below runs on a 2 vCPU container with NumPy only. No GPU is required
for the shipped sizes; `torch/` and `kaggle/` exist to scale beyond them.

## 1. Data comes from the registry, not from a scrape

| dataset | built from | size | split |
|---|---|---|---|
| `tools.json` | the live agent tool schemas | 52 tools | — |
| `templates.json` | `PF.Library` (name, tags, desc, size, state names) | all assets | — |
| `style_apply.json` | every asset rendered **through each of 8 palette families** | 16,872 rows (balanced) | by asset |
| `style_fit.json` | every asset + its 8 quantisation errors | per asset | by asset |
| route pairs | utterance templates × schema values, generated arg-first | ~13k | by tool |
| retrieval pairs | queries synthesised from each asset's own tags/name | ~1.5k | **by asset** |

Two details matter more than the model:

* **Generated arg-first.** The target arguments are chosen first and the
  utterance is *rendered from them*, so an utterance can never disagree with its
  own label. The usual failure of synthetic tool-call data is the opposite order.
* **Semantic values.** `direction ∈ {-1, 1}`, `scale ∈ {1, 2, 4, 8, 16}`,
  `index ∈ 0..8`. Sampling the raw JSON-Schema range produces nonsense targets
  and then a model that cannot learn them.

Tools whose required arguments cannot be expressed in an utterance
(`paint_rows`, `set_pixels`, `load_project`) are excluded: inventing a 5×7 ASCII
payload from "paint these rows" is a lottery, not a routing task.

## 2. The three recipes

### `train_router.py` — decoder LM

* tokenizer: whitespace-preserving word-piece BPE, 768 tokens, byte fallback for
  anything unseen (so encoding can never fail on user input)
* d=80, 3 layers, 4 heads, FFN 224, tied embeddings, max_len 96
* loss is masked to the JSON target: the model learns to *produce* a call, not to
  reproduce the instruction
* **next-token shift done explicitly.** Pairing logits with labels at the same
  index trains the model to copy its input and looks like a perfect loss curve;
  `tests/test_overfit.py` exists to catch exactly that
* checkpoint selection on free-running exact match (small sample), because
  teacher-forced loss and generation quality diverge

### `train_search.py` — bi-encoder

* d=64, 2 layers, 4 heads, mean-pooled, L2-normalized
* InfoNCE over the *whole catalogue* as the negative pool, temperature 0.07
* the document tower is re-encoded every 10 steps and cached in between (stale
  embeddings, the standard trick): ~7× faster with no measurable recall loss
* best checkpoint on `any@1`, the metric the tool is judged by

### `train_palette.py` — MLP

* 41 features → 64 → 32 → 8, ReLU, 5k parameters
* the feature extractor is duplicated in JS on purpose and diffed in the parity
  test; it must be trivial enough to reimplement exactly

## 3. Quantization is part of the pipeline

`write_nik1` quantizes every 2-D matrix per output channel and leaves vectors in
fp32. The measured effect of int8 on all three metrics is **zero** at these
sizes — the interesting trade is int4 (half the bytes, a few points of exact-call
accuracy), which is an export flag rather than a retrain:

```bash
python3 nik1/python/realign.py            # rewrite containers, 4-byte aligned
```

`eval_pipeline.py` always evaluates the *quantized artifacts*, never the fp32
training objects, because the artifact is what ships.

## 4. Scaling up (free GPU)

```bash
pip install -r nik1/requirements-torch.txt
python3 nik1/python/torch/train_router_torch.py --d-model 256 --layers 6 --steps 6000 --batch 64
```

`torch/nik1_torch.py` mirrors the NumPy architecture (same RMSNorm, RoPE,
tied embeddings) so a GPU-trained model exports to the identical container. The
notebooks in `kaggle/` do this end to end, including copying the result into
`nik1/js/models/` and re-running the runtime tests.

### Distillation

```bash
python3 nik1/python/torch/distill.py --teacher oracle --n 20000 --steps 4000
python3 nik1/python/torch/distill.py --teacher hf --model Qwen/Qwen2.5-0.5B-Instruct --n 6000
```

* `--teacher oracle` labels prompts with the deterministic template generator:
  unlimited pairs, zero cost, and the labels are exactly the runtime behaviour.
* `--teacher hf` labels a prompt corpus with a real instruct model to widen
  coverage beyond the templates. Every teacher label is passed through the *same*
  grammar repair + schema validation as inference, so the student never learns an
  invalid call.

## 5. Adding a specialist

1. Generate the data (`tools/export-data.js` or a new generator beside it), with
   the split by asset and the majority baseline computed.
2. Pick the cheapest architecture that can express the task — an MLP over
   hand-computable features beats a transformer on tabular data, and both beat a
   model you cannot evaluate.
3. Train, then evaluate on **quantized** artifacts.
4. Export with `export.py`; the runtime picks the architecture up from the JSON.
5. Add a parity case and a budget to `tests/test_runtime.js` and
   `tools/nik1-gate.js`.

The gate is the contract: if a new specialist cannot state its size, its warm
latency and its accuracy floor, it is not done.
