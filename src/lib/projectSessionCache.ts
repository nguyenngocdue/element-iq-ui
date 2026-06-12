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

function parseCachePayload(raw: string): CachedProjectPayload | null {
  try {
    const parsed = JSON.parse(raw) as CachedProjectPayload;
    if (parsed?.v !== 1 || !parsed.meta?.id || !Array.isArray(parsed.rawFiles)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function readCacheByStorageKey(key: string): CachedProjectPayload | null {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    return parseCachePayload(raw);
  } catch {
    return null;
  }
}

export function hasProjectSessionCache(
  projectId: string,
  userId: string | null,
): boolean {
  return readProjectSessionCache(projectId, userId) !== null;
}

export function readProjectSessionCache(
  projectId: string,
  userId: string | null,
): CachedProjectPayload | null {
  try {
    const primary = readCacheByStorageKey(cacheKey(projectId, userId));
    if (primary) return primary;

    // Same tab may have cached under a sibling viewer key (e.g. guest → user after auth).
    const suffix = `:${projectId}`;
    for (let i = 0; i < sessionStorage.length; i += 1) {
      const key = sessionStorage.key(i);
      if (!key?.startsWith('elementiq:project:v1:') || !key.endsWith(suffix)) continue;
      const hit = readCacheByStorageKey(key);
      if (hit) {
        // Normalize to the current viewer key for the next reload.
        writeProjectSessionCache(projectId, userId, {
          meta: hit.meta,
          rawFiles: hit.rawFiles,
        });
        return hit;
      }
    }
    return null;
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
    const serialized = JSON.stringify(entry);
    sessionStorage.setItem(cacheKey(projectId, userId), serialized);
    const kb = Math.round(serialized.length / 1024);
    console.log(
      `[ElementIQ] Project cache saved · ${payload.rawFiles.length} file(s) · ~${kb} KB · key=${cacheKey(projectId, userId)}`,
    );
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
