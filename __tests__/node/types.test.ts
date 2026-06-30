/**
 * Runtime tests for type definition exports and module structure.
 *
 * Validates that all type definitions are properly exported
 * and that the barrel export from src/types works correctly.
 */

import { describe, it, expect } from 'vitest';
import * as types from '../../src/types';
import * as helpers from '../../src/types/helpers';
import * as worker from '../../src/types/worker';
import * as pool from '../../src/types/pool';
import * as vite from '../../src/types/vite';

describe('Type Definitions', () => {
  describe('Barrel export (src/types/index)', () => {
    it('re-exports all type names', () => {
      // These exports exist (as empty objects at runtime since they're types),
      // but the presence of the named exports proves the module structure is correct.
      expect(Object.keys(types)).toContain('Promisify');
      expect(Object.keys(types)).toContain('AsyncFn');
      expect(Object.keys(types)).toContain('IOmniWorker');
      expect(Object.keys(types)).toContain('IOmniWorkerPool');
      expect(Object.keys(types)).toContain('PoolOptions');
      expect(Object.keys(types)).toContain('VitePluginOptions');
    });

    it('re-exports exactly the expected types (no extras, no missing)', () => {
      const expectedExports = [
        'Promisify',
        'AsyncFn',
        'IOmniWorker',
        'IOmniWorkerPool',
        'PoolOptions',
        'VitePluginOptions',
      ];
      const actualExports = Object.keys(types).sort();
      const expectedSorted = expectedExports.sort();
      expect(actualExports).toEqual(expectedSorted);
    });
  });

  describe('helpers module', () => {
    it('exports Promisify', () => {
      expect('Promisify' in helpers).toBe(true);
    });

    it('exports AsyncFn', () => {
      expect('AsyncFn' in helpers).toBe(true);
    });
  });

  describe('worker module', () => {
    it('exports IOmniWorker', () => {
      expect('IOmniWorker' in worker).toBe(true);
    });
  });

  describe('pool module', () => {
    it('exports PoolOptions', () => {
      expect('PoolOptions' in pool).toBe(true);
    });

    it('exports IOmniWorkerPool', () => {
      expect('IOmniWorkerPool' in pool).toBe(true);
    });
  });

  describe('vite module', () => {
    it('exports VitePluginOptions', () => {
      expect('VitePluginOptions' in vite).toBe(true);
    });
  });
});
