#!/usr/bin/env node
/* Nik1 data exporter.
 *
 * The training data for every Nik1 specialist is *generated from this
 * repository* — the tool registry, the template catalogue and the engine's own
 * renderer. That keeps the models honest (no scraped corpus, no licence
 * question), reproducible (`node nik1/tools/export-data.js` regenerates it) and
 * exactly matched to the task the models sit next to.
 *
 * Writes:
 *   nik1/data/tools.json           tool schemas  -> router targets
 *   nik1/data/templates.json       asset registry -> retrieval documents
 *   nik1/data/palettes.json        Nik1's own palette families (self-contained)
 *   nik1/data/style_features.json  rendered sprite -> feature vector + best palette
 *
 * Usage: node nik1/tools/export-data.js [--frames N] [--no-features]
 */
const fs = require('fs');
const path = require('path');
const { renderFrame } = require('../../scripts/lib-boot');
const { bootWithTools } = require('./boot-tools');

const PF = bootWithTools();
const ROOT = path.resolve(__dirname, '..');
const DATA = path.join(ROOT, 'data');
fs.mkdirSync(DATA, { recursive: true });
const argv = process.argv.slice(2);
const flag = (name, dflt) => { const i = argv.indexOf('--' + name); return i >= 0 ? argv[i + 1] : dflt; };
const MAX_FRAMES = +flag('frames', 6000);

const write = (name, obj) => {
  const p = path.join(DATA, name);
  fs.writeFileSync(p, JSON.stringify(obj));
  const kb = (fs.statSync(p).size / 1024).toFixed(0);
  console.log(`  ${name.padEnd(22)} ${kb.padStart(6)} KB`);
};

/* ------------------------------------------------------------------ tools */
const tools = PF.Tools.list().map(t => ({
  name: t.name,
  description: t.description,
  tags: t.tags,
  properties: Object.fromEntries(Object.entries(t.inputSchema.properties || {}).map(([k, v]) => [k, {
    type: v.type, enum: v.enum || null, minimum: v.minimum ?? null, maximum: v.maximum ?? null, description: v.description
  }])),
  required: t.inputSchema.required || []
}));
console.log('exporting Nik1 data');
write('tools.json', tools);

/* -------------------------------------------------------------- templates */
const templates = PF.Library.list().map(t => {
  const s = PF.Library.docStats(t.id);
  return { id: t.id, name: t.name, category: t.category, desc: t.desc, tags: t.tags,
    w: s ? s.width : t.w, h: s ? s.height : t.h, states: s ? s.states : 0, frames: s ? s.frames : 0,
    stateNames: s ? s.stateNames : [] };
});
write('templates.json', templates);

/* --------------------------------------------------------------- palettes */
/* Nik1 ships its own palette families so the style specialist is self-contained
   and can be retrained against a different set without touching the engine.
   Distances are redmean, the same metric the engine uses for quantisation. */
const PALETTES = [
  { id: 'gb4', name: '4-colour handheld', palette: ['#0f380f', '#306230', '#8bac0f', '#9bbc0f'] },
  { id: 'grey4', name: '4-tone grey', palette: ['#101010', '#4a4a4a', '#9a9a9a', '#e8e8e8'] },
  { id: 'ink2', name: '1-bit ink', palette: ['#0b0b0f', '#f2f2ef'] },
  { id: 'nes16', name: '16-colour console', palette: ['#000000', '#7c7c7c', '#bcbcbc', '#fcfcfc', '#a4e4fc', '#3cbcfc', '#0078f8', '#0000fc', '#b8f8b8', '#58d854', '#00a800', '#f8b8f8', '#f878f8', '#e40058', '#fca044', '#e45c10'] },
  { id: 'sweet16', name: 'modern 16', palette: ['#1a1c2c', '#5d275d', '#b13e53', '#ef7d57', '#ffcd75', '#a7f070', '#38b764', '#257179', '#29366f', '#3b5dc9', '#41a6f6', '#73eff7', '#f4f4f4', '#94b0c2', '#566c86', '#333c57'] },
  { id: 'sepia4', name: 'aged print', palette: ['#2b1d0e', '#6b4f2a', '#b08d57', '#f0e2c0'] },
  { id: 'neon10', name: 'neon night', palette: ['#0b0420', '#1b0b3b', '#37196b', '#6a2c9c', '#c026d3', '#f43f8e', '#ff7ab8', '#22d3ee', '#7dd3fc', '#f8fafc'] },
  { id: 'pastel12', name: 'soft pastel', palette: ['#3b2f4a', '#6b5a7a', '#a08fb0', '#d6c9de', '#ffd6e0', '#ffb3c6', '#c6f0d8', '#8fd9b6', '#bfe3ff', '#8fb8e8', '#fff2c2', '#fffaf5'] }
];
write('palettes.json', PALETTES);

/* --------------------------------------------------------- sprite features */
/* Feature extraction is duplicated in JS (here, at training-data time) and in
   the browser runtime (nik1/js/nik1.js) — so it must be trivial integer/float
   maths with no library. 41 dims: 1 + 16 + 8 + 12 + 4. */
