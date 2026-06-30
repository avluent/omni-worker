# Functional Requirement: FR005 — Worker Pool with Round-Robin Dispatch

## ID
FR005

## Title
Worker Pool with Round-Robin Dispatch

## Category
Functional — Pool API

## Created
2026-06-30T00:00:00.000Z

## Last Updated
2026-06-30T00:00:00.000Z

## Description
As a **developer**, I would like **to create a pool of workers with `omniWorkerPool<T>(path, { count })` that distributes calls in round-robin fashion**, in order to **utilize multiple CPU cores without managing worker lifecycle manually**.

## Definition of Done
- [ ] `omniWorkerPool<T>(path, options)` is exported from the main entry
- [ ] Creates exactly `options.count` independent workers
- [ ] `pool.use()` dispatches to workers in strict round-robin order: 0 → 1 → 2 → ... → N-1 → 0
- [ ] `pool.destroy()` terminates all workers in parallel
- [ ] `pool.getNumOfWorkers()` returns the configured count
- [ ] Pool shares the same interface as single worker (`use()`, `destroy()`)
- [ ] Default pool count is `1` if not specified

## Priority
2 (High)

## Specification

### Function Signature

```
┌───────────────────────────────────────────────────────────────────┐
│  omniWorkerPool<T>(path: string, options?: PoolOptions):         │
│    IOmniWorkerPool<T>                                            │
│                                                                   │
│  PoolOptions:                                                     │
│    count: number  — number of workers (default: 1)               │
│                                                                   │
│  Returns:                                                         │
│    IOmniWorkerPool<T> extending IOmniWorker<T>                   │
│    + getNumOfWorkers(): number                                   │
└───────────────────────────────────────────────────────────────────┘
```

### Round-Robin Dispatch

| Call # | Worker Index | Worker Used |
|--------|-------------|-------------|
| 1 | 0 | workers[0] |
| 2 | 1 | workers[1] |
| 3 | 2 | workers[2] |
| 4 | 0 | workers[0] |
| 5 | 1 | workers[1] |
| N | (N-1) % count | workers[(N-1) % count] |

### Parallel Destruction

All workers are terminated in parallel via `Promise.all()`. The returned promise resolves only when all workers are confirmed terminated.

| Scenario | Behaviour |
|----------|-----------|
| All workers alive | Terminate all, resolve when all done |
| One worker already dead | Skip it, terminate rest, resolve |
| All workers already dead | Resolve immediately (idempotent) |

### Pool Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `count` | `number` | `1` | Number of workers in the pool. Minimum `1`. |

### Exceptions

| Exception | Trigger Condition | Behaviour |
|-----------|-------------------|-----------|
| `count < 1` | Pool created with `count: 0` or negative | Throws `OmniWorkerError: Pool count must be >= 1` |
| `count` too large | Pool created with extremely large count | Throws `OmniWorkerError` with guidance message |
| Worker creation fails | One of N workers fails to start | Destroys all created workers, throws with context |
| Worker dies mid-pool | A pooled worker crashes | Pooled worker returns error; pool continues with remaining workers |

### Tests

| Test | Assertion |
|------|-----------|
| Pool creates correct count | `getNumOfWorkers()` returns configured value |
| Round-robin order | Sequential `use()` calls hit workers 0,1,2,0,1,2,... |
| All workers functional | Each worker can independently process a call |
| Parallel destruction | `destroy()` terminates all workers and resolves |
| Count validation | `count: 0` throws error |
| Partial worker failure | Pool creation fails atomically if any worker fails |
| Default count | No options → count is 1 |
