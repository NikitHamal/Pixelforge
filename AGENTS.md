# AGENTS.md

Guidance for AI coding agents working in this repository. Read this before
editing anything — the rules in **§5 Non-negotiable invariants** are load-bearing
and violating them produces silent, hard-to-see breakage.

---

## 0. TL;DR

**PixelForge** is a browser pixel-art studio plus a procedural game-asset engine.
It has **zero dependencies, no build step, and no image assets** — every sprite
is drawn at runtime by deterministic JavaScript maths.

```bash
node scripts/serve.js          # dev server -> http://localhost:5173/
node scripts/verify.js         # THE gate. Run before claiming anything works.
```

| Task | Command |
|---|---|
| Verify everything (do this before finishing) | `node scripts/verify.js` |
| Sprite quality gate | `node scripts/check-rpg.js` |
| Prove a refactor changed no pixels | `node scripts/sprite-hash.js diff scripts/hashes-baseline.json` |
| Re-baseline after an *intended* visual change | `node scripts/verify.js --update-baseline` |
| Look at a sprite sheet | `node scripts/sheet.js rpg_knight 6 run` → `scripts/out/` |
| Contact sheet of every template | `node scripts/sheet.js --all 3` |
| Before/after perf comparison | `node scripts/bench-compare.js` |
| Check game/page reference integrity | `node scripts/check-game.js`, `node scripts/check-pages.js` |

**The five hard rules:**

1. **Never use `Math.random()` in a template.** Use `api.hash(x, y, seed)`.
2. **`template.build()` must be pure** — no `PF.Store` access, no DOM, no globals.
3. **Every frame ends with a 1px outline pass** in `#181425`.
4. **Run `sprite-hash.js diff` before and after any engine change.** A pure
   optimisation must report `0 changed`.
5. **Ground contact sits at y=25..27 and shadows at groundY=29.** Never let them
   touch, or the outline pass fuses the feet into the shadow.

---

## 1. What this project is

Three browser entry points sharing one engine:

| Page | Role |
|---|---|
| `index.html` | Marketing/landing hub |
| `studio.html` | The pixel-art editor (canvas, timeline, tools, agent console) |
| `app/index.html` | Workspace shell — projects, template gallery, agent cockpit, docs, MCP |

Plus `games/runefall/` — a playable survivors-like that consumes the asset
library and doubles as an integration test for it.

The interesting part is `js/library/`: ~67 template packs producing ~1,700
animation frames, all generated from code.

---

## 2. Commands

```bash
# Development
node scripts/serve.js [port]        # static server (default 5173). Use http, not file://

# Verification — see §9
node scripts/verify.js              # syntax + quality + pixel regression + refs
node scripts/verify.js --update-baseline
node scripts/check-rpg.js           # canonical sprite quality gate
node scripts/sprite-hash.js save scripts/hashes-baseline.json
node scripts/sprite-hash.js diff scripts/hashes-baseline.json

# Visual QA (no browser required)
node scripts/sheet.js <templateId> [scale] [stateFilter]
node scripts/sheet.js rpg_spider 14 idle
node scripts/sheet.js --all 3

# Performance
node scripts/bench-compare.js       # old vs new hot paths, same process
node scripts/bench.js [label]       # microbenchmarks
```

There is **no `npm install`** — `dependencies` is intentionally empty. Do not add
runtime dependencies; the "no dependencies" property is a feature, and the whole
engine is designed to run from a static file server with no toolchain.

Node ≥ 18 is required for the dev scripts (they use `??`, `?.`, `Object.fromEntries`).
The browser code targets evergreen browsers.

---

## 3. Repository map

