#!/usr/bin/env node
/* Nik1 runtime tests: cross-language parity, tokenizer totality, grammar
   invariants, and a latency budget.
 *
 * The parity numbers come from `nik1/python/eval_pipeline.py`, which runs the
 * *quantized* artifacts in NumPy. Both sides therefore load the same bytes; a
 * divergence means the JS math or the container parser is wrong, not that the
 * model moved.
 *
 *   node nik1/tests/test_runtime.js [--bench]
 */
const fs = require('fs');
const path = require('path');
const Nik1 = require('../js/nik1.js');
const Grammar = require('../js/grammar.js');

const MODELS = path.join(__dirname, '..', 'js', 'models');
let pass = 0, fail = 0;
const ok = (c, msg) => { c ? pass++ : (fail++, console.log('FAIL: ' + msg)); };
const report = (label, value) => console.log(`  ${label.padEnd(34)} ${value}`);

const bench = process.argv.includes('--bench');
const fixtures = JSON.parse(fs.readFileSync(path.join(MODELS, 'parity.json'), 'utf8'));
const tolLogit = fixtures.tolerance.logit_abs;
const tolEmbed = fixtures.tolerance.embed_abs;

function maxAbsDiff(a, b) {
  let m = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i++) m = Math.max(m, Math.abs(a[i] - b[i]));
  return m;
}

