/* One-shot verification gate. Run this before you call anything done.

   Steps: syntax -> sprite quality -> engine API -> pixel regression -> game wiring -> pages.

   Usage: node scripts/verify.js [--update-baseline]
*/
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const NODE = process.execPath;
const updateBaseline = process.argv.includes('--update-baseline');

/* ---------- step 1: every JS file parses ---------- */
function syntaxCheck() {
  const files = [];
  const walk = dir => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith('.js')) files.push(p);
    }
  };
  for (const d of ['js', 'app', 'games', 'scripts']) if (fs.existsSync(path.join(ROOT, d))) walk(path.join(ROOT, d));
  const bad = [];
  for (const f of files) {
    const r = spawnSync(NODE, ['--check', f], { encoding: 'utf8' });
    if (r.status !== 0) bad.push([f, (r.stderr || '').split('\n').slice(0, 4).join('\n')]);
  }
  return { name: `syntax (${files.length} files)`, code: bad.length ? 1 : 0, out: bad.map(([f, e]) => `${path.relative(ROOT, f)}\n${e}`).join('\n') };
}

/* ---------- steps that shell out to a script ---------- */
const run = (name, args) => {
  const r = spawnSync(NODE, args, { cwd: ROOT, encoding: 'utf8' });
  return { name, code: r.status ?? 1, out: (r.stdout || '') + (r.stderr || '') };
};

const STEPS = [
  syntaxCheck,
  () => run('sprite quality gate', ['scripts/check-rpg.js']),
  () => run('engine API contracts', ['scripts/check-engine-api.js']),
  () => updateBaseline
    ? run('pixel baseline updated', ['scripts/sprite-hash.js', 'save', 'scripts/hashes-baseline.json'])
    : run('pixel regression', ['scripts/sprite-hash.js', 'diff', 'scripts/hashes-baseline.json']),
  () => run('game wiring', ['scripts/check-game.js']),
  () => run('page integrity', ['scripts/check-pages.js'])
];

console.log('PixelForge verification\n' + '='.repeat(52));
const failed = [];
for (const step of STEPS) {
  const r = step();
  const tag = r.code === 0 ? 'PASS' : 'FAIL';
  console.log(`[${tag}] ${r.name}`);
  const lines = r.out.trim().split('\n').filter(Boolean);
  const tail = lines.slice(-3);
  for (const l of tail) console.log('       ' + l);
  if (r.code !== 0) failed.push(r.name);
}
console.log('='.repeat(52));
if (failed.length) {
  console.log(`FAILED: ${failed.join(', ')}`);
  process.exit(1);
}
console.log('ALL GATES PASSED');
