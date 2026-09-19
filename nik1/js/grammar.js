/* Nik1 grammar: constrained decoding + repair + validation, in the browser.
 *
 * Mirrors nik1/python/nik1/grammar.py. The two implementations are kept in
 * step by `nik1/tests/test_js_parity.py`, which feeds the same inputs to both
 * and compares the results — a repair rule that drifts between the trainer and
 * the runtime is exactly the kind of bug that only shows up in production.
 *
 * The contract, in order of strength:
 *   1. a tool name that does not exist cannot be generated (token mask)
 *   2. whatever is generated is coerced against the live schema
 *   3. if it still fails, a deterministic keyword router answers instead
 * So `route()` always returns a valid call; only the *source* varies.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.Nik1Grammar = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const TOOL_PREFIX = '{"tool":"';
  const ARGS_MID = '","args":{';

  /* Tools whose `id` argument is a catalogue reference. A 250k model happily
     emits `rpg_deathk` for `rpg_deathknight`, which validates as a string and is
     wrong; the catalogue is small and on-device, so the repair layer checks it. */
  const TEMPLATE_TOOLS = { load_template: 1, append_template_states: 1 };

  function loadCatalog(list) {
    const cat = {};
    for (const t of list || []) cat[t.id] = t.name || '';
    return cat;
  }

  function fixReference(value, catalog, utterance) {
    if (!catalog || !Object.keys(catalog).length) return value;
    if (catalog[value] !== undefined) return value;
    const low = String(utterance || '').toLowerCase();
    for (const id of Object.keys(catalog)) if (low.indexOf(id) >= 0) return id;
    for (const id of Object.keys(catalog)) {
      const name = catalog[id];
      if (name && low.indexOf(String(name).toLowerCase()) >= 0) return id;
    }
    const cands = Object.keys(catalog).filter(id => value.length >= 3 && id.indexOf(value) === 0);
    if (cands.length === 1) return cands[0];
    return null;
  }

  const FALLBACK_RULES = [
    [/\b(undo|go back|take that back)\b/, 'undo'],
    [/\b(redo|put it back)\b/, 'redo'],
    [/\b(play|start playback)\b/, 'play'],
    [/\b(pause|stop the animation)\b/, 'pause'],
    [/\b(clear|erase|wipe)\b/, 'clear'],
    [/\b(export|download|save as)\b/, 'export'],
    [/\b(zoom|grid|onion|theme)\b/, 'set_view'],
    [/\b(list|what|which|show)\b.*\b(templates|assets|sprites)\b/, 'list_templates'],
    [/\b(list|show)\b.*\bprojects\b/, 'list_projects'],
    [/\bsave\b.*\bproject\b/, 'save_project'],
    [/\b(open|load)\b/, 'load_template'],
    [/\b(add|make|create)\b.*\b(state|animation)\b/, 'add_state'],
    [/\badd\b.*\bframe\b/, 'add_frame'],
    [/\bdraw\b.*\bline\b/, 'draw_line'],
    [/\bdraw\b.*\b(rect|rectangle|box)\b/, 'draw_rect'],
    [/\bdraw\b.*\b(circle|ellipse)\b/, 'draw_ellipse'],
    [/\b(fill|bucket)\b/, 'fill'],
    [/\boutline\b/, 'outline'],
    [/\b(flip|mirror)\b/, 'flip'],
    [/\bshift\b/, 'shift'],
    [/\bpalette\b/, 'get_palette'],
    [/\bcolor\b/, 'set_color'],
    [/\blayer\b/, 'add_layer']
  ];

  /* Tool schemas come from the model config when embedded, otherwise from the
     data file the exporter syncs next to the models. */
  function loadTools(config, external) {
    const list = (external && external.length ? external : null) ||
      (config && config.tools ? config.tools : null);
    if (!list) throw new Error('nik1 grammar: no tool schemas (pass config.tools or the tools.json data file)');
    const index = {};
    for (const t of (Array.isArray(list) ? list : Object.values(list))) index[t.name] = t;
    return index;
  }

  function prefixTokens(tok, suffix) {
    const allowed = new Set();
    if (!suffix.length) return allowed;
    for (const [text, id] of Object.entries(tok.vocab)) {
      if (text === '<pad>' || text === '<bos>' || text === '<eos>' || text === '<unk>') continue;
      if (suffix.startsWith(text)) allowed.add(id);
    }
    if (!allowed.size) {
      for (const [text, id] of Object.entries(tok.vocab)) if (text.length === 1 && suffix.startsWith(text)) allowed.add(id);
    }
    return allowed;
  }

  /* Token-level mask: forces the envelope, then the tool name, then lets the
     model write the arguments (which repair/validate handle). */
  function routeMaskFn(tok, toolNames, config) {
    const names = toolNames || (config && config.tool_index) || [];
    const seen = new Set();
    return function (generatedIds) {
      const text = tok.raw(generatedIds);
      if (text.length < TOOL_PREFIX.length) {
        const t = prefixTokens(tok, TOOL_PREFIX.slice(text.length));
        return t.size ? t : null;
      }
      if (!text.startsWith(TOOL_PREFIX)) return null;
      const rest = text.slice(TOOL_PREFIX.length);
      const candidates = names.filter(n => n.startsWith(rest));
      if (!candidates.length) return null;
      const allowed = new Set();
      for (const n of candidates) {
        const suffix = n.slice(rest.length);
        const set = prefixTokens(tok, suffix + ARGS_MID);
        for (const id of set) allowed.add(id);
      }
      return allowed.size ? allowed : null;
    };
  }

  function extractJson(text) {
    let depth = 0, start = -1, inStr = false, esc = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (inStr) {
        if (esc) esc = false;
        else if (ch === '\\') esc = true;
        else if (ch === '"') inStr = false;
        continue;
      }
      if (ch === '"') inStr = true;
      else if (ch === '{') { if (depth === 0) start = i; depth++; }
      else if (ch === '}') {
        depth--;
        if (depth === 0 && start >= 0) return text.slice(start, i + 1);
        if (depth < 0) return null;
      }
    }
    return null;
  }

  const COLOR_RE = /^#([0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

  function coerce(value, prop, key) {
    const t = prop.type;
    if (t === 'integer' || t === 'number') {
      let out;
      if (typeof value === 'boolean') out = value ? 1 : 0;
      else if (typeof value === 'number') out = Math.trunc(value);
      else {
        const m = String(value).match(/-?\d+/);
        out = m ? parseInt(m[0], 10) : 0;
      }
      if (prop.minimum !== null && prop.minimum !== undefined) out = Math.max(prop.minimum, out);
      if (prop.maximum !== null && prop.maximum !== undefined) out = Math.min(prop.maximum, out);
      return out;
    }
    if (t === 'boolean') {
      if (typeof value === 'boolean') return value;
      return ['true', '1', 'yes', 'on'].indexOf(String(value).trim().toLowerCase()) >= 0;
    }
    if (t === 'string') {
      let s = value === null || value === undefined ? '' : String(value);
      if (prop.enum) {
        if (prop.enum.indexOf(s) >= 0) return s;
        const low = s.trim().toLowerCase();
        for (const e of prop.enum) if (String(e).toLowerCase() === low) return e;
        return null;
      }
      if (key.indexOf('color') >= 0 && !COLOR_RE.test(s)) {
        const m = s.match(/#?[0-9a-fA-F]{3,8}/);
        if (m) return m[0][0] === '#' ? m[0] : '#' + m[0];
      }
      return s;
    }
    if (t === 'array') return Array.isArray(value) ? value : (value === null || value === undefined ? [] : [value]);
    if (t === 'object') return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    return value;
  }

  function repairCall(rawText, tools, utterance, catalog) {
    tools = tools || {};
    const notes = [];
    let text = extractJson(rawText || '');
    if (!text) {
      const i = (rawText || '').indexOf('{');
      if (i < 0) return { call: null, notes: ['no-json'] };
      text = rawText.slice(i);
      notes.push('truncated');
    }
    let obj = null;
    try { obj = JSON.parse(text); } catch (e) { obj = null; }
    if (obj === null) {
      const trimmed = text.replace(/[,\s]+$/, '');
      for (const suffix of ['"}}', '"}}}', '}}', '}']) {
        try { obj = JSON.parse(trimmed + suffix); notes.push('closed-truncated'); break; } catch (e) { obj = null; }
      }
      if (obj === null) return { call: null, notes: notes.concat(['unparseable']) };
    }
    if (typeof obj !== 'object' || Array.isArray(obj)) return { call: null, notes: notes.concat(['not-an-object']) };
    let name = obj.tool || obj.name || obj.function;
    if (name && typeof name === 'object') name = name.name;
    if (typeof name !== 'string' || !tools[name]) {
      const hit = Object.keys(tools).find(n => (rawText || '').indexOf(n) >= 0);
      if (!hit) return { call: null, notes: notes.concat(['unknown-tool']) };
      name = hit;
      notes.push('tool-from-text');
    }
    const spec = tools[name];
    let argsIn = obj.args && typeof obj.args === 'object' ? obj.args : obj.arguments;
    if (!argsIn || typeof argsIn !== 'object' || Array.isArray(argsIn)) {
      argsIn = {};
      for (const k of Object.keys(obj)) if (['tool', 'name', 'args', 'arguments'].indexOf(k) < 0) argsIn[k] = obj[k];
      if (Object.keys(argsIn).length) notes.push('args-from-toplevel');
    }
    const props = spec.properties || {};
    const out = {};
    for (const k of Object.keys(argsIn)) {
      if (!props[k]) { notes.push('dropped:' + k); continue; }
      const cv = coerce(argsIn[k], props[k], k);
      if (cv === null) { notes.push('bad:' + k); continue; }
      out[k] = cv;
    }
    if (TEMPLATE_TOOLS[name] && catalog) {
      for (const k of Object.keys(out)) {
        if (k !== 'id' && k !== 'template') continue;
        const fixed = fixReference(out[k], catalog, utterance);
        if (fixed === null) { delete out[k]; notes.push('bad-ref:' + k); }
        else if (fixed !== out[k]) { out[k] = fixed; notes.push('fixed-ref:' + k); }
      }
    }
    for (const k of spec.required || []) {
      if (k in out) continue;
      const inferred = inferArg(k, props[k], utterance, tools, name);
      if (inferred === null || inferred === undefined) return { call: null, notes: notes.concat(['missing:' + k]) };
      out[k] = inferred;
      notes.push('inferred:' + k);
    }
    return { call: { tool: name, args: out }, notes };
  }

  function inferArg(key, prop, utterance, tools, toolName) {
    if (!prop) return null;
    const low = String(utterance || '').toLowerCase();
    if (prop.enum) {
      for (const e of prop.enum) if (low.indexOf(String(e).toLowerCase()) >= 0) return e;
      return null;
    }
    if (key === 'id' || key === 'name' || key === 'template') {
      const m = low.match(/(?:project|named|called)\s+([a-z0-9_-]+)/);
      return m ? m[1] : null;
    }
    if (key.indexOf('color') >= 0) {
      const m = low.match(/#[0-9a-f]{3,8}/);
      return m ? m[0] : null;
    }
    if (prop.type === 'integer' || prop.type === 'number') {
      const m = low.match(/-?\d+/);
      if (!m) return null;
      let v = parseInt(m[0], 10);
      if (prop.minimum !== null && prop.minimum !== undefined) v = Math.max(prop.minimum, v);
      if (prop.maximum !== null && prop.maximum !== undefined) v = Math.min(prop.maximum, v);
      return v;
    }
    if (prop.type === 'boolean') return /\b(true|yes|on|filled)\b/.test(low);
    return null;
  }

  function validateCall(call, tools) {
    const errors = [];
    if (!call || typeof call !== 'object') return { ok: false, errors: ['not-an-object'] };
    const spec = tools[call.tool];
    if (!spec) return { ok: false, errors: ['unknown-tool'] };
    const args = call.args || {};
    const props = spec.properties || {};
    for (const k of spec.required || []) if (!(k in args)) errors.push('missing:' + k);
    for (const k of Object.keys(args)) {
      if (!props[k]) { errors.push('unknown:' + k); continue; }
      const prop = props[k], v = args[k], t = prop.type;
      if ((t === 'integer' || t === 'number') && typeof v !== 'number') errors.push('type:' + k);
      if (t === 'boolean' && typeof v !== 'boolean') errors.push('type:' + k);
      if (t === 'string' && typeof v !== 'string') errors.push('type:' + k);
      if (prop.enum && prop.enum.indexOf(v) < 0) errors.push('enum:' + k);
      if (t === 'integer' || t === 'number') {
        if (prop.minimum !== null && prop.minimum !== undefined && v < prop.minimum) errors.push('min:' + k);
        if (prop.maximum !== null && prop.maximum !== undefined && v > prop.maximum) errors.push('max:' + k);
      }
    }
    return { ok: errors.length === 0, errors };
  }

  function fallbackRoute(utterance, tools) {
    const low = String(utterance || '').toLowerCase();
    for (const [re, tool] of FALLBACK_RULES) {
      if (!tools[tool] || !re.test(low)) continue;
      const r = repairCall(JSON.stringify({ tool, args: {} }), tools, utterance);
      if (r.call) return { call: r.call, source: 'fallback-rules' };
    }
    for (const name of Object.keys(tools)) {
      if (!(tools[name].required || []).length) return { call: { tool: name, args: {} }, source: 'fallback-empty' };
    }
    return { call: null, source: 'none' };
  }

  function route(utterance, raw, tools, catalog) {
    const { call, notes } = repairCall(raw, tools, utterance, catalog);
    if (call) {
      const v = validateCall(call, tools);
      if (v.ok) return { call, source: notes.length ? 'model+repair' : 'model', notes, raw };
    }
    const fb = fallbackRoute(utterance, tools);
    return { call: fb.call, source: fb.source, notes, raw };
  }

  return { loadTools, loadCatalog, fixReference, routeMaskFn, extractJson, repairCall, validateCall,
    fallbackRoute, route, prefixTokens, coerce, FALLBACK_RULES, TOOL_PREFIX, TEMPLATE_TOOLS };
});
