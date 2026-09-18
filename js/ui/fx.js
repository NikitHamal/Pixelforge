/* PixelForge Studio — Effects, palette and tile-preview inspector tab.

   PF.Effects, PF.Palette and PF.Tiles are pure buffer maths with no UI of
   their own. This is the surface that makes them reachable: pick an effect,
   watch a live thumbnail of the result, then commit it at the scope you meant
   — this frame, this state, or the whole document.

   Nothing here mutates until Apply. The thumbnail runs the effect on a copy,
   which is exactly what "non-destructive" has to mean for a panel where the
   sliders move continuously. */
window.PF = window.PF || {};
PF.Fx = (() => {
  const q = (s, r = document) => r.querySelector(s);
  const S = () => PF.Store;
  let fx = null;                       // active effect descriptor from PF.Effects.LIST
  let opts = {};                       // current option values, seeded from fx.opts
  let thumbRaf = 0;

  /* ------------------------------------------------------------ effects */

  function init() {
    const sel = q('#fx-effect');
    PF.Effects.LIST.forEach(e => {
      const o = document.createElement('option'); o.value = e.id; o.textContent = e.name; sel.appendChild(o);
    });
    sel.addEventListener('change', () => selectEffect(sel.value));
    q('#fx-apply').addEventListener('click', apply);
    q('#fx-reset').addEventListener('click', () => selectEffect(fx.id));

    const pal = q('#pal-preset');
    PF.Palette.names().forEach(n => { const o = document.createElement('option'); o.value = n; o.textContent = n; pal.appendChild(o); });
    q('#pal-load').addEventListener('click', loadPalette);
    q('#pal-quantize').addEventListener('click', quantize);
    q('#pal-download').addEventListener('click', downloadPalette);

    q('#tile-refresh').addEventListener('click', drawTile);
    S().on('change', schedule); S().on('active', schedule); S().on('doc', schedule);

    selectEffect(PF.Effects.LIST[0].id);
  }

  function selectEffect(id) {
    fx = PF.Effects.LIST.find(e => e.id === id) || PF.Effects.LIST[0];
    opts = Object.assign({}, fx.opts);
    q('#fx-effect').value = fx.id;
    renderOpts();
    schedule();
  }

  /* Ranges are declared per effect+option rather than inferred from the
     default value. Inference looked tidy until `bevel.light` (a hex string)
     met `hue.light` (a -1..1 number) and `hue.sat` (a 0..2 multiplier whose
     default of exactly 1 reads as an integer). The type of control still comes
     from the default's type; only the bounds are spelled out. */
  const RANGE = {
    'glow.radius': [1, 8, 1], 'glow.strength': [0, 1, 0.05],
    'shadow.dx': [-8, 8, 1], 'shadow.dy': [-8, 8, 1], 'shadow.alpha': [0, 1, 0.05],
    'bevel.amount': [0, 4, 1],
    'hue.hue': [-1, 1, 0.01], 'hue.sat': [0, 2, 0.05], 'hue.light': [-1, 1, 0.05],
    'brightness.amount': [-1, 1, 0.05], 'contrast.amount': [-1, 1, 0.05],
    'tint.amount': [0, 1, 0.05], 'posterize.levels': [2, 16, 1], 'dither.amount': [0, 1, 0.05],
    'normal.strength': [0, 4, 0.1], 'normal.depth': [1, 8, 1]
  };

  function renderOpts() {
    const el = q('#fx-opts'); el.innerHTML = '';
    const keys = Object.keys(fx.opts);
    if (!keys.length) { el.innerHTML = '<p class="muted" style="font-size:.72rem">No options.</p>'; return; }
    for (const k of keys) {
      const def = fx.opts[k];
      const row = document.createElement('label'); row.className = 'fx-opt';
      const name = document.createElement('span'); name.textContent = k;
      const input = document.createElement('input');
      input.dataset.agentId = `fx-opt-${k}`;
      input.setAttribute('aria-label', `${fx.name} ${k}`);
      if (typeof def === 'string') {
        input.type = 'color'; input.value = def;
        input.addEventListener('input', () => { opts[k] = input.value; schedule(); });
        row.append(name, input);
      } else if (typeof def === 'boolean') {
        input.type = 'checkbox'; input.checked = def;
        input.addEventListener('change', () => { opts[k] = input.checked; schedule(); });
        row.append(name, input);
      } else {
        const [min, max, step] = RANGE[`${fx.id}.${k}`] || [0, Math.max(1, def * 4), 0.05];
        input.type = 'range'; input.min = min; input.max = max; input.step = step; input.value = def;
        const out = document.createElement('b'); out.textContent = def;
        input.addEventListener('input', () => { opts[k] = +input.value; out.textContent = input.value; schedule(); });
        row.append(name, input, out);
      }
      el.appendChild(row);
    }
  }

  const run = buf => {
    const d = S().get();
    return PF.Effects.apply(fx.id, buf, d.width, d.height, opts);
  };

  /* The preview is the ACTIVE LAYER only, because that is what Apply writes.
     Compositing the whole frame here would show a result the button cannot
     produce. */
  function preview() {
    const d = S().get(), f = S().frame(), lid = S().layer().id;
    const src = f.pixels[lid];
    let outBuf;
    try { outBuf = run(src); }
    catch (e) { outBuf = src; }
    const cv = q('#fx-thumb');
    const scale = Math.max(1, Math.min(6, Math.floor(120 / Math.max(d.width, d.height))));
    PF.Renderer.bufferToCanvas(outBuf, d.width, d.height, scale, cv);
  }

  function schedule() {
    cancelAnimationFrame(thumbRaf);
    thumbRaf = requestAnimationFrame(() => { preview(); drawTile(); });
  }

  /* Which frames a panel button touches, for the scope dropdown both effects
     and quantize share. Returned from inside transact() so the frames are the
     draft document's, not a stale reference to the committed one. */
  const scopeFrames = (doc, scope) =>
    scope === 'frame' ? [doc.states[doc.activeState].frames[doc.activeFrame]]
      : scope === 'state' ? doc.states[doc.activeState].frames.slice()
        : doc.states.flatMap(s => s.frames);

  /* One transaction for the whole scope, so undo takes the operation back as
     one step rather than one step per frame. */
  function eachFrame(label, fn) {
    if (S().layer().locked) { PF.UI.toast('Layer is locked'); return; }
    const scope = q('#fx-scope').value, lid = S().layer().id;
    let n = 0;
    S().transact(doc => {
      for (const f of scopeFrames(doc, scope)) { f.pixels[lid] = fn(f.pixels[lid], doc); n++; }
    });
    S().emit('change');
    PF.UI.toast(`${label} — ${n} frame${n === 1 ? '' : 's'}`);
  }

  const apply = () => eachFrame(fx.name, (px, doc) => PF.Effects.apply(fx.id, px, doc.width, doc.height, opts));

  /* ------------------------------------------------------------ palette */

  function loadPalette() {
    const name = q('#pal-preset').value, pal = PF.Palette.get(name);
    if (!pal.length) { PF.UI.toast('Empty palette'); return; }
    S().setPalette(pal);
    PF.UI.toast(`Loaded ${name} (${pal.length} colours)`);
  }

  function quantize() {
    const name = q('#pal-preset').value, pal = PF.Palette.get(name);
    const dither = q('#pal-dither').checked ? 0.5 : 0;
    eachFrame(`Quantized to ${name} (${pal.length})`,
      (px, doc) => PF.Palette.quantize(px, doc.width, doc.height, pal, { dither }));
  }

  function downloadPalette() {
    const d = S().get(), name = q('#pal-preset').value;
    // The DOCUMENT palette is what the artist actually built; the preset menu
    // only names the source they started from.
    const pal = d.palette.length ? d.palette : PF.Palette.get(name);
    PF.IO.download(PF.Palette.format(pal, 'gpl', d.name || name), `${(d.name || name).replace(/[^a-z0-9_-]+/gi, '-').toLowerCase()}.gpl`, 'text/plain');
  }

  /* -------------------------------------------------------------- tiles */

  function drawTile() {
    const d = S().get(), cv = q('#tile-canvas');
    if (!cv) return;
    const buf = new Uint32Array(d.width * d.height);
    PF.Renderer.compositeFrame(S().frame(), buf);
    const p = PF.Tiles.preview(buf, d.width, d.height, 3);
    const scale = Math.max(1, Math.min(4, Math.floor(168 / p.width)));
    PF.Renderer.bufferToCanvas(p.pixels, p.width, p.height, scale, cv);
    const s = PF.Tiles.seamScore(buf, d.width, d.height);
    const el = q('#tile-seam');
    el.textContent = s.seamless ? 'seamless' : `${s.score.toFixed(2)}× (H ${s.horizontal.toFixed(1)} / V ${s.vertical.toFixed(1)})`;
    el.classList.toggle('is-bad', !s.seamless);
  }

  return { init, selectEffect, apply, drawTile };
})();
