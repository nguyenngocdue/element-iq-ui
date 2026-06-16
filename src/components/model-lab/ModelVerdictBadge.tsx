import { cn } from '../../lib/utils';
import {
  MODEL_VERDICT_BADGE_CLASS,
  modelVerdictDisplayLabel,
  type ModelVerdictLabel,
} from '../../lib/modelVerdictLabels';

export function ModelVerdictBadge({
  label,
  size = 'md',
  className,
}: {
  label?: string | null;
  size?: 'sm' | 'md';
  className?: string;
}) {
  const text = modelVerdictDisplayLabel(label);
  if (!text || !label) return null;
  const key = label as ModelVerdictLabel;

  return (
    <span
      className={cn(
        'inline-flex rounded font-medium border uppercase tracking-wide shrink-0',
        size === 'sm' ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-[11px]',
        MODEL_VERDICT_BADGE_CLASS[key] ?? 'bg-[#737373]/15 text-[#a3a3a3] border-[#525252]',
        className,
      )}
    >
      {text}
    </span>
  );
}
