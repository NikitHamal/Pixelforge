/* PixelForge Studio — Tiny 16x16 pack (NES / Game Boy / handheld scale).
   The main library is authored at 32x32. A 16x16 game cannot just scale it
   down: a 16px sprite has room for a 9px body, so the forms have to be redrawn
   with fewer, bolder shapes. These are those redraws, and they carry the same
   state names (idle / walk / attack / hurt / death) as the big packs. */
window.PF = window.PF || {};
PF.Tiny = (() => {
  const P = () => PF.Pixel, C = h => PF.Color.hexToU32(h);
  const OUT = '#181425', OUT32 = C(OUT);
  const ms = fps => Math.round(1000 / fps);
  const Fr = (duration, paint) => ({ duration, paint });
  const D = (name, fps, loop, frames) => ({ name, fps, loop, frames });
  const anim = (name, fps, loop, cfgs, mk) => D(name, fps, loop, cfgs.map((c, i) => Fr(c && c.d ? c.d : ms(fps), mk(c, i))));
  const one = (name, apiFn) => D(name, 1, true, [Fr(1000, (buf) => { const api = P().makeApi(buf, 16, 16); apiFn(api); buf.set(PF.Raster.outline(buf, 16, 16, OUT32)); })]);
  const oneRaw = (name, paint) => D(name, 1, true, [Fr(1000, paint)]);
  const fx = fn => (buf) => { const a = P().makeApi(buf, 16, 16); fn(a); buf.set(PF.Raster.outline(buf, 16, 16, OUT32)); };

  /* ---------------- tiny hero ---------------- */
  function heroSuite() {
    const pal = { skin: '#f2c094', skinSh: '#c28569', hair: '#3e2731', shirt: '#e43b44', shirtHi: '#f6757a',
      pants: '#124e89', boots: '#262b44', blade: '#c0cbdc' };
    /* Head 2..6, torso 7..11, legs 12..15. Two pixels of head, one of neck:
       any more and the silhouette turns back into a 32px sprite. */
    const draw = o => api => {
      const b = o.bob || 0, la = o.legA || 0, lb = o.legB || 0, arm = o.arm || 0;
      const Y = y => y + b;
      // legs (feet always land on rows 14..15)
      api.rect(5 + la, Y(12), 7 + la, 15, pal.pants); api.rect(5 + la, 14, 7 + la, 15, pal.boots);
      api.rect(8 + lb, Y(12), 10 + lb, 15, pal.pants); api.rect(8 + lb, 14, 10 + lb, 15, pal.boots);
      // torso
      api.rect(4, Y(7), 11, Y(12), pal.shirt);
      api.rect(4, Y(7), 11, Y(8), pal.shirtHi);
      api.rect(4, Y(7), 4, Y(12), pal.shirtHi);
      // arms
      api.rect(3, Y(8 + arm), 4, Y(11 + arm), pal.shirt);
      api.rect(11, Y(8 - arm), 12, Y(11 - arm), pal.shirt);
      api.px(3, Y(12 + arm), pal.skin); api.px(12, Y(12 - arm), pal.skin);
      // head: helmet of hair over a 2px face
      api.rect(4, Y(2), 11, Y(6), pal.skin);
      api.rect(4, Y(2), 11, Y(3), pal.hair);
      api.rect(4, Y(2), 4, Y(5), pal.hair); api.rect(11, Y(2), 11, Y(5), pal.hair);
      api.px(6, Y(4), '#181425'); api.px(9, Y(4), '#181425');
      api.px(7, Y(6), pal.skinSh);
      if (o.hurt) { api.rect(4, Y(2), 11, Y(6), '#ffffff'); }
      if (o.blade) {
        const a = o.blade;
        api.line(13, Y(9), 13 + Math.round(Math.cos(a) * 5), Y(9) + Math.round(Math.sin(a) * 5), pal.blade, 1);
        api.px(13 + Math.round(Math.cos(a) * 6), Y(9) + Math.round(Math.sin(a) * 6), '#ffffff');
      }
    };
    return { width: 16, height: 16, name: 'pf-tiny-hero', layers: [{ name: 'Body' }], states: [
      /* A 16px sprite cannot afford a 1px-two-pose idle: the whole body is 9px
         tall, so the breath shifts it 2px on a 4-beat so every frame differs. */
      anim('idle', 4, true, [0, -1, -2, -1], b => fx(draw({ bob: b }))),
      anim('walk', 6, true, [0, 1, 2, 3], i => fx(draw({ bob: [0, -1, 0, -1][i], legA: [0, 1, 0, -1][i], legB: [0, -1, 0, 1][i], arm: [0, -1, 0, 1][i] }))),
      anim('attack', 12, true, [{ d: 120, a: -1.2 }, { d: 50, a: -0.2 }, { d: 80, a: 0.9 }, { d: 140, a: 0.4 }], c => fx(draw({ blade: c.a, arm: -1 }))),
      anim('hurt', 8, true, [0, 1], i => fx(draw({ hurt: true, bob: -i }))),
      anim('death', 6, false, [0, 1, 2], i => fx(draw({ bob: i * 3, hurt: i > 0 })))
    ] };
  }

  /* ---------------- tiny foes ---------------- */
  function foesSuite() {
    const S = (name, fps, frames) => D(name, fps, true, frames);
    return { width: 16, height: 16, name: 'pf-tiny-foes', layers: [{ name: 'Body' }], states: [
      S('slime', 6, [0, 1, 2, 3].map(i => Fr(ms(6), fx(api => {
        const h = [4, 5, 7, 5][i], w = [6, 6, 5, 6][i];
        api.ellipse(8 - w, 15 - h, 7 + w, 15, '#41a6f6', true);
        api.ellipse(8 - w + 1, 15 - h + 1, 5 + w, 15 - Math.max(1, h - 3), '#73eff7', true);
        api.px(6, 15 - h + 3, '#181425'); api.px(9, 15 - h + 3, '#181425');
        api.rect(7, 15 - Math.max(1, h - 3), 9, 15 - Math.max(1, h - 3), '#181425');
      })))),
      S('bat', 8, [0, 1].map(i => Fr(ms(8), fx(api => {
        if (i) { api.ellipse(1, 8, 6, 12, '#68386c', true); api.ellipse(10, 8, 15, 12, '#68386c', true); }
        else { api.ellipse(1, 4, 6, 8, '#68386c', true); api.ellipse(10, 4, 15, 8, '#68386c', true); }
        api.ellipse(5, 6, 11, 12, '#68386c', true);
        api.ellipse(6, 7, 10, 9, '#b55088', true);
        api.px(6, 8, '#ffec27'); api.px(9, 8, '#ffec27');
        api.px(7, 11, '#ffffff'); api.px(8, 11, '#ffffff');
      })))),
      S('skeleton', 6, [0, 1, 2, 3].map(i => Fr(ms(6), fx(api => {
        const st = [0, 2, 0, -2][i], hb = [0, -1, -1, 0][i];
        api.rect(6, 2 + hb, 9, 5 + hb, '#ead4aa'); api.px(6, 3 + hb, '#181425'); api.px(9, 3 + hb, '#181425');
        api.rect(7, 8 + hb, 8, 12, '#ead4aa');
        for (let k = 0; k < 3; k++) api.rect(5, 8 + k * 2, 10, 8 + k * 2, '#c8b28a');
        api.rect(5, 13 + st, 6, 15, '#ead4aa');
        api.rect(9, 13 - st, 10, 15, '#ead4aa');
        api.line(10, 9, 13, 6 + (st > 0 ? -1 : 0), '#c0cbdc', 1);
      })))),
      S('ghost', 6, [0, 1, 2, 3].map(i => Fr(ms(6), fx(api => {
        const b = [0, -1, -2, -1][i];
        api.ellipse(3, 2 + b, 12, 12 + b, '#e8ecf5', true);
        for (let x = 3; x <= 12; x += 3) api.rect(x, 11 + b, x + 1, 13 + b + (x % 2), '#e8ecf5');
        api.rect(5, 5 + b, 6, 6 + b, '#181425'); api.rect(9, 5 + b, 10, 6 + b, '#181425');
        api.rect(7, 9 + b, 8, 9 + b, '#181425');
      })))),
      S('spider', 8, [0, 1].map(i => Fr(ms(8), fx(api => {
        api.ellipse(4, 7, 11, 12, '#262b44', true);
        api.ellipse(6, 4, 9, 7, '#3a4466', true);
        api.px(6, 5, '#ff0044'); api.px(9, 5, '#ff0044');
        for (let k = 0; k < 3; k++) { api.line(5, 8 + k, 1, 6 + k * 2, '#181425', 1); api.line(10, 8 + k, 14, 6 + k * 2 + i, '#181425', 1); }
      })))),
      S('blob_boss', 6, [0, 1, 2, 3].map(i => Fr(ms(6), fx(api => {
        const h = [9, 10, 11, 10][i];
        api.ellipse(1, 15 - h, 14, 15, '#c026d3', true);
        api.ellipse(2, 15 - h + 1, 8, 15 - 3, '#f6757a', true);
        api.rect(4, 16 - h + 3, 5, 16 - h + 4, '#ffffff');
        api.rect(10, 16 - h + 3, 11, 16 - h + 4, '#ffffff');
        api.rect(5, 16 - h + 6, 10, 16 - h + 7, '#181425');
        api.rect(6, 16 - h - 1, 9, 16 - h, '#ffec27');
      }))))
    ] };
  }

  /* ---------------- tiny items ---------------- */
  function itemsSuite() {
    const S = (name, fps, frames) => D(name, fps, true, frames);
    return { width: 16, height: 16, name: 'pf-tiny-items', layers: [{ name: 'Items' }], states: [
      S('coin', 12, [0, 1, 2, 3].map(i => Fr(ms(12), fx(api => {
        const w = [4, 3, 1, 3][i];
        api.ellipse(8 - w, 3, 7 + w, 12, '#ffec27', true);
        api.ellipse(8 - w + 1, 4, 6 + w, 11, '#fff6c9', true);
        api.rect(7, 5, 8, 10, '#c27a1e');
      })))),
      one('heart', api => { api.rect(3, 5, 7, 8, '#e43b44'); api.rect(8, 5, 12, 8, '#e43b44'); api.rect(4, 8, 11, 10, '#e43b44'); api.px(5, 11, '#e43b44'); api.px(10, 11, '#e43b44'); api.px(7, 12, '#e43b44'); api.px(8, 12, '#e43b44'); api.px(5, 6, '#f6757a'); api.px(6, 5, '#f6757a'); }),
      one('key', api => { api.rect(2, 4, 6, 8, '#ffec27'); api.rect(3, 5, 5, 7, '#c27a1e'); api.rect(6, 6, 12, 7, '#ffec27'); api.rect(9, 7, 10, 11, '#ffec27'); api.rect(12, 7, 13, 10, '#ffec27'); }),
      one('potion', api => { api.rect(6, 2, 9, 4, '#8b9bb4'); api.ellipse(4, 5, 11, 13, '#e43b44', true); api.ellipse(5, 6, 8, 9, '#f6757a', true); api.rect(5, 9, 10, 12, '#a22633'); }),
      one('sword', api => { api.line(3, 13, 11, 4, '#c0cbdc', 1); api.line(3, 12, 10, 4, '#8b9bb4', 1); api.line(2, 11, 3, 12, '#8b9bb4', 1); api.line(2, 10, 5, 13, '#feae34', 1); api.px(12, 3, '#ffffff'); }),
      one('shield', api => { api.rect(3, 3, 12, 9, '#4a7fb5'); api.rect(4, 4, 11, 8, '#73eff7'); api.rect(5, 9, 10, 11, '#4a7fb5'); api.rect(6, 11, 9, 12, '#4a7fb5'); api.rect(7, 12, 8, 13, '#4a7fb5'); api.line(7, 4, 7, 11, '#ffffff', 1); api.line(5, 6, 10, 6, '#ffffff', 1); }),
      one('bomb', api => { api.ellipse(3, 5, 11, 13, '#26262e', true); api.ellipse(4, 6, 8, 9, '#5a5a66', true); api.rect(7, 2, 8, 4, '#8b9bb4'); api.px(9, 2, '#feae34'); api.px(10, 1, '#ffec27'); }),
      one('star', api => { api.line(8, 1, 8, 14, '#feae34', 2); api.line(2, 8, 14, 8, '#feae34', 2); api.line(3, 3, 13, 13, '#ffec27', 1); api.line(13, 3, 3, 13, '#ffec27', 1); api.rect(7, 7, 8, 8, '#fff6c9'); }),
      one('gem', api => { api.line(8, 2, 3, 7, '#41a6f6', 1); api.line(8, 2, 12, 7, '#41a6f6', 1); api.rect(3, 7, 12, 10, '#41a6f6'); api.rect(5, 11, 10, 12, '#41a6f6'); api.rect(6, 13, 9, 13, '#41a6f6'); api.rect(5, 4, 7, 6, '#c8ffff'); }),
      S('chest', 8, [0, 1].map(i => Fr(ms(8), fx(api => {
        api.rect(2, 7, 13, 13, '#b86f50'); api.rect(2, 7, 13, 7, '#e4a672'); api.rect(2, 12, 13, 13, '#733e39');
        if (i) { api.rect(2, 3, 13, 6, '#b86f50'); api.rect(2, 3, 13, 3, '#e4a672'); api.rect(3, 4, 12, 5, '#ffec27'); }
        else { api.rect(2, 4, 13, 7, '#b86f50'); api.rect(2, 4, 13, 4, '#e4a672'); }
        api.rect(7, 8, 8, 11, '#feae34');
      }))))
    ] };
  }

  /* ---------------- tiny tiles (4 x 16px on a 32x32 sheet) ---------------- */
  function tilesSuite() {
    const T = 16;
    const paints = [
      api => { api.rect(0, 0, 15, 15, '#3e8948'); api.speck(0, 0, 15, 15, 1, ['#63c74d', '#265c42'], 0.22); api.rect(0, 0, 15, 1, '#a7f070'); },
      api => { api.rect(0, 0, 15, 15, '#8b9bb4'); api.rect(0, 0, 15, 1, '#c0cbdc'); api.rect(0, 15, 15, 15, '#5a6988'); api.speck(1, 2, 14, 13, 2, ['#5a6988', '#c0cbdc'], 0.14); },
      api => { api.rect(0, 0, 15, 15, '#41a6f6'); api.rect(0, 0, 15, 1, '#73eff7'); api.rect(0, 15, 15, 15, '#124e89'); api.speck(0, 2, 15, 13, 3, ['#73eff7'], 0.12); },
      api => { api.rect(0, 0, 15, 15, '#b86f50'); api.rect(0, 0, 15, 1, '#e4a672'); for (let x = 2; x < 16; x += 6) api.line(x, 0, x, 15, '#733e39', 1); }
    ];
    return { width: 32, height: 32, name: 'pf-tiny-tiles', layers: [{ name: 'Tiles' }], states: [
      oneRaw('tiles', buf => {
        paints.forEach((fn, i) => {
          const api = P().offsetApi(P().makeApi(buf, 32, 32), (i % 2) * T, ((i / 2) | 0) * T);
          fn(api);
        });
      })
    ] };
  }

  return { heroSuite, foesSuite, itemsSuite, tilesSuite };
})();
