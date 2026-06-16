import { useEffect, useRef, useState } from 'react';
import { cn } from '../lib/utils';
import {
  MODEL_VERDICT_ROW_ACCENT,
  MODEL_VERDICT_TRIGGER_BORDER,
  type ModelVerdictLabel,
} from '../lib/modelVerdictLabels';
import type { ComponentModelOption } from '../types';
import { ModelVerdictBadge } from './model-lab/ModelVerdictBadge';

function verdictAccent(label?: string | null): string {
  if (!label) return 'border-l-transparent';
  return MODEL_VERDICT_ROW_ACCENT[label as ModelVerdictLabel] ?? 'border-l-transparent';
}

function verdictTriggerBorder(label?: string | null, open?: boolean): string {
  if (open) return 'border-[#10b981]';
  if (!label) return 'border-[#3c3c3c]';
  return MODEL_VERDICT_TRIGGER_BORDER[label as ModelVerdictLabel] ?? 'border-[#3c3c3c]';
}

export function ModelWeightsPicker({
  id,
  models,
  value,
  disabled,
  onChange,
}: {
  id: string;
  models: ComponentModelOption[];
  value: string;
  disabled?: boolean;
  onChange: (filename: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const selected = models.find((m) => m.filename === value);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        id={id}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => !disabled && setOpen((v) => !v)}
        className={cn(
          'w-full flex items-center gap-2 bg-[#252526] border rounded px-2 py-1.5 text-left transition-colors',
          'hover:bg-[#2a2a2b] focus:outline-none focus:ring-1 focus:ring-[#10b981]/50',
          verdictTriggerBorder(selected?.verdictLabel, open),
          disabled && 'opacity-50 cursor-not-allowed',
        )}
      >
        <span className="flex-1 min-w-0 font-mono text-[11px] text-white truncate">
          {selected?.filename ?? 'Select model…'}
        </span>
        {selected?.verdictLabel && <ModelVerdictBadge label={selected.verdictLabel} size="sm" />}
        {selected?.isDefault && (
          <span className="text-[9px] uppercase text-[#fbbf24] border border-[#f59e0b]/30 px-1 rounded shrink-0">
            default.yaml
          </span>
        )}
        <span className="text-[#737373] text-[10px] shrink-0">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <ul
          role="listbox"
          aria-labelledby={id}
          className="absolute z-[200] mt-1 w-full max-h-56 overflow-y-auto rounded border border-[#3c3c3c] bg-[#1e1e1e] shadow-2xl py-1"
        >
          {models.map((m) => {
            const isSelected = m.filename === value;
            return (
              <li key={m.filename} role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => {
                    onChange(m.filename);
                    setOpen(false);
                  }}
                  className={cn(
                    'w-full px-2 py-2 flex flex-col gap-1 text-left border-l-[3px] transition-colors',
                    'hover:bg-[#252526]',
                    isSelected ? 'bg-[#252526]/90' : '',
                    verdictAccent(m.verdictLabel),
                  )}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="flex-1 font-mono text-[11px] text-white truncate">{m.filename}</span>
                    {m.verdictLabel ? (
                      <ModelVerdictBadge label={m.verdictLabel} size="sm" />
                    ) : null}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-[#737373]">
                    <span>{m.sizeMb.toFixed(1)} MB</span>
                    {m.map50_95 != null && <span>mAP {(m.map50_95 * 100).toFixed(1)}%</span>}
                    {m.verdictRank != null && <span>rank #{m.verdictRank}</span>}
                    {m.isDefault && <span className="text-[#fbbf24]">default.yaml</span>}
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
