import { extractReportComponents } from './viewSplit';

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

/** Legacy helper — not used for panels but keeps parity with viewSplit exports. */
export { extractReportComponents };
