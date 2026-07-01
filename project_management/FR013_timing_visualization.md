# FR013 — Timing Measurement and Visualization

| Field | Value |
|-------|-------|
| **ID** | FR013 |
| **Title** | Timing Measurement and Visualization |
| **Category** | Demo / UX |
| **Created** | 2026-07-01T00:00:00.000Z |
| **Last Updated** | 2026-07-01T00:00:00.000Z |
| **Priority** | Medium |

## Description

As a demo viewer, I want to see clear timing measurements that show how long each worker task takes and how parallel execution reduces total wall-clock time, In order to visually understand the benefit of using worker pools.

## Definitions of Done

- [ ] Each task records: `taskId`, `delayMs`, `startTimestamp`, `endTimestamp`, `durationMs`
- [ ] Sequential execution measures per-task time AND total wall-clock time
- [ ] Parallel execution measures per-task time AND total wall-clock time
- [ ] A `speedup` factor is calculated: `sequentialWallClock / parallelWallClock`
- [ ] Web demos render visual timing bars (width proportional to duration, max 100% for longest task)
- [ ] Web demos show wall-clock time as a horizontal bar above the task bars
- [ ] Node.js demos print formatted tables with timing data
- [ ] Each task has a distinct color for visual differentiation
- [ ] The demo shows at least 8 tasks with variable delays (200-800ms range)

## Specification

### Timing Data Structure

```typescript
interface TaskResult {
  taskId: number;
  delayMs: number;         // Configured delay for this task
  durationMs: number;      // Actual measured duration
  startTimestamp: number;  // Date.now() when task started
  endTimestamp: number;    // Date.now() when task ended
  workerId?: number;       // Which worker handled this (for pool mode)
  status: 'running' | 'done' | 'error';
  error?: string;
}

interface ExecutionSummary {
  mode: 'sequential' | 'parallel';
  workerCount: number;
  wallClockMs: number;     // Total elapsed time from start to last finish
  totalTaskMs: number;     // Sum of all individual task durations
  speedup?: number;        // Only for parallel mode, compared to sequential baseline
  results: TaskResult[];
}
```

### Timing Measurement Approach

**Sequential Mode:**
```typescript
const wallClockStart = performance.now();
const results: TaskResult[] = [];

for (const task of tasks) {
  const taskStart = Date.now();
  const result = await worker.use().heavyCompute(task.id, task.delayMs);
  results.push({
    ...task,
    ...result,
    durationMs: Date.now() - taskStart,
    status: 'done',
  });
}

const wallClockMs = performance.now() - wallClockStart;
```

**Parallel Mode:**
```typescript
const wallClockStart = performance.now();
const tasksWithTiming = tasks.map(async (task) => {
  const taskStart = Date.now();
  const result = await pool.use().heavyCompute(task.id, task.delayMs);
  return {
    ...task,
    ...result,
    durationMs: Date.now() - taskStart,
    status: 'done',
  };
});

const results = await Promise.all(tasksWithTiming);
const wallClockMs = performance.now() - wallClockStart;
```

### Visual Timing Bars (Web)

Each task renders as a horizontal bar:
```
Task 1  [████████████████░░░░░░░░] 400ms
Task 2  [████████████████████████] 600ms  ← max
Task 3  [██████████░░░░░░░░░░░░░░] 300ms
```

Wall-clock time bar (spans full width if it's the total time):
```
Total: [████████████████████████████████████████] 1200ms
```

### Color Scheme

Each task gets a distinct color from a palette:
```css
--task-1-color: #e74c3c;
--task-2-color: #3498db;
--task-3-color: #2ecc71;
--task-4-color: #f39c12;
--task-5-color: #9b59b6;
--task-6-color: #1abc9c;
--task-7-color: #e67e22;
--task-8-color: #34495e;
```

### Summary Display

Below the task bars, a summary section shows:

| Metric | Sequential | Parallel (4 workers) |
|--------|-----------|---------------------|
| Wall-clock time | 2800ms | 700ms |
| Total task time | 2800ms | 2800ms |
| Speedup | 1.0x | 4.0x |

### Exception Handling

- If a task times out (exceeds 5s), mark it as `error` with message "Task timed out"
- If worker communication fails, catch and display error in the task row
- Timing bars should gracefully handle tasks with 0ms duration (show minimal width)

### Tests

No automated tests for visual rendering. Timing accuracy is implicitly tested by the integration tests in the main project. Manual verification:
1. Run demo → sequential takes ~sum of delays
2. Run demo → parallel takes ~max of delays (divided by worker count)
3. Verify speedup factor is approximately equal to worker count
