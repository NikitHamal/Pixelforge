/* PixelForge Studio — Hearthhold settlement pack.

   The overhead village kit: terrain, dwellings, workplaces, defences, resource
   nodes and construction scaffolds, all drawn for a camera that looks almost
   straight down.

   The governing decision is the viewing angle. Every other building pack in
   this library is an elevation — you see a facade, a door and a window, and
   the roof is a hat on top. That reads correctly beside a 3/4 character but
   sits wrong on a tile grid seen from above, where a building has to occupy a
   footprint rather than stand in front of one. So here the roof takes the top
   two thirds of the cell and the wall is a narrow band underneath it with the
   doorway cut in: enough facade to say "the entrance is on this side", not so
   much that the building tips up into elevation.

   Walls are connection-mask sheets rather than single tiles. A palisade only
   reads as a palisade when its corners actually turn, and sixteen pieces
   indexed by a four-bit neighbour mask is the cheapest thing that does that.
   maskSuite() is shared: timber and stone differ by palette and cap shape
   only, so the geometry lives in one place and cannot drift apart. */
window.PF = window.PF || {};
PF.Hold = (() => {
  const P = () => PF.Pixel;
  const R = () => PF.Rig;
  const D = (name, fps, loop, frames) => ({ name, fps, loop, frames });
  const still = p => R().still(p);
  const cyc = (n, fps, make) => R().cyc(n, fps, make);
  const speck = (...a) => R().speck(...a);
  const disc = (...a) => R().disc(...a);

  /* Sampled off the reference footage and then lifted: the game tints the
     whole scene for time of day, so the art has to start brighter than the
     screenshot or noon looks like dusk. */
  const GRASS = '#5f8a3c', GRASS_HI = '#7cab52', GRASS_D = '#47692c', GRASS_DD = '#375421';
  const ROAD = '#a97250', ROAD_HI = '#c08a64', ROAD_D = '#855438';
  const SOIL = '#6b4a2e', SOIL_HI = '#86603d', SOIL_D = '#4c331e';
  const WOOD = '#7a4c2e', WOOD_HI = '#9c6a44', WOOD_D = '#4e2f1c', WOOD_DD = '#33200f';
  const ROOF = '#c2701f', ROOF_HI = '#e0913a', ROOF_D = '#8a3f26';
  const TEAL = '#4f8d95', TEAL_HI = '#79b3b8', TEAL_D = '#2f5a66';
  const STONE = '#8a8f9a', STONE_HI = '#b3b8c2', STONE_D = '#5c616b', STONE_DD = '#3e434c';
  const THATCH = '#c9a24a', THATCH_HI = '#e8c878', THATCH_D = '#8f6c28';
  const TENT = '#d8c9a8', TENT_HI = '#f0e6cd', TENT_D = '#a08f70';
  const DARK = '#241a16';                     // doorways and window holes
  const LEAF = '#4f8f3a', LEAF_HI = '#7bc255', LEAF_D = '#356424';

  /* ================================================================ TERRAIN */

  /* Grass is three greens on coprime periods rather than hashed noise. Hashed
     grass sparkles when the camera pans because every tile is a different
     random field; a fixed pattern tiles into a calm meadow. */
  function grassField(c, seed) {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++)
      c.px(x, y, ((x * 5 + y * 3) % 11) === 0 ? GRASS_D : ((x + y * 2) % 7) === 0 ? GRASS_HI : GRASS);
    speck(c, 0, 0, 15, 15, seed, [GRASS_HI, GRASS_D], 0.10);
  }

  function dirtField(c, base, hi, lo, seed) {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++)
      c.px(x, y, ((x + y) % 7) === 0 ? hi : ((x * 3 + y) % 5) === 0 ? lo : base);
    speck(c, 0, 0, 15, 15, seed, [hi, lo], 0.28);
  }

  function groundSuite() {
    const cell = (a, cx, cy) => P().offsetApi(a, cx * 16, cy * 16);
    return {
      width: 64, height: 64, name: 'Hold Ground', layers: [{ name: 'tiles' }],
      states: [D('sheet', 1, false, still(a => {
        // --- row 0: meadow and road ----------------------------------------
        grassField(cell(a, 0, 0), 3);

        const tuft = cell(a, 1, 0);                        // grass with blades
        grassField(tuft, 5);
        for (let k = 0; k < 9; k++) {
          const x = Math.floor(tuft.hash(k, 2, 17) * 15), y = 13 - Math.floor(tuft.hash(k, 3, 17) * 8);
          tuft.px(x, y, GRASS_HI); tuft.px(x, y - 1, GRASS_HI); tuft.px(x, y - 2, '#a8de84');
        }

        const bloom = cell(a, 2, 0);                       // flowering meadow
        grassField(bloom, 7);
        for (let k = 0; k < 5; k++) {
          const x = (k % 3) * 5 + 2 + Math.floor(bloom.hash(k, 7, 4) * 3);
          const y = Math.floor(k / 3) * 7 + 4 + Math.floor(bloom.hash(k, 8, 4) * 3);
          const c = ['#d9536a', '#e8c878', '#c8a8e0'][k % 3];
          bloom.px(x, y, c); bloom.px(x, y - 1, '#f2f0e4'); bloom.px(x, y + 1, GRASS_D);
        }

        dirtField(cell(a, 3, 0), ROAD, ROAD_HI, ROAD_D, 11);

        // --- row 1: worked ground -------------------------------------------
        const worn = cell(a, 0, 1);                        // rutted cart track
        dirtField(worn, ROAD, ROAD_HI, ROAD_D, 13);
        for (const x of [4, 11]) for (let y = 0; y < 16; y++)
          worn.px(x, y, (y % 5) === 2 ? ROAD : ROAD_D);

        /* Furrows run the full width on a 4px period so the tile butts against
           its own copy with no seam at the join. */
        const till = cell(a, 1, 1);
        for (let y = 0; y < 16; y++) {
          const p = y % 4;
          for (let x = 0; x < 16; x++)
            till.px(x, y, p === 0 ? SOIL_D : p === 1 ? SOIL_HI : p === 3 ? '#5a3f26' : SOIL);
        }
        speck(till, 0, 0, 15, 15, 5, [SOIL_D, SOIL_HI], 0.14);

        const wet = cell(a, 2, 1);                         // watered furrows
        for (let y = 0; y < 16; y++) {
          const p = y % 4;
          for (let x = 0; x < 16; x++)
            wet.px(x, y, p === 0 ? '#3a2718' : p === 1 ? '#6b4a2c' : p === 3 ? '#42301d' : '#523a22');
        }
        for (let k = 0; k < 6; k++) wet.px(Math.floor(wet.hash(k, 1, 13) * 14) + 1, (k % 4) * 4 + 3, '#6b5a4a');

        dirtField(cell(a, 3, 1), '#c9b184', '#e0cba4', '#9c8259', 17);   // sand

        // --- row 2: water and floors ----------------------------------------
        const water = cell(a, 0, 2);
        for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
          const b = Math.sin((x * 0.5 + y * 0.9)) > 0.55 ? '#3f7fa8' : '#2f6890';
          water.px(x, y, ((x * 3 + y * 5) % 13) === 0 ? '#5aa3c8' : b);
        }
        const shallow = cell(a, 1, 2);
        for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++)
          shallow.px(x, y, ((x * 3 + y * 5) % 13) === 0 ? '#8fd0e0' : ((x + y) % 5) === 0 ? '#63a8c4' : '#4f93b4');

        const cobble = cell(a, 2, 2);                      // set stone paving
        for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) cobble.px(x, y, STONE_D);
        for (let gy = 0; gy < 4; gy++) for (let gx = 0; gx < 4; gx++) {
          const ox = (gy % 2) * 2;
          cobble.rect(gx * 4 + ox, gy * 4, gx * 4 + 2 + ox, gy * 4 + 2, STONE);
          cobble.rect(gx * 4 + ox, gy * 4, gx * 4 + 2 + ox, gy * 4, STONE_HI);
        }

        const planks = cell(a, 3, 2);
        for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++)
          planks.px(x, y, (y % 5) === 0 ? WOOD_D : (y % 5) === 1 ? WOOD_HI : WOOD);
        for (const x of [5, 11]) for (let y = 0; y < 16; y++) planks.px(x, y, WOOD_D);

        // --- row 3: spoil ----------------------------------------------------
        dirtField(cell(a, 0, 3), '#6f7179', '#8f929c', '#4f5158', 19);   // gravel
        dirtField(cell(a, 1, 3), '#4a443f', '#635c55', '#332e2a', 23);   // ash

        const moss = cell(a, 2, 3);
        grassField(moss, 29);
        for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++)
          if (((x * 7 + y * 5) % 9) === 0) moss.px(x, y, GRASS_DD);

        const rubble = cell(a, 3, 3);
        dirtField(rubble, '#6f6a62', '#8d887e', '#4a463f', 31);
        for (let k = 0; k < 7; k++) {
          const x = Math.floor(rubble.hash(k, 4, 37) * 13) + 1, y = Math.floor(rubble.hash(k, 5, 37) * 13) + 1;
          rubble.rect(x, y, x + 1, y + 1, STONE); rubble.px(x, y, STONE_HI);
        }
      }))]
    };
  }

  /* ================================================================== WALLS */

  /* Sixteen pieces indexed by a neighbour mask: N=1, E=2, S=4, W=8.

     The first cut drew a hub box on top of the arms, which stamped a lighter
     square into the middle of every cell — a straight run came out as a line
     of crates rather than a wall. So the shape is resolved as a coverage mask
     first and only then textured, which means a run of tiles is one unbroken
     band of timber and the lighting follows the silhouette instead of the
     cell. Arms reach the cell edge on connected sides so neighbours share a
     seam, and stop short on open sides so a wall end reads as an end. */
  function maskSuite(name, pal) {
    const cell = (a, i) => P().offsetApi(a, (i % 4) * 16, Math.floor(i / 4) * 16);

    function coverage(m) {
      const g = new Uint8Array(256);
      const set = (x0, y0, x1, y1) => {
        for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) g[y * 16 + x] = 1;
      };
      set(4, 4, 11, 11);                                  // hub
      if (m & 1) set(4, 0, 11, 5);                        // north
      if (m & 2) set(10, 4, 15, 11);                      // east
      if (m & 4) set(4, 10, 11, 15);                      // south
      if (m & 8) set(0, 4, 5, 11);                        // west
      return g;
    }

    return {
      width: 64, height: 64, name, layers: [{ name: 'wall' }],
      states: [D('sheet', 1, false, still(a => {
        for (let m = 0; m < 16; m++) {
          const c = cell(a, m), g = coverage(m);
          const on = (x, y) => x >= 0 && x < 16 && y >= 0 && y < 16 && g[y * 16 + x] === 1;
          for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
            if (!on(x, y)) continue;
            /* Shade by where the pixel sits in the silhouette, not where it
               sits in the cell: top edge catches light, bottom edge and the
               right flank fall away. */
            const c1 = !on(x, y - 1) ? 'top' : !on(x, y + 1) ? 'foot'
              : !on(x + 1, y) ? 'right' : !on(x - 1, y) ? 'left' : 'mid';
            c.px(x, y, c1 === 'top' || c1 === 'left' ? pal.hi
              : c1 === 'foot' || c1 === 'right' ? pal.sh : pal.base);
          }
          pal.texture(c, on);
          /* Drop a dark band under every exposed bottom edge so the wall sits
             on the ground rather than floating over it. */
          for (let x = 0; x < 16; x++) for (let y = 0; y < 16; y++)
            if (on(x, y) && !on(x, y + 1) && y < 15) c.px(x, y + 1, pal.dd);
        }
      }))]
    };
  }

  /* Timber: split stakes, so the texture is vertical splits with a lashing
     rail threaded across whatever the silhouette happens to be. */
  const PALISADE = {
    base: WOOD, hi: WOOD_HI, sh: WOOD_D, dd: WOOD_DD,
    texture(c, on) {
      for (let x = 1; x < 16; x += 3) for (let y = 0; y < 16; y++)
        if (on(x, y) && on(x, y - 1)) c.px(x, y, WOOD_D);
      for (const y of [6, 10]) for (let x = 0; x < 16; x++)
        if (on(x, y) && on(x - 1, y) && on(x + 1, y)) c.px(x, y, '#5e3a22');
      for (let x = 2; x < 16; x += 3) for (let y = 0; y < 16; y++)
        if (on(x, y) && !on(x, y - 1)) c.px(x, y, '#b98a5e');   // lit stake tops
    }
  };
  /* Stone: coursed blocks with staggered joints and a crenel notch on any
     exposed top edge, which is what separates a rampart from a wide kerb. */
  const RAMPART = {
    base: STONE, hi: STONE_HI, sh: STONE_D, dd: STONE_DD,
    texture(c, on) {
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
        if (!on(x, y)) continue;
        if (y % 3 === 0 && on(x, y - 1)) c.px(x, y, STONE_D);          // bed joint
        else if ((x + (Math.floor(y / 3) % 2) * 2) % 4 === 0 && on(x, y - 1) && on(x, y + 1))
          c.px(x, y, STONE_D);                                          // perp joint
      }
      for (let x = 0; x < 16; x++) for (let y = 0; y < 16; y++)
        if (on(x, y) && !on(x, y - 1) && (x % 3) === 1) { c.px(x, y, STONE_D); c.px(x, y + 1, STONE_D); }
    }
  };

  /* ============================================================= DWELLINGS */

  /* The shared building form. `yEave` splits roof from wall: everything above
     it is seen from above, everything below is the sliver of facade that
     carries the door. */
  function lodge(a, x0, x1, yTop, yEave, yFoot, roof, roofHi, roofSh, opts) {
    const o = opts || {};
    const cx = (x0 + x1) / 2;
    for (let y = yTop; y <= yEave; y++) {
      /* The top two rows tuck in one pixel each so the ridge reads as a
         rounded cap; a square-cornered roof reads as a crate. */
      const inset = y === yTop ? 2 : y === yTop + 1 ? 1 : 0;
      for (let x = x0 + inset; x <= x1 - inset; x++) {
        const t = Math.abs(x - cx) / (((x1 - x0) / 2) || 1);
        a.px(x, y, t < 0.26 ? roofHi : t < 0.74 ? roof : roofSh);
      }
    }
    if (o.planks !== false)                              // vertical roof boards
      for (let x = x0 + 2; x <= x1 - 2; x += 3) a.rect(x, yTop + 2, x, yEave - 1, roofSh);
    a.rect(x0, yEave, x1, yEave, roofSh);                // eave shadow
    a.rect(x0 - 1, yEave, x1 + 1, yEave, roofSh);        // overhang past the wall

    const wall = o.wall || WOOD_D, wallSh = o.wallSh || WOOD_DD;
    a.rect(x0 + 1, yEave + 1, x1 - 1, yFoot, wall);
    a.rect(x0 + 1, yFoot, x1 - 1, yFoot, wallSh);
    if (o.door !== false) {                              // arched doorway
      const dx = Math.round(cx), w = o.doorW === undefined ? 2 : o.doorW;
      a.rect(dx - w, yEave + 2, dx + w, yFoot, DARK);
      a.rect(dx - w + 1, yEave + 1, dx + w - 1, yEave + 1, DARK);
    }
  }

  function homeSuite() {
    return {
      width: 32, height: 32, name: 'Hold Homes', layers: [{ name: 'build' }],
      states: [
        D('tent', 1, false, still(a => {
          /* A tent has no eave and no wall band — it is one canvas cone. The
             lodge form would turn it into a shed. */
          for (let y = 8; y <= 25; y++) {
            const half = Math.round((y - 7) * 0.62);
            for (let x = 16 - half; x <= 15 + half; x++) {
              const t = Math.abs(x - 15.5) / (half || 1);
              a.px(x, y, t < 0.3 ? TENT_HI : t < 0.78 ? TENT : TENT_D);
            }
          }
          a.rect(15, 6, 16, 9, WOOD_D);                  // ridge pole
          a.rect(13, 18, 18, 25, DARK);                  // flap
          a.rect(13, 18, 13, 25, TENT_D); a.rect(18, 18, 18, 25, TENT_D);
          a.rect(12, 25, 19, 25, WOOD_D);                // pegged hem
          a.px(10, 24, WOOD_D); a.px(21, 24, WOOD_D);
        })),
        D('hut', 1, false, still(a => {
          lodge(a, 9, 22, 8, 21, 25, THATCH, THATCH_HI, THATCH_D, { doorW: 1 });
          speck(a, 10, 9, 21, 20, 41, [THATCH_D, THATCH_HI], 0.16);
        })),
        D('cottage', 1, false, still(a => {
          lodge(a, 7, 24, 6, 20, 25, ROOF, ROOF_HI, ROOF_D, { doorW: 2 });
          a.rect(9, 22, 11, 24, '#7fc4d9'); a.rect(9, 22, 11, 22, '#c8ecf5');   // windows
          a.rect(20, 22, 22, 24, '#7fc4d9'); a.rect(20, 22, 22, 22, '#c8ecf5');
          a.rect(19, 4, 21, 8, STONE_D); a.rect(19, 4, 21, 4, STONE);           // chimney
        })),
        D('house', 1, false, still(a => {
          lodge(a, 5, 26, 5, 20, 26, ROOF, ROOF_HI, ROOF_D, { doorW: 2 });
          a.rect(6, 22, 9, 25, '#7fc4d9'); a.rect(6, 22, 9, 22, '#c8ecf5');
          a.rect(22, 22, 25, 25, '#7fc4d9'); a.rect(22, 22, 25, 22, '#c8ecf5');
          a.rect(8, 3, 10, 8, STONE_D); a.rect(8, 3, 10, 3, STONE);
          a.rect(13, 21, 18, 21, WOOD);                  // lintel over the door
        })),
        D('hall', 1, false, still(a => {
          /* The seat of the settlement: teal roof and a stone portico, so it
             never competes with the orange roofs around it. */
          lodge(a, 3, 28, 3, 18, 21, TEAL, TEAL_HI, TEAL_D, { door: false, planks: false });
          for (let x = 4; x <= 27; x += 4) a.rect(x, 5, x + 1, 17, TEAL_D);
          a.rect(4, 19, 27, 21, STONE); a.rect(4, 19, 27, 19, STONE_HI);
          for (const x of [6, 11, 20, 25]) {             // columns
            a.rect(x, 21, x + 2, 28, STONE_HI);
            a.rect(x + 2, 21, x + 2, 28, STONE_D);
            a.rect(x, 28, x + 2, 28, STONE_D);
          }
          a.rect(14, 21, 18, 28, DARK);                  // the doorway between them
          a.rect(13, 20, 19, 20, STONE_D);
          a.rect(15, 1, 16, 4, THATCH); a.px(17, 1, THATCH_HI);   // pennant
        })),
        D('market', 1, false, still(a => {
          /* Striped awning on four posts. Read from above the stripes are the
             whole identity of the stall, so they run the full depth. */
          for (let x = 4; x <= 27; x++) {
            const s = Math.floor((x - 4) / 3) % 2;
            a.rect(x, 7, x, 19, s ? '#d9536a' : '#f2f0e4');
          }
          a.rect(4, 7, 27, 7, '#a83a50');
          a.rect(4, 19, 27, 20, '#8a2f42');
          for (const x of [5, 25]) a.rect(x, 20, x + 1, 27, WOOD_D);
          a.rect(8, 21, 23, 25, WOOD);                   // counter
          a.rect(8, 21, 23, 21, WOOD_HI);
          a.rect(8, 25, 23, 26, WOOD_D);
          a.px(11, 23, '#d9536a'); a.px(12, 23, '#e8c878'); a.px(15, 23, LEAF_HI);
          a.px(18, 23, '#d9536a'); a.px(19, 23, '#c8a8e0');       // goods on the boards
        }))
      ]
    };
  }

  /* =========================================================== WORKPLACES */

  /* Smoke drifts up and fades. Four frames, and the last must not match the
     first or the loop check calls it a hitch — the vertical offset does that
     for free as long as the cycle length and the rise are coprime. */
  function smoke(a, x, y, i, tone) {
    for (let k = 0; k < 3; k++) {
      const t = (i + k * 1.37) % 4;
      const py = y - Math.round(t * 2.1) - k;
      const r = t < 1.5 ? 1 : 2;
      disc(a, x + (k % 2 ? 1 : -1) * Math.round(t * 0.5), py, r, tone);
    }
  }

  function workSuite() {
    return {
      width: 32, height: 32, name: 'Hold Works', layers: [{ name: 'build' }],
      states: [
        D('woodcutter', 1, false, still(a => {
          lodge(a, 8, 23, 6, 19, 24, WOOD, WOOD_HI, WOOD_D, { doorW: 2 });
          /* Stacked logs seen end-on. The end grain is the whole tell — a
             plain brown block beside the hut just looks like more hut. */
          for (let r = 0; r < 2; r++) for (let k = 0; k < 2; k++) {
            const x = 1 + k * 5, y = 21 + r * 5;
            a.ellipse(x, y, x + 4, y + 4, WOOD_D, true);
            a.ellipse(x + 1, y + 1, x + 3, y + 3, '#a8764c', true);
            a.px(x + 2, y + 2, WOOD_D);
          }
          a.rect(23, 23, 29, 28, WOOD_D);                // chopping block
          a.ellipse(23, 22, 29, 26, '#a8764c', true);
          a.rect(25, 24, 26, 25, WOOD_D);
          a.rect(26, 15, 27, 23, '#6b5a4a');             // axe standing in it
          a.rect(24, 13, 29, 16, STONE_HI);
          a.rect(24, 16, 29, 16, STONE_D);
        })),
        D('quarry', 1, false, still(a => {
          /* A pit, not a building: the terraced bowl and the cut blocks
             stacked on the lip carry the meaning, so there is no roof. The
             terraces have to step in tone or the whole thing reads as a
             grey washer. */
          a.ellipse(3, 9, 28, 28, '#4a463f', true);      // spoil apron
          a.ellipse(5, 11, 26, 26, STONE_D, true);
          a.ellipse(8, 13, 23, 24, '#4a4f58', true);
          a.ellipse(11, 16, 20, 22, DARK, true);
          for (let k = 0; k < 6; k++) {                  // cut blocks on the lip
            const ang = k * (Math.PI * 2 / 6) + 0.5;
            const x = Math.round(15.5 + Math.cos(ang) * 11.5), y = Math.round(18 + Math.sin(ang) * 9);
            a.rect(x - 2, y - 2, x + 1, y + 1, STONE);
            a.rect(x - 2, y - 2, x + 1, y - 2, STONE_HI);
            a.rect(x + 1, y - 2, x + 1, y + 1, STONE_DD);
          }
          a.rect(11, 2, 12, 12, WOOD_D);                 // winch frame over the hole
          a.rect(19, 2, 20, 12, WOOD_D);
          a.rect(10, 1, 21, 3, WOOD);
          a.rect(10, 1, 21, 1, WOOD_HI);
          a.rect(15, 3, 16, 9, '#6b5a4a');               // rope
          a.rect(13, 9, 18, 13, WOOD_D);                 // hanging skip
          a.rect(13, 9, 18, 9, WOOD_HI);
        })),
        D('kiln', 4, true, cyc(4, 4, (a, i) => {
          /* Dome with an arched mouth and a live fire inside. The glow steps
             through three tones so consecutive frames clear the pixel-delta
             gate without the flame visibly strobing. */
          a.ellipse(7, 10, 24, 27, STONE_D, true);
          a.ellipse(9, 8, 22, 25, STONE, true);
          a.ellipse(11, 9, 20, 18, STONE_HI, true);
          a.rect(7, 26, 24, 28, STONE_DD);
          a.rect(12, 19, 19, 27, DARK);                  // mouth
          a.ellipse(12, 16, 19, 22, DARK, true);
          const glow = [0, 1, 2, 1][i];
          a.rect(13, 23, 18, 27, ['#a83a1a', '#d9662a', '#f2a03a'][glow]);
          a.rect(14, 25, 17, 27, ['#d9662a', '#f2a03a', '#ffd97a'][glow]);
          a.rect(13, 5, 18, 11, STONE_D);                // flue
          a.rect(13, 5, 18, 5, STONE);
          smoke(a, 15, 5, i, '#9aa0a8');
        })),
        D('forge', 4, true, cyc(4, 4, (a, i) => {
          /* A half-open shed: slate roof over the back, the working floor
             exposed at the front. Without the courses the roof came out as a
             flat grey slab that read as nothing at all. */
          lodge(a, 4, 27, 5, 15, 17, '#6f7179', '#8f929c', '#4f5158',
            { door: false, planks: false, wall: STONE_DD, wallSh: STONE_DD });
          for (let y = 7; y <= 14; y += 3) a.rect(5, y, 26, y, '#4f5158');
          a.rect(5, 18, 26, 28, '#4a443f');              // working floor
          for (let y = 19; y <= 28; y += 3) a.rect(5, y, 26, y, '#3a352f');
          for (const x of [4, 27]) a.rect(x, 17, x, 28, WOOD_D);   // corner posts
          a.rect(6, 19, 13, 27, STONE_DD);               // hearth
          a.rect(6, 19, 13, 19, STONE_D);
          const g = i % 2;
          a.rect(7, 21, 12, 26, g ? '#d9662a' : '#a83a1a');
          a.rect(8, 22, 11, 26, g ? '#f2a03a' : '#d9662a');
          a.rect(9, 24, 10, 26, g ? '#ffd97a' : '#f2a03a');
          a.rect(17, 21, 25, 24, STONE_D);               // anvil
          a.rect(17, 21, 25, 21, STONE_HI);
          a.rect(19, 24, 23, 28, STONE_DD);
          a.rect(19, 24, 23, 24, '#4f5158');
          a.rect(7, 1, 12, 6, STONE_D); a.rect(7, 1, 12, 1, STONE);  // chimney
          smoke(a, 9, 1, i, '#8a8f9a');
        })),
        D('storehouse', 1, false, still(a => {
          lodge(a, 3, 28, 5, 19, 26, WOOD, WOOD_HI, WOOD_D, { doorW: 3 });
          /* The crates sit below the wall band, not against it — in pale
             sapwood, because a dark crate on a dark wall is invisible. */
          for (const x of [0, 23]) {
            a.rect(x, 22, x + 7, 28, '#c9a878');
            a.rect(x, 22, x + 7, 23, '#e4c89c');
            a.rect(x, 28, x + 7, 29, '#8a6440');
            a.rect(x, 25, x + 7, 25, '#8a6440');
            a.rect(x + 3, 22, x + 4, 28, '#8a6440');
          }
          a.rect(12, 18, 19, 19, WOOD_DD);               // hoist beam over the doors
        })),
        D('granary', 1, false, still(a => {
          /* Raised on staddle stones with a skirt of thatch: the gap under the
             floor is the silhouette tell that keeps it apart from a cottage. */
          lodge(a, 6, 25, 4, 17, 21, THATCH, THATCH_HI, THATCH_D, { doorW: 2, wall: WOOD, wallSh: WOOD_D });
          speck(a, 7, 5, 24, 16, 43, [THATCH_D, THATCH_HI], 0.16);
          a.rect(5, 21, 26, 23, WOOD_D);                 // floor slab
          a.rect(5, 21, 26, 21, WOOD);
          for (const x of [7, 14, 21]) {                 // staddle stones
            a.rect(x, 24, x + 3, 27, STONE);
            a.rect(x, 24, x + 3, 24, STONE_HI);
            a.rect(x, 27, x + 3, 28, STONE_D);
          }
        })),
        D('well', 4, true, cyc(4, 4, (a, i) => {
          a.ellipse(8, 12, 23, 27, STONE_D, true);
          a.ellipse(10, 14, 21, 25, STONE, true);
          a.ellipse(12, 16, 19, 23, '#2f6890', true);    // water
          const w = [0, 1, 2, 1][i];
          a.ellipse(13 + (w === 2 ? 1 : 0), 17 + w, 18 - (w === 2 ? 1 : 0), 21 + w, '#3f7fa8', true);
          a.px(14, 18 + w, '#8fd0e0'); a.px(17, 20 - w, '#5aa3c8');
          for (const x of [9, 22]) a.rect(x, 4, x + 1, 14, WOOD_D);   // posts
          a.rect(8, 2, 23, 4, WOOD);                     // roof beam
          a.rect(8, 2, 23, 2, WOOD_HI);
          a.rect(15, 4, 16, 6, WOOD_DD);                 // rope and bucket
          a.rect(14, 6 + (i % 2), 17, 9 + (i % 2), WOOD_D);
          a.rect(14, 6 + (i % 2), 17, 6 + (i % 2), WOOD_HI);
        })),
        D('tavern', 1, false, still(a => {
          lodge(a, 4, 27, 4, 19, 26, ROOF, ROOF_HI, ROOF_D, { doorW: 3 });
          a.rect(5, 21, 8, 25, '#7fc4d9'); a.rect(5, 21, 8, 21, '#c8ecf5');
          a.rect(23, 21, 26, 25, '#7fc4d9'); a.rect(23, 21, 26, 21, '#c8ecf5');
          a.rect(1, 6, 2, 12, WOOD_D);                   // hanging sign
          a.rect(0, 12, 9, 20, WOOD_D);
          a.rect(1, 13, 8, 19, '#e4c89c');
          a.rect(3, 14, 6, 18, '#8a3f26');               // a painted tankard
          a.rect(6, 15, 7, 17, '#8a3f26');
          a.rect(3, 14, 6, 15, THATCH_HI);
          a.rect(9, 3, 11, 8, STONE_D); a.rect(9, 3, 11, 3, STONE);
        }))
      ]
    };
  }

  /* ================================================================ DEFENCE */

  function keepSuite() {
    return {
      width: 32, height: 32, name: 'Hold Keep', layers: [{ name: 'build' }],
      states: [
        D('gate_closed', 1, false, still(a => {
          a.rect(2, 8, 29, 23, WOOD_D);                  // frame
          a.rect(2, 8, 29, 9, WOOD_HI);
          a.rect(2, 22, 29, 23, WOOD_DD);
          a.rect(6, 10, 25, 21, WOOD);                   // the leaves, shut
          for (let x = 7; x <= 24; x += 3) a.rect(x, 10, x, 21, WOOD_D);
          a.rect(15, 10, 16, 21, WOOD_DD);               // meeting stile
          a.rect(6, 14, 25, 15, WOOD_HI);                // iron band
          a.rect(6, 14, 25, 14, '#5c616b');
          a.rect(2, 8, 5, 23, STONE_D); a.rect(26, 8, 29, 23, STONE_D);   // jambs
          a.rect(2, 8, 5, 9, STONE); a.rect(26, 8, 29, 9, STONE);
        })),
        D('gate_open', 1, false, still(a => {
          a.rect(2, 8, 29, 23, WOOD_D);
          a.rect(2, 8, 29, 9, WOOD_HI);
          a.rect(2, 22, 29, 23, WOOD_DD);
          a.rect(9, 10, 22, 21, DARK);                   // the way through
          for (const x of [6, 21]) {                     // leaves folded back
            a.rect(x, 10, x + 2, 21, WOOD);
            a.rect(x, 10, x + 2, 10, WOOD_HI);
            a.rect(x + 1, 11, x + 1, 21, WOOD_D);
          }
          a.rect(2, 8, 5, 23, STONE_D); a.rect(26, 8, 29, 23, STONE_D);
          a.rect(2, 8, 5, 9, STONE); a.rect(26, 8, 29, 9, STONE);
        })),
        D('tower', 1, false, still(a => {
          /* Seen from above a tower is a ring of merlons around a dark well,
             with the shaft showing only as a thin skirt. */
          a.ellipse(4, 4, 27, 27, STONE_D, true);
          a.ellipse(6, 6, 25, 25, STONE, true);
          a.ellipse(8, 8, 23, 23, STONE_HI, true);
          a.ellipse(11, 11, 20, 20, STONE_D, true);
          a.ellipse(12, 12, 19, 19, DARK, true);
          /* Crenels are cut as gaps rather than drawn as bumps: notching the
             rim silhouette is what stops the tower reading as a washer. */
          for (let k = 0; k < 8; k++) {
            const ang = k * (Math.PI * 2 / 8) + 0.39;
            const x = Math.round(15.5 + Math.cos(ang) * 9.5), y = Math.round(15.5 + Math.sin(ang) * 9.5);
            a.rect(x - 1, y - 1, x + 1, y + 1, STONE_DD);
            const bx = Math.round(15.5 + Math.cos(ang + 0.39) * 9.5);
            const by = Math.round(15.5 + Math.sin(ang + 0.39) * 9.5);
            a.rect(bx - 1, by - 1, bx + 1, by + 1, '#d6dbe4');
          }
          a.rect(13, 26, 18, 29, STONE_D);               // door at the foot
          a.rect(14, 27, 17, 29, DARK);
        })),
        D('barracks', 1, false, still(a => {
          lodge(a, 4, 27, 7, 20, 26, '#5c6a52', '#7c8a6c', '#3c4636', { doorW: 3 });
          a.rect(6, 22, 9, 25, DARK); a.rect(22, 22, 25, 25, DARK);      // shuttered slits
          a.rect(6, 22, 9, 22, '#3c4636'); a.rect(22, 22, 25, 22, '#3c4636');
          a.rect(2, 2, 3, 20, WOOD_D);                   // banner on a real pole
          a.px(2, 1, THATCH_HI); a.px(3, 1, THATCH_HI);
          a.rect(4, 3, 11, 12, '#a83a50');
          a.rect(4, 3, 11, 4, '#d9536a');
          a.rect(4, 12, 11, 12, '#7a2438');
          a.rect(6, 6, 9, 10, THATCH_HI);
          /* Spears lean clear of the roofline so the heads show against the
             background rather than against the thatch. */
          for (const x of [28, 30]) {
            a.rect(x - 1, 10, x, 28, '#6b5a4a');
            a.rect(x - 1, 7, x, 10, STONE_HI);
            a.px(x - 1, 6, STONE_HI);
          }
        })),
        D('brazier', 4, true, cyc(4, 4, (a, i) => {
          a.rect(13, 22, 18, 28, WOOD_D);                // tripod
          a.rect(11, 27, 20, 29, WOOD_DD);
          a.ellipse(9, 16, 22, 24, STONE_D, true);       // bowl
          a.ellipse(10, 15, 21, 22, STONE, true);
          a.ellipse(11, 16, 20, 21, '#4a2c1d', true);
          /* The flame is three nested discs whose radii and offsets step per
             frame; scaling one disc alone never moves enough pixels. */
          const r = [4, 5, 4, 3][i], off = [0, 1, 0, -1][i];
          disc(a, 15.5, 15 - off, r, '#d9662a');
          disc(a, 15.5, 14 - off, r - 1.5, '#f2a03a');
          disc(a, 15.5 + (i % 2 ? 1 : -1), 12 - off, 1.4, '#ffd97a');
          a.px(15, 8 - off, '#ffd97a'); a.px(17, 10 - off, '#f2a03a');
        })),
        D('banner', 4, true, cyc(4, 4, (a, i) => {
          a.rect(14, 2, 15, 29, WOOD_D);                 // pole
          a.rect(14, 2, 15, 2, THATCH_HI);
          const s = [0, 1, 2, 1][i];
          for (let y = 5; y <= 22; y++) {                // cloth with a travelling ripple
            const w = Math.round(Math.sin((y - 5) * 0.34 + s * 0.9) * 1.2);
            a.rect(16, y, 25 + w, y, '#a83a50');
            a.rect(16, y, 18 + w, y, '#d9536a');
            a.px(25 + w, y, '#7a2438');
          }
          a.rect(19, 11, 22, 16, THATCH_HI);             // device
          a.rect(20, 12, 21, 15, '#a83a50');
        }))
      ]
    };
  }

  /* ========================================================== RESOURCE NODES */

  /* A node is a cluster of chunks on a spoil patch. The chunk colours are the
     entire read at 16px, so each ore keeps one saturated accent that nothing
     else in the pack uses. */
  function oreNode(a, seed, base, hi, sh, accent) {
    a.ellipse(5, 16, 26, 27, GRASS_DD, true);            // trampled ground
    for (let k = 0; k < 6; k++) {
      const x = 8 + Math.floor(a.hash(k, 1, seed) * 15);
      const y = 13 + Math.floor(a.hash(k, 2, seed) * 11);
      const r = 2 + Math.floor(a.hash(k, 3, seed) * 2);
      disc(a, x, y, r, base);
      disc(a, x - 0.5, y - 0.6, r - 1, hi);
      a.px(x + r - 1, y + r - 1, sh);
      if (accent && (k % 2) === 0) { a.px(x, y - 1, accent); a.px(x + 1, y, accent); }
    }
  }

  function nodeSuite() {
    return {
      width: 32, height: 32, name: 'Hold Nodes', layers: [{ name: 'node' }],
      states: [
        D('coal', 1, false, still(a => oreNode(a, 11, '#2f2b2a', '#4a4442', '#1a1717', '#6b6560'))),
        D('iron', 1, false, still(a => oreNode(a, 13, '#6f6a62', '#8d887e', '#4a463f', '#b08a5e'))),
        D('gold', 1, false, still(a => oreNode(a, 17, '#7a6a4a', '#9c8a62', '#4e4430', '#ffd97a'))),
        D('stone', 1, false, still(a => oreNode(a, 19, STONE_D, STONE, STONE_DD, STONE_HI))),
        D('clay', 1, false, still(a => {
          /* A dug pit rather than a boulder field — clay is scraped, not
             broken off, so it reads as terraced rings. */
          a.ellipse(4, 10, 27, 27, '#8a5a3a', true);
          a.ellipse(7, 13, 24, 25, '#a97250', true);
          a.ellipse(10, 16, 21, 23, '#6b4028', true);
          a.ellipse(13, 18, 18, 22, '#4a2c1d', true);
          for (let k = 0; k < 5; k++) {
            const x = 7 + Math.floor(a.hash(k, 4, 23) * 18), y = 11 + Math.floor(a.hash(k, 5, 23) * 4);
            a.rect(x, y, x + 1, y + 1, '#c08a64');
          }
          a.rect(20, 8, 21, 14, WOOD_D);                 // abandoned spade
          a.rect(19, 14, 22, 17, STONE);
        })),
        D('berry', 1, false, still(a => {
          a.ellipse(6, 12, 25, 26, LEAF_D, true);
          a.ellipse(7, 11, 24, 23, LEAF, true);
          a.ellipse(9, 11, 21, 19, LEAF_HI, true);
          for (let k = 0; k < 9; k++) {
            const x = 9 + Math.floor(a.hash(k, 6, 29) * 14), y = 13 + Math.floor(a.hash(k, 7, 29) * 11);
            a.px(x, y, '#d9536a'); a.px(x + 1, y, '#a83a50'); a.px(x, y - 1, '#f2909a');
          }
        })),
        D('stump', 1, false, still(a => {
          a.ellipse(9, 14, 22, 26, WOOD_DD, true);
          a.ellipse(9, 12, 22, 24, WOOD_D, true);
          a.ellipse(11, 13, 20, 22, WOOD, true);
          a.ellipse(13, 15, 18, 20, WOOD_HI, true);
          a.px(15, 17, WOOD_D); a.px(16, 18, WOOD_D);    // heartwood
          for (let k = 0; k < 4; k++) {                  // roots breaking the ring
            const ang = k * (Math.PI * 2 / 4) + 0.7;
            a.line(Math.round(15.5 + Math.cos(ang) * 6), Math.round(19 + Math.sin(ang) * 5),
              Math.round(15.5 + Math.cos(ang) * 9), Math.round(19 + Math.sin(ang) * 7), WOOD_DD, 1);
          }
        })),
        D('sapling', 1, false, still(a => {
          a.ellipse(9, 20, 22, 28, GRASS_DD, true);
          a.rect(14, 15, 17, 27, WOOD_D);
          a.rect(14, 15, 14, 27, WOOD);
          disc(a, 15.5, 13, 5, LEAF);
          disc(a, 14.5, 12, 3.2, LEAF_HI);
          a.px(12, 15, LEAF_D); a.px(19, 14, LEAF_D);
          a.px(13, 18, LEAF); a.px(18, 19, LEAF);        // low shoots
        }))
      ]
    };
  }

  /* ========================================================== CONSTRUCTION */

  function siteSuite() {
    /* Three stages of the same frame so a build in progress visibly fills in.
       Each stage keeps the previous stage's timber exactly where it was —
       scaffolding that moves between stages reads as a different building. */
    const frame = (a, stage) => {
      a.ellipse(4, 8, 27, 27, SOIL_D, true);             // cleared plot
      a.ellipse(6, 10, 25, 25, SOIL, true);
      for (const x of [6, 24]) { a.rect(x, 8, x + 1, 26, WOOD); a.rect(x, 8, x + 1, 8, WOOD_HI); }
      a.rect(6, 8, 25, 9, WOOD);                         // head beam
      a.rect(6, 8, 25, 8, WOOD_HI);
      if (stage >= 1) {
        a.rect(8, 18, 23, 26, WOOD_D);                   // walls going up
        a.rect(8, 18, 23, 18, WOOD);
        for (let x = 9; x <= 22; x += 3) a.rect(x, 19, x, 26, WOOD_DD);
      }
      if (stage >= 2) {
        a.rect(7, 11, 24, 17, WOOD);                     // roof boards on the frame
        a.rect(7, 11, 24, 11, WOOD_HI);
        a.rect(7, 17, 24, 17, WOOD_DD);
        for (let x = 9; x <= 22; x += 4) a.rect(x, 12, x, 16, WOOD_D);
      }
      a.rect(3, 24, 6, 27, WOOD_D);                      // materials on the ground
      a.rect(3, 24, 6, 24, WOOD);
      a.px(26, 25, STONE); a.px(27, 26, STONE_D);
    };
    return {
      width: 32, height: 32, name: 'Hold Site', layers: [{ name: 'site' }],
      states: [
        D('site_frame', 1, false, still(a => frame(a, 0))),
        D('site_half', 1, false, still(a => frame(a, 1))),
        D('site_near', 1, false, still(a => frame(a, 2))),
        D('ruin', 1, false, still(a => {
          /* What a razed building leaves: a scorched footprint, broken studs
             and a little smoke-stained rubble. */
          a.ellipse(4, 8, 27, 27, '#3a322c', true);
          a.ellipse(7, 11, 24, 25, '#2a231e', true);
          for (const x of [7, 14, 22]) {
            const h = x === 14 ? 6 : 4;
            a.rect(x, 26 - h, x + 1, 26, WOOD_DD);
            a.px(x, 26 - h, '#4a3c30');
          }
          for (let k = 0; k < 8; k++) {
            const px = 7 + Math.floor(a.hash(k, 8, 53) * 18), py = 14 + Math.floor(a.hash(k, 9, 53) * 12);
            a.px(px, py, k % 3 === 0 ? '#6b6560' : '#1a1717');
          }
          a.px(12, 20, '#d9662a'); a.px(19, 23, '#a83a1a');   // embers still live
        }))
      ]
    };
  }

  return {
    groundSuite,
    palisadeSuite: () => maskSuite('Hold Palisade', PALISADE),
    rampartSuite: () => maskSuite('Hold Rampart', RAMPART),
    homeSuite, workSuite, keepSuite, nodeSuite, siteSuite
  };
})();
