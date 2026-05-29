export interface Component {
  id: string;
  name: string;
  description: string;
  modelFile: string;
  classes: string[];
  accuracy: number | null;
  status: 'ready' | 'training' | 'missing';
  trainingProgress?: number;
  lastTrained?: string;
  size?: string;
}

export interface DocumentFile {
  id: string;
  name: string;
  file: File;
  status: 'PENDING' | 'ANALYZING' | 'PASS' | 'FAIL' | 'WARN' | 'NO-NOTE';
  pages: number;
  passRate?: number;
  detections: Detection[];
  events: AppEvent[];
  analyzedComponents?: string[];
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
  componentId?: string;
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
  availableComponents: Component[];
  selectedComponents: string[];
  componentConfidence: Record<string, number>;
}
