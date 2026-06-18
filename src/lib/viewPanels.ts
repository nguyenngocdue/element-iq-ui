import { extractReportComponents } from './viewSplit';

export type ViewPanelItem = {
  id: number;
  name: string | null;
  view_class: string;
  bbox_px: [number, number, number, number];
  confidence: number;
  title_bbox_px?: [number, number, number, number] | null;
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

function normalizeSheetLayout(raw: SheetLayoutBlock | null | undefined): ParsedViewPanels | null {
  if (!raw?.panels?.length) return null;
  const size = raw.sheet_size_px ?? [0, 0];
  return {
    dpi: raw.dpi ?? 300,
    sheet_size_px: [size[0] ?? 0, size[1] ?? 0],
    panels: raw.panels,
    panel_count: raw.panel_count ?? raw.panels.length,
  };
}

export function parseViewPanelsFromReport(content: string | null | undefined): ParsedViewPanels | null {
  if (!content) return null;
  try {
    const data = JSON.parse(content) as unknown;
    if (typeof data === 'object' && data !== null) {
      const record = data as { sheet_layout?: SheetLayoutBlock };
      const fromTop = normalizeSheetLayout(record.sheet_layout);
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

/** Legacy helper — not used for panels but keeps parity with viewSplit exports. */
export { extractReportComponents };
