/** Parse sidebar row numbers: `1,2,3`, `1-10`, `from 1 to 10`, `1 to 5`. */
export function parseSelectionRangeInput(
  input: string,
  maxIndex: number,
): { indices: number[]; error?: string } {
  const trimmed = input.trim();
  if (!trimmed) return { indices: [] };

  const indices = new Set<number>();
  const normalized = trimmed
    .toLowerCase()
    .replace(/\bfrom\s+/g, '')
    .replace(/\s+to\s+/g, '-');

  const parts = normalized.split(/[,;]+/).map((p) => p.trim()).filter(Boolean);

  for (const part of parts) {
    const rangeMatch = part.match(/^(\d+)\s*[-–]\s*(\d+)$/);
    if (rangeMatch) {
      const start = Number.parseInt(rangeMatch[1], 10);
      const end = Number.parseInt(rangeMatch[2], 10);
      if (start > end) {
        return { indices: [], error: `Invalid range: ${part}` };
      }
      for (let i = start; i <= end; i += 1) {
        if (i >= 1 && i <= maxIndex) indices.add(i);
      }
      continue;
    }

    const single = part.match(/^(\d+)$/);
    if (single) {
      const n = Number.parseInt(single[1], 10);
      if (n >= 1 && n <= maxIndex) indices.add(n);
      continue;
    }

    return { indices: [], error: `Could not parse "${part}"` };
  }

  return { indices: [...indices].sort((a, b) => a - b) };
}

export function fileIdsForSelectionIndices(
  displayedFiles: Array<{ id: string; status: string }>,
  indices: number[],
): { ids: string[]; skippedBusy: number[]; outOfRange: number[] } {
  const ids: string[] = [];
  const skippedBusy: number[] = [];
  const outOfRange: number[] = [];

  for (const idx of indices) {
    const file = displayedFiles[idx - 1];
    if (!file) {
      outOfRange.push(idx);
      continue;
    }
    if (file.status === 'ANALYZING' || file.status === 'UPLOADING') {
      skippedBusy.push(idx);
      continue;
    }
    ids.push(file.id);
  }

  return { ids, skippedBusy, outOfRange };
}
