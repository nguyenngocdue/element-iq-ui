import React, { useEffect } from 'react';
import { TopBar } from './components/TopBar';
import { ActivityBar } from './components/ActivityBar';
import { Sidebar } from './components/Sidebar';
import { MainEditor } from './components/MainEditor';
import { ValidationPanel } from './components/ValidationPanel';
import { BottomBar } from './components/BottomBar';
import { AnalysisTerminal } from './components/AnalysisTerminal';
import { AnalysisDashboard } from './components/AnalysisDashboard';
import { AnalysisView } from './components/AnalysisView';
import { AppProvider, useApp } from './store';
import { AnalysisConfigModal } from './components/ImportModal';
import { ProjectDashboard } from './components/ProjectDashboard';
import { ElementIQBot } from './components/ElementIQBot';
import { AuthProvider, useAuth } from './lib/auth-context';
import { LoginPage } from './components/LoginPage';

/**
 * URL sync: updates browser URL when project/file changes.
 * Format: ?project={projectId}&file={fileId}&page={page}
 * Users can share these URLs directly. Easy to add more filters later.
 */
function UrlSync() {
  const { state, setActiveProject, setActiveFile } = useApp();

  // Sync state → URL query params
  useEffect(() => {
    const params = new URLSearchParams();
    if (state.activeProject) {
      params.set('project', state.activeProject.id);
      if (state.activeFileId) {
        params.set('file', state.activeFileId);
      }
      if (state.activePage && state.activePage > 1) {
        params.set('page', String(state.activePage));
      }
    }
    const search = params.toString();
    const newUrl = search ? `?${search}` : '/';
    if (window.location.search !== `?${search}` && !(newUrl === '/' && !window.location.search)) {
      window.history.replaceState(null, '', newUrl);
    }
  }, [state.activeProject?.id, state.activeFileId, state.activePage]);

  // On mount: parse URL query params → restore state
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const projectId = params.get('project');
    if (projectId && !state.activeProject) {
      setActiveProject({ id: projectId, name: '', role: 'Owner', age: '', hasImage: false });
    }
  }, []);

  return null;
}

function AppContent() {
  const { state, closeConfigModal, setActiveProject } = useApp();
  const [initialLoad, setInitialLoad] = React.useState(true);

  // Warn user before leaving if upload/analysis is in progress
  useEffect(() => {
    const hasActiveProcess = state.files.some(f => f.status === 'UPLOADING' || f.status === 'ANALYZING');
    const handler = (e: BeforeUnloadEvent) => {
      if (hasActiveProcess) {
        e.preventDefault();
        e.returnValue = 'Upload or analysis is still in progress. Changes may be lost if you leave.';
        return e.returnValue;
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [state.files]);

  // On mount: if URL has ?project=..., restore project view immediately
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const projectId = params.get('project');
    if (projectId && !state.activeProject) {
      setActiveProject({ id: projectId, name: '', role: 'Owner', age: '', hasImage: false });
    }
    setInitialLoad(false);
  }, []);

  // While checking URL on first load, show nothing (prevents flash of ProjectDashboard)
  if (initialLoad && window.location.search.includes('project=')) {
    return (
      <div className="min-h-screen bg-[#0f1117] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-[#10b981] border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm text-[#858585]">Loading project...</p>
        </div>
      </div>
    );
  }

  if (state.currentView === 'projects') {
    return (
      <>
        <UrlSync />
        <ProjectDashboard />
      </>
    );
  }

  return (
    <div className="flex flex-col h-screen w-full overflow-hidden bg-editor-bg text-fg font-sans antialiased text-[14px]">
      <UrlSync />
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
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
              <MainEditor />
              <AnalysisTerminal />
            </div>
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
        targetFileIds={state.configTargetFileIds}
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
