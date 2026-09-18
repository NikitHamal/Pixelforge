/* PixelForge Studio — Farming / life-sim pack.
   Crop growth stages, hand tools, produce, tilled ground, farm buildings and
   barnyard animals. Growth is modelled as the *frames* of one state per crop,
   so `stage 0..4` is addressed the same way as any other animation. */
window.PF = window.PF || {};
PF.Farm = (() => {
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

  /* ---------------- crops: 5 growth stages per species ---------------- */
  function cropsSuite() {
    /* stage 0 sprout, 1 seedling, 2 bush, 3 budding, 4 ripe. Soil is part of
       the sprite so a crop reads on any tileset. */
    const soil = (api, t) => {
      api.rect(9, 26, 22, 27, '#5c3a1e');
      api.rect(9, 26, 22, 26, '#733e39');
      api.speck(9, 26, 22, 27, 3 + (t || 0), ['#3e2731'], 0.2);
    };
    const crops = [
      ['wheat', ['#d9c86a', '#f2e08a', '#8a7a2a'], (api, s) => {
        for (let k = 0; k < 3; k++) {
          const x = 11 + k * 5, h = 3 + s * 4;
          api.line(x, 26, x, 26 - h, '#8a7a2a', 1);
          for (let i = 0; i < s; i++) { api.px(x - 1, 25 - i * 3, '#f2e08a'); api.px(x + 1, 24 - i * 3, '#d9c86a'); }
        }
        if (s >= 4) for (let k = 0; k < 3; k++) api.rect(10 + k * 5, 24 - s * 4, 12 + k * 5, 22 - s * 4, '#f2e08a');
      }],
      ['corn', ['#3e8948', '#a7f070', '#c98a3c'], (api, s) => {
        const h = 4 + s * 4;
        api.line(16, 26, 16, 26 - h, '#3e8948', 2);
        for (let k = 0; k < s; k++) {
          const y = 24 - k * 4;
          api.line(16, y, 16 - 5, y - 2, '#63c74d', 1);
          api.line(16, y, 16 + 5, y - 2, '#a7f070', 1);
        }
        if (s >= 4) { api.rect(14, 26 - h, 18, 22 - h, '#ffec27'); api.px(15, 24 - h, '#fff6c9'); }
      }],
      ['pumpkin', ['#e06b24', '#ffb03a', '#265c42'], (api, s) => {
        const r = 2 + s * 2;
        api.ellipse(16 - r, 25 - r, 16 + r, 27, '#e06b24', true);
        api.ellipse(16 - r + 1, 25 - r + 1, 16 + r - 2, 25, '#ffb03a', true);
        for (let k = 0; k < 3; k++) api.line(16, 25 - r, 16, 27, '#a22633', 1);
        if (s >= 3) { api.line(16, 25 - r, 16, 21 - r + s, '#265c42', 1); api.px(17, 20 - r + s, '#3e8948'); }
      }],
      ['tomato', ['#e43b44', '#f6757a', '#3e8948'], (api, s) => {
        const h = 3 + s * 3;
        api.line(16, 26, 16, 26 - h, '#3e8948', 1);
        api.line(16, 24 - h / 2, 12 - s, 22 - h / 2, '#63c74d', 1);
        api.line(16, 22 - h / 2, 20 + s, 20 - h / 2, '#a7f070', 1);
        for (let k = 0; k < s; k++) { api.ellipse(12 - k * 2, 22 - k * 3, 18 + k * 2, 26 - k * 3, '#e43b44', true); api.px(14, 23 - k * 3, '#f6757a'); }
      }],
      ['carrot', ['#e06b24', '#3e8948', '#ffb03a'], (api, s) => {
        for (let k = 0; k < 3; k++) {
          const x = 12 + k * 4, h = 2 + s * 3;
          api.line(x, 26, x, 26 - h, '#63c74d', 1);
          api.line(x, 26 - h, x - 2, 24 - h, '#3e8948', 1);
          api.line(x, 26 - h, x + 2, 24 - h, '#a7f070', 1);
          if (s >= 4) api.rect(x - 1, 24, x + 1, 27, '#e06b24');
        }
      }],
      ['sunflower', ['#ffec27', '#feae34', '#3e8948'], (api, s) => {
        const h = 3 + s * 4;
        api.line(16, 26, 16, 26 - h, '#3e8948', 2);
        api.line(16, 24, 12, 21, '#63c74d', 1);
        if (s >= 3) {
          const r = s;
          for (let k = 0; k < 8; k++) {
            const a = k / 8 * PI2;
            api.ellipse(16 + Math.cos(a) * r - 2, 26 - h + Math.sin(a) * r - 2, 16 + Math.cos(a) * r + 2, 26 - h + Math.sin(a) * r + 2, k % 2 ? '#ffec27' : '#feae34', true);
          }
          api.ellipse(14, 24 - h, 18, 28 - h, '#5c3a1e', true);
        }
      }]
    ];
    return { width: 32, height: 32, name: 'pf-farm-crops', layers: [{ name: 'World' }], states:
      crops.map(([name, cols, draw]) => D(name, 3, false, [0, 1, 2, 3, 4].map(s => Fr(400, fx(api => { soil(api, s); draw(api, s); }))))) };
  }

  /* ---------------- farm tools ---------------- */
  function toolsSuite() {
    const wood = '#b86f50', woodSh = '#733e39', steel = '#c0cbdc', steelSh = '#5a6988';
    return { width: 32, height: 32, name: 'pf-farm-tools', layers: [{ name: 'Items' }], states: [
      one('hoe', api => {
        api.line(8, 26, 22, 8, wood, 2); api.line(8, 26, 22, 8, woodSh, 1);
        api.line(20, 10, 26, 13, steel, 2); api.line(21, 9, 26, 12, steelSh, 1);
      }),
      one('watering_can', api => {
        api.rect(9, 14, 22, 25, steelSh); api.rect(10, 15, 21, 22, steel);
        api.line(22, 16, 28, 11, steel, 2); api.px(28, 10, '#73eff7');
        api.line(9, 13, 17, 13, steel, 2); api.rect(12, 9, 16, 13, steelSh);
        api.px(11, 17, '#ffffff');
      }),
      one('seed_bag', api => {
        api.rect(9, 13, 22, 26, '#b86f50'); api.rect(9, 13, 22, 14, '#e4a672'); api.rect(9, 25, 22, 26, '#733e39');
        api.line(12, 13, 16, 9, '#c28569', 2); api.line(19, 13, 17, 9, '#c28569', 2);
        api.rect(12, 17, 19, 22, '#f2d29b'); api.px(14, 19, '#8a7a2a'); api.px(17, 21, '#8a7a2a');
      }),
      one('sickle', api => {
        api.line(9, 26, 17, 15, wood, 2);
        api.line(17, 15, 26, 11, steel, 2); api.line(26, 11, 24, 18, steel, 1);
        api.line(25, 12, 23, 17, '#ffffff', 1);
      }),
      one('pitchfork', api => {
        api.line(16, 27, 16, 12, wood, 2);
        api.line(11, 12, 21, 12, steel, 2);
        api.line(11, 12, 10, 6, steel, 1); api.line(16, 12, 16, 5, steel, 1); api.line(21, 12, 22, 6, steel, 1);
        api.px(10, 5, '#ffffff'); api.px(16, 4, '#ffffff'); api.px(22, 5, '#ffffff');
      }),
      one('bucket', api => {
        api.rect(10, 14, 21, 26, steelSh); api.rect(11, 15, 20, 24, steel);
        api.rect(10, 13, 21, 14, steel);
        // bail handle: a shallow arc of pixels over the rim
        for (let x = 10; x <= 21; x++) api.px(x, 12 - Math.round(Math.sin((x - 10) / 11 * Math.PI) * 4), '#5a6988');
        api.line(10, 26, 21, 26, '#3a4466', 1);
        api.px(13, 18, '#ffffff');
      }),
      one('milk_pail', api => {
        api.rect(9, 12, 22, 26, '#8b9bb4'); api.rect(10, 13, 21, 24, '#c0cbdc');
        api.rect(8, 11, 23, 13, '#5a6988');
        api.rect(12, 16, 19, 21, '#f4f4f4');
        api.line(11, 9, 20, 9, '#8b9bb4', 1); api.px(11, 8, '#c0cbdc'); api.px(20, 8, '#c0cbdc');
      }),
      one('smoker', api => {
        api.ellipse(10, 14, 22, 26, '#8b5a2b', true); api.ellipse(11, 15, 18, 22, '#b86f50', true);
        api.rect(13, 10, 19, 15, '#5a6988');
        api.rect(14, 7, 18, 10, '#3a4466');
        for (let k = 0; k < 3; k++) api.px(15 + k, 5 - k, '#c0cbdc');
      })
    ] };
  }

  /* ---------------- produce ---------------- */
  function produceSuite() {
    return { width: 32, height: 32, name: 'pf-farm-produce', layers: [{ name: 'Items' }], states: [
      one('apple', api => { api.ellipse(9, 12, 23, 26, '#e43b44', true); api.ellipse(11, 14, 18, 20, '#f6757a', true); api.line(16, 12, 16, 8, '#733e39', 1); api.ellipse(17, 6, 22, 10, '#3e8948', true); api.px(19, 7, '#a7f070'); }),
      one('corn_cob', api => { api.ellipse(11, 10, 21, 27, '#ffec27', true); api.ellipse(12, 12, 20, 25, '#fff6c9', true); for (let y = 12; y < 26; y += 3) for (let x = 13; x < 20; x += 3) api.px(x, y, '#feae34'); api.line(11, 12, 6, 8, '#3e8948', 2); api.line(21, 12, 26, 8, '#3e8948', 2); }),
      one('pumpkin', api => { api.ellipse(7, 12, 25, 27, '#e06b24', true); api.ellipse(9, 14, 18, 22, '#ffb03a', true); for (const x of [12, 16, 20]) api.line(x, 12, x, 27, '#a22633', 1); api.line(16, 12, 16, 8, '#265c42', 1); api.px(17, 7, '#3e8948'); }),
      one('tomato', api => { api.ellipse(9, 12, 23, 26, '#e43b44', true); api.ellipse(11, 14, 18, 20, '#f6757a', true); api.line(16, 12, 16, 9, '#265c42', 1); for (let k = 0; k < 4; k++) { const a = k / 4 * PI2; api.line(16, 12, 16 + Math.cos(a) * 4, 12 + Math.sin(a) * 3, '#3e8948', 1); } }),
      one('carrot', api => { api.ellipse(12, 13, 20, 22, '#e06b24', true); api.ellipse(13, 14, 18, 17, '#ffb03a', true); for (let k = 0; k < 3; k++) api.line(14 + k * 2, 21, 12 + k * 2, 27, '#e06b24', 1); api.line(16, 13, 16, 6, '#3e8948', 1); api.line(16, 9, 11, 5, '#63c74d', 1); api.line(16, 9, 21, 5, '#a7f070', 1); }),
      one('wheat_bundle', api => { for (let k = 0; k < 5; k++) { const x = 9 + k * 3; api.line(x, 26, x + 2, 8, '#d9c86a', 1); for (let i = 0; i < 4; i++) { api.px(x + 1, 10 + i * 3, '#f2e08a'); api.px(x, 11 + i * 3, '#d9c86a'); } } api.rect(9, 18, 23, 21, '#8a7a2a'); api.rect(10, 19, 22, 20, '#c98a3c'); }),
      one('egg', api => { api.ellipse(10, 8, 22, 26, '#f4f4f4', true); api.ellipse(12, 10, 18, 16, '#ffffff', true); api.ellipse(13, 20, 19, 25, '#e8ecf5', true); }),
      one('milk_bottle', api => { api.rect(12, 12, 20, 26, '#f4f4f4'); api.rect(13, 13, 19, 24, '#ffffff'); api.rect(13, 5, 19, 12, '#c0cbdc'); api.rect(13, 4, 19, 6, '#e43b44'); api.px(15, 16, '#e8ecf5'); }),
      one('cheese', api => { api.rect(6, 15, 26, 26, '#ffec27'); api.rect(6, 15, 26, 16, '#fff6c9'); api.px(10, 20, '#c27a1e'); api.rect(13, 19, 15, 21, '#c27a1e'); api.px(21, 18, '#c27a1e'); api.rect(6, 25, 26, 26, '#c27a1e'); }),
      one('wool', api => { api.ellipse(7, 11, 25, 27, '#f4f4f4', true); for (let k = 0; k < 6; k++) { const a = k / 6 * PI2; api.ellipse(16 + Math.cos(a) * 6 - 3, 19 + Math.sin(a) * 6 - 3, 16 + Math.cos(a) * 6 + 3, 19 + Math.sin(a) * 6 + 3, '#e8ecf5', true); } api.px(13, 17, '#ffffff'); }),
      one('honey_jar', api => { api.rect(10, 12, 21, 26, '#e0a63c'); api.rect(11, 14, 20, 24, '#ffb03a'); api.rect(9, 10, 22, 13, '#733e39'); api.rect(12, 16, 14, 22, '#fff6c9'); api.px(13, 17, '#ffffff'); api.px(18, 21, '#c27a1e'); }),
      one('jam_jar', api => { api.rect(10, 11, 21, 26, '#f4f4f4'); api.rect(11, 13, 20, 25, '#a22633'); api.rect(9, 8, 22, 12, '#8c8c96'); api.rect(11, 9, 20, 10, '#c0c0c8'); api.px(13, 16, '#f6757a'); })
    ] };
  }

  /* ---------------- tilled ground (16 tiles, 64x64) ---------------- */
  function soilSuite() {
    const T = 16, cols = 4;
    const grass = '#3e8948', grassHi = '#63c74d', soil = '#5c3a1e', soilSh = '#3e2731', soilHi = '#8a5a2b', wood = '#b86f50';
    const furrow = (api, seed, base, dark) => {
      api.rect(0, 0, 15, 15, base);
      for (let y = 2; y < 16; y += 5) { api.rect(0, y, 15, y, dark); api.rect(0, y + 1, 15, y + 1, soilHi); }
      api.speck(0, 0, 15, 15, seed, [dark, soilHi], 0.12);
    };
    const paints = [
      api => { api.rect(0, 0, 15, 15, grass); api.speck(0, 0, 15, 15, 1, [grassHi], 0.18); api.rect(0, 0, 15, 1, '#a7f070'); },
      api => { api.rect(0, 0, 15, 15, soil); api.speck(0, 0, 15, 15, 2, [soilSh, soilHi], 0.2); },
      api => furrow(api, 3, soil, soilSh),
      api => { furrow(api, 4, '#3a2a1e', '#26201a'); api.speck(0, 0, 15, 15, 5, ['#73eff7'], 0.08); api.rect(0, 12, 15, 15, '#2a1e14'); },
      api => { furrow(api, 6, soil, soilSh); for (let x = 3; x < 16; x += 6) { api.px(x, 5, '#63c74d'); api.px(x + 1, 4, '#a7f070'); } },
      api => { api.rect(0, 0, 15, 15, '#8a5a2b'); api.speck(0, 0, 15, 15, 7, ['#c98a3c', '#5c3a1e'], 0.22); },
      api => { api.rect(0, 0, 15, 15, grass); api.rect(0, 5, 15, 8, wood); api.rect(0, 5, 15, 5, '#e4a672'); api.rect(0, 8, 15, 8, '#733e39'); for (let x = 2; x < 16; x += 5) api.rect(x, 4, x + 1, 10, '#8a5a2b'); },
      api => { api.rect(0, 0, 15, 15, grass); api.rect(6, 0, 9, 15, wood); api.rect(6, 0, 6, 15, '#e4a672'); api.rect(9, 0, 9, 15, '#733e39'); for (let y = 2; y < 16; y += 5) api.rect(5, y, 10, y + 1, '#8a5a2b'); },
      api => { api.rect(0, 0, 15, 15, grass); api.rect(6, 0, 9, 15, wood); api.rect(0, 6, 15, 9, wood); api.rect(6, 6, 9, 9, '#e4a672'); api.speck(0, 0, 15, 15, 8, ['#c98a3c'], 0.2); },
      api => { api.rect(0, 0, 15, 15, '#8a5a2b'); api.rect(2, 2, 13, 13, '#c98a3c'); for (let x = 3; x < 14; x += 3) api.rect(x, 3, x, 12, '#5c3a1e'); api.px(8, 8, '#ffec27'); },
      api => { api.rect(0, 0, 15, 15, '#c98a3c'); api.ellipse(1, 2, 14, 14, '#e0a63c', true); for (let y = 4; y < 14; y += 3) api.rect(2, y, 13, y, '#8a5a2b'); api.rect(0, 13, 15, 15, '#5c3a1e'); },
      api => { api.rect(0, 0, 15, 15, '#8c8c96'); api.speck(0, 0, 15, 15, 9, ['#5a5a66', '#c0c0c8'], 0.3); },
      api => { api.rect(0, 0, 15, 15, wood); api.rect(1, 1, 14, 14, soil); furrow(api, 10, soil, soilSh); api.rect(0, 0, 15, 1, '#e4a672'); },
      api => { api.rect(0, 0, 15, 15, '#9fd0ff'); api.rect(1, 1, 14, 14, '#73eff7'); api.line(1, 1, 14, 14, '#ffffff', 1); api.line(14, 1, 1, 14, '#c8ffff', 1); api.rect(0, 0, 15, 0, '#c0cbdc'); },
      api => { api.rect(0, 0, 15, 15, '#3e2731'); api.speck(0, 0, 15, 15, 11, ['#5c3a1e', '#265c42'], 0.3); api.px(4, 5, '#63c74d'); api.px(11, 10, '#63c74d'); },
      api => { api.rect(0, 0, 15, 15, '#0b0b0f'); for (let y = 0; y < 16; y += 8) for (let x = 0; x < 16; x += 8) if (((x + y) / 8) % 2) api.rect(x, y, x + 7, y + 7, '#1a1a20'); }
    ];
    return { width: 64, height: 64, name: 'pf-farm-soil', layers: [{ name: 'Tiles' }], states: [
      oneRaw('tiles', buf => {
        paints.forEach((fn, i) => {
          const api = P().offsetApi(P().makeApi(buf, 64, 64), (i % cols) * T, ((i / cols) | 0) * T);
          fn(api);
        });
      })
    ] };
  }

  /* ---------------- farm buildings ---------------- */
  function buildingsSuite() {
    const wood = '#b86f50', woodSh = '#733e39', roof = '#a22633', roofSh = '#5c1a1a', white = '#e8e8d8';
    const S = (name, fps, frames) => D(name, fps, true, frames);
    return { width: 32, height: 32, name: 'pf-farm-buildings', layers: [{ name: 'World' }], states: [
      one('barn', api => {
        api.rect(4, 10, 27, 27, roof); api.rect(4, 10, 27, 11, '#c0392b');
        api.rect(6, 14, 25, 27, white); api.rect(15, 14, 16, 27, woodSh);
        api.rect(9, 17, 13, 27, wood); api.rect(18, 17, 22, 27, wood);
        api.line(9, 22, 13, 22, woodSh, 1); api.line(18, 22, 22, 22, woodSh, 1);
        api.rect(11, 5, 20, 10, roof); api.px(16, 3, woodSh); api.px(15, 4, woodSh);
      }),
      one('silo', api => {
        api.rect(9, 8, 22, 27, white); api.rect(9, 8, 11, 27, '#c0c0b8');
        api.ellipse(8, 4, 23, 12, '#8c8c96', true); api.ellipse(10, 6, 21, 10, '#c0c0c8', true);
        for (let y = 12; y < 27; y += 4) api.line(9, y, 22, y, '#8b8b94', 1);
        api.rect(13, 20, 18, 27, woodSh);
      }),
      S('windmill', 6, [0, 1, 2, 3].map(i => Fr(ms(6), fx(api => {
        api.rect(12, 14, 19, 27, white); api.rect(12, 14, 13, 27, '#c0c0b8');
        api.ellipse(11, 10, 20, 16, roof, true);
        /* THREE blades, not four: four blades spaced 90° land on the same
           angles after a 90° step, so every frame rendered identically. */
        const a0 = i / 4 * PI2;
        for (let k = 0; k < 3; k++) {
          const a = a0 + k / 3 * PI2;
          api.line(16, 12, 16 + Math.cos(a) * 12, 12 + Math.sin(a) * 12, wood, 2);
          api.rect(16 + Math.cos(a) * 9 - 2, 12 + Math.sin(a) * 9 - 2, 16 + Math.cos(a) * 9 + 2, 12 + Math.sin(a) * 9 + 2, white);
        }
        api.rect(15, 11, 16, 13, woodSh);
      })))),
      one('coop', api => {
        api.rect(5, 14, 26, 27, wood); api.rect(5, 14, 26, 15, '#e4a672');
        api.line(6, 16, 25, 27, woodSh, 1); api.line(25, 16, 6, 27, woodSh, 1);
        api.rect(11, 8, 20, 14, roof); api.rect(11, 8, 20, 9, '#c0392b');
        api.ellipse(13, 20, 18, 26, '#3e2731', true);
        api.rect(8, 26, 23, 27, woodSh);
      }),
      one('water_tower', api => {
        for (const x of [8, 21]) { api.line(x, 16, x - 2, 27, '#8b9bb4', 2); api.line(x, 16, x + 2, 27, '#8b9bb4', 2); }
        api.line(6, 22, 12, 22, '#8b9bb4', 1); api.line(19, 22, 25, 22, '#8b9bb4', 1);
        api.rect(7, 5, 24, 17, '#5a6988'); api.rect(8, 6, 23, 15, '#8b9bb4');
        api.ellipse(6, 2, 25, 8, '#c0cbdc', true);
        api.rect(8, 10, 23, 11, '#5a6988'); api.px(16, 13, '#5a6988');
      }),
      one('greenhouse', api => {
        api.rect(3, 12, 28, 27, '#73eff7'); api.rect(4, 13, 27, 26, '#c8ffff');
        for (let x = 8; x < 28; x += 6) api.rect(x, 12, x + 1, 27, '#c0cbdc');
        api.rect(3, 27, 28, 28, '#8b9bb4');
        api.rect(4, 8, 27, 12, '#c0cbdc'); api.line(4, 20, 27, 8, '#ffffff', 1);
        for (let x = 6; x < 27; x += 5) { api.px(x, 24, '#3e8948'); api.px(x + 1, 22, '#63c74d'); }
      }),
      one('doghouse', api => {
        api.rect(8, 16, 23, 27, wood); api.rect(8, 16, 23, 17, '#e4a672');
        api.line(9, 17, 22, 27, woodSh, 1);
        api.rect(6, 10, 25, 16, roof); api.rect(6, 10, 25, 11, '#c0392b');
        api.ellipse(12, 20, 19, 27, '#3e2731', true); api.px(16, 12, woodSh);
      }),
      one('mailbox_farm', api => {
        api.rect(14, 16, 17, 27, wood); api.rect(14, 16, 14, 27, '#8a5a2b');
        api.rect(9, 10, 23, 17, '#8b9bb4'); api.rect(10, 11, 22, 16, '#c0cbdc');
        api.ellipse(9, 8, 23, 12, '#c0cbdc', true);
        api.rect(9, 9, 23, 10, '#5a6988');
        api.line(22, 12, 27, 9, '#c0392b', 1); api.px(27, 8, '#c0392b');
      }),
      S('scarecrow', 5, [0, 1].map(i => Fr(ms(5), fx(api => {
        api.rect(15, 10, 16, 27, '#8a5a2b');
        api.rect(7, 13 + i, 25, 14 + i, '#8a5a2b');
        api.rect(10, 6, 21, 14, '#d9c86a'); api.rect(10, 6, 21, 7, '#f2e08a');
        api.px(13, 9, '#181425'); api.px(18, 9, '#181425');
        api.line(13, 12, 18, 12, '#8a7a2a', 1);
        api.rect(9, 4, 22, 6, '#c98a3c');
        api.rect(11, 15, 20, 21, '#e43b44'); api.px(15, 18, '#ffec27');
        for (let k = 0; k < 4; k++) { api.px(8 + k * 5, 13 + i, '#f2e08a'); api.px(8 + k * 5, 15 + i, '#d9c86a'); }
      })))),
      S('beehive', 6, [0, 1].map(i => Fr(ms(6), fx(api => {
        api.rect(13, 4, 18, 8, '#8a5a2b');
        for (let k = 0; k < 5; k++) { const r = 8 - Math.abs(k - 2); api.ellipse(16 - r, 8 + k * 4, 16 + r, 12 + k * 4, k % 2 ? '#d9a45b' : '#e0a63c', true); }
        api.rect(13, 26, 18, 27, '#5c3a1e');
        for (let k = 0; k < 5; k++) {
          api.px(8 + ((k * 5 + i * 2) % 16), 4 + ((k * 7 + i * 3) % 20), '#ffec27');
          api.px(9 + ((k * 5 + i * 2) % 16), 3 + ((k * 7 + i * 3) % 20), '#e8e8d8');
        }
      }))))
    ] };
  }

  /* ---------------- barnyard animals ---------------- */
  function petsSuite() {
    const quad = o => fx(api => {
      const b = o, la = o.legA || 0, lb = o.legB || 0, tail = o.tail || 0, head = o.headDy || 0;
      const cy = o.cy || 20;
      api.rect(11 + la, cy + 3, 13 + la, 27, b.sh); api.rect(18 + lb, cy + 3, 20 + lb, 27, b.sh);
      api.rect(10 + la, 26, 14 + la, 27, '#3a2e22'); api.rect(17 + lb, 26, 21 + lb, 27, '#3a2e22');
      if (o.tailKind === 'fuzzy') { api.line(20, cy, 26 + tail, cy - 4, b.sh, 2); api.px(27 + tail, cy - 5, b.hi); }
      else if (o.tailKind === 'curl') { api.line(20, cy - 2, 25, cy - 6, b.sh, 1); api.line(25, cy - 6, 27, cy - 3, b.sh, 1); }
      else if (o.tailKind === 'plume') { api.ellipse(20, cy - 8 + tail, 28, cy + 4, b.sh, true); api.ellipse(22, cy - 6 + tail, 27, cy, b.hi, true); }
      api.ellipse(8, cy - 5, 23, cy + 5, b.body, true);
      api.ellipse(9, cy - 5, 18, cy - 1, b.hi, true);
      api.ellipse(8, cy + 1, 23, cy + 5, b.sh, true);
      api.ellipse(9, cy - 10 - head, 19, cy - 2 - head, b.body, true);
      api.ellipse(11, cy - 9 - head, 17, cy - 4 - head, b.hi, true);
      api.px(12, cy - 7 - head, '#181425'); api.px(16, cy - 7 - head, '#181425');
      if (o.beak) { api.rect(9, cy - 5 - head, 12, cy - 4 - head, '#feae34'); }
      else { api.px(11, cy - 5 - head, b.sh); }
      if (o.ears) { api.rect(10, cy - 13 - head, 11, cy - 9 - head, b.sh); api.rect(17, cy - 13 - head, 18, cy - 9 - head, b.sh); }
      if (o.horns) { api.line(11, cy - 10 - head, 9, cy - 13 - head, '#ded8b0', 1); api.line(17, cy - 10 - head, 19, cy - 13 - head, '#ded8b0', 1); }
      if (o.wattle) { api.px(13, cy - 3 - head, '#e43b44'); }
    });
    const S = (name, fps, frames) => D(name, fps, true, frames);
    const DOG = { body: '#8a5a2b', hi: '#c98a3c', sh: '#5c3a1e', tailKind: 'fuzzy', ears: true };
    return { width: 32, height: 32, name: 'pf-farm-pets', layers: [{ name: 'Body' }], states: [
      D('dog', 8, true, [0, 1, 2, 3].map(i => Fr(ms(8), quad({ ...DOG, legA: [0, 2, 0, -2][i], legB: [0, -2, 0, 2][i], tail: [0, 1, -1, 0][i], headDy: [0, -1, 0, 1][i] })))),
      D('cat', 8, true, [0, 1, 2, 3].map(i => Fr(ms(8), quad({ body: '#5a5a66', hi: '#8b8b96', sh: '#3a3a44', tailKind: 'curl', ears: true, legA: [0, 2, 0, -2][i], legB: [0, -2, 0, 2][i], tail: [0, 1, 0, -1][i] })))),
      D('goat', 8, true, [0, 1, 2, 3].map(i => Fr(ms(8), quad({ body: '#e8e8d8', hi: '#ffffff', sh: '#c0c0b8', tailKind: 'fuzzy', horns: true, legA: [0, 2, 0, -2][i], legB: [0, -2, 0, 2][i], headDy: [0, -1, 0, 1][i] })))),
      D('goose', 8, true, [0, 1, 2, 3].map(i => Fr(ms(8), quad({ body: '#f4f4f4', hi: '#ffffff', sh: '#c0c0b8', tailKind: 'plume', beak: true, cy: 22, legA: [0, 1, 0, -1][i], legB: [0, -1, 0, 1][i], tail: [0, 1, 0, -1][i] })))),
      D('turkey', 8, true, [0, 1, 2, 3].map(i => Fr(ms(8), quad({ body: '#5c3a1e', hi: '#8a5a2b', sh: '#3a2e22', tailKind: 'plume', beak: true, wattle: true, cy: 22, legA: [0, 1, 0, -1][i], legB: [0, -1, 0, 1][i], tail: [0, 1, 0, -1][i] })))),
      S('bee_swarm', 8, [0, 1, 2, 3].map(i => Fr(ms(8), fx(api => {
        for (let k = 0; k < 5; k++) {
          const x = 8 + ((k * 7 + i * 2) % 18), y = 10 + ((k * 5 + i * 3) % 14);
          api.rect(x, y, x + 3, y + 2, '#ffec27');
          api.rect(x, y + 1, x + 3, y + 1, '#26262e');
          api.px(x - 1, y - 1, '#e8e8d8'); api.px(x + 4, y - 1, '#e8e8d8');
        }
      })))),
      S('butterfly', 6, [0, 1, 2, 3].map(i => Fr(ms(6), fx(api => {
        const w = [6, 3, 1, 3][i];
        api.ellipse(16 - w, 8, 15, 18, '#ff7ab8', true);
        api.ellipse(17, 8, 16 + w, 18, '#c026d3', true);
        api.ellipse(16 - w + 1, 14, 15, 22, '#ffd6e0', true);
        api.ellipse(17, 14, 16 + w - 1, 22, '#f6757a', true);
        api.rect(15, 8, 16, 24, '#26262e');
        api.px(14, 6, '#26262e'); api.px(17, 6, '#26262e');
      }))))
    ] };
  }

  return { cropsSuite, toolsSuite, produceSuite, soilSuite, buildingsSuite, petsSuite };
})();
