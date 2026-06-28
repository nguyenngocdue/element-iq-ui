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

  draw_bbox_px?: number[] | null;

  anchor_xy?: number[] | null;

  draw_bbox_source?: string | null;

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



export type TagBboxKind = 'check' | 'raw' | 'anchor' | 'candidate' | 'parsed';



export type ParsedTagNote = {

  rawText: string;

  quantity: number;

  face: string | null;

  bbox: [number, number, number, number];

  center: [number, number];

  source: 'ocr' | 'pdf' | 'peeled' | 'unknown';

  bboxKind: TagBboxKind;

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



const QTY_TAG_RE = /^\s*(\d+)\s*\/\s*([TB]\d+)(?:\s*-\s*(NF|FF))?(?:\s+\d+)?\s*$/i;

const QTY_PT_RE = /^\s*\d+\s*\/\s*P(?:T|TI)\d+/i;

const CODE_POSITION_RE = /^[TB]\d+$/i;



function isAuthoritativeGroutQtyTag(raw: string, position?: string | null): boolean {

  const text = raw.trim().toUpperCase().replace(/\s+/g, ' ');

  if (QTY_PT_RE.test(text)) return false;

  if (/GROUT\s+TUBES?/.test(text)) return true;

  if (QTY_TAG_RE.test(text)) return true;

  if (position && CODE_POSITION_RE.test(position.trim().toUpperCase())) return true;

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



function tightenTagBbox(bbox: number[], maxW = 140, maxH = 180): number[] {

  if (bbox.length < 4) return bbox;

  let [x1, y1, x2, y2] = bbox;

  const w = x2 - x1;

  const h = y2 - y1;

  if (w <= maxW && h <= maxH) return bbox.map((v) => Math.round(v));

  const cx = (x1 + x2) / 2;

  const cy = (y1 + y2) / 2;

  if (w > maxW) {

    x1 = cx - maxW / 2;

    x2 = cx + maxW / 2;

  }

  if (h > maxH) {

    y1 = cy - maxH / 2;

    y2 = cy + maxH / 2;

  }

  return [Math.round(x1), Math.round(y1), Math.round(x2), Math.round(y2)];

}



function noteBboxIsVertical(bbox: number[]): boolean {

  const [x1, y1, x2, y2] = bbox;

  const w = x2 - x1;

  const h = y2 - y1;

  return h > w * 1.15;

}



/** Mirrors core ``note_display_center`` — swap PDF axes for rotated landscape sheets. */

function noteDisplayCenter(bbox: number[]): [number, number] {

  const cx = (bbox[0] + bbox[2]) / 2;

  const cy = (bbox[1] + bbox[3]) / 2;

  return [cy, cx];

}



/** Mirrors ``tag_anchor.note_anchor_xy`` (simplified for overlay). */

function noteAnchorXy(

  bbox: number[],

  cluster?: MatchedClusterLike | null,

): [number, number] | null {

  if (bbox.length < 4) return null;

  const [x1, y1, x2, y2] = bbox;

  const cx = (x1 + x2) / 2;



  if (noteBboxIsVertical(bbox)) {

    const cb = cluster?.bbox;

    if (cb && cb.length >= 4) {

      const cxCl = (cb[0] + cb[2]) / 2;

      const stripCx = (x1 + x2) / 2;

      const ax = cxCl > stripCx ? x2 : x1;

      const rowY = cb[3];

      const ay = Math.max(y1, Math.min(y2, rowY));

      return [ax, ay];

    }

    return [x2, y2];

  }



  let px = cx;

  let py = y2;

  const cb = cluster?.bbox;

  if (cb && cb.length >= 4) {

    const y1c = cb[1];

    const y2c = cb[3];

    if (py < y1c - 180) {

      const [dcx, dcy] = noteDisplayCenter(bbox);

      if (y1c - 180 <= dcy && dcy <= y2c + 1200) {

        return [dcx, dcy];

      }

    }

  }

  return [px, py];

}



function rawNoteNearClusterBBox(note: TagNoteLike, cluster?: MatchedClusterLike | null): boolean {

  const bb = note.bbox_px;

  const cb = cluster?.bbox;

  if (!bb || bb.length < 4 || !cb || cb.length < 4) return false;

  const anchor = noteAnchorXy(bb, cluster) ?? tagCenter(bb);

  const [px, py] = anchor;

  const [x1, y1, x2, y2] = cb;

  if (py < y1 - 180) return false;

  if (y2 + 15 <= py && py <= y2 + 1200) {

    if (x1 - 520 <= px && px <= x2 + 520) return true;

  }

  if (x1 - 520 <= px && px <= x1 + 100 && y1 - 100 <= py && py <= y2 + 1200) return true;

  if (noteBboxIsVertical(bb)) {

    if (Math.abs(px - x2) <= 520 && y1 - 180 <= py && py <= y2 + 420) return true;

    if (Math.abs(px - x1) <= 520 && y1 - 180 <= py && py <= y2 + 420) return true;

  }

  if (Math.abs(py - y2) > 280) return false;

  if (px > x2 + 120) return false;

  return true;

}



function tagCoordsMisaligned(note: TagNoteLike, cluster?: MatchedClusterLike | null): boolean {

  const bb = note.bbox_px;

  const cb = cluster?.bbox;

  if (!bb || bb.length < 4 || !cb || cb.length < 4) return false;

  const w = bb[2] - bb[0];

  const h = bb[3] - bb[1];

  const anchor = noteAnchorXy(bb, cluster) ?? tagCenter(bb);

  const [px, py] = anchor;

  const misalignedX = px > cb[2] + 80 || px < cb[0] - 900;

  const aboveRow = py < cb[1] - 120;

  const belowRow = py > cb[3] + 250;

  const oversized = w > 220 || h > 220;

  const ghostBesideRow = h > w * 1.15 && cb[1] - 120 <= py && py <= cb[3] + 50 && misalignedX;

  return misalignedX || aboveRow || belowRow || oversized || ghostBesideRow;

}



function estimatedCalloutBbox(cluster: MatchedClusterLike): number[] | null {

  const bb = cluster.bbox;

  if (!bb || bb.length < 4) return null;

  const [x1, , , y2] = bb;

  return [Math.max(0, x1 - 95), y2 - 120, Math.max(0, x1 - 8), y2 + 12];

}



function anchorHighlightBbox(

  note: TagNoteLike,

  cluster?: MatchedClusterLike | null,

): number[] | null {

  const bb = note.bbox_px;

  if (!bb || bb.length < 4) return null;

  const anchor = noteAnchorXy(bb, cluster);

  if (!anchor) return null;

  const [px, py] = anchor;

  const cb = cluster?.bbox;

  if (noteBboxIsVertical(bb)) {

    const halfH = Math.min(150, Math.max(45, (bb[3] - bb[1]) / 2));

    const stripW = Math.max(36, Math.min(58, bb[2] - bb[0] + 14));

    const edgeX = Math.round(px);

    if (cb && cb.length >= 4 && px <= (cb[0] + cb[2]) / 2) {

      return [edgeX, Math.round(py - halfH), edgeX + stripW, Math.round(py + halfH)];

    }

    return [Math.max(0, edgeX - stripW), Math.round(py - halfH), edgeX, Math.round(py + halfH)];

  }

  return [Math.round(px - 72), Math.round(py - 20), Math.round(px + 72), Math.round(py + 20)];

}



function bboxesDiffer(a: number[], b: number[], tol = 24): boolean {

  if (a.length < 4 || b.length < 4) return true;

  return a.some((v, i) => Math.abs(v - b[i]) > tol);

}



function resolveOverlayBbox(bbox: number[]): {

  bbox: [number, number, number, number];

  center: [number, number];

} {

  const padded = padBbox(bbox);

  return { bbox: padded, center: tagCenter(padded) };

}



/** Mirrors validator ``_tag_draw_bbox``. */

function resolveDrawBbox(note: TagNoteLike, cluster?: MatchedClusterLike | null): number[] {

  const bb = note.bbox_px;

  if (!bb || bb.length < 4) return [];

  if (!cluster?.bbox || cluster.bbox.length < 4) return tightenTagBbox(bb);



  if (tagCoordsMisaligned(note, cluster)) {
    const anchor = noteAnchorXy(bb, cluster);
    const cb = cluster.bbox;
    const anchorBox = anchorHighlightBbox(note, cluster);
    if (
      anchorBox
      && anchor
      && cb[1] - 120 <= anchor[1]
      && anchor[1] <= cb[3] + 250
    ) {
      return anchorBox;
    }
    return estimatedCalloutBbox(cluster) ?? tightenTagBbox(bb);
  }

  return tightenTagBbox(bb);

}



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

    const nc = noteAnchorXy(note.bbox_px, cluster) ?? tagCenter(note.bbox_px);

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



function tagMapKey(rawText: string, bbox: number[], kind: TagBboxKind): string {

  return `${kind}:${rawText.trim()}:${bbox.map((v) => Math.round(v)).join(',')}`;

}



function upsertTag(map: Map<string, ParsedTagNote>, entry: ParsedTagNote): void {

  const key = tagMapKey(entry.rawText, entry.bbox, entry.bboxKind);

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

    bboxKind: TagBboxKind;

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

    bboxKind: params.bboxKind,

    source: params.source,

    usedForCheck: params.usedForCheck,

    checkIndex: params.checkIndex,

    rejectedReason: params.rejectedReason,

    reportStatus: params.reportStatus,

    view: params.view,

  });

}



