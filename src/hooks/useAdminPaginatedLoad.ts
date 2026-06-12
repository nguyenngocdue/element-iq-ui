import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { Paginated } from '../lib/adminApi';
import { useDebouncedValue } from './useDebouncedValue';

export const ADMIN_PAGE_SIZE_OPTIONS = [50, 100, 200, 500] as const;
export type AdminPageSize = (typeof ADMIN_PAGE_SIZE_OPTIONS)[number];

function parsePageSize(value: string | null, fallback: AdminPageSize): AdminPageSize {
  const n = Number(value);
  return (ADMIN_PAGE_SIZE_OPTIONS as readonly number[]).includes(n) ? (n as AdminPageSize) : fallback;
}

function parsePage(value: string | null): number {
  const n = Number(value);
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1;
}

function patchAdminQuery(
  prev: URLSearchParams,
  patch: Partial<{ q: string; page: number; page_size: number }>,
  defaults: { page_size: AdminPageSize },
): URLSearchParams {
  const next = new URLSearchParams(prev);
  if (patch.q !== undefined) {
    if (patch.q.trim()) next.set('q', patch.q.trim());
    else next.delete('q');
  }
  if (patch.page !== undefined) {
    if (patch.page > 1) next.set('page', String(patch.page));
    else next.delete('page');
  }
  if (patch.page_size !== undefined) {
    if (patch.page_size !== defaults.page_size) next.set('page_size', String(patch.page_size));
    else next.delete('page_size');
  }
  return next;
}

export function useAdminPaginatedLoad<T>({
  fetcher,
  refreshKey,
  defaultPageSize = 50,
  debounceMs = 250,
}: {
  fetcher: (search: string, page: number, pageSize: number) => Promise<Paginated<T>>;
  refreshKey: number;
  defaultPageSize?: AdminPageSize;
  debounceMs?: number;
}) {
  const [searchParams, setSearchParams] = useSearchParams();
  const qParam = searchParams.get('q') ?? '';
  const page = parsePage(searchParams.get('page'));
  const pageSize = parsePageSize(searchParams.get('page_size'), defaultPageSize);

  const [searchInput, setSearchInputState] = useState(qParam);
  const debouncedSearch = useDebouncedValue(searchInput, debounceMs);
  const [rows, setRows] = useState<T[]>([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasLoadedRef = useRef(false);
  const lastPushedQ = useRef(qParam);

  // Browser back/forward or external link → sync input
  useEffect(() => {
    if (qParam !== lastPushedQ.current) {
      setSearchInputState(qParam);
      lastPushedQ.current = qParam;
    }
  }, [qParam]);

  // Debounced search → URL (resets page)
  useEffect(() => {
    const trimmed = debouncedSearch.trim();
    if (trimmed === qParam) return;
    lastPushedQ.current = trimmed;
    setSearchParams(
      (prev) => patchAdminQuery(prev, { q: trimmed, page: 1 }, { page_size: defaultPageSize }),
      { replace: true },
    );
  }, [debouncedSearch, qParam, defaultPageSize, setSearchParams]);

  const setSearchInput = useCallback((value: string) => {
    setSearchInputState(value);
  }, []);

  const setPage = useCallback(
    (nextPage: number) => {
      const p = Math.max(1, nextPage);
      setSearchParams(
        (prev) => patchAdminQuery(prev, { page: p }, { page_size: defaultPageSize }),
        { replace: true },
      );
    },
    [defaultPageSize, setSearchParams],
  );

  const setPageSize = useCallback(
    (size: AdminPageSize) => {
      setSearchParams(
        (prev) => patchAdminQuery(prev, { page_size: size, page: 1 }, { page_size: defaultPageSize }),
        { replace: true },
      );
    },
    [defaultPageSize, setSearchParams],
  );

  const load = useCallback(
    async (search: string, p: number, size: number, signal?: { cancelled: boolean }) => {
      if (!hasLoadedRef.current) setLoading(true);
      else setSearching(true);
      setError(null);
      try {
        const res = await fetcher(search, p, size);
        if (!signal?.cancelled) {
          setRows(res.items);
          setTotal(res.total);
          setPages(Math.max(1, res.pages));
          if (p > res.pages && res.pages > 0) {
            setSearchParams(
              (prev) => patchAdminQuery(prev, { page: res.pages }, { page_size: defaultPageSize }),
              { replace: true },
            );
          }
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
    [fetcher, defaultPageSize, setSearchParams],
  );

  useEffect(() => {
    const signal = { cancelled: false };
    void load(qParam, page, pageSize, signal);
    return () => {
      signal.cancelled = true;
    };
  }, [qParam, page, pageSize, refreshKey, load]);

  return {
    rows,
    setRows,
    searchInput,
    setSearchInput,
    page,
    setPage,
    pageSize,
    setPageSize,
    total,
    pages,
    loading,
    searching,
    error,
    setError,
  };
}
