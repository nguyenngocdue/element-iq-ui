import React from 'react';
import {
  ParsedViewPanels,
  ViewPanelItem,
  ViewportTextSpan,
} from '../lib/viewPanels';

const PANEL_COLORS: Record<string, { border: string; fill: string; chip: string }> = {
  plan_view: {
    border: '#00c800',
    fill: 'rgba(0, 200, 0, 0.08)',
    chip: 'bg-[#00c800]/90 border-[#00c800]',
  },
  reinforcement_plan: {
    border: '#ff8c00',
    fill: 'rgba(255, 140, 0, 0.08)',
    chip: 'bg-[#ff8c00]/90 border-[#ff8c00]',
  },
  section_view: {
    border: '#ff7800',
    fill: 'rgba(255, 120, 0, 0.08)',
    chip: 'bg-[#ff7800]/90 border-[#ff7800]',
  },
  view: {
    border: '#ffb400',
    fill: 'rgba(255, 180, 0, 0.08)',
    chip: 'bg-[#ffb400]/90 border-[#ffb400]',
  },
  detail: {
    border: '#0050c8',
    fill: 'rgba(0, 80, 200, 0.08)',
    chip: 'bg-[#0050c8]/90 border-[#0050c8]',
  },
  detail_view: {
    border: '#0050c8',
    fill: 'rgba(0, 80, 200, 0.08)',
    chip: 'bg-[#0050c8]/90 border-[#0050c8]',
  },
  rigging_diagram: {
    border: '#b400b4',
    fill: 'rgba(180, 0, 180, 0.08)',
    chip: 'bg-[#b400b4]/90 border-[#b400b4]',
  },
  title_block: {
    border: '#787878',
    fill: 'rgba(120, 120, 120, 0.08)',
    chip: 'bg-[#787878]/90 border-[#787878]',
  },
};

const ORIGIN_AXIS_ANALYSIS_PX = 100;

type ViewportOverlayProps = {
  data: ParsedViewPanels;
  viewerWidth: number;
  viewerHeight: number;
  viewerScale: number;
  unitScale?: number;
  /** Panel dashed boxes, labels, detached text spans. */
  showPanels?: boolean;
  /** Origin, sheet size, panel corner (x, y) in analysis px. */
  showCoords?: boolean;
};

function panelColors(viewClass: string) {
  return (
    PANEL_COLORS[viewClass] ?? {
      border: '#4ade80',
      fill: 'rgba(74, 222, 128, 0.08)',
      chip: 'bg-[#4ade80]/90 border-[#4ade80]',
    }
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
        style={{ left: Math.max(axisLen + 8, 8), top: 44 }}
      >
        (0, 0)
      </div>
    </>
  );
}

function SheetBoundaryMarker({
  sheetW,
  sheetH,
  toScreen,
}: {
  sheetW: number;
  sheetH: number;
  toScreen: (v: number) => number;
}) {
  const w = toScreen(sheetW);
  const h = toScreen(sheetH);

  return (
    <>
      <div
        className="absolute left-0 top-0 border border-[#858585]/60 pointer-events-none"
        style={{ width: w, height: h }}
        aria-hidden
      />
      <CornerLabel
        x={sheetW}
        y={sheetH}
        label={`(${sheetW}, ${sheetH})`}
        color="#858585"
        toScreen={toScreen}
        placement="below"
      />
    </>
  );
}

function CornerLabel({
  x,
  y,
  label,
  color,
  toScreen,
  placement,
}: {
  x: number;
  y: number;
  label: string;
  color: string;
  toScreen: (v: number) => number;
  placement: 'above' | 'below';
}) {
  const left = toScreen(x);
  const top = toScreen(y);

  return (
    <div
      className="absolute pointer-events-none"
      style={{ left, top }}
    >
      <div
        className="absolute w-2 h-2 rounded-full border border-[#1e1e1e] -translate-x-1/2 -translate-y-1/2"
        style={{ backgroundColor: color, left: 0, top: 0 }}
      />
      <div
        className="absolute px-1 py-0.5 rounded text-[8px] font-mono text-white bg-[#1e1e1e]/90 border whitespace-nowrap -translate-x-1/2"
        style={{
          borderColor: `${color}80`,
          left: 0,
          top: placement === 'above' ? -18 : 10,
        }}
      >
        {label}
      </div>
    </div>
  );
}

