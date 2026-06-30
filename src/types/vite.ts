/**
 * Omni Worker v2.0 — Vite plugin type definitions.
 *
 * Defines `VitePluginOptions` for configuring the
 * `omniWorkerVite()` build-time plugin.
 *
 * @packageDocumentation
 */

/**
 * Options for the `omniWorkerVite()` plugin.
 *
 * The plugin intercepts Vite's module resolution for `.worker.ts` files,
 * bundles them with esbuild, and injects the Comlink expose boilerplate.
 *
 * @example
 * ```typescript
 * // vite.config.ts
 * import { omniWorkerVite } from '@anonaddy/omni-worker/vite';
 *
 * export default defineConfig({
 *   plugins: [
 *     omniWorkerVite({
 *       include: ['**/*.worker.ts', '**/*.worker.tsx'],
 *       target: 'es2020',
 *     }),
 *   ],
 * });
 * ```
 */
export interface VitePluginOptions {
  /**
   * Glob patterns of files to include as workers.
   *
   * @default ['**/*.worker.ts']
   */
  include?: string[];

  /**
   * Glob patterns of files to exclude from worker processing.
   *
   * @default []
   */
  exclude?: string[];

  /**
   * The esbuild target for bundling worker code.
   * Determines the JavaScript language features available in
   * the bundled output.
   *
   * @default 'es2018'
   */
  target?: string;
}
