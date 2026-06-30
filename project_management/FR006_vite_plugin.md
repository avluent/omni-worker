# Functional Requirement: FR006 — Vite Plugin for Build-Time Bundling

## ID
FR006

## Title
Vite Plugin for Build-Time Bundling

## Category
Functional — Build System

## Created
2026-06-30T00:00:00.000Z

## Last Updated
2026-06-30T00:00:00.000Z

## Description
As a **developer**, I would like **to add `omniWorkerVite()` to my Vite plugins array and have all `.worker.ts` files automatically bundled at build time**, in order to **avoid runtime bundling overhead and remove all bundler dependencies from the library**.

## Definition of Done
- [ ] `omniWorkerVite()` is exported from `@anonaddy/omni-worker/vite`
- [ ] Plugin intercepts `.worker.ts` files during Vite's resolution phase
- [ ] Worker files are bundled with esbuild (inline, no subprocess)
- [ ] Comlink `expose()` boilerplate is automatically injected
- [ ] Bundled output is available as a Vite module (data URL or file)
- [ ] Works in both Vite dev mode (HMR) and production build
- [ ] TypeScript types in worker files are processed (stripped from output)
- [ ] 3rd party imports in worker files are bundled into the worker

## Priority
1 (Critical)

## Specification

### Plugin Hook Points

| Vite Hook | Purpose | Behaviour |
|-----------|---------|-----------|
| `resolveId` | Detect `.worker.ts` files | Returns custom id for matching files |
| `load` | Transform and bundle the worker | Runs esbuild, injects expose, returns bundled code |
| `transform` | (optional) Post-process | Any additional transformations |

### Bundling Pipeline

```
Input: ./src/compute.worker.ts
         │
         ▼
    esbuild.transform()
    │  - target: ES2018 (or consumer's target)
    │  - format: esm
    │  - bundle: true (includes all imports)
    │  - external: [] (nothing external for workers)
         │
         ▼
    Inject Comlink boilerplate:
    │  import * as Comlink from 'comlink';
    │  // ... bundled user code ...
    │  Comlink.expose(api);
         │
         ▼
    Return to Vite as module code
```

### esbuild Configuration

| Option | Value | Rationale |
|--------|-------|-----------|
| `target` | `es2018` | Matches minimum Node 12 / modern browser support |
| `format` | `esm` | Workers run as ESM modules |
| `bundle` | `true` | Include all imports in single file |
| `sourcemap` | `linked` in dev, `false` in prod | Debuggable in dev, small in prod |
| `minify` | `false` (let Vite handle it) | Avoid double-minification |

### Environment-Specific Output

| Environment | Output Format | How Worker is Created |
|-------------|--------------|----------------------|
| Node.js | Inline code string via module export | `new Worker(code, { eval: true })` |
| Browser | Data URL (`data:text/javascript,...`) | `new Worker(dataUrl, { type: 'module' })` |

### Plugin Options

```
┌─────────────────────────────────────────────────────────┐
│  omniWorkerVite(options?: VitePluginOptions): Plugin   │
│                                                         │
│  VitePluginOptions:                                     │
│    include: string[]  — glob patterns (default: ['**/*.worker.ts']) │
│    exclude: string[]  — glob patterns (default: [])    │
│    target: string     — esbuild target (default: 'es2018') │
└─────────────────────────────────────────────────────────┘
```

### Exceptions

| Exception | Trigger Condition | Behaviour |
|-----------|-------------------|-----------|
| Worker file has no `api` export | Bundled code doesn't export `api` | Build error: `"Worker file '{path}' must export an 'api' object"` |
| esbuild compilation error | Syntax error in worker file | Build error with esbuild diagnostics |
| Circular dependency | Worker imports main thread code | Build error or runtime worker deadlock (documented) |
| Missing dependency | npm package not installed | esbuild resolution error (standard Vite error flow) |

### Tests

| Test | Assertion |
|------|-----------|
| Plugin resolves .worker.ts files | `resolveId` returns custom id for `.worker.ts` |
| Worker bundled with imports | 3rd party import is included in bundle |
| Comlink expose injected | Bundled code contains `Comlink.expose(api)` |
| TypeScript stripped | No TS syntax in bundled output |
| Dev mode HMR | Worker re-bundles on file change |
| Production build | Single optimized bundle produced |
| No api export | Build fails with descriptive error |
| esbuild error propagation | Syntax errors surface as Vite build errors |
