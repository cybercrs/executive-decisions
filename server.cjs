// Optional local server for browser installation. Opening index.html needs no server.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = __dirname;
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png' };
const requestedPort = Number(process.env.EXECUTIVE_PORT || 4173);
if (!Number.isInteger(requestedPort) || requestedPort < 1024 || requestedPort > 65535) throw new Error('EXECUTIVE_PORT must be between 1024 and 65535.');
const server = http.createServer((req, res) => {
  let pathname;
  try { pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); }
  catch { res.writeHead(400); return res.end('Invalid request'); }
  const target = path.resolve(root, `.${pathname === '/' ? '/index.html' : pathname}`);
  if (!target.startsWith(root + path.sep)) { res.writeHead(403); return res.end('Forbidden'); }
  fs.readFile(target, (err, data) => {
    if (err) { res.writeHead(404); return res.end('File not found'); }
    res.writeHead(200, { 'Content-Type': types[path.extname(target)] || 'application/octet-stream', 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff' }); res.end(data);
  });
});
server.on('error', error => { process.stderr.write(`Could not start Executive Decisions: ${error.message}\n`); process.exit(1); });
server.listen(requestedPort, '127.0.0.1', () => process.stdout.write(`Executive Decisions: http://127.0.0.1:${requestedPort}\nKeep this window open while using the app. Press Ctrl+C to stop.\n`));
