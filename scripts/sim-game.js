#!/usr/bin/env node
/* Headless game simulator.

   The sprite gates prove the art is sound and check-pages proves the markup
   wires up, but neither one ever EXECUTES a game. This does: it stands up a
   throwaway DOM, loads the engine through lib-boot, evals the game's own
   scripts, then drives a few thousand animation frames with synthetic input —
   move, aim, fire, reload, pause, resize, die, restart. A typo, a missing
   state name, a null deref in the spawn path: anything that would throw in a
   real player's first minute throws here instead, in CI, with a stack trace.

   Usage: node scripts/sim-game.js [gameDir] [frames] */
const fs = require('fs');
const path = require('path');
const { boot, ROOT } = require('./lib-boot');
const { makeDom, installGlobals, loadScripts } = require('./dom-stub');

/* Per-game hooks: how to get past the title screen, and what the HUD must
   show afterwards for the run to count as real. */
const GAMES = {
  'games/nightfall': {
    start(doc) {
      const picker = doc.byId['picker'];
      const first = picker && picker.children[0];
      if (!first) throw new Error('nightfall: title screen produced no class buttons');
      first.emit('click', {});
      if (!doc.byId['screen-title'].classList.contains('hidden'))
        throw new Error('nightfall: picking a class did not dismiss the title screen');
    },
    /* A loop that runs without throwing but never ticks the world would still
       "pass", so assert the HUD actually moved and that shots connect. */
    check(doc) {
      const clock = doc.byId['clock-txt'].textContent;
      if (!/^\d\d:\d\d$/.test(clock) || clock === '00:00')
        throw new Error('nightfall: clock never advanced (' + clock + ')');
      const hp = Number(doc.byId['hp-txt'].textContent);
      if (!(hp >= 0)) throw new Error('nightfall: hp readout is not a number');
      const ammo = doc.byId['am-txt'].textContent;
      if (!/^\d+ \/ \d+$/.test(ammo)) throw new Error('nightfall: ammo readout malformed (' + ammo + ')');
      const score = Number(doc.byId['score-txt'].textContent);
      if (!(score > 0))
        throw new Error('nightfall: thousands of rounds went into a horde and nothing died — ' +
          'bullet/enemy collision is broken');
      return `clock ${clock}, hp ${hp}, ammo ${ammo}, score ${score}, ${doc.byId['wave-txt'].textContent}`;
    }
  },
  'games/ironvale': {
    start(doc) {
      const picker = doc.byId['picker'];
      const first = picker && picker.children[0];
      if (!first) throw new Error('ironvale: title screen produced no class buttons');
      first.emit('click', {});
      if (!doc.byId['screen-title'].classList.contains('hidden'))
        throw new Error('ironvale: picking a class did not dismiss the title screen');
    },
    /* The keep meter is the one readout no other gate can fake: it only moves
       when a foe walked the lattice, found the tower and swung at it. */
    check(doc) {
      const clock = doc.byId['clock-txt'].textContent;
      if (!/^\d\d:\d\d$/.test(clock) || clock === '00:00')
        throw new Error('ironvale: clock never advanced (' + clock + ')');
      const hp = Number(doc.byId['hp-txt'].textContent);
      if (!(hp >= 0)) throw new Error('ironvale: hp readout is not a number');
      const keep = Number(doc.byId['keep-txt'].textContent);
      if (!(keep >= 0)) throw new Error('ironvale: keep readout is not a number');
      const renown = Number(doc.byId['score-txt'].textContent);
      if (!(renown > 0))
        throw new Error('ironvale: a whole warband walked into a swinging sword and ' +
          'nothing died \u2014 melee/foe collision is broken');
      return `clock ${clock}, hp ${hp}, keep ${keep}, renown ${renown}, ${doc.byId['wave-txt'].textContent}`;
    }
  },
  'games/hearthhold': {
    /* A colony sim runs on its own clock rather than the player's reflexes, so
       the harness picks the hardest, shortest day and then winds the game
       speed up to 3x. That buys roughly four in-game days out of the frame
       budget, which is enough for the stores to run out and the raids to
       start — a settlement nobody builds in is supposed to die. */
    start(doc) {
      const picker = doc.byId['picker'];
      if (!picker || picker.children.length < 3)
        throw new Error('hearthhold: title screen produced no difficulty buttons');
      picker.children[picker.children.length - 1].emit('click', {});
      if (!doc.byId['screen-title'].classList.contains('hidden'))
        throw new Error('hearthhold: picking a difficulty did not dismiss the title screen');
      doc.byId['btn-spd3'].emit('click', {});
    },
    /* The population readout is the one number no other gate can fake: it only
       falls when a villager was actually simulated — walked, starved, or was
       cut down — so it proves the colony AI ran and not merely the renderer. */
    check(doc) {
      const clock = doc.byId['clock-txt'].textContent;
      if (!/^\d\d:\d\d$/.test(clock) || clock === '07:00')
        throw new Error('hearthhold: clock never advanced (' + clock + ')');
      if (!/^DAY \d+$/.test(doc.byId['day-txt'].textContent))
        throw new Error('hearthhold: day counter malformed (' + doc.byId['day-txt'].textContent + ')');
      const pop = doc.byId['pop-txt'].textContent;
      if (!/^\d+ \/ \d+$/.test(pop))
        throw new Error('hearthhold: population readout malformed (' + pop + ')');
      const alive = Number(pop.split(' / ')[0]);
      if (!(alive < 4))
        throw new Error('hearthhold: four settlers sat through four days with no food and ' +
          'no walls and none of them came to harm \u2014 the villager tick is not running');
      const renown = Number(doc.byId['score-txt'].textContent);
      if (!(renown >= 0)) throw new Error('hearthhold: renown readout is not a number');
      return `clock ${clock}, ${doc.byId['day-txt'].textContent}, pop ${pop}, renown ${renown}`;
    }
  }
};

