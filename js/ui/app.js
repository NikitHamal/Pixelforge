/* PixelForge Studio — App shell: boot, PF.UI (toast/theme/views/agent-addressable UI), toolbar, tools & palette */
window.PF = window.PF || {};
const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];

PF.UI = (() => {
  let toastT;
  const toast = msg => { const el = $('#toast'); el.textContent = msg; el.classList.add('is-on'); clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove('is-on'), 2200); };
  const setTheme = t => { document.documentElement.dataset.theme = t; localStorage.setItem('pf-theme', t); $('#btn-theme .ms').textContent = t === 'dark' ? 'light_mode' : 'dark_mode'; };
  const setView = v => { const s = $('#studio'); s.dataset.view = v; $$('.studio__nav button').forEach(b => b.classList.toggle('is-on', b.dataset.view === v)); if (v === 'canvas') PF.Renderer.fit(); };
  /* Agent-addressable UI map: every element with data-agent-id */
  const describe = filter => $$('[data-agent-id]').map(el => {
    const r = el.getBoundingClientRect(), label = el.getAttribute('aria-label') || el.title || el.textContent.trim().slice(0, 40);
    const visible = r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden';
    const o = { id: el.dataset.agentId, label, role: el.getAttribute('role') || el.tagName.toLowerCase(), visible, rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) } };
    if (el.classList.contains('is-on') || el.getAttribute('aria-pressed') === 'true') o.active = true;
    if ('value' in el && el.tagName !== 'BUTTON') o.value = el.value;
    if (el.disabled) o.disabled = true;
    return o;
  }).filter(o => !filter || (o.id + ' ' + o.label).toLowerCase().includes(String(filter).toLowerCase()));
  function click(id, value) {
    const el = $(`[data-agent-id="${CSS.escape(id)}"]`); if (!el) throw new Error(`No UI element with agent id "${id}"`);
    if (value !== undefined && 'value' in el && el.tagName !== 'BUTTON') { el.value = value; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); return { id, value }; }
    el.scrollIntoView?.({ block: 'nearest' }); el.focus?.({ preventScroll: true }); el.click(); return { id, clicked: true };
  }
  return { toast, setTheme, setView, describe, click };
})();

