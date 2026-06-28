import {
  GROUT_VIEWPORT_CLASSES,
  type ParsedViewPanels,
  type ViewPanelItem,
  type ViewportTextSpan,
} from './viewPanels';
import { bboxCenter } from './displayBbox';

/** Mirrors ``configs/default.yaml`` → ``sheet_viewports`` (tag detach). */
export const TAG_DETACH_PANEL_MARGIN_PX = 8;
export const TAG_DETACH_ORPHAN_MARGIN_PX = 420;
export const TAG_DETACH_PLAN_REINF_MARGIN_PX = 420;

const GROUT_TAG_SPAN_RE =
  /GROUT\s+TUBES?|\d+\s*\/\s*(?:[ØO0])?\s*\d+\s*-\s*GROUT|\d+\s*\/\s*T\d+/i;

export type TagDetachRegionKind =
  | 'plan_panel'
  | 'reinf_panel'
  | 'detach_hit_margin'
  | 'plan_reinf_gutter'
  | 'orphan_halo'
  | 'panel_gap';

export type TagDetachRegion = {
  kind: TagDetachRegionKind;
  label: string;
  bbox: [number, number, number, number];
  panelId?: number;
};

export type DetachedGroutTagSpan = ViewportTextSpan & {
  panelId: number;
  panelName: string | null;
  viewClass: string;
  /** PDF text bbox @ 300 dpi (already includes page rotation via PyMuPDF transform). */
  detachCenter: [number, number];
};

export type TagDetachScope = {
  margins: {
    panel_px: number;
    orphan_px: number;
    plan_reinf_px: number;
  };
  regions: TagDetachRegion[];
  tagSpans: DetachedGroutTagSpan[];
};

export function isGroutTagSpanText(text: string): boolean {
  return GROUT_TAG_SPAN_RE.test(text.trim());
}

function expandBbox(
  bbox: [number, number, number, number],
  margin: number,
): [number, number, number, number] {
  const [x1, y1, x2, y2] = bbox;
  return [x1 - margin, y1 - margin, x2 + margin, y2 + margin];
}

function collectGroutTagSpans(panels: ViewPanelItem[]): DetachedGroutTagSpan[] {
  const out: DetachedGroutTagSpan[] = [];
  for (const panel of panels) {
    if (!GROUT_VIEWPORT_CLASSES.has(panel.view_class)) continue;
    for (const span of panel.text_spans ?? []) {
      if (!isGroutTagSpanText(span.text)) continue;
      out.push({
        ...span,
        panelId: panel.id,
        panelName: panel.name,
        viewClass: panel.view_class,
        detachCenter: bboxCenter(span.bbox_px) as [number, number],
      });
    }
  }
  return out;
}

/** Build overlay regions matching ``viewport_detach.detach_spans_to_panels`` tag logic. */
export function buildTagDetachScope(data: ParsedViewPanels): TagDetachScope | null {
  const plan = data.panels.find((p) => p.view_class === 'plan_view');
  if (!plan) return null;

  const reinf = data.panels.find((p) => p.view_class === 'reinforcement_plan');
  const regions: TagDetachRegion[] = [];
  const [px1, py1, px2, py2] = plan.bbox_px;

  regions.push({
    kind: 'plan_panel',
    label: 'PLAN panel (YOLO)',
    bbox: plan.bbox_px,
    panelId: plan.id,
  });

  regions.push({
    kind: 'detach_hit_margin',
    label: `PDF center in panel ±${TAG_DETACH_PANEL_MARGIN_PX}px`,
    bbox: expandBbox(plan.bbox_px, TAG_DETACH_PANEL_MARGIN_PX),
    panelId: plan.id,
  });

  regions.push({
    kind: 'plan_reinf_gutter',
    label: `Detach center (raw PDF) in +${TAG_DETACH_PLAN_REINF_MARGIN_PX}px strip`,
    bbox: [px2, py1, px2 + TAG_DETACH_PLAN_REINF_MARGIN_PX, py2],
    panelId: plan.id,
  });

  regions.push({
    kind: 'orphan_halo',
    label: `Orphan grout tag ≤${TAG_DETACH_ORPHAN_MARGIN_PX}px from panel`,
    bbox: expandBbox(plan.bbox_px, TAG_DETACH_ORPHAN_MARGIN_PX),
    panelId: plan.id,
  });

  if (reinf) {
    const [rx1, ry1, rx2, ry2] = reinf.bbox_px;
    regions.push({
      kind: 'reinf_panel',
      label: 'REINF panel (YOLO)',
      bbox: reinf.bbox_px,
      panelId: reinf.id,
    });
    if (rx1 > px2) {
      regions.push({
        kind: 'panel_gap',
        label: 'PLAN ↔ REINF frame gap',
        bbox: [px2, Math.min(py1, ry1), rx1, Math.max(py2, ry2)],
        panelId: plan.id,
      });
    }
  }

  return {
    margins: {
      panel_px: TAG_DETACH_PANEL_MARGIN_PX,
      orphan_px: TAG_DETACH_ORPHAN_MARGIN_PX,
      plan_reinf_px: TAG_DETACH_PLAN_REINF_MARGIN_PX,
    },
    regions,
    tagSpans: collectGroutTagSpans(data.panels),
  };
}

export function hasTagDetachScopeData(data: ParsedViewPanels | null | undefined): data is ParsedViewPanels {
  if (!data?.panels?.length) return false;
  return data.panels.some((p) => p.view_class === 'plan_view');
}
