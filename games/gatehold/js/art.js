/* Gatehold — all of the game's art, painted at runtime with PF.Pixel.

   Reference-matched palette: the clip this game is modelled on is a muted
   olive/khaki settlement at dawn, so the ground is a low-saturation green and
   the only saturated things on screen are the people, the swarm and the UI.

   Everything here is deterministic (api.hash, never Math.random) and every
   sprite gets the house 1px #181425 outline pass, so a sprite dropped on any
   ground tile still reads as an object rather than a smudge. */
window.GH = window.GH || {};
GH.ART = (() => {
  'use strict';

  const T = 16;                       // one world tile, in pixels

  const PAL = {
    out: '#181425',
    /* ground */
    grass: '#4f5629', grassLt: '#616a33', grassDk: '#3a4020', grassHi: '#6f7a3c',
    tall: '#3f4a22', tallLt: '#5d6a2e',
    dirt: '#6b5c38', dirtLt: '#8c8054', dirtDk: '#4d4227',
    field: '#5a4a2c', fieldLt: '#6d5a35',
    gravel: '#7a7566', gravelLt: '#948e7c', gravelDk: '#565246',
    water: '#2f4a4e', waterLt: '#3f6167', waterDk: '#22383c',
    shore: '#8a7c52',
    /* structure */
    wood: '#6b4a2a', woodLt: '#8a6134', woodHi: '#a3763f', woodDk: '#4a3220',
    leaf: '#3f5230', leafLt: '#556b3a', leafDk: '#2c3a22',
    stone: '#7a7566', stoneLt: '#948e7c', stoneDk: '#565040',
    cloth: '#8a6a3a', clothLt: '#b08a4c',
    /* swarm */
    ant: '#4a2a1c', antDk: '#2c1811', antLt: '#7a4a2c', antHi: '#a3673a', antEye: '#d8442e',
    /* ui */
    ink: '#e8dcc0', inkDim: '#9a8f74', gold: '#d9a94a', bad: '#c0503a', good: '#8fae55',
    panel: '#1b1318'
  };

  const cache = new Map();
  const mem = (key, fn) => {
    if (cache.has(key)) return cache.get(key);
    const v = fn();
    cache.set(key, v);
    return v;
  };

  /* ------------------------------------------------------------ painting */

  /* Paint into a fresh canvas through a PF.Pixel Api. The Api writes ABGR
     u32s straight into ImageData, which is the whole reason the library and
     the games share one drawing language. */
  function mk(w, h, fn) {
    const cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    const ctx = cv.getContext('2d');
    const img = ctx.createImageData(w, h);
    const buf = new Uint32Array(img.data.buffer);
    const api = PF.Pixel.makeApi(buf, w, h);
    fn(api, buf, w, h);
    ctx.putImageData(img, 0, 0);
    return cv;
  }

  /* Trace the silhouette of whatever is already opaque and put the house
     outline colour on every transparent pixel touching it. Same rule the
     library applies to templates — run it LAST. */
  function outline(api, buf, w, h, col) {
    const c = PF.Color.hexToU32(col || PAL.out);
    const src = buf.slice();
    for (let y = 0; y < h; y++) {
      const row = y * w;
      for (let x = 0; x < w; x++) {
        if (src[row + x]) continue;
        let touch = false;
        if (x > 0 && src[row + x - 1]) touch = true;
        else if (x < w - 1 && src[row + x + 1]) touch = true;
        else if (y > 0 && src[row - w + x]) touch = true;
        else if (y < h - 1 && src[row + w + x]) touch = true;
        if (touch) buf[row + x] = c;
      }
    }
  }

  /* Deterministic grain. Flat 16px fills read as plastic; a few speckles
     keyed on tile-local coordinates make grass read as grass. */
  function grain(api, x0, y0, x1, y1, cols, dens, seed) {
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const r = api.hash(x, y, seed);
        if (r < dens) api.px(x, y, cols[(r * 977) % cols.length | 0]);
      }
    }
  }

  /* ------------------------------------------------------------- terrain */

  function plain(base, lights, darks, dens, seed) {
    return mk(T, T, api => {
      api.rect(0, 0, T - 1, T - 1, base);
      for (let y = 0; y < T; y++) {
        for (let x = 0; x < T; x++) {
          const r = api.hash(x, y, seed);
          if (r < dens) api.px(x, y, lights[(r * 613) % lights.length | 0]);
          else if (r > 1 - dens * 0.7) api.px(x, y, darks[(r * 421) % darks.length | 0]);
        }
      }
    });
  }

  const ground = {
    grass: () => plain(PAL.grass, [PAL.grassLt, PAL.grassHi], [PAL.grassDk], 0.20, 7),
    grass2: () => plain(PAL.grass, [PAL.grassLt], [PAL.grassDk, '#333a1c'], 0.26, 23),
    grass3: () => mk(T, T, api => {
      api.rect(0, 0, T - 1, T - 1, '#545c2c');
      grain(api, 0, 0, T - 1, T - 1, [PAL.grassLt, PAL.grassDk], 0.22, 41);
      for (const [x, y] of [[3, 5], [11, 3], [6, 12], [13, 10]]) api.rect(x, y, x + 1, y, PAL.grassHi);
    }),
    tall: () => mk(T, T, api => {
      api.rect(0, 0, T - 1, T - 1, PAL.tall);
      grain(api, 0, 0, T - 1, T - 1, [PAL.tallLt, '#2f3a1a'], 0.24, 19);
      for (let x = 1; x < T; x += 3) for (let y = 2; y < T; y += 5) api.line(x, y + 2, x + 1, y - 1, PAL.tallLt, 1);
    }),
    dirt: () => plain(PAL.dirt, [PAL.dirtLt, '#7d7048'], [PAL.dirtDk], 0.30, 31),
    road: () => mk(T, T, api => {
      api.rect(0, 0, T - 1, T - 1, '#7d6f47');
      grain(api, 0, 0, T - 1, T - 1, [PAL.dirtLt, PAL.dirtDk, '#6a5e3c'], 0.34, 37);
      for (const [x, y] of [[2, 3], [9, 2], [12, 8], [4, 11], [7, 6]]) {
        api.rect(x, y, x + 1, y + 1, PAL.dirtLt);
        api.px(x + 1, y + 1, PAL.dirtDk);
      }
    }),
    field: () => mk(T, T, api => {
      api.rect(0, 0, T - 1, T - 1, PAL.field);
      for (let y = 1; y < T; y += 3) {
        api.rect(0, y, T - 1, y, PAL.fieldLt);
        api.rect(0, y + 1, T - 1, y + 1, '#453819');
      }
      grain(api, 0, 0, T - 1, T - 1, ['#4a3d22'], 0.12, 53);
    }),
    gravel: () => mk(T, T, api => {
      api.rect(0, 0, T - 1, T - 1, PAL.gravel);
      grain(api, 0, 0, T - 1, T - 1, [PAL.gravelLt, PAL.gravelDk], 0.36, 47);
      for (const [x, y] of [[3, 4], [10, 3], [12, 10], [5, 12]]) { api.rect(x, y, x + 1, y + 1, PAL.gravelLt); api.px(x, y + 1, PAL.gravelDk); }
    }),
    water: () => mk(T, T, api => {
      for (let y = 0; y < T; y++) {
        for (let x = 0; x < T; x++) {
          const v = Math.sin((x / T) * Math.PI * 2 + Math.cos((y / T) * Math.PI * 2) * 1.3)
            + Math.sin(((x + y) / T) * Math.PI * 4) * 0.5;
          api.px(x, y, v > 1.2 ? PAL.waterLt : v < -1.1 ? PAL.waterDk : PAL.water);
        }
      }
    }),
    shore: () => plain(PAL.shore, ['#a09263', '#9c8e5f'], ['#6f6340'], 0.3, 59),
    stony: () => mk(T, T, api => {
      api.rect(0, 0, T - 1, T - 1, '#5c5a44');
      grain(api, 0, 0, T - 1, T - 1, [PAL.stone, PAL.stoneDk, '#4a4838'], 0.3, 61);
      for (const [x, y] of [[4, 4], [11, 8]]) { api.rect(x, y, x + 3, y + 2, PAL.stone); api.rect(x, y + 2, x + 3, y + 2, PAL.stoneDk); }
    })
  };

  /* --------------------------------------------------------------- props */

  const props = {
    /* Trees are the wood nodes: a mass of leaf blobs over a trunk, with the
       outline pass fusing the blobs into one canopy. */
    pine: () => mk(20, 28, (api, buf) => {
      api.rect(9, 20, 11, 27, PAL.woodDk);
      api.rect(9, 20, 10, 27, PAL.wood);
      for (let i = 0; i < 4; i++) {
        const y = 2 + i * 5, half = 2 + i * 2.6;
        api.ellipse(10 - half, y, 10 + half, y + 8, i % 2 ? PAL.leafLt : PAL.leaf, true);
      }
      for (let i = 0; i < 12; i++) {
        const a = i / 12 * Math.PI * 2;
        api.px(10 + Math.cos(a) * 6, 12 + Math.sin(a) * 8, PAL.leafDk);
      }
      api.rect(8, 12, 10, 14, PAL.leafLt);
      outline(api, buf, 20, 28);
    }),
    oak: () => mk(22, 26, (api, buf) => {
      api.rect(10, 17, 12, 25, PAL.woodDk);
      api.rect(10, 17, 11, 25, PAL.wood);
      api.ellipse(1, 1, 20, 19, PAL.leaf, true);
      api.ellipse(3, 8, 13, 18, PAL.leafDk, true);
      api.ellipse(6, 2, 18, 10, PAL.leafLt, true);
      api.rect(9, 4, 12, 7, PAL.leafLt);
      outline(api, buf, 22, 26);
    }),
    bush: () => mk(16, 14, (api, buf) => {
      api.ellipse(1, 4, 14, 13, PAL.leaf, true);
      api.ellipse(2, 2, 8, 8, PAL.leafLt, true);
      api.rect(9, 7, 12, 9, PAL.leafDk);
      api.px(4, 5, '#a8442c'); api.px(11, 8, '#c0503a'); api.px(6, 9, '#a8442c');   // berries = food node
      outline(api, buf, 16, 14);
    }),
    rock: () => mk(16, 12, (api, buf) => {
      api.ellipse(1, 4, 14, 11, PAL.stone, true);
      api.ellipse(3, 3, 9, 8, PAL.stoneLt, true);
      api.rect(9, 7, 12, 9, PAL.stoneDk);
      outline(api, buf, 16, 12);
    }),
    boulder: () => mk(24, 20, (api, buf) => {
      api.ellipse(1, 5, 22, 19, PAL.stoneDk, true);
      api.ellipse(2, 3, 20, 16, PAL.stone, true);
      api.ellipse(5, 2, 15, 10, PAL.stoneLt, true);
      api.rect(15, 12, 20, 16, PAL.stoneDk);
      outline(api, buf, 24, 20);
    }),
    stump: () => mk(14, 12, (api, buf) => {
      api.rect(2, 3, 11, 11, PAL.woodDk);
      api.ellipse(2, 2, 11, 7, PAL.wood, true);
      api.ellipse(4, 3, 9, 5, PAL.woodLt, true);
      outline(api, buf, 14, 12);
    }),
    logpile: () => mk(22, 16, (api, buf) => {
      for (const [x, y] of [[1, 8], [8, 8], [15, 8], [4, 2], [11, 2]]) {
        api.rect(x, y, x + 6, y + 5, PAL.woodDk);
        api.rect(x, y, x + 6, y + 4, PAL.wood);
        api.ellipse(x + 1, y + 1, x + 2, y + 3, PAL.woodHi, true);
      }
      outline(api, buf, 22, 16);
    }),
    crate: () => mk(16, 16, (api, buf) => {
      api.rect(1, 3, 14, 14, PAL.wood);
      api.rectO(1, 3, 14, 14, PAL.woodDk);
      api.rect(1, 8, 14, 9, PAL.woodDk);
      api.rect(7, 3, 8, 14, PAL.woodDk);
      api.rect(2, 4, 6, 7, PAL.woodLt);
      outline(api, buf, 16, 16);
    }),
    reed: () => mk(16, 16, (api, buf) => {
      for (let x = 2; x < 14; x += 3) { api.line(x, 15, x + 1, 5, PAL.tallLt, 1); api.px(x + 1, 4, '#8a9a4c'); }
      outline(api, buf, 16, 16);
    }),
    signpost: () => mk(12, 20, (api, buf) => {
      api.rect(5, 6, 6, 19, PAL.woodDk);
      api.rect(1, 4, 10, 9, PAL.wood);
      api.rect(1, 4, 10, 4, PAL.woodLt);
      api.px(3, 7, PAL.ink); api.px(8, 7, PAL.ink);
      outline(api, buf, 12, 20);
    }),
    campfire: () => mk(16, 16, (api, buf) => {
      api.ellipse(1, 9, 14, 14, PAL.stoneDk, true);
      api.rect(4, 9, 11, 13, '#3a2418');
      api.rect(3, 10, 12, 11, PAL.woodDk);
      api.ellipse(5, 3, 10, 10, '#e07a30', true);
      api.ellipse(6, 4, 9, 9, '#f6c24a', true);
      outline(api, buf, 16, 16);
    })
  };

  /* ----------------------------------------------------------- buildings */

  /* Palisade sections. Posts on both edges so a run of them reads as one
     fence however the player drags the wall. */
  const wallBase = (api, buf, w, h, top) => {
    api.rect(1, 0, w - 2, h - 1, PAL.wood);
    for (let x = 2; x < w - 1; x += 4) api.rect(x, 1, x, h - 2, PAL.woodDk);
    api.rect(0, 0, 2, h - 1, PAL.woodDk);
    api.rect(w - 3, 0, w - 1, h - 1, PAL.woodDk);
    api.rect(0, 0, w - 1, 2, top || PAL.woodHi);
    api.rect(1, 3, w - 2, 4, PAL.woodLt);
    outline(api, buf, w, h);
  };

  const build = {
    wall: () => mk(16, 16, (api, buf) => wallBase(api, buf, 16, 16)),
    wallH: () => mk(16, 16, (api, buf) => wallBase(api, buf, 16, 16)),
    gate: () => mk(16, 24, (api, buf) => {
      api.rect(0, 2, 3, 23, PAL.woodDk);
      api.rect(12, 2, 15, 23, PAL.woodDk);
      api.rect(0, 2, 3, 4, PAL.woodHi);
      api.rect(12, 2, 15, 4, PAL.woodHi);
      for (let y = 6; y < 22; y += 4) api.rect(4, y, 11, y + 1, PAL.wood);
      api.rect(4, 6, 11, 21, PAL.woodDk === PAL.wood ? PAL.wood : '#4a3220');
      for (let y = 6; y < 22; y += 4) api.rect(4, y, 11, y + 1, PAL.woodLt);
      api.rect(7, 2, 8, 6, PAL.woodHi);
      outline(api, buf, 16, 24);
    }),
    gateOpen: () => mk(16, 24, (api, buf) => {
      api.rect(0, 2, 3, 23, PAL.woodDk);
      api.rect(12, 2, 15, 23, PAL.woodDk);
      api.rect(0, 2, 3, 4, PAL.woodHi);
      api.rect(12, 2, 15, 4, PAL.woodHi);
      api.rect(4, 12, 11, 23, '#3a3a2a55');
      api.px(4, 12, PAL.out); api.px(11, 12, PAL.out);
      outline(api, buf, 16, 24);
    }),
    tower: () => mk(24, 34, (api, buf) => {
      api.rect(6, 8, 17, 33, PAL.wood);
      api.rect(6, 8, 17, 10, PAL.woodLt);
      for (let y = 12; y < 32; y += 5) api.rect(6, y, 17, y + 1, PAL.woodDk);
      api.rect(2, 2, 21, 9, PAL.stone);
      api.rect(2, 2, 21, 4, PAL.stoneLt);
      for (const x of [3, 8, 13, 18]) api.rect(x, 0, x + 2, 3, PAL.stoneDk);
      api.rect(9, 14, 14, 18, '#241a12');
      api.rect(0, 5, 24, 6, PAL.woodDk);
      outline(api, buf, 24, 34);
    }),
    house: () => mk(32, 30, (api, buf) => {
      api.rect(2, 10, 29, 29, PAL.wood);
      api.rect(2, 10, 29, 13, PAL.woodLt);
      for (let x = 4; x < 29; x += 5) api.rect(x, 14, x, 28, PAL.woodDk);
      api.rect(4, 2, 27, 14, PAL.leaf);
      api.rect(4, 2, 27, 5, PAL.leafLt);
      for (let x = 4; x < 28; x += 4) api.rect(x, 5, x, 13, PAL.leafDk);
      api.rect(13, 20, 18, 29, PAL.woodDk);
      api.rect(14, 21, 17, 28, '#2c2018');
      api.rect(5, 16, 8, 19, '#2c2018');
      api.rect(23, 16, 26, 19, '#2c2018');
      outline(api, buf, 32, 30);
    }),
    storehouse: () => mk(34, 30, (api, buf) => {
      api.rect(2, 8, 31, 29, PAL.wood);
      api.rect(2, 8, 31, 11, PAL.woodLt);
      for (let x = 5; x < 30; x += 6) api.rect(x, 12, x, 28, PAL.woodDk);
      api.rect(0, 0, 33, 10, PAL.cloth);
      api.rect(0, 0, 33, 3, PAL.clothLt);
      api.rect(14, 18, 21, 29, '#2c2018');
      api.rect(6, 14, 11, 18, PAL.woodHi);
      api.rect(24, 14, 29, 18, PAL.woodHi);
      outline(api, buf, 34, 30);
    }),
    hearth: () => mk(48, 40, (api, buf) => {
      api.ellipse(2, 8, 45, 38, PAL.stoneDk, true);
      api.ellipse(3, 7, 44, 36, PAL.stone, true);
      api.rect(6, 12, 41, 37, PAL.wood);
      api.rect(6, 12, 41, 15, PAL.woodLt);
      for (let x = 9; x < 40; x += 6) api.rect(x, 16, x, 36, PAL.woodDk);
      api.rect(2, 2, 45, 16, PAL.leaf);
      api.rect(2, 2, 45, 6, PAL.leafLt);
      for (let x = 3; x < 45; x += 5) api.rect(x, 6, x, 15, PAL.leafDk);
      api.rect(19, 22, 28, 37, '#2c2018');
      api.ellipse(21, 24, 26, 29, '#f6c24a', true);
      api.px(23, 26, '#e07a30'); api.px(24, 27, '#e07a30');
      outline(api, buf, 48, 40);
    }),
    farm: () => mk(32, 32, (api, buf) => {
      api.rect(1, 1, 30, 30, PAL.field);
      for (let y = 3; y < 30; y += 4) { api.rect(2, y, 29, y, PAL.fieldLt); api.rect(2, y + 1, 29, y + 1, '#453819'); }
      for (let y = 4; y < 30; y += 8) for (let x = 4; x < 30; x += 7) { api.rect(x, y + 1, x + 1, y + 3, PAL.tallLt); api.px(x, y, '#c9a227'); }
      outline(api, buf, 32, 32);
    }),
    lumber: () => mk(28, 24, (api, buf) => {
      api.rect(4, 6, 24, 23, PAL.wood);
      api.rect(4, 6, 24, 8, PAL.woodLt);
      api.rect(2, 2, 26, 8, PAL.leaf);
      api.rect(2, 2, 26, 4, PAL.leafLt);
      api.rect(11, 12, 18, 23, '#2c2018');
      api.rect(6, 12, 9, 16, PAL.woodHi);
      api.rect(20, 12, 23, 16, PAL.woodHi);
      outline(api, buf, 28, 24);
    }),
    quarry: () => mk(26, 24, (api, buf) => {
      api.ellipse(1, 6, 24, 23, '#4a4838', true);
      api.ellipse(2, 8, 23, 22, PAL.stoneDk, true);
      api.rect(4, 10, 11, 15, PAL.stone);
      api.rect(14, 12, 21, 18, PAL.stone);
      api.rect(4, 10, 11, 11, PAL.stoneLt);
      api.rect(14, 12, 21, 13, PAL.stoneLt);
      api.rect(2, 4, 9, 7, PAL.woodDk);
      api.rect(9, 4, 10, 12, PAL.woodDk);
      outline(api, buf, 26, 24);
    }),
    torch: () => mk(8, 20, (api, buf) => {
      api.rect(3, 6, 4, 19, PAL.woodDk);
      api.rect(2, 12, 5, 13, PAL.wood);
      api.ellipse(1, 1, 6, 7, '#e07a30', true);
      api.ellipse(2, 2, 5, 6, '#f6c24a', true);
      outline(api, buf, 8, 20);
    }),
    well: () => mk(18, 22, (api, buf) => {
      api.rect(2, 12, 15, 21, PAL.stoneDk);
      api.ellipse(2, 10, 15, 21, PAL.stone, true);
      api.ellipse(4, 12, 13, 18, '#241a12', true);
      api.rect(3, 14, 14, 15, PAL.stoneLt);
      api.rect(3, 2, 4, 12, PAL.woodDk);
      api.rect(13, 2, 14, 12, PAL.woodDk);
      api.rect(2, 1, 15, 4, PAL.wood);
      api.rect(2, 1, 15, 2, PAL.woodHi);
      api.rect(8, 4, 9, 8, PAL.woodDk);
      api.rect(7, 8, 10, 10, PAL.woodLt);
      outline(api, buf, 18, 22);
    }),
    scaffold: () => mk(16, 16, (api, buf) => {
      api.rectO(1, 1, 14, 14, PAL.gold);
      api.rect(1, 1, 14, 2, PAL.gold);
      api.rect(1, 13, 14, 14, PAL.gold);
      api.rect(7, 1, 8, 14, PAL.gold);
      api.px(3, 6, PAL.gold); api.px(12, 6, PAL.gold);
      api.px(3, 10, PAL.gold); api.px(12, 10, PAL.gold);
    })
  };

  /* -------------------------------------------------------------- swarm */

  /* Ants are the one family the library does not carry, so they are painted
     here: a segmented body, six bent legs, and a leg pose that alternates
     between frames so a walking column does not slide. `phase` is the leg
     cycle index, `kind` scales the body. */
  function antBody(api, w, h, kind, phase) {
    const cx = w / 2 | 0, cy = h / 2 | 0;
    const s = kind === 'major' ? 1.5 : kind === 'soldier' ? 1.15 : 1;
    const gaster = { x: cx - 5 * s, y: cy + 1 }, thorax = { x: cx, y: cy }, head = { x: cx + 4 * s, y: cy - 1 };
    /* legs: three pairs, alternating fore/aft on the phase */
    for (let i = 0; i < 3; i++) {
      const lx = thorax.x - 2 * s + i * 2 * s;
      const swing = ((i + phase) % 2) ? 2 : -2;
      api.line(lx, thorax.y + 1, lx - 2 * s + swing, cy + 5, PAL.antDk, 1);
      api.line(lx, thorax.y - 1, lx - 2 * s + swing, cy - 5, PAL.antDk, 1);
    }
    if (kind !== 'worker') {                        // mandibles on the fighters
      api.line(head.x + 1, head.y + 1, head.x + 3, head.y + 3, PAL.antHi, 1);
      api.line(head.x + 1, head.y - 1, head.x + 3, head.y - 3, PAL.antHi, 1);
    }
    api.ellipse(gaster.x - 4 * s, gaster.y - 3 * s, gaster.x + 2 * s, gaster.y + 4 * s, PAL.ant, true);
    api.ellipse(gaster.x - 3 * s, gaster.y - 2 * s, gaster.x + 1 * s, gaster.y + 2 * s, PAL.antLt, true);
    api.ellipse(thorax.x - 3 * s, thorax.y - 2 * s, thorax.x + 2 * s, thorax.y + 3 * s, PAL.antDk, true);
    api.ellipse(head.x - 2 * s, head.y - 2 * s, head.x + 2 * s, head.y + 2 * s, PAL.ant, true);
    api.px(head.x, head.y - 2, PAL.antHi);
    if (kind === 'major') { api.rect(head.x - 3, head.y - 4, head.x + 3, head.y + 4, PAL.ant); api.ellipse(head.x - 2, head.y - 3, head.x + 2, head.y + 3, PAL.antLt, true); }
    api.px(head.x + 1, head.y, PAL.antEye);
    if (kind === 'soldier' || kind === 'major') api.rect(head.x - 1, head.y - 1, head.x + 1, head.y + 1, PAL.antHi);
  }

  const swarm = {
    worker: () => mk(20, 18, (api, buf) => { antBody(api, 20, 18, 'worker', 0); outline(api, buf, 20, 18); }),
    soldier: () => mk(24, 20, (api, buf) => { antBody(api, 24, 20, 'soldier', 0); outline(api, buf, 24, 20); }),
    major: () => mk(32, 26, (api, buf) => { antBody(api, 32, 26, 'major', 0); outline(api, buf, 32, 26); }),
    /* Four leg poses per breed, keyed by frame. */
    worker_walk: () => mk(20, 18, (api, buf) => { antBody(api, 20, 18, 'worker', 1); outline(api, buf, 20, 18); }),
    soldier_walk: () => mk(24, 20, (api, buf) => { antBody(api, 24, 20, 'soldier', 1); outline(api, buf, 24, 20); }),
    major_walk: () => mk(32, 26, (api, buf) => { antBody(api, 32, 26, 'major', 1); outline(api, buf, 32, 26); })
  };

  /* --------------------------------------------------------------- icons */

  /* HUD pictograms. Drawn at 16x16 and handed to the DOM as data URLs, so the
     bar reads as pixel art rather than as emoji that depend on the OS font. */
  const icons = {
    wood: () => mk(14, 14, (api, buf) => {
      api.rect(1, 4, 12, 9, PAL.wood); api.rect(1, 4, 12, 5, PAL.woodLt);
      api.ellipse(9, 4, 12, 9, PAL.woodHi, true); api.px(11, 6, PAL.woodDk); api.px(10, 7, PAL.woodDk);
      outline(api, buf, 14, 14);
    }),
    food: () => mk(14, 14, (api, buf) => {
      api.line(7, 13, 7, 4, PAL.tallLt, 1);
      api.rect(3, 4, 6, 6, '#c9a227'); api.rect(8, 6, 11, 8, '#c9a227');
      api.rect(3, 2, 6, 4, '#e0bc4a'); api.rect(8, 4, 11, 6, '#e0bc4a');
      outline(api, buf, 14, 14);
    }),
    stone: () => mk(14, 14, (api, buf) => {
      api.ellipse(1, 5, 12, 13, PAL.stone, true);
      api.ellipse(3, 4, 9, 9, PAL.stoneLt, true);
      api.rect(8, 9, 11, 12, PAL.stoneDk);
      outline(api, buf, 14, 14);
    }),
    tool: () => mk(14, 14, (api, buf) => {
      api.rect(6, 3, 7, 13, PAL.woodLt);
      api.rect(2, 1, 11, 4, PAL.stone);
      api.rect(2, 1, 11, 2, PAL.stoneLt);
      outline(api, buf, 14, 14);
    }),
    pop: () => mk(14, 14, (api, buf) => {
      api.ellipse(4, 1, 10, 7, '#c28569', true);
      api.ellipse(1, 8, 13, 14, PAL.cloth, true);
      outline(api, buf, 14, 14);
    }),
    ant: () => mk(14, 14, (api, buf) => { antBody(api, 14, 14, 'soldier', 0); outline(api, buf, 14, 14); }),
    heart: () => mk(14, 14, (api, buf) => {
      api.rect(2, 2, 5, 5, '#c0503a'); api.rect(8, 2, 11, 5, '#c0503a');
      api.rect(1, 4, 12, 8, '#c0503a'); api.rect(3, 8, 10, 10, '#c0503a');
      api.rect(5, 10, 8, 12, '#c0503a');
      outline(api, buf, 14, 14);
    }),
    hammer: () => mk(14, 14, (api, buf) => {
      api.rect(6, 4, 7, 13, PAL.woodLt);
      api.rect(2, 1, 11, 5, PAL.stoneDk);
      api.rect(3, 2, 10, 3, PAL.stone);
      outline(api, buf, 14, 14);
    }),
    road: () => mk(14, 14, (api, buf) => {
      api.rect(2, 0, 11, 13, '#7d6f47');
      for (let y = 1; y < 13; y += 4) api.rect(2, y, 11, y, PAL.dirtDk);
      outline(api, buf, 14, 14);
    }),
    gate: () => mk(14, 14, (api, buf) => {
      api.rect(2, 1, 4, 13, PAL.woodDk); api.rect(9, 1, 11, 13, PAL.woodDk);
      for (let y = 3; y < 12; y += 3) api.rect(5, y, 8, y + 1, PAL.woodLt);
      outline(api, buf, 14, 14);
    }),
    wall: () => mk(14, 14, (api, buf) => {
      for (let x = 0; x < 14; x += 4) { api.rect(x, 1, x + 2, 13, PAL.wood); api.rect(x, 1, x + 2, 2, PAL.woodHi); }
      outline(api, buf, 14, 14);
    }),
    tower: () => mk(14, 14, (api, buf) => {
      api.rect(4, 4, 9, 13, PAL.wood); api.rect(2, 1, 11, 5, PAL.stone);
      api.rect(2, 1, 11, 2, PAL.stoneLt);
      outline(api, buf, 14, 14);
    }),
    house: () => mk(14, 14, (api, buf) => {
      api.rect(2, 6, 11, 13, PAL.wood); api.rect(1, 1, 12, 7, PAL.leaf);
      api.rect(1, 1, 12, 3, PAL.leafLt); api.rect(6, 9, 8, 13, '#2c2018');
      outline(api, buf, 14, 14);
    }),
    farm: () => mk(14, 14, (api, buf) => {
      api.rect(1, 2, 12, 13, PAL.field);
      for (let y = 3; y < 13; y += 3) api.rect(1, y, 12, y, PAL.fieldLt);
      api.px(4, 5, '#c9a227'); api.px(9, 8, '#c9a227');
      outline(api, buf, 14, 14);
    }),
    torch: () => mk(14, 14, (api, buf) => {
      api.rect(6, 5, 7, 13, PAL.woodDk);
      api.ellipse(4, 0, 9, 7, '#e07a30', true); api.ellipse(5, 1, 8, 6, '#f6c24a', true);
      outline(api, buf, 14, 14);
    }),
    lumber: () => mk(14, 14, (api, buf) => {
      api.rect(2, 6, 11, 13, PAL.wood); api.rect(1, 1, 12, 7, PAL.leaf);
      api.rect(1, 1, 12, 3, PAL.leafLt);
      outline(api, buf, 14, 14);
    }),
    quarry: () => mk(14, 14, (api, buf) => {
      api.rect(1, 8, 12, 13, PAL.stoneDk);
      api.rect(2, 3, 6, 9, PAL.stone); api.rect(7, 5, 11, 9, PAL.stoneLt);
      outline(api, buf, 14, 14);
    }),
    skull: () => mk(14, 14, (api, buf) => {
      api.ellipse(2, 1, 11, 9, PAL.ink, true);
      api.rect(4, 4, 5, 6, PAL.out); api.rect(8, 4, 9, 6, PAL.out);
      api.rect(5, 9, 8, 12, PAL.ink);
      outline(api, buf, 14, 14);
    })
  };

  /* ---------------------------------------------------------------- text */

  /* Bitmap-font labels, baked to canvases and cached by string. Drawn with
     the library's own font so in-world text and HUD text share one face. */
  const labels = new Map();
  function label(text, opts) {
    const o = opts || {};
    const face = o.font || 'mini';
    const s = o.scale || 1;
    const key = text + '|' + face + '|' + (o.color || '') + '|' + (o.outline || '') + '|' + (o.shadow || '') + '|' + s;
    if (labels.has(key)) return labels.get(key);
    const m = PF.Font.measure(text, { font: face, scale: s });
    const pad = (o.outline ? 1 : 0) * s;
    const w = Math.max(1, m.width + pad * 2), h = Math.max(1, m.height + pad * 2);
    const cv = mk(w, h, api => {
      PF.Font.text(api, text, pad, pad, { font: face, scale: s, color: o.color || PAL.ink, outline: o.outline, shadow: o.shadow });
    });
    labels.set(key, cv);
    return cv;
  }

  const url = cv => cv.toDataURL('image/png');

  const api = {
    T, PAL, mk, outline, ground, props, build, swarm, icons, label, url,
    tile: name => mem('g:' + name, () => ground[name]()),
    prop: name => mem('p:' + name, () => props[name]()),
    building: name => mem('b:' + name, () => build[name]()),
    ant: name => mem('s:' + name, () => swarm[name]()),
    icon: name => mem('i:' + name, () => icons[name]())
  };
  return api;
})();
