import React, { createContext, useContext, useState, useCallback } from 'react';
import { SessionState, DocumentFile, Component, Project, AnalysisLogLine } from './types';
import { filterArtifactsForFile } from './lib/fileView';
import { parseViewSplitFromAnalysis, parseViewSplitFromReport } from './lib/viewSplit';
import { parseTagNotesFromAnalysis, parseTagNotesFromReport } from './lib/tagNotes';
import { parseViewTitlesFromAnalysis, parseViewTitlesFromReport } from './lib/viewTitles';
import {
  hasAnalysisPayload,
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
import { disposeDocumentFile, disposeDocumentFilesInPlace } from './lib/sessionDispose';
import {
  applyGuestRunSnapshot,
  buildGuestRunSnapshot,
  getGuestRunViewerKey,
  loadGuestRunSnapshot,
  saveGuestRunSnapshot,
} from './lib/guestRunStorage';
import { normalizePublicAccessLevel, resolveProjectCapabilities } from './lib/projectAccess';
import * as pdfjsLib from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.mjs`;

function buildModelLogLines(
  selectedComps: string[],
  availableComponents: Component[],
  componentConfidence: Record<string, number>,
  confidenceThreshold: number,
): string[] {
  return selectedComps.map((compId) => {
    const meta = availableComponents.find((c) => c.id === compId);
    const conf = ((componentConfidence[compId] ?? confidenceThreshold) * 100).toFixed(0);
    const modelFile = meta?.modelFile?.trim();
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
      const overallRaw = resolveOverallRaw(f.analysis);
      const hasAnalysis = hasAnalysisPayload(f.analysis);
      status = mapOverallToFileStatus(overallRaw, hasAnalysis);
      overallStatus = overallRaw ? overallRaw.toUpperCase() : undefined;
      passRate = resolvePassRate(f.analysis, overallRaw.toUpperCase());
      analyzedComponents = f.analysis.component_results?.map((c: any) => c.component_id);
      const mapped = mapAnalysisFields(f.analysis);
      detections = mapped.detections;
      validationAnnotations = mapped.validationAnnotations;
      tubeCount = mapped.tubeCount;
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
      viewSplit: parseViewSplitFromAnalysis(f.analysis),
      viewTitles: parseViewTitlesFromAnalysis(f.analysis),
      tagNotes: parseTagNotesFromAnalysis(f.analysis),
      uploadedAt: f.uploaded_at,
      localPath: f.local_path,
      fileSizeBytes: f.file_size_bytes,
      artifacts: filterArtifactsForFile(
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

async function fetchProjectFileDocs(projectId: string): Promise<DocumentFile[]> {
  const { authFetch } = await import('./lib/supabase');
  const res = await authFetch(`/api/v1/projects/${projectId}/files`);
  if (!res.ok) {
    throw new Error(`Failed to load project files: HTTP ${res.status}`);
  }
  const files = await res.json();
  return mapApiProjectFiles(files);
}

interface AppContextType {
  state: SessionState;
  addFiles: (files: File[]) => void;
  setActiveFile: (id: string, page?: number) => void;
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
  clearSession: (onProgress?: (current: number, total: number, filename: string) => void) => Promise<void>;
  deleteFiles: (ids: string[], onProgress?: (current: number, total: number, filename: string) => void) => Promise<void>;
  renameFile: (id: string, newName: string) => Promise<void>;
  updateFileStatus: (id: string, updates: Partial<DocumentFile>) => void;
  analyzeFile: (id: string) => Promise<void>;
  analyzeAll: (orderedIds?: string[]) => Promise<void>;
  analyzeSelected: (ids: string[]) => Promise<void>;
  stopAnalysis: () => void;
  appendAnalysisLog: (entry: Omit<AnalysisLogLine, 'id' | 'ts'>) => void;
  clearAnalysisLogs: () => void;
  toggleAnalysisTerminal: () => void;
  setSelectedComponents: (ids: string[]) => void;
  setComponentConfidence: (id: string, confidence: number) => void;
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
  setActiveArtifact: (artifact: SessionState['activeArtifact']) => void;
}

// Mock available components (P0: grout-tube ready, others not ready)
// Load saved config from localStorage
const savedConfig = (() => {
  try {
    const raw = localStorage.getItem('elementiq:analysis-config');
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
})();

const savedLayout = (() => {
  try {
    const raw = localStorage.getItem('elementiq:layout');
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
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
  isSidebarOpen: savedLayout?.isSidebarOpen ?? true,
  isValidationOpen: savedLayout?.isValidationOpen ?? true,
  isEngineLive: true,
  confidenceThreshold: savedConfig?.confidenceThreshold ?? 0.4,
  availableComponents: [],  // loaded from API
  selectedComponents: savedConfig?.selectedComponents ?? ['grout-tube'],
  componentConfidence: savedConfig?.componentConfidence ?? { 'grout-tube': 0.40 },
  showConfigModal: false,
  configModalMode: 'import',
  currentView: 'projects',
  isBotOpen: false,
  splitMode: 'none',
  splitFileId: null,
  isAnalysisTerminalOpen: false,
  analysisLogs: [],
  analysisQueue: null,
};

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<SessionState>(initialState);
  const projectSessionRef = React.useRef(0);
  const stopAnalysisRef = React.useRef(false);
  const stateRef = React.useRef(state);
  stateRef.current = state;

  const invalidateProjectSession = useCallback(() => {
    projectSessionRef.current += 1;
    stopAnalysisRef.current = true;
    disposeDocumentFilesInPlace(stateRef.current.files);
  }, []);

  const isSessionCurrent = useCallback(
    (sessionId: number) => sessionId === projectSessionRef.current,
    [],
  );

  const disposeProjectSession = useCallback(() => {
    invalidateProjectSession();
    setState((prev) => ({
      ...prev,
      files: [],
      activeFileId: null,
      openFiles: [],
      pinnedFiles: [],
      activeArtifact: null,
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
      confidenceThreshold: state.confidenceThreshold,
    };
    localStorage.setItem('elementiq:analysis-config', JSON.stringify(config));
  }, [state.selectedComponents, state.componentConfidence, state.confidenceThreshold]);

  // Persist layout preferences
  React.useEffect(() => {
    localStorage.setItem('elementiq:layout', JSON.stringify({
      isSidebarOpen: state.isSidebarOpen,
      isValidationOpen: state.isValidationOpen,
    }));
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

  const setActiveFile = useCallback((id: string, page: number = 1) => {
    const file = state.files.find(f => f.id === id);

    const applyActivation = () => {
      setState((prev) => {
        const openFiles = prev.openFiles.includes(id) ? prev.openFiles : [...prev.openFiles, id];
        return {
          ...prev,
          activeFileId: id,
          activePage: page,
          openFiles,
          activeArtifact: null,
        };
      });
    };

    // If file has no bytes (loaded from server), download first then activate
    if (file && file.file.size === 0) {
      const sessionId = projectSessionRef.current;
      (async () => {
        try {
          const { authFetch } = await import('./lib/supabase');
          const res = await authFetch(`/api/v1/files/${id}/download`);
          if (!isSessionCurrent(sessionId) || !res.ok) return;
          const blob = await res.blob();
          if (!isSessionCurrent(sessionId)) return;
          const realFile = new File([blob], file.name, { type: 'application/pdf' });
          updateFileStatus(id, { file: realFile });
          applyActivation();
        } catch (err) {
          console.error('Failed to download file:', err);
        }
      })();
    } else {
      applyActivation();
    }
  }, [state.files, updateFileStatus, isSessionCurrent]);

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
      return { ...prev, files, openFiles, activeFileId, activePage: 1 };
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
    setState((prev) => ({ ...prev, selectedComponents: ids }));
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

  const toggleComponent = useCallback((id: string) => {
    setState((prev) => {
      const isSelected = prev.selectedComponents.includes(id);
      const newSelection = isSelected
        ? prev.selectedComponents.filter(c => c !== id)
        : [...prev.selectedComponents, id];
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
        activePage: 1,
        isLoadingFiles: true,
      };
    });

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
        const files = await res.json();
        if (!isSessionCurrent(loadSessionId)) return;
        console.log(`[ElementIQ] Loaded ${files.length} files for project ${project.id}`);

        const docs = mapApiProjectFiles(files);

        const urlParams = new URLSearchParams(window.location.search);
        const urlFileId = urlParams.get('file');
        const urlPage = urlParams.get('page');
        const parsedPage = urlPage ? Math.max(1, parseInt(urlPage, 10) || 1) : 1;
        const initialFileId =
          urlFileId && docs.some((d) => d.id === urlFileId)
            ? urlFileId
            : docs.length > 0
              ? docs[0].id
              : null;

        setState((prev) => {
          if (!isSessionCurrent(loadSessionId)) return prev;
          return {
            ...prev,
            files: docs,
            isLoadingFiles: false,
            activeFileId: initialFileId,
            openFiles: initialFileId ? [initialFileId] : [],
            activeArtifact: null,
            activePage: initialFileId === urlFileId ? parsedPage : 1,
          };
        });

        // Auto-download the active file so PDF renders immediately
        if (initialFileId) {
          const activeDoc = docs.find((d) => d.id === initialFileId);
          if (!activeDoc) return;
          try {
            const dlRes = await authFetch(`/api/v1/files/${activeDoc.id}/download`);
            if (!isSessionCurrent(loadSessionId) || !dlRes.ok) return;
            const blob = await dlRes.blob();
            if (!isSessionCurrent(loadSessionId)) return;
            const realFile = new File([blob], activeDoc.name, { type: 'application/pdf' });
            setState((prev) => {
              if (!isSessionCurrent(loadSessionId)) return prev;
              return {
                ...prev,
                files: prev.files.map(f => f.id === activeDoc.id ? { ...f, file: realFile } : f),
              };
            });
          } catch {
            // Non-blocking
          }
        }
      } catch (err) {
        console.error('Failed to load project files:', err);
        if (isSessionCurrent(loadSessionId)) {
          setState((prev) => ({ ...prev, isLoadingFiles: false }));
        }
      }
    })();
  }, [isSessionCurrent]);

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
      return 'ok';
    }

    disposeDocumentFilesInPlace(stateRef.current.files);
    projectSessionRef.current += 1;
    stopAnalysisRef.current = true;
    const loadSessionId = projectSessionRef.current;

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
      const isOwner = Boolean(userId && data.owner_id === userId);
      const publicAccessLevel = normalizePublicAccessLevel(data.public_access_level);
      const caps = resolveProjectCapabilities(isOwner, Boolean(data.is_public), publicAccessLevel);
      const viewerKey = getGuestRunViewerKey(userId);
      const docs = mergeGuestRunResults(
        projectId,
        mapApiProjectFiles(rawFiles),
        viewerKey,
        isOwner,
      );

      const urlParams = new URLSearchParams(window.location.search);
      const urlFileId = urlParams.get('file');
      const urlPage = urlParams.get('page');
      const parsedPage = urlPage ? Math.max(1, parseInt(urlPage, 10) || 1) : 1;
      const initialFileId =
        urlFileId && docs.some((d) => d.id === urlFileId)
          ? urlFileId
          : docs.length > 0
            ? docs[0].id
            : null;

      setState((prev) => {
        if (!isSessionCurrent(loadSessionId)) return prev;
        return {
          ...prev,
          activeProject: {
            id: data.id,
            name: data.name,
            role: isOwner ? 'Owner' : 'Viewer',
            age: '',
            hasImage: false,
            description: data.description,
            ownerId: data.owner_id,
            isPublic: data.is_public,
            isReadOnly: caps.isReadOnly,
            publicAccessLevel,
          },
          ...caps,
          isProjectOwner: isOwner,
          guestViewerKey: viewerKey,
          files: docs,
          isLoadingFiles: false,
          activeFileId: initialFileId,
          openFiles: initialFileId ? [initialFileId] : [],
          activeArtifact: null,
          activePage: initialFileId === urlFileId ? parsedPage : 1,
        };
      });

      if (initialFileId) {
        const activeDoc = docs.find((d) => d.id === initialFileId);
        if (activeDoc) {
          void (async () => {
            try {
              const { authFetch } = await import('./lib/supabase');
              const dlRes = await authFetch(`/api/v1/files/${activeDoc.id}/download`);
              if (!isSessionCurrent(loadSessionId) || !dlRes.ok) return;
              const blob = await dlRes.blob();
              if (!isSessionCurrent(loadSessionId)) return;
              const realFile = new File([blob], activeDoc.name, { type: 'application/pdf' });
              setState((prev) => {
                if (!isSessionCurrent(loadSessionId)) return prev;
                return {
                  ...prev,
                  files: prev.files.map((f) => (f.id === activeDoc.id ? { ...f, file: realFile } : f)),
                };
              });
            } catch {
              // PDF prefetch is best-effort
            }
          })();
        }
      }

      return 'ok';
    } catch (err) {
      console.error('Failed to load project editor:', err);
      if (isSessionCurrent(loadSessionId)) {
        setState((prev) => ({ ...prev, isLoadingFiles: false }));
      }
      return 'error';
    }
  }, [isSessionCurrent]);

  const refreshProjectFiles = useCallback(async (options?: { silent?: boolean; focusFileIds?: string[] }) => {
    const projectId = state.activeProject?.id;
    if (!projectId) return;

    const refreshSessionId = projectSessionRef.current;

    if (!options?.silent) {
      setState((prev) => ({ ...prev, isLoadingFiles: true }));
    }

    try {
      const docs = await fetchProjectFileDocs(projectId);
      if (!isSessionCurrent(refreshSessionId)) return;

      const focusIds = (options?.focusFileIds ?? []).filter((id) => docs.some((d) => d.id === id));
      setState((prev) => {
        if (!isSessionCurrent(refreshSessionId)) return prev;

        const nextIds = new Set(docs.map((d) => d.id));
        for (const old of prev.files) {
          if (!nextIds.has(old.id)) {
            disposeDocumentFile(old);
          }
        }

        const prevById = new Map(prev.files.map((f) => [f.id, f]));
        const mergedDocs = docs.map((d) => {
          const existing = prevById.get(d.id);
          if (existing && existing.file.size > 0) {
            return { ...d, file: existing.file };
          }
          return d;
        });

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

      if (focusIds.length > 0) {
        const activeId = focusIds[0];
        const activeDoc = docs.find((d) => d.id === activeId);
        if (activeDoc) {
          try {
            const { authFetch } = await import('./lib/supabase');
            const dlRes = await authFetch(`/api/v1/files/${activeDoc.id}/download`);
            if (!isSessionCurrent(refreshSessionId) || !dlRes.ok) return;
            const blob = await dlRes.blob();
            if (!isSessionCurrent(refreshSessionId)) return;
            const realFile = new File([blob], activeDoc.name, { type: 'application/pdf' });
            setState((prev) => {
              if (!isSessionCurrent(refreshSessionId)) return prev;
              return {
                ...prev,
                files: prev.files.map((f) => (f.id === activeDoc.id ? { ...f, file: realFile } : f)),
              };
            });
          } catch {
            // Non-blocking
          }
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

  const setActiveArtifact = useCallback((artifact: SessionState['activeArtifact']) => {
    setState((prev) => ({ ...prev, activeArtifact: artifact }));
  }, []);

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
            return {
              ...prev,
              files: prev.files.map((f) =>
                f.id === id
                  ? {
                      ...f,
                      file: file || f.file,
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
        return {
          ...prev,
          activeFileId: fileId,
          activePage: 1,
          openFiles,
          activeArtifact: { id, type, downloadUrl, name, sourceFileId: fileId ?? undefined },
        };
      });
    };
    window.addEventListener('elementiq:reload-files', handleReload);
    window.addEventListener('elementiq:file-uploaded', handleFileUploaded);
    window.addEventListener('elementiq:view-artifact', handleViewArtifact);
    return () => {
      window.removeEventListener('elementiq:reload-files', handleReload);
      window.removeEventListener('elementiq:file-uploaded', handleFileUploaded);
      window.removeEventListener('elementiq:view-artifact', handleViewArtifact);
    };
  }, []);

  const deleteFiles = useCallback(async (
    ids: string[],
    onProgress?: (current: number, total: number, filename: string) => void,
  ) => {
    if (ids.length === 0) return;
    const idSet = new Set(ids);
    const filesToDelete = state.files.filter((f) => idSet.has(f.id));
    const total = filesToDelete.length;
    const { authFetch } = await import('./lib/supabase');

    const deletedIds: string[] = [];
    const failures: string[] = [];

    for (let i = 0; i < filesToDelete.length; i++) {
      const f = filesToDelete[i];
      onProgress?.(i + 1, total, f.name);
      try {
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
      } catch (err) {
        failures.push(`${f.name}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    if (deletedIds.length > 0) {
      const removed = filesToDelete.filter((f) => deletedIds.includes(f.id));
      disposeDocumentFilesInPlace(removed);
      const removedSet = new Set(deletedIds);
      setState((prev) => {
        const files = prev.files.filter((f) => !removedSet.has(f.id));
        const openFiles = prev.openFiles.filter((fid) => !removedSet.has(fid));
        const pinnedFiles = prev.pinnedFiles.filter((fid) => !removedSet.has(fid));
        let activeFileId = prev.activeFileId;
        if (activeFileId && removedSet.has(activeFileId)) {
          activeFileId = openFiles.length > 0 ? openFiles[openFiles.length - 1] : null;
        }
        const activeArtifact =
          prev.activeArtifact?.sourceFileId && removedSet.has(prev.activeArtifact.sourceFileId)
            ? null
            : prev.activeArtifact;
        return { ...prev, files, openFiles, pinnedFiles, activeFileId, activePage: 1, activeArtifact };
      });
    }

    if (failures.length > 0) {
      throw new Error(failures.join('\n'));
    }
  }, [state.files]);

  const clearSession = useCallback(async (onProgress?: (current: number, total: number, filename: string) => void) => {
    await deleteFiles(state.files.map((f) => f.id), onProgress);
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
  }, []);

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

  const analyzeFile = useCallback(async (id: string) => {
    const analysisSessionId = projectSessionRef.current;
    const session = stateRef.current;
    const usePublicRun = Boolean(
      !session.isProjectOwner && session.canRun && session.activeProject?.isPublic,
    );
    const guestViewerKey = session.guestViewerKey;
    const projectId = session.activeProject?.id;
    const fileName = getFileName(id);
    stopAnalysisRef.current = false;
    updateFileStatus(id, { status: 'ANALYZING', analysisProgress: 0, analysisStage: 'Connecting to backend...' });
    appendAnalysisLog({ level: 'dim', message: `Connecting to backend…`, fileId: id });
    let file = filesRef.current.find(f => f.id === id)?.file;
    if (!file) return;

    try {
      const { authFetch, isServerFileId } = await import('./lib/supabase');
      const useServerReRun = isServerFileId(id);

      // ── 0. Ensure file bytes are loaded (only needed for raw multipart upload) ──
      if (!useServerReRun && file.size === 0) {
        updateFileStatus(id, { analysisProgress: 5, analysisStage: 'Downloading PDF from server...' });
        appendAnalysisLog({ level: 'dim', message: 'Downloading PDF from server…', fileId: id });
        const dlRes = await authFetch(`/api/v1/files/${id}/download`);
        if (!dlRes.ok) throw new Error('Failed to download file for analysis');
        const blob = await dlRes.blob();
        file = new File([blob], file.name, { type: 'application/pdf' });
        updateFileStatus(id, { file });
      }

      // ── 1. Quick health check ──────────────────────────────
      try {
        const hRes = await authFetch('/api/v1/health');
        if (!hRes.ok) throw new Error('Backend not healthy');
      } catch {
        throw new Error('Backend offline — run: uvicorn app.main:app --reload --port 8000');
      }

      // ── 1. Upload PDF to backend ───────────────────────────
      const selectedComps = state.selectedComponents.length > 0 ? state.selectedComponents : ['grout-tube'];
      // Use per-component confidence (first selected component's confidence as primary)
      const primaryComp = selectedComps[0];
      const confThreshold = state.componentConfidence[primaryComp] ?? state.confidenceThreshold;
      const analysisConfig = {
        conf_threshold: confThreshold,
        page_index: 0,
      };

      updateFileStatus(id, { analysisProgress: 10, analysisStage: `Queuing: ${selectedComps.join(', ')} @ ${(analysisConfig.conf_threshold * 100).toFixed(0)}% conf` });
      buildModelLogLines(
        selectedComps,
        state.availableComponents,
        state.componentConfidence,
        state.confidenceThreshold,
      ).forEach((line) => {
        appendAnalysisLog({ level: 'info', message: `Model: ${line}`, fileId: id });
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
        appendAnalysisLog({ level: 'dim', message: 'Submitting re-analysis job…', fileId: id });
        const endpoint = usePublicRun ? '/api/v1/analyze/public-run' : '/api/v1/analyze/re-run';
        const res = await authFetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            file_id: id,
            components: selectedComps,
            config: analysisConfig,
          }),
        });
        if (!res.ok) throw new Error(await parseApiError(res));
        ({ status_url } = await res.json());
      } else {
        const formData = new FormData();
        formData.append('file', file, file.name || 'drawing.pdf');
        formData.append('components', JSON.stringify(selectedComps));
        formData.append('config', JSON.stringify(analysisConfig));

        const res = await authFetch('/api/v1/analyze', { method: 'POST', body: formData });
        if (!res.ok) throw new Error(await parseApiError(res));
        ({ status_url } = await res.json());
      }
      updateFileStatus(id, { analysisProgress: 20, analysisStage: analysisStageFromProgress(20) });
      appendAnalysisLog({ level: 'dim', message: 'Job queued — polling status…', fileId: id });

      let lastLoggedStage = '';

      // ── 2. Poll until COMPLETED or FAILED ──────────────────
      const poll = async (): Promise<any> => {
        if (!isSessionCurrent(analysisSessionId)) {
          throw new Error('Session ended');
        }
        const jobRes = await authFetch(status_url);
        if (!jobRes.ok) throw new Error(`Failed to fetch job status: ${jobRes.status}`);
        const job = await jobRes.json();

        if (job.progress) {
          const stage = analysisStageFromProgress(job.progress ?? 0);
          updateFileStatus(id, { analysisProgress: job.progress, analysisStage: stage });
          if (stage !== lastLoggedStage) {
            lastLoggedStage = stage;
            appendAnalysisLog({ level: 'dim', message: `${stage} (${job.progress}%)`, fileId: id });
          }
        }

        if (job.status === 'COMPLETED') return job;
        if (job.status === 'FAILED') throw new Error(job.error?.message || job.error_message || 'Analysis failed');

        // Check if user clicked Stop
        if (stopAnalysisRef.current) {
          updateFileStatus(id, { status: 'PENDING', analysisProgress: 0, analysisStage: 'Stopped by user' });
          appendAnalysisLog({ level: 'warn', message: `${fileName} — stopped by user`, fileId: id });
          throw new Error('Stopped by user');
        }

        await new Promise(r => setTimeout(r, 1000));  // poll every 1s
        return poll();
      };

      const result = await poll();

      // ── DEBUG: log full result to browser console ──────────
      // console.group('[ElementIQ] Analysis Result');
      // console.log('status:', result.status);
      // console.log('result.result:', result.result);
      // Map backend result → frontend detections + validation annotations
      const components = result.result?.component_results ?? result.result?.components ?? [];
      const mapped = mapAnalysisFields({ component_results: components });
      const detections = mapped.detections;
      const validationAnnotations = mapped.validationAnnotations;
      const tubeCount = mapped.tubeCount;

      const passRate = resolvePassRate(result.result, resolveOverallRaw(result.result).toUpperCase()) ?? 0;
      const overallRaw = resolveOverallRaw(result.result);
      const overallStatus = overallRaw.toUpperCase();
      const fileStatus = mapOverallToFileStatus(
        overallRaw,
        detections.length > 0 || (result.result?.artifacts?.length ?? 0) > 0 || hasAnalysisPayload(result.result),
      );

      console.log('[ElementIQ] Mapped detections:', detections.length, detections[0]);
      console.log('[ElementIQ] overallStatus:', overallStatus, 'fileStatus:', fileStatus, 'passRate:', passRate);

      // Extract artifacts from result
      const artifacts = filterArtifactsForFile(
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
      );

      let viewSplit = parseViewSplitFromAnalysis({ component_results: components });
      let viewTitles = parseViewTitlesFromAnalysis({ component_results: components });
      let tagNotes = parseTagNotesFromAnalysis({ component_results: components });
      const reportArtifact = artifacts.find((a) => a.type === 'REPORT_JSON');
      if (reportArtifact?.downloadUrl) {
        try {
          const reportRes = await authFetch(reportArtifact.downloadUrl);
          if (reportRes.ok) {
            const reportText = await reportRes.text();
            if (!viewSplit) viewSplit = parseViewSplitFromReport(reportText);
            if (!viewTitles) viewTitles = parseViewTitlesFromReport(reportText);
            if (!tagNotes) tagNotes = parseTagNotesFromReport(reportText);
          }
        } catch {
          // Report JSON optional for overlay; ignore fetch errors
        }
      }

      updateFileStatus(id, {
        status: fileStatus,
        overallStatus: overallStatus || undefined,
        detections,
        validationAnnotations,
        tubeCount,
        artifacts,
        viewSplit,
        viewTitles,
        tagNotes,
        analysisProgress: 100,
        analysisStage: 'Complete',
        events: [
          ...(filesRef.current.find(f => f.id === id)?.events ?? []),
          { id: Date.now().toString(), timestamp: new Date().toISOString(), message: `Analysis complete — ${overallStatus}`, type: 'SUCCESS' },
        ],
        passRate,
      });

      // New job → new artifact IDs; drop stale viewer so user reopens fresh PNG/PDF.
      setState((prev) => ({
        ...prev,
        activeArtifact:
          prev.activeArtifact?.sourceFileId === id ? null : prev.activeArtifact,
      }));

      appendAnalysisLog({
        level: fileStatus === 'PASS' ? 'success' : fileStatus === 'FAIL' ? 'error' : 'warn',
        message: `${fileName} → ${overallStatus} · ${detections.length} detection(s) · ${Number(passRate).toFixed(1)}% pass`,
        fileId: id,
      });
      if (artifacts.length > 0) {
        appendAnalysisLog({
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
          appendAnalysisLog({
            level: 'info',
            message: 'Your results were saved locally in this browser only',
            fileId: id,
          });
        }
      }

    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg === 'Stopped by user') return;
      appendAnalysisLog({ level: 'error', message: `${fileName} → ${msg}`, fileId: id });
      updateFileStatus(id, {
        status: 'FAIL',
        analysisProgress: 0,
        analysisStage: 'Error',
        events: [
          ...(filesRef.current.find(f => f.id === id)?.events ?? []),
          { id: Date.now().toString(), timestamp: new Date().toISOString(), message: `Error: ${msg}`, type: 'ERROR' },
        ],
      });
    }
  }, [state.confidenceThreshold, state.selectedComponents, state.componentConfidence, state.availableComponents, updateFileStatus, appendAnalysisLog]);

  const runAnalysisQueue = useCallback(async (orderedIds: string[]) => {
    stopAnalysisRef.current = false;
    const ids = orderedIds.filter((id) => {
      const f = filesRef.current.find((ff) => ff.id === id);
      return f && f.status !== 'ANALYZING' && f.status !== 'UPLOADING';
    });
    if (ids.length === 0) return;

    clearAnalysisLogs();
    setState((prev) => ({
      ...prev,
      analysisQueue: { current: 0, total: ids.length },
    }));
    appendAnalysisLog({ level: 'info', message: `Queue started — ${ids.length} file(s) in explorer sort order` });
    const queueModels = buildModelLogLines(
      state.selectedComponents.length > 0 ? state.selectedComponents : ['grout-tube'],
      state.availableComponents,
      state.componentConfidence,
      state.confidenceThreshold,
    );
    queueModels.forEach((line) => {
      appendAnalysisLog({ level: 'info', message: `Model: ${line}` });
    });

    for (let i = 0; i < ids.length; i++) {
      if (stopAnalysisRef.current) {
        appendAnalysisLog({ level: 'warn', message: 'Queue stopped by user' });
        break;
      }
      const id = ids[i];
      const name = getFileName(id);
      setState((prev) => ({
        ...prev,
        analysisQueue: { current: i + 1, total: ids.length, currentFileName: name },
      }));
      appendAnalysisLog({ level: 'info', message: `[${i + 1}/${ids.length}] ▶ ${name}`, fileId: id });
      await analyzeFile(id);
    }

    if (!stopAnalysisRef.current) {
      appendAnalysisLog({ level: 'success', message: 'Queue finished' });
    }
    setState((prev) => ({ ...prev, analysisQueue: null }));
  }, [analyzeFile, appendAnalysisLog, clearAnalysisLogs, state.selectedComponents, state.availableComponents, state.componentConfidence, state.confidenceThreshold]);

  const analyzeAll = useCallback(async (orderedIds?: string[]) => {
    const ids = orderedIds ?? filesRef.current
      .filter(f => f.status !== 'ANALYZING' && f.status !== 'UPLOADING')
      .map(f => f.id);
    await runAnalysisQueue(ids);
  }, [runAnalysisQueue]);

  const analyzeSelected = useCallback(async (ids: string[]) => {
    await runAnalysisQueue(ids);
  }, [runAnalysisQueue]);

  const stopAnalysis = useCallback(() => {
    stopAnalysisRef.current = true;
    appendAnalysisLog({ level: 'warn', message: 'Stop requested — finishing current file…' });
  }, [appendAnalysisLog]);

  return (
    <AppContext.Provider
      value={{
        state,
        addFiles,
        setActiveFile,
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
        appendAnalysisLog,
        clearAnalysisLogs,
        toggleAnalysisTerminal,
        setSelectedComponents,
        setComponentConfidence,
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
