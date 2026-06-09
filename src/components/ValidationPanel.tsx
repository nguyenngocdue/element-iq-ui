import React from 'react';
import { useApp } from '../store';
import { validationPanelAccentClass } from '../lib/analysisStatus';
import { CheckCircle2, AlertCircle, XCircle, ShieldCheck } from 'lucide-react';
import { Detection } from '../types';
import { useResizable } from '../hooks/useResizable';
import { cn } from '../lib/utils';

export function ValidationPanel() {
  const { state } = useApp();
  const file = state.files.find(f => f.id === state.activeFileId);
  const { width, isDragging, handleMouseDown } = useResizable({ initialWidth: 350, minWidth: 250, maxWidth: 600, direction: 'right' });

  if (!file) return null;

  const validDetections = file.detections.filter(d => d.status === 'PASS');
  const failDetections = file.detections.filter(d => d.status === 'FAIL');
  const warnDetections = file.detections.filter(d => d.status === 'WARN');

  return (
    <aside style={{ width }} className="bg-[#252526] border-l border-[#3c3c3c] flex flex-col shrink-0 relative">
       {/* Resizer Handle */}
       <div 
        onMouseDown={handleMouseDown}
        className={cn("absolute top-0 left-[-3px] bottom-0 w-[6px] cursor-col-resize z-50 hover:bg-[#10b981] transition-colors", isDragging && "bg-[#10b981]")}
      />
      <div className="p-4 flex flex-col gap-4 flex-1 overflow-y-auto">
        <div className={`bg-[#2d2d2d] rounded-lg p-4 border ${file.passRate === 100 ? 'border-[#22c55e]/30' : (file.passRate || 0) >= 50 ? 'border-[#f59e0b]/30' : 'border-[#ef4444]/30'}`}>
          <div className="flex justify-between items-start">
            <div>
              <div className="text-[11px] text-[#858585] uppercase tracking-wider mb-1">Quality Score</div>
              <div className={`text-3xl font-light ${file.passRate === 100 ? 'text-[#22c55e]' : (file.passRate || 0) >= 50 ? 'text-[#f59e0b]' : 'text-[#ef4444]'}`}>
                 {file.passRate ?? '--'} <span className="text-lg font-mono">/ 100</span>
              </div>
            </div>
            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest ${validationPanelAccentClass(file.status)}`}>
              {file.status !== 'PENDING' && file.status !== 'ANALYZING' && file.status !== 'UPLOADING' ? file.status : 'WAIT'}
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <div className="text-[11px] font-bold text-[#858585] uppercase">Validation Results</div>
          <div className="bg-[#1e1e1e] p-3 rounded border border-[#3c3c3c] flex flex-col gap-2">
            <div className="flex justify-between items-center text-[12px]">
              <span className="text-[#858585]">Total Detections</span>
              <span className="font-mono text-white">{file.detections.length}</span>
            </div>
            <div className="flex justify-between items-center text-[12px]">
              <span className="text-[#858585]">Passing Elements</span>
              <span className="font-mono text-white">{validDetections.length}</span>
            </div>
            <div className="h-[1px] bg-[#3c3c3c] my-1"></div>
            <div className={`flex justify-between items-center text-[12px] ${failDetections.length > 0 ? 'text-[#ef4444]' : 'text-[#858585]'}`}>
              <span>Discrepancy Detected</span>
              <span className="font-bold">{failDetections.length} Elements</span>
            </div>
          </div>
        </div>

        {file.detections.length > 0 && (
          <div className="flex flex-col gap-2 flex-1">
            <div className="text-[11px] font-bold text-[#858585] uppercase">Issue Log</div>
            <div className="space-y-2 pr-1">
               {failDetections.map(d => <IssueCard key={d.id} detection={d} />)}
               {warnDetections.map(d => <IssueCard key={d.id} detection={d} />)}
               {failDetections.length === 0 && warnDetections.length === 0 && file.status === 'PASS' && (
                 <div className="p-3 bg-[#1e1e1e] rounded text-[#858585] text-xs border border-[#3c3c3c]">
                    No issues identified in annotations.
                 </div>
               )}
            </div>
          </div>
        )}

        <div className="mt-auto border-t border-[#3c3c3c] pt-4">
          {/* Artifacts Download */}
          {file.artifacts && file.artifacts.length > 0 && (
            <div className="mb-4">
              <div className="text-[11px] text-[#858585] mb-2 uppercase">Artifacts</div>
              <div className="space-y-1">
                {file.artifacts.map(a => (
                  <button
                    key={a.id}
                    onClick={async () => {
                      const { authFetch } = await import('../lib/supabase');
                      const res = await authFetch(a.downloadUrl);
                      if (res.ok) {
                        const blob = await res.blob();
                        const url = URL.createObjectURL(blob);
                        const link = document.createElement('a');
                        link.href = url;
                        link.download = a.type === 'ANNOTATED_PNG' ? 'annotated.png' : a.type === 'ANNOTATED_PDF' ? 'annotated.pdf' : 'report.json';
                        document.body.appendChild(link); link.click(); document.body.removeChild(link); URL.revokeObjectURL(url);
                      }
                    }}
                    className="w-full text-left px-2 py-1.5 bg-[#1e1e1e] border border-[#3c3c3c] rounded text-[10px] text-white hover:bg-[#25272e] flex items-center gap-2"
                  >
                    <span>{a.type === 'ANNOTATED_PNG' ? '🖼️' : a.type === 'ANNOTATED_PDF' ? '📋' : '📊'}</span>
                    <span>{a.type === 'ANNOTATED_PNG' ? 'Annotated PNG' : a.type === 'ANNOTATED_PDF' ? 'Annotated PDF' : 'JSON Report'}</span>
                    <span className="ml-auto text-[#10b981]">↓</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="text-[11px] text-[#858585] mb-2 uppercase">Active Annotations</div>
          <div className="flex gap-2">
            <div className="bg-[#22c55e]/20 text-[#22c55e] px-2 py-1 rounded text-[10px] font-mono">
               PASS: {validDetections.length}
            </div>
            <div className="bg-[#ef4444]/20 text-[#ef4444] px-2 py-1 rounded text-[10px] font-mono">
               FAIL: {failDetections.length}
            </div>
            <div className="bg-[#f59e0b]/20 text-[#f59e0b] px-2 py-1 rounded text-[10px] font-mono">
               WARN: {warnDetections.length}
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}

function IssueCard({ detection }: { detection: Detection, key?: React.Key }) {
  const isFail = detection.status === 'FAIL';
  const borderColor = isFail ? 'border-[#ef4444]' : 'border-[#f59e0b]';
  const textColor = isFail ? 'text-[#ef4444]' : 'text-[#f59e0b]';
  
  return (
    <div className={`p-3 bg-[#1e1e1e] rounded border-l-4 ${borderColor} border-y border-r border-[#3c3c3c]`}>
       <div className="flex justify-between text-[11px] mb-1 font-bold">
          <span className="text-white">Detected: {detection.type}</span>
          <span className={textColor}>{isFail ? 'Validation Failed' : 'Low Confidence'}</span>
       </div>
       <p className="text-[11px] text-[#858585] leading-relaxed">
         {detection.reason || `Detected ${detection.type} at ${(detection.confidence * 100).toFixed(0)}% confidence.`}
       </p>
    </div>
  );
}
