# Contributing

The engine has no dependencies, no build step and no image files. That is a
feature, and everything below exists to keep it one.

```bash
node scripts/serve.js        # dev server → http://localhost:5173/
node scripts/verify.js       # THE gate — run this before you claim anything works
```

CI runs the same gate: `ci/verify.yml` (copy it to `.github/workflows/` to let
GitHub Actions pick it up).

## The four hard rules

1. **Determinism.** No `Math.random()`, no `Date.now()`, no locale or timezone
   dependence anywhere in a template. Use `api.hash(x, y, seed)`. The hub
   re-renders thumbnails and the regression harness compares bytes.
2. **`build()` is pure.** It never touches `PF.Store`, the DOM or module state.
   It is called for gallery previews, sometimes many times.
3. **Outline last.** Every frame's final act is the 1px `#181425` outline pass.
4. **No baked shadows.** Sprites stop at the ground rows (y=25..27 on a 32px
   sprite); games draw the shadow per entity so it can scale, tint and fade.

## Adding a template

1. Write the builder in the right `js/library/<pack>.js` and export it from that
   pack's IIFE.
2. Register it in `js/library/index.js` with `add(id, name, category, desc, tags, build, { w, h, featured })`.
   Prefix new pack ids with `pf_` (or `rpg_` for the fantasy line) — the quality
   gate enforces every template under those prefixes strictly.
3. `node scripts/check-rpg.js` — must be 0 fail, **0 warnings**.
4. `node scripts/sheet.js <id> 8` and actually look at the PNG.
5. `node scripts/catalogue.js` to refresh the catalogue, then
   `node scripts/verify.js --update-baseline` if the art is new (new templates
   only ever show as `+ added`, which is fine — re-baseline for *changed* art).

### Geometry

- Sprites: 32×32. Tilesheets: usually 64×64 (4×4 of 16px). 16×16 packs exist
  for handheld-scale games — a 16px sprite has room for a 9px body, so redraw
  rather than scale.
- Figures occupy roughly y=4..27, centred on x=16.
- Headgear has four rows of clearance above the head (y0..3) and **may not paint
  on row 0** — the outline pass cannot close above it, and
  `check-rpg.js` ratchets the number of templates that clip.
- Outline colour is `#181425`.

### Animation

| Action | Frames | fps |
|---|---|---|
| idle | 4 | 4 |
| walk | 6 | 6 |
| run | 6 | 10 |
| attack | 5–6 | 10 |
| cast | 4 | 7 |
| hurt | 2–3 | 7–8 |
| death | 3–4 | 6 (`loop: false`) |

Consecutive frames must differ by **≥ 8 pixels** — fewer reads as a stalled
animation. Two traps:

- `sin(i / n * 2π)` repeats its magnitude on n/2 boundaries, so a 6-frame cycle
  renders frames 1/2 and 4/5 identically. Add a quarter-phase cosine term to a
  second channel (bob, arms, or a per-frame table).
- A rotating shape with N-fold symmetry looks static when the per-frame step is
  a multiple of its symmetry (a 4-blade rotor stepped 90° is identical every
  frame; a 6-point star stepped 60° likewise).

An idle must never move the feet. The house idle is a 4-frame breath at 4fps:
the head settles into the shoulders (`[0,1,1,0]`) and the arms follow half a
beat later (`[0,0,1,1]`), which is what keeps all four frames distinct.

### Text

`PF.Font` is 5x7 (5px glyphs, 6px advance) or 3x5 (3px glyphs, 4px advance).
On a 32px cell that means **five** characters at 5x7 and **eight** at 3x5 — text
that overruns is silently clipped, so `scripts/check-font.js` renders every
string the library draws and fails if any of them overflows its canvas. With
`align: 'center'`, `x` is the **box's left edge** and `boxWidth` is the box.

## Style

Build sprites in a small, consistent palette and let `PF.Style` do the era work.
Do not hard-code a "Game Boy version". If you need a colour that survives
quantisation, pick one that sits distinctly in the palette you are targeting —
`node scripts/forge.js style out/ <id> gameboy` shows you the result.

## Adding a style

`PF.Style.register({ id, name, era, palette, dither, tags })`. Use a real
hardware or carefully chosen mood palette; `check-style.js` will run it against
five sprites and demand exact palette conformance, determinism and no collapse
to a single colour.

## Adding an engine feature

- Keep it additive where you can. New primitives on `PF.Pixel` / `PF.Raster`
  must not change existing output — prove it with
  `node scripts/sprite-hash.js diff scripts/hashes-baseline` (expect
  `0 changed`).
- Anything the browser and Node both need must stay DOM-free (`core/style`,
  `core/atlas`, `core/export`, `core/factory`).
- Performance claims need `node scripts/bench-compare.js` numbers, with the old
  implementation inlined in the same process.
- Add a gate when you add a promise: a new export format belongs in
  `check-export.js`, a new packer rule in `check-atlas.js`, a new module in the
  load order goes in `scripts/lib-boot.js` **and** all four pages (`check-pages`
  now fails if a library file is not tagged).

## Style guide

- Vanilla ES2020+ in IIFEs assigning to `window.PF`. No framework, no bundler,
  no TypeScript, no runtime dependencies.
- 2-space indent, semicolons, single quotes, no trailing commas.
- Dense pixel drawing: related draws on one line, grouped by body part, with a
  comment naming the part (`// legs`, `// torso`, `// head`).
- Comment the *why*, not the *what* — geometry decisions and non-obvious
  ordering ("drawn before the body so the outline cannot fuse it").
- ASCII straight quotes in code; typographic quotes only in prose.

## Committing

- Never commit a failing `verify.js`.
- Do not commit `scripts/out/`, `forge-out/` or `.workbuddy-ai/`.
- `core.autocrlf` must stay `false` — the repo stores LF.
- Do not force-push or rewrite published history.

## Reporting

Include the exact command, the failing output, and — for anything visual — the
`scripts/sheet.js` PNG. Numbers do not catch a seam poking out of a silhouette.
