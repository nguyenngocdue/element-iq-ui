import React from 'react';
import { ParsedViewTitle, ParsedViewTitles, TAGGED_VIEW_NAMES } from '../lib/viewTitles';

const VIEW_COLORS: Record<string, { border: string; line: string; chip: string }> = {
  'PLAN AS CAST': {
    border: '#c586c0',
    line: 'rgba(197, 134, 192, 0.55)',
    chip: 'bg-[#c586c0]/95 border-[#c586c0]',
  },
  'REINFORCEMENT PLAN': {
    border: '#ce9178',
    line: 'rgba(206, 145, 120, 0.55)',
    chip: 'bg-[#ce9178]/95 border-[#ce9178]',
  },
};

/** Short axis guide length multiplier (relative to display bbox). */
const AXIS_GUIDE_SCALE = 1.6;
/** mid_title vertical guide as fraction of sheet height (centered on titles). */
const MID_TITLE_GUIDE_HEIGHT_RATIO = 0.5;
/** Axis stub length from origin in analysis px (@300dpi). */
const ORIGIN_AXIS_ANALYSIS_PX = 100;
/** Clearance below View Split top chips (PLAN / REINF labels). */
const ORIGIN_LABEL_TOP_OFFSET_PX = 44;

type TitleOverlayProps = {
  data: ParsedViewTitles;
  viewerWidth: number;
  viewerHeight: number;
  viewerScale: number;
  unitScale?: number;
};

export function TitleOverlay({
  data,
  viewerWidth,
  viewerHeight,
  viewerScale,
  unitScale = 1,
}: TitleOverlayProps) {
  const { titles, midTitle, missing } = data;
  const toScreen = (v: number) => v * unitScale * viewerScale;
  const w = viewerWidth * viewerScale;
  const h = viewerHeight * viewerScale;

  const computedMidTitle = midTitle;
  const plan = titles.find((t) => t.name === 'PLAN AS CAST');
  const reinf = titles.find((t) => t.name === 'REINFORCEMENT PLAN');

  const midGuide =
    computedMidTitle != null
      ? (() => {
          const anchorY =
            plan && reinf
              ? (toScreen(plan.center[1]) + toScreen(reinf.center[1])) / 2
              : h / 2;
          const guideH = h * MID_TITLE_GUIDE_HEIGHT_RATIO;
          const top = Math.max(0, anchorY - guideH / 2);
          return {
            top,
            height: Math.min(guideH, h - top),
            left: toScreen(computedMidTitle),
          };
        })()
      : null;

  return (
    <div
      className="absolute inset-0 pointer-events-none overflow-hidden z-[21]"
      style={{ width: w, height: h }}
      aria-label="View title boundary overlay"
    >
      <OriginMarker toScreen={toScreen} />

      {titles.map((title) => (
        <TitleMarkers key={title.name} title={title} toScreen={toScreen} />
      ))}

      {midGuide ? (
        <>
          <div
            className="absolute w-0 border-l-2 border-dashed border-[#d4a5ff]"
            style={{
              left: midGuide.left,
              top: midGuide.top,
              height: midGuide.height,
            }}
          />
          <div
            className="absolute px-2 py-0.5 rounded text-[9px] font-mono text-[#d4a5ff] bg-[#1e1e1e]/90 border border-[#d4a5ff]/40 whitespace-nowrap"
            style={{
              left: Math.max(8, midGuide.left + 6),
              top: Math.max(8, midGuide.top + 6),
            }}
          >
            mid_title = {computedMidTitle!.toFixed(0)}px
          </div>
        </>
      ) : null}

      {missing.length > 0 ? (
        <div className="absolute top-3 right-3 px-2 py-1 rounded text-[10px] font-mono text-[#d4b238] bg-[#1e1e1e]/95 border border-[#d4b238]/50 shadow-lg">
          {missing.map((name) => `${name} not found`).join(' · ')}
        </div>
      ) : null}
    </div>
  );
}

function TitleMarkers({
  title,
  toScreen,
}: {
  title: ParsedViewTitle;
  toScreen: (v: number) => number;
}) {
  const colors = VIEW_COLORS[title.name] ?? VIEW_COLORS['PLAN AS CAST'];
  const [x1, y1, x2, y2] = title.bbox;
  const [cx, cy] = title.center;
  const left = toScreen(x1);
  const top = toScreen(y1);
  const width = Math.max(2, toScreen(x2) - toScreen(x1));
  const height = Math.max(2, toScreen(y2) - toScreen(y1));
  const lineX = toScreen(cx);
  const crossY = toScreen(cy);
  const guideH = Math.max(height * AXIS_GUIDE_SCALE, 48);
  const guideTop = crossY - guideH / 2;

  return (
    <>
      <div
        className="absolute border-2 border-dashed rounded-sm"
        style={{
          left,
          top,
          width,
          height,
          borderColor: colors.border,
          boxShadow: `0 0 6px ${colors.border}40`,
        }}
        aria-label={`${title.name} title boundary`}
      />
      <div
        className="absolute w-px border-l border-dashed"
        style={{
          left: lineX,
          top: guideTop,
          height: guideH,
          borderColor: colors.line,
        }}
      />
      <div
        className="absolute -translate-x-1/2 -translate-y-1/2"
        style={{ left: lineX, top: crossY }}
      >
        <div
          className="absolute w-3 h-px -translate-x-1/2"
          style={{ backgroundColor: colors.border, left: '50%', top: '50%' }}
        />
        <div
          className="absolute h-3 w-px -translate-y-1/2"
          style={{ backgroundColor: colors.border, left: '50%', top: '50%' }}
        />
        <div
          className="absolute w-1.5 h-1.5 rounded-full -translate-x-1/2 -translate-y-1/2"
          style={{ backgroundColor: colors.border, left: '50%', top: '50%' }}
        />
      </div>
      <div
        className={`absolute px-2 py-0.5 rounded text-[10px] font-bold font-mono tracking-wide text-white shadow-lg border whitespace-nowrap ${colors.chip}`}
        style={{ left, top: top + height + 6 }}
      >
        {title.name} · ({cx.toFixed(0)}, {cy.toFixed(0)})
      </div>
    </>
  );
}

function OriginMarker({ toScreen }: { toScreen: (v: number) => number }) {
  const axisLen = toScreen(ORIGIN_AXIS_ANALYSIS_PX);

  return (
    <>
      <div
        className="absolute left-0 top-0 h-0 border-t-2 border-[#ffc800]"
        style={{ width: axisLen }}
        aria-hidden
      />
      <div
        className="absolute left-0 top-0 w-0 border-l-2 border-[#ffc800]"
        style={{ height: axisLen }}
        aria-hidden
      />
      <div
        className="absolute -translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-[#ffc800] border border-[#1e1e1e] shadow-sm"
        style={{ left: 0, top: 0 }}
        aria-hidden
      />
      <div
        className="absolute px-1.5 py-0.5 rounded text-[9px] font-mono font-bold text-[#ffc800] bg-[#1e1e1e]/95 border border-[#ffc800]/50 whitespace-nowrap shadow-sm"
        style={{ left: Math.max(axisLen + 8, 8), top: ORIGIN_LABEL_TOP_OFFSET_PX }}
      >
        (0, 0)
      </div>
    </>
  );
}

export function hasViewTitlesData(data: ParsedViewTitles | null | undefined): boolean {
  return (data?.titles.length ?? 0) > 0;
}

export { TAGGED_VIEW_NAMES };
