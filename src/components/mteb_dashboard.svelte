<script lang="ts">
  import { onMount } from 'svelte';
  import type { ModelRanking, TaskKey, FilterState } from '../lib/types/mteb';
  import { formatScore, logoForModel } from '../lib/types/mteb';
  import {
    alignTasksForCompare,
    dimSourceLabel,
    filterModels,
    modelsByIds,
    priceSourceLabel,
    tasksUnavailableForCompare,
  } from '../lib/mteb_filter';

  interface Props {
    models: ModelRanking[];
    baseUrl?: string;
  }

  let { models, baseUrl = '/' }: Props = $props();

  let filter: FilterState = $state({
    task: 'retrieval',
    open_only: false,
    dim_max: null,
    price_band: null,
    search: '',
    sort: 'avg_score',
  });

  let compareIds: string[] = $state([]);
  let chartCanvas: HTMLCanvasElement | undefined = $state();
  let chartInstance: { destroy: () => void } | null = null;

  const base = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;

  function filteredModels(): ModelRanking[] {
    return filterModels(models, filter);
  }

  function resetFilters() {
    filter = {
      task: 'retrieval',
      open_only: false,
      dim_max: null,
      price_band: null,
      search: '',
      sort: 'avg_score',
    };
    compareIds = [];
  }

  function toggleCompare(id: string) {
    if (compareIds.includes(id)) {
      compareIds = compareIds.filter((x) => x !== id);
    } else if (compareIds.length < 4) {
      compareIds = [...compareIds, id];
    }
  }

  function compareModels(): ModelRanking[] {
    return modelsByIds(models, compareIds);
  }

  function alignedTasks(): TaskKey[] {
    return alignTasksForCompare(compareModels());
  }

  function unavailableTasks(): TaskKey[] {
    return tasksUnavailableForCompare(compareModels());
  }

  async function loadChart(): Promise<typeof import('chart.js').Chart | null> {
    if (typeof window === 'undefined') return null;
    const w = window as unknown as { Chart?: typeof import('chart.js').Chart };
    if (w.Chart) return w.Chart;
    await new Promise<void>((resolve, reject) => {
      const s = document.createElement('script');
      s.src = `${base}vendor/chart.umd.min.js`;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error('Chart.js load failed'));
      document.head.appendChild(s);
    });
    return (window as unknown as { Chart: typeof import('chart.js').Chart }).Chart;
  }

  async function renderChart() {
    if (!chartCanvas || compareModels().length < 2) {
      chartInstance?.destroy();
      chartInstance = null;
      return;
    }
    const Chart = await loadChart();
    if (!Chart) return;
    chartInstance?.destroy();
    const selected = compareModels();
    const task = filter.task;
    const labels = selected.map((m) => m.model_id.split('/').pop() ?? m.model_id);
    const data = selected.map((m) => m.tasks[task] ?? 0);
    chartInstance = new Chart(chartCanvas.getContext('2d')!, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: task,
          data,
          backgroundColor: 'rgba(99, 102, 241, 0.6)',
          borderColor: 'rgba(30, 30, 40, 0.8)',
          borderWidth: 1,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true } },
      },
    });
  }

  $effect(() => {
    filteredModels();
    compareIds;
    filter.task;
    void renderChart();
  });

  onMount(() => () => chartInstance?.destroy());
</script>

