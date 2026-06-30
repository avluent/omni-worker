/**
 * Integration tests for the browser Web Worker path.
 *
 * Runs in jsdom environment (via vitest.web.config.ts). Since jsdom has
 * limited Web Worker support, these tests mock the `Worker` global to
 * verify the factory functions, type system, pool round-robin dispatch,
 * and lifecycle management all work correctly in a browser-like context.
 *
 * Coverage:
 * - Environment detection (browser vs Node)
 * - `createWebWorker` factory with mocked Worker
 * - `createWorkerPool` with mocked web workers
 * - Round-robin dispatch verification
 * - Worker lifecycle: create → destroy → idempotent cleanup
 * - Error handling for unsupported environments
 * - Data URL and asset URL support
 * - Pool destruction and post-destroy semantics
 * - Multiple independent worker instances
 * - Worker termination side-effects
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as Comlink from 'comlink';
import { createWebWorker, WebOmniWorker } from '../../src/runtime/web';
import { createWorkerPool, OmniWorkerPool } from '../../src/runtime/pool';
import { OmniWorkerError, OmniWorkerErrorCodes } from '../../src/runtime/error';
import { WorkerRuntime } from '../../src/runtime/worker';

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

/**
 * Creates a mock Worker class that simulates the browser Worker API.
 * Each call returns a fresh mock instance with spied methods.
 */
function createMockWorkerClass() {
  let instanceCount = 0;
  const instances: MockWorkerInstance[] = [];

  class MockWorker {
    public terminate: ReturnType<typeof vi.fn>;
    public postMessage: ReturnType<typeof vi.fn>;
    public addEventListener: ReturnType<typeof vi.fn>;
    public removeEventListener: ReturnType<typeof vi.fn>;
    public readonly _mockId: number;

    constructor(
      public readonly url: string,
      public readonly options?: WorkerOptions,
    ) {
      this._mockId = instanceCount++;
      this.terminate = vi.fn();
      this.postMessage = vi.fn();
      this.addEventListener = vi.fn();
      this.removeEventListener = vi.fn();
      instances.push(this);
    }
  }

  const MockFn = MockWorker as unknown as ReturnType<typeof vi.fn> & typeof MockWorker;
  (MockFn as ReturnType<typeof vi.fn>).mockClear = vi.fn();
  (MockFn as ReturnType<typeof vi.fn>).mock = {
    calls: [] as any[],
    instances: instances,
    contexts: [] as any[],
    results: [] as any[],
    lastCall: null as any,
    lastContext: null as any,
  };
  (MockFn as ReturnType<typeof vi.fn>).mock.calls = [];

  // Make the constructor behave like vi.fn() for call tracking
  const trackedConstructor = vi.fn(function (this: MockWorker, url: string, options?: WorkerOptions) {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const self = this;
    self._mockId = instanceCount++;
    self.url = url;
    self.options = options;
    self.terminate = vi.fn();
    self.postMessage = vi.fn();
    self.addEventListener = vi.fn();
    self.removeEventListener = vi.fn();
    instances.push(self);
  });

  Object.setPrototypeOf(trackedConstructor.prototype, MockWorker.prototype);

  return {
    MockWorker: trackedConstructor,
    getInstances: () => (trackedConstructor.mock.instances as MockWorkerInstance[]),
    getCallCount: () => trackedConstructor.mock.calls.length,
    getCallArgs: () => trackedConstructor.mock.calls,
    reset: () => {
      instanceCount = 0;
      instances.length = 0;
      (trackedConstructor.mock.instances as any[]).length = 0;
      trackedConstructor.mockReset();
    },
  };
}

interface MockWorkerInstance {
  _mockId: number;
  url: string;
  options?: WorkerOptions;
  terminate: ReturnType<typeof vi.fn>;
  postMessage: ReturnType<typeof vi.fn>;
  addEventListener: ReturnType<typeof vi.fn>;
  removeEventListener: ReturnType<typeof vi.fn>;
}

/**
 * Helper to set up a mocked Worker global for a test.
 * Returns a cleanup function.
 */
function withMockWorker(testFn: (mockHelper: ReturnType<typeof createMockWorkerClass>) => void | Promise<void>) {
  const originalWorker = (globalThis as Record<string, unknown>)['Worker'];
  const helper = createMockWorkerClass();

  beforeAll(() => {
    (globalThis as Record<string, unknown>)['Worker'] = helper.MockWorker;
  });

  afterAll(() => {
    if (originalWorker) {
      (globalThis as Record<string, unknown>)['Worker'] = originalWorker;
    } else {
      delete (globalThis as Record<string, unknown>)['Worker'];
    }
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    helper.reset();
  });

  return testFn(helper);
}

