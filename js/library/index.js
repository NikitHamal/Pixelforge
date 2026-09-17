/* PixelForge Studio — Template registry: every built-in game asset.
   Each template builds deterministic DocData (no Store side effects), so hub
   thumbnails render without touching the open project. instantiate() loads
   the template as a brand-new project and opens the studio. */
window.PF = window.PF || {};
PF.Library = (() => {
  const T = [];
  const add = (id, name, category, desc, tags, build, opts = {}) => {
    T.push({ id, name, category, desc, tags: tags || [], build, ...opts });
    return id;
  };

  // External one-shot packs (e.g. chatbot-authored files loaded AFTER index.js)
  // call PF.Library.registerPack(add => add('id', 'Name', 'Cat', 'desc', ['tags'], () => Suite(), { w: 32, h: 32 }))
  const extraPacks = [];
  function registerAll() {
    if (T.length) return T;
    const H = () => PF.Chars, M = () => PF.Monsters, W = () => PF.World, I = () => PF.Items, R = () => PF.RPG;
    // Heroes — full suites for roguelike / survival games
    add('hero_male', 'Hero — Male', 'Heroes', '23 states · 90+ frames: idle/walk/run/jump/dash, sword ×2, bow, pickaxe, axe, shield block, cheer, hurt, death, sleep, eat, sit, pickup, cast.', ['player', 'knight', 'rpg', 'survival', 'roguelike'], () => H().heroSuite(H().MALE, 'hero-male'), { w: 32, h: 32, featured: true });
    add('hero_female', 'Hero — Female', 'Heroes', 'Same 23-state suite with long hair, bow tie, tunic palette and full action set.', ['player', 'ranger', 'rpg'], () => H().heroSuite(H().FEMALE, 'hero-female'), { w: 32, h: 32, featured: true });
    add('hero_wizard', 'Archmage Wizard', 'Heroes', 'Pointed hat, flowing robe and beard: idle, walk, staff arcane aura, fireball surge, teleport blink.', ['player', 'mage', 'magic', 'rpg'], () => H().wizardSuite(H().WIZARD, 'hero-wizard'), { w: 32, h: 32, featured: true });
    add('villager_m', 'Villager — Male', 'NPCs', 'Idle, walk ×2, talk, sit, sleep. Townsfolk for quests and shops.', ['npc', 'town'], () => H().monsterSuite(H().VILLAGER_M, 'villager-m'), { w: 32, h: 32 });
    add('villager_f', 'Villager — Female', 'NPCs', 'Idle, walk ×2, talk, sit, sleep with long-hair variant.', ['npc', 'town'], () => H().monsterSuite(H().VILLAGER_F, 'villager-f'), { w: 32, h: 32 });
    add('merchant', 'Merchant', 'NPCs', 'Robed trader with wide-brim hat. Idle, walk, bow, hurt, death.', ['npc', 'shop'], () => H().monsterSuite(H().MERCHANT, 'merchant'), { w: 32, h: 32 });
    // Enemies
    add('skeleton', 'Skeleton Warrior', 'Enemies', 'Undead swordsman: idle, walk ×2, sword attack, hurt, bone-scatter death.', ['undead', 'dungeon'], () => H().monsterSuite(H().SKELETON, 'skeleton'), { w: 32, h: 32, featured: true });
    add('orc', 'Orc Brute', 'Enemies', 'Green bruiser with tusks and shoulder pads. Full 6-state combat suite.', ['enemy', 'dungeon'], () => H().monsterSuite(H().ORC, 'orc'), { w: 32, h: 32 });
    add('drake', 'Baby Drake', 'Enemies', 'Miniature dragon: idle hover, wing flap, fire breath attack, sleep, hurt.', ['enemy', 'dragon', 'flying', 'boss'], () => M().drakeSuite(), { w: 32, h: 32, featured: true });
    add('slime', 'Slime', 'Enemies', 'Squash & stretch blob: idle, walk, jump, hurt, melting death.', ['enemy', 'cute'], () => M().slimeSuite(), { w: 32, h: 32, featured: true });
    add('bat', 'Cave Bat', 'Enemies', 'Flapping fly cycle, hurt flash, grounded death.', ['enemy', 'flying'], () => M().batSuite(), { w: 32, h: 32 });
    add('ghost', 'Ghost', 'Enemies', 'Sine-wave float, wavy hem, vanish fade-out.', ['enemy', 'undead', 'flying'], () => M().ghostSuite(), { w: 32, h: 32 });
    add('mushroom', 'Mushroomling', 'Enemies', 'Bouncy cap creature: idle, waddle walk, hurt, squash death.', ['enemy', 'forest'], () => M().mushroomSuite(), { w: 32, h: 32 });
    add('golem', 'Stone Golem', 'Enemies', 'Heavy rock brute with crystal core, moss and crack detail.', ['enemy', 'boss'], () => M().golemSuite(), { w: 32, h: 32 });
    add('wolf', 'Dire Wolf', 'Animals', 'Quadruped gallop cycle, lunge attack, hurt and death.', ['animal', 'mount', 'forest'], () => M().wolfSuite(), { w: 32, h: 32 });
    add('boar', 'Wild Boar', 'Animals', 'Trot, charge with tusk thrust, dust kick, hurt and comical death.', ['animal', 'forest', 'survival'], () => M().boarSuite(), { w: 32, h: 32, featured: true });
    add('chicken', 'Chicken', 'Animals', 'Hop walk, wing flap, peck and comical death. Survival food source.', ['animal', 'farm'], () => M().chickenSuite(), { w: 32, h: 32 });
    // World
    add('tileset', 'Starter Tileset 4×4', 'World', '16 tiles on a 64×64 sheet: grass, flowers, dirt, stone, brick, planks, sand, lava, ice, fence, water edge + more.', ['tiles', 'grass', 'dungeon'], () => W().tilesetSuite(), { w: 64, h: 64, featured: true });
    add('water', 'Animated Water', 'World', '4-frame flowing water with sine wave bands and sparkles.', ['tiles', 'water'], () => W().waterSuite(), { w: 32, h: 32 });
    add('flora', 'Trees & Props', 'World', 'Oak, pine, bush, flowers and grass tuft with swaying 2-4 frame idle loops (plus a very still rock).', ['nature', 'decoration'], () => W().floraSuite(), { w: 32, h: 32 });
    add('crystal', 'Magic Crystal Node', 'World', '4-frame glowing amethyst core pulse, pickaxe fracture and gem shatter.', ['magic', 'mining', 'props'], () => W().crystalSuite(), { w: 32, h: 32, featured: true });
    add('campfire', 'Campfire', 'World', '4-frame flickering fire with logs, stone ring and rising sparks.', ['light', 'survival'], () => W().campfireSuite(), { w: 32, h: 32 });
    add('torch', 'Torch', 'World', '4-frame wall torch flame for dungeons and caves.', ['light', 'dungeon'], () => W().torchSuite(), { w: 32, h: 32 });
    add('chest', 'Treasure Chest', 'World', 'Closed idle + 4-frame lid-open burst with gold sparkles.', ['loot', 'dungeon'], () => W().chestSuite(), { w: 32, h: 32 });
    add('door', 'Dungeon Door', 'World', 'Closed + opening states with glowing passage.', ['dungeon'], () => W().doorSuite(), { w: 32, h: 32 });
    add('portal', 'Portal', 'World', '4-frame swirling magic gate with stone pillars.', ['magic', 'fast-travel'], () => W().portalSuite(), { w: 32, h: 32 });
    // Items & FX
    add('weapons', 'Weapons Rack', 'Items', 'Sword, pickaxe, axe, bow, shield, staff, arrow and bomb — one state each.', ['gear', 'tools'], () => I().weaponsSuite(), { w: 32, h: 32, featured: true });
    add('consumables', 'Potions & Food', 'Items', '4 potions + apple, bread, meat, carrot, cheese, key, heart, wood, stone.', ['food', 'loot', 'survival'], () => I().consumablesSuite(), { w: 32, h: 32 });
    add('coin_gem', 'Coin & Gem', 'Items', '6-frame gold spin + 4-frame floating gem with sparkles.', ['currency', 'pickup'], () => I().coinSuite(), { w: 32, h: 32 });
    add('spells', 'Magic Spells Pack', 'FX', 'Flying fireball + burst, downward lightning bolt, expanding ice nova, divine shield.', ['magic', 'effects', 'particles'], () => I().spellsSuite(), { w: 32, h: 32, featured: true });
    add('fx', 'Combat FX Pack', 'FX', 'Slash arcs, hit sparks, dust puffs, level-up burst and heal crosses.', ['effects', 'particles'], () => I().fxSuite(), { w: 32, h: 32, featured: true });
    add('hud', 'HUD Hearts & Bars', 'UI', '5/3/1/0 HP heart rows plus stamina and XP bars.', ['ui', 'hud'], () => I().heartsSuite(), { w: 32, h: 32 });
    // ---- RPG pack: classes, foes, world, gear ----
    const RH = () => R(), RF = () => R().foes, RW = () => R().world, RI = () => R().items, RE = () => R().expand;
    add('rpg_knight', 'Knight', 'Heroes', 'Plate-armored sword & shield fighter: idle/walk x3, sword slash, shield block, hurt, death.', ['player', 'knight', 'rpg', 'tank'], () => RH().knightSuite(), { w: 32, h: 32, featured: true });
    add('rpg_ranger', 'Ranger', 'Heroes', 'Hooded archer: idle/walk x3, 5-frame bow draw & release, sneaky stride, hurt, death.', ['player', 'archer', 'rpg'], () => RH().rangerSuite(), { w: 32, h: 32 });
    add('rpg_cleric', 'Cleric', 'Heroes', 'Holy healer with circlet and staff: idle/walk x3, radiant cast, hurt, death.', ['player', 'healer', 'magic', 'rpg'], () => RH().clericSuite(), { w: 32, h: 32 });
    add('rpg_rogue', 'Rogue', 'Heroes', 'Shadowy hooded dagger fighter: idle/walk x3, quick slash, hurt, death.', ['player', 'assassin', 'rpg'], () => RH().rogueSuite(), { w: 32, h: 32 });
    add('rpg_townsfolk', 'Townsfolk Pack', 'NPCs', 'King, guard, blacksmith, elder, peasant and cook — blinking 4-frame idles, one state each.', ['npc', 'town', 'quest'], () => RH().townsfolkSuite(), { w: 32, h: 32 });
    add('rpg_goblin', 'Goblin Sneak', 'Enemies', 'Big-eared green skirmisher: idle/walk x3, dagger slash, hurt, dither-fade death.', ['enemy', 'forest', 'dungeon'], () => RF().goblinSuite(), { w: 32, h: 32 });
    add('rpg_necromancer', 'Necromancer', 'Enemies', 'Skull-faced dark caster: idle/walk x3, shadow cast, hurt, death.', ['enemy', 'boss', 'undead', 'magic'], () => RF().necromancerSuite(), { w: 32, h: 32 });
    add('rpg_demon', 'Horned Demon', 'Enemies', 'Winged brute with horns and tail: idle/walk x3, heavy slash, hurt, death.', ['enemy', 'boss', 'fire'], () => RF().demonSuite(), { w: 32, h: 32, featured: true });
    add('rpg_dragon', 'Red Dragon', 'Enemies', 'Flying boss: idle with smoke, 4-frame wing flap flight, growing fireball spit, hurt, collapse death.', ['enemy', 'boss', 'dragon', 'flying', 'fire'], () => RF().dragonSuite(), { w: 32, h: 32, featured: true });
    add('rpg_spider', 'Giant Spider', 'Enemies', 'Eight-legged crawler: breathing idle, alternating-gait crawl, rear-up lunge, hurt, death.', ['enemy', 'dungeon', 'cave'], () => RF().spiderSuite(), { w: 32, h: 32 });
    add('rpg_mimic', 'Mimic Chest', 'Enemies', 'Treacherous chest: breathing lid, 4-stage teeth snap with tongue lash, coin-spilling death.', ['enemy', 'trap', 'dungeon', 'loot'], () => RF().mimicSuite(), { w: 32, h: 32 });
    add('rpg_wisp', 'Will-o-Wisp', 'Enemies', 'Flickering flame spirit: idle, stretch dash with afterimage, spark burst, vanish fade.', ['enemy', 'spirit', 'forest', 'flying'], () => RF().wispSuite(), { w: 32, h: 32 });
    add('rpg_slime_king', 'Slime King', 'Enemies', 'Crowned royal blob: squash idle, hop, ground-slam shockwave, melting crown-drop death.', ['enemy', 'boss', 'cute'], () => RF().slimeKingSuite(), { w: 32, h: 32 });
    add('rpg_ent', 'Ancient Ent', 'Enemies', 'Living tree guardian: leaf-sway idle, root stomp, branch slam shockwave, leaf-burst death.', ['enemy', 'boss', 'forest', 'nature'], () => RF().entSuite(), { w: 32, h: 32 });
    add('rpg_dungeon_tiles', 'Dungeon Tileset', 'World', '16 tiles on a 64x64 sheet: stone, cracked, mossy, rune floor, bricks, pillar, lava, water, stairs, spikes, grate, bones, carpet, void, carved.', ['tiles', 'dungeon'], () => RW().dungeonTilesSuite(), { w: 64, h: 64, featured: true });
    add('rpg_village', 'Village Props', 'World', 'Cottage with chimney smoke, well, market stall, signpost, flickering lamp, 4-frame fountain.', ['town', 'decoration', 'props'], () => RW().villageSuite(), { w: 32, h: 32 });
    add('rpg_dungeon_props', 'Dungeon Props', 'World', 'Pillars, candle altar, sarcophagus, bones, swaying chains, iron door, statue, glowshrooms, throne.', ['dungeon', 'decoration', 'props'], () => RW().dungeonPropsSuite(), { w: 32, h: 32 });
    add('rpg_savepoint', 'Rune Savepoint', 'World', 'Glowing monolith with sequential runes, floating crystal, idle pulse + activation burst.', ['magic', 'checkpoint', 'props'], () => RW().savepointSuite(), { w: 32, h: 32 });
    add('rpg_waterfall', 'Waterfall', 'World', '4-frame scrolling falls with cliff ledges, foam basin and drifting mist.', ['tiles', 'water', 'nature'], () => RW().waterfallSuite(), { w: 32, h: 32 });
    add('rpg_lava', 'Lava Pool', 'World', '4-frame bubbling lava: glowing cracks, rising bubbles, drifting embers.', ['tiles', 'fire', 'dungeon'], () => RW().lavaSuite(), { w: 32, h: 32 });
    add('rpg_armor', 'Armor Rack', 'Items', 'Knight helm, hood, wizard hat, crown, plate, leather, robe, boots, cape, round shield.', ['gear', 'equipment'], () => RI().armorSuite(), { w: 32, h: 32 });
    add('rpg_arsenal', 'Arsenal', 'Items', 'Greatsword, katana, dagger, spear, warhammer, crossbow, wand, mace, bomb, arrows.', ['gear', 'weapons'], () => RI().arsenalSuite(), { w: 32, h: 32, featured: true });
    add('rpg_loot', 'Loot Hoard', 'Items', 'Coin pile, gems, money bag, scroll, spellbook, treasure map, elixir, feather, fang, ore, ingot, herb.', ['loot', 'pickup', 'currency'], () => RI().lootSuite(), { w: 32, h: 32 });
    add('rpg_status', 'Status Icons', 'UI', 'Twelve 16px RPG status icons: burn, poison, frozen, stun, sleep, regen, shield, attack/defense up, haste, curse, paralysis.', ['ui', 'icons', 'buffs'], () => RI().statusSuite(), { w: 32, h: 32 });
    add('rpg_magic2', 'Battle Magic 2', 'FX', 'Tornado, meteor impact, heal beam, summon circle, 5-frame explosion, frost shards, poison cloud.', ['magic', 'effects', 'particles'], () => RI().magic2Suite(), { w: 32, h: 32, featured: true });
    add('rpg_ui', 'RPG UI Chrome', 'UI', 'Dialog box, button x3 states, cursor, bouncing arrow, coin/lock/skull icons, twinkling star.', ['ui', 'menu', 'hud'], () => RI().uiSuite(), { w: 32, h: 32 });
    add('rpg_paladin', 'Paladin', 'Heroes', 'Holy sword & shield champion with radiant cast: full 10-state suite, white cape, sun circlet.', ['player', 'knight', 'holy', 'rpg', 'tank'], () => RE().paladinSuite(), { w: 32, h: 32, featured: true });
    add('rpg_druid', 'Druid', 'Heroes', 'Forest keeper with oak staff and thorn cast: full 9-state suite, leaf hood, moss cape.', ['player', 'mage', 'nature', 'rpg'], () => RE().druidSuite(), { w: 32, h: 32 });
    add('rpg_lich', 'Lich Lord', 'Enemies', 'Undead skull-faced overlord: sneaky stride, shadow staff cast, dither-fade death.', ['enemy', 'boss', 'undead', 'magic'], () => RE().lichSuite(), { w: 32, h: 32 });
    add('rpg_ogre', 'Ogre Mauler', 'Enemies', 'Horned heavy bruiser with iron pauldrons and a sweeping axe: full combat suite.', ['enemy', 'boss', 'brute'], () => RE().ogreSuite(), { w: 32, h: 32 });
    add('rpg_campsite', 'Campsite Props', 'World', 'Canvas tent with swinging flap, waving war banner, anvil, bedroll, 4-frame bubbling cookpot, supply crate.', ['camp', 'decoration', 'props', 'survival'], () => RE().campsiteSuite(), { w: 32, h: 32 });
    add('rpg_trinkets', 'Trinkets', 'Items', 'Gold ring, amulet, mana orb, war horn, lantern, drum, flute, spirit mask.', ['gear', 'loot', 'equipment'], () => RE().trinketsSuite(), { w: 32, h: 32 });
    add('rpg_magic3', 'Battle Magic 3', 'FX', 'Holy smite beam, travelling shadow orb with implode, forked storm strike, rising vine grasp.', ['magic', 'effects', 'particles'], () => RE().magic3Suite(), { w: 32, h: 32, featured: true });
    extraPacks.forEach(fn => { try { fn(add); } catch (e) { console.warn('pack failed', e); } });
    return T;
  }

  const list = () => { registerAll(); return T; };
  const get = id => { registerAll(); return T.find(t => t.id === id); };
  const categories = () => ['All', 'Featured', 'Heroes', 'Enemies', 'NPCs', 'Animals', 'World', 'Items', 'FX', 'UI'];
  const countFrames = doc => doc.states.reduce((n, s) => n + s.frames.length, 0);

  /* Render first frame of first state to dataURL (cached). Pure — never touches Store. */
  const thumbCache = new Map();
  function thumbnail(id, scale = 3) {
    if (thumbCache.has(id + '@' + scale)) return thumbCache.get(id + '@' + scale);
    const t = get(id); if (!t) return '';
    try {
      const doc = t.build(), st = doc.states[0], fr = st.frames[0];
      const cv = document.createElement('canvas'); cv.width = doc.width; cv.height = doc.height;
      const ctx = cv.getContext('2d'), img = ctx.createImageData(doc.width, doc.height);
      const out = new Uint32Array(img.data.buffer);
      // composite single layer (library docs are single-layer; support N layers generically)
      out.fill(0);
      const layers = doc.layers.map((l, li) => fr.layers ? fr.layers[li] : fr.paint);
      // paint each layer into temp then blend — layers are opaque drawings; simple over-write composite:
      const tmp = new Uint32Array(doc.width * doc.height);
      layers.forEach(painter => {
        tmp.fill(0);
        if (typeof painter === 'function') painter(tmp, doc.width, doc.height);
        else if (painter) tmp.set(painter);
        for (let i = 0; i < out.length; i++) if (tmp[i]) out[i] = out[i] ? PF.Color.blend(out[i], tmp[i]) : tmp[i];
      });
      ctx.putImageData(img, 0, 0);
      const out2 = document.createElement('canvas'); out2.width = doc.width * scale; out2.height = doc.height * scale;
      const octx = out2.getContext('2d'); octx.imageSmoothingEnabled = false;
      octx.drawImage(cv, 0, 0, out2.width, out2.height);
      const url = out2.toDataURL('image/png');
      thumbCache.set(id + '@' + scale, url);
      return url;
    } catch (e) { console.warn('thumb failed', id, e); return ''; }
  }

  /* Studio page path relative to the current page (root, /app, or studio itself) */
  function studioURL(pid) {
    let base = '';
    try {
      const p = location.pathname || '';
      base = /\/app\//.test(p) ? '../' : '';
    } catch {}
    return base + 'studio.html?project=' + pid;
  }
  /* Build + open as a new project. Returns project id. */
  function instantiate(id, { openStudio = true } = {}) {
    const t = get(id); if (!t) throw new Error('Unknown template "' + id + '"');
    const doc = t.build();
    const pid = PF.Projects.instantiateDocData(doc, t.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'));
    PF.Projects.setOpenId(pid);
    let onStudio = false;
    try { onStudio = /studio\.html/.test(location.pathname || ''); } catch {}
    if (openStudio && !onStudio) {
      try { location.href = studioURL(pid); } catch {}
    }
    return pid;
  }

  /* Animated preview: returns { canvases } — hub animates via rAF over state frames.
     Simpler: hub uses thumbnail + frame count badge; studio preview on open. */
  function docStats(id) {
    const t = get(id); if (!t) return null;
    try { const doc = t.build(); return { states: doc.states.length, frames: countFrames(doc), width: doc.width, height: doc.height,
      stateNames: doc.states.map(s => s.name) }; } catch { return null; }
  }

  return { list, get, categories, thumbnail, instantiate, docStats, countFrames,
    registerPack: fn => extraPacks.push(fn) };
})();
