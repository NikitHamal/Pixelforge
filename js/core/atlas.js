/* PixelForge Studio — Texture atlas packer + engine serializers.
   Turns any set of rendered frames into one packed sheet plus metadata for the
   engine the developer actually ships with: Phaser 3, PixiJS, TexturePacker,
   LibGDX, Godot 4 SpriteFrames, Unity sprite-sheet .meta, Starling/Sparrow XML
   and plain CSS.

   The packer is deterministic (stable sort, stable tie-breaks, no randomness)
   so an atlas built in CI has the same bytes as one built in the browser. It
   never allocates a canvas: callers blit placements, this module only plans. */
window.PF = window.PF || {};
PF.Atlas = (() => {
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const slug = s => String(s).replace(/[^a-zA-Z0-9_-]+/g, '_').replace(/^_+|_+$/g, '') || 'item';

  /* ---------------- packer ----------------
     MaxRects with best-short-side-fit, wrapped in a container search: try every
     candidate width, keep the packing with the smallest area. For the sheet
     sizes a 2D game uses (< 4096px) the extra passes cost microseconds and
     routinely save 20-40% of the sheet versus a single fixed-width shelf. */
  function packOnce(rects, maxW, maxH, padding) {
    const free = [{ x: 0, y: 0, w: maxW, h: maxH }];
    const out = [];
    let usedH = 0;
    for (const r of rects) {
      const pw = r.w + padding, ph = r.h + padding;
      let bi = -1, bs = Infinity, bl = Infinity, bx = 0, by = 0;
      for (let i = 0; i < free.length; i++) {
        const f = free[i];
        if (f.w < pw || f.h < ph) continue;
        const leftoverH = f.w - pw, leftoverV = f.h - ph;
        const short = Math.min(leftoverH, leftoverV), long = Math.max(leftoverH, leftoverV);
        if (short < bs || (short === bs && long < bl)) { bs = short; bl = long; bi = i; bx = f.x; by = f.y; }
      }
      if (bi < 0) return null;
      const placed = { id: r.id, x: bx, y: by, w: r.w, h: r.h, rotated: false, meta: r.meta };
      out.push(placed);
      if (by + ph > usedH) usedH = by + ph;
      /* Split every free rect the placement overlaps, then prune contained
         rects. This is the classic MaxRects occupancy update. */
      for (let i = free.length - 1; i >= 0; i--) {
        const f = free[i];
        if (bx >= f.x + f.w || bx + pw <= f.x || by >= f.y + f.h || by + ph <= f.y) continue;
        free.splice(i, 1);
        if (bx > f.x) free.push({ x: f.x, y: f.y, w: bx - f.x, h: f.h });
        if (bx + pw < f.x + f.w) free.push({ x: bx + pw, y: f.y, w: f.x + f.w - (bx + pw), h: f.h });
        if (by > f.y) free.push({ x: f.x, y: f.y, w: f.w, h: by - f.y });
        if (by + ph < f.y + f.h) free.push({ x: f.x, y: by + ph, w: f.w, h: f.y + f.h - (by + ph) });
      }
      for (let i = free.length - 1; i >= 0; i--) for (let j = 0; j < free.length; j++) {
        if (i === j) continue;
        const a = free[i], b = free[j];
        if (a.x >= b.x && a.y >= b.y && a.x + a.w <= b.x + b.w && a.y + a.h <= b.y + b.h) { free.splice(i, 1); break; }
      }
    }
    return { placements: out, height: usedH };
  }

  /* items: [{id, w, h, meta?}] -> {width, height, placements, image, efficiency} */
  function pack(items, opts = {}) {
    const padding = Math.max(0, opts.padding | 0);
    const maxSize = Math.max(16, opts.maxSize || 4096);
    const minSize = Math.max(8, opts.minSize || 64);
    const area = items.reduce((n, r) => n + (r.w + padding) * (r.h + padding), 0);
    const sorted = items.slice().sort((a, b) => (b.h - a.h) || (b.w - a.w) || (a.id < b.id ? -1 : 1));
    const candidates = opts.widths || [];
    if (!candidates.length) {
      let w = minSize;
      while (w < maxSize) { candidates.push(w); w *= 2; }
      candidates.push(maxSize);
    }
    let best = null;
    for (let w of candidates) {
      w = Math.min(maxSize, Math.ceil(Math.max(w, area > 0 ? Math.sqrt(area) : minSize)));
      if (opts.powerOfTwo) w = 1 << Math.ceil(Math.log2(w));
      const r = packOnce(sorted, w, maxSize, padding);
      if (!r) continue;
      let h = r.height;
      if (opts.powerOfTwo) h = 1 << Math.ceil(Math.log2(h));
      if (h > maxSize) continue;
      const score = w * h;
      if (!best || score < best.score) best = { score, width: w, height: h, placements: r.placements };
    }
    if (!best) throw new Error(`PF.Atlas.pack: ${items.length} rects do not fit in ${maxSize}x${maxSize} with padding ${padding}`);
    const { score, ...rest } = best;
    const used = items.reduce((n, r) => n + r.w * r.h, 0);
    return { ...rest, image: null, padding, efficiency: +(used / (best.width * best.height)).toFixed(4), count: items.length };
  }

  /* ---------------- planning from documents ----------------
     entries: [{id, doc, states?: [names], scale?: n}] -> {items, frames, width, height}
     `frames` carries everything the serializers and the blitter need. */
  function plan(entries, opts = {}) {
    const items = [], frames = [];
    for (const e of entries) {
      const doc = e.doc, scale = e.scale || 1;
      const names = e.states && e.states.length ? e.states : doc.states.map(s => s.name);
      for (const s of doc.states) {
        if (!names.includes(s.name)) continue;
        s.frames.forEach((f, fi) => {
          const id = `${slug(e.id)}_${slug(s.name)}_${fi}`;
          items.push({ id, w: doc.width * scale, h: doc.height * scale, meta: { doc: e.id, state: s.name, frame: fi, duration: f.duration, fps: s.fps, loop: s.loop !== false } });
          frames.push({ id, doc: e.id, state: s.name, frame: fi, duration: f.duration, fps: s.fps, loop: s.loop !== false, w: doc.width * scale, h: doc.height * scale });
        });
      }
    }
    const atlas = pack(items, opts);
    const byId = new Map(atlas.placements.map(p => [p.id, p]));
    for (const f of frames) { const p = byId.get(f.id); f.x = p.x; f.y = p.y; }
    return { ...atlas, frames };
  }

  /* ---------------- serializers ---------------- */
  const MIME = { json: 'application/json', xml: 'application/xml', text: 'text/plain' };

  function frameList(atlas, image) {
    return atlas.placements.map(p => ({
      filename: p.id, name: p.id, x: p.x, y: p.y, w: p.w, h: p.h, rotated: false,
      sourceW: p.w, sourceH: p.h, meta: p.meta || {}, image
    }));
  }

  const FORMATS = {
    /* Compact hash: name -> [x, y, w, h]. The friendliest for hand-written code. */
    'json-hash': {
      name: 'Atlas JSON (hash)', ext: 'json', mime: MIME.json,
      write: (a, o) => JSON.stringify({
        image: o.image, size: { w: a.width, h: a.height }, padding: a.padding,
        frames: Object.fromEntries(frameList(a, o.image).map(f => [f.name, [f.x, f.y, f.w, f.h]])),
        animations: anims(a, o)
      }, null, 2)
    },
    phaser3: {
      name: 'Phaser 3 atlas', ext: 'json', mime: MIME.json,
      write: (a, o) => JSON.stringify({
        frames: Object.fromEntries(frameList(a, o.image).map(f => [f.name, {
          frame: { x: f.x, y: f.y, w: f.w, h: f.h }, rotated: false, trimmed: false,
          spriteSourceSize: { x: 0, y: 0, w: f.w, h: f.h }, sourceSize: { w: f.w, h: f.h }, duration: f.meta.duration || 100
        }])),
        meta: { app: 'PixelForge', version: '2.0', image: o.image, format: 'RGBA8888', size: { w: a.width, h: a.height }, scale: '1', frameTags: anims(a, o) }
      }, null, 2)
    },
    texturepacker: {
      name: 'TexturePacker JSON', ext: 'json', mime: MIME.json,
      write: (a, o) => JSON.stringify({
        frames: frameList(a, o.image).map(f => ({
          filename: f.filename, frame: { x: f.x, y: f.y, w: f.w, h: f.h }, rotated: false, trimmed: false,
          spriteSourceSize: { x: 0, y: 0, w: f.w, h: f.h }, sourceSize: { w: f.w, h: f.h }
        })),
        meta: { app: 'PixelForge', version: '2.0', image: o.image, format: 'RGBA8888', size: { w: a.width, h: a.height }, scale: '1', smartupdate: '' }
      }, null, 2)
    },
    libgdx: {
      name: 'LibGDX atlas', ext: 'json', mime: MIME.json,
      write: (a, o) => JSON.stringify({
        file: o.image,
        frames: frameList(a, o.image).map(f => ({ filename: f.filename, x: f.x, y: f.y, w: f.w, h: f.h }))
      }, null, 2)
    },
    sparrow: {
      name: 'Starling / Sparrow XML', ext: 'xml', mime: MIME.xml,
      write: (a, o) => '<?xml version="1.0" encoding="UTF-8"?>\n<TextureAtlas imagePath="' + esc(o.image) + '" width="' + a.width + '" height="' + a.height + '">\n' +
        frameList(a, o.image).map(f => `  <SubTexture name="${esc(f.name)}" x="${f.x}" y="${f.y}" width="${f.w}" height="${f.h}"/>`).join('\n') + '\n</TextureAtlas>\n'
    },
    /* Godot 4 SpriteFrames with one AtlasTexture per frame and one animation
       per source state — drop-in for AnimatedSprite2D. */
    godot: {
      name: 'Godot 4 SpriteFrames', ext: 'tres', mime: MIME.text,
      write: (a, o, doc) => godotSpriteFrames(a, o, doc)
    },
    unity: {
      name: 'Unity sprite .meta', ext: 'meta', mime: MIME.text,
      write: (a, o) => unityMeta(a, o)
    },
    css: {
      name: 'CSS sprite sheet', ext: 'css', mime: 'text/css',
      write: (a, o) => {
        const lines = [`.pf-sheet { background-image: url('${o.image}'); background-repeat: no-repeat; }`];
        for (const f of frameList(a, o.image)) lines.push(
          `.pf-${slug(f.name)} { width: ${f.w}px; height: ${f.h}px; background-position: -${f.x}px -${f.y}px; }`);
        return lines.join('\n') + '\n';
      }
    },
    cssanim: {
      name: 'CSS animation kit', ext: 'css', mime: 'text/css',
      write: (a, o) => {
        const groups = new Map();
        for (const f of frameList(a, o.image)) {
          if (!f.meta.state) continue;
          if (!groups.has(f.meta.state)) groups.set(f.meta.state, []);
          groups.get(f.meta.state).push(f);
        }
        const out = [`.pf-sheet { background-image: url('${o.image}'); background-repeat: no-repeat; image-rendering: pixelated; }`];
        for (const [state, fs] of groups) {
          if (fs.length < 2) continue;
          const kf = `pf-${slug(state)}`;
          out.push(`@keyframes ${kf} {\n` + fs.map((f, i) => `  ${(i / fs.length * 100).toFixed(2)}% { background-position: -${f.x}px -${f.y}px; }`).join('\n') + '\n}');
          out.push(`.pf-${slug(state)} { width: ${fs[0].w}px; height: ${fs[0].h}px; animation: ${kf} ${(fs.length * (1000 / (fs[0].meta.fps || 8))).toFixed(0)}ms steps(${fs.length}) infinite; }`);
        }
        return out.join('\n') + '\n';
      }
    }
  };

  function anims(a, o) {
    const m = new Map();
    const order = (a.frames || []).slice().sort((x, y) => (x.fps - y.fps) || (x.frame - y.frame));
    for (const f of order) {
      const name = (o && o.prefix ? o.prefix + '_' : '') + f.state;
      if (!m.has(name)) m.set(name, { name, from: 0, to: 0, fps: f.fps, loop: f.loop, frames: [] });
      const g = m.get(name); g.frames.push({ name: `${slug(f.doc)}_${slug(f.state)}_${f.frame}`, x: f.x, y: f.y, w: f.w, h: f.h, duration: f.duration });
      g.to = g.frames.length - 1;
    }
    return [...m.values()];
  }

  /* Godot 4: one AtlasTexture sub-resource per frame + SpriteFrames animations. */
  function godotSpriteFrames(a, o, docName) {
    const fs = frameList(a, o.image);
    const lines = ['[gd_resource type="SpriteFrames" load_steps=' + (fs.length + 2) + ' format=3]', ''];
    lines.push(`[ext_resource type="Texture2D" path="${o.texturePath || 'res://' + o.image}" id="1_sheet"]`, '');
    fs.forEach((f, i) => {
      lines.push(`[sub_resource type="AtlasTexture" id="AtlasTexture_${i + 1}"]`);
      lines.push(`atlas = ExtResource("1_sheet")`);
      lines.push(`region = Rect2(${f.x}, ${f.y}, ${f.w}, ${f.h})`, '');
    });
    lines.push('[resource]');
    const groups = new Map();
    fs.forEach((f, i) => {
      const st = f.meta.state || 'default';
      if (!groups.has(st)) groups.set(st, []);
      groups.get(st).push({ i, dur: (f.meta.duration || 100) / 1000, loop: f.meta.loop !== false });
    });
    lines.push(`animations = [{`);
    let gi = 0;
    for (const [st, list] of groups) {
      const spd = +((1 / (list[0].dur || 0.125)).toFixed(3));
      lines.push(`"frames": [${list.map(f => `{\n"duration": ${f.dur.toFixed(3)},\n"texture": SubResource("AtlasTexture_${f.i + 1}")\n}`).join(', ')}],`);
      lines.push(`"loop": ${list[0].loop},`);
      lines.push(`"name": &"${st}",`);
      lines.push(`"speed": ${spd}`);
      if (++gi < groups.size) lines.push('}, {');
    }
    lines.push('}]');
    return lines.join('\n') + '\n';
  }

  /* Unity TextureImporter .meta with per-frame sprites named `id_state_index`. */
  function unityMeta(a, o) {
    const fs = frameList(a, o.image);
    const guid = o.guid || (() => { let h = 0x811c9dc5; const s = o.image + fs.length; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return (h.toString(16) + '5f4dcc3b5aa765d61d8327deb882cf99').slice(0, 32); })();
    const spriteList = fs.map(f => `      - serializedVersion: 2
        name: ${f.name}
        rect:
          serializedVersion: 2
          x: ${f.x}
          y: ${a.height - f.y - f.h}
          width: ${f.w}
          height: ${f.h}
        alignment: 0
        pivot: {x: 0.5, y: 0.5}
        border: {x: 0, y: 0, z: 0, w: 0}
        spriteID: ${(('0000000000000000' + (f.x * 73856093 ^ f.y * 19349663 ^ f.w * 83492791 ^ f.h * 2654435761).toString(16)).slice(-16))}
        internalID: ${f.x * 100000 + f.y}
        vertices: []
        edges: []`).join('\n');
    return `fileFormatVersion: 2
guid: ${guid}
TextureImporter:
  internalIDToNameTable: []
  externalObjects: {}
  serializedVersion: 12
  mipmaps:
    mipMapMode: 0
    enableMipMap: 0
  isReadable: 1
  filterMode: 0
  textureCompression: 0
  compressionQuality: 50
  spriteMode: 2
  spriteExtrude: 0
  spriteMeshType: 0
  spritePixelsToUnits: 32
  spritePivot: {x: 0.5, y: 0.5}
  spriteBorder: {x: 0, y: 0, z: 0, w: 0}
  spriteGenerateFallbackPhysicsShape: 0
  alphaUsage: 1
  alphaIsTransparency: 1
  textureType: 8
  textureShape: 1
  spriteSheet:
    serializedVersion: 2
    sprites:
${spriteList}
    outline: []
    physicsShape: []
  userData:
  assetBundleName:
  assetBundleVariant:
`;
  }

  const ids = () => Object.keys(FORMATS);
  function write(format, atlas, opts = {}) {
    const f = FORMATS[format];
    if (!f) throw new Error(`Unknown atlas format "${format}". Known: ${ids().join(', ')}`);
    const o = { image: 'sheet.png', ...opts };
    return { format, ext: f.ext, mime: f.mime, filename: (o.name || 'sheet') + '.' + f.ext, text: f.write(atlas, o, o.docName) };
  }

  return { pack, plan, anims, write, FORMATS, ids, slug, esc, godotSpriteFrames, unityMeta };
})();
