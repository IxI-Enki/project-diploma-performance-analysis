export type TaskKey = 'retrieval' | 'clustering' | 'classification' | 'sts';

export interface MTEBTaskScore {
  retrieval?: number | null;
  clustering?: number | null;
  classification?: number | null;
  sts?: number | null;
  [key: string]: number | null | undefined;
}

export type DimSource = 'hf_hub' | 'fallback_map' | 'unknown';
export type PriceSource = 'litellm' | 'openrouter' | 'unknown';

export interface ModelRanking {
  model_id: string;
  avg_score: number;
  tasks: MTEBTaskScore;
  params_m?: number | null;
  license?: string | null;
  updated?: string | null;
  embedding_dim?: number | null;
  dim_source?: DimSource;
  price_input_per_mtok?: number | null;
  price_source?: PriceSource;
  is_open?: boolean;
}

export interface PickerRule {
  task: string;
  resources: 'high' | 'low';
  model_id: string;
  reason_en: string;
  reason_de: string;
}

export interface LeaderboardSnapshot {
  schema_version: string;
  generated_at: string;
  source: string;
  source_url?: string;
  benchmark?: string;
  fallback?: boolean;
  models: ModelRanking[];
  picker_rules?: PickerRule[];
}

export interface Manifest {
  schema_version: string;
  generated_at: string;
  sources: string[];
  source_urls?: string[];
  files: string[];
  changelog?: Array<{ generated_at: string; source: string }>;
  stale_warning?: string;
}

export interface FilterState {
  task: TaskKey;
  open_only: boolean;
  dim_max: number | null;
  price_band: string | null;
  search: string;
  sort: string;
}

export interface ComparisonSet {
  model_ids: string[];
  align_tasks: string[];
}

export function logoForModel(modelId: string): string | null {
  const id = modelId.toLowerCase();
  if (id.startsWith('mistralai/')) return 'mistral.svg';
  if (id.startsWith('intfloat/') || id.includes('/e5')) return 'microsoft.svg';
  if (id.startsWith('deutsche-telekom/') || id.includes('gbert')) return 'telekom.svg';
  if (id.startsWith('baai/') || id.includes('bge')) return 'baai.svg';
  if (id.includes('jina')) return 'jina.svg';
  if (id.startsWith('sentence-transformers/')) return 'huggingface.svg';
  return null;
}

export function formatScore(value: number | null | undefined, digits = 1): string {
  if (value == null || Number.isNaN(value)) return '—';
  return value.toFixed(digits);
}

export function formatParams(paramsM: number | null | undefined): string {
  if (paramsM == null) return '—';
  if (paramsM >= 1000) return `${(paramsM / 1000).toFixed(1)}B`;
  return `${paramsM}M`;
}
