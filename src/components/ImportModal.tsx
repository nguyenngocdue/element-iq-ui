import React, { useState } from 'react';
import { useApp } from '../store';
import { ComponentCard } from './ComponentCard';
import { X, Upload, FileText, RefreshCw, AlertTriangle, ArrowRight } from 'lucide-react';
import { cn } from '../lib/utils';

export interface AnalysisConfigModalProps {
  open: boolean;
  onClose: () => void;
  mode?: 'import' | 'reanalyze';
  targetFileId?: string;
  targetFileIds?: string[];
}

// ── Duplicate resolution types ────────────────────────────────
type DuplicateResolution = 'rename-auto' | 'rename-custom' | 'override' | 'skip';

interface DuplicateConflict {
  file: File;
  existingName: string;
  existingFileId: string | null;
  suggestedName: string;
  resolution: DuplicateResolution;
  customName: string;
}

interface UploadQueueItem {
  file: File;
  uploadName: string;
  replaceExisting?: boolean;
}

// ── Helpers ───────────────────────────────────────────────────
function splitFilename(name: string): { stem: string; ext: string } {
  const dot = name.lastIndexOf('.');
  if (dot === -1) return { stem: name, ext: '' };
  return { stem: name.slice(0, dot), ext: name.slice(dot) };
}

/** Next `{stem}-new-01{ext}` slot based on names already in project / batch. */
function reserveAutoRenameName(original: string, takenNames: Set<string>): string {
  const { stem, ext } = splitFilename(original);
  const stemLower = stem.toLowerCase();
  const extLower = ext.toLowerCase();
  const prefixLower = `${stemLower}-new-`;

  let maxNum = 0;
  for (const taken of takenNames) {
    const { stem: takenStem, ext: takenExt } = splitFilename(taken);
    if (takenExt.toLowerCase() !== extLower) continue;
    const takenStemLower = takenStem.toLowerCase();
    if (takenStemLower === stemLower) {
      maxNum = Math.max(maxNum, 0);
      continue;
    }
    if (!takenStemLower.startsWith(prefixLower)) continue;
    const suffix = takenStemLower.slice(prefixLower.length);
    if (/^\d+$/.test(suffix)) {
      maxNum = Math.max(maxNum, parseInt(suffix, 10));
    }
  }

  let num = maxNum + 1;
  let candidate = `${stem}-new-${String(num).padStart(2, '0')}${ext}`;
  while (takenNames.has(candidate.toLowerCase())) {
    num += 1;
    candidate = `${stem}-new-${String(num).padStart(2, '0')}${ext}`;
  }
  takenNames.add(candidate.toLowerCase());
  return candidate;
}

function uploadNameFor(item: DuplicateConflict): string | null {
  if (item.resolution === 'skip') return null;
  if (item.resolution === 'override') return item.existingName;
  if (item.resolution === 'rename-custom' && item.customName.trim()) {
    return item.customName.trim();
  }
  return item.suggestedName;
}

function assignUniqueSuggestedNames(
  conflicts: DuplicateConflict[],
  takenNames: Set<string>,
): DuplicateConflict[] {
  const used = new Set(takenNames);
  return conflicts.map((item) => {
    const suggested = reserveAutoRenameName(item.file.name, used);
    return {
      ...item,
      suggestedName: suggested,
      customName:
        item.resolution === 'rename-custom' && item.customName.trim()
          ? item.customName
          : suggested,
    };
  });
}

function ensureUniqueUploadNames(
  items: UploadQueueItem[],
  takenNames: Set<string>,
): UploadQueueItem[] {
  const used = new Set(takenNames);
  return items.map((item) => {
    if (item.replaceExisting) {
      used.add(item.uploadName.toLowerCase());
      return item;
    }
    const lower = item.uploadName.toLowerCase();
    if (!used.has(lower)) {
      used.add(lower);
      return item;
    }
    return { file: item.file, uploadName: reserveAutoRenameName(item.file.name, used) };
  });
}

