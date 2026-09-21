/* Hearthhold — image assets. Game-only.
 *
 * The valley's look comes from two OpenGameArt packs in ../assets (see
 * CREDITS.txt): ArMM1998's Zelda-like overworld for terrain, flora and
 * buildings, and DragonDePlatino's DawnLike for villagers, raiders and ores.
 * Nothing else in the repository — not the engine, not the app, not another
 * game — touches these files, and the procedural fallbacks in game.js stay
 * exactly as they were, so a missing image (or a headless Node sim with no
 * Image constructor) costs the new look, never the game.
 *
 * Both packs ship true alpha, so there is deliberately NO chroma keying in
 * this file: every sprite is sliced and drawn as-is, which is what keeps the
 * edges clean. Rects were measured off the sheets with a connected-component
 * pass over the alpha channel, then hand-assigned and eyeballed on magenta. */

window.HHArt = (() => {
  'use strict';

  /* name -> [sheet, x, y, w, h]. All sheets are multiples of 16. */
  var DEF = {
    g_grass0: ['ow', 48, 128, 16, 16],
    g_grass1: ['ow', 64, 128, 16, 16],
    g_grass2: ['ow', 48, 144, 16, 16],
    g_grass3: ['ow', 64, 144, 16, 16],
    g_dirt0: ['ow', 128, 176, 16, 16],
    g_dirt1: ['ow', 144, 160, 16, 16],
    g_path0: ['ow', 148, 144, 16, 16],
    g_path1: ['ow', 148, 160, 16, 16],
    g_sand0: ['ow', 232, 168, 16, 16],
    g_sand1: ['ow', 248, 168, 16, 16],
    g_water0: ['ow', 56, 106, 16, 16],
    g_water1: ['ow', 72, 106, 16, 16],
    fence_rail: ['ow', 416, 88, 64, 16],
    flower_w: ['obj', 41, 172, 20, 19],

    n_oak: ['ow', 8, 176, 72, 96],
    n_pine: ['ow', 80, 176, 64, 96],
    n_rock: ['ow', 150, 170, 48, 48],
    n_clay: ['ore', 32, 32, 16, 16],
    n_iron: ['ore', 64, 32, 16, 16],
    n_gold: ['ore', 112, 32, 16, 16],
    n_berry: ['obj', 132, 173, 16, 19],
    n_flower: ['obj', 41, 172, 20, 19],
    n_stump: ['ow', 124, 96, 52, 44],
    n_bush: ['ow', 245, 373, 43, 43],

    b_hall: ['ow', 84, 0, 148, 110],
    b_house: ['ow', 245, 0, 105, 105],
    b_cottage: ['ow', 220, 105, 48, 56],
    b_hut: ['ow', 118, 134, 41, 51],
    b_tent: ['ow', 178, 136, 49, 42],
    b_market: ['ow', 224, 346, 106, 72],
    b_barracks: ['ow', 545, 480, 83, 96],
    b_tower: ['ow', 297, 440, 88, 136],
    b_quarry: ['ow', 150, 170, 48, 48],
    b_wood: ['ow', 124, 96, 52, 44],
    b_granary: ['ow', 397, 269, 38, 40],
    b_brazier: ['obj', 149, 60, 43, 27],

    c_wheat1: ['obj', 52, 28, 23, 28],
    c_wheat2: ['obj', 9, 29, 23, 27],
    c_wheat3: ['obj', 218, 90, 35, 33],
    c_wheat4: ['obj', 257, 88, 39, 39],
    c_wheat5: ['obj', 86, 173, 19, 19],
    c_herb1: ['obj', 52, 28, 23, 28],
    c_herb2: ['obj', 41, 172, 20, 19],
    c_herb3: ['obj', 132, 173, 16, 19],
    c_herb4: ['obj', 218, 90, 35, 33],
    c_herb5: ['obj', 257, 88, 39, 39]
  };

  /* Storehouse = crates beside a barrel: two rects composed side by side at
     load, bottom-aligned, so the game treats it as one sprite. */
  var COMBO = {
    b_store: { parts: [['ow', 397, 269, 38, 40], ['ow', 206, 338, 24, 38]], gap: 2 }
  };

  /* DawnLike unit cells. Rows are monsters/roles, file 0/1 is the two-frame
     shuffle, columns are variants — the game picks a column per unit id. */
  var UNIT_COLS = 8;
  function unitCells(prefix, files, row) {
    var out = [];
    for (var f = 0; f < 2; f++) for (var c = 0; c < UNIT_COLS; c++)
      out.push([prefix + f + '_' + c, [files[f], c * 16, row * 16, 16, 16]]);
    return out;
  }
  var UNITS = unitCells('pw', ['plr0', 'plr1'], 0)
    .concat(unitCells('ps', ['plr0', 'plr1'], 8))
    .concat([['r_thug0', ['slm0', 0, 0, 16, 16]], ['r_thug1', ['slm1', 0, 0, 16, 16]]]);

  var RAIDER_ROWS = { blade: 3, pike: 2, arch: 0 };
  function raiderCells() {
    var out = [];
    for (var k in RAIDER_ROWS)
      for (var f = 0; f < 2; f++)
        out.push(['r_' + k + f, ['hum' + f, 0, RAIDER_ROWS[k] * 16, 16, 16]]);
    return out;
  }

  var IMGS = {};
  var CUTS = {};
  var built = false;
  var loading = false;

  function build() {
    if (built) return;
    built = true;
    var put = function (name, sheet, x, y, w, h) {
      var img = IMGS[sheet];
      if (!img || !img.naturalWidth) return;
      var c = document.createElement('canvas');
      c.width = w; c.height = h;
      var g = c.getContext('2d');
      g.imageSmoothingEnabled = false;
      try { g.drawImage(img, x, y, w, h, 0, 0, w, h); }
      catch (e) { return; }
      CUTS[name] = c;
    };
    for (var k in DEF) put(k, DEF[k][0], DEF[k][1], DEF[k][2], DEF[k][3], DEF[k][4]);
    for (var i = 0; i < UNITS.length; i++)
      put(UNITS[i][0], UNITS[i][1][0], UNITS[i][1][1], UNITS[i][1][2], UNITS[i][1][3], UNITS[i][1][4]);
    var rc = raiderCells();
    for (var j = 0; j < rc.length; j++)
      put(rc[j][0], rc[j][1][0], rc[j][1][1], rc[j][1][2], rc[j][1][3], rc[j][1][4]);
    for (var cb in COMBO) {
      var parts = COMBO[cb].parts, gap = COMBO[cb].gap || 0;
      var tw = gap * (parts.length - 1), th = 0, ok = true, k2;
      for (k2 = 0; k2 < parts.length; k2++) {
        if (!IMGS[parts[k2][0]]) { ok = false; break; }
        tw += parts[k2][3]; th = Math.max(th, parts[k2][4]);
      }
      if (!ok) continue;
      var c = document.createElement('canvas');
      c.width = tw; c.height = th;
      var g = c.getContext('2d');
      g.imageSmoothingEnabled = false;
      var ox = 0;
      for (k2 = 0; k2 < parts.length; k2++) {
        var p = parts[k2];
        try { g.drawImage(IMGS[p[0]], p[1], p[2], p[3], p[4], ox, th - p[4], p[3], p[4]); }
        catch (e) { ok = false; break; }
        ox += p[3] + gap;
      }
      if (ok) CUTS[cb] = c;
    }
  }

  function load() {
    /* Headless (sim) or failed twice: stay procedural. */
    if (typeof Image === 'undefined' || typeof document === 'undefined') return false;
    if (built) return true;
    if (loading) return false;
    loading = true;
    var pending = 0;
    var files = {
      ow: 'ow.png', obj: 'obj.png', ore: 'ore.png',
      hum0: 'hum0.png', hum1: 'hum1.png',
      slm0: 'slm0.png', slm1: 'slm1.png',
      plr0: 'plr0.png', plr1: 'plr1.png'
    };
    for (var s in files) {
      pending++;
      (function (s) {
        var img = new Image();
        img.onload = function () { IMGS[s] = img; if (--pending === 0) build(); };
        img.onerror = function () { if (--pending === 0) build(); };
        img.src = 'assets/' + files[s];
      })(s);
    }
    return false;
  }

  function get(name) {
    return CUTS[name] || null;
  }

  function ready() { return built; }

  return { load: load, get: get, ready: ready };
})();
