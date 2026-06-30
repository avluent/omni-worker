/**
 * Omni Worker v2.0 — Worker type definitions.
 *
 * Defines the `IOmniWorker<T>` interface that is returned by the
 * `omniWorker<T>()` factory function.
 *
 * @packageDocumentation
 */

import type { Promisify } from './helpers';

/**
 * The interface returned by `omniWorker<T>()`.
 *
 * Provides a typed proxy for calling worker methods, plus lifecycle
 * management methods for destruction and state inspection.
 *
 * @typeParam T - The interface of the worker's exposed API.
 *
 * @example
 * ```typescript
 * interface MathApi {
 *   add(a: number, b: number): number;
 * }
 *
 * const worker = omniWorker<MathApi>('./math.worker.ts');
 * const result = await worker.use().add(1, 2); // number
 * await worker.destroy();
 * ```
 */
export interface IOmniWorker<T> {
  /**
   * Get the typed Comlink proxy to call worker functions.
   *
   * All methods on the proxy return `Promise` values, since communication
   * across the worker boundary is inherently asynchronous.
   *
   * @returns A promisified proxy typed according to the generic `T`.
   */
  use(): Promisify<T>;

  /**
   * Check whether the worker has already been destroyed.
   *
   * @returns `true` if `destroy()` has been called, `false` otherwise.
   */
  isDestroyed(): boolean;

  /**
   * Terminate the worker and free all associated resources.
   *
   * This operation is idempotent: calling `destroy()` multiple times
   * is safe and only the first call has any effect.
   *
   * @returns A promise that resolves when the worker has been terminated.
   */
  destroy(): Promise<void>;
}
