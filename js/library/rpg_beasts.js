/* PixelForge Studio — Beasts & Spirits pack.
   A parameterised quadruped rig drives eight farm/forest animals (cow, sheep,
   pig, horse, rabbit, deer) plus two odd-bodies (frog, duck), and three
   custom-rig foes (wraith, gargoyle, imp). 32x32, pure maths, deterministic.

   Geometry is authored in the shared 32x32 sprite space with every animal
   facing right, so silhouettes stay consistent across the family. */
window.PF = window.PF || {};
PF.RPG = PF.RPG || {};
PF.RPG.beasts = (() => {
  const P = () => PF.Pixel;
  const D = (name, fps, loop, frames) => ({ name, fps, loop, frames });
  const Fr = (duration, paint) => ({ duration, paint });
  const ms = fps => Math.round(1000 / fps);
  const apiFor = (buf, W, H) => P().makeApi(buf, W, H);
  const OUT32 = PF.Color.hexToU32('#181425');
  const finish = (buf, W, H) => buf.set(PF.Raster.outline(buf, W, H, OUT32));
  const S1 = (name, painter, fps = 6) => D(name, fps, true, [Fr(ms(fps), painter)]);

  /* ================= quadruped rig ================= */
  /* g = geometry, p = palette, pose = { step, bob, headDy, graze, ear } */
  function quad(g, p, pose = {}) {
    return (buf, W, H) => {
      const api = apiFor(buf, W, H);
      const s = pose.step !== undefined ? Math.sin(pose.step * Math.PI * 2) : 0;
      const bob = pose.step !== undefined ? Math.round(-Math.abs(s) * (g.bobAmp ?? 1)) : (pose.bob || 0);
      const Y = y => y + bob;
      const sw = g.swing ?? 3, l1 = Math.round(s * sw), l2 = -l1;
      const lt = Y(g.legTop), lb = Y(g.legBot), lw = g.legW - 1;
      const L = g.legs;
      // far leg pair first, in the darker shade (reads as depth)
      api.rect(L[1] + l2, lt, L[1] + l2 + lw, lb, p.shade);
      api.rect(L[3] + l1, lt, L[3] + l1 + lw, lb, p.shade);
      api.rect(L[1] + l2, lb - 1, L[1] + l2 + lw, lb, p.hoof);
      api.rect(L[3] + l1, lb - 1, L[3] + l1 + lw, lb, p.hoof);
      // torso
      api.rect(g.bodyL, Y(g.bodyTop), g.bodyR, Y(g.bodyBot), p.body);
      api.rect(g.bodyL, Y(g.bodyBot - 2), g.bodyR, Y(g.bodyBot), p.belly);
      api.rect(g.bodyL, Y(g.bodyTop), g.bodyL + 2, Y(g.bodyBot), p.shade);
      api.rect(g.bodyL, Y(g.bodyTop), g.bodyR, Y(g.bodyTop), p.shade);
      if (g.spots) g.spots.forEach(([sx, sy]) => api.px(sx, Y(sy), p.spot));
      if (g.wool) { // sheep: bumpy fleece along the back
        for (let x = g.bodyL + 1; x < g.bodyR; x += 3) api.ellipse(x, Y(g.bodyTop - 1), x + 3, Y(g.bodyTop + 2), p.body, true);
      }
      // tail — pose.tailDy flicks it without moving the feet
      const t = g.tail, tw = t.w || 2, td = pose.tailDy || 0;
      api.line(t.x, Y(t.y), t.x + t.dx, Y(t.y + t.dy + td), p.shade, tw);
      if (t.tip) api.px(t.x + t.dx, Y(t.y + t.dy + td), t.tip);
      // near leg pair
      api.rect(L[0] + l1, lt, L[0] + l1 + lw, lb, p.leg);
      api.rect(L[2] + l2, lt, L[2] + l2 + lw, lb, p.leg);
      api.rect(L[0] + l1, lb - 1, L[0] + l1 + lw, lb, p.hoof);
      api.rect(L[2] + l2, lb - 1, L[2] + l2 + lw, lb, p.hoof);
      // neck + head
      const hy = Y(g.headY + (pose.headDy || 0));
      api.rect(g.headX - 3, hy + 2, g.headX + 1, Y(g.bodyTop) + 1, p.body);
      api.rect(g.headX, hy, g.headX + g.headW - 1, hy + g.headH - 1, p.body);
      api.rect(g.headX, hy + g.headH - 2, g.headX + g.headW - 1, hy + g.headH - 1, p.shade);
      // snout / muzzle
      api.rect(g.headX + g.headW - 1, hy + g.headH - 4, g.headX + g.headW + 1, hy + g.headH - 2, p.belly);
      api.px(g.headX + g.headW + 1, hy + g.headH - 3, p.shade);
      // eye
      api.px(g.headX + g.headW - 3, hy + 2, p.eye);
      api.px(g.headX + g.headW - 3, hy + 2, p.eye);
      // ears
      if (g.ear === 'long') { api.line(g.headX + 1, hy, g.headX - 1, hy - 5, p.body, 2); api.line(g.headX + 3, hy, g.headX + 2, hy - 5, p.body, 2); }
      else if (g.ear === 'flop') { api.ellipse(g.headX, hy - 1, g.headX + 3, hy + 2, p.shade, true); }
      else { api.line(g.headX + 1, hy, g.headX, hy - 3, p.body, 2); api.line(g.headX + 4, hy, g.headX + 4, hy - 3, p.body, 2); }
      // horns
      if (g.horn) {
        api.line(g.headX + 1, hy - 1, g.headX - 1, hy - 3, p.horn, 2);
        api.line(g.headX + 4, hy - 1, g.headX + 6, hy - 3, p.horn, 2);
        api.px(g.headX - 1, hy - 3, p.hornSh); api.px(g.headX + 6, hy - 3, p.hornSh);
      }
      finish(buf, W, H);
    };
  }

  /* ================= animal table ================= */
  const A = {
    cow: {
      geo: { shadow: 9, bodyL: 4, bodyR: 25, bodyTop: 13, bodyBot: 22, legs: [6, 10, 19, 23], legW: 3, legTop: 21, legBot: 27,
        headX: 22, headY: 11, headW: 8, headH: 7, ear: 'flop', horn: true, swing: 2, bobAmp: 1,
        tail: { x: 4, y: 14, dx: -3, dy: 4, w: 2, tip: '#262b44' }, spots: [[10, 16], [14, 19], [19, 15], [8, 20]] },
      pal: { body: '#ffffff', shade: '#c0cbdc', belly: '#e8ecf5', leg: '#e8ecf5', hoof: '#262b44', eye: '#181425', horn: '#ead4aa', hornSh: '#c28569', spot: '#262b44' }
    },
    sheep: {
      geo: { shadow: 8, bodyL: 5, bodyR: 24, bodyTop: 14, bodyBot: 22, legs: [7, 11, 18, 22], legW: 2, legTop: 21, legBot: 27,
        headX: 21, headY: 12, headW: 7, headH: 6, ear: 'flop', wool: true, swing: 2, bobAmp: 1,
        tail: { x: 5, y: 15, dx: -2, dy: 2, w: 2 } },
      pal: { body: '#e8ecf5', shade: '#c0cbdc', belly: '#ffffff', leg: '#3e2731', hoof: '#181425', eye: '#181425', horn: '#c28569', hornSh: '#733e39', spot: '#c0cbdc' }
    },
    pig: {
      geo: { shadow: 8, bodyL: 5, bodyR: 24, bodyTop: 15, bodyBot: 23, legs: [7, 11, 18, 22], legW: 3, legTop: 22, legBot: 27,
        headX: 21, headY: 14, headW: 7, headH: 7, ear: 'up', swing: 2, bobAmp: 1,
        tail: { x: 5, y: 16, dx: -2, dy: -1, w: 1 } },
      pal: { body: '#f6757a', shade: '#b55088', belly: '#f2c094', leg: '#f6757a', hoof: '#3e2731', eye: '#181425', horn: '#ffffff', hornSh: '#c0cbdc', spot: '#b55088' }
    },
    horse: {
      geo: { shadow: 9, bodyL: 4, bodyR: 24, bodyTop: 12, bodyBot: 21, legs: [5, 9, 19, 23], legW: 2, legTop: 20, legBot: 27,
        headX: 22, headY: 7, headW: 6, headH: 8, ear: 'long', swing: 4, bobAmp: 2,
        tail: { x: 4, y: 13, dx: -3, dy: 5, w: 3, tip: '#262b44' } },
      pal: { body: '#b86f50', shade: '#733e39', belly: '#e4a672', leg: '#b86f50', hoof: '#262b44', eye: '#181425', horn: '#ead4aa', hornSh: '#c28569', spot: '#733e39' }
    },
    rabbit: {
      geo: { shadow: 5, bodyL: 8, bodyR: 21, bodyTop: 17, bodyBot: 24, legs: [10, 13, 17, 20], legW: 2, legTop: 23, legBot: 27,
        headX: 18, headY: 12, headW: 7, headH: 7, ear: 'long', swing: 2, bobAmp: 2,
        tail: { x: 8, y: 19, dx: -3, dy: -1, w: 2, tip: '#ffffff' } },
      pal: { body: '#ead4aa', shade: '#c8b28a', belly: '#fff6c9', leg: '#ead4aa', hoof: '#c8b28a', eye: '#181425', horn: '#ffffff', hornSh: '#c0cbdc', spot: '#c8b28a' }
    },
    deer: {
      geo: { shadow: 8, bodyL: 5, bodyR: 23, bodyTop: 13, bodyBot: 21, legs: [6, 10, 18, 22], legW: 2, legTop: 20, legBot: 27,
        headX: 21, headY: 8, headW: 6, headH: 7, ear: 'long', horn: true, swing: 3, bobAmp: 2,
        tail: { x: 5, y: 14, dx: -2, dy: 2, w: 2, tip: '#fff6c9' }, spots: [[10, 16], [13, 18], [16, 16], [19, 18]] },
      pal: { body: '#d77643', shade: '#b86f50', belly: '#ead4aa', leg: '#d77643', hoof: '#3e2731', eye: '#181425', horn: '#ead4aa', hornSh: '#c28569', spot: '#fff6c9' }
    }
  };

  /* ---------- FROG (squat hopper) ---------- */
  function frogFrame(pose = {}) {
    return (buf, W, H) => {
      const api = apiFor(buf, W, H);
      const hop = pose.hop || 0, Y = y => y - hop;
      const G = pose.flash ? '#ffffff' : '#63c74d', Dk = pose.flash ? '#e8e8e8' : '#3e8948', L = '#c9f27e';
      // haunches
      api.ellipse(7, Y(19), 15, Y(27), Dk, true);
      api.ellipse(18, Y(19), 26, Y(27), Dk, true);
      // body
      api.ellipse(8, Y(15), 24, Y(26), G, true);
      api.ellipse(10, Y(21), 22, Y(26), L, true);
      // webbed feet
      api.rect(5, Y(26), 12, Y(27), Dk); api.rect(20, Y(26), 27, Y(27), Dk);
      // eyes: two big domes on top (blink closes them for the idle)
      api.ellipse(10, Y(10), 15, Y(15), G, true);
      api.ellipse(17, Y(10), 22, Y(15), G, true);
      if (pose.blink) {
        api.line(11, Y(13), 14, Y(13), '#181425', 1);
        api.line(18, Y(13), 21, Y(13), '#181425', 1);
      } else {
        api.ellipse(11, Y(11), 14, Y(14), '#ffffff', true);
        api.ellipse(18, Y(11), 21, Y(14), '#ffffff', true);
        api.rect(12, Y(12), 13, Y(14), '#181425'); api.rect(19, Y(12), 20, Y(14), '#181425');
      }
      // mouth
      api.line(11, Y(19), 21, Y(19), Dk, 1);
      api.px(16, Y(20), Dk);
      // throat: a small pulse for the idle, a full sac for the croak
      if (pose.throat) api.ellipse(13, Y(19), 19, Y(19 + pose.throat), '#f6757a', true);
      if (pose.croak) { api.ellipse(13, Y(17), 19, Y(21), '#f6757a', true); }
      finish(buf, W, H);
    };
  }
  function frogSuite() {
    const walk = [0, 1, 2, 3].map(i => Fr(ms(8), frogFrame({ hop: [0, 2, 3, 1][i] })));
    return { width: 32, height: 32, name: 'rpg-frog', layers: [{ name: 'Body' }], states: [
      // Idle: throat pulse + a blink, feet planted. No hop — the frog is
      // sitting, not bouncing.
      D('idle', 5, true, [
        Fr(ms(5), frogFrame({})),
        Fr(ms(5), frogFrame({ throat: 2 })),
        Fr(ms(5), frogFrame({ throat: 2, blink: true })),
        Fr(ms(5), frogFrame({ throat: 1 }))
      ]),
      D('hop', 8, true, walk),
      D('croak', 5, true, [Fr(ms(5), frogFrame({})), Fr(ms(5), frogFrame({ croak: true })), Fr(ms(5), frogFrame({ croak: true, hop: 1 })), Fr(ms(5), frogFrame({ hop: 1 }))]),
      D('hurt', 10, true, [Fr(ms(10), frogFrame({ flash: true })), Fr(ms(10), frogFrame({ hop: 2 }))]),
      D('death', 8, false, [Fr(ms(8), frogFrame({ flash: true })), Fr(ms(8), frogFrame({ hop: 1 })), Fr(ms(8), (buf, W, H) => { const api = apiFor(buf, W, H); api.ellipse(9, 23, 23, 27, '#3e8948', true); api.px(12, 24, '#181425'); finish(buf, W, H); })])
    ] };
  }

  /* ---------- DUCK (waterfowl) ---------- */
  function duckFrame(pose = {}) {
    return (buf, W, H) => {
      const api = apiFor(buf, W, H), cx = 16 + (pose.dx || 0);
      const Y = y => y - (pose.hop || 0);
      // head/neck ride headDy so the idle bobs the head without lifting the feet
      const HY = y => y - (pose.hop || 0) + (pose.headDy || 0);
      const B = pose.flash ? '#ffffff' : '#ead4aa', Dk = pose.flash ? '#e8e8e8' : '#c8b28a', Beak = '#feae34', Feet = '#f77622';
      // feet
      api.rect(cx - 3, Y(26), cx + 1, Y(27), Feet); api.rect(cx + 2, Y(26), cx + 6, Y(27), Feet);
      // body: boat-shaped hull
      api.ellipse(cx - 8, Y(16), cx + 6, Y(26), B, true);
      api.ellipse(cx - 6, Y(20), cx + 5, Y(26), Dk, true);
      // folded wing
      api.ellipse(cx - 5, Y(18), cx + 2, Y(23), '#fff6c9', true);
      api.px(cx - 3, Y(21), Dk); api.px(cx - 1, Y(22), Dk);
      // tail feathers (tailUp flicks them for the idle)
      api.line(cx - 8, Y(19), cx - 11, Y(16 - (pose.tailUp || 0)), B, 2);
      // neck + head
      api.rect(cx + 2, HY(12), cx + 6, Y(18), B);
      api.ellipse(cx + 2, HY(7), cx + 9, HY(15), B, true);
      api.px(cx + 7, HY(10), '#181425');
      // bill
      api.rect(cx + 9, HY(11), cx + 12, HY(13), Beak);
      api.px(cx + 12, HY(12), '#f77622');
      // drake plumage hint
      if (pose.drake) { api.rect(cx + 3, HY(8), cx + 7, HY(10), '#3e8948'); }
      finish(buf, W, H);
    };
  }
  function duckSuite() {
    return { width: 32, height: 32, name: 'rpg-duck', layers: [{ name: 'Body' }], states: [
      // Idle: head bob + tail flick, feet planted.
      D('idle', 5, true, [
        Fr(ms(5), duckFrame({})),
        Fr(ms(5), duckFrame({ headDy: 1 })),
        Fr(ms(5), duckFrame({ headDy: 1, tailUp: 1 })),
        Fr(ms(5), duckFrame({ tailUp: 1 }))
      ]),
      D('walk', 7, true, [0, 1, 2, 3].map(i => Fr(ms(7), duckFrame({ dx: [0, 1, 0, -1][i], hop: i % 2 })))),
      D('swim', 5, true, [0, 1, 2, 3].map(i => Fr(ms(5), duckFrame({ dx: [0, 1, 0, -1][i], headDy: i % 2 })))),
      D('hurt', 10, true, [Fr(ms(10), duckFrame({ flash: true })), Fr(ms(10), duckFrame({ hop: 2, dx: -1 }))]),
      D('death', 8, false, [Fr(ms(8), duckFrame({ flash: true })), Fr(ms(8), duckFrame({ hop: 1 })), Fr(ms(8), (buf, W, H) => { const api = apiFor(buf, W, H); api.ellipse(8, 23, 24, 27, '#c8b28a', true); api.px(12, 24, '#181425'); finish(buf, W, H); })])
    ] };
  }

  /* ---------- ANIMALS pack: one idle + one walk state per animal ---------- */
  function animalsSuite() {
    const states = [];
    for (const key of Object.keys(A)) {
      const a = A[key], g = a.geo, p = a.pal;
      // Idle: the head settles and the tail flicks. Nothing lifts the feet —
      // a whole-body bob on a standing animal reads as hopping, not breathing.
      const IDLE_H = [0, 1, 1, 0], IDLE_T = [0, -1, 1, 1];
      const idle = [0, 1, 2, 3].map(i => Fr(ms(5), quad(g, p, { headDy: IDLE_H[i], tailDy: IDLE_T[i] })));
      const walk = [0, 1, 2, 3].map(i => Fr(ms(6), quad(g, p, { step: i / 4 })));
      // head dips a few pixels only: a deeper dip would invert the neck rect
      // and merge the head into the torso. The last frame stays lifted-but-not-
      // level so the loop has no dead repeat against frame 0.
      const graze = [0, 2, 3, 1].map(d => Fr(ms(8), quad(g, p, { headDy: d })));
      states.push(D(key + '_idle', 5, true, idle));
      states.push(D(key + '_walk', 6, true, walk));
      states.push(D(key + '_graze', 8, true, graze));
    }
    return { width: 32, height: 32, name: 'rpg-animals', layers: [{ name: 'Body' }], states };
  }

  /* ================= WRATH (hooded spectre) ================= */
  function wraithFrame(pose = {}) {
    return (buf, W, H) => {
      const api = apiFor(buf, W, H);
      const i = pose.i || 0;
      const bob = pose.bob !== undefined ? pose.bob : (i % 2 ? -2 : 0);
      const top = 6 + bob, bot = 26 + bob;
      const Cloak = pose.flash ? '#ffffff' : '#3e2347', CloakD = pose.flash ? '#e8e8e8' : '#262b44', Trim = '#68386c';
      // cloak body: shoulders -> flaring hem
      api.rect(11, top, 20, top + 6, Cloak);
      api.rect(9, top + 5, 22, top + 12, Cloak);
      api.rect(7, top + 11, 24, bot - 4, Cloak);
      api.rect(20, top, 20, bot - 4, CloakD); api.rect(7, top + 11, 8, bot - 4, CloakD);
      // tattered hem: alternating tongues
      for (let x = 7; x <= 24; x += 2) {
        const len = ((x + i) % 3) + 2;
        api.rect(x, bot - 3, x, bot - 3 + len, CloakD);
      }
      // hood: deep cowl
      api.ellipse(9, top - 4, 22, top + 7, Cloak, true);
      api.ellipse(11, top - 1, 20, top + 6, '#181425', true); // hollow
      api.rect(11, top + 5, 20, top + 6, CloakD);
      // eyes: two cold points inside the dark
      const ec = pose.flash ? '#181425' : '#2ce8f5';
      api.px(13, top + 2, ec); api.px(17, top + 2, ec);
      api.px(13, top + 1, ec); api.px(17, top + 1, ec);
      // bone hands
      api.rect(6, top + 9, 8, top + 12, '#c0cbdc');
      api.rect(23, top + 9, 25, top + 12, '#c0cbdc');
      api.px(6, top + 12, Trim); api.px(25, top + 12, Trim);
      // wisps of soul-smoke
      if (pose.smoke) { api.px(12, top - 6, CloakD); api.px(20, top - 5, CloakD); api.px(16, top - 8, CloakD); }
      if (pose.cast) {
        P().particles(api, 16, top + 4, 9, (pose.cast) / 4, ['#2ce8f5', '#b55088', '#ffffff']);
      }
      finish(buf, W, H);
      if (pose.fade) PF.RPG.fadeOut(buf, W, H, pose.fade, 3);
    };
  }
  function wraithSuite() {
    return { width: 32, height: 32, name: 'rpg-wraith', layers: [{ name: 'Body' }], states: [
      D('float', 8, true, [0, 1, 2, 3].map(i => Fr(ms(8), wraithFrame({ i, smoke: i === 3 })))),
      D('cast', 8, true, [0, 1, 2, 3].map(i => Fr(ms(8), wraithFrame({ i, cast: i })))),
      D('lunge', 10, true, [Fr(ms(10), wraithFrame({ i: 0 })), Fr(ms(10), wraithFrame({ i: 1, bob: -4 })), Fr(ms(10), wraithFrame({ i: 2, bob: -1 })), Fr(ms(10), wraithFrame({ i: 3 }))]),
      D('hurt', 8, true, [Fr(ms(8), wraithFrame({ flash: true })), Fr(ms(8), wraithFrame({ i: 1 }))]),
      // `vanish` is the atmospheric exit; `death` is the combat one, so
      // consumers that key on a literal 'death' state still get a real anim.
      D('death', 6, false, [
        Fr(ms(6), wraithFrame({ flash: true })),
        Fr(ms(6), wraithFrame({ i: 1, bob: 3 })),
        Fr(ms(6), wraithFrame({ i: 2, bob: 6, fade: 0.45 })),
        Fr(ms(6), wraithFrame({ i: 3, bob: 8, fade: 0.8 }))
      ]),
      D('vanish', 6, false, [Fr(ms(6), wraithFrame({ i: 0 })), Fr(ms(6), wraithFrame({ i: 1, fade: 0.4 })), Fr(ms(6), wraithFrame({ i: 2, fade: 0.75 }))])
    ] };
  }

  /* ================= GARGOYLE (stone sentinel) ================= */
  function gargoyleFrame(pose = {}) {
    return (buf, W, H) => {
      const api = apiFor(buf, W, H);
      // crouch moves the whole statue (used when airborne); settle compresses
      // only the torso/head/wings so the perched idle never sinks the feet.
      const crouch = pose.crouch || 0, settle = pose.settle || 0;
      const Y = y => y + crouch, BY = y => y + crouch + settle;
      const R1 = pose.flash ? '#ffffff' : '#8b9bb4', R2 = pose.flash ? '#e8e8e8' : '#5a6988', R3 = '#3a4466', Eye = '#ff0044';
      const flap = pose.flap || 0;
      // wings behind, folded (0) or spread (1)
      const wy = flap ? 6 : 14;
      api.line(11, BY(14), 3, BY(wy), R3, 3); api.line(3, BY(wy), 1, BY(wy + 6), R3, 2);
      api.line(21, BY(14), 29, BY(wy), R3, 3); api.line(29, BY(wy), 31, BY(wy + 6), R3, 2);
      api.line(11, BY(15), 4, BY(wy + 2), R2, 1); api.line(21, BY(15), 28, BY(wy + 2), R2, 1);
      // perched legs: bent, clawed — planted, so they ignore `settle`
      api.rect(9, Y(21), 13, Y(26), R2); api.rect(19, Y(21), 23, Y(26), R2);
      api.rect(7, Y(26), 13, Y(27), R3); api.rect(19, Y(26), 25, Y(27), R3);
      api.px(7, Y(27), R3); api.px(25, Y(27), R3);
      // torso
      api.rect(9, BY(13), 22, BY(22), R1);
      api.rect(19, BY(13), 22, BY(22), R2); api.rect(9, BY(13), 11, BY(22), R2);
      api.line(14, BY(15), 16, BY(18), R3, 1); // crack
      // arms crossed in front
      api.rect(7, BY(16), 10, BY(21), R2); api.rect(21, BY(16), 24, BY(21), R2);
      // horned head
      api.rect(12, BY(6), 19, BY(13), R1);
      api.rect(17, BY(6), 19, BY(13), R2);
      api.line(12, BY(7), 10, BY(3), R2, 2); api.line(19, BY(7), 21, BY(3), R2, 2); // horns
      api.rect(13, BY(9), 15, BY(10), Eye); api.rect(17, BY(9), 18, BY(10), Eye);
      api.rect(13, BY(6), 18, BY(7), R3); // brow
      api.line(14, BY(12), 17, BY(12), R3, 1); // jaw
      // moss + weathering
      api.px(10, BY(14), '#63c74d'); api.px(21, BY(20), '#3e8948'); api.px(13, BY(7), '#3e8948');
      finish(buf, W, H);
      if (pose.fade) PF.RPG.fadeOut(buf, W, H, pose.fade, 7);
    };
  }
  function gargoyleSuite() {
    return { width: 32, height: 32, name: 'rpg-gargoyle', layers: [{ name: 'Body' }], states: [
      // Perch: the stone torso settles and the head dips; the claws stay put.
      D('perch', 4, true, [0, 1, 2, 1].map(sv => Fr(ms(4), gargoyleFrame({ settle: sv })))),
      D('swoop', 9, true, [Fr(ms(9), gargoyleFrame({ flap: 1, crouch: -3 })), Fr(ms(9), gargoyleFrame({ flap: 0, crouch: -5 })), Fr(ms(9), gargoyleFrame({ flap: 1, crouch: -3 })), Fr(ms(9), gargoyleFrame({ crouch: 0 }))]),
      D('slam', 7, true, [Fr(ms(7), gargoyleFrame({ crouch: -4, flap: 1 })), Fr(ms(7), gargoyleFrame({ crouch: 2, flap: 0 })), Fr(ms(7), gargoyleFrame({ crouch: 1 })), Fr(ms(7), gargoyleFrame({}))]),
      D('hurt', 8, true, [Fr(ms(8), gargoyleFrame({ flash: true })), Fr(ms(8), gargoyleFrame({ crouch: 1 }))]),
      D('death', 6, false, [
        Fr(ms(6), gargoyleFrame({ flash: true })),
        Fr(ms(6), gargoyleFrame({ crouch: 3 })),
        Fr(ms(6), (buf, W, H) => { const api = apiFor(buf, W, H); api.rect(6, 22, 13, 26, '#5a6988'); api.rect(15, 24, 21, 27, '#8b9bb4'); api.rect(23, 23, 27, 26, '#3a4466'); finish(buf, W, H); }),
        Fr(ms(6), (buf, W, H) => { const api = apiFor(buf, W, H); api.rect(6, 25, 13, 27, '#5a6988'); api.rect(15, 26, 21, 27, '#8b9bb4'); api.rect(23, 25, 27, 27, '#3a4466'); finish(buf, W, H); })
      ])
    ] };
  }

  /* ================= IMP (small winged nuisance) ================= */
  function impFrame(pose = {}) {
    return (buf, W, H) => {
      const api = apiFor(buf, W, H);
      const i = pose.i || 0;
      const hop = pose.hop || 0, Y = y => y - hop;
      const R = pose.flash ? '#ffffff' : '#e43b44', Dk = pose.flash ? '#e8e8e8' : '#a22633', Horn = '#ead4aa', Wing = '#5c1a1a';
      const flap = pose.flap || 0;
      // bat wings
      const wy = flap ? Y(11) : Y(15);
      api.line(11, Y(15), 4, wy, Wing, 2); api.line(4, wy, 2, wy + 4, Wing, 1);
      api.line(21, Y(15), 28, wy, Wing, 2); api.line(28, wy, 30, wy + 4, Wing, 1);
      // legs + hooves
      api.rect(12, Y(22), 14, Y(26), Dk); api.rect(18, Y(22), 20, Y(26), Dk);
      api.rect(11, Y(26), 14, Y(27), '#3e2731'); api.rect(18, Y(26), 21, Y(27), '#3e2731');
      // torso
      api.rect(12, Y(15), 20, Y(23), R);
      api.rect(18, Y(15), 20, Y(23), Dk);
      api.rect(12, Y(21), 20, Y(23), Dk);
      // arms + claws
      api.rect(9, Y(16), 11, Y(20), R); api.rect(21, Y(16), 23, Y(20), R);
      api.px(9, Y(21), Horn); api.px(23, Y(21), Horn);
      // head with horns
      api.rect(12, Y(8), 20, Y(15), R);
      api.rect(18, Y(8), 20, Y(15), Dk);
      api.line(13, Y(8), 11, Y(3), Horn, 1); api.line(19, Y(8), 21, Y(3), Horn, 1);
      api.px(11, Y(3), '#c28569'); api.px(21, Y(3), '#c28569');
      // eyes + grin
      api.px(14, Y(11), '#fee761'); api.px(18, Y(11), '#fee761');
      api.rect(14, Y(11), 14, Y(12), '#fee761'); api.rect(18, Y(11), 18, Y(12), '#fee761');
      api.line(14, Y(14), 18, Y(14), '#181425', 1);
      api.px(15, Y(13), '#ffffff'); api.px(17, Y(13), '#ffffff'); // fangs
      // arrow-tipped tail
      api.line(20, Y(22), 26, Y(19 + (i % 2)), Dk, 1);
      api.px(26, Y(19 + (i % 2)), R);
      if (pose.spark) P().sparks(api, 26, Y(19), 1, '#fee761', 6, 1, 4);
      finish(buf, W, H);
      if (pose.fade) PF.RPG.fadeOut(buf, W, H, pose.fade, 11);
    };
  }
  function impSuite() {
    return { width: 32, height: 32, name: 'rpg-imp', layers: [{ name: 'Body' }], states: [
      D('idle', 6, true, [0, 1, 2, 3].map(i => Fr(ms(10), impFrame({ i, flap: i % 2 })))),
      D('dart', 12, true, [0, 1, 2, 3].map(i => Fr(ms(12), impFrame({ i, hop: [0, 3, 1, 0][i], flap: 1 })))),
      D('hex', 10, true, [0, 1, 2, 3].map(i => Fr(ms(10), impFrame({ i, flap: i % 2, spark: i >= 2 })))),
      D('hurt', 10, true, [Fr(ms(10), impFrame({ flash: true })), Fr(ms(10), impFrame({ i: 1, hop: 2 }))]),
      D('death', 8, false, [Fr(ms(8), impFrame({ flash: true })), Fr(ms(8), impFrame({ hop: 1 })), Fr(ms(8), impFrame({ fade: 0.5 })), Fr(ms(8), impFrame({ fade: 0.85 }))])
    ] };
  }

  return { animalsSuite, frogSuite, duckSuite, wraithSuite, gargoyleSuite, impSuite,
    quad, frogFrame, duckFrame, wraithFrame, gargoyleFrame, impFrame, ANIMALS: A };
})();
