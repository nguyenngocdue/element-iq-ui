import React from 'react';
import {
  buildTagDetachScope,
  type TagDetachRegion,
  type TagDetachScope,
} from '../lib/tagDetachScope';
import { isVerticalBbox, type OverlayCoordinateSpace } from '../lib/displayBbox';
import { overlayBboxToScreen, overlayToScreen } from '../lib/overlayCoords';
import { type ParsedViewPanels } from '../lib/viewPanels';
import { ANALYSIS_TO_PDF_UNIT } from '../lib/viewSplit';

const REGION_STYLES: Record<
  TagDetachRegion['kind'],
  { border: string; fill: string; width: number; dash?: string }
> = {
  plan_panel: {
    border: '#22c55e',
    fill: 'rgba(34, 197, 94, 0.06)',
    width: 2,
    dash: '6 4',
  },
  reinf_panel: {
    border: '#f97316',
    fill: 'rgba(249, 115, 22, 0.06)',
    width: 2,
    dash: '6 4',
  },
  detach_hit_margin: {
    border: 'rgba(250, 204, 21, 0.85)',
    fill: 'rgba(250, 204, 21, 0.04)',
    width: 1,
    dash: '3 5',
  },
  plan_reinf_gutter: {
    border: '#ec4899',
    fill: 'rgba(236, 72, 153, 0.18)',
    width: 2,
    dash: '8 4',
  },
  orphan_halo: {
    border: 'rgba(96, 165, 250, 0.55)',
    fill: 'rgba(96, 165, 250, 0.05)',
    width: 1,
    dash: '2 6',
  },
  panel_gap: {
    border: 'rgba(168, 85, 247, 0.7)',
    fill: 'rgba(168, 85, 247, 0.12)',
    width: 1,
    dash: '4 4',
  },
};

type TagDetachScopeOverlayProps = {
  viewPanels: ParsedViewPanels;
  viewerWidth: number;
  viewerHeight: number;
  viewerScale: number;
  unitScale?: number;
  /** PDF.js canvas needs vertical text swap; annotated PNG uses raster coords. */
  coordinateSpace?: OverlayCoordinateSpace;
};

function RegionBox({
  region,
  toScreen,
  zIndex,
}: {
  region: TagDetachRegion;
  toScreen: (v: number) => number;
  zIndex: number;
}) {
  const style = REGION_STYLES[region.kind];
  const [x1, y1, x2, y2] = region.bbox;
  const left = toScreen(x1);
  const top = toScreen(y1);
  const width = Math.max(2, toScreen(x2) - toScreen(x1));
  const height = Math.max(2, toScreen(y2) - toScreen(y1));
  const showLabel = region.kind === 'plan_reinf_gutter' || region.kind === 'plan_panel';

  return (
    <div
      className="absolute pointer-events-none"
      style={{ left, top, width, height, zIndex }}
      aria-hidden={!showLabel}
    >
      <div
        className="absolute inset-0 rounded-sm"
        style={{
          border: `${style.width}px dashed ${style.border}`,
          backgroundColor: style.fill,
        }}
      />
      {showLabel ? (
        <div
          className="absolute px-1.5 py-0.5 rounded text-[9px] font-mono font-bold text-white whitespace-nowrap shadow-md border"
          style={{
            left: region.kind === 'plan_reinf_gutter' ? 4 : 0,
            top: region.kind === 'plan_reinf_gutter' ? 4 : -20,
            backgroundColor: region.kind === 'plan_reinf_gutter' ? '#be185d' : '#15803d',
            borderColor: style.border,
          }}
        >
          {region.label}
        </div>
      ) : null}
    </div>
  );
}

