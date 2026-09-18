#!/usr/bin/env node
/* PixelForge command line.

   The studio is a browser app, but a game project needs its assets on disk,
   in CI, without a human clicking Export. This is that path: browse the
   catalogue, render any template to PNG / sheet / GIF, and emit the project
   file the target engine imports — all from the same pure painters the studio
   runs, so what lands in the repo is byte-identical to what the artist saw.

   Zero dependencies, zero install. `node bin/pixelforge.js --help`.
*/
'use strict';
const fs = require('fs');
const path = require('path');
const R = require('../scripts/render');
const PF = R.PF;

const ROOT = path.resolve(__dirname, '..');

/* --------------------------------------------------------------- argv */

/* Tiny flag parser. `--k v`, `--k=v` and `--flag` all work; anything else is
   positional. Deliberately not a dependency — the surface is six commands. */
function parseArgs(argv) {
  const flags = Object.create(null), rest = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) { rest.push(a); continue; }
    const eq = a.indexOf('=');
    if (eq > 0) { flags[a.slice(2, eq)] = a.slice(eq + 1); continue; }
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) flags[key] = true;
    else { flags[key] = next; i++; }
  }
  return { flags, rest };
}

const num = (v, d) => (v === undefined || v === true ? d : Number(v));
const safe = s => String(s || 'sprite').replace(/[^a-z0-9_-]+/gi, '_').toLowerCase();

