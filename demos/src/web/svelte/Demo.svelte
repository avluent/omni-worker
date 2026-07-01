<script lang="ts">
  import { onDestroy } from 'svelte';
  import {
    type IOmniWorker,
    type IOmniWorkerPool,
  } from '@anonaddy/omni-worker';
  import {
    type ComputeApi,
    type TaskResult,
    type ExecutionSummary,
    createDemoWorker,
    createDemoPool,
    generateTasks,
    runSequential,
    runParallel,
  } from '../../shared/demoLogic';

  // ---------------------------------------------------------------------------
  // Reactive state
  // ---------------------------------------------------------------------------

  let results: TaskResult[] = [];
  let summary: ExecutionSummary | null = null;
  let loading = false;
  let error: string | null = null;
  let worker: IOmniWorker<ComputeApi> | null = null;
  let pool: IOmniWorkerPool<ComputeApi> | null = null;

  // ---------------------------------------------------------------------------
  // Cleanup on component destroy
  // ---------------------------------------------------------------------------

  onDestroy(async () => {
    if (worker) await worker.destroy();
    if (pool) await pool.destroy();
  });

  // ---------------------------------------------------------------------------
  // Run handlers
  // ---------------------------------------------------------------------------

  async function runSequentialHandler() {
    worker = createDemoWorker();
    try {
      loading = true;
      error = null;
      const tasks = generateTasks(8);
      summary = await runSequential(worker, tasks);
      results = summary.results;
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
    } finally {
      loading = false;
      await worker.destroy();
      worker = null;
    }
  }

  async function runParallelHandler() {
    pool = createDemoPool(4);
    try {
      loading = true;
      error = null;
      const tasks = generateTasks(8);
      summary = await runParallel(pool, tasks);

      // Heuristic speedup: total task time / wall-clock time
      const heuristicSpeedup = summary.totalTaskMs / Math.max(summary.wallClockMs, 1);
      summary.speedup = heuristicSpeedup;

      results = summary.results;
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
    } finally {
      loading = false;
      await pool.destroy();
      pool = null;
    }
  }

  // ---------------------------------------------------------------------------
  // Rendering helpers
  // ---------------------------------------------------------------------------

  $: maxDuration =
    results.length > 0 ? Math.max(...results.map((r) => r.durationMs), 1) : 1;
</script>

<div class="svelte-demo">
  <!-- Header -->
  <div class="demo-header">Svelte Demo</div>

  <!-- Controls -->
  <div class="demo-controls">
    <button
      class="btn btn-primary"
      disabled={loading}
      on:click={runSequentialHandler}
      type="button"
    >
      Run Sequential
    </button>
    <button
      class="btn btn-secondary"
      disabled={loading}
      on:click={runParallelHandler}
      type="button"
    >
      Run Parallel (Pool of 4)
    </button>
  </div>

  <!-- Loading indicator -->
  {#if loading}
    <div class="loading">Running...</div>
  {/if}

  <!-- Error message -->
  {#if error}
    <div class="error-message">
      <span style="color: #721c24">Error: {error}</span>
    </div>
  {/if}

  <!-- Results table -->
  <table class="results-table">
    <thead>
      <tr>
        <th>#</th>
        <th>Duration</th>
        <th>Timing</th>
        <th>Status</th>
      </tr>
    </thead>
    <tbody>
      {#if results.length > 0}
        {#each results as result (result.taskId)}
          {@const pct = Math.min((result.durationMs / maxDuration) * 100, 100)}
          {@const taskClass = `task-${(result.taskId % 8) + 1}`}
          <tr>
            <td>Task {result.taskId}</td>
            <td>{result.durationMs}ms</td>
            <td>
              <div class="timing-bar">
                <div class="fill {taskClass}" style="width: {pct}%" />
              </div>
            </td>
            <td>
              <span class="status-badge {result.status}">{result.status}</span>
            </td>
          </tr>
        {/each}
      {/if}
    </tbody>
  </table>

  <!-- Summary section -->
  {#if summary}
    <div class="summary">
      <p>
        <span class="label">Wall-clock:</span>
        <span class="value">{Math.round(summary.wallClockMs)}ms</span>
      </p>
      <p>
        <span class="label">Total task time:</span>
        <span class="value">{Math.round(summary.totalTaskMs)}ms</span>
      </p>
      {#if summary.speedup !== undefined}
        <p>
          <span class="label">Speedup:</span>
          <span class="value">{summary.speedup.toFixed(1)}x</span>
        </p>
      {/if}
    </div>
  {/if}
</div>
