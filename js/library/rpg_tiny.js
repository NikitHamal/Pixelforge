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

  const SWORD_PAL = { blade: '#c0cbdc', shine: '#ffffff', guard: '#8b9bb4', grip: '#733e39' };
  // Steel dark→light→hot: the tail of a swing is in shadow, the head is not.
  const STEEL = ['#5a6988', '#c0cbdc', '#ffffff'];
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

  /* Shared axe() runs a 9px haft into a size-3 head blob that hangs ~5px below
     the tip, so any downward sweep puts the head through the floor line and
     into the engine's shadow row. Local copy with a shorter haft and a tighter
     head; same reasoning as tspear — keeps every other axe byte-identical. */
  function taxe(api, hx, hy, angle) {
    const len = 7, tx = hx + Math.cos(angle) * len, ty = hy + Math.sin(angle) * len;
    api.line(hx, hy, tx, ty, AXE_PAL.handle, 2);
    const ha = angle + Math.PI / 2;
    api.line(tx - Math.cos(ha) * 1, ty - Math.sin(ha) * 1, tx + Math.cos(ha) * 2, ty + Math.sin(ha) * 2, AXE_PAL.head, 2);
    api.px(tx, ty, AXE_PAL.shine);
  }

  /* ================= eight-direction view model =================
     dg is the quarter-turn lean: 0 = square-on or full profile (the original
     five geometries, byte-identical), ±1 = three-quarter. Only five geometries
     are authored — the three left-hand views are mirrored from their right
     equivalents in squatPaint *before* the outline pass, which is safe because
     outlineSelective rims only top-facing edges, so a horizontal mirror cannot
     put the light on the wrong side. */
  const VIEWS = ['down', 'downright', 'side', 'upright', 'up', 'upleft', 'left', 'downleft'];
  const MIRROR = { left: 'side', downleft: 'downright', upleft: 'upright' };
  const DG = f => (f === 'downright' || f === 'upright') ? 1 : (f === 'downleft' || f === 'upleft') ? -1 : 0;

  let _scratch = null;
  function scratch(n) { if (!_scratch || _scratch.length !== n) _scratch = new Uint32Array(n); return _scratch; }

  /* ================= shared squat rig ================= */
  // gear: { head: {type:'helm'|'hood'|'hat', c, sh, hi, band?}, weapon, shield,
  //   cast (array|null), trim(api,X,BY) front chest detail }
  function squatPaint(pal, gear, facing, o = {}) {
    const mir = MIRROR[facing], view = mir || facing;
    return (buf, W, H) => {
      let src = buf;
      if (mir) { src = scratch(W * H); src.fill(0); }
      const api = P().makeApi(src, W, H);
      /* `behind` is the whole paper-doll trick at one call: on the recovery
         frames the blade has swung past the body, so it must be occluded by it.
         Mana Seed ships the weapon on a separate sheet for this; a painter that
         runs in either order gets the same read with no layer machinery. */
      if (o.behind) { squatTool(api, pal, gear, view, o); squatBody(api, pal, gear, view, o); }
      else { squatBody(api, pal, gear, view, o); squatTool(api, pal, gear, view, o); }
      if (o.dust) P().dustPuff(api, 16 + (o.kb || 0), 27, o.dustSeed || 0, o.dust);
      if (o.castGlow) P().particles(api, o.castGlow[0], o.castGlow[1], 7, o.castGlow[2], gear.cast);
      if (mir) PF.Raster.mirrorInto(src, buf, W, H);
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
    const dg = DG(facing);
    if (dg) {
      /* Three-quarter: everything shifts into the turn and the body is one px
         narrower than the front view. Far limbs go down first so the torso
         occludes them, which is what buys the depth read. */
      const s = dg, bk = facing === 'upright';
      const tc = 16 + s, nc = 16 + 2 * s, fc = 16 - s;
      const rb = (cx, y0, y1, w, c) => api.rect(X(cx - w), BY(y0), X(cx + w), BY(y1), c);
      rb(fc + legL.dx, 23 + legL.dy, 24 + legL.dy, 1, pal.pants);
      rb(fc + legL.dx, 25 + legL.dy, 26 + legL.dy, 1, pal.boots);
      rb(tc - 6 * s, 16 + ad, 18 + ad, 1, pal.shirt);
      rb(tc - 6 * s, 19 + ad, 21 + ad, 1, pal.skin);
      tblob(api, X(tc), BY(19), 5, 4, pal.shirt, pal.shirtHi, pal.shirtSh);
      tspeck(api, X(tc - 4), BY(17), X(tc + 4), BY(21), 7, [pal.shirtSh, pal.shirtHi], 0.08);
      rb(tc, 21, 22, 5, pal.belt);
      rb(tc, 21, 22, 1, pal.buckle); api.px(X(tc), BY(21), '#ffffff');
      if (bk) { api.line(X(tc - 3), BY(15), X(tc + 3), BY(22), '#3e2731', 1); api.line(X(tc + 3), BY(15), X(tc - 3), BY(22), '#3e2731', 1); }
      else if (gear.trim) gear.trim(api, x => X(x + s), BY);
      rb(nc + legR.dx, 23 + legR.dy, 25 + legR.dy, 1, pal.pants);
      rb(nc + legR.dx, 25 + legR.dy, 27 + legR.dy, 1, pal.boots);
      rb(tc + 6 * s, 16 + ad, 18 + ad, 1, pal.shirt);
      rb(tc + 6 * s, 19 + ad, 21 + ad, 1, pal.skin);
      squatHead(api, pal, gear, facing, o, X, HY);
      return;
    }
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
    const dg = DG(facing);
    if (dg) {
      /* Three-quarter head: the face stays five wide but both eyes crowd the
         turning side, and the helm/brim shifts further than the torso does —
         a head leads a turn, it does not rotate with the shoulders. */
      const s = dg, hc = 16 + s, bk = facing === 'upright';
      if (h.type === 'helm') {
        if (bk) {
          tblob(api, X(hc), HY(13), 5, 3, pal.hair, pal.hairHi, pal.hairSh);
          api.px(X(hc + 5 * s), HY(13), pal.skin); api.px(X(hc + 5 * s), HY(14), pal.skinSh); // cheek rounding past the helm
        } else {
          tblob(api, X(hc), HY(13), 5, 3, pal.skin, null, pal.skinSh);
          eyeAt(api, X(hc - 2 * s), HY(13), o.eye); eyeAt(api, X(hc + 2 * s), HY(13), o.eye);
          api.px(X(hc + s), HY(14), pal.skinSh);
          api.px(X(hc), HY(15), pal.lip); api.px(X(hc + s), HY(15), pal.lip);
        }
        tblob(api, X(hc), HY(8), 6, 3, h.c, h.hi, h.sh);
        if (gear.ridge) api.line(X(hc), HY(5), X(hc), HY(10), h.hi, 1);
        api.rect(X(hc - 7), HY(10), X(hc + 7), HY(11), h.sh);
        api.rect(X(hc - 7), HY(10), X(hc + 7), HY(10), RIM);
      } else if (h.type === 'hood') {
        if (bk) { tblob(api, X(hc), HY(10), 6, 5, h.c, null, h.sh); tblob(api, X(hc), HY(12), 4, 3, h.sh, null, null); }
        else {
          tblob(api, X(hc), HY(10), 6, 5, h.c, null, h.sh);
          tblob(api, X(hc), HY(13), 4, 2, pal.skin, null, pal.skinSh);
          eyeAt(api, X(hc - 2 * s), HY(13), o.eye); eyeAt(api, X(hc + 2 * s), HY(13), o.eye);
        }
        api.px(X(hc - 2 * s), HY(5), h.c); api.px(X(hc + s), HY(5), h.c);
      } else {
        if (bk) api.rect(X(hc - 5), HY(11), X(hc + 5), HY(14), pal.hair);
        else {
          tblob(api, X(hc), HY(13), 5, 3, pal.skin, null, pal.skinSh);
          api.rect(X(hc - 5), HY(11), X(hc + 5), HY(12), pal.hair);
          eyeAt(api, X(hc - 2 * s), HY(13), o.eye); eyeAt(api, X(hc + 2 * s), HY(13), o.eye);
          api.px(X(hc + s), HY(14), pal.skinSh);
        }
        api.rect(X(hc - 6), HY(8), X(hc + 6), HY(10), h.c);
        api.rect(X(hc - 6), HY(10), X(hc + 6), HY(11), h.band || h.sh);
        api.rect(X(hc - 8), HY(11), X(hc + 8), HY(12), h.c);
        api.rect(X(hc - 8), HY(12), X(hc + 8), HY(12), h.sh);
      }
      return;
    }
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
    const bob = o.bob || 0, kb = o.kb || 0, ad = o.armDy || 0, dg = DG(facing);
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
      if (o.tool === 'shield' || (w === 'sword' && o.block) || (w === 'spear' && o.block)) {
        P().shield(api, X(10), Y(19), '#b86f50', '#8b9bb4');
        if (o.impact) P().impactStar(api, X(5), Y(19), o.impact[2], ['#ffffff', '#c0cbdc']);
        return;
      }
      if (w === 'spear') tspear(api, hx, hy, o.angle !== undefined ? o.angle : 0.3);
      else if (w === 'bow') P().bow(api, hx + 4, hy - 2, o.pull || 0, BOW_PAL, o.arrow ? 1 : 0);
      else if (w === 'staff') { const a = o.angle !== undefined ? o.angle : 0.5, tx = hx + Math.cos(a) * 12, ty = hy + Math.sin(a) * 12; api.line(hx - Math.cos(a) * 3, hy - Math.sin(a) * 3, tx, ty, '#b86f50', 2); api.rect(tx - 1, ty - 2, tx + 1, ty, '#2ce8f5'); api.px(tx, ty - 1, '#ffffff'); }
      if (o.staffUp) { api.line(hx, hy + 4, hx, hy - 10, '#b86f50', 2); api.rect(hx - 1, hy - 12, hx + 1, hy - 10, '#2ce8f5'); api.px(hx, hy - 11, '#ffffff'); }
      else if (w === 'axe') taxe(api, hx, hy, o.angle !== undefined ? o.angle : 0.5);
      else P().sword(api, hx, hy, o.angle !== undefined ? o.angle : 0.5, SWORD_PAL);
      if (o.slash) P().slash(api, hx + 2, hy - 4, 9, o.slash[0], o.slash[1], '#ffffff', 2);
      if (o.arc) P().arcTrail(api, hx, hy, o.arc[2] || 10, o.arc[0], o.arc[1], STEEL, { seed: o.arcSeed || 0 });
      if (o.impact) P().impactStar(api, hx + o.impact[0], hy + o.impact[1], o.impact[2], ['#ffffff', '#c0cbdc']);
      if (o.shot) { api.line(hx + 8, hy - 2, hx + 12, hy - 2, '#c0cbdc', 1); api.px(hx + 13, hy - 2, '#ffffff'); }
    } else {
      const hx = X(23 - dg), hy = Y(20 + ad), lx = X(9 + dg), ly = Y(19 + ad);
      const dir = facing === 'up' || facing === 'upright' ? -1 : 1;
      if (o.tool === 'shield' || o.block) {
        P().kiteShield(api, X(9 + dg), Y(19), '#e8ecf5', '#8b9bb4', '#a22633');
        if (o.impact) P().impactStar(api, X(4 + dg), Y(19), o.impact[2], ['#ffffff', '#c0cbdc']);
        return;
      }
      if (w === 'spear') tspear(api, hx, hy, o.angle !== undefined ? o.angle : 0.3);
      else if (w === 'bow') P().bowFront(api, lx - 3, ly - 1, o.pull || 0, dir, BOW_PAL, o.arrow ? 1 : 0);
      else if (w === 'staff') { const a = o.angle !== undefined ? o.angle : 0.3, tx = hx + Math.cos(a) * 11, ty = hy + Math.sin(a) * 11; api.line(hx - Math.cos(a) * 3, hy - Math.sin(a) * 3, tx, ty, '#b86f50', 2); api.rect(tx - 1, ty - 2, tx + 1, ty, '#b55088'); }
      if (o.staffUp) { api.line(lx, ly + 4, lx, ly - 10, '#b86f50', 2); api.rect(lx - 1, ly - 12, lx + 1, ly - 10, '#b55088'); api.px(lx, ly - 11, '#ffffff'); }
      else if (w === 'axe') taxe(api, hx, hy, o.angle !== undefined ? o.angle : 0.3);
      else P().sword(api, hx, hy, o.angle !== undefined ? o.angle : 0.3, SWORD_PAL);
      // tucked front arc: bottom lands y27, outline y28 — never shadow row 29
      if (o.slash) P().slash(api, X(16 + dg), Y(15), 10, o.slash[0], o.slash[1], '#ffffff', 2);
      if (o.arc) P().arcTrail(api, X(18 + dg), Y(16), o.arc[2] || 9, o.arc[0], o.arc[1], STEEL, { seed: o.arcSeed || 0 });
      if (o.impact) P().impactStar(api, X(18 + dg) + o.impact[0], Y(16) + o.impact[1], o.impact[2], ['#ffffff', '#c0cbdc']);
      // Square-on shots leave the frame, so the arrow reads as a foreshortened
      // stub ahead of the bow rather than a shaft crossing the body.
      if (o.shot) { api.rect(lx - 4, ly + dir * 7, lx - 2, ly + dir * 8, '#c0cbdc'); api.px(lx - 3, ly + dir * 7, '#ffffff'); }
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
  // Full suite on the squat rig, authored across all eight views. State names
  // mirror humanoidSuite so game wiring transfers; bow units get bow_side holds.
  function squatSuite(pal, gear, label, opts = {}) {
    const states = [], HEAD = [0, 1, 1, 0], ARM = [0, 0, 1, 1];
    const sneak = opts.sneak ? -1 : 0;
    const named = pre => VIEWS.map(v => [pre + v, v]);
    const holdsShield = v => (v === 'down' || v === 'downright') && gear.shield;
    /* A leg at phase `ph` lifts only while it swings forward — the old walk
       pushed the planted foot *down* through the floor and never raised the
       swinging one, which is why it read as sliding rather than stepping. */
    function gait(a, ph, lateral) {
      const v = Math.sin(a + ph);
      return { dx: lateral ? Math.round(v * 1.5) : 0, dy: -Math.round(Math.max(0, v) * 1.5) };
    }
    for (const [sname, facing] of named('idle_')) {
      const fr = [];
      for (let i = 0; i < 4; i++) fr.push(Fr(ms(4), squatPaint(pal, gear, facing, { headDy: HEAD[i], armDy: ARM[i], eye: i === 3 ? 'closed' : 'open', tool: holdsShield(facing) ? 'shield' : 'none' })));
      states.push(D(sname, 4, true, fr));
    }
    for (const [sname, facing] of named('walk_')) {
      const lat = facing === 'side' || !!DG(facing), fr = [];
      for (let i = 0; i < 6; i++) {
        const a = i / 6 * Math.PI * 2;
        // Body is highest at the two heel strikes (i=0,3) and lowest as it
        // passes over each foot. Dust puffs on the strikes.
        fr.push(Fr(ms(6), squatPaint(pal, gear, facing, {
          bob: -Math.round(Math.abs(Math.sin(a))) + sneak,
          legL: gait(a, 0, lat), legR: gait(a, Math.PI, lat),
          armDy: -Math.round(Math.sin(a + Math.PI / 2)),
          dust: i === 0 ? 0.2 : i === 1 ? 0.65 : i === 3 ? 0.2 : i === 4 ? 0.65 : 0,
          dustSeed: i,
          eye: 'open', tool: holdsShield(facing) ? 'shield' : 'none'
        })));
      }
      states.push(D(sname, 6, true, fr));
    }
    for (const [sname, facing] of named('run_')) {
      const lat = facing === 'side' || !!DG(facing), fr = [];
      for (let i = 0; i < 6; i++) {
        const a = i / 6 * Math.PI * 2;
        const bob = Math.min(0, Math.round(-Math.abs(Math.sin(a)) * 2 - Math.cos(a))); // 6 distinct heights, never below the floor line
        fr.push(Fr(ms(10), squatPaint(pal, gear, facing, {
          bob: bob + sneak, kb: lat ? Math.round(Math.cos(a)) : 0,
          legL: gait(a, 0.4, lat), legR: gait(a, Math.PI + 0.4, lat),
          armDy: -Math.round(Math.sin(a + Math.PI / 2) * 2),
          headDy: Math.round(Math.cos(a) * 0.5),
          dust: i === 0 ? 0.3 : i === 3 ? 0.3 : i === 4 ? 0.8 : 0,
          dustSeed: 40 + i,
          eye: 'open', tool: 'none'
        })));
      }
      states.push(D(sname, 10, true, fr));
    }
    if (gear.weapon === 'bow') {
      /* Six-frame draw: nock, two frames of draw, a long held anchor, then a
         55ms release. The hold is the frame that sells aim — spending equal
         time on every frame, as five frames did, made the shot never land. */
      const pulls = [0, 0.4, 0.8, 1, 0.05, 0], dur = [120, 110, 120, 190, 55, 150];
      const arm = [-1, -2, -3, -4, -2, -1];
      const mkBow = facing => {
        const fr = [];
        for (let i = 0; i < 6; i++) fr.push(Fr(dur[i], squatPaint(pal, gear, facing, {
          armDy: arm[i], pull: pulls[i], arrow: i > 0 && i < 4, shot: i === 4,
          // The recovery frame has to differ from the ready frame or the loop
          // hitches; the archer's eyes follow the shot a beat after the arm.
          headDy: i === 5 ? 1 : 0,
          kb: i === 4 ? 1 : (i === 3 ? -1 : 0), eye: i === 3 ? 'closed' : 'open'
        })));
        return fr;
      };
      for (const [sname, facing] of named('attack_')) states.push(D(sname, 10, true, mkBow(facing)));
      states.push(D('bow_side', 10, true, mkBow('side')));
    } else {
      /* Six-frame forehand: a long held windup, one 45ms strike frame that
         carries the whole arc, an impact, then the blade swinging through and
         behind the body. The old five frames stepped evenly, which read as a
         metronome — the uneven timing is what carries the weight. */
      const dur = [200, 120, 45, 70, 130, 165];
      /* The hand stays high through the follow-through. With an 11px blade, a
         hand at hip height and any angle past ~0.8rad puts the tip below y27,
         where the outline pass fuses it into the engine's shadow row. */
      const arm = [-3, -4, -2, -1, -1, -1];
      const step = [0, 1, 2, 2, 1, 0];
      // Profile can lay the blade back over the shoulder; square-on views
      // cannot, because the tip then lands on the face instead of above it.
      const PROF = [-2.45, -2.85, -0.35, 0.6, 0.62, 0.3];
      const FRONT = [-1.75, -2.05, -0.15, 0.6, 0.62, 0.35];
      for (const [sname, facing] of named('attack_')) {
        const prof = facing === 'side', ang = prof ? PROF : FRONT, r = prof ? 10 : 9, fr = [];
        for (let i = 0; i < 6; i++) {
          fr.push(Fr(dur[i], squatPaint(pal, gear, facing, {
            armDy: arm[i], angle: ang[i], kb: step[i],
            // A smear is the last moment of travel, not the whole swing: a
            // 1.15rad tail keeps the band off the head it just passed.
            arc: i === 2 || i === 3 ? [ang[i] - 1.15, ang[i], r] : (i === 4 ? [ang[i] - 0.7, ang[i], r - 1] : null),
            impact: i === 3 ? [3, 2, 0.2] : null,
            behind: i >= 4, eye: 'open'
          })));
        }
        states.push(D(sname, 10, true, fr));
      }
    }
    if (gear.shield) {
      const fr = [], bobs = [0, -1, 0, -1];
      for (let i = 0; i < 4; i++) fr.push(Fr(ms(8), squatPaint(pal, gear, 'down', { bob: bobs[i], armDy: -2, block: true, tool: 'shield', eye: 'open' })));
      states.push(D('block', 8, true, fr));
      /* Shield bash: coil back two frames, then throw the shield forward with
         the impact on the strike. A shield unit that can only block reads as
         it has no answer to anything. */
      const bkb = [-1, -2, 3, 2, 0], bbob = [0, -1, 0, -1, 0], bdur = [150, 110, 50, 120, 170];
      for (const [sname, facing] of named('bash_')) {
        const bf = [];
        for (let i = 0; i < 5; i++) bf.push(Fr(bdur[i], squatPaint(pal, gear, facing, {
          kb: bkb[i], bob: bbob[i], armDy: -2, block: true, tool: 'shield',
          impact: i === 2 ? [4, 2, 0.2] : null, dust: i === 2 ? 0.3 : i === 3 ? 0.75 : 0, dustSeed: 70 + i, eye: 'open'
        })));
        states.push(D(sname, 10, true, bf));
      }
    }
    if (gear.cast) {
      const fr = [];
      for (let i = 0; i < 4; i++) fr.push(Fr(ms(7), squatPaint(pal, gear, 'down', { armDy: -2, staffUp: true, eye: i === 3 ? 'closed' : 'open', castGlow: [16, 8 - (i === 2 ? 1 : 0), i / 4] })));
      states.push(D('cast', 7, true, fr));
      const sf = [];
      for (let i = 0; i < 4; i++) sf.push(Fr(ms(7), squatPaint(pal, gear, 'side', { armDy: -2, staffUp: true, eye: i === 3 ? 'closed' : 'open', castGlow: [25, 9 - (i === 2 ? 1 : 0), i / 4] })));
      states.push(D('cast_side', 7, true, sf));
    }
    /* Combat-ready: weapon out, weight forward. Mana Seed ships this as its own
       page because a unit that only has idle and attack looks switched off
       between swings. Two channels, not one — a lone bob repeats itself on the
       half-cycle and hitches the loop. */
    const rdur = [220, 200, 220, 260], rbob = [0, -1, -1, 0], rarm = [-2, -2, -3, -3];
    for (const [sname, facing] of named('ready_')) {
      const fr = [];
      for (let i = 0; i < 4; i++) fr.push(Fr(rdur[i], squatPaint(pal, gear, facing, {
        bob: rbob[i] + sneak, armDy: rarm[i], angle: gear.weapon === 'bow' ? undefined : 1.05,
        eye: 'open', tool: holdsShield(facing) ? 'shield' : 'none'
      })));
      states.push(D(sname, 5, true, fr));
    }
    /* Parry: blade snapped vertical across the body, held long, then let go. */
    const pang = [-1.5, -1.35, -0.9], pkb = [1, 0, -1], pdur = [70, 190, 140];
    for (const [sname, facing] of named('parry_')) {
      const fr = [], pr = facing === 'side' ? 10 : 9;
      for (let i = 0; i < 3; i++) fr.push(Fr(pdur[i], squatPaint(pal, gear, facing, {
        armDy: -3, angle: pang[i], kb: pkb[i], arc: i === 0 ? [pang[i] - 0.9, pang[i], pr] : null, eye: 'open'
      })));
      states.push(D(sname, 10, true, fr));
    }
    /* Evade: a hop back that pushes off the ground it leaves and lands heavy. */
    const ekb = [0, -2, -4, -2, 0], ebob = [0, -2, -1, 0, -1], edur = [70, 110, 110, 90, 150];
    for (const [sname, facing] of named('evade_')) {
      const fr = [];
      for (let i = 0; i < 5; i++) fr.push(Fr(edur[i], squatPaint(pal, gear, facing, {
        kb: ekb[i], bob: ebob[i], armDy: i < 3 ? -2 : -1,
        legL: { dx: 0, dy: i === 1 ? -2 : 0 }, legR: { dx: 0, dy: i === 2 ? -1 : 0 },
        dust: i === 0 ? 0.35 : i === 3 ? 0.5 : 0, dustSeed: 90 + i, eye: 'open'
      })));
      states.push(D(sname, 10, true, fr));
    }
    states.push(D('hurt', 7, true, [
      Fr(60, squatPaint(pal, gear, 'side', { kb: 3, eye: 'hurt', flash: true, impact: [-2, -4, 0.15] })),
      Fr(90, squatPaint(pal, gear, 'side', { kb: 1, bob: -1, eye: 'hurt' })),
      Fr(150, squatPaint(pal, gear, 'side', { kb: 0, eye: 'hurt' }))
    ]));
    const fall = squatFallen(pal, gear);
    states.push(D('death', 6, false, [
      Fr(70, squatPaint(pal, gear, 'side', { kb: 3, eye: 'dead', impact: [-2, -4, 0.2] })),
      Fr(130, squatPaint(pal, gear, 'side', { kb: 1, headDy: 1, eye: 'dead', dust: 0.4, dustSeed: 5 })),
      Fr(150, fall(0)), Fr(170, fall(0.45)), Fr(220, fall(0.8))
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
