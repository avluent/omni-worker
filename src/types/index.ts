/**
 * Omni Worker v2.0 — Type exports barrel.
 *
 * Re-exports all public type definitions for the library.
 * Consumers can import types from `'@anonaddy/omni-worker'` directly.
 *
 * @packageDocumentation
 */

export type { Promisify, AsyncFn } from './helpers';
export type { IOmniWorker } from './worker';
export type { PoolOptions, IOmniWorkerPool } from './pool';
export type { VitePluginOptions } from './vite';
