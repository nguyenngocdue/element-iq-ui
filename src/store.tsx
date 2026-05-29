import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { SessionState, DocumentFile, Detection, AppEvent, Component } from './types';
import * as pdfjsLib from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.mjs`;

interface AppContextType {
  state: SessionState;
  addFiles: (files: File[]) => void;
  setActiveFile: (id: string, page?: number) => void;
  closeFile: (id: string) => void;
  setActiveSidebarTab: (tab: SessionState['activeSidebarTab']) => void;
  toggleSidebar: () => void;
  setConfidenceThreshold: (val: number) => void;
  clearSession: () => void;
  updateFileStatus: (id: string, updates: Partial<DocumentFile>) => void;
  analyzeFile: (id: string) => Promise<void>;
  setSelectedComponents: (ids: string[]) => void;
  setComponentConfidence: (id: string, confidence: number) => void;
  toggleComponent: (id: string) => void;
}

// Mock available components (P0: only grout-tube ready)
const mockComponents: Component[] = [
  {
    id: 'grout-tube',
    name: 'Grout Tube',
    description: 'NF (filled) / FF (hollow)',
    modelFile: 'grout-tube-best.pt',
    classes: ['FF', 'NF'],
    accuracy: 0.92,
    status: 'ready',
    lastTrained: '2026-05-20T10:30:00Z',
    size: '12.4 MB',
  },
  {
    id: 'm20-ferrule',
    name: 'M20 Ferrule',
    description: 'NF (filled) / FF (hollow)',
    modelFile: 'm20-ferrule-best.pt',
    classes: ['FF', 'NF'],
    accuracy: 0.95,
    status: 'ready',
    lastTrained: '2026-05-22T14:20:00Z',
    size: '10.8 MB',
  },
  {
    id: 'void-tube',
    name: 'Void Tube',
    description: 'Void tube symbol',
    modelFile: 'void-tube-best.pt',
    classes: ['void'],
    accuracy: null,
    status: 'training',
    trainingProgress: 0.75,
  },
  {
    id: 'cast-in-plate',
    name: 'Cast-in Plate',
    description: 'CP3 (3 holes) / CP4 (4 holes)',
    modelFile: 'cast-in-plate-best.pt',
    classes: ['CP3', 'CP4'],
    accuracy: null,
    status: 'missing',
  },
];

const initialState: SessionState = {
  id: 'session-1',
  files: [],
  activeFileId: null,
  openFiles: [],
  activePage: 1,
  activeSidebarTab: 'explorer',
  isSidebarOpen: true,
  isEngineLive: true,
  confidenceThreshold: 0.5,
  availableComponents: mockComponents,
  selectedComponents: ['grout-tube'], // Default: grout-tube selected
  componentConfidence: {
    'grout-tube': 0.40,
    'm20-ferrule': 0.35,
  },
};

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<SessionState>(initialState);

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
      status: 'PENDING',
      pages: 1, // Will be updated when PDF is loaded
      detections: [],
      events: [{ id: Date.now().toString(), timestamp: new Date().toISOString(), message: 'File imported', type: 'INFO' }],
    }));

    setState((prev) => ({
      ...prev,
      files: [...prev.files, ...newDocs],
      activeFileId: prev.activeFileId || newDocs[0]?.id || null,
      openFiles: prev.activeFileId ? prev.openFiles : (newDocs[0] ? [...prev.openFiles, newDocs[0].id] : prev.openFiles),
      activePage: prev.activeFileId ? prev.activePage : 1,
    }));
    
    // Async read PDF pages
    newDocs.forEach(async (doc) => {
      try {
        const arrayBuffer = await doc.file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;
        updateFileStatus(doc.id, { pages: pdf.numPages });
      } catch (e) {
        console.error('Error reading PDF pages:', e);
      }
    });
  }, [updateFileStatus]);

  const setActiveFile = useCallback((id: string, page: number = 1) => {
    setState((prev) => {
      const openFiles = prev.openFiles.includes(id) ? prev.openFiles : [...prev.openFiles, id];
      return { ...prev, activeFileId: id, activePage: page, openFiles };
    });
  }, []);

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

  const clearSession = useCallback(() => {
    setState({ ...initialState, id: `session-${Date.now()}` });
  }, []);

  const analyzeFile = useCallback(async (id: string) => {
    updateFileStatus(id, { status: 'ANALYZING' });
    const file = state.files.find(f => f.id === id)?.file;
    if (!file) return;

    try {
      const formData = new FormData();
      formData.append('document', file);
      formData.append('threshold', state.confidenceThreshold.toString());

      const res = await fetch('/api/analyze', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) throw new Error('Analysis failed');

      const data = await res.json();
      
      updateFileStatus(id, {
        status: data.passRate === 100 ? 'PASS' : (data.passRate >= 50 ? 'WARN' : 'FAIL'), // Simplified logic
        detections: data.detections,
        events: [
          ...state.files.find(f => f.id === id)?.events || [],
          { id: Date.now().toString(), timestamp: new Date().toISOString(), message: 'Analysis complete', type: 'SUCCESS' }
        ],
        passRate: data.passRate,
      });

    } catch (err) {
      updateFileStatus(id, {
        status: 'FAIL',
        events: [
          ...state.files.find(f => f.id === id)?.events || [],
          { id: Date.now().toString(), timestamp: new Date().toISOString(), message: 'Analysis engine error', type: 'ERROR' }
        ]
      });
    }
  }, [state.files, state.confidenceThreshold, updateFileStatus]);

  return (
    <AppContext.Provider
      value={{
        state,
        addFiles,
        setActiveFile,
        closeFile,
        setActiveSidebarTab,
        toggleSidebar,
        setConfidenceThreshold,
        clearSession,
        updateFileStatus,
        analyzeFile,
        setSelectedComponents,
        setComponentConfidence,
        toggleComponent,
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
