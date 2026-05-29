import React, { createContext, useContext, useState, useCallback } from 'react';
import { SessionState, DocumentFile, Detection, AppEvent } from './types';
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
}

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
        analyzeFile
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
