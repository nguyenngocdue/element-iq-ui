import React, { useState } from 'react';
import { useApp } from '../store';
import { CalendarDays, Check, ChevronDown, ChevronRight, ChevronsDownUp, ChevronsUpDown, CloudUpload, File as FileIcon, HardDrive, X, RefreshCw, Eye, EyeOff, Search, ListChecks, Trash2 } from 'lucide-react';
import { cn } from '../lib/utils';
import { highlightMatch } from '../lib/fileSearch';
import {
  applyExplorerView,
  DEFAULT_EXPLORER_SORT,
  DEFAULT_EXPLORER_STATUS,
  ExplorerSortKey,
  ExplorerStatusFilter,
  formatFileCreatedAt,
  formatFileSizeBytes,
  getFileSizeBytes,
  readExplorerViewPrefs,
  sortFiles,
  statusFilterColorClass,
  statusFilterLabel,
  writeExplorerViewPrefs,
} from '../lib/fileView';
import { DocumentFile } from '../types';
import { useResizable } from '../hooks/useResizable';
import {
  ExplorerTooltipLocation,
  ExplorerTooltipRow,
  useExplorerHoverTooltip,
} from '../hooks/useExplorerHoverTooltip';
import { ConfirmDialog } from './ConfirmDialog';
import { ExplorerArtifactRow } from './ExplorerArtifactRow';
import { ExplorerViewMenu } from './ExplorerViewMenu';
import { TreeRow } from './TreeRow';

