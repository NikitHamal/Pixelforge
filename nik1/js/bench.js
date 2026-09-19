#!/usr/bin/env node
/* Nik1 benchmark: the numbers that matter for an on-device model.
 *
 * For each specialist: file size, resident weight memory, cold load time, and
 * warm latency for the actual task (not a synthetic matmul). Everything runs on
 * this CPU with no GPU and no framework — which is the point: if it is fast
 * here, it is fast on a phone.
 *
 *   node nik1/js/bench.js [--json]
 */
const fs = require('fs');
const path = require('path');
const Nik1 = require('./nik1.js');
const Grammar = require('./grammar.js');

const MODELS = path.join(__dirname, 'models');
const asJson = process.argv.includes('--json');
const time = (n, fn) => {
  fn(); // warm
  const t0 = process.hrtime.bigint();
  for (let i = 0; i < n; i++) fn();
  return Number(process.hrtime.bigint() - t0) / 1e6 / n;
};
const kb = b => (b / 1024).toFixed(1) + ' KB';

async function main() {
  const rows = [];
  const tools = JSON.parse(fs.readFileSync(path.join(MODELS, 'tools.json'), 'utf8'));

  /* ---- router ---- */
  {
    const t0 = process.hrtime.bigint();
    const model = await Nik1.loadModel('nik1-route', { baseUrl: MODELS + path.sep });
    model.setTools(tools);
    const loadMs = Number(process.hrtime.bigint() - t0) / 1e6;
    const mem = Object.keys(model.model.tok ? {} : {}).length; // placeholder, computed below
    const bytes = model.bytes;
    const utterances = ['give me the knight', 'export a gif at 4x', 'add a walk state at 8 fps', 'zoom to 8', 'undo'];
    let i = 0;
    const ms = time(20, () => {
      const u = utterances[i++ % utterances.length];
      const g = model.routeUtterance(u, Grammar, tools);
      if (!g.call) throw new Error('router returned no call');
    });
    // a single utterance, cold
    const one = (() => {
      const t1 = process.hrtime.bigint();
      const r = model.routeUtterance('make me a slime boss', Grammar, tools);
      return { ms: Number(process.hrtime.bigint() - t1) / 1e6, result: r };
    })();
    rows.push({
      model: 'nik1-route', task: 'utterance -> tool call', params: model.config.cfg.vocab,
      file: bytes, fileKb: kb(bytes),
      weightsRamKb: kb(sumTensors(model)),
      loadMs: +loadMs.toFixed(1), warmMs: +ms.toFixed(1),
      detail: `${one.result.source} ${JSON.stringify(one.result.call)}`
    });
  }

  /* ---- retrieval ---- */
  {
    const t0 = process.hrtime.bigint();
    const model = await Nik1.loadModel('nik1-search', {
      baseUrl: MODELS + path.sep, docTable: path.join(MODELS, 'nik1-search.docs.f32')
    });
    const loadMs = Number(process.hrtime.bigint() - t0) / 1e6;
    const queries = ['cute farm animal', 'dungeon tileset', 'space shooter', 'a boss for my game', 'walk cycle'];
    let i = 0;
    const ms = time(20, () => model.search(queries[i++ % queries.length], 5));
    const one = model.search('cute farm animal', 3);
    rows.push({
      model: 'nik1-search', task: 'brief -> top-5 assets', params: 0,
      file: model.bytes + model.docEmbeddings.count * model.docEmbeddings.dim * 4,
      fileKb: kb(model.bytes + model.docEmbeddings.count * model.docEmbeddings.dim * 4),
      weightsRamKb: kb(sumTensors(model)),
      loadMs: +loadMs.toFixed(1), warmMs: +ms.toFixed(2),
      detail: one.map(h => h.id).join(', ')
    });
  }

  /* ---- palette ---- */
  {
    const t0 = process.hrtime.bigint();
    const model = await Nik1.loadModel('nik1-palette', { baseUrl: MODELS + path.sep });
    const loadMs = Number(process.hrtime.bigint() - t0) / 1e6;
    const buf = new Uint32Array(64 * 64);
    let seed = 7;
    for (let i = 0; i < buf.length; i++) {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      buf[i] = seed % 5 === 0 ? 0 : (0xff000000 | ((seed & 0xff) | (((seed >> 8) & 0xff) << 8) | (((seed >> 16) & 0xff) << 16)));
    }
    const ms = time(200, () => model.classifySprite(buf));
    const one = model.classifySprite(buf);
    rows.push({
      model: 'nik1-palette', task: 'sprite -> palette family', params: 0,
      file: model.bytes, fileKb: kb(model.bytes), weightsRamKb: kb(sumTensors(model)),
      loadMs: +loadMs.toFixed(1), warmMs: +ms.toFixed(3),
      detail: `${one.label} (64x64 sprite, features included)`
    });
  }

  /* ---- grammar-only path (what runs when the model is not loaded yet) ---- */
  {
    const index = Grammar.loadTools(null, tools);
    const ms = time(2000, () => Grammar.route('export a gif', '{"tool":"export","args":{"format":"gif"}}', index));
    rows.push({
      model: 'grammar + fallback', task: 'validate / repair a call', params: 0,
      file: 0, fileKb: '0.0 KB', weightsRamKb: '0.0 KB',
      loadMs: 0, warmMs: +ms.toFixed(3), detail: 'no model needed'
    });
  }

  const totals = rows.reduce((acc, r) => { acc.file += r.file; return acc; }, { file: 0 });
  if (asJson) {
    console.log(JSON.stringify({ rows, totals, node: process.version, cpus: require('os').cpus().length }, null, 1));
    return;
  }
  console.log('Nik1 benchmark — on-device inference, no GPU, no framework\n');
  console.log('model                 task                        file     weights      load     warm');
  console.log('-'.repeat(96));
  for (const r of rows) {
    console.log(`${r.model.padEnd(21)} ${r.task.padEnd(27)} ${r.fileKb.padStart(8)} ${r.weightsRamKb.padStart(10)} ${(r.loadMs + ' ms').padStart(8)} ${(r.warmMs + ' ms').padStart(8)}`);
  }
  console.log('-'.repeat(96));
  console.log(`${'total on disk'.padEnd(49)} ${kb(totals.file).padStart(8)}`);
  console.log(`\nwarm detail:`);
  for (const r of rows) console.log(`  ${r.model.padEnd(21)} ${r.detail}`);
  console.log(`\nnode ${process.version} on ${require('os').cpus().length} vCPU — a 2015-era phone is a few times slower, a modern one comparable.`);
}

function sumTensors(model) {
  const W = model.model.tok ? null : null;
  const seen = new Set();
  let bytes = 0;
  const walk = obj => {
    if (!obj || typeof obj !== 'object') return;
    for (const k of Object.keys(obj)) {
      const v = obj[k];
      if (v instanceof Float32Array || v instanceof Int8Array || v instanceof Uint8Array) {
        if (!seen.has(v.buffer)) { seen.add(v.buffer); bytes += v.byteLength; }
      } else if (v && typeof v === 'object') walk(v);
    }
  };
  walk(model.model);
  return bytes;
}

main().catch(e => { console.error(e); process.exit(1); });
