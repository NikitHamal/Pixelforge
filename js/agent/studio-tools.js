/* PixelForge Studio — Hub tools: templates + projects as agent tools.
   Loaded after tools.js / library / projects. Automatically appears in
   Tools.list(), the console /tools, window.PixelForge and the MCP manifest. */
window.PF = window.PF || {};
PF.StudioTools = (() => {
  const obj = (properties, required = []) => ({ type: 'object', properties, required, additionalProperties: false });
  const num = (d, extra = {}) => ({ type: 'integer', description: d, ...extra });
  const str = (d, extra = {}) => ({ type: 'string', description: d, ...extra });
  const bool = d => ({ type: 'boolean', description: d });
  const R = PF.Tools.register;

  R('list_templates', 'List all built-in game asset templates (heroes, enemies, tiles, items, FX) with categories, descriptions and state/frame counts.',
    obj({ category: str('Filter: Heroes | Enemies | NPCs | Animals | World | Items | FX | UI'), search: str('Search names/descriptions/tags') }),
    a => PF.Library.list()
      .filter(t => !a.category || a.category.toLowerCase() === 'all' || t.category.toLowerCase() === a.category.toLowerCase() || (a.category.toLowerCase() === 'featured' && t.featured))
      .filter(t => !a.search || (t.name + ' ' + t.desc + ' ' + t.tags.join(' ')).toLowerCase().includes(a.search.toLowerCase()))
      .map(t => ({ id: t.id, name: t.name, category: t.category, desc: t.desc, ...PF.Library.docStats(t.id) })), ['hub']);

  R('load_template', 'Open a built-in template as a brand-new project (replaces the current document; autosaved as its own project). Returns the new project id and summary.',
    obj({ id: str('Template id from list_templates'), open_studio: bool('Navigate to /app (landing page only, default false)') }, ['id']),
    a => {
      const t = PF.Library.get(a.id);
      if (!t) throw new Error(`Unknown template "${a.id}". Call list_templates first.`);
      let onStudio = false;
      try { onStudio = /studio\.html/.test(location.pathname || ''); } catch {}
      if (typeof location !== 'undefined' && a.open_studio && !onStudio) {
        PF.Library.instantiate(a.id, { openStudio: true });
        return { opening: a.id };
      }
      const doc = t.build();
      const pid = PF.Projects.instantiateDocData(doc, t.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'));
      PF.Projects.setOpenId(pid);
      try { if (PF.App && PF.App.onNewProject) PF.App.onNewProject(pid); } catch {}
      return { project: pid, template: a.id, ...PF.Store.summary() };
    }, ['hub']);

  R('append_template_states', 'Append every state from a template into the current project (sizes must match; template art is composited into your active layer). Great for adding e.g. coin spin to a hero.',
    obj({ id: str('Template id from list_templates') }, ['id']),
    a => {
      const t = PF.Library.get(a.id);
      if (!t) throw new Error(`Unknown template "${a.id}"`);
      const doc = t.build(), cur = PF.Store.get();
      if (doc.width !== cur.width || doc.height !== cur.height)
        throw new Error(`Size mismatch: template is ${doc.width}×${doc.height}, canvas is ${cur.width}×${cur.height}. Resize first or open as a new project.`);
      let added = 0;
      PF.Store.transact(d => {
        const lid = d.layers[d.activeLayer].id;
        doc.states.forEach(s => {
          const frames = s.frames.map(f => {
            const tmp = new Uint32Array(d.width * d.height);
            const painter = f.layers ? f.layers[0] : f.paint;
            if (typeof painter === 'function') painter(tmp, d.width, d.height);
            else if (painter) tmp.set(painter);
            const pixels = {};
            d.layers.forEach(l => { pixels[l.id] = new Uint32Array(d.width * d.height); });
            pixels[lid].set(tmp);
            return { id: 'f' + Math.random().toString(36).slice(2, 9), duration: f.duration || 125, pixels };
          });
          let name = s.name, i = 2;
          while (d.states.some(x => x.name === name)) name = `${s.name}-${i++}`;
          d.states.push({ id: 's' + Math.random().toString(36).slice(2, 9), name, fps: s.fps || 8, loop: s.loop !== false, frames });
          added++;
        });
      });
      return { appended: added, states: PF.Store.summary().states.map(s => s.name) };
    }, ['hub']);

  R('list_projects', 'List saved projects (newest first) with ids, sizes, state counts and thumbnails omitted for brevity.',
    obj({}),
    () => PF.Projects.list().map(({ thumbnail, ...p }) => p), ['hub']);

  R('open_project', 'Open a saved project by id (from list_projects).',
    obj({ id: str('Project id') }, ['id']),
    a => { const r = PF.Projects.open(a.id); try { if (PF.App && PF.App.onNewProject) PF.App.onNewProject(a.id); } catch {} return r; }, ['hub']);

  R('new_project', 'Create a new blank project (saved to the project list). Optionally start from a template.',
    obj({ name: str('Project name'), width: num('Width 1-256'), height: num('Height 1-256'), template: str('Template id to start from') }),
    a => {
      if (a.template) {
        const t = PF.Library.get(a.template);
        if (!t) throw new Error(`Unknown template "${a.template}"`);
        const doc = t.build();
        if (a.width || a.height) { doc.width = a.width || doc.width; doc.height = a.height || doc.height; }
        if (a.name) doc.name = a.name;
        const pid = PF.Projects.instantiateDocData(doc, doc.name);
        PF.Projects.open(pid);
        if (a.name) PF.Store.rename(a.name);
        return { project: pid, ...PF.Store.summary() };
      }
      const pid = PF.Projects.create({ name: a.name || 'untitled', width: a.width || 32, height: a.height || 32 });
      return { project: pid, ...PF.Store.summary() };
    }, ['hub']);

  R('save_project', 'Save the current document into the open project (updates thumbnail + timestamp).',
    obj({ name: str('Rename while saving') }),
    a => {
      if (a.name) PF.Store.rename(a.name);
      let id = PF.Projects.openId();
      if (!id) id = PF.Projects.create({ name: PF.Store.get().name, width: PF.Store.get().width, height: PF.Store.get().height });
      else PF.Projects.persist(id);
      return { project: id, ...PF.Store.summary() };
    }, ['hub']);

  R('delete_project', 'Delete a saved project.',
    obj({ id: str('Project id') }, ['id']),
    a => { PF.Projects.remove(a.id); return { deleted: a.id }; }, ['hub']);

  R('duplicate_project', 'Duplicate a saved project.',
    obj({ id: str('Project id') }, ['id']),
    a => ({ project: PF.Projects.duplicate(a.id) }), ['hub']);

  return {};
})();
