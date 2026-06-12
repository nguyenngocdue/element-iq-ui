import { useCallback, useMemo, useState } from 'react';
import { Crown } from 'lucide-react';
import { adminApi, type AdminUserRow } from '../../lib/adminApi';
import { formatBytes, formatRelativeTime } from '../../lib/adminFormat';
import { useAdminPaginatedLoad } from '../../hooks/useAdminPaginatedLoad';
import { useTableSort } from '../../hooks/useTableSort';
import { cn } from '../../lib/utils';
import {
  AdminConfirmModal,
  AdminIndexCell,
  AdminIndexHeader,
  AdminPagination,
  AdminRoleToggle,
  AdminSearchInput,
  AdminSortHeader,
  AdminStatusBadge,
  AdminTableShell,
  adminRowNumber,
  profileInitials,
} from './AdminShared';
import { PanelLoading } from '../LoadingScreen';

export function AdminUsersTab({
  refreshKey,
  isSuperAdmin,
}: {
  refreshKey: number;
  isSuperAdmin: boolean;
}) {
  const fetchUsers = useCallback(async (search: string, page: number, pageSize: number) => {
    const params = new URLSearchParams({ page: String(page), page_size: String(pageSize) });
    if (search.trim()) params.set('search', search.trim());
    return adminApi.users(params);
  }, []);

  const {
    rows,
    setRows,
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
  } = useAdminPaginatedLoad({ fetcher: fetchUsers, refreshKey, defaultPageSize: 50 });

  const [pending, setPending] = useState<AdminUserRow | null>(null);
  const [grantMode, setGrantMode] = useState(true);
  const [saving, setSaving] = useState(false);
  const { sortKey, sortDir, toggleSort, sortRows } = useTableSort('username');

  const sortedRows = useMemo(
    () =>
      sortRows(rows, {
        username: (r) => r.username,
        email: (r) => r.email ?? '',
        role: (r) => (r.is_super_admin ? 'SUPER' : r.role),
        project_count: (r) => r.project_count,
        storage_bytes: (r) => r.storage_bytes,
        last_activity_at: (r) => r.last_activity_at ?? '',
        created_at: (r) => r.created_at ?? '',
        updated_at: (r) => r.updated_at ?? '',
      }),
    [rows, sortRows],
  );
  async function applyRoleChange() {
    if (!pending) return;
    setSaving(true);
    try {
      const newRole = grantMode ? 'ADMIN' : 'USER';
      await adminApi.setUserRole(pending.id, newRole);
      setRows((prev) =>
        prev.map((r) => (r.id === pending.id ? { ...r, role: newRole } : r)),
      );
      setPending(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Role update failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      {isSuperAdmin && (
        <div className="mb-4 flex items-center gap-2 px-4 py-3 rounded-lg border border-[#7c3aed]/30 bg-[#a78bfa]/10 text-[#c4b5fd] text-sm">
          <Crown className="w-4 h-4 shrink-0" />
          Super Admin mode — you can grant or revoke admin access for other users.
        </div>
      )}
      {!isSuperAdmin && (
        <div className="mb-4 px-4 py-3 rounded-lg border border-[#262626] bg-[#141414] text-[#737373] text-sm">
          Admin users can manage files and projects. Contact Super Admin to change roles.
        </div>
      )}

      <AdminTableShell
        title="Users"
        totalRows={total}
        description="All workspace accounts and storage usage"
        toolbar={(
          <AdminSearchInput
            value={searchInput}
            onChange={setSearchInput}
            placeholder="Search email or username…"
            isSearching={searching}
          />
        )}
      >
        {error && <p className="px-4 py-3 text-sm text-[#f87171]">{error}</p>}
        {loading && rows.length === 0 ? (
          <PanelLoading eyebrow="Admin" title="Loading users…" />
        ) : (
          <div className={cn('overflow-x-auto transition-opacity', searching && 'opacity-60')}>
            <table className="w-full text-[13px]">
              <thead>
                <tr className="bg-[#141414] text-[11px] border-b border-[#262626]">
                  <AdminIndexHeader />
                  <AdminSortHeader label="User" sortKey="username" activeKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                  <AdminSortHeader label="Email" sortKey="email" activeKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                  <AdminSortHeader label="Role" sortKey="role" activeKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                  <AdminSortHeader label="Projects" sortKey="project_count" activeKey={sortKey} sortDir={sortDir} onSort={toggleSort} align="right" />
                  <AdminSortHeader label="Storage" sortKey="storage_bytes" activeKey={sortKey} sortDir={sortDir} onSort={toggleSort} align="right" />
                  <AdminSortHeader label="Created" sortKey="created_at" activeKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                  <AdminSortHeader label="Updated" sortKey="updated_at" activeKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                  <AdminSortHeader label="Last active" sortKey="last_activity_at" activeKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                  {isSuperAdmin && <th className="text-center px-4 py-3 font-medium text-[11px] uppercase text-[#737373]">Admin access</th>}
                </tr>              </thead>
              <tbody>
                {sortedRows.map((row, index) => {
                  const isAdminRole = row.role === 'ADMIN';
                  return (
                    <tr key={row.id} className="border-b border-[#1f1f1f] hover:bg-[#141414]/60">
                      <AdminIndexCell n={adminRowNumber(page, pageSize, index)} />
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-[#262626] flex items-center justify-center text-xs font-semibold text-[#5eead4]">
                            {profileInitials(row.full_name, row.username)}
                          </div>
                          <div>
                            <div className="text-white font-medium flex items-center gap-1">
                              {row.username}
                              {row.is_super_admin && <Crown className="w-3 h-3 text-[#c4b5fd]" />}
                            </div>
                            {row.full_name && <div className="text-[#737373] text-xs">{row.full_name}</div>}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-[#b0b0b0]">{row.email ?? '—'}</td>
                      <td className="px-4 py-3">
                        <AdminStatusBadge status={row.is_super_admin ? 'Super Admin' : row.role} />
                      </td>
                      <td className="px-4 py-3 text-right text-[#b0b0b0] tabular-nums">{row.project_count}</td>
                      <td className="px-4 py-3 text-right text-[#b0b0b0] tabular-nums">{formatBytes(row.storage_bytes)}</td>
                      <td className="px-4 py-3 text-[#737373]">{formatRelativeTime(row.created_at)}</td>
                      <td className="px-4 py-3 text-[#737373]">{formatRelativeTime(row.updated_at)}</td>
                      <td className="px-4 py-3 text-[#737373]">{formatRelativeTime(row.last_activity_at)}</td>
                      {isSuperAdmin && (
                        <td className="px-4 py-3 text-center">
                          {row.is_super_admin ? (
                            <span className="text-[11px] text-[#737373]">Locked</span>
                          ) : (
                            <div className="flex justify-center">
                              <AdminRoleToggle
                                checked={isAdminRole}
                                onChange={(next) => {
                                  setGrantMode(next);
                                  setPending(row);
                                }}
                              />
                            </div>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {!loading && (
          <AdminPagination
            page={page}
            pages={pages}
            total={total}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
          />
        )}
      </AdminTableShell>

      <AdminConfirmModal
        open={Boolean(pending)}
        title={grantMode ? 'Grant admin access' : 'Remove admin access'}
        message={
          pending ? (
            <>
              {grantMode ? (
                <>
                  Allow <strong className="text-white">{pending.username}</strong> ({pending.email}) to access
                  Admin Console and manage all projects and files?
                </>
              ) : (
                <>
                  <strong className="text-white">{pending.username}</strong> will lose access to Admin Console
                  immediately.
                </>
              )}
            </>
          ) : null
        }
        confirmLabel={grantMode ? 'Grant access' : 'Remove access'}
        danger={!grantMode}
        loading={saving}
        onCancel={() => setPending(null)}
        onConfirm={() => void applyRoleChange()}
      />
    </>
  );
}
