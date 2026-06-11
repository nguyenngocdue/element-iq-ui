/** Parse grout qty tag bboxes for validation overlay (mirrors core draw_annotations). */

import { extractReportComponents } from './viewSplit';

export type TagNoteLike = {
  raw_text: string;
  quantity?: number;
  bbox_px?: number[];
  face?: string | null;
  position?: string | null;
};

export type TagCandidateLike = {
  raw_text: string;
  quantity?: number;
  bbox_px?: number[];
  rejected_reason?: string | null;
};

export type TagSelectionMetaLike = {
  source?: string;
  selected_raw_text?: string;
  candidates?: TagCandidateLike[];
};

export type MatchedClusterLike = {
  bbox?: number[];
  anchor?: number[];
};

export type ReportEntryLike = {
  status?: string;
  note_raw_text?: string | null;
  expected?: { view?: string; quantity?: number | null; face?: string | null };
  matched_cluster?: MatchedClusterLike | null;
  tag_selection?: TagSelectionMetaLike | null;
};

export type ComponentResultWithTags = {
  component_id?: string;
  notes?: TagNoteLike[] | null;
  report?: ReportEntryLike[] | null;
};

export type ParsedTagNote = {
  rawText: string;
  quantity: number;
  face: string | null;
  bbox: [number, number, number, number];
  center: [number, number];
  source: 'ocr' | 'pdf' | 'peeled' | 'unknown';
  /** Tag used in a grout-tube pass/fail check (QTY CHECK). */
  usedForCheck: boolean;
  checkIndex?: number;
  rejectedReason?: string | null;
  reportStatus?: string;
  view?: string;
};

export type ParsedTagNotes = {
  tags: ParsedTagNote[];
};

const QTY_TAG_RE = /^\s*(\d+)\s*\/\s*(T\d+)(?:\s*-\s*(NF|FF))?\s*$/i;
const QTY_PT_RE = /^\s*\d+\s*\/\s*P(?:T|TI)\d+/i;

function isAuthoritativeGroutQtyTag(raw: string, position?: string | null): boolean {
  const text = raw.trim().toUpperCase().replace(/\s+/g, ' ');
  if (QTY_PT_RE.test(text)) return false;
  if (/GROUT\s+TUBES?/.test(text)) return true;
  if (QTY_TAG_RE.test(text)) return true;
  if (position && /^T\d+$/.test(position.trim().toUpperCase())) return true;
  return false;
}

function normalizeTagRaw(raw: string): string {
  return raw.trim().replace(/\s+/g, '').toUpperCase();
}

function tagCenter(bbox: number[]): [number, number] {
  const [x1, y1, x2, y2] = bbox;
  return [(x1 + x2) / 2, (y1 + y2) / 2];
}

function padBbox(bbox: number[], pad = 10): [number, number, number, number] {
  const [x1, y1, x2, y2] = bbox;
  return [x1 - pad, y1 - pad, x2 + pad, y2 + pad];
}

function isVerticalBbox(bbox: number[]): boolean {
  const [x1, y1, x2, y2] = bbox;
  const w = x2 - x1;
  const h = y2 - y1;
  return h > w * 1.15;
}

function displayBboxFromRaw(
  bbox: number[],
  center: [number, number],
): [number, number, number, number] {
  const [x1, y1, x2, y2] = bbox;
  const w = x2 - x1;
  const h = y2 - y1;
  const [cx, cy] = center;
  return [cx - h / 2, cy - w / 2, cx + h / 2, cy + w / 2];
}

function resolveOverlayBbox(bbox: number[]): {
  bbox: [number, number, number, number];
  center: [number, number];
} {
  const padded = padBbox(bbox);
  const center = tagCenter(padded);
  if (isVerticalBbox(padded)) {
    return { bbox: displayBboxFromRaw(padded, center), center };
  }
  return { bbox: padded, center };
}

/** Mirrors validator `_estimated_callout_bbox`. */
function estimatedCalloutBbox(cluster: MatchedClusterLike): number[] | null {
  const bb = cluster.bbox;
  if (!bb || bb.length < 4) return null;
  const [x1, , , y2] = bb;
  return [Math.max(0, x1 - 95), y2 - 120, Math.max(0, x1 - 8), y2 + 12];
}

