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
    // ---- Sci-fi / cyberpunk pack: marines, droids, machines, stations ----
    add("pf_scifi_sentinel", "Vanguard Sentinel", "Heroes", "Frontline rifleman in sealed plate — 19 states / 79 frames: six-beat walk and run on three facings, five-frame rifle fire, ready/parry/evade, hurt and death.", ["scifi","player","soldier","rifle","shooter"], () => PF.Scifi.sentinelSuite(), { w: 32, h: 32, featured: true });
    add("pf_scifi_trooper", "Shock Trooper", "Enemies", "Red-armoured breacher with a riot shield — 24 states / 113 frames: full locomotion, rifle fire, shield block, ready/parry/evade, hurt and death.", ["scifi","enemy","soldier","rifle","shield"], () => PF.Scifi.trooperSuite(), { w: 32, h: 32 });
    add("pf_scifi_netrunner", "Netrunner", "Heroes", "Neon-haired hacker with a dataspike blaster — 16 states / 71 frames: locomotion, blaster fire, holographic cast front and side, hurt and death.", ["scifi","cyberpunk","player","hacker","magic"], () => PF.Scifi.netrunnerSuite(), { w: 32, h: 32, featured: true });
    add("pf_scifi_engineer", "Field Engineer", "NPCs", "Welding-mask technician with a pipe wrench and an alloy pack — 19 states / 79 frames: locomotion, wrench strikes, ready/parry/evade, hurt and death.", ["scifi","npc","engineer","crafting"], () => PF.Scifi.engineerSuite(), { w: 32, h: 32 });
    add("pf_scifi_warden", "Security Droid", "Enemies", "Chrome humanoid sentry with a red optic bar — 16 states / 71 frames: stiff locomotion, blaster fire, ready/parry, hurt and death.", ["scifi","enemy","robot","droid"], () => PF.Scifi.wardenSuite(), { w: 32, h: 32 });
    add("pf_scifi_xenobrute", "Xeno Brute", "Enemies", "Four-clawed alien brawler — 14 states / 63 frames: crouched locomotion, four-directional claw rakes, hurt and death.", ["scifi","enemy","alien","melee"], () => PF.Scifi.xenobruteSuite(), { w: 32, h: 32 });
    add("pf_scifi_voidpriest", "Void Priest", "Enemies", "Hooded cultist of the void with a gravity staff — 16 states / 71 frames: locomotion, four-directional staff strikes, violet cast front and side, hurt and death.", ["scifi","enemy","magic","boss"], () => PF.Scifi.voidpriestSuite(), { w: 32, h: 32 });
    add("pf_scifi_drone", "Recon Drone", "Enemies", "Hovering quad-rotor scout — 5 states / 24 frames: floating idle, sweeping scan pulse, swooping strafe run, hurt rattle and a rotor-out death spiral.", ["scifi","enemy","flying","drone","robot"], () => PF.Scifi.droneSuite(), { w: 32, h: 32, featured: true });
    add("pf_scifi_turret", "Sentry Turret", "Enemies", "Bolted-down auto-turret — 4 states / 17 frames: scanning idle, five-frame firing cycle with muzzle flash and drifting smoke, hurt and a sparking wreck.", ["scifi","enemy","turret","trap"], () => PF.Scifi.turretSuite(), { w: 32, h: 32 });
    add("pf_scifi_mech", "Assault Mech", "Enemies", "Bipedal war walker — 5 states / 22 frames: idling pistons, six-frame stomp cycle with alternating treads, shoulder-cannon barrage, hurt and collapse.", ["scifi","enemy","boss","mech","walker"], () => PF.Scifi.mechSuite(), { w: 32, h: 32, featured: true });
    add("pf_scifi_fighter", "Hover Fighter", "World", "Top-down starfighter — 6 states / 26 frames: hover, banking left and right, thruster boost, cannon volley and a ring-burst death.", ["scifi","space","vehicle","shooter","top-down"], () => PF.Scifi.fighterSuite(), { w: 32, h: 32, featured: true });
    add("pf_scifi_asteroid", "Tumbling Asteroid", "World", "Space rock in three sizes with four-frame tumble — 4 states / 16 frames: large, medium, small and a shattering break burst.", ["scifi","space","prop","hazard"], () => PF.Scifi.asteroidSuite(), { w: 32, h: 32 });
    add("pf_scifi_tiles", "Sci-fi Hull Tileset", "World", "16 tiles on a 64x64 sheet: deck plates, riveted hatch, cross-seam floor, grime, vent grate, grill, hazard stripes, viewport, pipe run, cable trench, floor light, round hatch, wall, wall lamp, corner pillar and void.", ["scifi","tiles","tileset","cyberpunk"], () => PF.Scifi.tilesSuite(), { w: 64, h: 64, featured: true });
    add("pf_scifi_props", "Sci-fi Props", "World", "Eight station fixtures — 8 states / 24 frames: supply crate, fuel barrel, bubbling canister, console terminal, pipe cluster, comms antenna, two-stage blast door and a four-frame force field.", ["scifi","props","cyberpunk","interior"], () => PF.Scifi.propsSuite(), { w: 32, h: 32 });
    add("pf_scifi_items", "Sci-fi Items", "Items", "Seven pickups on one sheet: plasma cell, medkit, keycard, data chip, frag grenade, datapad and machine scrap.", ["scifi","items","pickup","loot"], () => PF.Scifi.itemsSuite(), { w: 32, h: 32 });
    add("pf_scifi_fx", "Sci-fi FX Pack", "FX", "Six rigged effects — 6 states / 24 frames: travelling laser bolt, plasma burst, shield impact, teleport column, EMP shockwave and impact sparks.", ["scifi","fx","particles","laser"], () => PF.Scifi.fxSuite(), { w: 32, h: 32, featured: true });

    // ---- Platformer pack: heroes, baddies, blocks, tiles, parallax ----
