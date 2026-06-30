# Non-Functional Requirement: NFR005 — Error Handling and Diagnostics

## ID
NFR005

## Title
Error Handling and Diagnostics

## Category
Non-Functional — Reliability

## Created
2026-06-30T00:00:00.000Z

## Last Updated
2026-06-30T00:00:00.000Z

## Description
As a **developer using this library**, I would like **clear, actionable error messages at every failure point**, in order to **debug issues quickly without guessing what went wrong**.

## Definition of Done
- [ ] All library-thrown errors are instances of `OmniWorkerError`
- [ ] `OmniWorkerError` includes: message, code (string identifier), cause (original error)
- [ ] Build-time errors (Vite plugin) produce clear Vite error output with file path
- [ ] Runtime errors include context: worker path, operation being performed
- [ ] Worker-internal errors propagate to main thread with preserved stack trace
- [ ] No silent failures — every error path is handled and reported

## Priority
2 (High)

## Specification

### Error Class

```
┌──────────────────────────────────────────────────────────────────┐
│  class OmniWorkerError extends Error                             │
│                                                                  │
│  Properties:                                                     │
│    message: string    — Human-readable description              │
│    code: string       — Machine-readable error code             │
│    cause: Error?      — Original error (if wrapping)            │
│    workerPath: string? — Path to worker file (if applicable)    │
│                                                                  │
│  Error Codes:                                                    │
│    WORKER_CREATE_FAILED     — Worker process couldn't start     │
│    WORKER_ALREADY_DESTROYED — Operation on dead worker          │
│    WORKER_NOT_FOUND         — Path doesn't resolve              │
│    INVALID_POOL_COUNT       — Pool count < 1 or too large       │
│    UNSUPPORTED_ENVIRONMENT  — Neither Node nor browser          │
│    MISSING_API_EXPORT       — Worker has no 'api' export        │
│    BUILD_ERROR              — esbuild compilation failed        │
│    UNSUPPORTED_PLATFORM     — Browser/Node version too old      │
└──────────────────────────────────────────────────────────────────┘
```

### Error Flow Matrix

| Error Origin | Detection Point | Error Delivery | Example Message |
|-------------|----------------|----------------|----------------|
| Worker file not found | Vite resolveId | Vite build error | `"Cannot resolve worker file: './missing.worker.ts'"` |
| esbuild compilation error | Vite load | Vite build error with diagnostics | `"Build failed for worker './my.worker.ts': SyntaxError: unexpected token"` |
| Missing `api` export | Vite load (post-bundle check) | Vite build error | `"Worker './my.worker.ts' must export an 'api' object"` |
| Worker creation fails | Runtime | `OmniWorkerError` | `"Failed to create worker for './my.worker.ts': Error: worker_threads not available"` |
| Worker crash | Runtime (Comlink error) | Rejected Promise | Original worker error, wrapped |
| Call on destroyed worker | Runtime | `OmniWorkerError` | `"Cannot use worker './my.worker.ts': already destroyed"` |
| Pool count invalid | Runtime | `OmniWorkerError` | `"Pool count must be >= 1, got: 0"` |
| Environment not supported | Runtime | `OmniWorkerError` | `"OmniWorker requires Node.js 18+ or a modern browser with Web Worker support"` |

### Build-Time Error Enhancements

The Vite plugin integrates with Vite's error reporting:

| Enhancement | Implementation |
|-------------|---------------|
| File path in error | Include resolved path in `this.error()` call |
| esbuild diagnostics | Map esbuild error locations to Vite's format |
| Color output | Vite's built-in color formatting |
| Stack trace | Vite provides module graph context |

### Runtime Error Enhancements

| Enhancement | Implementation |
|-------------|---------------|
| Error wrapping | `new OmniWorkerError(msg, { code, cause, workerPath })` |
| Stack preservation | Include `cause.stack` in message if available |
| Pool context | `"Worker 3 of 4 in pool './my.worker.ts' crashed"` |
| Recovery guidance | Include suggestion in message where applicable |

### Compliance

- **ISO/IEC 25010 (Reliability)**: Fault tolerance, detectability
- **Node.js Error Convention**: `cause` property per `Error` constructor options (Node 16+)

### Error Message Templates

| Code | Template |
|------|----------|
| `WORKER_CREATE_FAILED` | `"Failed to create worker for '{path}': {cause.message}"` |
| `WORKER_ALREADY_DESTROYED` | `"Cannot {action} worker '{path}': already destroyed"` |
| `INVALID_POOL_COUNT` | `"Pool count must be >= 1 and <= {max}, got: {count}"` |
| `UNSUPPORTED_ENVIRONMENT` | `"OmniWorker requires Node.js 18+ or a modern browser"` |
| `MISSING_API_EXPORT` | `"Worker file '{path}' must export an 'api' object containing your functions"` |
| `BUILD_ERROR` | `"Failed to build worker '{path}': {diagnostics}"` |
| `UNSUPPORTED_PLATFORM` | `"Platform '{platform}' version '{version}' is not supported. Minimum: {minimum}"` |

### Tests

| Test | Assertion |
|------|-----------|
| OmniWorkerError thrown | Error is instance of `OmniWorkerError` |
| Error code set | `error.code` matches expected string |
| Error cause preserved | `error.cause` is the original error |
| Build error for missing api | Vite build fails with MISSING_API_EXPORT |
| Build error for syntax error | esbuild error surfaced in Vite output |
| Worker create error | Descriptive message includes path |
| Destroyed worker error | Error mentions "already destroyed" |
| Pool count validation | Error for count < 1 |
| Unknown environment | Error for unsupported platform |
| Worker error propagation | Worker-side error caught as rejected Promise |