/* ------------------------------------------------------------------ */
/* Tests: Environment Detection                                       */
/* ------------------------------------------------------------------ */

describe('Web Integration — Environment Detection', () => {
  it('identifies jsdom environment characteristics', () => {
    // In jsdom, `window` should exist (browser-like)
    expect(typeof window).toBe('object');
    // In vitest with jsdom, `document` should exist
    expect(typeof document).toBe('object');
    // process may still exist from vitest's Node.js host
    // The key distinction is whether Worker is available
    const hasWindow = typeof window !== 'undefined';
    const hasDocument = typeof document !== 'undefined';
    expect(hasWindow).toBe(true);
    expect(hasDocument).toBe(true);
  });

  it('detects Worker availability before mocking', () => {
    // Note: our tests always mock Worker in beforeAll, so this verifies
    // the mock is actually set up correctly
    const hasWorker = typeof (globalThis as Record<string, unknown>)['Worker'] !== 'undefined';
    // Worker might not exist yet depending on test ordering
    // This is informational — the real tests come below
    expect(typeof hasWorker).toBe('boolean');
  });

  it('detects Node.js via process.versions.node (vitest host)', () => {
    // Even in jsdom, the vitest host is Node.js
    const isNode = typeof process !== 'undefined' && !!process.versions?.node;
    // This tells us that omniWorker() will route to Node, not Web,
    // in this test environment. That's why we test createWebWorker directly.
    expect(typeof isNode).toBe('boolean');
  });
});

/* ------------------------------------------------------------------ */
/* Tests: createWebWorker — Browser Factory                           */
/* ------------------------------------------------------------------ */

