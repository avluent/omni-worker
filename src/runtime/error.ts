/**
 * Error handling infrastructure for OmniWorker.
 *
 * Provides a structured custom error class with machine-readable codes,
 * optional cause chaining, and context information like worker file paths.
 *
 * @module runtime/error
 */

/** Machine-readable error codes for all failure modes */
export const OmniWorkerErrorCodes = {
  /** Worker process couldn't start */
  WORKER_CREATE_FAILED: 'WORKER_CREATE_FAILED',
  /** Operation attempted on an already destroyed worker */
  WORKER_ALREADY_DESTROYED: 'WORKER_ALREADY_DESTROYED',
  /** Worker file path doesn't resolve */
  WORKER_NOT_FOUND: 'WORKER_NOT_FOUND',
  /** Pool count < 1 or too large */
  INVALID_POOL_COUNT: 'INVALID_POOL_COUNT',
  /** Neither Node nor browser environment */
  UNSUPPORTED_ENVIRONMENT: 'UNSUPPORTED_ENVIRONMENT',
  /** Worker has no 'api' export */
  MISSING_API_EXPORT: 'MISSING_API_EXPORT',
  /** esbuild compilation failed */
  BUILD_ERROR: 'BUILD_ERROR',
  /** Browser/Node version too old */
  UNSUPPORTED_PLATFORM: 'UNSUPPORTED_PLATFORM',
} as const;

/** Union type of all valid error code strings */
export type OmniWorkerErrorCode = typeof OmniWorkerErrorCodes[keyof typeof OmniWorkerErrorCodes];

/** Options bag for constructing an {@link OmniWorkerError} */
export interface OmniWorkerErrorOptions {
  /** Machine-readable error code */
  code: OmniWorkerErrorCode;

  /** Original error that caused this error (optional) */
  cause?: Error;

  /** Path to the worker file that triggered this error (optional) */
  workerPath?: string;
}

/**
 * Custom error class for all OmniWorker failures.
 *
 * Provides structured error information with codes, causes, and context.
 * Extends the native `Error` class and supports the standard `cause` property
 * convention introduced in Node.js 16+.
 *
 * @example
 * ```ts
 * throw new OmniWorkerError(
 *   "Failed to create worker for './my.worker.ts'",
 *   { code: OmniWorkerErrorCodes.WORKER_CREATE_FAILED, workerPath: './my.worker.ts' }
 * );
 * ```
 */
export class OmniWorkerError extends Error {
  /** Machine-readable error code identifying the failure mode */
  public readonly code: OmniWorkerErrorCode;

  /** The original error that caused this error, if any */
  public readonly cause?: Error;

  /** Path to the worker file associated with this error, if any */
  public readonly workerPath?: string;

  /**
   * Create a new OmniWorkerError.
   *
   * @param message - Human-readable description of the error
   * @param options - Structured options including code, optional cause, and optional workerPath
   */
  constructor(message: string, options: OmniWorkerErrorOptions) {
    super(message);
    this.name = 'OmniWorkerError';
    this.code = options.code;
    this.cause = options.cause;
    this.workerPath = options.workerPath;

    // Maintain proper stack trace — works in both Node and browsers
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, OmniWorkerError);
    }
  }

  /**
   * Format error with all context for display.
   *
   * Produces output like:
   *   `[OmniWorkerError:WORKER_CREATE_FAILED] Failed to create worker (worker: ./my.worker.ts) | Cause: net error`
   *
   * @returns Formatted string representation of the error
   */
  public toString(): string {
    let str = `[OmniWorkerError:${this.code}] ${this.message}`;
    if (this.workerPath) {
      str += ` (worker: ${this.workerPath})`;
    }
    if (this.cause) {
      str += ` | Cause: ${this.cause.message}`;
    }
    return str;
  }
}