function PanelCorner({
  localLeft,
  localTop,
  label,
  color,
  placement,
}: {
  localLeft: number;
  localTop: number;
  label: string;
  color: string;
  placement: 'above' | 'below';
}) {
  return (
    <div className="absolute pointer-events-none" style={{ left: localLeft, top: localTop }}>
      <div
        className="absolute w-2 h-2 rounded-full border border-[#1e1e1e] -translate-x-1/2 -translate-y-1/2"
        style={{ backgroundColor: color, left: 0, top: 0 }}
      />
      <div
        className="absolute px-1 py-0.5 rounded text-[8px] font-mono text-white bg-[#1e1e1e]/90 border whitespace-nowrap -translate-x-1/2"
        style={{
          borderColor: `${color}80`,
          left: 0,
          top: placement === 'above' ? -18 : 10,
        }}
      >
        {label}
      </div>
    </div>
  );
}

function TextSpanBox({
  span,
  toScreen,
}: {
  span: ViewportTextSpan;
  toScreen: (v: number) => number;
}) {
  const [x1, y1, x2, y2] = span.bbox_px;
  const left = toScreen(x1);
  const top = toScreen(y1);
  const width = Math.max(toScreen(x2) - left, 2);
  const height = Math.max(toScreen(y2) - top, 2);

  return (
    <div
      className="absolute pointer-events-none"
      style={{ left, top, width, height, border: '1px solid #00dcff' }}
    >
      <span
        className="absolute left-0 -translate-y-full text-[8px] font-mono text-[#00dcff] bg-[#1e1e1e]/90 px-0.5 leading-tight"
        style={{ top: 0 }}
      >
        #{span.index}
      </span>
    </div>
  );
}

function PanelBox({
  panel,
  toScreen,
  showPanels,
  showCoords,
}: {
  panel: ViewPanelItem;
  toScreen: (v: number) => number;
  showPanels: boolean;
  showCoords: boolean;
}) {
  const [x1, y1, x2, y2] = panel.bbox_px;
  const left = toScreen(x1);
  const top = toScreen(y1);
  const width = toScreen(x2) - left;
  const height = toScreen(y2) - top;
  const colors = panelColors(panel.view_class);
  const label = panel.name
    ? `${panel.id}. ${panel.name} · ${(panel.confidence * 100).toFixed(0)}%`
    : `${panel.id}. ${panel.view_class} (?) · ${(panel.confidence * 100).toFixed(0)}%`;
  const textHint =
    panel.text_count != null && panel.text_count > 0 ? ` · ${panel.text_count} text` : '';

  if (!showPanels && !showCoords) return null;

  return (
    <div
      className="absolute pointer-events-none"
      style={{ left, top, width, height }}
    >
      {showPanels ? (
        <>
          <div
            className="absolute inset-0"
            style={{
              border: `2px dashed ${colors.border}`,
              backgroundColor: colors.fill,
            }}
          />
          <div
            className={`absolute left-0 -top-5 px-1.5 py-0.5 text-[10px] font-mono text-white border rounded-sm whitespace-nowrap ${colors.chip}`}
          >
            {label}{textHint}
          </div>
          {panel.text_spans?.map((span) => (
            <TextSpanBox key={`${panel.id}-${span.index}`} span={span} toScreen={toScreen} />
          ))}
        </>
      ) : null}
      {showCoords ? (
        <>
          <PanelCorner localLeft={0} localTop={0} label={`(${x1}, ${y1})`} color={colors.border} placement="above" />
          <PanelCorner localLeft={width} localTop={0} label={`(${x2}, ${y1})`} color={colors.border} placement="above" />
          <PanelCorner localLeft={0} localTop={height} label={`(${x1}, ${y2})`} color={colors.border} placement="below" />
          <PanelCorner localLeft={width} localTop={height} label={`(${x2}, ${y2})`} color={colors.border} placement="below" />
        </>
      ) : null}
    </div>
  );
}

export function ViewportOverlay({
  data,
  viewerWidth,
  viewerHeight,
  viewerScale,
  unitScale = 1,
  showPanels = true,
  showCoords = false,
}: ViewportOverlayProps) {
  const toScreen = (v: number) => v * unitScale * viewerScale;
  const w = viewerWidth * viewerScale;
  const h = viewerHeight * viewerScale;
  const [sheetW, sheetH] = data.sheet_size_px;

  if (!showPanels && !showCoords) return null;

  return (
    <div
      className="absolute inset-0 pointer-events-none overflow-hidden z-[22]"
      style={{ width: w, height: h }}
      aria-label="Viewports overlay"
    >
      {showCoords ? <OriginMarker toScreen={toScreen} /> : null}
      {showCoords && sheetW > 0 && sheetH > 0 ? (
        <SheetBoundaryMarker sheetW={sheetW} sheetH={sheetH} toScreen={toScreen} />
      ) : null}
      {data.panels.map((panel) => (
        <PanelBox
          key={panel.id}
          panel={panel}
          toScreen={toScreen}
          showPanels={showPanels}
          showCoords={showCoords}
        />
      ))}
    </div>
  );
}

export { hasViewPanelsData } from '../lib/viewPanels';
