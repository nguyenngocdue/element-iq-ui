import React, { useState } from 'react';
import { useApp } from '../store';
import { Download, Share2, ChevronRight, Plus, DownloadCloud, RefreshCw, Database, ShieldCheck, Box, AlertTriangle, CheckCircle, FileSpreadsheet } from 'lucide-react';
import {
  averagePassRate,
  countFilesByBucket,
} from '../lib/analysisStatus';
import { cn } from '../lib/utils';
import { useResizable } from '../hooks/useResizable';
import { useReportJson } from '../hooks/use-report-json';
import { ReportJsonPanel } from './ReportJsonPanel';
import { LoadingContent } from './LoadingScreen';

import { FileItem } from './Sidebar';

export function AnalysisView() {
  const { state, setActiveFile, openConfigModal } = useApp();
  const isReadOnly = state.isReadOnly ?? false;
  const canRun = state.canRun === true;
  const canDownload = state.canDownload === true;
  const file = state.files.find(f => f.id === state.activeFileId) || state.files[0];
  
  const [exporting, setExporting] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const { width, isDragging, handleMouseDown } = useResizable({ initialWidth: 260, minWidth: 200, maxWidth: 600, direction: 'left' });

  const handleExport = () => {
    setExporting(true);
    setTimeout(() => setExporting(false), 2000);
  };


  const handleShare = () => {
    setSharing(true);
    setTimeout(() => setSharing(false), 2000);
  };

  const handleSync = () => {
    setSyncing(true);
    setTimeout(() => setSyncing(false), 2000);
  };

  const { content: reportContent, loading: reportLoading, error: reportError } = useReportJson(file);

  const totalDetections = file?.detections.length ?? 0;
  const passDetections = file?.detections.filter((d) => d.status === 'PASS').length ?? 0;
  const failDetections = file?.detections.filter((d) => d.status === 'FAIL').length ?? 0;
  const issueDetections = file?.detections.filter((d) => d.status === 'FAIL' || d.status === 'WARN') ?? [];
  const validationRate = totalDetections ? Math.round((passDetections / totalDetections) * 100) : 0;

  return (
    <div className="flex-1 flex bg-[#1e1e1e] overflow-hidden text-[#cccccc] font-sans">
      {/* Left Sidebar - Workspace Files */}
      <div style={{ width }} className="bg-[#1a1a1a] border-r border-[#333333] flex flex-col shrink-0 relative">
        {/* Resizer Handle */}
        <div 
          onMouseDown={handleMouseDown}
          className={cn("absolute top-0 right-[-3px] bottom-0 w-[6px] cursor-col-resize z-50 hover:bg-[#10b981] transition-colors", isDragging && "bg-[#10b981]")}
        />
        <div className="p-4 border-b border-[#333333] flex items-center justify-between">
          <span className="text-[11px] font-bold text-[#858585] uppercase tracking-wider">Project Files</span>
          {!canRun ? null : (
          <button onClick={() => openConfigModal('import')} className="text-[#858585] hover:text-white transition-colors bg-[#252526] p-1 rounded-md border border-[#333333] cursor-pointer">
            <Plus className="w-3.5 h-3.5" />
          </button>
          )}
        </div>
        <div className="flex-1 overflow-y-auto flex flex-col pb-4 text-sm font-sans border-b border-[#333333]">
          {state.files.map((f) => (
            <FileItem 
              key={f.id} 
              file={f} 
              isActive={state.activeFileId === f.id}
              activePage={state.activePage || 1}
              onClick={() => setActiveFile(f.id, 1)}
              onPageClick={(page) => setActiveFile(f.id, page)}
              hideBadge={true}
            />
          ))}
        </div>
        
        <div className="p-4 bg-[#1a1a1a]">
          <div className="flex justify-between items-center mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#858585]">Compliance</span>
            <span className="text-[#2eb886] font-bold text-[12px]">{averagePassRate(state.files).toFixed(1)}%</span>
          </div>
          <div className="h-1 w-full bg-[#3c3c3c] rounded-full overflow-hidden mb-3 flex">
             <div className="h-full bg-[#2eb886]" style={{ width: `${averagePassRate(state.files)}%` }}></div>
             <div className="h-full bg-[#d4b238]" style={{ width: `${100 - averagePassRate(state.files)}%` }}></div>
          </div>
          <div className="grid grid-cols-4 gap-1 text-center">
            <div className="flex flex-col items-center">
              <span className="text-[13px] font-bold text-white">{countFilesByBucket(state.files, 'pass')}</span>
              <span className="text-[9px] font-bold uppercase text-[#858585] mt-0.5">Pass</span>
            </div>
            <div className="flex flex-col items-center">
              <span className="text-[13px] font-bold text-white">{countFilesByBucket(state.files, 'fail')}</span>
              <span className="text-[9px] font-bold uppercase text-[#858585] mt-0.5">Fail</span>
            </div>
            <div className="flex flex-col items-center">
              <span className="text-[13px] font-bold text-white">{countFilesByBucket(state.files, 'noNote')}</span>
              <span className="text-[9px] font-bold uppercase text-[#858585] mt-0.5">No Note</span>
            </div>
            <div className="flex flex-col items-center">
              <span className="text-[13px] font-bold text-white">{state.files.filter(f => f.status === 'ERROR' as any).length}</span>
              <span className="text-[9px] font-bold uppercase text-[#858585] mt-0.5">Err</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto no-scrollbar bg-[#1e1e1e]">
        <div className="flex flex-col min-h-full p-8 relative">
        
        {/* Header */}
        <div className="mb-8 flex items-start justify-between">
          <div>
            <div className="text-[11px] font-semibold text-[#858585] mb-2 flex items-center gap-2 uppercase tracking-wide">
              Workspace <ChevronRight className="w-3 h-3" /> Report <ChevronRight className="w-3 h-3" /> <span className="text-[#cccccc]">{file?.name}</span>
            </div>
            <div className="flex items-center gap-4">
              <h1 className="text-2xl font-bold text-white tracking-tight truncate max-w-[600px]">{file?.name}</h1>
              {file?.status === 'PASS' && (
                <span className="text-[#2eb886] text-[10px] bg-[#2eb886]/10 px-2 py-1 rounded-full border border-[#2eb886]/20 flex items-center gap-1.5 font-bold tracking-wider uppercase">
                  <ShieldCheck className="w-3.5 h-3.5"/> Fully Compliant
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {canDownload && (
            <button onClick={handleExport} className="bg-[#252526] hover:bg-[#2d2d2d] text-white px-4 py-2 rounded-md font-medium text-xs flex items-center gap-2 transition-colors border border-[#3c3c3c]">
              {exporting ? <CheckCircle className="w-4 h-4 text-[#2eb886]" /> : <DownloadCloud className="w-4 h-4" />} {exporting ? 'Exported!' : 'Export Report'}
            </button>
            )}
            <button onClick={handleShare} className="bg-[#10b981] hover:bg-[#059669] text-white px-4 py-2 rounded-md font-medium text-xs flex items-center gap-2 transition-colors shadow-lg shadow-[#10b981]/20 border border-[#10b981]">
              {sharing ? <CheckCircle className="w-4 h-4 text-white" /> : <Share2 className="w-4 h-4" />} {sharing ? 'Link Copied!' : 'Share'}
            </button>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-4 gap-5 mb-8">
          <div className="bg-[#252526] border border-[#3c3c3c] rounded-xl p-5 flex flex-col shadow-sm relative overflow-hidden">
            <div className="absolute -right-3 -top-3 w-16 h-16 bg-[#82aaff]/5 rounded-full blur-xl"></div>
            <div className="flex items-center justify-between mb-4">
              <span className="text-[10px] font-bold text-[#858585] uppercase tracking-wider">Extracted Entities</span>
              <Box className="w-4 h-4 text-[#858585]" />
            </div>
            <span className="text-4xl font-light text-white mb-1">{totalDetections}</span>
            <span className="text-[11px] text-[#858585] font-medium">From latest analysis</span>
          </div>
          
          <div className="bg-[#252526] border border-[#3c3c3c] rounded-xl p-5 flex flex-col shadow-sm relative overflow-hidden">
            <div className="absolute -right-3 -top-3 w-16 h-16 bg-[#2eb886]/5 rounded-full blur-xl"></div>
            <div className="flex items-center justify-between mb-4">
              <span className="text-[10px] font-bold text-[#858585] uppercase tracking-wider">Validation Rate</span>
              <CheckCircle className="w-4 h-4 text-[#2eb886]" />
            </div>
            <span className="text-4xl font-light text-white mb-1">{validationRate}%</span>
            <span className="text-[11px] text-[#858585] font-medium">{passDetections} entities passed</span>
          </div>

          <div className="bg-[#252526] border border-[#3c3c3c] rounded-xl p-5 flex flex-col shadow-sm relative overflow-hidden">
            <div className="absolute -right-3 -top-3 w-16 h-16 bg-[#ef4444]/5 rounded-full blur-xl"></div>
            <div className="flex items-center justify-between mb-4">
              <span className="text-[10px] font-bold text-[#858585] uppercase tracking-wider">Critical Anomalies</span>
              <AlertTriangle className="w-4 h-4 text-[#ef4444]" />
            </div>
            <span className="text-4xl font-light text-white mb-1">{failDetections}</span>
            <span className="text-[11px] text-[#ef4444] font-medium">
              {failDetections > 0 ? 'Needs immediate review' : 'No critical issues'}
            </span>
          </div>

          <div 
            onClick={() => {
              const tooltip = document.createElement('div');
              tooltip.textContent = 'Opening Schedule...';
              tooltip.className = 'fixed bg-[#10b981] text-white text-[10px] px-2 py-1 rounded shadow-lg pointer-events-none z-50 animate-bounce';
              tooltip.style.left = `50%`;
              tooltip.style.top = `50%`;
              document.body.appendChild(tooltip);
              setTimeout(() => {
                tooltip.style.opacity = '0';
                tooltip.style.transition = 'opacity 0.3s';
                setTimeout(() => document.body.removeChild(tooltip), 300);
              }, 1500);
            }}
            className="bg-[#252526] border border-[#3c3c3c] rounded-xl flex items-center justify-center p-5 cursor-pointer hover:bg-[#2a2a2b] transition-colors shadow-sm group"
          >
            <div className="flex flex-col items-center gap-3 text-[#858585] group-hover:text-white transition-colors">
              <FileSpreadsheet className="w-6 h-6 text-[#82aaff]" />
              <span className="text-xs font-semibold">View Master Schedule</span>
            </div>
          </div>
        </div>

        {/* Content Layout */}
        <div className="grid grid-cols-3 gap-6 flex-1 min-h-[400px]">
          
          {/* Left Column: Anomalies & Revit (Takes 1 Col) */}
          <div className="col-span-1 flex flex-col gap-6">
            {/* Revit Panel */}
            <div className="bg-[#252526] border border-[#3c3c3c] rounded-xl flex flex-col shrink-0 shadow-sm relative overflow-hidden">
               <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                 <RefreshCw className="w-24 h-24" />
               </div>
               <div className="p-5 border-b border-[#3c3c3c]">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <div className="w-6 h-6 rounded bg-[#10b981]/10 flex items-center justify-center text-[#10b981]"><RefreshCw className="w-3.5 h-3.5" /></div>
                    Revit Integration
                  </h3>
               </div>
               <div className="p-5 flex flex-col relative z-10">
                 <div className="mb-5">
                   <div className="flex items-center justify-between text-xs mb-1.5">
                     <span className="text-[#858585] font-semibold">Active Session</span>
                     <span className="flex items-center gap-1.5 text-[#2eb886] font-medium"><div className="w-1.5 h-1.5 rounded-full bg-[#2eb886] animate-pulse"></div> Linked</span>
                   </div>
                   <div className="bg-[#1e1e1e] border border-[#3c3c3c] rounded px-3 py-2 text-xs font-bold text-[#cccccc] font-mono shadow-inner">
                     REV-8842-A
                   </div>
                 </div>
                 
                 <div className="space-y-3 mb-6 bg-[#1e1e1e]/50 p-3 rounded-lg border border-[#3c3c3c]/50">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-[#858585]">Target Level</span>
                      <span className="text-[#cccccc] font-medium">Level 1 (0.00m)</span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-[#858585]">Conflict Rule</span>
                      <span className="text-[#cccccc] font-medium">Overwrite</span>
                    </div>
                 </div>

                 <button onClick={handleSync} className={`w-full ${syncing ? 'bg-[#2eb886] hover:bg-[#259b6c]' : 'bg-[#10b981] hover:bg-[#059669] shadow-lg shadow-[#10b981]/20'} text-white py-2.5 rounded-md font-medium text-xs flex items-center justify-center gap-2 transition-colors`}>
                   {syncing ? <CheckCircle className="w-4 h-4" /> : <Database className="w-4 h-4" />} {syncing ? 'Data Synced!' : 'Sync Data to Revit'}
                 </button>
               </div>
            </div>

            {/* Anomalies Summarized */}
            <div className="bg-[#252526] border border-[#3c3c3c] rounded-xl flex flex-col shadow-sm flex-1">
              <div className="p-4 border-b border-[#3c3c3c] flex items-center justify-between">
                 <h3 className="text-sm font-bold text-white flex items-center gap-2">
                   <AlertTriangle className="w-4 h-4 text-[#ef4444]" /> Detected Anomalies
                 </h3>
                 <span className="bg-[#ef4444] text-white text-[10px] font-bold px-2 py-0.5 rounded-full">{issueDetections.length}</span>
              </div>
              <div className="p-2 flex flex-col gap-1 overflow-y-auto">
                {issueDetections.length === 0 ? (
                  <div className="p-3 text-xs text-[#858585]">No anomalies detected.</div>
                ) : issueDetections.map((d) => (
                  <div key={d.id} className="p-3 hover:bg-[#2d2d2d] rounded-lg transition-colors cursor-pointer border border-transparent hover:border-[#3c3c3c]">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-mono text-[#82aaff] font-bold">{d.id}</span>
                      <span className="text-[10px] text-[#858585]">{d.status === 'FAIL' ? 'Validation Failed' : 'Warning'}</span>
                    </div>
                    <p className="text-xs text-[#cccccc] leading-snug">
                      {d.reason || `${d.type} detected at ${(d.confidence * 100).toFixed(0)}% confidence.`}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column: Report JSON (Takes 2 Col) */}
          <div className="col-span-2 flex flex-col min-h-[400px]">
            {reportLoading ? (
              <div className="flex-1 flex items-center justify-center bg-[#252526] border border-[#3c3c3c] rounded-xl">
                <LoadingContent title="Loading report" showProgress={false} spinnerSize="sm" compact textVariant="embed" />
              </div>
            ) : reportContent ? (
              <ReportJsonPanel
                content={reportContent}
                fileName={file?.name}
                fileId={file?.id}
                className="flex-1 min-h-0"
              />
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center bg-[#252526] border border-[#3c3c3c] rounded-xl text-[#858585] gap-2 px-6 text-center">
                <span className="text-sm">Report JSON not available</span>
                {reportError && (
                  <span className="text-[11px] text-[#ef4444] font-mono">{reportError}</span>
                )}
                {!reportError && (
                  <span className="text-[11px]">Run analysis to generate the report artifact.</span>
                )}
              </div>
            )}
          </div>

        </div>
        </div>
      </div>
    </div>
  );
}
