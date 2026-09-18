/* Bitmap-font gate.
   Three things a font engine must get right, and one it usually gets wrong:

     1. every glyph has the declared box, and no glyph (except space) is blank
     2. measure() agrees with draw() — the box you reserved is the box painted
     3. every string the library draws actually FITS the canvas it is drawn on
        (a 5x7 glyph is 6px with tracking, so only five fit in a 32px cell —
        clipped UI text is invisible to a pixel test and very visible to a player)
     4. the BMFont atlas and glyph metrics agree

   Usage: node scripts/check-font.js
*/
const { boot, renderFrame } = require('./lib-boot');
const PF = boot();

let pass = 0, fail = 0;
const ok = (c, msg) => { c ? pass++ : (fail++, console.log('FAIL: ' + msg)); };

for (const f of PF.Font.fonts()) {
  const font = PF.Font.get(f.id);
  ok(Object.keys(font.glyphs).length === 0 || font.glyphs.size === f.glyphs, `${f.id}: glyph count mismatch`);
  for (const [ch, g] of font.glyphs) {
    ok(g.rows.length === font.h, `${f.id}/${JSON.stringify(ch)}: ${g.rows.length} rows, expected ${font.h}`);
    ok(g.rows.every(r => r.length === font.w), `${f.id}/${JSON.stringify(ch)}: row width != ${font.w}`);
    if (ch !== ' ') ok(g.ink > 0, `${f.id}/${JSON.stringify(ch)}: blank glyph`);
  }
  ok(font.lineHeight > font.h, `${f.id}: lineHeight ${font.lineHeight} must exceed the glyph height ${font.h}`);
  ok(font.base > 0 && font.base <= font.lineHeight, `${f.id}: baseline out of range`);
  // measure must account for every character it claims to
  const text = 'AJWg09.,!?';
  const m = PF.Font.measure(text, { font: f.id });
  const { buf, W, H } = PF.Font.toBuffer(text, { font: f.id, pad: 0 });
  ok(W === m.w && H === m.h, `${f.id}: toBuffer is ${W}x${H}, measure says ${m.w}x${m.h}`);
  let maxX = -1;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (buf[y * W + x]) maxX = Math.max(maxX, x);
  ok(maxX < m.w, `${f.id}: ink at x=${maxX} exceeds the measured width ${m.w}`);
  // wrapping never exceeds the width it was given
  const lines = PF.Font.wrap('the quick brown fox jumps over the lazy dog', 40, { font: f.id });
  ok(lines.every(l => PF.Font.measure(l, { font: f.id }).w <= 40 || l.split(' ').length === 1),
    `${f.id}: wrap produced a line wider than 40px`);
}

/* ---------- every drawn string fits its canvas ---------- */
const draws = [];
const realDraw = PF.Font.draw;
PF.Font.draw = function (api, text, x, y, color, o = {}) {
  const box = (o && o.wrap) || (o && o.boxWidth);
  const m = PF.Font.measure(text, o || {});
  draws.push({ text: String(text), x, y, w: m.w, h: m.h, apiW: api.W, apiH: api.H, box });
  return realDraw.apply(this, arguments);
};
for (const t of PF.Library.list()) {
  const doc = t.build();
  for (const s of doc.states) for (const f of s.frames) renderFrame(doc, f);
}
PF.Font.draw = realDraw;

ok(draws.length > 10, `expected the library to draw text (saw ${draws.length} calls)`);
const clipped = draws.filter(d => d.x + d.w > d.apiW || d.y + d.h > d.apiH);
for (const d of clipped.slice(0, 12)) {
  ok(false, `text ${JSON.stringify(d.text)} at (${d.x},${d.y}) is ${d.w}px wide and overflows a ${d.apiW}x${d.apiH} canvas`);
}
ok(clipped.length === 0, `${clipped.length} strings overflow their canvas`);

/* ---------- BMFont data agrees with the font ---------- */
for (const f of PF.Font.fonts()) {
  const data = PF.Font.atlasData(f.id, {});
  ok(data.glyphs.length === f.glyphs, `${f.id}: atlas has ${data.glyphs.length} glyphs, font has ${f.glyphs}`);
  const over = data.glyphs.filter(g => g.x + g.w > data.imageWidth || g.y + g.h > data.imageHeight);
  ok(over.length === 0, `${f.id}: ${over.length} glyphs outside the atlas image`);
  const overlaps = [];
  for (let i = 0; i < data.glyphs.length; i++) for (let j = i + 1; j < data.glyphs.length; j++) {
    const a = data.glyphs[i], b = data.glyphs[j];
    if (a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h) overlaps.push(a.char + b.char);
  }
  ok(overlaps.length === 0, `${f.id}: overlapping glyph cells (${overlaps.slice(0, 5).join(', ')})`);
  ok(data.buffer.some(v => v), `${f.id}: atlas buffer is blank`);
}

console.log(`\nFONT GATE: ${pass} pass, ${fail} fail (${draws.length} text draws checked)`);
process.exit(fail ? 1 : 0);
