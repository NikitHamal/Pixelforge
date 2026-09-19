# Changelog

All notable changes to PixelForge. Format loosely follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions follow
[semver](https://semver.org/).

## [2.2.0] — 2026-09-20

A fourth demo game, and the overhead sprite pack it needed. Every other
building pack in the library is drawn in front elevation, which is the one
thing a top-down settlement game cannot use.

### Added — the Hold pack

- `js/library/hold.js` — eight templates drawn from directly above: a 16-tile
  terrain sheet, two 16-piece connection-mask autotile sheets (split-stake
  palisade and coursed rampart), six dwellings, eight workplaces, six
  fortifications, eight resource nodes and a four-stage construction site.
  Registered under **World**, so the ground-contact and edge-clip rules that
  govern character art do not apply to a roof seen from the sky.
- The autotile sheets resolve a coverage mask per cell before shading, so a
  run of wall reads as one continuous barrier instead of a line of crates —
  shading by silhouette edge is what makes a 4-bit mask look like carpentry.

### Added — Hearthhold

- `games/hearthhold/` — a top-down settlement builder with a defence layer.
  Fell timber and quarry stone by day, raise dwellings, workshops, fields,
  walls, gates, towers and a barracks, then hold the valley after dark. Twelve
  days and eleven nights to win; losing the hall, or everyone in it, ends it.
- Villagers are a flat list driven by a one-step decision function: they take
  the workplace that needs them most, gather outward from their own lodge,
  haul to the nearest store, sleep in whatever bed you built them, and run
  from raiders rather than stand and be cut down.
- Raiders route with walls priced rather than blocked, so a warband prefers an
  open gate, then the long way round, then the thinnest stretch of palisade —
  which is the priority order a besieger actually has.
- Three difficulties, a day/night cycle with punched-out torchlight, weather,
  crop growth, construction sites, autotiled walls with shut/open/auto gates,
  a build palette, an inspector, and 1x/2x/3x speed.
- `scripts/sim-game.js` now drives Hearthhold too: it picks the hardest
  difficulty, winds the clock to 3x and asserts the population readout falls —
  a number only a running villager tick can move.

## [2.1.0] — 2026-09-19

A quality pass over the drawing and the animation, two new asset domains, two
new demo games, and a generator that makes the library's size stop being the
ceiling.

| | 2.0.0 | 2.1.0 |
|---|---|---|
| Templates | 169 | **190** |
| Animation states | 1,809 | **2,031** |
| Frames | 7,236 | **8,422** |
| Demo games | 1 | **3** |
| Sprite checks | 33,819 | **39,165** |

### Added — The Forge

- `js/library/forge.js` — a seeded parametric character generator. A seed
  resolves to a kin, a role, headgear, a weapon, armour, a cloak and a full
  palette; the result dresses the shared rig and comes back as six animated
  states (idle, walk, run, a weapon-appropriate attack, hurt, death). 7,280
  distinct silhouette-and-kit combinations before palette. Twelve headgear
  painters, twelve weapons, five attack choreographies (swing, thrust, cast,
  shoot, punch), thirteen complexions across six kin.
- **Forge panel** on the Templates view of `app/index.html`: pick a role,
  headgear and weapon, type a seed or roll one, and twelve animated candidates
  appear. Click one to open its six states in the studio.
- Agent tools `forge_character` and `forge_options`, so the generator is
  drivable from the console, `window.PixelForge.call`, and MCP.
- Eight showcase rolls pinned into the library as `forge_*` templates, so the
  generator runs through every gate the hand-drawn packs do.

### Added — assets and games

- **Top-down pack** (`js/library/topdown.js`) — true-overhead characters drawn
  from body-space geometry with eight-direction locomotion, a 16-tile terrain
  sheet, thirteen props with cast shadows, five vehicles and six pickups.
- **Isometric expansion** — buildings, terrain features and contact shadows on
  the existing iso kit.
- `games/nightfall/` — top-down survival shooter with a real lighting pass.
- `games/ironvale/` — isometric skirmish on the iso lattice.
- `scripts/sim-game.js` — boots each demo game headless and drives thousands of
  frames of synthetic input, so a null deref in a spawn path fails in CI.

### Fixed

- Generated characters enforce value separation between parts that touch
  (metal/skin, steel/metal, armour/shirt, hood/shirt, cloak/shirt, hair/skin,
  shirt/skin, leg/shirt) — independent colour rolls hit the "a palette colour
  equal to a neighbour erases the part" failure constantly.
- Weapon heads are filled in the shaft's own frame rather than stacked out of
  1px lines, which fanned into a comb the moment the weapon rotated.
- Swing wind-up cocked nearer vertical off a fist held outside the torso: a
  four-pixel axe head at the old angle deleted the character's face for two
  frames.
- Forged figures sit one pixel lower in the frame so the outline pass has
  somewhere to put the border above the tallest headgear.
- Nightfall's lighting overlay is cleared per frame instead of accumulating to
  black.

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
  built from one tile-space projection. Each tile's *fill* is exactly 256
  pixels — the determinant of the 2:1 isometric lattice — so a floor laid from
  these tiles has no pinholes and no doubled seams; the outline pass then
  bleeds one pixel past the fill on every edge, which is what draws the floor
  grid where neighbours meet. `scripts/test.js` tiles a field and counts the
  holes rather than trusting the eye. Props carry no ground of their own, so a
  barrel drops onto any floor tile in the pack.
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
  160-asset export half-written — but exits non-zero and names what failed.
  `--dry-run` renders everything and lists what it would write without
  touching the disk.
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
- **Godot 4 `SpriteFrames` threw away every hold frame.** Each frame was
  written with `"duration": 1.0`; Godot reads that field as a multiplier of the
  animation's `1/speed`, not as seconds, so a deliberate two-frame blink spent
  as long open as shut. Durations are now emitted relative to the state's fps.
- **Unity `.png.meta` had no `guid`.** Unity keys every asset by one and treats
  a meta file without it as unimported, rewriting it from scratch on open and
  discarding every sprite rect in it. The guid is now derived from the sheet
  name, so re-exporting the same sprite keeps existing scene references alive;
  `textureType` is set, and sprite ids are the full 32 hex digits Unity expects.
- **CSS one-shot animations snapped back to frame 0** on their final tick —
  a death pose popped upright. Non-looping states now carry
  `animation-fill-mode: forwards`.
- **`phaser-anims` hardcoded `<name>.json`** as the atlas filename, so the
  generated module 404'd whenever two targets shared an extension and the CLI
  disambiguated the file it actually wrote.
- **`godot-tileset` emitted one tile the size of the whole sheet**, because
  nothing supplied the tile size — a 64x64 tile sheet and a 64x64 single sprite
  are the same atlas. Added `--tile-width` / `--tile-height`.
- **Numeric CLI flags were unvalidated.** `--padding abc` surfaced as a Node
  internal (`size out of range ... NaN`), `--scale 1.3` succeeded and wrote a
  sheet with fractional frame rects no importer can slice, and `--columns 0`
  was silently ignored. All three now fail with the flag name and the value.
- **`check-pages.js` did not catch a missing `<script>` tag.** Deleting a
  library file from all four pages passed the entire gate suite; the pack was
  simply absent at runtime. The gate now asserts every `js/library/*.js` entry
  in `scripts/lib-boot.js`'s `FILES` is loaded by every page.

### Fixed — art

A full visual pass over the farm and isometric packs, per the house rule that
every visual change must be exported and *looked at*. None of these were
visible to any numeric gate:

- Iso props each baked a ground diamond of their own material underneath
  themselves, so a barrel could not be placed on a stone floor without
  stamping a patch of planks into it, and a tree stamped grass into a dungeon.
  Props are now transparent overlays anchored to the footprint centre.
- The iso barrel used `MAT.wood`'s three tones byte for byte and therefore
  vanished against a plank tile — the exact failure the contributor guide
  warns about. Rebuilt in a darker cooperage with iron hoops.
- `iso_props/lamp` flickered on `2, 3, 2, 3`: four frames, two of them
  duplicates. It also silhouetted as a lollipop; it is now a housed lantern on
  a four-step flame ramp.
- Iso blocks were 9, 10 and 11px tall depending on the material, so a mixed
  stack stepped. All ten are one height now.
- The `ramp` state's fourteen 1px risers were swallowed by the outline pass and
  the slope read as a flat quadrilateral. Seven 2px risers read.
- `stairs_nw` read as a lumpy wedge while `stairs_ne` read crisply: on that
  axis the riser is the mid-tone face, so it had no contrast against the tread.
  Risers on both axes now take the shaded tone.
- Tree and boulder scattered highlight flecks over their bounding boxes, which
  landed in open air and read as screen dirt; the crystal's sparkle sat 2px
  clear of its own tip. All now anchored to the form.
- The iso crate cross-braced both faces under a rail and a shadow band — five
  of ten face rows spoken for — and smeared into a brown mass. Rebuilt with
  upright slat seams, which are 1px wide and read at any size.

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