const KEYS = ['w', 'd', 's', 'a', 'w', ' ', 'r', 'd'];

/* Aim must orbit the VIEWPORT centre. A circle in some arbitrary corner of the
   canvas only ever points the gun one way, which quietly turns "can bullets
   hit anything?" into a coin flip. */
const sweep = i => {
  const r = Math.min(global.innerWidth, global.innerHeight) * 0.4;
  return { clientX: global.innerWidth / 2 + Math.cos(i * 0.031) * r,
    clientY: global.innerHeight / 2 + Math.sin(i * 0.031) * r };
};

/* A gate that passes nineteen runs in twenty is not a gate. Both games seed
   their spawns and their aim spread from Math.random(), so whether a bullet
   ever met an enemy inside the sim's frame budget was a coin flip — and
   "thousands of rounds went into a horde and nothing died" is precisely the
   regression this harness exists to catch, so it must not fire at random.
   Every run now draws from the same xorshift stream.
   Both games ALSO seed their world generator from Date.now(), so the map
   itself differed run to run; the wall clock is pinned to a fixed epoch and
   advanced one frame at a time to match the harness's own rAF clock. */
function seedRandom() {
  const realRandom = Math.random, realNow = Date.now;
  let s = 0x9e3779b9, t = 1700000000000;
  Math.random = () => {
    s ^= s << 13; s ^= s >>> 17; s ^= s << 5; s |= 0;
    return (s >>> 0) / 4294967296;
  };
  Date.now = () => (t += 1000 / 60);
  return () => { Math.random = realRandom; Date.now = realNow; };
}

function run(rel, frames) {
  const restoreRandom = seedRandom();
  try { return runGame(rel, frames); } finally { restoreRandom(); }
}

function runGame(rel, frames) {
  const dir = path.join(ROOT, rel);
  const page = path.join(dir, 'index.html');
  if (!fs.existsSync(page)) throw new Error(rel + ': no index.html');
  const html = fs.readFileSync(page, 'utf8');

  boot();                                    // global.window = global, global.PF
  const doc = makeDom(html);
  const { emit, pump } = installGlobals(doc);
  try { loadScripts(html, dir); }
  catch (e) { throw new Error(rel + ': ' + e.message); }

  const cfg = GAMES[rel] || {};
  if (cfg.start) cfg.start(doc);

  let pumped = 0;
  const step = () => { if (!pump()) throw new Error(rel + ': the animation loop stopped'); pumped++; };

  /* Phase one: a player flailing at the controls. */
  for (let i = 0; i < frames; i++) {
    if (i % 40 === 0) emit('keydown', { key: KEYS[(i / 40 | 0) % KEYS.length] });
    if (i % 40 === 30) emit('keyup', { key: KEYS[(i / 40 | 0) % KEYS.length] });
    if (i % 3 === 0 && doc.byId['cv']) doc.byId['cv'].emit('mousemove', sweep(i));
    if (i === 30 && doc.byId['cv']) doc.byId['cv'].emit('mousedown', {});
    if (i === 1200) { global.innerWidth = 520; global.innerHeight = 900; emit('resize', {}); }
    if (i === 1250 && doc.byId['btn-pause']) doc.byId['btn-pause'].emit('click', {});
    if (i === 1300 && doc.byId['btn-pause']) doc.byId['btn-pause'].emit('click', {});
    if (i === 1320 && doc.byId['btn-mute']) doc.byId['btn-mute'].emit('click', {});
    step();
  }

  /* Release everything: a key left down sends the player sprinting away from
     the horde, and the phase below is meant to be a last stand. */
  for (const k of KEYS) emit('keyup', { key: k });

  /* Phase two: stand and shoot until it ends. The game-over and restart paths
     are the two least-travelled branches in any arcade game; run them. */
  let died = false;
  const over = doc.byId['screen-over'];
  for (let i = 0; i < 4000 && !died; i++) {
    if (i % 3 === 0 && doc.byId['cv']) doc.byId['cv'].emit('mousemove', sweep(i));
    step();
    if (over && !over.classList.contains('hidden')) died = true;
  }
  if (over && !died) throw new Error(rel + ': the player never died while standing in a horde');

  const note = cfg.check ? cfg.check(doc) : '';   // read the HUD before restart wipes it

  if (over) {
    const again = doc.byId['btn-again'];
    if (!again) throw new Error(rel + ': no restart button');
    again.emit('click', {});
    if (!over.classList.contains('hidden'))
      throw new Error(rel + ': restart did not clear the game-over screen');
    for (let i = 0; i < 300; i++) step();
  }
  return { pumped, note: note + (died ? ', died + restarted cleanly' : '') };
}

const only = process.argv[2];
const frames = Number(process.argv[3] || 1800);
const targets = only ? [only.replace(/\/+$/, '')] : Object.keys(GAMES);
let fail = 0;
for (const rel of targets) {
  try {
    const r = run(rel, frames);
    console.log(`  ${rel}: ${r.pumped} frames simulated, no exceptions` + (r.note ? ` — ${r.note}` : ''));
  } catch (e) {
    fail++;
    console.log('FAIL: ' + (e.stack || e.message));
  }
}
console.log(`\nGAME SIM: ${targets.length - fail} pass, ${fail} fail`);
process.exit(fail ? 1 : 0);
