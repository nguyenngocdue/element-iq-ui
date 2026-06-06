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
  status: 'UPLOADING' | 'PENDING' | 'ANALYZING' | 'PASS' | 'FAIL' | 'WARN' | 'NO-NOTE';
  uploadProgress?: number;  // 0-100 for upload progress
  pages: number;
  passRate?: number;
  detections: Detection[];
  events: AppEvent[];
  analyzedComponents?: string[];
  // Real progress from backend
  analysisProgress?: number;   // 0–100
  analysisStage?: string;      // e.g. "Running YOLO detection..."
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

export interface Project {
  id: string;
  name: string;
  role: string;
  age: string;
  hasImage: boolean;
}

export interface SessionState {
  id: string;
  files: DocumentFile[];
  isLoadingFiles: boolean;
  activeFileId: string | null;
  openFiles: string[];
  pinnedFiles: string[];
  activePage: number;
  activeSidebarTab: 'explorer' | 'search' | 'analysis' | 'settings' | 'reports';
  isSidebarOpen: boolean;
  isValidationOpen: boolean;
  isEngineLive: boolean;
  confidenceThreshold: number;
  availableComponents: Component[];
  selectedComponents: string[];
  componentConfidence: Record<string, number>;
  showConfigModal: boolean;
  configModalMode: 'import' | 'reanalyze';
  configTargetFileId?: string;
  currentView: 'projects' | 'editor';
  activeProject?: Project;
  isBotOpen: boolean;
  splitMode?: 'none' | 'up' | 'down' | 'left' | 'right';
  splitFileId?: string | null;
}
