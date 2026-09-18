/* PixelForge Studio — Engine export formats.
   Everything here is a pure string/byte generator over a DocData-like object
   ({width, height, name, layers, states[]}) so the exact same code runs in the
   browser (PF.IO downloads it) and in Node (scripts/forge.js writes it to
   disk). No DOM, no canvas: frames are rendered straight into Uint32Array
   buffers with the same painter contract the library uses.

   Why these formats: a pixel-art tool is only as useful as the last mile into
   an engine. Tiled tilesets get wang/terrain metadata so autotiling works the
   moment the file lands; Godot gets SpriteFrames; Unity gets a sprite-sheet
   .meta; embedded targets get an RLE C header; web targets get animated SVG.
*/
window.PF = window.PF || {};
PF.Export = (() => {
  const C = h => PF.Color.hexToU32(h);
  const slug = s => String(s || 'sprite').replace(/[^a-zA-Z0-9_-]+/g, '_').replace(/^_+|_+$/g, '') || 'sprite';
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  /* ---------------- frame rendering (DOM-free) ---------------- */
  function renderFrame(doc, frame) {
    const buf = new Uint32Array(doc.width * doc.height);
    compositeFrame(doc, frame, buf);
    return buf;
  }
  function compositeFrame(doc, frame, out) {
    out.fill(0);
    const multi = Array.isArray(frame.layers);
    const painters = multi ? frame.layers : [frame.paint];
    /* A single composite painter (PF.Export.fromStore, or a hand-written frame)
       has already resolved per-layer visibility and opacity. Falling back to
       doc.layers[0] here would hide the whole frame when layer 0 happens to be
       the hidden one. */
    const layers = multi ? doc.layers : [{ visible: true, opacity: 1 }];
    for (let li = 0; li < painters.length; li++) {
      const p = painters[li];
      const layer = layers[li] || { visible: true, opacity: 1 };
      if (layer.visible === false) continue;
      if (typeof p !== 'function') { if (p) out.set(p); continue; }
      const tmp = new Uint32Array(doc.width * doc.height);
      p(tmp, doc.width, doc.height);
      const op = layer.opacity === undefined ? 1 : layer.opacity;
      for (let i = 0; i < out.length; i++) {
        let s = tmp[i]; if (!s) continue;
        if (op < 1) s = ((s & 0xffffff) | (Math.round((s >>> 24) * op) << 24)) >>> 0;
        out[i] = (!out[i] || (s >>> 24) === 255) ? s : PF.Color.blend(out[i], s);
      }
    }
    return out;
  }
  const frameList = doc => {
    const out = [];
    doc.states.forEach((s, si) => s.frames.forEach((f, fi) => out.push({ state: s, si, frame: f, fi })));
    return out;
  };

  /* ---------------- indexed palette + RLE ---------------- */
  /* One shared palette for the whole document, index 0 reserved for
     transparent. Stable order = first-seen order, so two runs agree. */
  function indexDoc(doc, opts = {}) {
    const scale = Math.max(1, Math.min(16, opts.scale || 1));
    const W = doc.width * scale, H = doc.height * scale;
    const colors = [];
    const lut = new Map();
    const frames = [];
    const upsample = (src, w, h) => {
      if (scale === 1) return src;
      const o = new Uint32Array(w * scale * h * scale);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const v = src[y * w + x]; if (!v) continue;
        for (let dy = 0; dy < scale; dy++) for (let dx = 0; dx < scale; dx++) o[(y * scale + dy) * (w * scale) + x * scale + dx] = v;
      }
      return o;
    };
    for (const f of doc.states.flatMap(s => s.frames)) {
      const buf = upsample(renderFrame(doc, f), doc.width, doc.height);
      const idx = new Uint8Array(W * H);
      for (let i = 0; i < buf.length; i++) {
        const v = buf[i]; if (!v || (v >>> 24) < 128) continue;
        let k = lut.get(v);
        if (k === undefined) { k = colors.length + 1; lut.set(v, k); colors.push(v); }
        idx[i] = k;
      }
      frames.push(idx);
    }
    return { W, H, scale, colors, lut, frames, palette: [0, ...colors] };
  }

  /* Byte-level RLE: [countLo, countHi, index] with count 0 reserved as an
     escape for runs >= 65535. Horizontal runs keep the decoder trivial
     (memcpy-free, one loop) which is what embedded blitters want. */
  function rleFrame(idx) {
    const out = [];
    let i = 0;
    while (i < idx.length) {
      const v = idx[i];
      let n = 1;
      while (i + n < idx.length && idx[i + n] === v && n < 65535) n++;
      out.push(n & 255, (n >> 8) & 255, v);
      i += n;
    }
    return out;
  }

  /* ---------------- SVG ---------------- */
  function svgFrame(doc, frame, opts = {}) {
    const scale = opts.scale || 1;
    const buf = renderFrame(doc, frame);
    const rects = [];
    for (let y = 0; y < doc.height; y++) {
      let x = 0;
      while (x < doc.width) {
        const v = buf[y * doc.width + x];
        if (!v) { x++; continue; }
        let r = x;
        while (r + 1 < doc.width && buf[y * doc.width + r + 1] === v) r++;
        const a = v >>> 24;
        rects.push(`<rect x="${x}" y="${y}" width="${r - x + 1}" height="1" fill="${PF.Color.u32ToHex(v).slice(0, 7)}"${a < 255 ? ` fill-opacity="${(a / 255).toFixed(3)}"` : ''}/>`);
        x = r + 1;
      }
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${doc.width} ${doc.height}" width="${doc.width * scale}" height="${doc.height * scale}" shape-rendering="crispEdges">\n${rects.join('\n')}\n</svg>`;
  }

  /* Animated SVG: every frame is a <g> and a CSS keyframe flicks the visibility
     of each one. Works in every browser, no JS, no sprite sheet request. */
  function svgAnimation(doc, opts = {}) {
    const state = opts.state === undefined ? doc.states[0] : (typeof opts.state === 'string' ? doc.states.find(s => s.name === opts.state) : doc.states[opts.state]);
    if (!state) throw new Error('PF.Export.svgAnimation: unknown state');
    const scale = opts.scale || 1, n = state.frames.length;
    const durs = state.frames.map(f => f.duration || 100);
    const total = durs.reduce((a, b) => a + b, 0);
    let acc = 0;
    const keyframes = [], rules = [];
    state.frames.forEach((f, i) => {
      const from = acc / total * 100; acc += durs[i];
      const to = acc / total * 100;
      /* One keyframe per frame: visible inside its own slice, hidden outside.
         `step-end` holds each value until the next stop, so a 2-stop ramp is
         all that is needed and there is no cross-fade between frames. */
      const kf = `pfaf-cycle-${i}`;
      keyframes.push(`@keyframes ${kf} {\n  0% { visibility: hidden; }\n  ${from.toFixed(4)}% { visibility: visible; }\n  ${to.toFixed(4)}% { visibility: hidden; }\n  100% { visibility: hidden; }\n}`);
      rules.push(`.pfaf-${i} { animation: ${kf} ${(total / 1000).toFixed(3)}s step-end infinite; }`);
    });
    const groups = state.frames.map((f, i) => {
      const body = svgFrame(doc, f).replace(/^<svg[^>]*>\n?/, '').replace(/<\/svg>\s*$/, '');
      return `<g class="pfaf-${i}">\n${body}\n</g>`;
    }).join('\n');
    const css = [`.pfaf { visibility: hidden; }`, ...keyframes, ...rules].join('\n');
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${doc.width} ${doc.height}" width="${doc.width * scale}" height="${doc.height * scale}" shape-rendering="crispEdges">\n<style>\n${css}\n</style>\n${groups}\n</svg>`;
  }

  /* ---------------- live-document adapter ----------------
     PF.Export works on DocData (frames carry `paint` painters) so it can run in
     Node with no canvas. An open studio document stores frames as per-layer
     `Uint32Array`s instead — same pixels, different shape. This bridges them so
     every exporter works on the live document too. */
  function fromStore(doc) {
    const layers = doc.layers.map(l => ({ name: l.name, visible: l.visible !== false, opacity: l.opacity === undefined ? 1 : l.opacity }));
    const ids = doc.layers.map(l => l.id);
    return {
      width: doc.width, height: doc.height, name: doc.name, layers,
      states: doc.states.map(s => ({
        name: s.name, fps: s.fps, loop: s.loop !== false,
        frames: s.frames.map(f => ({
          duration: f.duration,
          paint: (buf) => {
            buf.fill(0);
            for (let li = 0; li < ids.length; li++) {
              const l = layers[li];
              if (!l.visible) continue;
              const src = f.pixels && f.pixels[ids[li]];
              if (!src) continue;
              for (let i = 0; i < buf.length; i++) {
                let px = src[i]; if (!px) continue;
                if (l.opacity < 1) px = ((px & 0xffffff) | (Math.round((px >>> 24) * l.opacity) << 24)) >>> 0;
                buf[i] = (!buf[i] || (px >>> 24) === 255) ? px : PF.Color.blend(buf[i], px);
              }
            }
          }
        }))
      }))
    };
  }

  /* ---------------- C header (RLE) ---------------- */
  function cHeader(doc, opts = {}) {
    const name = slug(opts.name || doc.name).toLowerCase();
    const upper = name.toUpperCase();
    const ix = indexDoc(doc, opts);
    const enc = ix.frames.map(rleFrame);
    const offsets = [];
    let total = 0;
    for (const e of enc) { offsets.push(total); total += e.length; }
    const bytes = [];
    for (const e of enc) bytes.push(...e);
    const hex = (arr, perLine) => {
      const lines = [];
      for (let i = 0; i < arr.length; i += perLine) lines.push('    ' + arr.slice(i, i + perLine).map(b => '0x' + b.toString(16).padStart(2, '0')).join(', '));
      return lines.join(',\n');
    };
    const pal = ix.palette.map(v => '0x' + ((v >>> 0).toString(16).padStart(8, '0'))).join(', ');
    const anims = doc.states.map(s => {
      const first = frameList(doc).findIndex(f => f.state === s);
      return { name: s.name, count: s.frames.length, fps: s.fps, loop: s.loop !== false, first };
    });
    return `/* PixelForge export — ${doc.name}
   ${doc.width}x${doc.height} @${ix.scale}x · ${doc.states.length} states · ${ix.frames.length} frames
   Palette index 0 is transparent. Frames are RLE triples:
     [countLo, countHi, paletteIndex]  (count is a horizontal run length)
   Decode with: for (i=0;i<count;i++) out[p++] = palette[idx];
   Generated deterministically — do not edit by hand. */
#ifndef ${upper}_H
#define ${upper}_H
#include <stdint.h>

#define ${upper}_W ${ix.W}
#define ${upper}_H_ ${ix.H}
#define ${upper}_FRAMES ${ix.frames.length}
#define ${upper}_COLORS ${ix.palette.length}

static const uint32_t ${name}_palette[${ix.palette.length}] = { ${pal} };

/* ${bytes.length} bytes of RLE pixel data */
static const uint8_t ${name}_data[${bytes.length || 1}] = {
${hex(bytes, 16)}
};

static const uint32_t ${name}_offsets[${offsets.length || 1}] = { ${offsets.join(', ')} };

typedef struct { const char *state; uint16_t frames; uint8_t fps; uint8_t loop; uint16_t first; } pf_anim_t;
static const pf_anim_t ${name}_anims[${anims.length}] = {
${anims.map(a => `    { "${a.name}", ${a.count}, ${a.fps}, ${a.loop ? 1 : 0}, ${a.first} }`).join(',\n')}
};

#endif /* ${upper}_H */
`;
  }

  /* ---------------- Tiled TSX (with wang/terrain sets) ---------------- */
  function tiledTSX(doc, opts = {}) {
    const tw = opts.tileWidth || 16, th = opts.tileHeight || 16;
    const columns = opts.columns || Math.max(1, Math.floor(doc.width / tw));
    const count = columns * Math.floor(doc.height / th);
    const name = opts.name || doc.name;
    const image = opts.image || slug(name) + '.png';
    const parts = ['<?xml version="1.0" encoding="UTF-8"?>',
      `<tileset version="1.10" tiledversion="1.10.2" name="${esc(name)}" tilewidth="${tw}" tileheight="${th}" tilecount="${count}" columns="${columns}">`,
      ` <image source="${esc(image)}" width="${doc.width}" height="${doc.height}"/>`];
    if (opts.wang) {
      const w = opts.wang;
      parts.push(` <wangsets>`);
      parts.push(`  <wangset name="${esc(w.name || 'terrain')}" type="${w.type || 'corner'}" tile="-1">`);
      (w.colors || []).forEach((c, i) => parts.push(`   <wangcolor name="${esc(c.name || 'color' + i)}" color="${c.color}" tile="${c.tile === undefined ? -1 : c.tile}" probability="1"/>`));
      (w.tiles || []).forEach(t => parts.push(`   <wangtile tileid="${t.tileid}" wangid="${t.wangid}"/>`));
      parts.push(`  </wangset>`);
      parts.push(` </wangsets>`);
    }
    if (opts.tiles) for (const t of opts.tiles) {
      parts.push(` <tile id="${t.id}">`);
      if (t.properties) { parts.push('  <properties>'); for (const p of t.properties) parts.push(`   <property name="${esc(p.name)}" value="${esc(p.value)}"/>`); parts.push('  </properties>'); }
      parts.push(' </tile>');
    }
    parts.push('</tileset>');
    return parts.join('\n') + '\n';
  }

  /* Tiled TSX with a matching example TMX that tiles the terrain once — proves
     the wang ids are right and gives the developer something to open. */
  function tiledTMX(tsxName, opts = {}) {
    const w = opts.width || 20, h = opts.height || 12, tw = opts.tileWidth || 16, th = opts.tileHeight || 16;
    const data = opts.data || new Array(w * h).fill(0);
    const rows = [];
    for (let y = 0; y < h; y++) rows.push('  ' + data.slice(y * w, y * w + w).join(','));
    return `<?xml version="1.0" encoding="UTF-8"?>
<map version="1.10" tiledversion="1.10.2" orientation="orthogonal" renderorder="right-down" width="${w}" height="${h}" tilewidth="${tw}" tileheight="${th}" infinite="0">
 <tileset firstgid="1" source="${esc(tsxName)}"/>
 <layer name="Ground" width="${w}" height="${h}">
  <data encoding="csv">
${rows.join(',\n')}
  </data>
 </layer>
</map>
`;
  }

  /* ---------------- BMFont (.fnt, AngelCode text) ---------------- */
  function bmfont(font, opts = {}) {
    const f = font;
    const lines = [
      `info face="${esc(opts.face || f.face || 'PixelForge')}" size=${f.lineHeight} bold=0 italic=0 charset="" unicode=1 stretchH=100 smooth=0 aa=1 padding=0,0,0,0 spacing=0,0 outline=0`,
      `common lineHeight=${f.lineHeight} base=${f.base} scaleW=${f.imageWidth} scaleH=${f.imageHeight} pages=1 packed=0 alphaChnl=1 redChnl=0 greenChnl=0 blueChnl=0`,
      `page id=0 file="${esc(opts.image || 'font.png')}"`,
      `chars count=${f.glyphs.length}`
    ];
    for (const g of f.glyphs) {
      lines.push(`char id=${g.id} x=${g.x} y=${g.y} width=${g.w} height=${g.h} xoffset=${g.xoffset} yoffset=${g.yoffset} xadvance=${g.xadvance} page=0 chnl=15`);
    }
    lines.push(`kernings count=0`);
    return lines.join('\n') + '\n';
  }

  /* ---------------- Nine-slice ---------------- */
  const nineSlice = (doc, opts = {}) => JSON.stringify({
    generator: 'PixelForge', source: slug(doc.name), width: doc.width, height: doc.height,
    border: { left: opts.left ?? 4, top: opts.top ?? 4, right: opts.right ?? 4, bottom: opts.bottom ?? 4 },
    center: opts.center || 'stretch',
    scale: opts.scale || 1,
    use: 'Draw 4 corners, 4 edges and a centre; stretch or tile the centre only.'
  }, null, 2) + '\n';

  /* ---------------- generic animation JSON ---------------- */
  function animationJSON(doc, opts = {}) {
    return JSON.stringify({
      generator: 'PixelForge', name: doc.name, width: doc.width, height: doc.height,
      image: opts.image || slug(doc.name) + '.png', scale: opts.scale || 1,
      layers: doc.layers.map(l => l.name),
      states: doc.states.map(s => ({
        name: s.name, fps: s.fps, loop: s.loop !== false,
        totalMs: s.frames.reduce((a, f) => a + (f.duration || 0), 0),
        frames: s.frames.map((f, i) => ({ index: i, duration: f.duration, name: `${slug(doc.name)}_${slug(s.name)}_${i}` }))
      }))
    }, null, 2) + '\n';
  }

  /* ---------------- registry ----------------
     Each entry: {id, name, desc, ext, mime, generate(doc, opts) -> string} */
  const FORMATS = [
    { id: 'godot-import', name: 'Godot 4 import notes', ext: 'md', mime: 'text/markdown',
      desc: 'Step-by-step import recipe for Godot 4 (texture settings + SpriteFrames)', generate: (doc, o) => godotNotes(doc, o) },
    { id: 'tiled-tsx', name: 'Tiled tileset (.tsx)', ext: 'tsx', mime: 'application/xml',
      desc: 'Tileset with tile size/columns + optional wang terrain set', generate: (doc, o) => tiledTSX(doc, o) },
    { id: 'tiled-example', name: 'Tiled example map (.tmx)', ext: 'tmx', mime: 'application/xml',
      desc: 'Starter TMX using the tileset (proves the metadata loads)', generate: (doc, o) => tiledTMX(o.tsx || slug(doc.name) + '.tsx', o) },
    { id: 'c-header', name: 'C header (RLE)', ext: 'h', mime: 'text/plain',
      desc: 'Indexed palette + RLE frames + animation table for embedded targets', generate: (doc, o) => cHeader(doc, o) },
    { id: 'svg-anim', name: 'Animated SVG', ext: 'svg', mime: 'image/svg+xml',
      desc: 'CSS-keyframed SVG animation, one state, no JS', generate: (doc, o) => svgAnimation(doc, o) },
    { id: 'svg', name: 'SVG (static)', ext: 'svg', mime: 'image/svg+xml',
      desc: 'Crisp vector rects of the first frame', generate: (doc, o) => svgFrame(doc, o.frame || doc.states[0].frames[0], o) },
    { id: 'anim-json', name: 'Animation JSON', ext: 'json', mime: 'application/json',
      desc: 'Engine-neutral states, durations and frame names', generate: (doc, o) => animationJSON(doc, o) },
    { id: 'nine-slice', name: 'Nine-slice JSON', ext: 'json', mime: 'application/json',
      desc: '9-patch border metadata for UI panels', generate: (doc, o) => nineSlice(doc, o) }
  ];
  const ids = () => FORMATS.map(f => f.id);
  function generate(id, doc, opts = {}) {
    const f = FORMATS.find(x => x.id === id);
    if (!f) throw new Error(`Unknown export format "${id}". Known: ${ids().join(', ')}`);
    return { format: id, ext: f.ext, mime: f.mime, filename: (opts.name || slug(doc.name)) + '.' + f.ext, text: f.generate(doc, opts) };
  }

  function godotNotes(doc, o) {
    return `# Importing \`${slug(doc.name)}\` into Godot 4

1. Copy the exported PNG into your project (\`res://art/${slug(doc.name)}.png\`).
2. Select the PNG, open **Import**, and set:
   - **Filter**: *Nearest* (off)
   - **Mipmaps**: off
   - **Compress Mode**: *Lossless*
   - **Sprite Frames** (Advanced Import): keep the auto-detected grid, or use
     \`${slug(doc.name)}.tres\` from the atlas exporter — it references this PNG
     with one AtlasTexture per frame and one animation per state.
3. Click **Reimport**.

\`\`\`gdscript
# Driving it from code without the .tres:
var frames := SpriteFrames.new()
for state in ${JSON.stringify(doc.states.map(s => s.name))}:
    if not frames.has_animation(state):
        frames.add_animation(state)
    frames.set_animation_speed(state, 0) # per-frame durations below
\`\`\`

Per-state timing exported from PixelForge:

| state | frames | fps | loop |
|---|---|---|---|
${doc.states.map(s => `| ${s.name} | ${s.frames.length} | ${s.fps} | ${s.loop !== false} |`).join('\n')}
`;
  }

  return { renderFrame, compositeFrame, fromStore, frameList, indexDoc, rleFrame, svgFrame, svgAnimation,
    cHeader, tiledTSX, tiledTMX, bmfont, nineSlice, animationJSON, godotNotes, FORMATS, ids, generate, slug, esc, C };
})();
