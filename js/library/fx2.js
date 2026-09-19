/* PixelForge Studio — Universal FX pack.
   Genre-agnostic impact, elemental and pickup effects: the particle vocabulary
   every game needs regardless of setting. 32x32, pure maths, deterministic.
   Radii and lifetimes are driven by eased t so each state reads as one motion
   rather than a list of poses. */
window.PF = window.PF || {};
PF.FX2 = (() => {
  const P = () => PF.Pixel;
  const D = (name, fps, loop, frames) => ({ name, fps, loop, frames });
  const Fr = (duration, paint) => ({ duration, paint });
  const ms = fps => Math.round(1000 / fps);
  const OUT32 = PF.Color.hexToU32('#181425');
  const finish = (buf, W, H) => buf.set(PF.Raster.outline(buf, W, H, OUT32));
  const TAU = Math.PI * 2;
  const ease = t => 1 - Math.pow(1 - t, 3);
  /* Painter wrapper. FX read better with the house outline, but a soft state
     (smoke, aura) passes `soft` so the silhouette is not hard-rimmed. */
  const fx = (painter, soft) => (buf, W, H) => { painter(P().makeApi(buf, W, H), W, H); if (!soft) finish(buf, W, H); };
  const seq = (n, fps, make, soft) => Array.from({ length: n }, (_, i) => Fr(ms(fps), fx(a => make(a, i, i / (n - 1)), soft)));
  /* Looping variant: t never reaches 1, so the last frame does not repeat the
     first and the cycle closes without a visible hitch. */
  const seqL = (n, fps, make, soft) => Array.from({ length: n }, (_, i) => Fr(ms(fps), fx(a => make(a, i, i / n), soft)));

  /* Filled ring of radius r, thickness th — the workhorse for blasts and novas. */
  function ring(api, cx, cy, r, th, color, squash = 1) {
    const steps = Math.max(10, Math.round(r * 7));
    for (let i = 0; i < steps; i++) {
      const a = (i / steps) * TAU;
      for (let t = 0; t < th; t++) api.px(cx + Math.cos(a) * (r + t), cy + Math.sin(a) * (r + t) * squash, color);
    }
  }
  /* Radial shard burst: n spikes from r0 to r1, alternating length. */
  function shards(api, cx, cy, r0, r1, n, colors, phase = 0) {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + phase, long = (i & 1) ? 1 : 0.62;
      api.line(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0, cx + Math.cos(a) * r1 * long, cy + Math.sin(a) * r1 * long, colors[i % colors.length], 1);
    }
  }

  /* A fireball, a smoke puff and a bank of dust are all the same thing: a
     field, not a stack of discs. Every pixel in the bounding box is tested
     against a radius that varies with angle, and coloured by how far out it
     sits, so the ragged boundary and the value ramp fall out of one pass.
     Drawn the old way -- three concentric filled ellipses -- a blast was a
     clean circle with three flat bands in it and a smoke puff was a pebble.

     ox/oy move the hot spot off centre so the ball is lit rather than
     radially symmetric. grain dithers each band into the next so the ramp
     has no hard steps. sparse leaves holes, for fire glimpsed through smoke.
     A stop colour of null is a hole, which is how a dissipating pop becomes
     a ring -- the energy has moved outward and the middle is empty. */
  function cloud(api, cx, cy, r, o) {
    const sq = o.squash || 1, lump = o.lump == null ? 0.2 : o.lump, seed = o.seed || 0;
    const R = Math.ceil(r * (1 + lump)) + 2;
    for (let y = Math.round(cy - R * sq) - 1; y <= cy + R * sq + 1; y++) {
      if (y < 0 || y > 31) continue;
      for (let x = Math.round(cx - R) - 1; x <= cx + R + 1; x++) {
        if (x < 0 || x > 31) continue;
        const dx = x - cx, dy = (y - cy) / sq, d = Math.hypot(dx, dy);
        if (d > R) continue;
        const a = Math.atan2(dy, dx);
        /* Three octaves of angular noise: big lobes, lumps on the lobes and
           a fray along the edge. One octave alone is a smooth blob. */
        const n = Math.sin(a * 3 + seed) * 0.5 + Math.sin(a * 7 - seed * 1.7) * 0.31
          + Math.sin(a * 13 + seed * 2.3) * 0.19;
        const rr = r * (1 + n * lump);
        if (d > rr) continue;
        if (o.sparse && api.hash(x, y * 3, seed + 7) > o.sparse) continue;
        const u = Math.hypot(dx - (o.ox || 0), dy - (o.oy || 0)) / rr;
        let ci = 0; while (ci < o.stops.length - 1 && u > o.stops[ci][0]) ci++;
        if (o.grain && api.hash(x, y, seed + 3) < o.grain) ci = Math.min(ci + 1, o.stops.length - 1);
        const col = o.stops[ci][1];
        if (col) api.px(x, y, col);
      }
    }
  }

  /* ================= EXPLOSIONS ================= */
  function explosionSuite() {
    const CORE = '#fff6c9', HOT = '#fee761', MID = '#f77622', LOW = '#e43b44',
      DEEP = '#a22633', SMOKE = '#5a6988', SMOKED = '#3a4466', PALE = '#8b9bb4';

    /* Eight frames: flash, fireball, bloom, cooling, break-up, smoke. The
       stops walk the whole ramp down over the run, which is what sells the
       heat leaving -- the ball is not just recoloured at one frame boundary. */
    const FIRE = [null,
      { r: 7.5, lump: 0.16, stops: [[0.30, '#ffffff'], [0.52, CORE], [0.74, HOT], [0.90, MID], [1, LOW]] },
      { r: 11, lump: 0.20, stops: [[0.22, '#ffffff'], [0.44, CORE], [0.66, HOT], [0.86, MID], [1, LOW]] },
      { r: 13.5, lump: 0.25, stops: [[0.14, CORE], [0.36, HOT], [0.64, MID], [0.87, LOW], [1, DEEP]] },
      { r: 14.5, lump: 0.30, stops: [[0.20, HOT], [0.46, MID], [0.74, LOW], [1, DEEP]] }];

    const big = (api, i) => {
      if (i === 0) {                                                    // nothing burning yet
        cloud(api, 16, 16, 4.5, { seed: 1, lump: 0.1, stops: [[0.55, '#ffffff'], [1, CORE]] });
        for (let k = 0; k < 10; k++) {
          const a = k * (TAU / 10) + 0.2, L = 8 + api.hash(k, 0, 3) * 7;
          api.line(16 + Math.cos(a) * 4, 16 + Math.sin(a) * 4,
            16 + Math.cos(a) * L, 16 + Math.sin(a) * L, k & 1 ? CORE : HOT, 1);
        }
        return;
      }
      if (i <= 4) {
        const F = FIRE[i];
        cloud(api, 16, 16, F.r, { squash: 0.94, seed: i * 1.7, lump: F.lump,
          ox: -F.r * 0.2, oy: -F.r * 0.26, stops: F.stops, grain: 0.22 });
        for (let k = 0; k < 7; k++) {                                   // debris thrown clear
          const a = k * (TAU / 7) + 0.5 + i * 0.12,
            d = F.r + 1 + i * 1.5 + api.hash(k, i, 11) * 3;
          const ex = 16 + Math.cos(a) * d, ey = 16 + Math.sin(a) * d;
          api.line(ex, ey, ex + Math.cos(a) * 2, ey + Math.sin(a) * 2, k & 1 ? HOT : MID, 1);
        }
        return;
      }
      /* Break-up. The old smoke stage was the same disc recoloured navy and it
         never came apart, never rose and never thinned -- three frames of a
         grey ball growing. Six lumps drift outward and up, each lit from the
         same quarter, and they cool a whole step per frame. */
      const g = i - 5;
      const SM = [[PALE, SMOKE, SMOKED], [PALE, SMOKE, SMOKED], [SMOKE, SMOKED, '#212842']][g];
      for (let k = 0; k < 6; k++) {
        const a = k * (TAU / 6) + 0.35, d = 3 + g * 4.6 + api.hash(k, 5, 13) * 3;
        const cx = 16 + Math.cos(a) * d, cy = 15 + Math.sin(a) * d * 0.85 - g * 2.3;
        const rr = 6.6 - g * 1.1 + api.hash(k, 6, 17) * 2;
        /* The lumps have to come apart as they go. Kept close and stepped two
           tones darker at once they overlapped back into one solid navy mass
           -- the middle frame of the break-up was a single dark blob. */
        cloud(api, cx, cy, rr, { seed: k * 2.1 + g, lump: 0.32, ox: -rr * 0.35, oy: -rr * 0.42,
          sparse: g === 2 ? 0.6 : g === 1 ? 0.88 : 0, grain: 0.26,
          stops: [[0.42, SM[0]], [0.74, SM[1]], [1, SM[2]]] });
      }
      /* One lump stays in the middle. Six drifting outward on their own left a
         clean gap at the centre and the plume came back as a wreath. */
      if (g < 2) cloud(api, 16, 14 - g * 2, 5.4 - g, { seed: 31 + g, lump: 0.34,
        ox: -2, oy: -2.2, grain: 0.26, sparse: g === 1 ? 0.8 : 0,
        stops: [[0.42, SM[0]], [0.74, SM[1]], [1, SM[2]]] });
      if (g === 0) cloud(api, 16, 15, 5.5, { seed: 9, lump: 0.35, ox: -1.4, oy: -1.6,
        sparse: 0.6, grain: 0.3, stops: [[0.34, HOT], [0.7, MID], [1, LOW]] });
      if (g < 2) for (let k = 0; k < 8; k++) {                          // embers outliving it
        const a = k * (TAU / 8) + 0.9, d = 10 + g * 5 + api.hash(k, 7, 19) * 4;
        api.px(16 + Math.cos(a) * d, 16 + Math.sin(a) * d * 0.8 - g * 2, k & 1 ? HOT : MID);
      }
    };

    /* Hit-sized pop, five frames and no smoke stage. It ends as a ring and
       then as fragments: a pop that finishes as a big flat yellow ball, which
       is what the old one did, never looks like it went out. */
    const small = (api, i) => {
      if (i === 0) {
        cloud(api, 16, 16, 2.6, { seed: 2, lump: 0.1, stops: [[0.6, '#ffffff'], [1, CORE]] });
        for (let k = 0; k < 8; k++) {
          const a = k * (TAU / 8) + 0.4;
          api.line(16 + Math.cos(a) * 2, 16 + Math.sin(a) * 2,
            16 + Math.cos(a) * 8, 16 + Math.sin(a) * 8, k & 1 ? CORE : HOT, 1);
        }
        return;
      }
      if (i <= 2) {
        const r = i === 1 ? 5.5 : 8.5;
        cloud(api, 16, 16, r, { seed: i * 3.3, lump: 0.2, ox: -r * 0.24, oy: -r * 0.3, grain: 0.24,
          stops: i === 1 ? [[0.34, '#ffffff'], [0.60, CORE], [0.84, HOT], [1, MID]]
            : [[0.24, CORE], [0.50, HOT], [0.80, MID], [1, LOW]] });
        for (let k = 0; k < 6; k++) {
          const a = k * (TAU / 6) + i * 0.5, d = r + 2 + i;
          api.px(16 + Math.cos(a) * d, 16 + Math.sin(a) * d, HOT);
        }
        return;
      }
      /* The hole gets little grain: dithered heavily, the ring's inner edge
         frayed into a scatter of specks across the gap and the frame read as
         a knot rather than as a shell that has moved outward. */
      const r = i === 3 ? 10 : 12;
      cloud(api, 16, 16, r, { seed: i * 4.1, lump: 0.28, grain: i === 3 ? 0.12 : 0.3,
        sparse: i === 4 ? 0.5 : 0,
        stops: i === 3 ? [[0.52, null], [0.72, HOT], [0.9, MID], [1, LOW]]
          : [[0.66, null], [0.84, MID], [1, DEEP]] });
    };

    /* Directional blast. The old cone stepped x and drew one vertical line per
       column in one of three colours, so it came out as three solid bands in a
       wedge -- a piece of candy corn with a rocket nose. Heat is sampled per
       pixel now, falling off along the axis and across it at once, and the
       cone frays instead of ending in a straight edge. */
    const cone = (api, i, t) => {
      const reach = 5 + ease(t) * 19, x0 = 4;
      for (let x = x0; x < x0 + reach && x < 32; x++) {
        const k = (x - x0) / reach;
        /* The tip has to close. Flaring all the way to the last column left a
           straight vertical wall of red across the front of the blast, as if
           the cone had been sawn off. */
        const hh = (1.7 + Math.pow(k, 0.55) * 9.4) * Math.sqrt(Math.max(0, 1 - Math.pow(k, 5)))
          * (1 + (api.hash(x, i * 7, 5) - 0.5) * 0.42);
        if (hh < 0.6) continue;
        for (let y = Math.round(16 - hh); y <= 16 + hh; y++) {
          if (y < 0 || y > 31) continue;
          const v = Math.abs(y - 16) / hh;
          const heat = (1 - k * 0.86) * (1 - v * 0.68) + (api.hash(x, y, i + 3) - 0.5) * 0.2;
          api.px(x, y, heat > 0.72 ? '#ffffff' : heat > 0.55 ? CORE : heat > 0.37 ? HOT
            : heat > 0.19 ? MID : LOW);
        }
      }
      for (let k = 0; k < 6; k++) {                                     // sparks run ahead
        const d = x0 + reach + 1 + api.hash(k, i, 9) * 4;
        api.px(d, 16 + Math.round(Math.sin(k * 2.3 + i) * 5), k & 1 ? HOT : MID);
      }
      if (i >= 2) for (let k = 0; k < 5; k++) {                         // smoke off the nozzle
        const sy = 16 + Math.round(Math.sin(k * 1.9 + i * 0.7) * 4.5);
        cloud(api, x0 - 1 + api.hash(k, i, 21) * 3, sy, 2.4, { seed: k + i, lump: 0.35,
          stops: [[0.5, SMOKE], [1, SMOKED]] });
      }
    };

    /* Mushroom. Column, cap and ground wash were three flat fills, which read
       as a lamp; the column needs turbulence down its length, the cap has to
       be flattened and dark on its underside so it is a cap and not a second
       fireball, and the wash has to run out along the floor as a wave. */
    const mushroom = (api, i, t) => {
      const e = ease(t), cold = i > 3;
      const capY = 17 - e * 9, capR = 3.5 + e * 10.5;
      const gw = 6 + i * 3.6;
      for (let x = Math.round(16 - gw); x <= 16 + gw; x++) {            // the wave along the floor
        if (x < 0 || x > 31) continue;
        const u = Math.abs(x - 16) / gw;
        api.rect(x, 28 - Math.round((1 - u) * 2), x, 29,
          u > 0.74 ? (cold ? SMOKED : LOW) : cold ? SMOKE : u > 0.4 ? MID : HOT);
      }
      for (let y = 29; y > capY; y--) {                                 // the column
        const k = (29 - y) / Math.max(1, 29 - capY);
        const w = 2.3 + k * 2.7 + Math.sin(y * 0.85 + i * 1.4) * 0.95;
        for (let x = Math.round(15.5 - w); x <= 15.5 + w; x++) {
          if (x < 0 || x > 31) continue;
          const v = Math.abs(x - 15.5) / w;
          api.px(x, y, cold ? (v > 0.7 ? SMOKED : v > 0.34 ? SMOKE : PALE)
            : v > 0.78 ? MID : v > 0.44 ? HOT : CORE);
        }
      }
      cloud(api, 16, capY, capR, { squash: 0.6, seed: 3 + i * 1.3, lump: 0.24,
        ox: -capR * 0.18, oy: -capR * 0.3, grain: 0.24, sparse: i === 5 ? 0.72 : 0,
        stops: cold ? [[0.38, PALE], [0.68, SMOKE], [1, SMOKED]]
          : [[0.24, '#ffffff'], [0.48, CORE], [0.72, HOT], [0.9, MID], [1, LOW]] });
      /* The underside, in shadow. Without it the cap is a ball sitting on a
         stick and the whole thing reads as a tree. */
      for (let x = Math.round(16 - capR); x <= 16 + capR; x++) {
        if (x < 0 || x > 31) continue;
        const u = (x - 16) / capR;
        if (Math.abs(u) > 0.96) continue;
        const yb = capY + Math.round(Math.sqrt(1 - u * u) * capR * 0.6);
        if (Math.abs(u) > 0.24) api.rect(x, yb - 1, x, yb, cold ? '#262b44' : DEEP);
      }
    };

    return { width: 32, height: 32, name: 'fx-explosion', layers: [{ name: 'FX' }], states: [
      /* Smoke is passed soft: the house outline round a puff makes it a
         sticker, and three rimmed navy blobs was the worst of the old sheet. */
      D('explode_big', 14, false, [0, 1, 2, 3, 4, 5, 6, 7].map(i =>
        Fr(ms(14), fx(a => big(a, i), i >= 5)))),
      /* The last two frames of the pop go soft as well. The dissipating ring
         has a ten-pixel hole in it, and the outline pass rims the inside of a
         hole: the gap filled solid black and the frame came back as a flame
         with a mask floating in the middle of it. */
      D('explode_small', 14, false, [0, 1, 2, 3, 4].map(i =>
        Fr(ms(14), fx(a => small(a, i), i >= 3)))),
      D('explode_cone', 16, false, seq(5, 16, cone)),
      D('explode_mushroom', 10, false, [0, 1, 2, 3, 4, 5].map(i =>
        Fr(ms(10), fx(a => mushroom(a, i, i / 5), i >= 4))))
    ] };
  }
 /* ================= SMOKE, FIRE, STEAM ================= */
  function smokeSuite() {
    const S0 = '#ffffff', S1 = '#e8ecf5', S2 = '#c0cbdc', S3 = '#8b9bb4', S4 = '#5a6988';

    /* Three clouds climbing and spreading. The old puffs were flat filled
       ellipses with a lighter ellipse laid on top, so the column came out as
       a stack of pebbles -- a hard edge and two tones is a stone, not smoke. */
    const smoke = (api, i, t) => {
      for (let k = 0; k < 3; k++) {
        const ph = (t + k * 0.33) % 1;
        const y = 27 - ph * 22, r = 2.4 + ph * 5, x = 16 + Math.sin(ph * 4 + k * 2) * 3.5;
        /* Smoke thins as it goes, it does not darken. Walking the band down
           to navy put the top of the column at the value of the sky behind
           it and the last puff read as a handful of grit. */
        const band = ph < 0.34 ? [S0, S1, S2] : ph < 0.66 ? [S1, S2, S3] : [S2, S3, S4];
        cloud(api, x, y, r, { squash: 0.86, seed: k * 3.1 + i * 0.7, lump: 0.3,
          ox: -r * 0.34, oy: -r * 0.4, grain: 0.26, sparse: ph > 0.55 ? 1.85 - ph : 0,
          stops: [[0.4, band[0]], [0.72, band[1]], [1, band[2]]] });
      }
    };

    /* A flame is a tongue: rounded and fat at the base, pinched as it rises,
       with the tip flicking to one side and the whole body wavering. Four
       nested ellipses of decreasing size gave a perfect egg, and since the
       widest one never moved the loop only wobbled its yolk. */
    const flame = (api, i) => {
      const sway = [0, 0.95, 0.15, -0.85][i], H = 21, base = 30;
      for (let j = 0; j <= H; j++) {
        const y = base - j, k = j / H;
        /* Widest a third of the way up, not at the very bottom. A profile
           that only tapers is a cone, and with the house outline round it the
           flame came out as a traffic cone with a yolk. */
        const w = 5.9 * Math.sin(Math.PI * (0.2 + k * 0.76))
          * (1 + Math.sin(k * 7.2 + i * 1.8) * 0.17);
        if (w < 0.45) break;
        const cx = 16 + sway * k * k * 3.8 + Math.sin(k * 4.2 + i * 1.3) * k * 2.4
          + Math.sin(k * 9 - i * 2.1) * k * 1.1;
        for (let x = Math.round(cx - w); x <= cx + w; x++) {
          const u = Math.abs(x - cx) / w;
          const heat = (1 - k * 0.78) * (1 - u * 0.76) + (api.hash(x, y, i + 3) - 0.5) * 0.16;
          api.px(x, y, heat > 0.64 ? '#fff6c9' : heat > 0.45 ? '#fee761'
            : heat > 0.26 ? '#feae34' : heat > 0.1 ? '#f77622' : '#e43b44');
        }
      }
      api.rect(10, 30, 22, 30, '#8f3a22');                              // the glow on the ground
      api.rect(12, 30, 20, 30, '#e43b44');
      for (let k = 0; k < 5; k++) {                                     // embers lifting off
        const y = 30 - H - 1 - ((k * 5 + i * 4) % 12);
        if (y < 0) continue;
        api.px(14 + ((k * 7 + i * 5) % 6), y, k & 1 ? '#fee761' : '#f77622');
      }
    };

    /* Steam leaves a vent as a narrow fast stream and breaks into separate
       puffs as it slows. The old jet was one wobbling column of equal-sized
       blobs with a blue block under it, and read as a sock. */
    const steam = (api, i) => {
      api.rect(11, 28, 20, 31, '#3a4466');                              // the vent
      api.rect(11, 28, 20, 28, '#5a6988');
      api.rect(12, 29, 19, 31, '#262b44');
      api.rect(13, 27, 18, 27, '#262b44');                              // its mouth
      api.px(13, 28, '#8b9bb4'); api.px(18, 28, '#3a4466');
      for (let k = 0; k < 10; k++) {
        const ph = ((k / 10) + i / 4) % 1;
        const y = 27 - ph * 26, r = 0.9 + ph * 4.4;
        const x = 16 + Math.sin(ph * 5.5 + k) * ph * 5.5;
        const band = ph < 0.32 ? [S0, S1, S2] : ph < 0.66 ? [S1, S2, S3] : [S2, S3, S4];
        cloud(api, x, y, r, { seed: k * 1.7 + i, lump: 0.28, ox: -r * 0.3, oy: -r * 0.35,
          grain: 0.24, sparse: ph > 0.58 ? 1.55 - ph : 0,
          stops: [[0.42, band[0]], [0.74, band[1]], [1, band[2]]] });
      }
    };

    /* Landing dust rolls outward along the floor in two lobes and thins as it
       goes. Ten small ellipses scattered by hash was a handful of gravel. */
    const dust = (api, i, t) => {
      const e = ease(t);
      /* Three fat lobes a side, not eight thin ones. Squashed hard and made
         sparse early the cloud flattened into a line of white specks along
         the floor and read as surf. */
      for (const side of [-1, 1]) for (let k = 0; k < 3; k++) {
        const f = k / 2;
        /* The lobes have to keep touching. Pushed out to the tile edge and
           lifted clear of the floor they separated into two thin speckled
           bars with a gap between them, which reads as surf, not as dust. */
        const x = 16 + side * (2.5 + f * (3 + e * 6.5));
        /* The outer lobes curl up, the inner ones stay down. Lifting them all
           by the same amount kept the bank a constant four rows deep and it
           read as a pancake of foam sliding across the floor. */
        const y = 27 - f * f * (1.5 + e * 6) - e * 1.2;
        const r = (4.6 - k * 0.5) * (1 - t * 0.14);
        if (r < 1) continue;
        cloud(api, x, y, r, { squash: 0.9, seed: k * 2.3 + (side + 2) * 5 + i, lump: 0.32,
          ox: -side * r * 0.3, oy: -r * 0.42, grain: 0.26, sparse: t > 0.6 ? 1.75 - t : 0,
          stops: [[0.42, S1], [0.72, S2], [1, S3]] });
      }
      /* The cushion under the feet, which keeps the bank continuous across
         the middle once the two sides have started to travel. */
      cloud(api, 16, 27 - e * 2.6, 4.6 - t * 1.2, { squash: 0.86, seed: 47 + i, lump: 0.3,
        oy: -1.6, grain: 0.26, sparse: t > 0.45 ? 1.5 - t : 0,
        stops: [[0.44, S1], [0.74, S2], [1, S3]] });
      for (let k = 0; k < 9; k++) {                                     // grit thrown clear
        const side = k & 1 ? 1 : -1, d = 5 + e * 9 + api.hash(k, 3, 5) * 4;
        api.px(16 + side * d, 29 - api.hash(k, 7, 9) * 8 * e, k % 3 ? S3 : S4);
      }
    };

    return { width: 32, height: 32, name: 'fx-smoke', layers: [{ name: 'FX' }], states: [
      D('smoke_puff', 8, true, seqL(6, 8, smoke, true)),
      D('fire_loop', 8, true, seq(4, 8, flame)),
      D('steam_jet', 8, true, seqL(4, 8, steam, true)),
      D('dust_land', 12, false, seq(5, 12, dust, true))
    ] };
  }

  /* ================= IMPACTS & COMBAT ================= */
  function impactSuite() {
    const W = '#ffffff', Y = '#fee761', O = '#f77622', R = '#e43b44', B = '#2ce8f5',
      STEEL = '#e8ecf5', STEELD = '#8b9bb4', STEELX = '#3a4466',
      GORE = '#ff0044', GORED = '#a22633', GOREX = '#5c1a24';

    /* A swept edge is a crescent. It comes to a point at both ends of the
       stroke, is fat in the middle, and the far side is the keen one. The old
       arcs were a constant three pixels wide from end to end, which is a
       ribbon -- the first frame of the slash read as a boomerang. */
    const sweep = (api, cx, cy, rMid, aFrom, aTo, wide, cols) => {
      const n = 60;
      for (let j = 0; j <= n; j++) {
        const f = j / n, a = aFrom + (aTo - aFrom) * f;
        const th = Math.pow(Math.sin(Math.PI * f), 0.7) * wide;
        if (th < 0.6) continue;
        const r0 = rMid - th * 0.5;
        for (let r = r0; r <= r0 + th; r += 0.5) {
          const u = (r - r0) / th;
          api.px(cx + Math.cos(a) * r, cy + Math.sin(a) * r,
            u > 0.76 ? cols[2] : u > 0.38 ? cols[1] : cols[0]);
        }
      }
    };
    /* A straight tapered gash. prog draws only the leading part of the stroke,
       so the two blows of a crit can land one after the other instead of both
       being fully there on every frame. */
    const gash = (api, x0, y0, x1, y1, wide, prog, cols) => {
      const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy);
      const nx = -dy / L, ny = dx / L, n = Math.round(L * 2);
      for (let j = 0; j <= n * Math.min(1, Math.max(0, prog)); j++) {
        const f = j / n;
        const cx = x0 + dx * f, cy = y0 + dy * f;
        const th = Math.pow(Math.sin(Math.PI * f), 0.6) * wide;
        for (let sgn = -th; sgn <= th; sgn += 0.5) {
          const u = Math.abs(sgn) / Math.max(0.5, th);
          api.px(cx + nx * sgn, cy + ny * sgn, u > 0.7 ? cols[0] : u > 0.34 ? cols[1] : cols[2]);
        }
      }
    };

    const hit = (api, i) => {
      if (i === 0) {
        api.ellipse(13, 13, 19, 19, W, true);
        for (let k = 0; k < 8; k++) {
          const a = k * (TAU / 8) + 0.2;
          api.line(16 + Math.cos(a) * 3, 16 + Math.sin(a) * 3,
            16 + Math.cos(a) * 7, 16 + Math.sin(a) * 7, Y, 1);
        }
        return;
      }
      /* Sparks at hash-picked angles and lengths, each with a bright head and
         a cooler tail. Eight of equal length on an even pitch was an asterisk;
         six more added at a fixed radius behind them made it a firework. */
      const N = [0, 9, 7, 5][i], base = [0, 3, 7, 11][i];
      for (let k = 0; k < N; k++) {
        const a = k * (TAU / N) + api.hash(k, 0, 3) * 0.9 - 0.45;
        const d0 = base + api.hash(k, 1, 5) * 3, L = 5 + api.hash(k, 2, 7) * 5 - i;
        if (L < 1.2) continue;
        const ex = 16 + Math.cos(a) * (d0 + L), ey = 16 + Math.sin(a) * (d0 + L);
        api.line(16 + Math.cos(a) * d0, 16 + Math.sin(a) * d0, ex, ey, i > 2 ? R : O, 1);
        api.line(16 + Math.cos(a) * (d0 + L * 0.5), 16 + Math.sin(a) * (d0 + L * 0.5),
          ex, ey, i > 2 ? O : Y, 1);
        api.px(ex, ey, i > 2 ? Y : W);
      }
      if (i === 1) api.ellipse(13, 13, 19, 19, Y, true);
      if (i === 1) api.ellipse(14, 14, 18, 18, W, true);
    };

    const slash = (api, i, t) => {
      const a0 = -2.5 + t * 2.3;
      sweep(api, 16, 17, 12, a0, a0 + 1.75, 5.6 - i * 0.7, [STEELX, STEELD, W]);
      if (i > 0) sweep(api, 16, 17, 9.5, a0 - 0.55, a0 + 1.05, 2.8, ['#262b44', STEELX, STEELD]);
    };

    /* Two blows crossing. The old pair were both arcs curving the same way and
       never made an X -- frame three read as a fishing rod with a red line. */
    const crit = (api, i, t) => {
      /* Both strokes are fully drawn by frame two, so frames two and three
         were pixel-identical and the state ended on a held pose. The cut
         thins and cools as it fades instead. */
      const wide = i < 2 ? 3.4 : 3.4 - (i - 1) * 1.1;
      const cool = i === 3;
      gash(api, 3, 5, 28, 27, wide, t * 2 + 0.4,
        cool ? ['#262b44', STEELX, STEELD] : [STEELX, STEELD, W]);
      if (i >= 1) gash(api, 29, 6, 4, 26, wide, (t - 0.2) * 2.4,
        cool ? ['#3a1520', GOREX, R] : [GOREX, R, Y]);
      if (i < 3) P().impactStar(api, 16, 16, Math.min(1, t * 1.4), [W, Y], 8);
    };

    /* Blood leaves a wound in a fan and then falls. Three earlier attempts:
       a filled red circle, which was a cherry; a dark hash-scattered burst,
       which clotted into a lump of meat with a white pixel in it that the
       outline pass turned into an eye; and a set of drops whose angles all
       came off one hash, which clustered them into a single travelling clump
       instead of a spreading cloud. Angles are stepped evenly across the fan
       with only a little jitter, speeds vary a lot, and the whole state is
       painted soft -- the dark red is the drops' own rim. */
    const spray = (api, i, t) => {
      const DIR = -1.15, SPREAD = 1.9;                                  // up and to the right
      if (i === 0) {
        for (let k = 0; k < 18; k++) {
          const a = DIR - SPREAD / 2 + (k / 17) * SPREAD;
          const d = 2.5 + api.hash(k, 5, 7) * 7;
          for (let r = 0; r <= d; r++) {
            api.px(16 + Math.cos(a) * r, 19 + Math.sin(a) * r, r < d - 2 ? GORED : GORE);
          }
        }
        api.rect(14, 18, 17, 20, GORE);                                 // the wound itself
        api.rect(14, 20, 17, 20, GORED);
        api.px(15, 18, '#ff6680');
        return;
      }
      for (let k = 0; k < 20; k++) {
        const a = DIR - SPREAD / 2 + (k / 19) * SPREAD + (api.hash(k, 1, 3) - 0.5) * 0.26;
        const v = 6 + api.hash(k, 2, 5) * 16;
        const x = 16 + Math.cos(a) * v * t, y = 19 + Math.sin(a) * v * t + t * t * 22;
        if (x < -1 || x > 32 || y < -1 || y > 32) continue;
        const fat = api.hash(k, 3, 11) > 0.5;
        const vx = Math.cos(a) * v, vy = Math.sin(a) * v + t * 44, n = Math.hypot(vx, vy) || 1;
        for (let j = 1; j <= (fat ? 3 : 2); j++) {
          api.px(x - vx / n * j, y - vy / n * j, j > 1 ? GOREX : GORED);
        }
        api.px(x, y, GORE);
        if (fat) { api.px(x + 1, y, GORE); api.px(x, y + 1, GORED); }
      }
    };

    const block = (api, i, t) => {
      const r = 5.5 + ease(t) * 5;
      /* Its own dark backing, because this state is painted soft. The guard
         surface is a dither, and the house outline rims every loose pixel of
         a dither separately: the inside of the shield came back as a black
         fishing net with blue caught in it. */
      for (let j = 0; j < 120; j++) {
        const a = j * (TAU / 120);
        for (let sgn = -1; sgn < 3; sgn++) {
          api.px(16 + Math.cos(a) * (r + sgn), 16 + Math.sin(a) * (r + sgn), '#181425');
        }
      }
      /* The blow landed up and to the left, so that is the side of the guard
         that lights. An evenly bright ring with six evenly spaced spikes off
         it was a cog. */
      for (let j = 0; j < 96; j++) {
        const a = j * (TAU / 96), heat = 0.5 + Math.cos(a + 2.4) * 0.5;
        for (let sgn = 0; sgn < 2; sgn++) {
          api.px(16 + Math.cos(a) * (r + sgn), 16 + Math.sin(a) * (r + sgn),
            heat > 0.76 ? W : heat > 0.34 ? B : '#0099db');
        }
      }
      /* The guard itself, dithered so the scene shows through it. Left empty
         the frames were a hoop; filled solid on the first frame they were a
         blob of blue paint with whiskers. */
      for (let y = Math.round(16 - r); y <= 16 + r; y++) {
        for (let x = Math.round(16 - r); x <= 16 + r; x++) {
          if (x < 0 || y < 0 || x > 31 || y > 31) continue;
          const d = Math.hypot(x - 16, y - 16);
          if (d > r - 1) continue;
          if (api.hash(x, y, 13) > (i === 0 ? 0.72 : 0.34 - i * 0.08)) continue;
          api.px(x, y, d < r * 0.45 ? B : '#0099db');
        }
      }
      for (let k = 0; k < 7; k++) {                                     // chips deflected off it
        const a = -2.7 + api.hash(k, 6, 3) * 2.3, d = r + 1 + i * 2.3 + api.hash(k, 7, 5) * 3;
        api.line(16 + Math.cos(a) * d, 16 + Math.sin(a) * d,
          16 + Math.cos(a) * (d + 2.5), 16 + Math.sin(a) * (d + 2.5), k & 1 ? B : W, 1);
      }
    };

    const shock = (api, i, t) => {
      const r = 3 + ease(t) * 14, fade = 1 - t * 0.6;
      /* A ground ring is not a hoop. It is thickest and brightest on the near
         side, where the wave is coming at the camera, and it drags a skirt of
         dust behind it. Two clean concentric ellipses read as a plate rim. */
      for (let j = 0; j < 120; j++) {
        const a = j * (TAU / 120), sy = Math.sin(a);
        const th = 1 + (sy + 1) * 1.5 * fade;
        for (let sgn = 0; sgn < th; sgn++) {
          api.px(16 + Math.cos(a) * (r - sgn), 22 + sy * (r - sgn) * 0.42,
            sgn === 0 ? (sy > -0.2 ? W : '#c0cbdc') : sy > 0.3 ? '#c0cbdc' : '#8b9bb4');
        }
      }
      for (let k = 0; k < 12; k++) {                                    // dust in its wake
        const a = api.hash(k, 8, 3) * TAU, d = r - 2 - api.hash(k, 9, 5) * 5;
        if (d < 1) continue;
        api.px(16 + Math.cos(a) * d, 22 + Math.sin(a) * d * 0.42 - api.hash(k, 10, 7) * 5 * t,
          k & 1 ? '#8b9bb4' : '#5a6988');
      }
    };

    return { width: 32, height: 32, name: 'fx-impact', layers: [{ name: 'FX' }], states: [
      /* Sparks, droplets and dust go soft. The house outline round a two-pixel
         spark makes it a black-rimmed dash: the tail of the old hit read as a
         handful of confetti and the blood as a scatter of ladybird spots. */
      D('hit_spark', 16, false, [0, 1, 2, 3].map(i => Fr(ms(16), fx(a => hit(a, i), i >= 1)))),
      D('slash_arc', 16, false, seq(4, 16, slash)),
      D('crit_cross', 14, false, seq(4, 14, crit)),
      D('blood_spray', 14, false, seq(5, 14, spray, true)),
      D('block_flash', 14, false, seq(4, 14, block, true)),
      D('shockwave', 12, false, seq(5, 12, shock, true))
    ] };
  }

  /* ================= ELEMENTAL ================= */
  function elementalSuite() {
    const W = '#ffffff';
    const ICE = ['#ffffff', '#b8f0ff', '#2ce8f5', '#0099db', '#124e89'];

    /* A spike: fat and faceted at the base, pinched to a lit point, leaning
       as it rises. Shared by the ice nova and the water crown, because a
       crystal and a jet of water are the same silhouette in different tones.
       The seam sits off centre so each one has a lit face and a shaded face
       -- drawn in a single flat colour, seven of them in a ring came out as
       a picket fence. */
    const spike = (api, x, base, h, w, lean, hi, lo, edge) => {
      for (let s = 0; s <= h; s++) {
        const k = s / h;
        const hw = w * Math.pow(1 - k, 0.58);
        if (hw < 0.3) break;
        const cx = x + lean * k * k;
        const seam = cx - hw * 0.18;
        for (let q = Math.round(cx - hw); q <= cx + hw; q++) api.px(q, base - s, q <= seam ? hi : lo);
        api.px(cx - hw, base - s, edge);
      }
    };

    /* ---- lightning ---------------------------------------------------- */
    /* One authored path rather than a random walk per row. The walk wandered
       a pixel at a time and came out as a length of hose: a bolt is a few
       long straight runs meeting at hard angles, not a wiggle. */
    const LP = [[15, -1], [18, 5], [14, 9], [17, 14], [13, 19], [16, 23], [15, 28]];
    const FA = [[14, 9], [9, 13], [11, 16], [7, 21]];
    const FB = [[16, 23], [21, 26], [19, 30]];

    /* Draw only the leading `prog` of a polyline, so the strike reaches down
       the tile over two frames instead of arriving whole. */
    const run = (api, pts, wide, col, prog) => {
      let total = 0;
      for (let j = 0; j < pts.length - 1; j++) {
        total += Math.hypot(pts[j + 1][0] - pts[j][0], pts[j + 1][1] - pts[j][1]);
      }
      let want = total * Math.min(1, Math.max(0, prog == null ? 1 : prog)), done = 0;
      for (let j = 0; j < pts.length - 1 && done < want; j++) {
        const [ax, ay] = pts[j], [bx, by] = pts[j + 1];
        const L = Math.hypot(bx - ax, by - ay), f = Math.min(1, (want - done) / L);
        api.line(ax, ay, ax + (bx - ax) * f, ay + (by - ay) * f, col, wide);
        done += L;
      }
    };
    /* What is left of the channel after the current has gone: the same path
       sampled and mostly thrown away. */
    const frag = (api, pts, col, keep, seed) => {
      for (let j = 0; j < pts.length - 1; j++) {
        const [ax, ay] = pts[j], [bx, by] = pts[j + 1], L = Math.hypot(bx - ax, by - ay);
        for (let q = 0; q <= L; q++) {
          const x = ax + (bx - ax) * (q / L), y = ay + (by - ay) * (q / L);
          if (api.hash(Math.round(x), Math.round(y), seed) > keep) continue;
          api.px(x, y, col);
        }
      }
    };
    /* The ground flash, dithered at its edge so it fades into the floor
       instead of ending on a hard elliptical kerb. */
    const strikeFlash = (api, r, hot, cold, edge) => {
      for (let y = 22; y <= 31; y++) for (let x = 0; x < 32; x++) {
        const d = Math.hypot((x - 15) / r, (y - 28) / (r * 0.36));
        if (d > 1.3) continue;
        if (d < 0.4) api.px(x, y, hot);
        else if (d < 0.74) api.px(x, y, cold);
        else if (d <= 1) api.px(x, y, edge);
        else if (api.hash(x, y, 9) < 1.3 - d) api.px(x, y, edge);
      }
    };

    const bolt = (api, i) => {
      if (i === 0) {                                                    // the leader, feeling its way down
        run(api, LP, 2, ICE[3], 0.6);
        run(api, LP, 1, ICE[1], 0.6);
        return;
      }
      if (i <= 2) {
        const hot = i === 1, C = hot ? [W, ICE[0], ICE[1], ICE[2]] : [ICE[1], ICE[2], ICE[3], ICE[4]];
        strikeFlash(api, hot ? 14 : 11, C[0], C[1], C[2]);
        for (let k = 0; k < 9; k++) {                                   // charge running out along the floor
          const side = k & 1 ? 1 : -1, d = 6 + api.hash(k, 2, 5) * (hot ? 11 : 7);
          api.px(15 + side * d, 28 - api.hash(k, 4, 7) * 2, C[2]);
        }
        run(api, LP, 3, C[3]); run(api, FA, 3, C[3]); run(api, FB, 3, C[3]);
        run(api, LP, 2, C[1]); run(api, FA, 2, C[2]); run(api, FB, 2, C[2]);
        run(api, LP, 1, C[0]); run(api, FA, 1, C[1]); run(api, FB, 1, C[1]);
        return;
      }
      strikeFlash(api, i === 3 ? 9 : 7, ICE[2], ICE[3], ICE[4]);
      /* The channel does not vanish, it comes apart. Thinned to a fifth the
         last frame held four loose pixels and a smear and read as empty. */
      frag(api, LP, i === 3 ? ICE[1] : ICE[2], i === 3 ? 0.6 : 0.34, 3);
      frag(api, FA, i === 3 ? ICE[2] : ICE[3], i === 3 ? 0.45 : 0.26, 11);
      for (let k = 0; k < 7; k++) {                                     // cinders of charge left in the air
        const a = k * (TAU / 7) + 1.1, d = 5 + api.hash(k, 8, 13) * (i === 3 ? 9 : 12);
        api.px(15 + Math.cos(a) * d, 22 + Math.sin(a) * d * 0.7, k & 1 ? ICE[1] : ICE[3]);
      }
    };

    /* ---- ice nova ----------------------------------------------------- */
    const ice = (api, i, t) => {
      const e = ease(t), r = 5 + e * 9;
      for (let a = 0; a < TAU; a += 0.03) {                             // the frost ring on the floor
        const x = 16 + Math.cos(a) * r, y = 22 + Math.sin(a) * r * 0.42;
        api.px(x, y - 1, ICE[1]); api.px(x, y, ICE[2]); api.px(x, y + 1, ICE[3]);
      }
      /* Rime, thickest against the ring and thinning inward. Spread evenly it
         was a field of loose white pixels across the middle of the tile and
         read as television static rather than as frost on a floor. */
      for (let y = 16; y <= 29; y++) for (let x = 1; x < 31; x++) {
        const d = Math.hypot((x - 16) / r, (y - 22) / (r * 0.42));
        if (d > 0.96) continue;
        if (api.hash(x, y, 17) > d * 0.22) continue;
        api.px(x, y, d > 0.7 ? ICE[1] : ICE[2]);
      }
      /* Sorted back to front, so a shard at the near rim overlaps the one
         behind it. Drawn in ring order they interleaved and the group read
         as a flat row of bars rather than as a circle of crystals. */
      const N = 7, list = [];
      for (let k = 0; k < N; k++) {
        const a = k * (TAU / N) + 0.45;
        const x = 16 + Math.cos(a) * r * 0.84, y = 22 + Math.sin(a) * r * 0.42;
        const h = (7 + api.hash(k, 1, 5) * 7) * Math.min(1, e * 1.25) * (i === 4 ? 0.62 : 1);
        list.push({ x, y, h, lean: Math.cos(a) * 2.2, k });
      }
      list.sort((p, q) => p.y - q.y);
      for (const c of list) {
        if (c.h < 2) continue;
        api.px(c.x - 1, c.y + 1, ICE[4]); api.px(c.x, c.y + 1, ICE[4]);  // contact shadow
        spike(api, c.x, c.y, c.h, 2.3, c.lean, ICE[1], ICE[3], ICE[2]);
        api.px(c.x + c.lean, c.y - c.h, W);
      }
      if (i === 4) for (let k = 0; k < 10; k++) {                       // chips flying off as it breaks
        const a = k * (TAU / 10) + 0.2, d = 9 + api.hash(k, 6, 9) * 6;
        api.px(16 + Math.cos(a) * d, 20 + Math.sin(a) * d * 0.55, k & 1 ? ICE[1] : ICE[2]);
      }
    };

    /* ---- poison cloud -------------------------------------------------- */
    const poison = (api, i) => {
      const G = ['#d8f07a', '#8fd94a', '#63c74d', '#3e8948', '#265c42'];
      /* Sparse on purpose: a gas you cannot see through is a hedge. */
      /* Thin, and with no dark rim. Kept nearly solid and ramped down to the
         deepest green at the boundary, every lump got a shaded underside and
         the six of them together came out as a broccoli floret. Gas has no
         underside: it is lightest where it is thickest and simply runs out. */
      for (let k = 0; k < 6; k++) {
        const a = k * (TAU / 6) + i * 0.42, d = 4.6 + Math.sin(i * 1.1 + k) * 1.3;
        const x = 16 + Math.cos(a) * d, y = 18 + Math.sin(a) * d * 0.62;
        const rr = 5.8 + api.hash(k, 3, 7) * 2.4;
        cloud(api, x, y, rr, { squash: 0.88, seed: k * 2.7 + i * 0.9, lump: 0.36,
          ox: -rr * 0.32, oy: -rr * 0.4, grain: 0.3, sparse: 0.52,
          stops: [[0.42, G[1]], [0.76, G[2]], [1, G[3]]] });
      }
      cloud(api, 16, 18, 8, { squash: 0.9, seed: 11 + i, lump: 0.32, ox: -2.4, oy: -3,
        grain: 0.32, sparse: 0.66, stops: [[0.34, G[0]], [0.66, G[1]], [1, G[2]]] });
      for (let k = 0; k < 6; k++) {                                     // bubbles rising out of it, then popping
        const ph = ((k / 6) + i / 4) % 1;
        const y = 23 - ph * 19, x = 8 + k * 3.3 + Math.sin(ph * 5 + k) * 1.7;
        if (ph > 0.8) {
          api.px(x - 1, y, G[1]); api.px(x + 1, y, G[1]);
          api.px(x, y - 1, G[1]); api.px(x, y + 1, G[1]);
        } else { api.px(x, y, G[0]); api.px(x, y + 1, G[2]); }
      }
    };

    /* ---- holy beam ----------------------------------------------------- */
    const holy = (api, i, t) => {
      const e = ease(t), HOT = W, WARM = '#fff6c9', GOLD = '#fee761', AMB = '#feae34';
      /* Wider at the top and fringed with a dither. A hard-edged rectangle of
         one white was a fluorescent tube stood on end. */
      for (let y = 0; y <= 27; y++) {
        /* A real taper, and a dither across every band boundary. At a quarter
           of a pixel of spread the shaft was visibly a rectangle, and with
           each band ending on an exact column it read as three flat stripes
           of paint with an orange confetti edge stuck to them. */
        const w = (2.6 + e * 4.8) * (1.5 - (y / 27) * 0.66);
        const jt = x => (api.hash(x, y, 7) - 0.5) * 0.17;
        for (let x = Math.round(16 - w - 3); x <= 16 + w + 3; x++) {
          const u = Math.abs(x - 16) / w + jt(x);
          if (u <= 0.44) api.px(x, y, HOT);
          else if (u <= 0.76) api.px(x, y, WARM);
          else if (u <= 1.02) api.px(x, y, GOLD);
          /* A tight halo, not a scatter. Reaching a third of a shaft-width out
             at even odds the fringe read as orange confetti glued along both
             sides of the beam. */
          else if (u < 1.2 && api.hash(x, y * 3, 19) < (1.2 - u) * 1.6) api.px(x, y, AMB);
        }
      }
      const r = 5 + e * 10;
      for (let y = 21; y <= 31; y++) for (let x = 0; x < 32; x++) {     // the pool it lands in
        const d = Math.hypot((x - 16) / r, (y - 27) / (r * 0.36));
        if (d > 1.3) continue;
        if (d < 0.46) api.px(x, y, HOT);
        else if (d < 0.78) api.px(x, y, WARM);
        else if (d <= 1) api.px(x, y, GOLD);
        else if (api.hash(x, y, 13) < 1.3 - d) api.px(x, y, AMB);
      }
      for (let k = 0; k < 10; k++) {                                    // motes lifting through the shaft
        const ph = ((k / 10) + i / 5) % 1, y = 28 - ph * 27;
        const x = 16 + Math.sin(k * 2.1 + ph * 3.4) * (3 + ph * 8);
        api.px(x, y, ph < 0.5 ? WARM : GOLD);
        if (k % 3 === 0) api.px(x, y + 1, AMB);
      }
    };

    /* ---- shadow implosion ---------------------------------------------- */
    const shadow = (api, i, t) => {
      const V = ['#ffcbdc', '#b55088', '#68386c', '#3e2347', '#17111f'];
      const e = ease(t);
      if (i === 4) {                                                    // the collapse lets go
        for (let k = 0; k < 11; k++) {                                  // what the void spits back out
          const a = k * (TAU / 11) + 0.4;
          for (let rr = 3; rr <= 8 + api.hash(k, 2, 7) * 6; rr += 0.5) {
            api.px(16 + Math.cos(a) * rr, 16 + Math.sin(a) * rr, rr > 9 ? V[2] : rr > 6 ? V[1] : V[0]);
          }
        }
        for (let j = 0; j < 140; j++) {
          const a = j * (TAU / 140);
          if (api.hash(Math.round(16 + Math.cos(a) * 9), Math.round(16 + Math.sin(a) * 9), 5) > 0.7) continue;
          api.px(16 + Math.cos(a) * 9, 16 + Math.sin(a) * 9, V[1]);
          api.px(16 + Math.cos(a) * 10.5, 16 + Math.sin(a) * 10.5, V[2]);
        }
        P().impactStar(api, 16, 16, 0.95, [V[0], V[1]], 6);
        return;
      }
      /* Tendrils, not motes. Eight dots on a shrinking circle read as a
         dotted outline round a grape; an arm that sweeps back as it comes in
         is what shows which way the thing is turning. */
      const rOut = 15 - e * 8, rIn = 3.4 + (1 - e) * 3.2;
      for (let k = 0; k < 7; k++) {
        const a0 = k * (TAU / 7) + t * 2.1;
        for (let rr = rIn; rr <= rOut; rr += 0.45) {
          const u = (rr - rIn) / (rOut - rIn), a = a0 + (rr - rIn) * 0.19;
          api.px(16 + Math.cos(a) * rr, 16 + Math.sin(a) * rr, u > 0.7 ? V[2] : u > 0.34 ? V[1] : V[0]);
        }
      }
      const cr = 7.6 - e * 4.6;
      cloud(api, 16, 16, cr, { seed: 5 + i, lump: 0.24, ox: -cr * 0.3, oy: -cr * 0.34,
        grain: 0.2, stops: [[0.5, V[3]], [0.82, V[4]], [1, V[2]] ] });
      for (let j = 0; j < 90; j++) {                                    // the rim light on the void
        const a = j * (TAU / 90);
        if (api.hash(Math.round(16 + Math.cos(a) * cr), Math.round(16 + Math.sin(a) * cr), 21) > 0.45) continue;
        api.px(16 + Math.cos(a) * cr, 16 + Math.sin(a) * cr, V[1]);
      }
    };

    /* ---- water splash --------------------------------------------------- */
    const splash = (api, i, t) => {
      const e = ease(t), r = 3.5 + e * 11;
      for (let a = 0; a < TAU; a += 0.028) {                            // the surface ring, spreading
        const x = 16 + Math.cos(a) * r, y = 26 + Math.sin(a) * r * 0.36;
        api.px(x, y - 1, ICE[1]); api.px(x, y, ICE[2]); api.px(x, y + 1, ICE[3]);
      }
      if (i >= 2 && r > 8) for (let a = 0; a < TAU; a += 0.04) {        // the second ring left behind
        api.px(16 + Math.cos(a) * (r - 5), 26 + Math.sin(a) * (r - 5) * 0.36, ICE[3]);
      }
      if (i <= 1) {                                                     // the column, before it opens
        const h = 7 + i * 6;
        for (let sY = 0; sY <= h; sY++) {
          const k = sY / h, hw = (3.6 - i * 0.5) * (1 - k * 0.42) * (1 + Math.sin(k * 5 + i) * 0.14);
          for (let x = Math.round(16 - hw); x <= 16 + hw; x++) {
            const u = (x - 16) / hw;
            api.px(x, 26 - sY, u < -0.25 ? ICE[1] : u < 0.45 ? ICE[2] : ICE[3]);
          }
        }
        for (let q = -2; q <= 2; q++) api.px(16 + q, 25 - h, Math.abs(q) < 2 ? ICE[0] : ICE[1]);
      }
      if (i >= 1 && i <= 3) {                                           // the crown of jets
        const N = 7, lst = [];
        for (let k = 0; k < N; k++) {
          const a = k * (TAU / N) + 0.3;
          lst.push({ x: 16 + Math.cos(a) * r * 0.78, y: 26 + Math.sin(a) * r * 0.36,
            h: (5 + api.hash(k, 1, 3) * 5) * (i === 3 ? 0.45 : i === 1 ? 0.7 : 1),
            lean: Math.cos(a) * 2.6 });
        }
        lst.sort((p, q) => p.y - q.y);
        for (const c of lst) {
          if (c.h < 2) continue;
          spike(api, c.x, c.y, c.h, 1.9, c.lean, ICE[1], ICE[3], ICE[2]);
          const bx = c.x + c.lean, by = c.y - c.h;                      // the bead that breaks off the tip
          api.px(bx, by, ICE[0]); api.px(bx, by - 1, ICE[1]); api.px(bx + 1, by, ICE[2]);
        }
      }
      /* Slow enough to still be in the tile on the last frame. Thrown at
         twenty pixels a frame they were all off the edge by then and the
         state ended on a bare ellipse that read as an inner tube. */
      if (i >= 2) for (let k = 0; k < 14; k++) {
        const a = -Math.PI + (k / 13) * Math.PI + (api.hash(k, 1, 3) - 0.5) * 0.2;
        const v = 6 + api.hash(k, 2, 5) * 7, f = (t - 0.4) / 0.6;
        const x = 16 + Math.cos(a) * v * f, y = 24 + Math.sin(a) * v * f * 0.8 + f * f * 11;
        if (x < 0 || x > 31 || y < 0 || y > 31) continue;
        api.px(x, y, ICE[1]); api.px(x, y + 1, ICE[3]);
      }
      if (i === 4) {                                                    // the rebound coming back up
        spike(api, 16, 26, 9, 2.1, 0, ICE[1], ICE[3], ICE[2]);
        api.px(16, 16, ICE[0]); api.px(16, 15, ICE[1]); api.px(17, 16, ICE[2]);
        for (let k = 0; k < 6; k++) {                                   // the last of the crown coming down
          const side = k & 1 ? 1 : -1, d = 7 + api.hash(k, 9, 3) * 5;
          const y = 18 + api.hash(k, 4, 6) * 6;
          api.px(16 + side * d, y, ICE[1]); api.px(16 + side * d, y + 1, ICE[3]);
        }
      }
    };

    return { width: 32, height: 32, name: 'fx-elemental', layers: [{ name: 'FX' }], states: [
      /* Every state here is painted soft. These are light and liquid: the
         house outline round a bolt, a mote or a droplet turns each one into
         a black-rimmed sticker, and it fills the gaps in a dithered fringe
         solid so a beam comes back as a length of pipe. */
      D('lightning', 16, false, seq(5, 16, bolt, true)),
      D('ice_nova', 12, false, seq(5, 12, ice, true)),
      D('poison_cloud', 8, true, seqL(4, 8, poison, true)),
      D('holy_beam', 12, false, seq(5, 12, holy, true)),
      D('shadow_implode', 12, false, seq(5, 12, shadow, true)),
      D('water_splash', 14, false, seq(5, 14, splash, true))
    ] };
  }

  function auraSuite() {
    /* ---- portal -------------------------------------------------------- */
    const portal = (api, i) => {
      const V = ['#ffffff', '#f6757a', '#b55088', '#68386c', '#3e2347', '#17111f'];
      const RX = 8, RY = 13;
      /* A mouth is a hole: darkest in the middle, with the wall of it showing
         at the rim. Filled as a flat purple ellipse with a white lozenge in
         the centre it was an aubergine with a seed in it. */
      for (let y = 16 - RY; y <= 16 + RY; y++) for (let x = 16 - RX; x <= 16 + RX; x++) {
        const d = Math.hypot((x - 16) / RX, (y - 16) / RY);
        if (d > 1) continue;
        api.px(x, y, d > 0.86 ? V[3] : d > 0.55 ? V[4] : V[5]);
      }
      /* Five arms, each sweeping back as it goes out, brightest where they
         meet. A ring of separate dots turning on the spot is measles. With
         five arms a quarter turn of one arm-pitch per frame closes the loop. */
      for (let k = 0; k < 5; k++) {
        const a0 = k * (TAU / 5) + i * (TAU / 5) / 4;
        for (let u = 0.12; u <= 1; u += 0.018) {
          const a = a0 + (1 - u) * 2.7;
          api.px(16 + Math.cos(a) * RX * u, 16 + Math.sin(a) * RY * u,
            u > 0.82 ? V[3] : u > 0.55 ? V[2] : u > 0.3 ? V[1] : V[0]);
        }
      }
      for (let a = 0; a < TAU; a += 0.02) {                              // the lip, lit from above left
        const c = Math.cos(a), sn = Math.sin(a);
        api.px(16 + c * RX, 16 + sn * RY, (-c - sn) > 0.35 ? V[1] : V[2]);
        api.px(16 + c * (RX + 1), 16 + sn * (RY + 1), V[3]);
      }
      for (let k = 0; k < 6; k++) {                                      // charge orbiting outside it
        const a = k * (TAU / 6) + i * 0.4;
        api.px(16 + Math.cos(a) * (RX + 3), 16 + Math.sin(a) * (RY + 2), k & 1 ? '#2ce8f5' : V[1]);
      }
    };

    /* ---- teleport out --------------------------------------------------- */
    const teleOut = (api, i, t) => {
      const C = ['#ffffff', '#b8f0ff', '#2ce8f5', '#0099db', '#124e89'];
      /* A body, not a bar. The old column had square shoulders and a flat
         top and read as a strip light stood on end; and it shrank from the
         top like a dropping thermometer instead of coming apart. */
      for (let y = 4; y <= 27; y++) {
        const k = (y - 4) / 23;
        const w = y < 9 ? 3.2 : 5 - Math.abs(k - 0.52) * 2.1;
        /* The dissolve climbs: a pixel high on the figure goes early, one at
           the feet holds on until the last frame. */
        const keep = (1 - t) - (27 - y) / 38;
        for (let x = Math.round(16 - w); x <= 16 + w; x++) {
          if (api.hash(x, y, 3) > keep) continue;
          const u = (x - 16) / w;
          api.px(x, y, u < -0.34 ? C[1] : u < 0.38 ? C[2] : C[3]);
        }
      }
      for (let y = 0; y <= 29; y++) {                                    // the shaft it is going up
        const w = 2.4 + t * 3.4;
        for (let x = Math.round(16 - w); x <= 16 + w; x++) {
          if (api.hash(x, y, 9) > t * 0.5) continue;
          api.px(x, y, Math.abs(x - 16) < w * 0.4 ? C[0] : C[1]);
        }
      }
      for (let k = 0; k < 16; k++) {                                     // what is left of it, going up
        const ph = (api.hash(k, 1, 5) + t * 1.25) % 1;
        const y = 27 - ph * 29, x = 16 + Math.sin(k * 2.3 + ph * 4.1) * (2 + ph * 7);
        api.px(x, y, ph < 0.45 ? C[0] : ph < 0.75 ? C[2] : C[3]);
      }
      const r = 9 - t * 6;
      for (let a = 0; a < TAU; a += 0.04) {                              // the ring closing under it
        api.px(16 + Math.cos(a) * r, 28 + Math.sin(a) * r * 0.34, C[2]);
        api.px(16 + Math.cos(a) * r, 29 + Math.sin(a) * r * 0.34, C[3]);
      }
    };

    /* ---- heal ----------------------------------------------------------- */
    const heal = (api, i) => {
      const G = ['#ffffff', '#c7f36a', '#63c74d', '#3e8948', '#265c42'];
      /* A shaft you can see the character through. The old state was an
         outlined green ellipse with four plus signs floating over it, which
         read as a rubber band and a pharmacy sign. */
      for (let y = 5; y <= 29; y++) {
        const w = 10 - (29 - y) * 0.13;
        for (let x = Math.round(16 - w); x <= 16 + w; x++) {
          const u = Math.abs(x - 16) / w;
          /* Thin. At a third coverage the shaft was a solid stipple of green
             and the crosses rising through it read as leaves on a shrub. */
          if (api.hash(x, y, 7) > (1 - u) * 0.15) continue;
          api.px(x, y, u < 0.45 ? G[1] : G[2]);
        }
      }
      for (let a = 0; a < TAU; a += 0.025) {                             // the circle it stands in
        const x = 16 + Math.cos(a) * 10.5, y = 28 + Math.sin(a) * 3.6;
        api.px(x, y - 1, G[1]); api.px(x, y, G[2]);
      }
      for (let k = 0; k < 6; k++) {                                      // crosses lifting through it
        const ph = ((k / 6) + i / 4) % 1;
        const y = 29 - ph * 26, x = 16 + Math.sin(k * 2.1 + ph * 3.6) * (3 + ph * 6);
        /* Big enough to read as a cross at a glance, with a lit core and a
           shaded lower arm so it is an object rather than a green tick. */
        const c = ph < 0.55 ? G[1] : G[2], big = k % 2 === 0, L = big ? 2 : 1;
        api.rect(x - L, y, x + L, y, c); api.rect(x, y - L, x, y + L, c);
        api.px(x, y + L, G[3]); api.px(x + L, y, G[3]);
        api.px(x, y, G[0]); api.px(x - 1, y, G[0]);
      }
    };

    /* ---- buff ring ------------------------------------------------------ */
    /* Three by three marks that read as writing rather than as beads. A ring
       of identical square pips is a bracelet; glyphs that differ from one
       another are an inscription. */
    const RUNE = [0x1D2, 0x17D, 0x19E, 0x0BA, 0x139, 0x0D6];
    const buff = (api, i) => {
      const Y = ['#ffffff', '#fff6c9', '#fee761', '#feae34', '#c97e20', '#8f5a10'];
      const cy = 18, RX = 11, RY = 4, ph = (i / 4) * (TAU / 6);
      const glyph = (x, y, k, c) => {
        for (let r = 0; r < 3; r++) for (let q = 0; q < 3; q++) {
          if ((RUNE[k] >> (r * 3 + q)) & 1) api.px(x + q - 1, y + r - 1, c);
        }
      };
      /* Two pixels, and gold on both halves. Three deep with the far side in
         brown the band filled a third of the tile and read as a wooden basin
         with bits floating in it. */
      const band = front => {
        for (let a = 0; a < TAU; a += 0.012) {
          const sn = Math.sin(a);
          if ((sn > 0) !== front) continue;
          const x = 16 + Math.cos(a) * RX, y = cy + sn * RY;
          api.px(x, y - 1, front ? Y[1] : Y[3]);
          api.px(x, y, front ? Y[2] : Y[4]);
        }
      };
      /* The inscription sits just clear of the band and turns with it. */
      const runes = front => {
        for (let k = 0; k < 6; k++) {
          const a = k * (TAU / 6) + ph, sn = Math.sin(a);
          if ((sn > 0) !== front) continue;
          glyph(16 + Math.cos(a) * RX, cy + sn * RY - 7, k, front ? Y[0] : Y[3]);
        }
      };
      /* Back to front, so the far side of the band passes behind the near
         side and the ring reads as tilted rather than as a flat ellipse. */
      runes(false); band(false); band(true); runes(true);
      for (let k = 0; k < 5; k++) {                                      // motes shed off it
        const p = ((k / 5) + i / 4) % 1;
        api.px(10 + k * 3.2, 24 - p * 18, p < 0.5 ? Y[1] : Y[3]);
      }
    };

    /* ---- level up ------------------------------------------------------- */
    const levelup = (api, i, t) => {
      const Y = ['#ffffff', '#fff6c9', '#fee761', '#feae34', '#c97e20'];
      const e = ease(t);
      for (let y = Math.round(29 - e * 32); y <= 29; y++) {              // the shaft going up
        /* Slim. A six-wide shaft cut across by three rings came back as a
           stack of plates on a spindle. */
        const k = (29 - y) / 30, w = (1.7 + e * 1.7) * (1 - k * 0.3);
        for (let x = Math.round(16 - w - 3); x <= 16 + w + 3; x++) {
          const u = Math.abs(x - 16) / w;
          if (u < 0.44) api.px(x, y, Y[0]);
          else if (u < 0.78) api.px(x, y, Y[1]);
          else if (u <= 1.02) api.px(x, y, Y[2]);
          else if (u < 1.35 && api.hash(x, y * 3, 11) < (1.35 - u) * 1.6) api.px(x, y, Y[3]);
        }
      }
      /* Rings travelling up it, each brighter on its near side. Two static
         rings and a stick read as a napkin ring on a candle. */
      for (let k = 0; k < 2; k++) {
        const p = (t * 0.85 + k * 0.5) % 1, y = 29 - p * 27, rr = 5 + p * 8;
        for (let a = 0; a < TAU; a += 0.022) {
          const sn = Math.sin(a);
          api.px(16 + Math.cos(a) * rr, y + sn * rr * 0.34, sn > 0 ? Y[2] : Y[4]);
        }
      }
      for (let k = 0; k < 12; k++) {                                     // sparks carried up with it
        const a = k * (TAU / 12) + 0.3, d = 4 + e * 12;
        const x = 16 + Math.cos(a) * d, y = 23 + Math.sin(a) * d * 0.55 - e * 11;
        api.px(x, y, k & 1 ? Y[0] : Y[2]);
        if (k % 3 === 0) api.px(x, y + 1, Y[3]);
      }
    };

    /* ---- pickup sparkle -------------------------------------------------- */
    const sparkle = (api, i, t) => {
      const l = 3 + Math.sin(t * Math.PI) * 7;
      api.line(16 - l, 16, 16 + l, 16, '#ffffff');
      api.line(16, 16 - l, 16, 16 + l, '#ffffff');
      api.line(16 - l * 0.45, 16 - l * 0.45, 16 + l * 0.45, 16 + l * 0.45, '#fee761');
      api.line(16 + l * 0.45, 16 - l * 0.45, 16 - l * 0.45, 16 + l * 0.45, '#fee761');
      api.ellipse(14, 14, 18, 18, '#fff6c9', true);
      for (let k = 0; k < 4; k++) api.px(16 + Math.cos(k * 1.57 + t * 3) * 11, 16 + Math.sin(k * 1.57 + t * 3) * 11, '#fee761');
    };

    return { width: 32, height: 32, name: 'fx-aura', layers: [{ name: 'FX' }], states: [
      D('portal_swirl', 8, true, seq(4, 8, portal)),
      /* Light and motes: outlined, the dissolve came back as a swarm of
         black-rimmed ticks and the heal shaft as a green brick. */
      D('teleport_out', 12, false, seq(5, 12, teleOut, true)),
      D('heal_aura', 8, true, seqL(4, 8, heal, true)),
      /* Soft: the house outline rimmed the inside of the band as well as the
         outside, so the middle of the ring filled with black and the whole
         thing came back as a crown with a dark mouth in it. */
      D('buff_ring', 8, true, seqL(4, 8, buff, true)),
      D('level_up', 12, false, seq(5, 12, levelup, true)),
      D('pickup_sparkle', 12, false, seq(4, 12, sparkle))
    ] };
  }

  /* ================= GUNPLAY / SCI-FI BEAMS ================= */
  function beamSuite() {
    /* ---- muzzle flash ---------------------------------------------------- */
    const muzzle = (api, i) => {
      const F = ['#ffffff', '#fff6c9', '#fee761', '#feae34', '#f77622', '#e43b44'];
      const bx = 5, by = 16, L = [8, 16, 10, 3][i];
      /* Burning gas leaving the barrel, measured as a heat field. The old
         flash was a white lozenge with eight orange spokes, which is a
         cartoon sun, and the smoke was a solid grey sausage beside it. */
      for (let x = bx; x <= bx + L; x++) {
        const k = (x - bx) / Math.max(1, L);
        const hh = (1.6 + Math.pow(k, 0.5) * 5.8) * Math.sqrt(Math.max(0, 1 - Math.pow(k, 4)))
          * (1 + (api.hash(x, i * 7, 5) - 0.5) * 0.44);
        if (hh < 0.6) continue;
        for (let y = Math.round(by - hh); y <= by + hh; y++) {
          const v = Math.abs(y - by) / hh;
          const heat = (1 - k * 0.8) * (1 - v * 0.7) + (api.hash(x, y, i + 3) - 0.5) * 0.2;
          api.px(x, y, heat > 0.7 ? F[0] : heat > 0.54 ? F[1] : heat > 0.36 ? F[2]
            : heat > 0.18 ? F[3] : F[4]);
        }
      }
      if (i < 3) for (let k = 0; k < 9; k++) {                           // burning powder thrown clear
        const a = k * (TAU / 9) + 0.2 + i * 0.12;
        const d = (4 + api.hash(k, 1, 7) * 9) * (1 - i * 0.3);
        for (let r = 2; r <= d; r++) {
          api.px(bx + 2 + Math.cos(a) * r, by + Math.sin(a) * r, r < d * 0.5 ? F[1] : F[3]);
        }
      }
      /* Kept inside the tile. Drifting at six pixels a frame the bank was
         half off the right edge by the last frame and the state ended on an
         empty cell with a smudge in the corner. */
      if (i >= 2) for (let k = 0; k < 4; k++) {                          // and the smoke behind it
        const d = (k + 1) * (3.4 + (i - 2) * 1.4);
        cloud(api, bx + 3 + d, by - 1 - k * 0.9 - (i - 2) * 1.6, 2.4 + k * 0.7 + (i - 2), {
          seed: k * 3 + i, lump: 0.32, ox: -1.4, oy: -1.6, grain: 0.26, sparse: 0.8,
          stops: [[0.42, '#8b9bb4'], [0.74, '#5a6988'], [1, '#3a4466']] });
      }
    };

    /* ---- laser bolt ------------------------------------------------------ */
    const laser = (api, i) => {
      const R = ['#ffffff', '#ffd9dd', '#ff5c6e', '#e43b44', '#a22633', '#5a1420'];
      const x = 4 + i * 8;
      /* A bolt is a head with a long tail behind it, thinning and cooling all
         the way. Three flat stripes of even length made a capsule -- the old
         state read as a pill from a blister pack. */
      for (let q = 0; q <= 20; q++) {
        const xx = x - q; if (xx < 0) break;
        const u = q / 20, hh = 2.3 * (1 - u) + 0.4;
        for (let y = Math.round(16 - hh); y <= 16 + hh; y++) {
          const v = Math.abs(y - 16) / Math.max(0.6, hh);
          const heat = (1 - u) * (1 - v * 0.78);
          if (heat < 0.1) continue;
          api.px(xx, y, heat > 0.72 ? R[0] : heat > 0.5 ? R[1] : heat > 0.32 ? R[2]
            : heat > 0.17 ? R[3] : R[4]);
        }
        /* The halo hugs the bolt. Set three rows out in near black it was a
           dashed line above and below and read as whiskers. */
        if (q < 16 && api.hash(xx, 3, 5) < 0.5) {
          const o = Math.round(hh) + 1;
          api.px(xx, 16 - o, R[4]); api.px(xx, 16 + o, R[4]);
        }
      }
      api.px(x + 1, 16, R[0]); api.px(x + 2, 16, R[1]);                  // the head, running ahead
      api.px(x, 15, R[1]); api.px(x, 17, R[1]);
    };

    /* ---- plasma charge ---------------------------------------------------- */
    const plasma = (api, i) => {
      const G = ['#ffffff', '#c7f36a', '#63c74d', '#3e8948', '#265c42'];
      const r = 6.4 + Math.sin((i / 4) * TAU) * 1.4;
      cloud(api, 16, 16, r, { seed: 3 + i, lump: 0.18, ox: -r * 0.28, oy: -r * 0.3,
        grain: 0.24, stops: [[0.3, G[0]], [0.55, G[1]], [0.8, G[2]], [1, G[3]]] });
      /* Arcs crawling over the skin of it. Four concentric filled circles and
         a white pip in the middle was a medkit icon, not a charge. */
      for (let k = 0; k < 4; k++) {
        let a = k * (TAU / 4) + i * (TAU / 16);
        for (let q = 0; q < 15; q++) {
          a += 0.2 + (api.hash(k, q, 5) - 0.5) * 0.52;
          const rq = r + 0.6 + (api.hash(k, q, 9) - 0.5) * 2.6;
          api.px(16 + Math.cos(a) * rq, 16 + Math.sin(a) * rq, q & 1 ? G[0] : G[1]);
        }
      }
      for (let k = 0; k < 10; k++) {                                      // the corona it sheds
        const a = k * (TAU / 10) + i * 0.32, d = r + 3 + api.hash(k, 2, 7) * 3;
        api.px(16 + Math.cos(a) * d, 16 + Math.sin(a) * d, G[1]);
      }
    };

    /* ---- continuous beam --------------------------------------------------- */
    const beam = (api, i) => {
      const C = ['#ffffff', '#b8f0ff', '#2ce8f5', '#0099db', '#124e89'];
      for (let x = 0; x < 32; x++) {
        /* The beam breathes along its length and the breathing travels, so
           the loop moves without the beam moving. Four flat rules of constant
           width with a dashed line down the middle read as a ruler. */
        const w = 4.4 + Math.sin((x + i * 8) * 0.34) * 0.9;
        for (let y = Math.round(16 - w - 2); y <= 16 + w + 2; y++) {
          const u = Math.abs(y - 16) / w;
          if (u < 0.22) api.px(x, y, C[0]);
          else if (u < 0.5) api.px(x, y, C[1]);
          else if (u < 0.8) api.px(x, y, C[2]);
          else if (u <= 1) api.px(x, y, C[3]);
          else if (api.hash(x + i * 8, y, 11) < (1.4 - u) * 1.2) api.px(x, y, C[4]);
        }
        if ((x + i * 5) % 9 < 2) { api.px(x, 14, C[0]); api.px(x, 18, C[0]); }
      }
      for (let k = 0; k < 8; k++) {                                        // charge shed sideways
        const x = (k * 5 + i * 4) % 32;
        api.px(x, 16 + (k & 1 ? 8 : -8) + Math.round(api.hash(k, i, 3) * 3), C[2]);
      }
    };

    /* ---- ricochet ---------------------------------------------------------- */
    const ricochet = (api, i, t) => {
      const S = ['#ffffff', '#fff6c9', '#fee761', '#feae34', '#8b9bb4', '#5a6988'];
      const ix = 21, iy = 17;
      if (i < 2) {                                                         // the flash where it bit
        const r = 4.6 - i * 1.7;
        cloud(api, ix, iy, r, { seed: 3, lump: 0.22, grain: 0.24,
          stops: [[0.4, S[0]], [0.72, S[1]], [1, S[2]]] });
      }
      /* Sparks fan back the way the round came and then fall. Eight spokes of
         equal length round the point of impact was a sparkler on a cake. */
      for (let k = 0; k < 14; k++) {
        const a = -2.9 + (k / 13) * 1.9 + (api.hash(k, 1, 3) - 0.5) * 0.22;
        const v = 5 + api.hash(k, 2, 5) * 13;
        const x = ix + Math.cos(a) * v * t, y = iy + Math.sin(a) * v * t + t * t * 14;
        if (x < 0 || x > 31 || y < 0 || y > 31) continue;
        const vx = Math.cos(a) * v, vy = Math.sin(a) * v + t * 30, n = Math.hypot(vx, vy) || 1;
        for (let j = 1; j <= 2; j++) api.px(x - vx / n * j, y - vy / n * j, S[3]);
        api.px(x, y, k % 3 ? S[1] : S[0]);
      }
      for (let k = 0; k < 4; k++) {                                        // fragments of the round
        api.px(ix - 4 - k * 2 - t * 6, iy + Math.round(Math.sin(k * 1.7) * 2.5), S[4]);
      }
      if (i >= 2) cloud(api, ix - 1, iy - 3 - (i - 2) * 2, 2.6 + (i - 2) * 1.5, {
        seed: 7 + i, lump: 0.3, ox: -1.2, oy: -1.4, grain: 0.26, sparse: 0.78,
        stops: [[0.45, S[4]], [1, S[5]]] });
    };

    return { width: 32, height: 32, name: 'fx-beam', layers: [{ name: 'FX' }], states: [
      /* All soft. Every one of these is light: a house outline turns the bolt
         into a black-edged capsule and rims each loose spark separately. */
      D('muzzle_flash', 18, false, seq(4, 18, muzzle, true)),
      D('laser_bolt', 16, true, seq(4, 16, laser, true)),
      D('plasma_charge', 10, true, seqL(4, 10, plasma, true)),
      D('beam_loop', 14, true, seq(4, 14, beam, true)),
      D('ricochet', 16, false, seq(4, 16, ricochet, true))
    ] };
  }

  return { explosionSuite, smokeSuite, impactSuite, elementalSuite, auraSuite, beamSuite };
})();
