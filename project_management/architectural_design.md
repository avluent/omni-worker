# Architectural Design — Omni Worker v2.0

## Overview

`@anonaddy/omni-worker` v2 is a rewrite of the v0.x library. The fundamental shift is from **runtime bundling** (webpack invoked at `.build()` time) to **build-time transformation** (Vite plugin bundles workers during the consumer's normal build cycle) paired with a **lightweight runtime** that handles only worker lifecycle and Comlink communication.

## Architecture at a Glance

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Consumer Project                            │
│                                                                     │
│  ┌─────────────────────┐    ┌─────────────────────────────────────┐ │
│  │   vite.config.ts     │    │         src/app.ts                  │ │
│  │                      │    │                                     │ │
│  │  plugins: [          │    │  import { omniWorker } from        │ │
│  │    omniWorkerVite()  │    │    '@anonaddy/omni-worker'         │ │
│  │  ]                   │    │                                     │ │
│  └──────────┬──────────┘    │  const w = omniWorker<IMyApi>(      │ │
│             │               │    './my.worker.ts'                  │ │
│             │               │  );                                  │ │
│             │               │  const r = await w.use().add(1,2);   │ │
│             │               └───────────┬─────────────────────────┘ │
│             │                     uses (runtime)                    │
│             ▼                                                       │
│  ┌─────────────────────┐    ┌─────────────────────────────────────┐ │
│  │  Build Phase         │    │  Runtime Phase                      │ │
│  │                      │    │                                     │ │
│  │  .worker.ts file  ──┼───►│  Worker process / thread            │ │
│  │  ── esbuild bundle  │    │  (Comlink exposed API)              │ │
│  │  ── inline base64   │    │                                     │ │
│  │  ── output: .js     │    │  Main thread                        │ │
│  │                      │    │  (Comlink wrapped proxy)            │ │
│  └─────────────────────┘    └─────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

## Package Structure

```
@anonaddy/omni-worker/
├── package.json                    # Dual ESM/CJS, comlink as only dependency
├── src/
│   ├── index.ts                    # Main entry: omniWorker(), omniWorkerPool()
│   ├── runtime/
│   │   ├── worker.ts               # Runtime base class (shared Node + Web)
│   │   ├── pool.ts                 # Pool implementation with round-robin
│   │   ├── node.ts                 # Node.js worker_threads adapter
│   │   └── web.ts                  # Browser Web Worker adapter
│   ├── types/
│   │   ├── index.ts                # Public type exports
│   │   ├── worker.d.ts             # IOmniWorker<T>
│   │   ├── pool.d.ts               # IOmniWorkerPool<T>
│   │   └── vite.d.ts               # Plugin options
│   └── vite/
│       └── index.ts                # Vite plugin source
├── dist/
│   ├── esm/                        # ESM output
│   ├── cjs/                        # CJS output
│   └── types/                      # .d.ts files
└── __tests__/
    ├── node/
    └── web/
```

## Component Design

### 1. Vite Plugin (`omniWorkerVite()`)

**Role:** Build-time transformer for `.worker.ts` files.

**Mechanism:**
- Intercepts Vite's module resolution for files matching `.worker.ts` extension
- Runs esbuild (inline, no external process) on the matched file
- Bundles the worker code with all its imports into a single JS blob
- Injects the Comlink expose boilerplate at the end of the bundle
- Returns the bundled code as a Vite module (either inline base64 data URL or written to file)

**Key design decisions:**
- Uses esbuild because it ships as a single npm package with prebuilt binaries. No Babel, no webpack config needed.
- The bundled output wraps the user's code and auto-appends the Comlink `expose()` call.
- For development: hot reload support via Vite's HMR (re-bundle on file change).
- For production: single bundle, tree-shaken by Vite's normal pipeline.

**Worker file convention:**
```typescript
// my.worker.ts  (the .worker extension signals the plugin)
import { capitalize } from 'lodash-es';

export const api = {
  capitalize,
  add: (a: number, b: number) => a + b,
};
```

The plugin transforms this into a bundled module that calls `Comlink.expose(api)`.

### 2. Runtime Library

**Role:** Worker lifecycle management and Comlink communication bridge.

**`omniWorker<T>(path: string)`** — factory function:
- Takes a path to the bundled worker output
- Creates the appropriate worker (Node: `worker_threads.Worker`, Web: `new Worker()`)
- Sets up Comlink `wrap()` on the main thread side
- Returns `IOmniWorker<T>` proxy
- No bundling happens here. The file is already bundled by Vite.

**`omniWorkerPool<T>(path: string, options)`** — factory function:
- Creates N workers from the same bundled file
- Implements round-robin dispatch via internal counter
- Returns `IOmniWorkerPool<T>`

### 3. Type System

```typescript
// Consumer defines:
interface MyApi {
  add(a: number, b: number): number;
  capitalize(str: string): string;
}

// Factory returns typed proxy:
const w = omniWorker<MyApi>('./my.worker.ts');
// w.use().add(1, 2) => Promise<number>  (typed!)
```

The generic `<T>` parameter flows through `omniWorker` → `IOmniWorker` → `use()` → Comlink proxy. TypeScript infers return types as `Promise<R>` where `R` is the original return type.

### 4. Node.js Adapter

- Uses `worker_threads.Worker` with `eval: true` for inline code or file path
- Uses `comlink/dist/esm/node-adapter.cjs` (stable ESM path)
- Handles `parentPort` on the worker side
- Supports both ESM and CJS consumer projects

### 5. Web Adapter

- Uses `new Worker(url, { type: 'module' })`
- For dev: data URL with bundled code
- For prod: file URL from Vite's asset pipeline
- Uses standard `comlink` ESM import

## Data Flow

```
Consumer calls w.use().add(1, 2)
    │
    ▼
Comlink proxy serializes { method: 'add', args: [1, 2], uid: 42 }
    │
    ▼
postMessage() to Worker
    │
    ▼
Worker receives message, deserializes
    │
    ▼
Calls original api.add(1, 2) → returns 3
    │
    ▼
Result serialized back via postMessage
    │
    ▼
Comlink proxy resolves Promise<3> on main thread
```

## Migration from v0.x to v2

| v0.x | v2.0 |
|------|------|
| `NodeOmniWorker.build<IMyApi>('./worker.ts')` | `omniWorker<IMyApi>('./worker.worker.ts')` |
| `NodeOmniWorker.expose(fnObj)` in worker file | `export const api = fnObj` in worker file |
| `NodeOmniWorkerPool.buildAndLaunch()` | `omniWorkerPool<IMyApi>('./worker.worker.ts', { count: 4 })` |
| Webpack + babel in peerDependencies | Only comlink in dependencies |
| Decorator-based interface checking | Standard TypeScript interfaces |
| WebOmniWorker / NodeOmniWorker classes | Single `omniWorker()` factory, auto-detects environment |

## Key Improvements Over v0.x

1. **No runtime bundling** — workers are bundled during the consumer's Vite build, not at `.build()` time
2. **Zero bundler peer dependencies** — the library depends only on `comlink`
3. **Proper ESM/CJS dual package** — tested and verified for both import styles
4. **No decorators** — plain TypeScript, works with any tsconfig
5. **Reliable path resolution** — `import.meta.url` / `import createRequire`, no stack parsing
6. **Fixed pool logic** — correct round-robin, no off-by-one errors
7. **Deterministic build output** — no shared temp directories, no race conditions
8. **Single API** — `omniWorker()` works for both Node and Web, auto-detects environment

## Compliance & Best Practices

- **ISO/IEC 25010**: Addresses modifiability (plugin architecture), portability (dual ESM/CJS), and reliability (deterministic builds)
- **CommonJS/ES Module Interop**: Uses `package.json` conditional exports per Node.js specification
- **TypeScript**: Strict mode, declaration files, generic type safety
- **Testing**: Separate Node (vitest + forks) and Web (vitest + jsdom) test suites

---

# Demo Workspace Architecture

## Overview

The demo workspace proves the library works in both Node.js and browser environments through a single `npm install` + `npm run` experience. It showcases parallel worker execution with measured timing comparisons.

## Architecture at a Glance

```
┌──────────────────────────────────────────────────────────────────────┐
│                      omni-worker project root                        │
│                                                                      │
│  ┌──────────────┐    ┌─────────────────────────────────────────────┐ │
│  │ package.json  │    │               demos/                        │ │
│  │               │    │                                             │ │
│  │ workspaces:   │◄───┤  package.json  (workspace member)           │ │
│  │  ["demos"]    │    │                                             │ │
│  └──────────────┘    │  node/                                       │ │
│                      │  ├── utils.mjs    ← bundle + create helpers  │ │
│                      │  ├── basic.mjs    ← single worker demo       │ │
│                      │  ├── pool.mjs     ← pool parallelization     │ │
│                      │  └── bench.mjs    ← sequential vs pool       │ │
│                      │                                             │ │
│                      │  src/                                       │ │
│                      │  ├── workers/                               │ │
│                      │  │   └── compute.worker.ts  ← shared worker │ │
│                      │  ├── shared/                                │ │
│                      │  │   └── demoLogic.ts    ← timing + execute │ │
│                      │  └── web/                                   │ │
│                      │      ├── vanilla.ts    ← Vanilla demo       │ │
│                      │      ├── react.tsx     ← React demo         │ │
│                      │      └── svelte/                        │ │
│                      │          └── Demo.svelte  ← Svelte demo      │ │
│                      │                                             │ │
│                      │  index.html      ← tabbed demo page         │ │
│                      │  vite.config.ts  ← 3 plugins coexist        │ │
│                      └─────────────────────────────────────────────┘ │
│                                                                      │
│  Library source:                                                     │
│  └── src/index.ts → omniWorker(), omniWorkerPool()                  │
│      src/vite/index.ts → omniWorkerVite()                           │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

## Design Decisions

### 1. NPM Workspaces

**Why:** Single `npm install` at root resolves all dependencies including the library itself. The `demos` workspace references `@anonaddy/omni-worker` as `"*"` which npm resolves to the workspace root.

**Alternative considered:** Symlink or `file:` reference. Workspaces are the standard approach and handle hoisting automatically.

### 2. Three Frameworks in One Vite App

**Why:** Demonstrates the library's framework-agnostic nature. React, Svelte, and Vanilla all import the same worker and use the same `omniWorker` API.

**How it works:**
- `@vitejs/plugin-react` handles `.tsx` / `.jsx` files
- `@sveltejs/vite-plugin-svelte` handles `.svelte` files
- `omniWorkerVite()` handles `.worker.ts` files
- Each plugin operates on its own file extension pattern — no conflicts

**Mount strategy:** Each framework mounts to its own DOM element:
- Vanilla: `document.getElementById('vanilla-panel')`
- React: `ReactDOM.createRoot(document.getElementById('react-panel'))`
- Svelte: `new App({ target: document.getElementById('svelte-panel') })`

### 3. Shared Worker Definition

**Why:** The same worker proves the library works identically across all environments. `compute.worker.ts` exports an `api` object with CPU-bound (`heavyCompute`) and async (`asyncTask`) functions.

**File location:** `demos/src/workers/compute.worker.ts`

### 4. Node.js Bundling Strategy

**Why:** The Vite plugin runs during web builds. For Node.js demos, we need a standalone bundling step.

**Approach:** A helper module (`node/utils.mjs`) uses esbuild directly to bundle the worker TypeScript source, appending Comlink `expose()` with `parentPort` for Node.js worker_threads. This mirrors what the Vite plugin does internally.

### 5. Timing Measurement

**Approach:**
- Wall-clock time measured via `performance.now()` (or `Date.now()` in Node)
- Per-task duration measured from `Date.now()` before call to `Date.now()` after resolution
- Speedup factor: `sequentialWallClock / parallelWallClock`
- Web demos render visual bars proportional to duration
- Node.js demos print formatted tables

## Data Flow — Web Demo

```
User clicks "Run Parallel" button
     │
     ▼
React/Svelte/Vanilla component calls runParallel(pool, tasks)
     │
     ▼
demoLogic.ts creates pool with omniWorkerPool('compute', workerUrl, { count: 4 })
     │
     ▼
Pool dispatches 8 tasks via round-robin (Promise.all)
     │
     ▼
Each worker (Web Worker) executes heavyCompute(taskId, delayMs)
     │
     │  Worker A: [██████░░] 400ms  Task 1, 5
     │  Worker B: [████████] 600ms  Task 2, 6
     │  Worker C: [████████████] 800ms  Task 3, 7
     │  Worker D: [███░░░░░] 300ms  Task 4, 8
     │
     ▼
Results collected with per-task timing
     │
     ▼
Component re-renders with visual timing bars and summary
```

## Data Flow — Node.js Demo

```
User runs: node demos/node/bench.mjs
     │
     ▼
utils.mjs bundles compute.worker.ts via esbuild
     │
     ▼
omniWorker('compute', bundledCode) creates worker_threads.Worker
     │
     ▼
Sequential: 8 tasks × one-by-one → total ≈ sum of delays
Pool: 8 tasks × 4 workers → total ≈ max per round × 2 rounds
     │
     ▼
Formatted table printed to stdout
```

## Compliance

- **ISO/IEC 25010**: Demonstrates portability (works in Node + browsers) and usability (clear timing comparison)
- **Single Source of Truth**: Shared worker definition proves identical behavior across environments
- **No Secret Logic**: All timing measured via standard APIs (`Date.now()`, `performance.now()`)
- **Clean Exit**: All workers/pools destroyed in `finally` blocks
