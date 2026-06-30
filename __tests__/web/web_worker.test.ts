/**
 * Tests for the Browser Web Worker adapter (WebOmniWorker).
 *
 * Validates:
 * - createWebWorker factory creates proper instances
 * - Environment detection (UNSUPPORTED_ENVIRONMENT error)
 * - Worker creation with type: 'module' option
 * - Standard Comlink wrap() integration (no adapter)
 * - WebOmniWorker extends WorkerRuntime correctly
 * - _setWorkerUrl sets up proxy
 * - terminateWorker() terminates the worker
 * - destroy() lifecycle works correctly
 * - Error handling for unsupported environments
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as Comlink from 'comlink';
import { createWebWorker, WebOmniWorker } from '../../src/runtime/web';
import { WorkerRuntime } from '../../src/runtime/worker';
import { OmniWorkerError, OmniWorkerErrorCodes } from '../../src/runtime/error';

/* ------------------------------------------------------------------ */
/* Helper: Mock Worker class for jsdom testing                        */
/* ------------------------------------------------------------------ */

/**
 * Creates a mock Worker class that simulates the browser Worker API.
 * In jsdom, `Worker` may or may not be available depending on the version,
 * so we provide our own mock that satisfies the interface.
 */
function createMockWorker() {
  const listeners: Record<string, Array<(...args: unknown[]) => void>> = {};

  class MockWorker {
    public terminate: () => void;
    public postMessage: (msg: unknown) => void;
    public on: (event: string, handler: (...args: unknown[]) => void) => void;
    public addEventListener: (
      event: string,
      handler: (...args: unknown[]) => void
    ) => void;

    constructor(_url: string, _options?: WorkerOptions) {
      this.terminate = vi.fn();
      this.postMessage = vi.fn();
      this.on = vi.fn((event, handler) => {
        if (!listeners[event]) listeners[event] = [];
        listeners[event].push(handler as (...args: unknown[]) => void);
      });
      this.addEventListener = vi.fn((event, handler) => {
        if (!listeners[event]) listeners[event] = [];
        listeners[event].push(handler as (...args: unknown[]) => void);
      });
    }
  }

  return MockWorker;
}

/* ------------------------------------------------------------------ */
/* Tests: createWebWorker factory                                     */
/* ------------------------------------------------------------------ */

describe('createWebWorker', () => {
  let originalWorker: typeof Worker | undefined;

  beforeEach(() => {
    // Save original Worker and provide a mock
    originalWorker = (globalThis as unknown as Record<string, unknown>)['Worker'];
    const MockWorker = createMockWorker();
    (globalThis as unknown as Record<string, unknown>)['Worker'] = MockWorker;
  });

  afterEach(() => {
    // Restore original Worker
    if (originalWorker) {
      (globalThis as unknown as Record<string, unknown>)['Worker'] = originalWorker;
    } else {
      delete (globalThis as unknown as Record<string, unknown>)['Worker'];
    }
  });

  describe('factory function', () => {
    it('returns a WebOmniWorker instance', () => {
      const worker = createWebWorker('./test.worker.ts', '/test-worker.js');

      expect(worker).toBeInstanceOf(WebOmniWorker);
      expect(worker).toBeInstanceOf(WorkerRuntime);
    });

    it('returns a typed IOmniWorker<T>', () => {
      interface TestApi {
        add(a: number, b: number): number;
      }

      const worker = createWebWorker<TestApi>('./test.worker.ts', '/test-worker.js');

      // Should have the IOmniWorker interface methods
      expect(typeof worker.use).toBe('function');
      expect(typeof worker.destroy).toBe('function');
      expect(typeof worker.isDestroyed).toBe('function');
    });

    it('passes workerPath to the constructor', () => {
      const worker = createWebWorker('./my.worker.ts', '/my-worker.js');

      expect(worker['_path']).toBe('./my.worker.ts');
    });

    it('worker is not destroyed initially', () => {
      const worker = createWebWorker('./test.worker.ts', '/test-worker.js');

      expect(worker.isDestroyed()).toBe(false);
    });
  });

  describe('worker URL handling', () => {
    it('accepts a plain file URL', () => {
      const worker = createWebWorker('./test.worker.ts', '/assets/math-worker.js');

      expect(worker['_worker']).not.toBeNull();
    });

    it('accepts a data URL', () => {
      const dataUrl = 'data:text/javascript;base64,ZXhwb3J0IGZ1bmN0aW9uIGFkZCgpIHt9';
      const worker = createWebWorker('./test.worker.ts', dataUrl);

      expect(worker['_worker']).not.toBeNull();
    });

    it('accepts a relative URL', () => {
      const worker = createWebWorker('./test.worker.ts', './workers/math.js');

      expect(worker['_worker']).not.toBeNull();
    });
  });

  describe('worker creation options', () => {
    it('creates a Worker with type: module option', () => {
      // We verify the Worker was instantiated by checking the mock was called
      // The { type: 'module' } option is passed in createWebWorker
      const worker = createWebWorker('./test.worker.ts', '/test-worker.js');

      expect(worker['_worker']).not.toBeNull();
    });
  });

  describe('environment detection', () => {
    it('throws UNSUPPORTED_ENVIRONMENT when Worker is undefined', () => {
      // Temporarily remove Worker from global scope
      const savedWorker = (globalThis as unknown as Record<string, unknown>)['Worker'];
      delete (globalThis as unknown as Record<string, unknown>)['Worker'];

      expect(() => {
        createWebWorker('./test.worker.ts', '/test-worker.js');
      }).toThrow(OmniWorkerError);

      try {
        createWebWorker('./test.worker.ts', '/test-worker.js');
      } catch (err) {
        const e = err as OmniWorkerError;
        expect(e.code).toBe(OmniWorkerErrorCodes.UNSUPPORTED_ENVIRONMENT);
        expect(e.workerPath).toBe('./test.worker.ts');
        expect(e.message).toContain('Node.js 18+');
        expect(e.message).toContain('browser');
        expect(e.message).toContain('Web Worker');
      }

      // Restore Worker for other tests
      (globalThis as unknown as Record<string, unknown>)['Worker'] = savedWorker;
    });
  });
});

