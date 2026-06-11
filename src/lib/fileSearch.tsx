import type { ReactNode } from 'react';
import { DocumentFile } from '../types';
import { statusBadgeLabel } from './analysisStatus';

export function artifactLabel(type: string): string {
  if (type === 'ANNOTATED_PNG') return 'Annotated PNG';
  if (type === 'ANNOTATED_PDF') return 'Annotated PDF';
  return 'Report JSON';
}

/** Match file name, status, id, or artifact labels. */
export function fileMatchesQuery(file: DocumentFile, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;

  if (file.name.toLowerCase().includes(q)) return true;
  if (file.status.toLowerCase().includes(q)) return true;
  if (file.overallStatus?.toLowerCase().includes(q)) return true;
  if (statusBadgeLabel(file.status, file.overallStatus).toLowerCase().includes(q)) return true;
  if (file.id.toLowerCase().includes(q)) return true;

  if (file.artifacts?.some((a) => {
    const label = artifactLabel(a.type).toLowerCase();
    return label.includes(q) || a.type.toLowerCase().includes(q);
  })) {
    return true;
  }

  return false;
}

export function filterFilesByQuery(files: DocumentFile[], query: string): DocumentFile[] {
  const q = query.trim();
  if (!q) return files;
  return files.filter((f) => fileMatchesQuery(f, q));
}

export function highlightMatch(text: string, query: string): ReactNode {
  const q = query.trim();
  if (!q) return text;

  const lower = text.toLowerCase();
  const idx = lower.indexOf(q.toLowerCase());
  if (idx < 0) return text;

  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-[#10b981]/35 text-inherit rounded-sm px-0.5">{text.slice(idx, idx + q.length)}</mark>
      {text.slice(idx + q.length)}
    </>
  );
}