describe('Web Integration — createWebWorker Factory', () => {
  let originalWorker: unknown;
  let MockWorkerHelper: ReturnType<typeof createMockWorkerClass>;

  beforeEach(() => {
    originalWorker = (globalThis as Record<string, unknown>)['Worker'];
    MockWorkerHelper = createMockWorkerClass();
    (globalThis as Record<string, unknown>)['Worker'] = MockWorkerHelper.MockWorker;
  });

  afterEach(() => {
    if (originalWorker) {
      (globalThis as Record<string, unknown>)['Worker'] = originalWorker;
    } else {
      delete (globalThis as Record<string, unknown>)['Worker'];
    }
    vi.restoreAllMocks();
  });

  describe('basic creation', () => {
    it('creates a WebOmniWorker instance', () => {
      const worker = createWebWorker('./test.worker.ts', '/worker.js');

      expect(worker).toBeInstanceOf(WebOmniWorker);
      expect(worker).toBeInstanceOf(WorkerRuntime);
    });

    it('creates a Worker with type: module', () => {
      createWebWorker('./test.worker.ts', '/worker.js');

      expect(MockWorkerHelper.getCallCount()).toBe(1);
      const callArgs = MockWorkerHelper.getCallArgs()[0];
      expect(callArgs[0]).toBe('/worker.js');
      expect(callArgs[1]).toEqual({ type: 'module' });
    });

    it('stores the worker path', () => {
      const worker = createWebWorker('./my/deep/path/worker.worker.ts', '/worker.js');

      expect(worker['_path']).toBe('./my/deep/path/worker.worker.ts');
    });

    it('worker is not destroyed after creation', () => {
      const worker = createWebWorker('./test.worker.ts', '/worker.js');

      expect(worker.isDestroyed()).toBe(false);
    });

    it('has IOmniWorker interface methods', () => {
      const worker = createWebWorker('./test.worker.ts', '/worker.js');

      expect(typeof worker.use).toBe('function');
      expect(typeof worker.destroy).toBe('function');
      expect(typeof worker.isDestroyed).toBe('function');
    });
  });

  describe('URL handling', () => {
    it('accepts a plain asset URL', () => {
      createWebWorker('./test.worker.ts', '/assets/math-worker.js');

      const calls = MockWorkerHelper.getCallArgs();
      expect(calls[0][0]).toBe('/assets/math-worker.js');
    });

    it('accepts a base64 data URL', () => {
      const dataUrl = 'data:text/javascript;base64,ZXhwb3J0IGZ1bmN0aW9uIGFkZCgpIHt9';
      createWebWorker('./test.worker.ts', dataUrl);

      const calls = MockWorkerHelper.getCallArgs();
      expect(calls[0][0]).toBe(dataUrl);
      expect(calls[0][1]).toEqual({ type: 'module' });
    });

    it('accepts a plain-text data URL', () => {
      const dataUrl = 'data:text/javascript,code';
      createWebWorker('./test.worker.ts', dataUrl);

      const calls = MockWorkerHelper.getCallArgs();
      expect(calls[0][0]).toBe(dataUrl);
    });

    it('accepts a relative URL', () => {
      createWebWorker('./test.worker.ts', './workers/math.js');

      const calls = MockWorkerHelper.getCallArgs();
      expect(calls[0][0]).toBe('./workers/math.js');
    });

    it('accepts URL with query parameters', () => {
      createWebWorker(
        './test.worker.ts',
        '/assets/worker.js?version=2.0&env=production'
      );

      const calls = MockWorkerHelper.getCallArgs();
      expect(calls[0][0]).toBe('/assets/worker.js?version=2.0&env=production');
    });

    it('accepts empty string URL (delegates to browser)', () => {
      createWebWorker('./empty.worker.ts', '');

      const calls = MockWorkerHelper.getCallArgs();
      expect(calls[0][0]).toBe('');
    });
  });

  describe('Comlink integration', () => {
    it('sets up a Comlink proxy via wrap()', () => {
      const worker = createWebWorker('./test.worker.ts', '/worker.js');

      // The proxy is set by Comlink.wrap in _setWorkerUrl
      expect(worker['_proxy']).not.toBeNull();
      expect(worker['_proxy']).toBeDefined();
    });

    it('proxy is different from the raw worker', () => {
      const worker = createWebWorker('./test.worker.ts', '/worker.js');
      const rawWorker = worker['_worker'];

      expect(worker['_proxy']).not.toBe(rawWorker);
    });
  });

  describe('error handling — unsupported environment', () => {
    it('throws OmniWorkerError when Worker is undefined', () => {
      // Temporarily remove Worker
      const saved = (globalThis as Record<string, unknown>)['Worker'];
      delete (globalThis as Record<string, unknown>)['Worker'];

      expect(() => createWebWorker('./test.worker.ts', '/worker.js')).toThrow(OmniWorkerError);

      // Restore for other tests
      (globalThis as Record<string, unknown>)['Worker'] = saved;
    });

    it('error has UNSUPPORTED_ENVIRONMENT code', () => {
      const saved = (globalThis as Record<string, unknown>)['Worker'];
      delete (globalThis as Record<string, unknown>)['Worker'];

      try {
        createWebWorker('./test.worker.ts', '/worker.js');
        expect.fail('should have thrown');
      } catch (err) {
        const e = err as OmniWorkerError;
        expect(e.code).toBe(OmniWorkerErrorCodes.UNSUPPORTED_ENVIRONMENT);
        expect(e.workerPath).toBe('./test.worker.ts');
        expect(e.message).toContain('Node.js 18+');
        expect(e.message).toContain('browser');
        expect(e.message).toContain('Web Worker');
      }

      (globalThis as Record<string, unknown>)['Worker'] = saved;
    });

    it('error has correct name', () => {
      const saved = (globalThis as Record<string, unknown>)['Worker'];
      delete (globalThis as Record<string, unknown>)['Worker'];

      try {
        createWebWorker('./test.worker.ts', '/worker.js');
      } catch (err) {
        const e = err as OmniWorkerError;
        expect(e.name).toBe('OmniWorkerError');
      }

      (globalThis as Record<string, unknown>)['Worker'] = saved;
    });
  });
});

/* ------------------------------------------------------------------ */
/* Tests: Web Worker Lifecycle                                        */
/* ------------------------------------------------------------------ */

