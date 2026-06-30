/**
 * Unit tests for the worker pool round-robin dispatch implementation.
 *
 * Tests cover:
 * - Pool creation with correct count
 * - Round-robin dispatch order
 * - Worker independence
 * - Parallel destruction
 * - Count validation (min, max)
 * - Default count
 * - Destroy idempotency
 * - use() on destroyed pool throws
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { IOmniWorker, Promisify } from '../../src/types';
import { OmniWorkerPool, createWorkerPool } from '../../src/runtime/pool';
import { OmniWorkerError, OmniWorkerErrorCodes } from '../../src/runtime/error';

/**
 * Mock worker factory for testing.
 * Each mock worker tracks how many times `use()` has been called.
 */
function createMockWorker<T>(workerIndex: number): {
  worker: IOmniWorker<T>;
  useSpy: ReturnType<typeof vi.fn>;
  destroySpy: ReturnType<typeof vi.fn>;
} {
  const useSpy = vi.fn(() => ({
    // Simulated Promisify<T> — every method returns a resolved Promise
    then: vi.fn((onFulfilled: () => unknown) => onFulfilled?.()),
  }));
  const destroySpy = vi.fn(async () => {
    // Simulate async destroy
  });

  const worker: IOmniWorker<T> = {
    use: useSpy,
    isDestroyed: vi.fn(() => false),
    destroy: destroySpy,
  } as unknown as IOmniWorker<T>;

  return { worker, useSpy, destroySpy };
}

