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
}

export function AnalysisConfigModal({ open, onClose, mode = 'import', targetFileId }: AnalysisConfigModalProps) {
  const { state, setSelectedComponents, setComponentConfidence, addFiles, analyzeFile } = useApp();
  const [files, setFiles] = useState<File[]>([]);
  const [dragActive, setDragActive] = useState(false);

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
    setFiles(prev => [...prev, ...droppedFiles].slice(0, 20));
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && mode === 'import') {
      const selectedFiles = Array.from(e.target.files);
      setFiles(prev => [...prev, ...selectedFiles].slice(0, 20));
    }
  };

  const handleAnalyze = () => {
    if (mode === 'import') {
      if (files.length > 0) {
        addFiles(files);
        // addFiles handles setting active file, but doesn't auto-analyze.
        // Actually we might want to auto-analyze if they import from this modal?
        // Let's just do what we did before.
        onClose();
        setFiles([]);
      }
    } else {
      if (state.selectedComponents.length > 0) {
        if (targetFileId) {
          analyzeFile(targetFileId);
        } else {
          state.files.forEach(f => analyzeFile(f.id));
        }
        onClose();
      }
    }
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const selectedCount = state.selectedComponents.length;
  const readyComponents = state.availableComponents.filter(c => c.status === 'ready');
  const canAnalyze = mode === 'import' ? files.length > 0 : (selectedCount > 0);

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
              <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-4">Upload PDF Files</h3>
              <div
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                className={cn('border-2 border-dashed rounded-lg p-12 text-center transition-all', dragActive ? 'border-[#10b981] bg-[#10b981]/10' : 'border-[#3c3c3c] bg-[#1e1e1e] hover:border-[#858585]')}
              >
                <Upload className={cn('w-12 h-12 mx-auto mb-4', dragActive ? 'text-[#10b981]' : 'text-[#858585]')} />
                <p className="text-white font-semibold mb-2">{dragActive ? 'Drop files here' : 'Drag & drop PDF files here'}</p>
                <p className="text-[#858585] text-sm mb-4">or</p>
                <label className="inline-block bg-[#10b981] hover:bg-[#059669] text-white px-6 py-2 rounded cursor-pointer transition-colors font-semibold shadow-lg">
                  Browse Files
                  <input type="file" multiple accept=".pdf" onChange={handleFileInput} className="hidden" />
                </label>
                <p className="text-[#858585] text-xs mt-4">Maximum 20 files, 50MB each</p>
              </div>

              {files.length > 0 && (
                <div className="mt-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#858585] uppercase">Selected Files ({files.length}/20)</span>
                    <button onClick={() => setFiles([])} className="text-xs text-[#ef4444] hover:underline">Clear All</button>
                  </div>
                  <div className="max-h-40 overflow-y-auto space-y-1">
                    {files.map((file, index) => (
                      <div key={index} className="flex items-center justify-between bg-[#1e1e1e] border border-[#3c3c3c] rounded p-2 hover:bg-[#25272e] transition-colors">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <FileText className="w-4 h-4 text-[#10b981] shrink-0" />
                          <span className="text-sm text-white truncate">{file.name}</span>
                          <span className="text-xs text-[#858585] shrink-0">{(file.size / 1024 / 1024).toFixed(2)} MB</span>
                        </div>
                        <button onClick={() => removeFile(index)} className="p-1 hover:bg-[#3c3c3c] rounded transition-colors text-[#ef4444] hover:bg-[#ef4444]/10 shrink-0">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>
          )}
        </div>

        <div className="flex items-center justify-between p-5 border-t border-[#3c3c3c] bg-[#1e1e1e]">
          <div className="text-sm text-[#858585]">
            {canAnalyze ? (
              mode === 'import' ? (
                <span>Ready to import <span className="text-white font-semibold">{files.length}</span> file(s)</span>
              ) : (
                <span>Ready to analyze {targetFileId ? '1' : state.files.length} file(s) with <span className="text-white font-semibold">{selectedCount}</span> component(s)</span>
              )
            ) : (
              <span>{mode === 'import' ? 'Select files' : 'Select components '}to continue</span>
            )}
          </div>
          <div className="flex gap-3">
            <button onClick={onClose} className="px-4 py-2 text-sm font-semibold text-[#858585] hover:text-white transition-colors">Cancel</button>
            <button onClick={handleAnalyze} disabled={!canAnalyze} className={cn('px-6 py-2 text-sm font-semibold flex items-center gap-2 rounded transition-colors shadow-lg', canAnalyze ? 'bg-[#10b981] hover:bg-[#059669] text-white shadow-[#10b981]/20' : 'bg-[#3c3c3c] text-[#858585] cursor-not-allowed')}>
              {mode !== 'import' && <RefreshCw className="w-4 h-4" />}
              {mode === 'import' ? 'Import Files' : 'Start Analysis'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