/** Mirrors validator `_tag_draw_bbox` — pin misaligned PDF rects to tube row. */
function resolveDrawBbox(note: TagNoteLike, cluster?: MatchedClusterLike | null): number[] {
  const bb = note.bbox_px;
  if (!bb || bb.length < 4) return [];
  if (!cluster?.bbox || cluster.bbox.length < 4) return bb;

  const nc = tagCenter(bb);
  const [cbX1, cbY1, cbX2, cbY2] = cluster.bbox;
  const w = bb[2] - bb[0];
  const h = bb[3] - bb[1];
  const misalignedX = nc[0] > cbX2 + 80 || nc[0] < cbX1 - 900;
  const aboveRow = nc[1] < cbY1 - 120;
  const belowRow = nc[1] > cbY2 + 250;
  const oversized = w > 220 || h > 220;
  if (misalignedX || aboveRow || belowRow || oversized) {
    return estimatedCalloutBbox(cluster) ?? bb;
  }
  return bb;
}

/** Mirrors validator `_grout_check_reports`. */
function groutCheckReports(reports: ReportEntryLike[]): ReportEntryLike[] {
  return reports.filter((report) => {
    if (report.status === 'VISION-GAP' || report.status === 'REINF-COUNT' || report.status === 'VIEW-AMBIGUOUS') {
      return false;
    }
    const raw = (report.note_raw_text ?? '').trim();
    if (raw && !isAuthoritativeGroutQtyTag(raw)) return false;
    return true;
  });
}

function findNoteForReport(
  raw: string,
  notes: TagNoteLike[],
  cluster?: MatchedClusterLike | null,
): TagNoteLike | null {
  const target = raw.trim();
  const candidates = notes.filter((n) => (n.raw_text ?? '').trim() === target);
  if (!candidates.length) return null;
  if (candidates.length === 1) return candidates[0];

  const anchor = cluster?.anchor;
  if (!anchor || anchor.length < 2) return candidates[0];

  let best = candidates[0];
  let bestDist = Infinity;
  for (const note of candidates) {
    if (!note.bbox_px || note.bbox_px.length < 4) continue;
    const nc = tagCenter(note.bbox_px);
    const dist = (nc[0] - anchor[0]) ** 2 + (nc[1] - anchor[1]) ** 2;
    if (dist < bestDist) {
      bestDist = dist;
      best = note;
    }
  }
  return best;
}

function resolveTagSource(
  rawText: string,
  selection: TagSelectionMetaLike | null,
): ParsedTagNote['source'] {
  if (!selection?.selected_raw_text) return 'unknown';
  if (normalizeTagRaw(rawText) !== normalizeTagRaw(selection.selected_raw_text)) return 'unknown';
  const src = (selection.source ?? 'unknown').toLowerCase();
  if (src === 'ocr' || src === 'pdf' || src === 'peeled') return src;
  return 'pdf';
}

function tagMapKey(rawText: string, bbox: number[]): string {
  return `${rawText.trim()}:${bbox.map((v) => Math.round(v)).join(',')}`;
}

function upsertTag(
  map: Map<string, ParsedTagNote>,
  entry: ParsedTagNote,
): void {
  const key = tagMapKey(entry.rawText, entry.bbox);
  const existing = map.get(key);
  if (!existing) {
    map.set(key, entry);
    return;
  }
  map.set(key, {
    ...existing,
    usedForCheck: existing.usedForCheck || entry.usedForCheck,
    checkIndex: entry.checkIndex ?? existing.checkIndex,
    rejectedReason: entry.rejectedReason ?? existing.rejectedReason,
    reportStatus: entry.reportStatus ?? existing.reportStatus,
    view: entry.view ?? existing.view,
    source: entry.source !== 'unknown' ? entry.source : existing.source,
  });
}

function addFromBbox(
  map: Map<string, ParsedTagNote>,
  params: {
    rawText: string;
    quantity: number;
    face: string | null;
    bboxPx: number[];
    source: ParsedTagNote['source'];
    usedForCheck: boolean;
    checkIndex?: number;
    rejectedReason?: string | null;
    reportStatus?: string;
    view?: string;
  },
): void {
  if (params.bboxPx.length < 4) return;
  const { bbox, center } = resolveOverlayBbox(params.bboxPx);
  upsertTag(map, {
    rawText: params.rawText.trim(),
    quantity: params.quantity,
    face: params.face,
    bbox,
    center,
    source: params.source,
    usedForCheck: params.usedForCheck,
    checkIndex: params.checkIndex,
    rejectedReason: params.rejectedReason,
    reportStatus: params.reportStatus,
    view: params.view,
  });
}

