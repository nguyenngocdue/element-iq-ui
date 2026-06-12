import { authFetch } from './supabase';

export type AdminTab = 'overview' | 'files' | 'projects' | 'users' | 'jobs' | 'cleanup' | 'system';

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
}

export interface AdminUserRow {
  id: string;
  username: string;
  full_name: string | null;
  email: string | null;
  role: string;
  is_super_admin: boolean;
  project_count: number;
  file_count: number;
  storage_bytes: number;
  last_activity_at: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface AdminFileRow {
  id: string;
  original_filename: string;
  owner_username: string;
  project_name: string | null;
  category: string;
  file_size_bytes: number;
  disk_exists: boolean | null;
  job_count: number;
  uploaded_at: string | null;
}

export interface AdminProjectRow {
  id: string;
  name: string;
  owner_username: string;
  is_archived: boolean;
  is_public: boolean;
  file_count: number;
  storage_bytes: number;
  created_at: string | null;
  updated_at: string | null;
}

export interface AdminJobRow {
  id: string;
  filename: string;
  file_id?: string | null;
  owner_username: string;
  status: string;
  stage: string | null;
  progress: number;
  overall_status: string | null;
  artifact_count?: number;
  created_at: string | null;
  completed_at?: string | null;
  error_message: string | null;
}

export interface AdminArtifactRow {
  id: string;
  artifact_type: string;
  original_filename: string | null;
  file_size_bytes: number;
  disk_exists: boolean;
  download_url: string;
  local_path?: string;
}

export interface AdminJobDetail extends AdminJobRow {
  analysis_log?: string[];
  components?: string[];
  artifacts?: AdminArtifactRow[];
}

async function adminGet<T>(path: string): Promise<T> {
  const res = await authFetch(`/api/v1/admin${path}`);
  if (!res.ok) {
    const detail = await res.json().catch(() => ({}));
    throw new Error(typeof detail.detail === 'string' ? detail.detail : `HTTP ${res.status}`);
  }
  return res.json();
}

async function adminPatch<T>(path: string, body: unknown): Promise<T> {
  const res = await authFetch(`/api/v1/admin${path}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const detail = await res.json().catch(() => ({}));
    throw new Error(typeof detail.detail === 'string' ? detail.detail : `HTTP ${res.status}`);
  }
  return res.json();
}

async function adminDelete(path: string): Promise<void> {
  const res = await authFetch(`/api/v1/admin${path}`, { method: 'DELETE' });
  if (!res.ok) {
    const detail = await res.json().catch(() => ({}));
    throw new Error(typeof detail.detail === 'string' ? detail.detail : `HTTP ${res.status}`);
  }
}

async function adminPost<T>(path: string): Promise<T> {
  const res = await authFetch(`/api/v1/admin${path}`, { method: 'POST' });
  if (!res.ok) {
    const detail = await res.json().catch(() => ({}));
    throw new Error(typeof detail.detail === 'string' ? detail.detail : `HTTP ${res.status}`);
  }
  return res.json();
}

export const adminApi = {
  overview: () => adminGet<Record<string, unknown>>('/stats/overview'),
  storage: () => adminGet<Record<string, unknown>>('/stats/storage'),
  users: (params: URLSearchParams) => adminGet<Paginated<AdminUserRow>>(`/users?${params}`),
  setUserRole: (id: string, role: string) => adminPatch<{ role: string }>(`/users/${id}/role`, { role }),
  files: (params: URLSearchParams) => adminGet<Paginated<AdminFileRow>>(`/files?${params}`),
  deleteFile: (id: string) => adminDelete(`/files/${id}`),
  projects: (params: URLSearchParams) => adminGet<Paginated<AdminProjectRow>>(`/projects?${params}`),
  deleteProject: (id: string) => adminDelete(`/projects/${id}`),
  patchProject: (id: string, body: Record<string, unknown>) => adminPatch(`/projects/${id}`, body),
  jobs: (params: URLSearchParams) => adminGet<Paginated<AdminJobRow>>(`/jobs?${params}`),
  activeJobs: () => adminGet<{ items: AdminJobRow[] }>('/jobs/active'),
  jobDetail: (id: string) => adminGet<AdminJobDetail>(`/jobs/${id}`),
  deleteJob: (id: string) => adminDelete(`/jobs/${id}`),
  systemHealth: () => adminGet<Record<string, unknown>>('/system/health'),
  systemMetrics: () => adminGet<import('../hooks/useSystemMetrics').SystemMetricsSnapshot>('/system/metrics'),
  pruneArtifacts: (keep?: number) => {
    const qs = keep != null ? `?keep=${keep}` : '';
    return adminPost<{ deleted_jobs: number; file_versions_pruned: number; keep_per_file_version: number }>(
      `/system/prune-artifacts${qs}`,
    );
  },
  scanOrphans: () => adminPost<Record<string, unknown>>('/system/scan-orphans'),
  scanGarbage: () => adminPost<AdminGarbageScan>('/system/scan-garbage'),
  cleanGarbagePlan: () => adminGet<{ phases: AdminCleanPhasePlan[] }>('/system/clean-garbage/plan'),
  cleanGarbagePhase: (phaseId: string, keep?: number) => {
    const qs = keep != null ? `?keep=${keep}` : '';
    return adminPost<AdminCleanPhaseResult>(`/system/clean-garbage/phase/${phaseId}${qs}`);
  },
  cleanGarbage: (opts?: { dryRun?: boolean; pruneRetention?: boolean; keep?: number }) => {
    const params = new URLSearchParams();
    if (opts?.dryRun) params.set('dry_run', 'true');
    if (opts?.pruneRetention === false) params.set('prune_retention', 'false');
    if (opts?.keep != null) params.set('keep', String(opts.keep));
    const qs = params.toString() ? `?${params}` : '';
    return adminPost<AdminGarbageCleanResult>(`/system/clean-garbage${qs}`);
  },
};

export interface AdminCleanPhasePlan {
  id: string;
  label: string;
  count: number;
}

export interface AdminCleanPhaseResult {
  phase: string;
  result: Record<string, number>;
  duration_ms: number;
}

export interface AdminGarbageCategory {
  count: number;
  items: Record<string, unknown>[];
  truncated: boolean;
}

export interface AdminGarbageScan {
  scanned_at: string;
  data_root?: string;
  summary: {
    total_issues: number;
    reclaimable_bytes: number;
    jobs_over_retention: number;
  };
  retention: Record<string, number>;
  categories: {
    missing_on_disk: AdminGarbageCategory;
    orphan_on_disk: AdminGarbageCategory;
    orphan_jobs: AdminGarbageCategory;
    orphan_job_results: AdminGarbageCategory;
    orphan_artifacts_db: AdminGarbageCategory;
    orphan_artifact_dirs: AdminGarbageCategory;
    jobs_over_retention: AdminGarbageCategory;
    stale_scratch: AdminGarbageCategory;
    broken_project_refs: AdminGarbageCategory;
  };
}

export interface AdminGarbageCleanResult {
  dry_run: boolean;
  cleaned_at?: string;
  before?: AdminGarbageScan['summary'];
  after?: AdminGarbageScan['summary'];
  actions?: Record<string, unknown>;
  would_clean?: AdminGarbageScan['summary'];
  categories?: AdminGarbageScan['categories'];
}