add("pf_plat_hero", "Plumber Hero", "Heroes", "Side-scrolling hero in denim overalls — 10 states / 40 frames: breathing idle, six-beat walk and run, a six-frame jump arc, fall, crouch, sword attack, hurt and death.", ["platformer","player","jump","run-and-jump"], () => PF.Platform.heroPlumber(), { w: 32, h: 32, featured: true });
    add("pf_plat_adventurer", "Jungle Adventurer", "Heroes", "Green-tunic explorer with a chest strap — 10 states / 40 frames: idle, walk, run, jump arc, fall, crouch, attack, hurt, death.", ["platformer","player","jump","explorer"], () => PF.Platform.heroAdventurer(), { w: 32, h: 32 });
    add("pf_plat_gunner", "Contra Gunner", "Heroes", "Bandana gunner with a sidearm — 10 states / 40 frames: locomotion, jump arc, fall, crouch, pistol attack with muzzle flash, hurt, death.", ["platformer","player","gun","shooter","jump"], () => PF.Platform.heroGunner(), { w: 32, h: 32 });
    add("pf_plat_walker", "Squash Walker", "Enemies", "Waddling two-foot baddie — 5 states / 15 frames: six-beat waddle, idle, a squash-and-flatten stomp, hurt and a pancake death.", ["platformer","enemy","walker","cute"], () => PF.Platform.walkerSuite(), { w: 32, h: 32, featured: true });
    add("pf_plat_flyer", "Cave Flyer", "Enemies", "Winged pest with a two-frame wing blur — 5 states / 18 frames: flap, glide, dive attack, hurt and a tumbling death spiral.", ["platformer","enemy","flying","cave"], () => PF.Platform.flyerSuite(), { w: 32, h: 32 });
    add("pf_plat_spitter", "Spitter Pod", "Enemies", "Snapping plant that lobs seeds — 4 states / 14 frames: swaying idle, a four-frame spit with visible projectiles, hurt and wilt death.", ["platformer","enemy","plant","turret"], () => PF.Platform.spitterSuite(), { w: 32, h: 32 });
    add("pf_plat_boss", "Stone Colossus", "Enemies", "Two-storey end-of-world boss — 5 states / 22 frames: pulsing core idle, five-frame overhead stomp, rock barrage, hurt and a crumbling collapse. Feet planted on the ground line throughout.", ["platformer","boss","boss-fight","rock"], () => PF.Platform.bossSuite(), { w: 32, h: 32, featured: true });
    add("pf_plat_hazards", "Platformer Hazards", "World", "Five animated hazards — 5 states / 15 frames: spike strip, six-frame spinning saw blade, five-frame flame jet, crumbling ledge and a spiked pit.", ["platformer","hazard","trap","deadly"], () => PF.Platform.hazardsSuite(), { w: 32, h: 32 });
    add("pf_plat_pickups", "Coins & Powerups", "Items", "Eight collectibles — 8 states / 20 frames: four-frame coin spin, floating gem, key, spinning star, heart, growth berry, checkpoint flag and a power flower.", ["platformer","pickup","coin","powerup"], () => PF.Platform.pickupsSuite(), { w: 32, h: 32, featured: true });
    add("pf_plat_blocks", "Blocks & Platforms", "World", "Eight level pieces — 8 states / 17 frames: brick, crumbling brick, pulsing question block, stone, four-frame bounce pad, ice, scrolling conveyor and ladder plus sand.", ["platformer","blocks","level","platform"], () => PF.Platform.blocksSuite(), { w: 32, h: 32, featured: true });
    add("pf_plat_tiles", "Platformer Tileset", "World", "16 tiles on a 64x64 sheet: grass, dirt, grass-to-dirt transition, cliff edge, stone, brick, water surface, deep water, sand, snow, planks, ladder, dark brick, moss, purple brick and void.", ["platformer","tiles","tileset","terrain"], () => PF.Platform.tilesSuite(), { w: 64, h: 64, featured: true });
    add("pf_plat_bg", "Parallax Backdrops", "World", "Five tileable 64x32 background layers — 5 states / 7 frames: sky gradient, three-frame drifting clouds, rolling hills, forest silhouette and a cave interior with glowshrooms.", ["platformer","background","parallax","skybox"], () => PF.Platform.bgSuite(), { w: 64, h: 32, featured: true });
    add("pf_plat_hud", "Platformer HUD", "UI", "Four 64x32 HUD plates — 4 states / 7 frames: coin counter with world label, three-stage health bar, boss health bar and a lives counter.", ["platformer","ui","hud","score"], () => PF.Platform.hudSuite(), { w: 64, h: 32, featured: true });
    // ---- Nature / ocean / space pack ----
