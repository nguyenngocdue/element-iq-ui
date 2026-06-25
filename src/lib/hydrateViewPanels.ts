import type { DocumentFile } from '../types';
import {
  fetchViewPanelsForFile,
  type ParsedViewPanels,
} from './viewPanels';

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

/** Load sheet_layout from REPORT_JSON or LAYOUT_JSON for files missing viewPanels. */
export async function hydrateViewPanelsForDocs(docs: DocumentFile[]): Promise<DocumentFile[]> {
  const { authFetch } = await import('./supabase');
  return Promise.all(
    docs.map(async (doc) => {
      if (doc.viewPanels?.panels?.length) return doc;
      const viewPanels = await fetchViewPanelsForFile(doc, authFetch);
      return viewPanels ? { ...doc, viewPanels } : doc;
    }),
  );
}

export { fetchViewPanelsForFile };
