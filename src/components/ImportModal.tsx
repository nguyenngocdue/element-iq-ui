import React, { useState } from 'react';
import { useApp } from '../store';
import { ComponentCard } from './ComponentCard';
import { X, Upload, FileText, RefreshCw } from 'lucide-react';
import { cn } from '../lib/utils';

export interface AnalysisConfigModalProps {
  open: boolean;
  onClose: () => void;
  mode?: 'import' | 'reanalyze';
  targetFileId?: string;
  targetFileIds?: string[];
}

export function AnalysisConfigModal({ open, onClose, mode = 'import', targetFileId, targetFileIds }: AnalysisConfigModalProps) {
  const { state, setSelectedComponents, setComponentConfidence, addFiles, analyzeFile, analyzeAll, analyzeSelected } = useApp();
  const [files, setFiles] = useState<File[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadedCount, setUploadedCount] = useState(0);

  // Warn browser if upload in progress
  React.useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (uploading) {
        e.preventDefault();
        e.returnValue = 'File upload is in progress. Leaving will cancel remaining uploads.';
        return e.returnValue;
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [uploading]);

  if (!open) return null;

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
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
      const selectedFiles = Array.from(e.target.files);
      setFiles(prev => [...prev, ...selectedFiles].slice(0, 100));
    }
  };

  const handleAnalyze = async () => {
    if (mode === 'import') {
      if (files.length === 0) return;
      setUploading(true);
      setUploadedCount(0);

      const { authFetch } = await import('../lib/supabase');
      const projectId = state.activeProject?.id;

      // Upload files sequentially — modal stays open showing progress
      for (let i = 0; i < files.length; i++) {
        setUploadedCount(i + 1);
        const file = files[i];
        try {
          const formData = new FormData();
          formData.append('file', file, file.name || 'drawing.pdf');
          if (projectId) formData.append('project_id', projectId);
          const res = await authFetch('/api/v1/files', { method: 'POST', body: formData });
          if (res.ok) {
            const data = await res.json();
            // Dispatch event so sidebar shows file immediately
            window.dispatchEvent(new CustomEvent('elementiq:file-uploaded', {
              detail: { id: data.id, name: file.name, size: file.size, file, localPath: data.local_path }
            }));
          }
        } catch (err) {
          console.error(`Upload error: ${file.name}`, err);
        }
      }

      // All done — reload project files from server (no page reload needed)
      setUploading(false);
      setFiles([]);
      setUploadedCount(0);
      onClose();
      // Trigger reload of project files in store
      window.dispatchEvent(new CustomEvent('elementiq:reload-files'));
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

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const selectedCount = state.selectedComponents.length;
  const readyComponents = state.availableComponents.filter(c => c.status === 'ready');
  const canAnalyze = mode === 'import' ? files.length > 0 : (selectedCount > 0);
  const targetFileCount = targetFileIds?.length
    ?? (targetFileId ? 1 : state.files.length);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm shadow-2xl">
      <div className="bg-[#252526] border border-[#3c3c3c] rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-[#3c3c3c] bg-[#1e1e1e]">
          <h2 className="text-xl font-bold text-white uppercase tracking-wider">{mode === 'import' ? 'Import Drawings' : 'Analysis Configuration'}</h2>
          <button onClick={onClose} className="p-1 hover:bg-[#3c3c3c] rounded transition-colors text-[#858585] hover:text-white">
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
                      const newSelection = isSelected ? state.selectedComponents.filter(c => c !== id) : [...state.selectedComponents, id];
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
                    {files.length > 0 && !uploading && <button onClick={() => setFiles([])} className="text-xs text-[#ef4444] hover:underline">Clear All</button>}
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
                            {uploading ? (
                              index < uploadedCount ? (
                                <svg className="w-3.5 h-3.5 text-[#22c55e] shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/></svg>
                              ) : index === uploadedCount ? (
                                <div className="w-3.5 h-3.5 border-2 border-[#3b82f6] border-t-transparent rounded-full animate-spin shrink-0" />
                              ) : (
                                <FileText className="w-3.5 h-3.5 text-[#858585] shrink-0" />
                              )
                            ) : (
                              <FileText className="w-3.5 h-3.5 text-[#10b981] shrink-0" />
                            )}
                            <span className={cn("truncate", uploading && index < uploadedCount ? "text-[#858585]" : "text-white")}>{file.name}</span>
                            <span className="text-[10px] text-[#858585] shrink-0 ml-1">{(file.size / 1024 / 1024).toFixed(1)}MB</span>
                          </div>
                          {!uploading && (
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

        <div className="flex items-center justify-between p-5 border-t border-[#3c3c3c] bg-[#1e1e1e]">
          <div className="text-sm text-[#858585]">
            {canAnalyze ? (
              mode === 'import' ? (
                uploading ? (
                  <span className="text-[#3b82f6]">Uploading <span className="text-white font-semibold">{uploadedCount}/{files.length}</span> file(s) • {(files.reduce((a, f) => a + f.size, 0) / 1024 / 1024).toFixed(1)} MB</span>
                ) : (
                  <span>Ready to import <span className="text-white font-semibold">{files.length}</span> file(s) • {(files.reduce((a, f) => a + f.size, 0) / 1024 / 1024).toFixed(1)} MB total</span>
                )
              ) : (
                <span>Ready to analyze <span className="text-white font-semibold">{targetFileCount}</span> file(s) with <span className="text-white font-semibold">{selectedCount}</span> component(s)</span>
              )
            ) : (
              <span>{mode === 'import' ? 'Select files' : 'Select components '}to continue</span>
            )}
          </div>
          <div className="flex gap-3">
            <button onClick={onClose} className="px-4 py-2 text-sm font-semibold text-[#858585] hover:text-white transition-colors">Cancel</button>
            <button onClick={handleAnalyze} disabled={!canAnalyze || uploading} className={cn('px-6 py-2 text-sm font-semibold flex items-center gap-2 rounded transition-colors shadow-lg', canAnalyze && !uploading ? 'bg-[#10b981] hover:bg-[#059669] text-white shadow-[#10b981]/20' : 'bg-[#3c3c3c] text-[#858585] cursor-not-allowed')}>
              {uploading && <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
              {mode !== 'import' && <RefreshCw className="w-4 h-4" />}
              {uploading ? `${uploadedCount}/${files.length}` : mode === 'import' ? 'Import Files' : 'Start Analysis'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
