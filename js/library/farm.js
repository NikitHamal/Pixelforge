/* PixelForge Studio — farm / harvest pack.
   The cosy-farming-sim kit: a farmer on the shared humanoid rig, a barnyard of
   eight animals, five crops in five growth stages each, farm buildings, tools,
   produce and a sixteen-tile field sheet.

   Palette discipline: everything sits in a warm earth range — straw, soil,
   barn red, weathered timber — with green reserved for living plants. That is
   what lets a crop at stage 1 read as a seedling against tilled soil rather
   than disappearing into it.

   The crops are the reason this pack exists in this shape. A growth stage is a
   STATE, not a frame, so a game can hold a plot at stage 3 indefinitely and
   step it on a tick; packing the stages as frames of one animation would make
   the field flicker through its whole life cycle every second. */
window.PF = window.PF || {};
PF.Farm = (() => {
  const R = PF.Rig;
  const P = R.P, D = R.D, ms = R.ms, draw = R.draw;
  const seq = R.seq, cyc = R.cyc, still = R.still, TAU = R.TAU;
  const speck = R.speck, disc = R.disc;
  const lit = R.lit, dim = R.dim;
  const personRig = R.person;
  const idleState = R.idleState, walkState = R.walkState;
  const hurtState = R.hurtState, downState = R.downState;

  /* ============================================================== FARMER ===
     One palette, one hat painter, and the shared rig does the rest. */
  const FARMER = {
    brow: '#7a4a2a', eye: '#231a14', mouth: '#8a5a44',
    skin: '#d9a173', skinHi: '#f2c095', skinSh: '#9c6a42',
    shirt: '#b4483c', shirtHi: '#d9695c', shirtSh: '#7a2b23',
    vest: '#3a5077', vestHi: '#54709e', vestSh: '#233255',
    leg: '#3a5077', legSh: '#233255', shoe: '#5a3b22', shoeSh: '#33210f',
    belt: '#5a3b22', beltDark: '#33210f',
    hair: '#6d4b34', hairHi: '#8f6547', hairSh: '#46301f',
    gear: (a, hy) => {
      /* Straw hat. The brim runs past the head on BOTH sides and sits at
         hy-2 — a wide brim carried down to the eye line turns the whole face
         into a shadow, and a brim no wider than the skull is a bowl. */
      a.rect(9, hy - 2, 23, hy - 1, '#c9a24a');
      a.rect(9, hy - 2, 23, hy - 2, '#e8c878');
      a.px(9, hy - 1, '#8f6c28'); a.px(23, hy - 1, '#8f6c28');
      a.ellipse(12, hy - 5, 20, hy - 2, '#c9a24a', true);
      a.ellipse(13, hy - 5, 17, hy - 4, '#e8c878', true);
      a.rect(12, hy - 3, 20, hy - 3, '#8f6c28');            // hatband
    }
  };

  /* A long-handled tool struck along an arc, thickness perpendicular to the
     shaft so it stays a tool at every swing angle. `head` paints the business
     end in the arc's own frame of reference. */
  function toolArc(a, cx, cy, ang, d0, d1, head) {
    const ux = Math.cos(ang), uy = Math.sin(ang);
    const nx = -uy, ny = ux;
    for (let d = d0; d <= d1; d++) {
      const bx = cx + ux * d, by = cy + uy * d;
      // two pixels thick measured PERPENDICULAR to the shaft: thickened along
      // x instead, a raked handle rasterises into a stepped ribbon
      a.px(Math.round(bx), Math.round(by), '#8a6340');
      a.px(Math.round(bx + nx), Math.round(by + ny), '#46301f');
    }
    head(Math.round(cx + ux * d1), Math.round(cy + uy * d1), nx, ny, ux, uy);
  }

  const HOE_HEAD = a => (x, y, nx, ny, ux, uy) => {
    /* The blade hangs off the end of the shaft at right angles and is three
       pixels deep. In line with the shaft a hoe reads as a broom; one pixel
       deep the blade vanishes under the outline pass. */
    for (let o = -3; o <= 3; o++) {
      for (let k = 0; k <= 2; k++) {
        a.px(Math.round(x + nx * o + ux * k), Math.round(y + ny * o + uy * k),
          k === 0 ? '#b0b6bf' : k === 2 ? '#4a4f58' : '#8a9099');
      }
    }
  };

  /* Watering can drawn from the fist: body, spout angled down-forward and a
     handle over the top. Without the handle arc the can is a kettle. */
  const CAN = (a, x, y) => {
    a.rect(x - 4, y - 5, x + 1, y, '#6b7079');
    a.rect(x - 4, y - 5, x + 1, y - 5, '#9aa0aa');
    a.rect(x - 4, y - 5, x - 4, y, '#9aa0aa');
    a.rect(x - 4, y, x + 1, y, '#3a3e46');
    a.px(x - 3, y - 7, '#6b7079'); a.px(x - 1, y - 7, '#6b7079');   // handle
    a.rect(x - 3, y - 8, x - 1, y - 8, '#6b7079');
    a.rect(x + 2, y - 4, x + 4, y - 2, '#6b7079');                  // spout
    a.rect(x + 4, y - 3, x + 5, y - 1, '#4a4f59');
    a.rect(x + 4, y - 3, x + 5, y - 3, '#9aa0aa');                  // rose
  };

  /* Hand sickle: what the farmhand carries when they are not doing anything
     else. It has to be SMALL. The first cut hung a shouldered grain sack off
     the fist and the sack covered the bib, the belt and half the torso, so
     every idle and walk frame read as a bag with legs. */
  const SICKLE = (a, x, y) => {
    a.rect(x - 1, y - 1, x, y + 3, '#6d4b34');                      // grip
    a.px(x - 1, y - 1, '#8f6547');
    a.px(x - 1, y + 3, '#46301f');
    /* The blade sweeps through about a third of a circle and thins toward the
       tip. Run at constant width through a half circle it closes up into a
       ring and the tool reads as a meat hook. */
    for (let d = 0; d <= 8; d++) {
      const t = d / 8, ang = -1.5 + t * 1.9, r = 4.5;
      a.px(Math.round(x + Math.cos(ang) * r), Math.round(y - 1 + Math.sin(ang) * r), '#c2c8d2');
      if (t < 0.7) a.px(Math.round(x + Math.cos(ang) * (r - 1)), Math.round(y - 1 + Math.sin(ang) * (r - 1)), '#6b7079');
    }
  };

  function farmerSuite() {
    return {
      width: 32, height: 32, name: 'Farmer', layers: [{ name: 'figure' }],
      states: [
        idleState(FARMER, SICKLE),
        walkState(FARMER, SICKLE),
        walkState(FARMER, SICKLE, 'run', 13, 3, { hunch: 1 }),
        /* Hoeing is a whole-body movement: the hoe comes up over the shoulder
           and drives down past the knee while the hips counter-rotate. The arc
           is struck from a fixed centre rather than from the shoulder so a
           long handle cannot run off the top of a 32px cell. */
        D('hoe', 10, false, seq(4, 10, (a, i) => {
          /* Arc starts at -1.0 rad, not -1.15, and the shaft stops at d=10.
             Raised any further the blade's perpendicular spread paints on row
             0 and the outline pass cannot close around it. */
          const ang = -1.0 + i * 0.62, cx = 16, cy = 13;
          personRig(a, FARMER, {
            hip: 20, lift: i < 2 ? -1 : 0, swing: -1.4 + i * 0.9,
            arm: (b, sh) => {
              const hx = Math.round(cx + Math.cos(ang) * 6), hy2 = Math.round(cy + Math.sin(ang) * 6);
              b.line(20, sh + 3, hx, hy2, FARMER.shirt, 2);
              b.line(20, sh + 3, hx, hy2, FARMER.shirtHi, 1);
              b.rect(hx - 1, hy2 - 1, hx + 1, hy2 + 1, FARMER.skin);
              toolArc(b, cx, cy, ang, 4, 10, HOE_HEAD(b));
            } });
          if (i === 3) {                                   // clods kicked up on impact
            for (let k = 0; k < 4; k++) {
              const x = 20 + Math.round(a.hash(k, 1, 5) * 7);
              a.px(x, 24 - Math.round(a.hash(k, 2, 5) * 3), k % 2 ? '#6b4a2e' : '#93683f');
            }
          }
        })),
        /* Watering tilts the can and streams from the rose. The stream has to
           be drawn as separate droplets that MOVE between frames — a static
           line from spout to soil reads as a rod propping the can up. */
        D('water', 8, true, cyc(4, 8, (a, i) => {
          personRig(a, FARMER, { hip: 20, lift: i % 2 === 0 ? 0 : -1, swing: -0.6,
            arm: (b, sh) => {
              const ax = 23, ay = sh + 5;
              b.line(20, sh + 3, ax, ay, FARMER.shirt, 2);
              b.line(20, sh + 3, ax, ay, FARMER.shirtHi, 1);
              b.rect(ax - 1, ay - 1, ax + 1, ay + 1, FARMER.skin);
              CAN(b, ax, ay + 1);
              for (let k = 0; k < 4; k++) {
                const t = ((k + i) % 4) / 4;
                b.px(28 + Math.round(t * 2), ay + 1 + Math.round(t * 12), '#6fb8e8');
                b.px(29 + Math.round(t * 2), ay + 3 + Math.round(t * 12), '#a9dcf7');
              }
            } });
          a.rect(27, 26, 31, 27, '#3f6d4a');               // watered patch darkens
        })),
        /* Carry is the walk with both arms forward under a crate. Hands under
           the load, not beside it — a crate level with the chest with the arms
           at the sides reads as a signboard being worn. */
        D('carry', 9, true, cyc(6, 9, (a, i) => {
          personRig(a, FARMER, {
            hip: 20 - (i % 2), swing: Math.sin((i / 6) * TAU) * 1.6,
            arm: (b, sh) => {
              b.rect(19, sh + 3, 24, sh + 5, FARMER.shirt);
              b.rect(19, sh + 3, 24, sh + 3, FARMER.shirtHi);
              b.rect(9, sh + 3, 13, sh + 5, FARMER.shirtSh);
              /* The crate rides at CHEST height. Level with the shoulders it
                 covers the chin and the farmhand reads as a headless box on
                 legs; the heaped produce has to clear the jaw, not the eyes. */
              const cy = sh + 7 - (i % 2);
              b.rect(10, cy - 4, 23, cy + 2, '#8f6547');   // crate
              b.rect(10, cy - 4, 23, cy - 4, '#b9895f');
              b.rect(10, cy + 2, 23, cy + 2, '#5a3b22');
              for (let x = 13; x <= 21; x += 4) b.rect(x, cy - 3, x, cy + 1, '#5a3b22');
              b.rect(11, cy - 6, 15, cy - 4, '#d94f3a');   // produce heaped over the rim
              b.rect(11, cy - 6, 13, cy - 6, '#ff7a63');
              b.rect(17, cy - 6, 22, cy - 4, '#e8a83a');
              b.rect(17, cy - 6, 19, cy - 6, '#ffd46a');
              b.rect(10, cy + 3, 13, cy + 5, FARMER.skin);
              b.rect(20, cy + 3, 23, cy + 5, FARMER.skin);
            } });
        })),
        hurtState(FARMER, SICKLE),
        downState(FARMER, SICKLE)
      ]
    };
  }

  /* ============================================================= ANIMALS ===
     One scaffold for the whole barnyard: body ellipse, four legs in two pairs
     with the far pair two tones down, and painter hooks for head, tail and
     markings. Drawing each animal from scratch is how a barnyard ends up
     looking like eight sprites from eight different games.

     The legs are deliberately NOT part of the bob. `dy` moves the body and the
     head while the feet stay planted on `foot`, which is what makes a two-frame
     idle read as breathing rather than as the animal hopping. */
  /* One leg, jointed. A quadruped's leg is not a post: the upper bone carries
     the body's width, the cannon below the knee is a pixel narrower and steps
     in under the animal, and the hoof caps it. Four straight columns of body
     colour merge into a single slab, which is exactly what the barnyard used
     to read as from the knees down. */
  function beastLeg(a, lx, top, foot, w, main, dark, hoofC, lean) {
    const knee = top + Math.max(1, Math.round((foot - top) * 0.45));
    a.rect(lx, top, lx + w, knee - 1, main);
    a.rect(lx + w, top, lx + w, knee - 1, dark);        // shaded back edge
    a.rect(lx, knee, lx + w, knee, dark);               // the joint itself
    const cw = Math.max(0, w - 1), kx = lx + (lean || 0);
    a.rect(kx, knee + 1, kx + cw, foot - 1, main);
    a.rect(kx + cw, knee + 1, kx + cw, foot - 1, dark);
    a.rect(kx, foot, kx + cw, foot, hoofC);
  }

  function beast(a, p, dy) {
    const w = p.legW === undefined ? 1 : p.legW;
    const y0 = p.y0 + dy, y1 = p.y1 + dy, foot = p.foot === undefined ? 27 : p.foot;
    /* The far pair is a tone down AND a pixel thinner. Matching the near pair
       exactly is what made the four legs read as two wide posts. */
    const fw = Math.max(0, w - 1), farSh = dim(p.sh);
    for (const lx of p.farLegs || []) beastLeg(a, lx, y1 - 1, foot - 1, fw, p.sh, farSh, farSh);
    a.ellipse(p.x0, y0, p.x1, y1, p.c, true);
    a.ellipse(p.x0 + 1, y0, p.x1 - 2, y0 + 2, p.hi, true);
    a.ellipse(p.x0 + 1, y1 - 1, p.x1 - 1, y1, p.sh, true);
    if (p.body) p.body(a, y0, y1);
    for (const lx of p.nearLegs || []) beastLeg(a, lx, y1 - 1, foot, w, p.c, p.sh, p.hoof || p.sh);
    if (p.tail) p.tail(a, y0, y1);
    if (p.head) p.head(a, y0, y1);
  }

  /* A two-frame breathing idle for any beast: body up a pixel, plus whatever
     secondary motion the animal's own painters add off `i`. */
  const breathe = (name, fps, p) => D(name, fps || 3, true,
    cyc(2, fps || 3, (a, i) => beast(a, p(i), -i)));

  function animalSuite() {
    const cow = i => ({
      c: '#e8e4dc', hi: '#ffffff', sh: '#a9a49a', x0: 6, x1: 23, y0: 13, y1: 22,
      legW: 2, hoof: '#3a332a', farLegs: [11, 17], nearLegs: [7, 20],
      body: b => {
        b.ellipse(9, 14, 14, 18, '#2f2a24', true);          // hide patches
        b.ellipse(17, 17, 22, 21, '#2f2a24', true);
        b.rect(14, 21, 18, 23, '#e8a0a8');                  // udder
        b.px(15, 23, '#c07a84'); b.px(17, 23, '#c07a84');
      },
      tail: b => { b.rect(5, 14, 6, 20, '#a9a49a'); b.rect(4, 20, 6, 23, '#2f2a24'); },
      head: (b, y0) => {
        b.ellipse(21, y0 - 2, 29, y0 + 6, '#e8e4dc', true);
        b.ellipse(22, y0 - 2, 27, y0 + 1, '#ffffff', true);
        b.rect(26, y0 + 3, 30, y0 + 6, '#e8a0a8');          // muzzle
        b.rect(26, y0 + 3, 30, y0 + 3, '#f7c2c8');
        b.px(27, y0 + 5, '#a9666f'); b.px(29, y0 + 5, '#a9666f');
        b.px(25, y0 + 1, '#231a14');                        // eye
        b.rect(19, y0, 22, y0 + 2, '#a9a49a');              // ear, out sideways
        b.rect(19, y0, 22, y0, '#c8c3b8');
        /* Horns clear the skull by two rows and curve inward at the tip. Sunk
           into the crown they vanish and the cow reads as a big dog. */
        b.rect(22, y0 - 4, 23, y0 - 2, '#d8cfae');
        b.px(22, y0 - 5, '#efe8cc');
        b.rect(27, y0 - 4, 28, y0 - 2, '#b8b096');
        b.px(28, y0 - 5, '#d8cfae');
      }
    });
    const pig = i => ({
      c: '#e08a94', hi: '#f7b6bd', sh: '#a85f6b', x0: 7, x1: 23, y0: 15, y1: 23,
      legW: 2, hoof: '#6b3a42', farLegs: [11, 17], nearLegs: [8, 20],
      body: b => {
        b.rect(9, 21, 21, 21, '#a85f6b');                   // underside of the barrel
        b.rect(18, 17, 18, 20, '#c07a84');                  // shoulder crease
        b.px(12, 18, '#a85f6b'); b.px(16, 20, '#a85f6b');
      },
      // A curl that TOUCHES the rump. Three loose pixels beside the body got
      // rimmed by the outline pass as a floating island.
      tail: b => {
        b.rect(6, 17, 7, 17, '#c07a84');
        b.px(5, 18, '#c07a84'); b.px(6, 18, '#e08a94');
        b.rect(6, 19, 7, 19, '#c07a84');
      },
      head: (b, y0) => {
        b.ellipse(21, y0 - 1, 28, y0 + 6, '#e08a94', true);
        b.ellipse(22, y0 - 1, 26, y0 + 2, '#f7b6bd', true);
        b.rect(27, y0 + 2, 30, y0 + 5, '#c07a84');          // snout
        b.rect(27, y0 + 2, 30, y0 + 2, '#f7b6bd');
        b.px(28, y0 + 4, '#7a3f48'); b.px(30, y0 + 4, '#7a3f48');
        b.px(24, y0 + 2, '#231a14');
        /* Ear: a small triangle standing ON the skull, between the eye and the
           topline. Drawn as a wedge raked back over the shoulders it read as a
           dorsal fin, and squared off it was a crate on the pig's back. */
        b.rect(24, y0 - 2, 25, y0 - 2, '#c07a84');
        b.rect(23, y0 - 1, 26, y0 + 1, '#c07a84');
        b.rect(23, y0 - 1, 23, y0 + 1, '#f7b6bd');
        b.px(26, y0 + 1, '#7a3f48');
      }
    });
    const sheep = i => ({
      c: '#efe9d8', hi: '#ffffff', sh: '#bdb49c', x0: 6, x1: 23, y0: 13, y1: 23,
      legW: 1, hoof: '#2f2a24', farLegs: [11, 18], nearLegs: [8, 21],
      body: b => {
        /* Fleece is the silhouette, not a texture: bumps proud of the body
           ellipse. Speckled flat the sheep is just a pale cow. */
        for (let k = 0; k < 7; k++) {
          const x = 7 + k * 2 + Math.round(b.hash(k, 1, 5) * 1);
          const y = 12 + Math.round(b.hash(k, 2, 5) * 2);
          b.rect(x, y, x + 2, y + 2, '#efe9d8');              // one curl
          b.px(x + 1, y, '#ffffff'); b.px(x, y + 1, '#ffffff');
          b.px(x + 2, y + 2, '#bdb49c');                      // the shadow that parts it
        }
        /* Underside shaded along the barrel's curve. A flat band ruled across
           the whole body read as a stripe painted on the wool. */
        for (let x = 7; x <= 22; x++) {
          const d = Math.round(Math.cos((x - 14) / 5.5) * 3);
          b.rect(x, 21 - d, x, 23, '#bdb49c');
          b.rect(x, 20 - d, x, 20 - d, '#d8d1bd');           // half-tone, so the
        }                                                     // wool does not hard-cut
      },
      tail: b => { b.rect(5, 17, 7, 19, '#efe9d8'); b.rect(6, 20, 7, 20, '#bdb49c'); b.px(5, 17, '#ffffff'); },
      head: (b, y0) => {
        /* The face has to clear the fleece. Set flush with the body ellipse it
           was a dark dent in the wool rather than a head, and a pair of light
           dots on a dark muzzle read as nostrils, not eyes. */
        b.ellipse(22, y0 + 2, 29, y0 + 8, '#5a5348', true);
        b.ellipse(23, y0 + 2, 27, y0 + 4, '#7c7466', true);  // brow catching light
        b.ellipse(19, y0 - 1, 26, y0 + 4, '#efe9d8', true);  // fleece over the crown
        b.ellipse(20, y0 - 1, 24, y0 + 1, '#ffffff', true);
        b.rect(21, y0 + 4, 23, y0 + 6, '#5a5348');           // ear hung off the poll
        b.px(21, y0 + 4, '#7c7466'); b.px(23, y0 + 6, '#3a352c');
        b.px(25, y0 + 5, '#efe9d8'); b.px(26, y0 + 5, '#231a14');   // eye
        b.rect(28, y0 + 6, 30, y0 + 8, '#3a352c');           // muzzle
        b.rect(28, y0 + 6, 30, y0 + 6, '#6d6459');
        b.px(29, y0 + 7, '#1c1913');
      }
    });
    const horse = i => ({
      c: '#8a5a34', hi: '#b07c4c', sh: '#5a3820', x0: 5, x1: 21, y0: 13, y1: 21,
      legW: 2, hoof: '#2f2a24', farLegs: [10, 14], nearLegs: [6, 18],
      body: b => {
        /* The barrel, shaded along its own curve. A flat rectangle of shadow
           across the underside read as a plank nailed under the horse. */
        for (let x = 6; x <= 20; x++) {
          const d = Math.round(Math.cos((x - 13) / 7) * 1.7);
          b.rect(x, 20 - d, x, 21, '#5a3820');
        }
        b.rect(7, 14, 10, 16, '#b07c4c');                    // haunch catching light
        b.rect(16, 14, 19, 15, '#b07c4c');                   // shoulder
        b.rect(11, 17, 12, 19, '#5a3820');                   // flank crease behind the ribs
        b.px(16, 16, '#5a3820');
      },
      // A switch that tapers and drifts, not a 3x10 slab hung off the croup
      tail: b => {
        for (let d = 0; d <= 9; d++) {
          const x = 5 - Math.round(d * 0.22), w = d < 2 ? 1 : d < 7 ? 2 : 1;
          b.rect(x - w, 13 + d, x, 13 + d, '#3a2416');
          b.px(x, 13 + d, d % 2 ? '#3a2416' : '#6b4a2e');
        }
      },
      head: (b, y0) => {
        /* Neck sheared up-and-right off the withers, then a blocky skull with
           the muzzle STEPPED forward off it. Drawn as one tapering wedge from
           shoulder to nose the head and neck fuse and the animal reads as a
           moose; the step is what makes the jaw. */
        /* Eight rows of neck, sheared nearly one-for-one up and FORWARD. The
           first cut rose nine rows while travelling five across, which is a
           llama: a horse carries its head out over its chest, not above its
           withers. */
        for (let d = 0; d <= 7; d++) {
          const y = y0 + 1 - d, xa = 16 + Math.round(d * 1.05), xb = 23 + Math.round(d * 0.6);
          b.rect(xa, y, xb, y, '#8a5a34');
          b.rect(xa, y, xa + 1, y, '#b07c4c');
          b.px(xb, y, '#5a3820');
        }
        b.rect(23, y0 - 9, 28, y0 - 4, '#8a5a34');           // skull
        b.rect(23, y0 - 9, 24, y0 - 4, '#b07c4c');
        b.rect(28, y0 - 9, 28, y0 - 4, '#5a3820');
        b.rect(28, y0 - 7, 31, y0 - 5, '#8a5a34');           // muzzle
        b.rect(28, y0 - 7, 31, y0 - 7, '#b07c4c');
        b.rect(29, y0 - 5, 31, y0 - 5, '#5a3820');
        b.px(30, y0 - 6, '#2f2a24');                          // nostril
        b.px(26, y0 - 7, '#231a14');                          // eye
        b.rect(23, y0 - 11, 24, y0 - 9, '#8a5a34');           // ears
        b.px(23, y0 - 11, '#b07c4c');
        b.rect(26, y0 - 11, 27, y0 - 9, '#5a3820');
        /* Mane is a narrow crest down the BACK of the neck. Laid as a slab
           across the top of the skull it reads as the base of a pair of
           antlers. */
        for (let d = 0; d <= 8; d++) {
          const y = y0 - 8 + d, x = 23 - Math.round(d * 0.95);
          b.rect(x - 1, y, x, y, '#3a2416');
          b.px(x - 1, y, d % 3 ? '#3a2416' : '#5a3820');
        }
        // forelock kept narrow: run across both ears it merges with them into
        // one dark mass and the horse grows antler stubs
        b.rect(22, y0 - 10, 23, y0 - 8, '#3a2416');
        b.px(23, y0 - 10, '#5a3820');
      }
    });
    const goat = i => ({
      c: '#cfc8b8', hi: '#eae4d6', sh: '#968f80', x0: 7, x1: 22, y0: 15, y1: 22,
      legW: 1, hoof: '#2f2a24', farLegs: [11, 18], nearLegs: [9, 20],
      body: b => b.rect(9, 20, 20, 22, '#968f80'),
      tail: b => b.rect(5, 15, 7, 17, '#eae4d6'),
      head: (b, y0) => {
        b.ellipse(20, y0 - 3, 28, y0 + 4, '#cfc8b8', true);
        b.ellipse(21, y0 - 3, 25, y0 - 1, '#eae4d6', true);
        b.rect(26, y0 + 1, 30, y0 + 4, '#968f80');            // muzzle
        b.px(27, y0 + 3, '#3a352c');
        b.px(25, y0 - 1, '#231a14');
        b.rect(24, y0 + 4, 26, y0 + 8, '#eae4d6');            // beard, hung clear
        b.rect(24, y0 + 7, 26, y0 + 8, '#cfc8b8');
        /* Horns sweep BACK over the skull and are two pixels thick. One-pixel
           spines stuck on at an angle read as insect antennae. */
        for (let d = 0; d < 6; d++) {
          const hy = y0 - 4 - Math.round(Math.sqrt(d) * 1.7);
          b.rect(24 - d, hy, 24 - d, hy + 1, '#8a7f68');
          b.px(24 - d, hy, '#b0a68c');
          b.rect(27 - d, hy, 27 - d, hy + 1, '#6d6352');
        }
        b.rect(19, y0 - 1, 20, y0, '#968f80');                // ear
      }
    });
    const dog = i => ({
      c: '#b98a4e', hi: '#d9ab6e', sh: '#7f5c2e', x0: 8, x1: 20, y0: 17, y1: 23,
      legW: 1, hoof: '#4a3524', farLegs: [11, 16], nearLegs: [9, 18],
      body: b => {
        b.rect(10, 22, 18, 23, '#7f5c2e');                    // belly in shadow
        b.rect(9, 18, 12, 20, '#d9ab6e');                     // haunch
        b.rect(16, 18, 19, 19, '#d9ab6e');                    // chest
        b.px(13, 20, '#7f5c2e');
      },
      /* Tail wag is the whole read for a dog: it has to swing between frames,
         not just exist. Drawn as a 2x6 post it wagged like a lever; a plume
         that curls and tapers is what makes it a tail. */
      tail: b => {
        const up = i === 0;
        for (let d = 0; d < 6; d++) {
          const x = 8 - Math.round(d * (up ? 0.45 : 0.75));
          const y = 19 - d * (up ? 1 : 0.7);
          b.rect(x, y, x + (d < 4 ? 1 : 0), y, '#b98a4e');
          b.px(x, y, d % 2 ? '#d9ab6e' : '#b98a4e');
        }
      },
      head: (b, y0) => {
        b.rect(20, y0 - 6, 22, y0 - 2, '#5f4420');            // far ear behind the skull
        b.ellipse(18, y0 - 4, 26, y0 + 3, '#b98a4e', true);
        b.ellipse(19, y0 - 4, 23, y0 - 2, '#d9ab6e', true);
        b.rect(24, y0, 29, y0 + 3, '#b98a4e');                // muzzle
        b.rect(24, y0, 29, y0, '#d9ab6e');
        b.rect(28, y0 + 1, 29, y0 + 2, '#2f2a24');            // nose
        b.px(23, y0 - 1, '#231a14');
        /* Ears hang DOWN the side of the skull. Stood up as two blocks on the
           crown the dog reads as a rabbit. */
        for (let d = 0; d < 7; d++) {                         // near ear, tapering
          const xa = 17 + (d < 2 ? 1 : 0), xb = 20 - Math.max(0, d - 4);
          b.rect(xa, y0 - 4 + d, xb, y0 - 4 + d, '#7f5c2e');
          b.px(xa, y0 - 4 + d, '#9b7040');
          if (d > 4) b.px(xb, y0 - 4 + d, '#5f4420');
        }
        b.rect(25, y0 + 3, 27, y0 + 4, '#d94f5a');            // lolling tongue
        b.px(25, y0 + 3, '#8f2f3a');
      }
    });
    const chicken = i => ({
      c: '#f2ece0', hi: '#ffffff', sh: '#c2b9a6', x0: 10, x1: 21, y0: 16, y1: 23,
      legW: 1, hoof: '#e8a83a', farLegs: [13], nearLegs: [17],
      body: b => b.rect(11, 21, 20, 23, '#c2b9a6'),
      /* Sickle feathers arcing up off the rump. A 5x6 slab of shadow tone
         parked beside the bird read as a grey crate, and the outline pass
         boxed its seam into a detached rectangle. Each stroke starts INSIDE
         the body so the fan can never come loose from the silhouette. */
      tail: b => {
        b.line(12, 21, 8, 17, '#8f8879', 2);
        b.line(12, 20, 6, 15, '#c2b9a6', 2);
        b.line(12, 19, 5, 13, '#f2ece0', 2);
        b.line(12, 18, 6, 13, '#ffffff', 1);
      },
      head: (b, y0) => {
        /* The peck is a real dip: the head drops five rows and the neck folds
           with it. Bobbing the beak alone leaves the bird looking startled. */
        const dip = i >= 2 ? 5 : 0;
        /* Short, thick neck. Run long and thin the bird reads as a llama. */
        b.rect(17, y0 - 4 + dip, 22, y0 + 1, '#f2ece0');      // neck
        b.rect(17, y0 - 4 + dip, 18, y0 + 1, '#ffffff');
        b.rect(22, y0 - 3 + dip, 22, y0 + 1, '#c2b9a6');
        b.ellipse(17, y0 - 8 + dip, 25, y0 - 3 + dip, '#f2ece0', true);
        b.ellipse(18, y0 - 8 + dip, 23, y0 - 6 + dip, '#ffffff', true);
        b.rect(25, y0 - 6 + dip, 28, y0 - 4 + dip, '#e8a83a');   // beak
        b.px(28, y0 - 5 + dip, '#c07f18');
        b.px(23, y0 - 6 + dip, '#231a14');
        b.rect(19, y0 - 10 + dip, 22, y0 - 9 + dip, '#d94f3a');  // comb
        b.px(18, y0 - 9 + dip, '#d94f3a'); b.px(23, y0 - 9 + dip, '#d94f3a');
        b.rect(24, y0 - 3 + dip, 25, y0 - 2 + dip, '#d94f3a');   // wattle
      }
    });
    const duck = i => ({
      c: '#f7f3e8', hi: '#ffffff', sh: '#c8c0ae', x0: 8, x1: 21, y0: 17, y1: 23,
      legW: 1, hoof: '#e8a83a', farLegs: [12], nearLegs: [16],
      body: b => { b.rect(10, 21, 20, 23, '#c8c0ae'); b.ellipse(12, 18, 18, 21, '#e0d9c8', true); },
      /* Upswept wedge tapering to a point. A 4x3 slab hung off the flank is a
         crate the moment the outline pass draws a seam around it. */
      tail: b => {
        for (let d = 0; d < 4; d++) {
          b.rect(5 + Math.round(d * 1.05), 16 + d, 7 + d * 2, 16 + d, d < 2 ? '#f7f3e8' : '#c8c0ae');
          b.px(5 + Math.round(d * 1.05), 16 + d, '#ffffff');
        }
      },
      head: (b, y0) => {
        const turn = i % 2 ? 1 : 0;
        b.rect(18, y0 - 5, 21, y0 + 1, '#f7f3e8');
        b.rect(18, y0 - 5, 19, y0 + 1, '#ffffff');
        b.ellipse(18 + turn, y0 - 9, 25 + turn, y0 - 3, '#f7f3e8', true);
        b.ellipse(19 + turn, y0 - 9, 23 + turn, y0 - 7, '#ffffff', true);
        b.rect(25 + turn, y0 - 7, 29 + turn, y0 - 5, '#e8a83a');   // bill
        b.rect(25 + turn, y0 - 7, 29 + turn, y0 - 7, '#ffd46a');
        b.px(23 + turn, y0 - 7, '#231a14');
      }
    });
    return {
      width: 32, height: 32, name: 'Barnyard', layers: [{ name: 'animal' }],
      states: [
        breathe('cow', 3, cow), breathe('pig', 3, pig), breathe('sheep', 3, sheep),
        D('horse', 3, true, cyc(2, 3, (a, i) => beast(a, horse(i), i))), breathe('goat', 3, goat),
        D('dog', 6, true, cyc(2, 6, (a, i) => beast(a, dog(i), -i))),
        D('chicken', 5, true, cyc(4, 5, (a, i) => beast(a, chicken(i), -(i % 2)))),
        D('duck', 4, true, cyc(2, 4, (a, i) => beast(a, duck(i), -i)))
      ]
    };
  }


  /* ============================================================== CROPS ====
     A growth stage is a STATE, not a frame. Packed as frames of one animation
     the studio would play a turnip inflating on a loop; as states you can flip
     between them, export stage 3 on its own, and wire each one to a tile in a
     farming sim's crop table. */
  const SOIL = '#6b4a30', SOIL_D = '#4a3220', SOIL_L = '#8a6340';
  const LEAF = '#4f8f3a', LEAF_HI = '#7bc255', LEAF_SH = '#2f5c22';

  /* Every crop stands in the same tilled mound, so flipping through the five
     stages reads as one plant growing rather than five unrelated sprites. */
  const mound = a => {
    a.ellipse(5, 24, 26, 28, SOIL, true);
    a.ellipse(7, 24, 24, 25, SOIL_L, true);
    a.ellipse(7, 27, 25, 28, SOIL_D, true);
    speck(a, 7, 24, 24, 27, 17, [SOIL_D, SOIL_L], 0.24);
  };

  /* A leaf drawn as a tapering run along a direction, so the same call makes a
     blade of wheat, a carrot frond and a pumpkin vine. Drawn as rects it would
     step; drawn as a line it would be a wire. */
  function blade(a, x, y, len, lean, w, c, hi) {
    for (let d = 0; d < len; d++) {
      const t = d / len, bx = x + Math.round(t * t * lean), by = y - d;
      const half = Math.max(0, Math.round((1 - t) * w));
      a.rect(bx - half, by, bx + half, by, c);
      if (hi) a.px(bx - half, by, hi);
    }
  }

  /* A broad leaf: a spine that arcs out and droops, with the blade swelling
     in the middle and tapering at both ends. `blade` leaves a one-pixel trail,
     which is right for a stalk of wheat and reads as an insect antenna on
     anything with actual foliage. */
  function leaf(a, x0, y0, dx, rise, len, c, hi, sh) {
    for (let d = 0; d <= len; d++) {
      const t = d / len;
      const bx = x0 + dx * d;
      // droop coefficient kept under the rise: at 0.9 a short leaf lands lower
      // than it started and reads as a lump stuck on the stem
      const by = Math.round(y0 - rise * d + t * t * (rise * len * 0.55 + 1.5));
      const w = Math.round(Math.sin(Math.min(1, t + 0.15) * Math.PI) * 1.7);
      a.rect(bx, by - w, bx, by + w, c);
      a.px(bx, by - w, hi);
      a.px(bx, by + w, sh);
    }
  }

  function cropSuite() {
    // ---- wheat: blades, then heads, then gold ----------------------------
    /* An ear is a narrow head with grain seams banded down it and a short V
       of awns off the tip. The first cut was seven pixels wide with awns
       spread three either side, and five of them side by side fused into one
       lumpy crown that read as a clump of mushrooms. */
    const ear = (a, x, y, gold) => {
      const c = gold ? '#d9b03a' : '#7fae4a', hi = gold ? '#f2d878' : '#a8d472',
        sh = gold ? '#9a7418' : '#4f7a2a';
      for (let g = 0; g < 8; g++) {
        const w = (g === 0 || g === 7) ? 0 : 1;
        a.rect(x - w, y + g, x + w, y + g, g % 2 ? c : sh);
        a.px(x - w, y + g, hi);
      }
      for (let k = -1; k <= 1; k++) a.rect(x + k, y - 3 + Math.abs(k), x + k, y - 1, c);
      a.px(x, y - 3, hi);
    };
    /* Three well-spaced stems once the ears are on. Five stems put the heads
       four pixels apart and they merge. */
    const EAR_STEMS = [[11, -1], [16, 0], [21, 1]];
    const STEMS = [[16, 0], [12, -3], [20, 3], [14, -1], [18, 2]];
    const wheatAt = (a, n, tall, ripe) => {
      if (ripe) {
        for (const st of EAR_STEMS) {
          blade(a, st[0], 24, tall, st[1], 0, ripe === 2 ? '#c8a33a' : '#5f9a3a',
            ripe === 2 ? '#e8c96a' : '#8fbf55');
          ear(a, st[0] + Math.round(st[1]), 24 - tall - 6, ripe === 2);
          const fy = 24 - Math.round(tall * 0.45);         // flag leaf halfway up
          a.px(st[0] + 1, fy, ripe === 2 ? '#e8c96a' : LEAF_HI);
          a.px(st[0] + 2, fy - 1, ripe === 2 ? '#c8a33a' : LEAF);
        }
        return;
      }
      for (let k = 0; k < n; k++) {
        const sx = STEMS[k][0], lean = STEMS[k][1];
        blade(a, sx, 24, tall, lean, 0, '#5f9a3a', '#8fbf55');
        const fx = sx + Math.round(lean * 0.5), fy = 24 - Math.round(tall * 0.55);
        a.px(fx + (k % 2 ? 1 : -1), fy, LEAF_HI);           // flag leaf
        a.px(fx + (k % 2 ? 2 : -2), fy - 1, LEAF);
      }
    };
    const wheat = [
      still(a => { mound(a); blade(a, 15, 24, 4, -2, 0, LEAF, LEAF_HI); blade(a, 17, 24, 4, 2, 0, LEAF, LEAF_HI); }),
      still(a => { mound(a); wheatAt(a, 3, 8, 0); }),
      still(a => { mound(a); wheatAt(a, 5, 13, 0); }),
      still(a => { mound(a); wheatAt(a, 3, 13, 1); }),
      cyc(2, 3, (a, i) => { mound(a); wheatAt(P().offsetApi(a, i, 0), 3, 14, 2); })
    ];
    // ---- corn ------------------------------------------------------------
    const cornStalk = (a, h, cob) => {
      const top = 24 - h;
      a.rect(14, top, 16, 24, '#5f9a3a');                   // stem, three wide
      a.rect(14, top, 14, 24, '#8fbf55');
      a.rect(16, top, 16, 24, '#3f7a2a');
      /* Leaves spread over the whole stalk, longest at the bottom. Bunched at
         even spacings with the short ones first they pile up round the base
         and the plant reads as a shrub with a pole through it. */
      const n = h < 12 ? 2 : 4;
      for (let k = 0; k < n; k++) {
        const y = 23 - Math.round(k * (h - 3) / n), len = Math.max(6, 10 - k * 2);
        if (k % 2) leaf(a, 17, y, 1, 0.7, len, LEAF, LEAF_HI, LEAF_SH);
        else leaf(a, 13, y, -1, 0.7, len, LEAF, LEAF_HI, LEAF_SH);
      }
      if (cob) {
        /* Kernels on a staggered grid, with one husk leaf wrapping the near
           edge and the silk tufting off the top. A plain rounded rectangle in
           yellow reads as a battery. */
        const cy0 = top + 5, ripe = cob === 2;
        for (let y = cy0; y < cy0 + 8; y++)
          for (let x = 18; x <= 21; x++)
            a.px(x, y, ((x + y) % 2) ? (ripe ? '#e8c04a' : '#8fbf55') : (ripe ? '#c8a02a' : '#6faa42'));
        a.rect(18, cy0, 21, cy0, ripe ? '#fff0a8' : '#b0d972');
        a.rect(17, cy0 - 1, 17, cy0 + 8, '#4f8f3a');        // husk leaf
        a.px(17, cy0 - 1, '#7bc255');
        a.rect(18, cy0 + 8, 21, cy0 + 9, '#4f8f3a');        // husk tip
        a.px(19, cy0 + 10, '#3f7a2a');
        a.rect(19, cy0 - 3, 21, cy0 - 1, '#d8c27a');        // silk
        a.px(20, cy0 - 4, '#efe0a8');
      }
      for (let k = -2; k <= 2; k++)                         // tassel
        a.px(15 + k, top - 1 - Math.abs(k), k ? '#7bc255' : '#b0d972');
      a.px(15, top - 3, '#b0d972');
    };
    const corn = [
      still(a => { mound(a); blade(a, 16, 24, 5, 0, 0, LEAF, LEAF_HI); blade(a, 14, 24, 3, -2, 0, LEAF, LEAF_HI); }),
      still(a => { mound(a); cornStalk(a, 9, 0); }),
      still(a => { mound(a); cornStalk(a, 16, 0); }),
      still(a => { mound(a); cornStalk(a, 19, 1); }),
      cyc(2, 3, (a, i) => { mound(a); cornStalk(P().offsetApi(a, i, 0), 20, 2); })
    ];
    // ---- carrot: the crop is UNDERGROUND, so the tell is the shoulder ----
    /* Feathery, well-separated fronds. Wide tapering blades overlap into one
       solid green trunk and the plant reads as broccoli. */
    const carrotTop = (a, n, len) => {
      const leans = [0, -5, 5, -8, 8];
      for (let k = 0; k < n; k++) {
        const lean = leans[k];
        for (let d = 0; d <= len; d++) {
          const t = d / len, x = Math.round(16 + lean * t * t), y = 23 - d;
          a.px(x, y, d < 3 ? '#3f7a2a' : LEAF);
          if (d > 2 && d % 2 === 0) { a.px(x - 1, y - 1, LEAF_HI); a.px(x + 1, y - 1, LEAF_SH); }
        }
        a.px(Math.round(16 + lean), 22 - len, LEAF_HI);
      }
    };
    /* The exposed shoulder is a rounded crown, widest a row or two BELOW the
       top and tapering into the soil. A flat-topped trapezoid with the fronds
       coming out of the middle of it reads as a terracotta plant pot. */
    const shoulder = (a, y, half) => {
      const rows = half + 3;
      for (let d = 0; d < rows; d++) {
        const t = d / (rows - 1);
        const w = Math.max(0, Math.round(half * Math.sin((0.3 + t * 0.62) * Math.PI)));
        a.rect(16 - w, y + d, 16 + w, y + d, '#d9762a');
        a.px(16 - w, y + d, '#f09a4a');
        a.px(16 + w, y + d, '#a9521a');
        if (d % 2) a.px(16 - w + 1, y + d, '#c26520');      // groove ticks
      }
      a.px(16, y - 1, '#f09a4a');
    };
    const carrot = [
      still(a => { mound(a); carrotTop(a, 2, 4); }),
      still(a => { mound(a); carrotTop(a, 3, 7); }),
      still(a => { mound(a); carrotTop(a, 5, 10); }),
      still(a => { mound(a); carrotTop(a, 5, 12); shoulder(a, 22, 2); }),
      cyc(2, 3, (a, i) => { mound(a); carrotTop(P().offsetApi(a, i, 0), 5, 13); shoulder(a, 20, 4); })
    ];
    // ---- tomato ----------------------------------------------------------
    const bush = (a, h, fruit) => {
      a.rect(15, 24 - h, 16, 24, '#5f7a34');
      for (let k = 0; k < 6; k++) {
        const y = 23 - Math.floor(k * h / 6), lean = k % 2 ? 7 : -7;
        blade(a, k % 2 ? 17 : 14, y, 5, lean, 1, LEAF, LEAF_HI);
        const lx = (k % 2 ? 17 : 14) + Math.round(lean * 0.7), ly = y - 4;
        a.rect(lx - 1, ly, lx + 1, ly + 1, LEAF);
        a.px(lx - 1, ly, LEAF_HI);
      }
      for (const f of fruit) {
        disc(a, f[0], f[1], 2, f[2], f[3]);
        a.px(f[0], f[1] - 2, LEAF_SH);
      }
    };
    const tomato = [
      still(a => { mound(a); blade(a, 16, 24, 4, 0, 0, LEAF, LEAF_HI); blade(a, 18, 24, 3, 2, 0, LEAF, LEAF_HI); }),
      still(a => { mound(a); bush(a, 8, []); }),
      still(a => { mound(a); bush(a, 15, []); }),
      still(a => { mound(a); bush(a, 18, [[10, 14, '#8fbf55', '#b0d972'], [22, 17, '#8fbf55', '#b0d972']]); }),
      cyc(2, 3, (a, i) => {
        mound(a);
        bush(P().offsetApi(a, i, 0), 19,
          [[10 + i, 13, '#d43f3f', '#ff8a8a'], [22 + i, 16, '#d43f3f', '#ff8a8a'], [14 + i, 19, '#b02c2c', '#e06060']]);
      })
    ];
    // ---- pumpkin: a vine ALONG the ground, not a stalk -------------------
    /* A one-pixel runner with lobed pads on short petioles. Drawn as a thick
       rope with rects sat directly on it, the vine and its leaves fuse into a
       single green caterpillar lying in the dirt. */
    const vine = (a, len) => {
      for (let d = 0; d < len; d++) {
        const x = 16 - d, y = 24 - Math.round(Math.sin(d * 0.55) * 1.4);
        a.px(x, y, '#5f9a3a'); a.px(x, y - 1, '#7bc255');
      }
      /* Pads set five pixels apart with a notch between the lobes and a dark
         underside. At four apart and five rows deep they overlapped into one
         green mass that read as a head of broccoli lying in the dirt. */
      for (let k = 0; k * 5 + 3 < len; k++) {
        const d = k * 5 + 3, bx = 16 - d, by = 24 - Math.round(Math.sin(d * 0.55) * 1.4);
        a.px(bx, by - 2, '#5f9a3a');                        // petiole
        a.rect(bx - 2, by - 4, bx + 2, by - 3, LEAF);
        a.px(bx - 1, by - 5, LEAF_HI); a.px(bx + 1, by - 5, LEAF);
        a.px(bx - 2, by - 4, LEAF_HI);
        a.rect(bx - 2, by - 3, bx + 2, by - 3, LEAF_SH);
        a.px(bx, by - 5, '#3a5c22');                        // notch between lobes
      }
    };
    const gourd = (a, cx, cy, r, c, hi, sh) => {
      /* Ribs are what make a pumpkin: a plain disc in orange is a ball. Each
         rib is a column of the shadow tone, and the ribs curve with the body
         rather than running straight down it. */
      disc(a, cx, cy, r, c, hi);
      for (const o of [-r + 1, 0, r - 1]) {
        for (let y = cy - r + 1; y <= cy + r - 1; y++) {
          const t = (y - cy) / r, bend = Math.round(o * (1 - t * t * 0.35));
          a.px(cx + bend, y, o === 0 ? hi : sh);
        }
      }
      a.rect(cx - 1, cy - r - 2, cx, cy - r, '#5f7a34');      // stem
      a.px(cx - 1, cy - r - 2, '#8aa84e');
    };
    const pumpkin = [
      still(a => { mound(a); blade(a, 16, 24, 4, 1, 0, LEAF, LEAF_HI); a.rect(13, 22, 15, 23, LEAF); }),
      still(a => { mound(a); vine(a, 7); }),
      still(a => { mound(a); vine(a, 12); disc(a, 22, 22, 3, '#8fbf55', '#b0d972'); a.rect(21, 18, 22, 20, '#4f7a34'); }),
      still(a => { mound(a); vine(a, 12); gourd(a, 22, 20, 4, '#8fbf55', '#b0d972', '#5f9a3a'); }),
      cyc(2, 3, (a, i) => {
        mound(a);
        vine(a, 11);
        gourd(a, 21, 18 - i, 6, '#e07b1f', '#ffa84a', '#a9521a');
      })
    ];
    const stages = (base, arr) => arr.map((fr, k) => D(base + (k + 1), 3, true, fr));
    return {
      width: 32, height: 32, name: 'Crop Growth', layers: [{ name: 'crop' }],
      states: [].concat(
        stages('wheat', wheat), stages('corn', corn), stages('carrot', carrot),
        stages('tomato', tomato), stages('pumpkin', pumpkin)
      )
    };
  }

  /* =========================================================== BUILDINGS ===
     Farm structures at 32x32, each a state so a pack can be dropped into a
     tile palette whole. Anything with moving parts animates; anything without
     is a single frame rather than a fake two-frame shimmer. */
  const WOOD = '#8a5a34', WOOD_HI = '#b07c4c', WOOD_SH = '#5a3820', WOOD_D = '#3a2416';
  const PAINT = '#b43a3a', PAINT_HI = '#d96060', PAINT_SH = '#7f2424';
  const STONE = '#8a8f99', STONE_HI = '#b0b6bf', STONE_SH = '#5a5f68';

  /* Vertical plank siding: a butt line every four columns with the column
     either side of it shaded. Flat fill plus a speckle reads as stucco. */
  function planks(a, x0, y0, x1, y1, c, hi, sh) {
    for (let x = x0; x <= x1; x++) {
      const p = (x - x0) % 4;
      a.rect(x, y0, x, y1, p === 0 ? sh : p === 1 ? hi : c);
    }
  }

  function buildSuite() {
    return {
      width: 32, height: 32, name: 'Farm Buildings', layers: [{ name: 'build' }],
      states: [
        D('barn', 1, false, still(a => {
          /* Gambrel roof, two slopes per side. A single 45-degree pitch reads
             as a shed; the double break is the whole silhouette of a barn. */
          for (let d = 0; d < 4; d++) a.rect(13 - d * 2, 4 + d, 18 + d * 2, 4 + d, d ? PAINT : PAINT_HI);
          for (let d = 0; d < 4; d++) a.rect(5 - 0, 8 + d, 26, 8 + d, d === 0 ? PAINT_HI : PAINT);
          a.rect(5, 8, 26, 8, PAINT_HI);
          a.rect(5, 11, 26, 11, PAINT_SH);                   // eave shadow
          planks(a, 5, 12, 26, 27, PAINT, PAINT_HI, PAINT_SH);
          a.rect(5, 12, 5, 27, PAINT_SH); a.rect(26, 12, 26, 27, PAINT_SH);
          a.rect(11, 15, 20, 27, WOOD_SH);                   // big door
          a.rect(11, 15, 20, 15, WOOD_HI);
          a.rect(12, 16, 19, 27, WOOD);
          // the X brace is the barn-door tell; two straight boards are a gate
          for (let d = 0; d < 11; d++) { a.px(12 + d, 16 + d, WOOD_HI); a.px(19 - d, 16 + d, WOOD_HI); }
          a.rect(15, 16, 16, 27, WOOD_D);                    // centre gap
          a.rect(14, 6, 17, 9, WOOD_D);                      // hayloft opening
          a.rect(14, 6, 17, 6, WOOD_SH);
          a.rect(15, 4, 16, 6, WOOD);                        // hoist beam
          a.rect(7, 18, 9, 21, '#7fc4d9');                   // windows
          a.rect(22, 18, 24, 21, '#7fc4d9');
          a.rect(7, 18, 9, 18, '#c8ecf5'); a.rect(22, 18, 24, 18, '#c8ecf5');
          a.px(8, 18, '#ffffff'); a.px(23, 18, '#ffffff');
        })),
        D('silo', 1, false, still(a => {
          /* Cap in its own warmer, darker tone with a rim under it. Painted
             the same grey as the body the silo loses its lid and reads as a
             rifle cartridge. */
          a.ellipse(9, 2, 22, 8, '#6f6a62', true);
          a.ellipse(11, 2, 18, 5, '#938c80', true);
          a.rect(9, 7, 22, 8, '#4a463f');
          a.rect(8, 8, 23, 9, '#5f5a52');                  // rim overhangs
          a.rect(8, 8, 23, 8, '#938c80');
          a.rect(15, 0, 16, 2, '#4a463f');                 // finial
          /* Fine vertical corrugation shaded as a barrel — light off-centre,
             dark at both edges — with just two hoop bands. Ribs on a 3-pixel
             period crossed by a dark line every 5 rows drew a grid of window
             panes and the silo read as an office block. */
          for (let x = 9; x <= 22; x++) {
            const t = (x - 9) / 13;
            const lit = Math.sin((0.12 + t * 0.76) * Math.PI);
            const base = lit > 0.86 ? STONE_HI : lit > 0.45 ? STONE : STONE_SH;
            a.rect(x, 8, x, 28, (x - 9) % 2 ? base : (base === STONE_HI ? STONE : base === STONE ? STONE_SH : '#3f444c'));
          }
          for (const y of [14, 21]) {                        // hoop bands
            a.rect(9, y, 22, y + 1, '#5a606b');
            a.rect(9, y, 22, y, '#8d949f');
          }
          a.rect(23, 8, 24, 28, '#3f444c');                  // ladder stringer
          for (let y = 11; y <= 27; y += 4) a.rect(22, y, 25, y, '#6b7079');
          a.rect(13, 22, 18, 28, WOOD_SH);                   // hatch
          a.rect(13, 22, 18, 22, WOOD_HI);
          a.rect(14, 23, 17, 28, WOOD);
          a.px(15, 2, '#d6dbe4');
        })),
        D('windmill', 8, true, cyc(4, 8, (a, i) => {
          /* Tapered tower standing on a wide base with the sails turning
             clear above it. A short tower with the sails crossing it reads as
             a pinwheel stuck on a post. */
          for (let y = 16; y <= 29; y++) {
            const t = (y - 16) / 13, half = Math.round(3.5 + t * 3.5);
            a.rect(16 - half, y, 16 + half, y, STONE);
            a.rect(16 - half, y, 16 - half + 1, y, STONE_HI);
            a.rect(16 + half - 1, y, 16 + half, y, STONE_SH);
            if ((y - 16) % 3 === 0) a.rect(16 - half + 1, y, 16 + half - 1, y, STONE_SH);
          }
          a.rect(6, 29, 25, 30, '#4a4f58');                // plinth
          a.rect(6, 29, 25, 29, STONE_SH);
          a.rect(13, 25, 18, 29, WOOD_SH);                 // door
          a.rect(14, 26, 17, 29, WOOD);
          a.rect(14, 26, 17, 26, WOOD_HI);
          a.rect(19, 21, 21, 23, '#7fc4d9');               // window
          a.px(19, 21, '#c8ecf5');
          a.ellipse(11, 12, 20, 17, PAINT, true);          // cap
          a.ellipse(12, 12, 17, 14, PAINT_HI, true);
          a.rect(11, 16, 20, 17, PAINT_SH);
          a.rect(10, 16, 21, 16, '#5f1c1c');               // cap eave
          /* Four sails on one hub, a quarter turn spread across four frames so
             the loop closes. Each sail is a spar with sailcloth on ONE side —
             symmetrical they read as a plus sign spinning in place. */
          const cx = 15.5, cy = 10, base = i * (TAU / 16);
          for (let k = 0; k < 4; k++) {
            const ang = base + k * (TAU / 4);
            const ux = Math.cos(ang), uy = Math.sin(ang);
            const ox = -uy, oy = ux;
            /* Each sail is FOUR pixels across: a dark spar with the cloth
               filling the side behind it. Drawn as a one-pixel line with two
               loose pixels alongside, the arms broke up into scattered chips
               that read as bone fragments rather than a turning cross. */
            for (let d = 2; d <= 9; d++) {
              for (let o = -1; o <= 2; o++) {
                const c = o < 0 ? '#6b4a2e' : o === 0 ? WOOD_D
                  : o === 1 ? '#efe9d8' : '#c8c0ae';
                if (o > 0 && d < 4) continue;               // cloth starts past the hub
                a.px(Math.round(cx + ux * d + ox * o), Math.round(cy + uy * d + oy * o), c);
              }
            }
          }
          disc(a, cx, cy, 2, '#3a2416', '#6b4a2e');        // hub
          a.px(16, 10, '#9a7a4a');
        })),
        D('coop', 1, false, still(a => {
          /* The hen house stands on short legs. Set flat on the ground the
             pop-hole ramp had nowhere to descend to and read as a diagonal
             brace painted across the doorway. */
          a.rect(8, 22, 10, 28, WOOD_SH);                    // legs
          a.rect(8, 22, 8, 28, WOOD);
          a.rect(21, 22, 23, 28, WOOD_D);
          a.rect(21, 22, 21, 28, WOOD_SH);
          for (let d = 0; d < 5; d++) a.rect(6 + d, 6 + d, 25 - d, 6 + d, d ? WOOD_SH : WOOD_HI);
          a.rect(5, 11, 26, 12, WOOD_D);                     // eave
          planks(a, 6, 12, 25, 22, WOOD, WOOD_HI, WOOD_SH);
          a.rect(6, 22, 25, 23, WOOD_D);                     // floor beam
          a.rect(10, 15, 15, 22, WOOD_D);                    // pop hole
          a.rect(11, 16, 14, 22, '#231a14');
          a.rect(11, 20, 14, 22, '#4a3a20');                 // litter inside
          // ramp: a two-pixel plank with cleats running from the sill down to
          // the dirt. One pixel wide it just reads as a scratch in the siding.
          for (let d = 0; d <= 5; d++) {
            a.rect(10 - d, 23 + d, 11 - d, 24 + d, '#8a6340');
            a.px(10 - d, 23 + d, '#b08a5a');
            if (d % 2) a.px(11 - d, 24 + d, '#5a3820');
          }
          a.rect(17, 14, 22, 18, '#7fc4d9');                 // wire window
          for (let x = 17; x <= 22; x += 2) a.rect(x, 14, x, 18, WOOD_D);
          for (let y = 14; y <= 18; y += 2) a.rect(17, y, 22, y, WOOD_D);
          a.rect(15, 2, 16, 6, '#6b7079');                   // vane mast
          /* Cockerel weather vane: body, up-swept tail, comb. A plain red slab
             on a stick read as a flame. */
          a.rect(16, 1, 20, 3, PAINT);
          a.rect(16, 1, 19, 1, PAINT_HI);
          a.rect(20, 2, 21, 4, PAINT_SH);                    // tail
          a.px(21, 1, PAINT);
          a.rect(13, 0, 15, 2, PAINT);                       // head
          a.px(13, 0, PAINT_HI);
          a.px(12, 1, '#e8c96a');                            // beak
        })),
        D('well', 1, false, still(a => {
          for (let y = 20; y <= 27; y++) {                    // stone drum
            for (let x = 7; x <= 24; x++) {
              const brick = ((x + (y % 2) * 2) % 4) === 0;
              a.px(x, y, brick ? STONE_SH : (x < 10 ? STONE_HI : x > 21 ? STONE_SH : STONE));
            }
          }
          a.rect(6, 18, 25, 20, STONE_HI);                    // coping
          a.rect(6, 20, 25, 20, STONE_SH);
          a.rect(9, 19, 22, 19, '#2b4a5a');                   // water in the shaft
          a.rect(11, 19, 20, 19, '#3f7fa0');
          a.rect(8, 12, 9, 19, WOOD);                         // posts
          a.rect(22, 12, 23, 19, WOOD_SH);
          for (let d = 0; d < 6; d++) a.rect(13 - d, 6 + d, 18 + d, 6 + d, d ? WOOD_SH : WOOD_HI);
          a.rect(6, 11, 25, 12, WOOD_D);
          a.rect(10, 13, 21, 13, '#3f444c');                  // axle
          a.rect(14, 14, 17, 17, WOOD_D);                     // bucket on the rope
          a.rect(15, 13, 16, 14, '#6b7079');
          a.rect(14, 14, 17, 14, WOOD_HI);
        })),
        D('scarecrow', 4, true, cyc(2, 4, (a, i) => {
          a.rect(15, 16, 17, 28, WOOD_SH);                   // post
          a.rect(15, 16, 15, 28, WOOD);
          a.rect(4, 15, 27, 16, WOOD_SH);                    // cross beam
          a.rect(4, 15, 27, 15, WOOD_HI);
          /* Straw hangs off the ends of the beam and the coat hem, and it is
             the only thing that moves. A scarecrow whose whole body swayed
             would read as a person standing there. */
          for (let k = 0; k < 5; k++) {
            const x = 4 + k, y = 17 + (k + i) % 2;
            a.rect(x, y, x, y + 1, '#e8c96a'); a.rect(27 - k, y, 27 - k, y + 1, '#c8a33a');
          }
          a.rect(6, 14, 10, 17, '#4f7a5a');                  // sleeves on the beam
          a.rect(6, 14, 10, 14, '#6b9c74');
          a.rect(22, 14, 26, 17, '#35573f');
          a.rect(22, 14, 26, 14, '#4f7a5a');
          a.rect(10, 15, 22, 25, '#4f7a5a');                 // coat
          a.rect(10, 15, 22, 16, '#6b9c74');
          a.rect(10, 15, 11, 25, '#6b9c74');
          a.rect(21, 15, 22, 25, '#35573f');
          a.rect(10, 25, 22, 26, '#35573f');
          for (let k = 0; k < 6; k++) a.px(11 + k * 2, 27 + (k + i) % 2, '#e8c96a');
          a.rect(13, 19, 19, 20, '#8a5a34');                 // rope belt
          a.px(16, 19, '#b07c4c');
          a.rect(15, 21, 17, 24, '#35573f');                 // button placket
          a.px(16, 22, '#c8a33a');
          /* The head is pale sacking, not straw. Painted in the same gold as
             the hat the two fused into one blob and the scarecrow read as an
             owl. */
          a.ellipse(11, 5, 21, 14, '#c8b48c', true);
          a.ellipse(12, 5, 18, 9, '#e0cfae', true);
          a.rect(20, 6, 21, 13, '#a3906a');
          /* Two solid button eyes and one stitched grin. Cross-stitch eyes plus
             a dotted mouth put nine scattered dark pixels on the face and the
             head read as a wire mesh screen. */
          a.rect(13, 8, 14, 9, '#3a2f22');
          a.px(13, 8, '#6b5a40');
          a.rect(17, 8, 18, 9, '#3a2f22');
          a.px(17, 8, '#6b5a40');
          a.rect(13, 12, 18, 12, '#3a2f22');
          a.px(12, 11, '#3a2f22'); a.px(19, 11, '#3a2f22');
          a.px(11, 6, '#a3906a'); a.px(20, 10, '#a3906a');     // sacking seams
          a.ellipse(7, 2, 25, 6, '#d9a83a', true);           // straw hat
          a.ellipse(11, 1, 21, 4, '#f0c86a', true);
          a.rect(7, 5, 25, 6, '#9a7418');
          a.rect(12, 4, 20, 4, '#8a5a34');                   // hatband
          for (let k = 0; k < 5; k++) a.px(9 + k * 4, 6 + (k + i) % 2, '#f0c86a');
        })),
        D('haystack', 1, false, still(a => {
          /* A round bale on its side: the read is the spiral of the roll, so
             the concentric arcs have to survive. Under a dense three-tone
             speckle they vanished and the bale looked like a heap of sand. */
          disc(a, 15.5, 18, 11, '#cfa63f', '#e8c467');
          for (let r = 9; r >= 3; r -= 3) {
            for (let s2 = 0; s2 < 44; s2++) {
              const ang = (s2 / 44) * TAU;
              a.px(Math.round(15.5 + Math.cos(ang) * r), Math.round(18 + Math.sin(ang) * r * 0.95), '#a07d22');
            }
          }
          // straw ticks follow the roll rather than scattering: two pixels
          // side by side read as a stalk, one alone reads as dirt
          for (let k = 0; k < 16; k++) {
            const ang = a.hash(k, 3, 29) * TAU, r = 2 + a.hash(k, 4, 29) * 8;
            const x = Math.round(15.5 + Math.cos(ang) * r), y = Math.round(18 + Math.sin(ang) * r * 0.95);
            a.px(x, y, k % 2 ? '#efd07a' : '#b08a28');
            a.px(x + 1, y, k % 2 ? '#e8c467' : '#a07d22');
          }
          a.rect(6, 28, 25, 29, '#7a6420');                  // contact shadow
          a.rect(6, 28, 25, 28, '#a07d22');
          for (let k = 0; k < 6; k++) a.px(7 + k * 3, 7 - (k % 2), '#efd07a');   // loose ends
        })),
        D('fence', 1, false, still(a => {
          /* Three-rail post and rail, the rails running full width so the
             sprite tiles horizontally into a run of fence. */
          for (const px of [4, 16, 28]) {
            a.rect(px - 1, 12, px + 1, 28, WOOD_SH);
            a.rect(px - 1, 12, px - 1, 28, WOOD);
            a.rect(px - 1, 12, px + 1, 12, WOOD_HI);
            a.px(px, 11, WOOD);
          }
          for (const ry of [15, 20, 25]) {
            a.rect(0, ry, 31, ry + 1, WOOD);
            a.rect(0, ry, 31, ry, WOOD_HI);
            a.rect(0, ry + 1, 31, ry + 1, WOOD_SH);
          }
          for (const px of [4, 16, 28]) for (const ry of [15, 20, 25]) a.px(px, ry, WOOD_D);
          speck(a, 0, 12, 31, 28, 11, [WOOD_D, WOOD_HI], 0.1);
        }))
      ]
    };
  }


  /* ============================================================== ITEMS ====
     Inventory icons. Each one lifts a pixel on the second frame so it reads as
     an object sitting in a slot rather than a decal printed on the panel; the
     art is kept clear of row 1 so the lift never clips. */
  const bob = (name, paint) => D(name, 3, true,
    cyc(2, 3, (a, i) => paint(P().offsetApi(a, 0, -i), i)));

  /* A hafted tool: shaft on a diagonal with the head hung off the top end.
     Every long-handled implement on the farm is this plus a different head, so
     they sit in a row in the inventory at matching angles. */
  /* Long-handled tool on a 45-degree haft. `len` shortens the shaft so a head
     that hangs PERPENDICULAR (down-and-right) still has canvas to hang into. */
  function hafted(a, head, len) {
    const n = len || 26;
    for (let d = 0; d < n; d++) {
      const x = 4 + d, y = 28 - d;
      a.px(x, y, '#8a6340'); a.px(x, y - 1, '#b08a5a'); a.px(x + 1, y, '#5a3820');
    }
    a.rect(4, 26, 6, 28, '#5a3820');                        // butt end
    head(a, 4 + n - 1, 28 - (n - 1));
  }

  function toolSuite() {
    return {
      width: 32, height: 32, name: 'Farm Tools', layers: [{ name: 'tool' }],
      states: [
        bob('hoe', a => hafted(a, (b, x, y) => {
          /* Square to a 45-degree haft means DOWN-AND-RIGHT. Raked back along
             the shaft instead, the blade lay on top of the wood and the tool
             read as a nozzle screwed onto a pole. */
          b.rect(x - 1, y - 1, x + 1, y + 1, '#5a5f68');     // socket
          b.px(x - 1, y - 1, '#8a9099');
          /* Solid column-by-column slab. Shading a 45-degree band across its
             perpendicular put alternating tones on neighbouring pixels and the
             blade dithered into a checkerboard ribbon. */
          for (let d = 1; d <= 6; d++) {
            const bx = x + d, by = y + d - 2, h = d === 6 ? 3 : 5;
            b.rect(bx, by, bx, by + h, '#7f858f');
            b.px(bx, by, '#b0b6bf');
            b.px(bx, by + h, '#4a4f58');
          }
          b.rect(x + 6, y + 4, x + 6, y + 7, '#e0e5ec');     // cutting edge
          b.px(x + 6, y + 7, '#b0b6bf');
        }, 20)),
        bob('pitchfork', a => hafted(a, (b, x, y) => {
          b.rect(x - 4, y + 3, x, y + 4, '#7f858f');         // crown
          b.rect(x - 4, y + 3, x, y + 3, '#b0b6bf');
          for (const tx of [x - 4, x - 2, x]) {              // three tines
            b.rect(tx, y - 4, tx, y + 3, '#8a9099');
            b.px(tx, y - 4, '#d6dbe4');
          }
        })),
        bob('axe', a => hafted(a, (b, x, y) => {
          /* Eye and poll gripping the haft, then a bit that narrows at the
             neck and swells into a convex cutting edge. A plain flared wedge
             read as a grey pennant nailed to a stick. */
          b.rect(x - 4, y - 1, x - 1, y + 6, '#5a5f68');     // poll around the eye
          b.rect(x - 4, y - 1, x - 1, y, '#8a9099');
          b.rect(x - 4, y + 6, x - 1, y + 6, '#3f444c');
          for (let d = 1; d <= 8; d++) {
            const t = d / 8;
            // neck pinches in before the bit flares back out
            const half = Math.round(1.6 + Math.sin(t * 2.3) * 2.6);
            const cy2 = y + 2 + Math.round(t * 0.7);
            b.rect(x - 4 - d, cy2 - half, x - 4 - d, cy2 + half, '#7f858f');
            b.px(x - 4 - d, cy2 - half, '#b0b6bf');
            b.px(x - 4 - d, cy2 + half, '#4a4f58');
            if (d >= 6) b.rect(x - 4 - d, cy2 - half, x - 4 - d, cy2 + half, d === 8 ? '#e0e5ec' : '#c0c6cf');
          }
        })),
        bob('shears', a => {
          /* Two blades crossing in an X above the rivet, each tapering to its
             own point, with looped handles below. Joining the two tips into a
             bar at the top turned the whole tool into a coat hanger. */
          for (let d = 0; d <= 10; d++) {
            const w = d < 9 ? 1 : 0;
            const ly = 16 - d, lx = 15 - d;
            a.rect(lx - w, ly, lx + w, ly, '#8a9099');
            a.px(lx - w, ly, '#d6dbe4');
            a.px(lx + w, ly, '#5a5f68');
            const rx = 17 + d;
            a.rect(rx - w, ly, rx + w, ly, '#7f858f');
            a.px(rx + w, ly, '#b0b6bf');
            a.px(rx - w, ly, '#4a4f58');
          }
          disc(a, 16, 17, 2, '#5a5f68', '#8a9099');          // rivet
          a.px(16, 17, '#c0c6cf');
          for (let d = 0; d <= 5; d++) {                     // shanks to the loops
            a.rect(14 - d, 18 + d, 15 - d, 18 + d, '#8a9099');
            a.rect(17 + d, 18 + d, 18 + d, 18 + d, '#5a5f68');
          }
          for (let s2 = 0; s2 < 20; s2++) {                  // handle loops, 2px thick
            const ang = (s2 / 20) * TAU, cs = Math.cos(ang), sn = Math.sin(ang);
            for (const r of [3, 4]) {
              a.px(Math.round(7 + cs * r), Math.round(26 + sn * r), r === 4 ? '#d9762a' : '#f09a4a');
              a.px(Math.round(25 + cs * r), Math.round(26 + sn * r), r === 4 ? '#a9521a' : '#d9762a');
            }
          }
        }),
        bob('wateringcan', a => {
          a.rect(8, 12, 21, 27, '#7f858f');                  // body
          a.rect(8, 12, 9, 27, '#b0b6bf');
          a.rect(20, 12, 21, 27, '#4a4f58');
          a.rect(8, 12, 21, 12, '#d6dbe4');
          a.rect(8, 27, 21, 27, '#3f444c');
          a.rect(8, 19, 21, 20, '#5a5f68');                  // seam
          a.rect(12, 9, 18, 12, '#5a5f68');                  // filler collar
          a.rect(12, 9, 18, 9, '#8a9099');
          for (let d = 0; d < 9; d++) {                      // spout, rising
            const x = 21 + Math.round(d * 0.9), y = 24 - d;
            a.rect(x, y, x + 1, y + 1, '#8a9099');
            a.px(x, y, '#c0c6cf');
          }
          a.rect(28, 14, 31, 16, '#5a5f68');                 // rose
          a.px(29, 14, '#c0c6cf'); a.px(31, 15, '#3f444c');
          /* Handle in a LIGHT metal grey and two pixels thick. A one-pixel
             arc in the darkest grey in the ramp merged with the outline pass
             and read as a scorch mark floating over the can. */
          for (let d = 0; d <= 12; d++) {
            const ang = Math.PI + (d / 12) * Math.PI;
            const hx = Math.round(14 + Math.cos(ang) * 6), hy = Math.round(11 - Math.abs(Math.sin(ang)) * 5);
            a.px(hx, hy, '#b0b6bf'); a.px(hx, hy + 1, '#6b7079');
          }
        }),
        bob('seedbag', a => {
          a.rect(7, 12, 24, 28, '#d8c27a');                  // sack
          a.rect(7, 12, 9, 28, '#efe0a8');
          a.rect(22, 12, 24, 28, '#a98a48');
          a.rect(7, 28, 24, 28, '#8a6f30');
          for (let y = 14; y <= 27; y += 3) a.px(11 + (y % 4), y, '#b09a58');   // weave
          a.rect(11, 8, 20, 12, '#c8b268');                  // gathered neck
          a.rect(11, 8, 20, 8, '#efe0a8');
          a.rect(10, 10, 21, 11, '#8a5a34');                 // tie cord
          a.px(10, 12, '#5a3820'); a.px(21, 12, '#5a3820');
          for (let k = 0; k < 5; k++) {                      // spill of seed
            const x = 12 + k * 2, y = 6 - (k % 2);
            a.px(x, y, '#8fbf55'); a.px(x, y + 1, '#5f9a3a');
          }
          a.rect(13, 18, 18, 24, '#5f9a3a');                 // stencilled sprout
          a.rect(15, 18, 16, 24, '#8fbf55');
          a.px(13, 19, '#8fbf55'); a.px(18, 19, '#8fbf55');
        }),
        bob('basket', a => {
          /* Woven wicker: alternating warp and weft per row, not a speckle.
             Speckled it reads as a clay pot. */
          for (let y = 14; y <= 27; y++) {
            const inset = y > 25 ? 1 : 0;
            for (let x = 6 + inset; x <= 25 - inset; x++) {
              const w = ((x + y) % 4) < 2;
              a.px(x, y, (y % 2) ? (w ? '#b08a5a' : '#8a6340') : (w ? '#8a6340' : '#6b4a2e'));
            }
          }
          a.rect(5, 12, 26, 14, '#b08a5a');                  // rim
          a.rect(5, 12, 26, 12, '#d9b47a');
          a.rect(5, 14, 26, 14, '#5a3820');
          for (let d = 0; d < 11; d++) {                     // arched handle
            const ang = Math.PI + (d / 10) * Math.PI;
            a.px(Math.round(15.5 + Math.cos(ang) * 9), Math.round(12 - Math.abs(Math.sin(ang)) * 8), '#8a6340');
            a.px(Math.round(15.5 + Math.cos(ang) * 9) + 1, Math.round(12 - Math.abs(Math.sin(ang)) * 8), '#5a3820');
          }
          a.rect(9, 15, 13, 17, '#d94f3a');                  // fruit showing
          a.rect(16, 15, 21, 17, '#e8c96a');
          a.px(10, 15, '#ff8a8a'); a.px(17, 15, '#fff0a8');
        }),
        bob('milkbucket', a => {
          for (let y = 13; y <= 28; y++) {                   // tapered pail
            const t = (y - 13) / 15, inset = Math.round(t * 2);
            a.rect(6 + inset, y, 25 - inset, y, '#8a9099');
            a.rect(6 + inset, y, 8 + inset, y, '#c0c6cf');
            a.rect(23 - inset, y, 25 - inset, y, '#5a5f68');
          }
          a.rect(5, 11, 26, 13, '#b0b6bf');                  // rim
          a.rect(5, 11, 26, 11, '#e0e5ec');
          a.rect(7, 12, 24, 12, '#f2f4f8');                  // milk surface
          a.rect(9, 12, 20, 12, '#ffffff');
          a.rect(8, 28, 23, 28, '#3f444c');
          a.rect(6, 19, 25, 19, '#5a5f68');                  // banding
          /* Bail in a light grey, two pixels thick — see the watering can. */
          for (let d = 0; d <= 16; d++) {
            const ang = Math.PI + (d / 16) * Math.PI;
            const hx = Math.round(15.5 + Math.cos(ang) * 10), hy = Math.round(11 - Math.abs(Math.sin(ang)) * 7);
            a.px(hx, hy, '#c0c6cf'); a.px(hx, hy + 1, '#7f858f');
          }
          a.px(12, 5, '#ffffff'); a.px(19, 6, '#e0e5ec');    // a splash on the way in
        })
      ]
    };
  }

  /* ============================================================ PRODUCE ====
     What the crops turn into once harvested — the inventory side of the same
     five plants, plus the animal products. Drawn at icon scale rather than
     scaled-down field art, because a 32px pumpkin needs a different ribbing
     count from a 10px one. */
  function produceSuite() {
    return {
      width: 32, height: 32, name: 'Farm Produce', layers: [{ name: 'produce' }],
      states: [
        bob('wheatsheaf', a => {
          /* Five overlapping ears at staggered heights fanning out of a tight
             band. Three evenly spaced spikes standing clear of one another on
             a wide collar read as a crown; the ears have to touch. */
          for (let k = 0; k < 9; k++) {                       // cut straw below
            const lean = (k - 4) * 0.8;
            for (let y = 28; y >= 21; y--) {
              const x = Math.round(16 + lean * (1 + (y - 21) / 7));
              a.px(x, y, k % 2 ? '#c8a33a' : '#efd07a');
              a.px(x + 1, y, '#9a7418');
            }
          }
          const ear = (x, top, lean) => {
            a.line(x, top + 8, 16, 21, '#c8a33a', 1);         // stalk into the band
            for (let g = 8; g >= 0; g--) {
              const bx = x + Math.round(lean * (8 - g) / 8);
              const w = (g === 0 || g === 8) ? 0 : 1;
              a.rect(bx - w, top + g, bx + w, top + g, g % 2 ? '#d9b03a' : '#9a7418');
              a.px(bx - w, top + g, '#f2d878');
            }
            const tx = x + lean;
            for (let k = -1; k <= 1; k++) a.rect(tx + k, top - 3 + Math.abs(k), tx + k, top - 1, '#d9b03a');
            a.px(tx, top - 3, '#f2d878');
          };
          ear(12, 8, -2); ear(20, 8, 2); ear(14, 6, -1); ear(18, 6, 1); ear(16, 5, 0);
          a.rect(12, 20, 20, 22, '#8a5a34');                  // binding
          a.rect(12, 20, 20, 20, '#b07c4c');
          a.rect(12, 22, 20, 22, '#5a3820');
          a.px(16, 21, '#b07c4c');
        }),
        bob('corncob', a => {
          /* Kernels on a staggered grid — a flat yellow block with a green
             leaf on it is a slab of butter. */
          for (let y = 8; y <= 24; y++) {
            for (let x = 12; x <= 20; x++) {
              const k = ((x + (y % 2) * 1) % 2) === 0;
              a.px(x, y, k ? '#e8c04a' : '#c8a02a');
            }
          }
          a.rect(12, 8, 20, 8, '#fff0a8'); a.rect(12, 24, 20, 24, '#9a7a18');
          a.rect(12, 8, 12, 24, '#fff0a8'); a.rect(20, 8, 20, 24, '#a98a24');
          blade(a, 11, 26, 16, -4, 1, '#5f9a3a', '#8fbf55');  // husk leaves
          blade(a, 21, 26, 15, 4, 1, '#4f8f3a', '#7bc255');
          a.rect(13, 24, 19, 27, '#5f9a3a');                  // husk collar
          a.rect(13, 24, 19, 24, '#8fbf55');
          a.rect(14, 5, 18, 8, '#d8c27a');                    // silk
          a.px(16, 4, '#efe0a8');
        }),
        bob('carrotitem', a => {
          for (let d = 0; d < 18; d++) {                      // tapering root
            const t = d / 18, half = Math.round((1 - t) * 4.5);
            const y = 10 + d, cx = 15 + Math.round(t * t * 2);
            a.rect(cx - half, y, cx + half, y, '#d9762a');
            a.rect(cx - half, y, cx - half + 1, y, '#f09a4a');
            a.px(cx + half, y, '#a9521a');
            if (d % 4 === 2) a.rect(cx - half + 1, y, cx + half - 1, y, '#c26520');  // grooves
          }
          a.px(19, 28, '#d9762a');
          for (const l of [[-6, 9], [-2, 11], [2, 10], [6, 8]])               // fronds
            blade(a, 16 + l[0] * 0.6, 10, l[1], l[0], 1, '#4f8f3a', '#7bc255');
          a.rect(13, 9, 19, 10, '#3f7a2a');                   // crown
          a.rect(13, 9, 19, 9, '#5f9a3a');
        }),
        bob('tomatoitem', a => {
          disc(a, 16, 19, 8, '#d43f3f', '#ff8a8a');
          disc(a, 13, 15, 3, '#e86a6a', null);                // specular
          a.px(12, 14, '#ffb0b0');
          for (let y = 12; y <= 26; y += 1) a.px(23 - Math.abs(y - 19) / 3 | 0, y, '#a02424');
          for (let k = 0; k < 5; k++) {                       // calyx star
            const ang = -Math.PI / 2 + k * (TAU / 5);
            for (let d = 1; d <= 4; d++)
              a.px(Math.round(16 + Math.cos(ang) * d), Math.round(11 + Math.sin(ang) * d * 0.8), d < 3 ? '#5f9a3a' : '#3f7a2a');
          }
          a.rect(15, 6, 16, 10, '#5f9a3a');                   // stem
          a.px(15, 6, '#8fbf55');
        }),
        bob('pumpkinitem', a => {
          /* Five lobes rather than one disc with stripes: the outline of a
             pumpkin bulges between the ribs, and that bulge is the read. */
          for (const o of [-5, -2.5, 0, 2.5, 5]) {
            // outer lobes stay nearly as fat as the middle one; shrunk away to
            // a third of it the ends came to points and the gourd read as a lens
            const r = 9.6 - Math.abs(o) * 0.2;
            disc(a, 16 + o, 19, r, Math.abs(o) > 3 ? '#c26520' : '#e07b1f', null);
          }
          disc(a, 12, 15, 3, '#ffa84a', null);
          for (const o of [-7, -3, 3, 7]) {
            for (let y = 11; y <= 28; y++) {
              const t = (y - 19) / 10, bend = Math.round(o * (1 - t * t * 0.35));
              if (Math.abs(t) < 1) a.px(16 + bend, y, '#a9521a');
            }
          }
          a.rect(14, 8, 17, 12, '#4f7a34');                   // thick stem
          a.rect(14, 8, 15, 12, '#7f9a4e');
          a.rect(13, 7, 18, 8, '#5f8a3a');
          blade(a, 20, 12, 7, 5, 1, '#4f8f3a', '#7bc255');    // trailing vine
        }),
        bob('egg', a => {
          /* Egg profile: the wide end is at the BOTTOM. An ellipse symmetric
             about its centre reads as a pebble. */
          /* Ellipse centred low, tapered only ABOVE the waist. Raising the
             exponent past 1 put the bulge at the TOP and the egg read as a
             bulb of garlic standing on its point. */
          for (let y = 9; y <= 28; y++) {
            const e = Math.sqrt(Math.max(0, 1 - Math.pow((y - 19) / 9.6, 2)));
            const taper = y < 19 ? 1 - 0.5 * ((19 - y) / 9.6) : 1;
            const half = Math.round(8.4 * e * taper);
            if (half <= 0) continue;
            a.rect(16 - half, y, 16 + half, y, '#f2e6d0');
            a.rect(16 - half, y, 16 - half + 1, y, '#fffaf0');
            a.px(16 + half, y, '#c8b498');
          }
          disc(a, 13, 15, 2, '#ffffff', null);
          a.rect(9, 29, 23, 30, '#b8a488');                   // it is resting on something
          speck(a, 11, 13, 21, 26, 13, ['#e0d0b4', '#fffaf0'], 0.1);
        }),
        bob('milk', a => {
          a.rect(11, 10, 20, 27, '#e8ecf2');                  // bottle glass
          a.rect(11, 10, 12, 27, '#ffffff');
          a.rect(19, 10, 20, 27, '#b8c0cc');
          a.rect(11, 27, 20, 27, '#8f96a4');
          a.rect(12, 13, 19, 26, '#ffffff');                  // milk inside
          a.rect(12, 13, 19, 13, '#e8ecf2');
          a.rect(13, 6, 18, 10, '#e8ecf2');                   // neck
          a.rect(13, 6, 14, 10, '#ffffff');
          a.rect(12, 4, 19, 6, '#d94f3a');                    // foil cap
          a.rect(12, 4, 19, 4, '#f07a6a');
          a.px(13, 4, '#ffb0b0');
          a.rect(13, 18, 18, 23, '#7fc4d9');                  // label
          a.rect(13, 18, 18, 18, '#c8ecf5');
          a.rect(15, 20, 16, 21, '#2b5a6a');
          a.px(14, 11, '#ffffff');                            // glass specular
        }),
        bob('apple', a => {
          /* The dimple at the stem and the lobe at the base are what separate
             an apple from a tomato at this size. */
          disc(a, 16, 19, 8, '#d13a3a', '#ff7a7a');
          a.rect(13, 11, 19, 12, 0);                          // carve the dimple
          a.rect(14, 12, 18, 12, '#b02c2c');
          a.px(12, 12, '#d13a3a'); a.px(20, 12, '#d13a3a');
          disc(a, 13, 16, 3, '#e86a6a', null);
          a.px(12, 15, '#ffb0b0'); a.px(13, 14, '#ffd0d0');
          a.rect(21, 17, 22, 22, '#9a2424');
          a.px(15, 26, '#9a2424'); a.px(18, 26, '#9a2424');   // base lobes
          a.rect(16, 7, 17, 12, '#6b4a2e');                   // stem
          a.px(16, 7, '#8a6340');
          for (let d = 0; d < 6; d++) a.rect(18 + d, 7 - Math.round(d * 0.4), 18 + d, 9 - Math.round(d * 0.4), '#4f8f3a');
          a.px(18, 8, '#7bc255'); a.px(21, 7, '#7bc255');
        })
      ]
    };
  }

  /* ============================================================== TILES ====
     A 64x64 sheet of sixteen 16x16 tiles. One sheet rather than sixteen
     templates because a tileset is only useful whole — you drop it into a map
     editor and slice it there.

     offsetApi translates but does NOT clip, so every tile is authored strictly
     inside its own 16x16 box: a primitive one pixel over the edge paints into
     the neighbour and the seam shows up the moment the sheet is tiled. */
  function tileSuite() {
    const cell = (a, cx, cy) => P().offsetApi(a, cx * 16, cy * 16);
    return {
      width: 64, height: 64, name: 'Farm Tiles', layers: [{ name: 'tiles' }],
      states: [D('sheet', 1, false, still(a => {
        // --- row 0: ground -------------------------------------------------
        const dirt = cell(a, 0, 0);
        for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++)
          dirt.px(x, y, ((x + y) % 7) === 0 ? SOIL_L : ((x * 3 + y) % 5) === 0 ? SOIL_D : SOIL);
        speck(dirt, 0, 0, 15, 15, 3, ['#7a5438', '#5a3c26'], 0.4);

        /* Tilled soil: furrows on a 4px period running the full width so the
           tile butts up against its own copy without a visible join. */
        const till = cell(a, 1, 0);
        for (let y = 0; y < 16; y++) {
          const p = y % 4;
          for (let x = 0; x < 16; x++)
            till.px(x, y, p === 0 ? SOIL_D : p === 1 ? SOIL_L : p === 3 ? '#5a3c26' : SOIL);
        }
        speck(till, 0, 0, 15, 15, 5, [SOIL_D, SOIL_L], 0.2);

        const wet = cell(a, 2, 0);                            // watered furrows
        for (let y = 0; y < 16; y++) {
          const p = y % 4;
          for (let x = 0; x < 16; x++)
            wet.px(x, y, p === 0 ? '#2f2013' : p === 1 ? '#5f4128' : p === 3 ? '#38251a' : '#452e1c');
        }
        for (let k = 0; k < 6; k++) {                         // sheen in the furrow bottoms
          const x = Math.floor(wet.hash(k, 1, 13) * 14) + 1, y = (k % 4) * 4 + 3;
          wet.px(x, y, '#6b5a4a'); wet.px(x + 1, y, '#5a4a3a');
        }

        const grass = cell(a, 3, 0);
        for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++)
          grass.px(x, y, ((x * 5 + y * 3) % 11) === 0 ? '#3f7a2a' : ((x + y * 2) % 7) === 0 ? '#7bc255' : '#4f8f3a');
        for (let k = 0; k < 10; k++) {                         // blade ticks
          const x = Math.floor(grass.hash(k, 2, 17) * 15), y = Math.floor(grass.hash(k, 3, 17) * 14) + 1;
          grass.px(x, y, '#7bc255'); grass.px(x, y - 1, '#a8de84');
        }

        // --- row 1: variants -----------------------------------------------
        const tall = cell(a, 0, 1);
        for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) tall.px(x, y, '#3f7a2a');
        for (let k = 0; k < 14; k++) {
          const x = Math.floor(tall.hash(k, 4, 19) * 15), h = 3 + Math.floor(tall.hash(k, 5, 5) * 4);
          const y = 14 - Math.floor(tall.hash(k, 6, 7) * 3);
          for (let d = 0; d < h && y - d >= 1; d++) tall.px(x, y - d, d > h - 2 ? '#a8de84' : '#5f9a3a');
        }

        /* Flower meadow. Blossoms on a jittered 4x4 grid: hashed freely they
           collide into clumps that read as litter. */
        const flow = cell(a, 1, 1);
        for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++)
          flow.px(x, y, ((x + y * 2) % 7) === 0 ? '#7bc255' : '#4f8f3a');
        for (let k = 0; k < 4; k++) {
          const x = (k % 2) * 8 + 3 + Math.floor(flow.hash(k, 7, 4) * 3);
          const y = Math.floor(k / 2) * 8 + 3 + Math.floor(flow.hash(k, 8, 4) * 3);
          const c = k % 2 ? '#ffd24a' : '#e8e4f2', h = k % 2 ? '#fff0a8' : '#ffffff';
          flow.px(x, y - 1, c); flow.px(x - 1, y, c); flow.px(x + 1, y, c); flow.px(x, y + 1, c);
          flow.px(x, y, h);
        }

        /* Packed dirt path: grit over the base plus pebbles pressed into it,
           each with a lit top and a shadow under it. A flat fill with a few
           dark ticks on it read as a blank tan card. */
        const path = cell(a, 2, 1);
        for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++)
          path.px(x, y, ((x * 7 + y * 5) % 9) === 0 ? '#a98a68' : '#93765a');
        speck(path, 0, 0, 15, 15, 31, ['#7f6448', '#b09272'], 0.34);
        for (let k = 0; k < 7; k++) {
          const x = Math.floor(path.hash(k, 9, 13) * 13) + 1, y = Math.floor(path.hash(k, 10, 13) * 13) + 1;
          path.rect(x, y, x + 1, y, '#bdb09a');
          path.px(x, y, '#d6cbb6');
          path.rect(x, y + 1, x + 1, y + 1, '#6b5440');
        }

        /* Cobble: each stone a small rounded block with a dark joint all the
           way round it. Without the joint the tile is grey noise. */
        const cob = cell(a, 3, 1);
        cob.rect(0, 0, 15, 15, '#4a4f58');
        for (let ry = 0; ry < 3; ry++) {
          const off = (ry % 2) * 3;
          for (let rx = 0; rx < 3; rx++) {
            const x = rx * 5 + off - 1, y = ry * 5 + 1;
            if (x + 4 > 15 || x < 0) continue;
            cob.rect(x, y, x + 3, y + 3, STONE);
            cob.rect(x, y, x + 3, y, STONE_HI);
            cob.rect(x, y + 3, x + 3, y + 3, STONE_SH);
            cob.px(x, y, '#c8ced6');
          }
        }

        // --- row 2: floors and walls ---------------------------------------
        const hay = cell(a, 0, 2);                             // hay-strewn floor
        hay.rect(0, 0, 15, 15, '#8a6f30');
        for (let k = 0; k < 22; k++) {
          const x = Math.floor(hay.hash(k, 11, 19) * 13), y = Math.floor(hay.hash(k, 12, 19) * 15);
          const len = 2 + Math.floor(hay.hash(k, 13, 3) * 2);
          hay.rect(x, y, Math.min(15, x + len), y, k % 3 ? '#d8b455' : '#efd07a');
        }

        /* Floorboards: planks running horizontally with staggered butt joints.
           Every board the same length gives a grid that reads as tiling, not
           as a floor. */
        const plank = cell(a, 1, 2);
        for (let y = 0; y < 16; y++) {
          const p = y % 4;
          for (let x = 0; x < 16; x++) plank.px(x, y, p === 3 ? WOOD_D : p === 0 ? WOOD_HI : WOOD);
        }
        /* Grain runs ALONG the board as short horizontal streaks. Scattering
           single darker pixels down each course instead put vertical ticks
           between the seams and the floor read as a brick wall. */
        for (let k = 0; k < 11; k++) {
          const band = k % 4, y = band * 4 + 1 + (k % 2);
          const x = Math.floor(plank.hash(k, 14, 23) * 11);
          const len = 3 + Math.floor(plank.hash(k, 15, 23) * 4);
          plank.rect(x, y, Math.min(15, x + len), y, k % 3 ? WOOD_SH : '#b9895f');
        }
        // butt joints on alternate boards only — one in every course is mortar
        for (let band = 0; band < 4; band += 2) {
          const jx = (band * 7 + 4) % 15;
          plank.rect(jx, band * 4, jx, band * 4 + 2, WOOD_D);
          plank.px(jx + 1, band * 4 + 1, WOOD_HI);
        }

        const wall = cell(a, 2, 2);                            // painted barn siding
        planks(wall, 0, 0, 15, 15, PAINT, PAINT_HI, PAINT_SH);
        wall.rect(0, 7, 15, 7, PAINT_SH);                      // mid rail
        wall.rect(0, 8, 15, 8, '#5f1c1c');

        const brick = cell(a, 3, 2);                           // stone wall
        brick.rect(0, 0, 15, 15, '#3f444c');
        for (let ry = 0; ry < 4; ry++) {
          const off = (ry % 2) * 4;
          for (let rx = -1; rx < 3; rx++) {
            const x = rx * 8 + off, y = ry * 4;
            const x0 = Math.max(0, x), x1 = Math.min(15, x + 6);
            if (x1 < x0) continue;
            brick.rect(x0, y, x1, y + 2, STONE);
            brick.rect(x0, y, x1, y, STONE_HI);
            brick.rect(x0, y + 2, x1, y + 2, STONE_SH);
          }
        }

        // --- row 3: water, crop rows, fence --------------------------------
        const water = cell(a, 0, 3);
        for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++)
          water.px(x, y, ((x + y) % 8) < 4 ? '#2f6f9a' : '#27618a');
        for (let k = 0; k < 5; k++) {                          // ripple crests
          const y = k * 3 + 1, x = Math.floor(water.hash(k, 14, 11) * 9);
          water.rect(x, y, x + 4, y, '#6bb0d9');
          water.px(x + 1, y, '#a8dcf2');
        }

        const cropA = cell(a, 1, 3);                           // young crop row
        for (let y = 0; y < 16; y++) {
          const p = y % 4;
          for (let x = 0; x < 16; x++) cropA.px(x, y, p === 0 ? SOIL_D : p === 1 ? SOIL_L : SOIL);
        }
        for (let k = 0; k < 8; k++) {
          const x = (k % 4) * 4 + 2, y = Math.floor(k / 4) * 8 + 6;
          cropA.px(x, y, LEAF); cropA.px(x - 1, y + 1, LEAF); cropA.px(x + 1, y + 1, LEAF);
          cropA.px(x, y - 1, LEAF_HI);
        }

        const cropB = cell(a, 2, 3);                           // ripe crop row
        for (let y = 0; y < 16; y++) {
          const p = y % 4;
          for (let x = 0; x < 16; x++) cropB.px(x, y, p === 0 ? SOIL_D : SOIL);
        }
        for (let k = 0; k < 8; k++) {
          const x = (k % 4) * 4 + 2, base = Math.floor(k / 4) * 8 + 7;
          for (let d = 0; d < 6; d++) cropB.px(x, base - d, d > 3 ? '#e8c96a' : '#7f9a3a');
          cropB.px(x - 1, base - 4, '#c8a33a'); cropB.px(x + 1, base - 5, '#c8a33a');
        }

        const rail = cell(a, 3, 3);                            // fence over grass
        for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++)
          rail.px(x, y, ((x + y * 2) % 7) === 0 ? '#3f7a2a' : '#4f8f3a');
        rail.rect(0, 5, 15, 6, WOOD);
        rail.rect(0, 5, 15, 5, WOOD_HI);
        rail.rect(0, 10, 15, 11, WOOD);
        rail.rect(0, 10, 15, 10, WOOD_HI);
        rail.rect(7, 2, 9, 14, WOOD_SH);
        rail.rect(7, 2, 7, 14, WOOD);
        rail.rect(7, 2, 9, 2, WOOD_HI);
      }))]
    };
  }

  return { farmerSuite, animalSuite, cropSuite, buildSuite, toolSuite, produceSuite, tileSuite, beast, FARMER, CAN, SICKLE, toolArc, P, D, seq, cyc, still, draw, speck, disc, TAU };
})();
