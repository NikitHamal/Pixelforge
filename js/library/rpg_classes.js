/* PixelForge Studio — RPG Class & Foe expansion pack.
   Eight more fighters on the shared humanoid rig: four playable classes
   (barbarian, monk, bard, ninja) and four foes (bandit, cultist, minotaur,
   warlord). Because they all route through PF.RPG.humanoidSuite they inherit
   the complete 14-17 state suite — idle/walk/run on three facings,
   four-directional attacks, block, cast, hurt and death — for free.
   32x32, pure maths, deterministic. */
window.PF = window.PF || {};
PF.RPG = PF.RPG || {};
PF.RPG.classes = (() => {
  const R = PF.RPG;
  const P = () => R.PAL;

  /* ================= palettes (merged into R.PAL for game use) ================= */
  const BARBARIAN = { ...P().KNIGHT,
    skin: '#e8b796', skinSh: '#c28569',
    hair: '#d77643', hairSh: '#b86f50', hairHi: '#feae34',
    shirt: '#b86f50', shirtSh: '#733e39', shirtHi: '#e4a672',   // leather harness
    pants: '#733e39', pantsSh: '#3e2731',
    boots: '#3e2731', belt: '#262b44', buckle: '#c0cbdc', lip: '#a26a5a' };

  const MONK = { ...P().CLERIC,
    skin: '#e4a672', skinSh: '#b86f50',
    hair: null, hairSh: null, hairHi: null,                      // shaved head
    shirt: '#f77622', shirtSh: '#be4a2f', shirtHi: '#feae34',    // saffron robe
    pants: '#be4a2f', pantsSh: '#733e39',
    boots: '#733e39', belt: '#fee761', buckle: '#ffffff', lip: '#a26a5a' };

  const BARD = { ...P().ROGUE,
    skin: '#f2c094', skinSh: '#c28569',
    // warm brown, not blonde: a bright yellow head of hair swamps the small
    // hat crown and the face at 32x32
    hair: '#d77643', hairSh: '#b86f50', hairHi: '#e4a672',
    shirt: '#b55088', shirtSh: '#68386c', shirtHi: '#f6757a',    // motley doublet
    pants: '#3e8948', pantsSh: '#265c42',
    boots: '#733e39', belt: '#733e39', buckle: '#fee761', lip: '#a26a5a' };

  const NINJA = { ...P().ROGUE,
    skin: '#c28569', skinSh: '#a26a5a',
    // never set hair to the outline colour (#181425) — the hair side panels
    // sit outside the hood and read as thick outline bars if they match
    hair: '#262b44', hairSh: '#262b44', hairHi: '#3a4466',
    shirt: '#193c3e', shirtSh: '#181425', shirtHi: '#265c42',    // indigo gi
    pants: '#181425', pantsSh: '#181425',
    boots: '#181425', belt: '#e43b44', buckle: '#fee761', lip: '#a26a5a' }; // bright obi: the only warm accent

  const BANDIT = { ...P().RANGER,
    skin: '#e4a672', skinSh: '#b86f50',
    hair: '#733e39', hairSh: '#3e2731', hairHi: '#b86f50',
    shirt: '#265c42', shirtSh: '#193c3e', shirtHi: '#3e8948',
    pants: '#3e2731', pantsSh: '#262b44',
    boots: '#262b44', belt: '#3e2731', buckle: '#c0cbdc', lip: '#a26a5a' };

  const CULTIST = { ...P().NECRO,
    skin: '#c0cbdc', skinSh: '#8b9bb4',
    hair: '#262b44', hairSh: '#181425', hairHi: '#3a4466',
    shirt: '#a22633', shirtSh: '#5c1a1a', shirtHi: '#e43b44',    // crimson robe
    pants: '#5c1a1a', pantsSh: '#3e2731',
    boots: '#262b44', belt: '#3e2731', buckle: '#fee761', lip: '#5c1a1a' };

  const MINOTAUR = { ...P().OGRE,
    skin: '#b86f50', skinSh: '#733e39',                          // brown hide
    hair: '#3e2731', hairSh: '#262b44', hairHi: '#733e39',
    shirt: '#5a6988', shirtSh: '#3a4466', shirtHi: '#8b9bb4',    // scrap plate
    pants: '#733e39', pantsSh: '#3e2731',
    boots: '#262b44', belt: '#262b44', buckle: '#c0cbdc', lip: '#733e39' };

  const WARLORD = { ...P().KNIGHT,
    skin: '#d99a78', skinSh: '#a26a5a',
    hair: '#5a6988', hairSh: '#3a4466', hairHi: '#8b9bb4',   // iron-grey, clears the outline
    shirt: '#3a4466', shirtSh: '#262b44', shirtHi: '#5a6988',    // blackened plate
    pants: '#262b44', pantsSh: '#181425',
    boots: '#181425', belt: '#a22633', buckle: '#feae34', lip: '#a26a5a' };

  Object.assign(R.PAL, { BARBARIAN, MONK, BARD, NINJA, BANDIT, CULTIST, MINOTAUR, WARLORD });

  /* ================= playable classes ================= */
  // Barbarian: fur mantle, no helm, heavy axe.
  function barbarianSuite() {
    return R.humanoidSuite(BARBARIAN, 'rpg-barbarian', {
      weapon: 'axe',
      garb: { cape: '#b86f50', capeSh: '#733e39' }
    });
  }
  // Monk: shaved head, long white beard, staff, chi cast.
  function monkSuite() {
    return R.humanoidSuite(MONK, 'rpg-monk', {
      weapon: 'staff', cast: true, castColors: ['#fee761', '#ffffff', '#feae34'],
      head: { beard: '#e8ecf5', beardSh: '#8b9bb4', beardLong: true }
    });
  }
  // Bard: plumed hat, lute, sonic cast.
  function bardSuite() {
    return R.humanoidSuite(BARD, 'rpg-bard', {
      weapon: 'lute', cast: true, castColors: ['#b55088', '#fee761', '#2ce8f5'],
      head: { hat: '#68386c', hatBand: '#fee761', hatPlume: '#e43b44', hatSh: '#3e2347' }
    });
  }
  // Ninja: teal hood, crimson scarf, silent stride.
  function ninjaSuite() {
    // A bright crimson cape swamped the silhouette at 32x32 and read as a
    // robed monk, not a shinobi. Dark cloak + a single red obi instead.
    return R.humanoidSuite(NINJA, 'rpg-ninja', {
      weapon: 'sword', sneak: true,
      head: { hood: '#193c3e', hoodSh: '#181425' },
      garb: { cape: '#262b44', capeSh: '#181425' }
    });
  }

  /* ================= foes ================= */
  function banditSuite() {
    return R.humanoidSuite(BANDIT, 'rpg-bandit', {
      weapon: 'sword', sneak: true,
      head: { hood: '#3e2731', hoodSh: '#262b44' }
    });
  }
  function cultistSuite() {
    return R.humanoidSuite(CULTIST, 'rpg-cultist', {
      weapon: 'staff', cast: true, castColors: ['#ff0044', '#a22633', '#f77622'], sneak: true,
      head: { hood: '#5c1a1a', hoodSh: '#3e2731' }
    });
  }
  function minotaurSuite() {
    return R.humanoidSuite(MINOTAUR, 'rpg-minotaur', {
      weapon: 'axe',
      head: { horns: '#ead4aa', hornsSh: '#c28569', pads: '#8b9bb4', padsSh: '#5a6988' }
    });
  }
  function warlordSuite() {
    return R.humanoidSuite(WARLORD, 'rpg-warlord', {
      weapon: 'axe', shield: true,
      head: { helm: '#3a4466', helmSh: '#262b44', helmHi: '#5a6988', horns: '#e43b44', hornsSh: '#a22633' },
      garb: { cape: '#a22633', capeSh: '#5c1a1a' }
    });
  }

  return { barbarianSuite, monkSuite, bardSuite, ninjaSuite,
    banditSuite, cultistSuite, minotaurSuite, warlordSuite };
})();