function addRawAndAnchorBoxes(

  map: Map<string, ParsedTagNote>,

  note: TagNoteLike,

  cluster: MatchedClusterLike | null | undefined,

  drawBbox: number[],

  meta: {

    source: ParsedTagNote['source'];

    usedForCheck: boolean;

    checkIndex?: number;

    reportStatus?: string;

    view?: string;

  },

): void {

  const raw = (note.raw_text ?? '').trim();

  const rawBbox = note.bbox_px;

  if (!rawBbox || rawBbox.length < 4) return;



  if (bboxesDiffer(rawBbox, drawBbox)) {

    addFromBbox(map, {

      rawText: raw,

      quantity: note.quantity ?? 0,

      face: note.face ?? null,

      bboxPx: rawBbox,

      bboxKind: 'raw',

      source: meta.source,

      usedForCheck: false,

      view: meta.view,

    });

  }



  const anchorBox = anchorHighlightBbox(note, cluster);

  if (anchorBox && bboxesDiffer(anchorBox, drawBbox) && bboxesDiffer(anchorBox, rawBbox)) {

    addFromBbox(map, {

      rawText: raw,

      quantity: note.quantity ?? 0,

      face: note.face ?? null,

      bboxPx: anchorBox,

      bboxKind: 'anchor',

      source: meta.source,

      usedForCheck: false,

      view: meta.view,

    });

  }

}



