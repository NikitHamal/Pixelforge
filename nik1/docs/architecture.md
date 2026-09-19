# Nik1 architecture

## Shape of the family

One block, three heads. Everything in the family shares the same transformer
block so the quantizer, the container and the JS runtime each have exactly one
code path.

```
block(x) = x + attention(rmsnorm(x, n1))
         = ·  + ffn(rmsnorm(·, n2))

nik1-route    decoder-only LM, causal, tied output projection   -> logits over vocab
nik1-search   encoder, bidirectional, mean-pooled + L2 norm     -> 64-d embedding
nik1-palette  ReLU MLP over 41 features                        -> 8-way logits
```

Design choices, and what they buy at this scale:

| choice | why |
|---|---|
| **RMSNorm** | no mean subtraction, one rsqrt. At 80–256 dims the saving is real, and it removes a reduction from every block. |
| **RoPE** | no learned position table to ship, and behaviour past the trained length degrades instead of exploding. |
| **Tied embeddings** | at 248k parameters a separate output matrix would be a third of the budget. |
| **Pre-LN** | stable training with no warmup tricks, which matters when the whole run is four minutes. |
| **GELU (tanh approx)** | one `tanh`, no `exp`, and it matches the reference implementation bit-for-bit across NumPy and JS. |
| **KV cache at inference** | generation is O(T) instead of O(T²): the router went from 328 ms to 28 ms per call. |

## The `.nik1` container

```
offset 0    magic "NIK1"          4 bytes
offset 4    version               uint32
offset 8    manifest length       uint32
offset 12   manifest              UTF-8 JSON: config + tensor table
offset 12+L payload               raw little-endian tensors, 4-byte aligned
```

Each tensor entry records `dtype` (`i8`, `i4` or `f32`), `shape`, byte offsets and
its per-row scales. Three rules make it boring, which is the point:

* **Per-output-channel symmetric quantization.** One fp32 scale per row; the
  runtime needs one multiply per row, not per element.
* **4-byte aligned payloads.** `new Float32Array(buffer, offset, n)` rejects
  unaligned offsets, and alignment lets the JS reader hand out typed-array views
  with no copying. `realign.py` migrates containers written before this rule.
* **Vectors stay fp32.** RMSNorm gains are ~1 KB; quantizing them costs accuracy
  for no size win.

int4 packs two nibbles per byte (low nibble first). The writer and reader agree
by construction: `nik1/python/realign.py` rewrites a container through
read→write and the result is byte-identical, which is the property the parity
test leans on.

## Reliability: three layers, not one model

A 250k-parameter model is *usually* right and occasionally wrong in creative
ways. Rather than hoping, the router is wrapped:

```
utterance
   │
   ├─ token mask          force `{"tool":"`, restrict the name to real tools
   ├─ model generation    greedy, at most 64 tokens, KV-cached
   ├─ repair              lenient parse, schema coercion, truncation closing,
   │                      catalogue validation of id references
   ├─ validate            the same rules PF.Tools.validate applies in the studio
   └─ fallback            deterministic keyword router (never fails)
```

Measured on 300 held-out utterances with the int8 artifacts: 100% schema-valid,
98.7% produced by the model unaided, 88.3% exactly the intended call.

The mask and the repair rules are implemented twice — Python (for training-time
evaluation) and JavaScript (for inference) — so `tests/test_js_parity.py` feeds
the same cases to both and fails on any divergence. A repair rule that drifts
between the trainer and the runtime is exactly the bug that would only appear in
production.

## Why the runtime is one file

`nik1/js/nik1.js` is ~700 lines with no imports. That is deliberate:

* it runs in a **web worker** without a bundler, so the main thread never blocks;
* it runs in **Node** with no native module, so the benchmark and the tests use
  the same code the browser does;
* it runs in an **embedded shell** (Tauri/Electron/WASM host) by passing an
  `ArrayBuffer` instead of a URL;
* there is nothing to keep in sync between a "browser build" and a "server
  build" — the same file is both.

The numeric core is plain `Float32Array` loops. There is no SIMD, no WebGPU, no
WASM: at these sizes a well-written scalar loop beats the overhead of building
buffers to hand to a kernel, and the code stays auditable.

## Where the accuracy comes from

Nothing here is a distilled frontier model. The accuracy is bought with
**task design**:

* the datasets are *generated from the same registry the models serve*, so the
  label distribution is exactly the deployment distribution;
* splits are by asset, not by example, so a held-out template cannot leak its
  vocabulary into training;
* skewed tasks are re-framed until they are balanced (the palette head detects
  which family a sprite is in, rather than predicting the "best" family, which is
  an 88%-majority-class trap);
* numeric arguments are sampled from semantic ranges, because a dataset that
  contains `direction: 5` is teaching nonsense.

That is why a 248k-parameter model reaches 88% exact-call accuracy on a 52-way
tool-routing task, and why the same pipeline will keep working when you replace
it with a 6M-parameter GPU-trained student.
