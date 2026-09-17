/* RPG pack quality gate — the canonical correctness check for the library.
   Builds every template, runs every painter, and asserts: shape/dimension
   agreement with the registry meta, non-empty frames, a real pixel delta
   between consecutive frames, loop closure, and ground contact for sprites
   that are supposed to stand on the floor.

   Legacy packs predate the gate, so their failures are reported as warnings
   instead of errors. Target: 0 fail.

   Usage: node scripts/check-rpg.js
*/
const { boot } = require('./lib-boot');

const PF = boot();
const list = PF.Library.list();

let pass = 0, fail = 0, warnings = 0;
const ok = (c, msg) => { c ? pass++ : (fail++, console.log('FAIL:', msg)); };
const warn = msg => { warnings++; console.log('WARN:', msg); };
const seenIds = new Set();
const isNew = id => id.startsWith('rpg_');
// Legacy packs predate the gate: report, don't fail.
const must = (tag, c, msg) => { isNew(tag) ? ok(c, msg) : (c ? pass++ : warn('LEGACY ' + msg)); };

const GROUND_CATS = new Set(['Heroes', 'NPCs', 'Enemies']);
const GROUND_IDS = new Set(['rpg_village', 'rpg_dungeon_props', 'rpg_savepoint']);
/* States that are airborne by design. Sprites no longer carry a baked shadow,
   so a jump apex legitimately has no pixel in the ground band — without this
   exemption every jump would be reported as "floating". */
const AIRBORNE = /jump|fall|dash|fly|hop|swoop|float|leap|vanish|teleport/;

for (const t of list) {
  const tag = t.id;
  ok(!seenIds.has(t.id), `${tag}: duplicate id`);
  seenIds.add(t.id);
  ok(t.desc && t.desc.length > 10, `${tag}: desc`);
  let doc;
  try { doc = t.build(); ok(true, ''); }
  catch (e) { ok(false, `${tag}: build threw ${e.message}`); continue; }
  ok(doc.width === t.w && doc.height === t.h, `${tag}: dims ${doc.width}x${doc.height} != meta ${t.w}x${t.h}`);
  ok(doc.layers.length >= 1 && doc.layers.every(l => l.name), `${tag}: layers`);
  ok(doc.states.length >= 1, `${tag}: has states`);
  const names = new Set();
  for (const s of doc.states) {
    ok(s.name && !names.has(s.name), `${tag}/${s.name}: unique state name`);
    names.add(s.name);
    ok(s.fps >= 1 && s.fps <= 60, `${tag}/${s.name}: fps ${s.fps}`);
    ok(s.frames.length >= 1, `${tag}/${s.name}: frames`);
    let prev = null;
    s.frames.forEach((f, fi) => {
      ok(f.duration >= 10, `${tag}/${s.name}#${fi}: duration ${f.duration}`);
      ok(typeof (f.layers ? f.layers[0] : f.paint) === 'function', `${tag}/${s.name}#${fi}: painter fn`);
      const buf = new Uint32Array(doc.width * doc.height);
      try { (f.layers ? f.layers[0] : f.paint)(buf, doc.width, doc.height); }
      catch (e) { ok(false, `${tag}/${s.name}#${fi}: painter threw ${e.message}`); return; }
      let n = 0, lowest = -1;
      for (let i = 0; i < buf.length; i++) if (buf[i]) { n++; const y = Math.floor(i / doc.width); if (y > lowest) lowest = y; }
      f._n = n; f._lowest = lowest;
      const minPx = t.id === 'rpg_status' ? 15 : t.category === 'FX' ? 6 : doc.width >= 64 ? 120 : 30;
      must(tag, n >= minPx, `${tag}/${s.name}#${fi}: too empty (${n}px)`);
      if (prev) {
        let diff = 0;
        for (let i = 0; i < buf.length; i++) if (buf[i] !== prev[i]) diff++;
        f._diff = diff;
        if (s.frames.length > 1) must(tag, diff >= 8, `${tag}/${s.name}#${fi}: static frame (diff ${diff})`);
      }
      prev = buf;
    });
    if (s.frames.length > 1 && s.loop !== false) {
      // loop closure: re-render first & last and pixel-compare (identical = visible hitch)
      const render = f => { const b = new Uint32Array(doc.width * doc.height); (f.layers ? f.layers[0] : f.paint)(b, doc.width, doc.height); return b; };
      const a = render(s.frames[0]), b = render(s.frames[s.frames.length - 1]);
      let same = true;
      for (let k = 0; k < a.length; k++) if (a[k] !== b[k]) { same = false; break; }
      if (same) warn(`${tag}/${s.name}: first/last frames pixel-identical (loop hitch)`);
    }
  }
  if ((GROUND_CATS.has(t.category) || GROUND_IDS.has(t.id)) && !t.tags.includes('flying')) {
    const lows = doc.states.filter(s => !AIRBORNE.test(s.name)).flatMap(s => s.frames.map(f => f._lowest));
    if (lows.length) {
      const minLow = Math.min(...lows);
      must(tag, minLow >= doc.height - 9, `${tag}: floats (lowest px row ${minLow} of ${doc.height})`);
    }
  }
  // docStats path (hub/app)
  try {
    const st = PF.Library.docStats(t.id);
    ok(st && st.states === doc.states.length, `${tag}: docStats`);
  } catch (e) { ok(false, `${tag}: docStats threw`); }
}

const rpg = list.filter(t => t.id.startsWith('rpg_'));
const frames = rpg.reduce((n, t) => n + PF.Library.docStats(t.id).frames, 0);
console.log(`\nTOTAL templates: ${list.length} | RPG new: ${rpg.length} | RPG frames: ${frames}`);
console.log(`QUALITY: ${pass} pass, ${fail} fail, ${warnings} warnings`);
process.exit(fail ? 1 : 0);
