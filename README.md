# PixelForge

**A pixel-art studio and a procedural game-asset engine, in one repository, with zero dependencies and no build step.**

Every sprite in PixelForge is *generated* — there are no image files anywhere in this repo. A template is a pure function that paints into a `Uint32Array`, so the whole library is a few hundred kilobytes of maths that expands into **190 templates / 2,031 animation states / 8,422 frames** at runtime. Open `index.html` in a browser and it works. Run `npx pixelforge export` and the same painters write PNGs, GIFs and engine project files to disk.

```
Enemies 49 · World 43 · Heroes 32 · NPCs 19 · UI 14 · Items 13 · FX 12 · Animals 8
```

### The Forge

That catalogue is finite. `js/library/forge.js` is not: it takes a seed and derives a
whole character from it — kin, role, headgear, weapon, armour, cloak and a complete
palette — then dresses the shared humanoid rig and returns six animated states
(idle, walk, run, a weapon-appropriate attack, hurt, death). **7,280 distinct
silhouette-and-kit combinations** before palette, which is continuous. The same seed
always forges the same character, so a seed is a shareable asset.

```js
PF.Forge.suite('ironvale-captain');                       // a whole 32x32 six-state doc
PF.Forge.suite('42', { role: 'caster', held: 'scythe' }); // pin what you care about
PF.Forge.roster('wave-3', 12, { role: 'undead' });        // a deduped warband
```

It is reachable three ways: the **Forge panel** on the Templates view of `app/index.html`,
the `forge_character` / `forge_options` agent tools, and `PF.Forge` directly. Eight
showcase rolls are pinned into the library as `forge_*` templates so the generator runs
through every gate the hand-drawn packs do.

---

## Quick start

**In a browser** — no server needed for the gallery:

```sh
git clone https://github.com/NikitHamal/Pixelforge.git
cd Pixelforge
node scripts/serve.js          # http://localhost:5173
```

| Page | What it is |
|---|---|
| `index.html` | Asset gallery — browse, preview, export |
| `studio.html` | Full editor: layers, timeline, palettes, effects |
| `app/index.html` | Compact mobile-first studio |
| `games/runefall/` | Side-on action demo, built entirely from library assets |
| `games/nightfall/` | Top-down survival shooter on the top-down pack |
| `games/ironvale/` | Isometric skirmish on the iso pack |
| `games/gatehold/` | Settlement defence: villagers, roads and gates against night waves of ants |

**On the command line** — no install, no `node_modules`:

```sh
node bin/pixelforge.js list --category Heroes
node bin/pixelforge.js info farm_farmer
node bin/pixelforge.js export rpg_knight --format png,gif --scale 4 --out ./assets
node bin/pixelforge.js pack --category Enemies --format png,phaser-atlas --out ./assets/enemies
```

---

## The CLI

```
pixelforge <command> [options]

  list [query]      Browse the catalogue   --category --tag --featured --json
  info <id>         States, frames, timings for one template   --json
  export <id...>    Render templates to disk
  pack [id...]      Bulk export plus a manifest.json   --all --category --tag
  verify            Run the full gate suite
  serve [--port n]  Dev server
```

Export options: `--out <dir>` `--format <list>` `--scale <n>` `--state <name>` `--columns <n>` `--padding <n>` `--tile-width <n>` `--tile-height <n>` `--dry-run`

`--dry-run` renders everything and lists what it *would* write without touching the disk — the cheap way to check a 169-asset pack still builds before wiring it into a build step.

### Formats

| `--format` | Output |
|---|---|
| `png` | Packed sprite sheet, one animation state per row |
| `frames` | One PNG per frame |
| `gif` | Animated GIF per state (transparent, looping) |
| `aseprite` | Aseprite JSON array atlas |
| `godot4` | Godot 4 `SpriteFrames` resource (`.tres`) |
| `godot-tileset` | Godot 4 `TileSet` resource |
| `unity` | Unity `.png.meta` with sliced sprite rects |
| `phaser-atlas` | Phaser 3 atlas JSON |
| `phaser-anims` | Phaser 3 animation registration module |
| `love2d` | LÖVE quads + a ready-to-call player |
| `gamemaker` | GameMaker sprite `.yy` |
| `css-anim` | CSS `@keyframes` sprite animation |
| `json` | Plain frame-table JSON for custom engines |

Combine them — `--format png,gif,godot4` renders once and writes all three.

---

## Using it as a library

```js
const R = require('pixelforge/scripts/render');

const doc = R.build('rpg_knight');           // { width, height, states: [...] }
const { png, atlas } = R.sheetPNG(doc, { scale: 4 });
const { bytes } = R.gif(doc, { state: 'walk_side', scale: 2 });

fs.writeFileSync('knight.png', png);
fs.writeFileSync('knight.gif', bytes);
fs.writeFileSync('knight.tres', R.PF.Exporters.run('godot4', atlas).text);
```

In the browser everything hangs off the `PF` global:

```js
PF.Library.list()                 // catalogue
PF.Library.get('rpg_knight')      // one template
PF.Library.instantiate('rpg_knight')  // a live document in the studio
PF.Gif.encode(frames, w, h)       // Uint8Array
PF.Exporters.run('phaser-atlas', atlas)
```

---

## Writing a template

A template is a pure function returning a document. That purity is enforced by the test suite — the same template rendered twice must produce identical bytes.

A pack file exports a suite; `js/library/index.js` registers it.