function out(flags, fallback) {
  const dir = path.resolve(flags.out === undefined || flags.out === true ? fallback : String(flags.out));
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

let wrote = 0;
function write(dir, file, data) {
  const p = path.join(dir, file);
  fs.writeFileSync(p, data);
  wrote++;
  console.log(`  ${path.relative(process.cwd(), p)}  ${(data.length / 1024).toFixed(1)} KB`);
  return p;
}

const die = msg => { console.error(`pixelforge: ${msg}`); process.exit(1); };

/* ------------------------------------------------------------ commands */

function cmdList(flags, rest) {
  let list = PF.Library.list();
  const q = (rest[0] || '').toLowerCase();
  if (flags.category) list = list.filter(t => t.category.toLowerCase() === String(flags.category).toLowerCase());
  if (flags.tag) list = list.filter(t => (t.tags || []).some(g => g.toLowerCase() === String(flags.tag).toLowerCase()));
  if (flags.featured) list = list.filter(t => t.featured);
  if (q) list = list.filter(t =>
    t.id.toLowerCase().includes(q) || t.name.toLowerCase().includes(q) ||
    (t.desc || '').toLowerCase().includes(q) || (t.tags || []).some(g => g.toLowerCase().includes(q)));

  if (flags.json) { console.log(JSON.stringify(list.map(t => ({ id: t.id, name: t.name, category: t.category, tags: t.tags, desc: t.desc })), null, 2)); return; }
  if (!list.length) { console.log('No templates matched.'); return; }

  const w = Math.max(...list.map(t => t.id.length));
  let cat = '';
  for (const t of list) {
    if (t.category !== cat) { cat = t.category; console.log(`\n${cat}`); }
    console.log(`  ${t.id.padEnd(w)}  ${t.name}`);
  }
  console.log(`\n${list.length} template${list.length === 1 ? '' : 's'}${list.length === PF.Library.list().length ? '' : ` of ${PF.Library.list().length}`}.`);
}

function cmdInfo(flags, rest) {
  const id = rest[0];
  if (!id) die('info needs a template id — try `pixelforge list`');
  const meta = R.info(R.build(id));
  if (flags.json) { console.log(JSON.stringify(meta, null, 2)); return; }
  console.log(`${meta.id}  ${meta.name}`);
  console.log(`  ${meta.category} · ${meta.width}x${meta.height} · ${meta.states.length} states · ${meta.frames} frames`);
  if (meta.tags.length) console.log(`  tags: ${meta.tags.join(', ')}`);
  if (meta.description) console.log(`  ${meta.description}`);
  console.log('');
  const w = Math.max(...meta.states.map(s => s.name.length));
  for (const s of meta.states)
    console.log(`  ${s.name.padEnd(w)}  ${String(s.frames).padStart(2)} frames  ${String(s.fps).padStart(2)} fps  ${s.loop ? 'loop' : 'once'}  ${s.durationMs}ms`);
}

/* Formats are additive: `--format png,gif,godot4` writes all three from one
   render pass rather than rebuilding the document per target. */
const IMAGE_FORMATS = new Set(['png', 'frames', 'gif']);

const extOf = id => {
  const t = PF.Exporters.TARGETS.find(x => x.id === id);
  return t ? t.ext : id;
};

/* Three targets emit `.json` (phaser-atlas, aseprite, frames) and two emit
   `.tres` (godot4, godot-tileset), so `--format phaser-atlas,aseprite` would
   silently have one overwrite the other. Disambiguate by folding the target id
   into the name, but ONLY when the run actually requests a colliding pair —
   otherwise every single-target export would grow a name no importer expects.
   Unity is the reason this matters: its meta file must sit beside the sheet as
   exactly `<image>.png.meta` or Unity ignores it. */
function fileNamer(formats) {
  const seen = Object.create(null);
  for (const f of formats) if (!IMAGE_FORMATS.has(f)) seen[extOf(f)] = (seen[extOf(f)] || 0) + 1;
  return (name, f) => (seen[extOf(f)] > 1 ? `${name}.${f}.${extOf(f)}` : `${name}.${extOf(f)}`);
}

function exportOne(id, dir, opts) {
  const doc = R.build(id);
  const scale = opts.scale, state = opts.state, name = safe(id);
  const formats = opts.formats;

  // Anything that is not png/frames/gif is an engine target, and every engine
  // target needs the atlas — so the sheet is rendered once and shared.
  const needsSheet = formats.some(f => !IMAGE_FORMATS.has(f) || f === 'png');
  let packed = null;
  if (needsSheet) packed = R.sheetPNG(doc, { scale, state, columns: opts.columns, padding: opts.padding });
  const fileName = opts.fileName || fileNamer(formats);

  for (const f of formats) {
    if (f === 'png') { write(dir, `${name}.png`, packed.png); continue; }
    if (f === 'frames') {
      for (const s of R.states(doc, state))
        s.frames.forEach((fr, i) => {
          const px = R.framePixels(doc, fr, scale);
          write(dir, `${name}_${safe(s.name)}_${String(i).padStart(2, '0')}.png`, R.toPNG(px, doc.width * scale, doc.height * scale));
        });
      continue;
    }
    if (f === 'gif') {
      const sel = state ? [state] : doc.states.map(s => s.name);
      for (const sn of sel) {
        const g = R.gif(doc, { scale, state: sn });
        write(dir, `${name}_${safe(g.state)}.gif`, g.bytes);
      }
      continue;
    }
    const res = PF.Exporters.run(f, packed.atlas, opts);
    write(dir, fileName(name, f), Buffer.from(res.text, 'utf8'));
  }
}

function resolveFormats(flags) {
  const raw = flags.format === undefined || flags.format === true ? 'png' : String(flags.format);
  const known = new Set([...IMAGE_FORMATS, ...PF.Exporters.TARGETS.map(t => t.id)]);
  const list = raw.split(',').map(s => s.trim()).filter(Boolean);
  for (const f of list) if (!known.has(f)) die(`unknown format "${f}". Known: ${[...known].join(', ')}`);
  return list;
}

function cmdExport(flags, rest) {
  if (!rest.length) die('export needs at least one template id');
  const opts = {
    scale: num(flags.scale, 1),
    state: flags.state === true ? undefined : flags.state,
    columns: flags.columns === undefined ? undefined : num(flags.columns, undefined),
    padding: num(flags.padding, 0),
    formats: resolveFormats(flags)
  };
  if (!(opts.scale >= 1)) die('--scale must be 1 or more');
  const dir = out(flags, 'pixelforge-out');
  for (const id of rest) exportOne(id, dir, opts);
  console.log(`\n${wrote} file${wrote === 1 ? '' : 's'} -> ${path.relative(process.cwd(), dir) || '.'}`);
}

function cmdPack(flags, rest) {
  let ids = rest;
  if (flags.all) ids = PF.Library.list().map(t => t.id);
  else if (flags.category) ids = PF.Library.list().filter(t => t.category.toLowerCase() === String(flags.category).toLowerCase()).map(t => t.id);
  else if (flags.tag) ids = PF.Library.list().filter(t => (t.tags || []).some(g => g.toLowerCase() === String(flags.tag).toLowerCase())).map(t => t.id);
  if (!ids.length) die('pack needs ids, or --all / --category X / --tag Y');

  const opts = {
    scale: num(flags.scale, 1),
    state: flags.state === true ? undefined : flags.state,
    columns: flags.columns === undefined ? undefined : num(flags.columns, undefined),
    padding: num(flags.padding, 0),
    formats: resolveFormats(flags)
  };
  const dir = out(flags, 'pixelforge-pack');
  const manifest = [];
  for (const id of ids) {
    // One bad template must not abandon a 160-asset pack half-written.
    try { exportOne(id, dir, opts); manifest.push(R.info(R.build(id))); }
    catch (e) { console.error(`  ! ${id}: ${e.message}`); }
  }
  write(dir, 'manifest.json', Buffer.from(JSON.stringify({
    generator: 'pixelforge', version: require('../package.json').version,
    scale: opts.scale, formats: opts.formats, count: manifest.length, templates: manifest
  }, null, 2), 'utf8'));
  console.log(`\n${wrote} file${wrote === 1 ? '' : 's'} -> ${path.relative(process.cwd(), dir) || '.'}`);
}

function cmdVerify() {
  const { spawnSync } = require('child_process');
  const r = spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'verify.js')], { stdio: 'inherit' });
  process.exit(r.status === null ? 1 : r.status);
}

