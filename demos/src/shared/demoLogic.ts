/**
 * Shared Demo Logic Module
 *
 * Framework-agnostic utilities used by all three web demos (Vanilla, React,
 * Svelte) and the Node.js benchmark scripts. Provides task generation,
 * execution runners (sequential / parallel), timing measurement, and
 * worker / pool creation helpers.
 *
 * This module does **not** depend on any UI framework — consumers are
 * responsible for rendering the `ExecutionSummary` data however they choose.
 *
 * @module demos/shared/demoLogic
 */

import {
  omniWorker,
  omniWorkerPool,
  type IOmniWorker,
  type IOmniWorkerPool,
} from '@anonaddy/omni-worker';

// ---------------------------------------------------------------------------
// Compute API — matches the `api` object exported by compute.worker.ts
// ---------------------------------------------------------------------------

/**
 * The public interface exposed by the compute worker.
 *
 * Declared here so that `IOmniWorker<ComputeApi>` and
 * `IOmniWorkerPool<ComputeApi>` are fully typed.
 */
export interface ComputeApi {
  heavyCompute(taskId: number, delayMs: number): {
    taskId: number;
    duration: number;
    timestamp: number;
  };
  asyncTask(taskId: number, delayMs: number): Promise<{
    taskId: number;
    duration: number;
    timestamp: number;
  }>;
}

// ---------------------------------------------------------------------------
// Worker import — processed by the Vite plugin at build time.
//
// The Vite plugin (`omniWorkerVite`) transforms `.worker.ts` imports into
// modules that export:
//   - `default`  : a data URL (browser Web Worker)
//   - `code`     : raw bundled JS string (Node.js eval mode)
//   - `url`      : same as default
//
// TypeScript cannot statically analyze these generated exports. We use
// type assertions to bridge the gap between compile-time types and the
// runtime module shape.
// ---------------------------------------------------------------------------

/**
 * Shape of the Vite-plugin-transformed worker module.
 *
 * @internal
 */
interface ViteWorkerModule {
  default: string;
  code: string;
  url: string;
}

// The Vite plugin transforms this import at build time. TypeScript resolves
// the actual `.worker.ts` file which has different exports, hence the `as`.
// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
const workerModule =
  // @ts-expect-error Vite plugin generates these exports at build time
  await import('../workers/compute.worker.ts') as ViteWorkerModule;

/** Browser worker URL (default export from Vite plugin). */
const workerUrl: string = workerModule.default;
/** Node.js worker source code (named `code` export from Vite plugin). */
const workerCode: string = workerModule.code;

// ---------------------------------------------------------------------------
// High-resolution timing helper
// ---------------------------------------------------------------------------

/**
 * High-resolution monotonic clock fallback.
 *
 * `performance.now()` is available in browsers and Node.js v20+ (including
 * worker threads). Falls back to `Date.now()` for older environments.
 */
const hrNow: () => number =
  typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? () => performance.now()
    : () => Date.now();

/**
 * Wall-clock start / elapsed helper using `hrNow`.
 *
 * @returns The current high-resolution timestamp.
 */
export function wallClockNow(): number {
  return hrNow();
}

// ---------------------------------------------------------------------------
// Environment detection (shared across helpers)
// ---------------------------------------------------------------------------

/**
 * Detect whether the current runtime is Node.js.
 *
 * Checks for `process.versions.node` which is the most reliable way to
 * distinguish Node.js from a browser context (including Cloudflare Workers
 * and other edge runtimes that may define `process` differently).
 */
function isNodeEnvironment(): boolean {
  return typeof process !== 'undefined' && !!process.versions?.node;
}

// ---------------------------------------------------------------------------
// Data types
// ---------------------------------------------------------------------------

/**
 * A single unit of work to be dispatched to a worker.
 *
 * @property taskId - Unique identifier for ordering and tracking.
 * @property delayMs - The configured busy-wait duration in milliseconds.
 */
export interface Task {
  taskId: number;
  delayMs: number;
}

/**
 * The result of executing a single task on a worker.
 *
 * Captures per-task timing, which worker handled it (pool mode),
 * and the final status.
 *
 * @property taskId - Echoed from the original task.
 * @property delayMs - The configured delay (for comparison with actual).
 * @property durationMs - Actual measured duration in milliseconds.
 * @property startTimestamp - `Date.now()` when the task started.
 * @property endTimestamp - `Date.now()` when the task completed.
 * @property workerId - Which pool worker handled the task (pool mode only).
 * @property status - Terminal state of the task execution.
 * @property error - Error message if the task failed.
 */
