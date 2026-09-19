/* PixelForge Studio — animated GIF encoder (GIF89a + LZW).

   Lives on its own, with no DOM and no Blob, so the same encoder serves the
   browser exporter and the headless Node CLI. `encode()` hands back a plain
   Uint8Array; whoever called it decides whether that becomes a Blob, a file on
   disk or a byte stream.

   Pixel format in, everywhere in PixelForge: Uint32Array, ABGR little-endian
   (0xAABBGGRR), 0 = transparent. */
window.PF = window.PF || {};
PF.Gif = (() => {
  const MAX_CODES = 4096;

  /* LZW as GIF specifies it: variable code width, a clear code emitted up
     front and again whenever the dictionary fills. */
  function lzw(indices, minCodeSize) {
    const clear = 1 << minCodeSize, eoi = clear + 1, out = [];
    let codeSize = minCodeSize + 1, next = eoi + 1, dict = new Map(), bitBuf = 0, bitCnt = 0;
    const emit = code => {
      bitBuf |= code << bitCnt; bitCnt += codeSize;
      while (bitCnt >= 8) { out.push(bitBuf & 255); bitBuf >>>= 8; bitCnt -= 8; }
    };
    emit(clear);
    if (indices.length === 0) { emit(eoi); if (bitCnt > 0) out.push(bitBuf & 255); return out; }
    let prefix = indices[0];
    for (let i = 1; i < indices.length; i++) {
      const k = indices[i], key = (prefix << 8) | k;
      if (dict.has(key)) { prefix = dict.get(key); continue; }
      emit(prefix);
      if (next === MAX_CODES) { emit(clear); dict = new Map(); codeSize = minCodeSize + 1; next = eoi + 1; }
      else { if (next >= (1 << codeSize)) codeSize++; dict.set(key, next++); }
      prefix = k;
    }
    emit(prefix); emit(eoi);
    if (bitCnt > 0) out.push(bitBuf & 255);
    return out;
  }

  /* Build a <=255-entry palette, reserving index 0 for transparency.

     Sprites here are hand-picked palettes, so the common case fits outright.
     When it does not, drop one bit per channel at a time rather than running a
     median cut: the input is flat pixel art, and posterising keeps hues put
     where a cut would collapse two deliberate neighbouring tones into one. */
  function quantise(frames) {
    let mask = 0xffffff;
    let list = [];
    for (let guard = 0; guard < 8; guard++) {
      const set = new Set();
      for (const f of frames) {
        const px = f.pixels;
        for (let i = 0; i < px.length; i++) {
          const v = px[i];
          if ((v >>> 24) >= 128) set.add(v & mask & 0xffffff);
        }
      }
      list = [...set];
      if (list.length <= 255) break;
      mask = ((mask << 1) & 0xfefefe) >>> 0;
    }
    if (list.length > 255) list = list.slice(0, 255);
    const index = new Map(list.map((c, i) => [c, i + 1]));
    return { list, index, mask };
  }

  /* frames: [{ pixels: Uint32Array (already composited and scaled), delay: ms }]
     Returns a Uint8Array holding a complete GIF89a file. */
  function encode(frames, w, h, loop = true) {
    if (!frames.length) throw new Error('PF.Gif.encode: no frames');
    const { list, index, mask } = quantise(frames);
    const n = list.length + 1;
    let bits = 1; while ((1 << bits) < n) bits++;
    bits = Math.max(2, bits);

    const bytes = [];
    const u16 = v => bytes.push(v & 255, (v >> 8) & 255);
    const str = s => { for (const ch of s) bytes.push(ch.charCodeAt(0)); };

    str('GIF89a'); u16(w); u16(h);
    bytes.push(0x80 | 0x70 | (bits - 1), 0, 0);       // global table, 8-bit colour
    bytes.push(0, 0, 0);                               // index 0: the transparent slot
    for (const c of list) bytes.push(c & 255, (c >> 8) & 255, (c >> 16) & 255);
    for (let i = n; i < (1 << bits); i++) bytes.push(0, 0, 0);
    if (loop) { bytes.push(0x21, 0xff, 0x0b); str('NETSCAPE2.0'); bytes.push(3, 1); u16(0); bytes.push(0); }

    for (const f of frames) {
      /* Disposal 2 (restore to background) with a transparent index. Disposal
         1 leaves the previous frame underneath, which smears any sprite whose
         silhouette shrinks between frames. */
      bytes.push(0x21, 0xf9, 4, 0x09);
      u16(Math.max(2, Math.round(f.delay / 10)));      // GIF ticks are centiseconds
      bytes.push(0, 0);
      bytes.push(0x2c); u16(0); u16(0); u16(w); u16(h); bytes.push(0);
      const idx = new Uint8Array(w * h);
      for (let i = 0; i < idx.length; i++) {
        const v = f.pixels[i];
        idx[i] = (v >>> 24) >= 128 ? (index.get(v & mask & 0xffffff) || 0) : 0;
      }
      const data = lzw(idx, bits);
      bytes.push(bits);
      for (let i = 0; i < data.length; i += 255) {
        const chunk = data.slice(i, i + 255);
        bytes.push(chunk.length);
        for (const b of chunk) bytes.push(b);
      }
      bytes.push(0);
    }
    bytes.push(0x3b);
    return new Uint8Array(bytes);
  }

  return { encode, lzw, quantise };
})();
