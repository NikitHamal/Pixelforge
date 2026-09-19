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
  /* Spear infantry. The suite ran on the farmer palette, so the one template in
     this pack filed under Enemies was a man in a linen shirt holding a stick.
     At 32px a soldier is read from three things: a steel coif, a gambeson in a
     livery colour, and plate on the shoulder. Tones are kept clear of the
     spearhead's own steel so the shaft crossing the chest still separates. */
  const GUARD = {
    skin: '#e8b796', skinSh: '#c28569', hair: '#8b9bb4', hairSh: '#5a6988', hairHi: '#e0e8f4',
    shirt: '#9e3b3b', shirtSh: '#5c2323', shirtHi: '#c85f52', pants: '#4a5568', pantsSh: '#2f3847',
    boots: '#3e2731', belt: '#3e2731', buckle: '#c0cbdc', outline: OUT, lip: '#a26a5a'
  };
  const STEEL = ['#5a6988', '#c0cbdc', '#ffffff'];
  const HOT = ['#ffffff', '#fee761'];
  const HOE = { handle: '#8a6a4a', head: '#c0cbdc', shine: '#ffffff' };
  const SPEAR = { handle: '#8a6a4a', handleHi: '#b08c62', handleSh: '#5c4025',
    head: '#c0cbdc', shine: '#ffffff', edge: '#8b9bb4', lug: '#5a6988' };

  /* One tool-use cycle from a list of poses. The strike frame is always the
     shortest: a held windup, one fast frame carrying the action, then a settle.
     Evenly-stepped cycles read as a metronome — the clearest tell of a
     procedurally generated action. */
  function action(facing, keys, opts = {}) {
    const frames = [];
    for (let i = 0; i < keys.length; i++) {
      const k = keys[i];
      const extra = { tool: k.tool, eye: k.eye || 'open', mouth: k.mouth || 'closed' };
      const pal = opts.pal || FARMER;
      const cfg = facing === 'side'
        ? Ch().sidePose(i, keys.length, 0, pal, extra)
        : Ch().frontPose(i, keys.length, 0, pal, facing, extra);
      const arm = k.arm || [2, -2];
      if (facing === 'side') cfg.armF = { dx: arm[0], dy: arm[1] };
      else cfg.armR = { dx: arm[0], dy: arm[1] };
      /* Optional far-arm and per-leg overrides. Most actions here are one-handed
         and stand still, so they never set these; a climb is neither, and
         without them both arms track together and the legs are a fixed pair. */
      if (k.arm2) { const o = { dx: k.arm2[0], dy: k.arm2[1] };
        if (facing === 'side') cfg.armB = o; else cfg.armL = o; }
      if (k.lf) { const o = { dx: k.lf[0], dy: k.lf[1] };
        if (facing === 'side') cfg.legF = o; else cfg.legA = o; }
      if (k.lb) cfg.legB = { dx: k.lb[0], dy: k.lb[1] };
      cfg.kb = k.kb || 0;
      /* Effort reads downward only. The hair is authored at y1, so any upward
         excursion of the head — a lifting body or a raised chin — puts it on
         row 0 where the outline pass cannot draw. A strike looks more like a
         strike when the head follows it down anyway. */
      cfg.bob = Math.max(0, k.bob || 0);
      cfg.headDy = Math.max(0, k.hd || 0);
      if (opts.seated) Object.assign(cfg, opts.seated);
      if (opts.cfg) Object.assign(cfg, opts.cfg);
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
  function forge(api, fi) {
    const x = 1, f = fi || 0;
    /* Hearth stones. A pit rectangle with one grey rule across the top and two
       nested orange boxes inside it read as a television with a fire painted on
       the screen. Broken courses and blocks that vary are what say masonry. */
    for (let y = 22; y <= 27; y++) for (let xx = x; xx <= x + 7; xx++) {
      const n = api.hash(xx, y * 3, 31);
      api.px(xx, y, n > 0.7 ? '#4e4436' : n > 0.35 ? '#3e362c' : '#2e2820');
    }
    for (const [bx, by] of [[x, 24], [x + 3, 24], [x + 6, 24], [x + 1, 26], [x + 5, 26]])
      api.rect(bx, by, bx, by + 1, '#241f1a');           // joints between the blocks
    api.rect(x, 21, x + 7, 21, '#6b7a8f');               // dressed stone rim
    api.rect(x, 22, x + 7, 22, '#4a5568');
    api.px(x, 21, '#a8b8cc'); api.px(x + 4, 21, '#a8b8cc');
    /* Coals heaped in the bowl rather than laid flat, with the value climbing
       to white at the heart of it. The sample moves with the frame, so the fire
       breathes across the cycle -- loose embers would each be rimmed by the
       outline pass and come out as dark bricks hanging over the hearth. */
    for (let xx = x + 1; xx <= x + 6; xx++) {
      const d = Math.abs(xx - (x + 3.5)), h = 2 - Math.round(d * 0.5);
      for (let y = 20 - h; y <= 20; y++) {
        const n = api.hash(xx, y + f, 37) + (1 - d / 3) * 0.45;
        api.px(xx, y, n > 1.1 ? '#ffffff' : n > 0.85 ? '#fee761' : n > 0.5 ? '#f77622' : '#a83a1a');
      }
    }
    api.rect(x + 1, 21, x + 6, 21, '#7a2f1a');           // ash banked against the stone
    api.px(x + 2, 21, '#f77622'); api.px(x + 5, 21, '#a83a1a');
  }
  /* Quench barrel. */
  function barrel(api, x, y) {
    /* Three stacked rectangles read as a crate with a blue screen on the front.
       A barrel bulges at the belly, its staves run vertically in tones that do
       not quite match, and the iron hoops stand proud of them. */
    for (let i = 0; i <= 6; i++) {
      const taper = (i === 0 || i === 6) ? 1 : 0;        // ends drawn in top and bottom
      const n = api.hash(i, 3, 53);
      api.rect(x + i, y + taper, x + i, y + 7 - taper,
        i < 2 ? (n > 0.5 ? '#a8763f' : '#96693a') : i < 5 ? '#8a5f33' : '#5c4025');
    }
    api.rect(x + 1, y + 1, x + 1, y + 6, '#c08552');     // stave catching the light
    for (const hy of [y + 3, y + 6]) {                   // iron hoops
      api.rect(x, hy, x + 6, hy, '#5a6988');
      api.px(x + 1, hy, '#a8b8cc'); api.px(x + 5, hy, '#3a4466');
    }
    api.rect(x, y, x + 6, y, '#7d5539');                 // cut ends of the staves
    api.rect(x, y, x + 3, y, '#a8763f');
    api.rect(x + 1, y + 1, x + 5, y + 2, '#124e89');     // water down in the mouth
    api.rect(x + 1, y + 1, x + 5, y + 1, '#0d3f72');     // far side of it in shadow
    api.px(x + 2, y + 2, '#4a7fb5'); api.px(x + 4, y + 1, '#2ce8f5');
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
  /* Scuffs and scorch in the leather. Across eight or nine rows the apron is
     the largest single field on the sprite, and one unbroken brown of that size
     stops reading as a garment and starts reading as the character. */
  function grain(api, x, y, w, h, skip) {
    for (let i = 0; i < 7; i++) {
      const gy = y + Math.round(api.hash(i, 2, 59) * h);
      if (gy === skip) continue;
      api.px(x + Math.round(api.hash(i, 1, 59) * w), gy,
        api.hash(i, 3, 59) > 0.55 ? FARMER.apronSh : FARMER.apronHi);
    }
  }
  function apron(api, cfg) {
    const b = cfg.bob || 0, kb = cfg.kb || 0;
    /* Leather has a grain, a waist seam and a tool pocket. A plain panel the
       width of the torso with three highlight pixels dropped on it is a brown
       rectangle, and at 32px a brown rectangle that size IS the character. */
    const seam = '#3e2a1a';
    if (cfg.facing === 'side') {
      api.rect(12 + kb, 14 + b, 18, 22 + b, FARMER.apron);
      api.rect(17 + kb, 15 + b, 18, 21 + b, FARMER.apronHi);   // lit front edge
      api.rect(12 + kb, 14 + b, 13, 14 + b, FARMER.apronHi);   // shoulder strap
      api.rect(12 + kb, 15 + b, 12, 22 + b, FARMER.apronSh);   // it falls away behind
      api.rect(12 + kb, 18 + b, 18, 18 + b, seam);             // waist band
      api.rect(13 + kb, 18 + b, 16, 18 + b, FARMER.apronSh);
      api.rect(14 + kb, 20 + b, 17, 21 + b, FARMER.apronSh);   // hip pocket
      api.rect(14 + kb, 20 + b, 17, 20 + b, seam);
      api.rect(12 + kb, 22 + b, 18, 22 + b, seam);             // stitched hem
      api.px(13 + kb, 21 + b, FARMER.apronSh);
      grain(api, 13 + kb, 15 + b, 4, 6, 18 + b);
    } else if (cfg.facing === 'down') {
      api.rect(12 + kb, 16 + b, 19, 23 + b, FARMER.apron);
      api.rect(13 + kb, 13 + b, 18, 16 + b, FARMER.apron);     // bib over the chest
      api.rect(13 + kb, 13 + b, 13, 16 + b, FARMER.apronHi);
      api.rect(18 + kb, 14 + b, 18, 16 + b, FARMER.apronSh);
      api.rect(12 + kb, 16 + b, 12, 23 + b, FARMER.apronHi);   // lit near edge
      api.rect(19 + kb, 17 + b, 19, 23 + b, FARMER.apronSh);   // shaded far hem
      api.rect(13 + kb, 16 + b, 18, 16 + b, seam);             // waist seam
      api.rect(14 + kb, 19 + b, 17, 21 + b, FARMER.apronSh);   // tool pocket
      api.rect(14 + kb, 19 + b, 17, 19 + b, seam);
      api.px(15 + kb, 20 + b, FARMER.apronHi);
      api.rect(12 + kb, 23 + b, 19, 23 + b, seam);             // stitched hem
      api.px(13 + kb, 13 + b, FARMER.apronHi); api.px(18 + kb, 13 + b, FARMER.apronHi);
      grain(api, 13 + kb, 17 + b, 5, 5, -1);
    } else {
      // Back view: the apron is on the far side of him, so all that shows is the
      // cross-ties and the waist knot. A full panel here reads as a second torso.
      api.line(12 + kb, 14 + b, 19, 21 + b, FARMER.apronSh, 1);
      api.line(19 + kb, 14 + b, 12, 21 + b, FARMER.apronSh, 1);
      api.rect(11 + kb, 18 + b, 20, 18 + b, FARMER.apron);
      api.px(15 + kb, 18 + b, FARMER.apronHi); api.px(16 + kb, 18 + b, FARMER.apronHi);
    }
  }
  /* Bare earth for a hoe to bite and a crop to stand in. Swinging at nothing
     and throwing a clod out of nowhere is the clearest tell that a prop is
     missing, and a strip that runs wall to wall reads as ground rather than as
     the free-standing brick an inset patch becomes once the outline pass rims
     all four of its sides. */
  function soilRow(api, y) {
    /* Sampled per pixel and darkening with depth. Taking one hash per column
       and running it down three rows ruled the strip into vertical bands of
       flat colour, which with the stones lined up under them came out as a
       planked floor rather than as broken earth. */
    for (let yy = y; yy <= y + 4; yy++) for (let x = 0; x < 32; x++) {
      const n = api.hash(x, yy * 3 + 1, 17), d = (yy - y) * 0.07;
      api.px(x, yy, n > 0.72 + d ? '#5c3d24' : n > 0.34 + d ? '#4a2f1c' : '#3a2416');
    }
    for (let x = 0; x < 32; x++) {                           // crumbling sunlit crest
      const n = api.hash(x, 91, 17);
      api.px(x, y - (n > 0.74 ? 1 : 0), n > 0.46 ? '#7a5636' : '#5c3d24');
    }
    for (let k = 0; k < 8; k++) {                            // clods and turned stones
      const cx = api.hash(k, 11, 23) * 30, cy = y + 1 + api.hash(k, 13, 23) * 3;
      api.px(cx, cy, '#2a1a10'); api.px(cx + 1, cy, '#2a1a10');
      api.px(cx, cy - 1, '#7a5636');
    }
  }
  /* Wheat, not palings. Two-pixel bars of even width capped with one light
     pixel read as green dominoes stood on end; a stalk leans as it rises,
     carries a blade off one side and ends in a head heavy enough to nod. */
  function cropRow(api, y, n, seed) {
    for (let i = 0; i < n; i++) {
      const x = 4 + i * 5, h = 5 + Math.round(api.hash(i, seed, 7) * 3);
      const lean = api.hash(i, seed + 1, 7) > 0.5 ? 1 : -1;
      for (let d = 0; d <= h; d++) {
        const sx = x + Math.round((d / h) * lean);
        api.px(sx, y - d, '#265c42');                        // shaded side of the stem
        api.px(sx + 1, y - d, d > h - 3 ? '#63c74d' : '#3e8948');
      }
      const lx = x + (lean > 0 ? -1 : 2);                    // one blade off the stem
      api.px(lx, y - 2, '#3e8948');
      api.px(lx + (lean > 0 ? -1 : 1), y - 3, '#265c42');
      const tip = x + lean;
      api.rect(tip, y - h - 3, tip + 1, y - h, '#63c74d');   // seed head
      api.rect(tip, y - h - 3, tip, y - h - 1, '#a8f28a');
      api.px(tip + 1, y - h - 3, '#d9f5c0');
      api.px(tip + (lean > 0 ? 1 : -1), y - h - 1, '#3e8948');
    }
  }
  /* A stream leaves the spout as one unbroken thread, breaks up as it falls and
     lands. Seven evenly-spaced dots alternating cyan and blue read as a short
     blue blade held at arm's length -- nothing about them said water. */
  function waterArc(api, x, y, t) {
    const N = 16, end = Math.min(1, t * 1.1);
    for (let i = 0; i <= N * end; i++) {
      const k = i / N, px = x + k * 7, py = y + k * k * 9 + 1;
      api.px(px, py, k < 0.35 ? '#bdf6fb' : '#4a7fb5');
      if (k < 0.5) api.px(px, py + 1, '#2ce8f5');            // solid near the spout
      else if (api.hash(i, 2, 29) > 0.45) api.px(px + 1, py + 1, '#2ce8f5');
    }
    if (end < 0.95) return;
    const gx = x + 7, gy = y + 10;                           // it arrives somewhere
    api.rect(gx - 3, gy, gx + 3, gy, '#1a5a94');
    api.px(gx - 1, gy, '#4a7fb5'); api.px(gx + 2, gy, '#4a7fb5');
    api.px(gx - 3, gy - 1, '#bdf6fb'); api.px(gx + 3, gy - 2, '#bdf6fb');
    api.px(gx - 4, gy - 2, '#2ce8f5'); api.px(gx + 4, gy - 1, '#2ce8f5');
  }
  /* Grain falls at its own rate and leaves a short trail behind it; five specks
     all dropped the same distance on the same tick read as a fixed pattern
     sliding down the cell rather than as anything being scattered. */
  function seeds(api, x, y, t) {
    for (let i = 0; i < 7; i++) {
      const dx = (api.hash(i, 3, 11) - 0.5) * 7;
      const fall = t * (5 + api.hash(i, 5, 11) * 5);
      const sx = x + dx, sy = y + fall;
      api.px(sx, sy - 1, '#a86d20');                         // the trail it fell along
      api.px(sx, sy, i & 1 ? '#fee761' : '#feae34');
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
    /* d runs along the shaft from the grip, o across it. */
    const at = (d, o) => [hx + c * d - s * (o || 0), hy + s * d + c * (o || 0)];
    const seg = (d0, o0, d1, o1, col, w) => {
      const [x0, y0] = at(d0, o0), [x1, y1] = at(d1, o1);
      api.line(x0, y0, x1, y1, col, w || 1);
    };
    /* A spear is mostly shaft, and reach is the whole point of carrying one.
       The old weapon ran twelve units with a head taking five of them and two
       more across, so it read as a hatchet lashed to a stick. */
    /* Eleven units of reach ahead of the grip is the most a 32-cell will take:
       at fourteen the whole blade fell off the right edge on the thrust frames,
       which left the hit reading as a stick and an impact star. */
    seg(-4.5, 0, 6.5, 0, SPEAR.handle, 2);
    seg(-4.5, -1, 6.5, -1, SPEAR.handleHi, 1);             // lit side of the shaft
    seg(-4.5, 1, 6.5, 1, SPEAR.handleSh, 1);               // and the side in shadow
    seg(-2, 0, 0, 0, '#5c4025', 2);                        // bound grip under the hand
    const [bx, by] = at(-5); api.px(bx, by, SPEAR.lug);    // iron butt-cap
    seg(5.5, 0, 7, 0, SPEAR.lug, 2);                       // socket the head sits in
    /* A leaf blade: off the socket it widens, holds, then draws to a needle. */
    for (let i = 0; i <= 5; i++) {
      const w = i === 0 ? 0.6 : i <= 2 ? 1.1 : i === 3 ? 0.8 : 0.4;
      seg(7.5 + i * 0.65, -w, 7.5 + i * 0.65, w, SPEAR.head, 1);
    }
    seg(8, -0.9, 10, -0.3, SPEAR.shine, 1);                // ground edge catching light
    seg(8, 0.9, 10.3, 0.3, SPEAR.edge, 1);                 // the flat turning away
    const [px, py] = at(11); api.px(px, py, SPEAR.shine);  // needle point
  }

  /* Short, dark-headed and top-lit. The shared PF.Pixel.hammer is a 10-unit
     weapon swing; at that length a smith's tool reads as a pale axe, and the
     head lands wherever the shaft points instead of on the anvil. Five units
     puts the face exactly where a raised elbow can drop it. */
  function hammer(api, hx, hy, angle) {
    const len = 5, tx = hx + Math.cos(angle) * len, ty = hy + Math.sin(angle) * len;
    const ha = angle + Math.PI / 2, cx = Math.cos(ha), cy = Math.sin(ha);
    const at = (d, o) => [tx + cx * d + Math.cos(angle) * (o || 0), ty + cy * d + Math.sin(angle) * (o || 0)];
    /* A haft with a bound grip, then a head that has a flat face at one end and
       a peen drawn out to a wedge at the other. A brown bar with a lighter bar
       laid across it is a mallet at best and at this size mostly a smudge. */
    api.line(hx, hy, tx, ty, '#733e39', 2);
    api.line(hx, hy, hx + Math.cos(angle) * 1.5, hy + Math.sin(angle) * 1.5, '#3e2731', 2);
    const [f0x, f0y] = at(-2), [f1x, f1y] = at(1);
    api.line(f0x, f0y, f1x, f1y, '#6b7a8f', 3);                   // the head itself
    api.line(f0x, f0y, f0x, f0y, '#8b9bb4', 3);                   // flat face, worn bright
    const [p0x, p0y] = at(2), [p1x, p1y] = at(3);
    api.line(p0x, p0y, p1x, p1y, '#5a6988', 1);                   // peen
    const [c0x, c0y] = at(-2, -1), [c1x, c1y] = at(1, -1);
    api.line(c0x, c0y, c1x, c1y, '#c0cbdc', 1);                   // lit crest
    api.px(tx, ty, '#a8b8cc');
  }

  /* ================= SMITHING ================= */
  /* The anvil is the scene's anchor, so the whole cycle is authored against it:
     face at y16..18 on a stump to y25, workpiece glowing at y15, and the hammer
     head landing at x23 y17 on the strike frame. Raise, over-top, drop, lift,
     settle — the pause at the top is what sells the weight. */
  function smithSuite() {
    const AX = 21, AY = 16;
    /* Angles keep the head clear of the skull. Straight up at x20 the hammer
       came down across the smith's own face as a grey bar, and the wind-up
       frame is flagged `behind` so the recoil reads as cocked over the shoulder
       rather than resting on his hair. */
    const SMITH = [{ dur: 150, arm: [3, -5], ang: -1.35 }, { dur: 210, arm: [3, -6], ang: -2.3, hd: 1 },
      { dur: 55, arm: [2, -6], ang: 0.8 }, { dur: 120, arm: [2, -4], ang: 0.2, kb: 1 },
      { dur: 230, arm: [3, -3], ang: -0.5 }];
    /* The bar is carried out in front and then dipped. Held up at -1.2 with the
       hand at eye level it crossed the cheek as a horizontal orange rule and
       the smith read as having a beak. */
    const QUENCH = [{ dur: 180, arm: [2, -3], ang: -0.35 }, { dur: 110, arm: [2, -1], ang: 0.75, kb: 1 },
      { dur: 150, arm: [2, 0], ang: 1.0 }, { dur: 240, arm: [2, -4], ang: -0.25, hd: 1 }];
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
        const c = Math.cos(a), s2 = Math.sin(a);
        /* Two arms closing on a rivet rather than one grey rule, and a bar that
           cools from the tip back: white at the heart, orange behind it, then
           the dull red of metal that has been out of the fire a moment. */
        const WATER = 21;                                            // surface in the barrel
        const jx = px + c * 5, jy0 = hy + s2 * 5;
        const sunk = jx > 19 && jy0 > WATER;
        const jy = sunk ? WATER : jy0;
        api.line(px, hy, jx, jy - 1, '#5a6988', 1);
        api.line(px, hy + 1, jx, jy + 1, '#4a5568', 1);
        api.px(px + c * 3, hy + s2 * 3, '#a8b8cc');                  // the rivet
        /* Below the surface there is nothing to draw. Run on regardless and the
           bar passes clean through the barrel and out of the bottom of it. */
        for (let i = 0; i < 5; i++) {
          const q = i / 4, ex = jx + c * i, ey = jy0 + s2 * i;
          if (ex > 19 && ey > WATER) break;
          api.px(ex, ey, q > 0.7 ? '#fff6c9' : q > 0.35 ? '#fee761' : '#f77622');
          api.px(ex, ey + 1, q > 0.6 ? '#f77622' : '#a83a1a');
        }
        if (sunk) {                                                  // what the water shows instead
          api.rect(jx - 2, WATER, jx + 1, WATER, '#f77622');
          api.px(jx, WATER, '#fee761'); api.px(jx - 2, WATER, '#a83a1a');
        }
      }
    });
    const build = keys => {
      const tool = keys === SMITH ? hammerTool : tongsTool;
      return f => action(f, keys.map(k => ({ ...k, tool: tool(k) })), {
        pre: (api, cfg, fi) => {
          forge(api, fi);
          if (keys === SMITH) anvil(api, AX, AY, true);
          else barrel(api, AX, 19);
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
        pre: api => soilRow(api, 26),
        /* The blade opens a trench and the spoil goes up and over. The old cut
           drew two brown bricks sitting on nothing at the farmer's heels. */
        post: (api, cfg, fi) => {
          if (fi < 2 || fi > 3) return;
          const t = fi === 2 ? 0 : 1;
          api.rect(20, 26, 25, 27, '#2a1a10');                // the trench, freshly opened
          api.rect(20, 26, 25, 26, '#3a2416');
          for (let i = 0; i < 6; i++) {
            const a = 2.1 + i * 0.22, r = 3 + t * 6 + api.hash(i, 4, 19) * 3;
            const cx = 23 + Math.cos(a) * r, cy = 25 - Math.sin(a) * r * 0.7 + t * t * 3;
            api.px(cx, cy, i & 1 ? '#7a5636' : '#5c3d24');
            api.px(cx, cy + 1, '#3a2416');
          }
        } },
      plant: { tool: () => bag, keys: [{ dur: 170, arm: [3, -3] }, { dur: 140, arm: [4, -1] },
        { dur: 70, arm: [3, 2], hd: 1 }, { dur: 110, arm: [3, 1] }, { dur: 190, arm: [2, -2] }],
        pre: api => soilRow(api, 26),
        post: (api, cfg, fi) => { if (fi === 2 || fi === 3) seeds(api, 24, 18, fi === 2 ? 0.45 : 1); } },
      water: { tool: () => can, keys: [{ dur: 160, arm: [3, -3] }, { dur: 150, arm: [4, -1] },
        { dur: 90, arm: [4, 2], hd: 1 }, { dur: 130, arm: [4, 1] }, { dur: 180, arm: [3, -2] }],
        pre: api => soilRow(api, 26),
        post: (api, cfg, fi) => { if (fi === 2 || fi === 3) waterArc(api, 23, 16, fi === 2 ? 0.55 : 1); } },
      harvest: { tool: () => sick, keys: [{ dur: 150, arm: [3, -3] }, { dur: 120, arm: [4, -4] },
        { dur: 55, arm: [3, 0], kb: 1 }, { dur: 120, arm: [3, -2] }, { dur: 180, arm: [2, -4], hd: 1 }],
        pre: api => { soilRow(api, 26); cropRow(api, 26, 3, 4); },
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
    /* Three rows of flat blue under one cyan rule is a stripe painted on the
       ground. The field is mottled, and the crests travel with the frame so the
       surface is the thing that moves while the float sits still on it.
       It also runs off the bottom-right corner rather than stopping short: a
       free-standing 10x3 block gets rimmed on all four sides by the outline
       pass and reads as a blue rug laid next to the fisherman. Flooding the
       corner leaves only the bank edge outlined, which is the one edge water
       actually has here. */
    const pool = (api, cfg, fi) => {
      for (let y = WY; y <= 29; y++) for (let x = 20; x <= 31; x++) {
        const n = api.hash(x, y + fi, 13);
        api.px(x, y, n > 0.68 ? '#1a5a94' : n > 0.3 ? '#124e89' : '#0d3f72');
      }
      api.rect(20, WY, 31, WY, '#2ce8f5');                        // lit surface
      api.rect(20, WY + 1, 31, WY + 1, '#1a5a94');
      /* Crests travel left to right and wrap, so the eight-frame cast reads as
         moving water without any frame repeating its neighbour. */
      for (let k = 0; k < 3; k++) {
        const x0 = 20 + ((k * 4 + fi) % 12);
        api.rect(x0, WY + 2, Math.min(31, x0 + 2), WY + 2, '#4a7fb5');
        api.px(Math.min(31, x0 + 1), WY + 2, '#8ecbe8');
        api.px(x0, WY + 3, '#0d3f72');
        const x1 = 20 + ((k * 5 + 2 + fi * 2) % 12);
        api.rect(x1, WY + 4, Math.min(31, x1 + 1), WY + 4, '#2a6aa4');
      }
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
    /* A climb needs something to climb. The first pass drew three loose brown
       pixels beside the figure, which the outline pass boxed individually, so
       the state read as an idle pose with crumbs floating next to it.
       A ladder is now built behind the body in every facing: two rails set at
       the reach of the rig's own hands, and rungs that scroll downward at a
       rate closing exactly over the five-frame cycle, since the climber holds
       station in frame and it is the ladder that has to move. */
    /* Weathered timber, not skin. Painted in the tan ramp the forearms use, the
       rails and the hands gripping them came out as one shape. */
    const RP = { lit: '#8a7a56', mid: '#5f5238', dark: '#372f22' };
    const ladder = (api, fi, lx, rx) => {
      /* Rungs are set back behind the rails and are lit accordingly. Given the
         rails' own highlight they ruled a grid of equal weight across the cell
         and the climber looked caged rather than in front of a ladder. */
      for (let y = 1 + ((fi * 2) % 10); y <= 27; y += 10) {    // rungs, travelling down
        api.rect(lx, y, rx + 1, y, RP.mid);
        api.rect(lx, y + 1, rx + 1, y + 1, RP.dark);
      }
      for (const x of [lx, rx]) {                              // rails drawn over the rungs
        api.rect(x, 1, x + 1, 28, RP.mid);
        api.rect(x, 1, x, 28, RP.lit);
        api.rect(x + 1, 1, x + 1, 28, RP.dark);
      }
    };
    /* Edge-on the rails sit a torso apart and the body hides all but the ends of
       every rung; head-on they stand out at the span of the arms. Either way
       the rails land exactly where the rig puts the hands, which is what keeps
       an extended arm from reading as a brick floating clear of the shoulder. */
    const rig = (api, cfg, fi) => (cfg.facing || 'down') === 'side'
      ? ladder(api, fi, 9, 21) : ladder(api, fi, 6, 24);
    /* Fingers closing over the near rail. Without them the hand is a blunt end
       laid against a post rather than a grip. */
    const grip = (api, cfg, fi) => {
      const k = keys[fi], side = (cfg.facing || 'down') === 'side';
      const wrap = (x, y) => { api.rect(x, y, x + 1, y, FARMER.skinSh); api.px(x, y + 1, FARMER.skinSh); };
      if (side) { wrap(21, 13 + k.arm[1] + (k.bob || 0) + 3); return; }
      wrap(24, 13 + k.arm[1] + (k.bob || 0) + 3);
      wrap(6, 13 + k.arm2[1] + (k.bob || 0) + 3);
    };
    /* The body is what rises, and the only vertical channel the rig offers runs
       downward, so a reach is authored as the low point and the finished pull
       as the high one. Two pixels of travel is enough to see at this size;
       without it the whole cycle is a man standing beside a ladder waving.
       Legs push off in the opposite phase to the pulling arm: as one knee comes
       up under the chest the other drives straight down. */
    const keys = [
      { dur: 150, arm: [3, -6], arm2: [2, 1], lf: [2, -3], lb: [-2, 0], bob: 2 },
      { dur: 110, arm: [3, -4], arm2: [2, 0], lf: [3, -1], lb: [-2, -1], bob: 1, hd: 1 },
      { dur: 140, arm: [3, -1], arm2: [3, -2], lf: [1, 0], lb: [-1, -2], bob: 0, hd: 1 },
      { dur: 150, arm: [2, 1], arm2: [3, -6], lf: [-2, 0], lb: [2, -3], bob: 2 },
      { dur: 110, arm: [2, 0], arm2: [3, -4], lf: [-2, -1], lb: [3, -1], bob: 1, hd: 1 }
    ];
    return { width: 32, height: 32, name: 'rpg-climber', layers: [{ name: 'Body' }], states:
      [...facings('climb', f => action(f, keys, { pre: rig, post: grip }), 8)] };
  }

  /* ================= SPEAR COMBAT ================= */
  /* Draw, combat-ready stance and step, slash, two thrusts, parry, evade, lunge,
     retreat, hit, knockdown. Thrusts drive kb — the whole body steps in — because
     a spear that only moves its own pixels looks like a stick being waved.
     Every angle is chosen against the cell, not just the pose: the head must
     stay inside x2..x29 and y3..y26 at every grip offset so the outline pass can
     rim the whole shaft. */
  /* Steel laid over the gambeson. It goes in post, which runs after the outline
     pass, so it carries its own dark edge -- nothing drawn there gets a rim for
     free, and a bare grey slab on the shoulder reads as damage rather than
     armour. */
  function plate(api, cfg) {
    const bob = Math.max(0, cfg.bob || 0), kb = cfg.kb || 0, ty = 14 + bob;
    const hy = 4 + bob + (cfg.headDy || 0);
    if (cfg.facing === 'side') {
      const tx = 12 + kb, hx = tx - 1;
      /* The plate rides the shoulder it is strapped to. Pinned to the torso it
         stayed at chest height while the weapon arm went up past the jaw, so
         the guard stance had a steel tile floating clear of a bare red sleeve. */
      const ay = ty + clampA((cfg.armF || {}).dy || 0, -1, 0);
      api.rect(tx + 4, ay - 1, tx + 7, ay + 1, '#7d8aa0');    // pauldron on the near shoulder
      api.rect(tx + 4, ay - 1, tx + 7, ay - 1, '#c0cbdc');    // lit crest of the plate
      api.rect(tx + 4, ay + 2, tx + 7, ay + 2, '#3a4466');    // its lower lip, in shadow
      api.px(tx + 3, ay, '#3a4466');
      /* On a high windup the rig lifts the whole sleeve to cheek height, and
         in a dark-red livery that landed on the profile as a wound. Mail on
         the upper arm ties it back to the helm. Rows are counted from below
         the shoulder so the plate never creeps up over the eye. */
      const ady = (cfg.armF || {}).dy || 0;
      if (ady <= -3) {
        api.rect(tx + 4, ty + ady + 1, tx + 6, ty + ady + 2, '#5a6988');
        api.px(tx + 6, ty + ady + 1, '#7d8aa0');
        api.px(tx + 4, ty + ady + 2, '#3a4466');
      }
      api.rect(tx + 1, ty + 1, tx + 4, ty + 1, '#5a6988');    // mail showing under the arm
      api.px(tx + 2, ty + 2, '#3a4466'); api.px(tx + 4, ty + 3, '#3a4466');
      /* Steel-toned hair alone is a grey haircut. What says helm is hardware:
         a browband, a cheek plate over the ear and a nasal down the face. */
      api.rect(hx + 1, hy + 2, hx + 9, hy + 2, '#c0cbdc');
      api.rect(hx + 1, hy + 3, hx + 3, hy + 3, '#5a6988');
      api.rect(hx + 1, hy + 4, hx + 3, hy + 7, '#7d8aa0');    // cheek plate covering the ear
      api.rect(hx + 1, hy + 7, hx + 3, hy + 7, '#3a4466');
      api.px(hx + 1, hy + 4, '#c0cbdc');
      api.rect(hx + 9, hy + 2, hx + 9, hy + 5, '#8b9bb4');    // nasal, standing off the brow
      api.px(hx + 10, hy + 3, '#3a4466');
      return;
    }
    const tx = 10 + kb, hx = tx;
    /* Three pixels of plate a side, not four: at four the two pauldrons and the
       mail between them ran together into one unbroken grey rule across the
       whole chest and the livery underneath disappeared. */
    /* One row of travel, and set two columns outboard of the chest. Head-on the
       skull is as wide as the shoulders, so a plate that rides up or sits in
       over the torso lands on the cheek: at four rows of travel the weapon-arm
       plate climbed past the collar and gave the soldier a steel horn. */
    for (const [ox, a] of [[tx - 2, cfg.armL || {}], [tx + 10, cfg.armR || {}]]) {
      const ay = ty + clampA(a.dy || 0, -1, 0), sx = ox + clampA(a.dx || 0, -1, 1);
      api.rect(sx, ay - 1, sx + 3, ay + 1, '#7d8aa0');
      api.rect(sx, ay - 1, sx + 3, ay - 1, '#c0cbdc');
      api.rect(sx, ay + 2, sx + 3, ay + 2, '#3a4466');
    }
    if (cfg.facing === 'up') {
      api.rect(hx + 5, hy - 2, hx + 5, hy + 6, '#e0e8f4');    // comb running over the crown
      api.rect(hx + 6, hy - 2, hx + 6, hy + 6, '#5a6988');
      api.rect(hx + 1, hy + 7, hx + 10, hy + 9, '#7d8aa0');   // neck guard at the nape
      api.rect(hx + 1, hy + 7, hx + 10, hy + 7, '#c0cbdc');
      api.rect(hx + 1, hy + 9, hx + 10, hy + 9, '#3a4466');
      api.px(hx + 2, hy + 8, '#3a4466'); api.px(hx + 9, hy + 8, '#3a4466');
      return;
    }
    api.rect(tx + 4, ty + 2, tx + 7, ty + 2, '#5a6988');      // mail at the throat
    api.px(tx + 5, ty + 3, '#3a4466'); api.px(tx + 6, ty + 4, '#3a4466');
    /* The band has to start at hy+2. One row lower and the skin of the fringe
       gap showed through above it as a dashed tan rule across the forehead. */
    api.rect(hx + 1, hy + 2, hx + 10, hy + 4, '#8b9bb4');     // browband
    api.rect(hx + 1, hy + 2, hx + 10, hy + 2, '#e0e8f4');
    api.rect(hx + 1, hy + 4, hx + 10, hy + 4, '#5a6988');
    api.rect(hx + 5, hy + 5, hx + 5, hy + 7, '#c0cbdc');      // nasal between the eyes
    api.rect(hx + 6, hy + 5, hx + 6, hy + 7, '#5a6988');
    api.rect(hx - 1, hy + 5, hx, hy + 7, '#7d8aa0');          // cheek plates
    api.rect(hx + 11, hy + 5, hx + 12, hy + 7, '#5a6988');
    api.px(hx - 1, hy + 5, '#c0cbdc'); api.px(hx + 12, hy + 7, '#3a4466');
  }

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
        { dur: 50, arm: [3, -1], a: -0.25, kb: 2, a0: -2.5 }, { dur: 80, arm: [1, 0], a: 0.5, kb: 2, hit: 1 },
        { dur: 130, arm: [3, -2], a: 0.1, kb: 1 }, { dur: 180, arm: [3, -3], a: -0.9 }] },
      thrust: { fps: 10, keys: [{ dur: 180, arm: [2, -4], a: -0.7 }, { dur: 130, arm: [1, -4], a: -1.05, kb: -1 },
        { dur: 55, arm: [0, -3], a: -0.2, kb: 2, hit: 1, a0: -1.05 }, { dur: 90, arm: [1, -2], a: -0.45, kb: 1 },
        { dur: 150, arm: [2, -3], a: -0.75, kb: 1 }, { dur: 190, arm: [3, -3], a: -0.9 }] },
      thrust2: { fps: 10, keys: [{ dur: 170, arm: [3, -5], a: -1.9 }, { dur: 120, arm: [4, -5], a: -2.35 },
        { dur: 50, arm: [4, -2], a: -0.85, kb: 2, a0: -2.35 }, { dur: 85, arm: [1, -1], a: -0.35, kb: 2, hit: 1 },
        { dur: 140, arm: [3, -2], a: -0.6, kb: 1 }, { dur: 190, arm: [3, -3], a: -0.9 }] },
      parry: { fps: 10, keys: [{ dur: 70, arm: [2, -5], a: -1.9, a0: -2.6 },
        { dur: 190, arm: [3, -6], a: -1.75 }, { dur: 140, arm: [3, -3], a: -1.2, kb: -1 }] },
      evade: { fps: 10, keys: [{ dur: 70, arm: [2, -3], a: -0.6 }, { dur: 110, arm: [1, -4], a: -0.7, kb: -2 },
        { dur: 110, arm: [1, -5], a: -0.85, kb: -3 }, { dur: 90, arm: [2, -3], a: -0.55, kb: -1 },
        { dur: 150, arm: [3, -3], a: -0.9 }] },
      lunge: { fps: 10, keys: [{ dur: 130, arm: [3, -5], a: -1.5 }, { dur: 70, arm: [0, -3], a: -0.15, kb: 2, hit: 1, a0: -1.5 },
        { dur: 90, arm: [1, -2], a: -0.35, kb: 1 }, { dur: 190, arm: [3, -3], a: -0.9, kb: 1 }] },
      retreat: { fps: 10, keys: [{ dur: 90, arm: [2, -4], a: -1.1, kb: -2 }, { dur: 90, arm: [1, -4], a: -1.4, kb: -3 },
        { dur: 110, arm: [2, -3], a: -1.2, kb: -1 }, { dur: 170, arm: [3, -3], a: -0.9 }] },
      hit: { fps: 8, keys: [{ dur: 60, arm: [1, -5], a: -1.85, kb: -3, hit: 1 },
        { dur: 100, arm: [1, -4], a: -1.5, kb: -2 }, { dur: 160, arm: [2, -3], a: -1.1, kb: -1 }] },
      knockdown: { fps: 8, loop: false, keys: [{ dur: 70, arm: [1, -4], a: -1.6, kb: -3 },
        { dur: 120, arm: [1, -2], a: -0.5, kb: -4 }, { dur: 170, arm: [1, 0], a: 0.25, kb: -4 },
        { dur: 260, arm: [1, 1], a: 0.75, kb: -4 }] }
    };
    const build = spec => f => action(f, spec.keys.map(k => ({ ...k, tool: tool(k) })),
      { pal: GUARD, post: plate, cfg: { pack: false } });
    const out = [];
    for (const name of Object.keys(sets)) out.push(...facings(name, build(sets[name]), sets[name].fps, sets[name].loop));
    return { width: 32, height: 32, name: 'rpg-spearknight', layers: [{ name: 'Body' }], states: out };
  }

  /* ================= RESTING ================= */
  /* Two channels per cycle — the head settles and the torso follows half a beat
     later — so all four frames differ and the loop closes; a lone bob repeats on
     the half-cycle and hitches. */
  /* A stool with a lit seat, a shadowed lip and splayed legs braced by a
     stretcher. A plank on two dark posts sat under the figure at exactly the
     height and colour of its boots, so the prop read as a second pair of feet
     rather than as the thing being sat on. */
  function stool(api, x, y, w) {
    const ww = w || 8, r = x + ww - 1;
    api.rect(x, y, r, y + 1, '#5c4a3a');
    api.rect(x, y, r, y, '#a8895f');                        // seat catching the light
    api.rect(x, y + 1, r, y + 1, '#3e3227');                // shadow under the lip
    for (const s of [-1, 1]) {
      const lx = s < 0 ? x + 1 : r - 2;
      api.rect(lx, y + 2, lx + 1, y + 3, '#5c4a3a');
      api.rect(lx + (s < 0 ? 0 : 1), y + 2, lx + (s < 0 ? 0 : 1), y + 3, s < 0 ? '#7a6247' : '#3e3227');
      api.rect(lx + s, y + 4, lx + 1 + s, y + 4, '#3e3227'); // foot, kicked outward
    }
    api.rect(x + 3, y + 3, r - 3, y + 3, '#4a3b2d');        // stretcher between the legs
  }
  /* Contact shadow for the poses that have no seat. Sitting cross-legged on
     nothing reads as hovering, but a strip of flagstone is scenery, and scenery
     baked into a character cell cannot be composited over whatever ground the
     game actually has. A pool of shade touching the figure grounds it and
     travels with it. Drawn in pre so it joins the silhouette and takes one rim
     with the body rather than being outlined as a separate island. */
  function shadow(api, cx, y, rx) {
    /* Kept only a little darker than the outline it will be rimmed with. At
       near-black it stopped reading as shade and became a hole with the figure
       sunk into it, and at nine pixels of radius it was wider than the sprite. */
    api.ellipse(cx - rx, y, cx + rx, y + 2, '#3a3250', true);
    api.ellipse(cx - rx + 2, y, cx + rx - 2, y + 1, '#2c2640', true);
  }
  /* Sleep marks and a shock bang. Post hooks run after the outline pass, so a
     glyph painted there has no rim of its own and dissolves into whatever it
     is drawn over -- both of these carry one by hand. */
  function glyph(api, stroke, c) {
    /* A drop shadow, not a rim. Boxing a 2px glyph on all four sides fills its
       own counters: the Z came out as a pair of grey squares and the bang as a
       solid yellow bar with no gap above the dot. */
    stroke(1, 1, OUT);
    stroke(0, 0, c);
  }
  function zed(api, x, y, s, c) {
    glyph(api, (ox, oy, col) => {
      api.rect(x + ox, y + oy, x + ox + s, y + oy, col);
      for (let d = 0; d <= s; d++) api.px(x + ox + s - d, y + oy + 1 + Math.round(d * (s - 1) / s), col);
      api.rect(x + ox, y + oy + s, x + ox + s, y + oy + s, col);
    }, c);
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
        mouth: k.mouth || 'closed', kb: k.kb || 0 },
        { pre: k.props === false ? (k.floor ? api => shadow(api, 16, 25, 7) : null) : seatFor(f), post: k.post }, i)))));
    /* Effort and settle both read DOWNWARD here: a positive bob sinks the torso
       into the seat, which is what resting does, and keeps the hair off row 0
       where the outline pass cannot reach it. */
    const B = [0, 0, 1, 1], H = [0, 1, 1, 0];
    const br = () => H.map((h, i) => ({ dur: 160, hd: h, bob: B[i] }));
    const floor = e => H.map((h, i) => ({ dur: 160, hd: h, bob: B[i], props: false, floor: true, ...e }));
    const lean = () => H.map((h, i) => ({ dur: [220, 200, 200, 260][i], hd: h, bob: B[i],
      lean: -1, arms: 'crossed', shin: i > 1 ? 2 : 0 }));
    return { width: 32, height: 32, name: 'rpg-rest', layers: [{ name: 'Body' }], states: [
      ...pose('sit_stool', br(), 5),
      ...pose('sit_floor', floor({ legs: 'fold', arms: 'lap', seatY: 25 }), 5),
      ...pose('sit_knees', floor({ legs: 'knees', arms: 'knees', seatY: 25 }), 5),
      /* Three sleep marks drifting up and out. Closed eyes alone are a blink at
         this size; the glyphs are what make a doze read as a doze. */
      ...pose('doze', [0, 2, 3, 1].map((h, i) => ({ dur: [260, 220, 300, 160][i], hd: h, arms: 'crossed',
        eye: i === 1 || i === 2 ? 'closed' : 'open', bob: i === 2 ? 1 : 0,
        post: api => {
          zed(api, 21, 10 - i, 3, '#e8ecf5');
          if (i >= 1) zed(api, 26, 5 - i, 2, '#c0cbdc');
        } })), 4),
      ...pose('lean_back', lean(), 4),
      ...pose('drink', [{ dur: 190, arms: 'mug' }, { dur: 110, arms: 'mug', hd: 2, eye: 'closed' },
        { dur: 150, arms: 'mug', hd: 1, eye: 'closed', bob: -1 }, { dur: 230, arms: 'lap' }], 4),
      ...pose('shocked', [0, 1].map(i => ({ dur: [120, 260][i], arms: 'cheeks', mouth: 'open',
        eye: i ? 'closed' : 'open', kb: i, hd: i,
        post: api => {
          const y = 2 + i * 2;
          glyph(api, (ox, oy, c) => { api.rect(23 + ox, y + oy, 24 + ox, y + 3 + oy, c);
            api.rect(23 + ox, y + 5 + oy, 24 + ox, y + 5 + oy, c); }, '#fee761');
          api.px(23, y, '#ffffff');
          if (i) { api.px(9, y + 7, '#8ecbe8'); api.px(9, y + 8, '#4a7fb5'); }   // sweat flicked off
        } })), 5)
    ] };
  }

  return { FARMER, smithSuite, farmSuite, fishSuite, climbSuite, restSuite, spearSuite,
    action, facings, anvil, forge, barrel, strike, steam, apron, cropRow, fish, hammer, lspear };
})();
