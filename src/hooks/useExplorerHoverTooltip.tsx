import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { cn } from '../lib/utils';

export const EXPLORER_TOOLTIP_SHELL_CLASS =
  'bg-[#1e1e1e] border border-[#3c3c3c] rounded-lg shadow-xl px-3 py-2.5 text-[10px] space-y-1 min-w-[220px] max-w-[360px] select-text cursor-text pointer-events-auto';

export type TooltipPlacement = 'auto' | 'right' | 'below-start' | 'below-end' | 'left';

const GAP = 8;
const VIEWPORT_MARGIN = 8;
const EST_WIDTH = 260;
const EST_HEIGHT = 110;

type Side = 'top' | 'bottom' | 'left' | 'right';
type Align = 'start' | 'end' | 'center';

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(value, max));
}

function fixedHintToSideAlign(placement: Exclude<TooltipPlacement, 'auto'>): { side: Side; align: Align } {
  switch (placement) {
    case 'right':
      return { side: 'right', align: 'start' };
    case 'left':
      return { side: 'left', align: 'start' };
    case 'below-end':
      return { side: 'bottom', align: 'end' };
    case 'below-start':
    default:
      return { side: 'bottom', align: 'start' };
  }
}

function pickAutoSideAlign(anchor: DOMRect, tipW: number, tipH: number): { side: Side; align: Align } {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const m = VIEWPORT_MARGIN;

  const space = {
    top: anchor.top - m,
    bottom: vh - anchor.bottom - m,
    left: anchor.left - m,
    right: vw - anchor.right - m,
  };

  const isCompact = anchor.width <= 48 && anchor.height <= 48;
  const nearRight = anchor.right > vw * 0.62;
  const nearLeft = anchor.left < vw * 0.28;
  const nearBottom = anchor.bottom > vh * 0.72;

  type Candidate = { side: Side; align: Align; score: number };
  const candidates: Candidate[] = [];

  const add = (side: Side, align: Align, avail: number, bonus = 0) => {
    const need = side === 'top' || side === 'bottom' ? tipH + GAP : tipW + GAP;
    if (avail < need) return;
    candidates.push({ side, align, score: avail + bonus });
  };

  add('left', 'start', space.left, nearRight ? (isCompact ? 48 : 24) : 0);
  add('right', 'start', space.right, nearLeft ? (isCompact ? 48 : 24) : 0);
  add('bottom', 'end', space.bottom, nearRight ? 16 : 0);
  add('bottom', 'start', space.bottom, nearLeft ? 16 : 8);
  add('top', 'end', space.top, nearRight && nearBottom ? 32 : 0);
  add('top', 'start', space.top, nearBottom ? 12 : 0);

  candidates.sort((a, b) => b.score - a.score);
  const best = candidates[0];
  return best ?? { side: 'bottom', align: 'start' };
}

export function computeTooltipStyle(
  anchor: DOMRect,
  tipW: number,
  tipH: number,
  placement: TooltipPlacement,
): CSSProperties {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const m = VIEWPORT_MARGIN;

  const { side, align } =
    placement === 'auto'
      ? pickAutoSideAlign(anchor, tipW, tipH)
      : fixedHintToSideAlign(placement);

  let top = 0;
  let left = 0;

  switch (side) {
    case 'bottom':
      top = anchor.bottom + GAP;
      if (align === 'start') left = anchor.left;
      else if (align === 'end') left = anchor.right - tipW;
      else left = anchor.left + (anchor.width - tipW) / 2;
      break;
    case 'top':
      top = anchor.top - tipH - GAP;
      if (align === 'start') left = anchor.left;
      else if (align === 'end') left = anchor.right - tipW;
      else left = anchor.left + (anchor.width - tipW) / 2;
      break;
    case 'right':
      left = anchor.right + GAP;
      if (align === 'start') top = anchor.top;
      else if (align === 'end') top = anchor.bottom - tipH;
      else top = anchor.top + (anchor.height - tipH) / 2;
      break;
    case 'left':
      left = anchor.left - tipW - GAP;
      if (align === 'start') top = anchor.top;
      else if (align === 'end') top = anchor.bottom - tipH;
      else top = anchor.top + (anchor.height - tipH) / 2;
      break;
  }

  left = clamp(left, m, vw - tipW - m);
  top = clamp(top, m, vh - tipH - m);

  return { position: 'fixed', left, top };
}

export function useExplorerHoverTooltip(delayMs = 200, placement: TooltipPlacement = 'right') {
  const anchorRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<CSSProperties>({ position: 'fixed', left: -9999, top: -9999, opacity: 0 });
  const hideRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback(() => {
    if (hideRef.current) {
      clearTimeout(hideRef.current);
      hideRef.current = null;
    }
    setOpen(true);
  }, []);

  const hideSoon = useCallback(() => {
    if (hideRef.current) clearTimeout(hideRef.current);
    hideRef.current = setTimeout(() => {
      setOpen(false);
      hideRef.current = null;
    }, delayMs);
  }, [delayMs]);

  useEffect(() => () => {
    if (hideRef.current) clearTimeout(hideRef.current);
  }, []);

  useLayoutEffect(() => {
    if (!open || !anchorRef.current) return;

    const anchor = anchorRef.current.getBoundingClientRect();
    const tipEl = tooltipRef.current;
    const tipW = tipEl?.offsetWidth || EST_WIDTH;
    const tipH = tipEl?.offsetHeight || EST_HEIGHT;

    setPosition({
      ...computeTooltipStyle(anchor, tipW, tipH, placement),
      opacity: 1,
    });
  }, [open, placement]);

  useEffect(() => {
    if (!open) {
      setPosition({ position: 'fixed', left: -9999, top: -9999, opacity: 0 });
    }
  }, [open]);

  const renderTooltip = useCallback(
    (content: ReactNode) => {
      if (!open || !anchorRef.current) return null;

      return createPortal(
        <div
          ref={tooltipRef}
          className="fixed z-[300]"
          style={position}
          onMouseEnter={show}
          onMouseLeave={hideSoon}
        >
          <div
            className={EXPLORER_TOOLTIP_SHELL_CLASS}
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
          >
            {content}
          </div>
        </div>,
        document.body,
      );
    },
    [open, show, hideSoon, position],
  );

  return {
    anchorRef,
    hoverProps: { onMouseEnter: show, onMouseLeave: hideSoon },
    renderTooltip,
  };
}

export function ExplorerTooltipRow({
  label,
  value,
  valueClassName,
}: {
  label: string;
  value: ReactNode;
  valueClassName?: string;
}) {
  return (
    <div className="text-[#b0b0b0]">
      {label}: <span className={cn('text-white', valueClassName)}>{value}</span>
    </div>
  );
}

export function ExplorerTooltipLocation({ path }: { path: string }) {
  return (
    <div className="text-[#858585] border-t border-[#333] pt-1 mt-1">
      <div className="mb-0.5">Location:</div>
      <span className="text-[#6b9af5] font-mono break-all leading-relaxed">{path}</span>
    </div>
  );
}
