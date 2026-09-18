/* PixelForge Studio — Modern / urban pack.
   The contemporary-setting cast and kit: a soldier, a police officer, a
   paramedic, a civilian survivor and a shambler, all on one 3/4 humanoid rig;
   a rack of top-down vehicles for driving and GTA-style games; street
   furniture; a loot set; and a 16-tile city sheet.

   Palette discipline: everything sits in a desaturated asphalt/concrete range
   and each unit carries exactly ONE saturated accent (police blue, medic red,
   soldier tan). That is what stops nine grey sprites from merging on a grey
   street. */
window.PF = window.PF || {};
PF.Modern = (() => {
  /* The humanoid skeleton, the frame helpers and the shared primitives all
     live in PF.Rig so every character pack animates off one body. Bound to
     locals here so call sites read the same as they did when the rig was
     inline. */
  const R = PF.Rig;
  const P = R.P, D = R.D, Fr = R.Fr, ms = R.ms, OUT = R.OUT;
  const draw = R.draw, seq = R.seq, cyc = R.cyc, still = R.still, TAU = R.TAU;
  const speck = R.speck, disc = R.disc;
  const personRig = R.person, prone = R.prone;
  const idleState = R.idleState, walkState = R.walkState;
  const hurtState = R.hurtState, downState = R.downState;


  const base = { brow: '#8a5a44', eye: '#231a14', mouth: '#8a5a44' };
  const SOLDIER = Object.assign({}, base, {
    skin: '#c98d5c', skinHi: '#e8b183', skinSh: '#8a5a38',
    shirt: '#6b6f4a', shirtHi: '#8f9464', shirtSh: '#3f422b',
    vest: '#3f4433', vestHi: '#5c634a', vestSh: '#242719',
    leg: '#5c6042', legSh: '#41462a', shoe: '#3a332a', shoeSh: '#241f19',
    belt: '#4a4232', beltDark: '#2a2519',
    gear: (a, hy) => {
      /* Combat helmet: a dome overhanging the skull on both sides with a brim
         shadow under it, and cheek straps down the sides.

         The shell stops ABOVE the eye line. Carried down to hy+1 the brim
         covers both eyes and the whole head reads as a blank tan chin under a
         green cap — which is exactly what the first cut did. */
      a.ellipse(11, hy - 5, 21, hy - 1, '#4a4f36', true);
      a.ellipse(12, hy - 5, 18, hy - 3, '#6e7551', true);
      a.rect(11, hy - 2, 21, hy - 2, '#343824');
      a.rect(11, hy - 1, 21, hy - 1, '#2a2d1e');
      a.rect(11, hy - 1, 11, hy + 2, '#4a4f36');
      a.rect(21, hy - 1, 21, hy + 2, '#2a2d1e');
      a.px(19, hy - 4, '#9aa274');
    }
  });
  const POLICE = Object.assign({}, base, {
    skin: '#d9a173', skinHi: '#f2c095', skinSh: '#9c6a42',
    shirt: '#3d5182', shirtHi: '#5d74ad', shirtSh: '#232e4d',
    vest: '#2a3452', vestHi: '#465580', vestSh: '#161d31',
    badge: '#ffd24a', badgeHi: '#fff6c9',
    leg: '#313d5e', legSh: '#1e2640', shoe: '#26262e', shoeSh: '#141419',
    belt: '#26262e', beltDark: '#141419',
    gear: (a, hy) => {
      // peaked cap: crown, then a brim that sticks out past the face
      a.ellipse(12, hy - 5, 20, hy - 2, '#313d5e', true);
      a.ellipse(13, hy - 5, 17, hy - 4, '#5d74ad', true);
      a.rect(11, hy - 2, 21, hy - 1, '#1e2640');
      a.rect(11, hy - 2, 21, hy - 2, '#3d5182');
      // cap badge sits on the front of the crown, not on top of it
      a.rect(15, hy - 3, 17, hy - 3, '#ffd24a');
      a.px(15, hy - 3, '#fff6c9');
    }
  });
  const MEDIC = Object.assign({}, base, {
    skin: '#e0b08a', skinHi: '#f7d0ad', skinSh: '#a37653',
    shirt: '#d8dce4', shirtHi: '#ffffff', shirtSh: '#8f96a4',
    cross: '#d43f3f', crossHi: '#ff8a8a',
    leg: '#2f3f63', legSh: '#1a2340', shoe: '#1c1c22', shoeSh: '#101014',
    belt: '#2f3f63', beltDark: '#1a2340',
    hair: '#4a3324', hairHi: '#6d4b34', hairSh: '#312116'
  });
  const SURVIVOR = Object.assign({}, base, {
    skin: '#c98d5c', skinHi: '#e8b183', skinSh: '#8a5a38',
    shirt: '#6b4a7d', shirtHi: '#8f66a4', shirtSh: '#3f2a4c',
    leg: '#3a4a6b', legSh: '#212b40', shoe: '#5a3b22', shoeSh: '#33210f',
    belt: '#5a3b22', beltDark: '#33210f',
    gear: (a, hy) => {
      /* Hood, not hair: the raised collar behind the neck is what separates a
         hoodie from a haircut at this size. */
      a.ellipse(11, hy - 5, 21, hy + 3, '#6b4a7d', true);
      a.ellipse(12, hy - 5, 18, hy - 2, '#8f66a4', true);
      /* The opening is SMALL and set low. Run up to the crown it leaves the
         hood as a one-pixel rim and the head reads as bald with a headband. */
      a.ellipse(13, hy - 2, 20, hy + 3, '#c98d5c', true);
      a.ellipse(14, hy - 1, 18, hy + 1, '#e8b183', true);
      a.rect(13, hy - 2, 20, hy - 2, '#5a3a24');               // hood shadow
      a.px(15, hy, '#231a14'); a.px(19, hy, '#231a14');
      a.rect(16, hy + 2, 17, hy + 2, '#8a5a44');
      a.rect(11, hy + 4, 21, hy + 5, '#3f2a4c');               // collar
      a.rect(11, hy + 4, 21, hy + 4, '#6b4a7d');
    }
  });
  const ZOMBIE = Object.assign({}, base, {
    skin: '#7d9464', skinHi: '#9cb37e', skinSh: '#4c5c3a',
    brow: '#3b4a2b', eye: '#d8dce4', eyeHi: null, mouth: '#4a1c1c',
    shirt: '#6f7263', shirtHi: '#8e9180', shirtSh: '#41443a',
    leg: '#5a5342', legSh: '#332e24', shoe: '#3a342a', shoeSh: '#221e18',
    belt: '#4a4130', beltDark: '#2b251b',
    hair: '#39322a', hairHi: '#554a3d', hairSh: '#221d18',
    gear: (a, hy) => {
      /* Matted scalp with the skull showing through, plus a dribble off the
         chin. The generic hair cap is a flat slab of brown and on a corpse it
         just reads as a wig sat on a green face. */
      a.ellipse(12, hy - 5, 20, hy - 2, '#39322a', true);
      a.ellipse(13, hy - 5, 16, hy - 4, '#554a3d', true);
      a.rect(17, hy - 5, 19, hy - 3, '#7d9464');          // bald patch
      a.px(18, hy - 4, '#4c5c3a');
      a.rect(12, hy - 3, 12, hy, '#39322a');
      a.px(20, hy - 3, '#221d18');
      a.rect(13, hy - 2, 15, hy - 2, '#4a1c1c');          // scalp wound
      a.px(14, hy - 2, '#7d2626');
      a.px(16, hy + 3, '#7d2626');                        // dribble
      a.px(16, hy + 4, '#4a1c1c');
    }
  });

  // ---- held kit. Every weapon is drawn from the fist outward so it stays
  // attached to the hand at every swing phase. ----
  /* One rifle, two carries. Drawn level it is the aim pose; drawn on a slope
     it is the patrol carry. A rifle held dead horizontal at belly height reads
     as a railing the figure is leaning on, and the hand vanishes behind it —
     the slope is what puts the muzzle in front of the body. */
  const rifleAt = (a, x, y, slope) => {
    const at = d => [x + d, y - 2 + Math.round(d * slope)];
    for (let d = -8; d <= 3; d++) {
      const p = at(d);
      a.rect(p[0], p[1], p[0], p[1] + 1, d < -5 ? '#4a3524' : '#2f3238');
      a.px(p[0], p[1], d < -5 ? '#6d4f33' : '#575c66');
    }
    const m = at(-2);
    a.rect(m[0], m[1] + 2, m[0] + 2, m[1] + 5, '#20222a');   // magazine
    a.px(m[0], m[1] + 2, '#3a3e46');
    const g = at(1);
    a.px(g[0], g[1] + 2, '#2f3238');                         // pistol grip
    const t = at(3);
    a.px(t[0], t[1], '#9aa0aa');
  };
  const RIFLE = (a, x, y) => rifleAt(a, x, y, 0.45);
  const RIFLE_LEVEL = (a, x, y) => rifleAt(a, x, y, 0);
  /* Handgun, same slope trick as the rifle: level it is the aim pose, raked
     down it is the low-ready carry. Held dead level at hip height a 7px slide
     reads as a nightstick the officer is holding out sideways. The grip rakes
     BACK under the slide — squared off directly beneath it the gun reads as a
     claw hammer. */
  const pistolAt = (a, x, y, slope) => {
    const at = d => [x + d, y - 2 + Math.round(d * slope)];
    for (let d = -2; d <= 4; d++) {
      const p = at(d);
      a.rect(p[0], p[1], p[0], p[1] + 1, '#3a3e46');
      a.px(p[0], p[1], '#6b7079');
    }
    const g = at(-1);
    a.px(g[0], g[1] + 2, '#26292f');
    a.rect(g[0] - 1, g[1] + 3, g[0] - 1, g[1] + 4, '#26292f');
    a.px(g[0] - 1, g[1] + 4, '#1a1c21');
    const t = at(4);
    a.px(t[0], t[1], '#9aa0aa');
  };
  const PISTOL = (a, x, y) => pistolAt(a, x, y, 0.6);
  const PISTOL_LEVEL = (a, x, y) => pistolAt(a, x, y, 0);
  /* Bat with its thickness measured PERPENDICULAR to the shaft. Thickened
     along x instead, a diagonal bat rasterises into a stepped ribbon; thickened
     as a square per sample it becomes a chain of blocks. Neither survives being
     rotated through a swing arc, and both read as a paddle. */
  function batAt(a, cx, cy, ang, d0, d1) {
    const nx = -Math.sin(ang), ny = Math.cos(ang);
    for (let d = d0; d <= d1; d++) {
      const bx = cx + Math.cos(ang) * d, by = cy + Math.sin(ang) * d;
      // grip is a FRACTION of the shaft, not a fixed four samples: hard-coded
      // it eats most of a short swing arc and the barrel shrinks to a stub
      const grip = d < d0 + (d1 - d0) * 0.35, w = grip ? 0 : d < d1 - 1 ? 1 : 2;
      for (let o = -w; o <= w; o++)
        a.px(Math.round(bx + nx * o), Math.round(by + ny * o), grip ? '#4a3524' : '#c89a5e');
      if (!grip) a.px(Math.round(bx - nx * w), Math.round(by - ny * w), '#e8c08a');
    }
  }
  const BAT = (a, x, y) => batAt(a, x, y - 2, -1.05, 0, 11);
  /* Hurt carry: the bat swings down out of the flung hand rather than blinking
     out of existence. Shortened and steeply raked because the full 11px shaft
     off a raised fist runs clean off the right edge of a 32px frame. */
  const BAT_HURT = (a, x, y) => batAt(a, x, y, 1.1, 0, 9);
  /* Medical bag. A plain white slab with a fat red mark on it reads as a
     placard being held up; the handle arc and the lid seam are what make it a
     bag hanging from a fist. */
  const BAG = (a, x, y) => {
    a.px(x - 1, y - 2, '#3a3e46'); a.px(x + 1, y - 2, '#3a3e46');   // handle
    a.px(x, y - 3, '#3a3e46');
    a.rect(x - 3, y - 1, x + 3, y + 4, '#d8dce4');
    a.rect(x - 3, y - 1, x + 3, y - 1, '#ffffff');
    a.rect(x - 3, y, x + 3, y, '#8f96a4');                          // lid seam
    a.rect(x - 3, y + 4, x + 3, y + 4, '#8f96a4');
    a.rect(x, y + 1, x, y + 3, '#d43f3f');
    a.rect(x - 2, y + 2, x + 2, y + 2, '#d43f3f');
    a.px(x, y + 1, '#ff8a8a');
  };
  /* Muzzle flash as a cone with side flares. A filled disc at the barrel reads
     as a ball being held out in front of the gun. */
  function muzzle(a, x, y, len) {
    for (let d = 0; d < len; d++) {
      const w = Math.max(0, Math.round(len * 0.45 * (1 - d / len)));
      a.rect(x + d, y - w, x + d, y + w, d * 2 < len ? '#ffffff' : '#ffd24a');
    }
    const f = Math.round(len * 0.45) + 1;
    a.px(x, y - f, '#ffd24a'); a.px(x, y + f, '#ffd24a');
  }



  /* Aim/fire share one raised-arm painter so the muzzle sits in exactly the
     same place in both states — a gun that jumps between aim and fire reads as
     two different weapons. */
  /* ax/ay are the FIST. Everything else — forearm, weapon, muzzle flash — is
     measured off it, so aim and fire cannot disagree about where the barrel
     is. The first cut placed the flash at a hard-coded y=19 while the raised
     gun sat at y=10, and it read as a lit match dropped beside the soldier. */
  /* AIM_AY is four rows below the shoulder on purpose. Level with the
     shoulder the barrel runs straight through the chin and the figure reads as
     biting the rifle; four rows down it passes in front of the chest. */
  const AIM_X = 22, AIM_SH = 8, AIM_AY = AIM_SH + 4;   // hip 20 + lift -1 => sh 8
  const aimGeom = (sh, kick) => ({ ax: AIM_X + kick, ay: sh + 4 });
  const aimArm = (pal, gun, kick) => (a, sh) => {
    const g = aimGeom(sh, kick);
    a.line(20, sh + 3, g.ax, g.ay, pal.shirt, 2);
    a.line(20, sh + 3, g.ax, g.ay, pal.shirtHi, 1);
    a.rect(g.ax - 1, g.ay - 1, g.ax + 1, g.ay + 1, pal.skin);
    gun(a, g.ax, g.ay + 1);
  };

  function gunSuite(pal, name, kit) {
    const carry = kit.carry, aim = kit.aim, reach = kit.reach;
    return {
      width: 32, height: 32, name, layers: [{ name: 'figure' }],
      states: [
        idleState(pal, carry),
        walkState(pal, carry),
        walkState(pal, carry, 'run', 13, 3, { hunch: 1 }),
        D('aim', 8, false, seq(3, 8, (a, i) => personRig(a, pal, {
          hip: 20, lift: -1, swing: -0.8, arm: aimArm(pal, aim, i) }))),
        D('fire', 12, false, seq(3, 12, (a, i) => {
          // one frame of recoil: the arm snaps back, then returns
          const kick = [0, -2, -1][i];
          personRig(a, pal, { hip: 20, lift: -1, swing: -0.8, arm: aimArm(pal, aim, kick) });
          if (i === 0) muzzle(a, AIM_X + kick + reach, AIM_AY, 4);
        })),
        hurtState(pal, carry),
        downState(pal, carry)
      ]
    };
  }

  const soldierSuite = () => gunSuite(SOLDIER, 'Soldier', { carry: RIFLE, aim: RIFLE_LEVEL, reach: 4 });
  const policeSuite = () => gunSuite(POLICE, 'Police Officer', { carry: PISTOL, aim: PISTOL_LEVEL, reach: 5 });

  function medicSuite() {
    return {
      width: 32, height: 32, name: 'Paramedic', layers: [{ name: 'figure' }],
      states: [
        idleState(MEDIC, BAG),
        walkState(MEDIC, BAG),
        walkState(MEDIC, BAG, 'run', 13, 3, { hunch: 1 }),
        /* A kneeling medic working an open kit on the ground. Two full
           figures will not fit legibly in a 32x32 cell — the first cut drew a
           casualty lying under the medic and the two dissolved into one grey
           smear with a head stuck on the end of it. One figure plus one prop
           reads; two figures do not. */
        D('treat', 6, true, cyc(4, 6, (a, i) => {
          const push = [0, 1, 2, 1][i];
          // ---- open kit on the ground, lid standing up behind the hands ----
          a.rect(21, 17, 29, 21, '#9aa1ae');                 // raised lid, inside face
          a.rect(21, 17, 29, 17, '#d8dce4');
          a.rect(25, 18, 25, 20, '#d43f3f');
          a.rect(23, 19, 27, 19, '#d43f3f');
          a.rect(21, 22, 29, 27, '#d8dce4');                 // kit body
          a.rect(21, 22, 29, 22, '#ffffff');
          a.rect(21, 27, 29, 27, '#8f96a4');
          a.rect(22, 24, 24, 26, '#c8a07a');                 // rolled bandage
          a.rect(22, 24, 24, 24, '#e4bd96');
          a.rect(26, 23, 27, 26, '#3fc46a');                 // phial
          a.px(26, 23, '#a4f2b8');
          // ---- the medic, kneeling side-on ----
          a.rect(8, 23, 19, 27, MEDIC.legSh);                // shin along the ground
          a.rect(8, 23, 19, 23, MEDIC.leg);
          a.rect(6, 24, 9, 27, MEDIC.shoe);
          a.rect(6, 27, 9, 27, MEDIC.shoeSh);
          a.ellipse(10, 12 + push, 20, 24, MEDIC.shirt, true);
          a.ellipse(11, 12 + push, 18, 15 + push, MEDIC.shirtHi, true);
          a.rect(15, 15 + push, 15, 20 + push, MEDIC.cross);
          a.rect(13, 17 + push, 17, 17 + push, MEDIC.cross);
          a.px(15, 15 + push, MEDIC.crossHi);
          a.rect(13, 21, 19, 22, MEDIC.belt);
          a.ellipse(10, 5 + push, 18, 13 + push, MEDIC.skin, true);
          a.ellipse(11, 5 + push, 16, 9 + push, MEDIC.skinHi, true);
          a.ellipse(10, 4 + push, 18, 7 + push, MEDIC.hair, true);
          a.ellipse(11, 4 + push, 14, 5 + push, MEDIC.hairHi, true);
          a.px(10, 8 + push, MEDIC.hair);
          a.rect(13, 9 + push, 17, 9 + push, MEDIC.brow);
          a.px(14, 10 + push, MEDIC.eye); a.px(17, 10 + push, MEDIC.eye);
          a.rect(14, 12 + push, 15, 12 + push, MEDIC.mouth);
          // both arms out to the kit, dipping with the bob
          a.rect(19, 14 + push, 22, 16 + push, MEDIC.shirt);
          a.rect(19, 14 + push, 22, 14 + push, MEDIC.shirtHi);
          a.rect(20, 16 + push, 22, 19 + push, MEDIC.shirtSh);
          a.rect(20, 19 + push, 22, 21 + push, MEDIC.skin);
          a.rect(20, 21 + push, 22, 21 + push, MEDIC.skinSh);
        })),
        hurtState(MEDIC, BAG),
        downState(MEDIC, BAG)
      ]
    };
  }

  function survivorSuite() {
    return {
      width: 32, height: 32, name: 'Survivor', layers: [{ name: 'figure' }],
      states: [
        idleState(SURVIVOR, BAT),
        walkState(SURVIVOR, BAT),
        walkState(SURVIVOR, BAT, 'run', 13, 3, { hunch: 1 }),
        /* A bat swing needs the arc drawn, not implied: the bat sweeps from
           high-right down to the floor across four frames while the hips
           counter-rotate, so the figure is visibly throwing its weight into it.

           The arc is struck from (16,13) with a hard 12px reach, NOT from the
           shoulder with a longer bat. A 32px frame only affords ten rows above
           the shoulder, so a genuinely overhead swing puts the tip off the top
           of the buffer and the outline pass can no longer close around it —
           and swinging it out from the shoulder runs the barrel off the right
           edge instead. The forearm is then drawn from the real shoulder to
           wherever the arc put the hand, which keeps the limb attached. */
        D('swing', 14, false, seq(4, 14, (a, i) => {
          /* Arc ends at 0.86 rad, not past it: swung further the follow-through
             lays the barrel across the near leg and the two read as one shape. */
          const ang = -1.0 + i * 0.62, cx = 16, cy = 13;
          personRig(a, SURVIVOR, { hip: 20, lift: i < 2 ? -1 : 0, swing: -1.2 + i * 0.8,
            arm: (b, sh) => {
              const hx = Math.round(cx + Math.cos(ang) * 5), hy2 = Math.round(cy + Math.sin(ang) * 5);
              b.line(20, sh + 3, hx, hy2, SURVIVOR.shirt, 2);
              b.line(20, sh + 3, hx, hy2, SURVIVOR.shirtHi, 1);
              b.rect(hx - 1, hy2 - 1, hx + 1, hy2 + 1, SURVIVOR.skin);
              batAt(b, cx, cy, ang, 4, 13);
            } });
        })),
        hurtState(SURVIVOR, BAT_HURT),
        downState(SURVIVOR, BAT)
      ]
    };
  }

  function zombieSuite() {
    const pal = ZOMBIE;
    /* Arms out front is the entire silhouette read for a shambler. Both of
       them, at slightly different heights, so the pose never looks symmetrical
       enough to read as a diving board. */
    /* Sleeve to the elbow, bare forearm past it, splayed fingers at the tip.
       Run in one shirt tone from shoulder to fingertip the arm reads as a
       length of scaffolding pipe rather than a limb. */
    const reach = drop => (a, sh) => {
      a.rect(20, sh + 2, 23, sh + 4 + drop, pal.shirt);
      a.rect(20, sh + 2, 23, sh + 2 + drop, pal.shirtHi);
      a.rect(23, sh + 3 + drop, 27, sh + 4 + drop, pal.skin);
      a.rect(23, sh + 4 + drop, 27, sh + 4 + drop, pal.skinSh);
      a.rect(28, sh + 2 + drop, 29, sh + 2 + drop, pal.skin);   // splayed fingers
      a.rect(28, sh + 4 + drop, 29, sh + 4 + drop, pal.skinSh);
      a.rect(28, sh + 3 + drop, 30, sh + 3 + drop, pal.skin);
    };
    /* Rot passes over the torso last so the tears sit on top of the shirt
       shading rather than under it. Without them the shambler's body is a clean
       grey vest and only the head says anything is wrong. */
    const rot = (a, sh) => {
      a.rect(13, sh + 5, 15, sh + 6, pal.shirtSh);
      a.px(14, sh + 5, '#4a1c1c');
      a.rect(17, sh + 2, 18, sh + 2, pal.shirtSh);
      a.px(12, sh + 8, pal.shirtSh);
    };
    const farArm = (a, sh, drop) => {
      a.rect(9, sh + 4, 13, sh + 6 + drop, pal.shirtSh);
      a.rect(13, sh + 5 + drop, 17, sh + 6 + drop, pal.skinSh);
      a.px(18, sh + 5 + drop, pal.skinSh);
    };
    const shamble = (a, i) => {
      const drop = [0, 1, 1, 0, -1, -1][i];
      personRig(a, pal, { hip: 20 - (i % 2), hunch: 1, swing: Math.sin((i / 6) * TAU) * 2,
        arm: (b, sh, hip, up) => { farArm(b, sh, drop); rot(b, sh); reach(drop)(b, sh, hip, up); } });
    };
    return {
      width: 32, height: 32, name: 'Shambler', layers: [{ name: 'figure' }],
      states: [
        D('idle', 4, true, cyc(4, 4, (a, i) => {
          const drop = [0, 1, 0, -1][i];
          personRig(a, pal, { hunch: 1, lift: Math.round(Math.sin((i / 4) * TAU)),
            arm: (b, sh, hip, up) => { farArm(b, sh, drop); rot(b, sh); reach(drop)(b, sh, hip, up); } });
        })),
        D('walk', 7, true, cyc(6, 7, shamble)),
        /* The lunge is a whole-body throw: the torso pitches out over the lead
           foot and the jaw opens. A shambler that only extends its arms further
           is indistinguishable from the walk. */
        D('lunge', 12, false, seq(4, 12, (a, i) => {
          const push = [0, -1, 3, 1][i];
          personRig(a, pal, { hip: 20, hunch: 2, lift: [0, -1, 1, 0][i], swing: -2 + i * 0.9,
            arm: (b, sh) => {
              b.rect(20, sh + 1, 23, sh + 3, pal.shirt);
              b.rect(20, sh + 1, 23, sh + 1, pal.shirtHi);
              b.rect(23, sh + 1, 27 + push, sh + 3, pal.skin);
              b.rect(23, sh + 3, 27 + push, sh + 3, pal.skinSh);
              b.rect(27 + push, sh, 29 + push, sh + 1, pal.skin);   // splayed fingers
              b.rect(27 + push, sh + 3, 29 + push, sh + 3, pal.skin);
              b.px(29 + push, sh, pal.skinSh);
              rot(b, sh);
              b.rect(9, sh + 3, 14, sh + 5, pal.shirtSh);
              b.rect(14, sh + 4, 18, sh + 5, pal.skinSh);
            } });
          if (i >= 2) { a.rect(15, 11, 18, 12, '#4a1c1c'); a.px(16, 12, '#d8dce4'); }
        })),
        hurtState(pal, null),
        downState(pal, null)
      ]
    };
  }

  /* ============================================================ VEHICLES ===
     Top-down, nose up. Every vehicle is built from the same four reads: tyres
     that stick out past the bodywork, a body plate with a lit left flank, dark
     glass, and lamps at both ends. Drop any one and a top-down car collapses
     back into a rounded rectangle. */
  function tyres(a, x0, x1, ys) {
    for (const y of ys) for (const x of [x0 - 2, x1 + 1]) {
      a.rect(x, y, x + 1, y + 3, '#15161c');
      a.rect(x, y, x + 1, y, '#2b2d36');
      a.px(x < 16 ? x + 1 : x, y + 1, '#4a4f59');
    }
  }
  function shell(a, x0, y0, x1, y1, base, lit, dark) {
    // corners knocked off by insetting the outer rows/cols by one
    a.rect(x0, y0 + 1, x1, y1 - 1, base);
    a.rect(x0 + 1, y0, x1 - 1, y1, base);
    a.rect(x0 + 1, y0 + 1, x0 + 2, y1 - 1, lit);
    a.rect(x1 - 1, y0 + 1, x1, y1 - 1, dark);
  }
  function pane(a, x0, y0, x1, y1) {
    a.rect(x0, y0, x1, y1, '#1b2634');
    a.rect(x0, y0, x1, y0, '#31465c');
    a.rect(x0, y0, x0 + 1, y1, '#456379');
  }
  const headLamp = (a, x, y) => { a.rect(x, y, x + 2, y + 1, '#ffe9a0'); a.px(x, y, '#ffffff'); };
  const tailLamp = (a, x, y) => { a.rect(x, y, x + 2, y + 1, '#8f2730'); a.px(x + 2, y + 1, '#ff6b6b'); };
  /* Emergency bar. The flash has to move colour ACROSS the bar, not just blink
     it on and off: a bar that strobes in place reads as a broken pixel. */
  function lightBar(a, x0, x1, y, phase) {
    const mid = (x0 + x1) >> 1;
    a.rect(x0, y, x1, y + 1, '#1c1c22');
    a.rect(x0, y, mid, y + 1, phase ? '#ff3b3b' : '#5c1f24');
    a.rect(mid + 1, y, x1, y + 1, phase ? '#1e2f5c' : '#4d9bff');
    a.rect(x0, y, mid, y, phase ? '#ff9a9a' : '#3a1418');
    a.rect(mid + 1, y, x1, y, phase ? '#141d38' : '#b8d8ff');
    // spill onto the roof so the flash lights something
    a.rect(x0 - 1, y - 1, mid, y - 1, phase ? '#6e2a2f' : '#3a3b45');
    a.rect(mid + 1, y - 1, x1 + 1, y - 1, phase ? '#3a3b45' : '#2f4a72');
  }

  function vehicleSuite() {
    const sedanKit = (a, body, lit, dark) => {
      tyres(a, 9, 22, [6, 20]);
      shell(a, 9, 3, 22, 28, body, lit, dark);
      a.rect(10, 5, 21, 8, dark);                        // bonnet shadow
      a.rect(10, 5, 21, 5, lit);
      pane(a, 11, 9, 20, 12);
      a.rect(10, 13, 21, 18, lit);                       // roof
      a.rect(10, 13, 21, 13, body);
      a.rect(10, 18, 21, 18, dark);
      pane(a, 11, 19, 20, 22);
      a.rect(10, 23, 21, 26, dark);
      headLamp(a, 10, 3); headLamp(a, 19, 3);
      tailLamp(a, 10, 27); tailLamp(a, 19, 27);
      a.rect(8, 10, 8, 11, dark); a.rect(23, 10, 23, 11, dark);   // mirrors
      a.rect(12, 3, 19, 3, dark);                                 // grille
    };
    const boxKit = (a, body, lit, dark, noseY) => {
      tyres(a, 8, 23, [7, 21]);
      shell(a, 8, noseY, 23, 29, body, lit, dark);
      a.rect(9, noseY + 1, 22, noseY + 2, dark);
      pane(a, 10, noseY + 3, 21, noseY + 6);
      a.rect(9, noseY + 7, 22, 27, lit);
      a.rect(9, noseY + 7, 22, noseY + 7, body);
      a.rect(9, 27, 22, 27, dark);
      headLamp(a, 9, noseY); headLamp(a, 20, noseY);
      tailLamp(a, 9, 28); tailLamp(a, 20, 28);
      a.rect(7, noseY + 4, 7, noseY + 5, dark); a.rect(24, noseY + 4, 24, noseY + 5, dark);
    };
    return {
      width: 32, height: 32, name: 'City Vehicles', layers: [{ name: 'vehicle' }],
      states: [
        D('sedan', 1, false, still(a => { sedanKit(a, '#b43a3a', '#d96060', '#7a2020');
          a.rect(12, 24, 19, 25, '#8f2730'); a.rect(13, 14, 18, 17, '#d96060'); })),
        D('taxi', 1, false, still(a => { sedanKit(a, '#e0b032', '#ffd66a', '#9c7616');
          // checker band across the doors reads as a taxi faster than any decal
          for (let x = 10; x <= 21; x++) a.rect(x, 14, x, 15, (x & 1) ? '#20222a' : '#f2e6c8');
          a.rect(13, 11, 18, 12, '#20222a'); a.rect(14, 11, 17, 11, '#ffd66a'); })),
        D('police', 6, true, cyc(4, 6, (a, i) => {
          sedanKit(a, '#e4e8ef', '#ffffff', '#8f96a4');
          a.rect(9, 13, 21, 18, '#1d3a7a');              // door panel
          a.rect(9, 13, 21, 13, '#3a5da8');
          a.rect(11, 15, 19, 16, '#e4e8ef');
          lightBar(a, 11, 20, 16, i % 2 === 0);
        })),
        D('ambulance', 6, true, cyc(4, 6, (a, i) => {
          boxKit(a, '#e4e8ef', '#ffffff', '#8f96a4', 3);
          a.rect(9, 16, 22, 18, '#d43f3f');
          a.rect(9, 16, 22, 16, '#ff8a8a');
          a.rect(14, 20, 17, 26, '#d43f3f');
          a.rect(11, 22, 20, 24, '#d43f3f');
          lightBar(a, 11, 20, 5, i % 2 === 1);
        })),
        D('van', 1, false, still(a => { boxKit(a, '#5b7fa8', '#83a8cf', '#35516e', 3);
          a.rect(9, 12, 22, 26, '#4a6a8e');
          a.rect(9, 12, 22, 12, '#83a8cf');
          a.rect(15, 12, 16, 26, '#35516e');             // rear door split
          a.rect(9, 19, 22, 19, '#35516e'); })),
        D('pickup', 1, false, still(a => {
          tyres(a, 9, 22, [6, 20]);
          shell(a, 9, 3, 22, 28, '#4a6b4a', '#6f956f', '#2b4230');
          a.rect(10, 5, 21, 7, '#2b4230');
          pane(a, 11, 8, 20, 11);
          a.rect(10, 12, 21, 15, '#6f956f');
          /* Open bed: a sunken floor with a lip all the way round. Without the
             lip the bed is just a dark rectangle painted on the roof. */
          a.rect(10, 16, 21, 27, '#2b4230');
          a.rect(11, 17, 20, 26, '#1f3123');
          for (let y = 18; y < 26; y += 3) a.rect(11, y, 20, y, '#2b4230');
          a.rect(10, 16, 21, 16, '#6f956f'); a.rect(10, 27, 21, 27, '#3c5a40');
          headLamp(a, 10, 3); headLamp(a, 19, 3);
          tailLamp(a, 10, 28); tailLamp(a, 19, 28);
        })),
        D('bus', 1, false, still(a => {
          tyres(a, 7, 24, [6, 22]);
          shell(a, 7, 1, 24, 30, '#d8a02e', '#ffcc63', '#8f6512');
          a.rect(8, 2, 23, 3, '#8f6512');
          pane(a, 9, 4, 22, 7);
          for (let y = 9; y < 26; y += 5) { pane(a, 8, y, 13, y + 3); pane(a, 18, y, 23, y + 3); }
          a.rect(14, 9, 17, 26, '#ffcc63');
          a.rect(14, 9, 17, 9, '#d8a02e');
          a.rect(8, 27, 23, 29, '#8f6512');
          headLamp(a, 8, 1); headLamp(a, 21, 1);
          tailLamp(a, 8, 29); tailLamp(a, 21, 29);
        })),
        /* Top-down motorcycle. The first cut ran one dark slab from nose to
           tail and laid a solid wide bar across the top of it, and the whole
           thing read as a crucifix. What makes it a bike is the gaps: wheels
           set apart from the frame in a lighter tyre tone, bars that are two
           grips with air between them rather than a plate, and a tank that is
           WIDER than the seat behind it. */
        D('bike', 1, false, still(a => {
          a.rect(14, 4, 17, 10, '#2b2d36');              // front tyre
          a.rect(14, 4, 17, 4, '#1a1b21'); a.rect(14, 10, 17, 10, '#1a1b21');
          a.rect(15, 6, 16, 8, '#575c66');               // hub
          a.rect(13, 3, 18, 4, '#3a3e46');               // mudguard
          headLamp(a, 14, 2);
          a.px(17, 2, '#ffe9a0');
          a.rect(10, 11, 12, 12, '#3a3e46');             // bars: grips, not a plate
          a.rect(19, 11, 21, 12, '#3a3e46');
          a.rect(10, 11, 12, 11, '#6b7079');
          a.rect(19, 11, 21, 11, '#6b7079');
          a.rect(13, 11, 18, 12, '#575c66');             // clocks between the grips
          a.px(15, 12, '#1a1b21'); a.px(17, 12, '#1a1b21');
          a.px(9, 12, '#20222a'); a.px(22, 12, '#20222a');
          a.rect(12, 13, 19, 18, '#b43a3a');             // tank, wider than the seat
          a.rect(12, 13, 19, 13, '#d96060');
          a.rect(12, 14, 13, 18, '#d96060');
          a.rect(18, 14, 19, 18, '#8f2730');
          a.rect(14, 19, 17, 23, '#20222a');             // seat
          a.rect(14, 19, 17, 19, '#3a3e46');
          a.rect(19, 19, 21, 25, '#575c66');             // exhaust down the flank
          a.rect(19, 19, 19, 25, '#8a9099');
          a.rect(13, 24, 18, 26, '#b43a3a');             // tail cowl
          a.rect(13, 24, 18, 24, '#d96060');
          a.rect(14, 26, 17, 30, '#2b2d36');             // rear tyre
          a.rect(14, 26, 17, 26, '#1a1b21'); a.rect(14, 30, 17, 30, '#1a1b21');
          a.rect(15, 27, 16, 29, '#575c66');
          tailLamp(a, 14, 25);
        }))
      ]
    };
  }

  /* ============================================================== PROPS ===
     Street furniture. Everything stands on y25..27 so a prop dropped into a
     scene lines up with the cast without nudging. */
  function propSuite() {
    const CONC = '#8a8d94', CONC_L = '#a8acb4', CONC_D = '#63666e';
    const STEEL = '#4a4f59', STEEL_L = '#6b7079', STEEL_D = '#2b2d36';
    return {
      width: 32, height: 32, name: 'Street Props', layers: [{ name: 'prop' }],
      states: [
        D('streetlight', 4, true, cyc(4, 4, (a, i) => {
          const on = i !== 2;                            // one dropped frame = a failing lamp
          a.rect(11, 25, 20, 27, STEEL_D);
          a.rect(11, 25, 20, 25, STEEL_L);
          a.rect(14, 4, 16, 26, STEEL);
          a.rect(14, 4, 14, 26, STEEL_L);
          a.rect(16, 4, 16, 26, STEEL_D);
          a.rect(14, 3, 22, 4, STEEL);                   // arm
          a.rect(14, 3, 22, 3, STEEL_L);
          a.rect(20, 5, 24, 6, STEEL_D);                 // lamp housing
          a.rect(20, 5, 24, 5, STEEL_L);
          a.rect(21, 7, 23, 7, on ? '#fff6c9' : '#5a5b4a');
          if (on) {
            /* Cone of light as widening dithered rows. A solid wedge at this
               size reads as a traffic cone hung off the pole. */
            for (let d = 1; d <= 8; d++) {
              const w = 1 + d, y = 7 + d;
              for (let x = 22 - w; x <= 22 + w; x++)
                if ((x + y + (i & 1)) % (d < 4 ? 2 : 3) === 0) a.px(x, y, d < 5 ? '#e8d89a' : '#7a7458');
            }
          }
        })),
        D('trafficlight', 2, true, cyc(3, 2, (a, i) => {
          /* Six rows per lamp: one for the hood lip, five for the recess with
             a two-pixel-radius lens centred in it. Packed five rows apart the
             hood of each lamp cropped the bottom off the lens above it, and
             the bottom lamp spilled out through the base of the housing. */
          a.rect(11, 26, 20, 27, STEEL_D);               // base plate
          a.rect(11, 26, 20, 26, STEEL);
          a.rect(14, 23, 18, 26, STEEL);                 // short pole stub
          a.rect(14, 23, 14, 26, STEEL_L);
          a.rect(11, 3, 20, 23, STEEL_D);                // housing
          a.rect(12, 4, 19, 22, STEEL);
          a.rect(20, 3, 20, 23, '#1d1f26');              // far edge in shadow
          const lamps = [['#ff3b3b', '#ffb0b0'], ['#ffb02e', '#ffe09a'], ['#3fd45f', '#b0f2c0']];
          for (let k = 0; k < 3; k++) {
            const top = 4 + k * 6, cy = top + 3, lit = k === i;
            a.rect(12, top + 1, 19, top + 5, '#141820'); // recess
            a.rect(11, top, 20, top, STEEL_L);           // hood lip
            disc(a, 15.5, cy, 2, lit ? lamps[k][0] : '#252a33', lit ? lamps[k][1] : null);
            // glow bleeds sideways within the recess rather than upward: a block
            // of colour on the lip row leaves a square notch on top of the lens
            if (lit) { a.px(12, cy, lamps[k][0]); a.px(19, cy, lamps[k][0]); }
          }
        })),
        D('hydrant', 1, false, still(a => {
          a.rect(11, 26, 20, 27, '#7a1f1f');
          a.rect(11, 26, 20, 26, '#b43a3a');
          a.rect(13, 12, 18, 26, '#b43a3a');
          a.rect(13, 12, 14, 26, '#e06060');
          a.rect(18, 12, 18, 26, '#7a1f1f');
          a.rect(12, 15, 19, 17, '#d14a4a');             // collar
          a.rect(12, 15, 19, 15, '#e06060');
          a.rect(10, 17, 12, 20, '#b43a3a');             // side ports
          a.rect(19, 17, 21, 20, '#7a1f1f');
          a.rect(10, 17, 12, 17, '#e06060');
          disc(a, 15.5, 11, 3, '#d14a4a', '#e06060');
          a.rect(14, 8, 17, 9, '#8f96a4');               // bonnet nut
          a.px(15, 8, '#d8dce4');
        })),
        D('dumpster', 1, false, still(a => {
          a.rect(4, 24, 27, 27, '#1d1f26');
          a.rect(5, 9, 26, 25, '#2f6b4a');
          a.rect(5, 9, 7, 25, '#4a9169');
          a.rect(24, 9, 26, 25, '#1d4230');
          a.rect(4, 7, 27, 10, '#3c8159');               // lid
          a.rect(4, 7, 27, 7, '#63b489');
          a.rect(4, 10, 27, 10, '#1d4230');
          a.rect(15, 7, 16, 10, '#1d4230');              // lid split
          for (let x = 8; x < 24; x += 5) a.rect(x, 12, x, 24, '#1d4230');
          a.rect(5, 19, 26, 19, '#1d4230');
          for (const x of [7, 22]) { a.rect(x, 25, x + 2, 27, '#15161c'); a.px(x + 1, 26, '#4a4f59'); }
        })),
        D('bench', 1, false, still(a => {
          for (const x of [7, 21]) {
            a.rect(x, 17, x + 3, 27, '#2b2d36');
            a.rect(x, 17, x, 27, '#4a4f59');
          }
          for (let k = 0; k < 3; k++) {
            const y = 17 + k * 2;
            a.rect(5, y, 26, y + 1, '#8a5a2e');          // slats
            a.rect(5, y, 26, y, '#b8803f');
          }
          for (let k = 0; k < 3; k++) {
            const y = 8 + k * 3;
            a.rect(6, y, 25, y + 1, '#8a5a2e');          // backrest
            a.rect(6, y, 25, y, '#b8803f');
          }
          a.rect(6, 14, 25, 16, '#5e3c1c');
          a.rect(8, 8, 9, 17, '#2b2d36'); a.rect(22, 8, 23, 17, '#2b2d36');
        })),
        D('mailbox', 1, false, still(a => {
          a.rect(13, 22, 18, 27, '#2b2d36');
          a.rect(13, 22, 14, 27, '#4a4f59');
          a.rect(8, 8, 23, 23, '#1d3a7a');
          a.rect(8, 8, 10, 23, '#3a5da8');
          a.rect(21, 8, 23, 23, '#122a5e');
          a.rect(8, 5, 23, 9, '#2a4a92');                // domed top
          a.rect(9, 4, 22, 5, '#3a5da8');
          a.rect(11, 3, 20, 4, '#1d3a7a');
          a.rect(10, 12, 21, 15, '#101828');             // slot
          a.rect(10, 12, 21, 12, '#4a6fc0');
          a.rect(11, 18, 20, 20, '#d8dce4');
          a.rect(12, 19, 19, 19, '#1d3a7a');
        })),
        D('firebarrel', 10, true, cyc(4, 10, (a, i) => {
          /* Steel drum, shaded per column. The first cut filled the body with
             a dense two-tone speckle and it read as a wicker basket — rust has
             to be a few sparse patches on top of clean cylinder shading, not
             the shading itself. */
          for (let x = 10; x <= 21; x++) {
            a.rect(x, 13, x, 27, x < 12 ? '#7a5330' : x < 15 ? '#6b4a2e' : x < 19 ? '#54391f' : '#33220f');
          }
          for (const y of [17, 23]) {                    // hoops, proud of the body
            a.rect(9, y, 22, y + 1, '#3f2a19');
            a.rect(9, y, 22, y, '#93683f');
          }
          speck(a, 11, 14, 20, 26, 31, ['#8a4030', '#8a4030'], 0.14);
          a.rect(9, 12, 22, 13, '#2b1c10');              // open rim, overhanging
          a.rect(9, 12, 22, 12, '#4f3722');
          /* The fire is INSIDE the drum: a bright bed showing over the rim is
             what stops the flames reading as candles stuck to a lid. */
          const glow = 1 + Math.round(a.hash(0, i, 3) * 1);
          a.rect(11, 13 - glow, 20, 13, '#e0491f');
          a.rect(12, 13 - glow, 19, 13 - glow, '#ff8d3a');
          /* Tongues run WHITE at the base and cool to red at the tip, and lean
             further the higher they get. Hottest-at-the-tip is what made the
             first cut read as a row of birthday candles. */
          for (let k = 0; k < 4; k++) {
            const bx = 11 + k * 3, h = 6 + Math.round(a.hash(k, i, 5) * 5);
            const lk = (a.hash(k, i + 2, 9) - 0.5) * 6;
            for (let d = 0; d < h; d++) {
              /* Narrow bases and a short white core: at w=2 with a white
                 third the four tongues fuse into one slab across the rim and
                 the drum looks capped with snow. */
              const t = d / h, w = Math.max(0, Math.round((1 - t) * 1.4));
              const x = bx + Math.round(t * t * lk);
              a.rect(x - w, 12 - d, x + w, 12 - d,
                t < 0.16 ? '#fff6c9' : t < 0.45 ? '#ffd24a' : t < 0.75 ? '#ff8d3a' : '#e0491f');
            }
          }
          for (let k = 0; k < 4; k++) {                  // embers carried up
            const x = 11 + Math.round(a.hash(k, i + 3, 7) * 10);
            a.px(x, 4 - Math.round(a.hash(k, i + 9, 7) * 3), k % 2 ? '#ff8d3a' : '#ffd24a');
          }
        })),
        D('cone', 1, false, still(a => {
          /* Cone plus a barrier board: one cone alone at 32px leaves most of
             the cell empty and reads as an arrowhead. */
          a.rect(9, 25, 18, 27, '#e06a1f');
          a.rect(9, 25, 18, 25, '#ff9a4a');
          for (let d = 0; d < 12; d++) {
            const w = 4 - Math.round(d * 0.3), y = 24 - d;
            a.rect(14 - w, y, 14 + w, y, d > 4 && d < 8 ? '#f2e6c8' : '#e06a1f');
            a.px(14 - w, y, d > 4 && d < 8 ? '#ffffff' : '#ff9a4a');
          }
          a.rect(20, 18, 21, 27, '#4a4f59');
          a.rect(20, 18, 20, 27, '#6b7079');
          a.rect(18, 13, 29, 18, '#2b2d36');
          for (let x = 19; x <= 28; x++) for (let y = 14; y <= 17; y++)
            a.px(x, y, (x + y) % 6 < 3 ? '#e06a1f' : '#f2e6c8');
        }))
      ]
    };
  }

  /* ============================================================== LOOT ===
     Every item bobs on the same 4-frame curve so a row of pickups dropped into
     a scene shares one rhythm instead of pulsing against each other. */
  function itemSuite() {
    const bob = (name, painter) => D(name, 6, true, cyc(4, 6, (a, i) =>
      painter(P().offsetApi(a, 0, [0, -1, -2, -1][i]), i)));
    return {
      width: 32, height: 32, name: 'Urban Loot', layers: [{ name: 'item' }],
      states: [
        bob('pistol', a => {
          a.rect(5, 11, 26, 15, '#3a3e46');
          a.rect(5, 11, 26, 11, '#7d838f');
          a.rect(5, 15, 26, 15, '#1d1f26');
          a.rect(18, 12, 22, 13, '#20222a');                 // ejection port
          a.rect(5, 16, 19, 18, '#2f3238');
          a.rect(5, 16, 19, 16, '#575c66');
          /* Grip is raked, not vertical. A square block under the frame reads
             as a magazine sticking out of the wrong end. */
          for (let d = 0; d < 8; d++) {
            const x = 13 - Math.round(d * 0.45);
            a.rect(x, 19 + d, x + 5, 19 + d, '#4a3524');
            a.px(x, 19 + d, '#6d4f33'); a.px(x + 5, 19 + d, '#2a1d12');
          }
          a.rect(15, 19, 16, 20, '#2f3238');                 // trigger
          a.rect(14, 21, 20, 22, '#2f3238');
          a.rect(20, 18, 20, 21, '#2f3238');
          a.px(26, 12, '#9aa0aa');
        }),
        bob('rifle', a => {
          /* Receiver first, everything else hung off it. The first cut floated
             the optic a row clear of the body and stood the grip and the
             magazine side by side as two matching blocks, so the gun read as a
             plank with two magazines under it. */
          a.rect(1, 11, 9, 17, '#4a3524');                   // stock
          a.rect(1, 11, 9, 11, '#6d4f33');
          a.rect(1, 11, 2, 17, '#33240f');                   // buttplate
          a.rect(3, 16, 8, 17, '#33240f');                   // under the comb
          a.rect(8, 12, 23, 17, '#2f3238');                  // receiver
          a.rect(8, 12, 23, 12, '#575c66');
          a.rect(8, 17, 23, 17, '#1a1c22');
          a.rect(19, 13, 24, 16, '#20222a');                 // handguard, vented
          for (let x = 20; x <= 23; x += 2) a.rect(x, 14, x, 15, '#4a4f59');
          a.rect(24, 13, 30, 15, '#3a3e46');                 // barrel
          a.rect(24, 13, 30, 13, '#6b7079');
          a.rect(29, 12, 30, 16, '#20222a');                 // muzzle device
          a.px(30, 14, '#9aa0aa');
          a.rect(11, 9, 17, 11, '#3a3e46');                  // optic, sat on the rail
          a.rect(11, 9, 17, 9, '#6b7079');
          a.rect(12, 10, 13, 10, '#1a1c22');
          a.px(16, 10, '#ff6b6b');
          a.rect(13, 18, 15, 18, '#20222a');                 // trigger guard
          a.px(14, 19, '#1a1c22');
          for (let d = 0; d < 6; d++) {                      // grip, raked back
            const k = Math.round(d * 0.4);
            a.rect(10 - k, 18 + d, 13 - k, 18 + d, d < 1 ? '#6d4f33' : '#4a3524');
          }
          a.rect(16, 18, 20, 26, '#20222a');                 // magazine
          a.rect(16, 18, 17, 26, '#3a3e46');
          a.rect(16, 26, 20, 26, '#1a1c22');
        }),
        bob('ammo', a => {
          a.rect(5, 12, 26, 25, '#5c6b3a');
          a.rect(5, 12, 8, 25, '#7f9152');
          a.rect(23, 12, 26, 25, '#3a4423');
          a.rect(5, 12, 26, 13, '#8fa052');
          a.rect(5, 10, 26, 12, '#4a5730');                  // lid
          a.rect(5, 10, 26, 10, '#7f9152');
          a.rect(12, 8, 19, 10, '#3a4423');                  // handle
          a.rect(12, 8, 19, 8, '#6b7c45');
          a.rect(13, 9, 18, 9, '#22290f');
          a.rect(9, 16, 22, 21, '#3a4423');                  // stencil plate
          for (let k = 0; k < 4; k++) a.rect(11 + k * 3, 18, 12 + k * 3, 19, '#d8b23a');
          a.rect(5, 23, 26, 23, '#3a4423');
        }),
        bob('medkit', a => {
          a.rect(5, 11, 26, 25, '#e4e8ef');
          a.rect(5, 11, 8, 25, '#ffffff');
          a.rect(23, 11, 26, 25, '#9aa0aa');
          a.rect(5, 11, 26, 11, '#ffffff');
          a.rect(5, 25, 26, 25, '#8f96a4');
          a.rect(5, 16, 26, 17, '#b8bfcc');                  // clamshell seam
          a.rect(12, 8, 19, 11, '#c0c7d4');                  // handle
          a.rect(13, 9, 18, 10, '#6b7079');
          a.rect(13, 14, 18, 22, '#d43f3f');
          a.rect(9, 17, 22, 19, '#d43f3f');
          a.rect(13, 14, 18, 14, '#ff8a8a');
          a.rect(9, 17, 22, 17, '#ff8a8a');
          a.rect(3, 19, 5, 21, '#8f96a4');                   // latch
        }),
        bob('bandage', a => {
          /* A roll is a cylinder seen slightly from the side: a bright end
             disc, a shaded body and ONE loose tail. Two tails and it reads as
             a bow tied round a present. */
          a.rect(8, 11, 23, 24, '#e9e4d6');
          a.rect(8, 11, 10, 24, '#ffffff');
          a.rect(21, 11, 23, 24, '#b9b2a0');
          for (let y = 13; y < 24; y += 3) a.rect(8, y, 23, y, '#cfc8b6');
          disc(a, 9.5, 17.5, 3.2, '#f7f3e8', '#ffffff');
          disc(a, 9.5, 17.5, 1.4, '#c8c0ac');
          a.rect(19, 24, 27, 26, '#e9e4d6');                 // tail
          a.rect(19, 24, 27, 24, '#ffffff');
          a.rect(25, 26, 27, 27, '#cfc8b6');
          a.rect(14, 14, 17, 20, '#d43f3f');                 // cross band
          a.rect(12, 16, 19, 18, '#d43f3f');
          a.px(14, 16, '#ff8a8a');
        }),
        bob('radio', (a, i) => {
          a.rect(10, 8, 21, 27, '#3a3e46');
          a.rect(10, 8, 12, 27, '#6b7079');
          a.rect(19, 8, 21, 27, '#20222a');
          a.rect(10, 8, 21, 8, '#7d838f');
          a.rect(12, 11, 19, 15, '#101828');                 // display
          a.rect(12, 11, 19, 11, '#2f4256');
          a.rect(13, 13, 17, 13, '#3fd45f');
          a.rect(13, 12, 15, 12, '#2a8f42');
          for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++)
            a.rect(12 + c * 3, 18 + r * 3, 13 + c * 3, 19 + r * 3, '#2b2d36');
          a.rect(15, 5, 16, 8, '#20222a');                   // antenna
          a.rect(15, 3, 16, 5, '#4a4f59');
          a.px(15, 3, '#9aa0aa');
          a.px(18, 9, i % 2 ? '#ff3b3b' : '#5c1f24');        // transmit led
          a.rect(8, 12, 10, 18, '#2b2d36');                  // belt clip
        }),
        bob('flashlight', a => {
          a.rect(9, 13, 24, 19, '#2f3238');                  // barrel
          a.rect(9, 13, 24, 13, '#575c66');
          a.rect(9, 19, 24, 19, '#1a1c22');
          for (let x = 13; x < 21; x += 2) a.rect(x, 14, x, 18, '#20222a');   // knurling
          a.rect(24, 11, 28, 21, '#4a4f59');                 // head
          a.rect(24, 11, 28, 11, '#7d838f');
          a.rect(24, 21, 28, 21, '#20222a');
          a.rect(28, 12, 29, 20, '#ffe9a0');                 // lens
          a.rect(28, 14, 29, 17, '#ffffff');
          a.rect(6, 14, 9, 18, '#20222a');                   // tail cap
          a.px(7, 16, '#ff3b3b');
        }),
        bob('rations', a => {
          a.rect(9, 9, 22, 26, '#9aa0aa');                   // can body
          a.rect(9, 9, 11, 26, '#c8cdd6');
          a.rect(20, 9, 22, 26, '#6b7079');
          a.rect(8, 7, 23, 10, '#b5bac4');                   // rim
          a.rect(8, 7, 23, 7, '#e4e8ef');
          a.rect(8, 10, 23, 10, '#6b7079');
          a.rect(13, 8, 18, 9, '#8f96a4');                   // pull tab
          a.px(13, 8, '#e4e8ef');
          a.rect(8, 25, 23, 27, '#6b7079');
          a.rect(9, 14, 22, 22, '#b4562e');                  // label
          a.rect(9, 14, 22, 14, '#e07a48');
          a.rect(9, 22, 22, 22, '#7a331a');
          a.rect(12, 17, 19, 19, '#f2e6c8');
          a.rect(13, 18, 18, 18, '#b4562e');
        })
      ]
    };
  }

  /* ============================================================ TILESET ===
     16 city tiles on 64x64. Road surfaces and wall faces tile on 4px or 8px
     periods so every one of them repeats without a seam — a backdrop tile that
     shows its own edge is worse than no tile at all. */
  function tilesetSuite() {
    const cell = (api, cx, cy) => P().offsetApi(api, cx * 16, cy * 16);
    const AS = '#33363e', ASD = '#25272e', ASL = '#42464f';
    const CO = '#8a8d94', COL = '#a8acb4', COD = '#63666e';
    const PW = '#d8dce4', PY = '#d8b23a';
    const BR = '#8a4030', BRD = '#5e2a1f', BRL = '#a5543f', MO = '#6b6259';
    const GR = '#3f6b32', GRL = '#568a41', GRD = '#2a4a20';
    const paint = a => {
      const road = cell(a, 0, 0);
      road.rect(0, 0, 15, 15, AS);
      speck(road, 0, 0, 15, 15, 3, [ASD, ASL], 0.32);
      // hairline cracks: without them a repeated asphalt tile reads as felt
      road.line(2, 0, 5, 7, ASD, 1); road.line(5, 7, 3, 15, ASD, 1);
      road.line(11, 1, 13, 9, ASD, 1);

      const dash = cell(a, 1, 0);
      dash.rect(0, 0, 15, 15, AS);
      speck(dash, 0, 0, 15, 15, 5, [ASD, ASL], 0.32);
      dash.rect(7, 1, 8, 10, PY);
      dash.rect(7, 1, 7, 10, '#f0cf6a');

      const zebra = cell(a, 2, 0);
      zebra.rect(0, 0, 15, 15, AS);
      speck(zebra, 0, 0, 15, 15, 7, [ASD, ASL], 0.24);
      /* Two fat bars on an 8px period, not four thin ones on a 4px period,
         and the wear speckle confined to the paint. Speckled across the whole
         tile the light grey lands in the gaps too and the crossing reads as a
         scatter of white dashes rather than as painted bars. */
      for (let y = 0; y < 16; y += 8) {
        zebra.rect(0, y + 1, 15, y + 4, PW);
        zebra.rect(0, y + 1, 15, y + 1, '#ffffff');
        zebra.rect(0, y + 4, 15, y + 4, '#a9adb6');
        speck(zebra, 0, y + 1, 15, y + 4, 9, ['#a9adb6', '#c8ccd4'], 0.24);
      }

      /* Manhole plotted with a radius test and the ribs clipped to it. The
         ribs drawn as full-width rects would run off the cover and, because
         offsetApi does not clip, straight into the next tile. */
      const man = cell(a, 3, 0);
      man.rect(0, 0, 15, 15, AS);
      speck(man, 0, 0, 15, 15, 11, [ASD, ASL], 0.28);
      for (let y = 1; y <= 14; y++) for (let x = 1; x <= 14; x++) {
        const dx = x - 7.5, dy = y - 7.5, d = Math.sqrt(dx * dx + dy * dy);
        if (d > 6.4) continue;
        man.px(x, y, d > 5.4 ? '#635c4a' : y % 3 === 0 ? '#544d3d' : dx + dy < -4 ? '#4a4438' : '#3b3629');
      }
      man.px(5, 4, '#7b735e');

      const walk = cell(a, 0, 1);
      walk.rect(0, 0, 15, 15, CO);
      speck(walk, 0, 0, 15, 15, 13, [COD, COL], 0.24);
      walk.rect(0, 0, 15, 0, COD); walk.rect(0, 0, 0, 15, COD);
      walk.rect(1, 1, 15, 1, COL); walk.rect(1, 1, 1, 15, COL);
      walk.rect(0, 8, 15, 8, COD); walk.rect(8, 0, 8, 15, COD);
      walk.rect(0, 9, 15, 9, COL); walk.rect(9, 0, 9, 15, COL);

      const kerb = cell(a, 1, 1);
      kerb.rect(0, 0, 15, 8, CO);
      speck(kerb, 0, 0, 15, 7, 15, [COD, COL], 0.24);
      kerb.rect(0, 9, 15, 11, COL);
      kerb.rect(0, 9, 15, 9, '#c4c8d0');
      kerb.rect(0, 12, 15, 13, COD);
      kerb.rect(0, 14, 15, 15, AS);
      speck(kerb, 0, 14, 15, 15, 17, [ASD], 0.4);

      const grass = cell(a, 2, 1);
      grass.rect(0, 0, 15, 15, GR);
      speck(grass, 0, 0, 15, 15, 19, [GRD, GRL], 0.6);
      for (let k = 0; k < 8; k++) {
        const x = Math.floor(grass.hash(k, 2, 5) * 16), y = 2 + Math.floor(grass.hash(k, 3, 5) * 13);
        grass.rect(x, y - 2, x, y, GRL); grass.px(x, y - 2, '#6fa855');
      }

      const grav = cell(a, 3, 1);
      grav.rect(0, 0, 15, 15, '#6e675c');
      speck(grav, 0, 0, 15, 15, 21, ['#57514a', '#8a8275', '#3f3b35'], 0.9);
      for (let k = 0; k < 5; k++) {
        const x = 1 + Math.floor(grav.hash(k, 4, 5) * 13), y = 1 + Math.floor(grav.hash(k, 5, 5) * 13);
        grav.rect(x, y, x + 1, y + 1, '#9a9184'); grav.px(x, y, '#b5ab9c');
      }

      /* Brick courses are computed per pixel on a modulo so the half-brick
         offset wraps instead of starting a row at x = -2. */
      const brick = cell(a, 0, 2);
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
        const lx = (x + (Math.floor(y / 4) % 2) * 2) % 4, ly = y % 4;
        brick.px(x, y, ly === 3 || lx === 3 ? MO : ly === 0 ? BRL : ly === 2 ? BRD : BR);
      }
      speck(brick, 0, 0, 15, 15, 23, ['#7a3628', '#9c4a37'], 0.28);

      const win = cell(a, 1, 2);
      win.rect(0, 0, 15, 15, '#5a5f6a');
      speck(win, 0, 0, 15, 15, 25, ['#4a4f59', '#6b7079'], 0.2);
      for (let r = 0; r < 2; r++) for (let c = 0; c < 2; c++) {
        const x = 1 + c * 8, y = 1 + r * 8;
        win.rect(x, y, x + 5, y + 5, '#1f3a4c');
        win.rect(x, y, x + 5, y, '#2f5870');
        win.rect(x, y + 1, x + 1, y + 5, '#3f7a9c');
        win.px(x + 3, y + 2, '#6fb0cc');
        win.rect(x - 1, y + 6, x + 6, y + 6, '#3a3e46');
      }

      const shut = cell(a, 2, 2);
      for (let y = 0; y < 16; y++) {
        const p = y % 4;
        shut.rect(0, y, 15, y, p === 0 ? '#9aa0aa' : p === 1 ? '#7d838f' : p === 2 ? '#5b606a' : '#3f444d');
      }
      shut.rect(0, 0, 1, 15, '#4a4f59'); shut.rect(14, 0, 15, 15, '#4a4f59');
      shut.rect(1, 0, 1, 15, '#7d838f'); shut.rect(14, 0, 14, 15, '#2b2d36');
      speck(shut, 2, 0, 13, 15, 27, ['#6b7079', '#8a8f99'], 0.16);

      /* Diamond mesh on a 4px period, so the fence tiles seamlessly in both
         axes. The backdrop stays opaque: a transparent mesh would pick up a
         dark halo from the outline pass on every wire. */
      const fen = cell(a, 3, 2);
      fen.rect(0, 0, 15, 15, ASD);
      speck(fen, 0, 0, 15, 15, 29, [AS], 0.4);
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++)
        if ((x + y) % 4 === 0 || (x - y + 16) % 4 === 0) fen.px(x, y, '#7d838f');
      fen.rect(0, 0, 15, 1, '#9aa0aa'); fen.rect(0, 0, 15, 0, '#c0c7d4');
      fen.rect(6, 0, 7, 15, '#5b606a'); fen.rect(6, 0, 6, 15, '#9aa0aa');

      /* Shingle courses: 4px tiles, each course offset half a tile from the
         one above, with a dark butt line under every course. Flat banding
         under a 0.4-density speckle obliterated both and the tile read as bare
         dirt. Both periods divide 16 so the sheet still tiles. */
      const roof = cell(a, 0, 3);
      for (let y = 0; y < 16; y++) {
        const ry = y % 4, off = (Math.floor(y / 4) % 2) * 2;
        for (let x = 0; x < 16; x++) {
          const edge = ((x + off) % 4) === 0;
          roof.px(x, y, ry === 3 ? '#33281f' : edge ? '#3f3228'
            : ry === 0 ? '#75604e' : '#5a4a3e');
        }
      }
      speck(roof, 0, 0, 15, 15, 31, ['#4a3c31', '#6b5747'], 0.24);

      const pud = cell(a, 1, 3);
      pud.rect(0, 0, 15, 15, AS);
      speck(pud, 0, 0, 15, 15, 33, [ASD, ASL], 0.32);
      for (let y = 2; y <= 13; y++) for (let x = 1; x <= 14; x++) {
        const dx = (x - 7.5) / 7, dy = (y - 8) / 5.5;
        const d = dx * dx + dy * dy + pud.hash(x, y, 35) * 0.18 - 0.09;
        if (d > 1) continue;
        pud.px(x, y, d > 0.78 ? '#1d222c' : d > 0.35 ? '#27333f' : '#31465c');
      }
      for (let k = 0; k < 4; k++) pud.rect(4 + k, 6 + (k & 1), 6 + k, 6 + (k & 1), '#5a7f99');

      const drain = cell(a, 2, 3);
      drain.rect(0, 0, 15, 15, AS);
      speck(drain, 0, 0, 15, 15, 37, [ASD, ASL], 0.28);
      drain.rect(2, 3, 13, 12, '#2b2d36');
      drain.rect(2, 3, 13, 3, '#5b606a');
      drain.rect(3, 4, 12, 11, '#101014');
      for (let y = 5; y <= 10; y += 2) drain.rect(3, y, 12, y, '#4a4f59');
      drain.rect(2, 12, 13, 12, '#1d1f26');
      drain.px(3, 4, '#6b7079');

      const hedge = cell(a, 3, 3);
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
        const v = hedge.hash(x, y, 39);
        hedge.px(x, y, v > 0.82 ? '#6fa855' : v > 0.55 ? GRL : v > 0.25 ? GR : GRD);
      }
      /* Leaf clusters on a jittered 3x3 grid rather than six freely hashed
         rects. Free placement collided and butted two 3x2 blocks together into
         a shape that read as a letter C sat in the hedge. The grid also keeps
         every cluster clear of the cell edges — offsetApi does not clip, so a
         clump at local x=-1 would paint into the drain tile next door. */
      for (let k = 0; k < 9; k++) {
        const x = (k % 3) * 5 + 2 + Math.floor(hedge.hash(k, 6, 5) * 3);
        const y = Math.floor(k / 3) * 5 + 2 + Math.floor(hedge.hash(k, 7, 5) * 3);
        hedge.px(x, y - 1, '#6fa855'); hedge.px(x - 1, y, '#6fa855');
        hedge.px(x, y, '#8fc46e'); hedge.px(x + 1, y, '#6fa855');
        hedge.px(x, y + 1, GRD);
      }
    };
    return {
      width: 64, height: 64, name: 'City Tileset', layers: [{ name: 'tiles' }],
      states: [D('tiles', 1, false, still(paint))]
    };
  }

  return { soldierSuite, policeSuite, medicSuite, survivorSuite, zombieSuite,
    vehicleSuite, propSuite, itemSuite, tilesetSuite };
})();
