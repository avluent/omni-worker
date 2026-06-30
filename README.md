# 👷 Omni Worker v2.0

Run your TypeScript code inside workers (Node.js threads or browser Web Workers) with a single function call.

## Installation

```bash
npm install @anonaddy/omni-worker
```

## Quick Start

### 1. Add the Vite plugin

```ts
// vite.config.ts
import { defineConfig } from 'vite';
import { omniWorkerVite } from '@anonaddy/omni-worker/vite';

export default defineConfig({
  plugins: [omniWorkerVite()],
});
```

### 2. Write a worker file

```ts
// src/compute.worker.ts
import { capitalize } from 'lodash-es';

export const api = {
  add: (a: number, b: number) => a + b,
  capitalize,
};
```

### 3. Use it in your code

```ts
// src/app.ts
import { omniWorker } from '@anonaddy/omni-worker';
import workerUrl, { code } from './compute.worker.ts';

interface ComputeApi {
  add(a: number, b: number): number;
  capitalize(str: string): string;
}

// Auto-detects: uses `code` for Node.js, `workerUrl` for browsers
const isNode = typeof process !== 'undefined' && process.versions?.node;
const worker = omniWorker<ComputeApi>('compute', isNode ? code : workerUrl);

const sum = await worker.use().add(1, 2);        // Promise<number> → 3
const word = await worker.use().capitalize('hi'); // Promise<string> → "Hi"

await worker.destroy();
```

### Worker Pool (Round-Robin)

```ts
import { omniWorkerPool } from '@anonaddy/omni-worker';
import workerUrl, { code } from './compute.worker.ts';

const isNode = typeof process !== 'undefined' && process.versions?.node;

const pool = omniWorkerPool<ComputeApi>('compute', isNode ? code : workerUrl, {
  count: 4,
});

// 9 tasks distributed across 4 workers in round-robin fashion
const words = ['hello', 'world', 'foo', 'bar', 'baz', 'qux', 'quux', 'corge', 'grault'];
const results = await Promise.all(words.map(w => pool.use().capitalize(w)));

await pool.destroy();
```

## API

| Export | Description |
|--------|-------------|
| `omniWorker<T>(path, workerSource)` | Create a single worker |
| `omniWorkerPool<T>(path, workerSource, options)` | Create a worker pool with round-robin dispatch |
| `omniWorkerVite()` | Vite plugin (import from `@anonaddy/omni-worker/vite`) |
| `OmniWorkerError` | Custom error class with structured error codes |
| `OmniWorkerErrorCodes` | Object of machine-readable error code strings |

## Worker File Convention

- Use `.worker.ts` extension
- Export an `api` object containing your functions
- Functions can use any imported dependencies
- All method calls return `Promise<T>` (automatically promisified)

## Worker Pool Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `count` | `number` | `1` | Number of workers (1–128) |

## Vite Plugin Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `include` | `string[]` | `['**/*.worker.ts']` | Glob patterns of files to include |
| `exclude` | `string[]` | `[]` | Glob patterns of files to exclude |
| `target` | `string` | `'es2018'` | esbuild target for bundling worker code |

## Environment Support

| Environment | Worker Type | Auto-Detected |
|-------------|-----------|---------------|
| Node.js 18+ | `worker_threads` | ✅ Yes |
| Modern browsers | Web Workers (ESM) | ✅ Yes |

## Known Limitations

- **Native `.node` binaries**: Single worker only (DLOPEN conflict with pools)
- **Service Workers**: Not supported
- **Safari < 14.1**: ESM Workers not supported

## Migration from v0.x

| v0.x | v2.0 |
|------|------|
| `NodeOmniWorker.build<T>(path)` | `omniWorker<T>(path, workerSource)` |
| `NodeOmniWorker.expose(fnObj)` in worker | `export const api = fnObj` |
| `NodeOmniWorkerPool.buildAndLaunch()` | `omniWorkerPool<T>(path, workerSource, { count })` |
| 9 peer dependencies (webpack, babel, etc.) | 2 dependencies (comlink, esbuild) |
| Decorators required | No decorators |
| Separate Node/Web classes | Single API, auto-detects environment |

## License

MIT
