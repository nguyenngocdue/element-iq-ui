import React from 'react';
import { TopBar } from './components/TopBar';
import { ActivityBar } from './components/ActivityBar';
import { Sidebar } from './components/Sidebar';
import { MainEditor } from './components/MainEditor';
import { ValidationPanel } from './components/ValidationPanel';
import { BottomBar } from './components/BottomBar';
import { AnalysisDashboard } from './components/AnalysisDashboard';
import { AnalysisView } from './components/AnalysisView';
import { AppProvider, useApp } from './store';

function AppContent() {
  const { state } = useApp();

  return (
    <div className="flex flex-col h-screen w-full overflow-hidden bg-editor-bg text-fg font-sans antialiased text-[14px]">
      <TopBar />
      <div className="flex flex-1 overflow-hidden">
        <ActivityBar />
        {state.activeSidebarTab === 'reports' ? (
          <AnalysisDashboard />
        ) : state.activeSidebarTab === 'analysis' ? (
          <AnalysisView />
        ) : (
          <>
            {state.isSidebarOpen && <Sidebar />}
            <MainEditor />
            <ValidationPanel />
          </>
        )}
      </div>
      <BottomBar />
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}

