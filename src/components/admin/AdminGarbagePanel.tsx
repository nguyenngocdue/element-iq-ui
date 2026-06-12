import { useCallback, useEffect, useState } from 'react';
import { Eraser, Loader2, ScanSearch, Trash2 } from 'lucide-react';
import {
  adminApi,
  type AdminCleanupJobStatus,
  type AdminGarbageScan,
} from '../../lib/adminApi';
import { formatBytes, formatRelativeTime } from '../../lib/adminFormat';
import { AdminKpiCard, AdminStatusBadge, AdminTableShell } from './AdminShared';
import { GarbageOriginTooltip, ScrollPath, type GarbageOrigin } from './GarbageOriginTooltip';
import { GarbageCleanProgress, type CleanPhaseState } from './GarbageCleanProgress';

function jobPhasesToUi(job: AdminCleanupJobStatus): CleanPhaseState[] {
  return job.phases.map((p) => ({
    id: p.id,
    label: p.label,
    count: p.count,
    status: p.status,
    durationMs: p.duration_ms ?? undefined,
    detail: p.detail ?? undefined,
    error: p.error ?? undefined,
  }));
}

function isActiveCleanup(status: AdminCleanupJobStatus['status']): boolean {
  return status === 'running' || status === 'stopping';
}

function showCleanupOverlay(status: AdminCleanupJobStatus['status']): boolean {
  return status !== 'idle';
}

const CATEGORY_LABELS: Record<keyof AdminGarbageScan['categories'], { title: string; description: string }> = {
  jobs_over_retention: {
    title: 'Jobs over retention',
    description: 'Old analysis jobs that exceed keep-N policy (prunable)',
  },
  orphan_on_disk: {
    title: 'Orphan files on disk',
    description: 'Files under data/ with no DB record (media, artifacts, uploads…)',
  },
  orphan_artifact_dirs: {
    title: 'Orphan artifact folders',
    description: 'Artifact job directories not tracked in DB',
  },
  missing_on_disk: {
    title: 'Missing on disk',
    description: 'DB records pointing to files that no longer exist',
  },
  orphan_jobs: {
    title: 'Orphan jobs',
    description: 'Jobs whose file version was removed from DB',
  },
  orphan_job_results: {
    title: 'Orphan job results',
    description: 'Analysis results with no parent job',
  },
  orphan_artifacts_db: {
    title: 'Orphan artifacts (DB)',
    description: 'Artifact rows missing parent or file on disk',
  },
  stale_scratch: {
    title: 'Stale scratch temp',
    description: 'Leftover elementiq_job_* temp folders',
  },
  broken_project_refs: {
    title: 'Broken project refs',
    description: 'Files linked to deleted projects',
  },
};

function itemOrigin(item: Record<string, unknown>): GarbageOrigin | undefined {
  const o = item.origin;
  if (!o || typeof o !== 'object') return undefined;
  return o as GarbageOrigin;
}

function renderItem(cat: keyof AdminGarbageScan['categories'], item: Record<string, unknown>) {
  const origin = itemOrigin(item);

  if (cat === 'orphan_on_disk' || cat === 'stale_scratch' || cat === 'orphan_artifact_dirs') {
    const path = String(item.path ?? '—');
    return (
      <GarbageOriginTooltip origin={origin} fallbackPath={path} className="flex gap-2 items-start min-w-0 cursor-help">
        <ScrollPath text={path} className="flex-1 min-w-0" />
        <AdminStatusBadge status={formatBytes(Number(item.size_bytes ?? 0))} />
      </GarbageOriginTooltip>
    );
  }

  if (cat === 'missing_on_disk') {
    const localPath = String(item.local_path ?? '');
    return (
      <GarbageOriginTooltip origin={origin} fallbackPath={localPath || undefined} className="min-w-0 cursor-help space-y-0.5">
        <div className="text-white">{String(item.filename ?? '—')}</div>
        {localPath ? <ScrollPath text={localPath} /> : null}
        {origin?.chain && (
          <div className="text-[#5eead4]/80 text-[10px] break-all">{origin.chain}</div>
        )}
      </GarbageOriginTooltip>
    );
  }

  if (cat === 'orphan_jobs' || cat === 'jobs_over_retention') {
    return (
      <GarbageOriginTooltip origin={origin} className="min-w-0 cursor-help">
        <div className="text-white truncate">
          {item.filename ? String(item.filename) : `Job ${String(item.id ?? '').slice(0, 8)}…`}
        </div>
        <div className="text-[#737373] text-xs">
          {String(item.status ?? '—')}
          {item.created_at ? ` · ${formatRelativeTime(String(item.created_at))}` : ''}
        </div>
        {origin?.chain && (
          <div className="text-[#5eead4]/80 text-[10px] truncate mt-0.5">{origin.chain}</div>
        )}
      </GarbageOriginTooltip>
    );
  }

  if (cat === 'orphan_artifacts_db') {
    const localPath = String(item.local_path ?? '');
    return (
      <GarbageOriginTooltip origin={origin} fallbackPath={localPath || undefined} className="min-w-0 cursor-help space-y-0.5">
        <div className="text-white">{String(item.artifact_type ?? 'artifact')}</div>
        {localPath ? <ScrollPath text={localPath} className="text-[#737373]" /> : null}
        {origin?.chain && (
          <div className="text-[#5eead4]/80 text-[10px] break-all">{origin.chain}</div>
        )}
      </GarbageOriginTooltip>
    );
  }

  return (
    <GarbageOriginTooltip origin={origin} className="cursor-help">
      <div className="text-[#b0b0b0] truncate text-xs font-mono">{JSON.stringify(item)}</div>
    </GarbageOriginTooltip>
  );
}