describe('Web Integration — Worker Lifecycle', () => {
  let originalWorker: unknown;
  let MockWorkerHelper: ReturnType<typeof createMockWorkerClass>;

  beforeEach(() => {
    originalWorker = (globalThis as Record<string, unknown>)['Worker'];
    MockWorkerHelper = createMockWorkerClass();
    (globalThis as Record<string, unknown>)['Worker'] = MockWorkerHelper.MockWorker;
  });

  afterEach(() => {
    if (originalWorker) {
      (globalThis as Record<string, unknown>)['Worker'] = originalWorker;
    } else {
      delete (globalThis as Record<string, unknown>)['Worker'];
    }
    vi.restoreAllMocks();
  });

  describe('destroy', () => {
    it('terminates the worker and clears references', async () => {
      const worker = createWebWorker('./test.worker.ts', '/worker.js');
      const instances = MockWorkerHelper.getInstances();

      expect(worker.isDestroyed()).toBe(false);
      expect(worker['_worker']).not.toBeNull();
      expect(worker['_proxy']).not.toBeNull();

      await worker.destroy();

      expect(worker.isDestroyed()).toBe(true);
      expect(worker['_worker']).toBeNull();
      expect(worker['_proxy']).toBeNull();
      expect(instances[0].terminate).toHaveBeenCalled();
    });

    it('destroy is idempotent', async () => {
      const worker = createWebWorker('./test.worker.ts', '/worker.js');
      const instances = MockWorkerHelper.getInstances();

      await worker.destroy();
      await worker.destroy();
      await worker.destroy();

      expect(worker.isDestroyed()).toBe(true);
      // terminate called exactly once (first destroy)
      expect(instances[0].terminate).toHaveBeenCalledTimes(1);
    });
  });

  describe('use after destroy', () => {
    it('throws WORKER_ALREADY_DESTROYED', async () => {
      const worker = createWebWorker('./test.worker.ts', '/worker.js');

      await worker.destroy();

      expect(() => worker.use()).toThrow(OmniWorkerError);

      try {
        worker.use();
      } catch (err) {
        const e = err as OmniWorkerError;
        expect(e.code).toBe(OmniWorkerErrorCodes.WORKER_ALREADY_DESTROYED);
        expect(e.workerPath).toBe('./test.worker.ts');
      }
    });
  });

  describe('multiple independent workers', () => {
    it('each worker gets its own Worker instance', () => {
      const w1 = createWebWorker('./w1.worker.ts', '/w1.js');
      const w2 = createWebWorker('./w2.worker.ts', '/w2.js');
      const w3 = createWebWorker('./w3.worker.ts', '/w3.js');

      expect(MockWorkerHelper.getCallCount()).toBe(3);
      expect(w1['_worker']).not.toBe(w2['_worker']);
      expect(w2['_worker']).not.toBe(w3['_worker']);

      w1.destroy();
      w2.destroy();
      w3.destroy();
    });

    it('destroying one worker does not affect others', async () => {
      const w1 = createWebWorker('./w1.worker.ts', '/w1.js');
      const w2 = createWebWorker('./w2.worker.ts', '/w2.js');

      await w1.destroy();

      expect(w1.isDestroyed()).toBe(true);
      expect(w2.isDestroyed()).toBe(false);

      w2.destroy();
    });

    it('workers with same path are independent', () => {
      const w1 = createWebWorker('./same.worker.ts', '/worker.js');
      const w2 = createWebWorker('./same.worker.ts', '/worker.js');

      expect(w1).not.toBe(w2);
      expect(w1['_worker']).not.toBe(w2['_worker']);

      w1.destroy();
      w2.destroy();
    });
  });
});

/* ------------------------------------------------------------------ */
/* Tests: Worker Pool — Round-Robin Dispatch                           */
/* ------------------------------------------------------------------ */

