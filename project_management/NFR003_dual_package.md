# Non-Functional Requirement: NFR003 — ESM and CJS Dual Package Support

## ID
NFR003

## Title
ESM and CJS Dual Package Support

## Category
Non-Functional — Compatibility

## Created
2026-06-30T00:00:00.000Z

## Last Updated
2026-06-30T00:00:00.000Z

## Description
As a **developer consuming this library**, I would like **to import it from both ESM (`import`) and CJS (`require`) projects without configuration changes**, in order to **use the library regardless of my project's module format**.

## Definition of Done
- [ ] `package.json` uses conditional `exports` field correctly
- [ ] ESM consumers get ESM output (`.mjs` or `"type": "module"` compatible)
- [ ] CJS consumers get CJS output (`.cjs` or CommonJS compatible)
- [ ] TypeScript declarations are available for both formats
- [ ] No `__dirname` or `require.resolve` in library source code
- `import.meta.url` or `createRequire` used for path resolution
- [ ] The Vite plugin export works in both ESM and CJS Vite configs

## Priority
1 (Critical)

## Specification

### Package.json Exports Map

```
┌────────────────────────────────────────────────────────────────────┐
│  "exports": {                                                      │
│    ".": {                                                          │
│      "types": "./dist/types/index.d.ts",                           │
│      "import": "./dist/esm/index.js",                              │
│      "require": "./dist/cjs/index.js"                              │
│    },                                                              │
│    "./vite": {                                                     │
│      "types": "./dist/types/vite.d.ts",                            │
│      "import": "./dist/esm/vite/index.js",                         │
│      "require": "./dist/cjs/vite/index.js"                         │
│    },                                                              │
│    "./package.json": "./package.json"                              │
│  }                                                                 │
│                                                                    │
│  "type": "module"  (package is ESM-first)                          │
│  "main": "./dist/cjs/index.js"  (CJS fallback for old tools)       │
│  "module": "./dist/esm/index.js"  (module field for bundlers)      │
│  "types": "./dist/types/index.d.ts"                                │
└────────────────────────────────────────────────────────────────────┘
```

### Output Structure

```
dist/
├── esm/                    # ESM output
│   ├── index.js            # omniWorker(), omniWorkerPool()
│   ├── runtime/
│   │   ├── worker.js
│   │   ├── pool.js
│   │   ├── node.js
│   │   └── web.js
│   └── vite/
│       └── index.js        # Vite plugin
├── cjs/                    # CJS output
│   ├── index.js            # CommonJS exports
│   ├── runtime/
│   │   └── ...
│   └── vite/
│       └── index.js
└── types/                  # Shared TypeScript declarations
    ├── index.d.ts
    ├── worker.d.ts
    ├── pool.d.ts
    ├── vite.d.ts
    └── helpers.d.ts
```

### Path Resolution Strategy

| v0.x Problem | v2.0 Solution |
|-------------|---------------|
| `__dirname` (CJS only, undefined in ESM) | `import.meta.url` + `fileURLToPath` |
| `require.resolve()` (CJS only) | `createRequire(import.meta.url)` from `node:module` |
| `process.cwd()` assumptions | Explicit path resolution via Vite plugin |

### Import Compatibility Matrix

| Consumer | Import Statement | Resolves To |
|----------|-----------------|-------------|
| ESM project | `import { omniWorker } from '@anonaddy/omni-worker'` | `dist/esm/index.js` |
| CJS project | `const { omniWorker } = require('@anonaddy/omni-worker')` | `dist/cjs/index.js` |
| ESM Vite config | `import { omniWorkerVite } from '@anonaddy/omni-worker/vite'` | `dist/esm/vite/index.js` |
| CJS Vite config | `const { omniWorkerVite } = require('@anonaddy/omni-worker/vite')` | `dist/cjs/vite/index.js` |
| TypeScript | Same as above | `.d.ts` types resolved automatically |

### Compliance

- **Node.js specification**: Conditional exports per Node.js docs (nodejs.org/api/packages.html)
- **ISO/IEC 25010 (Portability)**: Adaptable to different module systems without modification
- **TSC 157 (ECMA-402)**: ESM module semantics

### Build Configuration

| Tool | Purpose | Key Options |
|------|---------|-------------|
| `tsc` | TypeScript compilation + declarations | `module: NodeNext`, `moduleResolution: NodeNext` |
| `rollup` or `tsup` | Bundle ESM and CJS outputs | Dual output, externalize `comlink` |
| `api-extractor` (optional) | Verify .d.ts correctness | Check exports match package.json |

### Exceptions

| Exception | Trigger Condition | Behaviour |
|-----------|-------------------|-----------|
| Old Node.js (< 12) | No conditional exports support | `"main"` field provides CJS fallback |
| Bundler ignores exports | Old webpack/Rollup versions | `"module"` field provides fallback |
| TypeScript can't resolve types | Old TS version (< 4.7) | `"types"` root field provides fallback |

### Tests

| Test | Assertion |
|------|-----------|
| ESM import works | `import { omniWorker }` resolves in ESM context |
| CJS require works | `require('@anonaddy/omni-worker')` resolves in CJS context |
| Sub-path export works | `@anonaddy/omni-worker/vite` resolves correctly |
| Types resolve for ESM | TypeScript finds `.d.ts` for ESM import |
| Types resolve for CJS | TypeScript finds `.d.ts` for CJS require |
| No `__dirname` in source | Grep confirms no CJS-only globals in source |
