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
  if (tubeCount === 0) {
    return {
      tone: 'warn',
      title: 'No Grout Tubes Detected',
      statNumber: '0',
      statUnit: 'tubes',
      statContent: 'Sheet has no grout tubes (NO-TUBE).',
    };
  }

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

  const blockingIssues = issues.filter(
    (a) => a.status === 'FAIL' || a.status === 'MISSING-TAG' || a.status === 'TAG-OCR-SUSPECT',
  );

  if (blockingIssues.some((a) => a.status === 'FAIL')) {
    const first = blockingIssues.find((a) => a.status === 'FAIL')!;
    const copy = describeValidationAnnotation(first);
    return {
      tone: 'fail',
      title: copy.title,
      statNumber: copy.statNumber,
      statUnit: copy.statUnit,
      statContent: `${blockingIssues.length} issue(s) on this sheet · ${copy.statContent}`,
    };
  }

  if (plan?.status === 'PASS' && blockingIssues.length === 0) {
    const infoGap = issues.find((a) => a.status === 'VISION-GAP');
    if (infoGap) {
      const copy = describeValidationAnnotation(infoGap);
      return {
        tone: 'pass',
        title: 'Grout Tube Check Passed',
        statNumber: String(tubeCount),
        statUnit: 'tubes',
        statContent: `Plan qty tag matches. Note: ${copy.statContent}`,
      };
    }
    return {
      tone: 'pass',
      title: 'Grout Tube Check Passed',
      statNumber: String(tubeCount),
      statUnit: 'tubes',
      statContent: 'Plan qty tag matches tube count on all checked views.',
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
    border: 'border-[#4ade80]/55',
    bg: 'bg-[#1a3d28]',
    text: 'text-[#86efac]',
    icon: 'text-[#4ade80]',
  },
  fail: {
    border: 'border-[#f87171]/55',
    bg: 'bg-[#3d1818]',
    text: 'text-[#fca5a5]',
    icon: 'text-[#f87171]',
  },
  warn: {
    border: 'border-[#fbbf24]/55',
    bg: 'bg-[#3d2a0f]',
    text: 'text-[#fde047]',
    icon: 'text-[#fbbf24]',
  },
  info: {
    border: 'border-[#38bdf8]/50',
    bg: 'bg-[#152838]',
    text: 'text-[#bae6fd]',
    icon: 'text-[#38bdf8]',
  },
};
