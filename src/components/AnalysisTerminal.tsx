import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, MoreHorizontal, Trash2, Terminal, X } from 'lucide-react';
import { cn } from '../lib/utils';
import { useApp } from '../store';
import { useResizable } from '../hooks/useResizable';
import { useVerticalResizable } from '../hooks/useVerticalResizable';
import { HighlightedLogMessage, getLogRowBackground } from '../lib/analysisLogHighlight';

const HEIGHT_STORAGE_KEY = 'element-iq:analysis-terminal-height';
const QUEUE_WIDTH_STORAGE_KEY = 'element-iq:analysis-queue-width';
const MIN_HEIGHT = 120;
const DEFAULT_HEIGHT = 220;
const MIN_QUEUE_WIDTH = 120;
const MAX_QUEUE_WIDTH = 360;
const DEFAULT_QUEUE_WIDTH = 168;

function readQueueWidth(): number {
  try {
    const saved = localStorage.getItem(QUEUE_WIDTH_STORAGE_KEY);
    if (!saved) return DEFAULT_QUEUE_WIDTH;
    const n = parseInt(saved, 10);
    if (Number.isNaN(n)) return DEFAULT_QUEUE_WIDTH;
    return Math.min(MAX_QUEUE_WIDTH, Math.max(MIN_QUEUE_WIDTH, n));
  } catch {
    return DEFAULT_QUEUE_WIDTH;
  }
}

const LEVEL_CLASS = {
  info: 'text-[#cccccc]',
  success: 'text-[#cccccc]',
  warn: 'text-[#cccccc]',
  error: 'text-[#cccccc]',
  dim: 'text-[#858585]',
} as const;