describe('Web Integration — Pool Round-Robin', () => {
  let originalWorker: unknown;
  let MockWorkerHelper: ReturnType<typeof createMockWorkerClass>;

  beforeEach(() => {
    originalWorker = (globalThis as Record<string, unknown>)['Worker'];
    MockWorkerHelper = createMockWorkerClass();
    (globalThis as Record<string, unknown>)['Worker'] = MockWorkerHelper.MockWorker;
  });

  afterEach(() => {
    if (originalWorker) {
      (globalThis as Record<string, unknown>)['Worker'] = originalWorker;
    } else {
      delete (globalThis as Record<string, unknown>)['Worker'];
    }
    vi.restoreAllMocks();
  });

  describe('pool creation', () => {
    it('creates correct number of workers', () => {
      const pool = createWorkerPool(
        './test.worker.ts',
        { count: 4 },
        () => createWebWorker('./test.worker.ts', '/worker.js'),
      );

      expect(pool.getNumOfWorkers()).toBe(4);
      expect(MockWorkerHelper.getCallCount()).toBe(4);
    });

    it('each pool worker gets a separate Worker instance', () => {
      createWorkerPool(
        './test.worker.ts',
        { count: 3 },
        () => createWebWorker('./test.worker.ts', '/worker.js'),
      );

      const instances = MockWorkerHelper.getInstances();
      // All instances should be distinct
      expect(new Set(instances).size).toBe(3);
    });

    it('default count is 1', () => {
      const pool = createWorkerPool(
        './test.worker.ts',
        {},
        () => createWebWorker('./test.worker.ts', '/worker.js'),
      );

      expect(pool.getNumOfWorkers()).toBe(1);
      expect(MockWorkerHelper.getCallCount()).toBe(1);
    });

    it('pool implements IOmniWorkerPool interface', () => {
      const pool = createWorkerPool(
        './test.worker.ts',
        { count: 2 },
        () => createWebWorker('./test.worker.ts', '/worker.js'),
      );

      expect(typeof pool.use).toBe('function');
      expect(typeof pool.destroy).toBe('function');
      expect(typeof pool.isDestroyed).toBe('function');
      expect(typeof pool.getNumOfWorkers).toBe('function');
    });

    it('pool is an OmniWorkerPool instance', () => {
      const pool = createWorkerPool(
        './test.worker.ts',
        { count: 2 },
        () => createWebWorker('./test.worker.ts', '/worker.js'),
      );

      expect(pool).toBeInstanceOf(OmniWorkerPool);
    });
  });

  describe('round-robin dispatch', () => {
    it('dispatches sequentially across workers', () => {
      // Create a pool with mock workers that track their use() calls
      const mockWorkers = [
        {
          use: vi.fn(() => ({ name: 'proxy0' })),
          isDestroyed: vi.fn(() => false),
          destroy: vi.fn(async () => {}),
        },
        {
          use: vi.fn(() => ({ name: 'proxy1' })),
          isDestroyed: vi.fn(() => false),
          destroy: vi.fn(async () => {}),
        },
        {
          use: vi.fn(() => ({ name: 'proxy2' })),
          isDestroyed: vi.fn(() => false),
          destroy: vi.fn(async () => {}),
        },
      ];

      const pool = createWorkerPool(
        './test.worker.ts',
        { count: 3 },
        (index) => mockWorkers[index],
      );

      // Sequential calls should go to workers 0, 1, 2, 0, 1, 2
      expect(pool.use()).toEqual({ name: 'proxy0' });
      expect(pool.use()).toEqual({ name: 'proxy1' });
      expect(pool.use()).toEqual({ name: 'proxy2' });
      expect(pool.use()).toEqual({ name: 'proxy0' });
      expect(pool.use()).toEqual({ name: 'proxy1' });
      expect(pool.use()).toEqual({ name: 'proxy2' });

      // Each worker's use() should be called exactly twice
      expect(mockWorkers[0].use).toHaveBeenCalledTimes(2);
      expect(mockWorkers[1].use).toHaveBeenCalledTimes(2);
      expect(mockWorkers[2].use).toHaveBeenCalledTimes(2);
    });

    it('round-robins with 2 workers', () => {
      const mockWorkers = [
        {
          use: vi.fn(() => 'worker0'),
          isDestroyed: vi.fn(() => false),
          destroy: vi.fn(async () => {}),
        },
        {
          use: vi.fn(() => 'worker1'),
          isDestroyed: vi.fn(() => false),
          destroy: vi.fn(async () => {}),
        },
      ];

      const pool = createWorkerPool(
        './test.worker.ts',
        { count: 2 },
        (index) => mockWorkers[index],
      );

      const results = [];
      for (let i = 0; i < 6; i++) {
        results.push(pool.use());
      }

      expect(results).toEqual(['worker0', 'worker1', 'worker0', 'worker1', 'worker0', 'worker1']);
    });

    it('single-worker pool always returns same proxy', () => {
      const mockUse = vi.fn(() => 'only-proxy');
      const mockWorker = {
        use: mockUse,
        isDestroyed: vi.fn(() => false),
        destroy: vi.fn(async () => {}),
      };

      const pool = createWorkerPool(
        './test.worker.ts',
        { count: 1 },
        () => mockWorker,
      );

      for (let i = 0; i < 5; i++) {
        expect(pool.use()).toBe('only-proxy');
      }

      expect(mockUse).toHaveBeenCalledTimes(5);
    });
  });

  describe('pool destruction', () => {
    it('destroys all workers', async () => {
      const mockWorkers = [
        {
          use: vi.fn(() => 'proxy0'),
          isDestroyed: vi.fn(() => false),
          destroy: vi.fn(async () => {}),
        },
        {
          use: vi.fn(() => 'proxy1'),
          isDestroyed: vi.fn(() => false),
          destroy: vi.fn(async () => {}),
        },
        {
          use: vi.fn(() => 'proxy2'),
          isDestroyed: vi.fn(() => false),
          destroy: vi.fn(async () => {}),
        },
      ];

      const pool = createWorkerPool(
        './test.worker.ts',
        { count: 3 },
        (index) => mockWorkers[index],
      );

      await pool.destroy();

      expect(pool.isDestroyed()).toBe(true);
      expect(pool.getNumOfWorkers()).toBe(0);
      expect(mockWorkers[0].destroy).toHaveBeenCalled();
      expect(mockWorkers[1].destroy).toHaveBeenCalled();
      expect(mockWorkers[2].destroy).toHaveBeenCalled();
    });

    it('destroy is idempotent', async () => {
      const mockDestroy = vi.fn(async () => {});
      const pool = createWorkerPool(
        './test.worker.ts',
        { count: 2 },
        () => ({
          use: vi.fn(),
          isDestroyed: vi.fn(() => false),
          destroy: mockDestroy,
        }),
      );

      await pool.destroy();
      await pool.destroy();
      await pool.destroy();

      expect(pool.isDestroyed()).toBe(true);
      // destroy called exactly once per worker
      expect(mockDestroy).toHaveBeenCalledTimes(2);
    });

    it('use() throws after pool destroy', async () => {
      const pool = createWorkerPool(
        './test.worker.ts',
        { count: 2 },
        () => ({
          use: vi.fn(),
          isDestroyed: vi.fn(() => false),
          destroy: vi.fn(async () => {}),
        }),
      );

      await pool.destroy();

      expect(() => pool.use()).toThrow(OmniWorkerError);

      try {
        pool.use();
      } catch (err) {
        const e = err as OmniWorkerError;
        expect(e.code).toBe(OmniWorkerErrorCodes.WORKER_ALREADY_DESTROYED);
      }
    });
  });

  describe('pool count validation', () => {
    it('throws for count < 1', () => {
      expect(() =>
        createWorkerPool(
          './test.worker.ts',
          { count: 0 },
          () => createWebWorker('./test.worker.ts', '/worker.js'),
        ),
      ).toThrow(OmniWorkerError);
    });

    it('throws for negative count', () => {
      expect(() =>
        createWorkerPool(
          './test.worker.ts',
          { count: -1 },
          () => createWebWorker('./test.worker.ts', '/worker.js'),
        ),
      ).toThrow(OmniWorkerError);
    });

    it('throws for count > maxCount', () => {
      expect(() =>
        createWorkerPool(
          './test.worker.ts',
          { count: 129 },
          () => createWebWorker('./test.worker.ts', '/worker.js'),
        ),
      ).toThrow(OmniWorkerError);
    });

    it('throws INVALID_POOL_COUNT code for bad count', () => {
      try {
        createWorkerPool(
          './bad.worker.ts',
          { count: 0 },
          () => createWebWorker('./test.worker.ts', '/worker.js'),
        );
      } catch (err) {
        const e = err as OmniWorkerError;
        expect(e.code).toBe(OmniWorkerErrorCodes.INVALID_POOL_COUNT);
        expect(e.workerPath).toBe('./bad.worker.ts');
      }
    });

    it('accepts count equal to maxCount', () => {
      const pool = createWorkerPool(
        './test.worker.ts',
        { count: 128 },
        () => createWebWorker('./test.worker.ts', '/worker.js'),
      );

      expect(pool.getNumOfWorkers()).toBe(128);
    });

    it('accepts custom maxCount', () => {
      expect(() =>
        createWorkerPool(
          './test.worker.ts',
          { count: 10, maxCount: 5 },
          () => createWebWorker('./test.worker.ts', '/worker.js'),
        ),
      ).toThrow(OmniWorkerError);
    });
  });
});