add("pf_nature_trees", "Trees & Flora", "World", "Eight species with sway loops — 8 states / 16 frames: oak, pine, palm, dead snag, birch, willow, cactus and a flowering bush. Each sways on its own beat.", ["nature","flora","tree","decoration"], () => PF.Nature.treesSuite(), { w: 32, h: 32, featured: true });
    add("pf_nature_rocks", "Rocks & Ore", "World", "Six mineral props — 6 states / 9 frames: boulder, stacked cairn, gold vein, gem vein, iron vein and a pulsing geode.", ["nature","rock","mining","ore"], () => PF.Nature.rocksSuite(), { w: 32, h: 32 });
    add("pf_nature_critters", "Small Critters", "Animals", "Seven ground creatures — 7 states / 32 frames: bushy-tailed squirrel, hedgehog, mouse, fox, coiled snake, lizard and a beetle. Each has a four-beat scurry.", ["animal","critter","forest","wildlife"], () => PF.Nature.crittersSuite(), { w: 32, h: 32, featured: true });
    add("pf_nature_birds", "Birds", "Animals", "Crow, owl, gull and parrot on a four-frame wing cycle plus a perched crow — 5 states / 16 frames.", ["animal","bird","flying","forest"], () => PF.Nature.birdsSuite(), { w: 32, h: 32 });
    add("pf_nature_fish", "Fish", "World", "Eight swimmers with tail-sweep cycles — 8 states / 32 frames: guppy, clownfish, angelfish, pufferfish, eel, jellyfish, shark and crab.", ["animal","fish","water","ocean"], () => PF.Nature.fishSuite(), { w: 32, h: 32, featured: true });
    add("pf_ocean_reef", "Coral Reef", "World", "Six seabed props — 6 states / 21 frames: branching coral, swaying kelp, waving anemone, scallop shell, starfish and a bubbling thermal vent.", ["ocean","reef","coral","decoration"], () => PF.Nature.reefSuite(), { w: 32, h: 32, featured: true });
    add("pf_nature_biomes", "Biome Tilesets", "World", "Five complete 64x64 tilesets in one asset — 5 states / 5 frames: snowfield, desert, jungle, cave and volcanic. Each sheet carries the same 16-tile grammar (top, body, transition, edge, rock, brick, water, deep, sand, snow, timber, ladder, dark, moss, accent, void).", ["tiles","tileset","biome","terrain"], () => PF.Nature.biomesSuite(), { w: 64, h: 64, featured: true });
    add("pf_space_props", "Orbit Props", "World", "Seven space objects — 7 states / 25 frames: solar-panel satellite, rotating station, ringed planet, cratered moon, spiralling black hole, drifting nebula and a twinkling starfield.", ["space","prop","scifi","background"], () => PF.Nature.spacePropsSuite(), { w: 32, h: 32, featured: true });
    add("pf_space_capital", "Capital Ship", "World", "Side-view dreadnought — 4 states / 16 frames: holding station, engine burn, spinal cannon volley with a real beam, and a rolling turn.", ["space","vehicle","ship","boss","scifi"], () => PF.Nature.capitalSuite(), { w: 32, h: 32, featured: true });
    // ---- Urban / modern pack ----
