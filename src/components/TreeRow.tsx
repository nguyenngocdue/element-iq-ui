import React from 'react';
import { cn } from '../lib/utils';

/** Width of one tree indent column (guides + branch). */
export const TREE_GUIDE_W = 14;

const GUIDE_COLOR = '#404352';

/**
 * VS Code–style tree row with vertical/horizontal guide lines.
 *
 * - `continuingGuides[i]` — draw a vertical pipe in column i (ancestor has more siblings below).
 * - `isLast` — current node is the last sibling at its depth (└ vs ├).
 */
export function TreeRow({
  continuingGuides,
  isLast,
  onClick,
  className,
  children,
  active,
  title,
}: {
  key?: React.Key;
  continuingGuides: boolean[];
  isLast: boolean;
  onClick?: (e: React.MouseEvent) => void;
  className?: string;
  children: React.ReactNode;
  active?: boolean;
  title?: string;
}) {
  return (
    <div
      onClick={onClick}
      title={title}
      className={cn(
        'flex items-stretch min-h-[26px] select-none',
        onClick && 'cursor-pointer',
        active ? 'bg-[#333748] text-white' : 'text-[#a0a5b5] hover:bg-[#25272e] hover:text-white',
        className,
      )}
    >
      <div className="flex shrink-0 self-stretch pl-2" aria-hidden>
        {continuingGuides.map((cont, i) => (
          <div key={i} className="relative shrink-0" style={{ width: TREE_GUIDE_W }}>
            {cont && (
              <div
                className="absolute top-0 bottom-0 w-px"
                style={{ left: 6, backgroundColor: GUIDE_COLOR }}
              />
            )}
          </div>
        ))}
        <div className="relative shrink-0" style={{ width: TREE_GUIDE_W }}>
          <div
            className="absolute top-0 w-px"
            style={{ left: 6, height: '50%', backgroundColor: GUIDE_COLOR }}
          />
          <div
            className="absolute top-1/2 h-px"
            style={{ left: 6, right: 0, backgroundColor: GUIDE_COLOR }}
          />
          {!isLast && (
            <div
              className="absolute bottom-0 w-px"
              style={{ left: 6, top: '50%', backgroundColor: GUIDE_COLOR }}
            />
          )}
        </div>
      </div>
      <div className="flex flex-1 items-center min-w-0 gap-2 pr-3 py-1">{children}</div>
    </div>
  );
}

/** Root row (e.g. "All drawings") — chevron only, no branch lines. */
export function TreeRootRow({
  onClick,
  className,
  children,
  title,
}: {
  onClick?: () => void;
  className?: string;
  children: React.ReactNode;
  title?: string;
}) {
  return (
    <div
      onClick={onClick}
      title={title}
      className={cn(
        'flex items-center min-h-[26px] gap-2 pl-3 pr-3 py-1 select-none',
        onClick && 'cursor-pointer',
        'text-[#a0a5b5] hover:bg-[#25272e] hover:text-white',
        className,
      )}
    >
      {children}
    </div>
  );
}
