import type { DocumentFile, FileArtifact } from '../types';
import type { ParsedViewSplit } from './viewSplit';

const STORAGE_PREFIX = 'elementiq:guest-runs:v1';

export interface GuestRunSnapshot {
  savedAt: string;
  jobId?: string;
  status: DocumentFile['status'];
  detections: DocumentFile['detections'];
  validationAnnotations?: DocumentFile['validationAnnotations'];
  tubeCount?: number;
  passRate?: number;
  viewSplit?: ParsedViewSplit | null;
  artifacts?: FileArtifact[];
  analyzedComponents?: string[];
}

function storageKey(projectId: string, fileId: string, viewerKey: string): string {
  return `${STORAGE_PREFIX}:${viewerKey}:${projectId}:${fileId}`;
}

/** Viewer key for persisting guest re-runs — logged-in users only. */
export function getGuestRunViewerKey(userId?: string | null): string | null {
  return userId ?? null;
}

export function loadGuestRunSnapshot(
  projectId: string,
  fileId: string,
  viewerKey: string,
): GuestRunSnapshot | null {
  try {
    const raw = localStorage.getItem(storageKey(projectId, fileId, viewerKey));
    if (!raw) return null;
    return JSON.parse(raw) as GuestRunSnapshot;
  } catch {
    return null;
  }
}

export function saveGuestRunSnapshot(
  projectId: string,
  fileId: string,
  viewerKey: string,
  snapshot: GuestRunSnapshot,
): void {
  try {
    localStorage.setItem(storageKey(projectId, fileId, viewerKey), JSON.stringify(snapshot));
  } catch (err) {
    console.warn('[ElementIQ] Failed to save guest run snapshot', err);
  }
}

export function applyGuestRunSnapshot(file: DocumentFile, snapshot: GuestRunSnapshot): DocumentFile {
  return {
    ...file,
    status: snapshot.status,
    detections: snapshot.detections,
    validationAnnotations: snapshot.validationAnnotations,
    tubeCount: snapshot.tubeCount,
    passRate: snapshot.passRate,
    viewSplit: snapshot.viewSplit ?? file.viewSplit,
    artifacts: snapshot.artifacts ?? file.artifacts,
    analyzedComponents: snapshot.analyzedComponents,
    events: [
      ...file.events,
      {
        id: `guest-run-${snapshot.savedAt}`,
        timestamp: snapshot.savedAt,
        message: 'Loaded your local re-run results (not shared with project owner)',
        type: 'INFO',
      },
    ],
  };
}

export function buildGuestRunSnapshot(file: DocumentFile, jobId?: string): GuestRunSnapshot {
  return {
    savedAt: new Date().toISOString(),
    jobId,
    status: file.status,
    detections: file.detections,
    validationAnnotations: file.validationAnnotations,
    tubeCount: file.tubeCount,
    passRate: file.passRate,
    viewSplit: file.viewSplit,
    artifacts: file.artifacts,
    analyzedComponents: file.analyzedComponents,
  };
}
