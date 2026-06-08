import React, { useState } from 'react';
import { useApp } from '../store';
import { ComponentCard } from './ComponentCard';
import { X, Upload, FileText, RefreshCw, AlertTriangle } from 'lucide-react';
import { cn } from '../lib/utils';

export interface AnalysisConfigModalProps {
  open: boolean;
  onClose: () => void;
  mode?: 'import' | 'reanalyze';
  targetFileId?: string;
  targetFileIds?: string[];
}

// ── Duplicate resolution types ────────────────────────────────
type DuplicateResolution = 'rename-auto' | 'rename-custom' | 'skip';

interface DuplicateConflict {
  file: File;
  existingName: string;
  suggestedName: string;
  resolution: DuplicateResolution;
  customName: string;
}

// ── Helpers ───────────────────────────────────────────────────
function buildSuggestedName(original: string): string {
  const now = new Date();
  const ts = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
    String(now.getHours()).padStart(2, '0'),
    String(now.getMinutes()).padStart(2, '0'),
    String(now.getSeconds()).padStart(2, '0'),
  ].join('');
  const dot = original.lastIndexOf('.');
  if (dot === -1) return `${original}_${ts}`;
  return `${original.slice(0, dot)}_${ts}${original.slice(dot)}`;
}

// ── Duplicate Resolution Dialog ───────────────────────────────
function DuplicateDialog({
  conflicts,
  onResolve,
}: {
  conflicts: DuplicateConflict[];
  onResolve: (resolved: DuplicateConflict[]) => void;
}) {
  const [items, setItems] = useState<DuplicateConflict[]>(conflicts);

  const update = (idx: number, patch: Partial<DuplicateConflict>) => {
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, ...patch } : it));
  };

  const allResolved = items.every(it =>
    it.resolution === 'skip' ||
    it.resolution === 'rename-auto' ||
    (it.resolution === 'rename-custom' && it.customName.trim().length > 0)
  );

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

        {/* Conflict list */}
        <div className="flex-1 overflow-y-auto max-h-[50vh] p-4 space-y-3">
          {items.map((item, idx) => (
            <div key={idx} className="bg-[#252526] border border-[#3c3c3c] rounded-lg p-3 space-y-2">
              <div className="flex items-center gap-2">
                <FileText className="w-3.5 h-3.5 text-[#f59e0b] shrink-0" />
                <span className="text-white text-[12px] font-medium truncate flex-1">{item.existingName}</span>
                <span className="text-[#f59e0b] text-[10px] font-bold bg-[#f59e0b]/10 px-1.5 py-0.5 rounded shrink-0">EXISTS</span>
              </div>

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

                {/* Option 3: Skip */}
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
          ))}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#3c3c3c] bg-[#252526] flex justify-end gap-2">
          <button
            onClick={() => onResolve(items.map(it => ({ ...it, resolution: 'skip' as DuplicateResolution })))}
            className="px-3 py-1.5 text-[12px] text-[#858585] hover:text-white transition-colors"
          >
            Skip All
          </button>
          <button
            onClick={() => onResolve(items.map(it => ({ ...it, resolution: (it.resolution === 'skip' ? 'skip' : 'rename-auto') as DuplicateResolution })))}
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
            Confirm & Upload
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Modal ────────────────────────────────────────────────
export function AnalysisConfigModal({ open, onClose, mode = 'import', targetFileId, targetFileIds }: AnalysisConfigModalProps) {
  const { state, setSelectedComponents, setComponentConfidence, analyzeFile, analyzeAll, analyzeSelected, refreshProjectFiles } = useApp();
  const [files, setFiles] = useState<File[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [uploadPhase, setUploadPhase] = useState<'idle' | 'uploading' | 'syncing'>('idle');
  const [uploadedCount, setUploadedCount] = useState(0);
  const [uploadTotal, setUploadTotal] = useState(0);
  const [uploadErrors, setUploadErrors] = useState<string[]>([]);
  const [duplicateConflicts, setDuplicateConflicts] = useState<DuplicateConflict[] | null>(null);
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
  const startUpload = async (filesToUpload: { file: File; uploadName: string }[]) => {
    if (uploadLockRef.current) return;
    uploadLockRef.current = true;
    setUploadPhase('uploading');
    setUploadedCount(0);
    setUploadTotal(filesToUpload.length);
    setUploadErrors([]);

    const { authFetch } = await import('../lib/supabase');
    const projectId = state.activeProject?.id;
    const errors: string[] = [];

    try {
      for (let i = 0; i < filesToUpload.length; i++) {
        const { file, uploadName } = filesToUpload[i];
        try {
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
            if (data.duplicate) {
              console.info(`[ImportModal] "${uploadName}" matches existing file in project (same content)`);
            }
            window.dispatchEvent(new CustomEvent('elementiq:file-uploaded', {
              detail: {
                id: data.id,
                name: uploadName,
                size: uploadFile.size,
                file: uploadFile,
                localPath: data.local_path,
                duplicate: !!data.duplicate,
              },
            }));
          } else {
            const errBody = await res.json().catch(() => ({ detail: `HTTP ${res.status}` }));
            const detail = typeof errBody?.detail === 'string'
              ? errBody.detail
              : `HTTP ${res.status}`;
            errors.push(`${uploadName}: ${detail}`);
            console.error(`[ImportModal] Upload failed for "${uploadName}": ${res.status}`, errBody);
          }
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
      await refreshProjectFiles({ silent: true });
    } finally {
      uploadLockRef.current = false;
      if (errors.length === 0) {
        setUploadPhase('idle');
        setFiles([]);
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
        uploadName: c.resolution === 'rename-custom' && c.customName.trim()
          ? c.customName.trim()
          : c.suggestedName,
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
      const conflicts: DuplicateConflict[] = files
        .filter(f => existingNames.has(f.name.toLowerCase()))
        .map(f => ({
          file: f,
          existingName: f.name,
          suggestedName: buildSuggestedName(f.name),
          resolution: 'rename-auto' as DuplicateResolution,
          customName: buildSuggestedName(f.name),
        }));

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

  return (
    <>
      {/* Duplicate resolution dialog — rendered on top of the import modal */}
      {duplicateConflicts && (
        <DuplicateDialog conflicts={duplicateConflicts} onResolve={handleDuplicateResolved} />
      )}

      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm shadow-2xl">
        <div className="bg-[#252526] border border-[#3c3c3c] rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
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
                      onToggle={(id) => {
                        const isSelected = state.selectedComponents.includes(id);
                        const newSelection = isSelected
                          ? state.selectedComponents.filter(c => c !== id)
                          : [...state.selectedComponents, id];
                        setSelectedComponents(newSelection);
                      }}
                      onConfidenceChange={setComponentConfidence}
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
                      <h3 className="text-sm font-bold text-white uppercase tracking-wider">Files ({files.length}/100)</h3>
                      {files.length > 0 && !isBusy && (
                        <button onClick={() => setFiles([])} className="text-xs text-[#ef4444] hover:underline">Clear All</button>
                      )}
                    </div>
                    {files.length === 0 ? (
                      <div className="h-[200px] flex items-center justify-center border border-[#3c3c3c] rounded-lg bg-[#1e1e1e]">
                        <p className="text-[#858585] text-xs">No files selected</p>
                      </div>
                    ) : (
                      <div className="overflow-y-auto space-y-1 max-h-[300px]">
                        {files.map((file, index) => (
                          <div key={index} className="flex items-center justify-between bg-[#1e1e1e] border border-[#3c3c3c] rounded px-2 py-1.5 text-[12px]">
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              {isBusy ? (
                                index < uploadedCount || uploadPhase === 'syncing' ? (
                                  <svg className="w-3.5 h-3.5 text-[#22c55e] shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/></svg>
                                ) : index === uploadedCount && uploadPhase === 'uploading' ? (
                                  <div className="w-3.5 h-3.5 border-2 border-[#3b82f6] border-t-transparent rounded-full animate-spin shrink-0" />
                                ) : (
                                  <FileText className="w-3.5 h-3.5 text-[#858585] shrink-0" />
                                )
                              ) : (
                                <FileText className={cn('w-3.5 h-3.5 shrink-0', state.files.some(f => f.name.toLowerCase() === file.name.toLowerCase()) ? 'text-[#f59e0b]' : 'text-[#10b981]')} />
                              )}
                              <span className={cn('truncate', isBusy && index < uploadedCount ? 'text-[#858585]' : 'text-white')}>{file.name}</span>
                              {!isBusy && state.files.some(f => f.name.toLowerCase() === file.name.toLowerCase()) && (
                                <span className="text-[9px] text-[#f59e0b] bg-[#f59e0b]/10 px-1 py-0.5 rounded shrink-0">duplicate</span>
                              )}
                              <span className="text-[10px] text-[#858585] shrink-0 ml-1">{(file.size / 1024 / 1024).toFixed(1)}MB</span>
                            </div>
                            {!isBusy && (
                              <button onClick={() => removeFile(index)} className="p-0.5 hover:bg-[#3c3c3c] rounded text-[#ef4444] shrink-0 ml-1">
                                <X className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        ))}
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
                      <span className="text-[#3b82f6]">Uploading <span className="text-white font-semibold">{uploadedCount}/{uploadTotal || files.length}</span> file(s) • {(files.reduce((a, f) => a + f.size, 0) / 1024 / 1024).toFixed(1)} MB</span>
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
                    : `${uploadedCount}/${uploadTotal || files.length}`
                  : mode === 'import'
                    ? 'Import Files'
                    : 'Start Analysis'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
