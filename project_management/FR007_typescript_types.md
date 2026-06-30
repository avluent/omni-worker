# Functional Requirement: FR007 — TypeScript Type Safety

## ID
FR007

## Title
TypeScript Type Safety Throughout the API

## Category
Functional — Developer Experience

## Created
2026-06-30T00:00:00.000Z

## Last Updated
2026-06-30T00:00:00.000Z

## Description
As a **TypeScript developer**, I would like **full type inference from defining my worker interface through to calling `worker.use().method()`**, in order to **get IDE autocomplete, compile-time error detection, and eliminate runtime type mismatches**.

## Definition of Done
- [ ] `omniWorker<T>(path)` accepts a generic type parameter
- [ ] `worker.use()` returns a proxy typed as `Promisify<T>` (all methods return Promises)
- [ ] The worker's `api` export shape can be inferred from the interface
- [ ] Declaration files (`.d.ts`) are shipped and correctly reference Comlink types
- [ ] No use of `any`, `unknown`, or type assertions in public API
- [ ] Pool types extend worker types correctly
- [ ] Consumer's tsconfig doesn't need special settings to use the library

## Priority
2 (High)

## Specification

### Type Flow Diagram

```
Consumer defines interface:
  interface MyApi {
    add(a: number, b: number): number;
    fetch(): Promise<string>;
  }

omniWorker<MyApi>('...')
    │
    ▼
Returns: IOmniWorker<MyApi>
    │
    ▼
use() returns: RemoteProxy<MyApi>
    │           (all methods promisified)
    ▼
use().add(1, 2)       → Promise<number>     (sync → async)
use().fetch()         → Promise<string>     (async stays async)

use().add("not", 2)   → Compile error: argument of type 'string' is not assignable
use().nonExistent()   → Compile error: property does not exist on type
```

### Type Definitions

| Type | Purpose | Location |
|------|---------|----------|
| `IOmniWorker<T>` | Worker interface with `use()`, `destroy()`, `isDestroyed()` | `src/types/worker.ts` |
| `IOmniWorkerPool<T>` | Extends `IOmniWorker<T>` with `getNumOfWorkers()` | `src/types/pool.ts` |
| `PoolOptions` | `{ count: number }` | `src/types/pool.ts` |
| `VitePluginOptions` | Plugin configuration | `src/types/vite.ts` |
| `OmniWorkerError` | Custom error class | `src/runtime/error.ts` |
| `Promisify<T>` | Utility to wrap all return types in Promise | `src/types/helpers.ts` |

### Comlink Type Integration

Comlink's `wrap<T>()` already returns typed proxies. The library must ensure:
- The generic `T` from `omniWorker<T>` flows directly into `Comlink.wrap<T>()`
- No type casting or assertion is needed at any point
- Comlink's internal `Proxy` types are re-exported if needed

### Utility Types

```
Promisify<T> utility:
  ┌────────────────────────────────────────────────────────┐
  │ type Promisify<T> = {                                  │
  │   [K in keyof T]:                                      │
  │     T[K] extends (...args: infer A) => infer R         │
  │       ? (...args: A) => Promise<Awaited<R>>            │
  │       : T[K]                                           │
  │ };                                                     │
└──────────────────────────────────────────────────────────┘

Effect:
  { add: (a, b) => number }     → { add: (a, b) => Promise<number> }
  { fetch: () => Promise<string> } → { fetch: () => Promise<string> }
```

### Exceptions

| Exception | Trigger Condition | Behaviour |
|-----------|-------------------|-----------|
| Generic omitted | `omniWorker('./file.worker.ts')` without `<T>` | TypeScript error: `Missing type parameter` |
| Interface mismatch | Consumer interface doesn't match worker `api` | Compile error at call site |
| Comlink types missing | Comlink not installed | npm install error (comlink is a dependency) |

### Tests

| Test | Assertion |
|------|-----------|
| Type inference with generic | `omniWorker<MyApi>` gives correct `use()` return type |
| Sync method becomes Promise | `use().syncMethod()` has type `Promise<R>` |
| Async method stays Promise | `use().asyncMethod()` has type `Promise<R>` (not `Promise<Promise<R>>`) |
| Wrong argument type | `use().add('x', 2)` produces compile error |
| Missing method | `use().unknown()` produces compile error |
| Pool extends worker types | `IOmniWorkerPool<T>` includes all `IOmniWorker<T>` methods |
| Declaration files exist | `dist/types/` contains all `.d.ts` files |
