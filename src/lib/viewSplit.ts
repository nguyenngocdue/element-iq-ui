/** Parse PLAN AS CAST / REINFORCEMENT PLAN split diagnostics from report JSON. */

import {
  resolveDisplayMidTitleFromViewLabels,
  type ViewLabelLike,
} from './viewTitles';

export type ViewRegionInfo = {
  x_min: number;
  x_max: number;
  tube_ids: number[];
};

export type ViewSplitDiagnostic = {
  mid_x: number | null;
  source: string;
  mid_title?: number | null;
  mid_gap?: number | null;
  mid_tolerance_px?: number;
};

export type ViewSplitObject = {
  id: number;
  bbox: number[];
  assigned_view?: string | null;
  view_confidence?: number | null;
};

export type ComponentResultLike = {
  component_id?: string;
  view_labels?: ViewLabelLike[] | null;
  view_split?: ViewSplitDiagnostic | null;
  view_regions?: Record<string, ViewRegionInfo> | null;
  objects?: ViewSplitObject[];
  report?: Array<{ status: string; reason?: string | null }>;
  summary?: {
    view_labels?: ViewLabelLike[] | null;
    view_split?: ViewSplitDiagnostic | null;
    view_regions?: Record<string, ViewRegionInfo> | null;
  };
};

export type ParsedViewSplit = {
  componentId: string;
  midX: number;
  /** Vertical split line for overlay (display mid_title when titles are rotated 90°). */
  boundaryX: number;
  source: string;
  midTitle: number | null;
  midGap: number | null;
  viewRegions: Record<string, ViewRegionInfo>;
  objects: ViewSplitObject[];
  hasAmbiguous: boolean;
};

export const VIEW_CONFIDENCE_THRESHOLD = 0.75;

export const VIEW_SOURCE_LABELS: Record<string, string> = {
  consensus: 'Title + geometry agree',
  title: 'Title midpoint only',
  none: 'No tagged views',
};

/** Vision pipeline renders at 300 DPI; PDF.js viewport uses 72 DPI points. */
export const ANALYSIS_TO_PDF_UNIT = 72 / 300;

export function extractReportComponents(data: unknown): ComponentResultLike[] {
  if (Array.isArray(data)) return data as ComponentResultLike[];
  if (typeof data === 'object' && data !== null) {
    const record = data as { components?: ComponentResultLike[] };
    if (Array.isArray(record.components)) return record.components;
    const single = data as ComponentResultLike;
    if (single.view_split || single.view_regions || single.summary?.view_split) return [single];
  }
  return [];
}

function resolveSplitFields(comp: ComponentResultLike): {
  split: ViewSplitDiagnostic | null | undefined;
  regions: Record<string, ViewRegionInfo> | null | undefined;
  objects: ViewSplitObject[];
  report: Array<{ status: string; reason?: string | null }>;
} {
  return {
    split: comp.view_split ?? comp.summary?.view_split,
    regions: comp.view_regions ?? comp.summary?.view_regions,
    objects: comp.objects ?? [],
    report: comp.report ?? [],
  };
}

export function parseViewSplitFromComponent(comp: ComponentResultLike): ParsedViewSplit | null {
  const { split, regions, objects, report } = resolveSplitFields(comp);
  if (!split?.mid_x) return null;
  const viewLabels = comp.view_labels ?? comp.summary?.view_labels ?? [];
  const displayMidTitle = resolveDisplayMidTitleFromViewLabels(viewLabels);
  const midTitle = displayMidTitle ?? split.mid_title ?? null;
  const boundaryX = midTitle ?? split.mid_x;
  return {
    componentId: comp.component_id ?? 'grout-tube',
    midX: split.mid_x,
    boundaryX,
    source: split.source,
    midTitle,
    midGap: split.mid_gap ?? null,
    viewRegions: regions ?? {},
    objects,
    hasAmbiguous: report.some((r) => r.status === 'VIEW-AMBIGUOUS'),
  };
}

export function parseViewSplitFromComponents(components: ComponentResultLike[]): ParsedViewSplit | null {
  for (const comp of components) {
    const parsed = parseViewSplitFromComponent(comp);
    if (parsed) return parsed;
  }
  return null;
}

export function parseViewSplitFromAnalysis(analysis: {
  component_results?: ComponentResultLike[];
} | null | undefined): ParsedViewSplit | null {
  if (!analysis?.component_results?.length) return null;
  return parseViewSplitFromComponents(analysis.component_results);
}

export function parseViewSplitFromReport(content: string | null | undefined): ParsedViewSplit | null {
  if (!content) return null;
  try {
    const data = JSON.parse(content) as unknown;
    return parseViewSplitFromComponents(extractReportComponents(data));
  } catch {
    return null;
  }
}
