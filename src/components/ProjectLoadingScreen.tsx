import React from 'react';
import { DotGridOverlay, LoadingContent } from './LoadingScreen';

interface ProjectLoadingScreenProps {
  /** Full editor chrome (App boot) vs content pane only (MainEditor). */
  mode?: 'full' | 'pane';
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
      <DotGridOverlay />
      <LoadingContent
        showBrand={mode === 'full'}
        eyebrow="Workspace"
        title="Loading project"
        subtitle="Preparing drawings and analysis workspace"
        brandSize="md"
        textVariant={mode === 'full' ? 'page' : 'panel'}
      />
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

      <div className="mt-4 mx-3 pt-4 border-t border-[#2a2a2a]">
        <LoadingContent
          eyebrow="Explorer"
          title="Loading files"
          showProgress
          spinnerSize="sm"
          compact
          textVariant="embed"
        />
      </div>
    </div>
  );
}
