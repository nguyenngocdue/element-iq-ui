import { useCallback, useMemo, useState } from 'react';
import { Archive, Trash2 } from 'lucide-react';
import { adminApi, type AdminProjectRow } from '../../lib/adminApi';
import { formatBytes, formatRelativeTime } from '../../lib/adminFormat';
import { useAdminPaginatedLoad } from '../../hooks/useAdminPaginatedLoad';
import { useTableSort } from '../../hooks/useTableSort';
import { cn } from '../../lib/utils';
import { AdminConfirmModal, AdminIndexCell, AdminIndexHeader, AdminPagination, AdminSearchInput, AdminSortHeader, AdminStatusBadge, AdminTableShell, adminRowNumber } from './AdminShared';
import { PanelLoading } from '../LoadingScreen';

export function AdminProjectsTab({ refreshKey }: { refreshKey: number }) {
  const fetchProjects = useCallback(async (search: string, page: number, pageSize: number) => {
    const params = new URLSearchParams({ page: String(page), page_size: String(pageSize) });
    if (search.trim()) params.set('search', search.trim());
    return adminApi.projects(params);
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
  } = useAdminPaginatedLoad({ fetcher: fetchProjects, refreshKey, defaultPageSize: 50 });

  const [deleteTarget, setDeleteTarget] = useState<AdminProjectRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const { sortKey, sortDir, toggleSort, sortRows } = useTableSort('updated_at', 'desc');

  const sortedRows = useMemo(
    () =>
      sortRows(rows, {
        name: (r) => r.name,
        owner_username: (r) => r.owner_username,
        file_count: (r) => r.file_count,
        storage_bytes: (r) => r.storage_bytes,
        status: (r) => (r.is_archived ? 'archived' : r.is_public ? 'public' : 'private'),
        created_at: (r) => r.created_at ?? '',
        updated_at: (r) => r.updated_at ?? '',
      }),
    [rows, sortRows],
  );
  async function toggleArchive(row: AdminProjectRow) {
    try {
      await adminApi.patchProject(row.id, { is_archived: !row.is_archived });
      setRows((prev) =>
        prev.map((r) => (r.id === row.id ? { ...r, is_archived: !r.is_archived } : r)),
      );
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Update failed');
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await adminApi.deleteProject(deleteTarget.id);
      setRows((prev) => prev.filter((r) => r.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Delete failed');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <AdminTableShell
        title="Projects"
        totalRows={total}
        description="All projects across the workspace"
        toolbar={(
          <AdminSearchInput
            value={searchInput}
            onChange={setSearchInput}
            placeholder="Search project…"
            isSearching={searching}
          />
        )}
      >
        {error && <p className="px-4 py-3 text-sm text-[#f87171]">{error}</p>}
        {loading && rows.length === 0 ? (
          <PanelLoading eyebrow="Admin" title="Loading projects…" />
        ) : sortedRows.length === 0 ? (
          <p className="px-4 py-8 text-sm text-[#737373]">No projects found.</p>
        ) : (
          <div className={cn('overflow-x-auto transition-opacity', searching && 'opacity-60')}>
            <table className="w-full text-[13px]">
              <thead>
                <tr className="bg-[#141414] text-[11px] border-b border-[#262626]">
                  <AdminIndexHeader />
                  <AdminSortHeader label="Project" sortKey="name" activeKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                  <AdminSortHeader label="Owner" sortKey="owner_username" activeKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                  <AdminSortHeader label="Files" sortKey="file_count" activeKey={sortKey} sortDir={sortDir} onSort={toggleSort} align="right" />
                  <AdminSortHeader label="Storage" sortKey="storage_bytes" activeKey={sortKey} sortDir={sortDir} onSort={toggleSort} align="right" />
                  <AdminSortHeader label="Status" sortKey="status" activeKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                  <AdminSortHeader label="Created" sortKey="created_at" activeKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                  <AdminSortHeader label="Updated" sortKey="updated_at" activeKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                  <th className="text-right px-4 py-3 font-medium text-[11px] uppercase text-[#737373]">Actions</th>
                </tr>              </thead>
              <tbody>
                {sortedRows.map((row, index) => (
                  <tr key={row.id} className="border-b border-[#1f1f1f] hover:bg-[#141414]/60">
                    <AdminIndexCell n={adminRowNumber(page, pageSize, index)} />
                    <td className="px-4 py-3 text-white font-medium">{row.name}</td>
                    <td className="px-4 py-3 text-[#b0b0b0]">{row.owner_username}</td>
                    <td className="px-4 py-3 text-right text-[#b0b0b0] tabular-nums">{row.file_count}</td>
                    <td className="px-4 py-3 text-right text-[#b0b0b0] tabular-nums">{formatBytes(row.storage_bytes)}</td>
                    <td className="px-4 py-3">
                      {row.is_archived ? (
                        <AdminStatusBadge status="Archived" />
                      ) : row.is_public ? (
                        <AdminStatusBadge status="Public" />
                      ) : (
                        <AdminStatusBadge status="Private" />
                      )}
                    </td>
                    <td className="px-4 py-3 text-[#737373]">{formatRelativeTime(row.created_at)}</td>
                    <td className="px-4 py-3 text-[#737373]">{formatRelativeTime(row.updated_at)}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => void toggleArchive(row)}
                          className="p-1.5 rounded text-[#737373] hover:text-white hover:bg-[#262626] transition-colors"
                          title={row.is_archived ? 'Unarchive' : 'Archive'}
                        >
                          <Archive className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(row)}
                          className="p-1.5 rounded text-[#737373] hover:text-[#f87171] hover:bg-[#ef4444]/10 transition-colors"
                          title="Delete project"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
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
        open={Boolean(deleteTarget)}
        title="Delete project"
        message={
          deleteTarget ? (
            <>
              Permanently delete project <strong className="text-white">{deleteTarget.name}</strong> with{' '}
              {deleteTarget.file_count} file(s)?
            </>
          ) : null
        }
        confirmLabel="Delete project"
        danger
        loading={deleting}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => void confirmDelete()}
      />
    </>
  );
}
