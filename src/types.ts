import type { ParsedTagNotes } from './lib/tagNotes';
import type { ParsedViewSplit } from './lib/viewSplit';
import type { ParsedViewTitles } from './lib/viewTitles';

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

export interface ComponentModelOption {
  filename: string;
  sizeMb: number;
  isDefault: boolean;
  modifiedAt?: string;
  verdictLabel?: 'recommended' | 'ok' | 'caution' | 'poor' | null;
  verdictRank?: number | null;
  map50_95?: number | null;
}

export interface FileArtifact {
  id: string;
  type: string;
  downloadUrl: string;
  sourceFileId?: string;
  localPath?: string;
  fileSizeBytes?: number;
  originalFilename?: string;
  contentType?: string;
  createdAt?: string;
}

export interface ValidationAnnotation {
  id: string;
  status:
    | 'PASS'
    | 'FAIL'
    | 'MISSING-TAG'
    | 'TAG-OCR-SUSPECT'
    | 'VISION-GAP'
    | 'REINF-COUNT'
    | 'VIEW-AMBIGUOUS';
  view?: string;
  reason?: string;
  componentId?: string;
  noteRawText?: string;
  expectedQuantity?: number | null;
  detectedQuantity?: number;
}

export interface DocumentFile {
  id: string;
  name: string;
  file: File;
  status: 'UPLOADING' | 'PENDING' | 'ANALYZING' | 'PASS' | 'FAIL' | 'WARN' | 'NO-NOTE' | 'NO-TUBE';
  /** Backend overall (e.g. MISSING-TAG) when UI status is WARN */
  overallStatus?: string;
  uploadProgress?: number;  // 0-100 for upload progress
  pages: number;
  passRate?: number;
  detections: Detection[];
  validationAnnotations?: ValidationAnnotation[];
  tubeCount?: number;
  events: AppEvent[];
  analyzedComponents?: string[];
  viewSplit?: ParsedViewSplit | null;
  viewTitles?: ParsedViewTitles | null;
  tagNotes?: ParsedTagNotes | null;
  artifacts?: FileArtifact[];
  // Real progress from backend
  analysisProgress?: number;   // 0–100
  analysisStage?: string;      // e.g. "ElementIQ Engine — scanning elements…"
  // Server metadata
  uploadedAt?: string;         // ISO timestamp from server
  localPath?: string;          // server storage path
  fileSizeBytes?: number;      // original file size in bytes
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

export interface AnalysisLogLine {
  id: string;
  ts: string;
  level: 'info' | 'success' | 'warn' | 'error' | 'dim';
  message: string;
  fileId?: string;
  workerId?: number;
}

export interface ActiveWorkerState {
  workerId: number;
  fileName: string;
}

export interface AnalysisQueueState {
  total: number;
  completed: number;
  activeCount: number;
  activeFileNames?: string[];
  activeWorkers?: ActiveWorkerState[];
}

export interface AppEvent {
  id: string;
  timestamp: string;
  message: string;
  type: 'INFO' | 'SUCCESS' | 'WARN' | 'ERROR';
}

export type PublicAccessLevel = 'view' | 'run' | 'run_download';

export interface Project {
  id: string;
  name: string;
  role: string;
  age: string;
  hasImage: boolean;
  description?: string | null;
  ownerId?: string | null;
  isPublic?: boolean;
  isReadOnly?: boolean;
  publicAccessLevel?: PublicAccessLevel;
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
  /** Per-component weights basename (.pt) chosen in Analysis Configuration */
  componentModels: Record<string, string>;
  showConfigModal: boolean;
  configModalMode: 'import' | 'reanalyze';
  configTargetFileId?: string;
  configTargetFileIds?: string[];
  currentView: 'projects' | 'editor';
  activeProject?: Project;
  isReadOnly?: boolean;
  canRun?: boolean;
  canDownload?: boolean;
  isProjectOwner?: boolean;
  guestViewerKey?: string;
  isBotOpen: boolean;
  splitMode?: 'none' | 'up' | 'down' | 'left' | 'right';
  splitFileId?: string | null;
  activeArtifact?: { id: string; type: string; downloadUrl: string; name: string; sourceFileId?: string } | null;
  /** When activeArtifact is set: 'artifact' keeps report/PNG open while PDF tabs change. */
  editorView?: 'pdf' | 'artifact';
  isAnalysisTerminalOpen: boolean;
  analysisLogs: AnalysisLogLine[];
  analysisQueue: AnalysisQueueState | null;
}