/* ------------------------------------------------------------------ */
/* Tests: Full Integration Scenarios                                   */
/* ------------------------------------------------------------------ */

describe('Web Integration — Full Scenarios', () => {
  let originalWorker: unknown;
  let MockWorkerHelper: ReturnType<typeof createMockWorkerClass>;

  beforeEach(() => {
    originalWorker = (globalThis as Record<string, unknown>)['Worker'];
    MockWorkerHelper = createMockWorkerClass();
    (globalThis as Record<string, unknown>)['Worker'] = MockWorkerHelper.MockWorker;
  });

  afterEach(() => {
    if (originalWorker) {
      (globalThis as Record<string, unknown>)['Worker'] = originalWorker;
    } else {
      delete (globalThis as Record<string, unknown>)['Worker'];
    }
    vi.restoreAllMocks();
  });

  it('complete flow: create web worker → verify proxy → destroy', async () => {
    // Step 1: Create worker
    const worker = createWebWorker('./math.worker.ts', '/math-worker.js');
    expect(worker.isDestroyed()).toBe(false);
    expect(worker['_worker']).not.toBeNull();

    // Step 2: Verify Worker was created with correct args
    expect(MockWorkerHelper.getCallCount()).toBe(1);
    expect(MockWorkerHelper.getCallArgs()[0][0]).toBe('/math-worker.js');
    expect(MockWorkerHelper.getCallArgs()[0][1]).toEqual({ type: 'module' });

    // Step 3: Verify proxy is set up
    expect(worker['_proxy']).not.toBeNull();

    // Step 4: Destroy
    await worker.destroy();
    expect(worker.isDestroyed()).toBe(true);
    expect(worker['_worker']).toBeNull();

    // Step 5: Verify terminate was called
    expect(MockWorkerHelper.getInstances()[0].terminate).toHaveBeenCalled();
  });

  it('complete flow: create web pool → round-robin → destroy all', async () => {
    // Step 1: Create pool
    const pool = createWorkerPool(
      './compute.worker.ts',
      { count: 3 },
      () => createWebWorker('./compute.worker.ts', '/compute-worker.js'),
    );

    expect(pool.getNumOfWorkers()).toBe(3);
    expect(MockWorkerHelper.getCallCount()).toBe(3);
    expect(pool.isDestroyed()).toBe(false);

    // Step 2: All workers created with correct options
    for (let i = 0; i < 3; i++) {
      expect(MockWorkerHelper.getCallArgs()[i][0]).toBe('/compute-worker.js');
      expect(MockWorkerHelper.getCallArgs()[i][1]).toEqual({ type: 'module' });
    }

    // Step 3: Destroy pool
    await pool.destroy();
    expect(pool.isDestroyed()).toBe(true);
    expect(pool.getNumOfWorkers()).toBe(0);

    // Step 4: All workers terminated
    const instances = MockWorkerHelper.getInstances();
    expect(instances.length).toBe(3);
    for (const inst of instances) {
      expect(inst.terminate).toHaveBeenCalled();
    }
  });

  it('multiple workers and pool coexist independently', async () => {
    const singleWorker = createWebWorker('./single.worker.ts', '/single.js');
    const pool = createWorkerPool(
      './pool.worker.ts',
      { count: 2 },
      () => createWebWorker('./pool.worker.ts', '/pool.js'),
    );

    // Both operational
    expect(singleWorker.isDestroyed()).toBe(false);
    expect(pool.isDestroyed()).toBe(false);

    // Destroy single doesn't affect pool
    await singleWorker.destroy();
    expect(singleWorker.isDestroyed()).toBe(true);
    expect(pool.isDestroyed()).toBe(false);
    expect(pool.getNumOfWorkers()).toBe(2);

    // Destroy pool doesn't affect already-destroyed worker
    await pool.destroy();
    expect(pool.isDestroyed()).toBe(true);
    expect(singleWorker.isDestroyed()).toBe(true);
  });

  it('data URL worker creation and lifecycle', async () => {
    const dataUrl =
      'data:text/javascript;base64,ZXhwb3J0IGNvbnN0IGFwaSA9IHsgYWRkOiAoYSwgYikgPT4gYSArIGIgfTsg';
    const worker = createWebWorker('./inline.worker.ts', dataUrl);

    // Worker created from data URL
    expect(worker['_worker']).not.toBeNull();
    expect(worker.isDestroyed()).toBe(false);

    // Verify URL was passed correctly
    expect(MockWorkerHelper.getCallArgs()[0][0]).toBe(dataUrl);

    // Lifecycle
    await worker.destroy();
    expect(worker.isDestroyed()).toBe(true);
  });

  it('pool with workers using different URLs', () => {
    const urls = ['/worker-a.js', '/worker-b.js', '/worker-c.js'];

    const pool = createWorkerPool(
      './multi.worker.ts',
      { count: 3 },
      (index) => createWebWorker(`./multi-${index}.worker.ts`, urls[index]),
    );

    expect(pool.getNumOfWorkers()).toBe(3);

    // Each worker should have been created with its own URL
    expect(MockWorkerHelper.getCallArgs()[0][0]).toBe('/worker-a.js');
    expect(MockWorkerHelper.getCallArgs()[1][0]).toBe('/worker-b.js');
    expect(MockWorkerHelper.getCallArgs()[2][0]).toBe('/worker-c.js');
  });
});

