import { useMemo } from 'react';
import { DocumentFile } from '../types';
import { useReportJson } from './use-report-json';
import { parseTagNotesFromReport, ParsedTagNotes } from '../lib/tagNotes';

export function useTagNotes(file: DocumentFile | undefined): {
  tagNotes: ParsedTagNotes | null;
  loading: boolean;
} {
  const { content, loading } = useReportJson(file);

  const tagNotes = useMemo(() => {
    if (file?.tagNotes) return file.tagNotes;
    return parseTagNotesFromReport(content);
  }, [file?.tagNotes, content]);

  return { tagNotes, loading };
}
