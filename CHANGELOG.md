# Changelog

All notable changes to PixelForge. Format loosely follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions follow
[semver](https://semver.org/).

## [2.0.0] — 2026-09-19

The release that takes PixelForge from "a browser toy that draws sprites" to a
tool a game team can put in its pipeline. Assets grew by more than half, the
engine picked up the modules a real studio needs, and everything the browser
can do is now also available headless from a command line.

Numbers, before → after:

| | 1.1.0 | 2.0.0 |
|---|---|---|
| Templates | 106 | **169** |
| Animation states | 1,441 | **1,809** |
| Frames | 6,114 | **7,236** |
| Export targets | 0 | **10** |
| Unit assertions | 0 | **88** |

### Added — assets

Nine new packs, 63 new templates, spanning styles far beyond the original
fantasy-RPG scope:

- **Platformer** (`js/library/platformer.js`) — a run-and-jump hero with a full
  move set, slime and spiky enemies, a flyer, pickups, props, a terrain tile
  sheet and a three-layer parallax background.
- **Sci-fi** (`js/library/scifi.js`) — astronaut, marine, engineer, robot,
  drone, turret, a four-state mech, station props and a hull tile sheet.
- **Space shooter** (`js/library/space.js`) — player ship, fighter, bomber, a
  multi-phase boss, asteroids, power-ups, weapon FX and a starfield tile sheet.
- **Modern / urban** (`js/library/modern.js`) — soldier, police officer, medic,
  survivor, zombie, vehicles, street props, items and a city tile sheet.
- **Farm / harvest** (`js/library/farm.js`) — farmer, eight barnyard animals,
  five crops with five growth stages each, buildings, tools, produce and a
  sixteen-tile field sheet. Crop growth stages are *states*, not frames, so a
  game can hold a plot at stage 3 and step it on a tick.
- **Isometric kit** (`js/library/iso.js`) — ground tiles, stackable blocks,
  walls with real openings, stairs and ramps, and ten set-piece props, all
  built from one tile-space projection. The footprint is exactly 256 pixels —
  the determinant of the 2:1 isometric lattice — so a floor laid from these
  tiles has no pinholes and no doubled seams. `scripts/test.js` tiles a field
  and counts the holes rather than trusting the eye.
- **UI kit** (`js/library/ui_kit.js`) — panels, buttons, bars, icons, cursors,
  gamepad/key prompts, dialogue boxes and inventory slots. Every panel is
  authored 9-slice friendly (2px border band, flat centre) so an engine can
  stretch it without smearing the corners.
- **FX** (`js/library/fx2.js`) — explosions, smoke, impacts, elemental bursts,
  auras and beams.
- **Bitmap fonts** (`js/library/fonts.js`) — two hand-authored pixel faces plus
  a runtime text API, so a template can stamp readable labels into a buffer
  without shipping a font file or relying on canvas text (which is not
  pixel-exact across browsers).

### Added — engine

- **`js/library/rig.js`** — a single shared 3/4-view humanoid skeleton with
  idle, walk, hurt and down states, plus the frame helpers (`seq`, `cyc`,
  `still`) every pack now builds on. New character packs supply a palette and a
  held prop and inherit animation that already lands on the same ground line at
  the same visual weight as every other character in the library.
- **`js/core/exporters.js`** — ten engine-native export targets: `godot4`
  (SpriteFrames), `godot-tileset`, `unity` (sliced `.png.meta`),
  `phaser-atlas`, `phaser-anims`, `love2d`, `gamemaker`, `aseprite`,
  `css-anim` and a plain `json` frame table for custom engines.
- **`js/core/palette.js`** — named artist palettes, ramp generation,
  quantisation with optional ordered dithering, recolouring, extraction from a
  buffer, and import/export of `.gpl`, hex `.txt` and JASC `.pal`.
- **`js/core/effects.js`** — non-destructive pixel effects. Each takes
  `(buf, w, h, opts)` and returns a *new* buffer, so effects chain freely and
  nothing touches the document until the caller commits.
- **`js/core/tiles.js`** — sheet slicing, the 47-tile blob autotile lookup,
  16-tile 4-bit edge autotiling, seamless-wrap checking and a Tiled
  `.tsx`/`.tmx` writer.
- **`js/core/gen.js`** — seeded procedural generation: a deterministic RNG and
  value noise, so "give me 12 variants of this goblin" yields the *same* twelve
  every time from the same seed, and a variant you liked is reproducible from
  its seed alone without storing pixels.
- **`js/core/zip.js`** — store-only ZIP writer for export bundles. Produces a
  `Uint8Array` that both `new Blob([...])` and `fs.writeFileSync` accept.
- **`js/core/gif.js`** — the GIF89a/LZW encoder, lifted out of `io.js` so it
  has no DOM and no `Blob` dependency and the headless CLI can reuse it
  unchanged. Verified pixel-exact through a round-trip decode of every frame.

### Added — tooling

- **`bin/pixelforge.js`** — a zero-dependency CLI. `list`, `info`, `export`,
  `pack`, `verify`, `serve`, with `--format`, `--scale`, `--state`,
  `--columns`, `--padding`, `--out`. Formats are additive: `--format
  png,gif,godot4` renders once and writes all three. `pack` emits a
  `manifest.json` and survives a failing template rather than abandoning a
  160-asset export half-written.
- **`scripts/render.js`** — the headless renderer behind the CLI, usable on its
  own: `build`, `sheet`, `sheetPNG`, `gif`, `info`, `framePixels`. Produces the
  exact atlas shape `PF.Exporters` consumes. Upscaling is nearest-neighbour
  only, deliberately — pixel art resampled with interpolation stops being pixel
  art.
- **`scripts/test.js`** — 88 unit assertions covering engine maths, hash
  uniformity, speckle density, GIF structure, the export writers and catalogue
  hygiene. Wired into `scripts/verify.js` as a gate.
- `npm run cli`, `npm run info`, and `npm run baseline` now runs the full
  verify with `--update-baseline` so accepting new pixel output stays an
  explicit, reviewable act.
- `README.md`, `LICENSE` (MIT) and this changelog.
- GitHub Actions CI running the full gate suite on every push and PR.

### Fixed

- **`api.hash` could never return a value above 0.5.** The final mix step used
  an *arithmetic* right shift (`h >> 16`), which smears the sign bit across the
  top half of the word, so bit 31 of the result was always zero. Every
  consumer inherited the bias: speckle ran at twice its stated density, a
  two-colour `speck` never picked its second colour, `(hash - 0.5) * spread`
  only ever scattered in one direction, and positional `Math.floor(hash * n)`
  covered only the lower half of its range — which is why grass tufts and hay
  straws clumped into one corner of their tiles. The mix now uses unsigned
  shifts throughout and now measures uniform: mean 0.5010, with every decile
  of the distribution within a third of a percent of even.
- **Speckle densities rescaled library-wide** to match the corrected hash.
  Every `speck()` call site and both defaults were doubled, so 164 templates
  keep the density they were visually tuned at.
- **Non-finite coordinates froze the studio.** `NaN` or `Infinity` passed to
  `line`, `rect` or `ellipse` made the Bresenham error term stop comparing, so
  neither the step conditions nor the end test ever fired — an infinite loop on
  the main thread. Every loop-driven primitive now rejects non-finite input up
  front.
- **GIF disposal method** changed from 1 (leave previous frame) to 2 (restore
  to background). Disposal 1 smeared any sprite whose silhouette shrank between
  frames.
- **Twenty-seven catalogue descriptions advertised stale counts** — `rpg_knight`
  still claimed "15 states / 67 frames" long after it had grown to 24 and 113.
  All corrected, and a test now asserts every quoted count against what the
  template actually builds.
- **Colliding export filenames.** Three targets emit `.json` and two emit
  `.tres`, so `--format phaser-atlas,aseprite` had one silently overwrite the
  other. The CLI now folds the target id into the name, but only when the run
  requests a colliding pair — Unity's meta file must stay exactly
  `<image>.png.meta` or Unity ignores it.
- **`--format frames` was ambiguous**, meaning both "one PNG per frame" and the
  frame-table JSON target. The export target is now `json`.
- **`npm test` no longer aliases `npm run verify`** — it runs the unit suite, so
  a fast check is actually fast.

### Fixed — art

A full visual pass over the farm pack, per the house rule that every visual
change must be exported and *looked at*. None of these were visible to any
numeric gate:

- Silo read as an office block — 3px ribs crossed by a dark row every 5 lines
  drew a grid of window panes. Rebuilt with fine corrugation, barrel shading
  and two hoop bands.
- Windmill read first as a pinwheel on a post, then as scattered bone
  fragments — 1px spars break up at diagonals. Rebuilt with a taller tapered
  tower and solid four-pixel-wide sails.
- Coop ramp read as a brace across the doorway; the coop now stands on legs so
  the ramp has somewhere to descend to.
- Scarecrow head read as a wire mesh screen — cross-stitch eyes plus a dotted
  mouth put nine scattered dark pixels on one face. Now two solid button eyes
  and one stitched grin.
- Haystack read as a heap of sand; watering can and milk pail had a black
  scorch mark floating above them (1px handles in the darkest grey merged with
  the outline pass); shears read as a coat hanger; axe as a pennant on a stick;
  hoe as a putty knife; wheat sheaf as a trophy, then as a crown; egg as a bulb
  of garlic standing on its point; pumpkin as a lens. All redrawn.

### Changed

- `package.json` is no longer `private`, declares a `bin`, a `files` allowlist
  and repository metadata, and is publishable.
- `js/core/io.js` keeps only the Blob wrapper; the GIF bytes come from
  `PF.Gif`.
- The template count and category breakdown in the demo game's data tables are
  checked against the library by `scripts/check-game.js`.

### Migration from 1.x

- **Every sprite's pixels changed** where a `speck()` was involved, because the
  hash bias is gone. If you have committed baseline hashes, regenerate them
  with `npm run baseline`.
- `npm test` now runs the unit suite only. Use `npm run verify` for the full
  gate suite (that is what CI runs).
- If you call `PF.Gif`/`encodeGIF` directly, note it now returns a
  `Uint8Array`; `PF.IO` still hands back a `Blob`.

## [1.1.0]

- 17 asset packs: classes, beasts, traps, furniture, weather.
- Engine hot paths optimised; animation suites expanded; dev tooling added.
- Baked shadows stripped, idles and capes rebuilt, every pack retimed.

## [1.0.0]

- Initial release: browser pixel-art studio with a procedural RPG asset
  library.
