# Agent Guide — element-iq-ui

**Read first:** [../AGENTS.md](../AGENTS.md) — monorepo architecture, §5.1 Titles + view split, §5.2 vertical tag OCR.

React + Vite SPA. Presentation only — **no PDF parsing** for analysis; overlays read `report.json` / `component_results` from API.

## Dev

```bash
pnpm dev          # Vite dev server (proxy /api → local API)
pnpm build        # production bundle → nginx in Docker
```

Local stack: UI on Vite + API `uvicorn app.main:app --reload --port 8001` (or Docker :3080).

## Editor overlays (MainEditor)

| Toggle | State key | Components |
|--------|-----------|------------|
| QA Overlay | `showAnnotations` | Detection boxes from YOLO |
| View Split | `showViewSplitOverlay` | `ViewSplitOverlay.tsx` — panel shade + **split line** |
| Titles | `showTitleOverlay` | `TitleOverlay.tsx` — title bbox + anchors + `mid_title` |

All overlays share `unitScale` from viewer (PDF 72/300, PNG 1).

## View split coordinates (`viewSplit.ts`)

- **`boundaryX`** = display `mid_title` from `view_labels` (not raw `mid_x` when titles rotated)
- Client fallback: `resolveDisplayMidTitleFromViewLabels()` swaps cx/cy when `display_center` missing (old reports)
- Footer shows both `mid_title` and `mid_x` for operator comparison
- Tube chips: PLAN left / REINF right of `boundaryX`; orange = `view_confidence < 0.75` (VIEW-AMBIGUOUS)

## Titles overlay (`viewTitles.ts`, `TitleOverlay.tsx`)

- Bbox from `display_bbox_px` or client-computed from `bbox_px` + swap
- Crosshair + vertical line at display `cx` per title
- **`mid_title`** line: 50% sheet height, dashed purple (2px)
- Chips **below** bbox with `(cx, cy)` display coords
- Origin `(0,0)` marker when enabled (offset below View Split chips)

Hook: `use-view-titles.ts` — derives labels from active component result.

## Branding

- Engine name: **ElementIQ Engine** (`src/lib/engineBranding.ts`)
- Never show YOLO / OCR / EasyOCR in user-facing copy
- Analysis log highlights: `src/lib/analysisLogHighlight.tsx`

## Qty tags in UI

- `component_results[].notes` populated by API after OCR — UI does not run EasyOCR
- `MISSING-TAG` with vision count OK → operator re-analyze after core `ocr_tags.py` fix (see AGENTS §5.2)

## Do not

- Duplicate `parse_view_labels` or anchor swap logic beyond thin client fallback for legacy JSON
- Change overlay split line to raw `mid_x` without aligning with core `view_label_anchor_x` semantics
- Parse uploaded PDFs in browser for validation counts
