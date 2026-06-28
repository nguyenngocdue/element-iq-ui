/**
 * PDF text bbox vs PDF.js canvas on Revit landscape (rotation 90).
 *
 * PyMuPDF ``transformation_matrix`` bboxes match the 300 dpi raster (YOLO panels).
 * PDF.js draws the same text at swapped axes for vertical PDF strips — overlay on
 * the PDF viewer must apply ``displaySwapBbox`` for those spans only.
 */

export const VERTICAL_BBOX_RATIO = 1.15;

export type OverlayCoordinateSpace = 'pdfjs' | 'raster';

export function isVerticalBbox(bbox: number[]): boolean {
  if (bbox.length < 4) return false;
  const [x1, y1, x2, y2] = bbox;
  const w = x2 - x1;
  const h = y2 - y1;
  if (w <= 0 || h <= 0) return false;
  return h > w * VERTICAL_BBOX_RATIO;
}

export function bboxCenter(bbox: number[]): [number, number] {
  const [x1, y1, x2, y2] = bbox;
  return [(x1 + x2) / 2, (y1 + y2) / 2];
}

/** Swap w/h around (cy,cx) — aligns PyMuPDF vertical strip with PDF.js text position. */
export function displaySwapBbox(
  bbox: [number, number, number, number],
): [number, number, number, number] {
  const [x1, y1, x2, y2] = bbox;
  const w = x2 - x1;
  const h = y2 - y1;
  const cx = (x1 + x2) / 2;
  const cy = (y1 + y2) / 2;
  const dcx = cy;
  const dcy = cx;
  const halfW = h / 2;
  const halfH = w / 2;
  return [
    Math.round(dcx - halfW),
    Math.round(dcy - halfH),
    Math.round(dcx + halfW),
    Math.round(dcy + halfH),
  ];
}

/**
 * Raster / annotated PNG: PyMuPDF analysis px as-is.
 * PDF.js viewer: vertical PDF text strips need axis swap (panels/YOLO do not).
 */
export function overlayBboxForSpace(
  bbox: [number, number, number, number],
  space: OverlayCoordinateSpace,
): [number, number, number, number] {
  if (space === 'raster') return bbox;
  if (isVerticalBbox(bbox)) return displaySwapBbox(bbox);
  return bbox;
}
