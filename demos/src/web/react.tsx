/**
 * React Demo Component
 *
 * A React-based demo panel that exercises the omni-worker library in the
 * browser. Uses shared logic from `demoLogic.ts` for task generation,
 * execution, and timing — only rendering is framework-specific.
 *
 * State is managed via `useState`; worker/pool lifecycle is tracked via
 * `useRef` and cleaned up in `useEffect` on component unmount.
 *
 * @module demos/web/react
 */

import { useState, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import {
  type IOmniWorker,
  type IOmniWorkerPool,
} from '@anonaddy/omni-worker';
import {
  createDemoWorker,
  createDemoPool,
  generateTasks,
  runSequential,
  runParallel,
  type TaskResult,
  type ExecutionSummary,
  type ComputeApi,
} from '../shared/demoLogic';

// ---------------------------------------------------------------------------
// React Demo Component
// ---------------------------------------------------------------------------

/**
 * The main React demo component.
 *
 * Renders two buttons (sequential / parallel), a results table with timing
 * bars, and a summary section with wall-clock time, total task time, and
 * speedup factor.
 */
function ReactDemo(): JSX.Element {
  const [results, setResults] = useState<TaskResult[]>([]);
  const [summary, setSummary] = useState<ExecutionSummary | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Store the most-recently-created worker/pool so we can destroy it on
  // unmount if the component is removed mid-execution.
  const activeWorkerRef = useRef<IOmniWorker<ComputeApi> | IOmniWorkerPool<ComputeApi> | null>(null);

  // -----------------------------------------------------------------------
  // Cleanup on unmount
  // -----------------------------------------------------------------------

  useEffect(() => {
    return () => {
      if (activeWorkerRef.current) {
        activeWorkerRef.current.destroy().catch(() => {
          // Silence destroy errors during unmount — the component is gone.
        });
        activeWorkerRef.current = null;
      }
    };
  }, []);

  // -----------------------------------------------------------------------
  // Run handlers
  // -----------------------------------------------------------------------

  const handleSequential = async () => {
    const worker = createDemoWorker();
    activeWorkerRef.current = worker;

    try {
      setLoading(true);
      setError(null);
      const tasks = generateTasks(8);
      const result = await runSequential(worker, tasks);
      setSummary(result);
      setResults(result.results);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      setError(errMsg);
    } finally {
      setLoading(false);
      await worker.destroy();
      activeWorkerRef.current = null;
    }
  };

  const handleParallel = async () => {
    const pool = createDemoPool(4);
    activeWorkerRef.current = pool;

    try {
      setLoading(true);
      setError(null);
      const tasks = generateTasks(8);
      const result = await runParallel(pool, tasks);

      // Heuristic speedup: total task time / wall-clock time
      const heuristicSpeedup = result.totalTaskMs / Math.max(result.wallClockMs, 1);
      result.speedup = heuristicSpeedup;

      setSummary(result);
      setResults(result.results);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      setError(errMsg);
    } finally {
      setLoading(false);
      await pool.destroy();
      activeWorkerRef.current = null;
    }
  };

  // -----------------------------------------------------------------------
  // Rendering helpers
  // -----------------------------------------------------------------------

  const maxDuration =
    results.length > 0 ? Math.max(...results.map((r) => r.durationMs), 1) : 1;

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  return (
    <div className="react-demo">
      {/* Header */}
      <div className="demo-header">React Demo</div>

      {/* Controls */}
      <div className="demo-controls">
        <button
          className="btn btn-primary"
          disabled={loading}
          onClick={handleSequential}
          type="button"
        >
          Run Sequential
        </button>
        <button
          className="btn btn-secondary"
          disabled={loading}
          onClick={handleParallel}
          type="button"
        >
          Run Parallel (Pool of 4)
        </button>
      </div>

      {/* Loading indicator */}
      {loading && <div className="loading">Running...</div>}

      {/* Error message */}
      {error && (
        <div className="error-message">
          <span style={{ color: '#721c24' }}>Error: {error}</span>
        </div>
      )}

      {/* Results table */}
      <table className="results-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Duration</th>
            <th>Timing</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {results.map((result) => {
            const pct = Math.min((result.durationMs / maxDuration) * 100, 100);
            const taskClass = `task-${(result.taskId % 8) + 1}`;

            return (
              <tr key={result.taskId}>
                <td>Task {result.taskId}</td>
                <td>{result.durationMs}ms</td>
                <td>
                  <div className="timing-bar">
                    <div
                      className={`fill ${taskClass}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </td>
                <td>
                  <span className={`status-badge ${result.status}`}>
                    {result.status}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Summary section */}
      {summary && (
        <div className="summary">
          <p>
            <span className="label">Wall-clock:</span>{' '}
            <span className="value">
              {Math.round(summary.wallClockMs)}ms
            </span>
          </p>
          <p>
            <span className="label">Total task time:</span>{' '}
            <span className="value">
              {Math.round(summary.totalTaskMs)}ms
            </span>
          </p>
          {summary.speedup !== undefined && (
            <p>
              <span className="label">Speedup:</span>{' '}
              <span className="value">
                {summary.speedup.toFixed(1)}x
              </span>
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Mount the React demo into the given container element.
 *
 * Uses `ReactDOM.createRoot` (React 18+ concurrent rendering) to render
 * the `ReactDemo` component into the supplied `HTMLElement`.
 *
 * @param container - The host element (usually `#react-panel`).
 */
export function initReactDemo(container: HTMLElement): void {
  const root = createRoot(container);
  root.render(<ReactDemo />);
}
