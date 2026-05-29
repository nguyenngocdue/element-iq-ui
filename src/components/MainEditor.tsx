import React, { useEffect, useRef, useState } from 'react';
import { useApp } from '../store';
import { ZoomIn, ZoomOut, Move, Download, Share2, Play, RefreshCw, X, ShieldCheck, ScanFace } from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.mjs`;

function ParsingOverlay({ fileName, pages }: { fileName: string, pages: number }) {
  const [progress, setProgress] = useState(0);
  const [logs, setLogs] = useState<{msg: string, type: 'info'|'debug'|'success'}[]>([]);

  useEffect(() => {
    let isMounted = true;
    const addLog = (msg: string, type: 'info'|'debug'|'success', delay: number) => {
      setTimeout(() => {
        if (isMounted) {
          const timeStr = new Date().toLocaleTimeString('en-US', {hour12: false});
          setLogs(prev => [...prev, {msg: `[${timeStr}] ${type.toUpperCase()}: ${msg}`, type}]);
        }
      }, delay);
    };

    addLog(`Initializing parser for ${fileName}`, 'info', 100);
    addLog(`Found ${pages} pages.`, 'info', 500);
    addLog(`Extracting text layer (pages 1-${Math.min(10, pages)})... DONE`, 'debug', 1200);
    addLog(`Scanning structural boundaries...`, 'debug', 2200);
    addLog(`Identified nested tables on pages.`, 'success', 3200);

    const int = setInterval(() => {
      if (!isMounted) return;
      setProgress(p => {
        const next = p + Math.random() * 8;
        return next > 99 ? 99 : next;
      });
    }, 300);

    return () => {
      isMounted = false;
      clearInterval(int);
    };
  }, [fileName, pages]);

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-[2px] font-sans">
      <div className="bg-[#252526] border border-[#3c3c3c] rounded-xl shadow-2xl w-[460px] overflow-hidden text-sm flex flex-col relative z-10">
         <div className="p-5 border-b border-[#3c3c3c] flex items-center justify-between bg-[#1e1e1e]">
           <div className="flex items-center gap-3">
             <div className="text-[#82aaff]"><ScanFace className="w-6 h-6" /></div>
             <h3 className="text-white font-bold text-lg font-sans leading-tight">Parsing Document<br/>Structure</h3>
           </div>
           <div className="bg-[#1e1e1e] border border-[#3c3c3c] px-3 py-1.5 text-[10px] font-black tracking-widest text-[#82aaff] rounded bg-[#82aaff]/10 uppercase text-right leading-none">IN<br/>PROGRESS</div>
         </div>

         <div className="p-5 flex flex-col gap-4">
           {/* Current Op & Engine */}
           <div className="grid grid-cols-2 gap-3">
             <div className="bg-[#1e1e1e] border border-[#3c3c3c] rounded px-3 py-2">
               <div className="text-[#a0a5b5] text-[10px] font-bold tracking-widest uppercase mb-1">Current Operation</div>
               <div className="text-white font-semibold text-xs truncate">Table Extraction</div>
             </div>
             <div className="bg-[#1e1e1e] border border-[#3c3c3c] rounded px-3 py-2">
               <div className="text-[#a0a5b5] text-[10px] font-bold tracking-widest uppercase mb-1">Engine</div>
               <div className="text-white font-semibold text-xs truncate">ML_Vision_v2</div>
             </div>
           </div>

           {/* Progress */}
           <div>
             <div className="flex justify-between items-end mb-2">
               <div className="text-white text-xs font-semibold">Processing page {Math.min(pages, Math.ceil((progress / 100) * pages))} of {pages}...</div>
               <div className="text-[#a0a5b5] text-xs font-mono">{Math.round(progress)}%</div>
             </div>
             <div className="w-full bg-[#1e1e1e] rounded-full h-1.5 relative overflow-hidden border border-[#3c3c3c]">
               <div className="bg-[#82aaff] h-full transition-all duration-300" style={{ width: `${progress}%` }}></div>
             </div>
           </div>

           {/* Terminal Logs */}
           <div className="bg-[#1e1e1e] border border-[#3c3c3c] rounded p-3 font-mono text-[10px] flex flex-col gap-1.5 h-[130px] overflow-y-auto">
             {logs.map((log, i) => (
                <div key={i} className={
                  log.type === 'info' ? 'text-[#a0a5b5]' : 
                  log.type === 'debug' ? 'text-[#858585]' : 
                  'text-[#22c55e] font-bold'
                }>
                  {log.msg}
                </div>
             ))}
             <div className="text-[#a0a5b5] animate-pulse">&gt; Scanning page for structural boundaries..._</div>
           </div>
         </div>

         <div className="p-4 border-t border-[#3c3c3c] bg-[#1e1e1e] flex justify-end gap-3">
           <button onClick={() => {}} className="text-[#a0a5b5] hover:text-white px-3 py-1.5 text-xs font-semibold transition-colors">Pause</button>
           <button onClick={() => { useApp.getState().closeFile(useApp.getState().activeFileId!); }} className="bg-[#3c3c3c] hover:bg-[#4d4d4d] text-white px-4 py-1.5 text-xs font-semibold rounded transition-colors">Cancel Analysis</button>
         </div>
      </div>
    </div>
  );
}

export function MainEditor() {
  const { state, analyzeFile, setActiveFile, closeFile } = useApp();
  const file = state.files.find(f => f.id === state.activeFileId);
  const [scale, setScale] = useState(1);
  const [showAnnotations, setShowAnnotations] = useState(true);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const renderTaskRef = useRef<any>(null);

  useEffect(() => {
    if (!file || !file.file || !canvasRef.current) return;

    let isMounted = true;

    const renderPdf = async () => {
      try {
        const arrayBuffer = await file.file.arrayBuffer();
        if (!isMounted) return;
        const typedarray = new Uint8Array(arrayBuffer);
        const loadingTask = pdfjsLib.getDocument({ data: typedarray });
        const pdf = await loadingTask.promise;
        if (!isMounted) return;
        const page = await pdf.getPage(state.activePage || 1); // Render selected page
        if (!isMounted) return;

        const viewport = page.getViewport({ scale: scale * 1.5 }); // Base scale up for clarity
        const canvas = canvasRef.current;
        if (!canvas) return;
        
        const context = canvas.getContext('2d');
        if (!context) return;

        canvas.height = viewport.height;
        canvas.width = viewport.width;

        const renderContext = {
          canvasContext: context,
          viewport: viewport,
        } as any;

        if (renderTaskRef.current) {
          try {
            renderTaskRef.current.cancel();
          } catch (e) {}
        }

        const renderTask = page.render(renderContext);
        renderTaskRef.current = renderTask;
        await renderTask.promise;
      } catch (err: any) {
        if (err.name !== 'RenderingCancelledException') {
          console.error("PDF Render Error", err);
        }
      }
    };

    renderPdf();

    return () => {
      isMounted = false;
      if (renderTaskRef.current) {
        try {
          renderTaskRef.current.cancel();
        } catch(e) {}
      }
    };
  }, [file?.file, scale, state.activePage]);

  if (!file) {
    return (
      <div className="flex-1 bg-editor-bg flex items-center justify-center text-muted flex-col relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '24px 24px' }}></div>
        <div className="w-64 h-64 border-2 border-dashed border-panel-border rounded-lg flex flex-col items-center justify-center text-center p-6 bg-sidebar-bg">
           <svg className="w-12 h-12 mb-4 text-[#007acc]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path></svg>
           <h3 className="text-white font-semibold mb-2 text-sm">Welcome to Element IQ</h3>
           <p className="text-xs mb-4">Select a file from the workspace or import new drawings to begin analysis.</p>
           <label className="bg-[#007acc] text-white px-4 py-2 rounded text-[13px] font-semibold cursor-pointer hover:bg-[#0062a3] shadow-lg transition-colors border border-[#007acc]">
              Import Drawings
              <input type="file" multiple accept=".pdf" className="hidden" onChange={(e) => {
                if (e.target.files && e.target.files.length > 0) {
                  useApp.getState().addFiles(Array.from(e.target.files));
                }
              }} />
           </label>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-editor-bg flex flex-col relative overflow-hidden text-[#cccccc]">
      {/* Editor Tabs */}
      <div className="h-[35px] bg-[#252526] flex items-center shrink-0 overflow-x-auto no-scrollbar">
        {state.openFiles.map(fid => {
          const f = state.files.find(f => f.id === fid);
          if (!f) return null;
          const isActive = fid === state.activeFileId;
          return (
            <div 
              key={fid}
              onClick={() => setActiveFile(fid, 1)}
              className={`px-3 h-full flex items-center border-r border-[#252526] text-[13px] gap-2 group cursor-pointer min-w-[120px] max-w-[200px] select-none ${isActive ? 'bg-[#1e1e1e] text-[#4ec9b0] italic border-t-2 border-t-[#007acc]' : 'bg-[#2d2d2d] text-[#969696] hover:bg-[#252526] hover:text-white border-t-2 border-t-transparent'}`}
            >
              <span className="truncate flex-1">{f.name}</span>
              <button 
                onClick={(e) => { e.stopPropagation(); closeFile(fid); }}
                className={`flex-shrink-0 w-5 h-5 flex items-center justify-center rounded-sm hover:bg-white/10 ${isActive ? 'text-[#4ec9b0]' : 'text-transparent group-hover:text-[#969696] hover:!text-white'}`}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
      </div>

      {/* Editor Toolbar */}
      <div className="h-[40px] border-b border-[#3c3c3c] flex items-center justify-between px-4 shrink-0 bg-[#1e1e1e]">
        <div className="flex items-center gap-4">
          <div className="flex items-center bg-[#252526] rounded border border-[#3c3c3c]">
            <button onClick={() => setScale(s => Math.max(0.1, s - 0.25))} className="px-2 py-1 border-r border-[#3c3c3c] hover:bg-[#333] text-muted hover:text-white">−</button>
            <span className="px-3 text-[11px] font-mono">{Math.round(scale * 100)}%</span>
            <button onClick={() => setScale(s => Math.min(3, s + 0.25))} className="px-2 py-1 border-l border-[#3c3c3c] hover:bg-[#333] text-muted hover:text-white">+</button>
          </div>

          <div className="flex items-center gap-2">
            <button className="p-1 hover:bg-[#3c3c3c] rounded text-muted hover:text-white"><Move className="w-4 h-4" /></button>
            <button 
              onClick={() => setShowAnnotations(!showAnnotations)}
              className={`flex items-center gap-1.5 px-2 py-1 rounded text-[11px] border ${showAnnotations ? 'bg-[#37373d] border-[#007acc] text-white' : 'bg-transparent border-[#3c3c3c] text-muted hover:text-white'}`}
            >
              <ShieldCheck className="w-3 h-3" /> QA Overlay
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3 text-[11px]">
          {file.status === 'PENDING' ? (
            <button onClick={() => analyzeFile(file.id)} className="text-[#007acc] font-medium hover:underline flex items-center gap-1">
               Start Analysis
            </button>
          ) : file.status === 'ANALYZING' ? (
            <button disabled className="text-muted font-medium flex items-center gap-1">
               <RefreshCw className="w-3 h-3 animate-spin" /> Scanning...
            </button>
          ) : (
            <button onClick={() => analyzeFile(file.id)} className="text-[#007acc] font-medium hover:underline flex items-center gap-1">
               Re-analyze
            </button>
          )}
          <button 
            onClick={(e) => {
              const rect = (e.currentTarget as HTMLButtonElement).getBoundingClientRect();
              const tooltip = document.createElement('div');
              tooltip.textContent = 'Exported!';
              tooltip.className = 'fixed bg-[#2eb886] text-white text-[10px] px-2 py-1 rounded shadow-lg pointer-events-none z-50 animate-bounce';
              tooltip.style.left = `${rect.left}px`;
              tooltip.style.top = `${rect.bottom + 8}px`;
              document.body.appendChild(tooltip);
              setTimeout(() => {
                tooltip.style.opacity = '0';
                tooltip.style.transition = 'opacity 0.3s';
                setTimeout(() => document.body.removeChild(tooltip), 300);
              }, 1500);
            }}
            className="bg-white/5 hover:bg-white/10 px-3 py-1 rounded border border-[#3c3c3c] text-white"
          >
            Export
          </button>
        </div>
      </div>

      {/* Canvas Viewport */}
      <div className="flex-1 overflow-auto bg-[#121212] relative flex items-center justify-center p-8 no-scrollbar">
         {file.status === 'ANALYZING' && (
           <>
             <ParsingOverlay fileName={file.name} pages={file.pages} />
             <div className="absolute top-0 left-0 w-full h-[4px] bg-[#2eb886] shadow-[0_0_30px_5px_rgba(46,184,134,0.6),0_0_15px_2px_rgba(46,184,134,0.8)] animate-scan z-40 pointer-events-none" />
           </>
         )}

         <div className="relative shadow-2xl transition-transform origin-center border border-[#444]" style={{ transform: `scale(${scale})` }}>
            <canvas ref={canvasRef} className="block bg-white max-w-none" />
            
            {showAnnotations && file.detections.filter(d => d.page === (state.activePage || 1)).map(d => {
              // Map simulated detection coordinates somewhat to the scaled canvas.
              // In a real app we'd map coordinates properly based on native PDF dimensions.
              // For demonstration we render them using absolute pos based on the canvas dimensions
              return (
                <div 
                  key={d.id}
                  className={`absolute border-2 pointer-events-none rounded-[2px] ${d.type === 'NF' ? 'border-nf-pass' : d.type === 'FF' ? 'border-ff-fail' : 'border-warning'}`}
                  style={{
                    left: `${d.x}px`,
                    top: `${d.y}px`,
                    width: `${d.width}px`,
                    height: `${d.height}px`,
                    backgroundColor: d.type === 'NF' ? 'rgba(34,197,94,0.1)' : d.type === 'FF' ? 'rgba(239,68,68,0.1)' : 'rgba(245,158,11,0.1)'
                  }}
                >
                  <div className={`absolute -top-5 -left-0.5 px-1 py-0.5 text-[9px] whitespace-nowrap font-bold text-white rounded-t-sm ${d.type === 'NF' ? 'bg-[#22c55e]' : d.type === 'FF' ? 'bg-[#ef4444]' : 'bg-[#f59e0b]'}`}>
                    {d.type} {(d.confidence * 100).toFixed(0)}%
                  </div>
                </div>
              );
            })}
         </div>
      </div>

      {/* Footer Status */}
      <div className="absolute py-1 px-3 bg-editor-bg border border-panel-border bottom-4 right-4 text-xs font-mono rounded shadow-lg flex items-center gap-3">
        <span className="text-muted">PAGE {state.activePage || 1}/{file.pages}</span>
        <span className="w-1 h-1 bg-muted rounded-full"></span>
        <span className="text-active">{file.status}</span>
        <span className="w-1 h-1 bg-muted rounded-full"></span>
        <span className="text-nf-pass">{file.detections.length} ANNOTATIONS</span>
      </div>
    </div>
  );
}
