/* PixelForge Studio — Panels: layers, animation states, frame strip, playback, new/export dialogs, import */
window.PF = window.PF || {};
PF.Panels = (() => {
  const q = (s, r = document) => r.querySelector(s), qa = (s, r = document) => [...r.querySelectorAll(s)];
  const S = () => PF.Store;
  const ib = (icon, label, id, cls = 'icon-btn icon-btn--sm') => { const b = document.createElement('button'); b.className = cls; b.innerHTML = `<span class="ms ms--sm">${icon}</span>`; b.setAttribute('aria-label', label); b.title = label; if (id) b.dataset.agentId = id; return b; };
  let thumbRaf = 0;

  function init() {
    S().on('doc', renderAll); S().on('active', syncActive); S().on('change', scheduleThumbs);
    /* Layers */
    q('#btn-add-layer').addEventListener('click', () => S().addLayer());
    /* States */
    q('#btn-add-state').addEventListener('click', () => { const name = q('#state-preset').value; PF.Anim.createFromPreset(name, { copyCurrent: true }); PF.UI.toast(`Added "${name}" state`); });
    const sel = q('#state-preset'); PF.Anim.PRESETS.forEach(([n, f, fps]) => { const o = document.createElement('option'); o.value = n; o.textContent = `${n} · ${f}f @ ${fps}fps`; sel.appendChild(o); });
    /* Frames & playback */
    q('#btn-add-frame').addEventListener('click', () => S().addFrame({ duplicate: false }));
    q('#btn-dup-frame').addEventListener('click', () => S().addFrame({ duplicate: true }));
    q('#btn-del-frame').addEventListener('click', () => S().removeFrame(S().get().activeFrame));
    q('#btn-frame-left').addEventListener('click', () => S().moveFrame(S().get().activeFrame, -1));
    q('#btn-frame-right').addEventListener('click', () => S().moveFrame(S().get().activeFrame, 1));
    q('#btn-play').addEventListener('click', () => PF.Anim.toggle());
    q('#fps-input').addEventListener('change', e => S().updateState(S().get().activeState, { fps: Math.max(1, Math.min(60, +e.target.value || 8)) }));
    q('#frame-duration').addEventListener('change', e => S().setFrameDuration(S().get().activeFrame, +e.target.value || 125));
    q('#tgl-loop').addEventListener('click', () => S().updateState(S().get().activeState, { loop: !S().state().loop }));
    /* Dialogs */
    initNewDialog(); initExportDialog();
    renderAll();
  }

  /* ---------- Layers ---------- */
  function renderLayers() {
    const d = S().get(), el = q('#layers-list'); el.innerHTML = '';
    [...d.layers].reverse().forEach(l => {
      const i = d.layers.indexOf(l), row = document.createElement('div');
      row.className = 'list-item' + (i === d.activeLayer ? ' is-on' : ''); row.dataset.agentId = `layer-${i}`; row.setAttribute('role', 'button'); row.setAttribute('aria-label', `Layer ${l.name}`);
      row.addEventListener('click', () => S().setActive({ layer: i }));
      const vis = ib(l.visible ? 'visibility' : 'visibility_off', 'Toggle visibility', `layer-${i}-visible`); vis.addEventListener('click', e => { e.stopPropagation(); S().updateLayer(i, { visible: !l.visible }); });
      const lock = ib(l.locked ? 'lock' : 'lock_open', 'Toggle lock', `layer-${i}-lock`); lock.addEventListener('click', e => { e.stopPropagation(); S().updateLayer(i, { locked: !l.locked }); });
      const name = document.createElement('span'); name.className = 'grow'; name.textContent = l.name; name.title = 'Double-click to rename';
      name.addEventListener('dblclick', () => { const n = prompt('Layer name', l.name); if (n) S().updateLayer(i, { name: n }); });
      const op = document.createElement('input'); op.type = 'range'; op.min = 0; op.max = 100; op.value = Math.round(l.opacity * 100); op.title = 'Opacity'; op.setAttribute('aria-label', 'Layer opacity'); op.dataset.agentId = `layer-${i}-opacity`;
      op.addEventListener('click', e => e.stopPropagation()); op.addEventListener('change', () => S().updateLayer(i, { opacity: +op.value / 100 }));
      const more = ib('more_vert', 'Layer actions', `layer-${i}-menu`); more.addEventListener('click', e => { e.stopPropagation(); layerMenu(i); });
      row.append(vis, name, op, lock, more); el.appendChild(row);
    });
  }
  function layerMenu(i) {
    const d = S().get(), a = prompt(`Layer "${d.layers[i].name}": type up, down, merge, duplicate or delete`, 'up'); if (!a) return;
    if (a === 'up') S().moveLayer(i, 1); else if (a === 'down') S().moveLayer(i, -1); else if (a === 'merge') S().mergeDown(i);
    else if (a === 'delete') { if (!S().removeLayer(i)) PF.UI.toast('Cannot delete the last layer'); }
    else if (a === 'duplicate') { S().setActive({ layer: i }); const src = d.layers[i].id, id = S().addLayer(d.layers[i].name + ' copy'); S().transact(dd => dd.states.forEach(s => s.frames.forEach(f => f.pixels[id].set(f.pixels[src])))); }
  }

  /* ---------- States ---------- */
  function renderStates() {
    const d = S().get(), el = q('#states-list'); el.innerHTML = '';
    d.states.forEach((s, i) => {
      const row = document.createElement('div'); row.className = 'list-item' + (i === d.activeState ? ' is-on' : ''); row.dataset.agentId = `state-${i}`; row.setAttribute('role', 'button'); row.setAttribute('aria-label', `State ${s.name}`);
      row.addEventListener('click', () => { S().setActive({ state: i }); PF.Anim.preview.setState(i); });
      const ic = document.createElement('span'); ic.className = 'ms ms--sm'; ic.textContent = 'animation';
      const name = document.createElement('span'); name.className = 'grow'; name.innerHTML = `${s.name} <small>${s.frames.length}f · ${s.fps}fps</small>`; name.title = 'Double-click to rename';
      name.addEventListener('dblclick', () => { const n = prompt('State name', s.name); if (n) S().updateState(i, { name: n }); });
      const dup = ib('content_copy', 'Duplicate state', `state-${i}-duplicate`); dup.addEventListener('click', e => { e.stopPropagation(); S().addState({ name: PF.Anim.uniqueName(s.name), fps: s.fps, copyFrom: i }); });
      const del = ib('delete', 'Delete state', `state-${i}-delete`); del.addEventListener('click', e => { e.stopPropagation(); if (!S().removeState(i)) PF.UI.toast('Cannot delete the last state'); });
      row.append(ic, name, dup, del); el.appendChild(row);
    });
  }

  /* ---------- Frames ---------- */
  function renderFrames() {
    const d = S().get(), st = S().state(), el = q('#frames-strip'); el.innerHTML = '';
    st.frames.forEach((f, i) => {
      const t = document.createElement('button'); t.className = 'frame-thumb' + (i === d.activeFrame ? ' is-on' : ''); t.dataset.agentId = `frame-${i}`; t.setAttribute('aria-label', `Frame ${i + 1}`);
      const cv = document.createElement('canvas'); PF.Renderer.frameToCanvas(f, 1, cv); cv.style.width = cv.style.height = '';
      const lb = document.createElement('span'); lb.textContent = `${i + 1} · ${f.duration}ms`;
      t.append(cv, lb); t.addEventListener('click', () => S().setActive({ frame: i })); el.appendChild(t);
    });
    q('#fps-input').value = st.fps; q('#tgl-loop').classList.toggle('is-on', st.loop); q('#frame-duration').value = st.frames[d.activeFrame].duration;
    q('#frames-count').textContent = `${st.frames.length} frame${st.frames.length > 1 ? 's' : ''}`;
  }
  function scheduleThumbs() { cancelAnimationFrame(thumbRaf); thumbRaf = requestAnimationFrame(() => { const d = S().get(), t = qa('#frames-strip .frame-thumb')[d.activeFrame]; const f = S().frame(); if (t && f) PF.Renderer.frameToCanvas(f, 1, t.querySelector('canvas')); }); }
  function syncActive() {
    const d = S().get(), thumbs = qa('#frames-strip .frame-thumb');
    if (thumbs.length !== S().state().frames.length) return renderFrames();
    thumbs.forEach((t, i) => t.classList.toggle('is-on', i === d.activeFrame));
    const strip = q('#frames-strip'), at = thumbs[d.activeFrame]; // scroll strip only (never the page)
    if (at && (at.offsetLeft < strip.scrollLeft || at.offsetLeft + at.offsetWidth > strip.scrollLeft + strip.clientWidth)) strip.scrollLeft = at.offsetLeft - 8;
    qa('#states-list .list-item').forEach((r, i) => r.classList.toggle('is-on', i === d.activeState));
    qa('#layers-list .list-item').forEach(r => r.classList.toggle('is-on', r.dataset.agentId === `layer-${d.activeLayer}`));
    q('#frame-duration').value = S().frame().duration;
  }
  function renderAll() { renderLayers(); renderStates(); renderFrames(); }

  /* ---------- New document dialog ---------- */
  function initNewDialog() {
    const dlg = q('#dlg-new'); q('#btn-new').addEventListener('click', () => dlg.showModal());
    qa('#dlg-new .size-chips .chip').forEach(c => c.addEventListener('click', () => { q('#new-w').value = c.dataset.w; q('#new-h').value = c.dataset.h; qa('#dlg-new .size-chips .chip').forEach(x => x.classList.toggle('is-on', x === c)); }));
    q('#new-create').addEventListener('click', () => { S().newDoc({ width: +q('#new-w').value, height: +q('#new-h').value, name: q('#new-name').value.trim() || 'sprite' }); dlg.close(); PF.UI.setView('canvas'); });
    q('#new-resize').addEventListener('click', () => { S().resize(+q('#new-w').value, +q('#new-h').value, 'center'); dlg.close(); });
    qa('dialog [data-close]').forEach(b => b.addEventListener('click', () => b.closest('dialog').close()));
    qa('dialog').forEach(d => d.addEventListener('click', e => { if (e.target === d) d.close(); }));
  }

  /* ---------- Export dialog & import ---------- */
  function initExportDialog() {
    const dlg = q('#dlg-export'), grid = q('#export-formats');
    q('#btn-export').addEventListener('click', () => dlg.showModal());
    PF.IO.FORMATS.forEach(f => {
      const b = document.createElement('button'); b.className = 'option'; b.dataset.agentId = `export-${f.id}`; b.setAttribute('aria-label', `Export ${f.name}`);
      b.innerHTML = `<span class="ms">${f.icon}</span><b>${f.name}</b><span>${f.desc}</span>`;
      b.addEventListener('click', async () => { try { const r = await PF.IO.run(f.id, { scale: +q('#export-scale').value, layout: q('#export-layout').value, padding: +q('#export-padding').value }); PF.UI.toast(`Exported ${f.name}`); PF.Store.emit('tool:result', { ok: true, tool: 'export', args: { format: f.id }, result: r }); } catch (e) { PF.UI.toast(e.message); } });
      grid.appendChild(b);
    });
    q('#import-project').addEventListener('change', async e => { const f = e.target.files[0]; if (!f) return; try { await PF.IO.importProject(f); PF.UI.toast('Project loaded'); dlg.close(); } catch (err) { PF.UI.toast(err.message); } e.target.value = ''; });
    q('#import-png').addEventListener('change', async e => { const f = e.target.files[0]; if (!f) return;
      try { const r = await PF.IO.importPNG(f, { frameWidth: +q('#import-fw').value || undefined, frameHeight: +q('#import-fh').value || undefined, asState: q('#import-as-state').checked }); PF.UI.toast(`Imported ${r.imported} frame(s)`); dlg.close(); } catch (err) { PF.UI.toast('Import failed: ' + err.message); } e.target.value = ''; });
    /* Drag & drop anywhere on the studio */
    const studio = q('#studio');
    studio.addEventListener('dragover', e => { e.preventDefault(); studio.classList.add('is-drop'); });
    studio.addEventListener('dragleave', () => studio.classList.remove('is-drop'));
    studio.addEventListener('drop', async e => { e.preventDefault(); studio.classList.remove('is-drop'); const f = e.dataTransfer.files[0]; if (!f) return;
      try { if (/json$/i.test(f.name)) await PF.IO.importProject(f); else await PF.IO.importPNG(f, { frameWidth: +q('#import-fw').value || undefined, frameHeight: +q('#import-fh').value || undefined, asState: q('#import-as-state').checked }); PF.UI.toast('Imported ' + f.name); } catch (err) { PF.UI.toast(err.message); } });
  }
  return { init, renderAll };
})();
