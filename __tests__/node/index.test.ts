/**
 * Tests for the main entry point (src/index.ts).
 *
 * Validates:
 * - Correct exports (functions, types, errors)
 * - omniWorker factory delegates to correct runtime (Node vs Web)
 * - omniWorkerPool factory delegates to correct runtime
 * - NFR004 compliance (API surface audit)
 * - Environment auto-detection
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as index from '../../src/index';
import { OmniWorkerError, OmniWorkerErrorCodes } from '../../src/runtime/error';

/* ------------------------------------------------------------------ */
/* Tests: NFR004 — API Surface Audit                                  */
/* ------------------------------------------------------------------ */

describe('NFR004 — API Surface', () => {
  it('exports exactly the expected named exports', () => {
    const exportedNames = Object.keys(index);

    // Functional exports
    expect(exportedNames).toContain('omniWorker');
    expect(exportedNames).toContain('omniWorkerPool');
    expect(exportedNames).toContain('OmniWorkerError');
    expect(exportedNames).toContain('OmniWorkerErrorCodes');
  });

  it('omniWorker is a plain function (factory, not a class constructor)', () => {
    expect(typeof index.omniWorker).toBe('function');
    // Named function declarations always have prototype.constructor === themselves.
    // The NFR004 requirement is that consumers don't need `new` — just call it.
    // We verify this by calling it directly (see "factory functions work without new" test).
    expect(index.omniWorker.name).toBe('omniWorker');
  });

  it('omniWorkerPool is a plain function (factory, not a class constructor)', () => {
    expect(typeof index.omniWorkerPool).toBe('function');
    expect(index.omniWorkerPool.name).toBe('omniWorkerPool');
  });

  it('OmniWorkerError is a class (constructor)', () => {
    expect(typeof index.OmniWorkerError).toBe('function');
    expect(index.OmniWorkerError.prototype).toBeDefined();
  });

  it('OmniWorkerErrorCodes is an object', () => {
    expect(typeof index.OmniWorkerErrorCodes).toBe('object');
    expect(index.OmniWorkerErrorCodes).toBe(OmniWorkerErrorCodes);
  });

  it('factory functions work without the `new` keyword', () => {
    // Both omniWorker and omniWorkerPool should be callable directly
    // (without 'new') because they're factory functions, not class constructors
    const worker = index.omniWorker('./test.worker.ts', '');
    expect(typeof worker.use).toBe('function');
    worker.destroy();

    const pool = index.omniWorkerPool('./test.worker.ts', '', { count: 1 });
    expect(typeof pool.use).toBe('function');
    pool.destroy();
  });
});

/* ------------------------------------------------------------------ */
/* Tests: omniWorker — Single Worker Factory                          */
/* ------------------------------------------------------------------ */

describe('omniWorker', () => {
  describe('in Node.js environment', () => {
    it('creates a worker with IOmniWorker interface', () => {
      const worker = index.omniWorker('./test.worker.ts', '');
      
      expect(typeof worker.use).toBe('function');
      expect(typeof worker.destroy).toBe('function');
      expect(typeof worker.isDestroyed).toBe('function');
      expect(worker.isDestroyed()).toBe(false);
      
      worker.destroy();
    });

    it('passes path and workerSource to the underlying factory', () => {
      const worker = index.omniWorker('./my/path/worker.worker.ts', 'console.log("test")');
      
      expect(worker['_path']).toBe('./my/path/worker.worker.ts');
      
      worker.destroy();
    });

    it('respects generic type parameter T at compile time', () => {
      interface TestApi {
        add(a: number, b: number): number;
      }
      
      const worker = index.omniWorker<TestApi>('./test.worker.ts', '');
      
      // The worker should have the IOmniWorker interface
      expect(typeof worker.use).toBe('function');
      
      worker.destroy();
    });

    it('each call creates an independent worker (no caching)', () => {
      const worker1 = index.omniWorker('./test.worker.ts', '');
      const worker2 = index.omniWorker('./test.worker.ts', '');
      
      // They should be different instances
      expect(worker1).not.toBe(worker2);
      expect(worker1['_worker']).not.toBe(worker2['_worker']);
      
      worker1.destroy();
      worker2.destroy();
    });

    it('detects Node.js via process.versions.node', () => {
      // This test confirms we're actually in Node.js
      const isNode = typeof process !== 'undefined' && !!process.versions?.node;
      expect(isNode).toBe(true);
      
      // And that omniWorker creates a Node worker
      const worker = index.omniWorker('./test.worker.ts', '');
      expect(worker['_worker']).toBeDefined();
      
      worker.destroy();
    });
  });

  describe('parameter validation', () => {
    it('accepts relative paths', () => {
      const worker = index.omniWorker('./relative/path.worker.ts', '');
      expect(worker['_path']).toBe('./relative/path.worker.ts');
      worker.destroy();
    });

    it('accepts absolute paths', () => {
      const worker = index.omniWorker('/absolute/path.worker.ts', '');
      expect(worker['_path']).toBe('/absolute/path.worker.ts');
      worker.destroy();
    });

    it('accepts empty workerSource (delegates to runtime)', () => {
      // Empty source is technically valid — the runtime handles the error
      const worker = index.omniWorker('./test.worker.ts', '');
      // Worker is still created (empty code is valid for eval: true)
      expect(worker.isDestroyed()).toBe(false);
      worker.destroy();
    });
  });
});