export function Sidebar() {
  const { state, setActiveFile, clearSession, openConfigModal, analyzeAll, stopAnalysis } = useApp();
  const [showStatuses, setShowStatuses] = useState(true);
  const [showFileSizes, setShowFileSizes] = useState(false);
  const [showCreatedDates, setShowCreatedDates] = useState(false);
  const [showClearDialog, setShowClearDialog] = useState(false);
  const [clearLoading, setClearLoading] = useState(false);
  const [clearProgress, setClearProgress] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [explorerSearch, setExplorerSearch] = useState('');
  const [explorerPrefs] = useState(() => readExplorerViewPrefs());
  const [explorerSort, setExplorerSortState] = useState<ExplorerSortKey>(explorerPrefs.sort);
  const [allCollapsedPref, setAllCollapsedPref] = useState(explorerPrefs.allCollapsed);
  const [explorerStatus, setExplorerStatus] = useState<ExplorerStatusFilter>(DEFAULT_EXPLORER_STATUS);
  const explorerSearchRef = React.useRef<HTMLInputElement>(null);
  const [expandedFileIds, setExpandedFileIds] = useState<Set<string>>(new Set());
  const [artifactsExpandedFileIds, setArtifactsExpandedFileIds] = useState<Set<string>>(new Set());

  const setExplorerSort = React.useCallback((sort: ExplorerSortKey) => {
    setExplorerSortState(sort);
    writeExplorerViewPrefs({ sort });
  }, []);

  // Select mode state
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedFileIds, setSelectedFileIds] = useState<Set<string>>(new Set());

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
  const selectableFileIds = state.files
    .filter(f => f.status !== 'ANALYZING' && f.status !== 'UPLOADING')
    .map(f => f.id);

  const exitSelectMode = () => {
    setIsSelectMode(false);
    setSelectedFileIds(new Set());
  };

  const selectAllFiles = () => {
    setSelectedFileIds(new Set(selectableFileIds));
  };
  const getRunnableIdsInSortOrder = (ids?: Set<string>) =>
    sortFiles(
      state.files.filter(
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
            selectMode={isSelectMode}
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

  const passList = state.files.filter(f => f.status === 'PASS');
  const failList = state.files.filter(f => f.status === 'FAIL');
  // Representing PENDING and WARN as NO-NOTE based on the design
  const noNoteList = state.files.filter(f => f.status === 'PENDING' || f.status === 'WARN' || f.status === 'NO-NOTE');
  const errList = state.files.filter(f => f.status === 'ERROR' as any);

  const totalPassRate = state.files.reduce((acc, f) => acc + (f.passRate ?? (f.status === 'PASS' ? 100 : 0)), 0);
  const overallPassRate = state.files.length ? totalPassRate / state.files.length : 0;
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
        <div className="text-[13px] font-bold text-[#b4c5ff] mb-1 truncate" title={state.activeProject?.name || "Untitled Project"}>
          {state.activeProject?.name || "Untitled Project"}
        </div>
        <div className="text-[11px] text-[#858585] flex items-center gap-1.5 mb-4">
          <span>{state.files.length} files</span>
          <span className="w-1 h-1 bg-[#858585] rounded-full"></span>
          <span className="text-[#2eb886] font-medium">{displayPassRate}% pass</span>
        </div>
        
        <div className={cn('flex text-[12px] font-medium', compactToolbar ? 'gap-1' : 'gap-2')}>
          <button
            onClick={() => openConfigModal('import')}
            title="Import"
            className={cn(
              'flex items-center justify-center bg-[#262831] hover:bg-[#31333d] border border-[#3b3d46] text-white py-1.5 rounded-md transition-colors',
              compactToolbar ? 'px-2' : 'flex-1 gap-2',
            )}
          >
            <CloudUpload className="w-3.5 h-3.5 text-[#858585] shrink-0" />
            {!compactToolbar && 'Import'}
          </button>
          {isAnalyzing ? (
            <button
              onClick={stopAnalysis}
              title="Stop after current file finishes"
              className={cn(
                'flex items-center justify-center bg-[#3d2c2e] hover:bg-[#4d3235] border border-[#ef4444]/30 text-[#ef4444] py-1.5 rounded-md transition-colors',
                compactToolbar ? 'px-2' : 'flex-1 gap-2',
              )}
            >
              <X className="w-3.5 h-3.5 shrink-0" />
              {!compactToolbar && 'Stop Queue'}
            </button>
          ) : isSelectMode ? (
            <button
              onClick={() => {
                if (selectedFileIds.size === 0) return;
                openConfigModal('reanalyze', undefined, getRunnableIdsInSortOrder(new Set(selectedFileIds)));
                exitSelectMode();
              }}
              disabled={selectedFileIds.size === 0}
              title={selectedFileIds.size === 0 ? 'Select files to run' : `Run ${selectedFileIds.size} selected file(s)`}
              className={cn(
                'flex items-center justify-center bg-[#1a3a2a] hover:bg-[#224d36] border border-[#2eb886]/30 text-[#2eb886] py-1.5 rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed',
                compactToolbar ? 'px-2' : 'flex-1 gap-2',
              )}
            >
              <RefreshCw className="w-3.5 h-3.5 shrink-0" />
              {!compactToolbar && <>Run Selected{selectedFileIds.size > 0 ? ` (${selectedFileIds.size})` : ''}</>}
            </button>
          ) : (
            <button
              onClick={() => {
                const ids = getRunnableIdsInSortOrder();
                if (ids.length === 0) return;
                openConfigModal('reanalyze', undefined, ids);
              }}
              disabled={state.files.length === 0}
              title="Run All"
              className={cn(
                'flex items-center justify-center bg-[#1a3a2a] hover:bg-[#224d36] border border-[#2eb886]/30 text-[#2eb886] py-1.5 rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed',
                compactToolbar ? 'px-2' : 'flex-1 gap-2',
              )}
            >
              <RefreshCw className="w-3.5 h-3.5 shrink-0" />
              {!compactToolbar && 'Run All'}
            </button>
          )}
          <button
            onClick={() => {
              if (isSelectMode) exitSelectMode();
              else setIsSelectMode(true);
            }}
            disabled={state.files.length === 0 || isAnalyzing}
            title={isSelectMode ? 'Exit select mode' : 'Choose specific files to run'}
            className={cn(
              'flex items-center justify-center rounded-md border transition-colors disabled:opacity-40 disabled:cursor-not-allowed',
              compactToolbar ? 'px-2' : 'px-2 gap-1',
              isSelectMode
                ? 'bg-[#2a2a1a] border-[#f59e0b]/40 text-[#f59e0b] hover:bg-[#3a3a20]'
                : 'bg-[#262831] border-[#3b3d46] text-[#858585] hover:bg-[#31333d] hover:text-white',
            )}
          >
            <ListChecks className="w-3.5 h-3.5 shrink-0" />
            {!compactToolbar && <span className="text-[11px] font-medium">{isSelectMode ? 'Cancel' : 'Select'}</span>}
          </button>
          <button
            onClick={() => setShowClearDialog(true)}
            title="Clear All Files"
            className={cn(
              'flex items-center justify-center bg-[#3d2c2e] hover:bg-[#4d3235] border border-[#522b30] text-[#ff7b7b] rounded-md transition-colors',
              compactToolbar ? 'px-2 py-1.5' : 'px-3 gap-1.5',
            )}
          >
            <Trash2 className="w-3.5 h-3.5 shrink-0" />
            {!compactToolbar && 'Clear'}
          </button>
        </div>

        {isSelectMode && !isAnalyzing && (
          <div className="mt-2 rounded-md border border-[#f59e0b]/35 bg-[#f59e0b]/10 px-3 py-2">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold text-[#f59e0b]">Select mode</p>
                <p className="text-[10px] text-[#b4b4b4] mt-0.5 leading-snug">
                  <span className="text-[#f59e0b] font-medium">Step 1:</span> click drawings below (or checkboxes)
                  <br />
                  <span className="text-[#f59e0b] font-medium">Step 2:</span> press Run Selected, then pick model(s)
                </p>
              </div>
              <button
                type="button"
                onClick={exitSelectMode}
                className="shrink-0 p-0.5 text-[#858585] hover:text-white rounded transition-colors"
                title="Exit select mode"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="mt-2 flex items-center gap-2 flex-wrap">
              <span className="text-[11px] font-medium text-[#f59e0b]">
                {selectedFileIds.size} / {selectableFileIds.length} selected
              </span>
              <button
                type="button"
                onClick={selectAllFiles}
                disabled={selectableFileIds.length === 0}
                className="px-2 py-0.5 rounded border border-[#3b3d46] bg-[#262831] text-[10px] text-[#ccc] hover:text-white hover:border-[#555] transition-colors disabled:opacity-40"
              >
                Select all
              </button>
              <button
                type="button"
                onClick={() => setSelectedFileIds(new Set())}
                disabled={selectedFileIds.size === 0}
                className="px-2 py-0.5 rounded border border-[#3b3d46] bg-[#262831] text-[10px] text-[#ccc] hover:text-white hover:border-[#555] transition-colors disabled:opacity-40"
              >
                Clear
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Drawings Explorer */}
      <div className="flex-1 overflow-y-auto flex flex-col pb-4 bg-[#1a1b20]">
        <div className="sticky top-0 bg-[#1a1b20] z-10 border-b border-[#2b2d35]/60">
          {isSelectMode && !isAnalyzing && (
            <div className="px-3 py-1.5 bg-[#f59e0b]/10 border-b border-[#f59e0b]/20 flex items-center gap-2">
              <ListChecks className="w-3.5 h-3.5 text-[#f59e0b] shrink-0" />
              <span className="text-[10px] text-[#f59e0b] font-medium">
                Click a drawing to select · checkboxes on the left
              </span>
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
          <div className="px-4 py-6 space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-2.5 animate-pulse">
                <div className="w-3.5 h-3.5 bg-[#2b2d35] rounded" />
                <div className="h-3 bg-[#2b2d35] rounded flex-1" />
                <div className="w-12 h-4 bg-[#2b2d35] rounded" />
              </div>
            ))}
            <p className="text-center text-[#858585] text-[11px] mt-3">Loading files...</p>
          </div>
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
          <>
            {renderFileList(displayedFiles, explorerSearch, 'No drawings found')}
            <div className="px-4 py-2 text-[10px] text-[#858585] border-t border-[#2b2d35] mt-1">
              {hasViewFilter
                ? `Showing ${displayedFiles.length} of ${state.files.length} file(s)`
                : `Total: ${state.files.length} file(s)`}
            </div>
          </>
        )}
      </div>

      <ConfirmDialog
        open={showClearDialog}
        title="Clear All Files"
        description={`Delete all ${state.files.length} file(s) from this project? All analysis data will be permanently removed.`}
        confirmLabel="Clear All"
        variant="danger"
        loading={clearLoading}
        progressText={clearProgress}
        onConfirm={async () => {
          setClearLoading(true);
          setClearProgress(`Deleting ${state.files.length} file(s)...`);
          await clearSession((current, total, filename) => {
            setClearProgress(`Deleting "${filename}" (${current}/${total})`);
          });
          setClearLoading(false);
          setClearProgress('');
          setShowClearDialog(false);
        }}
        onCancel={() => setShowClearDialog(false)}
      />
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
  isSelected?: boolean;
  onToggleSelect?: () => void;
}) {
  const { state } = useApp();
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
  
  const getBadge = () => {
    if (file.status === 'UPLOADING') {
      return <span className="text-[#3b82f6] font-bold text-[9px] bg-[#3b82f6]/10 px-1.5 py-0.5 rounded border border-[#3b82f6]/30 tracking-wider">{file.uploadProgress || 0}%</span>;
    }
    if (file.status === 'PASS') {
      return <span className="text-[#2eb886] font-bold text-[9px] bg-[#2eb886]/10 px-1.5 py-0.5 rounded border border-[#2eb886]/30 tracking-wider">PASS</span>;
    }
    if (file.status === 'FAIL') {
      return <span className="text-[#ef4444] font-bold text-[9px] bg-[#ef4444]/10 px-1.5 py-0.5 rounded border border-[#ef4444]/30 tracking-wider">FAIL</span>;
    }
    if (file.status === 'NO-NOTE') {
      return <span className="text-[#bba438] font-bold text-[9px] bg-[#bba438]/10 px-1.5 py-0.5 rounded border border-[#bba438]/30 tracking-wider">NO-NOTE</span>;
    }
    if (file.status === 'PENDING') {
      return <span className="text-[#858585] font-bold text-[9px] bg-[#858585]/10 px-1.5 py-0.5 rounded border border-[#858585]/30 tracking-wider">READY</span>;
    }
    if (file.status === 'ANALYZING') {
      return <RefreshCw className="w-3.5 h-3.5 text-[#10b981] animate-spin" />;
    }
    return null;
  };

  const hasSheets = file.pages > 1;
  const hasArtifacts = !!(file.artifacts && file.artifacts.length > 0);
  const hasChildren = hasSheets || hasArtifacts;
  const showSheets = expanded && hasSheets;
  const showArtifactsBlock = expanded && hasArtifacts;
  const selectDisabled = file.status === 'ANALYZING' || file.status === 'UPLOADING';
  const isAnalyzing = file.status === 'ANALYZING';
  const isUploading = file.status === 'UPLOADING';
  const runningRowClass = isAnalyzing
    ? 'bg-[#10b981]/15 text-[#d1fae5] border-l-2 border-[#10b981]'
    : isUploading
      ? 'bg-[#3b82f6]/12 text-[#bfdbfe] border-l-2 border-[#3b82f6]'
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
      <ExplorerTooltipRow label="ID" value={`${file.id.slice(0, 8)}...`} valueClassName="font-mono" />
      <ExplorerTooltipRow label="File" value={file.name} valueClassName="font-medium" />
      <ExplorerTooltipRow label="Size" value={formatFileSizeBytes(getFileSizeBytes(file))} />
      <ExplorerTooltipRow label="Pages" value={file.pages} />
      <ExplorerTooltipRow label="Status" value={file.status} valueClassName="font-bold" />
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
              ? 'bg-[#f59e0b] border-[#f59e0b] text-[#1a1b20]'
              : 'border-[#666] bg-[#12141a] hover:border-[#f59e0b]',
          )}
        >
          {isSelected && <Check className="w-3 h-3" strokeWidth={3} />}
        </button>
      )}
      {index != null && (
        <span className="text-[9px] text-[#555] font-mono w-4 shrink-0 text-right">{index}</span>
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
      <FileIcon className={cn('w-3.5 h-3.5 shrink-0 opacity-80', isActive && !hasSheets ? 'text-[#82aaff] fill-current/20' : '')} />
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
        'px-4 py-1.5 flex items-center justify-between transition-colors text-[13px] font-medium relative',
        selectMode && !selectDisabled && 'cursor-pointer',
        selectMode && selectDisabled && 'cursor-not-allowed opacity-50',
        !selectMode && 'cursor-pointer',
        selectMode && isSelected
          ? 'bg-[#2a2a1a] text-white border-l-2 border-[#f59e0b]'
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
            </div>
            {artifactsExpanded && file.artifacts!.map(a => {
              const artifactName = a.type === 'ANNOTATED_PNG' ? 'Annotated PNG' : a.type === 'ANNOTATED_PDF' ? 'Annotated PDF' : 'Report JSON';
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
            'text-[13px] font-medium',
            selectMode && isSelected && 'border-l-2 border-[#f59e0b] bg-[#2a2a1a]',
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
        </TreeRow>
      )}

      {showArtifactsBlock && artifactsExpanded && file.artifacts!.map((a, ai) => {
        const artifactName = a.type === 'ANNOTATED_PNG' ? 'Annotated PNG' : a.type === 'ANNOTATED_PDF' ? 'Annotated PDF' : 'Report JSON';
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
