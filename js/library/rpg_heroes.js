/* PixelForge Studio — RPG Heroes & Townsfolk pack.
   Class-based humanoids (knight, ranger, cleric, rogue) + townsfolk showcase,
   built on PF.Chars.drawHumanoid with custom palettes, behind-body garb
   (capes/wings drawn first) and post-outline headgear overlays. 32x32. */
window.PF = window.PF || {};
PF.RPG = (() => {
  const P = () => PF.Pixel;
  const C = h => PF.Color.hexToU32(h);
  const D = (name, fps, loop, frames) => ({ name, fps, loop, frames });
  const Fr = (duration, paint) => ({ duration, paint });
  const ms = fps => Math.round(1000 / fps);
  const OUT = '#181425';
  const OUT32 = C(OUT); // cached: outline color resolved once, not per frame
  /* Value-only lift. Palette.ramp drifts hue and bleeds saturation, which turns
     a purple hat crown grey; a highlight on cloth only moves value. */
  const mix = (hex, to, t) => {
    const [r, g, b] = PF.Color.rgba(C(hex));
    const q = v => Math.max(0, Math.min(255, Math.round(v)));
    return PF.Color.u32ToHex(PF.Color.fromRGBA(q(r + (to - r) * t), q(g + (to - g) * t), q(b + (to - b) * t), 255));
  };
  const lit = h => mix(h, 255, 0.28);

  /* ================= palettes ================= */
  const BASE = { skin: '#e8b796', skinSh: '#c28569', hair: '#3e2731', hairSh: '#262b44', hairHi: '#5e3b4d',
    shirt: '#0099db', shirtSh: '#124e89', shirtHi: '#2ce8f5', pants: '#3a4466', pantsSh: '#262b44',
    boots: '#262b44', belt: '#733e39', buckle: '#fee761', outline: OUT, lip: '#a26a5a' };
  const KNIGHT = { ...BASE, hair: '#8b9bb4', hairSh: '#5a6988', hairHi: '#e6ebf7', shirt: '#8b9bb4', shirtSh: '#5a6988', shirtHi: '#e6ebf7' };
  const RANGER = { ...BASE, hair: '#3e8948', hairSh: '#265c42', hairHi: '#63c74d', shirt: '#b86f50', shirtSh: '#733e39', shirtHi: '#e4a672', boots: '#3e2731', belt: '#3e2731', buckle: '#c0cbdc' };
  const CLERIC = { ...BASE, skin: '#f2c094', hair: '#fee761', hairSh: '#feae34', hairHi: '#fff6c9', shirt: '#e8ecf5', shirtSh: '#8b9bb4', shirtHi: '#ffffff', pants: '#c0cbdc', pantsSh: '#8b9bb4', boots: '#b86f50', belt: '#fee761', buckle: '#ffffff' };
  const ROGUE = { ...BASE, skin: '#d99a78', skinSh: '#a26a5a', hair: '#262b44', hairSh: '#181425', hairHi: '#5a6988', shirt: '#3a4466', shirtSh: '#262b44', shirtHi: '#5a6988', pants: '#262b44', pantsSh: '#181425', boots: '#181425', belt: '#181425', buckle: '#8b9bb4' };
  const KING = { ...BASE, hair: '#c0cbdc', hairSh: '#8b9bb4', hairHi: '#ffffff', shirt: '#68386c', shirtSh: '#3e2347', shirtHi: '#b55088', boots: '#733e39', belt: '#fee761', buckle: '#ff0044', blush: '#f6757a' };
  const GUARD = { ...BASE, hair: '#5a6988', hairSh: '#3a4466', hairHi: '#c0cbdc', shirt: '#a22633', shirtSh: '#5c1a1a', shirtHi: '#f6757a', belt: '#3e2731', buckle: '#c0cbdc' };
  const SMITH = { ...BASE, skin: '#d99a78', skinSh: '#a26a5a', shirt: '#733e39', shirtSh: '#3e2731', shirtHi: '#b86f50', pants: '#3e2731', belt: '#262b44', buckle: '#8b9bb4' };
  const ELDER = { ...BASE, hair: '#c0cbdc', hairSh: '#8b9bb4', hairHi: '#ffffff', shirt: '#124e89', shirtSh: '#1c2a44', shirtHi: '#4a7fb5', boots: '#3e2731', belt: '#b86f50' };
  const PEASANT = { ...BASE, hair: '#b86f50', hairSh: '#733e39', hairHi: '#e4a672', shirt: '#ead4aa', shirtSh: '#c28569', shirtHi: '#fff6c9', pants: '#5a6988', boots: '#733e39', belt: '#733e39', buckle: '#8b9bb4' };
  const GOBLIN = { ...BASE, skin: '#63c74d', skinSh: '#3e8948', hair: '#262b44', hairSh: '#181425', hairHi: '#3a4466', shirt: '#733e39', shirtSh: '#3e2731', shirtHi: '#b86f50', pants: '#3e2731', pantsSh: '#262b44', boots: '#181425', belt: '#262b44', buckle: '#63c74d', lip: '#265c42' };
  const NECRO = { ...BASE, skin: '#c0cbdc', skinSh: '#8b9bb4', hair: '#3e2347', hairSh: '#262b44', hairHi: '#68386c', shirt: '#3e2347', shirtSh: '#262b44', shirtHi: '#68386c', pants: '#262b44', pantsSh: '#181425', boots: '#181425', belt: '#181425', buckle: '#b55088', lip: '#5c1a1a' };
  const DEMON = { ...BASE, skin: '#e43b44', skinSh: '#a22633', hair: '#3e2731', hairSh: '#262b44', hairHi: '#f6757a', shirt: '#5c1a1a', shirtSh: '#3e2731', shirtHi: '#e43b44', pants: '#3e2731', pantsSh: '#262b44', boots: '#181425', belt: '#181425', buckle: '#fee761', lip: '#5c1a1a' };

  /* ================= painter plumbing ================= */
  // pre/post hooks frame the shared humanoid draw: garb behind, headgear after.
  const N = (cfg, o = {}, fi = 0) => (buf, W, H) => {
    const api = P().makeApi(buf, W, H);
    if (o.pre) o.pre(api, cfg, fi);
    if (cfg.lying) {
      PF.Chars.drawLying(api, buf, W, H, cfg);
      buf.set(PF.Raster.outline(buf, W, H, OUT32));
    } else {
      PF.Chars.drawHumanoid(api, buf, W, H, cfg);
    }
    if (o.post) o.post(api, cfg, fi);
    if (o.fade) fadeOut(buf, W, H, o.fade, o.seed || 0);
  };
  function fadeOut(buf, W, H, t, seed) {
    if (t <= 0) return;
    // 4x4 Bayer ordered dither: cheaper than a per-pixel hash (one table
    // lookup) and dissolves more evenly, no clumping on large bodies.
    const B = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
    const th = Math.max(0, Math.min(1, t)), nudge = (seed % 5) * 0.004;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (B[((y & 3) << 2) | (x & 3)] / 16 + nudge < th) buf[y * W + x] = 0;
    }
  }

  /* Behind-body garb: cape / wings / tail. pre-drawn so the body overlaps.
     fi = stride frame index: the cape hem sways 1px with the walk cycle. */
  function garb(api, cfg, o, fi = 0) {
    const bob = cfg.bob || 0, kb = cfg.kb || 0, side = cfg.facing === 'side';
    const Y = y => y + bob, X = x => x + kb;
    const sw = (fi % 2) ? 1 : 0;
    if (o.cape) {
      const c = o.cape, sh = o.capeSh || '#262b44';
      if (side) {
        // shoulder cap + triangle flaring back; the pointed tip kicks up
        // on alternate stride frames like a wind-caught cloak
        const kick = sw ? -1 : 0;
        api.rect(X(9), Y(12), X(12), Y(14), c);
        api.rect(X(7), Y(13), X(11), Y(18), c);
        api.rect(X(5), Y(18), X(11), Y(23 + kick), c);
        api.rect(X(4 - sw), Y(22 + kick), X(7), Y(25 + kick), c); // pointed tip
        api.rect(X(4 - sw), Y(22 + kick), X(5 - sw), Y(25 + kick), sh);
        api.rect(X(7), Y(13), X(8), Y(18), sh); // neck shade
        api.line(X(10), Y(14), X(6 - sw), Y(23 + kick), sh, 1); // fold
      } else {
        // FRONT view: the cape hangs BEHIND the body. All you may see is the
        // shoulder line beside the head, the outer edges past the arms, and
        // the hem below the legs. It must never flank the torso — a wide
        // flanking shape reads as a skirt or a pair of wings, not a cloak.
        api.rect(X(8), Y(11), X(23), Y(13), c);        // shoulder line
        api.rect(X(8), Y(13), X(23), Y(25), c);        // body (hidden by torso/arms)
        api.rect(X(9), Y(25), X(22), Y(27), c);        // hem
        api.rect(X(8), Y(13), X(8), Y(24), sh);        // outer shade
        api.rect(X(23), Y(13), X(23), Y(24), sh);
        api.rect(X(9), Y(26), X(22), Y(27), sh);       // hem underside
        api.rect(X(9), Y(11), X(10), Y(12), sh); api.rect(X(21), Y(11), X(22), Y(12), sh);
      }
    }
    if (o.wings) {
      const mem = o.wings, dark = o.wingsSh || '#5c1a1a';
      const wing = (sx, dir) => {
        // membrane fan: scanlines from shoulder (sx,14) to tip (sx+dir*9, 8)
        for (let i = 0; i <= 6; i++) {
          const t = i / 6, x0 = sx + dir * Math.round(t * 9), y0 = Y(14 - t * 6);
          api.line(x0, y0, x0, y0 + 3 + Math.round((1 - t) * 3), i % 2 ? mem : dark, 1);
        }
        api.line(sx, Y(14), sx + dir * 9, Y(8), dark, 2); // finger
        api.px(sx + dir * 9, Y(8), '#fee761'); // claw
      };
      if (side) { wing(X(12), -1); }
      else { wing(X(10), -1); wing(X(21), 1); }
    }
    if (o.tail) {
      const c = o.tail;
      if (side) { api.line(X(12), Y(22), X(5 - sw), Y(26), c, 2); api.rect(X(3 - sw), Y(25), X(5 - sw), Y(27), c); }
      else { api.line(X(21), Y(22), X(27), Y(26), c, 2); api.rect(X(26), Y(25), X(28), Y(27), c); api.px(X(27), Y(24), o.tailTip || '#fee761'); }
    }
  }

  /* Cloak seen from BEHIND. Facing away, the cape hangs between the viewer and
     the body, so it is drawn in `post` — over the torso — and covers the back
     from the collar to just above the boots. This is what makes the up-facing
     read as a caped character rather than a bare back. */
  function capeBack(api, cfg, o) {
    if (!o.cape || cfg.facing !== 'up' || cfg.lying) return;
    const bob = cfg.bob || 0, kb = cfg.kb || 0;
    const Y = y => y + bob, X = x => x + kb;
    const c = o.cape, sh = o.capeSh || '#262b44';
    api.rect(X(9), Y(11), X(22), Y(12), c);          // collar
    api.rect(X(8), Y(12), X(23), Y(24), c);          // back panel
    api.rect(X(9), Y(24), X(22), Y(25), c);          // taper to the hem
    api.rect(X(8), Y(12), X(9), Y(25), sh);          // outer shade
    api.rect(X(22), Y(12), X(23), Y(25), sh);
    api.line(X(15), Y(13), X(15), Y(24), sh, 1);     // centre folds
    api.line(X(16), Y(13), X(16), Y(24), sh, 1);
    api.rect(X(9), Y(25), X(22), Y(25), sh);         // hem underside
    api.px(X(12), Y(11), o.capeClasp || '#feae34');  // clasp
    api.px(X(19), Y(11), o.capeClasp || '#feae34');
  }

  /* Headgear overlays: crown / hood / helm / beard / skull / circlet / ears / horns. */
  function headgear(api, cfg, o) {
    if (!o) return;
    const bob = cfg.bob || 0, kb = cfg.kb || 0, hd = cfg.headDy || 0, side = cfg.facing === 'side';
    // Everything here is worn ON the head, so it rides headDy. Without this the
    // head slides out from under a static hood/helm during the breathing idle,
    // which both looks wrong and makes the idle change almost no pixels.
    // Shoulder pads are the one exception — they follow the body (BY).
    /* The +1 is a hard safety gutter, not padding: the outline pass can only
       write inside the buffer, so any headgear authored on y0 loses its outline
       and reads as a flat slice off the top of the frame. Author one row lower
       and row 0 stays free for the outline to close over it. */
    const Y = y => y + bob + hd + 1, BY = y => y + bob, X = x => x + kb;
    if (o.hood) {
      const c = o.hood, sh = o.hoodSh || '#193c3e';
      if (side) {
        api.rect(X(10), Y(1), X(21), Y(5), c); api.rect(X(10), Y(1), X(12), Y(5), sh);
        api.rect(X(9), Y(5), X(11), Y(13), c); api.px(X(15), Y(1), c); api.px(X(16), Y(1), c);
      } else {
        api.rect(X(9), Y(1), X(22), Y(5), c); api.rect(X(9), Y(1), X(11), Y(5), sh); api.rect(X(20), Y(1), X(22), Y(5), sh);
        api.px(X(14), Y(1), c); api.px(X(15), Y(1), c); api.px(X(16), Y(1), c);
        api.rect(X(9), Y(5), X(22), Y(6), sh);
      }
    }
    if (o.hat) {
      // Floppy brimmed hat: crown + band + wide brim. The head only has four
      // rows of clearance above it, so the plume sweeps back horizontally
      // rather than upward - a vertical feather would fall off the canvas.
      const c = o.hat, band = o.hatBand || '#262b44', sh = o.hatSh || '#262b44', plume = o.hatPlume;
      /* The old form was a two-row crown over an 18px brim sitting at rows 4-5,
         i.e. a plank as wide as the shoulders balanced on top of the skull with
         its own outline running underneath it. At a glance it read as a floating
         banner, not as a hat. A hat has to OCCLUDE the head it is worn on: the
         crown is three rows tall, the brim is narrower than the shoulders, and
         it sits at the brow (rows 6-7) with the hair emerging below it. */
      const cx = side ? 15 : 16;
      api.rect(X(cx - 4), Y(1), X(cx + 3), Y(1), c);          // crown cap
      api.rect(X(cx - 5), Y(2), X(cx + 4), Y(4), c);          // crown body
      api.rect(X(cx - 5), Y(2), X(cx - 4), Y(4), lit(c));     // lit side
      api.rect(X(cx + 4), Y(2), X(cx + 4), Y(4), sh);
      api.rect(X(cx - 5), Y(5), X(cx + 4), Y(5), band);       // hatband
      api.rect(X(cx - 7), Y(6), X(cx + 6), Y(7), c);          // brim
      api.rect(X(cx - 7), Y(7), X(cx + 6), Y(7), sh);         // brim underside
      api.px(X(cx - 7), Y(6), sh); api.px(X(cx + 6), Y(6), sh);
      if (plume) {
        /* Rooted AT the hatband and swept back over the crown, so it grows out
           of the hat instead of hanging in the air beside it. */
        api.line(X(cx - 5), Y(5), X(cx - 8), Y(2), plume, 1);
        api.line(X(cx - 5), Y(4), X(cx - 7), Y(2), plume, 1);   // second strand = width
        api.px(X(cx - 9), Y(2), plume); api.px(X(cx - 9), Y(1), lit(plume));
        api.px(X(cx - 8), Y(1), plume);                          // the curl at the tip
      }
    }
    if (o.crown) {
      const c = o.crown, sh = o.crownSh || '#feae34';
      if (side) {
        api.rect(X(12), Y(1), X(19), Y(2), c);
        api.px(X(13), Y(1), c); api.px(X(15), Y(1), c); api.px(X(17), Y(1), c);
        api.px(X(15), Y(1), o.gem || '#ff0044'); api.px(X(16), Y(1), o.gem || '#ff0044');
      } else {
        api.rect(X(11), Y(1), X(20), Y(2), c); api.rect(X(11), Y(2), X(20), Y(2), sh);
        [12, 14, 16, 18].forEach(x => api.px(X(x), Y(1), c));
        api.px(X(15), Y(1), o.gem || '#ff0044'); api.px(X(16), Y(1), o.gem || '#ff0044');
      }
    }
    if (o.helm) {
      const c = o.helm, sh = o.helmSh || '#5a6988', hi = o.helmHi || '#e6ebf7';
      if (side) {
        api.rect(X(10), Y(1), X(21), Y(4), c); api.rect(X(10), Y(1), X(21), Y(1), hi); api.rect(X(10), Y(4), X(21), Y(4), sh);
        api.rect(X(18), Y(7), X(19), Y(11), sh);
      } else {
        api.rect(X(9), Y(1), X(22), Y(4), c); api.rect(X(9), Y(1), X(22), Y(1), hi); api.rect(X(9), Y(4), X(22), Y(4), sh);
        api.rect(X(15), Y(8), X(16), Y(12), sh);
      }
    }
    if (o.beard) {
      /* A beard TAPERS. The long form used to be a flat 6x8 rectangle reaching
         y21 — the full height of the torso — so the monk rendered as a figure
         with a blank white board strapped to its chest. Jaw at full width, then
         two steps in, then a point; shading down the right so it has volume. */
      const c = o.beard, sh = o.beardSh || '#8b9bb4', long = o.beardLong;
      if (side) {
        api.rect(X(15), Y(11), X(20), Y(12), c);              // jaw
        api.rect(X(19), Y(11), X(20), Y(12), sh);
        if (long) {
          api.rect(X(16), Y(13), X(19), Y(14), c); api.px(X(19), Y(13), sh); api.px(X(19), Y(14), sh);
          api.rect(X(17), Y(15), X(18), Y(16), c); api.px(X(18), Y(16), sh);
        } else { api.rect(X(16), Y(13), X(19), Y(13), c); api.px(X(19), Y(13), sh); }
      } else {
        api.rect(X(12), Y(10), X(19), Y(12), c);              // jaw line, cheek to cheek
        api.rect(X(18), Y(10), X(19), Y(12), sh);
        api.px(X(12), Y(10), sh); api.px(X(19), Y(10), sh);   // cheek corners tucked in
        if (long) {
          api.rect(X(13), Y(13), X(18), Y(14), c); api.rect(X(17), Y(13), X(18), Y(14), sh);
          api.rect(X(14), Y(15), X(17), Y(16), c); api.rect(X(16), Y(15), X(17), Y(16), sh);
          api.rect(X(15), Y(17), X(16), Y(17), c); api.px(X(16), Y(17), sh);
        } else { api.rect(X(13), Y(13), X(18), Y(13), c); api.rect(X(17), Y(13), X(18), Y(13), sh); }
      }
    }
    if (o.skull) {
      const c = '#e8ecf5', sh = '#8b9bb4';
      if (side) {
        api.rect(X(13), Y(6), X(20), Y(11), c); api.rect(X(19), Y(6), X(20), Y(11), sh);
        api.rect(X(16), Y(8), X(18), Y(9), OUT); api.px(X(17), Y(8), '#b55088');
        api.line(X(16), Y(11), X(18), Y(11), OUT, 1);
      } else {
        api.rect(X(12), Y(6), X(19), Y(12), c); api.rect(X(18), Y(6), X(19), Y(12), sh); api.rect(X(12), Y(12), X(19), Y(12), sh);
        api.rect(X(13), Y(8), X(14), Y(9), OUT); api.rect(X(17), Y(8), X(18), Y(9), OUT);
        api.px(X(13), Y(8), '#b55088'); api.px(X(17), Y(8), '#b55088');
        api.px(X(15), Y(10), OUT); api.line(X(14), Y(11), X(17), Y(11), OUT, 1);
      }
    }
    if (o.circlet) {
      if (side) { api.line(X(11), Y(3), X(20), Y(3), o.circlet, 1); api.px(X(15), Y(3), o.gem || '#ff0044'); }
      else { api.line(X(10), Y(3), X(21), Y(3), o.circlet, 1); api.px(X(15), Y(3), o.gem || '#ff0044'); api.px(X(16), Y(3), o.gem || '#ff0044'); }
    }
    if (o.goblinEars) {
      const c = cfg.pal.skin, sh = cfg.pal.skinSh;
      if (side) {
        api.line(X(19), Y(9), X(25), Y(5), c, 2); api.line(X(19), Y(9), X(24), Y(6), sh, 1);
        api.line(X(12), Y(9), X(8), Y(6), c, 2);
      } else {
        api.line(X(9), Y(10), X(4), Y(6), c, 2); api.line(X(9), Y(10), X(5), Y(7), sh, 1);
        api.line(X(22), Y(10), X(27), Y(6), c, 2); api.line(X(22), Y(10), X(26), Y(7), sh, 1);
      }
    }
    if (o.horns) {
      const c = o.horns, sh = o.hornsSh || '#8b9bb4';
      // Horns sweep outward, never up: the frame has no rows above y1 to spare,
      // and a tip drawn off-canvas comes back as a horn that has been chopped.
      if (side) {
        api.line(X(13), Y(3), X(10), Y(1), c, 2); api.line(X(18), Y(3), X(20), Y(1), c, 2);
        api.px(X(10), Y(1), sh); api.px(X(20), Y(1), sh);
      } else {
        api.line(X(12), Y(4), X(8), Y(1), c, 2); api.line(X(19), Y(4), X(23), Y(1), c, 2);
        api.px(X(8), Y(1), sh); api.px(X(23), Y(1), sh);
      }
    }
    if (o.pads) {
      const c = o.pads, sh = o.padsSh || '#5a6988';
      if (side) { api.rect(X(11), BY(13), X(15), BY(15), c); api.rect(X(11), BY(15), X(15), BY(15), sh); }
      else {
        api.rect(X(9), BY(13), X(12), BY(15), c); api.rect(X(19), BY(13), X(22), BY(15), c);
        api.rect(X(9), BY(15), X(12), BY(15), sh); api.rect(X(19), BY(15), X(22), BY(15), sh);
        api.px(X(10), BY(13), '#ffffff'); api.px(X(20), BY(13), '#ffffff');
      }
    }
  }

  /* ================= shared suite ================= */
  function humanoidSuite(pal, label, o = {}) {
    const states = [];
    const FP = PF.Chars.frontPose, SP = PF.Chars.sidePose;
    // garb runs BEFORE the body (behind it); headgear runs after the outline.
    const pre = (o.garb && (o.garb.cape || o.garb.wings || o.garb.tail)) ? (api, cfg, fi) => garb(api, cfg, o.garb, fi || 0) : null;
    const post = (api, cfg, fi) => { if (o.garb) capeBack(api, cfg, o.garb); if (o.head) headgear(api, cfg, o.head); if (o.post) o.post(api, cfg, fi); };
    // Idle: four DISTINCT frames of a slow breath. The head settles into the
    // shoulders and the arms follow half a beat later; nothing leaves the
    // ground. The old form was `bob = -(i % 2)` at 6fps, i.e. two poses
    // bouncing the whole body (feet included) three times a second - which
    // reads as hopping, not breathing.
    const IDLE_HEAD = [0, 1, 1, 0], IDLE_ARM = [0, 0, 1, 1];
    for (const [sname, facing] of [['idle_down', 'down'], ['idle_side', 'side'], ['idle_up', 'up']]) {
      const frames = [];
      for (let i = 0; i < 4; i++) {
        const cfg = facing === 'side' ? SP(i, 4, 0, pal) : FP(i, 4, 0, pal, facing);
        const hd = IDLE_HEAD[i], ad = IDLE_ARM[i];
        cfg.legA = { dx: 0, dy: 0 }; cfg.legB = { dx: 0, dy: 0 }; cfg.legF = { dx: 0, dy: 0 };
        cfg.armL = { dx: 0, dy: ad }; cfg.armR = { dx: 0, dy: ad };
        cfg.armF = { dx: 0, dy: ad }; cfg.armB = { dx: 0, dy: ad };
        cfg.headDy = hd; cfg.bob = 0; cfg.eye = i === 3 ? 'closed' : 'open';
        frames.push(Fr(ms(4), N(cfg, { pre, post }, i)));
      }
      states.push(D(sname, 4, true, frames));
    }
    const amp = o.sneak ? 3 : 2;
    // walk x6 — six beats, not four, so the cycle has room for a real
    // heel-strike and toe-off. Dust lifts on the two contact frames.
    for (const [sname, facing] of [['walk_down', 'down'], ['walk_side', 'side'], ['walk_up', 'up']]) {
      const frames = [];
      for (let i = 0; i < 6; i++) {
        /* A 6-sample sine repeats its magnitude on frames 1/2 and 4/5, which
           renders two identical poses and stalls the cycle. Riding the bob on
           a quarter-phase cosine gives six distinct heights instead. */
        const a = i / 6 * Math.PI * 2;
        /* The bob is clamped to one row of lift. Two rows is what was slicing
           headgear off the top of the frame on every walk and run — the outline
           pass cannot draw outside the buffer — and a 2px body lift also pulls
           the planted feet off the ground line the engine sits its shadow on.
           The arms take over the quarter-phase cosine so all six frames stay
           distinct without it. */
        const bob = Math.max(-1, Math.min(0, Math.round(-Math.abs(Math.sin(a)) * amp - Math.cos(a) * 0.9)) + (o.sneak ? -1 : 0));
        const aw = Math.round(Math.cos(a) * 2);
        const dust = (i === 1 || i === 4) ? [[13, 27, '#c0cbdc'], [14, 26, '#8b9bb4'], [18, 27, '#c0cbdc']] : null;
        const cfg = facing === 'side'
          ? SP(i, 6, amp, pal, { bob, tool: { kind: 'none', dust } })
          : FP(i, 6, amp, pal, facing, { bob, tool: { kind: 'none', dust } });
        if (facing === 'side') { cfg.armF = { dx: -aw, dy: 0 }; cfg.armB = { dx: aw, dy: 0 }; }
        else { cfg.armL = { dx: 0, dy: -aw }; cfg.armR = { dx: 0, dy: aw }; }
        frames.push(Fr(ms(6), N(cfg, { pre, post }, i)));
      }
      states.push(D(sname, 6, true, frames));
    }
    // run x6 — wider stride than the walk, so a sprint reads as another gear.
    // Every facing kicks up dust at the footfalls, and the bob is clamped so no
    // frame dips below the floor line into the engine's shadow row.
    for (const [sname, facing] of [['run_down', 'down'], ['run_side', 'side'], ['run_up', 'up']]) {
      const frames = [];
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        const bob = Math.max(-1, Math.min(0, Math.round(-Math.abs(Math.sin(a)) * 2 - Math.cos(a))) + (o.sneak ? -1 : 0));
        const aw = Math.round(Math.cos(a) * 2);
        const dust = (i === 0 || i === 3) ? [[12, 27, '#c0cbdc'], [19, 27, '#c0cbdc'], [15, 26, '#8b9bb4']]
          : i === 4 ? [[11, 27, '#8b9bb4'], [20, 27, '#c0cbdc']] : null;
        const cfg = facing === 'side'
          ? SP(i, 6, 3, pal, { bob, tool: { kind: 'none', dust } })
          : FP(i, 6, 3, pal, facing, { bob, tool: { kind: 'none', dust } });
        if (facing === 'side') { cfg.armF = { dx: -aw, dy: 0 }; cfg.armB = { dx: aw, dy: 0 }; }
        else { cfg.armL = { dx: 0, dy: -aw }; cfg.armR = { dx: 0, dy: aw }; }
        frames.push(Fr(ms(10), N(cfg, { pre, post }, i)));
      }
      states.push(D(sname, 10, true, frames));
    }
    // attack — a held windup, ONE fast strike frame, an impact, then the blade
    // swinging through and behind the torso. The old five frames stepped almost
    // evenly, which reads as a metronome: the uneven timing is the weight.
    const ADUR = [200, 120, 45, 70, 130, 165], ADY = [-3, -4, -2, -2, -2, -1];
    // Profile can lay the blade back over the shoulder; square-on views cannot,
    // because the tip then lands on the face instead of above it.
    const PROF = [-2.45, -2.85, -0.35, 0.6, 0.62, 0.3];
    const FRONT = [-1.75, -2.05, -0.15, 0.6, 0.62, 0.35];
    const arcFor = (ang, i, r) => i === 2 || i === 3 ? [ang[i] - 1.15, ang[i], r]
      : (i === 4 ? [ang[i] - 0.7, ang[i], r - 1] : null);
    {
      const frames = [];
      if (o.weapon === 'bow') {
        // nock, two-frame draw, a long held ANCHOR, then a 55ms release. The
        // hold is the frame that sells aim; equal time everywhere made the shot
        // never land.
        const pulls = [0, 0.4, 0.8, 1, 0.05, 0], bowDur = [120, 110, 120, 190, 55, 150], bar = [-1, -2, -3, -4, -2, -1];
        for (let i = 0; i < 6; i++) {
          const cfg = SP(i, 6, 1, pal, { tool: { kind: 'bow', pull: pulls[i], arrow: i > 0 && i < 4 }, headDy: i === 5 ? 1 : 0 });
          cfg.armF = { dx: 2, dy: bar[i] };
          cfg.kb = i === 4 ? 1 : (i === 3 ? -1 : 0);
          cfg.eye = i === 3 ? 'closed' : 'open';
          frames.push(Fr(bowDur[i], N(cfg, { pre, post }, i)));
        }
        states.push(D('bow_side', 10, true, frames));
      } else {
        for (let i = 0; i < 6; i++) {
          const cfg = SP(i, 6, 1, pal, { tool: { kind: o.weapon || 'sword', angle: PROF[i],
            arc: arcFor(PROF, i, 10), impact: i === 3 ? [3, 2, 0.2] : null, behind: i >= 4 } });
          cfg.armF = { dx: 2, dy: ADY[i] };
          cfg.kb = [0, 1, 2, 2, 1, 0][i];
          frames.push(Fr(ADUR[i], N(cfg, { pre, post }, i)));
        }
        states.push(D('attack_side', 10, true, frames));
      }
    }
    // Omni attacks: the same beat played on the front and back facings so
    // top-down games get directional combat.
    for (const [sname, facing] of [['attack_down', 'down'], ['attack_up', 'up']]) {
      const frames = [];
      if (o.weapon === 'bow') {
        const pulls = [0, 0.4, 0.8, 1, 0.05, 0], dur = [120, 110, 120, 190, 55, 150];
        const arms = [{ dx: 0, dy: -1 }, { dx: 1, dy: -2 }, { dx: 2, dy: -3 }, { dx: 2, dy: -4 }, { dx: 1, dy: -2 }, { dx: 0, dy: -1 }];
        for (let i = 0; i < 6; i++) {
          const cfg = FP(i, 6, 1, pal, facing, { tool: { kind: 'bow', pull: pulls[i], arrow: i > 0 && i < 4 }, headDy: i === 5 ? 1 : 0 });
          cfg.armL = arms[i]; // bow arm rises as the string comes back
          frames.push(Fr(dur[i], N(cfg, { pre, post }, i)));
        }
      } else {
        for (let i = 0; i < 6; i++) {
          const cfg = FP(i, 6, 1, pal, facing, { tool: { kind: o.weapon || 'sword', angle: FRONT[i],
            arc: arcFor(FRONT, i, 9), impact: i === 3 ? [3, 2, 0.2] : null, behind: i >= 4 } });
          cfg.armR = { dx: 1, dy: ADY[i] };
          cfg.kb = [0, 1, 2, 2, 1, 0][i];
          frames.push(Fr(ADUR[i], N(cfg, { pre, post }, i)));
        }
      }
      states.push(D(sname, 10, true, frames));
    }
    if (o.shield) {
      const frames = [];
      const bobs = [0, -1, 0, -1]; // seamless sway loop, no hold hitch
      for (let i = 0; i < 4; i++) {
        const cfg = FP(i, 4, 0, pal, 'down', { tool: { kind: 'shield' }, bob: bobs[i], eye: 'open' });
        cfg.armL = { dx: 1, dy: -2 };
        frames.push(Fr(ms(8), N(cfg, { pre, post }, i)));
      }
      states.push(D('block', 8, true, frames));
    }
    if (o.cast) {
      const frames = [];
      for (let i = 0; i < 4; i++) {
        const cfg = FP(i, 4, 0, pal, 'down', { tool: { kind: 'staff' }, bob: i === 2 ? -1 : 0, eye: i === 3 ? 'closed' : 'open' });
        cfg.armR = { dx: 1, dy: -4 };
        frames.push(Fr(ms(7), N(cfg, { pre, post: (api, c, fi) => {
          post(api, c, fi);
          P().particles(api, 16 + (c.kb || 0), 11 + (c.bob || 0), 7, fi / 4, o.castColors || ['#fee761', '#ffffff', '#2ce8f5']);
        } }, i)));
      }
      states.push(D('cast', 7, true, frames));
      // side-view cast: same radiant beat, for side-scrolling casters
      const sideFrames = [];
      for (let i = 0; i < 4; i++) {
        const cfg = SP(i, 4, 0, pal, { bob: i === 2 ? -1 : 0, eye: i === 3 ? 'closed' : 'open' });
        cfg.armF = { dx: 2, dy: -4 };
        cfg.tool = { kind: 'staff' };
        sideFrames.push(Fr(ms(7), N(cfg, { pre, post: (api, c, fi) => {
          post(api, c, fi);
          P().particles(api, 24 + (c.kb || 0), 10 + (c.bob || 0), 7, fi / 4, o.castColors || ['#fee761', '#ffffff', '#2ce8f5']);
        } }, i)));
      }
      states.push(D('cast_side', 7, true, sideFrames));
    }
    /* Combat-ready: weapon out, weight forward. A unit that only has idle and
       attack looks switched off between swings, so the stance gets its own
       cycle. Two channels — bob and arm on offset beats — because a lone bob
       repeats on the half-cycle and hitches the loop. */
    const RB = [0, -1, -1, 0], RA = [-2, -2, -3, -3], RDUR = [220, 200, 220, 260];
    for (const [sname, facing] of [['ready_down', 'down'], ['ready_side', 'side'], ['ready_up', 'up']]) {
      const frames = [];
      for (let i = 0; i < 4; i++) {
        const tool = { kind: o.weapon || 'sword', angle: facing === 'side' ? -0.3 : 0.15, arrow: false, pull: 0 };
        const cfg = facing === 'side' ? SP(i, 4, 0, pal, { bob: RB[i], tool }) : FP(i, 4, 0, pal, facing, { bob: RB[i], tool });
        cfg.armL = { dx: 0, dy: RA[i] }; cfg.armR = { dx: 0, dy: RA[i] };
        cfg.armF = { dx: facing === 'side' ? 2 : 0, dy: RA[i] }; cfg.armB = { dx: 0, dy: RA[i] };
        cfg.eye = 'open';
        frames.push(Fr(RDUR[i], N(cfg, { pre, post }, i)));
      }
      states.push(D(sname, 5, true, frames));
    }
    /* Parry: blade snapped up across the body, held long, then let go. */
    const PANG = [-1.5, -1.35, -0.9], PKB = [1, 0, -1], PDUR = [70, 190, 140];
    for (const [sname, facing] of [['parry_down', 'down'], ['parry_side', 'side'], ['parry_up', 'up']]) {
      const frames = [];
      for (let i = 0; i < 3; i++) {
        const tool = { kind: o.weapon || 'sword', angle: PANG[i], arrow: false, pull: 0, arc: i === 0 ? [PANG[i] - 0.9, PANG[i], facing === 'side' ? 10 : 9] : null };
        const cfg = facing === 'side' ? SP(i, 3, 0, pal, { tool }) : FP(i, 3, 0, pal, facing, { tool });
        cfg.kb = PKB[i];
        if (facing === 'side') cfg.armF = { dx: 2, dy: -3 }; else cfg.armR = { dx: 1, dy: -3 };
        frames.push(Fr(PDUR[i], N(cfg, { pre, post }, i)));
      }
      states.push(D(sname, 10, true, frames));
    }
    /* Evade: a hop back that pushes off the ground it leaves and lands heavy. */
    const EKB = [0, -2, -4, -2, 0], EBOB = [0, -2, -1, 0, -1], EDUR = [70, 110, 110, 90, 150];
    for (const [sname, facing] of [['evade_down', 'down'], ['evade_side', 'side'], ['evade_up', 'up']]) {
      const frames = [];
      for (let i = 0; i < 5; i++) {
        const dust = i === 0 ? [[12, 27, '#c0cbdc'], [19, 27, '#c0cbdc']] : i === 3 ? [[13, 27, '#8b9bb4'], [18, 27, '#c0cbdc']] : null;
        const cfg = facing === 'side'
          ? SP(i, 5, 0, pal, { bob: EBOB[i], tool: { kind: 'none', dust } })
          : FP(i, 5, 0, pal, facing, { bob: EBOB[i], tool: { kind: 'none', dust } });
        cfg.kb = EKB[i];
        frames.push(Fr(EDUR[i], N(cfg, { pre, post }, i)));
      }
      states.push(D(sname, 10, true, frames));
    }
    // hurt (3f) + death (4f, lying + dither fade)
    states.push(D('hurt', 7, true, [
      Fr(60, N({ pal, facing: 'side', bob: 0, kb: 3, eye: 'hurt', mouth: 'open', flash: true, tool: { kind: 'none', impact: [-2, -4, 0.15] }, legF: { dx: 0, dy: 0 }, legB: { dx: 0, dy: 0 }, armF: { dx: 0, dy: 0 }, armB: { dx: 0, dy: 0 } }, { pre, post })),
      Fr(95, N({ pal, facing: 'side', bob: -1, kb: 1, eye: 'hurt', legF: { dx: 0, dy: 0 }, legB: { dx: 0, dy: 0 }, armF: { dx: 0, dy: 0 }, armB: { dx: 0, dy: 0 } }, { pre, post })),
      Fr(150, N({ pal, facing: 'side', bob: 0, kb: 0, eye: 'hurt', legF: { dx: 0, dy: 0 }, legB: { dx: 0, dy: 0 }, armF: { dx: 0, dy: 0 }, armB: { dx: 0, dy: 0 } }, { pre, post }))
    ]));
    states.push(D('death', 6, false, [
      Fr(ms(6), N({ pal, facing: 'side', bob: 0, kb: 1, eye: 'dead', legF: { dx: 0, dy: 0 }, legB: { dx: 0, dy: 0 }, armF: { dx: 0, dy: 0 }, armB: { dx: 0, dy: 0 } }, { pre, post })),
      Fr(ms(6), N({ pal, lying: true, eye: 'dead' }, { fade: 0 })),
      Fr(ms(6), N({ pal, lying: true, eye: 'dead' }, { fade: 0.45, seed: 3 })),
      Fr(ms(6), N({ pal, lying: true, eye: 'dead' }, { fade: 0.8, seed: 7 }))
    ]));
    return { width: 32, height: 32, name: label, layers: [{ name: 'Body' }], states };
  }

  /* ================= templates ================= */
  function knightSuite() {
    return humanoidSuite(KNIGHT, 'rpg-knight', {
      weapon: 'sword', shield: true,
      garb: { cape: '#124e89', capeSh: '#1c2a44' },
      head: { pads: '#c0cbdc', padsSh: '#5a6988' }
    });
  }
  function rangerSuite() {
    return humanoidSuite(RANGER, 'rpg-ranger', {
      weapon: 'bow', sneak: true,
      head: { hood: '#265c42', hoodSh: '#193c3e' },
      garb: { cape: '#3e8948', capeSh: '#265c42' }
    });
  }
  function clericSuite() {
    return humanoidSuite(CLERIC, 'rpg-cleric', {
      weapon: 'staff', cast: true, castColors: ['#fee761', '#ffffff', '#63c74d'],
      head: { circlet: '#fee761', gem: '#ff0044' }
    });
  }
  function rogueSuite() {
    return humanoidSuite(ROGUE, 'rpg-rogue', {
      weapon: 'sword', sneak: true,
      head: { hood: '#262b44', hoodSh: '#181425' },
      garb: { cape: '#772a3a', capeSh: '#4a1a26' } // crimson: distinct from the slate shirt
    });
  }
  function townsfolkSuite() {
    const FP = PF.Chars.frontPose;
    const mk = (pal, head, tool, garbCfg) => {
      const frames = [];
      const pre = garbCfg ? (api, c, fi) => garb(api, c, garbCfg, fi || 0) : null;
      const HEAD = [0, 1, 1, 0], ARM = [0, 0, 1, 1];
      for (let i = 0; i < 4; i++) {
        const cfg = FP(i, 4, 0, pal, 'down', tool ? { tool } : {});
        cfg.legA = { dx: 0, dy: 0 }; cfg.legB = { dx: 0, dy: 0 };
        cfg.armL = { dx: 0, dy: ARM[i] }; cfg.armR = { dx: 0, dy: ARM[i] };
        cfg.headDy = HEAD[i]; cfg.bob = 0; cfg.eye = i === 3 ? 'closed' : 'open';
        frames.push(Fr(ms(4), N(cfg, { pre, post: (api, c) => { if (garbCfg) capeBack(api, c, garbCfg); headgear(api, c, head); } }, i)));
      }
      return frames;
    };
    return { width: 32, height: 32, name: 'rpg-townsfolk', layers: [{ name: 'Body' }], states: [
      D('king', 4, true, mk(KING, { crown: '#fee761', crownSh: '#feae34', gem: '#ff0044', beard: '#c0cbdc', beardSh: '#8b9bb4' }, null, { cape: '#a22633', capeSh: '#5c1a1a', capeClasp: '#fee761' })),
      D('guard', 4, true, mk(GUARD, { helm: '#8b9bb4', helmSh: '#5a6988', helmHi: '#e6ebf7' })),
      D('blacksmith', 4, true, mk(SMITH, null)),
      D('elder', 4, true, mk(ELDER, { beard: '#e8ecf5', beardSh: '#8b9bb4', beardLong: true }, { kind: 'staff' })),
      D('peasant', 4, true, mk(PEASANT, null, { kind: 'box' })),
      D('peasant_cook', 4, true, mk({ ...PEASANT, shirt: '#a22633', shirtSh: '#5c1a1a', shirtHi: '#f6757a' }, null, { kind: 'food' }))
    ] };
  }

  return { humanoidSuite, knightSuite, rangerSuite, clericSuite, rogueSuite, townsfolkSuite,
    N, garb, capeBack, headgear, fadeOut, PAL: { KNIGHT, RANGER, CLERIC, ROGUE, KING, GUARD, SMITH, ELDER, PEASANT, GOBLIN, NECRO, DEMON } };
})();
