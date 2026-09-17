/* PixelForge Studio 2.0 boot: menubar + menus, tool rail (incl. select/dither/spray,
   HSL color, palette tools), stage + selection bar, tabbed inspector, bottom
   timeline, drawers, dialogs, agent console, shortcuts. Canvas by Renderer/Input. */
window.PF = window.PF || {};
const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];

PF.UI = (() => {
  let toastT;
  const toast = msg => { const el = $('#toast'); if (!el) return; el.textContent = msg; el.classList.add('is-on'); clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove('is-on'), 2200); };
  const setTheme = t => { document.documentElement.dataset.theme = t; try { localStorage.setItem('pf-theme', t); } catch {} const b = $('#btn-theme .ms'); if (b) b.textContent = t === 'dark' ? 'light_mode' : 'dark_mode'; };
  const setView = v => {
    if (v === 'agent') { $('#drawer-agent')?.classList.add('is-open'); return; }
    const s = $('#studio'); if (!s) return; s.dataset.view = v;
    $$('.studio__nav button').forEach(b => b.classList.toggle('is-on', b.dataset.view === v));
    if (v === 'canvas') { try { PF.Renderer.fit(); } catch {} }
  };
  const describe = filter => $$('[data-agent-id]').map(el => {
    let r; try { r = el.getBoundingClientRect(); } catch { r = { x: 0, y: 0, width: 0, height: 0 }; }
    const label = el.getAttribute('aria-label') || el.title || (el.textContent || '').trim().slice(0, 40);
    let visible = false;
    try { visible = r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden'; } catch {}
    const o = { id: el.dataset.agentId, label, role: el.getAttribute('role') || el.tagName.toLowerCase(), visible, rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) } };
    if (el.classList.contains('is-on') || el.getAttribute('aria-pressed') === 'true') o.active = true;
    if ('value' in el && el.tagName !== 'BUTTON') o.value = el.value;
    if (el.disabled) o.disabled = true;
    return o;
  }).filter(o => !filter || (o.id + ' ' + o.label).toLowerCase().includes(String(filter).toLowerCase()));
  function click(id, value) {
    const el = $(`[data-agent-id="${CSS.escape(id)}"]`); if (!el) throw new Error(`No UI element with agent id "${id}"`);
    if (value !== undefined && 'value' in el && el.tagName !== 'BUTTON') { el.value = value; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); return { id, value }; }
    try { el.scrollIntoView?.({ block: 'nearest' }); } catch {}
    el.focus?.({ preventScroll: true }); el.click(); return { id, clicked: true };
  }
  return { toast, setTheme, setView, describe, click };
})();