add("pf_urban_tiles", "City Tileset", "World", "16 tiles on a 64x64 sheet: asphalt, two road markings, painted crossing, pavement, curb ramp, brick wall, lit window, wooden door, metal plating, manhole, storm drain, grass verge, hedge, concrete block and void.", ["urban","city","tiles","tileset","modern"], () => PF.Urban.tilesSuite(), { w: 64, h: 64, featured: true });
    add("pf_urban_props", "Street Furniture", "World", "Eleven street props — 11 states / 14 frames: hydrant, trash can, dumpster, bench, six-frame lamp with a lit beat, traffic light cycling red-amber-green, mailbox, phone booth, street sign, cone and a flower planter.", ["urban","props","street","modern"], () => PF.Urban.propsSuite(), { w: 32, h: 32, featured: true });
    add("pf_urban_vehicles", "City Traffic", "World", "Eight side-view vehicles with rolling wheels and suspension bob — 8 states / 16 frames: sedan, taxi, police cruiser with a strobe bar, van, bus, box truck, ambulance and a motorcycle.", ["urban","vehicle","car","traffic"], () => PF.Urban.vehiclesSuite(), { w: 32, h: 32, featured: true });
    add("pf_urban_people", "Pedestrians", "NPCs", "Six city pedestrians with blinking, breathing idles — 6 states / 24 frames: businessman, schoolkid, jogger, market vendor, police officer and a punk with a mohawk.", ["urban","npc","crowd","modern"], () => PF.Urban.peopleSuite(), { w: 32, h: 32, featured: true });
    add("pf_urban_hero", "Street Runner", "Heroes", "Hoodie-and-cap action hero packing a pistol and a rucksack — 16 states / 71 frames: three-facing locomotion, pistol fire, ready/parry/evade, hurt and death.", ["urban","player","pistol","modern"], () => PF.Urban.heroSuite(), { w: 32, h: 32, featured: true });
    add("pf_urban_vigilante", "Night Vigilante", "Heroes", "Masked vigilante with a glowing visor and a stun blaster — 16 states / 71 frames: locomotion, blaster fire, ready/parry/evade, hurt and death.", ["urban","player","boss","modern","hero"], () => PF.Urban.vigilanteSuite(), { w: 32, h: 32 });
    add("pf_urban_interiors", "Modern Interiors", "World", "Ten household fixtures — 10 states / 13 frames: desk, computer terminal, sofa, fridge, stove, television, shelf unit, four-frame ceiling fan and a rug.", ["urban","interior","props","furniture"], () => PF.Urban.interiorsSuite(), { w: 32, h: 32 });
    // ---- Horror / gothic pack ----
