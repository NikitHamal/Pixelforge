/* PixelForge Studio — Horror / gothic pack.
   Undead, night creatures, a graveyard, a haunted interior and dread effects.
   The humanoids ride PF.RPG.humanoidSuite (claw weapon, rot palettes); the
   beasts and spirits get bespoke rigs. Blood and fog are *effects*, not baked
   into sprites, so a game can tint and scale them. */
window.PF = window.PF || {};
PF.Horror = (() => {
  const P = () => PF.Pixel, C = h => PF.Color.hexToU32(h);
  const OUT = '#181425', OUT32 = C(OUT);
  const PI2 = Math.PI * 2;
  const ms = fps => Math.round(1000 / fps);
  const Fr = (duration, paint) => ({ duration, paint });
  const D = (name, fps, loop, frames) => ({ name, fps, loop, frames });
  const anim = (name, fps, loop, cfgs, mk) => D(name, fps, loop, cfgs.map((c, i) => Fr(c && c.d ? c.d : ms(fps), mk(c, i))));
  const one = (name, apiFn) => D(name, 1, true, [Fr(1000, (buf) => { const api = P().makeApi(buf, 32, 32); apiFn(api); buf.set(PF.Raster.outline(buf, 32, 32, OUT32)); })]);
  const oneRaw = (name, paint) => D(name, 1, true, [Fr(1000, paint)]);
  const fx = fn => (buf) => { const a = P().makeApi(buf, 32, 32); fn(a); buf.set(PF.Raster.outline(buf, 32, 32, OUT32)); };
  const R = () => PF.RPG;

  /* ---------------- humanoid monsters ---------------- */
  const BASE = { skin: '#a8b89a', skinSh: '#6b7a5a', hair: '#3e2731', hairSh: '#262b44', hairHi: '#5c3a4a',
    shirt: '#4a4a3a', shirtSh: '#2b2b22', shirtHi: '#6b6b52', pants: '#3a3a30', pantsSh: '#242420',
    boots: '#181425', belt: '#262b44', buckle: '#8b9bb4', outline: OUT, lip: '#5c1a1a' };
  const ZOMBIE = { ...BASE };
  const BLOATER = { ...BASE, skin: '#8a9a6a', skinSh: '#5a6b3a', shirt: '#5c3a3a', shirtSh: '#3a2222', shirtHi: '#8a5a5a' };
  const VAMPIRE = { ...BASE, skin: '#e8e4dc', skinSh: '#b8b0a8', hair: '#181425', hairSh: '#0b0b0f', hairHi: '#3a3a44',
    shirt: '#5c1a1a', shirtSh: '#3a0f0f', shirtHi: '#a22633', pants: '#181425', belt: '#3a0f0f', buckle: '#ffec27', lip: '#a22633' };
  const GHOUL = { ...BASE, skin: '#7a8a9a', skinSh: '#4a5a6a', shirt: '#3a3a30', shirtHi: '#5a5a4a' };
  const WITCH = { ...BASE, skin: '#c0cbdc', skinSh: '#8b9bb4', hair: '#3e2347', hairSh: '#262b44', hairHi: '#68386c',
    shirt: '#26262e', shirtSh: '#181420', shirtHi: '#5a5a66', pants: '#181420', belt: '#3e2347', buckle: '#63c74d', lip: '#3e2347' };

  const zombieSuite = () => R().humanoidSuite(ZOMBIE, 'pf-horror-zombie', {
    weapon: 'claw', sneak: true, head: { beard: '#3e2731', beardSh: '#262b44' },
    post: (api, cfg) => { if (cfg.facing !== 'up') { api.px(13 + (cfg.kb || 0), 11 + (cfg.bob || 0) + (cfg.headDy || 0), '#5c1a1a'); api.px(18 + (cfg.kb || 0), 12 + (cfg.bob || 0) + (cfg.headDy || 0), '#5c1a1a'); } }
  });
  const bloaterSuite = () => R().humanoidSuite(BLOATER, 'pf-horror-bloater', {
    weapon: 'claw', head: { pads: '#5a6b3a', padsSh: '#3a4a22' },
    post: (api, cfg) => {
      /* The belly has to breathe with the body. Drawn static it covers exactly
         the pixels the shoulder/arm channel moves, and the idle drops to a 7px
         frame delta — under the gate and visibly stalled. */
      const d = (cfg.armL && cfg.armL.dy) || 0;
      const x = 16 + (cfg.kb || 0), y = 15 + (cfg.bob || 0) + d;
      api.rect(x - 3, y - 2, x + 2, y + 3, '#5a6b3a');
      api.px(x - 2, y - 1, '#8aa86a'); api.px(x + 1, y + 1, '#3a4a22');
    }
  });
  const vampireSuite = () => R().humanoidSuite(VAMPIRE, 'pf-horror-vampire', {
    weapon: 'claw', cast: true, castColors: ['#e43b44', '#c026d3', '#ffffff'],
    head: { visor: '#ff0044' },
    garb: { cape: '#5c1a1a', capeSh: '#3a0f0f', capeClasp: '#ffec27', wings: '#3a0f0f', wingsSh: '#26262e' }
  });
  const ghoulSuite = () => R().humanoidSuite(GHOUL, 'pf-horror-ghoul', {
    weapon: 'claw', sneak: true, head: { skull: true, hood: '#3a3a30', hoodSh: '#242420' }
  });
  const witchSuite = () => R().humanoidSuite(WITCH, 'pf-horror-witch', {
    weapon: 'staff', cast: true, castColors: ['#63c74d', '#a7f070', '#ffffff'],
    head: { hat: '#26262e', hatBand: '#3e2347', hatPlume: '#63c74d', hatSh: '#181420' }
  });

  /* ---------------- werewolf ---------------- */
  function werewolfSuite() {
    const fur = '#5c4a3a', furHi = '#8a6f52', furSh = '#3a2e22', claw = '#e8ecf5', eye = '#ffec27';
    const frame = o => fx(api => {
      const bob = o.bob || 0, lean = o.lean || 0, jaw = o.jaw || 0, armY = o.armY || 0;
      const cx = 16 + lean, cy = 18 + bob;
      // hind legs planted on rows 25..27
      api.rect(cx - 8, cy + 2, cx - 5, 27, furSh); api.rect(cx + 5, cy + 2, cx + 8, 27, furSh);
      api.rect(cx - 9, 26, cx - 4, 27, furSh); api.rect(cx + 4, 26, cx + 9, 27, furSh);
      // torso: hunched, shoulders higher than hips
      api.ellipse(cx - 8, cy - 8, cx + 8, cy + 6, fur, true);
      api.ellipse(cx - 7, cy - 7, cx + 3, cy - 1, furHi, true);
      api.ellipse(cx - 6, cy + 2, cx + 8, cy + 6, furSh, true);
      // tail
      api.line(cx + 7, cy + 1, cx + 12, cy - 5 + (o.tail || 0), fur, 2);
      api.px(cx + 13, cy - 6 + (o.tail || 0), furHi);
      // arms
      api.rect(cx - 11, cy - 4 + armY, cx - 7, cy + 4, furSh);
      api.rect(cx + 7, cy - 4 - armY, cx + 11, cy + 4, furSh);
      for (let k = 0; k < 3; k++) { api.px(cx - 12 - (k % 2), cy + 5 + k, claw); api.px(cx + 12 + (k % 2), cy + 5 + k, claw); }
      // head: snout forward (left), ears up
      api.ellipse(cx - 12, Math.max(1, cy - 16), cx + 2, cy - 4, fur, true);
      api.rect(cx - 16, cy - 12, cx - 11, cy - 8, fur);
      api.rect(cx - 16, cy - 12, cx - 12, cy - 11, furHi);
      api.px(cx - 10, cy - 13, eye); api.px(cx - 10, cy - 13, '#181425');
      api.px(cx - 3, cy - 13, eye); api.px(cx - 3, cy - 13, '#181425');
      if (jaw) { api.rect(cx - 15, cy - 8, cx - 8, cy - 8 + jaw, '#3a0f0f'); api.px(cx - 14, cy - 7, '#ffffff'); api.px(cx - 9, cy - 7, '#ffffff'); }
      else api.line(cx - 15, cy - 7, cx - 8, cy - 7, '#181425', 1);
      api.rect(cx - 8, Math.max(1, cy - 20), cx - 5, cy - 15, fur); api.rect(cx - 2, Math.max(1, cy - 20), cx + 1, cy - 15, fur);
      api.px(cx - 7, Math.max(1, cy - 19), furSh); api.px(cx, Math.max(1, cy - 19), furSh);
    });
    return { width: 32, height: 32, name: 'pf-horror-werewolf', layers: [{ name: 'Body' }], states: [
      anim('prowl', 6, true, [0, 1, 2, 3], i => frame({ bob: [0, -1, -1, 0][i], lean: [0, 1, 0, -1][i], armY: [0, 2, 0, -2][i], tail: [0, 1, 0, -1][i] })),
      anim('lunge', 10, true, [0, 1, 2, 3], i => frame({ lean: [-1, 2, 4, 2][i], bob: [0, -2, -1, 0][i], jaw: [1, 3, 3, 1][i], armY: [0, -3, -4, -1][i] })),
      anim('howl', 5, true, [0, 1], i => frame({ bob: i ? -2 : 0, jaw: i ? 4 : 1, lean: -1 })),
      anim('hurt', 8, true, [0, 1], i => frame({ bob: i ? -1 : 1, lean: i ? -2 : 2, jaw: 2 })),
      anim('death', 6, false, [0, 1, 2, 3], i => frame({ bob: i * 2, lean: i, jaw: 1 + i, armY: i }))
    ] };
  }

  /* ---------------- spirit (floating) ---------------- */
  function spiritSuite() {
    const sheet = '#c8d8e8', sheetSh = '#8ba0b8', sheetHi = '#ffffff', hair = '#26262e', eye = '#ff0044';
    const spirit = o => api => {
      const bob = o.bob || 0, drift = o.drift || 0, arms = o.arms || 0;
      const cx = 16 + drift, cy = 15 + bob;
      const T = y => Math.max(1, y); // row-0 guard: the outline cannot close above y1
      // trailing sheet with a wavy hem — cheaper and eerier than a solid skirt
      for (let x = -8; x <= 8; x++) {
        const hem = cy + 8 + Math.round(Math.sin(x / 3 + bob) * 1.5);
        api.rect(cx + x, cy - 8, cx + x, hem, (x < -5 || x > 5) ? sheetSh : sheet);
      }
      api.ellipse(cx - 8, T(cy - 12), cx + 8, cy + 2, sheet, true);
      api.ellipse(cx - 6, T(cy - 11), cx + 4, cy - 4, sheetHi, true);
      api.ellipse(cx - 6, T(cy - 14), cx + 6, cy - 4, sheetSh, true);
      api.rect(cx - 7, T(cy - 16), cx + 7, cy - 10, hair);
      api.rect(cx - 6, T(cy - 12), cx + 6, cy - 4, sheetSh);
      api.rect(cx - 5, cy - 9, cx - 3, cy - 7, '#181425');
      api.rect(cx + 3, cy - 9, cx + 5, cy - 7, '#181425');
      api.px(cx - 4, cy - 8, eye); api.px(cx + 4, cy - 8, eye);
      api.line(cx - 2, cy - 5, cx + 2, cy - 5, '#181425', 1);
      api.rect(cx - 11, T(cy - 4 - arms), cx - 8, cy + 1 - arms, sheet);
      api.rect(cx + 8, T(cy - 4 - arms), cx + 11, cy + 1 - arms, sheet);
      for (let k = 0; k < 3; k++) api.px(cx - 12 - k, cy + 2 - arms + k, sheetHi);
    };
    const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
    /* Dissolve in place: draw the spirit into a scratch buffer, then punch it
       out on an ordered dither. Dissolving the live buffer would also erase the
       outline pass, leaving a rim floating around nothing. */
    const dissolve = (o, t) => (buf) => {
      const tmp = new Uint32Array(32 * 32);
      const api = P().makeApi(tmp, 32, 32);
      spirit(o)(api);
      tmp.set(PF.Raster.outline(tmp, 32, 32, OUT32));
      for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
        if (BAYER[((y & 3) << 2) | (x & 3)] / 16 < t) continue;
        buf[y * 32 + x] = tmp[y * 32 + x];
      }
    };
    return { width: 32, height: 32, name: 'pf-horror-spirit', layers: [{ name: 'Body' }], states: [
      anim('float', 5, true, [0, 1, 2, 3], i => fx(spirit({ bob: [0, -1, -2, -1][i], drift: [0, 1, 0, -1][i] }))),
      anim('reach', 8, true, [0, 1, 2, 3], i => fx(spirit({ arms: [0, 3, 5, 2][i], bob: [0, -1, -1, 0][i] }))),
      anim('wail', 6, true, [0, 1], i => fx(spirit({ bob: i ? -3 : -1, drift: i ? 1 : -1, arms: 2 }))),
      D('fade_out', 8, false, [0.15, 0.35, 0.6, 0.85].map((t, i) => Fr(ms(8), dissolve({ bob: -i, drift: i % 2 }, t))))
    ] };
  }

  /* ---------------- gothic tileset (16 tiles, 64x64) ---------------- */
  function tilesSuite() {
    const T = 16, cols = 4;
    const stone = '#5a5a66', stoneHi = '#8b8b96', stoneSh = '#3a3a44', dark = '#26262e', blood = '#8c2418', bone = '#ded8b0';
    const paints = [
      api => { api.rect(0, 0, 15, 15, stone); api.speck(0, 0, 15, 15, 1, [stoneSh, stoneHi], 0.16); },
      api => { api.rect(0, 0, 15, 15, stone); api.speck(0, 0, 15, 15, 2, [stoneSh], 0.14); api.line(2, 3, 6, 9, dark, 1); api.line(6, 9, 4, 14, dark, 1); api.line(9, 1, 12, 7, dark, 1); },
      api => { api.rect(0, 0, 15, 15, stone); api.speck(0, 0, 15, 15, 3, [stoneSh], 0.14); api.speck(0, 0, 15, 15, 4, [blood], 0.16); api.line(3, 2, 5, 13, blood, 1); },
      api => { api.rect(0, 0, 15, 15, stone); api.speck(0, 0, 15, 15, 5, [stoneHi], 0.1); api.speck(0, 8, 15, 15, 6, [bone], 0.14); api.speck(0, 0, 15, 6, 7, ['#3e5b3a'], 0.2); },
      api => { api.rect(0, 0, 15, 15, '#3a2e22'); for (let r = 0; r < 4; r++) for (let c = 0; c < 2; c++) { const x = (c * 8 + (r % 2 ? 4 : 0)) % 16; api.rect(x, r * 4, x + 7, r * 4 + 3, '#4a3a2e'); api.rect(x, r * 4, x + 7, r * 4, '#5c4a3a'); } },
      api => { api.rect(0, 0, 15, 15, '#3a2e22'); api.rect(2, 2, 13, 13, '#181420'); api.rect(3, 3, 12, 12, '#26262e'); api.line(8, 3, 8, 12, '#5c4a3a', 1); api.line(3, 8, 12, 8, '#5c4a3a', 1); api.px(5, 5, '#ffec27'); },
      api => { api.rect(0, 0, 15, 15, '#3a2e22'); api.rect(1, 1, 14, 14, '#8c8c96'); api.rect(2, 2, 13, 13, '#0b0b0f'); api.rect(4, 0, 5, 15, '#5c4a3a'); api.rect(10, 0, 11, 15, '#5c4a3a'); },
      api => { api.rect(0, 0, 15, 15, '#124e89'); api.rect(1, 1, 14, 14, '#41a6f6'); api.rect(2, 2, 13, 12, '#73eff7'); api.rect(2, 13, 13, 14, '#29366f'); api.line(8, 2, 8, 14, '#29366f', 1); api.px(5, 5, '#ffffff'); },
      api => { api.rect(0, 0, 15, 15, '#26262e'); for (let x = 0; x < 16; x += 4) { api.rect(x, 0, x + 1, 15, '#5a5a66'); api.px(x + 1, 2, stoneHi); } api.rect(0, 0, 15, 1, stoneSh); },
      api => { api.rect(0, 0, 15, 15, '#5a5a66'); api.speck(0, 0, 15, 15, 9, [stoneSh], 0.2); api.ellipse(4, 4, 11, 11, '#3a3a44', true); api.line(7, 5, 8, 10, bone, 1); api.px(5, 6, bone); api.px(10, 6, bone); },
      api => { api.rect(0, 0, 15, 15, '#4a3a2e'); for (let y = 0; y < 16; y += 4) { api.line(0, y, 15, y, '#2b2118', 1); } api.speck(0, 0, 15, 15, 10, ['#5c4a3a'], 0.1); },
      api => { api.rect(0, 0, 15, 15, '#5c1a1a'); api.rect(2, 2, 13, 13, '#8c2418'); api.rect(4, 4, 11, 11, '#a22633'); for (let x = 3; x < 14; x += 3) api.px(x, 7, '#ffec27'); },
      api => { api.rect(0, 0, 15, 15, '#26262e'); api.rect(2, 2, 13, 13, '#3a3a44'); api.rect(3, 3, 12, 12, '#5c1a1a'); api.ellipse(5, 5, 10, 10, '#8c2418', true); api.rect(5, 5, 10, 10, '#ffec27'); },
      api => { api.rect(0, 0, 15, 15, '#0b0b0f'); for (let k = 0; k < 6; k++) api.px(2 + k * 2, 3 + (k % 3) * 4, '#3a3a44'); },
      api => { api.rect(0, 0, 15, 15, '#193c3e'); api.speck(0, 0, 15, 15, 11, ['#265c42', '#3e8948'], 0.3); api.rect(0, 13, 15, 15, '#0b1a1a'); },
      api => { api.rect(0, 0, 15, 15, '#0b0b0f'); for (let y = 0; y < 16; y += 8) for (let x = 0; x < 16; x += 8) if (((x + y) / 8) % 2) api.rect(x, y, x + 7, y + 7, '#1a1a20'); }
    ];
    return { width: 64, height: 64, name: 'pf-horror-tiles', layers: [{ name: 'Tiles' }], states: [
      oneRaw('tiles', buf => {
        paints.forEach((fn, i) => {
          const api = P().offsetApi(P().makeApi(buf, 64, 64), (i % cols) * T, ((i / cols) | 0) * T);
          fn(api);
        });
      })
    ] };
  }

  /* ---------------- graveyard props ---------------- */
  function propsSuite() {
    const S = (name, fps, frames) => D(name, fps, true, frames);
    const stone = '#6a6a74', stoneHi = '#8b8b96', stoneSh = '#3a3a44', iron = '#3a3a44', ironHi = '#5a5a66';
    const grave = (kind) => api => {
      if (kind === 'cross') {
        api.rect(12, 4, 19, 27, stone); api.rect(12, 4, 13, 27, stoneHi); api.rect(18, 4, 19, 27, stoneSh);
        api.rect(6, 9, 25, 14, stone); api.rect(6, 9, 25, 10, stoneHi); api.rect(6, 13, 25, 14, stoneSh);
      } else if (kind === 'slab') {
        api.rect(7, 8, 24, 27, stone); api.ellipse(7, 4, 24, 12, stone, true);
        api.rect(7, 8, 8, 27, stoneHi); api.rect(23, 8, 24, 27, stoneSh);
        api.line(10, 14, 21, 14, stoneSh, 1); api.line(10, 17, 18, 17, stoneSh, 1);
        api.rect(6, 25, 25, 27, stoneSh);
      } else {
        api.rect(9, 6, 22, 27, stone); api.rect(9, 6, 10, 27, stoneHi); api.rect(21, 6, 22, 27, stoneSh);
        api.rect(8, 4, 23, 7, stoneSh);
        api.line(12, 11, 19, 11, stoneSh, 1); api.line(12, 14, 17, 14, stoneSh, 1);
        api.px(13, 20, '#3e5b3a'); api.px(18, 22, '#3e5b3a');
      }
      api.speck(8, 6, 23, 26, 3, [stoneSh], 0.08);
    };
    return { width: 32, height: 32, name: 'pf-horror-props', layers: [{ name: 'World' }], states: [
      one('grave_round', grave('round')),
      one('grave_cross', grave('cross')),
      one('grave_slab', grave('slab')),
      one('coffin', api => {
        api.rect(10, 8, 21, 27, '#4a3a2e'); api.rect(11, 9, 20, 26, '#733e39');
        api.rect(12, 10, 19, 12, '#8c4a3a');
        api.rect(12, 16, 19, 17, '#c28569');
        api.px(16, 20, '#ffec27');
      }),
      one('gate', api => {
        for (let x = 6; x <= 26; x += 5) api.rect(x, 6, x + 1, 27, iron);
        for (let y = 8; y <= 26; y += 6) api.rect(6, y, 27, y, ironHi);
        api.rect(4, 4, 29, 6, iron); api.rect(4, 4, 29, 4, ironHi);
        for (let x = 6; x <= 26; x += 5) api.px(x, 5, '#8b8b96');
        api.rect(4, 26, 29, 27, iron);
      }),
      one('altar', api => {
        api.rect(4, 14, 27, 22, '#5a5a66'); api.rect(4, 14, 27, 15, '#8b8b96'); api.rect(4, 21, 27, 22, '#3a3a44');
        api.rect(6, 22, 9, 27, '#3a3a44'); api.rect(22, 22, 25, 27, '#3a3a44');
        api.rect(2, 16, 4, 20, '#5a5a66'); api.rect(27, 16, 29, 20, '#5a5a66');
        api.rect(9, 10, 11, 14, '#ded8b0'); api.rect(20, 10, 22, 14, '#ded8b0');
        api.px(15, 12, '#ffec27'); api.px(16, 12, '#ffec27');
      }),
      S('candles', 6, [0, 1, 2, 3].map(i => Fr(ms(6), fx(api => {
        for (let k = 0; k < 3; k++) {
          const x = 8 + k * 8, h = 6 + (k % 3) * 2;
          api.rect(x, 27 - h, x + 3, 27, '#ded8b0'); api.rect(x, 27 - h, x, 27, '#b8b090');
          api.px(x + 1 + (i % 2), 25 - h, i % 2 ? '#ffec27' : '#ffb03a');
          api.px(x + 1, 26 - h, '#fff6c9');
        }
        api.rect(5, 26, 26, 27, '#3a3a44');
      })))),
      S('blood_pool', 5, [0, 1, 2, 3].map(i => Fr(ms(5), fx(api => {
        api.ellipse(4, 20, 27, 27, '#5c1a1a', true);
        api.ellipse(6, 21, 24, 26, '#8c2418', true);
        api.ellipse(8 + (i % 2), 22, 18 + (i % 2), 25, '#a22633', true);
        if (i % 2) { api.px(10, 23, '#ff7ab8'); api.px(21, 24, '#ff7ab8'); }
      })))),
      S('pentagram', 8, [0, 1].map(i => Fr(ms(8), fx(api => {
        P().ring(api, 16, 16, 12, '#8c2418', 1, 2);
        for (let k = 0; k < 5; k++) {
          const a0 = -PI2 / 4 + k / 5 * PI2, a1 = -PI2 / 4 + ((k + 2) % 5) / 5 * PI2;
          api.line(16 + Math.cos(a0) * 11, 16 + Math.sin(a0) * 11, 16 + Math.cos(a1) * 11, 16 + Math.sin(a1) * 11, i ? '#c026d3' : '#8c2418', 1);
        }
        api.px(16, 16, i ? '#ffffff' : '#ffec27');
      })))),
      one('dead_tree', api => {
        api.rect(14, 8, 17, 27, '#3a2e22'); api.rect(14, 8, 14, 27, '#5c4a3a');
        api.line(16, 14, 7, 8, '#3a2e22', 2); api.line(16, 18, 25, 11, '#3a2e22', 2);
        api.line(16, 22, 9, 18, '#3a2e22', 1); api.line(16, 11, 21, 5, '#3a2e22', 1);
        api.px(7, 7, '#5c4a3a'); api.px(25, 10, '#5c4a3a'); api.px(21, 4, '#5c4a3a');
        api.ellipse(11, 25, 21, 27, '#193c3e', true);
      })
    ] };
  }

  /* ---------------- dread FX ---------------- */
  function fxSuite() {
    const S = (name, fps, frames) => D(name, fps, true, frames);
    return { width: 32, height: 32, name: 'pf-horror-fx', layers: [{ name: 'FX' }], states: [
      anim('blood_splat', 12, true, [0, 1, 2, 3], i => fx(api => {
        const r = 2 + i * 2;
        api.ellipse(16 - r, 16 - r, 16 + r, 16 + r, '#8c2418', true);
        api.ellipse(16 - r + 1, 16 - r + 1, 16 + r - 2, 16 + r - 2, '#a22633', true);
        P().sparks(api, 16, 16, i, '#5c1a1a', 10, r, r + 3);
        if (i < 2) api.px(16, 16, '#ff7ab8');
      })),
      anim('blood_drip', 6, true, [0, 1, 2, 3], i => fx(api => {
        api.rect(13, 2, 18, 6, '#8c2418'); api.rect(14, 2, 17, 5, '#a22633');
        for (let k = 0; k < 3; k++) {
          const x = 13 + k * 2, y = 7 + ((i * 4 + k * 3) % 20);
          api.rect(x, 6, x + 1, y, '#8c2418');
          api.px(x, y + 1, '#a22633');
        }
      })),
      anim('fog_wall', 4, true, [0, 1, 2], i => fx(api => {
        for (let k = 0; k < 26; k++) {
          const x = (api.hash(k, i, 3) * 31) | 0, y = 8 + ((api.hash(k, i, 7) * 16) | 0);
          api.px(x, y, '#c0cbdc'); api.px(x + 1, y, '#8b9bb4');
        }
        api.rect(0, 24, 31, 27, '#8b9bb4');
      })),
      anim('lightning', 10, true, [0, 1, 2, 3, 4], i => fx(api => {
        if (i === 0) { api.dith(0, 0, 31, 6, '#262b44', '#5a5a66', 0); api.px(16, 4, '#9fd0ff'); return; }
        let x = 16;
        for (let y = 0; y < 28; y += 2) {
          x += [0, 3, -2, 2, -3, 1][(y / 2 + i) % 6 | 0];
          api.line(x, y, x, y + 2, '#ffffff', 2);
          api.px(x + 1, y + 1, '#9fd0ff');
        }
        api.rect(4, 0, 28, 0, '#e8ecf5');
      })),
      anim('ectoplasm', 8, true, [0, 1, 2, 3], i => fx(api => {
        for (let k = 0; k < 12; k++) {
          const a = k / 12 * PI2 + i / 4, r = 5 + k % 4;
          api.px(16 + Math.cos(a) * r, 16 + Math.sin(a) * r, '#63c74d');
          api.px(17 + Math.cos(a) * r, 16 + Math.sin(a) * r, '#a7f070');
        }
        api.ellipse(14, 14, 18, 18, i % 2 ? '#d9e86b' : '#63c74d', true);
      })),
      anim('eyes_in_dark', 6, true, [0, 1, 2], i => fx(api => {
        api.rect(0, 0, 31, 31, '#0b0b0f');
        const pairs = [[6, 10], [20, 8], [12, 20], [24, 22]];
        pairs.forEach(([x, y], k) => {
          if ((k + i) % 3 === 0) return;
          api.rect(x, y, x + 2, y + 1, '#ffec27');
          api.px(x + 1, y, '#ff3b30');
        });
      }))
    ] };
  }

  return { zombieSuite, bloaterSuite, vampireSuite, ghoulSuite, witchSuite, werewolfSuite, spiritSuite,
    tilesSuite, propsSuite, fxSuite, BASE, ZOMBIE, VAMPIRE, GHOUL, WITCH, BLOATER };
})();
