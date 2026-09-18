/* PixelForge Studio — Universal FX pack.
   Genre-agnostic impact, elemental and pickup effects: the particle vocabulary
   every game needs regardless of setting. 32x32, pure maths, deterministic.
   Radii and lifetimes are driven by eased t so each state reads as one motion
   rather than a list of poses. */
window.PF = window.PF || {};
PF.FX2 = (() => {
  const P = () => PF.Pixel;
  const D = (name, fps, loop, frames) => ({ name, fps, loop, frames });
  const Fr = (duration, paint) => ({ duration, paint });
  const ms = fps => Math.round(1000 / fps);
  const OUT32 = PF.Color.hexToU32('#181425');
  const finish = (buf, W, H) => buf.set(PF.Raster.outline(buf, W, H, OUT32));
  const TAU = Math.PI * 2;
  const ease = t => 1 - Math.pow(1 - t, 3);
  /* Painter wrapper. FX read better with the house outline, but a soft state
     (smoke, aura) passes `soft` so the silhouette is not hard-rimmed. */
  const fx = (painter, soft) => (buf, W, H) => { painter(P().makeApi(buf, W, H), W, H); if (!soft) finish(buf, W, H); };
  const seq = (n, fps, make, soft) => Array.from({ length: n }, (_, i) => Fr(ms(fps), fx(a => make(a, i, i / (n - 1)), soft)));
  /* Looping variant: t never reaches 1, so the last frame does not repeat the
     first and the cycle closes without a visible hitch. */
  const seqL = (n, fps, make, soft) => Array.from({ length: n }, (_, i) => Fr(ms(fps), fx(a => make(a, i, i / n), soft)));

  /* Filled ring of radius r, thickness th — the workhorse for blasts and novas. */
  function ring(api, cx, cy, r, th, color, squash = 1) {
    const steps = Math.max(10, Math.round(r * 7));
    for (let i = 0; i < steps; i++) {
      const a = (i / steps) * TAU;
      for (let t = 0; t < th; t++) api.px(cx + Math.cos(a) * (r + t), cy + Math.sin(a) * (r + t) * squash, color);
    }
  }
  /* Radial shard burst: n spikes from r0 to r1, alternating length. */
  function shards(api, cx, cy, r0, r1, n, colors, phase = 0) {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + phase, long = (i & 1) ? 1 : 0.62;
      api.line(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0, cx + Math.cos(a) * r1 * long, cy + Math.sin(a) * r1 * long, colors[i % colors.length], 1);
    }
  }

  /* ================= EXPLOSIONS ================= */
  function explosionSuite() {
    const CORE = '#fff6c9', HOT = '#fee761', MID = '#f77622', LOW = '#e43b44', SMOKE = '#5a6988', SMOKED = '#3a4466';

    /* 8 frames: flash -> fireball -> bloom -> break-up -> smoke. The core
       shrinks while the shell grows, which is what sells the energy leaving. */
    const big = (api, i, t) => {
      const r = 3 + ease(t) * 12, core = Math.max(0, 7 - i * 1.6);
      if (i === 0) { api.ellipse(16 - 5, 16 - 5, 16 + 5, 16 + 5, CORE, true); shards(api, 16, 16, 4, 13, 8, [HOT, CORE]); return; }
      api.ellipse(16 - r, 16 - r * 0.92, 16 + r, 16 + r * 0.92, i > 4 ? SMOKE : LOW, true);
      api.ellipse(16 - r + 2, 16 - r * 0.92 + 2, 16 + r - 2, 16 + r * 0.92 - 2, i > 4 ? SMOKED : MID, true);
      if (core > 0) api.ellipse(16 - core, 16 - core, 16 + core, 16 + core, i > 3 ? HOT : CORE, true);
      /* Blast lumps: hash-placed so the ball is never a clean circle. */
      for (let k = 0; k < 9; k++) {
        const a = (k / 9) * TAU + i * 0.35, rr = r * (0.7 + api.hash(k, i, 7) * 0.55);
        api.ellipse(16 + Math.cos(a) * rr - 2, 16 + Math.sin(a) * rr - 2, 16 + Math.cos(a) * rr + 2, 16 + Math.sin(a) * rr + 2, i > 4 ? SMOKE : (i > 2 ? MID : HOT), true);
      }
      if (i >= 5) for (let k = 0; k < 6; k++) { // embers outliving the ball
        const a = (k / 6) * TAU + 0.4, d = r + 2 + (i - 4) * 2;
        api.px(16 + Math.cos(a) * d, 16 + Math.sin(a) * d, HOT);
      }
    };

    /* Small hit-sized pop: 5 frames, no smoke stage. */
    const small = (api, i, t) => {
      const r = 2 + ease(t) * 7;
      api.ellipse(16 - r, 16 - r, 16 + r, 16 + r, i > 2 ? MID : LOW, true);
      api.ellipse(16 - r + 2, 16 - r + 2, 16 + r - 2, 16 + r - 2, i > 2 ? HOT : CORE, true);
      shards(api, 16, 16, r, r + 4 - i, 8, [HOT, MID], i * 0.4);
    };

    /* Directional blast: a cone punching right, for barrels and rockets. */
    const cone = (api, i, t) => {
      const reach = 4 + ease(t) * 16;
      for (let x = 6; x < 6 + reach; x++) {
        const k = (x - 6) / reach, hh = Math.round(2 + k * 7 * (1 - k * 0.45));
        const c = k < 0.3 ? CORE : k < 0.62 ? HOT : k < 0.85 ? MID : LOW;
        api.line(x, 16 - hh, x, 16 + hh, c);
      }
      for (let k = 0; k < 5; k++) api.px(6 + reach + 1 + k, 16 + Math.round(Math.sin(k * 2 + i) * 4), i > 2 ? SMOKE : HOT);
    };

    /* Nuke-style mushroom for boss deaths: column + cap. */
    const mushroom = (api, i, t) => {
      const capY = 16 - ease(t) * 8, capR = 3 + ease(t) * 10;
      api.rect(13, capY + 2, 18, 29, i > 3 ? SMOKE : MID);
      api.rect(14, capY + 2, 17, 29, i > 3 ? SMOKED : HOT);
      api.ellipse(16 - capR, capY - capR * 0.7, 16 + capR, capY + capR * 0.7, i > 3 ? SMOKE : LOW, true);
      api.ellipse(16 - capR + 2, capY - capR * 0.7 + 1, 16 + capR - 2, capY + capR * 0.7 - 1, i > 3 ? SMOKED : MID, true);
      if (i < 4) api.ellipse(16 - 3, capY - 2, 16 + 3, capY + 2, CORE, true);
      api.rect(8 - i, 28, 24 + i, 29, i > 2 ? SMOKED : MID); // ground wash
    };

    return { width: 32, height: 32, name: 'fx-explosion', layers: [{ name: 'FX' }], states: [
      D('explode_big', 14, false, seq(8, 14, big)),
      D('explode_small', 14, false, seq(5, 14, small)),
      D('explode_cone', 16, false, seq(5, 16, cone)),
      D('explode_mushroom', 10, false, seq(6, 10, mushroom))
    ] };
  }

  /* ================= SMOKE, FIRE, STEAM ================= */
  function smokeSuite() {
    const S1 = '#c0cbdc', S2 = '#8b9bb4', S3 = '#5a6988';

    // rising puff: three blobs climbing and spreading, fading by shrink
    const puff = (api, i, t) => {
      for (let k = 0; k < 3; k++) {
        const ph = (t + k * 0.33) % 1, y = 27 - ph * 20, r = 2 + ph * 4.5;
        const c = ph < 0.35 ? S1 : ph < 0.7 ? S2 : S3;
        const x = 16 + Math.sin(ph * 4 + k * 2) * 3;
        api.ellipse(x - r, y - r * 0.8, x + r, y + r * 0.8, c, true);
        api.ellipse(x - r + 1, y - r * 0.8, x + r - 2, y - 1, k === 0 ? '#e8ecf5' : S1, true);
      }
    };
    // campfire-grade flame loop with a hot core and drifting sparks
    const flame = (api, i) => {
      const h = [0, 1, 0, 1][i] + 10, sway = [0, 1, 0, -1][i];
      api.ellipse(11, 28 - h, 21, 30, '#e43b44', true);
      api.ellipse(12 + sway, 29 - h + 2, 20 + sway, 30, '#f77622', true);
      api.ellipse(13 + sway, 30 - h + 5, 19 + sway, 30, '#feae34', true);
      api.ellipse(15 + sway, 30 - h + 8, 17 + sway, 29, '#fee761', true);
      api.px(16 + sway, 29 - h + 3, '#fff6c9');
      for (let k = 0; k < 4; k++) { // sparks lifting off the tip
        const y = 30 - h - 2 - ((k * 5 + i * 3) % 14);
        api.px(14 + ((k * 7 + i * 5) % 6), y, k & 1 ? '#fee761' : '#f77622');
      }
    };
    // steam jet: vertical column that thins as it rises
    const steam = (api, i) => {
      for (let k = 0; k < 7; k++) {
        const ph = ((k / 7) + i / 4) % 1, y = 28 - ph * 24, r = 1 + ph * 3.2;
        const x = 16 + Math.sin(ph * 6) * (1 + ph * 3);
        api.ellipse(x - r, y - r, x + r, y + r, ph < 0.5 ? '#e8ecf5' : S1, true);
      }
      api.rect(13, 28, 18, 29, S3); // vent lip
    };
    // ground-hugging dust cloud from a landing
    const dust = (api, i, t) => {
      const spread = 3 + ease(t) * 11;
      for (let k = 0; k < 10; k++) {
        const side = k & 1 ? 1 : -1, d = (0.35 + api.hash(k, 3, 5) * 0.65) * spread;
        const x = 16 + side * d, y = 27 - api.hash(k, 7, 9) * (2 + ease(t) * 5), r = 2.4 - t * 1.1;
        api.ellipse(x - r, y - r * 0.7, x + r, y + r * 0.7, t > 0.55 ? S3 : S2, true);
        if (t < 0.55) api.ellipse(x - r + 1, y - r * 0.7, x + r - 1, y, S1, true);
      }
    };

    return { width: 32, height: 32, name: 'fx-smoke', layers: [{ name: 'FX' }], states: [
      D('smoke_puff', 8, true, seqL(6, 8, puff, true)),
      D('fire_loop', 8, true, seq(4, 8, flame)),
      D('steam_jet', 8, true, seq(4, 8, steam, true)),
      D('dust_land', 12, false, seq(5, 12, dust, true))
    ] };
  }

  /* ================= IMPACTS & COMBAT ================= */
  function impactSuite() {
    const W = '#ffffff', Y = '#fee761', O = '#f77622', R = '#e43b44', B = '#2ce8f5';

    // hit spark: a tight star that blows out then collapses to specks
    const hit = (api, i, t) => {
      const r = 3 + ease(t) * 8;
      if (t < 0.4) {
        api.ellipse(13, 13, 19, 19, W, true);
        shards(api, 16, 16, 2, r, 8, [W, Y], 0.2);
      } else {
        // Late frames drop the core and the ring: a ring plus radial shards
        // reads as a wagon wheel, not a spark. Only the thrown sparks stay.
        shards(api, 16, 16, r - 3, r + 3, 8, [Y, O], 0.2);
        for (let k = 0; k < 6; k++) { const a = (k / 6) * TAU + 0.5; api.px(16 + Math.cos(a) * (r + 4), 16 + Math.sin(a) * (r + 4), O); }
      }
    };
    // slash arc, left to right, with a trailing ghost
    const slash = (api, i, t) => {
      const a0 = -2.4 + t * 2.2, a1 = a0 + 1.5;
      P().arcTrail(api, 16, 17, 12, a0, a1, ['#8b9bb4', '#e8ecf5', W], { width: 3 });
      if (i > 0) P().arcTrail(api, 16, 17, 10, a0 - 0.5, a1 - 0.6, ['#3a4466', '#5a6988'], { width: 2 });
    };
    // crit: two crossing arcs plus an impact star at the crossing point
    const crit = (api, i, t) => {
      P().arcTrail(api, 15, 16, 12, -2.5 + t * 2, -1.1 + t * 2, ['#8b9bb4', '#e8ecf5', W], { width: 3 });
      P().arcTrail(api, 17, 16, 11, 0.7 - t * 2, 2.1 - t * 2, ['#733e39', R, Y], { width: 3 });
      P().impactStar(api, 16, 16, Math.min(1, t * 1.4), [W, Y], 8);
    };
    // blood / sap spray: droplets on ballistic arcs, palette-swappable by tint
    const spray = (api, i, t) => {
      // Flash first: droplets drawn after it, or the opening burst swallows
      // them whole and the first two frames render identically.
      if (i === 0) api.ellipse(12, 12, 20, 20, '#ff0044', true);
      else if (i === 1) api.ellipse(14, 14, 18, 18, '#a22633', true);
      for (let k = 0; k < 12; k++) {
        const a = -2.7 + api.hash(k, 1, 3) * 2.4, v = 7 + api.hash(k, 2, 5) * 9;
        const x = 16 + Math.cos(a) * v * (0.25 + t * 1.5), y = 16 + Math.sin(a) * v * (0.3 + t) + t * t * 13;
        api.px(x, y, k % 3 === 0 ? '#ff0044' : '#a22633');
        if (t < 0.6) api.px(x + 1, y, '#a22633');
      }
    };
    // block spark: a shield flash with deflected chips
    const block = (api, i, t) => {
      ring(api, 16, 16, 5 + t * 5, 2, t < 0.5 ? B : '#0099db');
      shards(api, 16, 16, 6, 12, 6, [W, B], 0.7 + t);
      if (t < 0.5) api.ellipse(12, 12, 20, 20, '#0099db', false);
    };
    // shockwave: a flat ground ring expanding away from the camera
    const shock = (api, i, t) => {
      const r = 3 + ease(t) * 14;
      ring(api, 16, 22, r, 2, t < 0.5 ? W : '#c0cbdc', 0.42);
      ring(api, 16, 22, r - 3, 1, '#8b9bb4', 0.42);
      for (let k = 0; k < 6; k++) { const a = (k / 6) * TAU; api.px(16 + Math.cos(a) * (r + 2), 22 + Math.sin(a) * (r + 2) * 0.42, '#c0cbdc'); }
    };

    return { width: 32, height: 32, name: 'fx-impact', layers: [{ name: 'FX' }], states: [
      D('hit_spark', 16, false, seq(4, 16, hit)),
      D('slash_arc', 16, false, seq(4, 16, slash)),
      D('crit_cross', 14, false, seq(4, 14, crit)),
      D('blood_spray', 14, false, seq(5, 14, spray)),
      D('block_flash', 14, false, seq(4, 14, block)),
      D('shockwave', 12, false, seq(5, 12, shock))
    ] };
  }

  /* ================= ELEMENTAL ================= */
  function elementalSuite() {
    // lightning bolt striking down, forked, with a ground flash
    const bolt = (api, i, t) => {
      let x = 15;
      for (let y = 0; y < 26; y++) {
        const j = Math.round((api.hash(y, i, 3) - 0.5) * 3);
        x = Math.max(6, Math.min(25, x + j));
        api.line(x, y, x + 1, y, i === 1 ? '#ffffff' : '#2ce8f5');
        if (y === 10 || y === 17) api.line(x, y, x + (y === 10 ? -5 : 5), y + 4, '#0099db'); // fork
      }
      const r = 3 + t * 8;
      api.ellipse(16 - r, 27 - r * 0.3, 16 + r, 29, i > 1 ? '#0099db' : '#ffffff', true);
    };
    // ice nova: crystal shards rising out of a frost ring
    const ice = (api, i, t) => {
      const r = 4 + ease(t) * 10;
      ring(api, 16, 20, r, 2, '#2ce8f5', 0.5);
      for (let k = 0; k < 7; k++) {
        const a = (k / 7) * TAU, h = 3 + ease(t) * 8 * (0.6 + api.hash(k, 0, 2) * 0.6);
        const x = 16 + Math.cos(a) * r * 0.8, y = 20 + Math.sin(a) * r * 0.4;
        // Tapered crystal: a 1px vertical line reads as a fence post, so the
        // shard narrows from a 3px base to a 1px lit tip.
        for (let s = 0; s <= h; s++) {
          const hw = Math.round((1 - s / (h + 1)) * 1.6);
          api.line(x - hw, y - s, x + hw, y - s, '#0099db');
          if (hw > 0) api.px(x - hw, y - s, '#2ce8f5');
        }
        api.px(x, y - h, '#ffffff');
        api.px(x, y - h + 1, '#2ce8f5');
      }
    };
    // poison cloud: bubbling green haze that swells and settles
    const poison = (api, i, t) => {
      for (let k = 0; k < 11; k++) {
        const a = (k / 11) * TAU + i * 0.3, d = (3 + api.hash(k, 1, 4) * 7) * (0.6 + t * 0.6);
        const x = 16 + Math.cos(a) * d, y = 19 + Math.sin(a) * d * 0.6 - t * 3, r = 2 + api.hash(k, 5, 6) * 2;
        api.ellipse(x - r, y - r, x + r, y + r, k % 3 ? '#3e8948' : '#63c74d', true);
      }
      for (let k = 0; k < 4; k++) api.px(11 + k * 4, 12 - ((i * 2 + k * 3) % 8), '#63c74d'); // rising bubbles
    };
    // holy beam from above with a bright landing disc
    const holy = (api, i, t) => {
      const w = Math.round(2 + ease(t) * 5);
      api.rect(16 - w, 0, 16 + w, 26, '#fff6c9');
      api.rect(16 - w + 1, 0, 16 + w - 1, 26, '#ffffff');
      api.rect(16 - w - 1, 0, 16 - w - 1, 26, '#fee761');
      api.rect(16 + w + 1, 0, 16 + w + 1, 26, '#fee761');
      const r = 4 + ease(t) * 9;
      api.ellipse(16 - r, 26 - r * 0.32, 16 + r, 26 + r * 0.32, '#fee761', true);
      api.ellipse(16 - r + 2, 26 - r * 0.32 + 1, 16 + r - 2, 26 + r * 0.32 - 1, '#fff6c9', true);
      for (let k = 0; k < 5; k++) api.px(16 + Math.cos(k * 1.5 + t * 3) * (r + 2), 24 - k * 3, '#fee761');
    };
    // shadow implosion: dark orb pulling motes inward, then collapsing
    const shadow = (api, i, t) => {
      const r = 9 - ease(t) * 6;
      api.ellipse(16 - r, 16 - r, 16 + r, 16 + r, '#3e2347', true);
      api.ellipse(16 - r + 2, 16 - r + 2, 16 + r - 2, 16 + r - 2, '#68386c', true);
      if (t > 0.7) api.ellipse(13, 13, 19, 19, '#b55088', true);
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * TAU + t * 2, d = 14 - ease(t) * 9;
        api.px(16 + Math.cos(a) * d, 16 + Math.sin(a) * d, '#b55088');
      }
    };
    // water splash: crown of droplets off a surface ripple
    const splash = (api, i, t) => {
      const r = 4 + ease(t) * 9;
      ring(api, 16, 24, r, 1, '#0099db', 0.35);
      ring(api, 16, 24, r - 3, 1, '#2ce8f5', 0.35);
      for (let k = 0; k < 8; k++) {
        const a = -Math.PI + (k / 7) * Math.PI, d = 5 + ease(t) * 8;
        const x = 16 + Math.cos(a) * d, y = 24 + Math.sin(a) * d * 0.9 - (1 - t) * 2;
        api.px(x, y, '#2ce8f5'); api.px(x, y + 1, '#0099db');
      }
      if (t < 0.5) { api.ellipse(13, 18, 19, 25, '#0099db', true); api.ellipse(14, 19, 18, 24, '#2ce8f5', true); }
    };

    return { width: 32, height: 32, name: 'fx-elemental', layers: [{ name: 'FX' }], states: [
      D('lightning', 16, false, seq(4, 16, bolt)),
      D('ice_nova', 12, false, seq(5, 12, ice)),
      D('poison_cloud', 8, true, seqL(4, 8, poison, true)),
      D('holy_beam', 12, false, seq(5, 12, holy)),
      D('shadow_implode', 12, false, seq(5, 12, shadow)),
      D('water_splash', 14, false, seq(5, 14, splash))
    ] };
  }

  /* ================= PORTALS, BUFFS, PICKUPS ================= */
  function auraSuite() {
    // swirling portal: two counter-rotating arcs inside an ellipse mouth
    const portal = (api, i) => {
      api.ellipse(9, 4, 23, 28, '#3e2347', true);
      api.ellipse(10, 6, 22, 26, '#68386c', true);
      for (let k = 0; k < 3; k++) {
        const ph = i / 4 + k / 3;
        for (let s = 0; s < 14; s++) {
          const a = ph * TAU + s * 0.36, rr = 2 + s * 0.6;
          api.px(16 + Math.cos(a) * rr, 16 + Math.sin(a) * rr * 1.5, s > 9 ? '#b55088' : '#f6757a');
        }
      }
      api.ellipse(14, 13, 18, 19, '#ffffff', true);
      for (let k = 0; k < 4; k++) api.px(16 + Math.cos(i + k * 1.6) * 9, 16 + Math.sin(i + k * 1.6) * 13, '#2ce8f5');
    };
    // teleport out: the body column dissolves upward into motes
    const teleOut = (api, i, t) => {
      const h = Math.round(20 * (1 - t));
      api.rect(13, 27 - h, 18, 27, '#2ce8f5');
      api.rect(14, 27 - h, 17, 27, '#ffffff');
      for (let k = 0; k < 10; k++) {
        const y = 27 - h - 1 - api.hash(k, 2, 8) * 12 * t;
        api.px(10 + ((k * 5) % 13), y, k & 1 ? '#0099db' : '#2ce8f5');
      }
      ring(api, 16, 28, 3 + t * 8, 1, '#0099db', 0.35);
    };
    // heal: cross motes rising through a soft green column
    const heal = (api, i, t) => {
      for (let k = 0; k < 5; k++) {
        const ph = (t + k * 0.2) % 1, y = 28 - ph * 22, x = 16 + Math.sin(ph * 5 + k) * 7;
        const c = ph < 0.5 ? '#63c74d' : '#3e8948';
        api.line(x - 1, y, x + 1, y, c); api.line(x, y - 1, x, y + 1, c);
        if (ph < 0.3) api.px(x, y, '#fff6c9');
      }
      ring(api, 16, 27, 6 + t * 4, 1, '#63c74d', 0.35);
    };
    // buff: a rotating rune ring lifting off the ground
    const buff = (api, i, t) => {
      const y = 26 - t * 6;
      ring(api, 16, y, 10, 1, '#fee761', 0.35);
      ring(api, 16, y, 7, 1, '#feae34', 0.35);
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * TAU + t * 2.2;
        api.rect(16 + Math.cos(a) * 10 - 1, y + Math.sin(a) * 3.5 - 1, 16 + Math.cos(a) * 10 + 1, y + Math.sin(a) * 3.5 + 1, '#fff6c9');
      }
      for (let k = 0; k < 4; k++) api.px(11 + k * 4, 24 - ((i * 3 + k * 4) % 16), '#fee761');
    };
    // level-up: expanding double ring plus a vertical shaft of light
    const levelup = (api, i, t) => {
      api.rect(14, 28 - ease(t) * 26, 17, 28, '#fff6c9');
      api.rect(15, 28 - ease(t) * 26, 16, 28, '#ffffff');
      ring(api, 16, 24 - t * 10, 4 + ease(t) * 10, 2, '#fee761', 0.4);
      ring(api, 16, 27, 3 + ease(t) * 12, 1, '#feae34', 0.35);
      for (let k = 0; k < 7; k++) {
        const a = (k / 7) * TAU + t; const d = 6 + t * 7;
        api.px(16 + Math.cos(a) * d, 20 + Math.sin(a) * d * 0.6 - t * 6, '#ffffff');
      }
    };
    // pickup sparkle: a four-point twinkle that blooms and shrinks
    const sparkle = (api, i, t) => {
      const l = 3 + Math.sin(t * Math.PI) * 7;
      api.line(16 - l, 16, 16 + l, 16, '#ffffff');
      api.line(16, 16 - l, 16, 16 + l, '#ffffff');
      api.line(16 - l * 0.45, 16 - l * 0.45, 16 + l * 0.45, 16 + l * 0.45, '#fee761');
      api.line(16 + l * 0.45, 16 - l * 0.45, 16 - l * 0.45, 16 + l * 0.45, '#fee761');
      api.ellipse(14, 14, 18, 18, '#fff6c9', true);
      for (let k = 0; k < 4; k++) api.px(16 + Math.cos(k * 1.57 + t * 3) * 11, 16 + Math.sin(k * 1.57 + t * 3) * 11, '#fee761');
    };

    return { width: 32, height: 32, name: 'fx-aura', layers: [{ name: 'FX' }], states: [
      D('portal_swirl', 8, true, seq(4, 8, portal)),
      D('teleport_out', 12, false, seq(5, 12, teleOut)),
      D('heal_aura', 8, true, seqL(4, 8, heal, true)),
      D('buff_ring', 8, true, seqL(4, 8, buff)),
      D('level_up', 12, false, seq(5, 12, levelup)),
      D('pickup_sparkle', 12, false, seq(4, 12, sparkle))
    ] };
  }

  /* ================= GUNPLAY / SCI-FI BEAMS ================= */
  function beamSuite() {
    // muzzle flash: star burst at the barrel with smoke on the tail frames
    const muzzle = (api, i, t) => {
      const l = 12 - i * 2.5;
      api.line(4, 16, 4 + l, 16, '#fff6c9', 3);
      api.line(4, 16, 4 + l * 0.7, 16, '#ffffff', 5);
      shards(api, 6, 16, 3, 5 + l * 0.6, 8, ['#fee761', '#feae34'], 0.3);
      if (i > 1) for (let k = 0; k < 5; k++) api.ellipse(8 + k * 3, 13 - k, 11 + k * 3, 16 - k, '#8b9bb4', true);
    };
    // travelling laser bolt with a bright head and fading tail
    const laser = (api, i) => {
      const x = 4 + i * 7;
      api.line(x - 9, 16, x, 16, '#a22633'); api.line(x - 6, 16, x, 16, '#e43b44');
      api.line(x - 3, 15, x + 2, 15, '#ff0044'); api.line(x - 3, 16, x + 3, 16, '#ffffff'); api.line(x - 3, 17, x + 2, 17, '#ff0044');
      api.px(x + 4, 16, '#ffffff');
      for (let k = 0; k < 3; k++) api.px(x - 10 - k * 3, 16 + (k & 1 ? 1 : -1), '#a22633');
    };
    // charged plasma orb pulsing in place before release
    const plasma = (api, i, t) => {
      const r = 5 + Math.sin(t * Math.PI * 2) * 2;
      api.ellipse(16 - r, 16 - r, 16 + r, 16 + r, '#265c42', true);
      api.ellipse(16 - r + 1, 16 - r + 1, 16 + r - 1, 16 + r - 1, '#3e8948', true);
      api.ellipse(16 - r + 3, 16 - r + 3, 16 + r - 3, 16 + r - 3, '#63c74d', true);
      api.ellipse(15, 15, 17, 17, '#ffffff', true);
      for (let k = 0; k < 6; k++) { const a = (k / 6) * TAU + t * 4; api.px(16 + Math.cos(a) * (r + 3), 16 + Math.sin(a) * (r + 3), '#63c74d'); }
    };
    // continuous beam with a scrolling core, for charge weapons
    const beam = (api, i) => {
      api.rect(0, 14, 31, 18, '#124e89');
      api.rect(0, 15, 31, 17, '#0099db');
      for (let x = 0; x < 32; x++) api.px(x, 16, (x + i * 2) % 4 < 2 ? '#ffffff' : '#2ce8f5');
      for (let k = 0; k < 6; k++) { const x = (k * 6 + i * 3) % 32; api.px(x, 12 + (k & 1 ? 0 : 8), '#2ce8f5'); }
    };
    // bullet impact on armour: sparks plus a puff, no fire
    const ricochet = (api, i, t) => {
      shards(api, 18, 16, 1, 4 + ease(t) * 9, 7, ['#ffffff', '#fee761'], 1.1);
      if (t < 0.5) api.ellipse(16, 14, 20, 18, '#fff6c9', true);
      for (let k = 0; k < 5; k++) api.px(18 - k * 2 - t * 6, 16 + Math.round(Math.sin(k) * 3), '#8b9bb4');
    };

    return { width: 32, height: 32, name: 'fx-beam', layers: [{ name: 'FX' }], states: [
      D('muzzle_flash', 18, false, seq(4, 18, muzzle)),
      D('laser_bolt', 16, true, seq(4, 16, laser)),
      D('plasma_charge', 10, true, seqL(4, 10, plasma)),
      D('beam_loop', 14, true, seq(4, 14, beam)),
      D('ricochet', 16, false, seq(4, 16, ricochet))
    ] };
  }

  return { explosionSuite, smokeSuite, impactSuite, elementalSuite, auraSuite, beamSuite };
})();
