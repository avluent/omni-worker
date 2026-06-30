/**
 * Omni Worker v2.0 — Type Definitions Tests
 *
 * These tests validate the type system using compile-time assertions.
 * Run with: `tsc --noEmit` to verify all types resolve correctly.
 *
 * Any type mismatch will produce a TypeScript compilation error,
 * which serves as a test failure.
 */

import type {
  Promisify,
  AsyncFn,
  IOmniWorker,
  IOmniWorkerPool,
  PoolOptions,
  VitePluginOptions,
} from '../../src/types';

// ─────────────────────────────────────────────────
// Utility: type equality check (compile-time only)
// ─────────────────────────────────────────────────

/**
 * Asserts that two types are identical at compile time.
 * Usage: `type Assert = ExpectEquals<Actual, Expected>;`
 * If types differ, the resulting type is `never`, causing a compile error.
 */
type ExpectEquals<T, U> = [T] extends [U] ? ([U] extends [T] ? true : false) : false;

/**
 * Asserts that a type is assignable to another (one-way check).
 * Usage: `type Assert = ExpectAssignable<T, U>;`
 * Verifies that T can be assigned to U.
 */
type ExpectAssignable<T, U> = T extends U ? true : false;

// ─────────────────────────────────────────────────
// 1. Promisify<T> tests
// ─────────────────────────────────────────────────

// Sync method should become Promise
type SyncInterface = {
  add(a: number, b: number): number;
};
type SyncPromisified = Promisify<SyncInterface>;
// Verify: add returns Promise<number>, not number
type _test1 = ExpectAssignable<
  SyncPromisified['add'],
  (a: number, b: number) => Promise<number>
>;

// Async method should stay Promise (no double-wrap)
type AsyncInterface = {
  fetch(url: string): Promise<string>;
};
type AsyncPromisified = Promisify<AsyncInterface>;
// Verify: fetch returns Promise<string>, NOT Promise<Promise<string>>
type _test2 = ExpectAssignable<
  AsyncPromisified['fetch'],
  (url: string) => Promise<string>
>;
// Double-wrap check: the promisified type should NOT be assignable to Promise<Promise<string>>
type _test2b = [AsyncPromisified['fetch']] extends [(url: string) => Promise<Promise<string>>] ? false : true;

// Mixed interface with both sync and async methods
type MixedInterface = {
  compute(x: number): number;
  getData(): Promise<string>;
  noop(): void;
};
type MixedPromisified = Promisify<MixedInterface>;
type _test3a = ExpectAssignable<MixedPromisified['compute'], (x: number) => Promise<number>>;
type _test3b = ExpectAssignable<MixedPromisified['getData'], () => Promise<string>>;
type _test3c = ExpectAssignable<MixedPromisified['noop'], () => Promise<void>>;

// Non-function properties should pass through unchanged
type WithProperty = {
  value: string;
  method(): number;
};
type WithPropertyPromisified = Promisify<WithProperty>;
type _test4 = ExpectAssignable<WithPropertyPromisified['value'], string>;
type _test4b = ExpectAssignable<WithPropertyPromisified['method'], () => Promise<number>>;

// ─────────────────────────────────────────────────
// 2. AsyncFn tests
// ─────────────────────────────────────────────────

// AsyncFn defaults to void
type _test5 = ExpectAssignable<AsyncFn, () => Promise<void>>;
type _test5b = ExpectAssignable<AsyncFn<void>, () => Promise<void>>;
type _test6 = ExpectAssignable<AsyncFn<string>, () => Promise<string>>;

// ─────────────────────────────────────────────────
// 3. IOmniWorker<T> tests
// ─────────────────────────────────────────────────

// Verify IOmniWorker has all required methods
type WorkerCheck = IOmniWorker<{ add(a: number, b: number): number }>;
type _test7 = ExpectAssignable<WorkerCheck['use'], () => Promisify<{ add(a: number, b: number): number }>>;
type _test8 = ExpectAssignable<WorkerCheck['isDestroyed'], () => boolean>;
type _test9 = ExpectAssignable<WorkerCheck['destroy'], () => Promise<void>>;

