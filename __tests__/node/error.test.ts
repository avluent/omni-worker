/**
 * Tests for the OmniWorkerError class and error codes.
 *
 * Validates:
 * - All 8 error codes are defined
 * - Constructor sets all properties correctly
 * - Error extends native Error
 * - Stack trace capture works
 * - toString() formatting
 * - Cause chaining
 * - Optional properties
 */

import { describe, it, expect } from 'vitest';
import {
  OmniWorkerError,
  OmniWorkerErrorCodes,
  type OmniWorkerErrorCode,
} from '../../src/runtime/error';

describe('OmniWorkerErrorCodes', () => {
  it('defines all 8 required error codes', () => {
    const expectedCodes = [
      'WORKER_CREATE_FAILED',
      'WORKER_ALREADY_DESTROYED',
      'WORKER_NOT_FOUND',
      'INVALID_POOL_COUNT',
      'UNSUPPORTED_ENVIRONMENT',
      'MISSING_API_EXPORT',
      'BUILD_ERROR',
      'UNSUPPORTED_PLATFORM',
    ];

    for (const code of expectedCodes) {
      expect(Object.values(OmniWorkerErrorCodes)).toContain(code);
    }

    expect(Object.keys(OmniWorkerErrorCodes)).toHaveLength(8);
  });

  it('each code value matches its key name', () => {
    expect(OmniWorkerErrorCodes.WORKER_CREATE_FAILED).toBe('WORKER_CREATE_FAILED');
    expect(OmniWorkerErrorCodes.WORKER_ALREADY_DESTROYED).toBe('WORKER_ALREADY_DESTROYED');
    expect(OmniWorkerErrorCodes.WORKER_NOT_FOUND).toBe('WORKER_NOT_FOUND');
    expect(OmniWorkerErrorCodes.INVALID_POOL_COUNT).toBe('INVALID_POOL_COUNT');
    expect(OmniWorkerErrorCodes.UNSUPPORTED_ENVIRONMENT).toBe('UNSUPPORTED_ENVIRONMENT');
    expect(OmniWorkerErrorCodes.MISSING_API_EXPORT).toBe('MISSING_API_EXPORT');
    expect(OmniWorkerErrorCodes.BUILD_ERROR).toBe('BUILD_ERROR');
    expect(OmniWorkerErrorCodes.UNSUPPORTED_PLATFORM).toBe('UNSUPPORTED_PLATFORM');
  });

  it('is a const object (all values are strings)', () => {
    for (const value of Object.values(OmniWorkerErrorCodes)) {
      expect(typeof value).toBe('string');
    }
  });
});

