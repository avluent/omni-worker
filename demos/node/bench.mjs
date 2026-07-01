/**
 * Node.js Benchmark: Sequential vs Parallel
 *
 * Compares sequential execution (single worker) against parallel execution
 * (worker pool) using the same set of tasks. Measures wall-clock time,
 * total task time, and computes speedup factor.
 *
 * Run from the project root:
 *   node demos/node/bench.mjs
 *
 * @module demos/node/bench
 */

import { bundleWorker, createWorker, createPool, runDemo } from './utils.mjs';

/**
 * Pool size — number of worker threads to create for parallel execution.
 */
const POOL_SIZE = 4;

/**
 * Eight tasks with varying CPU-bound delays (in milliseconds).
 * Same tasks used for both sequential and parallel runs.
 */
const tasks = [
  { taskId: 1, delayMs: 400 },
  { taskId: 2, delayMs: 300 },
  { taskId: 3, delayMs: 500 },
  { taskId: 4, delayMs: 200 },
  { taskId: 5, delayMs: 350 },
  { taskId: 6, delayMs: 450 },
  { taskId: 7, delayMs: 250 },
  { taskId: 8, delayMs: 300 },
];

/**
 * Run all tasks sequentially on a single worker.
 *
 * @param worker - The omni-worker instance
 * @returns Wall-clock time in ms
 */
async function runSequential(worker) {
  const wallStart = Date.now();

  for (const task of tasks) {
    await worker.use().heavyCompute(task.taskId, task.delayMs);
  }

  return Date.now() - wallStart;
}

/**
 * Run all tasks in parallel using a worker pool.
 *
 * @param pool - The omni-worker pool instance
 * @returns Wall-clock time in ms
 */
async function runParallel(pool) {
  const wallStart = Date.now();

  const taskPromises = tasks.map((task) =>
    pool.use().heavyCompute(task.taskId, task.delayMs)
  );
  await Promise.all(taskPromises);

  return Date.now() - wallStart;
}

await runDemo('Sequential vs Parallel', async () => {
  const bundledCode = await bundleWorker('compute.worker.ts');

  // ---- Sequential phase ----
  const seqWorker = createWorker('compute-sequential', bundledCode);
  let seqWallClock = 0;
  try {
    seqWallClock = await runSequential(seqWorker);
  } finally {
    await seqWorker.destroy();
  }

  // ---- Parallel phase ----
  const pool = createPool('compute-parallel', bundledCode, POOL_SIZE);
  let parallelWallClock = 0;
  try {
    parallelWallClock = await runParallel(pool);
  } finally {
    await pool.destroy();
  }

  // ---- Calculate metrics ----
  const sequentialTotal = tasks.reduce((sum, t) => sum + t.delayMs, 0);
  const parallelTotal = sequentialTotal; // Same tasks
  const speedup = seqWallClock / parallelWallClock;

  // ---- Print comparison table ----
  console.log('  Mode        Wall-Clock    Total Task    Speedup');
  console.log('  ──────────────────────────────────────────────────');
  console.log(
    `  Sequential  ${seqWallClock}ms          ${sequentialTotal}ms         1.0x`
  );
  console.log(
    `  Pool (${POOL_SIZE})      ${parallelWallClock}ms          ${parallelTotal}ms         ${speedup.toFixed(1)}x`
  );
  console.log();
  console.log(`  Result: Pool is ${speedup.toFixed(1)}x faster than sequential`);
});
