# Benchmarks — how these numbers were produced

```bash
node nik1/js/bench.js            # warm latency, sizes, load times
node nik1/js/bench.js --json     # the same, machine-readable (used by the gate)
python3 nik1/python/eval_pipeline.py   # task metrics on the int8 artifacts
```

## Environment

2 vCPU container (x86-64), 8 GB RAM, no GPU, Node 24, NumPy 2.5. Nothing else was
running. A 2015-era phone is a few times slower on a single thread; a modern
phone is comparable to one of these cores. The point of quoting a *weak* machine
is that the numbers are a floor, not a demo rig.

## Measured (this checkout)

| model | task | params | file | resident | load | warm |
|---|---|---|---|---|---|---|
| `nik1-route` | utterance → tool call | 248,192 | 262.0 KB | 1.58 MB | 12.3 ms | 28–36 ms |
| `nik1-search` | brief → top-5 assets | 132,288 | 168.6 KB | 738 KB | 4.1 ms | 9.2 ms |
| `nik1-palette` | sprite → palette family | 5,032 | 6.6 KB | 20 KB | 1.2 ms | 0.30 ms |
| grammar + fallback | validate/repair a call | — | — | — | — | 0.002 ms |
| **total** | | **385k** | **437 KB** | ~2.3 MB | | |

Task quality, measured on held-out data with the **int8** artifacts:

| metric | value | baseline |
|---|---|---|
| router: exact call | 88.3% (300 utterances) | 1/52 ≈ 1.9% (random tool) |
| router: correct tool | 100% | — |
| router: schema-valid call through the pipeline | **100%** | — |
| router: valid JSON before repair | 100% | — |
| search: any@1 / any@5 | 81.0% / 91.9% | random r@1 0.9% |
| search: exact-id r@1 | 1.9% | ambiguous by construction |
| palette: accuracy | 100% | majority class 12.5% |

## Estimator cost

For a dense model the arithmetic is `2 × params × tokens` MACs. A 27-token
router call therefore costs ~13 MFLOP, which is why 28 ms on two CPU cores is a
*bandwidth* result, not a compute limit: the weights are 1.58 MB unpacked and are
read once per token. That is the price of zero dependencies — a WebGPU kernel
would remove it, and a WebAssembly SIMD path would remove most of it.

## How to compare against a hosted model honestly

The temptation is to divide someone else's price by ours. Concretely, for this
task class the local path has:

* **zero marginal cost per call** (no tokens, no price tier)
* **no network round trip** (hosted median latency is 300 ms–2 s; a bad mobile
  connection is worse)
* **no data leaving the device** (routing utterances can contain a user's project
  names)
* **bounded, worst-case latency** instead of a shared-endpoint queue

It also has a *narrower competence*: it is an in-domain router with a 52-way
output, not a general assistant. Any "N× cheaper/faster" claim is only meaningful
next to that sentence, which is why the numbers above are the ones quoted here.
