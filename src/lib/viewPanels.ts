import type { Detection } from '../types';
import { extractReportComponents } from './viewSplit';

/** Analysis raster px per PDF point (inverse of 72/300). */
export const PDF_TO_ANALYSIS_UNIT = 300 / 72;

export const GROUT_VIEWPORT_CLASSES = new Set(['plan_view', 'reinforcement_plan']);

export type ViewportTextSpan = {
  index: number;
  text: string;
  bbox_px: [number, number, number, number];
};

export type ViewPanelItem = {
  id: number;
  name: string | null;
  view_class: string;
  bbox_px: [number, number, number, number];
  confidence: number;
  title_bbox_px?: [number, number, number, number] | null;
  /** PDF text lines detached into this viewport (from viewport_text bindings). */
  text_spans?: ViewportTextSpan[];
  text_count?: number;
  /** Tubes whose center falls inside this panel bbox (analysis px). */
  tube_count?: number;
};

export type ParsedViewPanels = {
  dpi: number;
  sheet_size_px: [number, number];
  panels: ViewPanelItem[];
  panel_count: number;
};

type SheetLayoutBlock = {
  dpi?: number;
  sheet_size_px?: number[];
  panels?: ViewPanelItem[];
  panel_count?: number;
};

function textSpansByPanelId(data: unknown): Map<number, ViewportTextSpan[]> {
  const map = new Map<number, ViewportTextSpan[]>();
  if (!data || typeof data !== 'object') return map;
  const record = data as {
    viewport_text?: {
      viewports?: Array<{
        panel_id?: number;
        text_spans?: ViewportTextSpan[];
        text_count?: number;
      }>;
    };
  };
  const viewports = record.viewport_text?.viewports ?? [];
  for (const vp of viewports) {
    if (vp.panel_id == null) continue;
    map.set(vp.panel_id, vp.text_spans ?? []);
  }
  return map;
}

function normalizeSheetLayout(
  raw: SheetLayoutBlock | null | undefined,
  spanMap?: Map<number, ViewportTextSpan[]>,
): ParsedViewPanels | null {
  if (!raw?.panels?.length) return null;
  const size = raw.sheet_size_px ?? [0, 0];
  const panels = raw.panels.map((panel) => {
    const spans = spanMap?.get(panel.id);
    if (!spans?.length) return panel;
    return {
      ...panel,
      text_spans: spans,
      text_count: spans.length,
    };
  });
  return {
    dpi: raw.dpi ?? 300,
    sheet_size_px: [size[0] ?? 0, size[1] ?? 0],
    panels,
    panel_count: raw.panel_count ?? panels.length,
  };
}

export function parseViewPanelsFromReport(content: string | null | undefined): ParsedViewPanels | null {
  if (!content) return null;
  try {
    const data = JSON.parse(content) as unknown;
    if (typeof data === 'object' && data !== null) {
      const record = data as { sheet_layout?: SheetLayoutBlock };
      const spanMap = textSpansByPanelId(data);
      const fromTop = normalizeSheetLayout(record.sheet_layout, spanMap);
      if (fromTop) return fromTop;
    }
    return null;
  } catch {
    return null;
  }
}

export function hasViewPanelsData(data: ParsedViewPanels | null | undefined): data is ParsedViewPanels {
  return Boolean(data?.panels?.length);
}

function detectionCenterAnalysisPx(d: Detection): [number, number] {
  const cx = (d.x + d.width / 2) * PDF_TO_ANALYSIS_UNIT;
  const cy = (d.y + d.height / 2) * PDF_TO_ANALYSIS_UNIT;
  return [cx, cy];
}

function pointInBBox(px: number, py: number, bbox: [number, number, number, number]): boolean {
  const [x1, y1, x2, y2] = bbox;
  return px >= x1 && px <= x2 && py >= y1 && py <= y2;
}

/** Count tube detections whose center lies inside each panel bbox (300 dpi px). */
export function countTubesPerPanel(
  panels: ViewPanelItem[],
  detections: Detection[],
  page = 1,
): Map<number, number> {
  const map = new Map<number, number>();
  const pageDets = detections.filter((d) => d.page === page);
  for (const panel of panels) {
    let count = 0;
    for (const d of pageDets) {
      const [cx, cy] = detectionCenterAnalysisPx(d);
      if (pointInBBox(cx, cy, panel.bbox_px)) count += 1;
    }
    map.set(panel.id, count);
  }
  return map;
}

export function enrichViewPanelsWithTubeCounts(
  data: ParsedViewPanels,
  detections: Detection[],
  page = 1,
): ParsedViewPanels {
  const counts = countTubesPerPanel(data.panels, detections, page);
  return {
    ...data,
    panels: data.panels.map((panel) => ({
      ...panel,
      tube_count: counts.get(panel.id) ?? 0,
    })),
  };
}

export const VIEW_CLASS_TO_CANONICAL: Record<string, string> = {
  plan_view: 'PLAN AS CAST',
  reinforcement_plan: 'REINFORCEMENT PLAN',
};

/** Legacy helper — not used for panels but keeps parity with viewSplit exports. */
export { extractReportComponents };