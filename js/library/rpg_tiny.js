/* PixelForge Studio — Tiny Muster pack (bespoke squat rig, no shared skeleton).
   Five small-scale foot units on one original 3/4-view rig: big headgear dome
   with 4px headroom (never clipped), blob-volume torso, stub limbs, hash
   speckle cloth, light top-rim outline. Same *roles* as classic tiny RTS
   games but distinct silhouettes and colours — no copied pixels.
   32x32, pure maths, feet y25..27, outline to y28 max (shadow row 29 clear). */
window.PF = window.PF || {};
PF.RPG = PF.RPG || {};
PF.RPG.tiny = (() => {
  const R = PF.RPG, P = () => PF.Pixel;
  const D = (name, fps, loop, frames) => ({ name, fps, loop, frames });
  const Fr = (duration, paint) => ({ duration, paint });
  const ms = fps => Math.round(1000 / fps);
  const OUT = '#181425', RIM = '#c0cbdc';

  /* ================= PALETTES (all original, no pack overlap) ================= */
  const BLADE = { skin: '#e8b796', skinSh: '#c28569', hair: '#3e2731', hairSh: '#262b44', hairHi: '#5e3b4d',
    shirt: '#a22633', shirtSh: '#5c1a1a', shirtHi: '#f6757a', pants: '#3a4466', pantsSh: '#262b44',
    boots: '#3e2731', belt: '#3e2731', buckle: '#fee761', outline: '#181425', lip: '#a26a5a' };
  const PIKE = { skin: '#f2c094', skinSh: '#c28569', hair: '#5a3a2a', hairSh: '#3e2731', hairHi: '#b86f50',
    shirt: '#124e89', shirtSh: '#1c2a44', shirtHi: '#4a7fb5', pants: '#262b44', pantsSh: '#181425',
    boots: '#262b44', belt: '#262b44', buckle: '#feae34', outline: '#181425', lip: '#a26a5a' };
  const BOW = { skin: '#e8b796', skinSh: '#c28569', hair: '#733e39', hairSh: '#3e2731', hairHi: '#b86f50',
    shirt: '#b86f50', shirtSh: '#733e39', shirtHi: '#e4a672', pants: '#3e4a2a', pantsSh: '#2a3320',
    boots: '#3e2731', belt: '#3e2731', buckle: '#c0cbdc', outline: '#181425', lip: '#a26a5a' };
  const FRIAR = { skin: '#f2c094', skinSh: '#c28569', hair: '#8a6a4a', hairSh: '#5a3a2a', hairHi: '#c8b28a',
    shirt: '#ead4aa', shirtSh: '#c8b28a', shirtHi: '#fff6c9', pants: '#8a6a4a', pantsSh: '#5a3a2a',
    boots: '#5a3a2a', belt: '#b86f50', buckle: '#8a6a4a', outline: '#181425', lip: '#a26a5a' };
  const DRUDGE = { skin: '#d99a78', skinSh: '#a26a5a', hair: '#4a3a2a', hairSh: '#2a2018', hairHi: '#8a6a4a',
    shirt: '#5a6988', shirtSh: '#3a4466', shirtHi: '#8b9bb4', pants: '#4a3a2a', pantsSh: '#2a2018',
    boots: '#262b44', belt: '#3e2731', buckle: '#8b9bb4', outline: '#181425', lip: '#a26a5a' };

  Object.assign(R.PAL, { TINY_BLADE: BLADE, TINY_PIKE: PIKE, TINY_BOW: BOW, TINY_FRIAR: FRIAR, TINY_DRUDGE: DRUDGE });

  const SWORD_PAL = { blade: '#c0cbdc', shine: '#ffffff', guard: '#feae34', grip: '#733e39' };
  const BOW_PAL = { limb: '#b86f50', string: '#ead4aa', arrow: '#c28569', tip: '#8b9bb4', fletch: '#e43b44' };
  const AXE_PAL = { handle: '#b86f50', head: '#c0cbdc', shine: '#ffffff' };

  // Local organic helpers built ONLY on base primitives (px/rect/ellipse/hash)
  // so bespoke painters run on any API generation — including the bench's
  // old-vs-new harness, which swaps makeApi. Packs must never hard-require
  // the Pixel.prototype conveniences.
  function tblob(api, cx, cy, rx, ry, base, hi, sh) {
    api.ellipse(cx - rx, cy - ry, cx + rx, cy + ry, base, true);
    const hb = Math.max(1, ry >> 1);
    if (hi) api.ellipse(cx - rx + 1, cy - ry, cx + rx - 1, cy - ry + hb, hi, true);
    if (sh) api.ellipse(cx - rx + 1, cy + ry - hb, cx + rx - 1, cy + ry, sh, true);
  }
  function tspeck(api, x0, y0, x1, y1, seed, colors, density = 0.08) {
    const l = Math.round(Math.min(x0, x1)), r = Math.round(Math.max(x0, x1)), t = Math.round(Math.min(y0, y1)), b = Math.round(Math.max(y0, y1));
    for (let y = t; y <= b; y++) for (let x = l; x <= r; x++) {
      const h = api.hash(x, y, seed);
      if (h < density) api.px(x, y, colors[Math.floor(api.hash(x, y, seed + 99) * colors.length) % colors.length]);
    }
  }
  function eyeAt(api, x, y, eye) {
    if (eye === 'closed') api.line(x, y + 1, x + 1, y + 1, OUT, 1);
    else if (eye === 'hurt') { api.px(x, y, OUT); api.px(x + 1, y + 1, OUT); api.px(x + 1, y, OUT); api.px(x, y + 1, OUT); }
    else if (eye === 'dead') api.line(x, y, x + 1, y + 1, OUT, 1);
    else { api.rect(x, y, x + 1, y + 1, OUT); api.px(x, y, '#ffffff'); }
  }
  // Short-pattern spear (len 10, not the shared len-14): at the 0.8rad strike
  // frame the shared shine pixel lands y30 (past the engine shadow row 29).
  // Local copy keeps every other spear in the library byte-identical.
  function tspear(api, hx, hy, angle) {
    const len = 10, tx = hx + Math.cos(angle) * len, ty = hy + Math.sin(angle) * len;
    const bx = hx - Math.cos(angle) * 3, by = hy - Math.sin(angle) * 3;
    api.line(bx, by, tx, ty, '#b86f50', 2);
    const ha = angle + Math.PI / 2;
    api.line(tx - Math.cos(angle) * 2, ty - Math.sin(angle) * 2, tx + Math.cos(angle) * 2, ty + Math.sin(angle) * 2, '#c0cbdc', 1);
    api.px(tx + Math.cos(angle) * 3, ty + Math.sin(angle) * 3, '#ffffff');
    api.line(tx - Math.cos(ha) * 2, ty - Math.sin(ha) * 2, tx + Math.cos(ha) * 2, ty + Math.sin(ha) * 2, '#5a6988', 1);
  }

  /* ================= shared squat rig ================= */
  // gear: { head: {type:'helm'|'hood'|'hat', c, sh, hi, band?}, weapon, shield,
  //   cast (array|null), trim(api,X,BY) front chest detail }
  function squatPaint(pal, gear, facing, o = {}) {
    return (buf, W, H) => {
      const api = P().makeApi(buf, W, H);
      squatBody(api, pal, gear, facing, o);
      squatTool(api, pal, gear, facing, o);
      if (o.castGlow) P().particles(api, o.castGlow[0], o.castGlow[1], 7, o.castGlow[2], gear.cast);
      if (o.flash) P().flashWhite(api, W, H, buf);
      P().finishSelective(buf, W, H, OUT, { light: RIM });
      if (o.fade) R.fadeOut(buf, W, H, o.fade, o.seed || 0);
    };
  }
  function squatBody(api, pal, gear, facing, o) {
    const bob = o.bob || 0, kb = o.kb || 0, hd = o.headDy || 0, ad = o.armDy || 0;
    const X = x => x + kb, BY = y => y + bob, HY = y => y + bob + hd;
    const side = facing === 'side', back = facing === 'up';
    const legL = o.legL || { dx: 0, dy: 0 }, legR = o.legR || { dx: 0, dy: 0 };
    // legs + boots (stub, planted y23..27)
    api.rect(X(11 + legL.dx), BY(23 + legL.dy), X(13 + legL.dx), BY(25 + legL.dy), pal.pants);
    api.rect(X(18 + legR.dx), BY(23 + legR.dy), X(20 + legR.dx), BY(25 + legR.dy), pal.pants);
    api.rect(X(11 + legL.dx), BY(25 + legL.dy), X(13 + legL.dx), BY(27 + legL.dy), pal.boots);
    api.rect(X(18 + legR.dx), BY(25 + legR.dy), X(20 + legR.dx), BY(27 + legR.dy), pal.boots);
    api.px(X(11 + legL.dx), BY(27 + legL.dy), pal.pantsSh); api.px(X(20 + legR.dx), BY(27 + legR.dy), pal.pantsSh);
    // torso blob + cloth tooth + belt
    tblob(api, X(16), BY(19), 6, 4, pal.shirt, pal.shirtHi, pal.shirtSh);
    tspeck(api, X(11), BY(17), X(21), BY(21), 7, [pal.shirtSh, pal.shirtHi], 0.08);
    api.rect(X(10), BY(21), X(21), BY(22), pal.belt);
    api.rect(X(15), BY(21), X(16), BY(22), pal.buckle); api.px(X(15), BY(21), '#ffffff');
    if (back) { api.line(X(14), BY(15), X(17), BY(22), '#3e2731', 1); api.line(X(17), BY(15), X(14), BY(22), '#3e2731', 1); }
    else if (gear.trim) gear.trim(api, X, BY);
    // arms: stub sleeves + skin fists
    const aY = d => BY(16 + d + ad);
    if (side) {
      api.rect(X(11), aY(0), X(13), aY(3), pal.shirt); api.rect(X(11), aY(4), X(13), aY(6), pal.skin);
      api.rect(X(18), aY(-1), X(20), aY(2), pal.shirt); api.rect(X(18), aY(3), X(20), aY(5), pal.skin);
    } else {
      api.rect(X(8), aY(0), X(10), aY(3), pal.shirt); api.rect(X(8), aY(4), X(10), aY(6), pal.skin);
      api.rect(X(21), aY(0), X(23), aY(3), pal.shirt); api.rect(X(21), aY(4), X(23), aY(6), pal.skin);
    }
    squatHead(api, pal, gear, facing, o, X, HY);
  }
  function squatHead(api, pal, gear, facing, o, X, HY) {
    const h = gear.head, side = facing === 'side', back = facing === 'up';
    if (h.type === 'helm') {
      if (back) tblob(api, X(16), HY(13), 5, 3, pal.hair, pal.hairHi, pal.hairSh);
      else if (side) {
        tblob(api, X(15), HY(13), 5, 3, pal.skin, null, pal.skinSh);
        api.px(X(20), HY(13), pal.skinSh); api.px(X(21), HY(14), pal.skinSh);
        eyeAt(api, X(17), HY(13), o.eye);
      } else {
        tblob(api, X(16), HY(13), 5, 3, pal.skin, null, pal.skinSh);
        api.rect(X(10), HY(13), X(10), HY(14), pal.skin); api.rect(X(21), HY(13), X(21), HY(14), pal.skin);
        eyeAt(api, X(13), HY(13), o.eye); eyeAt(api, X(18), HY(13), o.eye);
        api.px(X(15), HY(14), pal.skinSh); api.px(X(16), HY(14), pal.skinSh);
        api.px(X(15), HY(15), pal.lip); api.px(X(16), HY(15), pal.lip);
      }
      const cx = side ? 15 : 16; // dome top y5 -> outline y4, always inside
      tblob(api, X(cx), HY(8), 6, 3, h.c, h.hi, h.sh);
      if (gear.ridge) api.line(X(cx), HY(5), X(cx), HY(10), h.hi, 1); // morion ridge
      const bx0 = side ? 7 : 7, bx1 = side ? 23 : 24;
      api.rect(X(bx0), HY(10), X(bx1), HY(11), h.sh); api.rect(X(bx0), HY(10), X(bx1), HY(10), RIM);
    } else if (h.type === 'hood') {
      // rounded cowl, no brim: face sits inset y12..15
      if (back) { tblob(api, X(16), HY(10), 7, 5, h.c, null, h.sh); tblob(api, X(16), HY(12), 4, 3, h.sh, null, null); }
      else if (side) {
        tblob(api, X(15), HY(10), 7, 5, h.c, null, h.sh);
        tblob(api, X(16), HY(13), 4, 2, pal.skin, null, pal.skinSh);
        eyeAt(api, X(17), HY(13), o.eye);
      } else {
        tblob(api, X(16), HY(10), 7, 5, h.c, null, h.sh);
        tblob(api, X(16), HY(13), 4, 2, pal.skin, null, pal.skinSh);
        eyeAt(api, X(13), HY(13), o.eye); eyeAt(api, X(17), HY(13), o.eye);
        api.px(X(15), HY(14), pal.skinSh); api.px(X(16), HY(14), pal.skinSh);
      }
      api.px(X(14), HY(5), h.c); api.px(X(17), HY(5), h.c); // cowl peak texture
    } else { // hat: flat work cap + band, hair fringe below
      if (back) { api.rect(X(10), HY(11), X(21), HY(14), pal.hair); }
      else if (side) {
        tblob(api, X(15), HY(13), 5, 3, pal.skin, null, pal.skinSh);
        api.rect(X(10), HY(11), X(20), HY(12), pal.hair); eyeAt(api, X(17), HY(13), o.eye);
      } else {
        tblob(api, X(16), HY(13), 5, 3, pal.skin, null, pal.skinSh);
        api.rect(X(11), HY(11), X(20), HY(12), pal.hair);
        eyeAt(api, X(13), HY(13), o.eye); eyeAt(api, X(18), HY(13), o.eye);
        api.px(X(15), HY(14), pal.skinSh); api.px(X(16), HY(14), pal.skinSh);
      }
      const cx = side ? 15 : 16;
      api.rect(X(cx - 6), HY(8), X(cx + 6), HY(10), h.c); // crown
      api.rect(X(cx - 6), HY(10), X(cx + 6), HY(11), h.band || h.sh); // band
      api.rect(X(cx - 8), HY(11), X(cx + 8), HY(12), h.c); // wide brim
      api.rect(X(cx - 8), HY(12), X(cx + 8), HY(12), h.sh);
    }
  }
  function squatTool(api, pal, gear, facing, o) {
    const bob = o.bob || 0, kb = o.kb || 0, ad = o.armDy || 0;
    const X = x => x + kb, Y = y => y + bob;
    const w = gear.weapon;
    if (o.tool === 'none') return;
    if (o.crate) { // worker carry: crate held front, hands on its sides
      api.rect(X(11), Y(18 + ad), X(20), Y(23 + ad), '#b86f50');
      api.rect(X(11), Y(18 + ad), X(20), Y(19 + ad), '#733e39');
      api.line(X(11), Y(20 + ad), X(20), Y(22 + ad), '#733e39', 1);
      api.rect(X(10), Y(19 + ad), X(11), Y(21 + ad), pal.skin); api.rect(X(20), Y(19 + ad), X(21), Y(21 + ad), pal.skin);
      return;
    }
    if (facing === 'side') {
      const hx = X(22), hy = Y(20 + ad);
      if (o.tool === 'shield' || (w === 'sword' && o.block) || (w === 'spear' && o.block)) { P().shield(api, X(10), Y(19), '#b86f50', '#8b9bb4'); return; }
      if (w === 'spear') tspear(api, hx, hy, o.angle !== undefined ? o.angle : 0.3);
      else if (w === 'bow') P().bow(api, hx + 4, hy - 2, o.pull || 0, BOW_PAL, o.arrow === false ? 0 : 1);
      else if (w === 'staff') { const a = o.angle !== undefined ? o.angle : 0.5, tx = hx + Math.cos(a) * 12, ty = hy + Math.sin(a) * 12; api.line(hx - Math.cos(a) * 3, hy - Math.sin(a) * 3, tx, ty, '#b86f50', 2); api.rect(tx - 1, ty - 2, tx + 1, ty, '#2ce8f5'); api.px(tx, ty - 1, '#ffffff'); }
      if (o.staffUp) { api.line(hx, hy + 4, hx, hy - 10, '#b86f50', 2); api.rect(hx - 1, hy - 12, hx + 1, hy - 10, '#2ce8f5'); api.px(hx, hy - 11, '#ffffff'); }
      else if (w === 'axe') P().axe(api, hx, hy, o.angle !== undefined ? o.angle : 0.5, AXE_PAL);
      else P().sword(api, hx, hy, o.angle !== undefined ? o.angle : 0.5, SWORD_PAL);
      if (o.slash) P().slash(api, hx + 2, hy - 4, 9, o.slash[0], o.slash[1], '#ffffff', 2);
    } else {
      const hx = X(23), hy = Y(20 + ad), lx = X(9), ly = Y(19 + ad);
      const dir = facing === 'up' ? -1 : 1;
      if (o.tool === 'shield' || o.block) { P().kiteShield(api, X(9), Y(19), '#e8ecf5', '#8b9bb4', '#a22633'); return; }
      if (w === 'spear') tspear(api, hx, hy, o.angle !== undefined ? o.angle : 0.3);
      else if (w === 'bow') P().bowFront(api, lx - 3, ly - 1, o.pull || 0, dir, BOW_PAL, o.arrow === false ? 0 : 1);
      else if (w === 'staff') { const a = o.angle !== undefined ? o.angle : 0.3, tx = hx + Math.cos(a) * 11, ty = hy + Math.sin(a) * 11; api.line(hx - Math.cos(a) * 3, hy - Math.sin(a) * 3, tx, ty, '#b86f50', 2); api.rect(tx - 1, ty - 2, tx + 1, ty, '#b55088'); }
      if (o.staffUp) { api.line(lx, ly + 4, lx, ly - 10, '#b86f50', 2); api.rect(lx - 1, ly - 12, lx + 1, ly - 10, '#b55088'); api.px(lx, ly - 11, '#ffffff'); }
      else if (w === 'axe') P().axe(api, hx, hy, o.angle !== undefined ? o.angle : 0.3, AXE_PAL);
      else P().sword(api, hx, hy, o.angle !== undefined ? o.angle : 0.3, SWORD_PAL);
      // tucked front arc: bottom lands y27, outline y28 — never shadow row 29
      if (o.slash) P().slash(api, X(16), Y(15), 10, o.slash[0], o.slash[1], '#ffffff', 2);
    }
  }
  function squatFallen(pal, gear) {
    return fade => (buf, W, H) => {
      const api = P().makeApi(buf, W, H);
      if (gear.head.type === 'helm') tblob(api, 7, 23, 4, 3, gear.head.c, gear.head.hi, gear.head.sh);
      else if (gear.head.type === 'hood') tblob(api, 7, 23, 4, 3, gear.head.c, null, gear.head.sh);
      else api.rect(3, 21, 11, 24, gear.head.c);
      api.rect(12, 22, 22, 26, pal.shirt); api.rect(12, 25, 22, 26, pal.shirtSh); api.rect(12, 22, 22, 23, pal.shirtHi);
      api.rect(23, 22, 27, 24, pal.pants); api.rect(23, 25, 27, 26, pal.pants); api.rect(27, 22, 29, 26, pal.boots);
      api.rect(13, 22, 16, 23, pal.skin);
      P().finishSelective(buf, W, H, OUT, { light: RIM });
      if (fade) R.fadeOut(buf, W, H, fade, 3);
    };
  }
  // Full suite on the squat rig. State names mirror humanoidSuite so game
  // wiring and muscle memory transfer; bow units get bow_side draw holds.
  function squatSuite(pal, gear, label, opts = {}) {
    const states = [], HEAD = [0, 1, 1, 0], ARM = [0, 0, 1, 1];
    const sneak = opts.sneak ? -1 : 0;
    const idleTool = gear.weapon === 'sword' || gear.weapon === 'spear' ? 'shieldIdle' : 'none';
    for (const [sname, facing] of [['idle_down', 'down'], ['idle_side', 'side'], ['idle_up', 'up']]) {
      const fr = [];
      for (let i = 0; i < 4; i++) fr.push(Fr(ms(4), squatPaint(pal, gear, facing, { headDy: HEAD[i], armDy: ARM[i], eye: i === 3 ? 'closed' : 'open', tool: facing === 'down' && gear.shield ? 'shield' : 'none' })));
      states.push(D(sname, 4, true, fr));
    }
    for (const [sname, facing] of [['walk_down', 'down'], ['walk_side', 'side'], ['walk_up', 'up']]) {
      const fr = [];
      for (let i = 0; i < 4; i++) {
        const s = Math.sin(i / 4 * Math.PI * 2);
        fr.push(Fr(ms(6), squatPaint(pal, gear, facing, { bob: Math.round(-Math.abs(s)) + sneak, legL: { dx: 0, dy: Math.round(s) }, legR: { dx: 0, dy: Math.round(-s) }, armDy: Math.round(-s), eye: 'open', tool: facing === 'down' && gear.shield ? 'shield' : 'none' })));
      }
      states.push(D(sname, 6, true, fr));
    }
    for (const [sname, facing] of [['run_down', 'down'], ['run_side', 'side'], ['run_up', 'up']]) {
      const fr = [];
      for (let i = 0; i < 6; i++) {
        const a = i / 6 * Math.PI * 2, bob = Math.round(-Math.abs(Math.sin(a)) * 2 - Math.cos(a)), s = Math.sin(a);
        fr.push(Fr(ms(10), squatPaint(pal, gear, facing, { bob: bob + sneak, legL: { dx: Math.round(s), dy: Math.round(-Math.max(0, s) * 2) }, legR: { dx: Math.round(-s), dy: Math.round(-Math.max(0, -s) * 2) }, armDy: Math.round(-s * 2), eye: 'open', tool: 'none' })));
      }
      states.push(D(sname, 10, true, fr));
    }
    if (gear.weapon === 'bow') {
      const pulls = [0, 0.45, 0.85, 1, 0.1], dur = [145, 120, 120, 105, 170], fr = [];
      const draw = [-1, -2, -3, -4, -1]; // bow arm rises as the string comes back
      for (let i = 0; i < 5; i++) fr.push(Fr(dur[i], squatPaint(pal, gear, 'side', { armDy: draw[i], pull: pulls[i], arrow: i < 4, eye: 'open' })));
      states.push(D('bow_side', 10, true, fr));
      for (const [sname, facing] of [['attack_down', 'down'], ['attack_up', 'up']]) {
        const f2 = [];
        for (let i = 0; i < 5; i++) f2.push(Fr(dur[i], squatPaint(pal, gear, facing, { armDy: draw[i], pull: pulls[i], arrow: i < 4, eye: 'open' })));
        states.push(D(sname, 10, true, f2));
      }
    } else {
      const angles = [-2.2, -1.5, 0.1, 0.8, 0.3], dur = [195, 95, 95, 120, 155];
      const fr = [];
      for (let i = 0; i < 5; i++) fr.push(Fr(dur[i], squatPaint(pal, gear, 'side', { armDy: -2, angle: angles[i], slash: i === 2 ? [-0.6, 0.9] : (i === 3 ? [-0.2, 0.6] : null), eye: 'open' })));
      states.push(D('attack_side', 10, true, fr));
      for (const [sname, facing] of [['attack_down', 'down'], ['attack_up', 'up']]) {
        const f2 = [];
        for (let i = 0; i < 5; i++) f2.push(Fr(dur[i], squatPaint(pal, gear, facing, { armDy: -2, angle: angles[i], slash: i === 2 ? [0.5, 2.7] : (i === 3 ? [-0.2, 0.6] : null), eye: 'open' })));
        states.push(D(sname, 10, true, f2));
      }
    }
    if (gear.shield) {
      const fr = [], bobs = [0, -1, 0, -1];
      for (let i = 0; i < 4; i++) fr.push(Fr(ms(8), squatPaint(pal, gear, 'down', { bob: bobs[i], armDy: -2, block: true, tool: 'shield', eye: 'open' })));
      states.push(D('block', 8, true, fr));
    }
    if (gear.cast) {
      const fr = [];
      for (let i = 0; i < 4; i++) fr.push(Fr(ms(7), squatPaint(pal, gear, 'down', { armDy: -2, staffUp: true, eye: i === 3 ? 'closed' : 'open', castGlow: [16, 8 - (i === 2 ? 1 : 0), i / 4] })));
      states.push(D('cast', 7, true, fr));
      const sf = [];
      for (let i = 0; i < 4; i++) sf.push(Fr(ms(7), squatPaint(pal, gear, 'side', { armDy: -2, staffUp: true, eye: i === 3 ? 'closed' : 'open', castGlow: [25, 9 - (i === 2 ? 1 : 0), i / 4] })));
      states.push(D('cast_side', 7, true, sf));
    }
    states.push(D('hurt', 7, true, [
      Fr(ms(7), squatPaint(pal, gear, 'side', { kb: 2, eye: 'hurt', flash: true })),
      Fr(ms(7), squatPaint(pal, gear, 'side', { kb: 1, eye: 'hurt' }))
    ]));
    const fall = squatFallen(pal, gear);
    states.push(D('death', 6, false, [
      Fr(ms(6), squatPaint(pal, gear, 'side', { kb: 1, eye: 'dead' })),
      Fr(ms(6), fall(0)), Fr(ms(6), fall(0.45)), Fr(ms(6), fall(0.8))
    ]));
    if (opts.carry) {
      const fr = [];
      for (let i = 0; i < 4; i++) fr.push(Fr(ms(4), squatPaint(pal, gear, 'down', { headDy: HEAD[i], armDy: ARM[i], eye: i === 3 ? 'closed' : 'open', crate: true })));
      states.push(D('carry', 4, true, fr));
    }
    return { width: 32, height: 32, name: label, layers: [{ name: 'Body' }], states };
  }

  /* ================= unit gears (all original) ================= */
  const bladeGear = { head: { type: 'helm', c: '#8b9bb4', hi: '#e6ebf7', sh: '#5a6988' }, weapon: 'sword', shield: true,
    trim: (api, X, BY) => { api.line(X(11), BY(16), X(20), BY(21), '#3e2731', 1); api.rect(X(15), BY(18), X(16), BY(19), '#fee761'); api.px(X(15), BY(18), '#ffffff'); } };
  const pikeGear = { head: { type: 'helm', c: '#c0cbdc', hi: '#ffffff', sh: '#5a6988' }, weapon: 'spear', shield: true, ridge: true,
    trim: (api, X, BY) => { api.px(X(15), BY(15), '#fee761'); api.px(X(16), BY(15), '#fee761'); api.px(X(15), BY(17), '#fee761'); api.px(X(16), BY(17), '#fee761'); api.rect(X(12), BY(19), X(19), BY(19), '#feae34'); } };
  const bowGear = { head: { type: 'hood', c: '#733e39', sh: '#3e2731' }, weapon: 'bow',
    trim: (api, X, BY) => { api.line(X(12), BY(14), X(19), BY(20), '#3e2731', 1); api.px(X(13), BY(13), '#e43b44'); api.px(X(18), BY(13), '#e43b44'); } };
  const friarGear = { head: { type: 'hood', c: '#b86f50', sh: '#733e39' }, weapon: 'staff', cast: ['#63c74d', '#fee761', '#ffffff'],
    trim: (api, X, BY) => { api.rect(X(12), BY(19), X(19), BY(20), '#b86f50'); api.px(X(14), BY(19), '#733e39'); api.px(X(17), BY(19), '#733e39'); } };
  const drudgeGear = { head: { type: 'hat', c: '#733e39', sh: '#3e2731', band: '#3e2731' }, weapon: 'axe',
    trim: (api, X, BY) => { api.rect(X(11), BY(17), X(13), BY(19), '#3e2731'); api.px(X(12), BY(18), '#5a6988'); } };

  function bladeSuite() { return squatSuite(BLADE, bladeGear, 'tiny-blade'); }
  function pikeSuite() { return squatSuite(PIKE, pikeGear, 'tiny-pike'); }
  function bowSuite() { return squatSuite(BOW, bowGear, 'tiny-bow', { sneak: true }); }
  function friarSuite() { return squatSuite(FRIAR, friarGear, 'tiny-friar'); }
  function drudgeSuite() { return squatSuite(DRUDGE, drudgeGear, 'tiny-drudge', { carry: true }); }

  return { bladeSuite, pikeSuite, bowSuite, friarSuite, drudgeSuite,
    squatSuite, squatPaint, squatBody, squatHead, squatTool, tblob, tspeck, eyeAt,
    GEAR: { bladeGear, pikeGear, bowGear, friarGear, drudgeGear } };
})();
