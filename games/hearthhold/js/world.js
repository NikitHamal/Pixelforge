/* Hearthhold — the map: generation, occupancy and route finding.

   The world is five parallel typed arrays over one 56x56 grid rather than a
   grid of tile objects. Two reasons. The renderer touches every visible tile
   every frame and the pathfinder touches thousands per query, so the flat
   layout is the difference between a smooth settlement and a slideshow; and
   the arrays can be stamped and reused between A* calls instead of being
   reallocated, which is what keeps forty agents repathing from producing
   forty megabytes of garbage a second.

   Everything here is deterministic. The generator runs off its own xorshift
   seeded from the difficulty choice, never Math.random, so a given seed always
   produces the same valley — which is also what lets the headless simulator
   reproduce a failure. */
window.HHWorld = (() => {
  'use strict';

  const { MW, MH, G, NODES } = window.HH;
  const N = MW * MH;
  const NODE_KEYS = Object.keys(NODES);
  const idx = (x, y) => y * MW + x;
  const inb = (x, y) => x >= 0 && y >= 0 && x < MW && y < MH;

  /* --------------------------------------------------------- generation -- */

  function rng(seed) {
    let s = (seed | 0) || 0x9e3779b9;
    return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; s |= 0; return (s >>> 0) / 4294967296; };
  }

  /* Value noise off a hashed lattice. Smooth enough to make forests look like
     forests rather than confetti, and cheap enough to run four octaves over
     three thousand tiles at load. */
  function noise(seed) {
    const h = (x, y) => {
      let n = x * 374761393 + y * 668265263 + seed * 2246822519;
      n = (n ^ (n >>> 13)) * 1274126177;
      return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
    };
    return (x, y, scale) => {
      const fx = x / scale, fy = y / scale;
      const x0 = Math.floor(fx), y0 = Math.floor(fy);
      const tx = fx - x0, ty = fy - y0;
      const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
      const a = h(x0, y0), b = h(x0 + 1, y0), c = h(x0, y0 + 1), d = h(x0 + 1, y0 + 1);
      return (a + (b - a) * sx) + ((c + (d - c) * sx) - (a + (b - a) * sx)) * sy;
    };
  }

  function make(seed) {
    const rnd = rng(seed), nz = noise(seed | 1);
    const w = {
      seed,
      ground: new Uint8Array(N),
      node: new Uint8Array(N),          // 0 = none, else NODE_KEYS index + 1
      amt: new Int16Array(N),
      regrow: new Float32Array(N),
      occ: new Int32Array(N),           // building id, or 0
      wall: new Uint8Array(N),          // 0 none, 1 palisade, 2 rampart, 3 gate
      crop: new Uint8Array(N),          // growth stage 0..5 for field tiles
      cropT: new Float32Array(N),
      lit: new Float32Array(N),         // torchlight, rebuilt when buildings change
      // A* scratch, stamped by generation rather than cleared
      _g: new Float32Array(N), _from: new Int32Array(N),
      _seen: new Int32Array(N), _gen: 0,
      _heap: new Int32Array(N + 1), _hp: new Float32Array(N + 1), _hn: 0
    };

    for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
      const i = idx(x, y);
      const g = nz(x, y, 9) * 0.6 + nz(x, y, 3) * 0.4;
      w.ground[i] = g > 0.62 ? G.TUFT : g < 0.36 ? G.BLOOM : G.GRASS;
    }

    /* A lake in one corner, kept clear of the centre so the starting hall is
       never boxed in by water it cannot build over. */
    const lx = rnd() < 0.5 ? 9 : MW - 10, ly = rnd() < 0.5 ? 9 : MH - 10;
    for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
      const d = Math.hypot(x - lx, y - ly) + nz(x, y, 5) * 4 - 2;
      const i = idx(x, y);
      if (d < 5.5) w.ground[i] = G.WATER;
      else if (d < 7) w.ground[i] = G.SHALLOW;
      else if (d < 8.4) w.ground[i] = G.SAND;
    }

    const plant = (x, y, key, amount) => {
      if (!inb(x, y)) return;
      const i = idx(x, y);
      if (w.ground[i] === G.WATER || w.ground[i] === G.SHALLOW || w.node[i]) return;
      w.node[i] = NODE_KEYS.indexOf(key) + 1;
      w.amt[i] = amount === undefined ? NODES[key].amount : amount;
    };

    // forests: two noise fields so oak and pine grow in separate stands
    for (let y = 1; y < MH - 1; y++) for (let x = 1; x < MW - 1; x++) {
      const f = nz(x + 700, y, 7);
      if (f > 0.66 && rnd() < 0.62) plant(x, y, f > 0.78 ? 'pine' : 'tree');
      else if (f > 0.6 && rnd() < 0.09) plant(x, y, 'bush', 0);
    }
    // mineral seams: short runs rather than single tiles, so a quarry has work
    const seam = (key, runs, len) => {
      for (let k = 0; k < runs; k++) {
        let x = 3 + Math.floor(rnd() * (MW - 6)), y = 3 + Math.floor(rnd() * (MH - 6));
        let a = rnd() * Math.PI * 2;
        for (let s = 0; s < len; s++) {
          plant(Math.round(x), Math.round(y), key);
          a += (rnd() - 0.5) * 1.1;
          x += Math.cos(a); y += Math.sin(a);
        }
      }
    };
    seam('rock', 9, 6); seam('clay', 6, 5); seam('iron', 5, 4); seam('gold', 3, 3);
    for (let k = 0; k < 46; k++) plant(3 + Math.floor(rnd() * (MW - 6)), 3 + Math.floor(rnd() * (MH - 6)), 'berry');
    for (let k = 0; k < 30; k++) plant(3 + Math.floor(rnd() * (MW - 6)), 3 + Math.floor(rnd() * (MH - 6)), 'herb');

    /* Clear a plaza at the centre and lay the first crossroads. A settlement
       that opens with its hall wedged between two boulders is not a challenge,
       it is a bad deal. */
    const cx = MW >> 1, cy = MH >> 1;
    for (let y = cy - 5; y <= cy + 5; y++) for (let x = cx - 5; x <= cx + 5; x++) {
      if (!inb(x, y)) continue;
      const i = idx(x, y);
      w.node[i] = 0; w.amt[i] = 0;
      if (w.ground[i] === G.WATER || w.ground[i] === G.SHALLOW) w.ground[i] = G.GRASS;
    }
    for (let k = -14; k <= 14; k++) {
      if (inb(cx + k, cy + 2)) w.ground[idx(cx + k, cy + 2)] = G.ROAD;
      if (inb(cx + 2, cy + k)) w.ground[idx(cx + 2, cy + k)] = G.ROAD;
    }
    /* The four raider approaches, so an attack always has somewhere to come
       from even after the player walls the place in. */
    w.gates = [{ x: cx, y: 1 }, { x: MW - 2, y: cy }, { x: cx, y: MH - 2 }, { x: 1, y: cy }];
    return w;
  }

  /* ---------------------------------------------------------- queries ---- */

  const nodeKey = (w, i) => (w.node[i] ? NODE_KEYS[w.node[i] - 1] : null);
  const nodeDef = (w, i) => (w.node[i] ? NODES[NODE_KEYS[w.node[i] - 1]] : null);
  const setNode = (w, i, key, amount) => {
    w.node[i] = key ? NODE_KEYS.indexOf(key) + 1 : 0;
    w.amt[i] = key ? (amount === undefined ? NODES[key].amount : amount) : 0;
  };

  const isWater = (w, i) => w.ground[i] === G.WATER;
  const isRoad = (w, i) => w.ground[i] === G.ROAD || w.ground[i] === G.COBBLE;

  /* Blocks a walker outright: water, a standing structure, a shut wall. A
     gate's own tile is only open when the gate is, which is the whole point of
     having gates at all. */
  function blocked(w, x, y, gateOpen) {
    if (!inb(x, y)) return true;
    const i = idx(x, y);
    if (isWater(w, i)) return true;
    if (w.wall[i] === 1 || w.wall[i] === 2) return true;
    if (w.wall[i] === 3 && !(gateOpen && gateOpen(i))) return true;
    if (w.occ[i]) return true;
    return false;
  }

  /* Cheapest 4-neighbour route from (sx,sy) to (tx,ty), returned as a flat
     array of tile indices ending at the goal, or null.

     `smash` is how raiders get in: walls and buildings become passable at a
     heavy price instead of impassable, so the search naturally prefers an open
     gate, then a long way round, and only then picks the thinnest stretch of
     palisade to break — which is exactly the priority order a besieger has. */
  function route(w, sx, sy, tx, ty, o) {
    o = o || {};
    if (!inb(sx, sy) || !inb(tx, ty)) return null;
    const goal = idx(tx, ty), start = idx(sx, sy);
    if (start === goal) return [];
    const gen = ++w._gen;
    const { _g: g, _from: from, _seen: seen } = w;
    w._hn = 0;
    const heap = w._heap, hp = w._hp;

    const push = (i, p) => {
      let n = ++w._hn; heap[n] = i; hp[n] = p;
      while (n > 1) {
        const par = n >> 1;
        if (hp[par] <= hp[n]) break;
        const ti = heap[par], tp = hp[par];
        heap[par] = heap[n]; hp[par] = hp[n]; heap[n] = ti; hp[n] = tp; n = par;
      }
    };
    const pop = () => {
      const top = heap[1];
      heap[1] = heap[w._hn]; hp[1] = hp[w._hn]; w._hn--;
      let n = 1;
      for (;;) {
        const l = n << 1, r = l + 1; let m = n;
        if (l <= w._hn && hp[l] < hp[m]) m = l;
        if (r <= w._hn && hp[r] < hp[m]) m = r;
        if (m === n) break;
        const ti = heap[m], tp = hp[m];
        heap[m] = heap[n]; hp[m] = hp[n]; heap[n] = ti; hp[n] = tp; n = m;
      }
      return top;
    };

    /* The building being left and the building being entered are both walkable
       for the length of this one query. A hut wedged between two neighbours has
       its door square ringed by occupied ones, so pricing only the goal tile
       left the whole building unreachable — and then unleavable once somebody
       was inside it. Either way the worker assigned to it spent the rest of the
       run wandering in the grass instead of clocking on. */
    const goalOcc = w.occ[goal], startOcc = w.occ[start];
    const inside = i => (goalOcc !== 0 && w.occ[i] === goalOcc) ||
      (startOcc !== 0 && w.occ[i] === startOcc);
    const enter = i => i === goal || inside(i);

    const cost = i => {
      if (isWater(w, i)) return o.swim ? 26 : -1;
      const wl = w.wall[i];
      if (wl === 3 && o.gateOpen && o.gateOpen(i)) return 8;
      if (wl) return o.smash ? (wl === 2 ? 130 : 55) : -1;
      if (w.occ[i]) return o.smash ? 90 : -1;
      return isRoad(w, i) ? 6 : 10;
    };
    const hEst = i => (Math.abs((i % MW) - tx) + Math.abs((i / MW | 0) - ty)) * 6;

    seen[start] = gen; g[start] = 0; from[start] = -1;
    push(start, hEst(start));
    let guard = o.budget || 9000;

    while (w._hn > 0 && guard-- > 0) {
      const cur = pop();
      if (cur === goal) {
        const out = [];
        for (let i = cur; i !== start; i = from[i]) out.push(i);
        out.reverse();
        return out;
      }
      const cx = cur % MW, cy = cur / MW | 0, cg = g[cur];
      for (let d = 0; d < 4; d++) {
        const nx = cx + (d === 0 ? 1 : d === 2 ? -1 : 0);
        const ny = cy + (d === 1 ? 1 : d === 3 ? -1 : 0);
        if (!inb(nx, ny)) continue;
        const ni = idx(nx, ny);
        const c = enter(ni) ? 4 : cost(ni);
        if (c < 0) continue;
        const ng = cg + c;
        if (seen[ni] === gen && g[ni] <= ng) continue;
        seen[ni] = gen; g[ni] = ng; from[ni] = cur;
        push(ni, ng + hEst(ni));
      }
    }
    return null;
  }

  /* Nearest tile satisfying `pred`, searched outward in square rings. Rings
     beat a flood fill here because the answer is almost always within three
     tiles and a flood fill would visit the whole map to prove it. */
  function nearest(w, x, y, pred, maxR) {
    x = Math.round(x); y = Math.round(y);
    const R = maxR === undefined ? 26 : maxR;
    if (inb(x, y) && pred(idx(x, y), x, y)) return idx(x, y);
    for (let r = 1; r <= R; r++) {
      for (let k = -r; k <= r; k++) {
        const cand = [[x + k, y - r], [x + k, y + r], [x - r, y + k], [x + r, y + k]];
        for (const [px, py] of cand)
          if (inb(px, py) && pred(idx(px, py), px, py)) return idx(px, py);
      }
    }
    return null;
  }

  /* Four-bit neighbour mask for the wall autotile sheets: N=1, E=2, S=4, W=8.
     Gates count as wall so a gate in a run does not leave two loose ends. */
  function wallMask(w, x, y) {
    let m = 0;
    if (inb(x, y - 1) && w.wall[idx(x, y - 1)]) m |= 1;
    if (inb(x + 1, y) && w.wall[idx(x + 1, y)]) m |= 2;
    if (inb(x, y + 1) && w.wall[idx(x, y + 1)]) m |= 4;
    if (inb(x - 1, y) && w.wall[idx(x - 1, y)]) m |= 8;
    return m;
  }

  return { make, idx, inb, N, NODE_KEYS, nodeKey, nodeDef, setNode,
    isWater, isRoad, blocked, route, nearest, wallMask, rng, noise };
})();
