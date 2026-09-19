/* Hearthhold — the static tables.

   Everything the settlement is made of is declared here as data: terrain
   indices into the tile sheet, the resource ledger, what a harvestable node
   yields, and the build catalogue. The simulation in game.js reads these and
   owns no constants of its own, so balancing the game means editing this file
   and nothing else.

   The build catalogue is the load-bearing table. Each entry carries its own
   cost, footprint, hit points, sprite and behaviour flags, which is what lets
   the build palette, the placement validator, the construction queue, the
   economy tick and the raider target picker all be written once against a
   generic building rather than once per building. */
window.HH = (() => {
  'use strict';

  const T = 16;                       // pixels per tile
  const MW = 56, MH = 56;             // map size in tiles

  /* Indices into the hold_ground sheet, which is 4x4 tiles of 16px. */
  const G = {
    GRASS: 0, TUFT: 1, BLOOM: 2, ROAD: 3,
    RUT: 4, TILL: 5, WET: 6, SAND: 7,
    WATER: 8, SHALLOW: 9, COBBLE: 10, PLANK: 11,
    GRAVEL: 12, ASH: 13, MOSS: 14, RUBBLE: 15
  };

  /* The ledger, in HUD order. `coin` is the only one that is spent rather than
     consumed, and `pop` is derived from the villager list rather than stored,
     so neither behaves quite like the rest — see addRes() in game.js. */
  const RES = ['wood', 'stone', 'clay', 'iron', 'gold', 'coin', 'food', 'herb'];
  const RES_NAME = {
    wood: 'Timber', stone: 'Stone', clay: 'Clay', iron: 'Iron',
    gold: 'Gold', coin: 'Coin', food: 'Food', herb: 'Herbs'
  };
  const RES_COLOUR = {
    wood: '#9c6a44', stone: '#b3b8c2', clay: '#c08a64', iron: '#8d887e',
    gold: '#ffd97a', coin: '#fee761', food: '#d9536a', herb: '#7bc255'
  };
  /* Library sprites borrowed for the HUD chips. Drawn once into small canvases
     at boot; nothing here is loaded from disk. */
  const RES_ICON = {
    wood: ['hold_nodes', 'stump'], stone: ['hold_nodes', 'stone'],
    clay: ['hold_nodes', 'clay'], iron: ['hold_nodes', 'iron'],
    gold: ['hold_nodes', 'gold'], coin: ['td_pickups', 'coin'],
    food: ['hold_nodes', 'berry'], herb: ['flora', 'flowers']
  };

  /* Harvestable map features. `work` is seconds of labour per unit pulled, so
     gold is slow and berries are quick without needing a second table. */
  const NODES = {
    tree: { res: 'wood', spr: ['flora', 'oak'], amount: 60, work: 0.9, kind: 'wood', stump: true },
    pine: { res: 'wood', spr: ['flora', 'pine'], amount: 60, work: 0.9, kind: 'wood', stump: true },
    rock: { res: 'stone', spr: ['hold_nodes', 'stone'], amount: 45, work: 1.2, kind: 'ore' },
    clay: { res: 'clay', spr: ['hold_nodes', 'clay'], amount: 40, work: 1.0, kind: 'ore' },
    iron: { res: 'iron', spr: ['hold_nodes', 'iron'], amount: 28, work: 1.6, kind: 'ore' },
    gold: { res: 'gold', spr: ['hold_nodes', 'gold'], amount: 16, work: 2.2, kind: 'ore' },
    berry: { res: 'food', spr: ['hold_nodes', 'berry'], amount: 40, work: 0.7, kind: 'wild', regrow: 26 },
    herb: { res: 'herb', spr: ['flora', 'flowers'], amount: 18, work: 1.1, kind: 'wild', regrow: 34 },
    stump: { res: null, spr: ['hold_nodes', 'stump'], amount: 0, work: 0, kind: 'dead' },
    bush: { res: null, spr: ['flora', 'bush'], amount: 0, work: 0, kind: 'dead' }
  };

  /* Build categories, in left-rail order. */
  const CATS = [
    { id: 'home', name: 'Dwellings', tint: '#c2701f' },
    { id: 'work', name: 'Industry', tint: '#79b3b8' },
    { id: 'farm', name: 'Fields', tint: '#7bc255' },
    { id: 'wall', name: 'Defences', tint: '#b3b8c2' },
    { id: 'road', name: 'Groundworks', tint: '#c08a64' }
  ];

  /* The catalogue.

       cost     what placing it deducts
       fw/fh    footprint in tiles; the sprite is always 32x32 and is anchored
                to the bottom centre of that footprint
       hp       structural health; raiders chew through this
       build    seconds of labour to raise it from a construction site
       jobs     how many villagers it employs
       gather   node kinds its workers harvest, if it is a gathering building
       makes    { from, to, rate } conversion run once per production tick
       house    beds provided
       cheer    happiness contribution while it stands and is staffed
       store    extra storage headroom
       light    torchlight radius in tiles at night
       guard    how many soldiers it can billet
       shoot    { range, dps } for anything that defends itself */
  const BUILD = [
    // ---- dwellings -------------------------------------------------------
    { id: 'tent', name: 'Tent', cat: 'home', spr: ['hold_homes', 'tent'],
      cost: { wood: 10 }, fw: 1, fh: 1, hp: 40, build: 3, house: 2, cheer: -2,
      desc: 'Canvas and rope. Sleeps two, pleases nobody, and goes up in an afternoon.' },
    { id: 'hut', name: 'Thatched Hut', cat: 'home', spr: ['hold_homes', 'hut'],
      cost: { wood: 25, clay: 5 }, fw: 1, fh: 1, hp: 70, build: 6, house: 3,
      desc: 'A single warm room under thatch. The first thing a settlement should build.' },
    { id: 'cottage', name: 'Cottage', cat: 'home', spr: ['hold_homes', 'cottage'],
      cost: { wood: 40, stone: 15, clay: 10 }, fw: 2, fh: 2, hp: 130, build: 10, house: 5, cheer: 3,
      desc: 'Plank walls, a real hearth and glass in the windows. Sleeps five in comfort.' },
    { id: 'house', name: 'Stone House', cat: 'home', spr: ['hold_homes', 'house'],
      cost: { wood: 55, stone: 40, clay: 20 }, fw: 2, fh: 2, hp: 190, build: 15, house: 8, cheer: 6,
      desc: 'Two storeys on a stone footing. Sleeps eight and raises the tone of the whole street.' },
    { id: 'market', name: 'Market Stall', cat: 'home', spr: ['hold_homes', 'market'],
      cost: { wood: 35, coin: 10 }, fw: 2, fh: 2, hp: 90, build: 8, jobs: 2, cheer: 5,
      makes: { from: { food: 2 }, to: { coin: 3 }, rate: 6 },
      desc: 'Sells the surplus. Turns spare food into coin and gives people somewhere to gossip.' },
    // ---- industry --------------------------------------------------------
    { id: 'woodcutter', name: "Woodcutter's Lodge", cat: 'work', spr: ['hold_works', 'woodcutter'],
      cost: { wood: 20 }, fw: 2, fh: 2, hp: 110, build: 7, jobs: 3, gather: ['wood'], store: 40,
      desc: 'Sends three axes out to the nearest standing timber and stacks what comes back.' },
    { id: 'quarry', name: 'Quarry', cat: 'work', spr: ['hold_works', 'quarry'],
      cost: { wood: 25, stone: 10 }, fw: 2, fh: 2, hp: 120, build: 9, jobs: 3, gather: ['ore'], store: 40,
      desc: 'Works any stone, clay or ore seam in reach. Slower than felling trees, and worth it.' },
    { id: 'granary', name: 'Granary', cat: 'work', spr: ['hold_works', 'granary'],
      cost: { wood: 30, stone: 10 }, fw: 2, fh: 2, hp: 100, build: 8, jobs: 2, gather: ['wild'], store: 60,
      desc: 'Stores the harvest off the ground and sends foragers after berries and herbs.' },
    { id: 'storehouse', name: 'Storehouse', cat: 'work', spr: ['hold_works', 'storehouse'],
      cost: { wood: 35 }, fw: 2, fh: 2, hp: 120, build: 8, jobs: 1, store: 120,
      desc: 'Raises the settlement’s carrying capacity. Without one, full stockpiles are simply lost.' },
    { id: 'kiln', name: 'Kiln', cat: 'work', spr: ['hold_works', 'kiln'],
      cost: { wood: 20, stone: 20, clay: 10 }, fw: 1, fh: 1, hp: 90, build: 8, jobs: 2,
      makes: { from: { clay: 3, wood: 1 }, to: { coin: 4 }, rate: 7 },
      desc: 'Fires clay into pottery worth selling. Smokes day and night once it is lit.' },
    { id: 'forge', name: 'Forge', cat: 'work', spr: ['hold_works', 'forge'],
      cost: { wood: 30, stone: 45, iron: 10 }, fw: 2, fh: 2, hp: 150, build: 14, jobs: 2,
      makes: { from: { iron: 2, wood: 2 }, to: { coin: 5 }, rate: 8 }, arms: 3,
      desc: 'Beats iron into tools and blades. Every soldier trained while it stands hits harder.' },
    { id: 'well', name: 'Well', cat: 'work', spr: ['hold_works', 'well'],
      cost: { stone: 20 }, fw: 1, fh: 1, hp: 80, build: 5, cheer: 6,
      desc: 'Clean water within walking distance. A small thing that everyone notices.' },
    { id: 'tavern', name: 'Tavern', cat: 'work', spr: ['hold_works', 'tavern'],
      cost: { wood: 50, stone: 20, coin: 20 }, fw: 2, fh: 2, hp: 140, build: 13, jobs: 2, cheer: 14,
      makes: { from: { food: 3, herb: 1 }, to: { coin: 4 }, rate: 8 },
      desc: 'The single strongest cure for a miserable settlement. Costs food to keep pouring.' },
    // ---- fields ----------------------------------------------------------
    { id: 'farm', name: 'Crop Field', cat: 'farm', spr: null, field: 'crop',
      cost: { wood: 12 }, fw: 2, fh: 2, hp: 50, build: 5, jobs: 2, store: 20,
      desc: 'Four tilled squares. Crops ripen through five stages, then a farmhand brings in the food.' },
    { id: 'garden', name: 'Herb Garden', cat: 'farm', spr: null, field: 'herb',
      cost: { wood: 8, coin: 5 }, fw: 1, fh: 1, hp: 40, build: 4, jobs: 1, cheer: 3, store: 10,
      desc: 'Physic beds. Herbs keep the settlement healthy and the tavern in business.' },
    // ---- defences --------------------------------------------------------
    { id: 'palisade', name: 'Palisade', cat: 'wall', wall: 1, spr: null,
      cost: { wood: 6 }, fw: 1, fh: 1, hp: 70, build: 1.4,
      desc: 'Split stakes driven into the ground. Stops nothing forever, but it buys your archers time.' },
    { id: 'rampart', name: 'Stone Rampart', cat: 'wall', wall: 2, spr: null,
      cost: { stone: 14 }, fw: 1, fh: 1, hp: 200, build: 3,
      desc: 'Coursed stone with crenels. Three times the palisade’s patience for twice the labour.' },
    { id: 'gate', name: 'Gate', cat: 'wall', wall: 3, spr: ['hold_keep', 'gate_closed'],
      cost: { wood: 24, iron: 6 }, fw: 2, fh: 1, hp: 140, build: 5, gate: true,
      desc: 'A way through your own wall. Set it to shut itself at dusk and it will never be left open.' },
    { id: 'tower', name: 'Watchtower', cat: 'wall', spr: ['hold_keep', 'tower'],
      cost: { wood: 15, stone: 50 }, fw: 2, fh: 2, hp: 220, build: 14, jobs: 1,
      shoot: { range: 7.5, dps: 14 }, light: 5,
      desc: 'Looses arrows at anything hostile inside seven tiles, and lights the ground beneath it.' },
    { id: 'barracks', name: 'Barracks', cat: 'wall', spr: ['hold_keep', 'barracks'],
      cost: { wood: 45, stone: 30, iron: 12 }, fw: 2, fh: 2, hp: 200, build: 16, guard: 4,
      desc: 'Billets four soldiers. Villagers can only take up arms where there are arms to take up.' },
    { id: 'brazier', name: 'Brazier', cat: 'wall', spr: ['hold_keep', 'brazier'],
      cost: { wood: 8, coin: 3 }, fw: 1, fh: 1, hp: 40, build: 2, light: 4.5, cheer: 2,
      desc: 'Burns through the night. Raiders will not walk into a lit street if there is a dark one.' },
    { id: 'banner', name: 'Banner', cat: 'wall', spr: ['hold_keep', 'banner'],
      cost: { wood: 5, coin: 8 }, fw: 1, fh: 1, hp: 30, build: 2, cheer: 8, rally: true,
      desc: 'Colours on a pole. Worth more to morale than anything else you can raise this cheaply.' },
    // ---- groundworks -----------------------------------------------------
    { id: 'road', name: 'Road', cat: 'road', ground: G.ROAD, spr: null,
      cost: { stone: 2 }, fw: 1, fh: 1, hp: 0, build: 0.6,
      desc: 'Packed earth and gravel. Everyone walks half again as fast on it, hauliers most of all.' },
    { id: 'paving', name: 'Paving', cat: 'road', ground: G.COBBLE, spr: null,
      cost: { stone: 5 }, fw: 1, fh: 1, hp: 0, build: 1, cheer: 1,
      desc: 'Set stone. Faster than road, smarter than road, and a great deal more expensive.' },
    { id: 'demolish', name: 'Demolish', cat: 'road', demolish: true, spr: null,
      cost: {}, fw: 1, fh: 1, hp: 0, build: 0,
      desc: 'Pull a structure down and recover a third of what went into it. Roads are simply scraped away.' }
  ];

  const byId = {};
  for (const b of BUILD) byId[b.id] = b;

  /* The town hall is never in the palette: you start with one, you cannot
     build a second, and losing it ends the run. */
  const HALL = {
    id: 'hall', name: 'Town Hall', cat: null, spr: ['hold_homes', 'hall'],
    cost: {}, fw: 2, fh: 2, hp: 800, build: 0, house: 4, cheer: 5, store: 150, light: 4,
    desc: 'The heart of the settlement. Everything is hauled here, and if it falls the hold is finished.'
  };
  byId.hall = HALL;

  /* Villager given names. Drawn from a fixed list rather than generated so the
     same settlement always names its people the same way. */
  const NAMES = [
    'Alder', 'Bryn', 'Cait', 'Dorn', 'Esk', 'Fen', 'Gale', 'Hale', 'Ivo', 'Jory',
    'Kell', 'Lark', 'Marn', 'Nix', 'Orla', 'Pell', 'Quill', 'Rask', 'Sable', 'Tam',
    'Ulric', 'Vane', 'Wren', 'Yarrow', 'Zeph', 'Brann', 'Corr', 'Dell', 'Eara', 'Finn',
    'Greta', 'Hild', 'Isolde', 'Jarl', 'Kesh', 'Linnet', 'Mabon', 'Nerys', 'Osric', 'Perrin'
  ];

  const RAIDER_KINDS = [
    { id: 'thug', spr: 'tiny_drudge', hp: 26, dmg: 5, speed: 2.2, wash: '#6b2030', worth: 3 },
    { id: 'blade', spr: 'tiny_blade', hp: 46, dmg: 9, speed: 2.4, wash: '#7a1f2a', worth: 6 },
    { id: 'pike', spr: 'tiny_pike', hp: 62, dmg: 12, speed: 2.0, wash: '#5a1d3a', worth: 9 },
    { id: 'archer', spr: 'tiny_bow', hp: 34, dmg: 6, speed: 2.6, wash: '#4a2050', worth: 8, range: 4.5 }
  ];

  const DIFFS = [
    { id: 'steady', name: 'Steady', sub: 'A long first week. Raids build slowly.',
      raid: 0.72, day: 105, start: { wood: 150, stone: 80, clay: 40, iron: 20, gold: 0, coin: 60, food: 120, herb: 10 }, folk: 6 },
    { id: 'harsh', name: 'Harsh', sub: 'The intended balance. Fewer stores, sharper nights.',
      raid: 1, day: 90, start: { wood: 110, stone: 55, clay: 25, iron: 12, gold: 0, coin: 35, food: 80, herb: 5 }, folk: 5 },
    { id: 'bleak', name: 'Bleak', sub: 'Four settlers, a hall and the dark. Good luck.',
      raid: 1.45, day: 78, start: { wood: 80, stone: 35, clay: 15, iron: 6, gold: 0, coin: 20, food: 55, herb: 0 }, folk: 4 }
  ];

  /* Eight-way facing names, in the order the tiny_* rigs declare them, so an
     angle can be turned into a state name by indexing instead of branching. */
  const FACE = ['side', 'downright', 'down', 'downleft', 'left', 'upleft', 'up', 'upright'];
  const faceOf = (dx, dy) => {
    const a = Math.atan2(dy, dx);
    return FACE[((Math.round(a / (Math.PI / 4)) % 8) + 8) % 8];
  };

  const WIN_DAY = 12;                 // survive into the morning of day 12

  return { T, MW, MH, G, RES, RES_NAME, RES_COLOUR, RES_ICON, NODES, CATS, BUILD,
    byId, HALL, NAMES, RAIDER_KINDS, DIFFS, FACE, faceOf, WIN_DAY };
})();
