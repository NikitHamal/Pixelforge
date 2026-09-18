/* PixelForge Studio — isometric construction kit.
   Ground tiles, cube blocks, walls, stairs and props on a 2:1 isometric grid.

   This pack exists because every other pack in the library is side-on or
   top-down, and an isometric project could not use any of it. Isometric art is
   not a style you can retrofit: the footprint geometry has to be exact or
   tiles gap against each other, so it needs its own primitives rather than a
   palette swap of an existing pack.

   GEOMETRY — the contract every template here honours:
     * The canvas is 32x32. The tile FOOTPRINT is a 32x16 diamond anchored to
       the bottom of the canvas, so the top vertex sits at row 16 and the
       bottom vertex at row 31. Elevation grows upward into the free 16 rows.
     * Everything is modelled in tile space (u, v, w) and projected by `proj`.
       u runs toward the lower-right, v toward the lower-left, w straight up.
       Because the ground quad is drawn by the same projection as everything
       else, a block, a wall and a flat tile all land on exactly the same
       diamond and tessellate with each other.
     * Faces are filled by `quad`, a convex scanline fill. Adjacent tiles
       therefore overlap by at most a pixel on a shared edge and never gap —
       gaps show as bright pinholes in a tiled floor, overlap shows as nothing.

   LIGHTING is fixed: the sun is up and to the left. Top faces are brightest,
   the lower-right (u=1) face is mid, the lower-left (v=1) face is darkest.
   Keeping that constant across the pack is what lets a wall from `iso_walls`
   sit next to a block from `iso_blocks` and read as the same scene. */
