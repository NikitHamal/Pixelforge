/* PixelForge Studio — Space shooter pack.
   A complete vertical-scroller kit: a player fighter with real banking, two
   enemy hulls, a 64x64 dreadnought, breakable asteroids, powerups, a weapons
   FX sheet and a parallax-ready starfield tileset.

   Everything faces UP (the shmup convention) and keeps row 0 clear so the
   outline pass can close — a ship that bleeds off the top of its own cell
   cannot be packed into an atlas without a halo. */
window.PF = window.PF || {};
PF.Space = (() => {
  const P = () => PF.Pixel;
  const D = (name, fps, loop, frames) => ({ name, fps, loop, frames });
  const Fr = (duration, paint) => ({ duration, paint });
  const ms = fps => Math.round(1000 / fps);
  const OUT32 = PF.Color.hexToU32('#181425');
  const draw = painter => (buf, W, H) => { painter(P().makeApi(buf, W, H), W, H); buf.set(PF.Raster.outline(buf, W, H, OUT32)); };
  const seq = (n, fps, make) => Array.from({ length: n }, (_, i) =>
    Fr(ms(fps), draw((a, W, H) => make(a, i, n > 1 ? i / (n - 1) : 0, W, H))));
  const cyc = (n, fps, make) => Array.from({ length: n }, (_, i) =>
    Fr(ms(fps), draw((a, W, H) => make(a, i, i / n, W, H))));
  const still = painter => [Fr(200, draw(painter))];
  const TAU = Math.PI * 2;
  const speck = (a, x0, y0, x1, y1, seed, colors, density = 0.1) => {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++)
      if (a.hash(x, y, seed) < density) a.px(x, y, colors[Math.floor(a.hash(x, y, seed + 71) * colors.length) % colors.length]);
  };
  /* Mirror-draw: shmup hulls are symmetric, and hand-placing both halves is
     how you end up with a ship that is one pixel wider on the left. */
  const mirror = (a, cx, fn) => { fn(1); fn(-1); void cx; };

  /* Engine flame. Length and colour come off a table rather than a sine so no
     two frames of the loop ever match — a bare sine repeats either side of
     its peak and the quality gate calls that a static frame. */
  function flame(a, x, y, len, wide, dir) {
    const core = ['#fff6c9', '#ffd24a', '#ff8d3a'], s = dir === undefined ? 1 : dir;
    /* Root width scales with length as well as taper. Without the length term
       a one-row flame still paints its full 3px root, and a bank of short
       engines reads as a row of yellow dashes pasted above the hull. */
    const base = (wide ? 2.2 : 1.4) * Math.min(1, len / 4);
    for (let d = 0; d < len; d++) {
      const w = Math.max(0, Math.round(base * (1 - d / len)));
      a.line(x - w, y + d * s, x + w, y + d * s, core[Math.min(2, Math.floor(d / Math.max(1, len / 3)))], 1);
    }
    if (len > 2) a.px(x, y + len * s, '#c3562a');
  }

  /* Muzzle flash. A filled circle at the barrel reads as a ball being held
     rather than a discharge: what sells a discharge is a cone that is widest
     at the barrel with a hot core, plus two side flares at the root. */
  function muzzle(a, x, y, len, dir, hot, warm) {
    for (let d = 0; d < len; d++) {
      const w = Math.max(0, Math.round(len * 0.45 * (1 - d / len)));
      a.line(x - w, y + d * dir, x + w, y + d * dir, d * 2 < len ? hot : warm, 1);
    }
    a.px(x, y + len * dir, warm);
    const f = Math.max(1, Math.round(len * 0.45) + 1);
    a.px(x - f, y, warm); a.px(x + f, y, warm);
  }

  /* Explosions. A ring of dots on its own reads as a smoke ring, not as a
     ship coming apart: what sells it is a filled, ragged fireball whose
     centre cools from white to ember while the shock ring runs ahead of it,
     with hull fragments thrown clear on their own trajectories. */
  function fireball(a, cx, cy, r, seed, ramp) {
    for (let y = Math.round(cy - r); y <= Math.round(cy + r); y++)
      for (let x = Math.round(cx - r); x <= Math.round(cx + r); x++) {
        const dx = x - cx, dy = y - cy, d = Math.sqrt(dx * dx + dy * dy);
        const wobble = 1 + (a.hash(x >> 1, y >> 1, seed) - 0.5) * 0.35;
        if (d > r * wobble) continue;
        const t = d / r;
        a.px(x, y, ramp[Math.min(ramp.length - 1, Math.floor(t * ramp.length))]);
      }
  }
  function shockRing(a, cx, cy, r, c, gap) {
    const n = Math.max(12, Math.round(r * 6));
    for (let k = 0; k < n; k++) {
      if (gap && k % gap === 0) continue;
      const ang = (k / n) * TAU;
      a.px(cx + Math.cos(ang) * r, cy + Math.sin(ang) * r, c);
    }
  }
  function shards(a, cx, cy, d, n, seed, c) {
    for (let k = 0; k < n; k++) {
      const ang = a.hash(k, seed, 3) * TAU, dist = d * (0.6 + a.hash(k, seed + 4, 3) * 0.5);
      const x = cx + Math.cos(ang) * dist, y = cy + Math.sin(ang) * dist;
      a.rect(x, y, x + (k % 2), y + 1 - (k % 2), c);
    }
  }
  /* Dissipating smoke. Puffs on an even ring at one size read as a daisy, so
     every puff gets its angle, distance and radius wobbled off api.hash —
     unequal blobs at unequal depths is the difference between smoke and a
     flower. */
  /* Flat-ish ramps on purpose: fireball() bands its ramp by radius, so a hot
     three-stop ramp on a large puff rasterises into a bullseye. */
  const EMBER_SMOKE = [['#4a4a5c', '#3d4a5c', '#2f3a52'], ['#6b3524', '#4a4a5c', '#3d4a5c']];
  const COLD_SMOKE = [['#8b9bb4', '#5c6a86', '#3d4a5c'], ['#6d7d92', '#4a5568', '#2f3a52']];
  function smoke(a, cx, cy, n, spread, radius, seed, ramps) {
    const rr = ramps || EMBER_SMOKE;
    for (let k = 0; k < n; k++) {
      const ang = (k / n) * TAU + seed + a.hash(k, seed + 5, 3) * 0.9;
      const sp = spread * (0.55 + a.hash(k, seed + 9, 3) * 0.8);
      const pr = radius * (0.6 + a.hash(k, seed + 13, 3) * 0.75);
      fireball(a, cx + Math.cos(ang) * sp, cy + Math.sin(ang) * sp * 0.85, pr, seed + k,
        rr[k % 3 ? 0 : 1]);
    }
  }
  const FIRE = ['#ffffff', '#fff6c9', '#ffd24a', '#ff8d3a', '#c3562a'];
  const EMBER = ['#ffd24a', '#ff8d3a', '#c3562a', '#6b3524'];
  /* Five-beat ship explosion, reused by every hull in the pack. */
  function explodeState(fps, cx, cy, maxR, seed, debris) {
    return seq(5, fps, (a, i) => {
      if (i === 0) { fireball(a, cx, cy, maxR * 0.45, seed, ['#ffffff', '#ffffff', '#fff6c9']); return; }
      const t = i / 4, r = maxR * (0.35 + t * 0.65);
      if (i < 3) fireball(a, cx, cy, maxR * (0.75 - i * 0.12), seed + i, i === 1 ? FIRE : EMBER);
      else {
        /* Late frames are smoke, and smoke is lumpy: a single shrinking disc
           leaves a hollow ring with a dot in the middle. */
        const k4 = i - 3;
        smoke(a, cx, cy, 7, maxR * (0.26 + k4 * 0.3), maxR * (0.3 - k4 * 0.07), seed);
        fireball(a, cx, cy, maxR * (0.34 - k4 * 0.12), seed + i, ['#ffd24a', '#c3562a', '#6b3524']);
      }
      if (i < 4) { shockRing(a, cx, cy, r, i < 3 ? '#fff6c9' : '#c3562a', i + 2); shockRing(a, cx, cy, r - 1, i < 3 ? '#ffd24a' : '#6b3524', 3); }
      shards(a, cx, cy, r + 2, 10 - i, seed + 17, debris);
    });
  }

  /* ============================================================= PLAYER ===
     A delta interceptor. Banking is drawn, not sheared: the far wing loses
     rows and the cockpit slides, which is the only way a 32px ship reads as
     rolling instead of as a different sprite. */
  function playerShip(a, bank, thrust, hit) {
    const hull = hit ? '#ffd0d0' : '#cfd9ea', hullL = '#ffffff', hullD = hit ? '#b06060' : '#6d7d92';
    const wing = hit ? '#ff9a9a' : '#3f7fd4', wingD = hit ? '#a34848' : '#1f4f94', glass = '#2ce8f5';
    const b = bank;
    // wings: the leading wing stays full, the trailing one is foreshortened
    for (const s of [-1, 1]) {
      const near = s === Math.sign(b || 1), span = b === 0 ? 10 : (near ? 11 : 7);
      for (let d = 2; d <= span; d++) {
        const top = 14 + Math.round(d * 0.55) - (near ? Math.abs(b) : 0);
        a.line(16 + s * d, top, 16 + s * d, 22 - Math.round(d * 0.25), s > 0 ? wing : wingD);
        if (d > span - 2) a.px(16 + s * d, top, hullD);
      }
      a.line(16 + s * (span - 3), 22, 16 + s * span, 20, wingD, 1);
    }
    // fuselage
    a.line(16 + b, 3, 16 + b, 6, hull);
    a.ellipse(13 + b, 6, 19 + b, 26, hull, true);
    a.ellipse(14 + b, 7, 16 + b, 24, hullL, true);
    a.ellipse(18 + b, 8, 19 + b, 24, hullD, true);
    a.rect(12 + b, 18, 20 + b, 19, hullD);
    // canopy
    a.ellipse(14 + b, 9, 18 + b, 16, '#143a5e', true);
    a.ellipse(15 + b, 10, 17 + b, 13, glass, true);
    a.px(15 + b, 10, '#ffffff');
    // nose cannon + wing tips
    a.rect(15 + b, 2, 17 + b, 5, hullD);
    a.rect(16 + b, 1, 16 + b, 4, '#f6a03a');
    for (const s of [-1, 1]) a.rect(16 + s * 9, 13, 16 + s * 9, 16, '#f6a03a');
    // engines
    a.rect(13 + b, 24, 14 + b, 27, hullD); a.rect(18 + b, 24, 19 + b, 27, hullD);
    if (thrust) { flame(a, 13 + b, 27, thrust, false); flame(a, 19 + b, 27, thrust, false); }
  }
  function playerSuite() {
    return {
      width: 32, height: 32, name: 'Player Fighter', layers: [{ name: 'ship' }],
      states: [
        D('idle', 10, true, cyc(4, 10, (a, i) => playerShip(a, 0, [3, 2, 4, 2][i], false))),
        D('bank_left', 10, false, seq(3, 10, (a, i) => playerShip(a, -(i + 1), 3, false))),
        D('bank_right', 10, false, seq(3, 10, (a, i) => playerShip(a, i + 1, 3, false))),
        /* Muzzle and tracer both start at y1. Row 0 has to stay empty or the
           outline pass cannot close the top of the sprite, and an atlas pack
           of the sheet picks up a halo along the cell edge. */
        D('fire', 14, false, seq(3, 14, (a, i) => { playerShip(a, 0, 4 - i, false);
          if (i === 0) muzzle(a, 16, 4, 3, -1, '#ffffff', '#fff6c9');
          if (i === 1) muzzle(a, 16, 3, 2, -1, '#fff6c9', '#ffd24a');
          if (i === 2) { a.rect(15, 1, 17, 5, '#9ff2fb'); a.rect(16, 1, 16, 7, '#ffffff'); } })),
        D('hit', 14, false, seq(3, 14, (a, i) => { playerShip(a, [1, -1, 0][i], 2, i < 2);
          for (let k = 0; k < 4 - i; k++) a.px(10 + k * 4, 10 + k * 3 - i * 2, k % 2 ? '#ffd24a' : '#ff4d4d'); })),
        D('explode', 12, false, explodeState(12, 16, 16, 15, 3, '#6d7d92'))
      ]
    };
  }

  /* ======================================================= ENEMY HULLS ===
     Facing DOWN (towards the player). Two silhouettes that cannot be
     confused at a glance: a swept-back dart and a fat winged bomber. */
  function fighterSuite() {
    const hull = '#b45ad4', hullL = '#e9a8f6', hullD = '#6a2a86', eye = '#ffd24a';
    const at = (a, roll, thrust, hit) => {
      const H = hit ? '#ffd0d0' : hull, HD = hit ? '#b06060' : hullD;
      for (const s of [-1, 1]) {
        for (let d = 2; d <= 10; d++) {
          const bot = 18 - Math.round(d * 0.6) + (s === roll ? 1 : 0);
          a.line(16 + s * d, 9 + Math.round(d * 0.3), 16 + s * d, bot, s > 0 ? H : HD);
        }
        /* Cannon pods sit ON the wing, not beside it. The wing sweeps back, so
           at d=10 it is a single pixel tall — a five-row pod hung out there
           floats free of the hull and reads as a tally mark. */
        a.rect(16 + s * 9, 13, 16 + s * 10, 16, eye);
        a.px(16 + s * 9, 13, '#ffe9a0');
        a.px(16 + s * 10, 17, '#b06a12');
      }
      a.ellipse(13, 4, 19, 26, H, true);
      a.ellipse(14, 5, 16, 24, hullL, true);
      a.ellipse(18, 6, 19, 24, HD, true);
      a.ellipse(14, 20, 18, 26, HD, true);                     // nose (pointing down)
      a.rect(15, 26, 17, 28, HD);
      a.ellipse(14, 9, 18, 15, '#2a1030', true);               // dark canopy
      a.rect(15, 11, 17, 12, '#ff4d4d');
      a.px(15, 11, '#ffb0b0');
      a.rect(13, 3, 14, 6, HD); a.rect(18, 3, 19, 6, HD);
      /* Enemy exhaust points up (the ship flies down), and the tip has to
         land on row 1 at the longest thrust: row 0 must stay clear. */
      if (thrust) { flame(a, 13, 4, thrust, false, -1); flame(a, 19, 4, thrust, false, -1); }
    };
    return {
      width: 32, height: 32, name: 'Enemy Interceptor', layers: [{ name: 'ship' }],
      states: [
        D('fly', 10, true, cyc(4, 10, (a, i) => at(a, 0, [3, 2, 1, 2][i], false))),
        D('strafe', 8, true, cyc(4, 8, (a, i) => at(a, [1, 0, -1, 0][i], 3, false))),
        D('fire', 14, false, seq(3, 14, (a, i) => { at(a, 0, 3, false);
          if (i === 0) muzzle(a, 16, 28, 3, 1, '#ffffff', '#fff6c9');
          if (i === 1) muzzle(a, 16, 29, 2, 1, '#fff6c9', '#ff8d3a');
          else { a.rect(15, 28, 17, 31, '#ff4d4d'); a.rect(16, 26, 16, 31, '#ffd0d0'); } })),
        D('hit', 14, false, seq(3, 14, (a, i) => { at(a, [1, -1, 0][i], 2, i < 2);
          for (let k = 0; k < 4 - i; k++) a.px(9 + k * 4, 12 + k * 3 - i * 2, k % 2 ? '#ffd24a' : '#ff4d4d'); })),
        D('explode', 12, false, explodeState(12, 16, 16, 14, 33, '#6a2a86'))
      ]
    };
  }

  function bomberSuite() {
    const hull = '#7a8a5c', hullL = '#b6c78d', hullD = '#3e4a2c', trim = '#e0603a';
    const at = (a, y, thrust, hit, hatch) => {
      const H = hit ? '#ffd0d0' : hull, HD = hit ? '#b06060' : hullD;
      a.rect(3, y + 8, 28, y + 14, H);                          // full-span wing
      a.rect(3, y + 8, 28, y + 8, hullL);
      a.rect(3, y + 14, 28, y + 14, HD);
      a.rect(3, y + 10, 8, y + 12, HD); a.rect(23, y + 10, 28, y + 12, HD);
      a.rect(4, y + 9, 7, y + 9, trim); a.rect(24, y + 9, 27, y + 9, trim);
      a.ellipse(10, y + 2, 21, y + 20, H, true);                // fat fuselage
      a.ellipse(11, y + 3, 15, y + 18, hullL, true);
      a.ellipse(19, y + 4, 21, y + 18, HD, true);
      a.ellipse(12, y + 6, 19, y + 12, '#1c2418', true);        // cockpit band
      a.rect(13, y + 8, 18, y + 9, '#ff4d4d');
      a.px(13, y + 8, '#ffb0b0');
      a.rect(13, y + 17, 18, y + 21, HD);                       // bomb bay
      if (hatch) {
        /* Ordnance is a capsule, not a disc. A 4x4 filled ellipse rasterises
           to a plus sign at this size and reads as a flower falling out of
           the bay — a body with a lit edge, a nose and two fins reads as a
           bomb even at four pixels wide. */
        const by = y + 19 + hatch;
        a.rect(13, y + 19, 18, y + 20, '#1c2418');        // open bay doors
        a.rect(14, by, 17, by + 4, '#3d4a5c');
        a.rect(14, by, 14, by + 4, '#6d7d92');
        a.rect(15, by + 4, 16, by + 5, trim);
        a.px(15, by + 5, '#ffd0a0');
        a.px(13, by, '#252d3a'); a.px(18, by, '#252d3a');
      }
      a.rect(9, y, 12, y + 4, HD); a.rect(19, y, 22, y + 4, HD);
      if (thrust) { flame(a, 10, y + 1, thrust, true, -1); flame(a, 20, y + 1, thrust, true, -1); }
    };
    return {
      width: 32, height: 32, name: 'Enemy Bomber', layers: [{ name: 'ship' }],
      states: [
        D('fly', 8, true, cyc(4, 8, (a, i) => at(a, 4 + [0, 1, 0, 0][i], [3, 4, 3, 2][i], false, 0))),
        D('drop', 8, false, seq(4, 8, (a, i) => at(a, 4, 3, false, i))),
        D('hit', 12, false, seq(3, 12, (a, i) => { at(a, 4 + [1, 0, 1][i], 2, i < 2, 0);
          for (let k = 0; k < 4 - i; k++) a.px(8 + k * 5, 8 + k * 3 - i * 2, k % 2 ? '#ffd24a' : '#ff4d4d'); })),
        D('explode', 12, false, explodeState(12, 16, 16, 15, 55, '#3e4a2c'))
      ]
    };
  }

  /* =============================================================== BOSS ===
     64x64 dreadnought: a symmetric hull, four turret blisters, a core that
     charges, and a staged break-up. */
  function bossSuite() {
    const hull = '#5c6a86', hullL = '#98a8c4', hullD = '#2f3a52', dark = '#1a2133';
    const core = '#ff4d4d', coreHot = '#ffd0d0';
    const at = (a, y, glow, dmg, turret) => {
      // wings
      for (const s of [-1, 1]) {
        for (let d = 6; d <= 30; d++) {
          const top = y + 10 + Math.round((d - 6) * 0.35), bot = y + 34 - Math.round((d - 6) * 0.7);
          if (bot <= top) continue;
          a.line(32 + s * d, top, 32 + s * d, bot, s > 0 ? hull : hullD);
        }
        /* Wingtip rail. The swept wing runs out at d=28, so a nine-row
           highlight parked at d=30 floats clear of the hull as a tick mark:
           the rail has to sit on the rows the wing actually occupies. */
        a.rect(32 + s * 28, y + 17, 32 + s * 30, y + 19, hullL);
        // turret blisters
        for (const tx of [14, 24]) {
          /* Socket, dome, lit cap, barrel — in that order. A dark ellipse with
             a lighter one half-overlapping it reads as camouflage blotching on
             the wing rather than as a gun mount. */
          const bx = 32 + s * tx;
          a.ellipse(bx - 4, y + 16, bx + 4, y + 24, dark, true);
          a.ellipse(bx - 3, y + 17, bx + 3, y + 23, hull, true);
          a.ellipse(bx - 2, y + 18, bx + 1, y + 20, hullL, true);
          a.rect(bx - 1, y + 23, bx + 1, y + 27 + (turret ? 2 : 0), dark);
          a.px(bx, y + 23, hullD);
          if (turret) muzzle(a, bx, y + 29, 3, 1, '#ffffff', '#ffd24a');
        }
      }
      // spine
      a.ellipse(24, y + 2, 39, y + 46, hull, true);
      a.ellipse(26, y + 4, 31, y + 42, hullL, true);
      a.ellipse(36, y + 6, 39, y + 42, hullD, true);
      a.rect(22, y + 20, 41, y + 23, hullD);
      a.rect(22, y + 30, 41, y + 32, hullD);
      a.ellipse(26, y + 8, 37, y + 18, dark, true);              // bridge
      for (let r = 0; r < 3; r++) a.rect(28, y + 10 + r * 2, 35, y + 10 + r * 2, r === 1 ? '#2ce8f5' : '#1d6a9a');
      // reactor core
      /* A 3x3 filled ellipse rasterises to a plus sign, and a white cross on a
         red disc reads as a first-aid kit rather than a weak point. Concentric
         discs with an offset 2x2 glint read as a glowing lens instead. */
      const cr = 4 + glow, cy0 = y + 28;
      a.ellipse(32 - cr - 1, cy0 - cr - 1, 32 + cr + 1, cy0 + cr + 1, dark, true);
      a.ellipse(32 - cr, cy0 - cr, 32 + cr, cy0 + cr, glow > 1 ? coreHot : core, true);
      a.ellipse(32 - cr + 2, cy0 - cr + 2, 32 + cr - 2, cy0 + cr - 2, glow > 1 ? '#ffffff' : coreHot, true);
      a.rect(32 - cr + 2, cy0 - cr + 2, 32 - cr + 3, cy0 - cr + 3, '#ffffff');
      // prow guns
      a.rect(28, y + 44, 30, y + 50, hullD); a.rect(34, y + 44, 36, y + 50, hullD);
      a.rect(31, y + 46, 33, y + 52, dark);
      if (dmg) for (let k = 0; k < dmg * 4; k++) {
        const x = 18 + Math.floor(a.hash(k, 3, 7) * 28), yy = y + 6 + Math.floor(a.hash(k, 5, 7) * 38);
        a.px(x, yy, k % 3 ? '#ff8d3a' : '#252d3a');
      }
      // engines
      for (const ex of [26, 32, 38]) { a.rect(ex - 2, y, ex + 2, y + 4, hullD); flame(a, ex, y - 3, 4, true); }
    };
    return {
      width: 64, height: 64, name: 'Dreadnought Boss', layers: [{ name: 'boss' }],
      states: [
        D('idle', 6, true, cyc(4, 6, (a, i) => at(a, 6 + [0, 1, 2, 1][i], [0, 1, 2, 1][i], 0, false))),
        /* Converging streaks, not dots. Twelve single pixels at one-pixel
           brightness read as dust on the hull; a two-pixel radial streak
           pointing at the core reads as energy being drawn in. */
        D('charge', 8, false, seq(4, 8, (a, i) => { at(a, 6, i, 0, false);
          for (let k = 0; k < 12; k++) {
            const ang = (k / 12) * TAU, r = 15 - i * 3, c = Math.cos(ang), n = Math.sin(ang);
            a.line(32 + c * r, 34 + n * r, 32 + c * (r + 2), 34 + n * (r + 2), k % 2 ? '#ffd0d0' : '#ff8d8d', 1);
          } })),
        D('turrets', 10, false, seq(3, 10, (a, i) => at(a, 6, [2, 1, 0][i], 0, i < 2))),
        D('damaged', 6, true, cyc(4, 6, (a, i) => at(a, 6 + (i % 2), [2, 1, 2, 0][i], 2, false))),
        /* The boss dies in two acts: secondary detonations walking across the
           still-intact hull, then the hull itself going up. Cutting straight
           to the fireball loses all the weight a 64px capital ship has. */
        D('explode', 9, false, seq(5, 9, (a, i) => {
          if (i < 2) {
            at(a, 6, 2, 3, false);
            for (let k = 0; k < 6 + i * 6; k++) {
              const x = 14 + Math.floor(a.hash(k, i, 11) * 36), y = 8 + Math.floor(a.hash(k, i + 9, 11) * 44);
              fireball(a, x, y, 2 + (k % 3), 7 + k, FIRE);
            }
            return;
          }
          const f = i - 2, r = 16 + f * 12;
          if (f < 2) {
            fireball(a, 32, 32, 26 - f * 7, 71 + f, f === 0 ? FIRE : EMBER);
            shockRing(a, 32, 32, Math.min(31, r), f === 0 ? '#fff6c9' : '#c3562a', f + 2);
            shockRing(a, 32, 32, Math.min(30, r - 2), f === 0 ? '#ffd24a' : '#6b3524', 3);
          } else {
            smoke(a, 32, 32, 10, 12, 10, 71);
            fireball(a, 32, 32, 7, 73, ['#ffd24a', '#c3562a', '#6b3524']);
          }
          shards(a, 32, 32, Math.min(30, r + 3), 16 - f * 3, 91, '#2f3a52');
        }))
      ]
    };
  }

  /* ========================================================= ASTEROIDS ===
     Four sizes, each a closed irregular polygon lit from the upper left, plus
     the crack-and-split beat that a breakable rock actually needs. */
  const ROCK = { base: '#6b6357', lit: '#a29685', hi: '#c6bba9', dark: '#3b362e', deep: '#241f1a' };
  const ICE = { base: '#5d7f96', lit: '#93b8cb', hi: '#cfe8f2', dark: '#2f4a5c', deep: '#1c2f3d' };
  function rock(a, cx, cy, r, seed, pal) {
    const p = pal || ROCK, pts = 11, rs = [];
    for (let k = 0; k < pts; k++) rs.push(r * (0.72 + a.hash(k, seed, 3) * 0.42));
    /* Radius of the silhouette at a given offset, interpolated between the
       polygon vertices. Shared by the fill and the craters so a crater can
       never bleed outside the rock it is supposed to be pitting. */
    const edgeAt = (dx, dy) => {
      let ang = Math.atan2(dy, dx) / TAU; if (ang < 0) ang += 1;
      const idx = ang * pts, i0 = Math.floor(idx) % pts, f = idx - Math.floor(idx);
      return rs[i0] * (1 - f) + rs[(i0 + 1) % pts] * f;
    };
    for (let y = Math.round(cy - r); y <= Math.round(cy + r); y++) {
      for (let x = Math.round(cx - r); x <= Math.round(cx + r); x++) {
        const dx = x - cx, dy = y - cy, d = Math.sqrt(dx * dx + dy * dy), edge = edgeAt(dx, dy);
        if (d > edge) continue;
        /* Four bands with a checker-dithered terminator. Two bands split on a
           straight comparison leave a hard diagonal seam across the rock,
           which reads as folded paper rather than as a lit surface. */
        const l = -(dx + dy) / (r * 1.6) + (1 - d / edge) * 0.25 + ((x + y) & 1) * 0.07;
        a.px(x, y, d > edge - 1 ? p.deep : l > 0.62 ? p.hi : l > 0.22 ? p.lit : l > -0.24 ? p.base : p.dark);
      }
    }
    /* Craters are concave, so the lit crescent belongs on the lower right and
       the shadow on the upper left. The other way round it reads as a bump,
       and an oversized one reads as an open mouth. */
    for (let k = 0; k < Math.max(1, Math.round(r / 3)); k++) {
      const ang = a.hash(k, seed + 5, 3) * TAU, d = a.hash(k, seed + 9, 3) * r * 0.5;
      const px = Math.round(cx + Math.cos(ang) * d), py = Math.round(cy + Math.sin(ang) * d);
      const cr = 1 + Math.round(a.hash(k, seed + 13, 3) * Math.max(0, r / 7));
      for (let yy = py - cr; yy <= py + cr; yy++) for (let xx = px - cr; xx <= px + cr; xx++) {
        const ex = xx - px, ey = yy - py, dx = xx - cx, dy = yy - cy;
        if (ex * ex + ey * ey > cr * cr + cr) continue;
        if (Math.sqrt(dx * dx + dy * dy) > edgeAt(dx, dy) - 1) continue;
        a.px(xx, yy, ex + ey > cr * 0.4 ? p.lit : p.dark);
      }
    }
  }
  function asteroidSuite() {
    return {
      width: 32, height: 32, name: 'Asteroids', layers: [{ name: 'rock' }],
      states: [
        D('large', 6, true, cyc(4, 6, (a, i) => rock(a, 16, 16, 13, 1 + i))),
        D('medium', 6, true, cyc(4, 6, (a, i) => rock(a, 16, 16, 9, 21 + i))),
        D('small', 8, true, cyc(4, 8, (a, i) => { rock(a, 10, 12, 5, 31 + i); rock(a, 22, 20, 6, 41 + i); })),
        D('ice', 6, true, cyc(4, 6, (a, i) => rock(a, 16, 16, 11, 51 + i, ICE))),
        D('ore', 6, true, cyc(4, 6, (a, i) => { rock(a, 16, 16, 11, 61 + i);
          /* Gems, not sparkles. A 3x3 filled ellipse rasterises to a plus sign,
             and five of those read as clip-art snowflakes glued on the rock. */
          for (let k = 0; k < 5; k++) { const ang = (k / 5) * TAU + i * 0.4, d = 5;
            const x = Math.round(16 + Math.cos(ang) * d), y = Math.round(16 + Math.sin(ang) * d);
            a.rect(x - 1, y - 1, x + 1, y + 1, '#0d4a60');
            a.rect(x - 1, y - 1, x, y, '#2ce8f5');
            a.px(x - 1, y - 1, '#bdf6fb'); } })),
        D('shatter', 10, false, seq(4, 10, (a, i) => {
          if (i === 0) { rock(a, 16, 16, 13, 1);
            a.line(6, 8, 24, 22, '#241f1a', 1); a.line(22, 6, 10, 24, '#241f1a', 1); return; }
          const d = i * 4;
          rock(a, 16 - d, 14 - d * 0.4, Math.max(2, 7 - i), 71);
          rock(a, 18 + d, 12 - d * 0.3, Math.max(2, 6 - i), 81);
          rock(a, 15 + d * 0.5, 22 + d * 0.5, Math.max(2, 6 - i), 91);
          for (let k = 0; k < 8; k++) { const ang = k * 0.8, dd = 6 + i * 3;
            a.px(16 + Math.cos(ang) * dd, 16 + Math.sin(ang) * dd, '#a29685'); }
        }))
      ]
    };
  }

  /* ========================================================== POWERUPS ===
     Eight capsules. Each is the same shell so they read as a set, with a
     distinct glyph and hue so they never read as the same pickup. */
  function powerupSuite() {
    const shell = (a, t, ring, glyph) => {
      const bob = [0, -1, -2, -1][t % 4];
      /* Housing, coloured bezel, gloss on the bezel only, then a DARK lens the
         glyph sits on. The first cut painted a broad white specular across the
         whole face and put the glyph on top of it, so every pale glyph lost
         its silhouette and the set read as eight coloured blobs. */
      a.ellipse(8, 10 + bob, 23, 25 + bob, '#252d3a', true);
      a.ellipse(9, 11 + bob, 22, 24 + bob, ring, true);
      a.ellipse(12, 12 + bob, 18, 13 + bob, '#ffffff', true);
      a.ellipse(11, 13 + bob, 20, 22 + bob, '#141a27', true);
      a.ellipse(12, 14 + bob, 19, 15 + bob, '#2b3448', true);
      glyph(a, 15, 18 + bob);
      // orbiting glint so every frame differs
      const ang = (t / 4) * TAU;
      a.px(16 + Math.cos(ang) * 9, 17 + bob + Math.sin(ang) * 8, '#ffffff');
      a.px(16 + Math.cos(ang + 0.4) * 9, 17 + bob + Math.sin(ang + 0.4) * 8, ring);
    };
    /* Every glyph is budgeted to the 9x9 lens at (x-4..x+4, y-4..y+4) and
       carries its own dark base tone. Glyphs drawn larger than the lens poke
       into the coloured bezel, and at 32px that reads as a stripe painted
       across the pickup rather than as an icon inside it. */
    const G = {
      gun: (a, x, y) => { a.rect(x - 4, y - 1, x + 2, y + 1, '#8b9bb4'); a.rect(x - 4, y - 1, x + 2, y - 1, '#e4eaf2');
        a.rect(x + 2, y - 1, x + 4, y, '#f6a03a'); a.px(x + 4, y, '#ffd24a');
        a.rect(x - 3, y + 2, x - 1, y + 4, '#5c6a86'); a.px(x - 3, y + 2, '#a3b0c4'); },
      shield: (a, x, y) => { a.rect(x - 4, y - 4, x + 4, y - 1, '#1d8fa8');
        for (let d = 0; d <= 4; d++) a.rect(x - 4 + d, y + d, x + 4 - d, y + d, '#1d8fa8');
        a.rect(x - 3, y - 3, x + 1, y - 2, '#2ce8f5'); a.px(x - 3, y - 3, '#bdf6fb');
        a.rect(x - 1, y, x + 1, y + 2, '#2ce8f5'); },
      /* One double chevron, not three small ones: three stacked three-pixel
         chevrons sit close enough to merge into a squiggle. */
      /* Solid triangles, not outlined chevrons. Hollow arms leave a gap at the
         mouth of each chevron, and two of those back to back read as an
         hourglass instead of as fast-forward. */
      speed: (a, x, y) => { for (const ox of [-4, 0]) for (let d = 0; d <= 3; d++) {
          const c = x + ox + d, h = 3 - d;
          a.rect(c, y - h, c, y + h, '#ffd24a');
          a.px(c, y - h, '#fff6c9');
        } },
      bomb: (a, x, y) => { a.ellipse(x - 4, y - 3, x + 3, y + 4, '#4a5568', true);
        a.ellipse(x - 3, y - 2, x - 1, y, '#a3b0c4', true); a.px(x + 2, y + 2, '#252d3a');
        a.rect(x, y - 4, x + 1, y - 3, '#5c6a86'); a.line(x + 2, y - 4, x + 3, y - 5, '#c77c1a', 1);
        a.px(x + 4, y - 5, '#ff8d3a'); a.px(x + 4, y - 6, '#ffd24a'); },
      heal: (a, x, y) => { a.rect(x - 1, y - 4, x + 1, y + 4, '#2a8f4a'); a.rect(x - 4, y - 1, x + 4, y + 1, '#2a8f4a');
        a.rect(x - 1, y - 4, x, y + 4, '#3fc46a'); a.rect(x - 4, y - 1, x + 4, y, '#3fc46a');
        a.rect(x - 1, y - 4, x, y - 3, '#a4f2b8'); a.rect(x - 4, y - 1, x - 3, y, '#a4f2b8'); },
      laser: (a, x, y) => { a.rect(x - 1, y - 4, x + 1, y + 4, '#c22a2a');
        a.rect(x - 1, y - 4, x, y + 4, '#ff4d4d'); a.px(x - 1, y - 4, '#ffb0b0');
        a.ellipse(x - 3, y - 1, x + 3, y + 1, '#ff8d3a', true); a.rect(x - 1, y, x + 1, y, '#fff6c9'); },
      coin: (a, x, y) => { a.ellipse(x - 4, y - 4, x + 4, y + 4, '#a8600f', true);
        a.ellipse(x - 3, y - 3, x + 3, y + 3, '#ffd24a', true);
        a.ellipse(x - 2, y - 3, x, y - 1, '#fff6c9', true);
        a.rect(x - 1, y - 2, x + 1, y + 2, '#a8600f'); a.px(x, y - 2, '#c77c1a'); },
      /* A small ship silhouette reads as "extra ship" far more directly than a
         pair of abstract wings, which merge into a grey lump at nine pixels. */
      wing: (a, x, y) => { a.px(x, y - 4, '#ffffff');
        a.rect(x - 1, y - 3, x + 1, y + 2, '#c0cbdc');
        a.rect(x - 1, y - 3, x, y + 2, '#ffffff');
        for (let d = 2; d <= 4; d++) { const top = y - 1 + Math.round((d - 2) * 0.8);
          a.line(x - d, top, x - d, y + 2, '#e4eaf2'); a.line(x + d, top, x + d, y + 2, '#8b9bb4'); }
        a.rect(x - 1, y + 3, x + 1, y + 3, '#2ce8f5'); }
    };
    /* Bezel hue must differ from the glyph hue. Yellow chevrons inside a yellow
       bezel merge with it, and the dark lens showing between the arms becomes
       the shape the eye reads — the icon inverts into a bowtie. */
    const st = (name, ring, glyph) => D(name, 8, true, cyc(4, 8, (a, i) => shell(a, i, ring, glyph)));
    return {
      width: 32, height: 32, name: 'Ship Powerups', layers: [{ name: 'pickup' }],
      states: [st('weapon', '#f6a03a', G.gun), st('shield', '#2ce8f5', G.shield), st('speed', '#3f7fd4', G.speed),
        st('bomb', '#b45ad4', G.bomb), st('repair', '#3fc46a', G.heal), st('laser', '#ff4d4d', G.laser),
        st('credits', '#ffd24a', G.coin), st('wingman', '#6d7d92', G.wing)]
    };
  }

  /* ================================================================ FX ===
     The shots, hits and shields the pack needs to actually play. */
  function fxSuite() {
    return {
      width: 32, height: 32, name: 'Space FX', layers: [{ name: 'fx' }],
      states: [
        /* A 2x5 stem with a 4x3 belly rasterises to a teardrop, and three of
           those spaced down a column read as balloons on a string. A bolt
           needs a hot round head with a tail cooling out behind it. */
        D('bullet', 12, true, cyc(4, 12, (a, i) => {
          /* Two bolts, twelve apart. Three at eight apart leaves no gap between
             a bolt's tail and the next head, and the stream reads as a chain
             of beads rather than as separate shots. */
          for (let k = 0; k < 2; k++) { const y = 2 + ((i * 3 + k * 12) % 24);
            a.rect(15, y + 6, 16, y + 8, '#c3562a');
            a.rect(15, y + 4, 16, y + 6, '#ff8d3a');
            a.rect(14, y + 1, 17, y + 4, '#ffd24a');
            a.rect(15, y, 16, y + 4, '#fff6c9');
            a.rect(15, y + 1, 16, y + 2, '#ffffff'); }
        })),
        D('laser_beam', 12, true, cyc(4, 12, (a, i) => {
          a.rect(13, 0, 18, 31, '#5a1030');
          a.rect(14, 0, 17, 31, '#ff4d4d');
          a.rect(15, 0, 16, 31, '#ffd0d0');
          /* Scrolling energy goes in the core as short dashes. A bright bar
             spanning the full beam width every four rows reads as the rungs
             of a ladder. */
          for (let y = 0; y < 32; y++) {
            if ((y + i * 2) % 6 < 2) a.rect(15, y, 16, y, '#ffffff');
            if ((y + i * 3) % 8 === 0) { a.px(14, y, '#ffd0d0'); a.px(17, y, '#ffd0d0'); }
          }
        })),
        D('plasma', 10, true, cyc(4, 10, (a, i) => {
          const r = 6 + (i % 2);
          a.ellipse(16 - r, 16 - r, 16 + r, 16 + r, '#1d6a9a', true);
          a.ellipse(16 - r + 2, 16 - r + 2, 16 + r - 2, 16 + r - 2, '#2ce8f5', true);
          a.ellipse(14, 14, 18, 18, '#bdf6fb', true);
          for (let k = 0; k < 8; k++) { const ang = (k / 8) * TAU + i * 0.5;
            a.px(16 + Math.cos(ang) * (r + 2), 16 + Math.sin(ang) * (r + 2), '#9ff2fb'); }
        })),
        D('shield_hit', 14, false, seq(4, 14, (a, i) => {
          const r = 13 - i;
          for (let k = 0; k < 48; k++) { const ang = (k / 48) * TAU;
            if ((k + i) % 3 === 0) continue;
            a.px(16 + Math.cos(ang) * r, 16 + Math.sin(ang) * r, i < 2 ? '#bdf6fb' : '#2aa6c8');
            a.px(16 + Math.cos(ang) * (r - 1), 16 + Math.sin(ang) * (r - 1), '#2ce8f5'); }
          for (let k = 0; k < 6 - i; k++) a.px(16 + Math.cos(k) * (r + 2), 16 + Math.sin(k) * (r + 2), '#ffffff');
        })),
        D('impact', 16, false, seq(4, 16, (a, i) => {
          const r = 3 + i * 3;
          for (let k = 0; k < 12; k++) {
            /* Ragged spike lengths. Twelve equal spikes evenly spaced around a
               hollow centre read as the minute marks on a clock face. */
            const ang = (k / 12) * TAU, len = 2 + a.hash(k, 3, 5) * 3;
            const out = r * (0.72 + a.hash(k, 9, 5) * 0.45);
            a.line(16 + Math.cos(ang) * (out - len), 16 + Math.sin(ang) * (out - len),
              16 + Math.cos(ang) * out, 16 + Math.sin(ang) * out, i < 2 ? '#fff6c9' : '#ff8d3a', 1); }
          const cr = Math.max(1, 4 - i);
          a.ellipse(16 - cr, 16 - cr, 16 + cr, 16 + cr, i < 2 ? '#ffffff' : i === 2 ? '#ffd24a' : '#ff8d3a', true);
        })),
        D('warp', 10, false, seq(4, 10, (a, i) => {
          for (let k = 0; k < 20; k++) {
            const ang = (k / 20) * TAU, len = 3 + i * 6, d = 4;
            a.line(16 + Math.cos(ang) * d, 16 + Math.sin(ang) * d,
              16 + Math.cos(ang) * (d + len), 16 + Math.sin(ang) * (d + len), k % 3 ? '#9ff2fb' : '#ffffff', 1);
          }
          a.ellipse(16 - 4 + i, 16 - 4 + i, 16 + 4 - i, 16 + 4 - i, '#bdf6fb', true);
        })),
        /* Rising puff, on the shared cloud so a hull hit and a ship coming
           apart dissipate with the same vocabulary. Five hand-placed ellipses
           with a lit cap each merged into one grey lump. */
        D('smoke', 8, false, seq(4, 8, (a, i) =>
          smoke(a, 16, 23 - i * 5, 7, 2 + i * 1.8, 4.5 + i * 0.6, 101, COLD_SMOKE)))
      ]
    };
  }

  /* =========================================================== TILESET ===
     A 64x64 sheet of 16 space backdrops and station-exterior blocks that all
     wrap horizontally, so a scroller can loop any row forever. */
  function tilesetSuite() {
    const cell = (api, cx, cy) => P().offsetApi(api, cx * 16, cy * 16);
    const stars = (c, seed, density, hues) => {
      for (let k = 0; k < density; k++) {
        const x = Math.floor(c.hash(k, seed, 3) * 16), y = Math.floor(c.hash(k, seed + 7, 3) * 16);
        c.px(x, y, hues[k % hues.length]);
      }
    };
    const paint = a => {
      // --- deep space, three densities, all wrap because nothing crosses an edge
      for (let i = 0; i < 3; i++) {
        const c = cell(a, i, 0);
        c.rect(0, 0, 15, 15, '#0a0e1c');
        stars(c, 3 + i * 5, 4 + i * 6, ['#c0cbdc', '#9ad8ff', '#ffe9b0', '#6d7d92']);
        if (i === 2) { c.px(4, 5, '#ffffff'); c.px(3, 5, '#9ad8ff'); c.px(5, 5, '#9ad8ff'); c.px(4, 4, '#9ad8ff'); c.px(4, 6, '#9ad8ff'); }
      }
      const neb = cell(a, 3, 0);
      neb.rect(0, 0, 15, 15, '#140b26');
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
        const v = neb.hash(x >> 1, y >> 1, 11) * 0.6 + neb.hash(x >> 2, y >> 2, 17) * 0.4;
        if (v > 0.72) neb.px(x, y, '#5b2f86'); else if (v > 0.58) neb.px(x, y, '#351c56');
      }
      stars(neb, 23, 6, ['#e9a8f6', '#ffffff']);

      /* Alien surface strip. Rust, not soil brown: a mid-brown sitting next to
         a deep-space palette reads as earth dirt, which is the one thing a
         planet tile in a star-field scroller must not look like. */
      const R = { deep: '#3f1a10', dark: '#6b2e1c', base: '#9c4a2e', lit: '#d4855a', crest: '#f0b57a' };
      const hz = cell(a, 0, 1);
      hz.rect(0, 0, 15, 15, '#101a30');
      stars(hz, 53, 3, ['#c0cbdc', '#9ad8ff']);
      /* Horizon plotted per column so it still wraps. A straight edge with one
         dither row above it reads as a printed border. */
      for (let x = 0; x < 16; x++) {
        const h = 7 - (x % 5 === 0 ? 1 : 0);
        hz.rect(x, h, x, 15, R.base);
        hz.px(x, h, R.crest); hz.px(x, h + 1, R.lit);
      }
      speck(hz, 0, 9, 15, 15, 29, [R.dark, R.lit], 0.36);

      const dune = cell(a, 1, 1);
      /* Dunes as stacked ripple bands: crest highlight, body, shadowed lee. One
         sine crest over a flat fill reads as a block with a line drawn on it,
         and speckling over several crests turns the whole tile to rubble — so
         the bands are explicit and nothing is speckled on top of them. */
      dune.rect(0, 0, 15, 15, R.dark);
      for (let x = 0; x < 16; x++) {
        const w = Math.sin((x / 16) * TAU);
        for (let k = 0; k < 3; k++) {
          const y = k * 5 + 1 + Math.round(w * (k % 2 ? -1.5 : 1.5));
          dune.rect(x, y + 1, x, y + 3, R.base);
          dune.px(x, y, R.crest);
          dune.px(x, y + 4, R.deep);
        }
      }

      const crat = cell(a, 2, 1);
      crat.rect(0, 0, 15, 15, R.base);
      speck(crat, 0, 0, 15, 15, 37, [R.lit, R.dark], 0.4);
      /* Lit crescent on the lower right of the bowl. On the upper rim instead,
         a crater reads as a bump. */
      for (const [cx2, cy2, r] of [[5, 5, 3], [11, 11, 2]]) {
        for (let y = cy2 - r; y <= cy2 + r; y++) for (let x = cx2 - r; x <= cx2 + r; x++) {
          const ex = x - cx2, ey = y - cy2;
          if (ex * ex + ey * ey > r * r + r) continue;
          crat.px(x, y, ex + ey > r * 0.4 ? R.lit : R.deep);
        }
      }

      const cliff = cell(a, 3, 1);
      /* Horizontal strata with vertical fractures. Vertical bands on their own
         read as timber planking, whatever the hue. */
      for (let y = 0; y < 16; y++) {
        const band = Math.floor(y / 3);
        cliff.rect(0, y, 15, y, [R.base, R.dark, R.base, R.deep, R.dark, R.base][band % 6]);
        if (y % 3 === 0) cliff.rect(0, y, 15, y, R.lit);
      }
      for (let x = 0; x < 16; x++) if (cliff.hash(x, 59, 5) > 0.72) cliff.rect(x, 0, x, 15, R.deep);
      speck(cliff, 0, 1, 15, 15, 61, [R.dark, R.deep], 0.24);
      cliff.rect(0, 0, 15, 0, R.crest);

      // --- station exterior: plating, solar wing, antenna, dome
      const plate = cell(a, 0, 2);
      plate.rect(0, 0, 15, 15, '#46516a');
      plate.rectO(0, 0, 15, 15, '#2c3446'); plate.rect(0, 0, 15, 0, '#66748f');
      speck(plate, 1, 1, 14, 14, 41, ['#3a445c', '#5b6785'], 0.28);
      for (const [x, y] of [[3, 3], [12, 3], [3, 12], [12, 12]]) plate.px(x, y, '#9aa5bd');

      const solar = cell(a, 1, 2);
      solar.rect(0, 0, 15, 15, '#16243a');
      for (let y = 1; y < 15; y += 3) for (let x = 1; x < 15; x += 3) {
        solar.rect(x, y, x + 1, y + 1, '#1d3a72'); solar.px(x, y, '#3f7fd4');
      }
      solar.rect(0, 7, 15, 8, '#46516a'); solar.rect(0, 7, 15, 7, '#8b9bb4');

      const ant = cell(a, 2, 2);
      ant.rect(0, 0, 15, 15, '#0a0e1c');
      ant.rect(7, 4, 8, 15, '#6d7d92'); ant.rect(7, 4, 7, 15, '#c0cbdc');
      ant.ellipse(3, 0, 12, 6, '#46516a', true);
      ant.ellipse(4, 1, 11, 4, '#8b9bb4', true);
      ant.px(7, 2, '#ff4d4d'); ant.px(8, 2, '#ff4d4d');
      ant.rect(4, 12, 11, 13, '#46516a');

      const dome = cell(a, 3, 2);
      dome.rect(0, 0, 15, 15, '#0a0e1c');
      dome.ellipse(1, 3, 14, 15, '#46516a', true);
      dome.ellipse(2, 4, 13, 12, '#1f4a6b', true);
      dome.ellipse(3, 5, 8, 8, '#56a8d6', true);
      dome.rect(0, 13, 15, 15, '#2c3446'); dome.rect(0, 13, 15, 13, '#66748f');

      // --- hazards: mine field, debris, energy gate, warp lane
      const mine = cell(a, 0, 3);
      mine.rect(0, 0, 15, 15, '#0a0e1c'); stars(mine, 43, 4, ['#6d7d92']);
      mine.ellipse(4, 4, 11, 11, '#3d4a5c', true);
      mine.ellipse(5, 5, 9, 8, '#6d7d92', true);
      for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
        mine.rect(7 + dx * 5, 7 + dy * 5, 8 + dx * 5, 8 + dy * 5, '#c0cbdc');
      }
      mine.px(7, 7, '#ff4d4d'); mine.px(8, 7, '#ff4d4d');

      const deb = cell(a, 1, 3);
      deb.rect(0, 0, 15, 15, '#0a0e1c'); stars(deb, 47, 4, ['#6d7d92']);
      for (let k = 0; k < 7; k++) {
        const x = 1 + Math.floor(deb.hash(k, 2, 5) * 12), y = 1 + Math.floor(deb.hash(k, 4, 5) * 12);
        const w = 1 + Math.floor(deb.hash(k, 6, 5) * 3);
        deb.rect(x, y, x + w, y + 1, '#5c6a86'); deb.rect(x, y, x + w, y, '#98a8c4');
      }
      const gate = cell(a, 2, 3);
      gate.rect(0, 0, 15, 15, '#0a0e1c');
      gate.rect(0, 0, 2, 15, '#46516a'); gate.rect(13, 0, 15, 15, '#46516a');
      gate.rect(0, 0, 0, 15, '#8b9bb4'); gate.rect(15, 0, 15, 15, '#2c3446');
      for (let y = 0; y < 16; y++) { const w = 3 + (y % 3); gate.rect(8 - w, y, 7 + w, y, y % 2 ? '#2aa6c8' : '#9ff2fb'); }

      const lane = cell(a, 3, 3);
      lane.rect(0, 0, 15, 15, '#0a0e1c');
      for (let k = 0; k < 10; k++) {
        const x = Math.floor(lane.hash(k, 8, 13) * 16);
        const len = 4 + Math.floor(lane.hash(k, 9, 13) * 9), y0 = Math.floor(lane.hash(k, 10, 13) * 16);
        for (let d = 0; d < len; d++) lane.px(x, (y0 + d) % 16, d < 2 ? '#ffffff' : d < 5 ? '#9ad8ff' : '#3f7fd4');
      }
    };
    return {
      width: 64, height: 64, name: 'Space Tileset', layers: [{ name: 'tiles' }],
      states: [D('tiles', 1, false, still(paint))]
    };
  }

  return { playerSuite, fighterSuite, bomberSuite, bossSuite, asteroidSuite, powerupSuite, fxSuite, tilesetSuite };
})();
