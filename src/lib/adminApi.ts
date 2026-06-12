import { authFetch } from './supabase';

export type AdminTab = 'overview' | 'files' | 'projects' | 'users' | 'jobs' | 'system';

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
};
