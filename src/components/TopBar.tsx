import React from 'react';
import { Database, Search, Bell, User, LayoutGrid, BarChart2, FolderArchive, Play, RefreshCw } from 'lucide-react';
import { useApp } from '../store';

export function TopBar() {
  const { state, clearSession, setActiveSidebarTab } = useApp();

  return (
    <div className="h-[35px] border-b border-[#1e1e1e] bg-[#3c3c3c] flex items-center justify-between px-3 text-[12px] shrink-0">
      <div className="flex items-center gap-4 h-full">
        <div className="font-semibold text-active flex items-center gap-2">
          <div className="w-5 h-5 bg-[#007acc] rounded flex items-center justify-center text-white font-bold text-[10px]">IQ</div>
          <span className="text-[12px] font-semibold text-white">Element IQ</span>
        </div>
        <div className="flex gap-3 ml-4 h-full">
          <Tab active={state.activeSidebarTab === 'explorer'} onClick={() => setActiveSidebarTab('explorer')}>Drawings</Tab>
          <Tab active={state.activeSidebarTab === 'analysis'} onClick={() => setActiveSidebarTab('analysis')}>Analysis</Tab>
          <Tab active={state.activeSidebarTab === 'reports'} onClick={() => setActiveSidebarTab('reports')}>Reports</Tab>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5 px-2 py-0.5 bg-[#2d2d2d] rounded text-[10px] text-white">
          <div className={`w-2 h-2 rounded-full ${state.isEngineLive ? 'bg-green-500 animate-pulse' : 'bg-[#858585]'}`}></div>
          <span className="uppercase">{state.isEngineLive ? 'ENGINE: GPU LIVE' : 'ENGINE: OFFLINE'}</span>
        </div>
        
        <button 
          onClick={clearSession}
          className="bg-[#007acc] text-white px-3 py-1 text-[11px] rounded hover:bg-[#0062a3] flex items-center gap-1 transition-colors"
        >
          + New Session
        </button>

        <div className="w-6 h-6 rounded-full bg-[#555] flex items-center justify-center text-[10px] text-white">
          EQ
        </div>
      </div>
    </div>
  );
}

function Tab({ children, active, onClick }: { children: React.ReactNode; active?: boolean; onClick?: () => void }) {
  return (
    <button onClick={onClick} className={`h-full text-[11px] flex items-center border-b ${active ? 'border-[#007acc] text-white mt-[1px]' : 'border-transparent text-[#858585] hover:text-white'}`}>
      {children}
    </button>
  );
}
