/* PixelForge Studio — shared character rig.
   The 3/4 humanoid skeleton every character pack animates off, plus the frame
   and drawing helpers that go with it.

   This exists because the second character pack would otherwise have copied
   the first one's rig, and the two would have drifted: a fix to the jaw
   shading or the knee-drop death would have landed in one pack and not the
   other, and the casts would have stopped looking like they came from the same
   world. A palette object plus a few painter hooks is the entire interface —
   `gear` draws headgear, `hand` draws what the near fist is holding, `arm`
   replaces the whole near arm. Everything else is a colour.

   Contract for a palette: skin/skinHi/skinSh, shirt/shirtHi/shirtSh,
   leg/legSh, shoe/shoeSh, belt/beltDark, brow, eye, mouth; optionally
   hair/hairHi/hairSh, vest/vestHi/vestSh, badge/badgeHi, cross/crossHi,
   eyeHi, and gear(api, headCentreY, opts).

   Geometry is fixed so packs interoperate: feet land on y25..27 in a 32x32
   cell, the tallest headgear stops at y1, and the near arm's fist sits at
   (22, hip). Anything hung off the fist therefore lines up across every pack
   that uses this rig. */
window.PF = window.PF || {};
PF.Rig = (() => {
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

  function speck(a, x0, y0, x1, y1, seed, colors, density) {
    const d = density === undefined ? 0.2 : density;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++)
      if (a.hash(x, y, seed) < d) a.px(x, y, colors[Math.floor(a.hash(x, y, seed + 71) * colors.length) % colors.length]);
  }
  /* Filled disc from an explicit radius test. ellipse(...,true) rasterises a
     3x3 to a plus sign and a 9x9 to a rhombus, so anything meant to read as
     round at these sizes has to be plotted by hand. */
  function disc(a, cx, cy, r, c, hi) {
    for (let y = Math.round(cy - r); y <= Math.round(cy + r); y++)
      for (let x = Math.round(cx - r); x <= Math.round(cx + r); x++) {
        const dx = x - cx, dy = y - cy, d = Math.sqrt(dx * dx + dy * dy);
        if (d > r + 0.3) continue;
        a.px(x, y, hi && dx + dy < -r * 0.45 ? hi : c);
      }
  }
  /* =============================================================== CAST ===
     One 3/4 humanoid rig for every human in the pack. Feet land on y25..27 and
     the tallest headgear stops at y1, so the outline pass can always close
     around the sprite — helmets and caps cap out at hy-5 precisely because
     idle's one-pixel breath would otherwise push a hy-6 dome onto row 0. Palette swaps carry the whole cast: a paramedic and a
     corpse animate off the same skeleton, which is what makes them read as
     inhabitants of the same street. */
  function personRig(a, pal, o) {
    const hip = o.hip === undefined ? 20 : o.hip;
    const lift = o.lift || 0, hunch = o.hunch || 0, sw = o.swing || 0;
    const legY = hip + 5, up = Math.round(sw), dn = -up;
    const sh = hip - 11 + lift + hunch;          // shoulder line
    const hy = hip - 13 + lift + hunch * 2;      // head centre

    /* Far limbs are drawn first and two tones darker than the near ones. Two
       tones is the minimum separation at 32px: at one tone the far leg merges
       with the torso and the walk cycle stops reading entirely. */
    const leg = (x, phase, main, dark, shoe, shoeDark) => {
      a.rect(x, hip - 1, x + 2, legY + phase, dark);
      a.rect(x, hip - 1, x, legY + phase, main);
      a.rect(x - 1, legY + phase, x + 2, legY + 2 + phase, shoe);
      a.rect(x - 1, legY + 2 + phase, x + 2, legY + 2 + phase, shoeDark);
    };
    leg(13, up, pal.legSh, pal.legSh, pal.shoeSh, pal.shoeSh);
    // far arm, counter-swinging against the far leg
    a.rect(10, sh + 2, 12, hip - 2 - up, pal.shirtSh);
    a.rect(10, hip - 2 - up, 12, hip - up, pal.skinSh);

    // torso
    a.ellipse(11, sh, 21, hip - 2, pal.shirt, true);
    a.ellipse(12, sh, 20, sh + 3, pal.shirtHi, true);
    a.ellipse(12, hip - 4, 20, hip - 2, pal.shirtSh, true);
    if (pal.vest) {
      /* Armour is a NARROWER slab inside the torso silhouette with its own
         shoulder straps. Painted edge to edge it just recolours the figure and
         stops reading as something worn over clothes. */
      a.rect(13, sh + 2, 19, hip - 3, pal.vest);
      a.rect(13, sh + 2, 19, sh + 2, pal.vestHi);
      a.rect(13, hip - 3, 19, hip - 3, pal.vestSh);
      a.rect(14, sh, 15, sh + 2, pal.vestSh);
      a.rect(17, sh, 18, sh + 2, pal.vestSh);
      a.rect(18, sh + 4, 19, sh + 6, pal.vestSh);   // pouch
    }
    /* Shield, not three loose pixels: an L of yellow on a navy chest reads as
       a lanyard hanging off the shoulder. */
    if (pal.badge) {
      a.rect(12, sh + 4, 13, sh + 5, pal.badge);
      a.px(12, sh + 4, pal.badgeHi || pal.badge);
    }
    if (pal.cross) {
      /* Single-pixel arms. Three-pixel arms across a five-pixel span leave
         only the four corners open and the mark fills in as a red blob. */
      a.rect(16, sh + 3, 16, sh + 7, pal.cross);
      a.rect(14, sh + 5, 18, sh + 5, pal.cross);
      a.px(16, sh + 3, pal.crossHi);
      a.px(14, sh + 5, pal.crossHi);
    }
    // belt with a buckle: two full rows of accent here reads as a skirt
    a.rect(12, hip - 3, 20, hip - 3, pal.belt);
    a.rect(12, hip - 2, 20, hip - 2, pal.beltDark);
    a.rect(15, hip - 3, 17, hip - 2, pal.beltDark);
    a.px(16, hip - 3, pal.belt);

    // ---- head ----
    a.rect(14, hy + 4, 18, hy + 5, pal.skinSh);              // neck
    a.ellipse(12, hy - 4, 20, hy + 4, pal.skin, true);
    a.ellipse(13, hy - 3, 18, hy, pal.skinHi, true);
    /* Cheek and chin shading only. A solid shadow block across the bottom of
       the head merges with the mouth row and every face in the pack grows a
       beard — the centre of the chin has to stay in the base skin tone. */
    a.rect(13, hy + 2, 13, hy + 4, pal.skinSh);
    a.rect(19, hy + 2, 19, hy + 4, pal.skinSh);
    a.rect(14, hy + 4, 18, hy + 4, pal.skinSh);
    a.px(20, hy + 1, pal.skinSh); a.px(12, hy + 1, pal.skinSh);   // ears
    a.rect(13, hy - 1, 19, hy - 1, pal.brow);                 // brow shadow
    a.px(14, hy, pal.eye); a.px(18, hy, pal.eye);
    if (pal.eyeHi) { a.px(15, hy, pal.eyeHi); a.px(19, hy, pal.eyeHi); }
    a.rect(15, hy + 2, 16, hy + 2, pal.mouth);
    if (pal.gear) pal.gear(a, hy, o);
    else {
      /* Crown only. Carried down to hy-1 with sideburns to hy+1 the hair
         swallows the brow and the head reads as a bowl-cut helmet — the
         hairline has to stop two rows clear of the eyes. */
      a.ellipse(12, hy - 5, 20, hy - 2, pal.hair, true);
      a.rect(12, hy - 3, 12, hy, pal.hair);
      a.rect(20, hy - 3, 20, hy, pal.hairSh || pal.hair);
      a.px(13, hy - 2, pal.hair); a.px(19, hy - 2, pal.hairSh || pal.hair);
      a.ellipse(13, hy - 5, 16, hy - 4, pal.hairHi, true);
    }

    // ---- near limbs, drawn over everything ----
    leg(17, dn, pal.leg, pal.legSh, pal.shoe, pal.shoeSh);
    if (o.arm) o.arm(a, sh, hip, up);
    else {
      a.rect(20, sh + 2, 22, hip - 2 + up, pal.shirt);
      a.rect(20, sh + 2, 20, hip - 2 + up, pal.shirtHi);
      a.rect(20, hip - 2 + up, 22, hip + up, pal.skin);
      if (o.hand) o.hand(a, 22, hip + up);
    }
  }
  /* Going down is drawn, not rigged. A 3/4 rig tipped on its side reads as a
     figure standing on a wall, so the last frame is an explicit prone
     silhouette: legs trailing left, torso mass in the middle, head on the
     floor at the right, everything inside the ground band. */
  function prone(a, pal, slump) {
    const y = 24 + slump;
    a.rect(5, y + 1, 13, y + 3, pal.legSh);
    a.rect(5, y + 1, 13, y + 1, pal.leg);
    a.rect(3, y, 6, y + 3, pal.shoe);
    a.rect(3, y + 3, 6, y + 3, pal.shoeSh);
    a.ellipse(11, y - 3, 22, y + 3, pal.shirt, true);
    a.ellipse(12, y - 3, 20, y - 1, pal.shirtHi, true);
    a.rect(13, y + 1, 21, y + 3, pal.shirtSh);
    a.rect(13, y - 1, 20, y, pal.belt);
    a.ellipse(22, y - 4, 28, y + 1, pal.skin, true);
    a.ellipse(23, y - 4, 26, y - 2, pal.skinHi, true);
    a.rect(22, y - 5, 28, y - 3, pal.hair || pal.shirtSh);
    a.px(25, y - 1, pal.eye);
    a.rect(24, y + 1, 26, y + 1, pal.skinSh);
    a.rect(14, y - 2, 19, y - 1, pal.shirtSh);          // trailing arm
    a.rect(7, y - 1, 14, y, pal.shirtSh);
    a.rect(6, y - 1, 8, y + 1, pal.skinSh);
  }
  const hurtState = (pal, hand) => D('hurt', 10, false, seq(3, 10, (a, i) => {
    /* Knockback reads from the pose, not from a colour flash: hips drop, the
       torso pitches back and the near arm flies up and out. */
    personRig(a, pal, {
      hip: 20 + (i === 1 ? 1 : 0), lift: i === 0 ? -1 : 0, swing: 1.4 - i * 0.9, hand,
      arm: (b, sh) => {
        /* Arm flung out to the side, not overhead: a fist at shoulder height
           puts a rifle's stock clean off the top of the buffer. */
        const ax = 24 - i, ay = sh + 1 + i;
        b.line(20, sh + 3, ax, ay, pal.shirt, 2);
        b.line(20, sh + 3, ax, ay, pal.shirtHi, 1);
        b.rect(ax - 1, ay - 1, ax + 1, ay + 1, pal.skin);
        // the weapon stays in the hand: a rifle that blinks out on the hurt
        // frame reads as a dropped weapon that reappears a frame later
        if (hand) hand(b, ax, ay + 1);
      }
    });
  }));
  const downState = (pal, hand) => D('down', 8, false, seq(3, 8, (a, i) => {
    if (i === 0) { personRig(a, pal, { hip: 21, lift: 1, hunch: 1, swing: 1.6, hand }); return; }
    if (i === 1) {
      /* Knee drop. The first cut stacked a filled torso ellipse under a filled
         head ellipse and the two read as a snowman — a body pitching onto one
         knee needs a squared-off back, a visible neck joining head to shoulder,
         and an arm braced on the floor taking the weight. */
      a.rect(9, 24, 19, 27, pal.legSh);                    // trailing shin, flat
      a.rect(9, 24, 19, 24, pal.leg);
      a.rect(6, 24, 10, 27, pal.shoe);
      a.rect(6, 27, 10, 27, pal.shoeSh);
      a.rect(16, 20, 22, 26, pal.leg);                     // lead knee, up
      a.rect(16, 20, 22, 20, pal.legSh);
      a.rect(16, 25, 22, 26, pal.legSh);
      a.rect(19, 25, 24, 27, pal.shoe);
      a.rect(19, 27, 24, 27, pal.shoeSh);
      for (let y = 13; y <= 22; y++) {                     // torso, pitched over
        const ins = (y === 13 || y === 22) ? 1 : 0;
        a.rect(10 + ins, y, 20 - ins, y, y < 15 ? pal.shirtHi : y > 19 ? pal.shirtSh : pal.shirt);
      }
      a.rect(9, 16, 11, 22, pal.shirtSh);                  // far flank in shadow
      a.rect(6, 19, 11, 21, pal.shirtSh);                  // far arm, hanging
      a.rect(5, 20, 8, 23, pal.skinSh);
      a.rect(18, 12, 21, 15, pal.skinSh);                  // neck
      a.ellipse(18, 7, 26, 15, pal.skin, true);            // head, bowed
      a.ellipse(19, 8, 24, 11, pal.skinHi, true);
      a.rect(19, 10, 25, 10, pal.brow);
      a.px(22, 11, pal.eye); a.px(25, 11, pal.eye);
      a.rect(21, 13, 23, 13, pal.mouth);
      /* Headgear is authored against a head centred on x16; offsetApi slides
         the same painter onto the bowed head instead of leaving a helmeted
         trooper bare-headed for one frame of the death. */
      if (pal.gear) pal.gear(P().offsetApi(a, 6, -2), 13, {});
      else {
        a.ellipse(18, 6, 26, 10, pal.hair, true);
        a.rect(18, 8, 18, 12, pal.hair);
        a.ellipse(19, 6, 22, 7, pal.hairHi, true);
      }
      a.rect(19, 15, 22, 18, pal.shirt);                   // near arm, braced
      a.rect(19, 15, 20, 18, pal.shirtHi);
      a.rect(21, 18, 24, 23, pal.shirtSh);
      a.rect(22, 23, 25, 26, pal.skin);
      a.rect(22, 26, 25, 26, pal.skinSh);
      return;
    }
    prone(a, pal, 0);
  }));
  const idleState = (pal, hand, fps) => D('idle', fps || 5, true, cyc(4, fps || 5, (a, i) =>
    personRig(a, pal, { lift: Math.round(Math.sin((i / 4) * TAU)), hand })));
  /* Stride amplitude is a separate argument, NOT part of `extra`: passed
     inside the override object it replaces the per-frame sine outright and the
     run ends up with six frames of identical leg phase. */
  const walkState = (pal, hand, name, fps, amp, extra) => D(name || 'walk', fps || 10, true,
    cyc(6, fps || 10, (a, i) => personRig(a, pal, Object.assign({
      hip: 20 - (i % 2), swing: Math.sin((i / 6) * TAU) * (amp || 2), hand }, extra || {}))));

  return {
    P, D, Fr, ms, OUT, OUT32, finish, draw, seq, cyc, still, TAU,
    speck, disc, person: personRig, prone,
    idleState, walkState, hurtState, downState
  };
})();
