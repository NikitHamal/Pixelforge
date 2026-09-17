/* PixelForge Studio — Agent tool registry. Every capability of the studio is exposed as a typed, schema-described tool.
   Used by: in-app agent console, window.PixelForge API, postMessage bridge, MCP server manifest. */
window.PF = window.PF || {};
PF.Tools = (() => {
  const registry = new Map();
  const num = (d, extra = {}) => ({ type: 'integer', description: d, minimum: -1024, maximum: 1024, ...extra });
  const str = (d, extra = {}) => ({ type: 'string', description: d, ...extra });
  const bool = d => ({ type: 'boolean', description: d });
  const color = d => str(d || 'Hex color like #ff0044, #ff004480 (alpha) or "transparent"', { pattern: '^(#([0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})|transparent)$' });
  const obj = (properties, required = []) => ({ type: 'object', properties, required, additionalProperties: false });
  const register = (name, description, schema, handler, tags = []) => registry.set(name, { name, description, schema, handler, tags });

  /* Helpers */
  const S = () => PF.Store, R = () => PF.Raster, C = () => PF.Color;
  const doc = () => S().get();
  const layerIdx = i => { const d = doc(); const idx = i === undefined ? d.activeLayer : i; if (!d.layers[idx]) throw new Error(`Layer ${idx} not found`); return idx; };
  const withLayer = (args, fn) => { const d = doc(); const li = layerIdx(args.layer); if (d.layers[li].locked) throw new Error('Layer is locked');
    if (args.frame !== undefined) S().setActive({ frame: args.frame }); const arr = S().beginStroke(d.layers[li].id);
    try { const result = fn(arr, d.width, d.height); S().endStroke(); return result ?? { ok: true }; }
    catch (error) { S().cancelStroke(); throw error; } };
  const cur = args => args.color === undefined ? C().hexToU32(doc().color) : C().hexToU32(args.color);
  const shape = { fill: bool('Fill the shape'), size: num('Stroke size in px (default 1)', { minimum: 1, maximum: 32 }), layer: num('Layer index (default active)'), frame: num('Frame index (default active)'), mirror_x: bool('Mirror horizontally'), mirror_y: bool('Mirror vertically') };

  /* ---------- Document ---------- */
  register('get_document', 'Get a JSON summary of the document: size, layers, states, frames, palette, active selection. Call this first.', obj({}), () => S().summary(), ['doc']);
  register('new_document', 'Create a new blank document.', obj({ width: num('Width 1-256'), height: num('Height 1-256'), name: str('Document name') }, ['width', 'height']), a => { S().newDoc(a); return S().summary(); }, ['doc']);
  register('resize_document', 'Resize the canvas (keeps pixels).', obj({ width: num('New width'), height: num('New height'), anchor: str('top-left | center', { enum: ['top-left', 'center'] }) }, ['width', 'height']), a => { S().resize(a.width, a.height, a.anchor); return S().summary(); }, ['doc']);
  register('rename_document', 'Rename the document.', obj({ name: str('Name') }, ['name']), a => { S().rename(a.name); return { name: a.name }; }, ['doc']);
  register('undo', 'Undo last action.', obj({}), () => ({ undone: S().undo() }), ['doc']);
  register('redo', 'Redo last undone action.', obj({}), () => ({ redone: S().redo() }), ['doc']);
  register('set_active', 'Select the active state, frame and/or layer.', obj({ state: num('State index'), frame: num('Frame index'), layer: num('Layer index') }), a => { S().setActive(a); const d = doc(); return { state: d.activeState, frame: d.activeFrame, layer: d.activeLayer }; }, ['doc']);

  /* ---------- Pixels ---------- */
  register('paint_rows', 'Paint ASCII-art rows onto the canvas. Each row is a string; each char maps to a color via legend; "." or space = skip. Best way for agents to draw sprites.',
    obj({ rows: { type: 'array', items: { type: 'string' }, description: 'Array of equal-length strings' }, legend: { type: 'object', additionalProperties: { type: 'string' }, description: 'Map char → hex color, e.g. {"G":"#63c74d"}' }, x: num('Left offset (default 0)'), y: num('Top offset (default 0)'), layer: num('Layer index'), frame: num('Frame index'), clear: bool('Clear layer first') }, ['rows', 'legend']),
    a => withLayer(a, (arr, w, h) => { if (a.clear) arr.fill(0); return { painted: R().paintRows(arr, w, h, a.rows, a.legend, a.x || 0, a.y || 0) }; }), ['pixels']);
  register('set_pixels', 'Set individual pixels.', obj({ pixels: { type: 'array', items: obj({ x: num('x'), y: num('y'), color: color() }, ['x', 'y', 'color']) }, layer: num('Layer index'), frame: num('Frame index') }, ['pixels']),
    a => withLayer(a, (arr, w, h) => { a.pixels.forEach(p => R().set(arr, w, h, p.x, p.y, C().hexToU32(p.color))); return { set: a.pixels.length }; }), ['pixels']);
  register('draw_line', 'Draw a line.', obj({ x0: num('start x'), y0: num('start y'), x1: num('end x'), y1: num('end y'), color: color(), ...shape }, ['x0', 'y0', 'x1', 'y1']),
    a => withLayer(a, (arr, w, h) => R().line(arr, w, h, a.x0, a.y0, a.x1, a.y1, cur(a), a.size || 1, !!a.mirror_x, !!a.mirror_y)), ['pixels']);
  register('draw_rect', 'Draw a rectangle from (x,y) with width/height.', obj({ x: num('left'), y: num('top'), width: num('width'), height: num('height'), color: color(), ...shape }, ['x', 'y', 'width', 'height']),
    a => withLayer(a, (arr, w, h) => R().rect(arr, w, h, a.x, a.y, a.x + a.width - 1, a.y + a.height - 1, cur(a), { fill: !!a.fill, size: a.size || 1, mx: !!a.mirror_x, my: !!a.mirror_y })), ['pixels']);
  register('draw_ellipse', 'Draw an ellipse inside the bounding box (x,y,width,height).', obj({ x: num('left'), y: num('top'), width: num('width'), height: num('height'), color: color(), ...shape }, ['x', 'y', 'width', 'height']),
    a => withLayer(a, (arr, w, h) => R().ellipse(arr, w, h, a.x, a.y, a.x + a.width - 1, a.y + a.height - 1, cur(a), { fill: !!a.fill, size: a.size || 1, mx: !!a.mirror_x, my: !!a.mirror_y })), ['pixels']);
  register('fill', 'Flood fill from a point (bucket).', obj({ x: num('x'), y: num('y'), color: color(), contiguous: bool('Only connected region (default true)'), layer: num('Layer index'), frame: num('Frame index') }, ['x', 'y']),
    a => withLayer(a, (arr, w, h) => R().fill(arr, w, h, a.x, a.y, cur(a), a.contiguous !== false)), ['pixels']);
  register('clear', 'Clear a layer (or a rect region) to transparent.', obj({ x: num('left'), y: num('top'), width: num('width'), height: num('height'), layer: num('Layer index'), frame: num('Frame index') }),
    a => withLayer(a, (arr, w, h) => { if (a.width) R().rect(arr, w, h, a.x || 0, a.y || 0, (a.x || 0) + a.width - 1, (a.y || 0) + (a.height || 1) - 1, 0, { fill: true }); else arr.fill(0); }), ['pixels']);
  register('flip', 'Flip the layer horizontally or vertically.', obj({ axis: str('x | y', { enum: ['x', 'y'] }), layer: num('Layer index'), frame: num('Frame index'), all_frames: bool('Apply to every frame of the active state') }, ['axis']),
    a => applyEach(a, (arr, w, h) => arr.set(a.axis === 'x' ? R().flipH(arr, w, h) : R().flipV(arr, w, h))), ['pixels']);
  register('shift', 'Translate layer pixels by dx,dy (optionally wrap).', obj({ dx: num('dx'), dy: num('dy'), wrap: bool('Wrap around edges'), layer: num('Layer index'), frame: num('Frame index'), all_frames: bool('Apply to every frame') }, ['dx', 'dy']),
    a => applyEach(a, (arr, w, h) => arr.set(R().shift(arr, w, h, a.dx, a.dy, !!a.wrap))), ['pixels']);
  register('outline', 'Add a 1px outline around all opaque pixels of the layer.', obj({ color: color(), diagonal: bool('Include diagonals (thicker)'), layer: num('Layer index'), frame: num('Frame index'), all_frames: bool('Apply to every frame') }),
    a => applyEach(a, (arr, w, h) => arr.set(R().outline(arr, w, h, a.color ? C().hexToU32(a.color) : C().hexToU32('#181425'), !!a.diagonal))), ['pixels']);
  register('replace_color', 'Replace one color with another on the layer.', obj({ from: color('Color to replace'), to: color('New color'), layer: num('Layer index'), frame: num('Frame index'), all_frames: bool('Apply to every frame') }, ['from', 'to']),
    a => applyEach(a, arr => R().replaceColor(arr, C().hexToU32(a.from), C().hexToU32(a.to))), ['pixels']);
  register('shade', 'Lighten (+) or darken (−) opaque pixels in a rect.', obj({ x: num('left'), y: num('top'), width: num('width'), height: num('height'), amount: num('−255..255, e.g. 24 or -24'), layer: num('Layer index'), frame: num('Frame index') }, ['x', 'y', 'width', 'height', 'amount']),
    a => withLayer(a, (arr, w, h) => R().shadeRegion(arr, w, h, a.x, a.y, a.x + a.width - 1, a.y + a.height - 1, a.amount)), ['pixels']);
  register('get_pixels', 'Read pixels as rows of hex colors ("." = transparent). Composited by default, or a single layer.', obj({ frame: num('Frame index (default active)'), layer: num('Layer index (omit for composite)') }),
    a => { const d = doc(), f = a.frame === undefined ? S().frame() : S().state().frames[a.frame]; if (!f) throw new Error('Frame not found');
      let p; if (a.layer !== undefined) p = f.pixels[d.layers[layerIdx(a.layer)].id]; else { p = new Uint32Array(d.width * d.height); PF.Renderer.compositeFrame(f, p); }
      return { width: d.width, height: d.height, bounds: R().bounds(p, d.width, d.height), colors: R().colorsOf(p).map(C().u32ToHex), rows: R().toRows(p, d.width, d.height) }; }, ['pixels']);
  function applyEach(a, fn) {
    const d = doc(), li = layerIdx(a.layer), id = d.layers[li].id;
    if (!a.all_frames) return withLayer(a, fn);
    S().transact(dd => { dd.states[dd.activeState].frames.forEach(f => fn(f.pixels[id], dd.width, dd.height)); }); return { ok: true, frames: S().state().frames.length };
  }

  /* ---------- Palette & color ---------- */
  register('get_palette', 'Get the palette and current color.', obj({}), () => ({ palette: doc().palette, color: doc().color }), ['palette']);
  register('set_palette', 'Replace the palette.', obj({ colors: { type: 'array', items: color() } }, ['colors']), a => { S().setPalette(a.colors); return { count: a.colors.length }; }, ['palette']);
  register('add_palette_color', 'Add a color to the palette.', obj({ color: color() }, ['color']), a => { S().addPaletteColor(a.color); return { palette: doc().palette }; }, ['palette']);
  register('set_color', 'Set the current drawing color (used when tools omit color).', obj({ color: color() }, ['color']), a => { S().setColor(a.color); return { color: a.color }; }, ['palette']);

  /* ---------- Layers ---------- */
  register('add_layer', 'Add a layer above the active one.', obj({ name: str('Layer name') }), a => { S().addLayer(a.name); return S().summary().layers; }, ['layers']);
  register('remove_layer', 'Remove a layer by index.', obj({ index: num('Layer index') }, ['index']), a => ({ removed: S().removeLayer(a.index) }), ['layers']);
  register('set_layer', 'Update layer properties.', obj({ index: num('Layer index'), name: str('Name'), visible: bool('Visible'), opacity: { type: 'number', minimum: 0, maximum: 1 }, locked: bool('Locked') }, ['index']),
    a => { const { index, ...patch } = a; S().updateLayer(layerIdx(index), patch); return S().summary().layers[index]; }, ['layers']);
  register('merge_layer_down', 'Merge a layer into the one below.', obj({ index: num('Layer index') }, ['index']), a => { S().mergeDown(a.index); return S().summary().layers; }, ['layers']);

  /* ---------- Animation ---------- */
  register('list_states', 'List animation states with frame counts and presets available.', obj({}), () => ({ states: S().summary().states, presets: PF.Anim.PRESETS.map(([name, frames, fps]) => ({ name, frames, fps })) }), ['anim']);
  register('add_state', 'Add an animation state (e.g. idle, walk, attack). Optionally copy frames from an existing state or use a preset frame count.', obj({ name: str('State name'), fps: num('Frames per second'), frames: num('Number of blank frames (default 1)'), copy_from: num('Copy all frames from this state index'), from_preset: bool('Use preset frame count/fps for this name and copy the current frame into each') }, ['name']),
    a => { let idx; if (a.from_preset) idx = PF.Anim.createFromPreset(a.name); else idx = S().addState({ name: a.name, fps: a.fps || 8, frames: a.frames || 1, copyFrom: a.copy_from }); return { state: idx, ...S().summary().states[idx] }; }, ['anim']);
  register('remove_state', 'Remove a state.', obj({ index: num('State index') }, ['index']), a => ({ removed: S().removeState(a.index) }), ['anim']);
  register('set_state', 'Rename / set fps / loop of a state.', obj({ index: num('State index'), name: str('Name'), fps: num('FPS'), loop: bool('Loop') }, ['index']), a => { const { index, ...p } = a; S().updateState(index, p); return S().summary().states[index]; }, ['anim']);
  register('add_frame', 'Add a frame after the active one (duplicate by default).', obj({ duplicate: bool('Copy current frame pixels (default true)'), at: num('Insert after this index') }), a => ({ frame: S().addFrame({ duplicate: a.duplicate !== false, at: a.at }) }), ['anim']);
  register('remove_frame', 'Remove a frame.', obj({ index: num('Frame index') }, ['index']), a => ({ removed: S().removeFrame(a.index) }), ['anim']);
  register('move_frame', 'Move a frame left (-1) or right (+1).', obj({ index: num('Frame index'), direction: num('-1 or 1') }, ['index', 'direction']), a => { S().moveFrame(a.index, a.direction); return { frame: doc().activeFrame }; }, ['anim']);
  register('set_frame_duration', 'Set a frame duration in ms.', obj({ index: num('Frame index'), ms: num('Duration in ms', {minimum:10,maximum:60000}) }, ['index', 'ms']), a => { S().setFrameDuration(a.index, a.ms); return { ok: true }; }, ['anim']);
  register('play', 'Play the active (or given) state.', obj({ state: num('State index') }), a => { if (a.state !== undefined) S().setActive({ state: a.state }); PF.Anim.play(); return { playing: true }; }, ['anim']);
  register('pause', 'Pause playback.', obj({}), () => { PF.Anim.pause(); return { playing: false }; }, ['anim']);

  /* ---------- Export / vision ---------- */
  register('export', 'Export/download the asset.', obj({ format: str('Format', { enum: PF.IO.FORMATS.map(f => f.id) }), scale: num('Upscale factor 1-16'), layout: str('Sheet layout', { enum: ['rows', 'grid', 'strip'] }), padding: num('Sheet padding px'), state: num('State index (gif)') }, ['format']),
    async a => await PF.IO.run(a.format, { scale: Math.max(1, Math.min(16, a.scale || 1)), layout: a.layout, padding: a.padding, state: a.state }), ['export']);
  register('render_preview', 'Render the current frame to a PNG data URL (for vision-capable agents to inspect their work).', obj({ scale: num('Scale (default 4)'), frame: num('Frame index') }),
    a => { if (a.frame !== undefined) S().setActive({ frame: a.frame }); return { dataUrl: PF.IO.dataURL(a.scale || 4) }; }, ['export']);
  register('render_state', 'Render every frame of a state as PNG data URLs.', obj({ state: num('State index'), scale: num('Scale (default 2)') }),
    a => { const d = doc(), st = d.states[a.state ?? d.activeState]; return { name: st.name, frames: st.frames.map(f => PF.Renderer.frameToCanvas(f, a.scale || 2).toDataURL('image/png')) }; }, ['export']);
  register('get_project', 'Get the full lossless project JSON string.', obj({}), () => ({ project: S().serialize() }), ['export']);
  register('load_project', 'Load a project JSON string.', obj({ project: str('Project JSON') }, ['project']), a => { S().load(a.project); return S().summary(); }, ['export']);

  /* ---------- UI (pixel-perfect navigation) ---------- */
  register('set_tool', 'Select an interactive tool and options.', obj({ tool: str('Tool', { enum: PF.Input.TOOLS }), size: num('Brush size'), fill: bool('Fill shapes'), mirror_x: bool('Symmetry X'), mirror_y: bool('Symmetry Y') }),
    a => { if (a.tool) PF.Input.setTool(a.tool); if (a.size) PF.Input.setSize(a.size); if (a.fill !== undefined) PF.Input.setOption('shapeFill', a.fill); if (a.mirror_x !== undefined) PF.Input.setOption('mirrorX', a.mirror_x); if (a.mirror_y !== undefined) PF.Input.setOption('mirrorY', a.mirror_y); return PF.Input.get(); }, ['ui']);
  register('set_view', 'Zoom / grid / onion skin / studio panel.', obj({ zoom: num('Zoom 1-64'), grid: bool('Grid'), onion: bool('Onion skin'), panel: str('Mobile panel', { enum: ['tools', 'canvas', 'anim', 'agent'] }), theme: str('light | dark', { enum: ['light', 'dark'] }) }),
    a => { if (a.zoom) PF.Renderer.setZoom(a.zoom); if (a.grid !== undefined) PF.Renderer.setOption('grid', a.grid); if (a.onion !== undefined) PF.Renderer.setOption('onion', a.onion); if (a.panel) PF.UI.setView(a.panel); if (a.theme) PF.UI.setTheme(a.theme); return { ...PF.Renderer.getView(), hover: undefined }; }, ['ui']);
  register('describe_ui', 'List every interactive UI element with its agent id, label, role, state and screen rect. Use with click_ui.', obj({ filter: str('Substring filter on id/label') }), a => PF.UI.describe(a.filter), ['ui']);
  register('click_ui', 'Click a UI element by agent id (from describe_ui). Optionally set a value for inputs.', obj({ id: str('data-agent-id'), value: str('Value for inputs/selects') }, ['id']), a => PF.UI.click(a.id, a.value), ['ui']);

  /* ---------- Dispatcher ---------- */
  const list = () => [...registry.values()].map(({ name, description, schema, tags }) => ({ name, description, inputSchema: schema, tags }));
  function validateValue(schema, value, path = 'arguments', depth = 0) {
    if (depth > 12) throw new Error('Arguments are nested too deeply.');
    if (schema.type === 'object') {
      if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${path} must be an object.`);
      for (const name of schema.required || []) if (value[name] === undefined) throw new Error(`Missing ${path}.${name}`);
      for (const [name, child] of Object.entries(value)) {
        if (['__proto__','constructor','prototype'].includes(name)) throw new Error('Unsafe argument key.');
        const property = schema.properties?.[name];
        if (property) validateValue(property, child, `${path}.${name}`, depth + 1);
        else if (schema.additionalProperties === false) throw new Error(`Unknown argument ${path}.${name}`);
        else if (typeof schema.additionalProperties === 'object') validateValue(schema.additionalProperties, child, `${path}.${name}`, depth + 1);
      }
    } else if (schema.type === 'array') {
      if (!Array.isArray(value) || value.length > (schema.maxItems || 65536)) throw new Error(`${path} must be an array within the size limit.`);
      if (schema.items) value.forEach((child, index) => validateValue(schema.items, child, `${path}[${index}]`, depth + 1));
    } else if (schema.type === 'integer' || schema.type === 'number') {
      if (typeof value !== 'number' || !Number.isFinite(value) || (schema.type === 'integer' && !Number.isInteger(value))) throw new Error(`${path} must be a finite ${schema.type}.`);
      if ((schema.minimum !== undefined && value < schema.minimum) || (schema.maximum !== undefined && value > schema.maximum)) throw new Error(`${path} is outside its allowed range.`);
    } else if (schema.type === 'string') {
      if (typeof value !== 'string' || value.length > (schema.maxLength || 96 * 1024 * 1024)) throw new Error(`${path} must be a string within the size limit.`);
      if (schema.pattern && !new RegExp(schema.pattern).test(value)) throw new Error(`${path} has an invalid format.`);
    } else if (schema.type === 'boolean' && typeof value !== 'boolean') throw new Error(`${path} must be a boolean.`);
    if (schema.enum && !schema.enum.includes(value)) throw new Error(`${path} must be one of ${schema.enum.join(', ')}.`);
  }
  function validate(tool, args) { validateValue(tool.schema, args); }
  async function call(name, args = {}) {
    const t = registry.get(name), t0 = performance.now();
    if (!t) { const r = { ok: false, error: `Unknown tool "${name}"`, tool: name }; PF.Store.emit('tool:result', r); return r; }
    try { if (PF.Workspace && !PF.Workspace.isReady()) throw new Error('Workspace is busy or not ready.'); validate(t, args); const result = await t.handler(args); const r = { ok: true, tool: name, args, result, ms: Math.round(performance.now() - t0) }; PF.Store.emit('tool:result', r); return r; }
    catch (e) { const r = { ok: false, tool: name, args, error: e.message }; PF.Store.emit('tool:result', r); return r; }
  }
  return { register, call, list, validate: (name, args) => { const tool = registry.get(name); if (!tool) throw new Error('Unknown tool.'); validate(tool, args); return true; }, has: n => registry.has(n), get: n => registry.get(n) };
})();
