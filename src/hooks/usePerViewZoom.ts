import { useCallback, useState } from 'react';

export const DEFAULT_PDF_ZOOM = 0.5;
export const DEFAULT_PNG_ZOOM = 0.21;

export function zoomKeyForFile(fileId: string): string {
  return `file:${fileId}`;
}

export function zoomKeyForArtifact(artifactId: string): string {
  return `artifact:${artifactId}`;
}

export function defaultZoomForKey(key: string): number {
  return key.startsWith('artifact:') ? DEFAULT_PNG_ZOOM : DEFAULT_PDF_ZOOM;
}

export function usePerViewZoom() {
  const [zoomByKey, setZoomByKey] = useState<Record<string, number>>({});

  const getScale = useCallback(
    (key: string | null) => {
      if (!key) return DEFAULT_PDF_ZOOM;
      return zoomByKey[key] ?? defaultZoomForKey(key);
    },
    [zoomByKey],
  );

  const setScaleForKey = useCallback(
    (key: string | null, value: number | ((prev: number) => number)) => {
      if (!key) return;
      setZoomByKey((prev) => {
        const current = prev[key] ?? defaultZoomForKey(key);
        const next = typeof value === 'function' ? value(current) : value;
        if (next === current) return prev;
        return { ...prev, [key]: next };
      });
    },
    [],
  );

  return { getScale, setScaleForKey };
}
