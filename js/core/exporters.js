/* PixelForge Studio — engine-native export targets.
   Given a plain atlas description these emit the project file each engine
   actually imports, so a sprite goes from PixelForge into a running game
   without hand-writing frame tables.

   The atlas shape every writer consumes:
     { name, image, width, height, frameWidth, frameHeight, columns,
       frames: [{ name, state, index, x, y, w, h, duration }],
       states: [{ name, fps, loop, from, to }] }
   `fromSheet()` builds it from PF.IO.buildSheet(); the CLI builds it directly.
   Pure string generation — no DOM, no canvas. */
window.PF = window.PF || {};
PF.Exporters = (() => {
  const safe = s => String(s || 'sprite').replace(/[^a-z0-9_-]+/gi, '_').toLowerCase();
  const pad = (n, w = 2) => String(n).padStart(w, '0');
  const j = o => JSON.stringify(o, null, 2);

  /* Adapt the browser sheet builder's Aseprite-style atlas to the shape above. */
  function fromSheet(sheet, opts = {}) {
    const a = sheet.atlas, name = opts.name || (a.meta.image || 'sprite').replace(/\.png$/, '');
    const frames = Object.entries(a.frames).map(([key, f], i) => ({
      name: key, state: key.replace(/_\d+$/, ''), index: i,
      x: f.frame.x, y: f.frame.y, w: f.frame.w, h: f.frame.h, duration: f.duration
    }));
    return {
      name, image: a.meta.image, width: a.meta.size.w, height: a.meta.size.h,
      frameWidth: sheet.frameWidth, frameHeight: sheet.frameHeight, columns: sheet.cols,
      frames, states: a.meta.frameTags.map(t => ({ name: t.name, fps: t.fps, loop: t.loop !== false, from: t.from, to: t.to }))
    };
  }

  /* ---- Godot 4: a SpriteFrames resource referencing an AtlasTexture per frame ---- */
  function godot4(at) {
    const n = at.frames.length;
    // sub-resource ids must be unique and stable; frame index is the natural key
    const subs = at.frames.map((f, i) => `[sub_resource type="AtlasTexture" id="Atlas_${pad(i, 3)}"]
atlas = ExtResource("1_tex")
region = Rect2(${f.x}, ${f.y}, ${f.w}, ${f.h})
`).join('\n');
    const anims = at.states.map(s => {
      const list = at.frames.slice(s.from, s.to + 1).map((f, k) => `{
"duration": 1.0,
"texture": SubResource("Atlas_${pad(s.from + k, 3)}")
}`).join(', ');
      return `{
"frames": [${list}],
"loop": ${s.loop ? 'true' : 'false'},
"name": &"${s.name}",
"speed": ${s.fps.toFixed(1)}
}`;
    }).join(', ');
    return `[gd_resource type="SpriteFrames" load_steps=${n + 2} format=3]

[ext_resource type="Texture2D" path="res://${at.image}" id="1_tex"]

${subs}
[resource]
animations = [${anims}]
`;
  }

  /* ---- Godot 4 tileset resource for a sliced sheet ---- */
  function godotTileSet(at, opts = {}) {
    const tw = opts.tileWidth || at.frameWidth, th = opts.tileHeight || at.frameHeight;
    const cols = Math.floor(at.width / tw), rows = Math.floor(at.height / th);
    const tiles = [];
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) tiles.push(`${x}:${y}/0 = 0`);
    return `[gd_resource type="TileSet" load_steps=3 format=3]

[ext_resource type="Texture2D" path="res://${at.image}" id="1_tex"]

[sub_resource type="TileSetAtlasSource" id="TileSetAtlasSource_0"]
texture = ExtResource("1_tex")
texture_region_size = Vector2i(${tw}, ${th})
${tiles.join('\n')}

[resource]
tile_size = Vector2i(${tw}, ${th})
sources/0 = SubResource("TileSetAtlasSource_0")
`;
  }

  /* ---- Unity: sprite sheet meta with a named sprite rect per frame ----
     Unity's y axis runs from the bottom, so every rect is flipped here. */
  function unity(at) {
    const rects = at.frames.map((f, i) => `    - serializedVersion: 2
      name: ${at.name}_${f.name}
      rect:
        serializedVersion: 2
        x: ${f.x}
        y: ${at.height - f.y - f.h}
        width: ${f.w}
        height: ${f.h}
      alignment: 9
      pivot: {x: 0.5, y: 0}
      border: {x: 0, y: 0, z: 0, w: 0}
      spriteID: ${pad(i, 8)}0000000000000000
      internalID: ${i + 1}`).join('\n');
    return `fileFormatVersion: 2
TextureImporter:
  spriteMode: 2
  spritePixelsToUnits: ${at.frameHeight}
  filterMode: 0
  textureCompression: 0
  maxTextureSize: 2048
  alphaIsTransparency: 1
  spriteMeshType: 0
  spriteExtrude: 0
  spriteSheet:
    serializedVersion: 2
    sprites:
${rects}
  spritePackingTag: ${at.name}
`;
  }

  /* ---- Phaser 3: atlas JSON (hash) + an animation config module ---- */
  const phaserAtlas = at => j({
    frames: at.frames.reduce((o, f) => {
      o[f.name] = { frame: { x: f.x, y: f.y, w: f.w, h: f.h }, rotated: false, trimmed: false,
        spriteSourceSize: { x: 0, y: 0, w: f.w, h: f.h }, sourceSize: { w: f.w, h: f.h } };
      return o;
    }, {}),
    meta: { app: 'PixelForge Studio', image: at.image, format: 'RGBA8888', size: { w: at.width, h: at.height }, scale: '1' }
  });
  function phaserAnims(at) {
    const anims = at.states.map(s => `    this.anims.create({
      key: '${at.name}-${s.name}',
      frames: this.anims.generateFrameNames('${at.name}', { frames: [${at.frames.slice(s.from, s.to + 1).map(f => `'${f.name}'`).join(', ')}] }),
      frameRate: ${s.fps},
      repeat: ${s.loop ? -1 : 0}
    });`).join('\n');
    return `/* Generated by PixelForge Studio. Call registerAnims(scene) after preload. */
export function preload(scene) {
  scene.load.atlas('${at.name}', '${at.image}', '${at.name}.json');
}

export function registerAnims(scene) {
  (function () {
${anims}
  }).call(scene);
}
`;
  }

  /* ---- LÖVE (Love2D): quads + a tiny animation table ---- */
  function love2d(at) {
    const quads = at.frames.map(f => `    love.graphics.newQuad(${f.x}, ${f.y}, ${f.w}, ${f.h}, sheet:getDimensions())`).join(',\n');
    const states = at.states.map(s => `    ["${s.name}"] = { from = ${s.from + 1}, to = ${s.to + 1}, fps = ${s.fps}, loop = ${s.loop ? 'true' : 'false'} }`).join(',\n');
    return `-- Generated by PixelForge Studio
local M = {}
local sheet = love.graphics.newImage("${at.image}")
sheet:setFilter("nearest", "nearest")

M.sheet = sheet
M.frameWidth, M.frameHeight = ${at.frameWidth}, ${at.frameHeight}
M.quads = {
${quads}
}
M.states = {
${states}
}

function M.newPlayer(name)
  local st = M.states[name]
  return { state = st, t = 0, i = st.from,
    update = function(self, dt)
      self.t = self.t + dt
      local step = 1 / self.state.fps
      while self.t >= step do
        self.t = self.t - step
        self.i = self.i + 1
        if self.i > self.state.to then self.i = self.state.loop and self.state.from or self.state.to end
      end
    end,
    draw = function(self, x, y, sx, sy)
      love.graphics.draw(M.sheet, M.quads[self.i], x, y, 0, sx or 1, sy or 1)
    end }
end

return M
`;
  }

  /* ---- GameMaker: a sprite .yy stub listing the frames in order ---- */
  function gamemaker(at) {
    return j({
      resourceType: 'GMSprite', resourceVersion: '1.0', name: at.name,
      bboxMode: 0, bbox_left: 0, bbox_top: 0, bbox_right: at.frameWidth - 1, bbox_bottom: at.frameHeight - 1,
      width: at.frameWidth, height: at.frameHeight, origin: 4,
      frames: at.frames.map((f, i) => ({ resourceType: 'GMSpriteFrame', resourceVersion: '1.1', name: `frame_${i}` })),
      sequence: {
        resourceType: 'GMSequence', resourceVersion: '1.4', name: at.name,
        playbackSpeed: at.states[0] ? at.states[0].fps : 10, playbackSpeedType: 0,
        length: at.frames.length, events: { Keyframes: [] },
        tracks: [{ resourceType: 'GMSpriteFramesTrack', resourceVersion: '1.0', name: 'frames',
          keyframes: { Keyframes: at.frames.map((f, i) => ({ id: `kf_${i}`, Key: i, Length: 1 })) } }]
      }
    });
  }

  /* ---- Aseprite-compatible JSON (array form, which Tiled and TexturePacker read) ---- */
  const asepriteArray = at => j({
    frames: at.frames.map(f => ({ filename: f.name, frame: { x: f.x, y: f.y, w: f.w, h: f.h },
      rotated: false, trimmed: false, spriteSourceSize: { x: 0, y: 0, w: f.w, h: f.h },
      sourceSize: { w: f.w, h: f.h }, duration: f.duration })),
    meta: { app: 'PixelForge Studio', version: '1.0', image: at.image, format: 'RGBA8888',
      size: { w: at.width, h: at.height }, scale: '1',
      frameTags: at.states.map(s => ({ name: s.name, from: s.from, to: s.to, direction: 'forward' })) }
  });

  /* ---- CSS keyframe animation driven by background-position ---- */
  function cssAnim(at) {
    const cls = safe(at.name);
    return at.states.map(s => {
      const n = s.to - s.from + 1;
      const steps = at.frames.slice(s.from, s.to + 1).map((f, i) =>
        `  ${((i / n) * 100).toFixed(3)}% { background-position: -${f.x}px -${f.y}px; }`).join('\n');
      return `.${cls}-${safe(s.name)} {
  width: ${at.frameWidth}px; height: ${at.frameHeight}px;
  background-image: url("${at.image}");
  image-rendering: pixelated;
  animation: ${cls}-${safe(s.name)} ${(n / s.fps).toFixed(3)}s steps(1, end) ${s.loop ? 'infinite' : '1'};
}
@keyframes ${cls}-${safe(s.name)} {
${steps}
  100% { background-position: -${at.frames[s.to].x}px -${at.frames[s.to].y}px; }
}`;
    }).join('\n\n') + '\n';
  }

  /* ---- plain metadata, for custom engines ---- */
  const frameList = at => j({
    name: at.name, image: at.image, frameWidth: at.frameWidth, frameHeight: at.frameHeight,
    columns: at.columns, sheet: { width: at.width, height: at.height },
    animations: at.states.map(s => ({ name: s.name, fps: s.fps, loop: s.loop,
      frames: at.frames.slice(s.from, s.to + 1).map(f => ({ x: f.x, y: f.y, w: f.w, h: f.h, duration: f.duration })) }))
  });

  const TARGETS = [
    { id: 'godot4', name: 'Godot 4 — SpriteFrames', ext: 'tres', mime: 'text/plain', run: godot4 },
    { id: 'godot-tileset', name: 'Godot 4 — TileSet', ext: 'tres', mime: 'text/plain', run: godotTileSet },
    { id: 'unity', name: 'Unity — sprite sheet meta', ext: 'png.meta', mime: 'text/yaml', run: unity },
    { id: 'phaser-atlas', name: 'Phaser 3 — atlas JSON', ext: 'json', mime: 'application/json', run: phaserAtlas },
    { id: 'phaser-anims', name: 'Phaser 3 — animation module', ext: 'js', mime: 'text/javascript', run: phaserAnims },
    { id: 'love2d', name: 'LÖVE — quads + player', ext: 'lua', mime: 'text/plain', run: love2d },
    { id: 'gamemaker', name: 'GameMaker — sprite .yy', ext: 'yy', mime: 'application/json', run: gamemaker },
    { id: 'aseprite', name: 'Aseprite JSON (array)', ext: 'json', mime: 'application/json', run: asepriteArray },
    { id: 'css-anim', name: 'CSS keyframes', ext: 'css', mime: 'text/css', run: cssAnim },
    /* Deliberately NOT id 'frames': the CLI already uses that word for
       "one PNG per frame", and two meanings for one --format value is a
       coin toss over what lands on disk. */
    { id: 'json', name: 'Frame list JSON', ext: 'json', mime: 'application/json', run: frameList }
  ];
  function run(id, atlas, opts) {
    const t = TARGETS.find(x => x.id === id);
    if (!t) throw new Error(`Unknown export target "${id}". Use: ${TARGETS.map(x => x.id).join(', ')}`);
    return { id, filename: `${safe(atlas.name)}.${t.ext}`, mime: t.mime, text: t.run(atlas, opts || {}) };
  }

  return { TARGETS, run, fromSheet, godot4, godotTileSet, unity, phaserAtlas, phaserAnims,
    love2d, gamemaker, asepriteArray, cssAnim, frameList };
})();
