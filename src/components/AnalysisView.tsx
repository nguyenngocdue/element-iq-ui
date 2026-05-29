import React, { useState } from 'react';
import { useApp } from '../store';
import { Download, Share2, ChevronRight, Folder, FileText, CheckCircle, AlertTriangle, FileSpreadsheet, Plus, DownloadCloud, Expand, RefreshCw, Layers, Database, ShieldCheck, Box } from 'lucide-react';
import { cn } from '../lib/utils';

import { FileItem } from './Sidebar';

export function AnalysisView() {
  const { state, setActiveFile } = useApp();
  const file = state.files.find(f => f.id === state.activeFileId) || state.files[0];
  
  const [exporting, setExporting] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [copied, setCopied] = useState(false);

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

  const handleCopy = () => {
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  
  // Safe JSON highlight formatting
  const formattedJson = `[
  {
    <span class="text-[#82aaff]">"type"</span>: <span class="text-[#e06c75]">"StructuralColumn"</span>,
    <span class="text-[#82aaff]">"id"</span>: <span class="text-[#e06c75]">"ext_9921_b"</span>,
    <span class="text-[#82aaff]">"confidence"</span>: <span class="text-[#d19a66]">0.982</span>,
    <span class="text-[#82aaff]">"coordinates"</span>: {
      <span class="text-[#82aaff]">"x"</span>: <span class="text-[#d19a66]">142.55</span>,
      <span class="text-[#82aaff]">"y"</span>: <span class="text-[#d19a66]">-34.12</span>,
      <span class="text-[#82aaff]">"z"</span>: <span class="text-[#d19a66]">0.00</span>
    },
    <span class="text-[#82aaff]">"parameters"</span>: {
      <span class="text-[#82aaff]">"material"</span>: <span class="text-[#e06c75]">"Concrete-Cast-in-Place"</span>,
      <span class="text-[#82aaff]">"load_bearing"</span>: <span class="text-[#c678dd]">true</span>
    }
  },
  {
    <span class="text-[#82aaff]">"type"</span>: <span class="text-[#e06c75]">"LoadBearingWall"</span>,
    <span class="text-[#82aaff]">"id"</span>: <span class="text-[#e06c75]">"ext_9922_c"</span>,
    <span class="text-[#82aaff]">"confidence"</span>: <span class="text-[#d19a66]">0.991</span>,
    <span class="text-[#82aaff]">"coordinates"</span>: { ... }
  }
]`;

  return (
    <div className="flex-1 flex bg-[#1e1e1e] overflow-hidden text-[#cccccc] font-sans">
      {/* Left Sidebar - Workspace Files */}
      <div className="w-[260px] bg-[#1a1a1a] border-r border-[#333333] flex flex-col shrink-0">
        <div className="p-4 border-b border-[#333333] flex items-center justify-between">
          <span className="text-[11px] font-bold text-[#858585] uppercase tracking-wider">Project Files</span>
          <label className="text-[#858585] hover:text-white transition-colors bg-[#252526] p-1 rounded-md border border-[#333333] cursor-pointer">
            <Plus className="w-3.5 h-3.5" />
            <input type="file" multiple accept=".pdf" className="hidden" onChange={(e) => {
               if (e.target.files && e.target.files.length > 0) {
                 useApp.getState().addFiles(Array.from(e.target.files));
               }
            }} />
          </label>
        </div>
        <div className="flex-1 overflow-y-auto flex flex-col pb-4 text-sm font-sans">
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
            <button onClick={handleExport} className="bg-[#252526] hover:bg-[#2d2d2d] text-white px-4 py-2 rounded-md font-medium text-xs flex items-center gap-2 transition-colors border border-[#3c3c3c]">
              {exporting ? <CheckCircle className="w-4 h-4 text-[#2eb886]" /> : <DownloadCloud className="w-4 h-4" />} {exporting ? 'Exported!' : 'Export Report'}
            </button>
            <button onClick={handleShare} className="bg-[#007acc] hover:bg-[#006bb3] text-white px-4 py-2 rounded-md font-medium text-xs flex items-center gap-2 transition-colors shadow-lg shadow-[#007acc]/20 border border-[#007acc]">
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
            <span className="text-4xl font-light text-white mb-1">96</span>
            <span className="text-[11px] text-[#2eb886] font-medium">+12 from previous version</span>
          </div>
          
          <div className="bg-[#252526] border border-[#3c3c3c] rounded-xl p-5 flex flex-col shadow-sm relative overflow-hidden">
            <div className="absolute -right-3 -top-3 w-16 h-16 bg-[#2eb886]/5 rounded-full blur-xl"></div>
            <div className="flex items-center justify-between mb-4">
              <span className="text-[10px] font-bold text-[#858585] uppercase tracking-wider">Validation Rate</span>
              <CheckCircle className="w-4 h-4 text-[#2eb886]" />
            </div>
            <span className="text-4xl font-light text-white mb-1">98%</span>
            <span className="text-[11px] text-[#858585] font-medium">94 entities passed</span>
          </div>

          <div className="bg-[#252526] border border-[#3c3c3c] rounded-xl p-5 flex flex-col shadow-sm relative overflow-hidden">
            <div className="absolute -right-3 -top-3 w-16 h-16 bg-[#ef4444]/5 rounded-full blur-xl"></div>
            <div className="flex items-center justify-between mb-4">
              <span className="text-[10px] font-bold text-[#858585] uppercase tracking-wider">Critical Anomalies</span>
              <AlertTriangle className="w-4 h-4 text-[#ef4444]" />
            </div>
            <span className="text-4xl font-light text-white mb-1">2</span>
            <span className="text-[11px] text-[#ef4444] font-medium">Needs immediate review</span>
          </div>

          <div 
            onClick={() => {
              const tooltip = document.createElement('div');
              tooltip.textContent = 'Opening Schedule...';
              tooltip.className = 'fixed bg-[#007acc] text-white text-[10px] px-2 py-1 rounded shadow-lg pointer-events-none z-50 animate-bounce';
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
                    <div className="w-6 h-6 rounded bg-[#007acc]/10 flex items-center justify-center text-[#007acc]"><RefreshCw className="w-3.5 h-3.5" /></div>
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

                 <button onClick={handleSync} className={`w-full ${syncing ? 'bg-[#2eb886] hover:bg-[#259b6c]' : 'bg-[#007acc] hover:bg-[#006bb3] shadow-lg shadow-[#007acc]/20'} text-white py-2.5 rounded-md font-medium text-xs flex items-center justify-center gap-2 transition-colors`}>
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
                 <span className="bg-[#ef4444] text-white text-[10px] font-bold px-2 py-0.5 rounded-full">2</span>
              </div>
              <div className="p-2 flex flex-col gap-1 overflow-y-auto">
                 <div className="p-3 hover:bg-[#2d2d2d] rounded-lg transition-colors cursor-pointer border border-transparent hover:border-[#3c3c3c]">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-mono text-[#82aaff] font-bold">ext_9921_b</span>
                      <span className="text-[10px] text-[#858585]">Collision</span>
                    </div>
                    <p className="text-xs text-[#cccccc] leading-snug">Load bearing wall overlaps with structural column at spatial coord (142.55, -34.12).</p>
                 </div>
                 <div className="p-3 hover:bg-[#2d2d2d] rounded-lg transition-colors cursor-pointer border border-transparent hover:border-[#3c3c3c]">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-mono text-[#82aaff] font-bold">ext_8810_a</span>
                      <span className="text-[10px] text-[#858585]">Low Confidence</span>
                    </div>
                    <p className="text-xs text-[#cccccc] leading-snug">Confidence score (0.45) below threshold for Foundation material parameter parsing.</p>
                 </div>
              </div>
            </div>
          </div>

          {/* Right Column: JSON Result (Takes 2 Col) */}
          <div className="col-span-2 bg-[#252526] border border-[#3c3c3c] rounded-xl flex flex-col overflow-hidden shadow-sm">
            <div className="p-3 border-b border-[#3c3c3c] flex items-center justify-between bg-[#1e1e1e]">
              <div className="flex items-center gap-3">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-[#ef4444]/80"></div>
                  <div className="w-3 h-3 rounded-full bg-[#d4b238]/80"></div>
                  <div className="w-3 h-3 rounded-full bg-[#2eb886]/80"></div>
                </div>
                <div className="h-4 w-px bg-[#3c3c3c] mx-1"></div>
                <span className="text-[#e5c07b] font-bold text-xs">{`{ }`}</span>
                <span className="text-xs font-medium text-[#858585] font-mono tracking-wide">extracted_data.json</span>
              </div>
              <div className="flex items-center gap-3 text-[#858585]">
                <button onClick={handleCopy} className={`transition-colors flex items-center gap-1 ${copied ? 'text-[#2eb886]' : 'hover:text-white'}`} title="Copy JSON">
                  {copied ? <CheckCircle className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
                </button>
                <button className="hover:text-white transition-colors" title="Expand View"><Expand className="w-4 h-4" /></button>
              </div>
            </div>
            
            <div className="bg-[#1e1e1e] border-b border-[#3c3c3c] p-3 text-[10px] text-[#858585] flex items-center gap-4 font-mono">
               <div className="flex items-center gap-2"><span className="text-[#82aaff]">engine:</span> ElementIQ-v2.5</div>
               <div className="flex items-center gap-2"><span className="text-[#82aaff]">document_id:</span> {file?.id || 'doc_883'}</div>
               <div className="flex items-center gap-2"><span className="text-[#82aaff]">encoding:</span> UTF-8</div>
            </div>

            <div className="flex-1 p-5 overflow-auto relative bg-[#1e1e1e]">
              <div className="absolute left-0 top-0 bottom-0 w-12 bg-[#1e1e1e] border-r border-[#3c3c3c] flex flex-col items-center py-5 text-[#555] font-mono text-[11px] select-none">
                {Array.from({length: 22}).map((_, i) => <div key={i} className="h-6 flex items-center justify-center">{i + 1}</div>)}
              </div>
              <div className="pl-14">
                <pre className="text-[13px] font-mono leading-6 text-[#b4c5ff] m-0">
                  <code dangerouslySetInnerHTML={{ __html: formattedJson }} />
                </pre>
              </div>
            </div>
          </div>

        </div>
        </div>
      </div>
    </div>
  );
}
