/* A software 2-D canvas, good enough to screenshot a PixelForge demo game.

   The house rule is that no visual change ships until someone has looked at
   the image. Demo games broke that rule: they only existed inside a browser,
   so their render path was the one part of the project nobody could inspect.
   This implements the slice of CanvasRenderingContext2D the games actually
   use — nearest-neighbour drawImage, solid and radial fills, source-over /
   source-in / destination-out, translate+scale transforms and pie-slice paths
   — over the same ABGR Uint32Array the sprite engine already speaks.

   Deliberately NOT supported: rotation, shear, strokes, text, patterns. If a
   game starts needing those, add them here rather than guessing at the output.
*/

/* ------------------------------------------------------------- colours */

const NAMED = { black: [0, 0, 0, 1], white: [255, 255, 255, 1], transparent: [0, 0, 0, 0] };

function parseColour(c) {
  if (typeof c !== 'string') return [0, 0, 0, 0];
  const s = c.trim().toLowerCase();
  if (NAMED[s]) return NAMED[s];
  if (s[0] === '#') {
    const h = s.slice(1);
    if (h.length === 3 || h.length === 4) {
      const v = k => parseInt(h[k] + h[k], 16);
      return [v(0), v(1), v(2), h.length === 4 ? v(3) / 255 : 1];
    }
    const v = k => parseInt(h.slice(k, k + 2), 16);
    return [v(0), v(2), v(4), h.length >= 8 ? v(6) / 255 : 1];
  }
  const m = s.match(/^rgba?\(([^)]+)\)$/);
  if (m) {
    const p = m[1].split(',').map(x => parseFloat(x));
    return [p[0] | 0, p[1] | 0, p[2] | 0, p.length > 3 ? p[3] : 1];
  }
  return [0, 0, 0, 0];
}

class Gradient {
  constructor(x, y, r0, r1) { this.x = x; this.y = y; this.r0 = r0; this.r1 = r1; this.stops = []; }
  addColorStop(t, c) { this.stops.push([t, parseColour(c)]); this.stops.sort((a, b) => a[0] - b[0]); }
  /* Sampled in DEVICE space; every caller draws gradients with the identity
     transform, which is why this can ignore the matrix entirely. */
  at(px, py) {
    if (!this.stops.length) return null;
    const d = Math.hypot(px - this.x, py - this.y);
    const span = this.r1 - this.r0 || 1;
    const t = Math.max(0, Math.min(1, (d - this.r0) / span));
    let a = this.stops[0], b = this.stops[this.stops.length - 1];
    for (let i = 0; i < this.stops.length - 1; i++)
      if (t >= this.stops[i][0] && t <= this.stops[i + 1][0]) { a = this.stops[i]; b = this.stops[i + 1]; break; }
    if (t <= a[0]) return a[1];
    if (t >= b[0]) return b[1];
    const k = (t - a[0]) / ((b[0] - a[0]) || 1);
    return [a[1][0] + (b[1][0] - a[1][0]) * k, a[1][1] + (b[1][1] - a[1][1]) * k,
      a[1][2] + (b[1][2] - a[1][2]) * k, a[1][3] + (b[1][3] - a[1][3]) * k];
  }
}

/* ------------------------------------------------------------- canvas */

class SoftCanvas {
  constructor(w, h) { this._w = 0; this._h = 0; this.width = w || 300; this.height = h || 150; }
  get width() { return this._w; }
  set width(v) { this._w = Math.max(0, v | 0); this._alloc(); }
  get height() { return this._h; }
  set height(v) { this._h = Math.max(0, v | 0); this._alloc(); }
  _alloc() { this.data = new Uint32Array(this._w * this._h); if (this._ctx) this._ctx._sync(); }
  getContext() { return this._ctx || (this._ctx = new SoftCtx(this)); }
  toDataURL() { return 'data:image/png;base64,'; }
}

class SoftCtx {
  constructor(cv) {
    this.canvas = cv;
    this._sync();
    this.globalAlpha = 1;
    this.globalCompositeOperation = 'source-over';
    this.fillStyle = '#000';
    this.strokeStyle = '#000';
    this.lineWidth = 1;
    this.font = '';
    this.textAlign = 'left';
    this.imageSmoothingEnabled = true;
    this._t = { sx: 1, sy: 1, tx: 0, ty: 0 };
    this._stack = [];
    this._path = [];
  }
  _sync() { this.d = this.canvas.data; this.w = this.canvas.width; this.h = this.canvas.height; }

