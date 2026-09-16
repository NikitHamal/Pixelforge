/* PixelForge Studio — Document store: model, history (undo/redo), events, serialization.
   Pixels are Uint32Array (ABGR little-endian, ImageData compatible). 0 = transparent. */
window.PF = window.PF || {};
PF.Store = (() => {
  const MAX_HISTORY = 80;
  const listeners = {};
  const on = (ev, fn) => { (listeners[ev] ||= []).push(fn); return () => off(ev, fn); };
  const off = (ev, fn) => { listeners[ev] = (listeners[ev] || []).filter(f => f !== fn); };
  const emit = (ev, payload) => { (listeners[ev] || []).forEach(fn => fn(payload)); };
  const uid = () => Math.random().toString(36).slice(2, 9);

  const DEFAULT_PALETTE = ['#be4a2f', '#d77643', '#ead4aa', '#e4a672', '#b86f50', '#733e39', '#3e2731', '#a22633',
    '#e43b44', '#f77622', '#feae34', '#fee761', '#63c74d', '#3e8948', '#265c42', '#193c3e',
    '#124e89', '#0099db', '#2ce8f5', '#ffffff', '#c0cbdc', '#8b9bb4', '#5a6988', '#3a4466',
    '#262b44', '#181425', '#ff0044', '#68386c', '#b55088', '#f6757a', '#e8b796', '#c28569'];

  let doc = null, history = [], future = [], stroke = null;

  /* ---------- factories ---------- */
  const clonePixels = p => Object.fromEntries(Object.entries(p).map(([k, v]) => [k, v.slice()]));
  const cloneDoc = d => ({
    ...d, layers: d.layers.map(l => ({ ...l })), palette: [...d.palette],
    states: d.states.map(s => ({ ...s, frames: s.frames.map(f => ({ ...f, pixels: clonePixels(f.pixels) })) }))
  });
  const makeLayer = name => ({ id: uid(), name, visible: true, opacity: 1, locked: false });
  const makeFrame = (d, duration = 125) => {
    const f = { id: uid(), duration, pixels: {} };
    d.layers.forEach(l => { f.pixels[l.id] = new Uint32Array(d.width * d.height); });
    return f;
  };
  const makeState = (d, name, fps = 8, count = 1) => {
    const s = { id: uid(), name, fps, loop: true, frames: [] };
    for (let i = 0; i < count; i++) s.frames.push(makeFrame(d, Math.round(1000 / fps)));
    return s;
  };

  function newDoc({ width = 32, height = 32, name = 'hero-sprite' } = {}) {
    width = clampSize(width); height = clampSize(height);
    doc = { id: uid(), name, width, height, layers: [makeLayer('Body')], states: [], palette: [...DEFAULT_PALETTE],
      activeState: 0, activeFrame: 0, activeLayer: 0, color: '#e43b44' };
    doc.states.push(makeState(doc, 'idle'));
    history = []; future = []; stroke = null;
    emit('doc'); emit('change');
    return doc;
  }
  const clampSize = n => Math.max(1, Math.min(256, Math.round(Number(n) || 32)));

  /* ---------- accessors ---------- */
  const get = () => doc;
  const state = () => doc.states[doc.activeState];
  const frame = () => state().frames[doc.activeFrame];
  const layer = () => doc.layers[doc.activeLayer];
  const pixels = layerId => frame().pixels[layerId || layer().id];
  const clampActive = () => {
    doc.activeState = Math.max(0, Math.min(doc.states.length - 1, doc.activeState));
    doc.activeFrame = Math.max(0, Math.min(state().frames.length - 1, doc.activeFrame));
    doc.activeLayer = Math.max(0, Math.min(doc.layers.length - 1, doc.activeLayer));
  };
  function setActive({ state: s, frame: f, layer: l } = {}) {
    if (s !== undefined) { doc.activeState = s; doc.activeFrame = 0; }
    if (f !== undefined) doc.activeFrame = f;
    if (l !== undefined) doc.activeLayer = l;
    clampActive(); emit('active'); emit('render');
  }
  function setColor(hex) { doc.color = hex; emit('color', hex); }

  /* ---------- history ---------- */
  const push = entry => { history.push(entry); if (history.length > MAX_HISTORY) history.shift(); future = []; emit('history'); };
  function beginStroke(layerId) {
    const id = layerId || layer().id, arr = frame().pixels[id];
    stroke = { s: doc.activeState, f: doc.activeFrame, layerId: id, before: arr.slice() };
    return arr;
  }
  function endStroke() {
    if (!stroke) return;
    const arr = doc.states[stroke.s].frames[stroke.f].pixels[stroke.layerId];
    let changed = false;
    for (let i = 0; i < arr.length; i++) if (arr[i] !== stroke.before[i]) { changed = true; break; }
    if (changed) push({ kind: 'pixels', ...stroke, after: arr.slice() });
    stroke = null; emit('change');
  }
  function cancelStroke() { if (!stroke) return; doc.states[stroke.s].frames[stroke.f].pixels[stroke.layerId].set(stroke.before); stroke = null; emit('render'); }
  function transact(fn) {
    const before = cloneDoc(doc); const r = fn(doc); clampActive();
    push({ kind: 'doc', before, after: cloneDoc(doc) });
    emit('doc'); emit('change'); return r;
  }
  function apply(entry, dir) {
    if (entry.kind === 'pixels') {
      const fr = doc.states[entry.s]?.frames[entry.f];
      if (fr && fr.pixels[entry.layerId]) fr.pixels[entry.layerId].set(dir === 'undo' ? entry.before : entry.after);
      doc.activeState = entry.s; doc.activeFrame = entry.f; clampActive(); emit('active');
    } else { doc = cloneDoc(dir === 'undo' ? entry.before : entry.after); emit('doc'); }
    emit('change'); emit('history');
  }
  const undo = () => { const e = history.pop(); if (!e) return false; future.push(e); apply(e, 'undo'); return true; };
  const redo = () => { const e = future.pop(); if (!e) return false; history.push(e); apply(e, 'redo'); return true; };
  const canUndo = () => history.length > 0, canRedo = () => future.length > 0;

  /* ---------- structural ops (all undoable) ---------- */
  const addLayer = name => transact(d => {
    const l = makeLayer(name || `Layer ${d.layers.length + 1}`);
    d.layers.splice(d.activeLayer + 1, 0, l);
    d.states.forEach(s => s.frames.forEach(f => { f.pixels[l.id] = new Uint32Array(d.width * d.height); }));
    d.activeLayer += 1; return l.id;
  });
  const removeLayer = idx => transact(d => {
    if (d.layers.length <= 1) return false;
    const [l] = d.layers.splice(idx, 1);
    d.states.forEach(s => s.frames.forEach(f => { delete f.pixels[l.id]; }));
    if (d.activeLayer >= idx) d.activeLayer = Math.max(0, d.activeLayer - 1); return true;
  });
  const updateLayer = (idx, patch) => transact(d => { Object.assign(d.layers[idx], patch); });
  const moveLayer = (idx, dir) => transact(d => {
    const j = idx + dir; if (j < 0 || j >= d.layers.length) return;
    [d.layers[idx], d.layers[j]] = [d.layers[j], d.layers[idx]]; d.activeLayer = j;
  });
  const mergeDown = idx => transact(d => {
    if (idx <= 0) return; const top = d.layers[idx], below = d.layers[idx - 1];
    d.states.forEach(s => s.frames.forEach(f => {
      const a = f.pixels[below.id], b = f.pixels[top.id];
      for (let i = 0; i < a.length; i++) if (b[i]) a[i] = a[i] ? PF.Color.blend(a[i], b[i]) : b[i];
      delete f.pixels[top.id];
    }));
    d.layers.splice(idx, 1); d.activeLayer = idx - 1;
  });

  const addState = ({ name = 'new-state', fps = 8, frames = 1, copyFrom } = {}) => transact(d => {
    const s = makeState(d, name, fps, frames);
    if (copyFrom !== undefined && d.states[copyFrom]) {
      const src = d.states[copyFrom];
      s.frames = src.frames.map(f => ({ id: uid(), duration: f.duration, pixels: clonePixels(f.pixels) }));
    }
    d.states.push(s); d.activeState = d.states.length - 1; d.activeFrame = 0; return d.activeState;
  });
  const removeState = idx => transact(d => { if (d.states.length <= 1) return false; d.states.splice(idx, 1); return true; });
  const updateState = (idx, patch) => transact(d => { Object.assign(d.states[idx], patch); if (patch.fps) d.states[idx].frames.forEach(f => { f.duration = Math.round(1000 / patch.fps); }); });

  const addFrame = ({ duplicate = true, at } = {}) => transact(d => {
    const s = d.states[d.activeState], i = at ?? d.activeFrame;
    const f = makeFrame(d, s.frames[i]?.duration || Math.round(1000 / s.fps));
    if (duplicate && s.frames[i]) f.pixels = clonePixels(s.frames[i].pixels);
    s.frames.splice(i + 1, 0, f); d.activeFrame = i + 1; return d.activeFrame;
  });
  const removeFrame = idx => transact(d => {
    const s = d.states[d.activeState]; if (s.frames.length <= 1) return false;
    s.frames.splice(idx, 1); if (d.activeFrame >= idx) d.activeFrame = Math.max(0, d.activeFrame - 1); return true;
  });
  const moveFrame = (idx, dir) => transact(d => {
    const fr = d.states[d.activeState].frames, j = idx + dir; if (j < 0 || j >= fr.length) return;
    [fr[idx], fr[j]] = [fr[j], fr[idx]]; d.activeFrame = j;
  });
  const setFrameDuration = (idx, ms) => transact(d => { d.states[d.activeState].frames[idx].duration = Math.max(10, Math.round(ms)); });

  const resize = (w, h, anchor = 'top-left') => transact(d => {
    w = clampSize(w); h = clampSize(h);
    const ox = anchor.includes('center') ? Math.floor((w - d.width) / 2) : 0, oy = anchor.includes('center') ? Math.floor((h - d.height) / 2) : 0;
    d.states.forEach(s => s.frames.forEach(f => {
      for (const id in f.pixels) {
        const src = f.pixels[id], dst = new Uint32Array(w * h);
        for (let y = 0; y < d.height; y++) { const ty = y + oy; if (ty < 0 || ty >= h) continue;
          for (let x = 0; x < d.width; x++) { const tx = x + ox; if (tx >= 0 && tx < w) dst[ty * w + tx] = src[y * d.width + x]; } }
        f.pixels[id] = dst;
      }
    }));
    d.width = w; d.height = h;
  });
  const setPalette = colors => transact(d => { d.palette = colors.slice(0, 256); });
  const addPaletteColor = hex => { if (!doc.palette.includes(hex)) transact(d => { d.palette.push(hex); }); };
  const rename = name => { doc.name = name || 'untitled'; emit('doc'); };

  /* ---------- serialization ---------- */
  const b64 = u32 => { const u8 = new Uint8Array(u32.buffer, u32.byteOffset, u32.byteLength); let s = '';
    for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); };
  const unb64 = str => { const bin = atob(str), u8 = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i); return new Uint32Array(u8.buffer); };
  const serialize = () => JSON.stringify({ format: 'pixelforge', version: 1, ...doc,
    states: doc.states.map(s => ({ ...s, frames: s.frames.map(f => ({ ...f, pixels: Object.fromEntries(Object.entries(f.pixels).map(([k, v]) => [k, b64(v)])) })) })) });
  function load(json) {
    const d = typeof json === 'string' ? JSON.parse(json) : json;
    if (d.format !== 'pixelforge') throw new Error('Not a PixelForge project');
    d.states.forEach(s => s.frames.forEach(f => { for (const k in f.pixels) f.pixels[k] = unb64(f.pixels[k]); }));
    delete d.format; delete d.version; doc = d; history = []; future = []; clampActive();
    emit('doc'); emit('change'); emit('history');
  }
  /* Plain summary for agents (no pixel data) */
  const summary = () => ({ name: doc.name, width: doc.width, height: doc.height, color: doc.color, palette: doc.palette,
    activeState: doc.activeState, activeFrame: doc.activeFrame, activeLayer: doc.activeLayer,
    layers: doc.layers.map((l, i) => ({ index: i, ...l })),
    states: doc.states.map((s, i) => ({ index: i, name: s.name, fps: s.fps, loop: s.loop, frames: s.frames.map(f => f.duration) })) });

  return { on, off, emit, DEFAULT_PALETTE, newDoc, get, state, frame, layer, pixels, setActive, setColor, beginStroke, endStroke, cancelStroke,
    transact, undo, redo, canUndo, canRedo, addLayer, removeLayer, updateLayer, moveLayer, mergeDown, addState, removeState, updateState,
    addFrame, removeFrame, moveFrame, setFrameDuration, resize, setPalette, addPaletteColor, rename, serialize, load, summary, cloneDoc };
})();
