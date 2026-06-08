import React from 'react';
import { ChevronDown, ListFilter } from 'lucide-react';
import { cn } from '../lib/utils';
import {
  DEFAULT_EXPLORER_SORT,
  DEFAULT_EXPLORER_STATUS,
  ExplorerSortKey,
  ExplorerStatusFilter,
  explorerViewIsActive,
} from '../lib/fileView';

const SORT_OPTIONS: { id: ExplorerSortKey; label: string }[] = [
  { id: 'name-asc', label: 'Name (A–Z)' },
  { id: 'name-desc', label: 'Name (Z–A)' },
  { id: 'date-desc', label: 'Date created' },
  { id: 'size-desc', label: 'File size' },
];

const STATUS_OPTIONS: { id: ExplorerStatusFilter; label: string; color?: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'PASS', label: 'Pass', color: 'text-[#2eb886]' },
  { id: 'FAIL', label: 'Fail', color: 'text-[#ef4444]' },
  { id: 'NO-NOTE', label: 'No note', color: 'text-[#bba438]' },
];

export function ExplorerViewMenu({
  sort,
  status,
  onSortChange,
  onStatusChange,
  compact = false,
  align = 'left',
}: {
  sort: ExplorerSortKey;
  status: ExplorerStatusFilter;
  onSortChange: (sort: ExplorerSortKey) => void;
  onStatusChange: (status: ExplorerStatusFilter) => void;
  compact?: boolean;
  align?: 'left' | 'right';
}) {
  const [open, setOpen] = React.useState(false);
  const rootRef = React.useRef<HTMLDivElement>(null);
  const isActive = explorerViewIsActive(sort, status);

  React.useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'relative transition-colors',
          compact
            ? cn(
                'p-1 rounded',
                isActive
                  ? 'text-[#10b981]'
                  : 'text-[#858585] hover:text-white',
              )
            : cn(
                'flex items-center gap-1.5 px-2 py-1 rounded text-[11px] font-medium border',
                isActive
                  ? 'border-[#10b981]/40 bg-[#10b981]/10 text-[#10b981]'
                  : 'border-[#3c3c3c] bg-[#252526] text-[#a0a5b5] hover:text-white hover:border-[#555]',
              ),
        )}
        title="View: sort and filter"
        aria-expanded={open}
        aria-haspopup="menu"
      >
        {compact ? (
          <ListFilter className="w-3.5 h-3.5" />
        ) : (
          <>
            <ListFilter className="w-3 h-3 shrink-0" />
            <span>View</span>
            <ChevronDown className={cn('w-3 h-3 shrink-0 transition-transform', open && 'rotate-180')} />
          </>
        )}
        {compact && isActive && (
          <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-[#10b981]" />
        )}
      </button>

      {open && (
        <div
          role="menu"
          className={cn(
            'absolute top-full mt-1 z-50 min-w-[176px] rounded border border-[#3c3c3c] bg-[#1e1f24] shadow-2xl py-1 text-[11px]',
            align === 'right' ? 'right-0' : 'left-0',
          )}
        >
          <div className="px-2.5 py-1 text-[9px] font-semibold uppercase tracking-wider text-[#666]">
            Sort by
          </div>
          {SORT_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              role="menuitemradio"
              aria-checked={sort === opt.id}
              onClick={() => {
                onSortChange(opt.id);
                setOpen(false);
              }}
              className={cn(
                'w-full flex items-center gap-2 px-2.5 py-1 hover:bg-[#2a2d36] transition-colors',
                sort === opt.id ? 'text-white' : 'text-[#b4b4b4]',
              )}
            >
              <span className="w-3 text-[#10b981] text-[10px]">{sort === opt.id ? '●' : ''}</span>
              {opt.label}
            </button>
          ))}

          <div className="my-1 mx-2 border-t border-[#333]" />

          <div className="px-2.5 py-1 text-[9px] font-semibold uppercase tracking-wider text-[#666]">
            Status
          </div>
          {STATUS_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              role="menuitemradio"
              aria-checked={status === opt.id}
              onClick={() => {
                onStatusChange(opt.id);
                setOpen(false);
              }}
              className={cn(
                'w-full flex items-center gap-2 px-2.5 py-1 hover:bg-[#2a2d36] transition-colors',
                status === opt.id ? 'text-white' : opt.color ?? 'text-[#b4b4b4]',
              )}
            >
              <span className="w-3 text-[#10b981] text-[10px]">{status === opt.id ? '●' : ''}</span>
              {opt.label}
            </button>
          ))}

          {isActive && (
            <>
              <div className="my-1 mx-2 border-t border-[#333]" />
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  onSortChange(DEFAULT_EXPLORER_SORT);
                  onStatusChange(DEFAULT_EXPLORER_STATUS);
                  setOpen(false);
                }}
                className="w-full text-left px-2.5 py-1 text-[#777] hover:text-white hover:bg-[#2a2d36] transition-colors"
              >
                Reset
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
