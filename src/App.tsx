import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
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
import { AccountSettings } from './components/AccountSettings';
import { ElementIQBot } from './components/ElementIQBot';
import { RequireAuth } from './components/RequireAuth';
import { AuthProvider, useAuth } from './lib/auth-context';
import { LoginPage } from './components/LoginPage';
import { loginPath } from './lib/authRoutes';

/** Home: workspace dashboard. Legacy ?project= links redirect to /projects/:id */
function HomePage() {
  const [searchParams] = useSearchParams();
  const projectId = searchParams.get('project');
  if (projectId) {
    const next = new URLSearchParams();
    const file = searchParams.get('file');
    const page = searchParams.get('page');
    if (file) next.set('file', file);
    if (page) next.set('page', page);
    const qs = next.toString();
    return <Navigate to={`/projects/${projectId}${qs ? `?${qs}` : ''}`} replace />;
  }
  return <ProjectDashboard activeTab="dashboard" />;
}

/**
 * Keeps editor URLs in sync: /projects/{id}?file=&page=
 */
function UrlSync() {
  const { state } = useApp();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (state.currentView !== 'editor' || !state.activeProject) return;

    const params = new URLSearchParams();
    if (state.activeFileId) params.set('file', state.activeFileId);
    if (state.activePage && state.activePage > 1) params.set('page', String(state.activePage));
    const search = params.toString();
    const nextPath = `/projects/${state.activeProject.id}`;
    const nextUrl = `${nextPath}${search ? `?${search}` : ''}`;
    const current = `${location.pathname}${location.search}`;
    if (current !== nextUrl) {
      navigate(nextUrl, { replace: true });
    }
  }, [state.currentView, state.activeProject?.id, state.activeFileId, state.activePage, navigate, location.pathname, location.search]);

  return null;
}

function EditorLayout() {
  const { state, closeConfigModal } = useApp();

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

function ProjectEditorPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { state, loadProjectEditor } = useApp();
  const [accessError, setAccessError] = useState<string | null>(null);
  const [booting, setBooting] = useState(true);
  const prevProjectIdRef = useRef<string | null>(null);

  useLayoutEffect(() => {
    if (!projectId) return;

    let cancelled = false;
    const isNewProject = prevProjectIdRef.current !== projectId;
    prevProjectIdRef.current = projectId;

    if (isNewProject) {
      setBooting(true);
      setAccessError(null);
    }

    void (async () => {
      const result = await loadProjectEditor(projectId, user?.id ?? null);
      if (cancelled) return;

      if (result === 'unauthorized') {
        navigate(loginPath(`${location.pathname}${location.search}`), { replace: true });
        return;
      }
      if (result === 'not_found') {
        setAccessError('Project not found.');
        setBooting(false);
        return;
      }
      if (result === 'error') {
        setAccessError('Unable to open this project.');
        setBooting(false);
        return;
      }

      setAccessError(null);
      setBooting(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [projectId, user?.id, navigate, location.pathname, location.search, loadProjectEditor]);

  if (!projectId) {
    return <Navigate to="/" replace />;
  }

  if (accessError) {
    return (
      <div className="min-h-screen bg-[#0f1117] flex flex-col items-center justify-center gap-4 px-6">
        <p className="text-sm text-[#b0b0b0]">{accessError}</p>
        <button
          type="button"
          onClick={() => navigate('/')}
          className="px-4 py-2 rounded-md bg-[#10b981] hover:bg-[#059669] text-white text-sm font-semibold transition-colors"
        >
          Back to dashboard
        </button>
      </div>
    );
  }

  const projectReady = state.activeProject?.id === projectId;
  if (booting && !projectReady) {
    return (
      <div className="min-h-screen bg-[#0f1117] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-[#10b981] border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-[#b0b0b0]">Loading project...</p>
        </div>
      </div>
    );
  }

  return <EditorLayout />;
}

function AppContent() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/projects" element={<ProjectDashboard activeTab="projects" />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/account" element={<RequireAuth><AccountSettings /></RequireAuth>} />
      <Route
        path="/projects/:projectId"
        element={<ProjectEditorPage />}
      />
      <Route path="/projects/dashboard" element={<Navigate to="/" replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function AppShell() {
  const { loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0f1117] flex items-center justify-center">
        <div className="text-[#10b981] text-lg font-medium animate-pulse">Loading...</div>
      </div>
    );
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
      <BrowserRouter>
        <AppShell />
      </BrowserRouter>
    </AuthProvider>
  );
}
