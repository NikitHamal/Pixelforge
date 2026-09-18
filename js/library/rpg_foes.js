/* PixelForge Studio — RPG Foes pack: goblin, necromancer, demon (humanoid rig)
   + red dragon, giant spider, mimic, wisp, slime king, ancient ent (custom rigs). */
window.PF = window.PF || {};
PF.RPG = PF.RPG || {};
PF.RPG.foes = (() => {
  const P = () => PF.Pixel;
  const D = (name, fps, loop, frames) => ({ name, fps, loop, frames });
  const Fr = (duration, paint) => ({ duration, paint });
  const ms = fps => Math.round(1000 / fps);
  const R = PF.RPG, PAL = () => R.PAL;
  const apiFor = (buf, W, H) => P().makeApi(buf, W, H);
  const OUT32 = PF.Color.hexToU32('#181425'); // cached: one lookup, not one per frame
  const finish = (buf, W, H) => buf.set(PF.Raster.outline(buf, W, H, OUT32));

  /* ============ humanoid foes (shared rig) ============ */
  function goblinSuite() {
    return R.humanoidSuite(PAL().GOBLIN, 'rpg-goblin', { weapon: 'sword', sneak: true, head: { goblinEars: true } });
  }
  function necromancerSuite() {
    return R.humanoidSuite(PAL().NECRO, 'rpg-necromancer', {
      weapon: 'staff', cast: true, castColors: ['#b55088', '#68386c', '#2ce8f5'],
      head: { skull: true, hood: '#3e2347', hoodSh: '#262b44' }
    });
  }
  function demonSuite() {
    return R.humanoidSuite(PAL().DEMON, 'rpg-demon', {
      weapon: 'sword',
      garb: { wings: '#a22633', wingsSh: '#5c1a1a', tail: '#a22633', tailTip: '#fee761' },
      head: { horns: '#ead4aa', hornsSh: '#c28569' }
    });
  }

  /* ============ RED DRAGON (custom rig, faces right) ============ */
  const DBASE = '#a22633', DMID = '#e43b44', DBELLY = '#ead4aa', DBELLYSH = '#c28569', BONE = '#ead4aa';
  function dragonFrame(o = {}) {
    return (buf, W, H) => {
      const api = apiFor(buf, W, H), i = o.i || 0, dy = o.dy || 0;
      const Y = y => y + dy;
      // tail (behind): segments + spade
      api.line(8, Y(21), 2, Y(25), DBASE, 3);
      api.line(2, Y(25), 1, Y(23), DBASE, 2);
      api.px(1, Y(22), BONE); api.px(1, Y(24), BONE); api.px(2, Y(24), BONE);
      // far wing (folded hint when idle)
      // body
      api.ellipse(6, Y(16), 24, Y(24), DBASE, true);
      api.ellipse(8, Y(19), 22, Y(24), DBELLY, true);
      api.ellipse(8, Y(19), 22, Y(21), '#fff6c9', true);
      api.rect(6, Y(16), 24, Y(17), DMID);
      // back spikes
      [10, 15, 20].forEach(x => { api.line(x, Y(16), x + 1, Y(12), BONE, 2); api.px(x + 1, Y(12), '#ffffff'); });
      // legs — one row short of the old y28, which put the outline on y29 and
      // fused the feet to the engine's shadow row
      api.rect(12, Y(23), 15, Y(27), DBASE); api.rect(12, Y(26), 15, Y(27), BONE);
      api.rect(19, Y(23), 22, Y(27), DBASE); api.rect(19, Y(26), 22, Y(27), BONE);
      /* neck + head, pulled one column inside the frame. The snout used to end
         on x31, the last column, so the outline pass had nowhere to draw and
         the head read as sliced off at the right edge of the sheet. */
      api.rect(20, Y(11), 24, Y(19), DBASE);
      api.rect(21, Y(7), 28, Y(13), DBASE);
      api.rect(25, Y(9), 30, Y(13), DMID); // snout
      api.rect(25, Y(12), 30, Y(13), DBELLYSH); // jaw shade
      api.px(29, Y(10), '#3e2731'); // nostril
      // horns sweeping back
      api.line(22, Y(7), 18, Y(4), BONE, 2); api.line(24, Y(7), 21, Y(3), BONE, 2);
      // eye: angry yellow + brow
      api.rect(23, Y(9), 24, Y(10), '#fee761'); api.px(23, Y(9), '#181425');
      api.line(22, Y(8), 25, Y(8), DBASE, 1);
      // near wing
      const flap = o.flap !== undefined ? o.flap : (o.fold ? -1 : 1);
      wing(api, 13, Y(14), flap, i);
      if (o.fire !== undefined) dragonFire(api, o.fire);
      if (o.smoke) { api.px(30, Y(7), '#8b9bb4'); api.px(29, Y(5), '#5a6988'); }
      if (o.flash) P().flashWhite(api, W, H, buf);
      finish(buf, W, H);
      if (o.fade) R.fadeOut(buf, W, H, o.fade, 5);
    };
  }
  function wing(api, sx, sy, flap, i) {
    const mem = '#e43b44', dark = '#5c1a1a';
    // flap: -1 folded, 0 mid, 1 up, 2 down
    let tx, ty;
    if (flap === -1) { tx = sx + 6; ty = sy - 2; }
    else if (flap === 0) { tx = sx - 8; ty = sy - 2; }
    else if (flap === 1) { tx = sx - 6; ty = sy - 10; }
    else { tx = sx - 4; ty = sy + 8; }
    for (let k = 0; k <= 5; k++) {
      const t = k / 5, x0 = Math.round(sx + (tx - sx) * t), y0 = Math.round(sy + (ty - sy) * t);
      api.line(x0, y0, x0 + 1, y0 + 2 + Math.round((1 - t) * 3), k % 2 ? mem : dark, 1);
    }
    api.line(sx, sy, tx, ty, dark, 2);
    api.px(tx, ty, BONE);
    void i;
  }
  function dragonFire(api, stage) {
    // fireball spit at snout (29,11): grow -> fly -> burst. Kept one column
    // inside the frame so the burst keeps its outline instead of being sheared.
    if (stage === 0) { api.rect(27, 10, 29, 12, '#fee761'); api.px(28, 11, '#ffffff'); }
    else if (stage === 1) { api.ellipse(25, 9, 29, 13, '#f77622', true); api.ellipse(26, 10, 28, 12, '#fee761', true); api.px(27, 11, '#ffffff'); }
    else if (stage === 2) { api.line(28, 11, 30, 11, '#f77622', 2); api.ellipse(26, 8, 30, 13, '#f77622', true); api.ellipse(27, 9, 29, 12, '#fee761', true); api.px(28, 10, '#ffffff'); }
    else { P().sparks(api, 29, 11, 2, '#fee761', 10, 2, 5); api.ellipse(26, 8, 30, 13, '#ffffff', false); }
  }
  function dragonSuite() {
    return { width: 32, height: 32, name: 'rpg-dragon', layers: [{ name: 'Body' }], states: [
      D('idle', 5, true, [0, 1, 2, 3].map(i => Fr(ms(5), dragonFrame({ i, dy: i % 2 ? -1 : 0, fold: true, smoke: i === 3 })))),
      D('fly', 10, true, [0, 1, 2, 3].map(i => Fr(ms(10), dragonFrame({ i, dy: [0, -1, -2, 0][i], flap: [1, 0, 2, 0][i] })))),
      D('fireball', 10, true, [0, 1, 2, 3].map(i => Fr(ms(10), dragonFrame({ i, fire: i, fold: true })))),
      D('hurt', 8, true, [Fr(ms(8), dragonFrame({ flash: true, fold: true })), Fr(ms(8), dragonFrame({ dy: 1, fold: true }))]),
      D('death', 6, false, [
        Fr(ms(6), dragonFrame({ flash: true, fold: true })),
        Fr(ms(6), dragonFrame({ dy: 3, flap: 2, fold: false })),
        Fr(ms(6), dragonFrame({ dy: 3, flap: 2, fold: false, fade: 0.45 })),
        Fr(ms(6), dragonFrame({ dy: 3, flap: 2, fold: false, fade: 0.85 }))
      ])
    ] };
  }

  /* ============ SPIDER FAMILY (side view, faces right) ============ */
  // Built like the classic cartoon reference: the BODY dominates (big abdomen
  // ball + thorax ball), legs are short + chunky and hang DOWN, eyes glossy.
  // One parameterised rig drives the whole family — giant spider, the small
  // swarm spiderling and the egg-laden queen boss — so they share a silhouette
  // language and stay pixel-aligned to the same 32x32 grid.
  const SDIR = [-1.5, -0.5, 0.5, 1.5]; // back pair points back, front pair forward
  const SPIDER_PAL = { body: '#3e2347', sh: '#262b44', hi: '#68386c', leg: '#5b3a6e', legHi: '#8f6fae', eye: '#ff0044' };
  const LING_PAL = { body: '#265c42', sh: '#193c3e', hi: '#3e8948', leg: '#3e8948', legHi: '#63c74d', eye: '#fee761' };
  const QUEEN_PAL = { body: '#3e2731', sh: '#262b44', hi: '#733e39', leg: '#733e39', legHi: '#b86f50', eye: '#ff0044' };
  const GEO = {
    giant: { shadowW: 6, hips: [9, 13, 17, 21], hipY: 20, footY: 25, wFar: 2, wNear: 3,
      ab: [4, 8, 17, 22], abHi: [5, 9, 10, 14], spots: [[12, 11], [14, 13], [10, 15]],
      waist: [17, 14, 17, 21], head: [19, 13, 26, 22], headHi: [20, 14, 23, 16],
      eye: [23, 15, 24, 17], sat: [[22, 14], [25, 14], [26, 16]],
      fangs: [[23, 21, 22, 24], [25, 21, 26, 24]], palp: [24, 21, 25, 23] },
    ling: { shadowW: 4, hips: [10, 13, 16, 19], hipY: 22, footY: 26, wFar: 1, wNear: 2,
      ab: [7, 13, 17, 22], abHi: [8, 14, 12, 17], spots: [[12, 16], [15, 18]],
      waist: [17, 17, 17, 21], head: [18, 15, 23, 21], headHi: [19, 16, 21, 18],
      eye: [19, 17, 20, 18], sat: [[18, 16], [21, 16]],
      fangs: [[19, 21, 18, 23], [21, 21, 22, 23]], palp: [20, 21, 21, 22] },
    queen: { shadowW: 8, hips: [8, 12, 16, 20], hipY: 19, footY: 25, wFar: 2, wNear: 4,
      ab: [1, 7, 16, 22], abHi: [3, 9, 9, 15], spots: [[10, 10], [13, 12], [8, 16], [12, 19]],
      waist: [16, 13, 16, 19], head: [18, 12, 27, 23], headHi: [19, 13, 23, 16],
      eye: [24, 15, 25, 17], sat: [[23, 13], [26, 13], [27, 16], [22, 17]],
      fangs: [[24, 21, 23, 24], [26, 21, 27, 24]], palp: [25, 21, 26, 23],
      egg: [[5, 8], [8, 7], [11, 8], [6, 10], [9, 10], [12, 11], [7, 12]],
      marks: [[9, 18], [11, 20], [6, 20]] }
  };
  function spiderFrame(o = {}) {
    return (buf, W, H) => {
      const api = apiFor(buf, W, H), i = o.i || 0, rear = o.rear || 0;
      const g = o.geo || GEO.giant, p = o.pal || SPIDER_PAL;
      // slim contact shadow; feet never pass y25 so one clear row always
      // separates them and the outline pass can't fuse legs + shadow
      // Calm idle: the legs shuffle in place (li still follows i) but the body
      // never lifts — a whole-body bob on a standing spider reads as hopping.
      const li = i;
      const lift = rear ? -3 : (o.calm ? 0 : (i % 2 ? -1 : 0));
      const Y = y => y + lift;
      // one leg: hip under the body -> knee bowing out -> foot planted below.
      // far legs first (dark, 1px higher = depth), near legs over the body.
      function leg(l, far) {
        const hx = g.hips[l], hy = Y(g.hipY);
        const up = ((l + li) % 2 === 0) ? -2 : 0;
        const raised = rear && l >= 2 ? -5 : 0; // threat display lifts front legs
        const dir = SDIR[l];
        const kx = Math.round(hx + dir * 2.5), ky = hy - 2 + (up >> 1) + (raised ? -3 : 0);
        const fx = Math.round(hx + dir * 4), fy = g.footY + (up >> 1) + (far ? -1 : 0) + (raised ? -5 : 0);
        const c = far ? p.sh : p.leg, w = far ? g.wFar : g.wNear;
        api.line(hx, hy, kx, ky, c, w);
        api.line(kx, ky, fx, fy, c, w);
        if (!far) api.line(hx, hy - 1, kx, ky - 1, p.legHi, 1); // femur top light
        api.px(fx, fy, '#181425');
      }
      for (let l = 0; l < 4; l++) leg(l, true);
      // abdomen: big round ball with top sheen + spots + spinnerets
      api.ellipse(g.ab[0], Y(g.ab[1]), g.ab[2], Y(g.ab[3]), p.body, true);
      api.ellipse(g.abHi[0], Y(g.abHi[1]), g.abHi[2], Y(g.abHi[3]), p.hi, true);
      g.spots.forEach(([sx, sy]) => api.px(sx, Y(sy), p.hi));
      api.line(g.ab[0], Y(g.ab[3] - 3), g.ab[0] - 1, Y(g.ab[3] - 1), p.sh, 2);
      // queen: pale egg cluster riding the abdomen, plus gold carapace marks
      if (g.egg) { g.egg.forEach(([ex, ey], k) => api.px(ex, Y(ey), k % 3 === 0 ? '#fff6c9' : '#e8ecf5')); }
      if (g.marks) { g.marks.forEach(([mx, my]) => api.px(mx, Y(my), '#fee761')); }
      // waist seam (starts below the abdomen crown so it can never poke out
      // of the silhouette as a floating fin), then the cephalothorax ball
      api.line(g.waist[0], Y(g.waist[1]), g.waist[2], Y(g.waist[3]), p.sh, 2);
      api.ellipse(g.head[0], Y(g.head[1]), g.head[2], Y(g.head[3]), p.body, true);
      api.ellipse(g.headHi[0], Y(g.headHi[1]), g.headHi[2], Y(g.headHi[3]), p.hi, true);
      for (let l = 0; l < 4; l++) leg(l, false);
      // face: big glossy eye + satellite eyes, short fangs, one palp
      const ec = o.flash ? '#ffffff' : p.eye;
      api.rect(g.eye[0], Y(g.eye[1]), g.eye[2], Y(g.eye[3]), ec); api.px(g.eye[0], Y(g.eye[1]), '#ffffff');
      g.sat.forEach(([sx, sy]) => api.px(sx, Y(sy), ec));
      g.fangs.forEach(([x0, y0, x1, y1]) => api.line(x0, Y(y0), x1, Y(y1), '#e8ecf5', 1));
      api.line(g.palp[0], Y(g.palp[1]), g.palp[2], Y(g.palp[3]), p.leg, 2);
      // web spit: strand reeling out from the chelicerae, then a sticky glob
      if (o.web) {
        const wx = 26 + o.web * 2, wy = Y(15 - o.web);
        api.line(25, Y(18), wx, wy, '#8b9bb4', 1);
        api.ellipse(wx - 1, wy - 1, wx + 1, wy + 1, '#e8ecf5', true);
        api.px(wx, wy - 1, '#ffffff');
      }
      if (o.flash) P().flashWhite(api, W, H, buf);
      finish(buf, W, H);
      if (o.fade) R.fadeOut(buf, W, H, o.fade, 9);
    };
  }
  function spiderSuite() {
    return { width: 32, height: 32, name: 'rpg-spider', layers: [{ name: 'Body' }], states: [
      D('idle', 5, true, [0, 1, 2, 3].map(i => Fr(ms(5), spiderFrame({ i, calm: true })))),
      D('crawl', 8, true, [0, 1, 2, 3].map(i => Fr(ms(8), spiderFrame({ i })))),
      D('lunge', 12, true, [Fr(ms(12), spiderFrame({ rear: 0 })), Fr(ms(12), spiderFrame({ rear: 1 })), Fr(ms(12), spiderFrame({ rear: 0, i: 1 })), Fr(ms(12), spiderFrame({ rear: 1, i: 1 }))]),
      D('spit', 10, true, [
        Fr(120, spiderFrame({ i: 0, rear: 1 })),
        Fr(80, spiderFrame({ i: 1, rear: 1 })),
        Fr(80, spiderFrame({ i: 0, web: 1 })),
        Fr(80, spiderFrame({ i: 1, web: 2 })),
        Fr(120, spiderFrame({ i: 0 }))
      ]),
      D('hurt', 8, true, [Fr(ms(8), spiderFrame({ flash: true })), Fr(ms(8), spiderFrame({ i: 1 }))]),
      D('death', 6, false, [Fr(ms(6), spiderFrame({ flash: true })), Fr(ms(6), spiderFrame({ rear: 1 })), Fr(ms(6), spiderFrame({ rear: 1, fade: 0.5 })), Fr(ms(6), spiderFrame({ rear: 1, fade: 0.85 }))])
    ] };
  }
  /* Small swarm crawler: same rig, tighter silhouette, skittering gait. */
  function spiderlingSuite() {
    const F = o => spiderFrame({ ...o, geo: GEO.ling, pal: LING_PAL });
    return { width: 32, height: 32, name: 'rpg-spiderling', layers: [{ name: 'Body' }], states: [
      D('idle', 6, true, [0, 1, 2, 3].map(i => Fr(ms(6), F({ i, calm: true })))),
      D('crawl', 10, true, [0, 1, 2, 3].map(i => Fr(ms(10), F({ i })))),
      D('lunge', 14, true, [Fr(ms(14), F({})), Fr(ms(14), F({ rear: 1 })), Fr(ms(14), F({ i: 1 })), Fr(ms(14), F({ rear: 1, i: 1 }))]),
      D('hurt', 10, true, [Fr(ms(10), F({ flash: true })), Fr(ms(10), F({ i: 1 }))]),
      D('death', 8, false, [Fr(ms(8), F({ flash: true })), Fr(ms(8), F({ rear: 1 })), Fr(ms(8), F({ rear: 1, fade: 0.5 })), Fr(ms(8), F({ rear: 1, fade: 0.85 }))])
    ] };
  }
  /* Brood mother: heavy abdomen, egg sac, extra eye ring, gold carapace. */
  function spiderQueenSuite() {
    const F = o => spiderFrame({ ...o, geo: GEO.queen, pal: QUEEN_PAL });
    return { width: 32, height: 32, name: 'rpg-spider-queen', layers: [{ name: 'Body' }], states: [
      D('idle', 4, true, [0, 1, 2, 3].map(i => Fr(ms(4), F({ i, calm: true })))),
      D('crawl', 6, true, [0, 1, 2, 3].map(i => Fr(ms(6), F({ i })))),
      D('lunge', 10, true, [Fr(ms(10), F({})), Fr(ms(10), F({ rear: 1 })), Fr(ms(10), F({ i: 1 })), Fr(ms(10), F({ rear: 1, i: 1 }))]),
      D('spit', 8, true, [
        Fr(130, F({ i: 0, rear: 1 })),
        Fr(90, F({ i: 1, rear: 1 })),
        Fr(90, F({ i: 0, web: 1 })),
        Fr(90, F({ i: 1, web: 2 })),
        Fr(130, F({ i: 0 }))
      ]),
      D('hurt', 8, true, [Fr(ms(8), F({ flash: true })), Fr(ms(8), F({ i: 1 }))]),
      D('death', 5, false, [
        Fr(ms(5), F({ flash: true })),
        Fr(ms(5), F({ rear: 1 })),
        Fr(ms(5), F({ rear: 1, fade: 0.45 })),
        Fr(ms(5), F({ rear: 1, fade: 0.8 }))
      ])
    ] };
  }

  /* ============ MIMIC ============ */
  function mimicFrame(o = {}) {
    return (buf, W, H) => {
      const api = apiFor(buf, W, H), open = o.open || 0; // 0..3 lid lift
      const wood = '#b86f50', woodD = '#733e39', woodL = '#e4a672', gold = '#fee761';
      const squash = o.squash || 0;
      const yB = 18 + squash; // body top
      // body
      api.rect(9, yB, 23, 26, wood);
      api.rect(9, yB, 10, 26, woodL); api.rect(22, yB, 23, 26, woodD);
      api.rect(9, 24, 23, 26, woodD);
      api.line(9, yB + 3, 23, yB + 3, woodD, 1); // plank seam
      // gold bands
      api.rect(11, yB, 12, 26, gold); api.rect(20, yB, 21, 26, gold);
      // lid
      const lidY = 13 - open * 2 + squash;
      api.rect(8, lidY, 24, lidY + 4, wood);
      api.rect(8, lidY, 24, lidY + 1, woodL); api.rect(8, lidY + 4, 24, lidY + 4, woodD);
      api.rect(11, lidY, 12, lidY + 4, gold); api.rect(20, lidY, 21, lidY + 4, gold);
      if (open >= 2) {
        // teeth rows
        for (let x = 10; x <= 22; x += 2) { api.px(x, lidY + 5, '#ffffff'); api.px(x + 1, yB - 1, '#ffffff'); }
        api.rect(10, lidY + 6, 22, yB - 1, '#5c1a1a'); // maw dark
        // tongue lash
        const tl = (open - 1) * 3;
        api.line(16, yB - 2, 16, yB - 2 - tl, '#e43b44', 2);
        api.line(16, yB - 2 - tl, 16, yB - 1 - tl, '#f6757a', 2);
      } else if (open === 1) {
        api.line(9, lidY + 5, 23, lidY + 5, '#181425', 1); // ajar gap
        if (o.glint) { api.px(15, lidY + 5, '#ff0044'); api.px(17, lidY + 5, '#ff0044'); }
      } else {
        // lock
        api.rect(15, lidY + 2, 17, lidY + 5, gold); api.px(16, lidY + 3, '#181425');
        if (o.glint) { api.px(15, lidY + 2, '#ffffff'); }
      }
      if (o.coins) { api.px(12, 27, gold); api.px(20, 27, gold); api.px(16, 26, '#ffffff'); }
      if (o.flash) P().flashWhite(api, W, H, buf);
      finish(buf, W, H);
      if (o.fade) R.fadeOut(buf, W, H, o.fade, 4);
    };
  }
  function mimicSuite() {
    return { width: 32, height: 32, name: 'rpg-mimic', layers: [{ name: 'Body' }], states: [
      D('idle', 4, true, [Fr(ms(4), mimicFrame({})), Fr(ms(4), mimicFrame({ open: 1 })), Fr(ms(4), mimicFrame({})), Fr(ms(4), mimicFrame({ open: 1, glint: true }))]),
      D('snap', 12, true, [Fr(130, mimicFrame({ open: 1 })), Fr(70, mimicFrame({ open: 2 })), Fr(70, mimicFrame({ open: 3 })), Fr(150, mimicFrame({ open: 0, squash: 1 }))]),
      D('hurt', 8, true, [Fr(ms(8), mimicFrame({ flash: true, open: 1 })), Fr(ms(8), mimicFrame({ open: 1 }))]),
      D('death', 6, false, [Fr(ms(6), mimicFrame({ flash: true })), Fr(ms(6), mimicFrame({ squash: 3, coins: true })), Fr(ms(6), mimicFrame({ squash: 3, coins: true, fade: 0.6 }))])
    ] };
  }

  /* ============ WISP ============ */
  function wispFrame(o = {}) {
    return (buf, W, H) => {
      const api = apiFor(buf, W, H), i = o.i || 0;
      const cx = 16 + (o.dx || 0), cy = (o.cy || 15) + (o.bob === false ? 0 : (i % 2 ? -1 : 0));
      if (o.ghost) { /* dithered afterimage handled by fade */ }
      const w = o.stretch ? 3 : 5 + (i % 2), h = o.stretch ? 9 : 7 - (i % 2);
      // outer flame
      api.ellipse(cx - w, cy - h, cx + w, cy + h, '#f77622', true);
      api.ellipse(cx - w + 1, cy - h, cx + w - 1, cy + h, '#feae34', true);
      api.ellipse(cx - 2, cy - h + 2, cx + 2, cy + 3, '#fee761', true);
      api.ellipse(cx - 1, cy - h + 3, cx + 1, cy + 1, '#ffffff', true);
      // licks
      api.px(cx - w + 1, cy - h - 1, '#f77622'); api.px(cx + 1, cy - h - 2 + (i % 2), '#feae34');
      // face
      api.px(cx - 2, cy, '#181425'); api.px(cx + 2, cy, '#181425');
      if (o.angry) { api.line(cx - 3, cy - 2, cx - 1, cy - 1, '#181425', 1); api.line(cx + 3, cy - 2, cx + 1, cy - 1, '#181425', 1); }
      api.px(cx, cy + 2, '#181425');
      // embers below
      for (let k = 0; k < 3; k++) {
        const ex = cx - 4 + ((i * 3 + k * 5) % 9), ey = cy + h + 2 + ((i + k * 2) % 3) * 2;
        api.px(ex, ey, k % 2 ? '#feae34' : '#f77622');
      }
      if (o.flash) P().flashWhite(api, W, H, buf);
      if (o.sparks) P().sparks(api, cx, cy, i, '#fee761', 10, 3, 9);
      finish(buf, W, H);
      if (o.fade) R.fadeOut(buf, W, H, o.fade, 2);
      if (o.small) { /* shrink handled by caller variant */ }
    };
  }
  function wispSuite() {
    // afterimage (dithered copy behind) + stretched core
    const trail = dx => (buf, W, H) => {
      wispFrame({ i: 1, dx: dx - 5, fade: 0.6 })(buf, W, H);
      wispFrame({ i: 2, dx, stretch: true })(buf, W, H);
    };
    return { width: 32, height: 32, name: 'rpg-wisp', layers: [{ name: 'Body' }], states: [
      D('idle', 6, true, [0, 1, 2, 3].map(i => Fr(ms(6), wispFrame({ i })))),
      D('dash', 12, true, [Fr(ms(12), trail(-4)), Fr(ms(12), trail(0)), Fr(ms(12), trail(4)), Fr(ms(12), wispFrame({ i: 1, angry: true }))]),
      D('burst', 10, true, [Fr(ms(10), wispFrame({ angry: true })), Fr(ms(10), wispFrame({ flash: true, sparks: true })), Fr(ms(10), wispFrame({ i: 2, sparks: true })), Fr(ms(10), wispFrame({ i: 0 }))]),
      D('vanish', 8, false, [Fr(ms(8), wispFrame({})), Fr(ms(8), wispFrame({ i: 1, fade: 0.45 })), Fr(ms(8), wispFrame({ i: 2, fade: 0.8 }))])
    ] };
  }

  /* ============ SLIME KING ============ */
  function slimeKingFrame(o = {}) {
    return (buf, W, H) => {
      const api = apiFor(buf, W, H);
      const squash = o.squash || 0, air = o.air || 0;
      const cx = 16, baseY = 27 + air;
      const w = 11 + squash * 2, h = 9 - squash;
      const body = o.flash ? '#ffffff' : '#63c74d', dark = o.flash ? '#e8e8e8' : '#3e8948', lite = '#c9f27e';
      api.ellipse(cx - w, baseY - h * 2, cx + w, baseY, body, true);
      api.ellipse(cx - w, baseY - 4, cx + w, baseY, dark, true);
      api.ellipse(cx - w + 2, baseY - h * 2 + 1, cx - w + 6, baseY - h * 2 + 4, lite, true);
      // blobs
      api.px(cx - w + 1, baseY - h, body); api.px(cx + w - 1, baseY - h - 1, body);
      // face
      const ey = baseY - h - 2;
      api.rect(cx - 5, ey, cx - 3, ey + 3, '#181425'); api.rect(cx + 3, ey, cx + 5, ey + 3, '#181425');
      api.px(cx - 5, ey, '#ffffff'); api.px(cx + 3, ey, '#ffffff');
      api.line(cx - 2, ey + 4, cx + 2, ey + 4, '#181425', 1);
      // crown riding on top
      const topY = baseY - h * 2 + (o.crownDrop || 0);
      api.rect(cx - 5, topY - 4, cx + 5, topY - 1, '#fee761');
      api.rect(cx - 5, topY - 1, cx + 5, topY - 1, '#feae34');
      [-4, -1, 2].forEach(dx => api.px(cx + dx, topY - 5, '#fee761'));
      api.px(cx - 1, topY - 3, '#ff0044'); api.px(cx, topY - 3, '#ff0044'); api.px(cx - 1, topY - 2, '#ff0044');
      if (o.ring) { api.ellipse(cx - o.ring, 27, cx + o.ring, 29, '#c0cbdc', false); }
      if (o.dust) o.dust.forEach(([x, y, c]) => api.px(x, y, c));
      finish(buf, W, H);
      if (o.fade) R.fadeOut(buf, W, H, o.fade, 6);
    };
  }
  function slimeKingSuite() {
    return { width: 32, height: 32, name: 'rpg-slime-king', layers: [{ name: 'Body' }], states: [
      D('idle', 4, true, [Fr(ms(4), slimeKingFrame({})), Fr(ms(4), slimeKingFrame({ squash: 1 })), Fr(ms(4), slimeKingFrame({})), Fr(ms(4), slimeKingFrame({ squash: -1 }))]),
      D('hop', 10, true, [Fr(ms(10), slimeKingFrame({ squash: 1 })), Fr(ms(10), slimeKingFrame({ squash: -2, air: -4 })), Fr(ms(10), slimeKingFrame({ squash: -1, air: -2 })), Fr(ms(10), slimeKingFrame({}))]),
      D('slam', 10, true, [
        Fr(ms(10), slimeKingFrame({ squash: 1 })),
        Fr(ms(10), slimeKingFrame({ squash: -2, air: -5 })),
        Fr(ms(10), slimeKingFrame({ squash: 3, ring: 10, dust: [[6, 26, '#c0cbdc'], [26, 26, '#8b9bb4'], [10, 27, '#8b9bb4']] })),
        Fr(ms(10), slimeKingFrame({ squash: 1, ring: 13 }))
      ]),
      D('hurt', 8, true, [Fr(ms(8), slimeKingFrame({ flash: true })), Fr(ms(8), slimeKingFrame({ squash: 1 }))]),
      D('death', 6, false, [
        Fr(ms(6), slimeKingFrame({ flash: true })),
        Fr(ms(6), slimeKingFrame({ squash: 2 })),
        Fr(ms(6), slimeKingFrame({ squash: 3, crownDrop: 6 })),
        Fr(ms(6), slimeKingFrame({ squash: 3, crownDrop: 9, fade: 0.55 }))
      ])
    ] };
  }

  /* ============ ANCIENT ENT ============ */
  function entFrame(o = {}) {
    return (buf, W, H) => {
      const api = apiFor(buf, W, H), i = o.i || 0;
      const sway = o.armsUp ? 0 : (i % 2 ? 1 : -1);
      const bob = o.bob || 0;
      const bark = o.flash ? '#ffffff' : '#733e39', barkD = o.flash ? '#e8e8e8' : '#3e2731', moss = '#3e8948', leaf = o.flash ? '#ffffff' : '#3e8948', leafD = '#265c42';
      const Y = y => y + bob;
      // roots / feet
      const liftL = o.step === 0 ? -2 : 0, liftR = o.step === 1 ? -2 : 0;
      api.line(12, Y(26), 9, Y(28 + liftL), barkD, 2); api.line(13, Y(26), 13, Y(28 + liftL), barkD, 2);
      api.line(20, Y(26), 23, Y(28 + liftR), barkD, 2); api.line(19, Y(26), 19, Y(28 + liftR), barkD, 2);
      // trunk (tapered stack)
      api.rect(11, Y(16), 21, Y(26), bark);
      api.rect(12, Y(11), 20, Y(16), bark);
      api.rect(13, Y(8), 19, Y(11), bark);
      api.rect(19, Y(11), 21, Y(26), barkD); api.rect(11, Y(16), 12, Y(26), barkD);
      // bark cracks
      api.line(15, Y(14), 15, Y(20), barkD, 1); api.line(17, Y(18), 17, Y(24), barkD, 1);
      // moss patches
      api.px(12, Y(18), moss); api.px(20, Y(22), moss); api.px(13, Y(12), moss);
      // branch arms
      const armY = o.armsUp ? -8 : sway;
      api.line(11, Y(16), 4, Y(12 + armY), bark, 3);
      api.line(4, Y(12 + armY), 2, Y(8 + armY), bark, 2);
      api.line(21, Y(16), 28, Y(12 - armY), bark, 3);
      api.line(28, Y(12 - armY), 30, Y(8 - armY), bark, 2);
      // leaf crown + shoulder tufts
      const jx = (i * 2) % 3 - 1;
      api.ellipse(10 + jx, Y(2), 22 + jx, Y(9), leaf, true);
      api.ellipse(12 + jx, Y(3), 18 + jx, Y(7), leafD, true);
      api.ellipse(2, Y(9 + armY), 7, Y(13 + armY), leaf, true);
      api.ellipse(25, Y(9 - armY), 30, Y(13 - armY), leaf, true);
      // face: angry eyes + mouth hollow
      api.line(13, Y(13), 16, Y(14), '#181425', 2); api.line(19, Y(13), 16, Y(14), '#181425', 2);
      api.px(14, Y(13), o.flash ? '#ffffff' : '#fee761'); api.px(18, Y(13), o.flash ? '#ffffff' : '#fee761');
      api.rect(15, Y(17), 17, Y(19), '#181425');
      if (o.slamRing) { api.ellipse(16 - o.slamRing, 27, 16 + o.slamRing, 29, '#c0cbdc', false); }
      if (o.leaves) o.leaves.forEach(([x, y, c]) => api.px(x, y, c || leaf));
      if (o.shake) { /* static pose + kb feel via particles */ }
      finish(buf, W, H);
      if (o.fade) R.fadeOut(buf, W, H, o.fade, 8);
    };
  }
  function entSuite() {
    return { width: 32, height: 32, name: 'rpg-ent', layers: [{ name: 'Body' }], states: [
      D('idle', 3, true, [0, 1, 2, 3].map(i => Fr(ms(3), entFrame({ i })))),
      D('stomp', 8, true, [Fr(ms(8), entFrame({ step: 0, bob: -1 })), Fr(ms(8), entFrame({ step: 1 })), Fr(ms(8), entFrame({ step: 1, bob: -1 })), Fr(ms(8), entFrame({ step: 0 }))]),
      D('slam', 10, true, [
        Fr(ms(10), entFrame({})),
        Fr(ms(10), entFrame({ armsUp: true, i: 1 })),
        Fr(ms(10), entFrame({ bob: 2, slamRing: 9, leaves: [[8, 20], [24, 19], [12, 15], [20, 14]] })),
        Fr(ms(10), entFrame({ bob: 1, slamRing: 12 }))
      ]),
      D('hurt', 8, true, [Fr(ms(8), entFrame({ flash: true, leaves: [[10, 22, '#63c74d'], [22, 21, '#3e8948']] })), Fr(ms(8), entFrame({ i: 1 }))]),
      D('death', 6, false, [
        Fr(ms(6), entFrame({ flash: true })),
        Fr(ms(6), entFrame({ leaves: [[6, 12], [26, 10], [16, 6], [10, 20], [22, 22]], bob: 2 })),
        Fr(ms(6), entFrame({ bob: 5, fade: 0.45 })),
        Fr(ms(6), entFrame({ bob: 5, fade: 0.85 }))
      ])
    ] };
  }

  return { goblinSuite, necromancerSuite, demonSuite, dragonSuite, spiderSuite, spiderlingSuite, spiderQueenSuite,
    mimicSuite, wispSuite, slimeKingSuite, entSuite };
})();
