/* PixelForge Studio — Sci-fi pack.
   Crew, machines and station kit for anything from a Metroid-like to a
   top-down colony sim: an EVA astronaut and a marine on a shared 3/4 rig, a
   walker robot, a hover drone, a wall turret, a piloted mech, a 16-tile
   station sheet and a rack of consoles, crates and airlocks.

   The look is deliberately grounded: desaturated hull greys with ONE saturated
   accent per unit (visor cyan, marine orange, drone red), which is what keeps
   eight sci-fi sprites from turning into eight grey blobs. */
window.PF = window.PF || {};
PF.SciFi = (() => {
  const P = () => PF.Pixel;
  const D = (name, fps, loop, frames) => ({ name, fps, loop, frames });
  const Fr = (duration, paint) => ({ duration, paint });
  const ms = fps => Math.round(1000 / fps);
  const OUT = '#181425';
  const OUT32 = PF.Color.hexToU32(OUT);
  const finish = (buf, W, H) => buf.set(PF.Raster.outline(buf, W, H, OUT32));
  const draw = painter => (buf, W, H) => { painter(P().makeApi(buf, W, H), W, H); finish(buf, W, H); };
  const seq = (n, fps, make) => Array.from({ length: n }, (_, i) =>
    Fr(ms(fps), draw((a, W, H) => make(a, i, n > 1 ? i / (n - 1) : 0, W, H))));
  const cyc = (n, fps, make) => Array.from({ length: n }, (_, i) =>
    Fr(ms(fps), draw((a, W, H) => make(a, i, i / n, W, H))));
  const still = painter => [Fr(200, draw(painter))];
  const TAU = Math.PI * 2;

  function blob(a, cx, cy, rx, ry, base, hi, sh) {
    a.ellipse(cx - rx, cy - ry, cx + rx, cy + ry, base, true);
    const hb = Math.max(1, ry >> 1);
    if (hi) a.ellipse(cx - rx + 1, cy - ry, cx + rx - 1, cy - ry + hb, hi, true);
    if (sh) a.ellipse(cx - rx + 1, cy + ry - hb, cx + rx - 1, cy + ry, sh, true);
  }
  function speck(a, x0, y0, x1, y1, seed, colors, density = 0.1) {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++)
      if (a.hash(x, y, seed) < density) a.px(x, y, colors[Math.floor(a.hash(x, y, seed + 71) * colors.length) % colors.length]);
  }
  /* Panel lines: the single cheapest way to make a flat rect read as hull. */
  function panelLines(a, x0, y0, x1, y1, c, step = 4) {
    for (let y = y0 + step; y < y1; y += step) a.line(x0, y, x1, y, c, 1);
  }
  /* A blinking indicator that never sits on the same frame twice. */
  const led = (a, x, y, on, c, off = '#3d4a5c') => { a.px(x, y, on ? c : off); if (on) { a.px(x - 1, y, c); a.px(x, y - 1, c); } };

  /* =============================================================== CREW ===
     One 3/4 humanoid rig, two kits. Feet on y25..27, headgear below y1. */
  function crewRig(a, pal, o) {
    const hip = o.hip === undefined ? 20 : o.hip, sw = o.swing || 0;
    const legY = hip + 5, up = Math.round(sw), dn = -up;
    /* Far side first, in the shadow ramp. Two tones of separation between the
       far limbs and the torso is what stops a 32px figure from reading as one
       white slab — the walk cycle is invisible without it. */
    const limb = (x, top, phase, main, dark, boot, bootDark) => {
      a.rect(x, top, x + 2, legY + phase, dark);
      a.rect(x, top, x, legY + phase, main);
      a.rect(x - 1, legY + phase, x + 2, legY + 2 + phase, boot);
      a.rect(x - 1, legY + 2 + phase, x + 2, legY + 2 + phase, bootDark);
    };
    limb(13, hip - 1, up, pal.legSh, pal.legSh, pal.bootSh, pal.bootSh);
    // far arm, counter-swinging against the far leg
    a.rect(10, hip - 9, 12, hip - 2 - up, pal.suitSh);
    a.rect(10, hip - 2 - up, 12, hip - up, pal.gloveSh);
    // torso: chest block over a narrower waist reads as a pressure suit
    a.ellipse(11, hip - 11, 21, hip - 2, pal.suit, true);
    a.ellipse(12, hip - 11, 20, hip - 8, pal.suitHi, true);
    a.ellipse(12, hip - 4, 20, hip - 2, pal.suitSh, true);
    a.rect(13, hip - 8, 19, hip - 7, pal.accent);                  // chest stripe
    a.rect(13, hip - 8, 19, hip - 8, pal.suitHi);
    a.rect(12, hip - 6, 20, hip - 6, pal.suitSh);                  // seam
    /* A one-row belt with a buckle. Two full-width rows of accent at this
       scale reads as a skirt and swallows the whole lower torso. */
    a.rect(13, hip - 3, 19, hip - 3, pal.belt);
    a.rect(13, hip - 2, 19, hip - 2, pal.beltDark);
    a.rect(15, hip - 3, 17, hip - 2, pal.beltDark);
    a.px(16, hip - 3, pal.belt);
    // backpack nub on the far side sells the 3/4 view
    a.rect(9, hip - 9, 11, hip - 4, pal.packSh);
    a.rect(9, hip - 9, 9, hip - 4, pal.suitSh);
    /* The helmet dome spans hy-5..hy+5 and the walk cycle drops the hip to 19,
       so hy has to stay at hip-13: at hip-15 the dome clips row 0 and the
       outline pass can no longer close around the sprite. */
    const hy = hip - 13;
    a.rect(13, hy + 3, 19, hy + 4, pal.helmSh);                    // neck ring
    blob(a, 16, hy, 4, 4, pal.helm, pal.helmHi, pal.helmSh);
    a.ellipse(13, hy - 2, 20, hy + 2, pal.visor, true);
    /* Reflection size is per-kit. A full-width glint on a dark combat visor
       reads as an open beak, so the marine gets a two-pixel slit instead. */
    if (pal.glint === 'slit') { a.rect(14, hy - 1, 15, hy - 1, pal.visorHi); a.px(19, hy + 1, pal.visorHi); }
    else { a.ellipse(14, hy - 1, 17, hy, pal.visorHi, true); a.px(14, hy - 1, '#ffffff'); }
    if (o.face === 'alert') a.rect(18, hy, 19, hy + 1, pal.accent);
    // near leg, near arm
    limb(17, hip - 1, dn, pal.leg, pal.legSh, pal.boot, pal.bootSh);
    a.rect(20, hip - 9, 22, hip - 2 + up, pal.suit);
    a.rect(20, hip - 9, 20, hip - 2 + up, pal.suitHi);
    a.rect(20, hip - 2 + up, 22, hip + up, pal.glove);
    if (o.hand) o.hand(a, 22, hip + up);
  }
  const ASTRO = { suit: '#e4eaf2', suitHi: '#ffffff', suitSh: '#97a7bd', helm: '#c0cbdc', helmHi: '#ffffff',
    helmSh: '#6d7d92', visor: '#17456d', visorHi: '#2ce8f5', leg: '#c9d4e0', legSh: '#8b9bb4',
    boot: '#3d4a5c', bootSh: '#252d3a', glove: '#f6a03a', gloveSh: '#b06a12', packSh: '#6d7d92',
    belt: '#f6a03a', beltDark: '#b06a12', accent: '#2ce8f5' };
  const MARINE = { suit: '#6a7d5e', suitHi: '#93a87c', suitSh: '#38442f', helm: '#3c4738', helmHi: '#5d6d51',
    helmSh: '#222a1e', visor: '#1b1208', visorHi: '#f6a03a', glint: 'slit', leg: '#414e3a', legSh: '#252e21',
    boot: '#252d3a', bootSh: '#14181f', glove: '#252d3a', gloveSh: '#14181f', packSh: '#2c3628',
    belt: '#8a5a20', beltDark: '#4d320f', accent: '#252d3a' };
  const ENGI = { suit: '#f6a03a', suitHi: '#ffd08a', suitSh: '#a8600f', helm: '#ffd24a', helmHi: '#fff6c9',
    helmSh: '#a8600f', visor: '#2a2038', visorHi: '#9ad8ff', leg: '#4a4a5c', legSh: '#2c2c3a',
    boot: '#252d3a', bootSh: '#14181f', glove: '#4a4a5c', gloveSh: '#2c2c3a', packSh: '#a8600f',
    belt: '#c0cbdc', beltDark: '#6d7d92', accent: '#2ce8f5' };

  function crewSuite(pal, name, weapon) {
    const hand = weapon;
    return {
      width: 32, height: 32, name, layers: [{ name: 'crew' }],
      states: [
        D('idle', 5, true, cyc(4, 5, (a, i, t) => crewRig(a, pal, { hip: 20 + [0, 1, 0, -1][i] * 0.6, swing: [0, 0.4, 0, -0.4][i], hand }))),
        D('walk', 10, true, cyc(6, 10, (a, i) => crewRig(a, pal, { hip: 20 - (i % 2), swing: Math.sin((i / 6) * TAU) * 2, hand }))),
        /* The raised arm has to be drawn here, not delegated to the weapon:
           an unarmed crew member would otherwise give three identical frames. */
        D('aim', 8, false, seq(3, 8, (a, i, t) => { crewRig(a, pal, { hip: 20 - i * 0.4, swing: -0.6, face: 'alert' });
          const ax = 21 + i, ay = 14 - i * 2;
          a.line(20, 15, ax, ay, pal.suit, 2); a.line(20, 15, ax, ay, pal.suitHi, 1);
          a.rect(ax - 1, ay - 2, ax + 1, ay, pal.suitSh);
          if (hand) hand(a, ax + 1, ay); })),
        D('hurt', 10, false, seq(3, 10, (a, i) => { crewRig(a, pal, { hip: 20 + i, swing: 1.2 - i * 0.6, hand });
          for (let k = 0; k < 4 - i; k++) a.px(22 + k, 9 + k * 2 - i, '#e43b44'); })),
        // A vacuum death: the suit vents. One-shot, no loop closure check.
        /* A vacuum death: knees buckle, the suit folds forward, the neck ring
           vents in a spreading puff. An evenly-spaced diagonal of specks reads
           as a fishing line, so the vent is a widening cloud instead. */
        D('down', 8, false, seq(4, 8, (a, i, t) => {
          const y = 20 + i * 2, lean = i * 2;
          a.rect(12 + lean, y + 4, 21 + lean, y + 7, pal.legSh);
          a.rect(11 + lean, y + 6, 22 + lean, y + 7, pal.bootSh);
          a.ellipse(9 + lean, y - 1, 20 + lean, y + 5, pal.suit, true);
          a.ellipse(10 + lean, y - 1, 19 + lean, y + 1, pal.suitHi, true);
          a.rect(10 + lean, y + 2, 20 + lean, y + 2, pal.belt);
          blob(a, 9 + lean, y - 2, 4, 4, pal.helm, pal.helmHi, pal.helmSh);
          a.ellipse(6 + lean, y - 4, 13 + lean, y, pal.visor, true);
          a.px(7 + lean, y - 3, pal.visorHi);
          const r = 2 + i * 2;
          for (let k = 0; k < 7; k++) {
            const ang = (k / 7) * TAU - 1.2;
            a.px(19 + lean + Math.cos(ang) * r, y - 4 + Math.sin(ang) * r * 0.7, k % 2 ? '#c0cbdc' : '#ffffff');
          }
        }))
      ]
    };
  }
  const rifle = (a, hx, hy) => {
    a.rect(hx - 1, hy - 1, hx + 8, hy + 1, '#3d4a5c');
    a.rect(hx - 1, hy - 1, hx + 8, hy - 1, '#6d7d92');
    a.rect(hx + 8, hy, hx + 9, hy, '#2ce8f5');
    a.rect(hx + 1, hy + 2, hx + 3, hy + 3, '#252d3a');
  };
  /* A compact spanner hanging from the fist. Swinging the head up and away
     from the hand turns it into a shepherd's crook twice the size of the
     torso, which is exactly what a long line + a hollow square reads as. */
  const wrench = (a, hx, hy) => {
    a.rect(hx, hy - 2, hx + 1, hy + 3, '#8b9bb4');
    a.rect(hx, hy - 2, hx, hy + 3, '#e4eaf2');
    a.rect(hx - 1, hy + 3, hx + 2, hy + 6, '#c0cbdc');
    a.rect(hx - 1, hy + 3, hx + 2, hy + 3, '#e4eaf2');
    a.rect(hx, hy + 5, hx + 1, hy + 6, '#6d7d92');
  };
  const astronautSuite = () => crewSuite(ASTRO, 'Astronaut', null);
  const marineSuite = () => crewSuite(MARINE, 'Space Marine', rifle);
  const engineerSuite = () => crewSuite(ENGI, 'Station Engineer', wrench);

  /* ============================================================== ROBOT ===
     A bipedal walker. Everything is boxes, which is the point: the eye reads
     "machine" from hard corners the instant it reads "creature" from curves. */
  function robotSuite() {
    const body = '#8b9bb4', bodyD = '#4a5568', bodyL = '#c9d4e0', eye = '#ff4d4d', joint = '#3d4a5c';
    const at = (a, cy, step, lean, eyeOn) => {
      const hip = 20;
      for (const s of [-1, 1]) {
        const off = s * 5, ph = s > 0 ? step : -step;
        a.rect(16 + off - 2, hip, 16 + off + 1, hip + 3 + ph, s > 0 ? body : bodyD);
        a.rect(16 + off - 3, hip + 4 + ph, 16 + off + 2, hip + 6 + ph, joint);
        a.rect(16 + off - 3, hip + 4 + ph, 16 + off + 2, hip + 4 + ph, s > 0 ? bodyL : body);
      }
      a.rect(9, hip - 2, 22, hip + 1, joint);                          // pelvis
      a.rect(10, cy - 6, 21, hip - 1, body);                           // chassis
      a.rect(10, cy - 6, 21, cy - 5, bodyL);
      a.rect(10, hip - 3, 21, hip - 2, bodyD);
      panelLines(a, 11, cy - 4, 20, hip - 3, bodyD, 3);
      a.rect(12, cy - 3, 19, cy - 1, '#252d3a');                       // vent grille
      for (let x = 12; x <= 19; x += 2) a.rect(x, cy - 3, x, cy - 1, joint);
      // arms: pistons, counter-swinging
      for (const s of [-1, 1]) {
        const ax = 16 + s * 8, ph = s > 0 ? -step : step;
        a.rect(ax - 1, cy - 5, ax + 1, cy + 2 + ph, s > 0 ? body : bodyD);
        a.rect(ax - 1, cy - 5, ax - 1, cy + 2 + ph, bodyL);
        a.rect(ax - 2, cy + 3 + ph, ax + 2, cy + 5 + ph, joint);
      }
      // head: a visor bar, not a face. One red slit = one clear intent.
      const hy = cy - 11 + Math.round(lean);
      a.rect(12, hy, 19, hy + 5, bodyD);
      a.rect(12, hy, 19, hy, bodyL);
      a.rect(13, hy + 2, 18, hy + 3, '#252d3a');
      if (eyeOn) { a.rect(14, hy + 2, 17, hy + 2, eye); a.px(14, hy + 2, '#ffd0d0'); }
      /* One-pixel antenna: the walk cycle lifts the chassis a row, so a 2px
         mast plus its tip lands on row 0 and breaks the outline. */
      a.rect(15, hy - 1, 16, hy - 1, '#c0cbdc');
      a.px(15, hy - 2, eyeOn ? eye : joint);
    };
    return {
      width: 32, height: 32, name: 'Walker Robot', layers: [{ name: 'robot' }],
      states: [
        D('idle', 4, true, cyc(4, 4, (a, i) => at(a, 15 - [0, 1, 0, 0][i], 0, [0, 0, 0, 1][i], i !== 2))),
        D('walk', 10, true, cyc(4, 10, (a, i) => at(a, 15 - (i % 2), [1, 0, -1, 0][i], 0, true))),
        /* Radar sweep. The beam starts clear of the skull and only fans
           forward — a ray drawn from the visor centre crosses the head and
           reads as a rod stuck through it. Kept short so it misses row 0. */
        D('scan', 6, true, cyc(4, 6, (a, i) => { at(a, 15, 0, 0, true);
          const ang = -0.55 + (i / 4) * 1.0;
          for (let k = 0; k < 8; k += 2) {
            const r = 7 + k * 0.9;
            a.px(16 + Math.cos(ang) * r, 9 + Math.sin(ang) * r, k > 4 ? '#ff9b9b' : '#ff4d4d');
          }
          const er = 12 + (i % 2);
          a.px(16 + Math.cos(ang) * er, 9 + Math.sin(ang) * er, '#ffd0d0'); })),
        /* The flash has to come out of something. Without a barrel the burst
           floats beside the chassis and reads as a held egg — and a round
           blob reads as one too, so the muzzle flare is a cross, not a ball. */
        D('fire', 12, false, seq(3, 12, (a, i) => { at(a, 15, 0, 0, true);
          const recoil = [2, 0, 1][i], gx = 22 + recoil;
          a.rect(gx, 12, gx + 2, 17, joint);                       // gun housing
          a.rect(gx, 12, gx + 2, 12, bodyL);
          a.rect(gx + 3, 13, gx + 5, 15, '#252d3a');               // barrel
          a.rect(gx + 3, 13, gx + 5, 13, '#4a5568');
          if (i < 2) {
            const r = i ? 2 : 4, mx = gx + 6, my = 14;
            for (let k = 0; k < 4; k++) {                          // four-point flare
              const c = k % 2 ? '#ffd24a' : '#fff6c9';
              a.line(mx, my, mx + [r, 0, -r * 0.5, 0][k], my + [0, -r, 0, r][k], c, k % 2 ? 1 : 2);
            }
            a.ellipse(mx - 1, my - 1, mx + 1, my + 1, '#ffffff', true);
            for (let k = 0; k < 3; k++) a.px(mx - 1 + k * 2, my - 4 - k, '#ff8d3a');
          } })),
        /* Death in two beats: the knees buckle, then the chassis is on its
           side with the head snapped off and sparks arcing out of the neck.
           Sparks follow a parabola — evenly spaced dots read as string. */
        D('down', 8, false, seq(4, 8, (a, i) => {
          if (i === 0) {
            at(a, 18, 0, 3, true);
            for (let k = 0; k < 4; k++) a.px(20 + k, 8 - k, k % 2 ? '#ffd24a' : '#ff8d3a');
            return;
          }
          const f = i - 1, bx = 10 - f, by = 18 + f;
          a.rect(bx, by, bx + 12, 26, bodyD);
          a.rect(bx, by, bx + 12, by + 1, body);
          a.rect(bx + 2, by + 3, bx + 10, by + 4, '#252d3a');      // vent, now sideways
          a.rect(bx + 13, by + 1, bx + 16, by + 3, joint);         // legs jutting out
          a.rect(bx + 13, by + 5, bx + 16, by + 7, joint);
          a.rect(bx - 6, 21 + f, bx - 1, 26, joint);               // snapped-off head
          a.rect(bx - 6, 21 + f, bx - 1, 21 + f, bodyL);
          a.rect(bx - 5, 23 + f, bx - 2, 23 + f, f > 1 ? '#5a2020' : eye);
          for (let k = 0; k < 5 - f; k++) {
            const tt = (k + 1) / 5;
            a.px(bx + tt * 7, by - tt * 9 + tt * tt * 12 + f, k % 2 ? '#ffd24a' : '#ff8d3a');
          }
          speck(a, 3, 25, 28, 27, 13, ['#4a5568', '#252d3a'], 0.6);
        }))
      ]
    };
  }

  /* ============================================================== DRONE ===
     Tagged 'flying'. Reads from the rotor blur + the beam cone. */
  function droneSuite() {
    const hull = '#6d7d92', hullL = '#c0cbdc', hullD = '#3d4a5c', glow = '#2ce8f5';
    const at = (a, cy, spin, beam, alert) => {
      /* Arms, motor pods and blades, in that order. Drawing the blade as one
         line across the whole sprite (the obvious shortcut) reads as a single
         plank; two separate discs on stalks is what says "rotor". */
      for (const s of [-1, 1]) {
        const px = 16 + s * 10;
        a.line(16 + s * 4, cy + 1, px, cy - 2, hullD, 2);
        a.rect(px - 2, cy - 4, px + 2, cy - 1, hull);
        a.rect(px - 2, cy - 4, px + 2, cy - 4, hullL);
        a.rect(px - 1, cy - 3, px + 1, cy - 2, '#252d3a');
        /* Blade blur as a flattened ring around the hub, and the sweep
           alternates so consecutive frames never match. A straight 1px line
           laid over a motor box reads as a shelf, not as a rotor. */
        const ph = (spin + (s > 0 ? 0 : 2)) % 4, w = [5, 3, 5, 3][ph], c = ph % 2 ? '#8b9bb4' : '#d6dfec';
        a.ellipse(px - w, cy - 7, px + w, cy - 5, c, false);
        a.rect(px - 1, cy - 6, px + 1, cy - 6, hullL);
        a.px(px, cy - 6, '#ffffff');
      }
      blob(a, 16, cy + 1, 6, 4, hull, hullL, hullD);
      a.rect(10, cy + 2, 22, cy + 3, hullD);
      a.ellipse(12, cy - 1, 20, cy + 4, '#17456d', true);
      a.rect(13, cy, 19, cy + 2, alert ? '#ff4d4d' : glow);
      a.rect(13, cy, 15, cy, alert ? '#ffb0b0' : '#9ff2fb');
      a.rect(15, cy + 5, 17, cy + 6, hullD);
      /* Scan cone: dithered, not banded. Solid horizontal stripes across the
         cone read as the rungs of a ladder rather than as light. */
      if (beam) for (let y = cy + 7; y < 30; y++) {
        const d = y - cy - 6, w = Math.round(d * 0.6), core = Math.max(0, 3 - Math.floor(d / 3));
        for (let x = 16 - w; x <= 16 + w; x++) {
          const near = Math.abs(x - 16) <= core;
          if (near) a.px(x, y, '#9ff2fb');
          else if ((x + y + beam) % 2 === 0 || Math.abs(x - 16) === w) a.px(x, y, '#2aa6c8');
        }
      }
    };
    return {
      width: 32, height: 32, name: 'Hover Drone', layers: [{ name: 'drone' }],
      states: [
        D('hover', 12, true, cyc(4, 12, (a, i) => at(a, 13 + [0, 1, 2, 1][i], i, 0, false))),
        D('scan', 10, true, cyc(4, 10, (a, i) => at(a, 12 + (i % 2), i, i + 1, false))),
        D('alert', 12, true, cyc(4, 12, (a, i) => { at(a, 12 + [0, 1, 0, 2][i], i, 0, i % 2 === 0);
          if (i % 2 === 0) for (let k = 0; k < 6; k++) { const ang = (k / 6) * TAU; a.px(16 + Math.cos(ang) * 11, 14 + Math.sin(ang) * 9, '#ff4d4d'); } })),
        D('down', 9, false, seq(4, 9, (a, i, t) => {
          const cyd = 13 + i * 3;
          at(a, cyd, i, 0, true);
          /* Sparks cluster around the failing rotors. Evenly spaced dots
             stepping diagonally across the sprite read as a guide line. */
          for (let k = 0; k < 5; k++) {
            const x = 8 + Math.round(a.hash(k, i + 3, 5) * 16);
            const y = Math.max(1, cyd - 9 + Math.round(a.hash(k, i + 7, 5) * 5));
            a.px(x, y, k % 2 ? '#ffd24a' : '#ff8d3a');
          }
          if (i > 1) speck(a, 6, 22, 26, 27, 9, ['#3d4a5c', '#ff8d3a'], 0.5);
        }))
      ]
    };
  }

  /* ============================================================= TURRET ===
     Floor-mounted, traverses and fires. The barrel recoil is 2px — any less
     and the shot has no weight, any more and it leaves the mount. */
  function turretSuite() {
    const base = '#4a5568', baseL = '#8b9bb4', barrel = '#3d4a5c', hot = '#ff8d3a';
    const at = (a, ang, recoil, charge) => {
      a.ellipse(6, 22, 26, 27, base, true);
      a.ellipse(7, 22, 25, 24, baseL, true);
      a.rect(9, 18, 23, 23, base);
      a.rect(9, 18, 23, 18, baseL);
      panelLines(a, 10, 19, 22, 22, '#252d3a', 2);
      blob(a, 16, 16, 6, 5, baseL, '#c9d4e0', base);
      a.rect(11, 15, 21, 16, base);
      const bx = 16 + Math.cos(ang) * (2 - recoil), by = 16 + Math.sin(ang) * (2 - recoil);
      for (const s of [-1, 1]) {
        const ox = s * 2 * Math.sin(ang), oy = -s * 2 * Math.cos(ang);
        a.line(bx + ox, by + oy, bx + ox + Math.cos(ang) * 11, by + oy + Math.sin(ang) * 11, barrel, 3);
        a.line(bx + ox, by + oy, bx + ox + Math.cos(ang) * 11, by + oy + Math.sin(ang) * 11, baseL, 1);
      }
      /* A round blob at the muzzle reads as a balloon on a stick. A flare
         with spikes along and across the bore reads as a discharge. */
      if (charge) {
        const tx = bx + Math.cos(ang) * 12, ty = by + Math.sin(ang) * 12;
        const nx = -Math.sin(ang), ny = Math.cos(ang);
        a.line(tx - Math.cos(ang) * charge, ty - Math.sin(ang) * charge,
          tx + Math.cos(ang) * charge * 1.6, ty + Math.sin(ang) * charge * 1.6, '#fff6c9', 2);
        a.line(tx - nx * charge, ty - ny * charge, tx + nx * charge, ty + ny * charge, hot, 1);
        a.px(tx, ty, '#ffffff');
        for (let k = 0; k < 3; k++) {
          const sp = charge + 2 + k * 2;
          a.px(tx + Math.cos(ang + 0.5) * sp, ty + Math.sin(ang + 0.5) * sp, '#ffd24a');
          a.px(tx + Math.cos(ang - 0.5) * sp, ty + Math.sin(ang - 0.5) * sp, '#ff8d3a');
        }
      }
      a.rect(14, 13, 17, 14, '#252d3a');
      a.px(14, 13, charge ? '#ff4d4d' : '#2ce8f5');
    };
    return {
      width: 32, height: 32, name: 'Wall Turret', layers: [{ name: 'turret' }],
      states: [
        D('idle', 4, true, cyc(4, 4, (a, i) => at(a, -0.5 + [0, 0.12, 0, -0.12][i], 0, 0))),
        D('track', 8, true, cyc(6, 8, (a, i) => at(a, -1.5 + (i / 6) * 1.4, 0, 0))),
        D('fire', 14, false, seq(4, 14, (a, i) => { at(a, -0.5, [0, 2, 1, 0][i], [1, 4, 2, 0][i]);
          if (i === 1) for (let k = 0; k < 6; k++) a.px(24 + k, 10 - k, '#ffd24a'); })),
        D('down', 8, false, seq(3, 8, (a, i) => { at(a, -0.2 + i * 0.5, 0, 0);
          for (let k = 0; k < 5 - i; k++) a.px(10 + k * 3, 10 + k + i * 2, k % 2 ? '#ff8d3a' : '#ffd24a');
          speck(a, 8, 14, 24, 22, 17 + i, ['#252d3a'], 0.12 + i * 0.1); }))
      ]
    };
  }

  /* ================================================================ MECH ===
     A 32px piloted walker: wide stance, heavy shoulders, a cockpit canopy
     high enough to read as "someone is in there". */
  function mechSuite() {
    const hull = '#7a8aa6', hullL = '#b4c1d6', hullD = '#404d68', dark = '#252d3a';
    const glass = '#2ce8f5', accent = '#f6a03a';
    /* Feet are anchored at y25..27 and the *thigh* stretches, rather than the
       whole rig sliding down: that is what keeps a heavy walker planted
       instead of bouncing like a beach ball. */
    const leg = (a, cy, s, lift) => {
      const hx = 16 + s * 7, fy = 25 - lift, main = s > 0 ? hull : hullD, sh = s > 0 ? hullD : dark;
      a.rect(hx - 3, cy + 2, hx + 2, fy - 4, main);
      a.rect(hx - 3, cy + 2, hx - 3, fy - 4, s > 0 ? hullL : hull);
      a.rect(hx - 3, fy - 4, hx + 2, fy - 4, sh);                     // knee joint
      a.rect(hx - 2, fy - 3, hx + 1, fy - 1, sh);
      a.rect(hx - 4, fy, hx + 3, fy + 2, main);
      a.rect(hx - 4, fy, hx + 3, fy, hullL);
      a.rect(hx - 4, fy + 2, hx + 3, fy + 2, dark);
    };
    const at = (a, cy, lift, fire) => {
      leg(a, cy, -1, lift > 0 ? lift : 0);
      leg(a, cy, 1, lift < 0 ? -lift : 0);
      a.rect(10, cy + 1, 22, cy + 4, hullD);                          // pelvis
      a.rect(11, cy + 2, 21, cy + 3, dark);
      a.rect(9, cy - 6, 23, cy + 2, hull);                            // torso
      a.rect(9, cy - 6, 23, cy - 5, hullL);
      a.rect(9, cy + 1, 23, cy + 2, hullD);
      panelLines(a, 17, cy - 4, 22, cy, hullD, 3);
      // canopy: small, upper-left, with a visible occupant. A big glass oval
      // takes over the whole silhouette and stops reading as a cockpit.
      a.rect(10, cy - 4, 16, cy, '#132844');
      a.rect(11, cy - 4, 15, cy - 1, glass);
      a.rect(11, cy - 4, 13, cy - 3, '#bdf6fb');
      a.rect(14, cy - 2, 15, cy - 1, dark);                           // pilot silhouette
      a.rect(10, cy, 16, cy, hullD);
      // shoulders: missile rack left, autocannon right
      a.rect(5, cy - 9, 11, cy - 4, hullD);
      a.rect(5, cy - 9, 11, cy - 9, hull);
      for (let r = 0; r < 2; r++) for (let c = 0; c < 3; c++) a.px(6 + c * 2, cy - 8 + r * 2, dark);
      a.rect(20, cy - 9, 27, cy - 4, hull);
      a.rect(20, cy - 9, 27, cy - 9, hullL);
      a.rect(21, cy - 8, 26, cy - 7, accent);                         // hazard flash
      a.rect(27, cy - 8, 30, cy - 6, dark);                           // barrel
      a.rect(27, cy - 8, 30, cy - 8, hullD);
      // sensor head between the shoulders
      a.rect(13, cy - 9, 19, cy - 6, hullD);
      a.rect(13, cy - 9, 19, cy - 9, hull);
      a.rect(14, cy - 8, 18, cy - 7, dark);
      a.rect(15, cy - 8, 17, cy - 8, '#ff4d4d');
      if (fire) {
        const r = fire > 1 ? 4 : 2, mx = 31, my = cy - 7;
        a.line(mx - r, my, mx + 1, my, '#fff6c9', 2);
        a.line(mx, my - r, mx, my + r, accent, 1);
        for (let k = 0; k < 3; k++) a.px(mx - 2 - k * 2, my - 2 - k, '#ff8d3a');
      }
    };
    return {
      width: 32, height: 32, name: 'Assault Mech', layers: [{ name: 'mech' }],
      states: [
        D('idle', 4, true, cyc(4, 4, (a, i) => at(a, 14 - [0, 1, 2, 1][i], 0, 0))),
        D('walk', 8, true, cyc(4, 8, (a, i) => at(a, 14 - (i % 2), [2, 0, -2, 0][i], 0))),
        D('fire', 12, false, seq(3, 12, (a, i) => at(a, 14 + (i === 1 ? 1 : 0), 0, [1, 2, 0][i]))),
        /* Wreck: the torso drops between its own collapsed legs and the
           cockpit glass cracks. Sparks arc; a straight dotted diagonal reads
           as a wire, not as debris. */
        D('down', 7, false, seq(4, 7, (a, i) => {
          const y = 17 + i * 2;
          a.rect(4 + i, 24, 14 + i, 27, hullD);                       // splayed feet
          a.rect(18 - i, 24, 28 - i, 27, hullD);
          a.rect(6, 22, 26, 25, dark);
          a.rect(7, y, 25, 26, hull);
          a.rect(7, y, 25, y + 1, hullL);
          a.rect(9, y + 3, 15, y + 6, '#132844');
          a.rect(10, y + 3, 14, y + 5, i > 2 ? '#1c6a78' : glass);
          a.line(10, y + 3, 14, y + 5, dark, 1);                      // crack
          a.rect(19, y + 2, 25, y + 3, accent);
          for (let k = 0; k < 6 - i; k++) {
            const tt = (k + 1) / 6;
            a.px(12 + tt * 12, y - tt * 12 + tt * tt * 16, k % 2 ? '#ffd24a' : '#ff8d3a');
          }
          speck(a, 3, 25, 29, 27, 23, ['#404d68', '#ff8d3a'], 0.4 + i * 0.16);
        }))
      ]
    };
  }

  /* ============================================================== PROPS ===
     Station furniture: console, crate, barrel, terminal, airlock, lamp,
     capsule and a repair bench. All flush to y27. */
  function propSuite() {
    const hull = '#6d7d92', hullL = '#c0cbdc', hullD = '#3d4a5c', glow = '#2ce8f5';
    return {
      width: 32, height: 32, name: 'Station Props', layers: [{ name: 'prop' }],
      states: [
        D('console', 6, true, cyc(4, 6, (a, i) => {
          a.rect(4, 14, 27, 27, hullD);
          a.rect(4, 14, 27, 15, hullL);
          a.rect(6, 16, 25, 22, '#101828');
          for (let r = 0; r < 3; r++) for (let c = 0; c < 6; c++) {
            const on = (a.hash(c, r, 3) * 4 + i) % 4 < 2;
            a.rect(7 + c * 3, 17 + r * 2, 8 + c * 3, 17 + r * 2, on ? glow : '#1d3a52');
          }
          a.rect(6, 23, 25, 26, hull);
          for (let x = 7; x < 25; x += 3) a.rect(x, 24, x + 1, 25, hullD);
          led(a, 25, 17, i % 2 === 0, '#3fc46a');
        })),
        /* A supply crate needs a lid line, corner brackets and a lit top
           face — a flat rectangle with a decal on it reads as a wall panel. */
        D('crate', 1, false, still(a => {
          a.rect(5, 9, 26, 27, hull);
          a.rect(5, 9, 26, 10, hullL);                       // lid top face
          a.rect(5, 11, 26, 12, hullD);                      // lid seam
          a.rect(5, 26, 26, 27, '#252d3a');
          for (let y = 14; y < 26; y += 4) a.rect(6, y, 25, y, hullD);
          for (const [x, y] of [[5, 9], [22, 9], [5, 22], [22, 22]]) {
            a.rect(x, y, x + 4, y + 5, hullD);
            a.rect(x, y, x + 4, y, hullL);
            a.px(x + 1, y + 2, hullL); a.px(x + 3, y + 2, hullL);
          }
          a.rect(12, 15, 19, 22, '#b06a12');
          a.rect(13, 16, 18, 21, '#f6a03a');
          a.rect(14, 17, 17, 20, '#252d3a');
          a.rect(15, 18, 16, 19, '#f6a03a');
        })),
        /* Drum, not a dome. The first cut capped the body with an ellipse
           NARROWER than the body and rounded the base off with another, so
           the silhouette tapered at both ends and the wide dark fluid window
           in the middle read as a visor — the prop looked like a crash
           helmet. A barrel reads from an overhanging top rim, dead-straight
           sides shaded as a cylinder, and a base flange. */
        D('barrel', 6, true, cyc(4, 6, (a, i) => {
          for (let x = 9; x <= 22; x++) {
            a.rect(x, 9, x, 26, x < 11 ? '#4a5568' : x < 14 ? hullL : x < 19 ? hull : x < 21 ? hullD : '#252d3a');
          }
          a.rect(7, 6, 24, 8, hullD); a.rect(7, 6, 24, 6, hullL);   // rim overhangs the body
          a.rect(13, 4, 18, 5, hullD); a.rect(13, 4, 18, 4, hull);  // filler bung
          a.rect(8, 12, 23, 13, hullD); a.rect(8, 12, 23, 12, hull);  // hoops
          a.rect(8, 21, 23, 22, hullD); a.rect(8, 21, 23, 21, hull);
          a.rect(7, 25, 24, 27, hullD); a.rect(7, 25, 24, 25, hull);  // base flange
          /* Sight glass is tall and narrow on purpose: a letterbox window
             across the full width of the drum is a visor. */
          a.rect(13, 14, 18, 20, '#101828');
          const lvl = 20 - ((i + 1) % 4);
          a.rect(13, lvl, 18, 20, '#3fc46a');
          a.rect(13, lvl, 18, lvl, '#a4f2b8');
          a.px(13, 15, '#1d3a52');
          /* Recessed socket, not a bare led(): three loose pixels on a curved
             shell read as a smear of paint, and the off frame vanishes. */
          a.rect(19, 9, 21, 11, '#252d3a');
          a.px(20, 10, i % 2 === 0 ? '#3fc46a' : '#1d3a52');
        })),
        D('terminal', 8, true, cyc(4, 8, (a, i) => {
          a.rect(8, 4, 23, 24, hullD);
          a.rect(8, 4, 23, 5, hullL);
          a.rect(10, 7, 21, 19, '#101828');
          for (let r = 0; r < 5; r++) {
            const w = 3 + Math.floor(a.hash(r, i, 5) * 8);
            a.rect(11, 9 + r * 2, 11 + w, 9 + r * 2, r === (i % 5) ? '#a4f2b8' : glow);
          }
          a.rect(11, 20, 20, 22, hull);
          a.rect(12, 25, 19, 27, hullD);
          a.rect(6, 24, 25, 25, hull);
          led(a, 22, 6, i % 2 === 0, '#ff4d4d');
        })),
        D('airlock', 8, false, seq(4, 8, (a, i, t) => {
          a.rect(3, 2, 28, 27, hullD);
          a.rect(5, 4, 26, 27, '#101828');
          for (let y = 6; y < 27; y += 3) a.rect(6, y, 25, y, '#1d2436');
          const open = Math.round(t * 11);
          a.rect(5, 4, 15 - open, 27, hull); a.rect(16 + open, 4, 26, 27, hull);
          a.rect(5, 4, 15 - open, 5, hullL); a.rect(16 + open, 4, 26, 5, hullL);
          a.rect(14 - open, 4, 15 - open, 27, hullD); a.rect(16 + open, 4, 17 + open, 27, hullD);
          /* Clamp the hazard chevrons to the door leaf. rect() normalises its
             corners, so once the leaf slides past them an unguarded rect
             flips and paints the stripe across the open doorway instead. */
          for (let y = 8; y < 26; y += 5) {
            if (12 - open >= 8) a.rect(8, y, 12 - open, y + 1, '#f6a03a');
            if (19 + open <= 23) a.rect(19 + open, y, 23, y + 1, '#f6a03a');
          }
          a.rectO(3, 2, 28, 27, hullL);
          led(a, 5, 3, i % 2 === 0, i < 2 ? '#ff4d4d' : '#3fc46a');
        })),
        /* A flickering strip light. Brightness comes off an explicit table
           because any modulo pattern on four frames repeats a frame exactly,
           and the quality gate (rightly) calls that a static frame. */
        D('lamp', 6, true, cyc(4, 6, (a, i) => {
          const lit = [1, 0.55, 1, 0.2][i];
          a.rect(14, 2, 17, 8, hullD);
          a.rect(6, 8, 25, 12, hull);
          a.rect(6, 8, 25, 8, hullL);
          a.rect(7, 12, 24, 13, lit > 0.8 ? '#fff6c9' : lit > 0.4 ? '#d8cf9a' : '#7a8ea8');
          const reach = Math.round(14 * lit);
          for (let y = 14; y < 14 + reach; y++) {
            const w = Math.round((y - 12) * 0.75);
            a.line(16 - w, y, 16 + w, y, (y % 2) ? '#2a3550' : '#33415f', 1);
          }
        })),
        D('capsule', 6, true, cyc(4, 6, (a, i) => {
          a.ellipse(8, 2, 23, 27, hullD, true);
          a.ellipse(9, 4, 22, 26, '#101828', true);
          a.ellipse(10, 5, 21, 25, '#17456d', true);
          a.ellipse(11, 7, 20, 24, '#1d6a9a', true);
          blob(a, 16, 12, 3, 3, '#e8b796', '#f2c094', '#c28569');   // occupant
          a.rect(13, 15, 19, 22, '#4a5a44');
          for (let k = 0; k < 4; k++) { const y = 24 - ((i + k * 2) % 8) * 2.4; a.px(12 + k * 3, y, '#9ad8ff'); }
          a.rect(6, 25, 25, 27, hull);
          a.rect(6, 25, 25, 25, hullL);
          led(a, 22, 26, i % 2 === 0, glow);
        })),
        D('bench', 1, false, still(a => {
          a.rect(2, 14, 29, 17, hull);
          a.rect(2, 14, 29, 14, hullL); a.rect(2, 17, 29, 17, '#252d3a');
          a.rect(3, 18, 6, 27, hullD); a.rect(25, 18, 28, 27, hullD);
          a.rect(3, 18, 3, 27, hull); a.rect(25, 18, 25, 27, hull);
          a.rect(7, 20, 24, 23, '#252d3a');                             // tool drawer
          for (let x = 8; x < 24; x += 4) { a.rect(x, 21, x + 2, 22, hullD); a.rect(x, 21, x + 2, 21, hullL); }
          // bench-top kit: a parts bin, a clamped panel and a laid-down spanner
          a.rect(4, 10, 9, 13, '#b06a12'); a.rect(4, 10, 9, 10, '#f6a03a');
          a.rect(5, 11, 8, 12, '#252d3a'); a.px(6, 11, '#f6a03a');
          a.rect(12, 8, 20, 13, '#3d4a5c'); a.rect(12, 8, 20, 8, hullL);
          a.rect(13, 10, 19, 11, '#2ce8f5'); a.px(13, 10, '#bdf6fb');
          a.rect(22, 12, 28, 13, '#c0cbdc'); a.rect(22, 12, 28, 12, '#e4eaf2');
          a.rect(21, 11, 23, 14, '#c0cbdc'); a.rect(22, 12, 22, 13, '#252d3a');
        }))
      ]
    };
  }

  /* ============================================================= TILESET ===
     16 station tiles on 64x64: floor plate, grate, hazard stripe, vent;
     wall face, wall trim, pipe run, panel; circuit floor, glass, catwalk,
     rivet plate; plus conduit, screen bank, hull dent and a starfield window. */
  function tilesetSuite() {
    const cell = (api, cx, cy) => P().offsetApi(api, cx * 16, cy * 16);
    const F = '#46516a', FL = '#66748f', FD = '#2c3446', ACC = '#f6a03a', CY = '#2ce8f5';
    const paint = a => {
      const plate = cell(a, 0, 0);
      plate.rect(0, 0, 15, 15, F); speck(plate, 0, 0, 15, 15, 5, [FD, FL], 0.2);
      plate.rectO(0, 0, 15, 15, FD); plate.rect(0, 0, 15, 0, FL);
      for (const [x, y] of [[2, 2], [13, 2], [2, 13], [13, 13]]) { plate.px(x, y, FL); plate.px(x, y + 1, FD); }

      const grate = cell(a, 1, 0);
      grate.rect(0, 0, 15, 15, FD);
      for (let y = 1; y < 15; y += 3) { grate.rect(1, y, 14, y + 1, F); grate.rect(1, y, 14, y, FL); }
      grate.rect(0, 0, 0, 15, F); grate.rect(15, 0, 15, 15, F);

      /* Hazard chevrons are plotted per pixel, not with line(). offsetApi
         translates but does not clip to the cell, so a diagonal that starts
         at a negative x spills into whatever tile sits to the left. */
      const haz = cell(a, 2, 0);
      haz.rect(0, 0, 15, 15, F);
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++)
        haz.px(x, y, (x + y) % 8 < 4 ? ACC : '#2b2f3f');
      haz.rect(0, 0, 15, 2, '#252d3a'); haz.rect(0, 13, 15, 15, '#252d3a');
      haz.rect(0, 2, 15, 2, '#5b6785'); haz.rect(0, 13, 15, 13, '#20263a');
      speck(haz, 0, 3, 15, 12, 7, ['#b06a12'], 0.16);

      const vent = cell(a, 3, 0);
      vent.rect(0, 0, 15, 15, F); vent.rectO(0, 0, 15, 15, FD);
      vent.rect(2, 2, 13, 13, '#161c2a');
      for (let y = 3; y < 13; y += 2) vent.rect(3, y, 12, y, FL);
      vent.rect(2, 2, 13, 2, FD);

      const wall = cell(a, 0, 1);
      wall.rect(0, 0, 15, 15, '#39425a'); speck(wall, 0, 0, 15, 15, 11, ['#2c3446', '#4d5874'], 0.24);
      wall.rect(0, 0, 15, 1, '#5b6785'); wall.rect(0, 14, 15, 15, '#20263a');
      wall.rect(7, 0, 8, 15, '#2c3446');

      const trim = cell(a, 1, 1);
      trim.rect(0, 0, 15, 15, '#39425a');
      trim.rect(0, 4, 15, 7, F); trim.rect(0, 4, 15, 4, FL); trim.rect(0, 7, 15, 7, FD);
      trim.rect(0, 9, 15, 10, CY); trim.rect(0, 9, 15, 9, '#9ff2fb');
      speck(trim, 0, 11, 15, 15, 13, ['#2c3446'], 0.24);

      const pipe = cell(a, 2, 1);
      pipe.rect(0, 0, 15, 15, '#39425a');
      for (const y of [3, 9]) { pipe.rect(0, y, 15, y + 3, '#7a8299'); pipe.rect(0, y, 15, y, '#b9c2d4'); pipe.rect(0, y + 3, 15, y + 3, '#474e61'); }
      pipe.rect(5, 2, 7, 7, '#5a6273'); pipe.rect(11, 8, 13, 13, '#5a6273');

      const panel = cell(a, 3, 1);
      panel.rect(0, 0, 15, 15, '#39425a');
      panel.rect(2, 2, 13, 13, F); panel.rect(2, 2, 13, 2, FL); panel.rect(2, 13, 13, 13, FD);
      panel.rect(4, 5, 11, 10, '#161c2a');
      for (let r = 0; r < 3; r++) panel.rect(5, 6 + r * 2, 5 + r * 3, 6 + r * 2, CY);
      panel.px(11, 4, '#3fc46a');

      const circ = cell(a, 0, 2);
      circ.rect(0, 0, 15, 15, '#16243a');
      for (let k = 0; k < 6; k++) {
        // traces are clamped inside the cell: offsetApi does not clip, so an
        // overhanging trace lands in the neighbouring tile
        const x = 1 + Math.floor(circ.hash(k, 1, 3) * 9), y = 1 + Math.floor(circ.hash(k, 2, 3) * 10);
        circ.line(x, y, x + 5, y, '#1d6a9a', 1); circ.line(x + 5, y, x + 5, y + 4, '#1d6a9a', 1);
        circ.px(x, y, CY); circ.px(x + 5, y + 4, CY);
      }
      speck(circ, 0, 0, 15, 15, 19, ['#1d3a52'], 0.28);

      const glass = cell(a, 1, 2);
      glass.rect(0, 0, 15, 15, '#16293c');
      glass.rect(1, 1, 14, 14, '#1f4a6b');
      // reflections stay inside the pane: a line from x=2 to x=20 would run on
      // into the next tile, and the highlight ramp is kept narrow so the glass
      // sits in the same value range as the rest of the sheet
      for (let k = 0; k < 4; k++) for (let d = 0; d < 11; d++) {
        const x = 2 + k * 4 + Math.floor(d * 0.5), y = 13 - d;
        if (x <= 14 && y >= 1) glass.px(x, y, d % 3 ? '#2f74a4' : '#56a8d6');
      }
      glass.rectO(0, 0, 15, 15, F); glass.rect(0, 0, 15, 0, FL);

      const cat = cell(a, 2, 2);
      cat.rect(0, 5, 15, 11, FD);
      for (let x = 0; x < 16; x += 3) cat.rect(x, 5, x + 1, 11, F);
      cat.rect(0, 5, 15, 5, FL); cat.rect(0, 11, 15, 11, '#20263a');
      cat.rect(0, 2, 15, 3, '#7a8299'); cat.rect(2, 3, 3, 5, '#7a8299'); cat.rect(12, 3, 13, 5, '#7a8299');

      const rivet = cell(a, 3, 2);
      rivet.rect(0, 0, 15, 15, '#4d5874');
      rivet.rectO(0, 0, 15, 15, '#2c3446');
      for (let y = 2; y < 15; y += 6) for (let x = 2; x < 15; x += 6) { rivet.px(x, y, '#9aa5bd'); rivet.px(x, y + 1, '#2c3446'); }
      rivet.rect(0, 7, 15, 8, '#39425a');

      const cond = cell(a, 0, 3);
      cond.rect(0, 0, 15, 15, '#20263a');
      cond.rect(6, 0, 9, 15, '#474e61'); cond.rect(6, 0, 6, 15, '#7a8299');
      for (let y = 1; y < 16; y += 4) { cond.rect(5, y, 10, y + 1, '#5a6273'); cond.px(5, y, '#b9c2d4'); }
      cond.rect(7, 2, 8, 4, CY); cond.rect(7, 10, 8, 12, CY);

      const scr = cell(a, 1, 3);
      scr.rect(0, 0, 15, 15, '#2c3446');
      for (let r = 0; r < 2; r++) for (let c = 0; c < 2; c++) {
        scr.rect(1 + c * 7, 1 + r * 7, 6 + c * 7, 6 + r * 7, '#101828');
        scr.rect(1 + c * 7, 1 + r * 7, 6 + c * 7, 1 + r * 7, FL);
        for (let k = 0; k < 3; k++) scr.rect(2 + c * 7, 3 + r * 7 + k, 2 + c * 7 + (k + r + c) % 4, 3 + r * 7 + k, (r + c) % 2 ? '#3fc46a' : CY);
      }

      const dent = cell(a, 2, 3);
      dent.rect(0, 0, 15, 15, '#39425a'); speck(dent, 0, 0, 15, 15, 23, ['#2c3446', '#4d5874'], 0.32);
      dent.ellipse(3, 4, 12, 12, '#242b3d', true);
      dent.ellipse(4, 5, 10, 10, '#2c3446', true);
      dent.line(3, 4, 10, 12, '#161c2a', 1); dent.line(12, 5, 5, 11, '#161c2a', 1);

      const win = cell(a, 3, 3);
      win.rect(0, 0, 15, 15, '#0a0e1c');
      for (let k = 0; k < 16; k++) { const x = Math.floor(win.hash(k, 4, 9) * 14) + 1, y = Math.floor(win.hash(k, 5, 9) * 14) + 1;
        win.px(x, y, k % 4 ? '#c0cbdc' : '#9ad8ff'); }
      win.ellipse(9, 3, 13, 7, '#4e9ed6', true); win.ellipse(10, 4, 12, 6, '#9ad8ff', true);
      win.rectO(0, 0, 15, 15, F); win.rect(0, 0, 15, 0, FL);
    };
    return {
      width: 64, height: 64, name: 'Station Tileset', layers: [{ name: 'tiles' }],
      states: [D('tiles', 1, false, still(paint))]
    };
  }

  return { astronautSuite, marineSuite, engineerSuite, robotSuite, droneSuite, turretSuite, mechSuite, propSuite, tilesetSuite };
})();
