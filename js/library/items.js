/* PixelForge Studio — Items, weapons, pickups & FX: coin spin, potions, food,
   weapons rack, hearts, slash / hit / dust / level-up effects. */
window.PF = window.PF || {};
PF.Items = (() => {
  const D = (name, fps, loop, frames) => ({ name, fps, loop, frames });
  const Fr = (duration, paint) => ({ duration, paint });
  const ms = fps => Math.round(1000 / fps);
  const apiFor = (buf, W, H) => PF.Pixel.makeApi(buf, W, H);
  const finish = (buf, W, H) => buf.set(PF.Raster.outline(buf, W, H, PF.Color.hexToU32('#181425')));

  /* ---------- COIN & GEM ---------- */
  function coinSuite() {
    const widths = [12, 8, 4, 2, 4, 8];
    const frames = widths.map(w => Fr(ms(12), (buf, W, H) => {
      const api = apiFor(buf, W, H), x = 16 - w / 2;
      api.ellipse(x, 10, x + w - 1, 21, '#feae34', true);
      if (w >= 4) api.ellipse(x + 1, 11, x + w - 2, 20, '#fee761', false);
      if (w >= 8) { api.line(x + 3, 13, x + 3, 18, '#ffffff', 1); api.rect(x + 4, 13, x + w - 4, 18, '#feae34'); api.px(16, 15, '#fee761'); api.px(16, 17, '#fee761'); }
      finish(buf, W, H);
    }));
    const gem = [0, 1, 2, 3].map(t => Fr(ms(6), (buf, W, H) => {
      const api = apiFor(buf, W, H), bob = t === 2 ? -1 : 0;
      api.ellipse(10, 10 + bob, 21, 22 + bob, '#0099db', true);
      api.ellipse(12, 10 + bob, 19, 15 + bob, '#2ce8f5', true);
      api.px(13, 12 + bob, '#ffffff'); api.px(15, 13 + bob, '#ffffff');
      api.rect(10, 16 + bob, 21, 17 + bob, '#124e89');
      if (t === 1 || t === 3) { api.px(6, 12, '#ffffff'); api.px(25, 15, '#ffffff'); }
      finish(buf, W, H);
    }));
    return { width: 32, height: 32, name: 'coin-gem', layers: [{ name: 'Body' }],
      states: [D('spin', 12, true, frames), D('gem', 6, true, gem)] };
  }

  /* ---------- POTIONS & FOOD (one state each, single/multi frame) ---------- */
  function paintPotion(color, cap) {
    return (buf, W, H) => {
      const api = apiFor(buf, W, H);
      PF.Pixel.shadowFlat(api, 16, 28, 5);
      api.rect(13, 6, 18, 10, '#c28569'); // neck
      api.rect(12, 4, 19, 6, cap); // cork
      api.ellipse(9, 10, 22, 26, '#c0cbdc', true); // glass
      api.ellipse(10, 14, 21, 25, color, true); // liquid
      api.rect(11, 15, 13, 22, '#ffffff'); // shine
      api.px(17, 16, '#ffffff');
      finish(buf, W, H);
    };
  }
  function paintFood(kind) {
    return (buf, W, H) => {
      const api = apiFor(buf, W, H);
      PF.Pixel.shadowFlat(api, 16, 28, 5);
      if (kind === 'apple') { api.ellipse(10, 12, 21, 25, '#e43b44', true); api.ellipse(12, 13, 16, 18, '#f6757a', true); api.line(16, 12, 16, 8, '#3e8948', 2); api.ellipse(17, 8, 20, 10, '#63c74d', true); }
      else if (kind === 'bread') { api.ellipse(8, 14, 23, 24, '#b86f50', true); api.ellipse(10, 15, 21, 21, '#ead4aa', true); api.line(12, 14, 12, 24, '#733e39', 1); api.line(16, 14, 16, 24, '#733e39', 1); api.line(20, 14, 20, 24, '#733e39', 1); }
      else if (kind === 'meat') { api.ellipse(9, 12, 20, 22, '#b86f50', true); api.ellipse(11, 13, 18, 20, '#f6757a', true); api.line(19, 18, 24, 23, '#ead4aa', 3); api.ellipse(22, 21, 26, 26, '#ffffff', true); }
      else if (kind === 'carrot') { api.line(16, 12, 10, 25, '#f77622', 4); api.line(16, 12, 15, 7, '#63c74d', 2); api.line(16, 12, 18, 8, '#3e8948', 2); }
      else if (kind === 'cheese') { api.line(8, 24, 23, 24, '#feae34', 1); api.line(8, 24, 8, 18, '#feae34', 1); api.line(8, 18, 23, 24, '#fee761', true); api.px(13, 21, '#feae34'); api.px(17, 19, '#feae34'); }
      else if (kind === 'key') { api.ellipse(11, 9, 17, 15, '#fee761', true); api.ellipse(12, 10, 16, 14, '#181425', true); api.line(16, 14, 16, 25, '#fee761', 2); api.line(16, 22, 20, 22, '#fee761', 2); api.line(16, 25, 20, 25, '#fee761', 2); }
      else if (kind === 'heart') { const R = '#e43b44', L = '#f6757a', Dk = '#a22633';
        api.rect(8, 10, 14, 14, R); api.rect(17, 10, 23, 14, R); api.ellipse(7, 12, 24, 22, R, true);
        api.rect(9, 11, 11, 15, L); api.rect(18, 11, 19, 13, L); api.line(12, 22, 19, 22, Dk, 1); }
      else if (kind === 'wood') { api.line(8, 22, 22, 22, '#733e39', 3); api.line(10, 18, 24, 18, '#b86f50', 3); api.line(9, 14, 20, 14, '#733e39', 2); api.ellipse(22, 16, 25, 20, '#ead4aa', true); api.ellipse(9, 20, 12, 24, '#ead4aa', true); }
      else if (kind === 'stone') { api.ellipse(9, 16, 22, 25, '#8b9bb4', true); api.ellipse(11, 17, 17, 22, '#c0cbdc', true); api.px(18, 22, '#5a6988'); }
      finish(buf, W, H);
    };
  }
  function consumablesSuite() {
    const potions = [['hp', '#e43b44', '#733e39'], ['mp', '#0099db', '#124e89'], ['poison', '#63c74d', '#265c42'], ['gold', '#fee761', '#b86f50']];
    const states = potions.map(([n, c, cap]) => D('potion_' + n, 1, true, [Fr(500, paintPotion(c, cap))]));
    for (const f of ['apple', 'bread', 'meat', 'carrot', 'cheese', 'key', 'heart', 'wood', 'stone']) states.push(D(f, 1, true, [Fr(500, paintFood(f))]));
    // heart pulse (2f: bob down 1px + sparkle)
    states.push(D('heart_pulse', 4, true, [Fr(ms(4), paintFood('heart')), Fr(ms(4), (buf, W, H) => {
      paintFood('heart')(buf, W, H);
      buf.set(PF.Raster.shift(buf, W, H, 0, 1, false));
      const api = apiFor(buf, W, H);
      api.px(6, 9, '#ffffff'); api.px(25, 11, '#ffffff');
    })]));
    return { width: 32, height: 32, name: 'consumables', layers: [{ name: 'Body' }], states };
  }

  /* ---------- WEAPONS RACK ---------- */
  function weaponsSuite() {
    const weapon = (kind) => (buf, W, H) => {
      const api = apiFor(buf, W, H);
      if (kind === 'sword') {
        api.line(16, 26, 16, 8, '#c0cbdc', 3); api.line(16, 26, 16, 8, '#ffffff', 1);
        api.line(10, 26, 22, 26, '#feae34', 2); api.rect(14, 27, 18, 30, '#733e39'); api.px(16, 30, '#feae34');
        api.px(16, 8, '#ffffff');
      } else if (kind === 'pickaxe') {
        api.line(16, 28, 16, 8, '#b86f50', 2);
        api.line(7, 8, 25, 8, '#8b9bb4', 2); api.line(7, 8, 9, 11, '#8b9bb4', 2); api.line(25, 8, 23, 11, '#8b9bb4', 2);
      } else if (kind === 'axe') {
        api.line(15, 28, 15, 6, '#b86f50', 2);
        api.rect(15, 6, 23, 14, '#c0cbdc'); api.rect(15, 6, 17, 14, '#ffffff');
      } else if (kind === 'bow') {
        api.ellipse(11, 5, 21, 27, '#b86f50', false); api.line(11, 5, 11, 27, '#ead4aa', 1);
        api.line(8, 16, 18, 16, '#c28569', 1); api.rect(16, 15, 19, 17, '#8b9bb4');
      } else if (kind === 'shield') {
        api.ellipse(9, 6, 22, 27, '#124e89', true); api.ellipse(11, 8, 20, 25, '#0099db', true);
        api.rect(14, 12, 17, 20, '#fee761'); api.px(15, 15, '#e43b44'); api.px(16, 16, '#e43b44');
        api.rect(9, 6, 22, 9, '#8b9bb4');
      } else if (kind === 'staff') {
        api.line(16, 28, 16, 8, '#b86f50', 2); api.ellipse(12, 3, 20, 10, '#b55088', true); api.px(16, 6, '#ffffff'); api.px(14, 5, '#f6757a');
      } else if (kind === 'arrow') {
        api.line(6, 16, 24, 16, '#c28569', 1); api.rect(22, 14, 27, 18, '#8b9bb4'); api.rect(4, 14, 8, 18, '#e43b44');
      } else if (kind === 'bomb') {
        api.ellipse(9, 12, 22, 26, '#3a4466', true); api.px(12, 15, '#8b9bb4');
        api.line(16, 12, 20, 6, '#b86f50', 1); api.px(21, 5, '#fee761'); api.px(22, 4, '#f77622');
      }
      finish(buf, W, H);
    };
    return { width: 32, height: 32, name: 'weapons', layers: [{ name: 'Body' }],
      states: ['sword', 'pickaxe', 'axe', 'bow', 'shield', 'staff', 'arrow', 'bomb'].map(n => D(n, 1, true, [Fr(500, weapon(n))])) };
  }

  /* ---------- FX ---------- */
  function fxSuite() {
    const slashFrames = [0, 1, 2, 3].map(i => Fr(ms(12), (buf, W, H) => {
      const api = apiFor(buf, W, H), t = i / 4;
      PF.Pixel.slash(api, 16, 16, 4 + t * 7, -0.9 + t * 0.5, 0.6 + t * 0.5, i === 3 ? '#2ce8f5' : '#ffffff', 2);
    }));
    const hitFrames = [0, 1, 2].map(i => Fr(ms(12), (buf, W, H) => {
      const api = apiFor(buf, W, H);
      PF.Pixel.sparks(api, 16, 16, i, i === 0 ? '#fee761' : i === 1 ? '#ffffff' : '#f77622', 8, 2 + i, 6 + i * 2);
    }));
    const dustFrames = [0, 1, 2].map(i => Fr(ms(10), (buf, W, H) => {
      const api = apiFor(buf, W, H);
      const r = 3 + i * 3;
      for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2 + i; api.px(16 + Math.cos(a) * r, 22 + Math.sin(a) * r * 0.4, k % 2 ? '#c0cbdc' : '#8b9bb4'); }
      api.px(16, 22 - i, '#ffffff');
    }));
    const levelFrames = [0, 1, 2, 3].map(i => Fr(ms(10), (buf, W, H) => {
      const api = apiFor(buf, W, H), t = i / 4;
      PF.Pixel.particles(api, 16, 20, 9, t, ['#fee761', '#ffffff', '#2ce8f5'], 8);
      api.line(10, 24, 22, 24, '#fee761', 1);
    }));
    const healFrames = [0, 1, 2, 3].map(i => Fr(ms(8), (buf, W, H) => {
      const api = apiFor(buf, W, H);
      const y = 24 - i * 3;
      api.px(14, y, '#63c74d'); api.px(15, y, '#63c74d'); api.px(16, y - 1, '#63c74d'); api.px(16, y + 1, '#63c74d'); api.px(17, y, '#63c74d'); api.px(18, y, '#63c74d');
      api.px(12, y - 4, '#a8f28a'); api.px(19, y - 2, '#a8f28a');
    }));
    return { width: 32, height: 32, name: 'fx', layers: [{ name: 'FX' }],
      states: [D('slash', 12, true, slashFrames), D('hit', 12, true, hitFrames), D('dust', 10, true, dustFrames), D('levelup', 10, true, levelFrames), D('heal', 8, true, healFrames)] };
  }

  /* ---------- HEARTS UI BAR ---------- */
  function heartsSuite() {
    const bar = (hp) => (buf, W, H) => {
      const api = apiFor(buf, W, H);
      for (let i = 0; i < 5; i++) {
        const x = 2 + i * 6, full = i < hp;
        const Rc = full ? '#e43b44' : '#3a4466';
        api.rect(x, 2, x + 3, 4, Rc); api.rect(x, 3, x + 4, 6, Rc);
        if (full) { api.px(x, 3, '#f6757a'); }
      }
      // stamina + xp bars
      api.rect(2, 9, 29, 11, '#3a4466'); api.rect(2, 9, 20, 11, '#63c74d');
      api.rect(2, 13, 29, 14, '#3a4466'); api.rect(2, 13, 14, 14, '#2ce8f5');
    };
    return { width: 32, height: 32, name: 'hud-hearts', layers: [{ name: 'UI' }],
      states: [D('hp5', 1, true, [Fr(500, bar(5))]), D('hp3', 1, true, [Fr(500, bar(3))]), D('hp1', 1, true, [Fr(500, bar(1))]), D('hp0', 1, true, [Fr(500, bar(0))])] };
  }

  /* ---------- MAGIC SPELLS FX ---------- */
  function spellsSuite() {
    const fireballFrames = [0, 1, 2, 3].map(i => Fr(ms(10), (buf, W, H) => {
      const api = apiFor(buf, W, H);
      if (i < 2) {
        const x = 8 + i * 8, y = 16;
        api.ellipse(x - 5, y - 4, x + 4, y + 4, '#f07b2d', true);
        api.ellipse(x - 2, y - 2, x + 3, y + 2, '#ffe27a', true);
        api.px(x + 4, y, '#ffffff');
        api.line(x - 6, y, x - 10, y - 2, '#a22633', 2);
        api.line(x - 6, y, x - 11, y + 2, '#a22633', 2);
      } else {
        const x = 20, y = 16, r = 4 + (i - 2) * 5;
        api.ellipse(x - r, y - r, x + r, y + r, '#f07b2d', true);
        api.ellipse(x - r + 2, y - r + 2, x + r - 2, y + r - 2, '#ffe27a', true);
        PF.Pixel.sparks(api, x, y, i, '#ffffff', 8, r, r + 4);
      }
    }));
    const boltFrames = [0, 1, 2].map(i => Fr(ms(10), (buf, W, H) => {
      const api = apiFor(buf, W, H);
      const shift = i === 1 ? 1 : 0;
      api.line(16 + shift, 2, 12, 10, '#ffffff', 2);
      api.line(12, 10, 20, 18, '#2ce8f5', 2);
      api.line(20, 18, 14, 28, '#0099db', 2);
      api.line(16 + shift, 2, 12, 10, '#ffffff', 1);
      api.line(12, 10, 20, 18, '#ffffff', 1);
      PF.Pixel.sparks(api, 14, 28, i, '#fee761', 6, 2, 6);
    }));
    const iceFrames = [0, 1, 2, 3].map(i => Fr(ms(8), (buf, W, H) => {
      const api = apiFor(buf, W, H);
      const r = 3 + i * 3;
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI * 2;
        const x = 16 + Math.cos(a) * r, y = 16 + Math.sin(a) * r;
        api.line(16, 16, x, y, '#0099db', 1);
        api.px(x, y, '#2ce8f5');
        api.px(x + Math.cos(a) * 2, y + Math.sin(a) * 2, '#ffffff');
      }
    }));
    const auraFrames = [0, 1, 2, 3].map(i => Fr(ms(8), (buf, W, H) => {
      const api = apiFor(buf, W, H);
      const a = (i / 4) * Math.PI * 2;
      api.ellipse(7, 7, 25, 25, '#fee761', false);
      api.ellipse(9, 9, 23, 23, '#ffffff', false);
      for (let k = 0; k < 4; k++) {
        const rot = a + (k / 4) * Math.PI * 2;
        api.px(16 + Math.cos(rot) * 9, 16 + Math.sin(rot) * 9, '#fee761');
        api.px(16 + Math.cos(rot) * 11, 16 + Math.sin(rot) * 11, '#ffffff');
      }
    }));
    return { width: 32, height: 32, name: 'spells', layers: [{ name: 'FX' }],
      states: [D('fireball', 10, true, fireballFrames), D('lightning', 10, true, boltFrames), D('ice_nova', 8, true, iceFrames), D('holy_shield', 8, true, auraFrames)] };
  }

  return { coinSuite, consumablesSuite, weaponsSuite, fxSuite, heartsSuite, spellsSuite };
})();

