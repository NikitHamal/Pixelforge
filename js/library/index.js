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
    add('goblin_rider', 'Goblin Boar-rider', 'Enemies', 'Charging goblin on a war boar: trot, lowered lance thrust with impact, hurt and death. Reuses the boar mount with a red war saddle.', ['enemy', 'mount', 'cavalry', 'goblin'], () => M().goblinRiderSuite(), { w: 32, h: 32, featured: true });
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
    add('rpg_knight', 'Knight', 'Heroes', 'Plate-armored sword & shield fighter — 15 states / 67 frames: idle & walk x3, six-frame run x3, four-directional sword arcs, shield block, hurt, death.', ['player', 'knight', 'rpg', 'tank'], () => RH().knightSuite(), { w: 32, h: 32, featured: true });
    add('rpg_ranger', 'Ranger', 'Heroes', 'Hooded archer — 14 states / 63 frames: idle & walk x3, run x3, five-frame bow draw & release on every facing, sneaky stride, hurt, death.', ['player', 'archer', 'rpg'], () => RH().rangerSuite(), { w: 32, h: 32 });
    add('rpg_cleric', 'Cleric', 'Heroes', 'Holy healer with circlet and staff — 16 states / 71 frames: idle & walk x3, run x3, four-directional strikes, radiant cast front & side, hurt, death.', ['player', 'healer', 'magic', 'rpg'], () => RH().clericSuite(), { w: 32, h: 32 });
    add('rpg_rogue', 'Rogue', 'Heroes', 'Shadowy hooded dagger fighter — 14 states / 63 frames: idle & walk x3, run x3, four-directional slashes, hurt, death.', ['player', 'assassin', 'rpg'], () => RH().rogueSuite(), { w: 32, h: 32 });
    add('rpg_townsfolk', 'Townsfolk Pack', 'NPCs', 'King, guard, blacksmith, elder, peasant and cook — blinking 4-frame idles, one state each.', ['npc', 'town', 'quest'], () => RH().townsfolkSuite(), { w: 32, h: 32 });
    add('rpg_goblin', 'Goblin Sneak', 'Enemies', 'Big-eared green skirmisher — 14 states / 63 frames: idle & walk x3, run x3, four-directional dagger slashes, hurt, dither-fade death.', ['enemy', 'forest', 'dungeon'], () => RF().goblinSuite(), { w: 32, h: 32 });
    add('rpg_necromancer', 'Necromancer', 'Enemies', 'Skull-faced dark caster — 16 states / 71 frames: idle & walk x3, run x3, four-directional strikes, shadow cast front & side, hurt, death.', ['enemy', 'boss', 'undead', 'magic'], () => RF().necromancerSuite(), { w: 32, h: 32 });
    add('rpg_demon', 'Horned Demon', 'Enemies', 'Winged brute with horns and tail — 14 states / 63 frames: idle & walk x3, run x3, four-directional heavy slashes, hurt, death.', ['enemy', 'boss', 'fire'], () => RF().demonSuite(), { w: 32, h: 32, featured: true });
    add('rpg_dragon', 'Red Dragon', 'Enemies', 'Flying boss: idle with smoke, 4-frame wing flap flight, growing fireball spit, hurt, collapse death.', ['enemy', 'boss', 'dragon', 'flying', 'fire'], () => RF().dragonSuite(), { w: 32, h: 32, featured: true });
    add('rpg_spider', 'Giant Spider', 'Enemies', 'Eight-legged crawler: breathing idle, alternating-gait crawl, rear-up lunge, web spit, hurt, death.', ['enemy', 'dungeon', 'cave'], () => RF().spiderSuite(), { w: 32, h: 32 });
    add('rpg_spiderling', 'Spiderling Swarm', 'Enemies', 'Pale-green hatchling on the same rig: fast skittering crawl, hop lunge, quick hurt and death. Spawn in packs.', ['enemy', 'dungeon', 'cave', 'swarm'], () => RF().spiderlingSuite(), { w: 32, h: 32 });
    add('rpg_spider_queen', 'Spider Queen', 'Enemies', 'Brood-mother boss: egg-laden abdomen, gold carapace marks, ring of eyes, heavy crawl, lunge and web spit.', ['enemy', 'boss', 'dungeon', 'cave'], () => RF().spiderQueenSuite(), { w: 32, h: 32, featured: true });
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
    add('rpg_paladin', 'Paladin', 'Heroes', 'Holy sword & shield champion — 17 states / 75 frames: idle & walk x3, run x3, four-directional strikes, shield block, radiant cast front & side, gold cape, sun circlet.', ['player', 'knight', 'holy', 'rpg', 'tank'], () => RE().paladinSuite(), { w: 32, h: 32, featured: true });
    add('rpg_druid', 'Druid', 'Heroes', 'Forest keeper with oak staff and thorn cast — 16 states / 71 frames: idle & walk x3, run x3, four-directional strikes, cast front & side, leaf hood, moss cape.', ['player', 'mage', 'nature', 'rpg'], () => RE().druidSuite(), { w: 32, h: 32 });
    add('rpg_lich', 'Lich Lord', 'Enemies', 'Undead skull-faced overlord — 16 states / 71 frames: crouched run x3, four-directional strikes, shadow staff cast front & side, dither-fade death.', ['enemy', 'boss', 'undead', 'magic'], () => RE().lichSuite(), { w: 32, h: 32 });
    add('rpg_ogre', 'Ogre Mauler', 'Enemies', 'Horned heavy bruiser with iron pauldrons — 14 states / 63 frames: idle & walk x3, run x3, four-directional axe sweeps, hurt, death.', ['enemy', 'boss', 'brute'], () => RE().ogreSuite(), { w: 32, h: 32 });
    add('rpg_campsite', 'Campsite Props', 'World', 'Canvas tent with swinging flap, waving war banner, anvil, bedroll, 4-frame bubbling cookpot, supply crate.', ['camp', 'decoration', 'props', 'survival'], () => RE().campsiteSuite(), { w: 32, h: 32 });
    add('rpg_trinkets', 'Trinkets', 'Items', 'Gold ring, amulet, mana orb, war horn, lantern, drum, flute, spirit mask.', ['gear', 'loot', 'equipment'], () => RE().trinketsSuite(), { w: 32, h: 32 });
    add('rpg_magic3', 'Battle Magic 3', 'FX', 'Holy smite beam, travelling shadow orb with implode, forked storm strike, rising vine grasp.', ['magic', 'effects', 'particles'], () => RE().magic3Suite(), { w: 32, h: 32, featured: true });
    // ---- RPG pack: classes 2, beasts, traps/furniture/weather ----
    const RC = () => R().classes, RB = () => R().beasts, RP = () => R().props;
    add('rpg_barbarian', 'Barbarian', 'Heroes', 'Fur-mantled axe brute — 14 states / 63 frames: idle, walk and run x3, four-directional axe arcs, hurt, death.', ['player', 'brute', 'rpg'], () => RC().barbarianSuite(), { w: 32, h: 32 });
    add('rpg_monk', 'Monk', 'Heroes', 'Shaven-headed staff master with a long white beard — 16 states / 71 frames: locomotion x3, four-directional strikes, chi cast front and side.', ['player', 'martial', 'rpg', 'magic'], () => RC().monkSuite(), { w: 32, h: 32 });
    add('rpg_bard', 'Bard', 'Heroes', 'Plumed hat, motley doublet and a lute — 16 states / 71 frames: locomotion x3, four-directional strums, sonic cast with sparkle particles.', ['player', 'support', 'rpg', 'music'], () => RC().bardSuite(), { w: 32, h: 32, featured: true });
    add('rpg_ninja', 'Ninja', 'Heroes', 'Indigo gi and crimson scarf with a silent crouched stride — 14 states / 63 frames: locomotion x3, four-directional blade arcs, hurt, death.', ['player', 'assassin', 'rpg', 'stealth'], () => RC().ninjaSuite(), { w: 32, h: 32 });
    add('rpg_bandit', 'Bandit', 'Enemies', 'Hooded green cutthroat with a sneak stride — 14 states / 63 frames: locomotion x3, four-directional slashes, hurt, death.', ['enemy', 'forest', 'rpg'], () => RC().banditSuite(), { w: 32, h: 32 });
    add('rpg_cultist', 'Cultist', 'Enemies', 'Crimson-robed zealot with a blood-red cast aura — 16 states / 71 frames: locomotion x3, four-directional strikes, cast front and side.', ['enemy', 'magic', 'rpg'], () => RC().cultistSuite(), { w: 32, h: 32 });
    add('rpg_minotaur', 'Minotaur', 'Enemies', 'Horned bull brute with scrap pauldrons — 14 states / 63 frames: locomotion x3, four-directional axe arcs, hurt, death.', ['enemy', 'boss', 'brute', 'rpg'], () => RC().minotaurSuite(), { w: 32, h: 32, featured: true });
    add('rpg_warlord', 'Warlord', 'Enemies', 'Blackened plate, horned helm and a crimson cape — 15 states / 67 frames: locomotion x3, four-directional axe arcs, shield block, hurt, death.', ['enemy', 'boss', 'rpg'], () => RC().warlordSuite(), { w: 32, h: 32 });
    add('rpg_animals', 'Farm & Forest Animals', 'Animals', 'Cow, sheep, pig, horse, rabbit and deer on a shared quadruped rig — 18 states / 72 frames: each gets a breathing idle, a four-beat walk and a head-down graze.', ['animal', 'farm', 'forest', 'survival'], () => RB().animalsSuite(), { w: 32, h: 32, featured: true });
    add('rpg_frog', 'Pond Frog', 'Animals', 'Squat green hopper — 5 states / 17 frames: resting idle, four-frame hop, throat-puffing croak, hurt and squash death.', ['animal', 'pond', 'nature'], () => RB().frogSuite(), { w: 32, h: 32 });
    add('rpg_duck', 'Duck', 'Animals', 'Waterfowl with a boat-shaped hull — 5 states / 17 frames: idle, waddling walk, glide, hurt and comical death.', ['animal', 'pond', 'farm'], () => RB().duckSuite(), { w: 32, h: 32 });
    add('rpg_wraith', 'Wraith', 'Enemies', 'Hooded spectre with a tattered hem and cold blue eyes — 5 states / 17 frames: floating idle, soul-drain cast, lunge, hurt, dither vanish.', ['enemy', 'undead', 'spirit', 'flying'], () => RB().wraithSuite(), { w: 32, h: 32 });
    add('rpg_gargoyle', 'Gargoyle', 'Enemies', 'Mossy stone sentinel — 5 states / 18 frames: crouched perch, wing-spread swoop, ground slam, hurt and a crumbling two-stage death.', ['enemy', 'dungeon', 'flying'], () => RB().gargoyleSuite(), { w: 32, h: 32 });
    add('rpg_imp', 'Imp', 'Enemies', 'Small winged nuisance with a barbed tail — 5 states / 18 frames: flapping idle, dart, hex spark, hurt and fade death.', ['enemy', 'fire', 'flying'], () => RB().impSuite(), { w: 32, h: 32 });
    add('rpg_traps', 'Dungeon Traps', 'World', 'Eight animated hazards on one sheet — 8 states / 26 frames: floor spikes, wall darts, pendulum blade, pressure plate, flame jet, bear trap, spike pit and swinging chain ball.', ['dungeon', 'trap', 'hazard'], () => RP().trapsSuite(), { w: 32, h: 32, featured: true });
    add('rpg_furniture', 'Interior Furniture', 'World', 'Ten pieces for houses, inns and keeps — 10 states / 10 frames: table, chair, bed, bookshelf, barrel, crate stack, clay pot, rug, candelabra and stool.', ['interior', 'decoration', 'props', 'town'], () => RP().furnitureSuite(), { w: 32, h: 32 });
    add('rpg_weather', 'Weather Overlays', 'FX', 'Eight full-tile ambient overlays — 8 states / 32 frames: rain, snow, lightning storm, stippled fog banks, falling leaves, drifting ash, fireflies and sandstorm.', ['weather', 'effects', 'ambient'], () => RP().weatherSuite(), { w: 32, h: 32, featured: true });
    // ---- Medieval RPG expansion pack ----
    const RM = () => R().medieval;
    add('rpg_crusader', 'Crusader', 'Heroes', 'Holy Knight of the Order — 16 states / 71 frames: greathelm with cross-slit visor, red St. George cross surcoat, flanged mace, kite shield, holy smite cast.', ['player', 'knight', 'holy', 'medieval', 'paladin'], () => RM().crusaderSuite(), { w: 32, h: 32, featured: true });
    add('rpg_valkyrie', 'Valkyrie', 'Heroes', 'Winged helm and spear champion — 16 states / 71 frames: silver plate cuirass, azure mantle, golden braids, celestial spear, divine ray cast.', ['player', 'warrior', 'valkyrie', 'spear', 'medieval'], () => RM().valkyrieSuite(), { w: 32, h: 32, featured: true });
    add('rpg_blacksmith', 'Blacksmith', 'NPCs', 'Artisan village weaponsmith — 16 states / 71 frames: leather work apron, thick dark beard, heavy smith hammer, forge spark strike cast.', ['npc', 'town', 'crafting', 'medieval'], () => RM().blacksmithSuite(), { w: 32, h: 32 });
    add('rpg_jester', 'Court Jester', 'NPCs', 'Royal palace entertainer — 16 states / 71 frames: three-pointed bell cap, motley quartered doublet, acrobat rapier, confetti trick magic.', ['npc', 'entertainer', 'town', 'medieval'], () => RM().jesterSuite(), { w: 32, h: 32, featured: true });
    add('rpg_executioner', 'Executioner', 'Enemies', 'Dread headsman — 15 states / 67 frames: deep black executioner hood with slit eyes, studded harness, gargantuan cleaving greataxe.', ['enemy', 'boss', 'dungeon', 'medieval'], () => RM().executionerSuite(), { w: 32, h: 32, featured: true });
    add('rpg_deathknight', 'Death Knight', 'Enemies', 'Unholy scourge champion — 16 states / 71 frames: spiked gothic helm with cyan runic gaze, frost runeblade, plague cast, tattered shroud.', ['enemy', 'boss', 'undead', 'medieval', 'knight'], () => RM().deathknightSuite(), { w: 32, h: 32, featured: true });
    add('rpg_warhorse', 'Armored Warhorse', 'Animals', 'Barded medieval destrier — 6 states / 24 frames: breathing idle, disciplined trot, full 6-frame battle gallop, majestic rear, hurt, death.', ['animal', 'mount', 'horse', 'medieval', 'knight'], () => RM().warhorseSuite(), { w: 32, h: 32, featured: true });
    add('rpg_griffin', 'Heraldic Griffin', 'Enemies', 'Legendary beast of crest and banner — 6 states / 22 frames: perched idle, predatory stalk, 4-frame flight flap cycle, razor talon dive attack, hurt, death.', ['enemy', 'boss', 'beast', 'flying', 'medieval'], () => RM().griffinSuite(), { w: 32, h: 32, featured: true });
    add('rpg_siege', 'Siege Engines', 'World', 'Medieval siege warfare machines — 5 states / 19 frames: heavy catapult rock throw, trebuchet fire shot, ballista bolt release, battering ram impact, archer mantlet.', ['siege', 'war', 'props', 'medieval'], () => RM().siegeSuite(), { w: 32, h: 32, featured: true });
    add('rpg_castle', 'Castle Keep', 'World', 'Medieval fortress and dungeon keep fixtures — 8 states / 27 frames: winched iron portcullis, roaring brazier, royal lion throne, armory weapon rack, pillory stocks, council war table, heraldic lion banner, wheel chandelier.', ['castle', 'interior', 'props', 'medieval'], () => RM().castleSuite(), { w: 32, h: 32, featured: true });
    // ---- Tiny Muster: original RTS-style squad (sword/spear/bow/friar/worker) ----
    const RT = () => R().tiny;
    add('tiny_blade', 'Tiny Blade', 'Heroes', 'Militia swordfighter with kettle helm and shield — 67 states / 324 frames: idle/walk/run/attack/ready/parry/evade/bash across all 8 facings, block, hurt, death.', ['militia', 'sword', 'rts', 'tiny'], () => RT().bladeSuite(), { w: 32, h: 32 });
    add('tiny_pike', 'Tiny Pike', 'Heroes', 'Defensive spear guard with morion helm — 67 states / 324 frames: eight-facing locomotion, spear thrusts, ready/parry/evade/bash, block, hurt, death.', ['spear', 'guard', 'rts', 'tiny'], () => RT().pikeSuite(), { w: 32, h: 32 });
    add('tiny_bow', 'Tiny Bow', 'Heroes', 'Hooded shortbow skirmisher — 59 states / 286 frames: eight-facing locomotion, six-frame draw with a held anchor and fast release, sneaky stride, ready/parry/evade, hurt, death.', ['archer', 'bow', 'rts', 'tiny'], () => RT().bowSuite(), { w: 32, h: 32 });
    add('tiny_friar', 'Tiny Friar', 'Heroes', 'Wool-robed healer with mend cast — 60 states / 288 frames: eight-facing locomotion, staff strikes, upright cast front and side, ready/parry/evade, hurt, death.', ['healer', 'monk', 'rts', 'tiny'], () => RT().friarSuite(), { w: 32, h: 32 });
    add('tiny_drudge', 'Tiny Drudge', 'NPCs', 'Worker pawn with hatchet chop and crate-carry loop — 59 states / 284 frames: idle/walk/run/attack/ready/parry/evade x8 facings, gather, carry, hurt, death.', ['worker', 'pawn', 'rts', 'tiny'], () => RT().drudgeSuite(), { w: 32, h: 32 });
    // ---- Life & Labour: original tool-action cycles (smith / farm / fish / climb) ----
    const RL = () => R().life;
    add('rpg_smith', 'Smith at the Anvil', 'NPCs', 'Five-frame hammer swing at a war anvil — raise, held windup, one fast strike landing the spark, rebound and settle. Plus a four-frame forge quench loop.', ['npc', 'crafting', 'smithing', 'anvil'], () => RL().smithSuite(), { w: 32, h: 32, featured: true });
    add('rpg_farmer', 'Farmer at Work', 'NPCs', 'Four distinct verbs, not one swing recoloured: till with a hoe and throw a clod, plant from a seed bag, water in an arcing stream, harvest with a sickle and puff the stubble.', ['npc', 'farming', 'town', 'tool'], () => RL().farmSuite(), { w: 32, h: 32, featured: true });
    add('rpg_fisher', 'Angler', 'NPCs', 'Eight-frame beat: wind up, cast, line settles, wait, rod jerks on the bite, two reels, fish held up. Bobber and splash sit at a fixed water point so the strike reads as a catch.', ['npc', 'fishing', 'town', 'water'], () => RL().fishSuite(), { w: 32, h: 32, featured: true });
    add('rpg_climber', 'Climber', 'NPCs', 'Five-frame hand-over-hand ascent that resets each cycle so it holds still against a scrolling wall. Legs are posed, not walked: a climb is the one action no sine gait fits.', ['npc', 'climbing', 'platform', 'rock'], () => RL().climbSuite(), { w: 32, h: 32 });
    add('rpg_rest', 'Resting Poses', 'NPCs', 'Seven seated states on a dedicated hip-anchored rig: stool, floor, knees-up, dozing nod, reclined toe-tap, drinking and a shocked emote. Breath drives head and torso on separate beats so every frame differs.', ['npc', 'idle', 'resting', 'sitting', 'emote'], () => RL().restSuite(), { w: 32, h: 32, featured: true });
    add('rpg_spear', 'Spear Combat', 'Enemies', 'Twelve polearm states across side/down/up: draw, combat-ready stance and step, slash, two thrusts, parry, evade, lunge, retreat, hit and knockdown. Thrusts drive the whole body forward, which is what sells reach.', ['enemy', 'spear', 'polearm', 'combat', 'guard'], () => RL().spearSuite(), { w: 32, h: 32, featured: true });
    // ---- Cross-genre production pack: sci-fi, modern, platformer, arcade ----
    const G = () => PF.Genres;
    add('nova_marine', 'Nova Marine', 'Heroes', 'Armored sci-fi trooper with idle, walk, run, jet dash, blaster attack, hurt and death cycles.', ['sci-fi', 'space', 'shooter', 'player', 'blaster'], () => G().marineSuite(), { w: 32, h: 32, featured: true });
    add('service_droid', 'Service Droid', 'NPCs', 'Readable utility robot with locomotion, field repair, blaster defense, damage and shutdown animations.', ['sci-fi', 'robot', 'npc', 'crafting'], () => G().robotSuite(), { w: 32, h: 32 });
    add('void_stalker', 'Void Stalker', 'Enemies', 'Bioluminescent alien hunter with predatory locomotion and a six-frame energy claw combo.', ['sci-fi', 'alien', 'enemy', 'melee'], () => G().alienSuite(), { w: 32, h: 32, featured: true });
    add('urban_survivor', 'Urban Survivor', 'Heroes', 'Contemporary scavenger with field gear, full locomotion and a weighty improvised melee attack.', ['modern', 'survival', 'zombie', 'player'], () => G().survivorSuite(), { w: 32, h: 32 });
    add('arcade_vehicles', 'Arcade Vehicles', 'World', 'Buggy, hovercraft and motorbike, each with animated idle and driving cycles for racing and action games.', ['vehicle', 'racing', 'arcade', 'sci-fi'], () => G().vehiclesSuite(), { w: 32, h: 32, featured: true });
    add('platform_runner', 'Platform Runner', 'Heroes', 'Platform-game protagonist with idle, eight-frame run, jump rise, fall, wall slide and dash.', ['platformer', 'player', 'runner', 'metroidvania'], () => G().platformerSuite(), { w: 32, h: 32, featured: true });
    add('cyber_tiles', 'Cyber Facility Tiles', 'World', 'Animated 4x4 tile sheet with metal decking, energy conduits, machinery and starfield panels.', ['tiles', 'sci-fi', 'cyberpunk', 'environment'], () => G().cyberTilesSuite(), { w: 64, h: 64, featured: true });
    add('scifi_projectiles', 'Sci-Fi Projectiles', 'FX', 'Plasma, laser, rocket, electric, acid and shield-impact effects with six-frame motion cycles.', ['sci-fi', 'effects', 'projectile', 'combat'], () => G().projectilesSuite(), { w: 32, h: 32 });
    add('scifi_interface', 'Sci-Fi Interface', 'UI', 'Animated HUD, warning panel, target reticle and radar components for futuristic games.', ['sci-fi', 'ui', 'hud', 'interface'], () => G().sciFiUISuite(), { w: 32, h: 32 });
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
     Simpler: hub uses thumbnail + frame count badge; studio preview on open.
     Memoised: docStats() builds the whole sprite doc, and the hub calls it for
     every visible template on every list render (and again next to tplDoc),
     so the uncached form re-generated the entire library twice per paint. */
  const statsCache = new Map();
  const renderDocCache = new Map();
  function docStats(id) {
    const hit = statsCache.get(id); if (hit !== undefined) return hit;
    const t = get(id); if (!t) return null;
    let r = null;
    try { const doc = t.build(); r = { states: doc.states.length, frames: countFrames(doc), width: doc.width, height: doc.height,
      stateNames: doc.states.map(s => s.name) }; } catch { r = null; }
    statsCache.set(id, r);
    return r;
  }

  /* Headless game-facing render API. It avoids Store, DOM and canvas entirely,
     making built-in assets usable from game loops, workers and Node tooling.
     State may be an index or exact name; frame indices wrap for animation. */
  function render(id, { state = 0, frame = 0, palette, out, scratch } = {}) {
    const t = get(id); if (!t) throw new Error(`Unknown template "${id}"`);
    let d = renderDocCache.get(id);
    if (!d) { d = t.build(); renderDocCache.set(id, d); }
    const si = typeof state === 'string' ? d.states.findIndex(s => s.name === state) : Number(state);
    if (!Number.isInteger(si) || si < 0 || si >= d.states.length) throw new RangeError(`Unknown state "${state}" for ${id}`);
    const frameNo = Number(frame);
    if (!Number.isInteger(frameNo)) throw new RangeError(`Frame must be an integer, received "${frame}"`);
    const st = d.states[si], fi = (frameNo % st.frames.length + st.frames.length) % st.frames.length, fr = st.frames[fi];
    const target = out || new Uint32Array(d.width * d.height);
    if (!(target instanceof Uint32Array) || target.length !== d.width * d.height) throw new RangeError(`render output must be Uint32Array(${d.width * d.height})`);
    target.fill(0);
    const painters = fr.layers || [fr.paint], work = scratch || new Uint32Array(target.length);
    if (!(work instanceof Uint32Array) || work.length !== target.length || work === target) throw new RangeError(`render scratch must be a distinct Uint32Array(${target.length})`);
    for (const painter of painters) {
      work.fill(0); if (typeof painter === 'function') painter(work, d.width, d.height); else if (painter) work.set(painter);
      for (let i = 0; i < target.length; i++) if (work[i]) target[i] = target[i] ? PF.Color.blend(target[i], work[i]) : work[i];
    }
    if (palette) PF.Raster.remapPalette(target, palette, target);
    return { pixels: target, width: d.width, height: d.height, state: st.name, frame: fi, duration: fr.duration, fps: st.fps, loop: st.loop };
  }

  /* Indexed catalogue discovery for editor search, agent tools and games.
     All filters compose; query matches id, name, description and tags. */
  function query({ text = '', category, tags = [], featured, width, height } = {}) {
    const needle = String(text).trim().toLowerCase(), wanted = Array.isArray(tags) ? tags : [tags];
    return list().filter(t => {
      if (category && category !== 'All' && t.category !== category) return false;
      if (featured !== undefined && !!t.featured !== !!featured) return false;
      if (width !== undefined && t.w !== +width) return false;
      if (height !== undefined && t.h !== +height) return false;
      if (wanted.length && !wanted.every(tag => t.tags.includes(tag))) return false;
      return !needle || [t.id, t.name, t.desc, ...t.tags].join(' ').toLowerCase().includes(needle);
    });
  }

  return { list, get, categories, query, render, thumbnail, instantiate, docStats, countFrames,
    /* registerPack runs at boot, before anything is cached — clear defensively
       so a late-registered pack can never serve a stale stats entry. */
    registerPack: fn => { extraPacks.push(fn); statsCache.clear(); renderDocCache.clear(); thumbCache.clear(); } };
})();
