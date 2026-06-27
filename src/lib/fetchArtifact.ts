import {
  getCachedArtifactBlob,
  getCachedArtifactText,
  putCachedArtifactBlob,
  putCachedArtifactText,
} from './artifactCache';

export interface ArtifactRef {
  id: string;
  downloadUrl: string;
}

/** Fetch artifact text (JSON) with IndexedDB cache keyed by artifact id. */
export async function fetchArtifactText(
  artifact: ArtifactRef,
  init?: RequestInit,
): Promise<string | null> {
  const cached = await getCachedArtifactText(artifact.id);
  if (cached !== undefined) return cached;

  const { authFetch } = await import('./supabase');
  const res = await authFetch(artifact.downloadUrl, init);
  if (!res.ok) return null;

  const text = await res.text();
  void putCachedArtifactText(artifact.id, text);
  return text;
}

/** Fetch artifact blob (PNG/PDF) with IndexedDB cache keyed by artifact id. */
export async function fetchArtifactBlob(
  artifact: ArtifactRef,
  init?: RequestInit,
): Promise<Blob | null> {
  const cached = await getCachedArtifactBlob(artifact.id);
  if (cached !== undefined) return cached;

  const { authFetch } = await import('./supabase');
  const res = await authFetch(artifact.downloadUrl, init);
  if (!res.ok) return null;

  const blob = await res.blob();
  void putCachedArtifactBlob(artifact.id, blob, blob.type || 'application/octet-stream');
  return blob;
}