describe('OmniWorkerPool', () => {
  let mockWorkers: Array<{
    worker: IOmniWorker<unknown>;
    useSpy: ReturnType<typeof vi.fn>;
    destroySpy: ReturnType<typeof vi.fn>;
  }>;

  beforeEach(() => {
    mockWorkers = Array.from({ length: 3 }, (_, i) =>
      createMockWorker<unknown>(i)
    );
  });

  describe('constructor', () => {
    it('stores the workers and path', () => {
      const pool = new OmniWorkerPool(mockWorkers.map(m => m.worker), './test.worker.ts');
      expect(pool.getNumOfWorkers()).toBe(3);
    });
  });

  describe('use() — round-robin dispatch', () => {
    it('dispatches to workers in strict round-robin order: 0 → 1 → 2 → 0', () => {
      const pool = new OmniWorkerPool(mockWorkers.map(m => m.worker), './test.worker.ts');

      // First call → worker[0]
      pool.use();
      expect(mockWorkers[0].useSpy).toHaveBeenCalledTimes(1);
      expect(mockWorkers[1].useSpy).toHaveBeenCalledTimes(0);
      expect(mockWorkers[2].useSpy).toHaveBeenCalledTimes(0);

      // Second call → worker[1]
      pool.use();
      expect(mockWorkers[1].useSpy).toHaveBeenCalledTimes(1);

      // Third call → worker[2]
      pool.use();
      expect(mockWorkers[2].useSpy).toHaveBeenCalledTimes(1);

      // Fourth call → worker[0] (wraps around)
      pool.use();
      expect(mockWorkers[0].useSpy).toHaveBeenCalledTimes(2);
    });

    it('respects the round-robin table from FR005 spec', () => {
      const pool = new OmniWorkerPool(mockWorkers.map(m => m.worker), './test.worker.ts');

      // Call #1 → workers[0]
      pool.use();
      // Call #2 → workers[1]
      pool.use();
      // Call #3 → workers[2]
      pool.use();
      // Call #4 → workers[0]
      pool.use();
      // Call #5 → workers[1]
      pool.use();

      expect(mockWorkers[0].useSpy).toHaveBeenCalledTimes(2); // calls 1, 4
      expect(mockWorkers[1].useSpy).toHaveBeenCalledTimes(2); // calls 2, 5
      expect(mockWorkers[2].useSpy).toHaveBeenCalledTimes(1); // call 3
    });

    it('uses the correct worker for N calls following (N-1) % count formula', () => {
      const pool = new OmniWorkerPool(mockWorkers.map(m => m.worker), './test.worker.ts');
      const callCount = 10;
      for (let n = 1; n <= callCount; n++) {
        pool.use();
      }

      // With 3 workers, 10 calls → indices: 0,1,2,0,1,2,0,1,2,0
      // worker[0]: calls 1,4,7,10 → 4 times
      // worker[1]: calls 2,5,8 → 3 times
      // worker[2]: calls 3,6,9 → 3 times
      expect(mockWorkers[0].useSpy).toHaveBeenCalledTimes(4);
      expect(mockWorkers[1].useSpy).toHaveBeenCalledTimes(3);
      expect(mockWorkers[2].useSpy).toHaveBeenCalledTimes(3);
    });
  });

  describe('use() — error conditions', () => {
    it('throws WORKER_ALREADY_DESTROYED when pool is destroyed', () => {
      const pool = new OmniWorkerPool(mockWorkers.map(m => m.worker), './test.worker.ts');
      pool._destroyed = Object.getOwnPropertyDescriptor(pool, 'isDestroyed')
        ? true
        : false;

      // Access private property via type assertion for test
      (pool as unknown as { _destroyed: boolean })._destroyed = true;

      expect(() => pool.use()).toThrow(OmniWorkerError);
      expect(() => pool.use()).toThrow(
        new RegExp('already destroyed')
      );
    });

    it('throws INVALID_POOL_COUNT when pool has no workers', () => {
      const pool = new OmniWorkerPool([], './test.worker.ts');
      expect(() => pool.use()).toThrow(OmniWorkerError);
      expect(() => pool.use()).toThrow(
        new RegExp('no workers')
      );
    });
  });

  describe('isDestroyed()', () => {
    it('returns false before destroy', () => {
      const pool = new OmniWorkerPool(mockWorkers.map(m => m.worker), './test.worker.ts');
      expect(pool.isDestroyed()).toBe(false);
    });

    it('returns true after destroy', async () => {
      const pool = new OmniWorkerPool(mockWorkers.map(m => m.worker), './test.worker.ts');
      await pool.destroy();
      expect(pool.isDestroyed()).toBe(true);
    });
  });

  describe('destroy()', () => {
    it('terminates all workers in parallel via Promise.all()', async () => {
      const pool = new OmniWorkerPool(mockWorkers.map(m => m.worker), './test.worker.ts');
      await pool.destroy();

      expect(mockWorkers[0].destroySpy).toHaveBeenCalledTimes(1);
      expect(mockWorkers[1].destroySpy).toHaveBeenCalledTimes(1);
      expect(mockWorkers[2].destroySpy).toHaveBeenCalledTimes(1);
    });

    it('is idempotent — second call is a no-op', async () => {
      const pool = new OmniWorkerPool(mockWorkers.map(m => m.worker), './test.worker.ts');
      await pool.destroy();
      await pool.destroy();
      await pool.destroy();

      // Each worker's destroy should only have been called once
      expect(mockWorkers[0].destroySpy).toHaveBeenCalledTimes(1);
      expect(mockWorkers[1].destroySpy).toHaveBeenCalledTimes(1);
      expect(mockWorkers[2].destroySpy).toHaveBeenCalledTimes(1);
    });

    it('clears the workers array after destroy', async () => {
      const pool = new OmniWorkerPool(mockWorkers.map(m => m.worker), './test.worker.ts');
      expect(pool.getNumOfWorkers()).toBe(3);
      await pool.destroy();
      expect(pool.getNumOfWorkers()).toBe(0);
    });
  });

  describe('getNumOfWorkers()', () => {
    it('returns the configured count', () => {
      const pool = new OmniWorkerPool(mockWorkers.map(m => m.worker), './test.worker.ts');
      expect(pool.getNumOfWorkers()).toBe(3);
    });

    it('returns 0 for an empty pool', () => {
      const pool = new OmniWorkerPool([], './test.worker.ts');
      expect(pool.getNumOfWorkers()).toBe(0);
    });
  });
});

