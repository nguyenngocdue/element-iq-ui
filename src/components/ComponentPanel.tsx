import React, { useState } from 'react';
import { useApp } from '../store';
import { Settings, RefreshCw } from 'lucide-react';
import { cn } from '../lib/utils';
import { ImportModal } from './ImportModal';

export function ComponentPanel() {
  const { state, toggleComponent } = useApp();
  const [showModal, setShowModal] = useState(false);

  const handleReanalyze = () => {
    // Re-analyze all files with selected components
    state.files.forEach(file => {
      // Trigger re-analysis
      console.log('Re-analyzing', file.name, 'with components:', state.selectedComponents);
    });
  };

  return (
    <>
      <div className="p-4 border-b border-[#2b2d35] bg-[#1a1b20]">
        <div className="flex justify-between items-center mb-3">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#858585]">
            Active Components
          </span>
          <button
            onClick={() => setShowModal(true)}
            className="text-[#007acc] hover:text-[#0062a3] transition-colors"
            title="Configure components"
          >
            <Settings className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="space-y-2 mb-3">
          {state.availableComponents.map(comp => {
            const isSelected = state.selectedComponents.includes(comp.id);
            const isDisabled = comp.status !== 'ready';

            return (
              <label
                key={comp.id}
                className={cn(
                  'flex items-center justify-between p-2 rounded transition-colors',
                  !isDisabled && 'cursor-pointer hover:bg-[#25272e]',
                  isDisabled && 'opacity-50 cursor-not-allowed'
                )}
              >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => !isDisabled && toggleComponent(comp.id)}
                    disabled={isDisabled}
                    className="w-4 h-4 rounded border-[#3c3c3c] bg-[#1e1e1e] checked:bg-[#007acc] focus:ring-2 focus:ring-[#007acc] disabled:opacity-50"
                  />
                  <span className="text-[13px] text-white truncate">{comp.name}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {comp.accuracy !== null && (
                    <span className="text-[10px] text-[#858585] font-mono">
                      [{(comp.accuracy * 100).toFixed(0)}%]
                    </span>
                  )}
                  <span className="text-xs">
                    {comp.status === 'ready' && <span className="text-[#22c55e]">✓</span>}
                    {comp.status === 'training' && <span className="text-[#f59e0b]">⏳</span>}
                    {comp.status === 'missing' && <span className="text-[#ef4444]">⚠</span>}
                  </span>
                </div>
              </label>
            );
          })}
        </div>

        <div className="text-[11px] text-[#858585] mb-3 flex items-center justify-between">
          <span>{state.selectedComponents.length} component(s) selected</span>
          {state.selectedComponents.length > 0 && (
            <span className="text-[#007acc]">
              {state.selectedComponents.map(id => 
                state.availableComponents.find(c => c.id === id)?.name
              ).join(', ')}
            </span>
          )}
        </div>

        <button
          onClick={handleReanalyze}
          disabled={state.selectedComponents.length === 0 || state.files.length === 0}
          className={cn(
            'w-full py-2 rounded text-[12px] font-semibold transition-colors flex items-center justify-center gap-2',
            state.selectedComponents.length > 0 && state.files.length > 0
              ? 'bg-[#007acc] hover:bg-[#0062a3] text-white'
              : 'bg-[#3c3c3c] text-[#858585] cursor-not-allowed'
          )}
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Re-analyze All
        </button>
      </div>

      <ImportModal open={showModal} onClose={() => setShowModal(false)} />
    </>
  );
}
