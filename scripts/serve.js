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
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2'
};

http.createServer((req, res) => {
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
