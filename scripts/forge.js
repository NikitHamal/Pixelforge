/* PixelForge Forge CLI — batch export, atlases and starter kits from a shell.
   The studio is for one sprite at a time; this is for the CI job or the
   "give me a whole kit" moment. Zero dependencies, same renderers as the
   browser, so an exported pack is byte-identical to what the studio writes.

   Usage:
     node scripts/forge.js list                                     catalogue by genre
     node scripts/forge.js styles                                   style palettes
     node scripts/forge.js sheet <out> <templateId> [scale]         one template's sheet
     node scripts/forge.js atlas <out> <id,id,...> [preset] [scale] packed sheet + metadata
     node scripts/forge.js export <out> <templateId> <format>       engine format (tiled-tsx, c-header, svg-anim, ...)
     node scripts/forge.js style <out> <templateId> <styleId>       restyled sheet + png
     node scripts/forge.js kit <out> "<brief>" [--style id] [--genre id]
     node scripts/forge.js autotile <out> <grass|stone|road|water>  wang/blob sheet + .tsx
*/
const fs = require('fs');
const path = require('path');
const { boot, renderFrame } = require('./lib-boot');
const { encodePNG } = require('./png');

const PF = boot();
const args = process.argv.slice(2);
const cmd = args[0];
const outArg = args[1] || 'forge-out';
const OUT = path.resolve(process.cwd(), outArg);
const flag = name => { const i = args.indexOf('--' + name); return i >= 0 ? args[i + 1] : null; };

const CHECK_A = [0x1c, 0x1c, 0x22], CHECK_B = [0x14, 0x14, 0x18];
const mkdir = () => fs.mkdirSync(OUT, { recursive: true });
const write = (name, data) => { const p = path.join(OUT, name); fs.writeFileSync(p, data); console.log('  ' + path.relative(process.cwd(), p)); return p; };

function blank(w, h, fill) {
  const b = Buffer.alloc(w * h * 4);
  for (let i = 0; i < w * h; i++) { b[i * 4] = fill[0]; b[i * 4 + 1] = fill[1]; b[i * 4 + 2] = fill[2]; b[i * 4 + 3] = 255; }
  return b;
}
/* Blit a source buffer into the sheet at (ox,oy) source pixels, scaled. */
function blit(dst, dw, dh, src, sw, sh, ox, oy, scale, checker) {
  for (let y = 0; y < sh; y++) for (let x = 0; x < sw; x++) {
    const v = src[y * sw + x];
    for (let sy = 0; sy < scale; sy++) for (let sx = 0; sx < scale; sx++) {
      const dx = (ox + x) * scale + sx, dy = (oy + y) * scale + sy;
      if (dx < 0 || dy < 0 || dx >= dw || dy >= dh) continue;
      const i = (dy * dw + dx) * 4;
      if (v) { dst[i] = v & 255; dst[i + 1] = (v >> 8) & 255; dst[i + 2] = (v >> 16) & 255; dst[i + 3] = v >>> 24; }
      else if (checker && ((((dx / scale) | 0) >> 2) + (((dy / scale) | 0) >> 2)) & 1) { dst[i] = CHECK_B[0]; dst[i + 1] = CHECK_B[1]; dst[i + 2] = CHECK_B[2]; dst[i + 3] = 255; }
      else if (checker) { dst[i] = CHECK_A[0]; dst[i + 1] = CHECK_A[1]; dst[i + 2] = CHECK_A[2]; dst[i + 3] = 255; }
    }
  }
}
const GAP = 1;
/* One row per state, on a checkerboard — the visual QA sheet. */
function sheetPNG(doc, scale = 4, checker = true) {
  const cols = Math.max(...doc.states.map(s => s.frames.length));
  const cw = doc.width + GAP, ch = doc.height + GAP;
  const dw = cols * cw * scale, dh = doc.states.length * ch * scale;
  const dst = blank(dw, dh, CHECK_A);
  doc.states.forEach((s, r) => s.frames.forEach((f, c) => blit(dst, dw, dh, renderFrame(doc, f), doc.width, doc.height, c * cw, r * ch, scale, checker)));
  return encodePNG(dw, dh, dst);
}
/* A packed atlas: colour blit at the packer's placements + transparent elsewhere. */
function atlasPNG(atlas, docs, scale = 1) {
  const dst = Buffer.alloc(atlas.width * atlas.height * 4);
  for (const f of atlas.frames) {
    const doc = docs.get(f.doc);
    const st = doc.states.find(s => s.name === f.state);
    const buf = renderFrame(doc, st.frames[f.frame]);
    blit(dst, atlas.width, atlas.height, buf, doc.width, doc.height, (f.x / scale) | 0, (f.y / scale) | 0, scale, false);
  }
  return encodePNG(atlas.width, atlas.height, dst);
}

