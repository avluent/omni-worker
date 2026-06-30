/**
 * Omni Worker v2.0 — Helper utility types.
 *
 * Provides type transformations used throughout the library,
 * particularly for wrapping return types in Promise for Comlink proxies.
 *
 * @packageDocumentation
 */

/**
 * Wraps all method return types in `Promise` for Comlink proxy compatibility.
 *
 * Comlink automatically serializes return values across worker boundaries,
 * making every call asynchronous. This utility type ensures that:
 * - Synchronous methods `() => R` become `() => Promise<R>`
 * - Already-async methods `() => Promise<R>` stay `() => Promise<R>` (no double-wrapping)
 *
 * The `Awaited<R>` built-in unwraps Promise layers before re-wrapping,
 * preventing `Promise<Promise<R>>` double-wraps.
 *
 * @typeParam T - The original interface whose methods should be promisified.
 *
 * @example
 * ```typescript
 * interface MyApi {
 *   add(a: number, b: number): number;
 *   fetch(): Promise<string>;
 * }
 *
 * type Proxied = Promisify<MyApi>;
 * // Proxied = {
 * //   add: (a: number, b: number) => Promise<number>;
 * //   fetch: () => Promise<string>;
 * // }
 * ```
 */
export type Promisify<T> = {
  [K in keyof T]: T[K] extends (...args: infer A) => infer R
    ? (...args: A) => Promise<Awaited<R>>
    : T[K];
};

/**
 * A function that returns a Promise.
 *
 * @typeParam R - The resolved value type of the promise. Defaults to `void`.
 */
export type AsyncFn<R = void> = () => Promise<R>;
