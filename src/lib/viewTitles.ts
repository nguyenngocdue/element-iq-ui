/** Parse PLAN AS CAST / REINFORCEMENT PLAN title bboxes from report JSON. */

import { extractReportComponents } from './viewSplit';

export const TAGGED_VIEW_NAMES = ['PLAN AS CAST', 'REINFORCEMENT PLAN'] as const;

export type TaggedViewName = (typeof TAGGED_VIEW_NAMES)[number];

export type ViewLabelLike = {
  name: string;
  bbox_px: number[];
  center: number[];
  display_bbox_px?: number[] | null;
  display_center?: number[] | null;
  rotation_deg?: number;
};

export type ComponentResultWithTitles = {
  component_id?: string;
  view_labels?: ViewLabelLike[] | null;
  summary?: {
    view_labels?: ViewLabelLike[] | null;
    view_split?: { mid_title?: number | null } | null;
  };
  view_split?: { mid_title?: number | null } | null;
};

export type ParsedViewTitle = {
  name: TaggedViewName;
  bbox: [number, number, number, number];
  center: [number, number];
  rotationDeg: number;
};

export type ParsedViewTitles = {
  titles: ParsedViewTitle[];
  midTitle: number | null;
  missing: TaggedViewName[];
};

function isTaggedViewName(name: string): name is TaggedViewName {
  return (TAGGED_VIEW_NAMES as readonly string[]).includes(name);
}

function resolveViewLabels(comp: ComponentResultWithTitles): ViewLabelLike[] {
  return comp.view_labels ?? comp.summary?.view_labels ?? [];
}

/** Revit exports title text vertically: PDF bbox is tall/narrow (h > w). */
function isVerticalPdfBbox(bbox: number[]): boolean {
  const [x1, y1, x2, y2] = bbox;
  const w = x2 - x1;
  const h = y2 - y1;
  return h > w * 1.15;
}

/** Swap x/y — mirrors parser `_display_center_for_overlay`. */
function swapCenterForOverlay(cx: number, cy: number): [number, number] {
  return [cy, cx];
}

/** Swap w/h around display center — mirrors parser `_display_bbox_for_overlay`. */
function displayBboxFromRaw(
  bbox: number[],
  displayCenter: [number, number],
): [number, number, number, number] {
  const [x1, y1, x2, y2] = bbox;
  const w = x2 - x1;
  const h = y2 - y1;
  const [dcx, dcy] = displayCenter;
  return [dcx - h / 2, dcy - w / 2, dcx + h / 2, dcy + w / 2];
}

function resolveOverlayFields(label: ViewLabelLike): {
  bbox: [number, number, number, number];
  center: [number, number];
  rotationDeg: number;
} {
  const raw = label.bbox_px;
  const [cx, cy] = label.center;
  const rotationDeg = label.rotation_deg ?? (isVerticalPdfBbox(raw) ? 90 : 0);

  if (label.display_center?.length === 2 && label.display_bbox_px?.length === 4) {
    return {
      bbox: label.display_bbox_px as [number, number, number, number],
      center: [label.display_center[0], label.display_center[1]],
      rotationDeg,
    };
  }

  if (rotationDeg === 90) {
    const center = swapCenterForOverlay(cx, cy);
    return { bbox: displayBboxFromRaw(raw, center), center, rotationDeg: 90 };
  }

  return {
    bbox: raw as [number, number, number, number],
    center: [cx, cy],
    rotationDeg: 0,
  };
}

function resolveDisplayMidTitle(titles: ParsedViewTitle[]): number | null {
  const plan = titles.find((t) => t.name === 'PLAN AS CAST');
  const reinf = titles.find((t) => t.name === 'REINFORCEMENT PLAN');
  if (!plan || !reinf) return null;
  return (plan.center[0] + reinf.center[0]) / 2;
}

export function parseViewTitlesFromComponent(comp: ComponentResultWithTitles): ParsedViewTitles {
  const titles: ParsedViewTitle[] = [];
  for (const label of resolveViewLabels(comp)) {
    if (!isTaggedViewName(label.name)) continue;
    const { bbox, center, rotationDeg } = resolveOverlayFields(label);
    titles.push({
      name: label.name,
      bbox,
      center,
      rotationDeg,
    });
  }
  const found = new Set(titles.map((t) => t.name));
  const missing = TAGGED_VIEW_NAMES.filter((n) => !found.has(n));
  return {
    titles,
    midTitle: resolveDisplayMidTitle(titles),
    missing,
  };
}

export function parseViewTitlesFromComponents(
  components: ComponentResultWithTitles[],
): ParsedViewTitles | null {
  for (const comp of components) {
    const parsed = parseViewTitlesFromComponent(comp);
    if (parsed.titles.length > 0) return parsed;
  }
  return null;
}

export function parseViewTitlesFromAnalysis(
  analysis: { component_results?: ComponentResultWithTitles[] } | null | undefined,
): ParsedViewTitles | null {
  if (!analysis?.component_results?.length) return null;
  return parseViewTitlesFromComponents(analysis.component_results);
}

export function parseViewTitlesFromReport(content: string | null | undefined): ParsedViewTitles | null {
  if (!content) return null;
  try {
    const data = JSON.parse(content) as unknown;
    return parseViewTitlesFromComponents(extractReportComponents(data) as ComponentResultWithTitles[]);
  } catch {
    return null;
  }
}
