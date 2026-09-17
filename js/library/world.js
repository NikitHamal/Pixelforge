/* PixelForge Studio — World tiles & props: animated water, grass/dungeon tilesets,
   trees, campfire, torch, chest, door, portal. Deterministic hash speckles. */
window.PF = window.PF || {};
PF.World = (() => {
  const D = (name, fps, loop, frames) => ({ name, fps, loop, frames });
  const Fr = (duration, paint) => ({ duration, paint });
  const ms = fps => Math.round(1000 / fps);
  const apiFor = (buf, W, H) => PF.Pixel.makeApi(buf, W, H);
  const OUT32 = PF.Color.hexToU32('#181425'); // cached: one lookup, not one per frame
  const finishProps = (buf, W, H) => buf.set(PF.Raster.outline(buf, W, H, OUT32));

  /* ---------- helpers ---------- */
  function speckle(api, W, H, seed, colors, density = 0.12) {
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const h = api.hash(x, y, seed);
      if (h < density) api.px(x, y, colors[Math.floor(h / density * colors.length) % colors.length]);
    }
  }
  function grassBase(api, W, H, variant) {
    api.rect(0, 0, W - 1, H - 1, '#3e8948');
    speckle(api, W, H, 10 + variant, ['#63c74d', '#265c42'], 0.18);
    // blades
    for (let i = 0; i < 6; i++) {
      const x = (api.hash(i, variant, 99) * W) | 0, y = (api.hash(i, variant, 77) * H) | 0;
      api.line(x, y, x, y - 2, '#63c74d', 1);
    }
    if (variant === 2) { // flowers
      api.px(4, 5, '#ffffff'); api.px(5, 5, '#fee761'); api.px(11, 10, '#f6757a'); api.px(11, 11, '#a22633');
    }
    if (variant === 3) { // pebbles
      api.rect(5, 6, 7, 7, '#8b9bb4'); api.rect(10, 10, 11, 11, '#5a6988');
    }
  }
  /* ---------- WATER (animated 4f, 16×16 tiled ×2) ---------- */
  function waterFrame(t) {
    return (buf, W, H) => {
      const api = apiFor(buf, W, H);
      api.rect(0, 0, W - 1, H - 1, '#124e89');
      speckle(api, W, H, 5, ['#0099db'], 0.1);
      // moving wave bands: sine offset rows
      for (let y = 2; y < H; y += 6) {
        for (let x = 0; x < W; x++) {
          const w = Math.sin(((x + t * 4) / W) * Math.PI * 2 + (y / H) * 3);
          if (w > 0.55) api.px(x, y, '#2ce8f5');
          else if (w > 0.3) api.px(x, y, '#0099db');
        }
      }
      // sparkles
      for (let i = 0; i < 4; i++) {
        const x = (api.hash(i, t, 31) * W) | 0, y = (api.hash(i, t, 47) * H) | 0;
        if ((i + t) % 2 === 0) api.px(x, y, '#ffffff');
      }
    };
  }
  /* ---------- TILESET doc: 64×64 with 4×4 tiles of 16px ---------- */
  function tilesetSuite() {
    const paint = (buf, W, H) => {
      const api = apiFor(buf, W, H);
      // 0,0 grass | 1,0 grass flowers | 0,1 dirt | 1,1 stone | 2,x dungeon brick | 3,x wood
      const tile = (tx, ty, fn) => {
        const ox = tx * 16, oy = ty * 16;
        const sub = PF.Pixel.offsetApi(api, ox, oy);
        fn(sub, 16, 16);
      };
      tile(0, 0, (a) => grassBase(a, 16, 16, 0));
      tile(1, 0, (a) => grassBase(a, 16, 16, 2));
      tile(2, 0, (a) => { // dirt
        a.rect(0, 0, 15, 15, '#b86f50');
        for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (a.hash(x, y, 3) < 0.15) a.px(x, y, '#733e39');
        for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (a.hash(x, y, 4) < 0.06) a.px(x, y, '#ead4aa');
      });
      tile(3, 0, (a) => { // stone
        a.rect(0, 0, 15, 15, '#8b9bb4');
        for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (a.hash(x, y, 6) < 0.14) a.px(x, y, '#5a6988');
        a.rect(2, 2, 6, 5, '#5a6988'); a.rect(9, 8, 14, 12, '#5a6988'); a.rect(3, 10, 7, 13, '#c0cbdc');
      });
      tile(0, 1, (a) => { // dungeon brick
        a.rect(0, 0, 15, 15, '#3a4466');
        a.rect(0, 0, 15, 15, '#3a4466');
        for (let y = 0; y <= 16; y += 5) a.line(0, y, 15, y, '#262b44', 1);
        for (let r = 0; r < 4; r++) for (let cx = (r % 2) * 4; cx < 16; cx += 8) a.line(cx, r * 5, cx, r * 5 + 4, '#262b44', 1);
        for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (a.hash(x, y, 8) < 0.05) a.px(x, y, '#5a6988');
      });
      tile(1, 1, (a) => { // wood planks
        a.rect(0, 0, 15, 15, '#b86f50');
        for (let y = 3; y < 16; y += 4) a.line(0, y, 15, y, '#733e39', 1);
        for (let i = 0; i < 4; i++) { const x = 3 + i * 4; a.line(x, (i % 2) * 4, x, (i % 2) * 4 + 3, '#733e39', 1); }
        for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (a.hash(x, y, 9) < 0.05) a.px(x, y, '#ead4aa');
      });
      tile(2, 1, (a) => { // sand
        a.rect(0, 0, 15, 15, '#ead4aa');
        for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (a.hash(x, y, 11) < 0.1) a.px(x, y, '#c8b28a');
      });
      tile(3, 1, (a) => { // dark dungeon floor
        a.rect(0, 0, 15, 15, '#262b44');
        a.rect(1, 1, 14, 14, '#262b44');
        for (let y = 0; y < 16; y += 4) for (let x = 0; x < 16; x += 4) a.px(x, y, '#3a4466');
      });
      // row 2-3: autotile edges / decorations kept simple: fence, flowers, etc. as tiles
      tile(0, 2, (a) => { // grass→dirt edge
        grassBase(a, 16, 16, 1);
        for (let x = 0; x < 16; x++) { const e = Math.round(10 + Math.sin(x * 1.2) * 2); for (let y = e; y < 16; y++) a.px(x, y, '#b86f50'); }
      });
      tile(1, 2, (a) => { grassBase(a, 16, 16, 0); a.rect(3, 8, 12, 12, '#3e8948'); a.rect(4, 5, 11, 8, '#265c42'); a.px(6, 6, '#e43b44'); a.px(10, 7, '#e43b44'); }); // bush tile
      tile(2, 2, (a) => { a.rect(0, 0, 15, 15, '#124e89'); a.rect(0, 6, 15, 15, '#0099db'); a.line(0, 6, 15, 6, '#2ce8f5', 1); }); // water edge
      tile(3, 2, (a) => { a.rect(0, 0, 15, 15, '#3e2731'); for (let i = 0; i < 8; i++) a.px((a.hash(i, 1, 50) * 16) | 0, (a.hash(i, 2, 51) * 16) | 0, '#5a6988'); }); // cave wall
      tile(0, 3, (a) => { // fence horizontal
        grassBase(a, 16, 16, 0);
        a.rect(0, 5, 15, 7, '#b86f50'); a.rect(0, 8, 15, 9, '#733e39');
        a.rect(2, 3, 4, 12, '#b86f50'); a.rect(11, 3, 13, 12, '#b86f50');
      });
      tile(1, 3, (a) => { // path stones
        grassBase(a, 16, 16, 3);
        a.ellipse(3, 4, 8, 8, '#8b9bb4', true); a.ellipse(9, 9, 13, 13, '#8b9bb4', true);
      });
      tile(2, 3, (a) => { // lava
        a.rect(0, 0, 15, 15, '#a22633');
        for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (a.hash(x, y, 60 + ((x + y) % 3)) < 0.2) a.px(x, y, '#f77622');
        for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (a.hash(x, y, 70) < 0.05) a.px(x, y, '#fee761');
      });
      tile(3, 3, (a) => { // ice
        a.rect(0, 0, 15, 15, '#2ce8f5');
        for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (a.hash(x, y, 71) < 0.12) a.px(x, y, '#ffffff');
        a.line(0, 0, 15, 15, '#ffffff', 1);
      });
    };
    return { width: 64, height: 64, name: 'tileset', layers: [{ name: 'Tiles' }],
      states: [D('tiles', 1, true, [Fr(500, paint)])] };
  }

  /* ---------- TREES & PLANTS: swaying idle loops (rock sits still, as rocks do) ---------- */
  function floraSuite() {
    // sw = canopy offset per frame; every loop is seamless AND first/last differ
    const paintTree = (variant, sw, t = 0) => (buf, W, H) => {
      const api = apiFor(buf, W, H);
      const X = x => x + sw;
      if (variant === 0) { // oak: canopy breathes + a leaf drops each cycle
        api.rect(14, 20, 17, 28, '#733e39'); api.rect(17, 22, 17, 28, '#3e2731');
        api.ellipse(X(6), 6, X(25), 21, '#3e8948', true);
        api.ellipse(X(9), 8, X(20), 17, '#63c74d', true);
        api.ellipse(X(17), 12, X(24), 20, '#265c42', true);
        api.px(X(11), 10, '#e43b44'); api.px(X(19), 9, '#e43b44'); api.px(X(15), 14, '#e43b44');
        api.px(22 - t, Math.min(27, 22 + t), t % 2 ? '#63c74d' : '#3e8948'); // falling leaf
      } else if (variant === 1) { // pine: tiers sway + snow shimmer
        api.rect(14, 22, 17, 28, '#3e2731');
        api.ellipse(X(11), 16, X(20), 23, '#265c42', true);
        api.ellipse(X(9), 11, X(22), 18, '#3e8948', true);
        api.ellipse(X(11), 5, X(20), 13, '#265c42', true);
        api.rect(X(15), 3, X(16), 6, '#265c42');
        [[15, 10], [13, 15], [17, 19]].forEach(([x, y], k) => api.px(X(x) + ((t + k) % 2 ? 1 : 0), y, '#ffffff'));
      } else if (variant === 2) { // bush: canopy shifts + berry glint phase
        api.ellipse(X(7), 18, X(24), 27, '#3e8948', true);
        api.ellipse(X(10), 19, X(20), 25, '#63c74d', true);
        api.px(X(12), 21, '#e43b44'); api.px(X(17), 22, '#e43b44');
        if (sw !== 0) { api.px(X(12), 20, '#ffffff'); api.px(X(17), 21, '#ffffff'); }
      } else if (variant === 3) { // rock: still
        api.ellipse(8, 18, 23, 27, '#8b9bb4', true);
        api.ellipse(11, 19, 19, 25, '#c0cbdc', true);
        api.ellipse(15, 21, 22, 26, '#5a6988', true);
      } else if (variant === 4) { // flowers: stems bend, heads bob
        api.rect(15, 24, 16, 27, '#3e8948');
        [[11, 17, '#e43b44'], [20, 16, '#ffffff'], [14, 23, '#f6757a']].forEach(([hx, hy, c], k) => {
          const bx = 13 + k * 2;
          api.line(bx, 27, hx + sw, hy + 2, '#3e8948', 1);
          api.rect(hx + sw - 1, hy, hx + sw + 2, hy + 3, c);
          api.px(hx + sw, hy + 1, '#fee761');
        });
      } else { // grass tuft: blades lean side to side
        const lean = sw === 0 ? 1 : -1;
        for (let k = -2; k <= 2; k++) api.line(16 + k * 3, 27, 16 + k * 3 + lean, 21, k % 2 ? '#63c74d' : '#3e8948', 1);
      }
      finishProps(buf, W, H);
    };
    // [state, variant, sway-table, fps] — frame 0 is always the rest pose (sw 0)
    const defs = [
      ['oak', 0, [0, 1, 0, -1], 5], ['pine', 1, [0, 1, 0, -1], 5],
      ['bush', 2, [0, 1, -1], 6], ['rock', 3, [0], 1],
      ['flowers', 4, [0, 1, -1], 6], ['tuft', 5, [0, 1], 6]];
    return { width: 32, height: 32, name: 'flora', layers: [{ name: 'Body' }],
      states: defs.map(([n, v, table, fps]) => D(n, fps, true,
        table.map((sw, t) => Fr(v === 3 ? 500 : ms(fps), paintTree(v, sw, t))))) };
  }

  /* ---------- CAMPFIRE (animated) ---------- */
  function campfireSuite() {
    const frames = [];
    for (let t = 0; t < 4; t++) {
      frames.push(Fr(ms(8), (buf, W, H) => {
        const api = apiFor(buf, W, H);
        // stones ring
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2;
          api.rect(Math.round(16 + Math.cos(a) * 9) - 1, 25 + Math.round(Math.sin(a) * 3), Math.round(16 + Math.cos(a) * 9) + 1, 27 + Math.round(Math.sin(a) * 3), '#8b9bb4');
        }
        // logs
        api.line(9, 25, 23, 23, '#733e39', 2);
        api.line(9, 23, 23, 25, '#b86f50', 2);
        // flames: 3 layered ellipses flickering with sine
        const f1 = Math.sin(t * 1.7) * 2, f2 = Math.cos(t * 2.3) * 2;
        api.ellipse(11, 12 + f1 * 0.4, 21, 24, '#f77622', true);
        api.ellipse(12 + f2 * 0.3, 15, 20, 24, '#feae34', true);
        api.ellipse(14, 18 + f1 * 0.3, 18, 24, '#fee761', true);
        api.px(16, 20, '#ffffff');
        // sparks
        for (let i = 0; i < 3; i++) {
          const x = 12 + ((t * 5 + i * 7) % 9), y = 10 - ((t * 3 + i * 2) % 6);
          api.px(x, y, '#fee761');
        }
        finishProps(buf, W, H);
      }));
    }
    return { width: 32, height: 32, name: 'campfire', layers: [{ name: 'Body' }], states: [D('burn', 8, true, frames)] };
  }

  /* ---------- TORCH ---------- */
  function torchSuite() {
    const frames = [];
    for (let t = 0; t < 4; t++) {
      frames.push(Fr(ms(8), (buf, W, H) => {
        const api = apiFor(buf, W, H);
        api.rect(14, 14, 17, 28, '#733e39');
        api.rect(16, 14, 17, 28, '#3e2731');
        api.rect(13, 12, 18, 15, '#3e2731');
        // the old sway was a fractional sine rounded away to zero, so all four
        // frames were identical; use whole-pixel offsets and a height beat
        const w = Math.round(Math.sin(t * 1.57) * 2), h = [0, 1, 2, 1][t];
        api.ellipse(11 + w, 2 + h, 20 + w, 13 + h, '#f77622', true);
        api.ellipse(13 + w, 5 + h, 18 + w, 13, '#fee761', true);
        api.px(15 + w, 8 + h, '#ffffff');
        api.px(14 + w, 4 + h, '#fff6c9');
        finishProps(buf, W, H);
      }));
    }
    return { width: 32, height: 32, name: 'torch', layers: [{ name: 'Body' }], states: [D('burn', 8, true, frames)] };
  }

  /* ---------- CHEST ---------- */
  function chestSuite() {
    const closed = (buf, W, H) => {
      const api = apiFor(buf, W, H);
      api.rect(6, 12, 25, 27, '#b86f50');
      api.rect(6, 12, 25, 18, '#733e39');
      api.rect(6, 17, 25, 18, '#3e2731');
      api.line(6, 12, 25, 12, '#ead4aa', 1);
      api.rect(14, 15, 17, 21, '#feae34'); api.px(15, 18, '#3e2731');
      api.line(15, 12, 15, 27, '#733e39', 1); api.line(16, 12, 16, 27, '#733e39', 1);
      finishProps(buf, W, H);
    };
    return { width: 32, height: 32, name: 'chest', layers: [{ name: 'Body' }], states: [
      D('closed', 1, true, [Fr(500, closed)]),
      D('open', 8, false, [
        Fr(ms(8), closed),
        Fr(ms(8), (buf, W, H) => { const api = apiFor(buf, W, H); api.rect(6, 18, 25, 27, '#b86f50'); api.rect(6, 6, 25, 12, '#733e39'); api.rect(14, 20, 17, 24, '#3e2731'); api.rect(10, 14, 21, 18, '#fee761'); api.px(15, 15, '#ffffff'); finishProps(buf, W, H); }),
        Fr(ms(8), (buf, W, H) => { const api = apiFor(buf, W, H); api.rect(6, 18, 25, 27, '#b86f50'); api.rect(6, 3, 25, 9, '#733e39'); api.rect(10, 12, 21, 18, '#fee761'); api.px(13, 13, '#ffffff'); api.px(18, 14, '#ffffff'); PF.Pixel.sparks(api, 16, 10, 1, '#fee761', 6, 2, 5); finishProps(buf, W, H); }),
        Fr(ms(8), (buf, W, H) => { const api = apiFor(buf, W, H); api.rect(6, 18, 25, 27, '#b86f50'); api.rect(6, 3, 25, 9, '#733e39'); api.rect(10, 14, 21, 18, '#fee761'); api.px(15, 15, '#ffffff'); finishProps(buf, W, H); })
      ])
    ] };
  }

  /* ---------- DOOR + PORTAL ---------- */
  function doorSuite() {
    const door = (open) => (buf, W, H) => {
      const api = apiFor(buf, W, H);
      api.rect(6, 2, 25, 28, '#3e2731');
      api.rect(8, 4, 23, 28, '#733e39');
      if (!open) {
        for (let y = 4; y < 28; y += 4) api.line(8, y, 23, y, '#3e2731', 1);
        api.px(21, 17, '#fee761');
      } else {
        api.rect(8, 4, 23, 28, '#181425');
        api.rect(8, 4, 12, 28, '#b86f50');
        api.rect(8, 4, 12, 28, '#b86f50');
        api.px(10, 17, '#fee761');
        api.rect(14, 6, 22, 26, '#2ce8f5');
        api.rect(15, 7, 21, 25, '#124e89');
      }
      finishProps(buf, W, H);
    };
    return { width: 32, height: 32, name: 'door', layers: [{ name: 'Body' }], states: [
      D('closed', 1, true, [Fr(500, door(false))]),
      D('open', 8, false, [Fr(ms(8), door(false)), Fr(ms(8), door(true))])
    ] };
  }
  function portalSuite() {
    const frames = [];
    for (let t = 0; t < 4; t++) {
      frames.push(Fr(ms(8), (buf, W, H) => {
        const api = apiFor(buf, W, H);
        // stone pillars
        api.rect(4, 6, 8, 28, '#5a6988'); api.rect(23, 6, 27, 28, '#5a6988');
        api.rect(3, 3, 9, 6, '#8b9bb4'); api.rect(22, 3, 28, 6, '#8b9bb4');
        // swirling gate: concentric ellipses offset by sine
        const s = Math.sin(t * Math.PI / 2);
        api.ellipse(9, 6, 22, 28, '#2a0fa8', true);
        api.ellipse(11, 8 + s, 20, 26, '#5a38f0', true);
        api.ellipse(13, 10 - s, 18, 24, '#2ce8f5', true);
        api.ellipse(14, 12 + s, 17, 22, '#ffffff', true);
        finishProps(buf, W, H);
      }));
    }
    return { width: 32, height: 32, name: 'portal', layers: [{ name: 'Body' }], states: [D('swirl', 8, true, frames)] };
  }

  /* ---------- WATER TILE (separate animated) ---------- */
  function waterSuite() {
    return { width: 32, height: 32, name: 'water', layers: [{ name: 'Water' }],
      states: [D('flow', 6, true, [0, 1, 2, 3].map(t => Fr(ms(6), waterFrame(t))))] };
  }

  /* ---------- MAGIC CRYSTAL NODE ---------- */
  function crystalFrame(pulse, hit, shatter) {
    return (buf, W, H) => {
      const api = apiFor(buf, W, H), cx = 16;
      if (shatter) {
        api.ellipse(9, 23, 23, 27, '#5a6988', true);
        api.ellipse(11, 24, 21, 26, '#3a4466', true);
        PF.Pixel.sparks(api, cx, 22, shatter, '#2ce8f5', 6, 4, 10);
        api.px(8, 25, '#c0cbdc'); api.px(24, 25, '#c0cbdc');
        finishProps(buf, W, H); return;
      }
      api.ellipse(8, 21, 24, 27, '#5a6988', true);
      api.ellipse(10, 23, 22, 26, '#3a4466', true);
      const p = pulse !== undefined ? Math.sin(pulse * Math.PI / 2) * 1.5 : 0;
      const C1 = '#2ce8f5', C2 = '#0099db', C3 = '#124e89', Hi = '#ffffff';
      api.line(cx, 6 - p, cx - 4, 22, C2, 2);
      api.line(cx, 6 - p, cx + 4, 22, C3, 2);
      api.line(cx, 6 - p, cx, 22, C1, 2);
      api.line(cx - 1, 7 - p, cx - 1, 18, Hi, 1);
      api.line(cx - 5, 12 - p * 0.5, cx - 8, 23, C2, 2);
      api.line(cx - 5, 12 - p * 0.5, cx - 3, 23, C1, 1);
      api.line(cx + 5, 14 - p * 0.5, cx + 8, 23, C3, 2);
      api.line(cx + 5, 14 - p * 0.5, cx + 3, 23, C1, 1);
      if (pulse === 1 || pulse === 3) {
        api.px(cx, 5 - p, Hi);
        api.px(cx - 6, 11 - p * 0.5, Hi);
        api.px(cx + 6, 13 - p * 0.5, Hi);
      }
      if (hit) PF.Pixel.sparks(api, cx, 14, 2, '#2ce8f5', 8, 2, 7);
      finishProps(buf, W, H);
    };
  }
  function crystalSuite() {
    return { width: 32, height: 32, name: 'crystal', layers: [{ name: 'Props' }], states: [
      D('pulse', 6, true, [0, 1, 2, 3].map(t => Fr(ms(6), crystalFrame(t)))),
      D('hit', 8, true, [Fr(ms(8), crystalFrame(0, true)), Fr(ms(8), crystalFrame(1, true)), Fr(ms(8), crystalFrame(0))]),
      D('shatter', 8, false, [Fr(ms(8), crystalFrame(0, true)), Fr(ms(8), crystalFrame(undefined, false, 1)), Fr(ms(8), crystalFrame(undefined, false, 2)), Fr(ms(8), crystalFrame(undefined, false, 3))])
    ] };
  }

  return { tilesetSuite, floraSuite, campfireSuite, torchSuite, chestSuite, doorSuite, portalSuite, waterSuite, crystalSuite };
})();

