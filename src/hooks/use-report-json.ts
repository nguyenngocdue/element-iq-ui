import { useEffect, useState } from 'react';
import { DocumentFile } from '../types';

type ReportJsonState = {
  content: string | null;
  loading: boolean;
  error: string | null;
};

export function useReportJson(file: DocumentFile | undefined): ReportJsonState {
  const [state, setState] = useState<ReportJsonState>({
    content: null,
    loading: false,
    error: null,
  });

  useEffect(() => {
    if (!file) {
      setState({ content: null, loading: false, error: null });
      return;
    }

    const artifact = file.artifacts?.find((a) => a.type === 'REPORT_JSON');
    if (!artifact?.downloadUrl) {
      setState({ content: null, loading: false, error: 'No report JSON artifact available.' });
      return;
    }

    let cancelled = false;

    (async () => {
      setState({ content: null, loading: true, error: null });
      try {
        const { authFetch } = await import('../lib/supabase');
        const res = await authFetch(artifact.downloadUrl);
        if (cancelled) return;
        if (!res.ok) {
          setState({ content: null, loading: false, error: `HTTP ${res.status}` });
          return;
        }
        const text = await res.text();
        if (!cancelled) {
          setState({ content: text, loading: false, error: null });
        }
      } catch (err) {
        if (!cancelled) {
          setState({
            content: null,
            loading: false,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [file?.id, file?.artifacts]);

  return state;
}
