# PixelForge

**A browser pixel-art studio plus a procedural game-asset engine.**
Zero dependencies, no build step, no image files — every sprite is drawn at
runtime from deterministic JavaScript maths, in the browser and in Node.

```
189 templates · 2,173 animation states · 8,855 frames · 25 hardware/mood palettes
```

| | |
|---|---|
| **Studio** | `studio.html` — canvas, timeline, tools, export dialog, agent console |
| **Workspace** | `app/index.html` — projects, the template gallery, docs, MCP |
| **Hub** | `index.html` — what this is, and how to start |
| **Demo game** | `games/runefall/` — a playable survivors-like built from the library |

```bash
node scripts/serve.js        # → http://localhost:5173/
node scripts/verify.js       # THE gate: syntax, quality, pixels, engines, docs
node scripts/forge.js list   # browse 189 templates from the shell
```

No `npm install`. Node ≥ 18 for the dev scripts; evergreen browsers for the app.

---

## Why it exists

Hand-drawing pixel art does not scale, and downloading asset packs gives you a
folder of PNGs you cannot retarget. PixelForge generates assets instead:

- **Deterministic.** Every pixel comes from pure maths — same input, same bytes,
  on any machine. That is what makes a pixel-regression test possible.
- **Retargetable.** One library, every era: restyle any asset onto Game Boy,
  NES, C64, PICO-8, Pico-8-adjacent 16-colour, 1-bit ink, sepia, neon, biome
  palettes and more — with real ordered dithering, not a colour filter.
- **Engine-ready.** Packed atlases with Phaser 3 / TexturePacker / Godot 4 /
  Unity / Sparrow / LibGDX / CSS metadata, Tiled tilesets with terrain data,
  RLE C headers, BMFont, animated SVG, nine-slice JSON.
- **Extensible.** A template is a pure function returning frames. Add a file,
  register it, and it shows up in the studio, the gallery, the agent and the CLI.

---

## What is in the box

| Pack | What it covers |
|---|---|
| RPG / medieval | knights, rangers, clerics, rogues, paladins, druids, crusaders, valkyries, jesters, death knights, 60+ foes, townsfolk at work, siege engines, castles |
| Tiny Muster (RTS) | sword/spear/bow/friar/worker militias, 67 states each across all 8 facings |
| Sci-fi / cyberpunk | marines, netrunners, droids, xeno brutes, hover drones, turrets, assault mechs, starfighters, hull tilesets, station props |
| Platformer | side-scroller heroes (jump arc, fall, crouch), squash walkers, flyers, spitters, a stone colossus boss, hazards, blocks, parallax backdrops, HUD |
| Horror / gothic | zombies, bloaters, vampires, ghouls, bog witches, werewolves, spirits, gothic tiles, graveyard props |
| Farming / life-sim | 6 crops × 5 growth stages, tools, produce, tilled soil, buildings, barnyard animals |
| Nature / ocean / space | 8 tree species, ore nodes, critters, birds, fish, coral reef, 5 biome tilesets, orbit props, capital ships |
| Urban / modern | city tiles, street furniture, 8 vehicles, pedestrians, modern interiors, two action heroes |
| VFX | explosions, muzzle flashes, smoke, impacts, beams and magic, ambient weather |
| UI kit | two bitmap fonts, 9-slice panels, button states, gauges, cursors, 16 icons, screen chrome, autotile sets |

Full list with state and frame counts: **[docs/asset-catalogue.md](docs/asset-catalogue.md)**.

---

## The four ways to use it

### 1. In the studio (drag, click, draw)

`node scripts/serve.js`, open the studio, open the template browser, load any
template as a project, edit it, export it. Over 20 export formats are in the
export dialog, including engine atlases.

### 2. From a brief (vibe coding)

```js
PF.Factory.recipe({ brief: 'cozy farm game, pastel, 32px' })
// → { style: 'pastel-dream', items: [ player, enemy, tileset, prop, item, fx, ui, font ] }

PF.Factory.starter('handheld')     // Game Boy flavoured platformer kit
PF.Factory.search('dragon boss')   // ranked templates
PF.Factory.variant('rpg_knight', 'nes')  // one sprite, NES palette
```

Or from the shell, which writes real files:

```bash
node scripts/forge.js kit out/ "cozy farm game, pastel, 32px"
node scripts/forge.js atlas out/ rpg_knight,pf_scifi_drone godot
node scripts/forge.js autotile out/ water
```

### 3. From code (the engine API)

```js
const api = PF.Pixel.makeApi(buf, 32, 32);   // prototype-based, zero per-call closures
api.blob(16, 16, 9, 12, '#e8b796', '#f2c094', '#c28569');
api.arcTrail(16, 16, 10, -1.2, 0.4, ['#8b9bb4', '#c0cbdc', '#ffffff']);
buf.set(PF.Raster.outline(buf, 32, 32, PF.Color.hexToU32('#181425')));

PF.Style.apply(buf, 32, 32, 'gameboy');       // retarget, in place
const atlas = PF.Atlas.plan([{ id: 'hero', doc }], { padding: 1 });
PF.Atlas.write('phaser3', atlas, { image: 'hero.png' });
```

See **[docs/engine-api.md](docs/engine-api.md)**.

### 4. From an AI agent

