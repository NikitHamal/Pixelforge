/* Zero-dependency static file server for local development.

   The studio reads ?project= query params and writes to localStorage, both of
   which behave inconsistently over file:// — serve over http instead.

   Usage: node scripts/serve.js [port]      (default 5173)
*/
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PORT = Number(process.argv[2]) || 5173;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2'
};

/* Same-origin pipe to the NEBians API for the studio agent (js/agent/nebians.js).
   PixelForge is a client of Nebians — every free LLM there (community proxies,
   Qwen, DeepAI, Inception) is reached through THEIR endpoints, not ours:
   login, live model catalog, chat sessions and SSE streaming all live server-side.
   nebians.consica.com.np sends no CORS headers, so the browser cannot call it
   directly; this endpoint forwards allowlisted /api/* requests and streams back.
   Only active under `node scripts/serve.js` — static hosts simply 404, and the
   agent says so with instructions. The pipe is dumb: it never sees credentials
   except the Authorization header the browser attaches per call, and it keeps
   no state (Nebians sessions are token-scoped server-side). */
const NEBIAN_HOST = (process.env.NEBIANS_BASE || 'https://nebians.consica.com.np').replace(/\/+$/, '');
// Optional server-side credential: export NEBIANS_TOKEN=<your Nebians authToken>
// before starting the server and the browser never needs to hold any secret —
// the pipe attaches it. A token sent by the browser (multi-user) takes precedence.
// Neither is ever logged, persisted, or echoed back by this server.
const NEBIAN_ENV_TOKEN = process.env.NEBIANS_TOKEN || '';
function serveRelay(req, res) {
  const url = (req.url || '').split('?')[0];
  if (req.method === 'GET' && url === '/api/nebian/status') {
    res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ pipe: true, host: NEBIAN_HOST, serverAuth: !!NEBIAN_ENV_TOKEN }));
    return true;
  }
  if (req.method !== 'POST' || url !== '/api/nebian') return false;
  let raw = '';
  req.on('data', c => { raw += c; if (raw.length > 524288) req.destroy(); });
  req.on('end', async () => {
    try {
      const { method, path, body, authorization } = JSON.parse(raw || '{}');
      const verb = ['GET', 'POST', 'PATCH', 'DELETE'].includes(method) ? method : null;
      const okPath = typeof path === 'string' && /^\/api\/[A-Za-z0-9._~:/?#[\]@!$&'()*+,;=%-]+$/.test(path);
      if (!verb || !okPath) { res.writeHead(400, { 'Content-Type': 'application/json' }).end(JSON.stringify({ error: 'Unknown method or path' })); return; }
      const headers = { Accept: 'application/json, text/event-stream' };
      const who = (typeof authorization === 'string' && /^Bearer [A-Za-z0-9._~-]+$/.test(authorization)) ? authorization : (NEBIAN_ENV_TOKEN ? `Bearer ${NEBIAN_ENV_TOKEN}` : '');
      if (who) headers.Authorization = who;
      const init = { method: verb, headers, signal: AbortSignal.timeout(300000) };
      if (verb === 'POST' || verb === 'PATCH') { headers['Content-Type'] = 'application/json'; init.body = JSON.stringify(body || {}); }
      const up = await fetch(NEBIAN_HOST + path, init);
      const ctype = up.headers.get('content-type') || 'application/json';
      if (!up.ok && !ctype.includes('text/event-stream')) { // real status + body straight through
        const buf = up.body ? Buffer.from(await up.arrayBuffer()) : Buffer.alloc(0);
        res.writeHead(up.status, { 'Content-Type': ctype, 'Cache-Control': 'no-store' }).end(buf);
        return;
      }
      if (!up.ok) { res.writeHead(up.status, { 'Content-Type': 'application/json' }).end(JSON.stringify({ error: `Upstream HTTP ${up.status}` })); return; }
      if (!up.body || !ctype.includes('text/event-stream')) {
        const buf = up.body ? Buffer.from(await up.arrayBuffer()) : Buffer.alloc(0);
        res.writeHead(200, { 'Content-Type': ctype, 'Cache-Control': 'no-store' }).end(buf);
        return;
      }
      res.writeHead(200, { 'Content-Type': ctype, 'Cache-Control': 'no-store' });
      for await (const chunk of up.body) res.write(chunk);
      res.end();
    } catch (e) { try { res.writeHead(502, { 'Content-Type': 'application/json' }).end(JSON.stringify({ error: String(e.message || e) })); } catch {} }
  });
  return true;
}

http.createServer((req, res) => {
  if (serveRelay(req, res)) return;
  const url = decodeURIComponent((req.url || '/').split('?')[0].split('#')[0]);
  let rel = url === '/' ? 'index.html' : url.replace(/^\/+/, '');
  let file = path.resolve(ROOT, rel);

  // never escape the project root
  if (!file.startsWith(ROOT)) { res.writeHead(403).end('Forbidden'); return; }
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');

  fs.readFile(file, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' }).end('404 ' + rel);
      console.log('404 ' + rel);
      return;
    }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(data);
  });
}).listen(PORT, () => {
  console.log(`PixelForge dev server -> http://localhost:${PORT}/`);
  console.log(`  studio  http://localhost:${PORT}/studio.html`);
  console.log(`  app     http://localhost:${PORT}/app/`);
  console.log(`  game    http://localhost:${PORT}/games/runefall/`);
});