export function AnalysisTerminal() {
  const { state, toggleAnalysisTerminal, clearAnalysisLogs } = useApp();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [filterFileId, setFilterFileId] = useState<string | null>(null);

  const getMaxHeight = useCallback(() => {
    return Math.max(MIN_HEIGHT, Math.floor(window.innerHeight * 0.75));
  }, []);

  const { height, isDragging: isHeightDragging, handleMouseDown: handleHeightMouseDown } =
    useVerticalResizable({
      initialHeight: DEFAULT_HEIGHT,
      minHeight: MIN_HEIGHT,
      getMaxHeight,
      storageKey: HEIGHT_STORAGE_KEY,
    });

  const {
    width: queueWidth,
    isDragging: isQueueDragging,
    handleMouseDown: handleQueueMouseDown,
  } = useResizable({
    initialWidth: readQueueWidth(),
    minWidth: MIN_QUEUE_WIDTH,
    maxWidth: MAX_QUEUE_WIDTH,
    direction: 'right',
  });

  const queue = state.analysisQueue;

  const queueFiles = useMemo(() => {
    const seen = new Set<string>();
    const items: { id: string; label: string }[] = [];
    for (const line of state.analysisLogs) {
      if (!line.fileId || seen.has(line.fileId)) continue;
      seen.add(line.fileId);
      const fromStore = state.files.find((f) => f.id === line.fileId)?.name;
      const fromMessage = line.message.match(/▶\s*(.+)$/)?.[1];
      items.push({
        id: line.fileId,
        label: fromStore ?? fromMessage ?? line.fileId.slice(0, 8),
      });
    }
    return items;
  }, [state.analysisLogs, state.files]);

  const visibleLogs = useMemo(() => {
    if (!filterFileId) return state.analysisLogs;
    return state.analysisLogs.filter((line) => line.fileId === filterFileId);
  }, [state.analysisLogs, filterFileId]);

  const filterLabel = filterFileId
    ? queueFiles.find((f) => f.id === filterFileId)?.label
    : null;

  useEffect(() => {
    if (!state.activeFileId) return;
    const hasLogs = state.analysisLogs.some((l) => l.fileId === state.activeFileId);
    if (hasLogs) setFilterFileId(state.activeFileId);
  }, [state.activeFileId]);

  useEffect(() => {
    if (state.analysisLogs.length === 0) setFilterFileId(null);
  }, [state.analysisLogs.length]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = filterFileId ? 0 : el.scrollHeight;
  }, [visibleLogs.length, filterFileId]);

  useEffect(() => {
    try {
      localStorage.setItem(QUEUE_WIDTH_STORAGE_KEY, String(queueWidth));
    } catch {
      /* ignore */
    }
  }, [queueWidth]);

  if (!state.isAnalysisTerminalOpen) return null;

  const progressPct = queue ? Math.round((queue.completed / queue.total) * 100) : 0;
  const activeLabel = queue?.activeFileNames?.length
    ? queue.activeFileNames.join(', ')
    : queue && queue.activeCount > 0
      ? 'Starting…'
      : 'Preparing…';
  const showQueuePanel = queue || queueFiles.length > 0;

  return (
    <div
      className="relative shrink-0 flex flex-col border-t border-[#3c3c3c] bg-[#1e1e1e] shadow-[0_-4px_24px_rgba(0,0,0,0.35)]"
      style={{ height }}
    >
      <div
        role="separator"
        aria-orientation="horizontal"
        aria-label="Resize analysis log panel"
        onMouseDown={handleHeightMouseDown}
        className={cn(
          'absolute top-0 left-0 right-0 h-[6px] -translate-y-1/2 cursor-row-resize z-50',
          'hover:bg-[#10b981]/50 transition-colors',
          isHeightDragging && 'bg-[#10b981]',
        )}
      />

      <div className="h-[35px] bg-[#252526] flex items-stretch shrink-0 border-b border-[#3c3c3c]">
        <div className="flex items-stretch h-full min-w-0 overflow-x-auto no-scrollbar">
          <div className="px-4 h-full flex items-center gap-2 text-[11px] uppercase tracking-[0.06em] font-medium text-[#cccccc] bg-[#1e1e1e] border-t-2 border-t-[#10b981] shrink-0">
            <Terminal className="w-3.5 h-3.5 text-[#10b981]" />
            Analysis Log
          </div>
          {filterLabel ? (
            <div
              className="px-3 h-full flex items-center gap-2 text-[10px] text-[#10b981] shrink-0 border-l border-[#3c3c3c]/60 max-w-[220px]"
              title={filterLabel}
            >
              <span className="truncate">{filterLabel}</span>
              <button
                type="button"
                onClick={() => setFilterFileId(null)}
                className="shrink-0 text-[#858585] hover:text-white"
                title="Show all logs"
              >
                ×
              </button>
            </div>
          ) : queue ? (
            <div className="px-3 h-full flex items-center text-[10px] text-[#858585] shrink-0 border-l border-[#3c3c3c]/60">
              Queue {queue.completed}/{queue.total} done
              {queue.activeCount > 0 ? ` · ${queue.activeCount} running` : ''}
            </div>
          ) : null}
        </div>

        <div className="flex-1 min-w-0" />

        <div className="flex items-center h-full px-1 shrink-0">
          <button
            type="button"
            onClick={() => {
              clearAnalysisLogs();
              setFilterFileId(null);
            }}
            className="h-7 w-7 flex items-center justify-center text-[#858585] hover:text-white hover:bg-[#3c3c3c]/60 rounded transition-colors"
            title="Clear log"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            className="h-7 w-7 flex items-center justify-center text-[#858585] hover:text-white hover:bg-[#3c3c3c]/60 rounded transition-colors"
            title="More actions"
          >
            <MoreHorizontal className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={toggleAnalysisTerminal}
            className="h-7 w-7 flex items-center justify-center text-[#858585] hover:text-white hover:bg-[#3c3c3c]/60 rounded transition-colors"
            title="Hide panel"
          >
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={toggleAnalysisTerminal}
            className="h-7 w-7 flex items-center justify-center text-[#858585] hover:text-white hover:bg-[#3c3c3c]/60 rounded transition-colors"
            title="Close panel"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="flex flex-1 min-h-0">
        <div
          ref={scrollRef}
          className="flex-1 min-w-0 overflow-y-auto px-4 py-2 font-mono text-[12px] leading-[1.55] bg-[#1e1e1e] no-scrollbar"
        >
          {visibleLogs.length === 0 ? (
            <p className="text-[#6a6a6a] italic">
              {filterFileId ? 'No log entries for this file.' : 'Run analysis to see live progress here…'}
            </p>
          ) : (
            visibleLogs.map((line) => (
              <div
                key={line.id}
                className={cn(
                  'flex gap-3 py-1 -mx-1 px-2 rounded-sm transition-colors',
                  getLogRowBackground(line),
                )}
              >
                <span className="text-[#569cd6]/70 shrink-0 select-none tabular-nums self-start">
                  {line.ts}
                </span>
                <span className="break-all whitespace-pre-wrap leading-relaxed">
                  <HighlightedLogMessage message={line.message} baseClassName={LEVEL_CLASS[line.level]} />
                </span>
              </div>
            ))
          )}
        </div>

        {showQueuePanel && (
          <aside
            className="relative shrink-0 border-l border-[#3c3c3c] bg-[#181818] flex flex-col min-h-0"
            style={{ width: queueWidth }}
          >
            <div
              role="separator"
              aria-orientation="vertical"
              aria-label="Resize queue panel"
              onMouseDown={handleQueueMouseDown}
              className={cn(
                'absolute top-0 left-[-3px] bottom-0 w-[6px] cursor-col-resize z-50 hover:bg-[#10b981] transition-colors',
                isQueueDragging && 'bg-[#10b981]',
              )}
            />
            <div className="px-3 py-2 border-b border-[#3c3c3c] shrink-0">
              <div className="text-[10px] uppercase tracking-[0.08em] text-[#858585] font-semibold">Queue</div>
              {queue && (
                <>
                  <div className="mt-1.5 text-[11px] text-[#cccccc] truncate" title={activeLabel}>
                    {activeLabel}
                  </div>
                  <div className="mt-2 h-1 rounded-full bg-[#3c3c3c] overflow-hidden">
                    <div
                      className="h-full bg-[#10b981] transition-all duration-300"
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>
                  <div className="mt-1 text-[10px] text-[#858585] tabular-nums">
                    {queue.completed} / {queue.total} files done
                    {queue.activeCount > 0 ? ` · ${queue.activeCount} active` : ''}
                  </div>
                  {queue.activeWorkers && queue.activeWorkers.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {queue.activeWorkers.map((w) => (
                        <div
                          key={w.workerId}
                          className="text-[10px] text-[#10b981] font-mono truncate"
                          title={w.fileName}
                        >
                          W{w.workerId} → {w.fileName}
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
            {queueFiles.length > 0 && (
              <div className="flex-1 overflow-y-auto py-1 no-scrollbar">
                <button
                  type="button"
                  onClick={() => setFilterFileId(null)}
                  className={cn(
                    'w-full px-3 py-1.5 flex items-center gap-2 text-[11px] text-left transition-colors',
                    filterFileId === null ? 'bg-[#37373d] text-white' : 'text-[#969696] hover:bg-[#2a2d2e]',
                  )}
                >
                  <Terminal className="w-3 h-3 shrink-0 opacity-70" />
                  <span>All files</span>
                </button>
                {queueFiles.map((item, idx) => {
                  const isSelected = filterFileId === item.id;
                  const fileRow = state.files.find((f) => f.id === item.id);
                  const isRunning = !filterFileId && fileRow?.status === 'ANALYZING';
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setFilterFileId(item.id)}
                      className={cn(
                        'w-full px-3 py-1.5 flex items-start gap-2 text-[11px] text-left truncate transition-colors',
                        isSelected || isRunning ? 'bg-[#37373d] text-white' : 'text-[#969696] hover:bg-[#2a2d2e]',
                      )}
                    >
                      <Terminal className="w-3 h-3 shrink-0 mt-0.5 opacity-70" />
                      <span className="truncate" title={item.label}>
                        {idx + 1}. {item.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </aside>
        )}
      </div>
    </div>
  );
}

export function AnalysisTerminalToggle() {
  const { state, toggleAnalysisTerminal } = useApp();
  const hasLogs = state.analysisLogs.length > 0;
  const queue = state.analysisQueue;

  return (
    <button
      type="button"
      onClick={toggleAnalysisTerminal}
      className={cn(
        'flex items-center gap-1 hover:opacity-90 transition-opacity',
        state.isAnalysisTerminalOpen && 'underline underline-offset-2',
      )}
      title={state.isAnalysisTerminalOpen ? 'Hide analysis log' : 'Show analysis log'}
    >
      <Terminal className="w-3 h-3" />
      <span>
        {queue
          ? `Running ${queue.completed}/${queue.total}${queue.activeCount > 0 ? ` (${queue.activeCount} active)` : ''}`
          : hasLogs
            ? `Log (${state.analysisLogs.length})`
            : 'Analysis log'}
      </span>
      <ChevronDown className={cn('w-3 h-3 transition-transform', !state.isAnalysisTerminalOpen && 'rotate-180')} />
    </button>
  );
}
