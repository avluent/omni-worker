/**
 * Browser Web Worker adapter for Omni Worker v2.0.
 *
 * Extends {@link WorkerRuntime} to provide browser Web Worker-based execution
 * using standard `new Worker()` with ES module support (`type: 'module'`).
 * Uses Comlink's standard `wrap()` without any adapter, since Web Workers
 * natively support the `postMessage` protocol.
 *
 * @module runtime/web
 */

import * as Comlink from 'comlink';
import type { Promisify } from '../types';
import { OmniWorkerError, OmniWorkerErrorCodes } from './error';
import { WorkerRuntime } from './worker';

/**
 * Creates a browser Web Worker with Comlink communication.
 *
 * Uses `type: 'module'` for ES module workers. The worker URL can be a
 * data URL (for development) or a regular asset URL (for production).
 *
 * @typeParam T - The interface describing the worker's exposed API shape.
 * @param path - Path identifier for the worker (used in error messages)
 * @param workerUrl - URL to the bundled worker script (data URL or file URL)
 * @returns A typed `IOmniWorker<T>` proxy for calling worker methods
 *
 * @throws {OmniWorkerError} If the browser does not support Web Workers
 *   (code: `UNSUPPORTED_ENVIRONMENT`)
 *
 * @example
 * ```typescript
 * import { createWebWorker } from '@anonaddy/omni-worker/runtime/web';
 *
 * interface MathApi {
 *   add(a: number, b: number): number;
 * }
 *
 * const worker = createWebWorker<MathApi>('./math.worker.ts', workerUrl);
 * const sum = await worker.use().add(1, 2);
 * await worker.destroy();
 * ```
 */
export function createWebWorker<T>(
  path: string,
  workerUrl: string
): WebOmniWorker<T> {
  // Environment check: must be a browser with Web Worker support
  if (typeof Worker === 'undefined') {
    throw new OmniWorkerError(
      'OmniWorker requires Node.js 18+ or a modern browser with Web Worker support',
      {
        code: OmniWorkerErrorCodes.UNSUPPORTED_ENVIRONMENT,
        workerPath: path,
      }
    );
  }

  const worker = new WebOmniWorker<T>(path);
  worker._setWorkerUrl(new Worker(workerUrl, { type: 'module' as WorkerType }));
  return worker;
}

/**
 * Browser-specific worker runtime using standard Web Workers.
 *
 * Extends {@link WorkerRuntime} to provide platform-specific worker creation
 * and termination for browser environments. Uses standard `Comlink.wrap()`
 * without any adapter because Web Workers natively implement the `postMessage`
 * protocol that Comlink relies on.
 *
 * @typeParam T - The interface describing the worker's exposed API shape.
 *
 * @internal This class is instantiated by {@link createWebWorker} and should
 * not be constructed directly by consumers.
 */
export class WebOmniWorker<T> extends WorkerRuntime<T> {
  /** The underlying browser Worker instance */
  protected _worker: Worker | null = null;

  /**
   * Create a new WebOmniWorker instance.
   *
   * @param path - Path identifier for error messages
   */
  constructor(path: string) {
    super(path);
  }

  /**
   * Internal factory method to set up the worker and establish Comlink.
   *
   * Called by {@link createWebWorker} after the Worker is created.
   * Wraps the worker with standard Comlink (no adapter needed for
   * Web Workers since they natively support `postMessage`).
   *
   * @param worker - The configured browser Worker instance
   */
  _setWorkerUrl(worker: Worker): void {
    this._worker = worker;

    // Set up Comlink proxy — no adapter needed for Web Workers
    this._proxy = Comlink.wrap(worker) as unknown as Promisify<T>;
  }

  /**
   * Required by abstract base — no-op for Web adapter since
   * initialization is handled by `_setWorkerUrl` in the factory.
   */
  protected async initialize(): Promise<void> {
    // Already initialized by _setWorkerUrl
  }

  /**
   * Terminate the underlying Web Worker.
   *
   * Calls `worker.terminate()` which forcibly ends the worker thread.
   * After termination, the worker reference is cleared.
   *
   * @returns A promise that resolves when the worker has been terminated.
   */
  protected async terminateWorker(): Promise<void> {
    if (this._worker) {
      this._worker.terminate();
      this._worker = null;
    }
  }
}
