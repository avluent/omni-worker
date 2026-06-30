/**
 * Omni Worker v2.0 — Run your code inside workers with a single function call.
 * 
 * Usage:
 *   import { omniWorker, omniWorkerPool } from '@anonaddy/omni-worker';
 *   
 *   // Single worker
 *   const w = omniWorker<MyApi>('./my.worker.ts');
 *   const result = await w.use().myFunction(args);
 *   await w.destroy();
 *   
 *   // Worker pool (round-robin)
 *   const pool = omniWorkerPool<MyApi>('./my.worker.ts', { count: 4 });
 *   const result = await pool.use().myFunction(args);
 *   await pool.destroy(); */

import type { IOmniWorker, IOmniWorkerPool, PoolOptions } from './types';
import { createNodeWorker } from './runtime/node';
import { createWebWorker } from './runtime/web';
import { createWorkerPool } from './runtime/pool';
import { OmniWorkerError, OmniWorkerErrorCodes } from './runtime/error';

// Re-export types
export type { IOmniWorker, IOmniWorkerPool, PoolOptions, VitePluginOptions } from './types';
export { OmniWorkerError, OmniWorkerErrorCodes } from './runtime/error';

/**
 * Creates a single worker from a pre-bundled worker URL.
 * Auto-detects the environment (Node.js or browser) and uses the appropriate worker type.
 * 
 * @typeParam T - Interface describing the worker's api shape
 * @param path - Path identifier for the worker (used in error messages)
 * @param workerSource - The bundled worker code (Node) or worker URL (browser)
 *                       This comes from the Vite plugin's transformed output
 * @returns IOmniWorker<T> — typed worker proxy
 * 
 * @example
 * ```ts
 * import { omniWorker } from '@anonaddy/omni-worker';
 * 
 * interface MyApi {
 *   add(a: number, b: number): number;
 * }
 * 
 * // In dev: import { code, url } from './my.worker.ts' (Vite plugin output)
 * // In prod: same, but url points to asset
 * 
 * const w = omniWorker<MyApi>('./my.worker.ts', codeOrUrl);
 * const sum = await w.use().add(1, 2);
 * await w.destroy();
 * ```
 */
export function omniWorker<T>(
  path: string,
  workerSource: string
): IOmniWorker<T> {
  // Auto-detect environment
  const isNode = typeof process !== 'undefined' && process.versions?.node;
  
  if (isNode) {
    return createNodeWorker<T>(path, workerSource);
  }
  
  return createWebWorker<T>(path, workerSource);
}

/**
 * Creates a pool of workers with round-robin dispatch.
 * Auto-detects the environment (Node.js or browser).
 * 
 * @typeParam T - Interface describing the worker's api shape
 * @param path - Path identifier for the worker
 * @param workerSource - The bundled worker code/URL (same as omniWorker)
 * @param options - Pool configuration (count defaults to 1)
 * @returns IOmniWorkerPool<T> — typed pool proxy with round-robin dispatch
 * 
 * @example
 * ```ts
 * import { omniWorkerPool } from '@anonaddy/omni-worker';
 * 
 * interface MyApi {
 *   capitalize(str: string): string;
 * }
 * 
 * // 4 workers, round-robin dispatch
 * const pool = omniWorkerPool<MyApi>('./my.worker.ts', codeOrUrl, { count: 4 });
 * const result = await pool.use().capitalize('hello'); // "Hello"
 * await pool.destroy();
 * ```
 */
export function omniWorkerPool<T>(
  path: string,
  workerSource: string,
  options: PoolOptions = {}
): IOmniWorkerPool<T> {
  // Auto-detect environment
  const isNode = typeof process !== 'undefined' && process.versions?.node;
  
  return createWorkerPool<T>(
    path,
    options,
    (index) => {
      if (isNode) {
        return createNodeWorker<T>(path, workerSource);
      }
      return createWebWorker<T>(path, workerSource);
    }
  );
}
