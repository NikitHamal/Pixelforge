/* PixelForge Studio — Model Context Protocol (MCP) surface.
   Exposes the tool registry as an MCP server manifest and handles JSON-RPC 2.0 requests
   (initialize, tools/list, tools/call, resources/list, resources/read). A local bridge
   (stdio ⇄ WebSocket) can forward requests here so any MCP client can drive the studio. */
window.PF = window.PF || {};
PF.MCP = (() => {
  const SERVER = { name: 'pixelforge-studio', version: '1.0.0', protocolVersion: '2025-06-18' };
  let ws = null, statusEl = null;

  const manifest = () => ({
    ...SERVER, description: '2D pixel-art game asset studio: draw pixels, build animation states, export sprite sheets/GIF/JSON.',
    capabilities: { tools: { listChanged: false }, resources: { subscribe: false, listChanged: false } },
    tools: PF.Tools.list().map(({ name, description, inputSchema }) => ({ name, description, inputSchema })),
    resources: RESOURCES.map(r => ({ uri: r.uri, name: r.name, mimeType: r.mimeType, description: r.description }))
  });

  const RESOURCES = [
    { uri: 'pixelforge://document', name: 'Document summary', mimeType: 'application/json', description: 'Size, layers, states, palette', read: () => JSON.stringify(PF.Store.summary(), null, 2) },
    { uri: 'pixelforge://pixels', name: 'Active frame pixels', mimeType: 'application/json', description: 'Composited rows of hex colors', read: async () => JSON.stringify((await PF.Tools.call('get_pixels', {})).result) },
    { uri: 'pixelforge://preview.png', name: 'Active frame preview', mimeType: 'image/png', description: 'PNG data URL', read: () => PF.IO.dataURL(4) },
    { uri: 'pixelforge://project', name: 'Project file', mimeType: 'application/json', description: 'Lossless project JSON', read: () => PF.Store.serialize() },
    { uri: 'pixelforge://presets', name: 'Animation presets', mimeType: 'application/json', description: 'Common game states', read: () => JSON.stringify(PF.Anim.PRESETS) }
  ];

  const ok = (id, result) => ({ jsonrpc: '2.0', id, result });
  const fail = (id, code, message) => ({ jsonrpc: '2.0', id, error: { code, message } });

  /* JSON-RPC 2.0 handler (single request or batch) */
  async function handle(req) {
    if (typeof req === 'string') { try { req = JSON.parse(req); } catch { return fail(null, -32700, 'Parse error'); } }
    if (Array.isArray(req)) return Promise.all(req.map(handle));
    const { id, method, params = {} } = req || {};
    if (!method) return fail(id ?? null, -32600, 'Invalid request');
    switch (method) {
      case 'initialize': return ok(id, { protocolVersion: SERVER.protocolVersion, capabilities: manifest().capabilities, serverInfo: { name: SERVER.name, version: SERVER.version }, instructions: 'Call get_document first. Draw with paint_rows (ASCII art) or shape tools. Use add_state/add_frame for animations, render_preview to inspect, export to download.' });
      case 'notifications/initialized': case 'ping': return ok(id, {});
      case 'tools/list': return ok(id, { tools: manifest().tools });
      case 'tools/call': {
        const r = await PF.Tools.call(params.name, params.arguments || {});
        if (!r.ok) return ok(id, { isError: true, content: [{ type: 'text', text: r.error }] });
        const content = [];
        if (r.result && typeof r.result.dataUrl === 'string') content.push({ type: 'image', data: r.result.dataUrl.split(',')[1], mimeType: 'image/png' });
        content.push({ type: 'text', text: JSON.stringify(r.result ?? { ok: true }) });
        return ok(id, { content, structuredContent: r.result });
      }
      case 'resources/list': return ok(id, { resources: manifest().resources });
      case 'resources/read': {
        const res = RESOURCES.find(r => r.uri === params.uri); if (!res) return fail(id, -32602, `Unknown resource ${params.uri}`);
        const data = await res.read();
        return ok(id, { contents: [res.mimeType === 'image/png' ? { uri: res.uri, mimeType: res.mimeType, blob: data.split(',')[1] } : { uri: res.uri, mimeType: res.mimeType, text: data }] });
      }
      case 'prompts/list': return ok(id, { prompts: [] });
      default: return fail(id, -32601, `Method not found: ${method}`);
    }
  }

  /* WebSocket bridge: a tiny local process speaks MCP stdio to the client and relays JSON-RPC here. */
  function connect(url) {
    disconnect(); setStatus('connecting…', 'pending');
    try { ws = new WebSocket(url); } catch (e) { setStatus(`invalid url`, 'error'); return false; }
    ws.onopen = () => { setStatus(`connected to ${url}`, 'ok'); ws.send(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/pixelforge/ready', params: manifest() })); };
    ws.onmessage = async ev => { const res = await handle(ev.data); if (res && (Array.isArray(res) || res.id !== undefined)) ws.send(JSON.stringify(res)); };
    ws.onclose = () => { setStatus('disconnected', 'idle'); ws = null; };
    ws.onerror = () => setStatus('connection failed — is the bridge running?', 'error');
    return true;
  }
  function disconnect() { if (ws) { ws.onclose = null; ws.close(); ws = null; } setStatus('not connected', 'idle'); }
  function setStatus(text, kind) { if (statusEl) { statusEl.textContent = text; statusEl.dataset.kind = kind; } PF.Store.emit('mcp', { text, kind }); }

  const CLIENT_CONFIG = () => JSON.stringify({ mcpServers: { pixelforge: { command: 'npx', args: ['-y', 'pixelforge-mcp-bridge', '--ws', 'ws://localhost:7331'] } } }, null, 2);
  const BRIDGE_SNIPPET = `// pixelforge-mcp-bridge (Node) — stdio ⇄ WebSocket relay, ~30 lines
import { WebSocketServer } from 'ws';
const wss = new WebSocketServer({ port: 7331 }); let studio = null;
wss.on('connection', s => { studio = s; s.on('message', m => process.stdout.write(m + '\\n')); });
let buf = ''; process.stdin.on('data', d => { buf += d; let i;
  while ((i = buf.indexOf('\\n')) >= 0) { const line = buf.slice(0, i); buf = buf.slice(i + 1);
    if (line.trim() && studio) studio.send(line); } });
// In the browser: PixelForge.mcp.connect('ws://localhost:7331')`;

  /* Render into the marketing section */
  function mount({ manifestEl, configEl, bridgeEl, status, urlInput, connectBtn, disconnectBtn, countEl }) {
    statusEl = status;
    const m = manifest();
    if (countEl) countEl.textContent = m.tools.length;
    if (manifestEl) manifestEl.textContent = JSON.stringify({ ...m, tools: m.tools.slice(0, 3).concat([`… ${m.tools.length - 3} more tools`]) }, null, 2);
    if (configEl) configEl.textContent = CLIENT_CONFIG();
    if (bridgeEl) bridgeEl.textContent = BRIDGE_SNIPPET;
    connectBtn?.addEventListener('click', () => connect(urlInput.value.trim() || 'ws://localhost:7331'));
    disconnectBtn?.addEventListener('click', disconnect);
    setStatus('not connected', 'idle');
  }
  const copy = async text => { try { await navigator.clipboard.writeText(text); PF.UI.toast('Copied to clipboard'); } catch { PF.UI.toast('Copy failed'); } };
  window.PixelForge && (window.PixelForge.mcp = { manifest, handle, connect, disconnect });
  return { manifest, handle, connect, disconnect, mount, copy, CLIENT_CONFIG, SERVER, RESOURCES };
})();
