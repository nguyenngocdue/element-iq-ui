import React from 'react';
import { Component } from '../types';
import { cn } from '../lib/utils';
import { CheckCircle, AlertCircle, Clock } from 'lucide-react';

interface ComponentCardProps {
  component: Component;
  selected: boolean;
  confidence: number;
  onToggle: (id: string) => void;
  onConfidenceChange: (id: string, confidence: number) => void;
}

export function ComponentCard({
  component,
  selected,
  confidence,
  onToggle,
  onConfidenceChange,
}: ComponentCardProps) {
  const isDisabled = component.status !== 'ready';

  const statusConfig = {
    ready: {
      color: 'border-[#22c55e] bg-[#22c55e]/10',
      textColor: 'text-[#22c55e]',
      icon: <CheckCircle className="w-4 h-4" />,
      label: 'Ready',
    },
    training: {
      color: 'border-[#f59e0b] bg-[#f59e0b]/10',
      textColor: 'text-[#f59e0b]',
      icon: <Clock className="w-4 h-4 animate-pulse" />,
      label: 'Training',
    },
    missing: {
      color: 'border-[#ef4444] bg-[#ef4444]/10',
      textColor: 'text-[#ef4444]',
      icon: <AlertCircle className="w-4 h-4" />,
      label: 'Not Ready',
    },
  };

  const status = statusConfig[component.status];

  return (
    <div
      className={cn(
        'border-2 rounded-lg p-4 transition-all',
        selected && !isDisabled ? status.color : 'border-[#3c3c3c] bg-[#1e1e1e]',
        isDisabled && 'opacity-60 cursor-not-allowed'
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <label className={cn(
          'flex items-center gap-3 flex-1',
          !isDisabled && 'cursor-pointer'
        )}>
          <input
            type="checkbox"
            checked={selected}
            onChange={() => !isDisabled && onToggle(component.id)}
            disabled={isDisabled}
            className="w-5 h-5 rounded border-[#3c3c3c] bg-[#1e1e1e] checked:bg-[#007acc] focus:ring-2 focus:ring-[#007acc] disabled:opacity-50"
          />
          <div>
            <h4 className="text-white font-semibold text-[14px]">
              {component.name}
            </h4>
            <p className="text-[#858585] text-xs mt-0.5">{component.description}</p>
          </div>
        </label>
        
        <span className={cn(
          'px-2 py-1 rounded text-xs font-bold flex items-center gap-1.5 shrink-0',
          status.color,
          status.textColor
        )}>
          {status.icon}
          {status.label}
        </span>
      </div>

      {/* Model Info */}
      <div className="text-xs text-[#858585] space-y-1 mb-3">
        <div className="flex items-center gap-2">
          <span className="text-[#858585]">Model:</span>
          <span className="text-white font-mono">{component.modelFile}</span>
        </div>
        <div className="flex items-center gap-3">
          {component.accuracy !== null && (
            <span>
              <span className="text-[#858585]">Accuracy:</span>{' '}
              <span className="text-[#22c55e] font-semibold">
                {(component.accuracy * 100).toFixed(0)}%
              </span>
            </span>
          )}
          <span>
            <span className="text-[#858585]">Classes:</span>{' '}
            <span className="text-white">{component.classes.join(', ')}</span>
          </span>
        </div>
      </div>

      {/* Confidence Slider (only for selected & ready) */}
      {selected && component.status === 'ready' && (
        <div className="pt-3 border-t border-[#3c3c3c]">
          <div className="flex justify-between items-center mb-2">
            <label className="text-xs text-[#858585] font-semibold">
              Confidence Threshold
            </label>
            <span className="text-xs font-mono text-white bg-[#3c3c3c] px-2 py-0.5 rounded">
              {confidence.toFixed(2)}
            </span>
          </div>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={confidence}
            onChange={(e) => onConfidenceChange(component.id, parseFloat(e.target.value))}
            className="w-full h-2 bg-[#3c3c3c] rounded-lg appearance-none cursor-pointer accent-[#007acc]"
          />
          <div className="flex justify-between text-[10px] text-[#858585] mt-1">
            <span>↑ More detections</span>
            <span>Fewer, precise ↑</span>
          </div>
        </div>
      )}

      {/* Training Progress */}
      {component.status === 'training' && component.trainingProgress !== undefined && (
        <div className="pt-3 border-t border-[#3c3c3c]">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs text-[#f59e0b] font-semibold">
              Training in progress
            </span>
            <span className="text-xs font-mono text-[#f59e0b]">
              {(component.trainingProgress * 100).toFixed(0)}%
            </span>
          </div>
          <div className="h-2 bg-[#1e1e1e] rounded-full overflow-hidden border border-[#3c3c3c]">
            <div
              className="h-full bg-[#f59e0b] transition-all duration-300"
              style={{ width: `${component.trainingProgress * 100}%` }}
            />
          </div>
          <p className="text-[10px] text-[#858585] mt-2">
            ETA: ~{Math.ceil((1 - component.trainingProgress) * 40)} minutes
          </p>
        </div>
      )}

      {/* Missing Model Actions */}
      {component.status === 'missing' && (
        <div className="pt-3 border-t border-[#3c3c3c] flex gap-2">
          <button className="text-xs px-3 py-1.5 bg-[#007acc] hover:bg-[#0062a3] text-white rounded transition-colors font-semibold">
            Train Model
          </button>
          <button className="text-xs px-3 py-1.5 border border-[#3c3c3c] text-[#858585] hover:text-white hover:border-[#858585] rounded transition-colors">
            Learn More
          </button>
        </div>
      )}
    </div>
  );
}
