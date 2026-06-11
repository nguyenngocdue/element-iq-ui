import React from 'react';
import { ParsedViewSplit, VIEW_CONFIDENCE_THRESHOLD } from '../lib/viewSplit';

type ViewSplitOverlayProps = {
  split: ParsedViewSplit;
  /** Width of the viewer content area before scale (PDF points or PNG px). */
  viewerWidth: number;
  /** Height of the viewer content area before scale. */
  viewerHeight: number;
  /** Viewer zoom scale. */
  viewerScale: number;
  /**
   * Multiply analysis coordinates (300 DPI px) into viewer units before viewerScale.
   * PNG artifact: 1. PDF canvas: 72/300.
   */
  unitScale?: number;
};

/**
 * SVG/CSS overlay for PLAN AS CAST | REINFORCEMENT PLAN boundary (Sub-spec C §4).
 */
export function ViewSplitOverlay({
  split,
  viewerWidth,
  viewerHeight,
  viewerScale,
  unitScale = 1,
}: ViewSplitOverlayProps) {
  const { boundaryX, midX, midTitle, source, viewRegions, objects, hasAmbiguous } = split;
  const toScreen = (x: number) => x * unitScale * viewerScale;
  const w = viewerWidth * viewerScale;
  const h = viewerHeight * viewerScale;
  const lineX = toScreen(boundaryX);

  const planRegion = viewRegions['PLAN AS CAST'];
  const reinfRegion = viewRegions['REINFORCEMENT PLAN'];

  const ambiguousObjects = objects.filter(
    (o) => o.view_confidence != null && o.view_confidence < VIEW_CONFIDENCE_THRESHOLD,
  );

  return (
    <div
      className="absolute inset-0 pointer-events-none overflow-hidden z-20"
      style={{ width: w, height: h }}
      aria-label="View split boundary overlay"
    >
      <div
        className="absolute top-0 left-0 bg-[#82aaff]/15 border-r-2 border-[#82aaff]/40"
        style={{ width: lineX, height: h }}
      />
      <div
        className="absolute top-0 bg-[#4ec9b0]/15 border-l-2 border-[#4ec9b0]/40"
        style={{ left: lineX, width: Math.max(0, w - lineX), height: h }}
      />

      <div
        className="absolute top-0 bottom-0 w-[3px] -translate-x-1/2"
        style={{
          left: lineX,
          background: 'repeating-linear-gradient(to bottom, #ffc800 0 10px, transparent 10px 18px)',
          boxShadow: '0 0 8px rgba(255, 200, 0, 0.6)',
        }}
      />

      <div className="absolute top-3 left-3 px-2 py-1 rounded text-[11px] font-bold font-mono tracking-wide text-white bg-[#82aaff]/95 shadow-lg border border-[#82aaff]">
        PLAN AS CAST
        {planRegion ? ` · ${planRegion.tube_ids.length} tubes` : ''}
      </div>
      <div
        className="absolute top-3 px-2 py-1 rounded text-[11px] font-bold font-mono tracking-wide text-white bg-[#4ec9b0]/95 shadow-lg border border-[#4ec9b0]"
        style={{ left: Math.min(lineX + 12, w - 180) }}
      >
        REINFORCEMENT PLAN
        {reinfRegion ? ` · ${reinfRegion.tube_ids.length} tubes` : ''}
      </div>

      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-full text-[10px] font-mono text-[#cccccc] bg-[#1e1e1e]/95 border border-[#ffc800]/50 shadow-lg flex items-center gap-2 whitespace-nowrap">
        <span className="text-[#ffc800] font-bold">SPLIT</span>
        {midTitle != null ? (
          <span className="text-[#d4a5ff]">mid_title = {midTitle.toFixed(0)}px</span>
        ) : null}
        <span className="text-[#ffc800]">mid_x = {midX.toFixed(0)}px</span>
        <span className="text-[#666]">|</span>
        <span className="text-[#dcdcaa]">{source}</span>
        {hasAmbiguous ? (
          <>
            <span className="text-[#666]">|</span>
            <span className="text-[#d4b238]">VIEW-AMBIGUOUS</span>
          </>
        ) : null}
      </div>

      {ambiguousObjects.map((obj) => {
        const [x1, y1, x2, y2] = obj.bbox;
        return (
          <div
            key={obj.id}
            className="absolute border-2 border-[#ff8c00] rounded-sm bg-[#ff8c00]/20"
            style={{
              left: toScreen(x1) - 2,
              top: toScreen(y1) - 2,
              width: toScreen(x2) - toScreen(x1) + 4,
              height: toScreen(y2) - toScreen(y1) + 4,
            }}
          >
            <span className="absolute -top-4 left-0 text-[9px] font-bold font-mono text-[#ff8c00] whitespace-nowrap bg-[#1e1e1e]/80 px-1 rounded">
              #{obj.id} uncertain
            </span>
          </div>
        );
      })}
    </div>
  );
}
