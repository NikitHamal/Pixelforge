/* PixelForge Studio — Monsters & animals: slime, bat, ghost, mushroom, golem, chicken, wolf.
   Squash & stretch (scale x/y with constant volume), sine wing flaps, wavy ghost hems. */
window.PF = window.PF || {};
PF.Monsters = (() => {
  const C = h => PF.Color.hexToU32(h);
  const D = (name, fps, loop, frames) => ({ name, fps, loop, frames });
  const Fr = (duration, paint) => ({ duration, paint });
  const ms = fps => Math.round(1000 / fps);
  const apiFor = (buf, W, H) => PF.Pixel.makeApi(buf, W, H);
  const finish = (buf, W, H) => buf.set(PF.Raster.outline(buf, W, H, C('#181425')));

  /* ---------- SLIME ---------- */
  /* Same creature as the landing page hero demo, from the same row maps — the
     library version used to be a symmetric ellipse with tall black eyes and a
     mouth, which is a different character. The dome narrows to a 4px crown, the
     eyes are 2px dark green (not outline black), the glint is the stacked
     L/WW pair upper-left, and the base is its own shade band. No mouth. */
  const SLIME_A = ['......GGGG......', '....GGGGGGGG....', '...GGGGGGGGGG...', '..GGLLGGGGGGGG..',
    '..GLWWGGGGGGGG..', '.GGLWWGGGGGGGGG.', '.GGGGGOOGGOOGGG.', '.GGGGGOOGGOOGGG.',
    '.GGGGGGGGGGGGGG.', '.GGGGGGGGGGGGGG.', '..DDDDDDDDDDDD..'];
  const SLIME_B = ['.....GGGGGG.....', '...GGGGGGGGGG...', '..GGLLGGGGGGGG..', '.GGLWWGGGGGGGGG.',
    '.GGLWWGGGGGGGGG.', 'GGGGGGOOGGOOGGGG', 'GGGGGGOOGGOOGGGG', 'GGGGGGGGGGGGGGGG', '.DDDDDDDDDDDDDD.'];
  const SLIME_C = ['....GGGGGG....', '...GGGGGGGG...', '..GGLLGGGGGG..', '..GLWWGGGGGG..', '.GGLWWGGGGGGG.',
    '.GGGOOGGOOGG.', '.GGGOOGGOOGG.', '.GGGGGGGGGGG.', '.GGGGGGGGGGG.', '..GGGGGGGGG..', '..GGGGGGGGG..', '...GGGGGGG...', '..DDDDDDDDD..'];
  const SLIME_E = ['......GGGGGG......', '....GGGGGGGGGG....', '..GGLLGGGGGGGGGG..', '.GGLWWGGGGGGGGGGG.',
    'GGGGGOOGGOOGGGGGGG', '.DDDDDDDDDDDDDDDD.'];
  const SLIME_F = ['.......GGGGGGGG.......', '.....GGGGGGGGGGGG.....', '...GGGGGGGGGGGGGGGGG...', '....DDDDDDDDDDDDDDDD....'];
  const SLIME_PAL = { G: '#63c74d', L: '#a8f28a', W: '#ffffff', O: '#265c42', D: '#3e8948' };
  const SLIME_FLASH = { G: '#ffffff', L: '#f2f2f2', W: '#ffffff', O: '#bfe8b8', D: '#e6e6e6' };

  /* Close the eyes without moving them: wipe every O cell back to body green,
     then keep the single middle row so the blink is a slit in the same place. */
  function slimeRows(rows, blink) {
    if (!blink) return rows;
    const eyeRows = rows.reduce((n, r) => n + (r.includes('O') ? 1 : 0), 0);
    const mid = rows.findIndex(r => r.includes('O')) + (eyeRows >> 1);
    return rows.map((r, i) => i === mid ? r : r.replace(/O/g, 'G'));
  }
  function slimeFrame(rows, o = {}) {
    return (buf, W, H) => {
      const api = apiFor(buf, W, H);
      const src = slimeRows(rows, o.blink);
      /* Pad every row to the map's own width before centring. The stretch maps
         were authored with ragged rows, so measuring only the widest one left
         the narrower rows offset by a pixel and the slime leaned. */
      const w = src.reduce((m, r) => Math.max(m, r.length), 0);
      const map = src.map(r => { const pad = w - r.length, l = pad >> 1; return '.'.repeat(l) + r + '.'.repeat(pad - l); });
      // seat the base band on y26 so the outline lands on y27, clear of the
      // shadow row the engine draws at y29; lift raises airborne frames off it
      PF.Raster.paintRows(buf, W, H, map, o.hurt ? SLIME_FLASH : SLIME_PAL, Math.round((W - w) / 2), 27 - map.length - (o.lift || 0));
      finish(buf, W, H);
    };
  }
  function slimeSuite() {
    return { width: 32, height: 32, name: 'slime', layers: [{ name: 'Body' }], states: [
      D('idle', 5, true, [Fr(ms(5), slimeFrame(SLIME_A)), Fr(ms(5), slimeFrame(SLIME_B)), Fr(ms(5), slimeFrame(SLIME_A, { blink: true })), Fr(ms(5), slimeFrame(SLIME_B))]),
      D('walk', 6, true, [Fr(ms(6), slimeFrame(SLIME_A)), Fr(ms(6), slimeFrame(SLIME_B)), Fr(ms(6), slimeFrame(SLIME_C)), Fr(ms(6), slimeFrame(SLIME_B))]),
      // the apex rises rather than blinking: two identical maps with a few eye
      // pixels removed is a 4px delta, which is a stall, not a jump
      D('jump', 10, true, [Fr(ms(10), slimeFrame(SLIME_B)), Fr(ms(10), slimeFrame(SLIME_C)), Fr(ms(10), slimeFrame(SLIME_C, { lift: 3 })), Fr(ms(10), slimeFrame(SLIME_E))]),
      D('hurt', 8, true, [Fr(ms(8), slimeFrame(SLIME_C, { hurt: true })), Fr(ms(8), slimeFrame(SLIME_E, { hurt: true }))]),
      D('death', 8, false, [Fr(ms(8), slimeFrame(SLIME_C, { hurt: true })), Fr(ms(8), slimeFrame(SLIME_B)), Fr(ms(8), slimeFrame(SLIME_E)), Fr(ms(8), slimeFrame(SLIME_F))])
    ] };
  }

  /* ---------- BAT ---------- */
  function batFrame(flap, hurt) {
    return (buf, W, H) => {
      const api = apiFor(buf, W, H), cx = 16, cy = 14 + (flap === 1 ? -2 : 0);
      const B = hurt ? '#ffffff' : '#5a6988', Wd = hurt ? '#e8e8e8' : '#3a4466';
      // wings: flap 0 = up, 1 = mid, 2 = down
      const wy = flap === 0 ? cy - 5 : flap === 2 ? cy + 1 : cy - 2;
      const reach = flap === 1 ? 9 : 12;
      api.line(cx - 3, cy, cx - reach, wy, B, 3);
      api.line(cx + 3, cy, cx + reach, wy, B, 3);
      api.line(cx - 3, cy, cx - reach, wy, Wd, 1);
      api.line(cx + 3, cy, cx + reach, wy, Wd, 1);
      // wing fingers
      api.px(cx - reach, wy - 1, Wd); api.px(cx + reach, wy - 1, Wd);
      // body
      api.ellipse(cx - 4, cy - 4, cx + 4, cy + 4, B, true);
      api.ellipse(cx - 4, cy + 1, cx + 4, cy + 4, Wd, true);
      // ears
      api.line(cx - 3, cy - 4, cx - 4, cy - 7, B, 2); api.line(cx + 3, cy - 4, cx + 4, cy - 7, B, 2);
      // eyes (red)
      api.px(cx - 2, cy - 1, hurt ? '#181425' : '#ff0044'); api.px(cx + 2, cy - 1, hurt ? '#181425' : '#ff0044');
      // fangs
      api.px(cx - 1, cy + 3, '#ffffff'); api.px(cx + 1, cy + 3, '#ffffff');
      finish(buf, W, H);
    };
  }
  function batSuite() {
    return { width: 32, height: 32, name: 'bat', layers: [{ name: 'Body' }], states: [
      D('fly', 10, true, [Fr(ms(10), batFrame(0)), Fr(ms(10), batFrame(1)), Fr(ms(10), batFrame(2)), Fr(ms(10), batFrame(1))]),
      D('hurt', 8, true, [Fr(ms(8), batFrame(1, true)), Fr(ms(8), batFrame(2))]),
      D('death', 8, false, [Fr(ms(8), batFrame(1, true)), Fr(ms(8), batFrame(2, true)), Fr(ms(8), (buf, W, H) => { const api = apiFor(buf, W, H); api.ellipse(12, 22, 20, 27, '#3a4466', true); finish(buf, W, H); })])
    ] };
  }

  /* ---------- GHOST ---------- */
  function ghostFrame(phase, hurt, vanish) {
    return (buf, W, H) => {
      const api = apiFor(buf, W, H), cx = 16, bob = Math.round(Math.sin(phase * Math.PI * 2) * -2);
      const G = hurt ? '#ffffff' : '#c0cbdc', Sh = '#8b9bb4';
      const top = 6 + bob, h = 16;
      // head + body
      api.ellipse(cx - 7, top, cx + 7, top + 10, G, true);
      api.rect(cx - 7, top + 5, cx + 7, top + h, G);
      api.rect(cx + 4, top + 5, cx + 7, top + h, Sh);
      // wavy hem: sine cut
      for (let x = -7; x <= 7; x++) {
        const cut = Math.round((Math.sin((x / 7) * Math.PI * 2 + phase * Math.PI * 2) * 0.5 + 0.5) * 3);
        for (let y = top + h - cut; y <= top + h; y++) buf[y * W + (cx + x)] = 0;
      }
      if (vanish !== undefined) {
        // fade top→bottom
        const keep = 1 - vanish;
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
          if (y > top + h * keep && buf[y * W + x] && (x + y) % 2 === 0) buf[y * W + x] = 0;
        }
      }
      // face: big hollow eyes + wail mouth
      const ey = top + 6;
      api.ellipse(cx - 5, ey, cx - 2, ey + 4, '#181425', true);
      api.ellipse(cx + 2, ey, cx + 5, ey + 4, '#181425', true);
      api.px(cx - 4, ey + 1, '#ffffff'); api.px(cx + 3, ey + 1, '#ffffff');
      api.ellipse(cx - 2, ey + 6, cx + 2, ey + 9, '#181425', true);
      // arms
      api.rect(cx - 10, top + 8, cx - 8, top + 13, G);
      api.rect(cx + 8, top + 8, cx + 10, top + 13, G);
      finish(buf, W, H);
    };
  }
  function ghostSuite() {
    return { width: 32, height: 32, name: 'ghost', layers: [{ name: 'Body' }], states: [
      D('float', 5, true, [0, 1, 2, 3].map(i => Fr(ms(5), ghostFrame(i / 4)))),
      D('hurt', 8, true, [Fr(ms(8), ghostFrame(0, true)), Fr(ms(8), ghostFrame(0.25))]),
      D('vanish', 8, false, [0.2, 0.45, 0.7, 0.95].map(v => Fr(ms(8), ghostFrame(0, false, v))))
    ] };
  }

  /* ---------- MUSHROOM ---------- */
  function mushroomFrame(squash, step, hurt) {
    return (buf, W, H) => {
      const api = apiFor(buf, W, H), cx = 16 + (step || 0), gy = 26;
      const Cap = hurt ? '#ffffff' : '#e43b44', CapD = hurt ? '#ddd' : '#a22633', Spot = '#ffffff', Stem = '#ead4aa', StemD = '#c8b28a';
      const ch = squash ? 7 : 8;
      // stem
      api.rect(cx - 4, gy - 9, cx + 4, gy, Stem);
      api.rect(cx + 2, gy - 9, cx + 4, gy, StemD);
      // feet nubs
      api.rect(cx - 6, gy - 2, cx - 4, gy, Stem); api.rect(cx + 4, gy - 2, cx + 6, gy, Stem);
      // cap
      api.ellipse(cx - 9, gy - 9 - ch, cx + 9, gy - 7, Cap, true);
      api.rect(cx - 9, gy - 9, cx + 9, gy - 7, Cap);
      api.ellipse(cx - 9, gy - 8, cx + 9, gy - 7, CapD, true);
      // spots
      api.rect(cx - 5, gy - 9 - ch + 2, cx - 3, gy - 9 - ch + 4, Spot);
      api.rect(cx + 1, gy - 9 - ch + 1, cx + 4, gy - 9 - ch + 4, Spot);
      api.px(cx - 7, gy - 9, Spot);
      // face
      api.px(cx - 2, gy - 5, '#181425'); api.px(cx + 2, gy - 5, '#181425');
      api.line(cx - 1, gy - 3, cx + 1, gy - 3, '#181425', 1);
      finish(buf, W, H);
    };
  }
  function mushroomSuite() {
    return { width: 32, height: 32, name: 'mushroom', layers: [{ name: 'Body' }], states: [
      D('idle', 4, true, [Fr(ms(4), mushroomFrame(false)), Fr(ms(4), mushroomFrame(true)), Fr(ms(4), mushroomFrame(false)), Fr(ms(4), mushroomFrame(true))]),
      D('walk', 6, true, [Fr(ms(6), mushroomFrame(false, -1)), Fr(ms(6), mushroomFrame(true, 0)), Fr(ms(6), mushroomFrame(false, 1)), Fr(ms(6), mushroomFrame(true, 0))]),
      D('hurt', 8, true, [Fr(ms(8), mushroomFrame(false, 0, true)), Fr(ms(8), mushroomFrame(true))]),
      D('death', 8, false, [Fr(ms(8), mushroomFrame(false, 0, true)), Fr(ms(8), mushroomFrame(true, 0, true)), Fr(ms(8), (buf, W, H) => { const api = apiFor(buf, W, H); api.ellipse(10, 22, 22, 26, '#a22633', true); finish(buf, W, H); })])
    ] };
  }

  /* ---------- GOLEM ---------- */
  function golemFrame(pose, hurt) {
    return (buf, W, H) => {
      const api = apiFor(buf, W, H);
      const R1 = hurt ? '#ffffff' : '#8b9bb4', R2 = hurt ? '#e8e8e8' : '#5a6988', R3 = '#3a4466', Eye = '#2ce8f5';
      const bob = pose.bob || 0, Y = y => y + bob;
      const aDy = pose.armDy || 0, aDx = pose.armDx || 0, lDy = pose.legDy || 0;
      /* A golem is a boulder that stood up, not a plus sign. The old form ran
         both arms out sideways in one straight bar at chest height, square-ended
         and handless, on a rectangular torso of exactly the same height: the
         universal read for an unposed placeholder. Everything here answers to
         gravity instead — a shoulder shelf wider than the waist, arms that fall
         PAST the hip into knuckle-dragging fists, and a head sunk between the
         shoulders with no neck to hold it up. */
      // legs: short and planted, set well inside the waist so the mass reads top-heavy
      /* Two legs need daylight between them or they render as one plinth the
         same width as the waist, and the golem stops having legs at all. */
      api.rect(10, Y(23 + lDy), 13, Y(27), R2); api.rect(18, Y(23 - lDy), 21, Y(27), R2);
      api.rect(10, Y(26), 13, Y(27), R3); api.rect(18, Y(26), 21, Y(27), R3);
      api.px(10, Y(23 + lDy), R3); api.px(21, Y(23 - lDy), R3);
      /* Torso as per-row spans, not a rectangle: the shelf flares at the
         shoulder and steps in twice on the way to the belt. A stone body drawn
         as one box has no corner to catch the light, which is what made the
         old one read as masonry rather than as a creature. */
      const TOR = [[12, 9, 22], [13, 8, 23], [14, 7, 24], [15, 7, 24], [16, 9, 22],
        [17, 10, 21], [18, 10, 21], [19, 11, 20], [20, 11, 20], [21, 11, 20], [22, 12, 19], [23, 12, 19]];
      for (const [y, x0, x1] of TOR) {
        api.rect(x0, Y(y), x1, Y(y), R1);
        api.rect(x1 - 2, Y(y), x1, Y(y), R2);   // light falls from the upper left
        api.px(x0, Y(y), R2);
      }
      api.px(7, Y(14), R2); api.px(24, Y(14), R3);   // chipped shoulder corners
      // cracks — two strokes that follow the taper rather than cutting across it
      api.line(13, Y(14), 15, Y(18), R3, 1); api.line(15, Y(18), 14, Y(22), R3, 1);
      api.line(20, Y(15), 19, Y(19), R3, 1);
      // core crystal, sunk into the chest with a lit rim
      api.rect(15, Y(17), 18, Y(20), R3);
      api.rect(15, Y(17), 17, Y(19), Eye); api.px(16, Y(18), '#ffffff');
      /* Arms: shoulder, forearm, fist — every segment BELOW the shoulder line.
         aDx/aDy still drive the attack, so a raised smash now travels from the
         hip to over the head instead of from one T-pose to another. */
      const arm = (x, out, sock, dx, dy) => {
        /* The joint is drawn as a stroke from the shoulder socket to the top of
           the upper arm, so the limb stays welded to the body at every armDy the
           attack and walk ask for. Without it the arms detach into floating
           bricks the moment they swing — the outline pass rims each island. */
        api.line(sock, Y(15), x + 2 + dx, Y(14 + dy), R2, 3);
        api.rect(x + dx, Y(14 + dy), x + 4 + dx, Y(17 + dy), R2);          // upper arm
        api.rect(x + out + dx, Y(14 + dy), x + out + dx, Y(17 + dy), R3);  // outer shade
        api.rect(x - 1 + dx, Y(18 + dy), x + 4 + dx, Y(22 + dy), R1);      // fist
        api.rect(x - 1 + dx, Y(21 + dy), x + 4 + dx, Y(22 + dy), R2);
        api.px(x + out + dx, Y(22 + dy), R3);                              // knuckle shadow
      };
      arm(3, 0, 9, aDx, aDy); arm(24, 4, 22, -aDx, -aDy);
      // head: a slab sunk into the shelf, heavy brow, eyes lit from inside
      api.rect(12, Y(5), 19, Y(12), R1);
      api.rect(17, Y(5), 19, Y(12), R2);
      api.rect(12, Y(5), 19, Y(6), R3);                                    // brow
      api.px(12, Y(5), R2); api.px(19, Y(5), R2);                          // chipped crown
      api.rect(13, Y(8), 14, Y(9), Eye); api.rect(17, Y(8), 18, Y(9), Eye);
      api.rect(13, Y(11), 18, Y(12), R2);                                  // jaw
      // moss, on the upward-facing surfaces only
      api.px(10, Y(13), '#63c74d'); api.px(21, Y(14), '#63c74d');
      api.px(13, Y(6), '#63c74d'); api.px(12, Y(20), '#3e8948');
      finish(buf, W, H);
    };
  }
  function golemSuite() {
    const walk = [0, 1, 2, 3].map(i => { const s = Math.sin((i / 4) * Math.PI * 2); return Fr(ms(6), golemFrame({ bob: Math.round(-Math.abs(s)), legDy: Math.round(s * 2), armDy: Math.round(-s * 2) })); });
    return { width: 32, height: 32, name: 'golem', layers: [{ name: 'Body' }], states: [
      D('idle', 4, true, [Fr(ms(4), golemFrame({})), Fr(ms(4), golemFrame({ bob: -1 })), Fr(ms(4), golemFrame({})), Fr(ms(4), golemFrame({ bob: -1 }))]),
      D('walk', 6, true, walk),
      D('attack', 8, true, [Fr(ms(8), golemFrame({ armDy: -4, armDx: -1 })), Fr(ms(8), golemFrame({ armDy: -1 })), Fr(ms(8), golemFrame({ armDy: 3, armDx: 2 })), Fr(ms(8), golemFrame({})), Fr(ms(8), golemFrame({ bob: -1 }))]),
      D('hurt', 8, true, [Fr(ms(8), golemFrame({}, true)), Fr(ms(8), golemFrame({}))]),
      D('death', 8, false, [Fr(ms(8), golemFrame({}, true)), Fr(ms(8), golemFrame({ bob: 3 })), Fr(ms(8), golemFrame({ bob: 6 })), Fr(ms(8), (buf, W, H) => { const api = apiFor(buf, W, H); api.rect(6, 22, 12, 26, '#5a6988'); api.rect(14, 24, 20, 27, '#8b9bb4'); api.rect(22, 23, 27, 26, '#3a4466'); api.rect(15, 22, 17, 24, '#2ce8f5'); finish(buf, W, H); })])
    ] };
  }

  /* ---------- CHICKEN ---------- */
  /* ---------- CHICKEN ---------- */
  /* The old bird was three white ellipses and two orange sticks — no tail, no
     feather structure, a wing you could only find by its outline. A chicken
     reads at 32px from four things: the fanned sickle tail, a serrated comb,
     a wattle under the beak, and a wing sitting on the flank as its own mass.
     Build those four and the silhouette is unmistakable at 1x. */
  const HEN = {
    B: '#ffffff', S: '#d3dcea', SS: '#a7b4cb', D: '#7b879e',
    comb: '#e43b44', combHi: '#f6757a', combSh: '#a22633',
    beak: '#feae34', beakSh: '#c06a1e', leg: '#e4a672', legSh: '#a86b45', eye: '#181425'
  };
  function chickenFrame(pose) {
    return (buf, W, H) => {
      const api = apiFor(buf, W, H), C = HEN;
      const cx = 15 + (pose.dx || 0), hop = pose.hop || 0, Y = y => y - hop;
      const wing = pose.wing || 0;
      const peck = typeof pose.peck === 'number' ? pose.peck : (pose.peck ? 3 : 0);

      /* Legs: a scaly shank with three forward toes and a spur behind. The far
         one is a rung darker, or the pair merges into one post. */
      const legAt = (x, up, c, cs) => {
        const fy = Y(27) - up;
        api.rect(x, Y(20), x + 1, fy, c);
        api.px(x + 1, Y(23), cs); api.px(x + 1, Y(25), cs);      // scale breaks
        api.rect(x - 1, fy, x + 3, fy, c);                        // toes
        api.px(x + 3, fy - 1, c); api.px(x - 2, fy, cs);          // outer toe, spur
      };
      legAt(cx + 3, pose.lift || 0, C.legSh, '#7d4e30');          // far leg
      /* Tail before the body: the sickles tuck UNDER the rump, which is what
         makes them read as feathers growing out of it rather than sticks
         leaning against it. */
      api.line(cx - 4, Y(16), cx - 10, Y(8), C.S, 3);
      api.line(cx - 4, Y(17), cx - 9, Y(11), C.B, 2);
      api.line(cx - 4, Y(19), cx - 10, Y(15), C.SS, 2);
      api.line(cx - 4, Y(20), cx - 9, Y(19), C.D, 1);

      // body: an egg, big end forward, sunlit across the back
      api.ellipse(cx - 6, Y(12), cx + 6, Y(23), C.B, true);
      api.ellipse(cx - 6, Y(17), cx + 1, Y(23), C.S, true);
      api.ellipse(cx + 2, Y(19), cx + 6, Y(23), C.S, true);
      api.ellipse(cx - 4, Y(11), cx + 4, Y(16), C.B, true);
      api.rect(cx - 3, Y(11), cx + 2, Y(11), '#ffffff');

      // wing: its own almond, with covert rows and primaries laid over the flank
      const wy = Y(14) + wing;
      api.ellipse(cx - 5, wy, cx + 3, wy + 7, C.SS, true);
      api.ellipse(cx - 5, wy, cx + 2, wy + 5, C.S, true);
      api.ellipse(cx - 4, wy, cx + 1, wy + 3, C.B, true);
      for (let k = 0; k < 3; k++) api.line(cx - 5 + k, wy + 4 + k, cx + 2 - k * 2, wy + 5 + k, C.D, 1);
      api.px(cx - 3, wy + 1, '#ffffff');

      legAt(cx - 1, 0, C.leg, C.legSh);                           // near leg

      // neck: a tapered cone of hackle feathers, not a tube
      const hy = Y(6) + peck, hxc = cx + 7;
      for (let i = 0; i <= 6; i++) {
        const t = i / 6;
        const x = Math.round(cx + 2 + t * 5), y = Math.round(Y(14) + (hy + 5 - Y(14)) * t);
        const w = Math.max(2, Math.round(4 - t * 1.6));
        api.rect(x - w, y, x + w - 1, y, C.B);
        api.px(x - w, y, C.SS); api.px(x + w - 1, y, C.S);
        if (i % 2) api.px(x + w - 2, y, C.S);                     // feather partings
      }

      // head, comb, wattle, beak
      api.ellipse(hxc - 3, hy, hxc + 3, hy + 6, C.B, true);
      api.ellipse(hxc - 2, hy + 1, hxc + 2, hy + 4, '#ffffff', true);
      api.rect(hxc - 3, hy + 5, hxc + 1, hy + 6, C.S);
      api.rect(hxc - 3, hy - 1, hxc + 3, hy, C.comb);             // comb base
      for (const [dx0, h] of [[-3, 2], [-1, 3], [1, 3], [3, 2]])  // serrations
        api.rect(hxc + dx0, hy - h, hxc + dx0, hy - 1, C.comb);
      api.px(hxc - 1, hy - 3, C.combHi); api.px(hxc + 3, hy - 2, C.combSh);
      api.rect(hxc, hy + 6, hxc + 1, hy + 8, C.comb);             // wattle
      api.px(hxc + 1, hy + 8, C.combSh); api.px(hxc, hy + 6, C.combHi);
      for (let i = 0; i < 4; i++) {                               // beak: a closing wedge
        const k = i >> 1;
        api.rect(hxc + 3 + i, hy + 2 + k, hxc + 3 + i, hy + 5 - k, C.beak);
      }
      api.rect(hxc + 3, hy + 4, hxc + 5, hy + 4, C.beakSh);       // gape line
      api.px(hxc + 3, hy + 2, '#fee761');
      api.rect(hxc, hy + 1, hxc + 1, hy + 2, C.eye);
      api.px(hxc + 1, hy + 1, '#ffffff');
      finish(buf, W, H);
    };
  }
  function chickenSuite() {
    const C = HEN;
    return { width: 32, height: 32, name: 'chicken', layers: [{ name: 'Body' }], states: [
      D('idle', 5, true, [Fr(ms(5), chickenFrame({})), Fr(ms(5), chickenFrame({ wing: 1 })),
        Fr(ms(5), chickenFrame({ peck: 1 })), Fr(ms(5), chickenFrame({ wing: 1, peck: 1 }))]),
      D('walk', 8, true, [Fr(ms(8), chickenFrame({ hop: 0, peck: 1 })), Fr(ms(8), chickenFrame({ hop: 1, lift: 2 })),
        Fr(ms(8), chickenFrame({ hop: 0, dx: 1 })), Fr(ms(8), chickenFrame({ hop: 1, lift: 2, dx: 1, peck: 1 }))]),
      D('peck', 7, true, [Fr(ms(7), chickenFrame({})), Fr(ms(7), chickenFrame({ peck: 4 })),
        Fr(ms(7), chickenFrame({ peck: 8, lift: 1 })), Fr(ms(7), chickenFrame({ peck: 3, wing: 1 }))]),
      /* Death: flat on its back with the legs in the air. A grey puddle told
         the player nothing; this reads as a dead chicken from across the map. */
      D('death', 7, false, [
        Fr(ms(7), chickenFrame({ wing: -2, peck: -1 })),
        Fr(ms(7), chickenFrame({ hop: 2, wing: -3, peck: 2 })),
        Fr(ms(7), (buf, W, H) => {
          const api = apiFor(buf, W, H);
          api.ellipse(8, 21, 24, 27, C.B, true);
          api.ellipse(9, 24, 23, 27, C.S, true);
          api.line(7, 22, 2, 18, C.S, 2); api.line(7, 23, 3, 21, C.SS, 2);   // tail, flopped
          api.rect(13, 17, 14, 21, C.leg); api.rect(17, 16, 18, 21, C.leg);  // legs up
          api.rect(12, 16, 15, 17, C.leg); api.rect(16, 15, 19, 16, C.leg);
          api.ellipse(22, 22, 28, 27, C.B, true);                            // head, lolling
          api.rect(22, 21, 27, 22, C.comb);
          api.px(24, 20, C.comb); api.px(26, 20, C.comb);
          api.rect(25, 24, 26, 25, '#181425'); api.px(26, 24, C.SS);         // shut eye, X
          api.px(25, 25, C.SS);
          api.rect(28, 25, 30, 26, C.beak);
          finish(buf, W, H);
        })
      ])
    ] };
  }

  /* ---------- WOLF ---------- */
  /* Rebuilt. Every part of the old wolf was an axis-aligned rectangle — a 20x8
     box for the body, a 7x7 box for the head, four 3x6 boxes for legs — which
     at 32px is the universal read for placeholder art: a grey slab on four
     grey posts. A canine in profile is a deep chest and a round haunch with a
     dip in the back between them, a head carried LOW and forward of the
     shoulders, and legs that fold. Three values do the rest: dark saddle over
     the spine, mid flank, pale belly and ruff. */
  function wolfFrame(gallop, hurt, lying, extraBob) {
    return (buf, W, H) => {
      const api = apiFor(buf, W, H);
      const Bk = hurt ? '#e8e8e8' : '#41506b';      // saddle along the spine
      const F = hurt ? '#ffffff' : '#6d7d99';       // flank
      const Lt = hurt ? '#ffffff' : '#b9c6da';      // belly, ruff, muzzle
      const Dk = hurt ? '#c0cbdc' : '#333d52';      // far limbs and shadow
      if (lying) {
        // Collapsed on its side: the ribcage flattens, the legs fold forward
        // and the head lies out along the ground rather than tucked under.
        const D2 = hurt === 'dead' ? '#3b465e' : Dk, F2 = hurt === 'dead' ? '#55627d' : F;
        api.ellipse(5, 21, 23, 27, F2, true);
        api.ellipse(5, 21, 23, 23, D2, true);
        api.ellipse(8, 25, 20, 27, hurt === 'dead' ? '#6d7d99' : Lt, true);
        for (const lx of [9, 13, 17]) { api.rect(lx, 24, lx + 1, 27, D2); api.px(lx, 27, Bk); }
        api.line(5, 23, 1, 20, D2, 2);                       // tail, limp
        api.ellipse(21, 19, 29, 25, F2, true);               // head down on the ground
        api.rect(28, 22, 30, 24, hurt === 'dead' ? '#6d7d99' : Lt);
        api.px(30, 23, '#181425');
        api.px(24, 21, '#181425'); api.px(25, 21, '#181425');  // eyes shut
        finish(buf, W, H); return;
      }
      const bY = (gallop !== undefined ? Math.round(Math.sin(gallop * Math.PI * 2) * -1.5) : 0) + (extraBob || 0);
      const legSwing = gallop !== undefined ? Math.sin(gallop * Math.PI * 2) : 0;
      const Y = y => y + bY;
      const l1 = Math.round(legSwing * 3), l2 = Math.round(-legSwing * 3);

      /* A folded leg: thigh, shank kicked the other way, then a paw flat on the
         ground. Four straight posts is what made the old one a table. */
      const leg = (hx, sw, c, paw) => {
        api.rect(hx + Math.round(sw * 0.4), Y(19), hx + 2 + Math.round(sw * 0.4), Y(22), c);
        api.rect(hx + sw, Y(22), hx + 2 + sw, Y(26), c);
        api.rect(hx - 1 + sw, Y(26), hx + 3 + sw, Y(27), paw);
        api.px(hx - 1 + sw, Y(27), '#181425');
      };
      // far pair first, in shadow, so the near pair reads as nearer
      leg(9, l2, Dk, Dk); leg(20, l1, Dk, Dk);

      // barrel: haunch and chest as two masses with a dip between them
      api.ellipse(3, Y(14), 15, Y(23), F, true);            // hindquarters
      api.ellipse(13, Y(12), 24, Y(22), F, true);           // deep chest
      api.ellipse(8, Y(16), 19, Y(22), F, true);            // the loin joining them
      api.ellipse(3, Y(13), 22, Y(17), Bk, true);           // saddle over the spine
      api.ellipse(6, Y(19), 21, Y(22), Lt, true);           // belly
      api.line(4, Y(14), 13, Y(13), Bk, 1);
      // shoulder ruff: the one place a wolf's coat breaks its own outline
      for (const [rx, ry] of [[15, 12], [17, 11], [19, 12], [14, 14], [20, 14]]) api.px(rx, Y(ry), Lt);
      // guard hairs, deterministic so build() stays pure
      for (let x = 5; x < 22; x++) if (api.hash(x, 3, 91) > 0.72) api.px(x, Y(12 + (x % 3)), Dk);

      // near pair, over the body
      leg(6, l1, F, Lt); leg(18, l2, F, Lt);

      // tail: carried low and bushy, swinging against the stride
      /* Carried low and tapering. As a disc up at the top of the frame it read
         as a pom-pom stuck to the rump. */
      const tw = Math.round(legSwing * 2);
      api.line(5, Y(17), 2, Y(15 + tw), Bk, 4);
      api.line(2, Y(15 + tw), 0, Y(12 + tw), Bk, 3);
      api.line(3, Y(16 + tw), 1, Y(13 + tw), F, 1);        // lit upper edge
      api.px(0, Y(11 + tw), Bk); api.px(1, Y(11 + tw), F);

      // neck and head, low and thrust forward the way a hunting canine carries it
      api.line(21, Y(15), 25, Y(11), F, 5);
      api.ellipse(22, Y(7), 29, Y(14), F, true);
      api.ellipse(22, Y(7), 27, Y(10), Bk, true);           // dark brow and crown
      api.rect(27, Y(11), 30, Y(13), Lt);                   // muzzle
      api.rect(27, Y(13), 30, Y(13), F);                    // jaw line
      api.px(30, Y(11), '#181425');                         // nose
      api.px(28, Y(14), '#ffffff'); api.px(29, Y(14), '#ffffff');  // fangs
      /* Short, broad-based triangles set close together. Two long 2px strokes
         four pixels apart is a rabbit — or worse, antlers. */
      const inner = hurt ? '#e8e8e8' : '#8b6b7a';
      api.rect(22, Y(4), 23, Y(4), Bk); api.rect(22, Y(5), 24, Y(5), Bk); api.rect(22, Y(6), 25, Y(6), Bk);
      api.px(23, Y(6), inner); api.px(23, Y(5), inner);
      api.rect(28, Y(4), 29, Y(4), Bk); api.rect(27, Y(5), 29, Y(5), Bk); api.rect(26, Y(6), 29, Y(6), Bk);
      api.px(28, Y(6), inner); api.px(28, Y(5), inner);
      api.px(26, Y(9), hurt ? '#181425' : '#ff0044');       // eye
      api.px(25, Y(9), '#181425');
      finish(buf, W, H);
    };
  }
  function wolfSuite() {
    return { width: 32, height: 32, name: 'wolf', layers: [{ name: 'Body' }], states: [
      D('idle', 4, true, [0, 0.06, 0, -0.06].map(g => Fr(ms(4), wolfFrame(g)))),
      D('run', 10, true, [0, 1, 2, 3, 4, 5].map(i => {
        const a = (i / 6) * Math.PI * 2;
        return Fr(ms(10), wolfFrame(i / 6, false, false, Math.round(-Math.cos(a))));
      })),
      D('attack', 10, true, [Fr(ms(10), wolfFrame(0.1)), Fr(ms(12), wolfFrame(0.3)), Fr(ms(12), wolfFrame(0.5))]),
      D('hurt', 8, true, [Fr(ms(8), wolfFrame(undefined, true)), Fr(ms(8), wolfFrame(0))]),
      D('death', 8, false, [Fr(ms(8), wolfFrame(undefined, true)), Fr(ms(8), wolfFrame(undefined, false, true)), Fr(ms(8), wolfFrame(undefined, 'dead', true))])
    ] };
  }

  /* ---------- BOAR ---------- */
  /* A low, forward-leaning hunchback: shoulder mass higher than the rump, a
     spiky bristle crest running the whole back, a long pale muzzle and an
     upturned bone tusk. Built from overlapping ellipses rather than one
     symmetric body, because a symmetric body reads as a pig.
     Two house rules still bind it: legs are painted BEFORE the body and start
     above the body's underside at their own x (an ellipse curves up at its
     edges, so legs begun at the centre line hang free of the shoulders), and
     the bob only ever LIFTS, or the hooves walk through the floor line into the
     engine's shadow row and the outline pass fuses them to it. */
  /* The old hide and highlight were four luma apart, so every form on the
     animal — hump, jowl, haunch — resolved to one brown mass. Widened. */
  const BOAR_PAL = {
    hide: '#7a4230', hi: '#b06a44', rim: '#cf8a5b', sh: '#41200f', rust: '#8f3f26', legFar: '#552b1c',
    bristle: '#241a22', hoof: '#241318', muzzle: '#c9b6a8', tusk: '#f2ece0', eye: '#f6f0e0'
  };
  const BOAR_FLASH = {
    hide: '#ffffff', hi: '#f4f4f4', rim: '#ffffff', sh: '#d8d8d8', rust: '#ececec', legFar: '#e4e4e4',
    bristle: '#c4c4c4', hoof: '#b8b8b8', muzzle: '#ffffff', tusk: '#ffffff', eye: '#181425'
  };
  function boarFrame(o = {}) {
    const c = o.hurt ? BOAR_FLASH : BOAR_PAL;
    return (buf, W, H) => {
      const api = apiFor(buf, W, H);
      if (o.lying) {
        api.ellipse(7, 20, 22, 26, c.hide, true);
        api.ellipse(13, 19, 23, 23, c.hi, true);
        api.rect(23, 20, 29, 24, c.hide);                     // head slumped down
        api.rect(27, 22, 30, 24, c.muzzle);
        api.px(25, 21, c.bristle); api.px(26, 21, c.eye);
        api.line(28, 24, 30, 22, c.tusk, 1);                  // tusk still hooked
        for (let x = 9; x <= 20; x++) api.px(x, 19, c.bristle);            // crest, unbroken
        api.px(12, 18, c.bristle); api.px(16, 18, c.bristle); api.px(19, 18, c.bristle);
        api.px(6, 21, c.bristle); api.px(5, 20, c.bristle);
        finish(buf, W, H); return;
      }
      const bob = o.bob || 0, hd = o.headDy || 0, br = o.bristle || 0;
      const Y = y => y + bob;
      const ph = o.phase;
      /* A leg LIFTS; it never slides sideways out from under the shoulder that
         owns it. Each of the four carries its own phase offset — a four-beat
         gallop — because two legs sharing a phase quantises to the same lift on
         frames 1 and 2 and stalls the cycle. */
      const lift = k => ph === undefined ? 0 : -Math.round(Math.max(0, Math.sin((ph + k) * Math.PI * 2)) * 2);
      /* A boar's leg is heavy at the haunch and drops to a thin cannon bone
         above a cloven trotter. The old one was a 3x7 rectangle with a dark
         cap — four identical table legs under a good body. */
      const leg = (x, dy, near) => {
        const col = near ? c.hide : c.legFar;
        const hip = Y(17 + dy), knee = Y(21 + dy), toe = Y(24 + dy);
        for (let y = hip; y <= knee; y++) {
          const w = 2 - Math.round(((y - hip) / (knee - hip)) * 1);
          api.rect(x, y, x + w + 1, y, col);
          if (near) api.px(x, y, c.hi);
        }
        for (let y = knee; y <= toe; y++) { api.rect(x, y, x + 2, y, col); if (near) api.px(x, y, c.hi); }
        api.rect(x, toe + 1, x + 2, toe + 2, c.hoof);
        api.px(x + 1, toe + 1, c.sh);                    // the cleft in the trotter
      };
      leg(8, lift(0), true); leg(12, lift(0.75), false);
      leg(17, lift(0.5), true); leg(21, lift(0.25), false);
      // two masses, not one: the rump sits low, the shoulders carry the hump
      api.ellipse(6, Y(15), 15, Y(22), c.hide, true);
      api.ellipse(11, Y(12), 24, Y(22), c.hide, true);
      api.ellipse(13, Y(12), 22, Y(16), c.hi, true);          // sunlit shoulder cap
      api.ellipse(14, Y(12), 21, Y(14), c.rim, true);         // rim along the hump
      api.ellipse(7, Y(15), 13, Y(18), c.hi, true);           // the rump catches it too
      /* Belly shadow following the barrel, not a rectangle stamped across it:
         a straight dark bar under a curved body reads as a painted stripe. */
      for (let x = 8; x <= 22; x++) {
        const u = (x - 8) / 14, d = Math.round(Math.sin(u * Math.PI) * 1.6);
        api.rect(x, Y(21 - d), x, Y(22), c.sh);
        api.px(x, Y(21 - d), c.legFar);
      }
      if (o.saddle) {
        // War-mount blanket over the shoulders. Drawn BEFORE the crest so the
        // bristles still poke out of its top edge — a saddle that buries the
        // ridge loses the silhouette that makes this a boar at all. It has to
        // flash with the hide, or a hurt frame leaves red patches on a white
        // silhouette and the frame stops reading as one lit body.
        const sad = o.hurt ? '#ffffff' : o.saddle, sadSh = o.hurt ? '#e0e0e0' : (o.saddleSh || '#3b1a1a');
        api.rect(12, Y(12), 21, Y(18), sad);
        api.rect(12, Y(18), 21, Y(19), sadSh);
        api.px(13, Y(17), sadSh); api.px(20, Y(17), sadSh);
      }
      // bristle crest: follows the real back line, rump to neck
      const backY = x => (x <= 17 ? 16 - (x - 7) * 0.4 : 12 + (x - 17) * 0.25) + bob - br;
      for (let x = 8; x <= 21; x++) {
        api.px(x, Math.round(backY(x)), c.rust);
        api.px(x, Math.round(backY(x)) - 1, c.bristle);
        if ((x & 1) === 0) api.px(x, Math.round(backY(x)) - 2, c.bristle);
      }
      // curled tail, connected: three loose pixels left one floating island
      // that the outline pass boxed in behind the rump.
      api.px(6, Y(16), c.bristle); api.px(5, Y(15), c.bristle);
      api.px(5, Y(14), c.bristle); api.px(6, Y(13), c.rust); api.px(7, Y(14), c.bristle);
      // head: low and forward, so the shoulder hump stays the highest point.
      // A head level with the back has no neck and reads as a pig.
      const hY = y => y + bob + hd + (o.attack ? 1 : 0);
      /* Skull WEDGE, not a box: a boar's head narrows to the snout from a
         broad jowl, and it DROPS as it narrows. That downward rake is the
         whole difference between a boar and a brown crate with tusks. */
      for (let x = 21; x <= 29; x++) {
        const t = (x - 21) / 8;
        const top = hY(15) + Math.round(t * 3), bot = hY(21) - Math.round(t * 1.5);
        api.rect(x, top, x, bot, c.hide);
        api.px(x, top, c.hi);
        api.px(x, bot, c.sh);
      }
      /* Jowl shadow where the head meets the shoulder. Without it the skull is
         painted in the same brown it sits on and the boar has no neck. */
      for (let y = hY(15); y <= hY(20); y++) api.px(20, y, y > hY(17) ? c.sh : c.legFar);
      api.px(21, hY(20), c.legFar);
      api.rect(24, hY(16), 26, hY(16), c.rim);                          // brow ridge
      // ear: a short triangle raked back off the poll
      api.rect(22, hY(14), 25, hY(14), c.bristle);
      api.rect(22, hY(13), 24, hY(13), c.bristle);
      api.rect(22, hY(12), 23, hY(12), c.bristle);
      api.px(22, hY(11), c.rust);
      api.rect(25, hY(17), 26, hY(17), c.eye);                          // eye
      api.px(26, hY(17), c.bristle);
      api.rect(28, hY(19), 30, hY(21), c.muzzle);                       // pale snout disc
      api.rect(28, hY(19), 29, hY(19), '#e6d9cd');
      api.px(30, hY(20), c.bristle);                                    // nostril
      api.line(28, hY(21), 30, hY(17), c.tusk, 1);                      // upturned tusk
      api.px(30, hY(16), c.tusk); api.px(29, hY(20), '#c8bda8');
      if (o.dust) {
        // Earth, not the default slate: a boar turns up soil, and the cold tint
        // read as sparks flying off the tusks.
        const EARTH = '#8a6a4a';
        PF.Pixel.dustPuff(api, 10, 26, o.seed || 1, o.dust, EARTH);
        PF.Pixel.dustPuff(api, 21, 26, (o.seed || 1) + 7, o.dust, EARTH);
      }
      if (o.impact) PF.Pixel.impactStar(api, 30, hY(17), o.impact, ['#ffffff', '#c0cbdc']);
      // The rider paints into this same buffer BEFORE the outline pass, so one
      // pass traces both silhouettes and keeps the goblin readable against the
      // beast instead of smearing into it.
      if (o.rider) o.rider(api, o);
      finish(buf, W, H);
    };
  }
  /* ---------- GOBLIN BOAR-RIDER ---------- */
  /* The mount is the boar above, unchanged, plus a war saddle; the rider is a
     goblin in the same green as rpg_goblin so the two read as one faction.
     Everything is painted into one buffer and outlined once, which is what
     keeps the goblin's silhouette separate from the beast's instead of the pair
     merging into a brown-green blob. */
  const RIDER = {
    skin: '#63c74d', skinSh: '#3e8948', skinHi: '#a8f28a', cloth: '#733e39', clothSh: '#3e2731',
    strap: '#262b44', eye: '#181425', shaft: '#8a6a4a', steel: '#c0cbdc', steelHi: '#f2ece0'
  };
  const RIDER_FLASH = {
    skin: '#ffffff', skinSh: '#f0f0f0', skinHi: '#ffffff', cloth: '#e8e8e8', clothSh: '#d4d4d4',
    strap: '#c8c8c8', eye: '#181425', shaft: '#f0f0f0', steel: '#ffffff', steelHi: '#ffffff'
  };
  const SADDLE = '#8f2f2a', SADDLE_SH = '#4a1512';

  function drawRider(api, c, o) {
    /* The rider absorbs the deepest of the mount's bounces. Riding the full -2
       lift put the spearhead and the ear on row 0, where the canvas slices them
       and the outline pass has nowhere to draw — a tip that reads as cut off
       once the sprite is composited into a game. */
    const ry = Math.max(-1, o.bob || 0);
    // The head has its own clamp: on the hurt frame bob -1 stacks with headDy -1
    // and the ear tip walks off the top even though the body is inside budget.
    const hy = Math.max(-1, (o.bob || 0) + (o.headDy || 0));
    const Y = y => y + ry, HY = y => y + hy;
    // Legs drape over the flank in CLOTH, not skin: a bare green shin across the
    // red saddle read as a stripe laid on the boar rather than a rider's leg.
    api.rect(13, Y(12), 17, Y(14), c.cloth);
    api.rect(14, Y(15), 15, Y(18), c.clothSh);
    api.rect(13, Y(18), 16, Y(19), c.strap);
    // torso, hunched forward over the neck
    api.rect(14, Y(6), 19, Y(12), c.skin);
    api.rect(14, Y(6), 15, Y(12), c.skinSh);
    api.rect(15, Y(9), 19, Y(10), c.strap);                 // shoulder strap
    api.rect(13, Y(11), 18, Y(13), c.cloth);                // loincloth
    // head, low and thrust forward: a big ear sweeping back sells the goblin
    api.rect(16, HY(2), 21, HY(6), c.skin);
    api.rect(21, HY(4), 22, HY(5), c.skinSh);               // jaw
    api.line(16, HY(3), 13, HY(2), c.skin, 1);               // ear
    api.px(19, HY(3), c.eye); api.px(18, HY(3), c.skinHi);   // eye + glint
    api.px(20, HY(5), c.eye);                                // nostril
    // arm out to the grip
    api.line(18, HY(8), 21, HY(10), c.skin, 1);
    // spear: shaft pivots on the grip, so the thrust is an angle, not a redraw
    const a = o.spear === undefined ? -0.75 : o.spear, gx = 21, gy = HY(10);
    const len = 8, back = 4;
    const x0 = gx - Math.cos(a) * back, y0 = gy - Math.sin(a) * back;
    const x1 = gx + Math.cos(a) * len, y1 = gy + Math.sin(a) * len;
    api.line(x0, y0, x1, y1, c.shaft, 1);
    api.line(x1 - Math.cos(a) * 3, y1 - Math.sin(a) * 3, x1 + 1, y1, c.steel, 1);
    api.px(x1 + 1, y1, c.steelHi);
    if (o.impact) PF.Pixel.impactStar(api, x1 + 1, y1, o.impact, ['#ffffff', '#c0cbdc']);
  }

  function goblinRiderSuite() {
    const HEAD = [0, 1, 1, 0], BR = [0, 0, 1, 1];
    const mk = o => boarFrame({ ...o, saddle: SADDLE, saddleSh: SADDLE_SH,
      rider: (api, opts) => drawRider(api, opts.hurt ? RIDER_FLASH : RIDER, opts) });
    const idle = [];
    for (let i = 0; i < 4; i++) idle.push(Fr(ms(4), mk({ headDy: HEAD[i], bristle: BR[i], spear: -0.75 })));
    const trot = [];
    for (let i = 0; i < 6; i++) {
      const a = i / 6 * Math.PI * 2;
      trot.push(Fr(ms(6), mk({ phase: i / 6, headDy: i === 3 ? 1 : 0, spear: -0.75 + Math.sin(a) * 0.09,
        bob: Math.min(0, Math.round(-Math.abs(Math.sin(a)) - Math.cos(a) * 0.6)) })));
    }
    // charge — the lance drops from raised to level in one fast frame, which is
    // the whole read of a mounted thrust.
    const SP = [-0.95, -1.05, 0.05, 0.12, -0.35, -0.8];
    const charge = [];
    for (let i = 0; i < 6; i++) {
      const a = i / 6 * Math.PI * 2;
      charge.push(Fr(ms(12), mk({ attack: true, phase: i / 6, seed: i, spear: SP[i],
        bob: Math.min(0, Math.round(-Math.abs(Math.sin(a)) * 2)),
        dust: i === 0 || i === 3 ? 0.35 : i === 1 || i === 4 ? 0.8 : 0,
        impact: i === 2 || i === 3 ? 0.2 : 0 })));
    }
    return { width: 32, height: 32, name: 'goblin-rider', layers: [{ name: 'Body' }], states: [
      D('idle', 4, true, idle),
      D('trot', 6, true, trot),
      D('charge', 12, true, charge),
      D('hurt', 8, true, [Fr(60, mk({ hurt: true, bob: -1, spear: -1.05, headDy: -1 })), Fr(120, mk({ spear: -0.9 }))]),
      D('death', 8, false, [
        Fr(70, mk({ hurt: true, spear: -1.05, headDy: -1 })),
        Fr(130, mk({ headDy: 2, spear: 0.5 })),
        Fr(190, boarFrame({ lying: true }))
      ])
    ] };
  }
  function boarSuite() {
    const HEAD = [0, 1, 1, 0], BR = [0, 0, 1, 1];
    const idle = [];
    for (let i = 0; i < 4; i++) idle.push(Fr(ms(4), boarFrame({ headDy: HEAD[i], bristle: BR[i] })));
    const trot = [];
    for (let i = 0; i < 6; i++) {
      const a = i / 6 * Math.PI * 2;
      trot.push(Fr(ms(6), boarFrame({ phase: i / 6, headDy: i === 3 ? 1 : 0,
        bob: Math.min(0, Math.round(-Math.abs(Math.sin(a)) - Math.cos(a) * 0.6)) })));
    }
    const charge = [];
    for (let i = 0; i < 6; i++) {
      const a = i / 6 * Math.PI * 2;
      charge.push(Fr(ms(12), boarFrame({ attack: true, phase: i / 6, seed: i,
        bob: Math.min(0, Math.round(-Math.abs(Math.sin(a)) * 2)),
        dust: i === 0 || i === 3 ? 0.35 : i === 1 || i === 4 ? 0.8 : 0,
        impact: i === 2 ? 0.2 : 0 })));
    }
    return { width: 32, height: 32, name: 'boar', layers: [{ name: 'Body' }], states: [
      D('idle', 4, true, idle),
      D('trot', 6, true, trot),
      D('charge', 12, true, charge),
      D('hurt', 8, true, [Fr(60, boarFrame({ hurt: true, bob: -1 })), Fr(120, boarFrame({}))]),
      D('death', 8, false, [Fr(70, boarFrame({ hurt: true })), Fr(130, boarFrame({ headDy: 2 })), Fr(190, boarFrame({ lying: true }))])
    ] };
  }

  /* ---------- DRAKE / BABY DRAGON ---------- */
  function drakeFrame(flap, breath, hurt, sleep, zzIn) {
    return (buf, W, H) => {
      const api = apiFor(buf, W, H), cx = 16;
      if (sleep) {
        // zz rises the Z so the sleep loop actually animates
        const zz = zzIn || 0;
        api.ellipse(8, 18 + (zz === 2 ? 1 : 0), 24, 27, '#a22633', true);
        api.ellipse(10, 20 + (zz === 2 ? 1 : 0), 22, 26, '#ffd34e', true);
        api.px(21, 20, '#181425');
        api.px(24, 14 - zz, '#f77622'); api.px(25, 14 - zz, '#f77622'); api.px(24, 15 - zz, '#f77622');
        finish(buf, W, H); return;
      }
      const cy = 15 + (flap === 1 ? -2 : 0);
      const R = hurt ? '#ffffff' : '#e43b44', Dk = hurt ? '#e8e8e8' : '#a22633';
      const belly = hurt ? '#ffffff' : '#ffd34e', wing = hurt ? '#e8e8e8' : '#f07b2d', wingDk = hurt ? '#c0c0c0' : '#a22633';
      /* The old drake was a circle with a second, almost-as-big circle of belly
         dropped in the middle of it and four 2px lines for wings. At size that
         reads as a red animal carrying a beach ball. A flying reptile needs:
         a body LONGER than it is tall, the pale belly as a crescent along the
         underside rather than a disc in the centre, membrane wings with actual
         spars, and a neck that puts the head clear of the shoulders. */
      const wy = flap === 0 ? cy - 10 : flap === 2 ? cy + 1 : cy - 5;
      // far wing first: darker, shorter, behind everything
      const fan = (sx, sy, tx, ty, mem, spar, drop) => {
        for (let i = 1; i <= 5; i++) {
          const t = i / 5;
          const x = Math.round(sx + (tx - sx) * t), y = Math.round(sy + (ty - sy) * t);
          api.line(x, y, x, y + Math.round(drop * (1 - t * 0.6)), i % 2 ? mem : spar, 1);
        }
        api.line(sx, sy, tx, ty, spar, 2);
        api.px(tx, ty, '#fee761');                    // wing claw
      };
      fan(cx + 1, cy - 1, cx + 6, wy + 2, wingDk, wingDk, 4);
      // body: a long oval, tail-heavy, with the belly as an underside crescent
      api.ellipse(cx - 7, cy - 2, cx + 4, cy + 6, R, true);
      api.ellipse(cx - 6, cy - 2, cx - 1, cy + 2, Dk, true);   // haunch shadow
      api.ellipse(cx - 4, cy + 3, cx + 4, cy + 7, belly, true);
      api.line(cx - 4, cy + 3, cx + 3, cy + 2, hurt ? '#e8e8e8' : '#f77622', 1); // belly seam
      // hind leg + foot, so it has somewhere to land
      api.rect(cx - 3, cy + 6, cx - 1, cy + 9, Dk);
      api.rect(cx - 4, cy + 9, cx, cy + 9, belly);
      api.px(cx - 4, cy + 9, '#fee761'); api.px(cx, cy + 9, '#fee761');
      // tail: tapers over three segments to a barb
      api.line(cx - 7, cy + 2, cx - 11, cy + 4, R, 3);
      api.line(cx - 11, cy + 4, cx - 14, cy + 2, R, 2);
      api.line(cx - 12, cy + 3, cx - 14, cy + 2, Dk, 1);
      api.px(cx - 15, cy + 1, '#fee761'); api.px(cx - 15, cy + 2, '#fee761');
      // neck + head, clear of the shoulder line
      api.line(cx + 3, cy, cx + 6, cy - 4, R, 3);
      api.ellipse(cx + 4, cy - 8, cx + 10, cy - 2, R, true);
      api.ellipse(cx + 5, cy - 8, cx + 8, cy - 6, hurt ? '#ffffff' : '#f6757a', true);  // brow light
      api.rect(cx + 9, cy - 6, cx + 13, cy - 4, R);              // snout
      api.rect(cx + 9, cy - 4, cx + 13, cy - 4, Dk);             // jaw line
      api.px(cx + 13, cy - 5, belly);                            // nostril highlight
      api.px(cx + 9, cy - 3, '#e8ecf5'); api.px(cx + 11, cy - 3, '#e8ecf5');  // teeth
      api.line(cx + 4, cy - 8, cx + 1, cy - 12, '#fee761', 2);   // horn
      api.line(cx + 7, cy - 9, cx + 6, cy - 11, '#fee761', 1);   // crest spike
      api.px(cx + 8, cy - 6, hurt ? '#181425' : '#fee761');
      api.px(cx + 8, cy - 7, '#181425');
      // near wing: over the body, full span
      fan(cx, cy - 2, cx - 9, wy, wing, wingDk, 6);
      if (breath) {
        api.ellipse(cx + 13, cy - 7, cx + 20, cy - 3, '#f07b2d', true);
        api.ellipse(cx + 15, cy - 6, cx + 19, cy - 4, '#ffe27a', true);
        api.px(cx + 21, cy - 5, '#ffffff');
      }
      finish(buf, W, H);
    };
  }
  function drakeSuite() {
    return { width: 32, height: 32, name: 'drake', layers: [{ name: 'Body' }], states: [
      D('idle', 5, true, [Fr(ms(5), drakeFrame(0)), Fr(ms(6), drakeFrame(1)), Fr(ms(6), drakeFrame(2)), Fr(ms(6), drakeFrame(1))]),
      D('fly', 8, true, [Fr(ms(8), drakeFrame(0)), Fr(ms(10), drakeFrame(1)), Fr(ms(10), drakeFrame(2)), Fr(ms(10), drakeFrame(1))]),
      D('fire_breath', 7, true, [Fr(ms(7), drakeFrame(1)), Fr(ms(7), drakeFrame(1, true)), Fr(ms(7), drakeFrame(2, true)), Fr(ms(7), drakeFrame(0))]),
      D('hurt', 8, true, [Fr(ms(8), drakeFrame(1, false, true)), Fr(ms(8), drakeFrame(1))]),
      D('sleep', 4, true, [0, 1, 2, 3].map(z => Fr(ms(4), drakeFrame(0, false, false, true, z))))
    ] };
  }

  return { slimeSuite, batSuite, ghostSuite, mushroomSuite, golemSuite, chickenSuite, wolfSuite, boarSuite, goblinRiderSuite, drakeSuite };
})();

