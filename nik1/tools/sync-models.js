#!/usr/bin/env node
/* Copy the runtime's data dependencies next to the exported models, so
   `nik1/js/models/` is self-contained: a browser demo or a game can fetch the
   whole directory and need nothing else.
   Usage: node nik1/tools/sync-models.js */
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const MODELS = path.join(ROOT, 'js', 'models');
fs.mkdirSync(MODELS, { recursive: true });
const pairs = [
  ['data/tools.json', 'js/models/tools.json'],
  ['data/palettes.json', 'js/models/palettes.json'],
  ['data/templates.json', 'js/models/templates.json']
];
for (const [from, to] of pairs) {
  const src = path.join(ROOT, from), dst = path.join(ROOT, to);
  if (!fs.existsSync(src)) { console.log('  skip (missing)', from); continue; }
  fs.copyFileSync(src, dst);
  console.log(`  ${from} -> ${to} (${(fs.statSync(dst).size / 1024).toFixed(0)} KB)`);
}
console.log('models directory synced');
