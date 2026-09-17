/* Head-to-head benchmark: the ORIGINAL hot-path implementations (inlined here,
   verbatim from the pre-optimisation source) versus the CURRENT engine, run in
   the same process so JIT/GC conditions are identical.

   Usage: node scripts/bench-compare.js
*/
const { boot, renderFrame } = require('./lib-boot');
const PF = boot();

const ms = fn => { const t = process.hrtime.bigint(); fn(); return Number(process.hrtime.bigint() - t) / 1e6; };
const best = (n, fn) => { let b = Infinity; for (let i = 0; i < n; i++) { const t = ms(fn); if (t < b) b = t; } return b; };

/* ================= ORIGINAL IMPLEMENTATIONS ================= */
const oldFromRGBA = (r, g, b, a = 255) => ((a << 24) | (b << 16) | (g << 8) | r) >>> 0;
function oldHexToU32(hex) {
  if (hex === undefined || hex === null || hex === '' || hex === 'transparent' || hex === 'none') return 0;
  if (typeof hex === 'number') return hex >>> 0;
  let h = String(hex).trim().replace('#', '');
  if (h.length === 3 || h.length === 4) h = [...h].map(c => c + c).join('');
  if (!/^[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/.test(h)) return 0;
  const n = parseInt(h.slice(0, 6), 16), a = h.length === 8 ? parseInt(h.slice(6, 8), 16) : 255;
  return oldFromRGBA(n >> 16, (n >> 8) & 255, n & 255, a);
}
const oldInb = (w, h, x, y) => x >= 0 && y >= 0 && x < w && y < h;
const oldGet = (p, w, h, x, y) => oldInb(w, h, x, y) ? p[y * w + x] : 0;
function oldOutline(p, w, h, c, diagonal = false) {
  const o = p.slice(), n = diagonal
    ? [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]]
    : [[1, 0], [-1, 0], [0, 1], [0, -1]];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (p[y * w + x]) continue;
    for (const [ox, oy] of n) if (oldGet(p, w, h, x + ox, y + oy)) { o[y * w + x] = c; break; }
  }
  return o;
}
function oldComposite(out, layers) {
  out.fill(0);
  for (const l of layers) {
    if (!l.visible || !l.pixels) continue;
    const src = l.pixels, op = l.opacity ?? 1;
    if (op >= 1) { for (let i = 0; i < out.length; i++) { const s = src[i]; if (s) out[i] = out[i] ? PF.Color.blend(out[i], s) : s; } }
    else for (let i = 0; i < out.length; i++) { let s = src[i]; if (!s) continue; s = ((s & 0xffffff) | (Math.round((s >>> 24) * op) << 24)) >>> 0; out[i] = out[i] ? PF.Color.blend(out[i], s) : s; }
  }
}
/* Original PF.Raster primitives, verbatim — so the comparison measures the
   whole call path, not just the API wrapper sitting on top of it. */
const oldRaster = (() => {
  const inb = (w, h, x, y) => x >= 0 && y >= 0 && x < w && y < h;
  const set = (p, w, h, x, y, c) => { if (inb(w, h, x, y)) p[y * w + x] = c; };
  const get = (p, w, h, x, y) => inb(w, h, x, y) ? p[y * w + x] : 0;
  function stamp(p, w, h, x, y, c, size = 1, mx = false, my = false) {
    const o = (size - 1) >> 1;
    for (let dy = 0; dy < size; dy++) for (let dx = 0; dx < size; dx++) {
      const px = x - o + dx, py = y - o + dy;
      set(p, w, h, px, py, c);
      if (mx) set(p, w, h, w - 1 - px, py, c);
      if (my) set(p, w, h, px, h - 1 - py, c);
      if (mx && my) set(p, w, h, w - 1 - px, h - 1 - py, c);
    }
  }
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
    if (fill) { for (let y = t; y <= b; y++) for (let x = l; x <= r; x++) stamp(p, w, h, x, y, c, 1, mx, my); return; }
    line(p, w, h, l, t, r, t, c, size, mx, my); line(p, w, h, l, b, r, b, c, size, mx, my);
    line(p, w, h, l, t, l, b, c, size, mx, my); line(p, w, h, r, t, r, b, c, size, mx, my);
  }
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
  function shadeRegion(p, w, h, x0, y0, x1, y1, amt) {
    const l = Math.max(0, Math.min(x0, x1)), r = Math.min(w - 1, Math.max(x0, x1)), t = Math.max(0, Math.min(y0, y1)), b = Math.min(h - 1, Math.max(y0, y1));
    for (let y = t; y <= b; y++) for (let x = l; x <= r; x++) { const i = y * w + x; if (p[i]) p[i] = PF.Color.shade(p[i], amt); }
  }
  return { set, get, stamp, line, rect, ellipse, fill, shadeRegion };
})();

