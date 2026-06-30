# Functional Requirement: FR004 — Worker Resource Cleanup

## ID
FR004

## Title
Worker Resource Cleanup via `destroy()`

## Category
Functional — Lifecycle

## Created
2026-06-30T00:00:00.000Z

## Last Updated
2026-06-30T00:00:00.000Z

## Description
As a **developer**, I would like **to terminate a worker and free its resources by calling `worker.destroy()`**, in order to **prevent memory leaks and ensure clean process termination**.

## Definition of Done
- [ ] `worker.destroy()` is available on every `IOmniWorker` instance
- [ ] `destroy()` returns `Promise<void>` that resolves when the worker is terminated
- [ ] Calling `destroy()` on an already-destroyed worker is idempotent (no error)
- [ ] Calling `use()` on a destroyed worker throws a descriptive error
- [ ] All pending messages to the worker are rejected
- [ ] Memory held by the worker process/thread is released

## Priority
2 (High)

## Specification

### Lifecycle States

```
┌──────────┐    destroy()     ┌──────────┐
│  ACTIVE  │ ────────────────►│ DESTROYED │
└──────────┘                  └──────────┘
     │                              │
     │ use() → works               │ use() → throws
     │ destroy() → terminates      │ destroy() → no-op
     │                              │
┌──────────┐                        │
│ CREATED  │ ── (initial state) ──►│
└──────────┘
```

| State | `use()` | `destroy()` | `isDestroyed()` |
|-------|---------|-------------|-----------------|
| CREATED | works | terminates worker | `false` |
| ACTIVE | works | terminates worker | `false` |
| DESTROYED | throws | no-op (resolved) | `true` |

### Environment-Specific Behaviour

| Environment | Destroy Mechanism | Notes |
|-------------|-------------------|-------|
| Node.js | `worker.terminate()` + `worker.unref()` | Forces process termination |
| Browser | `worker.terminate()` | Stops the Web Worker thread |

### Exception Handling

| Exception | Trigger Condition | Behaviour |
|-----------|-------------------|-----------|
| Worker already destroyed | `destroy()` called twice | Returns `Promise.resolve()` (idempotent) |
| `use()` after destroy | `use()` called on destroyed worker | Throws `OmniWorkerError: Worker already destroyed` |
| Pending call during destroy | Worker killed while Promise pending | Pending Promise rejects |

### Tests

| Test | Assertion |
|------|-----------|
| Destroy terminates worker | Worker process is gone after `await destroy()` |
| Idempotent destroy | Second `destroy()` resolves without error |
| Use after destroy | Throws descriptive error |
| Pending call rejected | Call started before `destroy()` rejects |
| Memory cleanup | No worker references after destroy (tested via weak refs or process listing) |
