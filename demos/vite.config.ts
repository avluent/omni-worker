import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { omniWorkerVite } from '../dist/esm/vite/index.js';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

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
    alias: {
      // Force browser entry for the workspace package
      '@anonaddy/omni-worker': resolve(__dirname, '../dist/esm/index.web.js'),
    },
  },
  optimizeDeps: {
    include: ['comlink', '@anonaddy/omni-worker'],
    // Force browser entry resolution for workspace package
    esbuildOptions: {
      external: ['comlink'],
    },
  },
  build: {
    target: 'esnext',
  },
});
