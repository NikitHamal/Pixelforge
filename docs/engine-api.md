# Engine API

Everything hangs off one global, `window.PF`. Modules are IIFEs that assign onto
it and resolve each other lazily, so load order is forgiving — but the
conventional order is: `core/*` → `library/*` → `agent/*` → `ui/*`.

| Module | What it does |
|---|---|
| `PF.Color` | u32 colour maths: `fromRGBA`, `hexToU32`, `u32ToHex`, `rgba`, `blend`, `shade`, `luma` |
| `PF.Raster` | pixel algorithms on `Uint32Array` buffers |
| `PF.Pixel` | the draw API every template uses, plus rig primitives and FX helpers |
| `PF.Chars` / `PF.RPG` / `PF.Monsters` / … | the character and creature rigs |
| `PF.Library` | template registry: `list`, `get`, `categories`, `docStats`, `thumbnail`, `instantiate` |
| `PF.Store` | the open document: layers, states, frames, undo/redo, events |
| `PF.Renderer` | canvas compositing, zoom/pan, grid, onion skin |
| `PF.Input` | pointer tools, selection, clipboard, symmetry |
| `PF.Anim` | playback engine, state presets, live preview |
| `PF.IO` | import/export: PNG, GIF, sheets, 20+ engine formats |
| `PF.Projects` | project persistence (localStorage) |
| `PF.Style` | palettes and style retargeting |
| `PF.Atlas` | atlas packing and metadata serialization |
| `PF.Export` | engine-format generators |
| `PF.Font` | bitmap fonts, text layout, BMFont data |
| `PF.AutoTile` | wang/blob tileset generation |
| `PF.Factory` | briefs, recipes and starter packs |
| `PF.Tools` | the typed agent tool registry |

---

## Buffers and colour

```js
const buf = new Uint32Array(32 * 32);        // ABGR little-endian, 0 = clear
const red = PF.Color.hexToU32('#e43b44');    // memoised — call it freely
PF.Color.u32ToHex(red);                      // '#e43b44'
PF.Color.blend(dst, src);                    // straight-alpha over
```

`hexToU32` is memoised behind a bounded `Map`; it is called once per pixel per
draw, so never re-implement colour parsing locally.

## Drawing

`PF.Pixel.makeApi(buf, W, H)` returns a prototype-based `Api`. All coordinates
are rounded and bounds-checked internally — you can draw off-canvas safely.

```js
api.px(x, y, c)                        api.rect(x0, y0, x1, y1, c)          // filled
api.rectO(x0, y0, x1, y1, c, size)     api.line(x0, y0, x1, y1, c, size)    // Bresenham
api.ellipse(x0, y0, x1, y1, c, fill)   api.fill(x, y, c)                    // flood
api.shadeRect(x0, y0, x1, y1, amt)     api.hash(x, y, seed)                 // deterministic 0..1
```

Volume and texture helpers (deterministic, all routed through `px`/`rect` so
translated views keep working):

```js
api.grad(x0, y0, x1, y1, cTop, cBot)      // vertical gradient
api.dith(x0, y0, x1, y1, cA, cB, seed)    // checker dither
api.speck(x0, y0, x1, y1, seed, colors, density)  // hash speckle
api.blob(cx, cy, rx, ry, base, hi, sh)    // rounded mass with top light + bottom shade
api.rim(x0, y0, x1, y1, light)            // top-edge rim light
```

`PF.Pixel.offsetApi(api, ox, oy)` returns a translated view that inherits every
method it does not override — **prefer it over `{ ...api }`, which silently drops
every prototype method.**

Motion primitives, used by the strike/footfall effects:

```js
PF.Pixel.arcTrail(api, cx, cy, r, a0, a1, colors, opts)  // swept blade with a tail that thins
PF.Pixel.dustPuff(api, cx, groundY, seed, t, color, n)     // contact dust that rises
PF.Pixel.impactStar(api, cx, cy, t, colors, r)             // 8-point contact star
```

Tools (all drawn from a hand at an angle): `sword`, `axe`, `pickaxe`, `mace`,
`hammer`, `spear`, `scythe`, `claw`, `rifle`, `pistol`, `blaster`, `wrench`,
`shovel`, `net`, `bow`, `bowFront`, `kiteShield`, `shield`.

Effect primitives: `slash`, `sparks`, `particles`, `beam`, `muzzle`, `ring`,
`smokePuff`, `splash`, `bubble`, `leaf`, `precip`, `canopy`, `shadowFlat`.

## Raster

```js
PF.Raster.outline(buf, W, H, color, diagonal)     // 1px silhouette pass, returns a new buffer
PF.Raster.outlineSelective(buf, W, H, color, { light })  // outline + top rim light
PF.Raster.composite(out, layers)                  // alpha-composite visible layers
PF.Raster.flipH / flipV / rotate90 / shift / mirrorInto
PF.Raster.replaceColor, shadeRegion, bounds, colorsOf
PF.Raster.paintRows(buf, W, H, rows, legend, ox, oy)   // ASCII-art painting (agent-friendly)
PF.Raster.toRows(buf, W, H)                            // read back as hex rows
```

