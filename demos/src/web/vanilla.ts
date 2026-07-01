/**
 * Vanilla JS Demo Component
 *
 * Pure DOM-manipulation demo that exercises the omni-worker library in the
 * browser. Uses shared logic from `demoLogic.ts` for task generation,
 * execution, and timing — only rendering is framework-specific.
 *
 * @module demos/web/vanilla
 */

import {
  createDemoWorker,
  createDemoPool,
  generateTasks,
  runSequential,
  runParallel,
  type ExecutionSummary,
} from '../shared/demoLogic';

// ---------------------------------------------------------------------------
// DOM helpers
// ---------------------------------------------------------------------------

/**
 * Clear the container and create all demo UI elements.
 *
 * @param container - The host element (usually `#vanilla-panel`).
 */
export function initVanillaDemo(container: HTMLElement): void {
  container.innerHTML = '';

  // --- Header ---
  const header = document.createElement('div');
  header.className = 'demo-header';
  header.textContent = 'Vanilla JS Demo';
  container.appendChild(header);

  // --- Controls ---
  const controls = document.createElement('div');
  controls.className = 'demo-controls';

  const btnSeq = document.createElement('button');
  btnSeq.className = 'btn btn-primary';
  btnSeq.textContent = 'Run Sequential';

  const btnPar = document.createElement('button');
  btnPar.className = 'btn btn-secondary';
  btnPar.textContent = 'Run Parallel (Pool of 4)';

  controls.appendChild(btnSeq);
  controls.appendChild(btnPar);
  container.appendChild(controls);

  // --- Loading indicator ---
  const loading = document.createElement('div');
  loading.className = 'loading';
  loading.textContent = '';
  container.appendChild(loading);

  // --- Results table ---
  const table = document.createElement('table');
  table.className = 'results-table';

  const thead = document.createElement('thead');
  const headerRow = document.createElement('tr');
  for (const label of ['#', 'Duration', 'Timing', 'Status']) {
    const th = document.createElement('th');
    th.textContent = label;
    headerRow.appendChild(th);
  }
  thead.appendChild(headerRow);
  table.appendChild(thead);

  const tbody = document.createElement('tbody');
  table.appendChild(tbody);
  container.appendChild(table);

  // --- Summary ---
  const summary = document.createElement('div');
  summary.className = 'summary';
  summary.innerHTML = '';
  container.appendChild(summary);

  // ---------------------------------------------------------------------------
  // Event handlers
  // ---------------------------------------------------------------------------

  /**
   * Set UI into loading state (disable buttons, show spinner text).
   *
   * When entering loading state (`isLoading: true`) the previous results
   * table body is cleared so stale data isn't displayed alongside the
   * spinner.
   */
  function setLoading(isLoading: boolean): void {
    btnSeq.disabled = isLoading;
    btnPar.disabled = isLoading;
    loading.textContent = isLoading ? 'Running...' : '';
    if (isLoading) {
      tbody.innerHTML = '';
      summary.innerHTML = '';
    }
  }

  /**
   * Render an `ExecutionSummary` into the results table and summary area.
   *
   * @param data - The execution summary to render.
   */
  function renderResults(data: ExecutionSummary): void {
    const maxDuration = Math.max(...data.results.map((r) => r.durationMs), 1);

    tbody.innerHTML = '';
    for (const result of data.results) {
      const tr = document.createElement('tr');

      // Task ID
      const tdId = document.createElement('td');
      tdId.textContent = `Task ${result.taskId}`;
      tr.appendChild(tdId);

      // Duration
      const tdDuration = document.createElement('td');
      tdDuration.textContent = `${result.durationMs}ms`;
      tr.appendChild(tdDuration);

      // Timing bar
      const tdBar = document.createElement('td');
      const barContainer = document.createElement('div');
      barContainer.className = 'timing-bar';

      const fill = document.createElement('div');
      const pct = Math.min((result.durationMs / maxDuration) * 100, 100);
      fill.className = `fill task-${(result.taskId % 8) + 1}`;
      fill.style.width = `${pct}%`;

      barContainer.appendChild(fill);
      tdBar.appendChild(barContainer);
      tr.appendChild(tdBar);

      // Status badge
      const tdStatus = document.createElement('td');
      const badge = document.createElement('span');
      badge.className = `status-badge ${result.status}`;
      badge.textContent = result.status;
      tdStatus.appendChild(badge);
      tr.appendChild(tdStatus);

      tbody.appendChild(tr);
    }

    // Summary section
    summary.innerHTML = '';

    const pWall = document.createElement('p');
    pWall.innerHTML =
      `<span class="label">Wall-clock:</span> ` +
      `<span class="value">${Math.round(data.wallClockMs)}ms</span>`;
    summary.appendChild(pWall);

    const pTotal = document.createElement('p');
    pTotal.innerHTML =
      `<span class="label">Total task time:</span> ` +
      `<span class="value">${Math.round(data.totalTaskMs)}ms</span>`;
    summary.appendChild(pTotal);

    if (data.speedup !== undefined) {
      const pSpeedup = document.createElement('p');
      pSpeedup.innerHTML =
        `<span class="label">Speedup:</span> ` +
        `<span class="value">${data.speedup.toFixed(1)}x</span>`;
      summary.appendChild(pSpeedup);
    }
  }

  /**
   * Handler for "Run Sequential".
   */
  async function handleSequential(): Promise<void> {
    const worker = createDemoWorker();
    setLoading(true);

    try {
      const tasks = generateTasks(8);
      const result = await runSequential(worker, tasks);
      renderResults(result);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      showError(errMsg);
    } finally {
      await worker.destroy();
      setLoading(false);
    }
  }

  /**
   * Handler for "Run Parallel (Pool of 4)".
   */
  async function handleParallel(): Promise<void> {
    const pool = createDemoPool(4);
    setLoading(true);

    try {
      const tasks = generateTasks(8);
      const result = await runParallel(pool, tasks);

      // Store sequential reference for speedup (run a quick sequential
      // comparison against the same tasks — but since tasks have random
      // delays we store the parallel result and show speedup relative to
      // total task time as a heuristic).
      const heuristicSpeedup = result.totalTaskMs / Math.max(result.wallClockMs, 1);
      result.speedup = heuristicSpeedup;

      renderResults(result);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      showError(errMsg);
    } finally {
      await pool.destroy();
      setLoading(false);
    }
  }

  /**
   * Display an error message in the summary area.
   *
   * @param message - The error text to display.
   */
  function showError(message: string): void {
    summary.innerHTML = '';
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.textContent = `Error: ${message}`;
    summary.appendChild(errorDiv);
  }

  btnSeq.addEventListener('click', handleSequential);
  btnPar.addEventListener('click', handleParallel);
}
