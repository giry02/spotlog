const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../../web/dist');
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.avif': 'image/avif', '.gif': 'image/gif', '.woff2': 'font/woff2', '.mp4': 'video/mp4' };
http.createServer((request, response) => {
  let decoded;
  try { decoded = decodeURIComponent(new URL(request.url, 'http://localhost').pathname); }
  catch { response.writeHead(400); response.end('Invalid path'); return; }
  const relative = decoded.startsWith('/spotlog/') ? decoded.slice('/spotlog/'.length) : null;
  let target = relative === null ? '' : path.resolve(root, relative || 'index.html');
  if (target === root || (target && target.startsWith(root + path.sep))) {
    try { if (fs.statSync(target).isDirectory()) target = path.join(target, 'index.html'); } catch { target = ''; }
  } else target = '';
  const exists = Boolean(target && fs.existsSync(target) && fs.statSync(target).isFile());
  const file = exists ? target : path.join(root, '404.html');
  response.writeHead(exists ? 200 : 404, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  if (request.method === 'HEAD') response.end(); else fs.createReadStream(file).pipe(response);
}).listen(5295, '127.0.0.1', () => console.log('Static release QA http://127.0.0.1:5295/spotlog/'));
