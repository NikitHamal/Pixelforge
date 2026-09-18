/* Pixel-regression harness.
   Renders every template -> state -> frame and hashes the pixels, so engine
   refactors can be proven byte-identical (or the exact diff can be listed).

   Usage:
     node scripts/sprite-hash.js save  scripts/hashes.json
     node scripts/sprite-hash.js diff  scripts/hashes.json
*/
const fs = require('fs');
const path = require('path');
const { boot, hashBuf, renderFrame } = require('./lib-boot');

const PF = boot();
const [cmd = 'diff', file = 'scripts/hashes-baseline'] = process.argv.slice(2);

/* Sharded oracle.
   A single JSON file for every frame is 190KB+ — small in absolute terms, but
   past the 128KB per-argument limit of a process spawn AND a single git blob
   body over some APIs, which makes it awkward to write from tooling. Shards of
   ~48 templates keep every write tiny, still diff cleanly in review, and the
   loader verifies that no shard is missing before it trusts the oracle. */
const SHARD = 48;
const isDir = p => { try { return fs.statSync(p).isDirectory(); } catch { return false; } };
const shardPath = (dir, i) => path.join(dir, `shard-${String(i).padStart(2, '0')}.json`);

function saveOracle(target, data) {
  if (target.endsWith('.json')) { fs.writeFileSync(target, JSON.stringify(data)); return 1; }
  fs.mkdirSync(target, { recursive: true });
  for (const f of fs.readdirSync(target)) if (/^shard-\d+\.json$/.test(f)) fs.unlinkSync(path.join(target, f));
  const ids = Object.keys(data);
  let shards = 0;
  for (let i = 0; i < ids.length; i += SHARD) {
    const slice = {};
    for (const id of ids.slice(i, i + SHARD)) slice[id] = data[id];
    fs.writeFileSync(shardPath(target, shards), JSON.stringify(slice));
    shards++;
  }
  fs.writeFileSync(path.join(target, 'index.json'), JSON.stringify({ templates: ids.length, shards, shardSize: SHARD, order: 'insertion' }, null, 0));
  return shards;
}

function loadOracle(source) {
  if (!isDir(source)) return { data: JSON.parse(fs.readFileSync(source, 'utf8')), shards: 1, expected: null };
  const index = JSON.parse(fs.readFileSync(path.join(source, 'index.json'), 'utf8'));
  const data = {};
  let loaded = 0;
  for (let i = 0; i < index.shards; i++) {
    const p = shardPath(source, i);
    if (!fs.existsSync(p)) throw new Error(`baseline shard missing: ${p} (${index.shards} expected)`);
    Object.assign(data, JSON.parse(fs.readFileSync(p, 'utf8')));
    loaded++;
  }
  return { data, shards: loaded, expected: index.templates };
}

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
        let n = 0, lowest = -1;
        for (let i = 0; i < buf.length; i++) if (buf[i]) { n++; const y = (i / doc.width) | 0; if (y > lowest) lowest = y; }
        fr.push(hashBuf(buf) + ':' + n + ':' + lowest);
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
  const shards = saveOracle(file, snap.data);
  console.log(`saved ${Object.keys(snap.data).length} templates / ${snap.frames} frames -> ${file} (${shards} shard${shards === 1 ? '' : 's'})`);
  process.exit(0);
}

const oracle = loadOracle(file);
const base = oracle.data;
if (oracle.expected !== null && oracle.expected !== Object.keys(base).length) {
  console.error(`baseline is incomplete: index says ${oracle.expected} templates, ${oracle.shards} shards hold ${Object.keys(base).length}`);
  process.exit(2);
}
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
