/* PixelForge Studio — Life & Labour pack: tool-use action cycles (smithing,
   farming, fishing, climbing) and spear combat, on PF.Chars' humanoid rig.
   Original animation design in the house style, made to sit at the same quality
   bar as the reference packs the owner points at — no traced pixels, no copied
   sheet layout. Everything is deterministic maths, single-layer, 32x32.
   Every action is emitted across side/down/up facings, because a top-down game
   drives state names as '<verb>_<facing>'.
   Ground contact stays at y25..27 and nothing paints below y27, so the outline
   pass can never fuse a prop into the engine's runtime shadow row at y29. */
window.PF = window.PF || {};
PF.RPG = PF.RPG || {};
PF.RPG.life = (() => {
  const R = PF.RPG, Ch = () => PF.Chars, P = () => PF.Pixel;
  const D = (name, fps, loop, frames) => ({ name, fps, loop, frames });
  const Fr = (duration, paint) => ({ duration, paint });
  const ms = f => Math.round(1000 / f);
  const OUT = '#181425';
  const FACINGS = [['side', 'side'], ['down', 'down'], ['up', 'up']];

  /* Shaved-head labourer in a slate cap. Every tone is chosen for separation:
     skin against cap, linen shirt against leather apron. The first draft had
     tan hair, tan shirt and tan apron, which merged into one brown slab you
     could not read at arm's length. hair is never the outline colour (renders a
     black slab) and never equal to a neighbouring part (erases that part). */
  const FARMER = {
    skin: '#e8b796', skinSh: '#c28569', hair: '#4a5568', hairSh: '#3a4466', hairHi: '#5a6988',
    shirt: '#d9c18a', shirtSh: '#a8875c', shirtHi: '#f0e0b8', pants: '#3e4a5c', pantsSh: '#262b44',
    boots: '#3e2731', belt: '#262b44', buckle: '#c0cbdc', outline: OUT, lip: '#a26a5a',
    apron: '#8a5a3c', apronSh: '#5c3a24', apronHi: '#b8845c'
  };
  const STEEL = ['#5a6988', '#c0cbdc', '#ffffff'];
  const HOT = ['#ffffff', '#fee761'];
  const HOE = { handle: '#8a6a4a', head: '#c0cbdc', shine: '#ffffff' };
  const SPEAR = { handle: '#8a6a4a', head: '#c0cbdc', shine: '#ffffff', lug: '#5a6988' };

  /* One tool-use cycle from a list of poses. The strike frame is always the
     shortest: a held windup, one fast frame carrying the action, then a settle.
     Evenly-stepped cycles read as a metronome — the clearest tell of a
     procedurally generated action. */
  function action(facing, keys, opts = {}) {
    const frames = [];
    for (let i = 0; i < keys.length; i++) {
      const k = keys[i];
      const extra = { tool: k.tool, eye: k.eye || 'open', mouth: k.mouth || 'closed' };
      const cfg = facing === 'side'
        ? Ch().sidePose(i, keys.length, 0, FARMER, extra)
        : Ch().frontPose(i, keys.length, 0, FARMER, facing, extra);
      const arm = k.arm || [2, -2];
      if (facing === 'side') cfg.armF = { dx: arm[0], dy: arm[1] };
      else cfg.armR = { dx: arm[0], dy: arm[1] };
      cfg.kb = k.kb || 0;
      /* Effort reads downward only. The hair is authored at y1, so any upward
         excursion of the head — a lifting body or a raised chin — puts it on
         row 0 where the outline pass cannot draw. A strike looks more like a
         strike when the head follows it down anyway. */
      cfg.bob = Math.max(0, k.bob || 0);
      cfg.headDy = Math.max(0, k.hd || 0);
      if (opts.seated) Object.assign(cfg, opts.seated);
      frames.push(Fr(k.dur, R.N(cfg, opts, i)));
    }
    return frames;
  }
  /* Emit one action across every facing a top-down game can drive it from. */
  function facings(name, build, fps, loop) {
    return FACINGS.map(([suf, f]) => D(name + '_' + suf, fps, loop !== false, build(f)));
  }
  /* Head-on, an arm extended toward the target foreshortens to nothing: only the
     tool's angle survives the projection. These two mappings cant a side-view
     angle into the range a 32px cell can hold when the camera looks down it. */
  const clampA = (a, lo, hi) => Math.max(lo, Math.min(hi, a));
  /* A long shaft seen head-on projects to a near-vertical line, and the only
     freedom left is which way it leans. Leaning it back across the body puts it
     through the face, so the cant is one-sided: always forward, always inside
     the cell from whatever grip the arm reaches. */
  const upCant = a => -Math.PI / 2 + clampA((a + Math.PI / 2) * 0.35, 0.12, 0.8);
  const flatCant = a => clampA(a, -1.15, 1.15);


  /* ---------------- props: drawn in `pre` so the outline pass rims them ----- */
  /* Anvil on a stump, clear of the feet. The 12-unit-wide version sat under the
     smith's legs and the two masses merged into one grey-brown block; a narrow
     face on its own stump keeps the scene in two readable parts. */
  function anvil(api, x, y, hot) {
    api.rect(x, y + 6, x + 5, y + 9, '#5c4430');       // stump
    api.rect(x, y + 6, x + 5, y + 6, '#7d5539');
    api.rect(x + 1, y + 3, x + 4, y + 5, '#4a5568');   // waist
    api.rect(x, y, x + 5, y + 2, '#6b7a8f');           // face
    api.rect(x, y, x + 5, y, '#a8b8cc');               // lit top
    api.rect(x + 6, y + 1, x + 7, y + 1, '#5a6988');   // horn
    api.rect(x - 1, y + 1, x - 1, y + 2, '#4a5568');   // heel
    if (hot) {
      // the workpiece: a warm focal point that tells the eye where to look and
      // gives the strike somewhere to land
      api.rect(x + 1, y - 1, x + 4, y - 1, '#f77622');
      api.rect(x + 2, y - 1, x + 3, y - 1, '#fee761');
      api.px(x + 2, y - 1, '#ffffff');
    }
  }
  /* Coal hearth on the ground at the far side of the cell, so the scene says
     "smithy" before the hammer does. Always left: the anvil owns the right for
     every facing, and on the back view the two props merged into one blob. */
  function forge(api) {
    const x = 1;
    api.rect(x, 21, x + 7, 26, '#3a2a24');           // pit
    api.rect(x, 21, x + 7, 21, '#5a6988');           // rim stones
    api.rect(x + 1, 23, x + 6, 26, '#7a2f1a');       // coals
    api.rect(x + 2, 24, x + 5, 26, '#f77622');
    api.px(x + 3, 24, '#fee761'); api.px(x + 4, 25, '#ffffff');
    api.px(x + 1, 22, '#f77622'); api.px(x + 6, 22, '#7a2f1a');
  }
  /* Quench barrel: staves, hoops and a dark water mouth. */
  function barrel(api, x, y) {
    api.rect(x, y, x + 6, y + 6, '#7d5539');
    api.rect(x, y + 1, x + 6, y + 2, '#5a6988');
    api.rect(x, y + 5, x + 6, y + 5, '#5a6988');
    api.rect(x + 1, y - 1, x + 5, y, '#124e89');
    api.px(x + 2, y, '#4a7fb5'); api.px(x + 4, y, '#2ce8f5');
  }
  /* Sparks leave the anvil in a fan along the strike, not a ring: the shared
     PF.Pixel.sparks is radially symmetric, which reads as a starfish sitting on
     the sprite rather than metal coming off it. */
  function strike(api, x, y, t) {
    api.rect(x - 1, y - 1, x + 1, y + 1, '#ffffff');
    for (let i = 0; i < 7; i++) {
      const a = -0.3 - (i / 6) * 1.7;
      const r = 2 + (0.4 + t) * (2 + api.hash(i, 5, 3) * 6);
      const ex = x + Math.cos(a) * r, ey = y + Math.sin(a) * r;
      api.line(x + Math.cos(a) * 2, y + Math.sin(a) * 2, ex, ey, i & 1 ? '#fee761' : '#f77622', 1);
      api.px(ex, ey, t < 0.5 ? '#ffffff' : '#f77622');
    }
  }
  /* Steam off the quench barrel: stacked puffs that widen and cool as they rise.
     Single pixels read as static on the sprite, not as vapour. */
  function steam(api, x, y, t) {
    for (let i = 0; i < 3; i++) {
      const k = ((i / 3) + t) % 1;
      const w = k > 0.5 ? 2 : 1;
      const px = x + Math.round(Math.sin(k * 3.4 + i * 2) * 1.6);
      const py = y - Math.round(k * 7);
      const c = k > 0.6 ? '#8b9bb4' : (k > 0.3 ? '#c0cbdc' : '#e8ecf5');
      api.rect(px - w, py, px + w, py + 1, c);
      api.rect(px - w + 1, py - 1, px + w - 1, py - 1, c);      // domed top
    }
  }
  /* Leather apron over chest and thighs — the cheapest strong "smith" read,
     because it changes the silhouette mass instead of adding another prop. */
  function apron(api, cfg) {
    const b = cfg.bob || 0, kb = cfg.kb || 0;
    if (cfg.facing === 'side') {
      api.rect(12 + kb, 14 + b, 18, 22 + b, FARMER.apron);
      api.rect(17 + kb, 15 + b, 18, 21 + b, FARMER.apronHi);   // lit front edge
      api.rect(12 + kb, 14 + b, 13, 14 + b, FARMER.apronHi);   // shoulder strap
      api.px(13 + kb, 21 + b, FARMER.apronSh);
    } else if (cfg.facing === 'down') {
      api.rect(12 + kb, 16 + b, 19, 23 + b, FARMER.apron);
      api.rect(13 + kb, 13 + b, 18, 16 + b, FARMER.apron);     // bib over the chest
      api.px(13 + kb, 13 + b, FARMER.apronHi); api.px(18 + kb, 13 + b, FARMER.apronHi);
      api.rect(19 + kb, 17 + b, 19, 22 + b, FARMER.apronSh);   // shaded hem
      api.px(14 + kb, 20 + b, FARMER.apronHi);
    } else {
      // Back view: the apron is on the far side of him, so all that shows is the
      // cross-ties and the waist knot. A full panel here reads as a second torso.
      api.line(12 + kb, 14 + b, 19, 21 + b, FARMER.apronSh, 1);
      api.line(19 + kb, 14 + b, 12, 21 + b, FARMER.apronSh, 1);
      api.rect(11 + kb, 18 + b, 20, 18 + b, FARMER.apron);
      api.px(15 + kb, 18 + b, FARMER.apronHi); api.px(16 + kb, 18 + b, FARMER.apronHi);
    }
  }
  function cropRow(api, y, n, seed) {
    for (let i = 0; i < n; i++) {
      const x = 4 + i * 5, h = 2 + Math.round(P().clamp(api.hash(i, seed, 7) * 3, 0, 3));
      api.rect(x, y - h, x + 1, y, '#63c74d');
      api.px(x, y - h - 1, '#a8f28a'); api.px(x + 2, y - h, '#3e8948');
    }
  }
  function waterArc(api, x, y, t) {
    for (let i = 0; i < 7; i++) {
      const k = i / 6, px = x + Math.round(k * 6), py = y + Math.round(k * k * 7) + 1;
      if (k > t * 1.35) break;
      api.px(px, py, i & 1 ? '#2ce8f5' : '#4a7fb5'); api.px(px, py + 1, '#124e89');
    }
  }
  function seeds(api, x, y, t) {
    for (let i = 0; i < 5; i++) {
      const dx = (api.hash(i, 3, 11) - 0.5) * 6;
      api.px(x + Math.round(dx), y + Math.round(t * 7) + (i & 1), i & 1 ? '#fee761' : '#feae34');
    }
  }
  function fish(api, x, y) {
    api.ellipse(x - 3, y - 2, x + 3, y + 2, '#8b9bb4', true);
    api.line(x + 3, y, x + 6, y - 2, '#5a6988', 1);
    api.line(x + 3, y, x + 6, y + 2, '#5a6988', 1);
    api.px(x - 2, y - 1, OUT); api.px(x - 1, y + 1, '#c0cbdc');
  }
  /* Cell-sized spear: 8 units of shaft ahead of the grip, 4 behind. The shared
     PF.Pixel.spear is 14 ahead of the hand, which from x18 runs the tip off a
     32px frame and leaves the outline nothing to rim; gripping forward of the
     middle keeps a couched point while the butt stays inside the cell too. */
  function lspear(api, hx, hy, angle) {
    const c = Math.cos(angle), s = Math.sin(angle);
    const tx = hx + c * 8, ty = hy + s * 8, bx = hx - c * 4, by = hy - s * 4;
    api.line(bx, by, tx, ty, SPEAR.handle, 2);
    api.px(bx, by, SPEAR.lug);                             // iron butt-cap
    const ha = angle + Math.PI / 2;
    api.line(tx - c * 4, ty - s * 4, tx + c, ty + s, SPEAR.head, 2);
    api.px(tx + c * 2, ty + s * 2, SPEAR.shine);           // needle point
    api.line(tx - Math.cos(ha) * 2, ty - Math.sin(ha) * 2, tx + Math.cos(ha), ty + Math.sin(ha), SPEAR.lug, 1);
  }

  /* Short, dark-headed and top-lit. The shared PF.Pixel.hammer is a 10-unit
     weapon swing; at that length a smith's tool reads as a pale axe, and the
     head lands wherever the shaft points instead of on the anvil. Five units
     puts the face exactly where a raised elbow can drop it. */
  function hammer(api, hx, hy, angle) {
    const len = 5, tx = hx + Math.cos(angle) * len, ty = hy + Math.sin(angle) * len;
    api.line(hx, hy, tx, ty, '#733e39', 2);
    const ha = angle + Math.PI / 2;
    api.line(tx - Math.cos(ha) * 2, ty - Math.sin(ha) * 2, tx + Math.cos(ha) * 2, ty + Math.sin(ha) * 2, '#5a6988', 3);
    api.line(tx - Math.cos(ha) * 2, ty - Math.sin(ha) * 2 - 1, tx + Math.cos(ha) * 2, ty + Math.sin(ha) * 2 - 1, '#c0cbdc', 1);
    api.px(hx, hy, '#3e2731');
  }

  /* ================= SMITHING ================= */
  /* The anvil is the scene's anchor, so the whole cycle is authored against it:
     face at y16..18 on a stump to y25, workpiece glowing at y15, and the hammer
     head landing at x23 y17 on the strike frame. Raise, over-top, drop, lift,
     settle — the pause at the top is what sells the weight. */
  function smithSuite() {
    const AX = 21, AY = 16;
    const SMITH = [{ dur: 150, arm: [2, -5], ang: -1.6 }, { dur: 210, arm: [3, -6], ang: -2.4, hd: 1 },
      { dur: 55, arm: [2, -6], ang: 0.8 }, { dur: 120, arm: [2, -4], ang: 0.2, kb: 1 },
      { dur: 230, arm: [3, -3], ang: -0.5 }];
    const QUENCH = [{ dur: 180, arm: [2, -4], ang: -1.2 }, { dur: 110, arm: [2, -2], ang: 0.9, kb: 1 },
      { dur: 150, arm: [2, -1], ang: 1.05 }, { dur: 240, arm: [2, -5], ang: -0.6, hd: 1 }];
    /* The hammer rides cfg.tool, not a post hook: post runs after the outline
       pass, so a tool painted there has no rim and reads as a sticker laid on
       the sprite instead of something held. */
    const hammerTool = k => ({
      draw: (api, hx, hy, t, cfg) => {
        const side = cfg.facing === 'side';
        hammer(api, side ? hx : Math.min(hx, 21), hy, side ? k.ang : flatCant(k.ang));
      }
    });
    /* Quenching is done with tongs. A smith dunking a hot bar in a barrel of
       water with a hammer is not a thing that happens, and the viewer knows it
       even when they cannot say why the pose looks wrong. */
    const tongsTool = k => ({
      draw: (api, hx, hy, t, cfg) => {
        const side = cfg.facing === 'side';
        const px = side ? hx : Math.min(hx, 21), a = side ? k.ang : flatCant(k.ang);
        const tx = px + Math.cos(a) * 6, ty = hy + Math.sin(a) * 6;
        api.line(px, hy, tx, ty, '#5a6988', 1);
        api.line(px, hy + 1, tx, ty + 1, '#4a5568', 1);
        const ha = a + Math.PI / 2;
        api.line(tx - Math.cos(ha) * 2, ty - Math.sin(ha) * 2, tx + Math.cos(ha) * 2, ty + Math.sin(ha) * 2, '#f77622', 2);
        api.px(tx, ty, '#fee761');
      }
    });
    const build = keys => {
      const tool = keys === SMITH ? hammerTool : tongsTool;
      return f => action(f, keys.map(k => ({ ...k, tool: tool(k) })), {
        pre: api => {
          forge(api);
          if (keys === SMITH) anvil(api, AX, AY, true);
          else barrel(api, AX, 20);
        },
        post: (api, cfg, fi) => {
          apron(api, cfg);
          const cx = AX + 2, cy = keys === SMITH ? AY + 1 : 19;
          if (keys === SMITH) {
            if (fi === 2) strike(api, cx, cy, 0.15);
            else if (fi === 3) strike(api, cx, cy - 1, 1);   // the fan falls and cools
          } else if (fi >= 1 && fi <= 3) steam(api, cx + 1, 17 - (fi - 1) * 2, fi / 3);
        }
      });
    };
    return { width: 32, height: 32, name: 'rpg-smith', layers: [{ name: 'Body' }], states:
      [...facings('smith', build(SMITH), 8), ...facings('quench', build(QUENCH), 8)] };
  }

  /* ================= FARMING ================= */
  /* Four distinct verbs, not one swing recoloured: tilling drives a hoe into the
     soil and throws a clod, planting opens a seed bag and lets the grain fall,
     watering tips a can so the stream arcs, harvesting sweeps a sickle and puffs
     the cut stubble. */
  function farmSuite() {
    const bag = { kind: 'seedbag' }, can = { kind: 'can' }, sick = { kind: 'sickle' };
    const hoe = a => ({ kind: 'pickaxe', angle: a, pal: HOE });
    const specs = {
      till: { tool: k => hoe(k.a), keys: [{ dur: 170, arm: [3, -4], a: -2.1 }, { dur: 130, arm: [4, -5], a: -2.5 },
        { dur: 55, arm: [3, 0], a: 0.9, kb: 1 }, { dur: 120, arm: [3, -1], a: 0.2 }, { dur: 190, arm: [2, -2], a: -1.1 }],
        post: (api, cfg, fi) => { if (fi === 2) { api.rect(11, 25, 13, 26, '#5a3a2a'); api.rect(15, 25, 17, 26, '#4a2418'); api.px(12, 24, '#733e39'); api.px(16, 24, '#733e39'); } } },
      plant: { tool: () => bag, keys: [{ dur: 170, arm: [3, -3] }, { dur: 140, arm: [4, -1] },
        { dur: 70, arm: [3, 2], hd: 1 }, { dur: 110, arm: [3, 1] }, { dur: 190, arm: [2, -2] }],
        post: (api, cfg, fi) => { if (fi === 2 || fi === 3) seeds(api, 24, 20 + (fi - 2) * 3, fi === 2 ? 0.4 : 1); } },
      water: { tool: () => can, keys: [{ dur: 160, arm: [3, -3] }, { dur: 150, arm: [4, -1] },
        { dur: 90, arm: [4, 2], hd: 1 }, { dur: 130, arm: [4, 1] }, { dur: 180, arm: [3, -2] }],
        post: (api, cfg, fi) => { if (fi === 2 || fi === 3) waterArc(api, 24, 18, fi === 2 ? 0.5 : 1); } },
      harvest: { tool: () => sick, keys: [{ dur: 150, arm: [3, -3] }, { dur: 120, arm: [4, -4] },
        { dur: 55, arm: [3, 0], kb: 1 }, { dur: 120, arm: [3, -2] }, { dur: 180, arm: [2, -4], hd: 1 }],
        pre: api => cropRow(api, 26, 3, 4),
        post: (api, cfg, fi) => { if (fi === 3) P().dustPuff(api, 22, 26, 3, 0.5, '#63c74d'); } }
    };
    const build = spec => f => action(f, spec.keys.map(k => ({ ...k, tool: spec.tool(k) })),
      { pre: spec.pre, post: spec.post });
    return { width: 32, height: 32, name: 'rpg-farmer', layers: [{ name: 'Body' }], states: [
      ...facings('till', build(specs.till), 8), ...facings('plant', build(specs.plant), 8),
      ...facings('water', build(specs.water), 8), ...facings('harvest', build(specs.harvest), 8)
    ] };
  }

  /* ================= FISHING ================= */
  /* Eight frames: wind up, cast, line settles, wait, rod jerks on the bite, two
     reels, fish held up — then a seated wait cycle on the bank.
     The rod, its line and the float are painted as one tool because the line has
     to end on the water, which is a fixed point in the cell, while the grip
     travels with the arm. The shared lifeTool rod hung a 1px white column off
     the tip, which reads as a second sword; and without a pool of water in the
     frame nothing about the pose said fishing at all. */
  function fishSuite() {
    const WX = 26, WY = 24;                       // the float's water point
    const rodAt = e => ({
      draw: (api, hx, hy, t, cfg) => {
        const px = cfg.facing === 'side' ? hx : Math.min(hx, 20);
        const tx = px + 8, ty = hy - 8;
        api.line(px - 2, hy + 3, px + 4, hy - 3, '#8a6a4a', 2);   // butt, thick end
        api.line(px + 4, hy - 3, tx, ty, '#a8845c', 1);           // tapered tip
        api.line(tx, ty, e[0], e[1], '#8b9bb4', 1);               // line to the float
        api.px(tx, ty, '#e8ecf5');
      }
    });
    const pool = (api, cfg, fi) => {
      api.rect(21, WY, 30, 26, '#124e89');
      api.rect(21, WY, 30, WY, '#2ce8f5');                        // lit surface
      const r = fi % 3;
      api.px(22 + r * 2, WY + 1, '#4a7fb5'); api.px(26 + r, WY + 2, '#1a5a94');
      api.px(30 - r, WY + 1, '#4a7fb5');
    };
    const keys = [{ dur: 150, arm: [1, -4], end: [28, 13] }, { dur: 90, arm: [4, -2], kb: 1, end: [29, 15] },
      { dur: 110, arm: [3, 0], end: [WX, WY] }, { dur: 210, arm: [3, 1], hd: 1, end: [WX, WY] },
      { dur: 70, arm: [1, -3], hd: 1, end: [WX, WY + 2], bite: 1 }, { dur: 110, arm: [2, -2], end: [WX, WY - 2] },
      { dur: 120, arm: [2, -3], end: [WX, WY - 4] }, { dur: 240, arm: [2, -4], end: [28, 12], caught: 1 }];
    const post = (api, cfg, fi) => {
      const k = keys[fi], e = k.end;
      if (k.caught) { fish(api, e[0] - 1, e[1] + 2); return; }
      if (fi < 2) { api.px(e[0], e[1], '#e43b44'); return; }      // the lure in the air
      api.rect(e[0] - 1, e[1], e[0] + 1, e[1], '#e43b44');
      api.px(e[0], e[1] + 1, '#ffffff');
      /* A crown of droplets, not PF.Pixel.sparks: that ring is radially
         symmetric and at r=4 its lower arms land three rows under the water
         line, i.e. in the engine's shadow row. */
      if (k.bite) {
        api.px(e[0] - 2, e[1] - 1, '#2ce8f5'); api.px(e[0] + 2, e[1] - 1, '#2ce8f5');
        api.px(e[0] - 1, e[1] - 3, '#e8ecf5'); api.px(e[0] + 1, e[1] - 3, '#e8ecf5');
        api.rect(e[0] - 2, e[1], e[0] + 2, e[1], '#4a7fb5');
      }
    };
    /* Waiting idle: the house two-channel breath (head settles, arms follow half
       a beat later). A single channel repeats on the half-cycle, so frames 1 and
       2 come out identical and the loop stalls on the third frame. */
    const sitKeys = [0, 1, 2, 3].map(i => ({ dur: [220, 200, 220, 260][i], arm: [3, [0, 0, 1, 1][i]],
      hd: [0, 1, 1, 0][i], eye: i === 3 ? 'closed' : 'open', end: [WX, WY] }));
    const sitPost = (api, cfg, fi) => {
      api.rect(WX - 1, WY, WX + 1, WY, '#e43b44');
      api.px(WX, WY + 1, '#ffffff');
      if (fi === 2) { api.px(WX - 2, WY + 1, '#4a7fb5'); api.px(WX + 2, WY + 1, '#4a7fb5'); }
    };
    const fishKeys = keys.map(k => ({ ...k, tool: rodAt(k.end) }));
    const sitFrames = sitKeys.map(k => ({ ...k, tool: rodAt(k.end) }));
    return { width: 32, height: 32, name: 'rpg-fisher', layers: [{ name: 'Body' }], states: [
      ...facings('fish', f => action(f, fishKeys, { pre: pool, post }), 8),
      ...facings('sit', f => action(f, sitFrames, {
        pre: pool, post: sitPost, seated: { sitting: true, legs: 'dangle', arms: 'lap', seatY: 22 }
      }), 4)
    ] };
  }

  /* ================= CLIMB ================= */
  /* Five frames of an alternating hand-over-hand ascent that resets each cycle so
     it holds still against a scrolling wall. Legs are posed, not walked — a climb
     is the one action no sine gait fits. */
  function climbSuite() {
    const keys = [{ dur: 130, arm: [3, -5] }, { dur: 130, arm: [4, -3] }, { dur: 130, arm: [3, -2], hd: 1 },
      { dur: 130, arm: [4, -4] }, { dur: 130, arm: [3, -5], hd: 1 }];
    const hold = (api, cfg, fi) => {
      const y = 12 + (fi % 3) * 3;
      api.px(23, y, '#8a6a4a'); api.px(24, y + 1, '#5a3a2a'); api.px(22, y + 6, '#8a6a4a');
    };
    return { width: 32, height: 32, name: 'rpg-climber', layers: [{ name: 'Body' }], states:
      [...facings('climb', f => action(f, keys, { post: hold }), 8)] };
  }

  /* ================= SPEAR COMBAT ================= */
  /* Draw, combat-ready stance and step, slash, two thrusts, parry, evade, lunge,
     retreat, hit, knockdown. Thrusts drive kb — the whole body steps in — because
     a spear that only moves its own pixels looks like a stick being waved.
     Every angle is chosen against the cell, not just the pose: the head must
     stay inside x2..x29 and y3..y26 at every grip offset so the outline pass can
     rim the whole shaft. */
  function spearSuite() {
    const tool = k => ({
      draw: (api, hx, hy, t, cfg) => {
        const side = cfg.facing === 'side';
        const px = side ? hx : Math.min(hx, 23);
        const a = side ? k.a : upCant(k.a);
        lspear(api, px, hy, a);
        if (k.a0 !== undefined) P().arcTrail(api, px, hy, side ? 8 : 6.5, side ? k.a0 : upCant(k.a0), a, STEEL);
        if (k.hit) P().impactStar(api, clampA(px + Math.cos(a) * 8, 4, 27),
          clampA(hy + Math.sin(a) * 8, 4, 25), 0.4, HOT);
      }
    });
    const sets = {
      draw: { fps: 8, keys: [{ dur: 160, arm: [2, -1], a: 1.1 }, { dur: 130, arm: [3, -3], a: 0.3 },
        { dur: 150, arm: [3, -4], a: -0.7 }, { dur: 220, arm: [3, -3], a: -0.95 }] },
      ready: { fps: 6, keys: [{ dur: 220, arm: [3, -3], a: -0.8 }, { dur: 200, arm: [3, -4], a: -0.95 },
        { dur: 220, arm: [4, -4], a: -1.1 }, { dur: 260, arm: [4, -3], a: -0.9 }] },
      readymove: { fps: 8, keys: [{ dur: 110, arm: [3, -3], a: -0.8 }, { dur: 110, arm: [4, -4], a: -0.95 },
        { dur: 110, arm: [3, -3], a: -1.1 }, { dur: 110, arm: [4, -3], a: -0.9 },
        { dur: 110, arm: [3, -4], a: -0.85 }, { dur: 110, arm: [4, -4], a: -1.05 }] },
      slash: { fps: 10, keys: [{ dur: 190, arm: [4, -5], a: -2.25 }, { dur: 120, arm: [3, -6], a: -2.5 },
        { dur: 50, arm: [3, -1], a: -0.25, kb: 2, a0: -2.5 }, { dur: 80, arm: [3, 0], a: 0.5, kb: 2, hit: 1 },
        { dur: 130, arm: [3, -2], a: 0.1, kb: 1 }, { dur: 180, arm: [3, -3], a: -0.9 }] },
      thrust: { fps: 10, keys: [{ dur: 180, arm: [2, -4], a: -0.7 }, { dur: 130, arm: [1, -4], a: -1.05, kb: -1 },
        { dur: 55, arm: [2, -3], a: -0.2, kb: 3, hit: 1, a0: -1.05 }, { dur: 90, arm: [3, -2], a: -0.45, kb: 2 },
        { dur: 150, arm: [2, -3], a: -0.75, kb: 1 }, { dur: 190, arm: [3, -3], a: -0.9 }] },
      thrust2: { fps: 10, keys: [{ dur: 170, arm: [3, -5], a: -1.9 }, { dur: 120, arm: [4, -5], a: -2.35 },
        { dur: 50, arm: [4, -2], a: -0.85, kb: 2, a0: -2.35 }, { dur: 85, arm: [3, -1], a: -0.35, kb: 3, hit: 1 },
        { dur: 140, arm: [3, -2], a: -0.6, kb: 1 }, { dur: 190, arm: [3, -3], a: -0.9 }] },
      parry: { fps: 10, keys: [{ dur: 70, arm: [2, -5], a: -1.9, a0: -2.6 },
        { dur: 190, arm: [3, -6], a: -1.75 }, { dur: 140, arm: [3, -3], a: -1.2, kb: -1 }] },
      evade: { fps: 10, keys: [{ dur: 70, arm: [2, -3], a: -0.6 }, { dur: 110, arm: [1, -4], a: -0.7, kb: -2 },
        { dur: 110, arm: [1, -5], a: -0.85, kb: -3 }, { dur: 90, arm: [2, -3], a: -0.55, kb: -1 },
        { dur: 150, arm: [3, -3], a: -0.9 }] },
      lunge: { fps: 10, keys: [{ dur: 130, arm: [3, -5], a: -1.5 }, { dur: 70, arm: [2, -3], a: -0.15, kb: 3, hit: 1, a0: -1.5 },
        { dur: 90, arm: [2, -2], a: -0.35, kb: 2 }, { dur: 190, arm: [3, -3], a: -0.9, kb: 1 }] },
      retreat: { fps: 10, keys: [{ dur: 90, arm: [2, -4], a: -1.1, kb: -2 }, { dur: 90, arm: [1, -4], a: -1.4, kb: -3 },
        { dur: 110, arm: [2, -3], a: -1.2, kb: -1 }, { dur: 170, arm: [3, -3], a: -0.9 }] },
      hit: { fps: 8, keys: [{ dur: 60, arm: [1, -5], a: -1.85, kb: -3, hit: 1 },
        { dur: 100, arm: [1, -4], a: -1.5, kb: -2 }, { dur: 160, arm: [2, -3], a: -1.1, kb: -1 }] },
      knockdown: { fps: 8, loop: false, keys: [{ dur: 70, arm: [1, -4], a: -1.6, kb: -3 },
        { dur: 120, arm: [1, -2], a: -0.5, kb: -4 }, { dur: 170, arm: [1, 0], a: 0.25, kb: -4 },
        { dur: 260, arm: [1, 1], a: 0.75, kb: -4 }] }
    };
    const build = spec => f => action(f, spec.keys.map(k => ({ ...k, tool: tool(k) })));
    const out = [];
    for (const name of Object.keys(sets)) out.push(...facings(name, build(sets[name]), sets[name].fps, sets[name].loop));
    return { width: 32, height: 32, name: 'rpg-spearknight', layers: [{ name: 'Body' }], states: out };
  }

  /* ================= RESTING ================= */
  /* Two channels per cycle — the head settles and the torso follows half a beat
     later — so all four frames differ and the loop closes; a lone bob repeats on
     the half-cycle and hitches. */
  function stool(api, x, y, w) {
    const ww = w || 8;
    api.rect(x, y, x + ww - 1, y + 1, '#5c4a3a');
    api.rect(x, y, x + ww - 1, y, '#8b7455');
    api.rect(x, y + 2, x + 1, y + 4, '#3e3227');
    api.rect(x + ww - 2, y + 2, x + ww - 1, y + 4, '#3e3227');
  }
  function restSuite() {
    /* Head-on the body is 12 columns wide, so a stool under it is entirely
       hidden and the pose loses its only prop: the front and back facings get a
       bench whose legs stand outside the silhouette. */
    const seatFor = f => api => stool(api, f === 'side' ? 10 : 5, 23, f === 'side' ? 8 : 18);
    const pose = (name, keys, fps) => FACINGS.map(([suf, f]) => D(name + '_' + suf, fps, true,
      keys.map((k, i) => Fr(k.dur, R.N({ pal: FARMER, facing: f, sitting: true, legs: k.legs || 'dangle',
        arms: k.arms || 'lap', seatY: k.seatY || 22, lean: k.lean || 0, shin: k.shin || 0,
        bob: Math.max(0, k.bob || 0), headDy: Math.max(0, k.hd || 0), eye: k.eye || 'open',
        mouth: k.mouth || 'closed', kb: k.kb || 0 }, { pre: k.props === false ? null : seatFor(f) }, i)))));
    /* Effort and settle both read DOWNWARD here: a positive bob sinks the torso
       into the seat, which is what resting does, and keeps the hair off row 0
       where the outline pass cannot reach it. */
    const B = [0, 0, 1, 1], H = [0, 1, 1, 0];
    const br = () => H.map((h, i) => ({ dur: 160, hd: h, bob: B[i] }));
    const floor = e => H.map((h, i) => ({ dur: 160, hd: h, bob: B[i], props: false, ...e }));
    const lean = () => H.map((h, i) => ({ dur: [220, 200, 200, 260][i], hd: h, bob: B[i],
      lean: -1, arms: 'crossed', shin: i > 1 ? 2 : 0 }));
    return { width: 32, height: 32, name: 'rpg-rest', layers: [{ name: 'Body' }], states: [
      ...pose('sit_stool', br(), 5),
      ...pose('sit_floor', floor({ legs: 'fold', arms: 'lap', seatY: 25 }), 5),
      ...pose('sit_knees', floor({ legs: 'knees', arms: 'knees', seatY: 25 }), 5),
      ...pose('doze', [0, 2, 3, 1].map((h, i) => ({ dur: [260, 220, 300, 160][i], hd: h, arms: 'crossed',
        eye: i === 1 || i === 2 ? 'closed' : 'open', bob: i === 2 ? 1 : 0 })), 4),
      ...pose('lean_back', lean(), 4),
      ...pose('drink', [{ dur: 190, arms: 'mug' }, { dur: 110, arms: 'mug', hd: 2, eye: 'closed' },
        { dur: 150, arms: 'mug', hd: 1, eye: 'closed', bob: -1 }, { dur: 230, arms: 'lap' }], 4),
      ...pose('shocked', [{ dur: 120, arms: 'cheeks', mouth: 'open' },
        { dur: 260, arms: 'cheeks', mouth: 'open', eye: 'closed', kb: 1, hd: 1 }], 5)
    ] };
  }

  return { FARMER, smithSuite, farmSuite, fishSuite, climbSuite, restSuite, spearSuite,
    action, facings, anvil, forge, barrel, strike, steam, apron, cropRow, fish, hammer, lspear };
})();