(function boot() {
  const S = PF.Store;
  S.newDoc({ width: 32, height: 32, name: 'hero-sprite' });
  PF.Renderer.init($('#pixel-canvas'));
  PF.Input.init($('#pixel-canvas'));
  PF.Anim.preview.init($('#preview-canvas'));
  PF.UI.setTheme(localStorage.getItem('pf-theme') || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));
  $('#btn-theme').addEventListener('click', () => PF.UI.setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'));

  /* ---- Studio bar ---- */
  const nameEl = $('#doc-name');
  nameEl.addEventListener('change', () => S.rename(nameEl.value.trim()));
  $('#btn-undo').addEventListener('click', () => S.undo()); $('#btn-redo').addEventListener('click', () => S.redo());
  const syncHistory = () => { $('#btn-undo').disabled = !S.canUndo(); $('#btn-redo').disabled = !S.canRedo(); };
  S.on('history', syncHistory); syncHistory();
  $('#btn-zoom-in').addEventListener('click', () => PF.Renderer.zoomBy(1)); $('#btn-zoom-out').addEventListener('click', () => PF.Renderer.zoomBy(-1));
  $('#btn-fit').addEventListener('click', () => PF.Renderer.fit());
  const toggles = { 'tgl-grid': 'grid', 'tgl-onion': 'onion' };
  for (const id in toggles) $('#' + id).addEventListener('click', () => PF.Renderer.setOption(toggles[id], !PF.Renderer.getView()[toggles[id]]));
  $('#tgl-mirror').addEventListener('click', () => PF.Input.setOption('mirrorX', !PF.Input.get().mirrorX));
  S.on('view', v => { $('#tgl-grid').classList.toggle('is-on', v.grid); $('#tgl-onion').classList.toggle('is-on', v.onion); $('#hud-zoom').textContent = v.zoom + '×'; $('#zoom-val').textContent = v.zoom + '×'; });
  S.on('hover', p => { const d = S.get(); $('#hud-coords').textContent = p && p.x >= 0 && p.y >= 0 && p.x < d.width && p.y < d.height ? `${p.x}, ${p.y}` : `${d.width}×${d.height}`; });
  $('#btn-fullscreen').addEventListener('click', () => { const s = $('#studio'); document.fullscreenElement ? document.exitFullscreen() : s.requestFullscreen?.(); });
  document.addEventListener('fullscreenchange', () => setTimeout(() => PF.Renderer.fit(), 50));
  S.on('doc', () => { const d = S.get(); nameEl.value = d.name; $('#hud-coords').textContent = `${d.width}×${d.height}`; });

  /* ---- Tools ---- */
  const toolBtns = $$('[data-tool]');
  toolBtns.forEach(b => b.addEventListener('click', () => { PF.Input.setTool(b.dataset.tool); if (innerWidth < 768 && b.closest('.panel--tools')) PF.UI.setView('canvas'); }));
  $$('[data-tool-opt]').forEach(b => b.addEventListener('click', () => { const k = b.dataset.toolOpt; PF.Input.setOption(k, !PF.Input.get()[k]); }));
  const sizeEl = $('#brush-size');
  sizeEl.addEventListener('input', () => PF.Input.setSize(+sizeEl.value));
  S.on('tool', o => {
    toolBtns.forEach(b => b.classList.toggle('is-on', b.dataset.tool === o.tool));
    $$('[data-tool-opt]').forEach(b => b.classList.toggle('is-on', !!o[b.dataset.toolOpt]));
    $('#tgl-mirror').classList.toggle('is-on', o.mirrorX); sizeEl.value = o.size; $('#brush-size-val').value = o.size;
    $('#pixel-canvas').style.cursor = o.tool === 'pan' ? 'grab' : o.tool === 'move' ? 'move' : 'crosshair';
  });
  PF.Input.setTool('pencil');

  /* ---- Color & palette ---- */
  const colorInput = $('#color-input'), hexInput = $('#color-hex');
  colorInput.addEventListener('input', () => S.setColor(colorInput.value));
  hexInput.addEventListener('change', () => { const v = hexInput.value.trim(); if (/^#?[0-9a-f]{6}$/i.test(v)) S.setColor(v[0] === '#' ? v : '#' + v); else hexInput.value = S.get().color; });
  $('#btn-add-color').addEventListener('click', () => S.addPaletteColor(S.get().color));
  function renderPalette() {
    const d = S.get(), el = $('#palette'); el.innerHTML = '';
    d.palette.forEach((c, i) => { const b = document.createElement('button'); b.style.background = c; b.title = c; b.setAttribute('aria-label', `Color ${c}`); b.dataset.agentId = `palette-${i}`; b.className = c === d.color ? 'is-on' : ''; b.addEventListener('click', () => S.setColor(c));
      b.addEventListener('contextmenu', e => { e.preventDefault(); S.transact(dd => { dd.palette.splice(i, 1); }); }); el.appendChild(b); });
  }
  function syncColor() {
    const c = S.get().color; colorInput.value = c.slice(0, 7); hexInput.value = c; $('#swatch').style.background = c; $('#color-dot').style.background = c;
    $$('#palette button').forEach(b => b.classList.toggle('is-on', b.title === c));
  }
  S.on('color', syncColor); S.on('doc', () => { renderPalette(); syncColor(); }); renderPalette(); syncColor();
  $('#color-dot').addEventListener('click', () => PF.UI.setView('tools'));

  /* ---- Mobile navigation & FABs ---- */
  $$('.studio__nav button').forEach(b => b.addEventListener('click', () => { if (b.dataset.view === 'export') $('#dlg-export').showModal(); else PF.UI.setView(b.dataset.view); }));
  PF.UI.setView('canvas');
  $('#fab-undo').addEventListener('click', () => S.undo());
  $('#fab-play').addEventListener('click', () => PF.Anim.toggle());
  S.on('play', p => { $$('.js-play-icon').forEach(i => { i.textContent = p ? 'pause' : 'play_arrow'; }); });

  /* ---- Keyboard shortcuts ---- */
  const KEYS = { b: 'pencil', e: 'eraser', g: 'fill', l: 'line', r: 'rect', o: 'ellipse', i: 'picker', m: 'move', h: 'pan', u: 'shade' };
  window.addEventListener('keydown', e => {
    if (/INPUT|TEXTAREA|SELECT/.test(e.target.tagName) || e.target.isContentEditable) return;
    const k = e.key.toLowerCase(), mod = e.ctrlKey || e.metaKey;
    if (mod && k === 'z') { e.preventDefault(); e.shiftKey ? S.redo() : S.undo(); return; }
    if (mod && k === 'y') { e.preventDefault(); S.redo(); return; }
    if (mod && k === 's') { e.preventDefault(); PF.IO.exportProject(); PF.UI.toast('Project saved'); return; }
    if (mod && k === 'e') { e.preventDefault(); $('#dlg-export').showModal(); return; }
    if (mod) return;
    if (KEYS[k]) PF.Input.setTool(KEYS[k]);
    else if (k === '[') PF.Input.setSize(PF.Input.get().size - 1); else if (k === ']') PF.Input.setSize(PF.Input.get().size + 1);
    else if (k === 'x') PF.Input.setOption('mirrorX', !PF.Input.get().mirrorX);
    else if (k === 'f') PF.Input.setOption('shapeFill', !PF.Input.get().shapeFill);
    else if (k === '+' || k === '=') PF.Renderer.zoomBy(1); else if (k === '-') PF.Renderer.zoomBy(-1);
    else if (k === '0') PF.Renderer.fit();
    else if (k === 'p') PF.Anim.toggle();
    else if (k === ',' || k === '.') { const d = S.get(), n = S.state().frames.length; S.setActive({ frame: (d.activeFrame + (k === '.' ? 1 : n - 1)) % n }); }
    else if (k === 'n' && e.shiftKey) S.addFrame({ duplicate: true });
    else if (k === '`') PF.Renderer.setOption('grid', !PF.Renderer.getView().grid);
    else if (k === 'escape' && document.fullscreenElement) document.exitFullscreen();
    else return;
    e.preventDefault();
  });

  /* ---- Panels, agent & MCP ---- */
  PF.Panels.init();
  PF.Agent.init({ log: $('#agent-log'), input: $('#agent-input'), send: $('#agent-send'), chips: $('#agent-chips') });
  PF.MCP.mount({ manifestEl: $('#mcp-manifest'), configEl: $('#mcp-config'), bridgeEl: $('#mcp-bridge'), status: $('#mcp-status'), urlInput: $('#mcp-url'), connectBtn: $('#mcp-connect'), disconnectBtn: $('#mcp-disconnect'), countEl: $('#mcp-count') });
  $$('[data-copy]').forEach(b => b.addEventListener('click', () => PF.MCP.copy($(b.dataset.copy).textContent)));
  const mini = $('#agent-tools-mini'); PF.Tools.list().forEach(t => { const b = document.createElement('button'); b.textContent = t.name; b.title = t.description; b.dataset.agentId = `tool-chip-${t.name}`; b.addEventListener('click', () => { $('#agent-input').value = `/${t.name} `; $('#agent-input').focus(); }); mini.appendChild(b); });
  $('#btn-agent-tools').addEventListener('click', () => mini.classList.toggle('hidden'));

  /* Persist project in localStorage (debounced) */
  let saveT; S.on('change', () => { clearTimeout(saveT); saveT = setTimeout(() => { try { localStorage.setItem('pf-autosave', S.serialize()); } catch {} }, 800); });
  const saved = localStorage.getItem('pf-autosave');
  if (saved && location.hash !== '#fresh') { try { S.load(saved); PF.UI.toast('Restored your last session'); } catch {} }
  S.emit('view', PF.Renderer.getView()); S.emit('tool', PF.Input.get());
})();
