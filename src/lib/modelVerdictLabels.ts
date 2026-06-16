export type ModelVerdictLabel = 'recommended' | 'ok' | 'caution' | 'poor';

export const MODEL_VERDICT_TEXT: Record<ModelVerdictLabel, string> = {
  recommended: 'Recommended',
  ok: 'Good',
  caution: 'Review',
  poor: 'Poor',
};

export const MODEL_VERDICT_BADGE_CLASS: Record<ModelVerdictLabel, string> = {
  recommended: 'bg-[#10b981]/15 text-[#34d399] border-[#10b981]/30',
  ok: 'bg-[#60a5fa]/15 text-[#93c5fd] border-[#2563eb]/30',
  caution: 'bg-[#f59e0b]/15 text-[#fbbf24] border-[#f59e0b]/30',
  poor: 'bg-[#ef4444]/15 text-[#f87171] border-[#ef4444]/30',
};

/** Left accent + subtle fill for model picker rows (matches Model Lab card tints). */
export const MODEL_VERDICT_ROW_ACCENT: Record<ModelVerdictLabel, string> = {
  recommended: 'border-l-[#10b981] bg-[#10b981]/5',
  ok: 'border-l-[#2563eb] bg-[#2563eb]/5',
  caution: 'border-l-[#f59e0b] bg-[#f59e0b]/5',
  poor: 'border-l-[#ef4444] bg-[#ef4444]/5',
};

export const MODEL_VERDICT_TRIGGER_BORDER: Record<ModelVerdictLabel, string> = {
  recommended: 'border-[#10b981]/40',
  ok: 'border-[#2563eb]/40',
  caution: 'border-[#f59e0b]/40',
  poor: 'border-[#ef4444]/40',
};

export function modelVerdictDisplayLabel(label?: string | null): string | null {
  if (!label) return null;
  return MODEL_VERDICT_TEXT[label as ModelVerdictLabel] ?? null;
}

export function formatModelWeightsOptionLabel(opts: {
  filename: string;
  sizeMb: number;
  isDefault?: boolean;
  verdictLabel?: string | null;
}): string {
  const tags: string[] = [`${opts.sizeMb.toFixed(1)} MB`];
  const verdict = modelVerdictDisplayLabel(opts.verdictLabel);
  if (verdict) tags.push(verdict);
  if (opts.isDefault) tags.push('default.yaml');
  return `${opts.filename} (${tags.join(' · ')})`;
}
