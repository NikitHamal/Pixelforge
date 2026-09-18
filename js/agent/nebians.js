/* PixelForge Studio — NEBians API client. PixelForge is a CLIENT of Nebians:
   every free LLM (community proxies, Qwen, DeepAI, Inception) is reached through
   THEIR endpoints — login, live model catalog, chat sessions and SSE streaming
   all live server-side in F:/NEB (backend_python/api/arena_*_views.py).
   No provider wire protocols are re-implemented here.

   Auth: the user's Nebians account (email/username + password → authToken, or a
   pasted token). The token lives in localStorage only and is attached per call.
   Transport: nebians.consica.com.np sends no CORS headers, so calls go through
   the dumb same-origin pipe in scripts/serve.js (`node scripts/serve.js`).
   Without the dev server the agent says so and falls back to local recipes.

   No native tool calling server-side either, so PF.Harness drives the same
   Hermes <tool_call> text protocol over session messages (one session per goal,
   deleted when done; server replays history per turn). */
window.PF = window.PF || {};
PF.Nebians = (() => {
  const BASE_KEY = 'pf-nebians-base', TOKEN_KEY = 'pf-nebians-token', USER_KEY = 'pf-nebians-user', MODELS_KEY = 'pf-nebians-models';
  const DEFAULT_BASE = 'https://nebians.consica.com.np';
  const MODELS_TTL = 3600000;
  const DEFAULT_MODEL = 'unikey:gpt-5.5';

  const FAMILIES = {
    community: { models: '/api/neby-arena/models/', create: '/api/neby-arena/sessions/', send: id => `/api/neby-arena/sessions/${id}/messages/`, del: id => `/api/neby-arena/sessions/${id}/` },
    qwen: { models: '/api/neby-arena/qwen/models/', create: '/api/neby-arena/qwen/sessions/', send: id => `/api/neby-arena/qwen/sessions/${id}/messages/sse/`, del: null },
    deepai: { models: '/api/neby-arena/deepai/models/', create: '/api/neby-arena/deepai/sessions/', send: id => `/api/neby-arena/deepai/sessions/${id}/messages/sse/`, del: null },
    inception: { models: '/api/neby-arena/inception/models/', create: '/api/neby-arena/inception/sessions/', send: id => `/api/neby-arena/inception/sessions/${id}/messages/`, del: null }
  };
  const PROVIDER_LABELS = { unikey: 'Unikey', k2think: 'K2Think', poolside: 'Poolside', motiftech: 'Motif', qwencloud: 'QwenCloud', yqcloud: 'Yqcloud', chatjimmy: 'ChatJimmy', ptero: 'Ptero', qwen: 'Qwen', deepai: 'DeepAI', inception: 'Inception' };
  const labelOf = slug => PROVIDER_LABELS[slug] || (slug ? slug[0].toUpperCase() + slug.slice(1) : 'Nebians');

  const err = (message, extra = {}) => Object.assign(new Error(message), { retryable: false, status: 0, auth: false }, extra);
  const base = () => { try { return (localStorage.getItem(BASE_KEY) || '').trim() || DEFAULT_BASE; } catch { return DEFAULT_BASE; } };
  const token = () => { try { return localStorage.getItem(TOKEN_KEY) || ''; } catch { return ''; } };
  const authed = () => !!token();
  const user = () => { try { return localStorage.getItem(USER_KEY) || ''; } catch { return ''; } };

  let pipeSeen = null, serverAuthSeen = false;
  async function pipeUp() {
    if (pipeSeen !== null) return pipeSeen;
    try {
      const r = await fetch('/api/nebian/status', { method: 'GET', cache: 'no-store' });
      const d = await r.json();
      pipeSeen = r.ok && d.pipe === true;
      serverAuthSeen = pipeSeen && d.serverAuth === true;
    } catch { pipeSeen = false; }
    return pipeSeen;
  }
  /* Auth state for the UI: pipe reachable? server-side env token? browser token?
     The pipe probe is cached; call refreshAuth() to re-probe (cheap, local). */
  async function refreshAuth() {
    pipeSeen = null;
    await pipeUp();
    return { pipe: pipeSeen, server: serverAuthSeen, token: authed(), user: user() };
  }
  /* True when the dev server carries its own NEBIANS_TOKEN — no browser login needed. */
  const serverAuth = () => serverAuthSeen;
  /* Dumb pipe: {method, path, body} → Nebians. Throws err (auth:true on 401). */
  async function pipe(path, { method = 'GET', body = null, auth = true, signal = null } = {}) {
    if (!(await pipeUp())) throw err('Nebians needs the dev server: run `node scripts/serve.js` and reload, then connect your Nebians account.', { pipe: true });
    const headers = { 'Content-Type': 'application/json' };
    const t = token();
    if (auth && t) headers.Authorization = `Bearer ${t}`;
    let r;
    try {
      r = await fetch('/api/nebian', { method: 'POST', headers,
        body: JSON.stringify({ method, path, body, authorization: (auth && t) ? `Bearer ${t}` : '' }), signal });
    } catch (e) {
      if (signal && signal.aborted) throw err('cancelled', {});
      throw err(`Cannot reach the dev-server pipe (${e.message}) — is \`node scripts/serve.js\` running?`, { pipe: true });
    }
    const ctype = r.headers.get('content-type') || '';
    if (r.status === 404) throw err('The server on this port has no Nebians pipe — kill it and run a fresh `node scripts/serve.js` from the PixelForge folder, then hard-refresh (Ctrl+Shift+R).', { pipe: true });
    if (!r.ok && !ctype.includes('text/event-stream')) {
      let msg = '';
      try { const d = await r.json(); msg = d.error || d.detail || d.message || ''; } catch { try { msg = (await r.text()).slice(0, 200); } catch {} }
      if (r.status === 401) throw err(`Nebians rejected the token (401): ${msg || 'sign in again.'}`, { status: 401, auth: true });
      throw err(`Nebians HTTP ${r.status}: ${msg}`.slice(0, 300), { status: r.status, retryable: r.status === 429 || r.status >= 500 });
    }
    return r;
  }

  /* ---------- auth ---------- */
  async function login(loginId, password, signal = null) {
    const r = await pipe('/api/auth/email/login/', { method: 'POST', body: { email: loginId, password }, auth: false, signal });
    const d = await r.json();
    if (!r.ok || !d.authToken) throw err(`Nebians sign-in failed: ${d.error || d.detail || r.status}`.slice(0, 220), { status: r.status, auth: r.status === 401 || r.status === 403 });
    try {
      localStorage.setItem(TOKEN_KEY, d.authToken);
      localStorage.setItem(USER_KEY, (d.user && (d.user.username || d.user.email)) || loginId);
      localStorage.removeItem(MODELS_KEY);
    } catch {}
    cachedModels = null;
    return { user: user() };
  }
  function logout() {
    try { localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(USER_KEY); localStorage.removeItem(MODELS_KEY); } catch {}
    cachedModels = null;
  }

  /* ---------- live model catalog ---------- */
  let cachedModels = null;
  try {
    const c = JSON.parse(localStorage.getItem(MODELS_KEY) || 'null');
    if (c && Date.now() - c.ts < MODELS_TTL && Array.isArray(c.models)) cachedModels = c.models;
  } catch {}
  const cap = (s, n) => { s = String(s == null ? '' : s); return s.length > n ? s.slice(0, n - 1) + '…' : s; };
  function normCommunity(m) {
    if (!m || !(m.id || m.code)) return null;
    const id = m.id || m.code, prov = m.provider || 'community';
    return { id: `community:${id}`, family: 'community', provider: prov, serverId: id,
      label: cap(m.name || id, 42), note: cap(labelOf(prov) + (m.thinking ? ' · thinking' : ''), 48) };
  }
  function normFamily(family, m) {
    if (!m || typeof m !== 'object') return null;
    if (m.locked) return null;
    const id = m.id || m.model || m.code || m.name;
    if (!id || typeof id !== 'string') return null;
    const prov = m.provider || family;
    const bits = [m.vision ? 'vision' : '', m.thinking ? 'thinking' : '', m.note || ''].filter(Boolean).join(' · ');
    return { id: `${family}:${id}`, family, provider: prov, serverId: id,
      label: cap(m.name || m.label || id, 42), note: cap(bits || labelOf(prov), 48) };
  }
  function readModels(d) {
    if (Array.isArray(d)) return d;
    if (d && Array.isArray(d.models)) return d.models;
    if (d && Array.isArray(d.data)) return d.data;
    return [];
  }
  async function fetchFamily(family) {
    const f = FAMILIES[family];
    const r = await pipe(f.models, { method: 'GET' });
    const list = readModels(await r.json());
    return family === 'community' ? list.map(normCommunity).filter(Boolean) : list.map(m => normFamily(family, m)).filter(Boolean);
  }
  /* Live catalog across every Nebians chat family. Never throws (falls back to cache). */
  async function liveModels() {
    if (!authed()) return cachedModels || [];
    const fams = Object.keys(FAMILIES), out = [], errors = {};
    for (const fam of fams) {
      try { out.push(...await fetchFamily(fam)); }
      catch (e) { errors[fam] = e.message; if (e.auth) throw e; }
    }
    if (out.length) {
      cachedModels = out;
      try { localStorage.setItem(MODELS_KEY, JSON.stringify({ ts: Date.now(), models: out })); } catch {}
    }
    return cachedModels || [];
  }
  function listModels() { return cachedModels || []; }
  function splitRef(ref) {
    const i = String(ref || '').indexOf(':');
    if (i < 0) return null;
    const family = ref.slice(0, i), serverId = ref.slice(i + 1);
    if (!FAMILIES[family] || !serverId) return null;
    return { family, serverId };
  }
  const modelOf = ref => (listModels().find(m => m.id === ref) || null);

  /* ---------- sessions ---------- */
  async function createSession(ref, title, signal = null) {
    const s = splitRef(ref);
    if (!s) throw err(`Unknown model "${ref}"`);
    const r = await pipe(FAMILIES[s.family].create, { method: 'POST', body: { modelId: s.serverId, title: (title || 'PixelForge agent').slice(0, 200) }, signal });
    const d = await r.json();
    const id = d && d.session && d.session.id;
    if (!r.ok || !id) throw err(`Nebians could not start a chat (${(d && (d.error || d.detail)) || r.status})`, { status: r.status, retryable: r.status >= 500 });
    return { family: s.family, sessionId: id };
  }
  async function deleteSession(family, sessionId) {
    const del = FAMILIES[family] && FAMILIES[family].del;
    if (!del) return;
    try { await pipe(del(sessionId), { method: 'DELETE' }); } catch {}
  }
  /* Stateless single-shot chat (POST /api/neby-arena/agent/). Newer servers have
     it; older ones 404 — agentSupported() probes once and the harness falls back
     to sessions. Same SSE shape, no rows kept server-side. */
  let agentApi = null;
  async function agentSupported() {
    if (agentApi !== null) return agentApi;
    try {
      await pipe('/api/neby-arena/agent/', { method: 'POST', body: { model: '__probe__', messages: [] } });
      agentApi = true;
    } catch (e) { agentApi = !!(e.status && e.status !== 404); }
    return agentApi;
  }
  async function readSSE(r, onToken) {
    const reader = r.body.getReader(), dec = new TextDecoder();
    let buf = '', text = '', reasoning = '';
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let i;
      while ((i = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
        if (!line.startsWith('data:')) continue;
        const data = line.slice(5).trim();
        if (!data || data === '[DONE]') continue;
        let ev;
        try { ev = JSON.parse(data); } catch { continue; }
        if (ev.error) throw err(`Nebians: ${ev.error.message || ev.error}`.slice(0, 240), { retryable: /limit|busy|upstream|overload|429|5\d\d/i.test(ev.error.message || '') });
        const c = ev.choices && ev.choices[0];
        if (!c) continue;
        const d = c.delta || {};
        if (c.finish_reason) break;
        if (typeof d.reasoning_content === 'string' && d.reasoning_content) reasoning += d.reasoning_content;
        else if (typeof d.reasoning === 'string' && d.reasoning) reasoning += d.reasoning;
        else if (typeof d.content === 'string' && d.content) { text += d.content; if (onToken) onToken(d.content, 'text'); }
      }
    }
    if (!text && reasoning) text = reasoning;
    if (!text.trim()) throw err('Nebians returned an empty reply', { retryable: true });
    return { text, reasoning };
  }
  async function agentChat(ref, messages, { signal = null, onToken = null } = {}) {
    const s = splitRef(ref);
    if (!s) throw err(`Unknown model "${ref}"`);
    const r = await pipe('/api/neby-arena/agent/', { method: 'POST', body: { model: s.serverId, messages }, signal });
    if (!r.ok || !r.body) {
      let msg = '';
      try { const d = await r.json(); msg = d.error || d.detail || ''; } catch {}
      throw err(`Nebians agent chat failed (${r.status}): ${msg}`.slice(0, 240), { status: r.status, retryable: r.status === 429 || r.status >= 500 });
    }
    return readSSE(r, onToken);
  }
  /* Send one message on a session; resolves full text (SSE content deltas). */
  async function sendMessage(family, sessionId, content, { signal = null, onToken = null } = {}) {
    const r = await pipe(FAMILIES[family].send(sessionId), { method: 'POST', body: { content }, signal });
    if (!r.ok || !r.body) {
      let msg = '';
      try { const d = await r.json(); msg = d.error || d.detail || ''; } catch {}
      throw err(`Nebians send failed (${r.status}): ${msg}`.slice(0, 240), { status: r.status, retryable: r.status === 429 || r.status >= 500 });
    }
    const ctype = r.headers.get('content-type') || '';
    if (!ctype.includes('text/event-stream')) { // non-streaming JSON fallback (some families)
      const t = await r.text();
      try {
        const d = JSON.parse(t);
        const text = String(d.reply || d.content || d.text || d.message || '').trim();
        if (text) { if (onToken) onToken(text, 'text'); return { text, reasoning: '' }; }
      } catch {}
      if (t.trim()) { if (onToken) onToken(t.trim(), 'text'); return { text: t.trim(), reasoning: '' }; }
      throw err('Nebians returned an empty reply', { retryable: true });
    }
    return readSSE(r, onToken);
  }

  return { DEFAULT_MODEL, base, token, authed, user, login, logout, pipeUp, serverAuth, refreshAuth, liveModels, listModels, modelOf, splitRef, agentSupported, agentChat, createSession, sendMessage, deleteSession, FAMILIES };
})();
