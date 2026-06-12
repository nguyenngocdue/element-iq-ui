import { useEffect, useState } from 'react';
import { Check, Loader2, Octagon } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { AdminCleanupJobStatusKind } from '../../lib/adminApi';

export type CleanPhaseStatus = 'pending' | 'running' | 'done' | 'error' | 'skipped';

export interface CleanPhaseState {
  id: string;
  label: string;
  count: number;
  status: CleanPhaseStatus;
  durationMs?: number;
  detail?: string;
  error?: string;
}

function formatElapsed(ms: number): string {
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  return `${min}m ${sec % 60}s`;
}

function resultSummary(result: Record<string, unknown> | undefined): string {
  if (!result) return '';
  const parts: string[] = [];
  for (const [key, val] of Object.entries(result)) {
    if (typeof val === 'number' && val > 0) parts.push(`${key.replace(/_/g, ' ')}: ${val}`);
  }
  return parts.join(' · ');
}

function jobTitle(status: AdminCleanupJobStatusKind): string {
  switch (status) {
    case 'running':
      return 'System cleanup in progress';
    case 'stopping':
      return 'Stopping cleanup…';
    case 'stopped':
      return 'Cleanup stopped';
    case 'completed':
      return 'Cleanup complete';
    case 'failed':
      return 'Cleanup failed';
    default:
      return 'Cleanup';
  }
}

function jobSubtitle(
  status: AdminCleanupJobStatusKind,
  running: CleanPhaseState | undefined,
  allDone: boolean,
): string {
  if (status === 'stopping') return 'Waiting for the current phase to finish…';
  if (status === 'stopped') return 'Completed steps are kept. Use Clean all to continue.';
  if (status === 'failed') return 'An error occurred — see details below.';
  if (allDone) return 'Finishing up — refreshing results…';
  if (running) return `Running: ${running.label}`;
  return 'Preparing…';
}

export function GarbageCleanProgress({
  jobStatus,
  phases,
  startedAt,
  onClose,
  onStop,
}: {
  jobStatus: AdminCleanupJobStatusKind;
  phases: CleanPhaseState[];
  startedAt: number;
  onClose?: () => void;
  onStop?: () => void;
}) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const t = window.setInterval(() => setElapsed(Date.now() - startedAt), 500);
    return () => window.clearInterval(t);
  }, [startedAt]);

  const done = phases.filter((p) => p.status === 'done').length;
  const total = phases.length;
  const running = phases.find((p) => p.status === 'running');
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const isActive = jobStatus === 'running' || jobStatus === 'stopping';
  const allDone = !isActive && (jobStatus === 'completed' || jobStatus === 'stopped' || jobStatus === 'failed');

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/75">
      <div className="bg-[#141414] border border-[#262626] rounded-lg w-full max-w-lg shadow-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-[#262626]">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-white font-semibold">{jobTitle(jobStatus)}</h3>
            <span className="text-xs text-[#737373] tabular-nums">{formatElapsed(elapsed)}</span>
          </div>
          <p className="text-xs text-[#737373] mt-1">
            {jobSubtitle(jobStatus, running, allDone)}
          </p>
          <p className="text-[10px] text-[#5eead4]/70 mt-1">
            Runs on the server — survives page reload. Stop only via the Stop button.
          </p>
          <div className="mt-3 h-1.5 bg-[#262626] rounded-full overflow-hidden">
            <div
              className={cn(
                'h-full rounded-full transition-all duration-500',
                jobStatus === 'failed' ? 'bg-[#ef4444]' : jobStatus === 'stopped' ? 'bg-[#f59e0b]' : 'bg-[#10b981]',
              )}
              style={{ width: `${allDone ? 100 : Math.max(pct, running ? pct + 4 : 0)}%` }}
            />
          </div>
          <p className="text-[10px] text-[#737373] mt-1 tabular-nums">
            Bước {done}/{total} · {pct}%
          </p>
        </div>

        <ul className="max-h-80 overflow-y-auto divide-y divide-[#1f1f1f]">
          {phases.map((phase) => (
            <li key={phase.id} className="px-5 py-3 flex items-start gap-3">
              <div className="mt-0.5 shrink-0">
                {phase.status === 'done' && <Check className="w-4 h-4 text-[#34d399]" />}
                {phase.status === 'running' && <Loader2 className="w-4 h-4 text-[#10b981] animate-spin" />}
                {phase.status === 'error' && (
                  <span className="w-4 h-4 rounded-full bg-[#ef4444]/20 text-[#f87171] text-xs flex items-center justify-center">
                    !
                  </span>
                )}
                {phase.status === 'skipped' && (
                  <span className="w-4 h-4 rounded-full bg-[#f59e0b]/20 text-[#fbbf24] text-[10px] flex items-center justify-center">
                    —
                  </span>
                )}
                {phase.status === 'pending' && (
                  <span className="w-4 h-4 rounded-full border border-[#404040] block" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm text-white">{phase.label}</div>
                <div className="text-[11px] text-[#737373]">
                  {phase.status === 'skipped'
                    ? 'Skipped (stopped)'
                    : phase.count > 0
                      ? `~${phase.count.toLocaleString()} item(s)`
                      : 'Checking…'}
                  {phase.durationMs != null && phase.status === 'done' && (
                    <span className="ml-2 text-[#5eead4]">{phase.durationMs}ms</span>
                  )}
                </div>
                {phase.detail && phase.status === 'done' && (
                  <div className="text-[10px] text-[#b0b0b0] mt-0.5">{phase.detail}</div>
                )}
                {phase.error && <div className="text-[10px] text-[#f87171] mt-0.5">{phase.error}</div>}
              </div>
            </li>
          ))}
        </ul>

        <div className="px-5 py-3 border-t border-[#262626] flex justify-end gap-2">
          {isActive && onStop && (
            <button
              type="button"
              onClick={onStop}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-[#ef4444]/15 border border-[#ef4444]/40 text-sm text-[#f87171] font-medium hover:bg-[#ef4444]/25"
            >
              <Octagon className="w-4 h-4" />
              Stop
            </button>
          )}
          {allDone && onClose && (
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-md bg-[#10b981] text-black text-sm font-semibold hover:bg-[#00c968]"
            >
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export { resultSummary };
