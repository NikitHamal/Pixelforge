/* PixelForge Studio — RPG World pack: dungeon tileset, village props,
   dungeon props, rune savepoint, waterfall, lava. 16px tiles + 32px props. */
window.PF = window.PF || {};
PF.RPG = PF.RPG || {};
PF.RPG.world = (() => {
  const P = () => PF.Pixel;
  const D = (name, fps, loop, frames) => ({ name, fps, loop, frames });
  const Fr = (duration, paint) => ({ duration, paint });
  const ms = fps => Math.round(1000 / fps);
  const R = PF.RPG;
  const apiFor = (buf, W, H) => P().makeApi(buf, W, H);
  const TAU = Math.PI * 2;
  const OUT = '#181425';
  const OUT32 = PF.Color.hexToU32(OUT); // cached: one lookup, not one per frame
  const finish = buf => buf.set(PF.Raster.outline(buf, 32, 32, OUT32));
  const speck = (api, x0, y0, x1, y1, seed, colors, density = 0.16) => {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++)
      if (api.hash(x, y, seed) < density) api.px(x, y, colors[Math.floor(api.hash(x + 9, y + 3, seed) * colors.length) % colors.length]);
  };

  /* ================= DUNGEON TILESET 64x64 (16 tiles) ================= */
  // v = animation variant: only lava + water tiles differ, so frame 2 is a
  // cheap overdraw of 2 tiles and the sheet stays slicer-safe (game uses frame 0).
  function tileFrame(idx, v = 0) {
    return (buf, W, H) => {
      const api = apiFor(buf, W, H);
      const tx = (idx % 4) * 16, ty = Math.floor(idx / 4) * 16;
      const X = x => tx + x, Y = y => ty + y;
      const R16 = (x0, y0, x1, y1, c) => api.rect(X(x0), Y(y0), X(x1), Y(y1), c);
      const P16 = (x, y, c) => api.px(X(x), Y(y), c);
      const HS = (x, y, s) => api.hash(X(x), Y(y), s);
      const ST = ['#e8ecf5', '#c0cbdc', '#8b9bb4', '#5a6988', '#3a4466', '#262b44', '#181425'];

      /* Cut flagstones with a bevel on each, laid so the joints fall on the
         tile edge and the sheet still butts to itself. A field of two-tone
         speckle over flat grey is gravel, not a floor. */
      const SLABS = [[1, 1, 7, 7], [9, 1, 15, 7], [1, 9, 9, 15], [11, 9, 15, 15]];
      const flag = (seed) => {
        R16(0, 0, 15, 15, ST[5]);
        SLABS.forEach(([x0, y0, x1, y1], k) => {
          R16(x0, y0, x1, y1, ST[3]);
          R16(x0, y0, x1, y0, ST[2]); R16(x0, y0, x0, y1, ST[2]);       // lit top and left
          R16(x0, y1, x1, y1, ST[4]); R16(x1, y0, x1, y1, ST[4]);       // shaded foot and right
          for (let y = y0 + 1; y < y1; y++) for (let x = x0 + 1; x < x1; x++) {
            const n = HS(x, y, seed + k);
            if (n < 0.09) P16(x, y, ST[2]); else if (n < 0.2) P16(x, y, ST[4]);
          }
        });
      };
      const joint = (x, y) => Math.min(
        Math.abs(x - 0), Math.abs(x - 8), Math.abs(x - 10), Math.abs(x - 15),
        Math.abs(y - 0), Math.abs(y - 8), Math.abs(y - 15));

      const brick = (base, mort, hi, lo, sd) => {
        R16(0, 0, 15, 15, mort);
        for (let r = 0; r < 4; r++) {
          const y0 = r * 4, off = r % 2 ? 4 : 0;
          for (let b = -1; b < 3; b++) {
            const x0 = b * 8 + off;
            R16(x0 + 1, y0 + 1, x0 + 7, y0 + 3, base);
            R16(x0 + 1, y0 + 1, x0 + 7, y0 + 1, hi);                    // a bevel on every course
            R16(x0 + 1, y0 + 3, x0 + 7, y0 + 3, lo);
            for (let x = x0 + 2; x <= x0 + 6; x++) if (HS(x, y0 + 2, sd + r) < 0.22) P16(x, y0 + 2, lo);
          }
        }
      };

      switch (idx) {
        case 0: flag(11); break;
        case 1: {                                                       // cracked
          flag(11);
          /* An authored break with two branches. A pair of ruled diagonals
             read as scratches on the paint. */
          const CR = [[1, 0], [4, 4], [3, 7], [7, 10], [6, 15]];
          for (let k = 0; k < CR.length - 1; k++) {
            api.line(X(CR[k][0]), Y(CR[k][1]), X(CR[k + 1][0]), Y(CR[k + 1][1]), ST[6], 1);
          }
          api.line(X(4), Y(4), X(9), Y(2), ST[6], 1);
          api.line(X(7), Y(10), X(13), Y(12), ST[6], 1);
          api.line(X(13), Y(12), X(15), Y(9), ST[5], 1);
          for (const [cx, cy] of CR) P16(cx + 1, cy, ST[4]);            // a lit lip
          break;
        }
        case 2: {                                                       // mossy
          flag(11);
          /* Moss creeps out of the joints and gathers in corners. Sprayed
             evenly it was green confetti thrown over the floor. */
          for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
            const d = joint(x, y);
            if (d > 3) continue;
            if (HS(x, y, 31) > 0.62 - d * 0.16) continue;
            P16(x, y, d < 1 ? '#265c42' : HS(x, y, 33) < 0.5 ? '#3e8948' : '#265c42');
          }
          for (const [cx, cy, r] of [[3, 12, 3], [12, 3, 2]]) {
            api.ellipse(X(cx - r), Y(cy - r), X(cx + r), Y(cy + r), '#265c42', true);
            api.ellipse(X(cx - r), Y(cy - r), X(cx + r - 1), Y(cy), '#3e8948', true);
            P16(cx - 1, cy - 1, '#63c74d');
          }
          break;
        }
        case 3: {                                                       // rune floor
          flag(11);
          for (let a2 = 0; a2 < TAU; a2 += 0.06) {                      // an incised ring
            const cx = 7.5 + Math.cos(a2) * 6, cy = 7.5 + Math.sin(a2) * 6;
            P16(cx, cy, Math.sin(a2) < 0 ? ST[5] : ST[2]);
            P16(7.5 + Math.cos(a2) * 5, 7.5 + Math.sin(a2) * 5, '#124e89');
          }
          const SIG = ['00100', '01110', '10101', '00100', '01010'];    // and a sigil in it
          for (let r = 0; r < 5; r++) for (let q = 0; q < 5; q++) {
            if (SIG[r][q] === '1') P16(5 + q, 5 + r, r < 2 ? '#2ce8f5' : '#0099db');
          }
          P16(7, 6, '#ffffff');
          break;
        }
        case 4: brick('#733e39', '#3e2731', '#b86f50', '#5c3a2a', 2); break;
        case 5:                                                         // mossy brick
          brick('#5c4a5a', '#3e2731', '#8b7b8b', '#402f42', 4);
          for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
            const d = Math.min(Math.abs((y % 4) - 0), 3);
            if (HS(x, y, 51) > 0.34 - d * 0.08) continue;
            P16(x, y, HS(x, y, 53) < 0.5 ? '#3e8948' : '#265c42');
          }
          break;
        case 6:                                                         // pillar segment
          R16(0, 0, 15, 15, ST[5]);
          for (let x = 2; x <= 13; x++) {
            const u = (x - 2) / 11, c = Math.cos((u - 0.3) * 2.6);
            R16(x, 0, x, 15, c > 0.9 ? ST[1] : c > 0.62 ? ST[2] : c > 0.2 ? ST[3] : ST[4]);
          }
          /* Two flutes, each a shadow with its own catch of light. Three
             evenly spaced dark rules were a barcode printed on the stone. */
          for (const fx of [5, 10]) { R16(fx, 0, fx, 15, ST[5]); R16(fx + 1, 0, fx + 1, 15, ST[2]); }
          for (let y = 0; y < 16; y++) if (HS(4, y, 61) < 0.14) P16(4, y, ST[3]);
          break;
        case 7: {                                                       // lava
          /* Crust plates with molten seams, the same construction as the
             lava pool. Two coats of speckle on red was orange static. */
          const pts = [];
          for (let gy = -1; gy <= 2; gy++) for (let gx = -1; gx <= 2; gx++) {
            const jx = api.hash(((gx % 2) + 2) % 2 * 7 + 1, ((gy % 2) + 2) % 2 * 13, 3 + v);
            const jy = api.hash(((gx % 2) + 2) % 2 * 5, ((gy % 2) + 2) % 2 * 11 + 2, 9 + v);
            /* Tone keyed on the cell's place in the repeat, not on its index
               in this list, so the plate keeps its colour across the join. */
            const tone = api.hash(((gx % 2) + 2) % 2 * 3 + 1, ((gy % 2) + 2) % 2 * 5 + 7, 27);
            pts.push([gx * 8 + jx * 7 + 0.5, gy * 8 + jy * 7 + 0.5, tone]);
          }
          for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
            let d1 = 1e9, d2 = 1e9, tone = 0;
            for (const [qx, qy, tn] of pts) {
              const d = Math.hypot(x - qx, y - qy);
              if (d < d1) { d2 = d1; d1 = d; tone = tn; } else if (d < d2) d2 = d;
            }
            /* Seam from the gap between the two nearest plates, crust from
               the distance into one. Ramping a single metric through the
               whole palette lit the plates and shaded the cracks. */
            const w = (d2 - d1) + HS(x, y, 19) * 0.3;
            const t = d1 + HS(x, y * 3, 23) * 0.6;
            P16(x, y, w < 0.14 ? '#ffffff' : w < 0.45 ? '#fee761' : w < 0.9 ? '#f77622'
              : w < 1.3 ? '#a22633' : t > 3.0 ? '#3e2731' : tone < 0.5 ? '#5c3a2a' : '#733e39');
          }
          break;
        }
        case 8:                                                         // water
          R16(0, 0, 15, 15, '#124e89');
          for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {   // depth mottle
            if (HS(x, Math.floor(y / 2), 71) < 0.3) P16(x, y, '#0d3a6b');
          }
          for (const [wy, len, off] of [[3, 7, 1], [8, 5, 9], [12, 6, 4]]) {
            const y = (wy + v + 16) % 16;
            for (let q = 0; q < len; q++) {                             // crests, broken
              const x = (off + q + v * 2) % 16;
              if (HS(x, y, 73) < 0.2) continue;
              P16(x, y, '#0099db'); P16(x, y - 1, q > 1 && q < len - 1 ? '#2ce8f5' : '#0099db');
            }
          }
          P16((5 + v * 3) % 16, (2 + v) % 16, '#ffffff');
          P16((12 + v) % 16, (9 - v + 16) % 16, '#ffffff');
          break;
        case 9: {                                                       // stairs down
          R16(0, 0, 15, 15, ST[6]);
          /* Treads narrowing into the dark, each with a riser under it. A
             stack of centred bars read as a lampshade. */
          const TR = [ST[1], ST[2], ST[2], ST[3], ST[4]];
          const NS = [ST[0], ST[1], ST[2], ST[2], ST[3]];
          for (let st = 0; st < 5; st++) {
            const y0 = st * 3;
            R16(2, y0, 13, y0 + 1, TR[st]);                             // tread, darkening down
            R16(2, y0, 13, y0, NS[st]);                                 // its nosing
            R16(2, y0 + 2, 13, y0 + 2, st < 4 ? ST[5] : ST[6]);         // and the riser under it
            R16(0, y0, 1, y0 + 2, ST[3]); R16(1, y0, 1, y0 + 2, ST[4]); // the walls either side
            R16(14, y0, 15, y0 + 2, ST[5]); R16(14, y0, 14, y0 + 2, ST[4]);
          }
          R16(2, 15, 13, 15, ST[6]);                                    // and the dark it runs into
          break;
        }
        case 10:                                                        // spikes
          flag(11);
          R16(0, 0, 15, 15, ST[4]);
          for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (HS(x, y, 71) < 0.16) P16(x, y, ST[5]);
          /* Squat cones sat in their sockets. Ten rows tall and two wide
             they were four aerials standing on a grey floor. */
          for (const [sx, sy] of [[3, 8], [11, 6], [7, 14], [14, 11]]) {
            api.ellipse(X(sx - 3), Y(sy - 1), X(sx + 3), Y(sy + 2), ST[6], true);  // its socket
            api.ellipse(X(sx - 3), Y(sy - 1), X(sx + 3), Y(sy + 1), ST[5], true);
            for (let k = 0; k <= 6; k++) {                              // and a tapering cone
              const w = Math.round((6 - k) / 2.4);
              R16(sx - w, sy - k, sx + w, sy - k, ST[2]);
              P16(sx - w, sy - k, ST[1]);
              if (w) P16(sx + w, sy - k, ST[4]);
            }
            P16(sx, sy - 6, '#ffffff');
          }
          break;
        case 11:                                                        // grate
          R16(0, 0, 15, 15, ST[6]);
          for (let k = 0; k < 16; k += 4) {
            R16(k, 0, k + 1, 15, ST[3]); R16(k, 0, k, 15, ST[2]);       // bars both ways,
            R16(0, k, 15, k + 1, ST[3]); R16(0, k, 15, k, ST[2]);       // so it reads as a grid
            R16(k + 1, 0, k + 1, 15, ST[4]); R16(0, k + 1, 15, k + 1, ST[4]);
          }
          for (let a2 = 0; a2 < 16; a2 += 4) for (let b2 = 0; b2 < 16; b2 += 4) P16(a2, b2, ST[1]);
          break;
        case 12: {                                                      // bones
          flag(11);
          /* A cranium with two sockets sunk into it and a jaw under it.
             One oval with three dots on it is a potato. */
          const sx = 5, sy = 5;
          api.ellipse(X(sx - 3), Y(sy - 3), X(sx + 3), Y(sy + 2), '#c9b48a', true);
          api.ellipse(X(sx - 3), Y(sy - 3), X(sx + 2), Y(sy + 1), '#ead4aa', true);
          api.ellipse(X(sx - 2), Y(sy - 3), X(sx), Y(sy - 1), '#fff6c9', true);
          R16(sx - 2, sy - 1, sx - 1, sy, ST[6]); R16(sx + 1, sy - 1, sx + 2, sy, ST[6]);
          P16(sx, sy + 1, ST[6]);
          R16(sx - 2, sy + 3, sx + 2, sy + 4, '#c9b48a');               // the jaw
          R16(sx - 2, sy + 3, sx + 2, sy + 3, '#ead4aa');
          for (let q = sx - 2; q <= sx + 2; q += 2) P16(q, sy + 4, ST[5]);
          for (const [x0, y0, x1, y1] of [[9, 13, 15, 9], [9, 9, 15, 13]]) {
            api.line(X(x0), Y(y0), X(x1), Y(y1), '#c9b48a', 2);
            api.line(X(x0), Y(y0), X(x1), Y(y1), '#ead4aa', 1);
            P16(x0, y0, '#fff6c9'); P16(x1, y1, '#fff6c9');
          }
          break;
        }
        case 13:                                                        // carpet
          /* A woven field, a narrow key border and one drawn lozenge. Full
             checkerboard at this size is a picnic cloth, and a filled
             diamond in the middle of it is a fried egg. */
          R16(0, 0, 15, 15, '#7a1c2c');
          R16(2, 2, 13, 13, '#a22633');
          for (let y = 2; y <= 13; y++) for (let x = 2; x <= 13; x++) {
            if ((x * 3 + y) % 7 === 0) P16(x, y, '#b5384a');            // the nap of the weave
          }
          for (let k = 0; k < 16; k++) {                                // a key border
            const on = k % 4 < 2;
            P16(k, 0, on ? '#feae34' : '#7a1c2c'); P16(k, 15, on ? '#7a1c2c' : '#feae34');
            P16(0, k, on ? '#feae34' : '#7a1c2c'); P16(15, k, on ? '#7a1c2c' : '#feae34');
            P16(k, 1, '#5a1522'); P16(k, 14, '#5a1522'); P16(1, k, '#5a1522'); P16(14, k, '#5a1522');
          }
          for (let k = 0; k <= 4; k++) {                                // and the lozenge, outlined
            P16(7 - k, 3 + k, '#fee761'); P16(8 + k, 3 + k, '#feae34');
            P16(7 - k, 12 - k, '#feae34'); P16(8 + k, 12 - k, '#f77622');
          }
          R16(6, 7, 9, 8, '#e43b44'); P16(7, 7, '#fee761'); P16(8, 8, '#f77622');
          break;
        case 14:                                                        // void pit
          for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
            const d = Math.hypot(x - 7.5, y - 7.5) / 10;
            P16(x, y, d > 0.82 ? '#3a2b46' : d > 0.6 ? '#2a1f36' : ST[6]);
          }
          R16(0, 0, 15, 0, '#68386c'); R16(0, 0, 0, 15, '#68386c');     // the lip catching light
          R16(0, 1, 15, 1, '#54254f'); R16(1, 0, 1, 15, '#54254f');
          for (const [x, y, c] of [[4, 6, '#b55088'], [10, 4, '#68386c'], [7, 11, '#b55088'], [12, 12, '#54254f'], [9, 8, '#68386c']]) {
            P16(x, y, c);
          }
          break;
        default:                                                        // chiselled decor floor
          flag(11);
          for (let k = 0; k < 5; k++) {                                 // an incised frame
            R16(3 + k, 3 + k, 12 - k, 3 + k, k ? 0 : ST[5]);
          }
          R16(3, 3, 12, 3, ST[5]); R16(3, 3, 3, 12, ST[5]);
          R16(3, 12, 12, 12, ST[2]); R16(12, 3, 12, 12, ST[2]);
          R16(5, 5, 10, 10, ST[4]);
          R16(5, 5, 10, 5, ST[5]); R16(5, 5, 5, 10, ST[5]);
          R16(5, 10, 10, 10, ST[2]); R16(10, 5, 10, 10, ST[2]);
          R16(7, 6, 8, 9, ST[2]); R16(6, 7, 9, 8, ST[2]);               // a cross boss
          P16(7, 7, ST[1]);
      }
    };
  }
  function dungeonTilesSuite() {
    const frames = [];
    for (let k = 0; k < 16; k++) frames.push(Fr(ms(8), tileFrame(k)));
    // tileset: all 16 tiles composed on ONE 64x64 frame (like reference tileset)
    const paint = (buf, W, H) => {
      const api = apiFor(buf, W, H);
      for (let k = 0; k < 16; k++) tileFrame(k)(buf, W, H);
      void api;
    };
    // frame 2 re-cuts lava + water tiles only: gentle animated shimmer, slicer-safe
    const paint2 = (buf, W, H) => { paint(buf, W, H); tileFrame(7, 1)(buf, W, H); tileFrame(8, 1)(buf, W, H); };
    return { width: 64, height: 64, name: 'rpg-dungeon-tiles', layers: [{ name: 'Tiles' }],
      states: [D('tiles', 6, true, [Fr(ms(6), paint), Fr(ms(6), paint2)])] };
  }

  /* ================= VILLAGE PROPS ================= */
  function villageSuite() {
    const S = (name, fps, painters) => D(name, fps, true, painters.map(p => Fr(ms(fps), p)));
    const WD = ['#e4a672', '#b86f50', '#733e39', '#5c3a2a', '#3e2731'];   // light -> dark timber
    const ST = ['#e8ecf5', '#c0cbdc', '#8b9bb4', '#5a6988', '#3a4466', '#262b44'];

    const cottage = (smoke) => (buf, W, H) => {
      const api = apiFor(buf, W, H);
      /* Plaster between a timber frame, lit from the left. The old wall was
         three brown vertical bars on cream and read as a barcode. */
      api.rect(6, 16, 26, 28, '#ead4aa');
      api.rect(6, 16, 12, 28, '#fff6c9');                               // the lit half
      api.rect(21, 16, 26, 28, '#c28569');                              // and the shaded one
      api.rect(6, 16, 26, 17, WD[2]);                                   // top plate
      api.rect(6, 17, 7, 28, WD[2]); api.rect(25, 17, 26, 28, WD[3]);   // corner posts
      api.rect(6, 27, 26, 28, WD[3]);                                   // sill
      api.line(8, 27, 12, 20, WD[2], 1); api.line(24, 27, 20, 20, WD[2], 1);   // braces

      /* A window with a frame and four panes. A flat yellow square with a
         cross on it is a warning sign, not a lit window. */
      api.rect(8, 19, 12, 24, WD[3]);
      api.rect(9, 20, 11, 23, '#fee761');
      api.px(9, 20, '#fff6c9'); api.px(11, 23, '#feae34');
      api.line(10, 20, 10, 23, WD[3], 1); api.line(9, 21, 11, 21, WD[3], 1);
      api.rect(7, 18, 13, 18, WD[2]);                                   // its lintel

      api.rect(14, 19, 19, 28, WD[2]);                                  // the door
      api.rect(15, 20, 18, 28, '#5c3a2a');
      api.rect(15, 20, 15, 28, '#6b483a');                              // its lit edge
      api.px(17, 24, '#fee761');                                        // the latch
      api.rect(13, 18, 20, 18, WD[3]);                                  // and its lintel

      /* Thatch in courses. Drawn as radiating strands off a ridge line it
         came out as a chequer of orange and black -- a lit brazier. */
      for (let y = 6; y <= 15; y++) {
        const hw = 3 + (y - 6) * 1.4;
        for (let x = Math.round(16 - hw); x <= 16 + hw; x++) {
          const band = (y - 6) % 3;
          let c = band === 0 ? '#fee761' : band === 1 ? '#feae34' : '#f77622';
          if (api.hash(x, y, 5) < 0.3) c = band === 2 ? '#b8621b' : '#feae34';
          api.px(x, y, c);
        }
      }
      for (let x = 2; x <= 30; x++) {                                   // the ragged eaves
        if (x < 16 - 15.6 || x > 16 + 15.6) continue;
        api.px(x, 16, api.hash(x, 1, 9) < 0.5 ? '#b8621b' : null);
      }
      api.rect(19, 6, 22, 12, ST[2]); api.rect(19, 6, 19, 12, ST[1]);   // the chimney
      api.rect(18, 5, 23, 6, ST[3]);                                    // and its cap
      speck(api, 19, 7, 22, 11, 7, [ST[3]], 0.2);

      /* Puffs, pale and separating as they climb. Painted in the chimney's
         own greys and joined end to end it came back as a second length of
         flue pipe bent over the ridge. */
      const sy = smoke ? 0 : 1;
      const puff = (cx, cy, r, c) => {
        for (let y = cy - r; y <= cy + r; y++) for (let x = cx - r; x <= cx + r; x++)
          if (Math.hypot(x - cx, (y - cy) * 1.2) <= r + 0.3) api.px(x, y, c);
      };
      puff(20, 4 - sy, 1, ST[1]);
      puff(18 - sy, 2 - sy * 0.5, 1.6, ST[0]);
      puff(15 - sy, 1, 2, ST[1]);
      finish(buf);
    };

    const well = (buf, W, H) => {
      const api = apiFor(buf, W, H);
      api.rect(9, 6, 10, 21, WD[2]); api.rect(22, 6, 23, 21, WD[3]);    // the two posts
      /* A shingled gable. Two red arcs on sticks read as a fast-food sign. */
      for (let y = 2; y <= 7; y++) {
        const hw = 1 + (y - 2) * 2.2;
        for (let x = Math.round(16 - hw); x <= 16 + hw; x++) {
          api.px(x, y, (y % 2) === ((x >> 1) % 2) ? '#a22633' : '#7a1c2c');
        }
      }
      api.rect(5, 7, 27, 8, WD[3]); api.rect(5, 7, 27, 7, WD[2]);       // the eaves board

      api.rect(10, 9, 22, 10, WD[3]);                                   // the winch roller
      api.rect(10, 9, 22, 9, WD[1]);
      api.rect(23, 9, 25, 9, ST[4]); api.rect(25, 9, 25, 12, ST[4]);    // and its crank
      api.rect(24, 12, 25, 13, WD[2]);

      api.rect(16, 11, 16, 11, WD[4]);                                  // the rope
      /* Hung at the old height the bucket sat half inside the stone rim and
         read as a lump of masonry. It wants clear air under it. */
      api.line(13, 13, 14, 12, ST[4], 1); api.line(19, 13, 18, 12, ST[4], 1);
      api.rect(15, 12, 17, 12, ST[4]);                                  // its bail
      api.rect(13, 13, 19, 18, WD[0]);
      api.rect(18, 13, 19, 18, WD[2]);                                  // shaded stave side
      api.rect(13, 14, 19, 14, ST[4]); api.rect(13, 17, 19, 17, ST[4]); // and its hoops
      api.rect(14, 18, 18, 18, WD[3]);
      api.rect(14, 13, 18, 13, '#0099db');                              // brim full

      /* A drum of laid stone, not a grey puddle. */
      api.ellipse(6, 18, 26, 25, ST[2], true);
      api.rect(7, 21, 25, 27, ST[3]);
      api.ellipse(6, 24, 26, 30, ST[3], true);
      api.ellipse(6, 23, 26, 29, ST[2], true);
      for (let x = 8; x <= 24; x += 4) api.rect(x, 21, x, 27, ST[4]);   // vertical joints
      api.rect(7, 24, 25, 24, ST[4]);                                   // a course line
      api.ellipse(9, 19, 23, 24, ST[5], true);                          // the shaft
      api.ellipse(10, 20, 22, 23, '#124e89', true);
      api.px(13, 21, '#2ce8f5'); api.px(19, 22, '#0099db');
      finish(buf);
    };

    const stall = (buf, W, H) => {
      const api = apiFor(buf, W, H);
      api.rect(5, 9, 7, 28, WD[2]); api.rect(5, 9, 5, 28, WD[1]);       // posts
      api.rect(25, 9, 27, 28, WD[3]);
      api.rect(4, 5, 28, 6, WD[2]);                                     // the awning rail
      for (let x = 4; x <= 28; x++) {                                   // stripes, with a scalloped hem
        const band = Math.floor((x - 4) / 3) % 2;
        const hem = 10 + Math.round(Math.abs(((x - 4) % 3) - 1));
        api.rect(x, 6, x, hem, band ? '#e8ecf5' : '#a22633');
        api.px(x, hem, band ? '#c0cbdc' : '#7a1c2c');
      }
      api.rect(6, 18, 26, 19, '#e4a672');                               // the counter top
      api.rect(6, 19, 26, 23, WD[1]);
      for (let x = 9; x <= 24; x += 5) api.rect(x, 19, x, 23, WD[2]);   // plank seams
      api.rect(6, 23, 26, 23, WD[3]);

      api.rect(8, 14, 12, 17, WD[2]);                                   // a crate of apples
      api.rect(9, 15, 11, 17, WD[1]);
      api.px(9, 14, '#e43b44'); api.px(11, 14, '#e43b44'); api.px(10, 13, '#e43b44');
      api.px(10, 12, '#3e8948');
      api.ellipse(14, 14, 18, 17, '#3e8948', true);                     // a melon
      api.rect(15, 14, 15, 17, '#265c42'); api.rect(17, 14, 17, 17, '#265c42');
      api.px(16, 13, '#733e39');
      api.rect(20, 15, 24, 17, '#e4a672');                              // and two loaves
      api.rect(20, 15, 24, 15, '#feae34');
      api.px(21, 16, '#b86f50'); api.px(23, 16, '#b86f50');
      finish(buf);
    };

    const signpost = (buf, W, H) => {
      const api = apiFor(buf, W, H);
      api.rect(14, 6, 17, 28, WD[2]);                                   // the post
      api.rect(14, 6, 14, 28, WD[1]); api.rect(17, 6, 17, 28, WD[3]);
      for (let y = 8; y <= 26; y += 4) api.px(15, y, WD[3]);            // grain
      api.rect(13, 5, 18, 6, WD[3]);                                    // its cap
      /* Boards that come to a point, with cut lettering on them. Two plain
         rectangles on a stick is a signpost the way a T is a signpost. */
      const board = (x0, x1, y0, dir) => {
        /* The point has to be cut as the board is laid down. Shading two
           corner pixels afterwards leaves a rectangle with two dark dots on
           it, and both arms read as plain planks. */
        for (let r = 0; r <= 4; r++) {
          const cut = [3, 1, 0, 1, 3][r];
          const a = dir < 0 ? x0 + cut : x0, b = dir < 0 ? x1 : x1 - cut;
          api.rect(a, y0 + r, b, y0 + r, r === 0 ? WD[0] : r === 4 ? WD[3] : WD[1]);
        }
        for (let x = x0 + 4; x <= x1 - 4; x += 2) api.px(x, y0 + 2, WD[3]);
      };
      board(4, 14, 9, -1);
      board(17, 27, 15, 1);
      for (let x = 11; x <= 21; x++) {                                  // grass at the foot
        const h = 1 + Math.round(api.hash(x, 3, 11) * 2);
        api.rect(x, 28 - h, x, 28, h > 2 ? '#3e8948' : '#265c42');
      }
      finish(buf);
    };

    const lamp = (flick) => (buf, W, H) => {
      const api = apiFor(buf, W, H);
      /* A dim wash on the flags. Two bright browns made a ring with the dark
         foot punched out of it and the base read as a tyre. */
      api.ellipse(9 - (flick ? 2 : 0), 26, 23 + (flick ? 2 : 0), 30, '#6b5a53', true);
      api.rect(15, 14, 17, 26, ST[4]); api.rect(15, 14, 15, 26, ST[3]); // the post
      api.rect(13, 26, 19, 27, ST[4]); api.rect(12, 27, 20, 28, ST[5]); // its foot
      api.rect(13, 24, 19, 24, ST[3]);                                  // a collar
      api.line(13, 15, 15, 13, ST[3], 1); api.line(19, 15, 17, 13, ST[3], 1);   // scroll arms

      /* Glow as rings strictly outside the housing. Painted as a filled
         block it swallowed the iron frame and the lamp became an orange
         signboard on a stick. */
      if (flick) api.rectO(10, 5, 22, 16, '#8a4a16');
      api.rectO(11, 6, 21, 15, flick ? '#feae34' : '#b8621b');
            api.rect(12, 7, 20, 14, ST[5]);                                   // the housing
      /* Glass in panes with a hot core, not a flat yellow square. The old
         lantern was a solid block on a stem and read as a parking meter. */
      const hot = flick ? '#ffffff' : '#fff6c9';
      api.rect(13, 8, 19, 13, flick ? '#fee761' : '#feae34');
      api.rect(14, 9, 18, 12, hot);
      api.rect(15, 10, 17, 12, flick ? '#ffffff' : '#fee761');
      api.rect(16, 11, 16, 13, '#feae34');                              // the wick
      api.rect(15, 8, 15, 13, ST[5]); api.rect(17, 8, 17, 13, ST[5]);   // glazing bars
      api.rect(11, 5, 21, 7, ST[4]); api.rect(11, 5, 21, 5, ST[3]);     // the cap
      api.rect(15, 3, 17, 5, ST[4]); api.px(16, 2, ST[3]);              // and its finial
      /* The glow is drawn joined to the lantern: loose pixels get rimmed one
         by one and came back as a ring of black dots round the lamp. */
      /* Light shown as what it falls on, plus four corner twinkles. Two
         fans of orange out of the sides made the lamp a bowtie. */
api.rect(15, 15, 17, 23, '#6b5a53');                              // warm on the post
      api.rect(15, 15, 15, 23, '#8a6f5e');
      finish(buf);
    };

    const fountain = (i) => (buf, W, H) => {
      const api = apiFor(buf, W, H);
      /* A tiered basin. A grey stick with cyan wings on it read as a moth. */
      api.ellipse(3, 21, 29, 30, ST[3], true);                          // lower basin, outside
      api.ellipse(3, 20, 29, 29, ST[2], true);
      api.ellipse(5, 22, 27, 28, ST[4], true);                          // its rim shadow
      api.ellipse(6, 23, 26, 27, '#124e89', true);                      // and the water in it
      api.ellipse(7, 23, 25, 26, '#0099db', true);
      for (let x = 4; x <= 28; x += 4) api.px(x, 21, ST[4]);            // joints on the rim

      api.rect(14, 14, 18, 23, ST[2]);                                  // the pedestal
      api.rect(14, 14, 15, 23, ST[1]); api.rect(18, 14, 18, 23, ST[4]);
      api.rect(13, 21, 19, 22, ST[2]); api.rect(13, 22, 19, 22, ST[4]); // a moulding

      api.ellipse(8, 10, 24, 16, ST[2], true);                          // the upper bowl
      api.ellipse(8, 9, 24, 15, ST[1], true);
      api.rect(12, 15, 20, 16, ST[4]); api.rect(13, 16, 19, 17, ST[3]);  // the bowl's underside
      api.ellipse(10, 10, 22, 14, ST[4], true);
      api.ellipse(11, 10, 21, 13, '#0099db', true);
      api.ellipse(12, 10, 20, 12, '#2ce8f5', true);

      const ph = i % 4;
      for (let k = 0; k < 7; k++) {                                     // the jet
        const y = 9 - k, w = k < 2 ? 1 : 0;
        api.rect(16 - w, y, 16 + w, y, k > 4 ? '#ffffff' : k > 2 ? '#2ce8f5' : '#0099db');
      }
      api.rect(15, 2 + ((ph + 1) % 2), 17, 3 + ((ph + 1) % 2), '#ffffff');   // its head, bobbing
      /* The spill falls close under the bowl, in pairs. Thrown out to the
         tile edge the two streams closed a loop of background between the
         bowl and the basin and the whole thing read as an urn with handles. */
      for (const side of [-1, 1]) for (const off of [7]) {
        for (let q = 0; q <= 8; q++) {
          const y = 14 + q;
          if ((q + ph + off) % 4 === 3) continue;                       // breaks, and they travel
          api.px(16 + side * off, y, q < 4 ? '#2ce8f5' : '#0099db');
          api.px(16 + side * off + side, y, '#124e89');
        }
      }
      api.rect(9 + ph, 25, 11 + ph, 25, '#2ce8f5');                     // ripples
      api.rect(20 - ph, 26, 22 - ph, 26, '#124e89');
      finish(buf);
    };

    return { width: 32, height: 32, name: 'rpg-village', layers: [{ name: 'Props' }], states: [
      S('cottage', 3, [cottage(0), cottage(1)]),
      S('well', 6, [well]),
      S('market_stall', 6, [stall]),
      S('signpost', 6, [signpost]),
      S('lamp', 4, [lamp(true), lamp(false)]),
      D('fountain', 8, true, [0, 1, 2, 3].map(i => Fr(ms(8), fountain(i))))
    ] };
  }

  /* ================= DUNGEON PROPS ================= */
  function dungeonPropsSuite() {
    const S1 = (name, painter) => D(name, 6, true, [Fr(ms(6), painter)]);
    const S2 = (name, fps, a, b) => D(name, fps, true, [Fr(ms(fps), a), Fr(ms(fps), b)]);
    const ST = ['#e8ecf5', '#c0cbdc', '#8b9bb4', '#5a6988', '#3a4466', '#262b44'];
    const WD = ['#e4a672', '#b86f50', '#733e39', '#5c3a2a', '#3e2731'];
    const BN = ['#fff6c9', '#ead4aa', '#c9b48a', '#8a7a5c'];

    /* One cylindrical ramp reused by the pillar and the statue's plinth: a
       stack of flat greys is a box, whatever silhouette you cut it into. */
    const drum = (api, x0, x1, y0, y1, lit) => {
      for (let x = x0; x <= x1; x++) {
        const u = (x - x0) / Math.max(1, x1 - x0);
        const c = Math.cos((u - 0.3) * 2.6);
        api.rect(x, y0, x, y1, c > 0.9 ? ST[lit] : c > 0.62 ? ST[lit + 1] : c > 0.2 ? ST[lit + 2] : ST[lit + 3]);
      }
    };

    const pillar = (broken) => (buf, W, H) => {
      const api = apiFor(buf, W, H);
      api.rect(7, 26, 25, 28, ST[4]); api.rect(7, 26, 25, 26, ST[3]);   // plinth, two courses
      api.rect(9, 23, 23, 26, ST[3]); api.rect(9, 23, 23, 23, ST[2]);
      const top = broken ? 12 : 6;
      for (let y = top; y <= 23; y++) {
        /* Entasis: the shaft swells low and draws in near the capital. A
           constant-width bar with three dashed lines down it read as a zip. */
        const nar = Math.max(0, Math.round((23 - y) / 9) - (broken ? 1 : 0));
        drum(api, 11 + nar, 21 - nar, y, y, 1);
      }
      for (const fx of [13, 16, 19]) {                                  // flutes
        for (let y = top + (broken ? 4 : 1); y <= 22; y++) api.px(fx, y, ST[3]);
      }
      if (!broken) {
        drum(api, 9, 23, 4, 5, 1);                                      // echinus
        api.rect(7, 2, 25, 3, ST[1]); api.rect(7, 3, 25, 3, ST[2]);     // and abacus
        api.rect(9, 5, 23, 5, ST[3]);
      } else {
        /* A fracture runs across in a couple of long steps. Per-column
           noise gave a ragged crust and the stump read as a boulder. */
        const br = [4, 4, 3, 3, 2, 1, 1, 0, 0, 1, 2];
        for (let x = 11; x <= 21; x++) {
          drum(api, x, x, 12 + br[x - 11], 14, 1);
          api.px(x, 12 + br[x - 11], ST[4]);
        }
        api.line(13, 22, 18, 17, ST[4], 1); api.px(15, 20, ST[2]);      // a crack
        api.rect(2, 25, 6, 27, ST[3]); api.rect(2, 25, 6, 25, ST[2]);   // rubble, clear of the plinth
        api.px(6, 27, ST[4]);
        api.rect(27, 26, 30, 28, ST[3]); api.rect(27, 26, 30, 26, ST[2]);
        api.rect(3, 21, 5, 23, ST[2]); api.rect(5, 22, 5, 23, ST[3]);
      }
      speck(api, 11, top + 1, 21, 22, 5, [ST[3]], 0.12);
      finish(buf);
    };

    const altar = (lit) => (buf, W, H) => {
      const api = apiFor(buf, W, H);
      api.rect(7, 25, 25, 28, ST[4]); api.rect(7, 25, 25, 25, ST[3]);   // the footing
      api.rect(10, 18, 22, 25, ST[3]); api.rect(10, 18, 12, 25, ST[2]); // the block
      api.rect(21, 18, 22, 25, ST[4]);
      api.rect(8, 15, 24, 18, ST[2]); api.rect(8, 15, 24, 15, ST[1]);   // its mensa
      api.rect(8, 17, 24, 18, ST[3]);
      /* A rune cut into the face, hot when the candles burn. A flat purple
         square on the front read as a screwed-on plaque. */
      const rc = lit ? '#b55088' : '#68386c';
      api.rect(15, 20, 17, 20, rc); api.rect(16, 20, 16, 24, rc);
      api.px(14, 22, rc); api.px(18, 22, rc); api.px(15, 23, rc); api.px(17, 23, rc);
      if (lit) { api.px(16, 22, '#ffffff'); api.rect(13, 17, 19, 17, '#68386c'); }

      for (const [x, tall] of [[12, 0], [20, 1]]) {                     // candles, unequal
        const ty = 9 + tall * 2;
        api.rect(x - 1, ty, x + 1, 15, BN[1]);                          // the taper
        api.rect(x - 1, ty, x - 1, 15, BN[0]); api.rect(x + 1, ty, x + 1, 15, BN[2]);
        api.px(x + 1, ty + 3, BN[1]); api.px(x + 1, ty + 4, BN[0]);     // a run of wax
        api.px(x, ty - 1, ST[5]);                                       // the wick
        if (lit) {
          api.rect(x, ty - 4, x, ty - 2, '#feae34');                    // and a teardrop flame
          api.px(x, ty - 3, '#fff6c9'); api.px(x - 1, ty - 2, '#f77622'); api.px(x + 1, ty - 2, '#f77622');
          api.px(x, ty - 5, '#fee761');
        }
      }
      finish(buf);
    };

    const sarcophagus = (buf, W, H) => {
      const api = apiFor(buf, W, H);
      /* The effigy has to sit in a deep recess and be painted two steps
         brighter than the lid. Cut with tones a step apart it reads as a
         scribble on a grey box -- a washing machine with a sticker. */
      for (let y = 4; y <= 28; y++) {
        const k = (y - 4) / 24;
        const hw = 9.4 - k * 3.2 - (y < 9 ? (9 - y) * (9 - y) * 0.36 : 0);
        drum(api, Math.round(16 - hw), Math.round(16 + hw), y, y, 1);
      }
      api.rect(8, 8, 24, 8, ST[4]);
      for (let y = 9; y <= 26; y++) {                                   // the sunk panel
        const hw = 6.4 - (y - 9) * 0.1;
        api.rect(Math.round(16 - hw), y, Math.round(16 + hw), y, ST[5]);
      }
      api.ellipse(12, 9, 20, 17, ST[2], true);                          // the head,
      api.ellipse(13, 10, 19, 16, ST[1], true);
      api.ellipse(13, 10, 17, 14, ST[0], true);
      api.rect(14, 12, 15, 12, ST[4]); api.rect(17, 12, 18, 12, ST[4]); // eyes closed
      api.rect(14, 15, 18, 15, ST[3]);
      api.rect(11, 17, 21, 19, ST[2]);                                  // shoulders and arms
      api.rect(11, 17, 21, 17, ST[1]); api.rect(11, 19, 21, 19, ST[3]);
      api.rect(12, 20, 20, 23, ST[2]); api.rect(12, 20, 20, 20, ST[1]);
      api.rect(12, 23, 20, 23, ST[3]);
      api.rect(13, 24, 19, 26, ST[2]); api.rect(13, 26, 19, 26, ST[3]); // and feet
      api.rect(15, 18, 17, 26, ST[0]);                                  // the sword down the middle
      api.rect(17, 18, 17, 26, ST[2]);
      api.rect(13, 18, 19, 19, ST[0]); api.rect(13, 19, 19, 19, ST[2]); // its guard
      api.rect(15, 15, 17, 17, ST[0]); api.px(16, 14, ST[1]);           // and pommel
      api.rect(8, 27, 24, 28, '#68386c');                               // a band of glyphs
      for (let x = 9; x <= 23; x += 2) api.px(x, 27, '#b55088');
      speck(api, 8, 9, 24, 26, 13, [ST[4]], 0.06);
      finish(buf);
    };

    const bones = (buf, W, H) => {
      const api = apiFor(buf, W, H);
      const femur = (x0, y0, x1, y1) => {                               // knobbed at both ends
        api.line(x0, y0, x1, y1, BN[2], 2);
        api.line(x0, y0, x1, y1, BN[1], 1);
        for (const [x, y] of [[x0, y0], [x1, y1]]) {
          api.rect(x - 1, y - 1, x + 1, y + 1, BN[2]); api.px(x, y, BN[0]);
          api.px(x + 1, y + 1, BN[3]);
        }
      };
      /* Loose bones with air between them. Nested hoops off a spine wound
         into a spiral and the pile came back as an ammonite. */
      api.line(4, 12, 11, 10, BN[2], 1); api.line(5, 15, 12, 14, BN[2], 1);   // two stray ribs
      api.line(22, 11, 28, 14, BN[2], 1);
      femur(4, 27, 13, 24); femur(5, 23, 14, 27);                       // a crossed pair
      femur(20, 26, 29, 23);
      const sx = 20, sy = 15;                                           // and a skull, tipped
      api.ellipse(sx - 6, sy - 6, sx + 6, sy + 4, BN[2], true);
      api.ellipse(sx - 6, sy - 7, sx + 6, sy + 3, BN[1], true);
      api.ellipse(sx - 5, sy - 6, sx + 1, sy - 1, BN[0], true);         // its lit dome
      api.rect(sx - 4, sy - 2, sx - 2, sy, ST[5]); api.rect(sx + 1, sy - 2, sx + 3, sy, ST[5]);
      api.px(sx - 4, sy - 2, BN[3]); api.px(sx + 3, sy - 2, BN[3]);
      api.rect(sx - 1, sy + 1, sx, sy + 2, ST[5]);                      // nasal hole
      api.rect(sx - 5, sy + 4, sx + 5, sy + 5, BN[2]);                  // the jaw
      api.rect(sx - 5, sy + 4, sx + 5, sy + 4, BN[1]);
      for (let x = sx - 4; x <= sx + 4; x += 2) api.px(x, sy + 5, BN[3]);
      finish(buf);
    };

    const chains = (sway) => (buf, W, H) => {
      const api = apiFor(buf, W, H);
      api.rect(0, 0, 31, 3, ST[4]); api.rect(0, 3, 31, 3, ST[5]);       // the ceiling
      for (let x = 0; x < 32; x += 5) api.px(x + (sway ? 0 : 0), 1, ST[5]);
      speck(api, 0, 0, 31, 2, 21, [ST[3]], 0.12);
      /* Links alternating flat and edge-on. A dotted line of grey blobs is
         a string of beads; the alternation is what makes it read as chain. */
      const hang = (bx, len, phase, end) => {
        for (let k = 0; k < len; k++) {
          const y = 4 + k * 3;
          const x = bx + Math.round(Math.sin(k * 0.55 + phase) * (k / len) * 2.5);
          if (k % 2 === 0) {
            api.ellipse(x - 2, y, x + 2, y + 2, ST[2], false);
            api.px(x - 2, y + 1, ST[1]); api.px(x + 2, y + 1, ST[3]);
          } else {
            api.rect(x - 1, y - 1, x, y + 2, ST[3]); api.px(x - 1, y - 1, ST[2]);
          }
        }
        const y = 4 + len * 3, x = bx + Math.round(Math.sin(len * 0.55 + phase) * 2.5);
        if (end === 'cuff') {                                           // a manacle, sprung open
          /* A closed ring this small has its hole filled in by the outline
             pass and comes back as a lollipop. Leave the cuff gapped. */
          for (let a = -2.25; a < 2.25; a += 0.07) {
            api.px(x + Math.cos(a) * 4.2, y + 4 + Math.sin(a) * 4.2, ST[2]);
            api.px(x + Math.cos(a) * 3.3, y + 4 + Math.sin(a) * 3.3, a < 0 ? ST[1] : ST[3]);
          }
          api.rect(x - 5, y + 3, x - 4, y + 5, ST[3]);                  // its hinge
        } else {                                                        // or a hook
          api.rect(x - 1, y, x, y + 3, ST[2]);
          api.line(x, y + 3, x + 3, y + 5, ST[2], 1);
          api.line(x + 3, y + 5, x + 2, y + 7, ST[1], 1);
        }
      };
      hang(10, 6, sway ? 0.4 : -0.4, 'cuff');
      hang(22, 5, sway ? -0.8 : 0.8, 'hook');
      finish(buf);
    };

    const bars = (buf, W, H) => {
      const api = apiFor(buf, W, H);
      /* A banded oak door in a stone arch. Five grey verticals in a black
         box is a cage, and with a yellow square on it, a lift. */
      for (let y = 1; y <= 29; y++) {
        const k = Math.max(0, (7 - y) / 6);
        const hw = 12.5 - k * k * 9;
        drum(api, Math.round(16 - hw), Math.round(16 + hw), y, y, 2);
      }
      for (let y = 3; y <= 29; y++) {                                   // the leaf, set back
        const k = Math.max(0, (9 - y) / 6);
        const hw = 9.5 - k * k * 7;
        const x0 = Math.round(16 - hw), x1 = Math.round(16 + hw);
        for (let x = x0; x <= x1; x++) {
          const m = (x - x0) % 4;
          api.px(x, y, m === 0 ? WD[3] : m === 1 ? WD[1] : WD[2]);
        }
      }
      for (const by of [10, 22]) {                                      // iron bands
        api.rect(7, by, 25, by + 2, ST[4]); api.rect(7, by, 25, by, ST[3]);
        for (let x = 8; x <= 24; x += 4) api.px(x, by + 1, ST[2]);      // and their rivets
      }
      api.rect(6, 6, 9, 8, ST[4]); api.rect(6, 26, 9, 28, ST[4]);       // hinge straps
      api.rect(12, 14, 20, 20, ST[5]);                                  // a barred grille
      for (let x = 13; x <= 19; x += 3) api.rect(x, 14, x, 20, ST[2]);
      api.rect(12, 14, 20, 14, ST[4]);
      api.ellipse(19, 24, 24, 28, ST[3], false);                        // the ring pull
      api.ellipse(20, 25, 23, 27, ST[2], false);
      api.rect(20, 22, 23, 24, ST[4]); api.px(21, 23, ST[2]);
      finish(buf);
    };

    const statue = (buf, W, H) => {
      const api = apiFor(buf, W, H);
      api.rect(4, 26, 28, 28, ST[4]); drum(api, 6, 26, 24, 26, 1);      // plinth
      api.rect(6, 24, 26, 24, ST[1]); api.rect(25, 27, 28, 28, ST[3]);  // and a chipped corner
      /* A hooded sentinel with a spear at its side. Symmetrical -- helm,
         crossguard and blade all stacked on the centre line -- it read as a
         postbox with a white bib down it. The asymmetry is the silhouette. */
      for (let y = 12; y <= 24; y++) {
        const hw = 3.8 + (y - 12) * 0.52;
        drum(api, Math.round(16 - hw), Math.round(16 + hw), y, y, 2);
      }
      for (const fx of [13, 19]) api.line(fx, 15, fx + (fx < 16 ? -3 : 3), 24, ST[5], 1);
      for (let y = 3; y <= 13; y++) {                                   // the cowl
        const k = Math.max(0, (6 - y) / 3);
        const hw = 4.4 + (y - 3) * 0.38 - k * k * 3.4;
        drum(api, Math.round(16 - hw), Math.round(16 + hw), y, y, 1);
      }
      api.rect(13, 8, 19, 13, ST[5]);                                   // the shadow inside it
      api.rect(13, 8, 19, 8, ST[4]);
      api.px(14, 10, ST[2]); api.px(18, 10, ST[2]);                     // two points of eye
      api.rect(9, 13, 23, 14, ST[3]); api.rect(9, 13, 23, 13, ST[2]);   // shoulders
      api.rect(21, 1, 24, 26, 0);                                       // (spear lane)
      api.rect(22, 6, 23, 26, ST[3]); api.rect(22, 6, 22, 26, ST[2]);   // the shaft
      api.rect(21, 5, 24, 6, ST[4]);                                    // its ferrule
      const bw = [0, 1, 2, 2, 1, 1];                                    // and a leaf blade
      for (let r = 0; r <= 5; r++) {                                    // that comes to a point
        api.rect(23 - bw[r], r, 23 + bw[r], r, ST[2]);
        api.rect(23 - bw[r], r, 22, r, ST[0]);
      }
      api.rect(20, 15, 24, 18, ST[2]);                                  // the hand gripping it
      api.rect(20, 15, 24, 15, ST[1]); api.rect(20, 18, 24, 18, ST[4]);
      api.line(19, 14, 20, 16, ST[3], 2);                               // its forearm
      for (const [mx, my] of [[7, 22], [25, 21], [12, 26]]) {           // moss
        api.rect(mx, my, mx + 2, my + 1, '#265c42'); api.px(mx + 1, my, '#3e8948');
      }
      speck(api, 10, 17, 22, 23, 17, [ST[5]], 0.1);
      finish(buf);
    };

    const shrooms = (glow) => (buf, W, H) => {
      const api = apiFor(buf, W, H);
      for (let x = 0; x < 32; x++) {                                    // a mossy floor
        const h = 26 + Math.round(api.hash(x, 1, 23) * 2);
        api.rect(x, h, x, 28, api.hash(x, 5, 23) < 0.4 ? '#265c42' : '#193c3e');
      }
      const cap = glow ? '#0099db' : '#124e89';
      const hot = glow ? '#2ce8f5' : '#0099db';
      const spec = glow ? '#ffffff' : '#63c5ea';
      const one = (x, base, r, lean) => {
        for (let k = 0; k <= base - 8; k++) {                           // a bent stem
          const y = base - k, sx = x + Math.round(lean * k / 6);
          api.rect(sx - 1, y, sx + 1, y, ST[1]); api.px(sx - 1, y, ST[0]); api.px(sx + 1, y, ST[2]);
        }
        const cx = x + Math.round(lean * (base - 8) / 6), cy = base - (base - 8);
        api.ellipse(cx - r - 1, cy - 1, cx + r + 1, cy + 2, ST[3], true);   // gills, in shadow
        for (let q = -r; q <= r; q += 2) api.px(cx + q, cy + 1, ST[4]);
        /* A dome, not a disc with a brim. Filled flat to the edge and capped
           with a lip the mushrooms came back as berets on sticks. */
        api.ellipse(cx - r - 1, cy - r - 2, cx + r + 1, cy + 1, '#0e4b6b', true);
        api.ellipse(cx - r, cy - r - 2, cx + r, cy, cap, true);
        api.ellipse(cx - r + 1, cy - r - 2, cx + r - 1, cy - 1, hot, true);
        api.ellipse(cx - r + 2, cy - r - 1, cx - 1, cy - r + 1, spec, true);
        for (let q = 0; q < 3; q++) {                                   // spots
          const sx = cx - r + 2 + q * (r - 1), sy = cy - r + q % 2;
          api.px(sx, sy, ST[0]); api.px(sx + 1, sy, ST[1]);
        }
      };
      one(8, 26, 4, -1.6);
      one(17, 27, 5, 0.5);
      one(26, 25, 3, 1.4);
      if (glow) {                                                       // spores, in pairs
        api.rect(2, 12, 3, 13, hot); api.rect(29, 9, 30, 10, hot); api.rect(21, 5, 22, 6, hot);
      }
      finish(buf);
    };

    const throne = (buf, W, H) => {
      const api = apiFor(buf, W, H);
      api.rect(4, 26, 28, 28, ST[4]); api.rect(4, 26, 28, 26, ST[3]);   // a stone dais
      api.rect(6, 23, 26, 26, ST[3]); api.rect(6, 23, 26, 23, ST[2]);
      /* A gothic back that comes to a point, with a trefoil pierced in it.
         A brown slab with a red patch is a door with a stamp on it. */
      for (let y = 2; y <= 22; y++) {
        const k = Math.max(0, (8 - y) / 6);
        const hw = 7.5 - k * k * 6.5;
        const x0 = Math.round(16 - hw), x1 = Math.round(16 + hw);
        api.rect(x0, y, x1, y, WD[2]);
        api.rect(x0, y, x0 + 1, y, WD[1]); api.rect(x1 - 1, y, x1, y, WD[3]);
      }
      api.ellipse(13, 5, 19, 11, '#fee761', false);                     // the trefoil
      api.ellipse(14, 6, 18, 10, WD[4], true);
      api.px(16, 6, '#fee761'); api.px(14, 9, '#fee761'); api.px(18, 9, '#fee761');
      api.rect(11, 13, 21, 21, '#a22633');                              // the cushion
      api.rect(11, 13, 21, 14, '#e43b44'); api.rect(11, 20, 21, 21, '#7a1c2c');
      for (let x = 13; x <= 19; x += 3) api.px(x, 17, '#fee761');       // buttons
      api.rect(10, 12, 22, 12, '#fee761'); api.px(10, 12, '#feae34'); api.px(22, 12, '#feae34');
      api.rect(8, 20, 24, 23, WD[2]); api.rect(8, 20, 24, 20, WD[1]);   // the seat
      for (const side of [-1, 1]) {                                     // arms with a scroll
        const x = 16 + side * 10;
        api.rect(x - 1, 15, x + 1, 23, WD[2]);
        api.rect(x - side, 15, x - side, 23, WD[1]);
        api.ellipse(x - 2, 13, x + 2, 17, WD[1], false); api.px(x, 15, WD[3]);
        api.rect(x - 2, 23, x + 2, 25, WD[3]); api.px(x - 2, 25, WD[4]); api.px(x + 2, 25, WD[4]);
      }
      finish(buf);
    };

    return { width: 32, height: 32, name: 'rpg-dungeon-props', layers: [{ name: 'Props' }], states: [
      S1('pillar', pillar(false)),
      S1('pillar_broken', pillar(true)),
      S2('altar', 4, altar(true), altar(false)),
      S1('sarcophagus', sarcophagus),
      S1('bones', bones),
      S2('chains', 3, chains(true), chains(false)),
      S1('iron_door', bars),
      S1('statue', statue),
      S2('glowshrooms', 4, shrooms(true), shrooms(false)),
      S1('throne', throne)
    ] };
  }

  /* ================= RUNE SAVEPOINT ================= */
  function savepointSuite() {
    const ST = ['#e8ecf5', '#c0cbdc', '#8b9bb4', '#5a6988', '#3a4466', '#262b44'];
    /* Four carved marks that differ from one another. Two pixels apiece, the
       old runes read as a row of indicator lamps on a black handset. */
    const GL = [
      ['01110', '01000', '01110', '00010'],
      ['10001', '01110', '01110', '10001'],
      ['11111', '00100', '00100', '11111'],
      ['10101', '01110', '01110', '10101']
    ];
    const frame = (i, active) => (buf, W, H) => {
      const api = apiFor(buf, W, H);
      api.ellipse(4, 24, 28, 31, ST[5], true);                          // the dais
      api.ellipse(4, 23, 28, 30, ST[4], true);
      api.ellipse(6, 24, 26, 29, ST[3], true);
      for (let a = 0; a < TAU; a += 0.09) {                             // a ring cut into it
        api.px(16 + Math.cos(a) * 9, 26.5 + Math.sin(a) * 2.6, ST[5]);
      }
      if (active) {                                                     // which fills as it wakes
        const sweep = (i + 1) / 4 * TAU;
        for (let a = -Math.PI / 2; a < -Math.PI / 2 + sweep; a += 0.09) {
          api.px(16 + Math.cos(a) * 9, 26.5 + Math.sin(a) * 2.6, '#2ce8f5');
        }
      }
      /* The stone: three facets and a broken crown, not a flat slab. */
      for (let y = 6; y <= 26; y++) {
        const hw = 5.2 + (y - 6) * 0.15;
        const x0 = Math.round(16 - hw), x1 = Math.round(16 + hw);
        const cut = y < 9 ? [3, 2, 0][y - 6] : 0;
        api.rect(x0 + cut, y, x1 - Math.round(cut * 0.4), y, ST[4]);
        api.rect(x0 + cut, y, x0 + cut + 1, y, ST[2]);                  // the lit face
        api.rect(x1 - Math.round(cut * 0.4) - 1, y, x1 - Math.round(cut * 0.4), y, ST[5]);
        if (y < 9) api.rect(x0 + cut, y, x1 - Math.round(cut * 0.4), y, ST[3]);
      }
      api.rect(13, 9, 19, 9, ST[5]);                                    // the crown's shadow
      speck(api, 11, 10, 21, 25, 29, [ST[5]], 0.09);

      const lit = active ? i : (i === 1 ? 0 : -1);
      GL.forEach((g, k) => {
        const on = active ? k <= lit : k === lit;
        const c = on ? '#2ce8f5' : '#124e89', hi = on ? '#ffffff' : '#124e89';
        for (let r = 0; r < 4; r++) for (let q = 0; q < 5; q++) {
          if (g[r][q] === '1') api.px(14 + q, 10 + k * 4 + r, r === 0 ? hi : c);
        }
      });

      const cy = 1 + [0, 1, 2, 1][i];                                   // the crystal, bobbing
      /* It rides just clear of the crown on a short thread. Held six rows
         up on a one-pixel stem it read as a thermometer. */
      api.rect(16, cy + 4, 16, 6, active ? '#0099db' : '#124e89');
      if (active) for (let a = 0.2; a < TAU; a += 0.11) {               // its nimbus, in arcs
        if (((a * 3) | 0) % 2) continue;
        api.px(16 + Math.cos(a) * 6, cy + 2 + Math.sin(a) * 4.5, '#124e89');
      }
      api.rect(15, cy, 17, cy + 3, '#0099db');                          // a cut gem: table,
      api.rect(15, cy + 1, 16, cy + 3, '#2ce8f5');                      // crown and pavilion
      api.rect(15, cy, 17, cy, '#63c5ea'); api.px(15, cy + 1, '#ffffff');
      api.px(16, cy + 4, '#0099db'); api.px(16, cy - 1, '#63c5ea');
      api.px(14, cy + 1, '#124e89'); api.px(18, cy + 1, '#124e89');

      if (active) {                                                     // light climbing the stone
        if (i < 3) {                                                    // one band of light, climbing
          const y = 24 - i * 5;
          api.rect(12, y, 20, y, '#2ce8f5'); api.rect(12, y + 1, 20, y + 1, '#0099db');
          api.rect(13, y + 2, 19, y + 2, '#124e89');
        }
        if (i === 3) {
          for (let a = 0; a < TAU; a += TAU / 12) {                     // and the release
            for (let u = 4; u < 12; u += 1) {
              api.px(16 + Math.cos(a) * u, 15 + Math.sin(a) * u * 0.8,
                u < 7 ? '#ffffff' : u < 10 ? '#2ce8f5' : '#0099db');
            }
          }
        }
      }
      finish(buf);
    };
    return { width: 32, height: 32, name: 'rpg-savepoint', layers: [{ name: 'Props' }], states: [
      D('idle', 6, true, [0, 1, 2, 3].map(i => Fr(ms(6), frame(i, false)))),
      D('activate', 10, true, [0, 1, 2, 3].map(i => Fr(ms(10), frame(i, true))))
    ] };
  }

  /* ================= WATERFALL ================= */
  function waterfallSuite() {
    const frame = (i) => (buf, W, H) => {
      const api = apiFor(buf, W, H);
      const RK = ['#8b9bb4', '#5a6988', '#3a4466', '#262b44'];
      /* Full bleed, so it tiles and takes no outline. Cliff on both sides
         all the way down: rock only across the top left the sheet hanging
         in mid-air with a black line drawn round it. */
      for (const side of [0, 1]) {
        /* Bedding planes at uneven spacing. A dark rule every fourth row is
           a course of bricks, and the cliff came back as a bookcase. */
        const plane = [];
        for (let y = 2; y < 32; y++) if (api.hash(side * 7 + 1, y, 41) < 0.2) plane.push(y);
        const x0 = side ? 23 : 0, x1 = side ? 31 : 8;
        let band = 0;
        for (let y = 0; y < 32; y++) {
          const isPlane = plane.includes(y);
          if (isPlane) band++;
          for (let x = x0; x <= x1; x++) {
            if (isPlane && api.hash(x, y, 43) < 0.82) { api.px(x, y, RK[3]); continue; }
            const n = api.hash(x, band * 5 + side, 3) * 0.7 + api.hash(x, y, 47) * 0.3;
            api.px(x, y, n < 0.26 ? RK[2] : n < 0.66 ? RK[1] : RK[0]);
          }
        }
        for (let y = 4; y < 30; y += 7) {                               // a few vertical joints
          const jx = x0 + 2 + Math.round(api.hash(y, side, 53) * (x1 - x0 - 4));
          api.rect(jx, y, jx, y + 4 + Math.round(api.hash(y, side, 59) * 3), RK[2]);
        }
      }
      for (let x = 0; x <= 8; x++) api.rect(x, 0, x, 1 + Math.round(api.hash(x, 0, 7) * 2), '#3e8948');
      for (let x = 23; x < 32; x++) api.rect(x, 0, x, 1 + Math.round(api.hash(x, 0, 9) * 2), '#265c42');
      for (let k = 0; k < 4; k++) {                                     // the lip overhangs
        api.rect(8 - k, 3 + k, 8, 5, RK[3]); api.rect(23, 3 + k, 23 + k, 5, RK[3]);
      }

      /* The sheet: vertical streaks travelling down. Bands laid on x + 2y
         ran at forty-five degrees and the fall read as a barber's pole. */
      for (let x = 9; x <= 22; x++) {
        const ph = Math.floor(api.hash(x, 1, 11) * 14);
        const edge = Math.min(x - 9, 22 - x);
        for (let y = 0; y <= 25; y++) {
          const v = (((y - i * 5 + ph) % 14) + 14) % 14;
          let c = v < 2 ? '#ffffff' : v < 5 ? '#2ce8f5' : v < 10 ? '#0099db' : '#124e89';
          if (edge === 0) c = v < 5 ? '#0099db' : '#124e89';            // the sheet curls away
          else if (edge === 1 && v < 2) c = '#2ce8f5';
          api.px(x, y, c);
        }
      }
      for (let x = 9; x <= 22; x++) {                                   // the crest at the lip
        api.px(x, 2, '#ffffff'); api.px(x, 3, api.hash(x, 2, 13) < 0.5 ? '#ffffff' : '#2ce8f5');
      }
      /* The plunge: broken foam, not a flat cyan puddle with dots on it. */
      api.rect(9, 24, 22, 31, '#124e89');
      for (let y = 24; y <= 31; y++) for (let x = 0; x < 32; x++) {
        const d = Math.hypot((x - 16) / 13, (y - 27) / 4.6);
        if (d > 1) continue;
        const n = api.hash(x, y * 3 + i * 7, 17);
        const k = d + n * 0.5 - (y - 24) * 0.05;
        api.px(x, y, k < 0.45 ? '#ffffff' : k < 0.78 ? '#2ce8f5' : k < 1.05 ? '#0099db' : '#124e89');
      }
      for (let k = 0; k < 7; k++) {                                     // spray thrown off it
        const a = -2.9 + k * 0.42 + i * 0.1;
        const u = 5 + ((k * 3 + i * 2) % 7);
        api.px(16 + Math.cos(a) * u * 1.7, 25 + Math.sin(a) * u * 0.7, '#ffffff');
      }
      for (let k = 0; k < 5; k++) {                                     // and mist against the rock
        const x = (k * 7 + i * 3) % 32, y = 20 + ((k * 5 + i) % 5);
        if (x > 6 && x < 25) continue;
        api.px(x, y, '#5a6988'); api.px(x + 1, y, '#8b9bb4');
      }
      finish(buf);
    };
    return { width: 32, height: 32, name: 'rpg-waterfall', layers: [{ name: 'Water' }],
      states: [D('flow', 10, true, [0, 1, 2, 3].map(i => Fr(ms(10), frame(i))))] };
  }

  /* ================= LAVA ================= */
  function lavaSuite() {
    /* Crust plates with molten seams between them. Two layers of per-pixel
       speckle over flat red was orange television static. The plates come
       from a jittered lattice whose jitter repeats every four cells, so the
       tile still joins to itself on all four sides. */
    const SEEDS = (api) => {
      const pts = [];
      for (let gy = -1; gy <= 4; gy++) for (let gx = -1; gx <= 4; gx++) {
        const jx = api.hash(((gx % 4) + 4) % 4 * 7 + 1, ((gy % 4) + 4) % 4 * 13, 3);
        const jy = api.hash(((gx % 4) + 4) % 4 * 5, ((gy % 4) + 4) % 4 * 11 + 2, 9);
        pts.push([gx * 8 + jx * 7 + 0.5, gy * 8 + jy * 7 + 0.5]);
      }
      return pts;
    };
    const frame = (i) => (buf, W, H) => {
      const api = apiFor(buf, W, H);
      const pts = SEEDS(api);
      const dy = i * 2;                                                 // the raft creeps
      const pulse = [0, 0.7, 1, 0.5][i];
      for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
        const sy = y + dy;
        let d1 = 1e9, d2 = 1e9;
        for (const [px_, py_] of pts) {
          const d = Math.hypot(x - px_, sy - py_);
          if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d;
        }
        const w = (d2 - d1) + api.hash(x, y, 19) * 0.35;                // seam width, frayed
        let c;
        if (w < 0.3 + pulse * 0.16) c = '#ffffff';
        else if (w < 0.8 + pulse * 0.22) c = '#fee761';
        else if (w < 1.35) c = '#f77622';
        else if (w < 1.9) c = '#a22633';
        else {
          /* Crust, warming toward the seam. Ramping the whole cell through
             the fire palette made the plates the bright part and the tile
             came back as a slice of cheese. */
          const t = d1 + api.hash(x, y * 3, 23) * 0.8;
          c = t > 4.6 ? '#733e39' : t > 3.0 ? '#5c3a2a' : '#3e2731';
        }
        api.px(x, y, c);
      }
      for (let k = 0; k < 3; k++) {                                     // bubbles, rising and bursting
        const ph = (i + k) % 4;
        const bx = [7, 19, 26][k], by = [22, 14, 27][k] - ph * 2;
        const r = 1 + ph;
        if (ph < 3) {
          api.ellipse(bx - r, by - r, bx + r, by + r, '#f77622', true);
          api.ellipse(bx - r, by - r, bx + r - 1, by, '#fee761', true);
          api.px(bx - 1, by - 1, '#ffffff');
        } else {
          /* Ejecta thrown out at uneven lengths. A closed ring of white on
             an orange field is a sticker, not a burst bubble. */
          for (let q = 0; q < 9; q++) {
            const a = q * (TAU / 9) + api.hash(q, k, 31) * 0.6;
            const u = 2.2 + api.hash(q + 3, k + i, 37) * 3.4;
            for (let r = 0.8; r <= u; r += 0.8) {
              api.px(bx + Math.cos(a) * r, by + Math.sin(a) * r * 0.7,
                r < u * 0.5 ? '#ffffff' : '#fee761');
            }
          }
        }
      }
      for (let k = 0; k < 4; k++) {                                     // embers riding the draught
        const x = (k * 9 + i * 3) % 32, y = (26 - i * 4 - k * 6 + 64) % 32;
        api.px(x, y, '#fee761'); api.px(x, y - 1, '#feae34');
      }
      return;
    };
    return { width: 32, height: 32, name: 'rpg-lava', layers: [{ name: 'Lava' }],
      states: [D('bubble', 8, true, [0, 1, 2, 3].map(i => Fr(ms(8), frame(i))))] };
  }

  return { dungeonTilesSuite, villageSuite, dungeonPropsSuite, savepointSuite, waterfallSuite, lavaSuite };
})();
