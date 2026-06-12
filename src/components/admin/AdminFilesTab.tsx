import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { History, Trash2 } from 'lucide-react';
import { adminApi, type AdminFileRow } from '../../lib/adminApi';
import { formatBytes, formatRelativeTime } from '../../lib/adminFormat';
import { useAdminPaginatedLoad } from '../../hooks/useAdminPaginatedLoad';
import { useTableSort } from '../../hooks/useTableSort';
import { cn } from '../../lib/utils';
import { AdminConfirmModal, AdminIndexCell, AdminIndexHeader, AdminPagination, AdminSearchInput, AdminSortHeader, AdminStatusBadge, AdminTableShell, adminRowNumber } from './AdminShared';
import { PanelLoading } from '../LoadingScreen';

export function AdminFilesTab({ refreshKey }: { refreshKey: number }) {
  const navigate = useNavigate();
  const fetchFiles = useCallback(async (search: string, page: number, pageSize: number) => {
    const params = new URLSearchParams({ page: String(page), page_size: String(pageSize) });
    if (search.trim()) params.set('search', search.trim());
    return adminApi.files(params);
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
  } = useAdminPaginatedLoad({ fetcher: fetchFiles, refreshKey, defaultPageSize: 50 });

  const [deleteTarget, setDeleteTarget] = useState<AdminFileRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const { sortKey, sortDir, toggleSort, sortRows } = useTableSort('uploaded_at', 'desc');

  const sortedRows = useMemo(
    () =>
      sortRows(rows, {
        original_filename: (r) => r.original_filename,
        owner_username: (r) => r.owner_username,
        project_name: (r) => r.project_name ?? '',
        category: (r) => r.category,
        file_size_bytes: (r) => r.file_size_bytes,
        uploaded_at: (r) => r.uploaded_at ?? '',
        disk_exists: (r) => r.disk_exists,
      }),
    [rows, sortRows],
  );
  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await adminApi.deleteFile(deleteTarget.id);
      setRows((prev) => prev.filter((r) => r.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (e: unknown) {
      setActionError(e instanceof Error ? e.message : 'Delete failed');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <AdminTableShell
        title="Files"
        totalRows={total}
        description="All uploaded files across users and projects"
        toolbar={(
          <AdminSearchInput
            value={searchInput}
            onChange={setSearchInput}
            placeholder="Search filename or project…"
            isSearching={searching}
          />
        )}
      >
        {error && <p className="px-4 py-3 text-sm text-[#f87171]">{error}</p>}
        {actionError && <p className="px-4 py-3 text-sm text-[#f87171]">{actionError}</p>}
        {loading && rows.length === 0 ? (
          <PanelLoading eyebrow="Admin" title="Loading files…" />
        ) : sortedRows.length === 0 ? (
          <p className="px-4 py-8 text-sm text-[#737373]">No files found.</p>
        ) : (
          <div className={cn('overflow-x-auto transition-opacity', searching && 'opacity-60')}>
            <table className="w-full text-[13px]">
              <thead>
                <tr className="bg-[#141414] text-[11px] border-b border-[#262626]">
                  <AdminIndexHeader />
                  <AdminSortHeader label="File" sortKey="original_filename" activeKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                  <AdminSortHeader label="Owner" sortKey="owner_username" activeKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                  <AdminSortHeader label="Project" sortKey="project_name" activeKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                  <AdminSortHeader label="Category" sortKey="category" activeKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                  <AdminSortHeader label="Size" sortKey="file_size_bytes" activeKey={sortKey} sortDir={sortDir} onSort={toggleSort} align="right" />
                  <AdminSortHeader label="Uploaded" sortKey="uploaded_at" activeKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                  <th className="text-center px-4 py-3 font-medium text-[11px] uppercase text-[#737373]">Jobs</th>
                  <AdminSortHeader label="Disk" sortKey="disk_exists" activeKey={sortKey} sortDir={sortDir} onSort={toggleSort} align="center" />
                  <th className="text-right px-4 py-3 font-medium text-[11px] uppercase text-[#737373]">Actions</th>
                </tr>              </thead>
              <tbody>
                {sortedRows.map((row, index) => (
                  <tr key={row.id} className="border-b border-[#1f1f1f] hover:bg-[#141414]/60">
                    <AdminIndexCell n={adminRowNumber(page, pageSize, index)} />
                    <td className="px-4 py-3 text-white max-w-[220px] truncate">{row.original_filename}</td>
                    <td className="px-4 py-3 text-[#b0b0b0]">{row.owner_username}</td>
                    <td className="px-4 py-3 text-[#737373]">{row.project_name ?? '—'}</td>
                    <td className="px-4 py-3"><AdminStatusBadge status={row.category} /></td>
                    <td className="px-4 py-3 text-right text-[#b0b0b0] tabular-nums">{formatBytes(row.file_size_bytes)}</td>
                    <td className="px-4 py-3 text-[#737373]">{formatRelativeTime(row.uploaded_at)}</td>
                    <td className="px-4 py-3 text-center tabular-nums text-[#b0b0b0]">{row.job_count ?? 0}</td>
                    <td className="px-4 py-3 text-center">
                      {row.disk_exists === null || row.disk_exists === undefined ? (
                        <span className="text-[#525252] text-xs">—</span>
                      ) : row.disk_exists ? (
                        <span className="text-[#34d399] text-xs">OK</span>
                      ) : (
                        <span className="text-[#f87171] text-xs font-medium">Missing</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-1">
                        {(row.job_count ?? 0) > 0 && (
                          <button
                            type="button"
                            onClick={() => navigate(`/admin?tab=jobs&file_id=${row.id}`)}
                            className="p-1.5 rounded text-[#737373] hover:text-[#5eead4] hover:bg-[#14b8a6]/10 transition-colors"
                            title="View analyze history & artifacts"
                          >
                            <History className="w-4 h-4" />
                          </button>
                        )}
                        <button
                        type="button"
                        onClick={() => setDeleteTarget(row)}
                        className="p-1.5 rounded text-[#737373] hover:text-[#f87171] hover:bg-[#ef4444]/10 transition-colors"
                        title="Delete file"
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
        title="Delete file"
        message={
          deleteTarget ? (
            <>
              Permanently delete <strong className="text-white">{deleteTarget.original_filename}</strong> and all
              related analysis data?
            </>
          ) : null
        }
        confirmLabel="Delete"
        danger
        loading={deleting}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => void confirmDelete()}
      />
    </>
  );
}
