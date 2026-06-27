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
import { AdminConsole } from './components/AdminConsole';
import { ModelLabConsole } from './components/ModelLabConsole';
import { RequireAdmin } from './components/RequireAdmin';
import { ElementIQBot } from './components/ElementIQBot';
import { RequireAuth } from './components/RequireAuth';
import { AuthProvider, useAuth } from './lib/auth-context';
import { usePresenceHeartbeat } from './hooks/usePresenceHeartbeat';
import { hasProjectSessionCache } from './lib/projectSessionCache';
import { LoginPage } from './components/LoginPage';
import {
  ProjectAccessError,
  ProjectAccessErrorKind,
  ProjectReconnecting,
} from './components/ProjectAccessError';
import { ProjectLoadingScreen } from './components/ProjectLoadingScreen';
import { LoadingScreen } from './components/LoadingScreen';
import { loginPath } from './lib/authRoutes';
import {
  buildEditorSearchParams,
  editorStateMatchesUrl,
  normalizeEditorSearch,
} from './lib/editorUrlState';

const PROJECT_LOAD_MAX_RETRIES = 3;
const PROJECT_LOAD_RETRY_DELAY_SEC = 5;

function sleep(ms: number, signal?: { cancelled: boolean }): Promise<void> {
  return new Promise((resolve) => {
    let check: number | undefined;
    const id = window.setTimeout(() => {
      if (check !== undefined) window.clearInterval(check);
      resolve();
    }, ms);
    if (signal) {
      check = window.setInterval(() => {
        if (signal.cancelled) {
          window.clearTimeout(id);
          if (check !== undefined) window.clearInterval(check);
          resolve();
        }
      }, 50);
    }
  });
}

/** Home: workspace dashboard. Legacy ?project= links redirect to /projects/:id */
function HomePage() {
  const [searchParams] = useSearchParams();
  const projectId = searchParams.get('project');
  if (projectId) {
    const next = new URLSearchParams(searchParams);
    next.delete('project');
    const qs = next.toString();
    return <Navigate to={`/projects/${projectId}${qs ? `?${qs}` : ''}`} replace />;
  }
  return <ProjectDashboard activeTab="dashboard" />;
}

/**
 * Keeps editor URLs in sync with session state (shareable query params).
 */
