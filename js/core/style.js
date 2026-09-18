/* PixelForge Studio — Style engine.
   Retargets ANY rendered sprite (library template, project frame, imported PNG)
   onto a curated hardware/era palette, with deterministic ordered dithering so
   gradients survive a 4-colour screen. This is what lets one asset library serve
   Game Boy, NES, CGA, PICO-8, 1-bit, sepia and neon games without a second set
   of painters.

   Design notes:
   - Pure functions over Uint32Array buffers. No DOM, no globals, no randomness:
     the same input always produces the same bytes, so the pixel-regression
     harness and the style gate can both treat it as a build artefact.
   - Nearest-colour search runs in a small palette (< 64 entries), so a linear
     scan beats any acceleration structure. Mapping is memoised per (palette,
     colour): a 32x32 sprite has at most 1024 distinct colours, usually far
     fewer, so the second frame of an animation is nearly free.
   - Alpha is preserved as a threshold, not blended: hardware palettes are
     opaque, and semi-transparent anti-aliased edges would otherwise dither
     into halos. `alphaCutoff` (default 1) controls what counts as visible. */
window.PF = window.PF || {};
PF.Style = (() => {
  const C = h => PF.Color.hexToU32(h);
  const TAU = Math.PI * 2;

  /* ---------------- style catalogue ----------------
     Each entry is a real hardware/era palette, not an arbitrary gradient. The
     first colour is conventionally the "darkest ink" so `ink` can be derived. */
  const STYLES = [
    { id: 'gameboy', name: 'Game Boy DMG', era: '1989 · 4 shades', dither: true,
      palette: ['#0f380f', '#306230', '#8bac0f', '#9bbc0f'], tags: ['handheld', 'mono', 'green', '4-color'] },
    { id: 'gameboy-pocket', name: 'Game Boy Pocket', era: '1996 · 4 greys', dither: true,
      palette: ['#101010', '#4a4a4a', '#9a9a9a', '#e8e8e8'], tags: ['handheld', 'mono', 'grey', '4-color'] },
    { id: 'gameboy-light', name: 'Game Boy Light', era: '1998 · teal glow', dither: true,
      palette: ['#002b36', '#0b6e6e', '#4fd6c8', '#d7fff5'], tags: ['handheld', 'mono', 'teal', '4-color'] },
    { id: 'virtual-boy', name: 'Virtual Boy', era: '1995 · 4 reds', dither: true,
      palette: ['#1a0000', '#5c0000', '#c00000', '#ff2a2a'], tags: ['handheld', 'mono', 'red', '4-color'] },
    { id: 'nes', name: 'NES', era: '1983 · 8 hues', dither: true,
      palette: ['#000000', '#7c7c7c', '#bcbcbc', '#fcfcfc', '#a4e4fc', '#3cbcfc', '#0078f8', '#0000fc',
        '#b8f8b8', '#58d854', '#00a800', '#f8b8f8', '#f878f8', '#e40058', '#fca044', '#e45c10'],
      tags: ['console', '8-bit', '16-color'] },
    { id: 'cga', name: 'CGA Mode 4', era: '1981 · 4 colours', dither: true,
      palette: ['#000000', '#55ffff', '#ff55ff', '#ffffff'], tags: ['retro', 'pc', '4-color'] },
    { id: 'c64', name: 'Commodore 64', era: '1982 · 16 colours', dither: true,
      palette: ['#000000', '#ffffff', '#883932', '#67b6bd', '#8b3f96', '#55a049', '#40318d', '#bfce72',
        '#8b5429', '#574200', '#b86962', '#505050', '#787878', '#94e089', '#7869c4', '#9f9f9f'],
      tags: ['retro', 'pc', '16-color'] },
    { id: 'pico8', name: 'PICO-8', era: 'fantasy console · 16 colours', dither: true,
      palette: ['#000000', '#1d2b53', '#7e2553', '#008751', '#ab5236', '#5f574f', '#c2c3c7', '#fff1e8',
        '#ff004d', '#ffa300', '#ffec27', '#00e436', '#29adff', '#83769c', '#ff77a8', '#ffccaa'],
      tags: ['fantasy-console', '16-color', 'modern-retro'] },
    { id: 'sweetie16', name: 'Sweetie 16', era: 'modern 16-colour', dither: true,
      palette: ['#1a1c2c', '#5d275d', '#b13e53', '#ef7d57', '#ffcd75', '#a7f070', '#38b764', '#257179',
        '#29366f', '#3b5dc9', '#41a6f6', '#73eff7', '#f4f4f4', '#94b0c2', '#566c86', '#333c57'],
      tags: ['modern-retro', '16-color', 'popular'] },
    { id: 'mono-1bit', name: '1-Bit Ink', era: '1-bit · 2 tones', dither: true,
      palette: ['#0b0b0f', '#f2f2ef'], tags: ['1-bit', 'mono', 'zine'] },
    { id: 'sepia', name: 'Sepia Print', era: '4-tone aged paper', dither: true,
      palette: ['#2b1d0e', '#6b4f2a', '#b08d57', '#f0e2c0'], tags: ['sepia', 'print', '4-color'] },
    { id: 'noir', name: 'Film Noir', era: '6-step greyscale', dither: true,
      palette: ['#000000', '#262626', '#4d4d4d', '#808080', '#b3b3b3', '#ffffff'], tags: ['mono', 'grey', 'moody'] },
    { id: 'neon-noir', name: 'Neon Noir', era: 'synthwave · 10 colours', dither: true,
      palette: ['#0b0420', '#1b0b3b', '#37196b', '#6a2c9c', '#c026d3', '#f43f8e', '#ff7ab8', '#22d3ee',
        '#7dd3fc', '#f8fafc'], tags: ['synthwave', 'cyberpunk', 'neon'] },
    { id: 'vaporwave', name: 'Vaporwave', era: 'pastel dusk', dither: true,
      palette: ['#1b1035', '#3b2a6b', '#7a5cc4', '#c79bff', '#ffb3d9', '#ff7ab8', '#7ce7ff', '#2bb3c0',
        '#ffe7a3', '#fff5f7'], tags: ['synthwave', 'pastel', 'neon'] },
    { id: 'desert', name: 'Desert Dusk', era: 'sand + rust', dither: true,
      palette: ['#2b1a12', '#5c3a1e', '#9c6b30', '#d9a45b', '#f2d29b', '#7a3b2e', '#c65b3c', '#3f5b4c'],
      tags: ['biome', 'warm', 'adventure'] },
    { id: 'arctic', name: 'Arctic', era: 'ice + slate', dither: true,
      palette: ['#101c2c', '#22384f', '#3d6180', '#6f9fbd', '#a8d8ea', '#e8fbff', '#4a3f6b', '#c07ab0'],
      tags: ['biome', 'cold', 'adventure'] },
    { id: 'jungle', name: 'Deep Jungle', era: 'canopy greens', dither: true,
      palette: ['#0d1b0f', '#1e3a20', '#2f6b32', '#4f9e42', '#8fce5a', '#d9e86b', '#6b4a22', '#c98a3c'],
      tags: ['biome', 'nature', 'adventure'] },
    { id: 'abyss', name: 'Abyss', era: 'deep water', dither: true,
      palette: ['#020b18', '#062a4a', '#0d5a7a', '#1f9bb0', '#57d6d2', '#c2f7f0', '#3a2a5c', '#8a5cc4'],
      tags: ['biome', 'water', 'moody'] },
    { id: 'inferno', name: 'Inferno', era: 'ash + ember', dither: true,
      palette: ['#0a0605', '#2b1512', '#5c2418', '#9c3a1c', '#e06b24', '#ffb03a', '#ffe08a', '#6b6b6b'],
      tags: ['biome', 'fire', 'moody'] },
    { id: 'pastel-dream', name: 'Pastel Dream', era: 'soft 12-colour', dither: true,
      palette: ['#3b2f4a', '#6b5a7a', '#a08fb0', '#d6c9de', '#ffd6e0', '#ffb3c6', '#c6f0d8', '#8fd9b6',
        '#bfe3ff', '#8fb8e8', '#fff2c2', '#fffaf5'], tags: ['cute', 'soft', 'cozy'] },
    { id: 'holy', name: 'Stained Glass', era: 'gold + azure', dither: true,
      palette: ['#1c1a3a', '#2f4a8a', '#4a86d9', '#9fd0ff', '#ffe28a', '#ffb63a', '#c27a1e', '#f7f3e8'],
      tags: ['fantasy', 'bright', 'rpg'] },
    { id: 'undead', name: 'Blighthold', era: 'rot + bone', dither: true,
      palette: ['#0c1008', '#1f2a14', '#3d4a22', '#6b7a3a', '#a8a878', '#ded8b0', '#5c3a4a', '#8a4a6b'],
      tags: ['horror', 'undead', 'moody'] },
    { id: 'cyberpunk', name: 'Cyberpunk', era: 'chrome + toxic', dither: true,
      palette: ['#05010f', '#140a2e', '#2b1a5c', '#4a3a9c', '#00f0ff', '#00a0c0', '#ff2e88', '#ffd400',
        '#c8d4e8', '#ffffff'], tags: ['scifi', 'neon', 'dystopia'] },
    { id: 'terminal', name: 'Amber Terminal', era: 'CRT phosphor', dither: true,
      palette: ['#100c00', '#3a2a00', '#7a5a00', '#c08a00', '#ffb000', '#ffe08a'], tags: ['retro', 'pc', 'mono', 'scifi'] },
    { id: 'thermal', name: 'Thermal', era: 'false-colour heat', dither: false,
      palette: ['#04020a', '#2a0a6b', '#7a1ac0', '#d92b8a', '#ff6b3a', '#ffd23a', '#fffbe8'],
      tags: ['scientific', 'false-color', 'ir'] }
  ];

  const byId = new Map();
  const custom = [];
  const cache = new Map(); // `${styleId}|${u32}` -> [nearest, second]
  function register(style) {
    if (!style || !style.id || !Array.isArray(style.palette) || !style.palette.length) throw new Error('PF.Style.register needs {id, palette[]}');
    const entry = { dither: true, tags: [], ...style, u32: style.palette.map(C) };
    byId.set(entry.id, entry); custom.push(entry.id);
    cache.clear();
    return entry.id;
  }
  for (const s of STYLES) register(s);
  const list = () => [...byId.values()].map(({ u32, ...s }) => ({ ...s, size: s.palette.length, custom: custom.includes(s.id) }));
  const get = id => byId.get(id) || null;
  const ids = () => [...byId.keys()];

  /* ---------------- colour maths ---------------- */
  /* Perceptual distance. Redmean is a cheap approximation of CIE76 that behaves
     far better than plain RGB on the dark-end ramps these palettes live on —
     a naive RGB distance maps mid browns onto mid greens. */
  function dist(a, b) {
    const r1 = a & 255, g1 = (a >> 8) & 255, b1 = (a >> 16) & 255;
    const r2 = b & 255, g2 = (b >> 8) & 255, b2 = (b >> 16) & 255;
    const rm = (r1 + r2) >> 1, dr = r1 - r2, dg = g1 - g2, db = b1 - b2;
    return (((512 + rm) * dr * dr) >> 8) + 4 * dg * dg + (((767 - rm) * db * db) >> 8);
  }
  const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

  function pairFor(entry, v) {
    const key = entry.id + '|' + v;
    const hit = cache.get(key);
    if (hit) return hit;
    const pal = entry.u32, n = pal.length;
    let i1 = 0, d1 = Infinity, i2 = -1, d2 = Infinity;
    for (let i = 0; i < n; i++) {
      const d = dist(v, pal[i]);
      if (d < d1) { d2 = d1; i2 = i1; d1 = d; i1 = i; }
      else if (d < d2) { d2 = d; i2 = i; }
    }
    const pair = [pal[i1], i2 >= 0 ? pal[i2] : pal[i1]];
    if (cache.size < 32768) cache.set(key, pair);
    return pair;
  }

  /* Map one colour onto a style palette. `t` is the ordered-dither threshold
     (0..1) at the pixel's position; without it the nearest colour wins. */
  function quantize(styleId, color, t = 0.5) {
    const entry = typeof styleId === 'string' ? (byId.get(styleId) || byId.get('sweetie16')) : styleId;
    const a = color >>> 24;
    const pair = pairFor(entry, color);
    let c = pair[0];
    if (entry.dither && t > 0) {
      const d1 = dist(color, pair[0]), d2 = dist(color, pair[1]);
      /* Where the source sits between its two nearest palette entries decides
         how much of the cell flips to the second colour. d1+d2 is 0 only when
         the colour is exactly in the palette, in which case d1 dominates. */
      const sum = d1 + d2;
      const k = sum ? d1 / sum : 1;
      if (t > k) c = pair[1];
    }
    return (c & 0xffffff) | (a << 24);
  }

  /* Restyle a whole buffer in place. opts:
       dither   — override the style's dither flag
       cutoff   — alpha below this becomes fully transparent (default 1)
       protect  — array of u32 colours to leave untouched (e.g. UI text)      */
  function apply(buf, W, H, styleId, opts = {}) {
    const entry = typeof styleId === 'string' ? (byId.get(styleId) || byId.get('sweetie16')) : styleId;
    if (!entry) throw new Error(`Unknown style "${styleId}". Known: ${ids().join(', ')}`);
    const dither = opts.dither === undefined ? entry.dither : !!opts.dither;
    const cutoff = opts.cutoff === undefined ? 1 : opts.cutoff;
    const protect = opts.protect && opts.protect.length ? new Set(opts.protect.map(c => c >>> 0)) : null;
    for (let y = 0; y < H; y++) {
      const row = y * W;
      for (let x = 0; x < W; x++) {
        const i = row + x, v = buf[i];
        if (!v || (v >>> 24) < cutoff) continue;
        if (protect && protect.has(v)) continue;
        const t = dither ? (BAYER4[((y & 3) << 2) | (x & 3)] + 0.5) / 16 : 0;
        buf[i] = quantize(entry, v, t);
      }
    }
    return buf;
  }

  /* Multiplicative tint toward a colour, keeping alpha. amount 0..1. */
  function tint(buf, W, H, hex, amount = 0.5) {
    const tv = C(hex), k = Math.max(0, Math.min(1, amount));
    for (let i = 0; i < buf.length; i++) if (buf[i]) {
      const a = buf[i] >>> 24;
      buf[i] = PF.Color.fromRGBA(
        Math.round((buf[i] & 255) * (1 - k) + (tv & 255) * k),
        Math.round(((buf[i] >> 8) & 255) * (1 - k) + ((tv >> 8) & 255) * k),
        Math.round(((buf[i] >> 16) & 255) * (1 - k) + ((tv >> 16) & 255) * k), a);
    }
    return buf;
  }

  /* Hue-shift lightening: the classic pixel-art trick where highlights drift
     toward the warm end and shadows toward the cool end instead of just
     getting brighter. amount -1..1. */
  function warmCool(buf, W, H, amount = 0.5) {
    if (!amount) return buf;
    const luma = PF.Color.luma;
    const targets = [[255, 180, 120], [90, 140, 255]]; // warm highlight / cool shadow
    const t = amount > 0 ? 0 : 1, k = Math.abs(amount);
    for (let i = 0; i < buf.length; i++) if (buf[i]) {
      const v = buf[i], a = v >>> 24, l = luma(v) / 255;
      const w = t === 0 ? l : 1 - l;
      const tw = targets[t === 0 ? 0 : 1];
      const r = v & 255, g = (v >> 8) & 255, b = (v >> 16) & 255;
      buf[i] = PF.Color.fromRGBA(
        Math.round(r + (tw[0] - r) * w * k * 0.6),
        Math.round(g + (tw[1] - g) * w * k * 0.6),
        Math.round(b + (tw[2] - b) * w * k * 0.6), a);
    }
    return buf;
  }

  /* Colour histogram of a buffer: [{hex, u32, count}] sorted by count desc. */
  function stats(buf) {
    const m = new Map();
    for (let i = 0; i < buf.length; i++) { const v = buf[i]; if (v) m.set(v, (m.get(v) || 0) + 1); }
    return [...m.entries()].sort((a, b) => b[1] - a[1]).map(([u32, count]) => ({ u32, hex: PF.Color.u32ToHex(u32), count }));
  }

  /* Wrap a frame painter so every frame it produces is styled. Used by
     PF.Factory.variant() to turn any template into a style variant without
     touching a single painter. */
  function painter(styleId, paint, opts = {}) {
    return (buf, W, H) => { paint(buf, W, H); apply(buf, W, H, styleId, opts); };
  }
  /* Restyle a whole DocData (pure — returns a new doc, original untouched). */
  function docOf(doc, styleId, opts = {}) {
    const states = doc.states.map(s => ({
      ...s,
      frames: s.frames.map(f => f.layers
        ? { ...f, layers: f.layers.map(p => typeof p === 'function' ? painter(styleId, p, opts) : p) }
        : { ...f, paint: painter(styleId, f.paint, opts) })
    }));
    return { ...doc, name: doc.name + '-' + styleId, states, style: styleId };
  }

  /* CSS colour list for the style, handy for theme generators. */
  const cssVars = styleId => {
    const e = get(styleId); if (!e) return '';
    return e.palette.map((c, i) => `  --pf-${styleId}-${i}: ${c};`).join('\n');
  };

  return { list, ids, get, register, apply, quantize, tint, warmCool, stats, painter, docOf, cssVars,
    STYLES, BAYER4, dist, TAU };
})();
