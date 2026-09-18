/* Static reference gate.
   Two classes of typo that no other gate catches:
     1. `PF.SomeModule.missingThing` — a call to something that does not exist,
        which only fails at runtime on the one code path that touches it.
     2. a malformed agent tool schema — a tool an LLM can never call correctly.

   Boots the headless subset, loads the DOM-free browser modules with tiny stubs,
   then walks every JavaScript file in the repo looking up each `PF.X.y` chain.

   Usage: node scripts/check-refs.js
*/
const fs = require('fs');
const path = require('path');
const { boot, ROOT } = require('./lib-boot');

let pass = 0, fail = 0;
const ok = (c, msg) => { c ? pass++ : (fail++, console.log('FAIL: ' + msg)); };

const PF = boot();

/* Modules that need a DOM or a live user session and cannot be booted here.
   Their own references are still scanned; chains *hanging off* them are not
   resolved (a stub would just manufacture false failures). */
const BROWSER_ONLY = new Set(['Input', 'UI', 'Store', 'Renderer', 'Anim', 'Projects', 'App', 'Nebians', 'Harness', 'MCP', 'Charts']);
global.window = global;
global.document = { createElement: () => ({ getContext: () => ({}), toDataURL: () => '' }) };
global.Blob = function () {};
global.URL = { createObjectURL: () => '', revokeObjectURL() {} };
/* tools.js reads the tool enum off PF.Input at load; a stub here is harmless
   because Input is on the skip list and its own chains are not resolved. */
PF.Input = { TOOLS: ['pencil'] };
eval(fs.readFileSync(path.join(ROOT, 'js/core/io.js'), 'utf8'));   // DOM-free at load

/* Load the tool registries so `PF.Tools.register` chains resolve. */
for (const f of ['js/agent/tools.js', 'js/agent/studio-tools.js']) {
  try { eval(fs.readFileSync(path.join(ROOT, f), 'utf8')); }
  catch (e) { ok(false, `${f} failed to load: ${e.message}`); }
}

/* ---------- 0. API surface of the modules we cannot boot ----------
   A stub would manufacture false failures, but skipping them entirely would let
   a misspelled method (e.g. a missing trailing letter 's') through. So parse each module's own
   `return { ... }` object literal out of its file and check chains against that
   surface. If the literal cannot be located we skip the module honestly. */
const SURFACE = new Map();
const allJs = dir => {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...allJs(p)); else if (e.name.endsWith('.js')) out.push(p);
  }
  return out;
};
const repoFiles = ['js', 'app', 'games', 'scripts'].flatMap(d => fs.existsSync(path.join(ROOT, d)) ? allJs(path.join(ROOT, d)) : []);
{
  const walk0 = dir => {
    const out = [];
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
      const p = path.join(dir, e.name);
      if (e.isDirectory()) out.push(...walk0(p)); else if (e.name.endsWith('.js')) out.push(p);
    }
    return out;
  };
  for (const file of ['js/core', 'js/ui'].flatMap(d => walk0(path.join(ROOT, d)))) {
    const src = fs.readFileSync(file, 'utf8');
    for (const m of src.matchAll(/PF\.([A-Z][A-Za-z0-9]*)\s*=\s*\(\(\)\s*=>\s*\{/g)) {
      const mod = m[1];
      if (!BROWSER_ONLY.has(mod) || SURFACE.has(mod)) continue;
      const tail = src.slice(m.index);
      const ret = tail.lastIndexOf('return {');
      if (ret < 0) continue;
      const body = tail.slice(ret + 8);
      const end = body.indexOf('};');
      if (end < 0) continue;
      const keys = new Set();
      // include the closing brace: the delimiter is what the regex matches on,
      // so slicing it off silently dropped every module's last export.
      for (const k of body.slice(0, end + 1).matchAll(/([A-Za-z_$][\w$]*)\s*[:,}]/g)) keys.add(k[1]);
      if (keys.size) SURFACE.set(mod, { keys, file: path.relative(ROOT, file) });
    }
  }
  /* Modules are also augmented after their IIFE (studio.js does
     `PF.UI.openDrawer = openDrawer`), so harvest those assignments too. */
  for (const file of repoFiles) {
    const src = fs.readFileSync(file, 'utf8');
    for (const m of src.matchAll(/PF\.([A-Z][A-Za-z0-9]*)\.([A-Za-z_$][\w$]*)\s*=[^=]/g)) {
      const [, mod, key] = m;
      if (!BROWSER_ONLY.has(mod)) continue;
      if (!SURFACE.has(mod)) SURFACE.set(mod, { keys: new Set(), file: path.relative(ROOT, file) });
      SURFACE.get(mod).keys.add(key);
    }
  }
}

