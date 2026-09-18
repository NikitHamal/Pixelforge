/* Atlas packer + serializer gate.
   The packer must never overlap, never drop a frame, never exceed its
   container and never depend on wall-clock or Math.random. Every serializer
   must mention every placement exactly once — a missing frame in an atlas
   manifest is a silently invisible sprite in the shipping game.

   Usage: node scripts/check-atlas.js
*/
const { boot } = require('./lib-boot');
const PF = boot();

let pass = 0, fail = 0;
const ok = (c, msg) => { c ? pass++ : (fail++, console.log('FAIL: ' + msg)); };

/* ---------- synthetic packs, including nasty aspect ratios ---------- */
function synth() {
  let s = 987654321;
  const rnd = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
  const rects = [];
  for (let i = 0; i < 90; i++) {
    const w = rnd() < 0.15 ? 128 : 8 + Math.floor(rnd() * 40);
    const h = rnd() < 0.15 ? 4 : 8 + Math.floor(rnd() * 40);
    rects.push({ id: 'r' + i, w, h });
  }
  return rects;
}

const items = synth();
for (const padding of [0, 1, 2]) {
  const atlas = PF.Atlas.pack(items, { padding, maxSize: 1024 });
  ok(atlas.count === items.length, `padding ${padding}: packed ${atlas.count} of ${items.length}`);
  const occ = new Uint8Array(atlas.width * atlas.height);
  let overlap = 0, outside = 0;
  for (const p of atlas.placements) {
    if (p.x < 0 || p.y < 0 || p.x + p.w > atlas.width || p.y + p.h > atlas.height) outside++;
    for (let y = p.y; y < p.y + p.h; y++) for (let x = p.x; x < p.x + p.w; x++) {
      const i = y * atlas.width + x;
      if (occ[i]) overlap++; else occ[i] = 1;
    }
  }
  ok(overlap === 0, `padding ${padding}: ${overlap} overlapping pixels`);
  ok(outside === 0, `padding ${padding}: ${outside} placements outside the sheet`);
  ok(atlas.efficiency > 0.5, `padding ${padding}: efficiency ${atlas.efficiency} is poor`);
  const again = PF.Atlas.pack(items, { padding, maxSize: 1024 });
  ok(JSON.stringify(again.placements) === JSON.stringify(atlas.placements), `padding ${padding}: packing is not deterministic`);
}

/* Power-of-two mode must stay inside the budget and keep everything. */
{
  const p2 = PF.Atlas.pack(items, { padding: 1, maxSize: 1024, powerOfTwo: true });
  const pot = n => (n & (n - 1)) === 0;
  ok(pot(p2.width) && pot(p2.height), `powerOfTwo produced ${p2.width}x${p2.height}`);
  ok(p2.count === items.length, 'powerOfTwo lost frames');
}

/* ---------- plan() over real templates ---------- */
const tpl = PF.Library.list().filter(t => t.w === 32).slice(0, 12);
const entries = tpl.map(t => ({ id: t.id, doc: t.build() }));
const planned = PF.Atlas.plan(entries, { padding: 1, maxSize: 2048 });
ok(planned.frames.length === entries.reduce((n, e) => n + e.doc.states.reduce((m, s) => m + s.frames.length, 0), 0),
  `plan lost frames (${planned.frames.length})`);
for (const f of planned.frames) ok(f.x >= 0 && f.y >= 0 && f.x + f.w <= planned.width, `frame ${f.id} outside the sheet`);

/* ---------- serializers ---------- */
const opts = { image: 'test.png', name: 'test', docName: 'test' };
for (const id of PF.Atlas.ids()) {
  let out;
  try { out = PF.Atlas.write(id, planned, opts); } catch (e) { ok(false, `${id}: threw ${e.message}`); continue; }
  ok(out.text && out.text.length > 50, `${id}: produced ${out.text.length} bytes`);
  const text = out.text;
  if (out.ext === 'json') {
    let j = null;
    try { j = JSON.parse(text); } catch (e) { ok(false, `${id}: invalid JSON (${e.message})`); continue; }
    const names = [];
    if (Array.isArray(j.frames)) j.frames.forEach(f => names.push(f.filename));
    else for (const k of Object.keys(j.frames || {})) names.push(k);
    ok(names.length === planned.count, `${id}: manifest lists ${names.length} of ${planned.count} frames`);
    const missing = planned.placements.filter(p => !names.includes(p.id));
    ok(missing.length === 0, `${id}: ${missing.length} placements missing from the manifest`);
  } else if (out.ext === 'tres') {
    ok((text.match(/\[sub_resource type="AtlasTexture"/g) || []).length >= planned.count, `${id}: sub-resources < placements`);
    ok(/type="SpriteFrames"/.test(text), `${id}: not a SpriteFrames resource`);
    ok(/"name": &"/.test(text), `${id}: no animation names`);
  } else if (out.ext === 'meta') {
    ok((text.match(/name: /g) || []).length >= planned.count, `${id}: fewer sprites than placements`);
    ok(/spriteMode: 2/.test(text), `${id}: not a multi-sprite importer`);
  } else if (out.ext === 'xml') {
    ok((text.match(/<SubTexture /g) || []).length === planned.count, `${id}: SubTexture count mismatch`);
    ok(/<\/TextureAtlas>/.test(text), `${id}: unclosed XML`);
  } else if (out.ext === 'css') {
    for (const p of planned.placements.slice(0, 20)) ok(text.includes(`-${p.x}px -${p.y}px`), `${id}: missing background-position for ${p.id}`);
  }
}

console.log(`\nATLAS GATE: ${pass} pass, ${fail} fail`);
process.exit(fail ? 1 : 0);
