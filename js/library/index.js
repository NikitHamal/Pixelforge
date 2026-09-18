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
    add('rpg_knight', 'Knight', 'Heroes', 'Plate-armored sword & shield fighter — 24 states / 113 frames: idle & walk x3, six-frame run x3, four-directional sword arcs, shield block, hurt, death.', ['player', 'knight', 'rpg', 'tank'], () => RH().knightSuite(), { w: 32, h: 32, featured: true });
    add('rpg_ranger', 'Ranger', 'Heroes', 'Hooded archer — 23 states / 109 frames: idle & walk x3, run x3, five-frame bow draw & release on every facing, sneaky stride, hurt, death.', ['player', 'archer', 'rpg'], () => RH().rangerSuite(), { w: 32, h: 32 });
    add('rpg_cleric', 'Cleric', 'Heroes', 'Holy healer with circlet and staff — 25 states / 117 frames: idle & walk x3, run x3, four-directional strikes, radiant cast front & side, hurt, death.', ['player', 'healer', 'magic', 'rpg'], () => RH().clericSuite(), { w: 32, h: 32 });
    add('rpg_rogue', 'Rogue', 'Heroes', 'Shadowy hooded dagger fighter — 23 states / 109 frames: idle & walk x3, run x3, four-directional slashes, hurt, death.', ['player', 'assassin', 'rpg'], () => RH().rogueSuite(), { w: 32, h: 32 });
    add('rpg_townsfolk', 'Townsfolk Pack', 'NPCs', 'King, guard, blacksmith, elder, peasant and cook — blinking 4-frame idles, one state each.', ['npc', 'town', 'quest'], () => RH().townsfolkSuite(), { w: 32, h: 32 });
    add('rpg_goblin', 'Goblin Sneak', 'Enemies', 'Big-eared green skirmisher — 23 states / 109 frames: idle & walk x3, run x3, four-directional dagger slashes, hurt, dither-fade death.', ['enemy', 'forest', 'dungeon'], () => RF().goblinSuite(), { w: 32, h: 32 });
    add('rpg_necromancer', 'Necromancer', 'Enemies', 'Skull-faced dark caster — 25 states / 117 frames: idle & walk x3, run x3, four-directional strikes, shadow cast front & side, hurt, death.', ['enemy', 'boss', 'undead', 'magic'], () => RF().necromancerSuite(), { w: 32, h: 32 });
    add('rpg_demon', 'Horned Demon', 'Enemies', 'Winged brute with horns and tail — 23 states / 109 frames: idle & walk x3, run x3, four-directional heavy slashes, hurt, death.', ['enemy', 'boss', 'fire'], () => RF().demonSuite(), { w: 32, h: 32, featured: true });
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
    add('rpg_paladin', 'Paladin', 'Heroes', 'Holy sword & shield champion — 26 states / 121 frames: idle & walk x3, run x3, four-directional strikes, shield block, radiant cast front & side, gold cape, sun circlet.', ['player', 'knight', 'holy', 'rpg', 'tank'], () => RE().paladinSuite(), { w: 32, h: 32, featured: true });
    add('rpg_druid', 'Druid', 'Heroes', 'Forest keeper with oak staff and thorn cast — 25 states / 117 frames: idle & walk x3, run x3, four-directional strikes, cast front & side, leaf hood, moss cape.', ['player', 'mage', 'nature', 'rpg'], () => RE().druidSuite(), { w: 32, h: 32 });
    add('rpg_lich', 'Lich Lord', 'Enemies', 'Undead skull-faced overlord — 25 states / 117 frames: crouched run x3, four-directional strikes, shadow staff cast front & side, dither-fade death.', ['enemy', 'boss', 'undead', 'magic'], () => RE().lichSuite(), { w: 32, h: 32 });
    add('rpg_ogre', 'Ogre Mauler', 'Enemies', 'Horned heavy bruiser with iron pauldrons — 23 states / 109 frames: idle & walk x3, run x3, four-directional axe sweeps, hurt, death.', ['enemy', 'boss', 'brute'], () => RE().ogreSuite(), { w: 32, h: 32 });
    add('rpg_campsite', 'Campsite Props', 'World', 'Canvas tent with swinging flap, waving war banner, anvil, bedroll, 4-frame bubbling cookpot, supply crate.', ['camp', 'decoration', 'props', 'survival'], () => RE().campsiteSuite(), { w: 32, h: 32 });
    add('rpg_trinkets', 'Trinkets', 'Items', 'Gold ring, amulet, mana orb, war horn, lantern, drum, flute, spirit mask.', ['gear', 'loot', 'equipment'], () => RE().trinketsSuite(), { w: 32, h: 32 });
    add('rpg_magic3', 'Battle Magic 3', 'FX', 'Holy smite beam, travelling shadow orb with implode, forked storm strike, rising vine grasp.', ['magic', 'effects', 'particles'], () => RE().magic3Suite(), { w: 32, h: 32, featured: true });
    // ---- RPG pack: classes 2, beasts, traps/furniture/weather ----
    const RC = () => R().classes, RB = () => R().beasts, RP = () => R().props;
    add('rpg_barbarian', 'Barbarian', 'Heroes', 'Fur-mantled axe brute — 23 states / 109 frames: idle, walk and run x3, four-directional axe arcs, hurt, death.', ['player', 'brute', 'rpg'], () => RC().barbarianSuite(), { w: 32, h: 32 });
    add('rpg_monk', 'Monk', 'Heroes', 'Shaven-headed staff master with a long white beard — 25 states / 117 frames: locomotion x3, four-directional strikes, chi cast front and side.', ['player', 'martial', 'rpg', 'magic'], () => RC().monkSuite(), { w: 32, h: 32 });
    add('rpg_bard', 'Bard', 'Heroes', 'Plumed hat, motley doublet and a lute — 25 states / 117 frames: locomotion x3, four-directional strums, sonic cast with sparkle particles.', ['player', 'support', 'rpg', 'music'], () => RC().bardSuite(), { w: 32, h: 32, featured: true });
    add('rpg_ninja', 'Ninja', 'Heroes', 'Indigo gi and crimson scarf with a silent crouched stride — 23 states / 109 frames: locomotion x3, four-directional blade arcs, hurt, death.', ['player', 'assassin', 'rpg', 'stealth'], () => RC().ninjaSuite(), { w: 32, h: 32 });
    add('rpg_bandit', 'Bandit', 'Enemies', 'Hooded green cutthroat with a sneak stride — 23 states / 109 frames: locomotion x3, four-directional slashes, hurt, death.', ['enemy', 'forest', 'rpg'], () => RC().banditSuite(), { w: 32, h: 32 });
    add('rpg_cultist', 'Cultist', 'Enemies', 'Crimson-robed zealot with a blood-red cast aura — 25 states / 117 frames: locomotion x3, four-directional strikes, cast front and side.', ['enemy', 'magic', 'rpg'], () => RC().cultistSuite(), { w: 32, h: 32 });
    add('rpg_minotaur', 'Minotaur', 'Enemies', 'Horned bull brute with scrap pauldrons — 23 states / 109 frames: locomotion x3, four-directional axe arcs, hurt, death.', ['enemy', 'boss', 'brute', 'rpg'], () => RC().minotaurSuite(), { w: 32, h: 32, featured: true });
    add('rpg_warlord', 'Warlord', 'Enemies', 'Blackened plate, horned helm and a crimson cape — 24 states / 113 frames: locomotion x3, four-directional axe arcs, shield block, hurt, death.', ['enemy', 'boss', 'rpg'], () => RC().warlordSuite(), { w: 32, h: 32 });
    add('rpg_animals', 'Farm & Forest Animals', 'Animals', 'Cow, sheep, pig, horse, rabbit and deer on a shared quadruped rig — 18 states / 72 frames: each gets a breathing idle, a four-beat walk and a head-down graze.', ['animal', 'farm', 'forest', 'survival'], () => RB().animalsSuite(), { w: 32, h: 32, featured: true });
    add('rpg_frog', 'Pond Frog', 'Animals', 'Squat green hopper — 5 states / 17 frames: resting idle, four-frame hop, throat-puffing croak, hurt and squash death.', ['animal', 'pond', 'nature'], () => RB().frogSuite(), { w: 32, h: 32 });
    add('rpg_duck', 'Duck', 'Animals', 'Waterfowl with a boat-shaped hull — 5 states / 17 frames: idle, waddling walk, glide, hurt and comical death.', ['animal', 'pond', 'farm'], () => RB().duckSuite(), { w: 32, h: 32 });
    add('rpg_wraith', 'Wraith', 'Enemies', 'Hooded spectre with a tattered hem and cold blue eyes — 6 states / 21 frames: floating idle, soul-drain cast, lunge, hurt, dither vanish.', ['enemy', 'undead', 'spirit', 'flying'], () => RB().wraithSuite(), { w: 32, h: 32 });
    add('rpg_gargoyle', 'Gargoyle', 'Enemies', 'Mossy stone sentinel — 5 states / 18 frames: crouched perch, wing-spread swoop, ground slam, hurt and a crumbling two-stage death.', ['enemy', 'dungeon', 'flying'], () => RB().gargoyleSuite(), { w: 32, h: 32 });
    add('rpg_imp', 'Imp', 'Enemies', 'Small winged nuisance with a barbed tail — 5 states / 18 frames: flapping idle, dart, hex spark, hurt and fade death.', ['enemy', 'fire', 'flying'], () => RB().impSuite(), { w: 32, h: 32 });
    add('rpg_traps', 'Dungeon Traps', 'World', 'Eight animated hazards on one sheet — 8 states / 26 frames: floor spikes, wall darts, pendulum blade, pressure plate, flame jet, bear trap, spike pit and swinging chain ball.', ['dungeon', 'trap', 'hazard'], () => RP().trapsSuite(), { w: 32, h: 32, featured: true });
    add('rpg_furniture', 'Interior Furniture', 'World', 'Ten pieces for houses, inns and keeps — 10 states / 10 frames: table, chair, bed, bookshelf, barrel, crate stack, clay pot, rug, candelabra and stool.', ['interior', 'decoration', 'props', 'town'], () => RP().furnitureSuite(), { w: 32, h: 32 });
    add('rpg_weather', 'Weather Overlays', 'FX', 'Eight full-tile ambient overlays — 8 states / 32 frames: rain, snow, lightning storm, stippled fog banks, falling leaves, drifting ash, fireflies and sandstorm.', ['weather', 'effects', 'ambient'], () => RP().weatherSuite(), { w: 32, h: 32, featured: true });
    // ---- Medieval RPG expansion pack ----
    const RM = () => R().medieval;
    add('rpg_crusader', 'Crusader', 'Heroes', 'Holy Knight of the Order — 26 states / 121 frames: greathelm with cross-slit visor, red St. George cross surcoat, flanged mace, kite shield, holy smite cast.', ['player', 'knight', 'holy', 'medieval', 'paladin'], () => RM().crusaderSuite(), { w: 32, h: 32, featured: true });
    add('rpg_valkyrie', 'Valkyrie', 'Heroes', 'Winged helm and spear champion — 25 states / 117 frames: silver plate cuirass, azure mantle, golden braids, celestial spear, divine ray cast.', ['player', 'warrior', 'valkyrie', 'spear', 'medieval'], () => RM().valkyrieSuite(), { w: 32, h: 32, featured: true });
    add('rpg_blacksmith', 'Blacksmith', 'NPCs', 'Artisan village weaponsmith — 25 states / 117 frames: leather work apron, thick dark beard, heavy smith hammer, forge spark strike cast.', ['npc', 'town', 'crafting', 'medieval'], () => RM().blacksmithSuite(), { w: 32, h: 32 });
    add('rpg_jester', 'Court Jester', 'NPCs', 'Royal palace entertainer — 25 states / 117 frames: three-pointed bell cap, motley quartered doublet, acrobat rapier, confetti trick magic.', ['npc', 'entertainer', 'town', 'medieval'], () => RM().jesterSuite(), { w: 32, h: 32, featured: true });
    add('rpg_executioner', 'Executioner', 'Enemies', 'Dread headsman — 23 states / 109 frames: deep black executioner hood with slit eyes, studded harness, gargantuan cleaving greataxe.', ['enemy', 'boss', 'dungeon', 'medieval'], () => RM().executionerSuite(), { w: 32, h: 32, featured: true });
    add('rpg_deathknight', 'Death Knight', 'Enemies', 'Unholy scourge champion — 25 states / 117 frames: spiked gothic helm with cyan runic gaze, frost runeblade, plague cast, tattered shroud.', ['enemy', 'boss', 'undead', 'medieval', 'knight'], () => RM().deathknightSuite(), { w: 32, h: 32, featured: true });
    add('rpg_warhorse', 'Armored Warhorse', 'Animals', 'Barded medieval destrier — 6 states / 24 frames: breathing idle, disciplined trot, full 6-frame battle gallop, majestic rear, hurt, death.', ['animal', 'mount', 'horse', 'medieval', 'knight'], () => RM().warhorseSuite(), { w: 32, h: 32, featured: true });
    add('rpg_griffin', 'Heraldic Griffin', 'Enemies', 'Legendary beast of crest and banner — 6 states / 22 frames: perched idle, predatory stalk, 4-frame flight flap cycle, razor talon dive attack, hurt, death.', ['enemy', 'boss', 'beast', 'flying', 'medieval'], () => RM().griffinSuite(), { w: 32, h: 32, featured: true });
    add('rpg_siege', 'Siege Engines', 'World', 'Medieval siege warfare machines — 5 states / 19 frames: heavy catapult rock throw, trebuchet fire shot, ballista bolt release, battering ram impact, archer mantlet.', ['siege', 'war', 'props', 'medieval'], () => RM().siegeSuite(), { w: 32, h: 32, featured: true });
    add('rpg_castle', 'Castle Keep', 'World', 'Medieval fortress and dungeon keep fixtures — 8 states / 32 frames: winched iron portcullis, roaring brazier, royal lion throne, armory weapon rack, pillory stocks, council war table, heraldic lion banner, wheel chandelier.', ['castle', 'interior', 'props', 'medieval'], () => RM().castleSuite(), { w: 32, h: 32, featured: true });
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
    // ---- Universal FX: genre-agnostic particles ----
    const FX = () => PF.FX2;
    add('fx_explosion', 'Explosion Pack', 'FX', 'Four blast shapes on one sheet: eight-frame fireball with smoke break-up, compact hit pop, directional cone blast and a boss-grade mushroom column.', ['effects', 'explosion', 'particles', 'shooter', 'action'], () => FX().explosionSuite(), { w: 32, h: 32, featured: true });
    add('fx_smoke', 'Smoke & Fire', 'FX', 'Rising smoke puffs, a four-frame campfire flame with lift-off sparks, a steam vent jet and a landing dust cloud.', ['effects', 'smoke', 'fire', 'particles'], () => FX().smokeSuite(), { w: 32, h: 32 });
    add('fx_impact', 'Impact Pack', 'FX', 'Combat feedback: hit spark, swept slash arc, crossing critical, blood spray, shield block flash and a ground shockwave ring.', ['effects', 'combat', 'hit', 'particles'], () => FX().impactSuite(), { w: 32, h: 32, featured: true });
    add('fx_elemental', 'Elemental Pack', 'FX', 'Six elements: forked lightning strike, ice nova with rising shards, poison cloud, holy beam, shadow implosion and a water splash crown.', ['effects', 'magic', 'elemental', 'particles'], () => FX().elementalSuite(), { w: 32, h: 32, featured: true });
    add('fx_aura', 'Auras & Portals', 'FX', 'Swirling portal mouth, teleport dissolve, healing motes, rotating buff runes, level-up burst and a pickup twinkle.', ['effects', 'magic', 'portal', 'buff'], () => FX().auraSuite(), { w: 32, h: 32 });
    add('fx_beam', 'Guns & Beams', 'FX', 'Ranged-weapon FX: muzzle flash with smoke, travelling laser bolt, pulsing plasma charge, scrolling continuous beam and an armour ricochet.', ['effects', 'shooter', 'scifi', 'laser'], () => FX().beamSuite(), { w: 32, h: 32 });
    // ---- UI kit: panels, buttons, bars, icons, cursors, HUD ----
    const U = () => PF.UIKit;
    add('ui_panels', 'UI Panels & Frames', 'UI', '9 nine-slice panels: wood, stone, parchment, dark, sci-fi, ornate, plus a titled window, tab strip and tooltip. 2px border band, flat centre — slice and stretch safely.', ['ui', 'hud', 'panel', 'nine-slice', 'menu'], () => U().panelSuite(), { w: 64, h: 48, featured: true });
    add('ui_buttons', 'UI Buttons', 'UI', '7 button strips (green/blue/red/gold/stone/dark + icon buttons), each 3-4 frames of idle, hover, pressed and disabled.', ['ui', 'button', 'hud', 'menu'], () => U().buttonSuite(), { w: 48, h: 16, featured: true });
    add('ui_bars', 'UI Bars & Meters', 'UI', 'HP, MP, XP, stamina and boss bars with chip-damage second bar, segmented hearts and a circular cooldown sweep.', ['ui', 'hud', 'healthbar', 'meter'], () => U().barSuite(), { w: 64, h: 19, featured: true });
    add('ui_icons', 'UI Icon Sheets', 'UI', '48 hand-tuned 16px icons over 3 sheets: items, interface actions and RPG stats. Grid-aligned for direct atlas use.', ['ui', 'icons', 'inventory', 'hud'], () => U().iconSuite(), { w: 64, h: 64, featured: true });
    add('ui_cursors', 'UI Cursors', 'UI', '8 mouse cursors: arrow (light/dark), hand, grab, crosshair, sword, target and an animated busy spinner.', ['ui', 'cursor', 'mouse', 'pointer'], () => U().cursorSuite(), { w: 16, h: 16 });
    add('ui_controls', 'UI Controls', 'UI', 'Checkbox, toggle switch, slider, radio group and stepper — each stepping through its interaction states.', ['ui', 'widget', 'settings', 'menu'], () => U().controlSuite(), { w: 48, h: 36 });
    add('ui_dialogue', 'UI Dialogue Box', 'UI', 'Portrait dialogue box with typewriter reveal, name plate and a blinking continue arrow.', ['ui', 'dialogue', 'rpg', 'text'], () => U().dialogueSuite(), { w: 80, h: 40 });
    add('ui_slots', 'UI Inventory Slots', 'UI', '3x3 inventory grid: empty, filled with rarity borders, locked slots and a travelling selection highlight.', ['ui', 'inventory', 'slot', 'rpg'], () => U().slotSuite(), { w: 62, h: 62 });
    // ---- Bitmap fonts + runtime text API ----
    const FT = () => PF.Font;
    add('font_small', 'Font — 5x7', 'UI', 'Full ASCII 32-126 pixel face with true descenders. Glyph sheets plus a sample block. Stamp it at runtime with PF.Font.text().', ['font', 'text', 'ui', 'bitmap'], () => FT().smallSuite(), { w: 72, h: 64, featured: true });
    add('font_mini', 'Font — 3x5', 'UI', 'Ultra-compact uppercase face for cramped HUDs, score counters and damage numbers.', ['font', 'text', 'ui', 'hud'], () => FT().miniSuite(), { w: 64, h: 40 });
    add('font_styles', 'Font Styles', 'UI', 'The same string in plain, drop-shadow, outlined, bold and 2x scaled styles, plus a scrolling marquee.', ['font', 'text', 'ui', 'title'], () => FT().styleSuite(), { w: 64, h: 56 });
    // ---- Platformer: side-view hero rig, foes, pickups, props, terrain ----
    const PL = () => PF.Platformer;
    add('plat_hero', 'Platform Hero', 'Heroes', 'Side-view runner with a trailing scarf: idle, 8-frame run, jump, fall, squash landing, sword slash and a knockback hurt.', ['platformer', 'hero', 'side-view', 'run', 'jump'], () => PL().heroSuite(), { w: 32, h: 32, featured: true });
    add('plat_slime', 'Slime Hopper', 'Enemies', 'Liquid-volume slime with a lagging nucleus: idle wobble, six-frame hop arc, lunge attack, hurt recoil and a melt-to-puddle death.', ['platformer', 'enemy', 'slime', 'hop'], () => PL().slimeSuite(), { w: 32, h: 32, featured: true });
    add('plat_spiky', 'Spiky Crawler', 'Enemies', 'Quilled ground hazard that walks: counter-phase stub feet, idle bob, a bristle flare before charging and a hurt knockback.', ['platformer', 'enemy', 'spikes', 'hazard'], () => PL().spikySuite(), { w: 32, h: 32 });
    add('plat_flyer', 'Cave Flyer', 'Enemies', 'Membrane-winged flyer: six-frame flap cycle, a straight glide, a diving swoop and a hurt tumble.', ['platformer', 'enemy', 'flying', 'bat'], () => PL().flyerSuite(), { w: 32, h: 32 });
    add('plat_pickups', 'Platform Collectables', 'Items', 'Eight pickups with real spin and pulse: gold and silver coins, three faceted gems, a heart, a rotating star and a bobbing key.', ['platformer', 'pickup', 'coin', 'gem', 'collectable'], () => PL().pickupSuite(), { w: 32, h: 32, featured: true });
    add('plat_props', 'Platform Props', 'World', 'Eight interactables: crate, barrel, compressing spring, checkpoint flag, opening door, signpost, spike strip and a hovering platform.', ['platformer', 'props', 'crate', 'door', 'spring'], () => PL().propSuite(), { w: 32, h: 32 });
    add('plat_tiles', 'Platform Tileset', 'World', '16-tile 64x64 terrain sheet: grass caps with ragged roots, dirt body and edges, stone, brick, ore, ledge, ladder, spikes, water and cloud.', ['platformer', 'tileset', 'terrain', 'autotile'], () => PL().tilesetSuite(), { w: 64, h: 64, featured: true });
    add('plat_parallax', 'Parallax Layers', 'World', 'Three seamlessly wrapping 64x32 backdrop strips — starfield sky, purple hill ridges and a near tree line — for layered scrolling.', ['platformer', 'background', 'parallax', 'scrolling'], () => PL().parallaxSuite(), { w: 64, h: 32 });
    // ---- Sci-fi: crew, machines and station kit ----
    const SF = () => PF.SciFi;
    add('sf_astronaut', 'EVA Astronaut', 'Heroes', 'White hard-suit explorer on a 3/4 rig: idle breath, six-frame walk, a raised-arm scan, hurt recoil and a venting vacuum death.', ['scifi', 'astronaut', 'space', 'suit', 'crew'], () => SF().astronautSuite(), { w: 32, h: 32, featured: true });
    add('sf_marine', 'Space Marine', 'Heroes', 'Armoured trooper with a shouldered pulse rifle: idle, patrol walk, a three-frame aim-up, hurt and a downed pose.', ['scifi', 'marine', 'soldier', 'rifle', 'combat'], () => SF().marineSuite(), { w: 32, h: 32, featured: true });
    add('sf_engineer', 'Station Engineer', 'NPCs', 'Hi-vis orange crew in a hard hat carrying a wrench: idle, walk, a raised-tool repair reach, hurt and a collapse.', ['scifi', 'engineer', 'npc', 'crew', 'worker'], () => SF().engineerSuite(), { w: 32, h: 32 });
    add('sf_robot', 'Walker Robot', 'Enemies', 'Boxy bipedal machine with a single red visor slit: idle vent, piston walk, a sweeping radar scan, muzzle flash and a sparking collapse.', ['scifi', 'robot', 'enemy', 'machine', 'android'], () => SF().robotSuite(), { w: 32, h: 32, featured: true });
    add('sf_drone', 'Hover Drone', 'Enemies', 'Twin-rotor scout with a blurred blade cycle: hover bob, a downward scan cone, a red alert pulse and a smoking crash.', ['scifi', 'drone', 'enemy', 'flying', 'scout'], () => SF().droneSuite(), { w: 32, h: 32 });
    add('sf_turret', 'Wall Turret', 'Enemies', 'Floor-mounted twin-barrel gun: idle sway, a tracking traverse, a charging muzzle flash with 2px recoil and a burning wreck.', ['scifi', 'turret', 'enemy', 'gun', 'defence'], () => SF().turretSuite(), { w: 32, h: 32 });
    add('sf_mech', 'Assault Mech', 'Enemies', 'Piloted walker with a visible cockpit silhouette: idle settle, heavy stomp walk, shoulder-cannon fire and a toppling wreck.', ['scifi', 'mech', 'boss', 'walker', 'vehicle'], () => SF().mechSuite(), { w: 32, h: 32, featured: true });
    add('sf_props', 'Station Props', 'World', 'Eight station fittings: blinking console, supply crate, fluid barrel, data terminal, sliding airlock, ceiling lamp, cryo capsule and a repair bench.', ['scifi', 'props', 'station', 'console', 'crate'], () => SF().propSuite(), { w: 32, h: 32 });
    add('sf_tiles', 'Station Tileset', 'World', '16-tile 64x64 interior sheet: floor plate, grate, hazard stripe, vent, wall face, trim, pipe run, panel, circuit floor, glass, catwalk, rivets, conduit, screens, hull dent and a starfield window.', ['scifi', 'tileset', 'station', 'interior', 'sheet'], () => SF().tilesetSuite(), { w: 64, h: 64, featured: true });
    // ---- Space shooter: ships, rocks, powerups, weapon FX, starfields ----
    const SP = () => PF.Space;
    add('space_player', 'Player Fighter', 'Heroes', 'Delta interceptor for a vertical shooter: thrust loop, drawn left and right banking, nose-cannon fire, damage flash and a five-frame shockwave explosion.', ['space', 'shmup', 'ship', 'player', 'flying'], () => SP().playerSuite(), { w: 32, h: 32, featured: true });
    add('space_fighter', 'Enemy Interceptor', 'Enemies', 'Swept-back dart that flies at the player: engine loop, rolling strafe, plasma shot, hit flash and a bursting death.', ['space', 'shmup', 'enemy', 'ship', 'flying'], () => SP().fighterSuite(), { w: 32, h: 32, featured: true });
    add('space_bomber', 'Enemy Bomber', 'Enemies', 'Heavy full-span gunship: twin-engine cruise, a four-frame bomb-bay drop, hit flash and a wide flattened explosion.', ['space', 'shmup', 'enemy', 'bomber', 'flying'], () => SP().bomberSuite(), { w: 32, h: 32 });
    add('space_boss', 'Dreadnought Boss', 'Enemies', '64x64 capital ship with four turret blisters and a reactor core: idle pulse, core charge-up, turret volley, a damaged state and a staged break-up.', ['space', 'shmup', 'boss', 'capital', 'flying'], () => SP().bossSuite(), { w: 64, h: 64, featured: true });
    add('space_asteroids', 'Asteroids', 'World', 'Procedurally lit rocks in four sizes plus ice and ore variants, and a crack-then-split shatter sequence for breakables.', ['space', 'asteroid', 'rock', 'obstacle', 'hazard'], () => SP().asteroidSuite(), { w: 32, h: 32 });
    add('space_powerups', 'Ship Powerups', 'Items', 'Eight matching capsules with distinct glyphs: weapon, shield, speed, bomb, repair, laser, credits and wingman.', ['space', 'powerup', 'pickup', 'shmup', 'item'], () => SP().powerupSuite(), { w: 32, h: 32, featured: true });
    add('space_fx', 'Space FX', 'FX', 'Weapon and impact effects for a shooter: tracer stream, continuous laser beam, plasma orb, shield ripple, impact burst, warp-in and engine smoke.', ['space', 'fx', 'laser', 'explosion', 'shield'], () => SP().fxSuite(), { w: 32, h: 32 });
    add('space_tiles', 'Space Tileset', 'World', '16-tile 64x64 backdrop sheet: three star densities, a nebula, planet horizon, dunes, craters, cliff, hull plate, solar wing, antenna, dome, mine, debris, energy gate and a warp lane.', ['space', 'tileset', 'starfield', 'background', 'sheet'], () => SP().tilesetSuite(), { w: 64, h: 64, featured: true });
    // ---- Modern / urban: contemporary cast, vehicles, street kit, city tiles ----
    const MD = () => PF.Modern;
    add('mod_soldier', 'Soldier', 'Heroes', 'Modern infantryman in plate carrier and combat helmet: idle, walk, run, a three-frame aim, muzzle-flash fire, hurt and a staged collapse.', ['modern', 'soldier', 'military', 'rifle', 'shooter'], () => MD().soldierSuite(), { w: 32, h: 32, featured: true });
    add('mod_police', 'Police Officer', 'NPCs', 'Uniformed officer with a peaked cap, badge and sidearm: idle, patrol walk, run, aim, fire, hurt and down.', ['modern', 'police', 'npc', 'city', 'pistol'], () => MD().policeSuite(), { w: 32, h: 32 });
    add('mod_medic', 'Paramedic', 'NPCs', 'Ambulance crew carrying a red-cross kit: idle, walk, run, a kneeling loop working an open kit, hurt and down.', ['modern', 'medic', 'npc', 'rescue', 'heal'], () => MD().medicSuite(), { w: 32, h: 32 });
    add('mod_survivor', 'Survivor', 'Heroes', 'Hooded civilian with a baseball bat: idle, walk, run, a four-frame overhead swing, hurt recoil and a collapse.', ['modern', 'survivor', 'hero', 'melee', 'zombie'], () => MD().survivorSuite(), { w: 32, h: 32, featured: true });
    add('mod_zombie', 'Shambler', 'Enemies', 'Reaching undead on the same rig as the cast: idle sway, a lurching seven-fps shamble, a whole-body lunge, hurt and a fall.', ['modern', 'zombie', 'enemy', 'undead', 'horror'], () => MD().zombieSuite(), { w: 32, h: 32, featured: true });
    add('mod_vehicles', 'City Vehicles', 'World', 'Eight top-down vehicles for driving and top-down shooters: sedan, taxi, flashing police cruiser, ambulance, van, pickup, bus and a motorcycle.', ['modern', 'vehicle', 'car', 'top-down', 'city'], () => MD().vehicleSuite(), { w: 32, h: 32, featured: true });
    add('mod_props', 'Street Props', 'World', 'Eight pieces of street furniture: flickering streetlight, cycling traffic light, hydrant, dumpster, bench, mailbox, burning barrel and a cone with a barrier.', ['modern', 'props', 'street', 'city', 'furniture'], () => MD().propSuite(), { w: 32, h: 32 });
    add('mod_items', 'Urban Loot', 'Items', 'Eight bobbing pickups on one shared curve: pistol, rifle, ammo box, medkit, bandage roll, radio, flashlight and canned rations.', ['modern', 'item', 'pickup', 'loot', 'survival'], () => MD().itemSuite(), { w: 32, h: 32 });
    add('mod_city', 'City Tileset', 'World', '16-tile 64x64 street sheet: asphalt, centre line, crosswalk, manhole, sidewalk, kerb, verge, gravel, brick, office glass, shutter, chain-link, tar roof, puddle, storm drain and hedge.', ['modern', 'tileset', 'city', 'street', 'sheet'], () => MD().tilesetSuite(), { w: 64, h: 64, featured: true });
    // ---- Farm / life sim: farmhand, barnyard, crop growth chart, homestead ----
    const FM = () => PF.Farm;
    add('farm_farmer', 'Farmhand', 'Heroes', 'Straw-hatted farmhand in denim overalls: idle, walk, run, a swinging hoe, a watering pour, a crate carry, hurt and a collapse.', ['farm', 'farmer', 'hero', 'life-sim', 'harvest'], () => FM().farmerSuite(), { w: 32, h: 32, featured: true });
    add('farm_animals', 'Barnyard', 'Animals', 'Eight livestock on one shared quadruped rig: cow, pig, sheep, horse, goat, tail-wagging dog, pecking chicken and a duck.', ['farm', 'animal', 'livestock', 'barnyard', 'life-sim'], () => FM().animalSuite(), { w: 32, h: 32, featured: true });
    add('farm_crops', 'Crop Growth', 'World', 'Five-stage growth charts for wheat, corn, carrot, tomato and pumpkin \u2014 25 states, one per stage, so a crop table can address each stage on its own.', ['farm', 'crop', 'growth', 'plant', 'life-sim'], () => FM().cropSuite(), { w: 32, h: 32, featured: true });
    add('farm_build', 'Homestead', 'World', 'Eight farm structures: gambrel-roofed barn, corrugated silo, turning windmill, hen coop, draw well, swaying scarecrow, round bale and a rail fence.', ['farm', 'building', 'barn', 'windmill', 'homestead'], () => FM().buildSuite(), { w: 32, h: 32 });
    add('farm_tools', 'Farm Tools', 'Items', 'Eight bobbing implements on one hafted rig: hoe, pitchfork, axe, shears, watering can, seed sack, wicker basket and a milk pail.', ['farm', 'tool', 'item', 'pickup', 'harvest'], () => FM().toolSuite(), { w: 32, h: 32 });
    add('farm_produce', 'Farm Produce', 'Items', 'Eight harvest pickups drawn at icon scale: wheat sheaf, corn cob, carrot, tomato, ribbed pumpkin, egg, milk bottle and an apple.', ['farm', 'produce', 'food', 'item', 'harvest'], () => FM().produceSuite(), { w: 32, h: 32 });
    add('farm_tiles', 'Farm Tileset', 'World', '16-tile 64x64 farmland sheet: dirt, tilled soil, watered furrows, grass, tall grass, flower meadow, path, cobble, hay floor, floorboards, barn siding, stone wall, water, young and ripe crop rows, and fenced grass.', ['farm', 'tileset', 'farmland', 'soil', 'sheet'], () => FM().tileSuite(), { w: 64, h: 64, featured: true });
    // ---- Isometric kit: ground, blocks, walls, stairs, props ----
    const IS = () => PF.Iso;
    add('iso_ground', 'Iso Ground Tiles', 'World', 'Eight 2:1 isometric floor tiles on a shared 32x16 diamond footprint: grass, dirt, stone, sand, snow, planks, and scrolling water and lava.', ['isometric', 'tileset', 'ground', 'floor', 'diamond'], () => IS().groundSuite(), { w: 32, h: 32, featured: true });
    add('iso_blocks', 'Iso Blocks', 'World', 'Eight stackable isometric cubes lit from the upper left: turf-lipped grass, stone, dirt, sand, ice, coursed brick, a slatted crate and a gold bar.', ['isometric', 'block', 'cube', 'terrain', 'voxel'], () => IS().blocksSuite(), { w: 32, h: 32, featured: true });
    add('iso_walls', 'Iso Walls', 'World', 'Eight wall pieces that share one grid cell with a floor tile: both back edges, a corner, a doorway with a reveal, a lit window, a pillar and two half-height brick runs.', ['isometric', 'wall', 'building', 'dungeon', 'interior'], () => IS().wallsSuite(), { w: 32, h: 32 });
    add('iso_stairs', 'Iso Stairs & Ramps', 'World', 'Five level-connectors built on the same footprint: four-tread stairs on each axis, a timber flight, a seven-slice dirt ramp and a low platform.', ['isometric', 'stairs', 'ramp', 'level', 'terrain'], () => IS().stairsSuite(), { w: 32, h: 32 });
    add('iso_props', 'Iso Props', 'World', 'Ten isometric set pieces as transparent overlays — no baked ground, so each drops onto any tile in the kit: broadleaf tree, snowy pine, boulder, barrel, chest, flickering lantern, berry bush, pulsing crystal, a fence run and a signpost.', ['isometric', 'props', 'scenery', 'decoration', 'world'], () => IS().propsSuite(), { w: 32, h: 32, featured: true });
    add('iso_hero', 'Iso Hero', 'Heroes', 'Isometric swordsman built from the same lit boxes as the kit\u2019s blocks, so the figure obeys the tile lighting exactly: four facings of idle, walk and attack, plus hurt and a collapse. 22 states.', ['isometric', 'hero', 'player', 'knight', 'four-way'], () => IS().charSuite(IS().ISO_HERO, 'Iso Hero'), { w: 32, h: 32, featured: true });
    add('iso_orc', 'Iso Orc', 'Enemies', 'Isometric club-swinging brute on the shared box rig \u2014 green skin, hide tunic, four facings of idle, walk and a heavy overhead swing.', ['isometric', 'orc', 'enemy', 'monster', 'four-way'], () => IS().charSuite(IS().ISO_ORC, 'Iso Orc'), { w: 32, h: 32 });
    add('iso_mage', 'Iso Mage', 'NPCs', 'Isometric staff-caster with a glowing focus stone: four facings of idle, walk and a cast, on the same lit-box rig as the hero.', ['isometric', 'mage', 'wizard', 'npc', 'four-way'], () => IS().charSuite(IS().ISO_MAGE, 'Iso Mage'), { w: 32, h: 32 });
    add('iso_buildings', 'Iso Buildings', 'World', 'Seven 32x48 isometric structures on the kit footprint so they drop straight onto any ground tile: cottage, thatched hut, banner-topped watchtower, market stall, well, splashing fountain and a turning windmill.', ['isometric', 'building', 'house', 'town', 'structure'], () => IS().buildingSuite(), { w: 32, h: 48, featured: true });
    add('iso_nature', 'Iso Terrain Features', 'World', 'Eight isometric landscape pieces: grass-capped cliff and corner, a falling waterfall with plunge foam, a surf shoreline, a swaying pine, a pulsing crystal spire, a creeping lava flow and a log bridge.', ['isometric', 'terrain', 'cliff', 'water', 'nature'], () => IS().natureSuite(), { w: 32, h: 32, featured: true });
    // ---- Top-down kit: eight-direction characters, terrain, props, vehicles ----
    const TD = () => PF.TopDown;
    add('td_survivor', 'Top-Down Survivor', 'Heroes', 'True overhead survivor rendered from body-space geometry: eight-direction idle and walk, four-direction melee, hurt, a sprawling death and a separate blood pool. One painter, 29 states.', ['top-down', 'overhead', 'player', 'survival', 'shooter', 'eight-way'], () => TD().personSuite(TD().SURVIVOR, 'Top-Down Survivor'), { w: 32, h: 32, featured: true });
    add('td_soldier', 'Top-Down Soldier', 'Heroes', 'Helmeted overhead soldier carrying a rifle across the chest through every frame: eight-direction idle and walk, four-direction strike, hurt, death and pool.', ['top-down', 'overhead', 'soldier', 'military', 'shooter', 'eight-way'], () => TD().personSuite(TD().SOLDIER, 'Top-Down Soldier', { held: TD().rifle }), { w: 32, h: 32, featured: true });
    add('td_agent', 'Top-Down Agent', 'NPCs', 'Suited overhead agent for stealth and crime games — dark jacket, red tie visible from above, full eight-direction locomotion set.', ['top-down', 'overhead', 'agent', 'stealth', 'npc', 'eight-way'], () => TD().personSuite(TD().AGENT, 'Top-Down Agent'), { w: 32, h: 32 });
    add('td_zombie', 'Top-Down Zombie', 'Enemies', 'Overhead shambler: the walk is the shared eight-beat cycle driven at half speed with a heavier lurch, plus a lunging four-direction attack and a sprawl.', ['top-down', 'overhead', 'zombie', 'enemy', 'horde', 'eight-way'], () => TD().personSuite(TD().ZOMBIE, 'Top-Down Zombie', { pace: 5, lurch: 1.45 }), { w: 32, h: 32, featured: true });
    add('td_tiles', 'Top-Down Tileset', 'World', '16-tile 64x64 overhead sheet: grass, tall grass, dirt, gravel, asphalt, road line, sand, deep and shallow water, concrete, floor tile, planks, carpet, grate, snow and rubble.', ['top-down', 'overhead', 'tileset', 'terrain', 'sheet'], () => TD().tileSuite(), { w: 64, h: 64, featured: true });
    add('td_props', 'Top-Down Props', 'World', 'Eleven overhead set pieces with cast lips so they sit on the floor rather than on top of it: crate, barrel, table, bed, rug, swaying bush and tree, rock, flickering campfire and a door.', ['top-down', 'overhead', 'props', 'scenery', 'decoration'], () => TD().propSuite(), { w: 32, h: 32 });
    add('td_vehicles', 'Top-Down Vehicles', 'World', 'Five overhead vehicles: car, box truck, a tank whose turret traverses independently of its hull, a helicopter with a four-spoke rotor blur and a rocking boat.', ['top-down', 'overhead', 'vehicle', 'car', 'tank', 'helicopter'], () => TD().vehicleSuite(), { w: 32, h: 32, featured: true });
    add('td_pickups', 'Top-Down Pickups', 'Items', 'Six bobbing overhead pickups with a travelling specular highlight so they stay findable against textured ground: medkit, ammo box, key, spinning coin, fuel can and chest.', ['top-down', 'overhead', 'pickup', 'item', 'loot'], () => TD().pickupSuite(), { w: 32, h: 32 });
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
