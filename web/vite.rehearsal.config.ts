import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { receiptOcrAssetsPlugin } from './receiptOcrAssetsPlugin.ts';

export default defineConfig({
  root: fileURLToPath(new URL('./rehearsal/', import.meta.url)),
  base: '/spotlog/rehearsal/',
  plugins: [react(), receiptOcrAssetsPlugin()],
  optimizeDeps: { include: ['tesseract.js'] },
  build: {
    outDir: fileURLToPath(new URL('./dist/rehearsal/', import.meta.url)),
    emptyOutDir: true,
  },
});
