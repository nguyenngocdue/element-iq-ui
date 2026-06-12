import { useCallback, useMemo, useState } from 'react';

export type SortDir = 'asc' | 'desc';

type SortValue = string | number | boolean | null | undefined;

export function useTableSort(defaultKey?: string, defaultDir: SortDir = 'asc') {
  const [sortKey, setSortKey] = useState<string | null>(defaultKey ?? null);
  const [sortDir, setSortDir] = useState<SortDir>(defaultDir);

  const toggleSort = useCallback((key: string) => {
    setSortKey((prev) => {
      if (prev === key) {
        setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
        return key;
      }
      setSortDir('asc');
      return key;
    });
  }, []);

  const sortRows = useCallback(
    <T,>(rows: T[], accessors: Record<string, (row: T) => SortValue>): T[] => {
      if (!sortKey || !accessors[sortKey]) return rows;
      const get = accessors[sortKey];
      const dir = sortDir === 'asc' ? 1 : -1;
      return [...rows].sort((a, b) => {
        const va = get(a);
        const vb = get(b);
        if (va == null && vb == null) return 0;
        if (va == null) return 1;
        if (vb == null) return -1;
        if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * dir;
        if (typeof va === 'boolean' && typeof vb === 'boolean') {
          return (Number(va) - Number(vb)) * dir;
        }
        return String(va).localeCompare(String(vb), undefined, { sensitivity: 'base' }) * dir;
      });
    },
    [sortKey, sortDir],
  );

  return useMemo(
    () => ({ sortKey, sortDir, toggleSort, sortRows }),
    [sortKey, sortDir, toggleSort, sortRows],
  );
}
