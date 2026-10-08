import { defineConfig,loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

export default defineConfig(({ command,mode }) => {
  const target=loadEnv(mode,process.cwd(),'SPOTLOG_').SPOTLOG_DEV_API_TARGET;
  return {
  base: command === 'build' ? '/spotlog/' : '/',
  plugins: [react()],
  build: { outDir: 'dist', emptyOutDir: true, rollupOptions: { input: { customer: fileURLToPath(new URL('./index.html', import.meta.url)), errors: fileURLToPath(new URL('./error.html', import.meta.url)), notFound: fileURLToPath(new URL('./404.html', import.meta.url)) } } },
  server:{proxy:target?{'/api':{target,changeOrigin:true}}:undefined},
};});
