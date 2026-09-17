# PixelForge Workspace

A local-first, multi-asset pixel-art workspace built on the raster engine in your uploaded PixelForge codebase. No npm install, CDN, account, image API, or paid service is required.

## Start locally

From this folder, run:

```sh
python -m http.server 8000 --bind 127.0.0.1
```

Open `http://127.0.0.1:8000/index.html` in a browser. Keep using this exact host and port: browser storage belongs to the origin. `localhost` and `127.0.0.1`, or two different ports, do not share project storage.

Double-clicking an HTML page is not the recommended workflow. Some browsers restrict or isolate IndexedDB for `file:` pages. A local server makes the separate pages share a reliable origin.

## Three separate pages

- `index.html`: project browser. Create, search, rename, duplicate, delete, import, and back up projects.
- `templates.html`: five world starters and a filterable library of 47 assets. Inspect every animation before adding it to a project.
- `studio.html?project=PROJECT_ID`: dedicated editor for an existing project. Opening `studio.html` without an ID creates a new blank project.

The original embedded landing-page editor is no longer the entry point. The original raster, rendering, document, animation, export, and tool concepts have been retained and extended. Old unused UI/CSS/MCP files remain in the source for reference, but the new pages do not load them or their external fonts.

## A good first session

1. Open **Templates & assets** and choose **The wildwood**.
2. Name the project and open the studio.
3. Select Fern or Rowan in the left asset list.
4. Choose **walk** and **south/east/north/west** in the inspector.
5. Press **P** to play, or use the independent preview button.
6. Select **Body** or **Equipment**, pick a palette color, and edit a frame. Drawing pauses playback.
7. Use **V** to select pixels; copy, cut, paste, flip, or nudge them.
8. Add more sprites with **+**, or import a PNG / sprite JSON as a new asset.
9. Use **Export → Download game asset pack** for all project PNG sheets and JSON atlases in one ZIP.
10. Also download the **entire project backup** to keep editable source data safe.

## Editing tools

- Pencil, eraser, flood fill, line, rectangle, ellipse, eyedropper, shade, pan, whole-layer move, and rectangular selection.
- Brush size 1–32, filled shapes, horizontal/vertical symmetry, pixel grid, onion skin, zoom, pan, and fit.
- Undo/redo for strokes and structural edits.
- Named layers with visibility, opacity, locking, reordering, renaming, deletion, and opacity-aware merge-down.
- Frame thumbnails, duplication, insertion, deletion, reordering, per-frame durations, FPS, and looping/one-shot playback.
- Action/direction selectors instead of an unwieldy list of 92 character states.
- Color picker, editable hex color, palettes, and an agent recoloring tool that changes an entire suite in one undoable operation.
- Separate asset list and inspector views on narrow screens.

Selection controls copy/cut/paste, flip, delete, and nudge. It does **not** currently mask subsequent brush strokes. Clipboard pixels stay inside the current browser tab. Layer move moves the entire active layer; arrow keys move the selection when one exists.

## Asset library

All new art is drawn by the local procedural generator, not fetched from an external asset pack or produced through a hosted image model. It is intentionally a consistent, editable starter style, not a claim of hand-authored production art.

The included library has **47 assets, 990 animation states, and 6,106 frames**:

| Family | Assets | Contents |
| --- | ---: | --- |
| Characters | 8 | Male/female ranger, knight, mage, and miner |
| Enemies | 6 | Moss slime, ember slime, bat, skeleton, goblin, wolf |
| Props | 8 | Chest, door, campfire, forge, workbench, bedroll, barrel, crate |
| Nature | 8 | Oak, pine, boulder, copper ore, gold ore, berry bush, wheat, mushroom |
| Tiles | 6 | Grass, earth, stone floor, dungeon wall, animated water, sand |
| Items | 11 | Coin, potion, heart, key, torch, sword, pickaxe, axe, bow, staff, bread |

Each character has **23 actions × 4 directions = 92 states and 600 frames**:

```text
idle, walk, run, jump, fall, land,
sword, pickaxe, axe, shoot, cast, block,
hurt, death, roll, eat, drink, sleep,
carry, use, pickup, swim, fish
```

Directions are `south`, `east`, `north`, and `west`. Names such as `walk_south` and `pickaxe_east` are preserved in exports. West poses mirror east poses; north and south have different head/back details. Action motion is generated with discrete limb poses, arcs, squash, offsets, rotations, equipment, and effects. Each character state was checked to contain more than one distinct rendered pose.

Enemies have idle, walk, run, attack, hurt, death, and spawn states in four directions. Props and nature have relevant opening, closing, use, break, harvest, depleted, and growth states. Most terrain tiles are static; water animates. Not every inanimate object has character actions.

