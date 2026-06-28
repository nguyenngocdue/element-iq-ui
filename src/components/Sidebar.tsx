import React, { useCallback, useState } from 'react';
import { useApp, type DeleteFilesOptions } from '../store';
import { CalendarDays, Check, ChevronDown, ChevronRight, ChevronsDownUp, ChevronsUpDown, CloudUpload, Download, File as FileIcon, HardDrive, X, RefreshCw, Eye, EyeOff, Search, ListChecks, Trash2, EllipsisVertical, Pencil, Loader2 } from 'lucide-react';
import { cn } from '../lib/utils';
import { ExplorerFilesLoading } from './ProjectLoadingScreen';
import { highlightMatch } from '../lib/fileSearch';
import {
  applyExplorerView,
  DEFAULT_EXPLORER_SORT,
  DEFAULT_EXPLORER_STATUS,
  ExplorerSortKey,
  ExplorerStatusFilter,
  formatFileCreatedAt,
  formatFileSizeBytes,
  artifactDisplayLabel,
  getFileSizeBytes,
  readExplorerViewPrefs,
  sortFiles,
  statusFilterColorClass,
  statusFilterLabel,
  writeExplorerViewPrefs,
} from '../lib/fileView';
import { DocumentFile } from '../types';
import { statusBadgeClass, filterFilesByBucket, averagePassRate, effectiveFileStatus, effectiveOverallStatus } from '../lib/analysisStatus';
import { StatusLabel } from './StatusLabel';
import { fileIdsForSelectionIndices, parseSelectionRangeInput } from '../lib/selectionRangeInput';
import { downloadFileArtifactsBundle, downloadOriginalPdfFile } from '../lib/artifactDownload';
import { useResizable } from '../hooks/useResizable';
import {
  ExplorerTooltipLocation,
  ExplorerTooltipRow,
  useExplorerHoverTooltip,
} from '../hooks/useExplorerHoverTooltip';
import { ConfirmDialog, type ConfirmDialogOption } from './ConfirmDialog';
import { ExplorerArtifactRow } from './ExplorerArtifactRow';
import { HoverTooltip } from './HoverTooltip';
import { ProjectTooltipContent } from './tooltipContent';
import { ExplorerViewMenu } from './ExplorerViewMenu';
import { TreeRow } from './TreeRow';

const DELETE_DIALOG_OPTIONS: ConfirmDialogOption[] = [
  {
    id: 'removeFile',
    label: 'Remove drawing file from project',
    description: 'Deletes the PDF from this project.',
    defaultChecked: true,
  },
  {
    id: 'purgeAnalysis',
    label: 'Delete analysis data (artifacts, jobs, Supabase records)',
    description: 'Removes annotated PNG/PDF, report JSON, jobs, and related database rows.',
    defaultChecked: true,
  },
];

function resolveDeleteOptions(values?: Record<string, boolean>): DeleteFilesOptions {
  const removeFile = values?.removeFile !== false;
  return {
    removeFile,
    purgeAnalysis: removeFile ? true : values?.purgeAnalysis !== false,
  };
}

type BulkMode = 'run' | 'delete';

function BulkSelectionRangeInput({
  value,
  onChange,
  onApply,
  error,
  maxIndex,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  onApply: () => void;
  error: string | null;
  maxIndex: number;
  disabled?: boolean;
}) {
  return (
    <div className="mt-2.5 flex flex-col gap-1">
      <div className="flex gap-2">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              onApply();
            }
          }}
          disabled={disabled}
          placeholder="1,2,3 or from 1 to 10"
          aria-label="Select drawings by row number"
          className="flex-1 min-w-0 px-2 py-1 rounded border border-[#3b3d46] bg-[#12141a] text-[11px] text-white placeholder:text-[#555] focus:outline-none focus:border-[#10b981]/50 disabled:opacity-40"
        />
        <button
          type="button"
          onClick={onApply}
          disabled={disabled || !value.trim()}
          className="shrink-0 px-2 py-1 rounded border border-[#3b3d46] bg-[#262831] text-[10px] text-[#ccc] hover:text-white hover:border-[#555] transition-colors disabled:opacity-40"
        >
          Apply
        </button>
      </div>
      {error ? (
        <p className="text-[10px] text-[#f87171] leading-snug">{error}</p>
      ) : (
        <p className="text-[9px] text-[#666] leading-snug">
          Row numbers from the list below
          {maxIndex > 0 ? ` (1–${maxIndex})` : ''}
          {' · '}
          e.g. <span className="font-mono text-[#858585]">1,3,5</span>
          {' · '}
          <span className="font-mono text-[#858585]">1-10</span>
          {' · '}
          <span className="font-mono text-[#858585]">from 1 to 10</span>
        </p>
      )}
    </div>
  );
}