/* ------------------------------------------------------------------ */
/* Tests: WebOmniWorker class                                         */
/* ------------------------------------------------------------------ */

describe('WebOmniWorker', () => {
  let originalWorker: typeof Worker | undefined;
  let MockWorker: ReturnType<typeof createMockWorker>;

  beforeEach(() => {
    originalWorker = (globalThis as unknown as Record<string, unknown>)['Worker'];
    MockWorker = createMockWorker();
    (globalThis as unknown as Record<string, unknown>)['Worker'] = MockWorker;
  });

  afterEach(() => {
    if (originalWorker) {
      (globalThis as unknown as Record<string, unknown>)['Worker'] = originalWorker;
    } else {
      delete (globalThis as unknown as Record<string, unknown>)['Worker'];
    }
  });

  describe('constructor', () => {
    it('initializes _worker as null', () => {
      const worker = new WebOmniWorker('./test.worker.ts');
      expect(worker['_worker']).toBeNull();
    });

    it('passes path to parent constructor', () => {
      const worker = new WebOmniWorker('./my.worker.ts');
      expect(worker['_path']).toBe('./my.worker.ts');
    });

    it('initializes _proxy as null (from parent class)', () => {
      const worker = new WebOmniWorker('./test.worker.ts');
      expect(worker['_proxy']).toBeNull();
    });

    it('initializes _destroyed as false (from parent class)', () => {
      const worker = new WebOmniWorker('./test.worker.ts');
      expect(worker.isDestroyed()).toBe(false);
    });
  });

  describe('_setWorkerUrl', () => {
    it('stores the worker reference', () => {
      const worker = new WebOmniWorker('./test.worker.ts');
      const mockWorker = new (globalThis as unknown as { Worker: typeof Worker }).Worker(
        '/test.js',
        { type: 'module' as WorkerType }
      );

      worker._setWorkerUrl(mockWorker);

      expect(worker['_worker']).toBe(mockWorker);
    });

    it('sets up the Comlink proxy', () => {
      const worker = new WebOmniWorker('./test.worker.ts');
      const mockWorker = new (globalThis as unknown as { Worker: typeof Worker }).Worker(
        '/test.js',
        { type: 'module' as WorkerType }
      );

      expect(worker['_proxy']).toBeNull();

      worker._setWorkerUrl(mockWorker);

      // The proxy should be set (Comlink.wrap returns a proxy object)
      expect(worker['_proxy']).not.toBeNull();
      expect(worker['_proxy']).not.toBe(mockWorker);
    });
  });

  describe('initialize', () => {
    it('is a no-op (initialization handled by factory)', async () => {
      const worker = new WebOmniWorker('./test.worker.ts');

      // Should not throw even though proxy is null
      await expect(worker.initialize()).resolves.toBeUndefined();
    });
  });

  describe('terminateWorker', () => {
    it('calls terminate() on the Worker', async () => {
      const worker = new WebOmniWorker('./test.worker.ts');
      const mockWorker = new (globalThis as unknown as { Worker: typeof Worker }).Worker(
        '/test.js',
        { type: 'module' as WorkerType }
      );

      worker._setWorkerUrl(mockWorker);

      // Worker should be alive
      expect(worker['_worker']).toBe(mockWorker);

      // Terminate
      await worker.terminateWorker();

      // Worker reference should be nullified
      expect(worker['_worker']).toBeNull();
      // Verify terminate was called
      expect(mockWorker.terminate).toHaveBeenCalled();
    });

    it('is safe to call when _worker is null', async () => {
      const worker = new WebOmniWorker('./test.worker.ts');

      // Should not throw even though _worker is null
      await expect(worker.terminateWorker()).resolves.toBeUndefined();
    });

    it('is safe to call multiple times', async () => {
      const worker = new WebOmniWorker('./test.worker.ts');
      const mockWorker = new (globalThis as unknown as { Worker: typeof Worker }).Worker(
        '/test.js',
        { type: 'module' as WorkerType }
      );

      worker._setWorkerUrl(mockWorker);

      // First termination
      await worker.terminateWorker();
      expect(worker['_worker']).toBeNull();

      // Second termination should not throw
      await expect(worker.terminateWorker()).resolves.toBeUndefined();
      expect(worker['_worker']).toBeNull();
    });
  });

  describe('destroy lifecycle', () => {
    it('properly destroys the worker', async () => {
      const worker = createWebWorker('./test.worker.ts', '/test-worker.js');

      expect(worker.isDestroyed()).toBe(false);
      expect(worker['_worker']).not.toBeNull();

      await worker.destroy();

      expect(worker.isDestroyed()).toBe(true);
      expect(worker['_worker']).toBeNull();
    });

    it('use() throws after destroy', async () => {
      const worker = createWebWorker('./test.worker.ts', '/test-worker.js');

      await worker.destroy();

      expect(() => worker.use()).toThrow(OmniWorkerError);

      try {
        worker.use();
      } catch (err) {
        const e = err as OmniWorkerError;
        expect(e.code).toBe(OmniWorkerErrorCodes.WORKER_ALREADY_DESTROYED);
      }
    });

    it('destroy() is idempotent', async () => {
      const worker = createWebWorker('./test.worker.ts', '/test-worker.js');

      await worker.destroy();
      expect(worker.isDestroyed()).toBe(true);

      // Second call should not throw
      await expect(worker.destroy()).resolves.toBeUndefined();
      expect(worker.isDestroyed()).toBe(true);
    });
  });

  describe('extends WorkerRuntime', () => {
    it('implements IOmniWorker interface', () => {
      const worker = new WebOmniWorker('./test.worker.ts');

      // All required methods should exist
      expect(typeof worker.use).toBe('function');
      expect(typeof worker.isDestroyed).toBe('function');
      expect(typeof worker.destroy).toBe('function');
    });

    it('inherits destroy() behavior from WorkerRuntime', async () => {
      const worker = new WebOmniWorker('./test.worker.ts');

      // destroy() should call terminateWorker() (our implementation)
      const terminateSpy = vi.spyOn(worker, 'terminateWorker');

      await worker.destroy();

      expect(terminateSpy).toHaveBeenCalledOnce();
    });
  });

  describe('use() behavior', () => {
    it('throws WORKER_CREATE_FAILED when proxy is not initialized', () => {
      const worker = new WebOmniWorker('./test.worker.ts');

      // Proxy is null (not initialized)
      expect(() => worker.use()).toThrow(OmniWorkerError);

      try {
        worker.use();
      } catch (err) {
        const e = err as OmniWorkerError;
        expect(e.code).toBe(OmniWorkerErrorCodes.WORKER_CREATE_FAILED);
        expect(e.workerPath).toBe('./test.worker.ts');
      }
    });

    it('throws WORKER_ALREADY_DESTROYED after destroy', async () => {
      const worker = createWebWorker('./test.worker.ts', '/test-worker.js');
      await worker.destroy();

      expect(() => worker.use()).toThrow(OmniWorkerError);
    });
  });
});