export function parseTagNotesFromComponent(comp: ComponentResultWithTags): ParsedTagNotes {
  const notes = comp.notes ?? [];
  const reports = comp.report ?? [];
  const tagMap = new Map<string, ParsedTagNote>();

  let tagSelection: TagSelectionMetaLike | null = null;
  for (const entry of reports) {
    if (entry.tag_selection) tagSelection = entry.tag_selection;
  }

  let checkIndex = 0;
  for (const report of groutCheckReports(reports)) {
    if (report.expected?.view === 'REINFORCEMENT PLAN') continue;
    const raw = (report.note_raw_text ?? '').trim();
    if (!raw) continue;

    const note = findNoteForReport(raw, notes, report.matched_cluster);
    if (!note) continue;

    const drawBbox = resolveDrawBbox(note, report.matched_cluster);
    if (drawBbox.length < 4) continue;

    checkIndex += 1;
    addFromBbox(tagMap, {
      rawText: note.raw_text,
      quantity: note.quantity ?? 0,
      face: note.face ?? null,
      bboxPx: drawBbox,
      source: resolveTagSource(note.raw_text, tagSelection),
      usedForCheck: true,
      checkIndex,
      reportStatus: report.status,
      view: report.expected?.view,
    });
  }

  for (const report of reports) {
    const selection = report.tag_selection;
    if (!selection?.candidates?.length) continue;

    for (const candidate of selection.candidates) {
      const raw = (candidate.raw_text ?? '').trim();
      if (!raw || !isAuthoritativeGroutQtyTag(raw)) continue;

      let bboxPx = candidate.bbox_px ?? [];
      let quantity = candidate.quantity ?? 0;
      let face: string | null = null;

      if (bboxPx.length < 4) {
        const matched = notes.find((n) => normalizeTagRaw(n.raw_text) === normalizeTagRaw(raw));
        if (matched?.bbox_px?.length === 4) {
          bboxPx = matched.bbox_px;
          quantity = matched.quantity ?? quantity;
          face = matched.face ?? null;
        }
      } else {
        const matched = notes.find(
          (n) =>
            normalizeTagRaw(n.raw_text) === normalizeTagRaw(raw)
            && n.bbox_px?.length === 4
            && n.bbox_px.every((v, i) => Math.abs(v - bboxPx[i]) < 3),
        );
        if (matched) {
          quantity = matched.quantity ?? quantity;
          face = matched.face ?? null;
        }
      }

      if (bboxPx.length < 4) continue;

      const isSelected =
        selection.selected_raw_text
        && normalizeTagRaw(raw) === normalizeTagRaw(selection.selected_raw_text);

      addFromBbox(tagMap, {
        rawText: raw,
        quantity,
        face,
        bboxPx,
        source: isSelected ? resolveTagSource(raw, selection) : 'unknown',
        usedForCheck: isSelected,
        rejectedReason: candidate.rejected_reason ?? null,
        reportStatus: candidate.rejected_reason ? 'REJECTED' : undefined,
        view: report.expected?.view ?? 'PLAN AS CAST',
      });
    }
  }

  return { tags: [...tagMap.values()] };
}

export function parseTagNotesFromComponents(
  components: ComponentResultWithTags[],
): ParsedTagNotes | null {
  const all: ParsedTagNote[] = [];
  for (const comp of components) {
    all.push(...parseTagNotesFromComponent(comp).tags);
  }
  return all.length > 0 ? { tags: all } : null;
}

export function parseTagNotesFromAnalysis(
  analysis: { component_results?: ComponentResultWithTags[] } | null | undefined,
): ParsedTagNotes | null {
  if (!analysis?.component_results?.length) return null;
  return parseTagNotesFromComponents(analysis.component_results);
}

export function parseTagNotesFromReport(content: string | null | undefined): ParsedTagNotes | null {
  if (!content) return null;
  try {
    const data = JSON.parse(content) as unknown;
    return parseTagNotesFromComponents(extractReportComponents(data) as ComponentResultWithTags[]);
  } catch {
    return null;
  }
}

export function hasTagNotesData(data: ParsedTagNotes | null | undefined): boolean {
  return (data?.tags.length ?? 0) > 0;
}
