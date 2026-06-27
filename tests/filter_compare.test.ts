import { describe, expect, it } from 'vitest';
import leaderboard from '../src/lib/data/mteb_de_leaderboard.json';
import {
  alignTasksForCompare,
  filterModels,
  modelsByIds,
  tasksUnavailableForCompare,
} from '../src/lib/mteb_filter';
import type { FilterState, LeaderboardSnapshot, ModelRanking } from '../src/lib/types/mteb';

const models = (leaderboard as LeaderboardSnapshot).models;

const sample: ModelRanking[] = [
  {
    model_id: 'org/a',
    avg_score: 60,
    tasks: { retrieval: 55, clustering: 50, classification: 70 },
    embedding_dim: 768,
    dim_source: 'hf_hub',
    price_input_per_mtok: 0,
    is_open: true,
  },
  {
    model_id: 'org/b',
    avg_score: 58,
    tasks: { retrieval: 52, clustering: null, classification: 68 },
    embedding_dim: 1024,
    price_input_per_mtok: 0.05,
    price_source: 'litellm',
    is_open: true,
  },
  {
    model_id: 'org/closed',
    avg_score: 55,
    tasks: { retrieval: 48, clustering: 44, classification: 65 },
    is_open: false,
  },
];

describe('filterModels', () => {
  it('filters open-only models', () => {
    const filter: FilterState = {
      task: 'retrieval',
      open_only: true,
      dim_max: null,
      price_band: null,
      search: '',
      sort: 'avg_score',
    };
    const result = filterModels(sample, filter);
    expect(result.map((m) => m.model_id)).toEqual(['org/a', 'org/b']);
  });

  it('filters by max embedding dimension', () => {
    const filter: FilterState = {
      task: 'retrieval',
      open_only: false,
      dim_max: 800,
      price_band: null,
      search: '',
      sort: 'avg_score',
    };
    const result = filterModels(sample, filter);
    expect(result.map((m) => m.model_id)).toEqual(['org/a', 'org/closed']);
  });

  it('filters paid API models', () => {
    const filter: FilterState = {
      task: 'retrieval',
      open_only: false,
      dim_max: null,
      price_band: 'paid',
      search: '',
      sort: 'avg_score',
    };
    expect(filterModels(sample, filter).map((m) => m.model_id)).toEqual(['org/b']);
  });

  it('sorts by current task score', () => {
    const filter: FilterState = {
      task: 'retrieval',
      open_only: false,
      dim_max: null,
      price_band: null,
      search: '',
      sort: 'task',
    };
    const result = filterModels(sample, filter);
    expect(result[0].model_id).toBe('org/a');
    expect(result[1].model_id).toBe('org/b');
  });

  it('returns empty list for impossible search', () => {
    const filter: FilterState = {
      task: 'retrieval',
      open_only: false,
      dim_max: null,
      price_band: null,
      search: 'nonexistent-model-xyz',
      sort: 'avg_score',
    };
    expect(filterModels(sample, filter)).toHaveLength(0);
  });

  it('completes within 1s for production dataset (SC-005)', () => {
    const filter: FilterState = {
      task: 'retrieval',
      open_only: false,
      dim_max: 4096,
      price_band: null,
      search: '',
      sort: 'task',
    };
    const start = performance.now();
    for (let i = 0; i < 200; i++) filterModels(models, filter);
    expect(performance.now() - start).toBeLessThan(1000);
  });
});

describe('compare alignment (SC-003)', () => {
  it('aligns tasks only when all selected models share scores', () => {
    const selected = modelsByIds(sample, ['org/a', 'org/b']);
    expect(alignTasksForCompare(selected)).toEqual(['retrieval', 'classification']);
    expect(tasksUnavailableForCompare(selected)).toContain('clustering');
  });

  it('returns shared tasks for two full-coverage models', () => {
    const full = models.filter((m) =>
      ['retrieval', 'clustering', 'classification'].every((t) => m.tasks[t as keyof typeof m.tasks] != null),
    );
    const pair = modelsByIds(full, [full[0].model_id, full[1].model_id]);
    const aligned = alignTasksForCompare(pair);
    expect(aligned.length).toBeGreaterThanOrEqual(3);
    for (const task of aligned) {
      for (const m of pair) {
        expect(m.tasks[task]).not.toBeNull();
        expect(m.tasks[task]).not.toBeUndefined();
      }
    }
  });
});
