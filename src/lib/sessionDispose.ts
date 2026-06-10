import type { DocumentFile } from '../types';

/** Strip in-memory PDF bytes and heavy payloads so GC can reclaim RAM. */
export function disposeDocumentFile(doc: DocumentFile): DocumentFile {
  return {
    ...doc,
    file: new File([], doc.name, { type: doc.file.type || 'application/pdf' }),
    detections: [],
    validationAnnotations: undefined,
    artifacts: undefined,
    events: [],
    analysisProgress: undefined,
    analysisStage: undefined,
    viewSplit: undefined,
  };
}

export function disposeDocumentFilesInPlace(files: DocumentFile[]): void {
  for (let i = 0; i < files.length; i += 1) {
    files[i] = disposeDocumentFile(files[i]);
  }
}
