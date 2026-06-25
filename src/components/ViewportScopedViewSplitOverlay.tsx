import React from 'react';
import {
  findGroutPlanPanel,
  findGroutReinfPanel,
  groutPanelCanonicalName,
  isGroutViewSplitPanel,
  ParsedViewPanels,
  tubeCountForGroutPanel,
  viewportDisplayName,
  ViewPanelItem,
} from '../lib/viewPanels';
import {
  ParsedViewSplit,
  VIEW_CONFIDENCE_THRESHOLD,
  VIEW_SOURCE_LABELS,
  ViewSplitObject,
} from '../lib/viewSplit';

type ViewportScopedViewSplitOverlayProps = {
  panels: ParsedViewPanels;
  split: ParsedViewSplit | null;
  viewerWidth: number;
  viewerHeight: number;
  viewerScale: number;
  unitScale?: number;
};

const VIEW_STYLES: Record<
  string,
  { fill: string; border: string }
> = {
  'PLAN AS CAST': {
    fill: 'rgba(130, 170, 255, 0.18)',
    border: '#82aaff',
  },
  'REINFORCEMENT PLAN': {
    fill: 'rgba(78, 201, 176, 0.18)',
    border: '#4ec9b0',
  },
};

function objectCenter(obj: ViewSplitObject): [number, number] {
  const [x1, y1, x2, y2] = obj.bbox;
  return [(x1 + x2) / 2, (y1 + y2) / 2];
}

function objectInPanel(obj: ViewSplitObject, panel: ViewPanelItem): boolean {
  const [cx, cy] = objectCenter(obj);
  const [x1, y1, x2, y2] = panel.bbox_px;
  return cx >= x1 && cx <= x2 && cy >= y1 && cy <= y2;
}

function PanelViewSplitBox({
  panel,
  split,
  toScreen,
  objects,
}: {
  panel: ViewPanelItem;
  split: ParsedViewSplit | null;
  toScreen: (v: number) => number;
  objects: ViewSplitObject[];
}) {
  const [x1, y1, x2, y2] = panel.bbox_px;
  const left = toScreen(x1);
  const top = toScreen(y1);
  const width = toScreen(x2) - left;
  const height = toScreen(y2) - top;
  const viewName = groutPanelCanonicalName(panel);
  const label = viewportDisplayName(panel);
  const tubeCount = tubeCountForGroutPanel(panel, split, objects);
  const styles = VIEW_STYLES[viewName] ?? VIEW_STYLES['PLAN AS CAST'];
  const panelObjects = objects.filter((o) => objectInPanel(o, panel));
  const ambiguous = panelObjects.filter(
    (o) => o.view_confidence != null && o.view_confidence < VIEW_CONFIDENCE_THRESHOLD,
  );

  return (
    <div
      className="absolute pointer-events-none"
      style={{ left, top, width, height }}
      aria-label={`${label} · ${tubeCount} grout tubes`}
    >
      <div
        className="absolute left-0 -top-5 px-2 py-0.5 text-[10px] font-bold font-mono text-white border rounded-sm whitespace-nowrap shadow-md max-w-[min(100%,320px)] truncate"
        style={{
          borderColor: styles.border,
          backgroundColor: `${styles.border}e8`,
        }}
      >
        {label}
        <span className="text-white/95"> · {tubeCount} tube{tubeCount === 1 ? '' : 's'}</span>
      </div>
      <div className="absolute inset-0 overflow-hidden">
        <div
          className="absolute inset-0"
          style={{
            backgroundColor: styles.fill,
            border: `2px solid ${styles.border}`,
            boxShadow: `inset 0 0 0 1px ${styles.border}40`,
          }}
        />
        {ambiguous.map((obj) => {
        const [ox1, oy1, ox2, oy2] = obj.bbox;
        const oLeft = toScreen(ox1) - left;
        const oTop = toScreen(oy1) - top;
        return (
          <div
            key={obj.id}
            className="absolute border-2 border-[#ff8c00] rounded-sm bg-[#ff8c00]/25"
            style={{
              left: oLeft - 2,
              top: oTop - 2,
              width: toScreen(ox2) - toScreen(ox1) + 4,
              height: toScreen(oy2) - toScreen(oy1) + 4,
            }}
          >
            <span className="absolute -top-4 left-0 text-[9px] font-bold font-mono text-[#ff8c00] whitespace-nowrap bg-[#1e1e1e]/90 px-1 rounded">
              #{obj.id} uncertain
            </span>
          </div>
        );
      })}
      </div>
    </div>
  );
}

