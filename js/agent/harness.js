/* PixelForge Studio — text-protocol tool harness for LLMs without native function calling.
   Direct port of the NEBians background-agent pattern (F:/NEB backend_python/api/
   background_agent/protocol.py + qwen_harness/prompt.py): Hermes <tool_call> blocks
   first, then Qwen ✿FUNCTION✿, ```tool fences, then a JSON envelope — so a single
   turn almost never dies on format. One format-repair retry per turn; unknown tools
   and validation errors come back as tool results so the model self-corrects. */
window.PF = window.PF || {};
PF.Harness = (() => {
  const MAX_TURNS = 10, MAX_ACTIONS = 8, MAX_RESULT = 2500, MAX_HISTORY = 11;

  /* Curated core surface for weak models (yqcloud/chatjimmy class): the pixel +
     doc + anim essentials plus template open and undo. Strong models get all 56. */
  const CORE = ['get_document', 'new_document', 'set_active', 'paint_rows', 'set_pixels', 'draw_line', 'draw_rect', 'draw_ellipse', 'fill', 'clear', 'outline', 'flip', 'shift', 'replace_color', 'get_pixels', 'add_state', 'set_state', 'add_frame', 'play', 'pause', 'undo', 'list_templates', 'load_template', 'export'];
  const VIRTUAL = [
    { name: 'done', description: 'Call when the goal is complete. Put the user-facing summary in "summary".', inputSchema: { type: 'object', properties: { summary: { type: 'string', description: 'What was built / changed' } }, required: ['summary'], additionalProperties: false } },
    { name: 'ask_user', description: 'Call when blocked on a human decision. Put the single question in "question".', inputSchema: { type: 'object', properties: { question: { type: 'string', description: 'The one question you need answered' } }, required: ['question'], additionalProperties: false } }
  ];
  function toolList(full) {
    const all = PF.Tools.list();
    const keep = full ? all : all.filter(t => CORE.includes(t.name));
    return [...keep.map(t => ({ name: t.name, description: t.description, inputSchema: t.inputSchema })), ...VIRTUAL];
  }

  /* ---------- system prompt (Hermes shape, pixel-studio rules) ----------
     Sent as the session's first message (Nebians replays history per turn, and
     each message caps at 8000 chars — so the catalog is condensed to one line
     per tool; local PF.Tools.call validation still enforces full schemas). */
  const oneLine = s => String(s || '').replace(/\s+/g, ' ').split('. ')[0].slice(0, 140);
  function catalogText(tools) {
    return tools.map(t => {
      const props = Object.keys((t.inputSchema || {}).properties || {}).join(',');
      const req = ((t.inputSchema || {}).required || []).join(',');
      return `${t.name}(${props})${req ? ` [required: ${req}]` : ''} — ${oneLine(t.description)}`;
    }).join('\n');
  }
  function systemPrompt(tools, modelLabel) {
    return `You are the PixelForge Studio agent, a pixel-art assistant working in a live editor. You are running through ${modelLabel}.
You do not have native API function calling. Use the <tool_call> protocol below — never invent a different envelope.

How to work:
- Call get_document FIRST (unless the goal is fully determined) so state/frame/layer indices are fresh.
- Prefer paint_rows for drawing sprites (ASCII art + legend). Coordinates are 0-based, canvas is small (often 16x16 or 32x32).
- Batch independent read-only calls in one turn (get_document + list_templates, ...).
- Tool results arrive as USER messages wrapped in <tool_response>. If a call fails, change approach with the error in mind — do not repeat the same failing call.
- Keep going until the goal is truly done, then call done with a short summary. If blocked on a human decision, call ask_user with one question.
- Never dump binary/data URLs into chat; tool results are already compacted for you.
- EVERY reply must be one or more <tool_call> blocks, or done/ask_user. No prose outside tool calls.

# Tools
You may call one or more functions to assist with the user query.
Signatures (name(arg1,arg2) [required] — one-line description):
${catalogText(tools)}
For each function call, return a json object with function name and arguments within <tool_call></tool_call> XML tags:
<tool_call>
{"name": <function-name>, "arguments": <args-json-object>}
</tool_call>`;
  }
  const turnSuffix = () => 'Decide the next smallest set of high-value actions. Emit one or more <tool_call> blocks, or call done if the goal is complete. Do not wrap the tool calls in markdown fences. Do not emit a JSON envelope.';
  const repairPrompt = prior => `FORMAT REPAIR
Your prior response was not valid tool-call XML. Do not continue the task yet.
Convert the intended next step into one or more <tool_call> blocks using this exact shape:
<tool_call>
{"name": "tool_name", "arguments": {}}
</tool_call>
If the task is already complete, call done. If you need a human, call ask_user.
No markdown fences. No JSON envelope. No prose outside the tool calls.

PRIOR OUTPUT
${(prior || '').slice(0, 8000)}`;

  /* ---------- multi-format parser (protocol.py port) ---------- */
  const THINK_RE = /<\s*think\s*>([\s\S]*?)<\s*\/\s*think\s*>/gi;
  const TOOL_RE = /<\s*tool_call\s*>([\s\S]*?)<\s*\/\s*tool_call\s*>/gi;
  const TOOL_OPEN_RE = /<\s*tool_call\s*>/i;
  const FENCE_RE = /```tool[^\n]*\n([\s\S]*?)```/gi;
  const QWEN_FN_RE = /✿FUNCTION✿\s*:\s*([A-Za-z_][\w-]*)\s*✿ARGS✿\s*:\s*(.*?)(?=✿FUNCTION✿|$)/gs;
  const INVOKE_RE = /<\s*invoke\s+name=["']([^"']+)["']\s*>([\s\S]*?)<\/\s*invoke\s*>/i;
  const PARAM_RE = /<\s*parameter\s+name=["']([^"']+)["']\s*>([\s\S]*?)<\/\s*parameter\s*>/gi;
  const FN_EQ_RE = /<\s*function\s*=\s*([A-Za-z_][\w-]*)\s*>([\s\S]*?)<\/\s*function\s*>/i;
  const NAME_LINE_RE = /^\s*(?:name|tool)\s*[=:]\s*([A-Za-z_][\w-]*)\s*$/i;
  const DONE = new Set(['done', 'finish', 'submit', 'complete']);
  const ASK = new Set(['ask_user', 'ask', 'needs_input']);

  function balancedJson(text) {
    const out = [];
    for (let s = 0; s < text.length; s++) {
      if (text[s] !== '{') continue;
      let depth = 0, quoted = false, esc = false;
      for (let i = s; i < text.length; i++) {
        const c = text[i];
        if (quoted) { if (esc) esc = false; else if (c === '\\') esc = true; else if (c === '"') quoted = false; continue; }
        if (c === '"') quoted = true;
        else if (c === '{') depth++;
        else if (c === '}') { depth--; if (!depth) { out.push(text.slice(s, i + 1)); break; } }
      }
    }
    return out;
  }
  function decodeObj(s) {
    for (const v of [s, s.replace(/,\s*([}\]])/g, '$1')]) {
      try { const o = JSON.parse(v); if (o && typeof o === 'object' && !Array.isArray(o)) return o; } catch {}
    }
    return null;
  }
  function decodeLoose(text) {
    text = (text || '').trim();
    if (!text) return null;
    const direct = decodeObj(text);
    if (direct) return direct;
    const a = text.indexOf('{'), b = text.lastIndexOf('}');
    return a >= 0 && b > a ? decodeObj(text.slice(a, b + 1)) : null;
  }
  function normName(n) {
    const c = String(n || '').trim().replace(/[\s-]+/g, '_').replace(/^_+|_+$/g, '').toLowerCase();
    if (DONE.has(c)) return 'done';
    if (ASK.has(c)) return 'ask_user';
    return c;
  }
  function coerceArgs(v) {
    if (v && typeof v === 'object') return v;
    if (typeof v === 'string') {
      const p = decodeLoose(v);
      if (p) return p;
      if (v.trim()) return { value: v };
    }
    return {};
  }
  function action(name, args) {
    const tool = normName(name);
    if (!tool || !/^[a-z_][a-z0-9_]*$/.test(tool)) return null;
    return { tool, arguments: coerceArgs(args) };
  }
  function fromMapping(p) {
    let name = p.name || p.tool || p.function;
    if (name && typeof name === 'object') name = name.name;
    if (typeof name !== 'string') return null;
    const args = 'arguments' in p ? p.arguments : 'parameters' in p ? p.parameters : 'args' in p ? p.args
      : Object.fromEntries(Object.entries(p).filter(([k]) => !['name', 'tool', 'function', 'thought'].includes(k)));
    return action(name, args);
  }
  function parseBody(body) {
    const text = (body || '').trim();
    if (!text) return null;
    const payload = decodeLoose(text);
    if (payload) { const a = fromMapping(payload); if (a) return a; }
    const inv = INVOKE_RE.exec(text);
    if (inv) { const params = {}; let m; PARAM_RE.lastIndex = 0; while ((m = PARAM_RE.exec(inv[2]))) params[m[1]] = m[2].trim(); return action(inv[1], params); }
    const feq = FN_EQ_RE.exec(text);
    if (feq) { const params = {}; let m; PARAM_RE.lastIndex = 0; while ((m = PARAM_RE.exec(feq[2]))) params[m[1]] = m[2].trim();
      return action(feq[1], Object.keys(params).length ? params : (decodeLoose(feq[2]) || {})); }
    const lines = text.split('\n').filter(l => l.trim());
    if (lines.length) {
      const named = NAME_LINE_RE.exec(lines[0]);
      if (named) { const rest = lines.slice(1).join('\n').trim(); return action(named[1], rest ? (decodeLoose(rest) || {}) : {}); }
      if (lines.length >= 2 && /^[A-Za-z_][\w-]*$/.test(lines[0].trim())) return action(lines[0].trim(), decodeLoose(lines.slice(1).join('\n')) || {});
    }
    return null;
  }
  function hermesActions(text) {
    const out = [];
    let m; TOOL_RE.lastIndex = 0;
    while ((m = TOOL_RE.exec(text))) { const a = parseBody(m[1]); if (a) out.push(a); }
    if (out.length) return out;
    if (TOOL_OPEN_RE.test(text) && !/<\/\s*tool_call\s*>/i.test(text)) {
      const a = parseBody(text.slice(text.search(TOOL_OPEN_RE) + text.match(TOOL_OPEN_RE)[0].length));
      if (a) out.push(a);
    }
    return out;
  }
  function qwenFnActions(text) {
    const out = [];
    let m; QWEN_FN_RE.lastIndex = 0;
    while ((m = QWEN_FN_RE.exec(text))) { const a = action(m[1], m[2]); if (a) out.push(a); }
    return out;
  }
  function fenceActions(text) {
    const out = [];
    let m; FENCE_RE.lastIndex = 0;
    while ((m = FENCE_RE.exec(text))) { const a = parseBody(m[1]); if (a) out.push(a); }
    return out;
  }
  function jsonEnvelope(text) {
    const cands = [text];
    let m; const fr = /```(?:json)?\s*(\{[\s\S]*?\})\s*```/gi;
    while ((m = fr.exec(text))) cands.push(m[1]);
    cands.push(...balancedJson(text));
    const seen = new Set();
    let best = null;
    for (const c of cands) {
      if (seen.has(c)) continue; seen.add(c);
      const p = decodeObj(c);
      if (!p) continue;
      if ('actions' in p || 'thought' in p || 'final' in p || 'needs_input' in p || 'summary' in p) return p;
      if (!best && ('tool' in p || 'name' in p)) best = p;
    }
    return best;
  }
  function normJsonActions(p) {
    let acts = p.actions;
    if (acts && !Array.isArray(acts)) acts = [acts];
    if (!Array.isArray(acts)) { const s = fromMapping(p); return s ? [s] : []; }
    return acts.filter(a => a && typeof a === 'object').map(fromMapping).filter(Boolean);
  }
  function splitControl(actions) {
    const work = [];
    let final = '', needsInput = false, question = '';
    (actions || []).forEach(a => {
      const args = a.arguments || {};
      if (a.tool === 'done') { final = String(args.summary || args.final || args.message || '').trim(); return; }
      if (a.tool === 'ask_user') { needsInput = true; question = String(args.question || args.message || '').trim(); return; }
      work.push(a);
    });
    return { work, final, needsInput, question };
  }
  function parseResponse(raw) {
    let text = (raw || '').trim();
    const thinks = [...text.matchAll(THINK_RE)].map(m => m[1].trim()).filter(Boolean);
    if (thinks.length) text = text.replace(THINK_RE, '\n').trim();
    const hermes = hermesActions(text);
    const qwenFn = hermes.length ? [] : qwenFnActions(text);
    const fences = (hermes.length || qwenFn.length) ? [] : fenceActions(text);
    const payload = jsonEnvelope(text);
    const jsonActs = payload ? normJsonActions(payload) : [];
    let protocol = 'none', actions = [];
    if (hermes.length) { protocol = 'hermes'; actions = hermes; }
    else if (qwenFn.length) { protocol = 'qwen_fn'; actions = qwenFn; }
    else if (fences.length) { protocol = 'fence'; actions = fences; }
    else if (jsonActs.length) { protocol = 'json'; actions = jsonActs; }
    else if (payload && ('thought' in payload || 'final' in payload || 'needs_input' in payload || 'summary' in payload)) protocol = 'json';
    let thought = '', final = '', needsInput = false, summary = '';
    if (payload && protocol !== 'none') {
      thought = String(payload.thought || ''); final = String(payload.final || '');
      needsInput = !!payload.needs_input; summary = String(payload.summary || '');
    }
    const ctl = splitControl(actions);
    if (ctl.final && !final) final = ctl.final;
    if (ctl.needsInput) { needsInput = true; if (ctl.question && !thought) thought = ctl.question; }
    const parseOk = protocol !== 'none' || !!ctl.work.length || !!final;
    if (!parseOk) return { thought: text.slice(0, 12000), actions: [], final: '', needsInput: true, question: text.slice(0, 2000), summary: '', protocol: 'none', parseOk: false };
    if (!thought && protocol !== 'json') thought = text.replace(TOOL_RE, '\n').replace(FENCE_RE, '\n').replace(QWEN_FN_RE, '\n').trim();
    return { thought: thought.slice(0, 20000), actions: ctl.work.slice(0, MAX_ACTIONS), final: final.slice(0, 30000), needsInput, question: ctl.question, summary: summary.slice(0, 12000), protocol, parseOk: true };
  }

  /* ---------- tool-result compaction (never feed data URLs / full dumps back) ---------- */
  function compactResult(tool, result) {
    let s;
    try { s = JSON.stringify(result, (k, x) => (typeof x === 'string' && (x.startsWith('data:') || x.length > 1200) ? `[${x.length}b]` : x)); }
    catch { s = String(result); }
    if (tool === 'get_pixels' && result && result.rows) {
      const rows = result.rows.slice(0, 40);
      s = JSON.stringify({ width: result.width, height: result.height, bounds: result.bounds, colors: (result.colors || []).slice(0, 24), rows, truncated: result.rows.length > 40 });
    }
    if (s.length > MAX_RESULT) s = s.slice(0, MAX_RESULT) + `\n…[truncated ${s.length - MAX_RESULT}b — call get_document for fresh state]`;
    return s;
  }
  const wrapCall = (name, args) => `<tool_call>\n${JSON.stringify({ name, arguments: args || {} })}\n</tool_call>`;
  const wrapResp = (name, body) => `<tool_response name="${name}">\n${body}\n</tool_response>`;
  function docSnapshot() {
    try {
      const d = PF.Store.summary();
      return `Canvas ${d.width}x${d.height} "${d.name}" · states[${d.states.map((s, i) => `${i}:${s.name}(${s.frames}f)`).join(', ')}] active=${d.activeState}/${d.activeFrame} layer=${d.layers[d.activeLayer] ? d.layers[d.activeLayer].name : d.activeLayer} color=${d.color}`;
    } catch { return 'Canvas state unavailable'; }
  }

  /* ---------- goal loop (one Nebians session per goal, deleted when done) ----------
     Nebians caps each message (~8000 chars) and replays session history per turn,
     so the system+tools bootstrap goes in the first message and later turns stay
     small. MAX_MSG keeps every send under the cap. */
  const MAX_MSG = 7800;
  function fitBlocks(blocks) {
    let keep = blocks.slice();
    while (keep.join('\n\n').length > MAX_MSG && keep.length > 1) keep = keep.slice(-3);
    let text = keep.join('\n\n');
    if (blocks.length > keep.length) text = '[earlier tool results trimmed for length]\n\n' + text;
    return text.slice(0, MAX_MSG);
  }
  async function runGoal({ model, goal, history = [], fullTools = true, signal, onEvent }) {
    const emit = onEvent || (() => {});
    const tools = toolList(fullTools);
    let sys = systemPrompt(tools, model);
    if (sys.length > 7000) sys = systemPrompt(toolList(false), model); // stay under the per-message cap
    if (!PF.Nebians.splitRef(model)) return { status: 'error', error: `Unknown model "${model}" — refresh the model list.` };
    const past = history.slice(-6).map(m => `${m.role === 'user' ? 'User' : 'Agent'}: ${String(m.content || '').slice(0, 300)}`).join('\n');
    const boot = [
      'MEMORIZE THIS PROTOCOL — it applies to the whole session. Every reply must be <tool_call> blocks or done/ask_user, no other prose.',
      sys,
      past ? `Earlier in this console:\n${past}` : '',
      `GOAL: ${goal}`,
      `LIVE STATE: ${docSnapshot()}`,
      turnSuffix()
    ].filter(Boolean).join('\n\n').slice(0, MAX_MSG);
    let sess = null, transcript = null;
    try {
      if (await PF.Nebians.agentSupported().catch(() => false)) {
        transcript = [{ role: 'user', content: boot }]; // stateless: full history sent per turn
      } else {
        sess = await PF.Nebians.createSession(model, `PixelForge: ${goal.slice(0, 60)}`, signal);
      }
    } catch (e) {
      if (signal && signal.aborted) return { status: 'cancelled' };
      return { status: 'error', error: e.message, auth: !!e.auth, pipe: !!e.pipe };
    }
    emit({ type: 'session' });
    const finish = st => { if (sess) PF.Nebians.deleteSession(sess.family, sess.sessionId); return st; };
    async function sendTurn(blocks, opts) {
      if (transcript) {
        const body = [...transcript, { role: 'user', content: fitBlocks(blocks) }];
        const r = await PF.Nebians.agentChat(model, body, opts);
        transcript.push({ role: 'user', content: fitBlocks(blocks) }, { role: 'assistant', content: r.text.slice(0, 6000) });
        while (transcript.length > 5) transcript.splice(1, 1); // keep boot + recent; server caps input
        return r;
      }
      return PF.Nebians.sendMessage(sess.family, sess.sessionId, fitBlocks(blocks), opts);
    }
    let final = '', question = '', turnsUsed = 0, carry = [];
    for (let t = 0; t < MAX_TURNS; t++) {
      if (signal && signal.aborted) return finish({ status: 'cancelled' });
      turnsUsed = t + 1;
      emit({ type: 'turn', turn: turnsUsed });
      const blocks = t === 0 ? [boot] : (carry.length ? carry : [`LIVE STATE: ${docSnapshot()}\n\n${turnSuffix()}`]);
      carry = [];
      let raw;
      try {
        const r = await sendTurn(blocks, { signal, onToken: (text, kind) => emit({ type: 'token', text, kind }) });
        raw = r.text;
      } catch (e) {
        if (signal && signal.aborted) return finish({ status: 'cancelled' });
        if (e.auth) return finish({ status: 'error', error: e.message, auth: true });
        if (e.pipe) return finish({ status: 'error', error: e.message, pipe: true });
        if (e.retryable && t === 0) { await new Promise(r => setTimeout(r, 2500)); t--; continue; }
        return finish({ status: 'error', error: e.message });
      }
      let p = parseResponse(raw);
      if (!p.parseOk) {
        emit({ type: 'repair' });
        try {
          const r = await sendTurn([repairPrompt(raw)], { signal });
          raw = r.text;
        } catch (e) { return finish({ status: 'error', error: e.message, auth: !!e.auth, pipe: !!e.pipe }); }
        p = parseResponse(raw);
        if (!p.parseOk) return finish({ status: 'needs-input', question: `I couldn't parse the model's reply into tool calls. ${raw.slice(0, 500)}`, turnsUsed });
      }
      emit({ type: 'thought', text: p.thought, protocol: p.protocol });
      const responses = [];
      let stop = false;
      for (const a of p.actions) {
        if (signal && signal.aborted) return finish({ status: 'cancelled' });
        const r = await PF.Tools.call(a.tool, { ...(a.arguments || {}) });
        const body = r.ok ? compactResult(a.tool, r.result) : `ERROR: ${r.error}`;
        emit({ type: 'tool', tool: a.tool, ok: r.ok });
        responses.push(wrapResp(a.tool, body));
        if (!r.ok && /unknown tool/i.test(r.error || '')) { responses.push(`Unknown tool "${a.tool}". Valid names: ${tools.map(x => x.name).join(', ')}. ${turnSuffix()}`); stop = true; break; }
      }
      if (p.final || (!p.actions.length && !p.needsInput)) { final = p.final || p.thought.slice(0, 2000); return finish({ status: 'done', final, turnsUsed }); }
      if (p.needsInput) { question = p.question || p.thought.slice(0, 2000); return finish({ status: 'needs-input', question, turnsUsed }); }
      if (stop) { carry = responses; continue; }
      carry = [...responses, `LIVE STATE: ${docSnapshot()}\n\n${turnSuffix()}`];
    }
    return finish({ status: 'done', final: final || 'Goal turns used up. The canvas was updated — check the result, undo is available.', turnsUsed });
  }

  return { CORE, VIRTUAL, toolList, systemPrompt, parseResponse, repairPrompt, compactResult, docSnapshot, runGoal, MAX_TURNS };
})();
