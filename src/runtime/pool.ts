/**
 * Worker pool runtime — manages a pool of workers with round-robin dispatch.
 *
 * Provides `OmniWorkerPool<T>` class and `createWorkerPool<T>()` factory for
 * orchestrating multiple workers in a cyclic round-robin fashion. Each call to
 * `pool.use()` dispatches to the next worker in sequence: 0 → 1 → 2 → … → N-1 → 0.
 *
 * @module runtime/pool
 */

import type { IOmniWorker, IOmniWorkerPool, PoolOptions, Promisify } from '../types';
import { OmniWorkerError, OmniWorkerErrorCodes } from './error';

/**
 * Pool of workers with round-robin dispatch.
 *
 * Extends `IOmniWorkerPool<T>` for typed method access and pool management.
 * Each sequential call to `use()` selects the next worker in cyclic order.
 *
 * @typeParam T — The interface describing each worker's exposed API shape.
 */
export class OmniWorkerPool<T> implements IOmniWorkerPool<T> {
  /** Internal list of workers in round-robin order */
  private _workers: IOmniWorker<T>[] = [];

  /** Whether the pool has been destroyed */
  private _destroyed = false;

  /** Index of the next worker to dispatch to (0-based, wraps via modulo) */
  private _currentIndex = 0;

  /** Path to the worker file (for error messages) */
  private readonly _path: string;

  /**
   * Create a new worker pool.
   *
   * @param workers - Pre-created worker instances in dispatch order
   * @param path - Path identifier for error messages
   */
  constructor(workers: IOmniWorker<T>[], path: string) {
    this._workers = workers;
    this._path = path;
  }

  /**
   * Get the typed proxy for the next worker in round-robin order.
   *
   * Dispatch follows strict cyclic order: 0 → 1 → 2 → … → N-1 → 0.
   *
   * @returns A promisified proxy from the next worker in sequence.
   * @throws {OmniWorkerError} If the pool has been destroyed
   *   (code: `WORKER_ALREADY_DESTROYED`).
   * @throws {OmniWorkerError} If the pool contains no workers
   *   (code: `INVALID_POOL_COUNT`).
   */
  public use(): Promisify<T> {
    if (this._destroyed) {
      throw new OmniWorkerError(
        `Cannot use pool '${this._path}': already destroyed`,
        {
          code: OmniWorkerErrorCodes.WORKER_ALREADY_DESTROYED,
          workerPath: this._path,
        }
      );
    }

    if (this._workers.length === 0) {
      throw new OmniWorkerError(
        `Pool '${this._path}' has no workers`,
        {
          code: OmniWorkerErrorCodes.INVALID_POOL_COUNT,
          workerPath: this._path,
        }
      );
    }

    const worker = this._workers[this._currentIndex];
    this._currentIndex = (this._currentIndex + 1) % this._workers.length;
    return worker.use();
  }

  /**
   * Check if pool has been destroyed.
   *
   * @returns `true` if `destroy()` has been called, `false` otherwise.
   */
  public isDestroyed(): boolean {
    return this._destroyed;
  }

  /**
   * Terminate all workers in parallel.
   *
   * This operation is idempotent: calling `destroy()` multiple times
   * is safe. The first call terminates all workers; subsequent calls
   * return immediately without side effects.
   *
   * @returns A promise that resolves when all workers are terminated.
   */
  public async destroy(): Promise<void> {
    if (this._destroyed) {
      return;
    }
    this._destroyed = true;
    await Promise.all(this._workers.map(w => w.destroy()));
    this._workers = [];
  }

  /**
   * Returns the number of workers in the pool.
   *
   * @returns The pool size as specified at creation time.
   */
  public getNumOfWorkers(): number {
    return this._workers.length;
  }
}

/**
 * Options for creating a worker pool.
 *
 * Extends `PoolOptions` with additional pool-specific configuration
 * like maximum allowed pool size.
 */
export interface CreatePoolOptions extends PoolOptions {
  /** Maximum pool size (default: 128) — guards against absurdly large pools */
  maxCount?: number;
}

/**
 * Creates a pool of workers with round-robin dispatch.
 *
 * Uses a factory function to create individual workers, allowing each
 * worker to be configured with an index or other per-worker parameters.
 *
 * @typeParam T — The interface describing each worker's exposed API shape.
 * @param path - Path identifier for the worker (used in error messages)
 * @param options - Pool configuration including count and maxCount
 * @param createWorker - Factory function that creates an individual worker given its index
 * @returns `OmniWorkerPool<T>` with round-robin dispatch
 * @throws {OmniWorkerError} If `count < 1` (code: `INVALID_POOL_COUNT`)
 * @throws {OmniWorkerError} If `count > maxCount` (code: `INVALID_POOL_COUNT`)
 *
 * @example
 * ```typescript
 * import { createWorkerPool, createNodeWorker } from '@anonaddy/omni-worker';
 *
 * interface MathApi { add(a: number, b: number): number; }
 *
 * const pool = createWorkerPool<MathApi>(
 *   './math.worker.ts',
 *   { count: 4 },
 *   (index) => createNodeWorker<MathApi>('./math.worker.ts', bundledCode)
 * );
 *
 * console.log(pool.getNumOfWorkers()); // 4
 * const result = await pool.use().add(1, 2); // round-robined to worker[0]
 * await pool.destroy();
 * ```
 */
export function createWorkerPool<T>(
  path: string,
  options: CreatePoolOptions = {},
  createWorker: (index: number) => IOmniWorker<T>
): OmniWorkerPool<T> {
  const count = options.count ?? 1;
  const maxCount = options.maxCount ?? 128;

  if (count < 1) {
    throw new OmniWorkerError(
      `Pool count must be >= 1, got: ${count}`,
      {
        code: OmniWorkerErrorCodes.INVALID_POOL_COUNT,
        workerPath: path,
      }
    );
  }

  if (count > maxCount) {
    throw new OmniWorkerError(
      `Pool count must be <= ${maxCount}, got: ${count}`,
      {
        code: OmniWorkerErrorCodes.INVALID_POOL_COUNT,
        workerPath: path,
      }
    );
  }

  // Create exactly `count` workers (NOT count+1 — v0.x off-by-one bug fixed)
  const workers: IOmniWorker<T>[] = [];
  for (let i = 0; i < count; i++) {
    // Append each worker (NOT overwrite — v0.x loop overwrite bug fixed)
    workers.push(createWorker(i));
  }

  return new OmniWorkerPool<T>(workers, path);
}
