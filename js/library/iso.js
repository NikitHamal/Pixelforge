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
  const D = R.D, draw = R.draw, cyc = R.cyc, seq = R.seq, still = R.still, TAU = R.TAU;

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

  /* ---- contact shadows -------------------------------------------------

     Nothing in this pack cast a shadow, so every figure, prop and building
     floated a few pixels above the tile it was standing on and a built scene
     read as a collage of stickers. One helper fixes the lot: `grounded` walks
     a finished suite and re-wraps every frame's painter with a shadow pass.

     Three things make it work.

     It runs AFTER the painter, which means after rig's outline pass — the
     library's outline traces every non-zero pixel, so a shadow drawn with the
     art earns its own hard black ring around it.

     It only writes into pixels the art left empty, so it can never eat the
     sprite it belongs to.

     And the footprint is measured from the frame's own silhouette rather than
     hand-tuned per prop: widest opaque span, lowest opaque row. A walk cycle's
     shadow then tracks the stride for free, and a new prop gets a correct
     shadow without anybody remembering to add one.

     It is centred ON the contact point and offset down and to the right, away
     from this pack's fixed upper-left sun. Centred exactly under the sprite it
     is entirely hidden by the sprite — which is what a first attempt at this
     produced: a single stray pixel poking out beside a barrel.

     The shape is a DIAMOND. On an isometric tile a round shadow is the single
     clearest tell that something was not drawn in the projection. Alpha 0x4c
     is a soft shadow in PNG and vanishes from GIF, whose encoder cuts
     transparency at 128 — the right answer in both. */
  const SHADOW = PF.Color.hexToU32('#0b0a1a4c');
  const grounded = (suite, o) => {
    const opt = o || {};
    const scale = opt.scale === undefined ? 0.92 : opt.scale;
    const squash = opt.squash === undefined ? 0.46 : opt.squash;
    const dx = opt.dx === undefined ? 2.4 : opt.dx, dy = opt.dy === undefined ? 0.6 : opt.dy;
    for (const st of suite.states) for (const fr of st.frames) {
      const inner = fr.paint;
      fr.paint = (buf, W, H) => {
        inner(buf, W, H);
        let x0 = W, x1 = -1, y1 = -1;
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
          if (!buf[y * W + x]) continue;
          if (x < x0) x0 = x;
          if (x > x1) x1 = x;
          if (y > y1) y1 = y;
        }
        if (x1 < 0) return;
        /* `base` measures the span across the lowest few opaque rows instead
           of the whole silhouette. A figure's shadow has to come from its
           FEET: measured over everything, a drawn sword stretches the
           footprint half a tile sideways and drags its centre out with it, so
           the knight ends up standing on the edge of his own shadow. Props
           want the opposite — a tree measured at its base is a shadow the
           width of the trunk — so they leave this off. */
        if (opt.base) {
          let b0 = W, b1 = -1;
          for (let y = Math.max(0, y1 - opt.base + 1); y <= y1; y++)
            for (let x = 0; x < W; x++) {
              if (!buf[y * W + x]) continue;
              if (x < b0) b0 = x;
              if (x > b1) b1 = x;
            }
          if (b1 >= 0) { x0 = b0; x1 = b1; }
        }
        const rx = Math.max(3, ((x1 - x0 + 1) / 2) * scale), ry = Math.max(1.6, rx * squash);
        const cx = (x0 + x1) / 2 + dx, cy = y1 + dy;
        for (let y = Math.max(0, Math.floor(cy - ry)); y <= Math.min(H - 1, Math.ceil(cy + ry)); y++)
          for (let x = Math.max(0, Math.floor(cx - rx)); x <= Math.min(W - 1, Math.ceil(cx + rx)); x++) {
            if (Math.abs(x - cx) / rx + Math.abs(y - cy) / ry > 1) continue;
            const i = y * W + x;
            if (!buf[i]) buf[i] = SHADOW;
          }
      };
    }
    return suite;
  };

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
    clay: {
      top: '#c9a878', spot: ['#dbbc8c', '#ae8f60'], density: 0.26,
      right: '#ae8f60', rightSpot: ['#bd9d6c'], left: '#856a46', leftSpot: ['#947852']
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

  const propsSuite = () => grounded({
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
  }, { scale: 0.98, squash: 0.46, dx: 2.6, dy: 0.8 });

  /* ==================================================================== */
  /*  Expansion: characters, buildings, terrain features                    */
  /* ==================================================================== */

  /* A flat (grainless) material for hand-coloured volumes. The kit's fixed sun
     is encoded here once — top brightest, lower-right mid, lower-left darkest —
     so a character built from these boxes is lit identically to the tiles it
     stands on. Any pack that derives its own tones instead will drift. */
  const vol = h => ({ top: R.lit(h), right: h, left: R.dim(h) });

  /* ---------------------------------------------------- box characters */

  /* An isometric character is not a side-view sprite on a diamond. It has real
     volume, and the cheapest honest way to get volume on this lattice is to
     build the figure out of the same boxes the blocks are made of: every limb
     is a `block` in tile space, so the character is lit by the same rules, sits
     on the same footprint, and turns by rotating a 2-D facing vector instead of
     needing four hand-drawn sheets.

     u runs lower-right and v lower-left, so the four tile axes are exactly the
     four diagonal screen directions — the natural facings for an iso game. */
  const FACING = { se: [1, 0], sw: [0, 1], nw: [-1, 0], ne: [0, -1] };

  const ISO_HERO = { cloth: '#3e6bd6', trim: '#e8b23a', skin: '#e8b796',
    hair: '#6d3f2a', boot: '#4a3020', metal: '#b8c4d8', pants: '#3a4466', weapon: 'sword' };
  /* Orc palette: dark leather against green hide, with a bone belt. The first
     pass made every slot a brown and the figure read as one mud-coloured lump
     — value separation between neighbouring parts matters more than hue. */
  const ISO_ORC = { cloth: '#5d4326', trim: '#a8823c', skin: '#8fbe57',
    hair: '#41652c', boot: '#2e2116', metal: '#8b8b93', pants: '#33281a', weapon: 'club' };
  const ISO_MAGE = { cloth: '#6b3fa0', trim: '#e8d24a', skin: '#e8b796',
    hair: '#d8d8e0', boot: '#33223a', metal: '#8ef6ff', pants: '#3d2352', weapon: 'staff' };

  /* o: { stride, lift, armF, armB, bob, crouch, swing } — all in tile units
     except bob/crouch/heights, which are screen pixels. */
  function isoPerson(a, dir, pal, o) {
    o = o || {};
    const [fu, fv] = FACING[dir];
    const su = fv, sv = -fu;                       // the character's right
    const st = o.stride || 0, bob = o.bob || 0, cr = o.crouch || 0;
    const M = { cloth: vol(pal.cloth), trim: vol(pal.trim), skin: vol(pal.skin),
      hair: vol(pal.hair), boot: vol(pal.boot), metal: vol(pal.metal),
      sleeve: vol(R.dim(R.dim(pal.cloth))), pants: vol(pal.pants || R.dim(R.dim(pal.cloth))) };

    /* Every part is queued with its depth key rather than drawn immediately.
       Which arm is in front depends on the facing, and hard-coding a draw order
       per direction is four chances to get it wrong; one sort gets it right for
       all four and would still be right for eight. */
    const parts = [];
    const put = (side, fwd, hu, hv, w0, h, m, seed) => {
      const cu = 0.5 + su * side + fu * fwd, cv = 0.5 + sv * side + fv * fwd;
      parts.push({ k: (cu + cv) * 1000 + w0, f: () => block(a, m, h, seed, cu - hu, cu + hu, cv - hv, cv + hv, w0) });
    };
    const lift = o.lift || [0, 0];
    /* Legs are a trouser box with a boot box stacked at its foot rather than
       one brown column: two adjacent same-coloured boxes read as a single
       skirt, and the gap between the knees is most of what sells a stride. */
    for (const [side, ph, sd] of [[-0.105, st, 3], [0.105, -st, 5]]) {
      const b = lift[sd === 3 ? 0 : 1] - cr;
      put(side, ph, 0.062, 0.062, b, 8 - (b + cr), M.pants, sd);
      put(side, ph, 0.066, 0.066, b, 2, M.boot, sd + 30);
    }
    put(0, 0, 0.16, 0.16, 7 - cr + bob, 8, M.cloth, 7);
    // sleeves in the cloth's shadow tone, outboard of the torso, with a bare
    // hand on the end — without the value step the arm is inside the shirt
    for (const [side, fwd, sd] of [[-0.255, (o.armB || 0), 11], [0.255, (o.armF || 0), 13]]) {
      put(side, fwd, 0.062, 0.062, 8.5 - cr + bob, 5, M.sleeve, sd);
      put(side, fwd, 0.055, 0.055, 7 - cr + bob, 1.5, M.skin, sd + 40);
    }
    put(0, 0.015, 0.115, 0.115, 14 - cr + bob, 5, M.hair, 17);
    parts.sort((x, y) => x.k - y.k).forEach(p => p.f());

    // belt and collar read as a costume rather than a painted stripe
    const beltW = 9 - cr + bob, beltH = 1.3;
    quad(a, [proj(0.34, 0.66, beltW), proj(0.66, 0.66, beltW), proj(0.66, 0.66, beltW - beltH), proj(0.34, 0.66, beltW - beltH)], pal.trim);
    quad(a, [proj(0.66, 0.34, beltW), proj(0.66, 0.66, beltW), proj(0.66, 0.66, beltW - beltH), proj(0.66, 0.34, beltW - beltH)], pal.trim);

    /* The whole skull is hair; the FACE is a patch painted onto whichever
       vertical plane points at the camera. A cap-shaped hair block does not
       work here — block() always draws the same two side faces, so a cap that
       is narrow enough to leave a face also leaves a bald patch on the back.
       Painting the face last, only for the two toward-camera facings, gives
       the back of the head for free: no extra art, no extra states. */
    const hw = 19 - cr + bob, hb = hw - 5, FP = 0.63;
    const front = fu > 0 ? 'u' : fv > 0 ? 'v' : null;
    if (front) {
      // skin from the brow down; the hair block keeps the top of the plane
      const fq = (k0, k1, w0, w1, c) => quad(a, front === 'u'
        ? [proj(FP, 0.5 + k0, w1), proj(FP, 0.5 + k1, w1), proj(FP, 0.5 + k1, w0), proj(FP, 0.5 + k0, w0)]
        : [proj(0.5 + k0, FP, w1), proj(0.5 + k1, FP, w1), proj(0.5 + k1, FP, w0), proj(0.5 + k0, FP, w0)], c);
      /* Both facings get the same bright skin value. The physically correct
         darker tone for the v plane lands within a hair of the lit hair brown,
         and the face vanishes — readability beats the lighting model here. */
      fq(-0.115, 0.115, hb + 0.3, hw - 1.6, pal.skin);
      fq(-0.10, -0.035, hw - 2.6, hw - 1.8, '#181425');
      fq(0.035, 0.10, hw - 2.6, hw - 1.8, '#181425');
      fq(-0.04, 0.04, hb + 0.4, hb + 1.1, R.dim(pal.skin));
    }

    if (o.hand) o.hand(a, (side, fwd, w) => at(0.5 + su * side + fu * fwd, 0.5 + sv * side + fv * fwd, w), 8 - cr + bob);
  }

  /* The held weapon is a hook rather than a branch inside the painter, so one
     figure serves a swordsman, an orc with a club and a staff mage. */
  const isoWeapon = (pal) => (a, P, w) => {
    /* Held LOW and forward, not raised. On this lattice a raised weapon points
       up-screen for the two away-facing directions, and at 32px that runs the
       tip off the top of the canvas where the outline pass cannot close around
       it. A blade at the ready by the hip reads better anyway. */
    /* Only the material is painted here — draw()'s finish pass wraps whatever
       this leaves behind in 1px of #181425. Drawing our own dark line as well
       is what turned the blade into a black bar at 32px. */
    if (pal.weapon === 'sword') {
      const pom = P(0.26, 0.00, w + 3), grip = P(0.27, 0.11, w + 1), tip = P(0.29, 0.42, w - 3);
      const xg0 = P(0.19, 0.10, w + 1), xg1 = P(0.35, 0.14, w + 1);
      a.line(pom[0], pom[1], grip[0], grip[1], '#4a3020', 1);  // wrapped grip
      a.px(pom[0], pom[1], pal.trim);                          // pommel
      a.line(xg0[0], xg0[1], xg1[0], xg1[1], pal.trim, 1);     // crossguard
      a.line(grip[0], grip[1], tip[0], tip[1], pal.metal, 2);
      a.px(tip[0], tip[1], '#ffffff');
    } else if (pal.weapon === 'club') {
      const grip = P(0.26, 0.02, w + 2), tip = P(0.30, 0.38, w - 3);
      a.line(grip[0], grip[1], tip[0], tip[1], '#3b2a17', 2);   // dark haft
      R.disc(a, tip[0], tip[1], 3.0, '#6b6b75', '#9aa0ad');     // stone head
      for (const [dx, dy] of [[-2, -1], [2, 0], [0, 2], [-1, 2]])
        a.px(tip[0] + dx, tip[1] + dy, '#e8dcc0');              // bone studs
    } else {
      const grip = P(0.27, 0.10, w - 6), tip = P(0.27, 0.10, w + 6);
      a.line(grip[0], grip[1], tip[0], tip[1], '#5c3a18', 1);
      R.disc(a, tip[0], tip[1], 2.2, pal.metal, '#ffffff');
    }
  };

  function charSuite(pal, label) {
    const states = [];
    const hand = isoWeapon(pal);
    for (const dir of ['se', 'sw', 'nw', 'ne']) {
      states.push(D('idle_' + dir, 5, true, cyc(4, 5, (a, i) =>
        isoPerson(a, dir, pal, { bob: [0, 1, 1, 0][i], crouch: [0, 0, 1, 1][i], hand }))));
      /* Eight beats: stride on a sine, arms counter-swinging, and one pixel of
         body bob on the two passing frames. The legs are boxes, so the lift has
         to shorten the leg as well as raise it or the foot punches through the
         floor — hence the paired [base, height] in `lift`. */
      states.push(D('walk_' + dir, 10, true, cyc(8, 10, (a, i) => {
        const p = (i / 8) * TAU, sn = Math.sin(p);
        isoPerson(a, dir, pal, {
          stride: sn * 0.13, armF: -sn * 0.10, armB: sn * 0.10,
          lift: [Math.max(0, Math.round(Math.cos(p) * 2)), Math.max(0, Math.round(-Math.cos(p) * 2))],
          bob: Math.abs(Math.round(Math.cos(p))), hand });
      })));
    }
    /* The swing ROTATES the weapon in the body's (side, forward) plane rather
       than sliding it forward: a translated blade stays parallel to itself and
       reads as a lunge, not a cut. Six frames — two of wind-up, the impact,
       three of recovery — because four cannot show both anticipation and
       follow-through and the arc is the whole point of the pose. */
    const ANG = [-0.35, -0.85, 0.55, 0.85, 0.45, 0.05];
    for (const dir of ['se', 'sw', 'nw', 'ne']) {
      states.push(D('attack_' + dir, 14, false, seq(6, 14, (a, i) => {
        const ang = ANG[i];
        isoPerson(a, dir, pal, {
          stride: [-0.06, -0.12, 0.14, 0.10, 0.04, 0][i],
          armF: ang * 0.28, armB: -ang * 0.16,
          crouch: [0, 1, 0, 0, 0, 0][i], bob: [0, 0, 1, 1, 0, 0][i],
          hand: (b, P, w) => {
            const rot = (side, fwd, ww) => {
              const c = Math.cos(ang), sn = Math.sin(ang);
              return P(side * c - fwd * sn, side * sn + fwd * c, ww);
            };
            // the arc trails the tip through the angles it has just left
            if (pal.weapon !== 'staff' && i >= 2 && i <= 4) for (let d = 0.14; d < 0.80; d += 0.085) {
              const aa = ang - d, c = Math.cos(aa), sn = Math.sin(aa);
              const q = P(0.29 * c - 0.44 * sn, 0.29 * sn + 0.44 * c, w - 2 + d * 3);
              b.px(q[0], q[1], d < 0.34 ? '#ffffff' : d < 0.55 ? '#c0cbdc' : '#7a89a8');
            }
            hand(b, rot, w + (i === 1 ? 2 : 0));
            /* A caster releases rather than swings: the orb charges over the
               wind-up and throws a bolt along the facing on the impact frames. */
            if (pal.weapon === 'staff') {
              const o = rot(0.27, 0.10, w + 6);
              R.disc(b, o[0], o[1], 2 + [0, 1, 2, 1, 0, 0][i], pal.metal, '#ffffff');
              if (i >= 2 && i <= 4) for (let k = 0; k < 5; k++) {
                const q = P(0.20 + k * 0.03, 0.42 + k * 0.16 + (i - 2) * 0.22, w + 5 - k);
                b.px(q[0], q[1], k < 2 ? '#ffffff' : pal.metal);
              }
            }
          } });
      })));
    }
    states.push(D('hurt', 12, false, seq(3, 12, (a, i) =>
      isoPerson(a, 'se', pal, { stride: [-0.10, 0.05, 0][i], crouch: [2, 0, 0][i],
        armF: [-0.14, 0.06, 0][i], armB: [0.14, -0.06, 0][i], hand: isoWeapon(pal) }))));
    states.push(D('death', 9, false, seq(4, 9, (a, i) => {
      if (i === 0) { isoPerson(a, 'se', pal, { crouch: 3, armF: -0.16, armB: 0.16 }); return; }
      /* Collapsing along the u axis: the body flattens into a low slab on the
         tile rather than tipping over, which is the only fall that stays inside
         a single iso footprint. */
      /* Head at one end, boots at the other, torso between — the first pass
         spread one slab across the whole tile and the corpse read as a plank. */
      const g = [0, 0.45, 0.8, 1][i], h = Math.max(3, Math.round(9 * (1 - g)));
      block(a, vol(pal.boot), Math.max(2, h - 2), 23, 0.14, 0.30, 0.40, 0.60, 0);
      block(a, vol(pal.pants || pal.cloth), Math.max(2, h - 1), 5, 0.28, 0.48, 0.36, 0.64, 0);
      block(a, vol(pal.cloth), h, 7, 0.46, 0.72, 0.33, 0.67, 0);
      block(a, vol(pal.hair), Math.max(3, h), 17, 0.72, 0.90, 0.40, 0.60, 0);
      /* The pool spreading is the only motion left once the body has settled —
         without it the last two frames are pixel-identical and the gate calls
         the state static, which it would be. */
      const n = Math.round(g * 22);
      for (let k = 0; k < n; k++) {
        const q = at(0.14 + k * 0.035, 0.70 + (k % 4) * 0.055, 0);
        a.px(q[0], q[1], k % 3 ? '#8f1425' : '#6a0f1e');
      }
      if (i === 3) for (let k = 0; k < 6; k++) {
        const q = at(0.10 + k * 0.14, 0.94, 0);
        a.px(q[0], q[1], '#5a0c18');
      }
    })));
    /* A figure occupies rather less of its tile than a building does, so the
       footprint is pulled in and flattened — a person standing in the middle
       of a full-tile diamond reads as standing in a puddle. */
    return grounded({ width: 32, height: 32, name: label, layers: [{ name: 'Figure' }], states },
      { scale: 1.55, squash: 0.44, dx: 2.0, dy: 0.6, base: 6 });
  }

  /* ------------------------------------------------------- buildings */

  /* Buildings need headroom a 32px canvas does not have: one tile of elevation
     is 16 rows, and a cottage with a roof is three. The canvas grows to 32x48
     and every painter runs through an api translated down by 16, so `proj` and
     every primitive above keep working unchanged and the footprint still lands
     on the same diamond as a ground tile. */
  const TALL = 48;
  const tall = paint => (a, i, t) => paint(PF.Pixel.offsetApi(a, 0, TALL - 32), i, t);

  /* A gable roof: two slopes meeting at a ridge along the v axis, plus the
     triangular end wall you can see from the lower left. Drawn end-wall first
     so the slopes win the shared eave line — a roof sits ON its gable. */
  const gable = (a, w, rh, m) => {
    quad(a, [proj(0, 1, w), proj(0.5, 1, w + rh), proj(1, 1, w)], m.left);
    quad(a, [proj(0, 0, w), proj(0.5, 0, w + rh), proj(0.5, 1, w + rh), proj(0, 1, w)], m.top);
    quad(a, [proj(0.5, 0, w + rh), proj(1, 0, w), proj(1, 1, w), proj(0.5, 1, w + rh)], m.right);
    // ridge cap, one pixel of light along the spine
    const r0 = at(0.5, 0, w + rh), r1 = at(0.5, 1, w + rh);
    a.line(r0[0], r0[1], r1[0], r1[1], R.lit(m.top));
  };
  const ROOF = { top: '#b25441', right: '#8d3c2c', left: '#6f2f24' };
  const THATCH = { top: '#c9a24a', right: '#9e7b32', left: '#74591f' };

  /* A door or window punched into one visible face, as a quad in tile space so
     it foreshortens with the wall instead of sitting on it as a flat rect. */
  const pierce = (a, side, k0, k1, w0, w1, c, sill) => {
    const P = side === 'right' ? (k, w) => proj(1, k, w) : (k, w) => proj(k, 1, w);
    quad(a, [P(k0, w1), P(k1, w1), P(k1, w0), P(k0, w0)], c);
    if (sill) quad(a, [P(k0, w0), P(k1, w0), P(k1, w0 - 1), P(k0, w0 - 1)], sill);
  };

  function buildingSuite() {
    const S = [];
    const B = (name, fps, loop, frames) => S.push(D(name, fps, loop, frames));

    B('cottage', 1, false, still(tall(a => {
      block(a, MAT.stone, 5, 31);
      block(a, MAT.wood, 9, 37, 0, 1, 0, 1, 5);
      pierce(a, 'right', 0.32, 0.68, 5, 12, '#3a2410', '#8a5f38');     // door
      pierce(a, 'left', 0.18, 0.40, 8, 12, '#2ce8f5', '#6d431e');      // window
      pierce(a, 'left', 0.60, 0.82, 8, 12, '#2ce8f5', '#6d431e');
      gable(a, 14, 12, ROOF);
      const c = at(0.5, 0.18, 26); a.rect(c[0] - 1, c[1] - 5, c[0] + 1, c[1], '#6f2f24');
      a.rect(c[0] - 1, c[1] - 5, c[0] + 1, c[1] - 5, '#8d8f9e');        // chimney
    })));
    B('thatched hut', 1, false, still(tall(a => {
      block(a, MAT.dirt, 2, 41);
      block(a, MAT.clay, 9, 43, 0.10, 0.90, 0.10, 0.90, 2);
      pierce(a, 'right', 0.34, 0.66, 2, 9, '#3a2410');
      /* The thatch OVERHANGS the daub walls. Matched to the wall footprint the
         cone and the walls share a silhouette and the whole hut reads as one
         gold pyramid; a 0.09-tile eave is what makes it a roof on a house. */
      const E = -0.09, F = 1.09;
      for (const q of [[[E, E], [F, E]], [[E, E], [E, F]], [[F, E], [F, F]], [[E, F], [F, F]]]) {
        const col = q[0][0] === F || q[1][0] === F ? (q[0][1] === F && q[1][1] === F ? THATCH.left : THATCH.right)
          : (q[0][1] === F && q[1][1] === F ? THATCH.left : THATCH.top);
        quad(a, [proj(q[0][0], q[0][1], 10), proj(q[1][0], q[1][1], 10), proj(0.5, 0.5, 25)], col);
      }
      for (let k = E; k <= F; k += 0.13) {                              // thatch combing
        const p0 = at(k, F, 10), p1 = at(0.5, 0.5, 25);
        a.line(p0[0], p0[1], p1[0], p1[1], '#5c4318');
        const p2 = at(F, k, 10);
        a.line(p2[0], p2[1], p1[0], p1[1], '#6b5020');
      }
    })));
    B('watchtower', 1, false, still(tall(a => {
      block(a, MAT.stone, 22, 47, 0.14, 0.86, 0.14, 0.86);
      for (const w of [8, 15]) {                                        // string courses
        quad(a, [proj(0.86, 0.14, w), proj(0.86, 0.86, w), proj(0.86, 0.86, w - 1), proj(0.86, 0.14, w - 1)], '#555768');
        quad(a, [proj(0.14, 0.86, w), proj(0.86, 0.86, w), proj(0.86, 0.86, w - 1), proj(0.14, 0.86, w - 1)], '#3f4152');
      }
      pierce(a, 'right', 0.42, 0.58, 4, 9, '#181425');
      block(a, MAT.stone, 3, 53, 0.04, 0.96, 0.04, 0.96, 22);           // corbelled top
      for (let k = 0.04; k < 0.9; k += 0.24)                            // merlons
        block(a, MAT.stone, 4, 59, k, k + 0.14, 0.04, 0.18, 25);
      for (let k = 0.04; k < 0.9; k += 0.24)
        block(a, MAT.stone, 4, 61, 0.04, 0.18, k, k + 0.14, 25);
      const f = at(0.5, 0.5, 29); a.rect(f[0], f[1] - 12, f[0], f[1], '#5c3a18');
      a.rect(f[0] + 1, f[1] - 12, f[0] + 6, f[1] - 8, '#e43b44');       // banner
      a.rect(f[0] + 1, f[1] - 12, f[0] + 6, f[1] - 12, '#f6757a');
    })));
    B('market stall', 1, false, still(tall(a => {
      for (const [u, v] of [[0.08, 0.08], [0.84, 0.08], [0.08, 0.84], [0.84, 0.84]])
        block(a, MAT.wood, 13, 67, u, u + 0.08, v, v + 0.08, 0);
      block(a, MAT.wood, 3, 71, 0.06, 0.94, 0.06, 0.94, 5);             // counter
      gable(a, 13, 7, { top: '#e8434b', right: '#b52f39', left: '#8a1f2a' });
      for (let k = 0.08; k < 0.9; k += 0.18) {                          // awning stripes
        const p0 = at(0.5, k, 20), p1 = at(0, k, 13);
        a.line(p0[0], p0[1], p1[0], p1[1], '#f4f4f4');
      }
      for (const [u, v, c] of [[0.2, 0.3, '#e8b23a'], [0.45, 0.25, '#e43b44'], [0.3, 0.6, '#63c74d'], [0.6, 0.5, '#f77622']]) {
        const q = at(u, v, 8); R.disc(a, q[0], q[1], 1.8, c, R.lit(c));
      }
    })));
    B('well', 4, true, cyc(4, 4, tall((a, i) => {
      block(a, MAT.stone, 5, 73, 0.12, 0.88, 0.12, 0.88);
      quad(a, [proj(0.24, 0.24, 5), proj(0.76, 0.24, 5), proj(0.76, 0.76, 5), proj(0.24, 0.76, 5)], '#1f4574');
      for (const [u, v] of [[0.14, 0.44], [0.78, 0.44]])
        block(a, MAT.wood, 12, 77, u, u + 0.08, v, v + 0.12, 5);
      gable(a, 17, 6, ROOF);
      // the bucket rides up and down the rope; that IS the animation
      const drop = [0, 2, 4, 2][i];
      const b0 = at(0.5, 0.5, 15), b1 = at(0.5, 0.5, 11 - drop);
      a.line(b0[0], b0[1], b1[0], b1[1], '#3a2410');
      R.disc(a, b1[0], b1[1], 2.2, '#8a5f38', '#a8794a');               // bucket
      a.px(b1[0] - 2, b1[1] - 1, '#a8794a');
    })));
    B('fountain', 6, true, cyc(6, 6, tall((a, i) => {
      block(a, MAT.stone, 4, 79, 0.02, 0.98, 0.02, 0.98);
      quad(a, [proj(0.12, 0.12, 4), proj(0.88, 0.12, 4), proj(0.88, 0.88, 4), proj(0.12, 0.88, 4)],
        face(a, MAT.water, 'top', 83));
      block(a, MAT.stone, 9, 85, 0.40, 0.60, 0.40, 0.60, 4);
      const t = at(0.5, 0.5, 13);
      R.disc(a, t[0], t[1], 2.6, '#8d8f9e', '#a4a6b4');
      // four arcs of water, phase-stepped so the jet reads as continuous
      for (let k = 0; k < 4; k++) {
        const ang = k * TAU / 4 + 0.4;
        for (let j = 1; j <= 5; j++) {
          const s2 = (j + i * 0.5) * 0.9, hgt = 6 - Math.pow(j + i * 0.5 - 2.6, 2) * 0.7;
          const q = at(0.5 + Math.cos(ang) * s2 * 0.07, 0.5 + Math.sin(ang) * s2 * 0.07, 14 + hgt);
          a.px(q[0], q[1], (j + i) % 2 ? '#8ef6ff' : '#2ce8f5');
        }
      }
      for (let k = 0; k < 10; k++) {                                    // surface ripples
        const q = at(0.16 + ((k * 7 + i) % 9) * 0.08, 0.16 + ((k * 5 + i * 2) % 9) * 0.08, 4);
        a.px(q[0], q[1], '#59a0dc');
      }
    })));
    B('windmill', 8, true, cyc(8, 8, tall((a, i) => {
      block(a, MAT.stone, 16, 89, 0.20, 0.80, 0.20, 0.80);
      block(a, MAT.wood, 4, 91, 0.16, 0.84, 0.16, 0.84, 16);
      gable(a, 20, 8, ROOF);
      pierce(a, 'right', 0.42, 0.58, 0, 6, '#3a2410');
      const hub = at(0.80, 0.44, 22);
      for (let k = 0; k < 4; k++) {
        const ang = (i / 8) * (TAU / 4) + k * TAU / 4;                  // sail angle
        const ex = hub[0] + Math.cos(ang) * 11, ey = hub[1] + Math.sin(ang) * 11;
        a.line(hub[0], hub[1], ex, ey, '#3a2410', 3);
        a.line(hub[0], hub[1], ex, ey, '#c9a24a', 1);
      }
      R.disc(a, hub[0], hub[1], 2.0, '#555768', '#8d8f9e');
    })));
    /* A building fills its tile, so the shadow is the tile diamond itself
       rather than a silhouette-derived one — a roof overhangs the walls and
       measuring the roof would throw the shadow out past the foundations. */
    return grounded({ width: 32, height: TALL, name: 'iso buildings', layers: [{ name: 'Building' }], states: S },
      { scale: 0.95, squash: 0.50, dx: 2.8, dy: 0.6 });
  }

  /* -------------------------------------------------- terrain features */

  function natureSuite() {
    const S = [];
    const N = (name, fps, loop, frames) => S.push(D(name, fps, loop, frames));
    N('cliff', 1, false, still(a => {
      block(a, MAT.stone, 14, 101);
      for (const side of ['right', 'left'])                             // strata
        for (const w of [4, 8, 11]) faceBand(a, side, w, 1, side === 'right' ? '#63657a' : '#484a5c');
      topFace(a, MAT.grass, 14, 103);
      for (let k = 0; k <= 1; k += 0.1) {                               // turf lip fraying
        const p = at(1, k, 14); a.px(p[0], p[1] + 1, '#3d7a34');
        const q = at(k, 1, 14); a.px(q[0], q[1] + 1, '#2f5f28');
      }
    }));
    N('cliff corner', 1, false, still(a => {
      block(a, MAT.stone, 14, 107, 0, 1, 0, 0.5);
      block(a, MAT.stone, 14, 109, 0, 0.5, 0.5, 1);
      quad(a, [proj(0, 0, 14), proj(1, 0, 14), proj(1, 0.5, 14), proj(0.5, 0.5, 14), proj(0.5, 1, 14), proj(0, 1, 14)],
        face(a, MAT.grass, 'top', 111));
      quad(a, [proj(0.5, 0.5, 0), proj(0.5, 1, 0), proj(0.5, 1, 14), proj(0.5, 0.5, 14)], '#555768');
    }));
    N('waterfall', 6, true, cyc(6, 6, (a, i) => {
      block(a, MAT.stone, 14, 113, 0, 1, 0, 0.34);
      quad(a, [proj(0, 0.34, 0), proj(1, 0.34, 0), proj(1, 0.34, 14), proj(0, 0.34, 14)], '#3f4152');
      // the fall itself: vertical streaks marching downward one row per frame
      for (let k = 0.06; k < 0.95; k += 0.07) {
        for (let w = 14; w > 0; w--) {
          const p = at(k, 0.34, w);
          const phase = (w + i * 2 + Math.floor(k * 37)) % 6;
          a.px(p[0], p[1], phase < 2 ? '#ffffff' : phase < 4 ? '#8ef6ff' : '#3c7fc4');
        }
      }
      quad(a, [proj(0, 0.34, 0), proj(1, 0.34, 0), proj(1, 1, 0), proj(0, 1, 0)], face(a, MAT.water, 'top', 117 + i));
      for (let k = 0; k < 9; k++) {                                     // plunge-pool foam
        const p = at(0.1 + k * 0.1, 0.42 + ((k + i) % 3) * 0.05, 0);
        a.px(p[0], p[1], (k + i) % 2 ? '#ffffff' : '#8ef6ff');
      }
    }));
    N('shore', 4, true, cyc(4, 4, (a, i) => {
      block(a, MAT.sand, 3, 119, 0, 0.5, 0, 1);
      quad(a, [proj(0.5, 0, 1), proj(1, 0, 1), proj(1, 1, 1), proj(0.5, 1, 1)], face(a, MAT.water, 'top', 121 + i));
      for (let k = 0; k <= 1; k += 0.08) {                              // surf line, sliding
        const p = at(0.5 + ((k * 13 + i) % 4) * 0.02, k, 1 + (k * 7 + i) % 2);
        a.px(p[0], p[1], '#e8f0f8');
      }
      quad(a, [proj(0.5, 0, 3), proj(0.5, 1, 3), proj(0.5, 1, 1), proj(0.5, 0, 1)], '#c2a46c');
    }));
    N('pine', 4, true, cyc(4, 4, (a, i) => {
      const sw = [0, 1, 0, -1][i] * 0.05, ph = [0, 1, 2, 1][i];
      block(a, MAT.dirt, 2, 123, 0.34, 0.66, 0.34, 0.66);
      const t = at(0.5, 0.5, 2); a.rect(t[0] - 1, t[1] - 7, t[0] + 1, t[1], '#5c3a18');
      for (const [w, r] of [[5, 0.40], [11, 0.32], [16, 0.24], [21, 0.14]]) {
        const c = at(0.5 + sw, 0.5 + sw, w);
        for (let dy = -4; dy <= 2; dy++) {
          const half = Math.round((r * 15.5) * (1 - (dy + 4) / 9));
          if (half < 1) continue;
          a.rect(c[0] - half * 2, c[1] + dy, c[0] + half * 2, c[1] + dy, dy < -1 ? '#3d7a34' : '#245c2a');
        }
      }
      const cap = at(0.5 + sw, 0.5 + sw, 25);
      a.rect(cap[0] - 1, cap[1] - 2, cap[0] + 1, cap[1], '#4f9b43');
      // needles catching the light: the sway alone repeats every two frames,
      // so the shimmer is what keeps all four distinct
      for (let k = 0; k < 9; k++) {
        const q = at(0.5 + sw, 0.5 + sw, 6 + ((k * 5 + ph * 3) % 17));
        a.px(q[0] + ((k * 7 + ph) % 11) - 5, q[1], '#67b857');
      }
    }));
    N('crystal', 6, true, cyc(6, 6, (a, i) => {
      block(a, MAT.stone, 3, 127, 0.22, 0.78, 0.22, 0.78);
      const glow = ['#8ef6ff', '#2ce8f5', '#8ef6ff', '#c8fbff', '#8ef6ff', '#2ce8f5'][i];
      for (const [u, v, h, wd] of [[0.5, 0.5, 20, 0.10], [0.33, 0.58, 12, 0.07], [0.64, 0.40, 9, 0.06]]) {
        const b = at(u, v, 3), t = at(u, v, 3 + h);
        for (let dy = 0; dy <= b[1] - t[1]; dy++) {
          const k = dy / Math.max(1, b[1] - t[1]);
          const half = Math.max(0, Math.round(wd * 15.5 * (1 - k * 0.15) * k));
          a.rect(b[0] - half, b[1] - dy, b[0] + half, b[1] - dy, k > 0.7 ? glow : '#2a7fa8');
          a.px(b[0] - half, b[1] - dy, '#c8fbff');
        }
      }
      for (let k = 0; k < 4; k++) {                                     // motes
        const p = at(0.3 + ((k * 5 + i) % 5) * 0.1, 0.3 + ((k * 3 + i) % 5) * 0.1, 8 + ((k * 7 + i * 3) % 14));
        a.px(p[0], p[1], glow);
      }
    }));
    N('lava flow', 6, true, cyc(6, 6, (a, i) => {
      block(a, MAT.stone, 4, 131, 0, 1, 0, 1);
      quad(a, [proj(0.12, 0, 4), proj(0.52, 0, 4), proj(0.88, 1, 4), proj(0.48, 1, 4)], (x, y) => {
        const h = a.hash(x, y + i * 3, 137);
        return h < 0.16 ? '#ffb03a' : h < 0.45 ? '#ff8a33' : '#e8622b';
      });
      for (let k = 0; k <= 1; k += 0.1) {                               // crust cracks
        const p = at(0.14 + k * 0.36, k, 4);
        a.px(p[0], p[1] - 1, '#6f1d10');
      }
      for (let k = 0; k < 5; k++) {                                     // embers
        const p = at(0.2 + ((k * 7 + i) % 6) * 0.08, ((k * 5 + i * 2) % 9) * 0.11, 5 + ((k + i) % 6));
        a.px(p[0], p[1], (k + i) % 2 ? '#ffb03a' : '#fee761');
      }
    }));
    N('log bridge', 1, false, still(a => {
      quad(a, [proj(0, 0, 0), proj(1, 0, 0), proj(1, 1, 0), proj(0, 1, 0)], face(a, MAT.water, 'top', 139));
      for (const v of [0.26, 0.56]) block(a, MAT.wood, 4, 141, -0.02, 1.02, v, v + 0.18, 2);
      for (let k = 0; k <= 1; k += 0.11) {                              // plank seams
        const p0 = at(k, 0.26, 6), p1 = at(k, 0.74, 6);
        a.line(p0[0], p0[1], p1[0], p1[1], '#63421f');
      }
    }));
    return { width: 32, height: 32, name: 'iso nature', layers: [{ name: 'Terrain' }], states: S };
  }

  return { groundSuite, blocksSuite, wallsSuite, stairsSuite, propsSuite,
    charSuite, buildingSuite, natureSuite, ISO_HERO, ISO_ORC, ISO_MAGE,
    proj, quad, block, vol, MAT };
})();
