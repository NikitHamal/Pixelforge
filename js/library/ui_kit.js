/* PixelForge Studio — UI kit.
   Panels, buttons, bars, icons, cursors, controls, dialogue and inventory
   slots: the parts every game needs and nobody enjoys drawing twice. Every
   panel is authored 9-slice friendly (2px border band, flat centre) so it can
   be sliced and stretched by the engine without the corners smearing.
   Pure maths, no image assets, deterministic. */
window.PF = window.PF || {};
PF.UIKit = (() => {
  const P = () => PF.Pixel;
  const D = (name, fps, loop, frames) => ({ name, fps, loop, frames });
  const Fr = (duration, paint) => ({ duration, paint });
  const ms = fps => Math.round(1000 / fps);
  const OUT32 = PF.Color.hexToU32('#181425');
  const finish = (buf, W, H) => buf.set(PF.Raster.outline(buf, W, H, OUT32));
  const K = '#181425';

  /* A UI frame is drawn to the canvas edge, so the usual outline() pass has
     nowhere to write and is a no-op — we still run it so a sprite that does
     float inside the canvas (cursors, icons) gets its silhouette closed. */
  const ui = painter => (buf, W, H) => { painter(P().makeApi(buf, W, H), W, H); finish(buf, W, H); };
  const still = painter => [Fr(250, ui(painter))];
  const seq = (n, fps, make) => Array.from({ length: n }, (_, i) =>
    Fr(ms(fps), ui((a, W, H) => make(a, i, n > 1 ? i / (n - 1) : 0, W, H))));

  /* ---- shared primitives ---- */

  // Rounded rect: the 1px corner notch is what separates a UI panel from a
  // programmer-art box. cut=0 draws a plain rect.
  function rr(api, x0, y0, x1, y1, c, cut = 1) {
    api.rect(x0, y0, x1, y1, c);
    if (!cut) return;
    for (let i = 0; i < cut; i++) for (let j = 0; j < cut - i; j++) {
      api.px(x0 + i, y0 + j, 0); api.px(x1 - i, y0 + j, 0);
      api.px(x0 + i, y1 - j, 0); api.px(x1 - i, y1 - j, 0);
    }
  }

  /* Panel themes. br = border ramp (dark/mid/light), bg = interior ramp,
     acc = corner stud / rivet colour. */
  const THEMES = {
    wood:    { br: ['#3d2a25', '#8f563b', '#c08552'], bg: ['#5c3c2e', '#3d2a25'], acc: '#fee761' },
    stone:   { br: ['#262b44', '#5a6988', '#8b9bb4'], bg: ['#3a4466', '#262b44'], acc: '#c0cbdc' },
    parch:   { br: ['#733e39', '#b86f50', '#e4a672'], bg: ['#f0d6a8', '#d9b380'], acc: '#733e39' },
    dark:    { br: ['#10101c', '#262b44', '#3a4466'], bg: ['#1c2039', '#10101c'], acc: '#b55088' },
    scifi:   { br: ['#0b2a3a', '#0099db', '#2ce8f5'], bg: ['#102a43', '#0a1a2a'], acc: '#2ce8f5' },
    ornate:  { br: ['#4a3512', '#a07a1e', '#fee761'], bg: ['#2b2137', '#191325'], acc: '#e43b44' }
  };

  // 9-slice panel: 1px outline, 2px bevelled border band, flat gradient centre.
  function panel(api, x0, y0, x1, y1, th, opts = {}) {
    rr(api, x0, y0, x1, y1, K, 2);
    rr(api, x0 + 1, y0 + 1, x1 - 1, y1 - 1, th.br[1], 1);
    api.rect(x0 + 2, y0 + 1, x1 - 2, y0 + 1, th.br[2]);   // lit top
    api.rect(x0 + 1, y0 + 2, x0 + 1, y1 - 2, th.br[2]);   // lit left
    api.rect(x0 + 2, y1 - 1, x1 - 2, y1 - 1, th.br[0]);   // shaded bottom
    api.rect(x1 - 1, y0 + 2, x1 - 1, y1 - 2, th.br[0]);   // shaded right
    api.rectO(x0 + 3, y0 + 3, x1 - 3, y1 - 3, K);
    api.grad(x0 + 4, y0 + 4, x1 - 4, y1 - 4, th.bg[0], th.bg[1]);
    if (opts.studs) {
      const s = th.acc;
      [[x0 + 3, y0 + 3], [x1 - 3, y0 + 3], [x0 + 3, y1 - 3], [x1 - 3, y1 - 3]].forEach(([x, y]) => {
        api.rect(x - 1, y - 1, x + 1, y + 1, th.br[0]); api.px(x, y, s);
      });
    }
    if (opts.glass) { // soft diagonal sheen across the interior
      for (let y = y0 + 4; y <= y1 - 4; y++) for (let x = x0 + 4; x <= x1 - 4; x++)
        if (((x + y) % 9) === 0) api.px(x, y, th.br[2]);
    }
  }

  /* ================= PANELS & FRAMES ================= */
  function panelSuite() {
    const states = Object.keys(THEMES).map(k => D('panel_' + k, 4, false, still(a => panel(a, 0, 0, 63, 47, THEMES[k], { studs: k !== 'scifi' }))));
    // an ornate window with a title bar and a pinned close button
    states.push(D('window_titled', 4, false, still(a => {
      panel(a, 0, 0, 63, 47, THEMES.stone, { studs: true });
      a.rect(4, 4, 59, 11, '#5a6988'); a.rect(4, 4, 59, 4, '#8b9bb4'); a.rect(4, 11, 59, 11, '#262b44');
      a.rect(52, 5, 58, 10, '#a22633'); a.line(54, 6, 57, 9, '#ffffff'); a.line(57, 6, 54, 9, '#ffffff');
      for (let x = 8; x < 48; x += 4) a.rect(x, 7, x + 2, 8, '#c0cbdc'); // title text stand-in
      for (let y = 16; y <= 42; y += 6) { a.rect(6, y, 50, y + 1, '#3a4466'); a.rect(6, y, 30, y, '#5a6988'); }
      a.rect(56, 16, 58, 42, '#262b44'); a.rect(56, 18, 58, 26, '#8b9bb4'); // scrollbar
    })));
    // tab strip, 3 tabs, first active
    states.push(D('tabs', 4, false, still(a => {
      for (let i = 0; i < 3; i++) {
        const x = 1 + i * 21, on = i === 0;
        rr(a, x, 2, x + 19, 12, K, 1);
        a.rect(x + 1, 3, x + 18, 11, on ? '#8f563b' : '#3d2a25');
        a.rect(x + 2, 3, x + 17, 3, on ? '#c08552' : '#5c3c2e');
        for (let d = 0; d < 4; d++) a.rect(x + 5 + d * 3, 6, x + 6 + d * 3, 8, on ? '#fee761' : '#8f563b');
      }
      panel(a, 0, 10, 63, 47, THEMES.wood, { studs: true });
    })));
    // tooltip / speech nub
    states.push(D('tooltip', 4, false, still(a => {
      panel(a, 4, 6, 59, 33, THEMES.dark);
      for (let y = 12; y <= 27; y += 5) a.rect(9, y, 9 + 20 + (y % 7) * 3, y + 1, '#8b9bb4');
      a.line(26, 34, 32, 34, K); a.line(27, 35, 31, 35, K); a.line(28, 36, 30, 36, K); a.px(29, 37, K);
      a.line(27, 34, 31, 34, '#1c2039'); a.line(28, 35, 30, 35, '#1c2039'); a.px(29, 36, '#10101c');

    })));
    return { width: 64, height: 48, name: 'ui-panels', layers: [{ name: 'UI' }], states };
  }

  /* ================= BUTTONS ================= */
  // Frames are the interaction states, not an animation: idle → hover → press →
  // disabled. loop:false so a preview does not cycle them like a walk.
  function buttonSuite() {
    const RAMPS = {
      green: ['#265c42', '#3e8948', '#63c74d', '#a7f070'],
      blue:  ['#124e89', '#0099db', '#2ce8f5', '#b3f2ff'],
      red:   ['#6a1b28', '#a22633', '#e43b44', '#ff8d7a'],
      gold:  ['#7a4a10', '#c07f1c', '#feae34', '#fee761'],
      stone: ['#262b44', '#3a4466', '#5a6988', '#8b9bb4'],
      dark:  ['#10101c', '#1c2039', '#3a4466', '#5a6988']
    };
    const btn = (a, r, mode) => {
      const sunk = mode === 2, off = sunk ? 1 : 0;
      if (!sunk) a.rect(2, 13, 45, 15, '#10101c'); // drop shadow, gone when pressed
      rr(a, 1, 1 + off, 45, 13 + off, K, 2);
      a.grad(2, 2 + off, 44, 12 + off, mode === 1 ? r[3] : r[2], r[1]);
      a.rect(3, 2 + off, 43, 2 + off, mode === 1 ? '#ffffff' : r[3]);
      a.rect(3, 12 + off, 43, 12 + off, r[0]);
      a.rect(2, 3 + off, 2, 11 + off, r[3]); a.rect(44, 3 + off, 44, 11 + off, r[0]);
      if (mode === 3) { // disabled: desaturate by dithering the interior to grey
        for (let y = 2 + off; y <= 12 + off; y++) for (let x = 2; x <= 44; x++)
          if (((x + y) & 1) === 0) a.px(x, y, '#3a4466');
      }
      const lab = mode === 3 ? '#5a6988' : mode === 2 ? r[3] : '#ffffff';
      for (let d = 0; d < 5; d++) a.rect(12 + d * 5, 6 + off, 14 + d * 5, 9 + off, lab); // label blocks
      if (mode === 1) { a.px(1, 1, r[3]); a.px(45, 1, r[3]); a.px(1, 13, r[3]); a.px(45, 13, r[3]); }
    };
    const states = Object.keys(RAMPS).map(k =>
      D('btn_' + k, 3, false, seq(4, 3, (a, i) => btn(a, RAMPS[k], i))));
    // small square icon buttons: idle / hover / press
    states.push(D('btn_icon', 3, false, seq(3, 3, (a, i) => {
      for (let n = 0; n < 3; n++) {
        const x = 2 + n * 16, sunk = i === 2, o = sunk ? 1 : 0;
        if (!sunk) a.rect(x + 1, 13, x + 13, 14, '#10101c');
        rr(a, x, o, x + 13, 13 + o, K, 1);
        a.grad(x + 1, 1 + o, x + 12, 12 + o, i === 1 ? '#8b9bb4' : '#5a6988', '#262b44');
        a.rect(x + 2, 1 + o, x + 11, 1 + o, i === 1 ? '#e8ecf5' : '#8b9bb4');
        const c = i === 3 ? '#5a6988' : '#fee761';
        if (n === 0) { a.rect(x + 6, 3 + o, x + 7, 10 + o, c); a.rect(x + 3, 6 + o, x + 10, 7 + o, c); }
        if (n === 1) { a.rect(x + 3, 6 + o, x + 10, 7 + o, c); }
        if (n === 2) { a.line(x + 3, 3 + o, x + 10, 10 + o, c); a.line(x + 10, 3 + o, x + 3, 10 + o, c); }
      }
    })));
    return { width: 48, height: 16, name: 'ui-buttons', layers: [{ name: 'UI' }], states };
  }

  /* ================= BARS & METERS ================= */
  function barSuite() {
    // Frames step the fill 100%→0% so the strip doubles as a drain animation.
    const bar = (a, y, ramp, pct, opts = {}) => {
      const x0 = 2, x1 = 61, h = opts.h || 7;
      rr(a, x0, y, x1, y + h, K, 1);
      a.rect(x0 + 1, y + 1, x1 - 1, y + h - 1, '#10101c');
      const w = Math.round((x1 - x0 - 2) * pct);
      if (w > 0) {
        a.grad(x0 + 1, y + 1, x0 + w, y + h - 1, ramp[2], ramp[0]);
        a.rect(x0 + 1, y + 1, x0 + w, y + 1, ramp[3]);
        a.px(x0 + w, y + 1, '#ffffff');
        if (opts.gloss) for (let x = x0 + 1; x <= x0 + w; x += 3) a.px(x, y + 2, ramp[3]);
      }
      if (opts.ticks) for (let x = x0 + 6; x < x1 - 1; x += 6) a.rect(x, y + 1, x, y + h - 1, '#10101c');
    };
    const mk = (ramp, opts) => seq(5, 6, (a, i, t) => {
      bar(a, 1, ramp, 1 - t, opts);
      bar(a, 10, ramp, Math.max(0, 1 - t * 1.4), opts); // a second, faster "chip" bar
    });
    const states = [
      D('bar_hp', 6, false, mk(['#6a1b28', '#a22633', '#e43b44', '#ff8d7a'], { gloss: true })),
      D('bar_mp', 6, false, mk(['#124e89', '#0099db', '#2ce8f5', '#b3f2ff'], { gloss: true })),
      D('bar_xp', 6, false, mk(['#265c42', '#3e8948', '#63c74d', '#a7f070'], { ticks: true })),
      D('bar_stam', 6, false, mk(['#7a4a10', '#c07f1c', '#feae34', '#fee761'], { ticks: true })),
      D('bar_boss', 6, false, mk(['#3e2347', '#68386c', '#b55088', '#ff8d7a'], { gloss: true, ticks: true }))
    ];
    // Segmented hearts, draining half a heart per frame. The shape is a span
    // table so a half heart is the same silhouette clipped at x<=4 — drawing an
    // empty box over the right side left a ragged notch instead.
    const HEART_ROWS = [[[2, 3], [6, 7]], [[1, 8]], [[0, 9]], [[0, 9]], [[0, 9]], [[1, 8]], [[2, 7]], [[3, 6]], [[4, 5]]];
    const heart = (a, x, y, c, clip) => HEART_ROWS.forEach((spans, dy) => spans.forEach(([s0, s1]) => {
      const r = clip === undefined ? s1 : Math.min(s1, clip);
      if (r >= s0) a.rect(x + s0, y + dy, x + r, y + dy, c);
    }));
    states.push(D('hearts', 5, false, seq(5, 5, (a, i) => {
      const left = 10 - i * 2;
      for (let n = 0; n < 5; n++) {
        const x = 3 + n * 12, y = 4, full = left - n * 2;
        heart(a, x, y, '#3a4466');
        if (full >= 1) {
          heart(a, x, y, '#e43b44', full >= 2 ? undefined : 4);
          a.rect(x + 2, y + 2, x + 3, y + 2, '#ff8d7a'); a.px(x + 2, y + 3, '#ff8d7a');
          if (full >= 2) a.rect(x + 3, y + 7, x + 6, y + 7, '#a22633');
        }
      }
    })));
    // circular cooldown sweep
    states.push(D('cooldown', 8, true, seq(6, 8, (a, i, t) => {
      const cx = 32, cy = 9;
      a.ellipse(cx - 8, cy - 8, cx + 8, cy + 8, '#262b44', true);
      a.ellipse(cx - 7, cy - 7, cx + 7, cy + 7, '#1c2039', true);
      const end = t * Math.PI * 2 - Math.PI / 2;
      for (let s = 0; s <= 40; s++) {
        const ang = -Math.PI / 2 + (end + Math.PI / 2) * (s / 40);
        a.line(cx, cy, cx + Math.cos(ang) * 7, cy + Math.sin(ang) * 7, '#2ce8f5');
      }
      a.ellipse(cx - 3, cy - 3, cx + 3, cy + 3, '#10101c', true);
      a.rect(2, 2, 12, 16, '#3a4466'); a.rect(3, 3, 11, 15, '#5a6988'); // slot for context
      a.rect(51, 2, 61, 16, '#3a4466'); a.rect(52, 3, 60, 15, '#5a6988');
    })));
    return { width: 64, height: 19, name: 'ui-bars', layers: [{ name: 'UI' }], states };
  }

  /* ================= ICONS ================= */
  // 16 icons of 16px on a 64×64 sheet. Each painter draws into a translated
  // view so the icon maths stays in 0..15 local space.
  function iconGrid(api, painters) {
    painters.forEach((fn, n) => fn(P().offsetApi(api, (n % 4) * 16, Math.floor(n / 4) * 16)));
  }
  function iconSuite() {
    // Faceted cut stone: flat table, girdle, then a taper to the culet. A stack
    // of horizontal bars reads as a slime, so the silhouette narrows every row.
    const gem = (a, c0, c1) => {
      a.line(5, 2, 10, 2, c1); a.line(4, 3, 11, 3, c1);
      a.line(3, 4, 12, 4, c0); a.line(3, 5, 12, 5, c0);
      a.line(4, 6, 11, 6, c0); a.line(5, 7, 10, 7, c0);
      a.line(6, 8, 9, 8, c0); a.line(7, 9, 8, 10, c0);
      a.line(5, 4, 5, 6, c1); a.line(6, 2, 7, 2, '#ffffff'); a.px(9, 4, c1);
    };
    const items = [
      a => { a.line(7, 2, 7, 9, '#c0cbdc'); a.line(8, 3, 8, 9, '#e8ecf5'); a.rect(5, 10, 10, 11, '#8f563b'); a.rect(7, 12, 8, 14, '#733e39'); a.px(7, 3, '#ffffff'); }, // sword
      a => { a.rect(3, 2, 12, 8, '#5a6988'); a.rect(4, 9, 11, 10, '#5a6988'); a.rect(5, 11, 10, 11, '#3a4466'); a.rect(6, 12, 9, 12, '#3a4466'); a.rect(7, 13, 8, 13, '#3a4466'); a.rect(3, 2, 12, 2, '#c0cbdc'); a.rect(3, 3, 4, 8, '#8b9bb4'); a.rect(6, 4, 9, 7, '#fee761'); a.rect(7, 5, 8, 10, '#feae34'); }, // shield
      a => { a.rect(6, 2, 9, 3, '#8b9bb4'); a.rect(5, 4, 10, 5, '#c0cbdc'); a.blob(8, 9, 4, 4, '#e43b44', '#ff8d7a', '#a22633'); a.px(6, 7, '#ffffff'); }, // potion
      a => { a.ellipse(3, 4, 12, 12, '#c07f1c', true); a.ellipse(4, 5, 11, 11, '#feae34', true); a.ellipse(6, 7, 9, 9, '#fee761', true); a.px(6, 6, '#ffffff'); }, // coin
      a => { a.ellipse(4, 2, 10, 8, '#feae34', false); a.ellipse(5, 3, 9, 7, '#c07f1c', false); a.rect(7, 8, 8, 14, '#feae34'); a.rect(9, 10, 11, 11, '#feae34'); a.rect(9, 13, 10, 14, '#feae34'); }, // key
      a => gem(a, '#0099db', '#2ce8f5'), // gem
      a => { a.rect(3, 4, 12, 11, '#f0d6a8'); a.rect(3, 4, 12, 4, '#d9b380'); a.rect(2, 3, 3, 12, '#b86f50'); a.rect(12, 3, 13, 12, '#b86f50'); for (let y = 6; y <= 10; y += 2) a.rect(5, y, 10, y, '#8f563b'); }, // scroll
      a => { a.ellipse(4, 6, 11, 13, '#c07f1c', false); a.ellipse(5, 7, 10, 12, '#feae34', false); a.px(5, 11, '#fee761'); a.rect(6, 2, 9, 5, '#e43b44'); a.rect(7, 1, 8, 2, '#ff8d7a'); a.rect(6, 5, 9, 5, '#a22633'); a.px(7, 3, '#ffffff'); }, // ring
      a => { a.blob(8, 9, 4, 4, '#262b44', '#3a4466', '#10101c'); a.line(9, 4, 11, 2, '#8f563b'); a.px(12, 1, '#feae34'); a.px(11, 1, '#fee761'); a.px(12, 2, '#f77622'); }, // bomb
      a => { a.rect(3, 3, 12, 12, '#a22633'); a.rect(4, 4, 11, 11, '#e43b44'); a.rect(3, 3, 12, 3, '#ff8d7a'); a.rect(5, 5, 10, 10, '#f0d6a8'); a.rect(5, 5, 10, 5, '#ffffff'); a.rect(3, 6, 12, 7, '#feae34'); }, // book
      a => { a.rect(3, 6, 12, 13, '#8f563b'); a.rect(3, 4, 12, 6, '#c08552'); a.rect(3, 4, 12, 4, '#e4a672'); a.rect(6, 6, 9, 10, '#feae34'); a.px(7, 8, '#181425'); a.rect(3, 13, 12, 13, '#5c3c2e'); }, // chest
      a => { a.blob(8, 7, 4, 4, '#e8ecf5', '#ffffff', '#8b9bb4'); a.rect(5, 6, 6, 8, '#181425'); a.rect(9, 6, 10, 8, '#181425'); a.rect(5, 11, 10, 13, '#e8ecf5'); a.px(7, 12, '#8b9bb4'); a.px(9, 12, '#8b9bb4'); }, // skull
      a => { a.rect(8, 2, 8, 14, '#8f563b'); a.line(8, 1, 5, 5, '#c0cbdc'); a.line(8, 1, 11, 5, '#c0cbdc'); a.rect(7, 2, 9, 4, '#e8ecf5'); a.px(8, 1, '#ffffff'); a.line(5, 9, 8, 12, '#e43b44'); a.line(11, 9, 8, 12, '#e43b44'); a.line(5, 11, 8, 14, '#a22633'); a.line(11, 11, 8, 14, '#a22633'); }, // arrow
      a => { a.ellipse(2, 3, 13, 14, '#c0cbdc', true); a.ellipse(3, 4, 12, 13, '#1c2039', true); a.line(8, 6, 8, 9, '#2ce8f5'); a.line(8, 9, 11, 9, '#2ce8f5'); a.px(8, 3, '#8b9bb4'); a.px(8, 14, '#8b9bb4'); }, // clock
      a => { a.line(3, 5, 12, 5, '#b86f50'); a.rect(4, 6, 11, 13, '#8f563b'); a.rect(5, 7, 10, 12, '#3e8948'); a.line(6, 3, 6, 5, '#63c74d'); a.line(9, 2, 9, 5, '#63c74d'); a.px(7, 4, '#a7f070'); }, // herb pouch
      a => { a.rect(6, 2, 9, 13, '#fee761'); a.rect(2, 6, 13, 9, '#fee761'); a.rect(6, 2, 9, 2, '#ffffff'); a.rect(2, 6, 2, 9, '#ffffff'); a.rect(6, 13, 9, 13, '#c07f1c'); a.rect(13, 6, 13, 9, '#c07f1c'); } // plus / heal
    ];
    const uiIcons = [
      a => { for (let k = 0; k < 6; k++) { const ang = k / 6 * Math.PI * 2, x = 8 + Math.cos(ang) * 6, y = 8 + Math.sin(ang) * 6; a.rect(x - 1, y - 1, x + 1, y + 1, '#8b9bb4'); } a.ellipse(3, 3, 12, 12, '#c0cbdc', true); a.ellipse(4, 4, 11, 11, '#8b9bb4', true); a.ellipse(6, 6, 9, 9, '#262b44', true); a.px(5, 5, '#e8ecf5'); a.px(6, 4, '#e8ecf5'); }, // gear
      a => { a.line(8, 2, 2, 8, '#c08552'); a.line(8, 2, 14, 8, '#c08552'); a.rect(3, 8, 12, 13, '#8f563b'); a.rect(4, 9, 11, 12, '#c08552'); a.rect(6, 10, 9, 13, '#5c3c2e'); }, // home
      a => { a.line(3, 3, 12, 12, '#e43b44'); a.line(4, 3, 12, 11, '#ff8d7a'); a.line(12, 3, 3, 12, '#e43b44'); a.line(11, 3, 3, 11, '#ff8d7a'); }, // close
      a => { a.line(3, 8, 6, 12, '#63c74d'); a.line(3, 7, 6, 11, '#a7f070'); a.line(6, 12, 13, 4, '#63c74d'); a.line(6, 11, 13, 3, '#a7f070'); }, // check
      a => { a.line(5, 3, 11, 8, '#c0cbdc'); a.line(5, 4, 10, 8, '#e8ecf5'); a.line(11, 8, 5, 13, '#c0cbdc'); a.line(10, 8, 5, 12, '#e8ecf5'); }, // chevron right
      a => { a.rect(4, 3, 6, 13, '#c0cbdc'); a.rect(9, 3, 11, 13, '#c0cbdc'); a.rect(4, 3, 6, 3, '#ffffff'); a.rect(9, 3, 11, 3, '#ffffff'); }, // pause
      a => { for (let y = 0; y < 11; y++) { const w = Math.round((1 - Math.abs(y - 5) / 5.5) * 9); a.line(4, 3 + y, 4 + w, 3 + y, '#63c74d'); } a.line(4, 3, 4, 13, '#a7f070'); }, // play
      a => { a.rect(2, 3, 13, 13, '#5a6988'); a.rect(3, 4, 12, 8, '#c0cbdc'); a.rect(5, 9, 10, 13, '#e8ecf5'); a.rect(6, 10, 9, 12, '#3a4466'); a.rect(10, 4, 11, 7, '#3a4466'); }, // save
      a => { a.rect(4, 4, 11, 13, '#5a6988'); a.rect(5, 5, 10, 12, '#8b9bb4'); a.rect(3, 2, 12, 3, '#c0cbdc'); a.rect(6, 1, 9, 2, '#c0cbdc'); for (let x = 6; x <= 9; x += 3) a.rect(x, 6, x, 11, '#3a4466'); }, // trash
      a => { a.ellipse(2, 2, 10, 10, '#c0cbdc', false); a.ellipse(3, 3, 9, 9, '#2ce8f5', false); a.line(9, 9, 13, 13, '#c0cbdc'); a.line(10, 9, 13, 12, '#8b9bb4'); }, // search
      a => { a.line(8, 1, 10, 6, '#fee761'); a.line(8, 1, 6, 6, '#fee761'); a.rect(2, 6, 13, 7, '#fee761'); a.line(4, 8, 6, 14, '#feae34'); a.line(12, 8, 10, 14, '#feae34'); a.rect(6, 8, 9, 10, '#fee761'); a.rect(6, 12, 9, 14, '#feae34'); a.px(8, 3, '#ffffff'); }, // star
      a => { a.rect(4, 4, 11, 8, '#e43b44'); a.rect(3, 5, 12, 7, '#e43b44'); a.rect(5, 3, 6, 4, '#e43b44'); a.rect(9, 3, 10, 4, '#e43b44'); a.rect(5, 9, 10, 9, '#e43b44'); a.rect(6, 10, 9, 11, '#e43b44'); a.rect(7, 12, 8, 12, '#a22633'); a.rect(5, 5, 6, 6, '#ff8d7a'); }, // heart
      a => { a.rect(3, 7, 12, 14, '#feae34'); a.rect(4, 8, 11, 13, '#c07f1c'); a.ellipse(5, 2, 10, 9, '#8b9bb4', false); a.rect(7, 10, 8, 12, '#5c3c2e'); a.rect(3, 7, 12, 7, '#fee761'); }, // lock
      a => { a.line(2, 8, 5, 8, '#c0cbdc'); a.rect(5, 5, 7, 11, '#c0cbdc'); a.line(8, 3, 8, 13, '#e8ecf5'); a.line(10, 5, 11, 11, '#2ce8f5'); a.line(12, 3, 13, 13, '#2ce8f5'); }, // volume
      a => { a.ellipse(2, 2, 13, 13, '#0099db', true); a.ellipse(3, 3, 12, 12, '#2ce8f5', true); a.rect(7, 4, 8, 5, '#ffffff'); a.rect(7, 7, 8, 12, '#ffffff'); a.px(6, 12, '#ffffff'); a.px(9, 12, '#ffffff'); a.px(5, 5, '#b3f2ff'); }, // info
      a => { for (let k = 0; k < 8; k++) { const ang = k / 8 * Math.PI * 2, c = k < 3 ? '#e8ecf5' : k < 5 ? '#8b9bb4' : '#3a4466'; a.rect(8 + Math.cos(ang) * 5 - 1, 8 + Math.sin(ang) * 5 - 1, 8 + Math.cos(ang) * 5 + 1, 8 + Math.sin(ang) * 5 + 1, c); } } // spinner still
    ];
    const statIcons = [
      a => { a.rect(4, 4, 11, 8, '#e43b44'); a.rect(3, 5, 12, 7, '#e43b44'); a.rect(5, 3, 6, 4, '#e43b44'); a.rect(9, 3, 10, 4, '#e43b44'); a.rect(5, 9, 10, 9, '#e43b44'); a.rect(6, 10, 9, 11, '#e43b44'); a.rect(7, 12, 8, 12, '#a22633'); a.rect(5, 5, 6, 6, '#ff8d7a'); }, // HP
      a => { a.blob(8, 8, 5, 5, '#0099db', '#2ce8f5', '#124e89'); a.px(6, 5, '#ffffff'); a.px(7, 5, '#b3f2ff'); }, // MP
      a => { a.line(4, 11, 11, 4, '#c0cbdc'); a.line(5, 12, 12, 5, '#e8ecf5'); a.rect(10, 2, 13, 5, '#8b9bb4'); a.rect(3, 10, 6, 13, '#8f563b'); }, // ATK
      a => { a.rect(3, 2, 12, 8, '#3a4466'); a.rect(4, 9, 11, 10, '#3a4466'); a.rect(5, 11, 10, 11, '#262b44'); a.rect(6, 12, 9, 12, '#262b44'); a.rect(7, 13, 8, 13, '#262b44'); a.rect(3, 2, 12, 2, '#8b9bb4'); a.rect(3, 3, 4, 8, '#5a6988'); a.rect(7, 4, 8, 11, '#c0cbdc'); a.rect(5, 6, 10, 7, '#c0cbdc'); }, // DEF
      a => { a.line(2, 8, 10, 8, '#fee761'); a.line(4, 5, 11, 5, '#feae34'); a.line(4, 11, 11, 11, '#feae34'); a.line(10, 8, 7, 5, '#fee761'); a.line(10, 8, 7, 11, '#fee761'); }, // SPD
      a => { // four-leaf clover: the lobes are split by a dark cross, otherwise
        // they merge into one green slab at 16px.
        [[5, 5], [11, 5], [5, 11], [11, 11]].forEach(([cx, cy], n) => {
          a.ellipse(cx - 3, cy - 3, cx + 2, cy + 2, '#3e8948', true);
          a.ellipse(cx - 2, cy - 3, cx + 1, cy, n < 2 ? '#a7f070' : '#63c74d', true);
        });
        a.rect(8, 1, 8, 14, '#265c42'); a.rect(1, 8, 14, 8, '#265c42');
        a.rect(7, 7, 9, 9, '#265c42'); a.line(9, 10, 12, 15, '#265c42'); a.px(4, 3, '#ffffff'); }, // LUCK clover
      a => { a.ellipse(3, 3, 12, 12, '#68386c', true); a.ellipse(4, 4, 11, 11, '#b55088', true); a.line(5, 6, 10, 6, '#3e2347'); a.line(4, 8, 11, 8, '#3e2347'); a.line(5, 10, 10, 10, '#3e2347'); a.line(8, 4, 8, 11, '#3e2347'); a.px(6, 5, '#ff8d7a'); }, // INT
      a => { a.rect(2, 5, 4, 11, '#5a6988'); a.rect(11, 5, 13, 11, '#5a6988'); a.rect(1, 7, 1, 9, '#8b9bb4'); a.rect(14, 7, 14, 9, '#8b9bb4'); a.rect(5, 7, 10, 9, '#c0cbdc'); a.rect(5, 7, 10, 7, '#e8ecf5'); a.rect(2, 5, 4, 5, '#8b9bb4'); a.rect(11, 5, 13, 5, '#8b9bb4'); }, // STR
      a => { a.rect(3, 3, 12, 12, '#feae34'); a.rect(4, 4, 11, 11, '#fee761'); a.rect(6, 6, 9, 9, '#c07f1c'); a.px(5, 5, '#ffffff'); }, // gold stat
      a => { a.line(8, 1, 8, 14, '#2ce8f5'); a.line(8, 1, 4, 6, '#2ce8f5'); a.line(8, 1, 12, 6, '#2ce8f5'); a.line(4, 9, 8, 14, '#0099db'); a.line(12, 9, 8, 14, '#0099db'); }, // agility arrow
      a => { a.ellipse(3, 3, 12, 12, '#a22633', true); a.ellipse(4, 4, 11, 11, '#e43b44', true); a.line(3, 3, 12, 12, '#fee761'); a.line(12, 3, 3, 12, '#fee761'); a.px(8, 7, '#ffffff'); a.px(7, 8, '#ffffff'); }, // crit
      a => { a.rect(4, 2, 11, 4, '#8b9bb4'); a.rect(6, 5, 9, 13, '#c0cbdc'); a.rect(7, 5, 8, 13, '#e8ecf5'); a.rect(3, 13, 12, 14, '#5a6988'); }, // tower / def up
      a => { for (let y = 0; y < 6; y++) a.line(8 - y, 2 + y, 8 + y, 2 + y, '#63c74d'); a.rect(6, 8, 10, 13, '#3e8948'); a.rect(6, 8, 10, 8, '#63c74d'); a.px(8, 2, '#a7f070'); a.px(5, 6, '#a7f070'); }, // up arrow stat
      a => { for (let y = 0; y < 6; y++) a.line(3 + y, 8 + y, 13 - y, 8 + y, '#e43b44'); a.rect(6, 2, 10, 7, '#a22633'); a.rect(6, 2, 10, 2, '#e43b44'); a.px(8, 13, '#ff8d7a'); a.px(5, 9, '#ff8d7a'); }, // down arrow stat
      a => { a.ellipse(2, 5, 13, 11, '#f0d6a8', true); a.ellipse(5, 5, 10, 11, '#0099db', true); a.ellipse(6, 6, 9, 10, '#181425', true); a.px(7, 7, '#ffffff'); }, // perception eye
      a => { for (let k = 0; k < 6; k++) { const ang = k / 6 * Math.PI * 2 + 0.4; a.line(8, 8, 8 + Math.cos(ang) * 6, 8 + Math.sin(ang) * 6, '#fee761'); } a.ellipse(6, 6, 9, 9, '#ffffff', true); } // radiance
    ];
    return { width: 64, height: 64, name: 'ui-icons', layers: [{ name: 'UI' }], states: [
      D('icons_items', 4, false, still(a => iconGrid(a, items))),
      D('icons_ui', 4, false, still(a => iconGrid(a, uiIcons))),
      D('icons_stats', 4, false, still(a => iconGrid(a, statIcons)))
    ] };
  }

  /* ================= CURSORS ================= */
  function cursorSuite() {
    const arrow = (a, c, sh) => {
      for (let y = 0; y < 11; y++) a.line(1, 1 + y, 1 + Math.min(y, 6), 1 + y, c);
      a.line(6, 8, 8, 12, c); a.line(7, 8, 9, 12, c);
      a.rect(2, 2, 2, 9, sh); a.px(3, 3, sh);
    };
    const hand = (a, c, sh, grab) => {
      const top = grab ? 6 : 3;
      a.rect(4, top, 5, 9, c); a.rect(6, top + 1, 7, 9, c); a.rect(8, top + 2, 9, 9, c);
      a.rect(2, 6, 3, 10, c); a.rect(2, 9, 10, 13, c); a.rect(3, 10, 9, 12, sh);
      a.rect(3, 14, 9, 14, sh);
    };
    return { width: 16, height: 16, name: 'ui-cursors', layers: [{ name: 'UI' }], states: [
      D('cur_arrow', 4, false, still(a => arrow(a, '#ffffff', '#8b9bb4'))),
      D('cur_arrow_dark', 4, false, still(a => arrow(a, '#3a4466', '#181425'))),
      D('cur_hand', 4, false, still(a => hand(a, '#ffffff', '#c0cbdc', false))),
      D('cur_grab', 4, false, still(a => hand(a, '#ffffff', '#c0cbdc', true))),
      D('cur_cross', 4, false, still(a => {
        a.rect(7, 0, 8, 5, '#ffffff'); a.rect(7, 10, 8, 15, '#ffffff');
        a.rect(0, 7, 5, 8, '#ffffff'); a.rect(10, 7, 15, 8, '#ffffff');
        a.ellipse(5, 5, 10, 10, '#e43b44', false); a.px(7, 7, '#e43b44'); a.px(8, 8, '#e43b44');
      })),
      D('cur_sword', 4, false, still(a => {
        a.line(2, 13, 12, 3, '#c0cbdc'); a.line(3, 13, 13, 3, '#e8ecf5'); a.px(13, 2, '#ffffff');
        a.line(1, 10, 4, 13, '#8f563b'); a.rect(1, 12, 3, 14, '#733e39'); a.px(2, 13, '#feae34');
      })),
      D('cur_target', 4, false, still(a => {
        a.ellipse(1, 1, 14, 14, '#e43b44', false); a.ellipse(4, 4, 11, 11, '#ff8d7a', false);
        a.rect(7, 0, 8, 3, '#e43b44'); a.rect(7, 12, 8, 15, '#e43b44');
        a.rect(0, 7, 3, 8, '#e43b44'); a.rect(12, 7, 15, 8, '#e43b44');
      })),
      D('cur_wait', 8, true, seq(6, 8, (a, i) => {
        for (let k = 0; k < 8; k++) {
          const ang = k / 8 * Math.PI * 2, d = (k - i + 8) % 8;
          const c = d === 0 ? '#ffffff' : d === 1 ? '#c0cbdc' : d === 2 ? '#8b9bb4' : d === 3 ? '#5a6988' : '#3a4466';
          a.rect(7 + Math.cos(ang) * 5 - 1, 7 + Math.sin(ang) * 5 - 1, 7 + Math.cos(ang) * 5 + 1, 7 + Math.sin(ang) * 5 + 1, c);
        }
      }))
    ] };
  }

  /* ================= CONTROLS ================= */
  function controlSuite() {
    const states = [];
    // checkbox: off → hover → on → disabled
    states.push(D('checkbox', 3, false, seq(4, 3, (a, i) => {
      for (let n = 0; n < 2; n++) {
        const x = 6 + n * 24, y = 6;
        rr(a, x, y, x + 15, y + 15, K, 1);
        a.grad(x + 1, y + 1, x + 14, y + 14, i === 1 ? '#5a6988' : '#3a4466', '#1c2039');
        a.rect(x + 1, y + 1, x + 14, y + 1, i === 1 ? '#8b9bb4' : '#5a6988');
        if (i >= 2 || n === 1) {
          const c = i === 3 ? '#5a6988' : '#63c74d';
          a.line(x + 3, y + 8, x + 6, y + 11, c); a.line(x + 3, y + 7, x + 6, y + 10, '#a7f070');
          a.line(x + 6, y + 11, x + 12, y + 4, c); a.line(x + 6, y + 10, x + 12, y + 3, '#a7f070');
        }
      }
    })));
    // toggle switch sliding left↔right
    states.push(D('toggle', 8, false, seq(5, 8, (a, i, t) => {
      const x0 = 5, y0 = 8, w = 36, h = 15;
      rr(a, x0, y0, x0 + w, y0 + h, K, 3);
      a.grad(x0 + 1, y0 + 1, x0 + w - 1, y0 + h - 1, t > 0.5 ? '#3e8948' : '#3a4466', t > 0.5 ? '#265c42' : '#1c2039');
      a.rect(x0 + 2, y0 + 1, x0 + w - 2, y0 + 1, t > 0.5 ? '#63c74d' : '#5a6988');
      const kx = Math.round(x0 + 2 + t * (w - 16));
      rr(a, kx, y0 + 2, kx + 11, y0 + h - 2, K, 2);
      a.grad(kx + 1, y0 + 3, kx + 10, y0 + h - 3, '#e8ecf5', '#8b9bb4');
      a.rect(kx + 2, y0 + 3, kx + 9, y0 + 3, '#ffffff');
      a.rect(kx + 5, y0 + 5, kx + 6, y0 + h - 5, '#5a6988');
    })));
    // slider track with a travelling knob and a filling groove
    states.push(D('slider', 8, false, seq(5, 8, (a, i, t) => {
      const x0 = 3, x1 = 44, y = 14;
      a.rect(x0, y, x1, y + 3, '#10101c'); a.rect(x0, y + 1, x1, y + 2, '#1c2039');
      const kx = Math.round(x0 + 2 + t * (x1 - x0 - 5));
      a.rect(x0, y + 1, kx, y + 2, '#2ce8f5'); a.rect(x0, y + 1, kx, y + 1, '#b3f2ff');
      rr(a, kx - 3, y - 4, kx + 4, y + 7, K, 1);
      a.grad(kx - 2, y - 3, kx + 3, y + 6, '#e8ecf5', '#8b9bb4');
      a.rect(kx - 1, y - 3, kx + 2, y - 3, '#ffffff');
      for (let n = 0; n <= 4; n++) a.px(x0 + 2 + n * 9, y + 6, '#5a6988');
    })));
    // radio group, selection walks down the list
    states.push(D('radio', 4, false, seq(3, 4, (a, i) => {
      for (let n = 0; n < 3; n++) {
        const y = 2 + n * 11; // 3 rows of 11 fit the 36px doc; 14 clipped the last
        a.ellipse(4, y, 13, y + 9, K, true);
        a.ellipse(5, y + 1, 12, y + 8, n === i ? '#5a6988' : '#3a4466', true);
        a.ellipse(6, y + 1, 11, y + 5, n === i ? '#8b9bb4' : '#5a6988', true);
        if (n === i) a.ellipse(7, y + 3, 10, y + 6, '#fee761', true);
        a.rect(17, y + 3, 17 + 14 + n * 4, y + 5, '#8b9bb4');
      }
    })));
    // stepper: - value +
    states.push(D('stepper', 4, false, seq(3, 4, (a, i) => {
      const mk = (x, sym, act) => {
        rr(a, x, 12, x + 11, 23, K, 1);
        a.grad(x + 1, 13, x + 10, 22, act ? '#8b9bb4' : '#5a6988', '#262b44');
        a.rect(x + 3, 17, x + 8, 18, '#ffffff');
        if (sym) a.rect(x + 5, 15, x + 6, 20, '#ffffff');
      };
      mk(2, false, i === 1); mk(34, true, i === 2);
      rr(a, 15, 12, 31, 23, K, 1); a.rect(16, 13, 30, 22, '#10101c');
      for (let d = 0; d <= i; d++) a.rect(18 + d * 4, 15, 19 + d * 4, 20, '#fee761');
    })));
    return { width: 48, height: 36, name: 'ui-controls', layers: [{ name: 'UI' }], states };
  }

  /* ================= DIALOGUE & SLOTS ================= */
  function dialogueSuite() {
    // cue < 0 hides the continue arrow; otherwise it bobs one row per frame and
    // vanishes on the last, so no two frames of the wait loop are identical.
    const box = (a, chars, cue) => {
      panel(a, 0, 0, 79, 39, THEMES.dark, { studs: true });
      a.rectO(5, 5, 24, 24, '#5a6988'); a.rect(6, 6, 23, 23, '#1c2039');           // portrait well
      a.blob(15, 16, 6, 7, '#e4a672', '#f0d6a8', '#b86f50');                       // stand-in face
      a.rect(10, 8, 20, 11, '#733e39'); a.px(12, 14, K); a.px(18, 14, K); a.rect(13, 18, 17, 18, '#b86f50');
      const text = [22, 24, 20, 23, 18];                                           // per-line word widths
      for (let l = 0; l < 3; l++) {
        const room = Math.max(0, Math.min(text[l], chars - l * 22));
        for (let d = 0; d < room; d += 4) a.rect(29 + d, 8 + l * 8, 31 + d, 12 + l * 8, '#c0cbdc');
      }
      if (cue >= 0 && cue < 3) {
        const y = 29 + cue;
        a.line(69, y, 75, y, '#feae34'); a.line(70, y + 1, 74, y + 1, '#fee761');
        a.line(71, y + 2, 73, y + 2, '#fee761'); a.px(72, y + 3, '#c07f1c');
      }
      a.rect(5, 28, 24, 34, '#10101c'); a.rect(6, 29, 23, 33, '#3a4466');          // name plate
      for (let d = 0; d < 4; d++) a.rect(8 + d * 4, 30, 9 + d * 4, 32, '#fee761');
    };
    return { width: 80, height: 40, name: 'ui-dialogue', layers: [{ name: 'UI' }], states: [
      D('typewriter', 8, false, seq(6, 8, (a, i) => box(a, i * 14, -1))),
      D('await_input', 4, true, seq(4, 4, (a, i) => box(a, 70, i)))
    ] };
  }

  function slotSuite() {
    const slot = (a, x, y, mode, rar, sel) => {
      rr(a, x, y, x + 17, y + 17, K, 1);
      a.grad(x + 1, y + 1, x + 16, y + 16, '#3a4466', '#1c2039');
      a.rect(x + 1, y + 1, x + 16, y + 1, '#5a6988');
      a.rect(x + 1, y + 16, x + 16, y + 16, '#10101c');
      if (rar) { a.rectO(x + 1, y + 1, x + 16, y + 16, rar); a.px(x + 1, y + 1, '#ffffff'); }

      if (mode === 'lock') {
        for (let yy = y + 1; yy <= y + 16; yy++) for (let xx = x + 1; xx <= x + 16; xx++) if ((xx + yy) & 1) a.px(xx, yy, '#10101c');
        a.rect(x + 6, y + 9, x + 11, y + 13, '#8b9bb4'); a.ellipse(x + 7, y + 5, x + 10, y + 10, '#8b9bb4', false);
      }
      if (mode === 'item') { a.ellipse(x + 4, y + 5, x + 13, y + 14, '#c07f1c', true); a.ellipse(x + 5, y + 6, x + 12, y + 13, '#feae34', true); a.px(x + 7, y + 8, '#fee761'); }
      // The highlight goes on last so a selected slot still shows its contents.
      if (sel) { a.rectO(x, y, x + 17, y + 17, '#fee761'); a.rectO(x + 1, y + 1, x + 16, y + 16, '#feae34'); }
    };
    const grid = (a, fn) => { for (let n = 0; n < 9; n++) fn(a, 2 + (n % 3) * 20, 2 + Math.floor(n / 3) * 20, n); };
    const RAR = [null, '#8b9bb4', '#63c74d', '#2ce8f5', '#b55088', '#feae34'];
    return { width: 62, height: 62, name: 'ui-slots', layers: [{ name: 'UI' }], states: [
      D('grid_empty', 4, false, still(a => grid(a, (b, x, y) => slot(b, x, y, 'empty')))),
      D('grid_items', 4, false, still(a => grid(a, (b, x, y, n) => slot(b, x, y, n % 4 === 3 ? 'empty' : 'item', n % 4 === 3 ? null : RAR[n % RAR.length])))),
      D('grid_locked', 4, false, still(a => grid(a, (b, x, y, n) => slot(b, x, y, n > 4 ? 'lock' : 'item')))),
      D('select_sweep', 6, true, seq(4, 6, (a, i) => grid(a, (b, x, y, n) => slot(b, x, y, 'item', RAR[n % RAR.length], n === i * 2))))
    ] };
  }

  return { panelSuite, buttonSuite, barSuite, iconSuite, cursorSuite, controlSuite, dialogueSuite, slotSuite, THEMES, panel };
})();
