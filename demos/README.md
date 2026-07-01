# 👷 OmniWorker Demos

**Run the same Web Worker code everywhere — Node.js, React, Svelte, and plain browser JavaScript.**

## Prerequisites

* **Node.js 20+**

## Getting Started

```bash
# Install all dependencies (workspace setup)
npm install

# Run Node.js demos
node demos/node/basic.mjs
node demos/node/pool.mjs
node demos/node/bench.mjs

# Run web demo (opens browser)
npm run demo:web -w demos
```

## Demos Overview

| Demo | Type | Description |
|------|------|-------------|
| `node/basic.mjs` | Node.js | Single worker, sequential execution |
| `node/pool.mjs` | Node.js | Pool of 4, parallel execution with round-robin |
| `node/bench.mjs` | Node.js | Benchmark comparing sequential vs parallel |
| Web — Vanilla | Browser | Pure DOM manipulation demo |
| Web — React | Browser | React component demo |
| Web — Svelte | Browser | Svelte component demo |

## Project Structure

```
demos/
├── node/              ← Node.js CLI demos
│   ├── utils.mjs      ← Shared bundling helper (esbuild)
│   ├── basic.mjs      ← Single worker demo
│   ├── pool.mjs       ← Pool parallelization demo
│   └── bench.mjs      ← Sequential vs parallel benchmark
└── src/               ← Web demos (Vite + React + Svelte)
    ├── workers/       ← Shared worker definitions
    ├── shared/        ← Framework-agnostic demo logic
    └── web/           ← Framework-specific components
```

## How It Works

* **`compute.worker.ts`** — One shared worker file proves identical behavior across all environments.
* **`omniWorker()`** — Creates a single worker. Uses `worker_threads` on Node.js and native Web Workers in the browser.
* **`omniWorkerPool()`** — Creates a pool with round-robin dispatch for parallel task execution.
* **`omniWorkerVite()`** — Vite plugin that handles `.worker.ts` build-time transformation for web builds.