export interface TaskResult {
  taskId: number;
  delayMs: number;
  durationMs: number;
  startTimestamp: number;
  endTimestamp: number;
  workerId?: number;
  status: 'running' | 'done' | 'error';
  error?: string;
}

/**
 * Summary of a complete execution run (sequential or parallel).
 *
 * Aggregates per-task results and computes aggregate timing metrics.
 *
 * @property mode - Whether tasks ran sequentially or in parallel.
 * @property workerCount - Number of workers used (1 for sequential).
 * @property wallClockMs - Total elapsed wall-clock time in milliseconds.
 * @property totalTaskMs - Sum of all individual task durations.
 * @property speedup - Ratio of sequential wall-clock to parallel wall-clock
 *                     (only meaningful when comparing two runs).
 * @property results - Per-task results in the order tasks were dispatched.
 */
export interface ExecutionSummary {
  mode: 'sequential' | 'parallel';
  workerCount: number;
  wallClockMs: number;
  totalTaskMs: number;
  speedup?: number;
  results: TaskResult[];
}

// ---------------------------------------------------------------------------
// Task generation
// ---------------------------------------------------------------------------

/**
 * Generate an array of tasks with random delays.
 *
 * Each task receives a unique `taskId` (1-based) and a random `delayMs`
 * between 200 and 800 milliseconds (inclusive of lower bound, exclusive
 * of upper bound).
 *
 * @param count - The number of tasks to generate.
 * @returns An array of `count` tasks.
 *
 * @example
 * ```ts
 * const tasks = generateTasks(8);
 * // [{ taskId: 1, delayMs: 437 }, { taskId: 2, delayMs: 612 }, ...]
 * ```
 */
export function generateTasks(count: number): Task[] {
  return Array.from({ length: count }, (_, i) => ({
    taskId: i + 1,
    delayMs: Math.floor(Math.random() * 600) + 200, // 200-799ms
  }));
}

// ---------------------------------------------------------------------------
// Single task execution
// ---------------------------------------------------------------------------

/**
 * Execute a single task on a worker and measure its duration.
 *
 * Calls `worker.use().heavyCompute(taskId, delayMs)`, records wall-clock
 * timestamps, and wraps the result in a `TaskResult` object. Errors are
 * caught and reported with `status: 'error'`.
 *
 * @param worker - An omni-worker or pool instance (anything with `.use()`).
 * @param task - The task to execute.
 * @returns A resolved `TaskResult` with timing and status information.
 *
 * @example
 * ```ts
 * const result = await executeTask(worker, { taskId: 1, delayMs: 400 });
 * console.log(result);
 * // { taskId: 1, delayMs: 400, durationMs: 402, startTimestamp: ...,
 * //   endTimestamp: ..., status: 'done' }
 * ```
 */
export async function executeTask(
  worker: IOmniWorker<ComputeApi> | IOmniWorkerPool<ComputeApi>,
  task: Task,
): Promise<TaskResult> {
  const startTimestamp = Date.now();

  try {
    await worker.use().heavyCompute(task.taskId, task.delayMs);
    const endTimestamp = Date.now();
    return {
      taskId: task.taskId,
      delayMs: task.delayMs,
      durationMs: endTimestamp - startTimestamp,
      startTimestamp,
      endTimestamp,
      status: 'done',
    };
  } catch (err) {
    const endTimestamp = Date.now();
    const errorMessage =
      err instanceof Error ? err.message : String(err);
    return {
      taskId: task.taskId,
      delayMs: task.delayMs,
      durationMs: endTimestamp - startTimestamp,
      startTimestamp,
      endTimestamp,
      status: 'error',
      error: errorMessage,
    };
  }
}

// ---------------------------------------------------------------------------
// Sequential runner
// ---------------------------------------------------------------------------

/**
 * Execute all tasks sequentially on a single worker.
 *
 * Tasks are awaited one at a time. Wall-clock time is measured using
 * the high-resolution clock (`performance.now()` or `Date.now()` fallback).
 *
 * @param worker - A single omni-worker instance.
 * @param tasks - The tasks to execute in order.
 * @returns An `ExecutionSummary` with `mode: 'sequential'`.
 *
 * @example
 * ```ts
 * const summary = await runSequential(worker, tasks);
 * console.log(`Sequential: ${summary.wallClockMs.toFixed(0)}ms`);
 * ```
 */
