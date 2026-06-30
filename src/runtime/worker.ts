/**
 * Worker runtime base class.
 *
 * Abstract foundation managing Comlink communication and worker lifecycle.
 * Environment-specific adapters (Node.js, Web) extend this class to provide
 * the actual worker creation and termination logic.
 *
 * @module runtime/worker
 */

import type { IOmniWorker, Promisify } from '../types';
import { OmniWorkerError, OmniWorkerErrorCodes } from './error';

/**
 * Base worker runtime managing Comlink communication and worker lifecycle.
 *
 * This abstract class cannot be instantiated directly. Environment-specific
 * subclasses (e.g., `NodeWorkerRuntime`, `WebWorkerRuntime`) implement the
 * platform-dependent worker creation and termination.
 *
 * @typeParam T - The interface describing the worker's exposed API shape.
 *
 * @example
 * ```typescript
 * // Node.js adapter extends WorkerRuntime
 * class NodeWorkerRuntime<T> extends WorkerRuntime<T> {
 *   protected _worker: import('worker_threads').Worker;
 *   protected async initialize(): Promise<void> { /* ... */ }
 *   protected async terminateWorker(): Promise<void> { /* ... */ }
 * }
 * ```
 */
export abstract class WorkerRuntime<T> implements IOmniWorker<T> {
  /** The Comlink-wrapped proxy for calling worker functions */
  protected _proxy: Promisify<T> | null = null;

  /** Whether the worker has been destroyed */
  protected _destroyed = false;

  /** Path to the worker file (for error messages) */
  protected readonly _path: string;

  /** The underlying worker instance (type varies by environment) */
  protected abstract _worker: unknown;

  /**
   * Create a new WorkerRuntime instance.
   *
   * Subclasses call `super(path)` and then (typically) `this.initialize()`
   * to create the actual worker process and establish Comlink communication.
   *
   * @param path - Relative or absolute path to the worker file.
   */
  constructor(path: string) {
    this._path = path;
  }

  /**
   * Initialize the underlying worker and set up Comlink.
   *
   * Subclasses implement this to create the actual worker process/thread
   * and assign the Comlink proxy to `this._proxy`.
   *
   * @returns A promise that resolves when the worker is ready.
   */
  protected abstract initialize(): Promise<void>;

  /**
   * Terminate the underlying worker process or thread.
   *
   * Subclasses implement this to perform environment-specific cleanup.
   *
   * @returns A promise that resolves when the worker has been terminated.
   */
  protected abstract terminateWorker(): Promise<void>;

  /**
   * Get the typed proxy to call worker functions.
   *
   * Every method on the returned proxy returns a `Promise` (via `Promisify<T>`),
   * because Comlink serializes calls across the worker boundary asynchronously.
   *
   * @returns The Comlink proxy typed according to the generic `T`.
   * @throws {OmniWorkerError} If the worker has been destroyed (`WORKER_ALREADY_DESTROYED`).
   * @throws {OmniWorkerError} If the worker proxy is not initialized (`WORKER_CREATE_FAILED`).
   *
   * @example
   * ```typescript
   * interface MathApi { add(a: number, b: number): number; }
   * const worker = omniWorker<MathApi>('./math.worker.ts');
   * const sum = await worker.use().add(1, 2); // Promise<number>
   * ```
   */
  public use(): Promisify<T> {
    if (this._destroyed) {
      throw new OmniWorkerError(
        `Cannot use worker '${this._path}': already destroyed`,
        {
          code: OmniWorkerErrorCodes.WORKER_ALREADY_DESTROYED,
          workerPath: this._path,
        }
      );
    }

    if (!this._proxy) {
      throw new OmniWorkerError(
        `Worker '${this._path}' is not initialized`,
        {
          code: OmniWorkerErrorCodes.WORKER_CREATE_FAILED,
          workerPath: this._path,
        }
      );
    }

    return this._proxy;
  }

  /**
   * Check whether the worker has been destroyed.
   *
   * @returns `true` if `destroy()` has been called, `false` otherwise.
   */
  public isDestroyed(): boolean {
    return this._destroyed;
  }

  /**
   * Terminate the worker and free all associated resources.
   *
   * This operation is idempotent: calling `destroy()` multiple times is safe.
   * The first call terminates the worker; subsequent calls return immediately
   * without side effects.
   *
   * Errors during termination are caught and logged (best-effort cleanup),
   * so `destroy()` itself never throws.
   *
   * @returns A promise that resolves when cleanup is complete.
   */
  public async destroy(): Promise<void> {
    if (this._destroyed) {
      return; // Idempotent — second call is a no-op
    }

    this._destroyed = true;

    try {
      await this.terminateWorker();
    } catch (error) {
      // Log but don't throw — destroy should be best-effort
      if (error instanceof Error) {
        console.warn(`[OmniWorker] Warning during worker destruction: ${error.message}`);
      }
    }

    this._proxy = null;
  }
}
