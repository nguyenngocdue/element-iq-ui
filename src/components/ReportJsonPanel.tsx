import React from 'react';
import { JsonViewWithControls } from './ui/json-view-with-controls';
import { parseJsonContent } from './ui/json-view';
import { ViewSplitSummary } from './ViewSplitSummary';

interface ReportJsonPanelProps {
  content: string;
  fileName?: string;
  fileId?: string;
  className?: string;
}

export function ReportJsonPanel({ content, fileName, fileId, className = '' }: ReportJsonPanelProps) {
  const data = parseJsonContent(content);
  const displayName = fileName?.replace(/\.pdf$/i, '_report.json') ?? 'report.json';

  return (
    <div className={`flex flex-col overflow-hidden bg-[#252526] border border-[#3c3c3c] rounded-xl shadow-sm ${className}`}>
      <div className="p-3 border-b border-[#3c3c3c] flex items-center justify-between bg-[#1e1e1e] shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-[#ef4444]/80" />
            <div className="w-3 h-3 rounded-full bg-[#d4b238]/80" />
            <div className="w-3 h-3 rounded-full bg-[#2eb886]/80" />
          </div>
          <div className="h-4 w-px bg-[#3c3c3c] mx-1" />
          <span className="text-[#e5c07b] font-bold text-xs">{`{ }`}</span>
          <span className="text-xs font-medium text-[#858585] font-mono tracking-wide">{displayName}</span>
        </div>
      </div>

      <div className="bg-[#1e1e1e] border-b border-[#3c3c3c] p-3 text-[10px] text-[#858585] flex items-center gap-4 font-mono shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-[#82aaff]">engine:</span> ElementIQ
        </div>
        {fileId ? (
          <div className="flex items-center gap-2">
            <span className="text-[#82aaff]">document_id:</span> {fileId}
          </div>
        ) : null}
        <div className="flex items-center gap-2">
          <span className="text-[#82aaff]">encoding:</span> UTF-8
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4 bg-[#1e1e1e] min-h-0">
        <ViewSplitSummary data={data} />
        <JsonViewWithControls data={data} title="Report JSON" />
      </div>
    </div>
  );
}
