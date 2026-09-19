/* Boot the PixelForge library *and* the agent tool registry headlessly.
   scripts/lib-boot.js deliberately loads only raster + library (the asset
   pipeline). The Nik1 router needs PF.Tools, which lives in js/agent and reads
   PF.IO at load time, so this adds the small DOM stubs those modules touch. */
const fs = require('fs');
const path = require('path');
const { boot, ROOT } = require('../../scripts/lib-boot');

function bootWithTools() {
  const PF = boot();
  const g = global;
  if (!g.document) {
    g.document = { createElement: () => ({ getContext: () => ({}), toDataURL: () => '' }) };
    g.Blob = function () {};
    g.URL = { createObjectURL: () => '', revokeObjectURL() {} };
  }
  if (!PF.Input) PF.Input = { TOOLS: ['pencil'], setTool() {}, setSize() {}, setOption() {}, get() { return {}; } };
  if (!PF.Anim) PF.Anim = { PRESETS: [], play() {}, pause() {} };
  if (!PF.Store) PF.Store = { emit() {}, get() { return {}; }, on() {}, summary() { return {}; }, frame() { return {}; }, state() { return {}; } };
  if (!PF.Renderer) PF.Renderer = { frameToCanvas() {}, setZoom() {}, setOption() {}, getView() { return {}; } };
  if (!PF.UI) PF.UI = { setView() {}, setTheme() {}, describe() { return []; }, click() {} };
  if (!PF.Projects) PF.Projects = {};
  for (const f of ['js/core/io.js', 'js/agent/tools.js', 'js/agent/studio-tools.js']) {
    try { eval(fs.readFileSync(path.join(ROOT, f), 'utf8')); }
    catch (e) { if (!/already|Cannot read/.test(e.message)) throw new Error(`${f}: ${e.message}`); }
  }
  return PF;
}
module.exports = { bootWithTools };
