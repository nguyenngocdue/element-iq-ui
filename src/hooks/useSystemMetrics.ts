import { useEffect, useRef, useState } from 'react';
import { adminApi } from '../lib/adminApi';

export interface SystemMetricsCpu {
  name: string | null;
  logical_cores: number | null;
  physical_cores: number | null;
  percent: number | null;
  subtitle?: string | null;
}

export interface SystemMetricsRam {
  total_bytes: number;
  used_bytes: number;
  percent: number | null;
  type: string | null;
  label: string | null;
  subtitle?: string | null;
}

export interface SystemMetricsGpu {
  available: boolean;
  device_name?: string;
  util_percent: number | null;
  memory_used_bytes: number;
  memory_total_bytes: number;
  memory_percent: number;
}

export interface SystemMetricsSnapshot {
  ts: number;
  cpu_percent: number | null;
  ram_used_bytes: number;
  ram_total_bytes: number;
  ram_percent: number | null;
  cpu_name?: string | null;
  cpu_logical_cores?: number | null;
  cpu_physical_cores?: number | null;
  ram_type?: string | null;
  ram_label?: string | null;
  cpu?: SystemMetricsCpu | null;
  ram?: SystemMetricsRam | null;
  gpu: SystemMetricsGpu | null;
}

export function useSystemMetrics(enabled: boolean, maxPoints = 120) {
  const [points, setPoints] = useState<SystemMetricsSnapshot[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [live, setLive] = useState(false);
  const primed = useRef(false);

  useEffect(() => {
    if (!enabled) {
      setLive(false);
      return;
    }

    let cancelled = false;

    const tick = async () => {
      if (document.hidden) return;
      try {
        const snap = await adminApi.systemMetrics();
        if (cancelled) return;
        setPoints((prev) => [...prev.slice(-(maxPoints - 1)), snap]);
        setError(null);
        setLive(true);
      } catch (e: unknown) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Metrics unavailable');
          setLive(false);
        }
      }
    };

    void tick();
    const id = window.setInterval(tick, 1000);

    const onVis = () => {
      if (!document.hidden) void tick();
    };
    document.addEventListener('visibilitychange', onVis);

    return () => {
      cancelled = true;
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [enabled, maxPoints]);

  useEffect(() => {
    primed.current = points.length > 0;
  }, [points.length]);

  return { points, error, live, hasData: primed.current };
}
