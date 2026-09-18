/* A throwaway DOM for running browser games under Node.

   Two backends. `null` gives canvases that swallow every draw call — fast, and
   all you need to prove a game's logic does not throw. `soft` swaps in
   scripts/soft-canvas.js, which actually rasterises, so the same driver can
   take a screenshot of the real render path.

   This is a stub, not a browser: no layout, no CSS, no real event capture or
   bubbling. Elements are addressed by id and events are fired at them
   directly. That is enough for canvas games, which is all it is for. */
const fs = require('fs');
const { SoftCanvas } = require('./soft-canvas');

const noop = () => {};

function nullCtx(cv) {
  const grad = { addColorStop: noop };
  return {
    canvas: cv, globalAlpha: 1, globalCompositeOperation: 'source-over',
    fillStyle: '#000', strokeStyle: '#000', lineWidth: 1, font: '', textAlign: 'left',
    imageSmoothingEnabled: true,
    save: noop, restore: noop, translate: noop, scale: noop, rotate: noop,
    setTransform: noop, transform: noop, resetTransform: noop, clip: noop,
    beginPath: noop, closePath: noop, moveTo: noop, lineTo: noop, arc: noop,
    arcTo: noop, rect: noop, ellipse: noop, quadraticCurveTo: noop, bezierCurveTo: noop,
    fill: noop, stroke: noop, fillRect: noop, strokeRect: noop, clearRect: noop,
    fillText: noop, strokeText: noop, drawImage: noop, putImageData: noop,
    measureText: () => ({ width: 0 }),
    createLinearGradient: () => grad, createRadialGradient: () => grad,
    createPattern: () => null,
    createImageData: (w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }),
    getImageData: (x, y, w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) })
  };
}

function makeDom(html, opts) {
  const soft = (opts || {}).canvas === 'soft';
  const byId = {};
  const all = [];

  function el(tag, id) {
    const isCanvas = (tag || '').toLowerCase() === 'canvas';
    const backing = soft && isCanvas ? new SoftCanvas(300, 150) : null;
    const e = {
      tagName: (tag || 'div').toUpperCase(), id: id || '',
      children: [], listeners: {}, style: {}, dataset: {},
      _text: '', _html: '',
      get width() { return backing ? backing.width : this._w === undefined ? 300 : this._w; },
      set width(v) { backing ? (backing.width = v) : (this._w = v | 0); },
      get height() { return backing ? backing.height : this._h === undefined ? 150 : this._h; },
      set height(v) { backing ? (backing.height = v) : (this._h = v | 0); },
      get data() { return backing ? backing.data : null; },
      get textContent() { return this._text; },
      set textContent(v) { this._text = String(v); },
      get innerHTML() { return this._html; },
      set innerHTML(v) { this._html = String(v); if (v === '') this.children.length = 0; },
      classList: {
        _s: new Set(),
        add(...c) { c.forEach(x => this._s.add(x)); },
        remove(...c) { c.forEach(x => this._s.delete(x)); },
        contains(c) { return this._s.has(c); },
        toggle(c, on) {
          const want = on === undefined ? !this._s.has(c) : !!on;
          want ? this._s.add(c) : this._s.delete(c);
          return want;
        }
      },
      setAttribute: noop, removeAttribute: noop, getAttribute: () => null,
      appendChild(c) { this.children.push(c); return c; },
      removeChild(c) { const i = this.children.indexOf(c); if (i >= 0) this.children.splice(i, 1); return c; },
      addEventListener(type, fn) { (this.listeners[type] || (this.listeners[type] = [])).push(fn); },
      removeEventListener(type, fn) {
        const l = this.listeners[type]; if (!l) return;
        const i = l.indexOf(fn); if (i >= 0) l.splice(i, 1);
      },
      emit(type, ev) {
        for (const fn of (this.listeners[type] || []).slice())
          fn(Object.assign({ type, preventDefault: noop, stopPropagation: noop,
            clientX: 0, clientY: 0, changedTouches: [], touches: [], key: '' }, ev));
      },
      getBoundingClientRect: () => ({ left: 0, top: 0, right: 120, bottom: 120,
        width: 120, height: 120, x: 0, y: 0 }),
      focus: noop, blur: noop,
      click() { this.emit('click', {}); },
      querySelector: () => null, querySelectorAll: () => [],
      getContext() {
        if (backing) return backing.getContext();
        return e._ctx || (e._ctx = nullCtx(e));
      },
      toDataURL: () => 'data:image/png;base64,'
    };
    if (id) byId[id] = e;
    all.push(e);
    return e;
  }

  // every id the markup declares gets a live stub, so $('#x') never returns null
  for (const m of html.matchAll(/id="([^"]+)"/g)) {
    const lt = html.lastIndexOf('<', m.index);
    const tag = (html.slice(lt + 1, lt + 24).match(/^[a-zA-Z0-9-]+/) || ['div'])[0];
    el(tag, m[1]);
  }

  const doc = {
    byId, all, readyState: 'complete', title: '',
    body: el('body'), documentElement: el('html'), head: el('head'),
    createElement: tag => el(tag),
    createElementNS: (ns, tag) => el(tag),
    getElementById: id => byId[id] || null,
    querySelector: sel => (sel[0] === '#' ? byId[sel.slice(1)] || null : null),
    querySelectorAll: () => [],
    addEventListener: noop, removeEventListener: noop,
    createTextNode: t => ({ textContent: t })
  };
  return doc;
}