if (cmd === 'list') {
  const list = PF.Library.list();
  const byTag = {};
  for (const t of list) for (const tag of t.tags) byTag[tag] = (byTag[tag] || 0) + 1;
  const byCat = {};
  for (const t of list) byCat[t.category] = (byCat[t.category] || 0) + 1;
  console.log(`${list.length} templates\n`);
  console.log('by category: ' + Object.entries(byCat).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(' · '));
  console.log('\ntop genres (tag counts):');
  console.log(Object.entries(byTag).sort((a, b) => b[1] - a[1]).slice(0, 24).map(([k, v]) => `${k} ${v}`).join(' · '));
  console.log('\nrun `node scripts/info.js` for the full catalogue, or `node scripts/forge.js kit <out> "<brief>"`.');
  process.exit(0);
}

if (cmd === 'styles') {
  for (const s of PF.Style.list()) console.log(`${s.id.padEnd(16)} ${String(s.size).padStart(2)} colours  ${s.name}  (${s.era})`);
  process.exit(0);
}

if (cmd === 'sheet') {
  const id = args[2], scale = +args[3] || 4;
  const t = PF.Library.get(id);
  if (!t) { console.error('unknown template: ' + id); process.exit(1); }
  mkdir();
  write(id + '.png', sheetPNG(t.build(), scale));
  console.log(`${t.name}: ${PF.Library.docStats(id).states} states @${scale}x`);
  process.exit(0);
}

if (cmd === 'atlas') {
  const ids = (args[2] || '').split(',').filter(Boolean);
  const preset = args[3] || 'phaser3';
  const scale = +args[4] || 1;
  if (!ids.length) { console.error('usage: forge.js atlas <out> <id,id,...> [preset] [scale]'); process.exit(1); }
  const docs = new Map();
  for (const id of ids) {
    const t = PF.Library.get(id);
    if (!t) { console.error('unknown template: ' + id); process.exit(1); }
    docs.set(id, t.build());
  }
  const atlas = PF.Atlas.plan([...docs].map(([id, doc]) => ({ id, doc, scale })), { padding: 1, maxSize: 4096 });
  mkdir();
  write('atlas.png', atlasPNG(atlas, docs, scale));
  const meta = PF.Atlas.write(preset, atlas, { image: 'atlas.png', name: 'atlas', docName: 'atlas' });
  write(meta.filename, meta.text);
  console.log(`${atlas.count} frames · ${atlas.width}x${atlas.height} · ${(atlas.efficiency * 100).toFixed(1)}% used · ${preset}`);
  process.exit(0);
}

if (cmd === 'export') {
  const id = args[2], format = args[3];
  const t = PF.Library.get(id);
  if (!t) { console.error('unknown template: ' + id); process.exit(1); }
  const out = PF.Export.generate(format, t.build(), { name: id, image: id + '.png' });
  mkdir();
  write(out.filename, out.text);
  console.log(`${format} -> ${out.filename} (${out.text.length} bytes)`);
  process.exit(0);
}

