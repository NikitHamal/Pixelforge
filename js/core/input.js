/* PixelForge Studio — Pointer input & interactive tools (mouse, touch, pen; pinch-zoom; symmetry) */
window.PF = window.PF || {};
PF.Input = (() => {
  const TOOLS = ['pencil', 'eraser', 'fill', 'line', 'rect', 'ellipse', 'picker', 'move', 'pan', 'shade', 'select'];
  const opt = { tool: 'pencil', size: 1, shapeFill: false, mirrorX: false, mirrorY: false, contiguous: true, spaceHeld: false };
  const pointers = new Map();
  let active = null, panning = null, pinch = null, canvas;

  function init(el) {
    canvas = el;
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', cancel);
    el.addEventListener('pointerleave', () => { if (!active) PF.Renderer.setHover(null); });
    el.addEventListener('wheel', wheel, { passive: false });
    el.addEventListener('contextmenu', e => e.preventDefault());
    window.addEventListener('keydown', e => { if (e.code === 'Space' && !isTyping(e)) { opt.spaceHeld = true; e.preventDefault(); } });
    window.addEventListener('keyup', e => { if (e.code === 'Space') opt.spaceHeld = false; });
    window.addEventListener('blur', cancel);
  }
  const isTyping = e => /^(INPUT|TEXTAREA|SELECT|BUTTON|A)$/.test(e.target.tagName) || e.target.isContentEditable || !!e.target.closest?.('dialog[open]');

  function down(e) {
    if (opt.tool === 'select' && !opt.spaceHeld) return;
    PF.Anim.pause();
    canvas.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 2) { // second finger → pinch, cancel current stroke
      if (active) { PF.Store.cancelStroke(); active = null; }
      const [a, b] = [...pointers.values()], v = PF.Renderer.getView();
      pinch = { dist: Math.hypot(a.x - b.x, a.y - b.y), zoom: v.zoom, mid: mid(a, b), panX: v.panX, panY: v.panY };
      panning = null; return;
    }
    if (pointers.size > 2) return;
    const wantPan = e.button === 1 || opt.tool === 'pan' || opt.spaceHeld;
    if (wantPan) { const v = PF.Renderer.getView(); panning = { x: e.clientX, y: e.clientY, panX: v.panX, panY: v.panY }; return; }
    if (e.button !== 0 && e.button !== 2) return;
    const d = PF.Store.get(), pt = PF.Renderer.toPixel(e.clientX, e.clientY), layer = PF.Store.layer();
    if (opt.tool === 'picker') { pick(pt); return; }
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
    PF.Renderer.setHover(pt, ['pencil', 'eraser', 'line', 'rect', 'ellipse'].includes(opt.tool) ? opt.size : 1);
    if (active && e.pointerId === active.id) {
      // coalesce events for smooth fast strokes
      const coalesced = e.getCoalescedEvents ? e.getCoalescedEvents() : [];
      const evs = coalesced.length ? coalesced : [e];
      for (const ce of evs) apply(PF.Renderer.toPixel(ce.clientX, ce.clientY), false);
    }
  }
  function up(e) {
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinch = null;
    if (panning) panning = null;
    if (active && e.pointerId === active.id) { active = null; PF.Store.endStroke(); }
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
    const { arr, w, h, erase } = active, o = (opt.size - 1) >> 1;
    PF.Raster.shadeRegion(arr, w, h, pt.x - o, pt.y - o, pt.x - o + opt.size - 1, pt.y - o + opt.size - 1, erase ? -18 : 18);
  }

  /* Public API */
  function cancel() { if (active) PF.Store.cancelStroke(); active = null; panning = null; pinch = null; pointers.clear(); opt.spaceHeld = false; }
  const setTool = t => { if (!TOOLS.includes(t)) return false; cancel(); opt.tool = t; PF.Store.emit('tool', opt); return true; };
  const setOption = (k, v) => { opt[k] = v; PF.Store.emit('tool', opt); };
  const setSize = n => setOption('size', Math.max(1, Math.min(32, Math.round(n))));
  const get = () => opt;
  return { init, setTool, setOption, setSize, get, cancel, TOOLS };
})();