`outline()` skips any row with no opaque pixel in it or either neighbour — an
outline pixel needs an orthogonal opaque neighbour, so the result is identical
and sparse sprites (the normal case) render ~4× faster.

## Styles

```js
PF.Style.list()                       // 25 styles with palettes, tags, era
PF.Style.apply(buf, W, H, 'gameboy')  // in place; exact palette + ordered dither
PF.Style.tint(buf, W, H, '#ff2e88', 0.5)
PF.Style.warmCool(buf, W, H, 0.5)     // hue-shifted highlight/shadow pass
PF.Style.docOf(doc, 'nes')            // pure: a restyled copy, original untouched
PF.Style.register({ id, name, palette: ['#...'], dither: true, tags: [] })
```

## Atlas

```js
PF.Atlas.pack(items, { padding, maxSize, powerOfTwo })   // items: [{id,w,h,meta}]
PF.Atlas.plan([{ id, doc, scale }], { padding, maxSize })
PF.Atlas.anims(atlas)
PF.Atlas.write('godot', atlas, { image, name, docName })
```

## Export

```js
PF.Export.ids()                                  // ['godot-import', 'tiled-tsx', ...]
PF.Export.generate('tiled-tsx', doc, { tileWidth: 16 })
PF.Export.fromStore(storeDoc)                    // live document -> painter document
PF.Export.renderFrame(doc, frame)                // Uint32Array
PF.Export.indexDoc(doc, { scale })               // palette + indexed frames
PF.Export.svgAnimation(doc, { state: 'idle', scale: 4 })
```

## Font

```js
PF.Font.fonts()                                  // [{ id: '5x7', ... }, { id: '3x5' }]
PF.Font.measure('SCORE', { font: '5x7', scale: 2 })
PF.Font.wrap(text, maxWidth, opts)
PF.Font.draw(api, text, x, y, color, { font, scale, spacing, align, boxWidth, shadow, outline, wrap })
PF.Font.toBuffer(text, opts)                     // { buf, W, H }
PF.Font.charsetDoc('5x7')                        // a DocData glyph sheet
PF.Font.atlasData('5x7', { scale })              // BMFont-ready atlas + glyph metrics
```

## AutoTile

```js
PF.AutoTile.maskAt(x, y, fn)          // 8-bit neighbour mask
PF.AutoTile.canonical(mask)           // collapse to the 47-blob mask
PF.AutoTile.build(x0, y0, w, h, fn, { blob })   // tile-index grid for a map
PF.AutoTile.sheetDoc({ material, blob, size })
PF.AutoTile.material({ colors, rim, rimHi, rimLo, seed })
```

## Factory

```js
PF.Factory.help()                                   // genres, roles, starters, styles
PF.Factory.search('dragon boss')                    // ranked templates
PF.Factory.recipe({ brief, genre, style, size, roles })
PF.Factory.starter('handheld')                      // a genre + style preset kit
PF.Factory.variant('rpg_knight', 'nes')             // one styled asset
```

## Library

```js
PF.Library.list()                     // every template: { id, name, category, desc, tags, w, h, featured }
PF.Library.get('rpg_knight')
PF.Library.categories()               // ['All', 'Featured', 'Heroes', ...]
PF.Library.docStats('rpg_knight')     // memoised { states, frames, width, height, stateNames }
PF.Library.thumbnail('rpg_knight', 3) // cached data URL
PF.Library.instantiate('rpg_knight')  // load as a new editable project
PF.Library.registerPack(add => add(...))  // add packs at runtime
```

## Store (the open document)

```js
const d = PF.Store.get();                     // { width, height, layers, states, activeState, activeFrame, ... }
PF.Store.frame()                              // active frame: { duration, pixels: { layerId: Uint32Array } }
PF.Store.transact(doc => { /* mutate, undoable */ });
const px = PF.Store.beginStroke(layerId);     // fast path for pixel edits
PF.Store.endStroke();
PF.Store.on('change' | 'doc' | 'active' | 'render' | 'tool' | 'view' | 'color' | 'play' | 'history', fn);
```

## Writing a template

```js
PF.Library.registerPack(add => {
  add('pf_example', 'Example', 'Enemies', 'What it is and how it animates.',
    ['enemy', 'fantasy'],
    () => {
      const frame = (dur, paint) => ({ duration: dur, paint });
      const body = (buf) => {
        const api = PF.Pixel.makeApi(buf, 32, 32);
        api.blob(16, 18, 8, 7, '#b86f50', '#e4a672', '#733e39');
        buf.set(PF.Raster.outline(buf, 32, 32, PF.Color.hexToU32('#181425')));
      };
      return { width: 32, height: 32, name: 'pf-example', layers: [{ name: 'Body' }],
        states: [{ name: 'idle', fps: 4, loop: true, frames: [frame(250, body)] }] };
    },
    { w: 32, h: 32 });
});
```

Rules that the gates enforce: `build()` is pure (no DOM, no `Store`, no globals),
no `Math.random`/`Date.now` (use `api.hash`), every frame ends with the outline
pass, consecutive frames differ by ≥ 8 pixels, and figures touch the ground at
`y = 25..27` with no baked shadow.
