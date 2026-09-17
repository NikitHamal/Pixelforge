/* Runefall — a pixel RPG survival game built 100% on PixelForge library assets.
   Survivors-like: pick a class, kite monster waves, grab XP, draft upgrades,
   slay looped bosses, keep the campfire close. No external assets. */
window.RF = window.RF || {};
RF.Game = (() => {
  const S = RF.Sprites, AU = RF.Audio;
  const ZOOM = 2;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const dist2 = (a, b) => { const dx = a.x - b.x, dy = a.y - b.y; return dx * dx + dy * dy; };
  const $ = id => document.getElementById(id);

  /* ================= static data ================= */
  const CLASSES = {
    knight: { name: 'Knight', spr: 'rpg_knight', atk: 'attack_side', hp: 130, speed: 64, dmg: 24, cd: 0.55, range: 56, ranged: false, desc: 'Sword arcs. Unbreakable.', icon: ['rpg_arsenal', 'greatsword'] },
    ranger: { name: 'Ranger', spr: 'rpg_ranger', atk: 'bow_side', hp: 90, speed: 70, dmg: 15, cd: 0.42, range: 460, ranged: true, projSpeed: 330, desc: 'Piercing arrows. Never still.', icon: ['weapons', 'bow'] },
    cleric: { name: 'Cleric', spr: 'rpg_cleric', atk: 'cast', hp: 105, speed: 66, dmg: 17, cd: 0.6, range: 420, ranged: true, projSpeed: 260, homing: true, regen: 0.5, desc: 'Holy bolts that seek evil.', icon: ['rpg_arsenal', 'wand'] },
    rogue: { name: 'Rogue', spr: 'rpg_rogue', atk: 'attack_side', hp: 95, speed: 78, dmg: 12, cd: 0.3, range: 240, ranged: true, projSpeed: 400, crit: 0.15, desc: 'A storm of daggers.', icon: ['rpg_arsenal', 'dagger'] }
  };
  // move states per facing; creatures reuse one state for all facings.
  const FOES = {
    chicken: { spr: 'chicken', mv: 'walk', hp: 8, spd: 58, dmg: 0, r: 10, xp: 2, passive: true },
    slime: { spr: 'slime', mv: 'walk', hp: 20, spd: 30, dmg: 8, r: 11, xp: 1 },
    bat: { spr: 'bat', mv: 'fly', hp: 13, spd: 70, dmg: 7, r: 10, xp: 1, wobble: true },
    mushroom: { spr: 'mushroom', mv: 'walk', hp: 44, spd: 24, dmg: 10, r: 11, xp: 2 },
    goblin: { spr: 'rpg_goblin', mv: null, hp: 28, spd: 54, dmg: 10, r: 11, xp: 2, humanoid: true },
    spider: { spr: 'rpg_spider', mv: 'crawl', hp: 32, spd: 60, dmg: 11, r: 12, xp: 3 },
    spiderling: { spr: 'rpg_spiderling', mv: 'crawl', hp: 12, spd: 78, dmg: 6, r: 8, xp: 1 },
    cow: { spr: 'rpg_animals', mv: 'cow_walk', hp: 40, spd: 20, dmg: 0, r: 13, xp: 4, passive: true },
    sheep: { spr: 'rpg_animals', mv: 'sheep_walk', hp: 24, spd: 26, dmg: 0, r: 11, xp: 2, passive: true },
    imp: { spr: 'rpg_imp', mv: 'dart', hp: 22, spd: 76, dmg: 9, r: 9, xp: 2, wobble: true },
    bandit: { spr: 'rpg_bandit', mv: null, atk: 'attack_side', hp: 40, spd: 58, dmg: 12, r: 11, xp: 3, humanoid: true },
    wraith: { spr: 'rpg_wraith', mv: 'float', hp: 70, spd: 48, dmg: 15, r: 11, xp: 5, drift: true },
    boar: { spr: 'boar', mv: 'trot', charge: 'charge', hp: 48, spd: 50, dmg: 14, r: 12, xp: 3, charger: true },
    wolf: { spr: 'wolf', mv: 'run', atk: 'attack', hp: 36, spd: 74, dmg: 12, r: 11, xp: 3 },
    skeleton: { spr: 'skeleton', mv: null, hp: 58, spd: 42, dmg: 14, r: 11, xp: 4, humanoid: true },
    orc: { spr: 'orc', mv: null, hp: 95, spd: 38, dmg: 18, r: 13, xp: 5, humanoid: true },
    ghost: { spr: 'ghost', mv: 'float', hp: 52, spd: 52, dmg: 13, r: 11, xp: 4, drift: true },
    necro: { spr: 'rpg_necromancer', mv: null, hp: 65, spd: 40, dmg: 8, r: 11, xp: 6, humanoid: true, shooter: true },
    demon: { spr: 'rpg_demon', mv: null, hp: 950, spd: 44, dmg: 24, r: 20, xp: 40, humanoid: true, boss: true, scale: 2.5 },
    slimeking: { spr: 'rpg_slime_king', mv: 'hop', slam: 'slam', hp: 650, spd: 40, dmg: 20, r: 20, xp: 35, boss: true, hopper: true, scale: 2.5 },
    dragon: { spr: 'rpg_dragon', mv: 'fly', atk: 'fireball', hp: 1500, spd: 52, dmg: 22, r: 22, xp: 60, boss: true, flyer: true, shooter: true, scale: 3 },
    ent: { spr: 'rpg_ent', mv: 'stomp', slam: 'slam', hp: 1300, spd: 30, dmg: 26, r: 22, xp: 55, boss: true, scale: 3 },
    spiderqueen: { spr: 'rpg_spider_queen', mv: 'crawl', atk: 'lunge', hp: 1150, spd: 46, dmg: 23, r: 18, xp: 45, boss: true, scale: 2.6 }
  };
  const BOSS_ORDER = ['slimeking', 'demon', 'dragon', 'ent', 'spiderqueen'];
  const BOSS_TIMES = [90, 200, 320, 450, 560];
  const BOSS_LINES = { slimeking: 'It hungers for heroes', demon: 'The pit opens', dragon: 'Death from above', ent: 'The forest wakes', spiderqueen: 'Something skitters below' };
  const CARDS = [
    { id: 'might', name: 'Sharp Blade', desc: '+25% damage', icon: ['rpg_arsenal', 'greatsword'], apply: p => p.dmg *= 1.25 },
    { id: 'haste', name: 'Quick Hands', desc: '+15% attack speed', icon: ['rpg_status', 'haste'], apply: p => p.cd *= 0.87 },
    { id: 'boots', name: 'Swift Boots', desc: '+8% move speed', icon: ['rpg_armor', 'boots'], apply: p => p.speed *= 1.08 },
    { id: 'vit', name: 'Heart Vessel', desc: '+25 max HP, heal 25', icon: ['consumables', 'heart'], apply: p => { p.maxhp += 25; p.hp = Math.min(p.maxhp, p.hp + 25); } },
    { id: 'magnet', name: 'Greed Charm', desc: '+45% pickup range', icon: ['coin_gem', 'gem'], apply: p => p.magnet *= 1.45 },
    { id: 'multi', name: 'Split Shot', desc: '+1 projectile', icon: ['rpg_arsenal', 'arrows'], ranged: true, max: 3, apply: p => p.shots++ },
    { id: 'reach', name: 'Long Arm', desc: '+30% attack range', icon: ['rpg_arsenal', 'spear'], melee: true, max: 2, apply: p => p.range *= 1.3 },
    { id: 'regen', name: 'Second Heart', desc: '+0.7 HP/s regen', icon: ['rpg_status', 'regen'], apply: p => p.regen += 0.7 },
    { id: 'crit', name: 'Hunter Eye', desc: '+12% crit chance', icon: ['rpg_status', 'attack_up'], apply: p => p.crit += 0.12 },
    { id: 'feast', name: 'Feast', desc: 'Heal 60% now', icon: ['consumables', 'meat'], apply: p => p.hp = Math.min(p.maxhp, p.hp + p.maxhp * 0.6) }
  ];

  /* ================= state ================= */
  const G = {
    screen: 'title', world: null, player: null,
    enemies: [], projs: [], eprojs: [], picks: [], parts: [], fx: [], floats: [], chests: [],
    time: 0, kills: 0, spawnT: 0, bossIdx: 0, bossCycle: 0, boss: null,
    cam: { x: 0, y: 0 }, shake: 0, dayT: 0.25, shrineCd: 0,
    keys: {}, joy: { x: 0, y: 0, on: false }, atkQueued: false,
    cardCounts: {}, elapsed: 0
  };

  /* ================= helpers ================= */
  function faceOf(dx, dy) {
    if (Math.abs(dx) > Math.abs(dy) * 1.15) return { s: 'side', flip: dx < 0 };
    return { s: dy >= 0 ? 'down' : 'up', flip: false };
  }
  function adv(e, dt) {
    const st = S.frames(e.spr, e.state);
    if (!st) return;
    e.t += dt * st.fps;
    const n = st.frames.length;
    if (st.loop) { e.frame = Math.floor(e.t) % n; e.done = false; }
    else { e.frame = Math.min(n - 1, Math.floor(e.t)); e.done = e.t >= n; }
  }
  function float(x, y, txt, color = '#fff', big = false) {
    if (G.floats.length > 40) G.floats.shift();
    G.floats.push({ x, y, txt, color, t: 0, big });
  }
  function burst(x, y, id, state, scale = 2) {
    const st = S.frames(id, state);
    if (st) G.fx.push({ x, y, frames: st.frames, fps: st.fps, t: 0, scale });
  }
  function puff(x, y, color, n = 8, spd = 60) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, v = spd * (0.4 + Math.random());
      G.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 20, t: 0, life: 0.4 + Math.random() * 0.3, color, size: 2 + Math.random() * 2 });
    }
  }
  function hurtFlash(e) { e.flash = 0.09; }

  /* ================= run setup ================= */
  function startRun(classId) {
    const C = CLASSES[classId];
    G.world = RF.World.build();
    G.player = { cls: classId, spr: C.spr, x: G.world.spawn.x, y: G.world.spawn.y,
      hp: C.hp, maxhp: C.hp, speed: C.speed, dmg: C.dmg, cd: C.cd, range: C.range,
      ranged: C.ranged, projSpeed: C.projSpeed || 0, homing: !!C.homing,
      regen: C.regen || 0, crit: C.crit || 0, magnet: 70, shots: 1,
      level: 1, xp: 0, xpNext: 8, state: 'idle_down', frame: 0, t: 0, done: false,
      atkT: 0, atkLock: 0, face: { s: 'down', flip: false }, flash: 0, r: 11,
      atkName: C.atk, deadT: 0 };
    G.enemies = []; G.projs = []; G.eprojs = []; G.picks = [];
    G.parts = []; G.fx = []; G.floats = []; G.chests = [];
    G.time = 0; G.kills = 0; G.spawnT = 1; G.bossIdx = 0; G.bossCycle = 0; G.boss = null;
    G.shake = 0; G.dayT = 0.3; G.shrineCd = 0; G.cardCounts = {};
    // starting gifts: a snack and a compliment
    dropPick(G.player.x - 30, G.player.y + 20, 'coin');
    dropPick(G.player.x + 30, G.player.y + 20, 'coin');
    $('bossbar').classList.add('hidden');
    updateHp(); updateXp();
    showScreen('play');
    banner(C.name + ' enters Runefall', 'Survive the falling dark');
    AU.unlock();
  }

  /* ================= spawning ================= */
  function hpScale() { return 1 + G.time / 150; }
  function unlocked() {
    const t = G.time, pool = [['slime', 10], ['chicken', 3], ['sheep', 2]];
    if (t > 25) pool.push(['bat', 8]);
    if (t > 35) pool.push(['imp', 6], ['cow', 2]);
    if (t > 60) pool.push(['bandit', 6]);
    if (t > 50) pool.push(['goblin', 8], ['mushroom', 5]);
    if (t > 80) pool.push(['spider', 7]);
    if (t > 95) pool.push(['spiderling', 6]);
    if (t > 110) pool.push(['wolf', 6], ['boar', 4]);
    if (t > 150) pool.push(['skeleton', 6]);
    if (t > 190) pool.push(['orc', 5], ['ghost', 4], ['wraith', 3]);
    if (t > 230) pool.push(['necro', 3]);
    return pool;
  }
  function spawnPos() {
    const vw = view().w, vh = view().h, R = Math.hypot(vw, vh) / 2 + 80;
    const a = Math.random() * Math.PI * 2;
    return {
      x: clamp(G.cam.x + vw / 2 + Math.cos(a) * R, 40, G.world.W - 40),
      y: clamp(G.cam.y + vh / 2 + Math.sin(a) * R, 40, G.world.H - 40)
    };
  }
  function spawnFoe(key, x, y, elite = false) {
    const d = FOES[key];
    const mult = (elite ? 3 : 1) * hpScale() * (d.boss ? (1 + G.bossCycle * 0.6) : 1);
    const p = x === undefined ? spawnPos() : { x, y };
    const e = { key, def: d, spr: d.spr, x: p.x, y: p.y,
      hp: d.hp * mult, maxhp: d.hp * mult, spd: d.spd * rnd(0.9, 1.1),
      dmg: d.dmg * (elite ? 1.5 : 1) * (1 + G.time / 400),
      r: d.r * (d.scale || 1) * (elite ? 1.25 : 1),
      state: d.humanoid ? 'walk_down' : (d.mv || 'idle'), frame: 0, t: Math.random() * 4,
      flip: false, flash: 0, hitCd: 0, atkAnim: 0, shootT: rnd(1, 2.5), slamT: 3,
      elite, boss: !!d.boss, dead: false, deadT: 0, chargeT: rnd(1, 3), wob: Math.random() * 9,
      face: { s: 'down', flip: false } };
    G.enemies.push(e);
    return e;
  }
  const rnd = (a, b) => a + Math.random() * (b - a);
  function director(dt) {
    // bosses on schedule
    if (G.bossIdx < BOSS_TIMES.length && G.time >= BOSS_TIMES[G.bossIdx] + G.bossCycle * 560 && !G.boss) {
      const key = BOSS_ORDER[G.bossIdx];
      const p = spawnPos();
      G.boss = spawnFoe(key, p.x, p.y);
      banner('⚠ ' + bossName(key) + ' ⚠', BOSS_LINES[key] || '');
      AU.boss(); G.shake = 8;
      $('bossbar').classList.remove('hidden');
    }
    if (G.boss && G.boss.dead && G.boss.gone) {
      G.boss = null; $('bossbar').classList.add('hidden');
      G.bossIdx++;
      if (G.bossIdx >= BOSS_TIMES.length) { G.bossIdx = 0; G.bossCycle++; }
    }
    // trickle spawns
    G.spawnT -= dt;
    if (G.spawnT <= 0 && G.enemies.length < 70) {
      G.spawnT = Math.max(0.4, 2.1 - G.time * 0.004);
      const pool = unlocked();
      let total = 0; pool.forEach(([, w]) => total += w);
      let roll = Math.random() * total, key = pool[0][0];
      for (const [k, w] of pool) { roll -= w; if (roll <= 0) { key = k; break; } }
      const elite = Math.random() < 0.07 + G.time / 9000;
      spawnFoe(key, undefined, undefined, elite);
      // pack bonus at night
      if (night() > 0.6 && Math.random() < 0.4) spawnFoe(key);
    }
  }
  function bossName(key) {
    return { slimeking: 'GLOOP, THE SLIME KING', demon: 'MALACHAR THE DEMON', dragon: 'PYRAX THE RED', ent: 'OLD THORNBEARD', spiderqueen: 'ARACHNE, THE BROOD MOTHER' }[key] || key;
  }

  /* ================= combat ================= */
  function nearestFoe(x, y, maxD) {
    let best = null, bd = maxD * maxD;
    for (const e of G.enemies) {
      if (e.dead) continue;
      const d = dist2(e, { x, y });
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  }
  function damageFoe(e, dmg, kx, ky, color) {
    if (e.dead) return;
    let crit = false;
    if (Math.random() < (G.player.crit || 0)) { dmg *= 2; crit = true; }
    dmg = Math.max(1, Math.round(dmg * rnd(0.9, 1.1)));
    e.hp -= dmg; hurtFlash(e);
    e.x += kx; e.y += ky;
    float(e.x, e.y - 20, dmg, crit ? '#fee761' : (color || '#fff'), crit);
    burst(e.x, e.y, 'fx', 'hit', 1.5);
    AU.hit();
    if (e.hp <= 0) killFoe(e);
    else if (e.def.atk && !e.boss) { e.state = e.def.atk; e.t = 0; e.atkAnim = 0.35; } // snarl
  }
  function killFoe(e) {
    e.dead = true; e.deadT = 0;
    e.state = e.def.humanoid ? 'death' : (e.def.spr === 'ghost' ? 'vanish' : 'death');
    e.t = 0;
    G.kills++;
    AU.kill();
    puff(e.x, e.y, '#8b9bb4', 6, 50);
    // drops
    const gems = e.boss ? 10 : e.elite ? 4 : 1;
    for (let i = 0; i < gems; i++) dropPick(e.x + rnd(-14, 14), e.y + rnd(-10, 10), Math.random() < 0.25 ? 'gem' : 'coin');
    if (e.key === 'chicken' || Math.random() < 0.06) dropPick(e.x, e.y, 'meat');
    else if (Math.random() < 0.02) dropPick(e.x, e.y, 'heart');
    if (e.boss || (e.elite && Math.random() < 0.06)) G.chests.push({ x: e.x, y: e.y, open: false, t: 0 });
    if (e.boss) { G.shake = 10; burst(e.x, e.y, 'fx', 'levelup', 3); }
  }
  function playerAttack(target) {
    const p = G.player;
    p.atkLock = 0.32;
    p.state = p.atkName; p.t = 0; p.flip = target.x < p.x && Math.abs(target.x - p.x) > 10;
    if (!p.ranged) {
      AU.swing();
      const ang = Math.atan2(target.y - p.y, target.x - p.x);
      let hitAny = false;
      for (const e of G.enemies) {
        if (e.dead) continue;
        const d = Math.hypot(e.x - p.x, e.y - p.y);
        if (d > p.range + e.r) continue;
        let da = Math.atan2(e.y - p.y, e.x - p.x) - ang;
        while (da > Math.PI) da -= 2 * Math.PI; while (da < -Math.PI) da += 2 * Math.PI;
        if (Math.abs(da) < 1.0) {
          damageFoe(e, p.dmg, Math.cos(ang) * 8, Math.sin(ang) * 8);
          hitAny = true;
        }
      }
      burst(p.x + Math.cos(ang) * 34, p.y + Math.sin(ang) * 34 - 8, 'fx', 'slash', 2);
      if (!hitAny) puff(p.x + Math.cos(ang) * 30, p.y + Math.sin(ang) * 30, '#8b9bb4', 3, 30);
    } else {
      AU.shoot();
      const n = p.shots;
      for (let i = 0; i < n; i++) {
        const spread = (i - (n - 1) / 2) * 0.14;
        const ang = Math.atan2(target.y - p.y, target.x - p.x) + spread + rnd(-0.03, 0.03);
        G.projs.push({ x: p.x, y: p.y - 10, vx: Math.cos(ang) * p.projSpeed, vy: Math.sin(ang) * p.projSpeed,
          dmg: p.dmg, life: p.range / p.projSpeed, homing: p.homing, pierce: p.cls === 'ranger' ? 1 : 0,
          kind: p.cls, hitSet: p.cls === 'ranger' ? new Set() : null });
      }
    }
  }
  function hurtPlayer(dmg, sx, sy) {
    const p = G.player;
    if (p.deadT > 0 || G.screen !== 'play') return;
    dmg = Math.max(1, Math.round(dmg));
    p.hp -= dmg; hurtFlash(p);
    p.x += (p.x - sx) * 0.06; p.y += (p.y - sy) * 0.06;
    float(p.x, p.y - 26, '-' + dmg, '#f6757a', true);
    G.shake = Math.max(G.shake, 4);
    AU.hurt();
    updateHp();
    if (p.hp <= 0) { p.hp = 0; p.deadT = 0.0001; p.state = 'death'; p.t = 0; AU.over(); }
  }

  /* ================= pickups / chests ================= */
  function dropPick(x, y, kind) {
    G.picks.push({ x: clamp(x, 20, G.world.W - 20), y: clamp(y, 20, G.world.H - 20),
      vx: rnd(-40, 40), vy: rnd(-60, -10), kind, t: rnd(0, 9), mag: false });
  }
  function collect(pick) {
    const p = G.player;
    if (pick.kind === 'coin') { gainXp(1); AU.gem(); puff(pick.x, pick.y, '#fee761', 4, 40); }
    else if (pick.kind === 'gem') { gainXp(8); AU.gem(); puff(pick.x, pick.y, '#2ce8f5', 6, 50); }
    else if (pick.kind === 'meat') { p.hp = Math.min(p.maxhp, p.hp + 25); float(p.x, p.y - 26, '+25', '#63c74d'); AU.meat(); updateHp(); }
    else if (pick.kind === 'heart') { p.hp = Math.min(p.maxhp, p.hp + 45); float(p.x, p.y - 26, '+45', '#63c74d'); AU.meat(); updateHp(); }
  }
  function gainXp(n) {
    const p = G.player;
    p.xp += n;
    while (p.xp >= p.xpNext) {
      p.xp -= p.xpNext; p.level++;
      p.xpNext = Math.round(6 + p.level * 5 + Math.pow(p.level, 1.7) * 2);
      openLevelUp();
    }
    updateXp();
  }
  function openLevelUp() {
    G.screen = 'levelup';
    burst(G.player.x, G.player.y - 10, 'fx', 'levelup', 2.5);
    AU.levelup();
    const p = G.player;
    const avail = CARDS.filter(c =>
      (!c.ranged || p.ranged) && (!c.melee || !p.ranged) && (G.cardCounts[c.id] || 0) < (c.max || 99));
    const picks = [];
    while (picks.length < Math.min(3, avail.length)) {
      const c = avail[(Math.random() * avail.length) | 0];
      if (!picks.includes(c)) picks.push(c);
    }
    const box = $('cards'); box.innerHTML = '';
    picks.forEach(c => {
      const b = document.createElement('button');
      b.className = 'card';
      const [iid, ist] = c.icon;
      b.innerHTML = `<img alt=""><b></b><span></span>`;
      b.querySelector('img').src = S.dataURL(iid, ist, 0, 2);
      b.querySelector('b').textContent = c.name;
      b.querySelector('span').textContent = c.desc + ((c.max || 99) < 99 ? ` (${(G.cardCounts[c.id] || 0) + 1}/${c.max})` : '');
      b.addEventListener('click', () => {
        c.apply(p); G.cardCounts[c.id] = (G.cardCounts[c.id] || 0) + 1;
        AU.ui(); updateHp(); updateXp();
        showScreen('play');
      });
      box.appendChild(b);
    });
    $('lvl-num').textContent = 'Level ' + p.level;
    showScreen('levelup');
  }

  /* ================= update ================= */
  function view() {
    const cv = $('cv');
    return { w: cv.clientWidth / ZOOM, h: cv.clientHeight / ZOOM };
  }
  function night() {
    // 0 = noon, 1 = midnight; dayT advances full cycle every 150s
    return clamp(Math.sin((G.dayT % 1) * Math.PI * 2 - Math.PI / 2) * 0.5 + 0.5, 0, 1);
  }
  function update(dt) {
    const p = G.player, Wd = G.world;
    G.time += dt; G.dayT += dt / 150;
    // shrine cooldown + cheat-death? no. just cd tick
    G.shrineCd = Math.max(0, G.shrineCd - dt);
    director(dt);

    /* ---- player ---- */
    if (!p.deadT) {
      let mx = (G.keys.d || G.keys.arrowright ? 1 : 0) - (G.keys.a || G.keys.arrowleft ? 1 : 0) + G.joy.x;
      let my = (G.keys.s || G.keys.arrowdown ? 1 : 0) - (G.keys.w || G.keys.arrowup ? 1 : 0) + G.joy.y;
      const ml = Math.hypot(mx, my);
      if (ml > 1) { mx /= ml; my /= ml; }
      p.x = clamp(p.x + mx * p.speed * dt, 20, Wd.W - 20);
      p.y = clamp(p.y + my * p.speed * dt, 20, Wd.H - 20);
      collide(p, 11);
      p.face = (mx || my) ? faceOf(mx, my) : (p.lockFace || p.face);
      // regen + heal zones
      if (p.regen) p.hp = Math.min(p.maxhp, p.hp + p.regen * dt);
      for (const h of Wd.heals) {
        if (dist2(p, h) < h.r * h.r) {
          p.hp = Math.min(p.maxhp, p.hp + h.rate * dt);
          if (h.kind === 'shrine' && G.shrineCd <= 0) {
            G.shrineCd = 60; p.hp = p.maxhp;
            burst(h.x, h.y - 10, 'spells', 'holy_shield', 2.5);
            burst(h.x, h.y - 10, 'fx', 'heal', 2);
            float(p.x, p.y - 30, 'SHRINE BLESSING', '#2ce8f5', true);
            AU.shrine();
          }
          if (Math.random() < dt * 6) puff(p.x + rnd(-8, 8), p.y, h.kind === 'fire' ? '#feae34' : '#2ce8f5', 1, 20);
        }
      }
      // hazards
      for (const hz of Wd.hazards) {
        const nx = (p.x - hz.x) / hz.rx, ny = (p.y - hz.y) / hz.ry;
        if (nx * nx + ny * ny < 1) {
          p._hzT = (p._hzT || 0) + dt;
          if (p._hzT > 0.5) { p._hzT = 0; hurtPlayer(hz.dps / 2, p.x + rnd(-10, 10), p.y); }
        }
      }
      // attack
      p.atkT -= dt; p.atkLock -= dt;
      const target = nearestFoe(p.x, p.y, 520);
      if ((G.atkQueued || target) && p.atkT <= 0 && target) {
        G.atkQueued = false;
        p.atkT = p.cd; p.lockFace = faceOf(target.x - p.x, target.y - p.y);
        playerAttack(target);
      }
      // anim state
      if (p.atkLock > 0) { p.state = p.atkName; if (p.lockFace) p.flip = p.lockFace.flip; }
      else if (ml > 0.1) { p.state = 'walk_' + p.face.s; p.flip = p.face.flip; }
      else { p.state = 'idle_' + p.face.s; p.flip = p.face.flip; }
      updateHpThrottled();
    } else {
      p.deadT += dt;
      adv(p, dt);
      if (p.deadT > 1.6) return gameOver();
    }
    adv(p, dt);
    p.flash = Math.max(0, p.flash - dt);

    /* ---- enemies ---- */
    for (const e of G.enemies) {
      if (e.dead) {
        e.deadT += dt; adv(e, dt);
        if (e.deadT > 0.9) e.gone = true;
        continue;
      }
      e.hitCd -= dt; e.flash = Math.max(0, e.flash - dt);
      e.atkAnim -= dt;
      const dx = p.x - e.x, dy = p.y - e.y, d = Math.hypot(dx, dy) || 1;
      const nx = dx / d, ny = dy / d;
      if (e.key === 'chicken' && !p.deadT && d < 140) {
        // flee!
        e.x += -nx * e.spd * dt; e.y += -ny * e.spd * dt;
        e.face = faceOf(-nx, -ny);
      } else if (e.def.shooter && d < 260 && d > 120 && !e.boss) {
        // necromancer keeps range + casts
        e.x += -nx * e.spd * 0.5 * dt; e.y += -ny * e.spd * 0.5 * dt;
        e.face = faceOf(nx, ny);
        e.shootT -= dt;
        if (e.shootT <= 0 && !p.deadT) {
          e.shootT = 2.6; e.state = 'cast'; e.t = 0; e.atkAnim = 0.5;
          for (let k = -1; k <= 1; k++) {
            const a = Math.atan2(ny, nx) + k * 0.18;
            G.eprojs.push({ x: e.x, y: e.y - 10, vx: Math.cos(a) * 150, vy: Math.sin(a) * 150, dmg: 12 * (1 + G.time / 400), r: 5, color: '#b55088', life: 3 });
          }
          AU.cast();
        }
      } else if (e.boss) {
        bossAI(e, dt, nx, ny, d);
      } else {
        let sp = e.spd;
        if (e.def.charger) {
          e.chargeT -= dt;
          if (e.chargeT <= 0) { e.chargeT = 3; e.chargeOn = 1; }
          if (e.chargeOn > 0) { e.chargeOn -= dt; sp *= 1.9; e.state = 'charge'; }
        }
        if (e.def.wobble) e.wob += dt * 6;
        e.x += nx * sp * dt + (e.def.wobble ? Math.cos(e.wob) * 20 * dt : 0);
        e.y += ny * sp * dt;
        e.face = faceOf(nx, ny);
      }
      collide(e, e.r * 0.7);
      // contact damage
      if (!p.deadT && e.hitCd <= 0 && e.def.dmg > 0 && dist2(e, p) < (e.r + 12) * (e.r + 12)) {
        e.hitCd = 0.9;
        hurtPlayer(e.dmg, e.x, e.y);
        if (e.def.atk) { e.state = e.def.atk; e.t = 0; e.atkAnim = 0.4; }
      }
      // anim state resolve
      if (e.atkAnim <= 0 && !e.dead) {
        if (e.def.humanoid) e.state = 'walk_' + e.face.s;
        else if (e.key === 'boar' && !(e.chargeOn > 0)) e.state = 'trot';
        else if (e.key !== 'boar') e.state = e.def.mv || 'idle';
        e.flip = e.face.flip;
      }
      adv(e, dt);
    }
    // separation (cheap O(n^2), capped population)
    const list = G.enemies;
    for (let i = 0; i < list.length; i++) {
      const a = list[i];
      if (a.dead || a.def.drift) continue;
      for (let j = i + 1; j < list.length; j++) {
        const b = list[j];
        if (b.dead || b.def.drift) continue;
        const dx = b.x - a.x, dy = b.y - a.y, rr = a.r + b.r;
        const d2 = dx * dx + dy * dy;
        if (d2 > 0.01 && d2 < rr * rr) {
          const d = Math.sqrt(d2), push = (rr - d) * 0.4;
          const ux = dx / d, uy = dy / d;
          a.x -= ux * push; a.y -= uy * push; b.x += ux * push; b.y += uy * push;
        }
      }
    }
    for (let i = G.enemies.length - 1; i >= 0; i--) if (G.enemies[i].gone) G.enemies.splice(i, 1);

    /* ---- projectiles ---- */
    for (let i = G.projs.length - 1; i >= 0; i--) {
      const pr = G.projs[i];
      if (pr.homing) {
        const t = nearestFoe(pr.x, pr.y, 300);
        if (t) {
          const a = Math.atan2(t.y - pr.y, t.x - pr.x), cur = Math.atan2(pr.vy, pr.vx);
          let da = a - cur;
          while (da > Math.PI) da -= 2 * Math.PI; while (da < -Math.PI) da += 2 * Math.PI;
          const na = cur + clamp(da, -4 * dt, 4 * dt), sp = Math.hypot(pr.vx, pr.vy);
          pr.vx = Math.cos(na) * sp; pr.vy = Math.sin(na) * sp;
        }
      }
      pr.x += pr.vx * dt; pr.y += pr.vy * dt; pr.life -= dt;
      let dead = pr.life <= 0;
      if (!dead) for (const e of G.enemies) {
        if (e.dead) continue;
        if (pr.hitSet && pr.hitSet.has(e)) continue;
        if (dist2(pr, e) < (e.r + 5) * (e.r + 5)) {
          const a = Math.atan2(pr.vy, pr.vx);
          damageFoe(e, pr.dmg, Math.cos(a) * 6, Math.sin(a) * 6);
          if (pr.hitSet) pr.hitSet.add(e);
          if (!pr.hitSet && (pr.pierce--, pr.pierce < 0)) { dead = true; break; }
        }
      }
      if (dead) { puff(pr.x, pr.y, pr.kind === 'cleric' ? '#fee761' : '#c0cbdc', 3, 30); G.projs.splice(i, 1); }
    }
    for (let i = G.eprojs.length - 1; i >= 0; i--) {
      const pr = G.eprojs[i];
      pr.x += pr.vx * dt; pr.y += pr.vy * dt; pr.life -= dt;
      if (pr.life <= 0) { G.eprojs.splice(i, 1); continue; }
      if (!p.deadT && dist2(pr, p) < 14 * 14) { hurtPlayer(pr.dmg, pr.x - pr.vx, pr.y - pr.vy); G.eprojs.splice(i, 1); }
    }

    /* ---- pickups / chests ---- */
    for (let i = G.picks.length - 1; i >= 0; i--) {
      const k = G.picks[i];
      k.t += dt;
      k.x += k.vx * dt; k.y += k.vy * dt; k.vx *= 0.9; k.vy *= 0.9;
      const d2 = dist2(k, p);
      if (!p.deadT && d2 < p.magnet * p.magnet) {
        const d = Math.sqrt(d2) || 1;
        k.x += (p.x - k.x) / d * 260 * dt; k.y += (p.y - k.y) / d * 260 * dt;
      }
      if (!p.deadT && d2 < 16 * 16) { collect(k); G.picks.splice(i, 1); }
    }
    for (let i = G.chests.length - 1; i >= 0; i--) {
      const c = G.chests[i];
      c.t += dt;
      if (!c.open && !p.deadT && dist2(c, p) < 30 * 30) {
        c.open = true; c.t = 0; AU.chest(); G.shake = 5;
        burst(c.x, c.y - 10, 'fx', 'levelup', 2);
        for (let k = 0; k < 8; k++) dropPick(c.x + rnd(-20, 20), c.y + rnd(-14, 14), k < 2 ? 'gem' : 'coin');
        dropPick(c.x, c.y, Math.random() < 0.5 ? 'meat' : 'heart');
        float(c.x, c.y - 30, 'TREASURE!', '#fee761', true);
      }
      if (c.open && c.t > 30) G.chests.splice(i, 1);
    }

    /* ---- fx / particles / floats ---- */
    for (let i = G.fx.length - 1; i >= 0; i--) { const f = G.fx[i]; f.t += dt * f.fps; if (f.t >= f.frames.length) G.fx.splice(i, 1); }
    for (let i = G.parts.length - 1; i >= 0; i--) {
      const q = G.parts[i]; q.t += dt;
      if (q.t > q.life) { G.parts.splice(i, 1); continue; }
      q.x += q.vx * dt; q.y += q.vy * dt; q.vy += 60 * dt;
    }
    for (let i = G.floats.length - 1; i >= 0; i--) { const f = G.floats[i]; f.t += dt; f.y -= 30 * dt; if (f.t > 0.9) G.floats.splice(i, 1); }

    /* ---- camera ---- */
    const vw = view().w, vh = view().h;
    G.cam.x = clamp(p.x - vw / 2 + rnd(-1, 1) * G.shake, 0, Wd.W - vw);
    G.cam.y = clamp(p.y - vh / 2 + rnd(-1, 1) * G.shake, 0, Wd.H - vh);
    G.shake = Math.max(0, G.shake - dt * 30);

    updateHud();
  }

  /* Boss brains: telegraphed slams, volleys, swoops. */
  function bossAI(e, dt, nx, ny, d) {
    const p = G.player;
    if (e.key === 'slimeking') {
      e.slamT -= dt;
      // hop toward player in leaps (slam anim plays out untouched)
      const hopping = (G.time * 2 + e.wob) % 1.6 < 0.9;
      if (e.atkAnim <= 0) e.state = 'hop';
      if (hopping) { e.x += nx * e.spd * 1.6 * dt; e.y += ny * e.spd * 1.6 * dt; }
      if (e.slamT <= 0 && d < 200) {
        e.slamT = 4; e.state = 'slam'; e.t = 0; e.atkAnim = 0.8; G.shake = 9;
        setTimeout(() => {
          if (dist2(e, p) < 85 * 85) hurtPlayer(e.dmg * 1.4, e.x, e.y);
          burst(e.x, e.y, 'fx', 'dust', 3); AU.hit();
        }, 450);
      }
      e.face = faceOf(nx, ny); e.flip = false;
    } else if (e.key === 'demon') {
      e.x += nx * e.spd * dt; e.y += ny * e.spd * dt;
      e.face = faceOf(nx, ny); e.flip = e.face.flip;
      e.slamT -= dt;
      if (e.slamT <= 0 && d < 170) {
        e.slamT = 3; e.state = 'attack_side'; e.t = 0; e.atkAnim = 0.6;
        setTimeout(() => {
          if (dist2(e, p) < 95 * 95) hurtPlayer(e.dmg * 1.3, e.x, e.y);
          burst(e.x, e.y, 'fx', 'slash', 3); AU.swing();
        }, 350);
      }
      if (e.atkAnim <= 0) e.state = 'walk_' + e.face.s;
    } else if (e.key === 'dragon') {
      e.wob += dt;
      e.x += nx * e.spd * dt; e.y += (ny * 0.7 + Math.cos(e.wob * 3) * 0.5) * e.spd * dt;
      e.face = { s: 'side', flip: nx < 0 };
      e.shootT -= dt;
      if (e.shootT <= 0 && d < 520) {
        e.shootT = 2.2; e.state = 'fireball'; e.t = 0; e.atkAnim = 0.7; AU.cast();
        const base = Math.atan2(ny, nx);
        [-0.25, 0, 0.25].forEach(off => {
          G.eprojs.push({ x: e.x, y: e.y - 8, vx: Math.cos(base + off) * 190, vy: Math.sin(base + off) * 190, dmg: e.dmg * 0.7, r: 7, color: '#f77622', life: 3.5, fire: true });
        });
      }
      if (e.atkAnim <= 0) e.state = 'fly';
      e.flip = e.face.flip;
    } else if (e.key === 'ent') {
      e.x += nx * e.spd * dt; e.y += ny * e.spd * dt;
      e.face = faceOf(nx, ny);
      e.slamT -= dt;
      if (e.slamT <= 0 && d < 220) {
        e.slamT = 3.5; e.state = 'slam'; e.t = 0; e.atkAnim = 0.9; G.shake = 10;
        setTimeout(() => {
          if (dist2(e, p) < 100 * 100) hurtPlayer(e.dmg * 1.4, e.x, e.y);
          burst(e.x, e.y + 10, 'fx', 'dust', 3.5); AU.hit();
        }, 500);
      }
      if (e.atkAnim <= 0) e.state = 'stomp';
      e.flip = e.face.flip;
    } else if (e.key === 'spiderqueen') {
      // skitters in, pounces at close range, falls back on a web volley
      e.x += nx * e.spd * dt; e.y += ny * e.spd * dt;
      e.face = faceOf(nx, ny); e.flip = e.face.flip;
      e.slamT -= dt; e.shootT -= dt;
      if (e.slamT <= 0 && d < 150) {
        e.slamT = 4; e.state = 'lunge'; e.t = 0; e.atkAnim = 0.7;
        setTimeout(() => {
          if (dist2(e, p) < 80 * 80) hurtPlayer(e.dmg * 1.3, e.x, e.y);
          burst(e.x, e.y, 'fx', 'dust', 3); AU.swing();
        }, 380);
      } else if (e.shootT <= 0 && d > 130 && d < 430) {
        e.shootT = 3; e.state = 'spit'; e.t = 0; e.atkAnim = 0.6; AU.cast();
        const base = Math.atan2(ny, nx);
        [-0.22, 0.22].forEach(off => {
          G.eprojs.push({ x: e.x, y: e.y - 6, vx: Math.cos(base + off) * 170, vy: Math.sin(base + off) * 170, dmg: e.dmg * 0.6, r: 5, color: '#e8ecf5', life: 2.6 });
        });
      }
      if (e.atkAnim <= 0) e.state = 'crawl';
    }
  }

  function collide(e, r) {
    for (const b of G.world.blockers) {
      const dx = e.x - b.x, dy = e.y - b.y, rr = r + b.r;
      const d2 = dx * dx + dy * dy;
      if (d2 > 0.01 && d2 < rr * rr) {
        const d = Math.sqrt(d2);
        e.x = b.x + dx / d * rr; e.y = b.y + dy / d * rr;
      }
    }
  }

  /* ================= render ================= */
  let cv, ctx, DPR = 1;
  function fitCanvas() {
    DPR = Math.min(2, window.devicePixelRatio || 1);
    cv.width = Math.round(cv.clientWidth * DPR);
    cv.height = Math.round(cv.clientHeight * DPR);
  }
  /* Runtime drop shadow. Library sprites deliberately ship with NO baked
     shadow — the engine places one per entity so it can be scaled, tinted and
     faded independently of the art. Called with the entity's ground point. */
  function drawShadow(x, y, rx, alpha = 0.3) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#0b0a12';
    ctx.beginPath();
    ctx.ellipse(x, y, rx, rx * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawSprite(id, state, frame, x, y, scale = 2, flip = false, flash = false) {
    const f = S.frame(id, state, frame);
    if (!f) return;
    const w = f.w * scale, h = f.h * scale;
    ctx.save();
    ctx.translate(Math.round(x), Math.round(y));
    if (flip) ctx.scale(-1, 1);
    ctx.drawImage(flash > 0 ? S.white(f.cv) : f.cv, -w / 2, -h, w, h);
    ctx.restore();
  }
  function render() {
    const Wd = G.world, p = G.player;
    const vw = cv.width / DPR, vh = cv.height / DPR;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.imageSmoothingEnabled = false;
    // ground
    ctx.fillStyle = ctx.createPattern(Wd.grass, 'repeat');
    ctx.save();
    ctx.translate(-(G.cam.x * ZOOM % 256), -(G.cam.y * ZOOM % 256));
    ctx.scale(ZOOM, ZOOM);
    ctx.fillRect(0, 0, vw / ZOOM + 256, vh / ZOOM + 256);
    ctx.restore();
    ctx.setTransform(DPR * ZOOM, 0, 0, DPR * ZOOM, -G.cam.x * DPR * ZOOM, -G.cam.y * DPR * ZOOM);

    const t = G.time;
    const vis = { x0: G.cam.x - 60, y0: G.cam.y - 60, x1: G.cam.x + vw / ZOOM + 60, y1: G.cam.y + vh / ZOOM + 60 };
    const inVis = (x, y, m = 0) => x > vis.x0 - m && x < vis.x1 + m && y > vis.y0 - m && y < vis.y1 + m;

    // plaza (static pre-render)
    ctx.drawImage(Wd.plaza, Wd.plazaX, Wd.plazaY);
    // pond water (animated tiles)
    tileRegion(Wd.pond.x - Wd.pond.rx, Wd.pond.y - Wd.pond.ry, Wd.pond.rx * 2, Wd.pond.ry * 2, 'water', 'flow', 32, t, inVis);
    // lava (animated)
    tileRegion(Wd.lava.x - Wd.lava.rx, Wd.lava.y - Wd.lava.ry, Wd.lava.rx * 2, Wd.lava.ry * 2, 'rpg_lava', 'bubble', 32, t, inVis);
    // spikes (static slice)
    tileStatic(Wd.spike.x - Wd.spike.rx, Wd.spike.y - Wd.spike.ry, Wd.spike.rx * 2, Wd.spike.ry * 2, Wd.tiles[10]);

    // y-sorted: decor + anims + chests + pickups + enemies + player + fx-under? (fx above all later)
    const draws = [];
    for (const d of Wd.decor) if (inVis(d.x, d.y, 60)) draws.push({ y: d.y, f: () => {
      const fr = d.frames[Math.floor(t * d.fps) % d.count];
      const w = d.w * d.scale, h = d.h * d.scale;
      ctx.drawImage(fr, d.x - w / 2, d.y - h, w, h);
    } });
    for (const a of Wd.anims) {
      if (!inVis(a.x, a.y, 60)) continue;
      const fr = a.frames[Math.floor(t * a.fps) % a.count];
      const w = a.w * a.scale, h = a.h * a.scale;
      draws.push({ y: a.y, f: () => ctx.drawImage(fr, a.x - w / 2, a.y - h, w, h), glow: a.glow, gx: a.x, gy: a.y - h / 2 });
    }
    for (const c of G.chests) {
      const fr = S.frame('chest', c.open ? 'open' : 'closed', c.open ? Math.min(3, Math.floor(c.t * 10)) : 0);
      if (!fr) continue;
      const w = 64, h = 64;
      draws.push({ y: c.y, f: () => ctx.drawImage(fr.cv, c.x - w / 2, c.y - h, w, h) });
    }
    for (const k of G.picks) {
      const id = k.kind === 'coin' ? 'coin_gem' : k.kind === 'gem' ? 'coin_gem' : 'consumables';
      const st = k.kind === 'coin' ? 'spin' : k.kind === 'gem' ? 'gem' : k.kind;
      const fr = S.frame(id, st, Math.floor(k.t * 8));
      if (!fr) continue;
      const bob = Math.sin(k.t * 5) * 2;
      draws.push({ y: k.y + 6, f: () => {
        const w = fr.w * 1.5, h = fr.h * 1.5;
        ctx.drawImage(fr.cv, k.x - w / 2, k.y - h + bob, w, h);
      } });
    }
    for (const e of G.enemies) {
      const sc = 2 * (e.def.scale || 1) * (e.elite ? 1.22 : 1);
      const a = 1; // fade handled by death anim frames
      draws.push({ y: e.y, f: () => {
        if (e.elite && !e.dead) { ctx.globalAlpha = 0.35; ctx.fillStyle = '#ff0044';
          ctx.beginPath(); ctx.arc(e.x, e.y - 14 * sc / 2, e.r + 4, 0, 7); ctx.fill(); ctx.globalAlpha = a; }
        drawSprite(e.spr, e.state, e.frame, e.x, e.y, sc, e.flip, e.flash);
        if (e.boss || e.elite) {
          const w = e.r * 2.4;
          ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(e.x - w / 2, e.y - (32 * sc + 12), w, 5);
          ctx.fillStyle = e.boss ? '#ff0044' : '#fee761';
          ctx.fillRect(e.x - w / 2, e.y - (32 * sc + 12), w * clamp(e.hp / e.maxhp, 0, 1), 5);
        }
      } });
    }
    if (p) draws.push({ y: p.y, f: () => drawSprite(p.spr, p.state, p.frame, p.x, p.y, 2, p.flip, p.flash) });
    // ground-contact pass: every entity's shadow goes down before any sprite,
    // so a nearer sprite can never paint over a further one's shadow
    for (const e of G.enemies) if (!e.dead) drawShadow(e.x, e.y + 1, e.r * 0.95 * (e.def.scale || 1) * 0.7);
    if (p && !p.deadT) drawShadow(p.x, p.y + 1, 8);

    draws.sort((a, b) => a.y - b.y);
    draws.forEach(d => d.f());

    // projectiles
    for (const pr of G.projs) {
      const a = Math.atan2(pr.vy, pr.vx);
      ctx.save(); ctx.translate(pr.x, pr.y); ctx.rotate(a);
      if (pr.kind === 'cleric') { ctx.fillStyle = '#fee761'; ctx.fillRect(-8, -2, 12, 4); ctx.fillStyle = '#fff'; ctx.fillRect(-4, -1, 6, 2); }
      else if (pr.kind === 'ranger') { ctx.strokeStyle = '#e4a672'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-9, 0); ctx.lineTo(7, 0); ctx.stroke(); ctx.fillStyle = '#c0cbdc'; ctx.fillRect(7, -2, 4, 4); ctx.fillStyle = '#e43b44'; ctx.fillRect(-11, -2, 3, 4); }
      else { ctx.fillStyle = '#c0cbdc'; ctx.fillRect(-7, -2, 11, 4); ctx.fillStyle = '#fff'; ctx.fillRect(-2, -1, 5, 2); }
      ctx.restore();
    }
    for (const pr of G.eprojs) {
      ctx.fillStyle = pr.color;
      ctx.beginPath(); ctx.arc(pr.x, pr.y, pr.fire ? 5 : pr.r, 0, 7); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(pr.x - 1, pr.y - 1, (pr.fire ? 5 : pr.r) / 2.5, 0, 7); ctx.fill();
    }
    // fx anims
    for (const f of G.fx) {
      const fr = f.frames[Math.min(f.frames.length - 1, Math.floor(f.t))];
      const w = fr.width * f.scale, h = fr.height * f.scale;
      ctx.globalAlpha = clamp(1.4 - f.t / f.frames.length, 0, 1);
      ctx.drawImage(fr, f.x - w / 2, f.y - h / 2, w, h);
      ctx.globalAlpha = 1;
    }
    // particles
    for (const q of G.parts) {
      ctx.globalAlpha = clamp(1 - q.t / q.life, 0, 1);
      ctx.fillStyle = q.color;
      ctx.fillRect(q.x - q.size / 2, q.y - q.size / 2, q.size, q.size);
    }
    ctx.globalAlpha = 1;
    // floats
    ctx.textAlign = 'center';
    for (const f of G.floats) {
      ctx.globalAlpha = clamp(1.2 - f.t, 0, 1);
      ctx.font = (f.big ? 'bold 13px' : 'bold 10px') + ' Poppins, sans-serif';
      ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(10,5,20,.8)';
      ctx.strokeText(f.txt, f.x, f.y);
      ctx.fillStyle = f.color; ctx.fillText(f.txt, f.x, f.y);
    }
    ctx.globalAlpha = 1;

    /* ---- night + lights ---- */
    const n = night();
    if (n > 0.05) {
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      ctx.fillStyle = `rgba(8,8,40,${(n * 0.42).toFixed(3)})`;
      ctx.fillRect(0, 0, vw, vh);
      // cut light holes
      ctx.globalCompositeOperation = 'destination-out';
      const lights = [{ x: p.x, y: p.y - 16, r: 130 }];
      for (const a of Wd.anims) {
        if (!a.glow || lights.length > 14) continue;
        if (!inVis(a.x, a.y, 200)) continue;
        lights.push({ x: a.x, y: a.y - 20, r: a.glow === 'warm' ? 110 : 90 });
      }
      for (const L of lights) {
        const sx = (L.x - G.cam.x) * ZOOM, sy = (L.y - G.cam.y) * ZOOM, r = L.r * ZOOM / 2;
        const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, r);
        g.addColorStop(0, 'rgba(0,0,0,.9)'); g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(sx, sy, r, 0, 7); ctx.fill();
      }
      ctx.globalCompositeOperation = 'source-over';
    }
  }
  function tileRegion(x, y, w, h, id, state, tile, t, inVis) {
    const st = S.frames(id, state);
    if (!st) return;
    const fr = st.frames[Math.floor(t * st.fps) % st.frames.length];
    const x0 = Math.max(x, G.cam.x - 40), y0 = Math.max(y, G.cam.y - 40);
    const x1 = Math.min(x + w, G.cam.x + view().w + 40), y1 = Math.min(y + h, G.cam.y + view().h + 40);
    for (let ty = Math.floor((y0 - y) / tile); ty * tile < y1 - y; ty++)
      for (let tx = Math.floor((x0 - x) / tile); tx * tile < x1 - x; tx++)
        ctx.drawImage(fr, x + tx * tile, y + ty * tile, tile, tile);
  }
  function tileStatic(x, y, w, h, tileCv) {
    const T = tileCv.width;
    for (let ty = 0; ty * T < h; ty++) for (let tx = 0; tx * T < w; tx++)
      ctx.drawImage(tileCv, x + tx * T, y + ty * T, T, T);
  }

  /* ================= HUD / screens ================= */
  let hpT = 0;
  function updateHp() {
    const p = G.player;
    $('hp-fill').style.width = clamp(p.hp / p.maxhp * 100, 0, 100) + '%';
    $('hp-txt').textContent = Math.ceil(p.hp) + ' / ' + p.maxhp;
    $('lvl-txt').textContent = 'Lv ' + p.level;
  }
  function updateHpThrottled() {
    const now = performance.now();
    if (now - hpT > 200) { hpT = now; updateHp(); }
  }
  function updateXp() {
    const p = G.player;
    $('xp-fill').style.width = clamp(p.xp / p.xpNext * 100, 0, 100) + '%';
  }
  let lastSec = -1, lastKills = -1;
  function updateHud() {
    const sec = Math.floor(G.time);
    if (sec !== lastSec) {
      lastSec = sec;
      $('time-txt').textContent = String(Math.floor(sec / 60)).padStart(2, '0') + ':' + String(sec % 60).padStart(2, '0');
    }
    if (G.kills !== lastKills) { lastKills = G.kills; $('kill-txt').textContent = G.kills; }
    if (G.boss && !G.boss.dead) {
      $('boss-name').textContent = bossName(G.boss.key);
      $('boss-fill').style.width = clamp(G.boss.hp / G.boss.maxhp * 100, 0, 100) + '%';
    }
  }
  let bannerT = 0;
  function banner(main, sub) {
    $('banner-main').textContent = main;
    $('banner-sub').textContent = sub || '';
    $('banner').classList.remove('hidden');
    $('banner').classList.remove('show');
    void $('banner').offsetWidth;
    $('banner').classList.add('show');
    clearTimeout(bannerT);
    bannerT = setTimeout(() => $('banner').classList.add('hidden'), 2600);
  }
  function showScreen(name) {
    G.screen = name === 'play' ? (G.player && G.player.deadT ? 'over' : 'play') : name;
    if (name === 'play' && G.player && G.player.deadT) return gameOver();
    ['title', 'hud', 'levelup', 'pause', 'over'].forEach(s => {
      const el = s === 'hud' ? $('hud') : $( 'screen-' + s);
      if (el) el.classList.toggle('hidden', s === 'hud' ? !(name === 'play' || name === 'levelup' || name === 'pause') : s !== name);
    });
  }
  function gameOver() {
    if (G.screen === 'over') return;
    const p = G.player;
    const score = G.kills * 10 + Math.floor(G.time) * 5 + p.level * 100;
    let best = 0;
    try {
      best = +(localStorage.getItem('runefall_best') || 0);
      if (score > best) { best = score; localStorage.setItem('runefall_best', best); }
    } catch {}
    $('over-stats').innerHTML =
      `<div><span>SURVIVED</span><b>${fmtTime(G.time)}</b></div>` +
      `<div><span>KILLS</span><b>${G.kills}</b></div>` +
      `<div><span>LEVEL</span><b>${p.level} ${p.name || CLASSES[p.cls].name}</b></div>` +
      `<div><span>SCORE</span><b>${score}</b></div>` +
      `<div><span>BEST</span><b>${best}</b></div>`;
    showScreen('over');
  }
  function fmtTime(t) {
    return String(Math.floor(t / 60)).padStart(2, '0') + ':' + String(Math.floor(t % 60)).padStart(2, '0');
  }

  /* ================= main loop ================= */
  let last = 0;
  function loop(ts) {
    requestAnimationFrame(loop);
    const dt = Math.min(0.05, (ts - last) / 1000 || 0.016);
    last = ts;
    if (G.screen === 'play') update(dt);
    if (G.screen === 'play' || G.screen === 'levelup' || G.screen === 'pause' || G.screen === 'over') render();
  }

  /* ================= input ================= */
  function bindInput() {
    const key = e => e.key.toLowerCase();
    window.addEventListener('keydown', e => {
      const k = key(e);
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k === ' ' ? ' ' : k)) e.preventDefault();
      G.keys[k] = true;
      if (k === ' ' ) G.atkQueued = true;
      if ((k === 'p' || k === 'escape')) {
        if (G.screen === 'play') { showScreen('pause'); AU.ui(); }
        else if (G.screen === 'pause') { showScreen('play'); AU.ui(); }
      }
      if (k === 'm') setMuteBtn(AU.toggleMute());
    });
    window.addEventListener('keyup', e => { G.keys[key(e)] = false; });
    // click / tap = attack toward point
    cv.addEventListener('pointerdown', e => {
      AU.unlock();
      if (G.screen !== 'play') return;
      G.atkQueued = true;
    });
    // joystick
    const stick = $('stick'), nub = $('nub');
    let joyId = null;
    const setNub = (dx, dy) => { nub.style.transform = `translate(${dx}px,${dy}px)`; };
    stick.addEventListener('pointerdown', e => {
      joyId = e.pointerId; stick.setPointerCapture(joyId); G.joy.on = true; AU.unlock();
    });
    stick.addEventListener('pointermove', e => {
      if (e.pointerId !== joyId) return;
      const r = stick.getBoundingClientRect();
      let dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
      const m = Math.hypot(dx, dy), max = r.width / 2 - 10;
      if (m > max) { dx = dx / m * max; dy = dy / m * max; }
      setNub(dx, dy);
      G.joy.x = dx / max; G.joy.y = dy / max;
    });
    const joyEnd = e => {
      if (e.pointerId !== joyId) return;
      joyId = null; G.joy.x = G.joy.y = 0; G.joy.on = false; setNub(0, 0);
    };
    stick.addEventListener('pointerup', joyEnd);
    stick.addEventListener('pointercancel', joyEnd);
    $('btn-atk').addEventListener('pointerdown', e => { e.preventDefault(); G.atkQueued = true; AU.unlock(); });
    $('btn-pause').addEventListener('click', () => { if (G.screen === 'play') showScreen('pause'); AU.ui(); });
    $('btn-mute').addEventListener('click', () => setMuteBtn(AU.toggleMute()));
    $('btn-resume').addEventListener('click', () => { showScreen('play'); AU.ui(); });
    $('btn-restart').addEventListener('click', () => { startRun(G.player.cls); AU.ui(); });
    $('btn-quit').addEventListener('click', () => { showScreen('title'); buildTitle(); AU.ui(); });
    $('btn-again').addEventListener('click', () => { startRun(G.player.cls); AU.ui(); });
    $('btn-title2').addEventListener('click', () => { showScreen('title'); buildTitle(); AU.ui(); });
    $('btn-mute2').addEventListener('click', () => setMuteBtn(AU.toggleMute()));
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && G.screen === 'play') showScreen('pause');
    });
    window.addEventListener('resize', fitCanvas);
  }
  function setMuteBtn(m) {
    $('btn-mute').textContent = m ? 'volume_off' : 'volume_up';
    const b2 = $('btn-mute2'); if (b2) b2.textContent = m ? 'volume_off' : 'volume_up';
  }

  /* ================= title ================= */
  let titleRaf = 0, titleT = 0;
  function buildTitle() {
    const box = $('classes'); box.innerHTML = '';
    Object.entries(CLASSES).forEach(([id, c]) => {
      const b = document.createElement('button');
      b.className = 'class-card';
      b.innerHTML = `<canvas width="64" height="64"></canvas><b></b><i></i><span></span><em></em>`;
      b.querySelector('b').textContent = c.name;
      b.querySelector('i').textContent = `HP ${c.hp} · ${c.ranged ? 'Ranged' : 'Melee'}`;
      b.querySelector('span').textContent = c.desc;
      b.querySelector('em').textContent = id === 'knight' ? 'Balanced blade' : id === 'ranger' ? 'Fast & frail' : id === 'cleric' ? 'Seeking bolts + regen' : 'Speed + crits';
      b.addEventListener('click', () => { AU.ui(); startRun(id); });
      b.dataset.cv = '1';
      box.appendChild(b);
    });
    let best = 0;
    try { best = +(localStorage.getItem('runefall_best') || 0); } catch {}
    $('best-txt').textContent = best > 0 ? 'BEST SCORE ' + best : 'No legends yet. Survive.';
    cancelAnimationFrame(titleRaf);
    const tick = () => {
      titleRaf = requestAnimationFrame(tick);
      if (G.screen !== 'title') return;
      titleT += 1 / 60;
      [...box.children].forEach((card, ci) => {
        const id = Object.keys(CLASSES)[ci];
        const fr = S.frame(CLASSES[id].spr, 'walk_side', Math.floor(titleT * 8));
        if (!fr) return;
        const c = card.querySelector('canvas'), x = c.getContext('2d');
        x.imageSmoothingEnabled = false;
        x.clearRect(0, 0, 64, 64);
        x.drawImage(fr.cv, 0, 0, 64, 64);
      });
    };
    tick();
    setMuteBtn(AU.muted);
  }

  /* ================= boot ================= */
  function boot() {
    cv = $('cv'); ctx = cv.getContext('2d');
    fitCanvas();
    bindInput();
    buildTitle();
    showScreen('title');
    // pre-bake everything up front (fast: painters are tiny)
    ['rpg_knight', 'rpg_ranger', 'rpg_cleric', 'rpg_rogue', 'slime', 'bat', 'rpg_goblin',
      'rpg_spider', 'wolf', 'skeleton', 'orc', 'rpg_necromancer', 'ghost', 'boar', 'mushroom',
      'chicken', 'rpg_demon', 'rpg_slime_king', 'rpg_dragon', 'rpg_ent', 'coin_gem', 'consumables',
      'chest', 'campfire', 'torch', 'flora', 'rpg_dungeon_tiles', 'water', 'rpg_lava', 'rpg_waterfall',
      'rpg_village', 'rpg_dungeon_props', 'rpg_savepoint', 'spells', 'fx', 'weapons', 'rpg_arsenal',
      'rpg_armor', 'rpg_loot', 'rpg_status', 'rpg_ui'].forEach(id => S.bake(id));
    requestAnimationFrame(loop);
  }

  return { boot, startRun, G };
})();
document.addEventListener('DOMContentLoaded', () => RF.Game.boot());
