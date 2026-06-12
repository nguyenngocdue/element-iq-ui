import type { LucideIcon } from 'lucide-react';
import { ArrowDown, ArrowUp, ArrowUpDown, Loader2, X } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { SortDir } from '../../hooks/useTableSort';

export function AdminKpiCard({
  label,
  value,
  subtext,
  icon: Icon,
  accent = 'green',
}: {
  label: string;
  value: string;
  subtext?: string;
  icon: LucideIcon;
  accent?: 'green' | 'amber' | 'purple';
}) {
  const accentClass =
    accent === 'amber' ? 'text-[#fbbf24]' : accent === 'purple' ? 'text-[#c4b5fd]' : 'text-[#34d399]';
  return (
    <div className="bg-[#141414] border border-[#262626] rounded-lg p-5 relative overflow-hidden">
      <Icon className={cn('absolute top-4 right-4 w-5 h-5 opacity-30', accentClass)} />
      <p className="text-[12px] text-[#b0b0b0] mb-1">{label}</p>
      <p className="text-[28px] font-semibold tabular-nums text-white leading-tight">{value}</p>
      {subtext && <p className="text-[11px] text-[#737373] mt-1">{subtext}</p>}
    </div>
  );
}

export function AdminStatusBadge({ status }: { status: string }) {
  const s = status.toUpperCase();
  let cls = 'bg-[#737373]/15 text-[#a3a3a3] border-[#525252]';
  if (s === 'ADMIN' || s === 'PASS' || s === 'COMPLETED' || s === 'HEALTHY') {
    cls = 'bg-[#10b981]/15 text-[#34d399] border-[#10b981]/30';
  } else if (s === 'SUPER ADMIN' || s.includes('SUPER')) {
    cls = 'bg-[#a78bfa]/15 text-[#c4b5fd] border-[#7c3aed]/30';
  } else if (s === 'PROCESSING' || s === 'PENDING') {
    cls = 'bg-[#f59e0b]/15 text-[#fbbf24] border-[#f59e0b]/30';
  } else if (s === 'FAILED' || s === 'FAIL') {
    cls = 'bg-[#ef4444]/15 text-[#f87171] border-[#ef4444]/30';
  } else if (s === 'VIEWER') {
    cls = 'bg-[#5eead4]/15 text-[#5eead4] border-[#14b8a6]/30';
  }
  return (
    <span className={cn('inline-flex px-2 py-0.5 rounded text-[11px] font-medium border uppercase tracking-wide', cls)}>
      {status}
    </span>
  );
}

export function AdminRoleToggle({
  checked,
  disabled,
  onChange,
}: {
  checked: boolean;
  disabled?: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className={cn(
        'w-10 h-5 rounded-full relative transition-colors shrink-0',
        disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer',
        checked ? 'bg-[#10b981]' : 'bg-[#404040]',
      )}
    >
      <span
        className={cn(
          'absolute top-[2px] w-4 h-4 rounded-full bg-white transition-all',
          checked ? 'left-[22px]' : 'left-[2px]',
        )}
      />
    </button>
  );
}

export function AdminConfirmModal({
  open,
  title,
  message,
  confirmLabel,
  danger,
  onConfirm,
  onCancel,
  loading,
}: {
  open: boolean;
  title: string;
  message: React.ReactNode;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70">
      <div className="bg-[#141414] border border-[#262626] rounded-lg w-full max-w-md p-6 shadow-2xl">
        <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
        <div className="text-sm text-[#b0b0b0] mb-6">{message}</div>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="px-4 py-2 rounded-md text-sm text-[#b0b0b0] hover:text-white hover:bg-[#262626] transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={cn(
              'px-4 py-2 rounded-md text-sm font-semibold transition-colors',
              danger
                ? 'bg-[#ef4444]/20 text-[#f87171] border border-[#ef4444]/40 hover:bg-[#ef4444]/30'
                : 'bg-[#10b981] text-white hover:bg-[#059669]',
            )}
          >
            {loading ? '…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export function AdminTableShell({
  title,
  description,
  totalRows,
  toolbar,
  children,
}: {
  title: string;
  description?: string;
  totalRows?: number;
  toolbar?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-white flex flex-wrap items-baseline gap-x-2">
            {title}
            {totalRows !== undefined && (
              <span className="text-[13px] font-normal text-[#737373] tabular-nums">
                {totalRows.toLocaleString()} {totalRows === 1 ? 'row' : 'rows'}
              </span>
            )}
          </h2>
          {description && <p className="text-sm text-[#737373] mt-0.5">{description}</p>}
        </div>
        {toolbar}
      </div>
      <div className="border border-[#262626] rounded-lg overflow-hidden bg-[#0a0a0a]">{children}</div>
    </div>
  );
}