<div class="card section-band dashboard-island">
  <div class="sec-head">
    <h2>Filter &amp; compare</h2>
    <button type="button" class="picker-opt" onclick={resetFilters}>Reset filters</button>
  </div>

  <div class="picker-options filter-row">
    <label for="mteb-filter-task">
      Task
      <select id="mteb-filter-task" name="task" bind:value={filter.task}>
        <option value="retrieval">Retrieval</option>
        <option value="clustering">Clustering</option>
        <option value="classification">Classification</option>
        <option value="sts">STS</option>
      </select>
    </label>
    <label for="mteb-filter-search">
      Search
      <input id="mteb-filter-search" name="search" type="search" bind:value={filter.search} placeholder="model id…" />
    </label>
    <label for="mteb-filter-open">
      <input id="mteb-filter-open" name="open_only" type="checkbox" bind:checked={filter.open_only} /> Open only
    </label>
    <label for="mteb-filter-dim">
      Max dim
      <input id="mteb-filter-dim" name="dim_max" type="number" bind:value={filter.dim_max} placeholder="any" min="0" />
    </label>
    <label for="mteb-filter-price">
      Price
      <select id="mteb-filter-price" name="price_band" bind:value={filter.price_band}>
        <option value={null}>Any</option>
        <option value="free">Free / unknown</option>
        <option value="paid">Paid API</option>
      </select>
    </label>
    <label for="mteb-filter-sort">
      Sort
      <select id="mteb-filter-sort" name="sort" bind:value={filter.sort}>
        <option value="avg_score">Avg score</option>
        <option value="task">Current task</option>
      </select>
    </label>
  </div>

  {#if filteredModels().length === 0}
    <p class="empty-state">No models match filters. <button type="button" class="link-btn" onclick={resetFilters}>Reset</button></p>
  {:else}
    <div class="table-scroll">
      <table class="data compare-table">
        <thead>
          <tr>
            <th>Compare</th>
            <th>Model</th>
            <th>Avg</th>
            <th>Retrieval</th>
            <th>Clustering</th>
            <th>Class.</th>
            <th>Dim</th>
            <th>Price</th>
          </tr>
        </thead>
        <tbody>
          {#each filteredModels() as m, i}
            <tr>
              <td>
                <input
                  type="checkbox"
                  checked={compareIds.includes(m.model_id)}
                  disabled={!compareIds.includes(m.model_id) && compareIds.length >= 4}
                  onchange={() => toggleCompare(m.model_id)}
                />
              </td>
              <td class="model-cell">
                {#if logoForModel(m.model_id)}
                  <img class="model-logo" src={`${base}img/logos/${logoForModel(m.model_id)}`} alt="" width="28" height="28" />
                {/if}
                <span class="mono">{m.model_id}</span>
              </td>
              <td><strong>{formatScore(m.avg_score, 2)}</strong></td>
              <td>{formatScore(m.tasks.retrieval)}</td>
              <td>{formatScore(m.tasks.clustering)}</td>
              <td>{formatScore(m.tasks.classification)}</td>
              <td>
                {#if m.embedding_dim != null}
                  <span class="badge">{m.embedding_dim}</span>
                  {#if dimSourceLabel(m.dim_source)}
                    <span class="badge badge-src" title="Aggregator source">{dimSourceLabel(m.dim_source)}</span>
                  {/if}
                {:else}—{/if}
              </td>
              <td>
                {#if m.price_input_per_mtok != null}
                  <span class="badge">${m.price_input_per_mtok.toFixed(4)}</span>
                  {#if priceSourceLabel(m.price_source)}
                    <span class="badge badge-src" title="Aggregator source">{priceSourceLabel(m.price_source)}</span>
                  {/if}
                {:else}—{/if}
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}

  {#if compareIds.length >= 2}
    <div class="compare-panel">
      <h3>Comparison ({compareIds.length} models)</h3>
      <div class="table-scroll">
        <table class="data">
          <thead>
            <tr>
              <th>Model</th>
              {#each alignedTasks() as t}
                <th>{t}</th>
              {/each}
              {#if alignedTasks().length === 0}
                <th>No shared tasks</th>
              {/if}
            </tr>
          </thead>
          <tbody>
            {#each compareModels() as m}
              <tr>
                <td class="mono">{m.model_id.split('/').pop()}</td>
                {#each alignedTasks() as t}
                  <td>{formatScore(m.tasks[t as TaskKey])}</td>
                {/each}
                {#if alignedTasks().length === 0}
                  <td>—</td>
                {/if}
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
      <div class="chart-wrap" style="height:280px">
        <canvas bind:this={chartCanvas}></canvas>
      </div>
      {#if unavailableTasks().length > 0}
        <p class="muted-small">
          Tasks without scores for all selected models:
          {#each unavailableTasks() as t}
            <span class="badge badge-warn">{t}: unavailable</span>
          {/each}
        </p>
      {/if}
    </div>
  {/if}
</div>

<style>
  .filter-row {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    margin-bottom: 16px;
    align-items: end;
  }
  .filter-row label {
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-size: 0.8rem;
  }
  .empty-state { padding: 24px; text-align: center; color: var(--muted); }
  .link-btn { background: none; border: none; color: var(--accent); cursor: pointer; text-decoration: underline; }
  .badge { font-size: 0.7rem; padding: 2px 6px; border-radius: 4px; background: rgba(99,102,241,0.15); }
  .badge-src { background: rgba(234,179,8,0.2); margin-left: 4px; }
  .badge-warn { background: rgba(239,68,68,0.15); margin-right: 4px; }
  .compare-panel { margin-top: 20px; }
  .muted-small { font-size: 0.75rem; color: var(--muted); margin-top: 8px; }
  .table-scroll { overflow-x: auto; }
  @media (max-width: 768px) {
    .compare-table th:nth-child(5),
    .compare-table td:nth-child(5),
    .compare-table th:nth-child(6),
    .compare-table td:nth-child(6),
    .compare-table th:nth-child(8),
    .compare-table td:nth-child(8) { display: none; }
    .model-cell .mono { font-size: 0.72rem; }
    .filter-row label { min-width: 45%; }
  }
</style>