```js
// js/library/my_pack.js
window.PF = window.PF || {};
PF.MyPack = (() => {
  const { D, cyc, disc } = PF.Rig;          // frame helpers off the shared rig

  // cyc(n, fps, make) builds a LOOPING state: t runs 0..(n-1)/n, so frame n
  // is frame 0 again. Use seq() for one-shots, where t reaches 1 exactly.
  // Both wrap each painter in draw(), which hands you the api and applies the
  // 1px #181425 outline pass afterwards — you never call it yourself.
  const idle = cyc(4, 6, (a, i, t) => {
    const bob = Math.round(Math.sin(t * PF.Rig.TAU));
    a.rect(12, 14 + bob, 19, 25, '#d94f3a');       // body
    a.rect(12, 14 + bob, 19, 15, '#f07a62');       // lit top
    disc(a, 15.5, 11 + bob, 4, '#d9a173', '#f2c095');  // head
    a.px(14, 11 + bob, '#231a14'); a.px(17, 11 + bob, '#231a14');
  });

  const suite = () => ({
    width: 32, height: 32, name: 'My Sprite',
    layers: [{ name: 'body' }],
    states: [D('idle', 6, true, idle)]
  });

  return { suite };
})();
```

```js
// js/library/index.js
add('my_sprite', 'My Sprite', 'Heroes', 'A one-line description.', ['tag'],
    () => PF.MyPack.suite(), { w: 32, h: 32 });
```

### The pixel buffer contract

A sprite is a `Uint32Array(w * h)`, row-major, **ABGR little-endian** (`0xAABBGGRR`). `0` is transparent.

### The drawing API — `PF.Pixel.makeApi(buf, W, H)`

| | |
|---|---|
| `px(x, y, c)` | one pixel |
| `rect(x0, y0, x1, y1, c)` / `rectO(...)` | filled / outlined box (corners are normalised) |
| `line(x0, y0, x1, y1, c, size)` | Bresenham line |
| `ellipse(x0, y0, x1, y1, c, fill)` | ellipse |
| `fill(x, y, c)` | flood fill |
| `hash(x, y, seed)` | deterministic noise, uniform over `[0, 1)` |
| `speck(x0, y0, x1, y1, seed, colors, density)` | deterministic speckle texture |
| `grad` `dith` `blob` `rim` `shadeRect` | volume helpers |

`PF.Pixel.offsetApi(api, ox, oy)` returns a translated view. **It does not clip** — a primitive that runs past a cell boundary paints into the neighbouring tile.

### House rules

These are enforced by `scripts/check-rpg.js`; see [`AGENTS.md`](AGENTS.md) for the full contributor guide.

1. **No `Math.random()` in a template.** Use `api.hash(x, y, seed)` — a template must be reproducible forever.
2. **`build()` is pure.** No shared mutable state, no time, no DOM.
3. **Every frame ends with a 1px `#181425` outline pass.** It is what makes the art read as one style.
4. **Run the pixel-hash diff before and after engine changes** — `node scripts/sprite-hash.js diff`.
5. **Ground contact sits at y = 25..27** on a 32px figure, so characters from different packs stand on the same floor.
6. **Look at the image.** Export a sheet and actually open it. Most art defects are invisible to every numeric gate.

---

## Verification

```sh
npm run verify          # everything
npm test                # unit suite only
npm run gate            # sprite quality gate only
npm run baseline        # accept new pixel output as the baseline
```

`node scripts/verify.js` runs, in order:

| Gate | What it proves |
|---|---|
| syntax | every `.js` file parses |
| `scripts/test.js` | engine maths, file formats, export writers, catalogue hygiene, isometric geometry — 88 assertions |
| `scripts/check-rpg.js` | every frame of every template: silhouette, ground contact, motion between frames, loop closure, palette discipline — 39,165 checks |
| `scripts/sprite-hash.js` | pixel-exact regression against a committed baseline |
| `scripts/check-game.js` | the demo game's data tables match the library |
| `scripts/check-pages.js` | every DOM id a page queries exists, every local asset resolves |
| `scripts/sim-game.js` | boots each demo game headless and drives thousands of frames of synthetic input |

The pixel-regression gate fails on *any* visual change, intentional or not. That is the point: `npm run baseline` is an explicit, reviewable act.

---

## Repository layout

```
bin/pixelforge.js      CLI entry point
js/core/               engine: raster, palette, effects, tiles, gif, zip, exporters,
                       store, renderer, animation, input, io, projects
js/library/            sprite packs (29 files) + pixel.js (draw API) + rig.js (shared
                       humanoid skeleton) + forge.js (seeded character generator)
                       + index.js (the registry)
scripts/               render.js, verify.js, test.js, check-*.js, sheet.js, serve.js
app/ studio.html       editors
games/runefall/        side-on demo game
games/nightfall/       top-down demo game
games/ironvale/        isometric demo game
games/gatehold/        settlement-defence demo game
```

Adding a library file means registering it in **nine** places: `FILES` in `scripts/lib-boot.js`, the `<script>` list in each of the seven HTML pages (`index.html`, `studio.html`, `app/index.html`, `games/runefall/index.html`, `games/nightfall/index.html`, `games/ironvale/index.html`, `games/gatehold/index.html`), and `js/library/index.js`. `scripts/check-pages.js` asserts every `js/library/*.js` entry in `lib-boot.js`'s `FILES` appears in all seven pages, so a missed `<script>` tag fails the gate.

---

## Design notes

**Why no dependencies.** A sprite generated in 2026 should still generate identically in 2036. Every encoder here — PNG, GIF/LZW, ZIP — is a few dozen lines of plain arithmetic in this repo. Nothing to audit, nothing to update, nothing to break.

**Why no build step.** The browser loads the same files the CLI does. What you edit is what runs; what runs is what ships.

**Why one shared rig.** `js/library/rig.js` holds a single 3/4-view humanoid skeleton with idle, walk, hurt and down states. A new character pack supplies a palette and a held prop and inherits animation that already sits on the same ground line and reads at the same weight as every other character in the library.

---

## License

MIT — see [LICENSE](LICENSE).
