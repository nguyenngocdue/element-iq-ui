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

  const plan = titles.find((t) => t.name === 'PLAN AS CAST');
  const reinf = titles.find((t) => t.name === 'REINFORCEMENT PLAN');
  const computedMidTitle =
    midTitle ??
    (plan && reinf ? (plan.center[0] + reinf.center[0]) / 2 : null);

  return (
    <div
      className="absolute inset-0 pointer-events-none overflow-hidden z-[21]"
      style={{ width: w, height: h }}
      aria-label="View title boundary overlay"
    >
      {titles.map((title) => (
        <TitleMarkers
          key={title.name}
          title={title}
          viewerHeight={h}
          toScreen={toScreen}
        />
      ))}

      {computedMidTitle != null ? (
        <>
          <div
            className="absolute top-0 bottom-0 w-px border-l border-dashed border-[#d4a5ff]/80"
            style={{ left: toScreen(computedMidTitle) }}
          />
          <div
            className="absolute bottom-14 px-2 py-0.5 rounded text-[9px] font-mono text-[#d4a5ff] bg-[#1e1e1e]/90 border border-[#d4a5ff]/40"
            style={{ left: Math.max(8, toScreen(computedMidTitle) + 6) }}
          >
            mid_title = {computedMidTitle.toFixed(0)}px
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
  viewerHeight,
  toScreen,
}: {
  title: ParsedViewTitle;
  viewerHeight: number;
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
        className="absolute top-0 w-px border-l border-dashed"
        style={{
          left: lineX,
          height: viewerHeight,
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
        style={{ left, top: Math.max(4, top - 22) }}
      >
        {title.name} · cx={cx.toFixed(0)}
      </div>
    </>
  );
}

export function hasViewTitlesData(data: ParsedViewTitles | null | undefined): boolean {
  return (data?.titles.length ?? 0) > 0;
}

export { TAGGED_VIEW_NAMES };
