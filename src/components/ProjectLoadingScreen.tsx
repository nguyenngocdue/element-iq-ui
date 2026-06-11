import React from 'react';

interface ProjectLoadingScreenProps {
  /** Full editor chrome (App boot) vs content pane only (MainEditor). */
  mode?: 'full' | 'pane';
}

function LoadingIndicator() {
  return (
    <div className="relative flex flex-col items-center">
      <div className="relative w-10 h-10">
        <div className="absolute inset-0 border-2 border-[#10b981]/20 rounded-full" />
        <div className="absolute inset-0 border-2 border-[#10b981] border-t-transparent rounded-full animate-spin" />
      </div>

      <div className="mt-7 text-center">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#5a5a5a]">
          Workspace
        </p>
        <h2 className="mt-2 text-[16px] font-semibold text-[#ececec] tracking-[-0.015em] leading-snug">
          Loading project
        </h2>
        <p className="mt-1.5 text-[13px] text-[#6b6b6b] leading-relaxed max-w-[240px]">
          Preparing drawings and analysis workspace
        </p>
      </div>

      <div className="mt-6 w-52 h-1 bg-[#2a2a2a] rounded-full overflow-hidden">
        <div className="h-full w-1/3 rounded-full bg-[#10b981]/70 project-loading-bar" />
      </div>
    </div>
  );
}

function EditorChromeSkeleton({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col h-screen w-full overflow-hidden bg-editor-bg text-fg font-sans antialiased">
      <div className="h-[35px] border-b border-[#1e1e1e] bg-[#3c3c3c] flex items-center justify-between px-3 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="h-2.5 w-14 bg-[#525252]/80 rounded-sm" />
          <div className="h-2.5 w-28 bg-[#4a4a4a]/70 rounded-sm" />
        </div>
        <div className="flex items-center gap-2">
          <div className="h-2.5 w-10 bg-[#4a4a4a]/60 rounded-sm" />
          <div className="h-5 w-5 bg-[#525252]/70 rounded-full" />
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden min-h-0">
        <div className="w-[48px] bg-[#333333] border-r border-[#1e1e1e] shrink-0 flex flex-col items-center py-4 gap-5">
          {[0, 1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="w-[22px] h-[22px] bg-[#454545]/50 rounded"
              style={{ opacity: 1 - i * 0.12 }}
            />
          ))}
        </div>

        <div className="w-[240px] bg-[#252526] border-r border-[#1e1e1e] shrink-0 hidden md:flex flex-col">
          <div className="h-[35px] border-b border-[#1e1e1e] flex items-center px-3">
            <div className="h-2.5 w-20 bg-[#3a3a3a] rounded-sm" />
          </div>
          <div className="flex-1 p-3 space-y-2.5">
            {[88, 72, 94, 68, 80, 76].map((w, i) => (
              <div
                key={i}
                className="h-5 bg-[#2d2d30]/80 rounded"
                style={{ width: `${w}%` }}
              />
            ))}
          </div>
        </div>

        {children}
      </div>

      <div className="h-[22px] bg-[#10b981]/90 shrink-0 flex items-center px-3 gap-3">
        <div className="h-2 w-16 bg-white/20 rounded-sm" />
        <div className="h-2 w-28 bg-white/15 rounded-sm" />
      </div>
    </div>
  );
}

export function ProjectLoadingScreen({ mode = 'full' }: ProjectLoadingScreenProps) {
  const content = (
    <div className="flex-1 min-h-0 bg-editor-bg flex items-center justify-center relative overflow-hidden">
      <div
        className="absolute inset-0 opacity-[0.025] pointer-events-none"
        style={{
          backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)',
          backgroundSize: '24px 24px',
        }}
      />
      <LoadingIndicator />
    </div>
  );

  if (mode === 'pane') {
    return (
      <div className="flex-1 min-h-0 bg-editor-bg flex flex-col overflow-hidden">
        {content}
      </div>
    );
  }

  return <EditorChromeSkeleton>{content}</EditorChromeSkeleton>;
}

const EXPLORER_SKELETON_ROWS = [
  { nameWidth: '78%', showBadge: true },
  { nameWidth: '64%', showBadge: false },
  { nameWidth: '88%', showBadge: true },
  { nameWidth: '58%', showBadge: false },
  { nameWidth: '72%', showBadge: true },
] as const;

export function ExplorerFilesLoading() {
  return (
    <div className="flex flex-col min-h-0">
      <div className="px-2 py-2 space-y-0.5">
        {EXPLORER_SKELETON_ROWS.map((row, i) => (
          <div
            key={i}
            className="flex items-center gap-2 min-h-[26px] px-2 rounded-sm"
            style={{ opacity: 1 - i * 0.08 }}
          >
            <div className="w-3.5 h-3.5 rounded skeleton-shimmer shrink-0" />
            <div
              className="h-2.5 rounded-sm skeleton-shimmer"
              style={{ width: row.nameWidth }}
            />
            {row.showBadge && (
              <div className="ml-auto w-9 h-4 rounded-sm skeleton-shimmer shrink-0" />
            )}
          </div>
        ))}
      </div>

      <div className="mt-4 mx-3 pt-4 border-t border-[#2a2a2a] flex flex-col items-center">
        <div className="relative w-6 h-6">
          <div className="absolute inset-0 border-[1.5px] border-[#10b981]/20 rounded-full" />
          <div className="absolute inset-0 border-[1.5px] border-[#10b981] border-t-transparent rounded-full animate-spin" />
        </div>
        <p className="mt-4 text-[9px] font-semibold uppercase tracking-[0.14em] text-[#555555]">
          Explorer
        </p>
        <p className="mt-1.5 text-[12px] font-medium text-[#b0b0b0] tracking-[-0.01em]">
          Loading files
        </p>
        <div className="mt-3 w-28 h-1 bg-[#2a2a2a] rounded-full overflow-hidden">
          <div className="h-full w-1/3 rounded-full bg-[#10b981]/60 project-loading-bar" />
        </div>
      </div>
    </div>
  );
}
