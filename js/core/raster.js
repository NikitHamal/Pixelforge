/* PixelForge Studio — Raster engine: color helpers + pixel algorithms on Uint32Array buffers */
window.PF = window.PF || {};

PF.Color = (() => {
  const fromRGBA = (r, g, b, a = 255) => ((a << 24) | (b << 16) | (g << 8) | r) >>> 0;
  /* Hex -> u32 is the single most-called function in the engine (once per pixel
     per draw call). Palettes are tiny and highly repetitive, so memoise every
     parse behind a Map: repeat lookups drop from ~180ns of string work to a
     single hash probe. */
  const hexCache = new Map();
  const HEX6 = /^[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/;
  function parseHex(hex) {
    if (hex === undefined || hex === null || hex === '' || hex === 'transparent' || hex === 'none') return 0;
    let h = String(hex).trim();
    if (h.charCodeAt(0) === 35) h = h.slice(1);
    if (h.length === 3 || h.length === 4) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2] + (h.length === 4 ? h[3] + h[3] : '');
    if (!HEX6.test(h)) return 0;
    const n = parseInt(h.slice(0, 6), 16), a = h.length === 8 ? parseInt(h.slice(6, 8), 16) : 255;
    return fromRGBA(n >> 16, (n >> 8) & 255, n & 255, a);
  }
  const hexToU32 = hex => {
    if (typeof hex === 'number') return hex >>> 0;
    if (typeof hex !== 'string') return parseHex(hex);
    const hit = hexCache.get(hex);
    if (hit !== undefined) return hit;
    const v = parseHex(hex);
    if (hexCache.size < 8192) hexCache.set(hex, v); // bounded: arbitrary user input can't grow it forever
    return v;
  };
  const u32ToHex = v => {
    if (!v) return 'transparent';
    const h = x => x.toString(16).padStart(2, '0'), a = v >>> 24;
    return '#' + h(v & 255) + h((v >> 8) & 255) + h((v >> 16) & 255) + (a === 255 ? '' : h(a));
  };
  const rgba = v => [v & 255, (v >> 8) & 255, (v >> 16) & 255, v >>> 24];
  const blend = (dst, src) => {
    const sa = src >>> 24; if (sa === 255 || !dst) return src; if (!sa) return dst;
    const da = dst >>> 24, ia = (255 - sa) / 255, a = sa + da * ia;
    const ch = sh => Math.round((((src >>> sh) & 255) * sa + ((dst >>> sh) & 255) * da * ia) / a);
    return fromRGBA(ch(0), ch(8), ch(16), Math.round(a));
  };
  const shade = (v, amt) => { const [r, g, b, a] = rgba(v), f = x => Math.max(0, Math.min(255, Math.round(x + amt))); return fromRGBA(f(r), f(g), f(b), a); };
  const luma = v => (0.299 * (v & 255) + 0.587 * ((v >> 8) & 255) + 0.114 * ((v >> 16) & 255));
  return { fromRGBA, hexToU32, u32ToHex, rgba, blend, shade, luma };
})();

