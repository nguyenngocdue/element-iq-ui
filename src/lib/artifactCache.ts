/** Best-effort artifact cache in IndexedDB — skip re-download after F5 / API restart. */

const DB_NAME = 'elementiq-artifact-cache-v1';
const STORE = 'artifacts';

interface ArtifactTextEntry {
  kind: 'text';
  text: string;
}

interface ArtifactBlobEntry {
  kind: 'blob';
  contentType: string;
  blob: Blob;
}

type ArtifactCacheEntry = ArtifactTextEntry | ArtifactBlobEntry;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function getCachedArtifactText(artifactId: string): Promise<string | undefined> {
  if (typeof indexedDB === 'undefined') return undefined;
  try {
    const db = await openDb();
    return await new Promise<string | undefined>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).get(artifactId);
      req.onsuccess = () => {
        const entry = req.result as ArtifactCacheEntry | undefined;
        resolve(entry?.kind === 'text' ? entry.text : undefined);
      };
      req.onerror = () => reject(req.error);
    });
  } catch {
    return undefined;
  }
}

export async function putCachedArtifactText(artifactId: string, text: string): Promise<void> {
  if (typeof indexedDB === 'undefined') return;
  try {
    const db = await openDb();
    const entry: ArtifactTextEntry = { kind: 'text', text };
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(entry, artifactId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    /* best-effort */
  }
}

export async function getCachedArtifactBlob(artifactId: string): Promise<Blob | undefined> {
  if (typeof indexedDB === 'undefined') return undefined;
  try {
    const db = await openDb();
    return await new Promise<Blob | undefined>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).get(artifactId);
      req.onsuccess = () => {
        const entry = req.result as ArtifactCacheEntry | undefined;
        resolve(entry?.kind === 'blob' ? entry.blob : undefined);
      };
      req.onerror = () => reject(req.error);
    });
  } catch {
    return undefined;
  }
}

export async function putCachedArtifactBlob(
  artifactId: string,
  blob: Blob,
  contentType: string,
): Promise<void> {
  if (typeof indexedDB === 'undefined') return;
  try {
    const db = await openDb();
    const entry: ArtifactBlobEntry = { kind: 'blob', blob, contentType };
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(entry, artifactId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    /* best-effort */
  }
}

export async function removeCachedArtifact(artifactId: string): Promise<void> {
  if (typeof indexedDB === 'undefined') return;
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).delete(artifactId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    /* best-effort */
  }
}
