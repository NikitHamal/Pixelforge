/* Shared sprite baker for the demo games: turns PF.Library template painters
   into runtime <canvas> frames once, then hands them out by (id, state).

   Runefall carries its own copy because it predates this file and bakes into a
   slightly different shape; anything new should use this one. */
window.GB = (() => {
  const cache = new Map();          // id -> { w, h, states }
  const tinted = new Map();         // canvas -> Map(colour -> canvas)

  function bake(id) {
    if (cache.has(id)) return cache.get(id);
    const t = PF.Library.get(id);
    if (!t) { cache.set(id, null); return null; }
    let doc;
    try { doc = t.build(); } catch { cache.set(id, null); return null; }
    const out = { w: doc.width, h: doc.height, states: {}, order: [] };
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
        } catch { /* a blank frame beats a dead game */ }
        ctx.putImageData(img, 0, 0);
        frames.push(cv);
      }
      out.states[s.name] = { fps: s.fps || 8, loop: s.loop !== false, frames, name: s.name };
      out.order.push(s.name);
    }
    cache.set(id, out);
    return out;
  }

  /* Falls back to the template's first state rather than returning nothing —
     a missing state should cost you the right pose, not the whole entity. */
  function state(id, name) {
    const b = bake(id);
    if (!b) return null;
    return b.states[name] || b.states[b.order[0]] || null;
  }

  function frame(id, name, i) {
    const b = bake(id), st = state(id, name);
    if (!st || !st.frames.length) return null;
    const n = st.frames.length;
    const k = st.loop ? ((i % n) + n) % n : Math.min(n - 1, Math.max(0, i | 0));
    return { cv: st.frames[k], w: b.w, h: b.h, fps: st.fps, count: n, loop: st.loop };
  }

  /* Frame index from elapsed seconds, so callers never track their own clock. */
  function at(id, name, t) {
    const st = state(id, name);
    if (!st) return null;
    return frame(id, name, Math.floor(t * st.fps));
  }

  /* Re-colour a baked frame through source-in. Used for hit flashes and for
     team-tinting one template into several enemy types. */
  function tint(cv, colour, alpha) {
    let m = tinted.get(cv);
    if (!m) { m = new Map(); tinted.set(cv, m); }
    const key = colour + '|' + (alpha || 1);
    if (m.has(key)) return m.get(key);
    const c = document.createElement('canvas');
    c.width = cv.width; c.height = cv.height;
    const x = c.getContext('2d');
    x.drawImage(cv, 0, 0);
    x.globalCompositeOperation = 'source-in';
    x.globalAlpha = alpha === undefined ? 1 : alpha;
    x.fillStyle = colour;
    x.fillRect(0, 0, c.width, c.height);
    m.set(key, c);
    return c;
  }

  /* Slice a packed tile sheet (e.g. td_tiles: 16 tiles of 16px, 4 per row). */
  function sliceTiles(id, name, tile, count, perRow) {
    const f = frame(id, name, 0);
    if (!f) return [];
    const out = [];
    for (let k = 0; k < count; k++) {
      const c = document.createElement('canvas');
      c.width = c.height = tile;
      c.getContext('2d').drawImage(f.cv, (k % perRow) * tile, Math.floor(k / perRow) * tile,
        tile, tile, 0, 0, tile, tile);
      out.push(c);
    }
    return out;
  }

  /* One canvas holding a state's frames side by side — handy for menus. */
  function dataURL(id, name, i, scale) {
    const f = frame(id, name, i || 0);
    if (!f) return '';
    const c = document.createElement('canvas');
    const s = scale || 3;
    c.width = f.w * s; c.height = f.h * s;
    const x = c.getContext('2d');
    x.imageSmoothingEnabled = false;
    x.drawImage(f.cv, 0, 0, c.width, c.height);
    return c.toDataURL('image/png');
  }

  return { bake, state, frame, at, tint, sliceTiles, dataURL };
})();
