# Architecture

PixelForge is three browser entry points and one engine, plus a Node toolchain
that loads the same engine headlessly.

```
index.html            landing hub
studio.html           the pixel-art editor
app/index.html        workspace shell: projects, template gallery, agent, docs, MCP
games/runefall/       playable demo that consumes the library as a game would
```

## Boot and load order

Everything hangs off `window.PF`. Modules are IIFEs that assign onto it and
resolve each other **lazily** (inside function bodies), so declaration order is
not strict. The conventional order is:

```
core/store → core/raster → core/style → core/atlas → core/export
→ core/renderer → core/input → core/animation → core/io → core/projects
→ library/pixel → library/font → library/autotile → library/<rigs> → library/<packs>
→ library/index → core/factory → agent/* → ui/*
```

The single source of truth for the order is `scripts/lib-boot.js` (`FILES`).
**If you add a library file, add it there and to the `<script>` list of all four
HTML pages.** `scripts/check-pages.js` verifies that listed paths exist; it
cannot guess a tag you forgot, so `scripts/check-docs.js` and the page gate are
your safety net.

`scripts/lib-boot.js` loads a subset (`raster` + `style` + `atlas` + `export` +
the whole library + `factory`) into a fake `window`, which is why the gates can
render every sprite, restyle it, pack an atlas and serialize a Godot resource
without a browser.

## The pixel buffer contract

The most important thing to internalise:

- a sprite is a `Uint32Array` of `width * height`, row-major
- each element is **ABGR little-endian** (`0xAABBGGRR`) — exactly the byte order
  of `ImageData.data` on little-endian machines, so a `Uint32Array` view over an
  `ImageData` buffer can be written directly
- `0` means fully transparent
- colours are built with `PF.Color.fromRGBA` / `hexToU32` and read with
  `u32ToHex`

## The draw API

`PF.Pixel.makeApi(buf, W, H)` returns a prototype-based `Api` — no per-call
closures, no per-pixel option-object allocations (the option objects handed to
`Raster` are shared), and `px` inlines its own bounds test because every
primitive funnels through it.

`PF.Pixel.offsetApi(api, ox, oy)` returns a translated view on the prototype
chain; tilesheet painters use it to draw 16px tiles onto a 64px sheet. Never use
`{ ...api }`: it drops every prototype method.

## Template contract

A template is registered in `js/library/index.js`:

```js
add(id, name, category, desc, tags, build, { w, h, featured })
```

`build()` returns `{ width, height, name, layers, states }` where each state is
`{ name, fps, loop, frames: [{ duration, paint }] }`. Rules:

- `build()` must be **pure** — no `PF.Store`, no DOM, no module-level mutable state
- frames are rendered into **fresh zeroed buffers**; no continuity between frames
- no `Math.random()`, no `Date.now()` — use `api.hash(x, y, seed)`
- every frame's final act is the 1px `#181425` outline pass
- sprites carry **no baked shadow**; games draw it (see `PF.Pixel.shadowFlat`)

`PF.Library` memoises `docStats()` and thumbnails, so `build()` is called once
per template per session for gallery/stats work.

## Render and edit pipeline

`PF.Store` holds one open document: layers, states, frames, palette, active
indices, with per-layer `Uint32Array`s inside each frame. Mutations go through
`transact(fn)` (snapshot for undo) or `beginStroke()`/`endStroke()` for pixel
edits. Events: `doc`, `change`, `active`, `render`, `tool`, `view`, `color`,
`play`, `history`.

`PF.Renderer` composites visible layers into an offscreen `ImageData`, blits it
scaled with smoothing disabled, then overlays grid / onion skin / selection.
`draw()` only runs when `dirty`.

## The gates (what "done" means)

`node scripts/verify.js` runs, in order:

| Step | Script | Passing means |
|---|---|---|
| Syntax | `node --check` on every `.js` | everything parses |
| Sprite quality | `check-rpg.js` | 0 fail, 0 warnings: painter shape, non-empty frames, ≥8px frame delta, loop closure, ground contact, row-0 clipping ratchet |
| Style engine | `check-style.js` | exact palettes, determinism, alpha preserved, no collapse, `docOf` purity |
| Atlas packer | `check-atlas.js` | no overlap, no loss, deterministic, every manifest lists every frame |
| Export formats | `check-export.js` | RLE round-trips, C header tables agree, TSX math, BMFont counts, store adapter |
| Pixel regression | `sprite-hash.js diff` | `0 changed, 0 removed` unless the change was intended |
| Game wiring | `check-game.js` | every sprite id / state name / DOM id the demo names resolves |
| Page integrity | `check-pages.js` | every asset path exists, every `$('#id')` has markup |
| Docs | `check-docs.js` | every documented command and link resolves; quoted counts match the registry |
| Catalogue | `catalogue.js --check` | `docs/asset-catalogue.md` is regenerated |

`scripts/hashes-baseline/` is the regression oracle — an index plus shards of 48
templates, so each piece stays small enough to write with ordinary tooling. The
loader verifies the shard count before it trusts the baseline. Re-baseline only
for *intended* visual changes, and say so in the commit.

## Performance rules

- reuse buffers; `fill(0)` rather than allocate
- hoist row offsets (`row = y * w`) out of inner loops
- inline neighbour/bounds tests in per-pixel loops
- memoise anything derived from a document (`docStats`, thumbnails, colour parsing)
- never allocate an object or closure per pixel, per frame or per draw call
- stop `requestAnimationFrame` loops when their view is not visible

Prove perf claims with `node scripts/bench-compare.js`, which runs the original
implementations and the current ones **in the same process** (best-of-N with a
warm-up, never across processes).

## Agent surface

`js/agent/tools.js` is the core tool registry; `studio-tools.js` adds the hub and
forge tools. The same registry feeds the console, `window.PixelForge`,
`postMessage` and `PF.MCP.manifest()`. `js/agent/harness.js` drives a text
tool-call protocol over `PF.Nebians` sessions; `js/agent/agent.js` is the console
UI and local recipe fallback.
