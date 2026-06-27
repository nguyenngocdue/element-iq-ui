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

/** Load sheet_layout from REPORT_JSON or LAYOUT_JSON for one file missing viewPanels. */
export async function hydrateViewPanelForDoc(doc: DocumentFile): Promise<DocumentFile> {
  if (doc.viewPanels?.panels?.length) return doc;
  const viewPanels = await fetchViewPanelsForFile(doc);
  return viewPanels ? { ...doc, viewPanels } : doc;
}

/** Hydrate viewPanels only for the given file ids (lazy — not whole project). */
export async function hydrateViewPanelsForDocIds(
  docs: DocumentFile[],
  fileIds: string[],
): Promise<DocumentFile[]> {
  if (fileIds.length === 0) return docs;
  const idSet = new Set(fileIds);
  return Promise.all(
    docs.map(async (doc) => {
      if (!idSet.has(doc.id)) return doc;
      return hydrateViewPanelForDoc(doc);
    }),
  );
}

/** @deprecated Prefer hydrateViewPanelsForDocIds — loads every file (N artifact requests). */
export async function hydrateViewPanelsForDocs(docs: DocumentFile[]): Promise<DocumentFile[]> {
  return hydrateViewPanelsForDocIds(
    docs,
    docs.filter((d) => !d.viewPanels?.panels?.length).map((d) => d.id),
  );
}

export { fetchViewPanelsForFile };
