import React from 'react';
import { useApp } from '../store';
import { analysisCompleteMessage, isAnalyzedStatus } from '../lib/analysisStatus';
import { AnalysisTerminalToggle } from './AnalysisTerminal';

export function BottomBar() {
  const { state } = useApp();
  const file = state.files.find(f => f.id === state.activeFileId);

  const totalFiles = state.files.length;
  const uploadingCount = state.files.filter(f => f.status === 'UPLOADING').length;
  const analyzingCount = state.files.filter(f => f.status === 'ANALYZING').length;
  const completedCount = state.files.filter(f => isAnalyzedStatus(f.status)).length;

  // Upload progress across all uploading files
  const uploadProgress = uploadingCount > 0
    ? Math.round(state.files.filter(f => f.status === 'UPLOADING').reduce((acc, f) => acc + (f.uploadProgress || 0), 0) / uploadingCount)
    : 100;

  const getStatusText = () => {
    if (uploadingCount > 0) return `Uploading ${uploadingCount} file(s)... ${uploadProgress}%`;
    if (analyzingCount > 0) return `Analyzing ${analyzingCount} file(s)...`;
    const complete = analysisCompleteMessage(file?.status);
    if (complete) return complete;
    if (totalFiles > 0) return 'Ready';
    return 'No active document';
  };

  const barColor = uploadingCount > 0
    ? 'bg-[#3b82f6]'
    : analyzingCount > 0
    ? 'bg-[#f59e0b]'
    : 'bg-[#10b981]';

  return (
    <footer className={`h-[22px] ${barColor} text-white flex items-center justify-between px-3 text-[10px] shrink-0 font-sans select-none transition-colors`}>
      <div className="flex items-center gap-4">
        <AnalysisTerminalToggle />
        <div className="flex items-center gap-1">
          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M2 10a8 8 0 1116 0 8 8 0 01-16 0zm12-3a1 1 0 10-2 0 1 1 0 002 0zM9 11V9H7v2h2zm0 2v-2h2v2H9z" clipRule="evenodd"></path></svg>
          <span>{getStatusText()}</span>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <span>Total: {totalFiles} file(s) • {completedCount} analyzed</span>
        <span>{file ? `Sheet ${state.activePage || 1} of ${file.pages}` : ''}</span>
        <span>UTF-8</span>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 bg-white rounded-full"></div>
          <span>AI Assist Active</span>
        </div>
      </div>
    </footer>
  );
}
