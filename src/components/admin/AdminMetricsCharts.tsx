import { useEffect, useMemo, useRef } from 'react';
import uPlot from 'uplot';
import 'uplot/dist/uPlot.min.css';
import type { SystemMetricsSnapshot } from '../../hooks/useSystemMetrics';

type SeriesMode = 'percent' | 'bytes';

function fmtTime(ts: number) {
  return new Date(ts * 1000).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function fmtBytes(n: number) {
  if (n >= 1_073_741_824) return `${(n / 1_073_741_824).toFixed(1)} GB`;
  if (n >= 1_048_576) return `${(n / 1_048_576).toFixed(0)} MB`;
  return `${Math.round(n / 1024)} KB`;
}

function buildSeries(
  points: SystemMetricsSnapshot[],
  pick: (p: SystemMetricsSnapshot) => number | null | undefined,
): [number[], number[]] {
  const xs: number[] = [];
  const ys: number[] = [];
  for (const p of points) {
    const v = pick(p);
    if (v == null || Number.isNaN(v)) continue;
    xs.push(p.ts);
    ys.push(v);
  }
  return [xs, ys];
}

function RealtimeChart({
  title,
  subtitle,
  data,
  color,
  mode,
  live,
}: {
  title: string;
  subtitle?: string;
  data: [number[], number[]];
  color: string;
  mode: SeriesMode;
  live: boolean;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const plotRef = useRef<uPlot | null>(null);
  const latest = data[1].length ? data[1][data[1].length - 1] : null;

  const options = useMemo((): uPlot.Options => {
    const maxY = mode === 'percent' ? 100 : Math.max(1, ...data[1]) * 1.1;
    return {
      width: 0,
      height: 180,
      cursor: { show: true, drag: { x: false, y: false } },
      legend: { show: false },
      scales: {
        x: { time: true },
        y: { range: [0, maxY] },
      },
      axes: [
        {
          stroke: '#737373',
          grid: { stroke: '#262626', width: 1 },
          ticks: { stroke: '#404040' },
          values: (_u, splits) => splits.map((s) => fmtTime(s)),
          size: 42,
          font: '11px ui-sans-serif, system-ui, sans-serif',
        },
        {
          stroke: '#737373',
          grid: { stroke: '#262626', width: 1 },
          ticks: { stroke: '#404040' },
          size: 48,
          font: '11px ui-sans-serif, system-ui, sans-serif',
          values: (_u, splits) =>
            mode === 'percent'
              ? splits.map((s) => `${Math.round(s)}%`)
              : splits.map((s) => fmtBytes(s)),
        },
      ],
      series: [
        {},
        {
          stroke: color,
          width: 2,
          fill: `${color}22`,
        },
      ],
    };
  }, [color, data, mode]);

  useEffect(() => {
    if (!hostRef.current) return;
    plotRef.current?.destroy();
    plotRef.current = new uPlot(options, data, hostRef.current);

    const ro = new ResizeObserver(() => {
      const w = hostRef.current?.clientWidth ?? 0;
      if (w > 0) plotRef.current?.setSize({ width: w, height: 180 });
    });
    ro.observe(hostRef.current);
    const w = hostRef.current.clientWidth;
    if (w > 0) plotRef.current.setSize({ width: w, height: 180 });

    return () => {
      ro.disconnect();
      plotRef.current?.destroy();
      plotRef.current = null;
    };
  }, [options]);

  useEffect(() => {
    plotRef.current?.setData(data);
  }, [data]);

  const valueLabel =
    latest == null
      ? '—'
      : mode === 'percent'
        ? `${latest.toFixed(1)}%`
        : fmtBytes(latest);

  return (
    <div className="bg-[#141414] border border-[#262626] rounded-lg p-4">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-white">{title}</h3>
            {live && (
              <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wide text-[#34d399]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#34d399] animate-pulse" />
                Live
              </span>
            )}
          </div>
          {subtitle && <p className="text-[11px] text-[#737373] mt-0.5">{subtitle}</p>}
        </div>
        <p className="text-xl font-semibold tabular-nums text-white">{valueLabel}</p>
      </div>
      <div ref={hostRef} className="w-full min-h-[180px] [&_.uplot]:font-sans" />
    </div>
  );
}

export function AdminMetricsCharts({
  points,
  live,
}: {
  points: SystemMetricsSnapshot[];
  live: boolean;
}) {
  const cpuData = useMemo(() => buildSeries(points, (p) => p.cpu_percent), [points]);
  const ramData = useMemo(() => buildSeries(points, (p) => p.ram_percent), [points]);
  const gpuUtilData = useMemo(
    () => buildSeries(points, (p) => p.gpu?.util_percent ?? null),
    [points],
  );
  const gpuMemData = useMemo(
    () => buildSeries(points, (p) => p.gpu?.memory_percent ?? null),
    [points],
  );

  const hasGpu = points.some((p) => p.gpu?.available);
  const latest = points[points.length - 1];
  const gpuName = latest?.gpu?.device_name
    ?? [...points].reverse().find((p) => p.gpu?.device_name)?.gpu?.device_name;
  const cpuSubtitle =
    latest?.cpu?.subtitle
    ?? latest?.cpu_name
    ?? 'Host processor utilization';
  const ramSubtitle =
    latest?.ram?.subtitle
    ?? latest?.ram_label
    ?? 'System memory used';

  if (!points.length) {
    return (
      <div className="bg-[#141414] border border-[#262626] rounded-lg p-8 text-center text-sm text-[#737373] animate-pulse">
        Collecting metrics…
      </div>
    );
  }

  return (
    <div className="grid lg:grid-cols-2 gap-4">
      <RealtimeChart title="CPU" subtitle={cpuSubtitle} data={cpuData} color="#34d399" mode="percent" live={live} />
      <RealtimeChart title="RAM" subtitle={ramSubtitle} data={ramData} color="#60a5fa" mode="percent" live={live} />
      {hasGpu ? (
        <>
          <RealtimeChart
            title="GPU compute"
            subtitle={gpuName ?? 'CUDA device'}
            data={gpuUtilData}
            color="#fbbf24"
            mode="percent"
            live={live}
          />
          <RealtimeChart
            title="GPU memory"
            subtitle={gpuName ?? 'VRAM usage'}
            data={gpuMemData}
            color="#c4b5fd"
            mode="percent"
            live={live}
          />
        </>
      ) : (
        <div className="lg:col-span-2 bg-[#141414] border border-[#262626] rounded-lg p-5 text-sm text-[#737373]">
          No CUDA GPU detected on this host — CPU/RAM charts only.
        </div>
      )}
    </div>
  );
}