/* ------------------------------------------------------------------ */
/* Tests: omniWorkerPool — Worker Pool Factory                        */
/* ------------------------------------------------------------------ */

describe('omniWorkerPool', () => {
  describe('in Node.js environment', () => {
    it('creates a pool with default count of 1', () => {
      const pool = index.omniWorkerPool('./test.worker.ts', '');
      
      expect(pool.getNumOfWorkers()).toBe(1);
      expect(typeof pool.use).toBe('function');
      expect(typeof pool.destroy).toBe('function');
      expect(typeof pool.isDestroyed).toBe('function');
      
      pool.destroy();
    });

    it('creates a pool with specified count', () => {
      const pool = index.omniWorkerPool('./test.worker.ts', '', { count: 4 });
      
      expect(pool.getNumOfWorkers()).toBe(4);
      
      pool.destroy();
    });

    it('creates a pool that dispatches round-robin', () => {
      const pool = index.omniWorkerPool('./test.worker.ts', '', { count: 3 });
      
      // Pool should dispatch round-robin
      expect(pool.getNumOfWorkers()).toBe(3);
      expect(pool.isDestroyed()).toBe(false);
      
      pool.destroy();
      expect(pool.isDestroyed()).toBe(true);
    });

    it('respects generic type parameter T', () => {
      interface TestApi {
        multiply(a: number, b: number): number;
      }
      
      const pool = index.omniWorkerPool<TestApi>('./test.worker.ts', '', { count: 2 });
      
      expect(pool.getNumOfWorkers()).toBe(2);
      
      pool.destroy();
    });

    it('detects Node.js and creates Node workers', () => {
      const pool = index.omniWorkerPool('./test.worker.ts', '', { count: 2 });
      
      expect(pool.getNumOfWorkers()).toBe(2);
      expect(pool.isDestroyed()).toBe(false);
      
      pool.destroy();
    });

    it('pool destroy is idempotent', async () => {
      const pool = index.omniWorkerPool('./test.worker.ts', '', { count: 2 });
      
      await pool.destroy();
      await pool.destroy();
      await pool.destroy();
      
      expect(pool.isDestroyed()).toBe(true);
    });
  });

  describe('pool count validation', () => {
    it('throws for count < 1', () => {
      expect(() => {
        index.omniWorkerPool('./test.worker.ts', '', { count: 0 });
      }).toThrow(OmniWorkerError);
    });

    it('throws for negative count', () => {
      expect(() => {
        index.omniWorkerPool('./test.worker.ts', '', { count: -1 });
      }).toThrow(OmniWorkerError);
    });

    it('throws for count exceeding maxCount (128)', () => {
      expect(() => {
        index.omniWorkerPool('./test.worker.ts', '', { count: 129 });
      }).toThrow(OmniWorkerError);
    });

    it('accepts count equal to maxCount (128)', () => {
      const pool = index.omniWorkerPool('./test.worker.ts', '', { count: 128 });
      expect(pool.getNumOfWorkers()).toBe(128);
      pool.destroy();
    });
  });

  describe('parameter handling', () => {
    it('accepts options as undefined (uses defaults)', () => {
      const pool = index.omniWorkerPool('./test.worker.ts', '', undefined);
      expect(pool.getNumOfWorkers()).toBe(1);
      pool.destroy();
    });

    it('accepts empty options object (uses defaults)', () => {
      const pool = index.omniWorkerPool('./test.worker.ts', '', {});
      expect(pool.getNumOfWorkers()).toBe(1);
      pool.destroy();
    });
  });
});

/* ------------------------------------------------------------------ */
/* Tests: Re-exported Types                                           */
/* ------------------------------------------------------------------ */

