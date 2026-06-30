/**
 * Node.js adapter for Omni Worker v2.0.
 *
 * Extends {@link WorkerRuntime} to provide worker_threads-based execution
 * using Comlink's node-adapter for message passing.
 *
 * @module runtime/node
 */

import * as Comlink from 'comlink';
import nodeAdapter from 'comlink/dist/esm/node-adapter.mjs';
import { Worker as ThreadWorker } from 'node:worker_threads';
import type { IOmniWorker, Promisify } from '../types';
import { OmniWorkerError, OmniWorkerErrorCodes } from './error';
import { WorkerRuntime } from './worker';

/**
 * Creates a Node.js worker_threads worker with Comlink communication.
 *
 * Uses `eval: true` mode for inline bundled code, eliminating the need
 * for temporary files. The worker runs with stderr inherited from the
 * parent process for visibility, while stdin and stdout are suppressed.
 *
 * @param path - Path identifier for the worker (used in error messages)
 * @param bundledCode - The pre-bundled worker code string (from the Vite plugin)
 * @returns A typed `IOmniWorker<T>` proxy for calling worker methods
 *
 * @throws {OmniWorkerError} If not running in a Node.js environment
 *   (code: `UNSUPPORTED_ENVIRONMENT`)
 *
 * @example
 * ```typescript
 * import { createNodeWorker } from '@anonaddy/omni-worker/runtime/node';
 *
 * interface MathApi {
 *   add(a: number, b: number): number;
 * }
 *
 * const worker = createNodeWorker<MathApi>('./math.worker.ts', bundledCode);
 * const sum = await worker.use().add(1, 2);
 * await worker.destroy();
 * ```
 */
export function createNodeWorker<T>(
  path: string,
  bundledCode: string
): NodeOmniWorker<T> {
  // Environment check: must be Node.js
  if (typeof process === 'undefined' || !process.versions?.node) {
    throw new OmniWorkerError(
      'OmniWorker requires Node.js 18+ or a modern browser with Web Worker support',
      {
        code: OmniWorkerErrorCodes.UNSUPPORTED_ENVIRONMENT,
        workerPath: path,
      }
    );
  }

  const worker = new NodeOmniWorker<T>(path);
  worker._setWorkerAndCode(
    new ThreadWorker(bundledCode, {
      eval: true,
      stdin: 'ignore' as unknown as boolean,
      stdout: 'ignore' as unknown as boolean,
      stderr: 'inherit' as unknown as boolean,
    }),
    bundledCode
  );
  return worker;
}

/**
 * Node.js-specific worker runtime using `worker_threads`.
 *
 * Extends {@link WorkerRuntime} to provide platform-specific worker creation
 * and termination for the Node.js environment. Uses Comlink's node-adapter
 * to bridge the `postMessage` protocol to `worker_threads` message channels.
 *
 * @typeParam T - The interface describing the worker's exposed API shape.
 *
 * @internal This class is instantiated by {@link createNodeWorker} and should
 * not be constructed directly by consumers.
 */
export class NodeOmniWorker<T> extends WorkerRuntime<T> {
  /** The underlying worker_threads.Worker instance */
  protected _worker: ThreadWorker | null = null;

  /** The bundled code string (stored for reference/debugging) */
  private _bundledCode: string | null = null;

  /**
   * Create a new NodeOmniWorker instance.
   *
   * @param path - Path identifier for error messages
   */
  constructor(path: string) {
    super(path);
  }

  /**
   * Internal factory method to set up the worker and establish Comlink.
   *
   * Called by {@link createNodeWorker} after the ThreadWorker is created.
   * Wraps the worker with Comlink's node-adapter to create the typed proxy.
   *
   * @param worker - The configured ThreadWorker instance
   * @param code - The bundled worker code string
   */
  _setWorkerAndCode(worker: ThreadWorker, code: string): void {
    this._worker = worker;
    this._bundledCode = code;

    // Set up Comlink proxy using node-adapter
    this._proxy = Comlink.wrap(nodeAdapter(worker)) as unknown as Promisify<T>;
  }

  /**
   * Required by abstract base — no-op for Node adapter since
   * initialization is handled by `_setWorkerAndCode` in the factory.
   */
  protected async initialize(): Promise<void> {
    // Already initialized by _setWorkerAndCode
  }

  /**
   * Terminate the underlying worker thread.
   *
   * Calls `worker.terminate()` which forcibly ends the thread.
   * After termination, the worker reference is cleared.
   *
   * @returns A promise that resolves when the worker has been terminated.
   */
  protected async terminateWorker(): Promise<void> {
    if (this._worker) {
      await this._worker.terminate();
      this._worker = null;
    }
  }
}
