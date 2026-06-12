import { useCallback, useEffect, useRef, useState } from 'react';
import { useDebouncedValue } from './useDebouncedValue';

export function useAdminSearchLoad<T>({
  fetcher,
  refreshKey,
  debounceMs = 250,
}: {
  fetcher: (search: string) => Promise<T[]>;
  refreshKey: number;
  debounceMs?: number;
}) {
  const [searchInput, setSearchInput] = useState('');
  const debouncedSearch = useDebouncedValue(searchInput, debounceMs);
  const [rows, setRows] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasLoadedRef = useRef(false);

  const load = useCallback(
    async (search: string, signal?: { cancelled: boolean }) => {
      if (!hasLoadedRef.current) setLoading(true);
      else setSearching(true);
      setError(null);
      try {
        const items = await fetcher(search);
        if (!signal?.cancelled) {
          setRows(items);
          hasLoadedRef.current = true;
        }
      } catch (e: unknown) {
        if (!signal?.cancelled) {
          setError(e instanceof Error ? e.message : 'Failed to load');
        }
      } finally {
        if (!signal?.cancelled) {
          setLoading(false);
          setSearching(false);
        }
      }
    },
    [fetcher],
  );

  useEffect(() => {
    const signal = { cancelled: false };
    void load(debouncedSearch, signal);
    return () => {
      signal.cancelled = true;
    };
  }, [debouncedSearch, refreshKey, load]);

  return {
    rows,
    setRows,
    searchInput,
    setSearchInput,
    loading,
    searching,
    error,
    setError,
  };
}
