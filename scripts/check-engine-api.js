/* Public engine API contract checks: rendering, catalogue discovery and
   allocation-free palette variants. */
const { boot } = require('./lib-boot');
const PF = boot();
let pass = 0, fail = 0;
const ok = (condition, message) => { if (condition) pass++; else { fail++; console.log('FAIL:', message); } };

const sciFi = PF.Library.query({ text: 'sci-fi' });
ok(sciFi.length >= 6, 'cross-genre catalogue is searchable');
ok(PF.Library.query({ category: 'Heroes', tags: ['platformer'] }).some(t => t.id === 'platform_runner'), 'filters compose');
ok(PF.Library.query({ featured: true, width: 64 }).some(t => t.id === 'cyber_tiles'), 'dimension and featured filters compose');

const normal = PF.Library.render('nova_marine', { state: 'attack', frame: 2 });
ok(normal.width === 32 && normal.height === 32 && normal.state === 'attack' && normal.frame === 2, 'render metadata');
ok(normal.pixels.some(Boolean), 'render returns pixels');
const wrapped = PF.Library.render('nova_marine', { state: 'attack', frame: -1 });
ok(wrapped.frame === 4, 'negative frame wraps');

const source = PF.Color.hexToU32('#356b8c'), replacement = PF.Color.hexToU32('#ff00aa');
const target = new Uint32Array(32 * 32), scratch = new Uint32Array(32 * 32), variant = PF.Library.render('nova_marine', {
  state: 'idle', frame: 0, out: target, scratch, palette: { '#356b8c': '#ff00aa' }
});
ok(variant.pixels === target, 'caller-owned render buffer reused');
ok(scratch.some(Boolean), 'caller-owned scratch buffer reused');
ok(variant.pixels.includes(replacement) && !variant.pixels.includes(source), 'palette applied during render');

const compiled = PF.Raster.compilePalette([['#ff00aa', '#00ffaa']]);
const remapOut = new Uint32Array(target.length);
ok(PF.Raster.remapPalette(target, compiled, remapOut) === remapOut, 'compiled palette and output reused');
ok(remapOut.includes(PF.Color.hexToU32('#00ffaa')), 'compiled palette remaps pixels');
const transparent = new Uint32Array([0, replacement]);
PF.Raster.remapPalette(transparent, { transparent: '#ffffff', '#ff00aa': '#00ffaa' }, transparent);
ok(transparent[0] === 0, 'palette remap always preserves transparency');
let threw = false;
try { PF.Library.render('nova_marine', { state: 'missing' }); } catch (e) { threw = e instanceof RangeError; }
ok(threw, 'invalid state has actionable error');
threw = false;
try { PF.Library.render('nova_marine', { frame: 1.5 }); } catch (e) { threw = e instanceof RangeError; }
ok(threw, 'fractional frame has actionable error');

console.log(`ENGINE API: ${pass} pass, ${fail} fail`);
process.exit(fail ? 1 : 0);