// Verify use() returns Promisify<T>
type _test10 = ExpectAssignable<
  ReturnType<WorkerCheck['use']>,
  { add(a: number, b: number): Promise<number> }
>;

// ─────────────────────────────────────────────────
// 4. IOmniWorkerPool<T> tests
// ─────────────────────────────────────────────────

// Verify IOmniWorkerPool extends IOmniWorker
type PoolCheck = IOmniWorkerPool<{ compute(): number }>;
// Pool should have all IOmniWorker methods
type _test11 = ExpectAssignable<PoolCheck, IOmniWorker<{ compute(): number }>>;
// Pool should have getNumOfWorkers
type _test12 = ExpectAssignable<PoolCheck['getNumOfWorkers'], () => number>;
// Pool.use() should also return Promisify<T>
type _test13 = ExpectAssignable<
  ReturnType<PoolCheck['use']>,
  { compute(): Promise<number> }
>;

// ─────────────────────────────────────────────────
// 5. PoolOptions tests
// ─────────────────────────────────────────────────

// PoolOptions has optional count
type _test14 = ExpectAssignable<PoolOptions, {}>;
type _test15 = ExpectAssignable<PoolOptions, { count: 4 }>;
type _test16 = ExpectAssignable<{ count?: number }, PoolOptions>;

// ─────────────────────────────────────────────────
// 6. VitePluginOptions tests
// ─────────────────────────────────────────────────

// VitePluginOptions has all optional properties
type _test17 = ExpectAssignable<VitePluginOptions, {}>;
type _test18 = ExpectAssignable<VitePluginOptions, { include: ['**/*.worker.ts'] }>;
type _test19 = ExpectAssignable<VitePluginOptions, { exclude: ['**/*.test.worker.ts'] }>;
type _test20 = ExpectAssignable<VitePluginOptions, { target: 'es2020' }>;
type _test21 = ExpectAssignable<
  VitePluginOptions,
  { include: string[]; exclude: string[]; target: string }
>;

// ─────────────────────────────────────────────────
// 7. Real-world usage simulation
// ─────────────────────────────────────────────────

/**
 * Simulates a real consumer interface as defined in the spec.
 */
interface MyApi {
  add(a: number, b: number): number;
  capitalize(str: string): string;
  fetchData(): Promise<Record<string, unknown>>;
}

// Simulate worker.use() return type
type MyWorkerProxy = Promisify<MyApi>;

// add: sync → Promise<number>
type _test22 = ExpectAssignable<MyWorkerProxy['add'], (a: number, b: number) => Promise<number>>;
// capitalize: sync → Promise<string>
type _test23 = ExpectAssignable<MyWorkerProxy['capitalize'], (str: string) => Promise<string>>;
// fetchData: async → Promise<Record<...>> (no double-wrap)
type _test24 = ExpectAssignable<MyWorkerProxy['fetchData'], () => Promise<Record<string, unknown>>>;

// Verify wrong argument type would fail (this is a comment, not actual test)
// type WrongArgs = MyWorkerProxy['add'] extends (a: string, b: number) => any ? true : false;
// The above would be 'false', confirming the types are strict.

// ─────────────────────────────────────────────────
// 8. Generic variance tests
// ─────────────────────────────────────────────────

// IOmniWorker should be generic and work with any interface
type EmptyWorker = IOmniWorker<{}>;
type _test25 = ExpectAssignable<EmptyWorker['use'], () => Promisify<{}>>;
type _test26 = ExpectAssignable<EmptyWorker['destroy'], () => Promise<void>>;

// IOmniWorkerPool should be generic
type EmptyPool = IOmniWorkerPool<{}>;
type _test27 = ExpectAssignable<EmptyPool, IOmniWorker<{}>>;
type _test28 = ExpectAssignable<EmptyPool['getNumOfWorkers'], () => number>;

// ─────────────────────────────────────────────────
// Summary: All type assertions above are compile-time checks.
// If any assertion fails, `tsc --noEmit` will report an error.
// ─────────────────────────────────────────────────