export function AdminSearchInput({
  value,
  onChange,
  placeholder,
  isSearching,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  isSearching?: boolean;
}) {
  return (
    <div className="relative w-full sm:w-64">
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? 'Search…'}
        className="bg-[#141414] border border-[#262626] rounded-md pl-3 pr-9 py-2 text-sm text-white placeholder-[#737373] focus:outline-none focus:border-[#10b981]/40 w-full"
      />
      <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
        {isSearching && <Loader2 className="w-3.5 h-3.5 text-[#737373] animate-spin" />}
        {value && !isSearching && (
          <button
            type="button"
            onClick={() => onChange('')}
            className="p-0.5 rounded text-[#737373] hover:text-white transition-colors"
            aria-label="Clear search"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

export function profileInitials(fullName: string | null, username: string): string {
  const source = fullName?.trim() || username;
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return (source.charAt(0) || '?').toUpperCase();
}

export function adminRowNumber(page: number, pageSize: number, index: number): number {
  return (page - 1) * pageSize + index + 1;
}

export function AdminIndexHeader() {
  return (
    <th className="w-12 px-3 py-3 text-center font-medium text-[11px] uppercase text-[#737373]">#</th>
  );
}

export function AdminIndexCell({ n }: { n: number }) {
  return (
    <td className="px-3 py-3 text-center text-[#525252] tabular-nums text-[12px]">{n}</td>
  );
}

export function AdminPagination({
  page,
  pages,
  total,
  pageSize,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [50, 100, 200, 500],
}: {
  page: number;
  pages: number;
  total: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  pageSizeOptions?: readonly number[];
}) {
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-4 py-3 border-t border-[#262626] bg-[#141414]/40">
      <p className="text-[12px] text-[#737373] tabular-nums">
        {total === 0 ? 'No rows' : `${total.toLocaleString()} rows · showing ${start}–${end}`}
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-[12px] text-[#737373]">
          Rows
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className="bg-[#141414] border border-[#262626] rounded px-2 py-1 text-white text-[12px] focus:outline-none focus:border-[#10b981]/40"
          >
            {pageSizeOptions.map((n) => (
              <option key={n} value={n}>
                {n}/page
              </option>
            ))}
          </select>
        </label>
        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
            className="px-2.5 py-1 rounded text-[12px] text-[#b0b0b0] border border-[#262626] hover:text-white disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Prev
          </button>
          <span className="px-2 text-[12px] text-[#737373] tabular-nums">
            {page} / {pages}
          </span>
          <button
            type="button"
            disabled={page >= pages}
            onClick={() => onPageChange(page + 1)}
            className="px-2.5 py-1 rounded text-[12px] text-[#b0b0b0] border border-[#262626] hover:text-white disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}

export function AdminSortHeader({
  label,
  sortKey,
  activeKey,
  sortDir,
  onSort,
  align = 'left',
  className,
}: {
  label: string;
  sortKey: string;
  activeKey: string | null;
  sortDir: SortDir;
  onSort: (key: string) => void;
  align?: 'left' | 'right' | 'center';
  className?: string;
}) {
  const active = activeKey === sortKey;
  const Icon = active ? (sortDir === 'asc' ? ArrowUp : ArrowDown) : ArrowUpDown;
  const alignClass =
    align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left';
  const btnAlignClass =
    align === 'right' ? 'justify-end' : align === 'center' ? 'justify-center' : 'justify-start';

  return (
    <th className={cn('px-4 py-3 font-medium', alignClass, className)}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={cn(
          'inline-flex items-center gap-1 uppercase tracking-wide transition-colors hover:text-white w-full',
          btnAlignClass,
          active ? 'text-[#5eead4]' : 'text-[#737373]',
        )}
      >
        {label}
        <Icon className={cn('w-3 h-3 shrink-0', active ? 'opacity-100' : 'opacity-40')} />
      </button>
    </th>
  );
}
