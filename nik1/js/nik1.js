/* Nik1 — on-device inference runtime.
 *
 * Zero dependencies, no build step, one file. Runs in Node and in the browser
 * (and therefore inside a web worker, a PWA, or an Electron/Tauri shell) on the
 * same code path, because there is nothing platform-specific in it:
 * `ArrayBuffer` in, `Float32Array` out.
 *
 * What it implements, mirroring nik1/python/nik1 exactly:
 *   - the whitespace-preserving BPE tokenizer, byte fallback included
 *   - RMSNorm, RoPE, multi-head attention (causal for the LM, bidirectional for
 *     the encoder), GELU FFN, tied output projection
 *   - the .nik1 weight container: int8 and int4 per-row symmetric quantization
 *   - the sprite feature extractor used by the palette head
 *
 * Memory: weights are unpacked to Float32Array at load. A 250k-parameter model
 * costs about 1 MB of RAM that way and answers in single-digit milliseconds on
 * a 2015-class laptop, which is the whole point of the family — no GPU, no
 * allocator churn, no framework. Scratch buffers are allocated once per model
 * and reused across tokens and calls.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.Nik1 = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const GELU_C = 0.7978845608028654;

  /* ------------------------------------------------------------------ BPE */

  class Tokenizer {
    constructor(spec) {
      this.vocab = spec.vocab;
      this.merges = spec.merges || [];
      this.lowercase = spec.lowercase !== false;
      this.itos = new Map();
      for (const [tok, id] of Object.entries(this.vocab)) this.itos.set(id, tok);
      this.ranks = new Map();
      this.merges.forEach((p, i) => this.ranks.set(p[0] + '\u0000' + p[1], i));
      this.pad = this.vocab['<pad>'];
      this.bos = this.vocab['<bos>'];
      this.eos = this.vocab['<eos>'];
      this.unk = this.vocab['<unk>'];
      this.byteOf = new Map();
      for (let b = 0; b < 256; b++) {
        const id = this.vocab['<b' + b + '>'];
        if (id !== undefined) this.byteOf.set(id, b);
      }
      this.size = Object.keys(this.vocab).length;
    }

    _charTokens(ch) {
      const out = [];
      for (const b of utf8Bytes(ch)) {
        const tok = '<b' + b + '>';
        out.push(this.vocab[tok] !== undefined ? tok : '<unk>');
      }
      return out;
    }

    _encodeWord(w) {
      let sym = [];
      for (const ch of w) {
        if (this.vocab[ch] !== undefined) sym.push(ch);
        else sym.push(...this._charTokens(ch));
      }
      while (sym.length > 1) {
        let best = -1, bestRank = Infinity;
        for (let i = 0; i < sym.length - 1; i++) {
          const r = this.ranks.get(sym[i] + '\u0000' + sym[i + 1]);
          if (r !== undefined && r < bestRank) { bestRank = r; best = i; }
        }
        if (best < 0) break;
        const a = sym[best], b = sym[best + 1], out = [];
        for (let i = 0; i < sym.length;) {
          if (i < sym.length - 1 && sym[i] === a && sym[i + 1] === b) { out.push(a + b); i += 2; }
          else { out.push(sym[i]); i++; }
        }
        sym = out;
      }
      return sym;
    }

    tokens(text) {
      const s = this.lowercase ? text.toLowerCase() : text;
      const out = [];
      for (const w of s.match(/\s?[A-Za-z]+|\s?[0-9]+|\s+|[^\sA-Za-z0-9]/g) || []) {
        out.push(...this._encodeWord(w));
      }
      return out;
    }

    encode(text, addBos, addEos) {
      const ids = this.tokens(text).map(t => (this.vocab[t] !== undefined ? this.vocab[t] : this.unk));
      if (addBos) ids.unshift(this.bos);
      if (addEos) ids.push(this.eos);
      return ids;
    }

    /* exact inverse of encode(), byte tokens included */
    decode(ids) {
      const out = [];
      let buf = [];
      const flush = () => { if (buf.length) { out.push(decodeUtf8(buf)); buf = []; } };
      for (const raw of ids) {
        const i = raw | 0;
        if (i === this.pad || i === this.bos || i === this.eos) continue;
        if (this.byteOf.has(i)) buf.push(this.byteOf.get(i));
        else { flush(); out.push(this.itos.get(i) !== undefined ? this.itos.get(i) : '<unk>'); }
      }
      flush();
      return out.join('');
    }

    /* decode keeping every token — used by the grammar masker */
    raw(ids) {
      let s = '';
      for (const i of ids) {
        const t = this.itos.get(i | 0);
        if (t === undefined || t === '<pad>' || t === '<bos>' || t === '<eos>') continue;
        s += t;
      }
      return s;
    }
  }

  function utf8Bytes(str) {
    const out = [];
    for (const ch of str) {
      const cp = ch.codePointAt(0);
      if (cp < 0x80) out.push(cp);
      else if (cp < 0x800) out.push(0xc0 | (cp >> 6), 0x80 | (cp & 63));
      else if (cp < 0x10000) out.push(0xe0 | (cp >> 12), 0x80 | ((cp >> 6) & 63), 0x80 | (cp & 63));
      else out.push(0xf0 | (cp >> 18), 0x80 | ((cp >> 12) & 63), 0x80 | ((cp >> 6) & 63), 0x80 | (cp & 63));
    }
    return out;
  }

  function decodeUtf8(bytes) {
    let s = '';
    for (let i = 0; i < bytes.length;) {
      const b = bytes[i];
      if (b < 0x80) { s += String.fromCharCode(b); i++; }
      else if (b < 0xe0) { s += String.fromCharCode(((b & 31) << 6) | (bytes[i + 1] & 63)); i += 2; }
      else if (b < 0xf0) { s += String.fromCharCode(((b & 15) << 12) | ((bytes[i + 1] & 63) << 6) | (bytes[i + 2] & 63)); i += 3; }
      else {
        const cp = ((b & 7) << 18) | ((bytes[i + 1] & 63) << 12) | ((bytes[i + 2] & 63) << 6) | (bytes[i + 3] & 63);
        s += String.fromCodePoint(cp); i += 4;
      }
    }
    return s;
  }

  /* --------------------------------------------------------- .nik1 loader */

  function parseNik1(buffer) {
    const view = new DataView(buffer);
    const magic = String.fromCharCode(view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3));
    if (magic !== 'NIK1') throw new Error('not a .nik1 file (magic ' + JSON.stringify(magic) + ')');
    const version = view.getUint32(4, true);
    const jsonLen = view.getUint32(8, true);
    const manifest = JSON.parse(new TextDecoder().decode(new Uint8Array(buffer, 12, jsonLen)));
    const base = 12 + jsonLen;
    const tensors = {};
    /* A float32 view needs a 4-byte aligned offset. Every current file is
       aligned, but a container written by an older build (or by a third party)
       may not be — copy instead of throwing. */
    const f32At = (off, count) => {
      if ((base + off) % 4 === 0) return new Float32Array(buffer, base + off, count);
      const bytes = new Uint8Array(buffer, base + off, count * 4);
      const out = new Float32Array(count);
      new Uint8Array(out.buffer).set(bytes);
      return out;
    };
    for (const t of manifest.tensors) {
      const abs = base + t.data_offset;
      if (t.dtype === 'f32') {
        tensors[t.name] = f32At(t.data_offset, t.data_bytes / 4).slice();
      } else if (t.dtype === 'i8') {
        const scales = f32At(t.scale_offset, t.scale_len).slice();
        const codes = new Int8Array(buffer, abs, t.data_bytes).slice();
        tensors[t.name] = dequantRows(codes, scales, t.rows, t.cols);
      } else if (t.dtype === 'i4') {
        const scales = f32At(t.scale_offset, t.scale_len).slice();
        const packed = new Uint8Array(buffer, abs, t.data_bytes).slice();
        tensors[t.name] = dequantNibbles(packed, scales, t.rows, t.cols);
      } else {
        throw new Error('unknown tensor dtype ' + t.dtype);
      }
    }
    return { manifest, tensors, version };
  }

  /* symmetric per-output-channel dequantization: (in x out) row-major */
  function dequantRows(codes, scales, rows, cols) {
    const out = new Float32Array(rows * cols);
    for (let r = 0; r < rows; r++) {
      const s = scales.length === rows ? scales[r] : scales[Math.min(scales.length - 1, r)];
      const base = r * cols;
      for (let c = 0; c < cols; c++) out[base + c] = codes[base + c] * s;
    }
    return out;
  }

  function dequantNibbles(packed, scales, rows, cols) {
    const out = new Float32Array(rows * cols);
    const perRow = Math.ceil(cols / 2);
    for (let r = 0; r < rows; r++) {
      const s = scales.length === rows ? scales[r] : scales[0];
      const pBase = r * perRow, oBase = r * cols;
      for (let c = 0; c < cols; c++) {
        const byte = packed[pBase + (c >> 1)];
        const nib = (c & 1) ? (byte >> 4) & 15 : byte & 15;
        out[oBase + c] = (nib - 8) * s;
      }
    }
    return out;
  }

  /* ---------------------------------------------------------------- kernels */

  function matvec(x, W, nin, nout, out, bias) {
    out = out || new Float32Array(nout);
    for (let o = 0; o < nout; o++) {
      let acc = bias ? bias[o] : 0;
      for (let i = 0; i < nin; i++) acc += x[i] * W[i * nout + o];
      out[o] = acc;
    }
    return out;
  }

  function rmsnorm(x, w, out) {
    const n = x.length;
    let ss = 0;
    for (let i = 0; i < n; i++) ss += x[i] * x[i];
    const inv = 1 / Math.sqrt(ss / n + 1e-6);
    out = out || new Float32Array(n);
    for (let i = 0; i < n; i++) out[i] = x[i] * inv * w[i];
    return out;
  }

  function gelu(x, out) {
    out = out || new Float32Array(x.length);
    for (let i = 0; i < x.length; i++) {
      const v = x[i];
      out[i] = 0.5 * v * (1 + Math.tanh(GELU_C * (v + 0.044715 * v * v * v)));
    }
    return out;
  }

  function buildRope(headDim, maxLen) {
    const half = headDim >> 1;
    const cos = new Float32Array(maxLen * half);
    const sin = new Float32Array(maxLen * half);
    for (let t = 0; t < maxLen; t++) {
      for (let i = 0; i < half; i++) {
        const inv = 1 / Math.pow(10000, (2 * i) / headDim);
        cos[t * half + i] = Math.cos(t * inv);
        sin[t * half + i] = Math.sin(t * inv);
      }
    }
    return { cos, sin, half };
  }

  /* In-place RoPE on arr[offset .. offset+headDim) at position pos. */
  function ropeSlice(arr, offset, headDim, pos, rope) {
    const half = rope.half;
    for (let i = 0; i < half; i++) {
      const c = rope.cos[pos * half + i], s = rope.sin[pos * half + i];
      const a = offset + 2 * i;
      const x0 = arr[a], x1 = arr[a + 1];
      arr[a] = x0 * c - x1 * s;
      arr[a + 1] = x0 * s + x1 * c;
    }
  }

  /* ----------------------------------------------------------- transformer */

  class Block {
    constructor(W, cfg, i) {
      const p = 'blocks.' + i + '.';
      this.n1 = W[p + 'n1'];
      this.n2 = W[p + 'n2'];
      this.qkvW = W[p + 'att.qkv.w'];
      this.qkvB = W[p + 'att.qkv.b'];
      this.projW = W[p + 'att.proj.w'];
      this.projB = W[p + 'att.proj.b'];
      this.fc1W = W[p + 'fc1.w'];
      this.fc1B = W[p + 'fc1.b'];
      this.fc2W = W[p + 'fc2.w'];
      this.fc2B = W[p + 'fc2.b'];
      this.cfg = cfg;
      this.rope = buildRope(cfg.d_model / cfg.n_heads, cfg.max_len);
      const T = cfg.max_len, d = cfg.d_model;
      this.q = new Float32Array(T * d);
      this.k = new Float32Array(T * d);
      this.v = new Float32Array(T * d);
      this.ctx = new Float32Array(T * d);
      this.h = new Float32Array(d);
      this.qkv = new Float32Array(3 * d);
      this.f1 = new Float32Array(cfg.d_ff);
      this.g1 = new Float32Array(cfg.d_ff);
      this.f2 = new Float32Array(d);
      this.scores = new Float32Array(T);
      this.out = new Float32Array(T * d);
      this.tmp = new Float32Array(T * d);
    }

    /* x: Float32Array(T * d) -> Float32Array(T * d) (a fresh buffer per call, so
       callers can hold on to it; the scratch buffers above are reused). */
    forward(x, T, causal) {
      const d = this.cfg.d_model, H = this.cfg.n_heads, hd = d / H;
      const { q, k, v, ctx, h, qkv, scores } = this;
      for (let t = 0; t < T; t++) {
        rmsnorm(x.subarray(t * d, t * d + d), this.n1, h);
        matvec(h, this.qkvW, d, 3 * d, qkv, this.qkvB);
        q.set(qkv.subarray(0, d), t * d);
        k.set(qkv.subarray(d, 2 * d), t * d);
        v.set(qkv.subarray(2 * d, 3 * d), t * d);
        // RoPE once per position and head, in place
        for (let hIdx = 0; hIdx < H; hIdx++) {
          ropeSlice(q, t * d + hIdx * hd, hd, t, this.rope);
          ropeSlice(k, t * d + hIdx * hd, hd, t, this.rope);
        }
      }
      const scale = 1 / Math.sqrt(hd);
      for (let hIdx = 0; hIdx < H; hIdx++) {
        const off = hIdx * hd;
        for (let t = 0; t < T; t++) {
          const qOff = t * d + off;
          const limit = causal ? t + 1 : T;
          let max = -Infinity;
          for (let s = 0; s < limit; s++) {
            const kOff = s * d + off;
            let acc = 0;
            for (let i = 0; i < hd; i++) acc += q[qOff + i] * k[kOff + i];
            acc *= scale;
            scores[s] = acc;
            if (acc > max) max = acc;
          }
          let sum = 0;
          for (let s = 0; s < limit; s++) { const e = Math.exp(scores[s] - max); scores[s] = e; sum += e; }
          const inv = 1 / sum;
          const cOff = t * d + off;
          for (let i = 0; i < hd; i++) ctx[cOff + i] = 0;
          for (let s = 0; s < limit; s++) {
            const w = scores[s] * inv;
            const vOff = s * d + off;
            for (let i = 0; i < hd; i++) ctx[cOff + i] += w * v[vOff + i];
          }
        }
      }
      const out = new Float32Array(T * d);
      const proj = this.f2;
      for (let t = 0; t < T; t++) {
        matvec(ctx.subarray(t * d, t * d + d), this.projW, d, d, proj, this.projB);
        for (let i = 0; i < d; i++) out[t * d + i] = x[t * d + i] + proj[i];
      }
      const { f1, g1 } = this;
      for (let t = 0; t < T; t++) {
        const xt = out.subarray(t * d, t * d + d);
        rmsnorm(xt, this.n2, h);
        matvec(h, this.fc1W, d, this.cfg.d_ff, f1, this.fc1B);
        gelu(f1, g1);
        matvec(g1, this.fc2W, this.cfg.d_ff, d, proj, this.fc2B);   // nin=d_ff, nout=d
        for (let i = 0; i < d; i++) out[t * d + i] += proj[i];
      }
      return out;
    }

    /* One position, reusing the key/value cache. This is what makes generation
       O(T) instead of O(T^2): the prompt is encoded once, then every new token
       costs a single pass. Same math as forward(), verified by the parity test. */
    step(x, pos, cache) {
      const d = this.cfg.d_model, H = this.cfg.n_heads, hd = d / H;
      const h = this.h, qkv = this.qkv, ctx = this.ctx.subarray(0, d);
      if (!this.qtmp) {
        this.qtmp = new Float32Array(d);
        this.out1 = new Float32Array(d);
        this.f1s = new Float32Array(this.cfg.d_ff);
        this.g1s = new Float32Array(this.cfg.d_ff);
      }
      const qs = this.qtmp, out1 = this.out1;
      rmsnorm(x, this.n1, h);
      matvec(h, this.qkvW, d, 3 * d, qkv, this.qkvB);
      for (let i = 0; i < d; i++) qs[i] = qkv[i];
      const kOff = pos * d;
      for (let i = 0; i < d; i++) cache.k[kOff + i] = qkv[d + i];
      for (let i = 0; i < d; i++) cache.v[kOff + i] = qkv[2 * d + i];
      for (let hIdx = 0; hIdx < H; hIdx++) {
        ropeSlice(qs, hIdx * hd, hd, pos, this.rope);
        ropeSlice(cache.k, kOff + hIdx * hd, hd, pos, this.rope);
      }
      const scale = 1 / Math.sqrt(hd);
      const scores = this.scores;
      for (let hIdx = 0; hIdx < H; hIdx++) {
        const off = hIdx * hd;
        let max = -Infinity;
        for (let sp = 0; sp <= pos; sp++) {
          const kB = sp * d + off;
          let acc = 0;
          for (let i = 0; i < hd; i++) acc += qs[off + i] * cache.k[kB + i];
          acc *= scale;
          scores[sp] = acc;
          if (acc > max) max = acc;
        }
        let sum = 0;
        for (let sp = 0; sp <= pos; sp++) { const e = Math.exp(scores[sp] - max); scores[sp] = e; sum += e; }
        const inv = 1 / sum;
        for (let i = 0; i < hd; i++) ctx[off + i] = 0;
        for (let sp = 0; sp <= pos; sp++) {
          const w = scores[sp] * inv, vB = sp * d + off;
          for (let i = 0; i < hd; i++) ctx[off + i] += w * cache.v[vB + i];
        }
      }
      matvec(ctx, this.projW, d, d, out1, this.projB);
      for (let i = 0; i < d; i++) out1[i] += x[i];
      rmsnorm(out1, this.n2, h);
      matvec(h, this.fc1W, d, this.cfg.d_ff, this.f1s, this.fc1B);
      gelu(this.f1s, this.g1s);
      matvec(this.g1s, this.fc2W, this.cfg.d_ff, d, ctx, this.fc2B);
      for (let i = 0; i < d; i++) out1[i] += ctx[i];
      return out1;
    }
  }

  /* --------------------------------------------------------------- models */

  /* Per-layer key/value cache for incremental decoding. Buffers are allocated
     once per model, so generating a token allocates nothing. */
  function makeCache(cfg) {
    const d = cfg.d_model, layers = [];
    for (let i = 0; i < cfg.n_layers; i++) {
      layers.push({ k: new Float32Array(cfg.max_len * d), v: new Float32Array(cfg.max_len * d) });
    }
    return { layers, len: 0 };
  }

  class LM {
    constructor(config, W, tokenizer) {
      this.cfg = config.cfg;
      this.tok = W.tok;
      this.normF = W.norm_f;
      this.blocks = [];
      for (let i = 0; i < this.cfg.n_layers; i++) this.blocks.push(new Block(W, this.cfg, i));
      this.d = this.cfg.d_model;
      this.V = this.cfg.vocab;
      this.tokenizer = tokenizer;
      this.promptPrefix = config.prompt_prefix || '';
      this.logitBuf = new Float32Array(this.V);
      this.embedRow = new Float32Array(this.cfg.max_len * this.d);
      this.hn = new Float32Array(this.d);
    }

    /* logits for the final position of `ids` (Int32Array or Array) */
    logits(ids) {
      const T = Math.min(ids.length, this.cfg.max_len), d = this.d;
      const x = this.embedRow;
      const off = ids.length - T;
      for (let t = 0; t < T; t++) {
        const row = ids[off + t] * d;
        for (let i = 0; i < d; i++) x[t * d + i] = this.tok[row + i];
      }
      let h = x;
      for (const b of this.blocks) h = b.forward(h, T, true);
      const hn = new Float32Array(d);
      rmsnorm(h.subarray((T - 1) * d, T * d), this.normF, hn);
      const out = this.logitBuf;
      for (let v = 0; v < this.V; v++) {
        let acc = 0;
        const row = v * d;
        for (let i = 0; i < d; i++) acc += hn[i] * this.tok[row + i];
        out[v] = acc;
      }
      return out;
    }

    /* Incremental forward used by generate(): one pass per token. */
    stepLogits(tokenId, pos, cache, xbuf, out) {
      const d = this.d;
      const row = tokenId * d;
      for (let i = 0; i < d; i++) xbuf[i] = this.tok[row + i];
      let h = xbuf;
      for (let i = 0; i < this.blocks.length; i++) h = this.blocks[i].step(h, pos, cache.layers[i]);
      const hn = rmsnorm(h, this.normF, this.hn);
      for (let v = 0; v < this.V; v++) {
        let acc = 0;
        const r = v * d;
        for (let i = 0; i < d; i++) acc += hn[i] * this.tok[r + i];
        out[v] = acc;
      }
      return out;
    }

    /* Greedy generation with an optional token mask. Returns the raw ids.
       Uses a KV cache: the prompt is encoded once, then each token is one pass. */
    generate(text, opts) {
      opts = opts || {};
      const maxNew = opts.maxNew || 64;
      const prefix = opts.prefixIds
        ? opts.prefixIds.slice()
        : this.tokenizer.encode(this.promptPrefix + text);
      const cache = makeCache(this.cfg);
      const xbuf = new Float32Array(this.d);
      const out = new Float32Array(this.V);
      const seq = [this.tokenizer.bos].concat(prefix).slice(0, this.cfg.max_len);
      let logits = null;
      for (let t = 0; t < seq.length; t++) logits = this.stepLogits(seq[t], t, cache, xbuf, out);
      /* the generation budget is what is left of the context window: asking for
         maxNew = max_len tokens would otherwise truncate the *prompt* to nothing
         and leave `logits` null (a crash the bench caught immediately) */
      const budget = Math.min(maxNew, Math.max(1, this.cfg.max_len - seq.length));
      const generated = [];
      for (let step = 0; step < budget; step++) {
        let choice = -1;
        if (opts.maskFn) {
          const allowed = opts.maskFn(generated);
          if (allowed && allowed.size) {
            let best = -Infinity;
            for (const t of allowed) if (logits[t] > best) { best = logits[t]; choice = t; }
          }
        }
        if (choice < 0) {
          let best = -Infinity;
          for (let v = 0; v < logits.length; v++) if (logits[v] > best) { best = logits[v]; choice = v; }
        }
        if (choice === this.tokenizer.eos) break;
        generated.push(choice);
        const pos = seq.length + generated.length - 1;
        if (pos >= this.cfg.max_len) break;
        logits = this.stepLogits(choice, pos, cache, xbuf, out);
      }
      return generated;
    }

    /* Reference path: recompute the whole prefix every step (used by the parity
       test, which compares it against NumPy). */
    generateNaive(text, opts) {
      opts = opts || {};
      const maxNew = opts.maxNew || 64;
      const prefix = opts.prefixIds
        ? opts.prefixIds.slice()
        : this.tokenizer.encode(this.promptPrefix + text);
      const seq = [this.tokenizer.bos].concat(prefix);
      const out = [];
      for (let step = 0; step < maxNew; step++) {
        const logits = this.logits(seq);
        let choice = -1;
        if (opts.maskFn) {
          const allowed = opts.maskFn(out);
          if (allowed && allowed.size) {
            let best = -Infinity;
            for (const t of allowed) if (logits[t] > best) { best = logits[t]; choice = t; }
          }
        }
        if (choice < 0) {
          let best = -Infinity;
          for (let v = 0; v < logits.length; v++) if (logits[v] > best) { best = logits[v]; choice = v; }
        }
        if (choice === this.tokenizer.eos) break;
        seq.push(choice);
        out.push(choice);
      }
      return out;
    }
  }

  class Encoder {
    constructor(config, W, tokenizer) {
      this.cfg = config.cfg;
      this.tok = W.tok;
      this.normF = W.norm_f;
      this.blocks = [];
      for (let i = 0; i < this.cfg.n_layers; i++) this.blocks.push(new Block(W, this.cfg, i));
      this.d = this.cfg.d_model;
      this.tokenizer = tokenizer;
      this.hn = new Float32Array(this.cfg.max_len * this.d);
    }

    /* mean-pooled, L2-normalized embedding; padding positions are masked out */
    embed(ids, padId) {
      const T = Math.min(ids.length, this.cfg.max_len), d = this.d;
      const x = new Float32Array(T * d);
      const mask = new Float32Array(T);
      for (let t = 0; t < T; t++) {
        const isPad = padId !== undefined && ids[t] === padId;
        mask[t] = isPad ? 0 : 1;
        const row = ids[t] * d;
        for (let i = 0; i < d; i++) x[t * d + i] = this.tok[row + i];
      }
      let h = x;
      for (const b of this.blocks) h = b.forward(h, T, false);
      /* the final RMSNorm belongs to the pooling path: without it the mean is
         taken over un-normalized states and the embedding drifts from the
         reference implementation (caught by the parity test, which is why that
         test exists) */
      const hn = this.hn;
      for (let t = 0; t < T; t++) rmsnorm(h.subarray(t * d, t * d + d), this.normF, hn.subarray(t * d, t * d + d));
      const pooled = new Float32Array(d);
      let count = 0;
      for (let t = 0; t < T; t++) {
        if (!mask[t]) continue;
        count++;
        for (let i = 0; i < d; i++) pooled[i] += hn[t * d + i];
      }
      const inv = 1 / Math.max(count, 1);
      let norm = 0;
      for (let i = 0; i < d; i++) { pooled[i] *= inv; norm += pooled[i] * pooled[i]; }
      norm = Math.sqrt(norm) + 1e-8;
      for (let i = 0; i < d; i++) pooled[i] /= norm;
      return pooled;
    }
  }

  class MLP {
    constructor(config, W) {
      this.cfg = config.cfg;
      this.dims = [this.cfg.n_in].concat(this.cfg.hidden, [this.cfg.n_out]);
      this.layers = [];
      for (let i = 0; i < this.dims.length - 1; i++) {
        this.layers.push({ w: W['layers.' + i + '.w'], b: W['layers.' + i + '.b'] });
      }
    }

    forward(x) {
      let h = x;
      for (let i = 0; i < this.layers.length; i++) {
        const nout = this.dims[i + 1], l = this.layers[i];
        const out = new Float32Array(nout);
        for (let o = 0; o < nout; o++) {
          let acc = l.b ? l.b[o] : 0;
          for (let k = 0; k < h.length; k++) acc += h[k] * l.w[k * nout + o];
          out[o] = i < this.layers.length - 1 ? Math.max(0, acc) : acc;
        }
        h = out;
      }
      return h;
    }
  }

  /* ---------------------------------------------------- sprite feature extractor */

  /* Mirrors nik1/tools/export-data.js and the FEATURE_SPEC in export.py. */
  function spriteFeatures(buf) {
    const N = buf.length;
    const lum = new Float64Array(16), sat = new Float64Array(8), hue = new Float64Array(12);
    const seen = new Set();
    let opaque = 0, sumL = 0, sumL2 = 0, sumS = 0;
    for (let i = 0; i < N; i++) {
      const v = buf[i];
      if (!v || (v >>> 24) < 128) continue;
      opaque++;
      const r = v & 255, g = (v >> 8) & 255, b = (v >> 16) & 255;
      const L = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
      let H = 0;
      if (d > 0) {
        if (mx === r) H = ((((g - b) / d) % 6) + 6) % 6;
        else if (mx === g) H = (b - r) / d + 2;
        else H = (r - g) / d + 4;
        H /= 6;
      }
      const S = mx ? d / mx : 0;
      lum[Math.min(15, (L * 16) | 0)]++;
      sat[Math.min(7, (S * 8) | 0)]++;
      hue[Math.min(11, (H * 12) | 0)]++;
      sumL += L; sumL2 += L * L; sumS += S;
      if (seen.size < 4096) seen.add(v);
    }
    const f = [opaque / N];
    const push = arr => { for (const x of arr) f.push(opaque ? x / opaque : 0); };
    push(lum); push(sat); push(hue);
    const meanL = opaque ? sumL / opaque : 0;
    f.push(meanL, Math.sqrt(Math.max(0, (opaque ? sumL2 / opaque : 0) - meanL * meanL)),
      Math.min(1, seen.size / 64), opaque ? sumS / opaque : 0);
    return f;
  }

  /* ------------------------------------------------------- model container */

  class RuntimeModel {
    constructor(name, config, tensors, opts) {
      opts = opts || {};
      this.name = name;
      this.config = config;
      this.kind = config.kind;
      this.tokenizer = config.tokenizer ? new Tokenizer(config.tokenizer) : null;
      this.bytes = opts.bytes || 0;
      if (config.kind === 'lm') {
        this.model = new LM(config, tensors, this.tokenizer);
      } else if (config.kind === 'encoder') {
        this.model = new Encoder(config, tensors, this.tokenizer);
        this.docs = config.docs || [];
        this.docEmbeddings = null;
      } else if (config.kind === 'mlp') {
        this.model = new MLP(config, tensors);
        this.labels = config.labels || [];
      } else {
        throw new Error('unknown nik1 model kind ' + config.kind);
      }
    }

    attachDocTable(data, dim, count) {
      this.docEmbeddings = { data, dim, count };
      return this;
    }

    /* ---- router: model + grammar + repair + fallback ----
       `tools` may be passed here, set once with setTools(), or embedded in the
       model config; the grammar needs the live schemas to coerce against. */
    setTools(list, catalog) {
      this.tools = list;
      if (catalog) this.catalog = catalog;
      return this;
    }

    routeUtterance(utterance, Grammar, tools, catalog) {
      const G = Grammar || require('./grammar.js');
      let list = tools || this.tools;
      if (!list && this.config.tools) list = this.config.tools;
      if (!list) throw new Error('nik1: no tool schemas — call model.setTools(tools) or pass them to routeUtterance');
      const index = G.loadTools(null, list);
      const cat = catalog || this.catalog || null;
      const idsOut = this.model.generate(utterance, {
        maxNew: 64,
        maskFn: G.routeMaskFn(this.tokenizer, Object.keys(index), this.config)
      });
      const raw = this.tokenizer.decode(idsOut);
      const res = G.route(utterance, raw, index, cat);
      res.ids = idsOut;
      return res;
    }

    /* ---- retrieval ---- */
    embedQuery(text) {
      const ids = padIds(this.tokenizer.encode(text), this.config.cfg.max_len, this.tokenizer.pad);
      return this.model.embed(ids, this.tokenizer.pad);
    }

    search(text, k) {
      if (!this.docEmbeddings) throw new Error('doc table not loaded');
      const q = this.embedQuery(text);
      const { data, dim, count } = this.docEmbeddings;
      const scores = [];
      for (let i = 0; i < count; i++) {
        let acc = 0;
        const base = i * dim;
        for (let j = 0; j < dim; j++) acc += q[j] * data[base + j];
        scores.push([i, acc]);
      }
      scores.sort((a, b) => b[1] - a[1]);
      return scores.slice(0, k || 5).map(([i, s]) => ({
        id: this.docs[i] ? this.docs[i].id : String(i), text: this.docs[i] ? this.docs[i].text : '', score: s
      }));
    }

    /* ---- palette head ---- */
    classifySprite(buf) {
      const features = spriteFeatures(buf);
      const logits = this.model.forward(Float32Array.from(features));
      let best = 0;
      for (let i = 1; i < logits.length; i++) if (logits[i] > logits[best]) best = i;
      return { label: this.labels[best], index: best, logits: Array.from(logits), features };
    }
  }

  function padIds(ids, maxLen, pad) {
    const out = new Array(maxLen);
    for (let i = 0; i < maxLen; i++) out[i] = pad === undefined ? 0 : pad;
    for (let i = 0; i < Math.min(ids.length, maxLen); i++) out[i] = ids[i];
    return out;
  }

  /* ------------------------------------------------------------- loading */

  function parseConfig(config) {
    return typeof config === 'string' ? JSON.parse(config) : config;
  }

  /* opts: { baseUrl, config, weights (ArrayBuffer), bytes, docTable (ArrayBuffer) } */
  async function loadModel(name, opts) {
    opts = opts || {};
    const base = opts.baseUrl === undefined ? '' : opts.baseUrl;
    const cfgSrc = opts.config !== undefined ? opts.config : await readText(base + name + '.json');
    const config = parseConfig(cfgSrc);
    const bin = opts.weights !== undefined ? opts.weights : await readModelBinary(base, name);
    const buffer = bin instanceof ArrayBuffer ? bin : bin.buffer.slice(bin.byteOffset, bin.byteOffset + bin.byteLength);
    const { tensors } = parseNik1(buffer);
    const model = new RuntimeModel(name, config, tensors, { bytes: buffer.byteLength });
    if (model.kind === 'encoder' && opts.docTable !== undefined) {
      const dt = opts.docTable instanceof ArrayBuffer ? opts.docTable : await readBinary(base + name + '.docs.f32');
      const dim = config.embed_dim;
      const data = new Float32Array(dt);
      model.attachDocTable(data, dim, Math.floor(data.length / dim));
    }
    return model;
  }

  /* Local paths go through fs when it exists (Node, Electron main); anything
     else goes through fetch (browser, worker, Node 18+ with a URL). Checking the
     path shape rather than the API's existence is what makes one code path work
     in both worlds despite Node having a global fetch. */
  const isRemote = url => /^(https?:|data:|blob:)/.test(url);

  async function readText(url) {
    if (!isRemote(url)) {
      const fs = require('fs');
      return fs.promises.readFile(url, 'utf8');
    }
    const r = await fetch(url);
    if (!r.ok) throw new Error('fetch failed ' + url + ' ' + r.status);
    return r.text();
  }

  async function readBinary(url) {
    if (!isRemote(url)) {
      const fs = require('fs');
      let b;
      try {
        b = await fs.promises.readFile(url);
      } catch (err) {
        if (err.code === 'ENOENT') err.notFound = true;
        throw err;
      }
      return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
    }
    const r = await fetch(url);
    if (!r.ok) {
      const err = new Error('fetch failed ' + url + ' ' + r.status);
      if (r.status === 404) err.notFound = true;
      throw err;
    }
    return r.arrayBuffer();
  }

  /* A model may be published whole (`<name>.nik1`) or sharded when a single
     request body cannot carry it (`<name>.nik1.part-NN` + `<name>.nik1.parts.json`).
     Shards are joined here, so callers never see the difference. The manifest's
     sha256 turns a truncated or corrupted download into a clear error instead of
     a model that quietly computes the wrong answer. */
  async function readModelBinary(base, name) {
    try {
      return await readBinary(base + name + '.nik1');
    } catch (err) {
      if (!err.notFound) throw err;
      return readSplit(base, name);
    }
  }

  async function readSplit(base, name) {
    let manifest;
    try {
      manifest = JSON.parse(await readText(base + name + '.nik1.parts.json'));
    } catch (err) {
      throw new Error('nik1: cannot load ' + name + '.nik1, and no readable .nik1.parts.json beside it');
    }
    const chunks = [];
    let total = 0;
    for (const part of manifest.parts) {
      const buf = await readBinary(base + part.name);
      if (part.bytes !== undefined && buf.byteLength !== part.bytes) {
        throw new Error('nik1: ' + part.name + ' is ' + buf.byteLength + ' bytes, manifest says ' + part.bytes);
      }
      chunks.push(new Uint8Array(buf));
      total += buf.byteLength;
    }
    if (total !== manifest.bytes) {
      throw new Error('nik1: ' + name + ' assembled ' + total + ' bytes, manifest says ' + manifest.bytes);
    }
    const joined = new Uint8Array(total);
    let at = 0;
    for (const c of chunks) { joined.set(c, at); at += c.length; }
    if (manifest.sha256) {
      const got = await sha256Hex(joined);
      if (got && got !== manifest.sha256) {
        throw new Error('nik1: ' + name + ' failed its integrity check (sha256 ' +
          got.slice(0, 12) + '... != ' + manifest.sha256.slice(0, 12) + '...)');
      }
    }
    return joined.buffer;
  }

  /* SubtleCrypto where it exists (browser, worker, Node 18+), else Node's crypto.
     Returns null when neither is available — a missing hash check must not take
     the whole model down, and one bit of drift is not worth refusing to run. */
  async function sha256Hex(bytes) {
    const subtle = typeof globalThis !== 'undefined' && globalThis.crypto && globalThis.crypto.subtle;
    if (subtle) {
      try {
        const d = await subtle.digest('SHA-256', bytes);
        return Array.from(new Uint8Array(d)).map(b => b.toString(16).padStart(2, '0')).join('');
      } catch (err) { /* fall through to Node crypto */ }
    }
    try {
      const crypto = require('crypto');
      return crypto.createHash('sha256').update(Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength)).digest('hex');
    } catch (err) { return null; }
  }

  return {
    Tokenizer, parseNik1, loadModel, readModelBinary, readSplit, RuntimeModel, parseConfig, makeCache,
    matvec, rmsnorm, gelu, spriteFeatures, buildRope, ropeSlice, padIds,
    dequantRows, dequantNibbles, utf8Bytes, decodeUtf8,
    version: '1.0.0'
  };
});
