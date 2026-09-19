/* PixelForge Studio — seeded procedural generation.
   A deterministic RNG plus value noise, so a "give me 12 variants of this
   goblin" button produces the SAME twelve every time the same seed is used.
   Determinism is the whole point: a variant you liked must be reproducible
   from its seed alone, without storing the pixels. */
window.PF = window.PF || {};
PF.Gen = (() => {
  /* mulberry32: 32-bit state, passes PractRand to ~2^30, four lines long. */
  function rng(seed) {
    let a = (seed >>> 0) || 1;
    const next = () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    next.int = (lo, hi) => lo + Math.floor(next() * (hi - lo + 1));
    next.pick = arr => arr[Math.floor(next() * arr.length)];
    next.chance = p => next() < p;
    next.shuffle = arr => { const a2 = arr.slice(); for (let i = a2.length - 1; i > 0; i--) { const k = Math.floor(next() * (i + 1)); [a2[i], a2[k]] = [a2[k], a2[i]]; } return a2; };
    return next;
  }
  /* Hash a string to a seed so "goblin-var-3" is a usable seed. */
  const hashSeed = s => { let h = 2166136261 >>> 0; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h >>> 0; };

  /* Value noise on an integer lattice, smoothstep-interpolated. */
  const fade = t => t * t * (3 - 2 * t);
  function noise2(seed) {
    const h = (x, y) => {
      let n = Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(seed, 974634211);
      n = (n ^ (n >>> 13)) | 0; n = Math.imul(n, 1274126177);
      return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
    };
    return (x, y) => {
      const xi = Math.floor(x), yi = Math.floor(y), xf = fade(x - xi), yf = fade(y - yi);
      const a = h(xi, yi), b = h(xi + 1, yi), c = h(xi, yi + 1), d = h(xi + 1, yi + 1);
      return (a + (b - a) * xf) + ((c + (d - c) * xf) - (a + (b - a) * xf)) * yf;
    };
  }
  /* Fractal sum — octaves of noise2 at doubling frequency, halving amplitude. */
  function fbm(seed, octaves = 4, gain = 0.5, lacunarity = 2) {
    const layers = Array.from({ length: octaves }, (_, i) => noise2(seed + i * 7919));
    return (x, y) => {
      let f = 1, amp = 1, sum = 0, norm = 0;
      for (const n of layers) { sum += n(x * f, y * f) * amp; norm += amp; amp *= gain; f *= lacunarity; }
      return sum / norm;
    };
  }

  /* ---- palette variants ----
     Rotating hue in HSL keeps the ramp's internal contrast, which a naive
     channel swap destroys: a red-to-white ramp must stay a ramp when it turns
     blue, or the sprite reads as flat colour. */
  function shiftPalette(palette, amount, opts = {}) {
    return palette.map(hex => {
      const [h, s, l] = PF.Palette.toHsl(hex);
      return PF.Palette.fromHsl(h + amount, Math.max(0, Math.min(1, s * (opts.sat === undefined ? 1 : opts.sat))),
        Math.max(0, Math.min(1, l + (opts.light || 0))));
    });
  }

  /* variants(buf, w, h, n, opts) -> [{ seed, pixels, palette }]
     Each variant recolours the sprite by hue-rotating the colours it actually
     uses. Protected colours (the outline, by default) are left alone so the
     silhouette stays readable at every hue. */
  function variants(buf, w, h, n = 6, opts = {}) {
    const keep = new Set((opts.protect || ['#181425']).map(c => PF.Color.hexToU32(c)));
    const used = PF.Palette.extract(buf).filter(hex => !keep.has(PF.Color.hexToU32(hex)));
    const r = rng(typeof opts.seed === 'string' ? hashSeed(opts.seed) : (opts.seed === undefined ? 1 : opts.seed));
    const out = [];
    for (let i = 0; i < n; i++) {
      const seed = r.int(0, 0xffffff);
      const vr = rng(seed);
      const hue = opts.hue === undefined ? vr() : opts.hue * (i + 1);
      const sat = 0.75 + vr() * 0.6, light = (vr() - 0.5) * (opts.lightRange === undefined ? 0.14 : opts.lightRange);
      const to = shiftPalette(used, hue, { sat, light });
      out.push({ seed, palette: to, pixels: PF.Palette.swap(buf, used, to) });
    }
    return out;
  }

  /* Noise-driven texture fill, for tiles and backdrops. `stops` is a ramp from
     darkest to lightest; the noise value picks the stop. */
  function texture(w, h, stops, opts = {}) {
    const f = fbm(opts.seed === undefined ? 1 : opts.seed, opts.octaves || 3);
    const scale = opts.scale || 0.18, out = new Uint32Array(w * h);
    const cols = stops.map(c => PF.Color.hexToU32(c));
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      let v = f(x * scale, y * scale);
      if (opts.contrast) v = Math.max(0, Math.min(1, (v - 0.5) * opts.contrast + 0.5));
      out[y * w + x] = cols[Math.min(cols.length - 1, Math.floor(v * cols.length))];
    }
    return out;
  }
  /* Same, but tiles seamlessly: sample the noise on a torus so the left edge
     continues into the right. Costs 4 lookups per pixel instead of 1. */
  function seamlessTexture(w, h, stops, opts = {}) {
    const f = fbm(opts.seed === undefined ? 1 : opts.seed, opts.octaves || 3);
    const scale = opts.scale || 0.18, out = new Uint32Array(w * h);
    const cols = stops.map(c => PF.Color.hexToU32(c));
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const fx = x / w, fy = y / h;
      const v = f(x * scale, y * scale) * (1 - fx) * (1 - fy)
        + f((x - w) * scale, y * scale) * fx * (1 - fy)
        + f(x * scale, (y - h) * scale) * (1 - fx) * fy
        + f((x - w) * scale, (y - h) * scale) * fx * fy;
      out[y * w + x] = cols[Math.min(cols.length - 1, Math.max(0, Math.floor(v * cols.length)))];
    }
    return out;
  }

  return { rng, hashSeed, noise2, fbm, shiftPalette, variants, texture, seamlessTexture };
})();
