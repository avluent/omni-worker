import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { omniWorkerVite } from '@anonaddy/omni-worker/vite';

export default defineConfig({
  plugins: [
    omniWorkerVite(),
    react(),
    svelte(),
  ],
  server: {
    open: true,
  },
  resolve: {
    dedupe: ['react', 'react-dom'],
  },
  optimizeDeps: {
    include: ['comlink'],
  },
  build: {
    target: 'es2020',
  },
});