add("pf_horror_zombie", "Shambling Zombie", "Enemies", "Rot-green undead with a lolling jaw — 14 states / 63 frames: uneven crouched locomotion, four-directional claw rakes, hurt and a dither-fade death.", ["horror","enemy","zombie","undead"], () => PF.Horror.zombieSuite(), { w: 32, h: 32, featured: true });
    add("pf_horror_bloater", "Bloater", "Enemies", "Swelled corpse with a distended belly — 14 states / 63 frames: heavy locomotion, claw rakes, hurt and death.", ["horror","enemy","zombie","boss"], () => PF.Horror.bloaterSuite(), { w: 32, h: 32 });
    add("pf_horror_vampire", "Vampire Lord", "Enemies", "Cadaverous noble with a high collar cape and bat wings — 16 states / 71 frames: locomotion, claw strikes, blood cast front and side, hurt and death.", ["horror","enemy","boss","vampire","undead"], () => PF.Horror.vampireSuite(), { w: 32, h: 32, featured: true });
    add("pf_horror_ghoul", "Grave Ghoul", "Enemies", "Skull-faced scavenger in rags — 14 states / 63 frames: crouched locomotion, claw rakes, hurt and death.", ["horror","enemy","ghoul","undead"], () => PF.Horror.ghoulSuite(), { w: 32, h: 32 });
    add("pf_horror_witch", "Bog Witch", "Enemies", "Hunched crone with a plume hat and hex staff — 16 states / 71 frames: locomotion, staff strikes, sickly green cast front and side, hurt and death.", ["horror","enemy","witch","magic"], () => PF.Horror.witchSuite(), { w: 32, h: 32, featured: true });
    add("pf_horror_werewolf", "Werewolf", "Enemies", "Hunched wolf-beast — 5 states / 20 frames: prowl, lunging bite with an open jaw, head-back howl, hurt and a collapse.", ["horror","enemy","boss","werewolf","beast"], () => PF.Horror.werewolfSuite(), { w: 32, h: 32, featured: true });
    add("pf_horror_spirit", "Vengeful Spirit", "Enemies", "Floating sheet-wrapped apparition with a red gaze — 4 states / 12 frames: drifting float, reaching arms, a wail and an ordered-dither fade out.", ["horror","enemy","spirit","flying"], () => PF.Horror.spiritSuite(), { w: 32, h: 32, featured: true });
    add("pf_horror_tiles", "Gothic Tileset", "World", "16 tiles on a 64x64 sheet: flagstone, cracked slab, bloodstained stone, mossy bones, timber wall, panelled door, iron-barred window, stained-glass window, iron fence, grave slab floor, floorboards, red carpet, ritual circle, ossuary niche, swamp moss and void.", ["horror","tiles","tileset","gothic","dungeon"], () => PF.Horror.tilesSuite(), { w: 64, h: 64, featured: true });
    add("pf_horror_props", "Graveyard Props", "World", "Nine gothic props — 9 states / 21 frames: round, cross and slab gravestones, coffin, iron gate, stone altar, four-frame candle cluster, pulsing blood pool, sigil-lit pentagram and a dead tree.", ["horror","props","graveyard","gothic"], () => PF.Horror.propsSuite(), { w: 32, h: 32, featured: true });
    add("pf_horror_fx", "Dread FX Pack", "FX", "Six horror effects — 6 states / 24 frames: blood splat, running blood drip, drifting fog wall, forked lightning, ectoplasm burst and eyes in the dark.", ["horror","fx","blood","fog"], () => PF.Horror.fxSuite(), { w: 32, h: 32, featured: true });
    // ---- Farming / life-sim pack ----
