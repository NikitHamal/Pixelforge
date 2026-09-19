/* PixelForge Studio — Traps, Furniture & Weather pack.
   Three room-and-level kits that the library was missing entirely:
   dungeon traps (animated hazards), interior furniture, and full-frame
   weather overlays. 32x32, pure maths, deterministic. */
window.PF = window.PF || {};
PF.RPG = PF.RPG || {};
PF.RPG.props = (() => {
  const P = () => PF.Pixel;
  const D = (name, fps, loop, frames) => ({ name, fps, loop, frames });
  const Fr = (duration, paint) => ({ duration, paint });
  const ms = fps => Math.round(1000 / fps);
  const apiFor = (buf, W, H) => P().makeApi(buf, W, H);
  const OUT32 = PF.Color.hexToU32('#181425');
  const finish = (buf, W, H) => buf.set(PF.Raster.outline(buf, W, H, OUT32));
  const S1 = (name, painter, fps = 6) => D(name, fps, true, [Fr(ms(fps), painter)]);
  // props sit on the floor: shadow at groundY=29, feet never past y27
  const prop = painter => (buf, W, H) => { painter(apiFor(buf, W, H)); finish(buf, W, H); };
  const grounded = painter => (buf, W, H) => { const api = apiFor(buf, W, H); painter(api); finish(buf, W, H); };

  /* ================= TRAPS ================= */
  function trapsSuite() {
    const stone = '#5a6988', stoneD = '#3a4466', stoneL = '#8b9bb4', metal = '#c0cbdc', metalD = '#5a6988';

    // floor spikes: plate flush -> blades punch up -> retract
    const spikes = k => prop(api => {
      api.rect(6, 26, 25, 28, stoneD);
      api.rect(6, 26, 25, 26, stoneL);
      api.rect(7, 27, 24, 27, stone);
      for (let i = 0; i < 6; i++) {
        const x = 8 + i * 3;
        api.px(x, 26, '#181425'); // socket
        const h = [0, 4, 7, 3][k];
        if (h) {
          api.line(x, 25, x, 25 - h, metal, 1);
          api.px(x, 25 - h, '#ffffff');
          api.px(x - 1, 24 - Math.floor(h / 2), metalD);
          api.px(x + 1, 24 - Math.floor(h / 2), metalD);
        }
      }
    });

    // wall dart trap: slot on the left edge, dart fires right
    const darts = k => prop(api => {
      api.rect(2, 12, 6, 20, stoneD);
      api.rect(2, 12, 6, 13, stoneL);
      api.rect(3, 15, 5, 17, '#181425');
      api.px(5, 16, k > 0 ? metal : '#181425');
      if (k === 0) { api.px(6, 16, metalD); }
      else {
        const reach = [0, 7, 14, 9][k];
        api.line(6, 16, 6 + reach, 16, metal, 1);
        api.rect(5 + reach, 15, 7 + reach, 17, metal);
        api.px(7 + reach, 16, '#ffffff');
        if (k === 2) { api.px(8 + reach, 16, '#fee761'); api.px(6 + reach, 14, '#fee761'); }
      }
    });

    // ceiling pendulum blade: swings across the tile
    const blade = k => prop(api => {
      api.rect(14, 0, 17, 3, stoneD);
      api.rect(15, 0, 16, 3, stone);
      const a = [-0.55, -0.2, 0.2, 0.55][k];
      const cx = 16, cy = 4, r = 15;
      const bx = Math.round(cx + Math.sin(a) * r), by = Math.round(cy + Math.cos(a) * r);
      api.line(cx, cy, bx, by, metalD, 1);
      api.ellipse(bx - 4, by - 3, bx + 4, by + 5, metal, true);
      api.ellipse(bx - 3, by - 2, bx + 3, by + 4, '#e8ecf5', true);
      api.px(bx - 4, by + 5, '#ffffff'); api.px(bx + 4, by + 5, '#ffffff');
    });

    // pressure plate: up / pressed
    const plate = down => prop(api => {
      api.rect(8, 26, 23, 28, stoneD);
      if (down) { api.rect(9, 27, 22, 28, stone); api.rect(9, 27, 22, 27, stoneL); }
      else { api.rect(8, 25, 23, 27, stone); api.rect(8, 25, 23, 25, stoneL); api.rect(8, 27, 23, 27, stoneD); }
      api.px(10, 26, down ? stoneD : stoneL); api.px(21, 26, down ? stoneD : stoneL);
    });

    // flame jet: floor vent breathing fire
    const jet = k => prop(api => {
      api.rect(10, 26, 21, 28, stoneD);
      api.rect(11, 26, 20, 27, '#181425');
      api.rect(11, 28, 20, 28, stone);
      const h = [2, 9, 14, 6][k];
      api.ellipse(12, 26 - h, 19, 28, '#f77622', true);
      api.ellipse(13, 27 - h, 18, 28, '#feae34', true);
      api.ellipse(14, 28 - h, 17, 28, '#fee761', true);
      api.px(15, 27 - h, '#ffffff'); api.px(16, 27 - h, '#ffffff');
      if (k >= 2) { api.px(11, 22 - h, '#f77622'); api.px(20, 21 - h, '#feae34'); }
    });

    // bear trap: jaws clamped shut -> sprung open
    const bear = k => grounded(api => {
      api.ellipse(6, 24, 25, 28, metalD, true);
      api.ellipse(7, 25, 24, 27, '#181425', true);
      const open = [0, 5, 8][k];
      // teeth arcs
      for (let i = 0; i < 7; i++) {
        const x = 8 + i * 2;
        api.px(x, 25 - open, '#ffffff');
        api.px(x, 27 + open - 2, '#ffffff');
      }
      api.line(6, 25 - open, 25, 25 - open, metal, 1);
      api.line(6, 25 + open - 1, 25, 25 + open - 1, metal, 1);
      api.rect(14, 28, 17, 29, metalD);
      if (k === 1) { api.px(9, 22, '#e43b44'); api.px(22, 22, '#e43b44'); }
    });

    // spike pit: open hole with a bed of spikes
    const pit = prop(api => {
      api.ellipse(4, 20, 27, 29, '#181425', true);
      api.ellipse(6, 22, 25, 28, '#262b44', true);
      for (let i = 0; i < 7; i++) {
        const x = 8 + i * 2, h = 3 + (i % 3);
        api.line(x, 27, x, 27 - h, metal, 1);
        api.px(x, 27 - h, '#ffffff');
      }
      api.line(4, 20, 27, 20, stoneD, 1);
    });

    // swinging chain with a spiked ball
    const chain = k => prop(api => {
      api.rect(14, 0, 17, 2, stoneD);
      const a = [-0.35, 0, 0.35, 0.15][k];
      const cx = 16, cy = 2, r = 14;
      const bx = Math.round(cx + Math.sin(a) * r), by = Math.round(cy + Math.cos(a) * r);
      for (let t = 0; t < 6; t++) api.px(Math.round(cx + Math.sin(a) * r * (t / 6)), Math.round(cy + Math.cos(a) * r * (t / 6)), metalD);
      api.ellipse(bx - 3, by - 3, bx + 3, by + 3, metalD, true);
      api.ellipse(bx - 2, by - 2, bx + 2, by + 2, metal, true);
      api.px(bx, by, '#ffffff');
      api.px(bx - 3, by, '#ffffff'); api.px(bx + 3, by, '#ffffff');
      api.px(bx, by - 3, '#ffffff'); api.px(bx, by + 3, '#ffffff');
    });

    return { width: 32, height: 32, name: 'rpg-traps', layers: [{ name: 'Traps' }], states: [
      D('spike_trap', 10, true, [0, 1, 2, 3].map(k => Fr(ms(10), spikes(k)))),
      D('dart_trap', 12, true, [0, 1, 2, 3].map(k => Fr(ms(12), darts(k)))),
      D('blade_trap', 12, true, [0, 1, 2, 3].map(k => Fr(ms(12), blade(k)))),
      D('pressure_plate', 6, true, [Fr(ms(6), plate(false)), Fr(ms(6), plate(true))]),
      D('flame_jet', 12, true, [0, 1, 2, 3].map(k => Fr(ms(12), jet(k)))),
      D('bear_trap', 8, true, [0, 1, 2].map(k => Fr(ms(8), bear(k)))),
      D('spike_pit', 6, true, [Fr(ms(6), pit)]),
      D('chain_ball', 10, true, [0, 1, 2, 3].map(k => Fr(ms(10), chain(k))))
    ] };
  }

  /* ================= FURNITURE ================= */
  function furnitureSuite() {
    const wood = '#b86f50', woodD = '#733e39', woodL = '#e4a672', cloth = '#124e89', clothD = '#1c2a44';
    const iron = '#5a6988', ironL = '#8b9bb4', ironD = '#3a4466', gold = '#feae34';
    const woodM = '#a9643f', woodX = '#4e2b28';

    /* Grain. Every piece here is a large field of one brown, and a field that
       size with no incident in it stops reading as a plank and starts reading
       as a coloured rectangle. Sampled per pixel, never per column -- a hash
       taken once and reused down a run comes out as vertical banding. */
    const grain = (api, x0, y0, x1, y1, seed, dark, light) => {
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const n = api.hash(x, y * 3, seed);
        if (n > 0.93) api.px(x, y, light || woodL);
        else if (n < 0.07) api.px(x, y, dark || woodD);
      }
    };

    const table = grounded(api => {
      /* Legs first, so the top and its apron read as laid over them. */
      /* The far pair sits hard against the near pair. Set two columns in, the
         one-wide strip of daylight between them was rimmed on both sides and
         came out solid black, so each end of the table had a seam down it. */
      api.rect(8, 19, 9, 26, woodX); api.rect(22, 19, 23, 26, woodX);    // far pair, in shade
      api.rect(5, 19, 7, 27, wood); api.rect(24, 19, 26, 27, wood);      // near pair
      api.rect(5, 19, 5, 27, woodL); api.rect(24, 19, 24, 27, woodL);
      api.rect(5, 26, 7, 27, woodD); api.rect(24, 26, 26, 27, woodD);    // feet
      /* No stretcher. A rail carried between the legs closed the underframe
         into a ring, and the outline pass rims the inside of a ring as readily
         as the outside: the six rows of daylight left between the apron and
         the rail met their own rims and read as a black drawer front. */
      api.rect(5, 18, 26, 19, woodD);                                    // apron under the top
      api.rect(6, 18, 25, 18, woodM);
      api.rect(3, 14, 28, 17, woodL);                                    // the top itself
      grain(api, 4, 15, 27, 17, 11, woodM, '#f0bd8e');
      api.rect(3, 14, 28, 14, '#fff6c9');                                // sunlit front edge
      api.rect(3, 17, 28, 17, woodM);
      api.rect(3, 14, 3, 17, woodD); api.rect(28, 14, 28, 17, woodD);    // sawn ends
      for (const sx of [10, 17, 24]) api.rect(sx, 15, sx, 17, woodM);    // plank seams
      /* A plate is seen almost edge-on from here. Three rows tall it stood up
         off the boards as a white slab and read as a sheet of paper. */
      api.rect(9, 13, 14, 14, '#e8ecf5');                                // plate
      api.rect(10, 13, 13, 13, '#ffffff');
      api.rect(9, 14, 14, 14, '#a8b8cc');
      api.px(9, 13, '#c0cbdc'); api.px(14, 13, '#c0cbdc');               // the rim, turning away
      api.rect(19, 11, 23, 13, '#8f563b');                               // bowl
      api.rect(19, 13, 23, 13, '#5c3a24');
      api.px(20, 10, '#63c74d'); api.px(22, 10, '#3e8948'); api.px(21, 9, '#63c74d');
      api.px(21, 10, '#b6d53c');
    });

    const chair = grounded(api => {
      /* Two slabs with a gap between them and two posts underneath is not a
         chair, it is a bench and a shelf. What makes one read is a frame:
         stiles that run from the floor to the crest, rails crossing between
         them, and a seat sitting proud of all of it. */
      api.rect(9, 5, 10, 21, wood); api.rect(20, 5, 21, 21, wood);       // back stiles
      api.rect(9, 5, 9, 21, woodL); api.rect(21, 5, 21, 21, woodD);
      api.rect(9, 4, 21, 5, woodL); api.rect(9, 5, 21, 5, woodM);        // crest rail
      api.px(9, 4, wood); api.px(21, 4, wood);                           // rounded corners
      /* The back is a panel with the slats standing proud of it, not slats with
         daylight between them. Left open, the gaps were one to three rows deep
         and the outline pass rimmed each from above and below until the rims
         met: three black letterbox slots where the room should show through. */
      api.rect(11, 6, 19, 17, woodX);                                    // recessed ground
      grain(api, 11, 6, 19, 17, 29, '#3a1f1d', woodD);
      api.rect(11, 9, 19, 11, woodM); api.rect(11, 9, 19, 9, wood);      // back slats
      api.rect(11, 11, 19, 11, woodD);                                   // shadow under each
      api.rect(11, 14, 19, 16, woodM); api.rect(11, 14, 19, 14, wood);
      api.rect(11, 16, 19, 16, woodD);
      api.rect(11, 22, 12, 26, woodX); api.rect(18, 22, 19, 26, woodX);  // far legs
      api.rect(7, 18, 23, 20, woodL);                                    // seat
      grain(api, 8, 19, 22, 20, 23, woodM, '#f0bd8e');
      api.rect(7, 18, 23, 18, '#fff6c9');
      api.rect(7, 21, 23, 21, woodD);                                    // its front edge
      api.rect(7, 18, 7, 21, woodM); api.rect(23, 18, 23, 21, woodD);
      api.rect(8, 22, 9, 27, wood); api.rect(21, 22, 22, 27, wood);      // near legs
      api.rect(8, 22, 8, 27, woodL); api.rect(22, 22, 22, 27, woodD);
      api.rect(8, 26, 9, 27, woodD); api.rect(21, 26, 22, 27, woodD);
      api.rect(9, 24, 22, 24, woodD); api.rect(9, 23, 22, 23, woodM);    // stretcher
    });

    const bed = prop(api => {
      api.rect(2, 6, 3, 27, wood); api.rect(6, 6, 7, 27, wood);          // headboard posts
      api.rect(2, 6, 2, 27, woodL); api.rect(7, 6, 7, 27, woodD);
      /* The panel has to meet the crest. Started a row lower it left a two-wide
         gap between the posts that the outline pass rimmed from both sides,
         and the headboard grew a black keyhole under the stud. */
      api.rect(4, 7, 5, 27, woodM);                                      // panel between them
      /* Crest rail, and nothing standing off it. Two single-pixel finials with
         a dark recess and a gold boss under them assembled into a pair of ears,
         a slot of eyes and a mouth -- the headboard had a face. */
      api.rect(2, 4, 7, 6, wood); api.rect(2, 4, 7, 4, woodL);
      api.rect(2, 6, 7, 6, woodD);                                       // shadow it casts
      api.px(4, 5, gold); api.px(5, 5, gold);                            // brass stud, centred
      grain(api, 4, 8, 5, 26, 23);                                       // grain down the panel
      api.rect(27, 15, 29, 27, wood); api.rect(27, 15, 27, 27, woodL);   // footboard
      api.rect(27, 14, 29, 15, woodL);
      api.rect(8, 15, 26, 22, '#e8ecf5');                                // mattress
      api.rect(8, 15, 26, 15, '#ffffff'); api.rect(8, 22, 26, 22, '#a8b8cc');
      /* A blanket is cloth over a body, not a blue rectangle. The hem turns
         back on itself and the folds run down the fall of it. */
      api.rect(8, 18, 26, 23, cloth);
      api.rect(8, 18, 26, 18, '#4a7fb5');                                // turned-back cuff
      api.rect(8, 19, 26, 19, '#0d3f72');
      /* Folds at an even pitch and a uniform length came out as a barcode.
         They start where the cloth breaks over the sleeper and run different
         distances down the fall of it. */
      /* A fold is a ridge: one column in shadow with the lit side of the cloth
         beside it. Six separate lines at a pitch of two or three were six
         stripes, and the blanket came out as a barcode. */
      for (const [fx, y0, y1] of [[11, 20, 23], [17, 21, 23], [24, 20, 22]]) {
        api.rect(fx, y0, fx, y1, clothD);
        api.rect(fx + 1, y0, fx + 1, y1 - 1, '#2f6fa8');
      }
      api.line(8, 21, 12, 19, '#4a7fb5', 1);                             // corner turned back
      api.rect(8, 23, 26, 23, clothD);
      /* Linen, not bedsheet. White on the near-white mattress had nothing
         between the two, so the pillow dissolved into the sheet; a warm tone
         separates it and leaves the sheet reading cool. */
      api.rect(9, 14, 15, 18, '#f4ead8');                                // pillow
      api.rect(10, 13, 14, 13, '#fbf5e6');                               // crown of it
      api.rect(9, 14, 15, 14, '#fbf5e6');
      api.rect(9, 18, 15, 18, '#c9b898');                                // where it meets the bed
      api.px(9, 14, '#d9cbb4'); api.px(15, 14, '#d9cbb4');               // corners rounded off
      api.rect(11, 16, 13, 17, '#d9cbb4');                               // the dent in it
      api.px(15, 15, '#d9cbb4'); api.px(15, 16, '#d9cbb4');
      api.rect(8, 24, 26, 25, wood); api.rect(8, 24, 26, 24, woodL);     // side rail
      api.rect(8, 26, 26, 26, woodD);
      api.rect(10, 26, 11, 27, woodX); api.rect(23, 26, 24, 27, woodX);  // feet
    });

    const bookshelf = grounded(api => {
      api.rect(4, 4, 27, 28, woodX);                                     // carcase
      api.rect(5, 5, 26, 27, woodM);
      grain(api, 6, 6, 25, 26, 31, woodX, wood);
      const shelf = y => {                                               // boards with a lip
        api.rect(5, y, 26, y + 1, wood);
        api.rect(5, y, 26, y, woodL);
        api.rect(5, y + 2, 26, y + 2, woodX);                            // shadow cast under it
      };
      shelf(11); shelf(18); shelf(25);
      /* Books of one height in one row read as a colour swatch strip. Height,
         lean and a band on the spine are what make a shelf of them. */
      const book = (x, y, c, h, lean) => {
        const top = y + (4 - h);
        api.rect(x, top, x + 1, y + 4, c);
        api.rect(x, top, x, y + 4, PF.Color.u32ToHex(PF.Color.shade(PF.Color.hexToU32(c), -28)));
        api.rect(x, top, x + 1, top, '#fff6c9');
        api.px(x + 1, top + 2, '#fff6c9');                               // band across the spine
        if (lean) api.px(x + 2, top, c);
      };
      book(6, 6, '#a22633', 4); book(8, 6, '#124e89', 5); book(10, 6, '#3e8948', 3);
      book(12, 6, '#68386c', 5, 1); book(15, 6, '#fee761', 4);
      book(6, 13, '#e43b44', 5); book(8, 13, '#2ce8f5', 3); book(10, 13, '#f77622', 4);
      book(6, 20, '#63c74d', 4); book(8, 20, '#c0cbdc', 5); book(10, 20, '#b55088', 3);
      book(12, 20, '#feae34', 5); book(14, 20, '#733e39', 4);
      api.rect(18, 12, 25, 17, iron); api.rect(18, 12, 25, 12, ironL);   // strongbox
      api.rect(18, 17, 25, 17, ironD); api.rect(18, 12, 18, 17, ironL);
      api.rect(19, 14, 24, 14, ironD);                                   // the lid seam
      api.px(21, 15, gold); api.px(22, 15, gold);
      /* A crate with a brace scratched across it came out as a dark grin on
         the bottom shelf. Rolled charts in a rack read at this size and give
         the shelf something that is not another brown box. */
      api.rect(17, 23, 25, 24, woodD); api.rect(17, 23, 25, 23, wood);   // the rack they stand in
      api.rect(17, 24, 25, 24, woodX);
      const scroll = (x, top, c, sh) => {                                // rolled charts
        api.rect(x, top, x + 1, 23, c);
        api.rect(x + 1, top, x + 1, 23, sh);
        api.px(x, top, '#ffffff');
      };
      scroll(18, 21, '#d9c18a', '#a8875c'); scroll(20, 20, '#e8ecf5', '#a8b8cc');
      scroll(22, 21, '#c9a227', '#8a6a1a'); scroll(24, 20, '#d9c18a', '#a8875c');
      api.px(20, 22, '#a22633'); api.px(21, 22, '#7a1a26');              // ribbon on one of them
      api.rect(4, 27, 27, 28, woodX);                                    // plinth
      api.rect(4, 27, 27, 27, wood);
    });

    const barrel = grounded(api => {
      /* Three flat bands of one brown is a bin. A barrel bulges at the belly,
         its staves run vertically in tones that do not quite match, and the
         iron stands proud of them. The inset is computed per row so the
         silhouette curves instead of being a box with a lid dropped on top. */
      const top = 9, bot = 27;
      for (let y = top; y <= bot; y++) {
        const t = (y - top) / (bot - top);
        const inset = Math.round(Math.abs(t - 0.5) * 3.6);
        for (let x = 8 + inset; x <= 24 - inset; x++) {
          const s = x - 8, n = api.hash(x, y * 3, 41);
          api.px(x, y, s < 2 ? (n > 0.6 ? '#f0bd8e' : woodL)
            : s < 5 ? (n > 0.5 ? woodL : woodM)
            : s < 12 ? (n > 0.5 ? wood : woodM)
            : s < 15 ? woodD : woodX);
        }
      }
      for (const sx of [10, 13, 16, 19, 22]) {                           // stave seams
        const lo = top + (sx === 10 || sx === 22 ? 2 : 1);
        api.rect(sx, lo, sx, bot - (sx === 10 || sx === 22 ? 2 : 1), woodX);
      }
      for (const [hy, hi] of [[12, 1], [18, 0], [25, 1]]) {              // hoops
        const ins = hi;
        api.rect(8 + ins, hy, 24 - ins, hy + 1, iron);
        api.rect(8 + ins, hy, 24 - ins, hy, ironL);
        api.rect(8 + ins, hy + 1, 24 - ins, hy + 1, ironD);
        api.px(10 + ins, hy, '#e0e8f4'); api.px(22 - ins, hy + 1, '#262b44');
      }
      api.ellipse(9, 7, 23, 12, woodM, true);                            // the head, seen from above
      api.ellipse(9, 7, 23, 12, woodD, false);
      api.ellipse(11, 8, 21, 11, wood, true);
      api.rect(12, 9, 20, 9, woodM); api.rect(12, 10, 20, 10, woodL);    // boards of the head
      api.px(19, 10, woodX); api.px(18, 10, '#2e1a18');                  // bung, off to one side
    });

    const crateStack = grounded(api => {
      /* Both crates were flat rectangles with an X scratched across them, and
         the X ran corner to corner of the whole box so the two read as one
         lumpy mass. A box needs a lid plane, a front plane and a corner. */
      const box = (x0, y0, x1, y1, seed) => {
        api.rect(x0, y0 + 2, x1, y1, wood);
        grain(api, x0 + 1, y0 + 3, x1 - 1, y1 - 1, seed, woodX, woodL);
        api.rect(x0, y0, x1, y0 + 2, woodL);                             // lid, seen from above
        api.rect(x0, y0, x1, y0, '#f0bd8e');
        api.rect(x1 - 1, y0, x1, y0 + 2, woodM);                         // its far edge, turning
        api.rect(x0, y0 + 3, x0, y1, woodL);                             // near upright
        api.rect(x1, y0 + 3, x1, y1, woodX);                             // far upright
        api.rect(x0, y1, x1, y1, woodX);                                 // foot rail
        api.rect(x0, y0 + 3, x1, y0 + 3, woodM);                         // under the lid lip
        const mx = (x0 + x1) >> 1;
        api.rect(mx, y0 + 4, mx, y1 - 1, woodM);                         // plank seam
        api.line(x0 + 1, y0 + 4, x1 - 1, y1 - 1, woodD, 1);              // one brace, not a cross
        api.px(x0 + 1, y0 + 4, iron); api.px(x1 - 1, y1 - 1, iron);      // its iron ends
      };
      box(5, 16, 19, 27, 13);
      box(14, 6, 26, 16, 29);
      api.rect(5, 20, 19, 21, iron); api.rect(5, 20, 19, 20, ironL);     // banding
      api.rect(5, 21, 19, 21, ironD);
      api.rect(14, 11, 26, 12, iron); api.rect(14, 11, 26, 11, ironL);
      api.rect(14, 12, 26, 12, ironD);
      api.px(9, 20, '#e0e8f4'); api.px(16, 21, '#262b44'); api.px(19, 11, '#e0e8f4');
      api.rect(17, 24, 19, 25, '#c9a227');                               // stencil on the lower crate
      api.px(18, 24, woodX);
    });

    const pot = grounded(api => {
      /* Half-widths down the profile. Two stacked ellipses gave it a mouth as
         wide as its belly, which is a bowl; a jar has a shoulder and a neck. */
      const prof = [[12, 19], [12, 19], [12, 19], [11, 20], [10, 21], [9, 22],
        [9, 22], [8, 23], [8, 23], [8, 23], [9, 22], [9, 22], [10, 21], [11, 20],
        [12, 19], [13, 18]];
      /* Light from the upper left, and the bands kept narrow. Four wide even
         bands across a sixteen-pixel belly put a pale slab down the left side
         and a brown one down the right, and the jar read as two materials
         joined rather than one round body: the highlight has to be a stripe,
         not a half. The lower third is pulled down a step as well, because a
         belly that stays at full value all the way to the foot looks like a
         cylinder that has been given a curved outline. */
      prof.forEach(([a, b], i) => {
        const y = 12 + i, v = i / (prof.length - 1);
        for (let x = a; x <= b; x++) {
          const t = (x - a) / (b - a), n = api.hash(x, y * 3, 47);
          let col = t < 0.07 ? '#9c3a22' : t < 0.26 ? '#d77643'
            : t < 0.60 ? '#be4a2f' : t < 0.86 ? '#9c3a22' : '#6f2a18';
          if (v > 0.74) col = t < 0.26 ? '#be4a2f' : t < 0.60 ? '#9c3a22' : '#6f2a18';
          if (n > 0.93) col = '#c85438';                                 // grit in the clay
          api.px(x, y, col);
        }
      });
      /* The rim sits one pixel proud of the neck, not four. Carried out to the
         width of the belly it overhung the whole jar and the profile stepped in
         under it, so the thing read as a funnel with a tray balanced on top. */
      /* Far lip, the gap, then the near lip. Stacked the other way round --
         lit band on top, dark band under it -- the three rows flattened into a
         plank and the jar looked capped rather than open. */
      api.rect(11, 10, 20, 12, '#d77643');
      api.rect(11, 10, 20, 10, '#a04e2a');                               // far lip, turned away
      api.rect(12, 11, 19, 11, '#2a1b18');                               // down into the jar
      api.px(12, 11, '#6f2a18'); api.px(19, 11, '#6f2a18');              // the mouth rounded off
      api.rect(11, 12, 20, 12, '#e4a672');                               // near lip, catching light
      api.px(11, 12, '#d77643'); api.px(20, 12, '#d77643');
      api.px(13, 12, '#f0bd8e');
      api.rect(12, 13, 19, 13, '#8f3a22');                               // its shadow on the neck
      /* A band the full width of the belly in a light tone cut the jar in half
         and read as a shelf growing out of it. Two thin painted rules, inset
         and dark, sit ON the pot instead of interrupting its silhouette. */
      api.rect(11, 17, 20, 17, '#6f2a18'); api.rect(11, 21, 20, 21, '#6f2a18');
      /* Slip, not perforation. Drawn every third column in near-black the
         motif covered most of the band and the belly read as a row of holes
         punched through it; a wider pitch in a clay tone keeps it painted on. */
      for (let x = 12; x <= 19; x += 4) {
        api.px(x, 19, '#6f2a18'); api.px(x + 1, 18, '#6f2a18'); api.px(x + 1, 20, '#6f2a18');
        api.px(x + 2, 19, '#6f2a18');
      }
      api.px(11, 15, '#f0bd8e'); api.px(11, 16, '#e4a672');              // glaze catching light
      api.px(12, 14, '#e4a672'); api.px(10, 22, '#d77643');
      api.rect(12, 26, 19, 27, '#8f3a22');                               // foot ring
      api.rect(12, 26, 19, 26, '#be4a2f');
      api.px(13, 27, '#a04e2a'); api.px(18, 27, '#6f2a18');
    });

    const rug = prop(api => {
      /* Ellipses in three reds with a yellow blob in the middle read as a pair
         of lips. A woven rug is rectangular, has a border, has a motif and is
         finished at the ends with fringe. */
      api.rect(4, 18, 27, 27, '#8a1f2c');
      api.rect(5, 19, 26, 26, '#a22633');
      for (let y = 19; y <= 26; y++) for (let x = 5; x <= 26; x++) {     // weave
        if (api.hash(x, y * 3, 53) > 0.82) api.px(x, y, '#b8303e');
      }
      api.rect(5, 19, 26, 19, '#c04050'); api.rect(5, 26, 26, 26, '#5c1a1a');
      api.rect(7, 20, 24, 25, '#e43b44');                                // inner field
      api.rect(7, 20, 24, 20, '#f06b6b'); api.rect(7, 25, 24, 25, '#a22633');
      for (let i = 0; i < 5; i++) {                                      // diamond chain
        const cx = 8 + i * 4;
        api.px(cx + 1, 21, gold); api.px(cx, 22, gold); api.px(cx + 2, 22, gold);
        api.px(cx + 1, 23, gold); api.px(cx + 1, 22, '#fee761');
      }
      api.rect(7, 24, 24, 24, '#c9a227');
      /* The fringe was two staggered rows of single pixels. Nothing in the
         upper row touched anything in the lower one edge-on, so the outline
         pass rimmed each tassel on all four sides and the rug came out with a
         row of black beads along both edges. A solid warp row first, tassels
         hung directly off it. */
      api.rect(4, 17, 27, 17, '#d9c18a'); api.rect(4, 28, 27, 28, '#a8875c');
      api.rect(4, 17, 27, 17, '#a8875c'); api.rect(4, 28, 27, 28, '#7a6040');
      for (let x = 5; x <= 26; x += 2) { api.px(x, 16, '#d9c18a'); api.px(x, 29, '#d9c18a'); }
    });

    /* The only piece here with a live flame, so it is the only one that earns
       frames. Wick height, glow and the cast light all move together. */
    const candelabra = k => grounded(api => {
      api.rect(11, 26, 20, 27, iron); api.rect(11, 26, 20, 26, ironL);   // spreading foot
      api.rect(11, 27, 20, 27, ironD);
      api.rect(13, 24, 18, 25, iron); api.rect(13, 24, 18, 24, ironL);
      api.rect(14, 22, 17, 23, ironD);                                   // knop above the foot
      api.rect(15, 12, 16, 22, iron);                                    // shaft
      api.rect(15, 12, 15, 22, ironL); api.rect(16, 12, 16, 22, ironD);
      api.rect(14, 16, 17, 17, ironL); api.rect(14, 17, 17, 17, ironD);  // collar
      /* Arms sweep out and up. A single straight rule across the shaft read as
         a crossbar with candles balanced on it. */
      for (const dir of [-1, 1]) {
        for (let i = 0; i <= 5; i++) {
          const x = 15 + dir * (1 + i), y = 15 + Math.round(i * i * 0.13) - (i > 3 ? 1 : 0);
          api.px(x, y, dir < 0 ? ironL : iron);
          api.px(x, y + 1, ironD);
        }
        const ex = 15 + dir * 6;
        api.rect(ex - 1, 13, ex + 1, 14, iron);                          // drip pan
        api.rect(ex - 1, 13, ex + 1, 13, ironL);
      }
      const flame = (x, y) => {
        const h = [3, 4, 3, 2][k] + (x === 15 ? 1 : 0);
        api.rect(x, y - h + 1, x + 1, y, '#f77622');
        api.rect(x, y - h + 2, x + 1, y - 1, '#feae34');
        api.px(x + (k & 1), y - h + 1, '#fff6c9');
        api.px(x, y, '#a83a1a'); api.px(x + 1, y, '#a83a1a');
        api.px(x + ((k >> 1) & 1), y - h, '#ffffff');                    // tip leaning with the draught
      };
      const candle = (x, top) => {
        api.rect(x, top, x + 1, top + 4, '#e8ecf5');                     // wax
        api.rect(x, top, x, top + 4, '#ffffff'); api.rect(x + 1, top, x + 1, top + 4, '#a8b8cc');
        api.px(x, top + 3, '#c0cbdc'); api.px(x + 1, top + 1, '#dfe4ef'); // run of wax
        flame(x, top - 1);
      };
      candle(8, 9); candle(15, 7); candle(21, 9);
      for (const [gx, gy] of [[9, 4], [15, 2], [22, 4]]) {               // halo around each wick
        if (k === 1 || k === 2) api.px(gx + (k - 1), gy, '#fee761');
      }
    });

    const stool = grounded(api => {
      /* The legs were two posts under a disc, which reads as a side table with
         a missing side. Three splayed legs is what says stool, and a splay
         needs the feet further out than the seat edge. */
      api.line(16, 20, 16, 26, woodX, 2);                                // rear leg, in shade
      api.px(15, 26, woodX); api.px(17, 26, woodX);
      api.line(12, 20, 9, 26, wood, 2); api.line(20, 20, 23, 26, wood, 2);
      api.line(11, 20, 8, 26, woodL, 1); api.line(21, 20, 24, 26, woodD, 1);
      api.rect(8, 26, 10, 27, woodD); api.rect(22, 26, 24, 27, woodD);   // feet
      api.line(11, 23, 20, 24, woodD, 1);                                // stretcher
      api.ellipse(7, 14, 24, 21, woodD, true);                           // seat, and its edge
      api.ellipse(7, 14, 24, 19, wood, true);
      grain(api, 9, 15, 22, 18, 61, woodM, woodL);
      api.ellipse(8, 14, 23, 18, woodL, true);                           // the face catching light
      api.rect(10, 14, 21, 14, '#f0bd8e');
      api.rect(9, 20, 22, 21, woodX);                                    // underside, in shade
      api.px(12, 16, '#fff6c9'); api.px(19, 17, woodM);
    });

    return { width: 32, height: 32, name: 'rpg-furniture', layers: [{ name: 'Furniture' }], states: [
      S1('table', table), S1('chair', chair), S1('bed', bed), S1('bookshelf', bookshelf),
      S1('barrel', barrel), S1('crate_stack', crateStack), S1('clay_pot', pot),
      S1('rug', rug), D('candelabra', 7, true, [0, 1, 2, 3].map(k => Fr(ms(7), candelabra(k)))),
      S1('stool', stool)
    ] };
  }

  /* ================= WEATHER (full-frame overlays) ================= */
  function weatherSuite() {
    // deterministic scatter so each frame scrolls without Math.random
    const drops = (n, seed, step) => {
      const out = [];
      for (let i = 0; i < n; i++) {
        const x = (i * 37 + seed * 13) % 34 - 1;
        const y = (i * 53 + step * 11 + seed * 7) % 32;
        out.push([x, y]);
      }
      return out;
    };
    const rain = k => (buf, W, H) => {
      const api = apiFor(buf, W, H);
      drops(16, 0, k).forEach(([x, y]) => {
        api.line(x, y, x + 1, y + 3, '#8b9bb4', 1);
        api.px(x + 1, y + 4, '#c0cbdc');
      });
      drops(6, 2, k).forEach(([x, y]) => { api.line(x, y, x + 1, y + 4, '#c0cbdc', 1); });
      finish(buf, W, H);
    };
    const snow = k => (buf, W, H) => {
      const api = apiFor(buf, W, H);
      drops(14, 1, k).forEach(([x, y], i) => {
        const sway = (k + i) % 2;
        api.px(x + sway, y, '#ffffff'); api.px(x + sway, y + 1, '#e8ecf5');
        api.px(x + 1 + sway, y, '#ffffff');
      });
      finish(buf, W, H);
    };
    const storm = k => (buf, W, H) => {
      const api = apiFor(buf, W, H);
      if (k === 2) { // flash frame: whole tile blown out
        api.rect(0, 0, 31, 31, '#e8ecf5');
        api.rect(0, 0, 31, 12, '#ffffff');
        api.line(20, 2, 14, 16, '#fee761', 2);
        api.line(14, 16, 20, 20, '#ffffff', 2);
        api.line(20, 20, 15, 30, '#fee761', 2);
        finish(buf, W, H); return;
      }
      drops(14, 3, k).forEach(([x, y]) => { api.line(x, y, x + 1, y + 5, '#5a6988', 1); });
      drops(5, 5, k).forEach(([x, y]) => { api.line(x, y, x + 2, y + 4, '#8b9bb4', 1); });
      api.ellipse(2, 0, 14, 5, '#3a4466', true);
      api.ellipse(13, 0, 27, 6, '#262b44', true);
      finish(buf, W, H);
    };
    const fog = k => (buf, W, H) => {
      const api = apiFor(buf, W, H);
      // Mist is stippled (this raster has no soft alpha). A plain ordered
      // dither reads as a barcode and a gated one reads as speed lines, so
      // each bank gets a wavy top edge and a density that falls off towards
      // its edges - the stipple then fades out instead of stopping dead.
      const THICK = 6;
      for (let b = 0; b < 3; b++) {
        const y0 = 5 + b * 8 + ((k + b) % 2);
        for (let x = 0; x < 32; x++) {
          const wave = Math.sin(x / 4.5 + k * 0.9 + b * 2.1) * 1.6 + Math.sin(x / 9.5 - k * 0.6 + b) * 1.2;
          const top = y0 + Math.round(wave);
          for (let y = top; y < top + THICK; y++) {
            if (y < 0 || y >= 32) continue;
            const density = Math.sin(((y - top) / THICK) * Math.PI); // 0 at the edges, 1 mid-bank
            const d = (x * 13 + y * 29 + b * 37) % 100;
            if (d < density * 70) api.px(x, y, d % 3 === 0 ? '#c0cbdc' : '#8b9bb4');
          }
        }
      }
      finish(buf, W, H);
    };
    const leaves = k => (buf, W, H) => {
      const api = apiFor(buf, W, H);
      const cols = ['#e43b44', '#f77622', '#feae34', '#b86f50'];
      for (let i = 0; i < 10; i++) {
        const x = (i * 41 + k * 5) % 32, y = (i * 29 + k * 9) % 32;
        const c = cols[i % 4];
        api.px(x, y, c); api.px(x + 1, y, c); api.px(x, y + 1, c);
        if (k % 2) api.px(x + 1, y + 1, c);
      }
      finish(buf, W, H);
    };
    const ash = k => (buf, W, H) => {
      const api = apiFor(buf, W, H);
      for (let i = 0; i < 12; i++) {
        const x = (i * 43 + k * 3) % 32, y = (i * 31 + k * 7) % 32;
        api.px(x, y, '#8b9bb4'); api.px(x, y + 1, '#5a6988');
        if (i % 3 === 0) api.px(x + 1, y, '#f77622');
      }
      finish(buf, W, H);
    };
    const fireflies = k => (buf, W, H) => {
      const api = apiFor(buf, W, H);
      for (let i = 0; i < 7; i++) {
        const x = (i * 19 + k * 4) % 30 + 1, y = (i * 23 + k * 5) % 26 + 3;
        const near = (i + k) % 3 === 0;
        api.px(x, y, '#fff6c9');
        if (near) { api.px(x - 1, y, '#fee761'); api.px(x + 1, y, '#fee761'); api.px(x, y - 1, '#feae34'); api.px(x, y + 1, '#feae34'); }
      }
      finish(buf, W, H);
    };
    const sand = k => (buf, W, H) => {
      const api = apiFor(buf, W, H);
      for (let i = 0; i < 20; i++) {
        const x = (i * 47 + k * 6) % 34 - 1, y = (i * 17 + k * 3) % 32;
        api.line(x, y, x + 3, y, '#e4a672', 1);
      }
      for (let i = 0; i < 10; i++) {
        const x = (i * 31 + k * 8) % 34 - 1, y = (i * 13 + k * 5) % 32;
        api.line(x, y, x + 5, y, '#d77643', 1);
      }
      finish(buf, W, H);
    };

    return { width: 32, height: 32, name: 'rpg-weather', layers: [{ name: 'Weather' }], states: [
      D('rain', 14, true, [0, 1, 2, 3].map(k => Fr(ms(14), rain(k)))),
      D('snow', 6, true, [0, 1, 2, 3].map(k => Fr(ms(6), snow(k)))),
      D('storm', 10, true, [0, 1, 2, 3].map(k => Fr(ms(10), storm(k)))),
      D('fog', 5, true, [0, 1, 2, 3].map(k => Fr(ms(5), fog(k)))),
      D('leaves', 8, true, [0, 1, 2, 3].map(k => Fr(ms(8), leaves(k)))),
      D('ash', 8, true, [0, 1, 2, 3].map(k => Fr(ms(8), ash(k)))),
      D('fireflies', 6, true, [0, 1, 2, 3].map(k => Fr(ms(6), fireflies(k)))),
      D('sandstorm', 12, true, [0, 1, 2, 3].map(k => Fr(ms(12), sand(k))))
    ] };
  }

  return { trapsSuite, furnitureSuite, weatherSuite };
})();
