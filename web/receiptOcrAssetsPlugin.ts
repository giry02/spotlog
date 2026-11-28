import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import type { Plugin } from 'vite';

const require = createRequire(import.meta.url);
const workerRoot = dirname(require.resolve('tesseract.js/package.json'));
const coreRoot = dirname(require.resolve('tesseract.js-core/package.json'));
const languageRoot = (language: string) => dirname(require.resolve('@tesseract.js-data/' + language + '/package.json'));
const route = 'receipt-ocr-v7';

const files = new Map([
  ['worker.min.js', resolve(workerRoot, 'dist/worker.min.js')],
  ['tesseract-core-lstm.wasm.js', resolve(coreRoot, 'tesseract-core-lstm.wasm.js')],
  ['tesseract-core-simd-lstm.wasm.js', resolve(coreRoot, 'tesseract-core-simd-lstm.wasm.js')],
  ['tesseract-core-relaxedsimd-lstm.wasm.js', resolve(coreRoot, 'tesseract-core-relaxedsimd-lstm.wasm.js')],
  ...['kor', 'eng'].map(language => [language + '.traineddata.gz', resolve(languageRoot(language), '4.0.0_best_int', language + '.traineddata.gz')] as const),
]);
const licenseFiles = new Map([
  ['license-tesseract-js.txt', resolve(workerRoot, 'LICENSE.md')],
  ['license-tesseract-core.txt', resolve(coreRoot, 'LICENSE')],
]);

/** OCR files are same-origin and downloaded on demand, outside the offline shell graph. */
export function receiptOcrAssetsPlugin(): Plugin {
  return {
    name: 'spotlog-receipt-ocr-assets',
    configureServer(server) {
      server.middlewares.use('/' + route, (request, response, next) => {
        const name = request.url?.split('?')[0].slice(1) ?? '';
        const file = files.get(name);
        if (!file || request.method !== 'GET') return next();
        response.setHeader('Content-Type', name.endsWith('.js') ? 'text/javascript; charset=utf-8' : 'application/octet-stream');
        response.setHeader('Cache-Control', 'public, max-age=3600');
        response.end(readFileSync(file));
      });
    },
    generateBundle() {
      for (const [name, file] of [...files, ...licenseFiles]) {
        this.emitFile({ type: 'asset', fileName: route + '/' + name, source: readFileSync(file) });
      }
    },
  };
}