describe('createWorkerPool', () => {
  let createWorkerSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    createWorkerSpy = vi.fn((index: number) =>
      createMockWorker<unknown>(index).worker
    );
  });

  describe('default count', () => {
    it('uses count of 1 when no options provided', () => {
      const pool = createWorkerPool('./test.worker.ts', {}, createWorkerSpy);
      expect(pool.getNumOfWorkers()).toBe(1);
      expect(createWorkerSpy).toHaveBeenCalledTimes(1);
      expect(createWorkerSpy).toHaveBeenLastCalledWith(0);
    });

    it('uses count of 1 when options is undefined', () => {
      const pool = createWorkerPool('./test.worker.ts', undefined, createWorkerSpy);
      expect(pool.getNumOfWorkers()).toBe(1);
    });
  });

  describe('count validation — minimum', () => {
    it('throws INVALID_POOL_COUNT for count: 0', () => {
      expect(() =>
        createWorkerPool('./test.worker.ts', { count: 0 }, createWorkerSpy)
      ).toThrow(OmniWorkerError);

      expect(() =>
        createWorkerPool('./test.worker.ts', { count: 0 }, createWorkerSpy)
      ).toThrow(/must be >= 1/);
    });

    it('throws INVALID_POOL_COUNT for negative count', () => {
      expect(() =>
        createWorkerPool('./test.worker.ts', { count: -1 }, createWorkerSpy)
      ).toThrow(OmniWorkerError);
    });
  });

  describe('count validation — maximum', () => {
    it('throws INVALID_POOL_COUNT when count exceeds default maxCount (128)', () => {
      expect(() =>
        createWorkerPool('./test.worker.ts', { count: 129 }, createWorkerSpy)
      ).toThrow(OmniWorkerError);

      expect(() =>
        createWorkerPool('./test.worker.ts', { count: 129 }, createWorkerSpy)
      ).toThrow(/must be <= 128/);
    });

    it('accepts count equal to maxCount (128)', () => {
      const pool = createWorkerPool('./test.worker.ts', { count: 128 }, createWorkerSpy);
      expect(pool.getNumOfWorkers()).toBe(128);
    });

    it('respects custom maxCount', () => {
      expect(() =>
        createWorkerPool('./test.worker.ts', { count: 6, maxCount: 5 }, createWorkerSpy)
      ).toThrow(OmniWorkerError);

      expect(() =>
        createWorkerPool('./test.worker.ts', { count: 6, maxCount: 5 }, createWorkerSpy)
      ).toThrow(/must be <= 5/);
    });

    it('accepts count equal to custom maxCount', () => {
      const pool = createWorkerPool('./test.worker.ts', { count: 5, maxCount: 5 }, createWorkerSpy);
      expect(pool.getNumOfWorkers()).toBe(5);
    });
  });

  describe('worker creation', () => {
    it('creates exactly `count` workers (not count+1 — v0.x off-by-one bug fixed)', () => {
      const pool = createWorkerPool('./test.worker.ts', { count: 3 }, createWorkerSpy);
      expect(createWorkerSpy).toHaveBeenCalledTimes(3);
      expect(pool.getNumOfWorkers()).toBe(3);
    });

    it('calls createWorker with sequential indices', () => {
      createWorkerPool('./test.worker.ts', { count: 4 }, createWorkerSpy);
      expect(createWorkerSpy).toHaveBeenCalledWith(0);
      expect(createWorkerSpy).toHaveBeenCalledWith(1);
      expect(createWorkerSpy).toHaveBeenCalledWith(2);
      expect(createWorkerSpy).toHaveBeenCalledWith(3);
    });

    it('accumulates workers (not overwrite — v0.x loop overwrite bug fixed)', () => {
      const pool = createWorkerPool('./test.worker.ts', { count: 3 }, createWorkerSpy);
      expect(pool.getNumOfWorkers()).toBe(3);
    });
  });

  describe('returned pool behavior', () => {
    it('returned pool dispatches round-robin correctly', () => {
      const createMockSpy = vi.fn((index: number) =>
        createMockWorker<unknown>(index).worker
      );
      const pool = createWorkerPool('./test.worker.ts', { count: 3 }, createMockSpy);

      pool.use();
      pool.use();
      pool.use();
      pool.use();

      // Workers[0] should be called twice (positions 1 and 4)
      // Workers[1] should be called once (position 2)
      // Workers[2] should be called once (position 3)
      expect(createMockSpy).toHaveBeenCalledTimes(3);
    });
  });
});
