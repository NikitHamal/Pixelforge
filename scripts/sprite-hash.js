/* Pixel-regression harness.
   Renders every template -> state -> frame and hashes the pixels, so engine
   refactors can be proven byte-identical (or the exact diff can be listed).

   Usage:
     node scripts/sprite-hash.js save  scripts/hashes.json
     node scripts/sprite-hash.js diff  scripts/hashes.json
*/
const fs = require('fs');
const { boot, hashBuf, renderFrame } = require('./lib-boot');

const PF = boot();
const [cmd = 'diff', file = 'scripts/hashes.json'] = process.argv.slice(2);

function snapshot() {
  const out = {};
  let frames = 0;
  for (const t of PF.Library.list()) {
    let doc;
    try { doc = t.build(); } catch (e) { out[t.id] = { error: e.message }; continue; }
    const states = {};
    for (const s of doc.states) {
      const fr = [];
      for (const f of s.frames) {
        const buf = renderFrame(doc, f);
        // Pixel counts and ground bounds belong to check-rpg.js. Keeping this
        // baseline to the pixel hash alone makes it compact enough for API-
        // based releases while retaining exact byte-level regression checks.
        fr.push(hashBuf(buf));
        frames++;
      }
      states[s.name] = fr;
    }
    out[t.id] = { w: doc.width, h: doc.height, states };
  }
  return { frames, data: out };
}

if (cmd === 'save') {
  const snap = snapshot();
  fs.writeFileSync(file, JSON.stringify(snap.data, null, 0));
  console.log(`saved ${Object.keys(snap.data).length} templates / ${snap.frames} frames -> ${file}`);
  process.exit(0);
}

const base = JSON.parse(fs.readFileSync(file, 'utf8'));
const now = snapshot().data;
let same = 0, changed = 0, added = 0, removed = 0;
const diffs = [];

for (const id of Object.keys(now)) {
  if (!(id in base)) { added++; diffs.push(`+ ${id} (new template)`); continue; }
  const a = base[id], b = now[id];
  if (a.w !== b.w || a.h !== b.h) { changed++; diffs.push(`~ ${id}: size ${a.w}x${a.h} -> ${b.w}x${b.h}`); continue; }
  const an = Object.keys(a.states), bn = Object.keys(b.states);
  for (const s of bn) {
    if (!(s in a.states)) { diffs.push(`+ ${id}/${s} (new state)`); continue; }
    const af = a.states[s], bf = b.states[s];
    if (af.length !== bf.length) { diffs.push(`~ ${id}/${s}: frames ${af.length} -> ${bf.length}`); continue; }
    for (let i = 0; i < bf.length; i++) {
      if (af[i] !== bf[i]) { changed++; diffs.push(`~ ${id}/${s}#${i}: ${af[i]} -> ${bf[i]}`); }
      else same++;
    }
  }
  for (const s of an) if (!(s in b.states)) diffs.push(`- ${id}/${s} (state removed)`);
}
for (const id of Object.keys(base)) if (!(id in now)) { removed++; diffs.push(`- ${id} (template removed)`); }

console.log(`PIXEL DIFF: ${same} identical, ${changed} changed, ${added} added, ${removed} removed`);
if (diffs.length) {
  const show = diffs.slice(0, 60);
  show.forEach(d => console.log('  ' + d));
  if (diffs.length > show.length) console.log(`  ... and ${diffs.length - show.length} more`);
}
process.exit(changed || removed ? 1 : 0);
