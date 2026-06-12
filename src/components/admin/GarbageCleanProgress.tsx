import { useEffect, useState } from 'react';
import { Check, Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';

export type CleanPhaseStatus = 'pending' | 'running' | 'done' | 'error';

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

export function GarbageCleanProgress({
  title,
  phases,
  startedAt,
  onClose,
}: {
  title: string;
  phases: CleanPhaseState[];
  startedAt: number;
  onClose?: () => void;
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
  const allDone = done === total && !running;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/75">
      <div className="bg-[#141414] border border-[#262626] rounded-lg w-full max-w-lg shadow-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-[#262626]">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-white font-semibold">{title}</h3>
            <span className="text-xs text-[#737373] tabular-nums">{formatElapsed(elapsed)}</span>
          </div>
          <p className="text-xs text-[#737373] mt-1">
            {allDone
              ? 'Hoàn tất — đang cập nhật kết quả…'
              : running
                ? `Đang chạy: ${running.label}`
                : 'Chuẩn bị…'}
          </p>
          <div className="mt-3 h-1.5 bg-[#262626] rounded-full overflow-hidden">
            <div
              className={cn(
                'h-full rounded-full transition-all duration-500',
                allDone ? 'bg-[#10b981]' : 'bg-[#10b981]/80',
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
                {phase.status === 'pending' && (
                  <span className="w-4 h-4 rounded-full border border-[#404040] block" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm text-white">{phase.label}</div>
                <div className="text-[11px] text-[#737373]">
                  {phase.count > 0 ? `~${phase.count.toLocaleString()} item(s)` : 'Kiểm tra…'}
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

        {allDone && onClose && (
          <div className="px-5 py-3 border-t border-[#262626] flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-md bg-[#10b981] text-black text-sm font-semibold hover:bg-[#00c968]"
            >
              Đóng
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export { resultSummary };
