/**
 * Omni Worker v2.0 — Browser entry point.
 * 
 * This entry point only imports the Web Worker adapter, so it bundles cleanly
 * for browser environments without pulling in `node:worker_threads`.
 * 
 * @module @anonaddy/omni-worker
 */

import type { IOmniWorker, IOmniWorkerPool, PoolOptions } from './types';
import { createWebWorker } from './runtime/web';
import { createWorkerPool } from './runtime/pool';
import { OmniWorkerError, OmniWorkerErrorCodes } from './runtime/error';

// Re-export types
export type { IOmniWorker, IOmniWorkerPool, PoolOptions, VitePluginOptions } from './types';
export { OmniWorkerError, OmniWorkerErrorCodes } from './runtime/error';

export function omniWorker<T>(
  path: string,
  workerSource: string
): IOmniWorker<T> {
  return createWebWorker<T>(path, workerSource);
}

export function omniWorkerPool<T>(
  path: string,
  workerSource: string,
  options: PoolOptions = {}
): IOmniWorkerPool<T> {
  return createWorkerPool<T>(
    path,
    options,
    () => createWebWorker<T>(path, workerSource)
  );
}
