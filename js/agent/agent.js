/* PixelForge Studio — In-app agent runtime: console, command parsing (JSON / slash / natural language),
   recipe planner, public window.PixelForge API and postMessage bridge for external agents. */
window.PF = window.PF || {};
PF.Agent = (() => {
  let logEl, inputEl, busy = false, aborter = null;
  const MAX_LOG = 200;
  /* LLM side: Nebians account + live selector + status + history (studio drawer + app cockpit) */
  let modelSel = null, statusEl = null, stopBtn = null, modeBtn = null, refreshBtn = null, connectUI = null;
  let aiMode = true, hist = [];
  const MODEL_KEY = 'pf-agent-model', MODE_KEY = 'pf-agent-mode';
  const WEAK_MODEL = /yqcloud|chatjimmy|llama-3\.1-8b|tiny|1\.5b|nano|instant/i; // small models get the core toolset

  /* ---------- Console ---------- */
  function init({ log, input, send, chips, model, status, stop, mode, refresh, connect }) {
    logEl = log; inputEl = input;
    modelSel = model || null; statusEl = status || null; stopBtn = stop || null; modeBtn = mode || null; refreshBtn = refresh || null; connectUI = connect || null;
    send.addEventListener('click', submit);
    input.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); } });
    chips.addEventListener('click', e => { const b = e.target.closest('[data-prompt]'); if (b) { input.value = b.dataset.prompt; submit(); } });
    PF.Store.on('tool:result', r => logTool(r));
    initModelBar();
    try { document.querySelectorAll('[data-count="tools"]').forEach(el => { el.textContent = PF.Tools.list().length; }); } catch {}
    say('agent', 'Hi! I\'m the PixelForge agent. Ask me to draw ("make a slime idle animation"), run a tool ("/draw_rect x=2 y=2 width=10 height=6 fill=true color=#ff0044"), or paste JSON tool calls. Type /help for everything. AI mode needs your Nebians account (Connect button) or dev-server NEBIANS_TOKEN.');
    window.addEventListener('message', onMessage);
  }
  /* (Re)build selector options from the live Nebians catalog, preserving selection. */
  function buildModelOptions() {
    if (!modelSel || !PF.Nebians) return;
    const prev = modelSel.value;
    let saved = null;
    try { saved = localStorage.getItem(MODEL_KEY); } catch {}
    const groups = {};
    PF.Nebians.listModels().forEach(m => { (groups[m.providerLabel] = groups[m.providerLabel] || []).push(m); });
    modelSel.innerHTML = '';
    if (!Object.keys(groups).length) {
      const o = document.createElement('option'); o.value = ''; o.textContent = 'Connect Nebians to load models…'; modelSel.appendChild(o);
    }
    Object.keys(groups).forEach(g => {
      const og = document.createElement('optgroup');
      og.label = `${g} · ${groups[g].length}`;
      groups[g].forEach(m => { const o = document.createElement('option'); o.value = m.id; o.textContent = m.note ? `${m.label} — ${m.note}` : m.label; og.appendChild(o); });
      modelSel.appendChild(og);
    });
    const want = (prev && PF.Nebians.modelOf(prev) && prev) || (saved && PF.Nebians.modelOf(saved) && saved) || PF.Nebians.DEFAULT_MODEL;
    modelSel.value = PF.Nebians.modelOf(want) ? want : (modelSel.options[0] ? modelSel.options[0].value : '');
    setStatus(modelLabel());
  }
  async function refreshModelsNow() {
    if (!PF.Nebians) return;
    setStatus('refreshing Nebians models…');
    try {
      await PF.Nebians.liveModels();
      buildModelOptions();
      const all = PF.Nebians.listModels(), fams = new Set(all.map(m => m.family));
      setStatus(all.length ? `${all.length} models live across ${fams.size} families` : 'No models — sign in first.');
    } catch (e) {
      if (e.auth) { setStatus('Nebians sign-in needed — use Connect.'); openConnect(); }
      else setStatus(modelLabel());
    }
  }
  /* Nebians account wiring: token in localStorage, or dev-server NEBIANS_TOKEN (server key). */
  function syncConnect() {
    if (!connectUI || !connectUI.btn || !PF.Nebians) return;
    const t = PF.Nebians.authed(), s = PF.Nebians.serverAuth(), u = PF.Nebians.user();
    connectUI.btn.textContent = t ? `● ${u || 'Nebians'}` : s ? '● Server key' : 'Connect';
    connectUI.btn.classList.toggle('is-on', t || s);
    connectUI.btn.title = t ? `Signed in as ${u || 'Nebians user'} — click to sign out` : s ? 'Dev server carries NEBIANS_TOKEN — click to use your own account instead' : 'Connect your Nebians account (free LLMs, no PixelForge-side keys)';
  }
  function openConnect() {
    if (!connectUI || !connectUI.dlg) return;
    if (connectUI.err) connectUI.err.textContent = '';
    if (connectUI.dlg.showModal) connectUI.dlg.showModal(); else connectUI.dlg.setAttribute('open', '');
  }
  function closeConnect() { try { connectUI.dlg.close(); } catch {} }
  async function submitConnect() {
    if (!connectUI || !PF.Nebians) return;
    const id = (connectUI.login.value || '').trim(), pw = connectUI.pass.value || '';
    if (connectUI.err) connectUI.err.textContent = '';
    if (!id || !pw) { if (connectUI.err) connectUI.err.textContent = 'Enter your Nebians email/username and password.'; return; }
    if (connectUI.go) connectUI.go.disabled = true;
    try {
      await PF.Nebians.login(id, pw);
      if (connectUI.pass) connectUI.pass.value = ''; // never keep the password in the DOM
      closeConnect(); syncConnect();
      await PF.Nebians.liveModels(); buildModelOptions();
      setStatus(modelLabel());
      say('agent', `Connected to Nebians as ${PF.Nebians.user()}. ${PF.Nebians.listModels().length} free models ready — pick one above and just ask.`);
    } catch (e) {
      if (connectUI.err) connectUI.err.textContent = e.message;
    } finally { if (connectUI.go) connectUI.go.disabled = false; }
  }
  function initModelBar() {
    try { aiMode = (localStorage.getItem(MODE_KEY) || 'ai') === 'ai'; } catch { aiMode = true; }
    if (modelSel && PF.Nebians) {
      buildModelOptions();
      modelSel.addEventListener('change', () => { try { localStorage.setItem(MODEL_KEY, modelSel.value); } catch {} setStatus(modelLabel()); });
      // Background: probe auth state, then pull the live catalog when possible.
      PF.Nebians.refreshAuth().then(() => { syncConnect(); return PF.Nebians.liveModels(); }).then(all => { if (all.length) buildModelOptions(); syncConnect(); }).catch(() => syncConnect());
    }
    if (modeBtn) { syncModeBtn(); modeBtn.addEventListener('click', () => { aiMode = !aiMode; try { localStorage.setItem(MODE_KEY, aiMode ? 'ai' : 'local'); } catch {} syncModeBtn(); setStatus(modelLabel()); }); }
    if (refreshBtn) refreshBtn.addEventListener('click', refreshModelsNow);
    if (connectUI && connectUI.btn) connectUI.btn.addEventListener('click', () => {
      if (PF.Nebians && PF.Nebians.authed()) { PF.Nebians.logout(); syncConnect(); buildModelOptions(); setStatus('Signed out — local recipes only.'); }
      else if (PF.Nebians && PF.Nebians.serverAuth()) { openConnect(); }
      else openConnect();
    });
    if (connectUI && connectUI.go) connectUI.go.addEventListener('click', submitConnect);
    if (connectUI && connectUI.pass) connectUI.pass.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); submitConnect(); } });
    if (stopBtn) { stopBtn.classList.add('hidden'); stopBtn.addEventListener('click', () => { if (aborter) aborter.abort(); }); }
    setStatus(modelLabel());
  }
  const curModel = () => (modelSel && modelSel.value) || (PF.Nebians ? PF.Nebians.DEFAULT_MODEL : 'local');
  const modelLabel = () => {
    if (!aiMode) return 'Local recipes';
    const m = PF.Nebians && PF.Nebians.listModels().find(x => x.id === curModel());
    return m ? `${m.providerLabel} · ${m.label}` : (curModel() || 'Nebians');
  };
  function syncModeBtn() { if (modeBtn) { modeBtn.textContent = aiMode ? 'AI' : 'Local'; modeBtn.classList.toggle('is-on', aiMode); modeBtn.title = aiMode ? 'AI mode (free Nebians models) — click for local recipes' : 'Local recipes — click for AI mode'; } }
  function setStatus(t) { if (statusEl) statusEl.textContent = t || ''; }
  function cancel() { if (aborter) aborter.abort(); }
  function say(role, text) {
    if (!logEl) return; const el = document.createElement('div'); el.className = `msg msg--${role}`; el.textContent = text; logEl.appendChild(el); trim(); logEl.scrollTop = logEl.scrollHeight; return el;
  }
  function logTool(r) {
    if (!logEl) return; const el = document.createElement('div'); el.className = 'msg msg--tool';
    const args = r.args ? JSON.stringify(r.args) : '{}', short = args.length > 160 ? args.slice(0, 157) + '…' : args;
    const res = r.ok ? summarize(r.result) : r.error;
    el.innerHTML = `<b>${r.tool}</b> ${escape(short)}\n<span class="${r.ok ? 'ok' : 'err'}">${r.ok ? '✓' : '✗'} ${escape(res)}</span>${r.ms !== undefined ? ` <span class="muted">${r.ms}ms</span>` : ''}`;
    logEl.appendChild(el); trim(); logEl.scrollTop = logEl.scrollHeight;
  }
  const summarize = v => { if (v === undefined) return 'ok'; let s = JSON.stringify(v, (k, x) => (typeof x === 'string' && x.startsWith('data:') ? `[dataURL ${x.length}b]` : x)); return s.length > 220 ? s.slice(0, 217) + '…' : s; };
  const escape = s => String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  const trim = () => { while (logEl.children.length > MAX_LOG) logEl.firstChild.remove(); };

  async function submit() {
    const text = inputEl.value.trim(); if (!text || busy) return;
    inputEl.value = ''; say('user', text); busy = true;
    aborter = new AbortController();
    if (stopBtn) stopBtn.classList.remove('hidden');
    const t0 = Date.now();
    const tick = setInterval(() => { if (busy) setStatus(`thinking… ${Math.round((Date.now() - t0) / 1000)}s`); }, 500);
    try { await handle(text); } catch (e) { say('agent', `Error: ${e.message}`); }
    clearInterval(tick); busy = false; aborter = null;
    if (stopBtn) stopBtn.classList.add('hidden');
    setStatus(modelLabel());
  }

  /* ---------- Command handling ---------- */
  async function handle(text) {
    if (text[0] === '{' || text[0] === '[') { const calls = [].concat(JSON.parse(text)); return run(calls.map(c => ({ tool: c.tool || c.name, args: c.args || c.arguments || {} }))); }
    if (text[0] === '/') return slash(text);
    if (aiMode && PF.Nebians && PF.Harness) return ai(text);
    return natural(text);
  }
  /* LLM turn: Hermes text-protocol harness over Nebians sessions, with
     automatic fallback to local recipes when the network path fails. */
  async function ai(text) {
    const gate = PF.Nebians ? await PF.Nebians.refreshAuth().catch(() => null) : null;
    const authed = PF.Nebians && (PF.Nebians.authed() || PF.Nebians.serverAuth());
    if (!gate || !gate.pipe) { say('agent', 'AI needs the dev server pipe to Nebians: run `node scripts/serve.js` and reload — falling back to local recipes.'); return natural(text); }
    if (!authed) { say('agent', 'AI needs your Nebians account (free LLMs). Use Connect above, or set NEBIANS_TOKEN for the dev server — falling back to local recipes for now.'); return natural(text); }
    const model = curModel();
    if (!PF.Nebians.modelOf(model)) { say('agent', 'Pick a model from the selector first (use the sync button to reload the live list) — falling back to local recipes.'); return natural(text); }
    setStatus(`thinking via ${modelLabel()}…`);
    const r = await PF.Harness.runGoal({ model, goal: text, history: hist, fullTools: !WEAK_MODEL.test(model),
      signal: aborter ? aborter.signal : null, onEvent: ev => { if (ev.type === 'turn') setStatus(`turn ${ev.turn} · ${modelLabel()}…`); } });
    if (r.status === 'cancelled') { say('agent', 'Stopped.'); return; }
    if (r.status === 'error') {
      say('agent', r.auth ? `${r.error} — use Connect to sign in again. Falling back to local recipes.` : `${r.error} — falling back to local recipes.`);
      return natural(text);
    }
    hist.push({ role: 'user', content: text }, { role: 'assistant', content: (r.final || r.question || '').slice(0, 2000) });
    hist = hist.slice(-12);
    say('agent', r.status === 'needs-input' ? `A question before I continue: ${r.question}` : (r.final || 'Done.'));
  }
  function slash(text) {
    const [cmd, ...rest] = text.slice(1).trim().split(/\s+/);
    if (cmd === 'help') return help();
    if (cmd === 'tools') return say('agent', PF.Tools.list().map(t => `/${t.name} — ${t.description}`).join('\n'));
    if (cmd === 'schema') { const t = PF.Tools.get(rest[0]); return say('agent', t ? JSON.stringify(t.schema, null, 1) : `No tool "${rest[0]}"`); }
    const args = {}; rest.join(' ').replace(/(\w+)=("[^"]*"|'[^']*'|\[[^\]]*\]|\{[^}]*\}|\S+)/g, (_, k, v) => { args[k] = coerce(v); return ''; });
    return run([{ tool: cmd, args }]);
  }
  const coerce = v => { if (/^".*"$|^'.*'$/.test(v)) return v.slice(1, -1); if (v === 'true') return true; if (v === 'false') return false;
    if (/^-?\d+(\.\d+)?$/.test(v)) return Number(v); if (/^[\[{]/.test(v)) { try { return JSON.parse(v); } catch { return v; } } return v; };
  function help() {
    say('agent', `Ways to drive PixelForge:\n• Templates: "open the male hero", "add a slime", "dungeon tileset", "weapons rack" — 32 animated assets (/list_templates to browse, /load_template id=hero_male to open, /append_template_states to merge).\n• Projects: /new_project, /open_project, /list_projects, /save_project, /duplicate_project, /delete_project.\n• Quick recipes: "make a slime idle animation", "spinning coin", "hero walk cycle", "add outline", "flip x", "export gif", "add walk state", "new 64x64 canvas", "play", "undo", "clear".\n• Slash tools: /draw_rect x=0 y=0 width=8 height=8 fill=true color=#ff0044   (/tools lists ${PF.Tools.list().length} tools, /schema <tool> shows arguments)\n• JSON: {"tool":"paint_rows","args":{"rows":["GG","GG"],"legend":{"G":"#63c74d"}}} or an array of calls.\n• From code: window.PixelForge.call("fill",{x:0,y:0,color:"#000"}) or postMessage({type:"pf:call",id,tool,args}).\n• MCP: see the MCP section for the manifest & bridge.\n• AI mode (default): plain English goes to Nebians free LLMs from the selector — connect your Nebians account (Connect button, token stays in this browser) or set NEBIANS_TOKEN for the dev server. It calls these same tools and shows each call live. Toggle AI/Local to use offline recipes.`);
  }

  /* Execute a plan step by step (visible in the log) */
  async function run(plan, { delay = 60 } = {}) {
    const results = [];
    for (const step of plan) {
      const r = await PF.Tools.call(step.tool, { ...step.args });
      results.push(r); if (!r.ok) { say('agent', `Stopped: ${step.tool} failed — ${r.error}`); break; }
      if (delay) await new Promise(res => setTimeout(res, delay));
    }
    return results;
  }

  /* ---------- Natural-language planner (local recipes, no network) ---------- */
  const TEMPLATE_WORDS = [
    [/female|woman|girl|heroine/, 'hero_female'], [/male hero|man hero|knight|swordsman/, 'hero_male'],
    [/skeleton|undead/, 'skeleton'], [/orc|brute|goblin/, 'orc'], [/\bslime\b|blob|jelly/, 'slime'],
    [/\bbat\b/, 'bat'], [/ghost|spirit|phantom/, 'ghost'], [/mushroom|shroom/, 'mushroom'],
    [/golem|rock monster|stone monster/, 'golem'], [/wolf|dire wolf|dog/, 'wolf'], [/chicken|hen|rooster/, 'chicken'],
    [/villager|townsfolk|peasant/, 'villager_m'], [/merchant|trader|shopkeeper|shop/, 'merchant'],
    [/tileset|dungeon tiles|grass tiles|terrain/, 'tileset'], [/\bwater\b|lake|river/, 'water'],
    [/tree|forest|bush|flora|plants?/, 'flora'], [/campfire|bonfire|camp fire/, 'campfire'], [/torch/, 'torch'],
    [/chest|treasure|loot box/, 'chest'], [/door|gate/, 'door'], [/portal/, 'portal'],
    [/weapons?|sword|pickaxe|axe|bow|shield|arsenal/, 'weapons'], [/potion|food|apple|bread|meat|consumables?/, 'consumables'],
    [/coin|gem|currency|money/, 'coin_gem'], [/\bfx\b|slash|hit spark|particles?|effects?/, 'fx'], [/\bhud\b|hearts|health bar/, 'hud']
  ];
  async function natural(text) {
    const t = text.toLowerCase(), plan = [];
    const size = t.match(/(\d{1,3})\s*[x×]\s*(\d{1,3})/);
    if (/new|create|blank|canvas/.test(t) && size && !/slime|coin|hero|heart|character|player/.test(t)) { plan.push({ tool: 'new_document', args: { width: +size[1], height: +size[2], name: 'sprite' } }); }
    // Rich built-in templates first ("open the male hero", "add a slime", "dungeon tileset")
    const tplHit = (/template|asset|load|open|add|make|create|give|spawn|generate/.test(t) && PF.Library)
      ? (TEMPLATE_WORDS.find(([re]) => re.test(t)) || []).slice(1) : [];
    if (tplHit && tplHit[0] && !/outline|border|flip|export|undo|clear|play|pause/.test(t)) {
      const id = tplHit[0];
      say('agent', `Opening the "${id}" template — ${PF.Library.get(id).desc} I'll load it as its own project.`);
      plan.push({ tool: 'load_template', args: { id } });
      const results = await run(plan);
      const failed = results.filter(r => !r.ok).length;
      say('agent', failed ? `Done with ${failed} failed step(s).` : `Done — "${id}" is open. Every state and frame is editable, undo is available.`);
      return;
    }
    const recipe = Object.keys(RECIPES).find(k => RECIPES[k].match.test(t));
    if (recipe) { say('agent', `${RECIPES[recipe].intro} I'll build it step by step so you can watch each tool call.`); plan.push(...RECIPES[recipe].plan(t)); }
    if (/outline|border/.test(t)) plan.push({ tool: 'outline', args: { all_frames: true, color: pickColor(t) || '#181425' } });
    if (/flip/.test(t)) plan.push({ tool: 'flip', args: { axis: /vertical|\by\b/.test(t) ? 'y' : 'x', all_frames: /all/.test(t) } });
    if (/undo/.test(t)) plan.push({ tool: 'undo', args: {} });
    if (/\bclear\b|erase all|wipe/.test(t)) plan.push({ tool: 'clear', args: {} });
    if (/\b(play|animate|preview)\b/.test(t) && !recipe) plan.push({ tool: 'play', args: {} });
    if (/\b(pause|stop)\b/.test(t)) plan.push({ tool: 'pause', args: {} });
    const st = t.match(/add (?:an? )?(\w+) (?:state|animation)/); if (st) plan.push({ tool: 'add_state', args: { name: st[1], from_preset: true } });
    const ex = t.match(/export|download|save/); if (ex) { const f = PF.IO.FORMATS.find(x => t.includes(x.id)) || (/sheet|atlas/.test(t) ? { id: 'spritesheet' } : /gif/.test(t) ? { id: 'gif' } : { id: 'png' }); const sc = t.match(/(\d+)\s*x\b/); plan.push({ tool: 'export', args: { format: f.id, scale: sc ? +sc[1] : (f.id === 'gif' || f.id === 'png' ? 4 : 1) } }); }
    if (/dark mode|dark theme/.test(t)) plan.push({ tool: 'set_view', args: { theme: 'dark' } });
    if (/light mode|light theme/.test(t)) plan.push({ tool: 'set_view', args: { theme: 'light' } });
    if (/onion/.test(t)) plan.push({ tool: 'set_view', args: { onion: !/off|hide|disable/.test(t) } });
    if (/describe|what can you|list tools|which tools/.test(t)) { const d = PF.UI.describe(); say('agent', `${PF.Tools.list().length} tools available and ${d.length} addressable UI elements. Try /tools or /help.`); return; }
    if (!plan.length) return say('agent', 'I did not find a matching recipe or tool. Try "make a slime idle animation", "spinning coin", "hero walk cycle", or /help for the full command reference.');
    const results = await run(plan);
    const failed = results.filter(r => !r.ok).length;
    say('agent', failed ? `Done with ${failed} failed step(s).` : `Done — ${results.length} tool call(s) executed. Undo is available if you don't like it.`);
  }
  const pickColor = t => (t.match(/#[0-9a-f]{6}\b/i) || [])[0] || ({ black: '#181425', white: '#ffffff', red: '#e43b44', blue: '#0099db', green: '#63c74d', yellow: '#fee761', purple: '#68386c', orange: '#f77622' }[Object.keys({ black: 1, white: 1, red: 1, blue: 1, green: 1, yellow: 1, purple: 1, orange: 1 }).find(c => t.includes(c))]);

  /* Sprite recipes expressed as tool plans (ASCII art → paint_rows) */
  const SLIME = { G: '#63c74d', L: '#a8f28a', W: '#ffffff', D: '#3e8948', O: '#265c42' };
  const SLIME_A = ['................', '................', '................', '......GGGG......', '....GGGGGGGG....', '...GGGGGGGGGG...', '..GGLLGGGGGGGG..', '..GLWWGGGGGGGG..', '.GGLWWGGGGGGGGG.', '.GGGGGOOGGOOGGG.', '.GGGGGOOGGOOGGG.', '.GGGGGGGGGGGGGG.', '.GGGGGGGGGGGGGG.', '..DDDDDDDDDDDD..', '................', '................'];
  const SLIME_B = ['................', '................', '................', '................', '................', '.....GGGGGG.....', '...GGGGGGGGGG...', '..GGLLGGGGGGGG..', '.GGLWWGGGGGGGGG.', '.GGLWWGGGGGGGGG.', 'GGGGGGOOGGOOGGGG', 'GGGGGGOOGGOOGGGG', 'GGGGGGGGGGGGGGGG', '.DDDDDDDDDDDDDD.', '................', '................'];
  const HERO = { H: '#733e39', S: '#e4a672', E: '#181425', T: '#0099db', D: '#124e89', P: '#3a4466', B: '#262b44' };
  const HERO_TOP = ['................', '.....HHHHHH.....', '....HHHHHHHH....', '....HSSSSSSH....', '....SSESSESS....', '....SSSSSSSS....', '.....SSSSSS.....', '....TTTTTTTT....', '...STTTTTTTTS...', '...STTDTTDTTS...', '....TTTTTTTT....'];
  const HERO_A = [...HERO_TOP, '.....PPPPPP.....', '.....PP..PP.....', '.....PP..PP.....', '....BBB..BBB....', '................'];
  const HERO_B = [...HERO_TOP, '.....PPPPPP.....', '....PPP..PPP....', '...PPP....PPP...', '..BBB......BBB..', '................'];
  const HEART = { R: '#e43b44', L: '#f6757a', D: '#a22633' };
  const HEART_A = ['................', '................', '...RRR....RRR...', '..RLLRR..RRRRR..', '.RLLRRRRRRRRRRR.', '.RLRRRRRRRRRRRR.', '.RRRRRRRRRRRRRR.', '.RRRRRRRRRRRRRD.', '..RRRRRRRRRRRD..', '...RRRRRRRRRD...', '....RRRRRRRD....', '.....RRRRRD.....', '......RRRD......', '.......RD.......', '................', '................'];
  const paint = (rows, legend, extra = {}) => ({ tool: 'paint_rows', args: { rows, legend, clear: true, ...extra } });
  const RECIPES = {
    slime: { match: /slime|blob|jelly/, intro: 'Slime idle: 4 frames of squash & stretch on a 16×16 canvas.', plan: () => [
      { tool: 'new_document', args: { width: 16, height: 16, name: 'slime' } }, { tool: 'set_state', args: { index: 0, name: 'idle', fps: 6 } },
      paint(SLIME_A, SLIME), { tool: 'add_frame', args: { duplicate: false } }, paint(SLIME_B, SLIME),
      { tool: 'add_frame', args: { duplicate: false } }, paint(SLIME_A, SLIME), { tool: 'shift', args: { dx: 0, dy: -1 } },
      { tool: 'add_frame', args: { duplicate: false } }, paint(SLIME_B, SLIME), { tool: 'set_active', args: { frame: 0 } }, { tool: 'play', args: {} }] },
    coin: { match: /coin|gem|token/, intro: 'Spinning coin: 6 frames of narrowing ellipses with an outline and highlight.', plan: () => {
      const widths = [12, 8, 4, 2, 4, 8], p = [{ tool: 'new_document', args: { width: 16, height: 16, name: 'coin' } }, { tool: 'set_state', args: { index: 0, name: 'spin', fps: 12 } }];
      widths.forEach((w, i) => { if (i) p.push({ tool: 'add_frame', args: { duplicate: false } }); const x = 8 - w / 2;
        p.push({ tool: 'draw_ellipse', args: { x, y: 2, width: w, height: 12, fill: true, color: '#feae34' } });
        if (w >= 4) p.push({ tool: 'draw_ellipse', args: { x: x + 1, y: 3, width: w - 2, height: 10, fill: false, color: '#fee761' } });
        if (w >= 8) p.push({ tool: 'draw_line', args: { x0: x + 2, y0: 5, x1: x + 2, y1: 9, color: '#ffffff' } });
        p.push({ tool: 'outline', args: { color: '#733e39' } }); });
      return [...p, { tool: 'set_active', args: { frame: 0 } }, { tool: 'play', args: {} }]; } },
    hero: { match: /hero|character|player|knight|walk cycle/, intro: 'Hero walk cycle: 4 frames alternating leg poses with a 1px bob.', plan: () => [
      { tool: 'new_document', args: { width: 16, height: 16, name: 'hero' } }, { tool: 'set_state', args: { index: 0, name: 'walk', fps: 8 } },
      paint(HERO_A, HERO), { tool: 'add_frame', args: { duplicate: false } }, paint(HERO_B, HERO),
      { tool: 'add_frame', args: { duplicate: false } }, paint(HERO_A, HERO), { tool: 'shift', args: { dx: 0, dy: -1 } },
      { tool: 'add_frame', args: { duplicate: false } }, paint(HERO_B, HERO), { tool: 'add_state', args: { name: 'idle', from_preset: true } },
      { tool: 'set_active', args: { state: 0 } }, { tool: 'play', args: {} }] },
    heart: { match: /heart|life|health/, intro: 'Heart pickup: 2-frame pulse.', plan: () => [
      { tool: 'new_document', args: { width: 16, height: 16, name: 'heart' } }, { tool: 'set_state', args: { index: 0, name: 'pulse', fps: 4 } },
      paint(HEART_A, HEART), { tool: 'add_frame', args: { duplicate: true } }, { tool: 'shift', args: { dx: 0, dy: 1 } }, { tool: 'set_active', args: { frame: 0 } }, { tool: 'play', args: {} }] }
  };

  /* ---------- External agents: postMessage bridge + global API ---------- */
  async function onMessage(e) {
    const m = e.data; if (!m || m.type !== 'pf:call') return;
    // Ignore our own echoes / non-window sources (notably opaque file:// origins)
    if (!e.source || e.source === window) return;
    const r = await PF.Tools.call(m.tool, m.args || {});
    try { e.source.postMessage({ type: 'pf:result', id: m.id, ...r }, '*'); }
    catch { /* file:// and cross-origin frames may refuse replies — result stays in local log */ }
  }
  window.PixelForge = {
    version: '1.0.0',
    call: (tool, args) => PF.Tools.call(tool, args),
    tools: () => PF.Tools.list(),
    models: () => (PF.Nebians ? PF.Nebians.listModels() : []),
    setModel: id => { if (modelSel && PF.Nebians && PF.Nebians.modelOf(id)) { modelSel.value = id; try { localStorage.setItem(MODEL_KEY, id); } catch {} setStatus(modelLabel()); return true; } return false; },
    cancel,
    describeUI: f => PF.UI.describe(f),
    clickUI: (id, v) => PF.UI.click(id, v),
    run: plan => run(plan, { delay: 0 }),
    prompt: text => handle(text),
    manifest: () => PF.MCP.manifest(),
    on: (ev, fn) => PF.Store.on(ev, fn),
    document: () => PF.Store.summary()
  };
  return { init, say, run, handle, cancel, curModel, RECIPES };
})();
