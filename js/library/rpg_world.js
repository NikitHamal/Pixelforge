/* PixelForge Studio — RPG World pack: dungeon tileset, village props,
   dungeon props, rune savepoint, waterfall, lava. 16px tiles + 32px props. */
window.PF = window.PF || {};
PF.RPG = PF.RPG || {};
PF.RPG.world = (() => {
  const P = () => PF.Pixel;
  const D = (name, fps, loop, frames) => ({ name, fps, loop, frames });
  const Fr = (duration, paint) => ({ duration, paint });
  const ms = fps => Math.round(1000 / fps);
  const R = PF.RPG;
  const apiFor = (buf, W, H) => P().makeApi(buf, W, H);
  const OUT = '#181425';
  const OUT32 = PF.Color.hexToU32(OUT); // cached: one lookup, not one per frame
  const finish = buf => buf.set(PF.Raster.outline(buf, 32, 32, OUT32));
  const speck = (api, x0, y0, x1, y1, seed, colors, density = 0.16) => {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++)
      if (api.hash(x, y, seed) < density) api.px(x, y, colors[Math.floor(api.hash(x + 9, y + 3, seed) * colors.length) % colors.length]);
  };

  /* ================= DUNGEON TILESET 64x64 (16 tiles) ================= */
  // v = animation variant: only lava + water tiles differ, so frame 2 is a
  // cheap overdraw of 2 tiles and the sheet stays slicer-safe (game uses frame 0).
  function tileFrame(idx, v = 0) {
    return (buf, W, H) => {
      const api = apiFor(buf, W, H);
      const tx = (idx % 4) * 16, ty = Math.floor(idx / 4) * 16;
      const X = x => tx + x, Y = y => ty + y;
      const R16 = (x0, y0, x1, y1, c) => api.rect(X(x0), Y(y0), X(x1), Y(y1), c);
      const stone = () => {
        R16(0, 0, 15, 15, '#5a6988');
        R16(0, 0, 15, 1, '#8b9bb4'); R16(0, 14, 15, 15, '#3a4466');
        R16(0, 7, 15, 8, '#3a4466'); // slab seam
        R16(7, 0, 8, 7, '#3a4466'); R16(7, 8, 8, 15, '#3a4466');
        speck(api, tx, ty, tx + 15, ty + 15, idx * 7 + 1, ['#8b9bb4', '#3a4466'], 0.12);
      };
      const brick = (base, mort, hi) => {
        R16(0, 0, 15, 15, mort);
        for (let r = 0; r < 4; r++) {
          const y0 = r * 4, off = r % 2 ? 4 : 0;
          for (let b = -1; b < 3; b++) {
            const x0 = b * 8 + off;
            R16(x0 + 1, y0 + 1, x0 + 6, y0 + 2, base);
            api.px(X(x0 + 1), Y(y0 + 1), hi);
          }
        }
        speck(api, tx, ty, tx + 15, ty + 15, idx * 7 + 2, [hi], 0.06);
      };
      switch (idx) {
        case 0: stone(); break;
        case 1: stone();
          api.line(X(2), Y(2), X(6), Y(8), '#262b44', 1); api.line(X(6), Y(8), X(5), Y(13), '#262b44', 1);
          api.line(X(11), Y(3), X(13), Y(7), '#262b44', 1); break;
        case 2: stone();
          speck(api, tx, ty, tx + 15, ty + 15, 31, ['#3e8948', '#265c42'], 0.2);
          R16(0, 12, 5, 15, '#3e8948'); break;
        case 3: // rune floor
          R16(0, 0, 15, 15, '#3a4466'); speck(api, tx, ty, tx + 15, ty + 15, 41, ['#262b44'], 0.12);
          api.ellipse(X(3), Y(3), X(12), Y(12), '#2ce8f5', false);
          api.px(X(7), Y(5), '#2ce8f5'); api.px(X(8), Y(10), '#2ce8f5'); api.px(X(5), Y(8), '#ffffff'); api.px(X(10), Y(7), '#ffffff'); break;
        case 4: brick('#733e39', '#3e2731', '#b86f50'); break;
        case 5: brick('#5c4a5a', '#3e2731', '#8b7b8b');
          speck(api, tx, ty, tx + 15, ty + 15, 51, ['#3e8948'], 0.14); break;
        case 6: // pillar segment
          R16(0, 0, 15, 15, '#262b44');
          R16(3, 0, 12, 15, '#8b9bb4'); R16(3, 0, 5, 15, '#c0cbdc'); R16(10, 0, 12, 15, '#5a6988');
          api.line(X(7), Y(0), X(7), Y(15), '#5a6988', 1); api.line(X(9), Y(0), X(9), Y(15), '#5a6988', 1);
          R16(2, 0, 13, 1, '#c0cbdc'); R16(2, 14, 13, 15, '#5a6988'); break;
        case 7: // lava: crust shifts between variants = slow bubbling shimmer
          R16(0, 0, 15, 15, '#e43b44');
          speck(api, tx, ty, tx + 15, ty + 15, 61 + v * 13, ['#f77622', '#fee761'], 0.22);
          speck(api, tx, ty, tx + 15, ty + 15, 62 + v * 17, ['#5c1a1a'], 0.18);
          if (v) { api.px(X(4), Y(5), '#fee761'); api.px(X(11), Y(10), '#fee761'); }
          else { api.px(X(9), Y(3), '#fee761'); api.px(X(5), Y(12), '#fee761'); }
          break;
        case 8: // water: wave bands slide 1px between variants
          R16(0, 0, 15, 15, '#124e89');
          api.line(X(0), Y(4 + v), X(15), Y(4 + v), '#2ce8f5', 1); api.line(X(0), Y(11 - v), X(15), Y(11 - v), '#2ce8f5', 1);
          api.line(X(3), Y(7 - v), X(8), Y(7 - v), '#0099db', 1); api.line(X(9), Y(14 - v), X(14), Y(14 - v), '#0099db', 1);
          api.px(X(5), Y(2 + v), '#ffffff'); api.px(X(12), Y(9 - v), '#ffffff'); break;
        case 9: // stairs down
          R16(0, 0, 15, 15, '#181425');
          for (let s = 0; s < 4; s++) { R16(1 + s, 1 + s * 3, 14 - s, 3 + s * 3, '#5a6988'); R16(1 + s, 1 + s * 3, 14 - s, 1 + s * 3, '#8b9bb4'); }
          R16(5, 10, 10, 12, '#181425'); break;
        case 10: // spikes
          R16(0, 0, 15, 15, '#3a4466'); speck(api, tx, ty, tx + 15, ty + 15, 71, ['#262b44'], 0.1);
          [2, 6, 10, 13].forEach(x => { api.line(X(x), Y(13), X(x), Y(5), '#8b9bb4', 2); api.px(X(x), Y(5), '#ffffff'); api.px(X(x) - 1, Y(10), '#5a6988'); });
          R16(0, 13, 15, 15, '#262b44'); break;
        case 11: // grate
          R16(0, 0, 15, 15, '#262b44');
          for (let x = 1; x < 15; x += 3) R16(x, 0, x + 1, 15, '#8b9bb4');
          R16(0, 0, 15, 0, '#c0cbdc'); break;
        case 12: // bones
          stone();
          api.line(X(4), Y(10), X(11), Y(10), '#ead4aa', 2);
          [5, 7, 9].forEach(x => api.line(X(x), Y(8), X(x), Y(12), '#ead4aa', 1));
          api.rect(X(11), Y(9), X(13), Y(11), '#ead4aa'); api.px(X(11), Y(10), '#181425');
          api.px(X(3), Y(4), '#c0cbdc'); api.px(X(12), Y(5), '#c0cbdc'); break;
        case 13: // carpet
          R16(0, 0, 15, 15, '#a22633');
          R16(1, 1, 14, 14, '#e43b44'); R16(2, 2, 13, 13, '#a22633');
          api.rect(X(6), Y(6), X(9), Y(9), '#fee761'); api.px(X(7), Y(7), '#a22633');
          R16(0, 0, 15, 0, '#f6757a'); break;
        case 14: // void pit
          R16(0, 0, 15, 15, '#181425');
          api.rect(X(0), Y(0), X(15), Y(0), '#68386c'); api.rect(X(0), Y(0), X(0), Y(15), '#68386c');
          api.px(X(4), Y(6), '#b55088'); api.px(X(10), Y(4), '#68386c'); api.px(X(7), Y(11), '#b55088'); api.px(X(12), Y(12), '#54254f'); break;
        default: // chiseled decor floor
          stone();
          api.rect(X(4), Y(4), X(11), Y(11), '#3a4466');
          api.rect(X(5), Y(5), X(10), Y(10), '#5a6988');
          api.px(X(7), Y(7), '#8b9bb4'); api.px(X(8), Y(8), '#8b9bb4');
      }
    };
  }
  function dungeonTilesSuite() {
    const frames = [];
    for (let k = 0; k < 16; k++) frames.push(Fr(ms(8), tileFrame(k)));
    // tileset: all 16 tiles composed on ONE 64x64 frame (like reference tileset)
    const paint = (buf, W, H) => {
      const api = apiFor(buf, W, H);
      for (let k = 0; k < 16; k++) tileFrame(k)(buf, W, H);
      void api;
    };
    // frame 2 re-cuts lava + water tiles only: gentle animated shimmer, slicer-safe
    const paint2 = (buf, W, H) => { paint(buf, W, H); tileFrame(7, 1)(buf, W, H); tileFrame(8, 1)(buf, W, H); };
    return { width: 64, height: 64, name: 'rpg-dungeon-tiles', layers: [{ name: 'Tiles' }],
      states: [D('tiles', 6, true, [Fr(ms(6), paint), Fr(ms(6), paint2)])] };
  }

  /* ================= VILLAGE PROPS ================= */
  function villageSuite() {
    const S = (name, fps, painters) => D(name, fps, true, painters.map(p => Fr(ms(fps), p)));
    const cottage = (smoke) => (buf, W, H) => {
      const api = apiFor(buf, W, H);
      P().shadowFlat(api, 16, 29, 11);
      // walls + timber
      api.rect(7, 15, 25, 28, '#ead4aa');
      api.rect(7, 15, 8, 28, '#fff6c9'); api.rect(24, 15, 25, 28, '#c28569');
      api.rect(7, 15, 25, 16, '#733e39'); api.rect(12, 16, 13, 28, '#733e39'); api.rect(19, 16, 20, 28, '#733e39');
      // roof
      api.rect(4, 12, 28, 15, '#f77622');
      for (let x = 4; x <= 28; x += 2) api.line(x, 12, x - 3, 5, '#feae34', 1);
      api.line(4, 5, 28, 5, '#fee761', 2);
      speck(api, 5, 6, 27, 12, 3, ['#f77622'], 0.2);
      // door + window glow
      api.rect(14, 20, 18, 28, '#5c3a2a'); api.rect(14, 20, 18, 21, '#733e39');
      api.px(17, 24, '#fee761');
      api.rect(9, 19, 11, 22, '#fee761'); api.rectO(9, 19, 11, 22, '#733e39');
      api.line(10, 19, 10, 22, '#733e39', 1); api.line(9, 20, 11, 20, '#733e39', 1);
      // chimney + smoke
      api.rect(22, 3, 24, 9, '#8b9bb4'); api.rect(22, 3, 24, 4, '#5a6988');
      const sx = 23 + (smoke % 2), sy = 1 - Math.floor(smoke / 2);
      api.px(sx, sy + 1, '#c0cbdc'); api.px(sx + 1, sy, '#8b9bb4');
      finish(buf);
    };
    const well = (buf, W, H) => {
      const api = apiFor(buf, W, H);
      P().shadowFlat(api, 16, 29, 8);
      api.rect(9, 7, 11, 22, '#733e39'); api.rect(21, 7, 23, 22, '#733e39');
      api.line(9, 7, 16, 3, '#a22633', 2); api.line(23, 7, 16, 3, '#a22633', 2);
      api.line(9, 7, 16, 4, '#e43b44', 1); api.line(23, 7, 16, 4, '#e43b44', 1);
      api.ellipse(7, 20, 25, 28, '#8b9bb4', true);
      api.ellipse(9, 21, 23, 27, '#5a6988', true);
      api.ellipse(11, 22, 21, 26, '#181425', true);
      api.ellipse(11, 22, 21, 24, '#124e89', true);
      api.px(14, 23, '#2ce8f5');
      api.line(16, 5, 16, 20, '#3e2731', 1);
      api.rect(14, 18, 18, 21, '#b86f50');
      finish(buf);
    };
    const stall = (buf, W, H) => {
      const api = apiFor(buf, W, H);
      P().shadowFlat(api, 16, 29, 10);
      api.rect(6, 10, 8, 28, '#733e39'); api.rect(24, 10, 26, 28, '#733e39');
      for (let x = 5; x <= 27; x += 4) { api.rect(x, 6, x + 1, 10, (x / 4) % 2 ? '#e8ecf5' : '#a22633'); }
      api.rect(5, 5, 27, 6, '#733e39');
      api.rect(6, 18, 26, 22, '#b86f50'); api.rect(6, 18, 26, 19, '#e4a672');
      // goods: apples + melon + bread
      api.px(10, 17, '#e43b44'); api.px(12, 17, '#e43b44'); api.px(11, 16, '#63c74d');
      api.ellipse(16, 16, 19, 18, '#3e8948', true); api.line(17, 16, 18, 16, '#265c42', 1);
      api.rect(22, 16, 24, 18, '#e4a672');
      finish(buf);
    };
    const signpost = (buf, W, H) => {
      const api = apiFor(buf, W, H);
      P().shadowFlat(api, 16, 29, 4);
      api.rect(15, 8, 17, 28, '#733e39'); api.rect(15, 8, 15, 28, '#b86f50');
      api.rect(6, 9, 15, 12, '#b86f50'); api.px(6, 10, '#733e39');
      api.rect(17, 13, 27, 16, '#b86f50'); api.px(27, 14, '#733e39');
      api.px(16, 6, '#63c74d'); api.px(16, 7, '#3e8948');
      finish(buf);
    };
    const lamp = (flick) => (buf, W, H) => {
      const api = apiFor(buf, W, H);
      P().shadowFlat(api, 16, 29, 4);
      api.rect(15, 12, 17, 28, '#3a4466'); api.rect(13, 27, 19, 28, '#262b44');
      api.rect(12, 5, 20, 12, '#262b44');
      api.rect(13, 6, 19, 11, flick ? '#fee761' : '#feae34');
      api.px(16, 8, '#ffffff');
      api.rect(11, 4, 21, 5, '#3a4466');
      if (flick) { api.px(10, 8, '#fee761'); api.px(22, 8, '#fee761'); api.px(16, 2, '#fee761'); }
      finish(buf);
    };
    const fountain = (i) => (buf, W, H) => {
      const api = apiFor(buf, W, H);
      P().shadowFlat(api, 16, 29, 11);
      api.ellipse(5, 20, 27, 28, '#8b9bb4', true);
      api.ellipse(7, 21, 25, 27, '#5a6988', true);
      api.ellipse(9, 22, 23, 26, '#124e89', true);
      api.ellipse(10, 22, 22, 25, '#0099db', true);
      api.rect(14, 12, 18, 22, '#8b9bb4'); api.rect(14, 12, 15, 22, '#c0cbdc');
      api.ellipse(12, 9, 20, 13, '#8b9bb4', true);
      // water arcs: phase-animated
      const ph = i % 4;
      for (let k = 0; k < 4; k++) {
        const t = (ph + k) % 4;
        api.px(16 - 3 - t, 10 - t, '#2ce8f5'); api.px(16 + 3 + t, 10 - t, '#2ce8f5');
        api.px(16 - 4 - t, 12 - Math.floor(t / 2), '#0099db'); api.px(16 + 4 + t, 12 - Math.floor(t / 2), '#0099db');
      }
      api.px(16, 6 - (ph % 2), '#ffffff');
      api.px(12 + ph, 23, '#ffffff'); api.px(20 - ph, 24, '#2ce8f5');
      finish(buf);
    };
    return { width: 32, height: 32, name: 'rpg-village', layers: [{ name: 'Props' }], states: [
      S('cottage', 3, [cottage(0), cottage(1)]),
      S('well', 6, [well]),
      S('market_stall', 6, [stall]),
      S('signpost', 6, [signpost]),
      S('lamp', 4, [lamp(true), lamp(false)]),
      D('fountain', 8, true, [0, 1, 2, 3].map(i => Fr(ms(8), fountain(i))))
    ] };
  }

  /* ================= DUNGEON PROPS ================= */
  function dungeonPropsSuite() {
    const S1 = (name, painter) => D(name, 6, true, [Fr(ms(6), painter)]);
    const S2 = (name, fps, a, b) => D(name, fps, true, [Fr(ms(fps), a), Fr(ms(fps), b)]);
    const pillar = (broken) => (buf, W, H) => {
      const api = apiFor(buf, W, H);
      P().shadowFlat(api, 16, 29, 6);
      const top = broken ? 14 : 4;
      api.rect(9, 25, 23, 28, '#5a6988'); api.rect(9, 25, 23, 26, '#8b9bb4');
      api.rect(11, top, 21, 25, '#8b9bb4'); api.rect(11, top, 13, 25, '#c0cbdc'); api.rect(19, top, 21, 25, '#5a6988');
      api.line(15, top, 15, 25, '#5a6988', 1); api.line(17, top, 17, 25, '#5a6988', 1);
      if (!broken) { api.rect(8, 2, 24, 5, '#8b9bb4'); api.rect(8, 2, 24, 3, '#c0cbdc'); }
      else { api.px(12, 12, '#5a6988'); api.px(19, 10, '#8b9bb4'); api.px(15, 27, '#3a4466'); api.px(22, 27, '#5a6988'); }
      speck(api, 11, top, 21, 25, 5, ['#5a6988'], 0.1);
      finish(buf);
    };
    const altar = (lit) => (buf, W, H) => {
      const api = apiFor(buf, W, H);
      P().shadowFlat(api, 16, 29, 9);
      api.rect(8, 24, 24, 28, '#5a6988'); api.rect(8, 24, 24, 25, '#8b9bb4');
      api.rect(10, 16, 22, 24, '#8b9bb4'); api.rect(10, 16, 12, 24, '#c0cbdc');
      api.rect(10, 16, 22, 17, '#3e2731');
      api.rect(12, 12, 14, 16, '#ead4aa'); api.rect(18, 12, 20, 16, '#ead4aa');
      [[13, 11], [19, 11]].forEach(([x, y]) => {
        api.px(x, y, lit ? '#fee761' : '#8b9bb4'); api.px(x, y - 1, lit ? '#ffffff' : '#5a6988');
        if (lit) { api.px(x - 1, y, '#feae34'); api.px(x + 1, y, '#feae34'); api.px(x, y - 2, '#fee761'); }
      });
      if (lit) { api.rect(10, 16, 22, 17, '#8b9bb4'); api.rect(14, 18, 18, 19, '#b55088'); }
      api.rect(14, 18, 18, 22, '#68386c'); api.px(16, 20, '#b55088');
      finish(buf);
    };
    const sarcophagus = (buf, W, H) => {
      const api = apiFor(buf, W, H);
      P().shadowFlat(api, 16, 29, 9);
      api.rect(8, 12, 24, 28, '#8b9bb4'); api.rect(8, 12, 10, 28, '#c0cbdc'); api.rect(22, 12, 24, 28, '#5a6988');
      api.rect(8, 12, 24, 14, '#c0cbdc');
      // carved face: brow + eyes + nose + mouth lines
      api.line(13, 17, 19, 17, '#5a6988', 1);
      api.px(14, 19, '#5a6988'); api.px(18, 19, '#5a6988');
      api.line(16, 19, 16, 22, '#5a6988', 1);
      api.line(14, 24, 18, 24, '#5a6988', 1);
      api.rect(10, 26, 22, 27, '#fee761'); api.px(16, 26, '#ff0044');
      finish(buf);
    };
    const bones = (buf, W, H) => {
      const api = apiFor(buf, W, H);
      P().shadowFlat(api, 16, 28, 10);
      api.ellipse(10, 22, 20, 27, '#ead4aa', false);
      [12, 14, 16, 18].forEach(x => api.line(x, 22, x, 27, '#ead4aa', 1));
      api.rect(21, 20, 25, 24, '#ead4aa'); api.px(22, 22, '#181425'); api.px(24, 22, '#181425');
      api.line(22, 24, 24, 24, '#181425', 1);
      api.line(6, 26, 10, 24, '#c0cbdc', 2); api.line(24, 27, 28, 25, '#c0cbdc', 2);
      finish(buf);
    };
    const chains = (sway) => (buf, W, H) => {
      const api = apiFor(buf, W, H);
      const dx = sway ? 1 : -1;
      api.rect(0, 0, 31, 3, '#3a4466');
      for (let y = 3; y < 22; y += 3) {
        const x = 16 + Math.round(Math.sin(y / 4) * dx);
        api.rect(x - 1, y, x + 1, y + 2, (y / 3) % 2 ? '#8b9bb4' : '#5a6988');
      }
      api.line(16 + dx, 22, 16 + dx, 26, '#8b9bb4', 2);
      finish(buf);
    };
    const bars = (buf, W, H) => {
      const api = apiFor(buf, W, H);
      api.rect(6, 2, 26, 28, '#262b44');
      api.rect(6, 2, 26, 4, '#3a4466'); api.rect(6, 26, 26, 28, '#3a4466');
      for (let x = 8; x <= 24; x += 4) { api.rect(x, 4, x + 1, 26, '#8b9bb4'); api.px(x, 5, '#c0cbdc'); }
      api.rect(14, 14, 18, 18, '#fee761'); api.px(16, 16, '#181425');
      finish(buf);
    };
    const statue = (buf, W, H) => {
      const api = apiFor(buf, W, H);
      P().shadowFlat(api, 16, 29, 7);
      api.rect(10, 24, 22, 28, '#5a6988'); api.rect(10, 24, 22, 25, '#8b9bb4');
      api.rect(13, 14, 19, 24, '#8b9bb4'); api.rect(13, 14, 14, 24, '#c0cbdc');
      api.rect(12, 8, 20, 14, '#8b9bb4');
      api.rect(12, 8, 20, 10, '#5a6988'); // helm shadow
      api.px(15, 11, '#262b44'); api.px(17, 11, '#262b44');
      api.line(16, 11, 16, 14, '#5a6988', 1);
      api.rect(11, 6, 21, 8, '#c0cbdc');
      api.rect(22, 16, 24, 24, '#8b9bb4'); // sword arm stub
      api.line(23, 8, 23, 16, '#c0cbdc', 2); api.px(23, 8, '#ffffff');
      finish(buf);
    };
    const shrooms = (glow) => (buf, W, H) => {
      const api = apiFor(buf, W, H);
      P().shadowFlat(api, 16, 29, 9);
      const cap = glow ? '#2ce8f5' : '#0099db', stem = '#c0cbdc';
      [[10, 22, 3], [16, 20, 4], [23, 23, 3]].forEach(([x, y, r]) => {
        api.rect(x - 1, y - 3, x + 1, y, stem);
        api.ellipse(x - r, y - 6, x + r, y - 2, cap, true);
        api.px(x - 1, y - 5, '#ffffff'); api.px(x + 1, y - 4, '#ffffff');
      });
      if (glow) { api.px(6, 18, '#2ce8f5'); api.px(26, 17, '#2ce8f5'); }
      speck(api, 4, 24, 28, 28, 9, ['#265c42'], 0.3);
      finish(buf);
    };
    const throne = (buf, W, H) => {
      const api = apiFor(buf, W, H);
      P().shadowFlat(api, 16, 29, 9);
      api.rect(9, 4, 23, 22, '#733e39'); api.rect(9, 4, 11, 22, '#b86f50');
      api.rect(9, 4, 23, 6, '#b86f50');
      api.rect(12, 8, 20, 16, '#a22633'); api.rect(12, 8, 20, 9, '#e43b44');
      api.px(16, 7, '#fee761');
      api.rect(7, 22, 25, 28, '#733e39'); api.rect(7, 22, 25, 23, '#b86f50');
      api.rect(10, 18, 22, 22, '#a22633');
      api.rect(6, 14, 8, 24, '#b86f50'); api.rect(24, 14, 26, 24, '#b86f50');
      finish(buf);
    };
    return { width: 32, height: 32, name: 'rpg-dungeon-props', layers: [{ name: 'Props' }], states: [
      S1('pillar', pillar(false)),
      S1('pillar_broken', pillar(true)),
      S2('altar', 4, altar(true), altar(false)),
      S1('sarcophagus', sarcophagus),
      S1('bones', bones),
      S2('chains', 3, chains(true), chains(false)),
      S1('iron_door', bars),
      S1('statue', statue),
      S2('glowshrooms', 4, shrooms(true), shrooms(false)),
      S1('throne', throne)
    ] };
  }

  /* ================= RUNE SAVEPOINT ================= */
  function savepointSuite() {
    const frame = (i, active) => (buf, W, H) => {
      const api = apiFor(buf, W, H);
      P().shadowFlat(api, 16, 29, 8);
      // ground ring
      api.ellipse(8, 24, 24, 29, '#3a4466', false);
      if (active) { const r = 3 + i * 2; api.ellipse(16 - r, 26 - 1, 16 + r, 28 + 0, '#2ce8f5', false); }
      // monolith
      api.rect(11, 10, 21, 26, '#3a4466'); api.rect(11, 10, 13, 26, '#5a6988');
      api.rect(11, 10, 21, 12, '#5a6988');
      // runes light up in sequence
      const cols = active ? ['#2ce8f5', '#2ce8f5', '#ffffff', '#2ce8f5'] : ['#2ce8f5', '#124e89', '#124e89', '#124e89'];
      const lit = active ? i : 0;
      const runes = [[14, 15], [18, 15], [14, 20], [18, 20]];
      runes.forEach(([x, y], k) => { api.px(x, y, k <= lit ? cols[0] : '#124e89'); api.px(x + 1, y, k <= lit ? '#ffffff' : '#124e89'); });
      // floating crystal
      const cy = 5 - (i % 2);
      api.px(16, cy - 2, '#2ce8f5'); api.rect(15, cy - 1, 17, cy + 1, '#2ce8f5'); api.px(16, cy + 2, '#0099db');
      api.px(15, cy - 1, '#ffffff');
      P().particles(api, 16, 16, 9, i / 4, ['#2ce8f5', '#ffffff']);
      if (active && i === 3) P().sparks(api, 16, 14, 1, '#ffffff', 10, 3, 8);
      finish(buf);
    };
    return { width: 32, height: 32, name: 'rpg-savepoint', layers: [{ name: 'Props' }], states: [
      D('idle', 6, true, [0, 1, 2, 3].map(i => Fr(ms(6), frame(i, false)))),
      D('activate', 10, true, [0, 1, 2, 3].map(i => Fr(ms(10), frame(i, true))))
    ] };
  }

  /* ================= WATERFALL ================= */
  function waterfallSuite() {
    const frame = (i) => (buf, W, H) => {
      const api = apiFor(buf, W, H);
      // cliff ledges
      api.rect(0, 0, 9, 10, '#5a6988'); api.rect(23, 0, 31, 10, '#5a6988');
      api.rect(0, 0, 9, 2, '#3e8948'); api.rect(23, 0, 31, 2, '#3e8948');
      speck(api, 0, 2, 9, 10, 1, ['#3a4466'], 0.2); speck(api, 23, 2, 31, 10, 2, ['#3a4466'], 0.2);
      // falling sheet with phase scroll
      for (let y = 2; y < 26; y++) {
        for (let x = 10; x <= 21; x++) {
          const band = (x + y * 2 + i * 3) % 8;
          api.px(x, y, band < 3 ? '#2ce8f5' : band < 6 ? '#0099db' : '#124e89');
        }
      }
      api.line(10, 2, 10, 25, '#ffffff', 1); api.line(21, 2, 21, 25, '#ffffff', 1);
      // foam basin
      api.ellipse(6, 24, 26, 30, '#0099db', true);
      api.ellipse(8, 25, 24, 29, '#2ce8f5', true);
      for (let k = 0; k < 6; k++) {
        const fx = 8 + ((k * 5 + i * 2) % 17), fy = 25 + ((k * 3 + i) % 4);
        api.px(fx, fy, '#ffffff');
      }
      finish(buf);
    };
    return { width: 32, height: 32, name: 'rpg-waterfall', layers: [{ name: 'Water' }],
      states: [D('flow', 10, true, [0, 1, 2, 3].map(i => Fr(ms(10), frame(i))))] };
  }

  /* ================= LAVA ================= */
  function lavaSuite() {
    const frame = (i) => (buf, W, H) => {
      const api = apiFor(buf, W, H);
      api.rect(0, 0, 31, 31, '#e43b44');
      speck(api, 0, 0, 31, 31, 4, ['#f77622'], 0.2);
      speck(api, 0, 0, 31, 31, 5, ['#5c1a1a'], 0.16);
      // cracks glow
      api.line(4, 6 + (i % 2), 12, 8 - (i % 2), '#fee761', 1);
      api.line(18, 20 - (i % 2), 28, 22 + (i % 2), '#fee761', 1);
      api.line(8, 24, 10, 16, '#feae34', 1);
      // rising bubbles
      const b = [[8, 26 - i * 2, 2], [22, 28 - ((i + 2) % 4) * 2, 3], [15, 20 - (i % 3), 1]];
      b.forEach(([x, y, r]) => {
        api.ellipse(x - r, y - r, x + r, y + r, '#f77622', true);
        api.ellipse(x - r, y - r, x + r - 1, y, '#fee761', true);
        api.px(x - 1, y - 1, '#ffffff');
      });
      // embers
      api.px((i * 7) % 32, (i * 5) % 32, '#fee761'); api.px((i * 11 + 9) % 32, (i * 3 + 4) % 32, '#ffffff');
      finish(buf);
    };
    return { width: 32, height: 32, name: 'rpg-lava', layers: [{ name: 'Lava' }],
      states: [D('bubble', 8, true, [0, 1, 2, 3].map(i => Fr(ms(8), frame(i))))] };
  }

  return { dungeonTilesSuite, villageSuite, dungeonPropsSuite, savepointSuite, waterfallSuite, lavaSuite };
})();
