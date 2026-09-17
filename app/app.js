/* PixelForge /app — sidebar shell: projects, templates, agent, docs, MCP.
   The canvas editor lives on studio.html; this shell manages projects,
   kits and agents (the Store stays live so tools work headlessly). */
window.PF = window.PF || {};
const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
const VIEWS = ['projects', 'templates', 'agent', 'docs', 'mcp'];

/* ---------- PF.UI (toast/theme/views/agent-addressable UI) ---------- */
PF.UI = (() => {
  let toastT;
  const toast = msg => { const el = $('#toast'); if (!el) return; el.textContent = msg; el.classList.add('is-on'); clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove('is-on'), 2200); };
  const setTheme = t => { document.documentElement.dataset.theme = t; try { localStorage.setItem('pf-theme', t); } catch {} const b = $('#themeBtn .ms'); if (b) b.textContent = t === 'dark' ? 'light_mode' : 'dark_mode'; };
  const setView = v => { if (VIEWS.includes(v)) PF.App.go(v); else if (v === 'studio') PF.App.openInStudio(); };
  const describe = filter => $$('[data-agent-id]').map(el => {
    let r; try { r = el.getBoundingClientRect(); } catch { r = { x: 0, y: 0, width: 0, height: 0 }; }
    const label = el.getAttribute('aria-label') || el.title || (el.textContent || '').trim().slice(0, 40);
    let visible = false;
    try { visible = r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden'; } catch {}
    const o = { id: el.dataset.agentId, label, role: el.getAttribute('role') || el.tagName.toLowerCase(), visible, rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) } };
    if (el.classList.contains('is-on') || el.classList.contains('active')) o.active = true;
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

(function bootApp() {
  const S = PF.Store;
  let currentView = '';

  /* ================= ROUTER ================= */
  function parseHash() {
    const h = location.hash || '#/projects';
    const m = h.match(/^#\/(\w+)(?:\?(.*))?$/);
    return { view: m ? m[1] : 'projects', params: new URLSearchParams(m && m[2] ? m[2] : '') };
  }
  const VIEW_TITLES = {
    projects: 'Projects',
    templates: 'Templates',
    agent: 'AI Agent Cockpit',
    docs: 'Agent Docs',
    mcp: 'MCP Setup'
  };
  function go(view) {
    if (view === 'studio') { openInStudio(); return; } // legacy deep links
    if (!VIEWS.includes(view)) view = 'projects';
    currentView = view;
    $$('.view').forEach(e => e.classList.toggle('active', e.id === 'view-' + view));
    $$('[data-view]').forEach(b => b.classList.toggle('active', b.dataset.view === view));
    $('#sidebar').classList.remove('open');
    const tt = $('#topbarTitle'); if (tt) tt.textContent = VIEW_TITLES[view] || 'Workspace';
    if (location.hash !== '#/' + view) {
      try { history.replaceState(null, '', '#/' + view); } catch { location.hash = '#/' + view; }
    }
    if (view === 'projects') renderProjects();
    if (view === 'templates') renderTemplates();
    if (view === 'docs') renderDocs();
    $('#main').scrollTop = 0; window.scrollTo(0, 0);
  }
  function openInStudio(id) {
    id = id || PF.Projects.openId();
    if (!id) { try { id = PF.Projects.create({ name: 'untitled', width: 32, height: 32 }); } catch (e) { PF.UI.toast(e.message); return; } }
    location.href = '../studio.html?project=' + id;
  }
  function openProject(id) {
    try { PF.Projects.open(id); }
    catch (e) { PF.UI.toast(e.message); return; }
    openInStudio(id);
  }
  PF.App = { go, openProject, openInStudio, onNewProject: id => openInStudio(id) };
  window.addEventListener('hashchange', () => {
    const { view } = parseHash();
    if (view === 'studio') { openInStudio(parseHash().params.get('project')); return; }
    if (VIEWS.includes(view) && view !== currentView) go(view);
  });
  $$('[data-view]').forEach(b => b.addEventListener('click', () => go(b.dataset.view)));
  $$('[data-view-go]').forEach(b => b.addEventListener('click', () => go(b.dataset.viewGo)));

  /* ================= CHROME ================= */
  PF.UI.setTheme(localStorage.getItem('pf-theme') || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));
  $('#themeBtn').addEventListener('click', () => PF.UI.setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'));
  $('#menuBtn').addEventListener('click', () => $('#sidebar').classList.toggle('open'));
  $('#helpBtn').addEventListener('click', () => $('#helpModal').showModal());
  $$('dialog').forEach(d => d.addEventListener('click', e => { if (e.target === d) d.close(); }));
  if (location.protocol === 'file:') {
    $('#fileHint').classList.remove('hidden');
    $('#fileHintClose').addEventListener('click', () => $('#fileHint').classList.add('hidden'));
  }
  $$('[data-count="tools"]').forEach(el => { el.textContent = PF.Tools.list().length; });
  $$('[data-copy]').forEach(b => b.addEventListener('click', async () => {
    const t = $(b.dataset.copy);
    try { await navigator.clipboard.writeText(t ? t.textContent : ''); PF.UI.toast('Copied to clipboard'); } catch { PF.UI.toast('Copy failed'); }
  }));

  /* ================= STORE (headless ok) ================= */
  try {
    const last = PF.Projects.openId();
    if (last && PF.Projects.get(last)) PF.Projects.open(last);
    else {
      try { localStorage.removeItem('pf-autosave'); } catch {}
      S.newDoc({ width: 32, height: 32, name: 'untitled' });
    }
  } catch (e) { try { S.newDoc({ width: 32, height: 32, name: 'untitled' }); } catch {} }
  PF.Store.on('projects', () => { if (currentView === 'projects') renderProjects(); });

  /* ================= PROJECTS ================= */
  $('#projectSearch').addEventListener('input', renderProjects);
  $('#newProjectBtn').addEventListener('click', openNewModal);
  $('#newProjectBtn2').addEventListener('click', openNewModal);
  function openNewModal() {
    const sel = $('#npKit');
    if (!sel.options.length) {
      sel.innerHTML = '<option value="">Empty canvas</option>' +
        PF.Library.list().map(t => `<option value="${t.id}">${t.name}</option>`).join('');
    }
    if (!$('#projectModal').open) $('#projectModal').showModal();
    setTimeout(() => $('#npName').focus(), 50);
  }
  $('#projectForm').addEventListener('submit', e => {
    e.preventDefault();
    const name = $('#npName').value.trim() || 'Untitled project';
    const kit = $('#npKit').value;
    $('#projectModal').close();
    let id;
    if (kit && PF.Library.get(kit)) {
      const doc = PF.Library.get(kit).build();
      doc.name = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      id = PF.Projects.instantiateDocData(doc, doc.name);
    } else {
      id = PF.Projects.create({ name, width: 32, height: 32 });
    }
    openInStudio(id);
  });
  function renderProjects() {
    const grid = $('#projectGrid'); if (!grid) return;
    const q = ($('#projectSearch').value || '').toLowerCase();
    const items = PF.Projects.list().filter(p => p.name.toLowerCase().includes(q));
    grid.innerHTML = '';
    $('#projectsEmpty').classList.toggle('hidden', items.length > 0);
    items.forEach(p => {
      const card = document.createElement('article');
      card.className = 'card project-card'; card.tabIndex = 0;
      card.setAttribute('aria-label', 'Open ' + p.name);
      card.innerHTML = `<div class="project-preview"><span class="badge ok">Ready</span>${p.thumbnail ? `<img src="${p.thumbnail}" alt="">` : '<span class="ms" style="font-size:40px;color:var(--outline-variant)">image</span>'}</div>
        <div class="project-info"><h3></h3><p class="proj-meta"></p>
          <div class="project-actions">
            <button class="btn tonal btn-sm" data-open style="flex:1">Open in Studio</button>
            <button class="icon" style="width:36px;height:36px" data-dup aria-label="Duplicate" title="Duplicate"><span class="ms ms--sm">content_copy</span></button>
            <button class="icon" style="width:36px;height:36px" data-exp aria-label="Export" title="Export JSON"><span class="ms ms--sm">ios_share</span></button>
            <button class="icon" style="width:36px;height:36px" data-del aria-label="Delete" title="Delete"><span class="ms ms--sm">delete</span></button>
          </div></div>`;
      card.querySelector('h3').textContent = p.name;
      const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
      card.querySelector('p').textContent =
        `${p.width}×${p.height} · ${plural(p.states, 'state')} · ${plural(p.frames, 'frame')} · ${PF.Projects.timeAgo(p.updatedAt)}`;
      card.querySelector('[data-open]').addEventListener('click', ev => { ev.stopPropagation(); openInStudio(p.id); });
      card.addEventListener('click', () => openInStudio(p.id));
      card.addEventListener('keydown', e => { if (e.key === 'Enter') openInStudio(p.id); });
      card.querySelector('[data-dup]').addEventListener('click', ev => { ev.stopPropagation(); PF.Projects.duplicate(p.id); });
      card.querySelector('[data-exp]').addEventListener('click', ev => { ev.stopPropagation(); PF.Projects.exportFile(p.id); });
      card.querySelector('[data-del]').addEventListener('click', ev => { ev.stopPropagation(); if (confirm(`Delete "${p.name}"?`)) PF.Projects.remove(p.id); });
      grid.appendChild(card);
    });
  }

  /* ================= TEMPLATES ================= */
  const tplDocs = new Map(), tplAnims = new Map();
  let tplRaf = false;
  function tplDoc(t) {
    if (!tplDocs.has(t.id)) { try { tplDocs.set(t.id, t.build()); } catch { return null; } }
    return tplDocs.get(t.id);
  }
  function paintDocFrame(doc, si, fi, canvas) {
    const st = doc.states[si % doc.states.length], fr = st.frames[fi % st.frames.length];
    const tmp = document.createElement('canvas'); tmp.width = doc.width; tmp.height = doc.height;
    const tctx = tmp.getContext('2d'), img = tctx.createImageData(doc.width, doc.height);
    const out = new Uint32Array(img.data.buffer); out.fill(0);
    const cell = new Uint32Array(doc.width * doc.height);
    doc.layers.forEach((l, li) => {
      cell.fill(0);
      const p = fr.layers ? fr.layers[li] : fr.paint;
      if (typeof p === 'function') p(cell, doc.width, doc.height); else if (p) cell.set(p);
      for (let i = 0; i < out.length; i++) if (cell[i]) out[i] = out[i] ? PF.Color.blend(out[i], cell[i]) : cell[i];
    });
    tctx.putImageData(img, 0, 0);
    const ctx = canvas.getContext('2d'); ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(tmp, 0, 0, canvas.width, canvas.height);
  }
  (function initTplCats() {
    const cats = $('#tplCats');
    PF.Library.categories().forEach((c, i) => {
      const b = document.createElement('button');
      b.className = 'chip' + (i === 0 ? ' is-on' : ''); b.textContent = c;
      b.dataset.agentId = 'tpl-cat-' + c.toLowerCase();
      b.addEventListener('click', () => { $$('#tplCats .chip').forEach(x => x.classList.toggle('is-on', x === b)); renderTemplates(); });
      cats.appendChild(b);
    });
  })();
  $('#templateSearch').addEventListener('input', renderTemplates);
  $('#importBtn').addEventListener('click', () => $('#fileInput').click());
  $('#fileInput').addEventListener('change', async e => {
    const f = e.target.files[0]; if (!f) return;
    try { const id = await PF.Projects.importFile(f); PF.UI.toast('Imported ' + f.name); openInStudio(id); }
    catch (err) { PF.UI.toast(err.message); }
    e.target.value = '';
  });
  function renderTemplates() {
    const grid = $('#templateGrid'); if (!grid) return;
    const cat = $('#tplCats .chip.is-on')?.textContent || 'All';
    const term = ($('#templateSearch').value || '').toLowerCase();
    grid.innerHTML = ''; tplAnims.clear();
    const list = PF.Library.list()
      .filter(t => cat === 'All' || (cat === 'Featured' ? t.featured : t.category === cat))
      .filter(t => !term || (t.name + ' ' + t.desc + ' ' + t.tags.join(' ')).toLowerCase().includes(term));
    $('#templateCount').textContent = list.length + ' kits';
    list.forEach(t => {
      const doc = tplDoc(t);
      const stats = doc ? PF.Library.docStats(t.id) : { states: 0, frames: 0 };
      const card = document.createElement('article');
      card.className = 'card template-card';
      card.innerHTML = `<div class="template-preview"><canvas width="72" height="72"></canvas></div>
        <div class="template-info"><div class="row"><h3></h3><span class="badge warm">${t.category}</span></div><p></p>
          <div class="template-tags">${t.tags.slice(0, 4).map(x => `<span class="tag">${x}</span>`).join('')}</div>
          <div class="row"><span class="muted-sm">${stats.states} states · ${stats.frames} frames</span><button class="btn tonal btn-sm" data-use>Use kit</button></div></div>`;
      card.querySelector('h3').textContent = t.name;
      card.querySelector('p').textContent = t.desc;
      const cv = card.querySelector('canvas');
      if (doc) { paintDocFrame(doc, 0, 0, cv); tplAnims.set(t.id, { doc, i: 0, el: cv }); }
      const use = ev => { ev.stopPropagation(); const pid = PF.Library.instantiate(t.id, { openStudio: false }); openInStudio(pid); };
      card.querySelector('[data-use]').addEventListener('click', use);
      card.addEventListener('click', use);
      grid.appendChild(card);
    });
    if (!tplRaf) { tplRaf = true; requestAnimationFrame(tplLoop); }
  }
  let tplLast = 0;
  function tplLoop(t) {
    if (t - tplLast > 200) {
      tplLast = t;
      tplAnims.forEach(a => {
        const r = a.el.getBoundingClientRect();
        if (r.bottom > 0 && r.top < innerHeight && currentView === 'templates') {
          a.i++; paintDocFrame(a.doc, 0, a.i % a.doc.states[0].frames.length, a.el);
        }
      });
    }
    requestAnimationFrame(tplLoop);
  }

  /* ================= DOCS ================= */
  let docsRendered = false;
  function renderDocs() {
    if (docsRendered) return; docsRendered = true;
    const tb = $('#tools-table tbody'); if (!tb) return;
    PF.Tools.list().forEach(t => {
      const tr = document.createElement('tr');
      const td1 = document.createElement('td'), c = document.createElement('code'); c.textContent = t.name; td1.appendChild(c);
      const td2 = document.createElement('td'); td2.textContent = t.description;
      const td3 = document.createElement('td'); td3.textContent = Object.keys(t.inputSchema.properties).join(', ') || '—'; td3.className = 'muted';
      tr.append(td1, td2, td3); tb.appendChild(tr);
    });
  }

  /* ================= AGENT ================= */
  PF.Agent.init({ log: $('#agent-log'), input: $('#agent-input'), send: $('#agent-send'), chips: $('#agent-chips') });
  $('#agentForm').addEventListener('submit', e => e.preventDefault());
  const mini = $('#agent-tools-mini');
  PF.Tools.list().forEach(t => {
    const b = document.createElement('button'); b.textContent = t.name; b.title = t.description;
    b.dataset.agentId = `tool-chip-${t.name}`;
    b.addEventListener('click', () => { $('#agent-input').value = `/${t.name} `; $('#agent-input').focus(); });
    mini.appendChild(b);
  });
  $('#btn-agent-tools').addEventListener('click', () => mini.classList.toggle('hidden'));
  PF.Store.on('tool:result', r => {
    const log = $('#agentLog'); if (!log) return;
    const li = document.createElement('li');
    li.textContent = `${r.tool} ${r.ok ? '✓' : '✗ ' + r.error}`;
    log.prepend(li);
    while (log.children.length > 12) log.lastChild.remove();
  });
  PF.MCP.mount({ manifestEl: $('#mcp-manifest'), configEl: $('#mcp-config'), bridgeEl: $('#mcp-bridge'), status: $('#mcp-status'),
    urlInput: $('#mcp-url'), connectBtn: $('#mcp-connect'), disconnectBtn: $('#mcp-disconnect'), countEl: $('#mcp-count') });

  /* ================= HERO + INIT ================= */
  try {
    const rows = ['..####..', '.#WWWW#.', '#WWEWWE#', '#WWWWWW#', '#WWWWWW#', '.#W##W#.', '..####..', '.#....#.'];
    const legend = { '#': '#1a0066', W: '#ffffff', E: '#5a38f0' };
    $$('.logo-canvas').forEach(cv => {
      const ctx = cv.getContext('2d'), img = ctx.createImageData(8, 8), buf = new Uint32Array(img.data.buffer);
      PF.Raster.paintRows(buf, 8, 8, rows, legend);
      ctx.putImageData(img, 0, 0);
    });
  } catch (e) {}
  try {
    const heroDoc = PF.Library.get('hero_male').build();
    paintDocFrame(heroDoc, 0, 1, $('#heroA'));
    paintDocFrame(heroDoc, 6, 2, $('#heroB'));
    paintDocFrame(PF.Monsters.slimeSuite(), 0, 1, $('#heroC'));
  } catch (e) {}
  const { view: startView, params } = parseHash();
  if (startView === 'studio') openInStudio(params.get('project'));
  else go(VIEWS.includes(startView) ? startView : 'projects');
  const dp = parseHash().params.get('prompt');
  if (dp) { go('agent'); setTimeout(() => { $('#agent-input').value = dp; $('#agent-send').click(); }, 600); }
})();