add("pf_farm_crops", "Crop Growth Stages", "World", "Six crops with five growth stages each — 6 states / 30 frames: wheat, corn, pumpkin, tomato, carrot and sunflower, from sprout to ripe. Drive them by setting the frame index.", ["farm","crops","growth","life-sim"], () => PF.Farm.cropsSuite(), { w: 32, h: 32, featured: true });
    add("pf_farm_tools", "Farm Tools", "Items", "Eight hand tools: hoe, watering can, seed bag, sickle, pitchfork, bucket, milk pail and a bee smoker.", ["farm","tools","items"], () => PF.Farm.toolsSuite(), { w: 32, h: 32, featured: true });
    add("pf_farm_produce", "Produce & Goods", "Items", "Twelve sellable goods: apple, corn cob, pumpkin, tomato, carrot, wheat bundle, egg, milk bottle, cheese wheel, wool, honey jar and jam jar.", ["farm","items","food","loot"], () => PF.Farm.produceSuite(), { w: 32, h: 32, featured: true });
    add("pf_farm_soil", "Tilled Ground", "World", "16 tiles on a 64x64 sheet: grass, dry soil, three furrow states, watered dark soil, seedbed with sprouts, gravel path, two fence runs, fence corner, gate, hay pile, gravel, planter box, greenhouse pane, compost and void.", ["farm","tiles","tileset","soil"], () => PF.Farm.soilSuite(), { w: 64, h: 64 });
    add("pf_farm_buildings", "Farm Buildings", "World", "Ten structures — 10 states / 16 frames: red barn, silo, four-frame turning windmill, chicken coop, water tower, greenhouse, doghouse, farm mailbox, swaying scarecrow and a buzzing beehive.", ["farm","building","props","life-sim"], () => PF.Farm.buildingsSuite(), { w: 32, h: 32, featured: true });
    add("pf_farm_pets", "Barnyard Animals", "Animals", "Six animals with four-beat walks — 6 states / 24 frames: dog, cat, goat, goose, turkey and a drifting bee swarm plus a wing-flicking butterfly.", ["farm","animal","pet","wildlife"], () => PF.Farm.petsSuite(), { w: 32, h: 32, featured: true });
    // ---- VFX pack ----
