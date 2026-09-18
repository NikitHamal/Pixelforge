/* Shared headless bootstrap for PixelForge dev scripts.
   Loads the whole engine + library into a fake `window` so sprite packs can be
   rendered and inspected in plain Node with no browser and no npm install. */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

/* Load order matters: raster -> pixel -> rigs -> packs -> registry. */
const FILES = [
  'js/core/raster.js',
  'js/core/palette.js',
  'js/core/effects.js',
  'js/core/gen.js',
  'js/core/tiles.js',
  'js/core/gif.js',
  'js/core/zip.js',
  'js/core/exporters.js',
  'js/library/pixel.js',
  'js/library/characters.js',
  'js/library/monsters.js',
  'js/library/world.js',
  'js/library/items.js',
  'js/library/rpg_heroes.js',
  'js/library/rpg_foes.js',
  'js/library/rpg_world.js',
  'js/library/rpg_items.js',
  'js/library/rpg_expand.js',
  'js/library/rpg_classes.js',
  'js/library/rpg_beasts.js',
  'js/library/rpg_props.js',
  'js/library/rpg_medieval.js',
  'js/library/rpg_tiny.js',
  'js/library/rpg_life.js',
  'js/library/fx2.js',
  'js/library/ui_kit.js',
  'js/library/fonts.js',
  'js/library/platformer.js',
  'js/library/scifi.js',
  'js/library/space.js',
  'js/library/rig.js',
  'js/library/modern.js',
  'js/library/farm.js',
  'js/library/iso.js',
  'js/library/index.js'
];

function boot() {
  global.window = global;
  for (const f of FILES) {
    const src = fs.readFileSync(path.join(ROOT, f), 'utf8');
    try { eval(src); }
    catch (e) { throw new Error(`boot failed loading ${f}: ${e.message}`); }
  }
  return global.PF;
}

/* FNV-1a over the raw bytes of a Uint32Array — stable across runs/platforms. */
function hashBuf(u32) {
  const u8 = new Uint8Array(u32.buffer, u32.byteOffset, u32.byteLength);
  let h = 0x811c9dc5;
  for (let i = 0; i < u8.length; i++) {
    h ^= u8[i];
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

/* Render one frame painter into a fresh buffer. */
function renderFrame(doc, frame) {
  const buf = new Uint32Array(doc.width * doc.height);
  const painter = frame.layers ? frame.layers[0] : frame.paint;
  painter(buf, doc.width, doc.height);
  return buf;
}

module.exports = { boot, hashBuf, renderFrame, ROOT, FILES };
