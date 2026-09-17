/* PixelForge Studio — Pointer input & interactive tools (mouse, touch, pen; pinch-zoom; symmetry) */
window.PF = window.PF || {};
PF.Input = (() => {
  const TOOLS = ['pencil', 'eraser', 'fill', 'line', 'rect', 'ellipse', 'picker', 'move', 'pan', 'shade', 'select', 'dither', 'spray'];
  const opt = { tool: 'pencil', size: 1, shapeFill: false, mirrorX: false, mirrorY: false, contiguous: true, spaceHeld: false, shadeAmt: 18 };
  const pointers = new Map();
  let active = null, panning = null, pinch = null, canvas;
  let selDrag = null, sel = null, clip = null, pasteArmed = false;

  function init(el) {
    canvas = el;
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('pointerleave', () => { if (!active) PF.Renderer.setHover(null); });
    el.addEventListener('wheel', wheel, { passive: false });
    el.addEventListener('contextmenu', e => e.preventDefault());
    window.addEventListener('keydown', e => {
      if (e.code === 'Space' && !isTyping(e)) {
        opt.spaceHeld = true;
        if (canvas) canvas.style.cursor = 'grab';
        e.preventDefault();
      }
    });
    window.addEventListener('keyup', e => {
      if (e.code === 'Space') {
        opt.spaceHeld = false;
        if (canvas) canvas.style.cursor = opt.tool === 'pan' ? 'grab' : opt.tool === 'move' ? 'move' : 'crosshair';
      }
    });
  }
  const isTyping = e => /INPUT|TEXTAREA|SELECT/.test(e.target.tagName) || e.target.isContentEditable;

  function down(e) {
    canvas.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 2) { // second finger → pinch, cancel current stroke
      if (active) { PF.Store.cancelStroke(); active = null; }
      selDrag = null;
      const [a, b] = [...pointers.values()], v = PF.Renderer.getView();
      pinch = { dist: Math.hypot(a.x - b.x, a.y - b.y), zoom: v.zoom, mid: mid(a, b), panX: v.panX, panY: v.panY };
      panning = null; return;
    }
    if (pointers.size > 2) return;
    const wantPan = e.button === 1 || opt.tool === 'pan' || opt.spaceHeld;
    if (wantPan) {
      const v = PF.Renderer.getView();
      panning = { x: e.clientX, y: e.clientY, panX: v.panX, panY: v.panY };
      canvas.style.cursor = 'grabbing';
      return;
    }
    if (e.button !== 0 && e.button !== 2) return;
    const d = PF.Store.get(), pt = PF.Renderer.toPixel(e.clientX, e.clientY), layer = PF.Store.layer();
    if (opt.tool === 'picker') { pick(pt); return; }
    if (pasteArmed) {
      if (e.button === 2) { pasteArmed = false; PF.Store.emit('tool', opt); }
      else if (inDoc(pt)) stampClip(pt);
      return;
    }
    if (opt.tool === 'select') {
      if (e.button === 2) { clearSel(); return; }
      selDrag = { start: pt }; setSelRect(pt, pt);
      return;
    }
    if (layer.locked) { PF.UI?.toast('Layer is locked'); return; }
    const erase = e.button === 2 || opt.tool === 'eraser';
    const color = erase ? 0 : PF.Color.hexToU32(d.color);
    const arr = PF.Store.beginStroke();
    active = { id: e.pointerId, start: pt, last: pt, arr, base: arr.slice(), color, w: d.width, h: d.height, erase };
    apply(pt, true);
  }
  function move(e) {
    if (pointers.has(e.pointerId)) pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch && pointers.size >= 2) {
      const [a, b] = [...pointers.values()], dist = Math.hypot(a.x - b.x, a.y - b.y), m = mid(a, b), r = canvas.getBoundingClientRect();
      const z = Math.max(1, Math.min(64, Math.round(pinch.zoom * dist / pinch.dist))), v = PF.Renderer.getView();
      const k = z / pinch.zoom;
      v.panX = Math.round((m.x - r.left) - ((pinch.mid.x - r.left) - pinch.panX) * k);
      v.panY = Math.round((m.y - r.top) - ((pinch.mid.y - r.top) - pinch.panY) * k);
      v.zoom = z; PF.Renderer.invalidate(); PF.Store.emit('view', v); return;
    }
    if (panning) { const v = PF.Renderer.getView(); v.panX = panning.panX + (e.clientX - panning.x); v.panY = panning.panY + (e.clientY - panning.y); PF.Renderer.invalidate(); return; }
    const pt = PF.Renderer.toPixel(e.clientX, e.clientY);
    PF.Renderer.setHover(pt, ['pencil', 'eraser', 'line', 'rect', 'ellipse', 'dither', 'spray'].includes(opt.tool) ? opt.size : 1);
    if (selDrag) { setSelRect(selDrag.start, pt); return; }
    if (active && e.pointerId === active.id) {
      // coalesce events for smooth fast strokes
      const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
      for (const ce of evs) apply(PF.Renderer.toPixel(ce.clientX, ce.clientY), false);
    }
  }
  function up(e) {
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinch = null;
    if (panning) {
      panning = null;
      canvas.style.cursor = opt.spaceHeld || opt.tool === 'pan' ? 'grab' : opt.tool === 'move' ? 'move' : 'crosshair';
    }
    if (active && e.pointerId === active.id) { active = null; PF.Store.endStroke(); }
    if (selDrag) {
      selDrag = null;
      const box = selBox();
      if (!box || (box.w <= 1 && box.h <= 1)) clearSel(); // plain click clears
      else PF.Store.emit('tool', opt);
    }
  }
  function wheel(e) {
    e.preventDefault(); const r = canvas.getBoundingClientRect();
    if (e.shiftKey) PF.Renderer.pan(-e.deltaY, 0);
    else if (e.ctrlKey || e.metaKey || !e.altKey) PF.Renderer.zoomBy(e.deltaY < 0 ? 1 : -1, e.clientX - r.left, e.clientY - r.top);
    else PF.Renderer.pan(-e.deltaX, -e.deltaY);
  }
  const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

  function pick(pt) {
    const d = PF.Store.get(); if (pt.x < 0 || pt.y < 0 || pt.x >= d.width || pt.y >= d.height) return;
    const out = new Uint32Array(d.width * d.height); PF.Renderer.compositeFrame(PF.Store.frame(), out);
    const v = out[pt.y * d.width + pt.x]; if (v) PF.Store.setColor(PF.Color.u32ToHex(v));
  }

  /* Apply tool at point (live preview for shape tools by restoring base each move) */
  function apply(pt, first) {
    const R = PF.Raster, { arr, base, color, w, h, start, last } = active, mx = opt.mirrorX, my = opt.mirrorY;
    switch (opt.tool) {
      case 'pencil': case 'eraser':
        R.line(arr, w, h, last.x, last.y, pt.x, pt.y, color, opt.size, mx, my); break;
      case 'shade':
        if (first || pt.x !== last.x || pt.y !== last.y) shadeAt(pt); break;
      case 'dither':
        paintDither(last, pt); break;
      case 'spray':
        if (first || pt.x !== last.x || pt.y !== last.y) sprayAt(pt); break;
      case 'fill':
        if (first) { R.fill(arr, w, h, pt.x, pt.y, color, opt.contiguous); if (mx) R.fill(arr, w, h, w - 1 - pt.x, pt.y, color, opt.contiguous); if (my) R.fill(arr, w, h, pt.x, h - 1 - pt.y, color, opt.contiguous); }
        break;
      case 'line': arr.set(base); R.line(arr, w, h, start.x, start.y, pt.x, pt.y, color, opt.size, mx, my); break;
      case 'rect': arr.set(base); R.rect(arr, w, h, start.x, start.y, pt.x, pt.y, color, { fill: opt.shapeFill, size: opt.size, mx, my }); break;
      case 'ellipse': arr.set(base); R.ellipse(arr, w, h, start.x, start.y, pt.x, pt.y, color, { fill: opt.shapeFill, size: opt.size, mx, my }); break;
      case 'move': arr.set(R.shift(base, w, h, pt.x - start.x, pt.y - start.y, false)); break;
    }
    active.last = pt; PF.Renderer.invalidate();
  }
  function shadeAt(pt) {
    const { arr, w, h, erase } = active, o = (opt.size - 1) >> 1, amt = opt.shadeAmt || 18;
    PF.Raster.shadeRegion(arr, w, h, pt.x - o, pt.y - o, pt.x - o + opt.size - 1, pt.y - o + opt.size - 1, erase ? -amt : amt);
  }

  /* ---------- selection + clipboard ---------- */
  const inDoc = pt => { const d = PF.Store.get(); return pt.x >= 0 && pt.y >= 0 && pt.x < d.width && pt.y < d.height; };
  function setSelRect(a, b) {
    const d = PF.Store.get();
    const x0 = Math.max(0, Math.min(a.x, b.x)), y0 = Math.max(0, Math.min(a.y, b.y));
    const x1 = Math.min(d.width - 1, Math.max(a.x, b.x)), y1 = Math.min(d.height - 1, Math.max(a.y, b.y));
    if (x1 < x0 || y1 < y0) { clearSel(); return; }
    sel = { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
    PF.Renderer.setOption('sel', { ...sel });
  }
  const selBox = () => (sel ? { ...sel } : null);
  function clearSel() { if (!sel && !pasteArmed) return; sel = null; pasteArmed = false; PF.Renderer.setOption('sel', null); PF.Store.emit('tool', opt); }
  function copySel() {
    const box = selBox(); if (!box) { PF.UI?.toast('Select a region first (V)'); return false; }
    const d = PF.Store.get(), src = PF.Store.pixels(), data = new Uint32Array(box.w * box.h);
    for (let y = 0; y < box.h; y++) for (let x = 0; x < box.w; x++) data[y * box.w + x] = src[(box.y + y) * d.width + box.x + x];
    clip = { w: box.w, h: box.h, data };
    PF.Store.emit('tool', opt); return true;
  }
  function cutSel() {
    if (!copySel()) return false;
    if (PF.Store.layer().locked) { PF.UI?.toast('Layer is locked'); return false; }
    const box = selBox(), arr = PF.Store.beginStroke();
    for (let y = 0; y < box.h; y++) for (let x = 0; x < box.w; x++) arr[(box.y + y) * activeW() + box.x + x] = 0;
    PF.Store.endStroke(); return true;
  }
  const activeW = () => PF.Store.get().width;
  function deleteSel() {
    const box = selBox(); if (!box) { PF.UI?.toast('Nothing selected'); return false; }
    if (PF.Store.layer().locked) { PF.UI?.toast('Layer is locked'); return false; }
    const arr = PF.Store.beginStroke(), w = activeW();
    for (let y = 0; y < box.h; y++) for (let x = 0; x < box.w; x++) arr[(box.y + y) * w + box.x + x] = 0;
    PF.Store.endStroke(); return true;
  }
  function fillSel() {
    const box = selBox(); if (!box) { PF.UI?.toast('Nothing selected'); return false; }
    if (PF.Store.layer().locked) { PF.UI?.toast('Layer is locked'); return false; }
    const d = PF.Store.get(), c = PF.Color.hexToU32(d.color), arr = PF.Store.beginStroke(), w = d.width;
    for (let y = 0; y < box.h; y++) for (let x = 0; x < box.w; x++) arr[(box.y + y) * w + box.x + x] = c;
    PF.Store.endStroke(); return true;
  }
  function flipSel(horiz) {
    const box = selBox(); if (!box) { PF.UI?.toast('Nothing selected'); return false; }
    if (PF.Store.layer().locked) { PF.UI?.toast('Layer is locked'); return false; }
    const d = PF.Store.get(), arr = PF.Store.beginStroke();
    const t = new Uint32Array(box.w * box.h);
    for (let y = 0; y < box.h; y++) for (let x = 0; x < box.w; x++) t[y * box.w + x] = arr[(box.y + y) * d.width + box.x + x];
    const f = horiz ? PF.Raster.flipH(t, box.w, box.h) : PF.Raster.flipV(t, box.w, box.h);
    for (let y = 0; y < box.h; y++) for (let x = 0; x < box.w; x++) arr[(box.y + y) * d.width + box.x + x] = f[y * box.w + x];
    PF.Store.endStroke(); return true;
  }
  function pasteArm() {
    if (!clip) { PF.UI?.toast('Nothing to paste — copy a selection first'); return false; }
    pasteArmed = true; PF.Store.emit('tool', opt);
    PF.UI?.toast('Click the canvas to place — right-click cancels');
    return true;
  }
  function stampClip(pt) {
    if (PF.Store.layer().locked) { PF.UI?.toast('Layer is locked'); return; }
    const d = PF.Store.get(), arr = PF.Store.beginStroke();
    const ox = pt.x - (clip.w >> 1), oy = pt.y - (clip.h >> 1);
    for (let y = 0; y < clip.h; y++) for (let x = 0; x < clip.w; x++) {
      const v = clip.data[y * clip.w + x]; if (v) PF.Raster.set(arr, d.width, d.height, ox + x, oy + y, v);
    }
    PF.Store.endStroke();
    setSelRect({ x: ox, y: oy }, { x: ox + clip.w - 1, y: oy + clip.h - 1 });
    PF.Store.emit('tool', opt);
  }
  function nudge(dx, dy) {
    if (PF.Store.layer().locked) { PF.UI?.toast('Layer is locked'); return false; }
    const d = PF.Store.get(), arr = PF.Store.beginStroke();
    arr.set(PF.Raster.shift(arr.slice(), d.width, d.height, dx, dy, false));
    PF.Store.endStroke(); return true;
  }

  /* ---------- dither + spray ---------- */
  function mirrorPts(x, y, w, h, mx, my) {
    const pts = [[x, y]];
    if (mx) pts.push([w - 1 - x, y]);
    if (my) pts.push([x, h - 1 - y]);
    if (mx && my) pts.push([w - 1 - x, h - 1 - y]);
    return pts;
  }
  function ditherStamp(cx, cy) {
    const { arr, w, h, color } = active, o = (opt.size - 1) >> 1, R = PF.Raster;
    for (let dy = 0; dy < opt.size; dy++) for (let dx = 0; dx < opt.size; dx++) {
      const px = cx - o + dx, py = cy - o + dy;
      if (((px + py) & 1) !== 0) continue;
      for (const [qx, qy] of mirrorPts(px, py, w, h, opt.mirrorX, opt.mirrorY)) R.set(arr, w, h, qx, qy, color);
    }
  }
  function paintDither(from, to) {
    const steps = Math.max(Math.abs(to.x - from.x), Math.abs(to.y - from.y));
    for (let i = 0; i <= steps; i++) {
      const t = steps ? i / steps : 0;
      ditherStamp(Math.round(from.x + (to.x - from.x) * t), Math.round(from.y + (to.y - from.y) * t));
    }
    PF.Renderer.invalidate();
  }
  function sprayAt(pt) {
    const { arr, w, h, color } = active, R = PF.Raster, r = Math.max(1, opt.size);
    const count = 6 + opt.size * 5;
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2, rr = Math.sqrt(Math.random()) * r;
      const px = Math.round(pt.x + Math.cos(a) * rr), py = Math.round(pt.y + Math.sin(a) * rr);
      for (const [qx, qy] of mirrorPts(px, py, w, h, opt.mirrorX, opt.mirrorY)) R.set(arr, w, h, qx, qy, color);
    }
    PF.Renderer.invalidate();
  }

  /* Public API */
  const setTool = t => { if (!TOOLS.includes(t)) return false; opt.tool = t; pasteArmed = false; PF.Store.emit('tool', opt); return true; };
  const setOption = (k, v) => { opt[k] = v; PF.Store.emit('tool', opt); };
  const setSize = n => setOption('size', Math.max(1, Math.min(32, Math.round(n))));
  const get = () => opt;
  const selInfo = () => ({ sel: selBox(), armed: pasteArmed, hasClip: !!clip });
  return { init, setTool, setOption, setSize, get, TOOLS, selBox, clearSel, copySel, cutSel, deleteSel, fillSel, flipSel, pasteArm, nudge, selInfo };
})();
