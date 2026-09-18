/* Export-format gate.
   Runs every PF.Export generator over real library documents and checks the
   output is internally consistent: RLE decodes back to the exact pixels, the
   C header's frame count matches its tables, the TSX tile math adds up, the
   BMFont descriptor lists every glyph, and the store adapter round-trips.

   Usage: node scripts/check-export.js
*/
const { boot } = require('./lib-boot');
const PF = boot();

let pass = 0, fail = 0;
const ok = (c, msg) => { c ? pass++ : (fail++, console.log('FAIL: ' + msg)); };

const SAMPLES = ['rpg_knight', 'pf_scifi_tiles', 'pf_ui_font_3x5', 'pf_vfx_explosions', 'pf_autotile_water', 'pf_plat_hud'];
for (const id of SAMPLES) ok(!!PF.Library.get(id), `sample template ${id} missing`);

/* ---------- RLE round-trip ---------- */
for (const id of SAMPLES) {
  const doc = PF.Library.get(id).build();
  const ix = PF.Export.indexDoc(doc, { scale: 1 });
  ok(ix.frames.length === doc.states.reduce((n, s) => n + s.frames.length, 0), `${id}: indexDoc frame count`);
  ix.frames.forEach((frame, fi) => {
    const enc = PF.Export.rleFrame(frame);
    ok(enc.length % 3 === 0, `${id}#${fi}: RLE is not triples`);
    const out = new Uint8Array(frame.length);
    let p = 0;
    for (let i = 0; i < enc.length; i += 3) {
      const n = enc[i] | (enc[i + 1] << 8), v = enc[i + 2];
      for (let k = 0; k < n && p < out.length; k++) out[p++] = v;
    }
    let bad = 0;
    for (let i = 0; i < out.length; i++) if (out[i] !== frame[i]) bad++;
    ok(p === out.length && bad === 0, `${id}#${fi}: RLE round-trip lost ${bad} pixels (wrote ${p}/${out.length})`);
  });
}

