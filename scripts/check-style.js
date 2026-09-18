/* Style-engine gate.
   Proves the three properties the style system promises:
     1. exactness   — every output colour is in the target palette
     2. determinism — the same input always produces the same bytes
     3. honesty     — docOf() never mutates the document it was given
   Plus a spread check: a style that collapses a sprite to one colour is a bug,
   not a style.

   Usage: node scripts/check-style.js
*/
const { boot } = require('./lib-boot');
const PF = boot();

let pass = 0, fail = 0;
const ok = (c, msg) => { c ? pass++ : (fail++, console.log('FAIL: ' + msg)); };

const SAMPLES = ['rpg_knight', 'rpg_dragon', 'rusty_placeholder', 'pf_plat_hero', 'pf_ui_panels', 'pf_nature_fish']
  .filter(id => PF.Library.get(id));
ok(SAMPLES.length >= 4, `style gate needs sample templates (found ${SAMPLES.length})`);

const render = (doc, frame) => { const b = new Uint32Array(doc.width * doc.height); (frame.layers ? frame.layers[0] : frame.paint)(b, doc.width, doc.height); return b; };
const hex = v => PF.Color.u32ToHex(v);
const OPAQUE = 0xff000000;

for (const style of PF.Style.list()) {
  const pal = new Set(style.palette.map(h => PF.Color.hexToU32(h)));
  ok(pal.size === style.palette.length, `${style.id}: palette has duplicate entries`);
  ok(style.palette.length >= 2, `${style.id}: palette too small`);
  for (const id of SAMPLES) {
    const doc = PF.Library.get(id).build();
    const src = render(doc, doc.states[0].frames[0]);
    const before = src.slice();
    const out = src.slice();
    PF.Style.apply(out, doc.width, doc.height, style.id);
    const bad = [];
    for (let i = 0; i < out.length; i++) {
      const v = out[i];
      if (!v) { if (before[i]) bad.push('dropped'); continue; }
      if ((v >>> 24) !== 255) bad.push('alpha');
      if (!pal.has(v >>> 0)) { if (bad.length < 3) bad.push('escape:' + hex(v)); }
    }
    ok(bad.length === 0, `${style.id}/${id}: ${bad.length} pixels off-palette (${bad.slice(0, 3).join(', ')})`);
    // transparency must survive
    let lostOpaque = 0;
    for (let i = 0; i < out.length; i++) if (before[i] && !out[i]) lostOpaque++;
    ok(lostOpaque === 0, `${style.id}/${id}: ${lostOpaque} opaque pixels became transparent`);
    // determinism
    const again = before.slice();
    PF.Style.apply(again, doc.width, doc.height, style.id);
    ok(again.every((v, i) => v === out[i]), `${style.id}/${id}: not deterministic`);
    // spread: a style must not flatten a real sprite to one colour
    const distinct = new Set();
    for (let i = 0; i < out.length; i++) if (out[i]) distinct.add(out[i]);
    ok(distinct.size >= Math.min(3, pal.size), `${style.id}/${id}: collapsed to ${distinct.size} colour(s)`);
  }
}

/* docOf() must be pure: the source document's frames are untouched. */
{
  const doc = PF.Library.get(SAMPLES[0]).build();
  const before = render(doc, doc.states[0].frames[0]).slice();
  const styled = PF.Style.docOf(doc, 'gameboy');
  const after = render(doc, doc.states[0].frames[0]);
  ok(before.every((v, i) => v === after[i]), 'docOf mutated the source document');
  const sb = render(styled, styled.states[0].frames[0]);
  ok(sb.some((v, i) => v !== before[i]), 'docOf produced an identical document');
  const gb = new Set(PF.Style.get('gameboy').palette.map(h => PF.Color.hexToU32(h)));
  ok(sb.every(v => !v || gb.has(v >>> 0)), 'docOf output is off-palette');
}

/* Tint / warm-cool must keep alpha and leave transparent pixels alone. */
{
  const b = new Uint32Array(16 * 16);
  b[0] = PF.Color.fromRGBA(100, 100, 100, 128);
  b[1] = OPAQUE | 0x808080;
  PF.Style.tint(b, 16, 16, '#ff0000', 0.5);
  ok((b[0] >>> 24) === 128, 'tint changed alpha');
  ok(b[2] === 0, 'tint wrote to a transparent pixel');
  PF.Style.warmCool(b, 16, 16, 0.5);
  ok((b[0] >>> 24) === 128 && b[2] === 0, 'warmCool broke alpha/transparency');
}

console.log(`\nSTYLE GATE: ${pass} pass, ${fail} fail (${PF.Style.ids().length} styles x ${SAMPLES.length} sprites)`);
process.exit(fail ? 1 : 0);
