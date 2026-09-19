/* PixelForge Studio — RPG Items & FX pack 2: armor rack, arsenal, loot,
   status icons, advanced battle magic, RPG UI chrome. */
window.PF = window.PF || {};
PF.RPG = PF.RPG || {};
PF.RPG.items = (() => {
  const P = () => PF.Pixel;
  const D = (name, fps, loop, frames) => ({ name, fps, loop, frames });
  const Fr = (duration, paint) => ({ duration, paint });
  const ms = fps => Math.round(1000 / fps);
  const R = PF.RPG;
  const apiFor = (buf, W, H) => P().makeApi(buf, W, H);
  const OUT = '#181425';
  const OUT32 = PF.Color.hexToU32(OUT); // cached: one lookup, not one per frame
  const finish = buf => buf.set(PF.Raster.outline(buf, 32, 32, OUT32));
  const S1 = (name, painter, fps = 6) => D(name, fps, true, [Fr(ms(fps), painter)]);
  const item = painter => (buf, W, H) => { const api = apiFor(buf, W, H); painter(api); finish(buf); };

  /* ================= ARMOR RACK ================= */
  function armorSuite() {
    const helm = item(api => {
      api.ellipse(9, 8, 23, 24, '#8b9bb4', true);
      api.ellipse(9, 8, 16, 24, '#c0cbdc', true);
      api.rect(20, 8, 23, 24, '#5a6988');
      api.rect(11, 14, 21, 16, '#181425'); // visor slit
      api.px(13, 15, '#ff0044'); api.px(19, 15, '#ff0044');
      api.rect(15, 16, 17, 24, '#5a6988'); // nose guard
      api.line(16, 6, 16, 2, '#a22633', 2); api.px(15, 1, '#e43b44'); api.px(17, 1, '#e43b44'); // plume
    });
    const hood = item(api => {
      api.rect(9, 8, 23, 24, '#265c42');
      api.rect(9, 8, 12, 24, '#3e8948'); api.rect(21, 8, 23, 24, '#193c3e');
      api.ellipse(12, 12, 20, 21, '#181425', true); // face shadow
      api.px(14, 16, '#fee761'); api.px(18, 16, '#fee761');
      api.line(16, 6, 16, 2, '#265c42', 3); api.px(16, 1, '#3e8948');
    });
    const wizhat = item(api => {
      api.ellipse(6, 20, 26, 25, '#124e89', true);
      api.ellipse(6, 20, 26, 22, '#2a5fa0', true);
      api.rect(12, 6, 20, 21, '#124e89'); api.rect(12, 6, 15, 21, '#2a5fa0');
      api.px(17, 4, '#124e89'); api.rect(12, 15, 20, 17, '#fee761');
      api.px(14, 11, '#ffffff'); api.px(18, 8, '#2ce8f5');
    });
    const crown = item(api => {
      api.rect(8, 14, 24, 24, '#fee761'); api.rect(8, 22, 24, 24, '#feae34');
      api.rect(8, 14, 10, 24, '#fff6c9');
      [9, 13, 16, 19, 23].forEach(x => api.line(x, 14, x, 9, '#fee761', 2));
      api.px(16, 16, '#ff0044'); api.px(12, 19, '#2ce8f5'); api.px(20, 19, '#2ce8f5');
      api.px(16, 8, '#ff0044');
    });
    const plate = item(api => {
      api.rect(10, 8, 22, 25, '#8b9bb4'); api.rect(10, 8, 13, 25, '#c0cbdc'); api.rect(20, 8, 22, 25, '#5a6988');
      api.rect(7, 8, 11, 12, '#c0cbdc'); api.rect(21, 8, 25, 12, '#c0cbdc'); // pauldrons
      api.line(16, 9, 16, 24, '#5a6988', 1);
      api.rect(10, 20, 22, 22, '#733e39'); api.px(16, 21, '#fee761');
      api.px(16, 12, '#e43b44'); // crest gem
    });
    const leather = item(api => {
      api.rect(10, 8, 22, 25, '#b86f50'); api.rect(10, 8, 12, 25, '#e4a672'); api.rect(20, 8, 22, 25, '#733e39');
      api.line(13, 8, 13, 25, '#733e39', 1); api.line(19, 8, 19, 25, '#733e39', 1);
      api.rect(10, 14, 22, 16, '#3e2731'); api.px(16, 15, '#c0cbdc');
      api.rect(10, 21, 22, 23, '#3e2731'); api.px(16, 22, '#c0cbdc');
    });
    const robe = item(api => {
      api.rect(12, 6, 20, 10, '#e8ecf5');
      api.line(12, 10, 8, 26, '#e8ecf5', 3); api.line(20, 10, 24, 26, '#e8ecf5', 3);
      api.rect(10, 22, 22, 26, '#e8ecf5');
      api.line(16, 10, 16, 26, '#124e89', 2); // gold? blue trim
      api.rect(11, 17, 21, 19, '#fee761');
      api.px(16, 8, '#ff0044');
    });
    const boots = item(api => {
      [[9, 0], [18, 0]].forEach(([x]) => {
        api.rect(x, 12, x + 5, 24, '#733e39'); api.rect(x, 12, x + 2, 24, '#b86f50');
        api.rect(x, 24, x + 5, 26, '#3e2731');
        api.rect(x, 16, x + 5, 18, '#3e2731'); api.px(x + 2, 17, '#fee761');
      });
    });
    const cape = item(api => {
      api.line(16, 5, 10, 26, '#a22633', 4); api.line(16, 5, 22, 26, '#a22633', 4);
      api.rect(9, 22, 23, 26, '#a22633');
      api.line(12, 8, 9, 24, '#e43b44', 1); api.line(20, 8, 23, 24, '#5c1a1a', 1);
      api.rect(13, 5, 19, 8, '#fee761'); api.px(16, 6, '#ff0044'); // clasp
    });
    const shield = item(api => {
      api.ellipse(8, 6, 24, 26, '#5a6988', true);
      api.ellipse(10, 8, 22, 24, '#124e89', true);
      api.ellipse(10, 8, 15, 24, '#2a5fa0', true);
      api.line(16, 8, 16, 24, '#e8ecf5', 2); api.line(10, 15, 22, 15, '#e8ecf5', 2);
      api.ellipse(14, 13, 18, 17, '#c0cbdc', true); api.px(16, 15, '#ffffff');
    });
    return { width: 32, height: 32, name: 'rpg-armor', layers: [{ name: 'Armor' }], states: [
      S1('knight_helm', helm), S1('hood', hood), S1('wizard_hat', wizhat), S1('crown', crown),
      S1('plate_armor', plate), S1('leather_armor', leather), S1('robe', robe),
      S1('boots', boots), S1('cape', cape), S1('round_shield', shield)
    ] };
  }

  /* ================= ARSENAL ================= */
  function arsenalSuite() {
    const greatsword = item(api => {
      api.rect(14, 2, 18, 20, '#c0cbdc'); api.line(16, 2, 16, 20, '#ffffff', 1);
      api.px(15, 3, '#ffffff'); api.px(16, 2, '#ffffff');
      api.rect(10, 20, 22, 22, '#fee761');
      api.rect(15, 22, 17, 28, '#733e39'); api.px(16, 28, '#fee761');
    });
    const katana = item(api => {
      api.line(6, 24, 24, 6, '#e8ecf5', 2); api.line(6, 24, 24, 6, '#ffffff', 1);
      api.line(12, 20, 14, 18, '#3e2731', 3);
      api.line(12, 20, 8, 24, '#262b44', 2);
    });
    const dagger = item(api => {
      api.rect(14, 8, 18, 20, '#c0cbdc'); api.px(16, 8, '#ffffff'); api.line(16, 9, 16, 20, '#ffffff', 1);
      api.rect(11, 20, 21, 22, '#8b9bb4');
      api.rect(15, 22, 17, 27, '#3e2731'); api.px(16, 27, '#8b9bb4');
    });
    const spear = item(api => {
      api.line(8, 28, 22, 6, '#b86f50', 2);
      api.line(22, 6, 26, 2, '#c0cbdc', 3); api.px(25, 2, '#ffffff');
      api.line(20, 9, 23, 6, '#733e39', 2);
    });
    const hammer = item(api => {
      api.line(10, 26, 18, 10, '#733e39', 3);
      api.rect(13, 4, 25, 12, '#5a6988'); api.rect(13, 4, 25, 6, '#8b9bb4');
      api.rect(13, 10, 25, 12, '#3a4466');
      api.rect(23, 4, 25, 12, '#c0cbdc');
    });
    const crossbow = item(api => {
      api.rect(15, 10, 17, 26, '#733e39');
      api.line(6, 12, 26, 12, '#b86f50', 2);
      api.line(6, 12, 26, 12, '#8b9bb4', 1);
      api.line(6, 12, 6, 6, '#5a6988', 2); api.line(26, 12, 26, 6, '#5a6988', 2);
      api.line(8, 9, 24, 9, '#e8ecf5', 1); // string
      api.line(16, 6, 16, 14, '#c28569', 1); api.px(16, 5, '#c0cbdc');
    });
    const wand = item(api => {
      api.line(10, 26, 20, 10, '#733e39', 2);
      api.ellipse(18, 5, 24, 11, '#b55088', true); api.ellipse(19, 6, 22, 9, '#2ce8f5', true);
      api.px(20, 7, '#ffffff');
      api.px(14, 6, '#ffffff'); api.px(26, 12, '#2ce8f5'); api.px(12, 14, '#b55088');
    });
    const mace = item(api => {
      api.line(14, 28, 18, 12, '#5a6988', 3);
      api.ellipse(12, 4, 22, 14, '#8b9bb4', true);
      api.px(17, 4, '#c0cbdc'); api.px(12, 9, '#c0cbdc'); api.px(22, 9, '#c0cbdc'); api.px(17, 14, '#c0cbdc');
      api.px(17, 9, '#ffffff');
      api.px(14, 15, '#fee761'); api.px(20, 15, '#fee761');
    });
    const bomb = item(api => {
      api.ellipse(10, 12, 22, 26, '#262b44', true);
      api.ellipse(11, 13, 16, 20, '#5a6988', true);
      api.px(13, 15, '#ffffff');
      api.line(17, 12, 21, 6, '#b86f50', 2);
      api.px(21, 5, '#fee761'); api.px(22, 4, '#ffffff'); api.px(20, 6, '#f77622');
      api.rect(15, 11, 19, 13, '#8b9bb4');
    });
    const arrows = item(api => {
      [[12, 1], [16, -1], [20, 1]].forEach(([x, dy]) => {
        api.line(x - 4, 24 + dy, x + 4, 8 + dy, '#c28569', 1);
        api.px(x + 4, 8 + dy, '#c0cbdc'); api.px(x + 5, 7 + dy, '#c0cbdc');
        api.px(x - 4, 24 + dy, '#e43b44'); api.px(x - 5, 25 + dy, '#e43b44');
      });
    });
    return { width: 32, height: 32, name: 'rpg-arsenal', layers: [{ name: 'Weapons' }], states: [
      S1('greatsword', greatsword), S1('katana', katana), S1('dagger', dagger), S1('spear', spear),
      S1('warhammer', hammer), S1('crossbow', crossbow), S1('wand', wand), S1('mace', mace),
      S1('bomb', bomb), S1('arrows', arrows)
    ] };
  }

  /* ================= LOOT ================= */
  function lootSuite() {
    const coins = item(api => {
      api.ellipse(8, 20, 24, 26, '#feae34', true);
      api.ellipse(10, 16, 22, 23, '#fee761', true);
      api.ellipse(12, 12, 20, 19, '#fee761', true);
      api.ellipse(12, 12, 20, 15, '#fff6c9', true);
      api.px(15, 13, '#ffffff'); api.px(14, 18, '#ffffff'); api.px(12, 22, '#ffffff');
    });
    const gems = item(api => {
      const gem = (cx, cy, c, hi) => {
        api.px(cx, cy - 3, c); api.rect(cx - 1, cy - 2, cx + 1, cy + 2, c); api.px(cx, cy + 3, c);
        api.px(cx - 1, cy - 1, hi); api.px(cx, cy - 2, '#ffffff');
      };
      gem(11, 20, '#e43b44', '#f6757a'); gem(21, 20, '#2ce8f5', '#ffffff'); gem(16, 15, '#63c74d', '#c9f27e');
      api.px(7, 14, '#ffffff'); api.px(25, 13, '#ffffff');
    });
    const bag = item(api => {
      api.rect(13, 8, 19, 11, '#733e39');
      api.ellipse(9, 11, 23, 26, '#b86f50', true);
      api.ellipse(9, 11, 16, 26, '#e4a672', true);
      api.px(16, 17, '#fee761'); api.px(15, 19, '#fee761'); api.px(17, 19, '#fee761'); api.px(16, 21, '#fee761');
    });
    const scroll = item(api => {
      api.rect(9, 12, 23, 22, '#ead4aa'); api.rect(9, 12, 23, 13, '#fff6c9');
      api.rect(7, 11, 9, 23, '#b86f50'); api.rect(23, 11, 25, 23, '#b86f50');
      api.line(12, 16, 20, 16, '#c28569', 1); api.line(12, 19, 18, 19, '#c28569', 1);
      api.rect(14, 14, 18, 21, '#a22633'); api.px(16, 17, '#fee761'); // seal
    });
    const book = item(api => {
      api.rect(9, 9, 23, 25, '#68386c'); api.rect(9, 9, 11, 25, '#3e2347');
      api.rect(11, 11, 21, 23, '#ead4aa');
      api.line(13, 13, 19, 13, '#c28569', 1); api.line(13, 16, 19, 16, '#c28569', 1);
      api.px(16, 19, '#b55088'); api.px(15, 20, '#b55088'); api.px(17, 20, '#b55088');
      api.rect(21, 15, 23, 17, '#fee761');
    });
    const map = item(api => {
      api.rect(8, 10, 24, 24, '#e4a672'); api.rectO(8, 10, 24, 24, '#733e39');
      api.line(9, 20, 15, 14, '#c28569', 1); api.line(15, 14, 19, 18, '#c28569', 1);
      api.px(11, 13, '#2ce8f5'); api.px(21, 21, '#2ce8f5');
      api.px(19, 17, '#e43b44'); api.px(20, 17, '#e43b44'); api.px(19, 18, '#e43b44'); api.px(20, 18, '#e43b44');
      api.line(18, 16, 21, 19, '#e43b44', 1); api.line(21, 16, 18, 19, '#e43b44', 1);
    });
    const elixir = item(api => {
      api.rect(14, 6, 18, 9, '#b86f50'); // cork
      api.rect(12, 9, 20, 13, '#c0cbdc');
      api.ellipse(10, 13, 22, 26, '#c0cbdc', true);
      api.ellipse(11, 16, 21, 25, '#f6757a', true);
      api.ellipse(11, 16, 21, 19, '#ff9db0', true);
      api.px(13, 18, '#ffffff'); api.px(17, 21, '#ffffff'); api.px(15, 23, '#ffffff');
    });
    const feather = item(api => {
      api.line(10, 27, 22, 7, '#e8ecf5', 2);
      api.line(12, 24, 18, 10, '#2ce8f5', 2); api.line(20, 22, 22, 12, '#2ce8f5', 1);
      api.px(22, 7, '#ffffff');
    });
    const fang = item(api => {
      api.line(12, 8, 17, 24, '#ead4aa', 3); api.line(12, 8, 16, 22, '#ffffff', 1);
      api.rect(11, 6, 15, 9, '#c28569');
    });
    const ore = item(api => {
      api.ellipse(9, 16, 23, 26, '#5a6988', true);
      api.ellipse(9, 16, 16, 23, '#8b9bb4', true);
      api.px(14, 19, '#fee761'); api.px(17, 22, '#fee761'); api.px(19, 18, '#fff6c9');
      api.line(12, 24, 20, 24, '#3a4466', 1);
    });
    const ingot = item(api => {
      api.rect(10, 18, 22, 25, '#feae34');
      api.rect(12, 16, 20, 18, '#fee761');
      api.rect(10, 18, 12, 25, '#fff6c9');
      api.px(16, 19, '#ffffff'); api.px(18, 21, '#ffffff');
    });
    const herb = item(api => {
      api.line(16, 26, 16, 16, '#265c42', 2);
      api.line(16, 20, 10, 14, '#3e8948', 3); api.line(16, 18, 22, 12, '#3e8948', 3);
      api.line(16, 16, 16, 10, '#63c74d', 3);
      api.px(10, 14, '#63c74d'); api.px(22, 12, '#63c74d'); api.px(16, 10, '#c9f27e');
      api.px(18, 8, '#ff9db0'); api.px(18, 9, '#ff9db0'); // flower
    });
    // twinkling valuables: two sparkle constellations alternate phase (12px swing, no hitch)
    const twinkle2 = (name, base, a, b) => D(name, 6, true, [a, b].map(spots => Fr(ms(6), (buf, W, H) => {
      base(buf, W, H);
      const api = apiFor(buf, W, H);
      spots.forEach(([x, y, c]) => api.px(x, y, c));
    })));
    const coinTw = [
      [[9, 12, '#ffffff'], [15, 10, '#fff6c9'], [20, 14, '#ffffff'], [12, 18, '#fff6c9'], [18, 21, '#ffffff'], [22, 19, '#fff6c9']],
      [[11, 11, '#fff6c9'], [17, 12, '#ffffff'], [22, 15, '#fff6c9'], [10, 20, '#ffffff'], [16, 23, '#fff6c9'], [21, 22, '#ffffff']]];
    const gemTw = [
      [[7, 14, '#ffffff'], [16, 11, '#ffffff'], [25, 13, '#ffffff'], [11, 24, '#2ce8f5'], [21, 24, '#f6757a']],
      [[8, 15, '#2ce8f5'], [15, 12, '#f6757a'], [24, 14, '#ffffff'], [12, 23, '#ffffff'], [20, 23, '#ffffff']]];
    return { width: 32, height: 32, name: 'rpg-loot', layers: [{ name: 'Loot' }], states: [
      twinkle2('coin_pile', coins, coinTw[0], coinTw[1]), twinkle2('gems', gems, gemTw[0], gemTw[1]),
      S1('money_bag', bag), S1('scroll', scroll),
      S1('spellbook', book), S1('treasure_map', map), S1('elixir', elixir), S1('feather', feather),
      S1('fang', fang), S1('gold_ore', ore), S1('gold_ingot', ingot), S1('herb', herb)
    ] };
  }

  /* ================= STATUS ICONS (16px, centered) ================= */
  function statusSuite() {
    const icon = painter => (buf, W, H) => {
      const api = apiFor(buf, W, H);
      api.rect(8, 8, 23, 23, '#262b44'); api.rectO(8, 8, 23, 23, '#8b9bb4');
      api.rect(8, 8, 23, 9, '#3a4466');
      painter(api);
      finish(buf);
    };
    const flame = api => { api.ellipse(13, 14, 19, 21, '#f77622', true); api.ellipse(14, 15, 18, 20, '#fee761', true); api.px(16, 16, '#ffffff'); api.px(14, 12, '#f77622'); };
    const drop = api => { api.px(16, 11, '#b55088'); api.rect(14, 12, 18, 20, '#b55088'); api.rect(14, 18, 18, 20, '#68386c'); api.px(15, 14, '#ffffff'); };
    const flake = api => {
      api.line(16, 10, 16, 22, '#2ce8f5', 1); api.line(10, 16, 22, 16, '#2ce8f5', 1); api.line(12, 12, 20, 20, '#2ce8f5', 1); api.line(20, 12, 12, 20, '#2ce8f5', 1);
      api.px(16, 16, '#ffffff');
    };
    const stars = api => { api.px(12, 13, '#fee761'); api.px(19, 12, '#fee761'); api.px(15, 19, '#fee761'); api.ellipse(12, 14, 20, 19, '#8b9bb4', false); };
    const zzz = api => { api.px(13, 12, '#2ce8f5'); api.px(14, 12, '#2ce8f5'); api.px(14, 13, '#2ce8f5'); api.px(13, 14, '#2ce8f5'); api.px(14, 14, '#2ce8f5'); api.px(17, 16, '#2ce8f5'); api.px(18, 16, '#2ce8f5'); api.px(18, 17, '#2ce8f5'); api.px(17, 18, '#2ce8f5'); api.px(18, 18, '#2ce8f5'); };
    const cross = api => { api.rect(14, 12, 18, 20, '#63c74d'); api.rect(12, 14, 20, 18, '#63c74d'); api.px(16, 12, '#c9f27e'); };
    const bshield = api => { api.ellipse(12, 12, 20, 21, '#2a5fa0', true); api.ellipse(14, 14, 18, 19, '#e8ecf5', true); api.px(16, 16, '#2a5fa0'); };
    const swordUp = api => { api.rect(15, 13, 17, 20, '#c0cbdc'); api.px(16, 12, '#ffffff'); api.rect(13, 20, 19, 21, '#fee761'); api.line(18, 11, 20, 9, '#e43b44', 2); api.px(20, 8, '#e43b44'); };
    const shieldUp = api => { api.ellipse(12, 13, 20, 21, '#8b9bb4', true); api.px(16, 12, '#63c74d'); api.px(15, 11, '#63c74d'); api.px(17, 11, '#63c74d'); api.px(16, 10, '#63c74d'); };
    const wind = api => { api.line(10, 13, 20, 13, '#ffffff', 1); api.line(12, 16, 22, 16, '#c0cbdc', 1); api.line(10, 19, 18, 19, '#8b9bb4', 1); };
    const skull = api => { api.rect(13, 12, 19, 19, '#b55088'); api.px(14, 15, '#181425'); api.px(18, 15, '#181425'); api.line(15, 19, 17, 19, '#181425', 1); api.px(16, 11, '#68386c'); };
    const bolt = api => { api.line(18, 11, 14, 16, '#fee761', 2); api.line(14, 16, 18, 16, '#fee761', 2); api.line(18, 16, 14, 21, '#fee761', 2); api.px(18, 11, '#ffffff'); };
    return { width: 32, height: 32, name: 'rpg-status', layers: [{ name: 'Icons' }], states: [
      S1('burn', icon(flame)), S1('poison', icon(drop)), S1('frozen', icon(flake)), S1('stun', icon(stars)),
      S1('sleep', icon(zzz)), S1('regen', icon(cross)), S1('shielded', icon(bshield)), S1('attack_up', icon(swordUp)),
      S1('defense_up', icon(shieldUp)), S1('haste', icon(wind)), S1('cursed', icon(skull)), S1('paralysis', icon(bolt))
    ] };
  }

  /* ================= BATTLE MAGIC 2 ================= */
  function magic2Suite() {
    /* Six separate stacked ellipses with gaps between them is a wedding cake,
       which is exactly what the old tornado looked like. A funnel is ONE
       continuous solid, wide at the cloud and narrow at the ground, and the
       spin is carried by a lit band spiralling down it — the band's phase
       shifts per frame, so the whole column appears to rotate without a
       single shape moving. */
    const tornado = i => (buf, W, H) => {
      const api = apiFor(buf, W, H);
      const Dk = '#4c5972', M = '#8b9bb4', L = '#c0cbdc', Hi = '#e4ecf7';
      for (let y = 1; y <= 26; y++) {
        const t = (y - 1) / 25;
        const hw = Math.max(2, Math.round(10 - t * t * 8 + Math.sin(y * 0.8 + i) * 0.7));
        const lean = Math.round(Math.sin(y * 0.22 + i * 0.5) * 1.6);
        const cx = 16 + lean;
        api.rect(cx - hw, y, cx + hw, y, M);
        api.px(cx - hw, y, Dk); api.px(cx + hw, y, Dk);
        const ph = y * 0.66 - i * 1.3;                     // the spiralling band
        const bx = cx + Math.round(Math.sin(ph) * hw * 0.55);
        const bw = Math.max(1, Math.round(hw * 0.4));
        api.rect(bx - bw, y, bx + bw, y, Math.cos(ph) > 0 ? L : Dk);
        if (Math.cos(ph) > 0.65) api.px(bx, y, Hi);
      }
      api.ellipse(4, 24, 28, 30, Dk, true);                // dust kicked off the ground
      api.ellipse(7, 25, 25, 29, M, true);
      api.ellipse(11, 26, 21, 28, L, true);
      for (let k = 0; k < 5; k++) {                        // debris torn up and thrown wide
        const a = k * 1.27 + i * 0.8, y = 8 + k * 4;
        const x = 16 + Math.round(Math.cos(a) * (10 - k));
        api.px(x, y, k % 2 ? '#3e8948' : '#b86f50');
        api.px(x + (a > 3 ? -1 : 1), y + 1, k % 2 ? '#265c42' : '#733e39');
      }
      finish(buf);
    };
    const meteor = i => (buf, W, H) => {
      const api = apiFor(buf, W, H);
      if (i < 3) {
        const x = 6 + i * 7, y = 4 + i * 5;
        api.line(x - 8, y - 8, x, y, '#f77622', 2); api.line(x - 5, y - 5, x, y, '#fee761', 1);
        api.ellipse(x - 3, y - 3, x + 3, y + 3, '#f77622', true);
        api.ellipse(x - 2, y - 2, x + 1, y + 1, '#fee761', true); api.px(x - 1, y - 1, '#ffffff');
      } else {
        P().sparks(api, 26, 24, 3, '#fee761', 12, 2, 9);
        api.ellipse(20, 20, 30, 27, '#f77622', false); api.ellipse(22, 22, 28, 26, '#fee761', false);
        api.ellipse(22, 24, 28, 27, '#5c3a2a', true);
      }
      finish(buf);
    };
    const heal = i => (buf, W, H) => {
      const api = apiFor(buf, W, H);
      api.rect(14, 6, 18, 28, '#63c74d'); api.rect(15, 6, 17, 28, '#c9f27e'); api.px(16, 4 + (i % 2), '#ffffff');
      const cy = 24 - i * 5;
      [[16, cy], [12, cy + 3], [20, cy + 2]].forEach(([x, y]) => {
        api.px(x, y - 1, '#ffffff'); api.line(x - 1, y, x + 1, y, '#ffffff', 1); api.px(x, y + 1, '#ffffff');
      });
      P().particles(api, 16, 20, 8, i / 4, ['#63c74d', '#ffffff']);
      finish(buf);
    };
    const summon = i => (buf, W, H) => {
      const api = apiFor(buf, W, H);
      for (let k = 0; k < 12; k++) {
        const a = (k / 12) * Math.PI * 2 + i * 0.26;
        api.px(16 + Math.cos(a) * 11, 22 + Math.sin(a) * 4, k % 3 ? '#b55088' : '#ffffff');
      }
      api.ellipse(7, 19, 25, 26, '#68386c', false);
      api.line(16, 19, 10, 26, '#68386c', 1); api.line(16, 19, 22, 26, '#68386c', 1); api.line(10, 26, 22, 26, '#68386c', 1);
      const g = 2 + (i % 2);
      api.ellipse(16 - g, 21 - g, 16 + g, 23 + g, '#2ce8f5', true);
      api.px(16, 22, '#ffffff');
      finish(buf);
    };
    const boom = i => (buf, W, H) => {
      const api = apiFor(buf, W, H);
      const r = 2 + i * 3;
      if (i === 0) { api.ellipse(13, 13, 19, 19, '#ffffff', true); api.ellipse(14, 14, 18, 18, '#fee761', true); }
      else {
        api.ellipse(16 - r, 16 - r, 16 + r, 16 + r, i < 3 ? '#f77622' : '#8b9bb4', false);
        if (i < 3) api.ellipse(16 - r + 2, 16 - r + 2, 16 + r - 2, 16 + r - 2, '#fee761', false);
        if (i >= 2) for (let k = 0; k < 5; k++) api.px(8 + ((i * 5 + k * 6) % 17), 8 + ((i * 3 + k * 4) % 15), '#5a6988');
      }
      finish(buf);
    };
    const frost = i => (buf, W, H) => {
      const api = apiFor(buf, W, H);
      const d = [2, 6, 10][i];
      [[-1, 0], [1, -1], [0, 1]].forEach(([sx, sy]) => {
        const x = 16 + sx * d, y = 16 + sy * d;
        api.px(x, y - 2, '#2ce8f5'); api.rect(x - 1, y - 1, x + 1, y + 1, '#2ce8f5'); api.px(x, y + 2, '#2ce8f5');
        api.px(x, y, '#ffffff');
        if (i === 2) P().sparks(api, x, y, sx + 2, '#ffffff', 4, 1, 3);
      });
      finish(buf);
    };
    const poison = i => (buf, W, H) => {
      const api = apiFor(buf, W, H);
      [[12, 20, 5], [19, 17, 6], [15, 13, 4]].forEach(([x, y, r], k) => {
        const dx = ((i + k) % 2 ? 1 : -1);
        api.ellipse(x - r + dx, y - 3, x + r + dx, y + 3, k % 2 ? '#68386c' : '#3e8948', true);
        api.ellipse(x - r + dx, y - 3, x - r + 2 + dx, y + 1, '#b55088', true);
      });
      api.px(10 + i, 10, '#63c74d'); api.px(22 - i, 24, '#63c74d');
      finish(buf);
    };
    return { width: 32, height: 32, name: 'rpg-magic-2', layers: [{ name: 'FX' }], states: [
      D('tornado', 10, true, [0, 1, 2, 3].map(i => Fr(ms(10), tornado(i)))),
      D('meteor', 10, true, [0, 1, 2, 3].map(i => Fr(ms(10), meteor(i)))),
      D('heal', 8, true, [0, 1, 2, 3].map(i => Fr(ms(8), heal(i)))),
      D('summon', 8, true, [0, 1, 2, 3].map(i => Fr(ms(8), summon(i)))),
      D('explosion', 12, true, [0, 1, 2, 3, 4].map(i => Fr(ms(12), boom(i)))),
      D('frost_shards', 10, true, [0, 1, 2].map(i => Fr(ms(10), frost(i)))),
      D('poison_cloud', 6, true, [0, 1, 2, 3].map(i => Fr(ms(6), poison(i))))
    ] };
  }

  /* ================= RPG UI CHROME ================= */
  function uiSuite() {
    const dialog = item(api => {
      api.rect(2, 18, 29, 29, '#262b44');
      api.rect(3, 19, 28, 28, '#e8ecf5');
      api.line(5, 22, 20, 22, '#8b9bb4', 1); api.line(5, 24, 26, 24, '#8b9bb4', 1); api.line(5, 26, 14, 26, '#8b9bb4', 1);
      api.px(26, 26, '#e43b44'); api.px(27, 27, '#e43b44');
    });
    const button = mode => item(api => {
      const top = mode === 'hover' ? '#ffffff' : '#c0cbdc', bot = mode === 'pressed' ? '#c0cbdc' : '#5a6988';
      const dy = mode === 'pressed' ? 1 : 0;
      api.rect(5, 12 + dy, 26, 21 + dy, '#8b9bb4');
      api.rect(5, 12 + dy, 26, 13 + dy, top); api.rect(5, 20 + dy, 26, 21 + dy, bot);
      api.rect(5, 12 + dy, 6, 21 + dy, top); api.rect(25, 12 + dy, 26, 21 + dy, bot);
      api.line(10, 16 + dy, 21, 16 + dy, mode === 'hover' ? '#181425' : '#3a4466', 1);
      api.line(10, 18 + dy, 17, 18 + dy, mode === 'hover' ? '#181425' : '#3a4466', 1);
    });
    const cursor = item(api => {
      api.line(12, 6, 12, 22, '#ffffff', 2); api.line(12, 22, 18, 16, '#ffffff', 2); api.line(12, 6, 19, 13, '#ffffff', 2);
      api.line(12, 6, 12, 22, '#181425', 1); api.px(16, 18, '#e43b44'); api.px(17, 19, '#e43b44');
    });
    const arrow = bob => item(api => {
      const y = 12 + bob;
      api.line(10, y, 22, y, '#fee761', 3); api.line(22, y, 17, y - 3, '#fee761', 3); api.line(22, y, 17, y + 3, '#fee761', 3);
      api.px(11, y, '#ffffff');
    });
    const coinIcon = item(api => {
      api.ellipse(11, 10, 21, 24, '#feae34', true); api.ellipse(12, 11, 20, 23, '#fee761', true);
      api.px(14, 13, '#ffffff'); api.px(15, 13, '#fff6c9');
      api.rect(14, 15, 18, 21, '#feae34'); api.px(16, 16, '#a22633'); api.px(16, 20, '#a22633');
    });
    const lock = item(api => {
      api.rect(11, 14, 21, 26, '#8b9bb4'); api.rect(11, 14, 13, 26, '#c0cbdc'); api.rect(19, 14, 21, 26, '#5a6988');
      api.rect(13, 8, 19, 15, '#5a6988'); api.rectO(13, 8, 19, 15, '#c0cbdc');
      api.px(16, 19, '#181425'); api.line(16, 19, 16, 22, '#181425', 1);
    });
    const star = tw => item(api => {
      api.px(16, 8, '#fee761'); api.rect(14, 9, 18, 10, '#fee761');
      api.rect(12, 11, 20, 13, '#fee761'); api.rect(14, 14, 18, 20, '#fee761');
      api.px(13, 21, '#fee761'); api.px(19, 21, '#fee761');
      api.px(15, 10, '#ffffff');
      if (tw) { api.px(8, 12, '#ffffff'); api.px(24, 16, '#ffffff'); }
    });
    const skullIcon = item(api => {
      api.rect(11, 10, 21, 20, '#e8ecf5'); api.rect(19, 10, 21, 20, '#8b9bb4');
      api.rect(13, 14, 15, 16, '#181425'); api.rect(17, 14, 19, 16, '#181425');
      api.px(16, 17, '#181425'); api.line(14, 20, 18, 20, '#181425', 1);
      api.rect(13, 20, 19, 23, '#e8ecf5'); api.line(15, 20, 15, 23, '#8b9bb4', 1); api.line(17, 20, 17, 23, '#8b9bb4', 1);
    });
    return { width: 32, height: 32, name: 'rpg-ui', layers: [{ name: 'UI' }], states: [
      S1('dialog_box', dialog), S1('button', button('normal')), S1('button_hover', button('hover')),
      S1('button_pressed', button('pressed')), S1('cursor', cursor),
      D('arrow_next', 4, true, [Fr(ms(4), arrow(0)), Fr(ms(4), arrow(2))]),
      S1('coin_icon', coinIcon), S1('lock_icon', lock),
      D('star', 3, true, [Fr(ms(3), star(false)), Fr(ms(3), star(true))]),
      S1('skull_icon', skullIcon)
    ] };
  }

  return { armorSuite, arsenalSuite, lootSuite, statusSuite, magic2Suite, uiSuite };
})();
