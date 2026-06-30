/**
 * Vite plugin for Omni Worker v2.0.
 *
 * Bundles `.worker.ts` files at build time using esbuild.
 * Imports via: `import { omniWorkerVite } from '@anonaddy/omni-worker/vite'`
 *
 * During Vite's build phase:
 * 1. Intercepts `.worker.ts` files via `resolveId` hook
 * 2. Transforms them with esbuild (includes all imports in single bundle)
 * 3. Injects Comlink expose boilerplate
 * 4. Returns bundled code as a Vite module
 *
 * @module vite
 */

import type { Plugin } from 'vite';
import * as esbuild from 'esbuild';
import { readFileSync } from 'node:fs';
import { dirname, resolve, isAbsolute } from 'node:path';
import { createRequire } from 'node:module';
import { OmniWorkerError, OmniWorkerErrorCodes } from '../runtime/error';

/**
 * Options for the `omniWorkerVite()` plugin.
 *
 * @see {@link omniWorkerVite}
 */
export interface VitePluginOptions {
  /** Glob patterns of files to include as workers. */
  include?: string[];
  /** Glob patterns of files to exclude from worker processing. */
  exclude?: string[];
  /** The esbuild target for bundling worker code. */
  target?: string;
}

/** Pattern matching `.worker.ts` file extensions */
const WORKER_FILE_PATTERN = /\.worker\.ts$/;

/** Virtual module prefix — isolates our modules from Vite's resolver */
const VIRTUAL_PREFIX = '\0omni-worker:';

/**
 * Create the Omni Worker Vite plugin.
 *
 * The plugin intercepts Vite's module resolution for `.worker.ts` files,
 * bundles them with esbuild, and injects the Comlink expose boilerplate.
 *
 * @param options - Plugin configuration options
 * @returns A Vite plugin that handles `.worker.ts` files
 *
  * @example
  * ```typescript
  * // vite.config.ts
  * import { defineConfig } from 'vite';
  * import { omniWorkerVite } from '@anonaddy/omni-worker/vite';
  *
  * export default defineConfig({
  *   plugins: [
  *     omniWorkerVite({ target: 'es2020' }),
  *   ],
  * });
  * ```
 */
