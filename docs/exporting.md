# Exporting — from PixelForge to your engine

Everything here is generated from the live document (or from a library template)
and written by one code path, so the browser download and the CLI file are the
same bytes. Nothing needs a build step, a plugin or a service.

```bash
node scripts/forge.js export out/ rpg_knight tiled-tsx
node scripts/forge.js atlas  out/ rpg_knight,pf_scifi_drone godot
node scripts/forge.js sheet  out/ pf_vfx_explosions 4
```

In the studio, the export dialog lists every format. From an agent or a script,
`PF.IO.FORMATS` is the same list:

```js
PF.IO.FORMATS.map(f => f.id);            // 20+ ids
await PF.IO.exportAtlas({ preset: 'phaser3', padding: 1, scale: 1 });
await PF.IO.exportVia('c-header');
PF.Export.generate('nine-slice', doc, { top: 4, bottom: 4 });
```

---

## 1. Atlases (`PF.Atlas`)

The packer is MaxRects with best-short-side-fit, wrapped in a container search:
it tries every candidate width and keeps the tightest result. It is deterministic
— stable sort, stable tie-breaks, no randomness — so an atlas built in CI has
the same layout as one built in the browser.

```js
const atlas = PF.Atlas.plan([{ id: 'hero', doc }], { padding: 1, maxSize: 2048 });
// { width, height, placements, frames, efficiency, count }
const out = PF.Atlas.write('phaser3', atlas, { image: 'hero.png', name: 'hero' });
fs.writeFileSync(out.filename, out.text);
```

### Presets

| Preset | Format | Notes |
|---|---|---|
| `phaser3` | Phaser 3 JSON hash | `frames` map with `sourceSize`/`spriteSourceSize` and `meta.frameTags` |
| `texturepacker` | TexturePacker JSON array | also what PixiJS loaders expect |
| `godot` | Godot 4 `SpriteFrames` `.tres` | one `AtlasTexture` sub-resource per frame, one animation per state, correct `speed` + `loop` |
| `unity` | Unity `TextureImporter` `.meta` | `spriteMode: 2`, one named sprite per frame; Y axis flipped to Unity's origin |
| `sparrow` | Starling / Sparrow XML | `<SubTexture>` entries |
| `libgdx` | LibGDX atlas JSON | `{ file, frames: [{ filename, x, y, w, h }] }` |
| `json-hash` | Compact hash | `name -> [x, y, w, h]` plus an `animations` array |
| `css` | CSS classes | one class per frame with `background-position` |
| `cssanim` | CSS keyframes | one `@keyframes` per animation state |

`PF.Atlas.anims(atlas)` returns the grouped animation list that the JSON presets
embed: `{ name, from, to, fps, loop, frames: [{ name, x, y, w, h, duration }] }`.

**Layout rule of thumb:** at `padding: 1` a 2,000-frame atlas of 32×32 sprites
lands around 91% occupancy in a 2048² sheet. `powerOfTwo: true` rounds both axes
up for engines that need it.

---

## 2. Godot 4

```bash
node scripts/forge.js atlas out/ rpg_knight godot
```

You get `atlas.png` + `atlas.tres` (a `SpriteFrames` resource referencing the
PNG with `res://` paths). Import the PNG with **Filter: Nearest**, **Mipmaps:
off**, **Compress: Lossless**, then attach the `.tres` to an `AnimatedSprite2D`.
Animation names match the PixelForge state names exactly (`idle_down`,
`walk_side`, `attack_side`, …), so existing code keeps working.

`PF.Export.generate('godot-import', doc)` writes the same recipe as markdown,
with the state/frame/fps table for the sprite you are holding.

## 3. Unity

`PF.Atlas.write('unity', atlas, { image: 'hero.png' })` produces the `.meta`.
Import the PNG next to it, and Unity's sprite editor shows one named slice per
frame (`hero_idle_down_0`, …). Physics shape generation is disabled on purpose —
pixel art wants box or no colliders, not traced outlines.

