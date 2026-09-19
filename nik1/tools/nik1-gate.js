#!/usr/bin/env node
/* The Nik1 gate: one command that proves the model family is intact.
 *
 *   node nik1/tools/nik1-gate.js [--fast]
 *
 * Runs, in order:
 *   1. Python gradient checks        (hand-written backprop vs finite differences)
 *   2. Python overfit tests          (can the stack memorise 4 examples at all)
 *   3. JS runtime tests              (cross-language numeric parity + grammar)
 *   4. Python JS-parity test         (grammar/repair agreement both ways)
 *   5. budgets                       (file sizes, warm latency, model integrity)
 *
 * --fast skips the gradient and overfit suites (they need a few hundred training
 * steps) and keeps the runtime/parity/budget checks.
 */
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PY = process.env.PYTHON || 'python3';
const fast = process.argv.includes('--fast');
const node = process.execPath;

const steps = [
  ...(fast ? [] : [
    { name: 'python gradient checks', cmd: PY, args: [path.join(ROOT, 'tests', 'test_grad.py')] },
    { name: 'python overfit tests', cmd: PY, args: [path.join(ROOT, 'tests', 'test_overfit.py')], timeout: 15 * 60 * 1000 }
  ]),
  { name: 'js runtime + parity tests', cmd: node, args: [path.join(ROOT, 'tests', 'test_runtime.js')] },
  { name: 'python js-parity test', cmd: PY, args: [path.join(ROOT, 'tests', 'test_js_parity.py')] }
];

let failed = 0;
console.log('Nik1 gate\n' + '='.repeat(52));
for (const s of steps) {
  const r = spawnSync(s.cmd, s.args, { encoding: 'utf8', cwd: ROOT, timeout: s.timeout || 10 * 60 * 1000 });
  const okStep = r.status === 0;
  if (!okStep) failed++;
  console.log(`[${okStep ? 'PASS' : 'FAIL'}] ${s.name}`);
  const lines = ((r.stdout || '') + (r.stderr || '')).trim().split('\n').filter(Boolean);
  for (const l of lines.slice(-4)) console.log('       ' + l);
}

/* ---------- budgets and artefacts ---------- */
console.log('[....] budgets');
const MODELS = path.join(ROOT, 'js', 'models');
/* A model may ship whole or sharded (see split-model.js): the shard path exists
   because some publishing APIs cap a single request body at 128 KB, and a model
   you cannot publish is not shipped. Either form is acceptable here; what is not
   acceptable is shards that do not add up. */
const models = ['nik1-route', 'nik1-search', 'nik1-palette'];
const required = ['nik1-route.json', 'nik1-search.docs.f32', 'parity.json', 'eval.json', 'tools.json', 'templates.json'];
let budgetFail = 0;
const check = (cond, msg) => { console.log(`       ${cond ? 'ok  ' : 'FAIL'} ${msg}`); if (!cond) { budgetFail++; failed++; } };
for (const m of models) {
  const whole = fs.existsSync(path.join(MODELS, m + '.nik1'));
  const sharded = fs.existsSync(path.join(MODELS, m + '.nik1.parts.json'));
  check(whole || sharded, `${m}.nik1 present (${whole ? 'whole' : sharded ? 'sharded' : 'MISSING'})`);
}
for (const f of required) check(fs.existsSync(path.join(MODELS, f)), `${f} present`);

/* Shard integrity: every declared part present, under the publication limit, and
   the concatenation reproduces the manifest's byte count and sha256 exactly. */