window.PF = window.PF || {};
PF.Iso = (() => {
  const R = PF.Rig;
  const D = R.D, draw = R.draw, cyc = R.cyc, still = R.still, TAU = R.TAU;

  /* ------------------------------------------------------------ geometry */

  const CX = 15.5, CY = 16, HW = 15.5, HH = 7.5;

  /* Tile space -> screen. (0,0) is the top vertex, (1,1) the bottom one, so a
     unit square in (u,v) is exactly the footprint diamond. w is elevation in
     screen pixels, subtracted because screen y grows downward. */
  const proj = (u, v, w) => [CX + (u - v) * HW, CY + HH + (u + v - 1) * HH - (w || 0)];

  /* Convex polygon scanline fill. `c` is a colour, or a function (x, y) that
     RETURNS a colour — or null to leave the pixel alone. Per-pixel colour is
     what lets a face carry its own grain without a second pass that would have
     to re-derive which pixels the face covers; returning null is what lets a
     turf lip fray into the face below it. */
  function quad(a, pts, c) {
    const fn = typeof c === 'function' ? c : () => c;
    let y0 = Infinity, y1 = -Infinity;
    for (const p of pts) { if (p[1] < y0) y0 = p[1]; if (p[1] > y1) y1 = p[1]; }
    y0 = Math.round(y0); y1 = Math.round(y1);
    for (let y = y0; y <= y1; y++) {
      let lo = Infinity, hi = -Infinity;
      for (let i = 0; i < pts.length; i++) {
        const [ax, ay] = pts[i], [bx, by] = pts[(i + 1) % pts.length];
        if (ay === by) {
          if (Math.round(ay) === y) { lo = Math.min(lo, ax, bx); hi = Math.max(hi, ax, bx); }
          continue;
        }
        const t = (y - ay) / (by - ay);
        if (t < 0 || t > 1) continue;
        const x = ax + (bx - ax) * t;
        if (x < lo) lo = x; if (x > hi) hi = x;
      }
      if (lo > hi) continue;
      /* Asymmetric rounding is not sloppiness, it is the tiling rule. The FILL
         of a 32x16 footprint has to be exactly 256 pixels — the determinant of
         the lattice the tiles sit on — laid out 2, 6, 10 ... 30, 30 ... 6, 2
         per row. Round both ends and the widest rows come out 32px and
         neighbours overlap; floor both and they come out 28 and the floor
         shows pinholes. Floor the left edge, round the right, and the diamond
         lands on the lattice exactly.

         The 1px outline pass that every frame ends with then bleeds one pixel
         PAST that fill on each edge, deliberately: laid in a field the
         outlines of neighbouring tiles land on each other and draw the floor
         grid. So a tile's opaque extent is 256 + outline, and only the fill is
         a lattice cell. (scripts/test.js checks both: the fill area, and a
         tiled field probed for holes.) */
      for (let x = Math.floor(lo); x <= Math.round(hi); x++) {
        const col = fn(x, y);
        if (col) a.px(x, y, col);
      }
    }
  }

  /* Paint a face with base colour plus deterministic grain. Grain is what
     stops a 32x16 flat fill reading as a UI panel instead of a material; the
     hash seed is folded from the face id so the left and right faces of one
     block do not share a speckle pattern and betray the mirror. */
  const face = (a, m, key, seed) => (x, y) => {
    const spot = m[key + 'Spot'] || m.spot;
    if (spot && a.hash(x, y, seed) < (m.density || 0.16))
      return spot[Math.floor(a.hash(x, y, seed + 71) * spot.length) % spot.length];
    return m[key];
  };

  /* Rounded projection, for the primitives that want integer endpoints. */
  const at = (u, v, w) => proj(u, v, w).map(Math.round);

  /* --------------------------------------------------------------- solids */

  /* The footprint quad at elevation w, optionally inset — inset tops are how
     a stair tread or a well rim sits inside its own tile. */
  const topFace = (a, m, w, seed, i) => {
    const lo = i || 0, hi = 1 - (i || 0);
    quad(a, [proj(lo, lo, w), proj(hi, lo, w), proj(hi, hi, w), proj(lo, hi, w)], face(a, m, 'top', seed));
  };

  /* A block of height h. Sides first would be overdrawn by the top anyway,
     but drawing top-last keeps the silhouette's upper edge crisp when a
     material's grain is dense. */
  function block(a, m, h, seed, u0, u1, v0, v1, base) {
    /* Footprint defaults to the whole tile. Three call sites here want exactly
       that and passing 0,1,0,1 at each of them is four chances to typo a face
       into a zero-width quad that silently paints nothing. */
    if (u0 === undefined) { u0 = 0; u1 = 1; v0 = 0; v1 = 1; }
    const b = base || 0;
    quad(a, [proj(u1, v0, b + h), proj(u1, v1, b + h), proj(u1, v1, b), proj(u1, v0, b)], face(a, m, 'right', seed + 11));
    quad(a, [proj(u0, v1, b + h), proj(u1, v1, b + h), proj(u1, v1, b), proj(u0, v1, b)], face(a, m, 'left', seed + 23));
    quad(a, [proj(u0, v0, b + h), proj(u1, v0, b + h), proj(u1, v1, b + h), proj(u0, v1, b + h)], face(a, m, 'top', seed));
  }

  /* A level band across one visible face of a full-tile block, from height w
     down by t. Bands are quads, not screen-space lines: a line drawn between
     two projected points keeps a constant screen thickness and so tapers in
     apparent width as the face slopes away. */
  const faceBand = (a, side, w, t, c) => quad(a, side === 'right'
    ? [proj(1, 0, w), proj(1, 1, w), proj(1, 1, w - t), proj(1, 0, w - t)]
    : [proj(0, 1, w), proj(1, 1, w), proj(1, 1, w - t), proj(0, 1, w - t)], c);

  /* A vertical joint on one face, at parameter k along that face. */
  const faceJoint = (a, side, k, w0, w1, c) => {
    const p0 = side === 'right' ? at(1, k, w0) : at(k, 1, w0);
    const p1 = side === 'right' ? at(1, k, w1) : at(k, 1, w1);
    a.line(p0[0], p0[1], p1[0], p1[1], c);
  };

  /* ------------------------------------------------------------ materials */

  const MAT = {
    grass: {
      top: '#4f9b43', spot: ['#67b857', '#3d7a34', '#7cc767'], density: 0.3,
      right: '#7a5433', rightSpot: ['#8c6440', '#66452a'], left: '#563a23', leftSpot: ['#654428', '#422c1a']
    },
    dirt: {
      top: '#8a6039', spot: ['#a0764a', '#6f4b2c', '#b08659'], density: 0.34,
      right: '#79512f', rightSpot: ['#8a6039'], left: '#573a21', leftSpot: ['#66452a']
    },
    stone: {
      top: '#8d8f9e', spot: ['#a4a6b4', '#74768a', '#b7b9c6'], density: 0.28,
      right: '#74768a', rightSpot: ['#84869a'], left: '#555768', leftSpot: ['#63657a']
    },
    sand: {
      top: '#dcc188', spot: ['#eed8a4', '#c2a46c'], density: 0.24,
      right: '#c2a46c', rightSpot: ['#d0b279'], left: '#9c8050', leftSpot: ['#ab8e5c']
    },
    snow: {
      top: '#eaf1f7', spot: ['#ffffff', '#cfdce8'], density: 0.2,
      right: '#c6d5e2', rightSpot: ['#d8e3ec'], left: '#9fb2c4', leftSpot: ['#aebfce']
    },
    wood: {
      top: '#a5743f', spot: ['#b8874f', '#8a5d2f'], density: 0.22,
      right: '#8a5d2f', rightSpot: ['#98693a'], left: '#63421f', leftSpot: ['#724d28']
    },
    brick: {
      top: '#b25441', spot: ['#c4644f', '#9a4433'], density: 0.18,
      right: '#9a4433', rightSpot: ['#a85040'], left: '#6f2f24', leftSpot: ['#803a2c']
    },
    ice: {
      top: '#9fdcec', spot: ['#c6ecf6', '#7cc2d6'], density: 0.22,
      right: '#7cc2d6', rightSpot: ['#8fd0e2'], left: '#5a95ad', leftSpot: ['#69a6bd']
    },
    gold: {
      top: '#efc44f', spot: ['#ffe27e', '#c99c2f'], density: 0.2,
      right: '#c99c2f', rightSpot: ['#dcae3c'], left: '#94701e', leftSpot: ['#a88028']
    },
    crate: {
      /* Deliberately darker than MAT.wood's side faces: the crate's pale
         rails and braces are drawn ON these, and against wood's own tones
         they blended into one brown mass. */
      top: '#a87a45', spot: ['#b8874f'], density: 0.12,
      right: '#7a4f26', left: '#543616'
    },
    lava: {
      top: '#e8622b', spot: ['#ffb03a', '#a8321a', '#ff8a33'], density: 0.4,
      right: '#a8321a', left: '#6f1d10'
    },
    water: {
      top: '#3c7fc4', spot: ['#59a0dc', '#2d639f'], density: 0.3,
      right: '#2d639f', left: '#1f4574'
    }
  };

  /* Ground tiles are blocks of zero height: one call, and the diamond they
     produce is bit-identical to the top face of any block in the pack. */
  const ground = (m, seed) => still(a => topFace(a, m, 0, seed));

  /* ---------------------------------------------------------- iso_ground */

  /* Liquids scroll their grain instead of re-rolling it. Re-rolling reads as
     television static; a scrolled hash reads as a current, and it guarantees
     the >=8px inter-frame difference the quality gate wants without the whole
     surface strobing. */
  const liquid = (m, seed, amp) => cyc(4, 6, (a, i, t) => {
    const sh = Math.round(Math.sin(t * TAU) * (amp || 2));
    quad(a, [proj(0, 0, 0), proj(1, 0, 0), proj(1, 1, 0), proj(0, 1, 0)], (x, y) => {
      const crest = Math.sin(x * 0.4 + y * 0.9 + i * 1.6);
      if (crest > 0.82) return m.spot[0];
      if (a.hash(x + sh, y, seed) < m.density)
        return m.spot[Math.floor(a.hash(x + sh, y, seed + 71) * m.spot.length) % m.spot.length];
      return m.top;
    });
  });

  const groundSuite = () => ({
    width: 32, height: 32, name: 'Iso Ground Tiles',
    layers: [{ name: 'tile' }],
    states: [
      D('grass', 1, false, ground(MAT.grass, 3)),
      D('dirt', 1, false, ground(MAT.dirt, 7)),
      D('stone', 1, false, ground(MAT.stone, 11)),
      D('sand', 1, false, ground(MAT.sand, 17)),
      D('snow', 1, false, ground(MAT.snow, 23)),
      D('wood', 1, false, still(a => {
        topFace(a, MAT.wood, 0, 29);
        /* Plank seams run along u, so they converge on the tile's left vertex
           the way floorboards converge toward the viewer in every iso game. */
        for (let k = 1; k < 4; k++) {
          const v = k / 4;
          const p0 = proj(0, v, 0), p1 = proj(1, v, 0);
          a.line(Math.round(p0[0]), Math.round(p0[1]), Math.round(p1[0]), Math.round(p1[1]), '#63421f');
        }
      })),
      D('water', 6, true, liquid(MAT.water, 31, 3)),
      D('lava', 6, true, liquid(MAT.lava, 37, 2))
    ]
  });

  /* ---------------------------------------------------------- iso_blocks */

  /* Every block in the pack is 10px tall so a mixed stack lines up. */
  const BLOCKH = 10;
  const cube = (m, seed) => still(a => block(a, m, BLOCKH, seed, 0, 1, 0, 1));

  const blocksSuite = () => ({
    width: 32, height: 32, name: 'Iso Blocks',
    layers: [{ name: 'block' }],
    states: [
      D('grass', 1, false, still(a => {
        block(a, MAT.grass, BLOCKH, 41, 0, 1, 0, 1);
        /* Turf overhang: a ragged green lip on the first rows of each earth
           face. Without it a grass cube reads as a green lid on a brown box. */
        quad(a, [proj(1, 0, BLOCKH), proj(1, 1, BLOCKH), proj(1, 1, BLOCKH - 2), proj(1, 0, BLOCKH - 2)],
          (x, y) => a.hash(x, y, 5) < 0.75 ? (a.hash(x, y, 9) < 0.4 ? '#3d7a34' : '#4f9b43') : null);
        quad(a, [proj(0, 1, BLOCKH), proj(1, 1, BLOCKH), proj(1, 1, BLOCKH - 2), proj(0, 1, BLOCKH - 2)],
          (x, y) => a.hash(x, y, 6) < 0.75 ? (a.hash(x, y, 10) < 0.4 ? '#2f5e28' : '#3d7a34') : null);
      })),
      D('stone', 1, false, cube(MAT.stone, 43)),
      D('dirt', 1, false, cube(MAT.dirt, 47)),
      D('sand', 1, false, cube(MAT.sand, 53)),
      D('ice', 1, false, still(a => {
        block(a, MAT.ice, BLOCKH, 59);
        /* One specular streak across the top face. Ice with grain alone is
           indistinguishable from pale stone at this size. */
        const p0 = proj(0.15, 0.55, BLOCKH), p1 = proj(0.6, 0.15, BLOCKH);
        a.line(Math.round(p0[0]), Math.round(p0[1]), Math.round(p1[0]), Math.round(p1[1]), '#eafaff');
      })),
      D('brick', 1, false, still(a => {
        block(a, MAT.brick, BLOCKH, 61);
        /* Three mortar courses per face, with the head joints of alternate
           courses offset by half a brick — running bond. Both are needed: the
           courses alone read as corrugated metal. */
        for (let k = 1; k < 4; k++) {
          const w = BLOCKH - k * 2.5;
          faceBand(a, 'right', w, 0.9, '#5e2419');
          faceBand(a, 'left', w, 0.9, '#48180f');
          for (let j = (k % 2) ? 0.25 : 0.5; j < 1; j += 0.5) {
            faceJoint(a, 'right', j, w, w + 1.6, '#5e2419');
            faceJoint(a, 'left', j, w, w + 1.6, '#48180f');
          }
        }
      })),
      D('crate', 1, false, still(a => {
        block(a, MAT.crate, BLOCKH, 67);
        /* A pale rail top and bottom, and dark seams between upright slats.
           Two earlier drafts cross-braced the faces: an X needs both diagonals
           legible over the full height, and a 10px face with rails already on
           it leaves seven rows for them, so both attempts collapsed into a
           brown smear. Upright seams are only ever one pixel wide and read at
           any size. Drawn in TILE space so they inherit the face's slant. */
        for (const [side, hi] of [['right', '#d8ab72'], ['left', '#b8874f']]) {
          faceBand(a, side, BLOCKH, 1.6, hi);
          faceBand(a, side, 1.6, 1.6, hi);
          for (const k of [0.33, 0.66]) {
            const p0 = side === 'right' ? at(1, k, 1.6) : at(k, 1, 1.6);
            const p1 = side === 'right' ? at(1, k, BLOCKH - 1.6) : at(k, 1, BLOCKH - 1.6);
            a.line(p0[0], p0[1], p1[0], p1[1], '#3d2410');
          }
        }
        /* Two seams across the lid, so the top face is planked like the sides
           rather than a flat tan diamond. */
        for (const k of [0.34, 0.67]) {
          const p0 = at(k, 0, BLOCKH), p1 = at(k, 1, BLOCKH);
          a.line(p0[0], p0[1], p1[0], p1[1], '#7a4f26');
        }
      })),
      D('gold', 1, false, still(a => {
        block(a, MAT.gold, BLOCKH, 71);
        const p = proj(0.35, 0.35, BLOCKH);
        a.px(Math.round(p[0]), Math.round(p[1]), '#fff6c8');
        a.px(Math.round(p[0]) + 1, Math.round(p[1]), '#fff6c8');
      }))
    ]
  });

  /* ----------------------------------------------------------- iso_walls */

  /* A wall is a slab occupying a strip of the footprint. THICK is how much of
     the tile it eats; the rest stays walkable floor, which is what lets a wall
     tile and a floor tile share one grid cell in a level editor. */
  /* WALLH is capped at 16 on purpose: the footprint's top vertex sits on row
     16, so a wall taller than that pushes its own apex off the top of the
     canvas and the outline pass can no longer close around it — the sprite
     reads as sliced. 15 leaves the row the outline needs. */
  const THICK = 0.22, WALLH = 15;

  /* u runs toward the lower-RIGHT vertex, so a slab spanning all of u hugs the
     upper-right (NE) edge; spanning all of v hugs the upper-left (NW) one. */
  const wallSlab = (a, m, seed, side, h) => side === 'ne'
    ? block(a, m, h, seed, 0, 1, 0, THICK)
    : block(a, m, h, seed, 0, THICK, 0, 1);

  /* The camera-facing plane of each slab: v = THICK for a NE wall, u = THICK
     for a NW one. Everything cut into a wall is cut into this plane. */
  const facePt = (side, k, w) => side === 'ne' ? proj(k, THICK, w) : proj(THICK, k, w);

  /* Carve an opening by repainting the hole with the floor behind it, then
     re-drawing the reveal. Cheaper and more legible than masking: at this size
     a door is four rectangles, and the reveal is what sells the thickness. */
  function opening(a, side, k0, k1, y0, y1, dark) {
    quad(a, [facePt(side, k0, y1), facePt(side, k1, y1), facePt(side, k1, y0), facePt(side, k0, y0)], dark);
  }

  const wallsSuite = () => ({
    width: 32, height: 32, name: 'Iso Walls',
    layers: [{ name: 'wall' }],
    states: [
      D('wall_nw', 1, false, still(a => wallSlab(a, MAT.stone, 79, 'nw', WALLH))),
      D('wall_ne', 1, false, still(a => wallSlab(a, MAT.stone, 83, 'ne', WALLH))),
      D('corner', 1, false, still(a => {
        wallSlab(a, MAT.stone, 79, 'nw', WALLH);
        wallSlab(a, MAT.stone, 83, 'ne', WALLH);
      })),
      D('door', 1, false, still(a => {
        wallSlab(a, MAT.stone, 79, 'ne', WALLH);
        opening(a, 'ne', 0.28, 0.74, 0, 11, '#1d1a2c');
        /* A timber lintel and a lit threshold, so the hole reads as a doorway
           rather than a bite taken out of the wall. */
        const lint0 = facePt('ne', 0.28, 11.8), lint1 = facePt('ne', 0.74, 11.8);
        a.line(Math.round(lint0[0]), Math.round(lint0[1]), Math.round(lint1[0]), Math.round(lint1[1]), '#8a5d2f');
        opening(a, 'ne', 0.28, 0.74, 0, 2.5, '#3f3a5c');
      })),
      D('window', 1, false, still(a => {
        wallSlab(a, MAT.stone, 79, 'ne', WALLH);
        opening(a, 'ne', 0.3, 0.72, 5.5, 11, '#20364e');
        opening(a, 'ne', 0.34, 0.68, 6.5, 10, '#5d9fd4');
        /* One mullion, drawn as a sliver of the frame colour rather than a
           line: a screen-space line across a sloped face wanders off it. */
        opening(a, 'ne', 0.5, 0.53, 6.5, 10, '#3d3f50');
      })),
      D('pillar', 1, false, still(a => block(a, MAT.stone, WALLH, 89, 0.3, 0.7, 0.3, 0.7))),
      D('half_nw', 1, false, still(a => wallSlab(a, MAT.brick, 97, 'nw', 8))),
      D('half_ne', 1, false, still(a => wallSlab(a, MAT.brick, 101, 'ne', 8)))
    ]
  });

  /* ---------------------------------------------------------- iso_stairs */

  /* A flight climbing AWAY from the camera: the band nearest the viewer is the
     lowest, so each step's riser faces the camera and the flight reads as
     stairs rather than a wedge.

     Two things have to be right together. Height must DECREASE along the axis
     (band 0 is the far, tall end) and the bands must be drawn far-to-near, so
     each nearer step overdraws the base of the one behind it and leaves
     exactly one rise of riser showing. Get either backwards and the near step
     hides every tread behind it — the result is a solid ramp with a suspicious
     top edge. Painter's algorithm is all the depth sorting one tile needs. */
  function flight(a, m, seed, axis, steps, total) {
    const rise = total / steps;
    /* On the v axis the riser IS the left face, which the fixed lighting
       already makes the darkest tone, so the treads separate for free. On the
       u axis the riser is the mid-tone right face and the flight reads as a
       lumpy wedge — a riser is in the shadow of the step above it, so borrow
       the left face's tone for it. */
    const mm = axis === 'u' ? Object.assign({}, m, { right: m.left, rightSpot: m.leftSpot }) : m;
    for (let k = 0; k < steps; k++) {
      const h = (steps - k) * rise, lo = k / steps, hi = (k + 1) / steps;
      if (axis === 'v') block(a, mm, h, seed + k * 7, 0, 1, lo, hi);
      else block(a, mm, h, seed + k * 7, lo, hi, 0, 1);
    }
  }

  const stairsSuite = () => ({
    width: 32, height: 32, name: 'Iso Stairs & Ramps',
    layers: [{ name: 'stairs' }],
    states: [
      D('stairs_nw', 1, false, still(a => flight(a, MAT.stone, 103, 'u', 4, 14))),
      D('stairs_ne', 1, false, still(a => flight(a, MAT.stone, 107, 'v', 4, 14))),
      D('stairs_wood', 1, false, still(a => flight(a, MAT.wood, 109, 'v', 4, 14))),
      /* Seven slices, not fourteen: a 1px riser is swallowed by the outline
         pass and the incline flattens into a plain quadrilateral. 2px reads. */
      D('ramp', 1, false, still(a => flight(a, MAT.dirt, 113, 'v', 7, 14))),
      D('platform', 1, false, still(a => block(a, MAT.stone, 5, 127, 0, 1, 0, 1)))
    ]
  });

  /* ----------------------------------------------------------- iso_props */

  /* Props carry NO ground of their own. Each one is a transparent overlay
     anchored to the centre of the footprint, so a barrel drops onto a stone
     floor, a plank floor or a grass field without stamping a patch of some
     other material under itself. Baking a diamond in would also bake in the
     grain seed, so two adjacent props would repeat the same speckle.

     They stand on the footprint but are not bound by it — a tree canopy may
     overhang, which is correct: in an isometric scene a prop is drawn after
     the tile it occupies and is allowed to spill onto the tiles behind. */

  function trunk(a, h, c, cs) {
    const [x, y] = at(0.5, 0.5, 0);
    a.rect(x - 1, y - h, x + 1, y, c);
    a.rect(x + 1, y - h, x + 1, y, cs);
  }

  const propsSuite = () => ({
    width: 32, height: 32, name: 'Iso Props',
    layers: [{ name: 'prop' }],
    states: [
      D('tree', 1, false, still(a => {
        trunk(a, 9, '#6b4a2a', '#4d3419');
        const [cx, cy] = at(0.5, 0.5, 11);
        R.disc(a, cx, cy - 3, 6, '#3f8a3a', '#5fb050');
        R.disc(a, cx - 4, cy + 1, 4.2, '#367a32', '#4f9b43');
        R.disc(a, cx + 4, cy + 1, 4.2, '#2f6a2b', '#3f8a3a');
        /* Highlight box kept INSIDE the canopy discs. Sized to the bounding
           box it scatters flecks into open air, which read as screen dirt. */
        R.speck(a, cx - 6, cy - 6, cx + 6, cy + 2, 133, ['#6fc05c'], 0.12);
      })),
      D('pine', 1, false, still(a => {
        trunk(a, 6, '#5a3f22', '#3f2b16');
        const [cx, cy] = at(0.5, 0.5, 0);
        /* Snow is painted as a lit top row on each tier rather than scattered
           over the bounding box. Free-floating flecks read as dirt on the
           screen at 32px — snow has to sit ON something to be snow. */
        for (let k = 0; k < 4; k++) {
          const w = 7 - k * 1.6, yy = cy - 7 - k * 4;
          for (let j = 0; j < 5; j++) {
            const x0 = Math.round(cx - w + j * 0.35), x1 = Math.round(cx + w - j * 0.35);
            a.rect(x0, yy + j, x1, yy + j, j < 2 ? '#3d7a56' : '#2b5a3f');
            if (j === 0) a.rect(x0, yy, Math.round(x0 + (x1 - x0) * 0.55), yy, '#e6f2f7');
            if (j === 1) a.px(x0 + 1, yy + 1, '#cfe2ea');
          }
        }
      })),
      D('rock', 1, false, still(a => {
        const [cx, cy] = at(0.5, 0.5, 0);
        R.disc(a, cx, cy - 4, 6, '#7c7e90', '#9fa1b2');
        R.disc(a, cx - 4, cy - 1, 3.6, '#63657a', '#83859a');
        R.speck(a, cx - 5, cy - 7, cx + 5, cy - 2, 143, ['#adafbe', '#54566a'], 0.18);
      })),
      D('barrel', 1, false, still(a => {
        const [cx, cy] = at(0.5, 0.5, 0);
        /* A redder, darker cooperage than MAT.wood, and iron hoops. The first
           draft used MAT.wood's own three tones byte for byte, which meant the
           barrel disappeared the moment it was placed on a plank tile. */
        a.rect(cx - 4, cy - 13, cx + 4, cy - 1, '#7b4726');
        a.rect(cx - 4, cy - 13, cx - 2, cy - 1, '#9a5f33');
        a.rect(cx + 3, cy - 13, cx + 4, cy - 1, '#4f2c14');
        a.rect(cx - 4, cy - 11, cx + 4, cy - 11, '#3f3f4c');
        a.rect(cx - 4, cy - 4, cx + 4, cy - 4, '#3f3f4c');
        /* Elliptical lid. A flat screen-space top edge is the single clearest
           tell that a prop was drawn side-on and dropped into an iso scene. */
        for (let dy = -2; dy <= 2; dy++) {
          const w = Math.round(Math.sqrt(Math.max(0, 1 - (dy / 2.6) ** 2)) * 4.4);
          a.rect(cx - w, cy - 14 + dy, cx + w, cy - 14 + dy, dy < 0 ? '#b3763f' : '#9a5f33');
        }
        a.rect(cx - 2, cy - 16, cx, cy - 16, '#cb9059');
      })),
      D('chest', 1, false, still(a => {
        /* Body, then a lid stacked on it at base=5 and inset by a hair. The
           step between the two is what makes it a chest rather than a crate —
           at this size a lid has to be a separate solid, not a drawn line. */
        block(a, { top: '#6f4a24', right: '#74502a', left: '#513218', spot: ['#7d5730'], density: 0.1 },
          5, 151, 0.2, 0.8, 0.2, 0.8);
        /* Lid on the SAME footprint, a shade lighter. The tone change is the
           seam — an overhanging lid at this size silhouettes as a mushroom. */
        block(a, { top: '#c99a60', right: '#a87a48', left: '#7d5730', spot: ['#b8874f'], density: 0.12 },
          4, 153, 0.2, 0.8, 0.2, 0.8, 5);
        /* The shadow line under the lid. Tone alone did not carry it — at
           32px a chest without a visible seam is a crate with a keyhole. */
        for (const [A, B] of [[[0.8, 0.2], [0.8, 0.8]], [[0.8, 0.8], [0.2, 0.8]]]) {
          const p0 = at(A[0], A[1], 5), p1 = at(B[0], B[1], 5);
          a.line(p0[0], p0[1], p1[0], p1[1], '#3a2310');
        }
        const [cx, cy] = at(0.5, 0.5, 5);
        a.rect(cx - 1, cy - 2, cx + 1, cy + 3, '#efc44f');   // hasp across the join
        a.px(cx, cy + 1, '#5a3d0e');
      })),
      D('lamp', 4, true, cyc(4, 4, (a, i) => {
        const [cx, cy] = at(0.5, 0.5, 0);
        a.rect(cx - 1, cy - 12, cx, cy - 1, '#4a4a58');
        a.rect(cx, cy - 12, cx, cy - 1, '#33333f');
        a.rect(cx - 2, cy - 2, cx + 1, cy - 1, '#3f3f4c');           // foot
        /* A lantern, not a bare bulb: an iron housing with glass inside. The
           unhoused version silhouetted as a lollipop. */
        a.rect(cx - 3, cy - 20, cx + 2, cy - 12, '#3f3f4c');
        /* The glass tints with the flame, and the flame's radius steps through
           four distinct values — a sampled sine repeats at i=0 and i=2, which
           is a stutter to the eye and a static frame to the quality gate. */
        const F = [1.6, 2.4, 1.9, 2.9][i], G = ['#8a5420', '#b06c26', '#9a5f23', '#c47c2b'][i];
        a.rect(cx - 2, cy - 19, cx + 1, cy - 13, G);
        R.disc(a, cx - 0.5, cy - 16, F, '#ffb03a', '#fff0b0');
        a.rect(cx - 4, cy - 21, cx + 3, cy - 20, '#4a4a58');         // cap
        a.rect(cx - 1, cy - 23, cx, cy - 22, '#4a4a58');             // hanger
      })),
      D('bush', 1, false, still(a => {
        const [cx, cy] = at(0.5, 0.5, 0);
        R.disc(a, cx - 3, cy - 3, 3.6, '#367a32', '#4f9b43');
        R.disc(a, cx + 3, cy - 3, 3.6, '#2f6a2b', '#3f8a3a');
        R.disc(a, cx, cy - 6, 4.2, '#3f8a3a', '#5fb050');
        for (const [dx, dy] of [[-3, -5], [3, -6], [0, -2]]) a.px(cx + dx, cy + dy, '#d94f6a');
      })),
      D('crystal', 6, true, cyc(4, 6, (a, i) => {
        const [cx, cy] = at(0.5, 0.5, 0);
        /* Four discrete glow steps rather than a sine: a sampled sine returns
           the same value at i=0 and i=2, which is a frame pair the eye reads as
           a stutter (and the quality gate reads as a static frame). Each shard
           also lights on a different phase, so the cluster shimmers instead of
           blinking as one lamp. */
        const RAMP = ['#8ccfe2', '#9fdcec', '#c6ecf6', '#eafaff'];
        const SH = [[-4, 8, 2], [0, 13, 2], [4, 9, 2]];
        SH.forEach(([ox, h, w], k) => {
          const step = (i + k) % 4;
          a.rect(cx + ox - w, cy - h, cx + ox + w, cy - 1, '#5a95ad');
          a.rect(cx + ox - w, cy - h, cx + ox, cy - 1, RAMP[step]);
          a.px(cx + ox - w + 1, cy - h + 1, '#eafaff');
          /* The sparkle rides the shard's own tip. Scattered over the bounding
             box it separates from the crystal and reads as screen dirt. */
          if (step === 3) { a.px(cx + ox, cy - h - 1, '#eafaff'); a.px(cx + ox - 2, cy - h, '#c6ecf6'); a.px(cx + ox + 2, cy - h, '#c6ecf6'); }
        });
      })),
      D('fence', 1, false, still(a => {
        /* Posts march along the NW edge, so two fence tiles laid side by side
           produce one continuous run rather than a doubled post. */
        for (let k = 0; k <= 3; k++) {
          const [x, y] = at(k / 3, 0.12, 0);
          a.rect(x - 1, y - 9, x, y, '#8a5d2f');
          a.rect(x, y - 9, x, y, '#63421f');
        }
        for (const h of [7, 4]) {
          const p0 = at(0, 0.12, h), p1 = at(1, 0.12, h);
          a.line(p0[0], p0[1], p1[0], p1[1], '#a5743f');
        }
      })),
      D('sign', 1, false, still(a => {
        const [cx, cy] = at(0.5, 0.5, 0);
        a.rect(cx - 1, cy - 10, cx, cy, '#63421f');
        a.rect(cx - 6, cy - 17, cx + 5, cy - 10, '#a5743f');
        a.rect(cx - 6, cy - 17, cx + 5, cy - 15, '#b8874f');
        for (let k = 0; k < 3; k++) a.rect(cx - 4, cy - 14 + k * 2, cx + 3 - k, cy - 14 + k * 2, '#5a3d26');
      }))
    ]
  });

  return { groundSuite, blocksSuite, wallsSuite, stairsSuite, propsSuite, proj, quad, MAT };
})();
