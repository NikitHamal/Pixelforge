(() => {
  'use strict';
  const $ = s => document.querySelector(s);
  const cv = $('#world'), ctx = cv.getContext('2d');
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  let rngState = 0x41c6ce57;
  const rng = () => ((rngState = Math.imul(rngState, 1664525) + 1013904223 >>> 0) / 4294967296);
  const WORLD = 1800, TILE = 24;
  let dpr = 1, vw = 0, vh = 0, running = false, last = 0, elapsed = 0, day = 1, minute = 360, speed = 1;
  let placing = null, hover = null, selected = null, messageT = 0, raidWarned = false, gameEnded = false;
  const cam = { x: 900, y: 930, zoom: 1.45 };
  const resources = { food: 128, wood: 98, stone: 112, iron: 18, gold: 42, people: 12, cap: 18, morale: 78 };
  const keys = new Set(), pointer = { x: 0, y: 0, wx: 0, wy: 0, down: false, moved: false, sx: 0, sy: 0, cx: 0, cy: 0 };

  const TYPES = {
    keep: { name: 'Town Hall', icon: '♜', w: 80, h: 64, hp: 600, cost: {}, desc: 'The heart of the settlement. If it falls, all is lost.' },
    house: { name: 'Cottage', icon: '⌂', w: 42, h: 38, hp: 110, cost: { wood: 35, stone: 12 }, desc: 'Warm beds for four more settlers.', cap: 4 },
    farm: { name: 'Crop Field', icon: '♨', w: 64, h: 52, hp: 65, cost: { wood: 18 }, desc: 'Produces food while tended by a worker.', yield: 'food' },
    lumber: { name: 'Woodcutter', icon: '♣', w: 46, h: 40, hp: 90, cost: { wood: 30, stone: 8 }, desc: 'Harvests timber from nearby woodland.', yield: 'wood' },
    quarry: { name: 'Stone Quarry', icon: '◆', w: 50, h: 43, hp: 100, cost: { wood: 25 }, desc: 'Cuts stone from exposed rock.', yield: 'stone' },
    tower: { name: 'Scout Tower', icon: '♟', w: 34, h: 48, hp: 130, cost: { wood: 30, stone: 24 }, desc: 'Reveals land and fires at nearby raiders.', range: 190 },
    wall: { name: 'Wooden Wall', icon: '▥', w: 48, h: 18, hp: 170, cost: { wood: 16 }, desc: 'Blocks attackers and channels them toward the gate.' },
    gate: { name: 'Fortified Gate', icon: 'Π', w: 52, h: 22, hp: 240, cost: { wood: 25, stone: 15 }, desc: 'A strong passage through your defensive line.' },
    barracks: { name: 'Guard Post', icon: '⚔', w: 52, h: 44, hp: 150, cost: { wood: 45, stone: 25, iron: 6 }, desc: 'Trains a defender to patrol the settlement.' },
    well: { name: 'Village Well', icon: '◉', w: 30, h: 30, hp: 85, cost: { stone: 25 }, desc: 'Improves morale for nearby homes.' },
    torch: { name: 'Watch Fire', icon: '♠', w: 18, h: 22, hp: 35, cost: { wood: 8 }, desc: 'Lights the dark and reveals approaching raiders.' }
  };
  const buildings = [], units = [], enemies = [], arrows = [], particles = [];
  const trees = [], rocks = [], flowers = [];

  function resize() {
    dpr = Math.min(2, devicePixelRatio || 1); vw = innerWidth; vh = innerHeight;
    cv.width = Math.round(vw * dpr); cv.height = Math.round(vh * dpr); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.imageSmoothingEnabled = false;
    if (!running || !speed) render();
  }
  function hash(x, y) { let n = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263); n = (n ^ n >>> 13) * 1274126177; return ((n ^ n >>> 16) >>> 0) / 4294967295; }
  function sx(x) { return (x - cam.x) * cam.zoom + vw / 2; }
  function sy(y) { return (y - cam.y) * cam.zoom + vh / 2; }
  function worldPos(x, y) { return { x: (x - vw / 2) / cam.zoom + cam.x, y: (y - vh / 2) / cam.zoom + cam.y }; }
  function snap(v, n = 12) { return Math.round(v / n) * n; }
  function iconCost(cost) { return Object.entries(cost).map(([k, v]) => v + ' ' + k).join(' · ') || 'Essential'; }
  function canAfford(t) { return Object.entries(t.cost).every(([k, v]) => resources[k] >= v); }
  function spend(t) { Object.entries(t.cost).forEach(([k, v]) => { resources[k] -= v; }); }
  function say(text) { const e = $('#message'); e.textContent = text; e.classList.remove('hidden'); clearTimeout(messageT); messageT = setTimeout(() => e.classList.add('hidden'), 2400); }

  function seedWorld() {
    rngState = 0x41c6ce57;
    trees.length = rocks.length = flowers.length = buildings.length = units.length = enemies.length = arrows.length = particles.length = 0;
    for (let i = 0; i < 230; i++) {
      const x = 80 + rng() * (WORLD - 160), y = 80 + rng() * (WORLD - 160);
      if (Math.hypot(x - 900, y - 960) > 260 && Math.abs(x - 900) > 72) trees.push({ x, y, s: .75 + rng() * .55, c: rng() });
    }
    for (let i = 0; i < 75; i++) { const x = 60 + rng() * (WORLD - 120), y = 60 + rng() * (WORLD - 120); if (Math.hypot(x - 900, y - 950) > 210) rocks.push({ x, y, s: .7 + rng() * .8 }); }
    for (let i = 0; i < 140; i++) flowers.push({ x: rng() * WORLD, y: rng() * WORLD, c: rng() > .5 ? '#d8bd63' : '#7996c2' });
    addBuilding('keep', 900, 1000);
    addBuilding('farm', 730, 1055); addBuilding('farm', 800, 1055); addBuilding('farm', 730, 1115); addBuilding('farm', 800, 1115);
    addBuilding('house', 1015, 1010); addBuilding('house', 1080, 1060); addBuilding('house', 980, 1110);
    addBuilding('lumber', 650, 960); addBuilding('quarry', 1130, 950); addBuilding('well', 965, 1035);
    for (let x = 570; x <= 1230; x += 48) if (x < 866 || x > 934) addBuilding('wall', x, 710);
    addBuilding('gate', 900, 710); addBuilding('tower', 835, 745); addBuilding('tower', 965, 745);
    [[900,880],[900,940],[900,1080],[850,1000],[1050,1140]].forEach(p => addBuilding('torch', p[0], p[1]));
    for (let i = 0; i < 9; i++) units.push(makeUnit(825 + rng() * 190, 910 + rng() * 230, i < 2 ? 'guard' : 'worker'));
    resources.food = 128; resources.wood = 98; resources.stone = 112; resources.iron = 18; resources.gold = 42; resources.people = 12; resources.cap = 18; resources.morale = 78;
    day = 1; minute = 360; elapsed = 0; raidWarned = false; gameEnded = false; selected = placing = null;
  }
  function addBuilding(type, x, y) { const t = TYPES[type]; const b = { type, x, y, hp: t.hp, maxHp: t.hp, level: 1, work: rng(), flash: 0, cooldown: 0 }; buildings.push(b); return b; }
  function makeUnit(x, y, role) { return { x, y, tx: x, ty: y, role, hp: role === 'guard' ? 70 : 38, maxHp: role === 'guard' ? 70 : 38, pace: rng() * 9, cooldown: rng() }; }
  function makeEnemy(i) { return { x: 770 + rng() * 260, y: 80 - i * 18, tx: 900, ty: 1000, hp: 42 + day * 8, maxHp: 42 + day * 8, speed: 22 + rng() * 9 + day, cooldown: rng(), flash: 0 }; }

  function initUI() {
    document.querySelectorAll('[data-build]').forEach(b => b.onclick = () => chooseBuild(b.dataset.build));
    document.querySelectorAll('.pace').forEach(b => b.onclick = () => setSpeed(+b.dataset.speed));
    // Keep the fastest pace directly addressable by the dependency-free game simulator.
    $('#speed-fast').onclick = () => setSpeed(4);
    $('#pause').onclick = () => setSpeed(speed ? 0 : 1); $('#home').onclick = centre; $('#centre-tool').onclick = centre;
    $('#build-tool').onclick = () => $('#build').classList.toggle('hidden'); $('#close-build').onclick = () => { cancelPlacement(); $('#build').classList.add('hidden'); };
    $('#workers-tool').onclick = () => say(`${resources.people} settlers · ${units.filter(u => u.role === 'worker').length} workers · ${units.filter(u => u.role === 'guard').length} guards`);
    $('#defence-tool').onclick = () => { const b = buildings.filter(x => ['wall','gate','tower','barracks'].includes(x.type)); say(`${b.length} defences · ${enemies.length ? enemies.length + ' raiders sighted' : 'the frontier is quiet'}`); };
    $('#help-tool').onclick = () => say('Build an economy by day. Towers and guards defend the north road after dusk.');
    $('#map-tool').onclick = () => { cam.zoom = cam.zoom < .9 ? 1.45 : .72; centre(); };
    $('#sound-tool').onclick = () => say('Sound is unavailable in this demo');
    $('#settings-tool').onclick = () => say('Your best survived day is saved automatically');
    $('#start').onclick = start; $('#restart').onclick = start;
    $('#build-tab').onclick = () => placing && chooseBuild(placing);
  }
  function chooseBuild(k) {
    const t = TYPES[k]; placing = k; selected = null; $('#inspect').classList.add('hidden');
    document.querySelectorAll('[data-build]').forEach(b => b.classList.toggle('selected', b.dataset.build === k));
    $('#build-info').innerHTML = `<b>${t.name}</b>${t.desc}<br><span>${iconCost(t.cost)}</span>`;
  }
  function cancelPlacement() { placing = null; document.querySelectorAll('[data-build]').forEach(x => x.classList.remove('selected')); }
  function updateUI() {
    ['food','wood','stone','iron','gold'].forEach(k => { $('#r-' + k).textContent = Math.floor(resources[k]); });
    $('#r-people').textContent = `${resources.people}/${resources.cap}`; $('#r-morale').textContent = `${resources.morale.toFixed(1)}/100`; $('#morale-bar').style.width = resources.morale + '%';
    $('#day').textContent = `Day ${day}`; const h = Math.floor(minute / 60) % 24, m = Math.floor(minute % 60); $('#time').textContent = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
    const daylight = h >= 6 && h < 19;
    const rate = k => buildings.reduce((sum, b) => sum + (TYPES[b.type].yield === k ? .18 * b.level : 0), 0);
    const showRate = (k, v) => { const e = $('#d-' + k); e.textContent = daylight && v ? `${v > 0 ? '+' : ''}${v.toFixed(1)}` : ''; e.style.color = v < 0 ? '#e6775f' : ''; };
    showRate('food', rate('food') - resources.people * .003); showRate('wood', rate('wood')); showRate('stone', rate('stone'));
    document.querySelectorAll('[data-build]').forEach(b => b.classList.toggle('locked', !canAfford(TYPES[b.dataset.build])));
  }
  function setSpeed(v) { speed = v; $('#pause').classList.toggle('active', !v); document.querySelectorAll('.pace').forEach(b => b.classList.toggle('active', +b.dataset.speed === v)); }
  function centre() { cam.x = 900; cam.y = 960; }
  function start() { seedWorld(); centre(); setSpeed(1); running = true; $('#title').classList.add('hidden'); $('#gameover').classList.add('hidden'); $('#build').classList.remove('hidden'); say('Day 1 · Build before nightfall'); last = performance.now(); requestAnimationFrame(loop); }

  function validPlace(type, x, y) {
    const t = TYPES[type]; if (x < 80 || y < 90 || x > WORLD - 80 || y > WORLD - 80) return false;
    return !buildings.some(b => Math.abs(b.x - x) < (TYPES[b.type].w + t.w) * .55 && Math.abs(b.y - y) < (TYPES[b.type].h + t.h) * .55);
  }
  function place(type, x, y) {
    const t = TYPES[type]; if (!canAfford(t)) return say('Not enough resources');
    x = snap(x); y = snap(y); if (!validPlace(type, x, y)) return say('That ground is occupied');
    spend(t); const b = addBuilding(type, x, y); selected = b; placing = null; resources.cap += t.cap || 0;
    if (type === 'barracks') units.push(makeUnit(x, y + 30, 'guard'));
    clearSite(b); burst(x, y, '#e7c77d', 12); say(`${t.name} constructed`); inspect(b); document.querySelectorAll('[data-build]').forEach(e => e.classList.remove('selected'));
  }
  function inspect(b) {
    selected = b; const t = TYPES[b.type], p = $('#inspect'); p.classList.remove('hidden');
    p.innerHTML = `<h3>${t.name} · Level ${b.level}</h3><div>Health: ${Math.ceil(b.hp)}/${b.maxHp}</div><div class="hp"><i style="width:${b.hp / b.maxHp * 100}%"></i></div><div>${t.desc}</div><div class="actions"><button data-action="repair">Repair</button><button data-action="upgrade">Upgrade</button>${b.type === 'keep' ? '' : '<button data-action="sell">Remove</button>'}</div>`;
    p.querySelectorAll('[data-action]').forEach(e => e.onclick = ev => { ev.stopPropagation(); buildingAction(e.dataset.action, b); });
  }
  function buildingAction(a, b) {
    if (a === 'repair') { const need = Math.ceil((b.maxHp - b.hp) / 10); if (resources.wood < need) return say('Not enough wood'); resources.wood -= need; b.hp = b.maxHp; say('Repairs complete'); }
    if (a === 'upgrade') { const cost = 25 * b.level; if (resources.stone < cost) return say(`Upgrade requires ${cost} stone`); resources.stone -= cost; b.level++; b.maxHp = Math.round(b.maxHp * 1.35); b.hp = b.maxHp; say(`${TYPES[b.type].name} upgraded`); }
    if (a === 'sell' && confirm(`Remove ${TYPES[b.type].name}?`)) { removeBuilding(b); resources.wood += Math.floor((TYPES[b.type].cost.wood || 0) / 2); }
    if (selected) inspect(b);
  }
  function removeBuilding(b) {
    const i = buildings.indexOf(b); if (i < 0) return;
    buildings.splice(i, 1); resources.cap = Math.max(0, resources.cap - (TYPES[b.type].cap || 0));
    if (selected === b) { selected = null; $('#inspect').classList.add('hidden'); }
  }
  function clearSite(b) {
    const t = TYPES[b.type];
    for (let i = trees.length - 1; i >= 0; i--) if (Math.abs(trees[i].x - b.x) < t.w * .7 && Math.abs(trees[i].y - b.y) < t.h * .9) trees.splice(i, 1);
    for (let i = rocks.length - 1; i >= 0; i--) if (Math.abs(rocks[i].x - b.x) < t.w * .65 && Math.abs(rocks[i].y - b.y) < t.h * .7) rocks.splice(i, 1);
  }
  function burst(x, y, c, n) { for (let i = 0; i < n; i++) particles.push({ x, y, vx: (rng()-.5)*38, vy: -8-rng()*25, life: .5+rng()*.5, c }); }

  function update(dt) {
    if (!speed || gameEnded) return; dt *= speed; elapsed += dt; minute += dt * 10;
    if (minute >= 1440) { minute -= 1440; day++; raidWarned = false; resources.morale = clamp(resources.morale + 4, 0, 100); localStorage.setItem('hearthwall.best', String(Math.max(day, +(localStorage.getItem('hearthwall.best') || 0)))); say(`Dawn of day ${day}`); }
    const hour = minute / 60;
    if (hour >= 19 && !raidWarned) { raidWarned = true; const n = 3 + day * 2; for (let i = 0; i < n; i++) enemies.push(makeEnemy(i)); say(`Night raid · ${n} raiders from the north!`); }
    if (hour >= 6 && hour < 19) {
      buildings.forEach(b => { const t = TYPES[b.type]; if (t.yield) resources[t.yield] += dt * .18 * b.level; });
      resources.food -= dt * resources.people * .003;
      if (resources.food < 0) { resources.food = 0; resources.morale -= dt * .08; }
      resources.morale = clamp(resources.morale + dt * .003 * buildings.filter(b => b.type === 'well').length, 0, 100);
    }
    updateUnits(dt); updateEnemies(dt); updateTowers(dt); updateProjectiles(dt);
    buildings.forEach(b => { b.flash = Math.max(0, b.flash - dt); });
    particles.forEach(p => { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 30 * dt; p.life -= dt; }); for (let i = particles.length - 1; i >= 0; i--) if (particles[i].life <= 0) particles.splice(i, 1);
    const move = 260 * dt / cam.zoom; if (keys.has('a') || keys.has('arrowleft')) cam.x -= move; if (keys.has('d') || keys.has('arrowright')) cam.x += move; if (keys.has('w') || keys.has('arrowup')) cam.y -= move; if (keys.has('s') || keys.has('arrowdown')) cam.y += move;
    cam.x = clamp(cam.x, 200, WORLD - 200); cam.y = clamp(cam.y, 180, WORLD - 180); updateUI();
  }
  function updateUnits(dt) {
    for (const u of units) {
      u.cooldown -= dt; u.pace += dt;
      let foe = null, best = u.role === 'guard' ? 170 : 45;
      for (const e of enemies) { if (e.hp <= 0) continue; const d = dist(u, e); if (d < best) { best = d; foe = e; } }
      if (foe) { u.tx = foe.x; u.ty = foe.y; if (best < 22 && u.cooldown <= 0) { foe.hp -= u.role === 'guard' ? 18 : 5; foe.flash = .12; u.cooldown = u.role === 'guard' ? .75 : 1.2; burst(foe.x, foe.y, '#f1d28b', 3); } }
      else if (Math.hypot(u.tx-u.x,u.ty-u.y) < 8 && rng() < dt * .25) { const home = buildings[Math.floor(rng()*buildings.length)]; if (home) { u.tx = home.x + (rng()-.5)*90; u.ty = home.y + (rng()-.5)*70; } }
      const dx=u.tx-u.x,dy=u.ty-u.y,m=Math.hypot(dx,dy); if(m>7){const v=(u.role==='guard'?44:29)*dt;u.x+=dx/m*v;u.y+=dy/m*v;}
    }
  }
  function updateEnemies(dt) {
    for (const e of enemies) {
      if (e.hp <= 0) continue;
      e.cooldown -= dt; e.flash -= dt; let target = null, bd = Infinity;
      for (const b of buildings) { const d = buildingDistance(e, b); if (d < bd) { bd=d;target=b; } }
      for (const u of units) { const d=dist(e,u); if(d<bd && d<60){bd=d;target=u;} }
      if (!target) continue; if (bd < 10) { if(e.cooldown<=0){target.hp-=9+day*1.5;target.flash=.12;e.cooldown=.8;burst(target.x,target.y,'#b7493e',4); if(target.maxHp && target.hp<=0){ if(buildings.includes(target)){ if(target.type==='keep') return endGame(); removeBuilding(target); } else { units.splice(units.indexOf(target),1); resources.people = Math.max(0, resources.people - 1); } resources.morale=clamp(resources.morale-5,0,100); }} }
      else { const dx=target.x-e.x,dy=target.y-e.y,m=Math.hypot(dx,dy);e.x+=dx/m*e.speed*dt;e.y+=dy/m*e.speed*dt; }
    }
    for(let i=enemies.length-1;i>=0;i--)if(enemies[i].hp<=0){const e=enemies[i];resources.gold+=2;burst(e.x,e.y,'#6e342f',9);enemies.splice(i,1);}
  }
  function buildingDistance(p, b) { const t=TYPES[b.type],dx=Math.max(Math.abs(p.x-b.x)-t.w/2,0),dy=Math.max(Math.abs(p.y-b.y)-t.h/2,0);return Math.hypot(dx,dy); }
  function updateTowers(dt) {
    for(const b of buildings){if(b.type!=='tower')continue;b.cooldown-=dt;if(b.cooldown>0)continue;let target=null,bd=TYPES.tower.range*b.level;for(const e of enemies){const d=dist(b,e);if(d<bd){bd=d;target=e;}}if(target){arrows.push({x:b.x,y:b.y-24,target,speed:250,damage:14+7*b.level});b.cooldown=1.15/b.level;}}
  }
  function updateProjectiles(dt){for(const a of arrows){if(!enemies.includes(a.target)){a.dead=true;continue;}const dx=a.target.x-a.x,dy=a.target.y-a.y,m=Math.hypot(dx,dy);if(m<9){a.target.hp-=a.damage;a.target.flash=.12;a.dead=true;}else{a.x+=dx/m*a.speed*dt;a.y+=dy/m*a.speed*dt;}}for(let i=arrows.length-1;i>=0;i--)if(arrows[i].dead)arrows.splice(i,1);}
  function endGame(){gameEnded=true;running=false;setSpeed(0);const best=Math.max(day,+(localStorage.getItem('hearthwall.best')||0));localStorage.setItem('hearthwall.best',String(best));$('#final').textContent=`Your settlement endured ${day} days. Best: ${best} days.`;$('#gameover').classList.remove('hidden');}

  function drawGround(){
    ctx.fillStyle='#526238';ctx.fillRect(0,0,vw,vh);const step=TILE*cam.zoom;const x0=Math.floor((cam.x-vw/(2*cam.zoom))/TILE)-1,y0=Math.floor((cam.y-vh/(2*cam.zoom))/TILE)-1;
    for(let gy=y0;gy<y0+vh/step+3;gy++)for(let gx=x0;gx<x0+vw/step+3;gx++){const h=hash(gx,gy);ctx.fillStyle=h>.83?'#596b3c':h<.13?'#4c5d34':'#53643a';ctx.fillRect(Math.floor(sx(gx*TILE)),Math.floor(sy(gy*TILE)),Math.ceil(step),Math.ceil(step));if(h>.76){ctx.fillStyle='#6c7944';ctx.fillRect(Math.floor(sx(gx*TILE+5)),Math.floor(sy(gy*TILE+8)),Math.max(1,cam.zoom*2),Math.max(1,cam.zoom));}}
    // main ochre road from the frontier through the town
    ctx.strokeStyle='#a66f4e';ctx.lineWidth=33*cam.zoom;ctx.lineCap='square';ctx.beginPath();ctx.moveTo(sx(900),sy(-20));ctx.lineTo(sx(900),sy(830));ctx.quadraticCurveTo(sx(930),sy(900),sx(900),sy(970));ctx.lineTo(sx(900),sy(1220));ctx.stroke();ctx.strokeStyle='#bd8058';ctx.lineWidth=23*cam.zoom;ctx.stroke();
    ctx.beginPath();ctx.moveTo(sx(650),sy(1010));ctx.lineTo(sx(1160),sy(1010));ctx.stroke();
    // boundary embankment
    ctx.strokeStyle='#241f23';ctx.lineWidth=18*cam.zoom;ctx.beginPath();ctx.moveTo(sx(100),sy(590));ctx.lineTo(sx(760),sy(590));ctx.lineTo(sx(790),sy(650));ctx.lineTo(sx(1010),sy(650));ctx.lineTo(sx(1040),sy(590));ctx.lineTo(sx(1700),sy(590));ctx.stroke();ctx.strokeStyle='#594435';ctx.lineWidth=9*cam.zoom;ctx.stroke();
  }
  function drawTree(t){const x=sx(t.x),y=sy(t.y),z=cam.zoom*t.s;if(x<-30||x>vw+30||y<-40||y>vh+30)return;ctx.fillStyle='#352a25';ctx.fillRect(x-3*z,y-2*z,6*z,15*z);ctx.fillStyle=t.c>.55?'#335833':'#3e6437';ctx.fillRect(x-10*z,y-18*z,20*z,16*z);ctx.fillStyle='#507d40';ctx.fillRect(x-7*z,y-23*z,13*z,9*z);ctx.fillStyle='#78a44a';ctx.fillRect(x-5*z,y-21*z,6*z,4*z);ctx.fillStyle='#203e2b';ctx.fillRect(x+6*z,y-12*z,5*z,8*z);}
  function drawRock(r){const x=sx(r.x),y=sy(r.y),z=cam.zoom*r.s;if(x<-30||x>vw+30||y<-30||y>vh+30)return;ctx.fillStyle='#2d3037';ctx.fillRect(x-10*z,y-7*z,20*z,11*z);ctx.fillStyle='#6d7377';ctx.fillRect(x-7*z,y-12*z,13*z,9*z);ctx.fillStyle='#9a9b91';ctx.fillRect(x-5*z,y-11*z,6*z,3*z);}
  function buildingShape(b, ghost=false, good=true){
    const t=TYPES[b.type],x=sx(b.x),y=sy(b.y),z=cam.zoom;ctx.save();ctx.globalAlpha=ghost?.62:1;if(ghost)ctx.filter=good?'sepia(1) saturate(2)':'hue-rotate(300deg) saturate(3)';else if(b.flash>0)ctx.filter='brightness(1.8)';
    ctx.fillStyle='#20201c66';ctx.beginPath();ctx.ellipse(x,y+t.h*.35*z,t.w*.55*z,8*z,0,0,Math.PI*2);ctx.fill();
    if(b.type==='farm'){ctx.fillStyle='#6d4931';ctx.fillRect(x-t.w/2*z,y-t.h/2*z,t.w*z,t.h*z);for(let i=-2;i<=2;i++){ctx.fillStyle='#ba873e';ctx.fillRect(x+i*11*z,y-t.h*.38*z,5*z,t.h*.76*z);ctx.fillStyle='#d4b354';for(let j=-2;j<=2;j++)ctx.fillRect(x+(i*11-2)*z,y+j*9*z,3*z,4*z);}}
    else if(b.type==='wall'||b.type==='gate'){ctx.fillStyle='#332823';ctx.fillRect(x-t.w/2*z,y-7*z,t.w*z,17*z);ctx.fillStyle='#82583a';for(let i=-t.w/2+3;i<t.w/2;i+=8){ctx.fillRect(x+i*z,y-13*z,6*z,21*z);ctx.fillStyle='#b98250';ctx.fillRect(x+i*z,y-13*z,2*z,18*z);ctx.fillStyle='#82583a';}if(b.type==='gate'){ctx.fillStyle='#252022';ctx.fillRect(x-13*z,y-9*z,26*z,19*z);ctx.fillStyle='#d59c4e';ctx.fillRect(x-15*z,y-18*z,4*z,28*z);ctx.fillRect(x+11*z,y-18*z,4*z,28*z);}}
    else if(b.type==='tower'){ctx.fillStyle='#493126';ctx.fillRect(x-10*z,y-34*z,20*z,43*z);ctx.fillStyle='#9a6038';ctx.fillRect(x-13*z,y-40*z,26*z,12*z);ctx.fillStyle='#d39b4f';ctx.fillRect(x-10*z,y-39*z,8*z,4*z);ctx.fillRect(x+3*z,y-39*z,8*z,4*z);ctx.fillStyle='#272124';ctx.fillRect(x-3*z,y-28*z,6*z,8*z);}
    else if(b.type==='well'){ctx.fillStyle='#5a5b59';ctx.fillRect(x-13*z,y-4*z,26*z,13*z);ctx.fillStyle='#9c9a83';ctx.fillRect(x-11*z,y-7*z,22*z,7*z);ctx.fillStyle='#22272a';ctx.fillRect(x-8*z,y-5*z,16*z,6*z);ctx.fillStyle='#6d4931';ctx.fillRect(x-12*z,y-24*z,3*z,18*z);ctx.fillRect(x+9*z,y-24*z,3*z,18*z);ctx.fillStyle='#a34c38';ctx.fillRect(x-15*z,y-27*z,30*z,5*z);}
    else if(b.type==='torch'){ctx.fillStyle='#4a3428';ctx.fillRect(x-2*z,y-2*z,4*z,15*z);ctx.fillStyle='#eaa83d';ctx.fillRect(x-5*z,y-10*z,10*z,9*z);ctx.fillStyle='#ffe174';ctx.fillRect(x-2*z,y-12*z,5*z,8*z);}
    else {const wide=t.w*z,high=t.h*z;ctx.fillStyle=b.type==='keep'?'#d7c7a0':'#b99b71';ctx.fillRect(x-wide/2,y-high*.28,wide,high*.58);ctx.fillStyle='#51302d';ctx.beginPath();ctx.moveTo(x-wide*.58,y-high*.25);ctx.lineTo(x,y-high*.73);ctx.lineTo(x+wide*.58,y-high*.25);ctx.closePath();ctx.fill();ctx.strokeStyle='#d68c45';ctx.lineWidth=3*z;ctx.stroke();ctx.fillStyle='#714835';ctx.fillRect(x-6*z,y+high*.05,12*z,high*.25);ctx.fillStyle='#74a6ad';ctx.fillRect(x-wide*.32,y-high*.12,7*z,8*z);ctx.fillRect(x+wide*.22,y-high*.12,7*z,8*z);if(b.type==='keep'){ctx.fillStyle='#365f78';ctx.fillRect(x-4*z,y-high*.82,8*z,16*z);ctx.fillStyle='#d4c28c';ctx.fillRect(x-24*z,y-high*.5,12*z,30*z);ctx.fillRect(x+12*z,y-high*.5,12*z,30*z);}}
    if(!ghost&&b.level>1){ctx.fillStyle='#f1cf69';ctx.font=`bold ${10*z}px sans-serif`;ctx.fillText('★'.repeat(Math.min(3,b.level-1)),x-t.w*.35*z,y-t.h*.65*z);}if(!ghost&&b.hp<b.maxHp){ctx.fillStyle='#241a1d';ctx.fillRect(x-t.w*.35*z,y-t.h*.7*z,t.w*.7*z,4*z);ctx.fillStyle=b.hp/b.maxHp>.35?'#72ad50':'#c54f43';ctx.fillRect(x-t.w*.35*z+z,y-t.h*.7*z+z,(t.w*.7-2)*z*b.hp/b.maxHp,2*z);}ctx.restore();
  }
  function drawUnit(u){const x=sx(u.x),y=sy(u.y),z=cam.zoom,bob=Math.sin(u.pace*7)*z;ctx.fillStyle='#1f2020aa';ctx.fillRect(x-5*z,y+7*z,10*z,3*z);ctx.fillStyle=u.role==='guard'?'#3f5976':'#864739';ctx.fillRect(x-5*z,y-4*z+bob,10*z,11*z);ctx.fillStyle='#d2a278';ctx.fillRect(x-4*z,y-11*z+bob,8*z,7*z);ctx.fillStyle=u.role==='guard'?'#9da7ab':'#c7993c';ctx.fillRect(x-5*z,y-14*z+bob,10*z,4*z);if(u.role==='guard'){ctx.fillStyle='#bfc5bf';ctx.fillRect(x+6*z,y-7*z,2*z,14*z);ctx.fillRect(x+4*z,y-8*z,6*z,2*z);}}
  function drawEnemy(e){const x=sx(e.x),y=sy(e.y),z=cam.zoom,bob=Math.sin(elapsed*8+e.x)*z;ctx.fillStyle='#20191baa';ctx.fillRect(x-6*z,y+8*z,12*z,3*z);ctx.fillStyle=e.flash>0?'#fff1d0':'#633d43';ctx.fillRect(x-6*z,y-5*z+bob,12*z,13*z);ctx.fillStyle='#70834b';ctx.fillRect(x-5*z,y-12*z+bob,10*z,8*z);ctx.fillStyle='#1b1819';ctx.fillRect(x-3*z,y-9*z+bob,2*z,2*z);ctx.fillRect(x+2*z,y-9*z+bob,2*z,2*z);ctx.fillStyle='#bd5a42';ctx.fillRect(x-7*z,y-14*z+bob,14*z,4*z);if(e.hp<e.maxHp){ctx.fillStyle='#21191b';ctx.fillRect(x-7*z,y-19*z,14*z,3*z);ctx.fillStyle='#c54f43';ctx.fillRect(x-6*z,y-18*z,12*z*e.hp/e.maxHp,z);}}
  function drawFogAndLight(){const hour=minute/60,dark=hour<6?clamp((6-hour)/4,0,.62):hour>18?clamp((hour-18)/3,0,.62):0;if(!dark)return;ctx.save();ctx.fillStyle=`rgba(10,14,24,${dark})`;ctx.fillRect(0,0,vw,vh);ctx.globalCompositeOperation='destination-out';for(const b of buildings){if(b.type!=='torch'&&b.type!=='keep'&&b.type!=='tower')continue;const r=(b.type==='torch'?75:b.type==='tower'?120:150)*cam.zoom,g=ctx.createRadialGradient(sx(b.x),sy(b.y),2,sx(b.x),sy(b.y),r);g.addColorStop(0,'rgba(0,0,0,.8)');g.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=g;ctx.beginPath();ctx.arc(sx(b.x),sy(b.y),r,0,Math.PI*2);ctx.fill();}ctx.restore();}
  function render(){
    ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,vw,vh);drawGround();flowers.forEach(f=>{const x=sx(f.x),y=sy(f.y);if(x>0&&x<vw&&y>0&&y<vh){ctx.fillStyle=f.c;ctx.fillRect(x,y,2*cam.zoom,2*cam.zoom);}});
    const order=[...trees.map(x=>({k:x.y,o:x,t:'t'})),...rocks.map(x=>({k:x.y,o:x,t:'r'})),...buildings.map(x=>({k:x.y,o:x,t:'b'})),...units.map(x=>({k:x.y,o:x,t:'u'})),...enemies.map(x=>({k:x.y,o:x,t:'e'}))].sort((a,b)=>a.k-b.k);for(const q of order){if(q.t==='t')drawTree(q.o);else if(q.t==='r')drawRock(q.o);else if(q.t==='b')buildingShape(q.o);else if(q.t==='u')drawUnit(q.o);else drawEnemy(q.o);}
    for(const a of arrows){ctx.strokeStyle='#f3d28b';ctx.lineWidth=Math.max(1,cam.zoom);ctx.beginPath();ctx.moveTo(sx(a.x)-3,sy(a.y)+2);ctx.lineTo(sx(a.x)+3,sy(a.y)-2);ctx.stroke();}
    for(const p of particles){ctx.globalAlpha=clamp(p.life*2,0,1);ctx.fillStyle=p.c;ctx.fillRect(sx(p.x),sy(p.y),2*cam.zoom,2*cam.zoom);}ctx.globalAlpha=1;
    if(selected&&buildings.includes(selected)){const t=TYPES[selected.type];ctx.strokeStyle='#ffe06d';ctx.lineWidth=2;ctx.strokeRect(sx(selected.x-t.w/2)-3,sy(selected.y-t.h/2)-3,t.w*cam.zoom+6,t.h*cam.zoom+6);}
    if(placing&&hover){const t=TYPES[placing],x=snap(hover.x),y=snap(hover.y);buildingShape({type:placing,x,y,level:1},true,validPlace(placing,x,y)&&canAfford(t));}
    drawFogAndLight();
    // soft unexplored corners echo the reference's fog of war
    const fog=ctx.createRadialGradient(vw*.52,vh*.56,Math.min(vw,vh)*.28,vw*.52,vh*.56,Math.max(vw,vh)*.78);fog.addColorStop(.45,'rgba(9,11,15,0)');fog.addColorStop(1,'rgba(7,8,13,.72)');ctx.fillStyle=fog;ctx.fillRect(0,0,vw,vh);
    if(minute/60>7&&minute/60<18&&day%3===1){ctx.strokeStyle='#d5e2d333';ctx.lineWidth=1;for(let i=0;i<45;i++){const x=(i*83+elapsed*120)%vw,y=(i*137+elapsed*210)%vh;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x-3,y+10);ctx.stroke();}}
  }
  function loop(now){if(!running)return;const dt=Math.min(.04,(now-last)/1000||0);last=now;update(dt);render();requestAnimationFrame(loop);}

  cv.addEventListener('pointerdown',e=>{pointer.down=true;pointer.moved=false;pointer.sx=pointer.cx=e.clientX;pointer.sy=pointer.cy=e.clientY;cv.setPointerCapture(e.pointerId);});
  cv.addEventListener('pointermove',e=>{pointer.x=e.clientX;pointer.y=e.clientY;hover=worldPos(e.clientX,e.clientY);if(pointer.down){const dx=e.clientX-pointer.cx,dy=e.clientY-pointer.cy;if(Math.abs(e.clientX-pointer.sx)+Math.abs(e.clientY-pointer.sy)>5)pointer.moved=true;cam.x=clamp(cam.x-dx/cam.zoom,200,WORLD-200);cam.y=clamp(cam.y-dy/cam.zoom,180,WORLD-180);pointer.cx=e.clientX;pointer.cy=e.clientY;if(!running||!speed)render();}});
  cv.addEventListener('pointerup',e=>{pointer.down=false;if(pointer.moved)return;const w=worldPos(e.clientX,e.clientY);if(placing)return place(placing,w.x,w.y);let hit=null,bd=42/cam.zoom;for(const b of buildings){const d=dist(w,b);if(d<bd){bd=d;hit=b;}}if(hit)inspect(hit);else{selected=null;$('#inspect').classList.add('hidden');}});
  cv.addEventListener('pointercancel',()=>{pointer.down=false;pointer.moved=false;});
  cv.addEventListener('wheel',e=>{e.preventDefault();const before=worldPos(e.clientX,e.clientY);cam.zoom=clamp(cam.zoom*Math.exp(-e.deltaY*.001),.55,2.5);const after=worldPos(e.clientX,e.clientY);cam.x=clamp(cam.x+before.x-after.x,200,WORLD-200);cam.y=clamp(cam.y+before.y-after.y,180,WORLD-180);if(!running||!speed)render();},{passive:false});
  addEventListener('keydown',e=>{const k=e.key.toLowerCase();keys.add(k);if(['arrowup','arrowdown','arrowleft','arrowright',' '].includes(k))e.preventDefault();if(k==='b')$('#build').classList.toggle('hidden');if(k==='escape')cancelPlacement();if(k===' ')setSpeed(speed?0:1);if(k==='1')setSpeed(1);if(k==='2')setSpeed(2);if(k==='3')setSpeed(4);});addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));addEventListener('blur',()=>keys.clear());addEventListener('resize',resize);
  resize();initUI();seedWorld();updateUI();render();
})();
