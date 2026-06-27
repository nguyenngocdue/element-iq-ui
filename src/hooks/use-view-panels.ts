import { useEffect, useMemo, useState } from 'react';
import { DocumentFile } from '../types';
import { fetchArtifactText } from '../lib/fetchArtifact';
import { useReportJson } from './use-report-json';
import {
  hasViewPanelsData,
  parseViewPanelsFromLayoutJson,
  parseViewPanelsFromReport,
  ParsedViewPanels,
} from '../lib/viewPanels';

export function useViewPanels(file: DocumentFile | undefined): {
  viewPanels: ParsedViewPanels | null;
  loading: boolean;
} {
  const { content: reportContent, loading: reportLoading } = useReportJson(file);
  const [layoutContent, setLayoutContent] = useState<string | null>(null);
  const [layoutLoading, setLayoutLoading] = useState(false);

  const layoutArtifact = file?.artifacts?.find((a) => a.type === 'LAYOUT_JSON');

  useEffect(() => {
    if (!file || file.viewPanels?.panels?.length) {
      setLayoutContent(null);
      setLayoutLoading(false);
      return;
    }
    if (!layoutArtifact?.downloadUrl || !layoutArtifact.id) {
      setLayoutContent(null);
      setLayoutLoading(false);
      return;
    }

    let cancelled = false;
    setLayoutLoading(true);
    (async () => {
      try {
        const text = await fetchArtifactText({
          id: layoutArtifact.id,
          downloadUrl: layoutArtifact.downloadUrl,
        });
        if (cancelled) return;
        setLayoutContent(text);
      } catch {
        if (!cancelled) setLayoutContent(null);
      } finally {
        if (!cancelled) setLayoutLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [file?.id, file?.viewPanels?.panels?.length, layoutArtifact?.downloadUrl, layoutArtifact?.id]);

  const viewPanels = useMemo(() => {
    if (file?.viewPanels?.panels?.length) return file.viewPanels;
    const fromReport = parseViewPanelsFromReport(reportContent);
    if (fromReport) return fromReport;
    return parseViewPanelsFromLayoutJson(layoutContent);
  }, [file?.viewPanels, reportContent, layoutContent]);

  const loading = reportLoading || layoutLoading;

  return { viewPanels, loading };
}

export { hasViewPanelsData };
