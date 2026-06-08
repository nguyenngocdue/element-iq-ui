import { useCallback, useEffect, useRef, useState } from 'react';

interface UseVerticalResizableParams {
  initialHeight: number;
  minHeight: number;
  getMaxHeight: () => number;
  storageKey?: string;
}

function readStoredHeight(
  storageKey: string | undefined,
  initialHeight: number,
  minHeight: number,
  getMaxHeight: () => number,
): number {
  const maxH = getMaxHeight();
  if (!storageKey) return Math.min(maxH, Math.max(minHeight, initialHeight));
  try {
    const saved = localStorage.getItem(storageKey);
    if (!saved) return Math.min(maxH, Math.max(minHeight, initialHeight));
    const n = parseInt(saved, 10);
    if (Number.isNaN(n)) return Math.min(maxH, Math.max(minHeight, initialHeight));
    return Math.min(maxH, Math.max(minHeight, n));
  } catch {
    return Math.min(maxH, Math.max(minHeight, initialHeight));
  }
}

export function useVerticalResizable({
  initialHeight,
  minHeight,
  getMaxHeight,
  storageKey,
}: UseVerticalResizableParams) {
  const [height, setHeight] = useState(() =>
    readStoredHeight(storageKey, initialHeight, minHeight, getMaxHeight),
  );
  const [isDragging, setIsDragging] = useState(false);
  const startPos = useRef(0);
  const startHeight = useRef(0);
  const heightRef = useRef(height);
  heightRef.current = height;

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
    startPos.current = e.clientY;
    startHeight.current = heightRef.current;
  }, []);

  useEffect(() => {
    if (!isDragging) {
      if (storageKey) {
        try {
          localStorage.setItem(storageKey, String(height));
        } catch {
          /* ignore */
        }
      }
      return;
    }

    const handleMouseMove = (e: MouseEvent) => {
      const delta = startPos.current - e.clientY;
      let newHeight = startHeight.current + delta;
      const maxH = getMaxHeight();
      if (newHeight < minHeight) newHeight = minHeight;
      if (newHeight > maxH) newHeight = maxH;
      setHeight(newHeight);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isDragging, minHeight, getMaxHeight, storageKey, height]);

  useEffect(() => {
    const clamp = () => {
      const maxH = getMaxHeight();
      setHeight((h) => Math.min(maxH, Math.max(minHeight, h)));
    };
    window.addEventListener('resize', clamp);
    return () => window.removeEventListener('resize', clamp);
  }, [minHeight, getMaxHeight]);

  return { height, isDragging, handleMouseDown };
}
