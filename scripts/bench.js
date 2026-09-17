/* Engine microbenchmarks + full-library build timing.
   Run before and after a refactor to quantify the win.

   Usage: node scripts/bench.js [label]
*/
const { boot, renderFrame } = require('./lib-boot');
const PF = boot();
const label = process.argv[2] || 'run';

const ms = fn => { const t = process.hrtime.bigint(); const r = fn(); return [Number(process.hrtime.bigint() - t) / 1e6, r]; };
const fmt = n => (n < 10 ? n.toFixed(2) : n.toFixed(1)).padStart(9);

const results = [];

/* ---------- 1. colour parsing (hottest single call in the engine) ---------- */
const HEX = ['#e8b796', '#c28569', '#3e2731', '#181425', '#0099db', '#2ce8f5', '#fee761', '#a22633'];
{
  const N = 400000;
  const [t] = ms(() => { let s = 0; for (let i = 0; i < N; i++) s += PF.Color.hexToU32(HEX[i & 7]); return s; });
  results.push(['color.hexToU32', N, t]);
}

/* ---------- 2. outline pass (runs once per rendered frame) ---------- */
{
  const W = 32, H = 32;
  const src = new Uint32Array(W * H);
  for (let y = 6; y < 26; y++) for (let x = 9; x < 24; x++) src[y * W + x] = 0xffcc8844;
  const C = PF.Color.hexToU32('#181425');
  const N = 20000;
  const [t] = ms(() => { let s = 0; for (let i = 0; i < N; i++) s += PF.Raster.outline(src, W, H, C)[0]; return s; });
  results.push(['raster.outline 32²', N, t]);
}

/* ---------- 3. layer composite ---------- */
{
  const W = 32, H = 32;
  const layers = [];
  for (let l = 0; l < 4; l++) {
    const p = new Uint32Array(W * H);
    for (let y = 4 + l; y < 28 - l; y++) for (let x = 4 + l; x < 28 - l; x++) p[y * W + x] = 0xff000000 | (0x224466 + l * 0x112233);
    layers.push({ pixels: p, visible: true, opacity: 1 });
  }
  const out = new Uint32Array(W * H);
  const N = 30000;
  const [t] = ms(() => { for (let i = 0; i < N; i++) PF.Raster.composite(out, layers); });
  results.push(['raster.composite 4L', N, t]);
}

/* ---------- 4. pixel API allocation + drawing ---------- */
{
  const W = 32, H = 32, buf = new Uint32Array(W * H);
  const N = 40000;
  const [t] = ms(() => {
    for (let i = 0; i < N; i++) {
      const api = PF.Pixel.makeApi(buf, W, H);
      api.rect(8, 8, 20, 20, '#e8b796');
      api.px(16, 16, '#181425');
      api.line(8, 24, 24, 24, '#3e2731', 2);
    }
  });
  results.push(['pixel.makeApi+draw', N, t]);
}

/* ---------- 5. full library build (every template, every frame) ---------- */
{
  const runOnce = () => {
    let templates = 0, frames = 0, px = 0;
    for (const tpl of PF.Library.list()) {
      const doc = tpl.build();
      templates++;
      for (const s of doc.states) for (const f of s.frames) { const b = renderFrame(doc, f); frames++; px += b.length; }
    }
    return { templates, frames, px };
  };
  runOnce(); // warm JIT
  let best = Infinity, stats = null;
  for (let i = 0; i < 5; i++) { const [t, s] = ms(runOnce); if (t < best) { best = t; stats = s; } }
  const t = best;
  results.push(['library build ALL', stats.frames, t]);
  console.log(`# ${label}`);
  console.log(`# templates=${stats.templates} frames=${stats.frames} pixels=${(stats.px / 1e6).toFixed(2)}M`);
}

/* ---------- report ---------- */
console.log('  ' + 'benchmark'.padEnd(22) + 'iterations'.padStart(11) + 'ms'.padStart(11) + 'ns/op'.padStart(11));
for (const [name, n, t] of results) {
  console.log('  ' + name.padEnd(22) + String(n).padStart(11) + fmt(t) + fmt((t * 1e6) / n));
}
