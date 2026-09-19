/* PixelForge Studio — the Forge: characters that were never authored.

   Every other file in js/library/ is a finite list. Someone drew a knight, a
   goblin and a merchant, and the library holds exactly those three. That is
   the ceiling this file removes: the Forge takes a seed and resolves it into a
   complete, fully animated character off the shared rig — palette, headgear,
   held weapon, armour, name — with a swing built for the weapon it actually
   picked. The search space is combinatorial and the seed space is 2^32, so the
   practical answer to "how many characters ship with PixelForge" stops being a
   number.

   Determinism is what makes that useful rather than a novelty. `forge(1234)`
   returns the same fighter on every machine, forever, so a game can store a
   seed instead of a spritesheet and a studio user can send a colleague a
   number. Nothing here calls Math.random.

   The rig contract is in js/library/rig.js: a palette object plus `gear` and
   `hand` painter hooks. This file's whole job is to GENERATE those three
   things and hand them to the same skeleton every authored pack uses, which is
   why a forged fighter walks like a knight rather than like a generated
   thing. */
window.PF = window.PF || {};
PF.Forge = (() => {
  const R = () => PF.Rig;
  const { rng, hashSeed } = PF.Gen;
  const lit = h => R().lit(h), dim = h => R().dim(h), mix = (a, b, t) => R().mix(a, b, t);
  const ramp = (base, n, o) => PF.Palette.ramp(base, n, o);
  const hsl = (h, s, l) => PF.Palette.fromHsl(h, s, l);
  const lumaOf = h => PF.Color.luma(PF.Color.hexToU32(h));

  /* Two parts that TOUCH have to differ in value, not merely in hue. This is
     AGENTS.md rule 10 written as code: a brass helm over a tan face is one
     beige blob at 32px however different the two hexes look side by side in a
     swatch, and a generator that rolls colours independently hits that case
     constantly. Push the newcomer further along the axis it is already on
     until there is a readable gap. */
  function separate(c, from, min) {
    let out = c, guard = 0;
    const dark = lumaOf(out) < lumaOf(from);
    while (Math.abs(lumaOf(out) - lumaOf(from)) < min && guard++ < 14)
      out = dark ? mix(out, 20, 0.16) : mix(out, 255, 0.16);
    return out;
  }

  /* ---- skin ----
     Skin is the one palette slot that is NOT hue-randomised. A uniform random
     hue produces lime-green faces next to magenta ones and the roster reads as
     a colour test rather than a cast, so the pool is curated: six human tones,
     then the fantasy species that players expect to be off-colour. Each entry
     is [base, highlight, shadow] because a two-tone face has no cheekbone. */
  const SKINS = [
    { key: 'pale', kin: 'human', c: ['#f2d3b3', '#ffeed6', '#c79a77'] },
    { key: 'fair', kin: 'human', c: ['#e8b183', '#ffd3a8', '#b87a52'] },
    { key: 'olive', kin: 'human', c: ['#cf9a63', '#eec292', '#9a6a3d'] },
    { key: 'tan', kin: 'human', c: ['#b87a4e', '#dba173', '#83502f'] },
    { key: 'brown', kin: 'human', c: ['#8f5a38', '#b57c52', '#603722'] },
    { key: 'deep', kin: 'human', c: ['#5f3b28', '#855438', '#3d2318'] },
    { key: 'goblin', kin: 'goblin', c: ['#8ab26a', '#b0d18c', '#5a7f44'] },
    { key: 'orcish', kin: 'orc', c: ['#6f9159', '#92b077', '#47603a'] },
    { key: 'grave', kin: 'undead', c: ['#aebbcd', '#dce7f5', '#78869d'] },
    { key: 'ashen', kin: 'undead', c: ['#8d8a9c', '#b5b2c4', '#5c5a6c'] },
    { key: 'fae', kin: 'fae', c: ['#c58fd0', '#e4b9ec', '#8b5c9a'] },
    { key: 'infernal', kin: 'demon', c: ['#c46a5f', '#e59486', '#8b4038'] },
    { key: 'frostborn', kin: 'fae', c: ['#9fc6d8', '#cbe8f3', '#6a8fa4'] }
  ];

  /* Eyes are keyed off kin, not off the seed: a peasant with glowing red eyes
     is not a peasant. The undead and demon rows are the only ones that light
     up, which is precisely what makes them read as undead and demons. */
  const EYES = {
    human: ['#2a1f2c', null], goblin: ['#3a2a10', '#f2c14e'], orc: ['#2c1c10', '#d6893a'],
    undead: ['#0f2430', '#4fe0f0'], fae: ['#2a1540', '#c9a6ff'], demon: ['#2a0d0d', '#ff6a4a']
  };

  /* ---- headgear ----
     Each painter matches the rig's `gear(api, headCentreY, opts)` hook and
     owns the whole scalp: once gear is present the rig skips its own hair, so
     anything that leaves the crown bare has to draw the bare crown itself.

     `hard` marks a metal helm. It gates which classes may roll it — a hedge
     witch in full plate helm is a costume error, not a variant. */
  const GEAR = [
    { key: 'hair', name: 'loose hair', hard: false, paint: (a, hy, p) => {
      /* The rig's own default hair, restated here so `gear` is ALWAYS a
         function. The cloak rides on the gear hook — it is the one hook the
         rig calls between the torso and the near arm, which is exactly where a
         mantle belongs — so a character with no headgear still needs one. */
      a.ellipse(12, hy - 5, 20, hy - 2, p.hair, true);
      a.rect(12, hy - 3, 12, hy, p.hair);
      a.rect(20, hy - 3, 20, hy, p.hairSh);
      a.px(13, hy - 2, p.hair); a.px(19, hy - 2, p.hairSh);
      a.ellipse(13, hy - 5, 16, hy - 4, p.hairHi, true);
    } },
    { key: 'long', name: 'long hair', hard: false, paint: (a, hy, p) => {
      /* Length comes from the SIDE falls, not from a taller cap: raising the
         crown just makes the head bigger. The falls run past the jaw to hy+4,
         which is the row the neck ends on. */
      a.ellipse(12, hy - 5, 20, hy - 2, p.hair, true);
      /* Length hangs on the OUTER column. Two solid slabs pressed against the
         jaw close the face down to a slot and the head reads as a cowl; the
         inner column has to stop at the cheekbone and let the jaw out. */
      a.rect(11, hy - 3, 11, hy + 5, p.hair);
      a.rect(21, hy - 3, 21, hy + 5, dim(p.hairSh));
      a.rect(12, hy - 3, 12, hy + 1, p.hair);
      a.rect(20, hy - 3, 20, hy + 1, p.hairSh);
      a.rect(11, hy + 5, 11, hy + 5, p.hairSh);
      a.ellipse(13, hy - 5, 16, hy - 4, p.hairHi, true);
      a.px(11, hy, p.hairHi); a.px(11, hy + 3, p.hairHi);            // strands catching light
      a.px(21, hy + 1, p.hairSh); a.px(21, hy + 4, p.hairSh);
      a.rect(15, hy - 5, 15, hy - 3, p.hairSh);                      // a parting
      a.px(13, hy - 2, p.hair); a.px(19, hy - 2, p.hairSh);
    } },
    { key: 'topknot', name: 'topknot', hard: false, paint: (a, hy, p) => {
      a.ellipse(12, hy - 4, 20, hy - 2, p.hairSh, true);
      a.rect(12, hy - 3, 12, hy, p.hairSh);
      a.rect(20, hy - 3, 20, hy, p.hairSh);
      a.rect(15, hy - 6, 17, hy - 5, p.hair);                       // the knot itself
      a.px(16, hy - 6, p.hairHi);
      a.rect(13, hy - 4, 19, hy - 4, p.hair);
    } },
    { key: 'hood', name: 'hood', hard: false, paint: (a, hy, p, pal) => {
      /* A hood is the raised collar behind the neck plus a SMALL opening set
         LOW. The first cut opened it from hy-2 down to hy+3 -- six rows, most
         of the face -- and the result read as a bonnet with a hole cut in it
         rather than as a hood with someone inside. Four rows, with the top one
         in shadow, is what puts the face back in a recess.

         The shell then has to stay INSIDE the shoulders. Run out to x11/x21
         with cheek panels five rows deep and a full-width collar under them,
         the hood, the sleeves and the torso are one continuous coloured mass
         from the crown to the belt with a small pale face set in it. */
      a.ellipse(12, hy - 5, 20, hy + 2, p.hoodCloth, true);
      a.ellipse(13, hy - 5, 17, hy - 2, p.hoodHi, true);
      /* CHEEK PANELS. Without cloth running down beside the jaw the shell is a
         bowl resting on a bare head -- a cap, not a hood. One column a side,
         not two: the second one closes the face down to a slot. */
      a.rect(12, hy - 1, 12, hy + 3, p.hoodCloth);
      a.rect(11, hy, 11, hy + 3, p.hoodSh);
      a.rect(20, hy - 1, 20, hy + 3, p.hoodSh);
      a.rect(21, hy, 21, hy + 3, mix(p.hoodCloth, 20, 0.5));
      /* The recess is ONE row of shadow over the base skin tone, not a filled
         block of skinSh. Filled, a deep-skinned character's whole face goes to
         #3d2318 and the hood reads as empty. */
      a.ellipse(13, hy - 1, 19, hy + 3, pal.skin, true);
      a.rect(13, hy - 1, 19, hy - 1, p.hoodSh);              // brow of the recess
      a.rect(13, hy, 14, hy, pal.eye); a.rect(18, hy, 19, hy, pal.eye);
      if (pal.eyeHi) { a.px(13, hy, pal.eyeHi); a.px(18, hy, pal.eyeHi); }
      a.rect(15, hy + 2, 17, hy + 2, pal.mouth);
      a.rect(12, hy + 4, 20, hy + 4, p.hoodCloth);           // collar behind the neck
      a.rect(12, hy + 5, 20, hy + 5, p.hoodSh);
      a.px(12, hy + 4, p.hoodSh); a.px(20, hy + 4, p.hoodSh);
    } },
    { key: 'cap', name: 'soft cap', hard: false, paint: (a, hy, p, pal) => {
      a.ellipse(12, hy - 5, 20, hy - 2, p.hoodCloth, true);
      a.ellipse(13, hy - 5, 17, hy - 4, p.hoodHi, true);
      a.rect(11, hy - 2, 21, hy - 2, p.hoodSh);
      a.rect(13, hy - 1, 19, hy - 1, pal.skin);                      // forehead under the brim
      a.px(20, hy - 5, p.hoodCloth); a.px(21, hy - 4, p.hoodSh);        // slouched point
      a.rect(12, hy - 1, 12, hy, p.hairSh);                          // hair under the brim
      a.rect(20, hy - 1, 20, hy, p.hairSh);
    } },
    { key: 'band', name: 'headband', hard: false, paint: (a, hy, p) => {
      a.ellipse(12, hy - 5, 20, hy - 2, p.hair, true);
      a.rect(12, hy - 3, 12, hy + 1, p.hair);
      a.rect(20, hy - 3, 20, hy + 1, p.hairSh);
      a.ellipse(13, hy - 5, 16, hy - 4, p.hairHi, true);
      a.rect(11, hy - 2, 21, hy - 2, p.hoodCloth);                       // the band
      a.rect(11, hy - 2, 13, hy - 2, p.hoodHi);
      a.rect(11, hy - 1, 12, hy + 2, p.hoodSh);                     // trailing tail
    } },
    { key: 'helm', name: 'nasal helm', hard: true, paint: (a, hy, p) => {
      /* Dome, hard rim, nasal bar. The rim is the load-bearing part: a dome
         shaded with an ordinary one-step shadow is the exact shape of a bowl
         cut, and the only thing that says "metal shell over a head" at this
         size is a black line where the shell ends. The nasal is what says
         which way the head is facing. */
      a.ellipse(11, hy - 5, 21, hy - 1, p.metal, true);
      a.ellipse(12, hy - 5, 17, hy - 3, p.metalHi, true);
      a.rect(11, hy - 2, 21, hy - 2, p.metalHi);                     // rim top light
      a.rect(11, hy - 1, 21, hy - 1, p.rim);
      /* Rivets along the rim. Unbroken, eleven pixels of near-black sitting
         directly on the brow is a bar across the face, and the eyes one row
         under it stop reading at all. */
      for (const rx of [13, 19]) a.px(rx, hy - 1, p.metalHi);
      a.rect(16, hy - 1, 16, hy + 2, p.metal);                       // nasal
      a.px(16, hy + 2, p.rim);
      a.rect(11, hy - 1, 11, hy + 1, p.metalSh);                     // cheek plates
      a.rect(21, hy - 1, 21, hy + 1, p.rim);
    } },
    { key: 'horned', name: 'horned helm', hard: true, paint: (a, hy, p) => {
      a.ellipse(12, hy - 4, 20, hy - 1, p.metal, true);
      a.ellipse(13, hy - 4, 17, hy - 3, p.metalHi, true);
      a.rect(11, hy - 1, 21, hy - 1, p.rim);
      /* Horns sweep UP and OUT from the brow band. Drawn straight up they read
         as antennae; drawn from the crown they float above the helmet. */
      a.px(11, hy - 2, p.horn); a.px(10, hy - 3, p.horn); a.px(10, hy - 4, p.hornHi);
      a.px(21, hy - 2, p.horn); a.px(22, hy - 3, p.horn); a.px(22, hy - 4, p.hornHi);
      a.rect(15, hy - 5, 17, hy - 5, p.metalSh);                     // crest
    } },
    { key: 'crown', name: 'crown', hard: false, paint: (a, hy, p) => {
      a.ellipse(12, hy - 4, 20, hy - 2, p.hair, true);
      a.rect(12, hy - 3, 12, hy, p.hair);
      a.rect(20, hy - 3, 20, hy, p.hairSh);
      a.rect(12, hy - 5, 20, hy - 4, '#d8a92e');                     // band
      a.rect(12, hy - 5, 20, hy - 5, '#f6d873');
      a.px(13, hy - 6, '#f6d873'); a.px(16, hy - 6, '#f6d873'); a.px(19, hy - 6, '#f6d873');
      a.px(16, hy - 4, p.gem);                                       // set stone
    } },
    { key: 'wizhat', name: 'pointed hat', hard: false, paint: (a, hy, p, pal) => {
      /* The cone tapers over three rows and STOPS at hy-6. The first cut went
         to hy-9, which put the tip at y-2 on an idle frame: clipped off the
         top of the buffer, with the outline pass unable to close around what
         was left. Nothing in this generator may reach past hy-6. */
      a.rect(10, hy - 3, 22, hy - 2, p.hoodCloth);
      a.rect(10, hy - 3, 22, hy - 3, p.hoodHi);
      a.rect(10, hy - 2, 22, hy - 2, p.hoodSh);
      a.rect(13, hy - 4, 19, hy - 4, p.hoodCloth);
      a.rect(14, hy - 5, 18, hy - 5, p.hoodCloth);
      a.rect(15, hy - 6, 17, hy - 6, p.hoodCloth);
      a.px(13, hy - 4, p.hoodHi); a.px(15, hy - 6, p.hoodHi);
      a.px(16, hy - 3, p.gem);                                       // hatband stone
      /* Give the forehead back. Brim, brow shadow and eyes stacked on three
         consecutive rows are one dark mass and the hat eats the face. */
      a.rect(13, hy - 1, 19, hy - 1, pal.skin);
      a.rect(12, hy - 1, 12, hy + 1, p.hairSh);
      a.rect(20, hy - 1, 20, hy + 1, p.hairSh);
    } },
    { key: 'horns', name: 'natural horns', hard: false, paint: (a, hy, p, pal) => {
      a.ellipse(12, hy - 5, 20, hy - 2, p.hair, true);
      a.rect(12, hy - 3, 12, hy, p.hair);
      a.rect(20, hy - 3, 20, hy, p.hairSh);
      a.ellipse(13, hy - 5, 16, hy - 4, p.hairHi, true);
      a.px(12, hy - 5, p.horn); a.px(11, hy - 6, p.horn); a.px(11, hy - 7, p.hornHi);
      a.px(20, hy - 5, p.horn); a.px(21, hy - 6, p.horn); a.px(21, hy - 7, p.hornHi);
      a.px(10, hy - 7, pal.skinSh);
    } },
    { key: 'skull', name: 'bare skull', hard: false, paint: (a, hy, p, pal) => {
      /* Undead only. The skull is the head, so it repaints the face: sockets
         instead of eyes and a tooth row instead of a mouth. Drawn as a hat
         over a living face it reads as a mask, which is a different creature. */
      /* Bone, not white. Filled to the edge in #ffffff with three-pixel
         sockets it is a marshmallow with two holes in it, and the cranium,
         the brow and the jaw all disappear into one blob. */
      a.ellipse(12, hy - 5, 20, hy + 2, '#c9b48a', true);
      a.ellipse(12, hy - 5, 19, hy + 1, '#ead4aa', true);
      a.ellipse(13, hy - 5, 17, hy - 2, '#fff6c9', true);            // the dome catching light
      a.rect(12, hy - 1, 20, hy - 1, '#a89873');                     // brow ridge
      a.rect(13, hy, 14, hy + 1, '#1a1622');                         // sockets, sunk under it
      a.rect(18, hy, 19, hy + 1, '#1a1622');
      a.px(13, hy, pal.eyeHi || '#4fe0f0'); a.px(18, hy, pal.eyeHi || '#4fe0f0');
      a.px(16, hy + 1, '#1a1622'); a.px(16, hy + 2, '#a89873');      // nasal cavity
      a.rect(14, hy + 3, 18, hy + 4, '#ead4aa');                     // the jaw
      a.rect(14, hy + 3, 18, hy + 3, '#c9b48a');
      for (let q = 14; q <= 18; q += 2) a.px(q, hy + 3, '#5c4a32');  // tooth gaps
      a.px(12, hy + 1, '#a89873'); a.px(20, hy + 1, '#a89873');      // cheekbones
    } }
  ];

  /* ---- held kit ----
     Every weapon is a painter of (api, fistX, fistY, angle). Taking the angle
     is what lets one definition serve the carry pose AND every frame of the
     swing: the attack state sweeps the same function through an arc instead of
     needing a second hand-drawn weapon per pose.

     `arc` picks the attack choreography. `reach` is in tiles and is carried
     into the descriptor so a game can read a forged fighter's range without
     rendering it. */
  const shaft = (a, x, y, ang, d0, d1, w, col, hi) => {
    const nx = -Math.sin(ang), ny = Math.cos(ang), cx = Math.cos(ang), cy = Math.sin(ang);
    for (let d = d0; d <= d1; d++) {
      const bx = x + cx * d, by = y + cy * d;
      /* Thickness is measured PERPENDICULAR to the shaft. Thickened along x a
         diagonal weapon rasterises into a stepped ribbon, and thickened as a
         square per sample it becomes a chain of blocks — neither survives
         being rotated through an arc. */
      for (let o = -w; o <= w; o++) a.px(Math.round(bx + nx * o), Math.round(by + ny * o), col);
      if (hi) a.px(Math.round(bx - nx * w), Math.round(by - ny * w), hi);
    }
  };
  const tipOf = (x, y, ang, d) => [Math.round(x + Math.cos(ang) * d), Math.round(y + Math.sin(ang) * d)];

  /* Weapon heads are filled in the shaft's OWN frame: u runs along the shaft
     from the fist, v runs perpendicular. The first cut stacked a head out of
     four 1px lines at successive u, which fans into a comb the instant the
     weapon rotates off axis — on screen the axe was a pale blob floating a
     pixel clear of its own haft. A mask filled in (u, v) stays solid at every
     angle in the swing. Rows are [v, uFrom, uTo, bright]. */
  function head(a, x, y, ang, rows, col, hi) {
    const cx = Math.cos(ang), cy = Math.sin(ang), nx = -Math.sin(ang), ny = Math.cos(ang);
    for (const [v, u0, u1, bright] of rows)
      for (let u = u0; u <= u1; u++)
        a.px(Math.round(x + cx * u + nx * v), Math.round(y + cy * u + ny * v), bright ? hi : col);
  }
  /* A wedge: narrow where it sockets onto the haft, widest across the middle,
     bright along the cutting edge. Symmetrical it reads as a labrys and
     centred on the haft it reads as a hammer — both are other weapons. */
  const AXE = [[0, 6, 9, 0], [1, 6, 9, 0], [2, 5, 10, 0], [3, 5, 10, 0], [4, 5, 10, 1], [5, 6, 9, 1]];
  const MAUL = [[-2, 7, 10, 0], [-1, 7, 10, 0], [0, 7, 10, 0], [1, 7, 10, 0], [2, 7, 10, 1]];
  const LEAF = [[-1, 11, 13, 0], [0, 10, 15, 0], [1, 11, 13, 1]];

  const HELD = [
    { key: 'fists', name: 'bare hands', arc: 'punch', reach: 0.9, two: false, paint: null },
    { key: 'sword', name: 'sword', arc: 'swing', reach: 1.5, two: false, paint: (a, x, y, ang, p) => {
      shaft(a, x, y, ang, -2, 0, 0, p.gripSh);                       // grip below the fist
      const [gx, gy] = tipOf(x, y, ang, 0);
      shaft(a, gx, gy, ang + Math.PI / 2, -2, 2, 0, p.steelSh);      // crossguard
      shaft(a, x, y, ang, 2, 10, 1, p.steel, p.steelHi);
      const [tx, ty] = tipOf(x, y, ang, 11);
      a.px(tx, ty, p.steelHi);
      const [px, py] = tipOf(x, y, ang, -3);
      a.px(px, py, p.steel);                                         // pommel
    } },
    { key: 'axe', name: 'battle axe', arc: 'swing', reach: 1.7, two: true, paint: (a, x, y, ang, p) => {
      shaft(a, x, y, ang, -3, 10, 0, p.grip, p.gripHi);
      head(a, x, y, ang, AXE, p.steel, p.steelHi);
      head(a, x, y, ang, [[1, 7, 8, 0]], p.steelSh, p.steelSh);      // socket in shadow
    } },
    { key: 'hammer', name: 'war hammer', arc: 'swing', reach: 1.6, two: true, paint: (a, x, y, ang, p) => {
      shaft(a, x, y, ang, -3, 9, 0, p.grip, p.gripHi);
      head(a, x, y, ang, MAUL, p.steel, p.steelHi);
      head(a, x, y, ang, [[-2, 10, 10, 0], [2, 10, 10, 0]], p.steelSh, p.steelSh);
    } },
    { key: 'spear', name: 'spear', arc: 'thrust', reach: 2.1, two: true, paint: (a, x, y, ang, p) => {
      shaft(a, x, y, ang, -5, 11, 0, p.grip, p.gripHi);
      head(a, x, y, ang, LEAF, p.steel, p.steelHi);                   // leaf-shaped head
      const [tx, ty] = tipOf(x, y, ang, 16);
      a.px(tx, ty, p.steelHi);
    } },
    { key: 'dagger', name: 'dagger', arc: 'swing', reach: 1.1, two: false, paint: (a, x, y, ang, p) => {
      shaft(a, x, y, ang, -2, 0, 0, p.gripSh);
      shaft(a, ...tipOf(x, y, ang, 0), ang + Math.PI / 2, -1, 1, 0, p.steelSh);
      shaft(a, x, y, ang, 1, 5, 0, p.steel, p.steelHi);
      const [tx, ty] = tipOf(x, y, ang, 6);
      a.px(tx, ty, p.steelHi);
    } },
    { key: 'staff', name: 'focus staff', arc: 'cast', reach: 0.9, two: true, paint: (a, x, y, ang, p) => {
      shaft(a, x, y, ang, -6, 9, 0, p.grip, p.gripHi);
      const [ox, oy] = tipOf(x, y, ang, 10);
      /* A sphere, and one that is the light source. Two flat tones make a
         sticker, and a sticker on the end of a stick is a balloon. */
      R().disc(a, ox, oy, 2, p.gem, lit(p.gem));                      // focus stone
      a.px(ox + 1, oy + 1, dim(p.gem)); a.px(ox + 2, oy, dim(p.gem));  // terminator
      a.px(ox - 1, oy - 1, '#ffffff');                                // specular
      for (const [mx, my] of [[-3, -3], [3, -2], [-2, 3]]) {          // and motes off it
        a.px(ox + mx, oy + my, lit(p.gem));
      }
    } },
    { key: 'scythe', name: 'reaping scythe', arc: 'swing', reach: 1.9, two: true, paint: (a, x, y, ang, p) => {
      shaft(a, x, y, ang, -4, 7, 0, p.grip, p.gripHi);
      /* The blade arcs off the tip on the OUTER side of the haft. Swept back
         toward the wielder — which is where a real scythe's blade goes — it
         lands across the chest and the figure reads as carrying a grey sack.
         Radius and haft are both short because a 9px haft plus a 6px blade
         runs off the right edge of a 32px cell. */
      const [hx, hy2] = tipOf(x, y, ang, 7);
      for (let k = 0; k <= 9; k++) {
        const t = k / 9, aa = ang + 1.0 + t * 1.3, r = 4.6 - t * 1.1;
        a.px(Math.round(hx + Math.cos(aa) * r), Math.round(hy2 + Math.sin(aa) * r), p.steelHi);
        a.px(Math.round(hx + Math.cos(aa) * (r - 1)), Math.round(hy2 + Math.sin(aa) * (r - 1)), p.steel);
        a.px(Math.round(hx + Math.cos(aa) * (r - 2)), Math.round(hy2 + Math.sin(aa) * (r - 2)), p.steelSh);
      }
    } },
    { key: 'bow', name: 'short bow', arc: 'shoot', reach: 6.5, two: true, paint: (a, x, y, ang, p) => {
      /* The bow is drawn around the fist, not out from it: the hand grips the
         middle of the stave. The string is the flat chord across the back. */
      const n = ang + Math.PI / 2;
      for (let k = -7; k <= 7; k++) {
        const t = k / 7, bow = (1 - t * t) * 3.4;
        for (let o = 0; o <= 1; o++) {
          const bx = Math.round(x + Math.cos(n) * k + Math.cos(ang) * (bow + o));
          const by = Math.round(y + Math.sin(n) * k + Math.sin(ang) * (bow + o));
          a.px(bx, by, o ? p.grip : p.gripHi);
        }
      }
      shaft(a, x, y, n, -6, 6, 0, p.string);
    } },
    { key: 'torch', name: 'torch', arc: 'swing', reach: 1.2, two: false, paint: (a, x, y, ang, p) => {
      shaft(a, x, y, ang, -2, 5, 0, p.grip, p.gripHi);
      const [fx, fy] = tipOf(x, y, ang, 6);
      a.ellipse(fx - 1, fy - 2, fx + 1, fy + 1, '#e8631f', true);
      a.ellipse(fx - 1, fy - 1, fx, fy, '#f6c341', true);
      a.px(fx, fy - 3, '#ffe9a8');
    } },
    { key: 'lantern', name: 'lantern', arc: 'punch', reach: 0.9, two: false, paint: (a, x, y, ang, p) => {
      /* A lantern HANGS. Swung out on the carry angle it reads as a boxy mace,
         so this one ignores `ang` entirely and drops straight down from the
         fist — the bail is what sells the weight. */
      /* A lamp is the light in the scene it is carried through, so it throws
         one: a flat yellow rectangle in a grey frame is a sticky note. */
      for (const [gx, gy] of [[-3, 3], [3, 3], [-3, 1], [3, 1], [0, 6], [-2, 6], [2, 6]]) {
        a.px(x + gx, y + gy, '#8a6a22');
      }
      a.px(x, y - 1, p.steelSh);                                     // bail
      a.px(x - 1, y - 1, p.steel); a.px(x + 1, y - 1, p.steel);
      a.rect(x - 2, y, x + 2, y + 1, p.steelSh);                     // cap
      a.rect(x - 2, y, x + 2, y, p.steel);
      a.rect(x - 2, y + 2, x + 2, y + 4, '#f6c341');                 // the glazing
      a.rect(x - 1, y + 2, x, y + 4, '#fff1b8');
      a.px(x, y + 3, '#ffffff');                                     // the flame in it
      a.rect(x - 2, y + 2, x - 2, y + 4, p.steelSh);                 // and its frame
      a.rect(x + 2, y + 2, x + 2, y + 4, p.steelSh);
      a.px(x + 1, y + 2, p.steelSh); a.px(x + 1, y + 4, p.steelSh);
      a.rect(x - 2, y + 5, x + 2, y + 5, p.steelSh);      // stops short of the ground line
      a.px(x - 2, y + 5, p.steel);
    } },
    { key: 'tome', name: 'grimoire', arc: 'cast', reach: 0.9, two: false, paint: (a, x, y, ang, p) => {
      /* Boards, a spine and a page block. A coloured square with a dot on it
         is a floor tile someone is holding. */
      a.rect(x - 3, y - 3, x + 2, y + 2, p.cloth);
      a.rect(x - 3, y - 3, x + 2, y - 3, p.clothHi);
      a.rect(x - 3, y + 2, x + 2, y + 2, p.clothSh);
      a.rect(x - 3, y - 3, x - 3, y + 2, p.clothSh);                  // the spine, rolled
      a.rect(x - 2, y - 3, x - 2, y + 2, p.clothHi);
      a.px(x - 3, y - 2, p.clothHi); a.px(x - 3, y + 1, p.clothHi);   // its bands
      a.rect(x + 2, y - 2, x + 2, y + 1, '#e8e2d0');                  // page block
      a.rect(x + 2, y - 2, x + 2, y - 2, '#ffffff');
      a.px(x + 1, y - 3, p.clothSh); a.px(x + 1, y + 2, p.clothSh);   // corner bosses
      a.rect(x, y - 1, x, y + 1, p.gem);                              // and a sigil on the board
      a.rect(x - 1, y, x + 1, y, p.gem);
      a.px(x, y, lit(p.gem));
    } }
  ];

  /* ---- torso kit ----
     Armour, sash and pack are independent rolls because they are independent
     things: a mail shirt over a peasant tunic with a satchel is a perfectly
     ordinary adventurer, and forcing them into one "class" enum is exactly the
     kind of limit this file exists to remove. */
  const ROLE_WEIGHTS = {
    fighter: { gear: ['helm', 'horned', 'band', 'hair', 'topknot', 'crown'], held: ['sword', 'axe', 'hammer', 'spear', 'dagger'], armour: 0.85, cat: 'Heroes' },
    caster:  { gear: ['wizhat', 'hood', 'long', 'crown', 'band'], held: ['staff', 'tome', 'dagger', 'torch'], armour: 0.12, cat: 'Heroes' },
    ranger:  { gear: ['hood', 'cap', 'band', 'long', 'topknot'], held: ['bow', 'dagger', 'sword', 'spear'], armour: 0.35, cat: 'Heroes' },
    brute:   { gear: ['horned', 'helm', 'horns', 'topknot', 'hair'], held: ['axe', 'hammer', 'sword', 'scythe'], armour: 0.6, cat: 'Enemies' },
    undead:  { gear: ['skull', 'hood', 'helm', 'crown'], held: ['scythe', 'sword', 'staff', 'spear', 'dagger'], armour: 0.4, cat: 'Enemies' },
    folk:    { gear: ['cap', 'hair', 'long', 'hood', 'band', 'topknot'], held: ['fists', 'lantern', 'torch', 'tome', 'dagger'], armour: 0.05, cat: 'NPCs' }
  };
  const ROLES = Object.keys(ROLE_WEIGHTS);

  /* ---- naming ----
     A forged character with no name is a row in a table; with one it is
     somebody. Syllables are split by role so a brute is not called Ellisane. */
  const SYL = {
    hard: ['bor', 'grak', 'dun', 'thok', 'mur', 'vasp', 'korn', 'zul', 'drag', 'hald', 'brum', 'skar'],
    soft: ['ael', 'lin', 'sera', 'mira', 'oleth', 'vyn', 'ysa', 'thal', 'eri', 'nym', 'cala', 'sil'],
    tail: ['ar', 'en', 'is', 'oth', 'ux', 'ia', 'orn', 'ek', 'yl', 'an', 'ur', 'esh']
  };
  function nameFor(r, role) {
    const pool = (role === 'caster' || role === 'folk' || role === 'ranger') ? SYL.soft : SYL.hard;
    const s = r.pick(pool) + (r.chance(0.45) ? r.pick(SYL.soft) : '') + r.pick(SYL.tail);
    return s[0].toUpperCase() + s.slice(1);
  }

  /* resolve(seed, opts) -> descriptor
     The descriptor is the whole character as plain data: readable, loggable,
     storable, and enough on its own to rebuild the sprite. Everything below
     this point is rendering. */
  function resolve(seed, opts = {}) {
    const s = typeof seed === 'string' ? hashSeed(seed) : (seed >>> 0);
    const r = rng(s || 1);
    const role = opts.role && ROLE_WEIGHTS[opts.role] ? opts.role : r.pick(ROLES);
    const W = ROLE_WEIGHTS[role];

    /* Species is constrained by role before it is rolled. An "undead" with
       fair human skin and a lantern is a villager, and the roster loses the
       one axis players actually read at 32px: silhouette plus skin. */
    const kinPool = role === 'undead' ? ['undead'] : role === 'brute' ? ['orc', 'goblin', 'demon', 'human']
      : role === 'caster' ? ['human', 'human', 'fae', 'undead'] : ['human', 'human', 'human', 'goblin', 'fae'];
    const kin = opts.kin || r.pick(kinPool);
    const skin = r.pick(SKINS.filter(x => x.kin === kin));
    let [eye, eyeHi] = EYES[kin] || EYES.human;
    /* A dark eye under a darker brow on a deep skin tone is three shades of
       near-black stacked in four rows, and the face reads as a smudge. The
       fix is the one portrait painters use: put the sclera back. Only the rows
       that need it get one, so the pale faces keep their plain dark eyes. */
    if (!eyeHi && lumaOf(skin.c[0]) < 135) eyeHi = '#e6ddc8';

    /* Two hues a fixed angle apart, each expanded with PF.Palette.ramp rather
       than rolled as three independent hexes — a ramp keeps its internal
       contrast, so shirt, highlight and shadow stay recognisably one garment
       under any hue. Rolling the trouser hue independently of the shirt gives
       a costume where nothing agrees with anything; an offset gives a figure
       that looks dressed. Near-complementary for the flashy roles,
       near-analogous for the ones meant to blend in. */
    const h1 = r();
    const spread = role === 'folk' ? 0.06 : role === 'caster' ? 0.5 : 0.22;
    const h2 = h1 + spread * (r.chance(0.5) ? 1 : -1);
    const sat = role === 'folk' ? 0.28 + r() * 0.2 : 0.4 + r() * 0.34;
    /* Lightness is corrected for the HUE's own luma. A yellow and a blue at
       the same HSL lightness are nowhere near the same brightness on screen,
       so a flat lightness roll produces navy characters that read as solid and
       yellow ones that read as a blank highlight with legs. */
    let shirtBase = hsl(h1, sat, 0.44 + r() * 0.12);
    while (lumaOf(shirtBase) > 186) shirtBase = mix(shirtBase, 20, 0.12);
    /* The torso touches the neck and both hands, so it has to clear SKIN as
       well — a green tunic on a goblin is one green column from chin to belt. */
    shirtBase = separate(shirtBase, skin.c[0], 34);
    /* Trousers stay DARKER than the shirt and never get their own lightness
       roll. Rolled freely they come out lavender under a red tunic as often as
       not, and the figure reads as two halves of two different characters. */
    const legBase = hsl(h2, sat * 0.75, 0.24 + r() * 0.08);
    /* range 0.22, not the ramp default of 0.36. At 0.36 the shadow end lands
       within a few points of black and the highlight end within a few of
       white, so every garment in the roster shades identically and the hue
       the ramp was built around survives in one row out of three. */
    /* NOT Palette.ramp here. Its ends drift in hue and bleed saturation, so a
       #58b06d tunic came back with a #aecfaa highlight — grey cloth with a
       green middle. lit/dim hold the hue and only move value, which is what a
       cloth fold actually does. */
    const shirt = shirtBase, shirtHi = mix(shirtBase, 255, 0.24), shirtSh = mix(shirtBase, 20, 0.38);
    /* Trousers sit directly under the tunic with only the belt between them;
       a 2px belt cannot carry the whole torso/leg read on its own. */
    const leg = separate(legBase, shirtBase, 28), legSh = dim(leg);
    const shoe = hsl(0.07, 0.3, 0.2 + r() * 0.08);
    const beltBase = r.chance(0.6) ? hsl(0.08, 0.42, 0.3) : dim(shirtBase);

    /* Hair keeps a narrow, believable band except on the fae and the undead,
       who are allowed to be any colour at all — which is most of what makes
       them read as not-people. */
    const wild = kin === 'fae' || kin === 'undead' || kin === 'demon';
    /* The fae and the undead may take any hair colour at all, which is most of
       what makes them read as not-people — but it still has to clear the face
       it sits on, or a violet elf with violet hair is one lilac oval. */
    const hairBase = separate(
      wild ? hsl(r(), 0.45, 0.45) : hsl(0.06 + r() * 0.06, 0.25 + r() * 0.35, 0.14 + r() * 0.34),
      skin.c[0], 34);
    /* Worn metal and blade metal are drawn from DIFFERENT pools and then held
       apart in value. Sharing one slot is how the first cut produced a fighter
       whose helm, breastplate and sword were all the same brass: three
       separate objects that merged into one beige mass the moment they
       touched. Armour also has to clear the face, since a helm frames it. */
    /* No brass in the helm pool. A warm metal at 32px on any of the human skin
       rows reads as a blonde bowl cut no matter how far apart the two values
       are pushed — the shape of a dome simply is the shape of hair. Cool greys
       and one dark leather-brown only; gold survives as trim on the crown,
       where a band rather than a dome carries it. */
    /* separate() only ever pushes further along the side of the gap it starts
       on, so a dark base against dark skin can bottom out near black. Metal
       that dark stops being metal. */
    let metalBase = separate(r.pick(['#6f7d8c', '#5c6678', '#8d97ab', '#4e5666', '#6a5b4a']), skin.c[0], 52);
    while (lumaOf(metalBase) < 58) metalBase = mix(metalBase, 255, 0.14);
    const steelBase = separate(r.pick(['#b4bccd', '#9aa4b4', '#c8ced9', '#8d97ab']), metalBase, 34);
    const gemBase = hsl(r(), 0.72, 0.6);
    /* A cloak is the only trait here that changes the SILHOUETTE rather than
       the colours, which makes it worth more to the roster than any two
       palette rolls. It hangs off the gear hook — the one the rig calls
       between the torso and the near arm. */
    const cloak = opts.cloak === undefined
      ? r.chance(role === 'caster' ? 0.62 : role === 'folk' ? 0.12 : 0.34) : !!opts.cloak;
    const cloakBase = cloak ? separate(hsl(h1 + 0.5, sat * 0.7, 0.3 + r() * 0.16), shirtBase, 30) : null;

    const gearKey = opts.gear || r.pick(W.gear);
    const heldKey = opts.held || r.pick(W.held);
    const armour = opts.armour === undefined ? r.chance(W.armour) : !!opts.armour;
    /* Armour must clear the shirt it is worn over AND the belt buckled across
       it. Cleared against only one of the two, the dim(shirt) branch lands
       exactly on the dim(shirt) belt and the buckle disappears. */
    /* Plate is a lit surface: pushed below ~62 luma it stops reading as metal
       over cloth and becomes a hole punched through the chest. */
    let armourBase = armour
      ? separate(separate(r.chance(0.55) ? metalBase : dim(shirtBase), shirt, 30), beltBase, 24) : null;
    while (armourBase && lumaOf(armourBase) < 62) armourBase = mix(armourBase, 255, 0.14);

    return {
      seed: s, role, kin, name: opts.name || nameFor(r, role),
      category: opts.category || W.cat,
      gear: gearKey, held: heldKey, armour, cloak,
      reach: (HELD.find(h => h.key === heldKey) || HELD[0]).reach,
      arc: (HELD.find(h => h.key === heldKey) || HELD[0]).arc,
      colors: {
        skin: skin.c[0], skinHi: skin.c[1], skinSh: skin.c[2],
        shirt, shirtHi, shirtSh, leg, legSh,
        shoe, shoeSh: dim(shoe), belt: beltBase, beltDark: dim(beltBase),
        hair: hairBase, hairHi: lit(hairBase), hairSh: dim(hairBase),
        metal: metalBase, steel: steelBase, gem: gemBase, eye, eyeHi,
        hood: separate(dim(shirtBase), shirt, 26),
        armour: armourBase, cloak: cloakBase
      }
    };
  }

  /* A shoulder mantle. It is painted from the gear hook, which the rig calls
     after the torso and head but BEFORE the near arm — so the cloak lies over
     the chest and under the sword arm, which is how a cloak actually sits. The
     side falls run out to x9 and x23, two pixels past the torso on each side,
     and that overhang is the whole point: it is the only trait in the forge
     that changes the outline rather than the colours inside it. */
  function mantle(a, hy, k) {
    const y0 = hy + 3;
    /* The FALLS are the cloak; the yoke is just what holds them on. The first
       cut had a 13px yoke and 6px falls tucked behind the arms, so all that
       showed was a coloured bar across the chest — a bib. Narrow yoke, falls
       that run two pixels wider than the torso and all the way to the hem. */
    a.rect(11, y0, 21, y0, k.capeHi);
    a.rect(11, y0 + 1, 21, y0 + 1, k.cape);
    /* The falls TAPER — narrow at the shoulder, widest at the hem. Drawn as two
       straight slabs they read as walls standing either side of the figure
       instead of as cloth hanging off it. */
    const edge = mix(k.cape, 20, 0.52);
    for (let i = 0; i <= 8; i++) {
      const y = y0 + 2 + i, w = i < 2 ? 1 : i < 5 ? 2 : 3;
      a.rect(11 - w, y, 11, y, k.cape);
      a.px(11 - w, y, k.capeSh);
      a.rect(21, y, 21 + w, y, k.capeSh);                 // far fall reads as behind
      a.px(21 + w, y, edge);
    }
    a.rect(8, y0 + 10, 11, y0 + 10, k.capeSh);            // hem
    a.rect(21, y0 + 10, 24, y0 + 10, edge);
    a.px(16, y0, k.gem);                                  // clasp
  }

  /* Expand a descriptor into the palette object + painter hooks the rig wants.
     Kept separate from resolve() so a caller can hand-edit a descriptor — swap
     one colour, force a weapon — and re-render without re-rolling anything. */
  function dress(d) {
    const c = d.colors;
    const kit = {
      cloth: c.shirt, clothHi: c.shirtHi, clothSh: c.shirtSh,
      /* Fabric headgear is a DEEPER tone of the outfit, never the outfit's own
         colour. Matched exactly, a hood and the tunic under it are one
         continuous yellow mass from the crown to the belt and the character
         loses its head. */
      /* Deepened again on top of that. A hood one shade off the tunic still
         merges with the shoulders under it at 32px, and the whole upper half
         of the figure comes back as a single coloured mass with a small pale
         face floating in it. */
      hoodCloth: mix(c.hood, 20, 0.24), hoodHi: lit(mix(c.hood, 20, 0.12)),
      hoodSh: dim(mix(c.hood, 20, 0.3)),
      hair: c.hair, hairHi: c.hairHi, hairSh: c.hairSh,
      metal: c.metal, metalHi: lit(c.metal), metalSh: dim(c.metal),
      rim: mix(c.metal, 20, 0.66),                        // the hard edge of a helm shell
      steel: c.steel, steelHi: lit(c.steel), steelSh: dim(c.steel),
      grip: '#6b4a2e', gripHi: '#8f6a45', gripSh: '#4a3220',
      string: '#d8cfae', gem: c.gem,
      horn: '#d6cdb2', hornHi: '#f2ecd8',
      cape: c.cloak, capeHi: c.cloak && lit(c.cloak), capeSh: c.cloak && dim(c.cloak)
    };
    const g = GEAR.find(x => x.key === d.gear) || GEAR[0];
    const w = HELD.find(x => x.key === d.held) || HELD[0];

    const pal = {
      skin: c.skin, skinHi: c.skinHi, skinSh: c.skinSh,
      shirt: c.shirt, shirtHi: c.shirtHi, shirtSh: c.shirtSh,
      leg: c.leg, legSh: c.legSh, shoe: c.shoe, shoeSh: c.shoeSh,
      belt: c.belt, beltDark: c.beltDark,
      /* The brow is a shade of SKIN, not a black bar. Independent of the skin
         tone it reads as a monobrow on the pale rows and vanishes on the deep
         ones. */
      brow: mix(c.skinSh, 20, 0.35), eye: c.eye, eyeHi: c.eyeHi,
      mouth: mix(c.skinSh, 20, 0.45),
      hair: c.hair, hairHi: c.hairHi, hairSh: c.hairSh
    };
    if (c.armour) {
      pal.vest = c.armour; pal.vestHi = lit(c.armour); pal.vestSh = dim(c.armour);
    }
    /* A villager's brooch is pewter with a hint of the gem in it, not the gem
       itself — a fully saturated pixel at 32px reads as a dead sensor, not as
       jewellery. */
    if (d.role === 'folk' && !c.armour) {
      pal.badge = mix(c.gem, 90, 0.45);
      pal.badgeHi = lit(pal.badge);
    }
    /* Order matters: mantle first, headgear second. Drawn the other way round
       the yoke sits on top of a hood's collar and the hood loses the one
       feature that distinguishes it from a haircut. */
    pal.gear = (a, hy, o) => { if (c.cloak) mantle(a, hy, kit); g.paint(a, hy, kit, pal, o); };

    /* Carry angle: up and back over the shoulder for anything with a shaft,
       level for the bow so the stave reads as a bow rather than a hoop. */
    const carryAng = w.key === 'bow' ? -0.2 : -1.05;
    /* The fist does not stay at the hip. The hurt pose flings it up to shoulder
       height, and a 14px haft carried at -1.05 rad from there puts its tip two
       rows ABOVE the buffer. Flatten the carry as the fist rises so the weapon
       stays in frame without ever blinking out of the hand. */
    const hand = w.paint
      ? (a, x, y) => w.paint(a, x, y, y < 14 ? carryAng * (0.26 + (y - 6) * 0.09) : carryAng, kit)
      : null;
    return { pal, kit, hand, weapon: w, gearDef: g, carryAng };
  }

  /* ---- attack choreography ----
     One state per arc kind. These are the frames that make a forged character
     feel authored: a swing that anticipates before it lands, a thrust that
     retracts, a cast that builds. A four-frame bob would have been a tenth of
     the code and would have looked generated. */
  function attackState(d, dr) {
    const rig = R(), w = dr.weapon, pal = dr.pal, kit = dr.kit;
    const paint = w.paint;

    if (w.arc === 'swing') {
      /* Five beats: wind up behind the shoulder, hold, the strike, follow
         through, recover. The hold frame is the one that makes the hit land —
         without a beat of anticipation the swing reads as a teleport. */
      /* Wind-up angle matters more than it looks. At -2.35 rad off a fist on the
         chest line the weapon head lands squarely across the face: on a thin
         blade that still reads as a raised sword, but a four-pixel-wide axe or
         maul head just deletes the character's head for two frames. Cocked
         nearer vertical off a fist held OUTSIDE the torso, the head clears the
         skull and the silhouette stays legible. */
      const ANG = [-1.90, -2.10, -0.55, 0.25, -0.75];
      const FIST = [[23, -3], [24, -4], [24, -1], [24, 2], [22, 0]];
      const LEAN = [-0.9, -1.2, 0.9, 0.7, 0.1];
      return rig.D('attack', 12, false, rig.seq(5, 12, (a, i) => {
        rig.person(a, pal, {
          hip: 20, lift: i === 1 ? -1 : 0, swing: LEAN[i],
          arm: (b, sh, hip2) => {
            const fx = FIST[i][0], fy = hip2 + FIST[i][1];
            b.line(20, sh + 3, fx, fy, pal.shirt, 2);
            b.line(20, sh + 3, fx, fy, pal.shirtHi, 1);
            b.rect(fx - 1, fy - 1, fx + 1, fy + 1, pal.skin);
            if (paint) paint(b, fx, fy, ANG[i], kit);
          }
        });
        /* A slash arc on the strike frame only. Held for two frames it stops
           reading as motion and starts reading as a scarf. */
        if (i === 2) for (let k = 0; k <= 9; k++) {
          const t = k / 9, aa = -1.5 + t * 1.9, r = 10 - t * 1.5;
          a.px(Math.round(21 + Math.cos(aa) * r), Math.round(17 + Math.sin(aa) * r), '#fff3d0');
        }
      }));
    }
    if (w.arc === 'thrust') {
      const PUSH = [-3, -5, 4, 2];
      return rig.D('attack', 12, false, rig.seq(4, 12, (a, i) => {
        rig.person(a, pal, {
          hip: 20, lift: i === 1 ? 1 : 0, swing: i < 2 ? -1.1 : 0.9,
          arm: (b, sh, hip2) => {
            const fx = 20 + PUSH[i], fy = hip2 - 3;
            b.line(19, sh + 3, fx, fy, pal.shirt, 2);
            b.line(19, sh + 3, fx, fy, pal.shirtHi, 1);
            b.rect(fx - 1, fy - 1, fx + 1, fy + 1, pal.skin);
            if (paint) paint(b, fx, fy, i < 2 ? -0.45 : -0.08, kit);
          }
        });
      }));
    }
    if (w.arc === 'cast') {
      /* The spell is the animation. The figure barely moves — what grows is
         the charge at the focus, which is why the last frame reads as a
         release rather than as a bigger circle. */
      return rig.D('cast', 10, false, rig.seq(5, 10, (a, i) => {
        const raise = [0, -1, -2, -2, -1][i];
        rig.person(a, pal, {
          hip: 20, lift: i > 1 ? -1 : 0, swing: -1.3,
          arm: (b, sh, hip2) => {
            const fx = 22, fy = hip2 - 2 + raise;
            b.rect(20, sh + 2, 22, fy, pal.shirt);
            b.rect(20, sh + 2, 20, fy, pal.shirtHi);
            b.rect(20, fy + 1, 22, fy + 2, pal.skin);
            if (paint) paint(b, fx, fy + 2, -1.25, kit);
          }
        });
        const gy = 20 - 2 + raise - 10;
        const rad = [0, 1.5, 2.5, 3.5, 5][i];
        if (i > 0) {
          for (let k = 0; k < 14; k++) {
            const aa = k / 14 * Math.PI * 2;
            a.px(Math.round(25 + Math.cos(aa) * rad), Math.round(gy + 4 + Math.sin(aa) * rad),
              i === 4 ? '#ffffff' : dr.kit.gem);
          }
        }
      }));
    }
    if (w.arc === 'shoot') {
      /* Draw, hold, loose. The arrow has to be ON the string for the first
         three frames and GONE on the fourth — an arrow still in frame after
         the release reads as a bow that does not work. */
      const PULL = [0, 2, 3, 0];
      /* The draw is not just the string hand moving one pixel. An archer rises
         onto the shot and settles after it, so the torso carries the beat too —
         without that the hold frame differs from the draw frame by six pixels
         and reads as a dropped frame. */
      const LIFT = [0, 0, -1, 1], SWING = [-1.0, -1.15, -1.35, -0.5];
      return rig.D('shoot', 11, false, rig.seq(4, 11, (a, i) => {
        rig.person(a, pal, {
          hip: 20, lift: LIFT[i], swing: SWING[i],
          arm: (b, sh, hip2) => {
            const fy = hip2 - 4;
            b.rect(20, sh + 2, 24, fy, pal.shirt);
            b.rect(20, sh + 2, 20, fy, pal.shirtHi);
            b.rect(23, fy, 25, fy + 1, pal.skin);
            if (paint) paint(b, 25, fy + 1, -0.2, kit);
            // drawing hand, back at the cheek
            b.rect(19 - PULL[i], fy - 1, 21 - PULL[i], fy + 1, pal.skin);
            if (i < 3) {
              b.rect(19 - PULL[i], fy, 27, fy, '#c9a06a');            // shaft
              b.px(27, fy, '#d8dce4');                                 // head
              b.px(19 - PULL[i], fy, '#e8e2d0');                       // fletching
            }
          }
        });
        if (i === 3) { a.rect(27, 16, 30, 16, '#c9a06a'); a.px(31, 16, '#d8dce4'); }
      }));
    }
    // punch: a jab with the shoulder behind it, for the unarmed and the porters
    const J = [-1, -2, 5, 2];
    return rig.D('attack', 13, false, rig.seq(4, 13, (a, i) => {
      rig.person(a, pal, {
        hip: 20, lift: i === 2 ? -1 : 0, swing: i < 2 ? -1.0 : 1.0,
        arm: (b, sh, hip2) => {
          const fx = 21 + J[i], fy = hip2 - 3 + (i === 2 ? -1 : 0);
          b.line(19, sh + 3, fx, fy, pal.shirt, 2);
          b.line(19, sh + 3, fx, fy, pal.shirtHi, 1);
          b.rect(fx - 1, fy - 1, fx + 1, fy + 1, pal.skin);
          b.px(fx + 1, fy - 1, pal.skinHi);
          if (paint) paint(b, fx, fy, -1.05, kit);
        }
      });
      if (i === 2) { a.px(29, 16, '#fff3d0'); a.px(30, 15, '#fff3d0'); a.px(30, 17, '#fff3d0'); }
    }));
  }

  /* suite(seed, opts) -> DocData, ready for the studio, the exporters and the
     sprite gates alike. Same shape every authored pack returns. */
  /* The rig's head dome tops out at hy-5, and the poses that lift the hips
     (the idle breath, the run's hunch, the hurt recoil) carry it to y1 — which
     leaves the outline pass nowhere to put the border but row 0, where it gets
     clipped and the silhouette opens. Rather than churn the shared rig and
     every template standing on it, forged figures sit ONE PIXEL lower in the
     frame. Feet land y26..28 instead of y25..27: still planted, still inside
     the 32px box, and the crown of the tallest headgear now clears row 1. */
  function sink(state, dy) {
    return Object.assign({}, state, { frames: state.frames.map(f => Object.assign({}, f, {
      paint: (buf, W, H) => {
        const tmp = new Uint32Array(W * H);
        f.paint(tmp, W, H);
        buf.fill(0);
        buf.set(tmp.subarray(0, (H - dy) * W), dy * W);
      }
    })) });
  }

  function suite(seed, opts = {}) {
    const d = typeof seed === 'object' && seed && seed.colors ? seed : resolve(seed, opts);
    const dr = dress(d);
    const rig = R();
    const states = [
      rig.idleState(dr.pal, dr.hand),
      rig.walkState(dr.pal, dr.hand),
      rig.walkState(dr.pal, dr.hand, 'run', 13, 3, { hunch: 1 }),
      attackState(d, dr),
      rig.hurtState(dr.pal, dr.hand),
      rig.downState(dr.pal, dr.hand)
    ];
    return { width: 32, height: 32, name: d.name, forge: d,
      layers: [{ name: 'figure' }], states: states.map(st => sink(st, 1)) };
  }

  /* roster(seed, n, opts) -> n descriptors that are guaranteed DIFFERENT.
     Rolling n independent seeds gives duplicates by the birthday problem well
     before n is large; deduping on the visual signature is what makes "give me
     24 townsfolk" actually produce 24 townsfolk. */
  function roster(seed, n = 12, opts = {}) {
    const r = rng(typeof seed === 'string' ? hashSeed(seed) : (seed >>> 0) || 1);
    const out = [], seen = new Set();
    for (let guard = 0; out.length < n && guard < n * 40; guard++) {
      const d = resolve(r.int(1, 0x7fffffff), opts);
      const sig = [d.role, d.kin, d.gear, d.held, d.armour, d.colors.shirt, d.colors.hair].join('|');
      if (seen.has(sig)) continue;
      seen.add(sig); out.push(d);
    }
    return out;
  }

  const gearKeys = () => GEAR.map(g => g.key);
  const heldKeys = () => HELD.map(h => h.key);
  const roleKeys = () => ROLES.slice();
  const kinKeys = () => [...new Set(SKINS.map(s => s.kin))];
  /* Distinct silhouette + kit + complexion combinations, BEFORE palette (which
     is continuous, so counting it would be dishonest). Reported by the studio
     and by forge_options so the number on screen is computed from the tables
     the generator actually reads, not claimed in prose that can drift. */
  const space = () => ROLES.reduce((n, k) => {
    const W = ROLE_WEIGHTS[k];
    return n + W.gear.length * W.held.length * 2 * 2;   // × armour × cloak
  }, 0) * SKINS.length;

  return { resolve, dress, suite, roster, gearKeys, heldKeys, roleKeys, kinKeys, space, GEAR, HELD, SKINS };
})();