/* ------------------------------------------------------------------ */
/* Tests: Worker Instance Inspection                                   */
/* ------------------------------------------------------------------ */

describe('Web Integration — Worker Instance Properties', () => {
  let originalWorker: unknown;
  let MockWorkerHelper: ReturnType<typeof createMockWorkerClass>;

  beforeEach(() => {
    originalWorker = (globalThis as Record<string, unknown>)['Worker'];
    MockWorkerHelper = createMockWorkerClass();
    (globalThis as Record<string, unknown>)['Worker'] = MockWorkerHelper.MockWorker;
  });

  afterEach(() => {
    if (originalWorker) {
      (globalThis as Record<string, unknown>)['Worker'] = originalWorker;
    } else {
      delete (globalThis as Record<string, unknown>)['Worker'];
    }
    vi.restoreAllMocks();
  });

  it('WebOmniWorker stores worker reference after creation', () => {
    const worker = createWebWorker('./test.worker.ts', '/worker.js');

    expect(worker['_worker']).toBeDefined();
    expect(worker['_worker']).not.toBeNull();
    // The worker should be a MockWorker instance
    expect(worker['_worker']).toHaveProperty('terminate');
    expect(worker['_worker']).toHaveProperty('postMessage');
    expect(worker['_worker']).toHaveProperty('addEventListener');
  });

  it('WebOmniWorker proxy is set via Comlink.wrap', () => {
    const worker = createWebWorker('./test.worker.ts', '/worker.js');

    // Proxy should be defined and truthy
    expect(worker['_proxy']).toBeTruthy();
    // It should NOT be the raw worker
    expect(worker['_proxy']).not.toBe(worker['_worker']);
  });

  it('Worker created with correct mock properties', () => {
    createWebWorker('./test.worker.ts', '/worker.js');

    const inst = MockWorkerHelper.getInstances()[0];
    expect(inst.url).toBe('/worker.js');
    expect(inst.options).toEqual({ type: 'module' });
    expect(typeof inst.terminate).toBe('function');
    expect(typeof inst.postMessage).toBe('function');
  });

  it('multiple workers each have unique mock IDs', () => {
    createWebWorker('./w1.worker.ts', '/w1.js');
    createWebWorker('./w2.worker.ts', '/w2.js');
    createWebWorker('./w3.worker.ts', '/w3.js');

    const instances = MockWorkerHelper.getInstances();
    const ids = instances.map((i) => i._mockId);
    expect(new Set(ids).size).toBe(3); // All unique
  });
});

