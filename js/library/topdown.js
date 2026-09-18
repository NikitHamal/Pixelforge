/* PixelForge Studio — top-down (true overhead) kit.
   Characters, terrain, props, vehicles and pickups seen from straight above.

   This pack exists because the library had no overhead art at all. Every other
   character pack is 3/4 view — you see a face, a torso and two legs — and a
   twin-stick shooter, a stealth game or a classic overhead action-RPG cannot
   use a single frame of it. Overhead is not a camera angle you can fake by
   squashing a side view: the shapes are different (you see the tops of
   shoulders, the crown of a head, and the feet swing past the hips rather than
   under them), and above all the sprite has to ROTATE.

   GEOMETRY — the contract every character here honours:
     * The canvas is 32x32 and the figure is centred on (15.5, 16.0).
     * Everything is authored in BODY space: `s` runs across the character
       (+ = its right), `t` runs forward. `pt(th, s, t)` maps body space to the
       screen for a facing angle `th`, where th = 0 faces screen-up (north) and
       th increases clockwise, so 'e' is TAU/4.
     * One painter therefore serves all eight compass directions. Adding a
       sixteen-direction rig is a change to a state list, not to any art.

   LIGHTING is fixed in SCREEN space, not body space. A character that spins
   carries its shading around with it if you light in body space, which reads
   as the sun orbiting the player. Every shade test below is written against
   the screen-space delta (dx, dy) for exactly that reason: the sun stays up
   and to the left no matter which way the sprite points. */