export function AdminGarbagePanel({ refreshKey }: { refreshKey: number }) {
  const [scan, setScan] = useState<AdminGarbageScan | null>(null);
  const [scanning, setScanning] = useState(false);
  const [cleanupJob, setCleanupJob] = useState<AdminCleanupJobStatus | null>(null);
  const [overlayDismissed, setOverlayDismissed] = useState(false);
  const [cleanResult, setCleanResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const cleaning = cleanupJob != null && isActiveCleanup(cleanupJob.status);

  const runScan = useCallback(async () => {
    setScanning(true);
    setError(null);
    try {
      setScan(await adminApi.scanGarbage());
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Scan failed';
      setError(
        msg.includes('404') || msg.includes('HTTP 404')
          ? 'scan-garbage API not found — run ./deploy.sh api to update the backend.'
          : msg,
      );
    } finally {
      setScanning(false);
    }
  }, []);

  const applyCleanupJob = useCallback((job: AdminCleanupJobStatus) => {
    setCleanupJob(job);
    if (job.status === 'completed' || job.status === 'stopped') {
      const before = job.before_issues ?? 0;
      const after = job.after_issues ?? before;
      setCleanResult(
        job.status === 'stopped'
          ? `Stopped. Issues ${before.toLocaleString()} → ${after.toLocaleString()}.`
          : `Done. Issues ${before.toLocaleString()} → ${after.toLocaleString()}.`,
      );
    }
    if (job.status === 'failed') {
      setError(job.error ?? 'Cleanup failed');
    }
  }, []);

  const syncCleanupStatus = useCallback(async () => {
    try {
      const job = await adminApi.cleanGarbageStatus();
      applyCleanupJob(job);
      if (isActiveCleanup(job.status)) {
        setOverlayDismissed(false);
      }
      return job;
    } catch {
      return null;
    }
  }, [applyCleanupJob]);

  useEffect(() => {
    void runScan();
    void syncCleanupStatus();
  }, [runScan, refreshKey, syncCleanupStatus]);

  useEffect(() => {
    if (!cleanupJob || !isActiveCleanup(cleanupJob.status)) return;

    const id = window.setInterval(() => {
      void syncCleanupStatus();
    }, 1000);

    return () => window.clearInterval(id);
  }, [cleanupJob?.status, syncCleanupStatus]);

  useEffect(() => {
    if (!cleanupJob) return;
    if (cleanupJob.status !== 'completed' && cleanupJob.status !== 'stopped') return;

    void runScan();
  }, [cleanupJob?.status, cleanupJob?.finished_at, runScan]);

  async function runClean(dryRun: boolean) {
    if (!dryRun) {
      const issues = scan?.summary.total_issues ?? 0;
      const msg = issues > 0
        ? `Clean all ${issues} issue(s)? Removes orphan disk files, stale DB rows, artifact folders, scratch temp, and prunes old analysis jobs.`
        : 'Run cleanup anyway? Will prune jobs over retention and sweep scratch temp.';
      if (!window.confirm(msg)) return;
    }

    setError(null);
    setCleanResult(null);

    if (dryRun) {
      try {
        const result = await adminApi.cleanGarbage({ dryRun: true });
        setCleanResult(
          `Dry run: ${result.would_clean?.total_issues ?? 0} issue(s), ${formatBytes(result.would_clean?.reclaimable_bytes ?? 0)} reclaimable.`,
        );
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Dry run failed');
      }
      return;
    }

    try {
      const job = await adminApi.startCleanGarbage();
      setOverlayDismissed(false);
      applyCleanupJob(job);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Clean failed');
    }
  }

  async function stopClean() {
    if (!window.confirm('Stop cleanup after the current phase finishes?')) return;
    try {
      const job = await adminApi.stopCleanGarbage();
      applyCleanupJob(job);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Stop failed');
    }
  }

  function dismissCleanProgress() {
    setOverlayDismissed(true);
  }

  const categories = scan?.categories;
  const summary = scan?.summary;

  return (
    <>
    {cleanupJob && showCleanupOverlay(cleanupJob.status) && !overlayDismissed && (
      <GarbageCleanProgress
        jobStatus={cleanupJob.status}
        phases={jobPhasesToUi(cleanupJob)}
        startedAt={
          cleanupJob.started_at ? Date.parse(cleanupJob.started_at) : Date.now()
        }
        onStop={isActiveCleanup(cleanupJob.status) ? () => void stopClean() : undefined}
        onClose={isActiveCleanup(cleanupJob.status) ? undefined : dismissCleanProgress}
      />
    )}

    <div className="space-y-4 border border-[#262626] rounded-lg p-5 bg-[#0a0a0a]">
      <div>
        <h2 className="text-lg font-semibold text-white">System garbage</h2>
        <p className="text-sm text-[#737373] mt-0.5">
          Hover any row for full origin chain (owner → project → file → job → path). Data root:{' '}
          <span className="font-mono text-[#b0b0b0]">{scan?.data_root ?? 'data/'}</span>
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => void runScan()}
          disabled={scanning || cleaning}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-[#141414] border border-[#262626] text-sm text-white hover:border-[#10b981]/40 transition-colors disabled:opacity-50"
        >
          {scanning ? <Loader2 className="w-4 h-4 animate-spin" /> : <ScanSearch className="w-4 h-4" />}
          {scanning ? 'Scanning…' : 'Rescan'}
        </button>
        <button
          type="button"
          onClick={() => void runClean(false)}
          disabled={cleaning || scanning || !scan}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-[#10b981]/15 border border-[#10b981]/40 text-sm text-[#34d399] font-medium hover:bg-[#10b981]/25 transition-colors disabled:opacity-50"
        >
          {cleaning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eraser className="w-4 h-4" />}
          {cleaning ? 'Cleaning…' : 'Clean all'}
        </button>
        <button
          type="button"
          onClick={() => void runClean(true)}
          disabled={cleaning || scanning || !scan}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-md text-sm text-[#737373] hover:text-white transition-colors disabled:opacity-50"
        >
          <Trash2 className="w-3.5 h-3.5" />
          Dry run
        </button>
      </div>

      {error && <p className="text-sm text-[#f87171]">{error}</p>}
      {cleanResult && <p className="text-sm text-[#34d399]">{cleanResult}</p>}

      {scanning && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-md border border-[#10b981]/30 bg-[#10b981]/5 text-sm text-[#34d399]">
          <Loader2 className="w-4 h-4 animate-spin shrink-0" />
          Scanning orphan data… (may take a while on large datasets)
        </div>
      )}

      {summary && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <AdminKpiCard
            label="Total issues"
            value={String(summary.total_issues)}
            subtext={scan?.scanned_at ? `Scanned ${new Date(scan.scanned_at).toLocaleString()}` : undefined}
            icon={Trash2}
            accent={summary.total_issues > 0 ? 'amber' : 'green'}
          />
          <AdminKpiCard
            label="Reclaimable disk"
            value={formatBytes(summary.reclaimable_bytes)}
            subtext="Orphan files + artifact dirs + scratch"
            icon={Eraser}
          />
          <AdminKpiCard
            label="Jobs over retention"
            value={String(summary.jobs_over_retention)}
            subtext="Old analysis runs eligible for prune"
            icon={ScanSearch}
            accent={summary.jobs_over_retention > 0 ? 'amber' : 'green'}
          />
        </div>
      )}

      {categories && (
        <div className="grid lg:grid-cols-2 gap-4">
          {(Object.keys(CATEGORY_LABELS) as Array<keyof AdminGarbageScan['categories']>).map((key) => {
            const cat = categories[key];
            const meta = CATEGORY_LABELS[key];
            return (
              <AdminTableShell key={key} title={meta.title} description={meta.description}>
                {cat.count === 0 ? (
                  <p className="px-4 py-6 text-sm text-[#737373]">None found.</p>
                ) : (
                  <>
                    <p className="px-4 py-2 text-xs text-[#737373] border-b border-[#1f1f1f]">
                      {cat.count} item{cat.count !== 1 ? 's' : ''}
                      {cat.truncated ? ' (showing first 50)' : ''}
                      {' · scroll path row ↔ · hover for origin'}
                    </p>
                    <ul className="divide-y divide-[#1f1f1f] max-h-80 overflow-y-auto overflow-x-hidden">
                      {cat.items.map((item, i) => (
                        <li key={i} className="px-4 py-2 text-sm">
                          {renderItem(key, item)}
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </AdminTableShell>
            );
          })}
        </div>
      )}
    </div>
    </>
  );
}
