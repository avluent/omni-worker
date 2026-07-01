# FR012 — Web Demos (React, Svelte, Vanilla)

| Field | Value |
|-------|-------|
| **ID** | FR012 |
| **Title** | Web Demos (React, Svelte, Vanilla) |
| **Category** | Demo / Documentation |
| **Created** | 2026-07-01T00:00:00.000Z |
| **Last Updated** | 2026-07-01T00:00:00.000Z |
| **Priority** | High |

## Description

As a developer evaluating the omni-worker library for browser use, I want a Vite-powered web demo page with tabs for Vanilla JS, React, and Svelte, In order to see that the library works across different frontend frameworks using Web Workers.

## Definitions of Done

- [ ] A single `index.html` serves as the demo entry point with a tab bar (Vanilla | React | Svelte)
- [ ] `demos/src/main.ts` initializes tab switching and mounts all three framework demos
- [ ] `demos/src/web/vanilla.ts` provides a Vanilla JS demo component
- [ ] `demos/src/web/react.tsx` provides a React demo component
- [ ] `demos/src/web/svelte/Demo.svelte` provides a Svelte demo component
- [ ] All three demos share the same underlying worker and logic (via `demos/src/shared/demoLogic.ts`)
- [ ] Each demo panel contains: "Run Sequential" button, "Run Parallel (Pool)" button, results table with timing bars
- [ ] The demo uses `omniWorkerVite` plugin to bundle the worker
- [ ] Each demo shows workers resolving at different times (variable delays)
- [ ] A shared CSS file provides consistent styling across all frameworks

## Specification

### Entry Point (`index.html`)

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>OmniWorker Demos</title>
  <link rel="stylesheet" href="/src/style.css" />
</head>
<body>
  <h1>👷 OmniWorker Demos</h1>
  <p>Demonstrating parallel worker execution with timing measurement</p>

  <div id="tabs">
    <button data-tab="vanilla" class="active">Vanilla JS</button>
    <button data-tab="react">React</button>
    <button data-tab="svelte">Svelte</button>
  </div>

  <div id="vanilla-panel" class="panel active"></div>
  <div id="react-panel" class="panel"></div>
  <div id="svelte-panel" class="panel"></div>

  <script type="module" src="/src/main.ts"></script>
</body>
</html>
```

### Main Entry (`src/main.ts`)

Handles:
1. Tab switching logic (show/hide panels)
2. Mounting Vanilla demo to `#vanilla-panel`
3. Mounting React demo to `#react-panel`
4. Mounting Svelte demo to `#svelte-panel`

```typescript
// Tab switching
document.querySelectorAll('#tabs button').forEach(btn => {
  btn.addEventListener('click', () => {
    // Toggle active class on buttons and panels
  });
});

// Mount demos
initVanillaDemo(document.getElementById('vanilla-panel')!);
initReactDemo(document.getElementById('react-panel')!);
initSvelteDemo(document.getElementById('svelte-panel')!);
```

### Shared Demo Logic (`src/shared/demoLogic.ts`)

Provides framework-agnostic demo logic:

**`runSequential(worker: IOmniWorker, tasks: Task[]): Promise<Result[]>`**
- Executes tasks one by one (await each before next)
- Returns array of results with per-task timing

**`runParallel(pool: IOmniWorkerPool, tasks: Task[]): Promise<Result[]>`**
- Dispatches all tasks to pool via `Promise.all`
- Returns array of results with per-task timing and wall-clock time

**`createDemoWorker(): IOmniWorker`**
- Creates a worker from `compute.worker.ts` using `omniWorker`
- Returns the worker instance

**`createDemoPool(count: number): IOmniWorkerPool`**
- Creates a pool of workers from `compute.worker.ts`
- Returns the pool instance

### Vanilla Demo (`src/web/vanilla.ts`)

Plain DOM manipulation:
1. Creates HTML elements for buttons, results table
2. Attaches click handlers that call shared demo logic
3. Renders results by appending rows to a table with timing bars
4. Cleans up worker/pool on destroy

### React Demo (`src/web/react.tsx`)

React component with:
1. State for results, loading status, active mode
2. `runSequential` and `runParallel` handlers
3. Result table with styled timing bars
4. `useEffect` for cleanup (destroy worker/pool)

### Svelte Demo (`src/web/svelte/Demo.svelte`)

Svelte component with:
1. Reactive variables for results, loading, mode
2. `{#if}` blocks for loading state
3. `{#each}` for result rendering
4. `onMount` / `onDestroy` for worker lifecycle

### Common Demo Interface

Each demo panel shows:
- **Header**: "Sequential" or "Parallel (4 workers)"
- **Buttons**: "Run Sequential", "Run Parallel (Pool of 4)"
- **Results Table**:
  - Task ID
  - Duration (ms)
  - Visual progress bar (width proportional to duration)
  - Status (running | done)
- **Summary**: Total wall-clock time, total task time, speedup factor

### Worker Import

All demos import the worker the same way:

```typescript
import workerUrl, { code } from '../workers/compute.worker.ts';
import { omniWorker, omniWorkerPool } from '@anonaddy/omni-worker';

const isNode = typeof process !== 'undefined' && process.versions?.node;
const source = isNode ? code : workerUrl;
```

### Exception Handling

- If worker creation fails, show error message in the demo panel
- If a task throws, catch the error and display it in the results table
- Workers/pools are cleaned up when switching tabs or unmounting

### Tests

No automated tests for web demos. Verification is manual:
1. `npm run demo:web` → opens browser
2. Click each tab → demo renders
3. Click "Run Sequential" → shows results with timing
4. Click "Run Parallel" → shows results with timing
5. Compare: parallel should be faster than sequential
