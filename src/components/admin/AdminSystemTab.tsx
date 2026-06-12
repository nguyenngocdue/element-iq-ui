import { useCallback, useEffect, useState } from 'react';
import { Archive } from 'lucide-react';
import { adminApi } from '../../lib/adminApi';
import { formatBytes } from '../../lib/adminFormat';
import { useSystemMetrics } from '../../hooks/useSystemMetrics';
import { AdminMetricsCharts } from './AdminMetricsCharts';
import { AdminKpiCard, AdminTableShell } from './AdminShared';
import { Cpu, Database, HardDrive } from 'lucide-react';

export function AdminSystemTab({ refreshKey }: { refreshKey: number }) {
  const [health, setHealth] = useState<Record<string, any> | null>(null);
  const [pruning, setPruning] = useState(false);
  const [pruneResult, setPruneResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { points: metricPoints, error: metricsError, live: metricsLive } = useSystemMetrics(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setHealth(await adminApi.systemHealth());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load system health');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  async function runPrune() {
    const keep = typeof health?.artifact_retention_jobs === 'number' ? health.artifact_retention_jobs : 2;
    const prev = keep > 1 ? keep - 1 : 0;
    if (!window.confirm(`Delete older analysis jobs? Keeps latest ${keep} per file${prev ? ` (${prev} previous backup${prev > 1 ? 's' : ''})` : ''}.`)) return;
    setPruning(true);
    setPruneResult(null);
    try {
      const r = await adminApi.pruneArtifacts();
      setPruneResult(
        `Removed ${r.deleted_jobs} job(s) across ${r.file_versions_pruned} file version(s) (keep ${r.keep_per_file_version}).`,
      );
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Prune failed');
    } finally {
      setPruning(false);
    }
  }

  if (loading && !health) {
    return <p className="text-[#737373] text-sm animate-pulse">Loading system…</p>;
  }

  const gpu = health?.gpu ?? {};
  const disk = health?.disk ?? {};
  const counts = health?.table_counts ?? {};
  const services = health?.health?.services ?? {};

  return (
    <div className="space-y-6">
      {error && <p className="text-sm text-[#f87171]">{error}</p>}
      {metricsError && !error && (
        <p className="text-sm text-[#fbbf24]">Metrics: {metricsError} (install psutil on API host)</p>
      )}

      <AdminMetricsCharts points={metricPoints} live={metricsLive} />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <AdminKpiCard
          label="GPU"
          value={gpu.available ? 'Available' : 'CPU'}
          subtext={gpu.device_name ?? 'No CUDA device'}
          icon={Cpu}
          accent={gpu.available ? 'green' : 'amber'}
        />
        <AdminKpiCard
          label="Models"
          value={gpu.models_warmed_up ? 'Ready' : 'Cold'}
          subtext={`API: ${services.api ?? '—'}`}
          icon={Database}
        />
        <AdminKpiCard
          label="Data on disk"
          value={formatBytes(disk.elementiq_bytes_on_disk ?? disk.used_bytes ?? 0)}
          subtext={`${formatBytes(disk.free_bytes ?? 0)} free · DB ${formatBytes(disk.db_total_bytes ?? 0)}`}
          icon={HardDrive}
        />
      </div>

      <AdminTableShell title="Database row counts" description="PostgreSQL table sizes">
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="bg-[#141414] text-[11px] uppercase text-[#737373] border-b border-[#262626]">
                <th className="text-left px-4 py-3 font-medium">Table</th>
                <th className="text-right px-4 py-3 font-medium">Rows</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(counts).map(([table, count]) => (
                <tr key={table} className="border-b border-[#1f1f1f]">
                  <td className="px-4 py-3 text-white">{table}</td>
                  <td className="px-4 py-3 text-right text-[#b0b0b0] tabular-nums">{String(count)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </AdminTableShell>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => void runPrune()}
          disabled={pruning}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-[#141414] border border-[#262626] text-sm text-white hover:border-[#10b981]/40 transition-colors disabled:opacity-50"
        >
          <Archive className="w-4 h-4" />
          {pruning ? 'Pruning…' : `Prune old artifacts (keep ${typeof health?.artifact_retention_jobs === 'number' ? health.artifact_retention_jobs : '…'})`}
        </button>
      </div>
      {pruneResult && <p className="text-sm text-[#34d399]">{pruneResult}</p>}
    </div>
  );
}
