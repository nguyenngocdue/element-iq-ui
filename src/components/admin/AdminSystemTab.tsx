import { useCallback, useEffect, useState } from 'react';
import { ScanSearch } from 'lucide-react';
import { adminApi } from '../../lib/adminApi';
import { formatBytes } from '../../lib/adminFormat';
import { useSystemMetrics } from '../../hooks/useSystemMetrics';
import { AdminMetricsCharts } from './AdminMetricsCharts';
import { AdminKpiCard, AdminStatusBadge, AdminTableShell } from './AdminShared';
import { Cpu, Database, HardDrive } from 'lucide-react';

export function AdminSystemTab({ refreshKey }: { refreshKey: number }) {
  const [health, setHealth] = useState<Record<string, any> | null>(null);
  const [orphans, setOrphans] = useState<Record<string, any> | null>(null);
  const [scanning, setScanning] = useState(false);
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

  async function runScan() {
    setScanning(true);
    try {
      setOrphans(await adminApi.scanOrphans());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Scan failed');
    } finally {
      setScanning(false);
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

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => void runScan()}
          disabled={scanning}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-[#141414] border border-[#262626] text-sm text-white hover:border-[#10b981]/40 transition-colors disabled:opacity-50"
        >
          <ScanSearch className="w-4 h-4" />
          {scanning ? 'Scanning…' : 'Scan for orphan files'}
        </button>
      </div>

      {orphans && (
        <div className="grid lg:grid-cols-2 gap-4">
          <AdminTableShell title="Missing on disk" description="DB records without files">
            {(orphans.missing_on_disk as any[])?.length ? (
              <ul className="divide-y divide-[#1f1f1f]">
                {(orphans.missing_on_disk as any[]).slice(0, 20).map((o) => (
                  <li key={o.id} className="px-4 py-2 text-sm">
                    <div className="text-white truncate">{o.filename}</div>
                    <div className="text-[#737373] text-xs truncate">{o.local_path}</div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-4 py-6 text-sm text-[#737373]">No missing files.</p>
            )}
          </AdminTableShell>
          <AdminTableShell title="Orphan on disk" description="Files without DB records">
            {(orphans.orphan_on_disk as any[])?.length ? (
              <ul className="divide-y divide-[#1f1f1f]">
                {(orphans.orphan_on_disk as any[]).slice(0, 20).map((o, i) => (
                  <li key={i} className="px-4 py-2 text-sm flex justify-between gap-2">
                    <span className="text-[#b0b0b0] truncate">{o.path}</span>
                    <AdminStatusBadge status={formatBytes(o.size_bytes)} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-4 py-6 text-sm text-[#737373]">No orphan files found.</p>
            )}
          </AdminTableShell>
        </div>
      )}
    </div>
  );
}
