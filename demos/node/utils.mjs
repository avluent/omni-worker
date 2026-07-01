/**
 * Node.js Demo Utilities
 *
 * Shared helper module for the Node.js demo scripts under `demos/node/`.
 * Provides functions to bundle the shared compute worker with esbuild,
 * create workers and pools, and run demos with formatted output.
 *
 * @module demos/node/utils
 */

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';
import { omniWorker, omniWorkerPool } from '@anonaddy/omni-worker';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Absolute path to the directory containing this module (`demos/node/`).
 * Derived from `import.meta.url` so it works regardless of CWD.
 */
const UTILS_DIR = dirname(fileURLToPath(import.meta.url));

/**
 * Absolute path to the `demos/src/workers/` directory where the shared
 * worker source files live.
 */
const WORKERS_DIR = resolve(UTILS_DIR, '..', 'src', 'workers');

/**
 * The Node.js-specific Comlink expose boilerplate that must be appended
 * to worker source before bundling. Uses `parentPort` from `worker_threads`
 * instead of the browser `self` global.
 */
const COMLINK_BOILERPLATE = `
import { expose } from 'comlink';
import { parentPort } from 'worker_threads';
expose(api, parentPort);
`;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Bundle a TypeScript worker file into plain JavaScript suitable for
 * Node.js `worker_threads`.
 *
 * The function reads the TypeScript source from `demos/src/workers/`,
 * appends the Node.js Comlink expose boilerplate, and bundles everything
 * with esbuild into a single ES module string.
 *
 * @param workerPath - The filename (with extension) of the worker source
 *                     relative to `demos/src/workers/` (e.g.
 *                     `"compute.worker.ts"`).
 * @returns A promise resolving to the bundled JavaScript source code as
 *          a string.
 *
 * @example
 * ```js
 * const code = await bundleWorker('compute.worker.ts');
 * const worker = createWorker('compute', code);
 * ```
 */
export async function bundleWorker(workerPath) {
  const workerSourcePath = resolve(WORKERS_DIR, workerPath);

  // Read the raw TypeScript source.
  const source = readFileSync(workerSourcePath, 'utf-8');

  // Append the Node.js Comlink expose boilerplate.
  const augmentedSource = source + COMLINK_BOILERPLATE;

  // Bundle with esbuild.
  // With `platform: 'neutral'`, built-ins and node_modules must be marked
  // external so they remain as import specifiers and resolve at runtime
  // inside the worker thread.
  const result = await esbuild.build({
    stdin: {
      contents: augmentedSource,
      resolveDir: WORKERS_DIR,
      loader: 'ts',
    },
    platform: 'neutral',
    format: 'esm',
    bundle: true,
    write: false,
    external: ['comlink', 'worker_threads'],
  });

  // esbuild returns an object with an `outputFiles` array; the first (and only)
  // entry contains the bundled source.
  return result.outputFiles[0].text;
}

/**
 * Create a single omni-worker from pre-bundled JavaScript source.
 *
 * Thin wrapper around `omniWorker` that forwards both the name and code.
 *
 * @param name - A human-readable identifier for this worker (used in
 *               error messages).
 * @param code - The bundled JavaScript source code for the worker.
 * @returns An `IOmniWorker` instance.
 *
 * @example
 * ```js
 * const code = await bundleWorker('compute.worker.ts');
 * const w = createWorker('compute', code);
 * const result = await w.use().heavyCompute(1, 300);
 * await w.destroy();
 * ```
 */
export function createWorker(name, code) {
  return omniWorker(name, code);
}

/**
 * Create a pool of omni-workers from pre-bundled JavaScript source.
 *
 * Thin wrapper around `omniWorkerPool` that forwards the name, code, and
 * pool size.
 *
 * @param name - A human-readable identifier for the pool (used in error
 *               messages).
 * @param code - The bundled JavaScript source code shared by all workers
 *               in the pool.
 * @param count - The number of worker instances in the pool (must be ≥ 1).
 * @returns An `IOmniWorkerPool` instance with round-robin dispatch.
 *
 * @example
 * ```js
 * const code = await bundleWorker('compute.worker.ts');
 * const pool = createPool('compute', code, 4);
 * const result = await pool.use().heavyCompute(1, 300);
 * await pool.destroy();
 * ```
 */
export function createPool(name, code, count) {
  return omniWorkerPool(name, code, { count });
}

/**
 * Run a demo function with formatted banner and completion output.
 *
 * Prints a decorative banner before the demo, invokes the async function,
 * and prints a completion line afterwards. Errors during the demo are
 * caught and reported without terminating the process.
 *
 * @param title - The title displayed in the banner (e.g. `"Single Worker"`).
 * @param fn - An async function that performs the demo logic.
 * @returns A promise that resolves when the demo completes (or rejects
 *          if `fn` throws).
 *
 * @example
 * ```js
 * await runDemo('Single Worker', async () => {
 *   const code = await bundleWorker('compute.worker.ts');
 *   const w = createWorker('compute', code);
 *   // … demo logic …
 *   await w.destroy();
 * });
 * ```
 */
export async function runDemo(title, fn) {
  const separator = '═'.repeat(43);
  console.log(`\n${separator}`);
  console.log(`  Node.js Demo: ${title}`);
  console.log(`${separator}\n`);
  await fn();
  console.log(`\n${'─'.repeat(43)}`);
  console.log(`  ✓ Demo complete\n`);
}
