import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'info';
  loading?: boolean;
  progressText?: string;
  onConfirm: () => void;
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
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
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

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={loading ? undefined : onCancel}>
      <div
        className="bg-[#252526] border border-[#3c3c3c] rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start gap-4 p-6 pb-4">
          <div className={`p-2.5 rounded-full ${styles.iconBg} shrink-0`}>
            <AlertTriangle className={`w-5 h-5 ${styles.icon}`} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-semibold text-white mb-1">{title}</h3>
            <p className="text-sm text-[#858585] leading-relaxed">{description}</p>
            {loading && (
              <p className="text-xs text-[#f59e0b] mt-2 animate-pulse">{progressText || 'Please wait while processing completes...'}</p>
            )}
          </div>
          <button onClick={onCancel} disabled={loading} className="p-1 hover:bg-[#3c3c3c] rounded transition-colors text-[#858585] hover:text-white shrink-0 disabled:opacity-30 disabled:pointer-events-none">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[#3c3c3c] bg-[#1e1e1e]">
          <button
            onClick={onCancel}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium rounded-md bg-[#3c3c3c] hover:bg-[#4a4a4a] text-white transition-colors disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
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