const oldC = h => oldHexToU32(h);
function oldMakeApi(buf, W, H) {
  const r = oldRaster;
  return {
    buf, W, H,
    px(x, y, c) { r.set(buf, W, H, Math.round(x), Math.round(y), typeof c === 'number' ? c : oldC(c)); },
    rect(x0, y0, x1, y1, c) { r.rect(buf, W, H, Math.round(x0), Math.round(y0), Math.round(x1), Math.round(y1), typeof c === 'number' ? c : oldC(c), { fill: true }); },
    rectO(x0, y0, x1, y1, c, size = 1) { r.rect(buf, W, H, Math.round(x0), Math.round(y0), Math.round(x1), Math.round(y1), typeof c === 'number' ? c : oldC(c), { fill: false, size }); },
    line(x0, y0, x1, y1, c, size = 1) { r.line(buf, W, H, Math.round(x0), Math.round(y0), Math.round(x1), Math.round(y1), typeof c === 'number' ? c : oldC(c), size); },
    ellipse(x0, y0, x1, y1, c, fill = true) { r.ellipse(buf, W, H, Math.round(x0), Math.round(y0), Math.round(x1), Math.round(y1), typeof c === 'number' ? c : oldC(c), { fill }); },
    fill(x, y, c) { r.fill(buf, W, H, Math.round(x), Math.round(y), typeof c === 'number' ? c : oldC(c), true); },
    hash(x, y, seed = 0) { let h = (x * 374761393 + y * 668265263 + seed * 974634211) | 0; h = (h ^ (h >> 13)) | 0; h = Math.imul(h, 1274126177); h = (h ^ (h >> 16)) >>> 0; return h / 4294967295; },
    shadeRect(x0, y0, x1, y1, amt) { r.shadeRegion(buf, W, H, Math.round(x0), Math.round(y0), Math.round(x1), Math.round(y1), amt); }
  };
}

/* ================= WORKLOADS ================= */
const HEX = ['#e8b796', '#c28569', '#3e2731', '#181425', '#0099db', '#2ce8f5', '#fee761', '#a22633'];
const OC = oldHexToU32('#181425'), NC = PF.Color.hexToU32('#181425');

const W = 32, H = 32;
const sprite = new Uint32Array(W * H);
for (let y = 6; y < 26; y++) for (let x = 9; x < 24; x++) sprite[y * W + x] = 0xffcc8844;

const layers = [];
for (let l = 0; l < 4; l++) {
  const p = new Uint32Array(W * H);
  for (let y = 4 + l; y < 28 - l; y++) for (let x = 4 + l; x < 28 - l; x++) p[y * W + x] = 0xff000000 | (0x224466 + l * 0x112233);
  layers.push({ pixels: p, visible: true, opacity: 1 });
}
const cOut = new Uint32Array(W * H), oOut = new Uint32Array(W * H);
const cBuf = new Uint32Array(W * H), oBuf = new Uint32Array(W * H);

const CASES = [
  ['color.hexToU32', 400000,
    () => { let s = 0; for (let i = 0; i < 400000; i++) s += oldHexToU32(HEX[i & 7]); return s; },
    () => { let s = 0; for (let i = 0; i < 400000; i++) s += PF.Color.hexToU32(HEX[i & 7]); return s; }],
  ['raster.outline 32²', 20000,
    () => { for (let i = 0; i < 20000; i++) oldOutline(sprite, W, H, OC); },
    () => { for (let i = 0; i < 20000; i++) PF.Raster.outline(sprite, W, H, NC); }],
  ['raster.composite 4L', 30000,
    () => { for (let i = 0; i < 30000; i++) oldComposite(oOut, layers); },
    () => { for (let i = 0; i < 30000; i++) PF.Raster.composite(cOut, layers); }],
  ['pixel.makeApi + draw', 40000,
    () => { for (let i = 0; i < 40000; i++) { const a = oldMakeApi(oBuf, W, H); a.rect(8, 8, 20, 20, '#e8b796'); a.px(16, 16, '#181425'); a.line(8, 24, 24, 24, '#3e2731', 2); } },
    () => { for (let i = 0; i < 40000; i++) { const a = PF.Pixel.makeApi(cBuf, W, H); a.rect(8, 8, 20, 20, '#e8b796'); a.px(16, 16, '#181425'); a.line(8, 24, 24, 24, '#3e2731', 2); } }]
];

console.log('benchmark'.padEnd(24) + 'before'.padStart(11) + 'after'.padStart(11) + 'speedup'.padStart(10));
for (const [name, n, oldFn, newFn] of CASES) {
  oldFn(); newFn(); // warm
  const o = best(3, oldFn), nn = best(3, newFn);
  const per = v => (v * 1e6 / n).toFixed(1) + 'ns';
  console.log(name.padEnd(24) + per(o).padStart(11) + per(nn).padStart(11) + (o / nn).toFixed(2).padStart(9) + 'x');
}

/* Full-library build: how long to generate every template, every frame. */
function buildAll(useOldApi) {
  // Temporarily swap the draw API to measure the whole pipeline both ways.
  const real = PF.Pixel.makeApi;
  if (useOldApi) PF.Pixel.makeApi = oldMakeApi;
  try {
    let frames = 0;
    for (const t of PF.Library.list()) {
      const doc = t.build();
      for (const s of doc.states) for (const f of s.frames) { renderFrame(doc, f); frames++; }
    }
    return frames;
  } finally { PF.Pixel.makeApi = real; }
}
buildAll(false); buildAll(true);
const ob = best(3, () => buildAll(true)), nb = best(3, () => buildAll(false));
console.log('\nfull library build'.padEnd(24) + (ob.toFixed(1) + 'ms').padStart(11) + (nb.toFixed(1) + 'ms').padStart(11) + (ob / nb).toFixed(2).padStart(9) + 'x');
console.log('(all ' + PF.Library.list().length + ' templates, every frame, rendered end to end)');