describe('OmniWorkerError', () => {
  describe('constructor', () => {
    it('extends native Error class', () => {
      const err = new OmniWorkerError('test message', {
        code: OmniWorkerErrorCodes.WORKER_CREATE_FAILED,
      });

      expect(err).toBeInstanceOf(Error);
      expect(err).toBeInstanceOf(OmniWorkerError);
    });

    it('sets the error name to "OmniWorkerError"', () => {
      const err = new OmniWorkerError('test message', {
        code: OmniWorkerErrorCodes.WORKER_CREATE_FAILED,
      });

      expect(err.name).toBe('OmniWorkerError');
    });

    it('sets the message from the first argument', () => {
      const message = 'Failed to create worker';
      const err = new OmniWorkerError(message, {
        code: OmniWorkerErrorCodes.WORKER_CREATE_FAILED,
      });

      expect(err.message).toBe(message);
    });

    it('sets the code property', () => {
      const err = new OmniWorkerError('test', {
        code: OmniWorkerErrorCodes.BUILD_ERROR,
      });

      expect(err.code).toBe('BUILD_ERROR');
    });

    it('sets the cause property when provided', () => {
      const originalError = new Error('original failure');
      const err = new OmniWorkerError('wrapped message', {
        code: OmniWorkerErrorCodes.WORKER_CREATE_FAILED,
        cause: originalError,
      });

      expect(err.cause).toBe(originalError);
    });

    it('leaves cause undefined when not provided', () => {
      const err = new OmniWorkerError('test', {
        code: OmniWorkerErrorCodes.WORKER_NOT_FOUND,
      });

      expect(err.cause).toBeUndefined();
    });

    it('sets the workerPath property when provided', () => {
      const err = new OmniWorkerError('test', {
        code: OmniWorkerErrorCodes.WORKER_NOT_FOUND,
        workerPath: './my.worker.ts',
      });

      expect(err.workerPath).toBe('./my.worker.ts');
    });

    it('leaves workerPath undefined when not provided', () => {
      const err = new OmniWorkerError('test', {
        code: OmniWorkerErrorCodes.INVALID_POOL_COUNT,
      });

      expect(err.workerPath).toBeUndefined();
    });

    it('captures a stack trace', () => {
      const err = new OmniWorkerError('test', {
        code: OmniWorkerErrorCodes.WORKER_CREATE_FAILED,
      });

      expect(err.stack).toBeDefined();
      expect(typeof err.stack).toBe('string');
      expect(err.stack).toContain('OmniWorkerError');
    });

    it('captures a stack trace that includes the test call site', () => {
      const err = new OmniWorkerError('stack test', {
        code: OmniWorkerErrorCodes.WORKER_CREATE_FAILED,
      });

      // The stack should reference the file this test lives in
      expect(err.stack).toContain('error.test.ts');
    });

    it('code property is set correctly and accessible', () => {
      const err = new OmniWorkerError('test', {
        code: OmniWorkerErrorCodes.WORKER_CREATE_FAILED,
        cause: new Error('cause'),
        workerPath: './test.ts',
      });

      expect(err.code).toBe('WORKER_CREATE_FAILED');
      expect(err.cause).toBeInstanceOf(Error);
      expect(err.workerPath).toBe('./test.ts');
    });
  });

  describe('toString()', () => {
    it('formats error with code and message only', () => {
      const err = new OmniWorkerError('something went wrong', {
        code: OmniWorkerErrorCodes.INVALID_POOL_COUNT,
      });

      expect(err.toString()).toBe(
        '[OmniWorkerError:INVALID_POOL_COUNT] something went wrong'
      );
    });

    it('includes workerPath in output when present', () => {
      const err = new OmniWorkerError('worker not found', {
        code: OmniWorkerErrorCodes.WORKER_NOT_FOUND,
        workerPath: './missing.worker.ts',
      });

      expect(err.toString()).toBe(
        '[OmniWorkerError:WORKER_NOT_FOUND] worker not found (worker: ./missing.worker.ts)'
      );
    });

    it('includes cause message in output when present', () => {
      const cause = new Error('net connection refused');
      const err = new OmniWorkerError('create failed', {
        code: OmniWorkerErrorCodes.WORKER_CREATE_FAILED,
        cause,
      });

      expect(err.toString()).toBe(
        '[OmniWorkerError:WORKER_CREATE_FAILED] create failed | Cause: net connection refused'
      );
    });

    it('includes both workerPath and cause when both present', () => {
      const cause = new Error('ESM not supported');
      const err = new OmniWorkerError('build failed', {
        code: OmniWorkerErrorCodes.BUILD_ERROR,
        cause,
        workerPath: './bad.worker.ts',
      });

      expect(err.toString()).toBe(
        '[OmniWorkerError:BUILD_ERROR] build failed (worker: ./bad.worker.ts) | Cause: ESM not supported'
      );
    });

    it('formats each error code correctly', () => {
      const codes = Object.values(OmniWorkerErrorCodes);

      for (const code of codes) {
        const err = new OmniWorkerError('msg', { code });
        expect(err.toString()).toContain(`[${code}]`);
      }
    });
  });

  describe('error code type safety', () => {
    it('accepts all valid codes', () => {
      const validCodes: OmniWorkerErrorCode[] = Object.values(OmniWorkerErrorCodes);

      for (const code of validCodes) {
        const err = new OmniWorkerError('test', { code });
        expect(err.code).toBe(code);
      }
    });
  });

  describe('real-world usage patterns', () => {
    it('wraps a worker creation failure with cause', () => {
      const originalError = new Error('worker_threads not available');
      const workerPath = './heavy.worker.ts';

      const err = new OmniWorkerError(
        `Failed to create worker for '${workerPath}': ${originalError.message}`,
        {
          code: OmniWorkerErrorCodes.WORKER_CREATE_FAILED,
          cause: originalError,
          workerPath,
        }
      );

      expect(err).toBeInstanceOf(OmniWorkerError);
      expect(err.code).toBe('WORKER_CREATE_FAILED');
      expect(err.cause).toBe(originalError);
      expect(err.workerPath).toBe(workerPath);
      expect(err.toString()).toContain(workerPath);
      expect(err.toString()).toContain('worker_threads not available');
    });

    it('reports an already-destroyed worker', () => {
      const err = new OmniWorkerError(
        "Cannot call worker './proc.worker.ts': already destroyed",
        {
          code: OmniWorkerErrorCodes.WORKER_ALREADY_DESTROYED,
          workerPath: './proc.worker.ts',
        }
      );

      expect(err.code).toBe('WORKER_ALREADY_DESTROYED');
      expect(err.message).toContain('already destroyed');
    });

    it('reports invalid pool count', () => {
      const err = new OmniWorkerError('Pool count must be >= 1 and <= 1024, got: 0', {
        code: OmniWorkerErrorCodes.INVALID_POOL_COUNT,
      });

      expect(err.code).toBe('INVALID_POOL_COUNT');
      expect(err.cause).toBeUndefined();
      expect(err.workerPath).toBeUndefined();
    });

    it('reports unsupported environment', () => {
      const err = new OmniWorkerError(
        'OmniWorker requires Node.js 18+ or a modern browser',
        {
          code: OmniWorkerErrorCodes.UNSUPPORTED_ENVIRONMENT,
        }
      );

      expect(err.code).toBe('UNSUPPORTED_ENVIRONMENT');
    });

    it('reports missing API export', () => {
      const err = new OmniWorkerError(
        "Worker file './bad.worker.ts' must export an 'api' object containing your functions",
        {
          code: OmniWorkerErrorCodes.MISSING_API_EXPORT,
          workerPath: './bad.worker.ts',
        }
      );

      expect(err.code).toBe('MISSING_API_EXPORT');
      expect(err.workerPath).toBe('./bad.worker.ts');
    });

    it('reports build error with cause', () => {
      const buildErr = new Error('SyntaxError: unexpected token');
      const err = new OmniWorkerError(
        `Failed to build worker './my.worker.ts': ${buildErr.message}`,
        {
          code: OmniWorkerErrorCodes.BUILD_ERROR,
          cause: buildErr,
          workerPath: './my.worker.ts',
        }
      );

      expect(err.code).toBe('BUILD_ERROR');
      expect(err.cause).toBe(buildErr);
    });

    it('reports unsupported platform', () => {
      const err = new OmniWorkerError(
        "Platform 'node' version '14.0.0' is not supported. Minimum: 18.0.0",
        {
          code: OmniWorkerErrorCodes.UNSUPPORTED_PLATFORM,
        }
      );

      expect(err.code).toBe('UNSUPPORTED_PLATFORM');
    });
  });

  describe('throwing and catching', () => {
    it('can be thrown and caught as OmniWorkerError', () => {
      expect(() => {
        throw new OmniWorkerError('test throw', {
          code: OmniWorkerErrorCodes.WORKER_NOT_FOUND,
        });
      }).toThrow(OmniWorkerError);
    });

    it('can be caught as generic Error', () => {
      expect(() => {
        throw new OmniWorkerError('test throw', {
          code: OmniWorkerErrorCodes.WORKER_NOT_FOUND,
        });
      }).toThrow(Error);
    });

    it('preserves error properties after throw/catch', () => {
      try {
        throw new OmniWorkerError('caught test', {
          code: OmniWorkerErrorCodes.MISSING_API_EXPORT,
          workerPath: './test.worker.ts',
        });
      } catch (e) {
        expect(e).toBeInstanceOf(OmniWorkerError);
        const err = e as OmniWorkerError;
        expect(err.code).toBe('MISSING_API_EXPORT');
        expect(err.workerPath).toBe('./test.worker.ts');
        expect(err.message).toBe('caught test');
      }
    });
  });
});
