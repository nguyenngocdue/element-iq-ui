import React, { useState } from 'react';
import { useApp } from '../store';
import { ChevronDown, CloudUpload, File as FileIcon, X, RefreshCw, Eye, EyeOff } from 'lucide-react';
import { cn } from '../lib/utils';
import { DocumentFile } from '../types';
import { useResizable } from '../hooks/useResizable';
import { ConfirmDialog } from './ConfirmDialog';

export function Sidebar() {
  const { state, setActiveFile, clearSession, openConfigModal, analyzeAll, stopAnalysis } = useApp();
  const [showStatuses, setShowStatuses] = useState(true);
  const [showClearDialog, setShowClearDialog] = useState(false);
  const [clearLoading, setClearLoading] = useState(false);
  const [clearProgress, setClearProgress] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const isAnalyzing = state.files.some(f => f.status === 'ANALYZING');
  const { width, isDragging, handleMouseDown } = useResizable({ initialWidth: 260, minWidth: 200, maxWidth: 600, direction: 'left' });

  // Search results
  const searchResults = searchQuery.trim()
    ? state.files.filter(f => f.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : [];

  // If search tab is active, show search panel
  if (state.activeSidebarTab === 'search') {
    return (
      <div style={{ width }} className="bg-[#1a1b20] border-r border-[#2b2d35] flex flex-col shrink-0 text-[#cccccc] font-sans relative">
        <div onMouseDown={handleMouseDown} className={cn("absolute top-0 right-[-3px] bottom-0 w-[6px] cursor-col-resize z-50 hover:bg-[#10b981] transition-colors", isDragging && "bg-[#10b981]")} />
        <div className="p-4 border-b border-[#2b2d35]">
          <h3 className="text-[10px] font-bold uppercase tracking-wider text-[#858585] mb-3">Search</h3>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search files..."
            autoFocus
            className="w-full bg-[#252526] border border-[#3c3c3c] rounded px-3 py-1.5 text-sm text-white focus:outline-none focus:border-[#10b981] placeholder-[#858585]"
          />
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {searchQuery.trim() && (
            <div className="text-[10px] text-[#858585] px-2 mb-2">
              {searchResults.length} result(s) in {state.files.length} file(s)
            </div>
          )}
          {searchResults.map((file, i) => (
            <div
              key={file.id}
              onClick={() => setActiveFile(file.id)}
              className="flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer hover:bg-[#25272e] text-[12px]"
            >
              <FileIcon className="w-3.5 h-3.5 text-[#858585] shrink-0" />
              <span className="truncate text-white">{file.name}</span>
              <span className={cn("text-[9px] font-bold px-1 py-0.5 rounded shrink-0",
                file.status === 'PASS' ? "text-[#2eb886] bg-[#2eb886]/10" :
                file.status === 'FAIL' ? "text-[#ef4444] bg-[#ef4444]/10" :
                "text-[#858585] bg-[#858585]/10"
              )}>{file.status}</span>
            </div>
          ))}
          {!searchQuery.trim() && (
            <div className="text-center text-[#858585] text-xs mt-8">
              <p>Type to search files</p>
            </div>
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
        
        <div className="flex gap-2 text-[12px] font-medium">
          <button
            onClick={() => openConfigModal('import')}
            className="flex-1 flex items-center justify-center gap-2 bg-[#262831] hover:bg-[#31333d] border border-[#3b3d46] text-white py-1.5 rounded-md transition-colors"
          >
            <CloudUpload className="w-3.5 h-3.5 text-[#858585]" />
            Import
          </button>
          {isAnalyzing ? (
            <button
              onClick={stopAnalysis}
              className="flex-1 flex items-center justify-center gap-2 bg-[#3d2c2e] hover:bg-[#4d3235] border border-[#ef4444]/30 text-[#ef4444] py-1.5 rounded-md transition-colors"
              title="Stop after current file finishes"
            >
              <X className="w-3.5 h-3.5" />
              Stop Queue
            </button>
          ) : (
            <button
              onClick={() => openConfigModal('reanalyze')}
              disabled={state.files.length === 0}
              className="flex-1 flex items-center justify-center gap-2 bg-[#1a3a2a] hover:bg-[#224d36] border border-[#2eb886]/30 text-[#2eb886] py-1.5 rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Run All
            </button>
          )}
          <button onClick={() => setShowClearDialog(true)} className="px-3 bg-[#3d2c2e] hover:bg-[#4d3235] border border-[#522b30] text-[#ff7b7b] rounded-md transition-colors">
            Clear
          </button>
        </div>
      </div>

      {/* Drawings Explorer */}
      <div className="flex-1 overflow-y-auto flex flex-col pb-4 bg-[#1a1b20]">
        <div className="px-4 py-3 flex justify-between items-center sticky top-0 bg-[#1a1b20] z-10">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#858585]">Drawings explorer</span>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowStatuses(!showStatuses)} className="text-[#858585] hover:text-white transition-colors" title="Toggle Status Badges">
              {showStatuses ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
            </button>
            <span className="text-[#2eb886] font-bold text-[11px] bg-[#2eb886]/10 px-1.5 py-0.5 rounded">{displayPassRate}%</span>
          </div>
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
        ) : (
          <div className="flex flex-col mt-1">
            {state.files.map((file, index) => (
              <FileItem 
                key={file.id} 
                file={file}
                index={index + 1}
                isActive={state.activeFileId === file.id}
                activePage={state.activePage || 1}
                onClick={() => setActiveFile(file.id, 1)}
                onPageClick={(page) => setActiveFile(file.id, page)}
                hideBadge={!showStatuses}
              />
            ))}
            <div className="px-4 py-2 text-[10px] text-[#858585] border-t border-[#2b2d35] mt-1">
              Total: {state.files.length} file(s)
            </div>
          </div>
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

export function FileItem({ file, index, isActive, activePage, onClick, onPageClick, hideBadge }: { key?: React.Key, file: DocumentFile, index?: number, isActive: boolean, activePage: number, onClick: () => void, onPageClick: (p: number) => void, hideBadge?: boolean }) {
  const [expanded, setExpanded] = React.useState(true);
  const [showTooltip, setShowTooltip] = React.useState(false);
  const itemRef = React.useRef<HTMLDivElement>(null);
  
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

  // If we only have 1 page, don't show sheets.
  const hasSheets = file.pages > 1;

  return (
    <div className="flex flex-col">
      <div 
        ref={itemRef}
        onClick={() => { onClick(); if(hasSheets) setExpanded(!expanded); }}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        className={cn(
          "px-4 py-1.5 flex items-center justify-between cursor-pointer transition-colors text-[13px] font-medium relative",
          isActive && !hasSheets
            ? "bg-[#333748] text-white border-l-2 border-[#1e5cdc]" 
            : "hover:bg-[#25272e] text-[#a0a5b5] border-l-2 border-transparent"
        )}
      >
        {/* Custom Tooltip */}
        {showTooltip && itemRef.current && (() => {
          const rect = itemRef.current!.getBoundingClientRect();
          return (
            <div className="fixed z-[300] pointer-events-none" style={{ left: rect.right + 8, top: rect.top }}>
              <div className="bg-[#1e1e1e] border border-[#3c3c3c] rounded-lg shadow-xl px-3 py-2 text-[10px] whitespace-nowrap space-y-0.5">
                <div className="text-[#858585]">ID: <span className="text-white font-mono">{file.id.slice(0, 8)}...</span></div>
                <div className="text-[#858585]">File: <span className="text-white">{file.name}</span></div>
                <div className="text-[#858585]">Size: <span className="text-white">{file.file.size > 0 ? `${(file.file.size / 1024 / 1024).toFixed(2)} MB` : 'Not loaded'}</span></div>
                <div className="text-[#858585]">Pages: <span className="text-white">{file.pages}</span></div>
                <div className="text-[#858585]">Status: <span className="text-white font-bold">{file.status}</span></div>
              </div>
            </div>
          );
        })()}

        <div className="flex items-center gap-2.5 overflow-hidden flex-1 mr-3">
           {index && <span className="text-[9px] text-[#858585] font-mono w-4 shrink-0 text-right">{index}</span>}
           {hasSheets && (
              <ChevronDown className={cn("w-3 h-3 shrink-0 transition-transform", !expanded && "-rotate-90")} />
           )}
          <FileIcon className={cn("w-3.5 h-3.5 shrink-0 opacity-80", isActive && !hasSheets ? "text-[#82aaff] fill-current/20" : "")} />
          <span className="truncate">{file.name}</span>
        </div>
        <div className="shrink-0 flex items-center">
          {!hideBadge && getBadge()}
        </div>
      </div>

      {/* Upload progress bar */}
      {file.status === 'UPLOADING' && (
        <div className="px-4 pb-1">
          <div className="h-1 bg-[#2b2d35] rounded-full overflow-hidden">
            <div
              className="h-full bg-[#3b82f6] rounded-full transition-all duration-300"
              style={{ width: `${file.uploadProgress || 0}%` }}
            />
          </div>
        </div>
      )}

      {expanded && hasSheets && Array.from({ length: file.pages }).map((_, idx) => {
         const pageNum = idx + 1;
         const isPageActive = isActive && activePage === pageNum;
         return (
            <div 
              key={pageNum}
              onClick={(e) => { e.stopPropagation(); onPageClick(pageNum); }}
              className={cn(
                "pl-11 pr-4 py-1.5 flex items-center justify-between cursor-pointer transition-colors text-[13px] font-medium",
                isPageActive 
                  ? "bg-[#333748] text-white border-l-2 border-[#1e5cdc]" 
                  : "hover:bg-[#25272e] text-[#858585] border-l-2 border-transparent"
              )}
            >
              <div className="flex items-center gap-2.5 overflow-hidden flex-1 mr-3">
                <FileIcon className={cn("w-3.5 h-3.5 shrink-0 opacity-80", isPageActive ? "text-[#82aaff] fill-current/20" : "")} />
                <span className="truncate">Sheet {pageNum}</span>
              </div>
              <div className="shrink-0 flex items-center">
                {!hideBadge && getBadge()}
              </div>
            </div>
         );
      })}
    </div>
  );
}
