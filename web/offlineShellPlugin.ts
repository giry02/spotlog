import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Plugin } from 'vite';

/** Only the consumer entry's executable dependency graph. Images are selected per trip. */
export function offlineShellPlugin(): Plugin {
  let base = '/';
  let outDir = '';
  let shellFiles: string[] = [];
  return {
    name: 'spotlog-offline-consumer-shell',
    apply: 'build',
    enforce: 'post',
    configResolved(config) { base = config.base; outDir = resolve(config.root, config.build.outDir); },
    generateBundle(_options, bundle) {
      const entry = Object.values(bundle).find(item => item.type === 'chunk' && item.isEntry && item.name === 'customer');
      if (!entry || entry.type !== 'chunk' || !bundle['index.html']) throw new Error('Consumer shell entry is missing');
      const required = new Set<string>(['index.html']);
      const visit = (name: string) => {
        if (required.has(name)) return;
        const item = bundle[name];
        if (!item) throw new Error(`Offline shell dependency is missing: ${name}`);
        required.add(name);
        if (item.type === 'chunk') {
          [...item.imports, ...item.dynamicImports].forEach(visit);
          const metadata = (item as typeof item & { viteMetadata?: { importedCss?: Set<string>; importedAssets?: Set<string> } }).viteMetadata;
          metadata?.importedCss?.forEach(visit);
          metadata?.importedAssets?.forEach(asset => { if (/\.(?:m?js|css|woff2?|ttf|otf)$/i.test(asset)) visit(asset); });
          // Vite's separately bundled ?worker&url asset may not be in Rollup imports.
          for (const match of item.code.matchAll(/["'`]((?:\/[^"'`]*\/)?assets\/[^"'`?]+\.(?:m?js|css|woff2?|ttf|otf))["'`]/g)) {
            const asset = match[1].slice(match[1].lastIndexOf('assets/'));
            if (bundle[asset]) visit(asset);
          }
        } else if (name.endsWith('.css')) {
          const css = typeof item.source === 'string' ? item.source : new TextDecoder().decode(item.source);
          for (const match of css.matchAll(/url\(\s*["']?([^"')?]+\.(?:woff2?|ttf|otf))["']?\s*\)/g)) {
            const font = match[1].startsWith('/') ? match[1].slice(match[1].lastIndexOf('assets/')) : `assets/${match[1].replace(/^\.\//, '')}`;
            if (bundle[font]) visit(font);
          }
        }
      };
      visit(entry.fileName);
      shellFiles = [...required].sort();
      const files = shellFiles.map(name => {
        const item = bundle[name];
        const contents = item.type === 'chunk' ? item.code : item.source;
        const bytes = typeof contents === 'string' ? Buffer.from(contents) : Buffer.from(contents);
        return { url: `${base}${name}`, bytes: bytes.byteLength, digest: createHash('sha256').update(bytes).digest('hex') };
      });
      const version = createHash('sha256').update(JSON.stringify(files)).digest('hex').slice(0, 24);
      this.emitFile({ type: 'asset', fileName: 'spotlog-offline-shell.json', source: JSON.stringify({ schemaVersion: 1, base, version, files }) });
    },
    writeBundle() {
      // Rolldown can finalize preload URLs after generateBundle. Hash the actual written bytes.
      const files = shellFiles.map(name => {
        const bytes = readFileSync(resolve(outDir, name));
        return { url: `${base}${name}`, bytes: bytes.byteLength, digest: createHash('sha256').update(bytes).digest('hex') };
      });
      const version = createHash('sha256').update(JSON.stringify(files)).digest('hex').slice(0, 24);
      writeFileSync(resolve(outDir, 'spotlog-offline-shell.json'), JSON.stringify({ schemaVersion: 1, base, version, files }));
    },
  };
}
