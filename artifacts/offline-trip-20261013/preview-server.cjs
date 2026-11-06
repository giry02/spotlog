const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../../web/dist');
const types = { '.html':'text/html; charset=utf-8', '.js':'application/javascript; charset=utf-8', '.css':'text/css; charset=utf-8', '.json':'application/json; charset=utf-8', '.png':'image/png', '.jpg':'image/jpeg', '.webp':'image/webp', '.svg':'image/svg+xml', '.woff2':'font/woff2' };
http.createServer((req,res) => {
  const url = new URL(req.url, 'http://localhost');
  let pathname; try { pathname = decodeURIComponent(url.pathname); } catch { res.writeHead(400).end(); return; }
  if (!pathname.startsWith('/spotlog/')) { res.writeHead(404).end(); return; }
  const file = path.resolve(root, pathname.slice('/spotlog/'.length) || 'index.html');
  if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404).end(); return; }
  res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Cache-Control':'no-cache' });
  if (req.method === 'HEAD') res.end(); else fs.createReadStream(file).pipe(res);
}).listen(5293, '127.0.0.1', () => console.log('Offline review: http://127.0.0.1:5293/spotlog/'));
