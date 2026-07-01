# FR011 — Node.js Demo Scripts

| Field | Value |
|-------|-------|
| **ID** | FR011 |
| **Title** | Node.js Demo Scripts |
| **Category** | Demo / Documentation |
| **Created** | 2026-07-01T00:00:00.000Z |
| **Last Updated** | 2026-07-01T00:00:00.000Z |
| **Priority** | High |

## Description

As a developer evaluating the omni-worker library for server-side use, I want runnable Node.js demo scripts that show how to create workers, pools, and measure their performance, In order to convince myself that the library works correctly in a Node.js environment.

## Definitions of Done

- [ ] A helper module `demos/node/utils.mjs` exists that bundles worker source files using esbuild and wraps `omniWorker` / `omniWorkerPool` creation
- [ ] `demos/node/basic.mjs` demonstrates single worker creation, method calls, and destruction
- [ ] `demos/node/pool.mjs` demonstrates pool creation, round-robin dispatch, and parallel execution
- [ ] `demos/node/bench.mjs` benchmarks sequential execution vs pool execution and prints comparative timing
- [ ] Each script outputs formatted results to the console (no external dependencies)
- [ ] Each script measures and prints wall-clock time, per-task time, and total time
- [ ] All scripts use the shared worker from `demos/src/workers/compute.worker.ts`
- [ ] All scripts print a summary table showing task results with timing
- [ ] Each script exits cleanly with `process.exit(0)` after cleanup

## Specification

### Helper Module (`node/utils.mjs`)

The helper provides two core functions:

**`bundleWorker(workerPath: string): Promise<string>`**
- Reads the TypeScript source from `src/workers/{workerPath}`
- Appends Comlink expose boilerplate with `parentPort` (Node.js-specific)
- Bundles with esbuild using `platform: 'neutral'`, `format: 'esm'`, `bundle: true`
- Returns the bundled JavaScript string

**`createWorker(name: string, code: string): IOmniWorker`**
- Thin wrapper around `omniWorker(name, code)`

**`createPool(name: string, code: string, count: number): IOmniWorkerPool`**
- Thin wrapper around `omniWorkerPool(name, code, { count })`

### Basic Demo (`node/basic.mjs`)

Demonstrates:
1. Bundling the worker source
2. Creating a single worker via `omniWorker`
3. Calling methods with timing measurement
4. Printing a formatted result table
5. Destroying the worker

Output format:
```
═══════════════════════════════════════════
  Node.js Demo: Single Worker
═══════════════════════════════════════════

  Task    Duration    Result
  ─────────────────────────────
  1       300ms       { taskId: 1, duration: 300 }
  2       500ms       { taskId: 2, duration: 500 }

  Total wall-clock time: 812ms
  Total task time: 800ms
```

### Pool Demo (`node/pool.mjs`)

Demonstrates:
1. Creating a pool of 4 workers
2. Dispatching 8 tasks via round-robin
3. Measuring per-task and wall-clock time
4. Showing that parallel execution is faster than sequential

Output format:
```
═══════════════════════════════════════════
  Node.js Demo: Worker Pool (4 workers)
═══════════════════════════════════════════

  Task    Worker    Duration
  ─────────────────────────────
  1       0        400ms
  2       1        300ms
  3       2        500ms
  4       3        200ms
  5       0        350ms
  6       1        450ms
  7       2        250ms
  8       3        300ms

  Total wall-clock time: 650ms
  Total task time: 2750ms
  Speedup: 4.2x (vs sequential)
```

### Benchmark Demo (`node/bench.mjs`)

Demonstrates:
1. Running the same 8 tasks sequentially (single worker)
2. Running the same 8 tasks in parallel (pool of 4)
3. Comparing wall-clock times

Output format:
```
═══════════════════════════════════════════
  Node.js Benchmark: Sequential vs Parallel
═══════════════════════════════════════════

  Mode        Wall-Clock    Total Task    Speedup
  ──────────────────────────────────────────────────
  Sequential  2780ms        2750ms        1.0x
  Pool (4)    680ms         2750ms        4.1x

  Result: Pool is 4.1x faster than sequential
```

### Shared Worker Interface

All demos use the same worker from `demos/src/workers/compute.worker.ts`:

```typescript
export const api = {
  heavyCompute(taskId: number, delayMs: number): { taskId: number, duration: number, timestamp: number };
  asyncTask(taskId: number, delayMs: number): Promise<{ taskId: number, duration: number, timestamp: number }>;
};
```

### Exception Handling

- If esbuild bundling fails, the helper prints the error and exits with code 1
- If worker creation fails, the script prints the error and exits with code 1
- All workers/pools are destroyed in a `finally` block to prevent resource leaks

### Tests

No automated tests for demo scripts. Verification is manual:
1. `node node/basic.mjs` → prints timing table
2. `node node/pool.mjs` → prints parallel timing table
3. `node node/bench.mjs` → prints comparison table
