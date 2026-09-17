/* PixelForge Studio — In-app agent runtime: console, command parsing (JSON / slash / natural language),
   recipe planner, public window.PixelForge API and postMessage bridge for external agents. */
window.PF = window.PF || {};
PF.Agent = (() => {
  let logEl, inputEl, busy = false;
  const MAX_LOG = 200;

  /* ---------- Console ---------- */
  function init({ log, input, send, chips }) {
    logEl = log; inputEl = input;
    send.addEventListener('click', submit);
    input.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); } });
    chips.addEventListener('click', e => { const b = e.target.closest('[data-prompt]'); if (b) { input.value = b.dataset.prompt; submit(); } });
    PF.Store.on('tool:result', r => logTool(r));
    say('agent', 'Local command workbench ready. Run /get_document to inspect this sprite, /list_asset_templates to browse the library, or paste a JSON plan. This console uses deterministic tools and a few built-in recipes, not a connected language model. Asset recipes add new sprites without replacing your other work.');
  }
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
    try { await handle(text); } catch (e) { say('agent', `Error: ${e.message}`); }
    busy = false;
  }

  /* ---------- Command handling ---------- */
  async function handle(text) {
    if (text[0] === '{' || text[0] === '[') { const calls = [].concat(JSON.parse(text)); return run(calls.map(c => ({ tool: c.tool || c.name, args: c.args || c.arguments || {} }))); }
    if (text[0] === '/') return slash(text);
    return natural(text);
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
    say('agent', `Ways to drive PixelForge:\n• Local recipes: "make a slime", "spinning coin", "hero walk cycle", "heart pickup". These add library assets to the project.\n• Slash tools: /draw_rect x=0 y=0 width=8 height=8 fill=true color=#ff0044\n• /tools lists ${PF.Tools.list().length} tools. /schema <tool> shows its arguments.\n• JSON: {"tool":"paint_rows","args":{"rows":["GG","GG"],"legend":{"G":"#63c74d"}}} or an array of calls.\n• Browser automation: window.PixelForge.call("get_document", {}).\n• Atomic plans: PixelForge.plan(steps, {dry_run:true}) validates; omit dry_run to apply one undoable edit.\n• External postMessage requires explicitly enabling the trusted-origin, token-protected bridge in this dialog. This is a browser API, not a standalone MCP server.`);
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
  async function natural(text) {
    const t = text.toLowerCase(), plan = [];
    const size = t.match(/(\d{1,3})\s*[x×]\s*(\d{1,3})/);
    if (/new|create|blank|canvas/.test(t) && size && !/slime|coin|hero|heart|character|player/.test(t)) { plan.push({ tool: 'new_document', args: { width: +size[1], height: +size[2], name: 'sprite' } }); }
    const recipe = Object.keys(RECIPES).find(k => RECIPES[k].match.test(t));
    if (recipe && PF.Workspace) {
      const templateId = { slime: 'slime', coin: 'coin', hero: /female|woman/.test(t) ? 'ranger-female' : 'ranger-male', heart: 'heart' }[recipe];
      const steps = [{ tool: 'add_library_asset', args: { template_id: templateId } }];
      if (recipe === 'hero' && /walk|run/.test(t)) steps.push({ tool: 'select_animation', args: { action: /run/.test(t) ? 'run' : 'walk', direction: 'south' } });
      say('agent', 'Adding a complete library sprite to your project. Your existing assets are preserved.');
      return run(steps);
    }
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
  window.PixelForge = {
    version: '2.0.0',
    call: (tool, args) => PF.Tools.call(tool, args),
    tools: () => PF.Tools.list(),
    describeUI: f => PF.UI.describe(f),
    clickUI: (id, v) => PF.UI.click(id, v),
    run: plan => run(plan, { delay: 0 }),
    prompt: text => handle(text),
    manifest: () => ({name:'pixelforge-workspace',version:'2.0.0',tools:PF.Tools.list()}),
    on: (ev, fn) => PF.Store.on(ev, fn),
    document: () => PF.Store.summary()
  };
  return { init, say, run, handle, RECIPES };
})();
