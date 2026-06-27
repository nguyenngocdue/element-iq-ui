import { useCallback, useMemo, useState } from 'react';
import { AlertTriangle, Globe, Monitor, Users } from 'lucide-react';
import { adminApi, type AdminSessionRow } from '../../lib/adminApi';
import { formatRelativeTime } from '../../lib/adminFormat';
import { useAdminPaginatedLoad } from '../../hooks/useAdminPaginatedLoad';
import { useTableSort } from '../../hooks/useTableSort';
import { cn } from '../../lib/utils';
import {
  AdminIndexCell,
  AdminIndexHeader,
  AdminKpiCard,
  AdminPagination,
  AdminSearchInput,
  AdminSortHeader,
  AdminStatusBadge,
  AdminTableShell,
  adminRowNumber,
} from './AdminShared';
import { PanelLoading } from '../LoadingScreen';

type KindFilter = 'all' | 'user' | 'guest';
type StatusFilter = 'online' | 'history' | 'all';

export function AdminSessionsTab({ refreshKey }: { refreshKey: number }) {
  const [kind, setKind] = useState<KindFilter>('all');
  const [status, setStatus] = useState<StatusFilter>('online');
  const [stats, setStats] = useState<Record<string, number> | null>(null);

  const fetchSessions = useCallback(
    async (search: string, page: number, pageSize: number) => {
      const params = new URLSearchParams({
        page: String(page),
        page_size: String(pageSize),
        kind,
        status,
      });
      if (search.trim()) params.set('search', search.trim());
      const res = await adminApi.sessions(params);
      setStats(res.stats);
      return { items: res.items, total: res.total, page: res.page, page_size: res.page_size, pages: res.pages };
    },
    [kind, status],
  );

  const {
    rows,
    searchInput,
    setSearchInput,
    page,
    setPage,
    pageSize,
    setPageSize,
    total,
    pages,
    loading,
    searching,
    error,
    setError,
  } = useAdminPaginatedLoad({ fetcher: fetchSessions, refreshKey, defaultPageSize: 50 });

  const { sortKey, sortDir, toggleSort, sortRows } = useTableSort('last_seen_at');

  const sortedRows = useMemo(
    () =>
      sortRows(rows as AdminSessionRow[], {
        identity: (r) => r.username ?? r.guest_viewer_id ?? '',
        device_label: (r) => r.device_label,
        ip_address: (r) => r.ip_address ?? '',
        location: (r) => r.location ?? '',
        last_seen_at: (r) => r.last_seen_at ?? '',
        first_seen_at: (r) => r.first_seen_at ?? '',
      }),
    [rows, sortRows],
  );

  return (
    <div className="space-y-6">
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <AdminKpiCard
            label="Online now"
            value={String(stats.online_total ?? 0)}
            subtext={`${stats.online_users ?? 0} users · ${stats.online_guests ?? 0} guests`}
            icon={Monitor}
            accent="green"
          />
          <AdminKpiCard
            label="Unique devices (30d)"
            value={String(stats.unique_devices_30d ?? 0)}
            subtext="Logged-in browsers"
            icon={Users}
          />
          <AdminKpiCard
            label="New locations today"
            value={String(stats.new_location_today ?? 0)}
            subtext="Security alerts"
            icon={AlertTriangle}
            accent={stats.new_location_today ? 'amber' : undefined}
          />
          <AdminKpiCard
            label="Geo lookup"
            value="GeoIP"
            subtext="City / region from IP"
            icon={Globe}
          />
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <FilterGroup
          label="Audience"
          value={kind}
          options={[
            { id: 'all', label: 'All' },
            { id: 'user', label: 'Logged-in' },
            { id: 'guest', label: 'Guests' },
          ]}
          onChange={(v) => {
            setKind(v as KindFilter);
            setPage(1);
          }}
        />
        <FilterGroup
          label="Status"
          value={status}
          options={[
            { id: 'online', label: 'Online' },
            { id: 'history', label: 'History' },
            { id: 'all', label: 'All' },
          ]}
          onChange={(v) => {
            setStatus(v as StatusFilter);
            setPage(1);
          }}
        />
      </div>

      {error && <div className="text-[#f87171] text-sm">{error}</div>}

      {loading && rows.length === 0 ? (
        <PanelLoading eyebrow="Admin" title="Loading sessions…" />
      ) : (
        <AdminTableShell
          title="Sessions"
          totalRows={total}
          description="Logged-in users and guest viewers — online presence and history"
          toolbar={(
            <AdminSearchInput
              value={searchInput}
              onChange={setSearchInput}
              placeholder="Search user, email, IP, device…"
              isSearching={searching}
            />
          )}
        >
          <div className={cn('overflow-x-auto transition-opacity', searching && 'opacity-60')}>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#262626] text-left text-[#737373] text-xs uppercase tracking-wide">
                <AdminIndexHeader />
                <th className="px-4 py-3 font-medium">Status</th>
                <AdminSortHeader label="User / Guest" sortKey="identity" activeKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <AdminSortHeader label="Device" sortKey="device_label" activeKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <AdminSortHeader label="IP" sortKey="ip_address" activeKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <AdminSortHeader label="Location" sortKey="location" activeKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <th className="px-4 py-3 font-medium">Page / Project</th>
                <AdminSortHeader label="Last seen" sortKey="last_seen_at" activeKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
              </tr>
            </thead>
            <tbody>
              {sortedRows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-[#737373]">
                    No sessions match this filter.
                  </td>
                </tr>
              ) : (
                sortedRows.map((row, idx) => (
                  <tr key={row.id} className="border-b border-[#1a1a1a] hover:bg-[#111]">
                    <AdminIndexCell n={adminRowNumber(page, pageSize, idx)} />
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            'inline-block w-2 h-2 rounded-full',
                            row.is_online ? 'bg-[#10b981] shadow-[0_0_6px_#10b981]' : 'bg-[#525252]',
                          )}
                          title={row.is_online ? 'Online' : 'Offline'}
                        />
                        {row.is_new_location && (
                          <AdminStatusBadge status="NEW LOC" />
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {row.session_kind === 'user' ? (
                        <div>
                          <div className="text-white font-medium">{row.username ?? '—'}</div>
                          <div className="text-[11px] text-[#737373]">{row.email ?? row.full_name ?? row.user_id}</div>
                        </div>
                      ) : (
                        <div>
                          <div className="text-white font-medium">Guest</div>
                          <div className="text-[11px] text-[#737373] font-mono truncate max-w-[180px]" title={row.guest_viewer_id ?? ''}>
                            {row.guest_viewer_id ?? '—'}
                          </div>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-[#e5e5e5]">{row.device_label}</div>
                      <div className="text-[10px] text-[#525252] font-mono truncate max-w-[160px]" title={row.device_id}>
                        {row.device_id.slice(0, 8)}…
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-[#a3a3a3]">{row.ip_address ?? '—'}</td>
                    <td className="px-4 py-3 text-[#a3a3a3]">{row.location ?? '—'}</td>
                    <td className="px-4 py-3 text-[#737373] text-xs">
                      <div className="truncate max-w-[200px]" title={row.current_path ?? ''}>
                        {row.current_path ?? '—'}
                      </div>
                      {row.project_name && (
                        <div className="text-[#525252] truncate max-w-[200px]">{row.project_name}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-[#737373]">{formatRelativeTime(row.last_seen_at)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          <AdminPagination
            page={page}
            pages={pages}
            total={total}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
          />
          </div>
        </AdminTableShell>
      )}
    </div>
  );
}

function FilterGroup<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: Array<{ id: T; label: string }>;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex items-center gap-1 rounded-lg border border-[#262626] bg-[#141414] p-1">
      <span className="px-2 text-[10px] uppercase tracking-wide text-[#525252]">{label}</span>
      {options.map((opt) => (
        <button
          key={opt.id}
          type="button"
          onClick={() => onChange(opt.id)}
          className={cn(
            'px-3 py-1.5 rounded text-xs transition-colors',
            value === opt.id ? 'bg-[#262626] text-white' : 'text-[#737373] hover:text-white',
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