```
index.html               landing hub
studio.html              the editor
app/index.html           workspace shell
app/app.js               shell logic: routing, projects, template gallery, agent
app/app.css              shell styles

css/tokens.css           design tokens (CSS custom properties, light + dark)
css/base.css             reset + primitives
css/studio.css           editor chrome

js/core/raster.js        PF.Color (u32 colour) + PF.Raster (pixel algorithms)
js/core/store.js         PF.Store — document model, undo/redo, events, serialization
js/core/renderer.js      PF.Renderer — canvas compositing, zoom/pan, grid, onion skin
js/core/input.js         PF.Input — pointer tools, selection, clipboard, symmetry
js/core/animation.js     PF.Anim — playback engine, state presets, live preview
js/core/io.js            PF.IO — PNG / GIF / spritesheet export + import
js/core/projects.js      PF.Projects — localStorage project persistence

js/library/pixel.js      PF.Pixel — the draw API every template uses + weapon/FX primitives
js/library/characters.js PF.Chars — the humanoid rig + hero/monster/wizard suites
js/library/monsters.js   creature packs
js/library/world.js      tilesets, flora, props
js/library/items.js      gear, consumables, FX
js/library/rpg_heroes.js PF.RPG — shared class rig (knight/ranger/cleric/rogue/townsfolk)
js/library/rpg_foes.js   PF.RPG.foes — custom-rig foes (dragon, spider family, mimic, …)
js/library/rpg_world.js  dungeon/village tilesets and props
js/library/rpg_items.js  armoury, loot, status icons, magic, UI chrome
js/library/rpg_expand.js paladin/druid/lich/ogre, campsite, trinkets, battle magic 3
js/library/index.js      PF.Library — THE template registry

js/agent/*               in-browser agent tool surface (tools, studio-tools, agent, mcp)
js/ui/*                  page boot scripts (landing, studio, panels)

games/runefall/          demo game consuming the library
scripts/                 dev tooling (see §2) — all Node, all dependency-free
```

---

## 4. Architecture

### 4.1 Boot and load order

Everything hangs off a single global namespace, `window.PF`. Modules are IIFEs
that assign onto it and resolve each other **lazily** (inside function bodies),
so declaration order is not strict — but the conventional order is:

```
core/store → core/raster → core/renderer → core/input → core/animation
→ core/io → core/projects → library/* (pixel → characters → packs → index)
→ agent/* → ui/*
```

`scripts/lib-boot.js` loads a subset (`raster` + `library/*`) headlessly into a
fake `window` so the whole asset pipeline runs in plain Node. **If you add a
library file, add it to `FILES` in `scripts/lib-boot.js` and to the `<script>`
list in all four HTML pages** (`index.html`, `studio.html`, `app/index.html`,
`games/runefall/index.html`). `check-pages.js` will not catch a missing script
tag for you — it only checks that listed paths exist.

### 4.2 The pixel buffer contract

This is the single most important thing to internalise.

- A sprite is a `Uint32Array` of `width * height`, row-major.
- Each element is **ABGR little-endian**: `0xAABBGGRR`, which is exactly the
  byte order of `ImageData.data` on little-endian machines. So a `Uint32Array`
  view over an `ImageData` buffer can be written directly.
- `0` means fully transparent.
- Build colours with `PF.Color.fromRGBA(r, g, b, a)` /
  `PF.Color.hexToU32('#rrggbb')`, read them back with `PF.Color.u32ToHex(v)`.
- `hexToU32` is memoised behind a bounded `Map`. It is called once per pixel per
  draw, so **never** re-implement colour parsing locally.

### 4.3 The draw API

`PF.Pixel.makeApi(buf, W, H)` returns an `Api` (prototype-based, so it does not
allocate closures). Every template painter receives one:

```js
api.px(x, y, color)                       // 1 pixel
api.rect(x0, y0, x1, y1, color)           // filled rect (inclusive bounds)
api.rectO(x0, y0, x1, y1, color, size)    // outlined rect
api.line(x0, y0, x1, y1, color, size)     // Bresenham
api.ellipse(x0, y0, x1, y1, color, fill)  // midpoint ellipse
api.fill(x, y, color)                     // flood fill
api.shadeRect(x0, y0, x1, y1, amt)        // lighten/darken a region
api.hash(x, y, seed)                      // deterministic 0..1 pseudo-random
```

All coordinates are rounded and bounds-checked internally — you can draw
off-canvas safely.

For tilesheets, `PF.Pixel.offsetApi(api, ox, oy)` returns a coordinate-translated
view that inherits every method it does not override. Prefer it over object
spread: **`{ ...api }` silently drops every prototype method.**

### 4.4 The template contract

A template is registered in `js/library/index.js` and looks like:

```js
add(id, name, category, desc, tags, build, { w, h, featured })
```

`build()` returns a `DocData`:

```js
{
  width: 32, height: 32,
  name: 'rpg-knight',
  layers: [{ name: 'Body' }],
  states: [
    { name: 'idle_down', fps: 6, loop: true,
      frames: [ { duration: 167, paint: (buf, W, H) => { /* draw */ } } ] }
  ]
}
```

