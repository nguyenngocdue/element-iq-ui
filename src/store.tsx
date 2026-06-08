import React, { createContext, useContext, useState, useCallback } from 'react';
import { SessionState, DocumentFile, Component, Project } from './types';
import * as pdfjsLib from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.mjs`;

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
  analyzeAll: () => Promise<void>;
  stopAnalysis: () => void;
  setSelectedComponents: (ids: string[]) => void;
  setComponentConfidence: (id: string, confidence: number) => void;
  toggleComponent: (id: string) => void;
  openConfigModal: (mode: 'import' | 'reanalyze', fileId?: string) => void;
  closeConfigModal: () => void;
  setCurrentView: (view: 'projects' | 'editor') => void;
  setActiveProject: (project: Project) => void;
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

        // Read page count
        const arrayBuffer = await doc.file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;
        updateFileStatus(doc.id, { pages: pdf.numPages, uploadProgress: 30 });

        // Upload to backend (associate with active project)
        const projectId = state.activeProject?.id;
        const formData = new FormData();
        formData.append('file', doc.file);
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
    
    // Clear artifact viewer when selecting a file
    setState((prev) => prev.activeArtifact ? { ...prev, activeArtifact: null } : prev);

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
          // Now activate after file is ready
          setState((prev) => {
            const openFiles = prev.openFiles.includes(id) ? prev.openFiles : [...prev.openFiles, id];
            return { ...prev, activeFileId: id, activePage: page, openFiles };
          });
        } catch (err) {
          console.error('Failed to download file:', err);
        }
      })();
    } else {
      setState((prev) => {
        const openFiles = prev.openFiles.includes(id) ? prev.openFiles : [...prev.openFiles, id];
        return { ...prev, activeFileId: id, activePage: page, openFiles };
      });
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

  const openConfigModal = useCallback((mode: 'import' | 'reanalyze', fileId?: string) => {
    setState((prev) => ({ ...prev, showConfigModal: true, configModalMode: mode, configTargetFileId: fileId }));
  }, []);

  const closeConfigModal = useCallback(() => {
    setState((prev) => ({ ...prev, showConfigModal: false }));
  }, []);

  const setCurrentView = useCallback((view: 'projects' | 'editor') => {
    if (view === 'projects') {
      setState((prev) => ({ ...prev, currentView: view, activeProject: undefined, files: [], activeFileId: null, openFiles: [] }));
    } else {
      setState((prev) => ({ ...prev, currentView: view }));
    }
  }, []);

  const setActiveProject = useCallback((project: Project) => {
    setState((prev) => ({ ...prev, activeProject: project, currentView: 'editor', files: [], isLoadingFiles: true }));

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

        const DPI_RATIO = 72 / 300;
        const docs: DocumentFile[] = files.map((f: any) => {
          let status: DocumentFile['status'] = 'PENDING';
          let detections: any[] = [];
          let passRate: number | undefined;
          let analyzedComponents: string[] | undefined;

          // Use batch analysis data from endpoint (no extra API calls needed)
          if (f.analysis) {
            const overallStatus = (f.analysis.overall_status || f.analysis.summary?.overall || '').toUpperCase();
            status = overallStatus === 'PASS' ? 'PASS' : overallStatus === 'NO-NOTE' ? 'NO-NOTE' : overallStatus === 'FAIL' ? 'FAIL' : 'PENDING';
            passRate = f.analysis.summary?.pass_rate ?? (overallStatus === 'PASS' ? 100 : 0);
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
              })
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
            artifacts: (f.analysis?.artifacts ?? []).map((a: any) => ({
              id: a.id,
              type: a.artifact_type,
              downloadUrl: a.download_url,
            })),
            events: [{ id: Date.now().toString(), timestamp: f.uploaded_at || new Date().toISOString(), message: 'Loaded from server', type: 'INFO' as const }],
          };
        });

        setState((prev) => ({
          ...prev,
          files: docs,
          isLoadingFiles: false,
          activeFileId: docs.length > 0 ? docs[0].id : null,
          openFiles: docs.length > 0 ? [docs[0].id] : [],
        }));

        // Auto-download the first file so PDF renders immediately
        if (docs.length > 0) {
          const firstDoc = docs[0];
          try {
            const dlRes = await authFetch(`/api/v1/files/${firstDoc.id}/download`);
            if (dlRes.ok) {
              const blob = await dlRes.blob();
              const realFile = new File([blob], firstDoc.name, { type: 'application/pdf' });
              setState((prev) => ({
                ...prev,
                files: prev.files.map(f => f.id === firstDoc.id ? { ...f, file: realFile } : f),
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
        setActiveProject(state.activeProject);
      }
    };
    const handleFileUploaded = (e: Event) => {
      const { id, name, size, file } = (e as CustomEvent).detail;
      setState((prev) => {
        // Don't add if already exists
        if (prev.files.some(f => f.id === id)) return prev;
        const newFile: DocumentFile = {
          id,
          name,
          file: file || new File([], name, { type: 'application/pdf' }),
          status: 'PENDING',
          pages: 1,
          detections: [],
          events: [{ id: Date.now().toString(), timestamp: new Date().toISOString(), message: 'Uploaded', type: 'SUCCESS' }],
        };
        return { ...prev, files: [...prev.files, newFile] };
      });
    };
    const handleViewArtifact = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      setState((prev) => ({ ...prev, activeArtifact: detail }));
    };
    window.addEventListener('elementiq:reload-files', handleReload);
    window.addEventListener('elementiq:file-uploaded', handleFileUploaded);
    window.addEventListener('elementiq:view-artifact', handleViewArtifact);
    return () => {
      window.removeEventListener('elementiq:reload-files', handleReload);
      window.removeEventListener('elementiq:file-uploaded', handleFileUploaded);
      window.removeEventListener('elementiq:view-artifact', handleViewArtifact);
    };
  }, [state.activeProject]);

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

  const analyzeFile = useCallback(async (id: string) => {
    updateFileStatus(id, { status: 'ANALYZING', analysisProgress: 0, analysisStage: 'Connecting to backend...' });
    let file = state.files.find(f => f.id === id)?.file;
    if (!file) return;

    try {
      const { authFetch } = await import('./lib/supabase');

      // ── 0. Ensure file bytes are loaded (download if placeholder) ──
      if (file.size === 0) {
        updateFileStatus(id, { analysisProgress: 5, analysisStage: 'Downloading PDF from server...' });
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

      // console.group('[ElementIQ] Analysis Config');
      // console.log('Components:', selectedComps);
      // console.log('Confidence threshold:', confThreshold);
      // console.log('Per-component confidence:', state.componentConfidence);
      // console.log('File:', state.files.find(f => f.id === id)?.name);
      // console.groupEnd();

      const formData = new FormData();
      formData.append('file', file);
      formData.append('components', JSON.stringify(selectedComps));
      formData.append('config', JSON.stringify(analysisConfig));

      updateFileStatus(id, { analysisProgress: 10, analysisStage: `Queuing: ${selectedComps.join(', ')} @ ${(analysisConfig.conf_threshold * 100).toFixed(0)}% conf` });

      const res = await authFetch('/api/v1/analyze', { method: 'POST', body: formData });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.detail?.message || err?.detail || err?.message || `HTTP ${res.status}`);
      }

      const { status_url } = await res.json();
      updateFileStatus(id, { analysisProgress: 20, analysisStage: 'Running YOLO detection...' });

      // ── 2. Poll until COMPLETED or FAILED ──────────────────
      const poll = async (): Promise<any> => {
        const jobRes = await authFetch(status_url);
        if (!jobRes.ok) throw new Error(`Failed to fetch job status: ${jobRes.status}`);
        const job = await jobRes.json();

        // Mirror real backend progress into UI
        if (job.progress) {
          const stage =
            job.progress < 20  ? 'Uploading PDF...' :
            job.progress < 50  ? 'Running YOLO detection...' :
            job.progress < 80  ? 'Parsing text notes...' :
            job.progress < 95  ? 'Validating results...' :
                                 'Saving artifacts...';
          updateFileStatus(id, { analysisProgress: job.progress, analysisStage: stage });
        }

        if (job.status === 'COMPLETED') return job;
        if (job.status === 'FAILED') throw new Error(job.error?.message || job.error_message || 'Analysis failed');

        // Check if user clicked Stop
        if (stopAnalysisRef.current) {
          updateFileStatus(id, { status: 'PENDING', analysisProgress: 0, analysisStage: 'Stopped by user' });
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

      const passRate = result.result?.summary?.pass_rate ?? 100;
      const overallStatus = (result.result?.summary?.overall || result.result?.overall_status || '').toUpperCase();

      console.log('[ElementIQ] Mapped detections:', detections.length, detections[0]);
      console.log('[ElementIQ] overallStatus:', overallStatus, 'passRate:', passRate);

      const fileStatus = overallStatus === 'PASS' ? 'PASS' : overallStatus === 'NO-NOTE' ? 'NO-NOTE' : overallStatus === 'FAIL' ? 'FAIL' : (detections.length > 0 ? 'PASS' : 'NO-NOTE');

      // Extract artifacts from result
      const artifacts = (result.result?.artifacts ?? []).map((a: any) => ({
        id: a.id,
        type: a.artifact_type,
        downloadUrl: a.download_url,
      }));

      updateFileStatus(id, {
        status: fileStatus as any,
        detections,
        artifacts,
        analysisProgress: 100,
        analysisStage: 'Complete',
        events: [
          ...(state.files.find(f => f.id === id)?.events ?? []),
          { id: Date.now().toString(), timestamp: new Date().toISOString(), message: `Analysis complete — ${overallStatus}`, type: 'SUCCESS' },
        ],
        passRate,
      });

    } catch (err) {
      updateFileStatus(id, {
        status: 'FAIL',
        analysisProgress: 0,
        analysisStage: 'Error',
        events: [
          ...(state.files.find(f => f.id === id)?.events ?? []),
          { id: Date.now().toString(), timestamp: new Date().toISOString(), message: `Error: ${err}`, type: 'ERROR' },
        ],
      });
    }
  }, [state.files, state.confidenceThreshold, state.selectedComponents, state.componentConfidence, updateFileStatus]);

  const analyzeAll = useCallback(async () => {
    stopAnalysisRef.current = false;
    const filesToAnalyze = state.files.filter(f => f.status !== 'ANALYZING' && f.status !== 'UPLOADING');
    if (filesToAnalyze.length === 0) return;
    for (const f of filesToAnalyze) {
      if (stopAnalysisRef.current) break;
      await analyzeFile(f.id);
    }
  }, [state.files, analyzeFile]);

  const stopAnalysis = useCallback(() => {
    stopAnalysisRef.current = true;
  }, []);

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
        stopAnalysis,
        setSelectedComponents,
        setComponentConfidence,
        toggleComponent,
        openConfigModal,
        closeConfigModal,
        setCurrentView,
        setActiveProject,
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
