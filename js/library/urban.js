/* PixelForge Studio — Modern / urban pack.
   City tiles, street furniture, side-view traffic, modern interiors and
   pedestrians. The pedestrians share one 4-frame breathing idle built on the
   humanoid rig; the vehicles share one chassis-plus-wheels rig so a new car is
   a palette and a bodyline. */
window.PF = window.PF || {};
PF.Urban = (() => {
  const P = () => PF.Pixel, C = h => PF.Color.hexToU32(h);
  const OUT = '#181425', OUT32 = C(OUT);
  const ms = fps => Math.round(1000 / fps);
  const Fr = (duration, paint) => ({ duration, paint });
  const D = (name, fps, loop, frames) => ({ name, fps, loop, frames });
  const anim = (name, fps, loop, cfgs, mk) => D(name, fps, loop, cfgs.map((c, i) => Fr(c && c.d ? c.d : ms(fps), mk(c, i))));
  const one = (name, apiFn) => D(name, 1, true, [Fr(1000, (buf) => { const api = P().makeApi(buf, 32, 32); apiFn(api); buf.set(PF.Raster.outline(buf, 32, 32, OUT32)); })]);
  const one64 = (name, paint) => D(name, 1, true, [Fr(1000, paint)]);
  const fx = fn => (buf) => { const a = P().makeApi(buf, 32, 32); fn(a); buf.set(PF.Raster.outline(buf, 32, 32, OUT32)); };

  /* ---------------- city tileset (16 tiles, 64x64) ---------------- */
  function tilesSuite() {
    const T = 16, cols = 4;
    const road = '#3a3a44', roadSh = '#26262e', line = '#e8e8d8', walk = '#8b8b94', walkHi = '#a8a8b0', brick = '#8c4a3a', brickSh = '#5c2e24';
    const paints = [
      api => { api.rect(0, 0, 15, 15, road); api.speck(0, 0, 15, 15, 1, [roadSh, '#4a4a54'], 0.14); },
      api => { api.rect(0, 0, 15, 15, road); api.speck(0, 0, 15, 15, 2, [roadSh], 0.12); api.rect(7, 0, 8, 15, line); },
      api => { api.rect(0, 0, 15, 15, road); api.speck(0, 0, 15, 15, 3, [roadSh], 0.12); api.rect(0, 7, 15, 8, line); },
      api => { api.rect(0, 0, 15, 15, road); for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { if (((x + y) & 7) < 4) api.px(x, y, line); } api.speck(0, 0, 15, 15, 13, [roadSh], 0.08); },
      api => { api.rect(0, 0, 15, 15, walk); api.rect(0, 0, 15, 1, walkHi); api.rect(0, 1, 15, 1, '#6a6a74'); for (let y = 2; y < 16; y += 5) api.line(0, y, 15, y, '#6a6a74', 1); for (let x = 0; x < 16; x += 8) api.line(x, 0, x, 15, '#6a6a74', 1); },
      api => { api.rect(0, 0, 15, 15, walk); api.rect(0, 12, 15, 15, roadSh); api.rect(0, 12, 15, 12, line); api.speck(0, 0, 15, 11, 6, [walkHi], 0.1); },
      api => { api.rect(0, 0, 15, 15, brick); for (let r = 0; r < 4; r++) for (let c = 0; c < 2; c++) { const x = c * 8 + (r % 2 ? 4 : 0); api.rect(x % 16, r * 4, (x % 16) + 7, r * 4 + 3, brick); api.rect(x % 16, r * 4, (x % 16) + 7, r * 4, '#a85a45'); } api.rect(0, 0, 15, 0, brickSh); api.speck(0, 0, 15, 15, 7, [brickSh], 0.08); },
      api => { api.rect(0, 0, 15, 15, brick); api.rect(2, 2, 13, 13, '#124e89'); api.rect(2, 2, 13, 3, '#73eff7'); api.rect(3, 3, 12, 9, '#9fd0ff'); api.rect(7, 2, 8, 13, '#5c2e24'); api.rect(2, 9, 13, 10, '#5c2e24'); },
      api => { api.rect(0, 0, 15, 15, '#733e39'); api.rect(1, 1, 14, 14, '#b86f50'); api.rect(2, 2, 13, 13, '#8c4a3a'); api.px(11, 8, '#ffec27'); api.rect(3, 3, 12, 4, '#c28569'); },
      api => { api.rect(0, 0, 15, 15, '#5a6988'); api.rect(0, 0, 15, 1, '#8b9bb4'); for (let x = 0; x < 16; x += 4) api.line(x, 0, x, 15, '#3a4466', 1); api.speck(0, 2, 15, 13, 9, [roadSh], 0.1); },
      api => { api.rect(0, 0, 15, 15, '#7a7a86'); api.rect(1, 1, 14, 14, '#5a5a66'); api.ellipse(3, 3, 12, 12, '#3a3a44', true); api.line(7, 3, 8, 12, '#26262e', 1); api.line(3, 7, 12, 8, '#26262e', 1); api.px(5, 5, '#8b8b94'); },
      api => { api.rect(0, 0, 15, 15, '#6a6a74'); api.rect(0, 0, 15, 2, '#8b8b94'); for (let x = 1; x < 16; x += 3) api.line(x, 3, x, 15, '#3a3a44', 1); api.rect(0, 14, 15, 15, '#3a3a44'); },
      api => { api.rect(0, 0, 15, 15, '#3e8948'); api.speck(0, 0, 15, 15, 11, ['#63c74d'], 0.2); api.rect(0, 0, 15, 1, '#a7f070'); for (let x = 3; x < 16; x += 6) { api.px(x, 5, '#ffec27'); api.px(x + 1, 4, '#f6757a'); } },
      api => { api.rect(0, 0, 15, 15, '#265c42'); api.speck(0, 0, 15, 15, 12, ['#3e8948', '#63c74d'], 0.3); api.rect(0, 13, 15, 15, '#193c3e'); },
      api => { api.rect(0, 0, 15, 15, '#8c8c96'); api.rect(0, 0, 15, 3, '#c0c0c8'); api.rect(0, 12, 15, 15, '#5a5a66'); for (let x = 0; x < 16; x += 5) api.line(x, 3, x, 11, '#5a5a66', 1); },
      api => { api.rect(0, 0, 15, 15, '#0b0b0f'); for (let y = 0; y < 16; y += 8) for (let x = 0; x < 16; x += 8) if (((x + y) / 8) % 2) api.rect(x, y, x + 7, y + 7, '#1a1a20'); }
    ];
    return { width: 64, height: 64, name: 'pf-urban-tiles', layers: [{ name: 'Tiles' }], states: [
      one64('tiles', buf => {
        paints.forEach((fn, i) => {
          const api = P().offsetApi(P().makeApi(buf, 64, 64), (i % cols) * T, ((i / cols) | 0) * T);
          fn(api);
        });
      })
    ] };
  }

  /* ---------------- street furniture ---------------- */
  function propsSuite() {
    const S = (name, fps, frames) => D(name, fps, true, frames);
    const steel = '#8c8c96', steelHi = '#c0c0c8', dark = '#3a3a44', red = '#c0392b', yellow = '#ffec27';
    return { width: 32, height: 32, name: 'pf-urban-props', layers: [{ name: 'World' }], states: [
      one('hydrant', api => {
        api.rect(12, 14, 19, 27, red); api.rect(12, 14, 19, 15, '#e8604c');
        api.rect(11, 11, 20, 14, red); api.rect(11, 11, 20, 12, '#e8604c');
        api.rect(9, 16, 11, 19, red); api.rect(20, 16, 22, 19, red);
        api.rect(11, 26, 20, 27, dark);
        api.px(15, 13, steelHi); api.rect(15, 18, 16, 23, '#a03024');
      }),
      one('trashcan', api => {
        api.ellipse(10, 10, 21, 14, steel, true);
        api.rect(10, 12, 21, 27, steel); api.rect(10, 12, 12, 27, steelHi);
        api.rect(19, 12, 21, 27, dark);
        for (let y = 15; y < 27; y += 5) api.line(11, y, 20, y, dark, 1);
        api.rect(9, 9, 22, 10, steelHi); api.px(16, 8, dark);
      }),
      one('dumpster', api => {
        api.rect(4, 14, 27, 25, '#2f6b4a'); api.rect(4, 14, 27, 15, '#3e8948');
        api.rect(4, 24, 27, 25, '#1e4630');
        api.rect(3, 11, 28, 13, '#3e8948'); api.rect(3, 11, 28, 12, '#63c74d');
        api.rect(14, 12, 17, 13, dark);
        api.rect(6, 25, 10, 27, dark); api.rect(21, 25, 25, 27, dark);
        api.px(7, 18, '#265c42'); api.px(24, 21, '#265c42');
      }),
      one('bench', api => {
        api.rect(4, 18, 27, 20, '#8c4a3a'); api.rect(4, 18, 27, 19, '#b86f50');
        api.rect(4, 12, 27, 14, '#8c4a3a'); api.rect(4, 12, 27, 13, '#b86f50');
        api.rect(5, 15, 7, 17, dark); api.rect(24, 15, 26, 17, dark);
        api.rect(5, 21, 7, 27, dark); api.rect(24, 21, 26, 27, dark);
        api.line(9, 19, 22, 19, '#733e39', 1);
      }),
      S('streetlamp', 6, [0, 1].map(i => Fr(ms(6), fx(api => {
        api.rect(14, 8, 17, 27, dark); api.rect(14, 8, 15, 27, steel);
        api.rect(11, 5, 20, 9, steelHi); api.rect(12, 6, 19, 8, i ? '#fff6c9' : yellow);
        api.rect(20, 17, 23, 19, steel); api.rect(20, 17, 23, 17, steelHi);
        api.rect(13, 26, 18, 27, dark);
        if (i) { api.px(12, 10, '#fff6c9'); api.px(19, 11, '#fff6c9'); }
      })))),
      S('traffic_light', 8, [0, 1, 2].map(i => Fr(ms(8), fx(api => {
        api.rect(14, 5, 17, 27, dark); api.rect(14, 5, 15, 27, steel);
        api.rect(11, 4, 20, 18, '#26262e'); api.rect(11, 4, 20, 5, steel);
        const on = ['red', 'amber', 'green'][i];
        api.ellipse(13, 6, 18, 11, on === 'red' ? '#ff3b30' : '#4a1010', true);
        api.ellipse(13, 11, 18, 16, on === 'amber' ? '#ffb03a' : '#4a3010', true);
        api.ellipse(12, 15, 17, 19, on === 'green' ? '#3ee06b' : '#103a20', true);
        api.rect(13, 26, 18, 27, dark);
      })))),
      one('mailbox', api => {
        api.rect(12, 14, 19, 27, '#124e89'); api.rect(12, 14, 19, 15, '#4a7fb5');
        api.ellipse(11, 8, 20, 16, '#124e89', true); api.ellipse(12, 9, 19, 13, '#4a7fb5', true);
        api.rect(12, 12, 19, 13, '#26262e'); api.px(16, 10, '#ffec27');
        api.rect(11, 25, 20, 27, '#26262e');
      }),
      one('phone_booth', api => {
        api.rect(9, 4, 22, 27, '#26262e'); api.rect(10, 5, 21, 26, '#124e89');
        api.rect(11, 6, 20, 16, '#73eff7');
        api.rect(13, 8, 18, 14, '#26262e'); api.rect(14, 9, 17, 12, '#8b9bb4');
        api.rect(11, 19, 20, 26, '#4a7fb5');
        api.rect(9, 3, 22, 4, '#5a6988'); api.px(16, 2, '#ff0044');
      }),
      one('sign_post', api => {
        api.rect(15, 12, 17, 27, steel); api.rect(15, 12, 15, 27, dark);
        api.rect(6, 5, 26, 13, '#e8e8d8'); api.rect(6, 5, 26, 6, '#ffffff');
        api.rect(7, 7, 25, 8, '#3e8948'); api.rect(7, 10, 18, 11, '#c0392b');
        api.rect(14, 26, 18, 27, dark);
      }),
      one('cone', api => {
        api.ellipse(10, 24, 21, 27, '#c0392b', true);
        for (let y = 8; y < 25; y++) { const w = Math.round((y - 7) / 18 * 7); api.rect(16 - w, y, 15 + w, y, y > 15 && y < 19 ? '#e8e8d8' : '#e8604c'); }
        api.rect(11, 24, 20, 25, '#a03024');
      }),
      one('planter', api => {
        api.rect(7, 18, 24, 27, '#8c4a3a'); api.rect(7, 18, 24, 19, '#b86f50'); api.rect(7, 26, 24, 27, '#5c2e24');
        api.ellipse(9, 10, 22, 19, '#3e8948', true);
        api.ellipse(11, 11, 18, 15, '#63c74d', true);
        api.px(12, 9, '#f6757a'); api.px(19, 11, '#ffec27'); api.px(15, 7, '#9fd0ff');
      })
    ] };
  }

  /* ---------------- side-view traffic ---------------- */
  function vehiclesSuite() {
    /* One chassis rig: wheels at y24..28, roof height and body colour per type.
       `type` picks the silhouette (sedan / van / bus / truck / bike). */
    const car = o => fx(api => {
      const b = o, wheel = '#26262e', rim = '#8c8c96';
      const bob = o.bob || 0, spoke = o.spoke || 0;
      const y0 = (b.y0 || 16) + bob;
      if (b.type === 'bike') {
        api.ellipse(6, 22, 14, 28, wheel, true); api.ellipse(19, 22, 27, 28, wheel, true);
        api.ellipse(8, 23, 12, 27, rim, false); api.ellipse(21, 23, 25, 27, rim, false);
        /* Spokes alternate: a wheel whose only change is a 1px body bob is a
           sub-threshold frame delta, and the quality gate calls it stalled. */
        for (const wx of [10, 23]) {
          if (spoke) api.line(wx, 23, wx, 27, rim, 1);
          else api.line(wx - 2, 25, wx + 2, 25, rim, 1);
        }
        api.rect(10, 17, 22, 22, b.body); api.rect(10, 17, 22, 18, b.hi);
        api.rect(13, 13, 19, 17, b.sh); api.rect(14, 14, 18, 16, '#9fd0ff');
        api.rect(9, 20, 12, 23, b.sh); api.px(21, 19, '#ffec27');
        api.line(24, 14, 27, 17, '#8c8c96', 1);
      } else {
        const h = b.type === 'bus' ? 6 : b.type === 'van' ? 12 : b.type === 'truck' ? 12 : 14;
        // wheels
        for (const wx of (b.type === 'bus' || b.type === 'truck') ? [7, 23] : [8, 22]) {
          api.ellipse(wx, 24, wx + 7, 28, wheel, true);
          api.ellipse(wx + 2, 25, wx + 5, 27, rim, true);
          if (spoke) api.line(wx + 3, 24, wx + 3, 28, wheel, 1);
          else api.line(wx + 1, 26, wx + 6, 26, wheel, 1);
        }
        // body + cabin
        if (b.type === 'truck') {
          api.rect(2, y0, 19, 23, b.body); api.rect(2, y0, 19, y0 + 1, b.hi);
          api.rect(3, y0 + 2, 18, y0 + 3, b.sh);
          api.rect(20, y0 + 3, 29, 23, b.body); api.rect(21, y0 + 4, 28, y0 + 8, '#9fd0ff');
        } else if (b.type === 'bus') {
          api.rect(1, y0, 30, 23, b.body); api.rect(1, y0, 30, y0 + 1, b.hi);
          for (let k = 0; k < 5; k++) api.rect(3 + k * 6, y0 + 3, 7 + k * 6, y0 + 8, '#9fd0ff');
          api.rect(1, 20, 30, 21, b.sh);
          api.px(29, 20, '#ffec27'); api.px(2, 20, '#ff3b30');
        } else {
          api.rect(2, y0 + 3, 29, 23, b.body);
          api.rect(2, y0 + 3, 29, y0 + 4, b.hi);
          api.rect(2, 21, 29, 23, b.sh);
          api.rect(8, y0, 21, y0 + 4, b.body);
          api.rect(8, y0, 21, y0 + 1, b.hi);
          api.rect(9, y0 + 1, 13, y0 + 3, '#9fd0ff'); api.rect(15, y0 + 1, 20, y0 + 3, '#9fd0ff');
          api.px(28, y0 + 7, '#ffec27'); api.px(3, y0 + 7, '#ff3b30');
        }
        api.rect(2, 22, 29, 23, b.sh);
      }
      if (o.beacon) {
        api.rect(13, y0 - 3, 18, y0, o.beacon === 1 ? '#ff3b30' : '#41a6f6');
        if (o.beacon === 1) api.px(15, y0 - 4, '#ff3b30'); else api.px(16, y0 - 4, '#41a6f6');
      }
      if (o.stripe) api.rect(2, y0 + 7, 29, y0 + 8, o.stripe);
    });
    const TYPES = [
      ['sedan', { body: '#c0392b', hi: '#e8604c', sh: '#8c2418' }],
      ['taxi', { body: '#ffb03a', hi: '#ffd23a', sh: '#c27a1e', stripe: '#26262e' }],
      ['police', { body: '#e8e8d8', hi: '#ffffff', sh: '#8b8b94', stripe: '#124e89', beacon: 1 }],
      ['van', { body: '#e8e8d8', hi: '#ffffff', sh: '#8b8b94', stripe: '#3e8948' }],
      ['bus', { body: '#e0603a', hi: '#f4936a', sh: '#a22633', stripe: '#ffec27', y0: 10 }],
      ['truck', { body: '#4a7fb5', hi: '#73eff7', sh: '#29366f', y0: 14 }],
      ['ambulance', { body: '#f4f4f4', hi: '#ffffff', sh: '#8b8b94', stripe: '#c0392b', beacon: 2 }],
      ['motorcycle', { type: 'bike', body: '#26262e', hi: '#5a5a66', sh: '#181420' }]
    ];
    return { width: 32, height: 32, name: 'pf-urban-vehicles', layers: [{ name: 'World' }], states:
      TYPES.map(([name, cfg]) => D(name, 4, true, [0, 1].map(i => Fr(ms(4), car({ ...cfg, spoke: i, bob: i ? 1 : 0 })))))
    };
  }

  /* ---------------- pedestrians ---------------- */
  function peopleSuite() {
    /* One 4-frame blink/breath idle per pedestrian on the humanoid rig. A city
       needs a crowd, not six full 19-state action suites. */
    const idle = (pal, o = {}) => {
      const FR = [], HEAD = [0, 1, 1, 0], ARM = [0, 0, 1, 1];
      for (let i = 0; i < 4; i++) {
        const cfg = PF.Chars.frontPose(i, 4, 0, pal, 'down');
        cfg.legA = { dx: 0, dy: 0 }; cfg.legB = { dx: 0, dy: 0 };
        cfg.armL = { dx: 0, dy: ARM[i] + (o.armDy || 0) }; cfg.armR = { dx: 0, dy: ARM[i] + (o.armDy || 0) };
        cfg.headDy = HEAD[i]; cfg.bob = 0; cfg.eye = i === 3 ? 'closed' : 'open';
        cfg.tool = o.tool || null;
        FR.push(Fr(ms(4), (buf, W, H) => {
          const api = P().makeApi(buf, W, H);
          PF.Chars.drawHumanoid(api, buf, W, H, cfg);
          if (o.extra) o.extra(api, cfg, i);
        }));
      }
      return D(o.state, 4, true, FR);
    };
    const base = { skin: '#e8b796', skinSh: '#c28569', hair: '#262b44', hairSh: '#181425', hairHi: '#3a4466',
      shirt: '#4a7fb5', shirtSh: '#29366f', shirtHi: '#9fd0ff', pants: '#3a4466', pantsSh: '#262b44',
      boots: '#26262e', belt: '#26262e', buckle: '#c0c0c8', outline: OUT, lip: '#a26a5a' };
    const SUIT = { ...base, shirt: '#26262e', shirtSh: '#181420', shirtHi: '#5a5a66', pants: '#181420', belt: '#181420', buckle: '#ffec27' };
    const KID = { ...base, skin: '#f2c094', shirt: '#ffec27', shirtSh: '#feae34', shirtHi: '#fff6c9', pants: '#3e8948', pantsSh: '#265c42', boots: '#c0392b' };
    const JOGGER = { ...base, shirt: '#ff7ab8', shirtSh: '#c026d3', shirtHi: '#ffd6e0', pants: '#26262e', hair: '#b86f50', boots: '#ffec27' };
    const VENDOR = { ...base, shirt: '#3e8948', shirtSh: '#265c42', shirtHi: '#63c74d', pants: '#5a3a1e', boots: '#3e2731', hair: '#8c4a3a' };
    const OFFICER = { ...base, shirt: '#124e89', shirtSh: '#1c2a44', shirtHi: '#4a7fb5', pants: '#1c2a44', belt: '#26262e', buckle: '#ffec27' };
    const PUNK = { ...base, hair: '#c026d3', hairSh: '#6a2c9c', hairHi: '#ff7ab8', shirt: '#26262e', shirtSh: '#181420', shirtHi: '#c026d3', pants: '#3a3a44' };
    return { width: 32, height: 32, name: 'pf-urban-people', layers: [{ name: 'Body' }], states: [
      idle(SUIT, { state: 'businessman' }),
      idle(KID, { state: 'schoolkid', armDy: -1 }),
      idle(JOGGER, { state: 'jogger' }),
      idle(VENDOR, { state: 'vendor', tool: { kind: 'box' } }),
      idle(OFFICER, { state: 'officer', extra: (api, cfg) => { api.rect(10 + (cfg.kb || 0), 2 + (cfg.headDy || 0), 21 + (cfg.kb || 0), 4 + (cfg.headDy || 0), '#124e89'); api.rect(10 + (cfg.kb || 0), 2 + (cfg.headDy || 0), 21 + (cfg.kb || 0), 2 + (cfg.headDy || 0), '#4a7fb5'); api.px(15 + (cfg.kb || 0), 1 + (cfg.headDy || 0), '#ffec27'); } }),
      idle(PUNK, { state: 'punk', extra: (api, cfg) => { api.px(11 + (cfg.kb || 0), 1 + (cfg.headDy || 0), '#c026d3'); api.px(12 + (cfg.kb || 0), 1 + (cfg.headDy || 0), '#ff7ab8'); api.px(20 + (cfg.kb || 0), 1 + (cfg.headDy || 0), '#c026d3'); } })
    ] };
  }

  /* ---------------- urban action hero ---------------- */
  const HERO = { skin: '#d99a78', skinSh: '#a26a5a', hair: '#26262e', hairSh: '#181425', hairHi: '#5a5a66',
    shirt: '#c0392b', shirtSh: '#8c2418', shirtHi: '#e8604c', pants: '#3a3a44', pantsSh: '#26262e',
    boots: '#181420', belt: '#26262e', buckle: '#ffec27', outline: OUT, lip: '#a26a5a' };
  function heroSuite() {
    return PF.RPG.humanoidSuite(HERO, 'pf-urban-hero', {
      weapon: 'pistol', sneak: true,
      head: { hat: '#26262e', hatBand: '#c0392b', hatSh: '#181420' },
      garb: { backpack: '#3a3a44', backpackSh: '#26262e', backpackLatch: '#ffec27' }
    });
  }
  function vigilanteSuite() {
    return PF.RPG.humanoidSuite({ ...HERO, shirt: '#26262e', shirtSh: '#181420', shirtHi: '#5a5a66', pants: '#181420' }, 'pf-urban-vigilante', {
      weapon: 'blaster', shield: false,
      head: { visor: '#ffec27', helm: '#26262e', helmSh: '#181420', helmHi: '#5a5a66' },
      garb: { cape: '#181420', capeSh: '#0b0b0f', capeClasp: '#ffec27' }
    });
  }

  /* ---------------- modern interiors ---------------- */
  function interiorsSuite() {
    const S = (name, fps, frames) => D(name, fps, true, frames);
    const wood = '#b86f50', woodSh = '#733e39', woodHi = '#e4a672', dark = '#26262e', steel = '#8c8c96';
    return { width: 32, height: 32, name: 'pf-urban-interiors', layers: [{ name: 'World' }], states: [
      one('desk', api => {
        api.rect(3, 16, 28, 19, wood); api.rect(3, 16, 28, 17, woodHi); api.rect(3, 20, 28, 21, woodSh);
        api.rect(5, 21, 7, 27, woodSh); api.rect(24, 21, 26, 27, woodSh);
        api.rect(12, 17, 19, 21, woodSh); api.px(15, 19, '#ffec27');
      }),
      one('computer', api => {
        api.rect(9, 6, 22, 18, dark); api.rect(10, 7, 21, 16, '#124e89');
        api.rect(11, 8, 20, 14, '#4a7fb5'); api.rect(12, 9, 19, 11, '#9fd0ff');
        api.rect(13, 18, 18, 19, dark); api.rect(11, 19, 20, 21, steel);
        api.rect(10, 21, 21, 27, '#3a3a44'); api.rect(11, 22, 20, 24, steel);
        api.px(13, 25, '#3ee06b');
      }),
      one('sofa', api => {
        api.rect(2, 14, 29, 22, '#4a7fb5'); api.rect(2, 14, 29, 15, '#73eff7');
        api.rect(2, 22, 29, 23, '#29366f');
        api.rect(2, 18, 4, 23, '#29366f'); api.rect(27, 18, 29, 23, '#29366f');
        api.line(11, 16, 11, 22, '#29366f', 1); api.line(20, 16, 20, 22, '#29366f', 1);
        api.rect(4, 23, 7, 25, dark); api.rect(24, 23, 27, 25, dark);
      }),
      one('fridge', api => {
        api.rect(9, 4, 22, 27, '#e8ecf5'); api.rect(9, 4, 22, 5, '#ffffff');
        api.rect(9, 12, 22, 13, steel); api.rect(20, 7, 21, 11, steel); api.rect(20, 15, 21, 22, steel);
        api.rect(9, 4, 10, 27, '#c0c0c8'); api.px(11, 6, '#ffec27');
      }),
      one('stove', api => {
        api.rect(6, 10, 25, 27, '#3a3a44'); api.rect(6, 10, 25, 11, steel);
        api.rect(7, 12, 24, 13, dark); api.rect(7, 14, 24, 26, '#1a1a20');
        api.ellipse(12, 15, 19, 21, '#0b0b0f', true); api.ellipse(17, 15, 24, 21, '#0b0b0f', true);
        api.px(15, 24, '#ff3b30'); api.px(16, 24, '#ff3b30');
      }),
      one('tv', api => {
        api.rect(4, 6, 27, 20, dark); api.rect(5, 7, 26, 18, '#3a3a44');
        api.rect(6, 8, 25, 17, '#124e89'); api.rect(7, 9, 24, 15, '#4a7fb5');
        api.rect(9, 10, 16, 12, '#9fd0ff'); api.rect(18, 13, 23, 15, '#73eff7');
        api.rect(13, 20, 18, 21, dark); api.rect(9, 21, 22, 22, steel);
      }),
      one('shelf', api => {
        api.rect(4, 3, 27, 27, woodSh); api.rect(4, 3, 27, 4, woodHi);
        for (let y = 8; y < 27; y += 8) { api.rect(5, y, 26, y + 1, wood); api.rect(5, y, 26, y, woodHi); }
        api.rect(7, 5, 10, 7, '#c0392b'); api.rect(12, 5, 16, 7, '#3e8948'); api.rect(18, 5, 22, 7, '#4a7fb5');
        api.rect(7, 13, 12, 15, '#ffb03a'); api.rect(15, 13, 21, 15, '#c026d3');
        api.rect(8, 21, 14, 23, '#8c8c96'); api.rect(17, 21, 23, 23, '#3e8948');
      }),
      S('ceiling_fan', 8, [0, 1, 2, 3].map(i => Fr(ms(8), fx(api => {
        api.rect(15, 2, 17, 8, steel); api.rect(12, 8, 20, 10, dark);
        for (let k = 0; k < 3; k++) {
          const a = i / 4 * Math.PI * 2 + k / 3 * Math.PI * 2;
          api.line(16, 10, 16 + Math.cos(a) * 10, 10 + Math.sin(a) * 5, steel, 2);
          api.px(16 + Math.cos(a) * 11, 10 + Math.sin(a) * 6, '#c0c0c8');
        }
      })))),
      one('rug', api => {
        api.rect(2, 12, 29, 24, '#8c2418'); api.rect(3, 13, 28, 23, '#c0392b');
        api.rect(6, 15, 25, 21, '#8c2418');
        for (let x = 7; x < 25; x += 4) api.rect(x, 16, x + 1, 20, '#ffec27');
        api.rect(2, 12, 29, 12, '#5c1a12'); api.rect(2, 24, 29, 24, '#5c1a12');
      })
    ] };
  }

  return { tilesSuite, propsSuite, vehiclesSuite, peopleSuite, heroSuite, vigilanteSuite, interiorsSuite, HERO };
})();