Rules:

- **`build()` must be pure.** It is called to render hub thumbnails and gallery
  previews, sometimes many times, and must never touch `PF.Store`, the DOM, or
  module-level mutable state. The registry memoises `docStats()`, but `build()`
  itself is expected to be cheap and side-effect free.
- Frames use `paint` (single-layer) or `layers[]` (multi-layer). The library is
  single-layer everywhere.
- `duration` is milliseconds per frame; `fps` is metadata used by the runtime.
- Every painter is called with a **fresh zeroed buffer**; do not assume
  continuity between frames.

### 4.5 The registry

`PF.Library` (`js/library/index.js`) is the single source of truth:

- `list()` / `get(id)` — all templates / one by id
- `categories()` — `All, Featured, Heroes, Enemies, NPCs, Animals, World, Items, FX, UI`
- `docStats(id)` — memoised `{ states, frames, width, height, stateNames }`
- `thumbnail(id, scale)` — cached data URL
- `instantiate(id)` — load a template as a new editable project
- `registerPack(fn)` — external packs loaded after `index.js`

### 4.6 Editor state

`PF.Store` holds one open document: layers, states, frames, palette, active
indices. Pixels are per-layer `Uint32Array`s inside each frame. Mutations go
through `transact(fn)` (which snapshots for undo) or `beginStroke()` /
`endStroke()` for pixel edits. `PF.Store.on(event, fn)` subscribes to
`doc`, `change`, `active`, `render`, `tool`, `view`, `color`, `play`, `history`.

### 4.7 Render pipeline

`PF.Renderer` composites visible layers into an offscreen `ImageData`, blits it
scaled with smoothing disabled, then overlays grid / onion skin / selection.
`draw()` only runs when `dirty`. Anything per-frame must be cached — see §7.

---

## 5. Non-negotiable invariants

These are enforced by `scripts/check-rpg.js`. Breaking them fails the gate.

| # | Invariant | Why |
|---|---|---|
| 1 | **Determinism.** No `Math.random()`, no `Date.now()`, no locale/timezone dependence in templates. | The hub re-renders thumbnails and the pixel-regression harness depends on byte-stable output. Use `api.hash(x, y, seed)`. |
| 2 | **`build()` is pure.** | Gallery/hub rendering must not mutate the open project. |
| 3 | **Outline last.** Every frame's final act is a 1px `#181425` outline pass. | The house art style. Interiors are drawn first, outline traces the silhouette. |
| 4 | **Ground contact at y=25..27, shadow at groundY=29.** | A clear row must separate feet from shadow or the outline pass fuses them into a blob. |
| 5 | **Frames must differ.** Consecutive frames in a looping state must differ by ≥8 pixels. | Catches stalled animations. See §6.3 for the classic trap. |
| 6 | **No new runtime dependencies.** | The project runs from a static server with no toolchain. |
| 7 | **Never touch `scripts/hashes-baseline.json` to make a test pass.** | It is the regression oracle. Re-baseline only for *intended* visual changes, and say so. |

---

## 6. Sprite conventions

### 6.1 Geometry

- Sprites: **32×32**. Tilesheets: **64×64** (4×4 grid of 16px tiles).
- Characters occupy roughly y=4..27, centred on x=16.
- Shadow: `PF.Pixel.shadowFlat(api, cx, 29, halfWidth)`.
- Outline colour: `#181425` (`OUT` in most packs).
- Palettes are 32-colour and come from `PF.Store.DEFAULT_PALETTE`.

### 6.2 The humanoid rig

`PF.Chars.drawHumanoid(api, buf, W, H, cfg)` is the shared character renderer.
`cfg` carries `pal` (palette), `facing` (`down`/`up`/`side`), `bob`, `kb`
(knockback x), limb offsets (`legA/legB/armL/armR` for front-back,
`legF/legB/armF/armB` for side), `eye`, `mouth`, `tool`, `flash`, `lying`.

`PF.RPG.humanoidSuite(pal, label, options)` wraps it into a full animation suite.
Options: `weapon`, `shield`, `cast`, `sneak`, `garb` (cape/wings/tail), `head`
(headgear), `post`. Every RPG hero, villain and townsfolk routes through this —
**prefer extending `humanoidSuite` over writing a new rig.**

