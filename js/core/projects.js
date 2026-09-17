/* PixelForge Studio — Project store: named projects in localStorage with thumbnails.
   Each project = { id, name, width, height, updatedAt, createdAt, thumbnail, data (project JSON string) }.
   The open project autosaves (debounced). Templates instantiate into new projects. */
window.PF = window.PF || {};
PF.Projects = (() => {
  const KEY = 'pf-projects-v1';
  const OPEN_KEY = 'pf-open-project-v1';
  const LEGACY_KEY = 'pf-autosave';
  const uid = () => 'p_' + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);

  function readAll() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) { const arr = JSON.parse(raw); if (Array.isArray(arr)) return arr; }
    } catch {}
    // Migrate legacy single autosave ONCE — the legacy key is consumed
    // (deleted) so it can never resurrect a deleted project on refresh.
    try {
      const legacy = localStorage.getItem(LEGACY_KEY);
      if (legacy) {
        const d = JSON.parse(legacy);
        const item = { id: uid(), name: d.name || 'my-sprite', width: d.width, height: d.height,
          createdAt: Date.now(), updatedAt: Date.now(), thumbnail: '', data: legacy };
        localStorage.setItem(KEY, JSON.stringify([item]));
        localStorage.setItem(OPEN_KEY, item.id);
        try { localStorage.removeItem(LEGACY_KEY); } catch {}
        return [item];
      }
    } catch {}
    return [];
  }
  function writeAll(arr) {
    try { localStorage.setItem(KEY, JSON.stringify(arr)); } catch (e) {
      // Quota: drop thumbnails and retry once
      try { localStorage.setItem(KEY, JSON.stringify(arr.map(({ thumbnail, ...r }) => ({ ...r, thumbnail: '' })))); }
      catch { PF.UI?.toast('Storage full — export your work!'); }
    }
    PF.Store.emit('projects', list());
  }
  function thumbnailDataURL(maxSize = 96) {
    try {
      const d = PF.Store.get(), frame = PF.Store.frame();
      const scale = Math.max(1, Math.min(8, Math.floor(maxSize / Math.max(d.width, d.height))));
      return PF.Renderer.frameToCanvas(frame, scale).toDataURL('image/png');
    } catch { return ''; }
  }

  function list() {
    return readAll()
      .map(p => ({ id: p.id, name: p.name, width: p.width, height: p.height,
        updatedAt: p.updatedAt, createdAt: p.createdAt, thumbnail: p.thumbnail,
        states: countStates(p), frames: countFrames(p) }))
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }
  function countStates(p) { try { return JSON.parse(p.data).states.length; } catch { return 0; } }
  function countFrames(p) { try { return JSON.parse(p.data).states.reduce((n, s) => n + s.frames.length, 0); } catch { return 0; } }

  function get(id) { return readAll().find(p => p.id === id) || null; }
  function openId() { try { return localStorage.getItem(OPEN_KEY) || null; } catch { return null; } }
  function setOpenId(id) { try { id ? localStorage.setItem(OPEN_KEY, id) : localStorage.removeItem(OPEN_KEY); } catch {} }

  function adoptCurrent() {
    // Save the CURRENT Store document as a new project entry (no newDoc wipe)
    const d = PF.Store.get();
    const item = { id: uid(), name: d.name, width: d.width, height: d.height,
      createdAt: Date.now(), updatedAt: Date.now(), thumbnail: thumbnailDataURL(), data: PF.Store.serialize() };
    const all = readAll(); all.push(item); writeAll(all); setOpenId(item.id);
    return item.id;
  }
  function create({ name = 'untitled', width = 32, height = 32 } = {}) {
    PF.Store.newDoc({ width, height, name });
    const item = { id: uid(), name: PF.Store.get().name, width: PF.Store.get().width, height: PF.Store.get().height,
      createdAt: Date.now(), updatedAt: Date.now(), thumbnail: thumbnailDataURL(), data: PF.Store.serialize() };
    const all = readAll(); all.push(item); writeAll(all); setOpenId(item.id);
    return item.id;
  }
  function persist(id, { thumbnail = true } = {}) {
    const all = readAll(), i = all.findIndex(p => p.id === (id || openId()));
    if (i < 0) return null;
    const d = PF.Store.get();
    all[i] = { ...all[i], name: d.name, width: d.width, height: d.height,
      updatedAt: Date.now(), data: PF.Store.serialize(),
      thumbnail: thumbnail ? thumbnailDataURL() : all[i].thumbnail };
    writeAll(all); return all[i].id;
  }
  function open(id) {
    const p = get(id); if (!p) throw new Error('Project not found');
    PF.Store.load(p.data); setOpenId(id);
    PF.Store.emit('projects', list());
    return PF.Store.summary();
  }
  function remove(id) {
    clearTimeout(saveT);
    const kept = readAll().filter(p => p.id !== id);
    if (openId() === id) setOpenId(null);
    try { localStorage.removeItem(LEGACY_KEY); } catch {}
    writeAll(kept);
    // Verify the delete persisted (throws on some file:// / private-mode storage);
    // retry thumbnail-less so a quota error can never resurrect the entry.
    try {
      if (readAll().some(p => p.id === id)) {
        localStorage.setItem(KEY, JSON.stringify(kept.map(({ thumbnail, ...r }) => ({ ...r, thumbnail: '' }))));
        if (readAll().some(p => p.id === id)) PF.UI?.toast('Delete failed — storage unavailable');
      }
    } catch { PF.UI?.toast('Delete failed — storage unavailable'); }
  }
  function duplicate(id) {
    const all = readAll(), src = all.find(p => p.id === id); if (!src) throw new Error('Project not found');
    const copy = { ...src, id: uid(), name: src.name + ' copy', createdAt: Date.now(), updatedAt: Date.now() };
    all.push(copy); writeAll(all); return copy.id;
  }
  function rename(id, name) {
    const all = readAll(), p = all.find(x => x.id === id); if (!p) return;
    p.name = (name || 'untitled').slice(0, 60); p.updatedAt = Date.now(); writeAll(all);
    if (id === openId()) PF.Store.rename(p.name);
  }
  function replaceThumbnail(id) {
    const all = readAll(), p = all.find(x => x.id === id); if (!p) return;
    p.thumbnail = thumbnailDataURL(); p.updatedAt = p.updatedAt; writeAll(all);
  }
  function exportFile(id) {
    const p = get(id); if (!p) throw new Error('Project not found');
    const blob = new Blob([p.data], { type: 'application/json' });
    const url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = p.name.replace(/[^a-z0-9_-]+/gi, '-').toLowerCase() + '.pixelforge.json';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }
  async function importFile(file) {
    const text = await file.text();
    const d = JSON.parse(text);
    if (d.format !== 'pixelforge') throw new Error('Not a PixelForge project');
    const item = { id: uid(), name: d.name || file.name.replace(/\.[^.]+$/, ''), width: d.width, height: d.height,
      createdAt: Date.now(), updatedAt: Date.now(), thumbnail: '', data: text };
    const all = readAll(); all.push(item); writeAll(all);
    open(item.id); replaceThumbnail(item.id);
    return item.id;
  }
  function instantiateDocData(docData, name) {
    const W = docData.width, H = docData.height;
    PF.Store.newDoc({ width: W, height: H, name: name || docData.name || 'sprite' });
    PF.Store.transact(d => {
      d.layers = docData.layers.map((l, i) => ({ id: 'l' + i + '_' + Math.random().toString(36).slice(2, 7), name: l.name || ('Layer ' + (i + 1)), visible: true, opacity: 1, locked: false }));
      d.states = docData.states.map(s => ({
        id: 's' + Math.random().toString(36).slice(2, 9), name: s.name, fps: s.fps || 8, loop: s.loop !== false,
        frames: s.frames.map(f => {
          const pixels = {};
          d.layers.forEach((l, li) => {
            const buf = new Uint32Array(W * H);
            const painter = f.layers ? f.layers[li] : f.paint;
            if (typeof painter === 'function') painter(buf, W, H);
            else if (ArrayBuffer.isView(painter)) buf.set(painter);
            pixels[l.id] = buf;
          });
          return { id: 'f' + Math.random().toString(36).slice(2, 9), duration: f.duration || Math.round(1000 / (s.fps || 8)), pixels };
        })
      }));
      d.activeState = 0; d.activeFrame = 0; d.activeLayer = 0;
      if (docData.palette) d.palette = [...docData.palette];
    });
    const item = { id: uid(), name: PF.Store.get().name, width: W, height: H,
      createdAt: Date.now(), updatedAt: Date.now(), thumbnail: thumbnailDataURL(), data: PF.Store.serialize() };
    const all = readAll(); all.push(item); writeAll(all); setOpenId(item.id);
    return item.id;
  }

  /* Autosave the open project on editor canvas changes (debounced 900ms).
     Only saves if a project is legitimately open. Never phantom-creates. */
  let saveT = null;
  function trackOpen() {
    PF.Store.on('change', () => {
      clearTimeout(saveT);
      saveT = setTimeout(() => {
        try {
          const id = openId();
          if (!id || !get(id)) return;
          persist(id);
        } catch {}
      }, 900);
    });
  }

  const timeAgo = ts => {
    const s = Math.floor((Date.now() - ts) / 1000);
    if (s < 60) return 'just now';
    if (s < 3600) return Math.floor(s / 60) + 'm ago';
    if (s < 86400) return Math.floor(s / 3600) + 'h ago';
    return Math.floor(s / 86400) + 'd ago';
  };

  return { list, get, openId, setOpenId, create, adoptCurrent, persist, open, remove, duplicate, rename,
    replaceThumbnail, exportFile, importFile, instantiateDocData, trackOpen, timeAgo };
})();
