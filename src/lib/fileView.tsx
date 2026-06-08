import { DocumentFile } from '../types';
import { filterFilesByQuery } from './fileSearch';

export type ExplorerSortKey = 'name-asc' | 'name-desc' | 'date-desc' | 'size-desc';

export type ExplorerStatusFilter = 'all' | 'PASS' | 'FAIL' | 'NO-NOTE';

export const DEFAULT_EXPLORER_SORT: ExplorerSortKey = 'name-asc';
export const DEFAULT_EXPLORER_STATUS: ExplorerStatusFilter = 'all';

export const EXPLORER_VIEW_STORAGE_KEY = 'elementiq:explorer-view';

const EXPLORER_SORT_KEYS: ExplorerSortKey[] = ['name-asc', 'name-desc', 'date-desc', 'size-desc'];

export type ExplorerViewPrefs = {
  sort: ExplorerSortKey;
  allCollapsed: boolean;
};

export function readExplorerViewPrefs(): ExplorerViewPrefs {
  try {
    const raw = localStorage.getItem(EXPLORER_VIEW_STORAGE_KEY);
    if (!raw) {
      return { sort: DEFAULT_EXPLORER_SORT, allCollapsed: false };
    }
    const parsed = JSON.parse(raw) as Partial<ExplorerViewPrefs>;
    const sort = EXPLORER_SORT_KEYS.includes(parsed.sort as ExplorerSortKey)
      ? (parsed.sort as ExplorerSortKey)
      : DEFAULT_EXPLORER_SORT;
    return { sort, allCollapsed: Boolean(parsed.allCollapsed) };
  } catch {
    return { sort: DEFAULT_EXPLORER_SORT, allCollapsed: false };
  }
}

export function writeExplorerViewPrefs(updates: Partial<ExplorerViewPrefs>): void {
  try {
    const current = readExplorerViewPrefs();
    localStorage.setItem(
      EXPLORER_VIEW_STORAGE_KEY,
      JSON.stringify({ ...current, ...updates }),
    );
  } catch {
    // ignore quota / private mode
  }
}

export function getFileSizeBytes(file: DocumentFile): number {
  return file.fileSizeBytes ?? file.file.size ?? 0;
}

export function getFileCreatedAt(file: DocumentFile): number {
  if (file.uploadedAt) return new Date(file.uploadedAt).getTime();
  return 0;
}

export function formatFileSizeBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

export function formatFileCreatedAt(file: DocumentFile): string {
  if (!file.uploadedAt) return '—';
  const d = new Date(file.uploadedAt);
  if (Number.isNaN(d.getTime())) return '—';
  const date = d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  const time = d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false });
  return `${date} ${time}`;
}

export function artifactDisplayName(type: string): string {
  if (type === 'ANNOTATED_PNG') return 'Annotated PNG';
  if (type === 'ANNOTATED_PDF') return 'Annotated PDF';
  if (type === 'REPORT_JSON') return 'Report JSON';
  return type;
}

/** Drop artifacts whose stored name/id does not belong to the given drawing filename. */
export function filterArtifactsForFile<T extends { originalFilename?: string; sourceFileId?: string }>(
  artifacts: T[],
  fileId: string,
  fileName: string,
): T[] {
  const stem = fileName.replace(/\.pdf$/i, '');
  return artifacts.filter((a) => {
    if (a.sourceFileId && a.sourceFileId !== fileId) return false;
    if (!a.originalFilename) return true;
    return a.originalFilename.startsWith(stem);
  });
}

export function formatIsoDateTime(iso?: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const date = d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  const time = d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false });
  return `${date} ${time}`;
}

export function filterFilesByStatus(
  files: DocumentFile[],
  status: ExplorerStatusFilter,
): DocumentFile[] {
  if (status === 'all') return files;
  if (status === 'PASS') return files.filter((f) => f.status === 'PASS');
  if (status === 'FAIL') return files.filter((f) => f.status === 'FAIL');
  return files.filter(
    (f) => f.status === 'NO-NOTE' || f.status === 'PENDING' || f.status === 'WARN',
  );
}

export function sortFiles(files: DocumentFile[], sortKey: ExplorerSortKey): DocumentFile[] {
  const copy = [...files];
  switch (sortKey) {
    case 'name-asc':
      return copy.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
    case 'name-desc':
      return copy.sort((a, b) => b.name.localeCompare(a.name, undefined, { sensitivity: 'base' }));
    case 'date-desc':
      return copy.sort((a, b) => getFileCreatedAt(b) - getFileCreatedAt(a));
    case 'size-desc':
      return copy.sort((a, b) => getFileSizeBytes(b) - getFileSizeBytes(a));
    default:
      return copy;
  }
}

export function applyExplorerView(
  files: DocumentFile[],
  options: {
    query: string;
    status: ExplorerStatusFilter;
    sort: ExplorerSortKey;
  },
): DocumentFile[] {
  const searched = filterFilesByQuery(files, options.query);
  const statusFiltered = filterFilesByStatus(searched, options.status);
  return sortFiles(statusFiltered, options.sort);
}

export function explorerViewIsActive(
  sort: ExplorerSortKey,
  status: ExplorerStatusFilter,
): boolean {
  return sort !== DEFAULT_EXPLORER_SORT || status !== DEFAULT_EXPLORER_STATUS;
}

export function statusFilterLabel(status: ExplorerStatusFilter): string | null {
  if (status === 'all') return null;
  if (status === 'PASS') return 'Pass';
  if (status === 'FAIL') return 'Fail';
  return 'No note';
}

export function statusFilterColorClass(status: ExplorerStatusFilter): string {
  if (status === 'PASS') return 'text-[#2eb886]';
  if (status === 'FAIL') return 'text-[#ef4444]';
  if (status === 'NO-NOTE') return 'text-[#bba438]';
  return 'text-[#858585]';
}