Every studio capability is a typed tool: `paint_rows`, `load_template`,
`factory_brief`, `restyle_document`, `export_engine`, `describe_ui`, `click_ui`.
They are exposed to the in-app console, to `window.PixelForge.call`, over
`postMessage`, and as an MCP manifest. See **[docs/agent-tools.md](docs/agent-tools.md)**.

---

## Styles

One asset, many eras — deterministic ordered dithering onto a curated palette:

`gameboy` · `gameboy-pocket` · `gameboy-light` · `virtual-boy` · `nes` · `cga` ·
`c64` · `pico8` · `sweetie16` · `mono-1bit` · `sepia` · `noir` · `neon-noir` ·
`vaporwave` · `desert` · `arctic` · `jungle` · `abyss` · `inferno` ·
`pastel-dream` · `holy` · `undead` · `cyberpunk` · `terminal` · `thermal`

```bash
node scripts/forge.js styles
node scripts/forge.js style out/ rpg_knight gameboy
```

Details: **[docs/styles.md](docs/styles.md)**.

---

## Export formats

| Target | Output |
|---|---|
| Phaser 3, PixiJS, TexturePacker, LibGDX, Starling/Sparrow | MaxRects-packed sheet + metadata |
| Godot 4 | `SpriteFrames` `.tres` with one AtlasTexture per frame, one animation per state |
| Unity | sprite-sheet `.meta` importer with named sprites |
| Tiled | `.tsx` tileset with tile size, columns and per-tile mask properties, plus a starter `.tmx` |
| Embedded | indexed palette + RLE frames + animation table as a C header |
| Web | animated SVG (CSS keyframes), CSS sprite sheet, CSS animation kit |
| Fonts | BMFont glyph atlas + `.fnt` |
| UI | nine-slice border JSON |
| Generic | animation JSON, PNG frames, GIF, project file |

Full reference: **[docs/exporting.md](docs/exporting.md)**.

---

## Commands

| Task | Command |
|---|---|
| **Verify everything** | `node scripts/verify.js` |
| Dev server | `node scripts/serve.js [port]` |
| Sprite quality gate | `node scripts/check-rpg.js` |
| Style-engine gate | `node scripts/check-style.js` |
| Atlas packer gate | `node scripts/check-atlas.js` |
| Export-format gate | `node scripts/check-export.js` |
| Bitmap-font gate | `node scripts/check-font.js` |
| Reference + tool-schema gate | `node scripts/check-refs.js` |
| Docs gate | `node scripts/check-docs.js` |
| Prove a refactor changed no pixels | `node scripts/sprite-hash.js diff scripts/hashes-baseline` |
| Re-baseline after an intended art change | `node scripts/verify.js --update-baseline` |
| Browse the catalogue | `node scripts/info.js` |
| Look at a sprite sheet | `node scripts/sheet.js rpg_knight 6 run` |
| Machine-readable catalogue | `node scripts/catalogue.js` |
| Batch export / kits | `node scripts/forge.js` |
| Perf comparison | `node scripts/bench-compare.js` |

### Performance (measured in-process, best of 3, `node scripts/bench-compare.js`)

| Path | Before | After | Speedup |
|---|---|---|---|
| colour parse (memoised) | 112.1 ns | 9.6 ns | 11.7× |
| outline, 32² sprite | 18.3 µs | 4.2 µs | 4.4× |
| outline, sparse sprite | 20.3 µs | 4.1 µs | 5.0× |
| dither fill, 32² | 113.7 µs | 3.3 µs | 34.1× |
| speckle fill, 32² | 65.2 µs | 15.9 µs | 4.1× |
| makeApi + draw | 2.1 µs | 0.77 µs | 2.7× |
| **full library build** (189 templates, 8,855 frames) | **261 ms** | **183 ms** | **1.43×** |

---

## How it is built

```
index.html            landing hub
studio.html           the editor
app/index.html        workspace shell (projects, gallery, agent, docs, MCP)
games/runefall/       playable demo that consumes the library

css/                  tokens, base, studio chrome
js/core/              store, raster, renderer, input, animation, io, projects,
                      style, atlas, export, factory
js/library/           the draw API, the rigs, and every asset pack
js/agent/             typed tool surface for in-app agents (console, MCP, bridge)
js/ui/                page boot scripts
scripts/              zero-dependency Node tooling: gates, sheets, benchmarks, CLI
docs/                 exporting, engine API, styles, agent tools, architecture
```

Design rules and invariants live in **[AGENTS.md](AGENTS.md)** — read it before
editing the engine. Architecture notes: **[docs/architecture.md](docs/architecture.md)**.

---

## Continuous integration

`ci/verify.yml` is the GitHub Actions workflow: it runs `node scripts/verify.js`,
the benchmarks, the catalogue check and a `forge.js` smoke test. GitHub only
executes workflows under `.github/workflows/`, so install it once:

```bash
mkdir -p .github/workflows && cp ci/verify.yml .github/workflows/verify.yml
```

## Contributing

New packs are welcome, and the bar is mechanical: a template is a pure function,
every frame ends with the outline pass, frames must actually differ, and the
gates must pass. See **[CONTRIBUTING.md](CONTRIBUTING.md)**.

## License

MIT — see **[LICENSE](LICENSE)**.
