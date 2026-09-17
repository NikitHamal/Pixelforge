/* PixelForge Studio — Traps, Furniture & Weather pack.
   Three room-and-level kits that the library was missing entirely:
   dungeon traps (animated hazards), interior furniture, and full-frame
   weather overlays. 32x32, pure maths, deterministic. */
window.PF = window.PF || {};
PF.RPG = PF.RPG || {};
PF.RPG.props = (() => {
  const P = () => PF.Pixel;
  const D = (name, fps, loop, frames) => ({ name, fps, loop, frames });
  const Fr = (duration, paint) => ({ duration, paint });
  const ms = fps => Math.round(1000 / fps);
  const apiFor = (buf, W, H) => P().makeApi(buf, W, H);
  const OUT32 = PF.Color.hexToU32('#181425');
  const finish = (buf, W, H) => buf.set(PF.Raster.outline(buf, W, H, OUT32));
  const S1 = (name, painter, fps = 6) => D(name, fps, true, [Fr(ms(fps), painter)]);
  // props sit on the floor: shadow at groundY=29, feet never past y27
  const prop = painter => (buf, W, H) => { painter(apiFor(buf, W, H)); finish(buf, W, H); };
  const grounded = painter => (buf, W, H) => { const api = apiFor(buf, W, H); P().shadowFlat(api, 16, 29, 7); painter(api); finish(buf, W, H); };

  /* ================= TRAPS ================= */
  function trapsSuite() {
    const stone = '#5a6988', stoneD = '#3a4466', stoneL = '#8b9bb4', metal = '#c0cbdc', metalD = '#5a6988';

    // floor spikes: plate flush -> blades punch up -> retract
    const spikes = k => prop(api => {
      api.rect(6, 26, 25, 28, stoneD);
      api.rect(6, 26, 25, 26, stoneL);
      api.rect(7, 27, 24, 27, stone);
      for (let i = 0; i < 6; i++) {
        const x = 8 + i * 3;
        api.px(x, 26, '#181425'); // socket
        const h = [0, 4, 7, 3][k];
        if (h) {
          api.line(x, 25, x, 25 - h, metal, 1);
          api.px(x, 25 - h, '#ffffff');
          api.px(x - 1, 24 - Math.floor(h / 2), metalD);
          api.px(x + 1, 24 - Math.floor(h / 2), metalD);
        }
      }
    });

    // wall dart trap: slot on the left edge, dart fires right
    const darts = k => prop(api => {
      api.rect(2, 12, 6, 20, stoneD);
      api.rect(2, 12, 6, 13, stoneL);
      api.rect(3, 15, 5, 17, '#181425');
      api.px(5, 16, k > 0 ? metal : '#181425');
      if (k === 0) { api.px(6, 16, metalD); }
      else {
        const reach = [0, 7, 14, 9][k];
        api.line(6, 16, 6 + reach, 16, metal, 1);
        api.rect(5 + reach, 15, 7 + reach, 17, metal);
        api.px(7 + reach, 16, '#ffffff');
        if (k === 2) { api.px(8 + reach, 16, '#fee761'); api.px(6 + reach, 14, '#fee761'); }
      }
    });

    // ceiling pendulum blade: swings across the tile
    const blade = k => prop(api => {
      api.rect(14, 0, 17, 3, stoneD);
      api.rect(15, 0, 16, 3, stone);
      const a = [-0.55, -0.2, 0.2, 0.55][k];
      const cx = 16, cy = 4, r = 15;
      const bx = Math.round(cx + Math.sin(a) * r), by = Math.round(cy + Math.cos(a) * r);
      api.line(cx, cy, bx, by, metalD, 1);
      api.ellipse(bx - 4, by - 3, bx + 4, by + 5, metal, true);
      api.ellipse(bx - 3, by - 2, bx + 3, by + 4, '#e8ecf5', true);
      api.px(bx - 4, by + 5, '#ffffff'); api.px(bx + 4, by + 5, '#ffffff');
    });

    // pressure plate: up / pressed
    const plate = down => prop(api => {
      api.rect(8, 26, 23, 28, stoneD);
      if (down) { api.rect(9, 27, 22, 28, stone); api.rect(9, 27, 22, 27, stoneL); }
      else { api.rect(8, 25, 23, 27, stone); api.rect(8, 25, 23, 25, stoneL); api.rect(8, 27, 23, 27, stoneD); }
      api.px(10, 26, down ? stoneD : stoneL); api.px(21, 26, down ? stoneD : stoneL);
    });

    // flame jet: floor vent breathing fire
    const jet = k => prop(api => {
      api.rect(10, 26, 21, 28, stoneD);
      api.rect(11, 26, 20, 27, '#181425');
      api.rect(11, 28, 20, 28, stone);
      const h = [2, 9, 14, 6][k];
      api.ellipse(12, 26 - h, 19, 28, '#f77622', true);
      api.ellipse(13, 27 - h, 18, 28, '#feae34', true);
      api.ellipse(14, 28 - h, 17, 28, '#fee761', true);
      api.px(15, 27 - h, '#ffffff'); api.px(16, 27 - h, '#ffffff');
      if (k >= 2) { api.px(11, 22 - h, '#f77622'); api.px(20, 21 - h, '#feae34'); }
    });

    // bear trap: jaws clamped shut -> sprung open
    const bear = k => grounded(api => {
      api.ellipse(6, 24, 25, 28, metalD, true);
      api.ellipse(7, 25, 24, 27, '#181425', true);
      const open = [0, 5, 8][k];
      // teeth arcs
      for (let i = 0; i < 7; i++) {
        const x = 8 + i * 2;
        api.px(x, 25 - open, '#ffffff');
        api.px(x, 27 + open - 2, '#ffffff');
      }
      api.line(6, 25 - open, 25, 25 - open, metal, 1);
      api.line(6, 25 + open - 1, 25, 25 + open - 1, metal, 1);
      api.rect(14, 28, 17, 29, metalD);
      if (k === 1) { api.px(9, 22, '#e43b44'); api.px(22, 22, '#e43b44'); }
    });

    // spike pit: open hole with a bed of spikes
    const pit = prop(api => {
      api.ellipse(4, 20, 27, 29, '#181425', true);
      api.ellipse(6, 22, 25, 28, '#262b44', true);
      for (let i = 0; i < 7; i++) {
        const x = 8 + i * 2, h = 3 + (i % 3);
        api.line(x, 27, x, 27 - h, metal, 1);
        api.px(x, 27 - h, '#ffffff');
      }
      api.line(4, 20, 27, 20, stoneD, 1);
    });

    // swinging chain with a spiked ball
    const chain = k => prop(api => {
      api.rect(14, 0, 17, 2, stoneD);
      const a = [-0.35, 0, 0.35, 0.15][k];
      const cx = 16, cy = 2, r = 14;
      const bx = Math.round(cx + Math.sin(a) * r), by = Math.round(cy + Math.cos(a) * r);
      for (let t = 0; t < 6; t++) api.px(Math.round(cx + Math.sin(a) * r * (t / 6)), Math.round(cy + Math.cos(a) * r * (t / 6)), metalD);
      api.ellipse(bx - 3, by - 3, bx + 3, by + 3, metalD, true);
      api.ellipse(bx - 2, by - 2, bx + 2, by + 2, metal, true);
      api.px(bx, by, '#ffffff');
      api.px(bx - 3, by, '#ffffff'); api.px(bx + 3, by, '#ffffff');
      api.px(bx, by - 3, '#ffffff'); api.px(bx, by + 3, '#ffffff');
    });

    return { width: 32, height: 32, name: 'rpg-traps', layers: [{ name: 'Traps' }], states: [
      D('spike_trap', 10, true, [0, 1, 2, 3].map(k => Fr(ms(10), spikes(k)))),
      D('dart_trap', 12, true, [0, 1, 2, 3].map(k => Fr(ms(12), darts(k)))),
      D('blade_trap', 12, true, [0, 1, 2, 3].map(k => Fr(ms(12), blade(k)))),
      D('pressure_plate', 6, true, [Fr(ms(6), plate(false)), Fr(ms(6), plate(true))]),
      D('flame_jet', 12, true, [0, 1, 2, 3].map(k => Fr(ms(12), jet(k)))),
      D('bear_trap', 8, true, [0, 1, 2].map(k => Fr(ms(8), bear(k)))),
      D('spike_pit', 6, true, [Fr(ms(6), pit)]),
      D('chain_ball', 10, true, [0, 1, 2, 3].map(k => Fr(ms(10), chain(k))))
    ] };
  }

  /* ================= FURNITURE ================= */
  function furnitureSuite() {
    const wood = '#b86f50', woodD = '#733e39', woodL = '#e4a672', cloth = '#124e89', clothD = '#1c2a44';
    const iron = '#5a6988', ironL = '#8b9bb4', gold = '#feae34';

    const table = grounded(api => {
      api.rect(3, 14, 28, 17, woodL); api.rect(3, 17, 28, 18, woodD);
      api.rect(3, 14, 28, 14, '#fff6c9');
      api.rect(5, 19, 7, 27, wood); api.rect(24, 19, 26, 27, wood);
      api.rect(5, 26, 7, 27, woodD); api.rect(24, 26, 26, 27, woodD);
      api.line(16, 15, 16, 17, woodD, 1); // plank seam
      api.rect(9, 12, 13, 14, '#e8ecf5'); api.rect(9, 12, 13, 12, '#ffffff'); // plate
      api.ellipse(19, 11, 23, 14, '#63c74d', true); api.px(21, 11, '#3e8948'); // fruit bowl
    });
    const chair = grounded(api => {
      api.rect(8, 8, 23, 11, wood); api.rect(8, 8, 23, 8, woodL); api.rect(8, 11, 23, 11, woodD);
      api.rect(10, 12, 21, 13, woodD);
      api.rect(8, 13, 23, 17, woodL); api.rect(8, 17, 23, 18, woodD);
      api.rect(9, 19, 11, 27, wood); api.rect(20, 19, 22, 27, wood);
      api.line(11, 22, 20, 22, woodD, 1); // stretcher
      api.rect(9, 26, 11, 27, woodD); api.rect(20, 26, 22, 27, woodD);
    });
    const bed = prop(api => {
      P().shadowFlat(api, 16, 29, 12);
      api.rect(2, 8, 7, 27, wood); api.rect(2, 8, 7, 9, woodL); // headboard
      api.rect(3, 10, 6, 12, woodD);
      api.rect(8, 14, 29, 24, '#e8ecf5'); // mattress
      api.rect(8, 22, 29, 24, cloth); api.rect(8, 22, 29, 22, clothD); // blanket
      api.rect(9, 16, 14, 20, '#ffffff'); api.rect(9, 16, 14, 16, '#fff6c9'); // pillow
      api.rect(8, 24, 29, 26, wood); api.rect(8, 26, 29, 27, woodD); // frame
      api.px(4, 13, gold);
    });
    const bookshelf = grounded(api => {
      api.rect(4, 4, 27, 28, woodD);
      api.rect(5, 5, 26, 27, wood);
      const shelf = y => { api.rect(5, y, 26, y + 1, woodD); };
      shelf(11); shelf(18); shelf(25);
      const book = (x, y, c) => { api.rect(x, y, x + 1, y + 4, c); api.px(x, y, '#fff6c9'); };
      book(6, 6, '#a22633'); book(8, 6, '#124e89'); book(10, 6, '#3e8948');
      book(7, 7, '#68386c'); book(11, 7, '#fee761');
      book(6, 13, '#e43b44'); book(8, 13, '#2ce8f5'); book(9, 14, '#f77622');
      book(6, 20, '#63c74d'); book(8, 20, '#c0cbdc'); book(10, 20, '#b55088'); book(12, 20, '#feae34');
      api.rect(18, 12, 25, 17, '#5a6988'); api.rect(18, 12, 25, 13, '#8b9bb4'); // chest of drawers
      api.px(21, 14, gold); api.px(22, 14, gold);
      api.rect(17, 19, 25, 24, '#733e39'); // crate
      api.line(17, 19, 25, 24, '#3e2731', 1);
      api.px(20, 21, '#c0cbdc');
    });
    const barrel = grounded(api => {
      api.ellipse(8, 10, 24, 14, wood, true);
      api.rect(8, 12, 24, 27, wood);
      api.rect(20, 12, 24, 27, woodD); api.rect(8, 12, 10, 27, woodL);
      api.ellipse(8, 10, 24, 14, woodL, false);
      api.rect(8, 13, 24, 14, iron); api.rect(8, 20, 24, 21, iron);
      api.rect(8, 26, 24, 27, iron);
      api.px(9, 14, ironL); api.px(9, 21, ironL);
      api.px(15, 12, '#3e2731'); api.px(17, 12, '#3e2731');
    });
    const crateStack = grounded(api => {
      api.rect(6, 17, 20, 27, wood); api.rect(6, 17, 8, 27, woodL); api.rect(18, 17, 20, 27, woodD);
      api.line(6, 17, 20, 27, woodD, 1); api.line(20, 17, 6, 27, woodD, 1);
      api.rect(6, 21, 20, 22, iron); api.rect(12, 17, 14, 27, iron);
      api.rect(14, 8, 26, 17, wood); api.rect(14, 8, 16, 17, woodL); api.rect(24, 8, 26, 17, woodD);
      api.line(14, 8, 26, 17, woodD, 1); api.line(26, 8, 14, 17, woodD, 1);
      api.rect(14, 12, 26, 13, iron);
      api.px(10, 19, '#fee761'); api.px(21, 11, '#fee761');
    });
    const pot = grounded(api => {
      api.ellipse(10, 12, 22, 16, '#d77643', true);
      api.ellipse(11, 13, 21, 15, '#3e2731', true); // open mouth
      api.ellipse(9, 15, 23, 26, '#d77643', true);
      api.ellipse(11, 17, 15, 24, '#e4a672', true);
      api.rect(19, 17, 22, 25, '#be4a2f');
      api.rect(8, 18, 24, 20, '#e4a672'); // belly band
      api.px(12, 20, '#fff6c9');
    });
    const rug = prop(api => {
      api.ellipse(3, 20, 28, 28, '#a22633', true);
      api.ellipse(5, 21, 26, 27, '#e43b44', true);
      api.ellipse(8, 22, 23, 26, '#a22633', true);
      api.ellipse(11, 23, 20, 25, '#fee761', true);
      api.px(6, 24, '#feae34'); api.px(25, 24, '#feae34');
      api.line(4, 22, 27, 22, '#5c1a1a', 1);
      api.line(4, 26, 27, 26, '#5c1a1a', 1);
    });
    const candelabra = grounded(api => {
      api.rect(12, 26, 19, 27, iron); api.rect(14, 24, 17, 26, ironL);
      api.rect(15, 14, 16, 24, iron);
      api.rect(9, 12, 22, 13, iron); api.rect(9, 13, 10, 14, iron); api.rect(21, 13, 22, 14, iron);
      const candle = (x, h) => {
        api.rect(x, 13 - h, x + 1, 13, '#e8ecf5');
        api.px(x, 12 - h, '#feae34'); api.px(x + 1, 11 - h, '#fee761'); api.px(x, 10 - h, '#ffffff');
      };
      candle(9, 6); candle(15, 8); candle(21, 6);
      api.px(16, 2, '#fff6c9');
    });
    const stool = grounded(api => {
      api.ellipse(8, 15, 24, 20, woodL, true);
      api.ellipse(9, 16, 23, 19, wood, true);
      api.ellipse(8, 15, 24, 17, '#fff6c9', false);
      api.rect(10, 20, 12, 27, woodD); api.rect(20, 20, 22, 27, woodD);
      api.line(12, 24, 20, 24, woodD, 1);
    });

    return { width: 32, height: 32, name: 'rpg-furniture', layers: [{ name: 'Furniture' }], states: [
      S1('table', table), S1('chair', chair), S1('bed', bed), S1('bookshelf', bookshelf),
      S1('barrel', barrel), S1('crate_stack', crateStack), S1('clay_pot', pot),
      S1('rug', rug), S1('candelabra', candelabra), S1('stool', stool)
    ] };
  }

  /* ================= WEATHER (full-frame overlays) ================= */
  function weatherSuite() {
    // deterministic scatter so each frame scrolls without Math.random
    const drops = (n, seed, step) => {
      const out = [];
      for (let i = 0; i < n; i++) {
        const x = (i * 37 + seed * 13) % 34 - 1;
        const y = (i * 53 + step * 11 + seed * 7) % 32;
        out.push([x, y]);
      }
      return out;
    };
    const rain = k => (buf, W, H) => {
      const api = apiFor(buf, W, H);
      drops(16, 0, k).forEach(([x, y]) => {
        api.line(x, y, x + 1, y + 3, '#8b9bb4', 1);
        api.px(x + 1, y + 4, '#c0cbdc');
      });
      drops(6, 2, k).forEach(([x, y]) => { api.line(x, y, x + 1, y + 4, '#c0cbdc', 1); });
      finish(buf, W, H);
    };
    const snow = k => (buf, W, H) => {
      const api = apiFor(buf, W, H);
      drops(14, 1, k).forEach(([x, y], i) => {
        const sway = (k + i) % 2;
        api.px(x + sway, y, '#ffffff'); api.px(x + sway, y + 1, '#e8ecf5');
        api.px(x + 1 + sway, y, '#ffffff');
      });
      finish(buf, W, H);
    };
    const storm = k => (buf, W, H) => {
      const api = apiFor(buf, W, H);
      if (k === 2) { // flash frame: whole tile blown out
        api.rect(0, 0, 31, 31, '#e8ecf5');
        api.rect(0, 0, 31, 12, '#ffffff');
        api.line(20, 2, 14, 16, '#fee761', 2);
        api.line(14, 16, 20, 20, '#ffffff', 2);
        api.line(20, 20, 15, 30, '#fee761', 2);
        finish(buf, W, H); return;
      }
      drops(14, 3, k).forEach(([x, y]) => { api.line(x, y, x + 1, y + 5, '#5a6988', 1); });
      drops(5, 5, k).forEach(([x, y]) => { api.line(x, y, x + 2, y + 4, '#8b9bb4', 1); });
      api.ellipse(2, 0, 14, 5, '#3a4466', true);
      api.ellipse(13, 0, 27, 6, '#262b44', true);
      finish(buf, W, H);
    };
    const fog = k => (buf, W, H) => {
      const api = apiFor(buf, W, H);
      // Mist is stippled (this raster has no soft alpha). A plain ordered
      // dither reads as a barcode and a gated one reads as speed lines, so
      // each bank gets a wavy top edge and a density that falls off towards
      // its edges - the stipple then fades out instead of stopping dead.
      const THICK = 6;
      for (let b = 0; b < 3; b++) {
        const y0 = 5 + b * 8 + ((k + b) % 2);
        for (let x = 0; x < 32; x++) {
          const wave = Math.sin(x / 4.5 + k * 0.9 + b * 2.1) * 1.6 + Math.sin(x / 9.5 - k * 0.6 + b) * 1.2;
          const top = y0 + Math.round(wave);
          for (let y = top; y < top + THICK; y++) {
            if (y < 0 || y >= 32) continue;
            const density = Math.sin(((y - top) / THICK) * Math.PI); // 0 at the edges, 1 mid-bank
            const d = (x * 13 + y * 29 + b * 37) % 100;
            if (d < density * 70) api.px(x, y, d % 3 === 0 ? '#c0cbdc' : '#8b9bb4');
          }
        }
      }
      finish(buf, W, H);
    };
    const leaves = k => (buf, W, H) => {
      const api = apiFor(buf, W, H);
      const cols = ['#e43b44', '#f77622', '#feae34', '#b86f50'];
      for (let i = 0; i < 10; i++) {
        const x = (i * 41 + k * 5) % 32, y = (i * 29 + k * 9) % 32;
        const c = cols[i % 4];
        api.px(x, y, c); api.px(x + 1, y, c); api.px(x, y + 1, c);
        if (k % 2) api.px(x + 1, y + 1, c);
      }
      finish(buf, W, H);
    };
    const ash = k => (buf, W, H) => {
      const api = apiFor(buf, W, H);
      for (let i = 0; i < 12; i++) {
        const x = (i * 43 + k * 3) % 32, y = (i * 31 + k * 7) % 32;
        api.px(x, y, '#8b9bb4'); api.px(x, y + 1, '#5a6988');
        if (i % 3 === 0) api.px(x + 1, y, '#f77622');
      }
      finish(buf, W, H);
    };
    const fireflies = k => (buf, W, H) => {
      const api = apiFor(buf, W, H);
      for (let i = 0; i < 7; i++) {
        const x = (i * 19 + k * 4) % 30 + 1, y = (i * 23 + k * 5) % 26 + 3;
        const near = (i + k) % 3 === 0;
        api.px(x, y, '#fff6c9');
        if (near) { api.px(x - 1, y, '#fee761'); api.px(x + 1, y, '#fee761'); api.px(x, y - 1, '#feae34'); api.px(x, y + 1, '#feae34'); }
      }
      finish(buf, W, H);
    };
    const sand = k => (buf, W, H) => {
      const api = apiFor(buf, W, H);
      for (let i = 0; i < 20; i++) {
        const x = (i * 47 + k * 6) % 34 - 1, y = (i * 17 + k * 3) % 32;
        api.line(x, y, x + 3, y, '#e4a672', 1);
      }
      for (let i = 0; i < 10; i++) {
        const x = (i * 31 + k * 8) % 34 - 1, y = (i * 13 + k * 5) % 32;
        api.line(x, y, x + 5, y, '#d77643', 1);
      }
      finish(buf, W, H);
    };

    return { width: 32, height: 32, name: 'rpg-weather', layers: [{ name: 'Weather' }], states: [
      D('rain', 14, true, [0, 1, 2, 3].map(k => Fr(ms(14), rain(k)))),
      D('snow', 6, true, [0, 1, 2, 3].map(k => Fr(ms(6), snow(k)))),
      D('storm', 10, true, [0, 1, 2, 3].map(k => Fr(ms(10), storm(k)))),
      D('fog', 5, true, [0, 1, 2, 3].map(k => Fr(ms(5), fog(k)))),
      D('leaves', 8, true, [0, 1, 2, 3].map(k => Fr(ms(8), leaves(k)))),
      D('ash', 8, true, [0, 1, 2, 3].map(k => Fr(ms(8), ash(k)))),
      D('fireflies', 6, true, [0, 1, 2, 3].map(k => Fr(ms(6), fireflies(k)))),
      D('sandstorm', 12, true, [0, 1, 2, 3].map(k => Fr(ms(12), sand(k))))
    ] };
  }

  return { trapsSuite, furnitureSuite, weatherSuite };
})();
