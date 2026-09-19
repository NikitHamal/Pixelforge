#!/usr/bin/env node
/* Split a `.nik1` container into parts, or join it back.
 *
 * Why this exists: a 262 KB weight file cannot be handed to some publishing APIs
 * as a single request body (128 KB per-argument limit), and a model you cannot
 * publish is not shipped. Splitting is the boring, verifiable answer: parts plus
 * a manifest with a sha256 of the whole file, assembled by the runtime with an
 * integrity check. The manifest is also what makes a corrupted download a clear
 * error instead of a mysterious numerical drift.
 *
 *   node nik1/tools/split-model.js split nik1/js/models/nik1-route.nik1 [--max 90000]
 *   node nik1/tools/split-model.js join  nik1/js/models/nik1-route.nik1   # -> .nik1
 *   node nik1/tools/split-model.js verify nik1/js/models
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const MAX = 90000;
const sha = buf => crypto.createHash('sha256').update(buf).digest('hex');

function split(file, max = MAX) {
  const buf = fs.readFileSync(file);
  const base = path.basename(file);
  const dir = path.dirname(file);
  const n = Math.ceil(buf.length / max);
  const parts = [];
  for (let i = 0; i < n; i++) {
    const chunk = buf.subarray(i * max, Math.min(buf.length, (i + 1) * max));
    const name = `${base}.part-${String(i).padStart(2, '0')}`;
    fs.writeFileSync(path.join(dir, name), chunk);
    parts.push({ name, bytes: chunk.length });
  }
  fs.writeFileSync(file + '.parts.json', JSON.stringify({
    file: base, bytes: buf.length, sha256: sha(buf), max, parts
  }, null, 1));
  fs.unlinkSync(file);
  console.log(`  ${base}: ${buf.length} B -> ${n} parts (max ${max} B) + ${base}.parts.json`);
}

function join(file) {
  const manifest = JSON.parse(fs.readFileSync(file + '.parts.json', 'utf8'));
  const dir = path.dirname(file);
  const chunks = manifest.parts.map(p => {
    const b = fs.readFileSync(path.join(dir, p.name));
    if (b.length !== p.bytes) throw new Error(`${p.name}: expected ${p.bytes} bytes, got ${b.length}`);
    return b;
  });
  const buf = Buffer.concat(chunks);
  const got = sha(buf);
  if (buf.length !== manifest.bytes || got !== manifest.sha256) {
    throw new Error(`integrity failure: ${buf.length}/${manifest.bytes} bytes, sha ${got.slice(0, 12)} != ${manifest.sha256.slice(0, 12)}`);
  }
  fs.writeFileSync(file, buf);
  console.log(`  joined ${manifest.parts.length} parts -> ${path.basename(file)} (${buf.length} B, sha ok)`);
}

function verify(dir) {
  let ok = 0, bad = 0;
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith('.parts.json')) continue;
    const manifest = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    const chunks = manifest.parts.map(p => path.join(dir, p.name));
    const missing = chunks.filter(c => !fs.existsSync(c));
    const buf = Buffer.concat(chunks.filter(c => fs.existsSync(c)).map(c => fs.readFileSync(c)));
    const good = !missing.length && buf.length === manifest.bytes && sha(buf) === manifest.sha256;
    console.log(`  ${good ? 'ok  ' : 'FAIL'} ${manifest.file} (${manifest.parts.length} parts, ${buf.length}/${manifest.bytes} B)`);
    good ? ok++ : bad++;
  }
  if (!ok && !bad) console.log('  no split models found');
  return bad;
}

const [cmd, target = 'nik1/js/models', ...rest] = process.argv.slice(2);
const maxIdx = rest.indexOf('--max');
if (cmd === 'split') split(target, maxIdx >= 0 ? Number(rest[maxIdx + 1]) : MAX);
else if (cmd === 'join') join(target);
else if (cmd === 'verify') process.exit(verify(target) ? 1 : 0);
else {
  console.log('usage:\n  split-model.js split <file.nik1> [--max N]\n  split-model.js join  <file.nik1>\n  split-model.js verify <dir>');
  process.exit(cmd ? 1 : 0);
}