export function parseTagNotesFromComponent(comp: ComponentResultWithTags): ParsedTagNotes {

  const notes = comp.notes ?? [];

  const reports = comp.report ?? [];

  const tagMap = new Map<string, ParsedTagNote>();

  const seenNoteKeys = new Set<string>();



  let tagSelection: TagSelectionMetaLike | null = null;

  for (const entry of reports) {

    if (entry.tag_selection) tagSelection = entry.tag_selection;

  }



  const defaultCluster = reports.find((r) => r.matched_cluster?.bbox)?.matched_cluster ?? null;



  let checkIndex = 0;

  for (const report of groutCheckReports(reports)) {

    if (report.expected?.view === 'REINFORCEMENT PLAN') continue;

    const raw = (report.note_raw_text ?? '').trim();

    if (!raw) continue;



    const note = findNoteForReport(raw, notes, report.matched_cluster);

    if (!note) continue;



    const persistedDraw = report.tag_selection?.draw_bbox_px;

    const drawBbox =

      persistedDraw && persistedDraw.length === 4

        ? persistedDraw

        : resolveDrawBbox(note, report.matched_cluster);

    if (drawBbox.length < 4) continue;



    checkIndex += 1;

    const meta = {

      source: resolveTagSource(note.raw_text, tagSelection),

      usedForCheck: true,

      checkIndex,

      reportStatus: report.status,

      view: report.expected?.view,

    };



    addFromBbox(tagMap, {

      rawText: note.raw_text,

      quantity: note.quantity ?? 0,

      face: note.face ?? null,

      bboxPx: drawBbox,

      bboxKind: 'check',

      ...meta,

    });

    addRawAndAnchorBoxes(tagMap, note, report.matched_cluster, drawBbox, meta);

    seenNoteKeys.add(`${note.raw_text}:${(note.bbox_px ?? []).join(',')}`);

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



      if (isSelected) continue;



      const drawBbox = resolveDrawBbox({ raw_text: raw, bbox_px: bboxPx }, report.matched_cluster);

      if (drawBbox.length < 4) continue;



      addFromBbox(tagMap, {

        rawText: raw,

        quantity,

        face,

        bboxPx: drawBbox,

        bboxKind: 'candidate',

        source: 'unknown',

        usedForCheck: false,

        rejectedReason: candidate.rejected_reason ?? null,

        reportStatus: candidate.rejected_reason ? 'REJECTED' : undefined,

        view: report.expected?.view ?? 'PLAN AS CAST',

      });

      addRawAndAnchorBoxes(

        tagMap,

        { raw_text: raw, bbox_px: bboxPx, quantity, face },

        report.matched_cluster,

        drawBbox,

        { source: 'unknown', usedForCheck: false, view: report.expected?.view },

      );

    }

  }



  for (const note of notes) {

    const raw = (note.raw_text ?? '').trim();

    if (!raw || !isAuthoritativeGroutQtyTag(raw, note.position)) continue;

    const key = `${note.raw_text}:${(note.bbox_px ?? []).join(',')}`;

    if (seenNoteKeys.has(key)) continue;

    if (!note.bbox_px || note.bbox_px.length < 4) continue;



    const cluster = defaultCluster;

    const nearCluster = cluster ? rawNoteNearClusterBBox(note, cluster) : false;

    const drawBbox = resolveDrawBbox(note, cluster);



    addFromBbox(tagMap, {

      rawText: raw,

      quantity: note.quantity ?? 0,

      face: note.face ?? null,

      bboxPx: note.bbox_px,

      bboxKind: 'raw',

      source: 'pdf',

      usedForCheck: false,

      view: 'PLAN AS CAST',

    });



    if (nearCluster && bboxesDiffer(note.bbox_px, drawBbox)) {

      addFromBbox(tagMap, {

        rawText: raw,

        quantity: note.quantity ?? 0,

        face: note.face ?? null,

        bboxPx: drawBbox,

        bboxKind: 'parsed',

        source: 'pdf',

        usedForCheck: false,

        view: 'PLAN AS CAST',

      });

      addRawAndAnchorBoxes(tagMap, note, cluster, drawBbox, {

        source: 'pdf',

        usedForCheck: false,

        view: 'PLAN AS CAST',

      });

    }



    seenNoteKeys.add(key);

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


