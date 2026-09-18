# PixelForge

PixelForge is a dependency-free browser pixel-art studio and deterministic game
asset engine. It ships 115 editable templates, 1,490 animation states and 6,365
frames across fantasy, sci-fi, modern, platformer and arcade styles. Every pixel
is generated at runtime by JavaScript; there are no source image assets and no
build step.

## Run locally

Requires Node.js 18 or newer.

```bash
npm run serve
```

Open `http://localhost:5173/` for the catalogue, `/studio.html` for the editor,
`/app/` for the workspace, or `/games/runefall/` for the playable integration
demo.

## Engine API

Modules expose the global `PF` namespace in the browser. The shared
`scripts/lib-boot.js` loader provides the same asset and raster APIs in Node.

```js
// Discover assets with composable filters.
const heroes = PF.Library.query({
  category: 'Heroes',
  tags: ['sci-fi'],
  featured: true
});

// Render without Store, DOM or canvas. Frame indices wrap automatically.
const sprite = PF.Library.render('nova_marine', {
  state: 'run',
  frame: 3
});
// sprite.pixels is a 32x32 Uint32Array in ABGR little-endian format.

// Reuse both buffers for an allocation-free game loop and recolor on render.
const out = new Uint32Array(32 * 32);
const scratch = new Uint32Array(32 * 32);
const palette = PF.Raster.compilePalette({ '#356b8c': '#b24cff' });
PF.Library.render('nova_marine', {
  state: 'run', frame: 4, out, scratch, palette
});
```

The studio exports PNG, animated GIF, spritesheet plus Aseprite-compatible JSON,
SVG, CSS, and lossless PixelForge project files.

## Asset catalogue

Run `node scripts/info.js` to list every template, state and frame. Generate a
review sheet with:

```bash
node scripts/sheet.js nova_marine 6
node scripts/sheet.js --all 3
```

Generated review images are written to `scripts/out/` and are ignored by Git.

## Verification

```bash
npm test
```

The gate checks JavaScript syntax, all sprite painters, animation deltas, engine
API contracts, 6,365 pixel hashes, game wiring, and page references. Asset and
engine contributions must leave the gate at zero failures and zero warnings.

See [AGENTS.md](AGENTS.md) for architecture, template authoring rules, pixel
buffer format, and the non-negotiable visual invariants.

## License

MIT
