import type { Detection } from '../types';
import { extractReportComponents, type ParsedViewSplit, type ViewSplitObject } from './viewSplit';

/** Analysis raster px per PDF point (inverse of 72/300). */
export const PDF_TO_ANALYSIS_UNIT = 300 / 72;

export const GROUT_VIEWPORT_CLASSES = new Set(['plan_view', 'reinforcement_plan']);

/** YOLO classes that are never grout view-split panels (even if title harvest is wrong). */
export const NON_GROUT_VIEW_CLASSES = new Set([
  'section_view',
  'detail_view',
  'rigging_diagram',
  'title_block',
]);

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

export function parseViewPanelsFromLayoutJson(content: string | null | undefined): ParsedViewPanels | null {
  if (!content) return null;
  try {
    const data = JSON.parse(content) as SheetLayoutBlock;
    return normalizeSheetLayout(data);
  } catch {
    return null;
  }
}

export function fileHasLayoutArtifacts(file: { artifacts?: { type: string }[] } | null | undefined): boolean {
  return Boolean(
    file?.artifacts?.some((a) => a.type === 'LAYOUT_JSON' || a.type === 'REPORT_JSON'),
  );
}

export async function fetchViewPanelsForFile(
  file: { artifacts?: { type: string; downloadUrl?: string }[] },
  authFetch: (url: string) => Promise<Response>,
): Promise<ParsedViewPanels | null> {
  const reportArt = file.artifacts?.find((a) => a.type === 'REPORT_JSON');
  if (reportArt?.downloadUrl) {
    try {
      const res = await authFetch(reportArt.downloadUrl);
      if (res.ok) {
        const parsed = parseViewPanelsFromReport(await res.text());
        if (parsed) return parsed;
      }
    } catch {
      // fall through to layout json
    }
  }
  const layoutArt = file.artifacts?.find((a) => a.type === 'LAYOUT_JSON');
  if (layoutArt?.downloadUrl) {
    try {
      const res = await authFetch(layoutArt.downloadUrl);
      if (res.ok) {
        return parseViewPanelsFromLayoutJson(await res.text());
      }
    } catch {
      return null;
    }
  }
  return null;
}

export function parseViewPanelsFromReport(content: string | null | undefined): ParsedViewPanels | null {
  if (!content) return null;
  try {
    const data = JSON.parse(content) as unknown;
    if (typeof data === 'object' && data !== null) {
      const record = data as {
        sheet_layout?: SheetLayoutBlock;
        viewport_text?: {
          dpi?: number;
          viewports?: Array<{
            panel_id?: number;
            panel_name?: string | null;
            view_class?: string;
            bbox_px?: [number, number, number, number];
            text_spans?: ViewportTextSpan[];
            text_count?: number;
          }>;
        };
      };
      const spanMap = textSpansByPanelId(data);
      const fromTop = normalizeSheetLayout(record.sheet_layout, spanMap);
      if (fromTop) return fromTop;

      const bindings = record.viewport_text?.viewports;
      if (bindings?.length) {
        const panels: ViewPanelItem[] = bindings.map((vp, idx) => ({
          id: vp.panel_id ?? idx + 1,
          name: vp.panel_name ?? null,
          view_class: vp.view_class ?? 'unknown',
          bbox_px: vp.bbox_px ?? [0, 0, 0, 0],
          confidence: 1,
          text_spans: vp.text_spans,
          text_count: vp.text_count,
        }));
        return {
          dpi: record.viewport_text?.dpi ?? 300,
          sheet_size_px: [0, 0],
          panels,
          panel_count: panels.length,
        };
      }
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

function panelHarvestedGroutName(panel: ViewPanelItem): string {
  return (panel.name ?? '').toUpperCase().trim();
}

function panelNameIsPlan(name: string): boolean {
  return name === 'PLAN AS CAST' || name.startsWith('PLAN AS CAST');
}

function panelNameIsReinf(name: string): boolean {
  return name.includes('REINFORCEMENT');
}

/** Panels included in viewport-scoped view split — same viewport rows as Viewports overlay. */
export function isGroutViewSplitPanel(panel: ViewPanelItem): boolean {
  const name = panelHarvestedGroutName(panel);
  if (name && (panelNameIsPlan(name) || panelNameIsReinf(name))) return true;
  return panel.view_class === 'plan_view' || panel.view_class === 'reinforcement_plan';
}

/** Canonical PLAN / REINF label for overlay styling. */
export function groutPanelCanonicalName(panel: ViewPanelItem): string {
  const name = panelHarvestedGroutName(panel);
  if (panelNameIsReinf(name)) return 'REINFORCEMENT PLAN';
  if (panelNameIsPlan(name)) return 'PLAN AS CAST';
  const mapped = VIEW_CLASS_TO_CANONICAL[panel.view_class];
  if (mapped) return mapped;
  return panel.name?.trim() || panel.view_class;
}

export function findGroutPlanPanel(panels: ViewPanelItem[]): ViewPanelItem | undefined {
  const byClass = panels.find((p) => p.view_class === 'plan_view');
  if (byClass) return byClass;
  return panels.find((p) => panelNameIsPlan(panelHarvestedGroutName(p)));
}

export function findGroutReinfPanel(panels: ViewPanelItem[]): ViewPanelItem | undefined {
  const byClass = panels.find((p) => p.view_class === 'reinforcement_plan');
  if (byClass) return byClass;
  return panels.find((p) => panelNameIsReinf(panelHarvestedGroutName(p)));
}

/** Label for overlay chip — harvested panel name when available. */
export function viewportDisplayName(panel: ViewPanelItem): string {
  const name = panel.name?.trim();
  if (name) return name;
  return groutPanelCanonicalName(panel);
}

function objectCenterAnalysisPx(obj: ViewSplitObject): [number, number] {
  const [x1, y1, x2, y2] = obj.bbox;
  return [(x1 + x2) / 2, (y1 + y2) / 2];
}

/** Grout tube count for a viewport panel (vision in bbox, then report objects, then view_regions). */
export function tubeCountForGroutPanel(
  panel: ViewPanelItem,
  split: ParsedViewSplit | null,
  objects: ViewSplitObject[] = [],
): number {
  if (panel.tube_count != null) return panel.tube_count;

  const [x1, y1, x2, y2] = panel.bbox_px;
  let inBbox = 0;
  for (const obj of objects) {
    const [cx, cy] = objectCenterAnalysisPx(obj);
    if (cx >= x1 && cx <= x2 && cy >= y1 && cy <= y2) inBbox += 1;
  }
  if (inBbox > 0) return inBbox;

  const canonical = groutPanelCanonicalName(panel);
  const region = split?.viewRegions[canonical];
  if (region?.tube_ids?.length) return region.tube_ids.length;

  return 0;
}

/** Legacy helper — not used for panels but keeps parity with viewSplit exports. */
export { extractReportComponents };