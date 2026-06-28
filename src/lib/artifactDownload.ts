/** Download analysis artifacts (single file or ZIP bundle). */

import { toast } from 'sonner';
import type { FileArtifact } from '../types';
import { isGroutOverlayArtifactType } from './hydrateViewPanels';

export function artifactDownloadFilename(
  artifact: FileArtifact,
  sourcePdfName: string,
): string {
  if (artifact.originalFilename) return artifact.originalFilename;
  const stem = sourcePdfName.replace(/\.pdf$/i, '');
  if (isGroutOverlayArtifactType(artifact.type)) return `${stem}_grout_overlay.png`;
  if (artifact.type === 'ANNOTATED_PDF') return `${stem}_annotated.pdf`;
  if (artifact.type === 'ANNOTATED_PNG') return `${stem}_annotated.png`;
  if (artifact.type === 'LAYOUT_OVERLAY_PNG') return `${stem}_layout_overlay.png`;
  if (artifact.type === 'VIEWPORTS_OVERLAY_PNG') return `${stem}_viewports_overlay.png`;
  if (artifact.type === 'REPORT_JSON') return `${stem}_report.json`;
  if (artifact.type === 'LAYOUT_JSON') return `${stem}_layout.json`;
  if (artifact.type === 'BINDINGS_JSON') return `${stem}_bindings.json`;
  if (artifact.type === 'GROUT_REPORT_JSON') return `${stem}_grout_report.json`;
  return `${stem}_${artifact.type.toLowerCase()}`;
}

async function triggerBlobDownload(blob: Blob, filename: string): Promise<void> {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/** Download one artifact via API (?download=1). */
export async function downloadArtifactFile(
  artifact: FileArtifact,
  sourcePdfName: string,
): Promise<boolean> {
  if (!artifact.downloadUrl) {
    toast.error('Download URL missing');
    return false;
  }
  try {
    const { authFetch } = await import('./supabase');
    const sep = artifact.downloadUrl.includes('?') ? '&' : '?';
    const res = await authFetch(`${artifact.downloadUrl}${sep}download=1`);
    if (!res.ok) {
      toast.error(`Download failed (${res.status})`);
      return false;
    }
    const blob = await res.blob();
    await triggerBlobDownload(blob, artifactDownloadFilename(artifact, sourcePdfName));
    return true;
  } catch {
    toast.error('Download failed');
    return false;
  }
}

/** Download original drawing PDF from server (or local blob when still in browser). */
export async function downloadOriginalPdfFile(
  fileId: string,
  filename: string,
  localFile?: File | Blob | null,
): Promise<boolean> {
  try {
    if (localFile && localFile.size > 0) {
      const blob = localFile instanceof Blob ? localFile : new Blob([localFile]);
      await triggerBlobDownload(blob, filename);
      toast.success(`Downloaded ${filename}`);
      return true;
    }
    const { authFetch } = await import('./supabase');
    const res = await authFetch(`/api/v1/files/${fileId}/download?download=1`);
    if (!res.ok) {
      toast.error(`Download failed (${res.status})`);
      return false;
    }
    const blob = await res.blob();
    await triggerBlobDownload(blob, filename);
    toast.success(`Downloaded ${filename}`);
    return true;
  } catch {
    toast.error('Download failed');
    return false;
  }
}

/** Download all analysis artifacts (+ original PDF) as ZIP from server. */
export async function downloadFileArtifactsBundle(
  fileId: string,
  sourcePdfName: string,
  options?: { includePdf?: boolean },
): Promise<boolean> {
  const includePdf = options?.includePdf !== false;
  const stem = sourcePdfName.replace(/\.pdf$/i, '') || 'drawing';
  const zipName = `${stem}_artifacts.zip`;
  try {
    const { authFetch } = await import('./supabase');
    const params = new URLSearchParams({ download: '1' });
    if (includePdf) params.set('include_pdf', '1');
    const res = await authFetch(`/api/v1/files/${fileId}/artifacts/bundle?${params.toString()}`);
    if (res.status === 404) {
      toast.error('No artifacts — run analysis first');
      return false;
    }
    if (!res.ok) {
      toast.error(`Download failed (${res.status})`);
      return false;
    }
    const blob = await res.blob();
    await triggerBlobDownload(blob, zipName);
    toast.success(`Downloaded ${zipName} (PDF + artifacts)`);
    return true;
  } catch {
    toast.error('Download failed');
    return false;
  }
}
