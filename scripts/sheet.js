/* Sprite-sheet exporter: renders a template as one row per animation state,
   on a checkerboard, and writes a PNG so the art can be inspected by eye.

   Usage:
     node scripts/sheet.js <templateId> [scale] [stateFilter]
     node scripts/sheet.js rpg_spider 6
     node scripts/sheet.js rpg_knight 4 run
     node scripts/sheet.js --all 4        # contact sheet of every template's first state
*/
const fs = require('fs');
const path = require('path');
const { boot, renderFrame } = require('./lib-boot');
const { encodePNG } = require('./png');

const PF = boot();
const OUT = path.join(__dirname, 'out');
fs.mkdirSync(OUT, { recursive: true });

const CHECK_A = [0x2a, 0x2a, 0x33], CHECK_B = [0x22, 0x22, 0x2a];
const GAP = 1; // px of gap between frames, in source pixels

function blank(w, h, fill) {
  const b = Buffer.alloc(w * h * 4);
  for (let i = 0; i < w * h; i++) { b[i * 4] = fill[0]; b[i * 4 + 1] = fill[1]; b[i * 4 + 2] = fill[2]; b[i * 4 + 3] = 255; }
  return b;
}

function blit(dst, dw, dh, src, sw, sh, ox, oy, scale, checker) {
  for (let y = 0; y < sh; y++) for (let x = 0; x < sw; x++) {
    const v = src[y * sw + x];
    for (let sy = 0; sy < scale; sy++) for (let sx = 0; sx < scale; sx++) {
      const dx = (ox + x) * scale + sx, dy = (oy + y) * scale + sy;
      if (dx < 0 || dy < 0 || dx >= dw || dy >= dh) continue;
      const i = (dy * dw + dx) * 4;
      if (v) { dst[i] = v & 255; dst[i + 1] = (v >> 8) & 255; dst[i + 2] = (v >> 16) & 255; dst[i + 3] = v >>> 24; }
      else if (checker) { const c = ((((dx / scale) | 0) >> 2) + (((dy / scale) | 0) >> 2)) & 1 ? CHECK_B : CHECK_A; dst[i] = c[0]; dst[i + 1] = c[1]; dst[i + 2] = c[2]; dst[i + 3] = 255; }
    }
  }
}

function sheetFor(t, scale, filter) {
  const doc = t.build();
  const states = doc.states.filter(s => !filter || s.name.toLowerCase().includes(filter.toLowerCase()));
  if (!states.length) return null;
  const cols = Math.max(...states.map(s => s.frames.length));
  const cw = doc.width + GAP, ch = doc.height + GAP;
  const dw = cols * cw * scale, dh = states.length * ch * scale;
  const dst = blank(dw, dh, CHECK_A);
  states.forEach((s, r) => {
    s.frames.forEach((f, c) => {
      blit(dst, dw, dh, renderFrame(doc, f), doc.width, doc.height, c * cw, r * ch, scale, true);
    });
  });
  console.log(`${t.id}: ${states.length} rows x ${cols} cols -> ${dw}x${dh}px`);
  states.forEach((s, r) => console.log(`   row ${r}: ${s.name} (${s.frames.length}f @ ${s.fps}fps)`));
  return encodePNG(dw, dh, dst);
}

const args = process.argv.slice(2);
const scale = (() => { const n = args.find(a => /^\d+$/.test(a)); return n ? +n : 4; })();

if (args[0] === '--all') {
  // Contact sheet: first state of every template, one column each.
  const list = PF.Library.list();
  const cell = 32 * scale, cols = 10, rows = Math.ceil(list.length / cols);
  const dw = cols * cell, dh = rows * cell;
  const dst = blank(dw, dh, [0x1a, 0x1a, 0x20]);
  list.forEach((t, i) => {
    const doc = t.build();
    const buf = renderFrame(doc, doc.states[0].frames[0]);
    blit(dst, dw, dh, buf, doc.width, doc.height, (i % cols) * 32, ((i / cols) | 0) * 32, scale, true);
  });
  const p = path.join(OUT, 'all-templates.png');
  fs.writeFileSync(p, encodePNG(dw, dh, dst));
  console.log(`${list.length} templates -> ${p}`);
  process.exit(0);
}

const id = args[0];
const filter = args.slice(1).find(a => !/^\d+$/.test(a));
const t = PF.Library.get(id);
if (!t) { console.error('unknown template: ' + id); process.exit(1); }
const png = sheetFor(t, scale, filter);
const out = path.join(OUT, id + (filter ? '-' + filter : '') + '.png');
fs.writeFileSync(out, png);
console.log('wrote ' + out);
