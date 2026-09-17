/* PixelForge Studio — Document store: model, history (undo/redo), events, serialization.
   Pixels are Uint32Array (ABGR little-endian, ImageData compatible). 0 = transparent. */
window.PF = window.PF || {};
PF.Store = (() => {
  const MAX_HISTORY = 80;
  const HISTORY_BYTES = 64 * 1024 * 1024;
  const MAX_PIXELS = 16 * 1024 * 1024;
  const listeners = {};
  const on = (ev, fn) => { (listeners[ev] ||= []).push(fn); return () => off(ev, fn); };
  const off = (ev, fn) => { listeners[ev] = (listeners[ev] || []).filter(f => f !== fn); };
  const emit = (ev, payload) => { if (grouped && ['doc','change','history','active','render','color'].includes(ev)) return; (listeners[ev] || []).forEach(fn => fn(payload)); };
  const uid = () => Math.random().toString(36).slice(2, 9);

  const DEFAULT_PALETTE = ['#be4a2f', '#d77643', '#ead4aa', '#e4a672', '#b86f50', '#733e39', '#3e2731', '#a22633',
    '#e43b44', '#f77622', '#feae34', '#fee761', '#63c74d', '#3e8948', '#265c42', '#193c3e',
    '#124e89', '#0099db', '#2ce8f5', '#ffffff', '#c0cbdc', '#8b9bb4', '#5a6988', '#3a4466',
    '#262b44', '#181425', '#ff0044', '#68386c', '#b55088', '#f6757a', '#e8b796', '#c28569'];

  let doc = null, history = [], future = [], stroke = null, grouped = false;

  /* ---------- factories ---------- */
  const clonePixels = p => Object.fromEntries(Object.entries(p).map(([k, v]) => [k, v.slice()]));
  const cloneDoc = d => ({
    ...d, metadata: d.metadata ? JSON.parse(JSON.stringify(d.metadata)) : undefined, layers: d.layers.map(l => ({ ...l })), palette: [...d.palette],
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
    emit('doc'); emit('change'); emit('history');
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
    if (s !== undefined) checkIndex(s, doc.states.length, 'State');
    if (f !== undefined) checkIndex(f, doc.states[s ?? doc.activeState].frames.length, 'Frame');
    if (l !== undefined) checkIndex(l, doc.layers.length, 'Layer');
    if (s !== undefined) { doc.activeState = s; doc.activeFrame = 0; }
    if (f !== undefined) doc.activeFrame = f;
    if (l !== undefined) doc.activeLayer = l;
    clampActive(); emit('active'); emit('render');
  }
  function setColor(hex) {
    const normalized = PF.Color.u32ToHex(PF.Color.hexToU32(hex));
    if (normalized === 'transparent') throw new Error('Choose a visible drawing color; use the eraser for transparency.');
    doc.color = normalized; emit('color', normalized);
  }
  function checkIndex(index, length, name) { if (!Number.isInteger(index) || index < 0 || index >= length) throw new Error(`${name} index is out of range.`); }

  /* ---------- history ---------- */
  const docBytes = value => value.states.reduce((sum, state) => sum + state.frames.reduce((size, frame) => size + Object.values(frame.pixels).reduce((bytes, buffer) => bytes + buffer.byteLength, 0), 0), 0);
  const push = entry => {
    if (grouped) return;
    entry.bytes = entry.kind === 'pixels' ? entry.before.byteLength + entry.after.byteLength : docBytes(entry.before) + docBytes(entry.after);
    history.push(entry); future = [];
    let bytes = history.reduce((sum, item) => sum + item.bytes, 0);
    while (history.length > 1 && (history.length > MAX_HISTORY || bytes > HISTORY_BYTES)) bytes -= history.shift().bytes;
    emit('history');
  };
  function beginStroke(layerId) {
    if (stroke) endStroke();
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
    if (grouped) { const result = fn(doc); assertBudget(doc); clampActive(); return result; }
    if (stroke) endStroke();
    const before = cloneDoc(doc);
    let r;
    try { r = fn(doc); assertBudget(doc); clampActive(); }
    catch (error) { doc = before; emit('doc'); emit('render'); throw error; }
    push({ kind: 'doc', before, after: cloneDoc(doc) });
    emit('doc'); emit('change'); return r;
  }
  function batch(operation) {
    if (grouped) throw new Error('Nested edit batches are not supported.');
    if (stroke) endStroke();
    const before = cloneDoc(doc), previousHistory = [...history], previousFuture = [...future];
    grouped = true;
    try {
      const result = operation();
      if (result && typeof result.then === 'function') throw new Error('An edit batch must be synchronous.');
      assertBudget(doc); clampActive(); grouped = false; stroke = null;
      push({kind:'doc',before,after:cloneDoc(doc)}); emit('doc'); emit('change'); return result;
    } catch (error) {
      grouped = false; doc = before; history = previousHistory; future = previousFuture; stroke = null;
      emit('doc'); emit('render'); emit('history'); throw error;
    }
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
    if (d.layers.length >= 16) throw new Error('A sprite can have at most 16 layers.');
    if (docBytes(d) / d.layers.length * (d.layers.length + 1) > MAX_PIXELS * 4) throw new Error('Adding a layer exceeds the sprite pixel budget.');
    const l = makeLayer(name || `Layer ${d.layers.length + 1}`);
    d.layers.splice(d.activeLayer + 1, 0, l);
    d.states.forEach(s => s.frames.forEach(f => { f.pixels[l.id] = new Uint32Array(d.width * d.height); }));
    d.activeLayer += 1; return l.id;
  });
  const removeLayer = idx => transact(d => {
    checkIndex(idx, d.layers.length, 'Layer');
    if (d.layers.length <= 1) return false;
    const [l] = d.layers.splice(idx, 1);
    d.states.forEach(s => s.frames.forEach(f => { delete f.pixels[l.id]; }));
    if (d.activeLayer >= idx) d.activeLayer = Math.max(0, d.activeLayer - 1); return true;
  });
  const updateLayer = (idx, patch) => transact(d => {
    checkIndex(idx, d.layers.length, 'Layer');
    if (patch.opacity !== undefined && (!Number.isFinite(patch.opacity) || patch.opacity < 0 || patch.opacity > 1)) throw new Error('Opacity must be 0–1.');
    for (const key of ['name','visible','opacity','locked']) if (patch[key] !== undefined) d.layers[idx][key] = key === 'name' ? String(patch[key]).slice(0,120) : patch[key];
  });
  const moveLayer = (idx, dir) => transact(d => {
    checkIndex(idx, d.layers.length, 'Layer');
    const j = idx + dir; if (j < 0 || j >= d.layers.length) return;
    [d.layers[idx], d.layers[j]] = [d.layers[j], d.layers[idx]]; d.activeLayer = j;
  });
  const mergeDown = idx => transact(d => {
    if (idx <= 0) return; const top = d.layers[idx], below = d.layers[idx - 1];
    if (!top || top.locked || below.locked) throw new Error('Unlock both layers before merging.');
    if (!top.visible || !below.visible) throw new Error('Show both layers before merging.');
    d.states.forEach(s => s.frames.forEach(f => {
      const a = f.pixels[below.id], b = f.pixels[top.id];
      for (let i = 0; i < a.length; i++) {
        const bottom = ((Math.round((a[i] >>> 24) * below.opacity) << 24) | (a[i] & 0xffffff)) >>> 0;
        const upper = ((Math.round((b[i] >>> 24) * top.opacity) << 24) | (b[i] & 0xffffff)) >>> 0;
        a[i] = PF.Color.blend(bottom, upper);
      }
      delete f.pixels[top.id];
    }));
    below.opacity = 1;
    d.layers.splice(idx, 1); d.activeLayer = idx - 1;
  });

  const addState = ({ name = 'new-state', fps = 8, frames = 1, copyFrom } = {}) => transact(d => {
    if (d.states.length >= 128) throw new Error('A sprite can have at most 128 states.');
    if (!Number.isInteger(frames) || frames < 1 || frames > 256 || !Number.isFinite(fps) || fps < 1 || fps > 60) throw new Error('Use 1–256 frames and 1–60 FPS.');
    if (d.states.some(state => state.name === name)) throw new Error('State names must be unique.');
    if (typeof name !== 'string' || !name.trim() || name.length > 120) throw new Error('Use a state name of 1–120 characters.');
    if (copyFrom !== undefined) checkIndex(copyFrom, d.states.length, 'State');
    const count = copyFrom === undefined ? frames : d.states[copyFrom].frames.length;
    if (docBytes(d) + count * d.width * d.height * d.layers.length * 4 > MAX_PIXELS * 4) throw new Error('Adding this animation exceeds the sprite pixel budget.');
    const s = makeState(d, name, fps, frames);
    if (copyFrom !== undefined && d.states[copyFrom]) {
      const src = d.states[copyFrom];
      s.frames = src.frames.map(f => ({ id: uid(), duration: f.duration, pixels: clonePixels(f.pixels) }));
    }
    d.states.push(s); d.activeState = d.states.length - 1; d.activeFrame = 0; return d.activeState;
  });
  const removeState = idx => transact(d => { checkIndex(idx, d.states.length, 'State'); if (d.states.length <= 1) return false; d.states.splice(idx, 1); return true; });
  const updateState = (idx, patch) => transact(d => {
    checkIndex(idx, d.states.length, 'State');
    if (patch.name !== undefined && (typeof patch.name !== 'string' || !patch.name.trim() || patch.name.length > 120)) throw new Error('Use a state name of 1–120 characters.');
    if (patch.name && d.states.some((state, index) => index !== idx && state.name === patch.name)) throw new Error('State names must be unique.');
    if (patch.fps !== undefined && (!Number.isFinite(patch.fps) || patch.fps < 1 || patch.fps > 60)) throw new Error('FPS must be between 1 and 60.');
    for (const key of ['name', 'fps', 'loop']) if (patch[key] !== undefined) d.states[idx][key] = patch[key];
    if (patch.fps) d.states[idx].frames.forEach(f => { f.duration = Math.round(1000 / patch.fps); });
  });

  const addFrame = ({ duplicate = true, at } = {}) => transact(d => {
    const s = d.states[d.activeState], i = at ?? d.activeFrame;
    checkIndex(i, s.frames.length, 'Frame');
    if (s.frames.length >= 256) throw new Error('A state can have at most 256 frames.');
    const f = makeFrame(d, s.frames[i]?.duration || Math.round(1000 / s.fps));
    if (duplicate && s.frames[i]) f.pixels = clonePixels(s.frames[i].pixels);
    s.frames.splice(i + 1, 0, f); d.activeFrame = i + 1; return d.activeFrame;
  });
  const removeFrame = idx => transact(d => {
    checkIndex(idx, d.states[d.activeState].frames.length, 'Frame');
    const s = d.states[d.activeState]; if (s.frames.length <= 1) return false;
    s.frames.splice(idx, 1); if (d.activeFrame >= idx) d.activeFrame = Math.max(0, d.activeFrame - 1); return true;
  });
  const moveFrame = (idx, dir) => transact(d => {
    checkIndex(idx, d.states[d.activeState].frames.length, 'Frame');
    const fr = d.states[d.activeState].frames, j = idx + dir; if (j < 0 || j >= fr.length) return;
    [fr[idx], fr[j]] = [fr[j], fr[idx]]; d.activeFrame = j;
  });
  const setFrameDuration = (idx, ms) => transact(d => {
    checkIndex(idx, d.states[d.activeState].frames.length, 'Frame');
    if (!Number.isFinite(ms) || ms < 10 || ms > 60000) throw new Error('Frame duration must be 10–60,000 ms.');
    d.states[d.activeState].frames[idx].duration = Math.round(ms);
  });

  const resize = (w, h, anchor = 'top-left') => transact(d => {
    w = clampSize(w); h = clampSize(h);
    if (docBytes(d) / (d.width * d.height) * w * h > MAX_PIXELS * 4) throw new Error('Resize exceeds the sprite pixel budget.');
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
  const setPalette = colors => transact(d => { d.palette = [...new Set(colors.map(color => PF.Color.u32ToHex(PF.Color.hexToU32(color))).filter(color => color !== 'transparent'))].slice(0,256); });
  const addPaletteColor = hex => { if (!doc.palette.includes(hex)) { if (doc.palette.length >= 256) throw new Error('Palette is full (256 colors).'); setPalette([...doc.palette,hex]); } };
  const rename = name => transact(d => { d.name = String(name || 'untitled').slice(0, 120); });

  /* ---------- serialization ---------- */
  const b64 = u32 => { const u8 = new Uint8Array(u32.buffer, u32.byteOffset, u32.byteLength); let s = '';
    for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); };
  const unb64 = str => { const bin = atob(str), u8 = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i); return new Uint32Array(u8.buffer); };
  const serialize = (value = doc) => JSON.stringify({ ...value, format: 'pixelforge', version: 1,
    states: value.states.map(s => ({ ...s, frames: s.frames.map(f => ({ ...f, pixels: Object.fromEntries(Object.entries(f.pixels).map(([k, v]) => [k, b64(v)])) })) })) });
  function assertBudget(value) {
    if (value.layers.length < 1 || value.layers.length > 16 || value.states.length < 1 || value.states.length > 128) throw new Error('Invalid layer or state count.');
    const count = value.states.reduce((sum, state) => {
      if (!state || !Array.isArray(state.frames) || !state.frames.length || state.frames.length > 256) throw new Error('Use 1–256 frames per state.');
      return sum + state.frames.length;
    }, 0);
    if (count * value.layers.length * value.width * value.height > MAX_PIXELS) throw new Error('Sprite exceeds the 64 MB pixel budget. Split it into smaller assets.');
  }
  function validate(json) {
    if (typeof json === 'string' && json.length > 96 * 1024 * 1024) throw new Error('Sprite file is too large.');
    const raw = typeof json === 'string' ? JSON.parse(json) : json;
    if (!raw || raw.format !== 'pixelforge' || raw.version !== 1) throw new Error('Expected a PixelForge version 1 sprite.');
    for (const key of ['width', 'height']) if (!Number.isInteger(raw[key]) || raw[key] < 1 || raw[key] > 256) throw new Error('Canvas dimensions must be 1–256.');
    if (!Array.isArray(raw.layers) || !Array.isArray(raw.states)) throw new Error('Missing layers or states.');
    assertBudget(raw);
    const ids = new Set();
    const layers = raw.layers.map(value => {
      if (!value || typeof value.id !== 'string' || !/^[a-zA-Z0-9_-]{1,120}$/.test(value.id) || ['__proto__','constructor','prototype'].includes(value.id) || ids.has(value.id)) throw new Error('Invalid or duplicate layer ID.');
      ids.add(value.id);
      if (!Number.isFinite(value.opacity) || value.opacity < 0 || value.opacity > 1) throw new Error('Invalid layer opacity.');
      return {id:value.id,name:String(value.name || 'Layer').slice(0,120),opacity:value.opacity,visible:value.visible !== false,locked:value.locked === true};
    });
    const names = new Set();
    const states = raw.states.map(value => {
      if (typeof value.name !== 'string' || !value.name.length || value.name.length > 120 || names.has(value.name)) throw new Error('State names must be unique and nonempty.');
      names.add(value.name);
      if (!Number.isFinite(value.fps) || value.fps < 1 || value.fps > 60) throw new Error('Invalid animation FPS.');
      return {id:String(value.id || uid()),name:value.name,action:typeof value.action === 'string' ? value.action : undefined,direction:typeof value.direction === 'string' ? value.direction : undefined,fps:value.fps,loop:value.loop !== false,frames:value.frames.map(frame => {
        if (!Number.isInteger(frame.duration) || frame.duration < 10 || frame.duration > 60000 || !frame.pixels) throw new Error('Invalid frame.');
        const pixels = {};
        for (const layer of layers) {
          const buffer = frame.pixels[layer.id];
          if (typeof buffer !== 'string' || buffer.length !== Math.ceil(raw.width * raw.height * 4 / 3) * 4) throw new Error('Invalid pixel buffer length.');
          pixels[layer.id] = unb64(buffer);
          if (pixels[layer.id].length !== raw.width * raw.height) throw new Error('Invalid pixel count.');
        }
        return {id:String(frame.id || uid()),duration:frame.duration,pixels};
      })};
    });
    if (!Array.isArray(raw.palette) || raw.palette.length > 256 || raw.palette.some(value => typeof value !== 'string' || !/^#[0-9a-f]{6}([0-9a-f]{2})?$/i.test(value))) throw new Error('Invalid palette.');
    const active = key => Number.isInteger(raw[key]) ? raw[key] : 0;
    const metadata = raw.metadata && typeof raw.metadata === 'object' ? JSON.parse(JSON.stringify(raw.metadata)) : {};
    if (JSON.stringify(metadata).length > 16000) throw new Error('Metadata is too large.');
    return {id:String(raw.id || uid()),name:String(raw.name || 'Untitled').slice(0,120),width:raw.width,height:raw.height,layers,states,palette:[...raw.palette],color:/^#[0-9a-f]{6}([0-9a-f]{2})?$/i.test(raw.color) ? raw.color : '#b3ed9c',activeState:active('activeState'),activeFrame:active('activeFrame'),activeLayer:active('activeLayer'),metadata};
  }
  function load(json) {
    const next = validate(json);
    doc = next; history = []; future = []; stroke = null; clampActive();
    emit('doc'); emit('change'); emit('history');
  }
  /* Plain summary for agents (no pixel data) */
  const summary = () => ({ name: doc.name, width: doc.width, height: doc.height, color: doc.color, palette: doc.palette,
    activeState: doc.activeState, activeFrame: doc.activeFrame, activeLayer: doc.activeLayer,
    layers: doc.layers.map((l, i) => ({ index: i, ...l })),
    states: doc.states.map((s, i) => ({ index: i, name: s.name, fps: s.fps, loop: s.loop, frames: s.frames.map(f => f.duration) })) });

  return { on, off, emit, DEFAULT_PALETTE, newDoc, get, state, frame, layer, pixels, setActive, setColor, beginStroke, endStroke, cancelStroke,
    transact, batch, undo, redo, canUndo, canRedo, addLayer, removeLayer, updateLayer, moveLayer, mergeDown, addState, removeState, updateState,
    addFrame, removeFrame, moveFrame, setFrameDuration, resize, setPalette, addPaletteColor, rename, serialize, load, validate, summary, cloneDoc };
})();
