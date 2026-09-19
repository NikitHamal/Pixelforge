/* Gatehold — a settlement-defence game.

   The clip this is built from is a colony sim at dawn: a small settlement on
   olive ground, villagers with names and jobs walking roads, wooden gates and
   palisades, and a swarm that chews through whatever stands between it and the
   hearth. The parts of it this file implements:

     - a 640x360 pixel-art framebuffer (the reference renders at exactly that)
     - a top bar of resource readouts, a population readout, and Day + HH:MM
     - a build panel of wooden structures, each with a cost and a description
     - hover tooltips in the reference's own vocabulary: name, Cost, Health
       x/y, Status, and on a villager a name and a Work line
     - villagers who gather, haul, build, guard, flee, and use roads
     - night waves of ants that path to the hearth and eat the walls you put
       in their way

   Everything is deterministic given the run seed: the map, the spawns and the
   village names all come off one xorshift stream, so the headless sim in
   scripts/sim-game.js sees the same valley every time. */
(() => {
  'use strict';
  const $ = s => document.querySelector(s);
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const ART = GH.ART, WD = GH.World;
  const T = 16;
  const VW = 640, VH = 360;               // the framebuffer, and the camera

  /* ---------------------------------------------------------- balance */

  const MIN_PER_SEC = 4;                  // in-game minutes per real second
  const START_MIN = 19 * 60;              // day 1 opens at 19:00, first night
  const NIGHT = 20, DAWN = 5, MORNING = 7, DUSK = 18;
  const START_RES = { wood: 60, food: 40, stone: 20, tools: 5 };
  const JOBS = ['Volunteer', 'Woodcutter', 'Farmer', 'Quarrier', 'Guard'];

  /* Structures. `art` names an ART.building entry, `w`/`h` is the footprint in
     tiles, `cost` is in resources, `hp` is what the swarm has to chew through.
     Roads are terrain: they are laid, not built, and never become an entity. */
  const BUILDS = {
    road: { name: 'Road', art: 'road', w: 1, h: 1, cost: { wood: 1 }, hp: 30, instant: true, ground: true,
      desc: 'A simple road that helps villagers move around the settlement and slightly increases their speed.' },
    gate: { name: 'Wooden Gate', art: 'gate', w: 1, h: 1, cost: { wood: 5 }, hp: 50, passable: true, tall: true,
      desc: 'A hinged gate. Ants cannot push through it, and villagers pass freely.' },
    wall: { name: 'Wooden Wall', art: 'wall', w: 1, h: 1, cost: { wood: 2 }, hp: 40,
      desc: 'A palisade section. The swarm stops to eat it, which buys you time.' },
    tower: { name: 'Watchtower', art: 'tower', w: 1, h: 1, cost: { wood: 10, stone: 4 }, hp: 80, tall: true,
      desc: 'An archer platform. Looses arrows at any ant that walks within nine tiles.' },
    house: { name: 'Cottage', art: 'house', w: 2, h: 2, cost: { wood: 8 }, hp: 90,
      desc: 'A timber cottage. Raises the settlement population cap by two.' },
    farm: { name: 'Farm', art: 'farm', w: 2, h: 2, cost: { wood: 5 }, hp: 40,
      desc: 'A tilled field. Farmers work it for food, and it keeps producing without them.' },
    lumber: { name: 'Lumber Camp', art: 'lumber', w: 2, h: 2, cost: { wood: 6 }, hp: 70,
      desc: 'A cutting camp. Woodcutters haul more wood per trip while it stands.' },
    quarry: { name: 'Quarry', art: 'quarry', w: 2, h: 2, cost: { wood: 8, stone: 4 }, hp: 70,
      desc: 'An open pit. Quarriers cut stone here without walking to the rocks.' },
    torch: { name: 'Torch', art: 'torch', w: 1, h: 1, cost: { wood: 1 }, hp: 12, passable: true, tall: true,
      desc: 'A pitch-soaked brand. Pushes the dark back a little way, which is when the swarm moves.' },
    /* not player-buildable: the settlement's own furniture */
    hearth: { name: 'The Hearth', art: 'hearth', w: 3, h: 2, cost: {}, hp: 400, heart: true,
      desc: 'The hall at the centre of the settlement. If it falls, Gatehold falls.' },
    store: { name: 'Storehouse', art: 'storehouse', w: 2, h: 2, cost: {}, hp: 120,
      desc: 'Where the haul comes in. Villagers deliver wood, food and stone here.' },
    well: { name: 'Well', art: 'well', w: 1, h: 1, cost: {}, hp: 60, passable: true,
      desc: 'Sweet water. The village gathers here at dusk.' }
  };
  const BUILD_ORDER = ['road', 'gate', 'wall', 'tower', 'house', 'farm', 'lumber', 'quarry', 'torch'];

  /* The swarm. Workers chew buildings, soldiers hurt people, majors are the
     day-3 answer to a wall of palisades. */
  const ANTS = {
    worker: { art: 'worker', hp: 26, dmg: 4, speed: 30, bite: 0.85, size: 12, score: 1 },
    soldier: { art: 'soldier', hp: 62, dmg: 9, speed: 34, bite: 0.75, size: 14, score: 2 },
    major: { art: 'major', hp: 260, dmg: 22, speed: 20, bite: 1.1, size: 20, score: 5 }
  };

  const NAMES = ['Klos', 'Bram', 'Ottil', 'Mera', 'Hesk', 'Vale', 'Runa', 'Torr',
    'Pell', 'Isa', 'Grim', 'Alda', 'Nix', 'Orin', 'Sable', 'Wren', 'Bode', 'Cira',
    'Hale', 'Juno', 'Tobe', 'Moss', 'Eda', 'Fenn'];

  /* ------------------------------------------------------------- state */

  let G = null;                           // the live run; rebuilt by reset()
  const cv = $('#cv'), ctx = cv.getContext('2d');
  const night = document.createElement('canvas'); night.width = VW; night.height = VH;
  const nctx = night.getContext('2d');

  const keys = new Set();
  const mouse = { sx: VW / 2, sy: VH / 2, x: VW / 2, y: VH / 2, wx: 0, wy: 0, on: false };
  let placing = null, hoverEnt = null, hoverBtn = null, lastT = 0;

  /* ------------------------------------------------------------- audio */

  const SFX = (() => {
    let ac = null, muted = false;
    const on = () => { if (!ac) { try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch { ac = null; } } };
    function blip(freq, dur, type, gain, slide) {
      if (muted || !ac) return;
      const o = ac.createOscillator(), g = ac.createGain(), t = ac.currentTime;
      o.type = type || 'square';
      o.frequency.setValueAtTime(freq, t);
      if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq * slide), t + dur);
      g.gain.setValueAtTime(gain || 0.05, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(ac.destination);
      o.start(t); o.stop(t + dur + 0.02);
    }
    function noise(dur, gain) {
      if (muted || !ac) return;
      const n = Math.floor(ac.sampleRate * dur), buf = ac.createBuffer(1, n, ac.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
      const src = ac.createBufferSource(), g = ac.createGain();
      src.buffer = buf; g.gain.value = gain || 0.07;
      src.connect(g); g.connect(ac.destination); src.start();
    }
    return {
      on, get muted() { return muted; },
      toggle() { on(); muted = !muted; return muted; },
      chop() { noise(0.06, 0.05); blip(320, 0.06, 'triangle', 0.03, 0.6); },
      place() { noise(0.08, 0.05); blip(220, 0.09, 'square', 0.04, 1.4); },
      bite() { blip(120, 0.05, 'sawtooth', 0.03, 0.7); },
      shot() { blip(700, 0.05, 'triangle', 0.03, 0.5); },
      hit() { noise(0.05, 0.05); blip(180, 0.05, 'sawtooth', 0.04, 0.6); },
      die() { blip(90, 0.18, 'sawtooth', 0.05, 0.4); },
      wave() { blip(200, 0.5, 'triangle', 0.07, 2.6); },
      deny() { blip(150, 0.09, 'square', 0.04, 0.7); },
      built() { blip(520, 0.1, 'triangle', 0.05, 1.6); }
    };
  })();

  /* ---------------------------------------------------------- utilities */

  const tileAt = (wx, wy) => ({ x: Math.floor(wx / T), y: Math.floor(wy / T) });
  const px = t => t * T + T / 2;
  const costStr = cost => {
    const bits = [];
    for (const k of ['wood', 'food', 'stone', 'tools']) if (cost[k]) bits.push(cost[k] + ' ' + k.toUpperCase());
    return bits.join(', ') || 'free';
  };
  const has = cost => { for (const k in cost) if (G.res[k] < cost[k]) return false; return true; };
  const pay = cost => { for (const k in cost) G.res[k] -= cost[k]; };
  const popCap = () => 8 + G.buildings.filter(b => b.kind === 'house').length * 2;
  const isHeart = b => !!BUILDS[b.kind].heart;

  function toast(text, kind) {
    const el = $('#toast');
    if (!el) return;
    el.textContent = text;
    el.className = 'show' + (kind ? ' ' + kind : '');
    G.toastT = 2.6;
  }

  /* Buildings live in a list AND in a tile index. `solid` (villagers path
     around) deliberately excludes gates, wells and torches, which people walk
     through; the ants block on anything with hit points, gates included. */
  function buildingAt(tx, ty) {
    if (tx < 0 || ty < 0 || tx >= WD.W || ty >= WD.H) return null;
    return G.bIndex[ty * WD.W + tx];
  }
  function rebuildIndex() {
    G.bIndex = new Array(WD.W * WD.H).fill(null);
    G.solid = new Uint8Array(WD.W * WD.H);
    for (const b of G.buildings) {
      if (b.destroyed) continue;
      const d = BUILDS[b.kind];
      for (let y = b.y; y < b.y + d.h; y++) {
        for (let x = b.x; x < b.x + d.w; x++) {
          if (x < 0 || y < 0 || x >= WD.W || y >= WD.H) continue;
          G.bIndex[y * WD.W + x] = b;
          if (!d.passable) G.solid[y * WD.W + x] = 1;
        }
      }
    }
    G.flowDirty = true;
  }
  function tilesFree(kind, tx, ty) {
    const d = BUILDS[kind];
    for (let y = ty; y < ty + d.h; y++) {
      for (let x = tx; x < tx + d.w; x++) {
        if (!WD.inside(G.map, x, y)) return false;
        const t = G.map.tiles[WD.idx(G.map, x, y)];
        if (t === WD.TERRAIN.WATER || t === WD.TERRAIN.SHORE) return false;
        if (buildingAt(x, y)) return false;
        if (!d.ground && G.map.blocked[WD.idx(G.map, x, y)]) return false;
      }
    }
    return true;
  }

  /* `preset` is the settlement the run opens with: it is already standing, and
     it does not count towards the player's build tally. */
  function place(kind, tx, ty, preset) {
    const d = BUILDS[kind];
    if (!tilesFree(kind, tx, ty)) return false;
    if (!preset) {
      if (!has(d.cost)) { SFX.deny(); toast('Not enough resources', 'bad'); return false; }
      pay(d.cost);
    }
    if (kind === 'road') {
      G.map.tiles[WD.idx(G.map, tx, ty)] = WD.TERRAIN.ROAD;
      G.roads++;
      if (!preset) G.placed++;
      SFX.place();
      return true;
    }
    const b = { kind, x: tx, y: ty, hp: d.hp, maxHp: d.hp,
      built: !!d.instant || !!preset, prog: (d.instant || preset) ? 1 : 0,
      cool: 0, flash: 0, destroyed: false };
    G.buildings.push(b);
    if (!preset) G.placed++;
    rebuildIndex();
    for (let y = ty; y < ty + d.h; y++) for (let x = tx; x < tx + d.w; x++) puff(px(x), px(y), '#8a7a52', 2);
    SFX.place();
    return true;
  }

  /* ---------------------------------------------------------- entities */

  function spawnVillager(name, tx, ty, job) {
    return { kind: 'villager', name: name || NAMES[(G.rand() * NAMES.length) | 0],
      x: px(tx), y: px(ty), dir: 'down', flip: false, hp: 60, maxHp: 60,
      job: job || 'Volunteer', state: 'idle', path: [], node: null, carry: 0,
      carryKind: 'wood', t: G.rand(), anim: 0, dead: 0, cd: 0, flash: 0, work: 0, gather: 0 };
  }

  function spawnAnt(kind, tx, ty) {
    const d = ANTS[kind];
    return { kind: 'ant', breed: kind, x: px(tx), y: px(ty), hp: d.hp, maxHp: d.hp,
      dmg: d.dmg, speed: d.speed, cd: G.rand() * 0.5, bite: 0, t: 0, dead: 0, wob: G.rand() * 6.28, flip: false, flash: 0 };
  }

  function puff(x, y, col, n) {
    for (let i = 0; i < n; i++) {
      const a = G.rand() * Math.PI * 2;
      G.fx.push({ x, y, vx: Math.cos(a) * 22, vy: Math.sin(a) * 12 - 12, life: 0.5, col, r: 1 });
    }
  }
  function float(x, y, text, col) {
    G.fx.push({ x, y, vx: 0, vy: -14, life: 1.1, text, col: col || ART.PAL.ink, r: 0 });
  }

  /* -------------------------------------------------------- world setup */

  function initialWorld(seed) {
    const w = WD.gen(seed);
    G.map = w.m;
    G.cx = w.cx; G.cy = w.cy;
    G.buildings = [];
    rebuildIndex();

    const put = (kind, tx, ty) => place(kind, tx, ty, true);
    put('hearth', w.cx - 1, w.cy - 1);                       // the swarm's objective
    /* Palisade ring with a gap on the north approach; the gate sits in it. */
    for (let a = 0; a < Math.PI * 2; a += 0.10) {
      const gx = Math.round(w.cx + Math.cos(a) * 11), gy = Math.round(w.cy + Math.sin(a) * 11);
      if (gy < w.cy && Math.abs(gx - w.cx) <= 1) continue;
      put('wall', gx, gy);
    }
    put('gate', w.cx, w.cy - 11);
    put('store', w.cx - 5, w.cy + 1);
    put('well', w.cx + 3, w.cy - 3);
    for (const h of w.houses) put('house', h.x, h.y);
    for (const f of w.farms) put('farm', f.x, f.y);
    put('torch', w.cx - 2, w.cy + 4);
    put('torch', w.cx + 3, w.cy + 4);
    /* felled timber inside the palisade: something to haul on day one without
       walking to the forest edge, and a reason the woodpile reads as stocked */
    put('well', w.cx - 3, w.cy + 5);
    G.map.props.push({ kind: 'logpile', x: w.cx - 4, y: w.cy - 3 });
    G.map.props.push({ kind: 'logpile', x: w.cx + 5, y: w.cy - 2 });
    G.map.props.push({ kind: 'logpile', x: w.cx + 4, y: w.cy + 4 });
    /* a starter staff: two woodcutters, a farmer and a guard */
    const starterJobs = ['Woodcutter', 'Woodcutter', 'Farmer', 'Guard'];
    G.villagers = [];
    for (let i = 0; i < 4; i++) G.villagers.push(spawnVillager(NAMES[i], w.cx - 2 + (i % 2), w.cy + 3, starterJobs[i]));
    G.flow = WD.flowField(G.map, w.cx, w.cy);
    G.flowDirty = false;
  }

  const nodeAt = p => (p.kind === 'pine' || p.kind === 'oak' || p.kind === 'logpile') ? 'wood'
    : (p.kind === 'boulder' || p.kind === 'rock') ? 'stone' : p.kind === 'bush' ? 'food' : null;

  function nearestNode(kind, wx, wy) {
    let best = null, bd = 1e9;
    for (const p of G.map.props) {
      const k = nodeAt(p);
      if (!k || (kind && k !== kind)) continue;
      const d = Math.hypot(px(p.x) - wx, px(p.y) - wy);
      if (d < bd) { bd = d; best = p; }
    }
    return best;
  }

  function removeProp(p) {
    const i = G.map.props.indexOf(p);
    if (i >= 0) G.map.props.splice(i, 1);
    if (WD.SOLID[p.kind]) {
      G.map.blocked[WD.idx(G.map, p.x, p.y)] = 0;
      G.map.props.push({ kind: 'stump', x: p.x, y: p.y });   // the felling stays visible
      G.flowDirty = true;
    }
    puff(px(p.x), px(p.y), nodeAt(p) === 'stone' ? '#948e7c' : '#6b4a2a', 4);
  }

  /* ------------------------------------------------------------ update */

  function step(dt) {
    const g = G;
    g.minutes += dt * MIN_PER_SEC;
    if (g.minutes >= 1440) { g.minutes -= 1440; g.day++; onNewDay(); }
    const hour = g.minutes / 60;

    if (hour >= NIGHT && !g.waveOn) startWave();
    if (hpAll() && g.waveOn && g.pending === 0 && (hour < DAWN || hour > NIGHT) && g.ants.length <= 2) g.waveOn = false;

    if (g.flowDirty) { g.flowT -= dt; if (g.flowT <= 0) { g.flow = WD.flowField(g.map, g.cx, g.cy); g.flowDirty = false; g.flowT = 0.4; } }

    updateVillagers(dt);
    updateAnts(dt);
    updateShots(dt);
    updateSpawn(dt);
    updateFx(dt);

    /* sweep the dead once, after everything has had its say */
    if (g.buildings.some(b => b.destroyed)) {
      g.buildings = g.buildings.filter(b => !b.destroyed);
      rebuildIndex();
    }
    if (g.toastT > 0) { g.toastT -= dt; if (g.toastT <= 0) { const el = $('#toast'); if (el) el.className = ''; } }

    /* growth: food turns into people */
    g.growT += dt;
    if (g.growT > 35) {
      g.growT = 0;
      if (g.res.food >= 15 && g.villagers.length < popCap()) {
        g.res.food -= 15;
        g.villagers.push(spawnVillager(null, g.cx + (g.rand() < 0.5 ? -2 : 2), g.cy + 3, 'Volunteer'));
        float(px(g.cx), px(g.cy) + 14, 'A VILLAGER ARRIVES', '#8fae55');
        toast('A villager arrives', 'good');
      }
    }
    /* farms feed the settlement whether or not anyone is standing in them */
    const farms = g.buildings.filter(b => b.kind === 'farm' && b.built).length;
    g.res.food += farms * 0.12 * dt;
    g.res.food = Math.max(0, g.res.food - g.villagers.length * 0.02 * dt);

    if (g.hearth && g.hearth.hp <= 0 && !g.over) gameOver();
  }
  const hpAll = () => true;

  function onNewDay() {
    toast('Day ' + G.day + ' — rebuild before dusk', 'good');
  }

  function startWave() {
    const g = G;
    g.waveOn = true;
    g.wave++;
    g.pending = 4 + g.day * 2 + (g.wave - 1) * 2;
    g.spawnT = 0.4;
    g.waveMix = { worker: 0.55, soldier: 0.35, major: g.day >= 3 ? 0.10 : 0 };
    toast('WAVE ' + g.wave + ' — the ants are coming', 'bad');
    SFX.wave();
  }

  function spawnPoint() {
    for (let tries = 0; tries < 300; tries++) {
      const side = (G.rand() * 4) | 0;
      let tx = 2 + (G.rand() * (WD.W - 4) | 0), ty = 2 + (G.rand() * (WD.H - 4) | 0);
      if (side === 0) ty = 1; else if (side === 1) ty = WD.H - 2;
      else if (side === 2) tx = 1; else tx = WD.W - 2;
      if (WD.walkable(G.map, tx, ty) && !buildingAt(tx, ty)) return { tx, ty };
    }
    return { tx: 1, ty: 1 };
  }

  function updateSpawn(dt) {
    const g = G;
    if (!g.waveOn || g.pending <= 0) return;
    g.spawnT -= dt;
    if (g.spawnT > 0) return;
    g.spawnT = Math.max(0.16, 0.9 - g.day * 0.06);
    const p = spawnPoint();
    const r = g.rand(), mix = g.waveMix;
    const breed = r < mix.worker ? 'worker'
      : r < mix.worker + mix.soldier ? 'soldier'
        : mix.major > 0 ? 'major' : 'soldier';
    g.ants.push(spawnAnt(breed, p.tx, p.ty));
    g.pending--;
  }

  /* --------------------------------------------------------- villagers */

  function moveAlong(e, dt, speed) {
    if (!e.path.length) return false;
    const n = e.path[0];
    const tx = px(n.x), ty = px(n.y);
    const dx = tx - e.x, dy = ty - e.y, d = Math.hypot(dx, dy);
    if (d < 1.4) { e.path.shift(); return e.path.length > 0; }
    const onRoad = G.map.tiles[WD.idx(G.map, Math.floor(e.x / T), Math.floor(e.y / T))] === WD.TERRAIN.ROAD;
    const v = speed * (onRoad ? 1.45 : 1);          // the road bonus, in the flesh
    e.x += dx / d * v * dt;
    e.y += dy / d * v * dt;
    e.dir = Math.abs(dx) > Math.abs(dy) ? 'side' : (dy < 0 ? 'up' : 'down');
    e.flip = e.dir === 'side' && dx < 0;
    e.anim += dt * (v / 16);
    return true;
  }

  function repath(e, tx, ty) {
    const a = tileAt(e.x, e.y);
    e.path = WD.path(G.map, a.x, a.y, tx, ty, (x, y) => G.solid[y * WD.W + x]);
    e.goal = { x: tx, y: ty };
    return e.path.length > 0;
  }

  function nearestAnt(x, y, range) {
    let best = null, bd = range * range;
    for (const a of G.ants) {
      if (a.dead) continue;
      const d = (a.x - x) * (a.x - x) + (a.y - y) * (a.y - y);
      if (d < bd) { bd = d; best = a; }
    }
    return best;
  }

  function updateVillagers(dt) {
    const g = G;
    const store = g.buildings.find(b => b.kind === 'store' && !b.destroyed);
    const sites = g.buildings.filter(b => !b.built && !b.destroyed);
    for (const v of g.villagers) {
      if (v.dead) { v.dead += dt; continue; }
      v.t += dt;
      if (v.flash > 0) v.flash -= dt;
      const threat = nearestAnt(v.x, v.y, 64);

      if (v.job === 'Guard') {
        if (threat) {
          const dx = threat.x - v.x, dy = threat.y - v.y, d = Math.hypot(dx, dy) || 1;
          v.dir = Math.abs(dx) > Math.abs(dy) ? 'side' : (dy < 0 ? 'up' : 'down');
          v.flip = v.dir === 'side' && dx < 0;
          v.anim += dt * 5;
          if (d > 12) { v.x += dx / d * 36 * dt; v.y += dy / d * 36 * dt; }
          else {
            v.cd -= dt;
            if (v.cd <= 0) {
              v.cd = 0.8; v.work++;
              threat.hp -= 11; threat.flash = 0.12;
              float(threat.x, threat.y - 8, '11', '#f6c24a');
              SFX.hit();
              if (threat.hp <= 0) killAnt(threat);
            }
          }
          continue;
        }
        if (!v.path.length) repath(v, g.cx + ((v.t * 7 | 0) % 5) - 2, g.cy - 6 + ((v.t * 5 | 0) % 5));
        moveAlong(v, dt, 24);
        continue;
      }

      /* Anyone unarmed runs for the hearth when a soldier gets close. */
      if (threat && Math.hypot(threat.x - v.x, threat.y - v.y) < 46) {
        v.state = 'flee';
        if (!v.path.length || (v.t | 0) % 2 === 0) repath(v, g.cx, g.cy + 4);
        moveAlong(v, dt, 42);
        continue;
      }

      if (v.carry > 0) {
        v.state = 'haul';
        const sx = store ? store.x : g.cx, sy = store ? store.y : g.cy;
        if (!v.path.length && !repath(v, sx, sy)) { v.carry = 0; continue; }
        moveAlong(v, dt, 26);
        if (Math.hypot(v.x - px(sx), v.y - px(sy)) < 26) {
          const mult = (v.job === 'Woodcutter' && g.buildings.some(b => b.kind === 'lumber' && b.built)) ? 1.5 : 1;
          g.res[v.carryKind] += v.carry * mult;
          float(v.x, v.y - 10, '+' + Math.round(v.carry * mult) + ' ' + v.carryKind.toUpperCase(),
            v.carryKind === 'wood' ? '#a3763f' : v.carryKind === 'stone' ? '#948e7c' : '#c9a227');
          v.carry = 0; v.state = 'idle';
          v.path = []; v.node = null;                 // don't walk the stale route to the stump
          SFX.built();
        }
        continue;
      }

      /* build first: a settlement that never finishes its walls is not a
         settlement. Everyone pitches in, whatever their trade. */
      if (sites.length) {
        const site = sites[0];
        v.state = 'build';
        if (!v.path.length || !v.goal || v.goal.x !== site.x || v.goal.y !== site.y) repath(v, site.x, site.y);
        if (!moveAlong(v, dt, 26)) {
          v.work += dt;
          site.prog += dt * 0.085;
          if (site.prog >= 1) {
            site.prog = 1; site.built = true;
            float(px(site.x), px(site.y) - 12, BUILDS[site.kind].name.toUpperCase() + ' BUILT', '#8fae55');
            toast(BUILDS[site.kind].name + ' finished', 'good');
            SFX.built();
          }
        }
        continue;
      }

      /* patchwork: with no site to finish, anyone standing near something the
         swarm has chewed sets about mending it. This is what lets a settlement
         survive a bad night without the player rebuilding from scratch. */
      if (!v.node && !v.path.length) {
        let hurt = null, worst = 0.99;
        for (const b of g.buildings) {
          if (!b.built || b.hp >= b.maxHp * 0.99) continue;
          const ratio = b.hp / b.maxHp;
          if (ratio < worst && Math.hypot(px(b.x) - v.x, px(b.y) - v.y) < 150) { worst = ratio; hurt = b; }
        }
        if (hurt) {
          v.state = 'repair';
          if (Math.hypot(px(hurt.x) - v.x, px(hurt.y) - v.y) > 18) {
            if (!repath(v, hurt.x, hurt.y)) { /* unreachable: fall through */ }
            moveAlong(v, dt, 26);
          } else {
            hurt.hp = Math.min(hurt.maxHp, hurt.hp + 1.6 * dt);
            v.anim += dt * 3;
            if (((v.t * 4) | 0) !== (((v.t - dt) * 4) | 0)) puff(px(hurt.x), px(hurt.y) - 4, '#8a6134', 1);
          }
          continue;
        }
      }

      /* work: pick a node for the job, walk to it, gather, carry it home */
      const want = v.job === 'Woodcutter' ? 'wood' : v.job === 'Quarrier' ? 'stone' : v.job === 'Farmer' ? 'food' : null;
      if (!v.node || v.map !== g.map || g.map.props.indexOf(v.node) < 0) v.node = null;
      if (!v.node && !v.path.length) {
        const n = nearestNode(want, v.x, v.y);
        if (n) { v.node = n; repath(v, n.x, n.y); }
        else if (v.t > 4) { v.t = 0; v.job = 'Volunteer'; }
      }
      if (v.node) {
        const d = Math.hypot(px(v.node.x) - v.x, px(v.node.y) - v.y);
        if (d > 16) {
          if (!v.path.length) repath(v, v.node.x, v.node.y);
          moveAlong(v, dt, 26);
        } else {
          v.state = 'gather';
          v.gather += dt;
          v.dir = 'down';
          v.anim += dt * 2;
          if (((v.gather * 6) | 0) !== (((v.gather - dt) * 6) | 0)) {
            puff(px(v.node.x), px(v.node.y), nodeAt(v.node) === 'stone' ? '#948e7c' : '#8a6134', 1);
            SFX.chop();
          }
          if (v.gather > 4.5) {
            v.gather = 0;
            v.carry = 2;
            v.carryKind = nodeAt(v.node) || 'wood';
            if (v.node.kind !== 'bush') removeProp(v.node);
            v.node = null; v.path = [];
          }
        }
        continue;
      }
      /* nothing to do: drift toward the hearth */
      if (!v.path.length) repath(v, g.cx + ((v.t * 3 | 0) % 5) - 2, g.cy + 4);
      moveAlong(v, dt, 20);
    }
    for (let i = g.villagers.length - 1; i >= 0; i--) if (g.villagers[i].dead > 1.4) g.villagers.splice(i, 1);
  }

  function killAnt(a) {
    if (a.dead) return;
    a.dead = 0.001;
    G.killed++;
    puff(a.x, a.y, '#7a4a2c', 6);
    float(a.x, a.y - 10, '+' + ANTS[a.breed].score, '#c0503a');
    SFX.die();
  }

  /* --------------------------------------------------------------- ants */

  /* A palisade is a barrier, not a meal: ants gnaw one for a while. Everything
     past the wall — cottages, farms, and the hall itself — they wreck at full
     bite, which is what makes a breach so expensive. */
  const BARRIER = { wall: 1, gate: 1 };

  function attackTarget(a, tgt, dt) {
    a.flip = (tgt.kind === 'villager' ? tgt.x : px(tgt.x)) < a.x;
    const barrier = tgt.kind !== 'villager' && BARRIER[tgt.kind];
    a.cd -= dt;
    if (a.cd > 0) return;
    a.cd = ANTS[a.breed].bite * (barrier ? 2 : 1);
    a.bite = 0.16;
    tgt.hp -= barrier ? Math.max(1, Math.round(a.dmg * 0.35)) : a.dmg;
    tgt.flash = 0.14;
    SFX.bite();
    const tx = tgt.kind === 'villager' ? tgt.x : px(tgt.x);
    const ty = tgt.kind === 'villager' ? tgt.y : px(tgt.y);
    puff(tx, ty, '#3f2a1c', 2);
    if (tgt.kind === 'villager') {
      if (tgt.hp <= 0 && !tgt.dead) {
        tgt.dead = 0.001; G.lost++;
        float(tgt.x, tgt.y - 12, tgt.name.toUpperCase() + ' FALLS', '#c0503a');
        toast(tgt.name + ' was killed', 'bad');
      }
      return;
    }
    if (tgt.hp <= 0 && !tgt.destroyed) {
      tgt.destroyed = true;
      puff(px(tgt.x), px(tgt.y), '#6b4a2a', 8);
      if (isHeart(tgt)) return;
      toast(BUILDS[tgt.kind].name + ' destroyed', 'bad');
    }
  }

  function updateAnts(dt) {
    const g = G;
    for (const a of g.ants) {
      if (a.dead) { a.dead += dt; continue; }
      a.t += dt;
      a.wob += dt * 6;
      if (a.flash > 0) a.flash -= dt;
      if (a.bite > 0) a.bite -= dt;
      if (a.cd > 0) a.cd -= dt;

      /* 1. anything within reach is on the menu */
      let tgt = null, bd = 1e9;
      for (const b of g.buildings) {
        if (b.destroyed) continue;
        const d = Math.hypot(px(b.x) - a.x, px(b.y) - a.y);
        if (d < T * 1.15 && d < bd) { bd = d; tgt = b; }
      }
      for (const v of g.villagers) {
        if (v.dead) continue;
        const d = Math.hypot(v.x - a.x, v.y - a.y);
        if (d < T * 0.9 && d < bd) { bd = d; tgt = v; }
      }
      if (tgt) { attackTarget(a, tgt, dt); continue; }

      /* 2. otherwise walk the field home. A building on the next tile is not a
            detour: it is the thing this ant came here to dismantle. */
      const t = tileAt(a.x, a.y);
      const s = g.flow.step[WD.idx(g.map, t.x, t.y)];
      let nx, ny;
      if (s >= 0) {
        const dirx = [1, 1, 0, -1, -1, -1, 0, 1][s], diry = [0, 1, 1, 1, 0, -1, -1, -1][s];
        const blocker = buildingAt(t.x + dirx, t.y + diry);
        if (blocker && !blocker.destroyed && blocker.hp > 0) { attackTarget(a, blocker, dt); continue; }
        nx = px(t.x + dirx); ny = px(t.y + diry);
      } else { nx = px(g.cx); ny = px(g.cy); }
      const dx = nx - a.x, dy = ny - a.y, d = Math.hypot(dx, dy) || 1;
      a.x += dx / d * a.speed * dt;
      a.y += dy / d * a.speed * dt;
      a.flip = dx < 0;
      /* cheap separation so a column does not stack into one pixel */
      for (const o of g.ants) {
        if (o === a || o.dead) continue;
        const ox = a.x - o.x, oy = a.y - o.y, od = Math.hypot(ox, oy);
        if (od < 6 && od > 0.01) { a.x += ox / od * 10 * dt; a.y += oy / od * 10 * dt; }
      }
    }
    for (let i = g.ants.length - 1; i >= 0; i--) if (g.ants[i].dead > 0.6) g.ants.splice(i, 1);
  }

  function updateShots(dt) {
    const g = G;
    for (const b of g.buildings) {
      if (b.kind !== 'tower' || !b.built || b.destroyed) continue;
      b.cool -= dt;
      if (b.cool > 0) continue;
      let best = null, bd = (9 * T) * (9 * T);
      for (const a of g.ants) {
        if (a.dead) continue;
        const d = (a.x - px(b.x)) * (a.x - px(b.x)) + (a.y - px(b.y)) * (a.y - px(b.y));
        if (d < bd) { bd = d; best = a; }
      }
      if (best) {
        b.cool = 1.1;
        const ang = Math.atan2(best.y - px(b.y), best.x - px(b.x));
        g.shots.push({ x: px(b.x), y: px(b.y) - 14, vx: Math.cos(ang) * 260, vy: Math.sin(ang) * 260, life: 1.2, dmg: 18 });
        SFX.shot();
      }
    }
    for (let i = g.shots.length - 1; i >= 0; i--) {
      const s = g.shots[i];
      s.x += s.vx * dt; s.y += s.vy * dt; s.life -= dt;
      let hit = null;
      for (const a of g.ants) { if (!a.dead && Math.hypot(a.x - s.x, a.y - s.y) < 7) { hit = a; break; } }
      if (hit) {
        hit.hp -= s.dmg; hit.flash = 0.12;
        float(hit.x, hit.y - 8, String(s.dmg), '#f6c24a');
        SFX.hit();
        if (hit.hp <= 0) killAnt(hit);
        g.shots.splice(i, 1);
        continue;
      }
      if (s.life <= 0) g.shots.splice(i, 1);
    }
  }

  function updateFx(dt) {
    for (let i = G.fx.length - 1; i >= 0; i--) {
      const f = G.fx[i];
      f.x += f.vx * dt; f.y += f.vy * dt;
      if (!f.text) f.vy += 40 * dt;
      f.life -= dt;
      if (f.r) f.r += dt * 2;
      if (f.life <= 0) G.fx.splice(i, 1);
    }
  }

  /* -------------------------------------------------------------- draw */

  /* Dawn is the reference clip's whole story: it opens at 03:27 in the dark and
     the valley comes up over twenty seconds. Same curve here, driven off the
     clock rather than off the footage. */
  function lightLevel(hour) {
    if (hour >= MORNING && hour < DUSK) return 0;
    if (hour >= DUSK) return clamp((hour - DUSK) / 3, 0, 1);
    if (hour < DAWN) return 1;
    return clamp(1 - (hour - DAWN) / 2, 0, 1);
  }

  function draw() {
    const g = G, cam = g.cam;
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#2a2c1c';
    ctx.fillRect(0, 0, VW, VH);

    const x0 = Math.max(0, Math.floor(cam.x / T)), y0 = Math.max(0, Math.floor(cam.y / T));
    const x1 = Math.min(WD.W - 1, Math.ceil((cam.x + VW) / T)), y1 = Math.min(WD.H - 1, Math.ceil((cam.y + VH) / T));
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        ctx.drawImage(ART.tile(WD.NAMES[g.map.tiles[WD.idx(g.map, x, y)]]), x * T - cam.x, y * T - cam.y);
      }
    }

    const list = [];
    for (const p of g.map.props) {
      const wx = p.x * T, wy = p.y * T;
      if (wx < cam.x - 48 || wy < cam.y - 64 || wx > cam.x + VW + 16 || wy > cam.y + VH + 16) continue;
      list.push({ y: wy + T, p });
    }
    for (const b of g.buildings) { if (!b.destroyed) list.push({ y: b.y * T + BUILDS[b.kind].h * T, b }); }
    for (const v of g.villagers) if (!v.dead) list.push({ y: v.y, v });
    for (const a of g.ants) if (!a.dead) list.push({ y: a.y, a });
    list.sort((p, q) => p.y - q.y);

    for (const item of list) {
      if (item.p) {
        const c = ART.prop(item.p.kind);
        ctx.drawImage(c, item.p.x * T + (T - c.width) / 2 - cam.x, item.p.y * T + T - c.height - cam.y);
      } else if (item.b) drawBuilding(item.b, cam);
      else if (item.v) drawVillager(item.v, cam);
      else drawAnt(item.a, cam);
    }

    for (const s of g.shots) {
      ctx.fillStyle = '#8a6a3a';
      ctx.fillRect(Math.round(s.x - cam.x) - 2, Math.round(s.y - cam.y) - 1, 5, 2);
      ctx.fillStyle = '#e8dcc0';
      ctx.fillRect(Math.round(s.x - cam.x), Math.round(s.y - cam.y) - 1, 2, 2);
    }
    for (const f of g.fx) {
      const a = clamp(f.life * 2, 0, 1);
      ctx.globalAlpha = a;
      if (f.text) {
        const lab = ART.label(f.text, { font: 'mini', color: f.col, outline: '#181425' });
        ctx.drawImage(lab, Math.round(f.x - cam.x - lab.width / 2), Math.round(f.y - cam.y));
      } else {
        ctx.fillStyle = f.col;
        ctx.fillRect(Math.round(f.x - cam.x), Math.round(f.y - cam.y), Math.ceil(f.r), Math.ceil(f.r));
      }
      ctx.globalAlpha = 1;
    }

    if (hoverEnt && !hoverEnt.dead) {
      ctx.strokeStyle = '#e8dcc0';
      ctx.lineWidth = 1;
      const w = hoverEnt.kind === 'villager' ? 14 : 18;
      ctx.strokeRect(Math.round(hoverEnt.x - cam.x - w / 2) + 0.5, Math.round(hoverEnt.y - cam.y - 18) + 0.5, w, 22);
    }

    if (placing) {
      const d = BUILDS[placing], t = tileAt(mouse.wx, mouse.wy);
      const ok = tilesFree(placing, t.x, t.y) && has(d.cost);
      ctx.globalAlpha = 0.6;
      if (!d.ground) {
        const art = ART.building(d.art);
        ctx.drawImage(art, t.x * T + (T * d.w - art.width) / 2 - cam.x, (t.y + d.h) * T - art.height - cam.y);
      }
      ctx.globalAlpha = 1;
      ctx.strokeStyle = ok ? '#8fae55' : '#c0503a';
      ctx.lineWidth = 1;
      ctx.strokeRect(t.x * T - cam.x + 0.5, t.y * T - cam.y + 0.5, d.w * T - 1, d.h * T - 1);
    }

    const hour = g.minutes / 60, dark = lightLevel(hour);
    if (dark > 0.02) {
      nctx.globalCompositeOperation = 'source-over';
      nctx.clearRect(0, 0, VW, VH);
      nctx.fillStyle = 'rgba(10,10,26,' + (0.70 * dark).toFixed(3) + ')';
      nctx.fillRect(0, 0, VW, VH);
      nctx.globalCompositeOperation = 'destination-out';
      for (const b of g.buildings) {
        const k = b.kind;
        if (k !== 'torch' && k !== 'hearth' && k !== 'campfire') continue;
        const r = (k === 'torch' ? 96 : 168) * (1 - 0.12 * dark);
        const cxp = px(b.x) - cam.x, cyp = px(b.y) - cam.y;
        if (cxp < -r || cyp < -r || cxp > VW + r || cyp > VH + r) continue;
        const grad = nctx.createRadialGradient(cxp, cyp, r * 0.12, cxp, cyp, r);
        grad.addColorStop(0, 'rgba(0,0,0,0.95)');
        grad.addColorStop(0.7, 'rgba(0,0,0,0.45)');
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        nctx.fillStyle = grad;
        nctx.beginPath(); nctx.arc(cxp, cyp, r, 0, Math.PI * 2); nctx.fill();
      }
      nctx.globalCompositeOperation = 'source-over';
      ctx.drawImage(night, 0, 0);
      /* the low sun of a dawn that has not quite arrived */
      if (dark < 0.85) {
        ctx.fillStyle = 'rgba(130,96,58,' + (0.10 * (1 - Math.abs(dark - 0.45) * 2)).toFixed(3) + ')';
        ctx.fillRect(0, 0, VW, VH);
      }
    }
  }

  function drawBuilding(b, cam) {
    const d = BUILDS[b.kind];
    const art = ART.building(d.art);
    const dx = b.x * T + (T * d.w - art.width) / 2 - cam.x;
    const dy = (b.y + d.h) * T - art.height - cam.y;
    if (!b.built) {
      ctx.globalAlpha = 0.4;
      ctx.drawImage(art, dx, dy);
      ctx.globalAlpha = 1;
      const s = ART.building('scaffold');
      for (let y = 0; y < d.h; y++) for (let x = 0; x < d.w; x++) ctx.drawImage(s, (b.x + x) * T - cam.x, (b.y + y) * T - cam.y);
      ctx.fillStyle = '#181425';
      ctx.fillRect(b.x * T - cam.x, b.y * T - cam.y - 5, d.w * T, 3);
      ctx.fillStyle = '#d9a94a';
      ctx.fillRect(b.x * T - cam.x + 1, b.y * T - cam.y - 4, Math.round((d.w * T - 2) * clamp(b.prog, 0, 1)), 1);
      return;
    }
    ctx.drawImage(art, dx, dy);
    if (b.flash > 0) {
      ctx.globalAlpha = clamp(b.flash * 3, 0, 0.7);
      ctx.globalCompositeOperation = 'lighter';
      ctx.drawImage(art, dx, dy);
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
    }
    if (b.hp < b.maxHp) {
      const w = Math.max(12, d.w * T - 4);
      ctx.fillStyle = '#181425';
      ctx.fillRect(b.x * T - cam.x + 2, b.y * T - cam.y - 5, w, 3);
      ctx.fillStyle = b.hp / b.maxHp > 0.4 ? '#8fae55' : '#c0503a';
      ctx.fillRect(b.x * T - cam.x + 3, b.y * T - cam.y - 4, Math.round((w - 2) * clamp(b.hp / b.maxHp, 0, 1)), 1);
    }
  }

  /* Villagers come off the library's rigged NPCs, so their walk cycle is the
     one the whole project already uses. This only picks the state. */
  function drawVillager(v, cam) {
    const st = v.state === 'gather' ? 'idle' : 'walk';
    const nm = st + '_' + v.dir;
    const f = GB.frame(v.flip ? 'villager_f' : 'villager_m', nm, (v.anim * 6) | 0)
      || GB.frame('villager_m', nm, (v.anim * 6) | 0)
      || GB.frame('villager_m', 'idle_down', 0);
    if (!f) return;
    const dx = Math.round(v.x - cam.x - f.w / 2), dy = Math.round(v.y - cam.y - f.h + 6);
    ctx.drawImage(f.cv, dx, dy);
    if (v.flash > 0) {
      ctx.globalAlpha = clamp(v.flash * 4, 0, 0.85);
      ctx.drawImage(GB.tint(f.cv, '#ffffff', 1), dx, dy);
      ctx.globalAlpha = 1;
    }
    if (v.hp < v.maxHp) {
      ctx.fillStyle = '#181425';
      ctx.fillRect(dx + 4, dy - 4, 12, 3);
      ctx.fillStyle = v.hp / v.maxHp > 0.4 ? '#8fae55' : '#c0503a';
      ctx.fillRect(dx + 5, dy - 3, Math.round(10 * clamp(v.hp / v.maxHp, 0, 1)), 1);
    }
  }

  function drawAnt(a, cam) {
    const d = ANTS[a.breed];
    const walk = ((a.t * 9) | 0) % 2;
    const art = ART.ant(d.art + (walk ? '_walk' : ''));
    const dx = Math.round(a.x - cam.x - art.width / 2), dy = Math.round(a.y - cam.y - art.height + 5);
    if (a.flip) {
      ctx.save();
      ctx.translate(dx + art.width, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(art, 0, dy);
      ctx.restore();
    } else ctx.drawImage(art, dx, dy);
    if (a.flash > 0) {
      ctx.globalAlpha = clamp(a.flash * 4, 0, 0.8);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(dx + 2, dy + 2, art.width - 4, art.height - 4);
      ctx.globalAlpha = 1;
    }
    if (a.hp < a.maxHp) {
      ctx.fillStyle = '#181425';
      ctx.fillRect(dx, dy - 4, art.width, 2);
      ctx.fillStyle = '#c0503a';
      ctx.fillRect(dx + 1, dy - 3, Math.round((art.width - 2) * clamp(a.hp / a.maxHp, 0, 1)), 1);
    }
  }

  /* --------------------------------------------------------------- HUD */

  function hudUpdate() {
    const g = G;
    const set = (id, text) => { const el = document.getElementById(id); if (el) el.textContent = text; };
    set('res-wood', Math.floor(g.res.wood));
    set('res-food', Math.floor(g.res.food));
    set('res-stone', Math.floor(g.res.stone));
    set('res-tools', Math.floor(g.res.tools));
    set('res-pop', g.villagers.length + '/' + popCap());
    const hh = Math.floor(g.minutes / 60), mm = Math.floor(g.minutes % 60);
    set('clock-txt', (hh < 10 ? '0' : '') + hh + ':' + (mm < 10 ? '0' : '') + mm);
    set('day-txt', 'Day ' + g.day);
    const left = g.waveOn ? 0 : Math.max(0, NIGHT - g.minutes / 60) * 60 / MIN_PER_SEC;
    set('killed-txt', String(g.killed));
    set('wave-txt', g.waveOn
      ? 'WAVE ' + g.wave + ' \u2014 ' + (g.ants.length + g.pending) + ' ANTS'
      : (left > 0 ? 'DUSK IN ' + Math.ceil(left) + 'S' : 'THE VALLEY IS QUIET'));
    const hp = g.hearth ? Math.max(0, Math.ceil(g.hearth.hp)) : 0;
    const max = g.hearth ? g.hearth.maxHp : 1;
    set('hearth-txt', hp + '/' + max);
    const fill = document.getElementById('hearth-fill');
    if (fill) fill.style.transform = 'scaleX(' + clamp(hp / max, 0, 1).toFixed(3) + ')';
    for (const c of document.querySelectorAll('#panel .bcard')) {
      const k = c.dataset.build;
      if (k) c.classList.toggle('poor', !has(BUILDS[k].cost));
    }
  }

  function paintIcons() {
    for (const c of document.querySelectorAll('canvas.ico')) {
      const name = c.dataset.ico;
      if (!name) continue;
      const gc = c.getContext('2d');
      if (!gc) continue;
      gc.imageSmoothingEnabled = false;
      gc.clearRect(0, 0, 16, 16);
      gc.drawImage(ART.icon(name), 1, 1);
    }
  }

  function buildPanel() {
    const panel = $('#panel');
    panel.innerHTML = '';
    paintIcons();
    BUILD_ORDER.forEach((kind, i) => {
      const d = BUILDS[kind];
      const card = document.createElement('button');
      card.className = 'bcard';
      card.dataset.build = kind;
      const ic = document.createElement('canvas');
      ic.width = 16; ic.height = 16;
      const c = ic.getContext('2d');
      c.imageSmoothingEnabled = false;
      c.drawImage(ART.icon(kind), 1, 1);
      card.appendChild(ic);
      const key = document.createElement('i');
      key.textContent = String(i + 1);
      card.appendChild(key);
      card.addEventListener('mouseenter', () => { hoverBtn = kind; showBuildTip(kind); });
      card.addEventListener('mouseleave', () => { if (hoverBtn === kind) { hoverBtn = null; if (G.tipMode === 'build') hideTip(); } });
      card.addEventListener('click', () => selectBuild(kind));
      panel.appendChild(card);
    });
  }

  function showBuildTip(kind) {
    const d = BUILDS[kind];
    $('#tip-name').textContent = d.name;
    $('#tip-line1').textContent = 'Cost: ' + costStr(d.cost);
    $('#tip-line2').textContent = 'Health: ' + d.hp + '/' + d.hp;
    $('#tip-desc').textContent = d.desc;
    $('#tip').classList.add('show');
    G.tipMode = 'build';
  }
  function showEntTip(lines) {
    $('#tip-name').textContent = lines.name;
    $('#tip-line1').textContent = lines.a || '';
    $('#tip-line2').textContent = lines.b || '';
    $('#tip-desc').textContent = lines.desc || '';
    $('#tip').classList.add('show');
    G.tipMode = 'ent';
  }
  function hideTip() { const el = $('#tip'); if (el) el.classList.remove('show'); if (G) G.tipMode = null; }

  function placeTip() {
    const el = $('#tip');
    if (!el) return;
    const w = el.offsetWidth || 200, h = el.offsetHeight || 84;
    const vw = window.innerWidth, vh = window.innerHeight;
    let x, y;
    if (G.tipMode === 'build') { x = vw - w - 10; y = vh - h - 10; }
    else { x = mouse.sx + 16; y = mouse.sy + 12; }
    el.style.left = clamp(x, 6, Math.max(6, vw - w - 6)) + 'px';
    el.style.top = clamp(y, 6, Math.max(6, vh - h - 6)) + 'px';
  }

  function selectBuild(kind) {
    placing = placing === kind ? null : kind;
    for (const c of document.querySelectorAll('#panel .bcard')) c.classList.toggle('on', c.dataset.build === placing);
    if (placing) toast(BUILDS[kind].name + ' \u2014 click the ground to place', '');
  }

  function entUnder(x, y) {
    let best = null, bd = 22;
    for (const v of G.villagers) {
      if (v.dead) continue;
      const d = Math.hypot(v.x - x, v.y - y - 8);
      if (d < bd) { bd = d; best = v; }
    }
    if (best) return best;
    for (const a of G.ants) {
      if (a.dead) continue;
      if (Math.hypot(a.x - x, a.y - y) < 20) return a;
    }
    return null;
  }

  function hoverUpdate() {
    if (placing) { hoverEnt = null; if (G.tipMode === 'ent') hideTip(); return; }
    const e = entUnder(mouse.wx, mouse.wy);
    const b = buildingAt(Math.floor(mouse.wx / T), Math.floor(mouse.wy / T));
    if (e !== hoverEnt) {
      hoverEnt = e;
      if (e && e.kind === 'villager') {
        showEntTip({ name: e.name, a: 'Health: ' + Math.max(0, Math.ceil(e.hp)) + '/' + e.maxHp,
          b: 'Work: ' + e.job, desc: 'Click to change their work.' });
      } else if (e) {
        showEntTip({ name: 'Ant ' + e.breed.toUpperCase(),
          a: 'Health: ' + Math.max(0, Math.ceil(e.hp)) + '/' + e.maxHp, b: 'Chewing on the settlement', desc: '' });
      } else if (b) {
        showEntTip({ name: BUILDS[b.kind].name,
          a: 'Health: ' + Math.max(0, Math.ceil(b.hp)) + '/' + b.maxHp,
          b: 'Status: ' + (b.built ? 'Built' : b.prog > 0.05 ? 'Building' : 'Blueprint'),
          desc: BUILDS[b.kind].desc });
      } else if (G.tipMode === 'ent') hideTip();
    } else if (hoverEnt && hoverEnt.kind === 'villager') {
      $('#tip-line1').textContent = 'Health: ' + Math.max(0, Math.ceil(hoverEnt.hp)) + '/' + hoverEnt.maxHp;
    }
  }

  /* -------------------------------------------------------------- input */

  function onMove(e) {
    const r = cv.getBoundingClientRect();
    const sx = (e.clientX - (r.left || 0)) / (r.width || VW) * VW;
    const sy = (e.clientY - (r.top || 0)) / (r.height || VH) * VH;
    mouse.sx = e.clientX; mouse.sy = e.clientY;
    mouse.x = sx; mouse.y = sy; mouse.on = true;
    mouse.wx = sx + G.cam.x; mouse.wy = sy + G.cam.y;
  }

  function onClick() {
    if (!G || G.over || G.hold) return;
    if (placing) {
      const t = tileAt(mouse.wx, mouse.wy);
      if (place(placing, t.x, t.y)) {
        /* roads and walls stay selected: you never want just one */
        if (placing !== 'road' && placing !== 'wall' && placing !== 'torch') selectBuild(placing);
      }
      return;
    }
    const ent = entUnder(mouse.wx, mouse.wy);
    if (ent && ent.kind === 'villager') {
      ent.job = JOBS[(JOBS.indexOf(ent.job) + 1) % JOBS.length];
      float(ent.x, ent.y - 14, ent.job.toUpperCase(), '#d9a94a');
      SFX.place();
      showEntTip({ name: ent.name, a: 'Health: ' + Math.max(0, Math.ceil(ent.hp)) + '/' + ent.maxHp,
        b: 'Work: ' + ent.job, desc: 'Click to change their work.' });
    }
  }

  addEventListener('keydown', e => {
    const k = (e.key || '').toLowerCase();
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) e.preventDefault();
    keys.add(k);
    if (k === 'escape') { placing = null; for (const c of document.querySelectorAll('#panel .bcard')) c.classList.remove('on'); }
    if (k === 'p') togglePause();
    if (k === 'm') toggleMute();
    if (k === 'f') cycleSpeed();
    const n = parseInt(k, 10);
    if (n >= 1 && n <= BUILD_ORDER.length) selectBuild(BUILD_ORDER[n - 1]);
  });
  addEventListener('keyup', e => keys.delete((e.key || '').toLowerCase()));
  addEventListener('blur', () => keys.clear());

  function togglePause() {
    G.paused = !G.paused;
    const b = $('#btn-pause');
    if (b) b.textContent = G.paused ? 'RESUME' : 'PAUSE';
  }
  /* Colony sims are slow by nature; a fast-forward is the difference between
     watching a night and playing one. */
  function cycleSpeed() {
    G.speed = G.speed === 1 ? 2 : G.speed === 2 ? 4 : 1;
    const b = $('#btn-speed');
    if (b) b.textContent = G.speed + 'x';
  }
  function toggleMute() {
    const m = SFX.toggle();
    const b = $('#btn-mute');
    if (b) b.textContent = m ? 'SOUND OFF' : 'SOUND';
  }

  function panCamera(dt) {
    const cam = G.cam, sp = 260 * dt;
    if (keys.has('a') || keys.has('arrowleft')) cam.x -= sp;
    if (keys.has('d') || keys.has('arrowright')) cam.x += sp;
    if (keys.has('w') || keys.has('arrowup')) cam.y -= sp;
    if (keys.has('s') || keys.has('arrowdown')) cam.y += sp;
    cam.x = clamp(cam.x, 0, WD.W * T - VW);
    cam.y = clamp(cam.y, 0, WD.H * T - VH);
  }

  function resize() {
    const s = Math.min(window.innerWidth / VW, window.innerHeight / VH);
    cv.style.width = Math.round(VW * s) + 'px';
    cv.style.height = Math.round(VH * s) + 'px';
  }

  /* ------------------------------------------------------------ run flow */

  function reset(mode, hold) {
    const seeds = [0x1234abcd, 0x51edc0de, 0x0badf00d];
    let s = seeds[clamp(mode | 0, 0, 2)] | 0;
    G = {
      rand: () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; s |= 0; return (s >>> 0) / 4294967296; },
      map: null, buildings: [], bIndex: [], solid: null, villagers: [], ants: [], shots: [], fx: [],
      res: Object.assign({}, START_RES), day: 1, minutes: START_MIN, wave: 0, waveOn: false,
      pending: 0, spawnT: 0, killed: 0, lost: 0, placed: 0, roads: 0, growT: 0, toastT: 0,
      over: false, paused: false, hold: !!hold, speed: 1, cam: { x: 0, y: 0 },
      flow: null, flowDirty: false, flowT: 0, tipMode: null, hearth: null, cx: 0, cy: 0
    };
    placing = null; hoverEnt = null; hoverBtn = null;
    if (mode === 1) { G.res.wood += 40; G.res.food += 40; }
    initialWorld((G.rand() * 1e9) | 0);
    G.hearth = G.buildings.find(b => isHeart(b));
    if (mode === 2) {                       // OPEN FIELDS: the valley has been cleared
      G.map.props.length = 0;
      G.map.blocked.fill(0);
      G.flowDirty = true;
    }
    G.cam.x = clamp(px(G.cx) - VW / 2, 0, WD.W * T - VW);
    G.cam.y = clamp(px(G.cy) - VH / 2, 0, WD.H * T - VH);
    hideTip();
    buildPanel();
    hudUpdate();
    if (!hold) {
      $('#screen-title').classList.add('hidden');
      $('#screen-over').classList.add('hidden');
    }
  }

  function gameOver() {
    G.over = true;
    const el = $('#screen-over');
    $('#over-title').textContent = 'THE HEARTH IS LOST';
    $('#over-sub').textContent = 'The swarm took Gatehold on day ' + G.day + '.';
    $('#over-stats').innerHTML =
      '<span>DAYS HELD<b>' + G.day + '</b></span>' +
      '<span>ANTS KILLED<b>' + G.killed + '</b></span>' +
      '<span>VILLAGERS LOST<b>' + G.lost + '</b></span>' +
      '<span>STRUCTURES BUILT<b>' + G.placed + '</b></span>';
    el.classList.remove('hidden');
    hideTip();
  }

  function frame(ts) {
    requestAnimationFrame(frame);
    if (!G) return;
    const dt = Math.min(0.05, lastT ? (ts - lastT) / 1000 : 1 / 60);
    lastT = ts;
    if (!G.paused && !G.over && !G.hold) {
      panCamera(dt);
      step(dt * (G.speed || 1));
      hoverUpdate();
      hudUpdate();
      if (G.tipMode) placeTip();
    }
    draw();
  }

  /* ---------------------------------------------------------------- boot */

  function boot() {
    cv.width = VW; cv.height = VH;
    resize();
    addEventListener('resize', resize);
    cv.addEventListener('mousemove', onMove);
    cv.addEventListener('mousedown', e => { if (G && !G.hold) onMove(e); onClick(e); });
    cv.addEventListener('contextmenu', e => {
      e.preventDefault();
      placing = null;
      for (const c of document.querySelectorAll('#panel .bcard')) c.classList.remove('on');
    });
    const bp = $('#btn-pause'), bm = $('#btn-mute'), bs = $('#btn-speed');
    if (bp) bp.addEventListener('click', togglePause);
    if (bm) bm.addEventListener('click', toggleMute);
    if (bs) bs.addEventListener('click', cycleSpeed);

    /* Three openings. The clip opens on a settlement that is already standing,
       so the choice is what it was built from, not whether it exists. */
    const picker = $('#picker');
    const OPENINGS = [
      { mode: 0, title: 'FULL STORE', blurb: 'Timber and grain to spare.' },
      { mode: 1, title: 'DEEP CELLARS', blurb: 'A richer start, no more land.' },
      { mode: 2, title: 'OPEN FIELDS', blurb: 'No cover for the swarm to come through.' }
    ];
    OPENINGS.forEach(o => {
      const b = document.createElement('button');
      b.className = 'pick';
      b.innerHTML = '<b>' + o.title + '</b><span>' + o.blurb + '</span>';
      b.addEventListener('click', () => { reset(o.mode); lastT = 0; });
      picker.appendChild(b);
    });
    const again = $('#btn-again');
    if (again) again.addEventListener('click', () => { reset(0); lastT = 0; });

    reset(0, true);            // world behind the title screen, frozen
    requestAnimationFrame(frame);
  }

  window.GATEHOLD = {
    boot,
    stats: () => ({ day: G.day, clock: document.getElementById('clock-txt').textContent,
      wood: Math.floor(G.res.wood), pop: G.villagers.length, ants: G.ants.length,
      killed: G.killed, hearth: G.hearth ? Math.ceil(G.hearth.hp) : 0,
      antsAt: G.ants.map(a => [Math.round(a.x / T), Math.round(a.y / T), Math.round(a.hp)]),
      build: G.buildings.filter(b => b.kind === 'tower' || b.kind === 'wall' || b.kind === 'gate')
        .map(b => [b.kind, b.built ? 'built' : Math.round(b.prog * 100) + '%', Math.round(b.hp)]),
      shots: G.shots.length,
      villagers: G.villagers.map(v => ({ name: v.name, job: v.job, state: v.state,
        path: v.path.length, node: v.node ? v.node.kind : null, carry: v.carry })) }),
    /* Headless tools (scripts/shot-game.js and friends) use this to frame the
       valley at a given hour without simulating the whole night first. */
    setClock(h) { G.minutes = clamp(h, 0, 23.99) * 60; G.waveOn = false; G.pending = 0; G.ants.length = 0; },
    reset
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
