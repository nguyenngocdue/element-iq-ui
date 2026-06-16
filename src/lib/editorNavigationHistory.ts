import type { SessionState } from '../types';

export type EditorNavEntry = {
  fileId: string | null;
  page: number;
  artifact: SessionState['activeArtifact'];
  editorView: 'pdf' | 'artifact';
};

export function snapshotEditorNav(
  state: Pick<SessionState, 'activeFileId' | 'activePage' | 'activeArtifact' | 'editorView'>,
): EditorNavEntry {
  return {
    fileId: state.activeFileId,
    page: state.activePage,
    artifact: state.activeArtifact ?? null,
    editorView: state.activeArtifact && state.editorView === 'artifact' ? 'artifact' : 'pdf',
  };
}

export function sameNavEntry(a: EditorNavEntry, b: EditorNavEntry): boolean {
  const artifactA = a.artifact?.id ?? null;
  const artifactB = b.artifact?.id ?? null;
  return (
    a.fileId === b.fileId
    && a.page === b.page
    && artifactA === artifactB
    && a.editorView === b.editorView
  );
}

export class EditorNavigationHistory {
  private back: EditorNavEntry[] = [];
  private forward: EditorNavEntry[] = [];
  private suppress = false;

  reset(): void {
    this.back = [];
    this.forward = [];
  }

  canGoBack(): boolean {
    return this.back.length > 0;
  }

  canGoForward(): boolean {
    return this.forward.length > 0;
  }

  pushLeave(leaving: EditorNavEntry): void {
    if (this.suppress) return;
    const last = this.back[this.back.length - 1];
    if (last && sameNavEntry(last, leaving)) return;
    this.back.push(leaving);
    this.forward = [];
  }

  goBack(current: EditorNavEntry): EditorNavEntry | null {
    if (this.back.length === 0) return null;
    this.forward.push(current);
    return this.back.pop() ?? null;
  }

  goForward(current: EditorNavEntry): EditorNavEntry | null {
    if (this.forward.length === 0) return null;
    this.back.push(current);
    return this.forward.pop() ?? null;
  }

  runWithoutRecording(fn: () => void): void {
    this.suppress = true;
    try {
      fn();
    } finally {
      this.suppress = false;
    }
  }
}

export function buildStateFromNavEntry(
  prev: SessionState,
  entry: EditorNavEntry,
): SessionState {
  let openFiles = prev.openFiles;
  if (entry.fileId && !openFiles.includes(entry.fileId)) {
    openFiles = [...openFiles, entry.fileId];
  }
  return {
    ...prev,
    activeFileId: entry.fileId,
    activePage: entry.page,
    openFiles,
    activeArtifact: entry.artifact,
    editorView: entry.editorView,
  };
}
