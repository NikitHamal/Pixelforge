/* PixelForge Studio — RPG Medieval Expansion Pack.
   Ten authentic medieval period templates:
   - Playable Heroes: Crusader (Greathelm, mace, kite shield), Valkyrie (Winged helm, spear)
   - NPCs: Blacksmith (Apron, forge hammer), Jester (Motley, 3-point cap, bells)
   - Foes: Executioner (Cowl, gargantuan greataxe), Death Knight (Runic plate, frost blade)
   - Animals: Warhorse (Barded destrier, gallop & rear)
   - Creatures: Griffin (Heraldic eagle-lion, perch, stalk, dive)
   - World: Siege Engines (Catapult, trebuchet, ballista, ram, mantlet)
   - World: Castle Keep (Portcullis, brazier, throne, armory, stocks, war table, banner, chandelier)
   32x32, pure maths, deterministic, 1px #181425 outline. */

window.PF = window.PF || {};
PF.RPG = PF.RPG || {};
PF.RPG.medieval = (() => {
  const R = PF.RPG;
  const P = () => PF.Pixel;
  const D = (name, fps, loop, frames) => ({ name, fps, loop, frames });
  const Fr = (duration, paint) => ({ duration, paint });
  const ms = fps => Math.round(1000 / fps);
  const apiFor = (buf, W, H) => P().makeApi(buf, W, H);
  const OUT32 = PF.Color.hexToU32('#181425');
  const finish = (buf, W, H) => buf.set(PF.Raster.outline(buf, W, H, OUT32));

  /* ================= PALETTES ================= */
  const CRUSADER = {
    skin: '#f2c094', skinSh: '#c28569',
    hair: '#5a6988', hairSh: '#3a4466', hairHi: '#8b9bb4',
    shirt: '#e8ecf5', shirtSh: '#c0cbdc', shirtHi: '#ffffff',    // white surcoat
    pants: '#5a6988', pantsSh: '#3a4466',                        // mail chausses
    boots: '#3a4466', belt: '#733e39', buckle: '#fee761', lip: '#a26a5a'
  };

  const VALKYRIE = {
    skin: '#f2c094', skinSh: '#c28569',
    hair: '#fee761', hairSh: '#feae34', hairHi: '#ffffff',      // braided gold hair
    shirt: '#c0cbdc', shirtSh: '#8b9bb4', shirtHi: '#ffffff',    // silver cuirass
    pants: '#2a5fa0', pantsSh: '#124e89',                        // azure mail
    boots: '#8b9bb4', belt: '#fee761', buckle: '#ffffff', lip: '#e43b44'
  };

  /* Hair, beard, apron shadow and trousers were all #3e2731 — one colour doing
     four jobs on adjacent parts, so the smith rendered as a brown blob with a
     pair of eyes in it (AGENTS.md rule 10). The apron is now a warm russet
     leather, the work trousers are cold blue-grey so they cannot be mistaken
     for more of it, and the hair sits below both. */
  const BLACKSMITH = {
    skin: '#d99a78', skinSh: '#a26a5a',
    hair: '#2c1e24', hairSh: '#20181d', hairHi: '#54343a',
    shirt: '#cbb08c', shirtSh: '#9b8464', shirtHi: '#e8d7b6',    // linen shirt UNDER the apron
    pants: '#3c4a63', pantsSh: '#2a3449',                        // cold work trousers
    boots: '#2b2230', belt: '#5a4433', buckle: '#c0cbdc', lip: '#a26a5a'
  };

  const JESTER = {
    skin: '#f2c094', skinSh: '#c28569',
    hair: '#d77643', hairSh: '#b86f50', hairHi: '#feae34',
    shirt: '#b55088', shirtSh: '#68386c', shirtHi: '#fee761',    // quartered purple & gold
    pants: '#feae34', pantsSh: '#f77622',
    boots: '#68386c', belt: '#733e39', buckle: '#fee761', lip: '#e43b44', blush: '#f6757a'
  };

  /* Menacing, but still a figure. Hood, harness, trousers, boots and belt were
     all #262b44 or #181425 — the outline colour and one step off it — so the
     executioner was a silhouette-shaped hole with a face floating in it. Every
     part now clears the border by a real step; the palette stays the darkest
     in the pack without any of it touching the outline. */
  const EXECUTIONER = {
    skin: '#c28569', skinSh: '#a26a5a',
    hair: '#2b2438', hairSh: '#1f1a2b', hairHi: '#4a4266',
    shirt: '#343b57', shirtSh: '#20253a', shirtHi: '#525d80',    // black leather harness
    pants: '#2e2434', pantsSh: '#1f1826',
    boots: '#251f2e', belt: '#3a2f2a', buckle: '#8b9bb4', lip: '#5c1a1a'
  };

  /* Same fix, one rung colder: pants, pantsSh and boots were literally the
     outline colour, so the legs did not exist — the knight ended at the belt
     and stood on its own border. */
  const DEATHKNIGHT = {
    skin: '#6b7fa3', skinSh: '#4a5878',
    hair: '#2a3048', hairSh: '#1e2334', hairHi: '#4d5a80',
    shirt: '#2f3650', shirtSh: '#1e2334', shirtHi: '#6b7aa0',    // blackened gothic plate
    pants: '#242a3e', pantsSh: '#191d2c',
    boots: '#1e2334', belt: '#4a5578', buckle: '#2ce8f5', lip: '#2a3048'
  };

  Object.assign(R.PAL, { CRUSADER, VALKYRIE, BLACKSMITH, JESTER, EXECUTIONER, DEATHKNIGHT });

  /* ================= 1. CRUSADER ================= */
  // Greathelm with brass cross visor, red St. George cross on white surcoat, flanged mace & kite shield.
  function crusaderSuite() {
    return R.humanoidSuite(CRUSADER, 'rpg-crusader', {
      weapon: 'mace',
      shield: true,
      cast: true,
      castColors: ['#fee761', '#ffffff', '#fff6c9'],
      garb: { cape: '#e8ecf5', capeSh: '#c0cbdc' },
      post: (api, cfg) => {
        const bob = cfg.bob || 0, kb = cfg.kb || 0, hd = cfg.headDy || 0;
        const side = cfg.facing === 'side', up = cfg.facing === 'up';
        const X = x => x + kb, Y = y => y + bob + hd + 1, BY = y => y + bob;

        // Red cross on surcoat (front and side)
        if (!up && !cfg.lying) {
          if (side) {
            api.rect(X(15), BY(15), X(17), BY(18), '#e43b44');
          } else {
            // St George's red cross on breast
            api.rect(X(15), BY(14), X(16), BY(19), '#e43b44');
            api.rect(X(13), BY(16), X(18), BY(17), '#e43b44');
          }
        }

        // Greathelm overlay: enclosed barrel steel helm with brass cross visor
        if (!cfg.lying) {
          if (side) {
            // Steel helm box
            api.rect(X(10), Y(2), X(21), Y(11), '#c0cbdc');
            api.rect(X(10), Y(2), X(12), Y(11), '#8b9bb4');
            api.rect(X(10), Y(10), X(21), Y(11), '#8b9bb4');
            // Brass visor bands + eye slit
            api.rect(X(17), Y(4), X(20), Y(10), '#fee761');
            api.line(X(18), Y(7), X(21), Y(7), '#181425', 1);
            api.px(X(19), Y(8), '#3a4466'); // breathing perforations
            api.px(X(18), Y(9), '#3a4466');
          } else if (up) {
            // Back of greathelm
            api.rect(X(10), Y(2), X(21), Y(11), '#c0cbdc');
            api.rect(X(10), Y(2), X(12), Y(11), '#8b9bb4');
            api.rect(X(19), Y(2), X(21), Y(11), '#8b9bb4');
            api.line(X(15), Y(2), X(16), Y(11), '#8b9bb4', 1);
          } else {
            // Front Greathelm: steel barrel with heraldic brass cross
            api.rect(X(10), Y(2), X(21), Y(11), '#c0cbdc');
            api.rect(X(10), Y(2), X(11), Y(11), '#8b9bb4');
            api.rect(X(20), Y(2), X(21), Y(11), '#8b9bb4');
            api.rect(X(10), Y(10), X(21), Y(11), '#8b9bb4');
            // Brass cross reinforcement
            api.rect(X(15), Y(3), X(16), Y(10), '#fee761');
            api.rect(X(12), Y(6), X(19), Y(7), '#fee761');
            // Eye slits in cross
            api.line(X(12), Y(6), X(14), Y(6), '#181425', 1);
            api.line(X(17), Y(6), X(19), Y(6), '#181425', 1);
            // Breather holes
            api.px(X(13), Y(9), '#3a4466'); api.px(X(18), Y(9), '#3a4466');
            api.px(X(14), Y(10), '#3a4466'); api.px(X(17), Y(10), '#3a4466');
          }
        }
      }
    });
  }

  /* ================= 2. VALKYRIE ================= */
  // Winged helm with sweeping feathers, silver plate, azure mantle & celestial spear.
  function valkyrieSuite() {
    return R.humanoidSuite(VALKYRIE, 'rpg-valkyrie', {
      weapon: 'spear',
      cast: true,
      castColors: ['#2ce8f5', '#ffffff', '#fee761'],
      garb: { cape: '#2a5fa0', capeSh: '#124e89' },
      post: (api, cfg) => {
        const bob = cfg.bob || 0, kb = cfg.kb || 0, hd = cfg.headDy || 0;
        const side = cfg.facing === 'side', up = cfg.facing === 'up';
        const X = x => x + kb, Y = y => y + bob + hd + 1, BY = y => y + bob;

        if (cfg.lying) return;

        // Winged Circlet Helm
        if (side) {
          // Wing sweeping backwards from temple
          api.line(X(16), Y(4), X(9), Y(1), '#ffffff', 2);
          api.line(X(16), Y(5), X(11), Y(2), '#c0cbdc', 1);
          api.line(X(15), Y(6), X(10), Y(4), '#8b9bb4', 1);
          api.px(X(8), Y(1), '#ffffff'); api.px(X(9), Y(1), '#ffffff');
          // Silver circlet
          api.line(X(14), Y(4), X(20), Y(4), '#c0cbdc', 1);
          api.px(X(17), Y(4), '#2ce8f5'); // sapphire gem
        } else {
          // Wing plumes on left & right temples
          // Left wing
          api.line(X(11), Y(5), X(6), Y(1), '#ffffff', 2);
          api.line(X(11), Y(6), X(8), Y(2), '#c0cbdc', 1);
          api.px(X(5), Y(1), '#ffffff'); api.px(X(6), Y(1), '#ffffff');
          // Right wing
          api.line(X(20), Y(5), X(25), Y(1), '#ffffff', 2);
          api.line(X(20), Y(6), X(23), Y(2), '#c0cbdc', 1);
          api.px(X(26), Y(1), '#ffffff'); api.px(X(25), Y(1), '#ffffff');
          // Circlet
          api.line(X(11), Y(4), X(20), Y(4), '#c0cbdc', 1);
          if (!up) { api.px(X(15), Y(4), '#2ce8f5'); api.px(X(16), Y(4), '#2ce8f5'); }
        }

        // Golden braided hair falls
        if (!up && !side) {
          api.rect(X(9), Y(8), X(10), BY(15), '#fee761');
          api.rect(X(21), Y(8), X(22), BY(15), '#fee761');
          api.px(X(10), BY(15), '#feae34'); api.px(X(21), BY(15), '#feae34');
        }
      }
    });
  }

  /* ================= 3. BLACKSMITH ================= */
  // Leather artisan apron, thick beard, bare sinewy arms, heavy forging hammer.
  function blacksmithSuite() {
    return R.humanoidSuite(BLACKSMITH, 'rpg-blacksmith', {
      weapon: 'hammer',
      cast: true,
      castColors: ['#ff0044', '#f77622', '#fee761'],
      // rust-brown, a clear step off the near-black hair above it: matched values
      // merge hair and beard into one mask and the face disappears between them
      head: { beard: '#5e3f31', beardSh: '#3d281f', beardLong: false },
      post: (api, cfg) => {
        const bob = cfg.bob || 0, kb = cfg.kb || 0;
        const side = cfg.facing === 'side', up = cfg.facing === 'up';
        const X = x => x + kb, BY = y => y + bob;

        if (cfg.lying || up) return;

        /* The apron only reads as a garment if there is a garment UNDER it, so
           the torso is pale linen and the apron is the dark thing laid on it —
           the reverse of the first cut, which painted a darker apron over an
           apron-coloured shirt and produced one flat brown board. */
        const LTH = '#6b3f28', LTHi = '#8f5a38', LTHs = '#452718', STUD = '#feae34';
        if (side) {
          api.rect(X(12), BY(14), X(17), BY(24), LTH);
          api.rect(X(12), BY(14), X(13), BY(24), LTHi);      // lit front edge
          api.rect(X(12), BY(24), X(17), BY(24), LTHs);      // hem
          api.line(X(15), BY(11), X(16), BY(14), LTHs, 1);   // shoulder strap
          api.px(X(13), BY(17), STUD);
        } else {
          api.rect(X(11), BY(14), X(20), BY(24), LTH);       // full bib, shoulder to thigh
          api.rect(X(12), BY(15), X(19), BY(23), LTHi);      // sunlit panel
          api.rect(X(11), BY(24), X(20), BY(24), LTHs);      // hem, the heaviest line on it
          api.rect(X(11), BY(14), X(11), BY(24), LTHs); api.rect(X(20), BY(14), X(20), BY(24), LTHs);
          // crossed neck straps, dark against the linen collar
          api.line(X(12), BY(11), X(14), BY(14), LTHs, 1);
          api.line(X(19), BY(11), X(17), BY(14), LTHs, 1);
          // scorch marks: a smith's apron is not new
          api.px(X(14), BY(20), LTHs); api.px(X(17), BY(18), LTHs); api.px(X(15), BY(22), LTHs);
          api.px(X(12), BY(16), STUD); api.px(X(19), BY(16), STUD);   // brass studs
          api.rect(X(16), BY(19), X(18), BY(21), LTHs);               // tool pocket
          api.rect(X(16), BY(19), X(18), BY(19), '#c0cbdc');          // tongs poking out
        }
      }
    });
  }

  /* ================= 4. JESTER ================= */
  // Motley bi-color quartered doublet, floppy 3-pointed jester's hat with gold bells, trick magic.
  function jesterSuite() {
    return R.humanoidSuite(JESTER, 'rpg-jester', {
      weapon: 'sword',
      cast: true,
      castColors: ['#feae34', '#b55088', '#2ce8f5', '#63c74d'],
      post: (api, cfg) => {
        const bob = cfg.bob || 0, kb = cfg.kb || 0, hd = cfg.headDy || 0;
        const side = cfg.facing === 'side', up = cfg.facing === 'up';
        const X = x => x + kb, Y = y => y + bob + hd + 1, BY = y => y + bob;

        if (cfg.lying) return;

        // 3-Pointed Jester Cap with golden jingle bells
        if (side) {
          // Purple front lobe, gold back lobe
          api.line(X(15), Y(3), X(19), Y(1), '#68386c', 2);
          api.px(X(20), Y(1), '#fee761'); // bell
          api.line(X(12), Y(3), X(7), Y(1), '#feae34', 2);
          api.px(X(6), Y(1), '#fee761'); // bell
        } else {
          // Left horn (gold), center horn (purple), right horn (gold)
          api.line(X(12), Y(3), X(6), Y(1), '#feae34', 2);
          api.px(X(5), Y(1), '#fee761'); // bell left

          api.line(X(15), Y(2), X(16), Y(-3), '#68386c', 2);
          api.px(X(16), Y(-4), '#fee761'); // bell center

          api.line(X(19), Y(3), X(25), Y(1), '#feae34', 2);
          api.px(X(26), Y(1), '#fee761'); // bell right
        }

        // Jagged ruffled jester collar
        if (!up) {
          if (side) {
            api.px(X(16), BY(13), '#fee761');
            api.px(X(18), BY(14), '#68386c');
          } else {
            api.px(X(11), BY(13), '#fee761');
            api.px(X(13), BY(14), '#68386c');
            api.px(X(15), BY(13), '#fee761');
            api.px(X(18), BY(14), '#68386c');
            api.px(X(20), BY(13), '#fee761');
          }
        }
      }
    });
  }

  /* ================= 5. EXECUTIONER ================= */
  // Black executioner cowl with hollow eye slits, leather executioner harness, massive cleaving greataxe.
  function executionerSuite() {
    return R.humanoidSuite(EXECUTIONER, 'rpg-executioner', {
      weapon: 'axe',
      post: (api, cfg) => {
        const bob = cfg.bob || 0, kb = cfg.kb || 0, hd = cfg.headDy || 0;
        const side = cfg.facing === 'side', up = cfg.facing === 'up';
        const X = x => x + kb, Y = y => y + bob + hd, BY = y => y + bob;

        if (cfg.lying) return;

        // Black leather cowl covering whole head
        if (side) {
          api.rect(X(10), Y(2), X(21), Y(12), '#181425');
          api.rect(X(11), Y(3), X(18), Y(11), '#262b44');
          api.px(X(18), Y(6), '#e8ecf5'); // cold slit eye
          api.px(X(19), Y(6), '#ff0044');
        } else if (up) {
          api.rect(X(10), Y(2), X(21), Y(12), '#181425');
          api.rect(X(12), Y(3), X(19), Y(11), '#262b44');
        } else {
          api.rect(X(10), Y(2), X(21), Y(12), '#181425');
          api.rect(X(11), Y(3), X(20), Y(11), '#262b44');
          // Dual menacing narrow slit eye cutouts
          api.rect(X(13), Y(6), X(14), Y(6), '#e8ecf5');
          api.px(X(14), Y(6), '#ff0044');
          api.rect(X(17), Y(6), X(18), Y(6), '#e8ecf5');
          api.px(X(17), Y(6), '#ff0044');
        }

        // Heavy studded leather chest harness
        if (!up) {
          if (side) {
            api.line(X(12), BY(14), X(17), BY(21), '#181425', 1);
            api.px(X(14), BY(17), '#c0cbdc'); // iron stud
          } else {
            api.line(X(11), BY(14), X(19), BY(21), '#181425', 1);
            api.line(X(20), BY(14), X(12), BY(21), '#181425', 1);
            api.px(X(13), BY(15), '#c0cbdc'); api.px(X(18), BY(15), '#c0cbdc');
            api.px(X(15), BY(18), '#5a6988');
          }
        }
      }
    });
  }

  /* ================= 6. DEATH KNIGHT ================= */
  // Spiked gothic plate, runic death visor with glowing cyan eyes, frost runeblade & tattered shroud.
  function deathknightSuite() {
    return R.humanoidSuite(DEATHKNIGHT, 'rpg-deathknight', {
      weapon: 'sword',
      cast: true,
      castColors: ['#2ce8f5', '#00e436', '#ffffff'],
      garb: { cape: '#3e2347', capeSh: '#181425' },
      post: (api, cfg) => {
        const bob = cfg.bob || 0, kb = cfg.kb || 0, hd = cfg.headDy || 0;
        const side = cfg.facing === 'side', up = cfg.facing === 'up';
        const X = x => x + kb, Y = y => y + bob + hd + 1, BY = y => y + bob;

        if (cfg.lying) return;

        // Spiked gothic skull helm with spectral cyan runes
        if (side) {
          api.rect(X(10), Y(2), X(21), Y(11), '#262b44');
          api.line(X(11), Y(2), X(7), Y(-2), '#5a6988', 2); // backward sweeping horn
          api.px(X(6), Y(-2), '#2ce8f5');
          api.rect(X(18), Y(6), X(19), Y(6), '#2ce8f5'); // glowing cyan eye
          api.px(X(19), Y(7), '#00e436');
        } else if (up) {
          api.rect(X(10), Y(2), X(21), Y(11), '#262b44');
          api.line(X(11), Y(2), X(8), Y(-2), '#5a6988', 2);
          api.line(X(20), Y(2), X(23), Y(-2), '#5a6988', 2);
        } else {
          api.rect(X(10), Y(2), X(21), Y(11), '#262b44');
          // Dual horns
          api.line(X(11), Y(3), X(7), Y(-1), '#5a6988', 2); api.px(X(6), Y(-2), '#2ce8f5');
          api.line(X(20), Y(3), X(24), Y(-1), '#5a6988', 2); api.px(X(25), Y(-2), '#2ce8f5');
          // Glowing runic cyan eyes
          api.rect(X(13), Y(6), X(14), Y(7), '#2ce8f5'); api.px(X(13), Y(6), '#ffffff');
          api.rect(X(17), Y(6), X(18), Y(7), '#2ce8f5'); api.px(X(18), Y(6), '#ffffff');
          // Skull nasal & teeth grille
          api.px(X(15), Y(8), '#181425'); api.px(X(16), Y(8), '#181425');
          api.line(X(13), Y(10), X(18), Y(10), '#181425', 1);
        }

        // Spiked gothic pauldrons
        if (!up) {
          if (side) {
            api.rect(X(12), BY(13), X(16), BY(15), '#3a4466');
            api.px(X(14), BY(12), '#8b9bb4'); // spike
          } else {
            api.rect(X(8), BY(13), X(11), BY(15), '#3a4466'); api.px(X(9), BY(12), '#8b9bb4');
            api.rect(X(20), BY(13), X(23), BY(15), '#3a4466'); api.px(X(22), BY(12), '#8b9bb4');
            // Rune chest carving
            api.px(X(15), BY(16), '#2ce8f5'); api.px(X(16), BY(17), '#2ce8f5');
          }
        }
      }
    });
  }

  /* ================= 7. WARHORSE ================= */
  // Barded medieval destrier with steel chanfron, azure caparison & gold heraldry.
  /* A tapered segment. It walks the dominant axis and lays a run across the
     other one, which is what stops a diagonal limb from breaking into a dotted
     line, and it lerps the width, which is what stops a horse's leg from being
     the same plank from shoulder to hoof. */
  const wseg = (api, x0, y0, x1, y1, w0, w1, c, hi, lo) => {
    const dx = x1 - x0, dy = y1 - y0;
    const n = Math.max(1, Math.round(Math.max(Math.abs(dx), Math.abs(dy))));
    const vert = Math.abs(dy) >= Math.abs(dx);
    for (let i = 0; i <= n; i++) {
      const t = i / n, x = x0 + dx * t, y = y0 + dy * t, w = (w0 + (w1 - w0) * t) / 2;
      if (vert) {
        const l = Math.round(x - w), r = Math.round(x + w), yy = Math.round(y);
        api.rect(l, yy, r, yy, c);
        if (hi) api.px(l, yy, hi);
        if (lo && r > l) api.px(r, yy, lo);
      } else {
        const t0 = Math.round(y - w), b0 = Math.round(y + w), xx = Math.round(x);
        api.rect(xx, t0, xx, b0, c);
        if (hi) api.px(xx, t0, hi);
        if (lo && b0 > t0) api.px(xx, b0, lo);
      }
    }
  };
  const gauss = (u, c, w) => Math.exp(-Math.pow((u - c) / w, 2));

  function warhorseFrame(pose = {}) {
    return (buf, W, H) => {
      const api = apiFor(buf, W, H);
      const bob = pose.bob || 0, rear = pose.rear || 0, step = pose.step;
      const F = pose.flash;

      /* The old destrier was painted #262b44 over a #181425 outline — two
         values apart, so the whole animal collapsed into its own silhouette and
         the azure trapper was the only thing you could see. A bay coat gives
         the steel and the azure something to sit against. */
      const Coat = F ? '#ffffff' : '#6b4230';
      const CoatHi = F ? '#ffffff' : '#9c6242';
      const CoatSh = F ? '#c0cbdc' : '#40241a';
      const Far = F ? '#c0cbdc' : '#4d2f21';          // off-side limbs, a value back
      const Mane = F ? '#d4dae8' : '#241a22';         // black points
      const ManeHi = F ? '#ffffff' : '#4a3341';
      const Steel = F ? '#ffffff' : '#c0cbdc', SteelHi = '#ffffff';
      const SteelSh = F ? '#c0cbdc' : '#7b86a8';
      const Azure = F ? '#8b9bb4' : '#1a5fa8', AzureSh = F ? '#5a6988' : '#123f74';
      const Gold = F ? '#ffffff' : '#fee761', Strap = F ? '#c0cbdc' : '#3e2731';
      const Leather = F ? '#c0cbdc' : '#733e39';
      const Hoof = F ? '#8b9bb4' : '#2b2233';

      const bl = 4, br = 20, spn = br - bl;
      /* Rearing pivots on the hocks: the croup barely moves and the withers
         climb. Lerping the vertical offset along the barrel gets that for free,
         where the old frame just teleported the whole front half upward. */
      const tilt = x => bob - rear * Math.max(0, Math.min(1, (x - bl) / spn));
      const Y = y => y + bob - rear;                  // forehand space
      const G = y => y + bob;                         // hindquarters / ground

      /* ---- legs. A horse is mostly leg; the old frame gave it four 3x7 bars
         under a cloth that reached the floor, so it stood like a table. ---- */
      const swing = step === undefined ? 0 : 2.8;
      const lift = rear ? 0 : 3;
      const leg = (hx, ph, hind, col, hi) => {
        const a = ph * Math.PI * 2;
        const dx = Math.sin(a) * swing;
        const up = step === undefined ? 0 : Math.round(Math.max(0, Math.sin(a + Math.PI * 0.5)) * lift);
        const top = G(hind ? 15 : 14), knee = G(21), foot = G(26) - up;
        const kx = hx + dx * 0.35 + (hind ? -1.5 : 1.3);
        const fx = hx + dx;
        wseg(api, hx, top, kx, knee, hind ? 5 : 4, 2.4, col, hi, CoatSh);
        wseg(api, kx, knee, fx, foot - 1, 2.2, 1.6, col, hi);
        const r = Math.round(fx);
        api.rect(r - 1, foot, r + 1, foot + 1, Hoof);
        api.px(r - 1, foot, '#4a4360');               // light on the hoof wall
      };
      /* A rearing horse folds at the knee and the hoof tucks back under the
         chest. Straight bars pointing forward read as a table. */
      const foldFore = (sx0, sy, out, col, hi) => {
        const kx = sx0 + 4 + out, ky = sy - 1;
        wseg(api, sx0, sy, kx, ky, 4, 2.4, col, hi, CoatSh);    // upper arm, thrown forward
        wseg(api, kx, ky, kx - 1, ky + 5, 2.2, 1.6, col, hi);   // cannon tucked back under
        api.rect(kx - 2, ky + 5, kx, ky + 6, Hoof);
        api.px(kx - 2, ky + 5, '#4a4360');
      };

      /* Every leg goes down BEFORE the barrel. A caparison drapes OVER the
         shoulder and haunch — drawing the near legs last painted bare coat
         across the bottom half of the cloth and left a blue saddle blanket. */
      const ph0 = step !== undefined ? step : 0.25, ph1 = ph0 + 0.5;
      if (rear > 0) {
        leg(9, 0, true, Far, Far);
        leg(7, 0.08, true, Coat, CoatHi);
      } else {
        leg(9, ph1, true, Far, Far);
        leg(18, ph0, false, Far, Far);
        leg(7, ph0, true, Coat, CoatHi);
        leg(16, ph1, false, Coat, CoatHi);
      }

      /* ---- barrel ---- */
      const prof = x => {
        const u = Math.max(0.001, Math.min(0.999, (x - bl) / spn));
        const cap = Math.pow(Math.sin(u * Math.PI), 0.34);      // rounds both ends
        const top = 11 + (1 - cap) * 3.6
          - gauss(u, 0.18, 0.16) * 1.7                          // croup
          - gauss(u, 0.86, 0.15) * 2.1                          // withers
          + gauss(u, 0.52, 0.22) * 0.9;                         // loin dips between them
        const bot = 18 - (1 - cap) * 2.6
          + gauss(u, 0.80, 0.20) * 1.2                          // girth hangs deep
          - gauss(u, 0.40, 0.24) * 1.2;                         // flank tucks up
        return [Math.round(top), Math.round(bot)];
      };
      const topAt = [], botAt = [];
      for (let x = bl; x <= br; x++) {
        const o = tilt(x), [t0, b0] = prof(x);
        topAt[x] = t0 + o; botAt[x] = b0 + o;
        api.rect(x, topAt[x], x, botAt[x], Coat);
        api.px(x, topAt[x], CoatHi);                            // sun along the spine
        api.px(x, botAt[x], CoatSh);
      }

      /* ---- caparison: cloth draped ON the barrel, hem stopping well clear of
         the hocks so the legs still read ---- */
      const hemAt = [];
      for (let x = bl + 1; x <= br - 1; x++) {
        const t0 = topAt[x], b0 = botAt[x];
        const hem = Math.round(20 + tilt(x)) + (Math.sin((x - bl) * 1.2) > 0.3 ? 1 : 0);
        hemAt[x] = hem;
        api.rect(x, t0 + 1, x, hem - 1, Azure);
        api.px(x, t0 + 1, F ? '#ffffff' : '#2a7ac4');           // light on the fold crest
        api.rect(x, b0, x, hem - 1, AzureSh);                   // the skirt below the barrel
        api.px(x, hem, Gold);                                   // heraldic hem trim
      }
      /* One device, read off a single reference row — sampling topAt per corner
         made the cross a lightning bolt. */
      const cy0 = topAt[11] + 2;
      api.rect(10, cy0 + 1, 12, cy0 + 2, Gold);
      api.rect(11, cy0, 11, cy0 + 4, Gold);
      api.px(11, cy0 + 1, F ? '#c0cbdc' : '#f9a31b');

      /* ---- saddle over the withers ---- */
      const sx = 15, sTop = topAt[sx] - 1;
      api.rect(sx - 2, sTop + 1, sx + 3, sTop + 2, Leather);
      api.rect(sx - 2, sTop + 1, sx + 3, sTop + 1, F ? '#ffffff' : '#a05a4a');
      api.rect(sx - 3, sTop - 1, sx - 2, sTop + 2, Leather);    // cantle rises behind
      api.px(sx - 3, sTop - 1, F ? '#ffffff' : '#a05a4a');
      api.rect(sx + 3, sTop, sx + 4, sTop + 2, Leather);        // pommel
      api.rect(sx - 1, sTop + 3, sx - 1, sTop + 6, Strap);      // stirrup leather
      api.px(sx - 2, sTop + 7, Steel);                          // iron, a ring not a bar
      api.px(sx, sTop + 7, Steel);
      api.px(sx - 1, sTop + 7, SteelSh);
      api.px(sx - 1, sTop + 8, Steel);

      /* ---- tail: a mass, not a wire ---- */
      const tsw = pose.tailSw || 0, ty = topAt[bl] + 2;
      wseg(api, bl + 1, ty, bl - 2 + tsw * 0.4, ty + 4, 4, 3.4, Mane, ManeHi, ManeHi);
      wseg(api, bl - 2 + tsw * 0.4, ty + 4, bl - 3 + tsw, ty + 9, 3.4, 1.6, Mane, ManeHi);
      api.px(bl - 1, ty + 2, F ? '#ffffff' : '#6b4c5c');


      /* ---- neck, head, chanfron ---- */
      const hd = pose.headDy || 0;
      const nx0 = br - 2, ny0 = topAt[br];
      const pollX = 23, pollY = Y(6) + hd;
      /* An arched crest: the neck grows out of the withers and narrows to the
         poll. The old one was two stacked rectangles, which is why the head
         looked bolted on. */
      for (let i = 0; i <= 6; i++) {
        const t = i / 6;
        const x = Math.round(nx0 + (pollX - nx0) * t);
        const cy = Math.round(ny0 + (pollY + 2 - ny0) * t);
        const dep = Math.round(7 - t * 3);
        api.rect(x, cy, x, cy + dep, Coat);
        api.px(x, cy + dep, CoatSh);                            // throat in shade
        api.rect(x, cy, x, cy + 1, Mane);                       // mane along the crest
        if (i % 2) api.px(x, cy + 2, ManeHi);
      }
      api.rect(nx0 + 1, ny0 + 2, nx0 + 2, ny0 + 4, Steel);      // crinet lames
      api.px(nx0 + 1, ny0 + 3, SteelSh);
      api.px(nx0 + 2, ny0 + 4, SteelSh);

      /* Head: a wedge that narrows AND rakes down to the muzzle. */
      const hx = pollX, hy = pollY;
      for (let x = hx; x <= hx + 5; x++) {
        const t = (x - hx) / 5;
        const top = hy + Math.round(t * 4), bot = hy + 5 + Math.round(t * 2);
        api.rect(x, top, x, bot, Coat);
        api.px(x, bot, CoatSh);
      }
      // chanfron: a steel plate down the face, with a short spike at the poll
      for (let x = hx + 2; x <= hx + 5; x++) {
        const t = (x - hx) / 5, top = hy + Math.round(t * 4);
        api.rect(x, top, x, top + 1, Steel);
        api.px(x, top + 2, SteelSh);
      }
      api.px(hx + 3, hy + 2, SteelHi);                          // one specular, not a white face
      /* Rooted into the skull. Started a pixel clear of it, the spike became a
         floating island and the outline pass framed it as a brick. */
      api.rect(hx + 1, hy - 2, hx + 1, hy, Steel);
      api.px(hx + 1, hy - 2, SteelHi);
      // ear notched back off the poll
      api.px(hx, hy - 1, Mane);
      api.px(hx - 1, hy, Mane);
      // war eye set under the plate, with a socket shadow keeping it off the cheek
      api.px(hx + 3, hy + 3, CoatSh);
      api.px(hx + 3, hy + 4, F ? '#ffffff' : '#ff0044');
      // muzzle: coat, not a dark blob stuck on the end of the face
      api.rect(hx + 5, hy + 5, hx + 6, hy + 7, Coat);
      api.px(hx + 5, hy + 5, CoatHi);
      api.rect(hx + 5, hy + 7, hx + 6, hy + 7, CoatSh);         // lip in shade
      api.px(hx + 6, hy + 6, Mane);                             // nostril
      // browband, and a rein that runs UNDER the jaw back to the pommel
      api.px(hx + 2, hy + 4, Gold);
      api.line(hx + 4, hy + 7, nx0 + 1, ny0 + 4, Strap, 1);

      /* Forelegs of a rearing horse go down LAST. Behind the neck they were
         invisible, which left the rear cycle looking like a tilted idle. */
      if (rear > 0) {
        foldFore(20, Y(16), 0, Far, Far);
        foldFore(19, Y(17), 1, Coat, CoatHi);
      }

      finish(buf, W, H);
      if (pose.fade) PF.RPG.fadeOut(buf, W, H, pose.fade, 3);
    };
  }

  function warhorseSuite() {
    return {
      width: 32, height: 32, name: 'rpg-warhorse', layers: [{ name: 'Body' }],
      states: [
        // 1. Idle: breathing cycle, tail swish, steel armor shines, hooves planted
        D('idle', 5, true, [
          Fr(ms(5), warhorseFrame({ headDy: 0, tailSw: 0 })),
          Fr(ms(5), warhorseFrame({ headDy: -1, tailSw: -1 })),
          Fr(ms(5), warhorseFrame({ headDy: -1, tailSw: 1 })),
          Fr(ms(5), warhorseFrame({ headDy: 0, tailSw: 2 }))
        ]),
        // 2. Walk: disciplined trot with alternating strides
        D('walk', 6, true, [0, 1, 2, 3].map(i => Fr(ms(6), warhorseFrame({ step: i / 4, headDy: i % 2 ? -1 : 0 })))),
        // 3. Gallop: battle charge! Distinct 6-frame cosine height curve
        D('gallop', 10, true, [0, 1, 2, 3, 4, 5].map(i => {
          const a = (i / 6) * Math.PI * 2;
          const bob = Math.round(-Math.abs(Math.sin(a)) * 2 - Math.cos(a));
          return Fr(ms(10), warhorseFrame({ step: i / 6, bob, headDy: -1, tailSw: -2 }));
        })),
        // 4. Rear: rearing back onto powerful hind legs, forelegs striking
        D('rear', 6, true, [
          Fr(ms(6), warhorseFrame({ rear: 1, headDy: 0 })),
          Fr(ms(6), warhorseFrame({ rear: 3, headDy: -1 })),
          Fr(ms(6), warhorseFrame({ rear: 4, headDy: -2 })),
          Fr(ms(6), warhorseFrame({ rear: 2, headDy: -1 }))
        ]),
        // 5. Hurt
        D('hurt', 7, true, [
          Fr(ms(7), warhorseFrame({ flash: true, bob: 1 })),
          Fr(ms(7), warhorseFrame({ bob: -1, headDy: 1 }))
        ]),
        // 6. Death: collapse to ground
        D('death', 6, false, [
          Fr(ms(6), warhorseFrame({ bob: 1 })),
          Fr(ms(6), warhorseFrame({ rear: -2, bob: 3 })),
          Fr(ms(6), warhorseFrame({ bob: 4, fade: 0.3 })),
          Fr(ms(6), warhorseFrame({ bob: 5, fade: 0.7 }))
        ])
      ]
    };
  }

  /* ================= 8. GRIFFIN ================= */
  // Heraldic beast: Eagle head, raptor beak, feathered wings, lion hindquarters & razor talons.
  function griffinFrame(pose = {}) {
    return (buf, W, H) => {
      const api = apiFor(buf, W, H);
      const bob = pose.bob || 0, flap = pose.flap || 0, dive = pose.dive || 0;
      const Y = y => y + bob + dive;
      /* Rebuilt. The old form laid a cream rectangle over a tawny ellipse at
         nearly the same value, dropped the head ellipse straight onto the chest
         with no neck, and hid the folded wing BEHIND both — four tan shapes with
         no gap anywhere, which is why a heraldic beast rendered as a tan dog
         with a duck bill. It is now built like an animal in profile: lion barrel
         at the rear, eagle chest a full value above it, a neck that lifts the
         head clear of the shoulders, and the wing as the darkest mass on the
         sprite so the silhouette reads in three parts. */
      const FGold = pose.flash ? '#ffffff' : '#ead4aa';   // eagle plumage, the lightest value
      const FShade = pose.flash ? '#d4dae8' : '#b8a077';
      const LGold = pose.flash ? '#ffffff' : '#d77643';   // lion hide, a step below it
      const LShade = pose.flash ? '#c0cbdc' : '#9c4f38';
      const WMid = pose.flash ? '#c0cbdc' : '#7d5a34';    // wing coverts, darkest of the three
      const WHi = pose.flash ? '#ffffff' : '#c8a86c';
      const Talon = '#feae34', Beak = '#f77622', Eye = '#ff0044';
      const st = pose.step || 0, spread = pose.fly || dive > 0;

      /* A wing at 32px has to be a SHAPE, not a comb. The first cut alternated
         two values down a quill fan, which at this size is just noise — the
         flight frames read as a shredded brown cloud. One solid membrane, a lit
         leading edge, and dark scalloped tips along the trailing edge. */
      const WDk = pose.flash ? '#8b9bb4' : '#513a20';
      const wing = (rx, ry, tx, ty, drop, base, edge) => {
        for (let i = 0; i <= 7; i++) {
          const t = i / 7;
          const x = Math.round(rx + (tx - rx) * t), y = Math.round(ry + (ty - ry) * t);
          const d = Math.max(2, Math.round(drop * (1 - t * 0.55)));
          api.line(x, y, x, y + d, base, 2);
          if (i % 2 === 0) api.px(x, y + d, WDk);
        }
        api.line(rx, ry, tx, ty, edge, 2);
        api.px(tx, ty, WHi);
      };

      // 1. Far wing, behind everything and a step down in value
      if (spread) {
        if (flap === 1) wing(17, Y(12), 9, Y(3), 4, WMid, WMid);
        else if (flap === 2) wing(17, Y(14), 10, Y(21), 3, WMid, WMid);
        else wing(17, Y(13), 7, Y(10), 4, WMid, WMid);
      }

      // 2. Lion hindquarters: barrel, haunch, rump shadow
      api.ellipse(4, Y(13), 17, Y(22), LGold, true);
      api.ellipse(4, Y(18), 15, Y(22), LShade, true);        // underside in shadow
      api.ellipse(4, Y(14), 10, Y(21), LGold, true);         // haunch proud of the flank
      api.line(5, Y(14), 9, Y(13), pose.flash ? '#ffffff' : '#f0894f', 1);  // back light

      // 3. Eagle forequarters, stepped up a full value from the hide behind them
      api.ellipse(12, Y(11), 23, Y(21), FGold, true);
      api.ellipse(13, Y(16), 22, Y(21), FShade, true);       // breast underside
      api.line(13, Y(12), 20, Y(11), pose.flash ? '#ffffff' : '#fff6c9', 1);
      // breast feather scallops: two short rows, the only detail the chest needs
      for (let k = 0; k < 3; k++) { api.px(15 + k * 3, Y(15), FShade); api.px(16 + k * 3, Y(18), FShade); }

      // 4. Near wing: folded over the flank when perched, spread when airborne
      if (spread) {
        if (flap === 1) wing(16, Y(13), 3, Y(5), 6, WHi, WMid);
        else if (flap === 2) wing(16, Y(15), 4, Y(22), 5, WHi, WMid);
        else wing(16, Y(14), 2, Y(11), 6, WHi, WMid);
      } else {
        /* Folded: a long covert mass laid ON the flank, its trailing quills
           hanging past the hip. Behind the body and in the chest's own cream it
           was invisible twice over. */
        api.ellipse(6, Y(12), 18, Y(18), WMid, true);
        api.ellipse(7, Y(12), 17, Y(14), WHi, true);         // sunlit shoulder coverts
        api.line(8, Y(12), 16, Y(12), pose.flash ? '#ffffff' : '#e8d3a0', 1);
        for (let k = 0; k < 4; k++) {
          const x0 = 6 + k * 3;
          api.line(x0, Y(17), x0 + 1, Y(20 + k), WMid, 2);
          api.px(x0 + 1, Y(20 + k), pose.flash ? '#ffffff' : '#513a20');
        }
      }

      // 5. Lion tail, whipping, with a tuft the colour of the plumage
      /* Short. A tail that climbs to the top row with a cream tuft on the end
         reads as a balloon on a string and competes with the head for the eye. */
      const tw = pose.tailW || 0, td = spread ? 5 : 0;   // in flight it streams back, not up
      api.line(5, Y(19 + td), 2, Y(16 + tw + td), LShade, 2);
      api.line(2, Y(16 + tw + td), 3, Y(13 + tw + td), LGold, 2);
      api.ellipse(1, Y(11 + tw + td), 4, Y(14 + tw + td), LShade, true);
      api.ellipse(2, Y(11 + tw + td), 4, Y(13 + tw + td), LGold, true);

      // 6. Legs
      if (pose.fly) {
        api.rect(8, Y(21), 11, Y(24), LShade); api.rect(8, Y(23), 11, Y(24), LGold);
        api.rect(16, Y(20), 19, Y(23), FShade);
        api.rect(15, Y(23), 20, Y(24), Talon); api.px(20, Y(24), '#ffffff');
      } else if (dive > 0) {
        api.rect(9, Y(20), 12, Y(23), LShade);
        api.line(19, Y(19), 25, Y(22), Talon, 2);            // talons thrown forward
        api.line(19, Y(21), 25, Y(25), Talon, 2);
        api.px(26, Y(22), '#ffffff'); api.px(26, Y(25), '#ffffff');
      } else {
        // hind leg: hock kinks back, so it reads as feline rather than as a post
        api.rect(6 + st, Y(21), 9 + st, Y(23), LShade);      // thigh, shaded off the haunch
        api.line(5 + st, Y(20), 10 + st, Y(20), pose.flash ? '#c0cbdc' : '#6e3627', 1);  // hock crease
        api.rect(7 + st, Y(23), 9 + st, Y(26), LGold);       // shank takes the light
        api.rect(6 + st, Y(26), 11 + st, Y(27), LShade);     // paw
        api.px(11 + st, Y(27), Talon);
        // foreleg: scaled eagle shank down to a three-toed talon on the ground
        api.rect(17 - st, Y(20), 19 - st, Y(24), FShade);
        api.rect(17 - st, Y(20), 17 - st, Y(24), FGold);
        api.rect(15 - st, Y(25), 21 - st, Y(26), Talon);
        api.px(14 - st, Y(26), Talon); api.px(22 - st, Y(26), Talon);
        api.px(15 - st, Y(27), '#ffffff'); api.px(18 - st, Y(27), '#ffffff'); api.px(21 - st, Y(27), '#ffffff');
      }

      // 7. Neck and eagle head, carried clear of the shoulder line
      /* Head base y5 and flight bob capped at -3: the crest line sits at hy-1, so a
         deeper hop would push feathers off the top row and the outline pass would
         have nowhere to write. */
      const hd = pose.headDy || 0, hy = Y(5 + hd);
      api.line(20, Y(13), 22, Y(10), FGold, 4);              // neck, welded to the chest
      api.ellipse(18, hy, 25, hy + 7, FGold, true);
      api.ellipse(18, hy + 4, 23, hy + 7, FShade, true);     // under the jaw
      api.ellipse(18, hy, 22, hy + 3, pose.flash ? '#ffffff' : '#fff6c9', true);  // lit crown
      // crest feathers, swept back off the crown
      api.line(19, hy + 1, 15, hy - 1, FShade, 1);
      api.line(19, hy + 3, 14, hy + 2, FGold, 1);
      api.px(13, hy + 2, WHi);
      // hooked raptor beak: upper mandible overhangs, tip curls below the jaw
      api.rect(24, hy + 3, 28, hy + 5, Beak);
      api.rect(24, hy + 3, 28, hy + 3, Talon);               // lit ridge
      api.px(28, hy + 6, Beak); api.px(27, hy + 6, Beak);
      api.px(28, hy + 7, Talon);                             // the hook
      api.rect(24, hy + 6, 26, hy + 6, FShade);              // lower mandible line
      api.px(23, hy + 3, '#181425');                         // cere
      api.px(22, hy + 2, Eye); api.px(22, hy + 1, '#181425'); api.px(21, hy + 2, '#181425');

      finish(buf, W, H);
      if (pose.fade) PF.RPG.fadeOut(buf, W, H, pose.fade, 5);
    };
  }

  function griffinSuite() {
    return {
      width: 32, height: 32, name: 'rpg-griffin', layers: [{ name: 'Body' }],
      states: [
        // 1. Perch Idle: talons firmly planted at y=26..27, eagle head scanning, breathing
        D('perch_idle', 5, true, [
          Fr(ms(5), griffinFrame({ headDy: 0, tailW: 0 })),
          Fr(ms(5), griffinFrame({ headDy: 1, tailW: 1 })),
          Fr(ms(5), griffinFrame({ headDy: 1, tailW: -1 })),
          Fr(ms(5), griffinFrame({ headDy: 0, tailW: 2 }))
        ]),
        // 2. Stalk: low predatory crawl forward
        D('stalk', 6, true, [
          Fr(ms(6), griffinFrame({ step: 1, headDy: 1 })),
          Fr(ms(6), griffinFrame({ step: -1, headDy: 0 })),
          Fr(ms(6), griffinFrame({ step: 1, headDy: 1, tailW: 1 })),
          Fr(ms(6), griffinFrame({ step: -1, headDy: 0, tailW: -1 }))
        ]),
        // 3. Fly: majestic aerial flap cycle
        D('fly', 8, true, [
          Fr(ms(8), griffinFrame({ fly: true, flap: 1, bob: -3 })),
          Fr(ms(8), griffinFrame({ fly: true, flap: 2, bob: -1 })),
          Fr(ms(8), griffinFrame({ fly: true, flap: 0, bob: -3 })),
          Fr(ms(8), griffinFrame({ fly: true, flap: 1, bob: -2 }))
        ]),
        // 4. Dive Attack: swoop down with razor talons extended
        D('dive_attack', 10, true, [
          // wind-up, plunge, strike, recovery — the recovery must not be a copy
          // of the wind-up or the loop hitches on the wrap
          Fr(ms(10), griffinFrame({ fly: true, flap: 1, bob: -3 })),
          Fr(ms(10), griffinFrame({ dive: 3, flap: 2, bob: -1 })),
          Fr(ms(10), griffinFrame({ dive: 4, flap: 1, bob: 0 })),
          Fr(ms(10), griffinFrame({ fly: true, flap: 0, bob: -2 }))
        ]),
        // 5. Hurt
        D('hurt', 7, true, [
          Fr(ms(7), griffinFrame({ flash: true, bob: 1 })),
          Fr(ms(7), griffinFrame({ bob: -1, headDy: 1 }))
        ]),
        // 6. Death
        D('death', 6, false, [
          Fr(ms(6), griffinFrame({ bob: 1 })),
          Fr(ms(6), griffinFrame({ bob: 3, fade: 0.3 })),
          Fr(ms(6), griffinFrame({ bob: 4, fade: 0.6 })),
          Fr(ms(6), griffinFrame({ bob: 5, fade: 0.85 }))
        ])
      ]
    };
  }

  /* ================= 9. SIEGE ENGINES ================= */
  // Five medieval siege weapons: Catapult, Trebuchet, Ballista, Battering Ram, Pavise Mantlet.
  function siegeSuite() {
    const Wood = '#733e39', WoodHi = '#b86f50', WoodSh = '#3e2731';
    const Iron = '#5a6988', IronHi = '#c0cbdc', IronSh = '#262b44';
    const Stone = '#8b9bb4', Fire = '#f77622', FireHi = '#fee761';

    // 1. Catapult (4 frames: primed -> trigger release -> boulder launch -> recoil)
    const catapultFrames = [0, 1, 2, 3].map(fi => (buf, W, H) => {
      const api = apiFor(buf, W, H);
      // Wheels at ground y=25..27
      api.ellipse(5, 23, 9, 27, IronSh, true); api.px(7, 25, IronHi);
      api.ellipse(22, 23, 26, 27, IronSh, true); api.px(24, 25, IronHi);
      // Heavy timber base chassis
      api.rect(4, 21, 27, 23, Wood); api.rect(4, 23, 27, 23, WoodSh);
      // Tension upright posts
      api.rect(18, 11, 20, 21, Wood); api.rect(19, 11, 20, 21, WoodHi);
      api.rect(17, 10, 21, 12, Iron); // crossbar stop

      // Tension throwing arm
      if (fi === 0) { // Winched down loaded
        api.line(6, 21, 16, 17, WoodHi, 2);
        api.rect(5, 20, 7, 22, Iron); // cup
        api.ellipse(4, 18, 7, 21, Stone, true); // boulder
      } else if (fi === 1) { // Release whip
        api.line(10, 21, 19, 11, WoodHi, 2);
        api.ellipse(15, 9, 18, 12, Stone, true);
      } else if (fi === 2) { // Boulder launched!
        api.line(17, 21, 19, 9, WoodHi, 2);
        api.ellipse(22, 3, 26, 7, Stone, true); // flying rock
        api.line(19, 8, 22, 5, IronHi, 1); // speed trail
      } else { // Recoil settle
        api.line(14, 21, 18, 10, WoodHi, 2);
      }
      finish(buf, W, H);
    });

    // 2. Trebuchet (4 frames: counterweight drop & flaming projectile launch)
    const trebuchetFrames = [0, 1, 2, 3].map(fi => (buf, W, H) => {
      const api = apiFor(buf, W, H);
      // Ground timbers
      api.rect(3, 25, 28, 27, WoodSh);
      // A-frame support tower
      api.line(7, 25, 15, 12, Wood, 2);
      api.line(23, 25, 15, 12, Wood, 2);
      api.rect(13, 10, 17, 13, Iron); // axle pivot

      if (fi === 0) { // Ready: counterweight up, sling down
        api.rect(7, 8, 12, 14, IronSh); api.rect(8, 9, 11, 13, IronHi); // weight
        api.line(11, 10, 26, 21, WoodHi, 2); // long arm down
        api.rect(25, 23, 28, 25, Fire); // primed shot
      } else if (fi === 1) { // Rotating swing
        api.rect(9, 14, 13, 20, IronSh); // weight dropping
        api.line(12, 15, 22, 8, WoodHi, 2);
      } else if (fi === 2) { // Release apex!
        api.rect(11, 18, 15, 24, IronSh); // weight bottomed
        api.line(14, 18, 18, 3, WoodHi, 2); // arm straight up
        api.ellipse(21, 1, 25, 5, Fire, true); api.px(23, 3, FireHi); // fire shot
      } else { // Dampened swing
        api.rect(10, 16, 14, 22, IronSh);
        api.line(13, 17, 20, 6, WoodHi, 2);
      }
      finish(buf, W, H);
    });

    // 3. Ballista (4 frames: cocked bolt -> trigger release -> recoil sparks -> reload)
    const ballistaFrames = [0, 1, 2, 3].map(fi => (buf, W, H) => {
      const api = apiFor(buf, W, H);
      // Tripod wheeled stand
      api.rect(14, 18, 17, 26, Wood);
      api.line(14, 21, 6, 27, WoodSh, 2); api.line(17, 21, 25, 27, WoodSh, 2);
      // Rail stock
      api.rect(9, 15, 25, 18, WoodHi); api.rect(9, 17, 25, 18, WoodSh);

      if (fi === 0) { // Cocked with steel bolt
        api.line(12, 10, 16, 16, IronHi, 2); api.line(12, 22, 16, 16, IronHi, 2); // limbs back
        api.line(12, 10, 10, 16, IronSh, 1); api.line(12, 22, 10, 16, IronSh, 1); // string
        api.line(10, 16, 27, 16, IronHi, 2); // loaded bolt
        api.rect(26, 15, 28, 17, Iron); // bolt tip
      } else if (fi === 1) { // Snap release!
        api.line(18, 8, 16, 16, IronHi, 2); api.line(18, 24, 16, 16, IronHi, 2); // limbs snapped forward
        api.line(18, 8, 18, 24, IronSh, 1);
        api.line(26, 16, 31, 16, IronHi, 2); // flying bolt
        api.px(26, 15, FireHi); api.px(26, 17, FireHi); // muzzle sparks
      } else if (fi === 2) { // Recoil smoke
        api.line(17, 9, 16, 16, IronHi, 2); api.line(17, 23, 16, 16, IronHi, 2);
        api.px(23, 15, Stone); api.px(25, 16, Stone);
      } else { // Winch pulling back
        api.line(15, 10, 16, 16, IronHi, 2); api.line(15, 22, 16, 16, IronHi, 2);
        api.rect(9, 15, 11, 17, Iron);
      }
      finish(buf, W, H);
    });

    // 4. Battering Ram (4 frames: swing pullback -> forward ram impact -> sparks -> settle)
    const ramFrames = [0, 1, 2, 3].map(fi => (buf, W, H) => {
      const api = apiFor(buf, W, H);
      // Wheeled timber housing
      api.ellipse(6, 24, 10, 27, IronSh, true); api.ellipse(22, 24, 26, 27, IronSh, true);
      api.rect(4, 8, 28, 11, Wood); // pitched roof
      api.rect(3, 10, 29, 12, WoodHi);
      api.rect(5, 11, 7, 24, WoodSh); api.rect(25, 11, 27, 24, WoodSh);

      const rx = fi === 0 ? 11 : fi === 1 ? 7 : fi === 2 ? 18 : 14; // ram stroke offset
      // Suspension chains
      api.line(10, 11, rx - 2, 17, Iron, 1); api.line(22, 11, rx + 8, 17, Iron, 1);
      // Heavy iron-headed log ram
      api.rect(rx - 6, 16, rx + 10, 19, WoodHi);
      api.rect(rx + 9, 15, rx + 14, 20, IronHi); // sculpted ram head
      if (fi === 2) { // Impact sparks!
        api.px(rx + 15, 15, FireHi); api.px(rx + 16, 17, FireHi); api.px(rx + 15, 20, FireHi);
      }
      finish(buf, W, H);
    });

    // 5. Pavise Mantlet (3 frames: arrow slit barricade & archer volley)
    const mantletFrames = [0, 1, 2].map(fi => (buf, W, H) => {
      const api = apiFor(buf, W, H);
      // Wheels & rear brace on ground y=26..27
      api.ellipse(6, 24, 10, 27, IronSh, true);
      api.line(8, 23, 2, 27, WoodSh, 2); // angled timber kickstand
      // Heavy vertical timber wall with iron braces
      api.rect(8, 7, 22, 25, Wood);
      api.rect(8, 7, 22, 8, WoodHi);
      api.line(8, 12, 22, 12, Iron, 1); api.line(8, 21, 22, 21, Iron, 1);
      // Arrow slit
      api.rect(14, 13, 16, 18, IronSh);

      if (fi === 1) { // Arrow firing out
        api.line(15, 15, 30, 15, '#c28569', 1);
        api.px(30, 15, IronHi); // tip
        api.px(17, 14, FireHi); api.px(17, 16, FireHi);
      } else if (fi === 2) {
        api.px(18, 15, Stone); // smoke puff
      }
      finish(buf, W, H);
    });

    return {
      width: 32, height: 32, name: 'rpg-siege', layers: [{ name: 'Body' }],
      states: [
        D('catapult', 6, true, catapultFrames.map(p => Fr(ms(6), p))),
        D('trebuchet', 6, true, trebuchetFrames.map(p => Fr(ms(6), p))),
        D('ballista', 7, true, ballistaFrames.map(p => Fr(ms(7), p))),
        D('battering_ram', 6, true, ramFrames.map(p => Fr(ms(6), p))),
        D('mantlet', 4, true, mantletFrames.map(p => Fr(ms(4), p)))
      ]
    };
  }

  /* ================= 10. CASTLE KEEP ================= */
  // Eight castle interior & architecture features:
  // Portcullis, Wall Brazier, Royal Throne, Weapon Rack, Pillory Stocks, War Council Table, Royal Banner, Wheel Chandelier.
  function castleSuite() {
    const Stone = '#8b9bb4', StoneSh = '#5a6988', StoneHi = '#c0cbdc';
    const Wood = '#733e39', WoodHi = '#b86f50', WoodSh = '#3e2731';
    const Iron = '#3a4466', IronHi = '#8b9bb4', IronSh = '#262b44';
    const Gold = '#fee761', Crimson = '#a22633', Azure = '#124e89';

    // 1. Portcullis (4 frames: closed spikes -> winch raising -> open)
    const portcullisFrames = [0, 1, 2, 3].map(fi => (buf, W, H) => {
      const api = apiFor(buf, W, H);
      // Stone archway pillars & lintel
      api.rect(3, 2, 8, 27, Stone); api.rect(7, 2, 8, 27, StoneSh);
      api.rect(24, 2, 29, 27, Stone); api.rect(24, 2, 25, 27, StoneHi);
      api.rect(3, 2, 29, 6, Stone); api.rect(3, 5, 29, 6, StoneSh);

      const lift = fi * 4;
      // Heavy iron-spiked timber grate
      for (let x = 9; x <= 23; x += 3) {
        api.line(x, Math.max(5, 7 - lift), x, 25 - lift, WoodHi, 2);
        api.px(x, 26 - lift, IronHi); // spike tip
      }
      for (let y = 10 - lift; y <= 24 - lift; y += 5) {
        if (y >= 6 && y <= 26) api.line(9, y, 23, y, Iron, 1);
      }
      finish(buf, W, H);
    });

    // 2. Wall Brazier (4 frames: wrought iron bowl & leaping flames)
    const brazierFrames = [0, 1, 2, 3].map(fi => (buf, W, H) => {
      const api = apiFor(buf, W, H);
      // Iron stand at y=18..27
      api.line(16, 18, 10, 27, Iron, 2); api.line(16, 18, 22, 27, Iron, 2);
      api.line(16, 18, 16, 27, IronSh, 2);
      // Wrought iron fire bowl
      api.ellipse(9, 14, 23, 19, IronSh, true);
      api.ellipse(10, 15, 22, 18, IronHi, true);
      // Leaping medieval flame
      const f1 = fi === 0 ? 0 : fi === 1 ? -2 : fi === 2 ? 1 : -1;
      const f2 = fi === 0 ? 1 : fi === 1 ? -1 : fi === 2 ? -2 : 0;
      api.ellipse(12, 10 + f1, 20, 16, '#ff0044', true);
      api.ellipse(13, 8 + f2, 19, 14, '#f77622', true);
      api.ellipse(14, 7 + f1, 18, 11, Gold, true);
      api.px(16, 5 + f2, '#ffffff');
      // Embers
      api.px(11 + fi * 2, 5 + (fi % 3), Gold);
      api.px(19 - fi * 2, 6 + (fi % 2), '#ff0044');
      finish(buf, W, H);
    });

    // 3. Royal Throne (4 frames: velvet cushion, sculpted gold lions, torchlight gleams, canopy)
    const throneFrames = [0, 1, 2, 3].map(fi => (buf, W, H) => {
      const api = apiFor(buf, W, H);
      // Granite dais step at y=25..27
      api.rect(4, 25, 28, 27, Stone); api.rect(4, 25, 28, 25, StoneHi);
      // Royal wall tapestry behind throne
      const tw = fi === 0 ? 0 : fi === 1 ? 1 : fi === 2 ? 0 : -1;
      api.rect(6 + tw, 2, 26 + tw, 24, '#1c2a44');
      api.rect(7 + tw, 2, 8 + tw, 24, Gold); api.rect(24 + tw, 2, 25 + tw, 24, Gold);
      // High carved oak throne back
      api.rect(9, 4, 23, 24, Wood); api.rect(9, 4, 10, 24, WoodHi);
      api.rect(13, 2, 19, 5, Gold); // carved crown top
      api.px(16, 1, '#ffffff');
      // Crimson velvet upholstery
      api.rect(11, 7, 21, 21, Crimson);
      api.line(16, 7, 16, 21, '#5c1a1a', 1); // center tuft crease
      // Dynamic velvet sheen highlight
      const sy = [8, 12, 16, 11][fi];
      api.line(12, sy, 15, sy, '#ff0044', 1);
      api.line(17, sy + 1, 20, sy + 1, '#ff0044', 1);
      // Gold lion armrests
      api.rect(7, 17, 10, 24, Gold); api.rect(22, 17, 25, 24, Gold);
      api.px(8, 16, '#ffffff'); api.px(23, 16, '#ffffff'); // lion heads
      // Dias torchlight reflection
      api.rect(10 + fi * 2, 25, 14 + fi * 2, 25, Gold);
      finish(buf, W, H);
    });

    // 4. Weapon Rack (4 frames: broadswords & polearms with sweeping blade gleams & torchlight)
    const rackFrames = [0, 1, 2, 3].map(fi => (buf, W, H) => {
      const api = apiFor(buf, W, H);
      // Oak timber rack structure
      api.rect(4, 24, 28, 26, Wood); api.rect(4, 26, 28, 27, WoodSh);
      api.rect(6, 10, 8, 25, WoodHi); api.rect(24, 10, 26, 25, WoodHi);
      api.rect(6, 13, 26, 15, Wood);
      // Halberd / polearm (left)
      api.line(10, 3, 10, 24, '#b86f50', 2);
      api.rect(9, 4, 13, 7, IronHi); api.px(10, 2, IronHi);
      api.px(12, 5, Iron); // hook
      // Broadsword (center)
      api.line(16, 7, 16, 24, IronHi, 2);
      api.line(13, 10, 19, 10, Gold, 1); // crossguard
      api.rect(15, 7, 17, 9, '#733e39'); // pommel & grip
      // Kite shield (right)
      P().kiteShield(api, 22, 19, '#ffffff', IronHi, Crimson);
      // Sweeping 3-pixel blade gleams
      const gy1 = 5 + fi * 3, gy2 = 8 + ((fi + 2) % 4) * 3;
      api.rect(9, gy1, 10, gy1 + 1, '#ffffff');
      api.rect(15, gy2, 16, gy2 + 1, '#ffffff');
      // Torchlight reflection along rack timber
      const tx = 9 + fi * 3;
      api.line(tx, 14, tx + 3, 14, Gold, 1);
      finish(buf, W, H);
    });

    // 5. Stocks (4 frames: village square wooden pillory & struggling captive)
    const stocksFrames = [0, 1, 2, 3].map(fi => (buf, W, H) => {
      const api = apiFor(buf, W, H);
      // Upright heavy timbers anchored to ground y=26..27
      api.rect(5, 10, 8, 27, Wood); api.rect(5, 10, 6, 27, WoodHi);
      api.rect(24, 10, 27, 27, Wood); api.rect(24, 10, 25, 27, WoodHi);
      // Base support planks
      api.rect(3, 25, 29, 27, WoodSh);
      // Double hinged neck & wrist beam
      api.rect(7, 13, 25, 19, Wood);
      api.line(7, 16, 25, 16, IronSh, 1); // hinge split
      // Cutouts
      api.ellipse(9, 14, 12, 17, IronSh, true);
      api.ellipse(14, 14, 18, 17, IronSh, true);
      api.ellipse(20, 14, 23, 17, IronSh, true);
      // Iron padlock on right hasp
      const py = [17, 18, 19, 18][fi];
      api.rect(22, py, 24, py + 3, IronHi); api.px(23, py + 1, IronSh);

      // Pilloried captive head in center hole
      const hdx = [0, 1, 0, -1][fi], hdy = [0, -1, 0, 1][fi];
      api.rect(14 + hdx, 9 + hdy, 18 + hdx, 14 + hdy, '#f2c094'); // face
      api.rect(14 + hdx, 8 + hdy, 18 + hdx, 9 + hdy, '#733e39'); // unkempt hair
      api.px(15 + hdx, 11 + hdy, '#181425'); api.px(17 + hdx, 11 + hdy, '#181425'); // eyes
      // Hands locked in wrist holes
      api.rect(9, 14 + (fi % 2), 11, 16 + (fi % 2), '#f2c094');
      api.rect(20, 14 + ((fi + 1) % 2), 22, 16 + ((fi + 1) % 2), '#f2c094');
      finish(buf, W, H);
    });

    // 6. War Table (4 frames: strategy map, miniature keeps, candles flickering)
    const warTableFrames = [0, 1, 2, 3].map(fi => (buf, W, H) => {
      const api = apiFor(buf, W, H);
      // Solid oak table legs & stretcher
      api.rect(6, 20, 9, 27, WoodSh); api.rect(23, 20, 26, 27, WoodSh);
      api.rect(6, 23, 26, 24, Wood);
      // Massive table top
      api.rect(4, 16, 28, 20, Wood); api.rect(4, 16, 28, 17, WoodHi);
      // Unrolled parchment map
      api.rect(8, 15, 24, 18, '#ead4aa');
      api.line(10, 16, 15, 17, '#3e8948', 1); // forest line
      api.line(17, 16, 21, 16, Azure, 1); // river line
      // Miniature castle token & dagger
      api.rect(12, 13, 14, 15, Stone); api.px(13, 12, Crimson);
      api.line(19, 13, 19, 16, IronHi, 1); // dagger stuck in map
      // Two candles on brass plates with dynamic 4-frame flicker & sparks
      const f1 = [0, -1, 1, 0][fi], f2 = [1, 0, -1, 0][fi];
      api.rect(6, 13, 7, 15, '#ffffff'); api.px(6 + f1, 11, Gold); api.px(6, 10, '#ffffff');
      api.rect(25, 13, 26, 15, '#ffffff'); api.px(25 + f2, 11, Gold); api.px(25, 10, '#ffffff');
      // Warm candle glow radius on parchment
      const gx = 10 + fi * 3;
      api.line(gx, 17, gx + 2, 17, '#feae34', 1);
      finish(buf, W, H);
    });

    // 7. Royal Banner (4 frames: split azure & crimson heraldic lion banner rippling)
    const bannerFrames = [0, 1, 2, 3].map(fi => (buf, W, H) => {
      const api = apiFor(buf, W, H);
      // Wall brass rod & finials
      api.line(5, 3, 27, 3, Gold, 2);
      api.px(4, 3, IronHi); api.px(28, 3, IronHi);

      // Hanging tapestry with draft wave
      for (let y = 5; y <= 25; y++) {
        const wave = Math.round(Math.sin((y / 5) + fi) * 1.2);
        // Left azure field
        api.rect(7 + wave, y, 16 + wave, y, Azure);
        // Right crimson field
        api.rect(17 + wave, y, 25 + wave, y, Crimson);
      }
      // Gold Rampant Lion heraldic crest
      const cw = Math.round(Math.sin(3 + fi) * 1.2);
      api.rect(14 + cw, 10, 18 + cw, 15, Gold);
      api.px(16 + cw, 9, Gold); // head
      api.px(18 + cw, 11, Gold); api.px(18 + cw, 14, Gold); // paws
      // Bottom gold bullion fringe
      const bw = Math.round(Math.sin(5 + fi) * 1.2);
      api.rect(7 + bw, 25, 25 + bw, 27, Gold);
      finish(buf, W, H);
    });

    // 8. Wheel Chandelier (4 frames: circular iron chandelier with 6 flickering candles)
    const chandelierFrames = [0, 1, 2, 3].map(fi => (buf, W, H) => {
      const api = apiFor(buf, W, H);
      // Suspension chains anchored to ceiling
      api.line(16, 1, 7, 14, Iron, 1);
      api.line(16, 1, 25, 14, Iron, 1);
      api.line(16, 1, 16, 14, IronSh, 1);
      // Circular iron wheel ring
      api.ellipse(6, 13, 26, 19, IronSh, true);
      api.ellipse(7, 14, 25, 18, IronHi, false);
      // 5 tallow candles with animated flames
      const cxs = [8, 12, 16, 20, 24];
      cxs.forEach((cx, idx) => {
        api.rect(cx - 1, 12, cx, 14, '#ead4aa');
        const f = (fi + idx) % 4;
        const fy = f === 0 ? 10 : f === 1 ? 9 : f === 2 ? 10 : 11;
        api.px(cx, fy, Gold);
        if (f < 2) api.px(cx, fy - 1, '#ffffff');
      });
      finish(buf, W, H);
    });

    return {
      width: 32, height: 32, name: 'rpg-castle', layers: [{ name: 'Body' }],
      states: [
        D('portcullis', 5, true, portcullisFrames.map(p => Fr(ms(5), p))),
        D('brazier', 8, true, brazierFrames.map(p => Fr(ms(8), p))),
        D('throne', 4, true, throneFrames.map(p => Fr(ms(4), p))),
        D('weapon_rack', 4, true, rackFrames.map(p => Fr(ms(4), p))),
        D('stocks', 4, true, stocksFrames.map(p => Fr(ms(4), p))),
        D('war_table', 4, true, warTableFrames.map(p => Fr(ms(4), p))),
        D('royal_banner', 6, true, bannerFrames.map(p => Fr(ms(6), p))),
        D('chandelier', 7, true, chandelierFrames.map(p => Fr(ms(7), p)))
      ]
    };
  }

  return {
    crusaderSuite,
    valkyrieSuite,
    blacksmithSuite,
    jesterSuite,
    executionerSuite,
    deathknightSuite,
    warhorseSuite,
    griffinSuite,
    siegeSuite,
    castleSuite
  };
})();
