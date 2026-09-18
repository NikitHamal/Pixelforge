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
     same surface with zero per-call closure cost.

     Two more hot-path rules live here:
     - `px` inlines its own bounds test. It is the single most-called method in
       the engine (every primitive funnels through it), and the extra call into
       Raster.set plus its `inb()` cost more than the store itself.
     - the option objects handed to Raster are shared, not literals. `{fill:true}`
       is a fresh allocation per call otherwise, and a full-library build makes
       ~200k of them. Raster only reads these, and nothing here is re-entrant,
       so mutating one shared `size` field is safe. */
  const num = c => (typeof c === 'number' ? c : C(c));
  const RECT_FILL = { fill: true, size: 1, mx: false, my: false };
  const RECT_STROKE = { fill: false, size: 1, mx: false, my: false };
  const ELL_FILL = { fill: true, size: 1, mx: false, my: false };
  const ELL_STROKE = { fill: false, size: 1, mx: false, my: false };
  function Api(buf, W, H) { this.buf = buf; this.W = W; this.H = H; }
  Api.prototype.px = function (x, y, c) {
    const xi = Math.round(x), yi = Math.round(y), W = this.W, H = this.H;
    if (xi < 0 || yi < 0 || xi >= W || yi >= H) return;
    this.buf[yi * W + xi] = num(c);
  };
  Api.prototype.rect = function (x0, y0, x1, y1, c) { PF.Raster.rect(this.buf, this.W, this.H, Math.round(x0), Math.round(y0), Math.round(x1), Math.round(y1), num(c), RECT_FILL); };
  Api.prototype.rectO = function (x0, y0, x1, y1, c, size = 1) { RECT_STROKE.size = size; PF.Raster.rect(this.buf, this.W, this.H, Math.round(x0), Math.round(y0), Math.round(x1), Math.round(y1), num(c), RECT_STROKE); };
  Api.prototype.line = function (x0, y0, x1, y1, c, size = 1) { PF.Raster.line(this.buf, this.W, this.H, Math.round(x0), Math.round(y0), Math.round(x1), Math.round(y1), num(c), size); };
  Api.prototype.ellipse = function (x0, y0, x1, y1, c, fill = true) { PF.Raster.ellipse(this.buf, this.W, this.H, Math.round(x0), Math.round(y0), Math.round(x1), Math.round(y1), num(c), fill ? ELL_FILL : ELL_STROKE); };
  Api.prototype.fill = function (x, y, c) { PF.Raster.fill(this.buf, this.W, this.H, Math.round(x), Math.round(y), num(c), true); };
  /* deterministic pseudo-random from coords (stable speckles) */
  Api.prototype.hash = function (x, y, seed = 0) { let h = (x * 374761393 + y * 668265263 + seed * 974634211) | 0; h = (h ^ (h >> 13)) | 0; h = Math.imul(h, 1274126177); h = (h ^ (h >> 16)) >>> 0; return h / 4294967295; };
  Api.prototype.shadeRect = function (x0, y0, x1, y1, amt) { PF.Raster.shadeRegion(this.buf, this.W, this.H, Math.round(x0), Math.round(y0), Math.round(x1), Math.round(y1), amt); };
  /* ---- Flexible volume helpers (ADDITIVE — existing methods untouched) ----
     Opt-in organic shading for bespoke painters. All deterministic (hash-based),
     all route through this.px/rect/ellipse so offsetApi views keep working. */
  // Vertical gradient fill: mixes cTop -> cBot across rows. Pure maths.
  Api.prototype.grad = function (x0, y0, x1, y1, cTop, cBot) {
    const ta = PF.Color.rgba(num(cTop)), ba = PF.Color.rgba(num(cBot));
    const t = Math.round(Math.min(y0, y1)), b = Math.round(Math.max(y0, y1)), span = Math.max(1, b - t);
    const l = Math.round(Math.min(x0, x1)), r = Math.round(Math.max(x0, x1));
    for (let y = t; y <= b; y++) {
      const k = (y - t) / span;
      const c = PF.Color.fromRGBA(Math.round(ta[0] + (ba[0] - ta[0]) * k), Math.round(ta[1] + (ba[1] - ta[1]) * k), Math.round(ta[2] + (ba[2] - ta[2]) * k), 255);
      this.rect(l, y, r, y, c);
    }
  };
  // Checker dither between two colours. Breaks up flat rect bands.
  Api.prototype.dith = function (x0, y0, x1, y1, cA, cB, seed = 0) {
    const l = Math.round(Math.min(x0, x1)), r = Math.round(Math.max(x0, x1)), t = Math.round(Math.min(y0, y1)), b = Math.round(Math.max(y0, y1));
    const buf = this.buf, W = this.W, H = this.H, A = num(cA), B = num(cB);
    const cl = l < 0 ? 0 : l, cr = r >= W ? W - 1 : r, ct = t < 0 ? 0 : t, cb = b >= H ? H - 1 : b;
    for (let y = ct; y <= cb; y++) {
      const row = y * W;
      for (let x = cl; x <= cr; x++) buf[row + x] = ((x + y + seed) & 1) ? A : B;
    }
  };
  // Deterministic speckle texture. density 0..1, colours cycled by hash.
  Api.prototype.speck = function (x0, y0, x1, y1, seed, colors, density = 0.12) {
    const l = Math.round(Math.min(x0, x1)), r = Math.round(Math.max(x0, x1)), t = Math.round(Math.min(y0, y1)), b = Math.round(Math.max(y0, y1));
    const n = colors.length, pal = new Array(n);
    for (let i = 0; i < n; i++) pal[i] = num(colors[i]);
    const buf = this.buf, W = this.W, H = this.H;
    const cl = l < 0 ? 0 : l, cr = r >= W ? W - 1 : r, ct = t < 0 ? 0 : t, cb = b >= H ? H - 1 : b;
    for (let y = ct; y <= cb; y++) {
      const row = y * W;
      for (let x = cl; x <= cr; x++) {
        if (this.hash(x, y, seed) >= density) continue;
        buf[row + x] = pal[Math.floor(this.hash(x, y, seed + 99) * n) % n];
      }
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
     Built on the prototype chain so untranslated calls (ellipse, rectO, fill,
     shadeRect, hash) are inherited instead of re-wrapped. */
  function offsetApi(api, ox, oy) {
    const a = Object.create(api);
    a.px = (x, y, c) => api.px(ox + x, oy + y, c);
    a.rect = (x0, y0, x1, y1, c) => api.rect(ox + x0, oy + y0, ox + x1, oy + y1, c);
    a.line = (x0, y0, x1, y1, c, s) => api.line(ox + x0, oy + y0, ox + x1, oy + y1, c, s);
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
    const spread = 1.5 + t * 3, lift = t * 3;
    for (let i = 0; i < n; i++) {
      const x = cx + Math.round((api.hash(i, seed, 11) - 0.5) * spread * 2);
      const y = groundY - Math.round(api.hash(i, seed, 23) * lift);
      api.px(x, y, color); api.px(x + 1, y, color);
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

  /* ---- Modern / sci-fi / industrial tools (ADDITIVE) ----
     The rig only shipped fantasy tools, so a sci-fi or modern pack had to
     smuggle a rifle through `t.draw` locally. These live here instead: one
     implementation, available to every pack and every facing preference. */
  const GUN = { body: '#3a4466', bodyHi: '#5a6988', grip: '#262b44', accent: '#ff0044', glow: '#2ce8f5' };
  function rifle(api, hx, hy, angle = 0, pal = GUN) {
    const a = angle || 0, c = Math.cos(a), s = Math.sin(a);
    const bx = hx - c * 3, by = hy - s * 3, tx = hx + c * 12, ty = hy + s * 12;
    api.line(bx, by, tx, ty, pal.body, 3);            // receiver + barrel
    api.line(bx, by - 1, tx - c * 2, ty - s * 2, pal.bodyHi, 1); // top rail highlight
    const ma = a + Math.PI / 2;
    api.line(hx - c * 1, hy - s * 1, hx - c * 1 - Math.cos(ma) * 3, hy - s * 1 - Math.sin(ma) * 3, pal.grip, 2); // magazine
    api.px(tx, ty, pal.glow || '#ffffff');
    api.px(tx - c, ty - s, pal.accent);
  }
  function pistol(api, hx, hy, angle = 0, pal = GUN) {
    const a = angle || 0, c = Math.cos(a), s = Math.sin(a);
    api.line(hx, hy, hx + c * 5, hy + s * 5, pal.body, 2);
    api.line(hx - c, hy - s, hx - c * 2, hy - s * 4, pal.grip, 2);
    api.px(hx + c * 5, hy + s * 5, pal.glow || '#ffffff');
  }
  function blaster(api, hx, hy, angle = 0, pal = GUN) {
    const a = angle || 0, c = Math.cos(a), s = Math.sin(a);
    api.rect(hx - 1, hy - 1, hx + 4, hy + 1, pal.body);
    api.line(hx + 4, hy, hx + 8, hy + s * 2, pal.glow, 2);
    api.line(hx - 1, hy + 1, hx - 2, hy + 4, pal.grip, 2);
    api.px(hx + 9, hy + s * 2, '#ffffff');
    api.px(hx + 1, hy - 1, pal.accent);
  }
  function wrench(api, hx, hy, angle = 0, pal = { handle: '#8b9bb4', head: '#c0cbdc' }) {
    const a = angle || 0, c = Math.cos(a), s = Math.sin(a);
    api.line(hx, hy, hx + c * 7, hy + s * 7, pal.handle, 2);
    const tx = hx + c * 8, ty = hy + s * 8, ma = a + Math.PI / 2;
    api.line(tx - Math.cos(ma) * 2, ty - Math.sin(ma) * 2, tx + Math.cos(ma) * 2, ty + Math.sin(ma) * 2, pal.head, 2);
    api.px(tx, ty + Math.sin(a) * 2, pal.head);
  }
  function shovel(api, hx, hy, angle = 0, pal = { handle: '#b86f50', head: '#8b9bb4' }) {
    const a = angle || 0, c = Math.cos(a), s = Math.sin(a);
    api.line(hx, hy + 3, hx + c * 8, hy + s * 8, pal.handle, 2);
    const tx = hx + c * 10, ty = hy + s * 10;
    api.ellipse(tx - 2, ty - 2, tx + 2, ty + 3, pal.head, true);
  }
  function net(api, hx, hy, angle = 0, pal = { handle: '#b86f50', mesh: '#c0cbdc' }) {
    const a = angle || 0, c = Math.cos(a), s = Math.sin(a);
    api.line(hx, hy + 3, hx + c * 7, hy + s * 7, pal.handle, 1);
    const tx = hx + c * 9, ty = hy + s * 9;
    api.ellipse(tx - 3, ty - 3, tx + 3, ty + 3, pal.mesh, false);
    api.line(tx - 2, ty, tx + 2, ty, pal.mesh, 1);
    api.line(tx, ty - 2, tx, ty + 2, pal.mesh, 1);
  }
  /* Long-hafted curved blade: the one silhouette the fantasy packs never had. */
  function scythe(api, hx, hy, angle = 0, pal = { haft: '#733e39', blade: '#c0cbdc', shine: '#ffffff' }) {
    const a = angle || 0, c = Math.cos(a), s = Math.sin(a);
    api.line(hx, hy + 4, hx + c * 9, hy + s * 9, pal.haft, 1);
    const tx = hx + c * 11, ty = hy + s * 11, ma = a + Math.PI / 2;
    for (let i = 0; i <= 5; i++) {
      const k = i / 5;
      const qx = tx - Math.cos(ma) * k * 7, qy = ty - Math.sin(ma) * k * 7;
      api.px(qx, qy, pal.blade); api.px(qx + c, qy + s, pal.blade);
    }
    api.px(tx - Math.cos(ma) * 7, ty - Math.sin(ma) * 7, pal.shine);
  }
  const CLAW = { claw: '#e8ecf5', clawSh: '#8b9bb4' };
  function claw(api, hx, hy, angle = 0, pal = CLAW) {
    const a = angle || 0, c = Math.cos(a), s = Math.sin(a), ma = a + Math.PI / 2;
    for (let i = -1; i <= 1; i++) {
      const ox = Math.cos(ma) * i * 2, oy = Math.sin(ma) * i * 2;
      api.line(hx + ox, hy + oy, hx + ox + c * 4, hy + oy + s * 4, pal.claw, 1);
      api.px(hx + ox + c * 5, hy + oy + s * 5, pal.clawSh);
    }
  }
  /* Energy beam from (x0,y0) to (x1,y1): hot core, soft shell, spark tips. */
  function beam(api, x0, y0, x1, y1, colors = ['#ffffff', '#2ce8f5', '#124e89'], width = 3) {
    for (let w = width - 1; w >= 0; w--) api.line(x0, y0, x1, y1, colors[Math.min(colors.length - 1, w)], width - w);
    api.px(x0, y0, colors[0]); api.px(x1, y1, colors[0]);
    const dx = Math.sign(x1 - x0), dy = Math.sign(y1 - y0);
    api.px(x1 + dx, y1 + dy, colors[1]); api.px(x1 - dy, y1 + dx, colors[1]);
  }
  /* Muzzle flash: a 4-point star with a bright core, sized by `t` (0..1). */
  function muzzle(api, cx, cy, t, colors = ['#ffffff', '#ffec27', '#feae34']) {
    const r = 1 + Math.round(t * 4);
    api.line(cx - r, cy, cx + r, cy, colors[1], 1);
    api.line(cx, cy - r, cx, cy + r, colors[1], 1);
    api.px(cx + 1, cy + 1, colors[2]); api.px(cx - 1, cy - 1, colors[2]);
    api.rect(cx - 1, cy - 1, cx + 1, cy + 1, colors[0]);
  }
  /* Hollow ring (shockwave, magic circle, portal rim). */
  function ring(api, cx, cy, r, color, thickness = 1, dash = 0) {
    const steps = Math.max(12, Math.round(r * 6));
    for (let i = 0; i <= steps; i++) {
      if (dash && (i % (dash * 2)) >= dash) continue;
      const a = (i / steps) * TAU;
      for (let w = 0; w < thickness; w++) api.px(cx + Math.cos(a) * (r - w), cy + Math.sin(a) * (r - w), color);
    }
  }
  /* Rising smoke: opaque early, breaking up later. */
  function smokePuff(api, cx, cy, t, colors = ['#5a6988', '#8b9bb4', '#c0cbdc'], n = 5, seed = 0) {
    for (let i = 0; i < n; i++) {
      const h1 = api.hash(i, seed, 5), h2 = api.hash(i, seed, 9);
      const x = cx + Math.round((h1 - 0.5) * 8 * (0.4 + t)), y = cy - Math.round(t * 5 + h2 * 2);
      const c = colors[Math.min(colors.length - 1, Math.floor(t * colors.length))];
      api.px(x, y, c); api.px(x + 1, y, c);
      if (t < 0.5) api.px(x, y - 1, c);
      if (t > 0.6) api.px(x + 2, y - 1, c);
    }
  }
  /* Water splash crown: symmetric, lifts then falls. */
  function splash(api, cx, cy, t, colors = ['#ffffff', '#73eff7', '#41a6f6']) {
    const h = Math.round(Math.sin(Math.min(1, t) * Math.PI) * 5);
    for (let i = -2; i <= 2; i++) {
      const dx = i * 2, dh = h - Math.abs(i);
      if (dh <= 0) continue;
      api.line(cx + dx, cy, cx + dx + Math.sign(i), cy - dh, colors[1], 1);
      api.px(cx + dx + Math.sign(i), cy - dh - 1, colors[0]);
    }
    api.rect(cx - 3, cy, cx + 3, cy, colors[2]);
  }
  /* Bubble: outline + single specular dot. */
  function bubble(api, cx, cy, r, body = '#73eff7', hi = '#ffffff') {
    api.ellipse(cx - r, cy - r, cx + r, cy + r, body, false);
    api.px(cx - Math.max(1, r >> 1), cy - Math.max(1, r >> 1), hi);
  }
  /* Leaf: teardrop with a centre vein, rotated on the 8-point compass. */
  function leaf(api, cx, cy, angle, size, body, vein) {
    const c = Math.cos(angle), s = Math.sin(angle), ma = angle + Math.PI / 2;
    for (let i = 0; i <= size; i++) {
      const k = i / size, w = Math.round(Math.sin(k * Math.PI) * (size * 0.55));
      for (let j = -w; j <= w; j++) {
        const px = cx + c * (i - size / 2) + Math.cos(ma) * j, py = cy + s * (i - size / 2) + Math.sin(ma) * j;
        api.px(px, py, Math.abs(j) === w ? vein : body);
      }
    }
    api.line(cx - c * size / 2, cy - s * size / 2, cx + c * size / 2, cy + s * size / 2, vein, 1);
  }
  /* Snow / rain / ash column inside a rect, deterministic on (x,y,t). */
  function precip(api, x0, y0, x1, y1, t, color, kind = 'rain', density = 0.02) {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const h = api.hash(x, y, 17);
      if (h > density) continue;
      if (kind === 'rain') { api.px(x, y, color); api.px(x, y + 1, color); }
      else if (kind === 'snow') api.px(x + ((t + h) % 1 < 0.5 ? 0 : 1), y, color);
      else api.px(x, y, color);
    }
  }
  /* Foliage: layered canopy blobs with a lit top and a shaded underside. */
  function canopy(api, cx, cy, rx, ry, colors, seed = 0) {
    api.ellipse(cx - rx, cy - ry, cx + rx, cy + ry, colors[0], true);
    api.ellipse(cx - rx + 1, cy - ry + 1, cx + rx - 2, cy - ry + (ry >> 1), colors[1], true);
    api.speck(cx - rx + 1, cy - 1, cx + rx - 1, cy + ry - 1, seed, [colors[2]], 0.16);
    api.rect(cx - Math.max(1, rx - 2), cy + ry - 1, cx + Math.max(1, rx - 2), cy + ry, colors[2]);
  }

  return { C, frame, makeApi, offsetApi, clamp, lerp, easeOut, easeInOut, TAU, finishSelective,
    sword, pickaxe, axe, mace, spear, hammer, shield, kiteShield, bow, bowFront, slash, sparks, particles, shadowFlat, flashWhite,
    arcTrail, dustPuff, impactStar,
    rifle, pistol, blaster, wrench, shovel, net, scythe, claw, beam, muzzle, ring, smokePuff, splash, bubble, leaf, precip, canopy, GUN, CLAW };
})();
