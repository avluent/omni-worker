/**
 * Node.js Demo: Worker Pool (Parallel Execution)
 *
 * Demonstrates worker pool creation, round-robin task dispatch, and
 * parallel execution with timing measurement and speedup calculation.
 *
 * The pool distributes 8 tasks across 4 workers in round-robin fashion.
 * Because all tasks are dispatched before awaiting, they execute in
 * parallel across different worker threads.
 *
 * Run from the project root:
 *   node demos/node/pool.mjs
 *
 * @module demos/node/pool
 */

import { bundleWorker, createPool, runDemo } from './utils.mjs';

/**
 * Pool size — number of worker threads to create.
 */
const POOL_SIZE = 4;

/**
 * Eight tasks with varying CPU-bound delays (in milliseconds).
 * With 4 workers, the first round (tasks 1–4) runs in parallel,
 * and the second round (tasks 5–8) follows, so wall-clock time
 * is approximately max(500, 300) + max(450, 250, 350) ≈ 950ms
 * instead of the sequential sum of 2750ms.
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

await runDemo(`Worker Pool (${POOL_SIZE} workers)`, async () => {
  const bundledCode = await bundleWorker('compute.worker.ts');
  const pool = createPool('compute', bundledCode, POOL_SIZE);

  try {
    const wallStart = Date.now();

    // ---- Dispatch all tasks in parallel ----
    // `pool.use()` advances the round-robin counter synchronously,
    // so we compute the worker index for each task BEFORE awaiting.
    // This correctly reflects the round-robin assignment order.
    const taskPromises = tasks.map((task, idx) => {
      const workerIdx = idx % POOL_SIZE;
      const taskStart = Date.now();
      return pool.use().heavyCompute(task.taskId, task.delayMs).then((result) => {
        return {
          task,
          worker: workerIdx,
          duration: Date.now() - taskStart,
          result,
        };
      });
    });

    // Await all tasks simultaneously — they run in parallel across workers
    const results = await Promise.all(taskPromises);

    const wallClockTime = Date.now() - wallStart;
    const totalTime = results.reduce((sum, r) => sum + r.duration, 0);
    const sequentialTotal = tasks.reduce((sum, t) => sum + t.delayMs, 0);
    const speedup = sequentialTotal / wallClockTime;

    // ---- Print formatted table ----
    console.log('  Task  Worker  Duration');
    console.log('  ─────────────────────────────');
    for (const r of results) {
      console.log(
        `  ${r.task.taskId}     ${r.worker}       ${r.duration}ms`
      );
    }

    console.log();
    console.log(`  Total wall-clock time: ${wallClockTime}ms`);
    console.log(`  Total task time: ${totalTime}ms`);
    console.log(`  Speedup: ${speedup.toFixed(1)}x (vs sequential)`);
  } finally {
    await pool.destroy();
  }
});
