import React, { type ReactNode } from 'react';
import { useExplorerHoverTooltip, type TooltipPlacement } from '../hooks/useExplorerHoverTooltip';
import { cn } from '../lib/utils';

interface HoverTooltipProps {
  content: ReactNode;
  children: React.ReactNode;
  className?: string;
  delayMs?: number;
  placement?: TooltipPlacement;
  /** Prevent parent HoverTooltip from opening when nested inside another tooltip anchor. */
  stopBubble?: boolean;
}

export function HoverTooltip({
  content,
  children,
  className,
  delayMs,
  placement = 'auto',
  stopBubble,
}: HoverTooltipProps) {
  const { anchorRef, hoverProps, renderTooltip } = useExplorerHoverTooltip(delayMs, placement);

  const wrappedHoverProps = stopBubble
    ? {
        onMouseEnter: (e: React.MouseEvent) => {
          e.stopPropagation();
          hoverProps.onMouseEnter();
        },
        onMouseLeave: (e: React.MouseEvent) => {
          e.stopPropagation();
          hoverProps.onMouseLeave();
        },
      }
    : hoverProps;

  return (
    <div ref={anchorRef} className={cn(className)} {...wrappedHoverProps}>
      {children}
      {renderTooltip(content)}
    </div>
  );
}