/* Installs the globals a page script expects and returns the handles a driver
   needs: the document, a frame pump, and an event emitter. */
function installGlobals(doc, opts) {
  const o = opts || {};
  global.document = doc;
  global.innerWidth = o.width || 960;
  global.innerHeight = o.height || 600;
  global.devicePixelRatio = o.dpr || 2;
  global.location = { href: 'http://localhost/', search: '', hash: '' };
  global.navigator = { userAgent: 'pixelforge-sim', maxTouchPoints: 0 };

  const store = new Map();
  global.localStorage = {
    getItem: k => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: k => store.delete(k),
    clear: () => store.clear()
  };

  const raf = [];
  global.requestAnimationFrame = cb => (raf.push(cb), raf.length);
  global.cancelAnimationFrame = noop;

  const glisten = {};
  global.addEventListener = (t, fn) => (glisten[t] || (glisten[t] = [])).push(fn);
  global.removeEventListener = (t, fn) => {
    const l = glisten[t]; if (!l) return;
    const i = l.indexOf(fn); if (i >= 0) l.splice(i, 1);
  };

  const emit = (t, ev) => {
    for (const fn of (glisten[t] || []).slice())
      fn(Object.assign({ type: t, preventDefault: noop, stopPropagation: noop,
        key: '', changedTouches: [], touches: [] }, ev));
  };

  let clock = 0;
  const pump = () => {
    const batch = raf.splice(0, raf.length);
    clock += 1000 / 60;
    for (const cb of batch) cb(clock);
    return batch.length;
  };
  return { emit, pump };
}

/* Evaluates a page's own scripts — the engine and library come from lib-boot,
   so re-running them would register every template twice. */
function loadScripts(html, dir) {
  const path = require('path');
  /* Match by PATH, not basename: runefall ships its own js/world.js, and the
     library has js/library/world.js. Filtering on the filename alone would
     silently drop half the game. */
  const srcs = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map(m => m[1])
    .filter(u => !/^https?:/.test(u))
    .filter(u => !/(^|\/)js\/(core|library)\//.test(u));
  for (const u of srcs) {
    const abs = path.resolve(dir, u);
    if (!fs.existsSync(abs)) throw new Error('missing script ' + u);
    try { (0, eval)(fs.readFileSync(abs, 'utf8')); }
    catch (e) { throw new Error(u + ' threw at load — ' + e.stack); }
  }
  return srcs;
}

module.exports = { makeDom, installGlobals, loadScripts };