export function Sidebar() {
  const {
    state,
    setActiveFile,
    clearSession,
    deleteFiles,
    renameFile,
    openConfigModal,
    analyzeAll,
    stopAnalysis,
    setExplorerSort,
    setExplorerStatus,
  } = useApp();
  const isReadOnly = state.isReadOnly ?? false;
  const canRun = state.canRun === true;
  const canDownload = state.canDownload === true;
  const isProjectOwner = state.isProjectOwner ?? !isReadOnly;
  const [showStatuses, setShowStatuses] = useState(true);
  const [showFileSizes, setShowFileSizes] = useState(false);
  const [showCreatedDates, setShowCreatedDates] = useState(false);
  const [showClearAllDialog, setShowClearAllDialog] = useState(false);
  const [showDeleteSelectedDialog, setShowDeleteSelectedDialog] = useState(false);
  const [showRemoveOneDialog, setShowRemoveOneDialog] = useState(false);
  const [showClearAnalysisDialog, setShowClearAnalysisDialog] = useState(false);
  const [clearAnalysisIds, setClearAnalysisIds] = useState<string[]>([]);
  const [removeOneFileId, setRemoveOneFileId] = useState<string | null>(null);
  const [renameTarget, setRenameTarget] = useState<{ id: string; name: string } | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [renameLoading, setRenameLoading] = useState(false);
  const [renameError, setRenameError] = useState('');
  const [clearLoading, setClearLoading] = useState(false);
  const [clearProgress, setClearProgress] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [explorerSearch, setExplorerSearch] = useState('');
  const [explorerPrefs] = useState(() => readExplorerViewPrefs());
  const explorerSort = state.explorerSort;
  const explorerStatus = state.explorerStatus;
  const [allCollapsedPref, setAllCollapsedPref] = useState(explorerPrefs.allCollapsed);
  const explorerSearchRef = React.useRef<HTMLInputElement>(null);
  const [expandedFileIds, setExpandedFileIds] = useState<Set<string>>(new Set());
  const [artifactsExpandedFileIds, setArtifactsExpandedFileIds] = useState<Set<string>>(new Set());

  // Bulk select: run analysis or delete files
  const [bulkMode, setBulkMode] = useState<BulkMode | null>(null);
  const [selectedFileIds, setSelectedFileIds] = useState<Set<string>>(new Set());
  const [selectionRangeInput, setSelectionRangeInput] = useState('');
  const [selectionRangeError, setSelectionRangeError] = useState<string | null>(null);

  // Keep expansion sets in sync when files are added or removed.
  React.useEffect(() => {
    const ids = state.files.map(f => f.id);
    setExpandedFileIds(prev => {
      const next = new Set(prev);
      for (const id of ids) {
        if (!next.has(id) && !allCollapsedPref) next.add(id);
      }
      for (const id of next) {
        if (!ids.includes(id)) next.delete(id);
      }
      return next;
    });
    setArtifactsExpandedFileIds(prev => {
      const next = new Set(prev);
      for (const id of ids) {
        if (!next.has(id) && !allCollapsedPref) next.add(id);
      }
      for (const id of next) {
        if (!ids.includes(id)) next.delete(id);
      }
      return next;
    });
  }, [state.files, allCollapsedPref]);

  const expandableFileIds = state.files
    .filter(f => f.pages > 1 || (f.artifacts && f.artifacts.length > 0))
    .map(f => f.id);
  const allExpanded =
    expandableFileIds.length > 0 &&
    expandableFileIds.every(id => expandedFileIds.has(id));

  const toggleExpandAll = () => {
    if (allExpanded) {
      setExpandedFileIds(new Set());
      setArtifactsExpandedFileIds(new Set());
      setAllCollapsedPref(true);
      writeExplorerViewPrefs({ allCollapsed: true });
    } else {
      const allIds = new Set(state.files.map(f => f.id));
      setExpandedFileIds(allIds);
      setArtifactsExpandedFileIds(allIds);
      setAllCollapsedPref(false);
      writeExplorerViewPrefs({ allCollapsed: false });
    }
  };

  const activeFilterQuery =
    state.activeSidebarTab === 'search' ? searchQuery : explorerSearch;
  const displayedFiles = applyExplorerView(state.files, {
    query: activeFilterQuery,
    status: explorerStatus,
    sort: explorerSort,
  });
  const hasViewFilter =
    activeFilterQuery.trim() !== '' ||
    explorerStatus !== DEFAULT_EXPLORER_STATUS ||
    explorerSort !== DEFAULT_EXPLORER_SORT;
  const hasActiveFilter =
    activeFilterQuery.trim() !== '' || explorerStatus !== DEFAULT_EXPLORER_STATUS;

  // Auto-expand matches while filtering so artifacts/sheets stay visible.
  React.useEffect(() => {
    const q = activeFilterQuery.trim();
    if (!q) return;
    const matched = displayedFiles.map((f) => f.id);
    setExpandedFileIds((prev) => {
      const next = new Set(prev);
      matched.forEach((id) => next.add(id));
      return next;
    });
    setArtifactsExpandedFileIds((prev) => {
      const next = new Set(prev);
      matched.forEach((id) => next.add(id));
      return next;
    });
  }, [activeFilterQuery, explorerStatus, explorerSort, state.files]);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'f' && state.activeSidebarTab === 'explorer') {
        e.preventDefault();
        explorerSearchRef.current?.focus();
        explorerSearchRef.current?.select();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [state.activeSidebarTab]);

  const isAnalyzing = state.files.some(f => f.status === 'ANALYZING');
  const analysisQueue = state.analysisQueue;
  const queueProgressLabel = analysisQueue
    ? `${analysisQueue.completed}/${analysisQueue.total}`
    : null;
  const queueCurrentLabel = (() => {
    if (analysisQueue) {
      if (analysisQueue.activeCount > 0) {
        const from = analysisQueue.completed + 1;
        const to = analysisQueue.completed + analysisQueue.activeCount;
        return from === to ? `#${from}` : `#${from}–${to}`;
      }
      if (analysisQueue.completed >= analysisQueue.total) return 'Done';
      return '…';
    }
    const analyzingCount = state.files.filter((f) => f.status === 'ANALYZING').length;
    if (analyzingCount > 0) return '#1';
    return '…';
  })();
  const queueProgressFallback = analysisQueue
    ? queueProgressLabel
    : state.files.some((f) => f.status === 'ANALYZING')
      ? '0/1'
      : '…';
  const selectableFileIds = displayedFiles
    .filter(f => f.status !== 'ANALYZING' && f.status !== 'UPLOADING')
    .map(f => f.id);
  const selectedInViewCount = selectableFileIds.filter((id) => selectedFileIds.has(id)).length;

  const exitBulkMode = () => {
    setBulkMode(null);
    setSelectedFileIds(new Set());
    setSelectionRangeInput('');
    setSelectionRangeError(null);
  };

  const applySelectionRangeInput = useCallback(() => {
    const maxIndex = displayedFiles.length;
    const { indices, error } = parseSelectionRangeInput(selectionRangeInput, maxIndex);
    if (error) {
      setSelectionRangeError(error);
      return;
    }
    if (indices.length === 0) {
      setSelectionRangeError(
        maxIndex === 0 ? 'No drawings in the current list' : 'Enter at least one row number',
      );
      return;
    }

    const { ids, skippedBusy, outOfRange } = fileIdsForSelectionIndices(displayedFiles, indices);
    if (ids.length === 0) {
      const parts: string[] = [];
      if (skippedBusy.length > 0) parts.push(`rows ${skippedBusy.join(', ')} are busy`);
      if (outOfRange.length > 0) parts.push(`rows ${outOfRange.join(', ')} not in list`);
      setSelectionRangeError(parts.join(' · ') || 'No selectable rows matched');
      return;
    }

    setSelectedFileIds(new Set(ids));
    const notes: string[] = [];
    if (skippedBusy.length > 0) notes.push(`Skipped busy rows: ${skippedBusy.join(', ')}`);
    if (outOfRange.length > 0) notes.push(`Ignored out of range: ${outOfRange.join(', ')}`);
    setSelectionRangeError(notes.length > 0 ? notes.join(' · ') : null);
  }, [displayedFiles, selectionRangeInput]);

  const isRunSelectMode = bulkMode === 'run';
  const isDeleteSelectMode = bulkMode === 'delete';
  const isBulkSelectMode = bulkMode !== null;

  const selectAllFiles = () => {
    setSelectedFileIds(new Set(selectableFileIds));
  };
  const getRunnableIdsInSortOrder = (ids?: Set<string>) =>
    sortFiles(
      displayedFiles.filter(
        (f) =>
          (ids ? ids.has(f.id) : true) &&
          f.status !== 'ANALYZING' &&
          f.status !== 'UPLOADING',
      ),
      explorerSort,
    ).map((f) => f.id);

  const { width, isDragging, handleMouseDown } = useResizable({ initialWidth: 350, minWidth: 200, maxWidth: 600, direction: 'left' });
  const compactToolbar = width < 300;

  const renderFileList = (
    files: DocumentFile[],
    highlightQuery: string,
    emptyMessage: string,
  ) => {
    if (files.length === 0) {
      return (
        <div className="px-4 py-8 text-center text-[#858585] text-[12px]">
          <Search className="w-5 h-5 mx-auto mb-2 opacity-30" />
          <p>{emptyMessage}</p>
        </div>
      );
    }
    return (
      <div className="flex flex-col mt-1">
        {files.map((file, index) => (
          <FileItem
            key={file.id}
            file={file}
            index={index + 1}
            isLastFile={index === files.length - 1}
            showTree
            nameHighlight={highlightQuery}
            isActive={state.activeFileId === file.id}
            activePage={state.activePage || 1}
            onClick={() => setActiveFile(file.id, 1)}
            onPageClick={(page) => setActiveFile(file.id, page)}
            hideBadge={!showStatuses}
            showFileSize={showFileSizes}
            showCreatedDate={showCreatedDates}
            expanded={expandedFileIds.has(file.id)}
            artifactsExpanded={artifactsExpandedFileIds.has(file.id)}
            onExpandedChange={(v) => {
              setExpandedFileIds((prev) => {
                const next = new Set(prev);
                if (v) next.add(file.id);
                else next.delete(file.id);
                return next;
              });
            }}
            onArtifactsExpandedChange={(v) => {
              setArtifactsExpandedFileIds((prev) => {
                const next = new Set(prev);
                if (v) next.add(file.id);
                else next.delete(file.id);
                return next;
              });
            }}
            selectMode={isBulkSelectMode}
            bulkMode={bulkMode}
            canManage={isProjectOwner}
            canDownload={canDownload}
            onRename={(id, name) => {
              setRenameTarget({ id, name });
              setRenameValue(name);
              setRenameError('');
            }}
            onRemove={(id) => {
              setRemoveOneFileId(id);
              setShowRemoveOneDialog(true);
            }}
            onClearAnalysis={(id) => {
              setClearAnalysisIds([id]);
              setShowClearAnalysisDialog(true);
            }}
            isSelected={selectedFileIds.has(file.id)}
            onToggleSelect={() => {
              if (file.status === 'ANALYZING' || file.status === 'UPLOADING') return;
              setSelectedFileIds(prev => {
                const next = new Set(prev);
                if (next.has(file.id)) next.delete(file.id);
                else next.add(file.id);
                return next;
              });
            }}
          />
        ))}
      </div>
    );
  };

  // If search tab is active, show dedicated search panel
  if (state.activeSidebarTab === 'search') {
    return (
      <div style={{ width }} className="bg-[#1a1b20] border-r border-[#2b2d35] flex flex-col shrink-0 text-[#cccccc] font-sans relative">
        <div onMouseDown={handleMouseDown} className={cn("absolute top-0 right-[-3px] bottom-0 w-[6px] cursor-col-resize z-50 hover:bg-[#10b981] transition-colors", isDragging && "bg-[#10b981]")} />
        <div className="sticky top-0 bg-[#1a1b20] z-10 border-b border-[#2b2d35]/60">
          <div className="px-3 py-2 flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#858585]">Search</span>
            <div className="flex items-center gap-1 shrink-0">
              <ExplorerViewMenu
                compact
                align="outside-right"
                sort={explorerSort}
                status={explorerStatus}
                onSortChange={setExplorerSort}
                onStatusChange={setExplorerStatus}
              />
              {statusFilterLabel(explorerStatus) && (
                <span
                  className={cn(
                    'text-[9px] font-semibold leading-none',
                    statusFilterColorClass(explorerStatus),
                  )}
                >
                  {statusFilterLabel(explorerStatus)}
                </span>
              )}
              {state.files.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowFileSizes(!showFileSizes)}
                  className={cn(
                    'p-1 transition-colors',
                    showFileSizes ? 'text-[#10b981]' : 'text-[#858585] hover:text-white',
                  )}
                  title={showFileSizes ? 'Hide file sizes' : 'Show file sizes'}
                >
                  <HardDrive className="w-3.5 h-3.5" />
                </button>
              )}
              {state.files.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowCreatedDates(!showCreatedDates)}
                  className={cn(
                    'p-1 transition-colors',
                    showCreatedDates ? 'text-[#10b981]' : 'text-[#858585] hover:text-white',
                  )}
                  title={showCreatedDates ? 'Hide created dates' : 'Show created dates (DB)'}
                >
                  <CalendarDays className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
          <div className="px-3 pb-2">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#666] pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter by name, status, artifact..."
                autoFocus
                className="w-full bg-[#252526] border border-[#333] rounded pl-7 pr-7 py-1 text-[11px] text-white focus:outline-none focus:border-[#10b981]/60 placeholder-[#666]"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 p-0.5 text-[#666] hover:text-white"
                  title="Clear"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto pb-4">
          {!searchQuery.trim() && explorerStatus === DEFAULT_EXPLORER_STATUS ? (
            <div className="text-center text-[#858585] text-xs mt-8 px-4">
              <Search className="w-6 h-6 mx-auto mb-2 opacity-30" />
              <p>Search by file name, status (Pass/Fail), or artifact type</p>
            </div>
          ) : (
            renderFileList(displayedFiles, searchQuery, 'No files match your search')
          )}
        </div>
      </div>
    );
  }

  // Segmented toolbar: one outer rounded border + overflow-hidden clips child backgrounds (no per-button radius).
  const toolbarGroup = 'flex overflow-hidden rounded-md border border-[#3b3d46] divide-x divide-[#3b3d46]';
  const toolbarSegBtn = 'flex flex-1 flex-col items-center justify-center gap-1 min-w-0 rounded-none py-2 px-1 text-[10px] font-medium leading-none whitespace-nowrap transition-colors disabled:opacity-40 disabled:cursor-not-allowed';
  const toolbarRunPrimary = 'bg-[#172821] text-[#2eb886] hover:bg-[#1c3028]';
  const toolbarRemovePrimary = 'bg-[#2a1818] text-[#ef4444] hover:bg-[#361f1f]';
  const toolbarSecondary = 'bg-[#262831] text-[#ccc] hover:bg-[#31333d] hover:text-white';
  const toolbarSecondaryActive = 'bg-[#31333d] text-white';

  const passList = filterFilesByBucket(state.files, 'pass');
  const failList = filterFilesByBucket(state.files, 'fail');
  const noNoteList = filterFilesByBucket(state.files, 'noNote');
  const errList = state.files.filter(f => f.status === 'ERROR' as any);

  const overallPassRate = averagePassRate(state.files);
  const displayPassRate = state.files.length ? overallPassRate.toFixed(1) : '0.0';

  const totalNF = state.files.reduce((acc, f) => acc + f.detections.filter(d => d.type === 'NF').length, 0);
  const totalFF = state.files.reduce((acc, f) => acc + f.detections.filter(d => d.type === 'FF').length, 0);
  const totalDet = state.files.reduce((acc, f) => acc + f.detections.length, 0);

  return (
    <div style={{ width }} className="bg-[#1a1b20] border-r border-[#2b2d35] flex flex-col shrink-0 text-[#cccccc] font-sans relative">
      {/* Resizer Handle */}
      <div 
        onMouseDown={handleMouseDown}
        className={cn("absolute top-0 right-[-3px] bottom-0 w-[6px] cursor-col-resize z-50 hover:bg-[#10b981] transition-colors", isDragging && "bg-[#10b981]")}
      />
      {/* Workspace Header */}
      <div className="flex flex-col p-4 border-b border-[#2b2d35]">
        <div className="flex items-center justify-between cursor-pointer mb-2 group">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#858585] group-hover:text-white transition-colors">
            Current Project
          </span>
          <ChevronDown className="w-3.5 h-3.5 text-[#858585] group-hover:text-white transition-colors" />
        </div>
        {state.activeProject ? (
          <HoverTooltip
            className="block min-w-0 mb-1"
            content={
              <ProjectTooltipContent
                id={state.activeProject.id}
                name={state.activeProject.name}
              />
            }
          >
            <div className="text-[13px] font-bold text-[#b4c5ff] truncate">
              {state.activeProject.name}
            </div>
          </HoverTooltip>
        ) : (
          <div className="text-[13px] font-bold text-[#b4c5ff] mb-1 truncate">Untitled Project</div>
        )}
        <div className="text-[11px] text-[#858585] flex items-center gap-1.5 mb-4">
          <span>{state.files.length} files</span>
          <span className="w-1 h-1 bg-[#858585] rounded-full"></span>
          <span className="text-[#2eb886] font-medium">{displayPassRate}% pass</span>
        </div>
        
        <div className="flex flex-col gap-2">
          {isProjectOwner && (
            <button
              onClick={() => openConfigModal('import')}
              title="Import drawings"
              className={cn(
                'flex w-full items-center justify-center gap-2 rounded-md bg-[#222328] py-1.5 text-[11px] font-medium text-[#ccc] ring-1 ring-inset ring-[#3b3d46]/60 transition-colors hover:bg-[#2a2b32] hover:text-white',
                compactToolbar ? 'px-2' : 'px-3',
              )}
            >
              <CloudUpload className="w-3.5 h-3.5 shrink-0 text-[#858585]" />
              {!compactToolbar && 'Import'}
            </button>
          )}

          {!isProjectOwner && !canRun ? (
            <p className="text-[11px] text-[#858585] leading-snug px-0.5">
              View only — you cannot run analysis or remove files on this project.
            </p>
          ) : (
            <div className={cn('flex gap-2', compactToolbar && 'gap-1.5')}>
              {canRun && (
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  {!compactToolbar && (
                    <span className="px-0.5 text-[9px] font-semibold uppercase tracking-wider text-[#2eb886]">
                      Run
                    </span>
                  )}
                  <div className={toolbarGroup}>
                    {isAnalyzing ? (
                      <>
                        <button
                          onClick={stopAnalysis}
                          title="Stop analysis immediately (clears spinners)"
                          className={cn(toolbarSegBtn, toolbarRemovePrimary)}
                        >
                          <X className="w-3.5 h-3.5 shrink-0" />
                          {!compactToolbar && 'Stop'}
                        </button>
                        <div
                          className={cn(toolbarSegBtn, toolbarRunPrimary, 'cursor-default select-none')}
                          title="Completed / total files in queue"
                        >
                          <span className="text-[11px] font-semibold tabular-nums tracking-tight">
                            {queueProgressFallback}
                          </span>
                          {!compactToolbar && (
                            <span className="text-[9px] font-normal text-[#858585]">done</span>
                          )}
                        </div>
                        <div
                          className={cn(toolbarSegBtn, toolbarSecondary, 'cursor-default select-none')}
                          title="File index currently running"
                        >
                          <span className="text-[11px] font-semibold tabular-nums tracking-tight text-[#2eb886]">
                            {queueCurrentLabel}
                          </span>
                          {!compactToolbar && (
                            <span className="text-[9px] font-normal text-[#858585]">running</span>
                          )}
                        </div>
                      </>
                    ) : isRunSelectMode ? (
                      <button
                        onClick={() => {
                          const ids = getRunnableIdsInSortOrder(new Set(selectedFileIds));
                          if (ids.length === 0) return;
                          openConfigModal('reanalyze', undefined, ids);
                          exitBulkMode();
                        }}
                        disabled={selectedInViewCount === 0}
                        title={
                          selectedInViewCount === 0
                            ? 'Select files to run'
                            : `Run ${selectedInViewCount} selected`
                        }
                        className={cn(toolbarSegBtn, toolbarRunPrimary)}
                      >
                        <RefreshCw className="w-3.5 h-3.5 shrink-0" />
                        {!compactToolbar &&
                          (selectedInViewCount > 0 ? `Run (${selectedInViewCount})` : 'Run')}
                      </button>
                    ) : (
                      <button
                        onClick={() => {
                          const ids = getRunnableIdsInSortOrder();
                          if (ids.length === 0) return;
                          openConfigModal('reanalyze', undefined, ids);
                        }}
                        disabled={selectableFileIds.length === 0 || isDeleteSelectMode}
                        title={
                          hasActiveFilter
                            ? `Run analysis on ${selectableFileIds.length} filtered drawing(s)`
                            : 'Run analysis on all drawings'
                        }
                        className={cn(toolbarSegBtn, toolbarRunPrimary)}
                      >
                        <RefreshCw className="w-3.5 h-3.5 shrink-0" />
                        {!compactToolbar &&
                          (hasActiveFilter && selectableFileIds.length > 0
                            ? `Run (${selectableFileIds.length})`
                            : 'Run All')}
                      </button>
                    )}
                    {!isAnalyzing && (
                    <button
                      onClick={() => {
                        if (isRunSelectMode) exitBulkMode();
                        else {
                          setBulkMode('run');
                          setSelectedFileIds(new Set());
                          setSelectionRangeInput('');
                          setSelectionRangeError(null);
                        }
                      }}
                      disabled={state.files.length === 0 || isDeleteSelectMode}
                      title={isRunSelectMode ? 'Cancel picking files' : 'Pick specific drawings to run'}
                      className={cn(
                        toolbarSegBtn,
                        isRunSelectMode ? toolbarSecondaryActive : toolbarSecondary,
                      )}
                    >
                      <ListChecks className="w-3.5 h-3.5 shrink-0" />
                      {!compactToolbar && (isRunSelectMode ? 'Done' : 'Select')}
                    </button>
                    )}
                  </div>
                </div>
              )}

              {isProjectOwner && !state.isLoadingFiles && (
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  {!compactToolbar && (
                    <span className="px-0.5 text-[9px] font-semibold uppercase tracking-wider text-[#ef4444]">
                      Remove
                    </span>
                  )}
                  <div className={toolbarGroup}>
                    <button
                      onClick={() => {
                        if (isDeleteSelectMode) exitBulkMode();
                        else {
                          setBulkMode('delete');
                          setSelectedFileIds(new Set());
                          setSelectionRangeInput('');
                          setSelectionRangeError(null);
                        }
                      }}
                      disabled={state.files.length === 0 || isAnalyzing || isRunSelectMode}
                      title={isDeleteSelectMode ? 'Cancel picking files' : 'Pick specific drawings to remove'}
                      className={cn(
                        toolbarSegBtn,
                        isDeleteSelectMode ? toolbarSecondaryActive : toolbarRemovePrimary,
                      )}
                    >
                      <Trash2 className="w-3.5 h-3.5 shrink-0" />
                      {!compactToolbar && (isDeleteSelectMode ? 'Done' : 'Clear')}
                    </button>
                    <button
                      onClick={() => setShowClearAllDialog(true)}
                      disabled={state.files.length === 0 || isAnalyzing || isDeleteSelectMode}
                      title="Remove every file in this project"
                      className={cn(toolbarSegBtn, toolbarSecondary)}
                    >
                      <Trash2 className="w-3.5 h-3.5 shrink-0 opacity-80" />
                      {!compactToolbar && 'Clear All'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {isRunSelectMode && !isAnalyzing && (
          <div className="mt-2 rounded-md border border-[#3b3d46] bg-[#1e1f24] px-3 py-2.5">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[11px] font-medium text-[#ccc]">Run selected drawings</p>
                <p className="text-[10px] text-[#858585] mt-1 leading-snug">
                  Click files, use checkboxes, or type row numbers below.
                </p>
              </div>
              <button
                type="button"
                onClick={exitBulkMode}
                className="shrink-0 p-0.5 text-[#858585] hover:text-white rounded transition-colors"
                title="Cancel"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <BulkSelectionRangeInput
              value={selectionRangeInput}
              onChange={(v) => {
                setSelectionRangeInput(v);
                if (selectionRangeError) setSelectionRangeError(null);
              }}
              onApply={applySelectionRangeInput}
              error={selectionRangeError}
              maxIndex={displayedFiles.length}
              disabled={displayedFiles.length === 0}
            />
            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              <span className="text-[11px] tabular-nums text-[#858585]">
                {selectedInViewCount} / {selectableFileIds.length} selected
                {hasActiveFilter ? ' (filtered)' : ''}
              </span>
              <button
                type="button"
                onClick={selectAllFiles}
                disabled={selectableFileIds.length === 0}
                className="px-2 py-0.5 rounded border border-[#3b3d46] bg-[#262831] text-[10px] text-[#ccc] hover:text-white hover:border-[#555] transition-colors disabled:opacity-40"
              >
                Select all{hasActiveFilter ? ' shown' : ''}
              </button>
              <button
                type="button"
                onClick={() => setSelectedFileIds(new Set())}
                disabled={selectedInViewCount === 0}
                className="px-2 py-0.5 rounded border border-[#3b3d46] bg-[#262831] text-[10px] text-[#ccc] hover:text-white hover:border-[#555] transition-colors disabled:opacity-40"
              >
                Deselect
              </button>
              <button
                type="button"
                onClick={() => {
                  const ids = getRunnableIdsInSortOrder(new Set(selectedFileIds));
                  if (ids.length === 0) return;
                  openConfigModal('reanalyze', undefined, ids);
                  exitBulkMode();
                }}
                disabled={selectedInViewCount === 0}
                className="px-2 py-0.5 rounded border border-[#2eb886]/40 bg-[#1a3a2a] text-[10px] text-[#2eb886] hover:bg-[#224d36] transition-colors disabled:opacity-40 ml-auto"
              >
                Run{selectedInViewCount > 0 ? ` (${selectedInViewCount})` : ''}
              </button>
            </div>
          </div>
        )}

        {isDeleteSelectMode && !isAnalyzing && (
          <div className="mt-2 rounded-md border border-[#3b3d46] bg-[#1e1f24] px-3 py-2.5">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[11px] font-medium text-[#ccc]">Remove selected drawings</p>
                <p className="text-[10px] text-[#858585] mt-1 leading-snug">
                  Click files, use checkboxes, or type row numbers below.
                </p>
              </div>
              <button
                type="button"
                onClick={exitBulkMode}
                className="shrink-0 p-0.5 text-[#858585] hover:text-white rounded transition-colors"
                title="Cancel"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <BulkSelectionRangeInput
              value={selectionRangeInput}
              onChange={(v) => {
                setSelectionRangeInput(v);
                if (selectionRangeError) setSelectionRangeError(null);
              }}
              onApply={applySelectionRangeInput}
              error={selectionRangeError}
              maxIndex={displayedFiles.length}
              disabled={displayedFiles.length === 0}
            />
            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              <span className="text-[11px] tabular-nums text-[#858585]">
                {selectedInViewCount} / {selectableFileIds.length} selected
                {hasActiveFilter ? ' (filtered)' : ''}
              </span>
              <button
                type="button"
                onClick={selectAllFiles}
                disabled={selectableFileIds.length === 0}
                className="px-2 py-0.5 rounded border border-[#3b3d46] bg-[#262831] text-[10px] text-[#ccc] hover:text-white hover:border-[#555] transition-colors disabled:opacity-40"
              >
                Select all{hasActiveFilter ? ' shown' : ''}
              </button>
              <button
                type="button"
                onClick={() => setSelectedFileIds(new Set())}
                disabled={selectedInViewCount === 0}
                className="px-2 py-0.5 rounded border border-[#3b3d46] bg-[#262831] text-[10px] text-[#ccc] hover:text-white hover:border-[#555] transition-colors disabled:opacity-40"
              >
                Deselect
              </button>
              <button
                type="button"
                onClick={() => {
                  if (selectedInViewCount === 0) return;
                  const ids = selectableFileIds.filter((id) => selectedFileIds.has(id));
                  setClearAnalysisIds(ids);
                  setShowClearAnalysisDialog(true);
                }}
                disabled={selectedInViewCount === 0}
                className="px-2 py-0.5 rounded border border-[#3b3d46] bg-[#262831] text-[10px] text-[#ccc] hover:text-white hover:border-[#555] transition-colors disabled:opacity-40"
              >
                Clear analysis{selectedInViewCount > 0 ? ` (${selectedInViewCount})` : ''}
              </button>
              <button
                type="button"
                onClick={() => {
                  if (selectedInViewCount === 0) return;
                  setShowDeleteSelectedDialog(true);
                }}
                disabled={selectedInViewCount === 0}
                className="px-2 py-0.5 rounded border border-[#522b30] bg-[#3d2c2e] text-[10px] text-[#ff7b7b] hover:bg-[#4d3235] transition-colors disabled:opacity-40 ml-auto"
              >
                Remove{selectedInViewCount > 0 ? ` (${selectedInViewCount})` : ''}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Drawings Explorer */}
      <div className="flex-1 flex flex-col min-h-0 bg-[#1a1b20]">
        <div className="flex-1 overflow-y-auto flex flex-col">
        <div className="sticky top-0 bg-[#1a1b20] z-10 border-b border-[#2b2d35]/60">
          {isRunSelectMode && !isAnalyzing && (
            <div className="px-3 py-1.5 border-b border-[#2b2d35] text-[10px] text-[#858585]">
              Click drawings to add them to this run
            </div>
          )}
          {isDeleteSelectMode && !isAnalyzing && (
            <div className="px-3 py-1.5 border-b border-[#2b2d35] text-[10px] text-[#858585]">
              Click drawings to mark for removal
            </div>
          )}
          <div className="px-3 py-2 flex items-center justify-between gap-2 min-h-[32px]">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#858585] truncate">
              Drawings explorer
            </span>
            <div className="flex items-center gap-0.5 shrink-0">
              {state.files.length > 0 && (
                <div className="flex items-center gap-1">
                  <ExplorerViewMenu
                    compact
                    align="outside-right"
                    sort={explorerSort}
                    status={explorerStatus}
                    onSortChange={setExplorerSort}
                    onStatusChange={setExplorerStatus}
                  />
                  {statusFilterLabel(explorerStatus) && (
                    <span
                      className={cn(
                        'text-[9px] font-semibold leading-none mr-0.5',
                        statusFilterColorClass(explorerStatus),
                      )}
                    >
                      {statusFilterLabel(explorerStatus)}
                    </span>
                  )}
                </div>
              )}
              {state.files.length > 0 && (
                <button
                  type="button"
                  onClick={toggleExpandAll}
                  disabled={expandableFileIds.length === 0}
                  className="p-1 text-[#858585] hover:text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                  title={allExpanded ? 'Collapse all' : 'Expand all'}
                >
                  {allExpanded
                    ? <ChevronsDownUp className="w-3.5 h-3.5" />
                    : <ChevronsUpDown className="w-3.5 h-3.5" />
                  }
                </button>
              )}
              {state.files.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowFileSizes(!showFileSizes)}
                  className={cn(
                    'p-1 transition-colors',
                    showFileSizes ? 'text-[#10b981]' : 'text-[#858585] hover:text-white',
                  )}
                  title={showFileSizes ? 'Hide file sizes' : 'Show file sizes'}
                >
                  <HardDrive className="w-3.5 h-3.5" />
                </button>
              )}
              {state.files.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowCreatedDates(!showCreatedDates)}
                  className={cn(
                    'p-1 transition-colors',
                    showCreatedDates ? 'text-[#10b981]' : 'text-[#858585] hover:text-white',
                  )}
                  title={showCreatedDates ? 'Hide created dates' : 'Show created dates (DB)'}
                >
                  <CalendarDays className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                type="button"
                onClick={() => setShowStatuses(!showStatuses)}
                className={cn(
                  'p-1 transition-colors',
                  showStatuses ? 'text-[#858585] hover:text-white' : 'text-[#10b981]',
                )}
                title="Toggle status badges"
              >
                {showStatuses ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
              </button>
              <span className="text-[#2eb886] font-semibold text-[10px] bg-[#2eb886]/10 px-1 py-0.5 rounded ml-0.5">
                {displayPassRate}%
              </span>
            </div>
          </div>
          {state.files.length > 0 && (
            <div className="px-3 pb-2">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#666] pointer-events-none" />
                <input
                  ref={explorerSearchRef}
                  type="text"
                  value={explorerSearch}
                  onChange={(e) => setExplorerSearch(e.target.value)}
                  placeholder="Filter drawings..."
                  className="w-full bg-[#252526] border border-[#333] rounded pl-7 pr-7 py-1 text-[11px] text-white focus:outline-none focus:border-[#10b981]/60 placeholder-[#666]"
                />
                {explorerSearch && (
                  <button
                    type="button"
                    onClick={() => setExplorerSearch('')}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 p-0.5 text-[#666] hover:text-white"
                    title="Clear"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
        
        {state.isLoadingFiles ? (
          <ExplorerFilesLoading />
        ) : state.files.length === 0 && state.activeProject ? (
          <div className="px-4 py-8 text-center text-[#858585] text-[12px]">
            <FileIcon className="w-6 h-6 mx-auto mb-2 opacity-30" />
            <p>No drawings found.</p>
          </div>
        ) : state.files.length === 0 ? (
          <div className="px-4 py-8 text-center text-[#858585] text-[12px]">
            <FileIcon className="w-6 h-6 mx-auto mb-2 opacity-30" />
            <p>No drawings found.</p>
          </div>
        ) : hasViewFilter && displayedFiles.length === 0 ? (
          renderFileList([], explorerSearch, 'No drawings match the current view')
        ) : (
          renderFileList(displayedFiles, explorerSearch, 'No drawings found')
        )}
        </div>

        {state.files.length > 0 && !state.isLoadingFiles && (
          <div className="shrink-0 px-4 py-2 text-[10px] text-[#858585] border-t border-[#2b2d35] bg-[#1a1b20]">
            {hasViewFilter
              ? `Showing ${displayedFiles.length} of ${state.files.length} file(s)`
              : `Total: ${state.files.length} file(s)`}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={showClearAllDialog}
        title="Clear All Files"
        description={`Choose what to remove for all ${state.files.length} file(s) in this project.`}
        confirmLabel="Confirm"
        variant="danger"
        loading={clearLoading}
        progressText={clearProgress}
        options={DELETE_DIALOG_OPTIONS}
        onConfirm={async (values) => {
          const opts = resolveDeleteOptions(values);
          setClearLoading(true);
          setClearProgress(`Processing ${state.files.length} file(s)...`);
          try {
            await clearSession((current, total, filename) => {
              setClearProgress(`Processing "${filename}" (${current}/${total})`);
            }, opts);
            setShowClearAllDialog(false);
            exitBulkMode();
          } catch (err) {
            setClearProgress(err instanceof Error ? err.message : 'Delete failed');
          } finally {
            setClearLoading(false);
          }
        }}
        onCancel={() => setShowClearAllDialog(false)}
      />

      <ConfirmDialog
        open={showDeleteSelectedDialog}
        title="Remove Selected Files"
        description={`Choose what to remove for ${selectedInViewCount} selected file(s).`}
        confirmLabel="Confirm"
        variant="danger"
        loading={clearLoading}
        progressText={clearProgress}
        options={DELETE_DIALOG_OPTIONS}
        onConfirm={async (values) => {
          const ids = selectableFileIds.filter((id) => selectedFileIds.has(id));
          const opts = resolveDeleteOptions(values);
          setClearLoading(true);
          setClearProgress(`Processing ${ids.length} file(s)...`);
          try {
            await deleteFiles(ids, (current, total, filename) => {
              setClearProgress(`Processing "${filename}" (${current}/${total})`);
            }, opts);
            setShowDeleteSelectedDialog(false);
            exitBulkMode();
          } catch (err) {
            setClearProgress(err instanceof Error ? err.message : 'Delete failed');
          } finally {
            setClearLoading(false);
          }
        }}
        onCancel={() => setShowDeleteSelectedDialog(false)}
      />

      <ConfirmDialog
        open={showRemoveOneDialog}
        title="Remove File"
        description={`Choose what to remove for "${state.files.find((f) => f.id === removeOneFileId)?.name ?? 'this file'}".`}
        confirmLabel="Confirm"
        variant="danger"
        loading={clearLoading}
        progressText={clearProgress}
        options={DELETE_DIALOG_OPTIONS}
        onConfirm={async (values) => {
          if (!removeOneFileId) return;
          const opts = resolveDeleteOptions(values);
          setClearLoading(true);
          setClearProgress('Processing file...');
          try {
            await deleteFiles([removeOneFileId], (_c, _t, filename) => {
              setClearProgress(`Processing "${filename}"...`);
            }, opts);
            setShowRemoveOneDialog(false);
            setRemoveOneFileId(null);
          } catch (err) {
            setClearProgress(err instanceof Error ? err.message : 'Delete failed');
          } finally {
            setClearLoading(false);
          }
        }}
        onCancel={() => {
          setShowRemoveOneDialog(false);
          setRemoveOneFileId(null);
        }}
      />

      <ConfirmDialog
        open={showClearAnalysisDialog}
        title="Clear Analysis Data"
        description={
          clearAnalysisIds.length <= 1
            ? `Delete artifacts, jobs, and database records for "${state.files.find((f) => f.id === clearAnalysisIds[0])?.name ?? 'this file'}"? The PDF stays in the project.`
            : `Delete analysis data for ${clearAnalysisIds.length} file(s)? PDFs stay in the project; status resets to Ready.`
        }
        confirmLabel="Clear Analysis"
        variant="warning"
        loading={clearLoading}
        progressText={clearProgress}
        onConfirm={async () => {
          if (clearAnalysisIds.length === 0) return;
          setClearLoading(true);
          setClearProgress(`Clearing ${clearAnalysisIds.length} file(s)...`);
          try {
            await deleteFiles(clearAnalysisIds, (current, total, filename) => {
              setClearProgress(`Clearing "${filename}" (${current}/${total})`);
            }, { removeFile: false, purgeAnalysis: true });
            setShowClearAnalysisDialog(false);
            setClearAnalysisIds([]);
            exitBulkMode();
          } catch (err) {
            setClearProgress(err instanceof Error ? err.message : 'Clear analysis failed');
          } finally {
            setClearLoading(false);
          }
        }}
        onCancel={() => {
          setShowClearAnalysisDialog(false);
          setClearAnalysisIds([]);
        }}
      />

      {renameTarget && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => !renameLoading && setRenameTarget(null)}>
          <div
            className="bg-[#252526] border border-[#3c3c3c] rounded-xl shadow-2xl w-full max-w-md overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 pb-4">
              <h3 className="text-lg font-semibold text-white mb-1">Rename file</h3>
              <p className="text-sm text-[#858585] mb-4">Enter a new filename for this drawing.</p>
              <input
                type="text"
                value={renameValue}
                onChange={(e) => { setRenameValue(e.target.value); setRenameError(''); }}
                autoFocus
                disabled={renameLoading}
                className="w-full bg-[#1e1e1e] border border-[#3c3c3c] rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:border-[#10b981]/60 disabled:opacity-50"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && renameValue.trim()) {
                    e.preventDefault();
                    (document.getElementById('rename-file-submit') as HTMLButtonElement | null)?.click();
                  }
                }}
              />
              {renameError && <p className="text-xs text-[#ef4444] mt-2">{renameError}</p>}
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[#3c3c3c] bg-[#1e1e1e]">
              <button
                type="button"
                onClick={() => setRenameTarget(null)}
                disabled={renameLoading}
                className="px-4 py-2 text-sm font-medium rounded-md bg-[#3c3c3c] hover:bg-[#4a4a4a] text-white transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                id="rename-file-submit"
                type="button"
                disabled={renameLoading || !renameValue.trim()}
                onClick={async () => {
                  if (!renameTarget) return;
                  setRenameLoading(true);
                  setRenameError('');
                  try {
                    await renameFile(renameTarget.id, renameValue.trim());
                    setRenameTarget(null);
                  } catch (err) {
                    setRenameError(err instanceof Error ? err.message : 'Rename failed');
                  } finally {
                    setRenameLoading(false);
                  }
                }}
                className="px-4 py-2 text-sm font-medium rounded-md bg-[#10b981] hover:bg-[#059669] text-white transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {renameLoading && <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function FileItem({
  file,
  index,
  isLastFile = true,
  showTree = false,
  isActive,
  activePage,
  onClick,
  onPageClick,
  hideBadge,
  showFileSize = false,
  showCreatedDate = false,
  expanded: controlledExpanded,
  artifactsExpanded: controlledArtifactsExpanded,
  onExpandedChange,
  onArtifactsExpandedChange,
  nameHighlight = '',
  selectMode = false,
  bulkMode = null,
  canManage = false,
  canDownload = false,
  onRename,
  onRemove,
  onClearAnalysis,
  isSelected = false,
  onToggleSelect,
}: {
  key?: React.Key;
  file: DocumentFile;
  index?: number;
  isLastFile?: boolean;
  showTree?: boolean;
  nameHighlight?: string;
  isActive: boolean;
  activePage: number;
  onClick: () => void;
  onPageClick: (p: number) => void;
  hideBadge?: boolean;
  showFileSize?: boolean;
  showCreatedDate?: boolean;
  expanded?: boolean;
  artifactsExpanded?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
  onArtifactsExpandedChange?: (expanded: boolean) => void;
  selectMode?: boolean;
  bulkMode?: 'run' | 'delete' | null;
  canManage?: boolean;
  canDownload?: boolean;
  onRename?: (id: string, name: string) => void;
  onRemove?: (id: string) => void;
  onClearAnalysis?: (id: string) => void;
  isSelected?: boolean;
  onToggleSelect?: () => void;
}) {
  const { state } = useApp();
  const [menuOpen, setMenuOpen] = React.useState(false);
  const menuRef = React.useRef<HTMLDivElement>(null);
  const [internalExpanded, setInternalExpanded] = React.useState(true);
  const [internalArtifactsExpanded, setInternalArtifactsExpanded] = React.useState(true);
  const expanded = controlledExpanded ?? internalExpanded;
  const artifactsExpanded = controlledArtifactsExpanded ?? internalArtifactsExpanded;
  const setExpanded = (v: boolean) => {
    onExpandedChange?.(v);
    if (controlledExpanded === undefined) setInternalExpanded(v);
  };
  const setArtifactsExpanded = (v: boolean) => {
    onArtifactsExpandedChange?.(v);
    if (controlledArtifactsExpanded === undefined) setInternalArtifactsExpanded(v);
  };
  const { anchorRef: fileRowRef, hoverProps: tooltipHoverProps, renderTooltip } = useExplorerHoverTooltip();

  const isAnalyzing = file.status === 'ANALYZING';
  const isUploading = file.status === 'UPLOADING';
  const isPdfLoading = !!(
    file.pdfLoading
    || (isActive && file.file.size === 0 && !file.pdfLoadError)
  );
  
  const getBadge = () => {
    const displayStatus = effectiveFileStatus(file);
    const displayOverall = effectiveOverallStatus(file);
    if (file.status === 'UPLOADING') {
      return <span className="text-[#3b82f6] font-bold text-[9px] bg-[#3b82f6]/10 px-1.5 py-0.5 rounded border border-[#3b82f6]/30 tracking-wider">{file.uploadProgress || 0}%</span>;
    }
    if (file.status === 'ANALYZING') {
      return <RefreshCw className="w-3.5 h-3.5 text-[#10b981] animate-spin" />;
    }
    if (isPdfLoading) {
      return (
        <span className="text-[#3b82f6] font-bold text-[9px] bg-[#3b82f6]/10 px-1.5 py-0.5 rounded border border-[#3b82f6]/30 tracking-wider">
          LOAD
        </span>
      );
    }
    const cls = statusBadgeClass(displayStatus, displayOverall);
    return (
      <span className={`font-bold text-[9px] px-1.5 py-0.5 rounded border tracking-wider ${cls}`}>
        <StatusLabel status={displayStatus} overallStatus={displayOverall} />
      </span>
    );
  };

  const hasSheets = file.pages > 1;
  const hasArtifacts = !!(file.artifacts && file.artifacts.length > 0);
  const hasChildren = hasSheets || hasArtifacts;
  const showSheets = expanded && hasSheets;
  const showArtifactsBlock = expanded && hasArtifacts;
  const selectDisabled = file.status === 'ANALYZING' || file.status === 'UPLOADING';
  const isRunBulk = bulkMode === 'run';
  const isDeleteBulk = bulkMode === 'delete';
  const bulkSelectedClass = isSelected && isRunBulk
    ? 'bg-[#2a2a1a] text-white border-l-2 border-[#f59e0b]'
    : isSelected && isDeleteBulk
      ? 'bg-[#3d2c2e] text-white border-l-2 border-[#ef4444]'
      : null;

  React.useEffect(() => {
    if (!menuOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (menuRef.current?.contains(e.target as Node)) return;
      setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);
  const canClearAnalysis =
    file.status !== 'PENDING'
    && file.status !== 'UPLOADING'
    && file.status !== 'ANALYZING';
  const runningRowClass = isAnalyzing
    ? 'bg-[#10b981]/15 text-[#d1fae5] border-l-2 border-[#10b981]'
    : isUploading
      ? 'bg-[#3b82f6]/12 text-[#bfdbfe] border-l-2 border-[#3b82f6]'
      : isPdfLoading
        ? 'bg-[#3b82f6]/10 text-[#dbeafe] border-l-2 border-[#3b82f6]/70'
        : null;

  const openArtifact = (artifact: NonNullable<DocumentFile['artifacts']>[number], name: string) => {
    window.dispatchEvent(new CustomEvent('elementiq:view-artifact', {
      detail: {
        id: artifact.id,
        type: artifact.type,
        downloadUrl: artifact.downloadUrl,
        name,
        sourceFileId: file.id,
      },
    }));
  };

  const fileTooltip = renderTooltip(
    <>
      <ExplorerTooltipRow label="ID" value={file.id} copyText={file.id} valueClassName="font-mono" />
      <ExplorerTooltipRow label="File" value={file.name} copyText={file.name} valueClassName="font-medium" />
      <ExplorerTooltipRow label="Size" value={formatFileSizeBytes(getFileSizeBytes(file))} />
      <ExplorerTooltipRow label="Pages" value={file.pages} />
      <ExplorerTooltipRow
        label="Status"
        value={<StatusLabel status={effectiveFileStatus(file)} overallStatus={effectiveOverallStatus(file)} className="font-bold" />}
      />
      <ExplorerTooltipRow
        label="Uploaded"
        value={file.uploadedAt ? new Date(file.uploadedAt).toLocaleString() : '—'}
      />
      <ExplorerTooltipLocation path={file.localPath ?? '—'} />
    </>,
  );

  const fileRowContent = (
    <>
      {/* Checkbox — only visible in select mode */}
      {selectMode && (
        <button
          type="button"
          role="checkbox"
          aria-checked={isSelected}
          aria-label={`Select ${file.name}`}
          disabled={selectDisabled}
          onClick={(e) => {
            e.stopPropagation();
            if (!selectDisabled) onToggleSelect?.();
          }}
          className={cn(
            'w-4 h-4 shrink-0 rounded border flex items-center justify-center transition-colors',
            selectDisabled && 'opacity-25 cursor-not-allowed',
            !selectDisabled && 'cursor-pointer',
            isSelected
              ? bulkMode === 'delete'
                ? 'bg-[#ef4444] border-[#ef4444] text-white'
                : 'bg-[#f59e0b] border-[#f59e0b] text-[#1a1b20]'
              : 'border-[#666] bg-[#12141a] hover:border-[#f59e0b]',
          )}
        >
          {isSelected && <Check className="w-3 h-3" strokeWidth={3} />}
        </button>
      )}
      {index != null && (
        <span className="text-[12px] font-bold text-[#a0a5b5] font-mono w-5 shrink-0 text-right tabular-nums">{index}</span>
      )}
      {hasChildren ? (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
          className="shrink-0 text-[#858585] hover:text-white transition-colors"
        >
          {expanded
            ? <ChevronDown className="w-3 h-3" />
            : <ChevronRight className="w-3 h-3" />
          }
        </button>
      ) : (
        <span className="w-3 shrink-0" />
      )}
      {isPdfLoading ? (
        <Loader2 className="w-3.5 h-3.5 shrink-0 text-[#3b82f6] animate-spin" aria-hidden />
      ) : (
        <FileIcon className={cn('w-3.5 h-3.5 shrink-0 opacity-80', isActive && !hasSheets ? 'text-[#82aaff] fill-current/20' : '')} />
      )}
      <span className="truncate flex-1 text-[13px] font-medium min-w-0">{highlightMatch(file.name, nameHighlight)}</span>
      {(showFileSize || showCreatedDate) && (
        <span className="flex items-center gap-1 shrink-0 text-[9px] text-[#666]">
          {showFileSize && (
            <span
              className="font-mono tabular-nums"
              title={`Size: ${formatFileSizeBytes(getFileSizeBytes(file))}`}
            >
              {formatFileSizeBytes(getFileSizeBytes(file))}
            </span>
          )}
          {showFileSize && showCreatedDate && (
            <span className="text-[#444] select-none">|</span>
          )}
          {showCreatedDate && (
            <span
              title={file.uploadedAt ? `Created in DB: ${new Date(file.uploadedAt).toLocaleString()}` : 'Created date unavailable'}
            >
              {formatFileCreatedAt(file)}
            </span>
          )}
        </span>
      )}
      <span className="shrink-0">{!hideBadge && getBadge()}</span>
      {canDownload && !selectMode && (
        <div ref={menuRef} className="relative shrink-0">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpen((v) => !v);
            }}
            className="p-0.5 rounded text-[#666] hover:text-white hover:bg-[#333] opacity-0 group-hover:opacity-100 focus:opacity-100 transition-all"
            aria-label={`Actions for ${file.name}`}
          >
            <EllipsisVertical className="w-3.5 h-3.5" />
          </button>
          {menuOpen && (
            <div
              className="absolute right-0 top-full mt-1 z-[120] min-w-[168px] py-1 bg-[#1e1f24] border border-[#3c3c3c] rounded-lg shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuOpen(false);
                  void downloadOriginalPdfFile(file.id, file.name, file.file);
                }}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] text-[#ccc] hover:bg-[#262831] hover:text-white transition-colors"
              >
                <Download className="w-3 h-3 shrink-0" /> Download PDF
              </button>
              {hasArtifacts && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenuOpen(false);
                    void downloadFileArtifactsBundle(file.id, file.name);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] text-[#ccc] hover:bg-[#262831] hover:text-white transition-colors border-b border-[#3c3c3c]"
                >
                  <Download className="w-3 h-3 shrink-0" /> PDF + artifacts (ZIP)
                </button>
              )}
              {canManage && (
                <>
              <button
                type="button"
                disabled={selectDisabled}
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuOpen(false);
                  onRename?.(file.id, file.name);
                }}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] text-[#ccc] hover:bg-[#262831] hover:text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Pencil className="w-3 h-3 shrink-0" /> Rename
              </button>
              {canClearAnalysis && (
                <button
                  type="button"
                  disabled={selectDisabled}
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenuOpen(false);
                    onClearAnalysis?.(file.id);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] text-[#f59e0b] hover:bg-[#f59e0b]/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <RefreshCw className="w-3 h-3 shrink-0" /> Clear analysis
                </button>
              )}
              <button
                type="button"
                disabled={selectDisabled}
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuOpen(false);
                  onRemove?.(file.id);
                }}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] text-[#ef4444]/90 hover:bg-[#ef4444]/10 hover:text-[#ef4444] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Trash2 className="w-3 h-3 shrink-0" /> Remove
              </button>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </>
  );

  const flatFileRow = (
    <div
      ref={fileRowRef}
      {...tooltipHoverProps}
      onClick={() => {
        if (selectMode) {
          if (!selectDisabled) onToggleSelect?.();
          return;
        }
        onClick();
        if (hasSheets) setExpanded(!expanded);
      }}
      className={cn(
        'px-4 py-1.5 flex items-center justify-between transition-colors text-[13px] font-medium relative group',
        selectMode && !selectDisabled && 'cursor-pointer',
        selectMode && selectDisabled && 'cursor-not-allowed opacity-50',
        !selectMode && 'cursor-pointer',
        bulkSelectedClass
          ? bulkSelectedClass
          : runningRowClass
            ? runningRowClass
            : isActive && !hasSheets && !selectMode
              ? 'bg-[#333748] text-white border-l-2 border-[#1e5cdc]'
              : 'hover:bg-[#25272e] text-[#a0a5b5] border-l-2 border-transparent',
      )}
    >
      <div className="flex items-center gap-2.5 overflow-hidden flex-1 mr-3">{fileRowContent}</div>
    </div>
  );

  if (!showTree) {
    return (
      <div className="flex flex-col">
        {fileTooltip}
        {flatFileRow}
        {file.status === 'UPLOADING' && (
          <div className="px-4 pb-1">
            <div className="h-1 bg-[#2b2d35] rounded-full overflow-hidden">
              <div className="h-full bg-[#3b82f6] rounded-full transition-all duration-300" style={{ width: `${file.uploadProgress || 0}%` }} />
            </div>
          </div>
        )}
        {showArtifactsBlock && (
          <>
            <div
              className="pl-[3.75rem] pr-4 py-1 flex items-center gap-1.5 cursor-pointer text-[10px] text-[#858585] hover:text-white hover:bg-[#25272e] select-none"
              onClick={(e) => { e.stopPropagation(); setArtifactsExpanded(!artifactsExpanded); }}
            >
              {artifactsExpanded ? <ChevronDown className="w-2.5 h-2.5 shrink-0" /> : <ChevronRight className="w-2.5 h-2.5 shrink-0" />}
              <span className="uppercase tracking-wider font-bold text-[9px]">Artifacts</span>
              <span className="ml-auto text-[9px] text-[#555]">{file.artifacts!.length}</span>
              <button
                type="button"
                title="Download PDF gốc + tất cả artifacts (ZIP)"
                className="ml-1 p-0.5 rounded hover:bg-[#333] text-[#858585] hover:text-white"
                onClick={(e) => {
                  e.stopPropagation();
                  void downloadFileArtifactsBundle(file.id, file.name);
                }}
              >
                <Download className="w-3 h-3" />
              </button>
            </div>
            {artifactsExpanded && file.artifacts!.map(a => {
              const artifactName = artifactDisplayLabel(a);
              return (
                <ExplorerArtifactRow
                  key={a.id}
                  artifact={a}
                  sourceFileName={file.name}
                  isActive={state.activeArtifact?.id === a.id}
                  onSelect={() => openArtifact(a, artifactName)}
                  variant="flat"
                />
              );
            })}
          </>
        )}
        {showSheets && Array.from({ length: file.pages }).map((_, idx) => {
          const pageNum = idx + 1;
          const isPageActive = isActive && activePage === pageNum;
          return (
            <div
              key={pageNum}
              onClick={(e) => { e.stopPropagation(); onPageClick(pageNum); }}
              className={cn(
                'pl-11 pr-4 py-1.5 flex items-center justify-between cursor-pointer text-[13px] font-medium',
                isPageActive ? 'bg-[#333748] text-white' : 'hover:bg-[#25272e] text-[#858585]',
              )}
            >
              <div className="flex items-center gap-2.5 overflow-hidden flex-1 mr-3">
                <FileIcon className={cn('w-3.5 h-3.5 shrink-0 opacity-80', isPageActive ? 'text-[#82aaff] fill-current/20' : '')} />
                <span className="truncate">Sheet {pageNum}</span>
              </div>
              {!hideBadge && getBadge()}
            </div>
          );
        })}
      </div>
    );
  }

  const sheetsFollowArtifacts = showSheets;
  const artifactsHeaderIsLast = !sheetsFollowArtifacts;
  const fileBranchContinues = expanded && (showArtifactsBlock || showSheets);
  /** Offset child rows past the drawing row's index + expand chevron (w-4 + w-3). */
  const FILE_CHILD_SPACER_COLS = 2;
  const underFileGuides: boolean[] = [true];
  const artifactRowGuides = (artifactIsLast: boolean) =>
    [true, !artifactIsLast || sheetsFollowArtifacts] as boolean[];

  return (
    <div className="flex flex-col">
      {fileTooltip}

      <div ref={fileRowRef} {...tooltipHoverProps}>
        <TreeRow
          continuingGuides={[]}
          isLast={isLastFile && !fileBranchContinues}
          active={isSelected ? true : (isActive && !hasSheets && !isAnalyzing && !isUploading)}
          onClick={() => {
            if (selectMode) {
              if (!selectDisabled) onToggleSelect?.();
              return;
            }
            onClick();
            if (hasSheets) setExpanded(!expanded);
          }}
          className={cn(
            'text-[13px] font-medium group',
            bulkSelectedClass,
            selectMode && selectDisabled && 'opacity-50',
            !selectMode && runningRowClass,
          )}
        >
          {fileRowContent}
        </TreeRow>
      </div>

      {file.status === 'UPLOADING' && (
        <div className="pl-[calc(0.5rem+14px)] pr-3 pb-1">
          <div className="h-1 bg-[#2b2d35] rounded-full overflow-hidden">
            <div className="h-full bg-[#3b82f6] rounded-full transition-all duration-300" style={{ width: `${file.uploadProgress || 0}%` }} />
          </div>
        </div>
      )}

      {showArtifactsBlock && (
        <TreeRow
          spacerColumns={FILE_CHILD_SPACER_COLS}
          continuingGuides={underFileGuides}
          isLast={artifactsHeaderIsLast && !(artifactsExpanded && file.artifacts!.length > 0)}
          onClick={(e) => { e.stopPropagation(); setArtifactsExpanded(!artifactsExpanded); }}
          className="text-[10px] text-[#858585]"
        >
          {artifactsExpanded
            ? <ChevronDown className="w-2.5 h-2.5 shrink-0" />
            : <ChevronRight className="w-2.5 h-2.5 shrink-0" />
          }
          <span className="uppercase tracking-wider font-bold text-[9px]">Artifacts</span>
          <span className="ml-auto text-[9px] text-[#555]">{file.artifacts!.length}</span>
          <button
            type="button"
            title="Download PDF gốc + tất cả artifacts (ZIP)"
            className="ml-1 p-0.5 rounded hover:bg-[#333] text-[#858585] hover:text-white"
            onClick={(e) => {
              e.stopPropagation();
              void downloadFileArtifactsBundle(file.id, file.name);
            }}
          >
            <Download className="w-3 h-3" />
          </button>
        </TreeRow>
      )}

      {showArtifactsBlock && artifactsExpanded && file.artifacts!.map((a, ai) => {
        const artifactName = artifactDisplayLabel(a);
        const isLastArtifact = ai === file.artifacts!.length - 1;
        const artifactIsLast = isLastArtifact && !sheetsFollowArtifacts;
        return (
          <ExplorerArtifactRow
            key={a.id}
            artifact={a}
            sourceFileName={file.name}
            isActive={state.activeArtifact?.id === a.id}
            onSelect={() => openArtifact(a, artifactName)}
            variant="tree"
            spacerColumns={FILE_CHILD_SPACER_COLS}
            continuingGuides={artifactRowGuides(artifactIsLast)}
            isLast={artifactIsLast}
            className="text-[11px]"
          />
        );
      })}

      {showSheets && Array.from({ length: file.pages }).map((_, idx) => {
        const pageNum = idx + 1;
        const isPageActive = isActive && activePage === pageNum;
        const isLastSheet = pageNum === file.pages;
        const sheetGuides: boolean[] = underFileGuides;
        return (
          <TreeRow
            key={pageNum}
            spacerColumns={FILE_CHILD_SPACER_COLS}
            continuingGuides={sheetGuides}
            isLast={isLastSheet}
            active={isPageActive}
            onClick={(e) => { e.stopPropagation(); onPageClick(pageNum); }}
            className="text-[13px] font-medium"
          >
            <FileIcon className={cn('w-3.5 h-3.5 shrink-0 opacity-80', isPageActive ? 'text-[#82aaff] fill-current/20' : '')} />
            <span className="truncate flex-1">Sheet {pageNum}</span>
            <span className="shrink-0">{!hideBadge && getBadge()}</span>
          </TreeRow>
        );
      })}
    </div>
  );
}
