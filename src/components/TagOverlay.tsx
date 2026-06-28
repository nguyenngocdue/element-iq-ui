import React from 'react';
import { overlayBboxForSpace, bboxCenter, type OverlayCoordinateSpace } from '../lib/displayBbox';
import { overlayToScreen } from '../lib/overlayCoords';
import { ParsedTagNote, ParsedTagNotes, TagBboxKind } from '../lib/tagNotes';
import { ANALYSIS_TO_PDF_UNIT } from '../lib/viewSplit';

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

const KIND_STYLES: Record<
  TagBboxKind,
  { border: string; line: string; width: number; opacity: number; chip?: string }
> = {
  check: { border: '#f97316', line: 'rgba(249, 115, 22, 0.55)', width: 3, opacity: 1 },
  raw: { border: '#ffc800', line: 'rgba(255, 200, 0, 0.45)', width: 1, opacity: 0.92 },
  anchor: { border: '#60a5fa', line: 'rgba(96, 165, 250, 0.45)', width: 2, opacity: 0.95 },
  candidate: { border: '#6b7280', line: 'rgba(107, 114, 128, 0.45)', width: 1, opacity: 0.72 },
  parsed: { border: '#a78bfa', line: 'rgba(167, 139, 250, 0.45)', width: 2, opacity: 0.88 },
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
  coordinateSpace?: OverlayCoordinateSpace;
};

export function TagOverlay({
  data,
  viewerWidth,
  viewerHeight,
  viewerScale,
  unitScale = ANALYSIS_TO_PDF_UNIT,
  coordinateSpace = 'pdfjs',
}: TagOverlayProps) {
  const toScreen = (v: number) =>
    overlayToScreen(v, viewerWidth, viewerScale, undefined, unitScale);
  const w = viewerWidth * viewerScale;
  const h = viewerHeight * viewerScale;

  const sorted = [...data.tags].sort((a, b) => {
    const kindOrder: Record<TagBboxKind, number> = {
      raw: 0,
      anchor: 1,
      parsed: 2,
      candidate: 3,
      check: 4,
    };
    if (kindOrder[a.bboxKind] !== kindOrder[b.bboxKind]) {
      return kindOrder[a.bboxKind] - kindOrder[b.bboxKind];
    }
    if (a.usedForCheck !== b.usedForCheck) return a.usedForCheck ? 1 : -1;
    return 0;
  });

  return (
    <div
      className="absolute inset-0 pointer-events-none overflow-hidden z-[22]"
      style={{ width: w, height: h }}
      aria-label="Qty tag boundary overlay"
    >
      {sorted.map((tag, i) => (
        <TagMarkers
          key={`${tag.bboxKind}-${tag.rawText}-${tag.bbox.join(',')}-${i}`}
          tag={tag}
          coordinateSpace={coordinateSpace}
          toScreen={toScreen}
        />
      ))}
    </div>
  );
}

function tagIsVertical(tag: ParsedTagNote): boolean {
  if (tag.rotationDeg === 90) return true;
  if (tag.rotationDeg === 0) return false;
  const [x1, y1, x2, y2] = tag.bbox;
  return y2 - y1 > (x2 - x1) * 1.15;
}

function TagMarkers({
  tag,
  toScreen,
  coordinateSpace,
}: {
  tag: ParsedTagNote;
  toScreen: (v: number) => number;
  coordinateSpace: OverlayCoordinateSpace;
}) {
  const rejected = Boolean(tag.rejectedReason);
  const sourceColors = rejected ? REJECTED_COLOR : (TAG_COLORS[tag.source] ?? TAG_COLORS.unknown);
  const kind = KIND_STYLES[tag.bboxKind] ?? KIND_STYLES.parsed;
  const colors = tag.bboxKind === 'check' && !rejected
    ? { border: kind.border, line: kind.line, chip: sourceColors.chip }
    : {
        border: kind.border,
        line: kind.line,
        chip: rejected ? REJECTED_COLOR.chip : 'bg-[#1e1e1e]/90 border-white/20',
      };
  const borderWidth = kind.width;
  const opacity = rejected ? 0.72 : kind.opacity;
  const mapped = overlayBboxForSpace(tag.bbox, coordinateSpace);
  const [x1, y1, x2, y2] = mapped;
  const [cx, cy] = bboxCenter(mapped);
  const left = toScreen(x1);
  const top = toScreen(y1);
  const width = Math.max(2, toScreen(x2) - toScreen(x1));
  const height = Math.max(2, toScreen(y2) - toScreen(y1));
  const lineX = toScreen(cx);
  const crossY = toScreen(cy);
  const vertical = tagIsVertical(tag);
  const guideMain = Math.max((vertical ? width : height) * AXIS_GUIDE_SCALE, 40);
  const sourceLabel =
    tag.source === 'ocr' ? 'OCR' : tag.source === 'pdf' ? 'PDF' : tag.source.toUpperCase();

  const statusSuffix = tag.reportStatus && tag.reportStatus !== 'REJECTED'
    ? ` · ${tag.reportStatus}`
    : rejected
      ? ` · rejected`
      : '';

  const kindLabel =
    tag.bboxKind === 'check'
      ? ''
      : tag.bboxKind === 'raw'
        ? ' · PDF bbox'
        : tag.bboxKind === 'anchor'
          ? ' · anchor'
          : tag.bboxKind === 'parsed'
            ? ' · pinned'
            : '';

  const showChip = tag.bboxKind === 'check' || tag.bboxKind === 'candidate';

  const chipStyle: React.CSSProperties = vertical
    ? { left: left + width + 6, top: crossY, transform: 'translateY(-50%)', opacity }
    : { left, top: top + height + 6, opacity };

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
          boxShadow: tag.bboxKind === 'check' ? `0 0 10px ${colors.border}60` : undefined,
        }}
        aria-label={`Tag boundary ${tag.rawText}`}
      />
      {vertical ? (
        <div
          className="absolute h-px border-t border-dashed"
          style={{
            left: lineX - guideMain / 2,
            top: crossY,
            width: guideMain,
            opacity,
            borderColor: colors.line,
          }}
        />
      ) : (
        <div
          className="absolute w-px border-l border-dashed"
          style={{
            left: lineX,
            top: crossY - guideMain / 2,
            height: guideMain,
            opacity,
            borderColor: colors.line,
          }}
        />
      )}
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
      {showChip ? (
        <div
          className={`absolute px-2 py-0.5 rounded text-[10px] font-bold font-mono tracking-wide text-white shadow-lg border whitespace-nowrap ${colors.chip}`}
          style={chipStyle}
        >
          {tag.checkIndex ? `QTY CHECK #${tag.checkIndex}: ` : ''}
          {tag.rawText}
          {tag.usedForCheck ? ` = ${tag.quantity}` : ''}
          {!rejected ? ` · ${sourceLabel}` : ''}
          {statusSuffix}
          {tag.view ? ` · ${tag.view}` : ''}
          {vertical ? ' · VERT' : ''}
          {' · ('}
          {cx.toFixed(0)},{cy.toFixed(0)})
        </div>
      ) : (
        <div
          className="absolute px-1.5 py-0.5 rounded text-[9px] font-mono text-white/90 bg-[#1e1e1e]/85 border border-white/15 whitespace-nowrap"
          style={{ left, top: Math.max(4, top - 18), opacity }}
        >
          {tag.rawText}
          {kindLabel}
        </div>
      )}
    </>
  );
}

export { hasTagNotesData } from '../lib/tagNotes';