const u32 = h => PF.Color.hexToU32(h);
const PAL_U32 = PALETTES.map(p => ({ id: p.id, cols: p.palette.map(u32) }));
function dist(a, b) {
  const r1 = a & 255, g1 = (a >> 8) & 255, b1 = (a >> 16) & 255;
  const r2 = b & 255, g2 = (b >> 8) & 255, b2 = (b >> 16) & 255;
  const rm = (r1 + r2) >> 1, dr = r1 - r2, dg = g1 - g2, db = b1 - b2;
  return (((512 + rm) * dr * dr) >> 8) + 4 * dg * dg + (((767 - rm) * db * db) >> 8);
}
function rgbToHsv(r, g, b) {
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  let h = 0;
  if (d) {
    if (mx === r) h = ((g - b) / d) % 6;
    else if (mx === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h /= 6; if (h < 0) h += 1;
  }
  return [h, mx ? d / mx : 0, mx / 255];
}
function features(buf) {
  const N = buf.length;
  const lum = new Float64Array(16), sat = new Float64Array(8), hue = new Float64Array(12);
  const seen = new Set();
  let opaque = 0, sumL = 0, sumL2 = 0, sumS = 0;
  for (let i = 0; i < N; i++) {
    const v = buf[i];
    if (!v || (v >>> 24) < 128) continue;
    opaque++;
    const r = v & 255, g = (v >> 8) & 255, b = (v >> 16) & 255;
    const L = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    const [H, S] = rgbToHsv(r / 255, g / 255, b / 255);
    lum[Math.min(15, (L * 16) | 0)]++;
    sat[Math.min(7, (S * 8) | 0)]++;
    hue[Math.min(11, (H * 12) | 0)]++;
    sumL += L; sumL2 += L * L; sumS += S;
    if (seen.size < 4096) seen.add(v);
  }
  const f = [opaque / N];
  const norm = arr => { for (const x of arr) f.push(opaque ? x / opaque : 0); };
  norm(lum); norm(sat); norm(hue);
  const meanL = opaque ? sumL / opaque : 0;
  f.push(meanL, Math.sqrt(Math.max(0, (opaque ? sumL2 / opaque : 0) - meanL * meanL)),
    Math.min(1, seen.size / 64), opaque ? sumS / opaque : 0);
  return f;
}
function bestPalette(buf) {
  const counts = new Map();
  let opaque = 0;
  for (let i = 0; i < buf.length; i++) {
    const v = buf[i];
    if (!v || (v >>> 24) < 128) continue;
    opaque++;
    const key = v & 0xffffff;
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  let best = null;
  for (const pal of PAL_U32) {
    let err = 0;
    for (const [c, n] of counts) {
      let d = Infinity;
      for (const p of pal.cols) { const dd = dist(c, p); if (dd < d) d = dd; }
      err += d * n;
    }
    const score = opaque ? err / opaque : Infinity;
    if (!best || score < best.score) best = { id: pal.id, score };
  }
  return best ? best.id : PALETTES[0].id;
}

if (flag('features', 'yes') !== 'no') {
  /* Two targets from the same renders, because "which palette fits best" alone
     is a majority-class trap: the library is mostly drawn in rich palettes, so
     88% of sprites are best served by the 16-colour set and a model could win
     by always saying so. So we also emit a *balanced, decision-useful* task:
     take each sprite, apply each palette family for real, and ask the model to
     recognise which family the sprite is now in. That is the question an artist
     actually has when importing an unknown PNG — "what is this art's palette
     budget?" — and every class has the same number of examples by construction. */
  const rows = [];
  const fit = [];
  const list = PF.Library.list();
  const perTemplate = Math.max(1, Math.floor(MAX_FRAMES / list.length));
  const applyStyle = (buf, pal) => {
    const out = buf.slice();
    for (let i = 0; i < out.length; i++) {
      const v = out[i];
      if (!v || (v >>> 24) < 128) continue;
      let best = pal.cols[0], bd = Infinity;
      for (const p of pal.cols) { const d = dist(v, p); if (d < bd) { bd = d; best = p; } }
      out[i] = (best & 0xffffff) | (v & 0xff000000);
    }
    return out;
  };
  const errVector = buf => {
    const counts = new Map();
    let opaque = 0;
    for (let i = 0; i < buf.length; i++) {
      const v = buf[i];
      if (!v || (v >>> 24) < 128) continue;
      opaque++;
      const key = v & 0xffffff;
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    return PAL_U32.map(pal => {
      let err = 0;
      for (const [c, n] of counts) {
        let d = Infinity;
        for (const p of pal.cols) { const dd = dist(c, p); if (dd < d) d = dd; }
        err += d * n;
      }
      return Math.round(((opaque ? err / opaque : 0) / 65536) * 1000) / 1000;
    });
  };
  for (const t of list) {
    const doc = t.build();
    let n = 0;
    for (const s of doc.states) {
      const stride = Math.max(1, Math.ceil(s.frames.length / perTemplate));
      for (let fi = 0; fi < s.frames.length; fi += stride) {
        if (n >= perTemplate) break;
        const buf = renderFrame(doc, s.frames[fi]);
        const errs = errVector(buf);
        fit.push({ t: t.id, s: s.name, f: fi, x: features(buf).map(v => Math.round(v * 10000) / 10000), err: errs });
        for (const pal of PAL_U32) {
          rows.push({ t: t.id, pal: pal.id, x: features(applyStyle(buf, pal)).map(v => Math.round(v * 10000) / 10000) });
        }
        n++;
      }
    }
  }
  write('style_apply.json', rows);
  write('style_fit.json', fit);
  const byLabel = {};
  for (const r of rows) byLabel[r.pal] = (byLabel[r.pal] || 0) + 1;
  console.log(`  ${rows.length} balanced palette rows (${Object.keys(byLabel).length} classes) from ${fit.length} sprites`);
  console.log('  per class:', Object.entries(byLabel).map(([k, v]) => `${k}:${v}`).join(' '));
  const argmin = (errs) => errs.indexOf(Math.min(...errs));
  const counts = {};
  for (const r of fit) counts[PALETTES[argmin(r.err)].id] = (counts[PALETTES[argmin(r.err)].id] || 0) + 1;
  console.log('  best-fit label spread (majority baseline):', Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}:${v}`).join(' '));
}
console.log('done');