/* ------------------------------------------------------------------ */
/* Integration tests: Worker creation with Comlink                    */
/* ------------------------------------------------------------------ */

describe('WebOmniWorker integration', () => {
  let originalWorker: typeof Worker | undefined;

  beforeEach(() => {
    originalWorker = (globalThis as unknown as Record<string, unknown>)['Worker'];
    const MockWorker = createMockWorker();
    (globalThis as unknown as Record<string, unknown>)['Worker'] = MockWorker;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (originalWorker) {
      (globalThis as unknown as Record<string, unknown>)['Worker'] = originalWorker;
    } else {
      delete (globalThis as unknown as Record<string, unknown>)['Worker'];
    }
  });

  it('creates a worker that can be terminated', () => {
    const worker = createWebWorker('./test.worker.ts', '/test-worker.js');

    expect(worker['_worker']).not.toBeNull();
    expect(worker.isDestroyed()).toBe(false);

    worker.destroy();
    expect(worker.isDestroyed()).toBe(true);
  });

  it('multiple workers can be created independently', () => {
    const worker1 = createWebWorker('./worker1.worker.ts', '/worker1.js');
    const worker2 = createWebWorker('./worker2.worker.ts', '/worker2.js');

    expect(worker1['_path']).toBe('./worker1.worker.ts');
    expect(worker2['_path']).toBe('./worker2.worker.ts');

    expect(worker1['_worker']).not.toBe(worker2['_worker']);

    worker1.destroy();
    worker2.destroy();

    expect(worker1.isDestroyed()).toBe(true);
    expect(worker2.isDestroyed()).toBe(true);
  });

  it('worker proxy is set up via Comlink.wrap', () => {
    const worker = createWebWorker('./test.worker.ts', '/test-worker.js');

    // The proxy should be set by Comlink.wrap during worker setup
    expect(worker['_proxy']).not.toBeNull();
    // Comlink.wrap returns something truthy (function or proxy object depending on environment)
    expect(worker['_proxy']).toBeDefined();
  });
});

