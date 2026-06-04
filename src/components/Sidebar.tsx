import React, { useState } from 'react';
import { useApp } from '../store';
import { ChevronDown, CloudUpload, File as FileIcon, X, RefreshCw, Eye, EyeOff } from 'lucide-react';
import { cn } from '../lib/utils';
import { DocumentFile } from '../types';
import { useResizable } from '../hooks/useResizable';

export function Sidebar() {
  const { state, setActiveFile, clearSession, openConfigModal, analyzeAll } = useApp();
  const [showStatuses, setShowStatuses] = useState(true);
  const { width, isDragging, handleMouseDown } = useResizable({ initialWidth: 260, minWidth: 200, maxWidth: 600, direction: 'left' });

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
          <button
            onClick={analyzeAll}
            disabled={state.files.length === 0}
            className="flex-1 flex items-center justify-center gap-2 bg-[#1a3a2a] hover:bg-[#224d36] border border-[#2eb886]/30 text-[#2eb886] py-1.5 rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Run All
          </button>
          <button onClick={clearSession} className="px-3 bg-[#3d2c2e] hover:bg-[#4d3235] border border-[#522b30] text-[#ff7b7b] rounded-md transition-colors">
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
        
        {state.files.length === 0 ? (
          <div className="px-4 py-8 text-center text-[#858585] text-[12px]">
            <FileIcon className="w-6 h-6 mx-auto mb-2 opacity-30" />
            <p>No drawings found.</p>
          </div>
        ) : (
          <div className="flex flex-col mt-1">
            {state.files.map((file) => (
              <FileItem 
                key={file.id} 
                file={file} 
                isActive={state.activeFileId === file.id}
                activePage={state.activePage || 1}
                onClick={() => setActiveFile(file.id, 1)}
                onPageClick={(page) => setActiveFile(file.id, page)}
                hideBadge={!showStatuses}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function FileItem({ file, isActive, activePage, onClick, onPageClick, hideBadge }: { key?: React.Key, file: DocumentFile, isActive: boolean, activePage: number, onClick: () => void, onPageClick: (p: number) => void, hideBadge?: boolean }) {
  const [expanded, setExpanded] = React.useState(true);
  
  const getBadge = () => {
    if (file.status === 'PASS') {
      return <span className="text-[#2eb886] font-bold text-[9px] bg-[#2eb886]/10 px-1.5 py-0.5 rounded border border-[#2eb886]/30 tracking-wider">PASS</span>;
    }
    if (file.status === 'FAIL') {
      return <span className="text-[#ef4444] font-bold text-[9px] bg-[#ef4444]/10 px-1.5 py-0.5 rounded border border-[#ef4444]/30 tracking-wider">FAIL</span>;
    }
    if (file.status === 'PENDING' || file.status === 'WARN' || file.status === 'NO-NOTE') {
      return <span className="text-[#bba438] font-bold text-[9px] bg-[#bba438]/10 px-1.5 py-0.5 rounded border border-[#bba438]/30 tracking-wider">NO-NOTE</span>;
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
        onClick={() => { onClick(); if(hasSheets) setExpanded(!expanded); }}
        className={cn(
          "px-4 py-1.5 flex items-center justify-between cursor-pointer transition-colors text-[13px] font-medium",
          isActive && !hasSheets
            ? "bg-[#333748] text-white border-l-2 border-[#1e5cdc]" 
            : "hover:bg-[#25272e] text-[#a0a5b5] border-l-2 border-transparent"
        )}
      >
        <div className="flex items-center gap-2.5 overflow-hidden flex-1 mr-3">
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
