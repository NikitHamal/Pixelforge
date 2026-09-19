/* Nik1 gate integration for the PixelForge verification run.
 *
 * The Nik1 models live in nik1/ with their own gate (gradient checks, overfit
 * tests, cross-language parity, latency budgets). This wrapper runs the fast
 * profile from `node scripts/verify.js` and degrades honestly when the toolchain
 * it needs is missing — a checkout without python3 should not fail the pixel
 * gates, it should say what was skipped.
 *
 *   node scripts/check-nik1.js [--full]
 */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const GATE = path.join(ROOT, 'nik1', 'tools', 'nik1-gate.js');
const full = process.argv.includes('--full');

if (!fs.existsSync(GATE)) {
  console.log('nik1 gate not present in this checkout — skipped');
  process.exit(0);
}
const py = process.env.PYTHON || 'python3';
const hasPython = spawnSync(py, ['-c', 'import sys'], { encoding: 'utf8' }).status === 0;
if (!hasPython) {
  console.log(`python3 not found — running the JS-only Nik1 checks (set PYTHON=... to include the rest)`);
}

const args = [GATE, ...(full ? [] : ['--fast'])];
const r = spawnSync(process.execPath, args, { cwd: ROOT, encoding: 'utf8', timeout: (full ? 30 : 10) * 60 * 1000 });
const out = ((r.stdout || '') + (r.stderr || '')).trim();
const lines = out.split('\n').filter(Boolean);
for (const l of lines.slice(-14)) console.log(l);
process.exit(r.status === 0 ? 0 : 1);
