/* PixelForge Studio — Library pixel helpers.
   Tiny deterministic helpers on top of PF.Raster / PF.Color so every template
   is pure maths: sine walk cycles, squash & stretch, flicker, dither fades.
   No image assets — everything is generated at runtime. */
window.PF = window.PF || {};
PF.Pixel = (() => {
  const C = h => PF.Color.hexToU32(h);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const easeOut = t => 1 - Math.pow(1 - t, 3);
  const easeInOut = t => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  const TAU = Math.PI * 2;

  /* Frame painter helper: fn(api) where api wraps buf */
  function frame(W, H, fn) {
    return (buf) => {
      const api = makeApi(buf, W, H);
      fn(api, W, H);
    };
  }
  /* Prototype-based draw API. The previous form returned a fresh object of nine
     closures per call — one allocation storm per rendered frame (and per live
     preview tick). A plain constructor with prototype methods keeps the exact
     same surface with zero per-call closure cost. */
  const num = c => (typeof c === 'number' ? c : C(c));
  function Api(buf, W, H) { this.buf = buf; this.W = W; this.H = H; }
  Api.prototype.px = function (x, y, c) { PF.Raster.set(this.buf, this.W, this.H, Math.round(x), Math.round(y), num(c)); };
  Api.prototype.rect = function (x0, y0, x1, y1, c) { PF.Raster.rect(this.buf, this.W, this.H, Math.round(x0), Math.round(y0), Math.round(x1), Math.round(y1), num(c), { fill: true }); };
  Api.prototype.rectO = function (x0, y0, x1, y1, c, size = 1) { PF.Raster.rect(this.buf, this.W, this.H, Math.round(x0), Math.round(y0), Math.round(x1), Math.round(y1), num(c), { fill: false, size }); };
  Api.prototype.line = function (x0, y0, x1, y1, c, size = 1) { PF.Raster.line(this.buf, this.W, this.H, Math.round(x0), Math.round(y0), Math.round(x1), Math.round(y1), num(c), size); };
  Api.prototype.ellipse = function (x0, y0, x1, y1, c, fill = true) { PF.Raster.ellipse(this.buf, this.W, this.H, Math.round(x0), Math.round(y0), Math.round(x1), Math.round(y1), num(c), { fill }); };
  Api.prototype.fill = function (x, y, c) { PF.Raster.fill(this.buf, this.W, this.H, Math.round(x), Math.round(y), num(c), true); };
  /* Deterministic pseudo-random from coords (stable speckles), uniform over
     [0,1). The mixes use UNSIGNED shifts and Math.imul on every multiply. The
     first cut finished with `h ^ (h >> 16)`: an ARITHMETIC shift smears the
     sign bit across the top half, so bit 31 of the result was always zero and
     the function could never return more than 0.5. Everything downstream
     inherited that — speckle ran at twice its stated density, a two-colour
     speck never picked its second colour, and `(hash - 0.5) * spread` only
     ever scattered in one direction. */
  Api.prototype.hash = function (x, y, seed = 0) {
    let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(seed | 0, 974634211)) | 0;
    h ^= h >>> 13;
    h = Math.imul(h, 1274126177);
    h ^= h >>> 16;
    h = Math.imul(h, 2246822519);
    h ^= h >>> 13;
    return (h >>> 0) / 4294967296;
  };
  Api.prototype.shadeRect = function (x0, y0, x1, y1, amt) { PF.Raster.shadeRegion(this.buf, this.W, this.H, Math.round(x0), Math.round(y0), Math.round(x1), Math.round(y1), amt); };
  /* ---- Flexible volume helpers (ADDITIVE — existing methods untouched) ----
     Opt-in organic shading for bespoke painters. All deterministic (hash-based),
     all route through this.px/rect/ellipse so offsetApi views keep working. */
  // Vertical gradient fill: mixes cTop -> cBot across rows. Pure maths.
  Api.prototype.grad = function (x0, y0, x1, y1, cTop, cBot) {
    const ta = PF.Color.rgba(num(cTop)), ba = PF.Color.rgba(num(cBot));
    const t = Math.round(Math.min(y0, y1)), b = Math.round(Math.max(y0, y1)), span = Math.max(1, b - t);
    for (let y = t; y <= b; y++) {
      const k = (y - t) / span;
      const c = PF.Color.fromRGBA(Math.round(ta[0] + (ba[0] - ta[0]) * k), Math.round(ta[1] + (ba[1] - ta[1]) * k), Math.round(ta[2] + (ba[2] - ta[2]) * k), 255);
      this.rect(x0, y, x1, y, c);
    }
  };
  // Checker dither between two colours. Breaks up flat rect bands.
  Api.prototype.dith = function (x0, y0, x1, y1, cA, cB, seed = 0) {
    const l = Math.round(Math.min(x0, x1)), r = Math.round(Math.max(x0, x1)), t = Math.round(Math.min(y0, y1)), b = Math.round(Math.max(y0, y1));
    for (let y = t; y <= b; y++) for (let x = l; x <= r; x++) this.px(x, y, ((x + y + seed) & 1) ? cA : cB);
  };
  // Deterministic speckle texture. density 0..1, colours cycled by hash.
  Api.prototype.speck = function (x0, y0, x1, y1, seed, colors, density = 0.24) {
    const l = Math.round(Math.min(x0, x1)), r = Math.round(Math.max(x0, x1)), t = Math.round(Math.min(y0, y1)), b = Math.round(Math.max(y0, y1));
    for (let y = t; y <= b; y++) for (let x = l; x <= r; x++) {
      const h = this.hash(x, y, seed);
      if (h < density) this.px(x, y, colors[Math.floor(this.hash(x, y, seed + 99) * colors.length) % colors.length]);
    }
  };
  // Organic rounded mass: base blob + top highlight + bottom shade. The
  // anti-rect: one call replaces 3-4 hard rects with a Tiny-style volume.
  Api.prototype.blob = function (cx, cy, rx, ry, base, hi, sh) {
    this.ellipse(cx - rx, cy - ry, cx + rx, cy + ry, base, true);
    const hb = Math.max(1, ry >> 1);
    if (hi) this.ellipse(cx - rx + 1, cy - ry, cx + rx - 1, cy - ry + hb, hi, true);
    if (sh) this.ellipse(cx - rx + 1, cy + ry - hb, cx + rx - 1, cy + ry, sh, true);
  };
  // Top-edge rim light on an already-drawn band.
  Api.prototype.rim = function (x0, y0, x1, y1, light) { this.rect(x0, y0, x1, Math.min(y0, y1) === y0 ? y0 : y1, light); };
  const makeApi = (buf, W, H) => new Api(buf, W, H);
  /* Offset view of a draw API: identical surface, coordinates translated by
     (ox, oy). Tilesheet painters use this to draw 16px tiles onto a 64px sheet.

     Every *primitive* is re-bound with the offset applied; the composites
     (grad, dith, speck, blob, rim) are left on the prototype on purpose,
     because they route through `this.px` / `this.rect` / `this.ellipse` and so
     pick the translated overrides up for free. Before, only px/rect/line were
     translated, which silently dropped ellipse/blob/rectO work at absolute
     coordinates — a whole icon landing in the sheet's top-left corner. */
  function offsetApi(api, ox, oy) {
    const a = Object.create(api);
    a.px = (x, y, c) => api.px(ox + x, oy + y, c);
    a.rect = (x0, y0, x1, y1, c) => api.rect(ox + x0, oy + y0, ox + x1, oy + y1, c);
    a.rectO = (x0, y0, x1, y1, c, sz) => api.rectO(ox + x0, oy + y0, ox + x1, oy + y1, c, sz);
    a.line = (x0, y0, x1, y1, c, s) => api.line(ox + x0, oy + y0, ox + x1, oy + y1, c, s);
    a.ellipse = (x0, y0, x1, y1, c, f) => api.ellipse(ox + x0, oy + y0, ox + x1, oy + y1, c, f);
    a.fill = (x, y, c) => api.fill(ox + x, oy + y, c);
    a.shadeRect = (x0, y0, x1, y1, amt) => api.shadeRect(ox + x0, oy + y0, ox + x1, oy + y1, amt);
    a.hash = (x, y, s) => api.hash(x + ox, y + oy, s);
    return a;
  }

  /* Sword drawn from hand (hx,hy) at angle (radians) + length */
  function sword(api, hx, hy, angle, palette) {
    const len = 11, bx = hx + Math.cos(angle) * 3, by = hy + Math.sin(angle) * 3;
    const tx = hx + Math.cos(angle) * len, ty = hy + Math.sin(angle) * len;
    api.line(bx, by, tx, ty, palette.blade, 2);
    api.line(bx, by, tx, ty, palette.shine, 1);
    // guard perpendicular
    const ga = angle + Math.PI / 2, gl = 3;
    api.line(bx - Math.cos(ga) * gl, by - Math.sin(ga) * gl, bx + Math.cos(ga) * gl, by + Math.sin(ga) * gl, palette.guard, 2);
    api.px(hx, hy, palette.grip);
    api.px(hx + 1, hy, palette.grip);
  }
  /* Pickaxe from hand */
  function pickaxe(api, hx, hy, angle, palette) {
    const len = 10, tx = hx + Math.cos(angle) * len, ty = hy + Math.sin(angle) * len;
    api.line(hx, hy, tx, ty, palette.handle, 2);
    // head: arc across tip
    const ha = angle + Math.PI / 2;
    api.line(tx - Math.cos(ha) * 4, ty - Math.sin(ha) * 4, tx + Math.cos(ha) * 4, ty + Math.sin(ha) * 4, palette.head, 2);
    api.line(tx - Math.cos(ha) * 4, ty - Math.sin(ha) * 4, tx - Math.cos(ha) * 2, ty - Math.sin(ha) * 2 + 1, palette.shine, 1);
  }
  /* Axe from hand */
  function axe(api, hx, hy, angle, palette) {
    const len = 9, tx = hx + Math.cos(angle) * len, ty = hy + Math.sin(angle) * len;
    api.line(hx, hy, tx, ty, palette.handle, 2);
    const ha = angle + Math.PI / 2;
    api.line(tx, ty, tx + Math.cos(ha) * 3 - Math.sin(angle) * 2, ty + Math.sin(ha) * 3 + Math.cos(angle) * 2, palette.head, 3);
    api.px(tx + 1, ty, palette.shine);
  }
  /* Flanged medieval mace from hand */
  function mace(api, hx, hy, angle, palette) {
    const p = palette || { handle: '#733e39', head: '#8b9bb4', shine: '#ffffff', guard: '#5a6988' };
    const len = 10, tx = hx + Math.cos(angle) * len, ty = hy + Math.sin(angle) * len;
    api.line(hx, hy, tx, ty, p.handle || '#733e39', 2);
    const ha = angle + Math.PI / 2;
    api.ellipse(tx - 2, ty - 2, tx + 2, ty + 2, p.head || '#8b9bb4', true);
    api.line(tx - Math.cos(ha) * 3, ty - Math.sin(ha) * 3, tx + Math.cos(ha) * 3, ty + Math.sin(ha) * 3, p.guard || '#5a6988', 2);
    api.px(tx + Math.cos(angle) * 3, ty + Math.sin(angle) * 3, p.shine || '#ffffff');
    api.px(tx, ty, '#ffffff');
  }
  /* Medieval spear / halberd from hand */
  function spear(api, hx, hy, angle, palette) {
    const p = palette || { handle: '#b86f50', head: '#c0cbdc', shine: '#ffffff', lug: '#5a6988' };
    const len = 14, tx = hx + Math.cos(angle) * len, ty = hy + Math.sin(angle) * len;
    const bx = hx - Math.cos(angle) * 3, by = hy - Math.sin(angle) * 3;
    api.line(bx, by, tx, ty, p.handle || '#b86f50', 2);
    const ha = angle + Math.PI / 2;
    api.line(tx - Math.cos(angle) * 3, ty - Math.sin(angle) * 3, tx + Math.cos(angle) * 3, ty + Math.sin(angle) * 3, p.head || '#c0cbdc', 2);
    api.px(tx + Math.cos(angle) * 4, ty + Math.sin(angle) * 4, p.shine || '#ffffff');
    api.line(tx - Math.cos(ha) * 2, ty - Math.sin(ha) * 2, tx + Math.cos(ha) * 2, ty + Math.sin(ha) * 2, p.lug || '#5a6988', 1);
  }
  /* Heavy blacksmith / war hammer */
  function hammer(api, hx, hy, angle, palette) {
    const p = palette || { handle: '#b86f50', head: '#5a6988', face: '#c0cbdc', shine: '#ffffff' };
    const len = 10, tx = hx + Math.cos(angle) * len, ty = hy + Math.sin(angle) * len;
    api.line(hx, hy, tx, ty, p.handle || '#b86f50', 2);
    const ha = angle + Math.PI / 2;
    api.line(tx - Math.cos(ha) * 3, ty - Math.sin(ha) * 3, tx + Math.cos(ha) * 3, ty + Math.sin(ha) * 3, p.head || '#5a6988', 3);
    api.px(tx - Math.cos(ha) * 3, ty - Math.sin(ha) * 3, p.face || '#c0cbdc');
    api.px(tx + Math.cos(ha) * 3, ty + Math.sin(ha) * 3, p.face || '#c0cbdc');
    api.px(tx, ty, p.shine || '#ffffff');
  }
  /* Medieval kite / heater shield at (sx, sy) with heraldic cross */
  function kiteShield(api, sx, sy, baseCol = '#ffffff', rimCol = '#c0cbdc', crossCol = '#e43b44') {
    api.rect(sx - 3, sy - 5, sx + 3, sy - 1, rimCol);
    api.rect(sx - 3, sy, sx + 3, sy + 2, rimCol);
    api.rect(sx - 2, sy + 3, sx + 2, sy + 4, rimCol);
    api.px(sx, sy + 5, rimCol);
    api.rect(sx - 2, sy - 4, sx + 2, sy + 2, baseCol);
    api.rect(sx - 1, sy + 3, sx + 1, sy + 4, baseCol);
    api.line(sx, sy - 3, sx, sy + 3, crossCol, 1);
    api.line(sx - 2, sy - 1, sx + 2, sy - 1, crossCol, 1);
  }
  /* Bow held vertically at (bx,by): arc + string + optional arrow pull t */
  function bow(api, bx, by, pull, palette, arrowT = 1) {
    const h = 9;
    api.ellipse(bx - 3, by - h, bx + 3, by + h, palette.limb, false);
    const sx = bx - 3 + Math.round(pull * 3);
    api.line(sx, by - h + 1, sx, by + h - 1, palette.string, 1);
    if (arrowT > 0) {
      api.line(sx - 7, by, sx + 4, by, palette.arrow, 1);
      api.rect(sx + 3, by - 1, sx + 5, by + 1, palette.tip);
      api.rect(sx - 8, by - 1, sx - 6, by + 1, palette.fletch);
    }
  }
  /* Bow seen head-on (top-down game): limbs vertical across the body, string
     pulled to a V, arrow loosed along `dir` (-1 = away/up the screen,
     +1 = toward the camera/down). Mirrors Pixel.bow's language for the
     front and back facings. */
  function bowFront(api, bx, by, pull, dir, palette, arrowT = 1) {
    // limb: tall thin ellipse outline, wrapped grip at the middle
    api.ellipse(bx - 3, by - 9, bx + 3, by + 9, palette.limb, false);
    api.rect(bx - 1, by - 2, bx + 1, by + 2, palette.tip);
    const sy = by + 6 - Math.round(pull * 5); // string apex travels back as it is drawn
    api.line(bx, by - 9, bx, sy, palette.string, 1);
    api.line(bx, sy, bx, by + 9, palette.string, 1);
    if (arrowT > 0) {
      const ty = by + 3 + dir * 7; // foreshortened: the shot runs into/out of the screen
      api.line(bx, by + 3 + dir * 2, bx, ty, palette.arrow, 1);
      api.rect(bx - 1, ty - 1, bx + 1, ty + 1, palette.tip);
      api.rect(bx - 1, by + 2 + dir, bx + 1, by + 4 + dir, palette.fletch);
    }
  }
  /* Slash arc FX centered (cx,cy) radius r, sweep a0..a1, color */
  function slash(api, cx, cy, r, a0, a1, color, width = 2) {
    const steps = 14;
    for (let i = 0; i <= steps; i++) {
      const a = a0 + (a1 - a0) * (i / steps);
      for (let w = 0; w < width; w++) api.px(cx + Math.cos(a) * (r + w), cy + Math.sin(a) * (r + w), color);
    }
    // sparkle tips
    api.px(cx + Math.cos(a0) * (r - 1), cy + Math.sin(a0) * (r - 1), '#ffffff');
    api.px(cx + Math.cos(a1) * (r + width), cy + Math.sin(a1) * (r + width), '#ffffff');
  }
  /* Hit sparks: 8 rays */
  function sparks(api, cx, cy, seed, color, n = 8, r0 = 3, r1 = 7) {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + seed * 0.7;
      api.line(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0, cx + Math.cos(a) * r1, cy + Math.sin(a) * r1, color, 1);
    }
    api.px(cx, cy, '#ffffff');
  }
  /* ---- Motion-read primitives (ADDITIVE — nothing above is touched) ----
     What separates a swing that reads from a swing that mushes is mass and
     decay: the blade head carries the weight, the tail thins out and breaks
     apart. slash() draws an even ring, which looks like a halo. These three
     are for the strike, the footfall and the impact respectively. */
  // Swept blade arc from tail angle a0 to head angle a1. k=0 is the tail.
  // The fade is carried entirely by width and colour, never by dropping
  // pixels: a lone pixel left in the band picks up a dark ring from the
  // outline pass, which turns a dissolving tail into a speckled wing.
  function arcTrail(api, cx, cy, r, a0, a1, colors, o = {}) {
    /* Sampling follows arc length, not a fixed count: a 2.5rad sweep at r=9 is
       22px of curve, and 16 samples through that leaves gaps wide enough for
       the outline pass to rim every pixel into its own bead. */
    const span = Math.abs(a1 - a0) * r;
    const steps = o.steps || Math.max(12, Math.round(span * 2)), width = o.width || 3;
    const lo = colors[0], mid = colors.length > 1 ? colors[1] : colors[0], hi = colors.length > 2 ? colors[2] : mid;
    for (let i = 0; i <= steps; i++) {
      const k = i / steps, a = a0 + (a1 - a0) * k;
      const w = Math.max(1, Math.round(width * (0.34 + 0.66 * k * k)));
      const c = k > 0.86 ? hi : (k > 0.5 ? mid : lo);
      const inner = r - (w >> 1);
      for (let t = 0; t < w; t++) api.px(cx + Math.cos(a) * (inner + t), cy + Math.sin(a) * (inner + t), c);
    }
    // Tip: a hot core running along the tangent, not a plus-sign, so it reads
    // as the blade moving rather than a star sitting still.
    const hx = cx + Math.cos(a1) * r, hy = cy + Math.sin(a1) * r, ta = a1 + Math.PI / 2;
    api.px(hx, hy, '#ffffff');
    api.px(hx + Math.cos(ta), hy + Math.sin(ta), hi);
    api.px(hx - Math.cos(ta), hy - Math.sin(ta), hi);
  }
  // Contact dust rising off a planted foot, t = 0..1 lifetime. Hugs the ground
  // line first and only then lifts; drawn above groundY so the engine shadow
  // row stays clear. Drawn as touching pairs for the same reason the arc avoids
  // dithers — one rimed pixel reads as grit, not puff.
  function dustPuff(api, cx, groundY, seed, t, color = '#8b9bb4', n = 6) {
    /* Motes on a widening ground-hugging arc, thinning as they go. The random
       scatter this replaces dropped every mote inside a 4x2 box at low t, and
       the outline pass then framed that box: a walk cycle's contact dust came
       out as a grey brick parked between the boots. */
    const spread = 2.2 + t * 4.2, lift = 0.4 + t * 3.4;
    const live = Math.max(2, Math.round(n * (1 - t * 0.45)));
    for (let i = 0; i < live; i++) {
      const a = Math.PI + (live === 1 ? 0.5 : i / (live - 1)) * Math.PI;
      const j = (api.hash(i, seed, 11) - 0.5) * 1.7;
      const x = Math.round(cx + Math.cos(a) * (spread + j));
      const y = Math.round(groundY - Math.abs(Math.sin(a)) * lift - api.hash(i, seed, 23) * 0.9);
      api.px(x, y, color);
      if ((i & 1) === 0) api.px(x + 1, y, color);          // a pair here and there, so it is not a dotted line
    }
  }
  // Impact star for the contact frame: long cardinals, short diagonals. Small
  // on purpose — at 32px a star wider than the head reads as an explosion and
  // steals the swing it belongs to.
  function impactStar(api, cx, cy, t, colors, r = 5) {
    const hi = colors[0], mid = colors.length > 1 ? colors[1] : colors[0];
    const len = easeOut(Math.min(1, t * 1.35)) * r;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU, l = (i & 1) ? len * 0.5 : len;
      const c = (i & 1) ? mid : hi;
      if (t < 0.65) api.line(cx + Math.cos(a) * 1.2, cy + Math.sin(a) * 1.2, cx + Math.cos(a) * l, cy + Math.sin(a) * l, c, 1);
      else api.px(cx + Math.cos(a) * l, cy + Math.sin(a) * l, c);
    }
    if (t < 0.4) api.px(cx, cy, hi);
  }
  /* Floating dust / magic particles on circle */
  function particles(api, cx, cy, r, t, colors, n = 6) {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + t * TAU;
      const rr = r + Math.sin(t * TAU + i * 1.7) * 1.5;
      api.px(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr - t * 3, colors[i % colors.length]);
    }
  }

  /* Soft ground shadow */
  function shadow(api, cx, groundY, w) {
    api.ellipse(cx - w, groundY - 1, cx + w, groundY + 1, 'rgba(0,0,0,0.25)', true);
    // raster has no rgba string support via C()? hexToU32 handles # + alpha; use translucent black:
    // draw manually: blend dark with low alpha is complex; instead draw dark outline pixels:
  }
  function shadowFlat(api, cx, groundY, w) {
    for (let x = -w; x <= w; x++) {
      const edge = Math.abs(x) / (w + 1);
      if (edge > 0.85) continue;
      api.px(cx + x, groundY, '#262b44');
      if (Math.abs(x) < w - 1) api.px(cx + x, groundY + 1, '#262b44');
    }
  }

  /* Darken/lighten entire buffer region for hurt flash: caller draws white overlay pixels */
  function flashWhite(api, W, H, buf) {
    for (let i = 0; i < buf.length; i++) if (buf[i]) buf[i] = 0xFFFFFFFF;
  }
  /* Round shield at (sx, sy) */
  function shield(api, sx, sy, wood = '#b86f50', metal = '#c0cbdc') {
    api.ellipse(sx - 3, sy - 5, sx + 3, sy + 5, metal, true);
    api.ellipse(sx - 2, sy - 4, sx + 2, sy + 4, wood, true);
    api.px(sx, sy, '#ffffff');
  }

  /* Outline finish with an optional light top rim. Same contract as the rig's
     finish() (1px silhouette pass) plus Tiny-style volume on demand. */
  function finishSelective(buf, W, H, c = '#181425', opts = {}) {
    buf.set(PF.Raster.outlineSelective(buf, W, H, PF.Color.hexToU32(c), opts));
  }

  return { C, frame, makeApi, offsetApi, clamp, lerp, easeOut, easeInOut, TAU, finishSelective,
    sword, pickaxe, axe, mace, spear, hammer, shield, kiteShield, bow, bowFront, slash, sparks, particles, shadowFlat, flashWhite,
    arcTrail, dustPuff, impactStar };
})();
