# FR014 — Parallelization Showcase

| Field | Value |
|-------|-------|
| **ID** | FR014 |
| **Title** | Parallelization Showcase |
| **Category** | Demo / Proof of Concept |
| **Created** | 2026-07-01T00:00:00.000Z |
| **Last Updated** | 2026-07-01T00:00:00.000Z |
| **Priority** | Medium |

## Description

As a demo viewer, I want to see a clear comparison between sequential execution (single worker) and parallel execution (worker pool), In order to prove that the worker pool actually parallelizes work and provides measurable speedup.

## Definitions of Done

- [ ] 8 tasks are generated with random delays between 200ms and 800ms
- [ ] Sequential mode runs all 8 tasks on a single worker, one at a time
- [ ] Parallel mode runs all 8 tasks on a pool of 4 workers
- [ ] Parallel mode completes in approximately 1/4 the wall-clock time of sequential mode
- [ ] Both modes show per-task timing AND total wall-clock time
- [ ] A speedup factor is displayed: sequentialWallClock / parallelWallClock
- [ ] Workers show different completion times (proving independent execution)
- [ ] The demo works in both Node.js and browser environments

## Specification

### Task Generation

```typescript
function generateTaskCount(count: number): Task[] {
  return Array.from({ length: count }, (_, i) => ({
    taskId: i + 1,
    delayMs: Math.floor(Math.random() * 600) + 200, // 200-800ms
  }));
}
```

Expected total sequential time: ~2800ms (8 tasks × avg 350ms)
Expected parallel time (4 workers): ~700ms (2 rounds × avg 350ms)
Expected speedup: ~4x

### Sequential Execution

```typescript
async function runSequential(worker: IOmniWorker, tasks: Task[]): ExecutionSummary {
  const wallClockStart = performance.now();
  const results: TaskResult[] = [];

  for (const task of tasks) {
    results.push(await executeTask(worker, task));
  }

  return {
    mode: 'sequential',
    workerCount: 1,
    wallClockMs: performance.now() - wallClockStart,
    totalTaskMs: results.reduce((sum, r) => sum + r.durationMs, 0),
    results,
  };
}
```

### Parallel Execution

```typescript
async function runParallel(pool: IOmniWorkerPool, tasks: Task[]): ExecutionSummary {
  const wallClockStart = performance.now();

  // Use Promise.all to dispatch all tasks concurrently
  const results = await Promise.all(
    tasks.map(task => executeTask(pool, task))
  );

  return {
    mode: 'parallel',
    workerCount: pool.getNumOfWorkers(),
    wallClockMs: performance.now() - wallClockStart,
    totalTaskMs: results.reduce((sum, r) => sum + r.durationMs, 0),
    results,
  };
}
```

### Expected Results

| Metric | Expected Range |
|--------|---------------|
| Sequential wall-clock | 2400-3200ms |
| Parallel wall-clock (4 workers) | 600-1000ms |
| Speedup factor | 3-5x |
| Total task time (both modes) | 2400-3200ms |

### Visual Proof

The demo visually proves parallelization by showing:

1. **Sequential**: All task bars stack vertically, one after another
2. **Parallel**: Task bars overlap horizontally (showing concurrent execution)
3. **Summary**: Wall-clock time clearly shorter for parallel mode

### Exception Handling

- If parallel execution doesn't show a speedup of at least 1.5x, display a warning: "Speedup lower than expected — may be due to system load or worker startup overhead"
- If a task fails, continue with remaining tasks and mark the failed task in red
- If pool creation fails, fall back to sequential mode with an error message

### Tests

No automated tests. Manual verification:
1. Run sequential → wall-clock time ≈ sum of delays
2. Run parallel → wall-clock time ≈ 2× max single-round time
3. Speedup factor should be between 2x and 5x (varies by system)
4. Both modes should produce correct results for all 8 tasks