add("pf_vfx_explosions", "Explosions", "FX", "Five six-frame blasts — 5 states / 30 frames: small hit, large blast, plasma burst, void tear and a toxic burst. Each grows on an ease-out, breaks into a ring and smokes out.", ["fx","explosion","impact","particles"], () => PF.Vfx.explosionsSuite(), { w: 32, h: 32, featured: true });
    add("pf_vfx_muzzle", "Muzzle Flashes", "FX", "Five weapon flashes — 5 states / 17 frames: pistol, rifle, shotgun cone, cannon with smoke and an energy discharge. Includes a short directional plume.", ["fx","gun","muzzle","shooter"], () => PF.Vfx.muzzleSuite(), { w: 32, h: 32, featured: true });
    add("pf_vfx_smoke", "Smoke & Clouds", "FX", "Five drifting volumes — 5 states / 23 frames: rising smoke puff, stomp dust cloud, steam vent, poison cloud and muzzle smoke.", ["fx","smoke","dust","ambient"], () => PF.Vfx.smokeSuite(), { w: 32, h: 32 });
    add("pf_vfx_impacts", "Impact FX", "FX", "Nine on-hit effects — 9 states / 30 frames: spark burst, metal hit with sparks, wood break, water splash, stone debris, glass shatter, blood splat, magic hit and a shield block.", ["fx","impact","hit","particles"], () => PF.Vfx.impactsSuite(), { w: 32, h: 32, featured: true });
    add("pf_vfx_beams", "Beams & Magic", "FX", "Seven cast effects — 7 states / 26 frames: laser beam, plasma beam, forked lightning, six-frame rotating magic circle, expanding shockwave, swirling portal and a heal glow.", ["fx","beam","magic","laser"], () => PF.Vfx.beamsSuite(), { w: 32, h: 32, featured: true });
    add("pf_vfx_ambient", "Ambient Motion", "FX", "Seven looping ambiences — 7 states / 27 frames: fog bank, rising embers, snow gust, falling leaves, bubble column, heat haze and rain splashes.", ["fx","ambient","weather","particles"], () => PF.Vfx.environmentSuite(), { w: 32, h: 32, featured: true });
    // ---- UI kit, fonts and autotile sets ----
add("pf_ui_font_5x7", "Bitmap Font 5x7", "UI", "The full 5x7 UI font as a 49x82 glyph sheet: A-Z, 0-9 and 33 punctuation marks. Also available live as PF.Font (text, wrap, align, shadow, outline, BMFont export).", ["ui","font","text","type"], () => PF.Ui.font5x7(), { w: 49, h: 82, featured: true });
    add("pf_ui_font_3x5", "Bitmap Font 3x5", "UI", "Micro 3x5 font as a 41x43 glyph sheet: caps, digits and punctuation that fit inside a 16px tile with room to spare.", ["ui","font","text","hud"], () => PF.Ui.font3x5(), { w: 41, h: 43 });
    add("pf_ui_panels", "9-Slice Panels", "UI", "Six 9-slice window frames on a 32x32 cell with a 4px border — stone, wood, metal, sci-fi, ornate and glass. Stretch the centre to any size.", ["ui","panel","9slice","window"], () => PF.Ui.panelsSuite(), { w: 32, h: 32, featured: true });
    add("pf_ui_buttons", "Button States", "UI", "Four button styles — stone, wood, sci-fi and ornate — each with four frames: normal, hover (lifted and brighter), pressed (sunk) and disabled (hatched).", ["ui","button","widget","menu"], () => PF.Ui.buttonsSuite(), { w: 32, h: 32, featured: true });
    add("pf_ui_gauges", "Gauges & Bars", "UI", "Six bars with five fill frames each — health, energy, segmented stamina, XP, boss and ammo. Frame index is the fill level.", ["ui","gauge","bar","hud"], () => PF.Ui.gaugesSuite(), { w: 32, h: 32, featured: true });
    add("pf_ui_cursors", "Cursors & Touch", "UI", "Eight input graphics — arrow pointer, hand, crosshair, sword cursor, four-frame loading spinner, D-pad, A/B buttons and a virtual joystick.", ["ui","cursor","touch","input"], () => PF.Ui.cursorsSuite(), { w: 32, h: 32 });
    add("pf_ui_icons", "Icon Set", "UI", "Sixteen 32px icons: sword, shield, potion, coin, key, map, quest scroll, save, load, sound, music, home, back, settings, close and star.", ["ui","icons","menu","hud"], () => PF.Ui.iconsSuite(), { w: 32, h: 32, featured: true });
    add("pf_ui_screens", "Screen Chrome", "UI", "Ten interface pieces: inventory slot, rare and epic slot frames, a 3x3 inventory grid, item tooltip, minimap frame with terrain, compass, dialog box, quest log and a floating action prompt.", ["ui","inventory","hud","menu"], () => PF.Ui.screensSuite(), { w: 32, h: 32, featured: true });
    add("pf_autotile_grass", "Autotile — Grass", "World", "A complete 16-tile grass edge set on a 64x64 sheet, generated from the neighbour mask: bit order N=1 E=2 S=4 W=8. Tiles butt together with no rim on a shared edge and a rounded lip everywhere else.", ["autotile","tiles","tileset","terrain","grass"], () => PF.Ui.autoTiles().grass(), { w: 64, h: 64, featured: true });
    add("pf_autotile_stone", "Autotile — Stone", "World", "16-tile stone floor edge set on a 64x64 sheet with the same N/E/S/W mask, ready for Tiled terrain painting or a runtime bitmask lookup.", ["autotile","tiles","tileset","dungeon"], () => PF.Ui.autoTiles().stone(), { w: 64, h: 64 });
    add("pf_autotile_road", "Autotile — Dirt Road", "World", "16-tile dirt-path set on a 64x64 sheet: lay it over grass and the mask draws the worn edge automatically.", ["autotile","tiles","tileset","path"], () => PF.Ui.autoTiles().road(), { w: 64, h: 64 });
    add("pf_autotile_water", "Autotile — Water (47-blob)", "World", "The full 47-tile blob set on a 128x96 sheet: edges AND concave corners, so a lake, a river bend and a single puddle all read correctly. Mask bit order N=1 E=2 S=4 W=8 NE=16 SE=32 SW=64 NW=128.", ["autotile","tiles","tileset","water","blob"], () => PF.Ui.autoTiles().water(), { w: 128, h: 96, featured: true });
    // ---- Tiny 16x16 pack ----