/* Small color math (hex <-> HSL) for the sliders */
function hexToRgb(hex) {
  let h = String(hex || '').trim().replace('#', '');
  if (h.length === 3) h = [...h].map(c => c + c).join('');
  const n = parseInt(h.slice(0, 6), 16);
  return Number.isNaN(n) ? [228, 59, 68] : [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  let h = 0, s = 0; const l = (mx + mn) / 2;
  if (mx !== mn) {
    const d = mx - mn;
    s = l > .5 ? d / (2 - mx - mn) : d / (mx + mn);
    if (mx === r) h = ((g - b) / d + (g < b ? 6 : 0));
    else if (mx === g) h = (b - r) / d + 2; else h = (r - g) / d + 4;
    h *= 60;
  }
  return [Math.round(h), Math.round(s * 100), Math.round(l * 100)];
}
function hslToHex(h, s, l) {
  h = ((h % 360) + 360) % 360; s = Math.max(0, Math.min(100, s)) / 100; l = Math.max(0, Math.min(100, l)) / 100;
  const k = n => (n + h / 30) % 12, a = s * Math.min(l, 1 - l);
  const f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const x = v => Math.round(v * 255).toString(16).padStart(2, '0');
  return '#' + x(f(0)) + x(f(8)) + x(f(4));
}

(function bootStudio() {
  if (!$('#pixel-canvas')) return;
  const S = PF.Store;
  PF.App = { onNewProject: id => { try { history.replaceState(null, '', 'studio.html?project=' + id); } catch {} } };
  const params = new URLSearchParams(location.search);

  /* ---- Open ?project= / ?template= / last-open / blank (never auto-create entries) ---- */
  let opened = false;
  try {
    const pid = params.get('project'), tpl = params.get('template');
    if (pid && PF.Projects.get(pid)) { PF.Projects.open(pid); opened = true; }
    else if (tpl && PF.Library.get(tpl)) {
      const doc = PF.Library.get(tpl).build();
      const nid = PF.Projects.instantiateDocData(doc, doc.name);
      try { history.replaceState(null, '', 'studio.html?project=' + nid); } catch {}
      opened = true;
    }
  } catch (e) { console.warn(e); }
  if (!opened) {
    const last = PF.Projects.openId();
    if (last && PF.Projects.get(last)) { try { PF.Projects.open(last); opened = true; } catch {} }
  }
  if (!opened) S.newDoc({ width: 32, height: 32, name: 'hero-sprite' });
  PF.Projects.trackOpen();

  PF.Renderer.init($('#pixel-canvas'));
  PF.Input.init($('#pixel-canvas'));
  PF.Anim.preview.init($('#preview-canvas'));
  PF.Panels.init();
  PF.UI.setTheme(localStorage.getItem('pf-theme') || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));
  $('#btn-theme').addEventListener('click', () => PF.UI.setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'));

  /* ---- Save status + doc name ---- */
  const nameEl = $('#doc-name');
  nameEl.addEventListener('change', () => {
    S.rename(nameEl.value.trim());
    const id = PF.Projects.openId();
    if (id) PF.Projects.rename(id, S.get().name);
  });
  function setSaved() {
    $('#save-status').classList.remove('is-dirty');
    $('#save-status span:last-child').textContent = 'Saved';
  }
  S.on('doc', () => {
    const d = S.get();
    if (document.activeElement !== nameEl) nameEl.value = d.name;
    if ($('#st-size')) $('#st-size').textContent = `${d.width}×${d.height}`;
    if ($('#st-coords')) $('#st-coords').textContent = `${d.width}×${d.height}`;
    if ($('#cv-size')) $('#cv-size').textContent = `${d.width}×${d.height}`;
    if ($('#cv-stats')) $('#cv-stats').textContent = `${d.states.length} / ${d.states.reduce((n, s) => n + s.frames.length, 0)}`;
    syncStatus();
  });
  S.on('active', syncStatus);
  S.on('change', () => { $('#save-status').classList.add('is-dirty'); });
  S.on('projects', setSaved);
  function syncStatus() {
    const d = S.get(), st = S.state();
    if ($('#st-state')) $('#st-state').textContent = `${st.name} · ${d.activeFrame + 1}/${st.frames.length}`;
    if ($('#st-layer')) $('#st-layer').textContent = d.layers[d.activeLayer]?.name || '';
  }
  const doSave = () => {
    const id = PF.Projects.openId();
    if (id) PF.Projects.persist(id); else PF.Projects.create({ name: S.get().name, width: S.get().width, height: S.get().height });
    PF.UI.toast('Project saved');
  };
  window.addEventListener('beforeunload', () => { try { const id = PF.Projects.openId(); if (id) PF.Projects.persist(id); } catch {} });

  /* ---- Menus ---- */
  const closeMenus = () => $$('.menu.is-open').forEach(m => m.classList.remove('is-open'));
  $$('.menu-btn').forEach(btn => btn.addEventListener('click', e => {
    e.stopPropagation();
    const m = btn.closest('.menu'), was = m.classList.contains('is-open');
    closeMenus(); if (!was) m.classList.add('is-open');
  }));
  $$('.menu').forEach(m => m.addEventListener('pointerenter', () => {
    if ($$('.menu.is-open').length && !m.classList.contains('is-open')) { closeMenus(); m.classList.add('is-open'); }
  }));
  document.addEventListener('pointerdown', e => { if (!e.target.closest('.menu')) closeMenus(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeMenus(); });
  const onMenu = (id, fn) => { const el = $(id); if (el) el.addEventListener('click', () => { closeMenus(); fn(); }); };

  onMenu('#mi-new', () => $('#dlg-new').showModal());
  onMenu('#mi-open', openOpenDialog);
  onMenu('#mi-save', doSave);
  onMenu('#mi-export', () => $('#dlg-export').showModal());
  onMenu('#mi-import-png', () => { $('#dlg-export').showModal(); setTimeout(() => $('#import-png')?.click(), 60); });
  onMenu('#mi-import-json', () => { $('#dlg-export').showModal(); setTimeout(() => $('#import-project')?.click(), 60); });
  onMenu('#mi-undo', () => S.undo());
  onMenu('#mi-redo', () => S.redo());
  onMenu('#mi-cut', () => PF.Input.cutSel());
  onMenu('#mi-copy', () => PF.Input.copySel());
  onMenu('#mi-paste', () => PF.Input.pasteArm());
  onMenu('#mi-del-sel', () => PF.Input.deleteSel());
  onMenu('#mi-desel', () => PF.Input.clearSel());
  onMenu('#mi-dup-frame', () => S.addFrame({ duplicate: true }));
  onMenu('#mi-clear', clearLayer);
  onMenu('#mi-fill-layer', fillLayer);
  onMenu('#mi-resize', () => $('#dlg-new').showModal());
  onMenu('#mi-trim', trimCanvas);
  onMenu('#mi-flip-h', () => PF.Tools.call('flip', { axis: 'x' }));
  onMenu('#mi-flip-v', () => PF.Tools.call('flip', { axis: 'y' }));
  onMenu('#mi-rotate', rotate90);
  onMenu('#mi-outline', outlineLayer);
  onMenu('#mi-replace', startReplaceFlow);
  onMenu('#mi-grid', () => PF.Renderer.setOption('grid', !PF.Renderer.getView().grid));
  onMenu('#mi-onion', () => PF.Renderer.setOption('onion', !PF.Renderer.getView().onion));
  onMenu('#mi-sym-x', () => PF.Input.setOption('mirrorX', !PF.Input.get().mirrorX));
  onMenu('#mi-sym-y', () => PF.Input.setOption('mirrorY', !PF.Input.get().mirrorY));
  onMenu('#mi-zoom-in', () => PF.Renderer.zoomBy(1));
  onMenu('#mi-zoom-out', () => PF.Renderer.zoomBy(-1));
  onMenu('#mi-fit', () => PF.Renderer.fit());
  onMenu('#mi-inspector', () => $('#studio').classList.toggle('hide-inspector'));
  onMenu('#mi-fullscreen', () => { const s = $('#studio'); document.fullscreenElement ? document.exitFullscreen() : s.requestFullscreen?.(); });
  onMenu('#mi-agent-open', () => $('#drawer-agent').classList.add('is-open'));
  onMenu('#mi-shortcuts', () => $('#dlg-help').showModal());
  onMenu('#mi-library', () => { renderLib(); $('#drawer-library').classList.add('is-open'); });
  $$('[data-agent-prompt]').forEach(b => b.addEventListener('click', () => {
    closeMenus(); $('#drawer-agent').classList.add('is-open');
    $('#agent-input').value = b.dataset.agentPrompt;
    setTimeout(() => $('#agent-send').click(), 150);
  }));
  document.addEventListener('fullscreenchange', () => setTimeout(() => PF.Renderer.fit(), 50));

  /* ---- Inspector tabs ---- */
  $$('.tabs button').forEach(b => b.addEventListener('click', () => {
    $$('.tabs button').forEach(x => x.classList.toggle('is-on', x === b));
    $$('.tab-page').forEach(p => p.classList.toggle('is-on', p.id === 'tab-' + b.dataset.tab));
  }));

  /* ---- Zoom / view controls (Canvas tab) ---- */
  $('#btn-zoom-in').addEventListener('click', () => PF.Renderer.zoomBy(1));
  $('#btn-zoom-out').addEventListener('click', () => PF.Renderer.zoomBy(-1));
  $('#btn-fit').addEventListener('click', () => PF.Renderer.fit());
  $('#tgl-grid').addEventListener('click', () => PF.Renderer.setOption('grid', !PF.Renderer.getView().grid));
  $('#tgl-onion').addEventListener('click', () => PF.Renderer.setOption('onion', !PF.Renderer.getView().onion));
  $('#tgl-mirror').addEventListener('click', () => PF.Input.setOption('mirrorX', !PF.Input.get().mirrorX));
  $('#btn-fullscreen').addEventListener('click', () => { const s = $('#studio'); document.fullscreenElement ? document.exitFullscreen() : s.requestFullscreen?.(); });
  $('#btn-flip-h').addEventListener('click', () => PF.Tools.call('flip', { axis: 'x' }));
  $('#btn-flip-v').addEventListener('click', () => PF.Tools.call('flip', { axis: 'y' }));
  $('#btn-rotate').addEventListener('click', rotate90);
  $('#btn-outline').addEventListener('click', outlineLayer);
  $('#btn-replace').addEventListener('click', startReplaceFlow);
  $('#btn-trim').addEventListener('click', trimCanvas);
  function rotate90() {
    const d = S.get(), lid = S.layer().id;
    if (d.width !== d.height) { PF.UI.toast('Rotate needs a square canvas'); return; }
    S.transact(doc => {
      doc.states.forEach(s => s.frames.forEach(f => { f.pixels[lid] = PF.Raster.rotate90(f.pixels[lid], doc.width, doc.height); }));
    });
    S.emit('change');
  }

  /* ---- Canvas ops ---- */
  function clearLayer() {
    if (S.layer().locked) { PF.UI.toast('Layer is locked'); return; }
    S.transact(() => { S.frame().pixels[S.layer().id].fill(0); });
    PF.UI.toast('Layer cleared');
  }
  function fillLayer() {
    if (S.layer().locked) { PF.UI.toast('Layer is locked'); return; }
    const c = PF.Color.hexToU32(S.get().color);
    S.transact(() => { S.frame().pixels[S.layer().id].fill(c); });
    PF.UI.toast('Layer filled');
  }
  function trimCanvas() {
    const d = S.get(), ow = d.width, oh = d.height;
    let x0 = ow, y0 = oh, x1 = -1, y1 = -1;
    d.states.forEach(s => s.frames.forEach(f => {
      for (const id in f.pixels) {
        const p = f.pixels[id];
        for (let y = 0; y < oh; y++) for (let x = 0; x < ow; x++) {
          if (p[y * ow + x]) { if (x < x0) x0 = x; if (y < y0) y0 = y; if (x > x1) x1 = x; if (y > y1) y1 = y; }
        }
      }
    }));
    if (x1 < 0) { PF.UI.toast('Canvas is empty'); return; }
    const nw = x1 - x0 + 1, nh = y1 - y0 + 1;
    if (nw === ow && nh === oh) { PF.UI.toast('Nothing to trim'); return; }
    S.transact(doc => {
      doc.states.forEach(s => s.frames.forEach(f => {
        for (const id in f.pixels) {
          const src = f.pixels[id], dst = new Uint32Array(nw * nh);
          for (let y = 0; y < nh; y++) for (let x = 0; x < nw; x++) dst[y * nw + x] = src[(y0 + y) * ow + (x0 + x)];
          f.pixels[id] = dst;
        }
      }));
      doc.width = nw; doc.height = nh;
    });
    PF.UI.toast(`Trimmed to ${nw}×${nh}`);
  }
  function outlineLayer() {
    if (S.layer().locked) { PF.UI.toast('Layer is locked'); return; }
    const d = S.get(), lid = S.layer().id, c = PF.Color.hexToU32(d.color);
    S.transact(doc => {
      doc.states.forEach(s => s.frames.forEach(f => { f.pixels[lid] = PF.Raster.outline(f.pixels[lid], doc.width, doc.height, c); }));
    });
    S.emit('change');
    PF.UI.toast('Outlined with ' + d.color);
  }
  let replaceTarget = null; // target hex while a replace-color pick is pending
  function startReplaceFlow() {
    replaceTarget = S.get().color;
    PF.Input.setTool('picker');
    PF.UI.toast('Click the canvas color to replace with ' + replaceTarget);
  }

  /* ---- Selection bar ---- */
  const selActions = {
    '#sel-cut': () => PF.Input.cutSel(), '#sel-copy': () => PF.Input.copySel(),
    '#sel-paste': () => PF.Input.pasteArm(), '#sel-delete': () => PF.Input.deleteSel(),
    '#sel-fill': () => PF.Input.fillSel(), '#sel-clear': () => PF.Input.clearSel(),
    '#sel-flip-h': () => PF.Input.flipSel(true)
  };
  for (const id in selActions) $(id)?.addEventListener('click', selActions[id]);
  function syncSel() {
    const info = PF.Input.selInfo();
    $('#sel-bar')?.classList.toggle('hidden', !(info.sel || info.armed));
    if ($('#st-sel')) $('#st-sel').textContent = info.sel ? `sel ${info.sel.w}×${info.sel.h}` : (info.armed ? 'click canvas to place' : '');
    $('#sel-paste')?.classList.toggle('is-on', info.armed);
  }

  /* ---- Tools ---- */
  const toolBtns = $$('[data-tool]');
  toolBtns.forEach(b => b.addEventListener('click', () => { PF.Input.setTool(b.dataset.tool); if (innerWidth < 768 && b.closest('.panel--tools')) PF.UI.setView('canvas'); }));
  $$('[data-tool-opt]').forEach(b => b.addEventListener('click', () => { const k = b.dataset.toolOpt; PF.Input.setOption(k, !PF.Input.get()[k]); }));
  const sizeEl = $('#brush-size'), shadeEl = $('#shade-amt');
  sizeEl.addEventListener('input', () => PF.Input.setSize(+sizeEl.value));
  shadeEl.addEventListener('input', () => { PF.Input.setOption('shadeAmt', +shadeEl.value); $('#shade-amt-val').value = shadeEl.value; });
  const cursors = { pan: 'grab', move: 'move', select: 'cell', picker: 'copy' };
  S.on('tool', o => {
    toolBtns.forEach(b => b.classList.toggle('is-on', b.dataset.tool === o.tool));
    $$('[data-tool-opt]').forEach(b => b.classList.toggle('is-on', !!o[b.dataset.toolOpt]));
    $('#tgl-mirror')?.classList.toggle('is-on', o.mirrorX);
    sizeEl.value = o.size; $('#brush-size-val').value = o.size;
    shadeEl.value = o.shadeAmt || 18; $('#shade-amt-val').value = o.shadeAmt || 18;
    $('#shade-row')?.style.setProperty('opacity', o.tool === 'shade' ? 1 : .45);
    $('#pixel-canvas').style.cursor = cursors[o.tool] || 'crosshair';
    if ($('#st-tool')) $('#st-tool').textContent = o.tool;
    syncSel();
  });
  PF.Input.setTool('pencil');

  S.on('view', v => {
    $('#tgl-grid')?.classList.toggle('is-on', v.grid);
    $('#tgl-onion')?.classList.toggle('is-on', v.onion);
    $('#mi-grid')?.classList.toggle('is-checked', v.grid);
    $('#mi-onion')?.classList.toggle('is-checked', v.onion);
    const zTxt = v.zoom + '×';
    if ($('#zoom-val')) $('#zoom-val').textContent = zTxt;
    if ($('#st-zoom')) $('#st-zoom').textContent = zTxt;
    syncSel();
  });
  new MutationObserver(() => $('#mi-inspector')?.classList.toggle('is-checked', !$('#studio').classList.contains('hide-inspector')))
    .observe($('#studio'), { attributes: true, attributeFilter: ['class'] });
  $('#mi-inspector')?.classList.toggle('is-checked', true);
  S.on('hover', p => {
    const d = S.get();
    const cTxt = p && p.x >= 0 && p.y >= 0 && p.x < d.width && p.y < d.height ? `${p.x}, ${p.y}` : `${d.width}×${d.height}`;
    if ($('#st-coords')) $('#st-coords').textContent = cTxt;
  });

  /* ---- Color & palette ---- */
  const colorInput = $('#color-input'), hexInput = $('#color-hex');
  const hueEl = $('#hue'), satEl = $('#sat'), litEl = $('#lit');
  const applyHex = hex => S.setColor(hex);
  colorInput.addEventListener('input', () => applyHex(colorInput.value));
  hexInput.addEventListener('change', () => { const v = hexInput.value.trim(); if (/^#?[0-9a-f]{6}$/i.test(v)) applyHex(v[0] === '#' ? v : '#' + v); else hexInput.value = S.get().color; });
  const hslFromInputs = () => hslToHex(+hueEl.value, +satEl.value, +litEl.value);
  [hueEl, satEl, litEl].forEach(el => el.addEventListener('input', () => applyHex(hslFromInputs())));
  $('#btn-add-color').addEventListener('click', () => S.addPaletteColor(S.get().color));
  $('#btn-palette-sprite').addEventListener('click', () => {
    const d = S.get(), out = new Uint32Array(d.width * d.height);
    d.states.forEach(s => s.frames.forEach(f => {
      const tmp = new Uint32Array(d.width * d.height);
      PF.Renderer.compositeFrame(f, tmp);
      for (let i = 0; i < tmp.length; i++) if (tmp[i]) out[i] = tmp[i];
    }));
    const found = PF.Raster.colorsOf(out).map(v => PF.Color.u32ToHex(v)).filter(c => c !== 'transparent');
    if (!found.length) { PF.UI.toast('Sprite has no colors yet'); return; }
    const merged = [...d.palette];
    found.forEach(c => { if (!merged.includes(c) && merged.length < 256) merged.push(c); });
    S.setPalette(merged);
    PF.UI.toast(`Added ${found.length} color${found.length > 1 ? 's' : ''} from sprite`);
  });
  function renderPalette() {
    const d = S.get(), el = $('#palette'); el.innerHTML = '';
    d.palette.forEach((c, i) => {
      const b = document.createElement('button'); b.style.background = c; b.title = c;
      b.setAttribute('aria-label', `Color ${c}`); b.dataset.agentId = `palette-${i}`;
      b.className = c === d.color ? 'is-on' : '';
      b.addEventListener('click', () => S.setColor(c));
      b.addEventListener('contextmenu', e => { e.preventDefault(); S.transact(dd => { dd.palette.splice(i, 1); }); });
      el.appendChild(b);
    });
  }
  function syncColor() {
    const c = S.get().color;
    colorInput.value = c.slice(0, 7); hexInput.value = c;
    $('#swatch').style.background = c;
    const [h, s, l] = rgbToHsl(...hexToRgb(c));
    if (document.activeElement !== hueEl) hueEl.value = h;
    if (document.activeElement !== satEl) satEl.value = s;
    if (document.activeElement !== litEl) litEl.value = l;
    hueEl.style.accentColor = `hsl(${h} 90% 55%)`;
    $$('#palette button').forEach(b => b.classList.toggle('is-on', b.title === c));
  }
  S.on('color', hex => {
    syncColor();
    if (replaceTarget) { // the pick completes the replace-color flow
      const from = PF.Color.hexToU32(hex), target = replaceTarget;
      replaceTarget = null;
      PF.Input.setTool('pencil');
      applyReplace(from, PF.Color.hexToU32(target));
    }
  });
  S.on('doc', () => { renderPalette(); syncColor(); });
  renderPalette(); syncColor();
  function applyReplace(from, to) {
    if (!from) return;
    const d = S.get(), lid = S.layer().id;
    let n = 0;
    S.transact(doc => {
      doc.states.forEach(s => s.frames.forEach(f => {
        const p = f.pixels[lid];
        for (let i = 0; i < p.length; i++) if (p[i] === from) { p[i] = to; n++; }
      }));
    });
    S.emit('change');
    PF.UI.toast(n ? `Replaced ${n} pixel${n > 1 ? 's' : ''}` : 'Color not found on this layer');
  }

  /* ---- Timeline extras ---- */
  $('#btn-tl-play').addEventListener('click', () => PF.Anim.toggle());
  const stepFrame = dir => { const d = S.get(), n = S.state().frames.length; S.setActive({ frame: (d.activeFrame + dir + n) % n }); };
  $('#btn-frame-prev').addEventListener('click', () => stepFrame(-1));
  $('#btn-frame-next').addEventListener('click', () => stepFrame(1));
  S.on('play', p => { $$('.js-play-icon').forEach(i => { i.textContent = p ? 'pause' : 'play_arrow'; }); });

  /* ---- Mobile nav ---- */
  $$('.studio__nav button').forEach(b => b.addEventListener('click', () => {
    if (b.dataset.view === 'export') $('#dlg-export').showModal();
    else PF.UI.setView(b.dataset.view);
  }));
  PF.UI.setView('canvas');

  /* ---- Keyboard ---- */
  const KEYS = { b: 'pencil', e: 'eraser', g: 'fill', l: 'line', r: 'rect', o: 'ellipse', i: 'picker', m: 'move', h: 'pan', u: 'shade', v: 'select', d: 'dither', s: 'spray' };
  window.addEventListener('keydown', e => {
    if (/INPUT|TEXTAREA|SELECT/.test(e.target.tagName) || e.target.isContentEditable) return;
    if (e.target.tagName === 'BUTTON' && (e.key === ' ' || e.key === 'Enter')) return;
    if (e.key === '?' && !e.ctrlKey && !e.metaKey) { $('#dlg-help').showModal(); return; }
    const k = e.key.toLowerCase(), mod = e.ctrlKey || e.metaKey;
    if (mod && k === 'z') { e.preventDefault(); e.shiftKey ? S.redo() : S.undo(); return; }
    if (mod && k === 'y') { e.preventDefault(); S.redo(); return; }
    if (mod && k === 's') { e.preventDefault(); doSave(); return; }
    if (mod && k === 'e') { e.preventDefault(); $('#dlg-export').showModal(); return; }
    if (mod && k === 'o') { e.preventDefault(); openOpenDialog(); return; }
    if (mod && k === 'd') { e.preventDefault(); S.addFrame({ duplicate: true }); return; }
    if (mod && k === 'x' && !e.shiftKey) { e.preventDefault(); PF.Input.cutSel(); return; }
    if (mod && k === 'c') { e.preventDefault(); PF.Input.copySel(); return; }
    if (mod && k === 'v') { e.preventDefault(); PF.Input.pasteArm(); return; }
    if (mod) return;
    if (KEYS[k]) PF.Input.setTool(KEYS[k]);
    else if (k === '[') PF.Input.setSize(PF.Input.get().size - 1);
    else if (k === ']') PF.Input.setSize(PF.Input.get().size + 1);
    else if (k === 'x') PF.Input.setOption('mirrorX', !PF.Input.get().mirrorX);
    else if (k === 'f') PF.Input.setOption('shapeFill', !PF.Input.get().shapeFill);
    else if (k === '+' || k === '=') PF.Renderer.zoomBy(1);
    else if (k === '-') PF.Renderer.zoomBy(-1);
    else if (k === '0') PF.Renderer.fit();
    else if (k === 'p' || k === ' ') { e.preventDefault(); PF.Anim.toggle(); }
    else if (k === ',' || k === '.') stepFrame(k === '.' ? 1 : -1);
    else if (k === '`') PF.Renderer.setOption('grid', !PF.Renderer.getView().grid);
    else if (k === 'delete' || k === 'backspace') PF.Input.deleteSel();
    else if (k === 'escape') {
      closeMenus();
      if ($('#drawer-agent').classList.contains('is-open')) $('#drawer-agent').classList.remove('is-open');
      else if ($('#drawer-library').classList.contains('is-open')) $('#drawer-library').classList.remove('is-open');
      else PF.Input.clearSel();
      replaceTarget = null;
    }
    else if (k.startsWith('arrow')) {
      const dx = k === 'arrowleft' ? -1 : k === 'arrowright' ? 1 : 0;
      const dy = k === 'arrowup' ? -1 : k === 'arrowdown' ? 1 : 0;
      if (dx || dy) { e.preventDefault(); const m = e.shiftKey ? 10 : 1; PF.Input.nudge(dx * m, dy * m); }
      return;
    }
    else if (k === 'escape' && document.fullscreenElement) document.exitFullscreen();
    else return;
    e.preventDefault();
  });

  /* ---- Panels + agent console ---- */
  PF.Panels.init();
  PF.Agent.init({ log: $('#agent-log'), input: $('#agent-input'), send: $('#agent-send'), chips: $('#agent-chips') });
  const dp = params.get('prompt');
  if (dp) {
    $('#drawer-agent').classList.add('is-open');
    $('#agent-input').value = dp;
    setTimeout(() => $('#agent-send').click(), 700);
  }
  const mini = $('#agent-tools-mini');
  PF.Tools.list().forEach(t => {
    const b = document.createElement('button'); b.textContent = t.name; b.title = t.description;
    b.dataset.agentId = `tool-chip-${t.name}`;
    b.addEventListener('click', () => { $('#agent-input').value = `/${t.name} `; $('#agent-input').focus(); });
    mini.appendChild(b);
  });
  $('#btn-agent-tools').addEventListener('click', () => mini.classList.toggle('hidden'));
  $('#btn-agent').addEventListener('click', () => $('#drawer-agent').classList.toggle('is-open'));
  $('#agent-close').addEventListener('click', () => $('#drawer-agent').classList.remove('is-open'));

  /* ---- Library drawer ---- */
  const drawer = $('#drawer-library');
  $('#btn-library').addEventListener('click', () => { renderLib(); drawer.classList.toggle('is-open'); });
  $('#lib-close').addEventListener('click', () => drawer.classList.remove('is-open'));
  $('#lib-search').addEventListener('input', renderLib);
  (function initLibCats() {
    const cats = $('#lib-cats');
    PF.Library.categories().forEach((c, i) => {
      const b = document.createElement('button');
      b.className = 'chip' + (i === 0 ? ' is-on' : ''); b.textContent = c;
      b.addEventListener('click', () => { $$('#lib-cats .chip').forEach(x => x.classList.toggle('is-on', x === b)); renderLib(); });
      cats.appendChild(b);
    });
  })();
  function renderLib() {
    const cat = $('#lib-cats .chip.is-on')?.textContent || 'All';
    const term = ($('#lib-search').value || '').toLowerCase(), body = $('#library-body');
    body.innerHTML = '';
    PF.Library.list()
      .filter(t => cat === 'All' || (cat === 'Featured' ? t.featured : t.category === cat))
      .filter(t => !term || (t.name + ' ' + t.desc + ' ' + t.tags.join(' ')).toLowerCase().includes(term))
      .slice(0, 60)
      .forEach(t => {
        const stats = PF.Library.docStats(t.id) || { states: 0, frames: 0 };
        const row = document.createElement('div');
        row.className = 'lib-item';
        row.innerHTML = `<img alt=""><div class="grow"><b></b><span></span></div><div class="col"><button class="btn btn--filled btn--sm" data-open>Open</button><button class="btn btn--soft btn--sm" data-add>+States</button></div>`;
        row.querySelector('img').src = PF.Library.thumbnail(t.id, 2);
        row.querySelector('b').textContent = t.name;
        row.querySelector('span').textContent = `${t.category} · ${stats.states} states · ${stats.frames} frames`;
        row.querySelector('[data-open]').addEventListener('click', async () => {
          await PF.Tools.call('load_template', { id: t.id });
          try { history.replaceState(null, '', 'studio.html?project=' + PF.Projects.openId()); } catch {}
          drawer.classList.remove('is-open');
          PF.UI.toast('Opened ' + t.name);
        });
        row.querySelector('[data-add]').addEventListener('click', async () => {
          const r = await PF.Tools.call('append_template_states', { id: t.id });
          PF.UI.toast(r.ok ? `Appended ${r.result.appended} state(s)` : r.error);
        });
        body.appendChild(row);
      });
  }

  /* ---- Open + help dialogs ---- */
  function openOpenDialog() {
    const list = $('#open-list'); list.innerHTML = '';
    PF.Projects.list().forEach(p => {
      const b = document.createElement('button');
      b.className = 'open-item' + (p.id === PF.Projects.openId() ? ' is-on' : '');
      b.innerHTML = `<span class="grow"><b></b><br><span class="muted" style="font-size:.72rem"></span></span>`;
      if (p.thumbnail) { const img = document.createElement('img'); img.src = p.thumbnail; img.alt = ''; b.prepend(img); }
      b.querySelector('b').textContent = p.name;
      b.querySelector('.muted').textContent = `${p.width}×${p.height} · ${p.states} states · ${PF.Projects.timeAgo(p.updatedAt)}`;
      b.addEventListener('click', () => {
        PF.Projects.open(p.id);
        try { history.replaceState(null, '', 'studio.html?project=' + p.id); } catch {}
        $('#dlg-open').close();
      });
      list.appendChild(b);
    });
    $('#dlg-open').showModal();
  }
  $$('dialog').forEach(d => {
    d.addEventListener('click', e => { if (e.target === d) d.close(); });
    d.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => d.close()));
  });

  S.emit('view', PF.Renderer.getView()); S.emit('tool', PF.Input.get());
})();
