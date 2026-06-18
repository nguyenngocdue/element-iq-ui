import { useMemo } from 'react';
import { DocumentFile } from '../types';
import { useReportJson } from './use-report-json';
import { hasViewPanelsData, parseViewPanelsFromReport, ParsedViewPanels } from '../lib/viewPanels';

export function useViewPanels(file: DocumentFile | undefined): {
  viewPanels: ParsedViewPanels | null;
  loading: boolean;
} {
  const { content, loading } = useReportJson(file);

  const viewPanels = useMemo(() => {
    if (file?.viewPanels) return file.viewPanels;
    return parseViewPanelsFromReport(content);
  }, [file?.viewPanels, content]);

  return { viewPanels, loading };
}

export { hasViewPanelsData };
