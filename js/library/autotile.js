/* PixelForge Studio — Autotiling (wang / blob) tileset generator.
   A tileset is only usable in a real map editor if the edge transiitons are
   enumerated. This module renders the transitions from a material description
   so a developer gets a drop-in 16-tile edge set (4-bit neighbour mask) or a
   47-tile blob set (edge + corner mask) plus the mask metadata, instead of
   hand-drawing 47 tiles.

   Bit layout (both sets):
       1 = N (up)   2 = E (right)   4 = S (down)   8 = W (left)
      16 = NE        32 = SE       64 = SW       128 = NW
   A set bit means "the neighbour on that side is the same material", i.e. the
   tile is open on that side and must NOT draw a rim there. */
window.PF = window.PF || {};
PF.AutoTile = (() => {
  const EDGES = [['N', 1], ['E', 2], ['S', 4], ['W', 8]];
  const DIAGS = [['NE', 16, 'N', 'E'], ['SE', 32, 'S', 'E'], ['SW', 64, 'S', 'W'], ['NW', 128, 'N', 'W']];

  /* A diagonal only carries information when both of its edges are open
     (otherwise the shape is already determined by the edges). Canonicalising
     collapses the 256 raw masks onto the 47 distinct blob tiles. */
  function canonical(mask) {
    let m = mask & 15;
    for (const [, bit, a, b] of DIAGS) if ((mask & bit) && (mask & { N: 1, E: 2, S: 4, W: 8 }[a]) && (mask & { N: 1, E: 2, S: 4, W: 8 }[b])) m |= bit;
    return m;
  }
  const BLOB = (() => {
    const seen = new Set(), list = [];
    for (let m = 0; m < 256; m++) { const c = canonical(m); if (!seen.has(c)) { seen.add(c); list.push(c); } }
    list.sort((a, b) => popcount(a) - popcount(b) || a - b);
    return list;
  })();
  const WANG16 = Array.from({ length: 16 }, (_, i) => i);
  const BLOB_INDEX = new Map(BLOB.map((m, i) => [m, i]));
  const blobIndex = mask => BLOB_INDEX.get(canonical(mask));

  function popcount(v) { let n = 0; while (v) { v &= v - 1; n++; } return n; }
  const bit = (mask, name) => !!(mask & { N: 1, E: 2, S: 4, W: 8, NE: 16, SE: 32, SW: 64, NW: 128 }[name]);

  /* Neighbour mask for a cell of `fn(x,y) -> boolean`, using the raw 8-bit
     form (edges + corners) then canonicalised by the caller. */
  function maskAt(x, y, fn) {
    const N = fn(x, y - 1), E = fn(x + 1, y), S = fn(x, y + 1), W = fn(x - 1, y);
    let m = (N ? 1 : 0) | (E ? 2 : 0) | (S ? 4 : 0) | (W ? 8 : 0);
    if (N && E && fn(x + 1, y - 1)) m |= 16;
    if (S && E && fn(x + 1, y + 1)) m |= 32;
    if (S && W && fn(x - 1, y + 1)) m |= 64;
    if (N && W && fn(x - 1, y - 1)) m |= 128;
    return m;
  }
  const edgeMaskAt = (x, y, fn) => maskAt(x, y, fn) & 15;

  /* ---------------- tile painting ----------------
     mat: {
       body(api, S)                 required — fills the whole cell
       rim, rimHi, rimLo            colours for the closed-side rim
       depth(api, S)                optional interior shading pass
       corner(api, S, side)         optional extra decoration per closed corner
       seed                         texture seed
     } */
  function paintTile(api, S, mask, mat, seed = 0) {
    mat.body(api, S, seed);
    const closeN = !bit(mask, 'N'), closeE = !bit(mask, 'E'), closeS = !bit(mask, 'S'), closeW = !bit(mask, 'W');
    const rim = mat.rim, hi = mat.rimHi || mat.rim, lo = mat.rimLo || mat.rim;
    const R = mat.inset === undefined ? 1 : mat.inset;
    if (mat.depth) mat.depth(api, S, seed);

    /* Each closed side draws a rim. Where two closed sides meet, the rim insets
       by `R` at that end so the corner reads as rounded instead of square. */
    if (closeN) {
      for (let x = 0; x < S; x++) {
        const inset = (closeW && x < R) || (closeE && x >= S - R);
        const y = inset ? R : 0;
        api.px(x, y, rim);
        if (!inset) { api.px(x, y + 1, hi); api.px(x, y + 2, lo); }
      }
      if (closeW) { api.px(0, R, rim); api.px(0, R + 1, hi); }
      if (closeE) { api.px(S - 1, R, rim); api.px(S - 1, R + 1, hi); }
      if (!closeW) { api.px(0, 0, rim); }
      if (!closeE) { api.px(S - 1, 0, rim); }
    }
    if (closeS) {
      for (let x = 0; x < S; x++) {
        const inset = (closeW && x < R) || (closeE && x >= S - R);
        const y = inset ? S - 1 - R : S - 1;
        api.px(x, y, rim);
        /* One row of contact shadow, not two: a 2px band on a 16px tile eats
           an eighth of the cell and reads as a trench in a tiled map. */
        if (!inset) api.px(x, y - 1, lo);
      }
      if (closeW) { api.px(0, S - 1 - R, rim); api.px(0, S - 2 - R, lo); }
      if (closeE) { api.px(S - 1, S - 1 - R, rim); api.px(S - 1, S - 2 - R, lo); }
      if (!closeW) api.px(0, S - 1, rim);
      if (!closeE) api.px(S - 1, S - 1, rim);
    }
    if (closeW) {
      for (let y = 0; y < S; y++) {
        const inset = (closeN && y < R) || (closeS && y >= S - R);
        const x = inset ? R : 0;
        api.px(x, y, rim);
        if (!inset) { api.px(x + 1, y, hi); }
      }
      if (closeN) { api.px(R, 0, rim); }
      if (closeS) { api.px(R, S - 1, rim); }
    }
    if (closeE) {
      for (let y = 0; y < S; y++) {
        const inset = (closeN && y < R) || (closeS && y >= S - R);
        const x = inset ? S - 1 - R : S - 1;
        api.px(x, y, rim);
        if (!inset) api.px(x - 1, y, lo);
      }
    }
    /* Inner (concave) corners: only the blob set carries them. The corner bit
       is closed while both of its edges are open, so the material has a notch
       cut out of that corner and the rim wraps around it. */
    const inner = [['NE', 'N', 'E', S - 1, 0, -1, 1], ['SE', 'S', 'E', S - 1, S - 1, -1, -1],
      ['SW', 'S', 'W', 0, S - 1, 1, -1], ['NW', 'N', 'W', 0, 0, 1, 1]];
    for (const [d, a, b, cx, cy, dx, dy] of inner) {
      if (bit(mask, a) && bit(mask, b) && !bit(mask, d)) {
        const n = mat.notch === undefined ? 2 : mat.notch;
        for (let i = 0; i < n; i++) {
          want(api, cx - dx * i, cy - dy * i, rim, mat);
          want(api, cx - dx * i, cy - dy * (i + 1), rim, mat);
        }
        want(api, cx - dx * (n - 1), cy - dy * n, lo, mat);
      }
    }
    if (mat.corner) mat.corner(api, S, mask, seed);
  }
  /* Rim pixels may only be written where the body actually exists; the body
     painter owns the silhouette so a rounded corner can leave a hole. */
  function want(api, x, y, c, mat) { if (!mat.clip || mat.clip(x, y)) api.px(x, y, c); }

  /* ---------------- sheet generation ----------------
     Returns DocData: one frame per tile, laid out in a grid, plus
     `T.wang = { cols, rows, size, count, masks, wangids }` metadata. */
  function sheetDoc(o) {
    const size = o.size || 16, masks = o.blob ? BLOB : WANG16;
    const cols = o.cols || (o.blob ? 8 : 4);
    const rows = Math.ceil(masks.length / cols);
    const W = cols * size, H = rows * size;
    const name = o.name || 'autotile';
    const frames = masks.map((mask, i) => ({
      duration: 100,
      paint: (buf) => {
        const api = PF.Pixel.offsetApi(PF.Pixel.makeApi(buf, W, H), (i % cols) * size, Math.floor(i / cols) * size);
        paintTile(api, size, mask, o.material, i);
      }
    }));
    const doc = {
      width: W, height: H, name, layers: [{ name: 'Tiles' }],
      states: o.animated
        ? [{ name: 'tiles', fps: o.fps || 6, loop: true, frames }]
        : [{ name: 'tiles', fps: 1, loop: true, frames }]
    };
    doc.wang = {
      cols, rows, size, count: masks.length, blob: !!o.blob, masks: masks.slice(),
      tiles: masks.map((m, i) => ({ id: i, x: (i % cols) * size, y: Math.floor(i / cols) * size, mask: m, canonical: canonical(m) }))
    };
    return doc;
  }

  /* ---------------- material factory ----------------
     Deterministic texture helpers so a tile reads as a material, not a flat
     fill: base colour + speckle + optional band. */
  function material(o) {
    const colors = o.colors, seed = o.seed || 0, S = o.size || 16;
    const body = (api, size, sd) => {
      api.rect(0, 0, size - 1, size - 1, colors[0]);
      if (colors[1] && o.speck !== 0) api.speck(0, 0, size - 1, size - 1, seed + sd, [colors[1], colors[2] || colors[1]], o.speck === undefined ? 0.14 : o.speck);
      if (colors[3]) api.dith(0, 0, size - 1, size - 1, colors[0], colors[3], seed & 1);
    };
    return { size: S, body, speck: o.speck, rim: o.rim || colors[4] || '#181425', rimHi: o.rimHi, rimLo: o.rimLo,
      notch: o.notch, corner: o.corner, clip: o.clip, depth: o.depth, colors };
  }

  /* ---------------- map helpers (for game code) ---------------- */
  /* Given a map, return the tile index grid for a blob/wang sheet. Cells where
     `fn` is false are -1 (empty). */
  function build(x0, y0, w, h, fn, o = {}) {
    const grid = [];
    for (let y = 0; y < h; y++) {
      const row = [];
      for (let x = 0; x < w; x++) {
        if (!fn(x0 + x, y0 + y)) { row.push(-1); continue; }
        const m = maskAt(x0 + x, y0 + y, fn);
        row.push(o.blob ? blobIndex(m) : (m & 15));
      }
      grid.push(row);
    }
    return grid;
  }

  return { canonical, blobIndex, popcount, bit, maskAt, edgeMaskAt, paintTile, sheetDoc, material, build,
    BLOB, WANG16, BLOB_INDEX, EDGES, DIAGS };
})();
