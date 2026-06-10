import { useMemo } from 'react';
import { DocumentFile } from '../types';
import { useReportJson } from './use-report-json';
import {
  parseViewSplitFromAnalysis,
  parseViewSplitFromReport,
  ParsedViewSplit,
} from '../lib/viewSplit';

/**
 * Resolve PLAN/REINFORCEMENT split from cached file state, inline analysis, or REPORT_JSON artifact.
 */
export function useViewSplit(file: DocumentFile | undefined): {
  viewSplit: ParsedViewSplit | null;
  loading: boolean;
} {
  const { content, loading } = useReportJson(file);

  const viewSplit = useMemo(() => {
    if (file?.viewSplit) return file.viewSplit;
    const fromReport = parseViewSplitFromReport(content);
    if (fromReport) return fromReport;
    return null;
  }, [file?.viewSplit, content]);

  return { viewSplit, loading };
}

export function viewSplitFromAnalysisPayload(analysis: unknown): ParsedViewSplit | null {
  return parseViewSplitFromAnalysis(analysis as { component_results?: unknown[] });
}
