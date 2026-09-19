# Kaggle notebooks

Free-GPU recipes for scaling the Nik1 family. Both notebooks clone the branch,
train on the GPU, export the same `.nik1` container the browser runtime reads, and
hand you the files to download.

| notebook | what it does | time on a T4 |
|---|---|---|
| `nik1_train_on_kaggle.ipynb` | trains a 2–6M parameter router from scratch | ~15 min |
| `nik1_distill_on_kaggle.ipynb` | distils an oracle or a real LLM into a ~3 MB student | ~6 min (+ teacher time) |

**Setup:** `Runtime → Accelerator → GPU T4` (a single T4 is plenty) and internet
on. Then `Run all`. The notebooks install nothing that is not already in the
Kaggle image, except `transformers` for the LLM-teacher cell.

## What to expect

| | laptop (this repo, 2 vCPU) | Kaggle T4 |
|---|---|---|
| nik1-route | 248k params, 254 KB int8, 4 min | 2–6M params, 2–6 MB int8, ~15 min |
| exact-call accuracy | 88% (0.88) | ~95%+ at 2M+ params |
| pipeline validity | 100% (by construction) | 100% |

The runtime does not care which one you load: the architecture describes itself
in the `.json` next to the weights, and the JS reader builds whatever shape it
finds.

## Local equivalents

```bash
pip install torch
python3 nik1/python/torch/train_router_torch.py --steps 6000 --d-model 256 --layers 6
python3 nik1/python/torch/distill.py --teacher oracle --steps 4000
```
