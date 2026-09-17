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
  /* deterministic pseudo-random from coords (stable speckles) */
  Api.prototype.hash = function (x, y, seed = 0) { let h = (x * 374761393 + y * 668265263 + seed * 974634211) | 0; h = (h ^ (h >> 13)) | 0; h = Math.imul(h, 1274126177); h = (h ^ (h >> 16)) >>> 0; return h / 4294967295; };
  Api.prototype.shadeRect = function (x0, y0, x1, y1, amt) { PF.Raster.shadeRegion(this.buf, this.W, this.H, Math.round(x0), Math.round(y0), Math.round(x1), Math.round(y1), amt); };
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

  return { C, frame, makeApi, offsetApi, clamp, lerp, easeOut, easeInOut, TAU,
    sword, pickaxe, axe, bow, bowFront, shield, slash, sparks, particles, shadowFlat, flashWhite };
})();
