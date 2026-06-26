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

function VramBreakdown({ gpu }: { gpu: SystemMetricsSnapshot['gpu'] }) {
  if (!gpu?.available) return null;

  const rows: { label: string; value: string; hint?: string }[] = [
    {
      label: 'Device VRAM (NVML)',
      value: `${fmtBytes(gpu.memory_used_bytes)} / ${fmtBytes(gpu.memory_total_bytes)} (${gpu.memory_percent.toFixed(1)}%)`,
    },
  ];

  if (gpu.allocated_bytes != null) {
    rows.push({
      label: 'PyTorch allocated',
      value: fmtBytes(gpu.allocated_bytes),
      hint: gpu.reserved_bytes != null ? `reserved ${fmtBytes(gpu.reserved_bytes)}` : undefined,
    });
  }

  if (gpu.warmup_delta_bytes != null && gpu.warmup_slots) {
    const perSlot = gpu.estimated_bytes_per_warmup_slot;
    rows.push({
      label: 'Warmup footprint',
      value: `${fmtBytes(gpu.warmup_delta_bytes)} · ${gpu.warmup_slots} slot(s)`,
      hint: perSlot != null ? `~${fmtBytes(perSlot)} / slot` : undefined,
    });
  } else if (gpu.warmup_slots != null) {
    rows.push({
      label: 'Warmup slots',
      value: String(gpu.warmup_slots),
      hint: gpu.models_warmed_up ? 'models ready' : 'warming up…',
    });
  }

  if (gpu.max_gpu_slots != null) {
    const active = gpu.active_analysis_jobs ?? 0;
    rows.push({
      label: 'Analysis slots',
      value: `${active} / ${gpu.max_gpu_slots} GPU · max ${gpu.max_user_slots ?? '—'} / user`,
    });
  }

  return (
    <div className="bg-[#141414] border border-[#262626] rounded-lg p-4">
      <h3 className="text-sm font-semibold text-white mb-3">VRAM breakdown</h3>
      <dl className="space-y-2">
        {rows.map((row) => (
          <div key={row.label} className="flex items-baseline justify-between gap-4 text-xs">
            <dt className="text-[#737373] shrink-0">{row.label}</dt>
            <dd className="text-right text-[#e5e5e5] tabular-nums">
              {row.value}
              {row.hint && <span className="block text-[10px] text-[#525252] mt-0.5">{row.hint}</span>}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
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
  const gpuMemUsed = latest?.gpu?.memory_used_bytes;
  const gpuMemTotal = latest?.gpu?.memory_total_bytes;
  const gpuMemSubtitle =
    gpuMemUsed != null && gpuMemTotal
      ? `VRAM used · ${fmtBytes(gpuMemUsed)} / ${fmtBytes(gpuMemTotal)}`
      : 'VRAM used by loaded models';
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
        <div className="lg:col-span-2 space-y-3">
          <div className="px-1">
            <p className="text-[11px] uppercase tracking-wide text-[#737373]">CUDA GPU (1 device)</p>
            <p className="text-xs text-[#a3a3a3] mt-0.5">{gpuName ?? 'CUDA device'}</p>
            <p className="text-[11px] text-[#525252] mt-1">
              Two metrics below — processing load and VRAM — not two separate GPUs.
            </p>
          </div>
          <div className="grid lg:grid-cols-2 gap-4">
            <RealtimeChart
              title="GPU compute"
              subtitle="Processing load while analyzing"
              data={gpuUtilData}
              color="#fbbf24"
              mode="percent"
              live={live}
            />
            <RealtimeChart
              title="GPU memory"
              subtitle={gpuMemSubtitle}
              data={gpuMemData}
              color="#c4b5fd"
              mode="percent"
              live={live}
            />
          </div>
          {latest?.gpu && <VramBreakdown gpu={latest.gpu} />}
        </div>
      ) : (
        <div className="lg:col-span-2 bg-[#141414] border border-[#262626] rounded-lg p-5 text-sm text-[#737373]">
          No CUDA GPU detected on this host — CPU/RAM charts only.
        </div>
      )}
    </div>
  );
}
