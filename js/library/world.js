/* PixelForge Studio — World tiles & props: animated water, grass/dungeon tilesets,
   trees, campfire, torch, chest, door, portal. Deterministic hash speckles. */
window.PF = window.PF || {};
PF.World = (() => {
  const D = (name, fps, loop, frames) => ({ name, fps, loop, frames });
  const Fr = (duration, paint) => ({ duration, paint });
  const ms = fps => Math.round(1000 / fps);
  const apiFor = (buf, W, H) => PF.Pixel.makeApi(buf, W, H);
  const OUT32 = PF.Color.hexToU32('#181425'); // cached: one lookup, not one per frame
  const finishProps = (buf, W, H) => buf.set(PF.Raster.outline(buf, W, H, OUT32));

  /* ---------- helpers ---------- */
  function speckle(api, W, H, seed, colors, density = 0.12) {
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const h = api.hash(x, y, seed);
      if (h < density) api.px(x, y, colors[Math.floor(h / density * colors.length) % colors.length]);
    }
  }
  function grassBase(api, W, H, variant) {
    api.rect(0, 0, W - 1, H - 1, '#3e8948');
    speckle(api, W, H, 10 + variant, ['#63c74d', '#265c42'], 0.18);
    // blades
    for (let i = 0; i < 6; i++) {
      const x = (api.hash(i, variant, 99) * W) | 0, y = (api.hash(i, variant, 77) * H) | 0;
      api.line(x, y, x, y - 2, '#63c74d', 1);
    }
    if (variant === 2) { // flowers
      api.px(4, 5, '#ffffff'); api.px(5, 5, '#fee761'); api.px(11, 10, '#f6757a'); api.px(11, 11, '#a22633');
    }
    if (variant === 3) { // pebbles
      api.rect(5, 6, 7, 7, '#8b9bb4'); api.rect(10, 10, 11, 11, '#5a6988');
    }
  }
  /* ---------- WATER (animated 4f, 16×16 tiled ×2) ---------- */
  function waterFrame(t) {
    return (buf, W, H) => {
      const api = apiFor(buf, W, H);
      api.rect(0, 0, W - 1, H - 1, '#124e89');
      speckle(api, W, H, 5, ['#0099db'], 0.1);
      // moving wave bands: sine offset rows
      for (let y = 2; y < H; y += 6) {
        for (let x = 0; x < W; x++) {
          const w = Math.sin(((x + t * 4) / W) * Math.PI * 2 + (y / H) * 3);
          if (w > 0.55) api.px(x, y, '#2ce8f5');
          else if (w > 0.3) api.px(x, y, '#0099db');
        }
      }
      // sparkles
      for (let i = 0; i < 4; i++) {
        const x = (api.hash(i, t, 31) * W) | 0, y = (api.hash(i, t, 47) * H) | 0;
        if ((i + t) % 2 === 0) api.px(x, y, '#ffffff');
      }
    };
  }
  /* ---------- TILESET doc: 64×64 with 4×4 tiles of 16px ---------- */
  function tilesetSuite() {
    const paint = (buf, W, H) => {
      const api = apiFor(buf, W, H);
      // 0,0 grass | 1,0 grass flowers | 0,1 dirt | 1,1 stone | 2,x dungeon brick | 3,x wood
      const tile = (tx, ty, fn) => {
        const ox = tx * 16, oy = ty * 16;
        const sub = PF.Pixel.offsetApi(api, ox, oy);
        fn(sub, 16, 16);
      };
      tile(0, 0, (a) => grassBase(a, 16, 16, 0));
      tile(1, 0, (a) => grassBase(a, 16, 16, 2));
      tile(2, 0, (a) => { // dirt
        a.rect(0, 0, 15, 15, '#b86f50');
        for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (a.hash(x, y, 3) < 0.15) a.px(x, y, '#733e39');
        for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (a.hash(x, y, 4) < 0.06) a.px(x, y, '#ead4aa');
      });
      tile(3, 0, (a) => { // stone
        a.rect(0, 0, 15, 15, '#8b9bb4');
        for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (a.hash(x, y, 6) < 0.14) a.px(x, y, '#5a6988');
        a.rect(2, 2, 6, 5, '#5a6988'); a.rect(9, 8, 14, 12, '#5a6988'); a.rect(3, 10, 7, 13, '#c0cbdc');
      });
      tile(0, 1, (a) => { // dungeon brick
        a.rect(0, 0, 15, 15, '#3a4466');
        a.rect(0, 0, 15, 15, '#3a4466');
        for (let y = 0; y <= 16; y += 5) a.line(0, y, 15, y, '#262b44', 1);
        for (let r = 0; r < 4; r++) for (let cx = (r % 2) * 4; cx < 16; cx += 8) a.line(cx, r * 5, cx, r * 5 + 4, '#262b44', 1);
        for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (a.hash(x, y, 8) < 0.05) a.px(x, y, '#5a6988');
      });
      tile(1, 1, (a) => { // wood planks
        a.rect(0, 0, 15, 15, '#b86f50');
        for (let y = 3; y < 16; y += 4) a.line(0, y, 15, y, '#733e39', 1);
        for (let i = 0; i < 4; i++) { const x = 3 + i * 4; a.line(x, (i % 2) * 4, x, (i % 2) * 4 + 3, '#733e39', 1); }
        for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (a.hash(x, y, 9) < 0.05) a.px(x, y, '#ead4aa');
      });
      tile(2, 1, (a) => { // sand
        a.rect(0, 0, 15, 15, '#ead4aa');
        for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (a.hash(x, y, 11) < 0.1) a.px(x, y, '#c8b28a');
      });
      tile(3, 1, (a) => { // dark dungeon floor
        a.rect(0, 0, 15, 15, '#262b44');
        a.rect(1, 1, 14, 14, '#262b44');
        for (let y = 0; y < 16; y += 4) for (let x = 0; x < 16; x += 4) a.px(x, y, '#3a4466');
      });
      // row 2-3: autotile edges / decorations kept simple: fence, flowers, etc. as tiles
      tile(0, 2, (a) => { // grass→dirt edge
        grassBase(a, 16, 16, 1);
        for (let x = 0; x < 16; x++) { const e = Math.round(10 + Math.sin(x * 1.2) * 2); for (let y = e; y < 16; y++) a.px(x, y, '#b86f50'); }
      });
      tile(1, 2, (a) => { grassBase(a, 16, 16, 0); a.rect(3, 8, 12, 12, '#3e8948'); a.rect(4, 5, 11, 8, '#265c42'); a.px(6, 6, '#e43b44'); a.px(10, 7, '#e43b44'); }); // bush tile
      tile(2, 2, (a) => { a.rect(0, 0, 15, 15, '#124e89'); a.rect(0, 6, 15, 15, '#0099db'); a.line(0, 6, 15, 6, '#2ce8f5', 1); }); // water edge
      tile(3, 2, (a) => { a.rect(0, 0, 15, 15, '#3e2731'); for (let i = 0; i < 8; i++) a.px((a.hash(i, 1, 50) * 16) | 0, (a.hash(i, 2, 51) * 16) | 0, '#5a6988'); }); // cave wall
      tile(0, 3, (a) => { // fence horizontal
        grassBase(a, 16, 16, 0);
        a.rect(0, 5, 15, 7, '#b86f50'); a.rect(0, 8, 15, 9, '#733e39');
        a.rect(2, 3, 4, 12, '#b86f50'); a.rect(11, 3, 13, 12, '#b86f50');
      });
      tile(1, 3, (a) => { // path stones
        grassBase(a, 16, 16, 3);
        a.ellipse(3, 4, 8, 8, '#8b9bb4', true); a.ellipse(9, 9, 13, 13, '#8b9bb4', true);
      });
      tile(2, 3, (a) => { // lava
        a.rect(0, 0, 15, 15, '#a22633');
        for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (a.hash(x, y, 60 + ((x + y) % 3)) < 0.2) a.px(x, y, '#f77622');
        for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (a.hash(x, y, 70) < 0.05) a.px(x, y, '#fee761');
      });
      tile(3, 3, (a) => { // ice
        a.rect(0, 0, 15, 15, '#2ce8f5');
        for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (a.hash(x, y, 71) < 0.12) a.px(x, y, '#ffffff');
        a.line(0, 0, 15, 15, '#ffffff', 1);
      });
    };
    return { width: 64, height: 64, name: 'tileset', layers: [{ name: 'Tiles' }],
      states: [D('tiles', 1, true, [Fr(500, paint)])] };
  }

  /* ---------- TREES & PLANTS: swaying idle loops (rock sits still, as rocks do) ---------- */
  function floraSuite() {
    // sw = canopy offset per frame; every loop is seamless AND first/last differ
    const paintTree = (variant, sw, t = 0) => (buf, W, H) => {
      const api = apiFor(buf, W, H);
      const X = x => x + sw;
      if (variant === 0) { // oak: canopy breathes + a leaf drops each cycle
        /* The old oak was one flat ellipse with a darker ellipse dropped on
           its right and a rectangle for a trunk — a lollipop. A tree reads
           from CLUMPS: five overlapping lobes, each with its own lit crown and
           its own pooled shadow underneath, painted back to front so the front
           ones cast onto the ones behind. The trunk flares into roots, because
           a trunk that ends in a straight cut looks planted in a hole. */
        const BK = '#4a2f26', BKh = '#6e4534', BKs = '#2b1a16';
        const LF = '#3e8948', LFh = '#63c74d', LFhh = '#95e06c', LFs = '#265c42', LFss = '#17402f';
        api.rect(13, 18, 18, 28, BK);
        api.rect(13, 18, 14, 28, BKh);                       // lit side of the bole
        api.rect(17, 18, 18, 28, BKs);
        api.rect(12, 26, 19, 28, BK);                        // root flare
        api.rect(11, 27, 20, 28, BK);
        api.px(11, 27, BKh); api.px(20, 27, BKs); api.px(19, 28, BKs);
        for (let y = 20; y < 27; y += 3) api.px(16, y, BKs); // bark grain
        api.line(14, 19, 10, 15, BK, 2); api.line(17, 19, 22, 15, BK, 2);  // forks
        /* Each lobe: silhouette, body, sunlit crown. `shade` drops the whole
           lobe one rung so the far side of the canopy sits back. */
        const lobe = (x0, y0, x1, y1, shade) => {
          api.ellipse(X(x0), y0, X(x1), y1, LFss, true);
          api.ellipse(X(x0), y0, X(x1), y1 - 2, shade ? LFs : LF, true);
          api.ellipse(X(x0) + 1, y0 + 1, X(x1) - 3, y1 - 5, shade ? LF : LFh, true);
          api.ellipse(X(x0) + 2, y0 + 2, X(x1) - 6, y1 - 8, shade ? LFh : LFhh, true);
        };
        lobe(15, 6, 26, 18, true);                           // back right
        lobe(5, 9, 16, 20, true);                            // back left
        lobe(14, 11, 25, 22, true);                          // lower right, in shadow
        lobe(9, 2, 22, 14, false);                           // crown, full sun
        lobe(6, 12, 17, 22, false);                          // lower left, lit
        /* Gaps you can see sky through: what stops a canopy reading as a bush.
           Only ever ON a leaf pixel — a speck dropped over the background is
           an island, and the outline pass rims islands into floating bricks. */
        for (let y = 4; y < 21; y++) for (let x = 5; x < 27; x++)
          if (api.hash(x, y, 23) > 0.955 && buf[y * W + X(x)]) api.px(X(x), y, LFss);
        api.px(X(11), 9, '#e43b44'); api.px(X(20), 8, '#e43b44'); api.px(X(15), 15, '#e43b44');
        api.px(X(11), 8, '#f6757a');
        api.px(22 - t, Math.min(27, 22 + t), t % 2 ? '#63c74d' : '#3e8948'); // falling leaf
      } else if (variant === 1) { // pine: tiers sway + snow shimmer
        /* Three stacked ellipses is a snowman painted green. A conifer is
           TIERS: each one a shallow cone that flares as it descends, its lower
           rim scalloped where the branch tips droop, with the bole showing in
           the notch between tiers. Upper tiers sway further than lower ones —
           that alone is most of what makes a tree feel like it is in wind. */
        const NDk = '#17402f', N = '#2f6b4a', NHi = '#46875c', NLit = '#63c74d';
        const BK = '#4a3428', BKh = '#6b4b36', BKs = '#2b1d16';
        api.rect(15, 9, 17, 28, BK);
        api.rect(15, 9, 15, 28, BKh); api.rect(17, 9, 17, 28, BKs);
        api.rect(13, 27, 19, 28, BK); api.px(13, 27, BKh); api.px(19, 27, BKs);
        const tier = (y0, h, hw, drift) => {
          const cx = 16 + Math.round(sw * drift);
          for (let i = 0; i <= h; i++) {
            const w = Math.max(1, Math.round(hw * (0.22 + 0.78 * (i / h))));
            const y = y0 + i;
            api.rect(cx - w, y, cx + w, y, i === h ? NDk : N);
            if (i < h) {                                     // sun comes from upper left
              api.rect(cx - w, y, cx - Math.max(0, w - 2), y, NHi);
              api.px(cx + w, y, NDk);
            }
          }
          for (let x = cx - hw; x <= cx + hw; x += 3) {      // drooping branch tips
            api.px(x, y0 + h + 1, NDk); api.px(x + 1, y0 + h + 1, NDk);
          }
          return cx;
        };
        tier(19, 5, 10, 0.25); tier(14, 5, 8, 0.55);
        const cx3 = tier(9, 5, 6, 0.8), cx4 = tier(4, 4, 4, 1);
        api.rect(cx4, 1, cx4, 4, N); api.px(cx4, 1, NLit);   // leader shoot
        // snow caught on the lit upper edges, twinkling frame to frame
        [[-7, 20], [5, 21], [-5, 15], [4, 16], [-3, 10], [3, 11]].forEach(([dx, y], k) => {
          if ((t + k) % 3 === 0) return;
          const x = 16 + Math.round(sw * (y < 13 ? 0.8 : y < 18 ? 0.55 : 0.25)) + dx;
          if (buf[y * W + x]) api.px(x, y, '#e8f2ff');
        });
        if (buf[9 * W + cx3]) api.px(cx3, 9, '#e8f2ff');
      } else if (variant === 2) { // bush: canopy shifts + berry glint phase
        /* Two concentric ellipses read as a green egg. Real shrubbery is a
           clutch of clumps at different heights with woody stems showing in
           the gaps at the base — and the gaps are what sell it. */
        const BS = '#1e4a35', B = '#357a4f', BHi = '#4f9e5a', BLit = '#79d165';
        for (const [x, h] of [[11, 24], [15, 22], [19, 25], [13, 26], [18, 26]])
          api.line(x, 28, x + (x < 16 ? -1 : 1), h, '#3d2b22', 1);
        const clump = (cx, cy, rx, ry, lit) => {
          api.ellipse(X(cx) - rx, cy - ry, X(cx) + rx, cy + ry, BS, true);
          api.ellipse(X(cx) - rx, cy - ry, X(cx) + rx, cy + ry - 2, lit ? B : BS, true);
          api.ellipse(X(cx) - rx + 1, cy - ry + 1, X(cx) + rx - 2, cy + ry - 4, lit ? BHi : B, true);
          if (lit) api.ellipse(X(cx) - rx + 2, cy - ry + 1, X(cx) + rx - 5, cy + ry - 7, BLit, true);
        };
        clump(21, 23, 6, 5, false); clump(9, 23, 6, 5, true);
        clump(16, 21, 7, 6, true); clump(13, 25, 6, 4, false);
        for (let y = 15; y < 28; y++) for (let x = 3; x < 29; x++)
          if (api.hash(x, y, 41) > 0.94 && buf[y * W + x]) api.px(x, y, BS);
        [[10, 22], [18, 20], [14, 25], [22, 24]].forEach(([bx, by], k) => {
          api.px(X(bx), by, '#c42430'); api.px(X(bx) + 1, by, '#e43b44');
          if ((t + k) % 3 === 0) api.px(X(bx) + 1, by - 1, '#f6757a');
        });
      } else if (variant === 3) { // rock: still
        /* Boulders are faceted, not blobby: a flat top plane catching the sky,
           two side planes falling away at different values, and a chipped
           corner so the silhouette is not a perfect egg. */
        const R = '#7a89a4', RHi = '#c0cbdc', RMid = '#96a3ba', RSh = '#4d5a76', RDk = '#333d52';
        api.ellipse(6, 17, 25, 28, R, true);
        api.ellipse(6, 23, 25, 28, RSh, true);               // base in shadow
        api.ellipse(8, 17, 21, 23, RMid, true);              // top plane
        api.ellipse(9, 17, 18, 21, RHi, true);               // sky-facing facet
        api.line(18, 18, 24, 24, RSh, 1);                    // facet break
        api.line(12, 22, 9, 27, RSh, 1);
        api.line(19, 19, 23, 26, RDk, 1);
        api.px(22, 20, RDk); api.px(23, 21, RDk);            // chipped corner
        for (let y = 17; y < 28; y++) for (let x = 6; x < 26; x++)
          if (api.hash(x, y, 57) > 0.93 && buf[y * W + x]) api.px(x, y, RDk);
        api.px(10, 19, '#e4ecf7'); api.px(11, 18, '#e4ecf7');  // specular
        for (const [gx, gy] of [[7, 27], [24, 27], [15, 28]]) api.px(gx, gy, '#3e8948');  // grass at the foot
      } else if (variant === 4) { // flowers: stems bend, heads bob
        /* Four-pixel squares on hairline stems. Flowers need PETALS — a ring
           around a centre — and leaves on the stems, or they are pushpins. */
        const ST = '#3e8948', STd = '#265c42', LEAF = '#63c74d';
        [[10, 16, '#e43b44', '#f6757a'], [21, 14, '#e4e9f7', '#ffffff'],
         [15, 19, '#c06fd8', '#e5a4f0']].forEach(([hx, hy, c, hi], k) => {
          const bx = 12 + k * 3, x = hx + sw, y = hy + (k === 1 ? -sw : sw);
          api.line(bx, 28, x, y + 3, k === 1 ? STd : ST, 1);
          api.line(bx + (x > bx ? 1 : -1), 24 - k, x - (x > bx ? 2 : -2), 23 - k, LEAF, 1);  // leaf
          api.px(x - 1, y - 1, c); api.px(x + 1, y - 1, c);   // petal ring
          api.px(x - 2, y + 1, c); api.px(x + 2, y + 1, c);
          api.rect(x - 2, y, x + 2, y, c); api.rect(x - 1, y + 1, x + 1, y + 1, c);
          api.px(x, y - 2, hi); api.px(x - 1, y - 1, hi);
          api.px(x, y, '#fee761'); api.px(x, y + 1, '#f77622');  // pollen centre
        });
        api.rect(13, 26, 19, 28, '#265c42');                  // foliage at the base
        api.px(13, 26, LEAF); api.px(18, 26, LEAF);
      } else { // grass tuft: blades lean side to side
        /* Five identical straight lines is a barcode. Blades taper, curve, and
           fan out from one clump — no two the same length or lean. */
        const lean = sw === 0 ? 1 : -1;
        const blades = [[-6, 24, 1], [-3, 20, 2], [0, 17, 1], [3, 19, 2], [6, 23, 1], [-1, 22, 1], [4, 25, 1]];
        blades.forEach(([dx, top, wgt], k) => {
          const c = k % 2 ? '#63c74d' : '#3e8948';
          const bx = 16 + Math.round(dx * 0.5), tip = 16 + dx + lean * (k % 3 ? 2 : 1);
          api.line(bx, 28, Math.round((bx + tip) / 2), (top + 28) >> 1, c, wgt);
          api.line(Math.round((bx + tip) / 2), (top + 28) >> 1, tip, top, c, 1);
          api.px(tip, top, k % 2 ? '#95e06c' : '#63c74d');
        });
        api.rect(12, 27, 20, 28, '#265c42');                  // root clump
      }
      finishProps(buf, W, H);
    };
    // [state, variant, sway-table, fps] — frame 0 is always the rest pose (sw 0)
    const defs = [
      ['oak', 0, [0, 1, 0, -1], 5], ['pine', 1, [0, 1, 0, -1], 5],
      ['bush', 2, [0, 1, -1], 6], ['rock', 3, [0], 1],
      ['flowers', 4, [0, 1, -1], 6], ['tuft', 5, [0, 1], 6]];
    return { width: 32, height: 32, name: 'flora', layers: [{ name: 'Body' }],
      states: defs.map(([n, v, table, fps]) => D(n, fps, true,
        table.map((sw, t) => Fr(v === 3 ? 500 : ms(fps), paintTree(v, sw, t))))) };
  }

  /* ---------- CAMPFIRE (animated) ---------- */
  function campfireSuite() {
    const frames = [];
    for (let t = 0; t < 4; t++) {
      frames.push(Fr(ms(8), (buf, W, H) => {
        const api = apiFor(buf, W, H);
        // stones ring
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2;
          api.rect(Math.round(16 + Math.cos(a) * 9) - 1, 25 + Math.round(Math.sin(a) * 3), Math.round(16 + Math.cos(a) * 9) + 1, 27 + Math.round(Math.sin(a) * 3), '#8b9bb4');
        }
        // logs
        api.line(9, 25, 23, 23, '#733e39', 2);
        api.line(9, 23, 23, 25, '#b86f50', 2);
        // flames: 3 layered ellipses flickering with sine
        const f1 = Math.sin(t * 1.7) * 2, f2 = Math.cos(t * 2.3) * 2;
        api.ellipse(11, 12 + f1 * 0.4, 21, 24, '#f77622', true);
        api.ellipse(12 + f2 * 0.3, 15, 20, 24, '#feae34', true);
        api.ellipse(14, 18 + f1 * 0.3, 18, 24, '#fee761', true);
        api.px(16, 20, '#ffffff');
        // sparks
        for (let i = 0; i < 3; i++) {
          const x = 12 + ((t * 5 + i * 7) % 9), y = 10 - ((t * 3 + i * 2) % 6);
          api.px(x, y, '#fee761');
        }
        finishProps(buf, W, H);
      }));
    }
    return { width: 32, height: 32, name: 'campfire', layers: [{ name: 'Body' }], states: [D('burn', 8, true, frames)] };
  }

  /* ---------- TORCH ---------- */
  function torchSuite() {
    const frames = [];
    for (let t = 0; t < 4; t++) {
      frames.push(Fr(ms(8), (buf, W, H) => {
        const api = apiFor(buf, W, H);
        api.rect(14, 14, 17, 28, '#733e39');
        api.rect(16, 14, 17, 28, '#3e2731');
        api.rect(13, 12, 18, 15, '#3e2731');
        // the old sway was a fractional sine rounded away to zero, so all four
        // frames were identical; use whole-pixel offsets and a height beat
        const w = Math.round(Math.sin(t * 1.57) * 2), h = [0, 1, 2, 1][t];
        api.ellipse(11 + w, 2 + h, 20 + w, 13 + h, '#f77622', true);
        api.ellipse(13 + w, 5 + h, 18 + w, 13, '#fee761', true);
        api.px(15 + w, 8 + h, '#ffffff');
        api.px(14 + w, 4 + h, '#fff6c9');
        finishProps(buf, W, H);
      }));
    }
    return { width: 32, height: 32, name: 'torch', layers: [{ name: 'Body' }], states: [D('burn', 8, true, frames)] };
  }

  /* ---------- CHEST ---------- */
  function chestSuite() {
    /* The old chest was three stacked rectangles: a brown box, a darker brown
       band for a lid and a gold bar for a lock. Nothing about it was a chest
       rather than a crate, a book or a bench. A treasure chest reads from four
       things — a DOMED lid, iron bands wrapping from lid to body, vertical
       plank seams, and feet lifting it off the ground — and the open state has
       to show a cavity with something in it, not just a lid that slid upward. */
    const WD = '#8a5a3b', WDh = '#b07c4e', WDs = '#5e3a24', WDss = '#3c2416';
    const IR = '#6b7285', IRh = '#98a1b8', IRs = '#3b4152';
    const GOLD = '#feae34', GOLDh = '#fee761', GOLDs = '#c06a1e';

    const body = api => {
      api.rect(5, 17, 26, 26, WD);
      for (let x = 7; x < 26; x += 4) api.rect(x, 18, x, 25, WDs);   // plank seams
      api.rect(5, 17, 26, 17, WDh);                                   // lit upper lip
      api.rect(5, 25, 26, 26, WDs);
      api.rect(26, 17, 26, 26, WDss);
      for (const bx of [8, 21]) { api.rect(bx, 17, bx + 1, 26, IR); api.rect(bx, 17, bx, 26, IRh); }
      api.rect(5, 26, 26, 27, IRs);                                   // iron foot rail
      api.rect(6, 27, 8, 28, IRs); api.rect(23, 27, 25, 28, IRs);     // feet
      api.px(6, 27, IR); api.px(23, 27, IR);
    };
    /* Lid rows: inset per row, so the top is narrower than the mouth and the
       thing is a barrel top rather than another brick. */
    const LIDIN = [5, 3, 2, 1, 0, 0];
    const lid = (api, y0, flat) => {
      for (let i = 0; i < LIDIN.length; i++) {
        const y = y0 + (flat ? Math.round(i * 0.6) : i);
        const a = 5 + LIDIN[i], b = 26 - LIDIN[i];
        api.rect(a, y, b, y, i < 2 ? WDh : WD);
        api.px(b, y, WDs);
      }
      const bot = y0 + (flat ? 3 : 5);
      api.rect(5, bot, 26, bot, WDss);                                // shadow under the rim
      for (const bx of [8, 21]) for (let i = 0; i < LIDIN.length; i++) {
        const y = y0 + (flat ? Math.round(i * 0.6) : i);
        if (5 + LIDIN[i] <= bx) { api.rect(bx, y, bx + 1, y, IR); api.px(bx, y, IRh); }
      }
    };
    const lock = (api, y) => {
      api.rect(13, y, 18, y + 5, IR);
      api.rect(13, y, 18, y, IRh); api.rect(13, y + 5, 18, y + 5, IRs);
      api.rect(14, y + 1, 17, y + 4, GOLD);
      api.rect(14, y + 1, 17, y + 1, GOLDh); api.rect(14, y + 4, 17, y + 4, GOLDs);
      api.px(15, y + 2, '#181425'); api.px(16, y + 2, '#181425'); api.px(15, y + 3, '#181425');
    };
    /* The cavity runs all the way from the lid's bottom row down to the rim.
       Drawn as a floating gap instead, the thrown-back lid becomes its own
       island and the outline pass rims it into a brick hovering over the box. */
    const hoard = (api, lidBot) => {
      const base = 16;                                                 // the front rim: you see INTO the box, not through its front wall
      const avail = base - lidBot - 1;
      api.rect(6, lidBot + 1, 25, base, '#241811');
      api.rect(6, lidBot + 1, 6, base, '#1a110d'); api.rect(25, lidBot + 1, 25, base, '#1a110d');
      api.rect(6, lidBot + 1, 25, lidBot + 1, '#1a110d');              // shadow cast by the lid
      for (let x = 7; x < 25; x++) {                                   // a MOUND of coin, not a picket fence
        const h = Math.max(1, Math.min(avail, 2 + Math.round(3 * Math.sin(((x - 6) / 18) * Math.PI)) - ((x * 5) % 2)));
        api.rect(x, base - h, x, base, GOLDs);
        api.rect(x, base - h, x, base - h, GOLD);
        if ((x + h) % 4 === 0) api.px(x, base - h, GOLDh);
      }
      for (const [dx, dy] of [[10, 3], [15, 4], [20, 3], [13, 1]]) {   // loose coins riding the crest
        const cy = base - Math.min(avail - 1, dy);
        if (cy <= lidBot) continue;
        api.rect(dx, cy, dx + 1, cy, GOLDh); api.px(dx + 2, cy, GOLDs);
      }
    };

    const closed = (buf, W, H) => {
      const api = apiFor(buf, W, H);
      body(api); lid(api, 10, false); lock(api, 15);
      finishProps(buf, W, H);
    };
    const ajar = (buf, W, H) => {
      const api = apiFor(buf, W, H);
      body(api); hoard(api, 12); lid(api, 9, true); lock(api, 12);
      finishProps(buf, W, H);
    };
    const wide = spark => (buf, W, H) => {
      const api = apiFor(buf, W, H);
      body(api); hoard(api, 5);
      lid(api, 2, true);                                               // thrown back on its hinges
      api.rect(5, 5, 26, 5, WDss);                                     // underside of the lid
      api.rect(13, 6, 18, 7, IR); api.px(15, 6, IRh);                  // lock hanging from it
      api.rect(13, 18, 18, 20, IR); api.rect(14, 19, 17, 19, GOLD);    // strike plate on the front
      api.px(15, 11, '#ffffff'); api.px(21, 13, '#fee761');
      if (spark) PF.Pixel.sparks(api, 16, 12, 1, '#fee761', 6, 2, 5);
      finishProps(buf, W, H);
    };
    return { width: 32, height: 32, name: 'chest', layers: [{ name: 'Body' }], states: [
      D('closed', 1, true, [Fr(500, closed)]),
      D('open', 8, false, [Fr(ms(8), closed), Fr(ms(8), ajar), Fr(ms(8), wide(true)), Fr(ms(8), wide(false))])
    ] };
  }

  /* ---------- DOOR + PORTAL ---------- */
  function doorSuite() {
    /* Two nested rectangles with four scratches across them and a yellow dot
       for a handle. Rebuilt as a real doorway: a round stone arch on jambs,
       a planked timber leaf hung inside it, iron straps with rivets, and a
       ring pull on a backplate. The open state swings the leaf INWARD and
       shows the dark beyond it — the old one just recoloured the rectangle
       cyan, which read as a swimming pool standing on end. */
    const ST = '#79839b', SThi = '#a8b2c6', STsh = '#4e5870', STdk = '#343c52';
    const WD = '#7a4a2e', WDh = '#a06a41', WDs = '#553119', WDss = '#3a2011';
    const IR = '#5d6478', IRh = '#8e97ad', IRs = '#333a4c';
    const OHW = (y, r) => y < 14 ? Math.round(Math.sqrt(Math.max(0, r * r - (y - 14) * (y - 14)))) : r;

    const frame = api => {
      for (let y = 1; y <= 28; y++) {
        const hw = OHW(y, 13);
        if (!hw) continue;
        api.rect(16 - hw, y, 15 + hw, y, ST);
        api.rect(16 - hw, y, 17 - hw, y, SThi);                 // sunlit outer edge
        api.px(15 + hw, y, STsh);
      }
      for (let y = 16; y < 28; y += 4) {                        // jamb courses
        api.rect(3, y, 7, y, STsh); api.rect(24, y, 28, y, STdk);
      }
      for (let k = -4; k <= 4; k++) {                           // voussoir joints around the arch
        const a = k * 0.19, sn = Math.sin(a), cs = Math.cos(a);
        api.line(Math.round(16 - sn * 8.5), Math.round(14 - cs * 8.5),
          Math.round(16 - sn * 13), Math.round(14 - cs * 13), STsh, 1);
      }
      api.rect(14, 0, 17, 3, ST); api.rect(14, 0, 15, 3, SThi); // keystone
      api.px(17, 3, STdk);
      api.rect(2, 27, 29, 28, STsh);                            // threshold
      api.rect(2, 27, 29, 27, ST);
    };
    const leaf = api => {
      for (let y = 6; y <= 27; y++) {
        const hw = OHW(y, 8);
        if (!hw) continue;
        api.rect(16 - hw, y, 15 + hw, y, y < 10 ? WDh : WD);   // the arched head catches the light
        api.px(16 - hw, y, WDs); api.px(15 + hw, y, WDs);
      }
      for (const px2 of [11, 15, 19]) {                         // plank seams, each lit on its near side
        const top = 14 - Math.round(Math.sqrt(Math.max(0, 63 - (px2 - 15.5) * (px2 - 15.5))));
        api.rect(px2, top, px2, 27, WDs);
        api.rect(px2 + 1, top + 1, px2 + 1, 27, WDh);
      }
      /* Straps have to stop where the leaf stops. Run to a fixed x and their
         ends stick out past the arched head onto the stonework, which reads as
         two grey shelves bolted to the wall. */
      for (const by of [11, 21]) {
        const h0 = OHW(by, 8), h1 = OHW(by + 1, 8);
        api.rect(16 - h0, by, 15 + h0, by, IRh);
        api.rect(16 - h1, by + 1, 15 + h1, by + 1, IRs);
        for (let x = 17 - h0; x < 15 + h0; x += 4) api.px(x, by, '#cdd4e2');   // rivets
        api.rect(16 - h0, by - 1, 18 - h0, by - 1, IR);          // hinge lug on the hanging side
        api.rect(16 - h1, by + 2, 18 - h1, by + 2, IRs);
      }
      api.rect(17, 15, 22, 19, IRs);                            // handle backplate
      api.rect(17, 15, 22, 15, IR);
      api.px(19, 16, IRh); api.px(20, 16, IRh);                 // the ring
      api.px(18, 17, IRh); api.px(21, 17, IRh);
      api.px(19, 18, IR); api.px(20, 18, IR);
      api.px(20, 14, '#cdd4e2');                                // boss above it
    };
    /* Swung inward: `t` is 0 at closed and 1 at flat against the jamb. The
       leaf narrows toward the hinge side and the gap behind it fills with the
       dark of whatever room this opens onto. */
    const swung = t => api => {
      for (let y = 6; y <= 27; y++) {
        const hw = OHW(y, 8);
        if (!hw) continue;
        api.rect(16 - hw, y, 15 + hw, y, '#120e1c');            // the dark beyond
        if (y > 22) api.rect(16 - hw, y, 15 + hw, y, '#1d1726');  // floor catches a little light
      }
      const w = Math.round(14 * (1 - t)) + 2;
      for (let y = 7; y <= 26; y++) {
        const hw = OHW(y, 8);
        if (hw < 2) continue;
        const x0 = 16 - hw, x1 = Math.min(15 + hw, x0 + w);
        api.rect(x0, y, x1, y, t > 0.6 ? WDs : WD);
        api.px(x0, y, WDss);
        api.rect(x1, y, x1, y, WDh);                            // the lit inner edge of the leaf
      }
      for (let k = 1; k * 4 < w; k++) {                         // planks compress toward the hinge
        const sx = 16 - 8 + Math.round(k * 4 * (1 - t * 0.5));
        api.rect(sx, 9, sx, 26, t > 0.6 ? WDss : WDs);
      }
      for (const by of [11, 21]) {
        const h0 = OHW(by, 8), x0 = 16 - h0, x1 = Math.min(15 + h0, x0 + w);
        api.rect(x0, by, x1, by, t > 0.6 ? IR : IRh);
        api.rect(x0, by + 1, x1, by + 1, IRs);
        api.px(x1, by, '#cdd4e2');
      }
      if (t > 0.6) { api.px(19, 24, '#f77622'); api.px(20, 25, '#feae34'); }  // firelight inside
    };

    const paint = inner => (buf, W, H) => {
      const api = apiFor(buf, W, H);
      frame(api); inner(api);
      finishProps(buf, W, H);
    };
    return { width: 32, height: 32, name: 'door', layers: [{ name: 'Body' }], states: [
      D('closed', 1, true, [Fr(500, paint(leaf))]),
      D('open', 8, false, [Fr(ms(8), paint(leaf)), Fr(ms(8), paint(swung(0.35))),
        Fr(ms(8), paint(swung(0.75))), Fr(ms(8), paint(swung(1)))])
    ] };
  }
  function portalSuite() {
    const frames = [];
    for (let t = 0; t < 4; t++) {
      frames.push(Fr(ms(8), (buf, W, H) => {
        const api = apiFor(buf, W, H);
        // stone pillars
        api.rect(4, 6, 8, 28, '#5a6988'); api.rect(23, 6, 27, 28, '#5a6988');
        api.rect(3, 3, 9, 6, '#8b9bb4'); api.rect(22, 3, 28, 6, '#8b9bb4');
        // swirling gate: concentric ellipses offset by sine
        const s = Math.sin(t * Math.PI / 2);
        api.ellipse(9, 6, 22, 28, '#2a0fa8', true);
        api.ellipse(11, 8 + s, 20, 26, '#5a38f0', true);
        api.ellipse(13, 10 - s, 18, 24, '#2ce8f5', true);
        api.ellipse(14, 12 + s, 17, 22, '#ffffff', true);
        finishProps(buf, W, H);
      }));
    }
    return { width: 32, height: 32, name: 'portal', layers: [{ name: 'Body' }], states: [D('swirl', 8, true, frames)] };
  }

  /* ---------- WATER TILE (separate animated) ---------- */
  function waterSuite() {
    return { width: 32, height: 32, name: 'water', layers: [{ name: 'Water' }],
      states: [D('flow', 6, true, [0, 1, 2, 3].map(t => Fr(ms(6), waterFrame(t))))] };
  }

  /* ---------- MAGIC CRYSTAL NODE ---------- */
  function crystalFrame(pulse, hit, shatter) {
    return (buf, W, H) => {
      const api = apiFor(buf, W, H), cx = 16;
      if (shatter) {
        api.ellipse(9, 23, 23, 27, '#5a6988', true);
        api.ellipse(11, 24, 21, 26, '#3a4466', true);
        PF.Pixel.sparks(api, cx, 22, shatter, '#2ce8f5', 6, 4, 10);
        api.px(8, 25, '#c0cbdc'); api.px(24, 25, '#c0cbdc');
        finishProps(buf, W, H); return;
      }
      api.ellipse(8, 21, 24, 27, '#5a6988', true);
      api.ellipse(10, 23, 22, 26, '#3a4466', true);
      const p = pulse !== undefined ? Math.sin(pulse * Math.PI / 2) * 1.5 : 0;
      const C1 = '#2ce8f5', C2 = '#0099db', C3 = '#124e89', Hi = '#ffffff';
      api.line(cx, 6 - p, cx - 4, 22, C2, 2);
      api.line(cx, 6 - p, cx + 4, 22, C3, 2);
      api.line(cx, 6 - p, cx, 22, C1, 2);
      api.line(cx - 1, 7 - p, cx - 1, 18, Hi, 1);
      api.line(cx - 5, 12 - p * 0.5, cx - 8, 23, C2, 2);
      api.line(cx - 5, 12 - p * 0.5, cx - 3, 23, C1, 1);
      api.line(cx + 5, 14 - p * 0.5, cx + 8, 23, C3, 2);
      api.line(cx + 5, 14 - p * 0.5, cx + 3, 23, C1, 1);
      if (pulse === 1 || pulse === 3) {
        api.px(cx, 5 - p, Hi);
        api.px(cx - 6, 11 - p * 0.5, Hi);
        api.px(cx + 6, 13 - p * 0.5, Hi);
      }
      if (hit) PF.Pixel.sparks(api, cx, 14, 2, '#2ce8f5', 8, 2, 7);
      finishProps(buf, W, H);
    };
  }
  function crystalSuite() {
    return { width: 32, height: 32, name: 'crystal', layers: [{ name: 'Props' }], states: [
      D('pulse', 6, true, [0, 1, 2, 3].map(t => Fr(ms(6), crystalFrame(t)))),
      D('hit', 8, true, [Fr(ms(8), crystalFrame(0, true)), Fr(ms(8), crystalFrame(1, true)), Fr(ms(8), crystalFrame(0))]),
      D('shatter', 8, false, [Fr(ms(8), crystalFrame(0, true)), Fr(ms(8), crystalFrame(undefined, false, 1)), Fr(ms(8), crystalFrame(undefined, false, 2)), Fr(ms(8), crystalFrame(undefined, false, 3))])
    ] };
  }

  return { tilesetSuite, floraSuite, campfireSuite, torchSuite, chestSuite, doorSuite, portalSuite, waterSuite, crystalSuite };
})();

