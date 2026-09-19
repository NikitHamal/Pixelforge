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
  /* Every item here used to be one or two axis-aligned bars: the axe was a
     white rectangle on a stick, the bow was an oval with a cross through it,
     the arrow was two coloured squares on a line. Rebuilt as real objects —
     blades taper and carry a fuller, the axe has a flared bit and a back
     spur, the bow's limbs curve away from a STRAIGHT string, the arrow is
     fletched and set on the diagonal where a 32px cell gives it the most
     length. Three tones minimum on every part, light from the upper left. */
  function weaponsSuite() {
    const ST = '#c0cbdc', SThi = '#e9f1fb', STsh = '#7a879e', STdk = '#4d5a76';
    const WD = '#8a5a3b', WDh = '#b07c4e', WDs = '#5e3a24';
    const GD = '#feae34', GDh = '#fee761', GDs = '#c06a1e';

    /* A blade as a vertical solid: `tip` rows taper to the point, the left
       column takes the light, a fuller runs down the middle and the right
       column falls into shadow. */
    const blade = (api, x0, x1, yTop, yBot, tip) => {
      const mid = (x0 + x1) >> 1;
      for (let y = yTop; y <= yBot; y++) {
        const k = y < yTop + tip ? Math.round(((yTop + tip - y) / tip) * ((x1 - x0) / 2)) : 0;
        const a = x0 + k, b = x1 - k;
        if (a > b) continue;
        api.rect(a, y, b, y, ST);
        api.px(a, y, SThi);
        api.px(b, y, STsh);
        if (b - a >= 4 && y > yTop + tip) api.px(mid, y, STsh);   // fuller
      }
    };

    const weapon = (kind) => (buf, W, H) => {
      const api = apiFor(buf, W, H);
      if (kind === 'sword') {
        blade(api, 13, 17, 4, 21, 5);
        api.rect(8, 22, 23, 23, GD);                     // crossguard
        api.rect(8, 22, 23, 22, GDh); api.rect(8, 23, 23, 23, GDs);
        api.px(7, 23, GDs); api.px(24, 23, GDs);         // flared quillon tips
        api.px(8, 21, GDh); api.px(23, 21, GDs);
        api.rect(14, 24, 17, 29, '#5e3a24');             // wrapped grip
        api.rect(14, 24, 14, 29, '#8a5a3b');
        for (const gy of [25, 27]) api.rect(14, gy, 17, gy, '#3a2011');
        api.rect(13, 29, 18, 30, GD);                    // pommel
        api.rect(14, 29, 16, 29, GDh); api.rect(13, 30, 18, 30, GDs);
      } else if (kind === 'pickaxe') {
        api.rect(15, 9, 16, 29, WD); api.rect(15, 9, 15, 29, WDh); api.px(16, 29, WDs);
        /* Two curved picks off one eye. Straight arms crossing the haft is a
           plus sign, which is how the old one read. */
        for (let i = 0; i <= 9; i++) {
          const t = i / 9, dx = Math.round(1 + t * 8), dy = Math.round(7 + t * t * 4);
          for (const sgn of [-1, 1]) {
            const x = 16 + sgn * dx;
            api.rect(x, dy, x, dy + 1, sgn < 0 ? ST : STsh);
            api.px(x, dy, sgn < 0 ? SThi : ST);
          }
        }
        api.px(7, 12, SThi); api.px(25, 12, ST);         // sharpened points
        api.rect(14, 6, 17, 10, STdk); api.rect(14, 6, 17, 6, STsh);   // the eye
        api.rect(15, 12, 16, 13, '#3a2011');             // wedge binding
      } else if (kind === 'axe') {
        api.rect(15, 7, 16, 29, WD); api.rect(15, 7, 15, 29, WDh); api.px(16, 29, WDs);
        /* A bit that flares: widest at the middle of the head, curving back to
           the haft top and bottom, with the cutting edge lit. */
        /* Flat against the haft, convex at the edge: that asymmetry IS the
           axe. Flaring the head equally on both sides gave a paddle. */
        for (let y = 5; y <= 19; y++) {
          const f = Math.min(1, Math.sin(((y - 5) / 14) * Math.PI) * 1.45);
          const b = 18 + Math.round(f * 7);
          api.rect(16, y, b, y, ST);
          api.rect(16, y, 17, y, STsh);
          api.px(b, y, SThi); api.px(b - 1, y, '#ffffff');
        }
        api.rect(12, 9, 16, 15, STsh); api.rect(12, 9, 15, 10, ST);    // poll
        api.px(12, 15, STdk);
        api.rect(15, 5, 16, 19, WD); api.rect(15, 5, 15, 19, WDh);     // haft through the eye
        api.rect(14, 8, 17, 8, STdk); api.rect(14, 16, 17, 16, STdk);  // langets
        api.rect(15, 19, 16, 20, '#3a2011');             // leather binding
      } else if (kind === 'bow') {
        /* The string is straight and the LIMBS bend. Drawn the other way
           round — an oval with a stick through it — a bow is a lute. */
        for (let i = 0; i <= 28; i++) {
          const t = i / 28, y = 3 + Math.round(t * 26);
          const x = 21 - Math.round(Math.pow(Math.sin(t * Math.PI), 0.55) * 9.5);
          api.rect(x, y, x + 1, y, WD); api.px(x, y, WDh); api.px(x + 1, y, WDs);
        }
        api.rect(21, 3, 21, 29, '#ead4aa');              // string
        api.px(20, 3, WDs); api.px(20, 29, WDs);         // nocks
        api.rect(11, 13, 13, 19, '#3a2011');             // grip wrap
        api.rect(11, 14, 12, 18, '#5e3a24');
        api.px(14, 16, GD);                              // arrow rest
      } else if (kind === 'shield') {
        /* A heater: flat top, sides falling to a point. An ellipse reads as a
           mirror, and a rectangle reads as a door. */
        const hw = y => y <= 9 ? 9 : Math.max(0, Math.round(9 * Math.sqrt(Math.max(0, 1 - ((y - 9) / 19) * ((y - 9) / 19)))));
        for (let y = 4; y <= 28; y++) {
          const w = hw(y); if (!w) continue;
          api.rect(16 - w, y, 15 + w, y, '#0f4479');
          api.rect(16 - w, y, 17 - w, y, ST);            // steel rim, lit side
          api.rect(14 + w, y, 15 + w, y, STsh);
        }
        api.rect(7, 4, 24, 5, ST); api.rect(7, 4, 24, 4, SThi);       // top band
        for (let y = 7; y <= 22; y++) {                  // sunlit upper-left of the face
          const w = hw(y); if (w < 3) continue;
          api.rect(18 - w, y, 15, y, '#1d68ad');
          if (y < 15) api.rect(18 - w, y, 13, y, '#2f86cf');
        }
        api.rect(14, 10, 17, 22, GD); api.rect(15, 8, 16, 24, GD);    // cross device
        api.rect(14, 10, 17, 10, GDh); api.rect(14, 22, 17, 22, GDs);
        api.rect(13, 14, 18, 18, STsh); api.rect(14, 15, 17, 17, ST); // boss
        api.px(14, 15, '#ffffff'); api.px(17, 17, STdk);
        api.px(9, 25, ST); api.px(22, 25, STsh);         // rivets
      } else if (kind === 'staff') {
        /* A gnarled shaft with a forked head holding the stone. A ball on a
           stick is a lollipop, which is what the old one was. */
        for (let y = 10; y <= 30; y++) {
          const x = 15 + (y > 22 ? 1 : 0) - (y > 27 ? 1 : 0);
          api.rect(x, y, x + 1, y, WD); api.px(x, y, WDh); api.px(x + 1, y, WDs);
        }
        api.rect(14, 24, 17, 25, '#3a2011');             // hand grip
        for (const sgn of [-1, 1]) for (let i = 0; i <= 7; i++) {
          const t = i / 7;
          api.px(15 + Math.round(sgn * (1 + t * 4)), 10 - Math.round(t * 6), i > 4 ? WDh : WD);
          api.px(15 + Math.round(sgn * (1 + t * 4)), 11 - Math.round(t * 6), WDs);
        }
        api.ellipse(13, 2, 19, 9, '#7b2ea8', true);      // the stone
        api.ellipse(13, 2, 18, 7, '#b55088', true);
        api.ellipse(14, 3, 17, 5, '#e59ad0', true);
        api.px(15, 3, '#ffffff'); api.px(17, 8, '#4a1470');
        api.px(11, 4, '#e59ad0'); api.px(21, 7, '#e59ad0'); api.px(16, 0, '#ffffff');
      } else if (kind === 'arrow') {
        /* On the diagonal: a 32px cell gives a shaft 40% more length that
           way, and the fletching has somewhere to go. */
        for (let i = 0; i <= 22; i++) {
          const x = 6 + i, y = 25 - i;
          api.px(x, y, '#c9a27a'); api.px(x, y + 1, '#8a6a49');
        }
        /* Head and vanes are drawn as thick PERPENDICULAR strokes. Stepping
           pixel by pixel along a diagonal leaves every other cell empty, so
           the first cut rendered both as a checkerboard. */
        /* Perpendicular offsets on a 45-degree shaft all land on the SAME
           parity of (x+y), so stacking them alone leaves every other cell
           empty — head and fletching both came out as checkerboards. Writing
           each offset twice, once shifted a pixel in x, closes the lattice. */
        const dpx = (x, y, c) => { api.px(x, y, c); api.px(x + 1, y, c); };
        for (let i = 0; i <= 6; i++) {
          const x = 23 + i, y = 8 - i, w = Math.max(0, 2 - Math.round(i * 0.3));
          for (let j = -w; j <= w; j++) dpx(x + j, y + j, j < 0 ? SThi : j > 0 ? STsh : ST);
        }
        api.px(30, 1, '#ffffff');
        api.px(22, 9, STdk);                             // socket
        for (let k = 0; k <= 5; k++) {                   // two feather vanes
          const x = 4 + k, y = 27 - k, d = Math.max(0, 3 - Math.round(k * 0.55));
          for (let j = 1; j <= d; j++) {
            dpx(x + j - 1, y + j, j === 1 ? '#f6757a' : '#e43b44');
            dpx(x - j, y - j, j === 1 ? '#c42430' : '#a22633');
          }
        }
      } else if (kind === 'bomb') {
        api.ellipse(8, 11, 23, 27, '#2b3350', true);
        api.ellipse(9, 12, 21, 25, '#3a4466', true);
        api.ellipse(10, 13, 17, 19, '#55618c', true);    // rolled highlight
        api.ellipse(11, 14, 15, 17, '#7b87b4', true);
        api.px(12, 15, '#ffffff'); api.px(13, 15, '#c0cbdc');
        api.ellipse(11, 24, 20, 27, '#1c2237', true);    // it sits in its own shadow
        api.rect(14, 8, 18, 11, STsh); api.rect(14, 8, 18, 8, ST);   // fuse collar
        api.px(18, 11, STdk);
        api.line(16, 8, 20, 4, '#8a6a49', 1); api.line(17, 8, 21, 5, '#5e3a24', 1);
        api.px(21, 3, '#fee761'); api.px(22, 2, '#f77622'); api.px(20, 2, '#feae34');
        api.px(23, 1, '#e43b44'); api.px(21, 1, '#ffffff');
      }
      finish(buf, W, H);
    };
    return { width: 32, height: 32, name: 'weapons', layers: [{ name: 'Body' }],
      states: ['sword', 'pickaxe', 'axe', 'bow', 'shield', 'staff', 'arrow', 'bomb'].map(n => D(n, 1, true, [Fr(500, weapon(n))])) };
  }

  /* ---------- FX ---------- */
  function fxSuite() {
    /* A one-pixel arc of constant thickness is a fingernail clipping. A slash
       reads as a CRESCENT: fat through the middle of the sweep, tapering to
       nothing at both ends, with a dim outer wash behind a bright core and a
       white flash at the leading tip. */
    const arc = (api, cx, cy, r, a0, a1, thick, c) => {
      const steps = 28;
      for (let i = 0; i <= steps; i++) {
        const t = i / steps, a = a0 + (a1 - a0) * t;
        const w = Math.max(1, Math.round(thick * Math.sin(t * Math.PI)));
        for (let k = 0; k < w; k++) api.px(cx + Math.cos(a) * (r - k), cy + Math.sin(a) * (r - k), c);
      }
    };
    const slashFrames = [0, 1, 2, 3].map(i => Fr(ms(12), (buf, W, H) => {
      const api = apiFor(buf, W, H), t = i / 3;
      const r = 7 + t * 6, a0 = -1.8 + t * 0.9, a1 = a0 + 1.2 + t * 1.1;
      const dim = ['#6d7a96', '#8b9bb4', '#6d7a96', '#1f8ba0'][i];
      const mid = ['#c0cbdc', '#e4ecf7', '#c0cbdc', '#2ce8f5'][i];
      arc(api, 16, 16, r + 1, a0, a1, 2 + i, dim);
      arc(api, 16, 16, r, a0 + 0.14, a1 - 0.14, i === 1 || i === 2 ? 3 : 2, mid);
      if (i < 3) arc(api, 16, 16, r - 1, a0 + 0.35, a1 - 0.45, 2, '#ffffff');
      api.px(16 + Math.cos(a1) * (r + 1), 16 + Math.sin(a1) * (r + 1), '#ffffff');
      api.px(16 + Math.cos(a0) * (r - 1), 16 + Math.sin(a0) * (r - 1), '#ffffff');
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
    // Four runes 90 degrees apart rotate to the SAME set of positions when the
    // phase is a multiple of 90 degrees — every frame was identical. Use an
    // off-axis phase plus a pulsing radius instead.
    const auraFrames = [0, 1, 2, 3].map(i => Fr(ms(7), (buf, W, H) => {
      const api = apiFor(buf, W, H);
      const a = i * 0.6, r = 9 + (i % 2);
      api.ellipse(7, 7, 25, 25, '#fee761', false);
      api.ellipse(9, 9, 23, 23, '#ffffff', false);
      for (let k = 0; k < 4; k++) {
        const rot = a + (k / 4) * Math.PI * 2;
        api.px(16 + Math.cos(rot) * r, 16 + Math.sin(rot) * r, '#fee761');
        api.px(16 + Math.cos(rot) * (r + 2), 16 + Math.sin(rot) * (r + 2), '#ffffff');
      }
    }));
    return { width: 32, height: 32, name: 'spells', layers: [{ name: 'FX' }],
      states: [D('fireball', 10, true, fireballFrames), D('lightning', 10, true, boltFrames), D('ice_nova', 8, true, iceFrames), D('holy_shield', 7, true, auraFrames)] };
  }

  return { coinSuite, consumablesSuite, weaponsSuite, fxSuite, heartsSuite, spellsSuite };
})();

