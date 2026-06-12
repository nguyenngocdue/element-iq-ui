import { useCallback, useEffect, useMemo, useState } from 'react';
import { FileText, Trash2 } from 'lucide-react';
import { adminApi, type AdminJobRow } from '../../lib/adminApi';
import { formatRelativeTime } from '../../lib/adminFormat';
import { useTableSort } from '../../hooks/useTableSort';
import { AdminSearchInput, AdminSortHeader, AdminStatusBadge, AdminTableShell } from './AdminShared';
export function AdminJobsTab({ refreshKey }: { refreshKey: number }) {
  const [rows, setRows] = useState<AdminJobRow[]>([]);
  const [active, setActive] = useState<AdminJobRow[]>([]);
  const [searchInput, setSearchInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [logJob, setLogJob] = useState<(AdminJobRow & { analysis_log?: string[] }) | null>(null);
  const [logLoading, setLogLoading] = useState(false);
  const { sortKey, sortDir, toggleSort, sortRows } = useTableSort('created_at', 'desc');

  const filteredRows = useMemo(() => {
    const q = searchInput.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (j) =>
        j.filename.toLowerCase().includes(q) ||
        j.owner_username.toLowerCase().includes(q) ||
        j.id.toLowerCase().includes(q),
    );
  }, [rows, searchInput]);

  const sortedRows = useMemo(
    () =>
      sortRows(filteredRows, {
        filename: (r) => r.filename,
        owner_username: (r) => r.owner_username,
        status: (r) => r.status,
        stage: (r) => r.stage ?? '',
        progress: (r) => r.progress,
        created_at: (r) => r.created_at ?? '',
      }),
    [filteredRows, sortRows],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: '1', page_size: '50' });
      const [list, activeRes] = await Promise.all([
        adminApi.jobs(params),
        adminApi.activeJobs(),
      ]);
      setRows(list.items);
      setActive(activeRes.items);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load jobs');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const interval = window.setInterval(() => {
      void adminApi.activeJobs().then((r) => setActive(r.items)).catch(() => {});
    }, 5000);
    return () => window.clearInterval(interval);
  }, [load, refreshKey]);

  async function openLog(job: AdminJobRow) {
    setLogLoading(true);
    try {
      const detail = await adminApi.jobDetail(job.id);
      setLogJob(detail);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load log');
    } finally {
      setLogLoading(false);
    }
  }

  async function deleteJob(id: string) {
    try {
      await adminApi.deleteJob(id);
      setRows((prev) => prev.filter((j) => j.id !== id));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Delete failed');
    }
  }

  return (
    <>
      {active.length > 0 && (
        <div className="mb-4 px-4 py-3 rounded-lg border border-[#10b981]/30 bg-[#10b981]/5 flex flex-wrap items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#10b981] animate-pulse" />
          <span className="text-sm text-[#34d399] font-medium">{active.length} running</span>
          {active.map((j) => (
            <span key={j.id} className="text-xs text-[#b0b0b0] bg-[#141414] border border-[#262626] rounded px-2 py-1">
              {j.filename} — {j.stage ?? '…'} {j.progress}%
            </span>
          ))}
        </div>
      )}

      <AdminTableShell
        title="Analysis jobs"
        description="History and live analysis queue"
        toolbar={<AdminSearchInput value={searchInput} onChange={setSearchInput} placeholder="Search file or user…" />}
      >
        {error && <p className="px-4 py-3 text-sm text-[#f87171]">{error}</p>}
        {loading && rows.length === 0 ? (
          <p className="px-4 py-8 text-sm text-[#737373] animate-pulse">Loading jobs…</p>
        ) : sortedRows.length === 0 ? (
          <p className="px-4 py-8 text-sm text-[#737373]">No jobs found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="bg-[#141414] text-[11px] border-b border-[#262626]">
                  <AdminSortHeader label="File" sortKey="filename" activeKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                  <AdminSortHeader label="Owner" sortKey="owner_username" activeKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                  <AdminSortHeader label="Status" sortKey="status" activeKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                  <AdminSortHeader label="Stage" sortKey="stage" activeKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                  <AdminSortHeader label="Progress" sortKey="progress" activeKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                  <AdminSortHeader label="Created" sortKey="created_at" activeKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                  <th className="text-right px-4 py-3 font-medium text-[11px] uppercase text-[#737373]">Actions</th>
                </tr>              </thead>
              <tbody>
                {sortedRows.map((row) => (                  <tr key={row.id} className="border-b border-[#1f1f1f] hover:bg-[#141414]/60">
                    <td className="px-4 py-3 text-white max-w-[180px] truncate">{row.filename}</td>
                    <td className="px-4 py-3 text-[#b0b0b0]">{row.owner_username}</td>
                    <td className="px-4 py-3"><AdminStatusBadge status={row.status} /></td>
                    <td className="px-4 py-3 text-[#737373]">{row.stage ?? '—'}</td>
                    <td className="px-4 py-3">
                      <div className="w-20 h-1.5 bg-[#262626] rounded-full overflow-hidden">
                        <div className="h-full bg-[#10b981]" style={{ width: `${row.progress}%` }} />
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[#737373]">{formatRelativeTime(row.created_at)}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => void openLog(row)}
                          className="p-1.5 rounded text-[#737373] hover:text-[#5eead4] hover:bg-[#14b8a6]/10 transition-colors"
                          title="View log"
                        >
                          <FileText className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => void deleteJob(row.id)}
                          className="p-1.5 rounded text-[#737373] hover:text-[#f87171] hover:bg-[#ef4444]/10 transition-colors"
                          title="Delete job"
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
      </AdminTableShell>

      {(logJob || logLoading) && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70">
          <div className="bg-[#0d0d0d] border border-[#262626] rounded-lg w-full max-w-2xl max-h-[80vh] flex flex-col shadow-2xl">
            <div className="px-5 py-4 border-b border-[#262626] flex justify-between items-center">
              <div>
                <h3 className="text-white font-semibold">Analysis log</h3>
                <p className="text-xs text-[#737373]">{logJob?.filename}</p>
              </div>
              <button type="button" onClick={() => setLogJob(null)} className="text-[#737373] hover:text-white text-sm">
                Close
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 font-mono text-[12px] text-[#b0b0b0] space-y-1">
              {logLoading ? (
                <p className="animate-pulse">Loading…</p>
              ) : (
                (logJob?.analysis_log ?? []).map((line, i) => (
                  <div key={i} className="leading-relaxed">{line}</div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