## 4. Tiled (tilesets and terrain)

```js
PF.Export.generate('tiled-tsx', doc, { tileWidth: 16, tileHeight: 16, image: 'tiles.png',
  tiles: doc.wang?.tiles.map(t => ({ id: t.id, properties: [{ name: 'mask', value: String(t.mask) }] })) });
PF.Export.generate('tiled-example', doc, { tsx: 'tiles.tsx' });
```

Per-tile `mask` properties encode the neighbour rule directly (see below), which
is simpler to consume than a wang id and works in any engine:

| bit | 1 | 2 | 4 | 8 | 16 | 32 | 64 | 128 |
|---|---|---|---|---|---|---|---|---|
| neighbour | N | E | S | W | NE | SE | SW | NW |

A **set bit means the neighbour is the same material**, so no rim is drawn on
that side. `PF.AutoTile.build(x0, y0, w, h, (x, y) => bool, { blob })` returns
the tile-index grid for the same map, ready to blit.

## 5. Embedded / C

`PF.Export.generate('c-header', doc)` writes an indexed palette, RLE frames and
an animation table:

```c
#define KNIGHT_W 32
static const uint32_t knight_palette[17] = { ... };   /* index 0 = transparent */
static const uint8_t  knight_data[484419] = { ... };  /* RLE triples */
static const uint32_t knight_offsets[113] = { ... };
static const pf_anim_t knight_anims[24] = { ... };
```

Decode with the obvious loop:

```c
const uint8_t *p = knight_data + knight_offsets[frame];
uint32_t *out = fb;
for (int i = 0; i < KNIGHT_PIXELS; ) {
  int n = p[0] | (p[1] << 8); uint8_t idx = p[2]; p += 3;
  for (int k = 0; k < n; k++) out[i++] = knight_palette[idx];
}
```

The gate (`node scripts/check-export.js`) decodes every RLE frame back to the
original pixels on every build, so the format cannot silently drift.

## 6. Fonts

```js
PF.IO.exportFont({ font: '5x7', scale: 1, color: '#ffffff' });
// → pf-font-5x7.png + pf-font-5x7.fnt (AngelCode BMFont text format)
```

The engine also renders text directly, with wrapping, alignment, shadow and
outline:

```js
PF.Font.draw(api, 'GAME OVER', 2, 4, '#ffffff', { font: '5x7', align: 'center', boxWidth: 28, wrap: 28, shadow: true });
PF.Font.measure('SCORE 1200', { font: '5x7' });   // { w, h, lines }
```

## 7. Web targets

| Format | Use |
|---|---|
| `svg` | crisp vector rects of one frame, infinitely scalable |
| `svg-anim` | one state as an animated SVG using CSS keyframes — no JS, no sheet request |
| `css` / `cssanim` | sprite-sheet CSS classes and keyframed animations |
| `png` / `gif` | raster frames and looping previews |

## 8. Nine-slice

Panels and buttons are authored on a 32×32 cell with a 4px border.
`PF.Export.generate('nine-slice', doc, { left: 4, right: 4, top: 4, bottom: 4 })`
emits the border metadata a 9-patch widget needs.

---

## The pixel buffer contract

Whatever the target, the pixels are the same:

- a frame is a `Uint32Array` of `width * height`, row-major
- each element is **ABGR little-endian** (`0xAABBGGRR`) — exactly the byte order
  of `ImageData.data`, so a `Uint32Array` view over an `ImageData` buffer can be
  written directly
- `0` means fully transparent
- `PF.Color.fromRGBA` / `hexToU32` build colours, `u32ToHex` reads them back,
  `PF.Color.blend` composites

`PF.Export.fromStore(doc)` adapts a live studio document (per-layer buffers) to
the same painter-based document shape the exporters use, so every format works
both on an open project and on a library template in Node.
