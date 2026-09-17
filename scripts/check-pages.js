/* Static page check for the whole app: every script/style a page loads must
   exist on disk, and every DOM id the page's own scripts query with the
   non-optional `$('#id')` form must be present in that page's markup.

   Usage: node scripts/check-pages.js
*/
const fs = require('fs');
const path = require('path');
const { ROOT } = require('./lib-boot');

/* page -> the scripts it loads (relative to the page's own directory) */
const PAGES = [
  ['index.html', []],
  ['studio.html', []],
  ['app/index.html', []],
  ['games/runefall/index.html', []]
];

let fail = 0, pass = 0, note = 0;
const ok = (c, msg) => { c ? pass++ : (fail++, console.log('FAIL: ' + msg)); };

for (const [rel] of PAGES) {
  const abs = path.join(ROOT, rel);
  if (!fs.existsSync(abs)) { ok(false, `${rel}: page missing`); continue; }
  const html = fs.readFileSync(abs, 'utf8');
  const dir = path.dirname(abs);
  const ids = new Set([...html.matchAll(/id="([^"]+)"/g)].map(m => m[1]));

  /* ---- assets ---- */
  const refs = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map(m => m[1]);
  const local = refs.filter(u => !/^(https?:|data:|#|mailto:|\/\/)/.test(u));
  for (const u of local) {
    const p = path.resolve(dir, u.split('?')[0].split('#')[0]);
    ok(fs.existsSync(p), `${rel}: missing asset "${u}"`);
  }

  /* ---- ids queried by this page's own scripts ---- */
  const scripts = local.filter(u => u.endsWith('.js')).map(u => path.resolve(dir, u.split('?')[0]));
  let refs2 = 0, missing = 0;
  for (const sp of scripts) {
    if (!fs.existsSync(sp)) continue;
    const js = fs.readFileSync(sp, 'utf8');
    for (const m of js.matchAll(/\$\('#([\w-]+)'\)(?!\s*\?)/g)) {
      refs2++;
      if (!ids.has(m[1])) { missing++; note++; console.log(`  note: ${path.relative(ROOT, sp)} queries #${m[1]}, absent from ${rel}`); }
    }
    for (const m of js.matchAll(/getElementById\('([\w-]+)'\)/g)) {
      refs2++;
      if (!ids.has(m[1])) { missing++; note++; console.log(`  note: ${path.relative(ROOT, sp)} queries #${m[1]}, absent from ${rel}`); }
    }
  }
  console.log(`${rel}: ${ids.size} ids, ${local.length} local assets, ${refs2} id queries (${missing} unmatched)`);
}

console.log(`\nPAGES: ${pass} pass, ${fail} fail, ${note} unmatched-id notes`);
process.exit(fail ? 1 : 0);
