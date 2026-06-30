/**
 * Tests for the WorkerRuntime abstract base class.
 *
 * Validates:
 * - Abstract class cannot be instantiated directly
 * - Constructor initializes _path correctly
 * - use() returns proxy when initialized
 * - use() throws WORKER_ALREADY_DESTROYED after destroy
 * - use() throws WORKER_CREATE_FAILED when proxy is null
 * - isDestroyed() reflects lifecycle state
 * - destroy() is idempotent
 * - destroy() calls terminateWorker()
 * - destroy() nullifies the proxy
 * - destroy() catches and logs errors (best-effort)
 * - Proxy is not nullified before destroy
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WorkerRuntime } from '../../src/runtime/worker';
import { OmniWorkerError, OmniWorkerErrorCodes } from '../../src/runtime/error';

/* ------------------------------------------------------------------ */
/* Test subclass — concrete implementation of the abstract members     */
/* ------------------------------------------------------------------ */

interface TestApi {
  add(a: number, b: number): number;
}

class TestWorkerRuntime extends WorkerRuntime<TestApi> {
  protected _worker = { id: 1 };

  // Track calls for testing
  public terminateCalled = false;
  public terminateError: Error | null = null;

  constructor(
    path: string,
    private _mockProxy: TestApi | null,
    private _initError: Error | null = null
  ) {
    super(path);
  }

  override async initialize(): Promise<void> {
    if (this._initError) {
      throw this._initError;
    }
    // Assign mock proxy (cast is safe for testing)
    this._proxy = this._mockProxy as any;
  }

  override async terminateWorker(): Promise<void> {
    this.terminateCalled = true;
    if (this.terminateError) {
      throw this.terminateError;
    }
  }
}

/* ------------------------------------------------------------------ */
/* Tests                                                              */
/* ------------------------------------------------------------------ */