`PF.Chars.frontPose(i, n, amp, pal, facing, extra)` and
`PF.Chars.sidePose(i, n, amp, pal, extra)` derive limb offsets from a sine phase.
Pass `extra.bob` to override the vertical bob.

### 6.3 Gait cycles — the sine trap

`sin(i / n * 2π)` **repeats its magnitude on n/2 boundaries**. For a 6-frame
cycle, frames 1 and 2 are identical and so are 4 and 5 — the animation visibly
stalls, and the quality gate fails with `static frame (diff 0)`.

Fix: add a quarter-phase cosine term to a secondary channel so every frame has a
distinct value. The run cycles in `rpg_heroes.js` do this:

```js
const a = (i / 6) * Math.PI * 2;
const bob = Math.round(-Math.abs(Math.sin(a)) * 2 - Math.cos(a)); // 6 distinct heights
```

Note the gate only compares *consecutive* frames, so a 4-frame cycle can hide
identical frames 0 and 2. Check first-vs-last yourself when authoring a new cycle.

### 6.4 Animation state naming

Consumers drive states by name, so keep the vocabulary consistent:

- Locomotion: `idle_down|side|up`, `walk_down|side|up`, `run_down|side|up`
- Combat: `attack_side`, `attack_down`, `attack_up`, `bow_side`, `cast`, `cast_side`, `block`
- Reaction: `hurt`, `death` (`loop: false`), plus pack-specific states

`games/runefall/js/game.js` composes `'walk_' + facing` at runtime. If a state is
missing, `RF.Sprites.frames()` silently falls back to the **first** state — no
error, just the wrong animation. `scripts/check-game.js` exists to catch exactly
this; keep it passing.

---

## 7. Performance rules

This is a real-time pixel engine: the renderer redraws on every edit and the
preview redraws every animation tick. The hot path is `Raster` → `Pixel.Api` →
template painters, plus `Renderer.draw()`.

**Do:**

- Reuse buffers. Allocate `Uint32Array`s once and `fill(0)` them, keyed by size.
- Cache anything derived from a document: `PF.Library.docStats` is memoised for
  this reason.
- Hoist row offsets (`row = y * w`, `up = row - w`) out of inner loops.
- Inline neighbour/bounds tests in per-pixel loops — a function call per pixel is
  the dominant cost.
- Cache canvas patterns. `ctx.createPattern()` inside `draw()` is expensive.
- Memoise colour parsing; `PF.Color.hexToU32` already does.

**Don't:**

- Don't allocate an object or array per pixel, per frame, or per draw call.
- Don't rebuild a document just to count its frames.
- Don't create closures per frame paint — that is why `Api` is prototype-based.
- Don't run a `requestAnimationFrame` loop when its view is not visible; stop and
  restart it (see the template gallery loop in `app/app.js`).

When you change a hot path, prove it with `node scripts/bench-compare.js` —
inline the old implementation and compare in the same process, best-of-N with a
warm-up. Never compare across processes or sessions.

---

## 8. Recipes

### Add a new template

1. Write the builder in the appropriate `js/library/*.js` pack, returning
   `{ width, height, name, layers, states }`.
2. Export it from that pack's IIFE return object.
3. Register it in `js/library/index.js` with `add(id, name, category, desc, tags, build, { w, h })`.
4. `node scripts/check-rpg.js` — must be 0 fail.
5. `node scripts/sheet.js <id> 8` and **look at the PNG**. Then
   `node scripts/verify.js --update-baseline` if the art is new/intended.

### Add an animation state to an existing suite

Add an entry to `states` following the shape in §4.4. Reuse the pose helpers.
Verify with `node scripts/sheet.js <id> 6 <stateName>` and check the frames are
visibly distinct — not just that the gate passes (§6.3).

### Add a new playable class

Use `PF.RPG.humanoidSuite` with a new palette and options rather than a new rig:

```js
const BARD = { ...BASE, shirt: '#b55088', /* … */ };
function bardSuite() {
  return PF.RPG.humanoidSuite(BARD, 'rpg-bard', {
    weapon: 'sword',
    head: { hood: '#265c42' },
    garb: { cape: '#68386c', capeSh: '#3e2347' },
    cast: true, castColors: ['#b55088', '#ffffff']
  });
}
```

### Add a new weapon or tool

Add a primitive to `js/library/pixel.js` (e.g. `PF.Pixel.bowFront`) and wire it
into `PF.Chars.drawTool` for both the side branch and the front/back branch.
Tools are drawn *after* the body and *before* the outline pass.

