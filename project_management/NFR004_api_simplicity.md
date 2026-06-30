# Non-Functional Requirement: NFR004 — API Simplicity and Minimal Surface

## ID
NFR004

## Title
API Simplicity and Minimal Surface

## Category
Non-Functional — Usability

## Created
2026-06-30T00:00:00.000Z

## Last Updated
2026-06-30T00:00:00.000Z

## Description
As a **developer new to this library**, I would like **a simple, intuitive API with minimal concepts to learn**, in order to **start using workers in my project with minimal cognitive overhead and documentation reading**.

## Definition of Done
- [ ] Main exports are exactly: `omniWorker`, `omniWorkerPool`, `OmniWorkerError`
- [ ] No classes to instantiate — only factory functions
- [ ] No decorators required
- [ ] No static method pattern (`NodeOmniWorker.build()`) — use function calls
- [ ] Worker file convention is a single `export const api = { ... }`
- [ ] API surface is documentable in under 500 words
- [ ] Zero configuration for basic usage (Vite plugin with defaults)

## Priority
2 (High)

## Specification

### API Surface

```
┌─────────────────────────────────────────────────────────────────────┐
│  Main Entry: @anonaddy/omni-worker                                  │
│                                                                     │
│  Exports:                                                           │
│    omniWorker<T>(path: string): IOmniWorker<T>                     │
│    omniWorkerPool<T>(path: string, options?: { count: number }):   │
│      IOmniWorkerPool<T>                                            │
│    class OmniWorkerError extends Error                              │
│                                                                     │
│  Vite Plugin: @anonaddy/omni-worker/vite                           │
│                                                                     │
│  Exports:                                                           │
│    omniWorkerVite(options?: VitePluginOptions): Plugin             │
└─────────────────────────────────────────────────────────────────────┘
```

### Comparison: v0.x vs v2.0 API Complexity

| Aspect | v0.x | v2.0 |
|--------|------|------|
| Main exports | `NodeOmniWorker`, `NodeOmniWorkerPool`, `WebOmniWorker`, `WebOmniWorkerPool`, 6+ interfaces | `omniWorker`, `omniWorkerPool`, `OmniWorkerError` |
| Instantiation | `await NodeOmniWorker.build<T>(path)` | `omniWorker<T>(path)` |
| Worker file code | `import { NodeOmniWorker }; NodeOmniWorker.expose(fnObj)` | `export const api = fnObj` |
| Decorators needed | Yes (`@staticImplements`) | No |
| Pool creation | `NodeOmniWorkerPool.buildAndLaunch<T>(path, opts)` | `omniWorkerPool<T>(path, { count: 4 })` |
| Environment split | Separate classes for Node/Web | Single API, auto-detects |
| Types to import | 6+ interface imports | 0 (inferred from generic) |
| Configuration | Webpack config, babel presets, loader resolution | Vite plugin with sensible defaults |

### Learning Path

```
Step 1: npm install @anonaddy/omni-worker
Step 2: Add omniWorkerVite() to vite.config.ts plugins
Step 3: Write my.worker.ts with `export const api = { ... }`
Step 4: Import and use: const w = omniWorker<MyApi>('./my.worker.ts')
Step 5: Call: await w.use().myMethod(args)
Step 6: Cleanup: await w.destroy()
```

### Usability Heuristics (Nielsen)

| Heuristic | Compliance | Notes |
|-----------|-----------|-------|
| Visibility of system status | `isDestroyed()` check available | Clear state feedback |
| Match between system and real world | Factory function naming matches intent | `omniWorker`, `omniWorkerPool` |
| User control and freedom | `destroy()` for cleanup | Explicit resource release |
| Consistency and standards | Follows Comlink conventions | Familiar to Comlink users |
| Error prevention | Compile-time type errors | TypeScript prevents misuse |
| Recognition rather than recall | Simple function names | No memorization needed |
| Flexibility and efficiency | Default options available | Quick start without config |
| Aesthetic and minimalist | 3 main exports | Minimal cognitive load |
| Help users recognize errors | `OmniWorkerError` with context | Descriptive messages |
| Help and documentation | README with examples | Clear migration guide |

### Compliance

- **ISO/IEC 25010 (Usability)**: Learnability, operability, user engagement
- **Occam's Razor principle**: Simplest API that solves the problem

### Exceptions

| Exception | Trigger Condition | Behaviour |
|-----------|-------------------|-----------|
| Advanced use case not covered | Need custom worker options | `omniWorker()` accepts optional config in future versions |
| Custom bundler needed | Not using Vite | Plugin for that bundler can be added later |
| Non-TypeScript project | Consumer uses plain JS | Library works; type safety is optional |

### Tests

| Test | Assertion |
|------|-----------|
| API surface audit | Exactly 3 exports from main entry |
| No decorator usage | Source contains no decorator syntax |
| No class instantiation | No `new` keyword in consumer examples |
| Documentation completeness | All exported APIs have JSDoc |
| Quick start works | README example runs without modification |
