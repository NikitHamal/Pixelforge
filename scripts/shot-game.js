#!/usr/bin/env node
/* Screenshot a demo game headlessly.

   Same driver as sim-game.js, but with the software canvas behind it, so what
   lands in the PNG is the game's real render path — tiles, y-sorted sprites,
   particles, the night overlay and all. Without this the demo games are the
   one part of the project nobody can look at before shipping.

   Usage: node scripts/shot-game.js <gameDir> <outfile.png> [warmupFrames] */
const fs = require('fs');
const path = require('path');
const { boot, ROOT } = require('./lib-boot');
const { makeDom, installGlobals, loadScripts } = require('./dom-stub');
const R = require('./render');

const rel = (process.argv[2] || 'games/nightfall').replace(/\/+$/, '');
const out = process.argv[3] || '/tmp/shot.png';
const warm = Number(process.argv[4] || 260);

const dir = path.join(ROOT, rel);
const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');

boot();
const doc = makeDom(html, { canvas: 'soft' });
const { emit, pump } = installGlobals(doc, { width: 640, height: 400, dpr: 1 });
loadScripts(html, dir);

// past the title screen
const picker = doc.byId['picker'];
if (picker && picker.children[0]) picker.children[0].emit('click', {});

/* Warm the world up so the shot has a horde in it, bullets in flight and
   particles mid-life rather than an empty field one frame after spawn. */
const cv = doc.byId['cv'];
for (let i = 0; i < warm; i++) {
  if (i % 3 === 0 && cv) cv.emit('mousemove', { clientX: 470, clientY: 130 });
  if (i === 20 && cv) cv.emit('mousedown', {});
  if (i > 40 && i < warm - 30) {
    if (i % 90 === 0) emit('keydown', { key: 'd' });
    if (i % 90 === 45) emit('keyup', { key: 'd' });
  }
  pump();
}

if (window.NIGHTFALL) console.log('  state: ' + JSON.stringify(window.NIGHTFALL.stats()));
const backing = cv.data;
if (!backing) throw new Error('no raster backing on #cv — is the soft canvas wired up?');
fs.writeFileSync(out, R.toPNG(backing, cv.width, cv.height));
console.log(`${rel} -> ${out} (${cv.width}x${cv.height}, ${warm} frames warmed)`);
