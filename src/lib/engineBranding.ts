/** User-facing analysis engine name — never expose YOLO/OCR in the UI. */
export const ELEMENTIQ_ENGINE = 'ElementIQ Engine';

export function analysisStageFromProgress(progress: number): string {
  if (progress < 25) return `${ELEMENTIQ_ENGINE} — Preparing Drawing…`;
  if (progress < 45) return `${ELEMENTIQ_ENGINE} — Scanning Elements…`;
  if (progress < 70) return `${ELEMENTIQ_ENGINE} — Reading Qty Tags…`;
  if (progress < 85) return `${ELEMENTIQ_ENGINE} — Validating Results…`;
  return `${ELEMENTIQ_ENGINE} — Saving Report…`;
}

export function analysisOperationFromProgress(progress: number): string {
  if (progress < 20) return 'UPLOAD';
  if (progress < 50) return 'SCAN';
  if (progress < 80) return 'READ TAGS';
  if (progress < 95) return 'VALIDATE';
  return 'SAVE REPORT';
}
