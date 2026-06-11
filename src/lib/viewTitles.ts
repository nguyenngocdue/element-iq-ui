/** Parse PLAN AS CAST / REINFORCEMENT PLAN title bboxes from report JSON. */

import { extractReportComponents } from './viewSplit';

export const TAGGED_VIEW_NAMES = ['PLAN AS CAST', 'REINFORCEMENT PLAN'] as const;

export type TaggedViewName = (typeof TAGGED_VIEW_NAMES)[number];

export type ViewLabelLike = {
  name: string;
  bbox_px: number[];
  center: number[];
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

function resolveMidTitle(comp: ComponentResultWithTitles): number | null {
  const raw = comp.view_split?.mid_title ?? comp.summary?.view_split?.mid_title;
  return raw != null ? Number(raw) : null;
}

export function parseViewTitlesFromComponent(comp: ComponentResultWithTitles): ParsedViewTitles {
  const titles: ParsedViewTitle[] = [];
  for (const label of resolveViewLabels(comp)) {
    if (!isTaggedViewName(label.name)) continue;
    const [x1, y1, x2, y2] = label.bbox_px;
    const [cx, cy] = label.center;
    titles.push({
      name: label.name,
      bbox: [x1, y1, x2, y2],
      center: [cx, cy],
    });
  }
  const found = new Set(titles.map((t) => t.name));
  const missing = TAGGED_VIEW_NAMES.filter((n) => !found.has(n));
  return {
    titles,
    midTitle: resolveMidTitle(comp),
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
