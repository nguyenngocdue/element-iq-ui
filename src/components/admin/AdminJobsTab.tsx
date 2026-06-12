import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Download, ExternalLink, FileText, Trash2, X } from 'lucide-react';
import { adminApi, type AdminArtifactRow, type AdminJobDetail, type AdminJobRow } from '../../lib/adminApi';
import { authFetch } from '../../lib/supabase';
import { formatBytes, formatRelativeTime } from '../../lib/adminFormat';
import { useAdminPaginatedLoad } from '../../hooks/useAdminPaginatedLoad';
import { useTableSort } from '../../hooks/useTableSort';
import { AdminIndexCell, AdminIndexHeader, AdminPagination, AdminSearchInput, AdminSortHeader, AdminStatusBadge, AdminTableShell, adminRowNumber } from './AdminShared';

const ARTIFACT_LABELS: Record<string, string> = {
  ANNOTATED_PNG: 'Annotated PNG',
  ANNOTATED_PDF: 'Annotated PDF',
  REPORT_JSON: 'Report JSON',
};

async function downloadArtifact(artifact: AdminArtifactRow) {
  const sep = artifact.download_url.includes('?') ? '&' : '?';
  const res = await authFetch(`${artifact.download_url}${sep}download=1`);
  if (!res.ok) throw new Error(`Download failed (${res.status})`);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = artifact.original_filename ?? `${artifact.artifact_type.toLowerCase()}`;
  a.click();
  URL.revokeObjectURL(url);
}

async function openArtifactInline(artifact: AdminArtifactRow) {
  const res = await authFetch(artifact.download_url);
  if (!res.ok) throw new Error(`Open failed (${res.status})`);
  const blob = await res.blob();
  window.open(URL.createObjectURL(blob), '_blank', 'noopener,noreferrer');
}

