/* PixelForge Studio — Beasts & Spirits pack.
   A parameterised quadruped rig drives eight farm/forest animals (cow, sheep,
   pig, horse, rabbit, deer) plus two odd-bodies (frog, duck), and three
   custom-rig foes (wraith, gargoyle, imp). 32x32, pure maths, deterministic.

   Geometry is authored in the shared 32x32 sprite space with every animal
   facing right, so silhouettes stay consistent across the family. */
window.PF = window.PF || {};
PF.RPG = PF.RPG || {};
PF.RPG.beasts = (() => {
  const P = () => PF.Pixel;
  const D = (name, fps, loop, frames) => ({ name, fps, loop, frames });
  const Fr = (duration, paint) => ({ duration, paint });
  const ms = fps => Math.round(1000 / fps);
  const apiFor = (buf, W, H) => P().makeApi(buf, W, H);
  const OUT32 = PF.Color.hexToU32('#181425');
  const finish = (buf, W, H) => buf.set(PF.Raster.outline(buf, W, H, OUT32));
  const S1 = (name, painter, fps = 6) => D(name, fps, true, [Fr(ms(fps), painter)]);

  /* ================= quadruped rig ================= */
  /* The old rig was six axis-aligned rectangles: a slab torso, four bar legs
     and a box head on a box neck. Nothing in that says "animal" — it says
     "bench". This one builds the silhouette the way a quadruped reads at
     32px: a barrel with a hip mound aft, a dip through the loin, withers
     rising into a deep brisket, legs that fold at stifle and hock and lift
     their feet through the swing half of the stride, and a wedge skull with
     a muzzle that is a separate mass from it. Nothing is a bar. */
  const CU = h => PF.Color.hexToU32(h);
  const mixc = (hex, to, t) => {
    const [r, g, b] = PF.Color.rgba(CU(hex));
    const q = v => Math.max(0, Math.min(255, Math.round(v)));
    return PF.Color.u32ToHex(PF.Color.fromRGBA(q(r + (to - r) * t), q(g + (to - g) * t), q(b + (to - b) * t), 255));
  };
  const lit = h => mixc(h, 255, 0.26);
  const dim = h => mixc(h, 18, 0.32);

  /* A tapered segment: walks the dominant axis and lays a run across the
     other one, which is what keeps a diagonal limb from breaking into a
     dotted line, and lerps the width, which is what stops every part of the
     animal from being the same thickness end to end. */
  const seg = (api, x0, y0, x1, y1, w0, w1, c, hi, lo) => {
    const dx = x1 - x0, dy = y1 - y0;
    const n = Math.max(1, Math.round(Math.max(Math.abs(dx), Math.abs(dy))));
    const vert = Math.abs(dy) >= Math.abs(dx);
    for (let i = 0; i <= n; i++) {
      const t = i / n, x = x0 + dx * t, y = y0 + dy * t, w = (w0 + (w1 - w0) * t) / 2;
      if (vert) {
        const a = Math.round(x - w), b = Math.round(x + w), yy = Math.round(y);
        api.rect(a, yy, b, yy, c);
        if (hi) api.px(a, yy, hi);
        if (lo && b > a) api.px(b, yy, lo);
      } else {
        const a = Math.round(y - w), b = Math.round(y + w), xx = Math.round(x);
        api.rect(xx, a, xx, b, c);
        if (hi) api.px(xx, a, hi);
        if (lo && b > a) api.px(xx, b, lo);
      }
    }
  };
  const gau = (u, c, w) => Math.exp(-Math.pow((u - c) / w, 2));

  /* g = geometry, p = palette, pose = { step, bob, headDy, tailDy, ear } */
  function quad(g, p, pose = {}) {
    return (buf, W, H) => {
      const api = apiFor(buf, W, H);
      const step = pose.step;
      const s = step !== undefined ? Math.sin(step * Math.PI * 2) : 0;
      const bob = step !== undefined ? Math.round(-Math.abs(s) * (g.bobAmp ?? 1)) : (pose.bob || 0);
      const Y = y => y + bob;
      const B = p.body, Bl = lit(B), Bd = p.shade, Bdd = dim(Bd);
      const HB = p.head || B, HBl = lit(HB), HBd = p.head ? dim(HB) : Bd;
      const sw = g.swing ?? 3, lt = Y(g.legTop), lb = Y(g.legBot), L = g.legs;

      /* ---- limbs ----------------------------------------------------- */
      /* A quadruped walks the diagonal: near-fore with off-hind. Hind legs
         break backward at the hock, forelegs forward at the knee — that one
         difference is most of what makes four sticks read as four legs. */
      const lift = step !== undefined ? (g.lift ?? 2) : 0;
      const limb = (hx, ph, hind, col, hoofC) => {
        const a = ph * Math.PI * 2;
        const dx = Math.sin(a) * sw;
        const fy = lb - Math.round(Math.max(0, Math.sin(a + Math.PI * 0.5)) * lift);
        const ky = lt + Math.round((lb - lt) * 0.52);
        const kx = hx + dx * 0.3 + (hind ? -1.7 : 1.5);
        const fx = hx + dx;
        seg(api, hx, lt - 2, kx, ky, g.legW + 2.4, g.legW, col, lit(col), dim(col));
        seg(api, kx, ky, fx, fy - 2, g.legW, Math.max(1.6, g.legW - 1), col, lit(col));
        api.rect(Math.round(fx) - 1, fy - 1, Math.round(fx) + 1, fy, hoofC);
        api.px(Math.round(fx) - 1, fy - 1, mixc(hoofC, 255, 0.2));
      };
      const ph0 = step !== undefined ? step : 0.25, ph1 = ph0 + 0.5;
      limb(L[1], ph1, true, Bd, dim(p.hoof));        // off hind
      limb(L[3], ph0, false, Bd, dim(p.hoof));       // off fore

      /* ---- torso ------------------------------------------------------ */
      const bl = g.bodyL, br = g.bodyR, bt = g.bodyTop, bb = g.bodyBot;
      const spn = br - bl, dep = bb - bt;
      const prof = x => {
        const u = Math.max(0, Math.min(1, (x - bl) / spn));
        const cap = Math.pow(Math.sin(u * Math.PI), 0.36);   // rounds both ends
        let top = bt + (1 - cap) * dep * 0.46
          - gau(u, 0.20, 0.15) * (g.hip ?? 1.6)              // croup over the hip
          + gau(u, 0.50, 0.22) * (g.loin ?? 1.2)             // dip through the loin
          - gau(u, 0.80, 0.18) * (g.withers ?? 1.7);         // withers
        let bot = bb - (1 - cap) * dep * 0.34
          + gau(u, 0.76, 0.20) * (g.brisket ?? 1.2)          // brisket hangs low
          - gau(u, 0.46, 0.22) * (g.tuck ?? 1.3);            // flank tucks up
        top = Math.round(top); bot = Math.round(bot);
        return [top, Math.max(bot, top + 2)];
      };
      for (let x = bl; x <= br; x++) {
        const [t0, b0] = prof(x);
        api.rect(x, Y(t0), x, Y(b0), B);
        api.px(x, Y(t0), Bl);                                // sun along the spine
        const u = (x - bl) / spn;
        if (u > 0.12 && u < 0.92) api.px(x, Y(b0 - 1), p.belly);   // countershading, not a stripe
        api.px(x, Y(b0), Bd);
      }
      if (g.wool) {                                          // fleece: scallop the whole outline
        for (let x = bl + 1; x < br - 3; x += 3) {
          const [t0, b0] = prof(x);
          api.ellipse(x - 1, Y(t0) - 2, x + 2, Y(t0) + 2, B, true);
          api.ellipse(x - 1, Y(t0) - 2, x + 1, Y(t0), Bl, true);
          api.ellipse(x - 1, Y(b0) - 2, x + 2, Y(b0) + 1, p.belly, true);
          api.px(x + 2, Y(t0) + 2, Bd);
        }
      }
      if (g.spots) g.spots.forEach(([sx, sy, r0]) => {        // blotches, not single pixels
        const r = r0 || 2;
        for (let x = Math.max(bl, sx - r); x <= Math.min(br, sx + r); x++) {
          const [t0, b0] = prof(x);
          for (let y = sy - r; y <= sy + r; y++)
            if (Math.pow((x - sx) / r, 2) + Math.pow((y - sy) / (r - 0.4), 2) <= 1 && y > t0 && y < b0 - 1)
              api.px(x, Y(y), p.spot);
        }
      });
      if (g.udder) {
        const ux = bl + Math.round(spn * 0.34), uc = p.udder || '#f6c1c6';
        api.ellipse(ux - 2, Y(bb - 1), ux + 2, Y(bb + 2), uc, true);
        api.rect(ux - 2, Y(bb - 1), ux, Y(bb), lit(uc));
        api.px(ux - 1, Y(bb + 3), dim(uc)); api.px(ux + 1, Y(bb + 3), dim(uc));
      }

      /* ---- tail -------------------------------------------------------- */
      const t = g.tail, td = pose.tailDy || 0;
      const tx = t.x + t.dx, ty = Y(t.y + t.dy + td);
      if (t.curl) {                                          // pig: a corkscrew, not a droop
        api.rect(t.x, Y(t.y) + 1, t.x + 2, Y(t.y) + 2, Bd);          // root, into the rump
        api.ellipse(t.x - 3, Y(t.y) - 1, t.x + 1, Y(t.y) + 3, Bd, false);
        api.px(t.x - 3, Y(t.y) + 4 + (td > 0 ? 1 : 0), Bd);
      } else {
        seg(api, t.x, Y(t.y), tx, ty, (t.w || 2) + 1.4, 1.4, Bd, Bl);
        if (t.tip) api.ellipse(tx - 1, ty - 1, tx + 1, ty + 3, t.tip, true);
      }

      /* ---- neck, skull, muzzle ------------------------------------------ */
      const hwd = g.headW, hh = g.headH, hx = g.headX;
      const hy = Y(g.headY + (pose.headDy || 0));
      const nw = g.neckW ?? 8;
      seg(api, br - 4, Y(bt) + 3, hx + 2, hy + hh - 2, nw, nw - 3.5, B, Bl, Bd);
      if (g.mane) {                                          // crest of hair down the neck
        const mc = p.mane || Bdd;
        for (let i = 0; i <= 7; i++) {
          const k = i / 9;
          const x = Math.round((br - 4) + ((hx + 1) - (br - 4)) * k);
          const y = Math.round((Y(bt) + 2) + ((hy + 1) - (Y(bt) + 2)) * k);
          api.rect(x - 1, y - 2 - (i % 2), x, y + 1, mc);
        }
      }
      api.ellipse(hx, hy + 1, hx + hwd - 1, hy + hh - 1, HB, true);
      api.rect(hx + 1, hy, hx + hwd - 2, hy + 2, HB);
      api.rect(hx + 1, hy, hx + hwd - 3, hy, HBl);           // lit brow
      api.rect(hx, hy + hh - 2, hx + hwd - 3, hy + hh - 1, HBd);   // jaw in shade
      /* The head is the same colour as the neck it sits on, so without a
         shadow down the back of the jaw the two fuse into one lump — which is
         exactly what a white cow's head did. This one line is the head. */
      api.rect(hx, hy + 2, hx, hy + hh - 2, HBd);
      api.px(hx + 1, hy + hh - 1, HBd);
      if (g.faceSpot) {                                      // marking that lets a white face read
        api.ellipse(hx + 1, hy, hx + hwd - 3, hy + 3, p.spot, true);
        api.px(hx + 1, hy, HBl);
      }
      const mzc = p.muzzle || p.belly, mzd = g.muzzle ?? 3;
      const mx = hx + hwd - 2, my = hy + (g.muzzleY ?? 3);
      seg(api, mx, my, mx + mzd, my + (g.muzzleDrop ?? 2), Math.max(2.8, hh * 0.52), Math.max(2, hh * 0.34), mzc, lit(mzc), dim(mzc));
      const nx = mx + mzd, ny = my + (g.muzzleDrop ?? 2);
      if (g.snout) {                                         // pig: a flat disc, seen edge-on
        api.rect(nx, ny - 2, nx + 1, ny + 2, mzc);
        api.px(nx + 1, ny - 1, dim(mzc)); api.px(nx + 1, ny + 1, dim(mzc));
      } else {
        api.px(nx, ny - 1, dim(mzc));                        // nostril
        api.rect(nx - 2, ny + 1, nx, ny + 1, dim(mzc));      // mouth line
      }
      const ex = hx + hwd - 4, ey = hy + 2 + (g.eyeDy || 0);
      api.rect(ex, ey, ex + 1, ey + 1, p.eye);
      api.px(ex, ey - 1, HBd);                               // brow
      api.px(ex + 1, ey, p.glint || '#ffffff');

      /* ---- ears --------------------------------------------------------- */
      const ed = pose.ear || 0;
      if (g.ear === 'long') {                                // horse, deer, rabbit
        const el = g.earLen ?? 5;
        seg(api, hx + 1, hy + 2, hx - 1, hy - el + 1 + ed, 3.4, 1.3, HBd);
        seg(api, hx + 4, hy + 2, hx + 4, hy - el + ed, 3.6, 1.4, HB, HBl);
        api.px(hx + 4, hy - el + 3 + ed, p.inner || mzc);
      } else if (g.ear === 'flop') {                         // cow, sheep: sideways leaf
        seg(api, hx + 1, hy + 2, hx - 2, hy + 4 + ed, 1.6, 2.8, HBd);
        seg(api, hx + 3, hy + 2, hx, hy + 3 + ed, 1.6, 3, HB, HBl);
      } else {                                               // pig: flopped forward over the brow
        seg(api, hx + 1, hy, hx - 1, hy + 3 + ed, 2, 3.4, HBd);
        seg(api, hx + 4, hy - 1, hx + 3, hy + 2 + ed, 2.2, 3.6, HB, HBl);
      }

      /* ---- horns -------------------------------------------------------- */
      if (g.horn === 'cow') {                                // short crescents: out, up, forward
        const hc = p.horn, hs = p.hornSh;
        seg(api, hx + 2, hy + 1, hx, hy - 2, 1.8, 0.8, hs);
        seg(api, hx + 4, hy + 1, hx + 6, hy - 1, 2, 0.8, hc, lit(hc));
        api.px(hx + 6, hy - 2, hc);
      } else if (g.horn === 'antler') {                      // deer: a beam with tines
        const hc = p.horn, hs = p.hornSh;
        seg(api, hx + 2, hy, hx, hy - 5, 1.6, 0.8, hs);
        api.px(hx - 1, hy - 4, hs);
        seg(api, hx + 4, hy, hx + 6, hy - 6, 1.8, 0.8, hc, lit(hc));
        seg(api, hx + 5, hy - 3, hx + 8, hy - 4, 1.2, 0.8, hc);   // brow tine
        seg(api, hx + 6, hy - 5, hx + 4, hy - 8, 1.2, 0.8, hc);   // top fork
      }

      /* near pair last: it overlaps torso and head, which is what puts the
         far pair behind the body instead of beside it. */
      limb(L[0], ph0, true, p.leg, p.hoof);
      limb(L[2], ph1, false, p.leg, p.hoof);
      finish(buf, W, H);
    };
  }

  /* ================= animal table ================= */
  const A = {
    cow: {
      geo: { shadow: 9, bodyL: 3, bodyR: 23, bodyTop: 13, bodyBot: 22, legs: [6, 10, 18, 22], legW: 3, legTop: 20, legBot: 27,
        headX: 24, headY: 12, headW: 6, headH: 7, neckW: 9, ear: 'flop', horn: 'cow', swing: 2, bobAmp: 1, lift: 2,
        hip: 1.8, withers: 1.5, loin: 1.5, brisket: 1.4, tuck: 1.0, muzzle: 2, muzzleY: 4, muzzleDrop: 1, udder: true,
        faceSpot: true, eyeDy: 1,
        tail: { x: 3, y: 14, dx: -2, dy: 6, w: 2, tip: '#262b44' },
        spots: [[8, 16, 3], [14, 20, 2], [18, 16, 2], [5, 20, 2]] },
      pal: { body: '#ffffff', shade: '#bcc6d8', belly: '#dfe5f0', leg: '#f2f5fb', hoof: '#262b44', eye: '#181425',
        horn: '#d9ae72', hornSh: '#9c6f42', spot: '#3a3b55', muzzle: '#f2a0a8', udder: '#f6c1c6', inner: '#f2a0a8', glint: '#c0cbdc' }
    },
    sheep: {
      geo: { shadow: 8, bodyL: 4, bodyR: 22, bodyTop: 14, bodyBot: 22, legs: [7, 11, 17, 21], legW: 2, legTop: 21, legBot: 27,
        headX: 23, headY: 14, headW: 6, headH: 6, neckW: 6, ear: 'flop', wool: true, swing: 2, bobAmp: 1, lift: 2,
        hip: 1.2, withers: 1.0, loin: 0.5, brisket: 1.0, tuck: 0.5, muzzle: 3, muzzleY: 3, muzzleDrop: 1,
        tail: { x: 5, y: 16, dx: -2, dy: 3, w: 3 } },
      pal: { body: '#f2f5fb', shade: '#bcc6d8', belly: '#ffffff', leg: '#6b4c5c', hoof: '#2b1b24', eye: '#f2f5fb',
        head: '#4a3341', horn: '#c28569', hornSh: '#733e39', spot: '#c0cbdc', muzzle: '#6b4c5c', inner: '#b55088', glint: '#181425' }
    },
    pig: {
      geo: { shadow: 8, bodyL: 4, bodyR: 22, bodyTop: 15, bodyBot: 23, legs: [7, 11, 17, 21], legW: 3, legTop: 22, legBot: 27,
        headX: 23, headY: 15, headW: 6, headH: 7, neckW: 9, ear: 'up', swing: 2, bobAmp: 1, lift: 1, snout: true,
        hip: 1.7, withers: 0.8, loin: 0.3, brisket: 1.7, tuck: 0.2, muzzle: 2, muzzleY: 4, muzzleDrop: 0,
        tail: { x: 5, y: 17, dx: -3, dy: -2, w: 2, curl: true } },
      pal: { body: '#f6757a', shade: '#c05e77', belly: '#f8a9ad', leg: '#f6757a', hoof: '#3e2731', eye: '#181425',
        horn: '#ffffff', hornSh: '#c0cbdc', spot: '#c05e77', muzzle: '#f2a0a8', inner: '#c05e77' }
    },
    horse: {
      geo: { shadow: 9, bodyL: 3, bodyR: 22, bodyTop: 12, bodyBot: 20, legs: [5, 9, 17, 21], legW: 3, legTop: 19, legBot: 27,
        headX: 24, headY: 9, headW: 5, headH: 9, neckW: 8, ear: 'long', earLen: 4, swing: 4, bobAmp: 2, lift: 3, mane: true,
        hip: 1.9, withers: 1.7, loin: 1.3, brisket: 1.0, tuck: 1.7, muzzle: 2, muzzleY: 5, muzzleDrop: 2,
        tail: { x: 3, y: 13, dx: -2, dy: 8, w: 4, tip: '#262b44' } },
      pal: { body: '#b86f50', shade: '#8a4c39', belly: '#cf8d63', leg: '#b86f50', hoof: '#262b44', eye: '#181425',
        horn: '#ead4aa', hornSh: '#c28569', spot: '#733e39', muzzle: '#7a4331', mane: '#3e2731', head: '#cf8d63', inner: '#f2a0a8', glint: '#f8d8b0' }
    },
    rabbit: {
      geo: { shadow: 5, bodyL: 7, bodyR: 20, bodyTop: 16, bodyBot: 24, legs: [10, 12, 17, 19], legW: 2, legTop: 23, legBot: 27,
        headX: 21, headY: 14, headW: 6, headH: 6, neckW: 5, ear: 'long', earLen: 7, swing: 2, bobAmp: 2, lift: 2,
        hip: 2.2, withers: 0.6, loin: 1.0, brisket: 0.6, tuck: 0.8, muzzle: 2, muzzleY: 3, muzzleDrop: 1,
        tail: { x: 7, y: 20, dx: -2, dy: -1, w: 3, tip: '#ffffff' } },
      pal: { body: '#ead4aa', shade: '#bfa47c', belly: '#fff6c9', leg: '#ead4aa', hoof: '#bfa47c', eye: '#181425',
        horn: '#ffffff', hornSh: '#c0cbdc', spot: '#c8b28a', muzzle: '#f2a0a8', inner: '#f2a0a8', glint: '#fff6c9' }
    },
    deer: {
      geo: { shadow: 8, bodyL: 4, bodyR: 21, bodyTop: 14, bodyBot: 21, legs: [6, 10, 16, 20], legW: 2, legTop: 20, legBot: 27,
        headX: 22, headY: 10, headW: 6, headH: 7, neckW: 6, ear: 'long', earLen: 4, horn: 'antler', swing: 3, bobAmp: 2, lift: 3,
        hip: 1.8, withers: 1.6, loin: 1.2, brisket: 0.8, tuck: 1.5, muzzle: 2, muzzleY: 4, muzzleDrop: 1,
        tail: { x: 4, y: 15, dx: -2, dy: 2, w: 2, tip: '#fff6c9' },
        spots: [[8, 18, 1.6], [12, 19, 1.6], [16, 18, 1.6]] },
      pal: { body: '#d77643', shade: '#a8552f', belly: '#c78f5c', leg: '#c06334', hoof: '#3e2731', eye: '#181425',
        horn: '#ead4aa', hornSh: '#c28569', spot: '#f0d9a8', muzzle: '#3e2731', inner: '#f2a0a8', glint: '#e4a672' }
    }
  };

  /* ---------- FROG (squat hopper) ---------- */
  function frogFrame(pose = {}) {
    return (buf, W, H) => {
      const api = apiFor(buf, W, H);
      const hop = pose.hop || 0, Y = y => y - hop;
      const G = pose.flash ? '#ffffff' : '#63c74d', Dk = pose.flash ? '#e8e8e8' : '#3e8948', L = '#c9f27e';
      // haunches
      api.ellipse(7, Y(19), 15, Y(27), Dk, true);
      api.ellipse(18, Y(19), 26, Y(27), Dk, true);
      // body
      api.ellipse(8, Y(15), 24, Y(26), G, true);
      api.ellipse(10, Y(21), 22, Y(26), L, true);
      // webbed feet
      api.rect(5, Y(26), 12, Y(27), Dk); api.rect(20, Y(26), 27, Y(27), Dk);
      // eyes: two big domes on top (blink closes them for the idle)
      api.ellipse(10, Y(10), 15, Y(15), G, true);
      api.ellipse(17, Y(10), 22, Y(15), G, true);
      if (pose.blink) {
        api.line(11, Y(13), 14, Y(13), '#181425', 1);
        api.line(18, Y(13), 21, Y(13), '#181425', 1);
      } else {
        api.ellipse(11, Y(11), 14, Y(14), '#ffffff', true);
        api.ellipse(18, Y(11), 21, Y(14), '#ffffff', true);
        api.rect(12, Y(12), 13, Y(14), '#181425'); api.rect(19, Y(12), 20, Y(14), '#181425');
      }
      // mouth
      api.line(11, Y(19), 21, Y(19), Dk, 1);
      api.px(16, Y(20), Dk);
      // throat: a small pulse for the idle, a full sac for the croak
      if (pose.throat) api.ellipse(13, Y(19), 19, Y(19 + pose.throat), '#f6757a', true);
      if (pose.croak) { api.ellipse(13, Y(17), 19, Y(21), '#f6757a', true); }
      finish(buf, W, H);
    };
  }
  function frogSuite() {
    const walk = [0, 1, 2, 3].map(i => Fr(ms(8), frogFrame({ hop: [0, 2, 3, 1][i] })));
    return { width: 32, height: 32, name: 'rpg-frog', layers: [{ name: 'Body' }], states: [
      // Idle: throat pulse + a blink, feet planted. No hop — the frog is
      // sitting, not bouncing.
      D('idle', 5, true, [
        Fr(ms(5), frogFrame({})),
        Fr(ms(5), frogFrame({ throat: 2 })),
        Fr(ms(5), frogFrame({ throat: 2, blink: true })),
        Fr(ms(5), frogFrame({ throat: 1 }))
      ]),
      D('hop', 8, true, walk),
      D('croak', 5, true, [Fr(ms(5), frogFrame({})), Fr(ms(5), frogFrame({ croak: true })), Fr(ms(5), frogFrame({ croak: true, hop: 1 })), Fr(ms(5), frogFrame({ hop: 1 }))]),
      D('hurt', 10, true, [Fr(ms(10), frogFrame({ flash: true })), Fr(ms(10), frogFrame({ hop: 2 }))]),
      D('death', 8, false, [Fr(ms(8), frogFrame({ flash: true })), Fr(ms(8), frogFrame({ hop: 1 })), Fr(ms(8), (buf, W, H) => { const api = apiFor(buf, W, H); api.ellipse(9, 23, 23, 27, '#3e8948', true); api.px(12, 24, '#181425'); finish(buf, W, H); })])
    ] };
  }

  /* ---------- DUCK (waterfowl) ---------- */
  function duckFrame(pose = {}) {
    return (buf, W, H) => {
      const api = apiFor(buf, W, H), cx = 16 + (pose.dx || 0);
      const Y = y => y - (pose.hop || 0);
      // head/neck ride headDy so the idle bobs the head without lifting the feet
      const HY = y => y - (pose.hop || 0) + (pose.headDy || 0);
      const B = pose.flash ? '#ffffff' : '#ead4aa', Dk = pose.flash ? '#e8e8e8' : '#c8b28a', Beak = '#feae34', Feet = '#f77622';
      // feet
      api.rect(cx - 3, Y(26), cx + 1, Y(27), Feet); api.rect(cx + 2, Y(26), cx + 6, Y(27), Feet);
      // body: boat-shaped hull
      api.ellipse(cx - 8, Y(16), cx + 6, Y(26), B, true);
      api.ellipse(cx - 6, Y(20), cx + 5, Y(26), Dk, true);
      // folded wing
      api.ellipse(cx - 5, Y(18), cx + 2, Y(23), '#fff6c9', true);
      api.px(cx - 3, Y(21), Dk); api.px(cx - 1, Y(22), Dk);
      // tail feathers (tailUp flicks them for the idle)
      api.line(cx - 8, Y(19), cx - 11, Y(16 - (pose.tailUp || 0)), B, 2);
      // neck + head
      api.rect(cx + 2, HY(12), cx + 6, Y(18), B);
      api.ellipse(cx + 2, HY(7), cx + 9, HY(15), B, true);
      api.px(cx + 7, HY(10), '#181425');
      // bill
      api.rect(cx + 9, HY(11), cx + 12, HY(13), Beak);
      api.px(cx + 12, HY(12), '#f77622');
      // drake plumage hint
      if (pose.drake) { api.rect(cx + 3, HY(8), cx + 7, HY(10), '#3e8948'); }
      finish(buf, W, H);
    };
  }
  function duckSuite() {
    return { width: 32, height: 32, name: 'rpg-duck', layers: [{ name: 'Body' }], states: [
      // Idle: head bob + tail flick, feet planted.
      D('idle', 5, true, [
        Fr(ms(5), duckFrame({})),
        Fr(ms(5), duckFrame({ headDy: 1 })),
        Fr(ms(5), duckFrame({ headDy: 1, tailUp: 1 })),
        Fr(ms(5), duckFrame({ tailUp: 1 }))
      ]),
      D('walk', 7, true, [0, 1, 2, 3].map(i => Fr(ms(7), duckFrame({ dx: [0, 1, 0, -1][i], hop: i % 2 })))),
      D('swim', 5, true, [0, 1, 2, 3].map(i => Fr(ms(5), duckFrame({ dx: [0, 1, 0, -1][i], headDy: i % 2 })))),
      D('hurt', 10, true, [Fr(ms(10), duckFrame({ flash: true })), Fr(ms(10), duckFrame({ hop: 2, dx: -1 }))]),
      D('death', 8, false, [Fr(ms(8), duckFrame({ flash: true })), Fr(ms(8), duckFrame({ hop: 1 })), Fr(ms(8), (buf, W, H) => { const api = apiFor(buf, W, H); api.ellipse(8, 23, 24, 27, '#c8b28a', true); api.px(12, 24, '#181425'); finish(buf, W, H); })])
    ] };
  }

  /* ---------- ANIMALS pack: one idle + one walk state per animal ---------- */
  function animalsSuite() {
    const states = [];
    for (const key of Object.keys(A)) {
      const a = A[key], g = a.geo, p = a.pal;
      // Idle: the head settles and the tail flicks. Nothing lifts the feet —
      // a whole-body bob on a standing animal reads as hopping, not breathing.
      const IDLE_H = [0, 1, 1, 0], IDLE_T = [0, -1, 1, 1], IDLE_E = [0, 0, 1, 0];
      const idle = [0, 1, 2, 3].map(i => Fr(ms(5), quad(g, p, { headDy: IDLE_H[i], tailDy: IDLE_T[i], ear: IDLE_E[i] })));
      // Six frames, not four: a four-beat gait sampled four times puts a foot
      // at the same place twice and the walk stutters. Six gives the stride a
      // readable reach-plant-push-recover on every leg.
      const walk = [0, 1, 2, 3, 4, 5].map(i => Fr(ms(9), quad(g, p, { step: i / 6 })));
      // The neck is a tapered segment now, so the head can actually go down to
      // the grass instead of dipping two pixels. The last frame stays
      // lifted-but-not-level so the loop has no dead repeat against frame 0.
      const graze = [0, 3, 5, 2].map((d, i) => Fr(ms(8), quad(g, p, { headDy: d, tailDy: i === 2 ? 1 : 0 })));
      states.push(D(key + '_idle', 5, true, idle));
      states.push(D(key + '_walk', 9, true, walk));
      states.push(D(key + '_graze', 8, true, graze));
    }
    return { width: 32, height: 32, name: 'rpg-animals', layers: [{ name: 'Body' }], states };
  }

  /* ================= WRATH (hooded spectre) ================= */
  function wraithFrame(pose = {}) {
    return (buf, W, H) => {
      const api = apiFor(buf, W, H);
      const i = pose.i || 0;
      const bob = pose.bob !== undefined ? pose.bob : (i % 2 ? -2 : 0);
      const top = 6 + bob, bot = 26 + bob;
      const Cloak = pose.flash ? '#ffffff' : '#3e2347', CloakD = pose.flash ? '#e8e8e8' : '#262b44', Trim = '#68386c';
      // cloak body: shoulders -> flaring hem
      api.rect(11, top, 20, top + 6, Cloak);
      api.rect(9, top + 5, 22, top + 12, Cloak);
      api.rect(7, top + 11, 24, bot - 4, Cloak);
      api.rect(20, top, 20, bot - 4, CloakD); api.rect(7, top + 11, 8, bot - 4, CloakD);
      // tattered hem: alternating tongues
      for (let x = 7; x <= 24; x += 2) {
        const len = ((x + i) % 3) + 2;
        api.rect(x, bot - 3, x, bot - 3 + len, CloakD);
      }
      // hood: deep cowl
      api.ellipse(9, top - 4, 22, top + 7, Cloak, true);
      api.ellipse(11, top - 1, 20, top + 6, '#181425', true); // hollow
      api.rect(11, top + 5, 20, top + 6, CloakD);
      // eyes: two cold points inside the dark
      const ec = pose.flash ? '#181425' : '#2ce8f5';
      api.px(13, top + 2, ec); api.px(17, top + 2, ec);
      api.px(13, top + 1, ec); api.px(17, top + 1, ec);
      // bone hands
      api.rect(6, top + 9, 8, top + 12, '#c0cbdc');
      api.rect(23, top + 9, 25, top + 12, '#c0cbdc');
      api.px(6, top + 12, Trim); api.px(25, top + 12, Trim);
      // wisps of soul-smoke
      if (pose.smoke) { api.px(12, top - 6, CloakD); api.px(20, top - 5, CloakD); api.px(16, top - 8, CloakD); }
      if (pose.cast) {
        P().particles(api, 16, top + 4, 9, (pose.cast) / 4, ['#2ce8f5', '#b55088', '#ffffff']);
      }
      finish(buf, W, H);
      if (pose.fade) PF.RPG.fadeOut(buf, W, H, pose.fade, 3);
    };
  }
  function wraithSuite() {
    return { width: 32, height: 32, name: 'rpg-wraith', layers: [{ name: 'Body' }], states: [
      D('float', 8, true, [0, 1, 2, 3].map(i => Fr(ms(8), wraithFrame({ i, smoke: i === 3 })))),
      D('cast', 8, true, [0, 1, 2, 3].map(i => Fr(ms(8), wraithFrame({ i, cast: i })))),
      D('lunge', 10, true, [Fr(ms(10), wraithFrame({ i: 0 })), Fr(ms(10), wraithFrame({ i: 1, bob: -4 })), Fr(ms(10), wraithFrame({ i: 2, bob: -1 })), Fr(ms(10), wraithFrame({ i: 3 }))]),
      D('hurt', 8, true, [Fr(ms(8), wraithFrame({ flash: true })), Fr(ms(8), wraithFrame({ i: 1 }))]),
      // `vanish` is the atmospheric exit; `death` is the combat one, so
      // consumers that key on a literal 'death' state still get a real anim.
      D('death', 6, false, [
        Fr(ms(6), wraithFrame({ flash: true })),
        Fr(ms(6), wraithFrame({ i: 1, bob: 3 })),
        Fr(ms(6), wraithFrame({ i: 2, bob: 6, fade: 0.45 })),
        Fr(ms(6), wraithFrame({ i: 3, bob: 8, fade: 0.8 }))
      ]),
      D('vanish', 6, false, [Fr(ms(6), wraithFrame({ i: 0 })), Fr(ms(6), wraithFrame({ i: 1, fade: 0.4 })), Fr(ms(6), wraithFrame({ i: 2, fade: 0.75 }))])
    ] };
  }

  /* ================= GARGOYLE (stone sentinel) ================= */
  function gargoyleFrame(pose = {}) {
    return (buf, W, H) => {
      const api = apiFor(buf, W, H);
      // crouch moves the whole statue (used when airborne); settle compresses
      // only the torso/head/wings so the perched idle never sinks the feet.
      const crouch = pose.crouch || 0, settle = pose.settle || 0;
      const Y = y => y + crouch, BY = y => y + crouch + settle;
      const R1 = pose.flash ? '#ffffff' : '#8b9bb4', R2 = pose.flash ? '#e8e8e8' : '#5a6988', R3 = '#3a4466', Eye = '#ff0044';
      const flap = pose.flap || 0;
      // wings behind, folded (0) or spread (1)
      const wy = flap ? 6 : 14;
      api.line(11, BY(14), 3, BY(wy), R3, 3); api.line(3, BY(wy), 1, BY(wy + 6), R3, 2);
      api.line(21, BY(14), 29, BY(wy), R3, 3); api.line(29, BY(wy), 31, BY(wy + 6), R3, 2);
      api.line(11, BY(15), 4, BY(wy + 2), R2, 1); api.line(21, BY(15), 28, BY(wy + 2), R2, 1);
      // perched legs: bent, clawed — planted, so they ignore `settle`
      api.rect(9, Y(21), 13, Y(26), R2); api.rect(19, Y(21), 23, Y(26), R2);
      api.rect(7, Y(26), 13, Y(27), R3); api.rect(19, Y(26), 25, Y(27), R3);
      api.px(7, Y(27), R3); api.px(25, Y(27), R3);
      // torso
      api.rect(9, BY(13), 22, BY(22), R1);
      api.rect(19, BY(13), 22, BY(22), R2); api.rect(9, BY(13), 11, BY(22), R2);
      api.line(14, BY(15), 16, BY(18), R3, 1); // crack
      // arms crossed in front
      api.rect(7, BY(16), 10, BY(21), R2); api.rect(21, BY(16), 24, BY(21), R2);
      // horned head
      api.rect(12, BY(6), 19, BY(13), R1);
      api.rect(17, BY(6), 19, BY(13), R2);
      api.line(12, BY(7), 10, BY(3), R2, 2); api.line(19, BY(7), 21, BY(3), R2, 2); // horns
      api.rect(13, BY(9), 15, BY(10), Eye); api.rect(17, BY(9), 18, BY(10), Eye);
      api.rect(13, BY(6), 18, BY(7), R3); // brow
      api.line(14, BY(12), 17, BY(12), R3, 1); // jaw
      // moss + weathering
      api.px(10, BY(14), '#63c74d'); api.px(21, BY(20), '#3e8948'); api.px(13, BY(7), '#3e8948');
      finish(buf, W, H);
      if (pose.fade) PF.RPG.fadeOut(buf, W, H, pose.fade, 7);
    };
  }
  function gargoyleSuite() {
    return { width: 32, height: 32, name: 'rpg-gargoyle', layers: [{ name: 'Body' }], states: [
      // Perch: the stone torso settles and the head dips; the claws stay put.
      D('perch', 4, true, [0, 1, 2, 1].map(sv => Fr(ms(4), gargoyleFrame({ settle: sv })))),
      D('swoop', 9, true, [Fr(ms(9), gargoyleFrame({ flap: 1, crouch: -3 })), Fr(ms(9), gargoyleFrame({ flap: 0, crouch: -5 })), Fr(ms(9), gargoyleFrame({ flap: 1, crouch: -3 })), Fr(ms(9), gargoyleFrame({ crouch: 0 }))]),
      D('slam', 7, true, [Fr(ms(7), gargoyleFrame({ crouch: -4, flap: 1 })), Fr(ms(7), gargoyleFrame({ crouch: 2, flap: 0 })), Fr(ms(7), gargoyleFrame({ crouch: 1 })), Fr(ms(7), gargoyleFrame({}))]),
      D('hurt', 8, true, [Fr(ms(8), gargoyleFrame({ flash: true })), Fr(ms(8), gargoyleFrame({ crouch: 1 }))]),
      D('death', 6, false, [
        Fr(ms(6), gargoyleFrame({ flash: true })),
        Fr(ms(6), gargoyleFrame({ crouch: 3 })),
        Fr(ms(6), (buf, W, H) => { const api = apiFor(buf, W, H); api.rect(6, 22, 13, 26, '#5a6988'); api.rect(15, 24, 21, 27, '#8b9bb4'); api.rect(23, 23, 27, 26, '#3a4466'); finish(buf, W, H); }),
        Fr(ms(6), (buf, W, H) => { const api = apiFor(buf, W, H); api.rect(6, 25, 13, 27, '#5a6988'); api.rect(15, 26, 21, 27, '#8b9bb4'); api.rect(23, 25, 27, 27, '#3a4466'); finish(buf, W, H); })
      ])
    ] };
  }

  /* ================= IMP (small winged nuisance) ================= */
  function impFrame(pose = {}) {
    return (buf, W, H) => {
      const api = apiFor(buf, W, H);
      const i = pose.i || 0;
      const hop = pose.hop || 0, Y = y => y - hop;
      const R = pose.flash ? '#ffffff' : '#e43b44', Dk = pose.flash ? '#e8e8e8' : '#a22633', Horn = '#ead4aa', Wing = '#5c1a1a';
      const flap = pose.flap || 0;
      // bat wings
      const wy = flap ? Y(11) : Y(15);
      api.line(11, Y(15), 4, wy, Wing, 2); api.line(4, wy, 2, wy + 4, Wing, 1);
      api.line(21, Y(15), 28, wy, Wing, 2); api.line(28, wy, 30, wy + 4, Wing, 1);
      // legs + hooves
      api.rect(12, Y(22), 14, Y(26), Dk); api.rect(18, Y(22), 20, Y(26), Dk);
      api.rect(11, Y(26), 14, Y(27), '#3e2731'); api.rect(18, Y(26), 21, Y(27), '#3e2731');
      // torso
      api.rect(12, Y(15), 20, Y(23), R);
      api.rect(18, Y(15), 20, Y(23), Dk);
      api.rect(12, Y(21), 20, Y(23), Dk);
      // arms + claws
      api.rect(9, Y(16), 11, Y(20), R); api.rect(21, Y(16), 23, Y(20), R);
      api.px(9, Y(21), Horn); api.px(23, Y(21), Horn);
      // head with horns
      api.rect(12, Y(8), 20, Y(15), R);
      api.rect(18, Y(8), 20, Y(15), Dk);
      api.line(13, Y(8), 11, Y(3), Horn, 1); api.line(19, Y(8), 21, Y(3), Horn, 1);
      api.px(11, Y(3), '#c28569'); api.px(21, Y(3), '#c28569');
      // eyes + grin
      api.px(14, Y(11), '#fee761'); api.px(18, Y(11), '#fee761');
      api.rect(14, Y(11), 14, Y(12), '#fee761'); api.rect(18, Y(11), 18, Y(12), '#fee761');
      api.line(14, Y(14), 18, Y(14), '#181425', 1);
      api.px(15, Y(13), '#ffffff'); api.px(17, Y(13), '#ffffff'); // fangs
      // arrow-tipped tail
      api.line(20, Y(22), 26, Y(19 + (i % 2)), Dk, 1);
      api.px(26, Y(19 + (i % 2)), R);
      if (pose.spark) P().sparks(api, 26, Y(19), 1, '#fee761', 6, 1, 4);
      finish(buf, W, H);
      if (pose.fade) PF.RPG.fadeOut(buf, W, H, pose.fade, 11);
    };
  }
  function impSuite() {
    return { width: 32, height: 32, name: 'rpg-imp', layers: [{ name: 'Body' }], states: [
      D('idle', 6, true, [0, 1, 2, 3].map(i => Fr(ms(10), impFrame({ i, flap: i % 2 })))),
      D('dart', 12, true, [0, 1, 2, 3].map(i => Fr(ms(12), impFrame({ i, hop: [0, 3, 1, 0][i], flap: 1 })))),
      D('hex', 10, true, [0, 1, 2, 3].map(i => Fr(ms(10), impFrame({ i, flap: i % 2, spark: i >= 2 })))),
      D('hurt', 10, true, [Fr(ms(10), impFrame({ flash: true })), Fr(ms(10), impFrame({ i: 1, hop: 2 }))]),
      D('death', 8, false, [Fr(ms(8), impFrame({ flash: true })), Fr(ms(8), impFrame({ hop: 1 })), Fr(ms(8), impFrame({ fade: 0.5 })), Fr(ms(8), impFrame({ fade: 0.85 }))])
    ] };
  }

  return { animalsSuite, frogSuite, duckSuite, wraithSuite, gargoyleSuite, impSuite,
    quad, frogFrame, duckFrame, wraithFrame, gargoyleFrame, impFrame, ANIMALS: A };
})();