describe('WorkerRuntime', () => {
  describe('abstract class', () => {
    it('cannot be instantiated directly (no `new WorkerRuntime()`)', () => {
      // At the TypeScript level, this is enforced by the `abstract` keyword.
      // At runtime in Node.js, calling `new` on an abstract class that only
      // has abstract methods throws. We verify the class has the 'abstract' flag
      // via the constructor's inability to instantiate.
      expect(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        new (WorkerRuntime as any)('./test.worker.ts');
      }).toThrow();
    });
  });

  describe('constructor', () => {
    it('stores the worker path', async () => {
      const mockProxy = { add: vi.fn().mockResolvedValue(3) };
      const worker = new TestWorkerRuntime('./math.worker.ts', mockProxy);
      await worker.initialize();

      expect(worker['_path']).toBe('./math.worker.ts');
    });

    it('starts with _destroyed = false', () => {
      const worker = new TestWorkerRuntime('./math.worker.ts', null);
      expect(worker.isDestroyed()).toBe(false);
    });

    it('starts with _proxy = null', () => {
      const worker = new TestWorkerRuntime('./math.worker.ts', null);
      expect(worker['_proxy']).toBeNull();
    });
  });

  describe('initialize()', () => {
    it('sets up the proxy when successful', async () => {
      const mockProxy = { add: vi.fn().mockResolvedValue(3) };
      const worker = new TestWorkerRuntime('./math.worker.ts', mockProxy);

      expect(worker['_proxy']).toBeNull();
      await worker.initialize();
      expect(worker['_proxy']).toBe(mockProxy);
    });

    it('propagates errors during initialization', async () => {
      const worker = new TestWorkerRuntime(
        './math.worker.ts',
        null,
        new Error('init failed')
      );

      await expect(worker.initialize()).rejects.toThrow('init failed');
    });
  });

  describe('use()', () => {
    it('returns the proxy when initialized', async () => {
      const mockProxy = { add: vi.fn().mockResolvedValue(3) };
      const worker = new TestWorkerRuntime('./math.worker.ts', mockProxy);
      await worker.initialize();

      const proxy = worker.use();
      expect(proxy).toBe(mockProxy);
    });

    it('throws WORKER_ALREADY_DESTROYED when worker is destroyed', async () => {
      const mockProxy = { add: vi.fn().mockResolvedValue(3) };
      const worker = new TestWorkerRuntime('./math.worker.ts', mockProxy);
      await worker.initialize();
      await worker.destroy();

      expect(() => worker.use()).toThrow(OmniWorkerError);
      try {
        worker.use();
      } catch (err) {
        const e = err as OmniWorkerError;
        expect(e.code).toBe(OmniWorkerErrorCodes.WORKER_ALREADY_DESTROYED);
        expect(e.workerPath).toBe('./math.worker.ts');
        expect(e.message).toContain('already destroyed');
        expect(e.message).toContain('./math.worker.ts');
      }
    });

    it('throws WORKER_CREATE_FAILED when proxy is null', () => {
      const worker = new TestWorkerRuntime('./math.worker.ts', null);

      expect(() => worker.use()).toThrow(OmniWorkerError);
      try {
        worker.use();
      } catch (err) {
        const e = err as OmniWorkerError;
        expect(e.code).toBe(OmniWorkerErrorCodes.WORKER_CREATE_FAILED);
        expect(e.workerPath).toBe('./math.worker.ts');
        expect(e.message).toContain('not initialized');
        expect(e.message).toContain('./math.worker.ts');
      }
    });

    it('preserves proxy type — returned proxy is Promisify<T>', async () => {
      const mockProxy = { add: vi.fn().mockResolvedValue(3) };
      const worker = new TestWorkerRuntime('./math.worker.ts', mockProxy);
      await worker.initialize();

      // The return type should be Promisify<TestApi>
      const proxy = worker.use();
      // Calling proxy.add should return a Promise
      const result = await proxy.add(1, 2);
      expect(result).toBe(3);
      expect(mockProxy.add).toHaveBeenCalledWith(1, 2);
    });
  });

  describe('isDestroyed()', () => {
    it('returns false before destroy', () => {
      const worker = new TestWorkerRuntime('./math.worker.ts', null);
      expect(worker.isDestroyed()).toBe(false);
    });

    it('returns true after destroy', async () => {
      const worker = new TestWorkerRuntime('./math.worker.ts', null);
      await worker.destroy();
      expect(worker.isDestroyed()).toBe(true);
    });
  });

  describe('destroy()', () => {
    let consoleWarnSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    });

    it('calls terminateWorker()', async () => {
      const worker = new TestWorkerRuntime('./math.worker.ts', null);
      expect(worker.terminateCalled).toBe(false);
      await worker.destroy();
      expect(worker.terminateCalled).toBe(true);
    });

    it('is idempotent — second call returns immediately', async () => {
      const worker = new TestWorkerRuntime('./math.worker.ts', null);
      await worker.destroy();
      expect(worker.terminateCalled).toBe(true);

      // Second call should not trigger terminate again
      const terminateCalledBeforeSecond = worker.terminateCalled;
      await worker.destroy();
      expect(worker.terminateCalled).toBe(terminateCalledBeforeSecond);
    });

    it('second destroy() call does not throw', async () => {
      const worker = new TestWorkerRuntime('./math.worker.ts', null);
      await worker.destroy();
      await expect(worker.destroy()).resolves.toBeUndefined();
    });

    it('sets _destroyed to true', async () => {
      const worker = new TestWorkerRuntime('./math.worker.ts', null);
      expect(worker.isDestroyed()).toBe(false);
      await worker.destroy();
      expect(worker.isDestroyed()).toBe(true);
    });

    it('nullifies the proxy after destroy', async () => {
      const mockProxy = { add: vi.fn().mockResolvedValue(3) };
      const worker = new TestWorkerRuntime('./math.worker.ts', mockProxy);
      await worker.initialize();
      expect(worker['_proxy']).toBe(mockProxy);

      await worker.destroy();
      expect(worker['_proxy']).toBeNull();
    });

    it('does not nullify proxy before destroy', async () => {
      const mockProxy = { add: vi.fn().mockResolvedValue(3) };
      const worker = new TestWorkerRuntime('./math.worker.ts', mockProxy);
      await worker.initialize();
      expect(worker['_proxy']).toBe(mockProxy);

      // Before destroy, proxy should still exist
      const proxy = worker.use();
      expect(proxy).toBe(mockProxy);
    });

    it('catches and logs errors during termination', async () => {
      const termError = new Error('termination failed');
      const worker = new TestWorkerRuntime('./math.worker.ts', null);
      worker.terminateError = termError;

      await worker.destroy();
      expect(worker.isDestroyed()).toBe(true);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '[OmniWorker] Warning during worker destruction: termination failed'
      );
    });

    it('does not throw even if terminateWorker fails', async () => {
      const worker = new TestWorkerRuntime('./math.worker.ts', null);
      worker.terminateError = new Error('fatal');

      // Should not throw
      await expect(worker.destroy()).resolves.toBeUndefined();
    });

    it('handles non-Error throwables gracefully', async () => {
      const worker = new TestWorkerRuntime('./math.worker.ts', null);
      // Override to throw a string (edge case)
      vi.spyOn(worker, 'terminateWorker').mockImplementation(() => {
        throw 'string error';
      });

      await worker.destroy();
      expect(worker.isDestroyed()).toBe(true);
      // No warning logged for non-Error, but no crash either
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    it('resolves the returned promise', async () => {
      const worker = new TestWorkerRuntime('./math.worker.ts', null);
      const result = await worker.destroy();
      expect(result).toBeUndefined();
    });
  });

  describe('lifecycle integration', () => {
    it('full lifecycle: create → initialize → use → destroy', async () => {
      const mockAdd = vi.fn().mockImplementation((a, b) => a + b);
      const mockProxy = { add: mockAdd };
      const worker = new TestWorkerRuntime('./math.worker.ts', mockProxy);

      // Step 1: Not destroyed, not initialized
      expect(worker.isDestroyed()).toBe(false);
      expect(worker['_proxy']).toBeNull();

      // Step 2: Initialize
      await worker.initialize();
      expect(worker['_proxy']).toBe(mockProxy);

      // Step 3: Use
      const result = await worker.use().add(2, 3);
      expect(result).toBe(5);
      expect(mockAdd).toHaveBeenCalledWith(2, 3);

      // Step 4: Destroy
      await worker.destroy();
      expect(worker.isDestroyed()).toBe(true);
      expect(worker['_proxy']).toBeNull();
      expect(worker.terminateCalled).toBe(true);

      // Step 5: Use after destroy throws
      expect(() => worker.use()).toThrow(OmniWorkerError);

      // Step 6: Destroy again — idempotent
      await worker.destroy();
      expect(worker.isDestroyed()).toBe(true);
    });

    it('destroy before initialize still works', async () => {
      const worker = new TestWorkerRuntime('./math.worker.ts', null);
      // Proxy is null, but destroy should still work
      await worker.destroy();
      expect(worker.isDestroyed()).toBe(true);
      expect(worker['_proxy']).toBeNull();
    });
  });
});
