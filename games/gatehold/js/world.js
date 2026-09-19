/* Gatehold — the valley: terrain, the settlement layout, and the two pieces
   of pathfinding the game needs.

   Terrain is a small value-noise field, not a hand-authored map, so the valley
   is new every run while still being exactly reproducible from its seed. The
   settlement is then stamped on top of the noise: a clearing, a road cross, a
   palisade with a gate on the north approach, and the hearth at the middle.

   Ants follow a BFS distance field back to the hearth. That field is computed
   over TERRAIN ONLY, which is the whole trick behind the defence loop: a wall
   does not reroute the swarm, it becomes the thing the swarm eats. Villagers
   get a real A* instead, because they should walk around a house rather than
   chew through it. */
window.GH = window.GH || {};
GH.World = (() => {
  'use strict';

  const W = 70, H = 48;                 // tiles
  const TERRAIN = { GRASS: 0, GRASS2: 1, GRASS3: 2, TALL: 3, DIRT: 4, ROAD: 5,
    FIELD: 6, GRAVEL: 7, WATER: 8, SHORE: 9, STONY: 10 };
  const NAMES = ['grass', 'grass2', 'grass3', 'tall', 'dirt', 'road', 'field',
    'gravel', 'water', 'shore', 'stony'];
  const WALK = [1, 1, 1, 1, 1, 1, 1, 1, 0, 1, 1];
  /* Props that stand in the way. Bushes and reeds are decoration: a valley
     where every shrub blocks the swarm would path worse than the noise map
     it is drawn on. */
  const SOLID = { pine: 1, oak: 1, boulder: 1, rock: 1, logpile: 1, crate: 1, stump: 1 };

  function rng(seed) {
    let s = (seed | 0) || 1;
    return () => {
      s ^= s << 13; s ^= s >>> 17; s ^= s << 5; s |= 0;
      return (s >>> 0) / 4294967296;
    };
  }

  /* Bilinear value noise. Coarse lattice values, smooth in between, summed
     over octaves — enough relief to place forests and ponds plausibly. */
  function noise2(rand, size) {
    const n = size + 1, g = new Float32Array(n * n);
    for (let i = 0; i < g.length; i++) g[i] = rand();
    return (x, y) => {
      const fx = x * size, fy = y * size;
      const x0 = Math.floor(fx), y0 = Math.floor(fy);
      const tx = fx - x0, ty = fy - y0;
      const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
      const i00 = g[(y0 % n) * n + (x0 % n)], i10 = g[(y0 % n) * n + ((x0 + 1) % n)];
      const i01 = g[((y0 + 1) % n) * n + (x0 % n)], i11 = g[((y0 + 1) % n) * n + ((x0 + 1) % n)];
      return (i00 * (1 - sx) + i10 * sx) * (1 - sy) + (i01 * (1 - sx) + i11 * sx) * sy;
    };
  }

  const idx = (m, x, y) => y * m.w + x;
  const inside = (m, x, y) => x >= 0 && y >= 0 && x < m.w && y < m.h;

  /* ------------------------------------------------------------------ gen */

  function gen(seed) {
    const rand = rng(seed);
    const f1 = noise2(rand, 5), f2 = noise2(rand, 11), f3 = noise2(rand, 3);
    const m = { w: W, h: H, seed, tiles: new Uint8Array(W * H), props: [], blocked: new Uint8Array(W * H) };

    const cx = W >> 1, cy = H >> 1;
    const clear = 13;                                  // settlement radius, tiles
    const pond = { x: 12 + (rand() * 6 | 0), y: H - 16 };
    const pond2 = { x: W - 16 - (rand() * 6 | 0), y: 14 };

    /* Band the terrain by QUANTILE, not by fixed cut-offs on the noise. The
       three octaves average out to a narrow spread around 0.5, so "-0.36 is
       dirt" produced a valley that was 96% one shade of grass with no forest
       and no rock anywhere. Ranking the field first guarantees the mix. */
    const field = new Float32Array(W * H);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const nx = x / W, ny = y / H;
        field[y * W + x] = f1(nx, ny) * 0.55 + f2(nx, ny) * 0.30 + f3(nx, ny) * 0.15;
      }
    }
    const sorted = Array.from(field).sort((a, b) => a - b);
    const band = [0.05, 0.11, 0.25, 0.60, 0.80, 0.92];
    const cut = band.map(q => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))]);
    const bandOf = e => e < cut[0] ? TERRAIN.STONY : e < cut[1] ? TERRAIN.GRAVEL
      : e < cut[2] ? TERRAIN.DIRT : e < cut[3] ? TERRAIN.GRASS
      : e < cut[4] ? TERRAIN.GRASS2 : e < cut[5] ? TERRAIN.GRASS3 : TERRAIN.TALL;

    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const e = field[y * W + x];
        let t = bandOf(e);
        /* two ponds, kept off the settlement flat */
        const dp = Math.hypot(x - pond.x, y - pond.y);
        const dp2 = Math.hypot(x - pond2.x, y - pond2.y);
        if (dp < 4.2 || dp2 < 3.6) t = TERRAIN.WATER;
        else if (dp < 5.4 || dp2 < 4.6) t = TERRAIN.SHORE;
        /* the clearing the settlement sits in */
        const dc = Math.hypot(x - cx, y - cy);
        if (dc < clear) t = dc < clear * 0.55 ? TERRAIN.GRASS
          : (t === TERRAIN.GRASS3 || t === TERRAIN.TALL ? TERRAIN.GRASS2 : t);
        m.tiles[idx(m, x, y)] = t;
      }
    }

    /* ---- roads: a cross through the settlement plus a ring road ---- */
    const road = (x, y) => {
      if (!inside(m, x, y)) return;
      const t = m.tiles[idx(m, x, y)];
      if (t === TERRAIN.WATER) return;
      m.tiles[idx(m, x, y)] = TERRAIN.ROAD;
    };
    for (let x = cx - clear; x <= cx + clear; x++) { road(x, cy); road(x, cy + 6); }
    for (let y = cy - clear; y <= cy + clear; y++) { road(cx, y); road(cx - 7, y); }
    for (let a = 0; a < Math.PI * 2; a += 0.02) {
      road(Math.round(cx + Math.cos(a) * 9), Math.round(cy + Math.sin(a) * 9));
      road(Math.round(cx + Math.cos(a) * 9.6), Math.round(cy + Math.sin(a) * 9.6));
    }
    /* the approach road north to the gate */
    for (let y = 4; y <= cy - 9; y++) { road(cx, y); road(cx + 1, y); }

    /* ---- props: forests on the high ground, rocks on the stony ground ---- */
    const put = (kind, x, y) => {
      if (!inside(m, x, y)) return;
      if (Math.hypot(x - cx, y - cy) < clear - 1) return;         // never inside the clearing
      if (m.blocked[idx(m, x, y)]) return;
      const t = m.tiles[idx(m, x, y)];
      if (t === TERRAIN.WATER || t === TERRAIN.ROAD) return;
      m.props.push({ kind, x, y });
      if (SOLID[kind]) m.blocked[idx(m, x, y)] = 1;
    };
    for (let y = 1; y < H - 1; y++) {
      for (let x = 1; x < W - 1; x++) {
        const t = m.tiles[idx(m, x, y)];
        const r = rand();
        if (t === TERRAIN.TALL && r < 0.62) put(r < 0.34 ? 'pine' : 'oak', x, y);
        else if (t === TERRAIN.GRASS3 && r < 0.42) put(r < 0.2 ? 'oak' : 'pine', x, y);
        else if (t === TERRAIN.STONY && r < 0.34) put(r < 0.18 ? 'boulder' : 'rock', x, y);
        else if (t === TERRAIN.GRASS2 && r < 0.07) put('bush', x, y);
        else if (t === TERRAIN.SHORE && r < 0.3) put('reed', x, y);
        else if (t === TERRAIN.DIRT && r < 0.03) put('stump', x, y);
      }
    }

    /* ---- the settlement itself ---- */
    const site = (x, y) => ({ x, y });
    const houses = [site(cx - 5, cy - 5), site(cx + 5, cy - 4), site(cx - 6, cy + 4),
      site(cx + 4, cy + 5), site(cx + 6, cy + 1)];
    const farms = [site(cx - 5, cy + 9), site(cx + 5, cy + 9), site(cx - 12, cy + 2)];
    const store = site(cx - 5, cy + 1);
    const well = site(cx + 2, cy + 3);
    const towerSpots = [site(cx - 3, cy - 8), site(cx + 5, cy - 8)];

    return { m, cx, cy, clear, pond, houses, farms, store, well, towerSpots };
  }

  /* ------------------------------------------------------------ queries */

  function walkable(m, x, y) {
    if (!inside(m, x, y)) return false;
    if (!WALK[m.tiles[idx(m, x, y)]]) return false;
    return !m.blocked[idx(m, x, y)];
  }

  /* ------------------------------------------------------------- fields */

  /* 8-way BFS out from (tx,ty). step[] holds the direction index an entity at
     (x,y) should take to get one tile closer; -1 means unreachable. */
  const DX = [1, 1, 0, -1, -1, -1, 0, 1];
  const DY = [0, 1, 1, 1, 0, -1, -1, -1];

  function flowField(m, tx, ty) {
    const n = m.w * m.h;
    const dist = new Int32Array(n).fill(-1);
    const step = new Int8Array(n).fill(-1);
    if (!inside(m, tx, ty)) return { dist, step };
    const q = new Int32Array(n);
    let head = 0, tail = 0;
    dist[idx(m, tx, ty)] = 0;
    q[tail++] = idx(m, tx, ty);
    while (head < tail) {
      const cur = q[head++];
      const x = cur % m.w, y = (cur / m.w) | 0;
      const d = dist[cur];
      for (let k = 0; k < 8; k++) {
        const nx = x + DX[k], ny = y + DY[k];
        if (!inside(m, nx, ny)) continue;
        if (!WALK[m.tiles[idx(m, nx, ny)]]) continue;
        const ni = ny * m.w + nx;
        if (dist[ni] !== -1) continue;
        dist[ni] = d + 1;
        /* the neighbour walks back toward us: opposite direction index */
        step[ni] = (k + 4) % 8;
        q[tail++] = ni;
      }
    }
    return { dist, step };
  }

  /* A* for villagers. block() lets the caller fold placed buildings into the
     cost without rebuilding the map. Returns [] when there is no route. */
  function path(m, sx, sy, tx, ty, block) {
    if (!inside(m, sx, sy) || !inside(m, tx, ty)) return [];
    const n = m.w * m.h;
    const g = new Float32Array(n).fill(Infinity);
    const from = new Int32Array(n).fill(-1);
    const open = [{ i: sy * m.w + sx, f: 0 }];
    const start = sy * m.w + sx, goal = ty * m.w + tx;
    g[start] = 0;
    let guard = 0;
    while (open.length && guard++ < 3000) {
      let bi = 0;
      for (let i = 1; i < open.length; i++) if (open[i].f < open[bi].f) bi = i;
      const cur = open.splice(bi, 1)[0].i;
      if (cur === goal) break;
      const x = cur % m.w, y = (cur / m.w) | 0;
      for (let k = 0; k < 8; k++) {
        const nx = x + DX[k], ny = y + DY[k];
        if (!inside(m, nx, ny)) continue;
        if (!WALK[m.tiles[idx(m, nx, ny)]]) continue;
        const ni = ny * m.w + nx;
        const blocked = (ni !== goal && block && block(nx, ny)) ? 1 : 0;
        if (blocked) continue;
        if (k % 2 === 1) {                       // no cutting a diagonal corner
          if (!WALK[m.tiles[idx(m, x + DX[k], y)]] || !WALK[m.tiles[idx(m, x, y + DY[k])]]) continue;
        }
        const cost = g[cur] + (k % 2 ? 1.414 : 1);
        if (cost < g[ni]) { g[ni] = cost; from[ni] = cur; open.push({ i: ni, f: cost + Math.hypot(nx - tx, ny - ty) }); }
      }
    }
    if (from[goal] === -1 && goal !== start) return [];
    const out = [];
    for (let c = goal; c !== -1 && c !== start; c = from[c]) out.push({ x: c % m.w, y: (c / m.w) | 0 });
    out.reverse();
    return out;
  }

  return { W, H, TERRAIN, NAMES, WALK, SOLID, gen, walkable, flowField, path, idx, inside };
})();
