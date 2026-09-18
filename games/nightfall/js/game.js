/* Nightfall — a top-down survival shooter whose every pixel comes from
   PF.Library's procedural top-down pack. No image files, no build step.

   The pack gives eight-direction characters, a 16-tile terrain sheet, props,
   vehicles and pickups; this file is the game that hangs off them: a tiled
   world, a pursuit AI, a hitscan-free bullet sim, and a night lighting pass
   that punches holes in a dark overlay rather than tinting the whole scene. */
(() => {
  'use strict';
  const $ = s => document.querySelector(s);
  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const lerp = (a, b, t) => a + (b - a) * t;
  const dist2 = (ax, ay, bx, by) => { const dx = ax - bx, dy = ay - by; return dx * dx + dy * dy; };

  /* ---------------------------------------------------------- constants */

  const T = 16;                       // tile size in source pixels
  const MW = 96, MH = 96;             // map size in tiles
  const WW = MW * T, WH = MH * T;

  // indices into the td_tiles sheet, in the order tileSuite() paints them
  const TILE = { GRASS: 0, TALL: 1, DIRT: 2, GRAVEL: 3, ASPHALT: 4, LINE: 5, SAND: 6,
    WATER: 7, SHALLOW: 8, CONCRETE: 9, FLOOR: 10, PLANKS: 11, CARPET: 12, GRATE: 13,
    SNOW: 14, RUBBLE: 15 };
  const SOLID_TILE = new Set([TILE.WATER]);

  const DIRS = ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw'];
  // th = 0 points up-screen and grows clockwise, matching PF.TopDown's body space
  const dirName = th => DIRS[((Math.round(th / (TAU / 8)) % 8) + 8) % 8];

  const CLASSES = {
    survivor: { id: 'td_survivor', name: 'SURVIVOR', blurb: 'Pistol. Quick on their feet, light on lead.',
      hp: 100, speed: 78, gun: { dmg: 26, rof: 0.22, spread: 0.035, speed: 420, mag: 12, reload: 1.0, kick: 2.4 } },
    soldier: { id: 'td_soldier', name: 'SOLDIER', blurb: 'Rifle. Slower, but it does not stop.',
      hp: 130, speed: 66, gun: { dmg: 21, rof: 0.105, spread: 0.06, speed: 520, mag: 30, reload: 1.6, kick: 1.5 } },
    agent: { id: 'td_agent', name: 'AGENT', blurb: 'Machine pistol. Shreds close, fades far.',
      hp: 86, speed: 88, gun: { dmg: 14, rof: 0.07, spread: 0.10, speed: 380, mag: 24, reload: 1.15, kick: 1.1 } }
  };

  /* Zombie breeds. All three share one template — the differences are scale,
     pace and a translucent wash, which is far cheaper than three sprite sets
     and reads instantly at 2x zoom. */
  const BREEDS = [
    { key: 'walker', hp: 46, speed: 34, dmg: 9, scale: 1, wash: null, score: 10 },
    { key: 'runner', hp: 32, speed: 62, dmg: 7, scale: 0.88, wash: ['#78e696', 0.30], score: 18 },
    { key: 'brute', hp: 150, speed: 26, dmg: 22, scale: 1.34, wash: ['#d25a46', 0.28], score: 40 }
  ];
  const FLASH = ['#ffffff', 0.85];

  const PICKUPS = {
    medkit: { state: 'medkit', label: '+35 HP' },
    ammo: { state: 'ammo', label: 'AMMO' },
    coin: { state: 'coin', label: '+50' },
    fuel: { state: 'fuel', label: '+200' },
    chest: { state: 'chest', label: 'CACHE' }
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
      shot() { noise(0.06, 0.07); blip(240, 0.07, 'square', 0.05, 0.4); },
      hit() { blip(180, 0.05, 'sawtooth', 0.05, 0.5); },
      kill() { noise(0.14, 0.06); blip(90, 0.16, 'sawtooth', 0.05, 0.4); },
      hurt() { blip(140, 0.18, 'square', 0.08, 0.35); },
      pick() { blip(680, 0.07, 'triangle', 0.07, 1.6); },
      reload() { blip(320, 0.05, 'square', 0.04); setTimeout(() => blip(420, 0.06, 'square', 0.04), 110); },
      wave() { blip(300, 0.3, 'triangle', 0.07, 2.1); }
    };
  })();

  /* ------------------------------------------------------------- input */

  const keys = new Set();
  const pointer = { x: 0, y: 0, down: false, has: false };
  const pad = { x: 0, y: 0, active: false, id: -1 };
  let firing = false;

  addEventListener('keydown', e => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
    keys.add(e.key.toLowerCase());
    if (e.key.toLowerCase() === 'p') togglePause();
    if (e.key.toLowerCase() === 'm') toggleMute();
  });
  addEventListener('keyup', e => keys.delete(e.key.toLowerCase()));
  addEventListener('blur', () => keys.clear());

  const axis = () => {
    let x = 0, y = 0;
    if (keys.has('a') || keys.has('arrowleft')) x -= 1;
    if (keys.has('d') || keys.has('arrowright')) x += 1;
    if (keys.has('w') || keys.has('arrowup')) y -= 1;
    if (keys.has('s') || keys.has('arrowdown')) y += 1;
    if (pad.active) { x += pad.x; y += pad.y; }
    const m = Math.hypot(x, y);
    return m > 1 ? { x: x / m, y: y / m } : { x, y };
  };

  /* -------------------------------------------------------------- state */

  const cv = $('#cv'), ctx = cv.getContext('2d');
  let ZOOM = 3, VW = 0, VH = 0;
  const cam = { x: 0, y: 0 };

  const GC = 48;                      // collision bucket size, > the biggest prop radius
  let map = null, tiles = null, grid = null;
  let props = [], bullets = [], foes = [], drops = [], parts = [], lights = [];
  let player = null, running = false, paused = false, over = false;
  let time = 0, wave = 0, waveT = 0, score = 0, kills = 0, spawnAcc = 0, shake = 0;
  let best = Number(localStorage.getItem('nightfall.best') || 0);

  /* ------------------------------------------------------ world building */

  function makeRng(seed) {
    let s = seed >>> 0;
    return () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296;
  }

  /* A value-noise field on a coarse lattice, smoothed with a cosine blend.
     Cheap, tileable enough at this size, and deterministic given the seed. */
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

  function buildWorld(seed) {
    const rnd = makeRng(seed);
    const n1 = noiseField(rnd, MW, MH, 9), n2 = noiseField(rnd, MW, MH, 3);
    map = new Uint8Array(MW * MH);

    for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
      const v = n1(x, y) * 0.7 + n2(x, y) * 0.3;
      let t = TILE.GRASS;
      if (v < 0.30) t = TILE.WATER;
      else if (v < 0.36) t = TILE.SHALLOW;
      else if (v < 0.42) t = TILE.SAND;
      else if (v > 0.70) t = TILE.TALL;
      else if (v > 0.63) t = TILE.DIRT;
      map[y * MW + x] = t;
    }

    /* A crossroads through the middle with a concrete lot at the junction —
       the road is what makes the map legible from inside a torch beam. */
    const rx = MW >> 1, ry = MH >> 1;
    for (let y = 0; y < MH; y++) for (let d = -2; d <= 2; d++) {
      map[y * MW + clamp(rx + d, 0, MW - 1)] = d === 0 && y % 4 < 2 ? TILE.LINE : TILE.ASPHALT;
    }
    for (let x = 0; x < MW; x++) for (let d = -2; d <= 2; d++) {
      map[clamp(ry + d, 0, MH - 1) * MW + x] = d === 0 && x % 4 < 2 ? TILE.LINE : TILE.ASPHALT;
    }
    const lot = (cx, cy, w, h, t) => {
      for (let y = cy - h; y <= cy + h; y++) for (let x = cx - w; x <= cx + w; x++)
        if (x > 0 && y > 0 && x < MW - 1 && y < MH - 1) map[y * MW + x] = t;
    };
    lot(rx, ry, 7, 7, TILE.CONCRETE);
    for (let k = 0; k < 7; k++) {
      const cx = 8 + Math.floor(rnd() * (MW - 16)), cy = 8 + Math.floor(rnd() * (MH - 16));
      lot(cx, cy, 2 + Math.floor(rnd() * 3), 2 + Math.floor(rnd() * 3),
        rnd() < 0.4 ? TILE.RUBBLE : rnd() < 0.5 ? TILE.GRAVEL : TILE.CONCRETE);
    }

    /* ---- static scenery. Anything with r > 0 also blocks movement. ---- */
    props = [];
    const put = (id, state, x, y, r, opts) => props.push(Object.assign(
      { id, state, x, y, r: r || 0, seed: rnd() * 10 }, opts || {}));
    const free = (x, y) => !SOLID_TILE.has(map[(y / T | 0) * MW + (x / T | 0)]);

    for (let k = 0; k < 260; k++) {
      const x = rnd() * WW, y = rnd() * WH;
      if (!free(x, y)) continue;
      const t = map[(y / T | 0) * MW + (x / T | 0)];
      if (t === TILE.ASPHALT || t === TILE.LINE) continue;
      const roll = rnd();
      if (t === TILE.TALL || t === TILE.GRASS) {
        if (roll < 0.42) put('td_props', 'tree', x, y, 6, { anim: 2.4 });
        else if (roll < 0.78) put('td_props', 'bush', x, y, 0, { anim: 2.8 });
        else put('td_props', 'rock', x, y, 5);
      } else if (t === TILE.CONCRETE || t === TILE.RUBBLE || t === TILE.GRAVEL) {
        if (roll < 0.34) put('td_props', 'crate', x, y, 6);
        else if (roll < 0.6) put('td_props', 'barrel', x, y, 5);
        else if (roll < 0.74) put('td_props', 'table', x, y, 6);
        else if (roll < 0.9) put('td_props', 'sandbags', x, y, 7);
        else put('td_props', 'dumpster', x, y, 8);
      } else if (roll < 0.3) put('td_props', 'rock', x, y, 5);
    }
    /* Lamps line the two through-roads. They are the only scenery that lights
       the streets, so the night reads as a town rather than as a field. */
    for (let k = 0; k < 22; k++) {
      const along = 4 * T + rnd() * (WW - 8 * T), side = rnd() < 0.5 ? -T - 4 : T + 4;
      const [x, y] = rnd() < 0.5 ? [rx * T + 8 + side, along] : [along, ry * T + 8 + side];
      if (!free(x, y)) continue;
      put('td_props', 'streetlamp', x, y, 4, { light: 74 });
    }
    // campfires are the only scenery that lights the world, so place them by hand
    for (let k = 0; k < 9; k++) {
      const x = 6 * T + rnd() * (WW - 12 * T), y = 6 * T + rnd() * (WH - 12 * T);
      if (!free(x, y)) continue;
      put('td_props', 'campfire', x, y, 4, { light: 92, warm: true, anim: 10 });
    }
    // traffic stalled on the roads, and a helicopter on the lot
    for (let k = 0; k < 16; k++) {
      const along = 6 * T + rnd() * (WW - 12 * T);
      if (rnd() < 0.5) put('td_vehicles', rnd() < 0.5 ? 'car' : 'truck',
        rx * T + 8 + (rnd() < 0.5 ? -T : T), along, 10);
      else put('td_vehicles', rnd() < 0.5 ? 'car' : 'truck',
        along, ry * T + 8 + (rnd() < 0.5 ? -T : T), 10);
    }
    put('td_vehicles', 'helicopter', rx * T + 8, ry * T - 3 * T, 12, { anim: 12 });
    put('td_vehicles', 'tank_traverse', rx * T - 4 * T, ry * T + 8, 11, { anim: 3 });
    for (let k = 0; k < 6; k++) {
      const x = rnd() * WW, y = rnd() * WH;
      if (map[(y / T | 0) * MW + (x / T | 0)] === TILE.WATER) put('td_vehicles', 'boat', x, y, 0, { anim: 3 });
    }
    props.sort((a, b) => a.y - b.y);

    /* Bucket the blockers once. Collision is the hottest thing in the frame —
       player, every foe, every bullet substep — and a linear scan over 260
       props turns into 50k comparisons a frame for no reason. */
    grid = new Map();
    for (const p of props) {
      if (!p.r) continue;
      const cx = (p.x / GC) | 0, cy = (p.y / GC) | 0;
      for (let y = cy - 1; y <= cy + 1; y++) for (let x = cx - 1; x <= cx + 1; x++) {
        const k = y * 4096 + x;
        const b = grid.get(k); if (b) b.push(p); else grid.set(k, [p]);
      }
    }
  }

  /* --------------------------------------------------------- collision */

  function blocked(x, y, r) {
    if (x < r || y < r || x > WW - r || y > WH - r) return true;
    const tx = (x / T) | 0, ty = (y / T) | 0;
    if (SOLID_TILE.has(map[ty * MW + tx])) return true;
    const bucket = grid.get(((y / GC) | 0) * 4096 + ((x / GC) | 0));
    if (bucket) for (const p of bucket)
      if (dist2(x, y, p.x, p.y) < (p.r + r) * (p.r + r)) return true;
    return false;
  }

  /* Axis-separated so sliding along a wall feels right instead of sticking. */
  function moveEnt(e, dx, dy, r) {
    if (dx && !blocked(e.x + dx, e.y, r)) e.x += dx;
    if (dy && !blocked(e.x, e.y + dy, r)) e.y += dy;
  }

  /* ------------------------------------------------------------ spawning */

  function spawnFoe() {
    const hardness = 1 + wave * 0.16;
    let breed = BREEDS[0];
    const roll = Math.random();
    if (wave >= 2 && roll < 0.30) breed = BREEDS[1];
    if (wave >= 4 && roll > 0.88) breed = BREEDS[2];
    // spawn on a ring just outside the view so nothing pops in on screen
    const ring = Math.max(VW, VH) / ZOOM * 0.62 + 30;
    for (let tries = 0; tries < 24; tries++) {
      const a = Math.random() * TAU;
      const x = clamp(player.x + Math.cos(a) * ring, 12, WW - 12);
      const y = clamp(player.y + Math.sin(a) * ring, 12, WH - 12);
      if (blocked(x, y, 7)) continue;
      foes.push({ x, y, breed, hp: breed.hp * hardness, max: breed.hp * hardness,
        th: 0, anim: Math.random() * 3, flash: 0, cool: Math.random() * 0.6, dead: 0 });
      return;
    }
  }

  function dropLoot(x, y) {
    const r = Math.random();
    let kind = null;
    if (r < 0.24) kind = 'ammo';
    else if (r < 0.33) kind = 'medkit';
    else if (r < 0.62) kind = 'coin';
    else if (r < 0.65) kind = 'fuel';
    if (kind) drops.push({ x, y, kind, t: 0, life: 26 });
  }

  function burst(x, y, n, colour, spd, life) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU, s = spd * (0.35 + Math.random() * 0.65);
      parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, c: colour,
        t: 0, life: life * (0.6 + Math.random() * 0.6) });
    }
  }

  /* ------------------------------------------------------------ the loop */

  function startRun(kindKey) {
    const K = CLASSES[kindKey];
    buildWorld((Date.now() ^ 0x9e3779b9) >>> 0);
    let sx = (MW >> 1) * T + 8, sy = (MH >> 1) * T + 8;
    while (blocked(sx, sy, 7)) sx += T;
    player = { kind: kindKey, cfg: K, id: K.id, x: sx, y: sy, th: 0, hp: K.hp, max: K.hp,
      mag: K.gun.mag, reserve: K.gun.mag * 8, reloading: 0, cool: 0, anim: 0, iframe: 0,
      moving: false, aim: 0 };
    bullets = []; foes = []; drops = []; parts = []; lights = [];
    time = 0; wave = 1; waveT = 0; score = 0; kills = 0; spawnAcc = 0; shake = 0;
    running = true; paused = false; over = false;
    $('#screen-title').classList.add('hidden');
    $('#screen-over').classList.add('hidden');
    $('#hud').classList.remove('hidden');
    SFX.on(); SFX.wave();
    toast('NIGHT 1 — HOLD THE BLOCK');
    syncHud();
  }

  let toastT = 0;
  function toast(msg) { const el = $('#toast'); el.textContent = msg; el.classList.remove('hidden'); toastT = 2.4; }

  function fire() {
    const g = player.cfg.gun;
    if (player.cool > 0 || player.reloading > 0) return;
    if (player.mag <= 0) { reload(); return; }
    player.mag--; player.cool = g.rof;
    const a = player.aim + (Math.random() - 0.5) * g.spread * 2;
    const dx = Math.sin(a), dy = -Math.cos(a);
    bullets.push({ x: player.x + dx * 9, y: player.y + dy * 9 - 2,
      vx: dx * g.speed, vy: dy * g.speed, dmg: g.dmg, life: 0.85 });
    lights.push({ x: player.x + dx * 11, y: player.y + dy * 11, r: 58, t: 0, life: 0.07, warm: true });
    parts.push({ x: player.x + dx * 11, y: player.y + dy * 11, vx: -dx * 30, vy: -dy * 30,
      c: '#fee761', t: 0, life: 0.1 });
    shake = Math.min(6, shake + g.kick);
    SFX.shot();
    syncHud();
  }

  function reload() {
    const g = player.cfg.gun;
    if (player.reloading > 0 || player.mag >= g.mag || player.reserve <= 0) return;
    player.reloading = g.reload;
    SFX.reload();
  }

  function hurtPlayer(amount) {
    if (player.iframe > 0) return;
    player.hp -= amount; player.iframe = 0.42;
    shake = Math.min(11, shake + 4);
    burst(player.x, player.y, 7, '#b1252f', 60, 0.4);
    SFX.hurt();
    if (player.hp <= 0) { player.hp = 0; endRun(); }
    syncHud();
  }

  function endRun() {
    running = false; over = true;
    if (score > best) { best = score; localStorage.setItem('nightfall.best', String(best)); }
    $('#over-title').textContent = 'OVERRUN';
    $('#over-sub').textContent = 'You held out until night ' + wave + '.';
    $('#over-stats').innerHTML =
      '<div>SCORE<b>' + score + '</b></div><div>KILLS<b>' + kills + '</b></div>' +
      '<div>SURVIVED<b>' + ((time / 60) | 0) + 'm ' + ((time | 0) % 60) + 's</b></div>' +
      '<div>BEST<b>' + best + '</b></div>';
    $('#screen-over').classList.remove('hidden');
  }

  let clockShown = -1;
  function update(dt) {
    time += dt; waveT += dt;
    if ((time | 0) !== clockShown) {
      clockShown = time | 0;
      $('#clock-txt').textContent =
        String((clockShown / 60) | 0).padStart(2, '0') + ':' + String(clockShown % 60).padStart(2, '0');
    }
    if (toastT > 0 && (toastT -= dt) <= 0) $('#toast').classList.add('hidden');
    shake = Math.max(0, shake - dt * 24);

    /* ---- waves ---- */
    if (waveT > 52) {
      waveT = 0; wave++;
      player.reserve += player.cfg.gun.mag * 4;
      player.hp = Math.min(player.max, player.hp + 18);
      toast('NIGHT ' + wave + ' — THEY BRING MORE');
      SFX.wave(); syncHud();
    }
    /* Night one has to be winnable while you learn the controls, so the horde
       ramps from a trickle and the first three seconds spawn nothing at all. */
    if (time > 3) spawnAcc += dt * (0.42 + wave * 0.30);
    const cap = 12 + wave * 4;
    while (spawnAcc >= 1) { spawnAcc -= 1; if (foes.length < cap) spawnFoe(); }

    /* ---- player ---- */
    const a = axis();
    player.moving = !!(a.x || a.y);
    const sp = player.cfg.speed * dt;
    moveEnt(player, a.x * sp, a.y * sp, 6);
    if (player.moving) player.anim += dt;

    if (pointer.has) {
      const wx = cam.x + (pointer.x - VW / 2) / ZOOM, wy = cam.y + (pointer.y - VH / 2) / ZOOM;
      player.aim = Math.atan2(wx - player.x, -(wy - player.y));
    } else if (player.moving) {
      player.aim = Math.atan2(a.x, -a.y);
    }
    player.th = player.aim;
    player.cool = Math.max(0, player.cool - dt);
    player.iframe = Math.max(0, player.iframe - dt);
    if (player.reloading > 0 && (player.reloading -= dt) <= 0) {
      const g = player.cfg.gun, want = Math.min(g.mag - player.mag, player.reserve);
      player.mag += want; player.reserve -= want; player.reloading = 0; syncHud();
    }
    if ((firing || pointer.down || keys.has(' ')) && !over) fire();
    if (keys.has('r')) reload();

    /* ---- bullets ---- */
    for (let i = bullets.length - 1; i >= 0; i--) {
      const b = bullets[i];
      const steps = 3;                                 // substep so fast rounds cannot tunnel
      let gone = false;
      for (let s = 0; s < steps && !gone; s++) {
        b.x += b.vx * dt / steps; b.y += b.vy * dt / steps;
        if (blocked(b.x, b.y, 1)) {
          burst(b.x, b.y, 4, '#c0cbdc', 70, 0.22); gone = true; break;
        }
        for (const f of foes) {
          if (f.dead) continue;
          const rr = 8 * f.breed.scale;
          if (dist2(b.x, b.y, f.x, f.y - 2) < rr * rr) {
            f.hp -= b.dmg; f.flash = 0.09;
            burst(b.x, b.y, 5, '#8f1425', 90, 0.3);
            SFX.hit();
            if (f.hp <= 0) {
              f.dead = 1; f.anim = 0; kills++; score += f.breed.score + wave * 2;
              burst(f.x, f.y, 14, '#6a0f1e', 110, 0.55);
              dropLoot(f.x, f.y); SFX.kill(); syncHud();
            }
            gone = true; break;
          }
        }
      }
      if (gone || (b.life -= dt) <= 0) bullets.splice(i, 1);
    }

    /* ---- foes ---- */
    for (let i = foes.length - 1; i >= 0; i--) {
      const f = foes[i];
      f.flash = Math.max(0, f.flash - dt);
      if (f.dead) { f.anim += dt; if (f.anim > 2.6) foes.splice(i, 1); continue; }
      const dx = player.x - f.x, dy = player.y - f.y, d = Math.hypot(dx, dy) || 1;
      f.th = Math.atan2(dx, -dy);
      if (d > 13) {
        const sp2 = f.breed.speed * dt;
        /* Steer one step off-axis when the direct line is blocked: enough to
           round a crate without paying for a pathfinder in a horde this size. */
        const nx = dx / d, ny = dy / d;
        if (!blocked(f.x + nx * sp2, f.y + ny * sp2, 6)) { f.x += nx * sp2; f.y += ny * sp2; }
        else { moveEnt(f, -ny * sp2, nx * sp2, 6); }
        f.anim += dt;
      } else {
        f.cool -= dt;
        if (f.cool <= 0) { f.cool = 1.1; hurtPlayer(f.breed.dmg); }
        f.anim += dt * 0.5;
      }
    }

    /* ---- drops ---- */
    for (let i = drops.length - 1; i >= 0; i--) {
      const p = drops[i];
      p.t += dt;
      if (p.t > p.life) { drops.splice(i, 1); continue; }
      if (dist2(p.x, p.y, player.x, player.y) < 196) {
        if (p.kind === 'medkit') { player.hp = Math.min(player.max, player.hp + 35); }
        else if (p.kind === 'ammo') { player.reserve += player.cfg.gun.mag * 3; }
        else if (p.kind === 'coin') score += 50;
        else if (p.kind === 'fuel') score += 200;
        toast(PICKUPS[p.kind].label);
        SFX.pick(); drops.splice(i, 1); syncHud();
      }
    }

    /* ---- particles and transient lights ---- */
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.88; p.vy *= 0.88;
      if (p.t > p.life) parts.splice(i, 1);
    }
    for (let i = lights.length - 1; i >= 0; i--) {
      lights[i].t += dt; if (lights[i].t > lights[i].life) lights.splice(i, 1);
    }

    cam.x = lerp(cam.x, clamp(player.x, VW / (2 * ZOOM), WW - VW / (2 * ZOOM)), 1 - Math.pow(0.001, dt));
    cam.y = lerp(cam.y, clamp(player.y, VH / (2 * ZOOM), WH - VH / (2 * ZOOM)), 1 - Math.pow(0.001, dt));
  }

  /* ------------------------------------------------------------ drawing */

  let tileCv = null;
  const dark = document.createElement('canvas');
  const dctx = dark.getContext('2d');

  function drawSprite(id, state, i, x, y, scale, wash) {
    const f = GB.frame(id, state, i);
    if (!f) return;
    const s = scale || 1, w = f.w * s, h = f.h * s;
    ctx.drawImage(f.cv, Math.round(x - w / 2), Math.round(y - h / 2), w, h);
    if (wash) {
      // source-in recolour drawn over the sprite: keeps the silhouette, shifts the hue
      ctx.save();
      ctx.globalAlpha = wash[1];
      ctx.drawImage(GB.tint(f.cv, wash[0]), Math.round(x - w / 2), Math.round(y - h / 2), w, h);
      ctx.restore();
    }
  }

  function render() {
    const sx = shake ? (Math.random() - 0.5) * shake : 0, sy = shake ? (Math.random() - 0.5) * shake : 0;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#0b0e18';
    ctx.fillRect(0, 0, VW, VH);
    ctx.save();
    ctx.translate(Math.round(VW / 2 + sx), Math.round(VH / 2 + sy));
    ctx.scale(ZOOM, ZOOM);
    ctx.translate(-Math.round(cam.x), -Math.round(cam.y));
    ctx.imageSmoothingEnabled = false;

    /* ---- ground ---- */
    const halfW = VW / (2 * ZOOM) + T, halfH = VH / (2 * ZOOM) + T;
    const x0 = clamp(((cam.x - halfW) / T) | 0, 0, MW - 1), x1 = clamp(((cam.x + halfW) / T) | 0, 0, MW - 1);
    const y0 = clamp(((cam.y - halfH) / T) | 0, 0, MH - 1), y1 = clamp(((cam.y + halfH) / T) | 0, 0, MH - 1);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const c = tiles[map[y * MW + x]];
      if (c) ctx.drawImage(c, x * T, y * T);
    }

    /* ---- everything that sorts by y ---- */
    const sorted = [];
    for (const p of props) {
      if (p.x < cam.x - halfW - 32 || p.x > cam.x + halfW + 32) continue;
      if (p.y < cam.y - halfH - 48 || p.y > cam.y + halfH + 48) continue;
      sorted.push(p);
    }
    for (const f of foes) sorted.push(f);
    sorted.push(player);
    sorted.sort((a, b) => a.y - b.y);

    for (const e of sorted) {
      if (e === player) {
        const st = (player.moving ? 'walk_' : 'idle_') + dirName(player.th);
        const fr = Math.floor(player.anim * (player.moving ? 10 : 5));
        ctx.save();
        if (player.iframe > 0 && ((player.iframe * 24) | 0) % 2) ctx.globalAlpha = 0.45;
        drawSprite(player.id, st, fr, e.x, e.y - 2, 1);
        ctx.restore();
      } else if (e.breed) {
        if (e.dead) {
          drawSprite('td_zombie', 'blood_pool', Math.floor(e.anim * 6), e.x, e.y - 2, e.breed.scale);
        } else {
          const st = 'walk_' + dirName(e.th);
          drawSprite('td_zombie', st, Math.floor(e.anim * 8), e.x, e.y - 2, e.breed.scale,
            e.flash > 0 ? FLASH : e.breed.wash);
        }
      } else {
        drawSprite(e.id, e.state, e.anim ? Math.floor(time * e.anim + e.seed) : 0, e.x, e.y - 4, 1);
      }
    }

    /* ---- drops, bullets, particles ---- */
    for (const p of drops) {
      const bob = Math.sin(time * 4 + p.x) * 1.5;
      const fade = p.t > p.life - 4 ? (Math.floor(p.t * 6) % 2 ? 0.3 : 1) : 1;
      ctx.save(); ctx.globalAlpha = fade;
      drawSprite('td_pickups', PICKUPS[p.kind].state, Math.floor(time * 6), p.x, p.y + bob, 1);
      ctx.restore();
    }
    ctx.fillStyle = '#fee761';
    for (const b of bullets) ctx.fillRect(Math.round(b.x) - 1, Math.round(b.y) - 1, 2, 2);
    for (const p of parts) {
      ctx.globalAlpha = clamp(1 - p.t / p.life, 0, 1);
      ctx.fillStyle = p.c;
      ctx.fillRect(Math.round(p.x), Math.round(p.y), 1, 1);
    }
    ctx.globalAlpha = 1;
    ctx.restore();

    /* ---- night. Darkness is a full-screen fill with the lights cut OUT of
       it, so a torch beam brightens nothing — it simply is not covered. ---- */
    dctx.setTransform(1, 0, 0, 1, 0, 0);
    dctx.globalCompositeOperation = 'source-over';
    /* 0.80 looked atmospheric in the abstract and played like a blindfold:
       the map, the props and most of the horde were simply not there. 0.62
       keeps the night reading as night while leaving the world legible. */
    const nightness = 0.62;
    dctx.fillStyle = 'rgba(4,6,16,' + nightness + ')';
    dctx.fillRect(0, 0, VW, VH);
    dctx.globalCompositeOperation = 'destination-out';
    const toScreen = (wx, wy) => [VW / 2 + (wx - cam.x) * ZOOM + sx, VH / 2 + (wy - cam.y) * ZOOM + sy];

    const punch = (wx, wy, r, hard) => {
      const [px, py] = toScreen(wx, wy);
      const g = dctx.createRadialGradient(px, py, 0, px, py, r);
      g.addColorStop(0, 'rgba(0,0,0,' + (hard === undefined ? 1 : hard) + ')');
      g.addColorStop(0.55, 'rgba(0,0,0,.55)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      dctx.fillStyle = g;
      dctx.fillRect(px - r, py - r, r * 2, r * 2);
    };
    punch(player.x, player.y, 92 * ZOOM * 0.5, 0.94);
    // the flashlight cone: a wedge along the aim, drawn as a soft triangle
    {
      const [px, py] = toScreen(player.x, player.y);
      const reach = 230 * ZOOM * 0.5, spread = 0.52;
      const a0 = player.aim - Math.PI / 2;               // screen angle of the aim
      const g = dctx.createRadialGradient(px, py, 0, px, py, reach);
      g.addColorStop(0, 'rgba(0,0,0,.95)');
      g.addColorStop(0.6, 'rgba(0,0,0,.5)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      dctx.fillStyle = g;
      dctx.beginPath(); dctx.moveTo(px, py);
      dctx.arc(px, py, reach, a0 - spread, a0 + spread);
      dctx.closePath(); dctx.fill();
    }
    for (const p of props) if (p.light) {
      if (Math.abs(p.x - cam.x) > halfW + 120 || Math.abs(p.y - cam.y) > halfH + 120) continue;
      punch(p.x, p.y, (p.light + Math.sin(time * 9 + p.x) * 7) * ZOOM * 0.5, 0.9);
    }
    for (const l of lights) punch(l.x, l.y, Math.max(2, l.r * ZOOM * 0.5 * (1 - l.t / l.life)), 1);
    ctx.drawImage(dark, 0, 0);
  }

  /* ---------------------------------------------------------------- HUD */

  function syncHud() {
    const g = player.cfg.gun;
    $('#hp-fill').style.transform = 'scaleX(' + (player.hp / player.max) + ')';
    $('#hp-txt').textContent = Math.ceil(player.hp);
    $('#am-fill').style.transform = 'scaleX(' + (player.mag / g.mag) + ')';
    $('#am-txt').textContent = player.mag + ' / ' + player.reserve;
    $('#score-txt').textContent = score;
    $('#wave-txt').textContent = 'NIGHT ' + wave;
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
    ZOOM = clamp(Math.round(Math.min(VW, VH) / 260), 2, 5);
    ctx.imageSmoothingEnabled = false;
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
        if (running && (pad.x || pad.y)) player.aim = Math.atan2(pad.x, -pad.y);
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
    fireBtn.addEventListener('touchstart', e => { firing = true; SFX.on(); e.preventDefault(); }, { passive: false });
    fireBtn.addEventListener('touchend', () => { firing = false; });
    addEventListener('touchstart', () => document.body.classList.add('touch'), { once: true });
  }

  function buildPicker() {
    const host = $('#picker');
    host.innerHTML = '';
    for (const key of Object.keys(CLASSES)) {
      const c = CLASSES[key];
      const b = document.createElement('button');
      b.className = 'pick';
      b.innerHTML = '<img alt="' + c.name + '" src="' + GB.dataURL(c.id, 'walk_s', 2, 3) + '">' +
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
    tiles = GB.sliceTiles('td_tiles', 'sheet', T, 16, 4);
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
  window.NIGHTFALL = {
    stats: () => ({ foes: foes.length, bullets: bullets.length, drops: drops.length,
      props: props.length, parts: parts.length, wave, score, kills, time,
      hp: player ? player.hp : 0, mag: player ? player.mag : 0, running, over, zoom: ZOOM })
  };

  if (document.readyState === 'loading') addEventListener('DOMContentLoaded', init);
  else init();
})();
