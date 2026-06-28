import { overlayBboxForSpace, type OverlayCoordinateSpace } from './displayBbox';
import { ANALYSIS_TO_PDF_UNIT } from './viewSplit';

export type { OverlayCoordinateSpace };

/** Map analysis px (300 dpi) → PDF.js viewport units for this viewer width. */
export function resolveOverlayUnitScale(
  viewerWidth: number,
  sheetSizePx: [number, number] | undefined,
  fallback = ANALYSIS_TO_PDF_UNIT,
): number {
  const sheetW = sheetSizePx?.[0] ?? 0;
  if (sheetW > 0 && viewerWidth > 0) {
    return viewerWidth / sheetW;
  }
  return fallback;
}

export function overlayToScreen(
  analysisPx: number,
  viewerWidth: number,
  viewerScale: number,
  sheetSizePx: [number, number] | undefined,
  fallbackUnitScale = ANALYSIS_TO_PDF_UNIT,
): number {
  const unitScale = resolveOverlayUnitScale(viewerWidth, sheetSizePx, fallbackUnitScale);
  return analysisPx * unitScale * viewerScale;
}

/** Map analysis bbox → viewer space, then to screen px. */
export function overlayBboxToScreen(
  bbox: [number, number, number, number],
  coordinateSpace: OverlayCoordinateSpace,
  viewerWidth: number,
  viewerScale: number,
  sheetSizePx: [number, number] | undefined,
  fallbackUnitScale = ANALYSIS_TO_PDF_UNIT,
): { left: number; top: number; width: number; height: number } {
  const mapped = overlayBboxForSpace(bbox, coordinateSpace);
  const toScreen = (v: number) =>
    overlayToScreen(v, viewerWidth, viewerScale, sheetSizePx, fallbackUnitScale);
  const left = toScreen(mapped[0]);
  const top = toScreen(mapped[1]);
  const width = Math.max(2, toScreen(mapped[2]) - left);
  const height = Math.max(2, toScreen(mapped[3]) - top);
  return { left, top, width, height };
}