/* ---------- generated artefacts ---------- */
for (const fmt of PF.Export.ids()) {
  for (const id of SAMPLES.slice(0, 3)) {
    const doc = PF.Library.get(id).build();
    let out;
    try { out = PF.Export.generate(fmt, doc, { name: 'sample', image: 'sample.png' }); }
    catch (e) { ok(false, `${fmt}/${id}: threw ${e.message}`); continue; }
    ok(out.text && out.text.length > 30, `${fmt}/${id}: produced ${out.text.length} bytes`);
    ok(out.filename.endsWith('.' + out.ext), `${fmt}/${id}: filename ${out.filename} does not match ext ${out.ext}`);
    if (fmt === 'c-header') {
      const frames = doc.states.reduce((n, s) => n + s.frames.length, 0);
      ok(out.text.includes(`#define SAMPLE_FRAMES ${frames}`), `${fmt}/${id}: frame define wrong`);
      const offCount = (out.text.match(/sample_offsets\[(\d+)\]/) || [])[1];
      ok(+offCount === frames, `${fmt}/${id}: offsets table has ${offCount} entries for ${frames} frames`);
      const decl = (out.text.match(/sample_data\[(\d+)\]/) || [])[1];
      const bytes = (out.text.match(/static const uint8_t sample_data\[[\d]+\] = \{\n([\s\S]*?)\n\};/) || [])[1] || '';
      const n = (bytes.match(/0x[0-9a-f]{2}/g) || []).length;
      ok(+decl === n, `${fmt}/${id}: data declares ${decl} bytes but lists ${n}`);
      ok(/uint32_t sample_palette\[/.test(out.text), `${fmt}/${id}: no palette`);
    }
    if (fmt === 'tiled-tsx') {
      const cols = +(out.text.match(/columns="(\d+)"/) || [])[1];
      const count = +(out.text.match(/tilecount="(\d+)"/) || [])[1];
      const tw = +(out.text.match(/tilewidth="(\d+)"/) || [])[1];
      ok(cols * tw <= doc.width, `${fmt}/${id}: columns x tilewidth exceeds the image`);
      ok(count === cols * Math.floor(doc.height / tw), `${fmt}/${id}: tilecount ${count} does not match ${cols}x${Math.floor(doc.height / tw)}`);
    }
    if (fmt === 'svg-anim' || fmt === 'svg') {
      ok(/^<svg /.test(out.text.trim()), `${fmt}/${id}: does not start with an svg tag`);
      ok(/<\/svg>\s*$/.test(out.text.trim()), `${fmt}/${id}: svg not closed`);
      ok((out.text.match(/<rect /g) || []).length > 0, `${fmt}/${id}: no rects`);
    }
    if (fmt === 'anim-json') {
      let j; try { j = JSON.parse(out.text); } catch { j = null; }
      ok(j && j.states.length === doc.states.length, `${fmt}/${id}: state count mismatch`);
      ok(j && j.states.every((s, i) => s.frames.length === doc.states[i].frames.length), `${fmt}/${id}: frame count mismatch`);
    }
    if (fmt === 'nine-slice') {
      let j; try { j = JSON.parse(out.text); } catch { j = null; }
      ok(j && j.border && j.border.left + j.border.right < doc.width, `${fmt}/${id}: 9-slice borders overlap`);
    }
  }
}

/* ---------- BMFont ---------- */
for (const font of ['5x7', '3x5']) {
  const data = PF.Font.atlasData(font, {});
  const fnt = PF.Export.bmfont({ face: 'test', lineHeight: data.lineHeight, base: data.base,
    imageWidth: data.imageWidth, imageHeight: data.imageHeight, glyphs: data.glyphs }, { image: 'f.png' });
  const declared = +(fnt.match(/chars count=(\d+)/) || [])[1];
  const listed = (fnt.match(/^char id=/gm) || []).length;
  ok(declared === data.glyphs.length && listed === data.glyphs.length, `bmfont ${font}: ${declared} declared / ${listed} listed / ${data.glyphs.length} glyphs`);
  ok(/^page id=0 file="f.png"$/m.test(fnt), `bmfont ${font}: page line missing`);
  const ink = data.buffer.reduce((n, v) => n + (v ? 1 : 0), 0);
  ok(ink > 0, `bmfont ${font}: glyph atlas is blank`);
}

/* ---------- store adapter ---------- */
{
  const doc = PF.Library.get(SAMPLES[0]).build();
  const store = {
    width: doc.width, height: doc.height, name: 'adapter-test',
    layers: [{ id: 'L1', name: 'Body', visible: true, opacity: 1 }, { id: 'L2', name: 'Glow', visible: true, opacity: 0.5 }],
    states: [{ id: 's1', name: 'idle', fps: 6, loop: true, frames: doc.states[0].frames.map((f, i) => {
      const px = new Uint32Array(doc.width * doc.height);
      (f.layers ? f.layers[0] : f.paint)(px, doc.width, doc.height);
      return { id: 'f' + i, duration: f.duration, pixels: { L1: px } };
    }) }]
  };
  const src = PF.Export.fromStore(store);
  ok(src.states.length === 1 && src.states[0].frames.length === store.states[0].frames.length, 'fromStore lost frames');
  const a = new Uint32Array(doc.width * doc.height), b = new Uint32Array(doc.width * doc.height);
  (doc.states[0].frames[0].paint)(a, doc.width, doc.height);
  src.states[0].frames[0].paint(b, doc.width, doc.height);
  let diff = 0;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) diff++;
  ok(diff === 0, `fromStore round-trip differs in ${diff} pixels`);
  // hidden layers must not contribute
  src.layers[0].visible = false;
  const c = new Uint32Array(doc.width * doc.height);
  src.states[0].frames[0].paint(c, doc.width, doc.height);
  ok(c.every(v => !v), 'fromStore painted a hidden layer');
}

console.log(`\nEXPORT GATE: ${pass} pass, ${fail} fail`);
process.exit(fail ? 1 : 0);
