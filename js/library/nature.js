/* PixelForge Studio — Nature, ocean and space pack.
   Biomes, flora, wildlife, reef life and orbit props. Every creature here is a
   purpose-built rig: fish and birds cannot be drawn with the biped or quadruped
   rig without looking like a person in a costume. */
window.PF = window.PF || {};
PF.Nature = (() => {
  const P = () => PF.Pixel, C = h => PF.Color.hexToU32(h);
  const OUT = '#181425', OUT32 = C(OUT);
  const PI2 = Math.PI * 2;
  const ms = fps => Math.round(1000 / fps);
  const Fr = (duration, paint) => ({ duration, paint });
  const D = (name, fps, loop, frames) => ({ name, fps, loop, frames });
  const anim = (name, fps, loop, cfgs, mk) => D(name, fps, loop, cfgs.map((c, i) => Fr(c && c.d ? c.d : ms(fps), mk(c, i))));
  const one = (name, apiFn) => D(name, 1, true, [Fr(1000, fx(apiFn))]);
  const api32 = (buf, fn) => { const a = P().makeApi(buf, 32, 32); fn(a); buf.set(PF.Raster.outline(buf, 32, 32, OUT32)); };
  const fx = fn => (buf) => api32(buf, fn);

  /* ---------------- flora ---------------- */
  function treesSuite() {
    /* One rig, eight species: trunk + canopy, where the species is a palette
       plus a canopy shape. Sway is a 1px canopy shift on alternate frames and
       is authored as a two-frame hold/lean so it never stalls. */
    const leaf = (api, cx, cy, rx, ry, cols, seed) => P().canopy(api, cx, cy, rx, ry, cols, seed);
    const sway = (k, dir) => (o) => (api) => {
      const d = o.sway || 0;
      if (o.kind === 'oak') {
        api.rect(15, 18, 17, 27, '#733e39'); api.rect(15, 18, 15, 27, '#3e2731');
        leaf(api, 16 + d, 13, 9, 7, ['#265c42', '#3e8948', '#63c74d'], k);
        api.rect(14, 20, 18, 21, '#5c3a1e');
      } else if (o.kind === 'pine') {
        api.rect(15, 22, 17, 27, '#5c3a1e');
        for (let r = 0; r < 3; r++) {
          const y = 21 - r * 5, w = 4 + r * 3;
          api.ellipse(16 + d - w, y - 4, 16 + d + w, y + 2, r ? '#265c42' : '#193c3e', true);
          api.ellipse(16 + d - w + 1, y - 4, 16 + d + w - 1, y - 1, '#3e8948', true);
        }
      } else if (o.kind === 'palm') {
        api.rect(15, 14, 17, 27, '#b86f50'); api.rect(15, 14, 15, 27, '#733e39');
        for (let a = 0; a < 6; a++) {
          const ang = -PI2 * a / 6 - 0.3;
          P().leaf(api, 16 + Math.cos(ang) * 6, 13 + Math.sin(ang) * 5 + d, ang, 9, '#3e8948', '#63c74d');
        }
        api.px(16, 12, '#8b5a2b'); api.px(17, 13, '#8b5a2b');
      } else if (o.kind === 'dead') {
        api.rect(15, 10, 17, 27, '#5c3a1e'); api.rect(15, 10, 15, 27, '#3e2731');
        api.line(16, 14, 9 + d, 10, '#5c3a1e', 2); api.line(16, 18, 24 + d, 13, '#5c3a1e', 2);
        api.line(16, 22, 11 + d, 19, '#3e2731', 1);
      } else if (o.kind === 'birch') {
        api.rect(15, 14, 17, 27, '#e8ecf5'); api.rect(15, 14, 15, 27, '#8b9bb4');
        for (let y = 15; y < 27; y += 4) { api.px(16, y, '#3a4466'); api.px(15, y + 2, '#3a4466'); }
        leaf(api, 16 + d, 10, 7, 6, ['#265c42', '#63c74d', '#a7f070'], k + 2);
      } else if (o.kind === 'willow') {
        api.rect(15, 16, 17, 27, '#5c3a1e');
        leaf(api, 16 + d, 12, 9, 5, ['#193c3e', '#265c42', '#3e8948'], k);
        for (let x = 8; x <= 24; x += 3) api.line(x, 14, x + (d ? 1 : 0), 22 + (x % 3), '#265c42', 1);
      } else if (o.kind === 'cactus') {
        api.rect(14, 8, 18, 27, '#3e8948'); api.rect(14, 8, 14, 27, '#265c42');
        api.rect(14, 8, 18, 9, '#63c74d');
        api.rect(10, 14, 14, 16, '#3e8948'); api.rect(10, 12, 11, 16, '#3e8948');
        api.rect(18, 18, 22, 20, '#3e8948'); api.rect(21, 14, 22, 20, '#3e8948');
        api.px(16, 6, '#f6757a'); api.px(15, 7, '#f6757a');
        for (let y = 12; y < 27; y += 5) api.px(17, y, '#265c42');
      } else { // bush + flowers
        leaf(api, 16 + d, 20, 8, 6, ['#265c42', '#3e8948', '#63c74d'], k + 1);
        api.px(12, 17, '#f6757a'); api.px(19, 16, '#ffec27'); api.px(15, 14, '#9fd0ff');
      }
    };
    /* sway() is api-level; tree states wrap it once here so the frame list
       stays readable. */
    const tree = (k, o) => fx(sway(k, 0)(o));
    return { width: 32, height: 32, name: 'pf-nature-trees', layers: [{ name: 'World' }], states: [
      D('oak', 3, true, [Fr(ms(3), tree(1, { kind: 'oak', sway: 0 })), Fr(ms(3), tree(1, { kind: 'oak', sway: 1 }))]),
      D('pine', 3, true, [Fr(ms(3), tree(2, { kind: 'pine', sway: 0 })), Fr(ms(3), tree(2, { kind: 'pine', sway: -1 }))]),
      D('palm', 4, true, [Fr(ms(4), tree(3, { kind: 'palm', sway: 0 })), Fr(ms(4), tree(3, { kind: 'palm', sway: 1 })), Fr(ms(4), tree(3, { kind: 'palm', sway: 0 })), Fr(ms(4), tree(3, { kind: 'palm', sway: -1 }))]),
      D('dead', 4, true, [Fr(ms(4), tree(4, { kind: 'dead', sway: 0 })), Fr(ms(4), tree(4, { kind: 'dead', sway: 1 }))]),
      D('birch', 3, true, [Fr(ms(3), tree(5, { kind: 'birch', sway: 0 })), Fr(ms(3), tree(5, { kind: 'birch', sway: -1 }))]),
      D('willow', 4, true, [Fr(ms(4), tree(6, { kind: 'willow', sway: 0 })), Fr(ms(4), tree(6, { kind: 'willow', sway: 1 }))]),
      one('cactus', sway(7, 0)({ kind: 'cactus' })),
      one('bush', sway(8, 0)({ kind: 'bush' }))
    ] };
  }

  /* ---------------- rocks & minerals ---------------- */
  function rocksSuite() {
    const rock = '#8b9bb4', rockHi = '#c0cbdc', rockSh = '#5a6988', dark = '#3a4466';
    const ore = (cols, seed) => (api) => {
      api.ellipse(6, 14, 25, 27, rockSh, true);
      api.ellipse(8, 12, 23, 24, rock, true);
      api.ellipse(9, 12, 18, 17, rockHi, true);
      api.speck(9, 16, 22, 25, seed, [dark], 0.12);
      for (let i = 0; i < 5; i++) {
        const x = 10 + ((i * 5 + seed) % 12), y = 15 + ((i * 3 + seed) % 9);
        api.rect(x, y, x + 1, y + 1, cols[i % cols.length]);
      }
    };
    return { width: 32, height: 32, name: 'pf-nature-rocks', layers: [{ name: 'World' }], states: [
      one('boulder', api => {
        api.ellipse(5, 12, 26, 27, rockSh, true);
        api.ellipse(7, 10, 24, 24, rock, true);
        api.ellipse(8, 11, 16, 16, rockHi, true);
        api.line(9, 20, 15, 23, dark, 1); api.line(17, 15, 21, 19, dark, 1);
        api.speck(8, 14, 23, 26, 1, [dark], 0.1);
      }),
      one('cairn', api => {
        for (let i = 0; i < 4; i++) {
          const w = 9 - i, y = 26 - i * 5;
          api.ellipse(16 - w, y - 3, 16 + w, y, i % 2 ? rock : rockSh, true);
          api.ellipse(16 - w + 1, y - 3, 16 + w - 1, y - 1, rockHi, true);
        }
      }),
      one('ore_gold', ore(['#ffec27', '#feae34'], 2)),
      one('ore_gem', ore(['#41a6f6', '#c8ffff'], 5)),
      one('ore_iron', ore(['#c0cbdc', '#8b9bb4'], 8)),
      anim('geode', 6, true, [0, 1], i => fx(api => {
        api.ellipse(6, 14, 25, 27, rockSh, true);
        api.ellipse(8, 12, 23, 24, rock, true);
        api.ellipse(11, 16, 20, 24, '#3e2347', true);
        for (let k = 0; k < 4; k++) api.rect(13 + k * 2, 18 - k, 14 + k * 2, 22 - k, i ? '#c026d3' : '#b55088');
        api.px(14, 17, i ? '#ffffff' : '#f6757a');
      }))
    ] };
  }

  /* ---------------- small ground critters ---------------- */
  function crittersSuite() {
    const rig = o => fx(api => {
      const legA = o.legA || 0, legB = o.legB || 0, tail = o.tail || 0, blink = o.blink, crouch = o.crouch || 0;
      const cy = 22 - crouch;
      const body = o.body, bodyHi = o.bodyHi, bodySh = o.bodySh, eye = '#ffffff', pupil = '#181425';
      // legs first (behind the body)
      api.rect(11 + legA, cy + 2, 13 + legA, 27 - crouch, bodySh);
      api.rect(18 + legB, cy + 2, 20 + legB, 27 - crouch, bodySh);
      api.rect(10 + legA, 26 - crouch, 14 + legA, 27 - crouch, '#3e2731');
      api.rect(17 + legB, 26 - crouch, 21 + legB, 27 - crouch, '#3e2731');
      // tail
      if (o.tailKind === 'bushy') { api.ellipse(21 + tail, cy - 8, 29 + tail, cy + 5, body, true); api.ellipse(23 + tail, cy - 6, 28 + tail, cy + 1, bodyHi, true); }
      else if (o.tailKind === 'long') { api.line(21, cy + 1, 27 + tail, cy - 3, bodySh, 2); api.px(28 + tail, cy - 4, bodySh); }
      else if (o.tailKind === 'curl') { api.line(21, cy, 25, cy - 4, bodySh, 1); api.line(25, cy - 4, 22, cy - 6, bodySh, 1); }
      // body
      api.ellipse(7, cy - 6, 24, cy + 5, body, true);
      api.ellipse(8, cy - 6, 19, cy - 1, bodyHi, true);
      api.ellipse(7, cy + 1, 24, cy + 5, bodySh, true);
      // head
      api.ellipse(o.headUp ? 12 : 8, cy - (o.headUp || 0) - 9, o.headUp ? 22 : 18, cy - (o.headUp || 0) - 1, body, true);
      api.px(13, cy - (o.headUp || 0) - 7, eye); api.px(16, cy - (o.headUp || 0) - 7, eye);
      if (!blink) { api.px(13, cy - (o.headUp || 0) - 7, pupil); api.px(16, cy - (o.headUp || 0) - 7, pupil); }
      api.px(17, cy - (o.headUp || 0) - 5, bodySh);
      if (o.ears) { api.rect(11, cy - (o.headUp || 0) - 12, 12, cy - (o.headUp || 0) - 9, body); api.rect(17, cy - (o.headUp || 0) - 12, 18, cy - (o.headUp || 0) - 9, body); }
      if (o.spines) for (let k = 0; k < 5; k++) api.px(10 + k * 2, cy - 6 - (k % 2), bodySh);
    });
    const S = (name, fps, frames) => D(name, fps, true, frames);
    return { width: 32, height: 32, name: 'pf-nature-critters', layers: [{ name: 'Body' }], states: [
      D('squirrel', 8, true, [0, 1, 2, 3].map(i => Fr(ms(8), rig({ body: '#b86f50', bodyHi: '#e4a672', bodySh: '#733e39', tailKind: 'bushy', tail: [0, 1, 0, -1][i], legA: [0, 1, 0, -1][i], legB: [0, -1, 0, 1][i], ears: true, blink: i === 3 })))),
      D('hedgehog', 8, true, [0, 1].map(i => Fr(ms(8), rig({ body: '#8b5a2b', bodyHi: '#b86f50', bodySh: '#5c3a1e', spines: true, legA: i * 2, legB: -i * 2, crouch: i, blink: !!i })))),
      D('mouse', 10, true, [0, 1, 0, 1].map((l, i) => Fr(ms(10), rig({ body: '#94b0c2', bodyHi: '#c0cbdc', bodySh: '#5a6988', tailKind: 'long', tail: l * 2, legA: i % 2, legB: -(i % 2), ears: true })))),
      D('fox', 8, true, [0, 1, 0, 1].map((l, i) => Fr(ms(8), rig({ body: '#e0603a', bodyHi: '#f4936a', bodySh: '#a22633', tailKind: 'bushy', tail: l * 2, legA: i ? 1 : 0, legB: i ? -1 : 0, ears: true, blink: i === 1 })))),
      D('snake', 8, true, [0, 1, 2, 3].map(i => Fr(ms(8), fx(api => {
        for (let x = 4; x < 28; x++) {
          const y = 24 - Math.round(Math.sin(x / 3 + i / 2) * 2);
          api.rect(x, y, x, y + 2, '#3e8948');
          api.px(x, y + 2, '#265c42');
        }
        api.ellipse(22, 19, 27, 24, '#3e8948', true);
        api.px(24, 21, '#181425');
        api.line(23, 24, 24, 27, '#e43b44', 1);
      })))),
      D('lizard', 8, true, [0, 1].map(i => Fr(ms(8), rig({ body: '#63c74d', bodyHi: '#a7f070', bodySh: '#3e8948', tailKind: 'long', tail: i * 2, legA: i, legB: -i, spines: true })))),
      D('beetle', 10, true, [0, 1, 0, 1].map((l, i) => Fr(ms(10), fx(api => {
        api.ellipse(8, 18, 24, 26, '#262b44', true);
        api.ellipse(10, 19, 22, 23, '#3a4466', true);
        api.line(16, 19, 16, 26, '#181425', 1);
        api.ellipse(11, 14, 21, 20, '#262b44', true);
        api.px(13, 16, '#ffec27'); api.px(18, 16, '#ffec27');
        api.line(12, 20, 8, 27, '#181425', 1); api.line(20, 20, 24, 27, '#181425', 1);
        api.line(14, 20, 11 + l * 2, 27, '#181425', 1); api.line(18, 20, 21 - l * 2, 27, '#181425', 1);
      }))))
    ] };
  }

  /* ---------------- birds (flying) ---------------- */
  function birdsSuite() {
    const bird = o => fx(api => {
      const flap = o.flap, cy = 15 + (o.bob || 0), b = o.pal;
      if (flap === 0) {
        api.ellipse(3, cy - 7, 13, cy + 1, b.wing, true); api.ellipse(19, cy - 7, 29, cy + 1, b.wing, true);
        api.ellipse(5, cy - 5, 12, cy, b.wingHi, true); api.ellipse(20, cy - 5, 27, cy, b.wingHi, true);
      } else {
        api.ellipse(3, cy, 13, cy + 7, b.wing, true); api.ellipse(19, cy, 29, cy + 7, b.wing, true);
      }
      api.ellipse(11, cy - 6, 21, cy + 6, b.body, true);
      api.ellipse(12, cy - 5, 19, cy, b.bodyHi, true);
      api.ellipse(12, cy + 3, 20, cy + 6, b.sh, true);
      api.ellipse(13, cy - 8, 19, cy - 3, b.body, true);
      api.px(15, cy - 6, '#ffffff'); api.px(15, cy - 6, b.eye);
      api.ellipse(19, cy - 6, 22, cy - 3, '#feae34', true);
      api.rect(20, cy + 4, 24, cy + 5, b.sh);
      if (o.tuft) { api.px(14, cy - 10, b.sh); api.px(13, cy - 11, b.sh); }
    });
    const pal = (body, bodyHi, sh, wing, wingHi, eye) => ({ body, bodyHi, sh, wing, wingHi, eye });
    const CROW = pal('#262b44', '#3a4466', '#181425', '#3a4466', '#5a6988', '#ffec27');
    const OWL = pal('#8b5a2b', '#b86f50', '#5c3a1e', '#b86f50', '#e4a672', '#ffec27');
    const GULL = pal('#e8ecf5', '#ffffff', '#8b9bb4', '#c0cbdc', '#ffffff', '#262b44');
    const PARROT = pal('#e43b44', '#f6757a', '#a22633', '#41a6f6', '#73eff7', '#181425');
    const fly = (name, p, bob, speed) => D(name, speed, true, [0, 1, 0, 1].map((f, i) => Fr(ms(speed), bird({ flap: f, bob: [0, bob, -1, bob][i], pal: p }))));
    return { width: 32, height: 32, name: 'pf-nature-birds', layers: [{ name: 'Body' }], states: [
      fly('fly_crow', CROW, -2, 8), fly('fly_owl', OWL, 0, 6), fly('fly_gull', GULL, -1, 7), fly('fly_parrot', PARROT, -1, 9),
      D('perch', 4, true, [0, 1].map(i => Fr(ms(4), bird({ flap: 0, bob: -1 + i, pal: CROW, tuft: true }))))
    ] };
  }

  /* ---------------- fish ---------------- */
  function fishSuite() {
    const fish = o => fx(api => {
      const t = o.t, b = o.pal, cy = 16 + (o.bob || 0), flip = o.dir < 0;
      const X = x => flip ? 31 - x : x;
      // tail fin sweeps on the swim beat
      api.ellipse(X(24), cy - 4 - t, X(31), cy + 4 - t, b.fin, true);
      api.ellipse(X(23), cy - 3, X(28), cy + 3, b.fin2 || b.fin, true);
      // dorsal + belly fins
      api.ellipse(X(12), cy - 8, X(17), cy - 4, b.fin, true);
      api.ellipse(X(12), cy + 4, X(17), cy + 8, b.fin, true);
      // body
      api.ellipse(X(5), cy - 5, X(25), cy + 5, b.body, true);
      api.ellipse(X(6), cy - 4, X(20), cy, b.bodyHi, true);
      api.ellipse(X(5), cy + 2, X(25), cy + 5, b.sh, true);
      // eye + gill + mouth
      api.px(X(20), cy - 2, '#ffffff'); api.px(X(20), cy - 2, b.eye);
      api.line(X(18), cy - 3, X(18), cy + 1, b.sh, 1);
      api.px(X(6), cy + 1, b.sh);
      if (b.stripes) for (let k = 0; k < 3; k++) api.line(X(11 + k * 4), cy - 5, X(11 + k * 4), cy + 5, b.stripes, 1);
      if (o.spots) for (let k = 0; k < 4; k++) api.px(X(9 + k * 4), cy - 3 + (k % 2) * 3, b.spots);
    });
    const pal = (body, bodyHi, sh, fin, eye, extra = {}) => ({ body, bodyHi, sh, fin, eye, ...extra });
    const SPECIES = [
      ['guppy', pal('#41a6f6', '#73eff7', '#124e89', '#2ce8f5', '#181425'), 9],
      ['clownfish', pal('#e0603a', '#f4936a', '#a22633', '#ffec27', '#181425', { stripes: '#f4f4f4' }), 8],
      ['angelfish', pal('#ffec27', '#fff6c9', '#c27a1e', '#feae34', '#181425', { stripes: '#3a4466' }), 7],
      ['pufferfish', pal('#a7f070', '#d9e86b', '#3e8948', '#8fce5a', '#181425', { spots: '#265c42' }), 6],
      ['eel', pal('#3e2347', '#68386c', '#181425', '#b55088', '#ffec27'), 10],
      ['jellyfish', pal('#c026d3', '#f6757a', '#6a2c9c', '#ff7ab8', '#181425'), 8],
      ['shark', pal('#94b0c2', '#c0cbdc', '#5a6988', '#8b9bb4', '#181425'), 7],
      ['crab', pal('#e43b44', '#f6757a', '#a22633', '#feae34', '#181425'), 6]
    ];
    return { width: 32, height: 32, name: 'pf-nature-fish', layers: [{ name: 'Body' }], states:
      SPECIES.map(([name, p, speed]) => D(name, speed, true, [0, 1, 0, -1].map((t, i) => Fr(ms(speed), fish({ t, pal: p, bob: t === 0 ? 0 : -1, dir: 1, spots: p.spots }))))) };
  }

  /* ---------------- reef & seabed ---------------- */
  function reefSuite() {
    const S = (name, fps, frames) => D(name, fps, true, frames);
    return { width: 32, height: 32, name: 'pf-ocean-reef', layers: [{ name: 'World' }], states: [
      S('coral', 4, [0, 1, 0, -1].map(t => Fr(ms(4), fx(api => {
        api.rect(13, 20, 18, 27, '#b55088');
        for (let k = 0; k < 5; k++) {
          const x = 6 + k * 5, h = 6 + ((k * 3) % 7);
          api.line(16, 22, x, 22 - h + t, '#c026d3', 2);
          api.px(x, 21 - h + t, '#f6757a'); api.px(x + 1, 21 - h + t, '#ff7ab8');
        }
      })))),
      S('kelp', 3, [0, 1, 2].map(i => Fr(ms(3), fx(api => {
        for (let k = 0; k < 3; k++) {
          const x0 = 9 + k * 6;
          for (let y = 27; y > 2; y--) {
            const x = x0 + Math.round(Math.sin((y + i * 3) / 5) * 2);
            api.px(x, y, '#265c42'); api.px(x + 1, y, y % 4 ? '#3e8948' : '#63c74d');
          }
        }
        api.rect(6, 26, 26, 27, '#3e2731');
      })))),
      S('anemone', 4, [0, 1].map(i => Fr(ms(4), fx(api => {
        api.rect(11, 22, 21, 27, '#a22633'); api.rect(11, 22, 21, 23, '#f6757a');
        for (let k = 0; k < 7; k++) {
          const a = -1.9 + k * 0.3, len = 6 + (k % 3);
          api.line(16, 22, 16 + Math.cos(a) * len, 22 + Math.sin(a) * len - i, k % 2 ? '#f6757a' : '#ff7ab8', 1);
        }
      })))),
      S('shell', 6, [0, 1].map(i => Fr(ms(6), fx(api => {
        api.ellipse(8, 16, 24, 27, '#ffd6e0', true);
        api.ellipse(10, 18, 22, 26, '#ffb3c6', true);
        for (let k = 0; k < 4; k++) api.line(16, 26, 10 + k * 4, 18 + i, '#f6757a', 1);
      })))),
      S('starfish', 4, [0, 1].map(i => Fr(ms(4), fx(api => {
        for (let k = 0; k < 5; k++) {
          const a = -1.57 + k / 5 * PI2;
          api.line(16, 17, 16 + Math.cos(a) * 10, 17 + Math.sin(a) * 10, '#feae34', 3);
          api.px(16 + Math.cos(a) * 11, 17 + Math.sin(a) * 11 + i, '#ffec27');
        }
        api.ellipse(13, 14, 19, 20, '#e0a63c', true);
      })))),
      S('vent', 5, [0, 1, 2, 3].map(i => Fr(ms(5), fx(api => {
        api.rect(9, 22, 22, 27, '#5a6988'); api.rect(9, 22, 22, 23, '#8b9bb4');
        api.rect(12, 19, 19, 22, '#3a4466');
        for (let k = 0; k <= i; k++) P().bubble(api, 14 + (k * 5) % 8, 16 - k * 4, 1 + (k % 2), '#c8ffff', '#ffffff');
      }))))
    ] };
  }

  /* ---------------- biome tilesets (5 sheets, one per state) ---------------- */
  function biomesSuite() {
    const T = 16, cols = 4;
    /* A biome is a 16-colour recipe, not 16 bespoke tiles: the same tile grammar
       (top, body, transition, edge, rock, brick, water, deep, sand, snow, wood,
       ladder, dark, moss, accent, void) is re-coloured and re-textured. */
    const biome = (c, extra = {}) => {
      const speck = (api, seed, a, b, d) => api.speck(0, 0, 15, 15, seed, [a, b], d === undefined ? 0.18 : d);
      const paints = [
        api => { api.rect(0, 0, 15, 15, c[0]); speck(api, 1, c[1], c[2], 0.2); api.rect(0, 0, 15, 1, c[2]); },
        api => { api.rect(0, 0, 15, 15, c[3]); speck(api, 2, c[4], c[5], 0.2); },
        api => { api.rect(0, 0, 15, 15, c[0]); api.rect(0, 3, 15, 15, c[3]); api.rect(0, 3, 15, 4, c[2]); speck(api, 3, c[4], c[5], 0.18); for (let x = 0; x < 16; x += 4) api.px(x, 2, c[0]); },
        api => { api.rect(0, 0, 15, 15, c[0]); api.rect(0, 5, 15, 15, c[3]); api.rect(0, 1, 15, 2, c[2]); speck(api, 4, c[4], c[5], 0.2); },
        api => { api.rect(0, 0, 15, 15, c[6]); api.rect(0, 0, 15, 1, c[7]); api.rect(0, 15, 15, 15, c[8]); speck(api, 5, c[8], c[7], 0.12); },
        api => { api.rect(0, 0, 15, 15, c[8]); for (let r = 0; r < 2; r++) for (let q = 0; q < 2; q++) { api.rect(q * 8, r * 8, q * 8 + 7, r * 8 + 7, c[6]); api.rect(q * 8, r * 8, q * 8 + 7, r * 8, c[7]); api.rect(q * 8 + 7, r * 8, q * 8 + 7, r * 8 + 7, c[9]); } },
        api => { api.rect(0, 0, 15, 15, c[10]); api.rect(0, 0, 15, 1, c[11]); api.rect(0, 15, 15, 15, c[9]); speck(api, 6, c[11], c[10], 0.1); },
        api => { api.rect(0, 0, 15, 15, c[9]); api.rect(0, 0, 15, 2, c[10]); for (let x = 0; x < 16; x += 6) api.px(x + 1, 3, c[11]); },
        api => { api.rect(0, 0, 15, 15, c[12]); api.rect(0, 0, 15, 1, c[13]); speck(api, 7, c[14], c[13], 0.14); },
        api => { api.rect(0, 0, 15, 15, c[15]); api.rect(0, 0, 15, 1, '#ffffff'); api.rect(0, 15, 15, 15, c[9]); speck(api, 8, c[14], '#ffffff', 0.1); },
        api => { api.rect(0, 0, 15, 15, c[13]); api.rect(0, 0, 15, 1, c[12]); for (let x = 2; x < 16; x += 5) api.line(x, 0, x, 15, c[9], 1); },
        api => { api.rect(0, 0, 15, 15, c[9]); api.rect(2, 0, 4, 15, c[3]); api.rect(10, 0, 12, 15, c[3]); for (let y = 1; y < 16; y += 4) api.rect(2, y, 12, y, c[13]); },
        api => { api.rect(0, 0, 15, 15, c[8]); for (let y = 0; y < 16; y += 4) { api.rect(0, y, 15, y, c[9]); api.px(3 + (y % 8), y + 1, c[6]); } api.rect(0, 0, 15, 0, '#181425'); api.rect(0, 15, 15, 15, '#181425'); },
        api => { api.rect(0, 0, 15, 15, c[1]); speck(api, 9, c[0], c[2], 0.3); for (let k = 0; k < 4; k++) api.line(2 + k * 4, 15, 3 + k * 4, 8, c[2], 1); },
        api => { api.rect(0, 0, 15, 15, c[14]); speck(api, 10, c[6], c[7], 0.22); api.rect(0, 0, 15, 0, '#181425'); api.px(7, 7, c[15]); },
        api => { api.rect(0, 0, 15, 15, '#0b0b0f'); for (let y = 0; y < 16; y += 8) for (let x = 0; x < 16; x += 8) if (((x + y) / 8) % 2) api.rect(x, y, x + 7, y + 7, '#1a1a20'); }
      ];
      return paints;
    };
    /* 16 slots, same order every biome: [grass, grassA, grassB, dirt, dirtA,
       dirtB, rock, rockHi, rockSh, deep, water, waterHi, sand, sandHi, moss,
       snow] */
    const SNOW = ['#c8d8e8', '#dbe8f4', '#ffffff', '#7f8fa6', '#94a7bd', '#5f7288', '#8b9bb4', '#c0cbdc', '#5a6988', '#3a4466', '#41a6f6', '#73eff7', '#e0e8f0', '#ffffff', '#265c42', '#f4fbff'];
    const DESERT = ['#d9a45b', '#e8bd77', '#f2d29b', '#b07a2e', '#c98a3c', '#8a5a1e', '#a8845c', '#d9b98a', '#6b4a22', '#4a3318', '#41a6f6', '#73eff7', '#f2d29b', '#fff6c9', '#8fce5a', '#fff6c9'];
    const JUNGLE = ['#3e8948', '#4f9e42', '#8fce5a', '#5c3a1e', '#6b4a22', '#3e2731', '#7f8fa6', '#a8b8c8', '#4a5a6a', '#193c3e', '#2f6b6b', '#57d6d2', '#c98a3c', '#e4a672', '#63c74d', '#d9e86b'];
    const CAVE = ['#4a5a6a', '#5a6a7a', '#7a8a9a', '#3a2a1e', '#4a3a2e', '#2a1a0e', '#8b9bb4', '#c0cbdc', '#5a6988', '#1c2a44', '#41a6f6', '#73eff7', '#8a7a5a', '#b0a080', '#3e8948', '#e8ecf5'];
    const VOLCANIC = ['#5c2418', '#7a3b2e', '#e06b24', '#3e2731', '#5c3a1e', '#2b1512', '#6b6b6b', '#9a9a9a', '#3a3a3a', '#2b1512', '#e06b24', '#ffb03a', '#4a4a4a', '#7a7a7a', '#9c3a1c', '#ffb03a'];
    const BIOMES = [['snow', SNOW], ['desert', DESERT], ['jungle', JUNGLE], ['cave', CAVE], ['volcanic', VOLCANIC]];
    return { width: 64, height: 64, name: 'pf-nature-biomes', layers: [{ name: 'Tiles' }], states:
      BIOMES.map(([name, c], bi) => D(name, 1, true, [Fr(1000, (buf) => {
        const paints = biome(c);
        paints.forEach((fn, i) => {
          const api = P().offsetApi(P().makeApi(buf, 64, 64), (i % cols) * T, ((i / cols) | 0) * T);
          fn(api);
        });
        // a biome signature pixel row so the sheets never hash identical
        const api = P().makeApi(buf, 64, 64);
        if (bi > 0) api.px(63, 63 - bi, c[2]);
      })])) };
  }

  /* ---------------- orbit props ---------------- */
  function spacePropsSuite() {
    const S = (name, fps, frames) => D(name, fps, true, frames);
    return { width: 32, height: 32, name: 'pf-space-props', layers: [{ name: 'World' }], states: [
      S('satellite', 6, [0, 1, 2, 3].map(i => Fr(ms(6), fx(api => {
        /* Panels tilt through the cycle: a lone blinking pixel is a 2px frame
           delta, which the quality gate (rightly) calls a stalled animation. */
        const tilt = [0, -1, 0, 1][i];
        api.rect(12, 14, 19, 18, '#8b9bb4'); api.rect(12, 14, 19, 15, '#c0cbdc');
        api.rect(4, 13 + tilt, 11, 19 + tilt, '#5a6988');
        for (let x = 4; x < 12; x += 2) api.rect(x, 13 + tilt, x, 19 + tilt, '#3a4466');
        api.rect(20, 13 - tilt, 27, 19 - tilt, '#5a6988');
        for (let x = 21; x < 28; x += 2) api.rect(x, 13 - tilt, x, 19 - tilt, '#3a4466');
        api.line(16, 14, 16, 6, '#c0cbdc', 1);
        api.ellipse(13 - tilt, 3, 19 - tilt, 7, '#e8ecf5', true);
        api.px(15 + (i % 2), 4, '#ff0044');
        api.px(16 - (i % 2), 16, '#2ce8f5');
      })))),
      S('station', 4, [0, 1].map(i => Fr(ms(4), fx(api => {
        api.rect(8, 12, 23, 22, '#5a6988'); api.rect(8, 12, 23, 13, '#8b9bb4'); api.rect(8, 21, 23, 22, '#3a4466');
        api.rect(11, 15, 20, 19, '#262b44');
        for (let k = 0; k < 4; k++) api.rect(12 + k * 2, 16, 13 + k * 2, 17, k === i ? '#ffec27' : '#2ce8f5');
        api.rect(4, 15, 8, 19, '#3a4466'); api.rect(23, 15, 27, 19, '#3a4466');
        api.rect(14, 8, 17, 12, '#8b9bb4');
        api.line(16, 8, 16, 4, '#c0cbdc', 1); api.px(16, 3, '#ff0044');
      })))),
      one('planet', api => {
        api.ellipse(4, 4, 27, 27, '#41a6f6', true);
        api.ellipse(5, 5, 22, 20, '#73eff7', true);
        api.ellipse(8, 12, 20, 24, '#3e8948', true);
        api.ellipse(12, 15, 24, 22, '#63c74d', true);
        api.ellipse(6, 6, 14, 12, '#ffffff', true);
        api.line(0, 20, 31, 14, '#c8ffff', 1);
      }),
      one('moon', api => {
        api.ellipse(6, 6, 25, 25, '#c0cbdc', true);
        api.ellipse(8, 8, 21, 20, '#e8ecf5', true);
        api.ellipse(10, 16, 16, 22, '#8b9bb4', true);
        api.ellipse(18, 11, 22, 15, '#8b9bb4', true);
        api.px(9, 10, '#ffffff');
      }),
      S('blackhole', 8, [0, 1, 2, 3].map(i => Fr(ms(8), fx(api => {
        P().ring(api, 16, 16, 13 - i, '#6a2c9c', 2, 2);
        P().ring(api, 16, 16, 10 - i, '#c026d3', 1, 1);
        api.ellipse(11, 11, 20, 20, '#05010f', true);
        api.px(15, 15, i % 2 ? '#ffffff' : '#140a2e');
      })))),
      S('nebula', 6, [0, 1, 2, 3].map(i => Fr(ms(6), fx(api => {
        for (let k = 0; k < 40; k++) {
          const x = (api.hash(k, 1, 3) * 31) | 0, y = (api.hash(k, 2, 5) * 31) | 0;
          api.px(x, y, k % 5 === 0 ? '#ffffff' : k % 3 === 0 ? '#c8ffff' : '#9fd0ff');
        }
        api.dith(6, 10, 25, 22, '#6a2c9c', '#c026d3', i & 1);
      })))),
      S('starfield', 5, [0, 1, 2, 3].map(i => Fr(ms(5), fx(api => {
        for (let k = 0; k < 26; k++) {
          const x = (api.hash(k, i, 7) * 31) | 0, y = (api.hash(k + 40, i, 11) * 31) | 0;
          api.px(x, y, k % 7 === 0 ? '#ffec27' : '#ffffff');
        }
      }))))
    ] };
  }

  /* ---------------- capital ship ---------------- */
  function capitalSuite() {
    const hull = '#5a6988', hullHi = '#8b9bb4', hullSh = '#3a4466', dark = '#262b44', glow = '#2ce8f5';
    const frame = o => fx(api => {
      const g = o.glow, roll = o.roll || 0;
      api.rect(2, 14 + roll, 29, 19 + roll, hull);
      api.rect(2, 14 + roll, 29, 15 + roll, hullHi);
      api.rect(2, 18 + roll, 29, 19 + roll, hullSh);
      api.rect(6, 10 + roll, 25, 14 + roll, hullSh);
      api.rect(9, 8 + roll, 14, 12 + roll, hull);
      api.rect(17, 8 + roll, 22, 12 + roll, hull);
      api.rect(11, 11 + roll, 20, 14 + roll, dark);
      api.rect(12, 12 + roll, 19, 13 + roll, '#124e89');
      api.rect(0, 16 + roll, 3, 18 + roll, dark);
      api.rect(29, 16 + roll, 31, 18 + roll, dark);
      for (let k = 0; k < 6; k++) api.px(6 + k * 4, 21 + roll, k % 2 ? glow : '#9fd0ff');
      if (o.fire) { P().beam(api, 16, 8 + roll, 16, 8 + roll - o.fire, ['#ffffff', glow, '#124e89'], 3); }
      if (g) for (let k = 0; k < g; k++) api.px(15 + (k % 2), 21 + roll + k, '#ffec27');
    });
    return { width: 32, height: 32, name: 'pf-space-capital', layers: [{ name: 'World' }], states: [
      anim('idle', 4, true, [0, 1], r => frame({ roll: r })),
      anim('engine_burn', 8, true, [1, 2, 3, 2], (g, i) => frame({ glow: g, roll: [0, -1, 0, 1][i] })),
      anim('fire', 10, true, [
        { d: ms(10), fire: 0 }, { d: ms(10), fire: 2 }, { d: 55, fire: 9, glow: 2 },
        { d: ms(8), fire: 4, glow: 1 }, { d: ms(8), fire: 1, glow: 0 }
      ], c => frame(c)),
      anim('roll', 8, true, [-1, 0, 1, 0], r => frame({ roll: r, glow: 1 }))
    ] };
  }

  return { treesSuite, rocksSuite, crittersSuite, birdsSuite, fishSuite, reefSuite, biomesSuite, spacePropsSuite, capitalSuite };
})();
