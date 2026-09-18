# Styles — one library, every era

A style retargets finished pixels onto a curated palette with deterministic
ordered dithering. It runs *after* a sprite is drawn, so it works on library
templates, imported PNGs, hand-drawn frames and whole projects without touching
a single painter.

```js
PF.Style.apply(buf, 32, 32, 'gameboy');      // in place
PF.Style.docOf(doc, 'nes');                  // pure copy
PF.Style.list();                             // 25 styles
node scripts/forge.js styles                 // from the shell
```

## The catalogue

| id | name | colours | good for |
|---|---|---|---|
| `gameboy` | Game Boy DMG | 4 | handheld green, jams and demakes |
| `gameboy-pocket` | Game Boy Pocket | 4 | neutral grey handheld |
| `gameboy-light` | Game Boy Light | 4 | teal glow |
| `virtual-boy` | Virtual Boy | 4 | red-on-black, horror and arcade |
| `nes` | NES | 16 | 8-bit console |
| `cga` | CGA Mode 4 | 4 | 1981 PC, high-contrast |
| `c64` | Commodore 64 | 16 | 1982 PC |
| `pico8` | PICO-8 | 16 | fantasy console |
| `sweetie16` | Sweetie 16 | 16 | modern retro default |
| `mono-1bit` | 1-Bit Ink | 2 | zine, Game Boy camera, extreme constraint |
| `sepia` | Sepia Print | 4 | aged paper, diaries, flashbacks |
| `noir` | Film Noir | 6 | greyscale mood |
| `neon-noir` | Neon Noir | 10 | synthwave, night city |
| `vaporwave` | Vaporwave | 10 | pastel dusk |
| `desert` | Desert Dusk | 8 | warm adventure biome |
| `arctic` | Arctic | 8 | cold biome |
| `jungle` | Deep Jungle | 8 | canopy biome |
| `abyss` | Abyss | 8 | deep water biome |
| `inferno` | Inferno | 8 | fire biome |
| `pastel-dream` | Pastel Dream | 12 | cozy, cute, life-sim |
| `holy` | Stained Glass | 8 | bright fantasy, churches |
| `undead` | Blighthold | 8 | rot, blight, undead |
| `cyberpunk` | Cyberpunk | 10 | chrome and toxic neon |
| `terminal` | Amber Terminal | 6 | CRT phosphor, PC-98-ish |
| `thermal` | Thermal | 7 | false-colour heat, HUDs |

## How the mapping works

1. **Perceptual distance.** Nearest-colour search uses a redmean metric — a
   cheap approximation of CIE76 that behaves far better than RGB distance on the
   dark ramps these palettes live on (naive RGB maps mid browns onto mid greens).
2. **Two nearest colours.** For each source colour the two closest palette
   entries are computed once and cached (`styleId|color`), so the second frame of
   an animation is nearly free.
3. **Ordered dithering.** A 4×4 Bayer threshold decides which of the two
   neighbours wins per pixel. Where the source sits between them (`d1/(d1+d2)`)
   sets how much of the cell flips — that is what keeps a gradient readable in
   four colours without turning into noise.
4. **Alpha is a threshold, not a blend.** Hardware palettes are opaque;
   blending semi-transparent edges would dither into halos. Pixels below the
   cutoff become fully transparent.

Every output colour is guaranteed to be *in* the palette. `scripts/check-style.js`
proves it for 25 styles × 5 sprites, along with determinism, alpha preservation
and that no style flattens a sprite to a single colour.

## Adding a style

```js
PF.Style.register({
  id: 'my-palette',
  name: 'My Palette',
  era: '2026 · 8 colours',
  dither: true,                       // false = hard nearest-colour posterise
  palette: ['#101010', '#404040', '#a0a0a0', '#f0f0f0', '#e05050', '#50e050', '#5050e0', '#f0f0a0'],
  tags: ['custom', 'moody']
});
PF.Style.cssVars('my-palette');       // CSS custom properties for a matching UI theme
```

`PF.Style.get(id)` returns the internal entry (with a pre-resolved `u32`
palette) for hot loops; `PF.Style.quantize(entryOrId, color, t)` maps a single
colour if you need it directly.

## Where styles appear

- **Studio / agent:** `restyle_document` (in place, undoable) and
  `open_styled_variant` (a new project from any template).
- **Factory:** `PF.Factory.recipe({ brief })` picks a style from the brief and
  applies it to the whole pack — "cozy farm game, pastel" lands on
  `pastel-dream`.
- **CLI:** `node scripts/forge.js style out/ rpg_knight gameboy` writes the
  sheet plus a `*-palette.css` theme file.
- **Games:** apply per-entity at runtime for damage flashes, day/night cycles or
  "the world is dying" palettes — the same sprite serves every mode with no
  extra memory.

## Tint, warm/cool, and palette swapping

```js
PF.Style.tint(buf, W, H, '#ff2e88', 0.5);   // multiplicative tint toward a colour, keeps alpha
PF.Style.warmCool(buf, W, H, 0.6);          // highlights drift warm, shadows cool
PF.Style.stats(buf);                        // histogram: [{ u32, hex, count }]
```

`warmCool` is the classic pixel-art trick for making a single flat sprite read
as lit from above without authoring a second pass: it pushes bright pixels toward
warm and dark pixels toward cool instead of just adding brightness.

## Cost

Quantisation is O(pixels) with one Map probe per distinct colour. A 32×32 frame
costs a few microseconds after the first frame of a state; a full 2,000-frame
library restyle is a fraction of the render cost. The style gate runs 125 sprite
restyles per build in well under a second.
