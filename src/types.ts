export interface DocumentFile {
  id: string;
  name: string;
  file: File;
  status: 'PENDING' | 'ANALYZING' | 'PASS' | 'FAIL' | 'WARN' | 'NO-NOTE';
  pages: number;
  passRate?: number;
  detections: Detection[];
  events: AppEvent[];
}

export interface Detection {
  id: string;
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  type: 'NF' | 'FF' | 'UNKNOWN';
  confidence: number;
  status: 'PASS' | 'FAIL' | 'WARN';
  reason?: string;
  note?: string;
}

export interface AppEvent {
  id: string;
  timestamp: string;
  message: string;
  type: 'INFO' | 'SUCCESS' | 'WARN' | 'ERROR';
}

export interface SessionState {
  id: string;
  files: DocumentFile[];
  activeFileId: string | null;
  openFiles: string[];
  activePage: number;
  activeSidebarTab: 'explorer' | 'search' | 'analysis' | 'settings' | 'reports';
  isSidebarOpen: boolean;
  isEngineLive: boolean;
  confidenceThreshold: number;
}
