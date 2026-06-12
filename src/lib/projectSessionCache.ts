/** Session-scoped project snapshot — survives F5 reload in the same tab. */

export interface CachedProjectMeta {
  id: string;
  name: string;
  owner_id: string;
  is_public: boolean;
  public_access_level?: string | null;
  description?: string | null;
}

export interface CachedProjectPayload {
  v: 1;
  cachedAt: string;
  meta: CachedProjectMeta;
  rawFiles: unknown[];
}

function cacheKey(projectId: string, userId: string | null): string {
  return `elementiq:project:v1:${userId ?? 'guest'}:${projectId}`;
}

export function readProjectSessionCache(
  projectId: string,
  userId: string | null,
): CachedProjectPayload | null {
  try {
    const raw = sessionStorage.getItem(cacheKey(projectId, userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedProjectPayload;
    if (parsed?.v !== 1 || !parsed.meta?.id || !Array.isArray(parsed.rawFiles)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeProjectSessionCache(
  projectId: string,
  userId: string | null,
  payload: Omit<CachedProjectPayload, 'v' | 'cachedAt'>,
): void {
  try {
    const entry: CachedProjectPayload = {
      v: 1,
      cachedAt: new Date().toISOString(),
      ...payload,
    };
    sessionStorage.setItem(cacheKey(projectId, userId), JSON.stringify(entry));
  } catch (err) {
    console.warn('[ElementIQ] project session cache full or unavailable', err);
  }
}

export function clearProjectSessionCache(projectId: string, userId: string | null): void {
  try {
    sessionStorage.removeItem(cacheKey(projectId, userId));
  } catch {
    /* ignore */
  }
}

function fileFingerprint(file: Record<string, unknown>): string {
  const analysis = file.analysis as Record<string, unknown> | undefined;
  const artifacts = Array.isArray(analysis?.artifacts)
    ? (analysis.artifacts as Array<Record<string, unknown>>)
        .map((a) => String(a.id ?? ''))
        .sort()
        .join(',')
    : '';
  return [
    file.id ?? '',
    file.uploaded_at ?? '',
    file.file_size_bytes ?? '',
    file.original_filename ?? '',
    analysis?.job_id ?? '',
    analysis?.overall_status ?? '',
    analysis?.status ?? '',
    artifacts,
  ].join('|');
}

/** Stable hash of list payload — detects new uploads, re-analysis, deletes, renames. */
export function fingerprintProjectFiles(rawFiles: unknown[]): string {
  if (!Array.isArray(rawFiles)) return '';
  return rawFiles
    .map((f) => fileFingerprint((f ?? {}) as Record<string, unknown>))
    .sort()
    .join('\n');
}

export function projectFilesDataChanged(prev: unknown[], next: unknown[]): boolean {
  return fingerprintProjectFiles(prev) !== fingerprintProjectFiles(next);
}

export function projectMetaChanged(a: CachedProjectMeta, b: CachedProjectMeta): boolean {
  return (
    a.name !== b.name
    || a.owner_id !== b.owner_id
    || a.is_public !== b.is_public
    || a.public_access_level !== b.public_access_level
    || (a.description ?? null) !== (b.description ?? null)
  );
}

export function projectSnapshotChanged(
  prev: CachedProjectPayload | null,
  meta: CachedProjectMeta,
  rawFiles: unknown[],
): boolean {
  if (!prev) return true;
  return projectMetaChanged(prev.meta, meta) || projectFilesDataChanged(prev.rawFiles, rawFiles);
}
