import React from 'react';
import { FolderX, RefreshCw, ArrowLeft } from 'lucide-react';

export type ProjectAccessErrorKind = 'not_found' | 'error';

interface ProjectAccessErrorProps {
  kind: ProjectAccessErrorKind;
  onRetry?: () => void;
  onBack: () => void;
  retrying?: boolean;
}

const COPY: Record<ProjectAccessErrorKind, { title: string; description: string }> = {
  not_found: {
    title: 'Project not found',
    description:
      'This project may have been deleted, or you may not have permission to view it. Check the link or return to your workspace.',
  },
  error: {
    title: 'Unable to open this project',
    description:
      'We could not load this project after several attempts. This is usually temporary — check your connection and try again.',
  },
};

export function ProjectAccessError({ kind, onRetry, onBack, retrying = false }: ProjectAccessErrorProps) {
  const { title, description } = COPY[kind];

  return (
    <div className="min-h-screen bg-[#0f1117] flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-white tracking-tight">Element IQ</h1>
          <p className="text-[#858585] mt-1.5 text-sm">Drawing quality assurance</p>
        </div>

        <div className="bg-[#1e1e1e] border border-[#3c3c3c] rounded-xl p-8 shadow-2xl">
          <div className="flex flex-col items-center text-center">
            <div className="p-3.5 rounded-full bg-[#ef4444]/10 mb-5">
              <FolderX className="w-7 h-7 text-[#ef4444]" strokeWidth={1.75} />
            </div>

            <h2 className="text-lg font-semibold text-white mb-2">{title}</h2>
            <p className="text-sm text-[#a0a5b5] leading-relaxed max-w-sm">{description}</p>
          </div>

          <div className="mt-8 flex flex-col sm:flex-row-reverse sm:justify-center items-stretch sm:items-center sm:gap-3">
            <button
              type="button"
              onClick={onBack}
              className="inline-flex items-center justify-center px-5 py-2.5 rounded-lg bg-[#10b981] hover:bg-[#059669] text-white text-sm font-semibold transition-colors"
            >
              Back to dashboard
            </button>
            {onRetry && kind === 'error' && (
              <button
                type="button"
                onClick={onRetry}
                disabled={retrying}
                className="inline-flex items-center justify-center px-5 py-2.5 rounded-lg border border-[#3c3c3c] bg-[#252526] hover:bg-[#2d2d30] text-[#cccccc] text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed mt-3 sm:mt-0"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${retrying ? 'animate-spin' : ''}`} />
                {retrying ? 'Retrying…' : 'Try again' }
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={onBack}
            className="mt-4 w-full inline-flex items-center justify-center text-xs text-[#858585] hover:text-[#cccccc] transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5 mr-1.5" />
            Return to workspace
          </button>
        </div>
      </div>
    </div>
  );
}

interface ProjectReconnectingProps {
  attempt: number;
  maxAttempts: number;
}

export function ProjectReconnecting({ attempt, maxAttempts }: ProjectReconnectingProps) {
  const progress = Math.min(1, attempt / maxAttempts);

  return (
    <div className="min-h-screen bg-[#0f1117] flex items-center justify-center p-6">
      <div className="w-full max-w-[280px] flex flex-col items-center">
        <div className="relative w-12 h-12">
          <div className="absolute inset-0 border-2 border-[#10b981]/20 rounded-full" />
          <div className="absolute inset-0 border-2 border-[#10b981] border-t-transparent rounded-full animate-spin" />
        </div>

        <div className="mt-8 w-full text-center">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#5a5a5a]">
            Connection
          </p>
          <h2 className="mt-2 text-[17px] font-semibold text-[#ececec] tracking-[-0.015em] leading-snug">
            Reconnecting…
          </h2>
          <p className="mt-1.5 text-[13px] text-[#6b6b6b] leading-relaxed">
            Waiting for the server to respond
          </p>
        </div>

        <div className="mt-7 w-full h-1 bg-[#2a2a2a] rounded-full overflow-hidden">
          <div
            className="h-full rounded-full bg-[#10b981]/70 transition-[width] duration-700 ease-out"
            style={{ width: `${progress * 100}%` }}
          />
        </div>
      </div>
    </div>
  );
}
