/* Runefall — sprite baker: turns PF.Library template painters into runtime
   canvas frames. Single-layer docs assumed (true for every game asset). */
window.RF = window.RF || {};
RF.Sprites = (() => {
  const cache = new Map(); // id -> { w, h, states: { name: { fps, loop, frames: [canvas] } } }
  const whiteCache = new Map(); // canvas -> white silhouette canvas

  function bake(id) {
    if (cache.has(id)) return cache.get(id);
    const t = PF.Library.get(id);
    if (!t) return null;
    let doc;
    try { doc = t.build(); } catch { return null; }
    const out = { w: doc.width, h: doc.height, states: {} };
    for (const s of doc.states) {
      const frames = [];
      for (const f of s.frames) {
        const cv = document.createElement('canvas');
        cv.width = doc.width; cv.height = doc.height;
        const ctx = cv.getContext('2d');
        const img = ctx.createImageData(doc.width, doc.height);
        const buf = new Uint32Array(img.data.buffer);
        try {
          const painter = f.layers ? f.layers[0] : f.paint;
          if (typeof painter === 'function') painter(buf, doc.width, doc.height);
          else if (painter) buf.set(painter);
        } catch { /* keep blank frame */ }
        ctx.putImageData(img, 0, 0);
        frames.push(cv);
      }
      out.states[s.name] = { fps: s.fps || 8, loop: s.loop !== false, frames };
    }
    cache.set(id, out);
    return out;
  }

  /* Resolve with graceful fallbacks: state -> first state; empty -> null. */
  function frames(id, state) {
    const b = bake(id);
    if (!b) return null;
    const st = b.states[state] || b.states[Object.keys(b.states)[0]];
    return st ? { ...st, w: b.w, h: b.h } : null;
  }
  function frame(id, state, i) {
    const f = frames(id, state);
    if (!f || !f.frames.length) return null;
    return { cv: f.frames[Math.abs(i) % f.frames.length], w: f.w, h: f.h, fps: f.fps, loop: f.loop, count: f.frames.length };
  }
  function dataURL(id, state = null, i = 0, scale = 3) {
    const f = frame(id, state || Object.keys(bake(id)?.states || {})[0] || '', i);
    if (!f) return '';
    const c = document.createElement('canvas');
    c.width = f.w * scale; c.height = f.h * scale;
    const x = c.getContext('2d'); x.imageSmoothingEnabled = false;
    x.drawImage(f.cv, 0, 0, c.width, c.height);
    return c.toDataURL('image/png');
  }
  /* White silhouette for hurt flashes (cached per source canvas). */
  function white(cv) {
    if (whiteCache.has(cv)) return whiteCache.get(cv);
    const c = document.createElement('canvas');
    c.width = cv.width; c.height = cv.height;
    const x = c.getContext('2d');
    x.drawImage(cv, 0, 0);
    x.globalCompositeOperation = 'source-in';
    x.fillStyle = '#fff';
    x.fillRect(0, 0, c.width, c.height);
    whiteCache.set(cv, c);
    return c;
  }
  /* Slice a tileset frame (e.g. 64x64 sheet of 16px tiles) into tile canvases. */
  function sliceTiles(id, state, tile, count, perRow) {
    const f = frame(id, state, 0);
    if (!f) return [];
    const out = [];
    for (let k = 0; k < count; k++) {
      const c = document.createElement('canvas');
      c.width = c.height = tile;
      c.getContext('2d').drawImage(f.cv, (k % perRow) * tile, Math.floor(k / perRow) * tile, tile, tile, 0, 0, tile, tile);
      out.push(c);
    }
    return out;
  }
  return { bake, frames, frame, dataURL, white, sliceTiles };
})();