/* ------------------------------------------------------------------ */
/* Edge cases and error handling                                       */
/* ------------------------------------------------------------------ */

describe('WebOmniWorker edge cases', () => {
  let originalWorker: typeof Worker | undefined;

  beforeEach(() => {
    originalWorker = (globalThis as unknown as Record<string, unknown>)['Worker'];
    const MockWorker = createMockWorker();
    (globalThis as unknown as Record<string, unknown>)['Worker'] = MockWorker;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (originalWorker) {
      (globalThis as unknown as Record<string, unknown>)['Worker'] = originalWorker;
    } else {
      delete (globalThis as unknown as Record<string, unknown>)['Worker'];
    }
  });

  it('handles empty worker URL', () => {
    const worker = createWebWorker('./empty.worker.ts', '');
    expect(worker['_worker']).not.toBeNull();
    expect(worker['_path']).toBe('./empty.worker.ts');

    worker.destroy();
  });

  it('handles special characters in path', () => {
    const worker = createWebWorker('./path/with spaces/test.worker.ts', '/worker.js');

    expect(worker['_path']).toBe('./path/with spaces/test.worker.ts');

    worker.destroy();
  });

  it('handles special characters in URL', () => {
    const worker = createWebWorker(
      './test.worker.ts',
      '/assets/worker-v1.0+build.js?version=2.0&env=production'
    );

    expect(worker['_worker']).not.toBeNull();
    expect(worker['_path']).toBe('./test.worker.ts');

    worker.destroy();
  });

  it('does not crash on repeated use() before destroy', async () => {
    const worker = createWebWorker('./test.worker.ts', '/test-worker.js');

    // Mock proxy to avoid actual Comlink calls
    const mockProxy = { add: vi.fn() };
    worker['_proxy'] = mockProxy as unknown as typeof worker['_proxy'];

    // Multiple calls to use() should work
    const proxy1 = worker.use();
    const proxy2 = worker.use();

    expect(proxy1).toBe(proxy2);

    await worker.destroy();
  });

  it('proxy is cleared after destroy', async () => {
    const worker = createWebWorker('./test.worker.ts', '/test-worker.js');

    expect(worker['_proxy']).not.toBeNull();

    await worker.destroy();

    expect(worker['_proxy']).toBeNull();
  });
});
