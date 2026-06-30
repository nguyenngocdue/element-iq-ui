import React, { createContext, useContext, useState, useCallback } from 'react';
import { SessionState, DocumentFile, Component, Project, AnalysisLogLine } from './types';
import { dedupeArtifactsForDisplay, filterArtifactsForFile } from './lib/fileView';
import { parseViewSplitFromAnalysis, parseViewSplitFromReport } from './lib/viewSplit';
import { parseTagNotesFromAnalysis, parseTagNotesFromReport } from './lib/tagNotes';
import { parseViewTitlesFromAnalysis, parseViewTitlesFromReport } from './lib/viewTitles';
import { fetchViewPanelsForFile, parseViewPanelsFromReport } from './lib/viewPanels';
import {
  hasAnalysisPayload,
  resolveFileStatusFromAnalysis,
  reconcileFileStatusWithAnnotations,
  mapOverallToFileStatus,
  resolveOverallRaw,
  resolvePassRate,
} from './lib/analysisStatus';
import {
  countDetectedTubes,
  mapObjectDetections,
  mapValidationAnnotations,
} from './lib/mapAnalysis';
import { analysisStageFromProgress, ELEMENTIQ_ENGINE } from './lib/engineBranding';
import { normalizeSelectedComponents } from './lib/analysisComponents';
import { hydrateViewPanelsForDocIds, hydrateViewPanelForDoc } from './lib/hydrateViewPanels';
import { fetchArtifactText } from './lib/fetchArtifact';
import {
  formatWorkerLogMessage,
  levelForServerLogLine,
  parseJobIdFromStatusUrl,
  resolveQueueConcurrencyFromHealth,
} from './lib/analysisServerLog';
import { disposeDocumentFile, disposeDocumentFilesInPlace } from './lib/sessionDispose';
import {
  applyGuestRunSnapshot,
  buildGuestRunSnapshot,
  getGuestRunViewerKey,
  loadGuestRunSnapshot,
  saveGuestRunSnapshot,
} from './lib/guestRunStorage';
import { normalizePublicAccessLevel, resolveProjectCapabilities } from './lib/projectAccess';
import {
  readProjectSessionCache,
  writeProjectSessionCache,
  projectSnapshotChanged,
  type CachedProjectMeta,
} from './lib/projectSessionCache';
import {
  fetchProjectEditorSnapshot,
  metaFromProjectApi,
  persistProjectSessionCache,
} from './lib/projectCacheSync';
import {
  getCachedPdfBlob,
  pdfVersionKey,
  putCachedPdfBlob,
  removeCachedPdfBlob,
} from './lib/pdfBlobCache';
import {
  buildStateFromNavEntry,
  EditorNavigationHistory,
  sameNavEntry,
  snapshotEditorNav,
  type EditorNavEntry,
} from './lib/editorNavigationHistory';
import { parseEditorUrlParams } from './lib/editorUrlState';
import {
  readEditorLayoutPrefs,
  resolveLayoutOpenFromSearch,
  writeEditorLayoutPrefs,
} from './lib/editorLayoutPrefs';
import {
  DEFAULT_EXPLORER_SORT,
  DEFAULT_EXPLORER_STATUS,
  readExplorerViewPrefs,
  type ExplorerSortKey,
  type ExplorerStatusFilter,
  writeExplorerViewPrefs,
} from './lib/fileView';
import * as pdfjsLib from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.mjs`;

function buildModelLogLines(
  selectedComps: string[],
  availableComponents: Component[],
  componentConfidence: Record<string, number>,
  confidenceThreshold: number,
  componentModels: Record<string, string>,
): string[] {
  return selectedComps.map((compId) => {
    const meta = availableComponents.find((c) => c.id === compId);
    const conf = ((componentConfidence[compId] ?? confidenceThreshold) * 100).toFixed(0);
    const modelFile = (componentModels[compId] || meta?.modelFile || '').trim();
    const label = meta?.name ?? compId;
    const statusTag =
      meta?.status === 'missing' ? ' · MISSING' : meta?.status === 'training' ? ' · TRAINING' : '';
    if (modelFile) {
      return `${label} · ${modelFile} · conf ${conf}%${statusTag}`;
    }
    return `${label} · conf ${conf}% · model unknown${statusTag}`;
  });
}

function mapAnalysisFields(analysis: any) {
  const components = analysis?.component_results ?? [];
  return {
    detections: mapObjectDetections(components),
    validationAnnotations: mapValidationAnnotations(components),
    tubeCount: countDetectedTubes(components),
  };
}

function mapApiProjectFiles(files: any[]): DocumentFile[] {
  return files.map((f: any) => {
    let status: DocumentFile['status'] = 'PENDING';
    let detections: DocumentFile['detections'] = [];
    let validationAnnotations: DocumentFile['validationAnnotations'];
    let tubeCount: number | undefined;
    let passRate: number | undefined;
    let analyzedComponents: string[] | undefined;

    let overallStatus: string | undefined;
    if (f.analysis) {
      const hasAnalysis = hasAnalysisPayload(f.analysis);
      const mapped = mapAnalysisFields(f.analysis);
      detections = mapped.detections;
      validationAnnotations = mapped.validationAnnotations;
      tubeCount = mapped.tubeCount;
      const resolved = resolveFileStatusFromAnalysis(
        f.analysis,
        validationAnnotations,
        hasAnalysis,
        tubeCount ?? 0,
      );
      status = resolved.status;
      overallStatus = resolved.overallRaw ? resolved.overallRaw.toUpperCase() : undefined;
      passRate = resolvePassRate(f.analysis, resolved.overallRaw.toUpperCase(), status);
      analyzedComponents = f.analysis.component_results?.map((c: any) => c.component_id);
    }

    return {
      id: f.id,
      name: f.original_filename,
      file: new File([], f.original_filename, { type: 'application/pdf' }),
      status,
      overallStatus,
      pages: f.page_count || 1,
      detections,
      validationAnnotations,
      tubeCount,
      passRate,
      analyzedComponents,
      analysisJobId: f.analysis?.job_id ? String(f.analysis.job_id) : undefined,
      viewSplit: parseViewSplitFromAnalysis(f.analysis),
      viewTitles: parseViewTitlesFromAnalysis(f.analysis),
      tagNotes: parseTagNotesFromAnalysis(f.analysis),
      uploadedAt: f.uploaded_at,
      localPath: f.local_path,
      fileSizeBytes: f.file_size_bytes,
      artifacts: dedupeArtifactsForDisplay(
        filterArtifactsForFile(
        (f.analysis?.artifacts ?? []).map((a: any) => ({
          id: a.id,
          type: a.artifact_type,
          downloadUrl: a.download_url
            ? `${a.download_url}${a.download_url.includes('?') ? '&' : '?'}v=${a.id}`
            : a.download_url,
          sourceFileId: a.source_file_id ?? f.id,
          localPath: a.local_path,
          fileSizeBytes: a.file_size_bytes,
          originalFilename: a.original_filename,
          contentType: a.content_type,
          createdAt: a.created_at,
        })),
        f.id,
        f.original_filename,
        ),
      ),
      events: [{
        id: Date.now().toString(),
        timestamp: f.uploaded_at || new Date().toISOString(),
        message: 'Loaded from server',
        type: 'INFO' as const,
      }],
    };
  });
}

function mergeGuestRunResults(
  projectId: string,
  docs: DocumentFile[],
  viewerKey: string | null,
  isOwner: boolean,
): DocumentFile[] {
  if (isOwner || !viewerKey) return docs;
  return docs.map((doc) => {
    const snapshot = loadGuestRunSnapshot(projectId, doc.id, viewerKey);
    return snapshot ? applyGuestRunSnapshot(doc, snapshot) : doc;
  });
}

function resolveUrlEditorFields(docs: DocumentFile[], search?: string) {
  const params = new URLSearchParams(search ?? window.location.search);
  const parsed = parseEditorUrlParams(params);
  const layoutPrefs = readEditorLayoutPrefs();
  const initialFileId =
    parsed.fileId && docs.some((d) => d.id === parsed.fileId)
      ? parsed.fileId
      : docs.length > 0
        ? docs[0].id
        : null;

  let activeArtifact: SessionState['activeArtifact'] = null;
  let editorView: SessionState['editorView'] = 'pdf';
  if (parsed.editorView === 'artifact' && parsed.artifactId && initialFileId) {
    const file = docs.find((d) => d.id === initialFileId);
    const artifact = file?.artifacts?.find((a) => a.id === parsed.artifactId);
    if (artifact) {
      activeArtifact = {
        id: artifact.id,
        type: artifact.type,
        downloadUrl: artifact.downloadUrl,
        name: artifact.originalFilename ?? artifact.type,
        sourceFileId: initialFileId,
      };
      editorView = 'artifact';
    }
  }

  const activePage = initialFileId === parsed.fileId ? parsed.page : 1;

  return {
    initialFileId,
    urlFileId: parsed.fileId,
    parsedPage: activePage,
    patchFromUrl: {
      activeFileId: initialFileId,
      openFiles: initialFileId ? [initialFileId] : [],
      activePage,
      activeSidebarTab: parsed.tab,
      isSidebarOpen: resolveLayoutOpenFromSearch(params, 'sb', layoutPrefs.isSidebarOpen),
      isValidationOpen: resolveLayoutOpenFromSearch(params, 'panel', layoutPrefs.isValidationOpen),
      activeArtifact,
      editorView,
      explorerSort: parsed.explorerSort,
      explorerStatus: parsed.explorerStatus,
      overlayQa: parsed.overlayQa,
      overlaySplit: parsed.overlaySplit,
      overlayTitles: parsed.overlayTitles,
      overlayViewports: parsed.overlayViewports,
      overlayViewportCoords: parsed.overlayViewportCoords,
      overlayTags: parsed.overlayTags,
      overlayTagDetach: parsed.overlayTagDetach,
    } satisfies Partial<SessionState>,
  };
}

function resolveUrlFileSelection(docs: DocumentFile[]) {
  const { initialFileId, parsedPage, urlFileId } = resolveUrlEditorFields(docs);
  return { initialFileId, parsedPage, urlFileId };
}

function editorStateFromProjectApi(
  data: CachedProjectMeta,
  rawFiles: unknown[],
  projectId: string,
  userId: string | null | undefined,
) {
  const isOwner = Boolean(userId && data.owner_id === userId);
  const publicAccessLevel = normalizePublicAccessLevel(data.public_access_level);
  const caps = resolveProjectCapabilities(isOwner, Boolean(data.is_public), publicAccessLevel);
  const viewerKey = getGuestRunViewerKey(userId);
  const docs = mergeGuestRunResults(
    projectId,
    mapApiProjectFiles(rawFiles as any[]),
    viewerKey,
    isOwner,
  );
  const { initialFileId, patchFromUrl } = resolveUrlEditorFields(docs);

  return {
    initialFileId,
    docs,
    patch: {
      activeProject: {
        id: data.id,
        name: data.name,
        role: isOwner ? 'Owner' : 'Viewer',
        age: '',
        hasImage: false,
        description: data.description ?? undefined,
        ownerId: data.owner_id,
        isPublic: data.is_public,
        isReadOnly: caps.isReadOnly,
        publicAccessLevel,
      },
      ...caps,
      isProjectOwner: isOwner,
      guestViewerKey: viewerKey,
      currentView: 'editor' as const,
      files: docs,
      isLoadingFiles: false,
      ...patchFromUrl,
    },
  };
}

function mergeDocsWithExistingFiles(
  docs: DocumentFile[],
  prevFiles: DocumentFile[],
): DocumentFile[] {
  const prevById = new Map(prevFiles.map((f) => [f.id, f]));
  return docs.map((d) => {
    const existing = prevById.get(d.id);
    if (!existing) return d;
    const base = {
      ...d,
      file: existing.file.size > 0 ? existing.file : d.file,
      viewPanels: existing.viewPanels ?? d.viewPanels,
      pdfLoadError: existing.file.size > 0 ? undefined : existing.pdfLoadError ?? d.pdfLoadError,
    };
    if (existing.status === 'ANALYZING') {
      return {
        ...base,
        status: existing.status,
        overallStatus: existing.overallStatus,
        passRate: existing.passRate,
        detections: existing.detections,
        validationAnnotations: existing.validationAnnotations,
        tubeCount: existing.tubeCount,
        analysisProgress: existing.analysisProgress,
        analysisStage: existing.analysisStage,
        analysisJobId: existing.analysisJobId,
        artifacts: existing.artifacts ?? base.artifacts,
        viewSplit: existing.viewSplit ?? base.viewSplit,
        viewTitles: existing.viewTitles ?? base.viewTitles,
        tagNotes: existing.tagNotes ?? base.tagNotes,
      };
    }
    if (
      existing.analysisJobId
      && d.analysisJobId
      && existing.analysisJobId !== d.analysisJobId
      && existing.analysisStage === 'Complete'
    ) {
      return {
        ...base,
        status: existing.status,
        overallStatus: existing.overallStatus,
        passRate: existing.passRate,
        detections: existing.detections,
        validationAnnotations: existing.validationAnnotations,
        tubeCount: existing.tubeCount,
        analysisStage: existing.analysisStage,
        analysisProgress: existing.analysisProgress,
        analysisJobId: existing.analysisJobId,
        artifacts: existing.artifacts ?? base.artifacts,
        viewSplit: existing.viewSplit ?? base.viewSplit,
        viewTitles: existing.viewTitles ?? base.viewTitles,
        tagNotes: existing.tagNotes ?? base.tagNotes,
      };
    }
    if (d.status === 'NO-TUBE' || d.status === 'NO-NOTE') {
      return base;
    }
    if (
      existing.analysisStage === 'Complete'
      && existing.validationAnnotations?.length
    ) {
      const tubes = existing.tubeCount ?? existing.detections?.length ?? d.tubeCount ?? 0;
      const baseForReconcile = existing.overallStatus
        ? mapOverallToFileStatus(existing.overallStatus, true)
        : existing.status;
      const localStatus = reconcileFileStatusWithAnnotations(
        baseForReconcile,
        existing.validationAnnotations,
        tubes,
      );
      if (
        localStatus !== d.status
        && localStatus !== 'NO-TUBE'
        && !(localStatus === 'PASS' && (d.tubeCount ?? 0) === 0)
      ) {
        return {
          ...base,
          status: localStatus,
          overallStatus: localStatus.toUpperCase(),
          passRate: localStatus === 'PASS' ? (existing.passRate ?? 100) : 0,
          detections: existing.detections?.length ? existing.detections : base.detections,
          validationAnnotations: existing.validationAnnotations,
          tubeCount: existing.tubeCount ?? base.tubeCount,
          analysisStage: existing.analysisStage,
          analysisProgress: existing.analysisProgress,
          analysisJobId: existing.analysisJobId ?? base.analysisJobId,
          artifacts: base.artifacts ?? existing.artifacts,
          viewSplit: existing.viewSplit ?? base.viewSplit,
          viewTitles: existing.viewTitles ?? base.viewTitles,
          tagNotes: existing.tagNotes ?? base.tagNotes,
        };
      }
    }
    return base;
  });
}

const pdfFetchInflight = new Map<string, Promise<void>>();

async function prefetchProjectPdf(
  doc: DocumentFile,
  loadSessionId: number,
  isSessionCurrent: (id: number) => boolean,
  setState: React.Dispatch<React.SetStateAction<SessionState>>,
) {
  const versionKey = pdfVersionKey(doc.uploadedAt, doc.fileSizeBytes);

  const setPdfLoading = (loading: boolean) => {
    setState((prev) => {
      if (!isSessionCurrent(loadSessionId)) return prev;
      return {
        ...prev,
        files: prev.files.map((f) =>
          f.id === doc.id ? { ...f, pdfLoading: loading } : f,
        ),
      };
    });
  };

  const applyBlob = (blob: Blob) => {
    const realFile = new File([blob], doc.name, { type: 'application/pdf' });
    setState((prev) => {
      if (!isSessionCurrent(loadSessionId)) return prev;
      return {
        ...prev,
        files: prev.files.map((f) =>
          f.id === doc.id ? { ...f, file: realFile, pdfLoadError: undefined } : f,
        ),
      };
    });
  };

  const setPdfLoadError = (message: string) => {
    setState((prev) => {
      if (!isSessionCurrent(loadSessionId)) return prev;
      return {
        ...prev,
        files: prev.files.map((f) =>
          f.id === doc.id ? { ...f, pdfLoadError: message } : f,
        ),
      };
    });
  };

  setPdfLoading(true);
  try {
    const cached = await getCachedPdfBlob(doc.id, versionKey);
    if (cached && isSessionCurrent(loadSessionId)) {
      applyBlob(cached);
      return;
    }

    const { authFetch } = await import('./lib/supabase');
    const dlRes = await authFetch(`/api/v1/files/${doc.id}/download`);
    if (!isSessionCurrent(loadSessionId)) return;
    if (!dlRes.ok) {
      const detail = await dlRes.text().catch(() => '');
      let message = `HTTP ${dlRes.status}`;
      try {
        const parsed = JSON.parse(detail);
        if (parsed.detail) message = typeof parsed.detail === 'string' ? parsed.detail : message;
      } catch {
        if (detail) message = detail.slice(0, 120);
      }
      setPdfLoadError(message);
      return;
    }
    const blob = await dlRes.blob();
    if (!isSessionCurrent(loadSessionId)) return;
    if (blob.size === 0) {
      setPdfLoadError('Downloaded PDF is empty');
      return;
    }
    void putCachedPdfBlob(doc.id, versionKey, blob);
    applyBlob(blob);
  } catch (err) {
    if (!isSessionCurrent(loadSessionId)) return;
    setPdfLoadError(err instanceof Error ? err.message : 'Failed to download PDF');
  } finally {
    setPdfLoading(false);
  }
}

export type DeleteFilesOptions = {
  /** Remove drawing PDF + file record from the project. Default true. */
  removeFile?: boolean;
  /** Delete jobs, artifacts, and analysis rows (Supabase + disk). Default true. */
  purgeAnalysis?: boolean;
};

function analysisResetPatch(): Partial<DocumentFile> {
  return {
    status: 'PENDING',
    overallStatus: undefined,
    passRate: undefined,
    detections: [],
    validationAnnotations: undefined,
    tubeCount: undefined,
    analyzedComponents: undefined,
    analysisJobId: undefined,
    analysisProgress: undefined,
    analysisStage: undefined,
    artifacts: [],
    viewSplit: undefined,
    viewTitles: undefined,
    tagNotes: undefined,
    viewPanels: undefined,
  };
}

interface AppContextType {
  state: SessionState;
  addFiles: (files: File[]) => void;
  setActiveFile: (id: string, page?: number, options?: { skipHistory?: boolean }) => void;
  goBackInEditor: () => void;
  goForwardInEditor: () => void;
  editorNavCanBack: boolean;
  editorNavCanForward: boolean;
  closeFile: (id: string) => void;
  closeOthers: (id: string) => void;
  closeToRight: (id: string) => void;
  closeAll: () => void;
  togglePin: (id: string) => void;
  splitEditor: (direction: 'none' | 'up' | 'down' | 'left' | 'right', fileId?: string) => void;
  setActiveSidebarTab: (tab: SessionState['activeSidebarTab']) => void;
  toggleSidebar: () => void;
  toggleValidation: () => void;
  setConfidenceThreshold: (val: number) => void;
  clearSession: (
    onProgress?: (current: number, total: number, filename: string) => void,
    options?: DeleteFilesOptions,
  ) => Promise<void>;
  deleteFiles: (
    ids: string[],
    onProgress?: (current: number, total: number, filename: string) => void,
    options?: DeleteFilesOptions,
  ) => Promise<void>;
  renameFile: (id: string, newName: string) => Promise<void>;
  updateFileStatus: (id: string, updates: Partial<DocumentFile>) => void;
  analyzeFile: (id: string, opts?: { workerId?: number }) => Promise<void>;
  analyzeAll: (orderedIds?: string[]) => Promise<void>;
  analyzeSelected: (ids: string[]) => Promise<void>;
  stopAnalysis: () => void;
  dismissAnalysisProgressOverlay: () => void;
  showAnalysisProgressOverlay: () => void;
  appendAnalysisLog: (entry: Omit<AnalysisLogLine, 'id' | 'ts'>) => void;
  clearAnalysisLogs: () => void;
  toggleAnalysisTerminal: () => void;
  setSelectedComponents: (ids: string[]) => void;
  setComponentConfidence: (id: string, confidence: number) => void;
  setComponentModel: (id: string, modelFile: string) => void;
  toggleComponent: (id: string) => void;
  openConfigModal: (mode: 'import' | 'reanalyze', fileId?: string, fileIds?: string[]) => void;
  closeConfigModal: () => void;
  setCurrentView: (view: 'projects' | 'editor') => void;
  setActiveProject: (project: Project, options?: { forceReload?: boolean }) => void;
  loadProjectEditor: (
    projectId: string,
    userId?: string | null,
  ) => Promise<'ok' | 'unauthorized' | 'not_found' | 'error'>;
  disposeProjectSession: () => void;
  refreshProjectFiles: (options?: { silent?: boolean; focusFileIds?: string[] }) => Promise<void>;
  toggleBot: () => void;
  setActiveArtifact: (artifact: SessionState['activeArtifact'], options?: { skipHistory?: boolean }) => void;
  setEditorView: (view: 'pdf' | 'artifact') => void;
  setExplorerSort: (sort: ExplorerSortKey) => void;
  setExplorerStatus: (status: ExplorerStatusFilter) => void;
  setViewerOverlay: (key: 'qa' | 'split' | 'titles' | 'viewports' | 'coords' | 'tags' | 'tagDetach', value: boolean) => void;
  applyEditorUrlFromSearch: (search: string) => void;
  retryPdfLoad: (fileId: string) => void;
}

// Mock available components (P0: grout-tube ready, others not ready)
// Load saved config from localStorage
const savedLayout = readEditorLayoutPrefs();

const bootSearch =
  typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;

const bootLayout = bootSearch
  ? {
      isSidebarOpen: resolveLayoutOpenFromSearch(bootSearch, 'sb', savedLayout.isSidebarOpen),
      isValidationOpen: resolveLayoutOpenFromSearch(
        bootSearch,
        'panel',
        savedLayout.isValidationOpen,
      ),
    }
  : savedLayout;

const savedConfig = (() => {
  try {
    const raw = localStorage.getItem('elementiq:analysis-config');
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
})();

const bootUrlPrefs = (() => {
  try {
    if (typeof window === 'undefined') return null;
    return parseEditorUrlParams(new URLSearchParams(window.location.search));
  } catch {
    return null;
  }
})();

const savedExplorerSort = (() => {
  try {
    return readExplorerViewPrefs().sort;
  } catch {
    return DEFAULT_EXPLORER_SORT;
  }
})();

const initialState: SessionState = {
  id: 'session-1',
  files: [],
  isLoadingFiles: false,
  activeFileId: null,
  openFiles: [],
  pinnedFiles: [],
  activePage: 1,
  activeSidebarTab: 'explorer',
  isSidebarOpen: bootLayout.isSidebarOpen,
  isValidationOpen: bootLayout.isValidationOpen,
  isEngineLive: true,
  confidenceThreshold: savedConfig?.confidenceThreshold ?? 0.4,
  availableComponents: [],  // loaded from API
  selectedComponents: normalizeSelectedComponents(
    savedConfig?.selectedComponents ?? ['grout-tube'],
  ),
  componentConfidence: savedConfig?.componentConfidence ?? { 'grout-tube': 0.40 },
  componentModels: savedConfig?.componentModels ?? {},
  showConfigModal: false,
  configModalMode: 'import',
  currentView: 'projects',
  isBotOpen: false,
  splitMode: 'none',
  splitFileId: null,
  editorView: 'pdf',
  isAnalysisTerminalOpen: false,
  analysisLogs: [],
  analysisQueue: null,
  explorerSort: bootUrlPrefs?.explorerSort ?? savedExplorerSort,
  explorerStatus: bootUrlPrefs?.explorerStatus ?? DEFAULT_EXPLORER_STATUS,
  overlayQa: bootUrlPrefs?.overlayQa ?? true,
  overlaySplit: bootUrlPrefs?.overlaySplit ?? true,
  overlayTitles: bootUrlPrefs?.overlayTitles ?? false,
  overlayViewports: bootUrlPrefs?.overlayViewports ?? false,
  overlayViewportCoords: bootUrlPrefs?.overlayViewportCoords ?? false,
  overlayTags: bootUrlPrefs?.overlayTags ?? true,
  overlayTagDetach: bootUrlPrefs?.overlayTagDetach ?? false,
  analysisProgressOverlayDismissed: false,
};

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<SessionState>(initialState);
  const [editorNavUi, setEditorNavUi] = useState({ canBack: false, canForward: false });
  const projectSessionRef = React.useRef(0);
  const stopAnalysisRef = React.useRef(false);
  const analysisAbortRef = React.useRef<AbortController | null>(null);
  const navHistoryRef = React.useRef(new EditorNavigationHistory());
  const stateRef = React.useRef(state);
  stateRef.current = state;
  /** Bumped when analyze commits in-memory results — stale revalidate must not overwrite. */
  const lastLocalAnalysisAtRef = React.useRef(0);
  const analyzeInFlightRef = React.useRef(0);

  function isAnalysisUiBusy(): boolean {
    if (analyzeInFlightRef.current > 0) return true;
    const s = stateRef.current;
    if (s.analysisQueue) return true;
    return s.files.some((f) => f.status === 'ANALYZING');
  }

  const syncEditorNavUi = useCallback(() => {
    setEditorNavUi({
      canBack: navHistoryRef.current.canGoBack(),
      canForward: navHistoryRef.current.canGoForward(),
    });
  }, []);

  const resetEditorNavigation = useCallback(() => {
    navHistoryRef.current.reset();
    syncEditorNavUi();
  }, [syncEditorNavUi]);

  const invalidateProjectSession = useCallback(() => {
    projectSessionRef.current += 1;
    stopAnalysisRef.current = true;
    analysisAbortRef.current?.abort();
    analysisAbortRef.current = null;
    disposeDocumentFilesInPlace(stateRef.current.files);
  }, []);

  const isSessionCurrent = useCallback(
    (sessionId: number) => sessionId === projectSessionRef.current,
    [],
  );

  /** Write-through session cache from API — keeps F5 snapshot fresh after mutations. */
  const syncProjectSessionCache = useCallback(async (
    projectId: string,
    opts?: { viewerKey?: string | null },
  ): Promise<void> => {
    const viewerKey = opts?.viewerKey ?? stateRef.current.guestViewerKey ?? null;
    const snapshot = await fetchProjectEditorSnapshot(projectId);
    if (!snapshot) return;
    persistProjectSessionCache(projectId, viewerKey, snapshot);
  }, []);

  const disposeProjectSession = useCallback(() => {
    invalidateProjectSession();
    resetEditorNavigation();
    setState((prev) => ({
      ...prev,
      files: [],
      activeFileId: null,
      openFiles: [],
      pinnedFiles: [],
      activeArtifact: null,
      editorView: 'pdf',
      activePage: 1,
      activeProject: undefined,
      isLoadingFiles: false,
      analysisQueue: null,
      analysisLogs: [],
      showConfigModal: false,
      configTargetFileId: undefined,
      configTargetFileIds: undefined,
      splitMode: 'none',
      splitFileId: null,
    }));
  }, [invalidateProjectSession]);

  React.useEffect(() => () => {
    invalidateProjectSession();
  }, [invalidateProjectSession]);

  // Load components from backend API on mount
  React.useEffect(() => {
    (async () => {
      try {
        const { authFetch } = await import('./lib/supabase');
        const res = await authFetch('/api/v1/components');
        if (res.ok) {
          const data = await res.json();
          const components = (data.components || []).map((c: any) => ({
            id: c.id,
            name: c.name,
            description: c.description || '',
            modelFile: c.model_file || '',
            classes: c.classes || [],
            accuracy: typeof c.accuracy === 'number' ? c.accuracy : null,
            status: c.status || 'missing',
            lastTrained: c.last_trained || null,
            size: c.size || null,
          }));
          setState(prev => ({ ...prev, availableComponents: components.length > 0 ? components : prev.availableComponents }));
        }
      } catch {
        // Fallback: keep empty or previously loaded
      }
    })();
  }, []);

  // Persist analysis config to localStorage when it changes
  React.useEffect(() => {
    const config = {
      selectedComponents: state.selectedComponents,
      componentConfidence: state.componentConfidence,
      componentModels: state.componentModels,
      confidenceThreshold: state.confidenceThreshold,
    };
    localStorage.setItem('elementiq:analysis-config', JSON.stringify(config));
  }, [state.selectedComponents, state.componentConfidence, state.componentModels, state.confidenceThreshold]);

  // Persist layout preferences (sidebar + validation panel)
  React.useEffect(() => {
    writeEditorLayoutPrefs({
      isSidebarOpen: state.isSidebarOpen,
      isValidationOpen: state.isValidationOpen,
    });
  }, [state.isSidebarOpen, state.isValidationOpen]);

  const updateFileStatus = useCallback((id: string, updates: Partial<DocumentFile>) => {
    setState((prev) => ({
      ...prev,
      files: prev.files.map((f) => (f.id === id ? { ...f, ...updates } : f)),
    }));
  }, []);

  const addFiles = useCallback((newFiles: File[]) => {
    const newDocs: DocumentFile[] = newFiles.map((f) => ({
      id: Math.random().toString(36).substring(7),
      name: f.name,
      file: f,
      status: 'UPLOADING',
      uploadProgress: 0,
      pages: 1,
      detections: [],
      events: [{ id: Date.now().toString(), timestamp: new Date().toISOString(), message: 'Uploading...', type: 'INFO' }],
    }));

    setState((prev) => ({
      ...prev,
      files: [...prev.files, ...newDocs],
      activeFileId: prev.activeFileId || newDocs[0]?.id || null,
      openFiles: prev.activeFileId ? prev.openFiles : (newDocs[0] ? [...prev.openFiles, newDocs[0].id] : prev.openFiles),
      activePage: prev.activeFileId ? prev.activePage : 1,
    }));
    
    // Async: read PDF pages + upload to backend
    newDocs.forEach(async (doc) => {
      try {
        updateFileStatus(doc.id, { uploadProgress: 10 });

        // Read page count (reuse buffer for upload — File blob must not be read twice)
        const arrayBuffer = await doc.file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;
        const pageCount = pdf.numPages;
        pdf.destroy();
        updateFileStatus(doc.id, { pages: pageCount, uploadProgress: 30 });

        // Upload to backend (associate with active project)
        const projectId = state.activeProject?.id;
        const uploadFile = new File([arrayBuffer], doc.file.name, {
          type: doc.file.type || 'application/pdf',
        });
        const formData = new FormData();
        formData.append('file', uploadFile, doc.file.name);
        if (projectId) {
          formData.append('project_id', projectId);
        }

        updateFileStatus(doc.id, { uploadProgress: 50 });

        const { authFetch } = await import('./lib/supabase');
        const res = await authFetch('/api/v1/files', {
          method: 'POST',
          body: formData,
        });

        if (res.ok) {
          const data = await res.json();
          updateFileStatus(doc.id, {
            status: 'PENDING',
            uploadProgress: 100,
            id: data.id || doc.id,
            events: [
              { id: Date.now().toString(), timestamp: new Date().toISOString(), message: `Uploaded successfully`, type: 'SUCCESS' },
            ],
          });
        } else {
          const errBody = await res.json().catch(() => null);
          const detail = errBody?.detail || `Upload failed: HTTP ${res.status}`;
          updateFileStatus(doc.id, {
            status: 'PENDING',
            uploadProgress: 0,
            events: [
              { id: Date.now().toString(), timestamp: new Date().toISOString(), message: detail, type: 'ERROR' },
            ],
          });
        }
      } catch (e) {
        console.error('Error processing file:', e);
        updateFileStatus(doc.id, {
          status: 'PENDING',
          uploadProgress: 0,
          events: [
            { id: Date.now().toString(), timestamp: new Date().toISOString(), message: `Error: ${e instanceof Error ? e.message : 'Unknown'}`, type: 'ERROR' },
          ],
        });
      }
    });
  }, [updateFileStatus, state.activeProject?.id]);

  const downloadFileIfNeeded = useCallback(async (id: string, sessionId: number) => {
    const doc = stateRef.current.files.find((f) => f.id === id);
    if (!doc || doc.file.size > 0) return;
    let inflight = pdfFetchInflight.get(id);
    if (!inflight) {
      inflight = prefetchProjectPdf(doc, sessionId, isSessionCurrent, setState);
      pdfFetchInflight.set(id, inflight);
      void inflight.finally(() => {
        if (pdfFetchInflight.get(id) === inflight) pdfFetchInflight.delete(id);
      });
    }
    await inflight;
  }, [isSessionCurrent]);

  const retryPdfLoad = useCallback((id: string) => {
    updateFileStatus(id, { pdfLoadError: undefined });
    void downloadFileIfNeeded(id, projectSessionRef.current);
  }, [downloadFileIfNeeded, updateFileStatus]);

  const setActiveFile = useCallback((
    id: string,
    page: number = 1,
    options?: { skipHistory?: boolean },
  ) => {
    const file = state.files.find(f => f.id === id);

    const applyActivation = () => {
      setState((prev) => {
        const openFiles = prev.openFiles.includes(id) ? prev.openFiles : [...prev.openFiles, id];
        const arriving = snapshotEditorNav({
          activeFileId: id,
          activePage: page,
          activeArtifact: prev.activeArtifact ?? null,
          editorView: 'pdf',
        });
        const leaving = snapshotEditorNav(prev);
        if (!options?.skipHistory && !sameNavEntry(leaving, arriving)) {
          navHistoryRef.current.pushLeave(leaving);
        }
        return {
          ...prev,
          activeFileId: id,
          activePage: page,
          openFiles,
          editorView: 'pdf',
        };
      });
      syncEditorNavUi();
    };

    applyActivation();

    if (file && file.file.size === 0 && !file.pdfLoadError) {
      void downloadFileIfNeeded(id, projectSessionRef.current);
    }

    void (async () => {
      const current = stateRef.current.files.find((f) => f.id === id);
      if (!current || current.viewPanels?.panels?.length) return;
      const hydrated = await hydrateViewPanelForDoc(current);
      if (hydrated === current) return;
      setState((prev) => ({
        ...prev,
        files: prev.files.map((f) => (f.id === id ? hydrated : f)),
      }));
    })();
  }, [state.files, downloadFileIfNeeded, syncEditorNavUi]);

  const applyNavEntry = useCallback((entry: EditorNavEntry) => {
    const sessionId = projectSessionRef.current;
    setState((prev) => {
      if (entry.fileId && !prev.files.some((f) => f.id === entry.fileId)) {
        return prev;
      }
      return buildStateFromNavEntry(prev, entry);
    });
    syncEditorNavUi();
    if (entry.fileId) {
      void downloadFileIfNeeded(entry.fileId, sessionId);
    }
  }, [downloadFileIfNeeded, syncEditorNavUi]);

  const goBackInEditor = useCallback(() => {
    const current = snapshotEditorNav(stateRef.current);
    const target = navHistoryRef.current.goBack(current);
    if (!target) return;
    applyNavEntry(target);
  }, [applyNavEntry]);

  const goForwardInEditor = useCallback(() => {
    const current = snapshotEditorNav(stateRef.current);
    const target = navHistoryRef.current.goForward(current);
    if (!target) return;
    applyNavEntry(target);
  }, [applyNavEntry]);

  const closeFile = useCallback((id: string) => {
    setState((prev) => {
      const openFiles = prev.openFiles.filter(fid => fid !== id);
      let activeFileId = prev.activeFileId;
      if (activeFileId === id) {
        activeFileId = openFiles.length > 0 ? openFiles[openFiles.length - 1] : null;
      }
      const keepBlob = prev.pinnedFiles.includes(id);
      const files = keepBlob
        ? prev.files
        : prev.files.map((f) => (f.id === id ? disposeDocumentFile(f) : f));
      const dropArtifact = prev.activeArtifact?.sourceFileId === id;
      return {
        ...prev,
        files,
        openFiles,
        activeFileId,
        activePage: 1,
        activeArtifact: dropArtifact ? null : prev.activeArtifact,
        editorView: dropArtifact ? 'pdf' : prev.editorView,
      };
    });
  }, []);

  const closeOthers = useCallback((id: string) => {
    setState((prev) => {
      const openFiles = prev.openFiles.filter(fid => fid === id || prev.pinnedFiles.includes(fid));
      return {
        ...prev,
        openFiles,
        activeFileId: id,
        activePage: 1
      };
    });
  }, []);

  const closeToRight = useCallback((id: string) => {
    setState((prev) => {
      const idx = prev.openFiles.indexOf(id);
      if (idx === -1) return prev;
      const openFiles = prev.openFiles.filter((fid, currentIdx) => {
        return currentIdx <= idx || prev.pinnedFiles.includes(fid);
      });
      const activeFileId = openFiles.includes(prev.activeFileId!) ? prev.activeFileId : id;
      return { ...prev, openFiles, activeFileId };
    });
  }, []);

  const closeAll = useCallback(() => {
    setState((prev) => {
      // keep pinned files
      const openFiles = prev.openFiles.filter(id => prev.pinnedFiles.includes(id));
      const activeFileId = openFiles.length > 0 ? openFiles[0] : null;
      return {
        ...prev,
        openFiles,
        activeFileId,
        activePage: 1
      };
    });
  }, []);

  const togglePin = useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      pinnedFiles: prev.pinnedFiles.includes(id) 
        ? prev.pinnedFiles.filter(fid => fid !== id) 
        : [...prev.pinnedFiles, id]
    }));
  }, []);

  const splitEditor = useCallback((direction: 'none' | 'up' | 'down' | 'left' | 'right', fileId?: string) => {
    setState((prev) => ({
      ...prev,
      splitMode: direction,
      splitFileId: fileId || prev.activeFileId,
    }));
  }, []);

  const setActiveSidebarTab = useCallback((tab: SessionState['activeSidebarTab']) => {
    setState((prev) => {
      if (prev.activeSidebarTab === tab) {
        return { ...prev, isSidebarOpen: !prev.isSidebarOpen };
      }
      return { ...prev, activeSidebarTab: tab, isSidebarOpen: true };
    });
  }, []);

  const toggleSidebar = useCallback(() => {
    setState((prev) => ({ ...prev, isSidebarOpen: !prev.isSidebarOpen }));
  }, []);

  const toggleValidation = useCallback(() => {
    setState((prev) => ({ ...prev, isValidationOpen: !prev.isValidationOpen }));
  }, []);

  const setConfidenceThreshold = useCallback((val: number) => {
    setState((prev) => ({ ...prev, confidenceThreshold: val }));
  }, []);

  const setSelectedComponents = useCallback((ids: string[]) => {
    setState((prev) => ({ ...prev, selectedComponents: normalizeSelectedComponents(ids) }));
  }, []);

  const setComponentConfidence = useCallback((id: string, confidence: number) => {
    setState((prev) => ({
      ...prev,
      componentConfidence: {
        ...prev.componentConfidence,
        [id]: confidence,
      },
    }));
  }, []);

  const setComponentModel = useCallback((id: string, modelFile: string) => {
    setState((prev) => ({
      ...prev,
      componentModels: {
        ...prev.componentModels,
        [id]: modelFile,
      },
      availableComponents: prev.availableComponents.map((c) =>
        c.id === id ? { ...c, modelFile } : c,
      ),
    }));
  }, []);

  const toggleComponent = useCallback((id: string) => {
    setState((prev) => {
      const isSelected = prev.selectedComponents.includes(id);
      const newSelection = normalizeSelectedComponents(
        isSelected
          ? prev.selectedComponents.filter(c => c !== id)
          : [...prev.selectedComponents, id],
      );
      return { ...prev, selectedComponents: newSelection };
    });
  }, []);

  const openConfigModal = useCallback((mode: 'import' | 'reanalyze', fileId?: string, fileIds?: string[]) => {
    setState((prev) => ({
      ...prev,
      showConfigModal: true,
      configModalMode: mode,
      configTargetFileId: fileId,
      configTargetFileIds: fileIds,
    }));
  }, []);

  const closeConfigModal = useCallback(() => {
    setState((prev) => ({
      ...prev,
      showConfigModal: false,
      configTargetFileId: undefined,
      configTargetFileIds: undefined,
    }));
  }, []);

  const setCurrentView = useCallback((view: 'projects' | 'editor') => {
    if (view === 'projects') {
      invalidateProjectSession();
      setState((prev) => ({
        ...prev,
        currentView: view,
        activeProject: undefined,
        files: [],
        activeFileId: null,
        openFiles: [],
        pinnedFiles: [],
        activeArtifact: null,
        editorView: 'pdf',
        analysisQueue: null,
        isLoadingFiles: false,
      }));
    } else {
      setState((prev) => ({ ...prev, currentView: view }));
    }
  }, [invalidateProjectSession]);

  const setActiveProject = useCallback((project: Project, options?: { forceReload?: boolean }) => {
    let shouldLoadFiles = true;

    setState((prev) => {
      const sameProject = prev.activeProject?.id === project.id;
      const canMerge =
        sameProject &&
        !options?.forceReload &&
        (prev.files.length > 0 || prev.isLoadingFiles);

      if (canMerge) {
        shouldLoadFiles = false;
        return {
          ...prev,
          activeProject: {
            ...prev.activeProject!,
            name: project.name || prev.activeProject!.name,
            role: project.role,
            description: project.description ?? prev.activeProject!.description,
            ownerId: project.ownerId ?? prev.activeProject!.ownerId,
            isPublic: project.isPublic ?? prev.activeProject!.isPublic,
            isReadOnly: project.isReadOnly ?? prev.isReadOnly ?? false,
          },
          isReadOnly: project.isReadOnly ?? prev.isReadOnly ?? false,
        };
      }

      shouldLoadFiles = true;
      disposeDocumentFilesInPlace(prev.files);
      projectSessionRef.current += 1;
      stopAnalysisRef.current = true;
      return {
        ...prev,
        activeProject: project,
        isReadOnly: project.isReadOnly ?? false,
        currentView: 'editor',
        files: [],
        activeFileId: null,
        openFiles: [],
        pinnedFiles: [],
        activeArtifact: null,
        editorView: 'pdf',
        activePage: 1,
        isLoadingFiles: true,
      };
    });

    if (shouldLoadFiles) {
      resetEditorNavigation();
    }

    if (!shouldLoadFiles) return;

    const loadSessionId = projectSessionRef.current;

    // Load project files + analysis results in ONE API call
    (async () => {
      try {
        const { authFetch } = await import('./lib/supabase');

        const res = await authFetch(`/api/v1/projects/${project.id}/files`);
        if (!isSessionCurrent(loadSessionId)) return;
        if (res.status === 401) {
          window.location.href = `/login?returnTo=${encodeURIComponent(window.location.pathname + window.location.search)}`;
          return;
        }
        if (!res.ok) {
          console.error(`[ElementIQ] Failed to load project files: HTTP ${res.status}`, await res.text().catch(() => ''));
          if (isSessionCurrent(loadSessionId)) {
            setState((prev) => ({ ...prev, isLoadingFiles: false }));
          }
          return;
        }
        const rawFiles = await res.json();
        if (!isSessionCurrent(loadSessionId)) return;
        console.log(`[ElementIQ] Loaded ${rawFiles.length} files for project ${project.id}`);

        const docs = mapApiProjectFiles(rawFiles);
        const { initialFileId, patchFromUrl } = resolveUrlEditorFields(docs);

        setState((prev) => {
          if (!isSessionCurrent(loadSessionId)) return prev;
          return {
            ...prev,
            files: docs,
            isLoadingFiles: false,
            ...patchFromUrl,
          };
        });

        if (initialFileId) {
          const activeDoc = docs.find((d) => d.id === initialFileId);
          if (activeDoc) {
            void prefetchProjectPdf(activeDoc, loadSessionId, isSessionCurrent, setState);
          }
        }

        if (project.ownerId) {
          void writeProjectSessionCache(
            project.id,
            stateRef.current.guestViewerKey ?? null,
            {
              meta: {
                id: project.id,
                name: project.name,
                owner_id: project.ownerId,
                is_public: Boolean(project.isPublic),
                public_access_level: project.publicAccessLevel ?? null,
                description: project.description ?? null,
              },
              rawFiles,
            },
          );
        }
      } catch (err) {
        console.error('Failed to load project files:', err);
        if (isSessionCurrent(loadSessionId)) {
          setState((prev) => ({ ...prev, isLoadingFiles: false }));
        }
      }
    })();
  }, [isSessionCurrent, resetEditorNavigation]);

  const loadProjectEditor = useCallback(async (
    projectId: string,
    userId?: string | null,
  ): Promise<'ok' | 'unauthorized' | 'not_found' | 'error'> => {
    const current = stateRef.current;
    if (
      current.activeProject?.id === projectId &&
      !current.isLoadingFiles &&
      current.currentView === 'editor'
    ) {
      const isOwner = Boolean(userId && current.activeProject.ownerId === userId);
      const publicAccessLevel = normalizePublicAccessLevel(current.activeProject.publicAccessLevel);
      const caps = resolveProjectCapabilities(
        isOwner,
        Boolean(current.activeProject.isPublic),
        publicAccessLevel,
      );
      setState((prev) => ({
        ...prev,
        ...caps,
        isProjectOwner: isOwner,
        guestViewerKey: getGuestRunViewerKey(userId),
        activeProject: prev.activeProject
          ? {
              ...prev.activeProject,
              isReadOnly: caps.isReadOnly,
              role: isOwner ? 'Owner' : 'Viewer',
            }
          : prev.activeProject,
      }));
      const activeId = stateRef.current.activeFileId;
      if (activeId) {
        const doc = stateRef.current.files.find((f) => f.id === activeId);
        if (doc && doc.file.size === 0) {
          void prefetchProjectPdf(
            doc,
            projectSessionRef.current,
            isSessionCurrent,
            setState,
          );
        }
      }
      return 'ok';
    }

    const sessionCache = await readProjectSessionCache(projectId, userId ?? null);
    if (!sessionCache) {
      console.log(
        `[ElementIQ] Project cache miss · project=${projectId} · viewer=${userId ?? 'guest'}`,
      );
    }

    disposeDocumentFilesInPlace(stateRef.current.files);
    projectSessionRef.current += 1;
    stopAnalysisRef.current = true;
    const loadSessionId = projectSessionRef.current;

    const applyHydratedProject = (
      meta: CachedProjectMeta,
      rawFiles: unknown[],
      fromCache: boolean,
    ) => {
      const { initialFileId, docs, patch } = editorStateFromProjectApi(
        meta,
        rawFiles,
        projectId,
        userId,
      );
      const mergedDocs = mergeDocsWithExistingFiles(docs, stateRef.current.files);
      setState((prev) => {
        if (!isSessionCurrent(loadSessionId)) return prev;
        return { ...prev, ...patch, files: mergedDocs, pinnedFiles: prev.pinnedFiles };
      });
      void (async () => {
        const hydrateIds = [initialFileId ?? stateRef.current.activeFileId].filter(
          (id): id is string => Boolean(id),
        );
        const hydrated = await hydrateViewPanelsForDocIds(mergedDocs, hydrateIds);
        setState((prev) => {
          if (!isSessionCurrent(loadSessionId)) return prev;
          const byId = new Map(hydrated.map((d) => [d.id, d]));
          return {
            ...prev,
            files: prev.files.map((f) => byId.get(f.id) ?? f),
          };
        });
      })();
      const prefetchId = initialFileId ?? stateRef.current.activeFileId;
      if (prefetchId) {
        const activeDoc = mergedDocs.find((d) => d.id === prefetchId);
        if (activeDoc && activeDoc.file.size === 0) {
          void prefetchProjectPdf(activeDoc, loadSessionId, isSessionCurrent, setState);
        }
      }
      if (fromCache) {
        console.log(`[ElementIQ] Project ${projectId} restored from session cache`);
      }
    };

    const revalidateInBackground = () => {
      void (async () => {
        const fetchStartedAt = Date.now();
        try {
          const snapshot = await fetchProjectEditorSnapshot(projectId);
          if (!isSessionCurrent(loadSessionId) || !snapshot) return;
          if (isAnalysisUiBusy()) return;
          if (lastLocalAnalysisAtRef.current > fetchStartedAt) return;

          const cached = await readProjectSessionCache(projectId, userId ?? null);
          if (!projectSnapshotChanged(cached, snapshot.meta, snapshot.rawFiles)) {
            return;
          }
          if (isAnalysisUiBusy()) return;
          if (lastLocalAnalysisAtRef.current > fetchStartedAt) return;

          persistProjectSessionCache(projectId, userId ?? null, snapshot);
          applyHydratedProject(snapshot.meta, snapshot.rawFiles, false);
          console.log(`[ElementIQ] Project ${projectId} updated from server (cache revalidate)`);
        } catch {
          // Keep cached snapshot on background sync failure
        }
      })();
    };

    if (sessionCache) {
      applyHydratedProject(sessionCache.meta, sessionCache.rawFiles, true);
      revalidateInBackground();
      return 'ok';
    }

    setState((prev) => ({
      ...prev,
      activeProject: {
        id: projectId,
        name: '',
        role: 'Viewer',
        age: '',
        hasImage: false,
      },
      currentView: 'editor',
      isLoadingFiles: true,
      files: [],
      activeFileId: null,
      openFiles: [],
      pinnedFiles: [],
      activeArtifact: null,
      editorView: 'pdf',
      activePage: 1,
    }));

    try {
      const { authFetch } = await import('./lib/supabase');
      const [metaRes, filesRes] = await Promise.all([
        authFetch(`/api/v1/projects/${projectId}`),
        authFetch(`/api/v1/projects/${projectId}/files`),
      ]);

      if (!isSessionCurrent(loadSessionId)) return 'ok';

      if (metaRes.status === 401 || filesRes.status === 401) return 'unauthorized';
      if (metaRes.status === 404) return 'not_found';
      if (!metaRes.ok || !filesRes.ok) return 'error';

      const data = await metaRes.json();
      const rawFiles = await filesRes.json();
      const meta = metaFromProjectApi(data);

      await writeProjectSessionCache(projectId, userId ?? null, { meta, rawFiles });
      applyHydratedProject(meta, rawFiles, false);

      return 'ok';
    } catch (err) {
      console.error('Failed to load project editor:', err);
      if (isSessionCurrent(loadSessionId)) {
        setState((prev) => ({ ...prev, isLoadingFiles: false }));
      }
      return 'error';
    }
  }, [isSessionCurrent]);

  const refreshProjectFiles = useCallback(async (options?: {
    silent?: boolean;
    focusFileIds?: string[];
    /** After batch analyze — always sync even if busy guards would block. */
    force?: boolean;
  }) => {
    const projectId = state.activeProject?.id;
    if (!projectId) return;

    const refreshSessionId = projectSessionRef.current;
    const fetchStartedAt = Date.now();

    if (!options?.force && isAnalysisUiBusy()) return;

    if (!options?.silent) {
      setState((prev) => ({ ...prev, isLoadingFiles: true }));
    }

    try {
      const { authFetch } = await import('./lib/supabase');
      const res = await authFetch(`/api/v1/projects/${projectId}/files`);
      if (!res.ok) {
        throw new Error(`Failed to load project files: HTTP ${res.status}`);
      }
      if (!options?.force && isAnalysisUiBusy()) return;
      if (!options?.force && lastLocalAnalysisAtRef.current > fetchStartedAt) return;

      const rawFiles = await res.json();
      const docs = mapApiProjectFiles(rawFiles);
      if (!isSessionCurrent(refreshSessionId)) return;
      if (!options?.force && isAnalysisUiBusy()) return;
      if (!options?.force && lastLocalAnalysisAtRef.current > fetchStartedAt) return;

      const prevFiles = stateRef.current.files;
      const mergedDocs = mergeDocsWithExistingFiles(docs, prevFiles);
      const focusIds = (options?.focusFileIds ?? []).filter((id) => mergedDocs.some((d) => d.id === id));

      setState((prev) => {
        if (!isSessionCurrent(refreshSessionId)) return prev;

        const nextIds = new Set(docs.map((d) => d.id));
        for (const old of prev.files) {
          if (!nextIds.has(old.id)) {
            disposeDocumentFile(old);
          }
        }

        const preservedActive =
          focusIds.find((id) => mergedDocs.some((d) => d.id === id))
          ?? (prev.activeFileId && mergedDocs.some((d) => d.id === prev.activeFileId)
            ? prev.activeFileId
            : mergedDocs.length > 0
              ? mergedDocs[0].id
              : null);
        const openFiles = [
          ...new Set([
            ...prev.openFiles.filter((id) => mergedDocs.some((d) => d.id === id)),
            ...focusIds,
          ]),
        ];
        const nextOpen =
          openFiles.length > 0
            ? openFiles
            : preservedActive
              ? [preservedActive]
              : [];

        const preservedArtifact =
          prev.activeArtifact &&
          mergedDocs.some((d) =>
            d.artifacts?.some((a) => a.id === prev.activeArtifact?.id),
          )
            ? prev.activeArtifact
            : null;

        return {
          ...prev,
          files: mergedDocs,
          isLoadingFiles: false,
          activeFileId: preservedActive,
          openFiles: nextOpen,
          activeArtifact: preservedArtifact,
        };
      });

      void (async () => {
        const activeId = stateRef.current.activeFileId;
        const hydrateIds = activeId ? [activeId] : [];
        const hydrated = await hydrateViewPanelsForDocIds(mergedDocs, hydrateIds);
        if (!isSessionCurrent(refreshSessionId)) return;
        setState((prev) => {
          const byId = new Map(hydrated.map((d) => [d.id, d]));
          return {
            ...prev,
            files: prev.files.map((f) => byId.get(f.id) ?? f),
          };
        });
      })();

      const activeProject = stateRef.current.activeProject;
      if (activeProject?.ownerId) {
        persistProjectSessionCache(
          projectId,
          stateRef.current.guestViewerKey ?? null,
          {
            meta: {
              id: activeProject.id,
              name: activeProject.name,
              owner_id: activeProject.ownerId,
              is_public: Boolean(activeProject.isPublic),
              public_access_level: activeProject.publicAccessLevel ?? null,
              description: activeProject.description ?? null,
            },
            rawFiles,
          },
        );
      }

      if (focusIds.length > 0) {
        const activeId = focusIds[0];
        const activeDoc = mergedDocs.find((d) => d.id === activeId);
        if (activeDoc && activeDoc.file.size === 0) {
          void prefetchProjectPdf(activeDoc, refreshSessionId, isSessionCurrent, setState);
        }
      } else {
        const activeId = stateRef.current.activeFileId;
        const activeDoc = mergedDocs.find((d) => d.id === activeId);
        if (activeDoc && activeDoc.file.size === 0) {
          void prefetchProjectPdf(activeDoc, refreshSessionId, isSessionCurrent, setState);
        }
      }
    } catch (err) {
      console.error('Failed to refresh project files:', err);
      if (isSessionCurrent(refreshSessionId)) {
        setState((prev) => ({ ...prev, isLoadingFiles: false }));
      }
      throw err;
    }
  }, [state.activeProject?.id, isSessionCurrent]);

  const toggleBot = useCallback(() => {
    setState((prev) => ({ ...prev, isBotOpen: !prev.isBotOpen }));
  }, []);

  const setActiveArtifact = useCallback((
    artifact: SessionState['activeArtifact'],
    options?: { skipHistory?: boolean },
  ) => {
    setState((prev) => {
      const arriving = snapshotEditorNav({
        ...prev,
        activeArtifact: artifact,
        editorView: artifact ? 'artifact' : 'pdf',
      });
      const leaving = snapshotEditorNav(prev);
      if (!options?.skipHistory && !sameNavEntry(leaving, arriving)) {
        navHistoryRef.current.pushLeave(leaving);
      }
      return {
        ...prev,
        activeArtifact: artifact,
        editorView: artifact ? 'artifact' : 'pdf',
      };
    });
    syncEditorNavUi();
  }, [syncEditorNavUi]);

  const setEditorView = useCallback((view: 'pdf' | 'artifact') => {
    setState((prev) => {
      if (view === 'artifact' && !prev.activeArtifact) return prev;
      const arriving = snapshotEditorNav({ ...prev, editorView: view });
      const leaving = snapshotEditorNav(prev);
      if (!sameNavEntry(leaving, arriving)) {
        navHistoryRef.current.pushLeave(leaving);
      }
      return { ...prev, editorView: view };
    });
    syncEditorNavUi();
  }, [syncEditorNavUi]);

  const setExplorerSort = useCallback((sort: ExplorerSortKey) => {
    setState((prev) => ({ ...prev, explorerSort: sort }));
    writeExplorerViewPrefs({ sort });
  }, []);

  const setExplorerStatus = useCallback((status: ExplorerStatusFilter) => {
    setState((prev) => ({ ...prev, explorerStatus: status }));
  }, []);

  const setViewerOverlay = useCallback((
    key: 'qa' | 'split' | 'titles' | 'viewports' | 'coords' | 'tags' | 'tagDetach',
    value: boolean,
  ) => {
    setState((prev) => ({
      ...prev,
      ...(key === 'qa'
        ? { overlayQa: value }
        : key === 'split'
          ? { overlaySplit: value }
          : key === 'titles'
            ? { overlayTitles: value }
            : key === 'viewports'
              ? { overlayViewports: value }
              : key === 'coords'
                ? { overlayViewportCoords: value }
                : key === 'tagDetach'
                  ? { overlayTagDetach: value }
                  : { overlayTags: value }),
    }));
  }, []);

  const applyEditorUrlFromSearch = useCallback((search: string) => {
    const docs = stateRef.current.files;
    const { patchFromUrl, initialFileId } = resolveUrlEditorFields(docs, search);
    setState((prev) => {
      if (prev.currentView !== 'editor') return prev;
      return { ...prev, ...patchFromUrl };
    });
    if (initialFileId) {
      void downloadFileIfNeeded(initialFileId, projectSessionRef.current);
    }
    syncEditorNavUi();
  }, [downloadFileIfNeeded, syncEditorNavUi]);

  const refreshProjectFilesRef = React.useRef(refreshProjectFiles);
  refreshProjectFilesRef.current = refreshProjectFiles;
  const activeProjectRef = React.useRef(state.activeProject);
  activeProjectRef.current = state.activeProject;

  // Listen for reload-files event (triggered after import completes)
  React.useEffect(() => {
    const handleReload = () => {
      if (activeProjectRef.current) {
        void refreshProjectFilesRef.current();
      }
    };
    const handleFileUploaded = (e: Event) => {
      const { id, name, size, file, localPath, duplicate } = (e as CustomEvent).detail;
      setState((prev) => {
        const existing = prev.files.find((f) => f.id === id);
        if (existing) {
          if (duplicate) {
            void removeCachedPdfBlob(id);
            return {
              ...prev,
              files: prev.files.map((f) =>
                f.id === id
                  ? {
                      ...f,
                      file: file || new File([], name, { type: 'application/pdf' }),
                      fileSizeBytes: size ?? f.fileSizeBytes,
                      localPath: localPath ?? f.localPath,
                    }
                  : f,
              ),
            };
          }
          return prev;
        }
        const newFile: DocumentFile = {
          id,
          name,
          file: file || new File([], name, { type: 'application/pdf' }),
          status: 'PENDING',
          pages: 1,
          detections: [],
          fileSizeBytes: size,
          uploadedAt: new Date().toISOString(),
          localPath,
          events: [{ id: Date.now().toString(), timestamp: new Date().toISOString(), message: 'Uploaded', type: 'SUCCESS' }],
        };
        return { ...prev, files: [...prev.files, newFile] };
      });
    };
    const handleViewArtifact = (e: Event) => {
      const { id, type, downloadUrl, name, sourceFileId } = (e as CustomEvent).detail;
      setState((prev) => {
        const fileId = sourceFileId ?? prev.activeFileId;
        const openFiles =
          fileId && !prev.openFiles.includes(fileId)
            ? [...prev.openFiles, fileId]
            : prev.openFiles;
        const arriving = snapshotEditorNav({
          activeFileId: fileId,
          activePage: 1,
          activeArtifact: { id, type, downloadUrl, name, sourceFileId: fileId ?? undefined },
          editorView: 'artifact',
        });
        const leaving = snapshotEditorNav(prev);
        if (!sameNavEntry(leaving, arriving)) {
          navHistoryRef.current.pushLeave(leaving);
        }
        return {
          ...prev,
          activeFileId: fileId,
          activePage: 1,
          openFiles,
          activeArtifact: { id, type, downloadUrl, name, sourceFileId: fileId ?? undefined },
          editorView: 'artifact',
        };
      });
      syncEditorNavUi();
    };
    window.addEventListener('elementiq:reload-files', handleReload);
    window.addEventListener('elementiq:file-uploaded', handleFileUploaded);
    window.addEventListener('elementiq:view-artifact', handleViewArtifact);
    return () => {
      window.removeEventListener('elementiq:reload-files', handleReload);
      window.removeEventListener('elementiq:file-uploaded', handleFileUploaded);
      window.removeEventListener('elementiq:view-artifact', handleViewArtifact);
    };
  }, [syncEditorNavUi]);

  const deleteFiles = useCallback(async (
    ids: string[],
    onProgress?: (current: number, total: number, filename: string) => void,
    options?: DeleteFilesOptions,
  ) => {
    if (ids.length === 0) return;
    const removeFile = options?.removeFile ?? true;
    const purgeAnalysis = options?.purgeAnalysis ?? true;
    if (!removeFile && !purgeAnalysis) return;

    const idSet = new Set(ids);
    const filesToDelete = state.files.filter((f) => idSet.has(f.id));
    const total = filesToDelete.length;
    const { authFetch } = await import('./lib/supabase');

    const deletedIds: string[] = [];
    const analysisClearedIds: string[] = [];
    const failures: string[] = [];

    for (let i = 0; i < filesToDelete.length; i++) {
      const f = filesToDelete[i];
      onProgress?.(i + 1, total, f.name);
      try {
        if (removeFile) {
          const res = await authFetch(`/api/v1/files/${f.id}`, { method: 'DELETE' });
          if (!res.ok) {
            let message = `HTTP ${res.status}`;
            try {
              const body = await res.json();
              if (body.detail) {
                message = typeof body.detail === 'string' ? body.detail : message;
              }
            } catch { /* ignore */ }
            failures.push(`${f.name}: ${message}`);
            continue;
          }
          deletedIds.push(f.id);
        } else if (purgeAnalysis) {
          const res = await authFetch(`/api/v1/files/${f.id}/analysis`, { method: 'DELETE' });
          if (!res.ok) {
            let message = `HTTP ${res.status}`;
            try {
              const body = await res.json();
              if (body.detail) {
                message = typeof body.detail === 'string' ? body.detail : message;
              }
            } catch { /* ignore */ }
            failures.push(`${f.name}: ${message}`);
            continue;
          }
          analysisClearedIds.push(f.id);
        }
      } catch (err) {
        failures.push(`${f.name}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    if (analysisClearedIds.length > 0) {
      const clearedSet = new Set(analysisClearedIds);
      setState((prev) => {
        const dropArtifact =
          prev.activeArtifact?.sourceFileId && clearedSet.has(prev.activeArtifact.sourceFileId);
        return {
          ...prev,
          files: prev.files.map((file) =>
            clearedSet.has(file.id) ? { ...file, ...analysisResetPatch() } : file,
          ),
          activeArtifact: dropArtifact ? null : prev.activeArtifact,
          editorView: dropArtifact ? 'pdf' : prev.editorView,
        };
      });
      const projectId = stateRef.current.activeProject?.id;
      if (projectId) {
        void syncProjectSessionCache(projectId);
      }
    }

    if (deletedIds.length > 0) {
      const removed = filesToDelete.filter((f) => deletedIds.includes(f.id));
      disposeDocumentFilesInPlace(removed);
      const removedSet = new Set(deletedIds);
      for (const id of deletedIds) {
        void removeCachedPdfBlob(id);
      }
      setState((prev) => {
        const files = prev.files.filter((f) => !removedSet.has(f.id));
        const openFiles = prev.openFiles.filter((fid) => !removedSet.has(fid));
        const pinnedFiles = prev.pinnedFiles.filter((fid) => !removedSet.has(fid));
        let activeFileId = prev.activeFileId;
        if (activeFileId && removedSet.has(activeFileId)) {
          activeFileId = openFiles.length > 0 ? openFiles[openFiles.length - 1] : null;
        }
        const dropArtifact =
          prev.activeArtifact?.sourceFileId && removedSet.has(prev.activeArtifact.sourceFileId);
        const activeArtifact = dropArtifact ? null : prev.activeArtifact;
        return {
          ...prev,
          files,
          openFiles,
          pinnedFiles,
          activeFileId,
          activePage: 1,
          activeArtifact,
          editorView: dropArtifact ? 'pdf' : prev.editorView,
        };
      });
      const projectId = stateRef.current.activeProject?.id;
      if (projectId) {
        void syncProjectSessionCache(projectId);
      }
    }

    if (failures.length > 0) {
      throw new Error(failures.join('\n'));
    }
  }, [state.files, syncProjectSessionCache]);

  const clearSession = useCallback(async (
    onProgress?: (current: number, total: number, filename: string) => void,
    options?: DeleteFilesOptions,
  ) => {
    await deleteFiles(state.files.map((f) => f.id), onProgress, options);
  }, [state.files, deleteFiles]);

  const renameFile = useCallback(async (id: string, newName: string) => {
    const trimmed = newName.trim();
    if (!trimmed) throw new Error('Filename is required');

    const { authFetch } = await import('./lib/supabase');
    const res = await authFetch(`/api/v1/files/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ original_filename: trimmed }),
    });
    if (!res.ok) {
      let message = `HTTP ${res.status}`;
      try {
        const body = await res.json();
        if (body.detail) message = typeof body.detail === 'string' ? body.detail : message;
      } catch { /* ignore */ }
      throw new Error(message);
    }

    setState((prev) => ({
      ...prev,
      files: prev.files.map((f) => {
        if (f.id !== id) return f;
        return {
          ...f,
          name: trimmed,
          file: new File([], trimmed, { type: f.file.type || 'application/pdf' }),
        };
      }),
    }));

    const projectId = stateRef.current.activeProject?.id;
    if (projectId) {
      void syncProjectSessionCache(projectId);
    }
  }, [syncProjectSessionCache]);

  const filesRef = React.useRef(state.files);
  filesRef.current = state.files;

  const appendAnalysisLog = useCallback((entry: Omit<AnalysisLogLine, 'id' | 'ts'>) => {
    setState((prev) => ({
      ...prev,
      analysisLogs: [
        ...prev.analysisLogs,
        {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          ts: new Date().toLocaleTimeString('en-US', { hour12: false }),
          ...entry,
        },
      ].slice(-800),
    }));
  }, []);

  const clearAnalysisLogs = useCallback(() => {
    setState((prev) => ({ ...prev, analysisLogs: [] }));
  }, []);

  const toggleAnalysisTerminal = useCallback(() => {
    setState((prev) => ({ ...prev, isAnalysisTerminalOpen: !prev.isAnalysisTerminalOpen }));
  }, []);

  const getFileName = (id: string) =>
    filesRef.current.find((f) => f.id === id)?.name ?? id.slice(0, 8);

  const analyzeFile = useCallback(async (id: string, opts?: { workerId?: number }) => {
    const workerId = opts?.workerId;
    const log = (entry: Omit<AnalysisLogLine, 'id' | 'ts'>) => {
      appendAnalysisLog({
        ...entry,
        workerId: entry.workerId ?? workerId,
        message: formatWorkerLogMessage(entry.message, entry.workerId ?? workerId),
      });
    };

    const analysisSessionId = projectSessionRef.current;
    const session = stateRef.current;
    const usePublicRun = Boolean(
      !session.isProjectOwner && session.canRun && session.activeProject?.isPublic,
    );
    const guestViewerKey = session.guestViewerKey;
    const projectId = session.activeProject?.id;
    const fileName = getFileName(id);

    // Single-file analyze (not batch queue) — new Run clears prior Stop.
    if (!stateRef.current.analysisQueue) {
      stopAnalysisRef.current = false;
    }
    if (stopAnalysisRef.current) return;

    const abortController = new AbortController();
    analysisAbortRef.current = abortController;
    const fetchOpts = { signal: abortController.signal };

    updateFileStatus(id, { status: 'ANALYZING', analysisProgress: 0, analysisStage: 'Connecting to backend...' });
    setState((prev) => ({ ...prev, analysisProgressOverlayDismissed: false }));
    analyzeInFlightRef.current += 1;
    log({ level: 'dim', message: `Connecting to backend…`, fileId: id });
    let file = filesRef.current.find(f => f.id === id)?.file;
    if (!file) {
      updateFileStatus(id, {
        status: 'PENDING',
        analysisProgress: 0,
        analysisStage: 'Missing file data',
      });
      log({ level: 'error', message: 'Cannot analyze — file not loaded in browser', fileId: id });
      analyzeInFlightRef.current = Math.max(0, analyzeInFlightRef.current - 1);
      return;
    }

    let analyzeResultCommitted = false;

    try {
      const { authFetch, isServerFileId } = await import('./lib/supabase');
      const useServerReRun = isServerFileId(id);

      // ── 0. Ensure file bytes are loaded (only needed for raw multipart upload) ──
      if (!useServerReRun && file.size === 0) {
        updateFileStatus(id, { analysisProgress: 5, analysisStage: 'Downloading PDF from server...' });
        log({ level: 'dim', message: 'Downloading PDF from server…', fileId: id });
        const dlRes = await authFetch(`/api/v1/files/${id}/download`, fetchOpts);
        if (!dlRes.ok) throw new Error('Failed to download file for analysis');
        const blob = await dlRes.blob();
        file = new File([blob], file.name, { type: 'application/pdf' });
        updateFileStatus(id, { file });
      }

      // ── 1. Quick health check ──────────────────────────────
      try {
        const hRes = await authFetch('/api/v1/health', fetchOpts);
        if (!hRes.ok) throw new Error('Backend not healthy');
      } catch {
        throw new Error('Backend offline — run: uvicorn app.main:app --reload --port 8000');
      }

      // ── 1. Upload PDF to backend ───────────────────────────
      const selectedComps = state.selectedComponents.length > 0 ? state.selectedComponents : ['grout-tube'];
      // Use per-component confidence (first selected component's confidence as primary)
      const primaryComp = selectedComps[0];
      const confThreshold = state.componentConfidence[primaryComp] ?? state.confidenceThreshold;
      const analysisConfig: Record<string, unknown> = {
        conf_threshold: confThreshold,
        page_index: 0,
      };
      const componentWeights: Record<string, string> = {};
      for (const compId of selectedComps) {
        const chosen = state.componentModels[compId]?.trim();
        if (chosen) componentWeights[compId] = chosen;
      }
      if (Object.keys(componentWeights).length > 0) {
        analysisConfig.component_weights = componentWeights;
      }

      updateFileStatus(id, { analysisProgress: 10, analysisStage: `Queuing: ${selectedComps.join(', ')} @ ${(confThreshold * 100).toFixed(0)}% conf` });
      buildModelLogLines(
        selectedComps,
        state.availableComponents,
        state.componentConfidence,
        state.confidenceThreshold,
        state.componentModels,
      ).forEach((line) => {
        log({ level: 'info', message: `Model: ${line}`, fileId: id });
      });

      const parseApiError = async (res: Response) => {
        const err = await res.json().catch(() => ({}));
        const detail = err?.detail;
        if (typeof detail === 'string') return detail;
        if (detail?.message) return detail.message;
        if (Array.isArray(detail)) return detail.map((d: { msg?: string }) => d.msg).filter(Boolean).join('; ') || `HTTP ${res.status}`;
        return err?.message || `HTTP ${res.status}`;
      };

      let status_url: string;

      // Files already on server (UUID) → re-run via JSON (no multipart re-upload)
      if (useServerReRun) {
        log({ level: 'dim', message: 'Submitting re-analysis job…', fileId: id });
        const endpoint = usePublicRun ? '/api/v1/analyze/public-run' : '/api/v1/analyze/re-run';
        const res = await authFetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            file_id: id,
            components: selectedComps,
            config: analysisConfig,
          }),
          ...fetchOpts,
        });
        if (!res.ok) throw new Error(await parseApiError(res));
        ({ status_url } = await res.json());
      } else {
        const formData = new FormData();
        formData.append('file', file, file.name || 'drawing.pdf');
        formData.append('components', JSON.stringify(selectedComps));
        formData.append('config', JSON.stringify(analysisConfig));

        const res = await authFetch('/api/v1/analyze', { method: 'POST', body: formData, ...fetchOpts });
        if (!res.ok) throw new Error(await parseApiError(res));
        ({ status_url } = await res.json());
      }
      const jobId = parseJobIdFromStatusUrl(status_url);
      updateFileStatus(id, { analysisProgress: 20, analysisStage: analysisStageFromProgress(20) });
      log({
        level: 'dim',
        message: jobId
          ? `Job ${jobId.slice(0, 8)}… queued — polling server log`
          : 'Job queued — polling server log',
        fileId: id,
      });

      let lastServerLogLen = 0;
      let lastFallbackStage = '';

      // ── 2. Poll until COMPLETED or FAILED ──────────────────
      const poll = async (): Promise<any> => {
        if (!isSessionCurrent(analysisSessionId)) {
          throw new Error('Session ended');
        }
        const jobRes = await authFetch(status_url, fetchOpts);
        if (!jobRes.ok) throw new Error(`Failed to fetch job status: ${jobRes.status}`);
        const job = await jobRes.json();

        const serverLines: string[] = Array.isArray(job.analysis_log) ? job.analysis_log : [];
        if (serverLines.length > lastServerLogLen) {
          for (let si = lastServerLogLen; si < serverLines.length; si++) {
            log({
              level: levelForServerLogLine(serverLines[si]),
              message: serverLines[si],
              fileId: id,
            });
          }
          lastServerLogLen = serverLines.length;
        }

        if (job.progress) {
          const stage = job.stage
            ? String(job.stage).charAt(0).toUpperCase() + String(job.stage).slice(1)
            : analysisStageFromProgress(job.progress ?? 0);
          updateFileStatus(id, { analysisProgress: job.progress, analysisStage: stage });
          if (serverLines.length === 0 && job.stage && job.stage !== lastFallbackStage) {
            lastFallbackStage = job.stage;
            log({ level: 'dim', message: `${stage} (${job.progress}%)`, fileId: id });
          }
        }

        if (job.status === 'COMPLETED') return job;
        if (job.status === 'FAILED') throw new Error(job.error?.message || job.error_message || 'Analysis failed');

        // Check if user clicked Stop
        if (stopAnalysisRef.current) {
          updateFileStatus(id, { status: 'PENDING', analysisProgress: 0, analysisStage: 'Stopped by user' });
          log({ level: 'warn', message: `${fileName} — stopped by user`, fileId: id });
          throw new Error('Stopped by user');
        }

        await new Promise(r => setTimeout(r, 1000));  // poll every 1s
        return poll();
      };

      const result = await poll();

      // Map backend result → frontend detections + validation annotations
      const components = result.result?.component_results ?? result.result?.components ?? [];
      const mapped = mapAnalysisFields({ component_results: components });
      const detections = mapped.detections;
      const validationAnnotations = mapped.validationAnnotations;
      const tubeCount = mapped.tubeCount;

      const hasResultData =
        detections.length > 0
        || (result.result?.artifacts?.length ?? 0) > 0
        || hasAnalysisPayload(result.result);
      const resolved = resolveFileStatusFromAnalysis(
        result.result,
        validationAnnotations,
        hasResultData,
        tubeCount ?? 0,
      );
      const overallRaw = resolved.overallRaw;
      const overallStatus = overallRaw.toUpperCase();
      const fileStatus = resolved.status;
      const passRate = resolvePassRate(result.result, overallStatus, fileStatus) ?? 0;

      console.log('[ElementIQ] Mapped detections:', detections.length, detections[0]);
      console.log('[ElementIQ] overallStatus:', overallStatus, 'fileStatus:', fileStatus, 'passRate:', passRate);

      // Commit core result immediately — optional overlay fetches must not block status.
      updateFileStatus(id, {
        status: fileStatus,
        overallStatus: overallStatus || undefined,
        detections,
        validationAnnotations,
        tubeCount,
        passRate,
        analysisJobId: result.job_id ? String(result.job_id) : undefined,
        analysisProgress: 100,
        analysisStage: 'Complete',
        events: [
          ...(filesRef.current.find(f => f.id === id)?.events ?? []),
          { id: Date.now().toString(), timestamp: new Date().toISOString(), message: `Analysis complete — ${overallStatus}`, type: 'SUCCESS' },
        ],
      });
      lastLocalAnalysisAtRef.current = Date.now();
      analyzeResultCommitted = true;

      // Extract artifacts from result
      const artifacts = dedupeArtifactsForDisplay(
        filterArtifactsForFile(
        (result.result?.artifacts ?? []).map((a: any) => ({
          id: a.id,
          type: a.artifact_type,
          downloadUrl: a.download_url
            ? `${a.download_url}${a.download_url.includes('?') ? '&' : '?'}v=${a.id}`
            : a.download_url,
          sourceFileId: id,
          localPath: a.local_path,
          fileSizeBytes: a.file_size_bytes,
          originalFilename: a.original_filename,
          contentType: a.content_type,
          createdAt: a.created_at,
        })),
        id,
        fileName,
        ),
      ) as import('./types').FileArtifact[];

      let viewSplit = parseViewSplitFromAnalysis({ component_results: components });
      let viewTitles = parseViewTitlesFromAnalysis({ component_results: components });
      let tagNotes = parseTagNotesFromAnalysis({ component_results: components });
      let viewPanels: import('./lib/viewPanels').ParsedViewPanels | null = null;
      const reportArtifact = artifacts.find((a) => a.type === 'REPORT_JSON');
      if (reportArtifact?.downloadUrl && reportArtifact.id) {
        try {
          const reportText = await fetchArtifactText(
            { id: reportArtifact.id, downloadUrl: reportArtifact.downloadUrl },
            fetchOpts,
          );
          if (reportText) {
            if (!viewSplit) viewSplit = parseViewSplitFromReport(reportText);
            if (!viewTitles) viewTitles = parseViewTitlesFromReport(reportText);
            if (!tagNotes) tagNotes = parseTagNotesFromReport(reportText);
            viewPanels = parseViewPanelsFromReport(reportText);
          }
        } catch {
          // Report JSON optional for overlay; ignore fetch errors
        }
      }
      if (!viewPanels?.panels?.length) {
        try {
          viewPanels = await fetchViewPanelsForFile(
            {
              artifacts: artifacts.map((a) => ({
                id: a.id,
                type: a.type,
                downloadUrl: a.downloadUrl,
              })),
            },
            fetchOpts,
          );
        } catch {
          // Viewport overlay enrichment is optional — must not fail the whole analyze UI update.
        }
      }

      updateFileStatus(id, {
        artifacts,
        viewSplit,
        viewTitles,
        tagNotes,
        viewPanels,
      });

      // New job → new artifact IDs; drop stale viewer so user reopens fresh PNG/PDF.
      setState((prev) => ({
        ...prev,
        activeArtifact:
          prev.activeArtifact?.sourceFileId === id ? null : prev.activeArtifact,
        editorView:
          prev.activeArtifact?.sourceFileId === id ? 'pdf' : prev.editorView,
      }));

      log({
        level: fileStatus === 'PASS' ? 'success' : fileStatus === 'FAIL' ? 'error' : 'warn',
        message: `${fileName} → ${overallStatus} · ${detections.length} detection(s) · ${Number(passRate).toFixed(1)}% pass`,
        fileId: id,
      });
      if (artifacts.length > 0) {
        log({
          level: 'info',
          message: 'Artifacts updated — open Annotated PNG/PDF in sidebar to view latest',
          fileId: id,
        });
      }

      if (usePublicRun && projectId && guestViewerKey) {
        const updated = filesRef.current.find((f) => f.id === id);
        if (updated) {
          saveGuestRunSnapshot(
            projectId,
            id,
            guestViewerKey,
            buildGuestRunSnapshot(updated, String(result.job_id ?? '')),
          );
          log({
            level: 'info',
            message: 'Your results were saved locally in this browser only',
            fileId: id,
          });
        }
      }

      if (projectId && isSessionCurrent(analysisSessionId)) {
        void syncProjectSessionCache(projectId, { viewerKey: guestViewerKey ?? null });
      }

    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg === 'Stopped by user') return;
      if (err instanceof DOMException && err.name === 'AbortError') return;
      if (stopAnalysisRef.current) return;
      log({ level: 'error', message: `${fileName} → ${msg}`, fileId: id });
      if (analyzeResultCommitted) {
        log({
          level: 'warn',
          message: `${fileName} — overlay enrichment failed after analyze (${msg}); status kept from report`,
          fileId: id,
        });
        return;
      }
      updateFileStatus(id, {
        status: 'FAIL',
        passRate: 0,
        analysisProgress: 0,
        analysisStage: 'Error',
        events: [
          ...(filesRef.current.find(f => f.id === id)?.events ?? []),
          { id: Date.now().toString(), timestamp: new Date().toISOString(), message: `Error: ${msg}`, type: 'ERROR' },
        ],
      });
    } finally {
      analyzeInFlightRef.current = Math.max(0, analyzeInFlightRef.current - 1);
      if (analysisAbortRef.current === abortController) {
        analysisAbortRef.current = null;
      }
    }
  }, [state.confidenceThreshold, state.selectedComponents, state.componentConfidence, state.componentModels, state.availableComponents, updateFileStatus, appendAnalysisLog, isSessionCurrent, syncProjectSessionCache]);

  const runAnalysisQueue = useCallback(async (orderedIds: string[]) => {
    stopAnalysisRef.current = false;
    analysisAbortRef.current?.abort();
    analysisAbortRef.current = null;
    setState((prev) => ({ ...prev, analysisProgressOverlayDismissed: false }));

    const ids = orderedIds.filter((id) => {
      const f = filesRef.current.find((ff) => ff.id === id);
      return f && f.status !== 'UPLOADING';
    });
    if (ids.length === 0) {
      appendAnalysisLog({
        level: 'warn',
        message: 'No files to analyze (all uploading or list empty)',
      });
      return;
    }

    // Clear stuck ANALYZING spinners from a prior hung/stopped run.
    setState((prev) => ({
      ...prev,
      files: prev.files.map((f) =>
        ids.includes(f.id) && f.status === 'ANALYZING'
          ? { ...f, status: 'PENDING', analysisProgress: 0, analysisStage: undefined }
          : f
      ),
    }));

    let queueConcurrency = 2;
    let slotUser = 2;
    let slotGpu = 2;
    try {
      const { authFetch } = await import('./lib/supabase');
      const hRes = await authFetch('/api/v1/health');
      if (hRes.ok) {
        const health = await hRes.json();
        const services = health.services as Record<string, string> | undefined;
        queueConcurrency = resolveQueueConcurrencyFromHealth(services);
        slotUser = Number.parseInt(services?.max_user_slots ?? '2', 10) || 2;
        slotGpu = Number.parseInt(services?.max_gpu_slots ?? '2', 10) || 2;
      }
    } catch {
      /* use defaults */
    }
    const workerCount = Math.min(queueConcurrency, ids.length);

    clearAnalysisLogs();
    setState((prev) => ({
      ...prev,
      analysisQueue: { total: ids.length, completed: 0, activeCount: 0, activeFileNames: [] },
    }));
    appendAnalysisLog({
      level: 'info',
      message: `Queue started — ${ids.length} file(s), ${workerCount} workers (server slots user=${slotUser} gpu=${slotGpu})`,
    });
    const queueModels = buildModelLogLines(
      state.selectedComponents.length > 0 ? state.selectedComponents : ['grout-tube'],
      state.availableComponents,
      state.componentConfidence,
      state.confidenceThreshold,
      state.componentModels,
    );
    queueModels.forEach((line) => {
      appendAnalysisLog({ level: 'info', message: `Model: ${line}` });
    });

    let nextIndex = 0;
    let completed = 0;
    const activeWorkers = new Map<number, string>();

    const updateQueueProgress = () => {
      const workerStates = [...activeWorkers.entries()]
        .sort(([a], [b]) => a - b)
        .map(([workerId, fileName]) => ({ workerId, fileName }));
      setState((prev) => ({
        ...prev,
        analysisQueue: {
          total: ids.length,
          completed,
          activeCount: activeWorkers.size,
          activeFileNames: workerStates.map((w) => w.fileName),
          activeWorkers: workerStates,
        },
      }));
    };

    const worker = async (workerId: number) => {
      while (!stopAnalysisRef.current) {
        const i = nextIndex++;
        if (i >= ids.length) break;
        const id = ids[i];
        const name = getFileName(id);
        activeWorkers.set(workerId, name);
        updateQueueProgress();
        appendAnalysisLog({
          level: 'info',
          message: formatWorkerLogMessage(`[${i + 1}/${ids.length}] ▶ ${name}`, workerId),
          fileId: id,
          workerId,
        });
        try {
          await analyzeFile(id, { workerId });
        } finally {
          activeWorkers.delete(workerId);
          completed++;
          updateQueueProgress();
        }
      }
    };

    const workers = Array.from({ length: workerCount }, (_, idx) => worker(idx + 1));
    await Promise.all(workers);

    if (stopAnalysisRef.current) {
      appendAnalysisLog({ level: 'warn', message: 'Queue stopped by user' });
    } else {
      appendAnalysisLog({ level: 'success', message: 'Queue finished' });
      const projectId = stateRef.current.activeProject?.id;
      if (projectId) {
        await refreshProjectFiles({ silent: true, focusFileIds: ids, force: true });
      }
    }
    setState((prev) => ({ ...prev, analysisQueue: null }));
  }, [analyzeFile, appendAnalysisLog, clearAnalysisLogs, refreshProjectFiles, state.selectedComponents, state.availableComponents, state.componentConfidence, state.componentModels, state.confidenceThreshold]);

  const analyzeAll = useCallback(async (orderedIds?: string[]) => {
    const ids = orderedIds ?? filesRef.current
      .filter(f => f.status !== 'UPLOADING')
      .map(f => f.id);
    await runAnalysisQueue(ids);
  }, [runAnalysisQueue]);

  const analyzeSelected = useCallback(async (ids: string[]) => {
    await runAnalysisQueue(ids);
  }, [runAnalysisQueue]);

  const stopAnalysis = useCallback(() => {
    stopAnalysisRef.current = true;
    analysisAbortRef.current?.abort();
    analysisAbortRef.current = null;
    setState((prev) => ({
      ...prev,
      analysisProgressOverlayDismissed: false,
      files: prev.files.map((f) =>
        f.status === 'ANALYZING'
          ? { ...f, status: 'PENDING', analysisProgress: 0, analysisStage: undefined }
          : f
      ),
      analysisQueue: null,
    }));
    appendAnalysisLog({ level: 'warn', message: 'Analysis stopped — spinner cleared (server job may still run)' });
  }, [appendAnalysisLog]);

  const dismissAnalysisProgressOverlay = useCallback(() => {
    setState((prev) => {
      if (prev.analysisProgressOverlayDismissed) return prev;
      return { ...prev, analysisProgressOverlayDismissed: true };
    });
    appendAnalysisLog({
      level: 'dim',
      message: 'Analysis progress hidden — job continues in background (Analysis log / Scanning… to reopen)',
    });
  }, [appendAnalysisLog]);

  const showAnalysisProgressOverlay = useCallback(() => {
    setState((prev) => {
      if (!prev.analysisProgressOverlayDismissed) return prev;
      return { ...prev, analysisProgressOverlayDismissed: false };
    });
  }, []);

  React.useEffect(() => {
    const id = state.activeFileId;
    if (!id || state.isLoadingFiles || state.currentView !== 'editor') return;
    const doc = state.files.find((f) => f.id === id);
    if (doc && doc.file.size === 0 && !doc.pdfLoadError) {
      void downloadFileIfNeeded(id, projectSessionRef.current);
    }
  }, [state.activeFileId, state.files, state.isLoadingFiles, state.currentView, downloadFileIfNeeded]);

  return (
    <AppContext.Provider
      value={{
        state,
        addFiles,
        setActiveFile,
        goBackInEditor,
        goForwardInEditor,
        editorNavCanBack: editorNavUi.canBack,
        editorNavCanForward: editorNavUi.canForward,
        closeFile,
        closeOthers,
        closeToRight,
        closeAll,
        togglePin,
        splitEditor,
        setActiveSidebarTab,
        toggleSidebar,
        toggleValidation,
        setConfidenceThreshold,
        clearSession,
        deleteFiles,
        renameFile,
        updateFileStatus,
        analyzeFile,
        analyzeAll,
        analyzeSelected,
        stopAnalysis,
        dismissAnalysisProgressOverlay,
        showAnalysisProgressOverlay,
        appendAnalysisLog,
        clearAnalysisLogs,
        toggleAnalysisTerminal,
        setSelectedComponents,
        setComponentConfidence,
        setComponentModel,
        toggleComponent,
        openConfigModal,
        closeConfigModal,
        setCurrentView,
        setActiveProject,
        loadProjectEditor,
        disposeProjectSession,
        refreshProjectFiles,
        toggleBot,
        setActiveArtifact,
        setEditorView,
        setExplorerSort,
        setExplorerStatus,
        setViewerOverlay,
        applyEditorUrlFromSearch,
        retryPdfLoad,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within AppProvider');
  return context;
}
