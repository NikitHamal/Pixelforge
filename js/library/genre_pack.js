/* PixelForge Studio — Cross-genre production pack.
   Sci-fi, contemporary, platformer and arcade assets built from deterministic
   pixel maths. Every painter is pure, every frame receives the standard 1px
   outline, and figures keep their feet on rows 25..27. */
window.PF = window.PF || {};
PF.Genres = (() => {
  const OUT = '#181425', OUT32 = PF.Color.hexToU32(OUT);
  const D = (name, fps, loop, frames) => ({ name, fps, loop, frames });
  const Fr = (duration, paint) => ({ duration, paint });
  const ms = fps => Math.round(1000 / fps);
  const apiFor = (buf, W, H) => PF.Pixel.makeApi(buf, W, H);
  const finish = (buf, W, H) => buf.set(PF.Raster.outline(buf, W, H, OUT32));
  const frame = draw => (buf, W, H) => { const api = apiFor(buf, W, H); draw(api); finish(buf, W, H); };
  const state = (name, fps, count, draw, loop = true) => D(name, fps, loop,
    Array.from({ length: count }, (_, i) => Fr(ms(fps), frame(api => draw(api, i, count)))));
  const doc = (name, layer, states, width = 32, height = 32) => ({ width, height, name, layers: [{ name: layer }], states });

  const PAL = {
    marine: { dark: '#26344d', base: '#356b8c', hi: '#6fc3df', glow: '#66f5ff', skin: '#d69c7e', accent: '#f05b5b' },
    robot: { dark: '#34394f', base: '#707a91', hi: '#c8d3e6', glow: '#7df9aa', accent: '#ffcc66' },
    alien: { dark: '#334b3f', base: '#5f9e62', hi: '#a7d46f', glow: '#e4ff8a', accent: '#9a62d6' },
    survivor: { dark: '#3b3545', base: '#58735b', hi: '#9abf76', skin: '#d5a078', accent: '#e49b55' }
  };

  function humanoid(api, p, k, mode) {
    const walk = mode === 'walk' ? [-2, -1, 1, 2, 1, -1][k % 6]
      : mode === 'run' ? [-3, -2, 0, 2, 3, 2, 0, -2][k % 8] : 0;
    const bob = mode === 'run' ? [0, 1, 1, 0, 0, 1, 1, 0][k % 8] : 0;
    const lean = mode === 'run' ? 2 : 0;
    const y = bob;
    // legs and boots
    api.rect(12 + lean - walk, 21 + y, 14 + lean, 26, p.dark);
    api.rect(17 + lean, 21 + y, 19 + lean + walk, 26, p.dark);
    api.rect(10 + lean - walk, 26, 14 + lean, 27, OUT);
    api.rect(17 + lean, 26, 21 + lean + walk, 27, OUT);
    // torso armour/jacket with a readable lit plane
    api.rect(10 + lean, 10 + y, 21 + lean, 21 + y, p.base);
    api.rect(11 + lean, 10 + y, 19 + lean, 12 + y, p.hi);
    api.rect(10 + lean, 18 + y, 21 + lean, 21 + y, p.dark);
    const arm = walk ? Math.sign(walk) * Math.min(2, Math.abs(walk)) : (mode === 'idle' ? [0, 1, 0, -1][k % 4] : 0);
    api.rect(8 + lean, 12 + y - arm, 10 + lean, 20 + y - arm, p.dark);
    api.rect(21 + lean, 12 + y + arm, 23 + lean, 20 + y + arm, p.dark);
    // head/helmet
    api.rect(11 + lean, 3 + y, 20 + lean, 10 + y, p.dark);
    api.rect(12 + lean, 2 + y, 19 + lean, 4 + y, p.hi);
    if (p.skin) api.rect(13 + lean, 6 + y, 19 + lean, 9 + y, p.skin);
    else api.rect(12 + lean, 6 + y, 20 + lean, 8 + y, p.glow);
    api.px(19 + lean, 7 + y, '#ffffff');
    api.rect(13 + lean, 14 + y, 18 + lean, 15 + y, p.glow || p.accent);
    if (mode === 'idle') {
      // Feet, torso and head stay anchored; shoulder/hand counter-motion and a
      // slow equipment scan sell breathing without bouncing the whole body.
      const lx = 12 + (k % 4) * 2;
      api.rect(lx, 17 + y, lx + 1, 18 + y, k & 1 ? p.accent : (p.glow || p.hi));
    }
  }

  function blaster(api, x, y, recoil, p) {
    api.rect(x - recoil, y, x + 8 - recoil, y + 2, p.dark);
    api.rect(x + 2 - recoil, y - 1, x + 6 - recoil, y - 1, p.hi);
    api.rect(x + 1 - recoil, y + 3, x + 3 - recoil, y + 5, p.dark);
    api.px(x + 8 - recoil, y + 1, p.glow);
  }
  function figureSuite(name, p, kind) {
    const states = [
      state('idle', 6, 4, (a, k) => humanoid(a, p, k, 'idle')),
      state('walk', 10, 6, (a, k) => humanoid(a, p, k, 'walk')),
      state('run', 14, 6, (a, k) => { humanoid(a, p, k, 'run'); if (k & 1) PF.Pixel.dustPuff(a, 14, 27, k, .4, '#77829a', 3); }),
      state('attack', 12, 5, (a, k) => {
        humanoid(a, p, k, 'idle'); const recoil = k === 2 ? 2 : 0; blaster(a, 19, 14, recoil, p);
        if (k === 2) { a.line(27, 15, 31, 15, '#ffffff', 2); a.px(29, 14, p.glow); a.px(29, 16, p.glow); }
        else { for (let i = 0; i <= k; i++) a.px(24 + i, 11 + ((i + k) & 1), p.glow); }
      }, false),
      state('hurt', 10, 3, (a, k) => { humanoid(a, p, k, 'idle'); if (k === 1) PF.Pixel.impactStar(a, 22, 11, .2, ['#ffffff', p.accent], 5); }, false),
      state('death', 8, 5, (a, k) => {
        if (k < 3) { humanoid(a, p, k, 'idle'); a.line(23, 7 + k * 3, 28, 5 + k, p.accent, 1); }
        else { a.rect(5, 24, 25, 27, p.dark); a.rect(9, 22, 21, 24, p.base); a.rect(6, 23, 10, 25, p.hi); if (k === 3) PF.Pixel.impactStar(a, 23, 23, .3, ['#ffffff', p.accent], 4); }
      }, false)
    ];
    if (kind === 'jet') states.splice(3, 0, state('jet_dash', 16, 6, (a, k, n) => {
      humanoid(a, p, k, 'run'); const t = k / (n - 1);
      a.line(7, 17, 1 + t * 5, 17, p.glow, 2); a.line(8, 19, 3 + t * 4, 20, p.accent, 1);
    }, false));
    return doc(name, 'Character', states);
  }

  function marineSuite() { return figureSuite('nova-marine', PAL.marine, 'jet'); }

  function robotSuite() {
    const p = PAL.robot;
    const d = figureSuite('service-droid', p);
    d.states.splice(3, 0, state('repair', 8, 6, (a, k) => {
      humanoid(a, p, k, 'idle'); const x = 22 + (k & 1), y = 20 - Math.min(k, 3);
      a.line(21, 16, x, y, p.hi, 2); a.px(x + 1, y, '#ffffff'); a.px(x + 2, y - 1, p.accent);
    }));
    return d;
  }

  function alienSuite() {
    const p = PAL.alien;
    const d = figureSuite('void-stalker', p);
    d.states[3] = state('claw_combo', 14, 6, (a, k) => {
      humanoid(a, p, k, 'run');
      const ang = -1.6 + k * .55; a.line(22, 15, 22 + Math.cos(ang) * 8, 15 + Math.sin(ang) * 8, p.hi, 2);
      if (k > 1 && k < 5) PF.Pixel.arcTrail(a, 22, 15, 9, ang - .8, ang, [p.accent, p.glow, '#ffffff'], { width: 2 });
    }, false);
    return d;
  }

  function survivorSuite() {
    const p = PAL.survivor;
    const d = figureSuite('urban-survivor', p);
    d.states[3] = state('melee', 12, 6, (a, k) => {
      humanoid(a, p, k, 'idle'); const ang = -2 + k * .55;
      a.line(20, 15, 20 + Math.cos(ang) * 10, 15 + Math.sin(ang) * 10, '#b9c5d4', 2);
      if (k > 1 && k < 5) PF.Pixel.arcTrail(a, 20, 15, 10, ang - .65, ang, ['#596675', '#b9c5d4', '#ffffff'], { width: 2 });
    }, false);
    return d;
  }

  function vehicle(api, k, kind) {
    const bounce = k & 1, body = kind === 'hover' ? '#7b5cd6' : kind === 'buggy' ? '#d56a45' : '#3f8f78';
    const hi = kind === 'hover' ? '#b79cff' : kind === 'buggy' ? '#ffb05c' : '#78d3b3';
    if (kind === 'bike') {
      aWheel(api, 8, 23 + bounce, 5); aWheel(api, 24, 23 + bounce, 5);
      api.line(8, 22 + bounce, 16, 15 + bounce, body, 3); api.line(16, 15 + bounce, 24, 22 + bounce, body, 3);
      api.rect(13, 13 + bounce, 20, 16 + bounce, hi); api.line(21, 15 + bounce, 24, 10 + bounce, '#c8d3e6', 2);
    } else {
      if (kind === 'buggy') { aWheel(api, 8, 24 + bounce, 4); aWheel(api, 24, 24 + bounce, 4); }
      api.rect(4, 15 + bounce, 27, 24 + bounce, body); api.rect(8, 11 + bounce, 22, 16 + bounce, hi);
      api.rect(11, 12 + bounce, 20, 15 + bounce, '#26344d'); api.rect(5, 16 + bounce, 26, 18 + bounce, hi);
      if (kind === 'hover') { api.rect(7, 25 + bounce, 24, 26 + bounce, '#66f5ff'); api.px(4, 26, '#ffffff'); api.px(27, 26, '#ffffff'); }
    }
  }
  function aWheel(api, x, y, r) { api.ellipse(x - r, y - r, x + r, y + r, OUT, true); api.ellipse(x - r + 2, y - r + 2, x + r - 2, y + r - 2, '#707a91', true); api.px(x, y, '#ffffff'); }
  function vehiclesSuite() {
    const states = [];
    ['buggy', 'hover', 'bike'].forEach(kind => {
      states.push(state(kind + '_idle', 6, 4, (a, k) => vehicle(a, k, kind)));
      states.push(state(kind + '_drive', 12, 6, (a, k) => { vehicle(a, k, kind); PF.Pixel.dustPuff(a, 7, 28, k, .5, kind === 'hover' ? '#66f5ff' : '#9a8570', 4); }));
    });
    return doc('arcade-vehicles', 'Vehicle', states);
  }

  function platformerSuite() {
    const p = { dark: '#284840', base: '#e05263', hi: '#ff9b72', skin: '#ffd0a6', accent: '#66d9a5', glow: '#ffe66d' };
    const states = [
      state('idle', 6, 4, (a, k) => humanoid(a, p, k, 'idle')),
      state('run', 14, 8, (a, k) => humanoid(a, p, k, 'run')),
      state('jump_rise', 12, 4, (a, k) => { humanoid(a, p, k, 'run'); a.rect(9, 25 - k, 12, 27 - k, p.accent); }, false),
      state('fall', 10, 3, (a, k) => { humanoid(a, p, k, 'idle'); a.line(7, 14 + k, 4, 18 + k, p.hi, 2); }, false),
      state('wall_slide', 8, 4, (a, k) => { humanoid(a, p, k, 'idle'); a.rect(26, 2, 28, 27, '#586575'); for (let i = 0; i < 4; i++) a.px(23 + (i & 1), 15 + ((i * 3 + k * 2) % 10), i & 1 ? '#ffffff' : p.glow); }),
      state('dash', 16, 6, (a, k) => { humanoid(a, p, k, 'run'); a.line(8, 12, Math.max(0, 6 - k), 12, p.glow, 2); a.line(8, 18, Math.max(0, 4 - k), 19, p.accent, 2); }, false)
    ];
    return doc('platform-runner', 'Character', states);
  }

  function cyberTilesSuite() {
    const tile = (api, ox, oy, type, k) => {
      const a = PF.Pixel.offsetApi(api, ox, oy);
      if (type === 0) { a.rect(0, 0, 15, 15, '#253047'); a.rect(1, 1, 14, 14, '#35445c'); a.line(2, 12, 12, 2, '#4c6075', 1); a.px(3, 3, '#66f5ff'); }
      if (type === 1) { a.rect(0, 0, 15, 15, '#182238'); for (let x = 2; x < 15; x += 4) a.line(x, 0, x, 15, '#7b5cd6', 1); a.line(0, 7 + (k & 1), 15, 7 + (k & 1), '#66f5ff', 2); }
      if (type === 2) { a.rect(0, 0, 15, 15, '#394457'); a.rect(2, 2, 13, 13, '#222c3d'); a.rect(5, 5, 10, 10, '#d56a45'); a.px(7, 7, '#ffe66d'); }
      if (type === 3) { a.rect(0, 0, 15, 15, '#12192b'); for (let i = 0; i < 6; i++) a.px((i * 7 + k * 3) % 16, (i * 11 + k) % 16, i & 1 ? '#66f5ff' : '#7b5cd6'); }
    };
    return doc('cyber-tiles', 'Tiles', [state('animated_sheet', 6, 4, (a, k) => {
      for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) tile(a, x * 16, y * 16, (x + y) % 4, k);
    })], 64, 64);
  }

  function projectilesSuite() {
    const entries = [
      ['plasma_bolt', '#66f5ff'], ['laser_burst', '#ff5c78'], ['rocket', '#ffb05c'],
      ['electric_orb', '#b79cff'], ['acid_glob', '#7df9aa'], ['shield_hit', '#c8d3e6']
    ];
    return doc('sci-fi-projectiles', 'Effects', entries.map(([name, color], n) => state(name, 12, 6, (a, k) => {
      const t = k / 5, x = 5 + Math.round(t * 21), y = 16 + Math.round(Math.sin(t * Math.PI * 2 + n) * 2);
      if (name === 'shield_hit') { a.ellipse(16 - k, 16 - k, 16 + k, 16 + k, color, false); PF.Pixel.sparks(a, 16, 16, k, '#ffffff', 6, 2, 3 + k); }
      else if (name === 'rocket') { a.rect(x - 3, y - 2, x + 3, y + 2, '#c8d3e6'); a.px(x + 4, y, '#ffffff'); a.line(x - 4, y, x - 8, y, color, 2); }
      else { a.blob(x, y, 3, 3, color, '#ffffff', n & 1 ? '#7b5cd6' : '#287a8a'); a.line(x - 4, y, x - 8, y, color, 1); }
    })));
  }

  function sciFiUISuite() {
    const panel = (a, k, warning) => {
      a.rect(3, 5, 28, 26, '#182238'); a.rectO(3, 5, 28, 26, '#66f5ff', 1);
      a.rect(6, 8, 25, 10, warning ? '#ff5c78' : '#35445c'); a.rect(6, 13, 14 + k * 2, 15, warning ? '#ffb05c' : '#7df9aa');
      a.rect(7 + k * 4, 9, 9 + k * 4, 9, '#ffffff');
      a.rect(6, 19, 9, 22, '#7b5cd6'); a.rect(12, 19, 15, 22, '#66f5ff'); a.rect(18, 19, 25, 22, '#35445c');
    };
    return doc('sci-fi-interface', 'UI', [
      state('hud_panel', 5, 4, (a, k) => panel(a, k, false)),
      state('warning_panel', 8, 4, (a, k) => panel(a, k & 1 ? 3 : 0, true)),
      state('target_reticle', 10, 6, (a, k) => { const r = 10 - (k % 3); a.ellipse(16 - r, 16 - r, 16 + r, 16 + r, '#66f5ff', false); a.line(3, 16, 10, 16, '#ffffff'); a.line(22, 16, 29, 16, '#ffffff'); a.px(16, 16, '#ff5c78'); }),
      state('radar', 8, 8, (a, k) => { a.ellipse(4, 4, 28, 28, '#35445c', true); a.ellipse(5, 5, 27, 27, '#182238', true); const ang = k / 8 * Math.PI * 2; a.line(16, 16, 16 + Math.cos(ang) * 11, 16 + Math.sin(ang) * 11, '#7df9aa'); a.px(11, 10, '#ff5c78'); a.px(22, 19, '#ffb05c'); })
    ]);
  }

  return { marineSuite, robotSuite, alienSuite, survivorSuite, vehiclesSuite, platformerSuite, cyberTilesSuite, projectilesSuite, sciFiUISuite };
})();
