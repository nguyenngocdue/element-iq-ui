import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '../lib/utils';

export const EXPLORER_TOOLTIP_SHELL_CLASS =
  'bg-[#1e1e1e] border border-[#3c3c3c] rounded-lg shadow-xl px-3 py-2.5 text-[10px] space-y-1 min-w-[220px] max-w-[360px] select-text cursor-text pointer-events-auto';

export function useExplorerHoverTooltip(delayMs = 200) {
  const anchorRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
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

  const renderTooltip = useCallback(
    (content: ReactNode) => {
      if (!open || !anchorRef.current) return null;
      const rect = anchorRef.current.getBoundingClientRect();
      return createPortal(
        <div
          className="fixed z-[300]"
          style={{ left: rect.right - 6, top: rect.top, paddingLeft: 6 }}
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
    [open, show, hideSoon],
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
    <div className="text-[#858585]">
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