function TagSpanMarker({
  text,
  bbox,
  detachCenter,
  panelLabel,
  coordinateSpace,
  viewerWidth,
  viewerScale,
  sheetSizePx,
  unitScale,
}: {
  text: string;
  bbox: [number, number, number, number];
  detachCenter: [number, number];
  panelLabel: string;
  coordinateSpace: OverlayCoordinateSpace;
  viewerWidth: number;
  viewerScale: number;
  sheetSizePx: [number, number];
  unitScale: number;
}) {
  const vertical = isVerticalBbox(bbox);
  const swapped = coordinateSpace === 'pdfjs' && vertical;
  const { left, top, width, height } = overlayBboxToScreen(
    bbox,
    coordinateSpace,
    viewerWidth,
    viewerScale,
    sheetSizePx,
    unitScale,
  );
  const [dcx, dcy] = detachCenter;
  const dotSize = 8;
  const toScreen = (v: number) =>
    overlayToScreen(v, viewerWidth, viewerScale, sheetSizePx, unitScale);

  return (
    <>
      <div
        className="absolute pointer-events-none"
        style={{ left, top, width, height, zIndex: 30 }}
        title={
          swapped
            ? 'PDF.js overlay (axis swap for vertical Revit PDF strip)'
            : undefined
        }
      >
        <div
          className="absolute inset-0 rounded-sm border-2 border-[#22d3ee]"
          style={{ boxShadow: '0 0 8px rgba(34, 211, 238, 0.45)' }}
        />
        <div
          className="absolute px-1 py-0.5 rounded text-[8px] font-mono text-[#22d3ee] bg-[#1e1e1e]/95 border border-[#22d3ee]/60 whitespace-nowrap max-w-[180px] truncate"
          style={{ left: 0, top: '100%', marginTop: 2 }}
          title={`${text} → ${panelLabel}`}
        >
          {text} → {panelLabel}
        </div>
      </div>
      <div
        className="absolute pointer-events-none rounded-full bg-[#ec4899] border border-white/80"
        style={{
          left: toScreen(dcx) - dotSize / 2,
          top: toScreen(dcy) - dotSize / 2,
          width: dotSize,
          height: dotSize,
          zIndex: 31,
        }}
        title={`Engine detach center (PyMuPDF): ${Math.round(dcx)}, ${Math.round(dcy)}`}
      />
    </>
  );
}

function Legend({ scope }: { scope: TagDetachScope }) {
  return (
    <div className="absolute bottom-2 left-2 z-[40] pointer-events-none max-w-[300px] rounded border border-white/15 bg-[#1e1e1e]/92 px-2 py-1.5 text-[9px] font-mono text-[#cccccc] shadow-lg">
      <div className="font-bold text-[#f472b6] mb-1">Tag detach scope</div>
      <div>panel ±{scope.margins.panel_px}px · gutter +{scope.margins.plan_reinf_px}px</div>
      <div>orphan ≤{scope.margins.orphan_px}px · tags {scope.tagSpans.length}</div>
      <div className="text-[#94a3b8] mt-0.5">cyan tag = PDF.js · pink dot = engine center</div>
    </div>
  );
}

export function TagDetachScopeOverlay({
  viewPanels,
  viewerWidth,
  viewerHeight,
  viewerScale,
  unitScale = ANALYSIS_TO_PDF_UNIT,
  coordinateSpace = 'pdfjs',
}: TagDetachScopeOverlayProps) {
  const scope = buildTagDetachScope(viewPanels);
  const toScreen = (v: number) =>
    overlayToScreen(v, viewerWidth, viewerScale, viewPanels.sheet_size_px, unitScale);
  const w = viewerWidth * viewerScale;
  const h = viewerHeight * viewerScale;

  if (!scope) return null;

  const regionOrder: TagDetachRegion['kind'][] = [
    'orphan_halo',
    'panel_gap',
    'reinf_panel',
    'detach_hit_margin',
    'plan_panel',
    'plan_reinf_gutter',
  ];
  const sortedRegions = [...scope.regions].sort(
    (a, b) => regionOrder.indexOf(a.kind) - regionOrder.indexOf(b.kind),
  );

  return (
    <div
      className="absolute inset-0 pointer-events-none"
      style={{ width: w, height: h, zIndex: 21 }}
      aria-label="Tag detach scope overlay"
    >
      {sortedRegions.map((region) => (
        <RegionBox
          key={`${region.kind}-${region.bbox.join('-')}`}
          region={region}
          toScreen={toScreen}
          zIndex={region.kind === 'plan_reinf_gutter' ? 22 : 20}
        />
      ))}
      {scope.tagSpans.map((span) => (
        <TagSpanMarker
          key={`${span.panelId}-${span.index}-${span.text}`}
          text={span.text}
          bbox={span.bbox_px}
          detachCenter={span.detachCenter}
          panelLabel={span.panelName ?? span.viewClass}
          coordinateSpace={coordinateSpace}
          viewerWidth={viewerWidth}
          viewerScale={viewerScale}
          sheetSizePx={viewPanels.sheet_size_px}
          unitScale={unitScale}
        />
      ))}
      <Legend scope={scope} />
    </div>
  );
}

export { hasTagDetachScopeData, buildTagDetachScope } from '../lib/tagDetachScope';
