import React from 'react';
import { useApp } from '../store';
import { ShieldCheck, Cpu } from 'lucide-react';

export function BottomBar() {
  const { state } = useApp();
  const file = state.files.find(f => f.id === state.activeFileId);

  return (
    <footer className="h-[22px] bg-[#007acc] text-white flex items-center justify-between px-3 text-[10px] shrink-0 font-sans select-none">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1">
          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M2 10a8 8 0 1116 0 8 8 0 01-16 0zm12-3a1 1 0 10-2 0 1 1 0 002 0zM9 11V9H7v2h2zm0 2v-2h2v2H9z" clipRule="evenodd"></path></svg>
          <span>{file ? (file.status === 'ANALYZING' ? 'Analyzing...' : file.status === 'PENDING' ? 'Ready' : 'Analysis Complete') : 'Ready'}</span>
        </div>
        <span className="opacity-70">{file && file.status !== 'PENDING' && file.status !== 'ANALYZING' ? '0.42s Inference Time' : ''}</span>
      </div>
      <div className="flex items-center gap-4">
        <span>{file ? `Sheet 1 of ${file.pages}` : 'No active document'}</span>
        <span>Spaces: 2</span>
        <span>UTF-8</span>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 bg-white rounded-full"></div>
          <span>AI Assist Active</span>
        </div>
      </div>
    </footer>
  );
}