/* ---------- 1. every PF.X.y chain resolves ---------- */
const walk = dir => {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else if (e.name.endsWith('.js')) out.push(p);
  }
  return out;
};
const files = repoFiles;
const unresolved = new Map();
for (const file of files) {
  const src = fs.readFileSync(file, 'utf8');
  for (const m of src.matchAll(/PF\.([A-Z][A-Za-z0-9]*)\.([A-Za-z_$][\w$]*)/g)) {
    if (BROWSER_ONLY.has(m[1])) {
      const surf = SURFACE.get(m[1]);
      if (surf && !surf.keys.has(m[2])) {
        const key = `PF.${m[1]}.${m[2]} (not on the ${m[1]} API surface in ${surf.file})`;
        if (!unresolved.has(key)) unresolved.set(key, path.relative(ROOT, file));
      }
      continue;                                            // not bootable headlessly
    }
    const mod = PF[m[1]];
    if (mod === undefined) continue;                       // module not booted here
    if (typeof mod === 'object' && !(m[2] in mod)) {
      const key = `PF.${m[1]}.${m[2]}`;
      if (!unresolved.has(key)) unresolved.set(key, path.relative(ROOT, file));
    }
  }
}
for (const [key, where] of unresolved) ok(false, `${key} does not exist (used in ${where})`);
ok(true, `PF references checked across ${files.length} files`);

/* ---------- 2. agent tool schemas ---------- */
const tools = PF.Tools.list();
ok(tools.length >= 50, `only ${tools.length} agent tools registered`);
const names = new Set();
for (const t of tools) {
  ok(/^[a-z][a-z0-9_]*$/.test(t.name), `tool name "${t.name}" is not snake_case`);
  ok(!names.has(t.name), `duplicate tool name "${t.name}"`);
  names.add(t.name);
  ok(t.description && t.description.length > 8, `tool ${t.name} has a thin description`);
  const sc = t.inputSchema;
  ok(sc && sc.type === 'object' && sc.properties, `tool ${t.name} has no object schema`);
  for (const [k, def] of Object.entries(sc.properties || {})) {
    ok(def && typeof def.type === 'string', `${t.name}.${k} has no type`);
    if (def.enum) ok(Array.isArray(def.enum) && def.enum.length > 0, `${t.name}.${k} has an empty enum`);
  }
  for (const req of sc.required || []) ok(!!(sc.properties || {})[req], `${t.name} requires unknown argument "${req}"`);
}

/* ---------- 3. handlers that can run headlessly must run ---------- */
const HEADLESS = ['list_styles', 'factory_help', 'list_export_formats', 'autotile_info', 'list_templates'];
for (const name of HEADLESS) {
  const t = PF.Tools.get(name);
  if (!t) { ok(false, `headless tool ${name} is missing`); continue; }
  try { const r = t.handler({}); ok(r && typeof r === 'object', `${name} returned nothing`); }
  catch (e) { ok(false, `${name} threw: ${e.message}`); }
}

console.log(`\nREFS: ${pass} pass, ${fail} fail (${tools.length} tools, ${files.length} files)`);
console.log(`      browser-only modules checked against their parsed API surface: ${[...SURFACE.keys()].join(', ') || 'none'}`);
process.exit(fail ? 1 : 0);
