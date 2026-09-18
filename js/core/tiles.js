/* PixelForge Studio — tilemap helpers.
   Slicing a sheet into tiles, the 47-tile blob autotile lookup, 16-tile
   4-bit edge autotiling, seamless-wrap checks and a Tiled .tsx/.tmx writer.
   Pure maths + strings; safe in Node. */
window.PF = window.PF || {};
PF.Tiles = (() => {
  /* ---- slicing / assembling ---- */
  function slice(buf, w, h, tw, th, opts = {}) {
    const m = opts.margin || 0, sp = opts.spacing || 0;
    const cols = Math.floor((w - m * 2 + sp) / (tw + sp)), rows = Math.floor((h - m * 2 + sp) / (th + sp));
    const out = [];
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const ox = m + c * (tw + sp), oy = m + r * (th + sp), t = new Uint32Array(tw * th);
      for (let y = 0; y < th; y++) t.set(buf.subarray((oy + y) * w + ox, (oy + y) * w + ox + tw), y * tw);
      out.push({ pixels: t, col: c, row: r, index: r * cols + c, x: ox, y: oy });
    }
    return { tiles: out, cols, rows, tileWidth: tw, tileHeight: th };
  }
  function assemble(tiles, cols, tw, th, opts = {}) {
    const sp = opts.spacing || 0, m = opts.margin || 0;
    const rows = Math.ceil(tiles.length / cols);
    const w = m * 2 + cols * (tw + sp) - sp, h = m * 2 + rows * (th + sp) - sp;
    const out = new Uint32Array(w * h);
    tiles.forEach((t, i) => {
      const px = t.pixels || t, ox = m + (i % cols) * (tw + sp), oy = m + Math.floor(i / cols) * (th + sp);
      for (let y = 0; y < th; y++) out.set(px.subarray(y * tw, y * tw + tw), (oy + y) * w + ox);
    });
    return { pixels: out, width: w, height: h, cols, rows };
  }

  /* ---- autotiling ----
     Bitmask of the 8 neighbours, read clockwise from north:
       N=1 NE=2 E=4 SE=8 S=16 SW=32 W=64 NW=128
     A corner only counts when both of its adjacent edges are filled, which is
     what collapses the 256 raw combinations down to the classic 47 blob tiles. */
  const N = 1, NE = 2, E = 4, SE = 8, S = 16, SW = 32, W = 64, NW = 128;
  function normalize(mask) {
    let m = mask;
    if (!(m & N) || !(m & E)) m &= ~NE;
    if (!(m & S) || !(m & E)) m &= ~SE;
    if (!(m & S) || !(m & W)) m &= ~SW;
    if (!(m & N) || !(m & W)) m &= ~NW;
    return m;
  }
  /* The 47 reachable normalised masks, in a fixed order. Index into this table
     IS the tile index in a blob tileset, so the order must never be reshuffled. */
  const BLOB_47 = (() => {
    const seen = new Map();
    for (let m = 0; m < 256; m++) { const n = normalize(m); if (!seen.has(n)) seen.set(n, seen.size); }
    return [...seen.keys()];
  })();
  const BLOB_INDEX = (() => { const o = {}; BLOB_47.forEach((m, i) => { o[m] = i; }); return o; })();

  /* neighbourMask(grid, w, h, x, y, same) — `same` decides what counts as a
     matching neighbour; out-of-bounds is treated as matching by default so
     tiles at the map edge do not sprout a border. */
  function neighbourMask(grid, w, h, x, y, opts = {}) {
    const self = grid[y * w + x];
    const same = opts.same || ((a, b) => a === b);
    const oob = opts.edgeIsSame === false ? false : true;
    const at = (dx, dy) => {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) return oob;
      return same(grid[ny * w + nx], self);
    };
    return (at(0, -1) ? N : 0) | (at(1, -1) ? NE : 0) | (at(1, 0) ? E : 0) | (at(1, 1) ? SE : 0) |
      (at(0, 1) ? S : 0) | (at(-1, 1) ? SW : 0) | (at(-1, 0) ? W : 0) | (at(-1, -1) ? NW : 0);
  }
  const blobIndex = (grid, w, h, x, y, opts) => BLOB_INDEX[normalize(neighbourMask(grid, w, h, x, y, opts))];
  /* 16-tile 4-bit variant (N/E/S/W only) — the cheap tileset most engines ship. */
  const edgeIndex = (grid, w, h, x, y, opts) => {
    const m = neighbourMask(grid, w, h, x, y, opts);
    return (m & N ? 1 : 0) | (m & E ? 2 : 0) | (m & S ? 4 : 0) | (m & W ? 8 : 0);
  };
  /* Whole-map pass: grid of terrain ids -> grid of tile indices. */
  function autotile(grid, w, h, opts = {}) {
    const fn = opts.mode === 'edge' ? edgeIndex : blobIndex;
    const out = new Int32Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) out[y * w + x] = fn(grid, w, h, x, y, opts);
    return out;
  }

  /* ---- seam checking ----
     A tile is seamless when its left column matches its right column's
     continuation and likewise top/bottom. We compare the wrapped neighbour
     rows, not the edges themselves, because identical edges would just mean a
     flat border. Returns a 0..1 score plus the worst offending rows. */
  /* How visible the wrap seam is, as a ratio against the tile's own texture.
     A tile tiles cleanly when the colour jump across its edge is no larger
     than a typical jump inside it — NOT when the opposite edges are identical,
     which only flat colour ever achieves and which would score every good
     organic texture as broken. 0 = perfect, <=1.5 reads as seamless, 3+ shows
     an obvious grid line. */
  function seamScore(buf, tw, th) {
    const diff = (a, b) => {
      const [r1, g1, b1, a1] = PF.Color.rgba(a), [r2, g2, b2, a2] = PF.Color.rgba(b);
      return Math.abs(r1 - r2) + Math.abs(g1 - g2) + Math.abs(b1 - b2) + Math.abs(a1 - a2);
    };
    let hEdge = 0, vEdge = 0, hIn = 0, vIn = 0;
    for (let y = 0; y < th; y++) {
      hEdge += diff(buf[y * tw + tw - 1], buf[y * tw]);
      for (let x = 1; x < tw; x++) hIn += diff(buf[y * tw + x - 1], buf[y * tw + x]);
    }
    for (let x = 0; x < tw; x++) {
      vEdge += diff(buf[(th - 1) * tw + x], buf[x]);
      for (let y = 1; y < th; y++) vIn += diff(buf[(y - 1) * tw + x], buf[y * tw + x]);
    }
    const hAvg = hIn / Math.max(1, th * (tw - 1)), vAvg = vIn / Math.max(1, tw * (th - 1));
    const ratio = (edge, avg, n) => avg > 0 ? (edge / n) / avg : (edge > 0 ? Infinity : 0);
    const horizontal = ratio(hEdge, hAvg, th), vertical = ratio(vEdge, vAvg, tw);
    return { horizontal, vertical, score: (horizontal + vertical) / 2, seamless: horizontal <= 1.5 && vertical <= 1.5 };
  }
  /* 3x3 preview of a tile, for the studio's "tile" toggle. */
  function preview(buf, tw, th, times = 3) {
    const w = tw * times, h = th * times, out = new Uint32Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) out[y * w + x] = buf[(y % th) * tw + (x % tw)];
    return { pixels: out, width: w, height: h };
  }

  /* ---- Tiled export ---- */
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  function tsx({ name = 'tileset', image = 'tileset.png', tileWidth = 16, tileHeight = 16, columns = 4, count = 16, imageWidth, imageHeight, spacing = 0, margin = 0 }) {
    const iw = imageWidth || margin * 2 + columns * (tileWidth + spacing) - spacing;
    const ih = imageHeight || margin * 2 + Math.ceil(count / columns) * (tileHeight + spacing) - spacing;
    return `<?xml version="1.0" encoding="UTF-8"?>
<tileset version="1.10" tiledversion="1.10.2" name="${esc(name)}" tilewidth="${tileWidth}" tileheight="${tileHeight}" spacing="${spacing}" margin="${margin}" tilecount="${count}" columns="${columns}">
 <image source="${esc(image)}" width="${iw}" height="${ih}"/>
</tileset>
`;
  }
  function tmx({ name = 'map', width = 20, height = 15, tileWidth = 16, tileHeight = 16, tileset = 'tileset.tsx', data, firstgid = 1 }) {
    const cells = data && data.length === width * height ? Array.from(data, v => v + firstgid) : new Array(width * height).fill(firstgid);
    const rows = [];
    for (let y = 0; y < height; y++) rows.push(cells.slice(y * width, y * width + width).join(','));
    return `<?xml version="1.0" encoding="UTF-8"?>
<map version="1.10" tiledversion="1.10.2" orientation="orthogonal" renderorder="right-down" width="${width}" height="${height}" tilewidth="${tileWidth}" tileheight="${tileHeight}" infinite="0" nextlayerid="2" nextobjectid="1">
 <tileset firstgid="${firstgid}" source="${esc(tileset)}"/>
 <layer id="1" name="${esc(name)}" width="${width}" height="${height}">
  <data encoding="csv">
${rows.join(',\n')}
</data>
 </layer>
</map>
`;
  }

  return { slice, assemble, normalize, neighbourMask, blobIndex, edgeIndex, autotile, seamScore, preview,
    BLOB_47, BLOB_INDEX, DIR: { N, NE, E, SE, S, SW, W, NW }, tsx, tmx };
})();
