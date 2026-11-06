import { existsSync, readFileSync, statSync } from 'node:fs';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Plugin } from 'vite';

/** A built consumer preview shares device records with localhost, without controlling DEV or admin routes. */
export function offlinePreviewPlugin(): Plugin {
  const root = fileURLToPath(new URL('./dist/', import.meta.url));
  return {
    name: 'spotlog-offline-built-preview', apply: 'serve',
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        let pathname: string;
        try { pathname = decodeURIComponent(new URL(request.url ?? '/', 'http://localhost').pathname); } catch { return next(); }
        if (!pathname.startsWith('/spotlog/') || !['GET', 'HEAD'].includes(request.method ?? '')) return next();
        const relative = pathname.slice('/spotlog/'.length) || 'index.html', target = resolve(root, relative);
        if (!target.startsWith(resolve(root) + sep) || !existsSync(target) || !statSync(target).isFile()) { response.statusCode = 404; response.end('Build preview not found'); return; }
        const contentTypes: Record<string, string> = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.mjs': 'application/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.avif': 'image/avif', '.gif': 'image/gif', '.svg': 'image/svg+xml', '.woff': 'font/woff', '.woff2': 'font/woff2' };
        response.statusCode = 200; response.setHeader('Content-Type', contentTypes[extname(target)] ?? 'application/octet-stream');
        response.setHeader('Cache-Control', relative.startsWith('assets/') ? 'public, max-age=31536000, immutable' : 'no-cache');
        const file = readFileSync(target); response.setHeader('Content-Length', file.byteLength);
        response.end(request.method === 'HEAD' ? undefined : file);
      });
    },
  };
}
