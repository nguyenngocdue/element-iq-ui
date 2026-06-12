import type { Project } from '../types';
import {
  type CachedProjectMeta,
  writeProjectSessionCache,
} from './projectSessionCache';

export interface ProjectEditorSnapshot {
  meta: CachedProjectMeta;
  rawFiles: unknown[];
}

export function metaFromProjectApi(data: Record<string, unknown>): CachedProjectMeta {
  return {
    id: String(data.id),
    name: String(data.name ?? ''),
    owner_id: String(data.owner_id),
    is_public: Boolean(data.is_public),
    public_access_level: (data.public_access_level as string | null | undefined) ?? null,
    description: (data.description as string | null | undefined) ?? null,
  };
}

export function metaFromActiveProject(project: Project): CachedProjectMeta | null {
  if (!project.ownerId) return null;
  return {
    id: project.id,
    name: project.name,
    owner_id: project.ownerId,
    is_public: Boolean(project.isPublic),
    public_access_level: project.publicAccessLevel ?? null,
    description: project.description ?? null,
  };
}

export async function fetchProjectEditorSnapshot(
  projectId: string,
): Promise<ProjectEditorSnapshot | null> {
  const { authFetch } = await import('./supabase');
  const [metaRes, filesRes] = await Promise.all([
    authFetch(`/api/v1/projects/${projectId}`),
    authFetch(`/api/v1/projects/${projectId}/files`),
  ]);
  if (!metaRes.ok || !filesRes.ok) return null;
  const data = await metaRes.json();
  const rawFiles = await filesRes.json();
  return {
    meta: metaFromProjectApi(data),
    rawFiles,
  };
}

/** Write-through: persist latest API snapshot for fast F5 reload. */
export function persistProjectSessionCache(
  projectId: string,
  viewerKey: string | null,
  snapshot: ProjectEditorSnapshot,
): void {
  writeProjectSessionCache(projectId, viewerKey, snapshot);
}
