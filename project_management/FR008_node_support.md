# Functional Requirement: FR008 — Node.js Worker Threads Support

## ID
FR008

## Title
Node.js Worker Threads Support

## Category
Functional — Environment Adapter

## Created
2026-06-30T00:00:00.000Z

## Last Updated
2026-06-30T00:00:00.000Z

## Description
As a **Node.js developer**, I would like **to use OmniWorker with `worker_threads` transparently**, in order to **offload CPU-intensive tasks to background threads without writing platform-specific code**.

## Definition of Done
- [ ] `omniWorker()` auto-detects Node.js and creates `worker_threads.Worker`
- [ ] Uses `eval: true` mode for inline bundled code (no temp files)
- [ ] Comlink `node-adapter` is used for message passing
- [ ] Worker has access to Node.js built-in modules (`fs`, `path`, etc.)
- [ ] SharedArrayBuffer is supported if available
- [ ] Works with both ESM (`import`) and CJS (`require`) consumer projects
- [ ] Node.js version requirement is at least 18.x (current LTS)

## Priority
1 (Critical)

## Specification

### Worker Creation

```
┌────────────────────────────────────────────────────────────┐
│  Node.js Worker Thread                                     │
│                                                            │
│  new Worker(bundledCode, {                                 │
│    eval: true,                                             │
│    stdin: 'ignore',                                        │
│    stdout: 'ignore',                                       │
│    stderr: 'inherit',                                      │
│    resourceLimits: {                                      │
│      maxOldGenerationSizeMb: ... (optional, from options)  │
│    }                                                       │
│  })                                                        │
└────────────────────────────────────────────────────────────┘
```

| Option | Value | Rationale |
|--------|-------|-----------|
| `eval` | `true` | Execute bundled code string directly, no file I/O |
| `stdin` | `'ignore'` | Workers don't need stdin |
| `stdout` | `'ignore'` | Prevent console spam from workers |
| `stderr` | `'inherit'` | Worker errors visible in main process output |

### Comlink Integration

| Component | Path | Purpose |
|-----------|------|---------|
| Main thread | `comlink` (ESM) | `Comlink.wrap(nodeEndpoint(worker))` |
| Worker side | `comlink` (bundled in worker) | `Comlink.expose(api)` |
| Adapter | `comlink/dist/esm/node-adapter` | Bridges `postMessage` to `worker_threads` |

### Module Resolution in Worker

| Module Type | Resolution | Notes |
|-------------|-----------|-------|
| Bundled deps | Included in esbuild bundle | Works automatically |
| Node builtins (`fs`, `path`) | Available natively in worker thread | No bundling needed |
| External npm packages | Must be in the Vite project's `node_modules` | Bundled by esbuild |
| Native `.node` modules | Available but single-worker only | DLOPEN conflict with pools |

### ESM / CJS Consumer Support

| Consumer Format | Import Style | Works? |
|-----------------|-------------|--------|
| ESM (`"type": "module"`) | `import { omniWorker } from '@anonaddy/omni-worker'` | Yes |
| CJS (`"type": "commonjs"` or absent) | `const { omniWorker } = require('@anonaddy/omni-worker')` | Yes |
| Mixed | Either | Yes (conditional exports in package.json) |

### Exceptions

| Exception | Trigger Condition | Behaviour |
|-----------|-------------------|-----------|
| Node version < 18 | `process.versions.node` < 18 | Throws `OmniWorkerError` with version requirement |
| Worker thread creation fails | Out of memory or thread limit | Throws with system error details |
| Native module DLOPEN conflict | Pool workers sharing `.node` binary | Documented limitation, single worker recommended |
| Worker unhandled rejection | Promise rejection not caught in worker | Propagates to main thread as error |

### Tests

| Test | Assertion |
|------|-----------|
| Worker thread created | `instanceof Worker` from `worker_threads` |
| Message passing works | `use().add(1,2)` resolves to `3` |
| ESM consumer works | Import from ESM test project succeeds |
| CJS consumer works | Require from CJS test project succeeds |
| Node builtins available | Worker can import and use `fs` |
| Worker stderr inherited | Console.error in worker appears in main output |
| Memory cleanup | Worker thread exits after `destroy()` |