add("pf_tiny_hero", "Tiny Hero", "Heroes", "A 16x16 adventurer with the full action set — 5 states / 15 frames: breathing idle, four-beat walk, four-frame sword swing, hurt flash and a collapse. Feet stay on rows 14-15.", ["16x16","tiny","player","handheld"], () => PF.Tiny.heroSuite(), { w: 16, h: 16, featured: true });
    add("pf_tiny_foes", "Tiny Foes", "Enemies", "Six 16x16 baddies — 6 states / 16 frames: hopping slime, flapping bat, marching skeleton, drifting ghost, scuttling spider and a crowned blob boss.", ["16x16","tiny","enemy","handheld"], () => PF.Tiny.foesSuite(), { w: 16, h: 16, featured: true });
    add("pf_tiny_items", "Tiny Items", "Items", "Ten 16x16 pickups — 10 states / 14 frames: spinning coin, heart, key, potion, sword, shield, bomb, star, gem and a two-frame opening chest.", ["16x16","tiny","items","pickup"], () => PF.Tiny.itemsSuite(), { w: 16, h: 16, featured: true });
    add("pf_tiny_tiles", "Tiny Tiles", "World", "Four 16px tiles on a 32x32 sheet: grass, stone, water and planks — the minimum a 16px prototype needs before real level art exists.", ["16x16","tiny","tiles","tileset"], () => PF.Tiny.tilesSuite(), { w: 32, h: 32 });
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
  function docStats(id) {
    const hit = statsCache.get(id); if (hit !== undefined) return hit;
    const t = get(id); if (!t) return null;
    let r = null;
    try { const doc = t.build(); r = { states: doc.states.length, frames: countFrames(doc), width: doc.width, height: doc.height,
      stateNames: doc.states.map(s => s.name) }; } catch { r = null; }
    statsCache.set(id, r);
    return r;
  }

  return { list, get, categories, thumbnail, instantiate, docStats, countFrames,
    /* registerPack runs at boot, before anything is cached — clear defensively
       so a late-registered pack can never serve a stale stats entry. */
    registerPack: fn => { extraPacks.push(fn); statsCache.clear(); thumbCache.clear(); } };
})();
