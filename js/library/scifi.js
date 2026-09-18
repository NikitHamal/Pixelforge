/* PixelForge Studio — Sci-fi / cyberpunk pack.
   Humanoids ride the shared PF.RPG.humanoidSuite rig (helm + visor + backpack),
   vehicles and machines get bespoke rigs here. Everything is 32x32 except the
   tileset (64x64, 4x4 of 16px). */
window.PF = window.PF || {};
PF.Scifi = (() => {
  const P = () => PF.Pixel, C = h => PF.Color.hexToU32(h);
  const D = (name, fps, loop, frames) => ({ name, fps, loop, frames });
  const Fr = (duration, paint) => ({ duration, paint });
  const ms = fps => Math.round(1000 / fps);
  const OUT = '#181425', OUT32 = C(OUT);
  const api32 = (buf, fn) => { const a = P().makeApi(buf, 32, 32); fn(a); buf.set(PF.Raster.outline(buf, 32, 32, OUT32)); };

  /* ---------------- palettes ----------------
     `hair` is the helmet-adjacent colour on bare-headed units: it must never
     equal the outline or the sideburn panels read as two black bars. */
  const BASE = { skin: '#e8b796', skinSh: '#c28569', hair: '#3a4466', hairSh: '#262b44', hairHi: '#5a6988',
    shirt: '#4a7fb5', shirtSh: '#29366f', shirtHi: '#73eff7', pants: '#29366f', pantsSh: '#1c2a44',
    boots: '#181425', belt: '#262b44', buckle: '#2ce8f5', outline: OUT, lip: '#a26a5a' };
  const SENTINEL = { ...BASE, shirt: '#4a7fb5', shirtSh: '#29366f', shirtHi: '#9fd0ff', pants: '#3a4466', belt: '#262b44', buckle: '#2ce8f5' };
  const TROOPER = { ...BASE, skin: '#d99a78', skinSh: '#a26a5a', shirt: '#a22633', shirtSh: '#5c1a1a', shirtHi: '#f6757a', pants: '#5c1a1a', boots: '#262b44', belt: '#262b44', buckle: '#feae34' };
  const NETRUNNER = { ...BASE, skin: '#c0cbdc', skinSh: '#8b9bb4', hair: '#00f0ff', hairSh: '#00879c', hairHi: '#c8ffff', shirt: '#2b1a5c', shirtSh: '#140a2e', shirtHi: '#c026d3', pants: '#140a2e', boots: '#0b0420', belt: '#00f0ff', buckle: '#ff2e88' };
  const ENGINEER = { ...BASE, skin: '#e4a672', skinSh: '#b86f50', hair: '#733e39', hairSh: '#3e2731', hairHi: '#c28569', shirt: '#e0a63c', shirtSh: '#9c6b30', shirtHi: '#ffe08a', pants: '#3a4466', boots: '#262b44', belt: '#3e2731', buckle: '#c0cbdc' };
  const DROID_PAL = { ...BASE, skin: '#8b9bb4', skinSh: '#5a6988', hair: null, hairSh: '#262b44', hairHi: '#c0cbdc', shirt: '#5a6988', shirtSh: '#3a4466', shirtHi: '#c0cbdc', pants: '#3a4466', pantsSh: '#262b44', boots: '#262b44', belt: '#262b44', buckle: '#ff0044', lip: '#5a6988' };
  const XENO = { ...BASE, skin: '#63c74d', skinSh: '#3e8948', hair: '#3e2347', hairSh: '#262b44', hairHi: '#68386c', shirt: '#3e2347', shirtSh: '#262b44', shirtHi: '#b55088', pants: '#262b44', boots: '#181425', belt: '#181425', buckle: '#63c74d', lip: '#265c42' };
  const VOID = { ...BASE, skin: '#2b1a5c', skinSh: '#140a2e', hair: '#c026d3', hairSh: '#6a2c9c', hairHi: '#f43f8e', shirt: '#140a2e', shirtSh: '#05010f', shirtHi: '#4a3a9c', pants: '#05010f', boots: '#05010f', belt: '#c026d3', buckle: '#00f0ff', lip: '#6a2c9c' };

  const R = () => PF.RPG;
  const helmets = {
    sentinel: { helm: '#8b9bb4', helmSh: '#3a4466', helmHi: '#e6ebf7', visor: '#2ce8f5' },
    trooper: { helm: '#a22633', helmSh: '#5c1a1a', helmHi: '#f6757a', visor: '#ffec27' },
    droid: { helm: '#c0cbdc', helmSh: '#5a6988', helmHi: '#ffffff', visor: '#ff0044' },
    void: { hood: '#140a2e', hoodSh: '#05010f', visor: '#c026d3' },
    xeno: { horns: '#ead4aa', hornsSh: '#c28569' }
  };
  const packs = { sentinel: { backpack: '#29366f', backpackSh: '#1c2a44', backpackLatch: '#2ce8f5' },
    trooper: { backpack: '#5c1a1a', backpackSh: '#3e2731', backpackLatch: '#feae34' },
    engineer: { backpack: '#9c6b30', backpackSh: '#5c3a1e', backpackLatch: '#c0cbdc' },
    droid: { backpack: '#3a4466', backpackSh: '#262b44', backpackLatch: '#ff0044' } };

  const sentinelSuite = () => R().humanoidSuite(SENTINEL, 'pf-scifi-sentinel', {
    weapon: 'rifle', head: helmets.sentinel, garb: packs.sentinel
  });
  const trooperSuite = () => R().humanoidSuite(TROOPER, 'pf-scifi-trooper', {
    weapon: 'rifle', shield: true, head: helmets.trooper, garb: packs.trooper
  });
  const netrunnerSuite = () => R().humanoidSuite(NETRUNNER, 'pf-scifi-netrunner', {
    weapon: 'blaster', cast: true, castColors: ['#00f0ff', '#ff2e88', '#ffffff'],
    head: helmets.void, post: (api, cfg) => { if (cfg.facing !== 'up') api.px(14 + (cfg.kb || 0), 13 + (cfg.bob || 0), '#c8ffff'); }
  });
  const engineerSuite = () => R().humanoidSuite(ENGINEER, 'pf-scifi-engineer', {
    weapon: 'wrench', shield: false, head: { hat: '#e0a63c', hatBand: '#3e2731', hatSh: '#9c6b30', visor: '#2ce8f5' },
    garb: packs.engineer
  });
  const wardenSuite = () => R().humanoidSuite(DROID_PAL, 'pf-scifi-warden', {
    weapon: 'blaster', head: helmets.droid, garb: packs.droid
  });
  const xenobruteSuite = () => R().humanoidSuite(XENO, 'pf-scifi-xenobrute', {
    weapon: 'claw', sneak: true, head: helmets.xeno
  });
  const voidpriestSuite = () => R().humanoidSuite(VOID, 'pf-scifi-voidpriest', {
    weapon: 'staff', cast: true, castColors: ['#c026d3', '#00f0ff', '#ffffff'],
    head: { hood: '#05010f', hoodSh: '#05010f', visor: '#c026d3' },
    garb: { cape: '#2b1a5c', capeSh: '#140a2e', capeClasp: '#00f0ff' }
  });

  /* ---------------- drone ----------------
     Hover rig: no ground contact by design (tagged flying), the chassis bobs on
     a two-channel sine so the six-frame loop has no repeated pose. */
  function droneSuite() {
    const body = '#5a6988', hi = '#c0cbdc', sh = '#3a4466', eye = '#ff0044', glow = '#2ce8f5';
    const draw = (cfg, fi) => (buf) => api32(buf, api => {
      const bob = cfg.bob, t = fi / 6;
      // rotors: four soft blades with a motion-blurred disc
      for (const dx of [-8, 8]) {
        api.line(16 + dx, 11 + bob, 16 + dx - 2, 9 + bob, hi, 1);
        api.line(16 + dx, 11 + bob, 16 + dx + 2, 9 + bob, hi, 1);
        api.px(16 + dx, 8 + bob, sh);
      }
      api.rect(10, 12 + bob, 21, 19 + bob, body);
      api.rect(10, 12 + bob, 21, 13 + bob, hi);
      api.rect(10, 18 + bob, 21, 19 + bob, sh);
      api.rect(12, 15 + bob, 19, 17 + bob, sh);
      api.rect(13, 15 + bob, 18, 16 + bob, eye);
      api.px(15, 15 + bob, '#ffffff'); api.px(16, 15 + bob, '#ffffff');
      api.rect(9, 13 + bob, 9, 18 + bob, sh);
      api.rect(22, 13 + bob, 22, 18 + bob, sh);
      // scan pulse on every second frame
      if (cfg.scan) { api.line(13, 20 + bob, 13 + cfg.scan, 23 + bob, glow, 1); api.px(13 + cfg.scan, 24 + bob, glow); }
      for (let i = 0; i < 3; i++) api.px(12 + i * 4, 21 + bob + (i % 2), glow);
    });
    const fly = (key, poses, fps) => D(key, fps, true, poses.map((p, i) => Fr(ms(fps), draw(p, i))));
    return { width: 32, height: 32, name: 'pf-scifi-drone', layers: [{ name: 'Body' }], states: [
      fly('idle_float', [0, -1, -2, -1, 0, 1].map(b => ({ bob: b })), 6),
      fly('scan', [0, -1, -1, 0].map((b, i) => ({ bob: b, scan: [4, 9, 13, 7][i] })), 8),
      fly('attack_swoop', [{ bob: -2 }, { bob: -5 }, { bob: -4 }, { bob: -1 }].map((p, i) => ({ ...p, scan: [6, 10, 12, 0][i] })), 10),
      D('hurt', 8, true, [0, 1].map(i => Fr(ms(8), draw({ bob: i, scan: 0, hurt: !!i }, i)))),
      D('death', 6, false, [0, 1, 2, 3].map(i => Fr(ms(6), (buf) => api32(buf, api => {
        const sag = i * 2;
        api.rect(10, 12 + sag, 21, 19 + sag, i > 1 ? sh : body);
        api.rect(13, 15 + sag, 18, 16 + sag, i > 1 ? sh : eye);
        for (let k = 0; k < i * 2; k++) api.px(12 + (k * 5) % 10, 21 + sag - k, glow);
      }))))
    ] };
  }

  /* ---------------- gun turret ----------------
     Base + barrel. The barrel length and muzzle flash carry the attack so the
     single firing frame is unambiguous. */
  function turretSuite() {
    const base = '#3a4466', baseHi = '#5a6988', dark = '#262b44', barrel = '#8b9bb4', eye = '#ff0044';
    const frame = (o) => (buf) => api32(buf, api => {
      const lift = o.lift || 0;
      api.rect(9, 20, 22, 26, base);
      api.rect(9, 20, 22, 21, baseHi);
      api.rect(9, 26, 22, 27, dark);
      api.rect(11, 22, 20, 25, dark);
      api.rect(12, 23, 19, 24, baseHi);
      api.px(15, 23, eye); api.px(16, 23, eye);
      const bl = o.bl || 0;
      if (bl > 0) {
        api.line(16, 18 + lift, 16, 18 + lift - bl, barrel, 3);
        api.line(16, 18 + lift - bl, 16, 18 + lift - bl - 1, '#c0cbdc', 1);
      }
      api.rect(13, 16 + lift, 18, 20 + lift, baseHi);
      api.rect(14, 17 + lift, 17, 18 + lift, eye);
      if (o.muzzle) P().muzzle(api, 16, 17 + lift - bl, o.muzzle, ['#ffffff', '#2ce8f5', '#ff0044']);
      if (o.smoke) P().smokePuff(api, 16, 15 + lift - bl, o.smoke, ['#5a6988', '#8b9bb4']);
    });
    return { width: 32, height: 32, name: 'pf-scifi-turret', layers: [{ name: 'Body' }], states: [
      D('idle_scan', 6, true, [0, 1, 2, 1].map(i => Fr(ms(6), frame({ lift: i % 2, bl: 2 })))),
      D('attack', 10, true, [Fr(ms(10), frame({ bl: 2 })), Fr(ms(10), frame({ bl: 6, muzzle: 0.6 })),
        Fr(60, frame({ bl: 7, muzzle: 1, smoke: 0.2 })), Fr(ms(6), frame({ bl: 4, smoke: 0.6 })), Fr(ms(6), frame({ bl: 2, smoke: 0.9 }))]),
      D('hurt', 8, true, [Fr(ms(8), frame({ bl: 3, lift: 1 })), Fr(ms(8), frame({ bl: 1, lift: -1 }))]),
      D('death', 6, false, [0, 1, 2, 3].map(i => Fr(ms(6), (buf) => api32(buf, api => {
        const sag = i * 2;
        api.rect(9, 20 + sag, 22, 26 + sag, i > 1 ? dark : base);
        api.rect(11, 22 + sag, 20, 25 + sag, dark);
        if (i < 2) { api.line(16, 18 + sag, 16, 14 + sag, barrel, 3); }
        for (let k = 0; k <= i; k++) { api.px(10 + k * 3, 26 + sag + (k % 2), '#feae34'); api.px(20 - k * 3, 24 + sag - (k % 2), '#8b9bb4'); }
      }))))
    ] };
  }

  /* ---------------- assault mech ----------------
     Bipedal walker: heavy, ground-contact at y25..27, six-frame stomp cycle
     with alternating treads and a cannon recoil on the attack. */
  function mechSuite() {
    const plate = '#4a7fb5', plateSh = '#29366f', plateHi = '#9fd0ff', dark = '#1c2a44', glass = '#2ce8f5', warn = '#ffec27';
    const frame = (o) => (buf) => api32(buf, api => {
      const bob = o.bob || 0, la = o.legA || 0, lb = o.legB || 0, recoil = o.recoil || 0;
      /* Legs: the hip lifts, the foot stays planted on rows 25..27. Lifting the
         whole leg instead would walk the mech off the ground line the engine
         draws its shadow on (and out of the frame on the death frames). */
      const sxA = o.sxA || 0, sxB = o.sxB || 0;
      api.rect(11 + sxA, 20 - la, 14 + sxA, 25 - la, dark); api.rect(11 + sxA, 25 - la, 15 + sxA, 27, dark);
      api.rect(18 + sxB, 20 - lb, 21 + sxB, 25 - lb, dark); api.rect(16 + sxB, 25 - lb, 21 + sxB, 27, dark);
      api.rect(10 + sxA, 26, 16 + sxA, 27, plateSh); api.rect(16 + sxB, 26, 22 + sxB, 27, plateSh);
      // torso
      api.rect(9, 8 + bob, 22, 20 + bob, plate);
      api.rect(9, 8 + bob, 22, 9 + bob, plateHi);
      api.rect(9, 18 + bob, 22, 20 + bob, plateSh);
      api.rect(12, 12 + bob, 19, 16 + bob, dark);
      api.rect(13, 13 + bob, 18, 15 + bob, glass);
      api.px(14, 13 + bob, '#ffffff');
      api.rect(8, 10 + bob, 8, 18 + bob, plateHi); api.rect(23, 10 + bob, 23, 18 + bob, plateSh);
      // shoulder cannon
      api.rect(20, 6 + bob, 25, 9 + bob, plateSh);
      api.line(24, 7 + bob, 29 - recoil, 7 + bob, '#8b9bb4', 2);
      if (o.muzzle) P().muzzle(api, 29 - recoil, 7 + bob, o.muzzle, ['#ffffff', '#ffec27', '#feae34']);
      // hazard stripe + antenna
      api.rect(10, 19 + bob, 13, 19 + bob, warn);
      api.line(10, 8 + bob, 8, 4 + bob, '#8b9bb4', 1); api.px(8, 3 + bob, '#ff0044');
    });
    /* Six distinct frames: the thigh rides the sine while the second leg runs
       at double frequency. A pure phase-shifted pair repeats on the half-cycle
       (frames 1/2 and 4/5 come out identical) and stalls the walk. */
    /* Two independent channels per leg — a y lift and an x stride — because a
       single sine pair repeats on the half cycle. The x table is chosen so no
       two consecutive frames share a (strideA, strideB) pair. */
    const LA = [0, 2, 2, 0, -2, -2], LB = [0, 2, -2, 0, 2, -2];
    const SA = [0, 1, 1, 0, -1, -1], SB = [1, 0, -1, 1, 0, -1];
    const walk = [];
    for (let i = 0; i < 6; i++) {
      const a = i / 6 * Math.PI * 2;
      walk.push({ bob: Math.max(-1, Math.min(0, Math.round(-Math.abs(Math.sin(a)) * 2 - Math.cos(a) * 0.8))),
        legA: LA[i], legB: LB[i], sxA: SA[i], sxB: SB[i] });
    }
    return { width: 32, height: 32, name: 'pf-scifi-mech', layers: [{ name: 'Body' }], states: [
      D('idle', 4, true, [0, -1, 0, 1].map(b => Fr(ms(4), frame({ bob: b, legA: 0, legB: 0 })))),
      D('walk', 6, true, walk.map(p => Fr(ms(6), frame(p)))),
      D('attack', 10, true, [Fr(ms(10), frame({ recoil: -1, muzzle: 0.3 })), Fr(ms(10), frame({ recoil: 1 })),
        Fr(55, frame({ recoil: 3, muzzle: 1 })), Fr(ms(8), frame({ recoil: 2, muzzle: 0.5 })), Fr(ms(8), frame({ recoil: 0 }))]),
      D('hurt', 7, true, [Fr(ms(7), frame({ bob: -1, legA: 2 })), Fr(ms(7), frame({ bob: 1, legB: -2 }))]),
      D('death', 6, false, [0, 1, 2, 3].map(i => Fr(ms(6), frame({ bob: i, legA: i, legB: i, recoil: i > 1 ? 3 : 0 }))))
    ] };
  }

  /* ---------------- hover fighter (top-down) ----------------
     Facing up the screen: nose at y=5, thrusters at y=25. Banking frames shift
     the wings, which is what makes a top-down ship read as steering. */
  function fighterSuite() {
    const hull = '#5a6988', hullHi = '#c0cbdc', hullSh = '#29366f', glass = '#2ce8f5', flame = '#ff7ab8', flame2 = '#ffec27';
    /* Drawn into a scratch buffer, then lifted, so a hover bob moves the whole
       ship including its outline. Shifting inside the painter (per-rect y
       offsets) would have to be repeated on every one of the twenty draws. */
    const frame = (o) => (buf) => {
      const tmp = new Uint32Array(32 * 32);
      api32(tmp, api => {
        const bank = o.bank || 0, thr = o.thr === undefined ? 1 : o.thr;
        const trail = o.trail === undefined ? 1 : o.trail;
        // wings (wide control surfaces: banking them is what sells steering)
        api.rect(4 + bank, 16, 11 + bank, 21, hullSh);
        api.rect(20 + bank, 16, 27 + bank, 21, hullSh);
        api.rect(4 + bank, 16, 11 + bank, 17, hull);
        api.rect(20 + bank, 16, 27 + bank, 17, hull);
        api.px(6 + bank, 20, flame); api.px(25 + bank, 20, flame);
        // fuselage
        api.rect(12, 8, 19, 24, hull);
        api.rect(12, 8, 19, 9, hullHi);
        api.rect(13, 5, 18, 8, hull);
        api.rect(14, 4, 17, 6, hullHi);
        api.rect(9, 20, 22, 23, hullSh);
        api.rect(13, 13, 18, 17, glass);
        api.px(14, 14, '#ffffff'); api.px(17, 15, hullHi);
        api.rect(14, 21, 17, 24, hullSh);
        // thrusters
        for (const x of [13, 18]) {
          api.px(x, 25, flame2);
          for (let k = 1; k <= trail; k++) api.px(x, 25 + k, k > 2 ? '#ff2e88' : flame);
          if (trail > 1) { api.px(x - 1, 24, flame); api.px(x + 1, 24, flame2); }
        }
        if (thr > 2) { api.px(15, 26, '#ff2e88'); api.px(16, 26, '#ff2e88'); }
        if (o.bolt) P().beam(api, 16, 3, 16, 3 - o.bolt, ['#ffffff', glass, '#29366f'], 2);
        if (o.muzzle) P().muzzle(api, 16, 4, o.muzzle, ['#ffffff', glass, '#9fd0ff']);
      });
      const lift = o.lift || 0;
      if (lift) buf.set(PF.Raster.shift(tmp, 32, 32, 0, lift)); else buf.set(tmp);
    };
    return { width: 32, height: 32, name: 'pf-scifi-fighter', layers: [{ name: 'Body' }], states: [
      D('idle_float', 5, true, [0, 1, 2, 3].map(i => Fr(ms(5), frame({ lift: [0, -1, 0, 1][i], trail: [1, 2, 3, 2][i] })))),
      D('bank_left', 6, true, [0, 1, 2, 1].map((b, i) => Fr(ms(6), frame({ bank: -b, trail: 1 + (i % 2) })))),
      D('bank_right', 6, true, [0, 1, 2, 1].map((b, i) => Fr(ms(6), frame({ bank: b, trail: 1 + (i % 2) })))),
      D('boost', 10, true, [1, 2, 3, 4].map((t, i) => Fr(ms(10), frame({ thr: 2, trail: t, bank: [0, -1, 0, 1][i] })))),
      D('attack', 10, true, [
        Fr(ms(10), frame({ bolt: 0, muzzle: 0.2, trail: 1 })),
        Fr(ms(10), frame({ bolt: 2, muzzle: 0.7, trail: 2 })),
        Fr(55, frame({ bolt: 7, muzzle: 1, trail: 3, lift: 1 })),
        Fr(ms(8), frame({ bolt: 3, muzzle: 0.4, trail: 2 })),
        Fr(ms(8), frame({ bolt: 1, muzzle: 0, trail: 1 }))
      ]),
      D('death', 6, false, [0, 1, 2, 3].map(i => Fr(ms(6), (buf) => api32(buf, api => {
        const r = 2 + i * 3;
        P().ring(api, 16, 14, r, i < 2 ? '#ffec27' : '#ff7ab8', 2 + (i > 1 ? 1 : 0));
        if (i < 2) { api.rect(13, 11, 18, 17, hullSh); api.rect(14, 13, 17, 15, glass); }
        P().sparks(api, 16, 14, i, '#feae34', 6, 2, 3 + i * 3);
      }))))
    ] };
  }

  /* ---------------- asteroid ----------------
     Three sizes x 4 tumble frames. Drawn from a deterministic radius per
     angle so the silhouette stays lumpy but never changes between runs. */
  function asteroidSuite() {
    const rock = '#8b9bb4', rockSh = '#5a6988', rockHi = '#c0cbdc', crater = '#3a4466';
    const frame = (r, phase) => (buf) => api32(buf, api => {
    const cx = 16, cy = 16;
      for (let a = 0; a < 360; a += 4) {
        const rad = (a / 180) * Math.PI;
        const wob = 2.2 + api.hash(Math.round(a / 4), phase, Math.round(r)) * 3.4;
        const rr = r + wob;
        for (let d = -1; d <= 1; d++) api.px(cx + Math.cos(rad) * (rr + d * 2), cy + Math.sin(rad) * (rr + d * 2) * 0.92, d < 0 ? rockHi : d > 0 ? rockSh : rock);
      }
      for (let i = 0; i < 5; i++) {
        const ang = (phase * 1.7 + i * 2.1), dr = (i % 3) * 2;
        const px = cx + Math.cos(ang) * (r - 3 - dr), py = cy + Math.sin(ang) * (r - 3 - dr) * 0.9;
        const cs = i % 2 ? 2 : 1;
        api.rect(px - cs, py - cs, px + cs, py + cs, crater);
        api.px(px - cs, py - cs, rockHi);
      }
    });
    return { width: 32, height: 32, name: 'pf-scifi-asteroid', layers: [{ name: 'Body' }], states: [
      D('size_large', 6, true, [0, 1, 2, 3].map(p => Fr(ms(6), frame(11, p)))),
      D('size_medium', 6, true, [0, 1, 2, 3].map(p => Fr(ms(6), frame(7, p + 5)))),
      D('size_small', 6, true, [0, 1, 2, 3].map(p => Fr(ms(6), frame(4, p + 9)))),
      D('break', 10, false, [0, 1, 2, 3].map(i => Fr(ms(10), (buf) => api32(buf, api => {
        api.rect(14, 14, 17, 17, rock);
        P().sparks(api, 16, 16, i, rockHi, 6, 1, 3 + i * 2);
      }))))
    ] };
  }

  /* ---------------- sci-fi tileset (16 tiles, 64x64) ---------------- */
  function tilesSuite() {
    const T = 16, cols = 4;
    const steel = '#5a6988', steelHi = '#8b9bb4', steelSh = '#3a4466', dark = '#262b44', glass = '#2ce8f5', warn = '#ffec27', rust = '#9c6b30';
    const plate = (api, seed, o = {}) => {
      api.rect(0, 0, T - 1, T - 1, o.base || steel);
      api.rect(0, 0, T - 1, 0, steelHi);
      api.rect(0, T - 1, T - 1, T - 1, steelSh);
      api.px(1, 1, steelHi); api.px(T - 2, 1, steelHi); api.px(1, T - 2, steelSh); api.px(T - 2, T - 2, steelSh);
      if (!o.flat) api.speck(1, 1, T - 2, T - 2, seed, [steelSh], 0.1);
    };
    const paints = [
      // 0-3: floor plates with rivet patterns
      (api) => plate(api, 1),
      (api) => { plate(api, 2); api.rect(4, 4, 11, 11, steelSh); api.rect(5, 5, 10, 10, steel); api.px(7, 7, steelHi); api.px(8, 8, steelHi); },
      (api) => { plate(api, 3); api.line(0, 8, 15, 8, steelSh, 1); api.line(8, 0, 8, 15, steelSh, 1); },
      (api) => { plate(api, 4, { base: dark }); api.speck(0, 0, 15, 15, 9, [steelSh, rust], 0.22); },
      // 4-7: grate, vent, hazard stripes, window
      (api) => { api.rect(0, 0, 15, 15, dark); for (let y = 0; y < 16; y += 4) { api.rect(0, y, 15, y + 1, steel); api.rect(0, y + 2, 15, y + 2, steelSh); } api.rect(0, 0, 0, 15, steelSh); api.rect(15, 0, 15, 15, steelSh); },
      (api) => { plate(api, 5); api.rect(2, 2, 13, 13, dark); for (let y = 3; y <= 12; y += 3) api.rect(3, y, 12, y + 1, steelSh); api.rect(2, 2, 13, 2, steel); },
      (api) => { api.rect(0, 0, 15, 15, dark); for (let i = -16; i < 16; i += 6) { for (let k = 0; k < 3; k++) api.line(i + k, 15, i + k + 15, 0, warn, 1); } api.rect(0, 0, 15, 0, '#181425'); api.rect(0, 15, 15, 15, '#181425'); },
      (api) => { plate(api, 6); api.rect(1, 3, 14, 12, dark); api.rect(2, 4, 13, 11, glass); api.rect(2, 4, 6, 6, '#ffffff'); api.line(8, 4, 8, 11, dark, 1); },
      // 8-11: pipes, cable run, floor light, hatch
      (api) => { plate(api, 7); api.rect(2, 0, 6, 15, steelSh); api.rect(2, 0, 3, 15, steelHi); api.rect(9, 0, 13, 15, steelSh); api.rect(9, 0, 10, 15, steelHi); },
      (api) => { plate(api, 8, { base: dark }); for (let x = 0; x < 16; x++) { const y = 4 + Math.round(Math.sin(x / 3) * 3); api.px(x, y, rust); api.px(x, y + 1, '#733e39'); } api.px(4, 1, steelHi); api.px(11, 12, steelHi); },
      (api) => { plate(api, 9); api.rect(3, 6, 12, 9, dark); api.rect(4, 7, 11, 8, glass); api.px(7, 4, steelHi); api.px(8, 11, steelSh); },
      (api) => { plate(api, 10); api.ellipse(2, 2, 13, 13, steelSh, true); api.ellipse(4, 4, 11, 11, steel, true); api.line(8, 4, 8, 11, steelSh, 1); api.line(4, 8, 11, 8, steelSh, 1); api.px(5, 5, steelHi); },
      // 12-15: wall, wall light, corner pillar, void
      (api) => { api.rect(0, 0, 15, 15, steelSh); api.rect(0, 0, 15, 1, steel); api.rect(0, 0, 0, 15, steel); api.speck(1, 2, 14, 14, 12, [dark], 0.12); },
      (api) => { api.rect(0, 0, 15, 15, steelSh); api.rect(0, 0, 15, 1, steel); api.rect(4, 4, 11, 9, dark); api.rect(5, 5, 10, 8, '#ffe08a'); api.rect(6, 6, 9, 7, '#ffffff'); },
      (api) => { api.rect(0, 0, 15, 15, steelSh); api.rect(0, 0, 3, 15, steel); api.rect(3, 0, 3, 15, dark); api.rect(3, 0, 15, 3, steel); api.rect(0, 3, 15, 3, dark); api.px(2, 2, steelHi); },
      (api) => { api.rect(0, 0, 15, 15, '#0b0420'); for (let i = 0; i < 10; i++) api.px(api.hash(i, 1, 3) * 15, api.hash(i, 2, 4) * 15, i % 3 ? '#29366f' : '#4a3a9c'); }
    ];
    const frames = paints.map((fn, i) => ({ duration: 100, paint: (buf) => { const api = P().offsetApi(P().makeApi(buf, 64, 64), (i % cols) * T, ((i / cols) | 0) * T); fn(api); } }));
    return { width: 64, height: 64, name: 'pf-scifi-tiles', layers: [{ name: 'Tiles' }], states: [D('tiles', 1, true, frames)] };
  }

  /* ---------------- sci-fi props ---------------- */
  function propsSuite() {
    const steel = '#5a6988', steelHi = '#8b9bb4', steelSh = '#3a4466', dark = '#262b44', glass = '#2ce8f5', warn = '#ffec27', red = '#ff0044';
    const crate = (buf) => api32(buf, api => {
      api.rect(6, 12, 25, 27, steel); api.rect(6, 12, 25, 13, steelHi); api.rect(6, 26, 25, 27, steelSh);
      api.rect(6, 12, 7, 27, steelSh); api.rect(24, 12, 25, 27, dark);
      api.rect(8, 14, 23, 25, steelSh); api.rect(9, 15, 22, 24, steel);
      api.rect(4, 16, 6, 19, warn); api.rect(4, 22, 6, 25, warn);
    });
    const barrel = (buf) => api32(buf, api => {
      api.rect(10, 14, 21, 27, steelSh); api.rect(10, 14, 21, 15, steel); api.rect(10, 26, 21, 27, dark);
      api.rect(10, 18, 21, 19, steelHi); api.rect(10, 22, 21, 22, steelHi);
      api.rect(11, 15, 20, 17, steel);
      api.rect(13, 16, 18, 17, warn);
    });
    const canister = (buf) => api32(buf, api => {
      api.rect(11, 10, 20, 27, steel); api.rect(11, 10, 20, 11, steelHi);
      api.rect(13, 7, 18, 10, steelSh); api.px(15, 6, glass); api.px(16, 6, glass);
      api.rect(12, 14, 19, 20, dark); api.rect(13, 15, 18, 19, glass);
      api.px(14, 16, '#ffffff');
      api.rect(11, 24, 20, 25, warn); api.px(12, 26, red); api.px(19, 26, red);
    });
    const terminal = (buf) => api32(buf, api => {
      api.rect(7, 8, 24, 22, dark); api.rect(7, 8, 24, 9, steelHi);
      api.rect(8, 10, 23, 18, '#0b0420'); api.rect(9, 11, 22, 17, '#124e89');
      for (let y = 12; y <= 16; y += 2) api.rect(10, y, 10 + 3 + ((y * 3) % 8), y, glass);
      api.rect(10, 20, 21, 27, steelSh); api.rect(10, 20, 21, 21, steel);
      api.px(12, 23, red); api.px(14, 23, warn); api.px(16, 23, '#63c74d');
      api.rect(8, 5, 23, 8, steel); api.rect(9, 4, 12, 6, steelSh);
    });
    const pipes = (buf) => api32(buf, api => {
      for (let i = 0; i < 3; i++) {
        const x = 7 + i * 7;
        api.rect(x, 4, x + 4, 27, steelSh); api.rect(x, 4, x + 1, 27, steel);
        api.rect(x, 4 + i * 3, x + 4, 5 + i * 3, steelHi);
      }
      api.rect(5, 24, 26, 27, dark); api.rect(5, 24, 26, 24, steelSh);
      api.rect(4, 10, 27, 11, steelSh);
    });
    const antenna = (buf) => api32(buf, api => {
      api.rect(12, 24, 19, 27, steelSh); api.rect(12, 24, 19, 24, steel);
      api.line(16, 24, 16, 6, steelHi, 1);
      api.line(9, 12, 16, 12, steelHi, 1); api.line(16, 16, 23, 16, steelHi, 1);
      api.line(11, 8, 16, 8, steelSh, 1);
      api.px(16, 4, red); api.px(9, 12, warn); api.px(23, 16, warn);
      api.rect(14, 20, 17, 23, dark);
    });
    const doorPaint = (open) => (buf) => api32(buf, api => {
      api.rect(8, 3, 23, 27, steelSh); api.rect(8, 3, 23, 4, steelHi);
      api.rect(9, 5, 22, 26, dark);
      const half = open || 0;
      api.rect(9, 5, 22, 26, '#3a4466');
      api.rect(9 + half, 5, 15 + half, 26, steel); api.rect(16 + half, 5, 22 - half, 26, steelSh);
      api.line(15 + half, 5, 15 + half, 26, dark, 1);
      api.rect(10 + half, 14, 14 + half, 15, warn);
      api.rect(2, 2, 5, 6, steel); api.rect(26, 2, 29, 6, steel);
    });
    const fieldPaint = (t) => (buf) => api32(buf, api => {
      api.rect(4, 4, 27, 6, steel); api.rect(4, 25, 27, 27, steel);
      api.rect(4, 4, 6, 27, steelSh); api.rect(25, 4, 27, 27, steelSh);
      const alpha = [0.35, 0.6, 0.85, 0.6][t];
      const bandRows = Math.round(alpha * 16);
      for (let y = 7; y < 25; y++) {
        if ((y - t) % 4 === 0) continue;
        if (y - 7 > bandRows && y < 25 - bandRows) continue;
        api.line(8, y, 23, y, t % 2 ? '#2ce8f5' : '#73eff7', 1);
      }
      P().ring(api, 16, 16, 9 - t, '#9fd0ff', 1, 3);
    });
    const S = (name, fps, frames) => D(name, fps, true, frames);
    return { width: 32, height: 32, name: 'pf-scifi-props', layers: [{ name: 'Props' }], states: [
      D('crate', 1, true, [Fr(1000, crate)]),
      D('barrel', 1, true, [Fr(1000, barrel)]),
      D('canister', 1, true, [Fr(1000, canister)]),
      D('terminal', 1, true, [Fr(1000, terminal)]),
      D('pipes', 1, true, [Fr(1000, pipes)]),
      D('antenna', 1, true, [Fr(1000, antenna)]),
      S('door', 8, [Fr(400, doorPaint(0)), Fr(ms(8), doorPaint(1)), Fr(ms(8), doorPaint(2)), Fr(ms(8), doorPaint(4))]),
      S('forcefield', 8, [Fr(ms(8), fieldPaint(0)), Fr(ms(8), fieldPaint(1)), Fr(ms(8), fieldPaint(2)), Fr(ms(8), fieldPaint(3))])
    ] };
  }

  /* ---------------- sci-fi items ---------------- */
  function itemsSuite() {
    const steel = '#8b9bb4', steelSh = '#5a6988', glass = '#2ce8f5', warn = '#ffec27', red = '#ff0044', dark = '#262b44';
    const cell = (buf) => api32(buf, api => {
      api.rect(11, 8, 20, 26, steelSh); api.rect(12, 9, 19, 25, glass);
      api.rect(12, 9, 19, 11, '#ffffff'); api.px(13, 12, '#ffffff');
      api.rect(13, 6, 18, 8, steel); api.rect(14, 4, 17, 6, warn); api.px(15, 3, warn);
      api.rect(11, 22, 20, 24, dark);
    });
    const medkit = (buf) => api32(buf, api => {
      api.rect(8, 12, 23, 26, '#e8ecf5'); api.rect(8, 12, 23, 13, '#ffffff'); api.rect(8, 25, 23, 26, steelSh);
      api.rect(13, 6, 18, 12, steelSh);
      api.rect(14, 16, 17, 22, red); api.rect(11, 18, 20, 20, red);
    });
    const keycard = (buf) => api32(buf, api => {
      api.rect(9, 11, 22, 24, steel); api.rect(9, 11, 22, 12, '#ffffff');
      api.rect(10, 14, 15, 15, warn); api.rect(16, 14, 21, 15, warn);
      api.rect(10, 17, 21, 21, dark);
    });
    const chip = (buf) => api32(buf, api => {
      api.rect(9, 10, 22, 23, dark);
      for (let i = 0; i < 4; i++) { api.rect(7, 12 + i * 3, 9, 13 + i * 3, steel); api.rect(22, 12 + i * 3, 24, 13 + i * 3, steel); }
      for (let i = 0; i < 4; i++) { api.rect(12 + i * 3, 7, 13 + i * 3, 10, steel); api.rect(12 + i * 3, 23, 13 + i * 3, 26, steel); }
      api.rect(12, 13, 19, 20, steelSh); api.rect(14, 15, 17, 18, glass); api.px(15, 16, '#ffffff');
    });
    const grenade = (buf) => api32(buf, api => {
      api.ellipse(10, 13, 21, 26, steelSh, true); api.ellipse(11, 14, 18, 23, steel, true);
      api.rect(13, 8, 18, 13, dark); api.line(17, 4, 21, 8, warn, 2); api.px(22, 4, red);
      api.rect(20, 15, 22, 18, warn); api.px(21, 19, red);
    });
    const datapad = (buf) => api32(buf, api => {
      api.rect(7, 8, 24, 25, dark); api.rect(8, 9, 23, 22, steelSh);
      api.rect(9, 10, 22, 20, '#0b0420');
      for (let y = 11; y <= 19; y += 2) api.rect(10, y, 10 + 4 + ((y * 5) % 8), y, glass);
      api.rect(10, 23, 21, 24, steel); api.px(12, 23, warn);
    });
    const scrap = (buf) => api32(buf, api => {
      api.rect(8, 18, 24, 26, steelSh); api.rect(8, 18, 24, 19, steel);
      api.line(10, 18, 14, 10, steel, 2); api.line(20, 18, 21, 11, steelSh, 2);
      api.rect(15, 20, 19, 24, dark); api.px(11, 20, warn);
    });
    return { width: 32, height: 32, name: 'pf-scifi-items', layers: [{ name: 'Items' }], states: [
      D('plasma_cell', 1, true, [Fr(1000, cell)]),
      D('medkit', 1, true, [Fr(1000, medkit)]),
      D('keycard', 1, true, [Fr(1000, keycard)]),
      D('data_chip', 1, true, [Fr(1000, chip)]),
      D('grenade', 1, true, [Fr(1000, grenade)]),
      D('data_pad', 1, true, [Fr(1000, datapad)]),
      D('scrap', 1, true, [Fr(1000, scrap)])
    ] };
  }

  /* ---------------- sci-fi FX ---------------- */
  function fxSuite() {
    const cn = ['#ffffff', '#2ce8f5', '#124e89'], hot = ['#ffffff', '#ffec27', '#feae34'];
    const S = (name, fps, frames) => D(name, fps, true, frames);
    const fx = (fn) => (buf) => { const api = P().makeApi(buf, 32, 32); fn(api); buf.set(PF.Raster.outline(buf, 32, 32, OUT32)); };
    return { width: 32, height: 32, name: 'pf-scifi-fx', layers: [{ name: 'FX' }], states: [
      S('laser_bolt', 12, [0, 1, 2, 3].map(i => Fr(ms(12), fx(api => {
        const x = 4 + i * 7;
        P().beam(api, x, 16, x + 8, 16, cn, 3);
        if (i === 0) P().muzzle(api, x, 16, 0.5, hot);
      })))),
      S('plasma_burst', 12, [0, 1, 2, 3, 4].map(i => Fr(ms(12), fx(api => {
        const r = 2 + i * 2;
        P().ring(api, 16, 16, r, cn[i % 3], 2 + (i > 2 ? 0 : 1));
        P().sparks(api, 16, 16, i, cn[1], 8, 1, r + 2);
        if (i < 2) api.rect(14, 14, 17, 17, '#ffffff');
      })))),
      S('shield_hit', 10, [0, 1, 2].map(i => Fr(ms(10), fx(api => {
        const r = 10 - i * 2;
        P().ring(api, 16, 18, r, cn[1], 2, i ? 2 : 1);
        P().impactStar(api, 16, 18, 0.4 + i * 0.3, ['#9fd0ff', cn[2]], 7);
      })))),
      S('teleport', 8, [0, 1, 2, 3].map(i => Fr(ms(8), fx(api => {
        for (let y = 4 + i; y < 28 - i; y += 2) api.line(12 + i, y, 19 - i, y, cn[i % 2], 1);
        P().ring(api, 16, 27, 7 - i, cn[1], 2);
        if (i === 3) { api.rect(14, 12, 17, 24, cn[0]); }
      })))),
      S('emp_ring', 8, [0, 1, 2, 3].map(i => Fr(ms(8), fx(api => {
        P().ring(api, 16, 16, 3 + i * 4, cn[1], 1 + (i < 2 ? 1 : 0), 2);
        P().ring(api, 16, 16, Math.max(1, 2 + i * 4 - 3), cn[2], 1);
      })))),
      S('impact_sparks', 12, [0, 1, 2].map(i => Fr(ms(12), fx(api => {
        P().impactStar(api, 16, 16, 0.5 + i * 0.25, hot, 8 - i);
      }))))
    ] };
  }

  return { sentinelSuite, trooperSuite, netrunnerSuite, engineerSuite, wardenSuite, xenobruteSuite, voidpriestSuite,
    droneSuite, turretSuite, mechSuite, fighterSuite, asteroidSuite,
    tilesSuite, propsSuite, itemsSuite, fxSuite, helmets, packs, BASE, SENTINEL, TROOPER, NETRUNNER, ENGINEER, DROID_PAL, XENO, VOID };
})();