The generator creates the pixels on demand. Template projects store references for untouched library assets and materialize pixel data when edited. The game-pack exporter materializes **all** assets, including untouched templates. This keeps new projects quick to create and avoids filling storage with copies of unused suites.

The generator version is recorded in backups. Do not change existing generator version 1 definitions without a migration strategy: an untouched template reference depends on that version.

## Export and engine use

- **PNG frame**: transparent image of the active frame.
- **Sprite sheet + JSON**: rows by state, grid, or strip; optional padding; current state or all states.
- **Animated GIF**: active/selected state's timing and loop setting. GIF uses palette quantization and binary transparency; use PNG for full alpha fidelity.
- **Atlas JSON**: frame rectangles, durations, named frame tags, layers, and PixelForge metadata.
- **SVG**: pixel rectangles without smoothing.
- **Sprite source JSON**: lossless layers, states, pixels, and palette for a single asset.
- **Project backup JSON**: all project asset records, source edits, untouched template references, and project information.
- **Game asset ZIP**: every project asset as a native-resolution PNG sheet and its JSON atlas, plus a pack manifest and import notes.

Use nearest-neighbor texture filtering in your engine. Atlas frame rectangles are in pixels; durations are milliseconds. `meta.frameTags` gives state ranges. `meta.pixelForge` records action/direction information and the pivot. Generated characters use a normalized pivot of `(0.5, 0.875)`, aligning their feet near pixel y=28 on a 32px canvas.

PNG-sheet import accepts an evenly divided grid with up to 256 frames. Enter frame width/height; use 0 to import the entire image as one frame. Use source JSON to round-trip a full 600-frame character suite with its state names and layers. PNG import does not reconstruct source layers or animation tags automatically.

## Project safety

- Projects and assets use IndexedDB, not a single `localStorage` slot.
- Autosave is debounced; **Save** or Ctrl/Cmd+S explicitly saves the current sprite locally.
- Multi-tab writes compare project revisions inside the same read/write transaction. A stale tab cannot silently overwrite a newer project.
- Save errors remain visible. Navigation warns about pending edits. Browser shutdown/crashes are not a substitute for backups.
- If a conflict occurs, export the **active sprite source JSON** before reloading. Import it as a separate asset to reconcile edits. The full-project backup command deliberately refuses to imply that an unsaved conflicting edit has been persisted.
- Importing a backup creates a new project with new IDs. It does not overwrite existing projects.
- Project and asset deletion require confirmation. Deletion is permanent; layer/state/frame edits are undoable.
- If the original `pf-autosave` browser value exists on the same origin, the Projects page offers **Recover old autosave**. It leaves the original value untouched.
- Clearing browser/site data deletes local projects. Export backups before moving machines or browsers.

## Limits and honest boundaries

- Canvas: 1–256 pixels on each axis. Up to 16 layers, 128 states, 256 frames per state, 128 assets per project.
- A sprite has a 64 MB uncompressed pixel-data budget. Structural operations validate allocation limits.
- History targets 64 MB / 80 entries, retaining the newest operation even when that operation is larger. Switching assets clears the active sprite's undo history; saved pixels are retained.
- Sprite sheets are limited to 8,192 pixels per edge and 32 million pixels total. Use 1×, grid, or single-state export for very large suites.
- Imports: images up to 20 MB, sprite JSON up to 96 MB, workspace JSON up to 256 MB. Game-pack ZIP exports are capped at 512 MB.
- Large animation suites can make structural edits and full-sprite saves expensive on low-memory devices.
- This is an asset editor, not a game engine, scene/map editor, tile-autotiling system, or asset rigging tool. There is no cloud sync, multiplayer collaboration, skeletal rigging, `.aseprite` file import, lasso selection, or native OS pixel clipboard integration.
- Pixel art, animation readability, hitboxes, palette choices, tile joins, and timing still need review in the intended game. Generator-based starter art is not a replacement for that art-direction pass.
- No external language model is connected. See `AGENT-API.md` for the actual agent interface.

## Validation performed

All shipped JavaScript passed syntax checks. All 47 assets were generated and serialized/validated. Checks covered stroke/structural undo, invalid-load rollback, selection operations, schema validation, atomic edit-plan rollback, atlas counts/coordinates/raster placement, export bounds, project backup round-trips, stale revisions, and deletion cleanup.

The project browser, template library, and studio were exercised with a DOM/IndexedDB test harness: boot, painting, undo/redo, frame duplication, save, switching assets, action/direction selection, filters, and dialogs. This is **simulated integration testing**, not proof of native browser IndexedDB behavior or layout quality.

GIF files were independently decoded with Pillow. ZIP files were independently decoded and CRC-checked with Python's `zipfile`. A contact sheet of the generated art was visually reviewed.

A browser executable was not available in the authoring environment. Run the manual checklist in `VALIDATION.md` before treating this as a release. This is a substantial functional upgrade, not a claim of exhaustive production certification.
