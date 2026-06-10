import type { ValidationAnnotation } from '../types';
import type { ActiveAnnotationStatus } from './analysisStatus';
import { ELEMENTIQ_ENGINE } from './engineBranding';
export type AnnotationTone = 'pass' | 'fail' | 'warn' | 'info';

export interface AnnotationPresentation {
  tone: AnnotationTone;
  /** Title row — short, no counts */
  title: string;
  /** Left column — prominent number */
  statNumber: string;
  /** Optional caption under the number */
  statUnit?: string;
  /** Right column — explanation */
  statContent: string;
  shortLabel: string;
}

const VIEW_ORDER = ['PLAN AS CAST', 'REINFORCEMENT PLAN'] as const;

function viewSortKey(view?: string): number {
  if (!view) return 99;
  const idx = VIEW_ORDER.indexOf(view as (typeof VIEW_ORDER)[number]);
  return idx >= 0 ? idx : 50;
}

export function sortValidationAnnotations(
  annotations: ValidationAnnotation[],
): ValidationAnnotation[] {
  return [...annotations].sort(
    (a, b) => viewSortKey(a.view) - viewSortKey(b.view),
  );
}

function qty(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return '—';
  return String(n);
}

export function describeValidationAnnotation(
  ann: ValidationAnnotation,
): AnnotationPresentation {
  const view = ann.view ?? 'Drawing check';
  const detected = ann.detectedQuantity;
  const expected = ann.expectedQuantity;
  const tag = ann.noteRawText?.trim();
  const n = qty(detected);

  switch (ann.status as ActiveAnnotationStatus) {
    case 'PASS':
      return {
        tone: 'pass',
        shortLabel: 'OK',
        title: `${view}`,
        statNumber: n,
        statUnit: 'tubes',
        statContent: tag
          ? `Tag "${tag}" read · matches ${n} tube(s) on this view.`
          : `Qty tag matches ${n} tube(s) on this view.`,
      };
    case 'FAIL':
      return {
        tone: 'fail',
        shortLabel: 'Mismatch',
        title: `${view} — Qty Mismatch`,
        statNumber: n,
        statUnit: 'found',
        statContent: tag
          ? `Tag "${tag}" expects ${qty(expected)} but ${ELEMENTIQ_ENGINE} found ${n} tube(s).`
          : `Expected ${qty(expected)} tube(s), ${ELEMENTIQ_ENGINE} found ${n}.`,
      };
    case 'MISSING-TAG':
      return {
        tone: 'warn',
        shortLabel: 'No Tag',
        title: `${view} — Qty Tag Not Found`,
        statNumber: n,
        statUnit: 'tubes',
        statContent: 'Detected on this view but qty tag (e.g. 6/T70-NF) was not read.',
      };
    case 'TAG-OCR-SUSPECT':
      return {
        tone: 'warn',
        shortLabel: 'Check Tag',
        title: `${view} — Tag Needs Review`,
        statNumber: n,
        statUnit: 'tubes',
        statContent: tag
          ? `"${tag}" may be incorrect — verify against the drawing.`
          : 'Qty tag read with low confidence — verify manually.',
      };
    case 'VISION-GAP':
      return {
        tone: 'fail',
        shortLabel: 'Count Gap',
        title: `${view} — Count Differs From Plan`,
        statNumber: n,
        statUnit: 'tubes',
        statContent:
          ann.reason?.replace(/^\d+\s*tubes?\s*/i, '')
          ?? 'Count on this view differs from Plan As Cast.',
      };
    case 'REINF-COUNT':
      return {
        tone: 'info',
        shortLabel: 'Reference',
        title: `${view}`,
        statNumber: n,
        statUnit: 'tubes',
        statContent: 'Reference count only — reinforcement views have no qty tag.',
      };
    case 'VIEW-AMBIGUOUS':
      return {
        tone: 'warn',
        shortLabel: 'Unclear Split',
        title: `${view} — Boundary Review`,
        statNumber: n !== '—' ? n : '?',
        statUnit: 'tubes',
        statContent: 'Tube(s) near the plan/reinforcement split — check annotated PNG.',
      };
    default:
      return {
        tone: 'warn',
        shortLabel: ann.status,
        title: view,
        statNumber: n,
        statUnit: 'tubes',
        statContent: ann.reason ?? ann.status,
      };
  }
}

export interface GroutCheckSummary {
  tone: AnnotationTone;
  title: string;
  statNumber: string;
  statUnit?: string;
  statContent: string;
}

export function summarizeGroutCheck(
  annotations: ValidationAnnotation[],
  tubeCount: number,
): GroutCheckSummary {
  if (annotations.length === 0) {
    return {
      tone: 'info',
      title: 'No Validation Data Yet',
      statNumber: '—',
      statContent: 'Run analysis to check grout tubes and qty tags.',
    };
  }

  const sorted = sortValidationAnnotations(annotations);
  const plan = sorted.find((a) => a.view === 'PLAN AS CAST');
  const issues = sorted.filter(
    (a) => a.status !== 'PASS' && a.status !== 'REINF-COUNT',
  );

  if (issues.length === 0 && plan?.status === 'PASS') {
    return {
      tone: 'pass',
      title: 'Grout Tube Check Passed',
      statNumber: String(tubeCount),
      statUnit: 'tubes',
      statContent: 'Plan qty tag matches tube count on all checked views.',
    };
  }

  if (plan?.status === 'MISSING-TAG') {
    return {
      tone: 'warn',
      title: 'Qty Tag Missing On Plan',
      statNumber: qty(plan.detectedQuantity),
      statUnit: 'tubes',
      statContent: 'On plan but tag (e.g. 6/T70-NF) was not read.',
    };
  }

  if (issues.some((a) => a.status === 'FAIL' || a.status === 'VISION-GAP')) {
    const first = issues.find((a) => a.status === 'FAIL' || a.status === 'VISION-GAP')!;
    const copy = describeValidationAnnotation(first);
    return {
      tone: 'fail',
      title: copy.title,
      statNumber: copy.statNumber,
      statUnit: copy.statUnit,
      statContent: `${issues.length} issue(s) on this sheet · ${copy.statContent}`,
    };
  }

  return {
    tone: 'warn',
    title: `${issues.length} Item(s) Need Review`,
    statNumber: String(issues.length),
    statUnit: 'issues',
    statContent: `${tubeCount} tube(s) on drawing — check plan tag and reinforcement count.`,
  };
}

export const TONE_STYLES: Record<
  AnnotationTone,
  { border: string; bg: string; text: string; icon: string }
> = {
  pass: {
    border: 'border-[#22c55e]/40',
    bg: 'bg-[#22c55e]/10',
    text: 'text-[#22c55e]',
    icon: 'text-[#22c55e]',
  },
  fail: {
    border: 'border-[#ef4444]/40',
    bg: 'bg-[#ef4444]/10',
    text: 'text-[#ef4444]',
    icon: 'text-[#ef4444]',
  },
  warn: {
    border: 'border-[#f59e0b]/40',
    bg: 'bg-[#f59e0b]/10',
    text: 'text-[#f59e0b]',
    icon: 'text-[#f59e0b]',
  },
  info: {
    border: 'border-[#38bdf8]/30',
    bg: 'bg-[#38bdf8]/8',
    text: 'text-[#7dd3fc]',
    icon: 'text-[#38bdf8]',
  },
};
