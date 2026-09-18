/* PixelForge Studio — palettes.
   Named artist palettes, ramp generation, quantisation with optional ordered
   dithering, recolouring, extraction from a buffer, and import/export of the
   formats other pixel tools actually read (GIMP .gpl, Paint.NET/hex .txt,
   JASC .pal, Aseprite .gpl). Pure data + typed-array maths: no DOM, so the
   Node CLI and the browser share one implementation. */
window.PF = window.PF || {};
PF.Palette = (() => {
  const C = h => PF.Color.hexToU32(h);
  const hex = u => PF.Color.u32ToHex(u);

  /* ---- named palettes ----
     Kept as plain hex arrays so they survive JSON round-trips untouched. */
  const NAMED = {
    'pixelforge-32': ['#181425', '#262b44', '#3a4466', '#5a6988', '#8b9bb4', '#c0cbdc', '#e8ecf5', '#ffffff',
      '#733e39', '#8f563b', '#b86f50', '#c08552', '#e4a672', '#f0d6a8', '#ead4aa', '#fee761',
      '#feae34', '#f77622', '#e43b44', '#a22633', '#ff8d7a', '#b55088', '#68386c', '#3e2347',
      '#265c42', '#3e8948', '#63c74d', '#a7f070', '#124e89', '#0099db', '#2ce8f5', '#b3f2ff'],
    'pico-8': ['#000000', '#1d2b53', '#7e2553', '#008751', '#ab5236', '#5f574f', '#c2c3c7', '#fff1e8',
      '#ff004d', '#ffa300', '#ffec27', '#00e436', '#29adff', '#83769c', '#ff77a8', '#ffccaa'],
    'sweetie-16': ['#1a1c2c', '#5d275d', '#b13e53', '#ef7d57', '#ffcd75', '#a7f070', '#38b764', '#257179',
      '#29366f', '#3b5dc9', '#41a6f6', '#73eff7', '#f4f4f4', '#94b0c2', '#566c86', '#333c57'],
    'endesga-16': ['#e4a672', '#b86f50', '#743f39', '#3f2832', '#9e2835', '#e53b44', '#fb922b', '#ffe762',
      '#63c64d', '#327345', '#193d3f', '#4f6781', '#afbfd2', '#ffffff', '#2ce8f4', '#0484d1'],
    'dawnbringer-16': ['#140c1c', '#442434', '#30346d', '#4e4a4e', '#854c30', '#346524', '#d04648', '#757161',
      '#597dce', '#d27d2c', '#8595a1', '#6daa2c', '#d2aa99', '#6dc2ca', '#dad45e', '#deeed6'],
    'gameboy': ['#0f380f', '#306230', '#8bac0f', '#9bbc0f'],
    'gameboy-pocket': ['#181818', '#4a4a4a', '#8c8c8c', '#d8d8d8'],
    'nes': ['#000000', '#fcfcfc', '#f8f8f8', '#bcbcbc', '#7c7c7c', '#a4e4fc', '#3cbcfc', '#0078f8',
      '#0000fc', '#b8b8f8', '#6888fc', '#0058f8', '#0000bc', '#d8b8f8', '#9878f8', '#6844fc',
      '#4428bc', '#f8b8f8', '#f878f8', '#d800cc', '#940084', '#f8a4c0', '#f85898', '#e40058',
      '#a80020', '#f0d0b0', '#f87858', '#f83800', '#a81000', '#fce0a8', '#fca044', '#e45c10',
      '#881400', '#f8d878', '#f8b800', '#ac7c00', '#503000', '#d8f878', '#b8f818', '#00b800',
      '#007800', '#b8f8b8', '#58d854', '#00a800', '#006800', '#b8f8d8', '#58f898', '#00a844',
      '#005800', '#00fcfc', '#00e8d8', '#008888', '#004058', '#787878'],
    'commodore-64': ['#000000', '#ffffff', '#880000', '#aaffee', '#cc44cc', '#00cc55', '#0000aa', '#eeee77',
      '#dd8855', '#664400', '#ff7777', '#333333', '#777777', '#aaff66', '#0088ff', '#bbbbbb'],
    'zx-spectrum': ['#000000', '#0000d7', '#d70000', '#d700d7', '#00d700', '#00d7d7', '#d7d700', '#d7d7d7',
      '#0000ff', '#ff0000', '#ff00ff', '#00ff00', '#00ffff', '#ffff00', '#ffffff', '#3f3f3f'],
    'cga': ['#000000', '#555555', '#aaaaaa', '#ffffff', '#0000aa', '#5555ff', '#00aa00', '#55ff55',
      '#00aaaa', '#55ffff', '#aa0000', '#ff5555', '#aa00aa', '#ff55ff', '#aa5500', '#ffff55'],
    'mono': ['#181425', '#ffffff'],
    'sepia-8': ['#1b1310', '#33211a', '#5a382a', '#7f5232', '#a8703f', '#c99157', '#e3b982', '#f6e3c1'],
    'ice-8': ['#0b1424', '#122a43', '#1c4a6e', '#2d7ba3', '#3fb0cf', '#79dced', '#b8f2fb', '#ffffff'],
    'ember-8': ['#1a0d12', '#40151c', '#7a1f22', '#b83a25', '#e4692a', '#f39b3c', '#fbcd66', '#fff3c4'],
    'slime-8': ['#0d1a12', '#16301f', '#245132', '#36784a', '#4fa35d', '#77c96f', '#a9e88a', '#e2ffc2'],
    'dusk-12': ['#0d0b1a', '#1c1733', '#33254f', '#523566', '#7a4a7a', '#a4638a', '#c9808f', '#e6a292',
      '#f3c39c', '#fadfb6', '#fdf2d8', '#ffffff']
  };

  const names = () => Object.keys(NAMED);
  const get = name => (NAMED[name] || []).slice();

  /* ---- ramps ----
     A hand-built ramp shifts hue as it darkens (cool shadows, warm lights);
     a straight lerp to black looks muddy, which is why `ramp` takes a hue
     rotation and a saturation curve rather than two endpoints only. */
  function hsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
    if (mx === mn) return [0, 0, l];
    const d = mx - mn, s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
    let h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return [h / 6, s, l];
  }
  function rgb(h, s, l) {
    if (s === 0) { const v = Math.round(l * 255); return [v, v, v]; }
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
    const k = t => { t = (t + 1) % 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < 1 / 2 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; };
    return [Math.round(k(h + 1 / 3) * 255), Math.round(k(h) * 255), Math.round(k(h - 1 / 3) * 255)];
  }
  const toHsl = h => { const [r, g, b] = PF.Color.rgba(C(h)); return hsl(r, g, b); };
  const fromHsl = (h, s, l) => { const [r, g, b] = rgb((h % 1 + 1) % 1, Math.max(0, Math.min(1, s)), Math.max(0, Math.min(1, l))); return PF.Color.u32ToHex(PF.Color.fromRGBA(r, g, b, 255)); };

  /* ramp(base, steps, opts) -> [darkest .. lightest] hex ramp */
  function ramp(base, steps = 5, opts = {}) {
    const [h, s, l] = toHsl(base);
    const hueShift = opts.hueShift === undefined ? 0.06 : opts.hueShift; // shadows cool, lights warm
    const range = opts.range === undefined ? 0.36 : opts.range;
    const out = [];
    for (let i = 0; i < steps; i++) {
      const t = steps === 1 ? 0.5 : i / (steps - 1);          // 0 = darkest
      const k = t - 0.5;
      out.push(fromHsl(h + hueShift * -k * 2, Math.max(0, s * (1 - Math.abs(k) * (opts.desat === undefined ? 0.45 : opts.desat))), Math.max(0.03, Math.min(0.97, l + k * range * 2))));
    }
    return out;
  }

  /* ---- distance + quantise ----
     Weighted RGB is closer to perceived difference than plain euclidean and is
     far cheaper than converting every pixel to Lab. */
  function dist(ar, ag, ab, br, bg, bb) {
    const rm = (ar + br) / 2, dr = ar - br, dg = ag - bg, db = ab - bb;
    return (2 + rm / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rm) / 256) * db * db;
  }
  const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

  /* Nearest palette entry for a packed u32 (alpha ignored). */
  function nearest(u32, table) {
    const [r, g, b] = PF.Color.rgba(u32);
    let best = 0, bd = Infinity;
    for (let i = 0; i < table.length; i++) {
      const d = dist(r, g, b, table[i][0], table[i][1], table[i][2]);
      if (d < bd) { bd = d; best = i; }
    }
    return best;
  }
  const tableOf = pal => pal.map(h => { const [r, g, b] = PF.Color.rgba(typeof h === 'number' ? h : C(h)); return [r, g, b, typeof h === 'number' ? h : C(h)]; });

  /* quantize(buf, w, h, palette, {dither:0..1}) -> new Uint32Array.
     Transparent pixels stay transparent; alpha is preserved from the source. */
  function quantize(buf, w, h, palette, opts = {}) {
    const table = tableOf(palette.length ? palette : NAMED['pixelforge-32']);
    const amount = opts.dither || 0, out = new Uint32Array(buf.length);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x, v = buf[i];
      if (!v) continue;
      const [r, g, b, a] = PF.Color.rgba(v);
      let rr = r, gg = g, bb = b;
      if (amount > 0) {
        const bias = (BAYER4[(y & 3) * 4 + (x & 3)] / 16 - 0.5) * 64 * amount;
        rr = Math.max(0, Math.min(255, r + bias)); gg = Math.max(0, Math.min(255, g + bias)); bb = Math.max(0, Math.min(255, b + bias));
      }
      let best = 0, bd = Infinity;
      for (let k = 0; k < table.length; k++) {
        const d = dist(rr, gg, bb, table[k][0], table[k][1], table[k][2]);
        if (d < bd) { bd = d; best = k; }
      }
      out[i] = PF.Color.fromRGBA(table[best][0], table[best][1], table[best][2], a);
    }
    return out;
  }

  /* recolor(buf, map) — map is { '#from': '#to' } or [[fromU32, toU32], ...].
     Exact matches only: this is a palette swap, not a quantise. */
  function recolor(buf, map) {
    const pairs = Array.isArray(map) ? map.map(([a, b]) => [typeof a === 'number' ? a : C(a), typeof b === 'number' ? b : C(b)])
      : Object.entries(map).map(([a, b]) => [C(a), typeof b === 'number' ? b : C(b)]);
    const lut = new Map(pairs);
    const out = new Uint32Array(buf.length);
    for (let i = 0; i < buf.length; i++) { const v = buf[i]; out[i] = v && lut.has(v) ? lut.get(v) : v; }
    return out;
  }

  /* Swap one whole palette for another, index by index. */
  const swap = (buf, from, to) => recolor(buf, from.map((c, i) => [c, to[i % to.length]]));

  /* extract(buf) -> hex list sorted by usage (most used first). */
  function extract(buf, opts = {}) {
    const counts = new Map();
    for (let i = 0; i < buf.length; i++) { const v = buf[i]; if (!v) continue; counts.set(v, (counts.get(v) || 0) + 1); }
    let list = [...counts.entries()].sort((a, b) => b[1] - a[1]);
    if (opts.max) list = list.slice(0, opts.max);
    const out = list.map(([v]) => hex(v));
    return opts.sort === 'luma' ? sortByLuma(out) : out;
  }
  const sortByLuma = pal => pal.slice().sort((a, b) => PF.Color.luma(C(a)) - PF.Color.luma(C(b)));

  /* ---- file formats ---- */
  const HEX_RE = /#?([0-9a-f]{6})\b/gi;
  function parse(text, filename = '') {
    const t = String(text);
    if (/^\s*(JASC-PAL|RIFF)/i.test(t) || /\.pal$/i.test(filename)) {
      // JASC-PAL: header line, version, count, then "r g b" triples
      const lines = t.split(/\r?\n/).slice(3).filter(Boolean);
      const out = lines.map(l => l.trim().split(/\s+/).slice(0, 3).map(Number)).filter(p => p.length === 3 && p.every(n => !isNaN(n)))
        .map(([r, g, b]) => hex(PF.Color.fromRGBA(r, g, b, 255)));
      if (out.length) return out;
    }
    if (/GIMP Palette/i.test(t)) {
      // A .gpl row is "r g b" followed by an optional free-text name column, so
      // only the first three tokens are numbers — parsing the whole row drops
      // every line that carries a name.
      return t.split(/\r?\n/).filter(l => l && !/^(GIMP Palette|Name:|Columns:|#)/i.test(l.trim()))
        .map(l => l.trim().split(/\s+/).slice(0, 3).map(Number)).filter(p => p.length === 3 && p.every(n => !isNaN(n)))
        .map(([r, g, b]) => hex(PF.Color.fromRGBA(r, g, b, 255)));
    }
    if (/^\s*[[{]/.test(t)) { // JSON: array of hex, or {colors:[...]}
      try { const j = JSON.parse(t); const arr = Array.isArray(j) ? j : j.colors || j.palette || []; if (arr.length) return arr.map(String); } catch (e) { /* fall through to hex scan */ }
    }
    const found = [...t.matchAll(HEX_RE)].map(m => '#' + m[1].toLowerCase());
    return [...new Set(found)];
  }
  function format(pal, kind = 'gpl', name = 'PixelForge') {
    const rgbOf = h => PF.Color.rgba(C(h));
    if (kind === 'hex') return pal.map(h => h.replace('#', '').toUpperCase()).join('\n') + '\n';
    if (kind === 'json') return JSON.stringify({ name, colors: pal }, null, 2);
    if (kind === 'pal') return `JASC-PAL\n0100\n${pal.length}\n` + pal.map(h => { const [r, g, b] = rgbOf(h); return `${r} ${g} ${b}`; }).join('\n') + '\n';
    if (kind === 'css') return `:root {\n` + pal.map((h, i) => `  --pf-${i}: ${h};`).join('\n') + '\n}\n';
    // default: GIMP .gpl, which Aseprite, GIMP, Krita and LibreSprite all read
    return `GIMP Palette\nName: ${name}\nColumns: 8\n#\n` + pal.map((h, i) => {
      const [r, g, b] = rgbOf(h);
      return `${String(r).padStart(3)} ${String(g).padStart(3)} ${String(b).padStart(3)}\t${h}`;
    }).join('\n') + '\n';
  }
  const EXT = { gpl: 'gpl', hex: 'txt', json: 'json', pal: 'pal', css: 'css' };

  return { NAMED, names, get, ramp, toHsl, fromHsl, quantize, recolor, swap, extract, sortByLuma, nearest, tableOf, parse, format, EXT };
})();
