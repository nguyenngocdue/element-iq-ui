import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import uPlot from 'uplot';
import 'uplot/dist/uPlot.min.css';
import { cn } from '../../lib/utils';
import type { ModelAnalysisEntry } from '../../lib/modelLabApi';

type CurveMode = 'smooth' | 'raw';
type YScaleMode = 'zoom' | 'full';

function movingAverage(values: number[], windowSize: number): number[] {
  if (windowSize <= 1) return values;
  return values.map((_, i) => {
    const start = Math.max(0, i - windowSize + 1);
    const slice = values.slice(start, i + 1);
    return slice.reduce((sum, v) => sum + v, 0) / slice.length;
  });
}

function ChartToggle({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'px-2.5 py-1 rounded text-[11px] transition-colors border',
        active
          ? 'bg-[#2563eb] border-[#2563eb] text-white'
          : 'bg-transparent border-[#404040] text-[#b0b0b0] hover:text-white hover:border-[#525252]',
      )}
    >
      {label}
    </button>
  );
}

function TrainingCurveChart({ model }: { model: ModelAnalysisEntry }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const plotRef = useRef<uPlot | null>(null);
  const modelId = model.filename;
  const curve = model.training?.curve ?? [];
  const [curveMode, setCurveMode] = useState<CurveMode>('smooth');
  const [yScale, setYScale] = useState<YScaleMode>('zoom');

  const rawSeries = useMemo(() => {
    const xs = curve.map((p) => p.epoch);
    const map50 = curve.map((p) => p.map50 * 100);
    const map50_95 = curve.map((p) => p.map50_95 * 100);
    return { xs, map50, map50_95 };
  }, [curve]);

  const displaySeries = useMemo(() => {
    if (curveMode === 'raw') return rawSeries;
    return {
      xs: rawSeries.xs,
      map50: movingAverage(rawSeries.map50, 5),
      map50_95: movingAverage(rawSeries.map50_95, 5),
    };
  }, [curveMode, rawSeries]);

  const data = useMemo(
    (): uPlot.AlignedData => [displaySeries.xs, displaySeries.map50, displaySeries.map50_95],
    [displaySeries],
  );

  const yRange = useMemo((): [number, number] => {
    if (yScale === 'zoom') return [70, 100];
    const all = [...displaySeries.map50, ...displaySeries.map50_95];
    if (all.length === 0) return [0, 100];
    const maxY = Math.min(100, Math.max(...all) * 1.05);
    return [0, Math.max(maxY, 50)];
  }, [displaySeries, yScale]);

  const bestEpoch = model.training?.best_epoch;

  const options = useMemo((): uPlot.Options => {
    return {
      width: 0,
      height: 220,
      cursor: { show: true, drag: { x: false, y: false } },
      legend: { show: true },
      scales: {
        x: { time: false },
        y: { range: yRange },
      },
      axes: [
        {
          stroke: '#737373',
          grid: { stroke: '#262626', width: 1 },
          ticks: { stroke: '#404040' },
          label: 'Epoch',
          size: 42,
          font: '11px ui-sans-serif, system-ui, sans-serif',
        },
        {
          stroke: '#737373',
          grid: { stroke: '#262626', width: 1 },
          ticks: { stroke: '#404040' },
          size: 48,
          font: '11px ui-sans-serif, system-ui, sans-serif',
          values: (_u, splits) => splits.map((s) => `${Math.round(s)}%`),
        },
      ],
      series: [
        {},
        { label: 'mAP50', stroke: '#34d399', width: 2 },
        { label: 'mAP50-95', stroke: '#60a5fa', width: 2 },
      ],
      hooks: {
        draw: [
          (u) => {
            if (bestEpoch == null) return;
            const x = u.valToPos(bestEpoch, 'x', true);
            if (x == null || Number.isNaN(x)) return;
            const ctx = u.ctx;
            ctx.save();
            ctx.strokeStyle = '#fbbf2488';
            ctx.lineWidth = 1;
            ctx.setLineDash([4, 4]);
            ctx.beginPath();
            ctx.moveTo(x, u.bbox.top);
            ctx.lineTo(x, u.bbox.top + u.bbox.height);
            ctx.stroke();
            ctx.fillStyle = '#fbbf24';
            ctx.font = '10px ui-sans-serif, system-ui, sans-serif';
            ctx.fillText(`best ${bestEpoch}`, x + 4, u.bbox.top + 12);
            ctx.restore();
          },
        ],
      },
    };
  }, [yRange, bestEpoch]);

  useLayoutEffect(() => {
    return () => {
      plotRef.current?.destroy();
      plotRef.current = null;
      if (hostRef.current) hostRef.current.replaceChildren();
    };
  }, [modelId]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || curve.length === 0) return;

    plotRef.current?.destroy();
    host.replaceChildren();
    plotRef.current = new uPlot(options, data, host);

    const ro = new ResizeObserver(() => {
      const w = host.clientWidth;
      if (w > 0) plotRef.current?.setSize({ width: w, height: 220 });
    });
    ro.observe(host);
    const w = host.clientWidth;
    if (w > 0) plotRef.current.setSize({ width: w, height: 220 });

    return () => {
      ro.disconnect();
      plotRef.current?.destroy();
      plotRef.current = null;
      host.replaceChildren();
    };
  }, [modelId, options]);

  useEffect(() => {
    if (plotRef.current) plotRef.current.setData(data);
  }, [data]);

  if (!curve.length) {
    return (
      <div className="h-[220px] flex items-center justify-center text-[12px] text-[#737373] border border-dashed border-[#333] rounded-lg">
        No training curve data
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[10px] uppercase tracking-wide text-[#737373] mr-1">Curve</span>
        <ChartToggle label="Smoothed" active={curveMode === 'smooth'} onClick={() => setCurveMode('smooth')} />
        <ChartToggle label="Raw" active={curveMode === 'raw'} onClick={() => setCurveMode('raw')} />
        <span className="text-[#404040] mx-1">|</span>
        <span className="text-[10px] uppercase tracking-wide text-[#737373] mr-1">Y axis</span>
        <ChartToggle label="70–100%" active={yScale === 'zoom'} onClick={() => setYScale('zoom')} />
        <ChartToggle label="Full" active={yScale === 'full'} onClick={() => setYScale('full')} />
        {curveMode === 'smooth' && (
          <span className="text-[10px] text-[#525252] ml-auto">5-epoch moving average</span>
        )}
      </div>
      <div ref={hostRef} className="w-full min-h-[220px] [&_.uplot]:max-w-full overflow-hidden" />
    </div>
  );
}

export function ModelCompareBars({ models }: { models: ModelAnalysisEntry[] }) {
  const withMetrics = models.filter((m) => m.training?.map50_95 != null);
  if (withMetrics.length === 0) {
    return (
      <div className="text-[12px] text-[#737373] py-8 text-center border border-dashed border-[#333] rounded-lg">
        No val metrics — need results.csv from training run
      </div>
    );
  }

  const maxMap = Math.max(...withMetrics.map((m) => (m.training!.map50_95 ?? 0) * 100));

  return (
    <div className="space-y-3">
      {withMetrics.map((m) => {
        const map = (m.training!.map50_95 ?? 0) * 100;
        const pct = maxMap > 0 ? (map / maxMap) * 100 : 0;
        const label = m.verdict?.label;
        const barColor =
          label === 'recommended'
            ? 'bg-[#10b981]'
            : label === 'ok'
              ? 'bg-[#60a5fa]'
              : label === 'caution'
                ? 'bg-[#f59e0b]'
                : 'bg-[#737373]';

        return (
          <div key={m.filename} className="group">
            <div className="flex items-center justify-between gap-3 mb-1">
              <span className="text-[12px] text-[#e5e5e5] truncate flex-1" title={m.filename}>
                {m.filename}
                {m.is_default && (
                  <span className="ml-2 text-[10px] uppercase text-[#fbbf24] border border-[#f59e0b]/30 px-1 rounded">
                    default
                  </span>
                )}
              </span>
              <span className="text-[12px] tabular-nums text-[#34d399] shrink-0">{map.toFixed(1)}%</span>
            </div>
            <div className="h-3 bg-[#1a1a1a] rounded-full overflow-hidden border border-[#262626]">
              <div
                className={`h-full rounded-full transition-all ${barColor}`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <div className="flex gap-4 mt-1 text-[10px] text-[#737373]">
              <span>P {((m.training!.precision ?? 0) * 100).toFixed(1)}%</span>
              <span>R {((m.training!.recall ?? 0) * 100).toFixed(1)}%</span>
              <span>{m.size_mb} MB</span>
              {m.base_model && <span>{m.base_model}</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function ModelMetricRadar({ models }: { models: ModelAnalysisEntry[] }) {
  const withMetrics = models.filter((m) => m.training);
  if (withMetrics.length < 2) return null;

  const metrics = ['mAP50-95', 'Precision', 'Recall'] as const;
  const colors = ['#10b981', '#60a5fa', '#c4b5fd', '#fbbf24'];

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[11px]">
        <thead>
          <tr className="text-[#737373] border-b border-[#262626]">
            <th className="text-left py-2 pr-3 font-medium">Model</th>
            {metrics.map((h) => (
              <th key={h} className="text-right py-2 px-2 font-medium">
                {h}
              </th>
            ))}
            <th className="text-right py-2 pl-2 font-medium">Composite</th>
          </tr>
        </thead>
        <tbody>
          {withMetrics.map((m, i) => (
            <tr key={m.filename} className="border-b border-[#1f1f1f] hover:bg-[#141414]/50">
              <td className="py-2 pr-3 truncate max-w-[220px]" style={{ color: colors[i % colors.length] }}>
                {m.filename}
              </td>
              <td className="text-right py-2 px-2 tabular-nums">
                {((m.training!.map50_95 ?? 0) * 100).toFixed(1)}%
              </td>
              <td className="text-right py-2 px-2 tabular-nums">
                {((m.training!.precision ?? 0) * 100).toFixed(1)}%
              </td>
              <td className="text-right py-2 px-2 tabular-nums">
                {((m.training!.recall ?? 0) * 100).toFixed(1)}%
              </td>
              <td className="text-right py-2 pl-2 tabular-nums text-white">{m.verdict?.score ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export { TrainingCurveChart };
