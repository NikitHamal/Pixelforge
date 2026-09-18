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

  /* ---------- Forge: style engine, factory briefs, atlas + engine export ---------- */
  R('list_styles', 'List every built-in style the engine can retarget assets onto (Game Boy, NES, C64, PICO-8, 1-bit, sepia, neon, biomes, thermal, ...) with their palettes.',
    obj({}),
    () => PF.Style.list(), ['forge']);

  R('restyle_document', 'Retarget the open document onto a style palette in place (deterministic ordered dithering). Undoable. Use list_styles for ids.',
    obj({ style: str('Style id from list_styles'), dither: bool('Override the style default') }, ['style']),
    a => {
      if (!PF.Style.get(a.style)) throw new Error(`Unknown style "${a.style}". Call list_styles first.`);
      const d = PF.Store.get();
      PF.Store.transact(dd => {
        dd.states.forEach(s => s.frames.forEach(f => Object.keys(f.pixels).forEach(id => PF.Style.apply(f.pixels[id], dd.width, dd.height, a.style, { dither: a.dither }))));
      });
      return { style: a.style, ...PF.Store.summary() };
    }, ['forge']);

  R('open_styled_variant', 'Open any template as a new project retargeted onto a style palette — one library, every hardware era.',
    obj({ id: str('Template id'), style: str('Style id from list_styles'), name: str('Project name') }, ['id', 'style']),
    a => {
      const t = PF.Library.get(a.id);
      if (!t) throw new Error(`Unknown template "${a.id}"`);
      const styled = PF.Style.docOf(t.build(), a.style);
      const pid = PF.Projects.instantiateDocData(styled, a.name || `${t.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${a.style}`);
      PF.Projects.setOpenId(pid);
      try { if (PF.App && PF.App.onNewProject) PF.App.onNewProject(pid); } catch {}
      return { project: pid, template: a.id, style: a.style, ...PF.Store.summary() };
    }, ['forge']);

  R('factory_brief', 'Turn a one-line brief ("cozy farming game, pastel, 32px") into a curated starter pack: player, enemies, tiles, props, items, FX and UI, already styled. Returns ids you can open with load_template / open_styled_variant.',
    obj({ brief: str('Free-text brief'), genre: str('Explicit genre (see factory_help)'), style: str('Explicit style id'), size: num('Preferred canvas size, e.g. 32'), roles: { type: 'array', items: { type: 'string' }, description: 'Role ids to include' } }),
    a => {
      const r = PF.Factory.recipe({ brief: a.brief, genre: a.genre, style: a.style, size: a.size, roles: a.roles });
      return { brief: r.brief, genre: r.genre, genreName: r.genreName, style: r.style, count: r.count,
        items: r.items.map(i => ({ role: i.role, template: i.source, name: i.name, styled: i.id, size: `${i.w}x${i.h}`, category: i.category })),
        note: r.note };
    }, ['forge']);

  R('factory_help', 'List the genres, roles, starter packs and styles the factory understands — call this before writing a brief.',
    obj({}),
    () => PF.Factory.help(), ['forge']);

  R('export_engine', 'Export the open document straight into an engine format: a packed atlas with Phaser/TexturePacker/Godot/Unity/Sparrow/LibGDX metadata, a Tiled tileset, an RLE C header, animated SVG, nine-slice JSON or a BMFont font. See list_export_formats.',
    obj({ format: str('Format id from list_export_formats'), preset: str('Atlas preset override'), scale: num('Upscale 1-16'), padding: num('Atlas padding px'), maxSize: num('Atlas max size px'), font: str('Font id for bmfont: 5x7 | 3x5') }, ['format']),
    a => {
      const o = { scale: a.scale, padding: a.padding, maxSize: a.maxSize, preset: a.preset, font: a.font };
      if (a.format.startsWith('atlas-')) return PF.IO.exportAtlas(o);
      if (a.format === 'bmfont') return PF.IO.exportFont(o);
      return PF.IO.exportVia(a.format, o);
    }, ['forge']);

  R('list_export_formats', 'List every export format the studio can write (images, atlases, engine metadata, code and fonts).',
    obj({}),
    () => PF.IO.FORMATS.map(f => ({ id: f.id, name: f.name, desc: f.desc })), ['forge']);

  R('autotile_info', 'Explain the autotile bit layout and list the generated autotile templates. Call it before wiring terrain in a game.',
    obj({}),
    () => ({
      bitOrder: { N: 1, E: 2, S: 4, W: 8, NE: 16, SE: 32, SW: 64, NW: 128 },
      note: 'A set bit means the neighbour on that side is the same material, so no rim is drawn there. Blob sets additionally use the four corner bits.',
      templates: PF.Library.list().filter(t => t.id.startsWith('pf_autotile') || t.tags.includes('autotile')).map(t => ({ id: t.id, name: t.name, ...PF.Library.docStats(t.id) })),
      helper: 'PF.AutoTile.build(x0, y0, w, h, (x,y) => bool, { blob }) -> tile index grid'
    }), ['forge']);

  return {};
})();
