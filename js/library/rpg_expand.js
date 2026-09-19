/* PixelForge Studio — RPG Expansion pack: paladin, druid, lich, ogre (full
   humanoid suites on the shared rig), campsite props, trinkets, battle-magic 3.
   32x32, pure maths. Perf: cached outline color, Bayer dissolves via R.fadeOut,
   no per-frame allocations beyond the single outline pass. */
window.PF = window.PF || {};
PF.RPG = PF.RPG || {};
PF.RPG.expand = (() => {
  const P = () => PF.Pixel;
  const D = (name, fps, loop, frames) => ({ name, fps, loop, frames });
  const Fr = (duration, paint) => ({ duration, paint });
  const ms = fps => Math.round(1000 / fps);
  const R = PF.RPG;
  const apiFor = (buf, W, H) => P().makeApi(buf, W, H);
  const OUT32 = PF.Color.hexToU32('#181425'); // cached: one lookup, not one per frame
  const finish = (buf, W, H) => buf.set(PF.Raster.outline(buf, W, H, OUT32));
  const item = painter => (buf, W, H) => { const api = apiFor(buf, W, H); painter(api); finish(buf, W, H); };
  const prop = painter => (buf, W, H) => { painter(apiFor(buf, W, H)); finish(buf, W, H); };
  const S1 = (name, painter, fps = 6) => D(name, fps, true, [Fr(ms(fps), painter)]);

  /* ================= palettes (also merged into R.PAL for game use) ================= */
  const OUTLINE = '#181425';
  const PALADIN = { skin: '#f2c094', skinSh: '#c28569', hair: '#fee761', hairSh: '#feae34', hairHi: '#fff6c9',
    shirt: '#e8ecf5', shirtSh: '#8b9bb4', shirtHi: '#ffffff', pants: '#3a4466', pantsSh: '#262b44',
    boots: '#5a6988', belt: '#fee761', buckle: '#ffffff', outline: OUTLINE, lip: '#a26a5a' };
  /* Hood, tunic, sleeves and cape were four shades of the same green inside 25
     luma of one another, so the druid rendered as a green mass with a strip of
     face in it. The tunic is now the brightest green and the ONLY green: the
     hood goes deep forest (a full step below it) and the mantle goes bark. */
  const DRUID = { skin: '#e8b796', skinSh: '#a26a5a', hair: '#3e8948', hairSh: '#265c42', hairHi: '#63c74d',
    shirt: '#3e8948', shirtSh: '#265c42', shirtHi: '#63c74d', pants: '#3e2731', pantsSh: '#262b44',
    boots: '#262b44', belt: '#ead4aa', buckle: '#c9f27e', outline: OUTLINE, lip: '#a26a5a' };
  const LICH = { skin: '#c0cbdc', skinSh: '#8b9bb4', hair: '#3e2347', hairSh: '#262b44', hairHi: '#68386c',
    shirt: '#3e2347', shirtSh: '#262b44', shirtHi: '#68386c', pants: '#262b44', pantsSh: '#181425',
    boots: '#181425', belt: '#181425', buckle: '#b55088', outline: OUTLINE, lip: '#5c1a1a' };
  const OGRE = { skin: '#63c74d', skinSh: '#3e8948', hair: '#181425', hairSh: '#181425', hairHi: '#3a4466',
    shirt: '#733e39', shirtSh: '#3e2731', shirtHi: '#b86f50', pants: '#3a4466', pantsSh: '#262b44',
    boots: '#262b44', belt: '#262b44', buckle: '#c0cbdc', outline: OUTLINE, lip: '#265c42' };
  Object.assign(R.PAL, { PALADIN, DRUID, LICH, OGRE });

  /* ================= heroes & villains (shared rig = full 8-10 state suites) ================= */
  function paladinSuite() {
    return R.humanoidSuite(PALADIN, 'rpg-paladin', {
      weapon: 'sword', shield: true, cast: true, castColors: ['#fee761', '#ffffff', '#fff6c9'],
      head: { circlet: '#fee761', gem: '#2ce8f5' },
      garb: { cape: '#fee761', capeSh: '#feae34' } // cloth-of-gold: distinct from the white plate
    });
  }
  function druidSuite() {
    return R.humanoidSuite(DRUID, 'rpg-druid', {
      weapon: 'staff', cast: true, castColors: ['#63c74d', '#c9f27e', '#2ce8f5'],
      head: { hood: '#17453a', hoodSh: '#0f2b26' },
      garb: { cape: '#7a4a2e', capeSh: '#4a2c1e' }   // bark mantle: not more green
    });
  }
  function lichSuite() {
    return R.humanoidSuite(LICH, 'rpg-lich', {
      weapon: 'staff', cast: true, castColors: ['#b55088', '#68386c', '#2ce8f5'], sneak: true,
      head: { skull: true, hood: '#3e2347', hoodSh: '#181425' }
    });
  }
  function ogreSuite() {
    return R.humanoidSuite(OGRE, 'rpg-ogre', {
      weapon: 'axe',
      head: { horns: '#ead4aa', hornsSh: '#c28569', pads: '#5a6988', padsSh: '#3a4466' }
    });
  }

  /* ================= CAMPSITE ================= */
  function campsiteSuite() {
    const tent = i => prop((api) => {
      const flap = i % 2 ? 1 : -1; // door flap swings
      api.line(16, 6, 5, 26, '#e4a672', 4); api.line(16, 6, 27, 26, '#c28569', 4);
      api.line(16, 6, 5, 26, '#fff6c9', 1);
      api.line(16, 7, 16, 26, '#733e39', 1); // center seam
      api.line(16, 14, 11 + flap, 26, '#3e2731', 3); // opening
      api.line(16, 14, 11 + flap, 26, '#181425', 1);
      api.line(16, 14, 21 + flap, 26, '#733e39', 2); // tied flap
      api.line(5, 26, 1, 28, '#b86f50', 1); api.line(27, 26, 31, 28, '#b86f50', 1); // guy ropes
      api.px(1, 28, '#8b9bb4'); api.px(31, 28, '#8b9bb4'); // pegs
      api.px(16, 5, '#fee761'); // peak flag pin
      api.px(8, 27, '#3e8948'); api.px(24, 27, '#3e8948');
    });
    const banner = i => prop((api) => {
      const wv = i % 2 ? 1 : 0; // cloth wave
      api.rect(15, 3, 17, 28, '#5a6988'); api.rect(15, 3, 15, 28, '#8b9bb4');
      api.rect(15, 3, 26, 5, '#5a6988');
      api.px(16, 1, '#fee761'); api.rect(14, 2, 18, 3, '#fee761'); // finial
      api.rect(17, 5, 26, 20 + wv, '#a22633'); api.rect(17, 5, 18, 20 + wv, '#e43b44');
      for (let y = 6; y < 20; y += 2) api.px(25, y + wv, '#5c1a1a'); // hem ripple
      api.ellipse(20, 9, 24, 14, '#fee761', true); // sun emblem
      api.ellipse(21, 10, 23, 13, '#a22633', true);
      api.line(17, 20 + wv, 26, 20 + wv, '#5c1a1a', 1);
    });
    const anvil = prop((api) => {
      api.rect(9, 22, 23, 28, '#733e39'); api.rect(9, 22, 10, 28, '#b86f50'); // stump
      api.ellipse(9, 21, 23, 23, '#b86f50', true);
      api.rect(8, 15, 22, 21, '#5a6988'); api.rect(8, 15, 22, 16, '#8b9bb4'); // anvil face
      api.rect(22, 16, 27, 19, '#5a6988'); api.px(27, 17, '#c0cbdc'); // horn
      api.rect(13, 21, 17, 22, '#3a4466'); // waist
      api.px(12, 15, '#ffffff'); api.px(16, 15, '#c0cbdc');
      api.line(25, 22, 29, 12, '#b86f50', 2); api.rect(24, 9, 29, 12, '#8b9bb4'); // leaning hammer
    });
    const bedroll = prop((api) => {
      api.ellipse(5, 22, 27, 28, '#3e2731', true); // ground mat
      api.ellipse(6, 23, 26, 27, '#5a6988', true);
      api.rect(6, 20, 20, 25, '#265c42'); api.rect(6, 20, 20, 21, '#3e8948'); // blanket roll
      api.rect(6, 22, 20, 23, '#193c3e'); api.rect(6, 24, 20, 25, '#193c3e');
      api.rect(21, 21, 27, 25, '#ead4aa'); api.rect(21, 21, 27, 22, '#fff6c9'); // pillow
      api.px(8, 19, '#c9f27e'); api.px(12, 19, '#c9f27e');
    });
    const cookpot = i => prop((api) => {
      const fl = i % 2; // flame flicker
      api.ellipse(11, 20, 21, 24, '#5c1a1a', true); // fire bed
      api.ellipse(12 + fl, 18, 18 + fl, 22, '#f77622', true);
      api.ellipse(13, 19 - fl, 17, 21, '#fee761', true);
      api.px(15, 18 - fl, '#ffffff');
      api.line(9, 24, 13, 8, '#733e39', 2); api.line(23, 24, 19, 8, '#733e39', 2); // tripod
      api.line(13, 8, 19, 8, '#3e2731', 2);
      api.ellipse(11, 9, 21, 15, '#3a4466', true); // pot
      api.ellipse(12, 10, 20, 13, '#124e89', true); // stew surface
      api.ellipse(13, 10, 19, 12, '#2a5fa0', true);
      const bph = (i + 1) % 4; // bubbles rise in 4 phases
      api.px(14, 11 - (bph > 1 ? 1 : 0), '#2ce8f5'); api.px(18, 10 - (bph % 3 === 0 ? 1 : 0), '#2ce8f5');
      api.px(16, 7 - Math.floor(bph / 2), '#8b9bb4'); // steam
    });
    const crate = prop((api) => {
      api.rect(8, 14, 24, 27, '#b86f50'); api.rect(8, 14, 10, 27, '#e4a672'); api.rect(22, 14, 24, 27, '#733e39');
      api.line(8, 14, 24, 27, '#733e39', 1); api.line(24, 14, 8, 27, '#733e39', 1); // cross brace
      api.rect(8, 19, 24, 21, '#8b9bb4'); api.rect(15, 14, 17, 27, '#8b9bb4'); // iron bands
      api.px(16, 20, '#c0cbdc');
      api.px(12, 16, '#fee761'); // stencil star
      api.px(11, 17, '#fee761'); api.px(13, 17, '#fee761'); api.px(12, 18, '#fee761');
    });
    return { width: 32, height: 32, name: 'rpg-campsite', layers: [{ name: 'Props' }], states: [
      D('tent', 5, true, [Fr(ms(5), tent(0)), Fr(ms(5), tent(1))]),
      D('war_banner', 6, true, [Fr(ms(6), banner(0)), Fr(ms(6), banner(1))]),
      S1('anvil', anvil), S1('bedroll', bedroll),
      D('cookpot', 8, true, [0, 1, 2, 3].map(i => Fr(ms(8), cookpot(i)))),
      S1('supply_crate', crate)
    ] };
  }

  /* ================= TRINKETS ================= */
  function trinketsSuite() {
    const ring = item(api => {
      api.ellipse(10, 12, 22, 24, '#feae34', true);
      api.ellipse(12, 14, 20, 22, '#181425', true);
      api.ellipse(12, 14, 20, 22, '#3a4466', false);
      api.ellipse(13, 15, 19, 21, '#262b44', true);
      api.px(16, 8, '#e43b44'); api.rect(14, 9, 18, 12, '#e43b44'); api.px(15, 9, '#ffffff'); api.px(16, 10, '#f6757a');
      api.px(11, 13, '#fff6c9'); api.px(21, 23, '#feae34');
    });
    const amulet = item(api => {
      api.line(10, 6, 16, 12, '#c0cbdc', 1); api.line(22, 6, 16, 12, '#c0cbdc', 1); // chain
      api.rect(12, 12, 20, 24, '#fee761'); api.rect(12, 12, 13, 24, '#fff6c9'); api.rect(19, 12, 20, 24, '#feae34');
      api.ellipse(14, 15, 18, 21, '#2ce8f5', true); api.px(15, 16, '#ffffff'); api.px(16, 19, '#124e89');
      api.px(16, 11, '#ff0044');
    });
    const orb = item(api => {
      api.rect(11, 22, 21, 26, '#5a6988'); api.rect(13, 20, 19, 22, '#8b9bb4'); // stand
      api.ellipse(9, 8, 23, 21, '#68386c', true);
      api.ellipse(10, 9, 22, 20, '#b55088', true);
      api.ellipse(11, 10, 18, 17, '#2ce8f5', true); api.px(13, 11, '#ffffff');
      api.line(18, 14, 21, 18, '#e8ecf5', 1); // swirl
      api.px(8, 8, '#ffffff'); api.px(24, 12, '#b55088');
    });
    const horn = item(api => {
      api.line(8, 22, 22, 10, '#ead4aa', 3);
      api.line(8, 22, 22, 10, '#fff6c9', 1);
      api.line(22, 10, 26, 12, '#c28569', 3); // bell
      api.ellipse(24, 10, 28, 15, '#733e39', true); api.ellipse(25, 11, 27, 14, '#181425', true);
      api.rect(12, 17, 14, 21, '#fee761'); api.rect(17, 14, 19, 18, '#fee761'); // bands
      api.px(8, 22, '#c28569');
    });
    const lantern = item(api => {
      api.rect(12, 4, 20, 7, '#3a4466'); api.px(16, 2, '#8b9bb4'); api.line(14, 2, 18, 2, '#8b9bb4', 1);
      api.rect(11, 7, 21, 24, '#3a4466');
      api.rect(12, 8, 20, 23, '#fee761'); api.rect(12, 8, 20, 11, '#fff6c9');
      api.px(16, 15, '#ffffff'); api.px(14, 18, '#feae34');
      api.rect(10, 24, 22, 26, '#262b44');
      api.px(9, 15, '#fee761'); api.px(23, 15, '#fee761');
    });
    const drum = item(api => {
      api.line(8, 8, 12, 16, '#b86f50', 2); api.line(24, 8, 20, 16, '#b86f50', 2); // sticks
      api.px(8, 7, '#ffffff'); api.px(24, 7, '#ffffff');
      api.ellipse(8, 14, 24, 19, '#ead4aa', true); // top skin
      api.ellipse(10, 15, 22, 18, '#fff6c9', true);
      api.rect(9, 18, 23, 25, '#a22633'); api.rect(9, 18, 11, 25, '#e43b44');
      api.line(9, 21, 23, 21, '#fee761', 1); // rope zigzag
      api.px(13, 20, '#fee761'); api.px(19, 22, '#fee761');
      api.ellipse(9, 24, 23, 26, '#5c1a1a', true);
    });
    const flute = item(api => {
      api.line(8, 24, 24, 8, '#3e8948', 3);
      api.line(8, 24, 24, 8, '#63c74d', 1);
      api.px(12, 20, '#181425'); api.px(15, 17, '#181425'); api.px(18, 14, '#181425'); api.px(21, 11, '#181425');
      api.rect(6, 22, 9, 26, '#fee761'); // mouthpiece band
      api.line(24, 8, 27, 5, '#c9f27e', 2); // tassel cord
      api.px(27, 4, '#e43b44'); api.px(28, 5, '#e43b44');
    });
    const mask = item(api => {
      api.rect(10, 8, 22, 24, '#b86f50'); api.rect(10, 8, 12, 24, '#e4a672'); api.rect(20, 8, 22, 24, '#733e39');
      api.rect(12, 11, 15, 14, '#181425'); api.rect(17, 11, 20, 14, '#181425'); // eyes
      api.px(13, 11, '#2ce8f5'); api.px(18, 11, '#2ce8f5');
      api.line(13, 19, 19, 19, '#181425', 1); api.px(14, 20, '#ffffff'); api.px(18, 20, '#ffffff'); // fangs
      api.line(16, 8, 16, 3, '#63c74d', 2); api.px(16, 2, '#c9f27e'); // top feather
      api.line(10, 9, 6, 5, '#3e8948', 2); api.line(22, 9, 26, 5, '#3e8948', 2);
      api.rect(12, 21, 20, 23, '#e43b44'); // paint band
    });
    return { width: 32, height: 32, name: 'rpg-trinkets', layers: [{ name: 'Trinkets' }], states: [
      S1('gold_ring', ring), S1('amulet', amulet), S1('mana_orb', orb), S1('war_horn', horn),
      S1('lantern', lantern), S1('drum', drum), S1('flute', flute), S1('spirit_mask', mask)
    ] };
  }

  /* ================= BATTLE MAGIC 3 ================= */
  function magic3Suite() {
    const smite = i => (buf, W, H) => {
      const api = apiFor(buf, W, H);
      if (i === 0) { // targeting rune + gathering sparks
        api.ellipse(8, 22, 24, 28, '#fee761', false);
        api.ellipse(12, 24, 20, 27, '#feae34', false);
        P().particles(api, 16, 20, 8, i / 4, ['#fee761', '#ffffff']);
      } else if (i === 1) { // beam descends
        api.rect(13, 0, 19, 26, '#fff6c9'); api.rect(15, 0, 17, 26, '#ffffff');
        api.ellipse(8, 22, 24, 28, '#fee761', true);
        P().sparks(api, 16, 24, 1, '#fee761', 8, 2, 6);
      } else if (i === 2) { // impact burst + ring
        api.ellipse(10, 16, 22, 28, '#ffffff', true);
        api.ellipse(12, 18, 20, 27, '#fee761', true);
        api.ellipse(4, 22, 28, 29, '#fee761', false);
        P().sparks(api, 16, 22, 2, '#feae34', 10, 3, 9);
      } else { // rising embers
        api.ellipse(10, 24, 22, 28, '#feae34', false);
        for (let k = 0; k < 5; k++) api.px(11 + k * 3, 20 - k * 2, k % 2 ? '#fee761' : '#f77622');
        api.px(16, 8, '#fee761');
      }
      finish(buf, W, H);
    };
    const shadowOrb = i => (buf, W, H) => {
      const api = apiFor(buf, W, H);
      const x = 6 + i * 6;
      for (let k = 3; k >= 1; k--) // trail
        api.ellipse(x - k * 4 - 2, 13, x - k * 4 + 2, 18, k === 3 ? '#262b44' : '#3e2347', true);
      if (i < 3) {
        api.ellipse(x - 3, 11, x + 3, 19, '#3e2347', true);
        api.ellipse(x - 2, 12, x + 2, 18, '#b55088', true);
        api.px(x - 1, 13, '#ffffff'); api.px(x, 16, '#2ce8f5');
      } else { // implode
        api.ellipse(22, 10, 30, 20, '#ffffff', true);
        api.ellipse(23, 11, 29, 19, '#b55088', true);
        P().sparks(api, 26, 15, 3, '#68386c', 8, 2, 7);
      }
      finish(buf, W, H);
    };
    const storm = i => (buf, W, H) => {
      const api = apiFor(buf, W, H);
      const dark = i === 0 ? '#8b9bb4' : (i === 1 ? '#5a6988' : '#3a4466');
      api.ellipse(4, 2, 16, 10, dark, true); api.ellipse(14, 0, 28, 9, dark, true); api.ellipse(9, 4, 21, 12, dark, true);
      api.ellipse(6, 3, 14, 8, '#c0cbdc', true);
      if (i === 1) { api.px(15, 12, '#fee761'); api.px(17, 14, '#fee761'); }
      else if (i === 2) { // forked bolt
        api.line(15, 10, 12, 17, '#fee761', 2); api.line(12, 17, 16, 22, '#ffffff', 2);
        api.line(16, 22, 13, 28, '#fee761', 2); api.line(12, 17, 8, 20, '#fee761', 1);
        api.ellipse(9, 26, 19, 29, '#fee761', true);
        api.px(14, 11, '#ffffff');
      } else if (i === 3) {
        api.line(15, 12, 14, 20, '#8b9bb4', 1);
        api.px(10, 24, '#fee761'); api.px(20, 22, '#feae34'); api.px(15, 27, '#8b9bb4');
      } else { api.px(12, 26, '#5a6988'); }
      finish(buf, W, H);
    };
    const grasp = i => (buf, W, H) => {
      const api = apiFor(buf, W, H);
      api.line(6, 28, 26, 28, '#3e2731', 2); // cracked earth
      api.line(12, 28, 14, 26, '#181425', 1); api.line(19, 28, 18, 26, '#181425', 1);
      const h = [0, 8, 14, 10][i]; // rise -> grab -> recede
      if (h > 0) {
        api.line(11, 28, 9, 28 - h, '#265c42', 2); api.line(21, 28, 23, 28 - h, '#265c42', 2);
        api.line(9, 28 - h, 13, 28 - h - 2, '#3e8948', 2); api.line(23, 28 - h, 19, 28 - h - 2, '#3e8948', 2);
        api.line(16, 28, 16, 28 - h - 3, '#3e8948', 2);
        api.px(9, 28 - h, '#63c74d'); api.px(23, 28 - h, '#63c74d'); api.px(16, 28 - h - 3, '#c9f27e');
        if (i === 2) { // grab flash: thorns close in
          api.line(13, 28 - h, 19, 28 - h, '#c9f27e', 1);
          P().sparks(api, 16, 28 - h, 1, '#63c74d', 6, 2, 5);
        }
      } else { api.px(11, 27, '#3e8948'); api.px(21, 27, '#3e8948'); }
      finish(buf, W, H);
    };
    return { width: 32, height: 32, name: 'rpg-magic3', layers: [{ name: 'FX' }], states: [
      D('smite', 10, true, [0, 1, 2, 3].map(i => Fr(ms(10), smite(i)))),
      D('shadow_orb', 10, true, [0, 1, 2, 3].map(i => Fr(ms(10), shadowOrb(i)))),
      D('storm', 8, true, [0, 1, 2, 3].map(i => Fr(ms(8), storm(i)))),
      D('grasp', 8, true, [0, 1, 2, 3].map(i => Fr(ms(8), grasp(i))))
    ] };
  }

  return { paladinSuite, druidSuite, lichSuite, ogreSuite, campsiteSuite, trinketsSuite, magic3Suite };
})();