function UrlSync() {
  const { state, applyEditorUrlFromSearch } = useApp();
  const navigate = useNavigate();
  const location = useLocation();
  const applyingUrlRef = useRef(false);
  const lastSearchRef = useRef(location.search);

  useEffect(() => {
    if (state.currentView !== 'editor' || !state.activeProject) return;
    if (lastSearchRef.current === location.search) return;
    lastSearchRef.current = location.search;

    const currentSearch = normalizeEditorSearch(location.search);
    if (editorStateMatchesUrl(state, currentSearch)) return;

    applyingUrlRef.current = true;
    applyEditorUrlFromSearch(location.search);
    queueMicrotask(() => {
      applyingUrlRef.current = false;
    });
  }, [location.search, state.currentView, state.activeProject?.id, applyEditorUrlFromSearch, state]);

  useEffect(() => {
    if (applyingUrlRef.current) return;
    if (state.currentView !== 'editor' || !state.activeProject || state.isLoadingFiles) return;

    const built = buildEditorSearchParams(state);
    const currentSearch = normalizeEditorSearch(location.search);
    if (built === currentSearch) return;

    const nextPath = `/projects/${state.activeProject.id}`;
    const nextUrl = `${nextPath}${built ? `?${built}` : ''}`;
    navigate(nextUrl, { replace: true });
  }, [
    state.currentView,
    state.activeProject?.id,
    state.activeFileId,
    state.activePage,
    state.activeSidebarTab,
    state.isSidebarOpen,
    state.isValidationOpen,
    state.activeArtifact?.id,
    state.editorView,
    state.explorerSort,
    state.explorerStatus,
    state.overlayQa,
    state.overlaySplit,
    state.overlayTitles,
    state.overlayViewports,
    state.overlayViewportCoords,
    state.overlayTags,
    navigate,
    location.search,
    state.isLoadingFiles,
  ]);

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
  const [accessError, setAccessError] = useState<ProjectAccessErrorKind | null>(null);
  const [booting, setBooting] = useState(true);
  const [reconnecting, setReconnecting] = useState(false);
  const [retryAttempt, setRetryAttempt] = useState(0);
  const [retryCountdown, setRetryCountdown] = useState(0);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const prevProjectIdRef = useRef<string | null>(null);
  const loadGenerationRef = useRef(0);

  useLayoutEffect(() => {
    if (!projectId) return;

    const generation = ++loadGenerationRef.current;
    const signal = { cancelled: false };
    const isNewProject = prevProjectIdRef.current !== projectId;
    prevProjectIdRef.current = projectId;

    if (isNewProject) {
      const cached = hasProjectSessionCache(projectId, user?.id ?? null);
      setBooting(!cached);
      setAccessError(null);
      setReconnecting(false);
      setRetryAttempt(0);
      setRetryCountdown(0);
    }

    void (async () => {
      for (let attempt = 1; attempt <= PROJECT_LOAD_MAX_RETRIES; attempt += 1) {
        if (signal.cancelled || generation !== loadGenerationRef.current) return;

        if (attempt > 1) {
          setReconnecting(true);
          setRetryAttempt(attempt);
          for (let sec = PROJECT_LOAD_RETRY_DELAY_SEC; sec > 0; sec -= 1) {
            if (signal.cancelled || generation !== loadGenerationRef.current) return;
            setRetryCountdown(sec);
            await sleep(1000, signal);
          }
          setRetryCountdown(0);
        }

        const result = await loadProjectEditor(projectId, user?.id ?? null);
        if (signal.cancelled || generation !== loadGenerationRef.current) return;

        if (result === 'unauthorized') {
          navigate(loginPath(`${location.pathname}${location.search}`), { replace: true });
          return;
        }
        if (result === 'not_found') {
          setAccessError('not_found');
          setBooting(false);
          setReconnecting(false);
          return;
        }
        if (result === 'error') {
          if (attempt < PROJECT_LOAD_MAX_RETRIES) continue;
          setAccessError('error');
          setBooting(false);
          setReconnecting(false);
          return;
        }

        setAccessError(null);
        setBooting(false);
        setReconnecting(false);
        return;
      }
    })();

    return () => {
      signal.cancelled = true;
    };
  }, [projectId, user?.id, navigate, loadProjectEditor, loadAttempt]);

  if (!projectId) {
    return <Navigate to="/" replace />;
  }

  if (accessError) {
    return (
      <ProjectAccessError
        kind={accessError}
        onRetry={
          accessError === 'error'
            ? () => {
                setAccessError(null);
                setBooting(true);
                setReconnecting(false);
                setRetryAttempt(0);
                setRetryCountdown(0);
                setLoadAttempt((n) => n + 1);
              }
            : undefined
        }
        onBack={() => navigate('/')}
        retrying={booting}
      />
    );
  }

  if (reconnecting) {
    return (
      <ProjectReconnecting
        attempt={retryAttempt}
        maxAttempts={PROJECT_LOAD_MAX_RETRIES}
      />
    );
  }

  const projectReady = state.activeProject?.id === projectId;
  if (booting && !projectReady) {
    return <ProjectLoadingScreen mode="full" />;
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
        path="/admin"
        element={
          <RequireAuth>
            <RequireAdmin area="admin">
              <AdminConsole />
            </RequireAdmin>
          </RequireAuth>
        }
      />
      <Route
        path="/model-lab"
        element={
          <RequireAuth>
            <RequireAdmin area="model-lab">
              <ModelLabConsole />
            </RequireAdmin>
          </RequireAuth>
        }
      />
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
  usePresenceHeartbeat();

  if (loading) {
    return (
      <LoadingScreen
        showBrand
        spinnerSize="lg"
        eyebrow="Element IQ"
        title="Starting workspace"
        subtitle="Loading your session"
        showProgress={false}
      />
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
