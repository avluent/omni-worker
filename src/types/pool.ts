/**
 * Omni Worker v2.0 — Pool type definitions.
 *
 * Defines `IOmniWorkerPool<T>` and `PoolOptions` for managing
 * multiple worker instances with round-robin dispatch.
 *
 * @packageDocumentation
 */

import type { IOmniWorker } from './worker';

/**
 * Configuration options for creating a worker pool.
 *
 * @example
 * ```typescript
 * const pool = omniWorkerPool<MyApi>('./my.worker.ts', { count: 4 });
 * ```
 */
export interface PoolOptions {
  /**
   * Number of workers in the pool. Must be >= 1.
   *
   * @default 1
   */
  count?: number;
}

/**
 * The interface returned by `omniWorkerPool<T>()`.
 *
 * Extends `IOmniWorker<T>` with pool-specific methods for querying
 * the number of workers. Task dispatch is handled via round-robin
 * across all pool members.
 *
 * @typeParam T - The interface of each worker's exposed API.
 *
 * @example
 * ```typescript
 * interface TaskApi {
 *   compute(data: string): number;
 * }
 *
 * const pool = omniWorkerPool<TaskApi>('./task.worker.ts', { count: 8 });
 * console.log(pool.getNumOfWorkers()); // 8
 * const result = await pool.use().compute('hello'); // round-robined
 * await pool.destroy();
 * ```
 */
export interface IOmniWorkerPool<T> extends IOmniWorker<T> {
  /**
   * Returns the number of workers currently in the pool.
   *
   * @returns The pool size as specified at creation time.
   */
  getNumOfWorkers(): number;
}
