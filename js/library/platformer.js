/* PixelForge Studio — Platformer pack.
   Everything a side-scroller needs on day one: a pure side-view hero rig with
   the full run/jump/fall/land/attack/hurt loop, three foes that read at a
   glance from their silhouette alone, collectables, interactables and a
   64x64 terrain sheet that autotiles.

   Side view is a different rig from the 3/4 RPG packs: the head is a profile,
   the far arm and leg are drawn a shade darker so the pose reads in one
   colour-blind glance, and the feet sit on y25..27 like every other pack so
   hero and monster can share a floor. Pure maths, deterministic, no assets. */
window.PF = window.PF || {};
PF.Platformer = (() => {
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
  const still = painter => [Fr(200, draw(painter))];
  /* seq() spreads t across 0..1 inclusive, which is right for a one-shot but
     wrong for a loop: t=0 and t=1 land on the same point of any sine and the
     gate (correctly) calls the last frame a hitch. cyc() stops one step short. */
  const cyc = (n, fps, make) => Array.from({ length: n }, (_, i) =>
    Fr(ms(fps), draw((a, W, H) => make(a, i, i / n, W, H))));
  const TAU = Math.PI * 2;

  /* ---------------------------------------------------------------- shared */
  // Local volume helpers: packs never depend on Pixel.prototype conveniences,
  // so the old-vs-new API bench can swap makeApi without breaking the art.
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

  /* ================================================================ HERO ===
     One rig, six states. Everything is driven by (hipY, lean, armA, legA) so a
     new state is a pose description, not another 40 lines of rectangles. */
  const HERO = {
    skin: '#f2c094', skinSh: '#c28569', hair: '#c04a2a', hairHi: '#e8734a',
    shirt: '#2a6fa8', shirtSh: '#17456d', shirtHi: '#4e9ed6',
    pants: '#3a3a5c', pantsSh: '#252540', boot: '#6b3f2a', bootSh: '#432618',
    scarf: '#e8c547', scarfSh: '#b08d1e', glove: '#c9563a'
  };

  /* legs(a, hipX, hipY, phase, pal, far) — one leg from a phase angle.
     The knee is placed on the arc rather than interpolated, which is what
     keeps a 4-frame run from looking like scissors. */
  function leg(a, hx, hy, ang, pal, far) {
    const c = far ? pal.pantsSh : pal.pants, bc = far ? pal.bootSh : pal.boot;
    const kx = hx + Math.cos(ang) * 3, ky = hy + 3 + Math.abs(Math.sin(ang)) * 0.6;
    const fx = kx + Math.cos(ang * 0.55 + 1.35) * 3, fy = Math.min(26, ky + 3.2);
    a.line(hx, hy, kx, ky, c, 3);
    a.line(kx, ky, fx, fy, c, 2);
    a.rect(fx - 1, fy, fx + 2, fy + 1, bc);          // boot
    a.px(fx + 2, fy + 1, far ? pal.bootSh : pal.bootSh);
  }
  /* Arms hang from the shoulder *point*, not the torso centre. With a 7px
     torso the shoulder sits at cx±4, which is the only way a 2px limb stays
     outside the body silhouette instead of vanishing into it. */
  function arm(a, sx, sy, ang, pal, far, hand) {
    const c = far ? pal.shirtSh : pal.shirt, g = far ? '#8d3c28' : pal.glove;
    const ex = sx + Math.cos(ang) * 3.2, ey = sy + Math.sin(ang) * 3.2;
    const hx = ex + Math.cos(ang + 0.45) * 3, hy = ey + Math.sin(ang + 0.45) * 3;
    a.line(sx, sy, ex, ey, c, 3);
    a.line(ex, ey, hx, hy, far ? pal.skinSh : pal.skin, 2);
    a.rect(hx - 1, hy - 1, hx + 1, hy + 1, g);
    if (hand) hand(a, hx, hy);
  }
  /* Profile head. faceX = +1 looks right. Kept at y>=4 so the outline pass
     always has a row above it — a head touching row 0 reads as decapitated. */
  function head(a, cx, cy, pal, faceX, eye) {
    blob(a, cx, cy, 4, 4, pal.skin, null, pal.skinSh);
    a.rect(cx - 4, cy - 5, cx + 4, cy - 2, pal.hair);        // hair cap
    a.rect(cx - 4, cy - 5, cx + 1, cy - 4, pal.hairHi);
    a.px(cx - 4 * faceX, cy - 1, pal.hair); a.px(cx - 4 * faceX, cy, pal.hair);   // back of head
    a.rect(cx + 1 * faceX, cy + 2, cx + 3 * faceX, cy + 3, pal.skinSh);           // jaw shade
    const ex = cx + 2 * faceX;
    if (eye === 'shut') a.line(ex - 1, cy, ex, cy, OUT, 1);
    else if (eye === 'hurt') { a.px(ex - 1, cy - 1, OUT); a.px(ex, cy, OUT); a.px(ex, cy - 1, OUT); a.px(ex - 1, cy, OUT); }
    else { a.rect(ex - 1, cy - 1, ex, cy, OUT); a.px(ex - 1, cy - 1, '#ffffff'); }
    a.px(cx + 4 * faceX, cy + 1, pal.skinSh);                                     // nose notch
  }
  function torso(a, cx, y0, pal, lean) {
    const s = Math.round(lean);
    blob(a, cx + s, y0 + 4, 3, 5, pal.shirt, pal.shirtHi, pal.shirtSh);
    a.rect(cx - 3 + s, y0 + 7, cx + 3 + s, y0 + 8, pal.shirtSh);      // belt shadow
    a.rect(cx - 3 + s, y0, cx + 3 + s, y0 + 1, pal.scarf);            // scarf collar
    a.rect(cx - 3 + s, y0 + 1, cx + s, y0 + 1, pal.scarfSh);
  }
  /* The trailing scarf: the hero's whole read at 32px. It leaves the BACK of
     the collar (never across the jaw) and tapers from 2px to 1px, so it reads
     as cloth rather than a stick. Amplitude scales with speed — idle barely
     drifts, a fall whips. */
  function scarf(a, x, y, t, amp, pal, len = 6) {
    for (let i = 0; i < len; i++) {
      const k = i / len;
      const sy = y + Math.sin(t * TAU + k * 3.6) * (0.6 + amp * k) + k * 1.2;
      a.px(x - i, sy, k > 0.55 ? pal.scarfSh : pal.scarf);
      if (k < 0.62) a.px(x - i, sy + 1, pal.scarfSh);
    }
  }

  function heroSuite() {
    const p = HERO;
    const body = (a, t, opts) => {
      const o = opts || {};
      // The rig spans hip-20 (hair cap) to hip+7 (boot sole, clamped at y27),
      // so hip must stay >= 21 or the head clips the top of the frame.
      const hip = o.hip === undefined ? 21 : o.hip;
      const lean = o.lean || 0;
      const s = Math.round(lean);
      leg(a, 16 + lean, hip, o.legB, p, true);
      arm(a, 16 + s - 4, hip - 10, o.armB, p, true, o.handB);
      // The scarf leaves the back of the shoulder, not the jaw: two rows above
      // and it crosses the face on every frame with any lean.
      scarf(a, 12 + s, hip - 9, t, o.wind === undefined ? 0.6 : o.wind, p, o.scarfLen);
      torso(a, 16, hip - 12, p, lean);
      head(a, 16 + s + 1, hip - 15, p, 1, o.eye);
      leg(a, 16 + lean, hip, o.legA, p, false);
      arm(a, 16 + s + 4, hip - 10, o.armA, p, false, o.handA);
    };
    return {
      width: 32, height: 32, name: 'Platform Hero',
      layers: [{ name: 'hero' }],
      states: [
        // idle: a 2px breath on the torso, scarf drifting — never frozen
        D('idle', 6, true, cyc(4, 6, (a, i, t) => {
          const b = Math.round(Math.sin(t * TAU) * 0.9);
          body(a, t, { hip: 22 - b, legA: 1.62 + b * 0.05, legB: 1.52, armA: 1.45 + b * 0.12, armB: 1.6, wind: 0.8 });
        })),
        D('run', 12, true, cyc(8, 12, (a, i) => {
          const ph = (i / 8) * TAU;
          body(a, i / 8, {
            hip: 21 + (i % 2 === 0 ? 1 : 0), lean: 1.4,
            legA: 1.57 + Math.sin(ph) * 0.95, legB: 1.57 + Math.sin(ph + Math.PI) * 0.95,
            armA: 1.5 - Math.sin(ph) * 0.9, armB: 1.5 - Math.sin(ph + Math.PI) * 0.9, wind: 2.1
          });
        })),
        // jump: one rise + apex, no ground contact expected (AIRBORNE state)
        D('jump', 10, false, seq(4, 10, (a, i, t) => {
          // The engine translates a jumping sprite; the frame itself only
          // tucks the legs and throws the arms up, so nothing leaves the canvas.
          body(a, t, { hip: 22 - i * 0.3, lean: 0.6, legA: 2.6 - t * 1.1, legB: 1.05 + t * 0.55,
            armA: 4.2 + t * 0.5, armB: 3.9 - t * 0.4, wind: 2.6, scarfLen: 8 });
        })),
        D('fall', 8, true, cyc(3, 8, (a, i, t) => {
          body(a, t, { hip: 21 + i * 0.4, lean: -0.6, legA: 1.2 + i * 0.25, legB: 2.3 - i * 0.2,
            armA: 4.6, armB: 4.4 - i * 0.2, wind: 3.0, scarfLen: 9 });
        })),
        // land: a hard squash that recovers — the frame that sells weight
        D('land', 14, false, seq(3, 14, (a, i, t) => {
          const sq = [3, 1, 0][i];
          body(a, t, { hip: 21 + sq * 0.4, legA: 2.3 - t, legB: 0.9 + t, armA: 3.6 - t, armB: 3.4 - t, wind: 1.4 });
          for (let k = 0; k < 4 - i; k++) { const dx = 5 + k * 2; a.px(16 - dx, 26 - k, '#c8c3bc'); a.px(16 + dx, 26 - k, '#c8c3bc'); }
        })),
        // attack: wind-up, slash arc, recover
        D('attack', 14, false, seq(4, 14, (a, i, t) => {
          // Wind-up stops at -0.8rad with a shortened blade: a full overhead
          // raise puts the sword tip on row 0, where the outline cannot close.
          const sw = [-0.8, -0.2, 0.9, 1.5][i], L = i === 0 ? 8 : 10;
          body(a, t, { hip: 21, lean: i === 1 ? 1.6 : 0.4, legA: 2.1, legB: 1.1, armB: 2.0, wind: 1.8,
            armA: sw, handA: (ap, hx, hy) => {
              const ang = sw - 0.2;
              ap.line(hx, hy, hx + Math.cos(ang) * L, hy + Math.sin(ang) * L, '#c0cbdc', 2);
              ap.line(hx + 2, hy, hx + Math.cos(ang) * (L - 1), hy + Math.sin(ang) * (L - 1), '#ffffff', 1);
              ap.rect(hx - 2, hy - 1, hx + 2, hy + 1, '#8b9bb4');
            } });
          if (i >= 1 && i <= 2) for (let k = 0; k < 9; k++) {
            const ar = sw - 0.9 + (k / 9) * 1.9;
            a.px(16 + Math.cos(ar) * 13, 11 + Math.sin(ar) * 13, i === 1 ? '#8b9bb4' : '#ffffff');
          }
        })),
        D('hurt', 10, false, seq(3, 10, (a, i, t) => {
          body(a, t, { hip: 21 + i * 0.6, lean: -1.6, legA: 2.4 - i * 0.2, legB: 1.0 + i * 0.2, armA: 4.4, armB: 4.6, eye: 'hurt', wind: 2.4 });
          for (let k = 0; k < 5 - i; k++) a.px(22 + k, 8 + k * 2 - i, '#e43b44');
        }))
      ]
    };
  }

  /* ============================================================== SLIME ===
     A hopper reads from squash alone, so the whole animation is one radius
     pair. Highlight sits high-left; the nucleus lags behind the body, which is
     what makes a coloured ellipse feel like liquid. */
  function slimeBody(a, cx, cy, rx, ry, base, hi, sh, nuc) {
    a.ellipse(cx - rx, cy - ry, cx + rx, cy + ry, base, true);
    a.ellipse(cx - rx + 1, cy + ry - Math.max(1, ry >> 1), cx + rx - 1, cy + ry, sh, true);
    a.ellipse(cx - rx + 2, cy - ry + 1, cx - 1, cy - ry + Math.max(2, ry >> 1), hi, true);
    a.px(cx - rx + 2, cy - ry + 1, '#ffffff');
    // The core sits LOW in the body. Level with the eyes it reads as a beak,
    // which is how a slime turns into a duck.
    if (nuc) { a.ellipse(nuc[0] - 2, nuc[1] - 1, nuc[0] + 2, nuc[1] + 1, nuc[2], true);
      a.ellipse(nuc[0] - 1, nuc[1] - 1, nuc[0], nuc[1] - 1, '#ffffff', true); }
  }
  function slimeFace(a, cx, cy, mood) {
    if (mood === 'hurt') { a.px(cx - 3, cy - 1, OUT); a.px(cx - 2, cy, OUT); a.px(cx + 2, cy - 1, OUT); a.px(cx + 3, cy, OUT); }
    else { a.rect(cx - 4, cy - 1, cx - 3, cy, OUT); a.rect(cx + 3, cy - 1, cx + 4, cy, OUT);
      a.px(cx - 4, cy - 1, '#ffffff'); a.px(cx + 3, cy - 1, '#ffffff'); }
    // Mouth in the outline colour: a dark-green mouth on a green body is
    // invisible at 1x, which is the size this sprite will actually be seen at.
    if (mood === 'hurt') { a.line(cx - 2, cy + 4, cx + 2, cy + 4, OUT, 1); a.px(cx, cy + 3, OUT); }
    else { a.line(cx - 2, cy + 3, cx + 2, cy + 3, OUT, 1); a.px(cx - 2, cy + 2, OUT); a.px(cx + 2, cy + 2, OUT); }
  }
  function slimeSuite() {
    const base = '#4ac94a', hi = '#9dff8f', sh = '#2a7a34', nuc = '#c8f24a';
    const at = (a, cx, cy, rx, ry, mood) => {
      slimeBody(a, cx, cy, rx, ry, base, hi, sh, [cx - 1, cy + Math.max(2, ry - 2), nuc]);
      slimeFace(a, cx, cy - 2, mood);
    };
    return {
      width: 32, height: 32, name: 'Slime Hopper', layers: [{ name: 'slime' }],
      states: [
        D('idle', 6, true, cyc(4, 6, (a, i, t) => {
          const w = Math.sin(t * TAU) * 1.3;
          at(a, 16, 21 - w * 0.5, 8 + w, 6 - w);
          a.line(16 - 8 - w, 27, 16 + 8 + w, 27, sh, 1);
        })),
        // hop: compress, launch, apex, land — AIRBORNE, so the gate exempts it
        D('hop', 10, true, cyc(6, 10, (a, i) => {
          const pose = [[9, 4, 25], [8, 6, 22], [6, 8, 16], [7, 7, 13], [8, 6, 17], [9.5, 4, 25]][i];
          at(a, 16, pose[2] - pose[1] + 6, pose[0], pose[1]);
          if (i === 1 || i === 5) for (let k = -2; k <= 2; k++) a.px(16 + k * 3, 27, '#9dff8f');
        })),
        D('attack', 12, false, seq(4, 12, (a, i, t) => {
          const st = [[7, 7], [10, 4], [6, 9], [8, 6]][i];
          at(a, 16 + (i === 1 ? 2 : 0), 21, st[0], st[1]);
          if (i === 2) for (let k = 0; k < 6; k++) { const ang = -0.4 - k * 0.22; a.px(16 + Math.cos(ang) * (10 + k), 18 + Math.sin(ang) * (10 + k), nuc); }
        })),
        D('hurt', 12, false, seq(3, 12, (a, i, t) => {
          at(a, 16 + (i === 1 ? -2 : 1), 21, 9 - i * 0.6, 5 + i * 0.4, 'hurt');
          for (let k = 0; k < 4; k++) a.px(16 + Math.cos(k * 1.6) * (9 + i * 2), 20 + Math.sin(k * 1.6) * (7 + i), sh);
        })),
        // death: melt to a puddle. Single-direction, loop:false, no closure check
        D('die', 9, false, seq(5, 9, (a, i, t) => {
          const ry = 6 - t * 4.6, rx = 8 + t * 3;
          slimeBody(a, 16, 26 - ry, rx, Math.max(1, ry), base, hi, sh, t < 0.5 ? [15, 25, nuc] : null);
          if (t < 0.55) slimeFace(a, 16, 23 - ry * 0.4, 'hurt');
          speck(a, 16 - rx, 25, 16 + rx, 27, 4, [sh, hi], 0.18 + t * 0.2);
        }))
      ]
    };
  }

  /* ============================================================== SPIKY ===
     Ground hazard that walks. Dark quills over a warm body: the classic
     "do not touch" read without copying any particular game's shape.

     The quills are deliberately NOT black. At #2a1440 they sat one step off
     the #181425 outline, so on any dark background the quills, their outline
     and the backdrop merged and the sprite lost its whole silhouette. */
  function spikySuite() {
    const body = '#8a4fd6', bodySh = '#5a2e96', bodyHi = '#c08ef0', quill = '#3b1f5c', foot = '#f6a03a';
    const at = (a, cx, cy, step, mood) => {
      // quills first so the body overlaps their roots
      for (let k = 0; k < 9; k++) {
        const ang = Math.PI + (k / 8) * Math.PI;
        const qx = cx + Math.cos(ang) * 7, qy = cy + Math.sin(ang) * 6;
        a.line(qx, qy, cx + Math.cos(ang) * 11, cy + Math.sin(ang) * 10, quill, 2);
        a.px(cx + Math.cos(ang) * 11, cy + Math.sin(ang) * 10, '#7a47c0');
      }
      blob(a, cx, cy, 7, 6, body, bodyHi, bodySh);
      if (mood === 'hurt') { a.px(cx - 4, cy - 2, OUT); a.px(cx - 3, cy - 1, OUT); a.px(cx + 3, cy - 2, OUT); a.px(cx + 4, cy - 1, OUT); }
      else { a.rect(cx - 4, cy - 2, cx - 3, cy - 1, OUT); a.rect(cx + 3, cy - 2, cx + 4, cy - 1, OUT);
        a.px(cx - 4, cy - 2, '#ffffff'); a.px(cx + 3, cy - 2, '#ffffff'); }
      a.line(cx - 2, cy + 2, cx + 2, cy + 2, bodySh, 1);
      // two stub feet in counter-phase: the only thing that says "walking"
      a.rect(cx - 5, cy + 5 + (step ? 0 : 1), cx - 2, cy + 6 + (step ? 0 : 1), foot);
      a.rect(cx + 2, cy + 5 + (step ? 1 : 0), cx + 5, cy + 6 + (step ? 1 : 0), foot);
    };
    return {
      width: 32, height: 32, name: 'Spiky Crawler', layers: [{ name: 'spiky' }],
      states: [
        D('walk', 8, true, cyc(4, 8, (a, i) => at(a, 16, 20 - (i % 2), i % 2 === 0))),
        // idle breathes a full 2px: a 1px bob on a 14px-wide body fell under
        // the gate's 8-pixel minimum delta and read as a frozen sprite.
        D('idle', 5, true, cyc(3, 5, (a, i) => { at(a, 16, [20, 18, 19][i], i === 1);
          a.px(10 - i, 12, '#c08ef0'); a.px(22 + i, 13, '#c08ef0'); })),
        // bristle: quills flare before a charge
        D('bristle', 12, false, seq(4, 12, (a, i, t) => {
          at(a, 16, 20, i % 2 === 0);
          for (let k = 0; k < 9; k++) { const ang = Math.PI + (k / 8) * Math.PI;
            a.line(16 + Math.cos(ang) * 10, 20 + Math.sin(ang) * 9, 16 + Math.cos(ang) * (11 + t * 3), 20 + Math.sin(ang) * (10 + t * 2.6), quill, 1); }
        })),
        D('hurt', 10, false, seq(3, 10, (a, i) => { at(a, 16 + (i === 1 ? -2 : 1), 20 + i, i % 2 === 0, 'hurt');
          for (let k = 0; k < 4 - i; k++) a.px(16 + Math.cos(k * 1.7) * (11 + i * 2), 19 + Math.sin(k * 1.7) * (9 + i), '#e43b44'); }))
      ]
    };
  }

  /* ============================================================ FLYER ===
     Tagged 'flying' so the ground-contact gate skips it. Wings are two arcs
     whose span is the animation; the body barely moves. */
  function flyerSuite() {
    const memb = '#b5443a', membHi = '#e07a63', fur = '#4a3a56', furHi = '#7a648c', eye = '#ffd24a';
    const at = (a, cy, span, mood) => {
      /* Filled membrane with a scalloped trailing edge and darker finger
         struts. Two parallel 2px lines from shoulder to tip read as a plank:
         what makes a wing is the area between a straight leading edge and a
         notched trailing one. */
      const reach = Math.round(6 + span * 6), tipY = cy - span * 5;
      const chordAt = f => Math.max(1, Math.round((3.5 - f * 2.2) + Math.sin(f * Math.PI * 3) * 1.1));
      for (const s of [-1, 1]) {
        for (let d = 0; d <= reach; d++) {
          const f = d / reach, x = 16 + s * (3 + d);
          const lead = Math.round(cy - 1 + (tipY - cy + 1) * f);
          a.line(x, lead, x, lead + chordAt(f), memb, 1);
          a.px(x, lead, membHi);
        }
        for (let k = 1; k < 4; k++) {
          const f = k / 4, x = 16 + s * (3 + Math.round(reach * f));
          const lead = Math.round(cy - 1 + (tipY - cy + 1) * f);
          a.line(x, lead + 1, x, lead + chordAt(f), '#7a2a24', 1);
        }
      }
      blob(a, 16, cy, 4, 4, fur, furHi, '#2a2038');
      a.line(13, cy - 5, 14, cy - 8, fur, 1); a.line(19, cy - 5, 18, cy - 8, fur, 1);  // ears
      if (mood === 'hurt') { a.px(14, cy - 1, OUT); a.px(15, cy, OUT); a.px(18, cy - 1, OUT); a.px(17, cy, OUT); }
      else { a.rect(14, cy - 1, 15, cy, eye); a.rect(18, cy - 1, 19, cy, eye); a.px(14, cy - 1, '#ffffff'); a.px(18, cy - 1, '#ffffff'); }
      a.px(15, cy + 3, '#ffffff'); a.px(18, cy + 3, '#ffffff');    // fangs
    };
    return {
      width: 32, height: 32, name: 'Cave Flyer', layers: [{ name: 'flyer' }],
      states: [
        // A pure sine flap repeats its own values either side of the peak, so
        // frames 1/2 and 4/5 came out pixel-identical. The curve is an explicit
        // table: fast down-stroke, slower recovery, like an actual wing.
        D('fly', 12, true, cyc(6, 12, (a, i) => at(a, [16, 15, 13, 14, 15, 17][i], [0.15, 0.6, 1.0, 0.75, 0.4, 0.25][i]))),
        D('glide', 8, true, cyc(3, 8, (a, i, t) => { at(a, 15 + i, 0.95);
          for (let k = 0; k < 3; k++) a.px(6 + k * 2 + i, 12 + k, '#7a648c'); })),
        /* No motion trail. Every version of one misread: a diagonal run became
           a rod glued to the skull, dashes stacked above it became a mast, and
           dots beside the ears just extended them into rabbit ears. The dive
           already reads from the pose — descending body, wings swept back. */
        D('swoop', 14, false, seq(4, 14, (a, i, t) => at(a, 10 + i * 4, 0.1 + t * 0.2))),
        D('hurt', 11, false, seq(3, 11, (a, i) => { at(a, 14 + i * 2, 0.2, 'hurt');
          for (let k = 0; k < 4; k++) a.px(16 + Math.cos(k * 1.6) * (8 + i * 2), 14 + Math.sin(k * 1.6) * (6 + i), '#e43b44'); }))
      ]
    };
  }

  /* ========================================================= COLLECTABLES ===
     A coin has to read as currency in 16 pixels and 4 frames: the trick is
     that the "edge on" frame is 2px wide and nearly white, so the spin has a
     flash rather than a smooth squash. */
  function pickupSuite() {
    const coinFrames = (gold, rim, hiC) => cyc(6, 12, (a, i) => {
      const w = Math.abs(Math.cos((i / 6) * Math.PI)) * 6 + 0.6;
      a.ellipse(16 - w, 12, 16 + w, 24, rim, true);
      if (w > 2) {
        a.ellipse(16 - w + 1, 13, 16 + w - 1, 23, gold, true);
        a.ellipse(16 - w + 2, 14, 16 - w + 3, 17, hiC, true);
        a.rect(16 - 1, 16, 16 + 1, 20, rim);        // struck face mark
      } else a.rect(16 - 1, 12, 16 + 1, 24, hiC);   // edge-on flash
      const sp = 14 + Math.round(Math.sin((i / 6) * TAU) * 3);
      a.px(sp, 9, '#fff6c9'); a.px(30 - sp, 27, '#fff6c9');
    });
    /* A cut gem is a table (flat top), a crown that WIDENS to the girdle and
       a pavilion that tapers to a point. Narrowing from row 0 gives an
       ice-cream cone; the widest row has to sit one below the table. */
    const gemFrames = (c0, c1, c2) => cyc(6, 10, (a, i, t) => {
      const cy = 18 + [0, -1, -2, -1, 0, 1][i];
      const HW = [4, 5, 5, 4, 3, 2, 1];              // half-widths, table -> point
      a.rect(16 - 3, cy - 5, 16 + 3, cy - 5, c2);    // table
      HW.forEach((hw, r) => a.rect(16 - hw, cy - 4 + r, 16 + hw, cy - 4 + r, r < 2 ? c1 : c0));
      a.line(16 - 3, cy - 4, 16, cy + 2, c2, 1);     // left crown facet, lit
      a.line(16 + 3, cy - 4, 16, cy + 2, c0, 1);     // right facet, in shadow
      a.rect(16 - 3, cy - 5, 16 - 1, cy - 5, '#ffffff');
      a.px(16 - 4, cy - 3, '#ffffff');
      // A glint sweeping the facets plus a sparkle orbiting the stone: both
      // move every frame, so no two frames of the float can coincide.
      const g = (i + 2) % 6;
      if (g < 4) a.rect(16 + 4 - g, cy - 4 + g, 16 + 4 - g, cy - 3 + g, '#ffffff');
      const oa = t * TAU, sx = 16 + Math.cos(oa) * 10, sy = cy + Math.sin(oa) * 8;
      a.px(sx, sy, '#ffffff'); a.px(sx + 1, sy, c2); a.px(sx, sy + 1, c2);
    });
    /* Filled star polygon: 10 alternating vertices, each edge fanned back to
       the centre. Drawing only the spokes (the obvious shortcut) gives a
       starfish, not a star. */
    const starShape = (a, cx, cy, ro, ri, rot, fillC, hiC, edgeC) => {
      const V = [];
      for (let k = 0; k < 10; k++) {
        const ang = rot - Math.PI / 2 + (k / 10) * TAU, r = k % 2 ? ri : ro;
        V.push([cx + Math.cos(ang) * r, cy + Math.sin(ang) * r]);
      }
      for (let k = 0; k < 10; k++) {
        const [x0, y0] = V[k], [x1, y1] = V[(k + 1) % 10];
        for (let q = 0; q <= 8; q++) a.line(cx, cy, x0 + (x1 - x0) * q / 8, y0 + (y1 - y0) * q / 8, fillC, 1);
      }
      for (let k = 0; k < 10; k += 2) a.line(cx, cy, V[k][0], V[k][1], hiC, 1);   // lit ridge per point
      for (let k = 0; k < 10; k++) { const [x0, y0] = V[k], [x1, y1] = V[(k + 1) % 10]; a.line(x0, y0, x1, y1, edgeC, 1); }
    };
    return {
      width: 32, height: 32, name: 'Collectables', layers: [{ name: 'pickup' }],
      states: [
        D('coin_gold', 12, true, coinFrames('#f6c33a', '#b07a12', '#fff6c9')),
        D('coin_silver', 12, true, coinFrames('#c9d4e0', '#6d7d92', '#ffffff')),
        D('gem_red', 10, true, gemFrames('#8a1d33', '#e43b44', '#ff9aa2')),
        D('gem_blue', 10, true, gemFrames('#1d4d8a', '#2f8ee0', '#9ad8ff')),
        D('gem_green', 10, true, gemFrames('#1d6a3a', '#3fc46a', '#a4f2b8')),
        // heart pickup: a scale pulse, not a colour blink — reads while moving
        D('heart', 8, true, cyc(4, 8, (a, i, t) => {
          const s = 1 + Math.sin(t * TAU) * 0.1, cy = 18 - Math.round(Math.cos(t * TAU) * 2);
          const rows = [[3, 4, 7, 8], [2, 9], [1, 10], [1, 10], [1, 10], [2, 9], [3, 8], [4, 7], [5, 6]];
          rows.forEach((sp, dy) => { for (let q = 0; q < sp.length; q += 2) {
            const x0 = 16 - 6 + sp[q] * s, x1 = 16 - 6 + sp[q + 1] * s;
            a.rect(x0, cy - 5 + dy, x1, cy - 5 + dy, dy < 3 ? '#ff5a6e' : '#c2283c'); } });
          a.rect(16 - 3, cy - 4, 16 - 2, cy - 3, '#ffc0c8');
          if (i % 2 === 0) { a.px(24, 11, '#ffffff'); a.px(9, 22, '#ffffff'); }
        })),
        D('star', 12, true, cyc(6, 12, (a, i, t) => {
          const cy = 18 + [0, -1, -1, 0, 1, 1][i];
          starShape(a, 16, cy, 11, 4.6, t * 0.5, '#f6c33a', '#fff6c9', '#b07a12');
          a.rect(13, cy - 1, 14, cy, OUT); a.rect(18, cy - 1, 19, cy, OUT);   // face
          a.px(13, cy - 1, '#ffffff'); a.px(18, cy - 1, '#ffffff');
          a.line(15, cy + 3, 17, cy + 3, '#b07a12', 1);
          const k = i % 3;
          a.px(6 + k, 7 + k, '#ffffff'); a.px(25 - k, 27 - k, '#ffffff');
        })),
        D('key', 8, true, cyc(4, 8, (a, i, t) => {
          const b = Math.round(Math.sin(t * TAU) * 2.5);
          a.ellipse(9, 13 + b, 17, 21 + b, '#c9a227', false);
          a.ellipse(10, 14 + b, 16, 20 + b, '#f6d64a', false);
          a.rect(17, 16 + b, 25, 18 + b, '#f6d64a');
          a.rect(17, 16 + b, 25, 16 + b, '#fff6c9');
          a.rect(22, 18 + b, 23, 21 + b, '#c9a227'); a.rect(25, 18 + b, 25, 20 + b, '#c9a227');
          if (i % 2) { a.px(12, 11 + b, '#ffffff'); a.px(26, 20 + b, '#ffffff'); }
        }))
      ]
    };
  }

  /* ============================================================== PROPS ===
     Interactables: crate, barrel, spring, checkpoint flag, door, sign, spike
     strip and a moving platform. All flush to the floor at y27. */
  function propSuite() {
    const woodPlanks = (a, x0, y0, x1, y1, c, cs, ch) => {
      a.rect(x0, y0, x1, y1, c);
      for (let y = y0; y <= y1; y += 3) a.line(x0, y, x1, y, cs, 1);
      a.line(x0, y0, x1, y0, ch, 1);
      speck(a, x0 + 1, y0 + 1, x1 - 1, y1 - 1, 11, [cs, ch], 0.14);
    };
    return {
      width: 32, height: 32, name: 'Platform Props', layers: [{ name: 'prop' }],
      states: [
        D('crate', 1, false, still(a => {
          woodPlanks(a, 6, 11, 25, 27, '#a9763f', '#77502a', '#d09a5f');
          // The X brace goes on top of the planks, 2px and lighter than them —
          // drawn in the shadow colour it disappears into the plank seams.
          a.line(7, 12, 24, 26, '#d09a5f', 2); a.line(24, 12, 7, 26, '#d09a5f', 2);
          a.line(7, 12, 24, 26, '#e8c08a', 1); a.line(24, 12, 7, 26, '#8a5a2e', 1);
          a.rectO(6, 11, 25, 27, '#5c3a1e');
          a.rect(6, 11, 25, 11, '#d09a5f'); a.rect(6, 27, 25, 27, '#5c3a1e');
          for (const [x, y] of [[8, 13], [23, 13], [8, 25], [23, 25]]) { a.px(x, y, '#c0cbdc'); a.px(x, y + 1, '#6d7d92'); }
        })),
        D('barrel', 1, false, still(a => {
          a.ellipse(8, 9, 23, 13, '#8a5a2e', true);
          a.rect(8, 11, 23, 25, '#a9763f');
          a.ellipse(8, 23, 23, 27, '#77502a', true);
          for (let y = 12; y < 25; y += 4) a.line(8, y, 23, y, '#77502a', 1);
          // Hoops: 2px band with a lit top row, so they wrap the staves
          // instead of reading as two grey stripes painted on.
          for (const hy of [14, 21]) { a.rect(7, hy, 24, hy + 1, '#6d7d92'); a.rect(7, hy, 24, hy, '#a3b1c4'); }
          a.ellipse(9, 10, 22, 13, '#c08a52', true);
          a.line(10, 11, 13, 11, '#d09a5f', 1);
        })),
        // spring: compress + release. Coils redraw at a real pitch, not 3 bars
        D('spring', 14, false, seq(4, 14, (a, i, t) => {
          // Rest sits high enough that the coil stack is readable; a "rest"
          // pose only 4px above the base is just a red slab on a plate.
          const top = [18, 24, 9, 14][i], span = Math.max(1, 25 - top);
          const coils = Math.max(2, Math.min(5, Math.round(span / 3)));
          a.rect(8, 26, 23, 27, '#5a6988'); a.rect(8, 26, 23, 26, '#8b9bb4');
          for (let k = 0; k < coils; k++) {
            const y = 25 - span * (k / coils);
            a.line(9, y, 22, y - 1, '#c0cbdc', 2);
            a.line(9, y, 22, y - 1, k % 2 ? '#8b9bb4' : '#e4eaf2', 1);
          }
          a.rect(6, top - 3, 25, top, '#e43b44');
          a.rect(6, top - 3, 25, top - 3, '#ff7a86');
          a.rect(6, top, 25, top, '#8a1d33');
        })),
        D('checkpoint', 8, true, cyc(4, 8, (a, i, t) => {
          a.rect(9, 8, 10, 27, '#8b9bb4'); a.rect(9, 8, 9, 27, '#c0cbdc');
          a.ellipse(7, 25, 13, 27, '#5a6988', true);
          for (let y = 0; y < 8; y++) {
            const wv = Math.sin(t * TAU + y * 0.5) * 2;
            a.line(11, 9 + y, 22 + wv, 9 + y, y < 4 ? '#3fc46a' : '#1d8a4a');
          }
          a.px(11, 8, '#c0cbdc');
          if (i % 2 === 0) { a.px(16, 5, '#a4f2b8'); a.px(20, 6, '#a4f2b8'); }
        })),
        // The door reads as opening only if something is revealed behind it:
        // a lit interior with the glow strongest at the floor, and a leading
        // edge in shadow so the panel has thickness.
        D('door', 6, false, seq(4, 6, (a, i, t) => {
          a.rect(4, 3, 27, 27, '#5c3a1e');
          a.rect(4, 3, 27, 4, '#8a5a2e');                       // lintel
          a.rect(7, 5, 24, 27, '#241a14');
          for (let y = 27; y > 12; y--) {
            const k = (27 - y) / 15;
            a.rect(8, y, 23, y, k < 0.3 ? '#6b4326' : k < 0.55 ? '#40291b' : '#241a14');
          }
          const open = Math.round(t * 15);
          if (open < 15) {
            woodPlanks(a, 8 + open, 5, 23, 27, '#a9763f', '#77502a', '#d09a5f');
            a.rect(8 + open, 5, 8 + open, 27, '#5c3a1e');
            a.rect(8 + open, 5, 23, 5, '#d09a5f');
            if (open < 11) { a.rect(20, 15, 21, 17, '#f6d64a'); a.px(20, 15, '#fff6c9'); }
          }
          for (let y = 7; y < 27; y += 6) a.px(5, y, '#c0cbdc');   // hinge pins
        })),
        D('sign', 1, false, still(a => {
          a.rect(15, 18, 17, 27, '#77502a');
          woodPlanks(a, 5, 9, 27, 19, '#c08a52', '#8a5a2e', '#e0b47a');
          a.rectO(5, 9, 27, 19, '#5c3a1e');
          a.rect(9, 12, 23, 13, '#5c3a1e'); a.rect(9, 15, 19, 16, '#5c3a1e');
        })),
        D('spikes', 1, false, still(a => {
          a.rect(2, 24, 29, 27, '#5a6988');
          a.rect(2, 24, 29, 24, '#8b9bb4');
          for (let k = 0; k < 6; k++) {
            const x = 3 + k * 5;
            for (let r = 0; r < 8; r++) a.rect(x + Math.floor(r / 2.6), 23 - r, x + 3 - Math.floor(r / 2.6), 23 - r, r > 4 ? '#e4eaf2' : '#c0cbdc');
            a.line(x, 23, x + 1, 17, '#ffffff', 1);
          }
        })),
        D('platform', 8, true, cyc(4, 8, (a, i, t) => {
          const y = 14 + Math.round(Math.sin(t * TAU) * 3);
          a.rect(3, y, 28, y + 5, '#6d7d92');
          a.rect(3, y, 28, y + 1, '#a3b1c4');
          a.rect(3, y + 4, 28, y + 5, '#3d4a5c');
          for (let x = 5; x < 28; x += 6) a.rect(x, y + 2, x + 2, y + 3, '#3d4a5c');
          a.rect(14, y + 6, 17, 27, '#3d4a5c');       // support column
          a.rect(15, y + 6, 15, 27, '#6d7d92');
          for (let k = 0; k < 3; k++) a.px(8 + k * 8, y - 2 - (i % 2), '#7fd4ff');
        }))
      ]
    };
  }

  /* ============================================================= TILESET ===
     16 tiles on a 64x64 sheet, laid out for the studio's 4x4 grid:
       row0 grass cap L/M/R + solo    row1 dirt body L/M/R + inner
       row2 stone + brick + ore + ledge   row3 ladder, spike top, water, cloud
     Every tile is edge-continuous with its neighbours, so the sheet drops
     straight into an autotiler. */
  function tilesetSuite() {
    const DIRT = '#7a4f2e', DIRT_D = '#54351e', DIRT_L = '#9c6a41';
    const GRASS = '#4aa03c', GRASS_L = '#7bd16a', GRASS_D = '#2f6e2a';
    const STONE = '#6d7d92', STONE_D = '#48566a', STONE_L = '#a3b1c4';
    const cell = (api, cx, cy) => P().offsetApi(api, cx * 16, cy * 16);

    const dirtBase = a => { a.rect(0, 0, 15, 15, DIRT); speck(a, 0, 0, 15, 15, 21, [DIRT_D, DIRT_L], 0.32); };
    const grassCap = (a, left, right) => {
      a.rect(0, 0, 15, 4, GRASS);
      a.rect(0, 0, 15, 1, GRASS_L);
      // ragged root line into the dirt, deterministic per column
      for (let x = 0; x < 16; x++) { const d = Math.floor(a.hash(x, 3, 5) * 3); a.rect(x, 5, x, 5 + d, GRASS_D); }
      if (left) { a.rect(0, 0, 1, 15, DIRT_D); a.rect(0, 0, 1, 4, GRASS_D); }
      if (right) { a.rect(14, 0, 15, 15, DIRT_D); a.rect(14, 0, 15, 4, GRASS_D); }
      for (let x = 1; x < 15; x += 5) { a.px(x, 0, GRASS_L); a.px(x + 2, 1, GRASS_L); }
    };
    const paint = (a) => {
      // ---- row 0: grass surface
      [[0, false, true], [1, false, false], [2, true, false]].forEach(([cx, l, r]) => {
        const c = cell(a, cx, 0); dirtBase(c); grassCap(c, l, r);
      });
      const solo = cell(a, 3, 0); dirtBase(solo); grassCap(solo, true, true);
      // ---- row 1: dirt body, edges + an inner-corner variant
      [[0, true, false], [1, false, false], [2, false, true]].forEach(([cx, l, r]) => {
        const c = cell(a, cx, 1); dirtBase(c);
        if (l) c.rect(0, 0, 1, 15, DIRT_D); if (r) c.rect(14, 0, 15, 15, DIRT_D);
        for (let k = 0; k < 3; k++) { const px = 2 + k * 5, py = 3 + ((k * 7) % 9); c.ellipse(px, py, px + 2, py + 1, DIRT_L, true); }
      });
      const inner = cell(a, 3, 1); dirtBase(inner);
      inner.rect(0, 0, 15, 1, DIRT_D); inner.rect(0, 0, 1, 15, DIRT_D);
      inner.rect(2, 2, 3, 3, DIRT_L);
      // ---- row 2: stone, brick, ore, ledge
      const st = cell(a, 0, 2);
      st.rect(0, 0, 15, 15, STONE); speck(st, 0, 0, 15, 15, 33, [STONE_D, STONE_L], 0.4);
      st.rect(0, 0, 15, 0, STONE_L); st.rect(0, 15, 15, 15, STONE_D);
      const br = cell(a, 1, 2);
      br.rect(0, 0, 15, 15, STONE_D);
      for (let row = 0; row < 4; row++) for (let k = -1; k < 3; k++) {
        const bx = k * 8 + (row % 2 ? 4 : 0), by = row * 4;
        br.rect(bx, by, bx + 6, by + 2, STONE);
        br.rect(bx, by, bx + 6, by, STONE_L);
      }
      const ore = cell(a, 2, 2);
      ore.rect(0, 0, 15, 15, STONE); speck(ore, 0, 0, 15, 15, 33, [STONE_D], 0.36);
      [[4, 4], [9, 7], [5, 11]].forEach(([ox, oy], k) => {
        const c2 = ['#f6c33a', '#7fd4ff', '#f6c33a'][k];
        ore.ellipse(ox, oy, ox + 2, oy + 2, c2, true); ore.px(ox, oy, '#ffffff');
      });
      const ledge = cell(a, 3, 2);
      ledge.rect(0, 2, 15, 8, STONE); ledge.rect(0, 2, 15, 3, STONE_L); ledge.rect(0, 7, 15, 8, STONE_D);
      for (let x = 0; x < 16; x += 4) ledge.rect(x, 9, x + 1, 10, STONE_D);
      // ---- row 3: ladder, spike cap, water, cloud
      const lad = cell(a, 0, 3);
      lad.rect(3, 0, 5, 15, '#a9763f'); lad.rect(10, 0, 12, 15, '#a9763f');
      lad.rect(3, 0, 3, 15, '#d09a5f'); lad.rect(10, 0, 10, 15, '#d09a5f');
      for (let y = 1; y < 16; y += 5) { lad.rect(3, y, 12, y + 1, '#c08a52'); lad.rect(3, y, 12, y, '#e0b47a'); }
      const sp = cell(a, 1, 3);
      sp.rect(0, 12, 15, 15, STONE_D);
      for (let k = 0; k < 4; k++) { const x = k * 4;
        for (let r = 0; r < 11; r++) sp.rect(x + Math.floor(r / 4), 11 - r, x + 3 - Math.floor(r / 4), 11 - r, r > 6 ? '#e4eaf2' : '#c0cbdc'); }
      const wat = cell(a, 2, 3);
      wat.rect(0, 0, 15, 15, '#2a6fa8');
      wat.rect(0, 0, 15, 2, '#4e9ed6');
      for (let x = 0; x < 16; x++) { const y = 3 + Math.round(Math.sin(x * 0.6) * 1.2); wat.rect(x, y, x, y, '#9ad8ff'); }
      speck(wat, 0, 4, 15, 15, 44, ['#17456d', '#4e9ed6'], 0.28);
      const cl = cell(a, 3, 3);
      cl.ellipse(0, 5, 9, 13, '#e4eaf2', true); cl.ellipse(5, 2, 15, 12, '#e4eaf2', true);
      cl.ellipse(1, 6, 8, 11, '#ffffff', true); cl.ellipse(6, 3, 13, 9, '#ffffff', true);
      cl.rect(0, 12, 15, 13, '#c0cbdc');
    };
    return {
      width: 64, height: 64, name: 'Platform Tileset', layers: [{ name: 'tiles' }],
      // A tileset is a single authored sheet: one frame, no diff/loop checks.
      states: [D('tiles', 1, false, still(paint))]
    };
  }

  /* ============================================================ PARALLAX ===
     Three seamless 64x32 backdrop strips. Horizontal wrap is exact (the
     rightmost column continues into the leftmost), so an engine can scroll
     them at different speeds without a visible join. */
  function parallaxSuite() {
    const band = (a, y0, y1, top, bot) => { for (let y = y0; y <= y1; y++) {
      const k = (y - y0) / Math.max(1, y1 - y0);
      const c = PF.Color.u32ToHex(PF.Color.fromRGBA(
        Math.round(parseInt(top.slice(1, 3), 16) + (parseInt(bot.slice(1, 3), 16) - parseInt(top.slice(1, 3), 16)) * k),
        Math.round(parseInt(top.slice(3, 5), 16) + (parseInt(bot.slice(3, 5), 16) - parseInt(top.slice(3, 5), 16)) * k),
        Math.round(parseInt(top.slice(5, 7), 16) + (parseInt(bot.slice(5, 7), 16) - parseInt(top.slice(5, 7), 16)) * k), 255));
      a.line(0, y, 63, y, c, 1);
    } };
    // A ridge line that closes on itself: sum of sines whose periods divide 64.
    const ridge = (a, baseY, amp, fill, cap, seed) => {
      for (let x = 0; x < 64; x++) {
        const h = Math.round(Math.sin(x / 64 * TAU + seed) * amp + Math.sin(x / 64 * TAU * 3 + seed * 2) * amp * 0.4
          + Math.sin(x / 64 * TAU * 5 + seed) * amp * 0.18);
        a.rect(x, baseY - h, x, 31, fill);
        a.rect(x, baseY - h, x, baseY - h, cap);
      }
    };
    /* Foliage has to wrap. A parallax layer whose sprites clip at x=63 shows a
       hard seam every time the layer repeats, which defeats the point of it. */
    const wrapLine = (a, x0, x1, y, c) => { for (let x = x0; x <= x1; x++) a.px(((x % 64) + 64) % 64, y, c); };
    return {
      width: 64, height: 32, name: 'Parallax Layers', layers: [{ name: 'bg' }],
      states: [
        D('sky_far', 1, false, still(a => {
          band(a, 0, 31, '#2a3a6e', '#c9628a');
          for (let k = 0; k < 14; k++) { const x = Math.floor(a.hash(k, 3, 7) * 64), y = Math.floor(a.hash(k, 9, 7) * 16);
            a.px(x, y, k % 3 ? '#e4eaf2' : '#fff6c9'); }
          /* Disc from an explicit radius test. ellipse() at nine pixels across
             rasterises to a rhombus, and a rhombus moon reads as a gemstone. */
          for (let y = -4; y <= 4; y++) for (let x = -4; x <= 4; x++) {
            const d = Math.sqrt(x * x + y * y);
            if (d > 4.3) continue;
            a.px(51 + x, 8 + y, d > 3.2 ? '#fff6c9' : '#ffffff');
          }
        })),
        D('hills_mid', 1, false, still(a => {
          band(a, 0, 31, '#6a4a86', '#8c5f96');
          ridge(a, 22, 6, '#4a3566', '#6b4f8a', 0.7);
          ridge(a, 28, 4, '#33254a', '#4a3566', 2.4);
        })),
        D('trees_near', 1, false, still(a => {
          band(a, 0, 31, '#1d2340', '#141a30');
          for (let k = 0; k < 9; k++) {
            const x = (k * 7 + 2) % 64, h = 10 + ((k * 5) % 9);
            wrapLine(a, x, x + 1, 31, '#0d1224');
            for (let ty = 31 - h; ty <= 31; ty++) wrapLine(a, x, x + 1, ty, '#0d1224');
            for (let b = 0; b < 4; b++) { const by = 31 - h + b * 3;
              wrapLine(a, x - 3 - b, x + 4 + b, by + 2, '#111a2e');
              wrapLine(a, x - 2 - b, x + 3 + b, by + 1, '#0d1224'); }
          }
          a.rect(0, 30, 63, 31, '#0a0e1c');
        }))
      ]
    };
  }

  return { heroSuite, slimeSuite, spikySuite, flyerSuite, pickupSuite, propSuite, tilesetSuite, parallaxSuite };
})();
