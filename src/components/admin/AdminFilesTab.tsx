import { useCallback, useMemo, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { adminApi, type AdminFileRow } from '../../lib/adminApi';
import { formatBytes, formatRelativeTime } from '../../lib/adminFormat';
import { useAdminSearchLoad } from '../../hooks/useAdminSearchLoad';
import { useTableSort } from '../../hooks/useTableSort';
import { cn } from '../../lib/utils';
import { AdminConfirmModal, AdminSearchInput, AdminSortHeader, AdminStatusBadge, AdminTableShell } from './AdminShared';
export function AdminFilesTab({ refreshKey }: { refreshKey: number }) {
  const fetchFiles = useCallback(async (search: string) => {
    const params = new URLSearchParams({ page: '1', page_size: '50' });
    if (search.trim()) params.set('search', search.trim());
    const res = await adminApi.files(params);
    return res.items;
  }, []);

  const {
    rows,
    setRows,
    searchInput,
    setSearchInput,
    loading,
    searching,
    error,
  } = useAdminSearchLoad({ fetcher: fetchFiles, refreshKey });

  const [deleteTarget, setDeleteTarget] = useState<AdminFileRow | null>(null);
  const [deleting, setDeleting] = useState(false);
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
      setError(e instanceof Error ? e.message : 'Delete failed');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <AdminTableShell
        title="Files"
        description="All uploaded files across users and projects"
        toolbar={(
          <AdminSearchInput
            value={searchInput}
            onChange={setSearchInput}
            placeholder="Search filename…"
            isSearching={searching}
          />
        )}
      >
        {error && <p className="px-4 py-3 text-sm text-[#f87171]">{error}</p>}
        {loading && rows.length === 0 ? (
          <p className="px-4 py-8 text-sm text-[#737373] animate-pulse">Loading files…</p>
        ) : sortedRows.length === 0 ? (
          <p className="px-4 py-8 text-sm text-[#737373]">No files found.</p>
        ) : (
          <div className={cn('overflow-x-auto transition-opacity', searching && 'opacity-60')}>
            <table className="w-full text-[13px]">
              <thead>
                <tr className="bg-[#141414] text-[11px] border-b border-[#262626]">
                  <AdminSortHeader label="File" sortKey="original_filename" activeKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                  <AdminSortHeader label="Owner" sortKey="owner_username" activeKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                  <AdminSortHeader label="Project" sortKey="project_name" activeKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                  <AdminSortHeader label="Category" sortKey="category" activeKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                  <AdminSortHeader label="Size" sortKey="file_size_bytes" activeKey={sortKey} sortDir={sortDir} onSort={toggleSort} align="right" />
                  <AdminSortHeader label="Uploaded" sortKey="uploaded_at" activeKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                  <AdminSortHeader label="Disk" sortKey="disk_exists" activeKey={sortKey} sortDir={sortDir} onSort={toggleSort} align="center" />
                  <th className="text-right px-4 py-3 font-medium text-[11px] uppercase text-[#737373]">Actions</th>
                </tr>              </thead>
              <tbody>
                {sortedRows.map((row) => (                  <tr key={row.id} className="border-b border-[#1f1f1f] hover:bg-[#141414]/60">
                    <td className="px-4 py-3 text-white max-w-[220px] truncate">{row.original_filename}</td>
                    <td className="px-4 py-3 text-[#b0b0b0]">{row.owner_username}</td>
                    <td className="px-4 py-3 text-[#737373]">{row.project_name ?? '—'}</td>
                    <td className="px-4 py-3"><AdminStatusBadge status={row.category} /></td>
                    <td className="px-4 py-3 text-right text-[#b0b0b0] tabular-nums">{formatBytes(row.file_size_bytes)}</td>
                    <td className="px-4 py-3 text-[#737373]">{formatRelativeTime(row.uploaded_at)}</td>
                    <td className="px-4 py-3 text-center">
                      {row.disk_exists ? (
                        <span className="text-[#34d399] text-xs">OK</span>
                      ) : (
                        <span className="text-[#f87171] text-xs font-medium">Missing</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(row)}
                        className="p-1.5 rounded text-[#737373] hover:text-[#f87171] hover:bg-[#ef4444]/10 transition-colors"
                        title="Delete file"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
