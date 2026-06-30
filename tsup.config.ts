import { defineConfig } from 'tsup';

export default defineConfig([
  // ──────────────────────────────────────────────
  // ESM build → dist/esm/
  // ──────────────────────────────────────────────
  {
    entry: {
      index: 'src/index.ts',
      'runtime/worker': 'src/runtime/worker.ts',
      'runtime/pool': 'src/runtime/pool.ts',
      'runtime/node': 'src/runtime/node.ts',
      'runtime/web': 'src/runtime/web.ts',
      'vite/index': 'src/vite/index.ts',
    },
    format: 'esm',
    outDir: 'dist/esm',
    clean: true,
    dts: false,
    splitting: false,
    external: ['comlink', 'esbuild'],
  },

  // ──────────────────────────────────────────────
  // CJS build → dist/cjs/
  // ──────────────────────────────────────────────
  {
    entry: {
      index: 'src/index.ts',
      'runtime/worker': 'src/runtime/worker.ts',
      'runtime/pool': 'src/runtime/pool.ts',
      'runtime/node': 'src/runtime/node.ts',
      'runtime/web': 'src/runtime/web.ts',
      'vite/index': 'src/vite/index.ts',
    },
    format: 'cjs',
    outDir: 'dist/cjs',
    clean: false,
    dts: false,
    splitting: false,
    external: ['comlink', 'esbuild'],
  },

  // ──────────────────────────────────────────────
  // Type declarations → dist/types/
  // ──────────────────────────────────────────────
  {
    entry: {
      index: 'src/index.ts',
      worker: 'src/runtime/worker.ts',
      pool: 'src/runtime/pool.ts',
      node: 'src/runtime/node.ts',
      web: 'src/runtime/web.ts',
      vite: 'src/vite/index.ts',
    },
    format: 'esm',
    outDir: 'dist/types',
    clean: false,
    dts: { only: true },
    splitting: false,
    external: ['comlink', 'esbuild'],
  },
]);