function PanelGapSplitLine({
  planPanel,
  reinfPanel,
  midX,
  toScreen,
}: {
  planPanel: ViewPanelItem;
  reinfPanel: ViewPanelItem;
  midX: number | null;
  toScreen: (v: number) => number;
}) {
  const [, , px2] = planPanel.bbox_px;
  const [rx1] = reinfPanel.bbox_px;
  const yTop = Math.max(planPanel.bbox_px[1], reinfPanel.bbox_px[1]);
  const yBottom = Math.min(planPanel.bbox_px[3], reinfPanel.bbox_px[3]);
  if (yBottom <= yTop) return null;

  const gapMid = (px2 + rx1) / 2;
  const lineX = midX != null && midX >= px2 - 40 && midX <= rx1 + 40 ? midX : gapMid;
  const left = toScreen(lineX);
  const top = toScreen(yTop);
  const height = toScreen(yBottom) - top;

  return (
    <div
      className="absolute w-[3px] -translate-x-1/2 pointer-events-none"
      style={{
        left,
        top,
        height,
        background: 'repeating-linear-gradient(to bottom, #ffc800 0 10px, transparent 10px 18px)',
        boxShadow: '0 0 8px rgba(255, 200, 0, 0.6)',
      }}
      aria-hidden
    />
  );
}

/**
 * View split scoped to each grout viewport — not a full-sheet vertical line.
 */
export function ViewportScopedViewSplitOverlay({
  panels,
  split,
  viewerWidth,
  viewerHeight,
  viewerScale,
  unitScale = 1,
}: ViewportScopedViewSplitOverlayProps) {
  const toScreen = (v: number) => v * unitScale * viewerScale;
  const w = viewerWidth * viewerScale;
  const h = viewerHeight * viewerScale;

  const groutPanels = panels.panels.filter(isGroutViewSplitPanel);
  const planPanel = findGroutPlanPanel(groutPanels);
  const reinfPanel = findGroutReinfPanel(groutPanels);
  const objects = split?.objects ?? [];
  const source = split?.source ?? 'viewport';
  const midX = split?.midX ?? null;
  const hasAmbiguous = split?.hasAmbiguous ?? false;

  return (
    <div
      className="absolute inset-0 pointer-events-none overflow-hidden z-[21]"
      style={{ width: w, height: h }}
      aria-label="Viewport-scoped view split overlay"
    >
      {groutPanels.map((panel) => (
        <PanelViewSplitBox
          key={panel.id}
          panel={panel}
          split={split}
          toScreen={toScreen}
          objects={objects}
        />
      ))}

      {planPanel && reinfPanel ? (
        <PanelGapSplitLine
          planPanel={planPanel}
          reinfPanel={reinfPanel}
          midX={midX}
          toScreen={toScreen}
        />
      ) : null}

      {split ? (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-full text-[10px] font-mono text-[#cccccc] bg-[#1e1e1e]/95 border border-[#ffc800]/50 shadow-lg flex items-center gap-2 whitespace-nowrap">
          <span className="text-[#ffc800] font-bold">SPLIT</span>
          {split.midTitle != null ? (
            <span className="text-[#d4a5ff]">mid_title = {split.midTitle.toFixed(0)}px</span>
          ) : null}
          {midX != null ? (
            <span className="text-[#ffc800]">mid_x = {midX.toFixed(0)}px</span>
          ) : null}
          <span className="text-[#666]">|</span>
          <span className="text-[#dcdcaa]">{VIEW_SOURCE_LABELS[source] ?? source}</span>
          {hasAmbiguous ? (
            <>
              <span className="text-[#666]">|</span>
              <span className="text-[#d4b238]">VIEW-AMBIGUOUS</span>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function hasGroutViewportPanels(panels: ParsedViewPanels | null | undefined): boolean {
  return Boolean(panels?.panels?.some(isGroutViewSplitPanel));
}
