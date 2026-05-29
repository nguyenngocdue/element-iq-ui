import React, { useState, useEffect, useRef } from 'react';
import { Database, Search, Bell, User, LayoutGrid, BarChart2, FolderArchive, Play, RefreshCw, Check, HelpCircle } from 'lucide-react';
import { useApp } from '../store';
import { AboutModal, ReportIssueModal } from './Modals';

export function TopBar() {
  const { state, clearSession, setActiveSidebarTab, setCurrentView } = useApp();
  
  const [isViewMenuOpen, setIsViewMenuOpen] = useState(false);
  const [isHelpMenuOpen, setIsHelpMenuOpen] = useState(false);

  const [isAboutModalOpen, setIsAboutModalOpen] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);

  const [viewState, setViewState] = useState({
    showProperties: true,
    showAnalysisOverlay: true,
    showBoundingBoxes: false,
    showDataTable: false,
    dark: true,
  });

  const viewMenuRef = useRef<HTMLDivElement>(null);
  const helpMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (viewMenuRef.current && !viewMenuRef.current.contains(event.target as Node)) {
        setIsViewMenuOpen(false);
      }
      if (helpMenuRef.current && !helpMenuRef.current.contains(event.target as Node)) {
        setIsHelpMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <>
      <div className="h-[35px] border-b border-[#1e1e1e] bg-[#3c3c3c] flex items-center justify-between px-3 text-[12px] shrink-0">
        <div className="flex items-center gap-4 h-full">
          <button onClick={() => setCurrentView('projects')} className="font-semibold text-active flex items-center gap-2 hover:opacity-80 transition-opacity">
            <div className="w-5 h-5 bg-[#10b981] rounded flex items-center justify-center text-white font-bold text-[10px]">IQ</div>
            <span className="text-[12px] font-semibold text-white">Element IQ {state.activeProject && <span className="text-[#858585] ml-1">/ {state.activeProject.name}</span>}</span>
          </button>
          <div className="flex gap-3 ml-4 h-full items-center">
            <Tab active={state.activeSidebarTab === 'explorer'} onClick={() => setActiveSidebarTab('explorer')}>Drawings</Tab>
            <Tab active={state.activeSidebarTab === 'analysis'} onClick={() => setActiveSidebarTab('analysis')}>Analysis</Tab>
            <Tab active={state.activeSidebarTab === 'reports'} onClick={() => setActiveSidebarTab('reports')}>Reports</Tab>

            <div className="h-full flex items-center relative" ref={viewMenuRef}>
              <Tab active={isViewMenuOpen} onClick={() => { setIsViewMenuOpen(!isViewMenuOpen); setIsHelpMenuOpen(false); }}>View</Tab>
              {isViewMenuOpen && (
                <div className="absolute top-[35px] left-0 w-[200px] bg-[#1e1e1e] border border-[#333] rounded-md shadow-2xl py-1 z-50 overflow-hidden">
                  <button onClick={() => setViewState(s => ({...s, showProperties: !s.showProperties}))} className="w-full text-left px-3 py-1.5 hover:bg-[#333] text-[#cccccc] flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                       <span className="w-4 flex justify-center">{viewState.showProperties && <Check className="w-3 h-3" />}</span>
                       Show Properties
                    </div>
                    <span className="text-[#858585] text-xs">Ctrl+P</span>
                  </button>
                  <button onClick={() => setViewState(s => ({...s, showAnalysisOverlay: !s.showAnalysisOverlay}))} className="w-full text-left px-3 py-1.5 hover:bg-[#333] text-[#cccccc] flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                       <span className="w-4 flex justify-center">{viewState.showAnalysisOverlay && <Check className="w-3 h-3" />}</span>
                       Analysis Overlay
                    </div>
                    <span className="text-[#858585] text-xs">Ctrl+O</span>
                  </button>
                  <button onClick={() => setViewState(s => ({...s, showBoundingBoxes: !s.showBoundingBoxes}))} className="w-full text-left px-3 py-1.5 hover:bg-[#333] text-[#cccccc] flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                       <span className="w-4 flex justify-center">{viewState.showBoundingBoxes && <Check className="w-3 h-3" />}</span>
                       Bounding Boxes
                    </div>
                    <span className="text-[#858585] text-xs">Ctrl+B</span>
                  </button>
                  <button onClick={() => setViewState(s => ({...s, showDataTable: !s.showDataTable}))} className="w-full text-left px-3 py-1.5 hover:bg-[#333] text-[#cccccc] flex items-center justify-between text-sm mb-2">
                    <div className="flex items-center gap-2">
                       <span className="w-4 flex justify-center">{viewState.showDataTable && <Check className="w-3 h-3" />}</span>
                       Data Table
                    </div>
                    <span className="text-[#858585] text-xs">Ctrl+T</span>
                  </button>
                  <div className="border-t border-[#333] my-1"></div>
                  <div className="w-full px-3 py-2 flex items-center justify-between text-sm">
                    <span className="text-[#cccccc] flex items-center gap-2"><span className="w-4" />Dark</span>
                    <button 
                      onClick={() => setViewState(s => ({...s, dark: !s.dark}))}
                      className={`w-8 h-4 rounded-full relative transition-colors ${viewState.dark ? 'bg-[#2563eb]' : 'bg-[#555]'}`}
                    >
                      <div className={`absolute top-[2px] w-3 h-3 rounded-full bg-white transition-all ${viewState.dark ? 'right-[2px]' : 'left-[2px]'}`}></div>
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="h-full flex items-center relative" ref={helpMenuRef}>
              <Tab active={isHelpMenuOpen} onClick={() => { setIsHelpMenuOpen(!isHelpMenuOpen); setIsViewMenuOpen(false); }}>
                <span className="flex items-center gap-1">Help <HelpCircle className="w-3 h-3" /></span>
              </Tab>
              {isHelpMenuOpen && (
                <div className="absolute top-[35px] left-0 w-[180px] bg-[#1e1e1e] border border-[#333] rounded-md shadow-2xl py-1 z-50 overflow-hidden">
                  <button onClick={() => { setIsReportModalOpen(true); setIsHelpMenuOpen(false); }} className="w-full text-left px-3 py-1.5 hover:bg-[#333] text-[#cccccc] text-sm">
                    Report issue
                  </button>
                  <button onClick={() => { setIsAboutModalOpen(true); setIsHelpMenuOpen(false); }} className="w-full text-left px-3 py-1.5 hover:bg-[#333] text-[#cccccc] text-sm mb-1">
                    About
                  </button>
                  <div className="border-t border-[#333] my-1"></div>
                  <button onClick={() => setIsHelpMenuOpen(false)} className="w-full text-left px-3 py-1.5 hover:bg-[#333] text-[#cccccc] text-sm">
                    View License
                  </button>
                  <button onClick={() => setIsHelpMenuOpen(false)} className="w-full text-left px-3 py-1.5 hover:bg-[#333] text-[#cccccc] text-sm">
                    Give feedback
                  </button>
                </div>
              )}
            </div>

          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-2 py-0.5 bg-[#2d2d2d] rounded text-[10px] text-white">
            <div className={`w-2 h-2 rounded-full ${state.isEngineLive ? 'bg-green-500 animate-pulse' : 'bg-[#858585]'}`}></div>
            <span className="uppercase">{state.isEngineLive ? 'ENGINE: GPU LIVE' : 'ENGINE: OFFLINE'}</span>
          </div>
          
          <button 
            onClick={clearSession}
            className="bg-[#10b981] text-white px-3 py-1 text-[11px] rounded hover:bg-[#059669] flex items-center gap-1 transition-colors"
          >
            + New Session
          </button>

          <div className="w-6 h-6 rounded-full bg-[#555] flex items-center justify-center text-[10px] text-white">
            EQ
          </div>
        </div>
      </div>

      {isAboutModalOpen && <AboutModal onClose={() => setIsAboutModalOpen(false)} />}
      {isReportModalOpen && <ReportIssueModal onClose={() => setIsReportModalOpen(false)} />}
    </>
  );
}

function Tab({ children, active, onClick }: { children: React.ReactNode; active?: boolean; onClick?: () => void }) {
  return (
    <button onClick={onClick} className={`h-full text-[11px] flex items-center border-b ${active ? 'border-[#10b981] text-white mt-[1px]' : 'border-transparent text-[#858585] hover:text-white'}`}>
      {children}
    </button>
  );
}
