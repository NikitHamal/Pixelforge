/* Runefall — world: hand-built map (village, ruins plaza, pond, lava pool),
   animated tiles/props, blockers, hazards, heal spots. Units = asset px. */
window.RF = window.RF || {};
RF.World = (() => {
  const T = 16; // tile px
  const W = 2400, H = 2400;
  const rnd = (a, b) => a + Math.random() * (b - a);

  function grassPattern() {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const x = c.getContext('2d');
    x.fillStyle = '#3e8948'; x.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 900; i++) {
      const px = (Math.random() * 256) | 0, py = (Math.random() * 256) | 0;
      x.fillStyle = Math.random() < 0.6 ? '#356b3d' : '#63c74d';
      x.fillRect(px, py, 2, 1);
    }
    for (let i = 0; i < 12; i++) {
      x.fillStyle = ['#ffffff', '#f6757a', '#fee761'][(Math.random() * 3) | 0];
      x.fillRect((Math.random() * 256) | 0, (Math.random() * 256) | 0, 2, 2);
    }
    return c;
  }

  function build() {
    const S = RF.Sprites;
    const blockers = [];   // {x,y,r}
    const hazards = [];    // {x,y,rx,ry,dps,kind}
    const heals = [];      // {x,y,r,rate,kind,cool?}
    const anims = [];      // {x,y,w,h,frame(t)->canvas|null, glow?}
    const decor = [];      // {x,y,cv,scale,block?} static sorted by y at draw
    const addBlock = (x, y, r) => blockers.push({ x, y, r });
    const addDecor = (id, state, x, y, scale = 2, blockR = 0) => {
      const st = S.frames(id, state); // keep all frames: single-frame decor behaves exactly as before
      if (!st || !st.frames.length) return null;
      const d = { x, y, frames: st.frames, fps: st.fps, count: st.frames.length, w: st.w, h: st.h, scale, id, state };
      decor.push(d);
      if (blockR) addBlock(x, y, blockR);
      return d;
    };
    const addAnim = (id, state, x, y, scale = 2, fps = 0, glow = null) => {
      const st = S.frames(id, state);
      if (!st) return;
      anims.push({ x, y, w: st.w, h: st.h, scale, fps: fps || st.fps, count: st.frames.length,
        frames: st.frames, glow });
    };

    /* ---- village corner (home) ---- */
    const VX = 480, VY = 480;
    addDecor('rpg_village', 'cottage', VX, VY, 2, 26);
    addAnim('rpg_village', 'cottage', VX, VY, 2); // smoke animates (overlaps static? no—anim instead)
    decor.pop(); // anim covers it
    addDecor('rpg_village', 'well', VX + 110, VY + 40, 2, 18);
    addDecor('rpg_village', 'market_stall', VX - 20, VY + 120, 2, 22);
    addDecor('rpg_village', 'signpost', VX + 60, VY - 60, 2, 0);
    addAnim('rpg_village', 'lamp', VX + 150, VY + 110, 2, 4, 'warm');
    addBlock(VX + 150, VY + 110, 6);
    addAnim('rpg_village', 'fountain', VX - 110, VY + 30, 2, 8);
    addBlock(VX - 110, VY + 30, 24);

    /* ---- ruins plaza (center) ---- */
    const PX = 1200, PY = 1200, PR = 10; // 20x20 tiles
    const tiles = S.sliceTiles('rpg_dungeon_tiles', 'tiles', 16, 16, 4);
    const plaza = document.createElement('canvas');
    plaza.width = plaza.height = PR * 2 * T;
    const px = plaza.getContext('2d');
    for (let ty = 0; ty < PR * 2; ty++) for (let tx = 0; tx < PR * 2; tx++) {
      const cx = tx - PR, cy = ty - PR;
      const dist = Math.max(Math.abs(cx), Math.abs(cy));
      let idx = (tx * 7 + ty * 13) % 4; // 0..3 floors
      if (dist === PR - 1) idx = 4; // brick border
      if (Math.abs(cx) <= 1 || Math.abs(cy) <= 1) idx = 13; // carpet cross
      if (Math.abs(cx) <= 1 && Math.abs(cy) <= 1) idx = 3; // rune heart
      px.drawImage(tiles[idx], tx * T, ty * T);
    }
    const plazaX = PX - PR * T, plazaY = PY - PR * T;
    // pillars at corners + torches + altar + statue + throne
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sy]) => {
      addDecor('rpg_dungeon_props', 'pillar', PX + sx * (PR * T - 8), PY + sy * (PR * T - 8), 2, 14);
    });
    addAnim('torch', 'burn', PX - PR * T + 24, PY - 20, 2, 10, 'warm');
    addAnim('torch', 'burn', PX + PR * T - 24, PY - 20, 2, 10, 'warm');
    addAnim('torch', 'burn', PX - PR * T + 24, PY + 20, 2, 10, 'warm');
    addAnim('torch', 'burn', PX + PR * T - 24, PY + 20, 2, 10, 'warm');
    addAnim('rpg_dungeon_props', 'altar', PX, PY - 90, 2, 4, 'warm');
    addBlock(PX, PY - 90, 16);
    addDecor('rpg_dungeon_props', 'statue', PX - 100, PY + 60, 2, 12);
    addDecor('rpg_dungeon_props', 'throne', PX + 100, PY - 60, 2, 16);
    addDecor('rpg_dungeon_props', 'sarcophagus', PX - 60, PY + 110, 2, 16);
    addDecor('rpg_dungeon_props', 'bones', PX + 70, PY + 100, 2, 0);
    addAnim('rpg_dungeon_props', 'glowshrooms', PX - 130, PY - 40, 2, 4, 'cool');
    // THE shrine: savepoint at plaza heart (heal + activate)
    addAnim('rpg_savepoint', 'idle', PX, PY, 2, 6, 'cool');
    heals.push({ x: PX, y: PY + 10, r: 46, rate: 6, kind: 'shrine' });

    /* ---- pond (east) ---- */
    const pond = { x: 1830, y: 700, rx: 150, ry: 100 };
    addAnim('rpg_waterfall', 'flow', pond.x - pond.rx - 16, pond.y - pond.ry - 10, 2, 10);
    addDecor('flora', 'bush', pond.x - pond.rx - 40, pond.y + 20, 2, 8);
    addDecor('flora', 'bush', pond.x + pond.rx + 30, pond.y - 30, 2, 8);

    /* ---- lava pool (south-west) ---- */
    const lava = { x: 700, y: 1830, rx: 130, ry: 90 };
    hazards.push({ ...lava, dps: 14, kind: 'lava' });

    /* ---- spike trap guarding gem cache (near plaza east gate) ---- */
    const spike = { x: PX + PR * T + 70, y: PY, rx: 40, ry: 16 };
    hazards.push({ ...spike, dps: 9, kind: 'spikes' });

    /* ---- campfires (heal zones) ---- */
    const fires = [{ x: VX + 40, y: VY + 190 }, { x: 1500, y: 1650 }, { x: 1950, y: 1500 }];
    fires.forEach(f => {
      addAnim('campfire', 'burn', f.x, f.y, 2, 8, 'warm');
      heals.push({ x: f.x, y: f.y, r: 64, rate: 4, kind: 'fire' });
    });

    /* ---- scatter flora/rocks ---- */
    const floraStates = ['oak', 'pine', 'bush', 'rock', 'flowers', 'tuft'];
    const farFrom = (x, y) => Math.hypot(x - PX, y - PY) > PR * T + 40 && Math.hypot(x - VX, y - VY) > 130 &&
      Math.hypot((x - pond.x) / pond.rx, (y - pond.y) / pond.ry) > 1.25 &&
      Math.hypot((x - lava.x) / lava.rx, (y - lava.y) / lava.ry) > 1.3;
    let placed = 0, guard = 0;
    while (placed < 170 && guard++ < 3000) {
      const x = rnd(60, W - 60), y = rnd(60, H - 60);
      if (!farFrom(x, y)) continue;
      const st = floraStates[(Math.random() * floraStates.length) | 0];
      const tree = st === 'oak' || st === 'pine';
      addDecor('flora', st, x, y, 2, tree ? 9 : st === 'rock' ? 9 : 0);
      placed++;
    }
    // bones + statue ruins flavor in wilds
    for (let i = 0; i < 8; i++) {
      const x = rnd(200, W - 200), y = rnd(200, H - 200);
      if (!farFrom(x, y)) continue;
      addDecor('rpg_dungeon_props', Math.random() < 0.5 ? 'bones' : 'pillar_broken', x, y, 2, 10);
    }

    return { W, H, T, tiles, plaza, plazaX, plazaY, pond, lava, spike,
      blockers, hazards, heals, anims, decor, grass: grassPattern(),
      spawn: { x: VX + 40, y: VY + 90 } };
  }

  return { build };
})();