PF.Raster = (() => {
  const inb = (w, h, x, y) => x >= 0 && y >= 0 && x < w && y < h;
  const set = (p, w, h, x, y, c) => { if (inb(w, h, x, y)) p[y * w + x] = c; };
  const get = (p, w, h, x, y) => inb(w, h, x, y) ? p[y * w + x] : 0;

  /* Square brush stamp with optional symmetry.
     Fast path for the overwhelmingly common 1px, no-symmetry case skips the
     dy/dx loop and the four symmetry branches entirely. */
  function stamp(p, w, h, x, y, c, size = 1, mx = false, my = false) {
    if (size === 1 && !mx && !my) { if (x >= 0 && y >= 0 && x < w && y < h) p[y * w + x] = c; return; }
    const o = (size - 1) >> 1;
    for (let dy = 0; dy < size; dy++) for (let dx = 0; dx < size; dx++) {
      const px = x - o + dx, py = y - o + dy;
      set(p, w, h, px, py, c);
      if (mx) set(p, w, h, w - 1 - px, py, c);
      if (my) set(p, w, h, px, h - 1 - py, c);
      if (mx && my) set(p, w, h, w - 1 - px, h - 1 - py, c);
    }
  }
  /* Bresenham line */
  function line(p, w, h, x0, y0, x1, y1, c, size = 1, mx = false, my = false) {
    let dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1, err = dx + dy;
    for (;;) {
      stamp(p, w, h, x0, y0, c, size, mx, my);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  }
  function rect(p, w, h, x0, y0, x1, y1, c, { fill = false, size = 1, mx = false, my = false } = {}) {
    const l = Math.min(x0, x1), r = Math.max(x0, x1), t = Math.min(y0, y1), b = Math.max(y0, y1);
    if (fill) {
      // Plain fill: clip once, then write rows directly instead of bounds-checking per pixel.
      if (!mx && !my) {
        const cl = l < 0 ? 0 : l, cr = r >= w ? w - 1 : r, ct = t < 0 ? 0 : t, cb = b >= h ? h - 1 : b;
        for (let y = ct; y <= cb; y++) { const row = y * w; for (let x = cl; x <= cr; x++) p[row + x] = c; }
        return;
      }
      for (let y = t; y <= b; y++) for (let x = l; x <= r; x++) stamp(p, w, h, x, y, c, 1, mx, my); return;
    }
    line(p, w, h, l, t, r, t, c, size, mx, my); line(p, w, h, l, b, r, b, c, size, mx, my);
    line(p, w, h, l, t, l, b, c, size, mx, my); line(p, w, h, r, t, r, b, c, size, mx, my);
  }
  /* Midpoint ellipse inside bounding box (Zingl) */
  function ellipse(p, w, h, x0, y0, x1, y1, c, { fill = false, size = 1, mx = false, my = false } = {}) {
    let a = Math.abs(x1 - x0), b = Math.abs(y1 - y0), b1 = b & 1;
    let dx = 4 * (1 - a) * b * b, dy = 4 * (b1 + 1) * a * a, err = dx + dy + b1 * a * a, e2;
    if (x0 > x1) { x0 = x1; x1 += a; } if (y0 > y1) y0 = y1;
    y0 += (b + 1) >> 1; y1 = y0 - b1; a *= 8 * a; b1 = 8 * b * b;
    const pt = (x, y) => stamp(p, w, h, x, y, c, size, mx, my);
    const hl = (xa, xb, y) => { for (let x = xa; x <= xb; x++) stamp(p, w, h, x, y, c, 1, mx, my); };
    do {
      if (fill) { hl(x0, x1, y0); hl(x0, x1, y1); } else { pt(x1, y0); pt(x0, y0); pt(x0, y1); pt(x1, y1); }
      e2 = 2 * err;
      if (e2 <= dy) { y0++; y1--; err += dy += a; }
      if (e2 >= dx || 2 * err > dy) { x0++; x1--; err += dx += b1; }
    } while (x0 <= x1);
    while (y0 - y1 < b) {
      if (fill) { hl(x0 - 1, x1 + 1, y0); hl(x0 - 1, x1 + 1, y1); } else { pt(x0 - 1, y0); pt(x1 + 1, y0); pt(x0 - 1, y1); pt(x1 + 1, y1); }
      y0++; y1--;
    }
  }
  /* Scanline flood fill (contiguous) or global color replace */
  function fill(p, w, h, x, y, c, contiguous = true) {
    if (!inb(w, h, x, y)) return; const target = p[y * w + x]; if (target === c) return;
    if (!contiguous) { for (let i = 0; i < p.length; i++) if (p[i] === target) p[i] = c; return; }
    const stack = [x, y];
    while (stack.length) {
      const cy = stack.pop(), cx = stack.pop();
      if (p[cy * w + cx] !== target) continue;
      let lx = cx, rx = cx;
      while (lx > 0 && p[cy * w + lx - 1] === target) lx--;
      while (rx < w - 1 && p[cy * w + rx + 1] === target) rx++;
      let up = false, down = false;
      for (let i = lx; i <= rx; i++) {
        p[cy * w + i] = c;
        if (cy > 0) { const t = p[(cy - 1) * w + i] === target; if (t && !up) { stack.push(i, cy - 1); up = true; } else if (!t) up = false; }
        if (cy < h - 1) { const t = p[(cy + 1) * w + i] === target; if (t && !down) { stack.push(i, cy + 1); down = true; } else if (!t) down = false; }
      }
    }
  }
  /* Whole-buffer transforms (return new buffers) */
  const flipH = (p, w, h) => { const o = new Uint32Array(p.length); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) o[y * w + (w - 1 - x)] = p[y * w + x]; return o; };
  const flipV = (p, w, h) => { const o = new Uint32Array(p.length); for (let y = 0; y < h; y++) o.set(p.subarray(y * w, y * w + w), (h - 1 - y) * w); return o; };
  /* Mirror src into a pre-allocated dst. Sprite frames are painted then
     mirrored per animation tick, so the allocating flipH above is the wrong
     tool here — this one keeps the hot path allocation-free. */
  function mirrorInto(src, dst, w, h) {
    for (let y = 0; y < h; y++) {
      const row = y * w;
      for (let x = 0; x < w; x++) dst[row + x] = src[row + (w - 1 - x)];
    }
    return dst;
  }
  const rotate90 = (p, w, h) => { const o = new Uint32Array(p.length); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) o[x * h + (h - 1 - y)] = p[y * w + x]; return o; };
  function shift(p, w, h, dx, dy, wrap = false) {
    const o = new Uint32Array(p.length);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      let tx = x + dx, ty = y + dy;
      if (wrap) { tx = ((tx % w) + w) % w; ty = ((ty % h) + h) % h; } else if (!inb(w, h, tx, ty)) continue;
      o[ty * w + tx] = p[y * w + x];
    }
    return o;
  }
  /* 1px outline around opaque pixels (writes into transparent neighbours).
     Runs once per rendered frame for every sprite, so the neighbour test is
     fully inlined: no get() calls, no per-pixel array allocation, no bounds
     function — just four (or eight) direct indexed reads off the row offsets. */
  function outline(p, w, h, c, diagonal = false) {
    const o = p.slice();
    const wm1 = w - 1, hm1 = h - 1;
    for (let y = 0; y < h; y++) {
      const row = y * w, up = row - w, down = row + w;
      const hasUp = y > 0, hasDown = y < hm1;
      for (let x = 0; x < w; x++) {
        const i = row + x;
        if (p[i]) continue;
        const hasL = x > 0, hasR = x < wm1;
        if ((hasL && p[i - 1]) || (hasR && p[i + 1]) || (hasUp && p[up + x]) || (hasDown && p[down + x])) { o[i] = c; continue; }
        if (!diagonal) continue;
        if ((hasL && hasUp && p[up + x - 1]) || (hasR && hasUp && p[up + x + 1]) ||
            (hasL && hasDown && p[down + x - 1]) || (hasR && hasDown && p[down + x + 1])) o[i] = c;
      }
    }
    return o;
  }
  /* Selective outline: same silhouette pass as outline(), but outline pixels
     sitting on a top edge are recoloured to a light rim (Tiny-style volume).
     ADDITIVE — outline() above is untouched, so every existing sprite renders
     byte-identically unless it opts into this. */
  function outlineSelective(p, w, h, c, opts = {}) {
    const base = outline(p, w, h, c, opts.diagonal);
    const lightHex = opts.light || opts.top;
    if (!lightHex) return base;
    const light = PF.Color.hexToU32(lightHex);
    if (!light || light === c) return base;
    for (let y = 0; y < h; y++) {
      const row = y * w, hasBelow = y + 1 < h, hasAbove = y > 0;
      for (let x = 0; x < w; x++) {
        const i = row + x;
        if (base[i] !== c || p[i]) continue; // outline-only pixels
        const below = hasBelow ? p[i + w] : 0, above = hasAbove ? p[i - w] : 0;
        if (below && !above) base[i] = light; // top-facing rim
      }
    }
    return base;
  }
  const replaceColor = (p, from, to) => { for (let i = 0; i < p.length; i++) if (p[i] === from) p[i] = to; };
  /* Compile a palette once, then remap whole frames without reparsing colours.
     `mapping` accepts Map, object, or [from,to][]; hex and u32 can be mixed.
     Unknown colours and transparency are preserved. `out` enables an
     allocation-free hot path for games that recolour every animation tick. */
  const compiledPalettes = new WeakSet();
  function compilePalette(mapping) {
    const entries = mapping instanceof Map ? [...mapping] : Array.isArray(mapping) ? mapping : Object.entries(mapping || {});
    const map = new Map();
    for (const [from, to] of entries) {
      const source = PF.Color.hexToU32(from);
      if (source) map.set(source, PF.Color.hexToU32(to)); // transparency is structural, never a palette colour
    }
    compiledPalettes.add(map);
    return map;
  }
  function remapPalette(src, mapping, out) {
    const map = compiledPalettes.has(mapping) ? mapping : compilePalette(mapping);
    const dst = out || new Uint32Array(src.length);
    if (dst.length !== src.length) throw new RangeError('palette output length must match source');
    for (let i = 0; i < src.length; i++) dst[i] = map.get(src[i]) ?? src[i];
    return dst;
  }
  /* Region shading (lighten/darken) */
  function shadeRegion(p, w, h, x0, y0, x1, y1, amt) {
    const l = Math.max(0, Math.min(x0, x1)), r = Math.min(w - 1, Math.max(x0, x1)), t = Math.max(0, Math.min(y0, y1)), b = Math.min(h - 1, Math.max(y0, y1));
    for (let y = t; y <= b; y++) for (let x = l; x <= r; x++) { const i = y * w + x; if (p[i]) p[i] = PF.Color.shade(p[i], amt); }
  }
  /* Alpha-composite visible layers (bottom → top) into `out`.
     Sprite pixels are nearly always fully opaque, so the blend call is only
     reached for genuinely translucent pixels; the opaque case is a plain
     assign. `out.fill(0)` is skipped when there is nothing to composite. */
  function composite(out, layers) {
    out.fill(0);
    const len = out.length;
    for (const l of layers) {
      if (!l.visible || !l.pixels) continue;
      const src = l.pixels, op = l.opacity ?? 1;
      if (op >= 1) {
        for (let i = 0; i < len; i++) {
          const s = src[i]; if (!s) continue;
          const d = out[i];
          out[i] = (!d || (s >>> 24) === 255) ? s : PF.Color.blend(d, s);
        }
      } else {
        for (let i = 0; i < len; i++) {
          const s0 = src[i]; if (!s0) continue;
          const s = ((s0 & 0xffffff) | (Math.round((s0 >>> 24) * op) << 24)) >>> 0;
          const d = out[i];
          out[i] = (!d || (s >>> 24) === 255) ? s : PF.Color.blend(d, s);
        }
      }
    }
  }
  /* Bounding box of non-transparent pixels */
  function bounds(p, w, h) {
    let l = w, r = -1, t = h, b = -1;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (p[y * w + x]) { if (x < l) l = x; if (x > r) r = x; if (y < t) t = y; if (y > b) b = y; }
    return r < 0 ? null : { x: l, y: t, w: r - l + 1, h: b - t + 1 };
  }
  /* Paint ASCII rows (agent-friendly). legend: {char: hex}. '.' or ' ' = skip */
  function paintRows(p, w, h, rows, legend, ox = 0, oy = 0) {
    const map = {}; for (const k in legend) map[k] = PF.Color.hexToU32(legend[k]);
    let count = 0;
    rows.forEach((row, y) => { for (let x = 0; x < row.length; x++) { const ch = row[x]; if (ch === '.' || ch === ' ') continue;
      const c = map[ch]; if (c === undefined) continue; set(p, w, h, ox + x, oy + y, c); count++; } });
    return count;
  }
  /* Read buffer as rows of hex ('.' transparent) */
  const toRows = (p, w, h) => { const rows = []; for (let y = 0; y < h; y++) { const r = []; for (let x = 0; x < w; x++) { const v = p[y * w + x]; r.push(v ? PF.Color.u32ToHex(v) : '.'); } rows.push(r.join(' ')); } return rows; };
  /* Unique colors */
  const colorsOf = p => { const s = new Set(); for (let i = 0; i < p.length; i++) if (p[i]) s.add(p[i]); return [...s]; };

  return { set, get, stamp, line, rect, ellipse, fill, flipH, flipV, mirrorInto, rotate90, shift, outline, outlineSelective, replaceColor, compilePalette, remapPalette, shadeRegion, composite, bounds, paintRows, toRows, colorsOf };
})();
