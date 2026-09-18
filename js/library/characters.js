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
    if (cfg.sitting) {
      drawSitting(api, buf, W, H, cfg);
      /* A seated hand rests on the thigh, which is a fixed point relative to the
         seat, so the standing grip formula still works with the offset that puts
         it there. This is what lets the fisher hold a rod while sitting. */
      if (cfg.tool) {
        const dy = (cfg.seatY || 22) - 22;
        drawTool(api, buf, W, H, { ...cfg, bob: 0,
          armF: cfg.armF || { dx: 1, dy }, armR: cfg.armR || { dx: -2, dy } });
      }
      if (cfg.flash) P().flashWhite(api, W, H, buf);
      return finish(buf, W, H, pal);
    }
    const kb = cfg.kb || 0; // knockback x offset
    const body = () => ((cfg.facing || 'down') === 'side')
      ? drawSide(api, buf, W, H, { ...cfg, kb, bob })
      : drawFrontBack(api, buf, W, H, { ...cfg, kb, bob });
    /* tool.behind drops the weapon under the torso. On a swing's recovery the
       blade has travelled past the body, so occluding it is what sells the
       arc — drawn on top it reads as the sword hovering in front of the chest. */
    if (cfg.tool && cfg.tool.behind) { drawTool(api, buf, W, H, cfg); body(); }
    else { body(); drawTool(api, buf, W, H, cfg); }
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
    // head — cfg.headDy sinks the head into the shoulders for a breathing
    // idle without moving the feet (a whole-body bob reads as a hop)
    const hy = Y(4) + (cfg.headDy || 0);
    if (back) drawHeadBack(api, tx, hy, pal, cfg);
    else drawHeadFront(api, tx, hy, pal, cfg);
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

    // 5. Head profile (positioned at tx - 1 = 11 + kb). headDy sinks it for
    //    the breathing idle without lifting the feet off the ground.
    drawHeadSide(api, tx - 1, Y(4) + (cfg.headDy || 0), pal, cfg);

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
  // Steel dark->light->hot: the tail of a swing is in shadow, the head is not.
  const STEEL = ['#5a6988', '#c0cbdc', '#ffffff'];
  const HOT = ['#ffffff', '#c0cbdc'];
  /* Farming / fishing / smithing props held in the hand. Shared between the
     side and front branches because the grip point differs but the art does
     not. Drawn inside drawTool, so they pick up the silhouette outline the
     same way a sword does — a post-hook prop would have no rim. */
  function lifeTool(api, t, hx, hy, front) {
    const d = front ? -1 : 1;
    if (t.kind === 'rod') {
      api.line(hx - d, hy + 3, hx + d * 9, hy - 9, '#8a6a4a', 1);
      api.line(hx + d * 9, hy - 9, hx + d * 9, hy + 1, '#e8ecf5', 1);
      api.px(hx + d * 9, hy + 2, '#e43b44');
    } else if (t.kind === 'can') {
      // small enough to read as held: a 6x6 body swallowed the whole forearm
      api.rect(hx, hy - 2, hx + 3, hy + 2, '#8b9bb4');
      api.line(hx + 3, hy - 1, hx + 6, hy - 3, '#8b9bb4', 1);
      api.px(hx + 1, hy - 3, '#5a6988'); api.px(hx + 2, hy - 3, '#5a6988');
      api.px(hx, hy + 1, '#5a6988');
    } else if (t.kind === 'seedbag') {
      api.rect(hx - 2, hy - 2, hx + 3, hy + 3, '#b86f50');
      api.rect(hx - 2, hy - 2, hx + 3, hy - 1, '#733e39');
      api.px(hx, hy + 1, '#fee761'); api.px(hx + 2, hy + 2, '#fee761');
    } else if (t.kind === 'sickle') {
      // haft, blade out, tip hooked back — a 3px sliver of steel read as a
      // splinter rather than a harvesting tool
      api.line(hx, hy + 3, hx + d, hy - 2, '#733e39', 2);
      api.line(hx + d, hy - 2, hx + d * 4, hy - 4, '#c0cbdc', 2);
      api.line(hx + d * 4, hy - 4, hx + d * 3, hy - 7, '#c0cbdc', 1);
      api.px(hx + d * 3, hy - 8, '#ffffff');
    } else return false;
    return true;
  }
  function drawTool(api, buf, W, H, cfg) {
    const t = cfg.tool; if (!t) return;
    const P = PF.Pixel;
    if (cfg.facing === 'side') {
      const hx = 18 + (cfg.kb || 0) + ((cfg.armF || {}).dx || 0), hy = 19 + (cfg.bob || 0) + ((cfg.armF || {}).dy || 0);
      // t.draw: a pack-local tool painted at the grip. Needed when the shared
      // primitives are sized for a bigger cell — a 14-unit spear from this hand
      // runs off the frame, and an outline pass cannot rim pixels it never saw.
      if (t.draw) t.draw(api, hx, hy, t, cfg);
      else if (t.kind === 'sword') P.sword(api, hx, hy, t.angle, SWORD_PAL);
      else if (t.kind === 'shield') P.shield(api, hx + 1, hy - 1, '#b86f50', '#8b9bb4');
      else if (t.kind === 'kiteShield') P.kiteShield(api, hx + 1, hy - 1, t.base, t.rim, t.cross);
      else if (t.kind === 'mace') P.mace(api, hx, hy, t.angle, t.pal);
      else if (t.kind === 'spear') P.spear(api, hx, hy, t.angle, t.pal);
      else if (t.kind === 'hammer') P.hammer(api, hx, hy, t.angle, t.pal);
      else if (t.kind === 'pickaxe') P.pickaxe(api, hx, hy, t.angle, PICK_PAL);
      else if (t.kind === 'axe') P.axe(api, hx, hy, t.angle, AXE_PAL);
      else if (t.kind === 'bow') P.bow(api, hx + 4, hy - 2, t.pull || 0, BOW_PAL, t.arrow === false ? 0 : 1);
      else if (t.kind === 'food') { api.rect(hx - 1, hy - 4, hx + 1, hy - 2, '#e43b44'); api.px(hx, hy - 5, '#63c74d'); }
      else if (t.kind === 'staff') { api.line(hx, hy - 10, hx, hy + 4, '#b86f50', 2); api.rect(hx - 1, hy - 12, hx + 1, hy - 10, '#2ce8f5'); api.px(hx, hy - 11, '#ffffff'); }
      else if (t.kind === 'lute') { // pear body + neck angled up-right
        api.ellipse(hx - 4, hy - 2, hx + 2, hy + 4, '#b86f50', true);
        api.ellipse(hx - 3, hy - 1, hx + 1, hy + 3, '#e4a672', true);
        api.px(hx - 1, hy + 1, '#3e2731');
        api.line(hx + 2, hy - 1, hx + 8, hy - 6, '#733e39', 2);
        api.px(hx + 8, hy - 6, '#fee761'); api.px(hx + 7, hy - 7, '#fee761');
      }
      else if (t.kind === 'box') { api.rect(hx - 2, hy - 1, hx + 2, hy + 3, '#b86f50'); api.rect(hx - 2, hy - 1, hx + 2, hy, '#733e39'); }
      else lifeTool(api, t, hx, hy, false);
      // glow was only wired into the front branch, so every side-view cast
      // (hero cast, wizard cast_arcane) rendered four identical frames
      if (t.glow !== undefined) P.particles(api, hx + 3, hy - 9, 7, t.glow, ['#fee761', '#ffffff', '#2ce8f5']);
      if (t.slash) P.slash(api, hx + 2, hy - 4, 9, t.slash[0], t.slash[1], '#ffffff', 2);
      if (t.arc) P.arcTrail(api, hx, hy, t.arc[2] || 10, t.arc[0], t.arc[1], STEEL);
      if (t.impact) P.impactStar(api, hx + t.impact[0], hy + t.impact[1], t.impact[2], HOT);
      if (t.sparks) P.sparks(api, t.sparks[0], t.sparks[1], t.seed || 0, '#fee761');
      if (t.dust) dust(api, t.dust);
    } else {
      // front view: sword on right side
      const hx = 23 + (cfg.kb || 0) + ((cfg.armR || {}).dx || 0), hy = 19 + (cfg.bob || 0) + ((cfg.armR || {}).dy || 0);
      const hlx = 9 + (cfg.kb || 0) + ((cfg.armL || {}).dx || 0), hly = 19 + (cfg.bob || 0) + ((cfg.armL || {}).dy || 0);
      if (t.draw) t.draw(api, hx, hy, t, cfg);
      else if (t.kind === 'sword') P.sword(api, hx, hy, t.angle, SWORD_PAL);
      else if (t.kind === 'mace') P.mace(api, hx, hy, t.angle, t.pal);
      else if (t.kind === 'spear') P.spear(api, hx, hy, t.angle, t.pal);
      else if (t.kind === 'hammer') P.hammer(api, hx, hy, t.angle, t.pal);
      else if (t.kind === 'kiteShield') P.kiteShield(api, hlx - 1, hly - 1, t.base, t.rim, t.cross);
      else if (t.kind === 'pickaxe') P.pickaxe(api, hx, hy, t.angle, PICK_PAL);
      else if (t.kind === 'axe') P.axe(api, hx, hy, t.angle, AXE_PAL);
      else if (t.kind === 'food') { const f = t.at || [hx - 2, hy - 4]; api.rect(f[0] - 1, f[1] - 1, f[0] + 1, f[1] + 1, '#e43b44'); api.px(f[0], f[1] - 2, '#63c74d'); api.px(f[0] - 1, f[1] - 1, '#f6757a'); }
      else if (t.kind === 'box') { api.rect(hlx - 1, hly, hx + 1, hly + 4, '#b86f50'); api.rect(hlx - 1, hly, hx + 1, hly + 1, '#733e39'); }
      else if (t.kind === 'staff') { api.line(hlx, hly - 10, hlx, hly + 4, '#b86f50', 2); api.rect(hlx - 1, hly - 12, hlx + 1, hly - 10, '#b55088'); }
      // head-on bow: lets archers attack on the down/up facings too. Held out
      // to the side of the torso so the limbs never sink into the tunic.
      else if (t.kind === 'bow') P.bowFront(api, hlx - 3, hly - 1, t.pull || 0, cfg.facing === 'up' ? -1 : 1, BOW_PAL, t.arrow === false ? 0 : 1);
      else if (t.kind === 'lute') {
        api.ellipse(hx - 3, hy - 1, hx + 3, hy + 5, '#b86f50', true);
        api.ellipse(hx - 2, hy, hx + 2, hy + 4, '#e4a672', true);
        api.px(hx, hy + 2, '#3e2731');
        api.line(hx + 2, hy - 1, hx + 6, hy - 6, '#733e39', 2);
        api.px(hx + 6, hy - 6, '#fee761');
      }
      // front branch keeps the prop on the sword side, so it extends out from
      // the right hand rather than back across the torso
      else lifeTool(api, t, hx, hy, false);
      if (t.slash) P.slash(api, 16 + (cfg.kb || 0), 16 + (cfg.bob || 0), 11, t.slash[0], t.slash[1], '#ffffff', 2);
      // Square-on arcs pivot off the torso, not the hand: at x23 a 10px radius
      // would run the smear off the sprite sheet.
      if (t.arc) P.arcTrail(api, 18 + (cfg.kb || 0), 16 + (cfg.bob || 0), t.arc[2] || 9, t.arc[0], t.arc[1], STEEL);
      if (t.impact) P.impactStar(api, hx + t.impact[0], hy + t.impact[1], t.impact[2], HOT);
      if (t.sparks) P.sparks(api, t.sparks[0], t.sparks[1], t.seed || 0, '#fee761');
      if (t.dust) dust(api, t.dust);
      if (t.glow) P.particles(api, 16 + (cfg.kb || 0), 12 + (cfg.bob || 0), 8, t.glow, ['#fee761', '#ffffff', '#2ce8f5']);
    }
  }
  /* Seated pose. Deliberately NOT the standing rig with bent limbs: the hip line
     becomes the anchor and the head, torso and seat all measure up from it, or a
     sitting figure keeps the standing head height and floats above its chair.
     cfg.seatY  surface the hips rest on (22 chair/ledge, 25 floor)
     cfg.legs   'dangle' (shins to the floor) | 'fold' (cross-legged) | 'knees' (up, hugged)
     cfg.arms   'lap' | 'crossed' | 'knees' | 'mug' | 'cheeks' | 'none'
     cfg.lean   -1 reclined, 0 upright, 1 hunched forward
     Feet stay within y25..27 at both seat heights so the engine's shadow row 29
     is never touched, and the head never rises above its standing row. */
  function drawSitting(api, buf, W, H, cfg) {
    const pal = cfg.pal, kb = cfg.kb || 0, lean = cfg.lean || 0;
    // The seat never moves: bob is breath, and breath that lifts the hips puts
    // the figure an inch above its stool every other frame.
    const sy = cfg.seatY || 22, hd = cfg.headDy || 0, bob = cfg.bob || 0;
    const LX = x => x + kb + lean, B = y => y + bob;
    const sh = pal.shirt, shS = pal.shirtSh, shH = pal.shirtHi, pn = pal.pants, pnS = pal.pantsSh, sk = pal.skin, skS = pal.skinSh;
    const legs = cfg.legs || 'dangle';
    if (cfg.facing !== 'side') return sitFront(api, cfg, pal, sy, bob, hd, kb + lean);
    if (legs === 'dangle') {
      // cfg.shin kicks the lower leg forward — the toe-tap of someone leaning
      // back in a chair, which no amount of torso motion can stand in for
      const sn = cfg.shin || 0;
      api.rect(LX(13), sy - 1, LX(20), sy + 1, pn);
      api.rect(LX(18 + sn), sy + 2, LX(20 + sn), sy + 4, pn);
      api.rect(LX(17 + sn), sy + 5, LX(20 + sn), sy + 5, pal.boots);
      api.rect(LX(15), sy, LX(20), sy, pnS);
    } else if (legs === 'knees') {
      api.rect(LX(12), sy - 1, LX(22), sy, pnS);
      // knees need a lit edge or they merge into the torso above them
      api.rect(LX(16), sy - 6, LX(19), sy - 1, pn);
      api.px(LX(16), sy - 6, shH); api.px(LX(17), sy - 6, shH);
      api.rect(LX(19), sy - 3, LX(22), sy - 1, pal.boots);
      api.px(LX(16), sy - 6, shH);
    } else {
      api.rect(LX(12), sy - 2, LX(21), sy, pn);
      api.rect(LX(12), sy - 2, LX(21), sy - 2, pnS);
      api.rect(LX(19), sy - 3, LX(21), sy - 1, pal.boots);
      api.px(LX(13), sy - 3, skS);
    }
    // torso from the seat up; the lean slides the whole upper body as one mass
    const ty = B(sy - 9);
    api.rect(LX(11), ty, LX(17), B(sy - 1), sh);
    api.rect(LX(11), ty, LX(12), B(sy - 1), shS);
    api.rect(LX(16), ty, LX(17), B(sy - 1), shH);
    api.rect(LX(11), B(sy - 3), LX(17), B(sy - 2), pal.belt);
    api.rect(LX(13), B(sy - 3), LX(14), B(sy - 2), pal.buckle);
    drawHeadSide(api, LX(10), ty - 5 + hd, pal, cfg);
    // arms: a two-segment limb, because a seated arm always bends somewhere
    const sx = LX(14), syy = ty + 1;
    const arm = (ex, ey, hx2, hy2, sleeve) => {
      api.line(sx, syy, ex, ey, sleeve ? sh : shS, 2);
      api.line(ex, ey, hx2, hy2, sk, 2);
      api.rect(hx2 - 1, hy2 - 1, hx2 + 1, hy2 + 1, sk);
    };
    const a = cfg.arms || 'lap';
    if (a === 'lap') arm(LX(16), B(sy - 5), LX(19), B(sy - 3), true);
    else if (a === 'knees') { arm(LX(15), B(sy - 5), LX(18), B(sy - 5), true); api.line(LX(14), B(sy - 6), LX(19), B(sy - 7), sk, 1); }
    else if (a === 'crossed') {
      api.rect(LX(11), B(sy - 7), LX(18), B(sy - 5), shS);
      api.rect(LX(11), B(sy - 7), LX(13), B(sy - 5), sk);
      api.rect(LX(16), B(sy - 7), LX(18), B(sy - 5), sk);
      api.rect(LX(11), B(sy - 7), LX(18), B(sy - 7), shH);
    } else if (a === 'mug') {
      arm(LX(16), B(sy - 6), LX(17), ty + 3, true);
      api.rect(LX(17), ty + 2, LX(20), ty + 5, '#b86f50');
      api.rect(LX(17), ty + 2, LX(20), ty + 2, '#e4a672');
      api.px(LX(20), ty + 4, '#733e39');
    } else if (a === 'cheeks') {
      arm(LX(13), B(sy - 6), LX(12), ty + 2, false);
      api.line(LX(16), B(sy - 6), LX(18), ty + 2, sk, 2);
      api.rect(LX(17), ty + 1, LX(19), ty + 3, sk);
    }
  }
  /* Front / back view of the seated pose. The knees come toward the camera as
     two blocks and the shins drop behind them, which is the only read that
     separates "sitting" from "standing very close to a wall" at this size.
     Reuses drawHeadFront/drawHeadBack so a seated character has the same face
     as the standing one rather than a second, drifting head style. */
  function sitFront(api, cfg, pal, sy, bob, hd, off) {
    const back = cfg.facing === 'up', legs = cfg.legs || 'dangle';
    /* Head and torso sit three rows lower than the standing rig. This rig has
       short legs and a big head, so a seated figure can only be a few pixels
       shorter than a standing one — but those few pixels are the entire read:
       at the standing height the pose looked like a person squeezed into a
       doorway, not a person on a stool. */
    const tx = 10 + off, ty = sy - 6 + bob, hy = sy - 15 + hd;
    const sh = pal.shirt, shS = pal.shirtSh, shH = pal.shirtHi;
    const pn = pal.pants, pnS = pal.pantsSh, sk = pal.skin, skS = pal.skinSh;
    if (legs === 'dangle') {
      // Thighs as one mass across the seat, knees at its lower edge, shins
      // dropping behind them. Two parallel leg columns read as standing; the
      // horizontal block is what says the legs are coming toward the camera.
      api.rect(tx + 1, sy - 2, tx + 10, sy + 1, pn);
      api.rect(tx + 1, sy - 2, tx + 10, sy - 2, pnS);
      api.rect(tx + 2, sy + 1, tx + 4, sy + 3, pn);
      api.rect(tx + 7, sy + 1, tx + 9, sy + 3, pnS);
      api.rect(tx + 1, sy + 4, tx + 4, sy + 5, pal.boots);   // feet at y27
      api.rect(tx + 6, sy + 4, tx + 9, sy + 5, pal.boots);
      api.px(tx + 3, sy + 1, shH); api.px(tx + 8, sy + 1, shH);
    } else {
      api.rect(tx + 1, sy - 3, tx + 10, sy, pn);             // folded legs as one mass
      api.rect(tx + 1, sy - 3, tx + 10, sy - 3, pnS);
      api.rect(tx + 2, sy - 5, tx + 5, sy - 1, legs === 'knees' ? pn : pnS);
      api.rect(tx + 6, sy - 5, tx + 9, sy - 1, legs === 'knees' ? pn : pnS);
      api.px(tx + 3, sy - 5, sk); api.px(tx + 8, sy - 5, sk);
    }
    api.rect(tx, ty, tx + 11, sy - 2 + bob, sh);
    api.rect(tx, ty, tx + 1, sy - 2 + bob, shS);
    api.rect(tx + 10, ty, tx + 10, sy - 2 + bob, shH);
    api.rect(tx, sy - 4 + bob, tx + 11, sy - 3 + bob, pal.belt);
    api.rect(tx + 5, sy - 4 + bob, tx + 6, sy - 3 + bob, pal.buckle);
    if (back) drawHeadBack(api, tx, hy, pal, cfg); else drawHeadFront(api, tx, hy, pal, cfg);
    // arms bend at the elbow and rest where the torso is, so they are keyed off
    // ty — the seat line sits well below the chest on this rig
    const a = cfg.arms || 'lap';
    if (a === 'crossed') {
      api.rect(tx + 1, ty + 1, tx + 10, ty + 3, shS);
      api.rect(tx + 1, ty + 1, tx + 3, ty + 3, sk);
      api.rect(tx + 8, ty + 1, tx + 10, ty + 3, sk);
      api.rect(tx + 1, ty + 1, tx + 10, ty + 1, shH);
    } else if (a === 'cheeks') {
      // hands at the temples, elbows dropped — the head-in-hands read
      api.rect(tx, ty - 1, tx + 2, ty + 2, sh);
      api.rect(tx + 9, ty - 1, tx + 11, ty + 2, sh);
      api.line(tx + 1, ty, tx + 1, hy + 7, sk, 2);
      api.line(tx + 10, ty, tx + 10, hy + 7, sk, 2);
      api.rect(tx - 1, hy + 4, tx + 1, hy + 7, sk);
      api.rect(tx + 10, hy + 4, tx + 12, hy + 7, sk);
    } else if (a === 'mug') {
      api.rect(tx + 1, ty, tx + 3, ty + 3, sh);
      api.rect(tx + 8, ty, tx + 10, ty + 3, sh);
      api.rect(tx + 4, ty + 1, tx + 7, ty + 4, '#b86f50');
      api.rect(tx + 4, ty + 1, tx + 7, ty + 1, '#e4a672');
      api.px(tx + 3, ty + 2, sk); api.px(tx + 8, ty + 2, sk);
    } else {
      api.rect(tx, ty + 1, tx + 2, sy - 4 + bob, sh);
      api.rect(tx + 9, ty + 1, tx + 11, sy - 4 + bob, sh);
      api.rect(tx, sy - 4 + bob, tx + 2, sy - 2 + bob, sk);
      api.rect(tx + 9, sy - 4 + bob, tx + 11, sy - 2 + bob, sk);
    }
  }
  function dust(api, pts) {
    pts.forEach(([x, y, c]) => api.px(x, y, c || '#c0cbdc'));
  }

  /* Lying pose for sleep / death */
  function drawLying(api, buf, W, H, cfg) {
    const pal = cfg.pal, dead = cfg.eye === 'dead';
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
      /* A leg only ever lifts. The old form was `dy = s * amp`, which on the
         down half of the sine drove the planted foot *through* the floor while
         the swinging one stayed put — the cycle read as sliding, not stepping. */
      legA: { dx: 0, dy: -Math.round(Math.max(0, s) * amp) }, legB: { dx: 0, dy: -Math.round(Math.max(0, -s) * amp) },
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
    // Idle: a slow breath. The head settles into the shoulders and the arms
    // follow half a beat later; the feet never leave the ground. The old form
    // (`bob = -(i % 2)` at 6fps) was two poses bouncing the whole body three
    // times a second, which reads as hopping rather than breathing.
    const IDLE_HEAD = [0, 1, 1, 0], IDLE_ARM = [0, 0, 1, 1];
    for (const [sname, facing] of [['idle_down', 'down'], ['idle_side', 'side'], ['idle_up', 'up']]) {
      const frames = [];
      for (let i = 0; i < 4; i++) {
        const blink = i === 3, hd = IDLE_HEAD[i], ad = IDLE_ARM[i];
        const cfg = facing === 'side'
          ? { pal, facing, bob: 0, headDy: hd, legF: { dx: 0, dy: 0 }, legB: { dx: 0, dy: 0 }, armF: { dx: 0, dy: ad }, armB: { dx: 0, dy: ad }, eye: blink ? 'closed' : 'open' }
          : { pal, facing, bob: 0, headDy: hd, legA: { dx: 0, dy: 0 }, legB: { dx: 0, dy: 0 }, armL: { dx: 0, dy: ad }, armR: { dx: 0, dy: ad }, eye: blink ? 'closed' : 'open' };
        frames.push(Fr(ms(4), paintHero(cfg)));
      }
      states.push(D(sname, 4, true, frames));
    }
    // walk ×3
    for (const [sname, facing] of [['walk_down', 'down'], ['walk_side', 'side'], ['walk_up', 'up']]) {
      const frames = [];
      for (let i = 0; i < 4; i++) {
        const cfg = facing === 'side' ? sidePose(i, 4, 2, pal) : frontPose(i, 4, 2, pal, facing);
        frames.push(Fr(ms(6), paintHero(cfg)));
      }
      states.push(D(sname, 6, true, frames));
    }
    // run (side, 6f bigger swing + dust)
    {
      const frames = [];
      for (let i = 0; i < 6; i++) {
        // quarter-phase cosine on the bob: a plain 6-sample sine repeats its
        // magnitude on frames 1/2 and 4/5, giving two static frames. The dust
        // must also ride inside `tool` — drawTool returns early without one.
        const a = (i / 6) * Math.PI * 2;
        const cfg = sidePose(i, 6, 3, pal, {
          bob: Math.round(-Math.abs(Math.sin(a)) * 2 - Math.cos(a)),
          tool: { kind: 'none', dust: i % 3 === 0 ? [[8, 28, '#c0cbdc'], [6, 27, '#8b9bb4']] : null }
        });
        frames.push(Fr(ms(10), paintHero(cfg)));
      }
      states.push(D('run_side', 10, true, frames));
    }
    // sword attacks: side sweep + down sweep
    {
      const frames = [];
      const angles = [-1.9, -0.9, 0.1, 0.7, 0.2];
      for (let i = 0; i < 5; i++) {
        const cfg = sidePose(i, 5, 1, pal, { bob: i === 2 ? -1 : 0, tool: { kind: 'sword', angle: angles[i], slash: i === 2 ? [-0.6, 0.9] : null } });
        cfg.armF = { dx: 2, dy: -3 + i };
        frames.push(Fr(ms(10), paintHero(cfg)));
      }
      states.push(D('attack_sword_side', 10, true, frames));
    }
    {
      const frames = [];
      const angles = [-2.4, -1.2, -0.2, 0.5, 0.1];
      for (let i = 0; i < 5; i++) {
        const cfg = frontPose(i, 5, 1, pal, 'down', { tool: { kind: 'sword', angle: angles[i], slash: i === 2 ? [0.4, 2.6] : null } });
        cfg.armR = { dx: 1, dy: -2 + Math.round(i * 0.8) };
        frames.push(Fr(ms(10), paintHero(cfg)));
      }
      states.push(D('attack_sword_down', 10, true, frames));
    }
    // bow (side, 4f draw + release)
    {
      const frames = [];
      const pulls = [0, 0.5, 1, 0];
      for (let i = 0; i < 4; i++) {
        const cfg = sidePose(0, 4, 0, pal, { bob: 0, tool: { kind: 'bow', pull: pulls[i], arrow: i !== 3 }, sparks: i === 3 ? [28, 14] : null, seed: 1 });
        cfg.armF = { dx: 2, dy: -1 };
        frames.push(Fr(ms(8), paintHero(cfg)));
      }
      states.push(D('bow_side', 8, true, frames));
    }
    // pickaxe mining (side, 5f overhead → impact + sparks)
    {
      const frames = [];
      const angles = [-2.1, -1.6, -0.6, 0.5, -1.2];
      for (let i = 0; i < 5; i++) {
        const cfg = sidePose(i, 5, 1, pal, { tool: { kind: 'pickaxe', angle: angles[i], sparks: i === 3 ? [26, 27] : null, seed: i, dust: i === 3 ? [[24, 28, '#c28569'], [28, 28, '#8b9bb4'], [26, 26, '#fee761']] : [] } });
        cfg.armF = { dx: 1, dy: i < 2 ? -4 : (i === 3 ? 1 : -1) };
        frames.push(Fr(ms(8), paintHero(cfg)));
      }
      states.push(D('mine_pickaxe', 8, true, frames));
    }
    // axe chop (front, 4f)
    {
      const frames = [];
      const angles = [-2.0, -1.0, 0.3, -0.8];
      for (let i = 0; i < 4; i++) {
        const cfg = frontPose(i, 4, 1, pal, 'down', { tool: { kind: 'axe', angle: angles[i], sparks: i === 2 ? [16, 24] : null, seed: 2 } });
        cfg.armR = { dx: 0, dy: i < 2 ? -3 : 1 };
        frames.push(Fr(ms(8), paintHero(cfg)));
      }
      states.push(D('chop_axe', 8, true, frames));
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
        frames.push(Fr(ms(8), paintHero(cfg)));
      }
      states.push(D('cast', 8, true, frames));
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
        frames.push(Fr(ms(10), paintHero(cfg)));
      }
      states.push(D('dash_side', 12, true, frames));
    }
    // shield_block (3f: side guard + impact sparks)
    {
      // amp 0 makes all three sidePose calls identical, so the third frame
      // must differ by the guard height or the loop visibly hitches
      const frames = [
        Fr(ms(8), paintHero(sidePose(0, 3, 0, pal, { tool: { kind: 'shield' }, armF: { dx: 2, dy: -1 } }))),
        Fr(ms(8), paintHero(sidePose(1, 3, 0, pal, { kb: -1, tool: { kind: 'shield', sparks: [24, 18], seed: 1 }, armF: { dx: 2, dy: -1 } }))),
        Fr(ms(8), paintHero(sidePose(2, 3, 0, pal, { tool: { kind: 'shield' }, armF: { dx: 2, dy: 0 } })))
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
      const n = 4, fps = sname.startsWith('idle') ? 4 : 6;
      for (let i = 0; i < n; i++) {
        const cfg = facing === 'side' ? sidePose(i, n, 2, pal) : frontPose(i, n, 2, pal, facing === 'walk_down' ? 'down' : facing);
        if (sname.startsWith('idle')) {
          cfg.legA = { dx: 0, dy: 0 }; cfg.legB = { dx: 0, dy: 0 }; cfg.legF = { dx: 0, dy: 0 };
          cfg.headDy = [0, 1, 1, 0][i]; cfg.bob = 0; cfg.eye = i === 3 ? 'closed' : 'open';
        }
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
    const IDLE_HEAD = [0, 1, 1, 0], IDLE_ARM = [0, 0, 1, 1];
    const amp = 2;
    for (const [sname, facing, n, fps] of [['idle_down', 'down', 4, 4], ['idle_side', 'side', 4, 4], ['idle_up', 'up', 4, 4],
                                           ['walk_down', 'down', 6, 6], ['walk_side', 'side', 6, 6], ['walk_up', 'up', 6, 6]]) {
      const frames = [];
      for (let i = 0; i < n; i++) {
        let cfg;
        if (sname.startsWith('idle')) {
          cfg = facing === 'side' ? sidePose(i, n, 0, pal) : frontPose(i, n, 0, pal, facing);
          // zero every limb pair (front uses legA/armL/armR, side uses legF/armF/armB)
          cfg.legA = { dx: 0, dy: 0 }; cfg.legB = { dx: 0, dy: 0 }; cfg.legF = { dx: 0, dy: 0 };
          cfg.armL = { dx: 0, dy: IDLE_ARM[i] }; cfg.armR = { dx: 0, dy: IDLE_ARM[i] };
          cfg.armF = { dx: 0, dy: IDLE_ARM[i] }; cfg.armB = { dx: 0, dy: IDLE_ARM[i] };
          cfg.headDy = IDLE_HEAD[i]; cfg.bob = 0; cfg.eye = i === 3 ? 'closed' : 'open';
        } else {
          /* Six beats with the bob on a quarter-phase cosine: a plain 6-sample
             sine repeats its magnitude on frames 1/2 and 4/5 and stalls. */
          const a = i / n * Math.PI * 2;
          // One row of lift only: two rows sliced headgear off the top of the
          // frame, since the outline pass cannot draw outside the buffer. The
          // arms carry the cosine so the six frames stay distinct.
          const bob = Math.max(-1, Math.min(0, Math.round(-Math.abs(Math.sin(a)) * amp - Math.cos(a) * 0.9)));
          const aw = Math.round(Math.cos(a) * 2);
          const dust = (i === 1 || i === 4) ? [[13, 27, '#c0cbdc'], [18, 27, '#8b9bb4']] : null;
          cfg = facing === 'side' ? sidePose(i, n, amp, pal, { bob, tool: { kind: 'none', dust } })
                                  : frontPose(i, n, amp, pal, facing, { bob, tool: { kind: 'none', dust } });
          if (facing === 'side') { cfg.armF = { dx: -aw, dy: 0 }; cfg.armB = { dx: aw, dy: 0 }; }
          else { cfg.armL = { dx: 0, dy: -aw }; cfg.armR = { dx: 0, dy: aw }; }
        }
        frames.push(Fr(ms(fps), N(cfg)));
      }
      states.push(D(sname, fps, true, frames));
    }
    // attack side — held windup, one fast strike frame carrying the arc, an
    // impact, then the blade through and behind the body.
    {
      const frames = [], angles = [-2.3, -2.6, -0.3, 0.55, 0.6, 0.25];
      const dur = [200, 120, 50, 75, 130, 165], arm = [-3, -4, -2, -2, -2, -1];
      for (let i = 0; i < 6; i++) {
        const tool = kind === 'archer'
          ? { kind: 'bow', pull: [0, 0.45, 0.85, 1, 0.05, 0][i], arrow: i > 0 && i < 4 }
          : { kind: 'sword', angle: angles[i], arc: i === 2 || i === 3 ? [angles[i] - 1.15, angles[i], 10] : (i === 4 ? [angles[i] - 0.7, angles[i], 9] : null),
              impact: i === 3 ? [3, 2, 0.2] : null, behind: i >= 4 };
        const cfg = sidePose(i, 6, 1, pal, { tool, headDy: kind === 'archer' && i === 5 ? 1 : 0 });
        cfg.armF = { dx: 2, dy: arm[i] };
        cfg.kb = kind === 'archer' ? (i === 4 ? 1 : 0) : [0, 1, 2, 2, 1, 0][i];
        frames.push(Fr(dur[i], N(cfg)));
      }
      states.push(D(kind === 'archer' ? 'bow_side' : 'attack_side', 12, true, frames));
    }
    states.push(D('hurt', 8, true, [
      Fr(60, N({ pal, facing: 'down', kb: -3, eye: 'hurt', flash: true, tool: { kind: 'none', impact: [-4, -4, 0.15] } })),
      Fr(95, N({ pal, facing: 'down', kb: -2, bob: -1, eye: 'hurt' })),
      Fr(150, N({ pal, facing: 'down', kb: -1, eye: 'hurt' }))
    ]));
    states.push(D('death', 8, false, [
      Fr(60, N({ pal, facing: 'down', kb: -3, eye: 'hurt', flash: true, tool: { kind: 'none', impact: [-4, -4, 0.2] } })),
      // Loss of balance reads through the head and the lean, not a body sunk
      // through the floor: the old `bob: 3` drove the feet to y30, into the
      // engine's shadow row, where the outline pass fused them to it.
      Fr(120, N({ pal, facing: 'down', kb: -4, headDy: 2, eye: 'hurt', tool: { kind: 'none', dust: [[12, 27, '#c0cbdc'], [19, 27, '#8b9bb4']] } })),
      Fr(150, N({ pal, lying: true, eye: 'hurt' })),
      Fr(170, N({ pal, lying: true, eye: 'dead' })),
      Fr(220, N({ pal, lying: true, eye: 'dead', dither: true }))
    ]));
    return { width: 32, height: 32, name: label, layers: [{ name: 'Body' }], states };
  }

  return { MALE, FEMALE, VILLAGER_M, VILLAGER_F, SKELETON, ORC, MERCHANT, WIZARD,
    SWORD_PAL, PICK_PAL, AXE_PAL, BOW_PAL, drawHumanoid, drawLying, frontPose, sidePose, dust,
    heroSuite, monsterSuite, wizardSuite };
})();

