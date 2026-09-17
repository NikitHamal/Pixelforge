/* Template catalogue: every registered template with its state/frame counts
   and the states it provides. Handy for writing accurate registry descriptions
   and for checking what a consumer can rely on.

   Usage:
     node scripts/info.js                 # summary line per template
     node scripts/info.js rpg_bard        # full state list for one template
     node scripts/info.js --cat Enemies   # only one category
*/
const { boot } = require('./lib-boot');
const PF = boot();

const [arg] = process.argv.slice(2);
const catIdx = process.argv.indexOf('--cat');
const cat = catIdx >= 0 ? process.argv[catIdx + 1] : null;

const list = PF.Library.list().filter(t => !cat || t.category === cat);

if (arg && arg !== '--cat' && !arg.startsWith('--')) {
  const s = PF.Library.docStats(arg);
  if (!s) { console.error('unknown template: ' + arg); process.exit(1); }
  const t = PF.Library.get(arg);
  console.log(`${t.id} — ${t.name} [${t.category}]`);
  console.log(`${s.width}x${s.height} · ${s.states} states · ${s.frames} frames`);
  console.log('states: ' + s.stateNames.join(' '));
  process.exit(0);
}

let totalFrames = 0, totalStates = 0;
const byCat = {};
for (const t of list) {
  const s = PF.Library.docStats(t.id);
  totalFrames += s.frames; totalStates += s.states;
  byCat[t.category] = (byCat[t.category] || 0) + 1;
  console.log(`${t.id.padEnd(22)} ${String(s.states).padStart(3)} st ${String(s.frames).padStart(4)} fr  ${t.category.padEnd(9)} ${t.name}`);
}
console.log('─'.repeat(72));
console.log(`${list.length} templates · ${totalStates} states · ${totalFrames} frames`);
console.log('by category: ' + Object.entries(byCat).map(([c, n]) => `${c} ${n}`).join(' · '));
