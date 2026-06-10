import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useApp } from '../store';
import { usePerViewZoom, zoomKeyForArtifact, zoomKeyForFile } from '../hooks/usePerViewZoom';
import { ReportJsonPanel } from './ReportJsonPanel';
import { ViewSplitOverlay } from './ViewSplitOverlay';
import { useViewSplit } from '../hooks/use-view-split';
import { ANALYSIS_TO_PDF_UNIT } from '../lib/viewSplit';
import { analysisOperationFromProgress, ELEMENTIQ_ENGINE } from '../lib/engineBranding';
import { ZoomIn, ZoomOut, Move, Download, Share2, Play, RefreshCw, X, ShieldCheck, ScanFace, MessageSquare, Brain, PanelRight, Pin, MousePointer2, Hand, Search, Split, Maximize, Terminal, Columns2 } from 'lucide-react';
import { artifactDisplayName, artifactIconMeta } from '../lib/fileView';
import { cn } from '../lib/utils';
import * as pdfjsLib from 'pdfjs-dist';

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.mjs`;

function ParsingOverlay({ fileName, pages, progress: realProgress, stage }: {
  fileName: string;
  pages: number;
  progress?: number;
  stage?: string;
}) {
  const { state, closeFile } = useApp();
  const [logs, setLogs] = useState<{msg: string, type: 'info'|'debug'|'success'}[]>([]);
  const progress = realProgress ?? 0;

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

    addLog(`Initializing analysis for ${fileName}`, 'info', 100);
    addLog(`Found ${pages} pages.`, 'info', 500);
    addLog(`Sending to ${ELEMENTIQ_ENGINE}…`, 'debug', 1000);

    return () => { isMounted = false; };
  }, [fileName, pages]);

  // Add log entry when stage changes
  useEffect(() => {
    if (!stage) return;
    const timeStr = new Date().toLocaleTimeString('en-US', {hour12: false});
    setLogs(prev => {
      const last = prev[prev.length - 1]?.msg ?? '';
      if (last.includes(stage)) return prev;
      return [...prev, { msg: `[${timeStr}] INFO: ${stage}`, type: 'info' }];
    });
  }, [stage]);

  const operationLabel = analysisOperationFromProgress(progress);

  const selectedComps = state.selectedComponents.length > 0 ? state.selectedComponents : ['grout-tube'];

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 backdrop-blur-[3px] font-sans">
      <div className="bg-[#252526] border border-[#3c3c3c] rounded-xl shadow-2xl w-[460px] overflow-hidden text-sm flex flex-col relative">
         <div className="p-5 border-b border-[#3c3c3c] flex items-center justify-between bg-[#1e1e1e]">
           <div className="flex items-center gap-3">
             <div className="text-[#82aaff]"><ScanFace className="w-6 h-6" /></div>
             <h3 className="text-white font-bold text-lg font-sans leading-tight">ElementIQ Analysis<br/><span className="text-[#82aaff] text-sm font-normal">{ELEMENTIQ_ENGINE}</span></h3>
           </div>
           <div className="bg-[#1e1e1e] border border-[#3c3c3c] px-3 py-1.5 text-[10px] font-black tracking-widest text-[#82aaff] rounded bg-[#82aaff]/10 uppercase text-right leading-none">IN<br/>PROGRESS</div>
         </div>

         <div className="p-5 flex flex-col gap-4">
           {/* Current Op & Engine */}
           <div className="grid grid-cols-2 gap-3">
             <div className="bg-[#1e1e1e] border border-[#3c3c3c] rounded px-3 py-2">
               <div className="text-[#a0a5b5] text-[10px] font-bold tracking-widest uppercase mb-1">Current Operation</div>
               <div className="text-white font-semibold text-xs truncate">{operationLabel}</div>
             </div>
             <div className="bg-[#1e1e1e] border border-[#3c3c3c] rounded px-3 py-2">
               <div className="text-[#a0a5b5] text-[10px] font-bold tracking-widest uppercase mb-1">Engine</div>
               <div className="text-white font-semibold text-xs truncate">{ELEMENTIQ_ENGINE}</div>
             </div>
           </div>

           {/* Progress — real value from backend */}
           <div>
             <div className="flex justify-between items-end mb-1">
               <div className="text-[#a0a5b5] text-[10px] font-bold tracking-widest uppercase">Config</div>
             </div>
             <div className="bg-[#1e1e1e] border border-[#3c3c3c] rounded px-3 py-2 text-[11px] space-y-0.5">
               {selectedComps.map((compId) => {
                 const meta = state.availableComponents.find((c) => c.id === compId);
                 const conf = ((state.componentConfidence[compId] ?? state.confidenceThreshold) * 100).toFixed(0);
                 return (
                   <div key={compId} className="space-y-0.5 pb-1 last:pb-0 border-b border-[#3c3c3c]/40 last:border-0">
                     <div className="flex justify-between gap-2">
                       <span className="text-[#858585] shrink-0">Component:</span>
                       <span className="text-white font-mono truncate">{meta?.name ?? compId}</span>
                     </div>
                     <div className="flex justify-between gap-2">
                       <span className="text-[#858585] shrink-0">Model:</span>
                       <span className="text-[#82aaff] font-mono truncate" title={meta?.modelFile}>{meta?.modelFile || '—'}</span>
                     </div>
                     <div className="flex justify-between gap-2">
                       <span className="text-[#858585] shrink-0">Confidence:</span>
                       <span className="text-white font-mono">{conf}%</span>
                     </div>
                   </div>
                 );
               })}
               <div className="flex justify-between pt-1"><span className="text-[#858585]">File:</span><span className="text-white truncate ml-2">{fileName}</span></div>
             </div>
           </div>

           <div>
             <div className="flex justify-between items-end mb-2">
               <div className="text-white text-xs font-semibold">{stage ?? 'Initializing...'}</div>
               <div className="text-[#a0a5b5] text-xs font-mono">{Math.round(progress)}%</div>
             </div>
             <div className="w-full bg-[#1e1e1e] rounded-full h-1.5 relative overflow-hidden border border-[#3c3c3c]">
               <div className="bg-[#82aaff] h-full transition-all duration-500" style={{ width: `${progress}%` }}></div>
             </div>
           </div>

           {/* Terminal Logs */}
           <div className="bg-[#1e1e1e] border border-[#3c3c3c] rounded p-3 font-mono text-[10px] flex flex-col gap-1.5 h-[130px] overflow-y-auto">
             {logs.map((log, i) => (
                <div key={i} className={
                  log.type === 'info'    ? 'text-[#a0a5b5]' :
                  log.type === 'debug'   ? 'text-[#858585]' :
                                           'text-[#22c55e] font-bold'
                }>
                  {log.msg}
                </div>
             ))}
             {progress < 100 && (
               <div className="text-[#a0a5b5] animate-pulse">&gt; {stage ?? `Waiting for ${ELEMENTIQ_ENGINE}…`}_</div>
             )}
           </div>
         </div>

         <div className="p-4 border-t border-[#3c3c3c] bg-[#1e1e1e] flex justify-end gap-3">
           <button
             onClick={() => { closeFile(state.activeFileId!); }}
             className="bg-[#3c3c3c] hover:bg-[#4d4d4d] text-white px-4 py-1.5 text-xs font-semibold rounded transition-colors"
           >
             Cancel Analysis
           </button>
         </div>
      </div>
    </div>,
    document.body,
  );
}

function PdfRenderer({
  file,
  pageNum,
  scale,
  showAnnotations,
  showViewSplitOverlay,
  viewSplit,
  onDimensionsLoaded,
}: {
  file: any;
  pageNum: number;
  scale: number;
  showAnnotations: boolean;
  showViewSplitOverlay?: boolean;
  viewSplit?: import('../lib/viewSplit').ParsedViewSplit | null;
  onDimensionsLoaded?: (w: number, h: number) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [renderScale, setRenderScale] = useState(scale);
  const [baseSize, setBaseSize] = useState({ w: 0, h: 0 });
  const renderTaskRef = useRef<any>(null);

  useEffect(() => {
    const t = setTimeout(() => setRenderScale(scale), 150);
    return () => clearTimeout(t);
  }, [scale]);

  useEffect(() => {
    if (!file || !file.file || !canvasRef.current) return;
    if (file.file.size === 0) return; // Not yet downloaded — skip render

    let isMounted = true;

    const renderPdf = async () => {
      try {
        const arrayBuffer = await file.file.arrayBuffer();
        if (!isMounted) return;
        const typedarray = new Uint8Array(arrayBuffer);
        const loadingTask = pdfjsLib.getDocument({ data: typedarray });
        const pdf = await loadingTask.promise;
        if (!isMounted) return;
        const page = await pdf.getPage(pageNum || 1);
        if (!isMounted) return;

        const baseViewport = page.getViewport({ scale: 1 });
        setBaseSize({ w: baseViewport.width, h: baseViewport.height });
        if (onDimensionsLoaded) onDimensionsLoaded(baseViewport.width, baseViewport.height);

        const viewport = page.getViewport({ scale: renderScale * 2 }); // Render at 2x resolution for sharpness
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
  }, [file?.file, renderScale, pageNum]);

  // Show loading state when file not yet downloaded
  if (file.file.size === 0) {
    return (
      <div className="relative shadow-2xl origin-top-left border border-[#444] bg-[#1e1e1e] flex items-center justify-center" style={{ width: 600, height: 400 }}>
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-[#10b981] border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm text-[#858585]">Loading PDF...</p>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="relative shadow-2xl origin-top-left border border-[#444]" 
      style={{ 
        width: baseSize.w ? baseSize.w * scale : 'auto', 
        height: baseSize.h ? baseSize.h * scale : 'auto'
      }}
    >
      <canvas 
        ref={canvasRef} 
        className="block bg-white" 
        style={{ width: '100%', height: '100%' }}
      />

      
      {showAnnotations && file.detections && file.detections.filter((d: any) => d.page === (pageNum || 1)).map((d: any) => (
        <div 
          key={d.id}
          className={`absolute border-2 pointer-events-none rounded-[2px] z-10 ${d.type === 'NF' ? 'border-nf-pass' : d.type === 'FF' ? 'border-ff-fail' : 'border-warning'}`}
          style={{
            left: `${d.x * scale}px`,
            top: `${d.y * scale}px`,
            width: `${d.width * scale}px`,
            height: `${d.height * scale}px`,
            backgroundColor: d.type === 'NF' ? 'rgba(34,197,94,0.1)' : d.type === 'FF' ? 'rgba(239,68,68,0.1)' : 'rgba(245,158,11,0.1)'
          }}
        >
          <div className={`absolute -top-5 -left-0.5 px-1 py-0.5 text-[9px] whitespace-nowrap font-bold text-white rounded-t-sm ${d.type === 'NF' ? 'bg-[#22c55e]' : d.type === 'FF' ? 'bg-[#ef4444]' : 'bg-[#f59e0b]'}`}>
            {d.type} {(d.confidence * 100).toFixed(0)}%
          </div>
        </div>
      ))}

      {showViewSplitOverlay && viewSplit && baseSize.w > 0 ? (
        <ViewSplitOverlay
          split={viewSplit}
          viewerWidth={baseSize.w}
          viewerHeight={baseSize.h}
          viewerScale={scale}
          unitScale={ANALYSIS_TO_PDF_UNIT}
        />
      ) : null}
    </div>
  );
}

function ArtifactViewer({
  artifact,
  onClose,
  scale,
  toolMode,
  onScaleChange,
  onImageDimensions,
  viewSplit,
  showViewSplitOverlay = true,
}: {
  artifact: { id: string; type: string; downloadUrl: string; name: string };
  onClose: () => void;
  scale: number;
  toolMode: string;
  onScaleChange: (s: number) => void;
  onImageDimensions?: (w: number, h: number) => void;
  viewSplit?: import('../lib/viewSplit').ParsedViewSplit | null;
  showViewSplitOverlay?: boolean;
}) {
  const [content, setContent] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const imgRef = React.useRef<HTMLImageElement>(null);
  const isDragging = React.useRef(false);
  const isDrawingZoom = React.useRef(false);
  const startDragPos = React.useRef({ x: 0, y: 0 });
  const startScrollPos = React.useRef({ left: 0, top: 0 });
  const [zoomRect, setZoomRect] = React.useState<{ x: number, y: number, w: number, h: number } | null>(null);
  const [imgNaturalSize, setImgNaturalSize] = React.useState<{ w: number, h: number }>({ w: 0, h: 0 });

  React.useEffect(() => {
    let objectUrl: string | null = null;
    let cancelled = false;

    (async () => {
      setLoading(true);
      setLoadError(null);
      setContent(null);
      try {
        const { authFetch } = await import('../lib/supabase');
        const res = await authFetch(artifact.downloadUrl);
        if (cancelled) return;
        if (!res.ok) {
          const detail = await res.text().catch(() => '');
          let message = `HTTP ${res.status}`;
          try {
            const parsed = JSON.parse(detail);
            if (parsed.detail) message = typeof parsed.detail === 'string' ? parsed.detail : message;
          } catch {
            if (detail) message = detail.slice(0, 160);
          }
          setLoadError(message);
          return;
        }
        if (artifact.type === 'REPORT_JSON') {
          setContent(await res.text());
        } else {
          const blob = await res.blob();
          objectUrl = URL.createObjectURL(blob);
          setContent(objectUrl);
        }
      } catch (err) {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : String(err));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [artifact.id, artifact.downloadUrl, artifact.type]);

  // Ctrl+Wheel zoom for PNG
  React.useEffect(() => {
    const el = containerRef.current;
    if (!el || artifact.type !== 'ANNOTATED_PNG') return;

    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        e.stopPropagation();
        const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
        const nextScale = Math.min(4, Math.max(0.1, scale * zoomFactor));
        onScaleChange(nextScale);
      }
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [artifact.type, scale, onScaleChange]);

  const handleImgLoad = () => {
    if (imgRef.current) {
      const w = imgRef.current.naturalWidth;
      const h = imgRef.current.naturalHeight;
      setImgNaturalSize({ w, h });
      if (onImageDimensions) onImageDimensions(w, h);
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!containerRef.current) return;
    if (toolMode === 'pan') {
      isDragging.current = true;
      startDragPos.current = { x: e.clientX, y: e.clientY };
      startScrollPos.current = { left: containerRef.current.scrollLeft, top: containerRef.current.scrollTop };
      containerRef.current.style.cursor = 'grabbing';
    } else if (toolMode === 'zoom') {
      isDrawingZoom.current = true;
      startDragPos.current = { x: e.clientX, y: e.clientY };
      setZoomRect({ x: e.clientX, y: e.clientY, w: 0, h: 0 });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!containerRef.current) return;
    if (isDragging.current) {
      const dx = e.clientX - startDragPos.current.x;
      const dy = e.clientY - startDragPos.current.y;
      containerRef.current.scrollLeft = startScrollPos.current.left - dx;
      containerRef.current.scrollTop = startScrollPos.current.top - dy;
    } else if (isDrawingZoom.current) {
      setZoomRect({
        x: Math.min(startDragPos.current.x, e.clientX),
        y: Math.min(startDragPos.current.y, e.clientY),
        w: Math.abs(e.clientX - startDragPos.current.x),
        h: Math.abs(e.clientY - startDragPos.current.y)
      });
    }
  };

  const handleMouseUp = () => {
    if (isDragging.current) {
      isDragging.current = false;
      if (containerRef.current) containerRef.current.style.cursor = '';
    } else if (isDrawingZoom.current && zoomRect && containerRef.current) {
      isDrawingZoom.current = false;
      if (zoomRect.w > 20 && zoomRect.h > 20) {
        const container = containerRef.current;
        const paneRect = container.getBoundingClientRect();
        
        // Calculate the center of the zoom rect in content coordinates
        const zoomCenterX = (zoomRect.x + zoomRect.w / 2) - paneRect.left + container.scrollLeft;
        const zoomCenterY = (zoomRect.y + zoomRect.h / 2) - paneRect.top + container.scrollTop;
        
        // Calculate new scale
        const scaleX = paneRect.width / zoomRect.w;
        const scaleY = paneRect.height / zoomRect.h;
        const scaleMultiplier = Math.min(scaleX, scaleY);
        const prevScale = scale;
        const nextScale = Math.min(4, Math.max(0.1, scale * scaleMultiplier));
        onScaleChange(nextScale);
        
        // After scale change, scroll to center on the selected area
        setTimeout(() => {
          const ratio = nextScale / prevScale;
          container.scrollLeft = zoomCenterX * ratio - paneRect.width / 2;
          container.scrollTop = zoomCenterY * ratio - paneRect.height / 2;
        }, 10);
      }
      setZoomRect(null);
    }
  };

  // Compute rendered image size
  const imgWidth = imgNaturalSize.w > 0 ? imgNaturalSize.w * scale : undefined;
  const imgHeight = imgNaturalSize.h > 0 ? imgNaturalSize.h * scale : undefined;

  return (
    <div className="flex-1 overflow-hidden bg-[#121212] flex flex-col relative">
      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-[#10b981] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : artifact.type === 'ANNOTATED_PNG' && content ? (
        <div 
          ref={containerRef}
          data-artifact-container=""
          className={`flex-1 overflow-auto bg-[#0a0a0a] ${toolMode === 'pan' ? 'cursor-grab' : toolMode === 'zoom' ? 'cursor-crosshair' : ''}`}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          <div 
            className="relative flex items-center justify-center"
            style={{ 
              minWidth: '100%', 
              minHeight: '100%',
              width: imgWidth && imgWidth > (containerRef.current?.clientWidth || 0) ? imgWidth + 64 : '100%',
              height: imgHeight && imgHeight > (containerRef.current?.clientHeight || 0) ? imgHeight + 64 : '100%',
              padding: 32,
            }}
          >
            <div className="relative shrink-0">
              <img 
                ref={imgRef}
                src={content} 
                alt="Annotated"
                draggable={false}
                onLoad={handleImgLoad}
                style={{ 
                  width: imgWidth || 'auto',
                  height: imgHeight || 'auto',
                  maxWidth: 'none',
                  userSelect: 'none',
                  display: 'block',
                }}
              />
              {showViewSplitOverlay && viewSplit && imgNaturalSize.w > 0 ? (
                <ViewSplitOverlay
                  split={viewSplit}
                  viewerWidth={imgNaturalSize.w}
                  viewerHeight={imgNaturalSize.h}
                  viewerScale={scale}
                  unitScale={1}
                />
              ) : null}
            </div>
          </div>
        </div>
      ) : (artifact.type === 'ANNOTATED_PDF') && content ? (
        <div className="flex-1 overflow-hidden flex items-center justify-center bg-[#0a0a0a] relative">
          <iframe src={`${content}#page=1&view=Fit`} className="w-full h-full border-0" style={{ minHeight: 'calc(100vh - 80px)' }} />
        </div>
      ) : artifact.type === 'REPORT_JSON' && content ? (
        <div className="flex-1 overflow-hidden p-4">
          <ReportJsonPanel
            content={content}
            fileName={artifact.name}
            className="h-full"
          />
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center text-[#858585] gap-2 px-6 text-center">
          <span>Failed to load artifact</span>
          {loadError && (
            <span className="text-[11px] text-[#ef4444] font-mono max-w-lg break-all">{loadError}</span>
          )}
          {!loadError && (
            <span className="text-[11px] text-[#666]">Check login session and that the analysis job completed.</span>
          )}
        </div>
      )}

      {/* Zoom rect overlay for PNG */}
      {zoomRect && (
        <div 
          className="fixed border-2 border-[#10b981] bg-[#10b981]/20 pointer-events-none z-50 rounded-[2px]"
          style={{ left: zoomRect.x, top: zoomRect.y, width: zoomRect.w, height: zoomRect.h }}
        />
      )}
    </div>
  );
}

