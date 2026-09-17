/* PixelForge Studio — Canvas renderer: offscreen composite → scaled blit, grid, onion skin, zoom/pan */
window.PF = window.PF || {};
PF.Renderer = (() => {
  let canvas, ctx, off, offCtx, img, buf, onion, onionCtx, onionImg, onionBuf, checker;
  const view = { zoom: 12, panX: 0, panY: 0, grid: true, onion: false, hover: null, hoverSize: 1 };
  let dirty = true, dpr = 1, bgColor = '#d9d5e0';

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
    return c;
  }
  function fit() {
    const p = canvas.parentElement, W = p.clientWidth, H = p.clientHeight; if (!W || !H) return;
    dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
    const d = PF.Store.get(), pad = W < 600 ? 24 : 64;
    view.zoom = Math.max(1, Math.floor(Math.min((W - pad) / d.width, (H - pad - 60) / d.height)));
    center(); invalidate();
  }
  function center() {
    const d = PF.Store.get();
    view.panX = Math.round((canvas.clientWidth - d.width * view.zoom) / 2);
    view.panY = Math.round((canvas.clientHeight - d.height * view.zoom) / 2);
  }
  const invalidate = () => { dirty = true; };
  function loop() { if (dirty) { dirty = false; draw(); } requestAnimationFrame(loop); }

  function compositeFrame(frame, out) {
    const d = PF.Store.get();
    PF.Raster.composite(out, d.layers.map(l => ({ pixels: frame.pixels[l.id], visible: l.visible, opacity: l.opacity })));
  }
  function draw() {
    if (!canvas.clientWidth) return;
    const d = PF.Store.get(), W = canvas.clientWidth, H = canvas.clientHeight;
    const z = view.zoom, ox = view.panX, oy = view.panY, pw = d.width * z, ph = d.height * z;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = bgColor; ctx.fillRect(0, 0, W, H);
    ctx.imageSmoothingEnabled = false;
    ctx.save(); ctx.beginPath(); ctx.rect(ox, oy, pw, ph); ctx.clip();
    ctx.fillStyle = ctx.createPattern(checker, 'repeat'); ctx.fillRect(ox, oy, pw, ph);
    if (view.onion) {
      const st = PF.Store.state(), prev = st.frames[d.activeFrame - 1], next = st.frames[d.activeFrame + 1];
      for (const [f, a] of [[prev, .32], [next, .18]]) if (f) { compositeFrame(f, onionBuf); onionCtx.putImageData(onionImg, 0, 0); ctx.globalAlpha = a; ctx.drawImage(onion, ox, oy, pw, ph); }
      ctx.globalAlpha = 1;
    }
    compositeFrame(PF.Store.frame(), buf); offCtx.putImageData(img, 0, 0); ctx.drawImage(off, ox, oy, pw, ph);
    if (view.grid && z >= 6 && d.width <= 128) {
      ctx.beginPath(); ctx.strokeStyle = 'rgba(0,0,0,.14)'; ctx.lineWidth = 1;
      for (let x = 1; x < d.width; x++) { const px = ox + x * z + .5; ctx.moveTo(px, oy); ctx.lineTo(px, oy + ph); }
      for (let y = 1; y < d.height; y++) { const py = oy + y * z + .5; ctx.moveTo(ox, py); ctx.lineTo(ox + pw, py); }
      ctx.stroke();
      if (d.width % 8 === 0 && d.height % 8 === 0 && d.width > 16) {
        ctx.beginPath(); ctx.strokeStyle = 'rgba(0,0,0,.28)';
        for (let x = 8; x < d.width; x += 8) { const px = ox + x * z + .5; ctx.moveTo(px, oy); ctx.lineTo(px, oy + ph); }
        for (let y = 8; y < d.height; y += 8) { const py = oy + y * z + .5; ctx.moveTo(ox, py); ctx.lineTo(ox + pw, py); }
        ctx.stroke();
      }
    }
    ctx.restore();
    if (view.hover) {
      const s = view.hoverSize, o = (s - 1) >> 1, hx = ox + (view.hover.x - o) * z, hy = oy + (view.hover.y - o) * z;
      ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.strokeRect(hx, hy, s * z, s * z);
      ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(0,0,0,.8)'; ctx.strokeRect(hx - 1.5, hy - 1.5, s * z + 3, s * z + 3);
    }
    ctx.strokeStyle = 'rgba(184,222,145,.5)'; ctx.lineWidth = 1; ctx.strokeRect(ox - 1, oy - 1, pw + 2, ph + 2);
    const selection = PF.Selection?.get();
    if (selection) {
      ctx.save(); ctx.setLineDash([4, 4]); ctx.lineWidth = 1;
      ctx.strokeStyle = '#fff'; ctx.strokeRect(ox + selection.x * z, oy + selection.y * z, selection.width * z, selection.height * z);
      ctx.restore();
    }
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
  /* Composite any frame to a canvas at scale (thumbnails, exports) */
  function frameToCanvas(frame, scale = 1, target) {
    return documentFrameToCanvas(PF.Store.get(), frame, scale, target);
  }
  function documentFrameToCanvas(d, frame, scale = 1, target) {
    if (!Number.isInteger(scale) || scale < 1 || scale > 16) throw new Error('Export scale must be an integer from 1 to 16.');
    const tmp = document.createElement('canvas'); tmp.width = d.width; tmp.height = d.height;
    const tctx = tmp.getContext('2d'), id = tctx.createImageData(d.width, d.height);
    PF.Raster.composite(new Uint32Array(id.data.buffer), d.layers.map(layer => ({ pixels: frame.pixels[layer.id], visible: layer.visible, opacity: layer.opacity })));
    tctx.putImageData(id, 0, 0);
    if (scale === 1 && !target) return tmp;
    const out = target || document.createElement('canvas'); out.width = d.width * scale; out.height = d.height * scale;
    const octx = out.getContext('2d'); octx.imageSmoothingEnabled = false; octx.clearRect(0, 0, out.width, out.height);
    octx.drawImage(tmp, 0, 0, out.width, out.height); return out;
  }
  const canvasEl = () => canvas;
  return { init, fit, center, invalidate, toPixel, setZoom, zoomBy, pan, setHover, setOption, getView, frameToCanvas, documentFrameToCanvas, canvasEl, compositeFrame };
})();
