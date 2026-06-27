import type { FilterState, ModelRanking, TaskKey } from './types/mteb';

export const TASK_KEYS: readonly TaskKey[] = [
  'retrieval',
  'clustering',
  'classification',
  'sts',
];

export function filterModels(models: ModelRanking[], filter: FilterState): ModelRanking[] {
  let list = [...models];
  if (filter.open_only) list = list.filter((m) => m.is_open !== false);
  if (filter.dim_max != null) {
    list = list.filter((m) => m.embedding_dim == null || m.embedding_dim <= filter.dim_max!);
  }
  if (filter.price_band === 'free') {
    list = list.filter((m) => m.price_input_per_mtok == null || m.price_input_per_mtok === 0);
  } else if (filter.price_band === 'paid') {
    list = list.filter((m) => m.price_input_per_mtok != null && m.price_input_per_mtok > 0);
  }
  if (filter.search.trim()) {
    const q = filter.search.toLowerCase();
    list = list.filter((m) => m.model_id.toLowerCase().includes(q));
  }
  const task = filter.task;
  if (filter.sort === 'task') {
    list.sort((a, b) => (b.tasks[task] ?? -1) - (a.tasks[task] ?? -1));
  } else {
    list.sort((a, b) => b.avg_score - a.avg_score);
  }
  return list;
}

export function modelsByIds(models: ModelRanking[], ids: string[]): ModelRanking[] {
  return ids.map((id) => models.find((m) => m.model_id === id)).filter(Boolean) as ModelRanking[];
}

/** Tasks where every selected model has a numeric score (SC-003 alignment). */
export function alignTasksForCompare(selected: ModelRanking[]): TaskKey[] {
  if (selected.length < 2) return [];
  return TASK_KEYS.filter((k) => selected.every((m) => m.tasks[k] != null));
}

export function tasksUnavailableForCompare(
  selected: ModelRanking[],
): TaskKey[] {
  if (selected.length < 2) return [];
  return TASK_KEYS.filter((k) => selected.some((m) => m.tasks[k] == null));
}

export function dimSourceLabel(source: string | undefined): string | null {
  if (!source || source === 'unknown') return null;
  if (source === 'mteb_api') return 'MTEB API';
  if (source === 'hf_hub') return 'HF Hub';
  if (source === 'fallback_map') return 'inferred';
  return source;
}

export function priceSourceLabel(source: string | undefined): string | null {
  if (!source || source === 'unknown') return null;
  if (source === 'litellm') return 'LiteLLM';
  if (source === 'openrouter') return 'OpenRouter';
  return source;
}