export function AdminJobsTab({ refreshKey }: { refreshKey: number }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const fileFilter = searchParams.get('file_id');
  const fetchJobs = useCallback(
    async (search: string, page: number, pageSize: number) => {
      const params = new URLSearchParams({ page: String(page), page_size: String(pageSize) });
      if (fileFilter) params.set('file_id', fileFilter);
      return adminApi.jobs(params);
    },
    [fileFilter],
  );

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
  } = useAdminPaginatedLoad({ fetcher: fetchJobs, refreshKey, defaultPageSize: 50 });

  const [active, setActive] = useState<AdminJobRow[]>([]);
  const [detailJob, setDetailJob] = useState<AdminJobDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
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
        artifact_count: (r) => r.artifact_count ?? 0,
        created_at: (r) => r.created_at ?? '',
      }),
    [filteredRows, sortRows],
  );

  const loadActive = useCallback(async () => {
    try {
      const activeRes = await adminApi.activeJobs();
      setActive(activeRes.items);
    } catch {
      /* ignore poll errors */
    }
  }, []);

  useEffect(() => {
    void loadActive();
    const interval = window.setInterval(() => void loadActive(), 5000);
    return () => window.clearInterval(interval);
  }, [loadActive, refreshKey]);

  const prevFileFilter = useRef(fileFilter);
  useEffect(() => {
    if (prevFileFilter.current === fileFilter) return;
    prevFileFilter.current = fileFilter;
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete('page');
        return next;
      },
      { replace: true },
    );
  }, [fileFilter, setSearchParams]);

  async function openDetail(job: AdminJobRow) {
    setDetailLoading(true);
    setDetailJob(null);
    try {
      setDetailJob(await adminApi.jobDetail(job.id));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load job detail');
    } finally {
      setDetailLoading(false);
    }
  }

  async function deleteJob(id: string) {
    try {
      await adminApi.deleteJob(id);
      setRows((prev) => prev.filter((j) => j.id !== id));
      if (detailJob?.id === id) setDetailJob(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Delete failed');
    }
  }

  function clearFileFilter() {
    const next = new URLSearchParams(searchParams);
    next.delete('file_id');
    setSearchParams(next, { replace: true });
  }

  const filterLabel = sortedRows[0]?.filename ?? 'this file';

  return (
    <>
      {fileFilter && (
        <div className="mb-4 px-4 py-3 rounded-lg border border-[#262626] bg-[#141414] flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-[#b0b0b0]">
            Showing analysis history for <span className="text-white font-medium">{filterLabel}</span>
            <span className="text-[#737373] ml-2">({total} job(s))</span>
          </p>
          <button
            type="button"
            onClick={clearFileFilter}
            className="inline-flex items-center gap-1 text-xs text-[#737373] hover:text-white"
          >
            <X className="w-3.5 h-3.5" />
            Clear filter
          </button>
        </div>
      )}

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
        totalRows={total}
        description="Each row is one analyze run — open detail to view/download PNG, PDF, JSON artifacts"
        toolbar={<AdminSearchInput value={searchInput} onChange={setSearchInput} placeholder="Search file or user…" isSearching={searching} />}
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
                  <AdminIndexHeader />
                  <AdminSortHeader label="File" sortKey="filename" activeKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                  <AdminSortHeader label="Owner" sortKey="owner_username" activeKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                  <AdminSortHeader label="Status" sortKey="status" activeKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                  <AdminSortHeader label="Artifacts" sortKey="artifact_count" activeKey={sortKey} sortDir={sortDir} onSort={toggleSort} align="center" />
                  <AdminSortHeader label="Created" sortKey="created_at" activeKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                  <th className="text-right px-4 py-3 font-medium text-[11px] uppercase text-[#737373]">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sortedRows.map((row, index) => (
                  <tr key={row.id} className="border-b border-[#1f1f1f] hover:bg-[#141414]/60">
                    <AdminIndexCell n={adminRowNumber(page, pageSize, index)} />
                    <td className="px-4 py-3 text-white max-w-[180px] truncate">{row.filename}</td>
                    <td className="px-4 py-3 text-[#b0b0b0]">{row.owner_username}</td>
                    <td className="px-4 py-3">
                      <AdminStatusBadge status={row.overall_status ?? row.status} />
                    </td>
                    <td className="px-4 py-3 text-center tabular-nums text-[#b0b0b0]">
                      {row.status === 'COMPLETED' ? (row.artifact_count ?? 0) : '—'}
                    </td>
                    <td className="px-4 py-3 text-[#737373]">{formatRelativeTime(row.created_at)}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => void openDetail(row)}
                          className="p-1.5 rounded text-[#737373] hover:text-[#5eead4] hover:bg-[#14b8a6]/10 transition-colors"
                          title="View artifacts & log"
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

      {(detailJob || detailLoading) && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70">
          <div className="bg-[#0d0d0d] border border-[#262626] rounded-lg w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl">
            <div className="px-5 py-4 border-b border-[#262626] flex justify-between items-start gap-3">
              <div className="min-w-0">
                <h3 className="text-white font-semibold">Job detail</h3>
                <p className="text-xs text-[#737373] truncate">{detailJob?.filename}</p>
                {detailJob && (
                  <p className="text-[10px] text-[#525252] font-mono mt-1 truncate">{detailJob.id}</p>
                )}
              </div>
              <button type="button" onClick={() => setDetailJob(null)} className="text-[#737373] hover:text-white text-sm shrink-0">
                Close
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {detailLoading ? (
                <p className="text-sm text-[#737373] animate-pulse">Loading…</p>
              ) : detailJob ? (
                <>
                  <section>
                    <h4 className="text-[11px] uppercase tracking-wide text-[#737373] mb-2">Artifacts</h4>
                    {(detailJob.artifacts ?? []).length === 0 ? (
                      <p className="text-sm text-[#737373]">No artifacts (job incomplete or pruned).</p>
                    ) : (
                      <ul className="space-y-2">
                        {(detailJob.artifacts ?? []).map((a) => (
                          <li
                            key={a.id}
                            className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-md bg-[#141414] border border-[#262626]"
                          >
                            <div className="min-w-0">
                              <p className="text-sm text-white truncate">
                                {ARTIFACT_LABELS[a.artifact_type] ?? a.artifact_type}
                              </p>
                              <p className="text-[11px] text-[#737373] truncate">
                                {a.original_filename ?? a.id}
                                {' · '}
                                {formatBytes(a.file_size_bytes)}
                                {!a.disk_exists && (
                                  <span className="text-[#f87171] ml-1">· missing on disk</span>
                                )}
                              </p>
                            </div>
                            <div className="flex gap-1 shrink-0">
                              {a.disk_exists && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => void openArtifactInline(a).catch((e) => setError(String(e)))}
                                    className="p-1.5 rounded text-[#737373] hover:text-white hover:bg-[#262626]"
                                    title="Open"
                                  >
                                    <ExternalLink className="w-4 h-4" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => void downloadArtifact(a).catch((e) => setError(String(e)))}
                                    className="p-1.5 rounded text-[#737373] hover:text-[#34d399] hover:bg-[#10b981]/10"
                                    title="Download"
                                  >
                                    <Download className="w-4 h-4" />
                                  </button>
                                </>
                              )}
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>

                  <section>
                    <h4 className="text-[11px] uppercase tracking-wide text-[#737373] mb-2">Analysis log</h4>
                    <div className="font-mono text-[12px] text-[#b0b0b0] space-y-1 bg-[#141414] border border-[#262626] rounded-md p-3 max-h-48 overflow-y-auto">
                      {(detailJob.analysis_log ?? []).length === 0 ? (
                        <p className="text-[#737373]">No log lines.</p>
                      ) : (
                        (detailJob.analysis_log ?? []).map((line, i) => (
                          <div key={i} className="leading-relaxed">{line}</div>
                        ))
                      )}
                    </div>
                  </section>
                </>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
