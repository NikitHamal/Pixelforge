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
  function slimeFrame(w, h, squash, blink, hurt) {
    return (buf, W, H) => {
      const api = apiFor(buf, W, H), cx = 16, gy = 26;
      PF.Pixel.shadowFlat(api, cx, 28, 6);
      // body ellipse: volume-preserving squash
      const bw = Math.round(w * (squash ? 1.18 : 1)), bh = Math.round(h * (squash ? 0.82 : 1));
      const x0 = cx - bw / 2, x1 = cx + bw / 2, y1 = gy, y0 = gy - bh;
      const G = hurt ? '#ffffff' : '#63c74d', Dk = hurt ? '#e8e8e8' : '#3e8948', L = '#a8f28a';
      api.ellipse(x0, y0, x1, y1, G, true);
      api.ellipse(x0 + 2, y0 + 1, x0 + 5, y0 + 5, L, true); // highlight
      api.rect(x0 + 1, y1 - 2, x1 - 1, y1, Dk); // base shade
      // face
      const ey = y0 + bh * 0.45;
      if (blink) { api.line(x0 + 4, ey + 2, x0 + 6, ey + 2, '#181425', 1); api.line(x1 - 6, ey + 2, x1 - 4, ey + 2, '#181425', 1); }
      else {
        api.rect(x0 + 4, ey, x0 + 6, ey + 3, '#181425'); api.rect(x1 - 6, ey, x1 - 4, ey + 3, '#181425');
        api.px(x0 + 4, ey, '#ffffff'); api.px(x1 - 6, ey, '#ffffff');
      }
      api.line(x0 + 6, ey + 5, x1 - 6, ey + 5, Dk, 1); // mouth
      finish(buf, W, H);
    };
  }
  function slimeSuite() {
    return { width: 32, height: 32, name: 'slime', layers: [{ name: 'Body' }], states: [
      D('idle', 6, true, [Fr(ms(6), slimeFrame(16, 12, false)), Fr(ms(6), slimeFrame(16, 12, true)), Fr(ms(6), slimeFrame(16, 11, false, true)), Fr(ms(6), slimeFrame(16, 12, true))]),
      D('walk', 8, true, [Fr(ms(8), slimeFrame(15, 12, false)), Fr(ms(8), slimeFrame(17, 10, true)), Fr(ms(8), slimeFrame(15, 13, false)), Fr(ms(8), slimeFrame(17, 10, true))]),
      D('jump', 10, true, [Fr(ms(10), slimeFrame(14, 12, false)), Fr(ms(10), slimeFrame(13, 15, false)), Fr(ms(10), slimeFrame(14, 12, false)), Fr(ms(10), slimeFrame(17, 10, true))]),
      D('hurt', 8, true, [Fr(ms(8), slimeFrame(16, 12, false, false, true)), Fr(ms(8), slimeFrame(16, 11, true))]),
      D('death', 8, false, [Fr(ms(8), slimeFrame(16, 12, false, false, true)), Fr(ms(8), slimeFrame(18, 8, true)), Fr(ms(8), slimeFrame(20, 5, true)), Fr(ms(8), slimeFrame(22, 3, true))])
    ] };
  }

  /* ---------- BAT ---------- */
  function batFrame(flap, hurt) {
    return (buf, W, H) => {
      const api = apiFor(buf, W, H), cx = 16, cy = 14 + (flap === 1 ? -2 : 0);
      PF.Pixel.shadowFlat(api, cx, 28, 4);
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
      D('fly', 12, true, [Fr(ms(12), batFrame(0)), Fr(ms(12), batFrame(1)), Fr(ms(12), batFrame(2)), Fr(ms(12), batFrame(1))]),
      D('hurt', 8, true, [Fr(ms(8), batFrame(1, true)), Fr(ms(8), batFrame(2))]),
      D('death', 8, false, [Fr(ms(8), batFrame(1, true)), Fr(ms(8), batFrame(2, true)), Fr(ms(8), (buf, W, H) => { const api = apiFor(buf, W, H); PF.Pixel.shadowFlat(api, 16, 28, 4); api.ellipse(12, 22, 20, 27, '#3a4466', true); finish(buf, W, H); })])
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
      D('float', 6, true, [0, 1, 2, 3].map(i => Fr(ms(6), ghostFrame(i / 4)))),
      D('hurt', 8, true, [Fr(ms(8), ghostFrame(0, true)), Fr(ms(8), ghostFrame(0.25))]),
      D('vanish', 8, false, [0.2, 0.45, 0.7, 0.95].map(v => Fr(ms(8), ghostFrame(0, false, v))))
    ] };
  }

  /* ---------- MUSHROOM ---------- */
  function mushroomFrame(squash, step, hurt) {
    return (buf, W, H) => {
      const api = apiFor(buf, W, H), cx = 16 + (step || 0), gy = 26;
      PF.Pixel.shadowFlat(api, cx, 28, 6);
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
      D('idle', 6, true, [Fr(ms(6), mushroomFrame(false)), Fr(ms(6), mushroomFrame(true)), Fr(ms(6), mushroomFrame(false)), Fr(ms(6), mushroomFrame(true))]),
      D('walk', 8, true, [Fr(ms(8), mushroomFrame(false, -1)), Fr(ms(8), mushroomFrame(true, 0)), Fr(ms(8), mushroomFrame(false, 1)), Fr(ms(8), mushroomFrame(true, 0))]),
      D('hurt', 8, true, [Fr(ms(8), mushroomFrame(false, 0, true)), Fr(ms(8), mushroomFrame(true))]),
      D('death', 8, false, [Fr(ms(8), mushroomFrame(false, 0, true)), Fr(ms(8), mushroomFrame(true, 0, true)), Fr(ms(8), (buf, W, H) => { const api = apiFor(buf, W, H); PF.Pixel.shadowFlat(api, 16, 28, 6); api.ellipse(10, 22, 22, 26, '#a22633', true); finish(buf, W, H); })])
    ] };
  }

  /* ---------- GOLEM ---------- */
  function golemFrame(pose, hurt) {
    return (buf, W, H) => {
      const api = apiFor(buf, W, H), cx = 16;
      const R1 = hurt ? '#ffffff' : '#8b9bb4', R2 = hurt ? '#e8e8e8' : '#5a6988', R3 = '#3a4466', Eye = '#2ce8f5';
      PF.Pixel.shadowFlat(api, cx, 29, 8);
      const bob = pose.bob || 0, Y = y => y + bob;
      // legs: heavy blocks
      api.rect(10, Y(22 + (pose.legDy || 0)), 14, Y(27), R2); api.rect(17, Y(22 - (pose.legDy || 0)), 21, Y(27), R2);
      api.rect(10, Y(26), 14, Y(27), R3); api.rect(17, Y(26), 21, Y(27), R3);
      // torso: big rock
      api.rect(8, Y(13), 23, Y(22), R1);
      api.rect(20, Y(13), 23, Y(22), R2);
      api.rect(8, Y(13), 11, Y(22), R2);
      // cracks
      api.line(14, Y(14), 16, Y(17), R3, 1); api.line(16, Y(17), 15, Y(20), R3, 1);
      // core crystal
      api.rect(14, Y(16), 17, Y(19), Eye); api.px(15, Y(17), '#ffffff');
      // arms: boulders
      const aDy = pose.armDy || 0, aDx = pose.armDx || 0;
      api.rect(3 + aDx, Y(13 + aDy), 7 + aDx, Y(21 + aDy), R2);
      api.rect(24 - aDx, Y(13 - aDy), 28 - aDx, Y(21 - aDy), R2);
      api.rect(3 + aDx, Y(19 + aDy), 7 + aDx, Y(21 + aDy), R3);
      api.rect(24 - aDx, Y(19 - aDy), 28 - aDx, Y(21 - aDy), R3);
      // head: small slab + glowing eyes
      api.rect(11, Y(5), 20, Y(12), R1);
      api.rect(18, Y(5), 20, Y(12), R2);
      api.rect(12, Y(8), 14, Y(9), Eye); api.rect(17, Y(8), 19, Y(9), Eye);
      api.rect(12, Y(5), 19, Y(6), R3); // brow
      // moss
      api.px(9, Y(14), '#63c74d'); api.px(22, Y(16), '#63c74d'); api.px(13, Y(6), '#63c74d');
      finish(buf, W, H);
    };
  }
  function golemSuite() {
    const walk = [0, 1, 2, 3].map(i => { const s = Math.sin((i / 4) * Math.PI * 2); return Fr(ms(8), golemFrame({ bob: Math.round(-Math.abs(s)), legDy: Math.round(s * 2), armDy: Math.round(-s * 2) })); });
    return { width: 32, height: 32, name: 'golem', layers: [{ name: 'Body' }], states: [
      D('idle', 6, true, [Fr(ms(6), golemFrame({})), Fr(ms(6), golemFrame({ bob: -1 })), Fr(ms(6), golemFrame({})), Fr(ms(6), golemFrame({ bob: -1 }))]),
      D('walk', 8, true, walk),
      D('attack', 10, true, [Fr(ms(10), golemFrame({ armDy: -4, armDx: -1 })), Fr(ms(10), golemFrame({ armDy: -1 })), Fr(ms(10), golemFrame({ armDy: 3, armDx: 2 })), Fr(ms(10), golemFrame({})), Fr(ms(10), golemFrame({ bob: -1 }))]),
      D('hurt', 8, true, [Fr(ms(8), golemFrame({}, true)), Fr(ms(8), golemFrame({}))]),
      D('death', 8, false, [Fr(ms(8), golemFrame({}, true)), Fr(ms(8), golemFrame({ bob: 3 })), Fr(ms(8), golemFrame({ bob: 6 })), Fr(ms(8), (buf, W, H) => { const api = apiFor(buf, W, H); PF.Pixel.shadowFlat(api, 16, 28, 9); api.rect(6, 22, 12, 26, '#5a6988'); api.rect(14, 24, 20, 27, '#8b9bb4'); api.rect(22, 23, 27, 26, '#3a4466'); api.rect(15, 22, 17, 24, '#2ce8f5'); finish(buf, W, H); })])
    ] };
  }

  /* ---------- CHICKEN ---------- */
  function chickenFrame(pose) {
    return (buf, W, H) => {
      const api = apiFor(buf, W, H), cx = 16 + (pose.dx || 0);
      PF.Pixel.shadowFlat(api, cx, 28, 4);
      const B = '#ffffff', Sh = '#c0cbdc', Comb = '#e43b44', Beak = '#feae34', Leg = '#feae34';
      const hop = pose.hop || 0, Y = y => y - hop;
      // legs
      api.line(cx - 2, Y(24), cx - 2, Y(28), Leg, 1); api.line(cx + 2, Y(24), cx + 2, Y(28 - (pose.lift || 0)), Leg, 1);
      // body
      api.ellipse(cx - 6, Y(16), cx + 5, Y(25), B, true);
      api.ellipse(cx + 1, Y(18), cx + 5, Y(25), Sh, true);
      // wing
      api.ellipse(cx - 5, Y(18 + (pose.wing || 0)), cx, Y(23 + (pose.wing || 0)), Sh, true);
      // tail
      api.line(cx - 6, Y(18), cx - 9, Y(15), B, 2);
      // head
      api.ellipse(cx + 1, Y(9), cx + 8, Y(17), B, true);
      api.rect(cx + 3, Y(6), cx + 5, Y(9), Comb); api.px(cx + 6, Y(7), Comb);
      api.px(cx + 5, Y(11), '#181425');
      const peck = pose.peck ? 3 : 0;
      api.line(cx + 8, Y(13 + peck), cx + 11, Y(14 + peck), Beak, 2);
      finish(buf, W, H);
    };
  }
  function chickenSuite() {
    return { width: 32, height: 32, name: 'chicken', layers: [{ name: 'Body' }], states: [
      D('idle', 6, true, [Fr(ms(6), chickenFrame({})), Fr(ms(6), chickenFrame({ wing: 1 }))]),
      D('walk', 8, true, [Fr(ms(8), chickenFrame({ hop: 0 })), Fr(ms(8), chickenFrame({ hop: 1, lift: 2 })), Fr(ms(8), chickenFrame({ hop: 0 })), Fr(ms(8), chickenFrame({ hop: 1, lift: 2, dx: 1 }))]),
      D('peck', 8, true, [Fr(ms(8), chickenFrame({})), Fr(ms(8), chickenFrame({ peck: true })), Fr(ms(8), chickenFrame({ peck: true }))]),
      D('death', 8, false, [Fr(ms(8), chickenFrame({ hop: 0 })), Fr(ms(8), (buf, W, H) => { const api = apiFor(buf, W, H); PF.Pixel.shadowFlat(api, 16, 28, 5); api.ellipse(9, 21, 23, 27, '#c0cbdc', true); api.px(12, 23, '#181425'); finish(buf, W, H); })])
    ] };
  }

  /* ---------- WOLF ---------- */
  function wolfFrame(gallop, hurt, lying) {
    return (buf, W, H) => {
      const api = apiFor(buf, W, H), cx = 16;
      if (lying) {
        PF.Pixel.shadowFlat(api, cx, 28, 8);
        api.ellipse(6, 20, 26, 27, hurt === 'dead' ? '#5a6988' : '#8b9bb4', true);
        api.ellipse(18, 16, 26, 23, hurt === 'dead' ? '#5a6988' : '#8b9bb4', true);
        api.px(21, 19, '#181425');
        finish(buf, W, H); return;
      }
      const F = hurt ? '#ffffff' : '#8b9bb4', Dk = hurt ? '#e8e8e8' : '#5a6988', belly = '#c0cbdc';
      PF.Pixel.shadowFlat(api, cx, 28, 8);
      const bY = gallop !== undefined ? Math.round(Math.sin(gallop * Math.PI * 2) * -1.5) : 0;
      const legSwing = gallop !== undefined ? Math.sin(gallop * Math.PI * 2) : 0;
      const Y = y => y + bY;
      // legs (4)
      const l1 = Math.round(legSwing * 3), l2 = Math.round(-legSwing * 3);
      api.rect(7 + l1, Y(22), 9 + l1, Y(27), Dk); api.rect(12 + l2, Y(22), 14 + l2, Y(27), F);
      api.rect(19 + l2, Y(22), 21 + l2, Y(27), F); api.rect(23 + l1, Y(22), 25 + l1, Y(27), Dk);
      // body
      api.rect(6, Y(15), 25, Y(22), F);
      api.rect(6, Y(20), 25, Y(22), belly);
      api.rect(6, Y(15), 8, Y(22), Dk);
      // tail
      api.line(6, Y(16), 2, Y(12 + Math.round(legSwing * 2)), Dk, 2);
      api.px(2, Y(12 + Math.round(legSwing * 2)), belly);
      // head (right)
      api.rect(22, Y(9), 29, Y(16), F);
      api.line(22, Y(9), 24, Y(6), F, 2); api.line(27, Y(9), 29, Y(6), F, 2); // ears
      api.px(24, Y(7), '#f6757a'); api.px(28, Y(7), '#f6757a');
      api.px(26, Y(12), hurt ? '#181425' : '#ff0044'); // eye
      api.rect(29, Y(13), 30, Y(15), belly); // snout
      api.px(30, Y(14), '#181425'); // nose
      // teeth
      api.px(29, Y(16), '#ffffff');
      finish(buf, W, H);
    };
  }
  function wolfSuite() {
    return { width: 32, height: 32, name: 'wolf', layers: [{ name: 'Body' }], states: [
      D('idle', 6, true, [0, 1, 2, 1].map(i => Fr(ms(6), wolfFrame(i / 4 === 0 ? 0 : undefined)))),
      D('run', 12, true, [0, 1, 2, 3, 4, 5].map(i => Fr(ms(12), wolfFrame(i / 6)))),
      D('attack', 12, true, [Fr(ms(12), wolfFrame(0.1)), Fr(ms(12), wolfFrame(0.3)), Fr(ms(12), wolfFrame(0.5))]),
      D('hurt', 8, true, [Fr(ms(8), wolfFrame(undefined, true)), Fr(ms(8), wolfFrame(0))]),
      D('death', 8, false, [Fr(ms(8), wolfFrame(undefined, true)), Fr(ms(8), wolfFrame(undefined, false, true)), Fr(ms(8), wolfFrame(undefined, 'dead', true))])
    ] };
  }

  /* ---------- BOAR ---------- */
  function boarFrame(step, hurt, attack, lying) {
    return (buf, W, H) => {
      const api = apiFor(buf, W, H), cx = 16;
      if (lying) {
        PF.Pixel.shadowFlat(api, cx, 28, 8);
        api.ellipse(8, 20, 24, 27, '#733e39', true);
        api.px(22, 19, '#181425');
        api.px(24, 21, '#ffffff');
        finish(buf, W, H); return;
      }
      PF.Pixel.shadowFlat(api, cx, 28, 8);
      const bY = step !== undefined ? Math.round(Math.sin(step * Math.PI * 2) * -1.5) : 0;
      const s = step !== undefined ? Math.sin(step * Math.PI * 2) : 0;
      const Y = y => y + bY;
      const F = hurt ? '#ffffff' : '#733e39', Dk = hurt ? '#e8e8e8' : '#3e2731', snout = '#e8b796';
      // legs
      const l1 = Math.round(s * 3), l2 = Math.round(-s * 3);
      api.rect(8 + l1, Y(23), 10 + l1, Y(27), Dk); api.rect(13 + l2, Y(23), 15 + l2, Y(27), F);
      api.rect(18 + l2, Y(23), 20 + l2, Y(27), F); api.rect(23 + l1, Y(23), 25 + l1, Y(27), Dk);
      // body
      api.ellipse(6, Y(14), 24, Y(23), F, true);
      api.rect(8, Y(11), 16, Y(14), Dk);
      // tail
      api.line(6, Y(17), 4, Y(15), Dk, 1); api.px(5, Y(14), Dk);
      // head
      const hx = attack ? 24 : 22, hy = attack ? Y(14) : Y(12);
      api.rect(hx - 2, hy - 1, hx + 5, hy + 6, F);
      api.px(hx, hy - 2, Dk); api.px(hx + 1, hy - 3, Dk);
      api.px(hx + 2, hy + 1, '#181425'); api.px(hx + 2, hy, '#ffffff');
      api.rect(hx + 5, hy + 2, hx + 7, hy + 5, snout);
      api.px(hx + 7, hy + 3, '#181425');
      api.line(hx + 5, hy + 5, hx + 7, hy + 2, '#ffffff', 1);
      if (attack) PF.Pixel.sparks(api, hx + 8, hy + 4, 1, '#fee761', 4);
      finish(buf, W, H);
    };
  }
  function boarSuite() {
    return { width: 32, height: 32, name: 'boar', layers: [{ name: 'Body' }], states: [
      D('idle', 6, true, [0, 1, 2, 1].map(i => Fr(ms(6), boarFrame(i / 4 === 0 ? 0 : undefined)))),
      D('trot', 8, true, [0, 1, 2, 3].map(i => Fr(ms(8), boarFrame(i / 4)))),
      D('charge', 12, true, [0, 1, 2, 3].map(i => Fr(ms(12), boarFrame(i / 4, false, true)))),
      D('hurt', 8, true, [Fr(ms(8), boarFrame(undefined, true)), Fr(ms(8), boarFrame(0))]),
      D('death', 8, false, [Fr(ms(8), boarFrame(undefined, true)), Fr(ms(8), boarFrame(undefined, false, false, true))])
    ] };
  }

  /* ---------- DRAKE / BABY DRAGON ---------- */
  function drakeFrame(flap, breath, hurt, sleep) {
    return (buf, W, H) => {
      const api = apiFor(buf, W, H), cx = 16;
      if (sleep) {
        PF.Pixel.shadowFlat(api, cx, 28, 7);
        api.ellipse(8, 18, 24, 27, '#a22633', true);
        api.ellipse(10, 20, 22, 26, '#ffd34e', true);
        api.px(21, 20, '#181425');
        api.px(24, 14, '#f77622');
        finish(buf, W, H); return;
      }
      const cy = 15 + (flap === 1 ? -2 : 0);
      PF.Pixel.shadowFlat(api, cx, 28, 5);
      const R = hurt ? '#ffffff' : '#e43b44', Dk = hurt ? '#e8e8e8' : '#a22633', belly = '#ffd34e', wing = '#f77622';
      api.ellipse(cx - 5, cy - 4, cx + 5, cy + 6, R, true);
      api.ellipse(cx - 2, cy - 1, cx + 4, cy + 5, belly, true);
      const wy = flap === 0 ? cy - 8 : flap === 2 ? cy - 1 : cy - 5;
      api.line(cx - 2, cy - 2, cx - 8, wy, wing, 2);
      api.line(cx - 8, wy, cx - 5, wy + 4, wing, 1);
      api.line(cx + 2, cy - 2, cx + 8, wy, wing, 2);
      api.line(cx + 8, wy, cx + 5, wy + 4, wing, 1);
      api.ellipse(cx + 2, cy - 7, cx + 9, cy - 1, R, true);
      api.line(cx + 3, cy - 7, cx + 1, cy - 11, '#fee761', 1);
      api.px(cx + 6, cy - 5, hurt ? '#181425' : '#fee761');
      api.px(cx + 6, cy - 6, '#181425');
      api.rect(cx + 8, cy - 4, cx + 11, cy - 2, R);
      api.px(cx + 10, cy - 3, '#181425');
      api.line(cx - 5, cy + 3, cx - 11, cy + 5, R, 2);
      api.px(cx - 12, cy + 4, '#fee761');
      if (breath) {
        api.ellipse(cx + 12, cy - 4, cx + 18, cy - 1, '#f07b2d', true);
        api.ellipse(cx + 14, cy - 3, cx + 17, cy - 2, '#ffe27a', true);
        api.px(cx + 19, cy - 3, '#ffffff');
      }
      finish(buf, W, H);
    };
  }
  function drakeSuite() {
    return { width: 32, height: 32, name: 'drake', layers: [{ name: 'Body' }], states: [
      D('idle', 6, true, [Fr(ms(6), drakeFrame(0)), Fr(ms(6), drakeFrame(1)), Fr(ms(6), drakeFrame(2)), Fr(ms(6), drakeFrame(1))]),
      D('fly', 10, true, [Fr(ms(10), drakeFrame(0)), Fr(ms(10), drakeFrame(1)), Fr(ms(10), drakeFrame(2)), Fr(ms(10), drakeFrame(1))]),
      D('fire_breath', 8, true, [Fr(ms(8), drakeFrame(1)), Fr(ms(8), drakeFrame(1, true)), Fr(ms(8), drakeFrame(1, true)), Fr(ms(8), drakeFrame(1))]),
      D('hurt', 8, true, [Fr(ms(8), drakeFrame(1, false, true)), Fr(ms(8), drakeFrame(1))]),
      D('sleep', 4, true, [Fr(ms(4), drakeFrame(0, false, false, true)), Fr(ms(4), drakeFrame(0, false, false, true))])
    ] };
  }

  return { slimeSuite, batSuite, ghostSuite, mushroomSuite, golemSuite, chickenSuite, wolfSuite, boarSuite, drakeSuite };
})();

