/** Distinct accent colors for selected sidebar explorer rows (1-based index). */

export type ExplorerNodeColor = {
  accent: string;
  indexFg: string;
  indexBg: string;
};

export const EXPLORER_NODE_PALETTE: ExplorerNodeColor[] = [
  { accent: '#f59e0b', indexFg: '#fde68a', indexBg: '#78350f' },
  { accent: '#3b82f6', indexFg: '#bfdbfe', indexBg: '#1e3a5f' },
  { accent: '#10b981', indexFg: '#a7f3d0', indexBg: '#064e3b' },
  { accent: '#a855f7', indexFg: '#e9d5ff', indexBg: '#581c87' },
  { accent: '#ef4444', indexFg: '#fecaca', indexBg: '#7f1d1d' },
  { accent: '#06b6d4', indexFg: '#a5f3fc', indexBg: '#164e63' },
  { accent: '#ec4899', indexFg: '#fbcfe8', indexBg: '#831843' },
  { accent: '#84cc16', indexFg: '#d9f99d', indexBg: '#365314' },
  { accent: '#f97316', indexFg: '#fed7aa', indexBg: '#7c2d12' },
  { accent: '#6366f1', indexFg: '#c7d2fe', indexBg: '#312e81' },
  { accent: '#14b8a6', indexFg: '#99f6e4', indexBg: '#134e4a' },
  { accent: '#eab308', indexFg: '#fef08a', indexBg: '#713f12' },
];

export function explorerNodeColor(index: number): ExplorerNodeColor {
  return EXPLORER_NODE_PALETTE[(Math.max(1, index) - 1) % EXPLORER_NODE_PALETTE.length];
}

/** Row highlight when bulk-selected — one color per list index for easy tracking. */
export function explorerSelectedRowStyle(index: number): {
  accent: string;
  backgroundColor: string;
  borderLeftColor: string;
} {
  const c = explorerNodeColor(index);
  return {
    accent: c.accent,
    backgroundColor: `${c.indexBg}d9`,
    borderLeftColor: c.accent,
  };
}
