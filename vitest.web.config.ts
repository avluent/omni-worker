import { defineConfig } from 'vitest/config';
import { readFileSync } from 'node:fs';

/**
 * Workaround for esbuild JSDoc parsing issue.
 * esbuild 0.24 treats JSDoc content as TypeScript code,
 * causing parse errors with certain patterns in comments.
 * This plugin sanitizes problematic JSDoc before esbuild processes it.
 */
const jsdocFixPlugin = {
  name: 'jsdoc-fix',
  enforce: 'pre',
  load(id) {
    if (id.endsWith('.ts') || id.endsWith('.tsx') || id.endsWith('.mts')) {
      try {
        let code = readFileSync(id, 'utf-8');

        // Fix 1: Replace JSDoc @example blocks with simplified content
        code = code.replace(
          /(@example\s*\n\s*\* ```typescript)[\s\S]*?(\* ```)/g,
          '$1\n * (example omitted)\n$2'
        );

        // Fix 2: Replace @default tags that contain glob patterns with brackets
        // e.g., @default ['**/*.worker.ts'] -> @default Array of strings
        code = code.replace(
          /(@default\s+)[\[\]]*['"][^'"]*['"]/g,
          '$1[string[]]'
        );

        // Fix 3: Replace @default with just [] (empty array default)
        code = code.replace(/(@default\s+)\[\]/g, '$1[]');

        if (code !== readFileSync(id, 'utf-8')) {
          return code;
        }
      } catch {
        // Ignore read errors
      }
    }
    return undefined;
  },
};

export default defineConfig({
  plugins: [jsdocFixPlugin],
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['__tests__/web/**/*.test.ts'],
  },
});
