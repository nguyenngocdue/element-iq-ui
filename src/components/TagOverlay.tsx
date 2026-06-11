import React from 'react';
import { ParsedTagNote, ParsedTagNotes } from '../lib/tagNotes';

const TAG_COLORS: Record<
  ParsedTagNote['source'],
  { border: string; line: string; chip: string }
> = {
  ocr: {
    border: '#f97316',
    line: 'rgba(249, 115, 22, 0.55)',
    chip: 'bg-[#f97316]/95 border-[#f97316]',
  },
  pdf: {
    border: '#4ec9b0',
    line: 'rgba(78, 201, 176, 0.55)',
    chip: 'bg-[#4ec9b0]/95 border-[#4ec9b0]',
  },
  peeled: {
    border: '#eab308',
    line: 'rgba(234, 179, 8, 0.55)',
    chip: 'bg-[#eab308]/95 border-[#eab308]',
  },
  unknown: {
    border: '#858585',
    line: 'rgba(133, 133, 133, 0.55)',
    chip: 'bg-[#858585]/95 border-[#858585]',
  },
};

const REJECTED_COLOR = {
  border: '#6b7280',
  line: 'rgba(107, 114, 128, 0.45)',
  chip: 'bg-[#374151]/95 border-[#6b7280]',
};

const AXIS_GUIDE_SCALE = 1.6;

type TagOverlayProps = {
  data: ParsedTagNotes;
  viewerWidth: number;
  viewerHeight: number;
  viewerScale: number;
  unitScale?: number;
};

export function TagOverlay({
  data,
  viewerWidth,
  viewerHeight,
  viewerScale,
  unitScale = 1,
}: TagOverlayProps) {
  const toScreen = (v: number) => v * unitScale * viewerScale;
  const w = viewerWidth * viewerScale;
  const h = viewerHeight * viewerScale;

  const sorted = [...data.tags].sort((a, b) => {
    if (a.usedForCheck !== b.usedForCheck) return a.usedForCheck ? 1 : -1;
    if (a.rejectedReason && !b.rejectedReason) return -1;
    if (!a.rejectedReason && b.rejectedReason) return 1;
    return 0;
  });

  return (
    <div
      className="absolute inset-0 pointer-events-none overflow-hidden z-[22]"
      style={{ width: w, height: h }}
      aria-label="Qty tag boundary overlay"
    >
      {sorted.map((tag, i) => (
        <TagMarkers key={`${tag.rawText}-${tag.bbox.join(',')}-${i}`} tag={tag} toScreen={toScreen} />
      ))}
    </div>
  );
}

function TagMarkers({
  tag,
  toScreen,
}: {
  tag: ParsedTagNote;
  toScreen: (v: number) => number;
}) {
  const rejected = Boolean(tag.rejectedReason);
  const colors = rejected ? REJECTED_COLOR : (TAG_COLORS[tag.source] ?? TAG_COLORS.unknown);
  const borderWidth = tag.usedForCheck ? 3 : rejected ? 1 : 2;
  const opacity = rejected ? 0.72 : 1;
  const [x1, y1, x2, y2] = tag.bbox;
  const [cx, cy] = tag.center;
  const left = toScreen(x1);
  const top = toScreen(y1);
  const width = Math.max(2, toScreen(x2) - toScreen(x1));
  const height = Math.max(2, toScreen(y2) - toScreen(y1));
  const lineX = toScreen(cx);
  const crossY = toScreen(cy);
  const guideH = Math.max(height * AXIS_GUIDE_SCALE, 40);
  const guideTop = crossY - guideH / 2;
  const sourceLabel =
    tag.source === 'ocr' ? 'OCR' : tag.source === 'pdf' ? 'PDF' : tag.source.toUpperCase();

  const statusSuffix = tag.reportStatus && tag.reportStatus !== 'REJECTED'
    ? ` · ${tag.reportStatus}`
    : rejected
      ? ` · rejected`
      : '';

  return (
    <>
      <div
        className="absolute rounded-sm"
        style={{
          left,
          top,
          width,
          height,
          opacity,
          border: `${borderWidth}px dashed ${colors.border}`,
          boxShadow: tag.usedForCheck ? `0 0 10px ${colors.border}60` : undefined,
        }}
        aria-label={`Tag boundary ${tag.rawText}`}
      />
      <div
        className="absolute w-px border-l border-dashed"
        style={{
          left: lineX,
          top: guideTop,
          height: guideH,
          opacity,
          borderColor: colors.line,
        }}
      />
      <div
        className="absolute -translate-x-1/2 -translate-y-1/2"
        style={{ left: lineX, top: crossY, opacity }}
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
        style={{ left, top: top + height + 6, opacity }}
      >
        {tag.checkIndex ? `QTY CHECK #${tag.checkIndex}: ` : ''}
        {tag.rawText}
        {tag.usedForCheck ? ` = ${tag.quantity}` : ''}
        {!rejected ? ` · ${sourceLabel}` : ''}
        {statusSuffix}
        {tag.view ? ` · ${tag.view}` : ''}
        {' · ('}
        {cx.toFixed(0)},{cy.toFixed(0)})
      </div>
    </>
  );
}

export { hasTagNotesData } from '../lib/tagNotes';