  /* ---- state ---- */
  save() {
    this._stack.push({ t: Object.assign({}, this._t), a: this.globalAlpha,
      op: this.globalCompositeOperation, f: this.fillStyle });
  }
  restore() {
    const s = this._stack.pop(); if (!s) return;
    this._t = s.t; this.globalAlpha = s.a; this.globalCompositeOperation = s.op; this.fillStyle = s.f;
  }
  setTransform(a, b, c, d, e, f) { this._t = { sx: a, sy: d, tx: e, ty: f }; }
  resetTransform() { this._t = { sx: 1, sy: 1, tx: 0, ty: 0 }; }
  translate(x, y) { this._t.tx += x * this._t.sx; this._t.ty += y * this._t.sy; }
  scale(x, y) { this._t.sx *= x; this._t.sy *= y; }
  rotate() { throw new Error('soft-canvas: rotate() is not supported'); }
  transform() { throw new Error('soft-canvas: transform() is not supported'); }
  clip() { /* no clip region: every game path here is already inside the canvas */ }

  _mapX(x) { return this._t.tx + x * this._t.sx; }
  _mapY(y) { return this._t.ty + y * this._t.sy; }

  /* ---- pixel blending ---- */
  _blend(i, r, g, b, a) {
    const op = this.globalCompositeOperation;
    const dst = this.d[i];
    const da = (dst >>> 24) / 255;
    if (op === 'destination-out') {
      const na = da * (1 - a);
      this.d[i] = (Math.round(na * 255) << 24 | (dst & 0x00ffffff)) >>> 0;
      return;
    }
    if (op === 'source-in') {
      const na = a * da;
      this.d[i] = (Math.round(na * 255) << 24 | (b & 255) << 16 | (g & 255) << 8 | (r & 255)) >>> 0;
      return;
    }
    // source-over
    if (a <= 0) return;
    if (a >= 1) {
      this.d[i] = (255 << 24 | (b & 255) << 16 | (g & 255) << 8 | (r & 255)) >>> 0;
      return;
    }
    const dr = dst & 255, dg = (dst >>> 8) & 255, db = (dst >>> 16) & 255;
    const na = a + da * (1 - a);
    const mix = (s, dv) => na <= 0 ? 0 : Math.round((s * a + dv * da * (1 - a)) / na);
    this.d[i] = (Math.round(na * 255) << 24 | (mix(b, db) & 255) << 16 |
      (mix(g, dg) & 255) << 8 | (mix(r, dr) & 255)) >>> 0;
  }

  _fillSpan(x0, x1, y, col) {
    if (y < 0 || y >= this.h) return;
    x0 = Math.max(0, Math.round(x0)); x1 = Math.min(this.w, Math.round(x1));
    const row = y * this.w;
    const grad = col instanceof Gradient ? col : null;
    const flat = grad ? null : (Array.isArray(col) ? col : parseColour(col));
    for (let x = x0; x < x1; x++) {
      const c = grad ? grad.at(x + 0.5, y + 0.5) : flat;
      if (!c) continue;
      this._blend(row + x, c[0], c[1], c[2], c[3] * this.globalAlpha);
    }
  }

  /* ---- rects ---- */
  fillRect(x, y, w, h) {
    const X = this._mapX(x), Y = this._mapY(y), W = w * this._t.sx, H = h * this._t.sy;
    const y0 = Math.max(0, Math.round(Math.min(Y, Y + H)));
    const y1 = Math.min(this.h, Math.round(Math.max(Y, Y + H)));
    for (let yy = y0; yy < y1; yy++) this._fillSpan(Math.min(X, X + W), Math.max(X, X + W), yy, this.fillStyle);
  }
  clearRect(x, y, w, h) {
    const op = this.globalCompositeOperation, a = this.globalAlpha, f = this.fillStyle;
    this.globalCompositeOperation = 'destination-out'; this.globalAlpha = 1; this.fillStyle = '#000';
    this.fillRect(x, y, w, h);
    this.globalCompositeOperation = op; this.globalAlpha = a; this.fillStyle = f;
  }
  strokeRect() {}
  fillText() {}
  strokeText() {}
  stroke() {}
  measureText() { return { width: 0 }; }
  createPattern() { return null; }

  /* ---- gradients ---- */
  createLinearGradient(x0, y0, x1, y1) {
    // treated as a radial from the start point: the games only use radials
    return new Gradient(x0, y0, 0, Math.hypot(x1 - x0, y1 - y0) || 1);
  }
  createRadialGradient(x0, y0, r0, x1, y1, r1) { return new Gradient(x1, y1, r0, r1); }

