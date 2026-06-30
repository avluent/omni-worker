# Functional Requirement: FR001 — Worker File Definition

## ID
FR001

## Title
Worker File Definition

## Category
Functional — Worker Interface

## Created
2026-06-30T00:00:00.000Z

## Last Updated
2026-06-30T00:00:00.000Z

## Description
As a **developer using this library**, I would like **to define a worker by writing a `.worker.ts` file that exports an `api` object**, in order to **clearly signal intent and avoid boilerplate `expose()` calls**.

## Definition of Done
- [ ] Worker files use `.worker.ts` extension convention
- [ ] Worker file exports a default or named `api` constant containing functions
- [ ] Functions in `api` can use any imported dependencies (3rd party or project code)
- [ ] Worker files do NOT need to import from `@anonaddy/omni-worker`
- [ ] Worker files do NOT need to call `expose()` — the Vite plugin handles this
- [ ] TypeScript types are preserved from the exported `api` object shape

## Priority
1 (Critical)

## Specification

### File Convention

The consumer writes a worker file with the `.worker.ts` extension. The `api` export is the contract between the worker and the main thread.

```
Example structure (not code to implement):
├── src/
│   ├── app.ts          (main thread code)
│   └── compute.worker.ts   (worker code — .worker extension is the signal)
```

### API Object Shape

The `api` object can contain:
- Arrow functions
- Regular functions
- Imported functions from 3rd party libraries
- Methods that return primitives, objects, arrays, Promises

| Property | Description | Constraints |
|----------|-------------|-------------|
| Function parameters | Must be serializable (primitives, POJOs, arrays) | No functions, class instances, DOM nodes |
| Return values | Must be serializable | Same constraints as parameters |
| Dependencies | Any npm package importable by the bundler | Native `.node` binaries have limitations (see exception below) |

### Exceptions

| Exception | Trigger Condition | Behaviour |
|-----------|-------------------|-----------|
| Missing `api` export | Worker file has no `api` export | Vite plugin emits a compile-time error: `"Worker file must export an 'api' object"` |
| Non-serializable in `api` | `api` contains non-function values | Vite plugin warns at build time; runtime error if called |
| Native binary conflict | Multiple pool workers import the same `.node` binary | Documented limitation — single worker only for native modules |

### Tests

| Test | Assertion |
|------|-----------|
| Worker with simple functions | `api` with `add(a, b)` resolves correctly |
| Worker with 3rd party import | `api` with imported `capitalize` from lodash resolves correctly |
| Worker with no `api` export | Vite build fails with descriptive error |
| Worker with complex return type | `api` returning `{ result: number, cached: boolean }` transfers correctly |
