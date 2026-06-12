/** Project snapshot cache — IndexedDB (large projects) + tiny sessionStorage pointer for instant F5. */

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

const DB_NAME = 'elementiq-project-cache-v1';
const IDB_STORE = 'projects';

function storageKey(projectId: string, userId: string | null): string {
  return `elementiq:project:v1:${userId ?? 'guest'}:${projectId}`;
}

function pointerKey(projectId: string, userId: string | null): string {
  return `elementiq:project:ptr:v1:${userId ?? 'guest'}:${projectId}`;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(IDB_STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function idbGet(key: string): Promise<CachedProjectPayload | undefined> {
  return openDb().then(
    (db) =>
      new Promise<CachedProjectPayload | undefined>((resolve, reject) => {
        const tx = db.transaction(IDB_STORE, 'readonly');
        const req = tx.objectStore(IDB_STORE).get(key);
        req.onsuccess = () => {
          const v = req.result as CachedProjectPayload | undefined;
          if (v?.v === 1 && v.meta?.id && Array.isArray(v.rawFiles)) resolve(v);
          else resolve(undefined);
        };
        req.onerror = () => reject(req.error);
      }),
  );
}

function idbPut(key: string, entry: CachedProjectPayload): Promise<void> {
  return openDb().then(
    (db) =>
      new Promise<void>((resolve, reject) => {
        const tx = db.transaction(IDB_STORE, 'readwrite');
        tx.objectStore(IDB_STORE).put(entry, key);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      }),
  );
}

function idbDelete(key: string): Promise<void> {
  return openDb().then(
    (db) =>
      new Promise<void>((resolve, reject) => {
        const tx = db.transaction(IDB_STORE, 'readwrite');
        tx.objectStore(IDB_STORE).delete(key);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      }),
  );
}

async function idbFindByProjectSuffix(projectId: string): Promise<{ key: string; payload: CachedProjectPayload } | null> {
  if (typeof indexedDB === 'undefined') return null;
  const suffix = `:${projectId}`;
  try {
    const db = await openDb();
    const keys = await new Promise<IDBValidKey[]>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const req = tx.objectStore(IDB_STORE).getAllKeys();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    for (const key of keys) {
      const k = String(key);
      if (!k.startsWith('elementiq:project:v1:') || !k.endsWith(suffix)) continue;
      const payload = await idbGet(k);
      if (payload) return { key: k, payload };
    }
    return null;
  } catch {
    return null;
  }
}

function writePointer(projectId: string, userId: string | null, fileCount: number, sizeKb: number): void {
  try {
    sessionStorage.setItem(
      pointerKey(projectId, userId),
      JSON.stringify({ v: 1, cachedAt: new Date().toISOString(), fileCount, sizeKb }),
    );
  } catch {
    /* pointer is tiny — ignore */
  }
}

function clearPointer(projectId: string, userId: string | null): void {
  try {
    sessionStorage.removeItem(pointerKey(projectId, userId));
  } catch {
    /* ignore */
  }
}

/** Sync check for App boot — reads tiny sessionStorage pointer only. */
export function hasProjectSessionCache(
  projectId: string,
  userId: string | null,
): boolean {
  try {
    return sessionStorage.getItem(pointerKey(projectId, userId)) !== null;
  } catch {
    return false;
  }
}

export async function readProjectSessionCache(
  projectId: string,
  userId: string | null,
): Promise<CachedProjectPayload | null> {
  if (typeof indexedDB === 'undefined') return null;
  try {
    const primary = await idbGet(storageKey(projectId, userId));
    if (primary) return primary;

    const fallback = await idbFindByProjectSuffix(projectId);
    if (fallback) {
      await writeProjectSessionCache(projectId, userId, {
        meta: fallback.payload.meta,
        rawFiles: fallback.payload.rawFiles,
      });
      return fallback.payload;
    }
    return null;
  } catch {
    return null;
  }
}

export async function writeProjectSessionCache(
  projectId: string,
  userId: string | null,
  payload: Omit<CachedProjectPayload, 'v' | 'cachedAt'>,
): Promise<void> {
  if (typeof indexedDB === 'undefined') return;
  try {
    const entry: CachedProjectPayload = {
      v: 1,
      cachedAt: new Date().toISOString(),
      ...payload,
    };
    const key = storageKey(projectId, userId);
    await idbPut(key, entry);

    const sizeKb = Math.round(JSON.stringify(entry).length / 1024);
    writePointer(projectId, userId, payload.rawFiles.length, sizeKb);
    console.log(
      `[ElementIQ] Project cache saved · ${payload.rawFiles.length} file(s) · ~${sizeKb} KB · IndexedDB/${DB_NAME} · key=${key}`,
    );
  } catch (err) {
    console.warn('[ElementIQ] project cache write failed (IndexedDB)', err);
  }
}

export async function clearProjectSessionCache(
  projectId: string,
  userId: string | null,
): Promise<void> {
  clearPointer(projectId, userId);
  if (typeof indexedDB === 'undefined') return;
  try {
    await idbDelete(storageKey(projectId, userId));
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
