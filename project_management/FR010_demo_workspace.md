# FR010 — Demo Workspace Setup

| Field | Value |
|-------|-------|
| **ID** | FR010 |
| **Title** | Demo Workspace Setup |
| **Category** | Infrastructure / Developer Experience |
| **Created** | 2026-07-01T00:00:00.000Z |
| **Last Updated** | 2026-07-01T00:00:00.000Z |
| **Priority** | High |

## Description

As a developer evaluating the omni-worker library, I want a single demo workspace that I can spin up with one `npm install` and one `npm run` command, In order to quickly verify that the library works in both Node.js and browser environments without setting up my own project.

## Definitions of Done

- [ ] A `demos/` directory exists under the project root
- [ ] The root `package.json` includes `"workspaces": ["demos"]`
- [ ] `demos/package.json` references `@anonaddy/omni-worker` as a workspace dependency (`"*"`)
- [ ] `npm install` at the root installs all dependencies including demo dependencies
- [ ] `npm run demo:node` in the root (or `cd demos && npm run demo:node`) runs Node.js demos
- [ ] `npm run demo:web` in the root (or `cd demos && npm run demo:web`) starts a Vite dev server for web demos
- [ ] All demo dependencies are listed: `react`, `react-dom`, `svelte`, `@vitejs/plugin-react`, `@sveltejs/vite-plugin-svelte`, `esbuild`, `comlink`
- [ ] A Vite config exists at `demos/vite.config.ts` with `omniWorkerVite()`, `@vitejs/plugin-react`, and `@sveltejs/vite-plugin-svelte` plugins
- [ ] A TypeScript config exists at `demos/tsconfig.json` with JSX support for React
- [ ] A Svelte config exists at `demos/svelte.config.js`
- [ ] The workspace is `private: true` (not published to npm)

## Specification

### Workspace Structure

The demo workspace uses npm workspaces to co-locate demos with the main library:

```
/home/jos/dev/omni-worker/
├── package.json          ← add "workspaces": ["demos"]
├── demos/
│   ├── package.json      ← workspace member, private
│   ├── vite.config.ts
│   ├── tsconfig.json
│   ├── svelte.config.js
│   ├── index.html
│   ├── README.md
│   ├── node/
│   │   ├── utils.mjs
│   │   ├── basic.mjs
│   │   ├── pool.mjs
│   │   └── bench.mjs
│   └── src/
│       ├── main.ts
│       ├── style.css
│       ├── workers/
│       │   └── compute.worker.ts
│       ├── shared/
│       │   └── demoLogic.ts
│       └── web/
│           ├── vanilla.ts
│           ├── react.tsx
│           └── svelte/
│               └── Demo.svelte
```

### Root `package.json` Modification

Add the following field to the existing root `package.json`:

```json
{
  "workspaces": ["demos"]
}
```

### Demo `package.json`

```json
{
  "name": "demos",
  "private": true,
  "type": "module",
  "dependencies": {
    "@anonaddy/omni-worker": "*",
    "react": "^18.0.0",
    "react-dom": "^18.0.0",
    "svelte": "^4.0.0"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.0.0",
    "@sveltejs/vite-plugin-svelte": "^4.0.0",
    "vite": "^5.0.0",
    "esbuild": "^0.24.0",
    "comlink": "^4.4.2"
  },
  "scripts": {
    "demo:web": "vite",
    "demo:node:basic": "node node/basic.mjs",
    "demo:node:pool": "node node/pool.mjs",
    "demo:node:bench": "node node/bench.mjs",
    "demo:node": "node node/basic.mjs && node node/pool.mjs && node node/bench.mjs",
    "demo": "npm run demo:node && open http://localhost:5173"
  }
}
```

### Vite Configuration

```typescript
// demos/vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { omniWorkerVite } from '@anonaddy/omni-worker/vite';

export default defineConfig({
  plugins: [
    omniWorkerVite(),
    react(),
    svelte(),
  ],
  server: {
    open: true,
  },
});
```

### Exception Handling

- If `@anonaddy/omni-worker` workspace dependency cannot be resolved, the workspace install will fail with a clear npm error.
- If any framework plugin fails to load, Vite will report the error at startup.

### Tests

No automated tests for the workspace setup itself. Verification is manual:
1. Run `npm install` at root → succeeds
2. Run `npm run demo:node` → prints timing results
3. Run `npm run demo:web` → opens browser with demo page
