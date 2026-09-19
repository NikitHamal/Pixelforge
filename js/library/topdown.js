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

  /* FIGURE SCALE. The rig below is authored in proportion units that happened
     to put a 15x11 person in the middle of a 32x32 cell — 45% of the width,
     where every other character pack in this library fills 85-95%. Side by
     side, the overhead cast looked like distant toys, and in a game that
     scales the cell to a tile it means the top-down set renders at two thirds
     the effective resolution of the iso and 3/4 sets.

     The proportions were right; only the size was wrong. One factor scales the
     whole body — torso, limbs, head, shadow and the weapon in its hands — so
     the authoring numbers keep encoding shape rather than pixels. 1.28 is the
     largest value at which a north-facing rifle muzzle still clears the top
     row with a pixel to spare for the outline pass. */
  const K = 1.28;
  const kpt = (th, s, t, cx, cy) => pt(th, s * K, t * K, cx, cy);
  const koval = (a, cx, cy, th, ra, rb, shade) => oval(a, cx, cy, th, ra * K, rb * K, shade);

  /* ------------------------------------------------------------ shadows */

  /* A translucent contact shadow, stamped AFTER the outline pass and only into
     pixels the art left empty.

     It cannot be part of the painter. The library's outline traces every
     non-zero pixel, so a shadow drawn with the body earns its own hard black
     ring around it; drawn before the body it gets painted over, drawn after
     it erases the boots. Doing it post-finish, transparent-pixels-only, is
     the only placement that works.

     Alpha 0x4c exports as a real soft shadow in PNG and sheet formats and
     drops out of GIF entirely (that encoder cuts transparency at alpha 128),
     which is the right answer in both. Without it every overhead sprite
     floats a few pixels above the ground and the whole scene reads as a
     collage. */
  const SHADOW = PF.Color.hexToU32('#0b0a1a4c');
  const shadowed = (painter, sh) => (buf, W, H) => {
    draw(painter)(buf, W, H);
    const rx = sh.rx, ry = sh.ry;
    const cx = sh.cx === undefined ? CX : sh.cx, cy = sh.cy === undefined ? CY + 2.0 : sh.cy;
    const y0 = Math.max(0, Math.floor(cy - ry)), y1 = Math.min(H - 1, Math.ceil(cy + ry));
    const x0 = Math.max(0, Math.floor(cx - rx)), x1 = Math.min(W - 1, Math.ceil(cx + rx));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const dx = (x - cx) / rx, dy = (y - cy) / ry;
      if (dx * dx + dy * dy > 1) continue;
      const i = y * W + x;
      if (!buf[i]) buf[i] = SHADOW;
    }
  };
  // rig's cyc/seq/still, with the shadow pass bolted on
  const scyc = (n, fps, make, sh) => Array.from({ length: n }, (_, i) =>
    R.Fr(R.ms(fps), shadowed((a, W, H) => make(a, i, i / n, W, H), sh)));
  const sseq = (n, fps, make, sh) => Array.from({ length: n }, (_, i) =>
    R.Fr(R.ms(fps), shadowed((a, W, H) => make(a, i, n > 1 ? i / (n - 1) : 0, W, H), sh)));
  const sstill = (paint, sh) => [R.Fr(200, shadowed(paint, sh))];

  /* --------------------------------------------------------- palettes */

  /* Three masses sit side by side on an overhead figure — head, pack and
     torso — and the pack is the one that gets mistaken for the head. The fix
     is colour separation, not geometry: the hair is the darkest warm tone in
     the palette, the pack a cool slate that belongs to no body part, and the
     shirt the only saturated thing. */
  const SURVIVOR = { hair: '#45262a', hairHi: '#6e4239', skin: '#e8b796', skinSh: '#c28569',
    shirt: '#3e8948', shirtHi: '#63c74d', shirtSh: '#265c42',
    boot: '#3e2731', bootHi: '#5a4433', gear: '#c0cbdc', pack: '#3b3f57', reach: 0.45 };
  const SOLDIER = { hair: '#4b5320', hairHi: '#6b7530', skin: '#e4a672', skinSh: '#b86f50',
    shirt: '#4b5d3a', shirtHi: '#6d8450', shirtSh: '#2f3a24',
    boot: '#262b44', bootHi: '#3a4466', gear: '#181425', pack: '#454a2c', helmet: '#67735a', reach: 0.5 };
  /* The zombie was a purple figure with green hands and read as a plum. Its
     silhouette has to differ from the living at a glance, so the difference is
     built into the POSE (arms out front) and the palette is pushed to grimy
     neutrals — the sickly green skin is then the only saturated thing on it
     and the eye goes straight to it. */
  /* No dark hair. A rotting scalp painted near-black turned the head into the
     same hole in the sprite as everything else, and the breed washes Nightfall
     lays over these frames only made it darker. Sickly green all the way over
     the skull means the head is the first thing you see, which is what you
     want when three of them are coming at you. */
  const ZOMBIE = { hair: '#6b7a4a', hairHi: '#8a9c62', skin: '#9cba6b', skinSh: '#60783f',
    shirt: '#4a5163', shirtHi: '#646d84', shirtSh: '#2e3340',
    boot: '#2a2630', bootHi: '#443d4a', gear: '#a22633', pack: null,
    reach: 1, rags: true, mouth: '#3a1620' };
  /* The same trap the zombie's comment above describes, walked into again. Hair
     and boots were both #181425 — the outline colour itself — over a suit whose
     shadow tone was #1c1f33, one step off it. Lit from the north, where no face
     is turned toward the camera, the whole figure collapsed into a black puddle
     with two skin-coloured hands floating in it. The suit is now charcoal-blue
     a clear step above the border, and the hair is warm dark brown so the skull
     separates from the shoulders by hue as well as value when the agent walks
     away from you. */
  const AGENT = { hair: '#33262b', hairHi: '#6a4f52', skin: '#f2c094', skinSh: '#c28569',
    shirt: '#464b6b', shirtHi: '#6a7199', shirtSh: '#2b2f47',
    boot: '#2b2f47', bootHi: '#4a5178', gear: '#c0cbdc', pack: null, tie: '#a22633', reach: 0.4 };

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
     then hips, the shoulder mass, the pack riding on the back, the swinging
     arms outboard of it, and the head last and highest.

     Proportions are the whole game here. The first pass gave the figure 7.4px
     shoulders on a 32px cell with a 3px-deep hair pad stuck on a skin oval,
     and it read as a bat: one wide dark mass, no neck, no face, nothing to
     track. What fixes it is a taper — boots narrow, hips 4.6, shoulders 6.3 —
     and a head built the other way round from before: the skull is ALL hair
     and the FACE is the patch laid on the front of it. A hair pad over a skin
     head leaves the uncovered crescent in the wrong place on half the
     facings, and at 32px overhead that crescent IS the facing cue. */
  function topPerson(a, th, pal, o) {
    o = o || {};
    const legSw = o.leg || 0, armSw = o.arm || 0, sway = o.sway || 0;
    const breath = o.breath || 0, twist = o.twist || 0;
    const bx = CX + Math.cos(th) * sway, by = CY + Math.sin(th) * sway;
    const reach = pal.reach || 0;          // 0 = arms at the sides, 1 = stretched out front
    const armC = pal.shirtSh, armHi = pal.shirt, armSh = dim(pal.shirtSh);

    /* Boots park behind the torso's rear pole. A leg tucked under the body
       animates nothing — you cannot see it — so the swing has to happen in
       the few pixels of clear ground aft of the shoulders. */
    for (const [side, ph] of [[-1, legSw], [1, -legSw]]) {
      const [x, y] = kpt(th, side * 3.3, -4.4 + ph, bx, by);
      koval(a, x, y, th, 1.7, 2.5, round3(pal.boot, pal.bootHi, dim(pal.boot)));
      const [hx, hy] = kpt(th, side * 3.3, -5.8 + ph, bx, by);
      a.px(hx, hy, dim(pal.boot));                        // heel, darkest point of the sole
    }
    // hips, narrower than the shoulders: the taper is what reads as a body
    const [ix, iy] = kpt(th + twist, 0, -3.4, bx, by);
    koval(a, ix, iy, th + twist, 5.0, 2.8, round3(pal.shirtSh, pal.shirt, dim(pal.shirtSh)));
    for (let k = -3.4; k <= 3.4; k += 0.6) {              // belt across the small of the back
      const [lx, ly] = kpt(th + twist, k, -1.4, bx, by);
      a.px(lx, ly, dim(pal.shirtSh));
    }
    // shoulders: the widest mass, and the anchor everything else hangs off
    /* Wide and shallow. At 6.5 x 5.1 the shoulder mass was very nearly a
       circle, and a circle seen from above is a ball, not a person — the
       facing had to be carried entirely by the head and the gun. Shoulders
       that are twice as wide as they are deep read as shoulders on their own. */
    koval(a, bx, by, th + twist, 6.8, 4.0 + breath, round3(pal.shirt, pal.shirtHi, pal.shirtSh));
    // spine: one darker run down the middle turns a flat oval into a back
    for (let k = -3.6; k <= 1.4; k += 0.7) {
      const [x, y] = kpt(th + twist, 0, k, bx, by);
      a.px(x, y, pal.shirtSh);
    }
    // collar: a lit arc where the shoulders meet the neck, so the head reads
    // as sitting IN the body instead of resting on it
    for (let k = -1.0; k <= 1.0; k += 0.14) {
      const [x, y] = kpt(th + twist, k * 3.6, 2.9 - Math.abs(k) * 1.1, bx, by);
      a.px(x, y, pal.shirtHi);
    }
    if (pal.rags) {
      // torn cloth: skin showing through, and blood that has had time to dry
      for (const [ss, tt] of [[-2.8, 1.2], [3.2, -0.8], [1.0, -3.2], [-3.6, -1.6]]) {
        const [x, y] = kpt(th + twist, ss, tt, bx, by);
        a.px(x, y, pal.skinSh); a.px(x + 1, y, pal.skin);
      }
      for (const [ss, tt] of [[2.0, 2.4], [-1.6, -2.2]]) {
        const [x, y] = kpt(th + twist, ss, tt, bx, by);
        a.px(x, y, pal.gear); a.px(x, y + 1, dim(pal.gear));
      }
    }
    if (pal.pack) {
      const [x, y] = kpt(th + twist, 0, -2.6, bx, by);
      koval(a, x, y, th + twist, 2.9, 1.9, (s2, t2, dx, dy) =>
        (t2 > 1.5 ? SEAM : round3(pal.pack, lit(pal.pack), dim(pal.pack))(s2, t2, dx, dy)));
      // buckle: one bright pixel pair, which is what says "kit" rather than "rock"
      const [bux, buy] = kpt(th + twist, 0, -2.6, bx, by);
      a.px(bux, buy, pal.gear); a.px(bux, buy + 1, dim(pal.gear));
      for (const sd of [-1, 1]) {                         // straps over both shoulders
        for (let k = 0; k <= 1; k += 0.22) {
          const [sx, sy] = kpt(th + twist, sd * (1.6 + k * 1.4), -0.2 + k * 3.2, bx, by);
          a.px(sx, sy, pal.gear);
        }
      }
    }
    /* Arms, in the cloth's shadow tone so they separate from the torso without
       a black line between them. `reach` slides them from hanging at the sides
       to stretched out in front — which is the whole visual difference between
       a person walking and a corpse coming for you, and it costs one number. */
    /* Arm and hand are ONE oval, sleeve behind and bare skin at the forward
       end. Drawing the hand as its own disc past the cuff — which is what the
       first pass did — leaves two pale blobs floating either side of the head,
       and the pair of them read as mittens pinned to the shoulders. */
    for (const [side, ph] of [[-1, -armSw], [1, armSw]]) {
      /* Outboard of the skull, not beside it. With the head at its new radius
         the hands were touching it, and a pale hand welded to a pale face is a
         single three-blob bar across the front of the sprite with no face in
         it. 6.3 puts the inner edge of the hand a pixel clear of the head. */
      const as = side * (6.3 - reach * 1.9), at = 0.4 + ph + reach * 2.8;
      const [x, y] = kpt(th + twist, as, at, bx, by);
      const rb = 3.4 + reach * 1.5;
      koval(a, x, y, th + twist, 1.9, rb, (s2, t2, dx, dy) => {
        const k = dx + dy;
        if (t2 > rb - 2.2 - reach * 2.2)                  // cuff forward: bare skin
          return k < -1.6 ? lit(pal.skin) : k > 1.6 ? pal.skinSh : pal.skin;
        return k < -2.0 ? armHi : k > 2.2 ? armSh : armC;
      });
    }
    /* The skull is mostly FACE. Two passes got this backwards: a hair pad over
       a skin oval, then an all-hair disc with a face patch on it — both left a
       dark blob the size of a fist in the middle of the torso with no readable
       front. A pale face disc with a hair crescent behind it reads instantly
       at 32px, and the crescent alone carries the facing.

       There is deliberately no seam ring. Ringing the head added 0.9px of
       near-black all the way round and that ring, not the head, was what made
       the figure a mushroom; dark hair against a saturated shirt separates
       perfectly well on its own. */
    /* Bigger than life, and deliberately. Overhead characters are read by
       their heads; at the rig's true scale the skull is a four-pixel smudge
       between two hands. Every top-down game worth copying oversizes it. */
    const HT = 2.8, HR = 3.4;                             // forward offset, skull radius
    const [hx, hy] = kpt(th, 0, HT, bx, by);
    /* The seam only goes where the skull overlaps the shoulders. Ringing the
       whole head puts a black line along the front edge too, where the sprite
       already has open air and the outline pass handles it — and that extra
       ring is most of what made the old head read as a hole. */
    if (pal.helmet === undefined) {
      koval(a, hx, hy, th, HR, HR, (s2, t2, dx, dy) => {
        const k = dx + dy;
        if (t2 < -0.3)                                    // hair: the back of the skull
          return k < -2.0 ? pal.hairHi : k > 2.2 ? dim(pal.hair) : pal.hair;
        return k < -1.8 ? lit(pal.skin) : k > 1.8 ? pal.skinSh : pal.skin;
      });
      /* Sideburns only. A fringe drawn across the brow instead ate two of the
         three rows of face the head has to spare and put the dark blob back. */
      koval(a, hx, hy, th, HR, HR,
        (s2, t2) => (t2 >= -0.3 && t2 < 0.9 && Math.abs(s2) > 1.7 ? dim(pal.hair) : null));
      for (const sd of [-1.2, 1.2]) { const [ex, ey] = kpt(th, sd, HT + 1.6, bx, by); a.px(ex, ey, SEAM); }
      const [nx, ny] = kpt(th, 0, HT + 2.4, bx, by); a.px(nx, ny, pal.skinSh);
      if (pal.mouth) for (const sd of [-1, 1]) {
        const [mx, my] = kpt(th, sd, HT + 2.3, bx, by); a.px(mx, my, pal.mouth);
      }
      if (pal.tie) { const [tx, ty] = kpt(th + twist, 0, 4.4, bx, by); a.px(tx, ty, pal.tie); }
    } else {
      /* A helmet has no face, so the facing rides entirely on a bright forward
         brim. It also shares a family with the uniform, so this is the one head
         that does need a seam — on its rear arc, where it overlaps the pack. */
      koval(a, hx, hy, th, HR + 0.8, HR + 0.8, (s2, t2) => (t2 < 0.4 ? SEAM : null));
      koval(a, hx, hy, th, HR, HR, round3(pal.helmet, lit(pal.helmet), dim(pal.helmet)));
      koval(a, hx, hy, th, HR, HR, (s2, t2) => (t2 > 0.4 && t2 <= 1.6 ? dim(pal.helmet) : null));
      koval(a, hx, hy, th, HR, HR, (s2, t2) => (t2 > 1.6 ? lit(lit(pal.helmet)) : null));
      const [cx2, cy2] = kpt(th, -1.2, HT - 1.0, bx, by);
      a.px(cx2, cy2, lit(pal.helmet));                    // netting boss, off-centre
    }
    if (o.after) o.after(a, th, bx, by);
  }

  /* ----------------------------------------------------------- suites */

  const DIRS = [['n', 0], ['ne', TAU / 8], ['e', TAU / 4], ['se', 3 * TAU / 8],
                ['s', TAU / 2], ['sw', 5 * TAU / 8], ['w', 3 * TAU / 4], ['nw', 7 * TAU / 8]];

  /* One footprint for a figure on its feet and a wider one for a sprawl. The
     shadow is deliberately offset FORWARD of centre (cy = CY + 2.2) rather
     than concentric: an overhead light directly above a sprite casts no
     visible shadow at all, so the whole scene is lit from up-screen-left and
     every shadow in this pack agrees with that. */
  const FOOT = { rx: 6.8 * K, ry: 4.8 * K, cx: CX + 1.0, cy: CY + 1.9 };
  const SPRAWL = { rx: 8.6 * K, ry: 5.8 * K, cx: CX + 1.0, cy: CY + 2.4 };

  function personSuite(pal, label, opts) {
    opts = opts || {};
    const states = [];
    /* Idle is a breath plus a slow weight shift, four frames. The shift is a
       sideways sway rather than a scale pulse: an overhead figure has no
       silhouette to inflate, so a pure breath is invisible from above. */
    for (const [name, th] of DIRS) {
      states.push(D('idle_' + name, 4, true, scyc(4, 4, (a, i) =>
        topPerson(a, th, pal, {
          breath: [0, 0.5, 0.5, 0][i], sway: [0, 0.4, 0, -0.4][i],
          twist: [0, 0.05, 0, -0.05][i], arm: [0, 0.3, 0, -0.3][i], after: opts.held }), FOOT)));
    }
    /* Eight beats of walk. Legs and arms swing on the same sine (opposite
       sides already counter-swing through the `side` sign); the body's
       side-to-side weight shift rides a cosine, which is both what a walk
       actually does and what keeps beats 0 and 4 from being the same pose. */
    for (const [name, th] of DIRS) {
      const fps = opts.pace || 10, lur = opts.lurch || 1;
      states.push(D('walk_' + name, fps, true, scyc(8, fps, (a, i) => {
        const p = (i / 8) * TAU;
        topPerson(a, th, pal, {
          leg: Math.sin(p) * 2.3 * lur, arm: Math.sin(p) * 1.7 * lur,
          sway: Math.cos(p) * 1.0 * lur, twist: Math.sin(p) * 0.10 * lur,
          breath: 0, after: opts.held });
      }, FOOT)));
    }
    /* Attack: anticipation, strike, follow-through. The near arm reaches past
       the head and the shoulders counter-rotate — the same three beats a side
       view uses, but read through the twist because overhead has no reach. */
    for (const [name, th] of [['n', 0], ['e', TAU / 4], ['s', TAU / 2], ['w', 3 * TAU / 4]]) {
      states.push(D('attack_' + name, 12, false, sseq(4, 12, (a, i) => {
        const tw = [-0.35, -0.5, 0.45, 0.15][i], rc = [-0.8, -1.6, 2.4, 1.0][i];
        topPerson(a, th, pal, { twist: tw, arm: rc, sway: [0, -0.6, 1.0, 0.3][i],
          after: (b, ang, bx, by) => {
            if (opts.strike) opts.strike(b, ang, bx, by, i);
            else if (i >= 2) {
              // a swept arc in front of the shoulder line reads as a blow
              for (let k = -1.1; k <= 1.1; k += 0.22) {
                const [x, y] = kpt(ang, k * 4.5, 7.2 - Math.abs(k) * 1.6, bx, by);
                b.px(Math.round(x), Math.round(y), i === 2 ? '#ffffff' : '#c0cbdc');
              }
            }
            if (opts.held) opts.held(b, ang, bx, by);
          } });
      }, FOOT)));
    }
    states.push(D('hurt', 12, false, sseq(3, 12, (a, i) =>
      topPerson(a, TAU / 2, pal, { twist: [0.5, -0.4, 0.15][i], sway: [-1.4, 1.0, 0][i],
        arm: [-2.0, 1.4, 0][i] }), FOOT)));
    /* Death sprawls: the body flattens along one axis, the limbs splay, and
       the last beat dithers out. A top-down corpse that just falls over is the
       same oval at a different angle, which reads as the character lying down
       and standing straight back up. */
    /* Death sprawls over five beats. The body flattens along the axis it fell
       on, the limbs splay outward, the head rolls off-axis and the hair or
       helmet slides off the skull.

       Draw order is the point. The first version painted the limbs and then
       the torso on top of them, in the same tone — so the limbs were simply
       not there and the corpse was one featureless bean. Torso first, then
       limbs over it, and the arms end in bare skin exactly as they do on the
       living figure, so you can still tell what died. */
    states.push(D('death', 10, false, sseq(5, 10, (a, i) => {
      if (i === 0) { topPerson(a, TAU / 2, pal, { twist: 0.6, sway: -1.6, arm: -2.2 }); return; }
      const g = [0, 0.35, 0.7, 0.9, 1][i];
      const th = TAU / 2 + 0.55 * g;
      koval(a, CX, CY, th, 6.0 + 1.4 * g, 5.0 - 1.2 * g, round3(pal.shirt, pal.shirtHi, pal.shirtSh));
      for (const [side, ph] of [[-1, 3.0 * g], [1, -3.0 * g]]) {
        const [x, y] = kpt(th, side * (2.6 + 2.0 * g), -4.6 + ph);
        koval(a, x, y, th, 1.7, 2.5, round3(pal.boot, pal.bootHi, dim(pal.boot)));
      }
      for (const [side, ph] of [[-1, 2.2 * g], [1, -2.2 * g]]) {
        const [x, y] = kpt(th, side * (5.0 + 2.4 * g), 0.6 + ph);
        koval(a, x, y, th, 1.9, 3.0, (s2, t2, dx, dy) => {
          const k = dx + dy;
          if (t2 > 0.9) return k < -1.6 ? lit(pal.skin) : k > 1.6 ? pal.skinSh : pal.skin;
          return k < -2.0 ? pal.shirt : k > 2.2 ? dim(pal.shirtSh) : pal.shirtSh;
        });
      }
      const head = pal.helmet || pal.hair;
      const [hx, hy] = kpt(th, -1.8 * g, 2.0);
      koval(a, hx, hy, th, 2.9, 2.9, round3(pal.skin, lit(pal.skin), pal.skinSh));
      koval(a, hx - 1.2 * g, hy - 1.6 * g, th, 2.5, 2.3, round3(head, lit(head), dim(head)));
      if (i >= 3) {                                       // blood starting to find the low ground
        for (const [ox, oy] of [[-7, 4], [-5, 6], [6, 5], [8, 3]])
          a.px(CX + ox * g, CY + oy * g, '#6a0f1e');
      }
    }, SPRAWL)));
    /* The pool is a separate state so a game can leave it on the ground after
       the corpse despawns, and so a squeamish project can simply not ship it. */
    states.push(D('blood_pool', 6, false, seq(4, 6, (a, i) => {
      const g = [0.3, 0.6, 0.85, 1][i];
      koval(a, 15.5, 18, 0.4, 11 * g, 7.5 * g, (s2, t2, dx, dy) =>
        (a.hash(Math.round(15.5 + dx), Math.round(18 + dy), 7) < 0.12 ? '#6a0f1e' : '#8f1425'));
      koval(a, 14.0, 17.0, 0.4, 6 * g, 4.0 * g, () => '#a22633');
      koval(a, 13.0, 16.0, 0.4, 2.6 * g, 1.8 * g, () => '#c93a4a');
      for (const [dx, dy, r] of [[-11, 2, 1.6], [10, -3, 1.3], [7, 6, 1.1]])
        disc(a, 15.5 + dx * g, 18 + dy * g, r * g, '#8f1425');
    })));
    return { width: 32, height: 32, name: label, layers: [{ name: 'Body' }], states };
  }

  /* A weapon held in both hands out front, drawn after the body so it lies on
     top of them. Passed in as the `held` hook, so one figure painter serves an
     unarmed civilian and an armed soldier without branching inside it.

     On an overhead sprite the gun is the single strongest facing cue there is
     — stronger than the head, stronger than the pose — because it is the only
     part of the silhouette that breaks out of the body's oval. Held across the
     chest, as the first version did, it reads as a stripe on the shirt and
     buys nothing. */
  const GUNS = {
    pistol: { t0: 4.6, len: 3.6, s: 0.9, w: 2, slide: true },
    rifle: { t0: 3.2, len: 7.6, s: 1.0, w: 3, stock: true, mag: true },
    smg: { t0: 4.0, len: 5.4, s: 0.9, w: 3, mag: true }
  };
  const gun = kind => (b, th, bx, by) => {
    const g = GUNS[kind];
    const [x0, y0] = kpt(th, g.s, g.t0, bx, by);
    const [x1, y1] = kpt(th, g.s, g.t0 + g.len, bx, by);
    b.line(x0, y0, x1, y1, SEAM, g.w);                    // body, in silhouette
    b.line(x0, y0, x1, y1, '#4a5568', 1);                 // steel core
    // the top plane of the receiver is what the sun actually hits
    const [x2, y2] = kpt(th, g.s - 0.9, g.t0 + 0.8, bx, by);
    const [x3, y3] = kpt(th, g.s - 0.9, g.t0 + g.len * 0.6, bx, by);
    b.line(x2, y2, x3, y3, '#8b9bb4', 1);
    if (g.stock) {                                        // wood aft of the grip
      const [sx, sy] = kpt(th, g.s, g.t0 - 2.6, bx, by);
      b.line(sx, sy, x0, y0, SEAM, 3);
      b.line(sx, sy, x0, y0, '#6b4a2b', 1);
    }
    if (g.mag) {                                          // magazine hanging below
      const [mx0, my0] = kpt(th, g.s + 1.2, g.t0 + 1.2, bx, by);
      b.px(mx0, my0, '#2b3148'); b.px(mx0, my0 + 1, '#2b3148');
    }
    if (g.slide) {
      const [px, py] = kpt(th, g.s - 0.2, g.t0 + 0.4, bx, by);
      b.px(px, py, '#6a7590');
    }
    const [mx, my] = kpt(th, g.s, g.t0 + g.len + 0.5, bx, by);
    b.px(mx, my, '#c0cbdc');                              // muzzle
  };
  const rifle = gun('rifle');                             // kept: the old export name

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
      /* Low-frequency variation on a WRAPPING sine, so a field of dirt has
         patches in it and the tile still butts up against itself. Flat noise
         on a flat base — the first version — reads as static. */
      ['dirt', (b) => {
        for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
          const n = Math.sin(x / T * TAU) * Math.cos(y / T * TAU) + Math.sin((x + y) / T * TAU) * 0.6;
          const g = b.hash(x, y, 23);
          b.px(x, y, g < 0.10 ? '#5f3d1c' : g > 0.92 ? '#a86f3a'
            : n > 0.5 ? '#946130' : n < -0.55 ? '#794d22' : '#8a5a2b');
        }
        for (const [x, y] of [[3, 5], [10, 3], [12, 11], [6, 12]]) {   // half-buried stones
          b.px(x, y, '#a8a8b2'); b.px(x + 1, y, '#8b8b93'); b.px(x, y + 1, '#5f5f6b');
        }
      }],
      ['gravel path', (b) => { flat('#8b8b93', ['#a8a8b2', '#5f5f6b'], 0.34, 31)(b);
        for (const [x, y] of [[3, 4], [9, 3], [12, 9], [5, 11], [1, 8]]) { b.rect(x, y, x + 1, y + 1, '#c0cbdc'); b.px(x + 1, y + 1, '#5f5f6b'); } }],
      ['asphalt', (b) => { flat('#3a3a44', ['#4a4a56', '#2a2a33'], 0.3, 37)(b);
        b.rect(0, 7, T - 1, 8, '#33333d'); }],
      ['road line', (b) => { flat('#3a3a44', ['#4a4a56', '#2a2a33'], 0.3, 41)(b);
        b.rect(0, 7, 5, 8, '#fee761'); b.rect(10, 7, T - 1, 8, '#fee761'); }],
      ['sand', flat('#e4c07a', ['#f6dfa8', '#c49a55'], 0.24, 43)],
      /* Two crossed wrapping waves. The first version drew three fixed cyan
         dashes, which tiled across a lake as a grid of identical scratches —
         the single most obvious tell that a surface is a repeated 16px cell. */
      ['water', (b) => {
        for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
          const v = Math.sin((x / T) * TAU + Math.cos((y / T) * TAU) * 1.3)
            + Math.sin(((x + y) / T) * TAU * 2) * 0.5;
          b.px(x, y, v > 1.2 ? '#2ce8f5' : v > 0.6 ? '#0099db' : v < -1.1 ? '#0b3a68' : '#124e89');
        }
      }],
      ['shallow', (b) => {
        for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
          const v = Math.sin((x / T) * TAU * 2 + Math.sin((y / T) * TAU) * 1.4);
          b.px(x, y, v > 0.92 ? '#8ef6ff' : v > 0.2 ? '#5ec0e8' : '#2b7fb8');
        }
        R.speck(b, 0, 0, T - 1, T - 1, 53, ['#a86f3a', '#5c3a18'], 0.12);   // silt showing through
      }],
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

    /* An overhead prop reads from exactly three things: its top face, a lit
       edge on the side the sun comes from, and a cast shadow on the far side.
       Drop any one of them and the prop looks printed onto the floor instead
       of standing on it — which is what the whole first pass of this suite
       did. `lip` and `hilite` are the two edges; the shadow comes from
       `sstill`/`scyc`, stamped after the outline pass. */
    const lip = (a, x0, y0, x1, y1, c) => { a.rect(x1, y0 + 1, x1, y1, c); a.rect(x0 + 1, y1, x1, y1, c); };
    const hilite = (a, x0, y0, x1, y1, c) => { a.rect(x0, y0, x1 - 1, y0, c); a.rect(x0, y0, x0, y1 - 1, c); };

    /* Planked timber. Boards run along y, alternate a shade apart so the
       joints are visible without a black line, and carry a little grain noise
       — the single cheapest thing that stops flat wood looking like plastic. */
    const planks = (a, x0, y0, x1, y1, pitch, tones, seed) => {
      for (let y = y0; y <= y1; y++) {
        const b = Math.floor((y - y0) / pitch);
        const seam = (y - y0) % pitch === 0 && y > y0;
        for (let x = x0; x <= x1; x++) {
          if (seam) { a.px(x, y, tones[3]); continue; }
          const g = a.hash(x, y, seed);
          a.px(x, y, g < 0.12 ? tones[2] : g > 0.93 ? tones[0] : tones[b & 1 ? 1 : 0]);
        }
      }
    };

    // ---- crate: four boards, steel corner brackets, a diagonal brace, nails
    P('crate', 1, false, sstill(a => {
      planks(a, 7, 7, 24, 24, 4, ['#a87a45', '#96682f', '#82581f', '#63431a'], 3);
      a.line(8, 23, 23, 8, '#7a4f26', 1);                 // brace, corner to corner
      a.line(8, 22, 22, 8, '#c08a4e', 1);                 // and its lit side
      for (const [cx, cy] of [[7, 7], [21, 7], [7, 21], [21, 21]]) {
        a.rect(cx, cy, cx + 3, cy + 3, '#5f6b84');        // galvanised brackets
        a.rect(cx, cy, cx + 3, cy, '#8b9bb4');
        a.px(cx + 1, cy + 1, '#c0cbdc'); a.px(cx + 2, cy + 2, '#3a4466');
      }
      hilite(a, 7, 7, 24, 24, '#d09a5c');
      lip(a, 7, 7, 24, 24, '#4a3113');
    }, { rx: 11.5, ry: 8.0, cx: 17.5, cy: 19 }));

    // ---- barrel: a steel drum, read from its two rolling hoops
    P('barrel', 1, false, sstill(a => {
      disc(a, 15.5, 16, 10.0, '#2a2f3d');                 // shadowed side wall
      disc(a, 15.0, 15.5, 9.6, '#3f4a63', '#5f6b84');
      disc(a, 15.0, 15.5, 8.2, '#7a3a28', '#a3512f');     // rusted top
      for (const r of [7.4, 5.0]) for (let k = 0; k < 40; k++) {
        const a0 = k / 40 * TAU;
        a.px(15.0 + Math.cos(a0) * r, 15.5 + Math.sin(a0) * r, '#4f2517');
      }
      disc(a, 15.0, 15.5, 4.6, '#8f4429', '#b45f33');
      R.speck(a, 8, 8, 23, 23, 31, ['#c07a3f', '#4f2517'], 0.14);
      for (const [bx, by] of [[12, 12], [18, 19]]) {      // bung caps
        disc(a, bx, by, 1.8, '#2a2f3d');
        disc(a, bx, by, 1.1, '#8b9bb4', '#c0cbdc');
      }
      for (let k = 0; k < 22; k++) {                      // rim highlight, sun side
        const a0 = -TAU * 0.36 + (k / 22) * TAU * 0.26;
        a.px(15.0 + Math.cos(a0) * 9.2, 15.5 + Math.sin(a0) * 9.2, '#8b9bb4');
      }
    }, { rx: 11.0, ry: 8.0, cx: 17.5, cy: 19 }));

    // ---- table: planked top, chamfered edge, legs at the corners
    P('table', 1, false, sstill(a => {
      /* The legs sit PROUD of the top on all four corners. Tucked underneath,
         as the first version had them, they are invisible from directly above
         and the table reads as a chest. */
      for (const [x, y] of [[2, 5], [26, 5], [2, 23], [26, 23]]) {
        a.rect(x, y, x + 3, y + 4, '#4a3113');
        a.rect(x, y, x + 3, y, '#7a4f26'); a.px(x, y, '#a1723a');
      }
      planks(a, 5, 8, 26, 23, 5, ['#b07a3f', '#9c6a33', '#82581f', '#6b4720'], 11);
      a.rectO(5, 8, 26, 23, '#8a5f2b');                   // chamfer all round
      hilite(a, 5, 8, 26, 23, '#d09a5c');
      lip(a, 5, 8, 26, 23, '#4a3113');
      for (const [x, y] of [[7, 10], [24, 10], [7, 21], [24, 21]]) a.px(x, y, '#5f6b84');  // screw heads
    }, { rx: 13.5, ry: 10.0, cx: 17.5, cy: 20 }));

    // ---- bed: frame, mattress, dented pillow, turned-down sheet, quilt
    P('bed', 1, false, sstill(a => {
      a.rect(6, 2, 25, 29, '#6b4720'); hilite(a, 6, 2, 25, 29, '#9c6a33');
      lip(a, 6, 2, 25, 29, '#3a2410');
      a.rect(8, 3, 23, 28, '#d8dee8');                    // mattress showing at the edges
      a.rect(8, 4, 23, 11, '#eef2f8');                    // pillow
      a.rect(9, 5, 22, 10, '#ffffff');
      for (const [x, y] of [[13, 7], [14, 8], [18, 7], [19, 8]]) a.px(x, y, '#c3ccd8');  // the dent
      a.rect(8, 12, 23, 13, '#f4f7fb');                   // sheet, turned down
      a.rect(8, 14, 23, 27, '#9c2b40');                   // quilt
      a.rect(8, 14, 23, 15, '#c94f66');
      /* Two soft folds, not a run of stripes — evenly spaced dark lines across
         a quilt read as corrugated iron, which is what the first pass did. */
      for (const y of [19, 24]) {
        a.rect(8, y, 23, y, '#6e1c2c'); a.rect(8, y + 1, 23, y + 1, '#b03c52');
      }
      a.rect(22, 14, 23, 27, '#6e1c2c');
    }, { rx: 12.5, ry: 15.0, cx: 18.0, cy: 17 }));

    // ---- rug: border pattern and a fringe on both short ends
    P('rug', 1, false, sstill(a => {
      a.rect(4, 8, 27, 23, '#6d2b3a'); a.rect(4, 8, 27, 9, '#8a3a4c');
      a.rectO(6, 10, 25, 21, '#c9a227'); a.rectO(9, 12, 22, 19, '#c9a227');
      for (let y = 13; y <= 18; y += 2) for (let x = 12; x <= 19; x += 2) a.px(x, y, '#8a3a4c');
      a.px(15, 15, '#c9a227'); a.px(16, 16, '#c9a227');
      for (const x of [3, 28]) for (let y = 9; y < 23; y += 2) { a.px(x, y, '#e0c04a'); a.px(x, y + 1, '#8a6a18'); }
    }, { rx: 13.0, ry: 8.4, cx: 16.5, cy: 17 }));

    /* ---- bush: three lobes that actually MOVE. The first version nudged one
       lobe half a pixel and the four frames were, for practical purposes, the
       same picture — a sway you cannot see is worse than no sway, because it
       costs four frames of memory to look static. */
    P('bush', 6, true, scyc(6, 6, (a, i) => {
      const w = Math.sin(i / 6 * TAU) * 1.6, v = Math.cos(i / 6 * TAU) * 0.9;
      disc(a, 15.5, 17.5, 8.4, '#1b4a2e', '#265c42');
      disc(a, 12.0 + w, 13.5 + v, 5.0, '#2f6b38', '#3e8948');
      disc(a, 19.0 - w * 0.6, 17.5 - v, 4.6, '#265c42', '#3e8948');
      disc(a, 14.5 + w * 0.8, 20.0 + v * 0.5, 4.2, '#2f6b38', '#4a9c50');
      disc(a, 11.5 + w, 12.5 + v, 2.4, '#63c74d');        // sunlit crown
      R.speck(a, 8, 9, 24, 25, 13 + i, ['#63c74d', '#1b4a2e'], 0.10);
      for (const [x, y] of [[13, 12], [20, 19], [11, 20]]) {
        a.px(x + w, y + v, '#e43b44'); a.px(x + w, y + v + 1, '#a22633');
      }
    }, { rx: 10.0, ry: 6.6, cx: 18.0, cy: 22 }));

    /* ---- tree: five canopy lobes, a trunk glimpsed through the gap, and a
       sway that carries through the canopy at different rates per lobe so it
       reads as foliage rather than as a rigid decal being slid about. */
    P('tree', 6, true, scyc(6, 6, (a, i) => {
      /* Six lobes on a RING, leaving a hole at the centre so the trunk shows
         through it. That hole is the entire difference between a tree and a
         bush from directly overhead — the first version packed the lobes over
         the middle and the result was simply a larger bush. */
      const w = Math.sin(i / 6 * TAU) * 1.3, v = Math.cos(i / 6 * TAU) * 0.8;
      for (let k = 0; k < 6; k++) {                       // canopy underside, in shade
        const a0 = k / 6 * TAU + 0.4;
        disc(a, 15.5 + Math.cos(a0) * 7.4, 16.5 + Math.sin(a0) * 7.4, 6.4, '#10301c');
      }
      a.rect(13, 14, 18, 20, '#3a2410');                  // trunk, down the gap
      a.rect(13, 14, 18, 15, '#6b4720'); a.rect(14, 16, 17, 19, '#4a3113');
      for (const [x, y] of [[14, 15], [16, 17], [15, 19]]) a.px(x, y, '#8a5f2b');
      for (let k = 0; k < 6; k++) {                       // upper lobes, each on its own beat
        const a0 = k / 6 * TAU + 0.4, ph = k * 0.9;
        const sw = Math.sin(i / 6 * TAU + ph);
        const x = 15.0 + Math.cos(a0) * 7.2 + w * 0.5 + sw * 0.6;
        const y = 16.0 + Math.sin(a0) * 7.2 + v * 0.5;
        disc(a, x, y, 5.6, '#1b4a2e', '#265c42');
        disc(a, x - 1.4, y - 1.4, 3.4, '#2f6b38', '#3e8948');
        if (k < 3) disc(a, x - 2.2, y - 2.2, 1.8, '#4a9c50', '#63c74d');
      }
      R.speck(a, 3, 4, 28, 29, 17 + i * 3, ['#63c74d', '#10301c'], 0.09);
    }, { rx: 13.6, ry: 9.0, cx: 19.0, cy: 23 }));

    /* ---- rock: per-row half-widths, deliberately asymmetric. A shaded disc
       is a ball, and a ball is not a rock; stone needs corners and creases. */
    P('rock', 1, false, sstill(a => {
      const LW = [3, 5, 7, 9, 10, 10, 11, 11, 10, 10, 9, 7, 5, 3];
      const RW = [4, 6, 8, 9, 10, 11, 11, 10, 10, 9, 8, 7, 5, 2];
      for (let k = 0; k < LW.length; k++) {
        const y = 9 + k;
        for (let x = 15 - LW[k]; x <= 15 + RW[k]; x++) {
          const q = (x - 13.0) + (y - 14.0);
          a.px(x, y, q < -7 ? '#c0cbdc' : q < -2 ? '#9a9aa6' : q < 4 ? '#72727f' : '#4a4a56');
        }
      }
      a.line(8, 18, 16, 10, '#d3dae6', 1);                // two hard creases
      a.line(16, 10, 24, 16, '#3a3a44', 1);
      a.line(11, 21, 20, 18, '#3a3a44', 1);
      R.speck(a, 5, 9, 26, 22, 29, ['#d3dae6', '#33333d'], 0.11);
      for (const [x, y] of [[7, 16], [9, 20], [22, 19]]) { a.px(x, y, '#3e8948'); a.px(x + 1, y, '#265c42'); }
    }, { rx: 11.5, ry: 7.0, cx: 18.0, cy: 22 }));

    /* ---- campfire: an irregular stone ring, an ash bed, two crossed logs
       with lit end grain, and a flame that tapers and flickers. A symmetric
       ring of same-sized stones round a symmetric blob reads as a flower. */
    P('campfire', 8, true, scyc(8, 8, (a, i) => {
      disc(a, 15.5, 16.5, 8.6, '#4a4438', '#5f5849');     // ash bed
      const STONES = [[0.05, 9.4, 2.6], [0.9, 8.8, 2.0], [1.7, 9.6, 2.4], [2.5, 8.6, 1.7],
        [3.3, 9.4, 2.5], [4.1, 9.0, 2.1], [4.9, 9.6, 2.7], [5.7, 8.8, 1.9]];
      for (const [a0, rr, sr] of STONES) {
        const x = 15.5 + Math.cos(a0) * rr, y = 16.5 + Math.sin(a0) * rr;
        disc(a, x, y, sr, '#5f5f6b');
        disc(a, x - 0.4, y - 0.4, sr * 0.62, '#9a9aa6', '#c0cbdc');
      }
      for (const [x0, y0, x1, y1] of [[9, 19, 22, 13], [11, 12, 20, 21]]) {
        a.line(x0, y0, x1, y1, '#3a2410', 3);
        a.line(x0, y0, x1, y1, '#6d431e', 1);
        a.px(x0, y0, '#c07a3f'); a.px(x1, y1, '#c07a3f');  // end grain
      }
      // the flame: three nested tapers, each offset on its own beat
      const f = 1 + 0.18 * Math.sin(i / 8 * TAU * 2), dx = Math.sin(i / 8 * TAU) * 1.1;
      for (const [rr, cA, cB] of [[5.2, '#d4431a', '#f77622'], [3.6, '#f77622', '#feae34'], [2.0, '#fee761', '#ffffff']]) {
        const r = rr * f;
        for (let y = -Math.ceil(r * 1.5); y <= Math.ceil(r * 0.8); y++) {
          const t = (y + r * 1.5) / (r * 2.3);            // 0 at the tip, 1 at the base
          const hw = r * Math.sin(Math.min(1, t) * Math.PI * 0.62);
          for (let x = -hw; x <= hw; x++)
            a.px(15.5 + x + dx * (1 - t), 16.0 + y, x + y < -hw * 0.4 ? cB : cA);
        }
      }
      for (let k = 0; k < 4; k++) {                       // embers riding the updraught
        const a0 = (k / 4 + i / 8) * TAU;
        a.px(15.5 + Math.cos(a0) * 7.5, 13.0 - Math.abs(Math.sin(a0)) * 5, k & 1 ? '#feae34' : '#f77622');
      }
    }, { rx: 11.0, ry: 7.0, cx: 18.0, cy: 22 }));

    // ---- door: leaf, jamb, two hinges, a handle with an escutcheon
    P('door', 1, false, sstill(a => {
      a.rect(2, 11, 29, 20, '#3a2410');                   // frame / jamb
      planks(a, 3, 12, 28, 19, 4, ['#9c6a33', '#82581f', '#6b4720', '#4a3113'], 7);
      a.rect(3, 12, 28, 12, '#c08a4e');
      for (const x of [5, 26]) {                          // hinges, on the jamb side
        a.rect(x - 1, 12, x + 1, 13, '#5f6b84'); a.rect(x - 1, 18, x + 1, 19, '#5f6b84');
        a.px(x, 12, '#c0cbdc'); a.px(x, 19, '#c0cbdc');
      }
      a.rect(14, 14, 17, 17, '#8a6a18');                  // escutcheon
      a.rect(15, 15, 16, 16, '#fee761');
      a.rect(2, 20, 29, 20, '#241708');                   // threshold in shadow
    }, { rx: 14.5, ry: 6.4, cx: 17.5, cy: 21 }));

    /* ---- sandbags: a firing position. Overhead cover is the prop a top-down
       shooter needs most and the suite did not have one. */
    P('sandbags', 1, false, sstill(a => {
      /* Every bag gets a dark ring of its own BEFORE its fill, and the rows
         are laid back to front so each course overlaps the one behind. Without
         the rings the stack is a heap of gravel; without the ordering it is a
         flat mosaic. */
      for (let row = 0; row < 3; row++) {
        const y = 9 + row * 6, off = row & 1 ? 3 : 0;
        for (let bx = 2 + off; bx < 27; bx += 6) {
          oval(a, bx + 3, y + 4, 0, 4.0, 3.2, () => '#4a3c1a');
          oval(a, bx + 3, y + 3.4, 0, 3.4, 2.6, (s2, t2, dx, dy) =>
            (dx + dy < -2.2 ? '#dcc189' : dx + dy > 2.4 ? '#7d6435' : '#a88c4c'));
          a.line(bx + 0.5, y + 3.4, bx + 5.5, y + 3.4, '#8a7440', 1);   // the tied seam
        }
      }
      R.speck(a, 3, 8, 28, 24, 41, ['#f0d9a0', '#6b5528'], 0.08);
    }, { rx: 13.5, ry: 6.6, cx: 17.5, cy: 21 }));

    /* ---- dumpster: a big steel box with its lids half open, which reads at a
       glance as urban cover and hides a pickup nicely. */
    P('dumpster', 1, false, sstill(a => {
      a.rect(4, 6, 27, 26, '#1f4a3a');
      a.rect(4, 6, 27, 7, '#2f6b52'); a.rect(4, 6, 5, 26, '#2f6b52');
      a.rect(6, 8, 15, 24, '#3e8970');                    // left lid, closed
      a.rect(6, 8, 15, 9, '#54a487');
      a.rect(17, 8, 25, 24, '#0d241d');                   // right lid open: the void
      for (const [bx, by, r, c] of [[20, 12, 2.6, '#3a3a44'], [23, 17, 2.2, '#4a3113'],
        [19, 20, 2.4, '#3a3a44'], [22, 23, 1.8, '#5a4a2a']])
        disc(a, bx, by, r, c, '#6b6b78');                 // refuse sacks, catching the light
      a.rect(16, 6, 16, 26, '#0b1f18');                   // centre hinge line
      for (const y of [11, 21]) { a.rect(3, y, 4, y + 3, '#181425'); a.rect(27, y, 28, y + 3, '#181425'); }
      for (const [x, y] of [[8, 13], [12, 19], [9, 22]]) { a.px(x, y, '#7a3a28'); a.px(x + 1, y + 1, '#5c2a1c'); }
      lip(a, 4, 6, 27, 26, '#0b1f18');
    }, { rx: 13.5, ry: 9.0, cx: 18.0, cy: 23 }));

    /* ---- street lamp: the head and a foreshortened mast, which is how a
       vertical object has to be drawn in a true overhead view. */
    P('streetlamp', 1, false, sstill(a => {
      a.rect(14, 18, 17, 28, '#3a3a44');                  // mast, seen end-on-ish
      a.rect(14, 18, 14, 28, '#5f5f6b');
      disc(a, 15.5, 27.0, 4.2, '#2a2a33', '#4a4a56');     // base plate
      oval(a, 15.5, 13.0, 0, 6.6, 4.6, round3('#4a4a56', '#72727f', '#2a2a33'));
      oval(a, 15.5, 13.0, 0, 5.0, 3.2, () => '#fee761');  // the lens
      oval(a, 15.5, 12.4, 0, 3.0, 1.8, () => '#ffffff');
      a.rect(9, 13, 22, 13, '#c0cbdc');
    }, { rx: 9.0, ry: 5.0, cx: 19.0, cy: 27 }));

    return { width: 32, height: 32, name: 'top-down props', layers: [{ name: 'Prop' }], states: S };
  }

  /* -------------------------------------------------------- vehicles */

  /* A vehicle body from per-row half-widths. Cars are not boxes: the nose
     tapers, the cabin is the widest point and every corner is radiused.
     Drawing a rectangle and calling it a car is what made the first pass of
     this suite read as a domino with stripes. */
  const hull = (a, rows, y0, base, hi, sh, edge) => {
    const mid = y0 + rows.length / 2;
    for (let k = 0; k < rows.length; k++) {
      const w = rows[k], y = y0 + k;
      if (w <= 0) continue;
      const x0 = Math.round(15.5 - w), x1 = Math.round(15.5 + w);
      for (let x = x0; x <= x1; x++) {
        const q = (x - 15.5) + (y - mid) * 0.35;
        a.px(x, y, q < -w * 0.5 ? hi : q > w * 0.55 ? sh : base);
      }
      a.px(x0, y, edge || hi);
      a.px(x1, y, sh);
    }
  };
  // glass: dark, cool, and lighter along its leading edge. On an overhead
  // sprite the windscreen is the only thing that says which end is the front.
  const glass = (a, x0, y0, x1, y1) => {
    a.rect(x0, y0, x1, y1, '#1b4a63');
    a.rect(x0, y0, x1, y0, '#2f88a8');
    a.rect(x0 + 1, y0 + 1, x1 - 3, y0 + 1, '#5ec0e8');
    a.px(x1 - 1, y1, '#123449');
  };

  function vehicleSuite() {
    const S = [];

    S.push(D('car', 1, false, sstill(a => {
      const ROWS = [2, 4, 5, 6, 6, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 6, 6, 6, 5, 4, 2];
      for (const y of [5, 20]) for (const x of [6, 25]) {  // wheels under the arches
        a.rect(x - 1, y, x + 1, y + 5, '#181425');
        a.rect(x - 1, y + 1, x - 1, y + 4, '#3a3a44');
        a.px(x, y + 2, '#5f5f6b');
      }
      hull(a, ROWS, 2, '#9c2b40', '#c94f66', '#6e1c2c', '#e06a80');
      a.rect(14, 4, 17, 11, '#b03c52');                    // bonnet, with a centre crease
      a.rect(15, 5, 15, 10, '#e06a80');
      glass(a, 10, 12, 21, 15);                            // windscreen
      a.rect(9, 16, 22, 22, '#8a2338');                    // roof, wider than the glass
      a.rect(10, 17, 21, 17, '#b03c52');
      a.rect(11, 18, 20, 21, '#9c2b40');
      /* The backlight is deliberately darker and smaller than the windscreen.
         Two equal teal bands and the car is a domino again — you cannot tell
         which way it is pointing. */
      a.rect(11, 23, 20, 25, '#123449'); a.rect(12, 23, 19, 23, '#1f6a88');
      for (const y of [16, 21]) a.rect(9, y, 9, y, '#6e1c2c');               // door seams
      for (const y of [16, 21]) a.rect(22, y, 22, y, '#6e1c2c');
      a.px(8, 13, '#c0cbdc'); a.px(23, 13, '#c0cbdc');     // wing mirrors
      a.rect(11, 2, 13, 3, '#fee761'); a.rect(18, 2, 20, 3, '#fee761');
      a.rect(11, 29, 13, 29, '#e43b44'); a.rect(18, 29, 20, 29, '#e43b44');
      a.rect(14, 29, 17, 29, '#3a3a44');                   // bumper
    }, { rx: 12.5, ry: 15.5, cx: 18.5, cy: 18 })));

    S.push(D('truck', 1, false, sstill(a => {
      /* Cab and box are ONE vehicle, so they have to share a width and a
         value range. The first version put a small bright-green cab in front
         of a big near-white box and the two read as separate objects parked
         nose to tail. */
      const CAB = [4, 7, 9, 10, 10, 10, 10, 10, 10, 10, 10, 10];
      const BOX = [10, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11];
      for (const y of [2, 12, 21]) for (const x of [3, 28]) {
        a.rect(x - 1, y, x + 1, y + 6, '#181425');
        a.rect(x - 1, y + 1, x - 1, y + 5, '#3a3a44');
        a.px(x, y + 3, '#5f5f6b');
      }
      hull(a, CAB, 1, '#2f6b38', '#4d9a52', '#1b4a28', '#63c74d');
      /* The windscreen is inset on all four sides. Run it the full width of the
         cab and all that is left of the cab is a green sliver top and bottom,
         which is what made the first version look like a box being towed by a
         stripe. */
      glass(a, 10, 4, 21, 7);
      a.rect(9, 9, 22, 12, '#25562e');                     // cab roof, aft of the glass
      a.rect(10, 9, 21, 9, '#4d9a52'); a.rect(15, 10, 16, 12, '#3d8043');
      a.rect(8, 1, 11, 2, '#fee761'); a.rect(20, 1, 23, 2, '#fee761');
      a.rect(12, 1, 19, 2, '#3a3a44');                     // grille between the lamps
      a.px(5, 5, '#c0cbdc'); a.px(26, 5, '#c0cbdc');       // mirrors, outboard of the cab
      for (const x of [7, 23]) { a.rect(x, 9, x + 1, 11, '#3a3a44'); a.px(x, 9, '#8b9bb4'); }  // stacks
      hull(a, BOX, 14, '#5f6b84', '#8b9bb4', '#3a4466', '#a3b0c8');
      for (let y = 17; y <= 27; y += 3) {                  // corrugations, lit on top
        a.rect(5, y, 26, y, '#2f3750'); a.rect(5, y + 1, 26, y + 1, '#72809c');
      }
      a.rect(4, 13, 27, 13, '#181425');                    // the gap behind the cab
      a.rect(12, 19, 19, 25, '#3a4466');                   // roof hatch
      a.rect(12, 19, 19, 19, '#8b9bb4'); a.px(15, 22, '#c0cbdc');
      a.rect(6, 28, 25, 29, '#3a3a44');                    // rear doors
      a.rect(15, 28, 16, 29, '#8b9bb4');
    }, { rx: 15.0, ry: 15.5, cx: 19.0, cy: 18 })));

    /* The turret sweeps and the hull is redrawn identically each frame, which
       is exactly how a game would composite a two-part rig and leaves the
       sheet usable both ways. */
    S.push(D('tank_traverse', 8, true, scyc(8, 8, (a, i) => {
      for (const x of [4, 27]) {                           // tracks, with link ticks
        a.rect(x - 2, 2, x + 1, 29, '#22273a');
        a.rect(x - 2, 2, x - 2, 29, '#3a4466');
        for (let y = 3; y < 29; y += 2) a.rect(x - 1, y, x + 1, y, '#454f6e');
        for (let y = 4; y < 29; y += 6) a.px(x, y, '#6a7590');
      }
      const HULL = [3, 5, 7, 8, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 8, 8, 7];
      hull(a, HULL, 3, '#4b5d3a', '#6d8450', '#2f3a24', '#7d9660');
      for (let y = 7; y < 26; y += 6) a.rect(8, y, 23, y, '#3d4c2e');        // deck plates
      a.rect(12, 4, 19, 6, '#3d4c2e'); a.rect(12, 4, 19, 4, '#7d9660');      // glacis plate
      a.rect(7, 24, 24, 27, '#3d4c2e');                                      // engine deck
      for (let x = 8; x <= 23; x += 2) a.rect(x, 25, x, 26, '#22273a');      // and its grille

      const th = (i / 8) * TAU;
      const [ex, ey] = pt(th, 0, 15.5, 15.5, 16);
      a.line(15.5, 16, ex, ey, '#181425', 5);                                // barrel
      a.line(15.5, 16, ex, ey, '#3a4466', 3);
      a.line(15.5, 16, ex, ey, '#8b9bb4', 1);
      const [bx, by] = pt(th, 0, 14.0, 15.5, 16);
      disc(a, bx, by, 1.6, '#2a3040');                                       // muzzle brake
      disc(a, bx, by, 0.9, '#8b9bb4');
      const [mx, my] = pt(th, 0, 7.0, 15.5, 16);
      oval(a, mx, my, th, 3.4, 2.4, round3('#5f7444', '#87a063', '#39482a')); // mantlet
      oval(a, 15.5, 16, th, 7.4, 6.6, () => SEAM);                           // turret ring
      oval(a, 15.5, 16, th, 6.2, 5.4, round3('#7d9660', '#a3bd82', '#48592f'));
      const [hx, hy] = pt(th, -1.8, -1.2, 15.5, 16);                         // commander's hatch
      disc(a, hx, hy, 2.2, '#39482a'); disc(a, hx - 0.3, hy - 0.3, 1.5, '#8fa86a', '#b4cc8f');
      const [sx, sy] = pt(th, 2.6, -2.8, 15.5, 16);                          // stowage bin
      oval(a, sx, sy, th, 2.2, 1.5, round3('#4a4a56', '#72727f', '#2a2a33'));
      for (let k = 0; k < 5; k++) {                                          // grab rails
        const [gx, gy] = pt(th, -3.6 + k * 1.8, 3.2, 15.5, 16);
        a.px(gx, gy, '#48592f');
      }
    }, { rx: 14.5, ry: 15.0, cx: 19.0, cy: 18 })));

    /* Rotor blur is four spokes at a sub-frame angle plus a dashed sweep ring,
       not a solid disc: a filled circle hides the aircraft, and a
       stroboscopic two-blade pose reads as a stalled rotor. */
    S.push(D('helicopter', 12, true, scyc(6, 12, (a, i) => {
      const BOOM = [3, 3, 3, 3, 2, 2, 2, 2, 2, 2];        // tapering tail boom
      hull(a, BOOM, 19, '#3a4466', '#5f6b84', '#262b44', '#6a7590');
      a.rect(11, 27, 20, 28, '#2f3350');                  // horizontal stabiliser
      a.rect(11, 27, 20, 27, '#5f6b84');
      a.rect(14, 23, 17, 26, '#262b44'); a.rect(14, 23, 14, 26, '#4a5178');   // fin
      for (let k = 0; k < 8; k++) {                       // tail rotor, blurred
        const a0 = (k / 8 + i / 6) * TAU;
        a.px(18.0 + Math.cos(a0) * 4.0, 25 + Math.sin(a0) * 4.0, '#4a5178');
      }
      const FUS = [3, 5, 7, 8, 8, 8, 8, 8, 8, 7, 7, 6, 6, 5, 5, 4, 3];
      hull(a, FUS, 3, '#4a5178', '#7080b0', '#2f3350', '#8f9ed0');
      oval(a, 15.5, 7.6, 0, 5.2, 4.2, () => '#123449');   // cockpit glass, at the nose
      oval(a, 15.5, 7.0, 0, 4.0, 2.8, () => '#2f88a8');
      oval(a, 15.5, 6.2, 0, 2.4, 1.4, () => '#8ef6ff');
      a.rect(9, 12, 22, 12, '#2f3350');                   // cabin door frame
      a.rect(10, 13, 21, 18, '#3e4a74'); a.rect(10, 13, 21, 13, '#7080b0');
      a.rect(15, 13, 15, 18, '#2f3350');                  // the sliding door's seam
      a.rect(9, 19, 22, 19, '#2f3350');
      for (const x of [5, 26]) {                          // skids, low and dark
        a.rect(x, 12, x, 22, '#3a4466'); a.px(x, 12, '#6a7590');
        const inw = x < 15 ? 1 : -1;
        a.rect(x + inw, 14, x + inw * 4, 14, '#2f3350');  // struts up to the belly
        a.rect(x + inw, 20, x + inw * 4, 20, '#2f3350');
      }
      /* The main rotor is a BLUR, not a diagram. Solid lines the full diameter
         of the disc, which is what the first pass drew, turn the sprite into a
         spider's web and hide the aircraft underneath it. A faint sweep arc
         plus two blades fading out towards the tips reads as rotation and
         leaves the fuselage legible. */
      const base = (i / 6) * (TAU / 2);
      for (let k = 0; k < 120; k++) {
        const th = (k / 120) * TAU;
        if ((k + i * 4) % 5) continue;
        a.px(15.5 + Math.cos(th) * 14.0, 13 + Math.sin(th) * 14.0, '#39415e');
      }
      for (const th of [base, base + TAU / 2]) {
        const cx = Math.cos(th), sy = Math.sin(th);
        a.line(15.5 + cx * 3, 13 + sy * 3, 15.5 + cx * 9, 13 + sy * 9, '#8b9bb4', 1);
        a.line(15.5 + cx * 9, 13 + sy * 9, 15.5 + cx * 13.5, 13 + sy * 13.5, '#4e5878', 1);
      }
      disc(a, 15.5, 13, 2.6, '#181425');                  // rotor head
      disc(a, 15.5, 13, 1.5, '#8b9bb4', '#e0e6f0');
    }, { rx: 9.5, ry: 13.5, cx: 19.0, cy: 18 })));

    S.push(D('boat', 4, true, scyc(4, 4, (a, i) => {
      const r = [0, 1, 0, -1][i];
      /* From above a boat is a bright GUNWALE rim around a dark interior with
         thwarts across it. Fill the whole silhouette in one mid-brown, as the
         first pass did, and you have drawn a sack — there is nothing to say
         it is hollow, which is the only thing that makes it a boat. */
      const HULL = [0, 2, 3, 4, 5, 6, 7, 7, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 7, 7, 7, 7, 7, 7];
      const y0 = 2 + r;
      for (let k = 0; k < HULL.length; k++) {
        const w = HULL[k], y = y0 + k;
        a.rect(15.5 - w, y, 15.5 + w, y, '#8a5a2b');      // gunwale, all the way round
        a.rect(15.5 - w, y, 15.5 - w + 1, y, '#d09a5c');  // lit port rail
        a.px(15.5 + w, y, '#5c3a18');
        const iw = w - 2.6;                               // hollow: two rails in
        if (iw > 0 && k > 3 && k < HULL.length - 1) {
          a.rect(15.5 - iw, y, 15.5 + iw, y, '#4a2a10');
          a.px(15.5 - iw, y, '#3a2410'); a.px(15.5 + iw, y, '#2e1c0a');
        }
      }
      a.rect(13, 3 + r, 18, 6 + r, '#a0662f');            // foredeck at the bow
      a.rect(14, 3 + r, 17, 3 + r, '#d09a5c');
      for (const y of [11, 17, 23]) {                     // thwarts, with a lit top edge
        a.rect(9, y + r, 22, y + r + 1, '#8a5a2b');
        a.rect(9, y + r, 22, y + r, '#c48a4f');
      }
      for (const sd of [-1, 1]) {                         // oars shipped inside the gunwale
        a.line(15.5 + sd * 4, 9 + r, 15.5 + sd * 5.5, 25 + r, '#6d431e', 1);
        a.rect(15.5 + sd * 5.5 - 1, 25 + r, 15.5 + sd * 5.5 + 1, 27 + r, '#c48a4f');
      }
      a.rect(11, 25 + r, 20, 27 + r, '#8a5a2b');          // transom
      a.rect(11, 25 + r, 20, 25 + r, '#c48a4f');
      a.rect(13, 28 + r, 18, 29 + r, '#3f3f4c');          // outboard
      a.rect(14, 28 + r, 17, 28 + r, '#8b9bb4'); a.px(15, 29 + r, '#181425');
      for (let k = 0; k < 13; k++)                        // wake off the stern
        a.px(4 + k * 2, 30 - (k & 1), k & 1 ? '#8ef6ff' : '#5ec0e8');
    }, { rx: 10.0, ry: 15.0, cx: 18.0, cy: 18 })));

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
    /* The ground shadow tightens as the item rises and spreads as it settles.
       A fixed blob under a bobbing icon reads as a sticker with a smudge
       behind it; the shadow changing size is the whole reason the bob sells as
       hover rather than as the sprite twitching. */
    const P = (name, fn) => S.push(D(name, 6, true, Array.from({ length: 4 }, (_, i) =>
      R.Fr(R.ms(6), shadowed(a => fn(a, bob(i), i),
        { rx: 8.2 + bob(i) * 0.9, ry: 3.6 + bob(i) * 0.4, cx: CX + 1.6, cy: CY + 9.5 })))));
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

  return { pt, oval, round3, topPerson, personSuite, rifle, gun,
    SURVIVOR, SOLDIER, ZOMBIE, AGENT,
    tileSuite, propSuite, vehicleSuite, pickupSuite };
})();
