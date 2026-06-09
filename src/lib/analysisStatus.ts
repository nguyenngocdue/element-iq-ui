import type { DocumentFile } from '../types';

const OVERALL_PRIORITY: Record<string, number> = {
  FAIL: 0,
  WARN: 1,
  'NO-TUBE': 2,
  'NO-NOTE': 3,
  PASS: 4,
};

const KNOWN_OVERALL = ['PASS', 'FAIL', 'NO-NOTE', 'NO-TUBE', 'WARN'] as const;

/** UI groupings — add new overall labels to STATUS_BUCKETS once, not in every component. */
export const STATUS_BUCKETS = {
  pass: ['PASS'] as const,
  fail: ['FAIL'] as const,
  /** Explorer/dashboard "No note" column: unanalyzed + non-pass outcomes */
  noNote: ['PENDING', 'WARN', 'NO-NOTE', 'NO-TUBE'] as const,
  inProgress: ['UPLOADING', 'ANALYZING'] as const,
} satisfies Record<string, readonly DocumentFile['status'][]>;

export type StatusBucket = keyof typeof STATUS_BUCKETS;

type AnalysisPayload = {
  overall_status?: string;
  summary?: { overall?: string; pass_rate?: number };
  component_results?: Array<{
    component_id?: string;
    overall_status?: string;
    summary?: { overall?: string };
    objects?: unknown[];
    report?: unknown[];
  }>;
  artifacts?: unknown[];
} | null | undefined;

function inBucket(status: DocumentFile['status'], bucket: StatusBucket): boolean {
  return (STATUS_BUCKETS[bucket] as readonly string[]).includes(status);
}

export function fileMatchesBucket(file: DocumentFile, bucket: StatusBucket): boolean {
  return inBucket(file.status, bucket);
}

export function filterFilesByBucket(files: DocumentFile[], bucket: StatusBucket): DocumentFile[] {
  return files.filter((f) => fileMatchesBucket(f, bucket));
}

export function countFilesByBucket(files: DocumentFile[], bucket: StatusBucket): number {
  return filterFilesByBucket(files, bucket).length;
}

export function resolveOverallRaw(analysis: AnalysisPayload): string {
  if (!analysis) return '';

  const candidates: string[] = [];
  if (analysis.overall_status) candidates.push(analysis.overall_status);
  if (analysis.summary?.overall) candidates.push(analysis.summary.overall);

  for (const comp of analysis.component_results ?? []) {
    if (comp.overall_status) candidates.push(comp.overall_status);
    if (comp.summary?.overall) candidates.push(comp.summary.overall);
  }

  if (candidates.length === 0) return '';

  return candidates.reduce((worst, cur) => {
    const w = OVERALL_PRIORITY[cur.toUpperCase()] ?? 99;
    const c = OVERALL_PRIORITY[worst.toUpperCase()] ?? 99;
    return c < w ? cur : worst;
  });
}

export function hasAnalysisPayload(analysis: AnalysisPayload): boolean {
  if (!analysis) return false;
  return Boolean(
    analysis.component_results?.length
    || analysis.artifacts?.length
    || analysis.overall_status
    || analysis.summary?.overall,
  );
}

export function mapOverallToFileStatus(
  overallRaw: string,
  hasAnalysisData: boolean,
): DocumentFile['status'] {
  if (!hasAnalysisData) return 'PENDING';

  const overall = overallRaw.toUpperCase();
  if ((KNOWN_OVERALL as readonly string[]).includes(overall)) {
    return overall as DocumentFile['status'];
  }
  return 'PASS';
}

export function resolvePassRate(analysis: AnalysisPayload, overallUpper: string): number | undefined {
  if (!hasAnalysisPayload(analysis)) return undefined;
  if (typeof analysis?.summary?.pass_rate === 'number') return analysis.summary.pass_rate;
  if (overallUpper === 'PASS') return 100;
  return 0;
}

export function isAnalyzedStatus(status: DocumentFile['status']): boolean {
  return !inBucket(status, 'inProgress') && status !== 'PENDING';
}

export function filePassRate(file: DocumentFile): number {
  if (typeof file.passRate === 'number') return file.passRate;
  return file.status === 'PASS' ? 100 : 0;
}

export function averagePassRate(files: DocumentFile[]): number {
  if (!files.length) return 0;
  return files.reduce((acc, f) => acc + filePassRate(f), 0) / files.length;
}

export function analysisCompleteMessage(status: DocumentFile['status'] | undefined): string | null {
  if (!status || !isAnalyzedStatus(status)) return null;
  return `Analysis Complete — ${statusBadgeLabel(status)}`;
}

export function validationPanelAccentClass(status: DocumentFile['status']): string {
  if (status === 'PASS') return 'bg-[#22c55e]/20 text-[#22c55e]';
  if (status === 'WARN') return 'bg-[#f59e0b]/20 text-[#f59e0b]';
  if (status === 'FAIL') return 'bg-[#ef4444]/20 text-[#ef4444]';
  if (status === 'NO-NOTE' || status === 'NO-TUBE') return 'bg-[#fb923c]/20 text-[#fb923c]';
  return 'bg-[#ef4444]/20 text-[#ef4444]';
}

export function statusBadgeLabel(status: DocumentFile['status']): string {
  if (status === 'PENDING') return 'READY';
  return status;
}

export function statusBadgeClass(status: DocumentFile['status']): string {
  switch (status) {
    case 'PASS':
      return 'text-[#2eb886] bg-[#2eb886]/10 border-[#2eb886]/30';
    case 'FAIL':
      return 'text-[#ef4444] bg-[#ef4444]/10 border-[#ef4444]/30';
    case 'WARN':
      return 'text-[#f59e0b] bg-[#f59e0b]/10 border-[#f59e0b]/30';
    case 'NO-NOTE':
      return 'text-[#bba438] bg-[#bba438]/10 border-[#bba438]/30';
    case 'NO-TUBE':
      return 'text-[#fb923c] bg-[#fb923c]/10 border-[#fb923c]/30';
    default:
      return 'text-[#858585] bg-[#858585]/10 border-[#858585]/30';
  }
}