export function MainEditor() {
  const { state, analyzeFile, setActiveFile, closeFile, closeOthers, closeToRight, closeAll, togglePin, splitEditor, openConfigModal, toggleBot, toggleValidation, setActiveArtifact, toggleAnalysisTerminal } = useApp();
  const file = state.files.find(f => f.id === state.activeFileId);
  const splitFile = state.files.find(f => f.id === state.splitFileId);
  const { getScale, setScaleForKey } = usePerViewZoom();
  const [showAnnotations, setShowAnnotations] = useState(true);
  const [showViewSplitOverlay, setShowViewSplitOverlay] = useState(true);
  const [toolMode, setToolMode] = useState<'select' | 'pan' | 'zoom'>('select');

  const { viewSplit } = useViewSplit(file);

  const primaryZoomKey = state.activeArtifact
    ? zoomKeyForArtifact(state.activeArtifact.id)
    : file
      ? zoomKeyForFile(file.id)
      : null;
  const splitZoomKey = splitFile ? zoomKeyForFile(splitFile.id) : null;

  const primaryScale = getScale(primaryZoomKey);
  const splitScale = getScale(splitZoomKey);

  const setPrimaryScale = useCallback(
    (value: number | ((prev: number) => number)) => setScaleForKey(primaryZoomKey, value),
    [primaryZoomKey, setScaleForKey],
  );

  const isAPressed = useRef(false);
  const pane1Ref = useRef<HTMLDivElement>(null);
  const pane2Ref = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const isDrawingZoom = useRef(false);
  const startDragPos = useRef({ x: 0, y: 0 });
  const startScrollPos = useRef({ left: 0, top: 0 });

  const [zoomRect, setZoomRect] = useState<{ x: number, y: number, w: number, h: number } | null>(null);
  const [pdfDimensions, setPdfDimensions] = useState<{ w: number, h: number } | null>(null);
  const [pngDimensions, setPngDimensions] = useState<{ w: number, h: number } | null>(null);
  
  const [contextMenu, setContextMenu] = useState<{ x: number, y: number, fileId: string } | null>(null);

  const fitScreen = () => {
    // For PNG artifact — use pngDimensions
    if (state.activeArtifact && state.activeArtifact.type === 'ANNOTATED_PNG' && pngDimensions) {
      // Approximate available space (full pane minus padding)
      const pane = document.querySelector('[data-artifact-container]') as HTMLElement;
      if (pane) {
        const padding = 64;
        const availableWidth = pane.clientWidth - padding;
        const availableHeight = pane.clientHeight - padding;
        const newScale = Math.min(availableWidth / pngDimensions.w, availableHeight / pngDimensions.h);
        if (!isNaN(newScale) && newScale > 0) {
          setPrimaryScale(Math.max(0.1, Math.min(4, newScale)));
        }
      }
      return;
    }
    // For PDF
    if (pane1Ref.current && pdfDimensions) {
      const pane = pane1Ref.current;
      const padding = 64;
      const availableWidth = pane.clientWidth - padding;
      const availableHeight = pane.clientHeight - padding;
      const newScale = Math.min(availableWidth / pdfDimensions.w, availableHeight / pdfDimensions.h);
      if (!isNaN(newScale) && newScale > 0) {
        setPrimaryScale(Math.max(0.1, Math.min(4, newScale)));
      }
    }
  };

  const handleMouseDown = (e: React.MouseEvent, paneRef: React.RefObject<HTMLDivElement>) => {
    if (!paneRef.current) return;
    
    if (toolMode === 'pan' || isAPressed.current) {
      isDragging.current = true;
      startDragPos.current = { x: e.clientX, y: e.clientY };
      startScrollPos.current = { left: paneRef.current.scrollLeft, top: paneRef.current.scrollTop };
      paneRef.current.style.cursor = 'grabbing';
    } else if (toolMode === 'zoom') {
      isDrawingZoom.current = true;
      startDragPos.current = { x: e.clientX, y: e.clientY };
      setZoomRect({ x: e.clientX, y: e.clientY, w: 0, h: 0 });
    }
  };

  const handleMouseMove = (e: React.MouseEvent, paneRef: React.RefObject<HTMLDivElement>) => {
    if (!paneRef.current) return;
    if (isDragging.current) {
      const dx = e.clientX - startDragPos.current.x;
      const dy = e.clientY - startDragPos.current.y;
      paneRef.current.scrollLeft = startScrollPos.current.left - dx;
      paneRef.current.scrollTop = startScrollPos.current.top - dy;
    } else if (isDrawingZoom.current) {
      setZoomRect({
        x: Math.min(startDragPos.current.x, e.clientX),
        y: Math.min(startDragPos.current.y, e.clientY),
        w: Math.abs(e.clientX - startDragPos.current.x),
        h: Math.abs(e.clientY - startDragPos.current.y)
      });
    }
  };

  const handleMouseUp = (paneRef: React.RefObject<HTMLDivElement>, isSplitPane = false) => {
    if (isDragging.current) {
      isDragging.current = false;
      if (paneRef.current) paneRef.current.style.cursor = '';
    } else if (isDrawingZoom.current && zoomRect && paneRef.current) {
      isDrawingZoom.current = false;
      
      if (zoomRect.w > 20 && zoomRect.h > 20) {
        const paneRect = paneRef.current.getBoundingClientRect();
        
        const zoomCenterX = zoomRect.x + zoomRect.w / 2;
        const zoomCenterY = zoomRect.y + zoomRect.h / 2;
        
        const contentX = zoomCenterX - paneRect.left + paneRef.current.scrollLeft;
        const contentY = zoomCenterY - paneRect.top + paneRef.current.scrollTop;
        
        const scaleX = paneRect.width / zoomRect.w;
        const scaleY = paneRect.height / zoomRect.h;
        const scaleMultiplier = Math.min(scaleX, scaleY);
        
        const zoomKey = isSplitPane && splitZoomKey ? splitZoomKey : primaryZoomKey;
        const prevScale = getScale(zoomKey);
        const nextScale = Math.min(4, Math.max(0.1, prevScale * scaleMultiplier));
        
        setScaleForKey(zoomKey, nextScale);
        
        setTimeout(() => {
          if (paneRef.current) {
            const ratio = nextScale / prevScale;
            paneRef.current.scrollLeft = contentX * ratio - paneRect.width / 2;
            paneRef.current.scrollTop = contentY * ratio - paneRect.height / 2;
          }
        }, 10);
      }
      setZoomRect(null);
      setToolMode('select');
    }
  };

  const handleMouseLeave = (paneRef: React.RefObject<HTMLDivElement>, isSplitPane = false) => {
    handleMouseUp(paneRef, isSplitPane);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'a') isAPressed.current = true;
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'a') isAPressed.current = false;
    };
    
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  const handleWheel = (e: React.WheelEvent) => {
    // Do nothing here — handled by native event listener below
  };

  const attachPaneWheelZoom = useCallback(
    (pane: HTMLDivElement, zoomKey: string | null) => {
      const onWheel = (e: WheelEvent) => {
        if (!zoomKey || !(e.ctrlKey || e.metaKey)) return;

        e.preventDefault();
        e.stopPropagation();

        const rect = pane.getBoundingClientRect();
        const pointerX = e.clientX - rect.left;
        const pointerY = e.clientY - rect.top;
        const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;

        setScaleForKey(zoomKey, (prevScale) => {
          const nextScale = Math.min(4, Math.max(0.1, prevScale * zoomFactor));
          if (nextScale === prevScale) return prevScale;

          const ratio = nextScale / prevScale;
          const contentX = pointerX + pane.scrollLeft;
          const contentY = pointerY + pane.scrollTop;

          setTimeout(() => {
            pane.scrollLeft = contentX * ratio - pointerX;
            pane.scrollTop = contentY * ratio - pointerY;
          }, 0);

          return nextScale;
        });
      };

      pane.addEventListener('wheel', onWheel, { passive: false });
      return () => pane.removeEventListener('wheel', onWheel);
    },
    [setScaleForKey],
  );

  // Native wheel listener to prevent browser zoom and handle PDF zoom (pane 1)
  useEffect(() => {
    const pane = pane1Ref.current;
    if (!pane || !primaryZoomKey) return;
    return attachPaneWheelZoom(pane, primaryZoomKey);
  }, [attachPaneWheelZoom, primaryZoomKey]);

  // Wheel zoom for split pane (pane 2)
  useEffect(() => {
    if (state.splitMode === 'none' || !splitZoomKey) return;
    const pane = pane2Ref.current;
    if (!pane) return;
    return attachPaneWheelZoom(pane, splitZoomKey);
  }, [attachPaneWheelZoom, splitZoomKey, state.splitMode]);

  // Prevent browser zoom when viewing artifact (pane1Ref not mounted)
  useEffect(() => {
    if (!state.activeArtifact) return;
    
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
      }
    };
    
    document.addEventListener('wheel', onWheel, { passive: false });
    return () => document.removeEventListener('wheel', onWheel);
  }, [state.activeArtifact]);

  useEffect(() => {
    if (!state.activeArtifact?.sourceFileId || !state.activeFileId) return;
    if (state.activeArtifact.sourceFileId !== state.activeFileId) {
      setActiveArtifact(null);
    }
  }, [state.activeFileId, state.activeArtifact?.sourceFileId, setActiveArtifact]);

  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, []);

  if (!file) {
    // Show skeleton when loading files
    if (state.isLoadingFiles) {
      return (
        <div className="flex-1 min-h-0 bg-editor-bg flex items-center justify-center p-8">
          <div className="w-full max-w-[800px] animate-pulse space-y-4">
            {/* Toolbar skeleton */}
            <div className="flex gap-2">
              <div className="h-7 w-20 bg-[#2b2d35] rounded" />
              <div className="h-7 w-16 bg-[#2b2d35] rounded" />
              <div className="h-7 w-16 bg-[#2b2d35] rounded" />
              <div className="flex-1" />
              <div className="h-7 w-24 bg-[#2b2d35] rounded" />
            </div>
            {/* PDF area skeleton */}
            <div className="h-[70vh] bg-[#2b2d35] rounded-lg border border-[#3c3c3c]" />
          </div>
        </div>
      );
    }

    return (
      <div className="flex-1 min-h-0 bg-editor-bg flex items-center justify-center text-muted flex-col relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '24px 24px' }}></div>
        <div className="w-64 h-64 border-2 border-dashed border-panel-border rounded-lg flex flex-col items-center justify-center text-center p-6 bg-sidebar-bg">
           <svg className="w-12 h-12 mb-4 text-[#10b981]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path></svg>
           <h3 className="text-white font-semibold mb-2 text-sm">Welcome to Element IQ</h3>
           <p className="text-xs mb-4">Select a file from the workspace or import new drawings to begin analysis.</p>
           <button onClick={() => openConfigModal('import')} className="bg-[#10b981] text-white px-4 py-2 rounded text-[13px] font-semibold cursor-pointer hover:bg-[#059669] shadow-lg transition-colors border border-[#10b981]">
              Import Drawings
           </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex-1 min-h-0 bg-editor-bg flex overflow-hidden text-[#cccccc] ${state.splitMode === 'up' || state.splitMode === 'down' ? 'flex-col' : 'flex-row'}`}>
      
      {/* PANE 1 */}
      <div className={`flex flex-col relative overflow-hidden ${state.splitMode === 'none' ? 'flex-1' : 'flex-1 border-[#3c3c3c] border-r'}`}>
        
        {/* Editor Tabs (Pane 1) */}
        <div className="h-[35px] bg-[#252526] flex items-center justify-between shrink-0 border-b border-[#1e1e1e]">
          <div className="flex items-center h-full flex-1 overflow-x-auto no-scrollbar">
            {state.activeArtifact && (
              <>
                <button
                  onClick={() => setActiveArtifact(null)}
                  className="px-3 h-full flex items-center text-[11px] text-[#10b981] hover:bg-[#333] font-medium shrink-0"
                >
                  ← Back to PDF
                </button>
                <div className="px-3 h-full flex items-center text-[12px] text-white font-semibold border-t-2 border-t-[#10b981] bg-[#1e1e1e] shrink-0">
                  {state.activeArtifact.name}
                </div>
              </>
            )}
            {state.openFiles.map(fid => {
              const f = state.files.find(f => f.id === fid);
              if (!f) return null;
              const isActive = fid === state.activeFileId;
              return (
                <div 
                  key={fid}
                  onClick={() => setActiveFile(fid, 1)}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    setContextMenu({ x: e.clientX, y: e.clientY, fileId: fid });
                  }}
                  className={`px-3 h-full flex items-center border-r border-[#252526] text-[13px] gap-2 group cursor-pointer min-w-[120px] max-w-[200px] select-none ${isActive ? 'bg-[#1e1e1e] text-[#4ec9b0] italic border-t-2 border-t-[#10b981]' : 'bg-[#2d2d2d] text-[#969696] hover:bg-[#252526] hover:text-white border-t-2 border-t-transparent'}`}
                >
                  {state.pinnedFiles.includes(fid) && <Pin className="w-3 h-3 text-[#10b981]" />}
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
          <div className="flex items-center h-full">
            {/* Editor toolbar items — inline with tab bar */}
            {!state.activeArtifact && (
            <>
              <button 
                onClick={() => setShowAnnotations(!showAnnotations)}
                className={`h-full px-3 flex items-center gap-1.5 text-[11px] border-t-2 transition-colors ${showAnnotations ? 'border-t-[#10b981] bg-[#1e1e1e] text-white' : 'border-t-transparent text-[#858585] hover:text-white hover:bg-[#333]'}`}
              >
                <ShieldCheck className="w-3 h-3" /> QA Overlay
              </button>
              {viewSplit ? (
                <button
                  onClick={() => setShowViewSplitOverlay(!showViewSplitOverlay)}
                  className={`h-full px-3 flex items-center gap-1.5 text-[11px] border-t-2 transition-colors ${showViewSplitOverlay ? 'border-t-[#ffc800] bg-[#1e1e1e] text-white' : 'border-t-transparent text-[#858585] hover:text-white hover:bg-[#333]'}`}
                  title="Toggle PLAN / REINFORCEMENT boundary"
                >
                  <Columns2 className="w-3 h-3" /> View Split
                </button>
              ) : null}
              <div className="w-[1px] h-4 bg-[#3c3c3c]"></div>
              {file.status === 'PENDING' ? (
                <button
                  onClick={() => openConfigModal('reanalyze', file.id)}
                  className="h-full px-3 flex items-center gap-1 text-[11px] text-[#10b981] font-medium hover:bg-[#333] transition-colors border-t-2 border-t-transparent"
                >
                  ▶ Start Analysis
                </button>
              ) : file.status === 'ANALYZING' ? (
                <button disabled className="h-full px-3 flex items-center gap-1 text-[11px] text-muted font-medium border-t-2 border-t-transparent">
                  <RefreshCw className="w-3 h-3 animate-spin" /> Scanning...
                </button>
              ) : (
                <button
                  onClick={() => openConfigModal('reanalyze', file.id)}
                  className="h-full px-3 flex items-center gap-1 text-[11px] text-[#10b981] font-medium hover:bg-[#333] transition-colors border-t-2 border-t-transparent"
                >
                  ↺ Re-analyze
                </button>
              )}
              <div className="w-[1px] h-4 bg-[#3c3c3c]"></div>
              <div
                className="h-full px-3 flex items-center text-[11px] text-white relative group cursor-pointer hover:bg-[#333] transition-colors border-t-2 border-t-transparent"
              >
                Export
                <div className="absolute right-0 top-full mt-0 bg-[#252526] border border-[#3c3c3c] rounded-lg shadow-xl py-1 w-48 hidden group-hover:block z-50">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (file?.file) {
                        const url = URL.createObjectURL(file.file);
                        const a = document.createElement('a'); a.href = url; a.download = file.name; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
                      }
                    }}
                    className="w-full text-left px-3 py-1.5 text-[11px] hover:bg-[#333] text-white"
                  >
                    📄 Original PDF
                  </button>
                  {file?.artifacts?.map(a => {
                    const { Icon, color } = artifactIconMeta(a.type);
                    return (
                    <button
                      key={a.id}
                      onClick={async (e) => {
                        e.stopPropagation();
                        const { authFetch } = await import('../lib/supabase');
                        const res = await authFetch(a.downloadUrl);
                        if (res.ok) {
                          const blob = await res.blob();
                          const url = URL.createObjectURL(blob);
                          const link = document.createElement('a');
                          link.href = url;
                          link.download = a.type === 'ANNOTATED_PNG' ? `${file.name.replace('.pdf','')}_annotated.png` : a.type === 'ANNOTATED_PDF' ? `${file.name.replace('.pdf','')}_annotated.pdf` : `${file.name.replace('.pdf','')}_report.json`;
                          document.body.appendChild(link); link.click(); document.body.removeChild(link); URL.revokeObjectURL(url);
                        }
                      }}
                      className="w-full text-left px-3 py-1.5 text-[11px] hover:bg-[#333] text-white flex items-center gap-2"
                    >
                      <Icon className={cn('w-3.5 h-3.5 shrink-0', color)} />
                      <span>{artifactDisplayName(a.type)}</span>
                    </button>
                    );
                  })}
                  {(!file?.artifacts || file.artifacts.length === 0) && (
                    <div className="px-3 py-1.5 text-[11px] text-[#858585]">No artifacts — run analysis first</div>
                  )}
                </div>
              </div>
            </>
            )}
            {state.activeArtifact?.type === 'ANNOTATED_PNG' && viewSplit ? (
              <>
                <button
                  onClick={() => setShowViewSplitOverlay(!showViewSplitOverlay)}
                  className={`h-full px-3 flex items-center gap-1.5 text-[11px] border-t-2 transition-colors ${showViewSplitOverlay ? 'border-t-[#ffc800] bg-[#1e1e1e] text-white' : 'border-t-transparent text-[#858585] hover:text-white hover:bg-[#333]'}`}
                  title="Toggle PLAN / REINFORCEMENT boundary overlay"
                >
                  <Columns2 className="w-3 h-3" /> View Split
                </button>
                <div className="w-[1px] h-4 bg-[#3c3c3c]" />
              </>
            ) : null}
            <button 
              onClick={() => splitEditor('right')}
              className="h-full px-4 flex items-center justify-center hover:bg-[#333] transition-colors border-t-2 border-t-transparent text-[#858585] hover:text-white"
              title="Split Editor Right"
            >
              <Split className="w-4 h-4" />
            </button>
            <button 
              onClick={toggleBot}
              className={`h-full px-4 flex items-center justify-center hover:bg-[#333] transition-colors border-t-2 ${state.isBotOpen ? 'border-t-[#10b981] bg-[#1e1e1e] text-white' : 'border-t-transparent text-[#858585]'}`}
              title="AI Chat"
            >
              <Brain className="w-4 h-4" />
            </button>
            <button
              onClick={toggleAnalysisTerminal}
              className={`h-full px-4 flex items-center justify-center hover:bg-[#333] transition-colors border-t-2 ${state.isAnalysisTerminalOpen ? 'border-t-[#10b981] bg-[#1e1e1e] text-white' : 'border-t-transparent text-[#858585]'}`}
              title="Toggle Analysis Log"
            >
              <Terminal className="w-4 h-4" />
            </button>
            <button 
              onClick={toggleValidation}
              className={`h-full px-4 flex items-center justify-center hover:bg-[#333] transition-colors border-t-2 ${state.isValidationOpen ? 'border-t-[#10b981] bg-[#1e1e1e] text-white' : 'border-t-transparent text-[#858585]'}`}
              title="Toggle Validation Panel"
            >
              <PanelRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Canvas (Pane 1) */}
        {state.activeArtifact ? (
          <ArtifactViewer
            artifact={state.activeArtifact}
            onClose={() => setActiveArtifact(null)}
            scale={primaryScale}
            toolMode={toolMode}
            onScaleChange={setPrimaryScale}
            onImageDimensions={(w, h) => setPngDimensions({ w, h })}
            viewSplit={viewSplit}
            showViewSplitOverlay={showViewSplitOverlay}
          />
        ) : (
        <div 
          ref={pane1Ref}
          onWheel={handleWheel}
          onMouseDown={(e) => handleMouseDown(e, pane1Ref)}
          onMouseMove={(e) => handleMouseMove(e, pane1Ref)}
          onMouseUp={() => handleMouseUp(pane1Ref)}
          onMouseLeave={() => handleMouseLeave(pane1Ref)}
          className={`flex-1 overflow-auto bg-[#121212] relative no-scrollbar ${toolMode === 'pan' ? 'cursor-grab' : (toolMode === 'zoom' ? 'cursor-crosshair' : '')}`}
        >
          <div className="min-w-full min-h-full flex items-center justify-center p-8 w-max h-max relative">
            {file.status === 'ANALYZING' && (
              <ParsingOverlay
                fileName={file.name}
                pages={file.pages}
                progress={file.analysisProgress}
                stage={file.analysisStage}
              />
            )}
            <PdfRenderer 
               file={file} 
               pageNum={state.activePage || 1} 
               scale={primaryScale || 0.5} 
               onDimensionsLoaded={(w, h) => setPdfDimensions({w, h})}
               showAnnotations={showAnnotations}
               showViewSplitOverlay={showViewSplitOverlay}
               viewSplit={viewSplit}
            />
          </div>
        </div>
        )}

        {/* Footer (Pane 1) — hidden when viewing artifact or analyzing */}
        {!state.activeArtifact && file.status !== 'ANALYZING' && (
        <div className="absolute py-1 px-3 bg-[#1e1e1e] border border-panel-border bottom-4 right-4 text-[10px] font-mono rounded shadow-lg flex items-center gap-3 z-50">
          <span className="text-muted">PAGE {state.activePage || 1}/{file.pages}</span>
          <span className="w-1 h-1 bg-[#3c3c3c] rounded-full"></span>
          <span className="text-[#10b981]">{file.status}</span>
        </div>
        )}

        {/* Scan line animation — outside scrollable area to prevent scrollbar flicker */}
        {file.status === 'ANALYZING' && (
          <div className="absolute top-0 left-0 w-full h-[3px] bg-[#00ff41] shadow-[0_0_15px_3px_rgba(0,255,65,0.9),0_0_5px_1px_rgba(255,255,255,0.8)] animate-scan z-40 pointer-events-none" />
        )}

        {/* Floating Toolbar (Pane 1) — hidden while analyzing */}
        {(!state.activeArtifact || state.activeArtifact.type === 'ANNOTATED_PNG') && file.status !== 'ANALYZING' && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-[#252526] border border-[#3c3c3c] p-1.5 rounded-lg shadow-2xl flex items-center gap-1 z-50">
          <button 
            onClick={() => setToolMode('select')}
            className={`px-3 py-1.5 rounded flex items-center gap-2 text-xs font-medium transition-colors ${toolMode === 'select' ? 'bg-[#10b981]/10 text-[#10b981]' : 'text-[#a0a5b5] hover:text-white hover:bg-[#333]'}`}
            title="Select (V)"
          >
            <MousePointer2 className="w-4 h-4" />
          </button>
          <button 
            onClick={() => setToolMode(toolMode === 'pan' ? 'select' : 'pan')}
            className={`px-3 py-1.5 rounded flex items-center gap-2 text-xs font-medium transition-colors ${toolMode === 'pan' ? 'bg-[#10b981]/10 text-[#10b981]' : 'text-[#a0a5b5] hover:text-white hover:bg-[#333]'}`}
            title="Pan (H)"
          >
            <Hand className="w-4 h-4" />
          </button>
          <button 
            onClick={() => setToolMode(toolMode === 'zoom' ? 'select' : 'zoom')}
            className={`px-3 py-1.5 rounded flex items-center gap-2 text-xs font-medium transition-colors ${toolMode === 'zoom' ? 'bg-[#10b981]/10 text-[#10b981]' : 'text-[#a0a5b5] hover:text-white hover:bg-[#333]'}`}
            title="Zoom (Z)"
          >
            <Search className="w-4 h-4" />
          </button>
          <div className="w-[1px] h-5 bg-[#3c3c3c] mx-2"></div>
          <button 
            onClick={fitScreen}
            className="px-2 py-1.5 rounded text-[#a0a5b5] hover:text-white hover:bg-[#333] transition-colors"
            title="Fit to Screen"
          >
            <Maximize className="w-4 h-4" />
          </button>
          <div className="flex items-center text-[#a0a5b5] text-xs font-medium selection:bg-transparent rounded bg-[#121212] border border-[#3c3c3c] ml-1">
            <button onClick={() => setPrimaryScale(s => Math.max(0.1, (s || 1) - 0.25))} className="px-2 py-1.5 hover:text-white hover:bg-[#333] transition-colors border-r border-[#3c3c3c] rounded-l leading-none">−</button>
            <span className="w-[45px] text-center">{!isNaN(primaryScale) ? Math.round((primaryScale || 0.5) * 100) : 100}%</span>
            <button onClick={() => setPrimaryScale(s => Math.min(4, (s || 1) + 0.25))} className="px-2 py-1.5 hover:text-white hover:bg-[#333] transition-colors border-l border-[#3c3c3c] rounded-r leading-none">+</button>
          </div>
        </div>
        )}
      </div>

      {/* PANE 2 (Split Mode) */}
      {state.splitMode !== 'none' && (
        <div className="flex flex-col flex-1 relative overflow-hidden border-[#3c3c3c]">
          
          {/* Editor Tabs (Pane 2) */}
          <div className="h-[35px] bg-[#252526] flex items-center justify-between shrink-0 border-b border-[#1e1e1e]">
             <div className="flex items-center h-full flex-1 overflow-x-auto no-scrollbar">
               {splitFile && (
                 <div className="px-3 h-full flex items-center border-r border-[#252526] text-[13px] gap-2 group cursor-pointer min-w-[120px] max-w-[200px] select-none bg-[#1e1e1e] text-[#4ec9b0] italic border-t-2 border-t-[#10b981]">
                   <span className="truncate flex-1">{splitFile.name}</span>
                   <button 
                     onClick={() => splitEditor('none')}
                     className="flex-shrink-0 w-5 h-5 flex items-center justify-center rounded-sm hover:bg-white/10 hover:!text-white text-[#4ec9b0]"
                   >
                     <X className="w-3.5 h-3.5" />
                   </button>
                 </div>
               )}
             </div>
             <div className="flex items-center h-full px-2">
                <button onClick={() => splitEditor('none')} className="text-muted hover:text-white flex items-center gap-1.5 text-xs px-2 py-1 rounded bg-[#333]/50">
                  <X className="w-3 h-3" /> Close Split
                </button>
             </div>
          </div>

          {/* Canvas (Pane 2) */}
          <div 
            ref={pane2Ref}
            onWheel={handleWheel}
            onMouseDown={(e) => handleMouseDown(e, pane2Ref)}
            onMouseMove={(e) => handleMouseMove(e, pane2Ref)}
            onMouseUp={() => handleMouseUp(pane2Ref, true)}
            onMouseLeave={() => handleMouseLeave(pane2Ref, true)}
            className={`flex-1 overflow-auto bg-[#0a0a0a] relative no-scrollbar shadow-inner ${toolMode === 'pan' ? 'cursor-grab' : (toolMode === 'zoom' ? 'cursor-crosshair' : '')}`}
          >
             <div className="min-w-full min-h-full flex items-center justify-center p-8 w-max h-max relative">
               {splitFile ? (
                 <PdfRenderer 
                   file={splitFile} 
                   pageNum={state.activePage || 1} 
                   scale={splitScale} 
                   showAnnotations={showAnnotations} 
                 />
               ) : (
                 <div className="flex flex-col items-center justify-center text-center p-6 mt-8">
                   <svg className="w-12 h-12 mb-4 text-[#3c3c3c]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2"></path></svg>
                   <h3 className="text-[#858585] font-semibold mb-2 text-sm">No Document Selected</h3>
                 </div>
               )}
             </div>
          </div>
          
          {/* Footer (Pane 2) */}
          {splitFile && (
            <div className="absolute py-1 px-3 bg-[#1e1e1e] border border-panel-border bottom-4 right-4 text-[10px] font-mono rounded shadow-lg flex items-center gap-3 z-50">
              <span className="text-muted">PAGE {state.activePage || 1}/{splitFile.pages}</span>
              <span className="w-1 h-1 bg-[#3c3c3c] rounded-full"></span>
              <span className="text-[#10b981]">{splitFile.status}</span>
            </div>
          )}
        </div>
      )}

      {/* Zoom Rect Overlay */}
      {zoomRect && (
        <div 
          className="fixed border-2 border-[#10b981] bg-[#10b981]/20 pointer-events-none z-50 rounded-[2px]"
          style={{
            left: zoomRect.x,
            top: zoomRect.y,
            width: zoomRect.w,
            height: zoomRect.h
          }}
        />
      )}

      {/* Context Menu */}
      {contextMenu && (
        <div 
          className="fixed z-[100] bg-[#1e1e1e] border border-[#3c3c3c] rounded-[4px] shadow-2xl min-w-[200px] text-[12px] flex flex-col py-1 font-sans text-[#cccccc]"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={(e) => e.stopPropagation()} // prevent clicking menu from closing it immediately
        >
          <button 
            onClick={() => { setContextMenu(null); closeFile(contextMenu.fileId); }}
            className="w-full text-left px-4 py-1.5 hover:bg-[#0060c0] hover:text-white flex justify-between group"
          >
            <span>Close</span>
          </button>
          <div className="h-[1px] bg-[#3c3c3c] my-1"></div>
          <button 
            onClick={() => { setContextMenu(null); closeOthers(contextMenu.fileId); }}
            className="w-full text-left px-4 py-1.5 hover:bg-[#0060c0] hover:text-white"
          >
            Close Others
          </button>
          <button 
            onClick={() => { setContextMenu(null); closeToRight(contextMenu.fileId); }}
            className="w-full text-left px-4 py-1.5 hover:bg-[#0060c0] hover:text-white"
          >
            Close to the Right
          </button>
          <button 
            onClick={() => { setContextMenu(null); closeAll(); }}
            className="w-full text-left px-4 py-1.5 hover:bg-[#0060c0] hover:text-white"
          >
            Close All
          </button>
          <div className="h-[1px] bg-[#3c3c3c] my-1"></div>
          <button 
            onClick={() => { setContextMenu(null); alert('Feature in development'); }}
            className="w-full text-left px-4 py-1.5 hover:bg-[#0060c0] hover:text-white opacity-50 cursor-not-allowed"
          >
            Keep Open
          </button>
          <button 
            onClick={() => { setContextMenu(null); togglePin(contextMenu.fileId); }}
            className="w-full text-left px-4 py-1.5 hover:bg-[#0060c0] hover:text-white"
          >
            {state.pinnedFiles.includes(contextMenu.fileId) ? 'Unpin' : 'Pin'}
          </button>
          <div className="h-[1px] bg-[#3c3c3c] my-1"></div>
          <button 
            onClick={() => { setContextMenu(null); splitEditor('up', contextMenu.fileId); }}
            className="w-full text-left px-4 py-1.5 hover:bg-[#0060c0] hover:text-white"
          >
            Split Up
          </button>
          <button 
            onClick={() => { setContextMenu(null); splitEditor('down', contextMenu.fileId); }}
            className="w-full text-left px-4 py-1.5 hover:bg-[#0060c0] hover:text-white"
          >
            Split Down
          </button>
          <button 
            onClick={() => { setContextMenu(null); splitEditor('left', contextMenu.fileId); }}
            className="w-full text-left px-4 py-1.5 hover:bg-[#0060c0] hover:text-white"
          >
            Split Left
          </button>
          <button 
            onClick={() => { setContextMenu(null); splitEditor('right', contextMenu.fileId); }}
            className="w-full text-left px-4 py-1.5 hover:bg-[#0060c0] hover:text-white"
          >
            Split Right
          </button>
        </div>
      )}
    </div>
  );
}
