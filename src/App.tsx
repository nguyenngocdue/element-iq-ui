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
import { AnalysisConfigModal } from './components/ImportModal';
import { ProjectDashboard } from './components/ProjectDashboard';
import { ElementIQBot } from './components/ElementIQBot';
import { AuthProvider, useAuth } from './lib/auth-context';
import { LoginPage } from './components/LoginPage';

function AppContent() {
  const { state, closeConfigModal } = useApp();

  if (state.currentView === 'projects') {
    return <ProjectDashboard />;
  }

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
            {state.isValidationOpen && <ValidationPanel />}
          </>
        )}
        {state.isBotOpen && <ElementIQBot />}
      </div>
      <BottomBar />
      
      <AnalysisConfigModal 
        open={state.showConfigModal} 
        onClose={closeConfigModal} 
        mode={state.configModalMode}
        targetFileId={state.configTargetFileId}
      />
    </div>
  );
}

function AuthenticatedApp() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0f1117] flex items-center justify-center">
        <div className="text-[#10b981] text-lg font-medium animate-pulse">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AuthenticatedApp />
    </AuthProvider>
  );
}