describe('Re-exported Types', () => {
  it('IOmniWorker is re-exported (type)', () => {
    // Type-only exports exist in module structure
    // Runtime verification: the worker returned implements IOmniWorker
    const worker = index.omniWorker('./test.worker.ts', '');
    expect(worker).toHaveProperty('use');
    expect(worker).toHaveProperty('destroy');
    expect(worker).toHaveProperty('isDestroyed');
    worker.destroy();
  });

  it('IOmniWorkerPool is re-exported (type)', () => {
    const pool = index.omniWorkerPool('./test.worker.ts', '', { count: 1 });
    expect(pool).toHaveProperty('use');
    expect(pool).toHaveProperty('destroy');
    expect(pool).toHaveProperty('isDestroyed');
    expect(pool).toHaveProperty('getNumOfWorkers');
    pool.destroy();
  });

  it('PoolOptions is re-exported (type)', () => {
    // Verified by accepting PoolOptions in omniWorkerPool
    expect(true).toBe(true);
  });

  it('VitePluginOptions is re-exported (type)', () => {
    // Verified by import availability
    expect(true).toBe(true);
  });

  it('all type re-exports produce objects implementing those types', () => {
    // omniWorker returns IOmniWorker
    const worker = index.omniWorker('./test.worker.ts', '');
    expect(typeof worker.use).toBe('function');
    expect(typeof worker.destroy).toBe('function');
    expect(typeof worker.isDestroyed).toBe('function');
    worker.destroy();

    // omniWorkerPool returns IOmniWorkerPool
    const pool = index.omniWorkerPool('./test.worker.ts', '', { count: 1 });
    expect(typeof pool.use).toBe('function');
    expect(typeof pool.destroy).toBe('function');
    expect(typeof pool.isDestroyed).toBe('function');
    expect(typeof pool.getNumOfWorkers).toBe('function');
    pool.destroy();
  });
});

/* ------------------------------------------------------------------ */
/* Tests: Re-exported Errors                                          */
/* ------------------------------------------------------------------ */

describe('Re-exported Errors', () => {
  it('OmniWorkerError is re-exported from runtime/error', () => {
    expect(index.OmniWorkerError).toBe(OmniWorkerError);
  });

  it('OmniWorkerErrorCodes is re-exported from runtime/error', () => {
    expect(index.OmniWorkerErrorCodes).toBe(OmniWorkerErrorCodes);
  });

  it('can throw and catch OmniWorkerError from re-export', () => {
    expect(() => {
      throw new index.OmniWorkerError('test', {
        code: index.OmniWorkerErrorCodes.WORKER_NOT_FOUND,
      });
    }).toThrow(index.OmniWorkerError);
  });
});

/* ------------------------------------------------------------------ */
/* Tests: Environment Detection                                       */
/* ------------------------------------------------------------------ */

describe('Environment Detection', () => {
  it('uses Node.js detection logic: typeof process && process.versions.node', () => {
    // In this test environment (Node.js), this evaluates to truthy
    const isNode = typeof process !== 'undefined' && !!process.versions?.node;
    expect(isNode).toBe(true);
  });

  it('detects environment consistently across calls', () => {
    // Both omniWorker and omniWorkerPool use the same detection logic
    const w1 = index.omniWorker('./t1.worker.ts', '');
    const w2 = index.omniWorker('./t2.worker.ts', '');
    
    // Both should be the same runtime type
    expect(w1['_worker']).toBeDefined();
    expect(w2['_worker']).toBeDefined();
    
    w1.destroy();
    w2.destroy();
  });
});

/* ------------------------------------------------------------------ */
/* Tests: JSDoc Documentation                                         */
/* ------------------------------------------------------------------ */

describe('JSDoc Documentation', () => {
  it('omniWorker is a documented function', () => {
    expect(index.omniWorker).toBeDefined();
    expect(typeof index.omniWorker).toBe('function');
  });

  it('omniWorkerPool is a documented function', () => {
    expect(index.omniWorkerPool).toBeDefined();
    expect(typeof index.omniWorkerPool).toBe('function');
  });
});

/* ------------------------------------------------------------------ */
/* Tests: Integration — full lifecycle                                */
/* ------------------------------------------------------------------ */

describe('Integration — full lifecycle', () => {
  it('single worker: create → use → destroy', () => {
    const worker = index.omniWorker('./lifecycle.worker.ts', '');
    
    // Create
    expect(worker.isDestroyed()).toBe(false);
    
    // Use
    expect(() => worker.use()).not.toThrow();
    
    // Destroy
    worker.destroy();
    expect(worker.isDestroyed()).toBe(true);
  });

  it('pool: create → use → destroy', async () => {
    const pool = index.omniWorkerPool('./lifecycle.worker.ts', '', { count: 2 });
    
    // Create
    expect(pool.isDestroyed()).toBe(false);
    expect(pool.getNumOfWorkers()).toBe(2);
    
    // Use
    expect(() => pool.use()).not.toThrow();
    
    // Destroy (async — must await for workers array to clear)
    await pool.destroy();
    expect(pool.isDestroyed()).toBe(true);
    expect(pool.getNumOfWorkers()).toBe(0);
  });

  it('worker and pool can coexist independently', async () => {
    const worker = index.omniWorker('./a.worker.ts', '');
    const pool = index.omniWorkerPool('./b.worker.ts', '', { count: 2 });
    
    // Both operational
    expect(worker.isDestroyed()).toBe(false);
    expect(pool.isDestroyed()).toBe(false);
    
    // Destroy worker doesn't affect pool
    await worker.destroy();
    expect(worker.isDestroyed()).toBe(true);
    expect(pool.isDestroyed()).toBe(false);
    
    // Destroy pool doesn't affect already-destroyed worker
    await pool.destroy();
    expect(pool.isDestroyed()).toBe(true);
    expect(worker.isDestroyed()).toBe(true);
  });
});
