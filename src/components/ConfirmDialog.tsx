import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

export type ConfirmDialogOption = {
  id: string;
  label: string;
  description?: string;
  defaultChecked?: boolean;
  disabled?: boolean;
};

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'info';
  loading?: boolean;
  progressText?: string;
  options?: ConfirmDialogOption[];
  onConfirm: (optionValues?: Record<string, boolean>) => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Delete',
  cancelLabel = 'Cancel',
  variant = 'danger',
  loading = false,
  progressText,
  options,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const [optionValues, setOptionValues] = React.useState<Record<string, boolean>>({});

  React.useEffect(() => {
    if (!open) return;
    const defaults: Record<string, boolean> = {};
    for (const opt of options ?? []) {
      defaults[opt.id] = opt.defaultChecked ?? false;
    }
    setOptionValues(defaults);
  }, [open, options]);

  if (!open) return null;

  const variantStyles = {
    danger: {
      icon: 'text-[#ef4444]',
      iconBg: 'bg-[#ef4444]/10',
      button: 'bg-[#ef4444] hover:bg-[#dc2626]',
    },
    warning: {
      icon: 'text-[#f59e0b]',
      iconBg: 'bg-[#f59e0b]/10',
      button: 'bg-[#f59e0b] hover:bg-[#d97706]',
    },
    info: {
      icon: 'text-[#3b82f6]',
      iconBg: 'bg-[#3b82f6]/10',
      button: 'bg-[#3b82f6] hover:bg-[#2563eb]',
    },
  };

  const styles = variantStyles[variant];
  const hasOptions = (options?.length ?? 0) > 0;
  const anyActionSelected = !hasOptions
    || Object.values(optionValues).some(Boolean);

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={loading ? undefined : onCancel}>
      <div
        className="bg-[#252526] border border-[#3c3c3c] rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-4 p-6 pb-4">
          <div className={`p-2.5 rounded-full ${styles.iconBg} shrink-0`}>
            <AlertTriangle className={`w-5 h-5 ${styles.icon}`} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-semibold text-white mb-1">{title}</h3>
            <p className="text-sm text-[#858585] leading-relaxed">{description}</p>
            {hasOptions && (
              <div className="mt-4 rounded-lg border border-[#3c3c3c] bg-[#1a1b20] p-3 space-y-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-[#858585]">Options</p>
                {options!.map((opt) => (
                  <label
                    key={opt.id}
                    className={`flex items-start gap-2.5 ${opt.disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                  >
                    <input
                      type="checkbox"
                      checked={optionValues[opt.id] ?? false}
                      disabled={loading || opt.disabled}
                      onChange={(e) => {
                        setOptionValues((prev) => ({ ...prev, [opt.id]: e.target.checked }));
                      }}
                      className="mt-0.5 rounded border-[#555] bg-[#1e1e1e] text-[#ef4444] focus:ring-[#ef4444]/40"
                    />
                    <span className="min-w-0">
                      <span className="block text-sm text-[#e8e8e8]">{opt.label}</span>
                      {opt.description && (
                        <span className="block text-xs text-[#858585] mt-0.5 leading-snug">{opt.description}</span>
                      )}
                    </span>
                  </label>
                ))}
              </div>
            )}
            {loading && (
              <p className="text-xs text-[#f59e0b] mt-2 animate-pulse">{progressText || 'Please wait while processing completes...'}</p>
            )}
          </div>
          <button onClick={onCancel} disabled={loading} className="p-1 hover:bg-[#3c3c3c] rounded transition-colors text-[#858585] hover:text-white shrink-0 disabled:opacity-30 disabled:pointer-events-none">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[#3c3c3c] bg-[#1e1e1e]">
          <button
            onClick={onCancel}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium rounded-md bg-[#3c3c3c] hover:bg-[#4a4a4a] text-white transition-colors disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            onClick={() => onConfirm(hasOptions ? optionValues : undefined)}
            disabled={loading || !anyActionSelected}
            className={`px-4 py-2 text-sm font-medium rounded-md text-white transition-colors disabled:opacity-50 flex items-center gap-2 ${styles.button}`}
          >
            {loading && <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
