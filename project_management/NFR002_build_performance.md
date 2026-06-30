# Non-Functional Requirement: NFR002 — Build-Time Bundling Performance

## ID
NFR002

## Title
Build-Time Bundling Performance

## Category
Non-Functional — Performance

## Created
2026-06-30T00:00:00.000Z

## Last Updated
2026-06-30T00:00:00.000Z

## Description
As a **developer using this library**, I would like **worker files to be bundled at build time rather than runtime**, in order to **eliminate the startup latency and race conditions that plagued the v0.x runtime bundling approach**.

## Definition of Done
- [ ] Worker bundling happens during Vite's build phase (once), not at `omniWorker()` call time
- [ ] `omniWorker()` is a synchronous call (no async bundling at runtime)
- [ ] Worker bundling uses esbuild (not webpack) for 10-100x faster transforms
- [ ] No file I/O race conditions (no shared temp directories)
- [ ] Vite caching is leveraged (worker bundles cached between dev rebuilds)
- [ ] Bundle time per worker file is under 100ms for typical worker sizes (< 50KB source)

## Priority
1 (Critical)

## Specification

### Performance Comparison

| Metric | v0.x (Runtime Webpack) | v2.0 (Build-Time esbuild) |
|--------|----------------------|--------------------------|
| Bundling trigger | Every `build()` call | Once at Vite build |
| Bundler | webpack + babel | esbuild (Go binary) |
| Typical bundle time | 500ms - 5s | 5ms - 50ms |
| File I/O | Shared temp dir, race-prone | Vite module cache, no temp files |
| Concurrent builds | Broken (race condition) | Safe (Vite handles concurrency) |
| Memory overhead | webpack compiler in memory | esbuild transform, GC'd immediately |

### esbuild Performance

esbuild is written in Go and compiles to a native binary. Key advantages:

| Feature | Benefit |
|---------|---------|
| Prebuilt binary | No compilation step, instant start |
| Single-threaded transform | Simple, no concurrency bugs |
| TypeScript support | Built-in, no Babel needed |
| Tree-shaking | Built-in, reduces bundle size |
| Caching | Vite's module graph handles caching |

### Vite Integration

```
Vite build lifecycle:
  1. Server starts / build initiated
  2. Vite scans imports, encounters .worker.ts files
  3. omniWorkerVite plugin intercepts via resolveId + load
  4. esbuild.transform() bundles the worker (cached by Vite)
  5. Bundled code returned to Vite's module graph
  6. Consumer's omniWorker() call resolves to already-bundled module

Result: omniWorker() is effectively synchronous — no build step at runtime.
```

### Caching Strategy

| Phase | Cache Mechanism | Scope |
|-------|----------------|-------|
| Vite dev | Vite's module cache (`node_modules/.vite`) | Persists across HMR cycles |
| Vite prod | Vite's build cache | File-based hash invalidation |
| esbuild | No separate cache needed | Vite cache is sufficient |

### Compliance

- **ISO/IEC 25010 (Performance Efficiency)**: Response time for worker creation is dominated by worker thread startup (~10-50ms), not bundling
- **ISO/IEC 25010 (Reliability)**: Eliminates race conditions inherent in shared temp directory approach

### Exceptions

| Exception | Trigger Condition | Behaviour |
|-----------|-------------------|-----------|
| First build slower | Vite cache is cold | Normal Vite cold-start behaviour |
| Large worker bundle | Worker imports large dependencies | Bundle time proportional to dependency graph |
| esbuild wasm fallback | No native binary for platform | 5-10x slower but still functional |

### Tests

| Test | Assertion |
|------|-----------|
| Bundle time measurement | esbuild transform < 100ms for typical worker |
| No runtime bundling | `omniWorker()` returns synchronously (no await needed) |
| No temp file creation | No `.out` or similar directories created at runtime |
| Vite cache hit | Second build is faster than first |
| Concurrent builds | Multiple workers bundled simultaneously without conflict |
