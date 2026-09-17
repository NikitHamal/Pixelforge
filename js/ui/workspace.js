/* PixelForge Workspace — routes, template library, seeded projects and asset kits.
   The catalog is deliberately data-first: the same asset metadata powers cards, previews and studio state creation. */
(() => {
  const q = (s, r = document) => r.querySelector(s);
  const qa = (s, r = document) => [...r.querySelectorAll(s)];
  const suite = (type = 'character') => type === 'character'
    ? [['idle', 4, 6], ['walk', 6, 10], ['run', 6, 12], ['jump', 4, 10], ['fall', 2, 8], ['land', 3, 12], ['attack', 5, 12], ['attack-2', 6, 14], ['use-sword', 6, 12], ['use-pickaxe', 6, 10], ['hurt', 2, 8], ['death', 6, 8], ['block', 2, 6], ['cast', 5, 10], ['eat', 5, 8], ['sleep', 4, 6], ['walk-up', 6, 10], ['walk-down', 6, 10], ['walk-left', 6, 10], ['walk-right', 6, 10]]
    : type === 'creature'
      ? [['idle', 4, 6], ['walk', 6, 10], ['run', 6, 12], ['attack', 5, 12], ['hurt', 2, 8], ['death', 6, 8], ['eat', 5, 7], ['sleep', 4, 6], ['spawn', 5, 10], ['hit-react', 3, 10], ['walk-up', 6, 10], ['walk-down', 6, 10], ['walk-left', 6, 10], ['walk-right', 6, 10]]
      : [['idle', 4, 6], ['use', 5, 10], ['open', 5, 10], ['hit', 4, 12], ['break', 6, 10], ['glow', 4, 6], ['pickup', 3, 8]];

  const assets = [
    { id: 'ember-knight', name: 'Ember Knight', category: 'characters', type: 'character', accent: '#6c4cff', description: 'Male armored melee hero for dungeon crawlers.', palette: ['#262b44','#e4a672','#e43b44','#f7c65b'], rows: ['................','......HH.......','.....HHHH......','.....SSSS......','....SEESSS.....','....SSSSSS.....','.....SSSS......','....RRRRRR.....','...BRRRRRRB....','...RRRRRRRR....','....RRRRRR.....','.....BB.......','....B..B......','...B....B.....','..BB....BB....','................'], legend: {H:'#733e39',S:'#e4a672',E:'#181425',R:'#e43b44',B:'#262b44'} },
    { id: 'meadow-ranger', name: 'Meadow Ranger', category: 'characters', type: 'character', accent: '#22a782', description: 'Female agile archer with a full direction set.', palette: ['#193c3e','#63c74d','#e4a672','#d77643'], rows: ['................','......HH.......','.....HHHH......','....HSSSSH.....','....SEESSS.....','.....SSSS......','....GGGGGG.....','...GGGGGGGG....','...GGGGGGG.....','....GGGG.......','.....PP.......','....P..P......','...P....P.....','..P......P....','................','................'], legend: {H:'#b86f50',S:'#e4a672',E:'#181425',G:'#3e8948',P:'#193c3e'} },
    { id: 'arcane-witch', name: 'Arcane Witch', category: 'characters', type: 'character', accent: '#b55088', description: 'Spellcaster kit with cast and hurt poses.', palette: ['#68386c','#b55088','#fee761','#c0cbdc'], rows: ['................','.....HHHH.....','....HHHHHH....','...HHHHHHHH...','....SSSSSS....','....SEESSS....','.....SSSS.....','....PPPPPP....','...PPPPPPPP...','...PPPPPPPP...','....PPPP......','.....P........','....P.P.......','...P...P......','................','................'], legend: {H:'#68386c',S:'#e4a672',E:'#181425',P:'#b55088'} },
    { id: 'camp-survivor', name: 'Camp Survivor', category: 'characters', type: 'character', accent: '#e58b44', description: 'Rugged survival character with tools and needs.', palette: ['#3a4466','#d77643','#e4a672','#63c74d'], rows: ['................','.....HHHH.....','....HHHHHH....','....HSSSSH....','....SEESSS....','.....SSSS.....','....DDDDDD....','...DDDDDDDD...','...DDDDDDDD...','....DDDD......','....BB........','...B..B.......','..B....B......','................','................','................'], legend: {H:'#d77643',S:'#e4a672',E:'#181425',D:'#3a4466',B:'#262b44'} },
    { id: 'forest-slime', name: 'Forest Slime', category: 'creatures', type: 'creature', accent: '#63c74d', description: 'Squash-and-stretch companion or enemy.', palette: ['#265c42','#3e8948','#63c74d','#a8f28a'], rows: ['................','................','.....GGGG.....','...GGGGGGGG...','..GGLLGGGGGG..','.GGLWWGGGGGGG.','.GGGGGOOGGOOG.','.GGGGGOOGGOOG.','GGGGGGGGGGGGGG','.DDDDDDDDDDDDDD','................','................','................','................','................','................'], legend: {G:'#63c74d',L:'#a8f28a',W:'#ffffff',O:'#265c42',D:'#3e8948'} },
    { id: 'bone-walker', name: 'Bone Walker', category: 'creatures', type: 'creature', accent: '#d5d4cb', description: 'Undead foe with readable combat silhouettes.', palette: ['#181425','#ead4aa','#8b9bb4','#a22633'], rows: ['................','.....WWWW.....','....WWWWWW....','....WEEWW.....','.....WWWW.....','...BBBBBBBB...','....BBBBBB....','....BBBBBB....','....BB..BB....','....BB..BB....','...BB....BB...','..BB......BB..','................','................','................','................'], legend: {W:'#ead4aa',E:'#181425',B:'#8b9bb4'} },
    { id: 'cave-bat', name: 'Cave Bat', category: 'creatures', type: 'creature', accent: '#6d5acb', description: 'Flying creature with takeoff and hit states.', palette: ['#262b44','#68386c','#b55088','#181425'], rows: ['................','................','B..........B..','BB........BB..','.BBBBBBBBBBBB.','..BBBBBBBBBB..','...BWWBBWWB...','....BBBBBB....','.....BBBB.....','......BB......','................','................','................','................','................','................'], legend: {B:'#262b44',W:'#ffffff'} },
    { id: 'dire-wolf', name: 'Dire Wolf', category: 'creatures', type: 'creature', accent: '#55728e', description: 'Four-direction beast for survival worlds.', palette: ['#3a4466','#8b9bb4','#e4a672','#181425'], rows: ['................','................','....WW.........','...WWWW........','..WSSWWWW......','..WSSSWWWW.....','.WWWWWWWWWW....','..BBBBBBBB.....','...BB..BB......','..BB....BB.....','................','................','................','................','................','................'], legend: {W:'#8b9bb4',S:'#e4a672',B:'#3a4466'} },
    { id: 'campfire', name: 'Campfire', category: 'props', type: 'prop', accent: '#f77622', description: 'Warm survival prop with glow and extinguish.', palette: ['#733e39','#f77622','#fee761','#e43b44'], rows: ['................','................','......Y.......','.....YYR......','.....YOR......','....YOOYR.....','....OOOOR.....','...RRRRRRR....','..RBRBRBRB....','...BBBBBBB....','................','................','................','................','................','................'], legend: {Y:'#fee761',O:'#f77622',R:'#e43b44',B:'#733e39'} },
    { id: 'iron-chest', name: 'Iron Chest', category: 'props', type: 'prop', accent: '#e6a844', description: 'Loot container with open, hit and break states.', palette: ['#3a4466','#8b9bb4','#feae34','#181425'], rows: ['................','................','...SSSSSSSS...','..SBBBBBBSS...','..SBBBBBBBS...','..SBBYYBBBS...','..SBBBBBBBS...','..SSSSSSSSS...','...SSSSSSS....','...SSSSSSS....','................','................','................','................','................','................'], legend: {S:'#8b9bb4',B:'#3a4466',Y:'#feae34'} },
    { id: 'ore-vein', name: 'Moon Ore Vein', category: 'environment', type: 'prop', accent: '#2ce8f5', description: 'Mineable resource with hit and break suite.', palette: ['#193c3e','#2ce8f5','#0099db','#c0cbdc'], rows: ['................','................','....BBBB......','...BBBBBB.....','..BBBBBBBB....','..BBCCBBBC....','.BBBCCCCBBB...','..BBBBBBBB....','...BBBBBB.....','....BBBB......','................','................','................','................','................','................'], legend: {B:'#193c3e',C:'#2ce8f5'} },
    { id: 'pine-tree', name: 'Pine Tree', category: 'environment', type: 'prop', accent: '#3e8948', description: 'Forest tile prop with sway and chop states.', palette: ['#265c42','#3e8948','#63c74d','#be4a2f'], rows: ['................','.......G......','......GGG.....','.....GGGGG....','....GGGGGGG...','...GGGGGGGGG..','....GGGGGGG...','...GGGGGGGGG..','..GGGGGGGGGGG.','......TT......','......TT......','.....TTTT.....','................','................','................','................'], legend: {G:'#3e8948',T:'#be4a2f'} }
  ];
  assets.push({ id: 'rogue-scout', name: 'Rogue Scout', category: 'characters', type: 'character', accent: '#e43b44', description: 'Stealth-focused rogue with dagger and dodge poses.', palette: ['#181425','#733e39','#b55088','#e4a672'], rows: ['................','.....HHHH.....','....HHHHHH....','....HSSSSH....','....SEESSS....','.....SSSS.....','....PPPPPP....','...PPPPPPPP...','....PPPPPP.....','....PP..PP....','...PP....PP...','..BB......BB..','................','................','................','................'], legend: {H:'#733e39',S:'#e4a672',E:'#181425',P:'#b55088',B:'#181425'} });
  assets.forEach(a => { a.suite = suite(a.type === 'prop' ? 'prop' : a.type); });
  const byId = id => assets.find(a => a.id === id) || assets[0];
  const projects = [
    { name: 'Ember Knight Kit', asset: 'ember-knight', meta: '20 states · 124 frames', time: 'Edited 2h ago' },
    { name: 'Forest Survival', asset: 'forest-slime', meta: '38 states · 212 frames', time: 'Edited yesterday' },
    { name: 'Meadow Ranger', asset: 'meadow-ranger', meta: '20 states · 120 frames', time: 'Edited Sep 14' },
    { name: 'Moonlit Ruins', asset: 'bone-walker', meta: '14 states · 76 frames', time: 'Edited Sep 11' },
    { name: 'Camp Props Vol. 01', asset: 'campfire', meta: '21 states · 64 frames', time: 'Edited Sep 08' },
    { name: 'Cave Encounters', asset: 'cave-bat', meta: '28 states · 148 frames', time: 'Edited Sep 03' }
  ];
  let activeFilter = 'all';

  function paintPreview(canvas, asset, frame = 0) {
    if (!canvas) return;
    const W = 16, H = 16, ctx = canvas.getContext('2d'); canvas.width = W; canvas.height = H; ctx.clearRect(0, 0, W, H); ctx.imageSmoothingEnabled = false;
    const map = {}; Object.entries(asset.legend).forEach(([k, v]) => map[k] = v);
    const bob = asset.type === 'character' || asset.type === 'creature' ? ((frame % 4 === 1) ? 1 : (frame % 4 === 3 ? -1 : 0)) : 0;
    asset.rows.forEach((row, y) => [...row].forEach((char, x) => { if (map[char]) { const xx = x + (asset.type === 'creature' && frame % 6 === 2 ? 1 : 0); if (xx >= 0 && xx < W && y + bob >= 0 && y + bob < H) { ctx.fillStyle = map[char]; ctx.fillRect(xx, y + bob, 1, 1); } } }));
    if (asset.type === 'character' || asset.type === 'creature') { ctx.fillStyle = 'rgba(24,20,37,.25)'; ctx.fillRect(3, 14, 10, 1); }
  }
  function canvasFor(asset, cls = '') { const c = document.createElement('canvas'); c.className = cls; paintPreview(c, asset, Math.floor(Math.random() * 4)); return c; }
  function renderProjectCard(p, compact = false) {
    const a = byId(p.asset), card = document.createElement('article'); card.className = compact ? 'project-card project-card--compact' : 'project-card'; card.dataset.asset = a.id;
    const visual = document.createElement('div'); visual.className = 'project-card__preview'; visual.appendChild(canvasFor(a));
    const foot = document.createElement('div'); foot.className = 'project-card__foot'; foot.innerHTML = `<div><strong class="project-card__title">${p.name}</strong><p class="project-card__meta">${p.meta}</p></div><span class="project-card__time">${p.time}</span>`;
    card.append(visual, foot); card.addEventListener('click', () => openAsset(a)); return card;
  }
  function renderProjects() {
    const dash = q('#dashboard-projects'), list = q('#project-list');
    if (dash) { dash.innerHTML = ''; projects.slice(0, 3).forEach(p => dash.appendChild(renderProjectCard(p, true))); }
    if (list) { const term = (q('#project-search')?.value || '').toLowerCase(); list.innerHTML = ''; projects.filter(p => p.name.toLowerCase().includes(term)).forEach(p => list.appendChild(renderProjectCard(p))); }
  }
  function renderMiniTemplates() {
    const root = q('#dashboard-templates'); if (!root) return; root.innerHTML = '';
    [assets[0], assets[4], assets[8], assets[10]].forEach(a => { const el = document.createElement('article'); el.className = 'mini-template'; el.innerHTML = `<span class="asset-tag">${a.category.toUpperCase()}</span>`; el.append(canvasFor(a)); el.insertAdjacentHTML('beforeend', `<strong>${a.name}</strong><span>${a.suite.length} states included</span>`); el.addEventListener('click', () => openAsset(a)); root.appendChild(el); });
  }
  function renderTemplates() {
    const root = q('#template-grid'); if (!root) return; const term = (q('#template-search')?.value || '').toLowerCase();
    const found = assets.filter(a => (activeFilter === 'all' || a.category === activeFilter) && (!term || `${a.name} ${a.description} ${a.category}`.toLowerCase().includes(term)));
    root.innerHTML = ''; q('#template-count').textContent = `${found.length} asset${found.length === 1 ? '' : 's'}`;
    found.forEach(a => {
      const card = document.createElement('article'); card.className = 'template-card';
      const visual = document.createElement('div'); visual.className = 'template-card__visual'; visual.style.setProperty('--asset-accent', a.accent); visual.appendChild(canvasFor(a));
      const badge = document.createElement('span'); badge.className = 'template-card__badge'; badge.textContent = a.category === 'characters' ? 'CHARACTER KIT' : a.category.toUpperCase(); visual.appendChild(badge);
      const heart = document.createElement('button'); heart.className = 'template-card__heart'; heart.setAttribute('aria-label', `Favorite ${a.name}`); heart.innerHTML = '<span class="ms ms--sm">favorite_border</span>'; heart.addEventListener('click', e => { e.stopPropagation(); heart.innerHTML = '<span class="ms ms--fill ms--sm">favorite</span>'; heart.style.color = 'var(--coral)'; }); visual.appendChild(heart);
      const body = document.createElement('div'); body.className = 'template-card__body'; body.innerHTML = `<div class="template-card__name"><strong>${a.name}</strong><span class="ms">arrow_outward</span></div><p>${a.description}</p><div class="template-card__tags"><span class="asset-tag">${a.suite.length} STATES</span><span class="asset-tag">${a.suite.reduce((n, s) => n + s[1], 0)} FRAMES</span><span class="asset-tag">16×16</span></div><button class="template-card__action">Use this kit <span class="ms ms--sm">arrow_forward</span></button>`;
      body.querySelector('.template-card__action').addEventListener('click', e => { e.stopPropagation(); openAsset(a); }); card.append(visual, body); card.addEventListener('click', () => openAsset(a)); root.appendChild(card);
    });
  }
  function buildAssetInStore(asset) {
    const S = PF.Store;
    S.newDoc({ width: 32, height: 32, name: asset.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') });
    S.transact(d => {
      d.states[0].name = 'idle'; d.states[0].fps = 6; d.states[0].frames[0].duration = 166;
      const id = d.layers[0].id, p = d.states[0].frames[0].pixels[id]; p.fill(0); PF.Raster.paintRows(p, d.width, d.height, asset.rows, asset.legend, 8, 8);
    });
    for (let i = 1; i < asset.suite[0][1]; i++) S.addFrame({ duplicate: true });
    // Build the full suite from a deterministic source frame, then add tiny readable pose offsets.
    // This keeps every generated frame editable while making the timeline feel alive immediately.
    asset.suite.slice(1).forEach(([name, frames, fps]) => S.addState({ name, fps, frames }));
    S.transact(d => {
      const source = d.states[0].frames[0].pixels;
      d.states.slice(1).forEach(st => st.frames.forEach(fr => Object.keys(fr.pixels).forEach(id => fr.pixels[id].set(source[id]))));
      d.states.forEach(st => st.frames.forEach((fr, fi) => {
      const n = st.name, step = fi % 4 === 1 ? 1 : (fi % 4 === 3 ? -1 : 0);
      let dx = 0, dy = 0;
      if (/walk|run|attack|use-|cast/.test(n)) dx = step;
      if (/jump|fall|land/.test(n)) dy = fi % 2 ? -1 : 0;
      if (/hurt|hit-react/.test(n)) dx = fi % 2 ? -1 : 1;
      if (/death|sleep/.test(n)) dy = Math.min(2, Math.floor(fi / 2));
      if (/open|break/.test(n)) dy = fi % 2 ? 1 : 0;
      if (dx || dy) Object.keys(fr.pixels).forEach(id => { fr.pixels[id] = PF.Raster.shift(fr.pixels[id], d.width, d.height, dx, dy); });
      }));
    });
    S.setActive({ state: 0, frame: 0 });
  }
  function openAsset(asset) {
    buildAssetInStore(asset); localStorage.setItem('pf-last-asset', asset.id); q('#studio-project-title').textContent = asset.name; location.hash = 'studio';
    setTimeout(() => { PF.Renderer.fit(); PF.UI.toast(`${asset.name} kit opened · ${asset.suite.length} animation states ready`); }, 80);
  }
  function route() {
    let name = (location.hash || '#dashboard').slice(1).split('?')[0]; if (!['dashboard', 'templates', 'projects', 'studio'].includes(name)) name = 'dashboard';
    qa('[data-page]').forEach(p => p.classList.toggle('is-active', p.dataset.page === name));
    qa('.workspace-nav [data-route]').forEach(a => a.classList.toggle('is-active', a.dataset.route === name));
    document.body.classList.toggle('is-studio-route', name === 'studio');
    if (name === 'studio') setTimeout(() => PF.Renderer.fit(), 25);
    window.scrollTo({ top: 0, behavior: 'auto' });
  }
  function initActions() {
    qa('[data-route-action]').forEach(b => b.addEventListener('click', () => {
      if (b.dataset.routeAction === 'studio' && localStorage.getItem('pf-last-asset')) openAsset(byId(localStorage.getItem('pf-last-asset')));
      else location.hash = b.dataset.routeAction;
    }));
    qa('[data-action="new-project"]').forEach(b => b.addEventListener('click', () => { q('#new-name').value = 'new-sprite'; q('#dlg-new').showModal(); }));
    q('#studio-export-action')?.addEventListener('click', () => q('#dlg-export').showModal());
    q('[data-action="rename-project"]')?.addEventListener('click', () => { const current = q('#studio-project-title').textContent; const value = prompt('Project name', current); if (value?.trim()) { q('#studio-project-title').textContent = value.trim(); q('#doc-name').value = value.trim().toLowerCase().replace(/\s+/g, '-'); PF.Store.rename(q('#doc-name').value); PF.UI.toast('Project renamed'); } });
    q('#new-create')?.addEventListener('click', () => setTimeout(() => { q('#studio-project-title').textContent = q('#doc-name').value || 'new-sprite'; location.hash = 'studio'; }, 20));
    q('#global-search')?.addEventListener('input', e => { if (e.target.value.trim()) { location.hash = 'templates'; q('#template-search').value = e.target.value; renderTemplates(); } });
    q('#template-search')?.addEventListener('input', renderTemplates); q('#project-search')?.addEventListener('input', renderProjects);
    qa('#template-filters .filter-chip').forEach(b => b.addEventListener('click', () => { activeFilter = b.dataset.filter; qa('#template-filters .filter-chip').forEach(x => x.classList.toggle('is-active', x === b)); renderTemplates(); }));
    qa('.view-toggle').forEach(b => b.addEventListener('click', () => qa('.view-toggle').forEach(x => x.classList.toggle('is-active', x === b))));
    window.addEventListener('hashchange', route);
  }
  function drawDashboardArt() { const c = q('#dashboard-art'); if (c) paintPreview(c, byId('ember-knight'), 1); }

  // Wait only for the synchronous editor boot; no framework or network dependency is required.
  renderProjects(); renderMiniTemplates(); renderTemplates(); drawDashboardArt(); initActions(); route();
  window.PFWorkspace = { assets, projects, openAsset, renderTemplates, route };
  if (window.PixelForge) window.PixelForge.navigate = page => { location.hash = String(page).replace(/^#/, ''); return { route: location.hash }; };
})();
