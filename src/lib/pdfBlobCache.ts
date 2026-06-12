/** Best-effort PDF blob cache in IndexedDB — instant redraw on reload. */

const DB_NAME = 'elementiq-pdf-cache-v1';
const STORE = 'pdfs';

interface PdfCacheEntry {
  versionKey: string;
  blob: Blob;
}

export function pdfVersionKey(uploadedAt?: string, fileSizeBytes?: number): string {
  return `${uploadedAt ?? ''}:${fileSizeBytes ?? 0}`;
}

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

function readEntry(raw: unknown, versionKey: string): Blob | undefined {
  if (!raw) return undefined;
  if (raw instanceof Blob) return undefined;
  const entry = raw as PdfCacheEntry;
  if (!entry?.blob || entry.versionKey !== versionKey) return undefined;
  return entry.blob;
}

export async function getCachedPdfBlob(
  fileId: string,
  versionKey: string,
): Promise<Blob | undefined> {
  if (typeof indexedDB === 'undefined') return undefined;
  try {
    const db = await openDb();
    return await new Promise<Blob | undefined>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).get(fileId);
      req.onsuccess = () => resolve(readEntry(req.result, versionKey));
      req.onerror = () => reject(req.error);
    });
  } catch {
    return undefined;
  }
}

export async function putCachedPdfBlob(
  fileId: string,
  versionKey: string,
  blob: Blob,
): Promise<void> {
  if (typeof indexedDB === 'undefined') return;
  try {
    const db = await openDb();
    const entry: PdfCacheEntry = { versionKey, blob };
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(entry, fileId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    /* best-effort */
  }
}

export async function removeCachedPdfBlob(fileId: string): Promise<void> {
  if (typeof indexedDB === 'undefined') return;
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).delete(fileId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    /* best-effort */
  }
}
