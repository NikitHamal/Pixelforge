/* Ironvale — an isometric skirmish whose every pixel comes from PF.Library's
   procedural isometric pack. No image files, no build step.

   The pack gives four-facing characters, eight ground diamonds, stackable
   blocks, props, terrain features and seven 32x48 buildings, all cut to one
   shared 32x16 lattice. This file is the game hung off them: a diamond world
   built from value noise, depth-sorted drawing, a warband AI that pushes for
   the watchtower unless you get in the way, and a dusk lighting pass that
   punches holes in an overlay instead of tinting the scene.

   The lattice is the whole trick. Tile (u,v) blits at ((u-v)*16, (u+v)*8) and
   everything else — entities at fractional coordinates, 48px buildings lifted
   16px, depth order by u+v — falls out of that one line. */
(() => {
  'use strict';
  const $ = s => document.querySelector(s);
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const lerp = (a, b, t) => a + (b - a) * t;

  /* ---------------------------------------------------------- constants */

  const HX = 16, HY = 8;              // half-width / half-height of a tile diamond
  const TILEW = 32, TILEH = 32;       // source sprite box
  const MW = 56, MH = 56;             // map size in tiles
  const KU = MW >> 1, KV = MH >> 1;   // the keep's tile

  /* Ground states, in the order iso_ground paints them. */
  const G = { GRASS: 'grass', DIRT: 'dirt', STONE: 'stone', SAND: 'sand',
    SNOW: 'snow', WOOD: 'wood', WATER: 'water', LAVA: 'lava' };

  /* +u runs down-right on screen, +v down-left; the pack names its facings the
     same way, so a facing IS a lattice direction. */
  const FACING = { se: [1, 0], sw: [0, 1], nw: [-1, 0], ne: [0, -1] };
  const FACES = ['se', 'sw', 'nw', 'ne'];
  const faceOf = (du, dv) => {
    let best = 'se', dot = -Infinity;
    for (const f of FACES) {
      const d = FACING[f][0] * du + FACING[f][1] * dv;
      if (d > dot) { dot = d; best = f; }
    }
    return best;
  };

  const CLASSES = {
    hero: { id: 'iso_hero', name: 'WARDEN', blurb: 'Longsword. Wide arc, honest damage, no tricks.',
      hp: 150, speed: 3.6, stam: 100,
      atk: { dmg: 40, reach: 1.55, arc: 1.00, cool: 0.34, knock: 1.0, bolt: null } },
    marauder: { id: 'iso_orc', name: 'TURNCOAT', blurb: 'Stone club. Slow as a gate, hits like one.',
      hp: 200, speed: 3.0, stam: 80,
      atk: { dmg: 62, reach: 1.80, arc: 1.30, cool: 0.60, knock: 1.35, bolt: null } },
    mage: { id: 'iso_mage', name: 'HEDGE MAGE', blurb: 'Focus stone. Throws light down the lane.',
      hp: 100, speed: 3.9, stam: 120,
      atk: { dmg: 26, reach: 0.9, arc: 0.7, cool: 0.28, knock: 0.2,
        bolt: { speed: 11, life: 1.1, dmg: 32, colour: '#c9a6ff' } } }
  };

  /* Warband breeds. Two templates cover four enemies — the rest is scale, pace
     and a translucent wash, which reads instantly at 3x and costs nothing. */
  const BREEDS = [
    { key: 'raider', id: 'iso_orc', hp: 54, speed: 2.0, dmg: 9, reach: 1.15, swing: 0.95,
      scale: 1, wash: null, renown: 10, from: 1 },
    { key: 'scout', id: 'iso_orc', hp: 36, speed: 3.4, dmg: 7, reach: 1.05, swing: 0.72,
      scale: 0.86, wash: ['#d8f07a', 0.26], renown: 16, from: 1 },
    { key: 'brute', id: 'iso_orc', hp: 190, speed: 1.5, dmg: 22, reach: 1.5, swing: 1.45,
      scale: 1.32, wash: ['#d25a46', 0.28], renown: 42, from: 2 },
    { key: 'shaman', id: 'iso_mage', hp: 70, speed: 2.2, dmg: 12, reach: 6.5, swing: 1.9,
      scale: 1, wash: ['#7ce0c8', 0.30], renown: 30, from: 3,
      bolt: { speed: 7.5, life: 1.6, dmg: 12, colour: '#7ce0c8' } }
  ];
  const FLASH = ['#ffffff', 0.85];

  const DROPS = {
    gold: { id: 'iso_blocks', state: 'gold', label: '+60 RENOWN' },
    chest: { id: 'iso_props', state: 'chest', label: '+40 HP' },
    crystal: { id: 'iso_props', state: 'crystal', label: 'STAMINA' }
  };

  /* ------------------------------------------------------------- audio */

  const SFX = (() => {
    let ctx = null, muted = false;
    const on = () => { if (!ctx) { try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { ctx = null; } } };
    function blip(freq, dur, type, gain, slide) {
      if (muted || !ctx) return;
      const o = ctx.createOscillator(), g = ctx.createGain(), t = ctx.currentTime;
      o.type = type || 'square';
      o.frequency.setValueAtTime(freq, t);
      if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq * slide), t + dur);
      g.gain.setValueAtTime(gain || 0.06, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(ctx.destination);
      o.start(t); o.stop(t + dur + 0.02);
    }
    function noise(dur, gain) {
      if (muted || !ctx) return;
      const n = Math.floor(ctx.sampleRate * dur);
      const buf = ctx.createBuffer(1, n, ctx.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
      const src = ctx.createBufferSource(), g = ctx.createGain();
      src.buffer = buf; g.gain.value = gain || 0.09;
      src.connect(g); g.connect(ctx.destination); src.start();
    }
    return {
      on, toggle() { muted = !muted; return muted; }, get muted() { return muted; },
      swing() { noise(0.05, 0.05); blip(190, 0.08, 'triangle', 0.04, 0.6); },
      hit() { noise(0.05, 0.08); blip(150, 0.06, 'sawtooth', 0.06, 0.5); },
      cast() { blip(520, 0.12, 'triangle', 0.05, 1.7); },
      kill() { noise(0.15, 0.06); blip(85, 0.18, 'sawtooth', 0.05, 0.4); },
      hurt() { blip(130, 0.2, 'square', 0.08, 0.35); },
      keep() { blip(70, 0.3, 'square', 0.09, 0.5); noise(0.2, 0.08); },
      dash() { noise(0.12, 0.04); blip(600, 0.1, 'sine', 0.04, 0.5); },
      pick() { blip(700, 0.08, 'triangle', 0.07, 1.7); },
      wave() { blip(240, 0.36, 'triangle', 0.08, 2.4); }
    };
  })();

  /* ------------------------------------------------------------- input */

  const keys = new Set();
  const pointer = { x: 0, y: 0, down: false, has: false };
  const pad = { x: 0, y: 0, active: false, id: -1 };
  let striking = false;

  addEventListener('keydown', e => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
    const k = e.key.toLowerCase();
    keys.add(k);
    if (k === 'p') togglePause();
    if (k === 'm') toggleMute();
  });
  addEventListener('keyup', e => keys.delete(e.key.toLowerCase()));
  addEventListener('blur', () => keys.clear());

  /* Screen-space intent: W is up the SCREEN, not up the lattice. Players read
     the diamond, not the axes, so the conversion belongs here and nowhere else. */
  const axis = () => {
    let x = 0, y = 0;
    if (keys.has('a') || keys.has('arrowleft')) x -= 1;
    if (keys.has('d') || keys.has('arrowright')) x += 1;
    if (keys.has('w') || keys.has('arrowup')) y -= 1;
    if (keys.has('s') || keys.has('arrowdown')) y += 1;
    if (pad.active) { x += pad.x; y += pad.y; }
    const m = Math.hypot(x, y);
    if (m > 1) { x /= m; y /= m; }
    return toLattice(x * HX, y * HY);
  };

  /* A screen vector becomes a lattice vector by inverting the projection. The
     HX/HY scaling cancels, so the result is already in tiles. */
  const toLattice = (dx, dy) => {
    const du = (dx / HX + dy / HY) / 2, dv = (dy / HY - dx / HX) / 2;
    const m = Math.hypot(du, dv);
    return m > 1 ? { u: du / m, v: dv / m } : { u: du, v: dv };
  };

  /* -------------------------------------------------------------- state */

  const cv = $('#cv'), ctx = cv.getContext('2d');
  const dark = document.createElement('canvas'), dctx = dark.getContext('2d');
  let ZOOM = 3, VW = 0, VH = 0;
  const cam = { x: 0, y: 0 };

  let map = null, blockedTile = null, ground = null, lamps = [];
  let props = [], foes = [], bolts = [], drops = [], parts = [], lights = [];
  let player = null, keep = null, running = false, paused = false, over = false;
  let time = 0, wave = 0, waveT = 0, renown = 0, kills = 0, spawnAcc = 0, shake = 0;
  let best = Number(localStorage.getItem('ironvale.best') || 0);
  let drawList = [];

  /* --------------------------------------------------------- projection */

  const wx = (u, v) => (u - v) * HX;
  const wy = (u, v) => (u + v) * HY;

  /* ------------------------------------------------------ world building */

  function makeRng(seed) {
    let s = seed >>> 0;
    return () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296;
  }

  function noiseField(rnd, w, h, step) {
    const gw = Math.ceil(w / step) + 2, gh = Math.ceil(h / step) + 2;
    const g = new Float32Array(gw * gh);
    for (let i = 0; i < g.length; i++) g[i] = rnd();
    return (x, y) => {
      const fx = x / step, fy = y / step;
      const x0 = Math.floor(fx), y0 = Math.floor(fy);
      const tx = (1 - Math.cos((fx - x0) * Math.PI)) / 2, ty = (1 - Math.cos((fy - y0) * Math.PI)) / 2;
      const at = (a, b) => g[clamp(b, 0, gh - 1) * gw + clamp(a, 0, gw - 1)];
      return lerp(lerp(at(x0, y0), at(x0 + 1, y0), tx), lerp(at(x0, y0 + 1), at(x0 + 1, y0 + 1), tx), ty);
    };
  }

  const inMap = (u, v) => u >= 0 && v >= 0 && u < MW && v < MH;
  const tileAt = (u, v) => (inMap(u, v) ? map[v * MW + u] : G.WATER);

  function buildWorld(seed) {
    const rnd = makeRng(seed);
    const n1 = noiseField(rnd, MW, MH, 11), n2 = noiseField(rnd, MW, MH, 4);
    map = new Array(MW * MH);
    blockedTile = new Uint8Array(MW * MH);

    for (let v = 0; v < MH; v++) for (let u = 0; u < MW; u++) {
      const n = n1(u, v) * 0.72 + n2(u, v) * 0.28;
      /* Push the rim under water so the map has an edge you can see rather than
         a cliff the camera falls off. */
      const rim = Math.min(u, v, MW - 1 - u, MH - 1 - v);
      const val = rim < 4 ? n * 0.55 : n;
      let t = G.GRASS;
      if (val < 0.29) t = G.WATER;
      else if (val < 0.345) t = G.SAND;
      else if (val > 0.72) t = G.STONE;
      else if (val > 0.645) t = G.DIRT;
      map[v * MW + u] = t;
    }

    /* Two dirt roads meet at a flagged plaza. The roads are what make the
         valley legible: warbands walk them, and so do you. */
    for (let k = 0; k < MW; k++) for (let d = -1; d <= 1; d++) {
      const a = clamp(KV + d, 0, MH - 1), b = clamp(KU + d, 0, MW - 1);
      map[a * MW + k] = G.DIRT;
      map[k * MW + b] = G.DIRT;
    }
    for (let v = KV - 6; v <= KV + 6; v++) for (let u = KU - 6; u <= KU + 6; u++) {
      if (!inMap(u, v)) continue;
      const d = Math.hypot(u - KU, v - KV);
      if (d < 5.2) map[v * MW + u] = d < 2.6 ? G.WOOD : G.STONE;
    }
    for (let i = 0; i < map.length; i++) if (map[i] === G.WATER) blockedTile[i] = 1;

    props = [];
    const occupy = (u, v) => { if (inMap(u, v)) blockedTile[v * MW + u] = 1; };
    const freeTile = (u, v) => inMap(u, v) && !blockedTile[v * MW + u] && map[v * MW + u] !== G.WATER;

    /* ---- the village: the keep first, so nothing else can take its tile ---- */
    keep = { u: KU, v: KV, hp: 1100, max: 1100, id: 'iso_buildings', state: 'watchtower', hurt: 0 };
    occupy(KU, KV);
    props.push({ u: KU, v: KV, id: 'iso_buildings', state: 'watchtower', tall: true,
      light: 46, keep: true });

    const VILLAGE = [
      [-4, -3, 'cottage'], [3, -4, 'thatched hut'], [4, 3, 'cottage'],
      [-3, 4, 'thatched hut'], [-5, 1, 'market stall'], [5, -1, 'well'],
      [1, 5, 'fountain'], [-1, -5, 'windmill']
    ];
    for (const [du, dv, state] of VILLAGE) {
      const u = KU + du, v = KV + dv;
      if (!freeTile(u, v)) continue;
      occupy(u, v);
      props.push({ u, v, id: 'iso_buildings', state, tall: true,
        light: state === 'windmill' ? 0 : 20 });
    }

    /* ---- lamps ring the plaza, and they are the light in the dusk pass ---- */
    for (let k = 0; k < 10; k++) {
      const a = (k / 10) * Math.PI * 2;
      const u = Math.round(KU + Math.cos(a) * 6.5), v = Math.round(KV + Math.sin(a) * 6.5);
      if (!freeTile(u, v)) continue;
      occupy(u, v);
      props.push({ u, v, id: 'iso_props', state: 'lamp', light: 62, r: 0.30 });
    }

    /* ---- the village wall, left open where the roads run through ----
       The pack's wall pieces come in both lattice orientations, which matters:
       iso_props' fence only runs along +u, so using it on all four sides turns
       half the perimeter into a row of unconnected posts. Go by geometry, not
       by the names: half_ne is the piece that runs along +u, half_nw along +v.
       Getting that backwards produces a zigzag of separated bars, which is
       exactly what it looks like. */
    const WALL = 9;
    for (let k = -WALL; k <= WALL; k++) {
      const gate = Math.abs(k) <= 2;                      // gateways on both roads
      if (!gate) {
        for (const v of [KV - WALL, KV + WALL]) {
          const u = KU + k;
          if (!freeTile(u, v)) continue;
          occupy(u, v);
          props.push({ u, v, id: 'iso_walls', state: 'half_ne', r: 0.44 });
        }
        for (const u of [KU - WALL, KU + WALL]) {
          const v = KV + k;
          if (!freeTile(u, v)) continue;
          occupy(u, v);
          props.push({ u, v, id: 'iso_walls', state: 'half_nw', r: 0.44 });
        }
      }
    }
    for (const [u, v] of [[KU - WALL, KV - WALL], [KU + WALL, KV - WALL],
      [KU - WALL, KV + WALL], [KU + WALL, KV + WALL]]) {
      if (!freeTile(u, v)) continue;
      occupy(u, v);
      props.push({ u, v, id: 'iso_walls', state: 'pillar', r: 0.44 });
    }

    /* ---- woodland ----
       A uniform scatter reads as litter: barrels and signposts every third
       tile, no open ground to fight on, no landmark to steer by. Driving tree
       density off its own noise field gives woods in patches and clearings
       between them, which is both what a valley looks like and what a chase
       needs. */
    const forest = noiseField(rnd, MW, MH, 7);
    const place = (u, v, id, state, r) => { if (r > 0) occupy(u, v); props.push({ u, v, id, state, r }); };
    const TREES = [['iso_props', 'tree', 0.44], ['iso_nature', 'pine', 0.44],
      ['iso_props', 'pine', 0.44], ['iso_props', 'tree', 0.44]];
    for (let v = 1; v < MH - 1; v++) for (let u = 1; u < MW - 1; u++) {
      if (!freeTile(u, v)) continue;
      const near = Math.hypot(u - KU, v - KV);
      if (near < 8) continue;                      // the plaza is the arena
      const fade = near < 13 ? 0.22 : 1;           // and it thins outward, not abruptly
      const t = map[v * MW + u];
      const d = forest(u, v);
      if (t === G.GRASS) {
        if (rnd() < (d - 0.52) * 1.35 * fade) {
          const pick = TREES[Math.floor(rnd() * TREES.length)];
          place(u, v, pick[0], pick[1], pick[2]);
        } else if (rnd() < 0.045 * fade) place(u, v, 'iso_props', 'bush', 0);
      } else if (t === G.STONE) {
        if (rnd() < 0.055 * fade) place(u, v, 'iso_props', 'rock', 0.40);
        else if (rnd() < 0.012 * fade) place(u, v, 'iso_blocks', 'stone', 0.5);
        else if (rnd() < 0.006 * fade) place(u, v, 'iso_props', 'crystal', 0.34);
      } else if (t === G.DIRT) {
        if (rnd() < 0.02 * fade) place(u, v, 'iso_props', 'rock', 0.40);
      }
    }

    /* ---- field boundaries out in the valley, on the axis the prop runs ---- */
    for (let f = 0; f < 6; f++) {
      const v = 5 + Math.floor(rnd() * (MH - 10));
      const u0 = 3 + Math.floor(rnd() * (MW - 18)), len = 5 + Math.floor(rnd() * 9);
      if (Math.abs(v - KV) < 12) continue;
      for (let u = u0; u < u0 + len; u++) {
        if (!freeTile(u, v) || map[v * MW + u] !== G.GRASS) continue;
        occupy(u, v);
        props.push({ u, v, id: 'iso_props', state: 'fence', r: 0.42 });
      }
    }

    /* ---- roadside clutter: cover where the fighting actually happens ----
       Barrels and crates belong beside a road, not in a wood, and putting
       them on the approaches gives you something to break line of sight on. */
    for (let k = 0; k < 40; k++) {
      const along = 4 + rnd() * (MW - 8), side = (rnd() < 0.5 ? -1 : 1) * (2 + Math.floor(rnd() * 2));
      const [u, v] = rnd() < 0.5
        ? [Math.round(along), KV + side]
        : [KU + side, Math.round(along)];
      if (!freeTile(u, v) || Math.hypot(u - KU, v - KV) < 7) continue;
      const r = rnd();
      if (r < 0.45) place(u, v, 'iso_props', 'barrel', 0.36);
      else if (r < 0.8) place(u, v, 'iso_blocks', 'crate', 0.5);
      else place(u, v, 'iso_props', 'sign', 0);
    }

    /* ---- shoreline dressing: surf wherever land meets water ---- */
    for (let v = 1; v < MH - 1; v++) for (let u = 1; u < MW - 1; u++) {
      if (map[v * MW + u] !== G.WATER) continue;
      if (map[v * MW + u + 1] === G.WATER && map[(v + 1) * MW + u] === G.WATER) continue;
      if (((u * 7 + v * 13) % 5) === 0) props.push({ u, v, id: 'iso_nature', state: 'shore', r: 0 });
    }

    props.sort((a, b) => (a.u + a.v) - (b.u + b.v));
    lamps = props.filter(p => p.light);        // the dusk pass only wants these

    /* Built last, because every occupy() above changes the answer. */
    keepFlow = flowField(KU, KV, MW + MH, keepFlow);
    playerFlow = flowField(KU, KV, 30, playerFlow);
    flowTile = -1; flowT = 0;
  }

  /* -------------------------------------------------------- collision */

  /* Circle against the unit squares of blocked tiles. Tile (u,v) covers
     [u-0.5, u+0.5] x [v-0.5, v+0.5], so the entity coordinate space and the
     tile space are the same numbers — no conversion, no off-by-a-half. */
  function hits(fu, fv, r) {
    const u0 = Math.floor(fu - r - 0.5), u1 = Math.ceil(fu + r + 0.5);
    const v0 = Math.floor(fv - r - 0.5), v1 = Math.ceil(fv + r + 0.5);
    for (let v = v0; v <= v1; v++) for (let u = u0; u <= u1; u++) {
      if (!inMap(u, v)) { if (Math.abs(fu - u) < 0.5 + r && Math.abs(fv - v) < 0.5 + r) return true; continue; }
      if (!blockedTile[v * MW + u]) continue;
      const cx = clamp(fu, u - 0.5, u + 0.5), cy = clamp(fv, v - 0.5, v + 0.5);
      const dx = fu - cx, dy = fv - cy;
      if (dx * dx + dy * dy < r * r) return true;
    }
    return false;
  }

  /* Axis at a time, so sliding along a fence feels like sliding and not like
     sticking. */
  function moveEnt(e, du, dv, r) {
    if (du) { const n = e.u + du; if (!hits(n, e.v, r)) e.u = n; }
    if (dv) { const n = e.v + dv; if (!hits(e.u, n, r)) e.v = n; }
    e.u = clamp(e.u, 1, MW - 2); e.v = clamp(e.v, 1, MH - 2);
  }

  /* ----------------------------------------------------------- pathing */

  /* Greedy chase does not survive a village. A foe whose straight line to the
     tower runs through a cottage wedges against the wall and stays there for
     the rest of the round, so the warband dissolves into scenery. Two
     breadth-first flow fields fix it outright: one to the keep, built once and
     never touched again, and one to the player, rebuilt whenever they change
     tile. A field over 56x56 tiles is three thousand nodes — cheaper per
     rebuild than a single frame of drawing, and it is exact. */
  const DIRS8 = [[1, 0], [0, 1], [-1, 0], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
  const flowQ = new Int32Array(MW * MH);
  let keepFlow = null, playerFlow = null, flowTile = -1, flowT = 0;

  function flowField(su, sv, limit, out) {
    const d = out || new Int16Array(MW * MH);
    d.fill(-1);
    let head = 0, tail = 0;
    if (!inMap(su, sv)) return d;
    d[sv * MW + su] = 0; flowQ[tail++] = sv * MW + su;
    while (head < tail) {
      const i = flowQ[head++];
      const u = i % MW, v = (i - u) / MW;
      const nd = d[i] + 1;
      if (nd > limit) continue;
      for (let k = 0; k < 8; k++) {
        const du = DIRS8[k][0], dv = DIRS8[k][1];
        const nu = u + du, nv = v + dv;
        if (!inMap(nu, nv)) continue;
        const ni = nv * MW + nu;
        if (d[ni] !== -1 || blockedTile[ni]) continue;
        /* No squeezing through the diagonal gap between two blockers — the
           sprite is a whole tile wide and would visibly clip the corner. */
        if (du && dv && (blockedTile[v * MW + nu] || blockedTile[nv * MW + u])) continue;
        d[ni] = nd; flowQ[tail++] = ni;
      }
    }
    return d;
  }

  /* The downhill neighbour, as a vector from the foe toward that tile's centre.
     Returns null when the foe is already adjacent to the goal or standing
     somewhere the field never reached, and the caller falls back to a direct
     line — which is right in both of those cases. */
  function steer(f, field) {
    if (!field) return null;
    const u = Math.round(f.u), v = Math.round(f.v);
    if (!inMap(u, v)) return null;
    const here = field[v * MW + u];
    if (here < 0 || here <= 1) return null;
    let bu = 0, bv = 0, bd = here;
    for (let k = 0; k < 8; k++) {
      const du = DIRS8[k][0], dv = DIRS8[k][1];
      const nu = u + du, nv = v + dv;
      if (!inMap(nu, nv)) continue;
      const nd = field[nv * MW + nu];
      if (nd < 0 || nd >= bd) continue;
      if (du && dv && (blockedTile[v * MW + nu] || blockedTile[nv * MW + u])) continue;
      bd = nd; bu = du; bv = dv;
    }
    if (!bu && !bv) return null;
    return { u: (u + bu) - f.u, v: (v + bv) - f.v };
  }

  /* Cheap Bresenham-ish sample. Only the shaman needs it: without a sight test
     it plants itself behind a cottage and shells the masonry all round. */
  function clearLine(u0, v0, u1, v1) {
    const n = Math.ceil(Math.hypot(u1 - u0, v1 - v0) * 2);
    for (let i = 1; i < n; i++) {
      const t = i / n;
      const u = Math.round(u0 + (u1 - u0) * t), v = Math.round(v0 + (v1 - v0) * t);
      if (!inMap(u, v) || blockedTile[v * MW + u]) return false;
    }
    return true;
  }

  /* ------------------------------------------------------------- spawns */

  function spawnFoe() {
    const pool = BREEDS.filter(b => b.from <= wave);
    const b = pool[Math.floor(Math.random() * pool.length)] || BREEDS[0];
    /* Warbands come down the roads, which is where the player expects them. */
    const lane = Math.floor(Math.random() * 4);
    const far = 3 + Math.random() * 4, off = (Math.random() - 0.5) * 5;
    let u, v;
    if (lane === 0) { u = far; v = KV + off; }
    else if (lane === 1) { u = MW - 1 - far; v = KV + off; }
    else if (lane === 2) { u = KU + off; v = far; }
    else { u = KU + off; v = MH - 1 - far; }
    u = clamp(u, 1.5, MW - 2.5); v = clamp(v, 1.5, MH - 2.5);
    let tries = 24;
    while (hits(u, v, 0.34) && tries-- > 0) { u += (Math.random() - 0.5) * 3; v += (Math.random() - 0.5) * 3; }
    if (hits(u, v, 0.34)) return;
    /* A foe that cannot reach the tower is a foe that stands in a field for
       the rest of the round. Ask the flow field before spending the slot. */
    if (keepFlow[Math.round(v) * MW + Math.round(u)] < 0) return;
    const boost = 1 + (wave - 1) * 0.14;
    foes.push({ b, id: b.id, u, v, face: 'se', hp: b.hp * boost, max: b.hp * boost,
      anim: Math.random() * 3, cool: 0.4 + Math.random() * b.swing, flash: 0, dying: 0,
      atkT: 0, pending: false, moving: true, kx: 0, kv: 0 });
  }

  function dropAt(u, v) {
    const r = Math.random();
    const kind = r < 0.16 ? 'gold' : r < 0.23 ? 'chest' : r < 0.29 ? 'crystal' : null;
    if (kind) drops.push({ u, v, kind, t: 0, life: 24 });
  }

  function burst(u, v, n, colour, spd, life) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = spd * (0.35 + Math.random() * 0.65);
      parts.push({ x: wx(u, v) + 15.5, y: wy(u, v) + 23.5, vx: Math.cos(a) * s, vy: Math.sin(a) * s * 0.55,
        c: colour, t: 0, life: life * (0.6 + Math.random() * 0.6) });
    }
  }

  /* --------------------------------------------------------- the round */

  function startRun(kindKey) {
    const K = CLASSES[kindKey];
    buildWorld((Date.now() ^ 0x9e3779b9) >>> 0);
    let su = KU + 3, sv = KV + 3;
    while (hits(su, sv, 0.34) && su < MW - 3) { su += 0.5; sv += 0.5; }
    player = { kind: kindKey, cfg: K, id: K.id, u: su, v: sv, face: 'se',
      hp: K.hp, max: K.hp, stam: K.stam, maxStam: K.stam,
      anim: 0, cool: 0, atkT: 0, hurtT: 0, iframe: 0, dashT: 0, moving: false,
      aimU: 1, aimV: 0 };
    foes = []; bolts = []; drops = []; parts = []; lights = [];
    time = 0; wave = 1; waveT = 0; renown = 0; kills = 0; spawnAcc = 0; shake = 0;
    running = true; paused = false; over = false;
    $('#screen-title').classList.add('hidden');
    $('#screen-over').classList.add('hidden');
    $('#hud').classList.remove('hidden');
    $('#btn-pause').textContent = 'PAUSE';
    SFX.on(); SFX.wave();
    toast('WARBAND 1 — HOLD THE TOWER');
    syncHud();
  }

  let toastT = 0;
  function toast(msg) { const el = $('#toast'); el.textContent = msg; el.classList.remove('hidden'); toastT = 2.6; }

  function strike() {
    const A = player.cfg.atk;
    if (player.cool > 0) return;
    player.cool = A.cool; player.atkT = A.cool;
    const [fu, fv] = FACING[player.face];
    if (A.bolt) {
      const m = Math.hypot(player.aimU, player.aimV) || 1;
      bolts.push({ u: player.u + fu * 0.5, v: player.v + fv * 0.5,
        du: player.aimU / m, dv: player.aimV / m, cfg: A.bolt, t: 0, foe: false });
      lights.push({ u: player.u, v: player.v, r: 40, t: 0, life: 0.1 });
      SFX.cast();
      syncHud();
      return;
    }
    SFX.swing();
    let landed = 0;
    for (const f of foes) {
      if (f.dying) continue;
      const du = f.u - player.u, dv = f.v - player.v;
      const d = Math.hypot(du, dv);
      if (d > A.reach + f.b.scale * 0.2) continue;
      /* The arc is measured in the lattice, so a swing to the south-east
         covers the tiles a player sees under the blade. */
      const dot = (du * fu + dv * fv) / (d || 1);
      if (dot < Math.cos(A.arc)) continue;
      damageFoe(f, A.dmg, du / (d || 1) * A.knock, dv / (d || 1) * A.knock);
      landed++;
    }
    if (landed) { shake = Math.min(7, shake + 2.2); SFX.hit(); }
  }

  function damageFoe(f, amount, ku, kv) {
    f.hp -= amount; f.flash = 0.12;
    f.kx = (ku || 0); f.kv = (kv || 0);
    burst(f.u, f.v, 5, '#8fbe57', 34, 0.34);
    if (f.hp <= 0 && !f.dying) {
      f.dying = 0.45;
      kills++; renown += f.b.renown;
      burst(f.u, f.v, 10, '#5a7a2e', 48, 0.5);
      dropAt(f.u, f.v);
      SFX.kill();
      syncHud();
    }
  }

  function hurtPlayer(amount) {
    if (player.iframe > 0 || over) return;
    player.hp -= amount; player.iframe = 0.55; player.hurtT = 0.25;
    shake = Math.min(12, shake + 4);
    burst(player.u, player.v, 7, '#f2606a', 55, 0.4);
    SFX.hurt();
    if (player.hp <= 0) { player.hp = 0; endRun('CUT DOWN', 'The valley took you on warband ' + wave + '.'); }
    syncHud();
  }

  function hurtKeep(amount) {
    keep.hp -= amount; keep.hurt = 0.2;
    shake = Math.min(10, shake + 2);
    if (keep.hp <= 0) { keep.hp = 0; endRun('IRONVALE FALLS', 'The tower came down on warband ' + wave + '.'); }
    SFX.keep();
    syncHud();
  }

  function endRun(title, sub) {
    if (over) return;
    running = false; over = true;
    if (renown > best) { best = renown; localStorage.setItem('ironvale.best', String(best)); }
    $('#over-title').textContent = title;
    $('#over-sub').textContent = sub;
    $('#over-stats').innerHTML =
      '<div>RENOWN<b>' + renown + '</b></div><div>SLAIN<b>' + kills + '</b></div>' +
      '<div>HELD<b>' + ((time / 60) | 0) + 'm ' + ((time | 0) % 60) + 's</b></div>' +
      '<div>BEST<b>' + best + '</b></div>';
    $('#screen-over').classList.remove('hidden');
  }

  /* -------------------------------------------------------------- update */

  let clockShown = -1;
  function update(dt) {
    time += dt; waveT += dt;
    if ((time | 0) !== clockShown) {
      clockShown = time | 0;
      $('#clock-txt').textContent =
        String((clockShown / 60) | 0).padStart(2, '0') + ':' + String(clockShown % 60).padStart(2, '0');
    }
    if (toastT > 0 && (toastT -= dt) <= 0) $('#toast').classList.add('hidden');
    shake = Math.max(0, shake - dt * 26);
    if (keep.hurt > 0) keep.hurt -= dt;

    /* ---- warbands ---- */
    if (waveT > 46) {
      waveT = 0; wave++;
      renown += 25 * wave;                      // holding the line is worth something
      keep.hp = Math.min(keep.max, keep.hp + 140);
      player.hp = Math.min(player.max, player.hp + 20);
      toast('WARBAND ' + wave + ' — THEY BROUGHT FRIENDS');
      SFX.wave(); syncHud();
    }
    if (time > 2.5) spawnAcc += dt * (0.55 + wave * 0.34);
    const cap = 14 + wave * 5;
    while (spawnAcc >= 1) { spawnAcc -= 1; if (foes.length < cap) spawnFoe(); }

    /* ---- player ---- */
    const a = axis();
    player.moving = !!(a.u || a.v);
    if (player.iframe > 0) player.iframe -= dt;
    if (player.hurtT > 0) player.hurtT -= dt;
    if (player.cool > 0) player.cool -= dt;
    if (player.atkT > 0) player.atkT -= dt;

    const dashing = player.dashT > 0;
    if (dashing) player.dashT -= dt;
    if ((keys.has('shift') || keys.has('e')) && !dashing && player.stam > 28 && player.moving) {
      player.dashT = 0.24; player.stam -= 28; player.iframe = Math.max(player.iframe, 0.26); SFX.dash();
    }
    player.stam = Math.min(player.maxStam, player.stam + dt * 17);

    const sp = player.cfg.speed * (dashing ? 2.9 : 1) * dt;
    moveEnt(player, a.u * sp, a.v * sp, 0.30);
    if (player.moving) player.anim += dt * (dashing ? 2.2 : 1);

    /* Re-flood toward the player when they change tile, and on a slow tick
       regardless so a foe released from a knockback is never chasing a stale
       field. Anything more often is wasted; anything less shows up as a pack
       jogging to where you used to be. */
    flowT -= dt;
    const ptile = Math.round(player.v) * MW + Math.round(player.u);
    if (ptile !== flowTile || flowT <= 0) {
      flowTile = ptile; flowT = 0.3;
      playerFlow = flowField(Math.round(player.u), Math.round(player.v), 30, playerFlow);
    }

    /* Facing follows the mouse when there is one and the stick or keys
       otherwise, so desktop can strafe and touch stays one-thumbed. */
    if (pointer.has) {
      const px = (pointer.x / ZOOM) - camOX() - (wx(player.u, player.v) + 15.5);
      const py = (pointer.y / ZOOM) - camOY() - (wy(player.u, player.v) + 23.5);
      const l = toLattice(px, py);
      if (l.u || l.v) { player.aimU = l.u; player.aimV = l.v; player.face = faceOf(l.u, l.v); }
    } else if (player.moving) {
      player.aimU = a.u; player.aimV = a.v; player.face = faceOf(a.u, a.v);
    }
    if (striking || pointer.down || keys.has(' ')) strike();

    /* ---- foes ---- */
    for (let i = foes.length - 1; i >= 0; i--) {
      const f = foes[i];
      if (f.dying) { if ((f.dying -= dt) <= 0) foes.splice(i, 1); continue; }
      if (f.flash > 0) f.flash -= dt;
      if (f.atkT > 0) f.atkT -= dt;
      f.cool -= dt;

      /* Knockback decays fast; it is punctuation, not physics. */
      if (f.kx || f.kv) {
        moveEnt(f, f.kx * dt * 8, f.kv * dt * 8, 0.30 * f.b.scale);
        f.kx *= 0.84; f.kv *= 0.84;
        if (Math.abs(f.kx) < 0.01) f.kx = 0;
        if (Math.abs(f.kv) < 0.01) f.kv = 0;
      }

      const dpu = player.u - f.u, dpv = player.v - f.v;
      const dp = Math.hypot(dpu, dpv);
      const dku = keep.u - f.u, dkv = keep.v - f.v;
      const dk = Math.hypot(dku, dkv);
      /* The keep is the objective; you are an obstacle worth removing. That one
         rule is what makes standing in the gateway mean something. */
      const chase = dp < 9;
      const tu = chase ? dpu : dku, tv = chase ? dpv : dkv;
      const td = chase ? dp : dk;
      const reach = f.b.reach + f.b.scale * 0.15;
      /* A ranged breed only counts the distance as "in reach" when it can
         actually see what it is aiming at. */
      const sighted = !f.b.bolt || clearLine(f.u, f.v, chase ? player.u : keep.u, chase ? player.v : keep.v);

      /* The swing lands mid-animation, not on the frame it starts. Those two
         tenths of a second are the whole defence: dash out of the arc and the
         blow goes through empty air. */
      if (f.pending && f.atkT <= 0.16) {
        f.pending = false;
        const nowD = chase ? Math.hypot(player.u - f.u, player.v - f.v)
          : Math.hypot(keep.u - f.u, keep.v - f.v);
        if (f.b.bolt) {
          const m = nowD || 1;
          bolts.push({ u: f.u, v: f.v, du: (chase ? player.u - f.u : keep.u - f.u) / m,
            dv: (chase ? player.v - f.v : keep.v - f.v) / m, cfg: f.b.bolt, t: 0, foe: true });
          SFX.cast();
        } else if (nowD <= reach + 0.35) {
          if (chase) hurtPlayer(f.b.dmg);
          else hurtKeep(f.b.dmg * 0.7);
        }
      }

      if (f.atkT > 0) { f.moving = false; continue; }      // committed to the swing

      if (td > reach - 0.1 || !sighted) {
        let du = tu, dv = tv;
        const way = steer(f, chase ? playerFlow : keepFlow);
        if (way) { du = way.u; dv = way.v; }
        const m = Math.hypot(du, dv) || 1;
        /* A little sidestep keeps a pack from collapsing into one column. */
        const sway = Math.sin(time * 1.7 + f.u * 3.1) * 0.22;
        const nu = du / m + (-dv / m) * sway, nv = dv / m + (du / m) * sway;
        const nm = Math.hypot(nu, nv) || 1;
        const sp2 = f.b.speed * dt;
        moveEnt(f, nu / nm * sp2, nv / nm * sp2, 0.30 * f.b.scale);
        f.anim += dt;
        f.moving = true;
        f.face = faceOf(nu, nv);
      } else {
        f.moving = false;
        f.face = faceOf(tu, tv);
        if (f.cool <= 0) { f.cool = f.b.swing; f.atkT = 0.34; f.pending = true; SFX.swing(); }
      }

      /* Foes push each other apart so a swing can actually separate them. */
      for (let j = i - 1; j >= 0 && j > i - 6; j--) {
        const o = foes[j];
        if (o.dying) continue;
        const du = o.u - f.u, dv = o.v - f.v;
        const d2 = du * du + dv * dv;
        const want = 0.46 * (f.b.scale + o.b.scale) / 2;
        if (d2 > want * want || d2 < 1e-6) continue;
        const d = Math.sqrt(d2), push = (want - d) * 0.5;
        moveEnt(f, -du / d * push, -dv / d * push, 0.30 * f.b.scale);
        moveEnt(o, du / d * push, dv / d * push, 0.30 * o.b.scale);
      }
    }

    /* ---- bolts ---- */
    for (let i = bolts.length - 1; i >= 0; i--) {
      const b = bolts[i];
      b.t += dt;
      const step = b.cfg.speed * dt;
      b.u += b.du * step; b.v += b.dv * step;
      if (b.t > b.cfg.life || hits(b.u, b.v, 0.08)) { bolts.splice(i, 1); continue; }
      if (b.foe) {
        if (Math.hypot(b.u - player.u, b.v - player.v) < 0.45) {
          hurtPlayer(b.cfg.dmg); bolts.splice(i, 1); continue;
        }
        if (Math.hypot(b.u - keep.u, b.v - keep.v) < 0.7) {
          hurtKeep(b.cfg.dmg); bolts.splice(i, 1); continue;
        }
      } else {
        let hit = false;
        for (const f of foes) {
          if (f.dying) continue;
          if (Math.hypot(b.u - f.u, b.v - f.v) > 0.5 * f.b.scale) continue;
          damageFoe(f, b.cfg.dmg, b.du * 0.3, b.dv * 0.3);
          SFX.hit(); hit = true; break;
        }
        if (hit) { bolts.splice(i, 1); continue; }
      }
      if ((i & 1) === 0) parts.push({ x: wx(b.u, b.v) + 15.5, y: wy(b.u, b.v) + 20,
        vx: 0, vy: -6, c: b.cfg.colour, t: 0, life: 0.18 });
    }

    /* ---- drops ---- */
    for (let i = drops.length - 1; i >= 0; i--) {
      const d = drops[i];
      d.t += dt;
      if (d.t > d.life) { drops.splice(i, 1); continue; }
      if (Math.hypot(d.u - player.u, d.v - player.v) > 0.7) continue;
      if (d.kind === 'gold') renown += 60;
      else if (d.kind === 'chest') player.hp = Math.min(player.max, player.hp + 40);
      else player.stam = player.maxStam;
      toast(DROPS[d.kind].label);
      SFX.pick(); drops.splice(i, 1); syncHud();
    }

    /* ---- particles and muzzle lights ---- */
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      p.t += dt;
      if (p.t > p.life) { parts.splice(i, 1); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 42 * dt;
    }
    for (let i = lights.length - 1; i >= 0; i--) {
      lights[i].t += dt;
      if (lights[i].t > lights[i].life) lights.splice(i, 1);
    }

    /* ---- camera ---- */
    const tx = wx(player.u, player.v) + 15.5, ty = wy(player.u, player.v) + 23.5;
    cam.x = lerp(cam.x, tx, Math.min(1, dt * 9));
    cam.y = lerp(cam.y, ty, Math.min(1, dt * 9));
  }

  /* -------------------------------------------------------------- render */

  const camOX = () => VW / (2 * ZOOM) - cam.x;
  const camOY = () => VH / (2 * ZOOM) - cam.y;

  function blit(cvs, sx, sy, w, h, ox, oy) {
    const x = Math.round((sx + ox) * ZOOM), y = Math.round((sy + oy) * ZOOM);
    if (x + w * ZOOM < 0 || y + h * ZOOM < 0 || x > VW || y > VH) return;
    ctx.drawImage(cvs, x, y, w * ZOOM, h * ZOOM);
  }

  /* The pose a figure should be in, as one lookup. Keeping this in one place is
     why a foe and the player can share every drawing path below. */
  function poseOf(e, isPlayer) {
    if (e.dying) return { st: 'death', i: Math.floor((1 - e.dying / 0.45) * 4) };
    if (isPlayer && e.hurtT > 0) return { st: 'hurt', i: Math.floor((0.25 - e.hurtT) * 12) };
    if (isPlayer && e.atkT > 0) {
      const A = e.cfg.atk;
      return { st: 'attack_' + e.face, i: Math.floor((1 - e.atkT / A.cool) * 6) };
    }
    if (!isPlayer && e.atkT > 0) return { st: 'attack_' + e.face, i: Math.floor((0.3 - e.atkT) * 14) };
    if (e.moving) return { st: 'walk_' + e.face, i: Math.floor(e.anim * 10) };
    return { st: 'idle_' + e.face, i: Math.floor(e.anim * 5) };
  }

  function drawFigure(e, isPlayer, ox, oy) {
    const p = poseOf(e, isPlayer);
    const f = GB.frame(e.id, p.st, p.i);
    if (!f) return;
    const scale = isPlayer ? 1 : e.b.scale;
    const w = f.w * scale, h = f.h * scale;
    /* The pack draws every figure with its feet on the tile's ground point,
       local (15.5, 23.5) in the 32x32 box. Scaling moves that point, so undo
       it here — otherwise a brute floats and a scout sinks. */
    const sx = wx(e.u, e.v) + 15.5 - 15.5 * scale, sy = wy(e.u, e.v) + 23.5 - 23.5 * scale;
    /* Invulnerability blinks the figure out rather than painting a coloured
       silhouette over it: source-in tinting replaces every pixel, so a "flash"
       held for half a second is just a magenta blob where your character was. */
    if (isPlayer && e.iframe > 0 && Math.floor(e.iframe * 18) % 2) return;
    blit(f.cv, sx, sy, w, h, ox, oy);
    /* Breed colour is a tinted silhouette laid over the figure, not a
       source-atop fill: source-atop is not universally available (the headless
       renderer this project screenshots through does not implement it) and
       where it is missing the wash floods the whole 32x32 box. */
    if (!isPlayer && e.b.wash) blit(GB.tint(f.cv, e.b.wash[0], e.b.wash[1]), sx, sy, w, h, ox, oy);
    if (!isPlayer && e.flash > 0) blit(GB.tint(f.cv, FLASH[0], FLASH[1]), sx, sy, w, h, ox, oy);
    /* A hit-point pip only for the ones that take more than a swing — clutter
       over a raider you already killed teaches nothing. */
    if (!isPlayer && !e.dying && e.hp < e.max && e.b.hp > 80) {
      const bw = 18 * scale;
      const bx = Math.round((sx + w / 2 - bw / 2 + ox) * ZOOM), by = Math.round((sy + oy) * ZOOM);
      ctx.fillStyle = '#181425'; ctx.fillRect(bx, by, bw * ZOOM, 3 * ZOOM);
      ctx.fillStyle = '#b1252f';
      ctx.fillRect(bx + ZOOM, by + ZOOM, Math.max(0, (bw - 2) * (e.hp / e.max)) * ZOOM, ZOOM);
    }
  }

  function render() {
    const jx = shake ? (Math.random() - 0.5) * shake : 0;
    const jy = shake ? (Math.random() - 0.5) * shake : 0;
    const ox = camOX() + jx, oy = camOY() + jy;

    ctx.fillStyle = '#101425';
    ctx.fillRect(0, 0, VW, VH);

    /* ---- ground: walk the diamond lattice directly, not a square grid ----
       screen y depends only on u+v and screen x only on u-v, so the visible
       set is a rectangle in (s, d) with matching parity. */
    const s0 = Math.floor((-TILEH - oy) / HY), s1 = Math.ceil((VH / ZOOM + TILEH - oy) / HY);
    const d0 = Math.floor((-TILEW - ox) / HX), d1 = Math.ceil((VW / ZOOM + TILEW - ox) / HX);
    for (let s = s0; s <= s1; s++) {
      for (let d = d0; d <= d1; d++) {
        if (((s + d) & 1) !== 0) continue;
        const u = (s + d) >> 1, v = (s - d) >> 1;
        if (!inMap(u, v)) continue;
        const st = map[v * MW + u];
        const f = st === G.WATER ? GB.at('iso_ground', 'water', time) : ground[st];
        if (!f) continue;
        blit(f.cv, wx(u, v), wy(u, v), f.w, f.h, ox, oy);
      }
    }

    /* ---- everything that stands up, in u+v order ---- */
    drawList.length = 0;
    const vis = (u, v) => {
      const x = (wx(u, v) + ox) * ZOOM, y = (wy(u, v) + oy) * ZOOM;
      return x > -TILEW * ZOOM * 2 && y > -96 * ZOOM && x < VW + TILEW * ZOOM && y < VH + TILEH * ZOOM;
    };
    for (const p of props) if (vis(p.u, p.v)) drawList.push(p);
    for (const d of drops) if (vis(d.u, d.v)) drawList.push(d);
    for (const f of foes) if (vis(f.u, f.v)) drawList.push(f);
    drawList.push(player);
    drawList.sort((a, b) => (a.u + a.v) - (b.u + b.v));

    for (const e of drawList) {
      if (e === player) { drawFigure(player, true, ox, oy); continue; }
      if (e.b) { drawFigure(e, false, ox, oy); continue; }
      if (e.kind) {                                        // a dropped pickup
        const D = DROPS[e.kind];
        const f = GB.at(D.id, D.state, e.t);
        if (!f) continue;
        const bob = Math.sin(e.t * 4) * 1.6;
        const fade = e.life - e.t < 4 && Math.floor(e.t * 8) % 2 ? 0.35 : 1;
        ctx.globalAlpha = fade;
        blit(f.cv, wx(e.u, e.v), wy(e.u, e.v) - 5 + bob, f.w, f.h, ox, oy);
        ctx.globalAlpha = 1;
        continue;
      }
      const f = e.tall || e.state === 'lamp' || e.state === 'crystal' || e.state === 'fountain'
        ? GB.at(e.id, e.state, time) : GB.frame(e.id, e.state, 0);
      if (!f) continue;
      const lift = f.h > TILEH ? f.h - TILEH : 0;
      if (e.keep && keep.hurt > 0) {
        blit(GB.tint(f.cv, '#f2606a', 0.55), wx(e.u, e.v), wy(e.u, e.v) - lift, f.w, f.h, ox, oy);
      } else {
        blit(f.cv, wx(e.u, e.v), wy(e.u, e.v) - lift, f.w, f.h, ox, oy);
      }
    }

    /* ---- bolts and sparks ---- */
    for (const b of bolts) {
      const x = Math.round((wx(b.u, b.v) + 15.5 + ox) * ZOOM), y = Math.round((wy(b.u, b.v) + 17 + oy) * ZOOM);
      ctx.fillStyle = b.cfg.colour;
      ctx.fillRect(x - ZOOM, y - ZOOM, ZOOM * 2, ZOOM * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x, y - ZOOM, ZOOM, ZOOM);
    }
    for (const p of parts) {
      ctx.globalAlpha = 1 - p.t / p.life;
      ctx.fillStyle = p.c;
      ctx.fillRect(Math.round((p.x + ox) * ZOOM), Math.round((p.y + oy) * ZOOM), ZOOM, ZOOM);
    }
    ctx.globalAlpha = 1;

    dusk(ox, oy);
  }

  /* A dusk pass: fill an overlay, then punch warm holes in it with
     destination-out. Cheaper than per-pixel light and it keeps the art's own
     colours intact instead of washing them blue. */
  function dusk(ox, oy) {
    /* The clear is not optional. A translucent fill composited onto last
       frame's overlay converges on opaque in well under a second, and the
       whole valley goes pitch black outside the lamp pools. */
    dctx.setTransform(1, 0, 0, 1, 0, 0);
    dctx.globalCompositeOperation = 'source-over';
    dctx.clearRect(0, 0, VW, VH);
    dctx.globalAlpha = 1;
    dctx.fillStyle = 'rgba(20,26,51,0.52)';
    dctx.fillRect(0, 0, VW, VH);
    dctx.globalCompositeOperation = 'destination-out';
    const punch = (u, v, r, power) => {
      const x = (wx(u, v) + 15.5 + ox) * ZOOM, y = (wy(u, v) + 18 + oy) * ZOOM;
      if (x < -r || y < -r || x > VW + r || y > VH + r) return;
      const g = dctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, 'rgba(0,0,0,' + power + ')');
      g.addColorStop(0.55, 'rgba(0,0,0,' + power * 0.55 + ')');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      dctx.fillStyle = g;
      dctx.beginPath(); dctx.arc(x, y, r, 0, Math.PI * 2); dctx.fill();
    };
    for (const p of lamps) punch(p.u, p.v, (p.light + Math.sin(time * 7 + p.u * 2) * 5) * ZOOM * 0.5, 0.95);
    for (const l of lights) punch(l.u, l.v, Math.max(2, l.r * ZOOM * 0.5 * (1 - l.t / l.life)), 1);
    punch(player.u, player.v, 52 * ZOOM * 0.5, 0.9);
    dctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(dark, 0, 0);
  }

  /* ---------------------------------------------------------------- HUD */

  function syncHud() {
    $('#hp-fill').style.transform = 'scaleX(' + (player.hp / player.max) + ')';
    $('#hp-txt').textContent = Math.ceil(player.hp);
    $('#sp-fill').style.transform = 'scaleX(' + (player.stam / player.maxStam) + ')';
    $('#sp-txt').textContent = Math.ceil(player.stam);
    $('#keep-fill').style.transform = 'scaleX(' + (keep.hp / keep.max) + ')';
    $('#keep-txt').textContent = Math.ceil(keep.hp);
    $('#score-txt').textContent = renown;
    $('#wave-txt').textContent = 'WARBAND ' + wave;
  }

  function togglePause() {
    if (!running) return;
    paused = !paused;
    $('#btn-pause').textContent = paused ? 'PLAY' : 'PAUSE';
  }
  function toggleMute() {
    const m = SFX.toggle();
    $('#btn-mute').classList.toggle('off', m);
    $('#btn-mute').textContent = m ? 'MUTED' : 'SOUND';
  }

  /* --------------------------------------------------------------- boot */

  function resize() {
    const dpr = Math.min(2, devicePixelRatio || 1);
    VW = Math.round(innerWidth * dpr); VH = Math.round(innerHeight * dpr);
    cv.width = VW; cv.height = VH;
    dark.width = VW; dark.height = VH;
    /* Iso tiles are 32px wide but only 16 tall; zoom off the smaller dimension
       or a phone in portrait shows four diamonds and no context. */
    ZOOM = clamp(Math.round(Math.min(VW, VH) / 300), 2, 5);
    ctx.imageSmoothingEnabled = false;
    dctx.imageSmoothingEnabled = false;
  }
  addEventListener('resize', resize);

  function bindPointer() {
    const scale = () => Math.min(2, devicePixelRatio || 1);
    cv.addEventListener('mousemove', e => { pointer.has = true; pointer.x = e.clientX * scale(); pointer.y = e.clientY * scale(); });
    cv.addEventListener('mousedown', e => { pointer.down = true; SFX.on(); e.preventDefault(); });
    addEventListener('mouseup', () => { pointer.down = false; });

    const stick = $('#stick'), nub = $('#nub');
    const onStick = e => {
      for (const t of e.changedTouches) {
        const r = stick.getBoundingClientRect();
        if (pad.id === -1 && e.type === 'touchstart') {
          if (t.clientX > r.right + 60) continue;
          pad.id = t.identifier; pad.active = true;
        }
        if (t.identifier !== pad.id) continue;
        const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
        let dx = t.clientX - cx, dy = t.clientY - cy;
        const m = Math.hypot(dx, dy), lim = r.width / 2;
        if (m > lim) { dx = dx / m * lim; dy = dy / m * lim; }
        pad.x = dx / lim; pad.y = dy / lim;
        nub.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
      }
      e.preventDefault();
    };
    const endStick = e => {
      for (const t of e.changedTouches) if (t.identifier === pad.id) {
        pad.id = -1; pad.active = false; pad.x = pad.y = 0;
        nub.style.transform = '';
      }
    };
    stick.addEventListener('touchstart', onStick, { passive: false });
    addEventListener('touchmove', onStick, { passive: false });
    addEventListener('touchend', endStick);
    addEventListener('touchcancel', endStick);

    const fireBtn = $('#btn-fire');
    fireBtn.addEventListener('touchstart', e => { striking = true; SFX.on(); e.preventDefault(); }, { passive: false });
    fireBtn.addEventListener('touchend', () => { striking = false; });
    addEventListener('touchstart', () => document.body.classList.add('touch'), { once: true });
  }

  function buildPicker() {
    const host = $('#picker');
    host.innerHTML = '';
    for (const key of Object.keys(CLASSES)) {
      const c = CLASSES[key];
      const b = document.createElement('button');
      b.className = 'pick';
      b.innerHTML = '<img alt="' + c.name + '" src="' + GB.dataURL(c.id, 'idle_se', 0, 3) + '">' +
        '<b>' + c.name + '</b><small>' + c.blurb + '</small>';
      b.addEventListener('click', () => startRun(key));
      host.appendChild(b);
    }
  }

  let last = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000 || 0);
    last = now;
    if (running && !paused && !over) update(dt);
    if (player) render();
  }

  function init() {
    resize();
    /* Bake the eight ground diamonds once. Water is animated, so it goes
       through GB.at every frame instead of living in here. */
    ground = {};
    for (const k of Object.keys(G)) {
      const st = G[k];
      if (st === G.WATER) continue;
      ground[st] = GB.frame('iso_ground', st, 0);
    }
    buildPicker();
    bindPointer();
    $('#btn-pause').addEventListener('click', togglePause);
    $('#btn-mute').addEventListener('click', toggleMute);
    $('#btn-again').addEventListener('click', () => { $('#screen-over').classList.add('hidden'); startRun(player.kind); });
    if (best) $('#best-txt').textContent = 'BEST ' + best;
    requestAnimationFrame(frame);
  }

  /* A read-only window onto the simulation, for the headless gate and for
     anyone poking at the game from a console. Nothing here mutates state. */
  window.IRONVALE = {
    stats: () => ({ foes: foes.length, bolts: bolts.length, drops: drops.length,
      props: props.length, parts: parts.length, wave, renown, kills, time,
      hp: player ? player.hp : 0, stam: player ? player.stam : 0,
      keep: keep ? keep.hp : 0, running, over, zoom: ZOOM })
  };

  if (document.readyState === 'loading') addEventListener('DOMContentLoaded', init);
  else init();
})();
