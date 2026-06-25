import type { DocumentFile } from '../types';
import { parseViewPanelsFromReport, type ParsedViewPanels } from './viewPanels';

/** PNG artifacts opened in the image viewer (grout + layout + viewports overlays). */
export const GROUT_OVERLAY_ARTIFACT_TYPES = new Set([
  'ANNOTATED_PNG',
  'GROUT_OVERLAY_PNG',
  'LAYOUT_OVERLAY_PNG',
  'VIEWPORTS_OVERLAY_PNG',
]);

export function isGroutOverlayArtifactType(type: string): boolean {
  return GROUT_OVERLAY_ARTIFACT_TYPES.has(type);
}

export async function fetchViewPanelsFromReportUrl(
  downloadUrl: string,
  authFetch: (url: string) => Promise<Response>,
): Promise<ParsedViewPanels | null> {
  try {
    const res = await authFetch(downloadUrl);
    if (!res.ok) return null;
    return parseViewPanelsFromReport(await res.text());
  } catch {
    return null;
  }
}

/** Load sheet_layout from REPORT_JSON for files missing viewPanels (F5 / project cache). */
export async function hydrateViewPanelsForDocs(docs: DocumentFile[]): Promise<DocumentFile[]> {
  const { authFetch } = await import('./supabase');
  return Promise.all(
    docs.map(async (doc) => {
      if (doc.viewPanels?.panels?.length) return doc;
      const reportArt = doc.artifacts?.find((a) => a.type === 'REPORT_JSON');
      if (!reportArt?.downloadUrl) return doc;
      const viewPanels = await fetchViewPanelsFromReportUrl(reportArt.downloadUrl, authFetch);
      return viewPanels ? { ...doc, viewPanels } : doc;
    }),
  );
}
