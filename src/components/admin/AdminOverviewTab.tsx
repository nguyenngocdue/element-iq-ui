import { useCallback, useEffect, useState } from 'react';
import {
  Activity,
  Cpu,
  FileStack,
  FolderKanban,
  HardDrive,
  Users,
} from 'lucide-react';
import { adminApi } from '../../lib/adminApi';
import { formatBytes } from '../../lib/adminFormat';
import { AdminKpiCard } from './AdminShared';
import { PanelLoading } from '../LoadingScreen';

export function AdminOverviewTab({ refreshKey }: { refreshKey: number }) {
  const [data, setData] = useState<Record<string, any> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await adminApi.overview());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  if (loading && !data) {
    return <PanelLoading eyebrow="Admin" title="Loading overview…" />;
  }
  if (error) {
    return (
      <div className="text-[#f87171] text-sm">
        {error}{' '}
        <button type="button" className="underline" onClick={() => void load()}>
          Retry
        </button>
      </div>
    );
  }
  if (!data) return null;

  const users = data.users ?? {};
  const projects = data.projects ?? {};
  const files = data.files ?? {};
  const jobsToday = data.jobs_today ?? {};
  const disk = data.disk ?? {};
  const engine = data.engine ?? {};
  const activity7d: Array<{ date: string; uploads: number; analyses: number }> = data.activity_7d ?? [];
  const maxBar = Math.max(1, ...activity7d.flatMap((d) => [d.uploads, d.analyses]));

  const uploadBytes = files.upload_bytes ?? files.total_bytes ?? 0;
  const artifactBytes = files.artifact_bytes ?? 0;
  const filesSubtext =
    artifactBytes > 0
      ? `${formatBytes(uploadBytes)} uploads · ${formatBytes(artifactBytes)} artifacts`
      : formatBytes(files.total_bytes ?? 0);

  const diskUsed = disk.elementiq_bytes_on_disk ?? disk.used_bytes ?? 0;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <AdminKpiCard label="Projects" value={String(projects.total ?? 0)} subtext={`${projects.archived ?? 0} archived`} icon={FolderKanban} />
        <AdminKpiCard label="Users" value={String(users.total ?? 0)} subtext={`${users.active_7d ?? 0} active this week`} icon={Users} />
        <AdminKpiCard label="Files" value={String(files.total ?? 0)} subtext={filesSubtext} icon={FileStack} />
        <AdminKpiCard label="Analyses today" value={String(jobsToday.total ?? 0)} subtext={`${jobsToday.failed ?? 0} failed · UTC`} icon={Activity} accent="amber" />
        <AdminKpiCard label="Data on disk" value={formatBytes(diskUsed)} subtext={`${formatBytes(disk.free_bytes ?? 0)} free on volume`} icon={HardDrive} />
        <AdminKpiCard
          label="Engine"
          value={engine.live ? 'LIVE' : 'OFFLINE'}
          subtext={engine.gpu ?? 'CPU mode'}
          icon={Cpu}
          accent={engine.live ? 'green' : 'amber'}
        />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="bg-[#141414] border border-[#262626] rounded-lg p-5">
          <h3 className="text-sm font-semibold text-white mb-4">Activity — last 7 days</h3>
          <div className="flex items-end gap-2 h-32">
            {activity7d.map((d) => (
              <div key={d.date} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full flex gap-0.5 items-end justify-center h-24">
                  <div
                    className="w-2 bg-[#00e676]/70 rounded-t"
                    style={{ height: `${(d.uploads / maxBar) * 100}%`, minHeight: d.uploads ? 4 : 0 }}
                    title={`Uploads: ${d.uploads}`}
                  />
                  <div
                    className="w-2 bg-[#10b981]/70 rounded-t"
                    style={{ height: `${(d.analyses / maxBar) * 100}%`, minHeight: d.analyses ? 4 : 0 }}
                    title={`Analyses: ${d.analyses}`}
                  />
                </div>
                <span className="text-[10px] text-[#737373]">{d.date.slice(5)}</span>
              </div>
            ))}
          </div>
          <div className="flex gap-4 mt-3 text-[11px] text-[#737373]">
            <span className="flex items-center gap-1"><span className="w-2 h-2 bg-[#00e676]/70 rounded" /> Uploads</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 bg-[#10b981]/70 rounded" /> Analyses</span>
          </div>
        </div>

        <div className="bg-[#141414] border border-[#262626] rounded-lg p-5">
          <h3 className="text-sm font-semibold text-white mb-3">Active analyses</h3>
          {(data.active_jobs as any[])?.length ? (
            <ul className="space-y-2">
              {(data.active_jobs as any[]).map((j) => (
                <li key={j.id} className="flex items-center justify-between text-sm border border-[#262626] rounded-md px-3 py-2">
                  <span className="text-white truncate flex-1">{j.filename}</span>
                  <span className="text-[#737373] text-xs ml-2">{j.stage} · {j.progress}%</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-[#737373]">No analyses running — system idle.</p>
          )}
        </div>
      </div>

      <div className="bg-[#141414] border border-[#262626] rounded-lg p-5">
        <h3 className="text-sm font-semibold text-white mb-3">Recent activity</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[11px uppercase text-[#737373] border-b border-[#262626]">
                <th className="text-left py-2 font-medium">Time</th>
                <th className="text-left py-2 font-medium">User</th>
                <th className="text-left py-2 font-medium">Action</th>
                <th className="text-left py-2 font-medium">Target</th>
              </tr>
            </thead>
            <tbody>
              {(data.recent_activity as any[])?.slice(0, 10).map((row, i) => (
                <tr key={i} className="border-b border-[#1f1f1f] hover:bg-[#141414]/80">
                  <td className="py-2 text-[#737373]">{row.at ? new Date(row.at).toLocaleString() : '—'}</td>
                  <td className="py-2 text-white">{row.user}</td>
                  <td className="py-2 text-[#b0b0b0]">{row.action}</td>
                  <td className="py-2 text-[#b0b0b0] truncate max-w-[200px]">{row.target}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
