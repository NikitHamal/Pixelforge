/* PixelForge Studio — non-destructive pixel effects.
   Every function takes (buf, w, h, opts) and returns a NEW Uint32Array of the
   same length, so effects chain freely and nothing mutates the document until
   the caller commits. No DOM: shared by the studio, the CLI and the tests. */
window.PF = window.PF || {};
PF.Effects = (() => {
  const C = h => (typeof h === 'number' ? h : PF.Color.hexToU32(h));
  const A = v => v >>> 24, Rb = v => v & 255, Gb = v => (v >> 8) & 255, Bb = v => (v >> 16) & 255;
  const pack = PF.Color.fromRGBA;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const cp = buf => Uint32Array.from(buf);
  /* Linear mix toward `to`, keeping the source alpha. PF.Color.blend is an
     alpha compositor, not a lerp, so it cannot express "60% of the way". */
  const mix = (v, to, t) => {
    const k = clamp(t, 0, 1);
    return pack(Math.round(Rb(v) + (Rb(to) - Rb(v)) * k), Math.round(Gb(v) + (Gb(to) - Gb(v)) * k),
      Math.round(Bb(v) + (Bb(to) - Bb(v)) * k), A(v));
  };

  /* ---- silhouette ---- */
  // Outline written into transparent neighbours (outer) or over the sprite's
  // own border pixels (inner) — inner keeps the sprite inside its cell, which
  // matters when the art already touches the canvas edge.
  function outline(buf, w, h, opts = {}) {
    const c = C(opts.color || '#181425');
    if (opts.inner) {
      const out = cp(buf);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const i = y * w + x; if (!buf[i]) continue;
        const bare = (x === 0 || !buf[i - 1]) || (x === w - 1 || !buf[i + 1]) || (y === 0 || !buf[i - w]) || (y === h - 1 || !buf[i + w]);
        if (bare) out[i] = c;
      }
      return out;
    }
    return PF.Raster.outline(buf, w, h, c, !!opts.diagonal);
  }

  /* Soft glow: alpha falls off with distance, computed by repeated dilation so
     the cost is O(radius * pixels) with no float blur pass. */
  function glow(buf, w, h, opts = {}) {
    const radius = Math.max(1, opts.radius || 2), c = C(opts.color || '#2ce8f5');
    const strength = opts.strength === undefined ? 0.75 : opts.strength;
    const field = new Float32Array(w * h);
    for (let i = 0; i < buf.length; i++) if (buf[i]) field[i] = 1;
    let cur = field;
    for (let step = 0; step < radius; step++) {
      const next = Float32Array.from(cur);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const i = y * w + x;
        let m = cur[i];
        if (x > 0) m = Math.max(m, cur[i - 1]); if (x < w - 1) m = Math.max(m, cur[i + 1]);
        if (y > 0) m = Math.max(m, cur[i - w]); if (y < h - 1) m = Math.max(m, cur[i + w]);
        next[i] = Math.max(cur[i], m * (1 - 1 / (radius + 1)));
      }
      cur = next;
    }
    const out = cp(buf);
    for (let i = 0; i < out.length; i++) {
      if (buf[i] || cur[i] <= 0.02) continue;
      out[i] = pack(Rb(c), Gb(c), Bb(c), clamp(Math.round(cur[i] * 255 * strength), 0, 255));
    }
    return out;
  }

  function dropShadow(buf, w, h, opts = {}) {
    const dx = opts.dx === undefined ? 1 : opts.dx, dy = opts.dy === undefined ? 2 : opts.dy;
    const c = C(opts.color || '#181425'), alpha = opts.alpha === undefined ? 0.5 : opts.alpha;
    const sc = pack(Rb(c), Gb(c), Bb(c), clamp(Math.round(alpha * 255), 0, 255));
    const out = new Uint32Array(buf.length);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x; if (!buf[i]) continue;
      const nx = x + dx, ny = y + dy;
      if (nx >= 0 && nx < w && ny >= 0 && ny < h) out[ny * w + nx] = sc;
    }
    for (let i = 0; i < buf.length; i++) if (buf[i]) out[i] = buf[i];
    return out;
  }

  /* Bevel: lights the top-left border pixels and shades the bottom-right ones.
     Reads as embossed metal or a raised UI panel in one pass. */
  function bevel(buf, w, h, opts = {}) {
    const light = C(opts.light || '#ffffff'), dark = C(opts.dark || '#181425');
    const amt = opts.amount === undefined ? 1 : opts.amount;
    const out = cp(buf);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x; if (!buf[i]) continue;
      const up = y > 0 && buf[i - w], lf = x > 0 && buf[i - 1];
      const dn = y < h - 1 && buf[i + w], rt = x < w - 1 && buf[i + 1];
      if (!up || !lf) out[i] = mix(buf[i], light, amt * (!up && !lf ? 1 : 0.6));
      else if (!dn || !rt) out[i] = mix(buf[i], dark, amt * (!dn && !rt ? 0.85 : 0.5));
    }
    return out;
  }

  /* ---- colour ---- */
  const perPixel = fn => (buf, w, h, opts = {}) => {
    const out = new Uint32Array(buf.length);
    for (let i = 0; i < buf.length; i++) { const v = buf[i]; out[i] = v ? fn(v, opts, i, w) : 0; }
    return out;
  };
  const hueShift = perPixel((v, o) => {
    const [r, g, b, a] = PF.Color.rgba(v), [hh, s, l] = PF.Palette.toHsl(PF.Color.u32ToHex(pack(r, g, b, 255)));
    const nh = PF.Palette.fromHsl(hh + (o.hue || 0), clamp(s * (o.sat === undefined ? 1 : o.sat), 0, 1), clamp(l + (o.light || 0), 0, 1));
    const [nr, ng, nb] = PF.Color.rgba(C(nh));
    return pack(nr, ng, nb, a);
  });
  const brightness = perPixel((v, o) => {
    const k = o.amount === undefined ? 0.1 : o.amount;
    return pack(clamp(Math.round(Rb(v) + 255 * k), 0, 255), clamp(Math.round(Gb(v) + 255 * k), 0, 255), clamp(Math.round(Bb(v) + 255 * k), 0, 255), A(v));
  });
  const contrast = perPixel((v, o) => {
    const k = o.amount === undefined ? 0.2 : o.amount, f = (259 * (k * 255 + 255)) / (255 * (259 - k * 255));
    const g = c => clamp(Math.round(f * (c - 128) + 128), 0, 255);
    return pack(g(Rb(v)), g(Gb(v)), g(Bb(v)), A(v));
  });
  const grayscale = perPixel(v => { const l = clamp(Math.round(PF.Color.luma(v)), 0, 255); return pack(l, l, l, A(v)); });
  const tint = perPixel((v, o) => mix(v, C(o.color || '#ff8d7a'), o.amount === undefined ? 0.35 : o.amount));
  const posterize = perPixel((v, o) => {
    const n = Math.max(2, o.levels || 4), step = 255 / (n - 1);
    const q = c => clamp(Math.round(Math.round(c / step) * step), 0, 255);
    return pack(q(Rb(v)), q(Gb(v)), q(Bb(v)), A(v));
  });
  const invert = perPixel(v => pack(255 - Rb(v), 255 - Gb(v), 255 - Bb(v), A(v)));

  /* Ordered dither between a colour and transparency — the pixel-art fade. */
  function ditherFade(buf, w, h, opts = {}) {
    const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
    const t = opts.amount === undefined ? 0.5 : opts.amount, out = new Uint32Array(buf.length);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x; if (!buf[i]) continue;
      if (BAYER[(y & 3) * 4 + (x & 3)] / 16 < t) out[i] = buf[i];
    }
    return out;
  }

  /* ---- geometry ---- */
  function trim(buf, w, h) {
    const b = PF.Raster.bounds(buf, w, h); // { x, y, w, h } or null when empty
    if (!b) return { pixels: new Uint32Array(0), width: 0, height: 0, x: 0, y: 0 };
    const out = new Uint32Array(b.w * b.h);
    for (let y = 0; y < b.h; y++) out.set(buf.subarray((b.y + y) * w + b.x, (b.y + y) * w + b.x + b.w), y * b.w);
    return { pixels: out, width: b.w, height: b.h, x: b.x, y: b.y };
  }
  function pad(buf, w, h, opts = {}) {
    const p = opts.padding || 1, nw = w + p * 2, nh = h + p * 2, out = new Uint32Array(nw * nh);
    for (let y = 0; y < h; y++) out.set(buf.subarray(y * w, y * w + w), (y + p) * nw + p);
    return { pixels: out, width: nw, height: nh };
  }
  function scale(buf, w, h, opts = {}) {
    const k = Math.max(1, Math.round(opts.factor || 2)), nw = w * k, nh = h * k, out = new Uint32Array(nw * nh);
    for (let y = 0; y < nh; y++) { const sy = (y / k) | 0; for (let x = 0; x < nw; x++) out[y * nw + x] = buf[sy * w + ((x / k) | 0)]; }
    return { pixels: out, width: nw, height: nh };
  }
  /* Nearest-neighbour resample to an arbitrary size (down or up). */
  function resize(buf, w, h, opts = {}) {
    const nw = Math.max(1, Math.round(opts.width || w)), nh = Math.max(1, Math.round(opts.height || h));
    const out = new Uint32Array(nw * nh);
    for (let y = 0; y < nh; y++) { const sy = Math.min(h - 1, Math.floor(y * h / nh)); for (let x = 0; x < nw; x++) out[y * nw + x] = buf[sy * w + Math.min(w - 1, Math.floor(x * w / nw))]; }
    return { pixels: out, width: nw, height: nh };
  }

  /* Tangent-space normal map from the alpha silhouette: enough to light a
     sprite in a 2D engine that supports normal maps (Godot, Unity URP). */
  function normalMap(buf, w, h, opts = {}) {
    const strength = opts.strength === undefined ? 1 : opts.strength;
    const height = new Float32Array(w * h);
    // Inner distance field: how far a pixel sits from the silhouette edge.
    for (let i = 0; i < buf.length; i++) height[i] = buf[i] ? 1 : 0;
    for (let pass = 0; pass < (opts.depth || 3); pass++) {
      const next = Float32Array.from(height);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const i = y * w + x; if (!buf[i]) continue;
        let m = 1;
        if (x > 0) m = Math.min(m, height[i - 1]); if (x < w - 1) m = Math.min(m, height[i + 1]);
        if (y > 0) m = Math.min(m, height[i - w]); if (y < h - 1) m = Math.min(m, height[i + w]);
        next[i] = Math.min(1, height[i] + m * 0.5);
      }
      height.set(next);
    }
    const out = new Uint32Array(buf.length);
    const at = (x, y) => (x < 0 || y < 0 || x >= w || y >= h) ? 0 : height[y * w + x];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x; if (!buf[i]) continue;
      const dx = (at(x - 1, y) - at(x + 1, y)) * strength, dy = (at(x, y - 1) - at(x, y + 1)) * strength;
      const len = Math.hypot(dx, dy, 1);
      out[i] = pack(clamp(Math.round((dx / len * 0.5 + 0.5) * 255), 0, 255), clamp(Math.round((-dy / len * 0.5 + 0.5) * 255), 0, 255), clamp(Math.round((1 / len * 0.5 + 0.5) * 255), 0, 255), 255);
    }
    return out;
  }

  /* Flat colour silhouette — hit flashes, shadow blobs, selection masks. */
  const silhouette = (buf, w, h, opts = {}) => {
    const c = C(opts.color || '#ffffff'), out = new Uint32Array(buf.length);
    for (let i = 0; i < buf.length; i++) if (buf[i]) out[i] = c;
    return out;
  };

  /* A registry so UIs can enumerate effects without hard-coding a list. */
  const LIST = [
    { id: 'outline', name: 'Outline', run: outline, opts: { color: '#181425', diagonal: false, inner: false } },
    { id: 'glow', name: 'Glow', run: glow, opts: { color: '#2ce8f5', radius: 2, strength: 0.75 } },
    { id: 'shadow', name: 'Drop shadow', run: dropShadow, opts: { dx: 1, dy: 2, color: '#181425', alpha: 0.5 } },
    { id: 'bevel', name: 'Bevel', run: bevel, opts: { light: '#ffffff', dark: '#181425', amount: 1 } },
    { id: 'hue', name: 'Hue / sat / light', run: hueShift, opts: { hue: 0.05, sat: 1, light: 0 } },
    { id: 'brightness', name: 'Brightness', run: brightness, opts: { amount: 0.1 } },
    { id: 'contrast', name: 'Contrast', run: contrast, opts: { amount: 0.2 } },
    { id: 'grayscale', name: 'Grayscale', run: grayscale, opts: {} },
    { id: 'tint', name: 'Tint', run: tint, opts: { color: '#ff8d7a', amount: 0.35 } },
    { id: 'posterize', name: 'Posterize', run: posterize, opts: { levels: 4 } },
    { id: 'invert', name: 'Invert', run: invert, opts: {} },
    { id: 'dither', name: 'Dither fade', run: ditherFade, opts: { amount: 0.5 } },
    { id: 'silhouette', name: 'Silhouette', run: silhouette, opts: { color: '#ffffff' } },
    { id: 'normal', name: 'Normal map', run: normalMap, opts: { strength: 1, depth: 3 } }
  ];
  const apply = (id, buf, w, h, opts) => {
    const e = LIST.find(x => x.id === id);
    if (!e) throw new Error(`Unknown effect "${id}". Use: ${LIST.map(x => x.id).join(', ')}`);
    return e.run(buf, w, h, Object.assign({}, e.opts, opts || {}));
  };
  /* chain(buf, w, h, [['glow',{radius:3}], ['outline',{}]]) */
  const chain = (buf, w, h, steps) => steps.reduce((acc, [id, opts]) => apply(id, acc, w, h, opts), buf);

  return { LIST, apply, chain, outline, glow, dropShadow, bevel, hueShift, brightness, contrast,
    grayscale, tint, posterize, invert, ditherFade, silhouette, normalMap, trim, pad, scale, resize };
})();
