import { authFetch } from './supabase';

export interface ModelTrainingMetrics {
  run_name: string;
  run_path: string;
  metrics_source: string;
  epochs_trained: number;
  best_epoch: number;
  map50: number;
  map50_95: number;
  precision: number;
  recall: number;
  curve: { epoch: number; map50: number; map50_95: number }[];
}

export interface ScoreBreakdownLine {
  label: string;
  value: number;
}

export interface ModelVerdict {
  rank: number;
  score: number;
  score_breakdown?: ScoreBreakdownLine[];
  label: 'recommended' | 'ok' | 'caution' | 'poor';
  reasons_good: string[];
  reasons_bad: string[];
}

export interface ModelAnalysisEntry {
  filename: string;
  size_mb: number;
  base_model?: string | null;
  params_m?: number;
  classes: string[];
  unexpected_classes?: string[];
  component_group: string;
  trained_at?: string | null;
  has_optimizer?: boolean;
  deploy_ready?: boolean;
  is_default?: boolean;
  training?: ModelTrainingMetrics | null;
  verdict?: ModelVerdict;
  error?: string;
}

export interface ModelAnalysisGroup {
  id: string;
  label: string;
  model_count: number;
  recommended: string | null;
  models: ModelAnalysisEntry[];
}

export interface ModelAnalysisReport {
  generated_at: string;
  models_dir: string;
  training_metrics_dir?: string;
  default_weights: string | null;
  groups: ModelAnalysisGroup[];
}

export async function fetchModelAnalysis(): Promise<ModelAnalysisReport> {
  const res = await authFetch('/api/v1/admin/models/analysis');
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.detail || `HTTP ${res.status}`);
  }
  return res.json();
}