  /* ---- paths. Only the pie slice the torch cone needs. ---- */
  beginPath() { this._path = []; }
  closePath() { this._path.push(['close']); }
  moveTo(x, y) { this._path.push(['move', x, y]); }
  lineTo(x, y) { this._path.push(['line', x, y]); }
  arc(x, y, r, a0, a1) { this._path.push(['arc', x, y, r, a0, a1]); }
  arcTo() {}
  ellipse() {}
  quadraticCurveTo() {}
  bezierCurveTo() {}
  rect(x, y, w, h) { this._path.push(['rect', x, y, w, h]); }
  fill() {
    const p = this._path;
    const arc = p.find(c => c[0] === 'arc');
    if (arc) { this._fillSector(arc[1], arc[2], arc[3], arc[4], arc[5]); return; }
    for (const c of p) if (c[0] === 'rect') this.fillRect(c[1], c[2], c[3], c[4]);
  }
  _fillSector(cx, cy, r, a0, a1) {
    const X = this._mapX(cx), Y = this._mapY(cy), R = r * Math.abs(this._t.sx);
    let span = a1 - a0;
    while (span < 0) span += Math.PI * 2;
    const y0 = Math.max(0, Math.floor(Y - R)), y1 = Math.min(this.h, Math.ceil(Y + R));
    const x0 = Math.max(0, Math.floor(X - R)), x1 = Math.min(this.w, Math.ceil(X + R));
    const grad = this.fillStyle instanceof Gradient ? this.fillStyle : null;
    const flat = grad ? null : parseColour(this.fillStyle);
    for (let y = y0; y < y1; y++) {
      const row = y * this.w;
      for (let x = x0; x < x1; x++) {
        const dx = x + 0.5 - X, dy = y + 0.5 - Y;
        if (dx * dx + dy * dy > R * R) continue;
        let da = Math.atan2(dy, dx) - a0;
        while (da < 0) da += Math.PI * 2;
        if (da > span) continue;
        const c = grad ? grad.at(x + 0.5, y + 0.5) : flat;
        if (!c) continue;
        this._blend(row + x, c[0], c[1], c[2], c[3] * this.globalAlpha);
      }
    }
  }

  /* ---- images ---- */
  createImageData(w, h) {
    return { width: w, height: h, data: new Uint8ClampedArray(w * h * 4) };
  }
  getImageData(x, y, w, h) {
    const img = this.createImageData(w, h);
    const u32 = new Uint32Array(img.data.buffer);
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const sx = x + i, sy = y + j;
      u32[j * w + i] = (sx >= 0 && sy >= 0 && sx < this.w && sy < this.h) ? this.d[sy * this.w + sx] : 0;
    }
    return img;
  }
  putImageData(img, dx, dy) {
    const u32 = new Uint32Array(img.data.buffer);
    for (let j = 0; j < img.height; j++) for (let i = 0; i < img.width; i++) {
      const X = dx + i, Y = dy + j;
      if (X < 0 || Y < 0 || X >= this.w || Y >= this.h) continue;
      this.d[Y * this.w + X] = u32[j * img.width + i];   // putImageData REPLACES, never blends
    }
  }
  drawImage(src, a1, a2, a3, a4, a5, a6, a7, a8) {
    if (!src || !src.data) return;
    let sx = 0, sy = 0, sw = src.width, sh = src.height, dx, dy, dw, dh;
    if (a5 === undefined) { dx = a1; dy = a2; dw = a3 === undefined ? sw : a3; dh = a4 === undefined ? sh : a4; }
    else { sx = a1; sy = a2; sw = a3; sh = a4; dx = a5; dy = a6; dw = a7; dh = a8; }
    const X = this._mapX(dx), Y = this._mapY(dy), W = dw * this._t.sx, H = dh * this._t.sy;
    if (W <= 0 || H <= 0) return;
    const x0 = Math.max(0, Math.round(X)), x1 = Math.min(this.w, Math.round(X + W));
    const y0 = Math.max(0, Math.round(Y)), y1 = Math.min(this.h, Math.round(Y + H));
    const ga = this.globalAlpha;
    for (let y = y0; y < y1; y++) {
      const v = sy + ((y + 0.5 - Y) / H) * sh;          // nearest neighbour: these are pixel sprites
      const syy = Math.min(src.height - 1, Math.max(0, v | 0));
      const srow = syy * src.width, drow = y * this.w;
      for (let x = x0; x < x1; x++) {
        const u = sx + ((x + 0.5 - X) / W) * sw;
        const sxx = Math.min(src.width - 1, Math.max(0, u | 0));
        const c = src.data[srow + sxx];
        const a = (c >>> 24) / 255 * ga;
        if (a <= 0 && this.globalCompositeOperation === 'source-over') continue;
        this._blend(drow + x, c & 255, (c >>> 8) & 255, (c >>> 16) & 255, a);
      }
    }
  }
}

module.exports = { SoftCanvas, SoftCtx, Gradient, parseColour };