### Wire a new asset into the demo game

1. Add an entry to `CLASSES` or `FOES` in `games/runefall/js/game.js` with a
   `spr` matching the registry id.
2. If it is a boss, add it to `BOSS_ORDER`, `BOSS_TIMES`, `BOSS_LINES`,
   `bossName()` **and** add a branch to `bossAI()` — there is no generic fallback.
3. `node scripts/check-game.js` — 0 fail.

---

## 9. Verification — what "done" means

```bash
node scripts/verify.js
```

Runs, in order:

| Step | Script | Passing means |
|---|---|---|
| Syntax | `node --check` on every `.js` | Everything parses |
| Sprite quality | `scripts/check-rpg.js` | **0 fail**, warnings only for `LEGACY *` packs |
| Pixel regression | `scripts/sprite-hash.js diff` | `0 changed, 0 removed` unless the change was intended |
| Game wiring | `scripts/check-game.js` | Every sprite id, state name and DOM id the game names resolves |
| Page integrity | `scripts/check-pages.js` | Every asset path resolves; every `$('#id')` has markup |

**A change is not done until `verify.js` prints `ALL GATES PASSED`.**

Additionally:

- For any **visual** change, export a sheet (`scripts/sheet.js`) and actually look
  at the image. Numbers do not catch a seam poking out of a silhouette.
- For any **engine** change, the pixel diff must report `0 changed`. If it does
  not, either you broke something or you made an intended art change — decide
  which, and if intended, say so explicitly and re-baseline.
- For any **performance** claim, quote `bench-compare.js` numbers.

### The pixel-regression harness

`scripts/sprite-hash.js` renders every template → state → frame into a fresh
buffer and stores `fnv1a-hash:opaquePixelCount:lowestRow`. `diff` compares against
a saved baseline and exits non-zero on any change or removal. New states and
templates show as `+` and are fine.

`scripts/hashes-baseline.json` is the current known-good oracle.
`scripts/hashes-pre-optimisation.json` is the pre-2026-09-17 snapshot, kept for
the record.

---

## 10. Known issues and gotchas

- **No browser automation.** `agent-browser` does not support Windows, and there
  is no Playwright dependency. Visual QA is done by exporting PNGs with
  `scripts/sheet.js` and reading the image. Do not try to add a browser driver.
- **`file://` is unreliable.** The studio reads `?project=` query params and
  writes `localStorage`; serve over http (`scripts/serve.js`).
- **`{ ...api }` drops prototype methods.** `PF.Pixel`'s `Api` is prototype-based.
  Use `PF.Pixel.offsetApi(api, ox, oy)` for translated views.
- **`frameToCanvas(frame, 1)` with no target returns a shared scratch canvas.**
  Consume it synchronously; do not retain it.
- **`core.autocrlf` must stay `false`.** The repo stores LF. Turning it on
  rewrites the whole tree and buries real diffs in line-ending churn.
- **`monsterSuite` vs `humanoidSuite`.** `monsterSuite` produces the full six
  facings; `heroSuite` produces a much larger action set. Pick deliberately.
- **Legacy warnings are expected.** `scripts/check-rpg.js` reports `LEGACY *`
  warnings for packs that predate the gate (drake, wolf, boar, chicken, torch,
  spells). These are known and should not be "fixed" opportunistically — they
  would change shipped pixels.

---

## 11. Style

- Vanilla ES2020+ modules in IIFEs assigning to `window.PF`. No framework, no
  bundler, no TypeScript.
- 2-space indent, semicolons, single quotes, trailing commas omitted.
- Keep the pixel-drawing style dense: related draws on one line, grouped by body
  part, with a comment naming the part (`// legs`, `// torso`, `// head`).
- Comment the *why*, not the *what*. Explain geometry decisions and any
  non-obvious ordering (e.g. "drawn before the body so the outline cannot fuse it").
- ASCII straight quotes in code and config; typographic quotes only in prose.
- Node dev scripts use CommonJS `require`.

---

## 12. Committing

The repository history lives on `main` and tracks
`origin` (`https://github.com/NikitHamal/PixelForge.git`).

- Commit working, verified changes. Do not commit a failing `verify.js`.
- Do not commit `scripts/out/` or `.workbuddy-ai/` — both are gitignored.
- Do not force-push or rewrite published history.
