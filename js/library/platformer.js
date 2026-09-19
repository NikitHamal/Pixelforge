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
  /* A rim light is an ARC, not a ring. PF.Pixel's ellipse() only draws the
     whole outline, and the left and right sides of that outline are vertical
     runs of the brightest colour in the palette -- on a 14px-wide body they
     read as two light bars painted down the face. Sample the boundary
     directly and keep only the arc the key light actually reaches. */
  function rimArc(a, cx, cy, rx, ry, a0, a1, col) {
    const n = Math.max(6, Math.ceil(Math.abs(a1 - a0) * Math.max(rx, ry) * 2));
    for (let k = 0; k <= n; k++) {
      const ang = a0 + (a1 - a0) * (k / n);
      a.px(cx + Math.cos(ang) * rx, cy + Math.sin(ang) * ry, col);
    }
  }
  function speck(a, x0, y0, x1, y1, seed, colors, density = 0.1) {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++)
      if (a.hash(x, y, seed) < density) a.px(x, y, colors[Math.floor(a.hash(x, y, seed + 71) * colors.length) % colors.length]);
  }

  /* ================================================================ HERO ===
     One rig, six states. Everything is driven by (hipY, lean, armA, legA) so a
     new state is a pose description, not another 40 lines of rectangles. */
  const HERO = {
    /* The old palette put the far leg (#252540) and the shirt's shadow side
       (#17456d) two luma apart, so the back arm dissolved into the hip and
       the hero read as a bottle. Every neighbouring pair is separated by
       value AND hue now, and the belt gives the torso a hard waistline. */
    skin: '#f2c094', skinHi: '#ffe0bc', skinSh: '#a9674f', lip: '#8c4a3c',
    hair: '#a83a1e', hairHi: '#e0663a', hairSh: '#6d2210',
    shirt: '#2a6fa8', shirtSh: '#17456d', shirtHi: '#4e9ed6',
    belt: '#7a4a22', beltHi: '#a9702e', buckle: '#e8c547',
    pants: '#4e4a66', pantsSh: '#2d2b40', pantsDk: '#1b1a29',
    boot: '#6b3f2a', bootSh: '#432618', bootHi: '#9a6440', soleDk: '#2a1610',
    scarf: '#e8c547', scarfSh: '#b08d1e', glove: '#c9563a', gloveSh: '#8d3c28'
  };

  /* leg(a, hipX, hipY, ang, pal, far)
     `ang` is the THIGH's direction and the shin counter-rotates off the knee,
     because that is what a knee does. The old rig placed the foot with an
     unrelated cosine of the same angle, so the two legs of the idle pose
     landed on the same pixel column and the hero stood on one stump. */
  function leg(a, hx, hy, ang, pal, far, tuck) {
    const c = far ? pal.pantsSh : pal.pants;
    const cd = far ? pal.pantsDk : pal.pantsSh;
    const bc = far ? pal.bootSh : pal.boot;
    const bh = far ? pal.boot : pal.bootHi;
    const bd = far ? pal.soleDk : pal.bootSh;
    const kx = hx + Math.cos(ang) * 2.9, ky = hy + Math.sin(ang) * 2.9;
    /* The shin follows the thigh instead of counter-rotating against it: the
       old rule pulled both feet back under the hips, so a run with a 5px
       thigh swing landed its boots two pixels apart and read as a shuffle.
       `tuck` is heel-lift — at 1 the trailing leg folds up behind the hero
       the way a sprinter's does, at 0 the foot stays planted for a stance. */
    const sa = 1.5708 + (ang - 1.5708) * (ang < 1.5708 ? 0.55 : 0.55 + (tuck || 0) * 0.85);
    const fx = Math.round(kx + Math.cos(sa) * 3.4);
    const fy = Math.min(26, Math.round(ky + Math.sin(sa) * 3.4));
    a.line(hx - 1, hy, kx - 1, ky, cd, 3);             // the leg's own dark back edge,
    a.line(hx, hy, kx, ky, c, 3);                      //   so two legs never merge
    a.line(kx - 1, ky, fx - 1, fy, cd, 2);             // shin
    a.line(kx, ky, fx, fy, c, 2);
    a.px(kx - 1, ky, cd);                              // knee crease
    a.rect(fx - 1, fy - 1, fx + 1, fy + 1, bc);        // boot
    a.rect(fx - 1, fy - 1, fx, fy - 1, bh);            // instep catches the light
    a.px(fx + 2, fy + 1, bc);                          // toe
    a.rect(fx - 1, fy + 1, fx + 1, fy + 1, bd);        // sole
  }

  /* Arms hang from the shoulder *point*, not the torso centre, and they bend:
     a 3px sleeve, a bare forearm and a glove, so the limb has a joint at any
     pose instead of being one stick with a brick on the end. */
  function arm(a, sx, sy, ang, pal, far, hand) {
    const c = far ? pal.shirtSh : pal.shirt, hi = far ? pal.shirt : pal.shirtHi;
    const sk = far ? pal.skinSh : pal.skin, skh = far ? pal.skinSh : pal.skinHi;
    const g = far ? '#9c4a34' : pal.glove;
    const ex = sx + Math.cos(ang) * 3.4, ey = sy + Math.sin(ang) * 3.4;
    const ha = ang + 0.45;
    const hx = Math.round(ex + Math.cos(ha) * 3.2), hy = Math.round(ey + Math.sin(ha) * 3.2);
    /* The near arm passes IN FRONT of a chest painted in its own sleeve
       colour, so without a dark keyline around the limb the whole arm
       dissolved into the torso and left a glove floating at the hip. */
    const key = far ? '#0f2c48' : pal.shirtSh;
    a.line(sx, sy, ex, ey, key, 4);
    a.line(sx, sy, ex, ey, c, 3);                      // sleeve
    a.line(sx, sy, ex, ey, hi, 1);                     // lit core down the middle of it
    a.line(ex, ey, hx, hy, far ? '#7a4632' : pal.skinSh, 3);
    a.line(ex, ey, hx, hy, sk, 2);                     // bare forearm
    a.line(ex, ey, hx, hy, skh, 1);
    /* The fist hangs at belt height and the belt is brown leather, so the
       far glove used to be the same value as the strap behind it and read as
       a satchel slung at the hip. A lighter leather plus a hard cuff line
       above the knuckles is enough; a full keyline ring just made the hand a
       five-pixel brick. */
    /* A fist is knuckles over a tapered heel, not a 3x3 square, and the cuff
       is a short band ACROSS the wrist. A full-width dark bar under a full
       square simply stacked two bricks on the end of the arm. */
    const cw = Math.round(hx - Math.cos(ha) * 1.7), cv = Math.round(hy - Math.sin(ha) * 1.7);
    const nx = Math.round(-Math.sin(ha)), ny = Math.round(Math.cos(ha));
    a.px(cw, cv, '#2a140e');
    a.px(cw + nx, cv + ny, '#2a140e');
    a.rect(hx - 1, hy - 1, hx + 1, hy, g);             // knuckles
    a.rect(hx - 1, hy + 1, hx, hy + 1, pal.gloveSh);   // heel of the hand
    a.px(hx - 1, hy - 1, far ? '#c06848' : '#e07a5a'); // lit knuckle
    if (hand) hand(a, hx, hy);
  }

  /* Profile head, built row by row — a profile is not an ellipse. The brow
     stands proud of the socket, the nose breaks the front edge and the jaw
     tucks back under it. The old head was a flat peach square under a flat
     orange square with one big eye floating between them.
     Occupies cy-5..cy+3, so cy must stay >= 6 for the outline to close. */
  function head(a, cx, cy, pal, faceX, eye) {
    const f = faceX, L = x => cx + x * f;
    a.rect(L(-3), cy - 2, L(4), cy - 2, pal.skin);                 // forehead
    a.rect(L(-4), cy - 1, L(4), cy + 1, pal.skin);                 // brow to nose
    a.rect(L(-3), cy + 2, L(3), cy + 2, pal.skin);                 // upper lip
    a.rect(L(-2), cy + 3, L(3), cy + 3, pal.skin);                 // jaw
    a.px(L(5), cy, pal.skin);                                      // bridge of the nose
    a.px(L(5), cy + 1, pal.skin);                                  // tip
    a.rect(L(-4), cy - 1, L(-3), cy + 1, pal.skinSh);              // back of the skull
    a.rect(L(-2), cy + 2, L(0), cy + 3, pal.skinSh);               // shadowed side of the jaw
    a.px(L(4), cy + 2, pal.skinSh);                                // under the nose
    a.rect(L(1), cy - 2, L(4), cy - 2, pal.skinHi);                // forehead catches the light
    a.rect(L(1), cy + 2, L(2), cy + 2, pal.lip);                   // mouth
    a.px(L(-1), cy, pal.skinSh);                                   // ear
    a.px(L(-1), cy + 1, pal.skinSh);
    /* Hair: a cap that sweeps back to a point, with a fringe over the brow.
       A squared-off block across the forehead is the single most reliable way
       to make a pixel head look like a Lego brick. */
    a.rect(L(-3), cy - 5, L(2), cy - 5, pal.hair);
    a.rect(L(-4), cy - 4, L(4), cy - 3, pal.hair);
    a.rect(L(-4), cy - 2, L(-2), cy + 1, pal.hair);                // it falls over the ear
    a.px(L(4), cy - 2, pal.hair);                                  // fringe point on the brow
    a.rect(L(-3), cy - 5, L(0), cy - 5, pal.hairHi);
    a.rect(L(-4), cy - 4, L(1), cy - 4, pal.hairHi);
    a.rect(L(-4), cy - 1, L(-3), cy + 1, pal.hairSh);              // nape in shadow
    a.px(L(3), cy - 3, pal.hairSh);
    const ex = L(2);
    if (eye === 'shut') { a.rect(ex - 1, cy, ex + 1, cy, OUT); a.px(ex - 1, cy - 1, pal.skinSh); }
    else if (eye === 'hurt') { a.px(ex - 1, cy - 1, OUT); a.px(ex + 1, cy - 1, OUT); a.px(ex, cy, OUT); a.px(ex - 1, cy + 1, OUT); a.px(ex + 1, cy + 1, OUT); }
    else {
      a.rect(ex, cy - 1, ex + 1, cy, OUT);                         // socket
      a.px(ex + 1, cy - 1, '#ffffff');
      a.rect(ex - 1, cy - 2, ex + 1, cy - 2, pal.skinSh);          // brow ridge over it
    }
  }

  /* Shoulders wide, waist narrow, a hard leather belt between shirt and
     trousers. The torso used to be one flat capsule whose highlight and
     shadow were both buried inside the silhouette. Spans hip-11..hip-1. */
  function torso(a, cx, hip, pal, lean) {
    const s = Math.round(lean), x = cx + s, t = hip - 11;
    a.rect(x - 1, t, x + 2, t + 1, pal.skinSh);                    // neck
    a.rect(x - 4, t + 2, x + 4, t + 6, pal.shirt);                 // shoulders and chest
    a.rect(x - 3, t + 7, x + 3, t + 8, pal.shirt);                 // waist
    a.rect(x - 4, t + 2, x - 3, t + 8, pal.shirtSh);               // back in shadow
    a.rect(x + 3, t + 3, x + 4, t + 6, pal.shirtHi);               // chest edge catches the light
    a.rect(x - 1, t + 2, x + 2, t + 2, pal.shirtHi);               // top of the shoulder
    a.rect(x - 3, t + 2, x + 3, t + 2, pal.scarf);                 // the scarf wraps the collar
    a.rect(x - 3, t + 3, x + 1, t + 3, pal.scarfSh);
    a.rect(x - 3, t + 9, x + 3, t + 9, pal.belt);
    a.rect(x - 3, t + 9, x - 1, t + 9, pal.beltHi);
    a.rect(x + 1, t + 9, x + 2, t + 9, pal.buckle);
    a.rect(x - 3, t + 10, x + 3, t + 10, pal.pants);               // hips
    a.rect(x - 3, t + 10, x - 2, t + 10, pal.pantsSh);
  }

  /* The trailing scarf: the hero's whole read at 32px. Drawn as a CHAIN of
     line segments — the old version stepped one pixel left per sample and let
     the sine jump two rows between them, so the tail came out as a dotted
     curve full of holes that the outline pass then rimmed one speck at a
     time. It also drifted a row lower every step, which is how a scarf ends
     up hanging at hip height looking like a banana. It streams BACKWARD. */
  function scarf(a, x, y, t, amp, pal, len = 8) {
    /* Standing still it DRAPES; running it streams. The old one always shot
       straight out to the left whatever the hero was doing, which is why the
       idle pose had a yellow wing bolted to its shoulder. */
    const dx = Math.min(1, 0.22 + amp * 0.32), dy = 1 - dx * 0.86;
    let px = x, py = y;
    for (let i = 1; i <= len; i++) {
      const k = i / len;
      const nx = Math.round(x - i * dx);
      const ny = Math.round(y + i * dy + Math.sin(t * TAU + k * 3.6) * (0.5 + amp * k * 0.8));
      /* Taper in three steps. A cloth that is two pixels wide for half its
         length and then stops square reads as a sock nailed to the collar. */
      /* The 3px root only when the cloth DRAPES. Streaming flat at collar
         height it merged with the collar wrap and gave the hero a yellow
         yoke across both shoulders. */
      const w = k < 0.3 ? (dy > 0.45 ? 3 : 2) : k < 0.62 ? 2 : 1;
      a.line(px, py, nx, ny, k > 0.55 ? pal.scarfSh : pal.scarf, w);
      if (w === 3) a.line(px, py - 1, nx, ny - 1, pal.scarf, 1);   // lit top fold
      if (k > 0.62) a.px(nx, ny + 1, pal.scarfSh);                 // the underside in shadow
      px = nx; py = ny;
    }
    a.px(px - 1, py, pal.scarfSh);                                 // frayed tip
  }

  /* A sword is a taper, a guard ACROSS the blade and a pommel behind the
     fist. The old one was a 2px grey line with an axis-aligned 5x3 brick
     stuck on the hand, which read as a spanner whatever the arm was doing. */
  function sword(a, hx, hy, ang, len) {
    const c = Math.cos(ang), s = Math.sin(ang);
    const tx = hx + c * len, ty = hy + s * len;
    const mx = hx + c * len * 0.55, my = hy + s * len * 0.55;
    const gx = hx + c * 2, gy = hy + s * 2;
    a.line(hx, hy, tx, ty, '#8b9bb4', 2);                          // blade
    a.line(hx, hy, mx, my, '#8b9bb4', 3);                          // forte, thicker
    a.line(hx, hy, tx, ty, '#c0cbdc', 1);                          // lit edge
    a.line(gx + s * 2, gy - c * 2, gx - s * 2, gy + c * 2, '#b08d1e', 2);  // crossguard
    a.line(gx + s * 2, gy - c * 2, gx - s * 2, gy + c * 2, '#e8c547', 1);
    a.rect(hx - c * 2 - 1, hy - s * 2 - 1, hx - c * 2, hy - s * 2, '#b08d1e');  // pommel
    a.px(tx, ty, '#ffffff');                                       // point
  }
  /* The slash used to plant its point through the floor and off the canvas on
     the follow-through, because the blade length was a constant while the
     fist travelled. Shorten the blade until the tip is inside the frame. */
  function swordFit(a, hx, hy, ang, len) {
    const c = Math.cos(ang), s = Math.sin(ang);
    let L = len;
    while (L > 5 && (hx + c * L < 2 || hx + c * L > 29 || hy + s * L < 2 || hy + s * L > 28)) L -= 1;
    sword(a, hx, hy, ang, L);
  }

  /* Frames 1 and 2 of a slash do not show a sword. At fourteen frames a
     second the blade is a blur, and a 5px stub (which is all that fits once
     the fist has travelled to x26) reads as the hero waving a butter knife.
     A crescent swept about the SHOULDER is what sells the speed — and it is
     centred on the pivot, so the fist always lands inside it and the arc is
     never a detached island for the outline pass to rim. */
  function slashArc(a, cx, cy, a1, a2, r1, core, edge) {
    const n = 24;
    for (let k = 0; k <= n; k++) {
      const u = k / n, ang = a1 + (a2 - a1) * u;
      const c = Math.cos(ang), s = Math.sin(ang);
      const th = 1 + 2.2 * Math.sin(u * Math.PI);                  // thickest mid-sweep
      a.line(cx + c * (r1 - th), cy + s * (r1 - th), cx + c * r1, cy + s * r1, edge, 1);
      a.px(cx + c * r1, cy + s * r1, core);                        // bright leading edge
      if (u > 0.6) a.px(cx + c * (r1 - 1), cy + s * (r1 - 1), core);
    }
  }
  /* Just the furniture: guard, grip and pommel, with the blade lost in the
     blur. Keeps the hand from being a bare glove mid-swing. */
  function hilt(a, hx, hy, ang) {
    const c = Math.cos(ang), s = Math.sin(ang);
    const gx = hx + c * 2, gy = hy + s * 2;
    a.line(hx, hy, hx + c * 4, hy + s * 4, '#c0cbdc', 2);
    a.line(gx + s * 2, gy - c * 2, gx - s * 2, gy + c * 2, '#b08d1e', 2);
    a.line(gx + s * 2, gy - c * 2, gx - s * 2, gy + c * 2, '#e8c547', 1);
    a.rect(hx - c * 2 - 1, hy - s * 2 - 1, hx - c * 2, hy - s * 2, '#b08d1e');
  }

  function heroSuite() {
    const p = HERO;
    const body = (a, t, opts) => {
      const o = opts || {};
      /* The rig spans hip-16 (hair) to hip+7 (sole), so hip must stay >= 17
         or the head clips the top of the frame and the outline cannot close. */
      const hip = o.hip === undefined ? 20 : o.hip;
      const lean = o.lean || 0;
      const s = Math.round(lean);
      leg(a, 16 + s - 1, hip, o.legB, p, true, o.tuck);
      arm(a, 16 + s - 3, hip - 8, o.armB, p, true, o.handB);
      // The scarf leaves the BACK of the collar, never the jaw: two rows up
      // and it crosses the face on every frame that has any lean at all.
      scarf(a, 13 + s, hip - 8, t, o.wind === undefined ? 0.6 : o.wind, p, o.scarfLen);
      torso(a, 16, hip, p, lean);
      head(a, 16 + s + 1, hip - 14, p, 1, o.eye);
      leg(a, 16 + s + 1, hip, o.legA, p, false, o.tuck);
      arm(a, 16 + s + 4, hip - 8, o.armA, p, false, o.handA);
    };
    return {
      width: 32, height: 32, name: 'Platform Hero',
      layers: [{ name: 'hero' }],
      states: [
        // idle: a 1px breath on the torso, scarf drifting — never frozen.
        // The stance is contrapposto: the two legs must not share a column.
        D('idle', 6, true, cyc(4, 6, (a, i, t) => {
          const b = [0, 1, 1, 0][i];                 // a breath, and hip stays >= 20
          body(a, t, { hip: 20 + b, legA: 1.40 + b * 0.05, legB: 1.80, armA: 1.22 + b * 0.12, armB: 1.8, wind: 0.7 });
        })),
        D('run', 12, true, cyc(8, 12, (a, i) => {
          const ph = (i / 8) * TAU;
          body(a, i / 8, {
            // Lowest as the body passes over a planted foot, highest at the
            // two heel strikes — the half-period the old (i % 2) bob missed.
            hip: 20 + Math.round(Math.abs(Math.sin(ph))), lean: 2.2, tuck: 1,
            legA: 1.57 + Math.sin(ph) * 1.25, legB: 1.57 + Math.sin(ph + Math.PI) * 1.25,
            armA: 1.5 - Math.sin(ph) * 0.95, armB: 1.5 - Math.sin(ph + Math.PI) * 0.95, wind: 2.1
          });
        })),
        // jump: one rise + apex, no ground contact expected (AIRBORNE state)
        D('jump', 10, false, seq(4, 10, (a, i, t) => {
          // The engine translates a jumping sprite; the frame itself only
          // tucks the legs and throws the arms up, so nothing leaves the canvas.
          /* Arms thrown UP used to be armA ~ -2 rad, which sweeps the fist
             straight across a head whose centre is three pixels behind the
             shoulder: every airborne frame had a skin-coloured mitten parked
             on the hero's face. One arm reaches forward, the other trails. */
          body(a, t, { hip: 21 - i * 0.3, lean: 0.6, tuck: 1, legA: 2.5 - t * 1.0, legB: 1.15 + t * 0.5,
            armA: -0.6 + t * 0.3, armB: 2.6 - t * 0.35, wind: 2.6, scarfLen: 9 });
        })),
        D('fall', 8, true, cyc(3, 8, (a, i, t) => {
          body(a, t, { hip: 20 + i * 0.4, lean: -0.6, tuck: 1, legA: 1.2 + i * 0.25, legB: 2.3 - i * 0.2,
            // The far arm stays BELOW the streaming scarf: raised up-and-back
            // it sat in the cloth's lane, the scarf painted over the sleeve and
            // left the glove hanging in space.
            armA: -1.0 + i * 0.12, armB: 2.5 + i * 0.18, wind: 3.0, scarfLen: 10 });
        })),
        // land: a hard squash that recovers — the frame that sells weight.
        // The dust is drawn as WEDGES: loose single pixels get rimmed into
        // little bordered bricks by the outline pass and read as gravel.
        D('land', 14, false, seq(3, 14, (a, i, t) => {
          const sq = [3, 1, 0][i];
          body(a, t, { hip: 20 + sq * 0.5, legA: 2.2 - t * 0.9, legB: 0.95 + t * 0.9,
            armA: 1.0 - t * 0.25, armB: 2.25 + t * 0.2, wind: 1.4 });
          /* Dust as a plume that HUGS the ground and starts at the boot, not
             a scatter of loose specks. Anything detached gets its own 1px
             border from the outline pass, so the first two attempts read as
             gravel and then as grey teeth. One connected arc per side, two
             pixels thick, fading as it settles. */
          const reach = [9, 6, 4][i];
          for (const sg of [-1, 1]) {
            for (let k = 2; k <= reach; k++) {
              const X = 16 + sg * k;
              const top = 27 - Math.round(Math.sin((k - 1) / reach * Math.PI) * 2.8);
              a.rect(X, top, X, Math.min(27, top + 1), k > reach - 2 ? '#6d635c' : (k < 4 ? '#8a8078' : '#c8c3bc'));
            }
          }
        })),
        // attack: wind-up, slash arc, recover
        D('attack', 14, false, seq(4, 14, (a, i, t) => {
          // Wind-up stops at -0.8rad with a shortened blade: a full overhead
          // raise puts the sword tip on row 0, where the outline cannot close.
          // The recovery stops at 1.1rad for the same reason at the bottom —
          // the old 1.5 drove the point through the floor and off the canvas.
          const sw = [0.45, -0.3, 0.55, 1.05][i];
          body(a, t, { hip: 20, lean: 0.4, legA: 2.25, legB: 0.95, armB: 2.0, wind: 1.8,
            armA: sw, handA: (ap, hx, hy) => {
              if (i === 0) swordFit(ap, hx, hy, -1.45, 10);       // raised, before the swing
              else if (i === 3) swordFit(ap, hx, hy, 1.45, 9);    // planted low, after it
              else hilt(ap, hx, hy, i === 1 ? -0.9 : 0.8);
            } });
          // Pivoted on the shoulder, starting past the nose: swept from the
          // torso centre the crescent laid a white wedge across the hero's face.
          if (i === 1) slashArc(a, 20, 12, -0.95, 0.35, 11, '#ffffff', '#c0cbdc');
          if (i === 2) slashArc(a, 20, 12, 0.2, 1.45, 11, '#dfe6f2', '#8b9bb4');
        })),
        D('hurt', 10, false, seq(3, 10, (a, i, t) => {
          body(a, t, { hip: 20 + i * 0.6, lean: -1.6, legA: 2.4 - i * 0.2, legB: 1.0 + i * 0.2,
            armA: -0.35 - i * 0.12, armB: 2.55 + i * 0.14, eye: 'hurt', wind: 2.4 });
          // Impact chevrons stacking away from the blow, kept inside the frame
          // so the outline pass can close around the outermost one.
          for (let k = 0; k < 3 - i; k++) {
            const d = 2 + k * 3;
            a.line(19 + d, 10 - d, 21 + d, 12 - d, '#e43b44', 1);
            a.line(21 + d, 12 - d, 19 + d, 14 - d, '#e43b44', 1);
          }
        }))
      ]
    };
  }

  /* ============================================================== SLIME ===
     A slime is a lens of translucent gel, not a green ball with a face. Four
     things make it read as jelly instead of a painted rock, and the old
     three-ellipse version had none of them: light WRAPS the top edge, it
     passes THROUGH the body and pools as a bright caustic just above the
     floor, the mass settles darkest where it is heaviest, and the nucleus
     floats low and soft-edged so the surface reads as something you can see
     into. The rest is squash: every silhouette in the pack is one (rx, ry). */
  const SLIME = {
    base: '#3fbf52', mid: '#6fe07d', hi: '#9dff8f', rim: '#d8ffc0',
    sh: '#1f6b34', pool: '#15492a', glow: '#7ae86a',
    nuc: '#e8ff5a', nucSh: '#9ac41e'
  };

  /* Bands are stacked bottom-up and each one is full-width where it needs to
     overwrite the band below -- there is no erase primitive, so the order IS
     the shading. `lean` slides the sheen so a wobble is visible even when the
     silhouette barely changes between two frames. */
  function slimeBody(a, cx, cy, rx, ry, p, nuc, lean) {
    const R = Math.max(1, Math.round(rx)), Y = Math.max(1, Math.round(ry));
    const ln = lean || 0;
    a.ellipse(cx - R, cy - Y, cx + R, cy + Y, p.base, true);
    rimArc(a, cx, cy, R, Y, -2.95, -0.95, p.rim);                   // light over the top edge
    const pool = Math.max(1, Math.round(Y * 1.15));
    a.ellipse(cx - R, cy + Y - pool, cx + R, cy + Y, p.sh, true);   // the mass settles and darkens
    if (Y >= 3) {
      a.ellipse(cx - R + 2, cy + Y - 2, cx + R - 2, cy + Y - 1, p.glow, true);  // light coming through it
      a.ellipse(cx - R + 1, cy + Y, cx + R - 1, cy + Y, p.pool, true);          // contact shadow
    }
    // Sheen: a soft mid ring with a hard bright core inside it, up and left.
    const hx = cx - Math.round(R * 0.45) + ln, hy = cy - Math.round(Y * 0.45);
    a.ellipse(hx - R * 0.5, hy - Y * 0.45, hx + R * 0.34, hy + Y * 0.3, p.mid, true);
    a.ellipse(hx - R * 0.34, hy - Y * 0.32, hx + R * 0.16, hy + Y * 0.12, p.hi, true);
    a.px(hx - Math.round(R * 0.2), hy - Math.round(Y * 0.22), '#ffffff');
    a.px(hx - Math.round(R * 0.2) + 1, hy - Math.round(Y * 0.22), '#ffffff');
    /* The core sits LOW in the body. Level with the eyes it reads as a beak,
       which is how a slime turns into a duck. Soft-edged, so it looks
       suspended in the gel rather than painted on the front of it. */
    if (nuc) {
      a.ellipse(nuc[0] - 2, nuc[1] - 1, nuc[0] + 2, nuc[1] + 1, p.nucSh, true);
      a.ellipse(nuc[0] - 1, nuc[1] - 1, nuc[0] + 1, nuc[1], p.nuc, true);
      a.px(nuc[0] - 1, nuc[1] - 1, '#ffffff');
    }
  }

  /* Eyes are a white sclera with a PUPIL that tracks the hop, not two dark
     slabs with a white corner. `look` slides the pupil; that alone is the
     difference between a creature and a beanbag. */
  function slimeFace(a, cx, cy, mood, look) {
    const lx = Math.round(look || 0);
    if (mood === 'hurt') {
      for (const sg of [-1, 1]) {
        const ex = cx + sg * 3;
        a.line(ex - 1, cy - 1, ex + 1, cy + 1, OUT, 1);
        a.line(ex + 1, cy - 1, ex - 1, cy + 1, OUT, 1);
      }
      a.ellipse(cx - 2, cy + 3, cx + 2, cy + 5, OUT, true);          // an open wail
      a.rect(cx - 1, cy + 4, cx + 1, cy + 5, '#7a2038');
      return;
    }
    for (const sg of [-1, 1]) {
      const ex = cx + sg * 3;
      a.rect(ex - 1, cy - 1, ex + 1, cy, '#ffffff');
      a.rect(ex - 1, cy - 2, ex + 1, cy - 2, OUT);                   // brow ridge
      a.rect(ex + lx, cy - 1, ex + lx, cy, OUT);                     // pupil
      a.px(ex - 1, cy - 1, '#dff5ff');
    }
    /* Mouth in the outline colour: a dark-green mouth on a green body is
       invisible at 1x, which is the size this sprite will actually be seen
       at. The corners hook up so it is a grin and not a slot. */
    if (mood === 'open') {
      a.ellipse(cx - 3, cy + 2, cx + 3, cy + 5, OUT, true);
      a.rect(cx - 2, cy + 4, cx + 2, cy + 5, '#2f8f46');
      a.rect(cx - 1, cy + 3, cx + 1, cy + 3, '#ffffff');             // teeth
    } else {
      a.line(cx - 2, cy + 3, cx + 2, cy + 3, OUT, 1);
      a.line(cx - 2, cy + 4, cx + 2, cy + 4, '#2f8f46', 1);          // a lower lip catches light
      a.px(cx - 3, cy + 2, OUT); a.px(cx + 3, cy + 2, OUT);
    }
  }

  /* A spat glob: a rimmed bead with a tail, so it reads as travelling even in
     a still frame. Detached from the body on purpose -- it is a projectile. */
  function slimeGlob(a, x, y, r, p, dx, dy) {
    a.ellipse(x - r, y - r, x + r, y + r, p.base, true);
    a.ellipse(x - r, y - r, x + r, y + r, p.rim, false);
    a.px(x - r + 1, y - r + 1, '#ffffff');
    a.line(x - dx, y - dy, x - dx * 2.2, y - dy * 2.2, p.sh, 1);     // the tail it left
  }

  function slimeSuite() {
    const p = SLIME;
    const at = (a, cx, cy, rx, ry, mood, look, lean) => {
      /* Off to one side, not centred under the mouth. A big symmetrical
         yellow lens sitting on the chin reads as a bib, which is what the
         old one did on every idle frame. */
      slimeBody(a, cx, cy, rx, ry, p, [cx + 3, cy + Math.max(2, Math.round(ry) - 2)], lean);
      slimeFace(a, cx, cy - 2, mood, look);
    };
    return {
      width: 32, height: 32, name: 'Slime Hopper', layers: [{ name: 'slime' }],
      states: [
        // idle: the gel breathes and the sheen slides across it; the pupils
        // drift. A slime that holds a single silhouette is a rock.
        D('idle', 6, true, cyc(4, 6, (a, i, t) => {
          const w = Math.sin(t * TAU) * 1.3;
          at(a, 16, 21 - w * 0.5, 8 + w, 6 - w, i === 2 ? 'open' : null, [-1, 0, 1, 0][i], [0, 1, 1, 0][i]);
        })),
        // hop: compress, launch, apex, land — AIRBORNE, so the gate exempts it
        D('hop', 10, true, cyc(6, 10, (a, i) => {
          //     rx    ry   bottom  look
          // Apex heights are capped so the stretched silhouette still leaves
          // row 0 clear -- the outline pass needs a row above the sprite.
          const pose = [[9.5, 4, 27, 0], [7, 7, 26, -1], [5.5, 9, 21, -1], [6.5, 7.5, 17, 0], [7.5, 6.5, 20, 1], [10, 4, 27, 1]][i];
          at(a, 16, pose[2] - pose[1], pose[0], pose[1], i === 2 || i === 3 ? 'open' : null, pose[3], i < 3 ? -1 : 1);
          // Launch and landing both throw gel sideways along the floor.
          if (i === 1 || i === 5) for (const sg of [-1, 1])
            for (let k = 0; k < 3; k++) a.px(16 + sg * (pose[0] + 1 + k), 27 - (k === 1 ? 1 : 0), k > 1 ? p.sh : p.glow);
        })),
        // attack: coil, rear back, spit, recoil.
        D('attack', 12, false, seq(4, 12, (a, i, t) => {
          const st = [[9, 5], [7, 8], [10.5, 4.5], [8.5, 5.5]][i];
          at(a, 16 + (i === 1 ? -1 : i === 2 ? 2 : 0), 27 - st[1], st[0], st[1],
            i >= 1 ? 'open' : null, i === 1 ? -1 : 1, i === 1 ? -1 : 1);
          if (i === 2) slimeGlob(a, 27, 14, 2, p, 2, 2);
          if (i === 3) slimeGlob(a, 27, 9, 2, p, 2, 2);
        })),
        D('hurt', 12, false, seq(3, 12, (a, i, t) => {
          at(a, 16 + (i === 1 ? -2 : 1), 27 - (5 + i * 0.4), 9 - i * 0.6, 5 + i * 0.4, 'hurt');
          // Torn-off gel: short teardrops flying outward, not loose dots. A
          // single pixel gets its own 1px border and reads as grit.
          for (let k = 0; k < 4; k++) {
            const ang = 3.9 + k * 0.72, d = 9 + i * 2;
            const X = 16 + Math.cos(ang) * d, Y = 20 + Math.sin(ang) * d;
            a.line(X, Y, X - Math.cos(ang) * 2, Y - Math.sin(ang) * 2, p.sh, 1);
            a.px(X, Y, p.glow);
          }
        })),
        // death: the surface tension gives out and it melts to a puddle that
        // keeps spreading after the nucleus has already gone dull.
        D('die', 9, false, seq(5, 9, (a, i, t) => {
          const ry = 6 - t * 4.6, rx = 8 + t * 3.4;
          slimeBody(a, 16, 27 - Math.max(1, ry), rx, Math.max(1, ry), p,
            t < 0.5 ? [15, 25, p.nuc] : null, 0);
          if (t < 0.55) slimeFace(a, 16, 25 - ry * 0.7, 'hurt');
          // Gel running off the edges of the puddle.
          for (let k = -1; k <= 1; k += 2) for (let j = 0; j < 2; j++) {
            const X = Math.round(16 + k * (rx - 1 - j * 3));
            if (a.hash(X, j, 4) < 0.55 + t * 0.3) a.px(X, 27, p.pool);
          }
          speck(a, 16 - rx, 25, 16 + rx, 27, 4, [p.sh, p.glow], 0.14 + t * 0.18);
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
  const SPIKY = {
    body: '#8a4fd6', mid: '#a76ce8', hi: '#c89ef4', rim: '#e6d0ff',
    sh: '#5a2e96', dk: '#3a1c66', belly: '#7a45c2',
    quill: '#3b1f5c', quillHi: '#8a63c0', quillTip: '#d8c4f0',
    foot: '#f6a03a', footHi: '#ffc76b', footSh: '#a85c14', claw: '#3a1c66'
  };

  /* A quill is a TAPER with a lit spine: three strokes of falling width, a
     highlight down the thick half and a bright tip. Nine lines of constant
     2px width read as whiskers, which is what the old crawler had -- a purple
     ball wearing a wig. */
  function quill(a, cx, cy, ang, r0, r1, p, flare) {
    const c = Math.cos(ang), s = Math.sin(ang);
    const X = d => cx + c * d, Y = d => cy + s * d;
    const R1 = r1 + (flare || 0), L = R1 - r0;
    const seg = (d0, d1, w, col) => a.line(X(d0), Y(d0), X(d1), Y(d1), col, w);
    seg(r0, r0 + L * 0.35, 4, p.quill);
    seg(r0 + L * 0.35, r0 + L * 0.7, 3, p.quill);
    seg(r0 + L * 0.7, R1 - 1, 2, p.quill);
    seg(R1 - 1, R1, 1, p.quill);
    /* Lit spine on the THICK half only. Run it to the tip and the quill goes
       hollow; put a bright pixel on the point and eleven of them become a
       ring of confetti round the sprite, which is exactly what the first
       version looked like. */
    seg(r0 + L * 0.2, r0 + L * 0.6, 1, p.quillHi);
  }

  /* Two toes and a claw, not an orange brick. The foot is the only warm mass
     on the sprite, so its shape is doing real work in the silhouette. */
  function spikyFoot(a, x, y, p, lift) {
    const Y = y - (lift ? 1 : 0);
    a.rect(x, Y, x + 3, Y + 1, p.foot);
    a.rect(x, Y, x + 3, Y, p.footHi);                              // instep
    a.rect(x, Y + 1, x + 3, Y + 1, p.footSh);
    a.px(x, Y + 2, p.footSh); a.px(x + 2, Y + 2, p.footSh);        // toes
    a.px(x + 3, Y + 1, p.claw);                                    // claw
  }

  function spikySuite() {
    const p = SPIKY;
    const at = (a, cx, cy, step, mood, flare) => {
      // Quills first so the body overlaps their roots and they read as
      // growing OUT of it rather than being stapled on.
      // Seven long quills over the back and two short ones at the flanks.
      // Eleven of them at 4px of reach just made a fuzzy halo: a quill has to
      // be longer than the body is deep or it is fur.
      for (let k = 0; k < 7; k++) {
        const ang = Math.PI + (k / 6) * Math.PI;
        // The CENTRE quill is the short one. Longest in the middle and it
        // grows straight out of the forehead, lining up with the eyes.
        quill(a, cx, cy, ang, 4, 10 + Math.abs(k - 3) * 0.7, p, flare);
      }
      for (const sg of [-1, 1]) quill(a, cx, cy, sg > 0 ? 0.42 : Math.PI - 0.42, 4, 9.5, p, (flare || 0) * 0.5);
      a.ellipse(cx - 7, cy - 6, cx + 7, cy + 6, p.body, true);
      rimArc(a, cx, cy, 7, 6, -3.0, -1.1, p.rim);                  // light over the shell
      a.ellipse(cx - 7, cy, cx + 7, cy + 6, p.sh, true);           // the mass below the equator
      a.ellipse(cx - 6, cy + 3, cx + 6, cy + 6, p.dk, true);
      a.ellipse(cx - 4, cy + 2, cx + 4, cy + 5, p.belly, true);    // pale underbelly
      // The lit cap stops ABOVE the eye line. Run it between the eyes and it
      // is brighter than the sclera, so the face reads as three white patches.
      a.ellipse(cx - 6, cy - 6, cx + 2, cy - 2, p.mid, true);      // lit cap
      a.ellipse(cx - 5, cy - 6, cx, cy - 4, p.hi, true);
      a.rect(cx - 4, cy - 5, cx - 3, cy - 5, '#ffffff');           // specular
      if (mood === 'hurt') {
        for (const sg of [-1, 1]) {
          const ex = cx + sg * 4;
          a.line(ex - 1, cy - 3, ex + 1, cy - 1, OUT, 1);
          a.line(ex + 1, cy - 3, ex - 1, cy - 1, OUT, 1);
        }
        a.ellipse(cx - 2, cy + 1, cx + 2, cy + 3, OUT, true);
        a.rect(cx - 1, cy + 2, cx + 1, cy + 3, '#7a2038');
      } else {
        for (const sg of [-1, 1]) {
          const ex = cx + sg * 4;
          a.rect(ex - 1, cy - 3, ex + 1, cy - 2, '#ffffff');
          a.rect(ex + sg, cy - 3, ex + sg, cy - 2, OUT);           // pupil, looking ahead
          // A brow slanting IN toward the nose is the whole expression.
          a.line(ex - sg * 2, cy - 5, ex + sg * 2, cy - 4, OUT, 1);
        }
        a.line(cx - 2, cy, cx + 2, cy, OUT, 1);                    // set jaw
        a.px(cx - 1, cy + 1, '#ffffff'); a.px(cx + 1, cy + 1, '#ffffff');   // fangs
      }
      spikyFoot(a, cx - 6, cy + 5, p, step);
      spikyFoot(a, cx + 3, cy + 5, p, !step);
    };
    return {
      width: 32, height: 32, name: 'Spiky Crawler', layers: [{ name: 'spiky' }],
      states: [
        D('walk', 8, true, cyc(4, 8, (a, i) => at(a, 16, 19 - (i % 2), i % 2 === 0))),
        // idle breathes a full 2px: a 1px bob on a 14px-wide body fell under
        // the gate's 8-pixel minimum delta and read as a frozen sprite.
        D('idle', 5, true, cyc(3, 5, (a, i) => { at(a, 16, [19, 17, 18][i], i === 1);
          a.px(10 - i, 12, '#c08ef0'); a.px(22 + i, 13, '#c08ef0'); })),
        // bristle: every quill grows, so the flare is part of the taper rather
        // than a second set of thin lines laid over the first.
        D('bristle', 12, false, seq(4, 12, (a, i, t) => at(a, 16, 19, i % 2 === 0, null, t * 3.4))),
        D('hurt', 10, false, seq(3, 10, (a, i) => { at(a, 16 + (i === 1 ? -2 : 1), 19 + i, i % 2 === 0, 'hurt');
          // Chevrons, not dots: a lone pixel gets a full 1px border and reads
          // as a crumb rather than as a hit.
          for (let k = 0; k < 3 - i; k++) {
            const d = 2 + k * 3;
            a.line(19 + d, 9 - d, 21 + d, 11 - d, '#e43b44', 1);
            a.line(21 + d, 11 - d, 19 + d, 13 - d, '#e43b44', 1);
          }
        }))
      ]
    };
  }

  /* ============================================================ FLYER ===
     Tagged 'flying' so the ground-contact gate skips it. Wings are two arcs
     whose span is the animation; the body barely moves. */
  const BAT = {
    memb: '#b5443a', membSh: '#7a2a24', membDk: '#511a16', membHi: '#e07a63',
    bone: '#d9a08c', fur: '#4a3a56', furHi: '#7a648c', furDk: '#2a2038',
    ruff: '#9a86ac', muzzle: '#5e4a6c', eye: '#ffd24a', eyeHi: '#fff3b0'
  };
  function flyerSuite() {
    const p = BAT;
    const at = (a, cy, span, mood) => {
      /* Filled membrane with a scalloped trailing edge and darker finger
         struts. Two parallel 2px lines from shoulder to tip read as a plank:
         what makes a wing is the area between a straight leading edge and a
         notched trailing one -- and, at this size, the PANELS between the
         fingers. Each strut gets a lit pixel beside it so the membrane looks
         stretched over a frame instead of painted flat. */
      const reach = Math.round(6 + span * 6), tipY = cy - span * 5;
      const chordAt = f => Math.max(1, Math.round((4 - f * 2.4) + Math.sin(f * Math.PI * 3) * 1.2));
      for (const s of [-1, 1]) {
        for (let d = 0; d <= reach; d++) {
          const f = d / reach, x = 16 + s * (3 + d);
          const lead = Math.round(cy - 1 + (tipY - cy + 1) * f);
          const ch = chordAt(f);
          a.line(x, lead, x, lead + ch, p.memb, 1);
          a.px(x, lead + ch, p.membSh);                            // trailing edge in shadow
          a.px(x, lead, p.bone);                                   // the arm bone runs the leading edge
        }
        for (let k = 1; k < 4; k++) {
          const f = k / 4, x = 16 + s * (3 + Math.round(reach * f));
          const lead = Math.round(cy - 1 + (tipY - cy + 1) * f);
          const ch = chordAt(f);
          a.line(x, lead + 1, x, lead + ch, p.membDk, 1);          // finger
          a.line(x - s, lead + 1, x - s, lead + ch - 1, p.membHi, 1);  // the panel beside it
        }
        // Wrist hook. Placed ON the leading edge so it is never a loose speck.
        const wx = 16 + s * (3 + Math.round(reach * 0.5));
        const wl = Math.round(cy - 1 + (tipY - cy + 1) * 0.5);
        a.px(wx, wl - 1, p.bone);
      }
      a.ellipse(12, cy - 4, 20, cy + 5, p.fur, true);
      rimArc(a, 16, cy + 0.5, 4, 4.5, -2.9, -1.2, p.furHi);        // fur catches the rim
      a.ellipse(12, cy + 1, 20, cy + 5, p.furDk, true);            // belly in shadow
      a.ellipse(13, cy - 4, 18, cy - 1, p.furHi, true);            // lit shoulder
      a.rect(13, cy + 1, 19, cy + 1, p.ruff);                      // fur collar
      a.px(14, cy + 1, p.furDk); a.px(17, cy + 1, p.furDk);        // ...and it is ragged
      for (const s of [-1, 1]) {                                   // ears
        a.line(16 + s * 2, cy - 3, 16 + s * 3, cy - 8, p.fur, 2);
        a.line(16 + s * 2, cy - 3, 16 + s * 3, cy - 7, p.muzzle, 1);
        a.px(16 + s * 3, cy - 8, p.furHi);
      }
      a.ellipse(14, cy - 1, 18, cy + 2, p.muzzle, true);           // snout
      a.px(16, cy, p.furDk); a.px(15, cy, p.furDk);                // nose
      if (mood === 'hurt') {
        a.line(13, cy - 3, 15, cy - 1, OUT, 1); a.line(15, cy - 3, 13, cy - 1, OUT, 1);
        a.line(17, cy - 3, 19, cy - 1, OUT, 1); a.line(19, cy - 3, 17, cy - 1, OUT, 1);
        a.rect(15, cy + 2, 17, cy + 3, OUT);
      } else {
        a.rect(13, cy - 2, 14, cy - 1, p.eye); a.rect(18, cy - 2, 19, cy - 1, p.eye);
        a.px(13, cy - 2, p.eyeHi); a.px(18, cy - 2, p.eyeHi);
        a.px(14, cy - 1, OUT); a.px(18, cy - 1, OUT);              // slit pupils
        a.px(15, cy + 2, '#ffffff'); a.px(17, cy + 2, '#ffffff');  // fangs
      }
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
          for (let k = 0; k < 3 - i; k++) {
            const d = 2 + k * 3;
            a.line(19 + d, 10 - d, 21 + d, 12 - d, '#e43b44', 1);
            a.line(21 + d, 12 - d, 19 + d, 14 - d, '#e43b44', 1);
          }
        }))
      ]
    };
  }

  /* ========================================================= COLLECTABLES ===
     A struck coin is three concentric values -- a rolled edge, a milled
     bevel and a field -- carrying an incuse mark. One flat disc with a bar
     down it was a token, not currency. The spin squashes the width; at 2px
     the coin is edge on and the bevel is the whole sprite. */
  function pickupSuite() {
    const coinFrames = (gold, rim, hiC, dk) => cyc(6, 12, (a, i) => {
      const w = Math.abs(Math.cos((i / 6) * Math.PI)) * 6 + 0.6;
      a.ellipse(16 - w, 12, 16 + w, 24, dk, true);              // rolled edge
      if (w > 2.2) {
        a.ellipse(16 - w + 1, 13, 16 + w - 1, 23, rim, true);   // bevel
        a.ellipse(16 - w + 2, 14, 16 + w - 2, 22, gold, true);  // struck field
        rimArc(a, 16, 18, w - 0.5, 5.5, -2.85, -1.45, hiC);     // key light off the bevel
        if (w > 4.5) {
          // Milling, sampled on the bevel ring so every notch lands on metal
          // rather than beside the silhouette as a loose speck.
          for (let k = 0; k < 14; k++) {
            const ang = (k / 14) * TAU;
            a.px(16 + Math.cos(ang) * (w - 1.3), 18 + Math.sin(ang) * 4.5, k % 2 ? dk : rim);
          }
        }
        const sw = Math.max(1, Math.round(w * 0.45));
        if (i > 3) {                                  // reverse: two struck bars
          a.rect(16 - sw, 17, 16 + sw, 17, dk); a.rect(16 - sw, 19, 16 + sw, 19, dk);
          a.px(16 - sw, 16, hiC); a.px(16 - sw, 18, hiC);
        } else {                                      // obverse: an incuse lozenge
          for (let r = -3; r <= 3; r++) {
            const hw = Math.round((1 - Math.abs(r) / 3.6) * sw);
            a.rect(16 - hw, 18 + r, 16 + hw, 18 + r, dk);
            a.px(16 - hw, 18 + r, r <= 0 ? hiC : gold);   // the lip of the strike
          }
        }
      } else {
        const hw = Math.max(0, Math.round(w) - 1);
        a.rect(16 - hw, 14, 16 + hw, 22, hiC);        // edge-on flash
        a.rect(16 - hw, 12, 16 + hw, 13, rim);
        a.rect(16 - hw, 23, 16 + hw, 24, rim);
      }
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
      // Light the stone from one side. A symmetric ramp reads as a plastic
      // bead; the lit flank is what makes it look cut.
      HW.forEach((hw, r) => a.px(16 - hw, cy - 4 + r, r < 4 ? c2 : c1));
      a.rect(16 - 3, cy - 5, 16 - 1, cy - 5, '#ffffff');
      a.px(16 - 4, cy - 3, '#ffffff');
      // A glint sweeping the facets. The sparkle that used to orbit the stone
      // was a detached pixel, and the outline pass gave it its own border.
      const g = (i + 2) % 6;
      if (g < 4) a.rect(16 + 4 - g, cy - 4 + g, 16 + 4 - g, cy - 3 + g, '#ffffff');
    });
    /* Filled star polygon: 10 alternating vertices, each edge fanned back to
       the centre. Drawing only the spokes (the obvious shortcut) gives a
       starfish, not a star. */
    const starShape = (a, cx, cy, ro, ri, rot, fillC, hiC, edgeC, shC) => {
      const V = [];
      for (let k = 0; k < 10; k++) {
        const ang = rot - Math.PI / 2 + (k / 10) * TAU, r = k % 2 ? ri : ro;
        V.push([cx + Math.cos(ang) * r, cy + Math.sin(ang) * r]);
      }
      for (let k = 0; k < 10; k++) {
        const [x0, y0] = V[k], [x1, y1] = V[(k + 1) % 10];
        for (let q = 0; q <= 8; q++) a.line(cx, cy, x0 + (x1 - x0) * q / 8, y0 + (y1 - y0) * q / 8, fillC, 1);
      }
      /* Every point is a shallow pyramid. Its ridge runs centre -> tip, and
         whether that ridge is lit depends on which way the tip faces the key
         light (upper left) -- lighting all ten the same gave a flat decal. */
      const face = k => { const dx = V[k][0] - cx, dy = V[k][1] - cy; return (-dx - dy) / (Math.hypot(dx, dy) || 1); };
      for (let k = 1; k < 10; k += 2) if (face(k) < 0) a.line(cx, cy, V[k][0], V[k][1], shC, 1);   // valley falling away
      for (let k = 0; k < 10; k += 2) {
        const u = face(k);
        a.line(cx, cy, V[k][0], V[k][1], u > 0.25 ? hiC : u < -0.25 ? shC : fillC, 1);
      }
      for (let k = 0; k < 10; k++) { const [x0, y0] = V[k], [x1, y1] = V[(k + 1) % 10]; a.line(x0, y0, x1, y1, edgeC, 1); }
      a.px(cx - 2, cy - 2, '#ffffff');                                                  // specular off the boss
    };
    return {
      width: 32, height: 32, name: 'Collectables', layers: [{ name: 'pickup' }],
      states: [
        D('coin_gold', 12, true, coinFrames('#f6c33a', '#c9922a', '#fff6c9', '#7a4e0c')),
        D('coin_silver', 12, true, coinFrames('#c9d4e0', '#93a2b5', '#ffffff', '#4e5c6e')),
        D('gem_red', 10, true, gemFrames('#8a1d33', '#e43b44', '#ff9aa2')),
        D('gem_blue', 10, true, gemFrames('#1d4d8a', '#2f8ee0', '#9ad8ff')),
        D('gem_green', 10, true, gemFrames('#1d6a3a', '#3fc46a', '#a4f2b8')),
        // heart pickup: a scale pulse, not a colour blink — reads while moving
        D('heart', 8, true, cyc(4, 8, (a, i, t) => {
          const s = 1 + Math.sin(t * TAU) * 0.1, cy = 18 - Math.round(Math.cos(t * TAU) * 2);
          const rows = [[3, 4, 7, 8], [2, 9], [1, 10], [1, 10], [1, 10], [2, 9], [3, 8], [4, 7], [5, 6]];
          // Three values down the form and a lit left flank on every run: the
          // two-tone version had lobes but no volume under them.
          rows.forEach((sp, dy) => { for (let q = 0; q < sp.length; q += 2) {
            const x0 = 16 - 6 + sp[q] * s, x1 = 16 - 6 + sp[q + 1] * s, y = cy - 5 + dy;
            a.rect(x0, y, x1, y, dy < 2 ? '#e8384f' : dy < 5 ? '#c2283c' : '#8a1830');
            a.px(x0, y, dy < 6 ? '#ff7a8c' : '#c2283c'); } });
          a.rect(16 - 4, cy - 3, 16 - 3, cy - 2, '#ff9aa8');   // gloss on the near lobe
          a.px(16 - 4, cy - 3, '#ffd6dc');
          a.px(16 - 5, cy - 2, '#ffc0c8');
        })),
        D('star', 12, true, cyc(6, 12, (a, i, t) => {
          const cy = 18 + [0, -1, -1, 0, 1, 1][i];
          // One point-to-point turn per loop, so the lit side travels round
          // the star instead of the whole decal sliding sideways.
          starShape(a, 16, cy, 11, 4.6, (i / 6) * (TAU / 5), '#f6c33a', '#fff6c9', '#b07a12', '#c9922a');
        })),
        /* A wire outline of a key barely reads at 32px. Fill the bow solid,
           then punch the ward hole THROUGH it, so the brass has thickness to
           catch light -- and give the shank a spine and a shadowed underside
           instead of one flat bar. */
        D('key', 8, true, cyc(4, 8, (a, i, t) => {
          const b = Math.round(Math.sin(t * TAU) * 2.5), Y = y => y + b, cx = 9, cy = 16;
          a.ellipse(cx - 6, Y(cy - 5), cx + 6, Y(cy + 5), '#7a5a10', true);
          a.ellipse(cx - 5, Y(cy - 4), cx + 5, Y(cy + 4), '#c9a227', true);
          a.ellipse(cx - 4, Y(cy - 3), cx + 4, Y(cy + 3), '#f6d64a', true);
          a.ellipse(cx - 3, Y(cy - 2), cx + 3, Y(cy + 2), '#7a5a10', true);   // ward hole
          a.ellipse(cx - 2, Y(cy - 1), cx + 2, Y(cy + 1), '#3a2a06', true);
          rimArc(a, cx, Y(cy), 5.5, 4.5, -2.9, -1.25, '#fff6c9');
          a.rect(15, Y(14), 27, Y(18), '#7a5a10');
          a.rect(15, Y(14), 27, Y(14), '#fff6c9');                            // spine
          a.rect(15, Y(15), 27, Y(16), '#f6d64a');
          a.rect(15, Y(17), 27, Y(17), '#c9a227');
          a.rect(21, Y(19), 22, Y(22), '#c9a227'); a.rect(21, Y(19), 21, Y(22), '#f6d64a');
          a.rect(25, Y(19), 26, Y(21), '#c9a227'); a.rect(25, Y(19), 25, Y(21), '#f6d64a');
          const ga = (i / 4) * TAU;                                           // glint travelling the bow
          a.px(cx + Math.cos(ga) * 4.6, Y(cy) + Math.sin(ga) * 3.6, '#ffffff');
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
          /* A coil, not a stack of plates. Each turn is a wire slanting down
             across the spring with the near flank lit; the flanks join the
             turns so the whole spring stays one island for the outline pass.
             At a 3px pitch with a 2px wire the turns fused into a slab. */
          const coils = Math.max(2, Math.min(4, Math.round(span / 4)));
          a.rect(8, 26, 23, 27, '#5a6988'); a.rect(8, 26, 23, 26, '#8b9bb4');
          for (let k = 0; k < coils; k++) {
            const y0 = 25 - span * (k / coils), y1 = 25 - span * ((k + 1) / coils);
            // Front half of the turn sweeps left to right and the back half
            // returns behind it, so the wire is one unbroken zigzag chain.
            const fwd = k % 2 === 0, xa = fwd ? 9 : 22, xb = fwd ? 22 : 9;
            a.line(xa, y0, xb, y1, fwd ? '#8b9bb4' : '#3d4a5c', 2);
            if (fwd) a.line(xa, y0 - 1, xb, y1 - 1, '#e4eaf2', 1);
          }
          a.rect(6, top - 4, 25, top, '#c2283c');
          a.rect(6, top - 4, 25, top - 3, '#e43b44');
          a.rect(6, top - 4, 25, top - 4, '#ff7a86');         // lit lip of the pad
          a.rect(6, top, 25, top, '#8a1d33');
          for (let x = 8; x <= 23; x += 3) a.px(x, top - 1, '#8a1d33');   // grip tread
        })),
        D('checkpoint', 8, true, cyc(4, 8, (a, i, t) => {
          a.rect(9, 8, 10, 27, '#8b9bb4'); a.rect(9, 8, 9, 27, '#c0cbdc');
          a.ellipse(7, 25, 13, 27, '#5a6988', true);
          // Swallow tail cut INTO the fly edge as the rows are drawn. There is
          // no erase primitive, so the notch has to be part of the length.
          for (let y = 0; y < 8; y++) {
            const wv = Math.sin(t * TAU + y * 0.5) * 2;
            const cut = Math.max(0, 4 - Math.abs(y - 3.5) * 1.5);
            a.line(11, 9 + y, 22 + wv - cut, 9 + y, y < 4 ? '#3fc46a' : '#1d8a4a');
          }
          // Swallow-tail notch, so the pennant has a silhouette rather than
          // ending in a flat edge, plus a finial the pole can hold up.
          a.rect(11, 9, 11, 16, '#a4f2b8');                    // luff, lit by the sky
          a.ellipse(8, 4, 11, 7, '#e4eaf2', true);             // finial
          a.ellipse(9, 5, 10, 6, '#8b9bb4', true);
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
          // Running lamps sunk INTO the deck. Floating above it they were
          // detached pixels, and the outline pass boxed each one in.
          for (let k = 0; k < 3; k++) {
            const x = 6 + k * 9;
            a.rect(x, y + 2, x + 1, y + 3, k === i % 3 ? '#e4eaf2' : '#3d7fa8');
            a.px(x, y + 2, k === i % 3 ? '#ffffff' : '#7fd4ff');
          }
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
