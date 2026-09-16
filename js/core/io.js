/* PixelForge Studio — Import / Export: PNG, sprite sheet + JSON atlas (Aseprite-compatible), GIF (LZW), SVG, CSS, project */
window.PF = window.PF || {};
PF.IO = (() => {
  const download = (data, filename, mime = 'application/octet-stream') => {
    const blob = data instanceof Blob ? data : new Blob([data], { type: mime });
    const url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };
  const toBlob = cv => new Promise(res => cv.toBlob(res, 'image/png'));
  const safe = s => (s || 'sprite').replace(/[^a-z0-9_-]+/gi, '-').toLowerCase();

  /* All frames as flat list with state info */
  function allFrames(stateIdx) {
    const d = PF.Store.get(), out = [];
    d.states.forEach((s, si) => { if (stateIdx !== undefined && stateIdx !== 'all' && si !== +stateIdx) return;
      s.frames.forEach((f, fi) => out.push({ state: s, si, frame: f, fi })); });
    return out;
  }

  async function exportPNG({ scale = 1 } = {}) {
    const d = PF.Store.get(), cv = PF.Renderer.frameToCanvas(PF.Store.frame(), scale);
    download(await toBlob(cv), `${safe(d.name)}_${safe(PF.Store.state().name)}_${d.activeFrame}@${scale}x.png`);
    return { file: 'png', width: cv.width, height: cv.height };
  }

  /* Sprite sheet: layout 'rows' (one row per state) | 'grid' (square-ish) | 'strip' (single row) */
  function buildSheet({ scale = 1, layout = 'rows', padding = 0, state = 'all' } = {}) {
    const d = PF.Store.get(), frames = allFrames(state), fw = d.width * scale, fh = d.height * scale, p = padding;
    let cols, rows, place;
    if (layout === 'rows') {
      const states = [...new Set(frames.map(f => f.si))]; cols = Math.max(...states.map(si => d.states[si].frames.length)); rows = states.length;
      place = f => ({ col: f.fi, row: states.indexOf(f.si) });
    } else if (layout === 'strip') { cols = frames.length; rows = 1; place = (f, i) => ({ col: i, row: 0 }); }
    else { cols = Math.ceil(Math.sqrt(frames.length)); rows = Math.ceil(frames.length / cols); place = (f, i) => ({ col: i % cols, row: Math.floor(i / cols) }); }
    const cv = document.createElement('canvas'); cv.width = cols * (fw + p) - p + 0; cv.height = rows * (fh + p) - p;
    const ctx = cv.getContext('2d'); ctx.imageSmoothingEnabled = false;
    const atlas = { frames: {}, meta: { app: 'PixelForge Studio', version: '1.0', image: `${safe(d.name)}.png`, format: 'RGBA8888', size: { w: cv.width, h: cv.height }, scale: String(scale), frameTags: [], layers: d.layers.map(l => ({ name: l.name, opacity: Math.round(l.opacity * 255), blendMode: 'normal' })) } };
    const tags = {};
    frames.forEach((f, i) => {
      const { col, row } = place(f, i), x = col * (fw + p), y = row * (fh + p);
      ctx.drawImage(PF.Renderer.frameToCanvas(f.frame, scale), x, y);
      const key = `${f.state.name}_${f.fi}`;
      atlas.frames[key] = { frame: { x, y, w: fw, h: fh }, rotated: false, trimmed: false, spriteSourceSize: { x: 0, y: 0, w: fw, h: fh }, sourceSize: { w: fw, h: fh }, duration: f.frame.duration };
      (tags[f.state.name] ||= { name: f.state.name, from: i, to: i, direction: 'forward', fps: f.state.fps, loop: f.state.loop }).to = i;
    });
    atlas.meta.frameTags = Object.values(tags);
    return { canvas: cv, atlas, cols, rows, frameWidth: fw, frameHeight: fh };
  }
  async function exportSpriteSheet(o = {}) {
    const d = PF.Store.get(), { canvas, atlas, cols, rows } = buildSheet(o);
    download(await toBlob(canvas), `${safe(d.name)}.png`);
    if (o.json !== false) download(JSON.stringify(atlas, null, 2), `${safe(d.name)}.json`, 'application/json');
    return { file: 'spritesheet', width: canvas.width, height: canvas.height, cols, rows, frames: Object.keys(atlas.frames).length };
  }
  const exportJSON = () => { const d = PF.Store.get(), { atlas } = buildSheet({}); download(JSON.stringify(atlas, null, 2), `${safe(d.name)}.json`, 'application/json'); return { file: 'json', frames: Object.keys(atlas.frames).length }; };

  /* ---------- GIF encoder ---------- */
  function lzw(indices, minCodeSize) {
    const clear = 1 << minCodeSize, eoi = clear + 1, out = [];
    let codeSize = minCodeSize + 1, next = eoi + 1, dict = new Map(), bitBuf = 0, bitCnt = 0;
    const emit = code => { bitBuf |= code << bitCnt; bitCnt += codeSize; while (bitCnt >= 8) { out.push(bitBuf & 255); bitBuf >>>= 8; bitCnt -= 8; } };
    emit(clear);
    let prefix = indices[0];
    for (let i = 1; i < indices.length; i++) {
      const k = indices[i], key = (prefix << 8) | k;
      if (dict.has(key)) { prefix = dict.get(key); continue; }
      emit(prefix);
      if (next === 4096) { emit(clear); dict = new Map(); codeSize = minCodeSize + 1; next = eoi + 1; }
      else { if (next >= (1 << codeSize)) codeSize++; dict.set(key, next++); }
      prefix = k;
    }
    emit(prefix); emit(eoi); if (bitCnt > 0) out.push(bitBuf & 255);
    return out;
  }
  function encodeGIF(frames, w, h, loop = true) {
    // frames: [{pixels: Uint32Array (composited), delay ms}]
    let colors = new Set(); frames.forEach(f => { for (let i = 0; i < f.pixels.length; i++) { const v = f.pixels[i]; if ((v >>> 24) >= 128) colors.add(v & 0xffffff); } });
    let mask = 0xffffff, list = [...colors];
    while (list.length > 255) { mask = ((mask << 1) & 0xfefefe) >>> 0; colors = new Set(list.map(c => c & mask)); list = [...colors]; }
    const index = new Map(list.map((c, i) => [c, i + 1])), n = list.length + 1;
    let bits = 1; while ((1 << bits) < n) bits++; bits = Math.max(2, bits);
    const bytes = [], u16 = v => bytes.push(v & 255, (v >> 8) & 255), str = s => { for (const ch of s) bytes.push(ch.charCodeAt(0)); };
    str('GIF89a'); u16(w); u16(h); bytes.push(0x80 | 0x70 | (bits - 1), 0, 0);
    bytes.push(0, 0, 0); list.forEach(c => bytes.push(c & 255, (c >> 8) & 255, (c >> 16) & 255));
    for (let i = n; i < (1 << bits); i++) bytes.push(0, 0, 0);
    if (loop) { bytes.push(0x21, 0xff, 0x0b); str('NETSCAPE2.0'); bytes.push(3, 1); u16(0); bytes.push(0); }
    for (const f of frames) {
      bytes.push(0x21, 0xf9, 4, 0x09); u16(Math.max(2, Math.round(f.delay / 10))); bytes.push(0, 0);
      bytes.push(0x2c); u16(0); u16(0); u16(w); u16(h); bytes.push(0);
      const idx = new Uint8Array(w * h); for (let i = 0; i < idx.length; i++) { const v = f.pixels[i]; idx[i] = (v >>> 24) >= 128 ? index.get(v & mask & 0xffffff) || 0 : 0; }
      const data = lzw(idx, bits); bytes.push(bits);
      for (let i = 0; i < data.length; i += 255) { const chunk = data.slice(i, i + 255); bytes.push(chunk.length, ...chunk); }
      bytes.push(0);
    }
    bytes.push(0x3b);
    return new Blob([new Uint8Array(bytes)], { type: 'image/gif' });
  }
  function exportGIF({ scale = 1, state } = {}) {
    const d = PF.Store.get(), si = state ?? d.activeState, st = d.states[si], w = d.width * scale, h = d.height * scale;
    const frames = st.frames.map(f => { const cv = PF.Renderer.frameToCanvas(f, scale); const id = cv.getContext('2d').getImageData(0, 0, w, h); return { pixels: new Uint32Array(id.data.buffer), delay: f.duration }; });
    const blob = encodeGIF(frames, w, h, st.loop); download(blob, `${safe(d.name)}_${safe(st.name)}.gif`);
    return { file: 'gif', frames: frames.length, width: w, height: h, bytes: blob.size };
  }

  /* ---------- Vector / CSS ---------- */
  function exportSVG({ scale = 1 } = {}) {
    const d = PF.Store.get(), out = new Uint32Array(d.width * d.height); PF.Renderer.compositeFrame(PF.Store.frame(), out);
    const rects = [];
    for (let y = 0; y < d.height; y++) { let x = 0; while (x < d.width) { const v = out[y * d.width + x]; if (!v) { x++; continue; } let r = x; while (r + 1 < d.width && out[y * d.width + r + 1] === v) r++;
      const a = v >>> 24; rects.push(`<rect x="${x}" y="${y}" width="${r - x + 1}" height="1" fill="${PF.Color.u32ToHex(v).slice(0, 7)}"${a < 255 ? ` fill-opacity="${(a / 255).toFixed(3)}"` : ''}/>`); x = r + 1; } }
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${d.width} ${d.height}" width="${d.width * scale}" height="${d.height * scale}" shape-rendering="crispEdges">\n${rects.join('\n')}\n</svg>`;
    download(svg, `${safe(d.name)}.svg`, 'image/svg+xml'); return { file: 'svg', rects: rects.length };
  }
  function exportCSS({ scale = 4 } = {}) {
    const d = PF.Store.get(), out = new Uint32Array(d.width * d.height); PF.Renderer.compositeFrame(PF.Store.frame(), out);
    const sh = []; for (let y = 0; y < d.height; y++) for (let x = 0; x < d.width; x++) { const v = out[y * d.width + x]; if (v) sh.push(`${x * scale}px ${y * scale}px 0 0 ${PF.Color.u32ToHex(v)}`); }
    const css = `.${safe(d.name)} {\n  width: ${scale}px; height: ${scale}px; margin: 0 ${(d.width - 1) * scale}px ${(d.height - 1) * scale}px 0;\n  box-shadow: ${sh.join(',\n    ')};\n}`;
    download(css, `${safe(d.name)}.css`, 'text/css'); return { file: 'css', pixels: sh.length };
  }
  const exportProject = () => { const d = PF.Store.get(); download(PF.Store.serialize(), `${safe(d.name)}.pixelforge.json`, 'application/json'); return { file: 'project' }; };
  const dataURL = (scale = 1) => PF.Renderer.frameToCanvas(PF.Store.frame(), scale).toDataURL('image/png');

  /* ---------- Import ---------- */
  const readImage = file => new Promise((res, rej) => { const img = new Image(); img.onload = () => res(img); img.onerror = rej; img.src = URL.createObjectURL(file); });
  async function importPNG(file, { frameWidth, frameHeight, asState = true, stateName } = {}) {
    const img = await readImage(file), cv = document.createElement('canvas'); cv.width = img.naturalWidth; cv.height = img.naturalHeight;
    const ctx = cv.getContext('2d'); ctx.drawImage(img, 0, 0);
    const src = new Uint32Array(ctx.getImageData(0, 0, cv.width, cv.height).data.buffer);
    const fw = Math.min(256, frameWidth || cv.width), fh = Math.min(256, frameHeight || cv.height);
    const cols = Math.max(1, Math.floor(cv.width / fw)), rows = Math.max(1, Math.floor(cv.height / fh)), d = PF.Store.get();
    const fits = d.width === fw && d.height === fh;
    if (!fits || !asState) PF.Store.newDoc({ width: fw, height: fh, name: safe(file.name.replace(/\.[^.]+$/, '')) });
    const count = cols * rows;
    const idx = (fits && asState) ? PF.Store.addState({ name: PF.Anim.uniqueName(stateName || 'imported'), fps: 8, frames: count }) : 0;
    PF.Store.transact(doc => {
      const st = doc.states[idx]; while (st.frames.length < count) st.frames.push({ id: Math.random().toString(36).slice(2, 9), duration: 125, pixels: Object.fromEntries(doc.layers.map(l => [l.id, new Uint32Array(fw * fh)])) });
      const lid = doc.layers[0].id;
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) { const p = st.frames[r * cols + c].pixels[lid];
        for (let y = 0; y < fh; y++) for (let x = 0; x < fw; x++) p[y * fw + x] = src[(r * fh + y) * cv.width + c * fw + x]; }
      doc.activeState = idx; doc.activeFrame = 0;
    });
    URL.revokeObjectURL(img.src);
    return { imported: count, width: fw, height: fh, state: idx };
  }
  const importProject = async file => { PF.Store.load(await file.text()); return { ok: true, name: PF.Store.get().name }; };

  const FORMATS = [
    { id: 'png', name: 'PNG frame', desc: 'Current frame, any scale', icon: 'image', run: exportPNG },
    { id: 'spritesheet', name: 'Sprite sheet + JSON', desc: 'All states, Aseprite-compatible atlas', icon: 'grid_view', run: exportSpriteSheet },
    { id: 'gif', name: 'Animated GIF', desc: 'Current state, looping', icon: 'gif_box', run: exportGIF },
    { id: 'json', name: 'Atlas JSON', desc: 'Frames, tags, durations', icon: 'data_object', run: exportJSON },
    { id: 'svg', name: 'SVG', desc: 'Crisp vector rects', icon: 'polyline', run: exportSVG },
    { id: 'css', name: 'CSS box-shadow', desc: 'Pure-CSS sprite', icon: 'css', run: exportCSS },
    { id: 'project', name: 'Project file', desc: 'Lossless .pixelforge.json', icon: 'save', run: exportProject }
  ];
  const run = (id, opts) => { const f = FORMATS.find(x => x.id === id); if (!f) throw new Error(`Unknown format "${id}". Use: ${FORMATS.map(x => x.id).join(', ')}`); return f.run(opts || {}); };
  return { FORMATS, run, download, exportPNG, exportSpriteSheet, exportGIF, exportJSON, exportSVG, exportCSS, exportProject, importPNG, importProject, buildSheet, dataURL, encodeGIF };
})();
