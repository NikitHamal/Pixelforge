/* PixelForge Studio — Humanoid character rig + full animation suites.
   Chibi 32×32 heroes (male / female), villagers, skeleton, orc, merchant.
   Maths: sine walk cycles, easeOut attack sweeps, dither fades, squash bob.
   Every frame ends with a 1px outline pass for a crisp pro look. */
window.PF = window.PF || {};
PF.Chars = (() => {
  const P = () => PF.Pixel, C = h => PF.Color.hexToU32(h);
  const OUTLINE = '#181425';

  const MALE = { skin: '#e8b796', skinSh: '#c28569', hair: '#3e2731', hairSh: '#262b44', hairHi: '#5e3b4d',
    shirt: '#0099db', shirtSh: '#124e89', shirtHi: '#2ce8f5', pants: '#3a4466', pantsSh: '#262b44',
    boots: '#262b44', belt: '#733e39', buckle: '#fee761', outline: OUTLINE, blush: null, lip: '#a22633' };
  const FEMALE = { skin: '#f2c094', skinSh: '#c28569', hair: '#a22633', hairSh: '#733e39', hairHi: '#f6757a',
    shirt: '#b55088', shirtSh: '#68386c', shirtHi: '#f6757a', pants: '#3a4466', pantsSh: '#262b44',
    boots: '#3e2731', belt: '#3e2731', buckle: '#fee761', outline: OUTLINE, blush: '#f6757a', lip: '#a22633', tie: '#fee761' };
  const VILLAGER_M = { ...MALE, shirt: '#3e8948', shirtSh: '#265c42', shirtHi: '#63c74d', hair: '#733e39', hairSh: '#3e2731', pants: '#5a6988' };
  const VILLAGER_F = { ...FEMALE, shirt: '#3e8948', shirtSh: '#265c42', shirtHi: '#63c74d', hair: '#733e39', hairSh: '#3e2731' };
  const SKELETON = { skin: '#ead4aa', skinSh: '#c8b28a', hair: null, shirt: '#8b9bb4', shirtSh: '#5a6988', shirtHi: '#c0cbdc',
    pants: '#5a6988', pantsSh: '#3a4466', boots: '#3a4466', belt: '#3a4466', buckle: '#8b9bb4', outline: OUTLINE, bone: '#ead4aa', eye: '#ff0044' };
  const ORC = { skin: '#63c74d', skinSh: '#3e8948', hair: '#262b44', hairSh: '#181425', hairHi: '#3a4466',
    shirt: '#733e39', shirtSh: '#3e2731', shirtHi: '#b86f50', pants: '#3a4466', pantsSh: '#262b44',
    boots: '#181425', belt: '#262b44', buckle: '#c0cbdc', outline: OUTLINE, tusk: '#ffffff' };
  const MERCHANT = { skin: '#e4a672', skinSh: '#b86f50', hair: '#ead4aa', hairSh: '#c8b28a', hairHi: '#ffffff',
    shirt: '#68386c', shirtSh: '#3e2731', shirtHi: '#b55088', pants: '#3e2731', pantsSh: '#262b44',
    boots: '#262b44', belt: '#feae34', buckle: '#fee761', outline: OUTLINE, hat: '#3e2731', hatBand: '#feae34' };
  const WIZARD = { skin: '#ead4aa', skinSh: '#c8b28a', hair: '#ffffff', hairSh: '#c0cbdc', hairHi: '#ffffff',
    shirt: '#4326d6', shirtSh: '#27178a', shirtHi: '#7b61ff', pants: '#27178a', pantsSh: '#180e54',
    boots: '#181425', belt: '#feae34', buckle: '#fee761', outline: OUTLINE, hat: '#4326d6', hatBand: '#fee761',
    beard: '#ffffff', beardSh: '#c0cbdc' };

  const SWORD_PAL = { blade: '#c0cbdc', shine: '#ffffff', guard: '#feae34', grip: '#733e39' };
  const PICK_PAL = { handle: '#b86f50', head: '#8b9bb4', shine: '#c0cbdc' };
  const AXE_PAL = { handle: '#b86f50', head: '#c0cbdc', shine: '#ffffff' };
  const BOW_PAL = { limb: '#b86f50', string: '#ead4aa', arrow: '#c28569', tip: '#8b9bb4', fletch: '#e43b44' };

  /* ================= RIG ================= */
  function drawHumanoid(api, buf, W, H, cfg) {
    const pal = cfg.pal, bob = cfg.bob || 0;
    if (cfg.lying) { drawLying(api, buf, W, H, cfg); return finish(buf, W, H, pal); }
    P().shadowFlat(api, 16 + (cfg.kb || 0), 29, 7);
    const kb = cfg.kb || 0; // knockback x offset
    if ((cfg.facing || 'down') === 'side') drawSide(api, buf, W, H, { ...cfg, kb, bob });
    else drawFrontBack(api, buf, W, H, { ...cfg, kb, bob });
    drawTool(api, buf, W, H, cfg);
    if (cfg.flash) P().flashWhite(api, W, H, buf);
    finish(buf, W, H, pal);
  }
  function finish(buf, W, H, pal) {
    buf.set(PF.Raster.outline(buf, W, H, C(pal.outline || OUTLINE)));
  }

  /* Front (down) + Back (up) */
  function drawFrontBack(api, buf, W, H, cfg) {
    const pal = cfg.pal, back = (cfg.facing === 'up'), bob = cfg.bob || 0, kb = cfg.kb || 0;
    const Y = y => y + bob;
    const lA = cfg.legA || { dx: 0, dy: 0 }, lB = cfg.legB || { dx: 0, dy: 0 };
    const aL = cfg.armL || { dx: 0, dy: 0 }, aR = cfg.armR || { dx: 0, dy: 0 };
    // legs (pants + boots)
    leg(12 + kb + lA.dx, Y(22 + lA.dy), pal); leg(17 + kb + lB.dx, Y(22 + lB.dy), pal);
    function leg(x, y, pal) {
      api.rect(x, y, x + 2, y + 4, pal.pants);
      api.rect(x + 2, y, x + 2, y + 4, pal.pantsSh);
      api.rect(x, y + 4, x + 2, y + 5, pal.boots);
      api.px(x, y + 4, pal.pantsSh);
    }
    // torso
    const tx = 10 + kb, ty = Y(14);
    api.rect(tx, ty, tx + 11, ty + 7, pal.shirt);
    api.rect(tx + 10, ty, tx + 11, ty + 7, pal.shirtSh);
    api.rect(tx, ty, tx + 1, ty + 7, pal.shirtHi);
    // belt
    api.rect(tx, ty + 5, tx + 11, ty + 6, pal.belt);
    api.rect(tx + 5, ty + 5, tx + 6, ty + 6, pal.buckle);
    // chest detail: buttons / ribs
    if (pal === SKELETON) {
      api.line(tx + 2, ty + 1, tx + 9, ty + 1, pal.shirtSh, 1);
      api.line(tx + 2, ty + 3, tx + 9, ty + 3, pal.shirtSh, 1);
      api.px(tx + 5, ty + 2, pal.bone); api.px(tx + 6, ty + 2, pal.bone);
    } else {
      api.px(tx + 5, ty + 2, pal.shirtSh); api.px(tx + 6, ty + 2, pal.shirtSh);
    }
    // orc shoulder pads
    if (pal === ORC) { api.rect(tx - 1, ty - 1, tx + 2, ty + 1, pal.pantsSh); api.rect(tx + 9, ty - 1, tx + 12, ty + 1, pal.pantsSh); }
    // merchant hat brim behind head? drawn with head
    // arms
    arm(7 + kb + aL.dx, Y(14 + aL.dy), true, pal); arm(22 + kb + aR.dx, Y(14 + aR.dy), false, pal);
    function arm(x, y, left, pal) {
      api.rect(x, y, x + 2, y + 2, pal.shirt);
      api.rect(x, y + 3, x + 2, y + 6, pal.skin);
      api.rect(x + (left ? 2 : 0), y + 3, x + (left ? 2 : 0), y + 6, pal.skinSh);
      api.rect(x, y + 2, x + 2, y + 3, pal.shirtSh);
    }
    // head
    if (back) drawHeadBack(api, tx, Y(4), pal, cfg);
    else drawHeadFront(api, tx, Y(4), pal, cfg);
  }
  function drawHeadFront(api, tx, hy, pal, cfg) {
    // tx = torso left (10+kb); head x = tx..tx+11
    const hx = tx;
    api.rect(hx, hy, hx + 11, hy + 9, pal.skin);
    api.rect(hx + 10, hy, hx + 11, hy + 9, pal.skinSh);
    api.rect(hx, hy + 8, hx + 11, hy + 9, pal.skinSh);
    // ears
    api.rect(hx - 1, hy + 5, hx - 1, hy + 6, pal.skin);
    api.rect(hx + 12, hy + 5, hx + 12, hy + 6, pal.skin);
    if (pal === SKELETON) {
      // skull: big dark eyes + teeth
      api.rect(hx + 2, hy + 4, hx + 4, hy + 6, '#181425');
      api.rect(hx + 7, hy + 4, hx + 9, hy + 6, '#181425');
      api.px(hx + 3, hy + 5, pal.eye); api.px(hx + 8, hy + 5, pal.eye);
      api.line(hx + 4, hy + 8, hx + 7, hy + 8, '#181425', 1);
      api.px(hx + 5, hy + 8, pal.bone);
      return;
    }
    if (pal === ORC) {
      // heavy brow + tusks
      api.rect(hx, hy, hx + 11, hy + 3, pal.hair);
      const eye = cfg.eye || 'open';
      if (eye === 'open') { api.rect(hx + 2, hy + 5, hx + 4, hy + 6, '#181425'); api.rect(hx + 7, hy + 5, hx + 9, hy + 6, '#181425'); api.px(hx + 3, hy + 5, '#ff0044'); api.px(hx + 8, hy + 5, '#ff0044'); }
      else if (eye === 'closed') { api.line(hx + 2, hy + 6, hx + 4, hy + 6, '#181425', 1); api.line(hx + 7, hy + 6, hx + 9, hy + 6, '#181425', 1); }
      else { api.line(hx + 2, hy + 4, hx + 4, hy + 7, '#181425', 1); api.line(hx + 2, hy + 7, hx + 4, hy + 4, '#181425', 1); api.line(hx + 7, hy + 4, hx + 9, hy + 7, '#181425', 1); api.line(hx + 7, hy + 7, hx + 9, hy + 4, '#181425', 1); }
      // tusks
      api.px(hx + 3, hy + 8, pal.tusk); api.px(hx + 8, hy + 8, pal.tusk);
      api.line(hx + 4, hy + 8, hx + 7, hy + 8, '#3e2731', 1);
      return;
    }
    // hair
    drawHairFront(api, hx, hy, pal, cfg);
    // eyes
    const eye = cfg.eye || 'open';
    const ey = hy + 5;
    if (eye === 'open') {
      api.rect(hx + 3, ey, hx + 4, ey + 2, '#181425');
      api.rect(hx + 7, ey, hx + 8, ey + 2, '#181425');
      api.px(hx + 3, ey, '#ffffff'); api.px(hx + 7, ey, '#ffffff');
      if (pal.blush) { api.px(hx + 2, ey + 2, pal.blush); api.px(hx + 9, ey + 2, pal.blush); }
    } else if (eye === 'closed') {
      api.line(hx + 3, ey + 1, hx + 4, ey + 1, '#181425', 1);
      api.line(hx + 7, ey + 1, hx + 8, ey + 1, '#181425', 1);
    } else if (eye === 'hurt') {
      api.line(hx + 3, ey, hx + 4, ey + 2, '#181425', 1); api.line(hx + 3, ey + 2, hx + 4, ey, '#181425', 1);
      api.line(hx + 7, ey, hx + 8, ey + 2, '#181425', 1); api.line(hx + 7, ey + 2, hx + 8, ey, '#181425', 1);
    } else if (eye === 'dead') {
      api.px(hx + 3, ey, '#181425'); api.px(hx + 4, ey + 1, '#181425'); api.px(hx + 3, ey + 2, '#181425');
      api.px(hx + 8, ey, '#181425'); api.px(hx + 7, ey + 1, '#181425'); api.px(hx + 8, ey + 2, '#181425');
    }
    // mouth
    const mouth = cfg.mouth || 'closed', my = hy + 8;
    if (mouth === 'open') api.rect(hx + 5, my - 1, hx + 6, my, '#5c1a1a');
    else if (mouth === 'sad') { api.px(hx + 5, my, pal.lip); api.px(hx + 6, my, pal.lip); api.px(hx + 4, my - 1, pal.lip); api.px(hx + 7, my - 1, pal.lip); }
    else api.line(hx + 5, my, hx + 6, my, pal.lip || '#a26a5a', 1);
  }
  function drawHairFront(api, hx, hy, pal, cfg) {
    if (!pal.hair) return;
    const female = (pal === FEMALE || pal === VILLAGER_F);
    api.rect(hx - 1, hy - 2, hx + 12, hy + 1, pal.hair);
    api.rect(hx - 1, hy + 2, hx, hy + 5, pal.hair);
    api.rect(hx + 11, hy + 2, hx + 12, hy + 5, pal.hair);
    // fringe
    api.px(hx + 2, hy + 2, pal.hair); api.px(hx + 5, hy + 2, pal.hair); api.px(hx + 8, hy + 2, pal.hair);
    // shine + shade
    api.rect(hx + 1, hy - 2, hx + 3, hy - 1, pal.hairHi);
    api.rect(hx + 11, hy - 2, hx + 12, hy + 3, pal.hairSh);
    if (female) {
      // long sides down to shoulders
      api.rect(hx - 2, hy + 2, hx - 1, hy + 12, pal.hair);
      api.rect(hx + 12, hy + 2, hx + 13, hy + 12, pal.hair);
      api.rect(hx - 2, hy + 10, hx - 1, hy + 12, pal.hairSh);
      api.rect(hx + 12, hy + 10, hx + 13, hy + 12, pal.hairSh);
      api.rect(hx + 4, hy - 3, hx + 7, hy - 2, pal.tie); // bow tie top
    }
    if (pal === MERCHANT) {
      // wide-brim hat
      api.rect(hx - 3, hy - 1, hx + 14, hy + 1, pal.hat);
      api.rect(hx + 1, hy - 5, hx + 10, hy - 1, pal.hat);
      api.rect(hx + 1, hy - 2, hx + 10, hy - 1, pal.hatBand);
    }
    if (pal === WIZARD) {
      api.rect(hx - 3, hy - 1, hx + 14, hy + 1, pal.hat);
      api.rect(hx, hy - 4, hx + 11, hy - 1, pal.hat);
      api.rect(hx + 1, hy - 2, hx + 10, hy - 1, pal.hatBand);
      api.rect(hx + 2, hy - 7, hx + 9, hy - 4, pal.hat);
      api.rect(hx + 4, hy - 10, hx + 7, hy - 7, pal.hat);
      api.px(hx + 5, hy - 11, pal.hat);
      api.rect(hx + 4, hy + 8, hx + 7, hy + 12, pal.beard);
      api.rect(hx + 5, hy + 11, hx + 6, hy + 13, pal.beard);
    }
  }
  function drawHeadBack(api, tx, hy, pal, cfg) {
    const hx = tx;
    if (pal === SKELETON) {
      api.rect(hx, hy, hx + 11, hy + 9, pal.bone);
      api.rect(hx + 10, hy, hx + 11, hy + 9, pal.skinSh);
      api.line(hx + 2, hy + 3, hx + 9, hy + 3, pal.shirtSh, 1);
      api.line(hx + 2, hy + 5, hx + 9, hy + 5, pal.shirtSh, 1);
      return;
    }
    api.rect(hx, hy, hx + 11, hy + 9, pal.hair || pal.skin);
    if (pal.hair) {
      api.rect(hx + 1, hy, hx + 4, hy + 2, pal.hairHi);
      api.rect(hx + 9, hy + 2, hx + 11, hy + 9, pal.hairSh);
      api.line(hx + 2, hy + 4, hx + 2, hy + 8, pal.hairSh, 1);
      api.line(hx + 9, hy + 4, hx + 9, hy + 8, pal.hairSh, 1);
      const female = (pal === FEMALE || pal === VILLAGER_F);
      if (female) { api.rect(hx - 1, hy + 4, hx, hy + 12, pal.hair); api.rect(hx + 11, hy + 4, hx + 12, hy + 12, pal.hair); }
    }
    if (pal === MERCHANT) { api.rect(hx - 3, hy + 1, hx + 14, hy + 3, pal.hat); }
    if (pal === WIZARD) {
      api.rect(hx - 3, hy + 1, hx + 14, hy + 3, pal.hat);
      api.rect(hx, hy - 4, hx + 11, hy + 1, pal.hat);
      api.rect(hx + 2, hy - 7, hx + 9, hy - 4, pal.hat);
      api.rect(hx + 4, hy - 10, hx + 7, hy - 7, pal.hat);
      api.px(hx + 5, hy - 11, pal.hat);
    }
    // backpack
    if (cfg.pack !== false && pal !== SKELETON) {
      api.rect(hx + 3, hy + 11, hx + 8, hy + 16, '#b86f50');
      api.rect(hx + 3, hy + 11, hx + 8, hy + 12, '#733e39');
      api.rect(hx + 3, hy + 16, hx + 8, hy + 17, '#733e39');
    }
  }

  /* Side view (right-facing). Use buf flip for left. */
  function drawSide(api, buf, W, H, cfg) {
    const pal = cfg.pal, bob = cfg.bob || 0, kb = cfg.kb || 0;
    const Y = y => y + bob;
    const lF = cfg.legF || { dx: 0, dy: 0 }, lB = cfg.legB || { dx: 0, dy: 0 };
    const aF = cfg.armF || { dx: 0, dy: 0 }, aB = cfg.armB || { dx: 0, dy: 0 };

    // 1. Back arm (drawn BEHIND body) — with shirt sleeve!
    const bdx = Math.max(-2, Math.min(2, aB.dx || 0)), bdy = aB.dy || 0;
    const bx = 11 + kb + bdx, by = Y(14 + bdy);
    api.rect(bx, by, bx + 2, by + 3, pal.shirtSh);
    api.rect(bx, by + 4, bx + 1, by + 5, pal.skinSh);

    // 2. Back leg (darker pants & boot)
    api.rect(12 + kb + lB.dx, Y(22 + lB.dy), 14 + kb + lB.dx, Y(27 + lB.dy), pal.pantsSh);
    api.rect(12 + kb + lB.dx, Y(26 + lB.dy), 14 + kb + lB.dx, Y(27 + lB.dy), pal.boots);

    // 3. Torso (drawn cleanly over back arm & leg)
    const tx = 12 + kb, ty = Y(14);
    api.rect(tx, ty, tx + 7, ty + 7, pal.shirt);
    api.rect(tx, ty, tx + 1, ty + 7, pal.shirtSh);
    api.rect(tx + 6, ty, tx + 7, ty + 7, pal.shirtHi);
    api.rect(tx, ty + 5, tx + 7, ty + 6, pal.belt);
    api.rect(tx + 3, ty + 5, tx + 4, ty + 6, pal.buckle);
    if (pal === SKELETON) {
      api.line(tx + 1, ty + 1, tx + 6, ty + 1, pal.shirtSh, 1);
      api.line(tx + 1, ty + 3, tx + 6, ty + 3, pal.shirtSh, 1);
    }
    if (pal === ORC) api.rect(tx - 1, ty - 1, tx + 3, ty + 1, pal.pantsSh);

    // 4. Front leg (in front of torso)
    api.rect(15 + kb + lF.dx, Y(22 + lF.dy), 17 + kb + lF.dx, Y(27 + lF.dy), pal.pants);
    api.rect(15 + kb + lF.dx, Y(26 + lF.dy), 17 + kb + lF.dx, Y(27 + lF.dy), pal.boots);

    // 5. Head profile (positioned at tx - 1 = 11 + kb)
    drawHeadSide(api, tx - 1, Y(4), pal, cfg);

    // 6. Front arm (attached at front shoulder tx + 4)
    const adx = Math.max(-1, Math.min(3, aF.dx || 0)), ady = aF.dy || 0;
    const fx = tx + 4 + kb, fy = Y(14);
    // Shoulder & sleeve (shirt color)
    api.rect(fx, fy + ady, fx + 2, fy + ady + 3, pal.shirt);
    api.rect(fx + 1, fy + ady, fx + 2, fy + ady + 3, pal.shirtHi);
    // Forearm & hand (skin)
    const hx = fx + 1 + adx, hy = fy + ady + 4;
    api.rect(hx, hy, hx + 1, hy + 2, pal.skin);
    api.px(hx + 1, hy, pal.skinSh);
  }

  function drawHeadSide(api, hx, hy, pal, cfg) {
    // hx ≈ 11. Head spans hx+1 to hx+9 (9px wide), hy to hy+8 (9px tall). No snout/peg!
    api.rect(hx + 1, hy, hx + 9, hy + 8, pal.skin);
    api.rect(hx + 7, hy + 2, hx + 9, hy + 8, pal.skinSh);
    // ear
    api.rect(hx + 2, hy + 4, hx + 3, hy + 5, pal.skinSh);

    if (pal === SKELETON) {
      api.rect(hx + 5, hy + 3, hx + 8, hy + 5, '#181425');
      api.px(hx + 6, hy + 4, pal.eye);
      api.line(hx + 6, hy + 7, hx + 9, hy + 7, '#181425', 1);
      return;
    }

    // hair
    if (pal.hair) {
      api.rect(hx, hy - 2, hx + 8, hy + 1, pal.hair);
      api.rect(hx, hy + 2, hx + 3, hy + 8, pal.hair);
      api.rect(hx + 1, hy - 2, hx + 4, hy - 1, pal.hairHi);
      // front fringe / bangs
      api.rect(hx + 6, hy - 1, hx + 8, hy + 2, pal.hair);
      api.px(hx + 8, hy + 3, pal.hair);

      const female = (pal === FEMALE || pal === VILLAGER_F);
      if (female) {
        api.rect(hx - 2, hy + 1, hx, hy + 11, pal.hair);
        api.rect(hx - 2, hy + 8, hx, hy + 11, pal.hairSh);
        api.rect(hx + 2, hy - 3, hx + 5, hy - 2, pal.tie);
      }
      if (pal === MERCHANT) api.rect(hx - 2, hy - 1, hx + 11, hy + 1, pal.hat);
      if (pal === WIZARD) {
        api.rect(hx - 3, hy - 1, hx + 13, hy + 1, pal.hat);
        api.rect(hx, hy - 4, hx + 9, hy - 1, pal.hat);
        api.rect(hx + 1, hy - 2, hx + 9, hy - 1, pal.hatBand);
        api.rect(hx + 2, hy - 7, hx + 7, hy - 4, pal.hat);
        api.rect(hx + 3, hy - 10, hx + 5, hy - 7, pal.hat);
        api.px(hx + 4, hy - 11, pal.hat);
        api.rect(hx + 5, hy + 7, hx + 9, hy + 11, pal.beard);
        api.rect(hx + 6, hy + 9, hx + 8, hy + 12, pal.beard);
        api.px(hx + 7, hy + 13, pal.beard);
      }
    }
    if (pal === ORC) {
      api.rect(hx, hy - 2, hx + 8, hy + 1, pal.hair);
      api.px(hx + 8, hy + 7, pal.tusk);
    }
    // eye (placed at hx + 6..7, hy + 4..5)
    const eye = cfg.eye || 'open', ex = hx + 6, ey = hy + 4;
    if (eye === 'open') {
      api.rect(ex, ey, ex + 1, ey + 2, '#181425');
      api.px(ex, ey, '#ffffff');
    } else if (eye === 'closed') {
      api.line(ex, ey + 1, ex + 1, ey + 1, '#181425', 1);
    } else {
      api.line(ex, ey, ex + 1, ey + 2, '#181425', 1);
      api.line(ex, ey + 2, ex + 1, ey, '#181425', 1);
    }
    if (pal.blush) api.px(ex - 1, ey + 2, pal.blush);
    // mouth (placed at hx + 8, hy + 7 — front of face below eye!)
    const mouth = cfg.mouth || 'closed', mx = hx + 8, my = hy + 7;
    if (mouth === 'open') api.rect(mx - 1, my - 1, mx, my, '#5c1a1a');
    else if (mouth === 'sad') { api.px(mx, my, pal.lip || '#a26a5a'); api.px(mx - 1, my + 1, pal.lip || '#a26a5a'); }
    else api.px(mx, my, pal.lip || '#a26a5a');
  }

  /* Tools overlay (uses hand positions approx) */
  function drawTool(api, buf, W, H, cfg) {
    const t = cfg.tool; if (!t) return;
    const P = PF.Pixel;
    if (cfg.facing === 'side') {
      const hx = 18 + (cfg.kb || 0) + ((cfg.armF || {}).dx || 0), hy = 19 + (cfg.bob || 0) + ((cfg.armF || {}).dy || 0);
      if (t.kind === 'sword') P.sword(api, hx, hy, t.angle, SWORD_PAL);
      else if (t.kind === 'shield') P.shield(api, hx + 1, hy - 1, '#b86f50', '#8b9bb4');
      else if (t.kind === 'pickaxe') P.pickaxe(api, hx, hy, t.angle, PICK_PAL);
      else if (t.kind === 'axe') P.axe(api, hx, hy, t.angle, AXE_PAL);
      else if (t.kind === 'bow') P.bow(api, hx + 4, hy - 2, t.pull || 0, BOW_PAL, t.arrow === false ? 0 : 1);
      else if (t.kind === 'food') { api.rect(hx - 1, hy - 4, hx + 1, hy - 2, '#e43b44'); api.px(hx, hy - 5, '#63c74d'); }
      else if (t.kind === 'staff') { api.line(hx, hy - 10, hx, hy + 4, '#b86f50', 2); api.rect(hx - 1, hy - 12, hx + 1, hy - 10, '#2ce8f5'); api.px(hx, hy - 11, '#ffffff'); }
      else if (t.kind === 'box') { api.rect(hx - 2, hy - 1, hx + 2, hy + 3, '#b86f50'); api.rect(hx - 2, hy - 1, hx + 2, hy, '#733e39'); }
      if (t.slash) P.slash(api, hx + 2, hy - 4, 9, t.slash[0], t.slash[1], '#ffffff', 2);
      if (t.sparks) P.sparks(api, t.sparks[0], t.sparks[1], t.seed || 0, '#fee761');
      if (t.dust) dust(api, t.dust);
    } else {
      // front view: sword on right side
      const hx = 23 + (cfg.kb || 0) + ((cfg.armR || {}).dx || 0), hy = 19 + (cfg.bob || 0) + ((cfg.armR || {}).dy || 0);
      const hlx = 9 + (cfg.kb || 0) + ((cfg.armL || {}).dx || 0), hly = 19 + (cfg.bob || 0) + ((cfg.armL || {}).dy || 0);
      if (t.kind === 'sword') P.sword(api, hx, hy, t.angle, SWORD_PAL);
      else if (t.kind === 'pickaxe') P.pickaxe(api, hx, hy, t.angle, PICK_PAL);
      else if (t.kind === 'axe') P.axe(api, hx, hy, t.angle, AXE_PAL);
      else if (t.kind === 'food') { const f = t.at || [hx - 2, hy - 4]; api.rect(f[0] - 1, f[1] - 1, f[0] + 1, f[1] + 1, '#e43b44'); api.px(f[0], f[1] - 2, '#63c74d'); api.px(f[0] - 1, f[1] - 1, '#f6757a'); }
      else if (t.kind === 'box') { api.rect(hlx - 1, hly, hx + 1, hly + 4, '#b86f50'); api.rect(hlx - 1, hly, hx + 1, hly + 1, '#733e39'); }
      else if (t.kind === 'staff') { api.line(hlx, hly - 10, hlx, hly + 4, '#b86f50', 2); api.rect(hlx - 1, hly - 12, hlx + 1, hly - 10, '#b55088'); }
      // head-on bow: lets archers attack on the down/up facings too. Held out
      // to the side of the torso so the limbs never sink into the tunic.
      else if (t.kind === 'bow') P.bowFront(api, hlx - 3, hly - 1, t.pull || 0, cfg.facing === 'up' ? -1 : 1, BOW_PAL, t.arrow === false ? 0 : 1);
      if (t.slash) P.slash(api, 16 + (cfg.kb || 0), 16 + (cfg.bob || 0), 11, t.slash[0], t.slash[1], '#ffffff', 2);
      if (t.sparks) P.sparks(api, t.sparks[0], t.sparks[1], t.seed || 0, '#fee761');
      if (t.dust) dust(api, t.dust);
      if (t.glow) P.particles(api, 16 + (cfg.kb || 0), 12 + (cfg.bob || 0), 8, t.glow, ['#fee761', '#ffffff', '#2ce8f5']);
    }
  }
  function dust(api, pts) {
    pts.forEach(([x, y, c]) => api.px(x, y, c || '#c0cbdc'));
  }

  /* Lying pose for sleep / death */
  function drawLying(api, buf, W, H, cfg) {
    const pal = cfg.pal, dead = cfg.eye === 'dead';
    P().shadowFlat(api, 16, 29, 9);
    const y = 21;
    // head (left)
    api.rect(3, y, 10, y + 7, dead && pal.skin ? '#c0cbdc' : pal.skin);
    if (pal === SKELETON) { api.rect(5, y + 2, 7, y + 4, '#181425'); }
    else if (cfg.eye === 'closed' || cfg.sleep) { api.line(5, y + 4, 7, y + 4, '#181425', 1); }
    else if (dead) { api.px(5, y + 3, '#181425'); api.px(6, y + 4, '#181425'); api.px(5, y + 5, '#181425'); }
    else { api.rect(5, y + 3, 6, y + 5, '#181425'); }
    if (pal.hair && pal !== SKELETON) { api.rect(2, y - 2, 9, y + 1, pal.hair); api.rect(2, y + 2, 3, y + 7, pal.hair); }
    // torso
    api.rect(11, y + 1, 20, y + 6, cfg.sleep && cfg.blanket ? cfg.blanket : pal.shirt);
    api.rect(11, y + 5, 20, y + 6, pal.shirtSh);
    // legs
    api.rect(21, y + 1, 27, y + 3, pal.pants);
    api.rect(21, y + 4, 27, y + 6, pal.pants);
    api.rect(27, y + 1, 29, y + 6, pal.boots);
    // arms folded
    api.rect(12, y - 1, 16, y, pal.skin);
    // blanket over legs when sleeping
    if (cfg.sleep && cfg.blanket) { api.rect(18, y, 26, y + 7, cfg.blanket); api.rect(18, y, 26, y + 1, '#ffffff'); }
    // Zzz
    if (cfg.sleep && cfg.z !== undefined) {
      const zx = 24 - (cfg.z % 3) * 0, zy = 12 - Math.floor(cfg.z / 1) % 4;
      api.px(zx, zy, '#ffffff'); api.px(zx + 1, zy, '#ffffff'); api.px(zx + 1, zy + 1, '#ffffff'); api.px(zx, zy + 2, '#ffffff'); api.px(zx + 1, zy + 2, '#ffffff');
    }
    // dither fade for final death frame
    if (cfg.dither) {
      for (let y0 = 0; y0 < H; y0++) for (let x0 = 0; x0 < W; x0++) {
        if ((x0 + y0) % 2 === 0 && buf[y0 * W + x0]) buf[y0 * W + x0] = 0;
      }
    }
    if (cfg.flash) P().flashWhite(api, W, H, buf);
    finish(buf, W, H, pal);
  }

  /* ================= SUITE BUILDERS ================= */
  const D = (name, fps, loop, frames) => ({ name, fps, loop, frames });
  const Fr = (duration, paint) => ({ duration, paint });
  const ms = fps => Math.round(1000 / fps);

  function frontPose(i, n, amp, pal, facing, extra = {}) {
    // walk/idle leg/arm offsets from sine phase
    const p = i / n, s = Math.sin(p * Math.PI * 2);
    const bob = extra.bob !== undefined ? extra.bob : Math.round(-Math.abs(s) * amp);
    return { pal, facing, bob,
      legA: { dx: 0, dy: Math.round(s * amp) }, legB: { dx: 0, dy: Math.round(-s * amp) },
      armL: { dx: 0, dy: Math.round(-s * amp) }, armR: { dx: 0, dy: Math.round(s * amp) },
      eye: extra.eye || 'open', mouth: extra.mouth || 'closed', ...extra };
  }
  function sidePose(i, n, amp, pal, extra = {}) {
    const p = i / n, s = Math.sin(p * Math.PI * 2);
    const bob = extra.bob !== undefined ? extra.bob : Math.round(-Math.abs(s) * amp);
    return { pal, facing: 'side', bob,
      legF: { dx: Math.round(s * amp), dy: Math.round(-Math.max(0, s) * amp) },
      legB: { dx: Math.round(-s * amp), dy: Math.round(-Math.max(0, -s) * amp) },
      armF: { dx: Math.round(-s * amp * 0.8), dy: Math.round(Math.abs(s) * -0.5) },
      armB: { dx: Math.round(s * amp * 0.8), dy: 0 },
      eye: extra.eye || 'open', mouth: extra.mouth || 'closed', ...extra };
  }
  const paintHero = cfg => (buf, W, H) => {
    const api = PF.Pixel.makeApi(buf, W, H);
    drawHumanoid(api, buf, W, H, cfg);
  };

  function heroSuite(pal, label) {
    const states = [];
    // idle ×3 directions
    for (const [sname, facing] of [['idle_down', 'down'], ['idle_side', 'side'], ['idle_up', 'up']]) {
      const frames = [];
      for (let i = 0; i < 4; i++) {
        const blink = i === 3, bob = -(i % 2);
        const cfg = facing === 'side'
          ? { pal, facing, bob, legF: { dx: 0, dy: 0 }, legB: { dx: 0, dy: 0 }, armF: { dx: 0, dy: 0 }, armB: { dx: 0, dy: 0 }, eye: blink ? 'closed' : 'open' }
          : { pal, facing, bob, legA: { dx: 0, dy: 0 }, legB: { dx: 0, dy: 0 }, armL: { dx: 0, dy: 0 }, armR: { dx: 0, dy: 0 }, eye: blink ? 'closed' : 'open' };
        frames.push(Fr(ms(6), paintHero(cfg)));
      }
      states.push(D(sname, 6, true, frames));
    }
    // walk ×3
    for (const [sname, facing] of [['walk_down', 'down'], ['walk_side', 'side'], ['walk_up', 'up']]) {
      const frames = [];
      for (let i = 0; i < 4; i++) {
        const cfg = facing === 'side' ? sidePose(i, 4, 2, pal) : frontPose(i, 4, 2, pal, facing);
        frames.push(Fr(ms(8), paintHero(cfg)));
      }
      states.push(D(sname, 8, true, frames));
    }
    // run (side, 6f bigger swing + dust)
    {
      const frames = [];
      for (let i = 0; i < 6; i++) {
        const cfg = sidePose(i, 6, 3, pal, { dust: i % 2 === 0 ? [[8, 28, '#c0cbdc'], [6, 27, '#8b9bb4']] : [] });
        frames.push(Fr(ms(12), paintHero(cfg)));
      }
      states.push(D('run_side', 12, true, frames));
    }
    // sword attacks: side sweep + down sweep
    {
      const frames = [];
      const angles = [-1.9, -0.9, 0.1, 0.7, 0.2];
      for (let i = 0; i < 5; i++) {
        const cfg = sidePose(i, 5, 1, pal, { bob: i === 2 ? -1 : 0, tool: { kind: 'sword', angle: angles[i], slash: i === 2 ? [-0.6, 0.9] : null } });
        cfg.armF = { dx: 2, dy: -3 + i };
        frames.push(Fr(ms(12), paintHero(cfg)));
      }
      states.push(D('attack_sword_side', 12, true, frames));
    }
    {
      const frames = [];
      const angles = [-2.4, -1.2, -0.2, 0.5, 0.1];
      for (let i = 0; i < 5; i++) {
        const cfg = frontPose(i, 5, 1, pal, 'down', { tool: { kind: 'sword', angle: angles[i], slash: i === 2 ? [0.4, 2.6] : null } });
        cfg.armR = { dx: 1, dy: -2 + Math.round(i * 0.8) };
        frames.push(Fr(ms(12), paintHero(cfg)));
      }
      states.push(D('attack_sword_down', 12, true, frames));
    }
    // bow (side, 4f draw + release)
    {
      const frames = [];
      const pulls = [0, 0.5, 1, 0];
      for (let i = 0; i < 4; i++) {
        const cfg = sidePose(0, 4, 0, pal, { bob: 0, tool: { kind: 'bow', pull: pulls[i], arrow: i !== 3 }, sparks: i === 3 ? [28, 14] : null, seed: 1 });
        cfg.armF = { dx: 2, dy: -1 };
        frames.push(Fr(ms(10), paintHero(cfg)));
      }
      states.push(D('bow_side', 10, true, frames));
    }
    // pickaxe mining (side, 5f overhead → impact + sparks)
    {
      const frames = [];
      const angles = [-2.1, -1.6, -0.6, 0.5, -1.2];
      for (let i = 0; i < 5; i++) {
        const cfg = sidePose(i, 5, 1, pal, { tool: { kind: 'pickaxe', angle: angles[i], sparks: i === 3 ? [26, 27] : null, seed: i, dust: i === 3 ? [[24, 28, '#c28569'], [28, 28, '#8b9bb4'], [26, 26, '#fee761']] : [] } });
        cfg.armF = { dx: 1, dy: i < 2 ? -4 : (i === 3 ? 1 : -1) };
        frames.push(Fr(ms(10), paintHero(cfg)));
      }
      states.push(D('mine_pickaxe', 10, true, frames));
    }
    // axe chop (front, 4f)
    {
      const frames = [];
      const angles = [-2.0, -1.0, 0.3, -0.8];
      for (let i = 0; i < 4; i++) {
        const cfg = frontPose(i, 4, 1, pal, 'down', { tool: { kind: 'axe', angle: angles[i], sparks: i === 2 ? [16, 24] : null, seed: 2 } });
        cfg.armR = { dx: 0, dy: i < 2 ? -3 : 1 };
        frames.push(Fr(ms(10), paintHero(cfg)));
      }
      states.push(D('chop_axe', 10, true, frames));
    }
    // hurt (2f: white flash + knockback)
    states.push(D('hurt', 8, true, [
      Fr(ms(8), paintHero({ pal, facing: 'down', bob: 0, kb: -2, eye: 'hurt', mouth: 'open', flash: true })),
      Fr(ms(8), paintHero({ pal, facing: 'down', bob: 0, kb: -2, eye: 'hurt', mouth: 'sad' }))
    ]));
    // death (5f, no loop)
    states.push(D('death', 8, false, [
      Fr(ms(8), paintHero({ pal, facing: 'down', kb: -2, eye: 'hurt', mouth: 'open', flash: true })),
      Fr(ms(8), paintHero({ pal, facing: 'down', bob: 3, kb: -1, eye: 'hurt', armL: { dx: -2, dy: 1 }, armR: { dx: 2, dy: 1 } })),
      Fr(ms(8), paintHero({ pal, lying: true, eye: 'hurt' })),
      Fr(ms(8), paintHero({ pal, lying: true, eye: 'dead' })),
      Fr(ms(8), paintHero({ pal, lying: true, eye: 'dead', dither: true }))
    ]));
    // sleep (4f lying + blanket + Z)
    {
      const frames = [];
      for (let i = 0; i < 4; i++) frames.push(Fr(ms(4), paintHero({ pal, lying: true, sleep: true, eye: 'closed', blanket: '#124e89', z: i, bob: 0 })));
      states.push(D('sleep', 4, true, frames));
    }
    // eat (4f hand-to-mouth)
    {
      const handPos = [[21, 15], [20, 12], [19, 11], [21, 15]];
      const frames = [];
      for (let i = 0; i < 4; i++) {
        const cfg = frontPose(0, 4, 0, pal, 'down', { bob: 0, eye: i === 2 ? 'closed' : 'open', mouth: i === 2 ? 'open' : 'closed',
          tool: { kind: 'food', at: handPos[i] }, armR: { dx: 0, dy: -4 + i } });
        frames.push(Fr(ms(6), paintHero(cfg)));
      }
      states.push(D('eat', 6, true, frames));
    }
    // sit (2f)
    states.push(D('sit', 6, true, [
      Fr(ms(6), paintHero({ pal, facing: 'down', bob: 4, legA: { dx: 0, dy: -2 }, legB: { dx: 0, dy: -2 }, armL: { dx: 0, dy: 3 }, armR: { dx: 0, dy: 3 }, eye: 'open' })),
      Fr(ms(6), paintHero({ pal, facing: 'down', bob: 4, legA: { dx: 0, dy: -2 }, legB: { dx: 0, dy: -2 }, armL: { dx: 0, dy: 3 }, armR: { dx: 0, dy: 3 }, eye: 'closed' }))
    ]));
    // pickup (3f bend + lift box)
    states.push(D('pickup', 8, true, [
      Fr(ms(8), paintHero({ pal, facing: 'down', bob: 0, eye: 'open' })),
      Fr(ms(8), paintHero({ pal, facing: 'down', bob: 4, eye: 'open', armL: { dx: 0, dy: 5 }, armR: { dx: 0, dy: 5 } })),
      Fr(ms(8), paintHero({ pal, facing: 'down', bob: 0, eye: 'open', tool: { kind: 'box' }, armL: { dx: 0, dy: -1 }, armR: { dx: 0, dy: -1 } }))
    ]));
    // cast (4f side staff + glow)
    {
      const frames = [];
      for (let i = 0; i < 4; i++) {
        const cfg = sidePose(0, 4, 0, pal, { bob: i === 2 ? -1 : 0, tool: { kind: 'staff', glow: i / 4 }, eye: i === 2 ? 'closed' : 'open' });
        cfg.armF = { dx: 1, dy: -4 };
        frames.push(Fr(ms(10), paintHero(cfg)));
      }
      states.push(D('cast', 10, true, frames));
    }
    // jump_side (4f: anticipatory crouch, spring upward, apex tuck, landing squash)
    {
      const frames = [
        Fr(ms(8), paintHero(sidePose(0, 4, 0, pal, { bob: 2, legF: { dx: 1, dy: -2 }, legB: { dx: -1, dy: -2 }, armF: { dx: -2, dy: 1 }, armB: { dx: -1, dy: 1 } }))),
        Fr(ms(8), paintHero(sidePose(1, 4, 0, pal, { bob: -4, legF: { dx: 1, dy: 1 }, legB: { dx: -2, dy: 2 }, armF: { dx: 2, dy: -3 }, armB: { dx: -1, dy: -1 } }))),
        Fr(ms(8), paintHero(sidePose(2, 4, 0, pal, { bob: -6, legF: { dx: -1, dy: -3 }, legB: { dx: 1, dy: -3 }, armF: { dx: 1, dy: -2 }, armB: { dx: 1, dy: -2 } }))),
        Fr(ms(8), paintHero(sidePose(3, 4, 0, pal, { bob: 2, legF: { dx: 2, dy: -1 }, legB: { dx: -2, dy: -1 }, armF: { dx: 0, dy: 2 }, armB: { dx: 0, dy: 2 } })))
      ];
      states.push(D('jump_side', 8, true, frames));
    }
    // dash_side (4f: low forward lunge + speed dust)
    {
      const frames = [];
      for (let i = 0; i < 4; i++) {
        const dustPts = i < 2 ? [[8, 28, '#c0cbdc'], [6, 27, '#8b9bb4'], [10, 26, '#fee761']] : [];
        const cfg = sidePose(i, 4, 4, pal, { bob: 1, dust: dustPts });
        cfg.armF = { dx: 3, dy: -1 }; cfg.armB = { dx: -3, dy: -1 };
        frames.push(Fr(ms(12), paintHero(cfg)));
      }
      states.push(D('dash_side', 12, true, frames));
    }
    // shield_block (3f: side guard + impact sparks)
    {
      const frames = [
        Fr(ms(8), paintHero(sidePose(0, 3, 0, pal, { tool: { kind: 'shield' }, armF: { dx: 2, dy: -1 } }))),
        Fr(ms(8), paintHero(sidePose(1, 3, 0, pal, { kb: -1, tool: { kind: 'shield', sparks: [24, 18], seed: 1 }, armF: { dx: 2, dy: -1 } }))),
        Fr(ms(8), paintHero(sidePose(2, 3, 0, pal, { tool: { kind: 'shield' }, armF: { dx: 2, dy: -1 } })))
      ];
      states.push(D('shield_block', 8, true, frames));
    }
    // cheer (4f: raising weapon/arms in celebration + sparkles)
    {
      const frames = [
        Fr(ms(6), paintHero(frontPose(0, 4, 0, pal, 'down', { bob: 2, armL: { dx: -1, dy: 2 }, armR: { dx: 1, dy: 2 } }))),
        Fr(ms(6), paintHero(frontPose(1, 4, 0, pal, 'down', { bob: -3, eye: 'open', armL: { dx: -3, dy: -5 }, armR: { dx: 3, dy: -5 }, tool: { kind: 'sword', angle: -1.57 } }))),
        Fr(ms(6), paintHero(frontPose(2, 4, 0, pal, 'down', { bob: -4, eye: 'open', armL: { dx: -4, dy: -6 }, armR: { dx: 4, dy: -6 }, tool: { kind: 'sword', angle: -1.57, sparks: [16, 8], seed: 2 } }))),
        Fr(ms(6), paintHero(frontPose(3, 4, 0, pal, 'down', { bob: 0, eye: 'open', armL: { dx: -2, dy: -3 }, armR: { dx: 2, dy: -3 } })))
      ];
      states.push(D('cheer', 6, true, frames));
    }
    return { width: 32, height: 32, name: label, layers: [{ name: 'Body' }], states };
  }

  function wizardSuite(pal = WIZARD, label = 'wizard') {
    const states = [];
    const N = c => (buf, W, H) => { const api = PF.Pixel.makeApi(buf, W, H); drawHumanoid(api, buf, W, H, c); };
    for (const [sname, facing] of [['idle_down', 'down'], ['idle_side', 'side'], ['walk_down', 'down'], ['walk_side', 'side']]) {
      const frames = [];
      const n = 4, fps = sname.startsWith('idle') ? 6 : 8;
      for (let i = 0; i < n; i++) {
        const cfg = facing === 'side' ? sidePose(i, n, 2, pal) : frontPose(i, n, 2, pal, facing === 'walk_down' ? 'down' : facing);
        if (sname.startsWith('idle')) { cfg.legA = { dx: 0, dy: 0 }; cfg.legB = { dx: 0, dy: 0 }; cfg.bob = -(i % 2); cfg.eye = i === 3 ? 'closed' : 'open'; }
        cfg.tool = { kind: 'staff' };
        frames.push(Fr(ms(fps), N(cfg)));
      }
      states.push(D(sname, fps, true, frames));
    }
    // cast_arcane (5f: staff overhead with rotating magic aura)
    {
      const frames = [];
      for (let i = 0; i < 5; i++) {
        const cfg = sidePose(0, 5, 0, pal, { bob: i === 2 ? -2 : 0, tool: { kind: 'staff', glow: i / 5 }, eye: i === 2 ? 'closed' : 'open' });
        cfg.armF = { dx: 2, dy: -5 + (i % 2) };
        frames.push(Fr(ms(10), N(cfg)));
      }
      states.push(D('cast_arcane', 10, true, frames));
    }
    // fireball_surge (4f: fire launch)
    {
      const frames = [];
      for (let i = 0; i < 4; i++) {
        const cfg = sidePose(0, 4, 0, pal, { bob: 0, tool: { kind: 'staff', sparks: [26, 14], seed: i } });
        cfg.armF = { dx: 3, dy: -2 };
        frames.push(Fr(ms(8), N(cfg)));
      }
      states.push(D('fireball_surge', 8, true, frames));
    }
    // teleport (4f fade out with particles)
    {
      const frames = [
        Fr(ms(6), N({ pal, facing: 'down', bob: 0, tool: { kind: 'staff' } })),
        Fr(ms(6), N({ pal, facing: 'down', bob: -2, tool: { kind: 'staff', glow: 0.5 }, flash: true })),
        Fr(ms(6), N({ pal, facing: 'down', bob: -4, dither: true, tool: { kind: 'staff' } })),
        Fr(ms(6), (buf, W, H) => { const api = PF.Pixel.makeApi(buf, W, H); PF.Pixel.sparks(api, 16, 16, 3, '#7b61ff'); })
      ];
      states.push(D('teleport', 6, true, frames));
    }
    // hurt & death
    states.push(D('hurt', 8, true, [
      Fr(ms(8), N({ pal, facing: 'down', kb: -2, eye: 'hurt', flash: true })),
      Fr(ms(8), N({ pal, facing: 'down', kb: -2, eye: 'hurt' }))
    ]));
    states.push(D('death', 8, false, [
      Fr(ms(8), N({ pal, facing: 'down', kb: -2, eye: 'hurt', flash: true })),
      Fr(ms(8), N({ pal, facing: 'down', bob: 3, eye: 'hurt' })),
      Fr(ms(8), N({ pal, lying: true, eye: 'hurt' })),
      Fr(ms(8), N({ pal, lying: true, eye: 'dead', dither: true }))
    ]));
    return { width: 32, height: 32, name: label, layers: [{ name: 'Body' }], states };
  }

  function monsterSuite(pal, label, kind) {
    // Slimmed suite for non-hero humanoids: idle, walk, attack, hurt, death
    const states = [];
    const N = c => (buf, W, H) => { const api = PF.Pixel.makeApi(buf, W, H); drawHumanoid(api, buf, W, H, c); };
    // All six facings: top-down games drive `walk_<facing>` for any direction,
    // and a missing up-facing used to silently fall back to idle_down.
    for (const [sname, facing, n, fps] of [['idle_down', 'down', 4, 6], ['idle_side', 'side', 4, 6], ['idle_up', 'up', 4, 6],
                                           ['walk_down', 'down', 4, 8], ['walk_side', 'side', 4, 8], ['walk_up', 'up', 4, 8]]) {
      const frames = [];
      for (let i = 0; i < n; i++) {
        const cfg = facing === 'side' ? sidePose(i, n, 2, pal) : frontPose(i, n, 2, pal, facing);
        if (sname.startsWith('idle')) {
          // zero every limb pair (front uses legA/armL/armR, side uses legF/armF/armB)
          cfg.legA = { dx: 0, dy: 0 }; cfg.legB = { dx: 0, dy: 0 }; cfg.armL = { dx: 0, dy: 0 }; cfg.armR = { dx: 0, dy: 0 };
          cfg.legF = { dx: 0, dy: 0 }; cfg.armF = { dx: 0, dy: 0 }; cfg.armB = { dx: 0, dy: 0 };
          cfg.bob = -(i % 2); cfg.eye = i === 3 ? 'closed' : 'open';
        }
        frames.push(Fr(ms(fps), N(cfg)));
      }
      states.push(D(sname, fps, true, frames));
    }
    // attack side
    {
      const frames = [], angles = [-1.9, -0.9, 0.1, 0.7, 0.2];
      for (let i = 0; i < 5; i++) {
        const cfg = sidePose(i, 5, 1, pal, { tool: kind === 'archer' ? { kind: 'bow', pull: [0, 0.5, 1, 0.5, 0][i] } : { kind: 'sword', angle: angles[i], slash: i === 2 ? [-0.6, 0.9] : null } });
        cfg.armF = { dx: 2, dy: -2 };
        frames.push(Fr(ms(12), N(cfg)));
      }
      states.push(D(kind === 'archer' ? 'bow_side' : 'attack_side', 12, true, frames));
    }
    states.push(D('hurt', 8, true, [
      Fr(ms(8), N({ pal, facing: 'down', kb: -2, eye: 'hurt', flash: true })),
      Fr(ms(8), N({ pal, facing: 'down', kb: -2, eye: 'hurt' }))
    ]));
    states.push(D('death', 8, false, [
      Fr(ms(8), N({ pal, facing: 'down', kb: -2, eye: 'hurt', flash: true })),
      Fr(ms(8), N({ pal, facing: 'down', bob: 3, eye: 'hurt' })),
      Fr(ms(8), N({ pal, lying: true, eye: 'hurt' })),
      Fr(ms(8), N({ pal, lying: true, eye: 'dead' })),
      Fr(ms(8), N({ pal, lying: true, eye: 'dead', dither: true }))
    ]));
    return { width: 32, height: 32, name: label, layers: [{ name: 'Body' }], states };
  }

  return { MALE, FEMALE, VILLAGER_M, VILLAGER_F, SKELETON, ORC, MERCHANT, WIZARD,
    SWORD_PAL, PICK_PAL, AXE_PAL, BOW_PAL, drawHumanoid, drawLying, frontPose, sidePose, dust,
    heroSuite, monsterSuite, wizardSuite };
})();