function cmdServe(flags, rest) {
  const port = String(num(flags.port, Number(rest[0]) || 5173));
  require('child_process').spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'serve.js'), port], { stdio: 'inherit' });
}

/* ---------------------------------------------------------------- help */

function help() {
  const targets = PF.Exporters.TARGETS.map(t => t.id).join(', ');
  console.log(`pixelforge — procedural pixel-art assets from the command line

USAGE
  pixelforge <command> [options]

COMMANDS
  list [query]              Browse the catalogue
      --category <name>       Heroes, NPCs, Enemies, Animals, World, Items, UI, FX
      --tag <tag>             filter by tag
      --featured              only featured templates
      --json                  machine-readable

  info <id>                 States, frame counts, timings for one template
      --json

  export <id...>            Render templates to disk
      --out <dir>             output directory (default ./pixelforge-out)
      --format <list>         comma separated (default png)
      --scale <n>             integer nearest-neighbour upscale (default 1)
      --state <name>          only this animation state
      --columns <n>           frames per sheet row (default: longest state)
      --padding <n>           px between frames on the sheet

  pack [id...]              Bulk export plus a manifest.json
      --all | --category <name> | --tag <tag>
      (all export options apply)

  verify                    Run the full gate suite
  serve [--port n]          Dev server for the studio and demo game

FORMATS
  png       packed sprite sheet
  frames    one PNG per frame
  gif       animated GIF per state
  ${targets}

EXAMPLES
  pixelforge list --category Heroes
  pixelforge info farm_farmer
  pixelforge export rpg_knight --format png,gif --scale 4 --out ./assets
  pixelforge export farm_tiles --format png,godot-tileset --out ./assets
  pixelforge pack --category Enemies --format png,phaser-atlas --out ./assets/enemies
`);
}

/* ---------------------------------------------------------------- main */

function main() {
  const argv = process.argv.slice(2);
  const { flags, rest } = parseArgs(argv);
  const cmd = rest.shift();

  if (flags.version) { console.log(require('../package.json').version); return; }
  if (!cmd || cmd === 'help' || flags.help) { help(); return; }

  const table = { list: cmdList, ls: cmdList, info: cmdInfo, show: cmdInfo, export: cmdExport, pack: cmdPack, verify: cmdVerify, serve: cmdServe };
  const fn = table[cmd];
  if (!fn) die(`unknown command "${cmd}". Run \`pixelforge --help\`.`);
  fn(flags, rest);
}

try { main(); }
catch (e) { die(e.message); }
