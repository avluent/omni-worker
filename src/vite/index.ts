/**
 * Vite plugin for Omni Worker v2.0.
 *
 * Provides Vite integration for bundling and transforming worker files.
 * Import via: `import { omniWorkerVitePlugin } from '@anonaddy/omni-worker/vite'`
 *
 * @module vite
 */

/**
 * Vite plugin configuration returned by `omniWorkerVitePlugin()`.
 */
interface OmniWorkerVitePlugin {
  name: string;
  /** Additional Vite plugin hooks will be added in subsequent tasks. */
  [key: string]: unknown;
}

/**
 * Create the Omni Worker Vite plugin.
 *
 * @returns A Vite plugin configuration object.
 * @throws Error - Not yet implemented in v2.0 scaffolding.
 */
export function omniWorkerVitePlugin(): OmniWorkerVitePlugin {
  return {
    name: 'omni-worker',
  };
}

export default omniWorkerVitePlugin;