const crypto = require('crypto');
for (const f of fs.readdirSync(MODELS).filter(f => f.endsWith('.parts.json'))) {
  const manifest = JSON.parse(fs.readFileSync(path.join(MODELS, f), 'utf8'));
  const parts = manifest.parts.map(p => path.join(MODELS, p.name));
  const missing = manifest.parts.filter(p => !fs.existsSync(path.join(MODELS, p.name)));
  check(!missing.length, `${manifest.file}: all ${manifest.parts.length} parts present`);
  if (missing.length) continue;
  const chunks = parts.map(p => fs.readFileSync(p));
  check(chunks.every(c => c.length < 100 * 1024), `${manifest.file}: every part under 100 KB (largest ${(Math.max(...chunks.map(c => c.length)) / 1024).toFixed(1)} KB)`);
  const buf = Buffer.concat(chunks);
  const sha = crypto.createHash('sha256').update(buf).digest('hex');
  check(buf.length === manifest.bytes && sha === manifest.sha256, `${manifest.file}: reassembles to ${manifest.bytes} B with matching sha256`);
  /* And the public path must still work: loading by name has to join the shards.
     Run in a child so this stays a synchronous gate. */
  const name = manifest.file.replace(/\.nik1$/, '');
  const prog = `const N=require(${JSON.stringify(path.join(ROOT, 'js', 'nik1.js'))});` +
    `N.loadModel(${JSON.stringify(name)},{baseUrl:${JSON.stringify(MODELS + path.sep)}})` +
    `.then(m=>console.log(m.bytes),e=>{console.error(e.message);process.exit(1)});`;
  const load = spawnSync(node, ['-e', prog], { encoding: 'utf8' });
  check(load.status === 0 && Number(load.stdout.trim()) === manifest.bytes,
    `${manifest.file}: loads through loadModel() sharded path (${load.status === 0 ? load.stdout.trim() + ' B' : (load.stderr || '').trim().split('\n').pop()})`);
}

const sizes = {};
for (const f of fs.readdirSync(MODELS)) {
  const p = path.join(MODELS, f);
  if (f.endsWith('.nik1')) sizes[f] = fs.statSync(p).size;
  // the JS reader must parse every shipped container
  if (f.endsWith('.nik1')) {
    try {
      const buf = fs.readFileSync(p);
      require(path.join(ROOT, 'js', 'nik1.js')).parseNik1(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
    } catch (e) { check(false, `${f} parses (${e.message})`); }
  }
}
for (const [f, b] of Object.entries(sizes)) check(b < 400 * 1024, `${f} under 400 KB (${(b / 1024).toFixed(1)} KB)`);

const evalJson = JSON.parse(fs.readFileSync(path.join(MODELS, 'eval.json'), 'utf8'));
check(evalJson.router.valid_call === 1.0, `router pipeline validity 1.0 (got ${evalJson.router.valid_call})`);
check(evalJson.router.exact_call >= 0.75, `router exact-call >= 0.75 (got ${evalJson.router.exact_call})`);
check(evalJson.search['any@1'] >= 0.7, `search any@1 >= 0.70 (got ${evalJson.search['any@1']})`);
check(evalJson.palette.accuracy >= 0.95, `palette accuracy >= 0.95 (got ${evalJson.palette.accuracy})`);

// warm latency from the bench (JSON mode) — a real end-to-end budget
const bench = spawnSync(node, [path.join(ROOT, 'js', 'bench.js'), '--json'], { encoding: 'utf8' });
if (bench.status === 0) {
  const rows = JSON.parse(bench.stdout).rows;
  const byName = Object.fromEntries(rows.map(r => [r.model, r]));
  check(byName['nik1-route'].warmMs < 120, `router warm < 120 ms (${byName['nik1-route'].warmMs} ms)`);
  check(byName['nik1-search'].warmMs < 60, `search warm < 60 ms (${byName['nik1-search'].warmMs} ms)`);
  check(byName['nik1-palette'].warmMs < 5, `palette warm < 5 ms (${byName['nik1-palette'].warmMs} ms)`);
  console.log(`       total weights on disk: ${(rows.reduce((n, r) => n + r.file, 0) / 1024).toFixed(1)} KB`);
} else {
  check(false, 'bench.js runs');
}

console.log('='.repeat(52));
if (failed) { console.log(`NIK1 GATE FAILED (${failed})`); process.exit(1); }
console.log('NIK1 GATE PASSED');