// ── Duplicate Resolution Dialog ───────────────────────────────
function DuplicateDialog({
  conflicts,
  takenNames,
  onResolve,
}: {
  conflicts: DuplicateConflict[];
  takenNames: Set<string>;
  onResolve: (resolved: DuplicateConflict[]) => void;
}) {
  const [items, setItems] = useState<DuplicateConflict[]>(conflicts);

  const update = (idx: number, patch: Partial<DuplicateConflict>) => {
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, ...patch } : it));
  };

  const applySkipAll = () => {
    setItems(prev => prev.map(it => ({ ...it, resolution: 'skip' as DuplicateResolution })));
  };

  const applyAutoRenameAll = () => {
    setItems(prev => {
      const renamed = prev.map(it => ({
        ...it,
        resolution: 'rename-auto' as DuplicateResolution,
      }));
      return assignUniqueSuggestedNames(renamed, takenNames);
    });
  };

  const applyOverrideAll = () => {
    setItems(prev => prev.map(it => ({
      ...it,
      resolution: 'override' as DuplicateResolution,
    })));
  };

  const allResolved = items.every(it =>
    it.resolution === 'skip' ||
    it.resolution === 'override' ||
    it.resolution === 'rename-auto' ||
    (it.resolution === 'rename-custom' && it.customName.trim().length > 0)
  );

  const uploadPreview = items
    .map(it => ({
      item: it,
      name: uploadNameFor(it),
      override: it.resolution === 'override',
    }))
    .filter((row): row is { item: DuplicateConflict; name: string; override: boolean } => row.name != null);

  const skipCount = items.filter(it => it.resolution === 'skip').length;
  const overrideCount = items.filter(it => it.resolution === 'override').length;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-[#1e1e1e] border border-[#3c3c3c] rounded-xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-[#3c3c3c] bg-[#252526] flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-[#f59e0b] shrink-0" />
          <div>
            <h3 className="text-white font-bold text-sm">Duplicate File Names Detected</h3>
            <p className="text-[#858585] text-[11px] mt-0.5">{items.length} file(s) already exist in this project</p>
          </div>
        </div>

        {uploadPreview.length > 0 && (
          <div className="px-4 pt-3 pb-1 border-b border-[#3c3c3c]">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-[#858585] mb-2">
              Upload preview ({uploadPreview.length} file{uploadPreview.length !== 1 ? 's' : ''})
            </p>
            <div className="space-y-1.5 max-h-28 overflow-y-auto">
              {uploadPreview.map(({ item, name, override }) => (
                <div
                  key={`${item.existingName}-${name}-${override ? 'ov' : 'rn'}`}
                  className="flex items-center gap-1.5 text-[10px] font-mono min-w-0"
                >
                  {override ? (
                    <>
                      <span className="text-[#fbbf24] font-medium truncate">{name}</span>
                      <span className="shrink-0 rounded bg-[#f59e0b]/15 px-1 py-0.5 text-[9px] text-[#fbbf24]">
                        replace
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="text-[#858585] truncate shrink">{item.existingName}</span>
                      <ArrowRight className="w-3 h-3 text-[#555] shrink-0" />
                      <span className="text-[#10b981] font-medium truncate">{name}</span>
                    </>
                  )}
                </div>
              ))}
            </div>
            {overrideCount > 0 && (
              <p className="text-[10px] text-[#fbbf24] mt-2">
                {overrideCount} file{overrideCount !== 1 ? 's' : ''} will replace existing drawing(s)
              </p>
            )}
            {skipCount > 0 && (
              <p className="text-[10px] text-[#858585] mt-2">
                {skipCount} file{skipCount !== 1 ? 's' : ''} will be skipped
              </p>
            )}
          </div>
        )}

        {/* Conflict list */}
        <div className="flex-1 overflow-y-auto max-h-[50vh] p-4 space-y-3">
          {items.map((item, idx) => {
            const previewName = uploadNameFor(item);
            return (
            <div key={idx} className="bg-[#252526] border border-[#3c3c3c] rounded-lg p-3 space-y-2">
              <div className="flex items-center gap-2">
                <FileText className="w-3.5 h-3.5 text-[#f59e0b] shrink-0" />
                <span className="text-white text-[12px] font-medium truncate flex-1">{item.existingName}</span>
                <span className="text-[#f59e0b] text-[10px] font-bold bg-[#f59e0b]/10 px-1.5 py-0.5 rounded shrink-0">EXISTS</span>
              </div>

              {previewName && item.resolution === 'override' && (
                <div className="flex items-center gap-1.5 rounded-md bg-[#3d2a0f]/50 border border-[#f59e0b]/30 px-2.5 py-1.5">
                  <span className="text-[10px] text-[#fbbf24] font-mono font-semibold truncate">{previewName}</span>
                  <span className="shrink-0 text-[9px] text-[#f59e0b]">replaces existing file</span>
                </div>
              )}

              {previewName && item.resolution !== 'override' && (
                <div className="flex items-center gap-1.5 rounded-md bg-[#1a3d28]/40 border border-[#10b981]/25 px-2.5 py-1.5">
                  <span className="text-[10px] text-[#858585] font-mono truncate">{item.existingName}</span>
                  <ArrowRight className="w-3 h-3 text-[#10b981] shrink-0" />
                  <span className="text-[10px] text-[#86efac] font-mono font-semibold truncate">{previewName}</span>
                </div>
              )}

              {item.resolution === 'skip' && (
                <p className="text-[10px] text-[#ef4444]/80 italic">This file will not be uploaded</p>
              )}

              {/* Resolution options */}
              <div className="space-y-1.5 pt-1">
                {/* Option 1: Auto rename */}
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="radio"
                    name={`res-${idx}`}
                    checked={item.resolution === 'rename-auto'}
                    onChange={() => update(idx, { resolution: 'rename-auto' })}
                    className="mt-0.5 accent-[#10b981]"
                  />
                  <div className="min-w-0">
                    <span className="text-[11px] text-white font-medium">Upload with auto name</span>
                    <p className="text-[10px] text-[#10b981] font-mono truncate mt-0.5">{item.suggestedName}</p>
                  </div>
                </label>

                {/* Option 2: Custom rename */}
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="radio"
                    name={`res-${idx}`}
                    checked={item.resolution === 'rename-custom'}
                    onChange={() => update(idx, { resolution: 'rename-custom' })}
                    className="mt-0.5 accent-[#10b981]"
                  />
                  <div className="flex-1 min-w-0">
                    <span className="text-[11px] text-white font-medium">Upload with custom name</span>
                    {item.resolution === 'rename-custom' && (
                      <input
                        autoFocus
                        type="text"
                        value={item.customName}
                        onChange={e => update(idx, { customName: e.target.value })}
                        placeholder="Enter new filename..."
                        className="mt-1.5 w-full bg-[#1e1e1e] border border-[#3c3c3c] focus:border-[#10b981] rounded px-2 py-1 text-[11px] text-white outline-none placeholder-[#555] font-mono"
                      />
                    )}
                  </div>
                </label>

                {/* Option 3: Override */}
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="radio"
                    name={`res-${idx}`}
                    checked={item.resolution === 'override'}
                    onChange={() => update(idx, { resolution: 'override' })}
                    className="mt-0.5 accent-[#f59e0b]"
                  />
                  <div className="min-w-0">
                    <span className="text-[11px] text-white font-medium">Override existing file</span>
                    <p className="text-[10px] text-[#fbbf24] font-mono truncate mt-0.5">{item.existingName}</p>
                    <p className="text-[10px] text-[#858585] mt-0.5">Replace the current drawing — analysis data will be removed.</p>
                  </div>
                </label>

                {/* Option 4: Skip */}
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="radio"
                    name={`res-${idx}`}
                    checked={item.resolution === 'skip'}
                    onChange={() => update(idx, { resolution: 'skip' })}
                    className="accent-[#ef4444]"
                  />
                  <span className="text-[11px] text-[#ef4444] font-medium">Skip this file</span>
                </label>
              </div>
            </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#3c3c3c] bg-[#252526] flex justify-end gap-2">
          <button
            onClick={applySkipAll}
            className="px-3 py-1.5 text-[12px] text-[#858585] hover:text-white transition-colors"
          >
            Skip All
          </button>
          <button
            onClick={applyOverrideAll}
            className="px-3 py-1.5 text-[12px] bg-[#252526] border border-[#f59e0b]/40 text-[#fbbf24] rounded hover:bg-[#3d2a0f]/40 transition-colors"
          >
            Override All
          </button>
          <button
            onClick={applyAutoRenameAll}
            className="px-3 py-1.5 text-[12px] bg-[#252526] border border-[#3c3c3c] text-white rounded hover:bg-[#333] transition-colors"
          >
            Auto Rename All
          </button>
          <button
            disabled={!allResolved}
            onClick={() => onResolve(items)}
            className={cn(
              'px-4 py-1.5 text-[12px] font-semibold rounded transition-colors',
              allResolved
                ? 'bg-[#10b981] hover:bg-[#059669] text-white'
                : 'bg-[#3c3c3c] text-[#555] cursor-not-allowed'
            )}
          >
            {uploadPreview.length === 0
              ? 'Close'
              : `Confirm & Upload (${uploadPreview.length})`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Modal ────────────────────────────────────────────────
export function AnalysisConfigModal({ open, onClose, mode = 'import', targetFileId, targetFileIds }: AnalysisConfigModalProps) {
  const { state, setSelectedComponents, setComponentConfidence, setComponentModel, analyzeFile, analyzeAll, analyzeSelected, refreshProjectFiles } = useApp();
  const [files, setFiles] = useState<File[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [uploadPhase, setUploadPhase] = useState<'idle' | 'uploading' | 'syncing'>('idle');
  const [uploadedCount, setUploadedCount] = useState(0);
  const [uploadTotal, setUploadTotal] = useState(0);
  const [uploadErrors, setUploadErrors] = useState<string[]>([]);
  const [duplicateConflicts, setDuplicateConflicts] = useState<DuplicateConflict[] | null>(null);
  const [uploadQueue, setUploadQueue] = useState<UploadQueueItem[] | null>(null);
  const uploadLockRef = React.useRef(false);

  const isBusy = uploadPhase !== 'idle';

  const requestClose = () => {
    if (isBusy) return;
    onClose();
  };

  // Warn browser if upload in progress
  React.useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (isBusy) {
        e.preventDefault();
        e.returnValue = 'File upload is in progress. Leaving will cancel remaining uploads.';
        return e.returnValue;
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isBusy]);

  if (!open) return null;

  // ── Core upload logic ─────────────────────────────────────
  /** Filenames already in the project — excludes the import batch so first-time uploads keep their names. */
  const buildTakenNames = () => new Set(state.files.map(f => f.name.toLowerCase()));

  const startUpload = async (filesToUpload: UploadQueueItem[]) => {
    if (uploadLockRef.current) return;
    uploadLockRef.current = true;
    const queue = ensureUniqueUploadNames(filesToUpload, buildTakenNames());
    setUploadQueue(queue);
    setUploadPhase('uploading');
    setUploadedCount(0);
    setUploadTotal(queue.length);
    setUploadErrors([]);

    const { authFetch } = await import('../lib/supabase');
    const projectId = state.activeProject?.id;
    const errors: string[] = [];
    const uploadedIds: string[] = [];
    const reservedNames = buildTakenNames();

    const deleteExistingForOverride = async (name: string): Promise<boolean> => {
      const existing = state.files.find(f => f.name.toLowerCase() === name.toLowerCase());
      if (!existing) return true;
      const delRes = await authFetch(`/api/v1/files/${existing.id}`, { method: 'DELETE' });
      if (delRes.ok || delRes.status === 404) {
        reservedNames.delete(name.toLowerCase());
        return true;
      }
      const errBody = await delRes.json().catch(() => ({ detail: `HTTP ${delRes.status}` }));
      const detail = typeof errBody?.detail === 'string'
        ? errBody.detail
        : `HTTP ${delRes.status}`;
      errors.push(`${name}: could not replace existing file — ${detail}`);
      return false;
    };

    const uploadSingle = async (
      file: File,
      initialName: string,
      replaceExisting = false,
    ): Promise<boolean> => {
      let uploadName = initialName;
      for (let attempt = 0; attempt < 2; attempt += 1) {
        if (replaceExisting) {
          const deleted = await deleteExistingForOverride(uploadName);
          if (!deleted) return false;
        } else if (reservedNames.has(uploadName.toLowerCase())) {
          uploadName = reserveAutoRenameName(file.name, reservedNames);
        } else {
          reservedNames.add(uploadName.toLowerCase());
        }

        if (replaceExisting) {
          reservedNames.add(uploadName.toLowerCase());
        }

        const arrayBuffer = await file.arrayBuffer();
        const uploadFile = new File([arrayBuffer], uploadName, {
          type: file.type || 'application/pdf',
        });
        const formData = new FormData();
        formData.append('file', uploadFile, uploadName);
        if (projectId) formData.append('project_id', projectId);
        const res = await authFetch('/api/v1/files', { method: 'POST', body: formData });
        if (res.ok) {
          const data = await res.json();
          uploadedIds.push(String(data.id));
          if (data.duplicate) {
            console.info(`[ImportModal] "${uploadName}" already exists in project (same filename)`);
          }
          window.dispatchEvent(new CustomEvent('elementiq:file-uploaded', {
            detail: {
              id: data.id,
              name: data.filename ?? uploadName,
              size: uploadFile.size,
              file: uploadFile,
              localPath: data.local_path,
              duplicate: !!data.duplicate,
            },
          }));
          return true;
        }

        const errBody = await res.json().catch(() => ({ detail: `HTTP ${res.status}` }));
        const detail = typeof errBody?.detail === 'string'
          ? errBody.detail
          : `HTTP ${res.status}`;

        if (res.status === 409 && attempt === 0) {
          reservedNames.delete(uploadName.toLowerCase());
          uploadName = reserveAutoRenameName(file.name, reservedNames);
          continue;
        }

        errors.push(`${uploadName}: ${detail}`);
        console.error(`[ImportModal] Upload failed for "${uploadName}": ${res.status}`, errBody);
        return false;
      }
      return false;
    };

    try {
      for (let i = 0; i < queue.length; i++) {
        const { file, uploadName, replaceExisting } = queue[i];
        try {
          await uploadSingle(file, uploadName, replaceExisting);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          errors.push(`${uploadName}: ${msg}`);
          console.error(`Upload error: ${uploadName}`, err);
        }
        setUploadedCount(i + 1);
      }

      if (errors.length > 0) {
        setUploadErrors(errors);
        return;
      }

      setUploadPhase('syncing');
      try {
        await refreshProjectFiles({ silent: true, focusFileIds: uploadedIds });
      } catch (refreshErr) {
        console.error('[ImportModal] Failed to refresh project files after upload:', refreshErr);
        errors.push('Could not refresh project file list — try reloading the project.');
        setUploadErrors(errors);
        return;
      }
    } finally {
      uploadLockRef.current = false;
      if (errors.length === 0) {
        setUploadPhase('idle');
        setFiles([]);
        setUploadQueue(null);
        setUploadedCount(0);
        setUploadTotal(0);
        setDuplicateConflicts(null);
        onClose();
      } else {
        setUploadPhase('idle');
      }
    }
  };

  // ── Duplicate resolution callback ─────────────────────────
  const handleDuplicateResolved = async (resolved: DuplicateConflict[]) => {
    setDuplicateConflicts(null);
    const conflictNames = new Set(resolved.map(c => c.file.name));
    const nonConflict = files
      .filter(f => !conflictNames.has(f.name))
      .map(f => ({ file: f, uploadName: f.name }));
    const resolvedUploads = resolved
      .filter(c => c.resolution !== 'skip')
      .map(c => ({
        file: c.file,
        uploadName: uploadNameFor(c)!,
        replaceExisting: c.resolution === 'override',
      }));
    const allToUpload = [...nonConflict, ...resolvedUploads];
    if (allToUpload.length === 0) { requestClose(); return; }
    await startUpload(allToUpload);
  };

  // ── Drag & drop handlers ──────────────────────────────────
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') setDragActive(true);
    else if (e.type === 'dragleave') setDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (mode !== 'import') return;
    const droppedFiles = Array.from(e.dataTransfer.files).filter((f: File) => f.type === 'application/pdf');
    setFiles(prev => [...prev, ...droppedFiles].slice(0, 100));
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && mode === 'import') {
      setFiles(prev => [...prev, ...Array.from(e.target.files!)].slice(0, 100));
    }
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  // ── Main action ───────────────────────────────────────────
  const handleAnalyze = async () => {
    if (mode === 'import') {
      if (files.length === 0) return;

      // Check for filename conflicts with existing project files
      const existingNames = new Set(state.files.map(f => f.name.toLowerCase()));
      const takenNames = new Set(existingNames);
      for (const f of files) {
        if (!existingNames.has(f.name.toLowerCase())) {
          takenNames.add(f.name.toLowerCase());
        }
      }
      const rawConflicts: DuplicateConflict[] = files
        .filter(f => existingNames.has(f.name.toLowerCase()))
        .map(f => {
          const existing = state.files.find(
            sf => sf.name.toLowerCase() === f.name.toLowerCase(),
          );
          return {
            file: f,
            existingName: f.name,
            existingFileId: existing?.id ?? null,
            suggestedName: '',
            resolution: 'rename-auto' as DuplicateResolution,
            customName: '',
          };
        });
      const conflicts = assignUniqueSuggestedNames(rawConflicts, takenNames);

      if (conflicts.length > 0) {
        setDuplicateConflicts(conflicts);
        return;
      }

      await startUpload(files.map(f => ({ file: f, uploadName: f.name })));
    } else {
      if (state.selectedComponents.length > 0) {
        onClose();
        if (targetFileIds && targetFileIds.length > 0) {
          void analyzeSelected(targetFileIds);
        } else if (targetFileId) {
          void analyzeFile(targetFileId);
        } else {
          void analyzeAll();
        }
      }
    }
  };

  const selectedCount = state.selectedComponents.length;
  const readyComponents = state.availableComponents.filter(c => c.status === 'ready');
  const canAnalyze = mode === 'import' ? files.length > 0 : selectedCount > 0;
  const targetFileCount = targetFileIds?.length ?? (targetFileId ? 1 : state.files.length);

  const progressItems: UploadQueueItem[] = uploadQueue ?? files.map(f => ({ file: f, uploadName: f.name }));
  const progressListActive = isBusy && uploadQueue != null;
  const listCount = progressListActive ? uploadQueue.length : files.length;

  return (
    <>
      {/* Duplicate resolution dialog — rendered on top of the import modal */}
      {duplicateConflicts && (
        <DuplicateDialog
          conflicts={duplicateConflicts}
          takenNames={
            new Set([
              ...state.files.map(f => f.name.toLowerCase()),
              ...files
                .filter(f => !state.files.some(sf => sf.name.toLowerCase() === f.name.toLowerCase()))
                .map(f => f.name.toLowerCase()),
            ])
          }
          onResolve={handleDuplicateResolved}
        />
      )}

      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm shadow-2xl">
        <div
          className={cn(
            'relative w-full max-w-4xl max-h-[90vh] shadow-2xl',
            isBusy && 'import-modal-border-wrap',
          )}
        >
          {isBusy && <div className="import-modal-border-glow" aria-hidden />}
          <div
            className={cn(
              'flex flex-col overflow-hidden max-h-[90vh] w-full',
              isBusy ? 'import-modal-border-inner' : 'bg-[#252526] border border-[#3c3c3c] rounded-xl',
            )}
          >
          <div className="flex items-center justify-between p-5 border-b border-[#3c3c3c] bg-[#1e1e1e]">
            <h2 className="text-xl font-bold text-white uppercase tracking-wider">{mode === 'import' ? 'Import Drawings' : 'Analysis Configuration'}</h2>
            <button
              onClick={requestClose}
              disabled={isBusy}
              className={cn(
                'p-1 rounded transition-colors',
                isBusy ? 'text-[#555] cursor-not-allowed' : 'hover:bg-[#3c3c3c] text-[#858585] hover:text-white',
              )}
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {mode !== 'import' && (
              <section>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider">Step 1: Select Components to Analyze</h3>
                  <span className="text-xs text-[#2eb886] border border-[#2eb886]/30 bg-[#2eb886]/10 px-2 flex items-center gap-1 font-bold py-1 rounded">{selectedCount} of {readyComponents.length} selected</span>
                </div>
                <div className="space-y-3">
                  {state.availableComponents.map(comp => (
                    <ComponentCard
                      key={comp.id}
                      component={comp}
                      selected={state.selectedComponents.includes(comp.id)}
                      confidence={state.componentConfidence[comp.id] || 0.4}
                      selectedModel={state.componentModels[comp.id]}
                      onToggle={(id) => {
                        const isSelected = state.selectedComponents.includes(id);
                        const newSelection = isSelected
                          ? state.selectedComponents.filter(c => c !== id)
                          : [...state.selectedComponents, id];
                        setSelectedComponents(newSelection);
                      }}
                      onConfidenceChange={setComponentConfidence}
                      onModelChange={setComponentModel}
                    />
                  ))}
                </div>
              </section>
            )}

            {mode === 'import' && (
              <section>
                <div className="flex gap-4 h-full">
                  {/* Left: Drag & Drop */}
                  <div className="w-1/3 shrink-0">
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-3">Upload</h3>
                    <div
                      onDragEnter={handleDrag}
                      onDragLeave={handleDrag}
                      onDragOver={handleDrag}
                      onDrop={handleDrop}
                      className={cn('border-2 border-dashed rounded-lg text-center transition-all h-[200px] flex flex-col items-center justify-center', dragActive ? 'border-[#10b981] bg-[#10b981]/10' : 'border-[#3c3c3c] bg-[#1e1e1e] hover:border-[#858585]')}
                    >
                      <Upload className={cn('w-8 h-8 mb-2', dragActive ? 'text-[#10b981]' : 'text-[#858585]')} />
                      <p className="text-white font-semibold text-xs mb-1">{dragActive ? 'Drop here' : 'Drag & drop'}</p>
                      <p className="text-[#858585] text-[10px] mb-2">or</p>
                      <label className="bg-[#10b981] hover:bg-[#059669] text-white px-4 py-1.5 rounded cursor-pointer text-xs font-semibold">
                        Browse
                        <input type="file" multiple accept=".pdf" onChange={handleFileInput} className="hidden" />
                      </label>
                      <p className="text-[#858585] text-[9px] mt-2">Max 100 files, 100MB each</p>
                    </div>
                  </div>

                  {/* Right: File List */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-bold text-white uppercase tracking-wider">Files ({listCount}/100)</h3>
                      {files.length > 0 && !isBusy && (
                        <button onClick={() => setFiles([])} className="text-xs text-[#ef4444] hover:underline">Clear All</button>
                      )}
                    </div>
                    {listCount === 0 ? (
                      <div className="h-[200px] flex items-center justify-center border border-[#3c3c3c] rounded-lg bg-[#1e1e1e]">
                        <p className="text-[#858585] text-xs">No files selected</p>
                      </div>
                    ) : (
                      <div className="overflow-y-auto space-y-1 max-h-[300px]">
                        {(progressListActive ? uploadQueue! : progressItems).map((item, index) => {
                          const { file, uploadName } = item;
                          const replacing = progressListActive && 'replaceExisting' in item && item.replaceExisting;
                          const renamed = uploadName !== file.name;
                          const done = isBusy && (index < uploadedCount || uploadPhase === 'syncing');
                          const active = isBusy && index === uploadedCount && uploadPhase === 'uploading';
                          return (
                          <div key={`${file.name}-${file.size}-${index}`} className="flex items-center justify-between bg-[#1e1e1e] border border-[#3c3c3c] rounded px-2 py-1.5 text-[12px]">
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              {isBusy ? (
                                done ? (
                                  <svg className="w-3.5 h-3.5 text-[#22c55e] shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/></svg>
                                ) : active ? (
                                  <div className="w-3.5 h-3.5 border-2 border-[#3b82f6] border-t-transparent rounded-full animate-spin shrink-0" />
                                ) : (
                                  <FileText className="w-3.5 h-3.5 text-[#858585] shrink-0" />
                                )
                              ) : (
                                <FileText className={cn('w-3.5 h-3.5 shrink-0', state.files.some(f => f.name.toLowerCase() === file.name.toLowerCase()) ? 'text-[#f59e0b]' : 'text-[#10b981]')} />
                              )}
                              {replacing ? (
                                <div className="flex min-w-0 flex-1 items-center gap-1.5 rounded-md border border-[#f59e0b]/30 bg-[#3d2a0f]/40 px-1.5 py-0.5">
                                  <span className={cn(
                                    'truncate text-[11px] font-mono font-semibold text-[#fbbf24]',
                                    done && 'text-[#858585]',
                                  )}>
                                    {uploadName}
                                  </span>
                                  <span className="shrink-0 text-[9px] text-[#f59e0b]">replace</span>
                                </div>
                              ) : renamed && progressListActive ? (
                                <div className="flex min-w-0 flex-1 items-center gap-1 rounded-md border border-[#10b981]/25 bg-[#1a3d28]/40 px-1.5 py-0.5">
                                  <span className="truncate text-[10px] font-mono text-[#858585]">{file.name}</span>
                                  <ArrowRight className="w-3 h-3 shrink-0 text-[#10b981]" />
                                  <span className={cn(
                                    'truncate text-[11px] font-mono font-semibold text-[#86efac]',
                                    done && 'text-[#858585]',
                                  )}>
                                    {uploadName}
                                  </span>
                                </div>
                              ) : (
                                <span className={cn('truncate', done ? 'text-[#858585]' : 'text-white')}>{file.name}</span>
                              )}
                              {!isBusy && state.files.some(f => f.name.toLowerCase() === file.name.toLowerCase()) && (
                                <span className="text-[9px] text-[#f59e0b] bg-[#f59e0b]/10 px-1 py-0.5 rounded shrink-0">duplicate</span>
                              )}
                              <span className="text-[10px] text-[#858585] shrink-0 ml-1">{(file.size / 1024 / 1024).toFixed(1)}MB</span>
                            </div>
                            {!isBusy && (
                              <button onClick={() => removeFile(files.indexOf(file))} className="p-0.5 hover:bg-[#3c3c3c] rounded text-[#ef4444] shrink-0 ml-1">
                                <X className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </section>
            )}
          </div>

          {uploadErrors.length > 0 && (
            <div className="px-5 py-3 border-t border-[#3c3c3c] bg-[#2a1a1a]">
              <p className="text-[#ef4444] text-xs font-semibold mb-2">Upload failed for {uploadErrors.length} file(s):</p>
              <ul className="space-y-1 max-h-24 overflow-y-auto">
                {uploadErrors.map((err) => (
                  <li key={err} className="text-[11px] text-[#fca5a5] font-mono truncate">{err}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex items-center justify-between p-5 border-t border-[#3c3c3c] bg-[#1e1e1e]">
            <div className="text-sm text-[#858585]">
              {canAnalyze ? (
                mode === 'import' ? (
                  isBusy ? (
                    uploadPhase === 'syncing' ? (
                      <span className="text-[#3b82f6]">Syncing project file list…</span>
                    ) : (
                      <span className="text-[#3b82f6]">Uploading <span className="text-white font-semibold">{uploadedCount}/{uploadTotal || listCount}</span> file(s) • {((uploadQueue ?? progressItems).reduce((a, item) => a + item.file.size, 0) / 1024 / 1024).toFixed(1)} MB</span>
                    )
                  ) : uploadErrors.length > 0 ? (
                    <span className="text-[#ef4444]">Fix errors above and click Import Files to retry failed uploads.</span>
                  ) : (
                    <span>
                      Ready to import <span className="text-white font-semibold">{files.length}</span> file(s) • {(files.reduce((a, f) => a + f.size, 0) / 1024 / 1024).toFixed(1)} MB total
                      {files.some(f => state.files.some(sf => sf.name.toLowerCase() === f.name.toLowerCase())) && (
                        <span className="ml-2 text-[#f59e0b] text-xs">⚠ {files.filter(f => state.files.some(sf => sf.name.toLowerCase() === f.name.toLowerCase())).length} duplicate(s) will be resolved</span>
                      )}
                    </span>
                  )
                ) : (
                  <span>Ready to analyze <span className="text-white font-semibold">{targetFileCount}</span> file(s) with <span className="text-white font-semibold">{selectedCount}</span> component(s)</span>
                )
              ) : (
                <span>{mode === 'import' ? 'Select files' : 'Select components '}to continue</span>
              )}
            </div>
            <div className="flex gap-3">
              <button
                onClick={requestClose}
                disabled={isBusy}
                className={cn(
                  'px-4 py-2 text-sm font-semibold transition-colors',
                  isBusy ? 'text-[#555] cursor-not-allowed' : 'text-[#858585] hover:text-white',
                )}
              >
                Cancel
              </button>
              <button
                onClick={handleAnalyze}
                disabled={!canAnalyze || isBusy}
                className={cn('px-6 py-2 text-sm font-semibold flex items-center gap-2 rounded transition-colors shadow-lg', canAnalyze && !isBusy ? 'bg-[#10b981] hover:bg-[#059669] text-white shadow-[#10b981]/20' : 'bg-[#3c3c3c] text-[#858585] cursor-not-allowed')}
              >
                {isBusy && <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                {mode !== 'import' && !isBusy && <RefreshCw className="w-4 h-4" />}
                {isBusy
                  ? uploadPhase === 'syncing'
                    ? 'Syncing…'
                    : `${uploadedCount}/${uploadTotal || listCount}`
                  : mode === 'import'
                    ? 'Import Files'
                    : 'Start Analysis'}
              </button>
            </div>
          </div>
          </div>
        </div>
      </div>
    </>
  );
}
