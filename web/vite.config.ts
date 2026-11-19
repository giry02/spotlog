import { defineConfig,loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { offlineShellPlugin } from './offlineShellPlugin.ts';
import { offlinePreviewPlugin } from './offlinePreviewPlugin.ts';

export default defineConfig(({ command,mode }) => {
  const env = loadEnv(mode, process.cwd(), 'SPOTLOG_');
  const apiTarget = env.SPOTLOG_DEV_API_TARGET;
  const planningTarget = env.SPOTLOG_PLANNING_AI_DEV_TARGET;
  return {
  base: command === 'build' ? '/spotlog/' : '/',
  plugins: [react(), offlineShellPlugin(), offlinePreviewPlugin()],
  build: { outDir: 'dist', emptyOutDir: true, rollupOptions: { input: { customer: fileURLToPath(new URL('./index.html', import.meta.url)), errors: fileURLToPath(new URL('./error.html', import.meta.url)), notFound: fileURLToPath(new URL('./404.html', import.meta.url)), admin: fileURLToPath(new URL('./admin.html', import.meta.url)), adminPreview: fileURLToPath(new URL('./admin-preview.html', import.meta.url)) } } },
  server: { proxy: {
    ...(planningTarget ? { '^/api/(planning-ai|chat-ai)$': { target: planningTarget, changeOrigin: true } } : {}),
    ...(apiTarget ? { '/api': { target: apiTarget, changeOrigin: true } } : {}),
  } },
};});
