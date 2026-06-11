import { useMemo } from 'react';
import { DocumentFile } from '../types';
import { useReportJson } from './use-report-json';
import { parseViewTitlesFromReport, ParsedViewTitles } from '../lib/viewTitles';

export function useViewTitles(file: DocumentFile | undefined): {
  viewTitles: ParsedViewTitles | null;
  loading: boolean;
} {
  const { content, loading } = useReportJson(file);

  const viewTitles = useMemo(() => {
    if (file?.viewTitles) return file.viewTitles;
    return parseViewTitlesFromReport(content);
  }, [file?.viewTitles, content]);

  return { viewTitles, loading };
}
