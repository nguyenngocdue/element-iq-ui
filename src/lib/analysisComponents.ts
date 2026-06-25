/** IDs aligned with element-iq-server/configs/components.json */

export const GROUT_TUBE_ID = 'grout-tube';
export const SHEET_LAYOUT_ID = 'sheet-layout';

export const GROUT_PIPELINE_STAGES = 'layout → name views → detach text → grout on PLAN/REINF';

/** Runs inside sheet-analyze with grout-tube — not shown in Analysis Configuration. */
export const AUTO_RUN_ANALYSIS_COMPONENT_IDS: ReadonlySet<string> = new Set([SHEET_LAYOUT_ID]);

export function isAutoRunAnalysisComponent(id: string): boolean {
  return AUTO_RUN_ANALYSIS_COMPONENT_IDS.has(id);
}

/** Grout Tube runs sheet-analyze; sheet-layout is automatic, never user-selected. */
export function normalizeSelectedComponents(ids: string[]): string[] {
  return ids.filter((id) => !isAutoRunAnalysisComponent(id));
}

export function groutTubeSelected(ids: string[]): boolean {
  return ids.includes(GROUT_TUBE_ID);
}
