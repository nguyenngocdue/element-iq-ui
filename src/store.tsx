import React, { createContext, useContext, useState, useCallback } from 'react';
import { SessionState, DocumentFile, Component, Project, AnalysisLogLine } from './types';
import { filterArtifactsForFile } from './lib/fileView';
import {
  hasAnalysisPayload,
  mapOverallToFileStatus,
  resolveOverallRaw,
  resolvePassRate,
} from './lib/analysisStatus';
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

const DPI_RATIO = 72 / 300;

function mapApiProjectFiles(files: any[]): DocumentFile[] {
  return files.map((f: any) => {
    let status: DocumentFile['status'] = 'PENDING';
    let detections: DocumentFile['detections'] = [];
    let passRate: number | undefined;
    let analyzedComponents: string[] | undefined;

    if (f.analysis) {
      const overallRaw = resolveOverallRaw(f.analysis);
      const hasAnalysis = hasAnalysisPayload(f.analysis);
      status = mapOverallToFileStatus(overallRaw, hasAnalysis);
      passRate = resolvePassRate(f.analysis, overallRaw.toUpperCase());
      analyzedComponents = f.analysis.component_results?.map((c: any) => c.component_id);
      detections = (f.analysis.component_results ?? []).flatMap((comp: any) =>
        (comp.objects ?? []).map((obj: any, i: number) => {
          const [x1, y1, x2, y2] = obj.bbox ?? [0, 0, 0, 0];
          const report = (comp.report ?? []).find((r: any) => {
            const ids = r.matched_cluster?.object_ids ?? [];
            return ids.includes(i + 1);
          });
          const detStatus = report?.status === 'FAIL' ? 'FAIL' : report?.status === 'MISSING-TAG' ? 'WARN' : 'PASS';
          return {
            id: `${comp.component_id}-${i}`,
            page: 1,
            x: x1 * DPI_RATIO,
            y: y1 * DPI_RATIO,
            width: (x2 - x1) * DPI_RATIO,
            height: (y2 - y1) * DPI_RATIO,
            type: obj.face ?? 'UNKNOWN',
            confidence: obj.confidence ?? 0,
            status: detStatus,
            reason: report?.reason,
            componentId: comp.component_id,
          };
        }),
      );
    }

    return {
      id: f.id,
      name: f.original_filename,
      file: new File([], f.original_filename, { type: 'application/pdf' }),
      status,
      pages: f.page_count || 1,
      detections,
      passRate,
      analyzedComponents,
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
  setActiveProject: (project: Project) => void;
  refreshProjectFiles: (options?: { silent?: boolean }) => Promise<void>;
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
        updateFileStatus(doc.id, { pages: pdf.numPages, uploadProgress: 30 });

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
      (async () => {
        try {
          const { authFetch } = await import('./lib/supabase');
          const res = await authFetch(`/api/v1/files/${id}/download`);
          if (!res.ok) return;
          const blob = await res.blob();
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
  }, [state.files, updateFileStatus]);

  const closeFile = useCallback((id: string) => {
    setState((prev) => {
      const openFiles = prev.openFiles.filter(fid => fid !== id);
      let activeFileId = prev.activeFileId;
      if (activeFileId === id) {
        activeFileId = openFiles.length > 0 ? openFiles[openFiles.length - 1] : null;
      }
      return { ...prev, openFiles, activeFileId, activePage: 1 };
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
      setState((prev) => ({ ...prev, currentView: view, activeProject: undefined, files: [], activeFileId: null, openFiles: [] }));
    } else {
      setState((prev) => ({ ...prev, currentView: view }));
    }
  }, []);

  const setActiveProject = useCallback((project: Project) => {
    setState((prev) => ({
      ...prev,
      activeProject: project,
      currentView: 'editor',
      files: [],
      activeFileId: null,
      openFiles: [],
      pinnedFiles: [],
      activeArtifact: null,
      activePage: 1,
      isLoadingFiles: true,
    }));

    // Load project files + analysis results in ONE API call
    (async () => {
      try {
        const { authFetch } = await import('./lib/supabase');

        // Fetch project details (name) if not provided
        if (!project.name) {
          try {
            const projRes = await authFetch('/api/v1/projects');
            if (projRes.ok) {
              const projects = await projRes.json();
              const found = projects.find((p: any) => p.id === project.id);
              if (found) {
                setState((prev) => ({
                  ...prev,
                  activeProject: { ...prev.activeProject!, name: found.name },
                }));
              }
            }
          } catch { /* non-blocking */ }
        }

        const res = await authFetch(`/api/v1/projects/${project.id}/files`);
        if (!res.ok) {
          console.error(`[ElementIQ] Failed to load project files: HTTP ${res.status}`, await res.text().catch(() => ''));
          setState((prev) => ({ ...prev, isLoadingFiles: false }));
          return;
        }
        const files = await res.json();
        console.log(`[ElementIQ] Loaded ${files.length} files for project ${project.id}`);

        const docs = mapApiProjectFiles(files);

        const urlParams = new URLSearchParams(window.location.search);
        const urlFileId = urlParams.get('file');
        const initialFileId =
          urlFileId && docs.some((d) => d.id === urlFileId)
            ? urlFileId
            : docs.length > 0
              ? docs[0].id
              : null;

        setState((prev) => ({
          ...prev,
          files: docs,
          isLoadingFiles: false,
          activeFileId: initialFileId,
          openFiles: initialFileId ? [initialFileId] : [],
          activeArtifact: null,
        }));

        // Auto-download the active file so PDF renders immediately
        if (initialFileId) {
          const activeDoc = docs.find((d) => d.id === initialFileId);
          if (!activeDoc) return;
          try {
            const dlRes = await authFetch(`/api/v1/files/${activeDoc.id}/download`);
            if (dlRes.ok) {
              const blob = await dlRes.blob();
              const realFile = new File([blob], activeDoc.name, { type: 'application/pdf' });
              setState((prev) => ({
                ...prev,
                files: prev.files.map(f => f.id === activeDoc.id ? { ...f, file: realFile } : f),
              }));
            }
          } catch {
            // Non-blocking
          }
        }
      } catch (err) {
        console.error('Failed to load project files:', err);
        setState((prev) => ({ ...prev, isLoadingFiles: false }));
      }
    })();
  }, []);

  const refreshProjectFiles = useCallback(async (options?: { silent?: boolean }) => {
    const projectId = state.activeProject?.id;
    if (!projectId) return;

    if (!options?.silent) {
      setState((prev) => ({ ...prev, isLoadingFiles: true }));
    }

    try {
      const docs = await fetchProjectFileDocs(projectId);
      setState((prev) => {
        const preservedActive =
          prev.activeFileId && docs.some((d) => d.id === prev.activeFileId)
            ? prev.activeFileId
            : docs.length > 0
              ? docs[0].id
              : null;
        const openFiles = prev.openFiles.filter((id) => docs.some((d) => d.id === id));
        const nextOpen =
          openFiles.length > 0
            ? openFiles
            : preservedActive
              ? [preservedActive]
              : [];

        return {
          ...prev,
          files: docs,
          isLoadingFiles: false,
          activeFileId: preservedActive,
          openFiles: nextOpen,
        };
      });
    } catch (err) {
      console.error('Failed to refresh project files:', err);
      setState((prev) => ({ ...prev, isLoadingFiles: false }));
      throw err;
    }
  }, [state.activeProject?.id]);

  const toggleBot = useCallback(() => {
    setState((prev) => ({ ...prev, isBotOpen: !prev.isBotOpen }));
  }, []);

  const setActiveArtifact = useCallback((artifact: SessionState['activeArtifact']) => {
    setState((prev) => ({ ...prev, activeArtifact: artifact }));
  }, []);

  // Listen for reload-files event (triggered after import completes)
  React.useEffect(() => {
    const handleReload = () => {
      if (state.activeProject) {
        void refreshProjectFiles();
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
  }, [state.activeProject, refreshProjectFiles]);

  const clearSession = useCallback(async (onProgress?: (current: number, total: number, filename: string) => void) => {
    // No confirm here — ConfirmDialog in Sidebar handles confirmation

    // Delete all files from backend
    const filesToDelete = [...state.files];
    const total = filesToDelete.length;
    const { authFetch } = await import('./lib/supabase');
    
    for (let i = 0; i < filesToDelete.length; i++) {
      const f = filesToDelete[i];
      onProgress?.(i + 1, total, f.name);
      try {
        await authFetch(`/api/v1/files/${f.id}`, { method: 'DELETE' });
      } catch {
        // Continue deleting others even if one fails
      }
    }

    setState((prev) => ({ ...prev, files: [], activeFileId: null, openFiles: [], pinnedFiles: [] }));
  }, [state.files]);

  const stopAnalysisRef = React.useRef(false);
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
    const fileName = getFileName(id);
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
        const res = await authFetch('/api/v1/analyze/re-run', {
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
      updateFileStatus(id, { analysisProgress: 20, analysisStage: 'Running YOLO detection...' });
      appendAnalysisLog({ level: 'dim', message: 'Job queued — polling status…', fileId: id });

      let lastLoggedStage = '';

      // ── 2. Poll until COMPLETED or FAILED ──────────────────
      const poll = async (): Promise<any> => {
        const jobRes = await authFetch(status_url);
        if (!jobRes.ok) throw new Error(`Failed to fetch job status: ${jobRes.status}`);
        const job = await jobRes.json();

        if (job.progress) {
          const stage =
            job.progress < 20  ? 'Uploading PDF...' :
            job.progress < 50  ? 'Running YOLO detection...' :
            job.progress < 80  ? 'Parsing text notes...' :
            job.progress < 95  ? 'Validating results...' :
                                 'Saving artifacts...';
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
      const components = result.result?.component_results ?? result.result?.components ?? [];
      // console.log('components:', components.length, 'component(s)');
      components.forEach((comp: any) => {
        console.log(`  [${comp.component_id}] objects:`, comp.objects?.length ?? 0, comp.objects?.[0]);
        console.log(`  [${comp.component_id}] summary:`, comp.summary);
        console.log(`  [${comp.component_id}] report:`, comp.report?.length ?? 0, 'entries');
      });
      console.groupEnd();

      // Map backend result → frontend detections
      // Backend bbox is in pixels at 300 DPI; PDF.js renders at 72 DPI (72/300 = 0.24 ratio)
      const DPI_RATIO = 72 / 300;

      const detections = components.flatMap((comp: any) =>
        (comp.objects ?? []).map((obj: any, i: number) => {
          const [x1, y1, x2, y2] = obj.bbox ?? [0, 0, 0, 0];
          // Match object to report entry by cluster proximity
          const report = (comp.report ?? []).find((r: any) => {
            const ids = r.matched_cluster?.object_ids ?? [];
            return ids.includes(i + 1);  // object id is 1-indexed
          });
          const detStatus = report?.status === 'FAIL' ? 'FAIL' : report?.status === 'MISSING-TAG' ? 'WARN' : 'PASS';
          return {
            id: `${comp.component_id}-${i}`,
            page: 1,
            x: x1 * DPI_RATIO,
            y: y1 * DPI_RATIO,
            width:  (x2 - x1) * DPI_RATIO,
            height: (y2 - y1) * DPI_RATIO,
            type: obj.face ?? 'UNKNOWN',
            confidence: obj.confidence ?? 0,
            status: detStatus,
            reason: report?.reason,
            componentId: comp.component_id,
          };
        })
      );

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

      updateFileStatus(id, {
        status: fileStatus,
        detections,
        artifacts,
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
