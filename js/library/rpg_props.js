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
    const stone = '#5a6988', stoneD = '#3a4466', stoneL = '#8b9bb4', stoneX = '#262b44';
    const metal = '#c0cbdc', metalD = '#5a6988', metalL = '#e8ecf5', metalX = '#3a4466';
    const rust = '#8f563b', blood = '#8b2b2b', dark = '#181425';

    /* Cut stone, sampled per pixel. Every block in this pack is a flat field of
       one blue-grey, and at this size a field with no incident in it stops
       reading as masonry and starts reading as a UI panel. */
    const grit = (api, x0, y0, x1, y1, seed) => {
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const n = api.hash(x, y * 3, seed);
        if (n > 0.92) api.px(x, y, stoneL);
        else if (n < 0.09) api.px(x, y, stoneX);
      }
    };

    /* A spike is a cone, not a line. Drawn as six identical one-pixel columns
       at an even pitch the old trap came out as a picket fence, which is the
       same failure as a row of prison bars: regular modulus reads as fencing,
       never as a set of blades. These taper, and no two are the same height. */
    const spike = (api, x, yBase, h, lit, bw) => {
      if (h <= 0) return;
      for (let j = 0; j <= h; j++) {
        const y = yBase - j, w = Math.round((1 - j / h) * (bw || 1.45));
        api.rect(x - w, y, x + w, y, metal);
        if (w) { api.px(x - w, y, lit ? metalL : metalD); api.px(x + w, y, metalX); }
      }
      api.px(x, yBase - h, '#ffffff');
    };

    // floor spikes: plate flush -> blades punch up -> hold -> retract
    const SPK = [[8, 1], [13, -1], [18, 2], [23, 0]];
    const spikes = k => prop(api => {
      api.rect(4, 25, 27, 29, stoneD);
      api.rect(4, 25, 27, 25, stoneL);
      api.rect(5, 26, 26, 28, stone);
      grit(api, 5, 26, 26, 28, 13);
      api.rect(4, 29, 27, 29, stoneX);                                   // shadow on the floor
      const ph = [0, 6, 10, 4][k];
      for (const [x, bias] of SPK) {
        api.rect(x - 1, 25, x + 1, 26, dark);                            // the bore through it
        api.px(x - 2, 25, stoneX); api.px(x + 2, 25, stoneX);
        if (!ph) { api.rect(x - 1, 26, x + 1, 26, metalX); continue; }   // steel waiting below
        spike(api, x, 25, Math.max(2, ph + bias), x < 16);
      }
      if (k === 1) for (const [x] of SPK) {                              // grit thrown up
        api.px(x - 3, 24, stoneL); api.px(x + 3, 23, stone);
      }
      if (k === 2) { api.px(13, 17, blood); api.px(18, 14, blood); api.px(8, 19, blood); }
    });

    // wall dart trap: a bore in the masonry, dart crosses the tile
    const darts = k => prop(api => {
      api.rect(1, 9, 8, 23, stoneD);                                     // the emitter block
      api.rect(1, 9, 8, 10, stoneL);
      api.rect(1, 11, 7, 21, stone);
      grit(api, 1, 11, 7, 21, 7);
      api.rect(1, 22, 8, 23, stoneX);
      api.rect(2, 16, 8, 16, stoneX); api.rect(2, 11, 8, 11, stoneX);    // coursing joints
      api.ellipse(3, 13, 7, 19, stoneX, true);                           // the bore, recessed
      api.ellipse(4, 14, 7, 18, dark, true);
      /* Head, shaft, fletching. A one-pixel rule with a blob on the end was a
         syringe; what makes a dart at this size is the taper at one end and
         two feathers at the other. */
      const dart = hx => {
        api.line(hx - 9, 16, hx - 3, 16, rust, 1);                       // shaft
        api.px(hx - 9, 15, '#c9a227'); api.px(hx - 8, 15, '#7a5c1e');    // fletching
        api.px(hx - 9, 17, '#7a5c1e'); api.px(hx - 8, 17, '#4a3812');
        api.rect(hx - 3, 15, hx - 2, 17, metalD);                        // socket
        api.rect(hx - 2, 15, hx - 1, 17, metal);
        api.px(hx - 1, 15, metalL);
        api.px(hx, 16, '#ffffff');                                       // the point
        api.px(hx - 2, 16, metalL);
      };
      if (k === 0) { api.px(6, 16, metal); api.px(7, 16, metalL); return; }
      const hx = [0, 15, 24, 31][k];
      if (k === 1) {                                                     // dust off the muzzle
        api.px(8, 13, stoneL); api.px(9, 19, stone); api.px(10, 12, stoneX);
        api.px(9, 14, stoneL); api.px(8, 18, stoneL);
      }
      for (let x = 9; x < hx - 10; x += 2) api.px(x, 16, metalX);        // the streak it leaves
      dart(hx);
    });

    /* Swinging saw. A crescent hung off the end of a rod is unreadable at this
       size whatever the profile: rod above, wide shape below, keen edge along
       the bottom of it, and the eye assembles a leg in a boot every time. A
       toothed disc on a rigid arm says blade trap the moment it is on screen,
       and it has somewhere to put the animation -- the disc turns as it goes. */
    const blade = k => prop(api => {
      api.rect(13, 0, 18, 4, stoneD);                                    // ceiling mount
      api.rect(14, 0, 17, 3, stone);
      api.rect(13, 4, 18, 4, stoneX);
      api.px(14, 1, stoneL); api.px(17, 3, stoneX);
      const a = [-0.38, -0.13, 0.13, 0.38][k], cx = 16, cy = 4, arm = 13, R = 8;
      const bx = Math.round(cx + Math.sin(a) * arm), by = Math.round(cy + Math.cos(a) * arm);
      api.line(cx, cy, bx, by, metalX, 3);                               // the arm
      api.line(cx, cy, bx, by, metalD, 1);
      api.ellipse(cx - 2, cy - 2, cx + 2, cy + 2, metalD, true);         // the pivot boss
      api.px(cx - 1, cy - 1, metalL); api.px(cx + 1, cy + 1, metalX);
      if (k === 1 || k === 2) for (let t = 0.12; t < 0.40; t += 0.02) {  // the arc it came round
        const th = a + (a < 0 ? t : -t);
        api.px(cx + Math.sin(th) * (arm + R), cy + Math.cos(th) * (arm + R), stoneX);
      }
      /* Nine teeth, raked, and two pixels thick at the root. At one pixel each
         the outline pass boxed every one of them separately and the disc came
         out looking like a sea urchin. */
      const spin = k * 0.17;
      for (let i = 0; i < 9; i++) {
        const th = spin + i * (Math.PI * 2 / 9);
        api.line(bx + Math.cos(th - 0.24) * (R - 2), by + Math.sin(th - 0.24) * (R - 2),
          bx + Math.cos(th + 0.04) * (R + 2.2), by + Math.sin(th + 0.04) * (R + 2.2), metal, 2);
        api.px(bx + Math.cos(th + 0.04) * (R + 2.2), by + Math.sin(th + 0.04) * (R + 2.2), metalL);
      }
      api.ellipse(bx - R, by - R, bx + R, by + R, metalD, true);         // the plate
      /* Two discs offset by a pixel leave a crescent of light on the shoulder
         that faces the lamp. Filled flat in the light tone the plate washed out
         and stopped reading as steel. */
      api.ellipse(bx - R + 1, by - R + 1, bx + R - 1, by + R - 1, metalL, true);
      api.ellipse(bx - R + 2, by - R + 2, bx + R, by + R, metal, true);
      for (let i = 0; i < 4; i++) {                                      // lightening holes
        const th = spin * 2 + 0.4 + i * (Math.PI / 2);
        const hx = bx + Math.cos(th) * 4.8, hy = by + Math.sin(th) * 4.8;
        api.rect(hx - 1, hy - 1, hx, hy, metalX);
        api.px(hx - 1, hy - 1, dark);
      }
      api.ellipse(bx - 3, by - 3, bx + 3, by + 3, metalD, true);         // the hub
      api.ellipse(bx - 2, by - 2, bx + 2, by + 2, metalX, true);
      api.px(bx - 1, by - 1, metal); api.px(bx + 1, by + 1, dark);
    });

    // pressure plate: standing proud / trodden flush
    const plate = down => prop(api => {
      api.rect(2, 26, 29, 29, stoneD);                                   // the floor around it
      api.rect(2, 26, 29, 26, stoneL);
      grit(api, 2, 27, 29, 29, 19);
      api.rect(6, 26, 25, 29, dark);                                     // the socket it drops into
      const y = down ? 26 : 22;
      api.rect(6, y + 1, 25, 29, stone);                                 // the side of the slab
      api.rect(6, y, 25, y, stoneL);                                     // its top face, lit
      api.rect(6, y + 1, 25, y + 1, stoneD);                             // chamfer under the face
      api.rect(25, y + 1, 25, 29, stoneD);
      grit(api, 7, y + 2, 24, 29, 27);
      if (!down) api.rect(26, y + 2, 27, 29, stoneX);                    // shadow it casts
      /* A glyph, so the slab reads as a trigger rather than a kerbstone, and
         so the two frames differ in more than four rows of travel. */
      const glow = down ? '#e43b44' : '#6b2a33';
      api.rect(14, y, 17, y, glow);
      api.px(13, y, glow); api.px(18, y, glow);
      api.px(12, y + 1, glow); api.px(19, y + 1, glow);
      if (down) {
        api.px(15, y, '#ff8a8a'); api.px(16, y, '#ff8a8a');
        api.rect(3, 25, 5, 25, stoneL); api.rect(26, 25, 28, 25, stone); // grit jarred loose
      }
    });

    /* Flame jet. A stack of three concentric ellipses is a lozenge; fire has a
       ragged edge and a core that is hottest just off the nozzle. */
    const jet = k => prop(api => {
      const h = [2, 10, 16, 7][k], lit = h > 3;
      api.rect(9, 25, 22, 29, stoneD);                                   // the grate housing
      api.rect(9, 25, 22, 25, lit ? '#f77622' : stoneL);
      api.rect(10, 26, 21, 28, stoneX);
      grit(api, 10, 27, 21, 28, 23);
      for (const sx of [11, 14, 17, 20]) {
        api.rect(sx, 26, sx + 1, 28, dark);                              // bores through it
        if (lit) api.px(sx, 26, '#feae34');
      }
      for (let j = 0; j <= h; j++) {
        const y = 26 - j, t = j / h;
        const w = 5.4 * Math.pow(1 - t, 0.42) * (1 - 0.5 * t)
          + (api.hash(j * 5, k * 13, 3) - 0.5) * 1.6;
        if (w < 0.4) break;
        for (let x = Math.round(16 - w); x <= Math.round(15.5 + w); x++) {
          const u = Math.abs(x - 15.5) / w;
          api.px(x, y, t > 0.82 ? (u < 0.5 ? '#f77622' : '#e43b44')
            : u > 0.74 ? '#f77622' : u > 0.42 ? '#feae34'
              : t < 0.22 ? '#ffffff' : '#fee761');
        }
      }
      if (k >= 2) {                                                      // embers off the top
        api.px(11, 26 - h - 2, '#f77622'); api.px(21, 26 - h - 3, '#feae34');
        api.px(19, 26 - h - 6, '#f77622');
      }
    });

    /* Bear trap, seen from above. Two horizontal rules with a comb of pixels
       between them read as a grille; a trap reads from a round base, a pan in
       the middle of it, and two bowed jaws whose teeth interlock when shut. */
    const jaw = (api, yc, s2) => {
      const at = x => { const u = (x - 15.5) / 9.2; return Math.round(yc - s2 * 2 * (1 - u * u)); };
      for (let x = 7; x <= 24; x++) {
        const y = at(x);
        api.px(x, y, metal); api.px(x, y - s2, metalX);
        if (x % 5 === 2) api.px(x, y, metalL);                           // light along the top
        if (x === 7 || x === 24) api.px(x, y + s2, metalX);              // the hinge ends
      }
      for (const [x, len] of [[10, 2], [14, 3], [18, 3], [22, 2]]) {
        const y0 = at(x) + s2;
        for (let j = 0; j < len; j++) {
          const w = j === 0 ? 1 : 0, ty = y0 + s2 * j;
          api.rect(x - w, ty, x + w, ty, j === len - 1 ? '#ffffff' : metal);
          if (w) api.px(x + 1, ty, metalX);
        }
      }
    };
    const bear = k => grounded(api => {
      /* The body has to sit well below the jaws in value. Base, springs and
         jaws all in the same pale steel turned the whole trap into one bright
         scribble and nothing in it could be told from anything else. */
      api.ellipse(5, 20, 26, 29, metalX, true);                          // base plate
      api.ellipse(6, 21, 25, 28, stoneX, true);
      api.ellipse(7, 22, 24, 27, '#1f2438', true);
      api.px(8, 22, metalD); api.px(23, 27, dark);
      for (const sx of [6, 25]) {                                        // leaf springs
        api.rect(sx - 2, 23, sx + 2, 26, metalX);
        api.rect(sx - 2, 23, sx + 2, 23, metalD);
        api.px(sx - 1, 24, metal); api.px(sx + 1, 26, dark);
      }
      api.ellipse(13, 22, 18, 26, metalD, true);                         // the pan
      api.ellipse(14, 23, 17, 25, rust, true);
      api.px(15, 23, '#c07a52');
      const open = [0, 2, 4][k];
      jaw(api, 23 - open, 1);
      jaw(api, 24 + open, -1);
      api.rect(14, 29, 17, 30, metalX);                                  // the stake chain
      api.px(15, 30, metalD);
      if (k === 1) { api.px(8, 18, '#e43b44'); api.px(23, 18, '#e43b44'); }
      if (k === 2) { api.px(11, 17, blood); api.px(20, 18, blood); }
    });

    // spike pit: a hole in the floor with a bed of blades in it
    const pit = prop(api => {
      api.ellipse(2, 15, 29, 30, stoneD, true);                          // the kerb around it
      api.ellipse(2, 15, 29, 30, stoneL, false);
      grit(api, 4, 16, 27, 20, 29);
      api.ellipse(4, 17, 27, 29, dark, true);                            // the hole
      api.ellipse(5, 18, 26, 23, stoneX, true);                          // far wall, catching light
      api.ellipse(6, 19, 25, 22, '#1f2438', true);
      /* The back row is drawn in the wall's own dark tones and the front row in
         steel. One bed of identical blades came out as a drain grating: what
         gives a pit depth is two ranks at different values, offset from each
         other so no two points line up in a column. */
      for (const [x, h] of [[10, 4], [16, 3], [22, 5]]) {
        for (let j = 0; j <= h; j++) {
          const w = Math.round((1 - j / h) * 1.2);
          api.rect(x - w, 23 - j, x + w, 23 - j, metalX);
        }
        api.px(x, 23 - h, metalD);
      }
      api.ellipse(5, 24, 26, 29, dark, true);                            // near wall, in shadow
      for (const [x, h] of [[8, 6], [13, 8], [19, 7], [24, 5]]) spike(api, x, 28, h, x < 16, 2.3);
      api.px(12, 28, '#a8b8cc'); api.px(11, 28, '#e8ecf5');              // bones at the bottom
      api.px(21, 28, '#c0cbdc');
    });

    /* Chain and spiked ball. A dotted line is not a chain -- links alternate
       between edge-on and face-on, which is what gives it the beaded look at
       this size -- and a smooth disc with four pixels stuck to it is not a
       morningstar. */
    const chain = k => prop(api => {
      api.rect(13, 0, 18, 3, stoneD);
      api.rect(14, 0, 17, 2, stone);
      api.px(14, 1, stoneL); api.rect(13, 3, 18, 3, stoneX);
      const a = [-0.35, 0, 0.35, 0.15][k], cx = 16, cy = 3, R = 16;
      const si = Math.sin(a), co = Math.cos(a);
      for (let t = 0; t < 5; t++) {
        const d = 2 + t * 2.6, lx = cx + si * d, ly = cy + co * d;
        if (t % 2) { api.rect(lx - 1, ly, lx + 1, ly, metalD); api.px(lx, ly, metal); }
        else { api.rect(lx, ly - 1, lx, ly + 1, metalD); api.px(lx, ly, metalL); }
      }
      const bx = Math.round(cx + si * R), by = Math.round(cy + co * R);
      /* Body first, spikes over it. Drawn the other way round, each spike was
         a three-wide block whose inner two thirds the ball then covered, so
         all eight came out as nubs and the head read as a smooth ball. */
      api.ellipse(bx - 4, by - 4, bx + 4, by + 4, metalX, true);
      api.ellipse(bx - 3, by - 3, bx + 3, by + 3, metalD, true);
      api.ellipse(bx - 3, by - 3, bx + 1, by + 1, metal, true);
      api.px(bx - 2, by - 2, metalL); api.px(bx - 1, by - 2, '#ffffff');
      api.px(bx + 2, by + 2, dark);
      /* Short and thick. Eight one-pixel rays of even length in the ball's own
         highlight tone came out as a snowflake; a morningstar spike is a stub
         that barely clears the body and carries the body's shading. */
      for (const [dx, dy, len] of [[-1, -1, 7], [1, -1, 6], [-1, 1, 7], [1, 1, 6],
        [0, 1, 8], [-1, 0, 7], [1, 0, 7], [0, -1, 6]]) {
        const n = Math.hypot(dx, dy);
        for (let j = 4; j <= len; j++) {
          const px = bx + dx / n * j, py = by + dy / n * j;
          if (j <= len - 2) api.rect(px - Math.abs(dy), py - Math.abs(dx),
            px + Math.abs(dy), py + Math.abs(dx), dx + dy < 0 ? metalD : metalX);
          api.px(px, py, j === len ? metalL : dx + dy < 0 ? metal : metalD);
        }
      }
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
    /* An overlay is composited over a scene, which makes this the one pack in
       the library that must NOT be outlined. Every particle here used to go
       through the same finish() as a chest or a chair, so each raindrop came
       back with a 1px black rim round it and read as a tadpole, each snowflake
       as an eyeball and the fog banks as a heap of gravel. Particles carry
       their own two-tone shading instead -- a dark side and a light side --
       which is what keeps them legible over a pale sky as well as a dark one. */
    const over = painter => (buf, W, H) => painter(apiFor(buf, W, H));

    /* One field per depth layer, laid out once and scrolled by frame index, so
       the four-frame loop tiles in time the way the sprite tiles in space. */
    const field = (n, seed, k, vx, vy) => {
      const out = [];
      for (let i = 0; i < n; i++) {
        const bx = (i * 37 + seed * 71) % 32, by = (i * 53 + seed * 29) % 32;
        out.push([((bx + vx * k) % 32 + 32) % 32, ((by + vy * k) % 32 + 32) % 32, i]);
      }
      return out;
    };
    /* Stippled haze. There is no soft alpha in this raster, so density has to
       be carried by how many pixels are set rather than how strong they are. */
    /* Sampled from the hash, not from a modulus. The arithmetic version put
       every set pixel on a lattice and the dither came out as a hatch of
       diagonal pinstripes -- fine for a fabric, useless for weather. */
    const haze = (api, y0, y1, amt, col, seed) => {
      for (let y = y0; y <= y1; y++) for (let x = 0; x < 32; x++) {
        if (api.hash(x, y, seed) * 100 < amt) api.px(x, y, col);
      }
    };

    /* Three ranks at three lengths, speeds and values. One rank of identical
       drops is a screen of tally marks; depth is the whole effect. */
    const RAIN = [
      { n: 20, len: 3, sl: 1, vy: 9, hi: '#7c93b8', lo: '#4a5f80' },
      { n: 12, len: 5, sl: 1, vy: 14, hi: '#a8c0dc', lo: '#4a628a' },
      { n: 6, len: 8, sl: 2, vy: 21, hi: '#e8f2ff', lo: '#5a7ba8' }
    ];
    const rain = k => over(api => {
      RAIN.forEach((L, li) => field(L.n, li + 1, k, L.sl, L.vy).forEach(([x, y]) => {
        api.line(x + 1, y, x + 1 + L.sl, y + L.len, L.lo, 1);           // the side in shadow
        api.line(x, y, x + L.sl, y + L.len, L.hi, 1);
      }));
      field(6, 9, k, 5, 11).forEach(([x, y]) => {                       // drops breaking up
        api.px(x, y, '#c0cbdc'); api.px(x + 2, y + 1, '#8b9bb4');
        api.px(x - 1, y + 2, '#8b9bb4');
      });
    });

    const snow = k => over(api => {
      field(22, 1, k, 0, 3).forEach(([x, y, i]) => {                    // far, barely moving
        api.px(x + Math.round(Math.sin((y + k * 3 + i) * 0.6) * 1.2), y, '#9fb3cc');
      });
      field(12, 2, k, 0, 5).forEach(([x, y, i]) => {                    // mid
        const cx = x + Math.round(Math.sin((y + k * 4 + i) * 0.5) * 1.6);
        api.rect(cx, y, cx + 1, y + 1, '#dce6f2');
        api.px(cx, y, '#ffffff');
      });
      field(5, 3, k, 0, 7).forEach(([x, y, i]) => {                     // near, a real flake
        const cx = x + Math.round(Math.sin((y + k * 5 + i) * 0.45) * 2);
        api.rect(cx - 1, y, cx + 1, y, '#ffffff');
        api.rect(cx, y - 1, cx, y + 1, '#ffffff');
        api.px(cx - 1, y - 1, '#c0cbdc'); api.px(cx + 1, y + 1, '#c0cbdc');
        api.px(cx + 1, y - 1, '#c0cbdc'); api.px(cx - 1, y + 1, '#c0cbdc');
      });
    });

    /* Lightning. A two-segment yellow ribbon on a solid white tile blanked the
       scene out and read as a logo; a bolt forks, tapers, and the flash is a
       dither so what is underneath still shows through it. */
    const boltPath = [[20, -1], [17, 5], [20, 8], [15, 15], [18, 18], [12, 26], [14, 28], [10, 32]];
    const branch = [[18, 18], [24, 23], [22, 26], [26, 31]];
    const storm = k => over(api => {
      if (k === 2) {
        haze(api, 0, 31, 62, '#dce6f2', 3);
        haze(api, 0, 14, 84, '#ffffff', 7);
        haze(api, 15, 31, 34, '#ffffff', 11);
        const run = (pts, w, col) => {
          for (let i = 0; i < pts.length - 1; i++) {
            api.line(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], col, w);
          }
        };
        /* Three pixels wide, white-hot, with the warmth scattered around it
           rather than laid under it. At five wide with a solid amber outer
           the stroke was a sixth of the tile across and read as a river of
           lava; and a solid fringe the same length as the core just made the
           bolt look drawn with a marker. */
        for (let i = 0; i < boltPath.length - 1; i++) {
          const [ax, ay] = boltPath[i], [bx, by] = boltPath[i + 1];
          for (let t = 0; t <= 1; t += 0.06) {
            const gx = ax + (bx - ax) * t, gy = ay + (by - ay) * t;
            if (api.hash(Math.round(gx), Math.round(gy), 5) > 0.45) continue;
            api.px(gx + 2, gy, '#feae34'); api.px(gx - 2, gy, '#feae34');
          }
        }
        run(boltPath, 3, '#fee761'); run(branch, 3, '#fee761');
        run(boltPath, 1, '#ffffff'); run(branch, 1, '#fff6c9');
        return;
      }
      haze(api, 0, 31, 10, '#3a4466', 5);                               // the squall itself
      field(16, 3, k, 3, 17).forEach(([x, y]) => {
        api.line(x + 1, y, x + 3, y + 6, '#3f5170', 1);
        api.line(x, y, x + 2, y + 6, '#7c93b8', 1);
      });
      field(7, 5, k, 4, 24).forEach(([x, y]) => {
        api.line(x, y, x + 3, y + 9, '#c0cbdc', 1);
      });
      api.ellipse(-2, -6, 15, 5, '#262b44', true);                      // cloud base overhead
      api.ellipse(11, -7, 30, 4, '#1f2438', true);
      api.ellipse(-2, -6, 15, 2, '#3a4466', true);
      if (k === 3) haze(api, 0, 8, 22, '#5a6988', 11);                  // the flash dying out
    });

    /* Three banks at three densities, each drifting at its own rate. A single
       even dither reads as a barcode; the wavy top edge and the falloff toward
       each bank's own edges are what make it stop dead nowhere. */
    const fog = k => over(api => {
      const BANK = [[3, 7, 58, '#5a6988', 0.7], [11, 6, 74, '#8b9bb4', 1.1],
        [20, 8, 88, '#c0cbdc', 1.6]];
      BANK.forEach(([y0, thick, amt, col, sp], b) => {
        for (let x = 0; x < 32; x++) {
          const wave = Math.sin(x / 4.5 + k * sp + b * 2.1) * 1.7
            + Math.sin(x / 9.5 - k * sp * 0.6 + b) * 1.3;
          const top = y0 + Math.round(wave);
          for (let y = top; y < top + thick; y++) {
            if (y < 0 || y >= 32) continue;
            const d = Math.sin(((y - top) / thick) * Math.PI);
            const n = (((x + Math.round(k * sp * 3)) * 13) + y * 29 + b * 37) % 100;
            if (n < d * amt) api.px(x, y, n % 4 === 0 ? '#e8ecf5' : col);
          }
        }
      });
    });

    /* Leaves tumble. Four blobs of flat colour scrolling on a fixed diagonal
       were confetti; a leaf has a shape, a vein and an orientation that turns
       as it falls. */
    const LEAF = [
      [[0, 0], [1, 0], [2, 0], [1, 1]],
      [[1, 0], [2, 0], [0, 1], [1, 1]],
      [[1, 0], [1, 1], [1, 2], [0, 1]],
      [[0, 0], [1, 0], [1, 1], [2, 1]]
    ];
    const LCOL = [['#e43b44', '#8b2b2b'], ['#f77622', '#9c3a12'], ['#feae34', '#a9642a'],
      ['#b86f50', '#733e39'], ['#a22633', '#5c1a24']];
    const leaves = k => over(api => {
      field(7, 1, k, 2, 4).forEach(([x, y, i]) => {                     // far, small and dim
        const [c, d] = LCOL[(i + 2) % 5];
        api.px(x, y, d); api.px(x + 1, y, c);
      });
      field(9, 4, k, 3, 6).forEach(([x, y, i]) => {
        const [c, d] = LCOL[i % 5], shape = LEAF[(i + k) % 4];
        shape.forEach(([dx, dy], j) => api.px(x + dx, y + dy, j === 0 ? d : c));
        api.px(x + 2, y + 2, d);                                        // the stem
      });
      field(3, 6, k, 4, 9).forEach(([x, y, i]) => {                     // near, one row bigger
        const [c, d] = LCOL[(i + 1) % 5], shape = LEAF[(i + k + 2) % 4];
        shape.forEach(([dx, dy]) => { api.rect(x + dx, y + dy, x + dx + 1, y + dy, c); });
        api.px(x + 1, y + 1, d); api.px(x + 3, y + 2, d);
      });
    });

    const ash = k => over(api => {
      haze(api, 0, 31, 6, '#3a4466', 17);                               // the pall in the air
      field(16, 1, k, -1, 4).forEach(([x, y, i]) => {                   // cold flakes, settling
        api.px(x, y, i % 2 ? '#8b9bb4' : '#5a6988');
        if (i % 4 === 0) api.px(x, y + 1, '#3a4466');
      });
      field(7, 4, k, -2, 6).forEach(([x, y]) => {
        api.px(x, y, '#c0cbdc'); api.px(x + 1, y + 1, '#5a6988');
      });
      field(4, 8, k, 1, -5).forEach(([x, y, i]) => {                    // embers, still rising
        api.px(x, y, '#fee761');
        api.px(x, y + 1, '#f77622'); api.px(x + 1, y, '#f77622');
        if ((i + k) % 2) api.px(x, y + 2, '#8f3a22');
      });
    });

    const fireflies = k => over(api => {
      field(9, 2, k, 1, -1).forEach(([x, y, i]) => {                    // far, just sparks
        if ((i + k) % 3) api.px(x, y, '#c9a227');
      });
      field(6, 5, k, 1, -2).forEach(([x, y, i]) => {
        const ph = (i + k) % 4;
        if (ph === 3) { api.px(x, y, '#7a5c1e'); return; }              // between pulses
        api.px(x, y, '#fff6c9');
        api.px(x - 1, y, '#fee761'); api.px(x + 1, y, '#fee761');
        api.px(x, y - 1, '#fee761'); api.px(x, y + 1, '#fee761');
        /* Round the halo off with the diagonals. Four cardinal pixels alone
           made a sharp plus and the swarm came out as a sky full of asterisks
           rather than of soft lights. */
        api.px(x - 1, y - 1, '#feae34'); api.px(x + 1, y - 1, '#feae34');
        api.px(x - 1, y + 1, '#feae34'); api.px(x + 1, y + 1, '#feae34');
        if (ph === 1) {                                                 // at full brightness
          api.px(x - 2, y, '#c9a227'); api.px(x + 2, y, '#c9a227');
          api.px(x, y - 2, '#c9a227'); api.px(x, y + 2, '#c9a227');
        }
        /* A trail is a dimmer copy of the light, not a shadow. Drawn in near
           black it read as a burnt wick hanging off each one. */
        api.px(x - 1, y + 2, '#9c7b2a');
      });
    });

    /* Sand blows in sheets. Twenty identical horizontal dashes at one value
       were a page of hyphens; the streaks ride a slow wave, run at three
       lengths, and sit on a moving haze that carries the density. */
    const sand = k => over(api => {
      /* Sparse. At a quarter coverage plus a second bank plus three ranks of
         streaks the tile went opaque and stopped being an overlay at all --
         it read as a plank of pine laid over the scene. */
      haze(api, 0, 31, 7 + k, '#c98f5a', 23 + k);
      haze(api, 9, 25, 5, '#e4a672', 41 - k * 3);
      field(9, 1, k, 7, 1).forEach(([x, y, i]) => {
        const yy = y + Math.round(Math.sin((x + k * 6) / 6) * 1.4);
        api.line(x, yy, x + 3 + (i % 2), yy, '#b06b3a', 1);
      });
      field(6, 4, k, 11, -1).forEach(([x, y, i]) => {
        const yy = y + Math.round(Math.sin((x + k * 9) / 5.5) * 1.8);
        api.line(x, yy, x + 5 + (i % 3), yy, '#e4a672', 1);
        api.px(x + 6 + (i % 3), yy, '#f0bd8e');
      });
      field(3, 7, k, 15, 2).forEach(([x, y]) => {                       // the nearest sheets
        const yy = y + Math.round(Math.sin((x + k * 12) / 5) * 2.2);
        api.line(x, yy, x + 9, yy, '#f0bd8e', 1);
        api.line(x, yy + 1, x + 7, yy + 1, '#c98f5a', 1);
      });
    });

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
