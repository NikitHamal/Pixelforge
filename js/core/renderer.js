/* PixelForge Studio — Canvas renderer: offscreen composite → scaled blit, grid, onion skin, zoom/pan */
window.PF = window.PF || {};
PF.Renderer = (() => {
  let canvas, ctx, off, offCtx, img, buf, onion, onionCtx, onionImg, onionBuf, checker;
  const view = { zoom: 12, panX: 0, panY: 0, grid: true, onion: false, hover: null, hoverSize: 1, sel: null };
  let dirty = true, dpr = 1, bgColor = '#d9d5e0';
  /* Cached per-frame costs: the checker pattern and the artboard tag metrics
     were being rebuilt from scratch on every single draw() call. */
  let checkerPattern = null, tagKey = '', tagWidth = 0;
  let scratch = null, scratchCtx = null, scratchImg = null, scratchBuf = null;
  const layerDesc = [];

  function init(el) {
    canvas = el; ctx = canvas.getContext('2d', { alpha: false });
    checker = makeChecker();
    allocate();
    new ResizeObserver(() => fit()).observe(canvas.parentElement);
    PF.Store.on('change', invalidate); PF.Store.on('render', invalidate); PF.Store.on('active', invalidate);
    PF.Store.on('doc', () => { const d = PF.Store.get(); if (!off || off.width !== d.width || off.height !== d.height) { allocate(); fit(); } else invalidate(); });
    new MutationObserver(() => { checker = makeChecker(); invalidate(); }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    requestAnimationFrame(loop);
  }
  function allocate() {
    const d = PF.Store.get();
    off = document.createElement('canvas'); off.width = d.width; off.height = d.height; offCtx = off.getContext('2d');
    img = offCtx.createImageData(d.width, d.height); buf = new Uint32Array(img.data.buffer);
    onion = document.createElement('canvas'); onion.width = d.width; onion.height = d.height; onionCtx = onion.getContext('2d');
    onionImg = onionCtx.createImageData(d.width, d.height); onionBuf = new Uint32Array(onionImg.data.buffer);
  }
  function makeChecker() {
    const c = document.createElement('canvas'); c.width = c.height = 16; const x = c.getContext('2d');
    const cs = getComputedStyle(document.documentElement);
    bgColor = cs.getPropertyValue('--canvas-bg').trim() || '#d9d5e0';
    x.fillStyle = cs.getPropertyValue('--checker-a').trim() || '#fff'; x.fillRect(0, 0, 16, 16);
    x.fillStyle = cs.getPropertyValue('--checker-b').trim() || '#ddd'; x.fillRect(0, 0, 8, 8); x.fillRect(8, 8, 8, 8);
    checkerPattern = null; // invalidate: pattern is rebuilt lazily on next draw
    return c;
  }
  const patternFor = () => (checkerPattern ||= ctx.createPattern(checker, 'repeat'));
  function tagMetrics(text) {
    if (tagKey !== text) { ctx.font = '600 11px Poppins, system-ui, sans-serif'; tagWidth = ctx.measureText(text).width; tagKey = text; }
    return tagWidth;
  }
  function fit() {
    const p = canvas.parentElement, W = p.clientWidth, H = p.clientHeight; if (!W || !H) return;
    dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    const d = PF.Store.get(), padX = W < 600 ? 28 : 56, padY = W < 600 ? 36 : 64;
    view.zoom = Math.max(1, Math.floor(Math.min((W - padX) / d.width, (H - padY) / d.height)));
    center(); invalidate();
    PF.Store.emit('view', view);
  }
  function center() {
    const d = PF.Store.get();
    view.panX = Math.round((canvas.clientWidth - d.width * view.zoom) / 2);
    view.panY = Math.round((canvas.clientHeight - d.height * view.zoom) / 2) + 8;
  }
  const invalidate = () => { dirty = true; };
  function loop() { if (dirty) { dirty = false; draw(); } requestAnimationFrame(loop); }

  function compositeFrame(frame, out) {
    const d = PF.Store.get();
    PF.Raster.composite(out, d.layers.map(l => ({ pixels: frame.pixels[l.id], visible: l.visible, opacity: l.opacity })));
  }
  function roundRect(context, x, y, w, h, r) {
    context.beginPath();
    context.moveTo(x + r, y);
    context.arcTo(x + w, y, x + w, y + h, r);
    context.arcTo(x + w, y + h, x, y + h, r);
    context.arcTo(x, y + h, x, y, r);
    context.arcTo(x, y, x + w, y, r);
    context.closePath();
  }

  function draw() {
    if (!canvas.clientWidth) return;
    const d = PF.Store.get(), W = canvas.clientWidth, H = canvas.clientHeight;
    const z = view.zoom, ox = view.panX, oy = view.panY, pw = d.width * z, ph = d.height * z;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Infinite canvas workspace background
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, W, H);
    ctx.imageSmoothingEnabled = false;

    // Figma artboard tag badge above top-left
    const tagH = 18, tagPad = 6;
    const tagText = `${d.name || 'Artboard'} · ${d.width}×${d.height}`;
    ctx.font = '600 11px Poppins, system-ui, sans-serif';
    const tagW = ctx.measureText(tagText).width + tagPad * 2;
    const tagY = oy - tagH - 6;

    if (tagY >= 4) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
      roundRect(ctx, ox, tagY, tagW, tagH, 4);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.textBaseline = 'middle';
      ctx.fillText(tagText, ox + tagPad, tagY + tagH / 2);
    }

    // Figma-styled artboard soft drop-shadow
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.28)';
    ctx.shadowBlur = 18;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 6;
    ctx.fillStyle = '#ffffff';
    roundRect(ctx, ox, oy, pw, ph, 4);
    ctx.fill();
    ctx.restore();

    // Clip to artboard with 4px corner radius
    ctx.save();
    roundRect(ctx, ox, oy, pw, ph, 4);
    ctx.clip();

    // Checkerboard background (pattern cached; createPattern is expensive per frame)
    ctx.fillStyle = patternFor();
    ctx.fillRect(ox, oy, pw, ph);

    // Onion skin
    if (view.onion) {
      const st = PF.Store.state(), prev = st.frames[d.activeFrame - 1], next = st.frames[d.activeFrame + 1];
      for (const [f, a] of [[prev, .32], [next, .18]]) if (f) {
        compositeFrame(f, onionBuf);
        onionCtx.putImageData(onionImg, 0, 0);
        ctx.globalAlpha = a;
        ctx.drawImage(onion, ox, oy, pw, ph);
      }
      ctx.globalAlpha = 1;
    }

    // Composite & draw pixels
    compositeFrame(PF.Store.frame(), buf);
    offCtx.putImageData(img, 0, 0);
    ctx.drawImage(off, ox, oy, pw, ph);

    // Refined pixel grid
    if (view.grid && z >= 6 && d.width <= 128) {
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.12)';
      ctx.lineWidth = 1;
      for (let x = 1; x < d.width; x++) { const px = ox + x * z + .5; ctx.moveTo(px, oy); ctx.lineTo(px, oy + ph); }
      for (let y = 1; y < d.height; y++) { const py = oy + y * z + .5; ctx.moveTo(ox, py); ctx.lineTo(ox + pw, py); }
      ctx.stroke();

      // Major tile grid (8x8 or 16x16)
      if (d.width % 8 === 0 && d.height % 8 === 0 && d.width > 16) {
        ctx.beginPath();
        ctx.strokeStyle = 'rgba(90, 56, 240, 0.35)';
        ctx.lineWidth = 1;
        for (let x = 8; x < d.width; x += 8) { const px = ox + x * z + .5; ctx.moveTo(px, oy); ctx.lineTo(px, oy + ph); }
        for (let y = 8; y < d.height; y += 8) { const py = oy + y * z + .5; ctx.moveTo(ox, py); ctx.lineTo(ox + pw, py); }
        ctx.stroke();
      }
    }
    // Selection marquee
    if (view.sel && view.sel.w > 0 && view.sel.h > 0) {
      const sx = ox + view.sel.x * z, sy = oy + view.sel.y * z, sw = view.sel.w * z, sh = view.sel.h * z;
      ctx.save();
      ctx.setLineDash([Math.max(3, z / 3), Math.max(2, z / 4)]);
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = 'rgba(255,255,255,.95)';
      ctx.strokeRect(sx, sy, sw, sh);
      ctx.lineDashOffset = 4;
      ctx.strokeStyle = 'rgba(20,10,60,.9)';
      ctx.strokeRect(sx, sy, sw, sh);
      ctx.restore();
    }
    ctx.restore();

    // Hover pixel cursor highlight
    if (view.hover) {
      const s = view.hoverSize, o = (s - 1) >> 1, hx = ox + (view.hover.x - o) * z, hy = oy + (view.hover.y - o) * z;
      ctx.lineWidth = 2;
      ctx.strokeStyle = 'rgba(255,255,255,.9)';
      ctx.strokeRect(hx, hy, s * z, s * z);
      ctx.lineWidth = 1;
      ctx.strokeStyle = 'rgba(0,0,0,.8)';
      ctx.strokeRect(hx - 1.5, hy - 1.5, s * z + 3, s * z + 3);
    }

    // Artboard bounding border
    ctx.save();
    roundRect(ctx, ox - 0.5, oy - 0.5, pw + 1, ph + 1, 4);
    ctx.strokeStyle = 'rgba(90, 56, 240, 0.7)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();
  }

  /* Coordinate helpers */
  const toPixel = (clientX, clientY) => {
    const r = canvas.getBoundingClientRect();
    return { x: Math.floor((clientX - r.left - view.panX) / view.zoom), y: Math.floor((clientY - r.top - view.panY) / view.zoom) };
  };
  function setZoom(z, cx, cy) {
    z = Math.max(1, Math.min(64, Math.round(z)));
    if (cx === undefined) { cx = canvas.clientWidth / 2; cy = canvas.clientHeight / 2; }
    const k = z / view.zoom; view.panX = Math.round(cx - (cx - view.panX) * k); view.panY = Math.round(cy - (cy - view.panY) * k);
    view.zoom = z; invalidate(); PF.Store.emit('view', view);
  }
  const zoomBy = (dir, cx, cy) => setZoom(view.zoom + (dir > 0 ? Math.max(1, Math.round(view.zoom * .25)) : -Math.max(1, Math.round(view.zoom * .2))), cx, cy);
  const pan = (dx, dy) => { view.panX += dx; view.panY += dy; invalidate(); };
  const setHover = (pt, size) => { view.hover = pt; view.hoverSize = size || 1; invalidate(); PF.Store.emit('hover', pt); };
  const setOption = (k, v) => { view[k] = v; invalidate(); PF.Store.emit('view', view); };
  const getView = () => view;
  /* Composite any frame to a canvas at scale (thumbnails, exports).
     The scratch canvas + ImageData are reused across calls: the live preview
     calls this on every animation tick, so allocating a canvas per frame was
     pure garbage.
     NOTE: with scale===1 and no target the shared scratch canvas is returned.
     Every caller consumes it synchronously (drawImage / toDataURL /
     getImageData), so nothing retains it — do the same in new call sites. */
  function frameToCanvas(frame, scale = 1, target) {
    const d = PF.Store.get();
    if (!scratch || scratch.width !== d.width || scratch.height !== d.height) {
      scratch = document.createElement('canvas'); scratch.width = d.width; scratch.height = d.height;
      scratchCtx = scratch.getContext('2d');
      scratchImg = scratchCtx.createImageData(d.width, d.height);
      scratchBuf = new Uint32Array(scratchImg.data.buffer);
    }
    const tmp = scratch, tctx = scratchCtx, id = scratchImg;
    compositeFrame(frame, scratchBuf); tctx.putImageData(id, 0, 0);
    if (scale === 1 && !target) return tmp;
    const out = target || document.createElement('canvas'); out.width = d.width * scale; out.height = d.height * scale;
    const octx = out.getContext('2d'); octx.imageSmoothingEnabled = false; octx.clearRect(0, 0, out.width, out.height);
    octx.drawImage(tmp, 0, 0, out.width, out.height); return out;
  }
  const canvasEl = () => canvas;
  return { init, fit, center, invalidate, toPixel, setZoom, zoomBy, pan, setHover, setOption, getView, frameToCanvas, canvasEl, compositeFrame };
})();
