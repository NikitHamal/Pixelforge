/* Documentation gate.
   Docs rot silently: a command renamed in scripts/ leaves a README that tells
   new users to run something that no longer exists. This checks that every
   `node scripts/x.js` mentioned in the docs resolves, that every relative
   markdown link points at a real file, and that the headline numbers the docs
   quote match the registry.

   Usage: node scripts/check-docs.js
*/
const fs = require('fs');
const path = require('path');
const { boot, ROOT } = require('./lib-boot');

const PF = boot();
let pass = 0, fail = 0, warn = 0;
const ok = (c, msg) => { c ? pass++ : (fail++, console.log('FAIL: ' + msg)); };
const noise = msg => { warn++; console.log('WARN: ' + msg); };

const DOCS = ['README.md', 'AGENTS.md', 'CONTRIBUTING.md', 'docs/exporting.md', 'docs/engine-api.md', 'docs/styles.md',
  'docs/agent-tools.md', 'docs/architecture.md', 'docs/asset-catalogue.md'];
const present = DOCS.filter(d => fs.existsSync(path.join(ROOT, d)));
ok(present.includes('README.md'), 'README.md is missing');
ok(present.length >= 5, `only ${present.length} docs present`);

/* ---------- every `node scripts/x.js` resolves ---------- */
for (const file of present) {
  const text = fs.readFileSync(path.join(ROOT, file), 'utf8');
  for (const m of text.matchAll(/node\s+(scripts\/[\w.-]+\.js)/g)) {
    ok(fs.existsSync(path.join(ROOT, m[1])), `${file}: references missing ${m[1]}`);
  }
  /* markdown links to local files */
  for (const m of text.matchAll(/\]\((?!https?:|#|mailto:)([^)]+)\)/g)) {
    const target = m[1].split('#')[0].trim();
    if (!target) continue;
    const abs = path.resolve(path.join(ROOT, path.dirname(file)), target);
    ok(fs.existsSync(abs), `${file}: link "${m[1]}" does not resolve`);
  }
}

/* ---------- catalogue numbers in the README must be true ---------- */
const list = PF.Library.list();
const stats = list.map(t => PF.Library.docStats(t.id));
const totals = {
  templates: list.length,
  states: stats.reduce((n, s) => n + s.states, 0),
  frames: stats.reduce((n, s) => n + s.frames, 0)
};
const readme = fs.existsSync(path.join(ROOT, 'README.md')) ? fs.readFileSync(path.join(ROOT, 'README.md'), 'utf8') : '';
for (const [k, v] of Object.entries(totals)) {
  const re = new RegExp(`([\\d,]{2,})\\s+(?:[A-Za-z-]+\\s+){0,2}${k}\\b`, 'i');
  const m = readme.match(re);
  if (!m) noise(`README does not quote a ${k} count`);
  else ok(Number(m[1].replace(/,/g, '')) === v, `README says ${m[1]} ${k}, registry has ${v}`);
}

/* ---------- every registered template must be documented by category ---------- */
{
  const byCat = {};
  for (const t of list) byCat[t.category] = (byCat[t.category] || 0) + 1;
  const catDoc = fs.existsSync(path.join(ROOT, 'docs/asset-catalogue.md')) ? fs.readFileSync(path.join(ROOT, 'docs/asset-catalogue.md'), 'utf8') : '';
  for (const [cat, n] of Object.entries(byCat)) {
    ok(catDoc.includes(cat), `asset-catalogue.md does not mention category ${cat}`);
  }
  ok(/pf_autotile_water/.test(catDoc) || /autotile/i.test(catDoc), 'asset-catalogue.md does not cover the autotile sets');
}

console.log(`\nDOCS: ${pass} pass, ${fail} fail, ${warn} warnings`);
process.exit(fail ? 1 : 0);