export async function runSequential(
  worker: IOmniWorker<ComputeApi>,
  tasks: Task[],
): Promise<ExecutionSummary> {
  const wallClockStart = hrNow();
  const results: TaskResult[] = [];

  for (const task of tasks) {
    results.push(await executeTask(worker, task));
  }

  const wallClockMs = hrNow() - wallClockStart;
  const totalTaskMs = results.reduce((sum, r) => sum + r.durationMs, 0);

  return {
    mode: 'sequential',
    workerCount: 1,
    wallClockMs,
    totalTaskMs,
    results,
  };
}

// ---------------------------------------------------------------------------
// Parallel runner
// ---------------------------------------------------------------------------

/**
 * Execute all tasks in parallel using a worker pool.
 *
 * All tasks are dispatched concurrently via `Promise.all`. Wall-clock time
 * is measured from dispatch start to last completion.
 *
 * @param pool - A worker pool instance.
 * @param tasks - The tasks to execute in parallel.
 * @returns An `ExecutionSummary` with `mode: 'parallel'`.
 *
 * @example
 * ```ts
 * const summary = await runParallel(pool, tasks);
 * console.log(`Parallel: ${summary.wallClockMs.toFixed(0)}ms`);
 * ```
 */
export async function runParallel(
  pool: IOmniWorkerPool<ComputeApi>,
  tasks: Task[],
): Promise<ExecutionSummary> {
  const wallClockStart = hrNow();

  const results = await Promise.all(
    tasks.map((task) => executeTask(pool, task)),
  );

  const wallClockMs = hrNow() - wallClockStart;
  const totalTaskMs = results.reduce((sum, r) => sum + r.durationMs, 0);

  return {
    mode: 'parallel',
    workerCount: pool.getNumOfWorkers(),
    wallClockMs,
    totalTaskMs,
    results,
  };
}

// ---------------------------------------------------------------------------
// Speedup calculation
// ---------------------------------------------------------------------------

/**
 * Calculate the speedup factor between sequential and parallel runs.
 *
 * A speedup > 1 indicates that parallel execution was faster. Values
 * typically approach the number of workers for CPU-bound tasks.
 *
 * @param sequential - The sequential execution summary.
 * @param parallel - The parallel execution summary.
 * @returns The speedup factor (sequential wall-clock / parallel wall-clock).
 *
 * @example
 * ```ts
 * const seq = await runSequential(worker, tasks);
 * const par = await runParallel(pool, tasks);
 * const speedup = calculateSpeedup(seq, par);
 * // e.g. 3.7 (parallel was 3.7x faster)
 * ```
 */
export function calculateSpeedup(
  sequential: ExecutionSummary,
  parallel: ExecutionSummary,
): number {
  if (parallel.wallClockMs === 0) {
    return Infinity;
  }
  return sequential.wallClockMs / parallel.wallClockMs;
}

// ---------------------------------------------------------------------------
// Worker / Pool creation helpers
// ---------------------------------------------------------------------------

/**
 * Create a demo worker auto-configured for the current environment.
 *
 * In Node.js environments the pre-bundled code string is used directly.
 * In browser environments the data URL (default export from the Vite
 * plugin) is used to create a Web Worker.
 *
 * @returns A ready-to-use `IOmniWorker` instance.
 *
 * @example
 * ```ts
 * const worker = createDemoWorker();
 * const result = await worker.use().heavyCompute(1, 400);
 * await worker.destroy();
 * ```
 */
export function createDemoWorker(): IOmniWorker<ComputeApi> {
  const useCode = isNodeEnvironment();
  return omniWorker<ComputeApi>('compute', useCode ? workerCode : workerUrl);
}

/**
 * Create a demo worker pool auto-configured for the current environment.
 *
 * In Node.js environments the pre-bundled code string is used. In browser
 * environments the data URL is used. All pool workers share the same source.
 *
 * @param count - Number of workers in the pool (must be ≥ 1).
 * @returns A ready-to-use `IOmniWorkerPool` instance.
 *
 * @example
 * ```ts
 * const pool = createDemoPool(4);
 * console.log(pool.getNumOfWorkers()); // 4
 * const result = await pool.use().heavyCompute(1, 400);
 * await pool.destroy();
 * ```
 */
export function createDemoPool(count: number): IOmniWorkerPool<ComputeApi> {
  const useCode = isNodeEnvironment();
  return omniWorkerPool<ComputeApi>('compute', useCode ? workerCode : workerUrl, { count });
}
