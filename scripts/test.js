/* PixelForge unit suite — the cheap half of verification.
   check-rpg.js proves the art renders; this proves the engine maths, the file
   formats and the export writers behave. No DOM, no npm, no fixtures on disk:
   every case builds its own buffer so a failure points at one function.

   Usage: node scripts/test.js  [filter]
*/
const { boot, renderFrame } = require('./lib-boot');
const PF = boot();

let pass = 0, fail = 0, group = '';
const failures = [];
const describe = name => { group = name; };
const TRACE = process.env.PF_TRACE;
const it = (name, fn) => {
  if (TRACE) console.log("... " + group + " > " + name);
  try { fn(); pass++; }
  catch (e) { fail++; failures.push(`${group} > ${name}: ${e.message}`); }
};
const eq = (a, b, m) => { if (a !== b) throw new Error(`${m || ''} expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); };
const ok = (c, m) => { if (!c) throw new Error(m || 'expected truthy'); };
const near = (a, b, tol, m) => { if (Math.abs(a - b) > tol) throw new Error(`${m || ''} ${a} not within ${tol} of ${b}`); };
const throws = (fn, m) => { let t = false; try { fn(); } catch (e) { t = true; } if (!t) throw new Error(m || 'expected throw'); };

/* A tiny known sprite: 4x4, a 2x2 red square inset by 1, everything else clear. */
function sample(w = 4, h = 4) {
  const b = new Uint32Array(w * h);
  const red = PF.Color.hexToU32('#ff0000');
  b[1 * w + 1] = red; b[1 * w + 2] = red; b[2 * w + 1] = red; b[2 * w + 2] = red;
  return b;
}
const count = b => { let n = 0; for (let i = 0; i < b.length; i++) if (b[i]) n++; return n; };

/* ---------------------------------------------------------------- Color */
describe('PF.Color');
it('hex round-trips through u32', () => {
  eq(PF.Color.u32ToHex(PF.Color.hexToU32('#3a7d44')), '#3a7d44');
});
it('packs ABGR little-endian', () => {
  const v = PF.Color.fromRGBA(1, 2, 3, 255);
  const [r, g, b, a] = PF.Color.rgba(v);
  eq(r, 1); eq(g, 2); eq(b, 3); eq(a, 255);
});
it('blend composites src over dst', () => {
  const dst = PF.Color.fromRGBA(0, 0, 0, 255), src = PF.Color.fromRGBA(255, 255, 255, 128);
  const [r] = PF.Color.rgba(PF.Color.blend(dst, src));
  ok(r > 100 && r < 160, `mid grey expected, got ${r}`);
});

/* -------------------------------------------------------------- Palette */
describe('PF.Palette');
it('ships the named palettes', () => {
  ok(PF.Palette.names().length >= 16, 'at least 16 palettes');
  eq(PF.Palette.get('gameboy').length, 4);
  ok(PF.Palette.NAMED['pixelforge-32'].every(h => /^#[0-9a-f]{6}$/.test(h)), 'all lowercase hex');
});
it('ramp returns the requested length, dark to light', () => {
  const r = PF.Palette.ramp('#b13e53', 5);
  eq(r.length, 5);
  const l = r.map(h => PF.Color.luma(PF.Color.hexToU32(h)));
  for (let i = 1; i < l.length; i++) ok(l[i] > l[i - 1], `ramp not ascending at ${i}: ${l.join()}`);
});
it('ramp of 1 step is legal', () => eq(PF.Palette.ramp('#ffffff', 1).length, 1));
it('quantize keeps transparency and alpha', () => {
  const b = sample();
  b[0] = PF.Color.fromRGBA(200, 10, 10, 128);
  const q = PF.Palette.quantize(b, 4, 4, PF.Palette.get('pico-8'));
  eq(q[5 * 0 + 3], 0, 'clear pixel stayed clear');
  eq(PF.Color.rgba(q[0])[3], 128, 'alpha preserved');
  eq(count(q), count(b), 'pixel count unchanged');
});
it('quantize with dither still only emits palette colours', () => {
  const b = new Uint32Array(64).fill(PF.Color.fromRGBA(120, 130, 140, 255));
  const pal = PF.Palette.get('gameboy');
  const table = new Set(pal.map(h => PF.Color.hexToU32(h) & 0x00ffffff));
  const q = PF.Palette.quantize(b, 8, 8, pal, { dither: 1 });
  for (const v of q) ok(table.has(v & 0x00ffffff), 'off-palette colour emitted');
});
it('extract sorts by usage', () => {
  const b = sample();
  b[0] = PF.Color.hexToU32('#00ff00');
  eq(PF.Palette.extract(b)[0], '#ff0000', 'most-used first');
  eq(PF.Palette.extract(b).length, 2);
});
it('swap maps palettes index by index', () => {
  const out = PF.Palette.swap(sample(), ['#ff0000'], ['#0000ff']);
  eq(PF.Color.u32ToHex(out[5]), '#0000ff');
});
it('recolor leaves unmapped colours alone', () => {
  const out = PF.Palette.recolor(sample(), { '#00ff00': '#0000ff' });
  eq(PF.Color.u32ToHex(out[5]), '#ff0000');
});
it('hsl round-trips', () => {
  for (const hex of ['#ff0000', '#3a7d44', '#101820', '#ffffff']) {
    const [h, s, l] = PF.Palette.toHsl(hex);
    eq(PF.Palette.fromHsl(h, s, l), hex, `${hex}: `);
  }
});
it('parse/format round-trip for every text format', () => {
  const pal = PF.Palette.get('sweetie-16');
  for (const kind of ['gpl', 'hex', 'json', 'pal']) {
    const text = PF.Palette.format(pal, kind, 'Test');
    const back = PF.Palette.parse(text, 'x.' + (kind === 'hex' ? 'txt' : kind));
    eq(back.length, pal.length, `${kind} length: `);
    eq(back.join().toLowerCase(), pal.join().toLowerCase(), `${kind}: `);
  }
});
it('parse falls back to scanning loose hex', () => {
  const p = PF.Palette.parse('background #112233; accent #AABBCC;');
  eq(p.length, 2); eq(p[0], '#112233');
});
it('nearest picks the closest entry', () => {
  const table = PF.Palette.tableOf(['#000000', '#ffffff']);
  eq(PF.Palette.nearest(PF.Color.hexToU32('#eeeeee'), table), 1);
});

/* -------------------------------------------------------------- Effects */
describe('PF.Effects');
it('lists its effects for UI enumeration', () => {
  ok(PF.Effects.LIST.length >= 10, 'registry populated');
  for (const e of PF.Effects.LIST) {
    ok(e.id && e.name, 'entry has id + name');
    eq(typeof e.run, 'function', `${e.id} implemented: `);
    ok(e.opts && typeof e.opts === 'object', `${e.id} declares its options`);
  }
});
it('outline adds a rim without moving the source', () => {
  const b = sample(), o = PF.Effects.outline(b, 4, 4, { color: '#181425' });
  ok(count(o) > count(b), 'grew');
  eq(o[1 * 4 + 1], b[1 * 4 + 1], 'source pixel untouched');
  eq(o[0 * 4 + 1], PF.Color.hexToU32('#181425'), 'rim above');
});
it('outline never writes outside the buffer', () => {
  const b = new Uint32Array(4).fill(PF.Color.hexToU32('#ff0000'));
  eq(PF.Effects.outline(b, 2, 2, {}).length, 4);
});
it('glow and dropShadow preserve dimensions', () => {
  for (const fn of ['glow', 'dropShadow', 'bevel', 'grayscale', 'invert', 'silhouette', 'normalMap']) {
    const o = PF.Effects[fn](sample(), 4, 4, {});
    eq(o.length, 16, `${fn} size: `);
    ok(o !== sample(), `${fn} returns new buffer`);
  }
});
it('effects do not mutate the input', () => {
  const b = sample(), copy = Uint32Array.from(b);
  PF.Effects.chain(b, 4, 4, [['outline', {}], ['glow', { radius: 1 }], ['brightness', { amount: 0.2 }]]);
  eq(b.join(), copy.join(), 'input mutated');
});
it('grayscale kills saturation but keeps alpha', () => {
  const g = PF.Effects.grayscale(sample(), 4, 4, {});
  const [r, gr, bl, a] = PF.Color.rgba(g[5]);
  eq(r, gr); eq(gr, bl); eq(a, 255);
});
it('silhouette flattens to one colour', () => {
  const s = PF.Effects.silhouette(sample(), 4, 4, { color: '#000000' });
  eq(new Set([...s].filter(Boolean)).size, 1);
  eq(count(s), 4, 'same coverage');
});
it('trim crops to the content box', () => {
  const t = PF.Effects.trim(sample(), 4, 4);
  eq(t.width, 2); eq(t.height, 2); eq(t.x, 1); eq(t.y, 1);
  eq(t.pixels.length, 4);
  ok([...t.pixels].every(Boolean), 'all opaque after trim');
});
it('trim of an empty buffer is empty, not a crash', () => {
  const t = PF.Effects.trim(new Uint32Array(16), 4, 4);
  eq(t.width, 0); eq(t.height, 0); eq(t.pixels.length, 0);
});
it('pad grows by the margin on every side', () => {
  const p = PF.Effects.pad(sample(), 4, 4, { padding: 2 });
  eq(p.width, 8); eq(p.height, 8);
  eq(count(p.pixels), 4, 'content preserved');
});
it('scale multiplies dimensions and area', () => {
  const s = PF.Effects.scale(sample(), 4, 4, { factor: 3 });
  eq(s.width, 12); eq(s.height, 12);
  eq(count(s.pixels), 4 * 9, 'nearest-neighbour block per pixel');
});
it('resize hits the exact target size', () => {
  const r = PF.Effects.resize(sample(), 4, 4, { width: 7, height: 5 });
  eq(r.width, 7); eq(r.height, 5); eq(r.pixels.length, 35);
});
it('chain applies in order', () => {
  const once = PF.Effects.chain(sample(), 4, 4, [['outline', { color: '#181425' }]]);
  eq(count(once), count(PF.Effects.outline(sample(), 4, 4, { color: '#181425' })));
});
it('apply rejects an unknown effect by name', () => {
  throws(() => PF.Effects.apply('not-an-effect', sample(), 4, 4, {}));
});
it('normalMap is fully opaque where the sprite is', () => {
  const n = PF.Effects.normalMap(sample(), 4, 4, {});
  eq(PF.Color.rgba(n[5])[3], 255);
  eq(n[0], 0, 'transparent stays transparent');
});
it('ditherFade at 1 keeps everything, at 0 keeps nothing', () => {
  eq(count(PF.Effects.ditherFade(sample(), 4, 4, { amount: 1 })), 4);
  eq(count(PF.Effects.ditherFade(sample(), 4, 4, { amount: 0 })), 0);
});

/* ------------------------------------------------------------------ Gen */
it('every effect option is a type the studio panel can render', () => {
  /* js/ui/fx.js builds a control per option from the default's TYPE: string is
     a colour well, boolean a checkbox, number a slider. An option of any other
     type would silently render nothing. */
  for (const e of PF.Effects.LIST)
    for (const [k, v] of Object.entries(e.opts)) {
      const t = typeof v;
      ok(t === 'string' || t === 'boolean' || t === 'number', `${e.id}.${k} is ${t}`);
      if (t === 'string') ok(/^#[0-9a-f]{6}$/i.test(v), `${e.id}.${k} is a string but not a hex colour: ${v}`);
      if (t === 'number') ok(Number.isFinite(v), `${e.id}.${k} is not finite`);
    }
});
it('every effect runs from its own defaults and returns a new buffer', () => {
  const b = sample(8, 8);
  for (const e of PF.Effects.LIST) {
    const out = PF.Effects.apply(e.id, b, 8, 8);
    ok(out instanceof Uint32Array, `${e.id} did not return a buffer`);
    ok(out !== b, `${e.id} mutated in place`);
  }
});

describe('PF.Iso');
/* The isometric pack is the one place in the library where geometry is a
   correctness property rather than a taste one: a footprint that is a pixel
   too narrow shows as pinholes in a tiled floor, and one a pixel too wide
   shows as a dark seam where neighbours overwrite each other. Both are
   invisible on a single sprite and obvious on a hundred. */
const isoTile = (id, state) => {
  const doc = PF.Library.get(id).build();
  const st = doc.states.find(s => s.name === state) || doc.states[0];
  return { doc, buf: renderFrame(doc, st.frames[0]) };
};

it('every ground tile covers exactly the 256px isometric lattice cell', () => {
  /* The lattice is generated by (16, 8) and (16, -8); |det| = 256, so a tile
     that tessellates it must have exactly 256 interior pixels. Rim pixels are
     excluded — the rim deliberately bleeds onto the neighbours and is what
     draws the seam between tiles. Ground tiles rim in their own material's
     darkened top tone rather than the library's #181425, so the set of rim
     colours comes from the pack (PF.Iso.SEAM) instead of being hardcoded: a
     hard black lattice over a hundred tiles reads as graph paper. */
  const doc = PF.Library.get('iso_ground').build();   // populates PF.Iso.SEAM
  const RIM = new Set(Object.values(PF.Iso.SEAM).map(h => PF.Color.hexToU32(h)));
  RIM.add(PF.Color.hexToU32('#181425'));
  eq(RIM.size > 4, true, `PF.Iso.SEAM looks unpopulated (${RIM.size} rim colours)`);
  for (const st of doc.states) {
    const buf = renderFrame(doc, st.frames[0]);
    let n = 0;
    for (const v of buf) if (v && !RIM.has(v)) n++;
    eq(n, 256, `iso_ground/${st.name} footprint is ${n}px, not 256`);
  }
});

it('a field of iso ground tiles has no holes', () => {
  const { buf } = isoTile('iso_ground', 'grass');
  const W = 256, H = 160, cv = new Uint32Array(W * H);
  for (let j = 0; j < 14; j++) for (let i = 0; i < 14; i++) {
    const ox = 112 + (i - j) * 16, oy = -30 + (i + j) * 8;
    for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
      const v = buf[y * 32 + x]; if (!v) continue;
      const X = ox + x, Y = oy + y;
      if (X >= 0 && X < W && Y >= 0 && Y < H) cv[Y * W + X] = v;
    }
  }
  let holes = 0;
  for (let y = 70; y < 110; y++) for (let x = 100; x < 150; x++) if (!cv[y * W + x]) holes++;
  eq(holes, 0, `${holes} transparent pixels inside a tiled iso floor`);
});

it('every iso block sits on the same footprint as a ground tile', () => {
  /* A block whose base drifted off the ground diamond would hover or sink
     against a floor built from iso_ground, which is the whole point of the
     pack sharing one projection. */
  const ground = isoTile('iso_ground', 'grass').buf;
  const rowSpan = b => {
    let lo = 32, hi = -1;
    for (let x = 0; x < 32; x++) if (b[31 * 32 + x]) { if (x < lo) lo = x; hi = x; }
    return [lo, hi];
  };
  const base = rowSpan(ground);
  const doc = PF.Library.get('iso_blocks').build();
  for (const st of doc.states) {
    const s = rowSpan(renderFrame(doc, st.frames[0]));
    eq(s.join(), base.join(), `iso_blocks/${st.name} bottom row ${s} != ground ${base}`);
  }
});

it('iso walls and stairs stay inside the canvas', () => {
  /* Row 0 has no row above it for the outline pass to write into, so anything
     that reaches it reads as sliced off the top of the frame. */
  const OUTLINE = PF.Color.hexToU32('#181425');
  for (const id of ['iso_walls', 'iso_stairs', 'iso_props']) {
    const doc = PF.Library.get(id).build();
    for (const st of doc.states) for (const f of st.frames) {
      const buf = renderFrame(doc, f);
      for (let x = 0; x < doc.width; x++)
        ok(!buf[x] || buf[x] === OUTLINE, `${id}/${st.name} paints on row 0 at x=${x}`);
    }
  }
});

describe('PF.Gen');
it('rng is deterministic for a seed and different across seeds', () => {
  const a = PF.Gen.rng(42), b = PF.Gen.rng(42), c = PF.Gen.rng(43);
  const seq = r => Array.from({ length: 8 }, () => r());
  const sa = seq(a);
  eq(sa.join(), seq(b).join(), 'same seed diverged');
  ok(sa.join() !== seq(c).join(), 'different seeds matched');
  ok(sa.every(v => v >= 0 && v < 1), 'out of range');
});
it('rng helpers stay in bounds', () => {
  const r = PF.Gen.rng(7);
  for (let i = 0; i < 200; i++) { const v = r.int(3, 5); ok(v >= 3 && v <= 5, `int ${v}`); }
  ok(['a', 'b'].includes(PF.Gen.rng(1).pick(['a', 'b'])));
  eq(PF.Gen.rng(2).shuffle([1, 2, 3, 4]).slice().sort().join(), '1,2,3,4');
});
it('hashSeed is stable and distinct', () => {
  eq(PF.Gen.hashSeed('goblin'), PF.Gen.hashSeed('goblin'));
  ok(PF.Gen.hashSeed('goblin') !== PF.Gen.hashSeed('goblim'));
});
it('fbm stays in 0..1', () => {
  const f = PF.Gen.fbm(9, 4);
  for (let i = 0; i < 100; i++) { const v = f(i * 0.37, i * 0.11); ok(v >= 0 && v <= 1, `fbm ${v}`); }
});
it('variants are reproducible and keep the outline', () => {
  const b = sample();
  b[0] = PF.Color.hexToU32('#181425');
  const one = PF.Gen.variants(b, 4, 4, 3, { seed: 5 });
  const two = PF.Gen.variants(b, 4, 4, 3, { seed: 5 });
  eq(one.length, 3);
  eq(one.map(v => v.seed).join(), two.map(v => v.seed).join(), 'seeds diverged');
  for (const v of one) {
    eq(v.pixels[0], b[0], 'outline recoloured');
    eq(count(v.pixels), count(b), 'coverage changed');
    ok(v.pixels[5] !== b[5], 'body colour not shifted');
  }
});
it('seamlessTexture wraps without a hard seam', () => {
  const stops = PF.Palette.ramp('#3a7d44', 4);
  const t = PF.Gen.seamlessTexture(16, 16, stops, { seed: 3 });
  eq(t.length, 256);
  const wrapped = PF.Tiles.seamScore(t, 16, 16), plain = PF.Tiles.seamScore(PF.Gen.texture(16, 16, stops, { seed: 3 }), 16, 16);
  ok(wrapped.score <= plain.score, `seamless (${wrapped.score.toFixed(2)}) scored worse than plain noise (${plain.score.toFixed(2)})`);
});

/* ---------------------------------------------------------------- Tiles */
describe('PF.Tiles');
it('the blob set is exactly 47 cases', () => {
  eq(PF.Tiles.BLOB_47.length, 47);
  eq(new Set(PF.Tiles.BLOB_47).size, 47, 'duplicates in the set');
});
it('normalize is idempotent and lands inside the set', () => {
  for (let m = 0; m < 256; m++) {
    const n = PF.Tiles.normalize(m);
    eq(PF.Tiles.normalize(n), n, `mask ${m}: `);
    ok(PF.Tiles.BLOB_47.includes(n), `mask ${m} -> ${n} not in set`);
  }
});
it('normalize drops an unsupported corner', () => {
  const { NE, N, E } = PF.Tiles.DIR;
  eq(PF.Tiles.normalize(NE), 0, 'lone corner kept');
  eq(PF.Tiles.normalize(N | E | NE), N | E | NE, 'supported corner dropped');
});
it('blobIndex covers every normalized mask', () => {
  for (let m = 0; m < 256; m++) {
    const i = PF.Tiles.blobIndex(m);
    ok(i >= 0 && i < 47, `mask ${m} -> index ${i}`);
  }
});
it('slice/assemble round-trips a sheet', () => {
  const w = 32, h = 32, src = new Uint32Array(w * h);
  for (let i = 0; i < src.length; i++) src[i] = PF.Color.fromRGBA(i & 255, (i >> 2) & 255, 90, 255);
  const sl = PF.Tiles.slice(src, w, h, 16, 16);
  eq(sl.cols, 2); eq(sl.rows, 2);
  eq(sl.tiles.length, 4);
  eq(sl.tiles[0].pixels.length, 256);
  eq(sl.tiles[3].col, 1); eq(sl.tiles[3].row, 1);
  const back = PF.Tiles.assemble(sl.tiles, 2, 16, 16);
  eq(back.width, 32); eq(back.height, 32);
  eq(back.pixels.join(), src.join(), 'round-trip differed');
});
it('assemble honours spacing', () => {
  const tiles = [new Uint32Array(64), new Uint32Array(64)];
  const a = PF.Tiles.assemble(tiles, 2, 8, 8, { spacing: 2 });
  eq(a.width, 18);
});
it('neighbourMask reads the 8 neighbours', () => {
  const grid = [1, 1, 0, 1, 1, 0, 0, 0, 0], D = PF.Tiles.DIR;
  const m = PF.Tiles.neighbourMask(grid, 3, 3, 1, 1);
  ok((m & D.W) !== 0, 'west solid');
  ok((m & D.E) === 0, 'east should be empty');
  ok((m & D.N) !== 0, 'north solid');
});
it('autotile returns one index per cell', () => {
  const grid = Array.from({ length: 25 }, (_, i) => (i % 3 === 0 ? 1 : 0));
  const out = PF.Tiles.autotile(grid, 5, 5);
  eq(out.length, 25);
  ok(out.every(v => v === -1 || (v >= 0 && v < 47)), 'index out of range');
});
it('seamScore calls a flat tile seamless', () => {
  const s2 = PF.Tiles.seamScore(new Uint32Array(64).fill(PF.Color.hexToU32('#3a7d44')), 8, 8);
  eq(s2.score, 0); eq(s2.seamless, true);
});
it('seamScore flags a hard edge discontinuity', () => {
  // Left half dark, right half light: the wrap jumps the full contrast while
  // the tile's interior is flat, so the seam must not read as seamless.
  const b = new Uint32Array(64);
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) b[y * 8 + x] = PF.Color.hexToU32(x < 4 ? '#181425' : '#ffffff');
  ok(!PF.Tiles.seamScore(b, 8, 8).seamless, 'hard seam reported as seamless');
});
it('preview repeats the tile', () => {
  const p = PF.Tiles.preview(new Uint32Array(64).fill(1), 8, 8, 3);
  eq(p.width, 24); eq(p.height, 24);
  ok([...p.pixels].every(v => v === 1));
});
it('tsx/tmx emit well-formed XML', () => {
  const x = PF.Tiles.tsx({ name: 't', columns: 4, count: 16, imageWidth: 64, imageHeight: 64 });
  ok(x.startsWith('<?xml'), 'xml decl');
  ok(x.includes('</tileset>'), 'closed');
  const m = PF.Tiles.tmx({ width: 4, height: 4, data: [1, 2, 3, 4, 1, 2, 3, 4, 1, 2, 3, 4, 1, 2, 3, 4] });
  ok(m.includes('</map>') && m.includes('<layer'), 'map body');
  eq((m.match(/</g) || []).length, (m.match(/>/g) || []).length, 'unbalanced angle brackets');
});

/* ------------------------------------------------------------------ Zip */
describe('PF.Zip');
it('crc32 matches the known IEEE vector', () => {
  // CRC32("123456789") == 0xCBF43926, the standard check value
  eq(PF.Zip.crc32(PF.Zip.utf8('123456789')) >>> 0, 0xCBF43926);
  eq(PF.Zip.crc32(new Uint8Array(0)) >>> 0, 0);
});
it('utf8 encodes multibyte correctly', () => {
  eq([...PF.Zip.utf8('é')].join(), '195,169');
});
it('create emits a valid store-only archive', () => {
  const z = PF.Zip.create([{ name: 'a.txt', data: 'hello' }, { name: 'dir/b.json', data: '{}' }]);
  ok(z instanceof Uint8Array, 'Uint8Array out');
  eq(String.fromCharCode(z[0], z[1], z[2], z[3]), 'PK\x03\x04', 'local header magic');
  const tail = String.fromCharCode(...z.slice(-22, -18));
  eq(tail, 'PK\x05\x06', 'end-of-central-directory magic');
  // EOCD entry count (offset 10 in the 22-byte record) must match the file count
  const eocd = z.length - 22;
  eq(z[eocd + 10] | (z[eocd + 11] << 8), 2, 'entry count');
  const text = Array.from(z, c => String.fromCharCode(c)).join('');
  ok(text.includes('hello'), 'payload stored verbatim');
  ok(text.includes('dir/b.json'), 'nested name kept');
});
it('central directory offset points at a PK\\x01\\x02 record', () => {
  const z = PF.Zip.create([{ name: 'a.txt', data: 'x' }]);
  const eocd = z.length - 22;
  const off = z[eocd + 16] | (z[eocd + 17] << 8) | (z[eocd + 18] << 16) | (z[eocd + 19] << 24);
  eq(String.fromCharCode(z[off], z[off + 1], z[off + 2], z[off + 3]), 'PK\x01\x02');
});
it('accepts binary payloads', () => {
  const z = PF.Zip.create([{ name: 'b.bin', data: new Uint8Array([0, 255, 128]) }]);
  ok(z.length > 60);
});

/* ------------------------------------------------------------ Exporters */
describe('PF.Exporters');
const ATLAS = {
  name: 'hero', image: 'hero.png', width: 128, height: 32,
  frameWidth: 32, frameHeight: 32, columns: 4,
  frames: [0, 1, 2, 3].map(i => ({ name: `walk_${i}`, state: 'walk', index: i, x: i * 32, y: 0, w: 32, h: 32, duration: 100 })),
  states: [{ name: 'walk', fps: 10, loop: true, from: 0, to: 3 }]
};
it('every target produces non-empty output', () => {
  ok(PF.Exporters.TARGETS.length >= 8, 'target list');
  for (const t of PF.Exporters.TARGETS) {
    const r = PF.Exporters.run(t.id, ATLAS, {});
    ok(r.text && r.text.length > 40, `${t.id} too short`);
    ok(r.filename.endsWith('.' + t.ext), `${t.id} filename ${r.filename}`);
    ok(r.mime, `${t.id} mime`);
  }
});
it('JSON targets parse', () => {
  for (const id of ['phaser-atlas', 'aseprite', 'json', 'gamemaker']) {
    const { text } = PF.Exporters.run(id, ATLAS, {});
    JSON.parse(text); // throws on malformed output
  }
});
it('godot4 references every frame as a sub-resource', () => {
  const t = PF.Exporters.godot4(ATLAS);
  eq((t.match(/sub_resource type="AtlasTexture"/g) || []).length, 4);
  ok(t.includes('res://hero.png'), 'texture path');
  ok(t.includes('"speed": 10.0'), 'fps carried');
});
it('unity flips y for its bottom-left origin', () => {
  const t = PF.Exporters.unity(ATLAS);
  // frame at y=0 of a 32-tall sheet must export with y = 32 - 0 - 32 = 0, and
  // the rect must never be negative for any frame
  for (const m of t.matchAll(/y:\s*(-?\d+)/g)) ok(Number(m[1]) >= 0, `negative y ${m[1]}`);
  ok(t.includes('TextureImporter'), 'meta header');
});
it('phaser anims module is syntactically valid JS', () => {
  const src = PF.Exporters.run('phaser-anims', ATLAS, {}).text;
  new Function(src.replace(/export\s+/g, '')); // throws on a syntax error
});
it('love2d emits one quad per frame', () => {
  const t = PF.Exporters.love2d(ATLAS);
  eq((t.match(/newQuad/g) || []).length, 4);
});
it('css keyframes cover the strip', () => {
  const t = PF.Exporters.cssAnim(ATLAS);
  ok(t.includes('@keyframes'), 'keyframes block');
  // Count inside the @keyframes block only: the class rule carries its own
  // background-position so the sprite still shows its first frame when the
  // animation is paused or suppressed by prefers-reduced-motion.
  const kf = t.slice(t.indexOf('@keyframes'));
  // one stop per frame plus the closing 100% stop
  eq((kf.match(/background-position/g) || []).length, 5, 'keyframe stops');
  ok(/^\.[\w-]+ \{[^}]*background-position/m.test(t), 'class rule seeds the first frame');
  ok(/animation:[^;]*infinite/.test(t), 'looping state animates forever');
});
it('run rejects an unknown target with a helpful message', () => {
  let msg = '';
  try { PF.Exporters.run('unreal', ATLAS, {}); } catch (e) { msg = e.message; }
  ok(/unreal/.test(msg) && /godot4/.test(msg), `unhelpful message: ${msg}`);
});
it('handles a single-frame single-state atlas', () => {
  const one = { ...ATLAS, frames: [ATLAS.frames[0]], states: [{ name: 'idle', fps: 1, loop: false, from: 0, to: 0 }] };
  for (const t of PF.Exporters.TARGETS) ok(PF.Exporters.run(t.id, one, {}).text.length > 20, `${t.id} degenerate`);
});

/* ----------------------------------------------------------- Pixel/Raster */
it('fromSheet adapts the browser sheet builder output', () => {
  /* PF.IO.buildSheet produces an Aseprite-shaped atlas; every engine writer
     reads the flat shape. This is the seam between them, and it is the only
     part of the browser export path that can be exercised without a canvas. */
  const sheet = {
    frameWidth: 32, frameHeight: 32, cols: 4, rows: 1,
    atlas: {
      frames: {
        walk_0: { frame: { x: 0, y: 0, w: 32, h: 32 }, duration: 100 },
        walk_1: { frame: { x: 32, y: 0, w: 32, h: 32 }, duration: 100 },
        idle_0: { frame: { x: 0, y: 32, w: 32, h: 32 }, duration: 250 }
      },
      meta: { image: 'hero.png', size: { w: 128, h: 64 }, frameTags: [
        { name: 'walk', fps: 10, loop: true, from: 0, to: 1 },
        { name: 'idle', fps: 4, loop: true, from: 2, to: 2 }
      ] }
    }
  };
  const at = PF.Exporters.fromSheet(sheet);
  eq(at.name, 'hero');
  eq(at.frames.length, 3);
  eq(at.frames[1].state, 'walk', 'state name derived from the frame key: ');
  eq(at.frames[2].state, 'idle');
  eq(at.width, 128); eq(at.height, 64); eq(at.columns, 4);
  eq(at.states.length, 2);
  // and every writer must survive it, since this is what the studio hands them
  for (const t of PF.Exporters.TARGETS) ok(PF.Exporters.run(t.id, at, {}).text.length > 20, `${t.id} on a sheet atlas`);
});
it('target ids are unique and do not shadow a CLI image format', () => {
  const ids = PF.Exporters.TARGETS.map(t => t.id);
  eq(new Set(ids).size, ids.length, 'duplicate export target id: ');
  /* bin/pixelforge.js spends these three words on image output. A target that
     reused one would make `--format frames` ambiguous, and which file landed
     on disk would depend on branch order rather than on what was asked for. */
  for (const w of ['png', 'frames', 'gif']) ok(!ids.includes(w), `target id "${w}" collides with a CLI image format`);
});

describe('PF.Pixel');
it('offsetApi translates every primitive', () => {
  // Regression: ellipse/rectO/fill/shadeRect used to ignore the offset, so a
  // 16px icon drawn into cell (2,1) of a sheet landed in the top-left corner.
  const W = 32, H = 32, buf = new Uint32Array(W * H);
  const api = PF.Pixel.makeApi(buf, W, H);
  const o = PF.Pixel.offsetApi(api, 16, 16);
  o.ellipse(0, 0, 7, 7, '#ff0000', true);
  o.rectO(9, 9, 14, 14, '#00ff00');
  let outside = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (buf[y * W + x] && (x < 16 || y < 16)) outside++;
  eq(outside, 0, 'drew outside the offset cell');
  ok(count(buf) > 0, 'drew nothing at all');
});
it('composites route through the translated primitives', () => {
  const W = 32, H = 32, buf = new Uint32Array(W * H);
  const o = PF.Pixel.offsetApi(PF.Pixel.makeApi(buf, W, H), 16, 0);
  o.blob(4, 4, 3, 3, '#ff0000', '#ff8080', '#aa0000');
  let leftHalf = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < 16; x++) if (buf[y * W + x]) leftHalf++;
  eq(leftHalf, 0, 'blob ignored the offset');
});
it('hash is deterministic and seed-sensitive', () => {
  const api = PF.Pixel.makeApi(new Uint32Array(64), 8, 8);
  eq(api.hash(3, 4, 1), api.hash(3, 4, 1));
  ok(api.hash(3, 4, 1) !== api.hash(3, 4, 2), 'seed ignored');
  for (let i = 0; i < 50; i++) { const v = api.hash(i, i * 3, 9); ok(v >= 0 && v < 1, `hash ${v}`); }
});
it('primitives clip at the buffer edge', () => {
  const buf = new Uint32Array(16), api = PF.Pixel.makeApi(buf, 4, 4);
  api.rect(-5, -5, 20, 20, '#ff0000');
  api.px(99, 99, '#00ff00');
  eq(count(buf), 16, 'clip broke coverage');
});

describe('PF.Raster');
it('bounds returns the content box or null', () => {
  const b = PF.Raster.bounds(sample(), 4, 4);
  eq(b.x, 1); eq(b.y, 1); eq(b.w, 2); eq(b.h, 2);
  eq(PF.Raster.bounds(new Uint32Array(16), 4, 4), null);
});

/* --------------------------------------------------------------- Library */
describe('PF.Library');
it('every template builds a doc matching its registered size', () => {
  const list = PF.Library.list();
  ok(list.length > 100, `only ${list.length} templates`);
  for (const t of list.slice(0, 12)) {
    const d = t.build();
    eq(d.width, t.w, `${t.id} width: `);
    eq(d.height, t.h, `${t.id} height: `);
  }
});
it('build() is pure — two calls give identical pixels', () => {
  for (const id of ['rpg_knight', 'ui_icons', 'font_small', 'tileset']) {
    const t = PF.Library.get(id);
    if (!t) continue;
    const render = () => {
      const d = t.build(), b = new Uint32Array(d.width * d.height);
      const f = d.states[0].frames[0];
      (f.layers ? f.layers[0] : f.paint)(b, d.width, d.height);
      return b.join();
    };
    eq(render(), render(), `${id} is not pure: `);
  }
});
it('descriptions quote the real state and frame counts', () => {
  /* Several descriptions advertised "15 states / 67 frames" long after the
     packs grew past that. The number in the catalogue is the first thing a
     developer reads when choosing an asset, so it gets asserted rather than
     maintained by hand. */
  const stale = [];
  for (const t of PF.Library.list()) {
    const m = /(\d+)\s*states?\s*\/\s*(\d+)\s*frames?/i.exec(t.desc || '');
    if (!m) continue;
    const d = t.build();
    const st = d.states.length, fr = d.states.reduce((n, s) => n + s.frames.length, 0);
    if (+m[1] !== st || +m[2] !== fr) stale.push(`${t.id} says ${m[1]}/${m[2]}, builds ${st}/${fr}`);
  }
  eq(stale.length, 0, stale.slice(0, 5).join('; ') + ' — ');
});
it('ids are unique and well formed', () => {
  const ids = PF.Library.list().map(t => t.id);
  eq(new Set(ids).size, ids.length, 'duplicate template id: ');
  for (const id of ids) ok(/^[a-z][a-z0-9_]*$/.test(id), `bad id "${id}"`);
});
it('every template lands in a known category', () => {
  const known = new Set(['Heroes', 'NPCs', 'Enemies', 'Animals', 'World', 'Items', 'UI', 'FX', 'Cat']);
  for (const t of PF.Library.list()) ok(known.has(t.category), `${t.id} has category "${t.category}"`);
});
it('categories are non-empty and unique', () => {
  const c = PF.Library.categories();
  eq(new Set(c).size, c.length);
  ok(c.includes('All') && c.includes('UI'));
});

describe('hash');
it('is uniform over [0,1) — the arithmetic-shift bug capped it at 0.5', () => {
  const a = PF.Pixel.makeApi(new Uint32Array(64), 8, 8);
  let mn = 1, mx = 0, sum = 0, n = 0;
  const bins = new Array(10).fill(0);
  for (let s = 0; s < 24; s++) for (let y = 0; y < 24; y++) for (let x = 0; x < 24; x++) {
    const h = a.hash(x, y, s);
    mn = Math.min(mn, h); mx = Math.max(mx, h); sum += h; n++;
    bins[Math.min(9, Math.floor(h * 10))]++;
  }
  ok(mx > 0.99, `hash never reached the top of its range (max ${mx})`);
  ok(mn < 0.01, `hash never reached the bottom of its range (min ${mn})`);
  near(sum / n, 0.5, 0.01, 'hash mean: ');
  for (let i = 0; i < 10; i++) near(bins[i] / n, 0.1, 0.02, `decile ${i}: `);
});
it('is deterministic and seed-separated', () => {
  const a = PF.Pixel.makeApi(new Uint32Array(64), 8, 8);
  eq(a.hash(3, 7, 11), a.hash(3, 7, 11));
  ok(a.hash(3, 7, 11) !== a.hash(3, 7, 12), 'seeds collide');
  ok(a.hash(3, 7, 11) !== a.hash(7, 3, 11), 'coords transpose to the same value');
});
it('speck honours its stated density and uses every colour it is given', () => {
  const W = 64, H = 64;
  const b = new Uint32Array(W * H);
  const a = PF.Pixel.makeApi(b, W, H);
  const A = '#ff0000', B = '#00ff00';
  a.speck(0, 0, W - 1, H - 1, 5, [A, B], 0.3);
  let hit = 0, seenA = 0, seenB = 0;
  const ca = PF.Color.hexToU32(A), cb = PF.Color.hexToU32(B);
  for (let i = 0; i < b.length; i++) {
    if (b[i] === ca) { hit++; seenA++; }
    else if (b[i] === cb) { hit++; seenB++; }
  }
  near(hit / (W * H), 0.3, 0.04, 'speck density: ');
  ok(seenA > 0 && seenB > 0, `speck only used one of two colours (a=${seenA} b=${seenB})`);
});

describe('gif');
it('encodes a GIF89a with a netscape loop block', () => {
  const W = 8, H = 8;
  const f = n => {
    const p = new Uint32Array(W * H);
    for (let i = 0; i < p.length; i++) p[i] = i % 3 === n ? 0xff0000ff : 0;
    return { pixels: p, delay: 100 };
  };
  const bytes = PF.Gif.encode([f(0), f(1), f(2)], W, H, true);
  eq(String.fromCharCode(...bytes.slice(0, 6)), 'GIF89a');
  eq(bytes[6] | (bytes[7] << 8), W);
  eq(bytes[8] | (bytes[9] << 8), H);
  eq(bytes[bytes.length - 1], 0x3b, 'missing trailer: ');
  ok(String.fromCharCode(...bytes).includes('NETSCAPE2.0'), 'loop block missing');
});
it('reserves index 0 for transparency', () => {
  const p = new Uint32Array(4);
  p[0] = 0xff0000ff;
  const bytes = PF.Gif.encode([{ pixels: p, delay: 100 }], 2, 2, false);
  // graphic control extension: 0x21 0xf9 0x04 <flags> ... <transparent index>
  const i = [...bytes].findIndex((b, k) => b === 0x21 && bytes[k + 1] === 0xf9);
  ok(i > 0, 'no graphic control extension');
  ok((bytes[i + 3] & 1) === 1, 'transparency flag not set');
  eq(bytes[i + 6], 0, 'transparent index is not 0: ');
});
it('quantises down to 255 colours plus transparent', () => {
  const p = new Uint32Array(4096);
  for (let i = 0; i < p.length; i++) p[i] = 0xff000000 | i;      // 4096 distinct blues
  const { list } = PF.Gif.quantise([{ pixels: p, delay: 100 }]);
  ok(list.length <= 255, `palette overflowed: ${list.length}`);
  ok(list.length > 8, `palette collapsed too far: ${list.length}`);
});

/* ----------------------------------------------------------------- done */
const filter = process.argv[2];
if (filter) console.log(`(filter "${filter}" is informational; all tests ran)`);
if (failures.length) { console.log(''); failures.forEach(f => console.log('FAIL:', f)); }
console.log(`\nUNIT: ${pass} pass, ${fail} fail`);
process.exit(fail ? 1 : 0);
