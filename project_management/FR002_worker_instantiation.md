# Functional Requirement: FR002 — Worker Instantiation

## ID
FR002

## Title
Worker Instantiation via `omniWorker()`

## Category
Functional — Core API

## Created
2026-06-30T00:00:00.000Z

## Last Updated
2026-06-30T00:00:00.000Z

## Description
As a **developer**, I would like **to instantiate a worker by calling `omniWorker<T>('./path/to/file.worker.ts')`**, in order to **get a typed, ready-to-use worker proxy without class instantiation or static method calls**.

## Definition of Done
- [ ] `omniWorker<T>(path)` is exported from the main entry point
- [ ] Accepts a string path (relative, resolved at Vite build time)
- [ ] Generic `<T>` parameter provides full type safety on `use()` return
- [ ] Returns a resolved `IOmniWorker<T>` synchronously (bundling happened at build time)
- [ ] Auto-detects environment (Node.js vs browser) and uses the correct worker type
- [ ] Throws if called with a path that doesn't resolve to a worker file

## Priority
1 (Critical)

## Specification

### Function Signature

```
Table notation (no code):
┌──────────────────────────────────────────────────────────────┐
│  omniWorker<T>(path: string): IOmniWorker<T>                │
│                                                              │
│  Parameters:                                                 │
│    path  — string, relative path to .worker.ts file          │
│  Generic:                                                    │
│    T     — interface describing the worker's api shape       │
│  Returns:                                                    │
│    IOmniWorker<T> — typed worker proxy                       │
└──────────────────────────────────────────────────────────────┘
```

### Environment Detection

| Environment | Detection Method | Worker Type Created |
|-------------|------------------|---------------------|
| Node.js | `typeof process !== 'undefined' && process.versions?.node` | `worker_threads.Worker` |
| Browser | `typeof Worker !== 'undefined'` | `new Worker(url, { type: 'module' })` |
| Neither | — | Throws `OmniWorkerError: Unsupported environment` |

### Resolution Flow

```
Vite build phase (before runtime):
  .worker.ts file ──► esbuild bundle ──► inline data URL or asset file

Runtime:
  omniWorker(path) ──► resolve bundled URL ──► create Worker ──► Comlink.wrap() ──► return proxy
```

### Exceptions

| Exception | Trigger Condition | Behaviour |
|-----------|-------------------|-----------|
| Path not found | Vite couldn't resolve the worker file | Build-time error from Vite |
| Wrong environment | Neither Node nor browser detected | Runtime `OmniWorkerError` |
| Worker creation fails | `new Worker()` throws | Propagates with context: `"Failed to create worker for: {path}"` |
| Duplicate instantiation | Same path called multiple times | Each call creates a NEW worker (no caching) |

### Tests

| Test | Assertion |
|------|-----------|
| Instantiation with valid path | Returns `IOmniWorker` with `isInitialized() === true` |
| Generic type flows through | `use().add(1, 2)` has type `Promise<number>` |
| Invalid environment detection | Throws descriptive error |
| Multiple instantiations | Each creates independent worker |
| Worker file not found | Build-time error, not runtime crash |