export function omniWorkerVite(options: VitePluginOptions = {}): Plugin {
  const include = options.include ?? ['**/*.worker.ts'];
  const exclude = options.exclude ?? [];
  const target = options.target ?? 'es2018';

  // Convert glob patterns to regex for matching
  const includeRegexes = include.map(pattern => new RegExp(pattern.replace(/\*/g, '.*')));
  const excludeRegexes = exclude.map(pattern => new RegExp(pattern.replace(/\*/g, '.*')));

  return {
    name: 'vite-omni-worker',

    /** Run early so we can intercept .worker.ts before other plugins */
    enforce: 'pre',

    /**
     * Resolve `.worker.ts` imports to virtual module IDs.
     *
     * When Vite encounters `import something from './my.worker.ts'`,
     * this hook detects the `.worker.ts` extension and maps it to a
     * virtual module ID prefixed with our namespace. This prevents
     * other plugins from processing the file and ensures our `load`
     * hook receives it.
     *
     * @param id - The import specifier (path or bare module name)
     * @param importer - The file that contains the import (if any)
     * @returns A virtual module ID, or `null` if this isn't a worker file
     */
    async resolveId(id, importer) {
      if (!WORKER_FILE_PATTERN.test(id)) {
        return null;
      }

      // Resolve to absolute path first (needed for accurate pattern matching)
      let resolvedPath: string;
      if (isAbsolute(id)) {
        resolvedPath = id;
      } else if (importer) {
        resolvedPath = resolve(dirname(importer), id);
      } else {
        resolvedPath = resolve(process.cwd(), id);
      }

      // Check include/exclude patterns against both the raw id and resolved path
      const matchesPattern = (patterns: RegExp[]) =>
        patterns.some(rx => rx.test(id)) || patterns.some(rx => rx.test(resolvedPath));

      const included = includeRegexes.length === 0 || matchesPattern(includeRegexes);
      const excluded = matchesPattern(excludeRegexes);

      if (!included || excluded) {
        return null;
      }

      return VIRTUAL_PREFIX + resolvedPath;
    },

    /**
     * Load and bundle `.worker.ts` files with esbuild.
     *
     * For each virtual module ID from `resolveId`:
     * 1. Reads the original TypeScript source
     * 2. Validates that it exports an `api` object
     * 3. Appends `Comlink.expose(api)` boilerplate
     * 4. Bundles everything (including imports) with esbuild
     * 5. Returns module code exporting the bundled result
     *
     * The returned module exports:
     * - `code`: Raw bundled JavaScript string (for Node.js `eval` mode)
     * - `url`: Data URL of the bundled code (for browser Worker mode)
     * - `default`: The data URL (primary export)
     *
     * @param id - The virtual module ID
     * @returns Module code string, or `null` if this isn't our virtual module
     */
    async load(id) {
      if (!id.startsWith(VIRTUAL_PREFIX)) {
        return null;
      }

      const workerPath = id.slice(VIRTUAL_PREFIX.length);

      // Register the source file for HMR watching
      this.addWatchFile(workerPath);

      // Read the original TypeScript source
      let source: string;
      try {
        source = readFileSync(workerPath, 'utf-8');
      } catch (error) {
        throw new OmniWorkerError(
          `Cannot read worker file '${workerPath}'`,
          {
            code: OmniWorkerErrorCodes.WORKER_NOT_FOUND,
            workerPath,
            cause: error instanceof Error ? error : new Error(String(error)),
          }
        );
      }

      // Validate: must export an 'api' object
      if (!source.includes('export') || !source.includes('api')) {
        throw new OmniWorkerError(
          `Worker file '${workerPath}' must export an 'api' object containing your functions`,
          {
            code: OmniWorkerErrorCodes.MISSING_API_EXPORT,
            workerPath,
          }
        );
      }

      // Append Comlink expose boilerplate before bundling.
      // Comlink is bundled inline — data URL workers cannot resolve bare specifiers.
      const fullSource = `${source}

import * as Comlink from 'comlink';
Comlink.expose(api);
`;

      // Bundle with esbuild
      let bundled: string;
      try {
        // Resolve comlink's ESM entry point from the library's node_modules.
        // comlink is a dependency of @anonaddy/omni-worker and may not be
        // hoisted to the consumer's root node_modules.
        const libPkgPath = createRequire(resolve(process.cwd(), 'x.js')).resolve(
          '@anonaddy/omni-worker/package.json'
        );
        const libDir = dirname(libPkgPath);
        const comlinkPath = resolve(
          libDir,
          'node_modules/comlink/dist/esm/comlink.mjs'
        );

        const result = await esbuild.build({
          stdin: {
            contents: fullSource,
            resolveDir: dirname(workerPath),
            sourcefile: workerPath,
            loader: 'ts', // .worker.ts is non-standard; explicitly use TypeScript loader
          },
          bundle: true,
          write: false, // Return in memory, don't write to disk
          format: 'esm',
          platform: 'neutral', // Keep code compatible with both browser and Node
          target,
          minify: false, // Let Vite handle minification
          sourcemap: (this as { config?: { command?: string } }).config?.command === 'serve' ? 'inline' : false,
          treeShaking: true,
          mainFields: ['browser', 'module', 'main'], // Required for platform: 'neutral' to resolve comlink
          alias: {
            comlink: comlinkPath,
          },
        });

        const outputFile = result.outputFiles?.[0];
        if (!outputFile) {
          throw new Error('esbuild produced no output');
        }
        bundled = Buffer.from(outputFile.text).toString('utf-8');
      } catch (error) {
        throw new OmniWorkerError(
          `Failed to build worker '${workerPath}'`,
          {
            code: OmniWorkerErrorCodes.BUILD_ERROR,
            workerPath,
            cause: error instanceof Error ? error : new Error(String(error)),
          }
        );
      }

      // Generate data URL for browser Worker mode
      const dataUrl = `data:text/javascript;base64,${Buffer.from(bundled).toString('base64')}`;

      // Return Vite module code that exports the bundled results
      return `// OmniWorker bundled worker — auto-generated by vite-omni-worker

// Raw bundled code for Node.js eval mode (createNodeWorker)
export const code = ${JSON.stringify(bundled)};

// Data URL for browser Worker mode (createWebWorker)
export const url = ${JSON.stringify(dataUrl)};

// Default export is the data URL (browser Worker)
export default url;
`;
    },
  };
}
