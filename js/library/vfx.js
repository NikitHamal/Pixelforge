/* PixelForge Studio — VFX pack.
   Combat and environment effects as first-class assets: explosions, muzzle
   flashes, smoke, impacts, beams, and ambient movement. Every state is a full
   animation rather than a still, because a still effect is the fastest way to
   make a game feel cheap. */
window.PF = window.PF || {};
PF.Vfx = (() => {
  const P = () => PF.Pixel, C = h => PF.Color.hexToU32(h);
  const OUT = '#181425', OUT32 = C(OUT);
  const PI2 = Math.PI * 2;
  const ms = fps => Math.round(1000 / fps);
  const Fr = (duration, paint) => ({ duration, paint });
  const D = (name, fps, loop, frames) => ({ name, fps, loop, frames });
  const anim = (name, fps, loop, cfgs, mk) => D(name, fps, loop, cfgs.map((c, i) => Fr(c && c.d ? c.d : ms(fps), mk(c, i))));
  const one = (name, apiFn) => D(name, 1, true, [Fr(1000, (buf) => { const api = P().makeApi(buf, 32, 32); apiFn(api); buf.set(PF.Raster.outline(buf, 32, 32, OUT32)); })]);
  const fx = fn => (buf) => { const a = P().makeApi(buf, 32, 32); fn(a); buf.set(PF.Raster.outline(buf, 32, 32, OUT32)); };

  const HOT = ['#ffffff', '#ffec27', '#feae34', '#e0603a'];
  const COOL = ['#ffffff', '#73eff7', '#41a6f6', '#29366f'];
  const TOXIC = ['#d9e86b', '#a7f070', '#3e8948', '#265c42'];
  const VOID = ['#ffffff', '#f6757a', '#c026d3', '#3e2347'];

  /* ---------------- explosions ---------------- */
  function explosionsSuite() {
    /* A blast grows on an ease-out, breaks into a ring, then smokes out. Six
       frames is the sweet spot: five reads as a pop, eight outlasts the shot. */
    const blast = (cols, big) => t => fx(api => {
      const k = [0.2, 0.55, 1, 0.9, 0.6, 0.3][t];
      const r = Math.max(1, Math.round((big ? 13 : 9) * k));
      if (t < 3) {
        api.ellipse(16 - r, 16 - r, 16 + r, 16 + r, cols[3], true);
        api.ellipse(16 - r + 1, 16 - r + 1, 16 + r - 2, 16 + r - 2, cols[2], true);
        api.ellipse(16 - r + 2, 16 - r + 2, 16 + r - 3, 16 + r - 3, cols[1], true);
        if (t < 2) api.ellipse(15, 15, 17, 17, cols[0], true);
      } else {
        P().ring(api, 16, 16, r + 2, cols[2], 2, 2);
        P().ring(api, 16, 16, r, cols[1], 1, 1);
      }
      P().smokePuff(api, 16, 14, 0.2 + t * 0.15, [cols[3], '#5a5a66', '#8b8b96'], 6, t);
      for (let i = 0; i < 8; i++) {
        const a = i / 8 * PI2 + t * 0.4;
        api.px(16 + Math.cos(a) * (r + 3), 16 + Math.sin(a) * (r + 3), t < 3 ? cols[1] : '#5a5a66');
      }
    });
    return { width: 32, height: 32, name: 'pf-vfx-explosions', layers: [{ name: 'FX' }], states: [
      anim('blast_small', 14, false, [0, 1, 2, 3, 4, 5], blast(HOT, false)),
      anim('blast_large', 14, false, [0, 1, 2, 3, 4, 5], blast(HOT, true)),
      anim('plasma', 14, false, [0, 1, 2, 3, 4, 5], blast(COOL, true)),
      anim('void_tear', 14, false, [0, 1, 2, 3, 4, 5], blast(VOID, false)),
      anim('poison_burst', 12, false, [0, 1, 2, 3, 4, 5], blast(TOXIC, false))
    ] };
  }

  /* ---------------- muzzle flashes ---------------- */
  function muzzleSuite() {
    const flash = o => fx(api => {
      const cx = o.cx === undefined ? 16 : o.cx, cy = o.cy === undefined ? 16 : o.cy, t = o.t;
      const cols = o.cols || HOT;
      const R = 2 + Math.round(t * 6);
      if (o.kind === 'shotgun') {
        api.ellipse(cx - R, cy - R, cx + R, cy + R, cols[1], true);
        api.ellipse(cx - R + 2, cy - R + 2, cx + R - 2, cy + R - 2, cols[0], true);
        for (let k = -1; k <= 1; k++) api.line(cx, cy + k * 2, cx + 8, cy + k * 3, cols[2], 1);
      } else if (o.kind === 'cannon') {
        P().ring(api, cx, cy, R + 3, cols[2], 2);
        api.ellipse(cx - R, cy - R, cx + R, cy + R, cols[1], true);
        api.ellipse(cx - 1, cy - 1, cx + 1, cy + 1, cols[0], true);
        P().smokePuff(api, cx + 4, cy, 0.3 + t * 0.2, ['#5a5a66', '#8b8b96'], 5, 1);
      } else if (o.kind === 'energy') {
        P().ring(api, cx, cy, R + 2, cols[1], 1, 1);
        for (let k = 0; k < 6; k++) { const a = k / 6 * PI2; api.line(cx, cy, cx + Math.cos(a) * (R + 4), cy + Math.sin(a) * (R + 4), cols[1], 1); }
        api.ellipse(cx - 2, cy - 2, cx + 2, cy + 2, cols[0], true);
      } else {
        // pistol / rifle: a four-point star with a hot core and a short plume
        api.line(cx - R - 2, cy, cx + R + 2, cy, cols[2], 1);
        api.line(cx, cy - R - 2, cx, cy + R + 2, cols[2], 1);
        api.line(cx - R, cy - R, cx + R, cy + R, cols[3], 1);
        api.line(cx + R, cy - R, cx - R, cy + R, cols[3], 1);
        api.rect(cx - 2, cy - 2, cx + 2, cy + 2, cols[0]);
        if (o.dir) api.line(cx, cy, cx + o.dir * 9, cy, cols[1], 2);
      }
    });
    return { width: 32, height: 32, name: 'pf-vfx-muzzle', layers: [{ name: 'FX' }], states: [
      anim('pistol', 24, false, [0.4, 0.8, 0.2], t => flash({ t, dir: 1 })),
      anim('rifle', 24, false, [0.5, 1, 0.3], t => flash({ t, dir: 1, cx: 10 })),
      anim('shotgun', 18, false, [0.6, 1, 0.4, 0.15], t => flash({ t, kind: 'shotgun', cx: 8 })),
      anim('cannon', 12, false, [0.5, 1, 0.8, 0.3], t => flash({ t, kind: 'cannon', cols: ['#ffffff', '#ffb03a', '#e0603a', '#5a5a66'] })),
      anim('energy', 20, false, [0.4, 0.9, 0.5, 0.2], t => flash({ t, kind: 'energy', cols: COOL }))
    ] };
  }

  /* ---------------- smoke & clouds ---------------- */
  function smokeSuite() {
    const S = (name, fps, frames) => D(name, fps, true, frames);
    return { width: 32, height: 32, name: 'pf-vfx-smoke', layers: [{ name: 'FX' }], states: [
      S('smoke_puff', 8, [0, 1, 2, 3, 4].map(i => Fr(ms(8), fx(api => {
        P().smokePuff(api, 16, 22, i / 5, ['#3a3a44', '#5a5a66', '#8b8b96', '#c0c0c8'], 7, i);
        for (let k = 0; k < 4; k++) { const x = 10 + ((k * 5 + i * 2) % 12); api.px(x, 20 - i * 2, '#26262e'); }
      })))),
      S('dust_cloud', 10, [0, 1, 2, 3, 4].map(i => Fr(ms(10), fx(api => {
        const r = 3 + i * 2;
        for (let k = 0; k < 8; k++) {
          const a = k / 8 * PI2, rr = r + (k % 3);
          api.ellipse(16 + Math.cos(a) * rr - 2, 24 + Math.sin(a) * rr * 0.5 - 2, 16 + Math.cos(a) * rr + 2, 24 + Math.sin(a) * rr * 0.5 + 2, k % 2 ? '#c28569' : '#e4a672', true);
        }
      })))),
      S('steam_vent', 8, [0, 1, 2, 3, 4].map(i => Fr(ms(8), fx(api => {
        api.rect(12, 24, 19, 27, '#5a6988'); api.rect(12, 24, 19, 25, '#8b9bb4');
        for (let k = 0; k <= i; k++) {
          const y = 22 - k * 4, r = 2 + (i - k);
          api.ellipse(16 - r, y - r, 16 + r, y + r, k > 2 ? '#e8ecf5' : '#ffffff', true);
        }
      })))),
      S('poison_cloud', 6, [0, 1, 2, 3, 4].map(i => Fr(ms(6), fx(api => {
        for (let k = 0; k < 10; k++) {
          const x = 4 + ((api.hash(k, i, 3) * 24) | 0), y = 8 + ((api.hash(k, i, 7) * 18) | 0);
          api.ellipse(x - 2, y - 1, x + 2, y + 1, k % 3 ? '#3e8948' : '#a7f070', true);
        }
        api.px(16, 20, '#d9e86b');
      })))),
      S('muzzle_smoke', 6, [0, 1, 2, 3].map(i => Fr(ms(6), fx(api => {
        for (let k = 0; k <= i; k++) {
          const x = 8 + k * 5, y = 18 - k * 3;
          api.ellipse(x - 2, y - 2, x + 2, y + 2, k > 1 ? '#8b8b96' : '#c0c0c8', true);
        }
      }))))
    ] };
  }

  /* ---------------- impacts ---------------- */
  function impactsSuite() {
    const S = (name, fps, frames) => D(name, fps, true, frames);
    return { width: 32, height: 32, name: 'pf-vfx-impacts', layers: [{ name: 'FX' }], states: [
      anim('spark_burst', 20, true, [0, 1, 2], i => fx(api => {
        P().impactStar(api, 16, 16, 0.4 + i * 0.3, HOT, 9 - i);
        P().sparks(api, 16, 16, i, '#ffec27', 8, 2, 5 + i * 2);
      })),
      anim('metal_hit', 20, true, [0, 1, 2, 3], i => fx(api => {
        api.rect(7, 7, 24, 9, '#8b9bb4'); api.rect(7, 7, 24, 7, '#c0cbdc');
        api.rect(7, 9, 24, 10, '#5a6988');
        P().sparks(api, 16, 8, i, '#ffffff', 7, 1, 4 + i * 3);
        api.px(16, 6, '#ffec27');
      })),
      anim('wood_break', 18, true, [0, 1, 2, 3], i => fx(api => {
        for (let k = 0; k <= i; k++) {
          const x = 8 + k * 6, y = 8 + (k % 3) * 3;
          api.rect(x, y, x + 4, y + 2, '#b86f50'); api.rect(x, y, x + 4, y, '#e4a672');
        }
        P().sparks(api, 16, 14, i, '#c28569', 6, 1, 3 + i * 2);
      })),
      /* Splash height is a sine of t, so evenly spaced t values repeat their
         magnitude on the way up and down (0.4 and 0.6 both round to 5px). The
         ripple ring carries the other half of the beat. */
      anim('water_splash', 14, false, [0, 0.3, 0.55, 0.8], t => fx(api => {
        const r = Math.round(t * 12);
        P().splash(api, 16, 24, t, ['#ffffff', '#73eff7', '#41a6f6']);
        if (r) api.ellipse(16 - r, 24 - r / 2, 16 + r, 24 + r / 2, '#73eff7', false);
        api.rect(0, 25, 31, 27, '#41a6f6');
      })),
      anim('stone_debris', 16, true, [0, 1, 2, 3], i => fx(api => {
        for (let k = 0; k < 7; k++) {
          const a = k / 7 * PI2 + i * 0.3, r = 3 + i * 2;
          api.rect(16 + Math.cos(a) * r - 1, 20 + Math.sin(a) * r - 1, 16 + Math.cos(a) * r + 1, 20 + Math.sin(a) * r + 1, k % 2 ? '#8b9bb4' : '#5a6988');
        }
      })),
      anim('glass_shatter', 18, true, [0, 1, 2, 3], i => fx(api => {
        for (let k = 0; k < 9; k++) {
          const a = k / 9 * PI2, r = 2 + i * 3;
          api.line(16 + Math.cos(a) * r, 16 + Math.sin(a) * r, 16 + Math.cos(a) * (r + 3), 16 + Math.sin(a) * (r + 3), '#c8ffff', 1);
        }
        api.px(16, 16, '#ffffff');
      })),
      anim('blood_splat', 14, true, [0, 1, 2, 3], i => fx(api => {
        const r = 2 + i * 2;
        api.ellipse(16 - r, 16 - r, 16 + r, 16 + r, '#a22633', true);
        api.ellipse(16 - r + 1, 16 - r + 1, 16 + r - 2, 16 + r - 2, '#e43b44', true);
        P().sparks(api, 16, 16, i, '#5c1a1a', 8, r + 1, r + 4);
      })),
      anim('magic_hit', 16, true, [0, 1, 2, 3], i => fx(api => {
        P().ring(api, 16, 16, 4 + i * 3, VOID[i % 3], 2, i % 2 ? 2 : 0);
        P().sparks(api, 16, 16, i, '#ffffff', 6, 2, 6 + i * 2);
        api.px(16, 16, '#ffffff');
      })),
      anim('shield_block', 16, true, [0, 1, 2], i => fx(api => {
        api.ellipse(6, 6, 25, 25, '#4a7fb5', i ? false : true);
        P().ring(api, 16, 16, 10 - i * 2, '#73eff7', 1, 2);
        P().impactStar(api, 16, 16, 0.5 + i * 0.2, COOL, 7);
      }))
    ] };
  }

  /* ---------------- beams & magic ---------------- */
  function beamsSuite() {
    const S = (name, fps, frames) => D(name, fps, true, frames);
    return { width: 32, height: 32, name: 'pf-vfx-beams', layers: [{ name: 'FX' }], states: [
      anim('laser_beam', 24, false, [0, 1, 2, 3], i => fx(api => {
        P().beam(api, 0, 16, 5 + i * 9, 16, COOL, 3);
        api.rect(0, 15, 2, 17, '#5a6988');
      })),
      anim('plasma_beam', 20, false, [0, 1, 2, 3], i => fx(api => {
        P().beam(api, 0, 16, 8 + i * 8, 16, VOID, 4);
        for (let k = 0; k < 4; k++) api.px(4 + k * 7, 13 + (k % 2) * 5, '#f6757a');
      })),
      anim('lightning', 16, true, [0, 1, 2, 3], i => fx(api => {
        let x = 16;
        for (let y = 0; y < 30; y += 3) {
          x += [0, 3, -2, 2, -3, 1][((y / 3) | 0) + i % 6] || 0;
          api.line(x, y, x, y + 3, '#ffffff', 2);
          api.px(x + 1, y + 1, '#9fd0ff');
        }
      })),
      S('magic_circle', 8, [0, 1, 2, 3, 4, 5].map(i => Fr(ms(8), fx(api => {
        const r = 12;
        P().ring(api, 16, 16, r, '#c026d3', 1, 2);
        P().ring(api, 16, 16, r - 3, '#f6757a', 1, 1);
        for (let k = 0; k < 6; k++) {
          const a = k / 6 * PI2 + i / 12 * PI2; // 30deg steps: a 60deg star step is invisible
          api.line(16 + Math.cos(a) * (r - 3), 16 + Math.sin(a) * (r - 3), 16 + Math.cos(a + PI2 / 6) * (r - 3), 16 + Math.sin(a + PI2 / 6) * (r - 3), '#ff7ab8', 1);
        }
        api.px(16, 16, i % 2 ? '#ffffff' : '#c026d3');
      })))),
      S('shockwave', 12, [0, 1, 2, 3, 4].map(i => Fr(ms(12), fx(api => {
        const r = 3 + i * 5;
        P().ring(api, 16, 24, r, '#ffffff', 3 - (i > 3 ? 1 : 0), 0);
        P().ring(api, 16, 24, Math.max(1, r - 3), '#73eff7', 1, 2);
      })))),
      S('portal', 8, [0, 1, 2, 3, 4, 5].map(i => Fr(ms(8), fx(api => {
        for (let k = 0; k < 5; k++) {
          const a = k / 5 * PI2 + i / 6 * PI2 * 2;
          const rr = 6 + (k % 3) * 2;
          api.ellipse(16 + Math.cos(a) * rr - 2, 16 + Math.sin(a) * rr - 2, 16 + Math.cos(a) * rr + 2, 16 + Math.sin(a) * rr + 2, k % 2 ? '#c026d3' : '#41a6f6', true);
        }
        api.ellipse(12, 12, 19, 19, '#05010f', true);
        api.px(16, 16, '#ffffff');
      })))),
      S('heal_glow', 10, [0, 1, 2].map(i => Fr(ms(10), fx(api => {
        api.rect(14, 12 + i, 17, 26, '#ffffff');
        api.rect(11, 15 + i, 20, 18 + i, '#ffffff');
        for (let k = 0; k < 8; k++) { const x = 6 + ((k * 4 + i * 3) % 20); api.px(x, 24 - i * 3 - (k % 3), '#a7f070'); }
      }))))
    ] };
  }

  /* ---------------- ambient environment ---------------- */
  function environmentSuite() {
    const S = (name, fps, frames) => D(name, fps, true, frames);
    return { width: 32, height: 32, name: 'pf-vfx-ambient', layers: [{ name: 'FX' }], states: [
      S('fog_bank', 5, [0, 1, 2, 3].map(i => Fr(ms(5), fx(api => {
        for (let k = 0; k < 22; k++) {
          const x = ((api.hash(k, i, 3) * 31) | 0), y = 10 + ((api.hash(k, i, 9) * 12) | 0);
          api.px(x, y, '#c0cbdc'); api.px(x + 1, y, '#8b9bb4');
        }
        api.rect(0, 22, 31, 25, '#8b9bb4');
        api.rect(0, 25, 31, 27, '#5a6988');
      })))),
      S('embers', 6, [0, 1, 2, 3].map(i => Fr(ms(6), fx(api => {
        for (let k = 0; k < 8; k++) {
          const x = ((api.hash(k, 1, 5) * 30) | 0) + (i % 2);
          const y = 28 - ((k * 4 + i * 3) % 26);
          api.px(x, y, k % 3 ? '#feae34' : '#ffec27');
        }
      })))),
      S('snow_gust', 6, [0, 1, 2, 3].map(i => Fr(ms(6), fx(api => {
        for (let k = 0; k < 16; k++) {
          const x = ((api.hash(k, i, 7) * 30) | 0) + (i * 2);
          const y = ((api.hash(k, i, 11) * 30) | 0);
          api.px(x % 32, y, '#ffffff'); api.px((x + 1) % 32, y, '#e8ecf5');
        }
      })))),
      S('falling_leaves', 6, [0, 1, 2, 3].map(i => Fr(ms(6), fx(api => {
        for (let k = 0; k < 7; k++) {
          const x = ((api.hash(k, 1, 13) * 28) | 0) + ((i + k) % 2);
          const y = ((k * 5 + i * 2) % 28);
          P().leaf(api, x, y, api.hash(k, 2, 17) * PI2, 3, k % 2 ? '#e0603a' : '#feae34', '#8a5a2b');
        }
      })))),
      S('bubble_column', 6, [0, 1, 2, 3].map(i => Fr(ms(6), fx(api => {
        for (let k = 0; k < 6; k++) {
          const x = 8 + ((k * 4) % 16) + (k % 2);
          const y = 28 - ((k * 5 + i * 4) % 26);
          P().bubble(api, x, y, 1 + (k % 3), '#73eff7', '#ffffff');
        }
      })))),
      S('heat_haze', 4, [0, 1, 2, 3].map(i => Fr(ms(4), fx(api => {
        for (let y = 0; y < 32; y += 2) {
          const x = 8 + Math.round(Math.sin((y + i * 2) / 3) * 4);
          api.rect(x, y, x + 14, y, i % 2 ? '#feae34' : '#ffec27');
        }
        api.rect(0, 28, 31, 31, '#5c3a1e');
      })))),
      S('rain_splash', 12, [0, 1, 2].map(i => Fr(ms(12), fx(api => {
        api.rect(0, 24, 31, 27, '#29366f'); api.rect(0, 24, 31, 25, '#41a6f6');
        P().splash(api, 10 + i * 5, 24, 0.4 + i * 0.2, ['#ffffff', '#73eff7', '#41a6f6']);
      }))))
    ] };
  }

  return { explosionsSuite, muzzleSuite, smokeSuite, impactsSuite, beamsSuite, environmentSuite, HOT, COOL, TOXIC, VOID };
})();
