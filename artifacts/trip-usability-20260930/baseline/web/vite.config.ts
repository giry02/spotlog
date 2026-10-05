import { defineConfig,loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ command,mode }) => {
  const target=loadEnv(mode,process.cwd(),'SPOTLOG_').SPOTLOG_DEV_API_TARGET;
  return {
  base: command === 'build' ? '/spotlog/' : '/',
  plugins: [react()],
  build: { outDir: 'dist', emptyOutDir: true },
  server:{proxy:target?{'/api':{target,changeOrigin:true}}:undefined},
};});
