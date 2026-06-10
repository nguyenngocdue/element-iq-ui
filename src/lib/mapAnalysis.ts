import type { Detection, ValidationAnnotation } from '../types';

const DPI_RATIO = 72 / 300;

type ComponentResult = {
  component_id?: string;
  objects?: Array<{
    bbox?: number[];
    face?: string;
    confidence?: number;
  }>;
  report?: Array<{
    status?: string;
    reason?: string | null;
    expected?: { view?: string; quantity?: number | null; face?: string | null };
    detected?: { quantity?: number; faces?: Record<string, number> };
    note_raw_text?: string | null;
    matched_cluster?: { object_ids?: number[] };
  }>;
};

export function mapValidationAnnotations(
  componentResults: ComponentResult[] | undefined,
): ValidationAnnotation[] {
  return (componentResults ?? []).flatMap((comp) =>
    (comp.report ?? []).map((entry, i) => ({
      id: `${comp.component_id ?? 'component'}-report-${i}`,
      status: (entry.status ?? 'PASS') as ValidationAnnotation['status'],
      view: entry.expected?.view,
      reason: entry.reason ?? undefined,
      componentId: comp.component_id,
      noteRawText: entry.note_raw_text ?? undefined,
      expectedQuantity: entry.expected?.quantity ?? undefined,
      detectedQuantity: entry.detected?.quantity ?? undefined,
    })),
  );
}

export function mapObjectDetections(
  componentResults: ComponentResult[] | undefined,
): Detection[] {
  return (componentResults ?? []).flatMap((comp) =>
    (comp.objects ?? []).map((obj, i) => {
      const [x1, y1, x2, y2] = obj.bbox ?? [0, 0, 0, 0];
      const report = (comp.report ?? []).find((r) => {
        const ids = r.matched_cluster?.object_ids ?? [];
        return ids.includes(i + 1);
      });
      const detStatus =
        report?.status === 'FAIL'
          ? 'FAIL'
          : report?.status === 'MISSING-TAG' || report?.status === 'TAG-OCR-SUSPECT'
            ? 'WARN'
            : 'PASS';
      return {
        id: `${comp.component_id}-${i}`,
        page: 1,
        x: x1 * DPI_RATIO,
        y: y1 * DPI_RATIO,
        width: (x2 - x1) * DPI_RATIO,
        height: (y2 - y1) * DPI_RATIO,
        type: (obj.face ?? 'UNKNOWN') as Detection['type'],
        confidence: obj.confidence ?? 0,
        status: detStatus,
        reason: report?.reason ?? undefined,
        componentId: comp.component_id,
      };
    }),
  );
}

export function countDetectedTubes(componentResults: ComponentResult[] | undefined): number {
  return (componentResults ?? []).reduce(
    (sum, comp) => sum + (comp.objects?.length ?? 0),
    0,
  );
}
