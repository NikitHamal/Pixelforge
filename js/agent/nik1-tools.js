/* PixelForge Studio — Nik1 on-device model tools.
 *
 * Registers the three Nik1 specialists with the same tool registry the console,
 * window.PixelForge, postMessage and the MCP manifest already read, so an agent
 * running inside the studio can route a request, search the catalogue by meaning,
 * or ask which palette family a sprite belongs to — all locally, with no API key
 * and no network round trip.
 *
 * The models live in nik1/js/models/ and are loaded lazily on first use: a page
 * that never calls these tools never pays for them.
 */
window.PF = window.PF || {};
PF.Nik1Tools = (() => {
  const R = () => PF.Tools.register;
  const obj = (properties, required = []) => ({ type: 'object', properties, required, additionalProperties: false });
  const str = (d, extra = {}) => ({ type: 'string', description: d, ...extra });
  const num = (d, extra = {}) => ({ type: 'integer', description: d, ...extra });
  const bool = d => ({ type: 'boolean', description: d });

  const state = { models: null, loading: null, error: null, base: null };

  /* Works from the repo root, /app/ and /studio.html alike. */
  function basePath() {
    if (state.base) return state.base;
    let p = '';
    try { p = location.pathname || ''; } catch {}
    state.base = /\/app\//.test(p) ? '../nik1/js/models/' : 'nik1/js/models/';
    return state.base;
  }

  function ensureScripts() {
    if (window.Nik1 && window.Nik1Grammar) return Promise.resolve();
    const add = src => new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = src; s.onload = res; s.onerror = () => rej(new Error('failed to load ' + src));
      document.head.appendChild(s);
    });
    const b = basePath().replace('models/', '');
    return add(b + 'nik1.js').then(() => add(b + 'grammar.js'));
  }

  async function load() {
    if (state.models) return state.models;
    if (state.loading) return state.loading;
    state.loading = (async () => {
      await ensureScripts();
      const base = basePath();
      const tools = await (await fetch(base + 'tools.json')).json();
      const templates = await (await fetch(base + 'templates.json')).json();
      const [route, search, palette] = await Promise.all([
        Nik1.loadModel('nik1-route', { baseUrl: base }),
        Nik1.loadModel('nik1-search', { baseUrl: base, docTable: base + 'nik1-search.docs.f32' }),
        Nik1.loadModel('nik1-palette', { baseUrl: base })
      ]);
      const catalog = Nik1Grammar.loadCatalog(templates);
      route.setTools(tools, catalog);
      state.models = { route, search, palette, tools, templates, catalog, grammar: Nik1Grammar };
      return state.models;
    })();
    try { return await state.loading; }
    catch (e) { state.error = e.message; state.loading = null; throw e; }
  }

  /* ------------------------------- tools ------------------------------- */
  const registry = PF.Tools.register;
  const register = () => {
    registry('nik1_status', 'Report the Nik1 on-device models: which are loaded, their sizes, and a warm-latency probe. Local inference only — no API key, no network.',
      obj({}),
      async () => {
        const t0 = (window.performance || Date).now();
        const m = await load();
        const loadedMs = (window.performance || Date).now() - t0;
        const t1 = (window.performance || Date).now();
        m.palette.classifySprite(new Uint32Array(32 * 32));
        const probeMs = (window.performance || Date).now() - t1;
        return {
          base: basePath(),
          models: [
            { name: 'nik1-route', kind: 'lm', bytes: m.route.bytes, config: m.route.config.cfg },
            { name: 'nik1-search', kind: 'encoder', bytes: m.search.bytes, docs: m.search.docEmbeddings.count, config: m.search.config.cfg },
            { name: 'nik1-palette', kind: 'mlp', bytes: m.palette.bytes, labels: m.palette.labels.length, config: m.palette.config.cfg }
          ],
          totalKb: +((m.route.bytes + m.search.bytes + m.palette.bytes) / 1024).toFixed(1),
          loadMs: Math.round(loadedMs), paletteProbeMs: +probeMs.toFixed(3),
          note: 'Loaded lazily on first Nik1 tool call; nothing is uploaded.'
        };
      }, ['forge', 'nik1']);

    registry('nik1_route', 'Translate a plain-English request into one PixelForge tool call, on device. Returns the validated call, how it was produced (model / model+repair / fallback), and the raw generation. Set execute=true to run the call immediately.',
      obj({ text: str('What the user wants, e.g. "give me the knight"'), execute: bool('Run the validated call through the tool registry (default false)') }, ['text']),
      async a => {
        const m = await load();
        const t0 = (window.performance || Date).now();
        const res = m.route.routeUtterance(a.text, m.grammar, m.tools, m.catalog);
        const ms = +((window.performance || Date).now() - t0).toFixed(1);
        const out = { call: res.call, source: res.source, notes: res.notes, raw: res.raw, ms };
        if (a.execute && res.call) {
          out.result = await PF.Tools.call(res.call.tool, res.call.args || {});
        }
        return out;
      }, ['forge', 'nik1']);

    registry('nik1_search', 'Search the asset catalogue by meaning ("cute farm animal", "dungeon tileset") with a 132k-parameter on-device encoder. Returns ranked template ids with scores.',
      obj({ query: str('What you are looking for'), limit: num('How many results (default 8)', { minimum: 1, maximum: 20 }) }, ['query']),
      async a => {
        const m = await load();
        const t0 = (window.performance || Date).now();
        const hits = m.search.search(a.query, a.limit || 8);
        const ms = +((window.performance || Date).now() - t0).toFixed(1);
        return { query: a.query, ms, hits: hits.map(h => ({ id: h.id, score: +h.score.toFixed(4), ...(PF.Library.docStats(h.id) || {}) })) };
      }, ['forge', 'nik1']);

    registry('nik1_palette', 'Classify the palette family of a sprite (gameboy 4-colour, NES 16, 1-bit, sepia, neon, pastel, …) with a 5 KB on-device head. Defaults to the active frame of the open document.',
      obj({ source: str('Where to read the sprite from', { enum: ['active-frame', 'active-state-first-frame'] }) }),
      async a => {
        const m = await load();
        const d = PF.Store.get();
        const frame = a.source === 'active-state-first-frame' ? PF.Store.state().frames[0] : PF.Store.frame();
        const buf = new Uint32Array(d.width * d.height);
        PF.Renderer.compositeFrame(frame, buf);
        const t0 = (window.performance || Date).now();
        const res = m.palette.classifySprite(buf);
        const ms = +((window.performance || Date).now() - t0).toFixed(3);
        return { palette: res.label, labels: m.palette.labels, ms, sprite: `${d.width}x${d.height}` };
      }, ['forge', 'nik1']);
  };

  try { register(); } catch (e) { console.warn('nik1 tools failed to register', e); }

  return { load, basePath, state };
})();