(async () => {
  console.log('Nik1 runtime tests');

  /* ---------------- tokenizer ---------------- */
  {
    const cfg = JSON.parse(fs.readFileSync(path.join(MODELS, 'nik1-route.json'), 'utf8'));
    const tok = new Nik1.Tokenizer(cfg.tokenizer);
    const cases = ['give me the knight', 'export a gif', 'undo', 'set color to #ff0044', 'zoom to 8',
      'unseen emoji \u2728 and CJK \u4f60\u597d', '{"tool":"x","args":{}}'];
    let lossless = 0;
    for (const s of cases) {
      const ids = tok.encode(s);
      if (tok.decode(ids) === s.toLowerCase()) lossless++;
    }
    ok(lossless === cases.length, `tokenizer round-trips every case (${lossless}/${cases.length})`);
    // cross-language: Python wrote the ids for these prompts
    let idMatch = 0;
    for (const c of fixtures.models['nik1-route'].cases) {
      const ids = [tok.bos].concat(tok.encode('task: route\n' + c.text));
      if (JSON.stringify(ids) === JSON.stringify(c.ids)) idMatch++;
    }
    ok(idMatch === fixtures.models['nik1-route'].cases.length,
      `token ids match Python for all route cases (${idMatch})`);
    report('tokenizer vocab', tok.size);
  }

  /* ---------------- LM parity ---------------- */
  {
    const model = await Nik1.loadModel('nik1-route', { baseUrl: path.join(MODELS, path.sep) });
    let worst = 0, top1 = 0;
    for (const c of fixtures.models['nik1-route'].cases) {
      const logits = model.model.logits(c.ids);
      const arr = Array.from(logits);
      // compare the Python top-5 ids and their logits
      const pythonTop = c.expected_top5;
      worst = Math.max(worst, maxAbsDiff(pythonTop.map(t => arr[t]), c.expected_logits_top5));
      let best = 0;
      for (let i = 1; i < arr.length; i++) if (arr[i] > arr[best]) best = i;
      if (best === pythonTop[0]) top1++;
    }
    const n = fixtures.models['nik1-route'].cases.length;
    ok(top1 === n, `argmax matches Python on every route case (${top1}/${n})`);
    ok(worst < tolLogit, `logit parity within ${tolLogit} (worst ${worst.toExponential(2)})`);
    report('router file', `${(model.bytes / 1024).toFixed(1)} KB`);
    if (bench) {
      const t0 = process.hrtime.bigint();
      const N = 5;
      let tokens = 0;
      for (let i = 0; i < N; i++) {
        const out = model.model.generate('give me the knight', { maxNew: 32, maskFn: Grammar.routeMaskFn(model.tokenizer, null, model.config) });
        tokens += out.length;
      }
      const ms = Number(process.hrtime.bigint() - t0) / 1e6 / N;
      report('router generate (32 tok budget)', `${ms.toFixed(1)} ms  (${(tokens / N).toFixed(1)} tok avg)`);
      ok(ms < 500, `router answers inside the latency budget (${ms.toFixed(1)} ms)`);
    }
  }

  /* ---------------- encoder parity ---------------- */
  {
    const model = await Nik1.loadModel('nik1-search', { baseUrl: path.join(MODELS, path.sep), docTable: path.join(MODELS, 'nik1-search.docs.f32') });
    let worst = 0, normErr = 0;
    for (const c of fixtures.models['nik1-search'].cases) {
      const emb = model.model.embed(c.ids, model.tokenizer.pad);
      worst = Math.max(worst, maxAbsDiff(Array.from(emb).slice(0, 8), c.expected_embed));
      let norm = 0;
      for (const v of emb) norm += v * v;
      normErr = Math.max(normErr, Math.abs(Math.sqrt(norm) - c.expected_norm));
    }
    ok(worst < tolEmbed, `query embedding parity within ${tolEmbed} (worst ${worst.toExponential(2)})`);
    ok(normErr < 1e-3, `embedding norm is unit (worst |1-|v|| ${normErr.toExponential(2)})`);
    const first = model.docEmbeddings.data.slice(0, 8);
    ok(maxAbsDiff(Array.from(first), fixtures.models['nik1-search'].expected_first_doc_q0) < tolEmbed,
      'document table loads and matches the Python export');
    const hits = model.search('dungeon tileset', 3);
    ok(hits.length === 3 && hits[0].id && typeof hits[0].score === 'number', 'search returns ranked ids');
    report('search file', `${(model.bytes / 1024).toFixed(1)} KB + ${(model.docEmbeddings.count * model.docEmbeddings.dim * 4 / 1024).toFixed(1)} KB docs`);
    report('top-3 for "dungeon tileset"', hits.map(h => h.id).join(', '));
    if (bench) {
      const t0 = process.hrtime.bigint();
      for (let i = 0; i < 20; i++) model.search('cute farm animal', 5);
      report('search (encode + rank 106)', `${(Number(process.hrtime.bigint() - t0) / 1e6 / 20).toFixed(2)} ms`);
    }
  }

  /* ---------------- palette parity ---------------- */
  {
    const model = await Nik1.loadModel('nik1-palette', { baseUrl: path.join(MODELS, path.sep) });
    let worst = 0, agree = 0;
    for (const c of fixtures.models['nik1-palette'].cases) {
      const logits = model.model.forward(Float32Array.from(c.features));
      worst = Math.max(worst, maxAbsDiff(Array.from(logits), c.expected_logits));
      let best = 0;
      for (let i = 1; i < logits.length; i++) if (logits[i] > logits[best]) best = i;
      if (model.labels[best] === c.expected_label) agree++;
    }
    const n = fixtures.models['nik1-palette'].cases.length;
    ok(worst < tolLogit, `palette logit parity within ${tolLogit} (worst ${worst.toExponential(2)})`);
    ok(agree === n, `palette label matches Python (${agree}/${n})`);
    // the feature extractor must match the one that built the training data
    const buf = new Uint32Array(32 * 32);
    for (let i = 0; i < buf.length; i++) buf[i] = i % 3 === 0 ? 0 : (0xff000000 | ((i * 7) & 0xff) | (((i * 13) & 0xff) << 8) | (((i * 29) & 0xff) << 16));
    const f = Nik1.spriteFeatures(buf);
    ok(f.length === fixtures.models['nik1-palette'].cases[0].features.length,
      `sprite feature vector has the expected ${f.length} dims`);
    ok(f.every(v => v >= 0 && v <= 1.0001), 'sprite features are normalized to 0..1');
    report('palette file', `${(model.bytes / 1024).toFixed(1)} KB`);
    if (bench) {
      const t0 = process.hrtime.bigint();
      for (let i = 0; i < 2000; i++) model.classifySprite(buf);
      report('palette classify (incl. features)', `${(Number(process.hrtime.bigint() - t0) / 1e6 / 2000).toFixed(3)} ms`);
    }
  }

  /* ---------------- grammar ---------------- */
  {
    const tools = Grammar.loadTools(null, JSON.parse(fs.readFileSync(path.join(MODELS, 'tools.json'), 'utf8')));
    const catalog = Grammar.loadCatalog(JSON.parse(fs.readFileSync(path.join(MODELS, 'templates.json'), 'utf8')));
    const cases = [
      { raw: '{"tool":"load_template","args":{"id":"rpg_knight"}}', utt: 'give me the knight' },
      { raw: 'x{"tool":"export","args":{"format":"gif","scale":"4"}}y', utt: 'export a gif at 4x' },
      { raw: '{"tool":"load_template","args":{"id":"x","bogus":1,"open_studio":"yes"}', utt: 'open x' },
      { raw: '{"tool":"does_not_exist","args":{}}', utt: 'undo the last thing' },
      { raw: 'not json at all', utt: 'export a gif' },
      { raw: '{"name":"set_color","arguments":{"color":"ff0044"}}', utt: 'use color #ff0044' },
      { raw: '{"tool":"draw_rect","args":{"x":"3","y":"4","width":"600","height":2,"color":"red"}}', utt: 'draw a red rectangle at 3 4' },
      { raw: '{"tool":"set_view","args":{"zoom":"99999"}}', utt: 'zoom to 99999' }
    ];
    let valid = 0;
    const dump = [];
    for (const c of cases) {
      const res = Grammar.route(c.utt, c.raw, tools, catalog);
      const v = Grammar.validateCall(res.call, tools);
      valid += v.ok ? 1 : 0;
      ok(v.ok, `grammar route always valid: ${JSON.stringify(c.raw).slice(0, 40)}${v.ok ? '' : ' -> ' + JSON.stringify(v.errors)}`);
      dump.push({ raw: c.raw, utt: c.utt, call: res.call, source: res.source, notes: res.notes });
    }
    ok(valid === cases.length, `every malformed input becomes a valid call (${valid}/${cases.length})`);
    // unknown tool must never survive
    const bad = Grammar.route('x', '{"tool":"hack_the_planet","args":{}}', tools, catalog);
    ok(bad.call && tools[bad.call.tool], 'unknown tool names cannot survive the pipeline');
    fs.writeFileSync(path.join(MODELS, 'grammar_cases.json'), JSON.stringify(dump, null, 1));
    report('grammar cases written', 'js/models/grammar_cases.json');
  }

  console.log(`\nRUNTIME: ${pass} pass, ${fail} fail`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('threw:', e); process.exit(1); });