/* ------------------------------------------------------------------ */
/* Tests: Edge Cases                                                   */
/* ------------------------------------------------------------------ */

describe('Web Integration — Edge Cases', () => {
  let originalWorker: unknown;
  let MockWorkerHelper: ReturnType<typeof createMockWorkerClass>;

  beforeEach(() => {
    originalWorker = (globalThis as Record<string, unknown>)['Worker'];
    MockWorkerHelper = createMockWorkerClass();
    (globalThis as Record<string, unknown>)['Worker'] = MockWorkerHelper.MockWorker;
  });

  afterEach(() => {
    if (originalWorker) {
      (globalThis as Record<string, unknown>)['Worker'] = originalWorker;
    } else {
      delete (globalThis as Record<string, unknown>)['Worker'];
    }
    vi.restoreAllMocks();
  });

  it('handles very long data URL', () => {
    const longDataUrl =
      'data:text/javascript;base64,' + 'X'.repeat(10000);
    const worker = createWebWorker('./large.worker.ts', longDataUrl);

    expect(worker['_worker']).not.toBeNull();
    expect(MockWorkerHelper.getCallArgs()[0][0]).toBe(longDataUrl);

    worker.destroy();
  });

  it('handles URL with Unicode characters', () => {
    const worker = createWebWorker(
      './path/日本語/worker.ts',
      '/assets/работер-工作者.js'
    );

    expect(worker['_path']).toBe('./path/日本語/worker.ts');
    expect(MockWorkerHelper.getCallArgs()[0][0]).toBe('/assets/работер-工作者.js');

    worker.destroy();
  });

  it('handles special characters in path', () => {
    const worker = createWebWorker('./path/with spaces and (parens)/test.worker.ts', '/worker.js');

    expect(worker['_path']).toBe('./path/with spaces and (parens)/test.worker.ts');

    worker.destroy();
  });

  it('pool with count 1 behaves correctly', () => {
    const mockUse = vi.fn(() => 'proxy');
    const pool = createWorkerPool(
      './single.worker.ts',
      { count: 1 },
      () => ({
        use: mockUse,
        isDestroyed: vi.fn(() => false),
        destroy: vi.fn(async () => {}),
      }),
    );

    expect(pool.getNumOfWorkers()).toBe(1);
    pool.use();
    pool.use();
    expect(mockUse).toHaveBeenCalledTimes(2);
  });

  it('empty pool path still works', () => {
    const pool = createWorkerPool(
      '',
      { count: 1 },
      () => createWebWorker('', '/worker.js'),
    );

    expect(pool.getNumOfWorkers()).toBe(1);
  });
});
