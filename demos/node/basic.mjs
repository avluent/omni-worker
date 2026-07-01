/**
 * Node.js Demo: Single Worker (Sequential)
 *
 * Demonstrates basic worker creation, sequential method calls with timing
 * measurement, and clean resource destruction.
 *
 * Run from the project root:
 *   node demos/node/basic.mjs
 *
 * @module demos/node/basic
 */

import { bundleWorker, createWorker, runDemo } from './utils.mjs';

const tasks = [
  { taskId: 1, delayMs: 300 },
  { taskId: 2, delayMs: 500 },
  { taskId: 3, delayMs: 400 },
  { taskId: 4, delayMs: 200 },
];

await runDemo('Single Worker (Sequential)', async () => {
  const bundledCode = await bundleWorker('compute.worker.ts');
  const worker = createWorker('compute', bundledCode);

  try {
    const wallStart = Date.now();
    const results = [];

    for (const task of tasks) {
      const taskStart = Date.now();
      const result = await worker.use().heavyCompute(task.taskId, task.delayMs);
      const taskDuration = Date.now() - taskStart;
      results.push({ task, duration: taskDuration, result });
    }

    const wallClockTime = Date.now() - wallStart;
    const totalTime = results.reduce((sum, r) => sum + r.duration, 0);

    // Print formatted table
    console.log('  Task  Duration    Result');
    console.log('  ─────────────────────────────');
    for (const r of results) {
      console.log(
        `  ${r.task.taskId}     ${r.duration}ms       { taskId: ${r.result.taskId}, duration: ${Math.round(r.result.duration)} }`
      );
    }

    console.log();
    console.log(`  Total wall-clock time: ${wallClockTime}ms`);
    console.log(`  Total task time: ${totalTime}ms`);
  } finally {
    await worker.destroy();
  }
});