if (cmd === 'style') {
  const id = args[2], styleId = args[3], scale = +args[4] || 4;
  const t = PF.Library.get(id);
  if (!t) { console.error('unknown template: ' + id); process.exit(1); }
  if (!PF.Style.get(styleId)) { console.error('unknown style: ' + styleId); process.exit(1); }
  const doc = PF.Style.docOf(t.build(), styleId);
  mkdir();
  write(`${id}-${styleId}.png`, sheetPNG(doc, scale));
  write(`${id}-${styleId}-palette.css`, PF.Style.cssVars(styleId) + '\n');
  console.log(`${id} restyled to ${styleId}`);
  process.exit(0);
}

if (cmd === 'autotile') {
  const kind = args[2] || 'grass';
  const all = PF.Ui.autoTiles();
  if (!all[kind]) { console.error('unknown autotile: ' + kind + ' (grass | stone | road | water)'); process.exit(1); }
  const doc = all[kind]();
  mkdir();
  write(`autotile-${kind}.png`, sheetPNG(doc, 4, false));
  const tsx = PF.Export.generate('tiled-tsx', doc, { name: `autotile-${kind}`, image: `autotile-${kind}.png`, tileWidth: 16, tileHeight: 16,
    tiles: doc.wang.tiles.map(t => ({ id: t.id, properties: [{ name: 'mask', value: String(t.mask) }] })) });
  write(tsx.filename, tsx.text);
  console.log(`${doc.wang.count} tiles (${doc.wang.blob ? '47-blob' : '16-edge'}) · ${doc.width}x${doc.height}`);
  process.exit(0);
}

if (cmd === 'kit') {
  const brief = args[2] || '';
  const spec = { brief };
  if (flag('genre')) spec.genre = flag('genre');
  if (flag('style')) spec.style = flag('style');
  if (flag('size')) spec.size = +flag('size');
  if (flag('roles')) spec.roles = flag('roles').split(',');
  const recipe = PF.Factory.recipe(spec);
  mkdir();
  const manifest = [];
  const docs = new Map();
  for (const item of recipe.items) {
    docs.set(item.id, item.doc);
    write(`${item.id}.png`, sheetPNG(item.doc, 3));
    manifest.push({ role: item.role, template: item.source, asset: item.id, size: `${item.w}x${item.h}`,
      states: item.doc.states.length, frames: PF.Export.frameList(item.doc).length, style: item.style });
  }
  // one packed sheet for the whole kit as well
  const atlas = PF.Atlas.plan([...docs].map(([id, doc]) => ({ id, doc })), { padding: 1, maxSize: 4096 });
  write('kit-atlas.png', atlasPNG(atlas, docs, 1));
  const meta = PF.Atlas.write('phaser3', atlas, { image: 'kit-atlas.png', name: 'kit-atlas', docName: 'kit' });
  write(meta.filename, meta.text);
  write('PACK.md', `# ${brief || (recipe.genreName || 'Starter') + ' kit'}

Generated by \`scripts/forge.js kit\` — ${recipe.count} assets, ${atlas.count} frames,
packed into \`kit-atlas.png\` (${atlas.width}x${atlas.height}, ${(atlas.efficiency * 100).toFixed(1)}% used).

| role | asset | source template | size | states | frames |
|---|---|---|---|---|---|
${manifest.map(m => `| ${m.role} | \`${m.asset}\` | \`${m.template}\` | ${m.size} | ${m.states} | ${m.frames} |`).join('\n')}

${recipe.note}

Everything is generated from code: no image files were authored, and
\`node scripts/serve.js\` renders the same assets in the browser studio.
`);
  console.log(`kit: ${recipe.count} assets · ${atlas.count} atlas frames`);
  process.exit(0);
}

console.log(fs.readFileSync(__filename, 'utf8').split('*/')[0].replace(/^\/\*/, ''));
process.exit(cmd ? 1 : 0);