window.PF = window.PF || {};
PF.TopDown = (() => {
  const R = PF.Rig;
  const D = R.D, draw = R.draw, cyc = R.cyc, seq = R.seq, still = R.still, TAU = R.TAU;
  const disc = R.disc, lit = R.lit, dim = R.dim;

  /* ------------------------------------------------------------ geometry */

  const CX = 15.5, CY = 16.0;

  /* Body space -> screen. The matrix [[cos, sin], [sin, -cos]] is its own
     inverse, which is why `oval` below can invert the mapping with the same
     two lines instead of carrying a second matrix around. */
  const pt = (th, s, t, cx, cy) => [
    (cx === undefined ? CX : cx) + s * Math.cos(th) + t * Math.sin(th),
    (cy === undefined ? CY : cy) + s * Math.sin(th) - t * Math.cos(th)];

  /* An ellipse with its own axis. Top-down bodies are ovals pointing where the
     character is going; rotating an axis-aligned rect instead gives a
     staircase edge that no amount of shading recovers at 32px.
     `shade(s, t, dx, dy)` gets body-space AND screen-space coordinates, and may
     return null to leave a pixel alone. */
  function oval(a, cx, cy, th, ra, rb, shade) {
    const ca = Math.cos(th), sa = Math.sin(th);
    const Rr = Math.ceil(Math.max(ra, rb)) + 1;
    for (let y = Math.round(cy) - Rr; y <= Math.round(cy) + Rr; y++)
      for (let x = Math.round(cx) - Rr; x <= Math.round(cx) + Rr; x++) {
        const dx = x - cx, dy = y - cy;
        const s = dx * ca + dy * sa, t = dx * sa - dy * ca;
        if ((s * s) / (ra * ra) + (t * t) / (rb * rb) > 1.05) continue;
        const c = shade(s, t, dx, dy);
        if (c) a.px(x, y, c);
      }
  }
  /* The standard body shader: base tone, a highlight on the screen's upper-left
     shoulder and a shadow on the lower-right. Three tones is the minimum that
     makes an overhead oval read as a rounded mass rather than as a sticker. */
  const round3 = (base, hi, sh) => (s, t, dx, dy) => {
    const k = dx + dy;
    return k < -2.6 ? hi : k > 2.8 ? sh : base;
  };

  /* --------------------------------------------------------- palettes */

  const SURVIVOR = { hair: '#733e39', hairHi: '#a4695c', skin: '#e8b796', skinSh: '#c28569',
    shirt: '#3e8948', shirtHi: '#63c74d', shirtSh: '#265c42',
    boot: '#3e2731', bootHi: '#5a4433', gear: '#c0cbdc', pack: '#8a5a2b' };
  const SOLDIER = { hair: '#4b5320', hairHi: '#6b7530', skin: '#e4a672', skinSh: '#b86f50',
    shirt: '#4b5d3a', shirtHi: '#6d8450', shirtSh: '#2f3a24',
    boot: '#262b44', bootHi: '#3a4466', gear: '#181425', pack: '#6d5a2b', helmet: '#404d30' };
  const ZOMBIE = { hair: '#3e2731', hairHi: '#5e3b4d', skin: '#8fa86a', skinSh: '#5f7245',
    shirt: '#68386c', shirtHi: '#8a4f8e', shirtSh: '#45264a',
    boot: '#262b44', bootHi: '#3a4466', gear: '#a22633', pack: null };
  const AGENT = { hair: '#181425', hairHi: '#3a4466', skin: '#f2c094', skinSh: '#c28569',
    shirt: '#2f3350', shirtHi: '#4a5178', shirtSh: '#1c1f33',
    boot: '#181425', bootHi: '#3a4466', gear: '#c0cbdc', pack: null, tie: '#a22633' };

  /* ---------------------------------------------------------- the figure */

  /* A limb drawn straight onto the torso disappears into it: they are the same
     cloth, and the library's outline pass only draws against transparency, so
     there is no line where an arm meets a shoulder.

     The first fix here was a dark contour ring around every mass. It worked and
     it looked terrible — seven ringed shapes on a 32px cell, and the rings
     merge into a black spider. Separation at this size has to come from VALUE
     instead: the arms are painted in the shirt's shadow tone against the
     torso's base tone, the hands in bare skin, the boots dark. Only the head
     keeps a ring, because it lands in the middle of the shoulder mass where
     there is no silhouette edge to help it and it is the shape the player's
     eye actually tracks. */
  const SEAM = '#181425';
  function ringed(a, x, y, th, ra, rb, base, hi, sh) {
    oval(a, x, y, th, ra + 0.8, rb + 0.8, () => SEAM);
    oval(a, x, y, th, ra, rb, round3(base, hi, sh));
  }

  /* Draw order is the depth order of a body seen from above: boots lowest,
     then the shoulder mass, the pack riding on the back, the swinging arms
     outboard of it, and the head last and highest.

     Proportions matter more here than in any other view. The head is the
     biggest single shape in an overhead sprite and the easiest thing to
     overdo — a head as wide as the shoulders turns the character into a
     mushroom. These numbers keep the shoulders the widest mass, the head
     comfortably inside them, and the boots parked behind the torso's rear pole
     so that the swing is actually visible. */
  function topPerson(a, th, pal, o) {
    o = o || {};
    const legSw = o.leg || 0, armSw = o.arm || 0, sway = o.sway || 0;
    const breath = o.breath || 0, twist = o.twist || 0;
    const bx = CX + Math.cos(th) * sway, by = CY + Math.sin(th) * sway;
    const armC = pal.shirtSh, armHi = pal.shirt, armSh = dim(pal.shirtSh);

    for (const [side, ph] of [[-1, legSw], [1, -legSw]]) {
      const [x, y] = pt(th, side * 2.9, -5.9 + ph, bx, by);
      oval(a, x, y, th, 1.9, 2.7, round3(pal.boot, pal.bootHi, dim(pal.boot)));
    }
    // shoulders: the widest mass in the sprite, and wider than they are deep
    oval(a, bx, by, th + twist, 7.4, 5.3 + breath, round3(pal.shirt, pal.shirtHi, pal.shirtSh));
    // spine: one darker run down the middle turns a flat oval into a back
    for (let k = -3.4; k <= 2.6; k += 0.8) {
      const [x, y] = pt(th + twist, 0, k, bx, by);
      a.px(x, y, pal.shirtSh);
    }
    if (pal.pack) {
      const [x, y] = pt(th + twist, 0, -3.0, bx, by);
      oval(a, x, y, th + twist, 3.4, 2.2, round3(pal.pack, lit(pal.pack), dim(pal.pack)));
      const [sx, sy] = pt(th + twist, 0, 0.2, bx, by);
      a.px(sx, sy, pal.gear);                              // strap over the shoulder
    }
    // arms outboard of the shoulder line, in the cloth's shadow tone so they
    // separate from the torso without a black line between them
    for (const [side, ph] of [[-1, -armSw], [1, armSw]]) {
      const [x, y] = pt(th + twist, side * 7.0, 0.6 + ph, bx, by);
      oval(a, x, y, th, 2.2, 3.0, round3(armC, armHi, armSh));
      const [hx, hy] = pt(th + twist, side * 7.0, 3.9 + ph, bx, by);
      disc(a, hx, hy, 1.7, pal.skin, lit(pal.skin));
    }
    if (pal.helmet === undefined) {
      /* Head = a skin oval with the hair laid over its BACK two-thirds, so the
         crescent left uncovered at the front is the face. Two eye pixels sit in
         that crescent: at 32px overhead they are the single strongest facing
         cue the sprite has, worth more than the whole body pose. */
      const [fx, fy] = pt(th, 0, 3.0, bx, by);
      ringed(a, fx, fy, th, 2.9, 3.3, pal.skin, lit(pal.skin), pal.skinSh);
      // the hair oval is deliberately FLAT: wide across the skull and shallow
      // fore-aft, which is what leaves a face-sized crescent at the front
      const [hx, hy] = pt(th, 0, 2.0, bx, by);
      oval(a, hx, hy, th, 3.0, 2.3, round3(pal.hair, pal.hairHi, dim(pal.hair)));
      for (const sd of [-1.4, 1.4]) { const [ex, ey] = pt(th, sd, 4.8, bx, by); a.px(ex, ey, SEAM); }
      const [nx, ny] = pt(th, 0, 5.8, bx, by); a.px(nx, ny, pal.skinSh);
      if (pal.tie) { const [tx, ty] = pt(th + twist, 0, 4.8, bx, by); a.px(tx, ty, pal.tie); }
    } else {
      // A helmet has no face, so a bright forward brim has to carry the facing
      const [hx, hy] = pt(th, 0, 2.6, bx, by);
      ringed(a, hx, hy, th, 3.2, 3.6, pal.helmet, lit(pal.helmet), dim(pal.helmet));
      for (let k = -1.0; k <= 1.0; k += 0.2) {
        const [x, y] = pt(th, k * 2.7, 5.4 - Math.abs(k) * 1.4, bx, by);
        a.px(x, y, lit(lit(pal.helmet)));
      }
      const [cx2, cy2] = pt(th, -1.3, 2.8, bx, by);
      disc(a, cx2, cy2, 1.3, lit(pal.helmet));
    }
    if (o.after) o.after(a, th, bx, by);
  }

  /* ----------------------------------------------------------- suites */

  const DIRS = [['n', 0], ['ne', TAU / 8], ['e', TAU / 4], ['se', 3 * TAU / 8],
                ['s', TAU / 2], ['sw', 5 * TAU / 8], ['w', 3 * TAU / 4], ['nw', 7 * TAU / 8]];

  function personSuite(pal, label, opts) {
    opts = opts || {};
    const states = [];
    /* Idle is a breath plus a slow weight shift, four frames. The shift is a
       sideways sway rather than a scale pulse: an overhead figure has no
       silhouette to inflate, so a pure breath is invisible from above. */
    for (const [name, th] of DIRS) {
      states.push(D('idle_' + name, 4, true, cyc(4, 4, (a, i) =>
        topPerson(a, th, pal, {
          breath: [0, 0.5, 0.5, 0][i], sway: [0, 0.4, 0, -0.4][i],
          twist: [0, 0.05, 0, -0.05][i], arm: [0, 0.3, 0, -0.3][i], after: opts.held }))));
    }
    /* Eight beats of walk. Legs and arms swing on the same sine (opposite
       sides already counter-swing through the `side` sign); the body's
       side-to-side weight shift rides a cosine, which is both what a walk
       actually does and what keeps beats 0 and 4 from being the same pose. */
    for (const [name, th] of DIRS) {
      const fps = opts.pace || 10, lur = opts.lurch || 1;
      states.push(D('walk_' + name, fps, true, cyc(8, fps, (a, i) => {
        const p = (i / 8) * TAU;
        topPerson(a, th, pal, {
          leg: Math.sin(p) * 2.6 * lur, arm: Math.sin(p) * 1.7 * lur,
          sway: Math.cos(p) * 1.0 * lur, twist: Math.sin(p) * 0.10 * lur,
          breath: 0, after: opts.held });
      })));
    }
    /* Attack: anticipation, strike, follow-through. The near arm reaches past
       the head and the shoulders counter-rotate — the same three beats a side
       view uses, but read through the twist because overhead has no reach. */
    for (const [name, th] of [['n', 0], ['e', TAU / 4], ['s', TAU / 2], ['w', 3 * TAU / 4]]) {
      states.push(D('attack_' + name, 12, false, seq(4, 12, (a, i) => {
        const tw = [-0.35, -0.5, 0.45, 0.15][i], rc = [-0.8, -1.6, 2.4, 1.0][i];
        topPerson(a, th, pal, { twist: tw, arm: rc, sway: [0, -0.6, 1.0, 0.3][i],
          after: (b, ang, bx, by) => {
            if (opts.strike) opts.strike(b, ang, bx, by, i);
            else if (i >= 2) {
              // a swept arc in front of the shoulder line reads as a blow
              for (let k = -1.1; k <= 1.1; k += 0.22) {
                const [x, y] = pt(ang, k * 4.5, 7.2 - Math.abs(k) * 1.6, bx, by);
                b.px(Math.round(x), Math.round(y), i === 2 ? '#ffffff' : '#c0cbdc');
              }
            }
            if (opts.held) opts.held(b, ang, bx, by);
          } });
      })));
    }
    states.push(D('hurt', 12, false, seq(3, 12, (a, i) =>
      topPerson(a, TAU / 2, pal, { twist: [0.5, -0.4, 0.15][i], sway: [-1.4, 1.0, 0][i],
        arm: [-2.0, 1.4, 0][i] }))));
    /* Death sprawls: the body flattens along one axis, the limbs splay, and
       the last beat dithers out. A top-down corpse that just falls over is the
       same oval at a different angle, which reads as the character lying down
       and standing straight back up. */
    states.push(D('death', 10, false, seq(4, 10, (a, i) => {
      if (i === 0) { topPerson(a, TAU / 2, pal, { twist: 0.6, sway: -1.6, arm: -2.2 }); return; }
      const spread = [0, 0.4, 0.75, 1][i];
      const th = TAU / 2 + 0.5 * spread;
      for (const [side, ph] of [[-1, 3.2 * spread], [1, -3.2 * spread]]) {
        const [x, y] = pt(th, side * (2.5 + 2.4 * spread), -4.0 + ph);
        oval(a, x, y, th, 1.7, 2.5, round3(pal.boot, pal.bootHi, dim(pal.boot)));
      }
      for (const [side, ph] of [[-1, 2.4 * spread], [1, -2.4 * spread]]) {
        const [x, y] = pt(th, side * (5.3 + 2.2 * spread), 0.4 + ph);
        oval(a, x, y, th, 2.1, 2.7, round3(pal.shirtSh, pal.shirt, dim(pal.shirtSh)));
      }
      oval(a, CX, CY, th, 6.3 + spread, 5.2 - spread, round3(pal.shirtSh, pal.shirt, dim(pal.shirtSh)));
      const [hx, hy] = pt(th, -1.6 * spread, 1.4);
      oval(a, hx, hy, th, 3.0, 3.4, round3(pal.skinSh, pal.skin, dim(pal.skinSh)));
      disc(a, hx, hy - 0.8 * spread, 3.0, dim(pal.helmet || pal.hair), pal.helmet || pal.hair);
    })));
    /* The pool is a separate state so a game can leave it on the ground after
       the corpse despawns, and so a squeamish project can simply not ship it. */
    states.push(D('blood_pool', 6, false, seq(4, 6, (a, i) => {
      const g = [0.3, 0.6, 0.85, 1][i];
      oval(a, 15.5, 18, 0.4, 11 * g, 7.5 * g, (s2, t2, dx, dy) =>
        (a.hash(Math.round(15.5 + dx), Math.round(18 + dy), 7) < 0.12 ? '#6a0f1e' : '#8f1425'));
      oval(a, 14.0, 17.0, 0.4, 6 * g, 4.0 * g, () => '#a22633');
      oval(a, 13.0, 16.0, 0.4, 2.6 * g, 1.8 * g, () => '#c93a4a');
      for (const [dx, dy, r] of [[-11, 2, 1.6], [10, -3, 1.3], [7, 6, 1.1]])
        disc(a, 15.5 + dx * g, 18 + dy * g, r * g, '#8f1425');
    })));
    return { width: 32, height: 32, name: label, layers: [{ name: 'Body' }], states };
  }

  /* A rifle held across the chest, drawn after the body so it sits on top of
     the hands. Passed in as the `held` hook so one figure painter can serve an
     unarmed survivor and an armed soldier without branching inside it. */
  const rifle = (b, th, bx, by) => {
    const [x0, y0] = pt(th, 4.6, -2.0, bx, by), [x1, y1] = pt(th, 6.2, 9.0, bx, by);
    b.line(x0, y0, x1, y1, '#181425', 3);
    b.line(x0, y0, x1, y1, '#3f4a63', 1);
    const [gx, gy] = pt(th, 4.9, 0.0, bx, by);
    b.px(gx, gy, '#5a4433');                              // stock
    const [mx, my] = pt(th, 6.2, 9.4, bx, by);
    b.px(mx, my, '#8b9bb4');                              // muzzle
  };

  /* --------------------------------------------------------- terrain */

  /* A 4x4 sheet of 16px overhead tiles. Overhead terrain lives or dies on
     grain: at this size a flat fill is indistinguishable from any other flat
     fill, so every tile carries deterministic speckle keyed on its own seed. */
  function tileSuite() {
    const T = 16;
    const cell = (a, col, row, fn) => fn(PF.Pixel.offsetApi(a, col * T, row * T));
    const flat = (base, sp, dens, seed) => (b) => {
      b.rect(0, 0, T - 1, T - 1, base);
      R.speck(b, 0, 0, T - 1, T - 1, seed, sp, dens);
    };
    const tiles = [
      ['grass', flat('#3e8948', ['#63c74d', '#265c42'], 0.22, 11)],
      ['tall grass', (b) => { flat('#2f6b38', ['#3e8948', '#1e4a28'], 0.18, 19)(b);
        for (let x = 1; x < T; x += 3) for (let y = 1; y < T; y += 4) b.line(x, y + 2, x + 1, y - 1, '#63c74d', 1); }],
      ['dirt', flat('#8a5a2b', ['#a86f3a', '#5f3d1c'], 0.26, 23)],
      ['gravel path', (b) => { flat('#8b8b93', ['#a8a8b2', '#5f5f6b'], 0.34, 31)(b);
        for (const [x, y] of [[3, 4], [9, 3], [12, 9], [5, 11], [1, 8]]) { b.rect(x, y, x + 1, y + 1, '#c0cbdc'); b.px(x + 1, y + 1, '#5f5f6b'); } }],
      ['asphalt', (b) => { flat('#3a3a44', ['#4a4a56', '#2a2a33'], 0.3, 37)(b);
        b.rect(0, 7, T - 1, 8, '#33333d'); }],
      ['road line', (b) => { flat('#3a3a44', ['#4a4a56', '#2a2a33'], 0.3, 41)(b);
        b.rect(0, 7, 5, 8, '#fee761'); b.rect(10, 7, T - 1, 8, '#fee761'); }],
      ['sand', flat('#e4c07a', ['#f6dfa8', '#c49a55'], 0.24, 43)],
      ['water', (b) => { b.rect(0, 0, T - 1, T - 1, '#124e89');
        for (let y = 0; y < T; y++) for (let x = 0; x < T; x++)
          if (b.hash(x, y, 47) < 0.14) b.px(x, y, '#0099db');
        for (const y of [3, 9, 13]) b.line(2, y, 8, y, '#2ce8f5', 1); }],
      ['shallow', (b) => { b.rect(0, 0, T - 1, T - 1, '#2b7fb8');
        R.speck(b, 0, 0, T - 1, T - 1, 53, ['#5ec0e8', '#8a5a2b'], 0.2); }],
      ['concrete', (b) => { flat('#9a9aa6', ['#b4b4c0', '#76767f'], 0.16, 59)(b);
        b.rect(0, 0, T - 1, 0, '#76767f'); b.rect(0, 0, 0, T - 1, '#76767f'); }],
      ['floor tile', (b) => { b.rect(0, 0, T - 1, T - 1, '#c0cbdc');
        b.rect(0, 0, 7, 7, '#d8e0ec'); b.rect(8, 8, T - 1, T - 1, '#d8e0ec');
        b.rect(0, 7, T - 1, 8, '#8b9bb4'); b.rect(7, 0, 8, T - 1, '#8b9bb4'); }],
      ['planks', (b) => { b.rect(0, 0, T - 1, T - 1, '#a86f3a');
        for (const y of [0, 5, 10]) { b.rect(0, y, T - 1, y, '#c48a4f'); b.rect(0, y + 4, T - 1, y + 4, '#6d431e'); }
        b.rect(6, 0, 6, 4, '#6d431e'); b.rect(11, 5, 11, 9, '#6d431e'); b.rect(3, 10, 3, T - 1, '#6d431e'); }],
      ['carpet', (b) => { flat('#6d2b3a', ['#8a3a4c', '#4a1c28'], 0.2, 61)(b);
        b.rectO(1, 1, T - 2, T - 2, '#c9a227'); }],
      ['grate', (b) => { b.rect(0, 0, T - 1, T - 1, '#4a4a56');
        for (let x = 1; x < T; x += 3) b.rect(x, 0, x, T - 1, '#22222a');
        for (let y = 1; y < T; y += 5) b.rect(0, y, T - 1, y, '#6b6b78'); }],
      ['snow', flat('#e8f0f8', ['#ffffff', '#b8c6da'], 0.2, 67)],
      ['rubble', (b) => { flat('#6b6b78', ['#8b8b93', '#3a3a44'], 0.3, 71)(b);
        for (const [x, y, w] of [[2, 3, 3], [8, 2, 2], [11, 8, 3], [4, 10, 2], [7, 12, 3]]) {
          b.rect(x, y, x + w, y + 1, '#a8a8b2'); b.rect(x, y + 1, x + w, y + 1, '#3a3a44'); } }]
    ];
    const frames = still((a) => tiles.forEach(([, fn], i) => cell(a, i % 4, Math.floor(i / 4), fn)));
    return { width: 64, height: 64, name: 'top-down tiles', layers: [{ name: 'Tiles' }], states: [D('sheet', 1, false, frames)] };
  }

  /* ----------------------------------------------------------- props */

  function propSuite() {
    const S = [];
    const P = (name, fps, loop, frames) => S.push(D(name, fps, loop, frames));
    /* Overhead props are read almost entirely from their cast shadow and their
       top face. Each one gets a one-pixel dark lip on the lower-right so it
       sits ON the floor instead of being printed onto it. */
    const lip = (a, x0, y0, x1, y1, c) => { a.rect(x1, y0 + 1, x1, y1, c); a.rect(x0 + 1, y1, x1, y1, c); };

    P('crate', 1, false, still(a => {
      a.rect(8, 8, 23, 23, '#a87a45'); a.rect(8, 8, 23, 9, '#c89a63');
      lip(a, 8, 8, 23, 23, '#5c3a18');
      a.rectO(10, 10, 21, 21, '#7a4f26'); a.line(10, 10, 21, 21, '#7a4f26', 1); a.line(21, 10, 10, 21, '#7a4f26', 1);
    }));
    P('barrel', 1, false, still(a => {
      disc(a, 15.5, 16, 8.0, '#3f3f4c');                  // steel hoop, drawn as
      disc(a, 15.5, 16, 6.8, '#7b4726', '#9a5f33');       // a full annulus
      disc(a, 15.5, 16, 5.2, '#9a5f33', '#b3763f');
      for (let k = 0; k < 24; k++) {                      // stave seams
        const a0 = k / 24 * TAU;
        a.px(15.5 + Math.cos(a0) * 6.0, 16 + Math.sin(a0) * 6.0, '#5c3a18');
      }
      disc(a, 15.5, 16, 2.2, '#5c3a18');
      disc(a, 15.5, 16, 1.2, '#3f3f4c');                  // bung
    }));
    P('table', 1, false, still(a => {
      // legs are drawn OUTSIDE the top so they are visible from above at all
      for (const [x, y] of [[3, 7], [25, 7], [3, 22], [25, 22]]) {
        a.rect(x, y, x + 3, y + 3, '#5c3a18'); a.rect(x, y, x + 3, y, '#7a4f26');
      }
      a.rect(4, 8, 27, 23, '#a86f3a'); a.rect(4, 8, 27, 9, '#c48a4f');
      for (const y of [12, 16, 20]) a.rect(5, y, 26, y, '#8a5a2b');
      lip(a, 4, 8, 27, 23, '#5c3a18');
    }));
    P('bed', 1, false, still(a => {
      a.rect(9, 4, 22, 28, '#8a5a2b'); lip(a, 9, 4, 22, 28, '#5c3a18');
      a.rect(10, 5, 21, 11, '#e8f0f8'); a.rect(10, 5, 21, 6, '#ffffff');      // pillow
      a.rect(10, 12, 21, 27, '#a2334c'); a.rect(10, 12, 21, 13, '#c94f66');   // quilt
      for (let y = 15; y < 27; y += 4) a.rect(10, y, 21, y, '#7a2438');
    }));
    P('rug', 1, false, still(a => {
      a.rect(4, 8, 27, 23, '#6d2b3a'); a.rect(4, 8, 27, 9, '#8a3a4c');
      a.rectO(6, 10, 25, 21, '#c9a227'); a.rectO(9, 12, 22, 19, '#c9a227');
      for (const x of [3, 28]) for (let y = 9; y < 23; y += 2) a.px(x, y, '#c9a227');
    }));
    P('bush', 4, true, cyc(4, 4, (a, i) => {
      const w = [0, 1, 0, -1][i];
      disc(a, 15.5, 16.5, 8.0, '#265c42', '#3e8948');
      disc(a, 12.5 + w * 0.5, 13.5, 4.5, '#3e8948', '#63c74d');
      disc(a, 19.0, 18.0 - w * 0.5, 4.0, '#2f6b38', '#3e8948');
      R.speck(a, 9, 10, 23, 23, 13 + i, ['#63c74d', '#1e4a28'], 0.18);
      for (const [x, y] of [[13, 12], [20, 19], [11, 20]]) a.px(x + w, y, '#e43b44');
    }));
    P('tree', 4, true, cyc(4, 4, (a, i) => {
      const w = [0, 1, 0, -1][i] * 0.7;
      disc(a, 16.5, 17.5, 12.0, '#14331c');                       // cast shadow
      // the canopy is five overlapping lobes, not one disc: a circle with a
      // highlight reads as a ball, and a ball is not a tree
      for (const [dx, dy, r] of [[0, 0, 10.5], [-5, -4, 6.0], [5, -3, 5.4], [-4, 5, 5.2], [4, 4, 5.6]])
        disc(a, 15.0 + dx + w, 16.0 + dy, r, '#265c42', '#3e8948');
      for (const [dx, dy, r] of [[-5, -4, 4.0], [4, -3, 3.2], [-2, 3, 3.0]])
        disc(a, 15.0 + dx + w, 16.0 + dy, r, '#3e8948', '#63c74d');
      R.speck(a, 4, 5, 27, 28, 17 + i * 3, ['#63c74d', '#14331c'], 0.16);
    }));
    P('rock', 1, false, still(a => {
      disc(a, 15.5, 16.5, 9.0, '#6b6b78', '#9a9aa6');
      disc(a, 13.0, 13.5, 4.5, '#8b8b93', '#b4b4c0');
      a.line(10, 20, 20, 12, '#4a4a56', 1); a.line(16, 22, 21, 17, '#4a4a56', 1);
      R.speck(a, 8, 9, 23, 24, 29, ['#b4b4c0', '#3a3a44'], 0.12);
    }));
    P('campfire', 6, true, cyc(6, 6, (a, i) => {
      for (let k = 0; k < 6; k++) {
        const a0 = k / 6 * TAU + 0.3;
        const x = 15.5 + Math.cos(a0) * 9, y = 16.5 + Math.sin(a0) * 9;
        disc(a, x, y, 2.2, '#6b6b78', '#9a9aa6');
      }
      for (const [x0, y0, x1, y1] of [[10, 18, 21, 14], [11, 13, 20, 20]]) a.line(x0, y0, x1, y1, '#6d431e', 2);
      const f = [4.2, 5.2, 4.6, 5.6, 4.4, 5.0][i];
      disc(a, 15.5, 16.5, f, '#f77622', '#feae34');
      disc(a, 15.5, 16.5, f * 0.55, '#fee761', '#ffffff');
      for (let k = 0; k < 3; k++) {
        const a0 = (k / 3 + i / 6) * TAU;
        a.px(Math.round(15.5 + Math.cos(a0) * (f + 2.5)), Math.round(16.5 + Math.sin(a0) * (f + 2.5)), '#feae34');
      }
    }));
    P('door', 1, false, still(a => {
      a.rect(3, 12, 28, 19, '#6d431e'); a.rect(3, 12, 28, 13, '#a86f3a');
      lip(a, 3, 12, 28, 19, '#3a2410');
      a.rect(5, 14, 14, 17, '#8a5a2b'); a.rect(17, 14, 26, 17, '#8a5a2b');
      a.rect(15, 15, 16, 16, '#fee761');
    }));
    return { width: 32, height: 32, name: 'top-down props', layers: [{ name: 'Prop' }], states: S };
  }

  /* -------------------------------------------------------- vehicles */

  function vehicleSuite() {
    const S = [];
    /* A vehicle seen from above is a hull silhouette plus a windscreen: the
       glass is the only part that tells you which end is the front, so every
       cabin here is drawn as a lighter trapezoid biased toward the nose. */
    S.push(D('car', 1, false, still(a => {
      a.rect(9, 3, 22, 28, '#a2334c'); a.rect(9, 3, 22, 4, '#c94f66');
      a.rect(21, 4, 22, 27, '#7a2438');
      a.rect(10, 2, 21, 3, '#c94f66'); a.rect(10, 28, 21, 29, '#7a2438');
      a.rect(11, 7, 20, 11, '#2ce8f5'); a.rect(11, 7, 20, 8, '#8ef6ff');   // windscreen
      a.rect(11, 18, 20, 21, '#1f9ab8');                                   // rear glass
      a.rect(10, 12, 21, 17, '#c94f66'); a.rect(12, 13, 19, 14, '#e06a80');
      for (const y of [6, 24]) { a.rect(7, y, 8, y + 3, '#181425'); a.rect(23, y, 24, y + 3, '#181425'); }
      a.rect(11, 2, 12, 2, '#fee761'); a.rect(19, 2, 20, 2, '#fee761');     // headlights
      a.rect(11, 29, 12, 29, '#e43b44'); a.rect(19, 29, 20, 29, '#e43b44');
    })));
    S.push(D('truck', 1, false, still(a => {
      a.rect(8, 2, 23, 12, '#3e8948'); a.rect(8, 2, 23, 3, '#63c74d');
      a.rect(22, 3, 23, 11, '#265c42');
      a.rect(10, 5, 21, 9, '#2ce8f5'); a.rect(10, 5, 21, 6, '#8ef6ff');
      a.rect(7, 13, 24, 30, '#8b8b93'); a.rect(7, 13, 24, 14, '#b4b4c0');
      a.rect(23, 14, 24, 29, '#5f5f6b');
      for (let y = 16; y < 30; y += 3) a.rect(8, y, 23, y, '#6b6b78');
      for (const y of [4, 15, 25]) { a.rect(5, y, 6, y + 4, '#181425'); a.rect(25, y, 26, y + 4, '#181425'); }
      a.rect(9, 1, 10, 1, '#fee761'); a.rect(21, 1, 22, 1, '#fee761');
    })));
    /* The tank's turret sweeps: the hull is redrawn identically each frame and
       only the turret rotates, which is exactly how a game would composite it
       and makes the sheet usable as a two-part rig as well as a flipbook. */
    S.push(D('tank_traverse', 8, true, cyc(8, 8, (a, i) => {
      a.rect(6, 4, 25, 27, '#4b5d3a'); a.rect(6, 4, 25, 5, '#6d8450');
      a.rect(24, 5, 25, 26, '#2f3a24');
      for (const x of [4, 26]) { a.rect(x - 1, 2, x + 1, 29, '#262b44');
        for (let y = 3; y < 29; y += 3) a.rect(x - 1, y, x + 1, y, '#3a4466'); }
      for (let y = 6; y < 26; y += 5) a.rect(7, y, 24, y, '#3d4c2e');   // deck plates
      const th = (i / 8) * TAU;
      const [ex, ey] = pt(th, 0, 15, 15.5, 16);
      a.line(15.5, 16, ex, ey, '#181425', 4);                            // barrel
      a.line(15.5, 16, ex, ey, '#5f6b84', 2);
      a.line(15.5, 16, ex, ey, '#8b9bb4', 1);
      disc(a, 15.5, 16, 7.0, '#181425');                                 // turret ring
      disc(a, 15.5, 16, 6.0, '#8a9a5c', '#b0c07a');                      // turret, a
      disc(a, 15.5, 16, 2.6, '#6d8450', '#8fa86a');                      // full value
      const [mx, my] = pt(th, 3.0, 4.0, 15.5, 16);                       // step lighter
      a.px(mx, my, '#3d4c2e');                                           // than the hull
      a.line(15.5, 16, ex, ey, '#181425', 4);
      a.line(15.5, 16, ex, ey, '#5f6b84', 2);
      a.line(15.5, 16, ex, ey, '#8b9bb4', 1);
    })));
    /* Rotor blur is drawn as four spokes at a sub-frame angle, not as a solid
       disc: a filled circle over the fuselage hides the aircraft, and a
       stroboscopic two-blade pose reads as a stalled rotor. */
    S.push(D('helicopter', 12, true, cyc(6, 12, (a, i) => {
      a.rect(13, 20, 18, 30, '#3a4466');                                    // tail boom
      a.rect(13, 20, 14, 30, '#5f6b84');
      a.rect(10, 27, 21, 29, '#262b44');                                    // tail plane
      oval(a, 15.5, 13, 0, 6.0, 8.5, round3('#4a5178', '#6d7aa8', '#2f3350'));
      oval(a, 15.5, 9, 0, 4.2, 4.6, round3('#2ce8f5', '#8ef6ff', '#1f9ab8'));
      a.rect(9, 12, 22, 13, '#2f3350');
      for (const x of [8, 23]) a.rect(x, 10, x, 22, '#8b9bb4');             // skids
      // swept ring: every third pixel of the circle, so it reads as motion blur
      // rather than as a solid hoop bolted to the aircraft
      for (let k = 0; k < 96; k++) {
        const th = (k / 96) * TAU;
        if ((k + i) % 3) continue;
        a.px(15.5 + Math.cos(th) * 14.5, 13 + Math.sin(th) * 14.5, '#5f6b84');
      }
      const base = (i / 6) * (TAU / 2);
      for (const th of [base, base + TAU / 2]) {
        a.line(15.5, 13, 15.5 + Math.cos(th) * 14.5, 13 + Math.sin(th) * 14.5, '#8b9bb4', 1);
        a.line(15.5, 13, 15.5 + Math.cos(th) * 7, 13 + Math.sin(th) * 7, '#c0cbdc', 1);
      }
      disc(a, 15.5, 13, 2.0, '#181425');
      disc(a, 15.5, 13, 1.2, '#c0cbdc', '#ffffff');
    })));
    S.push(D('boat', 4, true, cyc(4, 4, (a, i) => {
      const r = [0, 1, 0, -1][i];
      /* Authored as per-row half-widths so the bow comes to a point and the
         stern stays square — the two things that tell you a hull from an egg. */
      const HULL = [0, 1, 2, 3, 4, 5, 6, 6, 7, 7, 7, 7, 7, 7, 7, 7, 6, 6, 6, 6, 6, 5, 5, 5, 5, 4];
      const y0 = 3 + r;
      for (let k = 0; k < HULL.length; k++) {
        const w = HULL[k], y = y0 + k;
        a.rect(15.5 - w, y, 15.5 + w, y, '#6d431e');
        a.rect(15.5 - w, y, 15.5 - w + 1, y, '#c48a4f');          // lit gunwale
        a.px(15.5 + w, y, '#4a2a10');
        if (w > 3) a.rect(15.5 - w + 2, y, 15.5 + w - 2, y, k < 6 ? '#8a5a2b' : '#a0662f');
      }
      for (const y of [12, 18, 24]) a.rect(10, y + r, 21, y + r, '#5c3a18');   // thwarts
      a.rect(13, 21 + r, 18, 26 + r, '#5c3a18');                              // transom well
      a.rect(14, 27 + r, 17, 28 + r, '#3f3f4c');                              // outboard
      for (let k = 0; k < 10; k++) a.px(6 + k * 2, 30, '#5ec0e8');            // wake
    })));
    return { width: 32, height: 32, name: 'top-down vehicles', layers: [{ name: 'Vehicle' }], states: S };
  }

  /* -------------------------------------------------------- pickups */

  function pickupSuite() {
    const S = [];
    /* Pickups bob on a two-pixel sine and carry a rotating specular dot. On an
       overhead map a static icon disappears into the terrain grain; the moving
       highlight is what makes the eye find it. */
    const bob = i => [0, -1, -2, -1][i];
    const shine = (a, cx, cy, r, i) => {
      const th = (i / 4) * TAU;
      a.px(Math.round(cx + Math.cos(th) * r), Math.round(cy + Math.sin(th) * r), '#ffffff');
    };
    const P = (name, fn) => S.push(D(name, 6, true, cyc(4, 6, (a, i) => fn(a, bob(i), i))));
    P('medkit', (a, b, i) => {
      a.rect(9, 11 + b, 22, 22 + b, '#e8f0f8'); a.rect(9, 11 + b, 22, 12 + b, '#ffffff');
      a.rect(9, 21 + b, 22, 22 + b, '#b8c6da');
      a.rect(14, 13 + b, 17, 20 + b, '#e43b44'); a.rect(11, 15 + b, 20, 18 + b, '#e43b44');
      shine(a, 15.5, 16.5 + b, 7, i);
    });
    P('ammo', (a, b, i) => {
      a.rect(10, 12 + b, 21, 21 + b, '#4b5d3a'); a.rect(10, 12 + b, 21, 13 + b, '#6d8450');
      a.rect(10, 20 + b, 21, 21 + b, '#2f3a24');
      for (const x of [12, 15, 18]) { a.rect(x, 14 + b, x + 1, 19 + b, '#feae34'); a.px(x, 14 + b, '#fee761'); }
      shine(a, 15.5, 16.5 + b, 6, i);
    });
    P('key', (a, b, i) => {
      // ring, not disc-minus-disc: px() cannot erase, so the hole is drawn as
      // an annulus from the start
      for (let y = -5; y <= 5; y++) for (let x = -5; x <= 5; x++) {
        const d = Math.sqrt(x * x + y * y);
        if (d > 4.3 || d < 1.9) continue;
        a.px(12 + x, 14 + b + y, x + y < -2 ? '#fee761' : '#feae34');
      }
      a.rect(15, 16 + b, 22, 17 + b, '#feae34'); a.rect(15, 16 + b, 22, 16 + b, '#fee761');
      a.rect(19, 18 + b, 20, 19 + b, '#feae34'); a.rect(22, 18 + b, 22, 19 + b, '#feae34');
      shine(a, 15.5, 16.5 + b, 7, i);
    });
    P('coin', (a, b, i) => {
      const w = [7.0, 5.0, 2.0, 5.0][i];                                    // spins edge-on
      oval(a, 15.5, 16.5 + b, 0, w, 7.0, round3('#feae34', '#fee761', '#c9a227'));
      if (w > 3) oval(a, 15.5, 16.5 + b, 0, w - 2, 5.0, round3('#fee761', '#ffffff', '#feae34'));
    });
    P('fuel', (a, b, i) => {
      a.rect(9, 10 + b, 21, 23 + b, '#e43b44'); a.rect(9, 10 + b, 21, 11 + b, '#f6757a');
      a.rect(20, 11 + b, 21, 22 + b, '#a22633');
      a.rect(12, 13 + b, 18, 20 + b, '#a22633');
      a.rect(22, 12 + b, 24, 13 + b, '#8b8b93');                            // spout
      a.rect(13, 8 + b, 17, 9 + b, '#6b6b78');                              // handle
      shine(a, 15.5, 16.5 + b, 7, i);
    });
    P('chest', (a, b, i) => {
      a.rect(6, 9 + b, 25, 23 + b, '#8a5a2b'); a.rect(6, 9 + b, 25, 10 + b, '#c48a4f');
      a.rect(24, 10 + b, 25, 22 + b, '#5c3a18'); a.rect(6, 22 + b, 25, 23 + b, '#5c3a18');
      for (const x of [10, 21]) a.rect(x, 9 + b, x + 1, 23 + b, '#c9a227');
      a.rect(14, 14 + b, 17, 18 + b, '#feae34'); a.px(15, 16 + b, '#5c3a18');
      shine(a, 15.5, 16.5 + b, 9, i);
    });
    return { width: 32, height: 32, name: 'top-down pickups', layers: [{ name: 'Pickup' }], states: S };
  }

  return { pt, oval, round3, topPerson, personSuite, rifle,
    SURVIVOR, SOLDIER, ZOMBIE, AGENT,
    tileSuite, propSuite, vehicleSuite, pickupSuite };
})();
