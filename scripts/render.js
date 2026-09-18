/* PixelForge — headless renderer.

   Turns a registered template into the artefacts a game project actually
   consumes: PNG frames, a packed sprite sheet plus its atlas, and animated
   GIFs. No DOM, no canvas, no npm install — the same pure painters that run in
   the browser run here, and the atlas this produces is the exact shape
   js/core/exporters.js writes engine project files from.

   Used by bin/pixelforge.js; usable on its own:
     const R = require('./scripts/render');
     const { PF } = R;
     const doc = R.build('rpg_knight');
     fs.writeFileSync('knight.png', R.sheetPNG(doc).png);
*/
const { boot, renderFrame } = require('./lib-boot');
const { encodePNG, pixelsToRGBA } = require('./png');

const PF = boot();

/* ---------------------------------------------------------------- lookup */

function find(id) {
  const t = PF.Library.list().find(t => t.id === id);
  if (!t) throw new Error(`No template "${id}". Run \`pixelforge list\` to see the catalogue.`);
  return t;
}

function build(id) {
  const t = find(id);
  const doc = t.build();
  doc.id = t.id;
  doc.category = t.category;
  doc.tags = t.tags || [];
  doc.description = t.desc || '';
  return doc;
}

/* States, optionally narrowed to one name. Errors name the alternatives —
   a silent empty result here produces a zero-byte sheet with no clue why. */
function states(doc, filter) {
  if (!filter) return doc.states;
  const hit = doc.states.filter(s => s.name === filter);
  if (!hit.length) throw new Error(`"${doc.id}" has no state "${filter}". States: ${doc.states.map(s => s.name).join(', ')}`);
  return hit;
}

/* --------------------------------------------------------------- scaling */

/* Nearest-neighbour only. Pixel art resampled with any kind of interpolation
   stops being pixel art, so there is deliberately no other mode. */
function scaleBuf(buf, w, h, scale) {
  if (scale === 1) return buf;
  const W = w * scale, H = h * scale, out = new Uint32Array(W * H);
  for (let y = 0; y < H; y++) {
    const sy = (y / scale) | 0;
    for (let x = 0; x < W; x++) out[y * W + x] = buf[sy * w + ((x / scale) | 0)];
  }
  return out;
}

const framePixels = (doc, frame, scale = 1) =>
  scaleBuf(renderFrame(doc, frame), doc.width, doc.height, scale);

const toPNG = (buf, w, h) => Buffer.from(encodePNG(w, h, pixelsToRGBA(buf, w, h)));

/* ----------------------------------------------------------------- sheet */

/* Pack every frame of the selected states into one grid.

   `columns` defaults to the longest state's frame count so each state occupies
   its own row. That is what makes a sheet legible to a human opening it in an
   image editor, and it is what most engine importers assume when they ask for
   "frames per row". */
function sheet(doc, { scale = 1, state, columns, padding = 0 } = {}) {
  const sel = states(doc, state);
  const fw = doc.width * scale, fh = doc.height * scale;
  const cols = columns || Math.max(1, ...sel.map(s => s.frames.length));
  const rows = sel.reduce((n, s) => n + Math.ceil(s.frames.length / cols), 0);
  const W = cols * (fw + padding) - padding, H = rows * (fh + padding) - padding;
  const buf = new Uint32Array(W * H);

  const frames = [];
  const tags = [];
  let row = 0, index = 0;
  for (const s of sel) {
    const from = index;
    s.frames.forEach((f, i) => {
      const cx = i % cols, cy = row + ((i / cols) | 0);
      const px = framePixels(doc, f, scale);
      const ox = cx * (fw + padding), oy = cy * (fh + padding);
      for (let y = 0; y < fh; y++)
        for (let x = 0; x < fw; x++) buf[(oy + y) * W + ox + x] = px[y * fw + x];
      frames.push({
        name: `${s.name}_${String(i).padStart(2, '0')}`, state: s.name, index: index++,
        x: ox, y: oy, w: fw, h: fh, duration: f.duration
      });
    });
    tags.push({ name: s.name, fps: s.fps, loop: s.loop !== false, from, to: index - 1 });
    row += Math.ceil(s.frames.length / cols);
  }

  const name = doc.id || (doc.name || 'sprite').toLowerCase().replace(/[^a-z0-9_-]+/g, '_');
  return {
    buf, width: W, height: H,
    atlas: {
      name, image: `${name}.png`, width: W, height: H,
      frameWidth: fw, frameHeight: fh, columns: cols,
      frames, states: tags
    }
  };
}

const sheetPNG = (doc, opts) => {
  const s = sheet(doc, opts);
  return { ...s, png: toPNG(s.buf, s.width, s.height) };
};

/* ------------------------------------------------------------------- gif */

function gif(doc, { scale = 1, state } = {}) {
  const sel = states(doc, state);
  const s = sel[0];
  const frames = s.frames.map(f => ({ pixels: framePixels(doc, f, scale), delay: f.duration }));
  return {
    state: s.name,
    bytes: Buffer.from(PF.Gif.encode(frames, doc.width * scale, doc.height * scale, s.loop !== false))
  };
}

/* -------------------------------------------------------------- metadata */

function info(doc) {
  return {
    id: doc.id, name: doc.name, category: doc.category, description: doc.description,
    tags: doc.tags, width: doc.width, height: doc.height,
    layers: (doc.layers || []).map(l => l.name),
    frames: doc.states.reduce((n, s) => n + s.frames.length, 0),
    states: doc.states.map(s => ({
      name: s.name, fps: s.fps, loop: s.loop !== false, frames: s.frames.length,
      durationMs: s.frames.reduce((n, f) => n + f.duration, 0)
    }))
  };
}

module.exports = { PF, find, build, states, sheet, sheetPNG, gif, info, framePixels, scaleBuf, toPNG, renderFrame };
