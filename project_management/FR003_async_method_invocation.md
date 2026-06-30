# Functional Requirement: FR003 — Async Method Invocation

## ID
FR003

## Title
Async Method Invocation via `worker.use()`

## Category
Functional — Core API

## Created
2026-06-30T00:00:00.000Z

## Last Updated
2026-06-30T00:00:00.000Z

## Description
As a **developer**, I would like **to call worker functions via `worker.use().methodName(args)` and always receive a `Promise`**, in order to **have a consistent async interface regardless of whether the underlying function is sync or async**.

## Definition of Done
- [ ] `worker.use()` returns a proxy object with all methods from the worker's `api`
- [ ] Every method call returns `Promise<R>` where `R` is the original return type
- [ ] Synchronous functions in the worker are automatically promisified
- [ ] Async functions in the worker work transparently
- [ ] TypeScript types are fully preserved through the proxy
- [ ] Error thrown inside the worker propagates as a rejected Promise on the main thread

## Priority
1 (Critical)

## Specification

### Behaviour Matrix

| Worker Function | Call from Main Thread | Return Type |
|-----------------|----------------------|-------------|
| `add: (a, b) => a + b` | `worker.use().add(1, 2)` | `Promise<number>` |
| `fetch: () => Promise<string>` | `worker.use().fetch()` | `Promise<string>` |
| `greet: (name) => \`Hello ${name}\`` | `worker.use().greet('Joe')` | `Promise<string>` |
| `complex: () => ({ a: 1, b: [1,2] })` | `worker.use().complex()` | `Promise<{ a: number; b: number[] }>` |

### Error Propagation

```
Worker throws Error("something broke")
    │
    ▼
Error is serialized via Comlink
    │
    ▼
Main thread Promise rejects with same error
    │
    ▼
await worker.use().broken() throws Error("something broke")
```

| Error Type | Origin | Handling |
|------------|--------|----------|
| Application error | Thrown inside worker function | Rejected Promise on main thread |
| Serialization error | Argument or return value is non-serializable | Comlink error, rejected Promise |
| Worker crash | Worker process dies unexpectedly | Rejected Promise with worker error context |

### Serializable Types

| Allowed | Not Allowed |
|---------|-------------|
| `string`, `number`, `boolean`, `null`, `undefined` | Functions |
| Plain objects (`{ a: 1 }`) | Class instances |
| Arrays | `Date` objects |
| `Map`, `Set` (transferred, not cloned) | DOM nodes |
| `ArrayBuffer`, `SharedArrayBuffer` | `Error` instances (custom serialization needed) |

### Exceptions

| Exception | Trigger Condition | Behaviour |
|-----------|-------------------|-----------|
| Worker not initialized | `use()` called before worker ready | Throws `OmniWorkerError` |
| Method not found | Calling non-existent method on proxy | Comlink proxy error (undefined method) |
| Non-serializable argument | Passing a function as argument | Runtime error from structured clone |
| Worker terminated mid-call | `destroy()` called while Promise pending | Promise rejects with termination error |

### Tests

| Test | Assertion |
|------|-----------|
| Sync function returns Promise | `await worker.use().add(1,2)` resolves to `3` |
| Async function returns Promise | `await worker.use().fetch()` resolves correctly |
| Error propagation | Worker error is caught as rejected Promise |
| Complex return type | Object and array returns are correctly serialized |
| Non-serializable argument | Passing a function throws at call time |
| Worker destroyed mid-call | Pending promise rejects |
