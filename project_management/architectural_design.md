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
