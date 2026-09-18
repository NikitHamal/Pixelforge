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
/* The outline pass can only write INSIDE the buffer, so a character pixel that
   lands on row 0 has no rim above it and reads as sliced off the top of the
   frame — the complaint that "most assets look cut off". Tiles, water and
   weather bleed to the edges on purpose, so this only governs figures.
   Budget is a ratchet: today's survivors are listed by the failure text, and
   any NEW template that clips fails the gate. Lower it as they are fixed. */
const OUT_U32 = PF.Color.hexToU32('#181425');
const FIGURE_CATS = new Set(['Heroes', 'NPCs', 'Enemies', 'Animals']);
const EDGE_BUDGET = 38;   // ratchet: only ever lower this. See the FAIL text for the list.
const edgeClipped = new Set();
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
      if (doc.height === 32 && FIGURE_CATS.has(t.category) && !edgeClipped.has(t.id)) {
        for (let x = 0; x < doc.width; x++) {
          const v = buf[x];
          if (v && v !== OUT_U32) { edgeClipped.add(t.id); break; }
        }
      }
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
  /* Overhead art has no ground line to stand on. The whole point of the check
     is that a 3/4-view figure's feet share a floor with every other pack's
     feet; a top-down sprite is seen from above, so its lowest row is the
     bottom of its shoulders and pinning it to y25 would just shove the
     character off-centre in its own cell. The tag, not the category, is the
     right key: a top-down hero is still a Hero. */
  if ((GROUND_CATS.has(t.category) || GROUND_IDS.has(t.id))
      && !t.tags.includes('flying') && !t.tags.includes('top-down')) {
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

ok(edgeClipped.size <= EDGE_BUDGET,
  `edge ratchet: ${edgeClipped.size} figure templates paint on row 0, budget ${EDGE_BUDGET} — ` +
  `keep headgear below y1 and locomotion bob within 1px so the outline can close. Offenders: ${[...edgeClipped].join(', ')}`);

const rpg = list.filter(t => t.id.startsWith('rpg_'));
const frames = rpg.reduce((n, t) => n + PF.Library.docStats(t.id).frames, 0);
console.log(`\nTOTAL templates: ${list.length} | RPG new: ${rpg.length} | RPG frames: ${frames}`);
console.log(`QUALITY: ${pass} pass, ${fail} fail, ${warnings} warnings`);
process.exit(fail ? 1 : 0);
