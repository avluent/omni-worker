/**
 * Shared compute worker for all omni-worker demos.
 *
 * This worker is used by both Node.js and Web demo scripts,
 * across all supported frameworks (Vanilla, React, Svelte).
 *
 * The file uses the `.worker.ts` extension so that the
 * `omniWorkerVite` Vite plugin picks it up during web builds
 * and appends `Comlink.expose(api)` automatically.
 *
 * For Node.js demos, the worker is bundled separately via
 * `demos/node/utils.mjs` which also appends the Comlink boilerplate.
 *
 * ⚠️ Do NOT import Comlink here — the Vite plugin (and the Node.js
 * bundling helper) injects `Comlink.expose(api)` at build time.
 *
 * @module compute.worker
 */

// ---------------------------------------------------------------------------
// Timing helpers
// ---------------------------------------------------------------------------
// `performance.now()` is available in browser contexts but NOT guaranteed
// in Node.js worker_threads (which require an import from 'node:perf_hooks').
// Because this file must compile under `platform: 'neutral'` for the Vite
// plugin, we provide a defensive fallback to `Date.now()`.

/** High-resolution monotonic clock, falling back to Date.now() */
const now =
  typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? () => performance.now()
    : () => Date.now();

/**
 * Measure the wall-clock elapsed time for an operation.
 *
 * @returns The elapsed time in milliseconds (fractional if possible).
 */
function measure<T>(fn: () => T): { result: T; duration: number; timestamp: number } {
  const start = now();
  const result = fn();
  const elapsed = now() - start;
  return { result, duration: elapsed, timestamp: Date.now() };
}

// ---------------------------------------------------------------------------
// Public API — exposed via Comlink by the build plugin
// ---------------------------------------------------------------------------

/**
 * The public interface of the compute worker.
 *
 * The `omniWorkerVite` plugin validates that this `api` object is exported
 * and automatically appends `Comlink.expose(api)` during the build step.
 */
export const api = {
  /**
   * CPU-bound busy-wait computation.
   *
   * Blocks the worker thread for approximately `delayMs` milliseconds using
   * a tight spin-loop. Measures the actual elapsed time (which may differ
   * from `delayMs` due to scheduling, CPU load, etc.).
   *
   * This function simulates synchronous, CPU-heavy work that benefits from
   * off-thread execution.
   *
   * @param taskId - Unique identifier for this task (echoed in the result).
   * @param delayMs - Approximate number of milliseconds to busy-wait.
   * @returns An object with the task ID, measured duration, and end timestamp.
   */
  heavyCompute(taskId: number, delayMs: number): { taskId: number; duration: number; timestamp: number } {
    const m = measure(() => {
      const deadline = now() + delayMs;
      while (now() < deadline) {
        // Busy-wait: intentionally empty to simulate CPU-bound work.
      }
    });

    return {
      taskId,
      duration: m.duration,
      timestamp: m.timestamp,
    };
  },

  /**
   * Asynchronous delay-based task.
   *
   * Yields to the event loop via `setTimeout` for approximately `delayMs`
   * milliseconds. Measures the actual elapsed time.
   *
   * This function simulates asynchronous I/O-bound work (e.g., network
   * requests, file reads) that can overlap with other tasks.
   *
   * @param taskId - Unique identifier for this task (echoed in the result).
   * @param delayMs - Approximate number of milliseconds to wait asynchronously.
   * @returns A promise resolving to an object with the task ID, measured duration, and end timestamp.
   */
  asyncTask(taskId: number, delayMs: number): Promise<{ taskId: number; duration: number; timestamp: number }> {
    return new Promise((resolve) => {
      const start = now();
      setTimeout(() => {
        const elapsed = now() - start;
        resolve({
          taskId,
          duration: elapsed,
          timestamp: Date.now(),
        });
      }, delayMs);
    });
  },
};
