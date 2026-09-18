/* PixelForge Studio — Factory: briefs, recipes and starter packs.
   The library is ~200 templates; a vibe coder does not want to read 200 rows.
   Factory turns a one-line brief ("cute farming game, pastel, 16px") into a
   curated, styled, export-ready pack, and turns a role + genre into the single
   best template for that slot.

   Everything is deterministic: the same brief always resolves to the same
   assets, which is what makes a "starter pack" reproducible in CI and
   reviewable in a diff. */
window.PF = window.PF || {};
PF.Factory = (() => {
  /* ---------------- genre vocabulary ----------------
     Keywords are matched against the brief; tags are matched against the
     library. Keeping them separate means a brief can say "cozy" and still find
     templates tagged `farm` / `survival`. */
  const GENRES = [
    { id: 'fantasy', name: 'Fantasy / RPG', tags: ['rpg', 'fantasy', 'medieval', 'dungeon', 'magic', 'knight', 'undead'],
      keywords: ['fantasy', 'rpg', 'medieval', 'knight', 'dragon', 'dungeon', 'magic', 'sword', 'quest', 'orc', 'castle', 'spell', 'rogue', 'wizard'] },
    { id: 'scifi', name: 'Sci-fi / Cyberpunk', tags: ['scifi', 'sci-fi', 'cyberpunk', 'space', 'robot', 'mech', 'alien', 'tech'],
      keywords: ['sci-fi', 'scifi', 'cyberpunk', 'space', 'robot', 'mech', 'alien', 'laser', 'tech', 'starship', 'droid', 'neon', 'dystopia', 'future'] },
    { id: 'platformer', name: 'Platformer', tags: ['platformer', 'platform', 'side-scroller', 'jump', 'runner'],
      keywords: ['platformer', 'platform', 'jump', 'run and gun', 'side-scroller', 'sidescroller', 'mario', 'runner', 'metroidvania'] },
    { id: 'horror', name: 'Horror / Gothic', tags: ['horror', 'gothic', 'zombie', 'creepy', 'blood'],
      keywords: ['horror', 'zombie', 'creepy', 'scary', 'gothic', 'vampire', 'werewolf', 'slasher', 'haunted', 'blood', 'spooky', 'survival horror'] },
    { id: 'farming', name: 'Farming / Life sim', tags: ['farm', 'farming', 'crops', 'cozy', 'survival', 'life'],
      keywords: ['farming', 'farm', 'cozy', 'life sim', 'lifesim', 'crops', 'harvest', 'stardew', 'town', 'villager', 'garden'] },
    { id: 'urban', name: 'Modern / Urban', tags: ['urban', 'city', 'modern', 'street', 'vehicle'],
      keywords: ['city', 'urban', 'modern', 'street', 'car', 'traffic', 'shop', 'office', 'suburb'] },
    { id: 'nature', name: 'Nature / Wildlife', tags: ['nature', 'forest', 'jungle', 'animal', 'ocean', 'water', 'pond'],
      keywords: ['nature', 'forest', 'jungle', 'animal', 'wildlife', 'ocean', 'sea', 'fish', 'pond', 'coral', 'bird', 'bug'] },
    { id: 'space', name: 'Space / Asteroids', tags: ['space', 'asteroid', 'starship', 'planet', 'star'],
      keywords: ['space', 'asteroid', 'planet', 'galaxy', 'shmup', 'starfighter'] },
    { id: 'shooter', name: 'Shooter / Bullet hell', tags: ['shooter', 'bullet', 'shmup', 'twin-stick', 'rts'],
      keywords: ['shooter', 'bullet hell', 'bullethell', 'shmup', 'twin stick', 'twin-stick', 'gun', 'rts', 'squad', 'tower defense'] },
    { id: 'puzzle', name: 'Puzzle / Blocks', tags: ['puzzle', 'blocks', 'match', 'board'],
      keywords: ['puzzle', 'blocks', 'match-3', 'match 3', 'tetris', 'board game', 'card'] },
    { id: 'towerdefense', name: 'Tower defence / Strategy', tags: ['tower', 'tower-defense', 'strategy', 'siege', 'rts'],
      keywords: ['tower defense', 'towerdefense', 'strategy', 'rts', 'siege', 'base building'] },
    { id: 'arcade', name: 'Arcade / Handler', tags: ['arcade', 'handheld', 'retro', 'tiny', '8-bit', '16-bit'],
      keywords: ['arcade', 'gameboy', 'game boy', 'nes', '8-bit', '16-bit', 'retro', 'handheld', 'handled'] },
    { id: 'ui', name: 'UI / HUD', tags: ['ui', 'hud', 'menu', 'icon', 'font', 'dialog'],
      keywords: ['ui', 'hud', 'menu', 'interface', 'font', 'dialog', 'inventory', 'health bar', 'buttons'] },
    { id: 'vfx', name: 'VFX / Particles', tags: ['fx', 'effects', 'particles', 'magic', 'weather', 'explosion'],
      keywords: ['fx', 'effects', 'particles', 'explosion', 'smoke', 'spark', 'impact', 'weather', 'rain', 'magic circle'] }
  ];

  /* ---------------- role vocabulary ---------------- */
  const ROLES = [
    { id: 'player', name: 'Player character', cats: ['Heroes'], tags: ['player', 'hero', 'militia'] },
    { id: 'enemy', name: 'Enemy', cats: ['Enemies'], tags: ['enemy'] },
    { id: 'boss', name: 'Boss', cats: ['Enemies'], tags: ['boss'] },
    { id: 'npc', name: 'NPC / Villager', cats: ['NPCs'], tags: ['npc', 'town', 'villager'] },
    { id: 'animal', name: 'Animal / Creature', cats: ['Animals'], tags: ['animal'] },
    { id: 'mount', name: 'Mount / Vehicle', cats: ['Animals'], tags: ['mount', 'vehicle', 'horse'] },
    { id: 'tileset', name: 'Tileset / Terrain', cats: ['World'], tags: ['tiles', 'tileset', 'terrain'] },
    { id: 'prop', name: 'Prop / Decoration', cats: ['World'], tags: ['props', 'decoration', 'interior'] },
    { id: 'item', name: 'Item / Pickup', cats: ['Items'], tags: ['loot', 'gear', 'pickup', 'currency'] },
    { id: 'weapon', name: 'Weapon', cats: ['Items'], tags: ['weapons', 'gear'] },
    { id: 'fx', name: 'Effect', cats: ['FX'], tags: ['effects', 'particles'] },
    { id: 'weather', name: 'Weather / Ambient', cats: ['FX'], tags: ['weather', 'ambient'] },
    { id: 'ui', name: 'UI / HUD', cats: ['UI'], tags: ['ui', 'hud', 'icons', 'menu'] },
    { id: 'font', name: 'Bitmap font', cats: ['UI'], tags: ['font', 'text', 'type'] }
  ];
  const ROLE_BY_ID = new Map(ROLES.map(r => [r.id, r]));

  const tokens = s => String(s || '').toLowerCase().split(/[^a-z0-9+]+/).filter(Boolean);
  const haystack = t => (t.id + ' ' + t.name + ' ' + t.desc + ' ' + t.category + ' ' + (t.tags || []).join(' ')).toLowerCase();

  const all = () => PF.Library.list();

  /* ---------------- search ---------------- */
  /* Weighted substring search: an exact tag beats a name hit, which beats a
     description hit. Ties fall back to id order so results never shuffle. */
  function search(query, opts = {}) {
    const q = tokens(query);
    const cat = opts.category;
    let list = all();
    if (cat) list = list.filter(t => t.category.toLowerCase() === String(cat).toLowerCase());
    if (!q.length) return list.map(t => ({ t, score: 0 }));
    const scored = [];
    for (const t of list) {
      const tags = (t.tags || []).map(x => x.toLowerCase());
      const name = (t.name || '').toLowerCase(), id = t.id.toLowerCase(), desc = (t.desc || '').toLowerCase();
      let score = 0;
      for (const w of q) {
        if (tags.includes(w)) score += 8;
        else if (tags.some(x => x.includes(w))) score += 5;
        if (name.includes(w)) score += 4;
        if (id.includes(w)) score += 3;
        if (desc.includes(w)) score += 1;
      }
      if (score > 0) scored.push({ t, score });
    }
    scored.sort((a, b) => b.score - a.score || (a.t.id < b.t.id ? -1 : 1));
    return scored;
  }

  /* ---------------- genre / style inference ---------------- */
  function genresFrom(text) {
    const w = tokens(text).join(' ');
    const hits = [];
    for (const g of GENRES) {
      let s = 0;
      for (const k of g.keywords) if (w.includes(k)) s += k.length > 4 ? 3 : 2;
      if (s) hits.push({ id: g.id, name: g.name, score: s, tags: g.tags });
    }
    hits.sort((a, b) => b.score - a.score || (a.id < b.id ? -1 : 1));
    return hits;
  }
  function styleFrom(text) {
    const w = tokens(text).join(' ');
    let best = null;
    for (const s of PF.Style.list()) {
      let score = 0;
      /* A hit on the style's own name outweighs a tag hit: the brief "pastel"
         should land on Pastel Dream, not on whichever synthwave palette happens
         to carry a `pastel` tag and appear first in the list. */
      for (const k of tokens(s.name)) if (k.length > 2 && w.includes(k)) score += 4;
      for (const k of s.tags) if (k.length > 2 && w.includes(k)) score += 2;
      for (const k of tokens(s.era)) if (k.length > 3 && w.includes(k)) score += 1;
      if (w.includes(s.id)) score += 8;
      if (score && (!best || score > best.score)) best = { id: s.id, name: s.name, score };
    }
    return best ? best.id : null;
  }
  function sizeFrom(text) {
    const m = String(text).match(/(\d{2})\s*(?:px|pixel)/i) || String(text).match(/\b(16|24|32|48|64)\b/);
    return m ? +m[1] : null;
  }

  /* ---------------- recipes ---------------- */
  const genreTags = genreId => (GENRES.find(g => g.id === genreId) || { tags: [] }).tags;
  function matchesGenre(t, genreId) {
    const tags = (t.tags || []).map(x => x.toLowerCase());
    return genreTags(genreId).some(g => tags.includes(g));
  }
  function matchesRole(t, roleId) {
    const r = ROLE_BY_ID.get(roleId);
    if (!r) return false;
    const tags = (t.tags || []).map(x => x.toLowerCase());
    const catOk = r.cats.includes(t.category);
    const tagOk = r.tags.some(x => tags.includes(x));
    return r.id === 'boss' ? tagOk : (catOk || tagOk);
  }

  /* Pick the best template for one slot. Prefers: genre match, then role, then
     featured, then the richest animation set, then id (stable). */
  function best(roleId, genreId, opts = {}) {
    const wantSize = opts.size;
    const cands = all().filter(t => {
      if (genreId && !matchesGenre(t, genreId)) return false;
      return matchesRole(t, roleId);
    });
    const pool = cands.length ? cands : all().filter(t => matchesRole(t, roleId));
    if (!pool.length) return null;
    const role = ROLE_BY_ID.get(roleId);
    const rank = t => {
      let s = 0;
      if (genreId && matchesGenre(t, genreId)) s += 100;
      /* A role's own tags outrank a bare category match: a farming brief asks
         for a tileset and the farm tileset beats the crop sheet, even though
         both are category World. */
      const tags = (t.tags || []).map(x => x.toLowerCase());
      if (role && role.tags.some(x => tags.includes(x))) s += 60;
      if (role && role.cats.includes(t.category)) s += 15;
      /* Size is a preference, not a filter: a 32px brief must not hide the only
         tileset in the genre just because that tileset is a 64px sheet. */
      if (wantSize && (t.w === wantSize || t.h === wantSize)) s += 15;
      if (t.featured) s += 20;
      const st = PF.Library.docStats(t.id);
      s += Math.min(30, (st ? st.frames : 0) / 12);
      return s;
    };
    return pool.slice().sort((a, b) => rank(b) - rank(a) || (a.id < b.id ? -1 : 1))[0];
  }

  /* One styled asset. */
  function variant(id, styleId) {
    const t = PF.Library.get(id);
    if (!t) throw new Error(`Unknown template "${id}"`);
    const doc = t.build();
    return { id: styleId ? id + '@' + styleId : id, source: id, name: t.name, category: t.category, tags: t.tags,
      style: styleId || null, doc: styleId ? PF.Style.docOf(doc, styleId) : doc, w: doc.width, h: doc.height };
  }

  /* A themed pack of assets for one brief. spec:
       brief    free text ("cozy farm game, pastel")
       genre    explicit genre id
       style    explicit style id
       roles    array of role ids (default: a sensible starter set)
       size     preferred canvas size
       max      max assets per role
  */
  function recipe(spec = {}) {
    const brief = spec.brief || '';
    const genres = spec.genre ? [spec.genre] : genresFrom(brief).map(g => g.id);
    const genre = genres[0] || null;
    const style = spec.style || (spec.style === null ? null : styleFrom(brief)) || null;
    const size = spec.size || sizeFrom(brief) || null;
    const roles = spec.roles || ['player', 'enemy', 'tileset', 'prop', 'item', 'fx', 'ui', 'font'];
    const items = [];
    for (const role of roles) {
      const t = best(role, genre, { size });
      if (!t) continue;
      const v = variant(t.id, style);
      items.push({ role, ...v });
    }
    return {
      brief: brief || null, genre, genreName: (GENRES.find(g => g.id === genre) || {}).name || null,
      style, size, items, count: items.length,
      note: style ? `Styled with "${style}". Change spec.style to retarget the whole pack — no re-drawing.` : 'Unstyled: pass style to retarget onto a hardware palette.'
    };
  }

  /* Starter packs for the most common game shapes. */
  const STARTERS = {
    platformer: { genre: 'platformer', roles: ['player', 'enemy', 'animal', 'tileset', 'prop', 'item', 'fx', 'ui', 'font'] },
    topdown_rpg: { genre: 'fantasy', roles: ['player', 'enemy', 'boss', 'npc', 'tileset', 'prop', 'item', 'fx', 'ui', 'font'] },
    farming: { genre: 'farming', roles: ['player', 'npc', 'animal', 'tileset', 'prop', 'item', 'ui', 'font'] },
    shooter: { genre: 'shooter', roles: ['player', 'enemy', 'boss', 'tileset', 'prop', 'fx', 'ui', 'font'] },
    horror: { genre: 'horror', roles: ['player', 'enemy', 'boss', 'tileset', 'prop', 'item', 'fx', 'ui'] },
    scifi: { genre: 'scifi', roles: ['player', 'enemy', 'boss', 'tileset', 'prop', 'item', 'fx', 'ui', 'font'] },
    horror_survival: { genre: 'horror', roles: ['player', 'enemy', 'tileset', 'prop', 'item', 'fx', 'weather', 'ui'] },
    handheld: { genre: 'arcade', roles: ['player', 'enemy', 'tileset', 'item', 'fx', 'ui', 'font'], style: 'gameboy' },
    bullet_hell: { genre: 'shooter', roles: ['player', 'enemy', 'boss', 'fx', 'ui', 'font'], style: 'neon-noir' }
  };
  const starter = (id, over = {}) => recipe({ ...(STARTERS[id] || STARTERS.platformer), ...over });

  /* Human/agent readable summary — used by the docs page and the agent tool. */
  function help() {
    const byCat = {};
    for (const t of all()) byCat[t.category] = (byCat[t.category] || 0) + 1;
    return {
      templates: all().length,
      byCategory: byCat,
      genres: GENRES.map(g => ({ id: g.id, name: g.name, tags: g.tags })),
      roles: ROLES.map(r => ({ id: r.id, name: r.name })),
      styles: PF.Style.list().map(s => ({ id: s.id, name: s.name, colors: s.size, tags: s.tags })),
      starters: Object.keys(STARTERS),
      usage: [
        'PF.Factory.search("dragon boss") -> ranked templates',
        'PF.Factory.recipe({brief:"cozy farm game, pastel", size:32}) -> styled starter pack',
        'PF.Factory.starter("handheld") -> Game Boy flavoured platformer kit',
        'PF.Factory.variant("rpg_knight","nes") -> one template retargeted to a palette',
        'PF.Atlas.write("phaser3", atlas) + PF.Export.generate("tiled-tsx", doc) -> engine-ready files'
      ]
    };
  }

  return { search, recipe, starter, variant, best, help, genresFrom, styleFrom, sizeFrom,
    matchesGenre, matchesRole, GENRES, ROLES, STARTERS };
})();
