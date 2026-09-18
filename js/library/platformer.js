/* PixelForge Studio — Platformer pack.
   Side-scrollers bind a very different action set from a top-down RPG: jump
   arcs, a fall pose, a crouch, and enemies that squash. PF.Platform builds that
   on the shared side-view humanoid rig (tunic, tool and headgear code reused)
   plus bespoke rigs for the baddies, blocks and hazards.

   Movement vocabulary: idle / walk / run / jump_rise / fall / crouch / attack /
   hurt / death. `jump*` and `fall` are airborne by design, which the quality
   gate already knows about.

   States are built with `anim()`/`one()` rather than nested array literals: a
   suite of six states with five frames each is otherwise an unreadable run of
   closing brackets, and that is exactly where art bugs hide. */
window.PF = window.PF || {};
PF.Platform = (() => {
  const P = () => PF.Pixel, C = h => PF.Color.hexToU32(h);
  const OUT = '#181425', OUT32 = C(OUT);
  const PI2 = Math.PI * 2;
  const ms = fps => Math.round(1000 / fps);
  const Fr = (duration, paint) => ({ duration, paint });
  const D = (name, fps, loop, frames) => ({ name, fps, loop, frames });
  /* frames from a cfg list: mk(cfg, i) -> painter. `cfg.d` overrides the frame
     duration, so uneven timing (windup / impact / recover) stays declarative. */
  const anim = (name, fps, loop, cfgs, mk) => D(name, fps, loop, cfgs.map((c, i) => Fr(c && c.d ? c.d : ms(fps), mk(c, i))));
  const one = (name, apiFn) => D(name, 1, true, [Fr(1000, fx(apiFn))]);
  const oneRaw = (name, paint) => D(name, 1, true, [Fr(1000, paint)]);
  const api32 = (buf, fn) => { const a = P().makeApi(buf, 32, 32); fn(a); buf.set(PF.Raster.outline(buf, 32, 32, OUT32)); };
  const fx = fn => (buf) => api32(buf, fn);
  const N = cfg => (buf, W, H) => { const api = P().makeApi(buf, W, H); PF.Chars.drawHumanoid(api, buf, W, H, cfg); };
  const lying = extra => (buf, W, H) => {
    const api = P().makeApi(buf, W, H);
    PF.Chars.drawLying(api, buf, W, H, { pal: extra.pal, eye: 'dead' });
    buf.set(PF.Raster.outline(buf, W, H, OUT32));
    if (extra.debris) for (const [x, y, c] of extra.debris) api.px(x, y, c);
  };
  const SP = (i, n, amp, pal, extra) => PF.Chars.sidePose(i, n, amp, pal, extra);

  /* ---------------- palettes ---------------- */
  const PLUMBER = { skin: '#f2c094', skinSh: '#c28569', hair: '#3e2731', hairSh: '#262b44', hairHi: '#733e39',
    shirt: '#e43b44', shirtSh: '#a22633', shirtHi: '#f6757a', pants: '#124e89', pantsSh: '#1c2a44',
    boots: '#733e39', belt: '#3e2731', buckle: '#fee761', outline: OUT, lip: '#a26a5a' };
  const ADVENTURER = { skin: '#e8b796', skinSh: '#c28569', hair: '#b86f50', hairSh: '#733e39', hairHi: '#e4a672',
    shirt: '#3e8948', shirtSh: '#265c42', shirtHi: '#63c74d', pants: '#5a6988', pantsSh: '#3a4466',
    boots: '#3e2731', belt: '#733e39', buckle: '#c0cbdc', outline: OUT, lip: '#a26a5a' };
  const GUNNER = { skin: '#d99a78', skinSh: '#a26a5a', hair: '#262b44', hairSh: '#181425', hairHi: '#3a4466',
    shirt: '#4a7fb5', shirtSh: '#29366f', shirtHi: '#9fd0ff', pants: '#29366f', pantsSh: '#1c2a44',
    boots: '#262b44', belt: '#262b44', buckle: '#feae34', outline: OUT, lip: '#a26a5a' };

  /* ---------------- side-view hero ---------------- */
  function heroSuite(pal, name, o = {}) {
    const IDLE_H = [0, 1, 1, 0], IDLE_A = [0, 0, 1, 1];
    const states = [];
    // idle: breathe in the shoulders, feet planted, eyes close on the last beat
    states.push(anim('idle', 4, true, IDLE_H, (h, i) => {
      const cfg = SP(i, 4, 0, pal);
      cfg.bob = 0; cfg.headDy = h;
      cfg.armF = { dx: 0, dy: IDLE_A[i] }; cfg.armB = { dx: 0, dy: IDLE_A[i] };
      cfg.legF = { dx: 0, dy: 0 }; cfg.legB = { dx: 0, dy: 0 };
      cfg.eye = i === 3 ? 'closed' : 'open'; cfg.tool = o.alwaysTool || null;
      return N(cfg);
    }));
    /* walk / run: six beats. The bob rides a quarter-phase cosine so no two
       frames share a height; the arms carry the counter-swing. Dust lifts on
       the two contact frames only. */
    states.push(anim('walk', 6, true, [0, 1, 2, 3, 4, 5], i => {
      const a = i / 6 * PI2;
      const cfg = SP(i, 6, 2, pal, { bob: Math.max(-1, Math.min(0, Math.round(-Math.abs(Math.sin(a)) * 2 - Math.cos(a) * 0.9))) });
      const aw = Math.round(Math.cos(a) * 2);
      cfg.armF = { dx: -aw, dy: 0 }; cfg.armB = { dx: aw, dy: 0 };
      const dust = (i === 1 || i === 4) ? [[12, 27, '#c0cbdc'], [19, 27, '#8b9bb4']] : null;
      return (buf, W, H) => {
        const api = P().makeApi(buf, W, H);
        PF.Chars.drawHumanoid(api, buf, W, H, cfg);
        if (dust) for (const [x, y, col] of dust) { api.px(x, y, col); api.px(x + 1, y, col); }
      };
    }));
    states.push(anim('run', 10, true, [0, 1, 2, 3, 4, 5], i => {
      const a = i / 6 * PI2;
      const cfg = SP(i, 6, 3, pal, { bob: Math.max(-1, Math.min(0, Math.round(-Math.abs(Math.sin(a)) * 2 - Math.cos(a)))) });
      cfg.armF = { dx: -Math.round(Math.cos(a) * 3), dy: 0 };
      cfg.armB = { dx: Math.round(Math.cos(a) * 3), dy: 0 };
      return N(cfg);
    }));
    /* Jump arc: compress, launch, rise, apex, tuck, reach. Bob tops out at -5;
       past that the clamped head lags visibly behind the shoulders and the
       sprite reads as detached. */
    const JUMPS = [
      { bob: 1, headDy: 2, legs: 0, arms: 1, eye: 'open' },
      { bob: -2, headDy: 0, legs: -1, arms: -2, eye: 'open' },
      { bob: -4, headDy: 0, legs: -2, arms: -3, eye: 'open' },
      { bob: -5, headDy: 0, legs: -1, arms: -3, eye: 'closed' },
      { bob: -4, headDy: 1, legs: 0, arms: -1, eye: 'open' },
      { bob: -3, headDy: 0, legs: 1, arms: 1, eye: 'open' }
    ];
    states.push(anim('jump_rise', 10, true, JUMPS, (s, i) => {
      const cfg = SP(i, 6, 0, pal, { bob: s.bob });
      cfg.headDy = s.headDy; cfg.eye = s.eye;
      cfg.legF = { dx: 0, dy: s.legs }; cfg.legB = { dx: 0, dy: -s.legs };
      cfg.armF = { dx: 0, dy: s.arms }; cfg.armB = { dx: 0, dy: s.arms };
      cfg.tool = o.alwaysTool || null;
      return N(cfg);
    }));
    states.push(anim('fall', 8, true, [0, 1, 2], i => {
      const cfg = SP(i, 3, 0, pal, { bob: -1 - (i === 1 ? 1 : 0) });
      cfg.legF = { dx: 0, dy: [1, 2, 1][i] }; cfg.legB = { dx: 0, dy: [0, -1, 1][i] };
      cfg.armF = { dx: 0, dy: [-3, -4, -2][i] }; cfg.armB = { dx: 0, dy: [-2, -3, -1][i] };
      cfg.eye = i === 1 ? 'closed' : 'open'; cfg.tool = o.alwaysTool || null;
      return N(cfg);
    }));
    // crouch: the head sinks into the shoulders, feet stay planted at y25..27
    states.push(anim('crouch', 4, true, [0, 1], h => {
      const cfg = SP(0, 4, 0, pal);
      cfg.bob = 0; cfg.headDy = 3 + h;
      cfg.armF = { dx: 2, dy: 2 }; cfg.armB = { dx: 0, dy: 2 };
      cfg.legF = { dx: 0, dy: 0 }; cfg.legB = { dx: 0, dy: 0 }; cfg.eye = 'open';
      return N(cfg);
    }));
    // attack: long windup, fast strike, follow-through, settle
    const ANG = [-2.4, -0.35, 0.55, 0.3], ADUR = [130, 60, 90, 150];
    states.push(anim('attack', 10, true, ANG.map((a, i) => ({ a, i, d: ADUR[i] })), c => {
      const i = c.i;
      const cfg = SP(i, 4, 1, pal, { tool: { kind: o.weapon || 'sword', angle: c.a, behind: i === 2,
        arc: (i === 1 || i === 2) ? [c.a - 1.1, c.a, 10] : null, impact: i === 1 ? [3, 2, 0.2] : null } });
      cfg.armF = { dx: 2, dy: [-3, -2, -2, -1][i] }; cfg.kb = [0, 2, 1, 0][i];
      return N(cfg);
    }));
    states.push(anim('hurt', 8, true, [0, 1], i => {
      const cfg = SP(i, 2, 0, pal, { bob: -i, tool: { kind: 'none', impact: [-2, -3, 0.2] } });
      cfg.kb = 2 - i * 2; cfg.eye = 'hurt'; cfg.mouth = 'open';
      return N(cfg);
    }));
    states.push(D('death', 6, false, [
      Fr(ms(6), N({ pal, facing: 'side', bob: 0, kb: 2, eye: 'dead' })),
      Fr(ms(6), lying({ pal })),
      /* The settling frame carries real debris, not a token speck: three pixels
         is under the gate's 8px frame delta and reads as a stuck animation. */
      Fr(ms(6), lying({ pal, debris: [
        [8, 21, '#8b9bb4'], [10, 19, '#c0cbdc'], [13, 22, '#8b9bb4'], [16, 20, '#8b9bb4'],
        [19, 21, '#c0cbdc'], [21, 19, '#8b9bb4'], [23, 22, '#8b9bb4'], [5, 19, '#8b9bb4'],
        [25, 20, '#c0cbdc'], [12, 24, '#8b9bb4']] }))
    ]));
    return { width: 32, height: 32, name, layers: [{ name: 'Body' }], states };
  }

  const heroPlumber = () => heroSuite(PLUMBER, 'pf-plat-hero', { weapon: 'sword' });
  const heroAdventurer = () => heroSuite(ADVENTURER, 'pf-plat-adventurer', { weapon: 'sword' });
  const heroGunner = () => heroSuite(GUNNER, 'pf-plat-gunner', { weapon: 'pistol' });

  /* ---------------- walker baddie ---------------- */
  function walkerSuite() {
    const body = '#b86f50', bodyHi = '#e4a672', bodySh = '#733e39', foot = '#3e2731', eye = '#ffffff', pupil = '#181425';
    const frame = o => fx(api => {
      const squash = o.squash || 0, lift = o.lift || 0;
      const w = 9 + (squash ? 2 : 0), h = 8 - (squash ? 3 : 0), cy = 19 + lift + squash;
      api.ellipse(16 - w, cy - h, 16 + w, cy + h, body, true);
      api.ellipse(16 - w + 1, cy - h + 1, 16 + w - 2, cy - h + 3, bodyHi, true);
      api.rect(16 - w + 1, cy + h - 2, 16 + w - 1, cy + h, bodySh);
      api.ellipse(11, cy - h + 1, 14, cy - h + 4, eye, true);
      api.ellipse(18, cy - h + 1, 21, cy - h + 4, eye, true);
      api.px(o.blink ? 12 : 13, cy - h + 2, pupil); api.px(o.blink ? 19 : 20, cy - h + 2, pupil);
      api.rect(11, cy + 1, 21, cy + 2, pupil);
      api.rect(12, cy + 1, 13, cy + 1, eye); api.rect(18, cy + 2, 19, cy + 2, eye);
      api.rect(10 + (o.stepA || 0), cy + h, 15 + (o.stepA || 0), 27, foot);
      api.rect(17 + (o.stepB || 0), cy + h, 22 + (o.stepB || 0), 27, foot);
    });
    return { width: 32, height: 32, name: 'pf-plat-walker', layers: [{ name: 'Body' }], states: [
      anim('walk', 6, true, [0, 1, 2, 3], i => frame({ lift: [0, -1, -1, 0][i], stepA: [0, 1, 0, -1][i], stepB: [0, -1, 0, 1][i], blink: i === 3 })),
      anim('idle', 4, true, [0, 1], l => frame({ lift: l })),
      anim('squash', 10, false, [0, 3, 5], s => frame({ squash: s })),
      anim('hurt', 8, true, [0, 1], i => frame({ lift: i - 1, squash: i })),
      anim('death', 6, false, [0, 1, 2, 3], i => frame({ squash: i * 2, lift: i }))
    ] };
  }

  /* ---------------- flyer ---------------- */
  function flyerSuite() {
    const body = '#68386c', bodyHi = '#b55088', bodySh = '#3e2347', wing = '#9fd0ff', eye = '#ffec27';
    const frame = o => fx(api => {
      const cy = 16 + (o.bob || 0) + (o.dive || 0), flap = o.flap || 0;
      if (flap === 0) {
        api.ellipse(2, cy - 8, 12, cy, wing, true); api.ellipse(20, cy - 8, 30, cy, wing, true);
        api.ellipse(4, cy - 6, 11, cy - 1, '#ffffff', true); api.ellipse(21, cy - 6, 28, cy - 1, '#ffffff', true);
      } else {
        api.ellipse(2, cy, 12, cy + 8, wing, true); api.ellipse(20, cy, 30, cy + 8, wing, true);
        api.ellipse(4, cy + 1, 11, cy + 6, bodySh, true); api.ellipse(21, cy + 1, 28, cy + 6, bodySh, true);
      }
      api.ellipse(11, cy - 7, 21, cy + 7, body, true);
      api.ellipse(12, cy - 6, 18, cy - 1, bodyHi, true);
      api.rect(12, cy + 3, 20, cy + 6, bodySh);
      api.rect(13, cy - 3, 15, cy - 1, eye); api.rect(17, cy - 3, 19, cy - 1, eye);
      api.px(14, cy - 2, '#181425'); api.px(18, cy - 2, '#181425');
      api.px(16, cy + 1, '#ffffff'); api.px(15, cy + 1, '#ffffff');
      if (o.fangs) { api.px(13, cy + 4, '#ffffff'); api.px(19, cy + 4, '#ffffff'); }
    });
    return { width: 32, height: 32, name: 'pf-plat-flyer', layers: [{ name: 'Body' }], states: [
      anim('flap', 8, true, [0, 1, 2, 3], i => frame({ flap: i % 2, bob: [0, -1, -1, 0][i] })),
      anim('glide', 4, true, [0, 1], b => frame({ flap: 0, bob: b, fangs: !!b })),
      anim('dive', 10, true, [0, 1, 2, 3], i => frame({ flap: i % 2, dive: [0, 3, 6, 4][i], bob: [0, -1, 0, 1][i], fangs: true })),
      anim('hurt', 8, true, [0, 1], i => frame({ flap: i, bob: i ? -2 : -1, fangs: true })),
      anim('death', 6, false, [0, 1, 2, 3], i => frame({ flap: i % 2, dive: i * 3 }))
    ] };
  }

  /* ---------------- spitter plant ---------------- */
  function spitterSuite() {
    const stem = '#265c42', stemHi = '#3e8948', cap = '#e43b44', capHi = '#f6757a', capSh = '#a22633', spit = '#63c74d';
    const frame = o => fx(api => {
      const open = o.open || 0, lean = o.lean || 0;
      api.rect(13 + lean, 18, 18 + lean, 27, stem);
      api.rect(13 + lean, 18, 14 + lean, 27, stemHi);
      api.ellipse(14 + lean, 24, 17 + lean, 27, '#3e2731', true);
      api.rect(10 + lean, 19, 12 + lean, 21, stemHi); api.rect(19 + lean, 22, 21 + lean, 24, stemHi);
      api.ellipse(9, 8, 23, 20, cap, true);
      api.ellipse(10, 9, 20, 14, capHi, true);
      api.rect(10, 18, 22, 20, capSh);
      api.rect(12, 15, 20, 17, '#181425');
      if (open) { api.rect(13, 16, 19, 16 + open, '#5c1a1a'); api.px(13, 16, '#ffffff'); api.px(19, 16, '#ffffff'); }
      api.px(12, 12, '#ffffff'); api.px(19, 13, '#ffffff');
      if (o.spit) for (let i = 0; i < o.spit; i++) { api.px(16 + i * 2, 12 - i * 2, spit); api.px(17 + i * 2, 12 - i * 2, '#a7f070'); }
    });
    return { width: 32, height: 32, name: 'pf-plat-spitter', layers: [{ name: 'Body' }], states: [
      anim('idle', 4, true, [0, 1], l => frame({ lean: l })),
      anim('spit', 10, true, [0, 1, 2, 3], i => frame({ open: [0, 2, 1, 0][i], lean: [0, -1, 0, 0][i], spit: [0, 1, 3, 1][i] })),
      anim('hurt', 8, true, [0, 1], i => frame({ lean: i ? 1 : -1, open: 1 })),
      anim('death', 6, false, [0, 1, 2, 3], i => frame({ open: [1, 2, 3, 5][i], lean: [0, 1, 2, 3][i] }))
    ] };
  }

  /* ---------------- boss: stone colossus ---------------- */
  function bossSuite() {
    const rock = '#8b9bb4', rockHi = '#c0cbdc', rockSh = '#5a6988', dark = '#3a4466', core = '#e43b44', coreHi = '#ffec27';
    const frame = o => fx(api => {
      const bob = o.bob || 0, armL = o.armL || 0, armR = o.armR || 0, jaw = o.jaw || 0, coreT = o.coreT || 0;
      // legs stay planted on rows 25..27
      api.rect(8, 22, 14, 27, rockSh); api.rect(18, 22, 24, 27, rockSh);
      api.rect(7, 26, 15, 27, dark); api.rect(17, 26, 25, 27, dark);
      // body + core
      api.rect(7, 8 + bob, 24, 23 + bob, rock);
      api.rect(7, 8 + bob, 24, 10 + bob, rockHi);
      api.rect(7, 21 + bob, 24, 23 + bob, rockSh);
      api.rect(9, 11 + bob, 22, 19 + bob, dark);
      api.rect(13, 13 + bob, 18, 18 + bob, core);
      api.rect(14 + coreT, 14 + bob, 17 + coreT, 17 + bob, coreHi);
      // head
      api.rect(10, 3 + bob, 21, 9 + bob, rock);
      api.rect(10, 3 + bob, 21, 4 + bob, rockHi);
      api.rect(12, 5 + bob, 15, 7 + bob, coreHi); api.rect(17, 5 + bob, 20, 7 + bob, coreHi);
      if (jaw) { api.rect(13, 8 + bob, 18, 8 + jaw + bob, '#181425'); api.px(13, 8 + bob, '#ffffff'); api.px(18, 8 + bob, '#ffffff'); }
      else api.line(13, 8 + bob, 18, 8 + bob, dark, 1);
      // arms
      api.rect(2, 10 + bob + armL, 7, 18 + bob + armL, rockSh);
      api.rect(24, 10 + bob + armR, 29, 18 + bob + armR, rockSh);
      api.rect(1, 18 + bob + armL, 8, 21 + bob + armL, rock);
      api.rect(23, 18 + bob + armR, 30, 21 + bob + armR, rock);
      if (o.rocks) for (let i = 0; i < o.rocks; i++) { api.rect(13 + i * 3, 12 + bob - i, 15 + i * 3, 14 + bob - i, rockHi); }
    });
    const STOMP = [
      { d: ms(10), armL: -4, armR: -4 },
      { d: ms(10), armL: -6, armR: -6, coreT: 1 },
      { d: 60, armL: 4, armR: 4, jaw: 3, bob: 1 },
      { d: ms(8), armL: 2, armR: 2 },
      { d: ms(8), coreT: 1 }
    ];
    return { width: 32, height: 32, name: 'pf-plat-boss', layers: [{ name: 'Body' }], states: [
      anim('idle', 4, true, [0, 1], b => frame({ bob: b, coreT: b })),
      anim('stomp', 10, true, STOMP, c => frame(c)),
      anim('barrage', 10, true, [0, 1, 2, 3], i => frame({ jaw: 2 + (i % 2), rocks: i + 1, bob: i % 2, coreT: 1 })),
      anim('hurt', 7, true, [0, 1], i => frame({ bob: i ? 1 : -1, coreT: i, jaw: 1 })),
      anim('death', 6, false, [0, 1, 2, 3], i => frame({ bob: i, armL: i * 2, armR: i * 2, jaw: i, coreT: i % 2 }))
    ] };
  }

  /* ---------------- hazards ---------------- */
  function hazardsSuite() {
    const steel = '#c0cbdc', steelSh = '#5a6988', dark = '#262b44', fire = '#feae34', fireHi = '#ffec27';
    return { width: 32, height: 32, name: 'pf-plat-hazards', layers: [{ name: 'Hazards' }], states: [
      one('spikes', api => {
        api.rect(2, 24, 29, 27, steelSh); api.rect(2, 24, 29, 25, steel);
        for (let i = 0; i < 4; i++) {
          const x = 3 + i * 7;
          for (let k = 0; k < 7; k++) api.line(x + k, 24, x + 3, 12, k < 4 ? steel : steelSh, 1);
        }
      }),
      anim('saw', 12, true, [0, 1, 2, 3, 4, 5], i => fx(api => {
        const a0 = i / 6 * PI2;
        P().ring(api, 16, 16, 11, steel, 2);
        for (let k = 0; k < 8; k++) {
          const a = a0 + k / 8 * PI2;
          api.line(16 + Math.cos(a) * 8, 16 + Math.sin(a) * 8, 16 + Math.cos(a) * 13, 16 + Math.sin(a) * 13, steelSh, 2);
        }
        api.ellipse(11, 11, 21, 21, dark, true); api.ellipse(13, 13, 19, 19, steelSh, true);
        api.px(15, 15, '#ffffff');
      })),
      anim('flame_jet', 10, true, [3, 7, 12, 17, 10], h => fx(api => {
        api.rect(12, 25, 19, 27, steelSh); api.rect(12, 25, 19, 26, steel);
        for (let y = 0; y < h; y++) {
          const w = Math.max(1, Math.round((1 - y / h) * 5));
          api.rect(16 - w, 25 - y, 15 + w, 25 - y, y > h - 4 ? fireHi : fire);
          if (y % 3 === 0) { api.px(16 - w - 1, 25 - y, fire); api.px(16 + w + 1, 25 - y, fireHi); }
        }
      })),
      anim('crumble', 8, true, [0, 1, 2], i => fx(api => {
        api.rect(4, 14 + i, 27, 19 + i, steel);
        api.rect(4, 14 + i, 27, 15 + i, '#ffffff'); api.rect(4, 19 + i, 27, 19 + i, steelSh);
        for (let k = 0; k <= i; k++) { api.line(8 + k * 6, 20 + i, 7 + k * 6, 24 + i + k, steelSh, 1); api.px(6 + k * 6, 26 + i, steel); }
        if (i === 2) api.line(0, 16, 31, 16, dark, 1);
      })),
      anim('spike_pit', 4, true, [0, 1], i => fx(api => {
        api.rect(0, 24, 31, 27, dark);
        for (let k = 0; k < 5; k++) {
          const x = 2 + k * 6;
          api.line(x, 25, x + 2, 14 + i * 2, steel, 1); api.line(x + 4, 25, x + 2, 14 + i * 2, steelSh, 1);
        }
        api.px(5 + i * 8, 13, '#ffffff');
      }))
    ] };
  }

  /* ---------------- pickups & powerups ---------------- */
  function pickupsSuite() {
    const gold = '#ffec27', goldSh = '#feae34', goldHi = '#fff6c9', gem = '#41a6f6', gemHi = '#c8ffff';
    const coin = w => fx(api => {
      api.ellipse(16 - w, 9, 16 + w, 23, gold, true);
      api.ellipse(16 - w + 1, 10, 16 + w - 1, 22, goldHi, true);
      api.rect(15, 12, 16, 20, goldSh);
    });
    return { width: 32, height: 32, name: 'pf-plat-pickups', layers: [{ name: 'Pickups' }], states: [
      anim('coin', 10, true, [4, 3, 1, 3], coin),
      anim('gem', 8, true, [0, 1], b => fx(api => {
        api.ellipse(10, 8 - b, 22, 24 - b, gem, true);
        api.ellipse(12, 10 - b, 18, 15 - b, gemHi, true);
        api.px(11, 20 - b, '#ffffff'); api.px(12, 22 - b, '#2ce8f5');
        if (b) { api.px(8, 6 - b, '#ffffff'); api.px(24, 18 - b, '#ffffff'); }
      })),
      one('key', api => {
        api.ellipse(9, 11, 17, 19, gold, false); api.ellipse(11, 13, 15, 17, goldSh, true);
        api.rect(16, 14, 23, 16, gold); api.rect(20, 16, 22, 20, gold); api.rect(17, 16, 18, 19, gold);
      }),
      anim('star', 10, true, [0, 1, 2, 1], s => fx(api => {
        api.ellipse(10, 10, 22, 22, gold, true);
        api.ellipse(14, 14, 18, 18, goldHi, true);
        for (let k = 0; k < 4; k++) {
          const a = k / 4 * PI2 + 0.4;
          api.line(16 + Math.cos(a) * (7 + s), 16 + Math.sin(a) * (7 + s), 16 + Math.cos(a) * (11 + s), 16 + Math.sin(a) * (11 + s), goldSh, 1);
        }
      })),
      one('heart', api => {
        api.ellipse(8, 11, 16, 19, '#e43b44', true); api.ellipse(16, 11, 24, 19, '#e43b44', true);
        api.rect(9, 17, 23, 21, '#e43b44');
        api.line(11, 22, 16, 27, '#e43b44', 2); api.line(20, 22, 16, 27, '#e43b44', 2);
        api.px(11, 14, '#ffffff'); api.px(12, 13, '#ffffff');
      }),
      anim('berry', 8, true, [0, 1], b => fx(api => {
        api.ellipse(9, 13 - b, 23, 25 - b, '#3e8948', true);
        api.ellipse(11, 15 - b, 21, 20 - b, '#63c74d', true);
        api.px(16, 13 - b, '#feae34'); api.px(17, 13 - b, '#feae34');
        if (b) { api.px(10, 10 - b, '#ffffff'); api.px(22, 16 - b, '#ffffff'); }
      })),
      anim('checkpoint', 6, true, [0, 1], i => fx(api => {
        api.rect(14, 6, 16, 27, '#8b9bb4'); api.rect(14, 6, 15, 27, '#c0cbdc');
        api.rect(16, 6, 27, 14, i ? '#63c74d' : '#265c42');
        api.rect(16, 6, 17, 14, i ? '#a7f070' : '#3e8948');
        api.px(26, 8, i ? '#ffffff' : '#8b9bb4');
        api.rect(11, 25, 20, 27, '#3a4466');
      })),
      one('power_flower', api => {
        api.rect(14, 18, 17, 27, '#265c42');
        api.ellipse(12, 20, 19, 24, '#3e8948', true);
        for (let k = 0; k < 5; k++) {
          const a = k / 5 * PI2 - 1.57;
          const px2 = 16 + Math.cos(a) * 6, py2 = 13 + Math.sin(a) * 6;
          api.ellipse(px2 - 3, py2 - 3, px2 + 3, py2 + 3, k % 2 ? '#e43b44' : '#f6757a', true);
        }
        api.ellipse(14, 11, 18, 15, '#ffec27', true); api.px(15, 12, '#ffffff');
      })
    ] };
  }

  /* ---------------- blocks & platforms ---------------- */
  function blocksSuite() {
    const brick = '#b86f50', brickSh = '#733e39', brickHi = '#e4a672', steel = '#8b9bb4', steelSh = '#5a6988', steelHi = '#e6ebf7';
    const brickBase = api => {
      api.rect(0, 0, 31, 31, brick);
      for (let r = 0; r < 4; r++) {
        api.rect(0, r * 8, 31, r * 8, brickHi); api.rect(0, r * 8 + 7, 31, r * 8 + 7, brickSh);
        const off = r % 2 ? 8 : 0;
        for (let x = off; x < 32; x += 16) api.rect(x, r * 8, x, r * 8 + 6, brickSh);
      }
    };
    return { width: 32, height: 32, name: 'pf-plat-blocks', layers: [{ name: 'Blocks' }], states: [
      one('brick', api => { brickBase(api); api.speck(0, 0, 31, 31, 3, [brickSh], 0.06); }),
      anim('brick_break', 10, true, [0, 1, 2], i => fx(api => {
        if (i < 2) {
          brickBase(api);
          for (let k = 0; k <= i; k++) api.rect(6 + k * 7, 8 + k * 5, 12 + k * 7, 14 + k * 5, 0, { fill: true });
        } else {
          for (let k = 0; k < 6; k++) api.rect(4 + k * 5, 6 + (k % 3) * 8, 9 + k * 5, 11 + (k % 3) * 8, brick);
        }
      })),
      anim('question', 6, true, [0, 1], b => fx(api => {
        api.rect(0, 0, 31, 31, '#feae34');
        api.rect(0, 0, 31, 1, '#ffec27'); api.rect(0, 30, 31, 31, '#c27a1e');
        api.rect(2, 2, 29, 29, b ? '#ffd23a' : '#feae34');
        api.rect(4, 4, 27, 5, '#fff6c9');
        api.rect(3, 3, 4, 28, '#ffec27');
        PF.Font.draw(api, '?', 11, 10 + b, '#181425', { font: '5x7', scale: 2, shadow: true, shadowColor: '#c27a1e' });
        api.px(4, 27, '#ffffff');
      })),
      one('stone', api => {
        api.rect(0, 0, 31, 31, steelSh); api.rect(0, 0, 31, 1, steelHi); api.rect(0, 30, 31, 31, '#3a4466');
        api.rect(2, 3, 29, 28, steel); api.speck(2, 3, 29, 28, 7, ['#5a6988', '#c0cbdc'], 0.12);
        api.rect(3, 4, 28, 5, steelHi);
      }),
      anim('bounce', 12, true, [0, 2, 4, 1], sq => fx(api => {
        api.rect(1, 18 + sq, 30, 30, '#e43b44'); api.rect(1, 18 + sq, 30, 20 + sq, '#f6757a');
        api.rect(1, 28, 30, 30, '#a22633');
        api.rect(4, 21 + sq, 27, 24 + sq, '#a22633');
        for (let k = 0; k < 3; k++) api.rect(8 + k * 7, 22 + sq, 9 + k * 7, 25 + sq, '#f6757a');
      })),
      one('ice', api => {
        api.rect(0, 0, 31, 31, '#73eff7'); api.rect(0, 0, 31, 1, '#ffffff');
        api.rect(0, 30, 31, 31, '#41a6f6');
        api.line(2, 28, 12, 4, '#c8ffff', 1); api.line(10, 30, 24, 6, '#c8ffff', 1);
        api.line(20, 30, 29, 14, '#ffffff', 1);
      }),
      anim('conveyor', 10, true, [0, 1], i => fx(api => {
        api.rect(0, 6, 31, 25, '#5a6988'); api.rect(0, 6, 31, 7, '#8b9bb4'); api.rect(0, 24, 31, 25, '#3a4466');
        for (let k = 0; k < 5; k++) { const x = (k * 7 + (i ? 3 : 0)) % 32; api.rect(x, 10, x + 3, 21, '#c0cbdc'); api.px(x + 4, 15, '#8b9bb4'); }
        api.rect(0, 8, 31, 9, '#262b44');
      })),
      one('ladder', api => {
        api.rect(7, 0, 10, 31, '#b86f50'); api.rect(21, 0, 24, 31, '#b86f50');
        api.rect(7, 0, 8, 31, '#e4a672'); api.rect(21, 0, 22, 31, '#e4a672');
        for (let y = 4; y < 32; y += 8) { api.rect(10, y, 21, y + 1, '#733e39'); api.px(11, y, '#e4a672'); }
      }),
      one('sand', api => {
        api.rect(0, 0, 31, 31, '#d9a45b'); api.rect(0, 0, 31, 1, '#f2d29b'); api.rect(0, 30, 31, 31, '#9c6b30');
        api.speck(0, 2, 31, 29, 11, ['#9c6b30', '#f2d29b'], 0.14);
        for (let k = 0; k < 4; k++) api.line(4 + k * 8, 30, 6 + k * 8, 0, '#c98a3c', 1);
      })
    ] };
  }

  /* ---------------- tileset (16 tiles, 64x64) ---------------- */
  function tilesSuite() {
    const T = 16, cols = 4;
    const grass = '#3e8948', grassHi = '#63c74d', dirt = '#9c6b30', dirtSh = '#5c3a1e', stone = '#8b9bb4', water = '#41a6f6';
    const paints = [
      api => { api.rect(0, 0, 15, 15, grass); api.speck(0, 0, 15, 15, 1, [grassHi], 0.18); api.rect(0, 0, 15, 1, '#a7f070'); },
      api => { api.rect(0, 0, 15, 15, dirt); api.speck(0, 0, 15, 15, 2, [dirtSh, '#c98a3c'], 0.2); },
      api => { api.rect(0, 0, 15, 15, grass); api.rect(0, 3, 15, 15, dirt); api.rect(0, 3, 15, 4, grassHi); api.speck(0, 5, 15, 15, 3, [dirtSh], 0.18); for (let x = 0; x < 16; x += 4) api.px(x, 2, grass); },
      api => { api.rect(0, 0, 15, 15, grass); api.rect(0, 5, 15, 15, dirt); api.rect(0, 1, 15, 2, grassHi); api.speck(0, 6, 15, 15, 4, [dirtSh], 0.2); },
      api => { api.rect(0, 0, 15, 15, stone); api.rect(0, 0, 15, 1, '#c0cbdc'); api.rect(0, 15, 15, 15, '#5a6988'); api.speck(1, 2, 14, 13, 5, ['#5a6988', '#c0cbdc'], 0.12); },
      api => { api.rect(0, 0, 15, 15, '#5a6988'); for (let r = 0; r < 2; r++) for (let c = 0; c < 2; c++) { api.rect(c * 8, r * 8, c * 8 + 7, r * 8 + 7, stone); api.rect(c * 8, r * 8, c * 8 + 7, r * 8, '#c0cbdc'); api.rect(c * 8 + 7, r * 8, c * 8 + 7, r * 8 + 7, '#3a4466'); } },
      api => { api.rect(0, 0, 15, 15, water); api.rect(0, 0, 15, 1, '#73eff7'); api.rect(0, 15, 15, 15, '#124e89'); api.speck(0, 2, 15, 13, 6, ['#73eff7'], 0.1); },
      api => { api.rect(0, 0, 15, 15, '#124e89'); api.rect(0, 0, 15, 2, water); for (let x = 0; x < 16; x += 6) api.px(x + 1, 3, '#73eff7'); },
      api => { api.rect(0, 0, 15, 15, '#ead4aa'); api.rect(0, 0, 15, 1, '#fff6c9'); api.speck(0, 2, 15, 13, 7, ['#c28569'], 0.14); },
      api => { api.rect(0, 0, 15, 15, '#e8ecf5'); api.rect(0, 0, 15, 1, '#ffffff'); api.rect(0, 15, 15, 15, '#8b9bb4'); api.speck(0, 2, 15, 12, 8, ['#c0cbdc'], 0.1); },
      api => { api.rect(0, 0, 15, 15, '#b86f50'); api.rect(0, 0, 15, 1, '#e4a672'); for (let x = 2; x < 16; x += 5) api.line(x, 0, x, 15, '#733e39', 1); api.speck(0, 1, 15, 14, 9, ['#733e39'], 0.08); },
      api => { api.rect(0, 0, 15, 15, '#733e39'); api.rect(2, 0, 4, 15, '#b86f50'); api.rect(10, 0, 12, 15, '#b86f50'); for (let y = 1; y < 16; y += 4) api.rect(2, y, 12, y, '#e4a672'); },
      api => { api.rect(0, 0, 15, 15, '#262b44'); for (let y = 0; y < 16; y += 4) { api.rect(0, y, 15, y, '#3a4466'); api.px(3 + (y % 8), y + 1, '#5a6988'); } api.rect(0, 0, 15, 0, '#181425'); api.rect(0, 15, 15, 15, '#181425'); },
      api => { api.rect(0, 0, 15, 15, '#265c42'); api.speck(0, 0, 15, 15, 10, ['#3e8948', '#63c74d'], 0.28); for (let k = 0; k < 4; k++) api.line(2 + k * 4, 15, 3 + k * 4, 8, '#63c74d', 1); },
      api => { api.rect(0, 0, 15, 15, '#3e2347'); api.speck(0, 0, 15, 15, 11, ['#68386c', '#b55088'], 0.22); api.rect(0, 0, 15, 0, '#181425'); },
      api => { api.rect(0, 0, 15, 15, '#0b0b0f'); for (let y = 0; y < 16; y += 8) for (let x = 0; x < 16; x += 8) if (((x + y) / 8) % 2) api.rect(x, y, x + 7, y + 7, '#1a1a20'); }
    ];
    return { width: 64, height: 64, name: 'pf-plat-tiles', layers: [{ name: 'Tiles' }], states: [
      oneRaw('tiles', buf => {
        paints.forEach((fn, i) => {
          const api = P().offsetApi(P().makeApi(buf, 64, 64), (i % cols) * T, ((i / cols) | 0) * T);
          fn(api);
        });
      })
    ] };
  }

  /* ---------------- parallax backgrounds (64x32, tileable) ---------------- */
  function bgSuite() {
    const cell = (buf, fn) => fn(P().makeApi(buf, 64, 32));
    return { width: 64, height: 32, name: 'pf-plat-bg', layers: [{ name: 'Layer' }], states: [
      oneRaw('sky', buf => cell(buf, api => {
        api.grad(0, 0, 63, 31, '#41a6f6', '#c8ffff');
        api.ellipse(6, 4, 12, 10, '#ffec27', true); api.ellipse(8, 6, 10, 8, '#fff6c9', true);
      })),
      anim('clouds', 3, true, [0, 1, 2], i => (buf) => cell(buf, api => {
        const cloud = (cx, cy, r) => {
          for (const [dx, dy, rr] of [[0, 0, r], [r, 1, r - 2], [-r, 1, r - 2]]) {
            const x = Math.max(0, Math.min(63, cx + dx));
            api.ellipse(x - rr, cy - rr + dy, x + rr, cy + rr + dy, '#f4f4f4', true);
          }
        };
        cloud((4 + i * 3) % 64, 10, 5); cloud((30 + i * 3) % 64, 16, 4); cloud((50 + i * 3) % 64, 6, 3);
        api.rect(0, 0, 63, 0, '#e8ecf5');
      })),
      oneRaw('hills', buf => cell(buf, api => {
        for (let x = 0; x < 64; x++) { const h = 12 + Math.round(Math.sin(x / 9) * 5 + Math.sin(x / 4) * 2); api.rect(x, 32 - h, x, 31, '#3e8948'); api.px(x, 32 - h, '#63c74d'); }
        for (let x = 0; x < 64; x++) { const h = 7 + Math.round(Math.sin(x / 6 + 2) * 3); api.rect(x, 32 - h, x, 31, '#265c42'); }
      })),
      oneRaw('forest', buf => cell(buf, api => {
        for (let t = 0; t < 9; t++) {
          const cx = t * 8 + 2, base = 20 + (t % 3);
          api.rect(cx, base - 6, cx + 1, 31, '#3e2731');
          P().canopy(api, cx, base - 9, 5, 4, ['#265c42', '#3e8948', '#63c74d'], t);
        }
        api.rect(0, 26, 63, 31, '#193c3e');
      })),
      oneRaw('cave', buf => cell(buf, api => {
        api.rect(0, 0, 63, 31, '#1c2a44');
        for (let x = 0; x < 64; x += 2) { const h = 6 + Math.round(api.hash(x, 1, 2) * 6); api.rect(x, 0, x + 1, h, '#262b44'); api.rect(x, 31 - h, x + 1, 31, '#262b44'); }
        api.rect(4, 14, 10, 18, '#3a4466'); api.px(6, 15, '#2ce8f5'); api.px(7, 16, '#2ce8f5');
        api.rect(40, 18, 46, 22, '#3a4466'); api.px(42, 19, '#2ce8f5');
      }))
    ] };
  }

  /* ---------------- side-scroller HUD (64x32) ---------------- */
  function hudSuite() {
    const panel = api => {
      api.rect(0, 22, 63, 31, '#181425');
      api.rect(0, 22, 63, 23, '#5a6988');
      api.rect(0, 30, 63, 31, '#262b44');
    };
    return { width: 64, height: 32, name: 'pf-plat-hud', layers: [{ name: 'HUD' }], states: [
      oneRaw('coin_counter', buf => {
        const api = P().makeApi(buf, 64, 32); panel(api);
        api.ellipse(6, 24, 12, 30, '#ffec27', true); api.rect(8, 25, 10, 29, '#feae34');
        PF.Font.draw(api, 'x12', 16, 24, '#fff6c9', { font: '5x7' });
        api.rect(44, 24, 62, 30, '#262b44'); api.rect(44, 24, 62, 25, '#5a6988');
        PF.Font.draw(api, 'W 1-1', 42, 25, '#a7f070', { font: '3x5' });
      }),
      anim('health_bar', 6, true, [44, 30, 18], w => (buf) => {
        const api = P().makeApi(buf, 64, 32); panel(api);
        PF.Font.draw(api, 'HP', 3, 24, '#e43b44', { font: '3x5' });
        api.rect(12, 24, 59, 30, '#262b44');
        api.rect(13, 25, 12 + w, 29, w > 40 ? '#63c74d' : w > 26 ? '#feae34' : '#e43b44');
        api.rect(13, 25, 12 + w, 26, '#ffffff');
      }),
      anim('boss_bar', 8, true, [0, 1], i => (buf) => {
        const api = P().makeApi(buf, 64, 32); panel(api);
        PF.Font.draw(api, 'COLOSSUS', 3, 24, '#f6757a', { font: '5x7' });
        const w = 40 - i * 4;
        api.rect(12, 30, 59, 30, '#262b44');
        api.rect(13, 24, 12 + w, 29, '#c026d3'); api.rect(13, 24, 12 + w, 25, '#ff7ab8');
      }),
      oneRaw('lives', buf => {
        const api = P().makeApi(buf, 64, 32);
        for (let k = 0; k < 3; k++) {
          const x = 4 + k * 12;
          api.ellipse(x, 8, x + 8, 16, '#e43b44', true); api.ellipse(x + 8, 8, x + 16, 16, '#e43b44', true);
          api.rect(x + 1, 14, x + 15, 18, '#e43b44');
          api.line(x + 3, 19, x + 8, 24, '#e43b44', 2); api.line(x + 13, 19, x + 8, 24, '#e43b44', 2);
          api.px(x + 3, 11, '#ffffff');
        }
        /* 3x5, not 5x7: five 5px glyphs are 29px and the bar is 64 wide. */
        PF.Font.draw(api, 'LIVES', 44, 12, '#fff6c9', { font: '3x5' });
      })
    ] };
  }

  return { heroSuite, heroPlumber, heroAdventurer, heroGunner, walkerSuite, flyerSuite, spitterSuite,
    bossSuite, hazardsSuite, pickupsSuite, blocksSuite, tilesSuite, bgSuite, hudSuite,
    PLUMBER, ADVENTURER, GUNNER };
})();
