/* Runefall wiring check: every sprite id and animation state the game names
   must actually exist in the library, and every DOM id the game queries must
   exist in its page. Catches silent drift after asset/engine changes.

   Usage: node scripts/check-game.js
*/
const fs = require('fs');
const path = require('path');
const { boot, ROOT } = require('./lib-boot');
const PF = boot();

let fail = 0, pass = 0;
const ok = (c, msg) => { c ? pass++ : (fail++, console.log('FAIL: ' + msg)); };

const gameSrc = fs.readFileSync(path.join(ROOT, 'games/runefall/js/game.js'), 'utf8');

/* ---- 1. every sprite id named anywhere in the game resolves ---- */
const sprIds = new Set([...gameSrc.matchAll(/spr:\s*'([^']+)'/g)].map(m => m[1]));
for (const id of sprIds) ok(!!PF.Library.get(id), `sprite "${id}" is not in the library`);
console.log(`sprites referenced: ${sprIds.size}`);

/* ---- 2. every state named on a table row exists on that sprite ---- */
const STATEFUL = ['mv', 'atk', 'slam', 'charge'];
let rows = 0;
for (const m of gameSrc.matchAll(/^\s*(\w+):\s*\{([^}]*)\},?\s*$/gm)) {
  const [, key, body] = m;
  const spr = (body.match(/spr:\s*'([^']+)'/) || [])[1];
  if (!spr) continue;
  rows++;
  const stats = PF.Library.docStats(spr);
  if (!stats) { ok(false, `${key}: sprite ${spr} missing`); continue; }
  const have = new Set(stats.stateNames);
  for (const f of STATEFUL) {
    const st = (body.match(new RegExp(f + ":\\s*'([^']+)'")) || [])[1];
    if (st && st !== 'null') ok(have.has(st), `${key}: state "${st}" (${f}) missing on ${spr} [has: ${stats.stateNames.join(', ')}]`);
  }
  // humanoids walk on four facings
  if (/humanoid:\s*true/.test(body)) {
    for (const st of ['idle_down', 'walk_down', 'walk_side', 'walk_up', 'hurt', 'death'])
      ok(have.has(st), `${key}: humanoid state "${st}" missing on ${spr}`);
  }
}
console.log(`table rows checked: ${rows}`);

/* ---- 3. DOM ids referenced by the game exist in its page ---- */
const html = fs.readFileSync(path.join(ROOT, 'games/runefall/index.html'), 'utf8');
const domIds = new Set([...html.matchAll(/id="([^"]+)"/g)].map(m => m[1]));
let idRefs = 0;
for (const m of gameSrc.matchAll(/\$\('([\w-]+)'\)/g)) { idRefs++; ok(domIds.has(m[1]), `DOM id "${m[1]}" not found in runefall/index.html`); }
console.log(`DOM ids checked: ${idRefs}`);

/* ---- 4. the game's script tags point at files that exist ---- */
for (const m of html.matchAll(/src="([^"]+\.js)"/g)) {
  const p = path.join(ROOT, 'games/runefall', m[1]);
  ok(fs.existsSync(p), `script src "${m[1]}" does not exist`);
}

console.log(`\nGAME WIRING: ${pass} pass, ${fail} fail`);
process.exit(fail ? 1 : 0);
