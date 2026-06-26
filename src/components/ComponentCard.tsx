import React, { useEffect, useState } from 'react';
import { Component, ComponentModelOption } from '../types';
import { cn } from '../lib/utils';
import { CheckCircle, AlertCircle, Clock } from 'lucide-react';
import { authFetch } from '../lib/supabase';
import { readModelLabDefaults, writeModelLabDefault } from '../lib/modelLabDefaults';
import { ModelVerdictBadge } from './model-lab/ModelVerdictBadge';
import { ModelWeightsPicker } from './ModelWeightsPicker';
import { Spinner } from './LoadingScreen';

interface ComponentCardProps {
  key?: React.Key;
  component: Component;
  selected: boolean;
  confidence: number;
  selectedModel?: string;
  onToggle: (id: string) => void;
  onConfidenceChange: (id: string, confidence: number) => void;
  onModelChange: (id: string, modelFile: string) => void;
  /** Checkbox disabled but may still show selected (e.g. layout bundled with grout). */
  toggleDisabled?: boolean;
  bundledBadge?: string;
  pipelineNote?: string;
}

export function ComponentCard({
  component,
  selected,
  confidence,
  selectedModel,
  onToggle,
  onConfidenceChange,
  onModelChange,
  toggleDisabled = false,
  bundledBadge,
  pipelineNote,
}: ComponentCardProps) {
  const isDisabled = component.status !== 'ready';
  const checkboxDisabled = isDisabled || toggleDisabled;
  const [models, setModels] = useState<ComponentModelOption[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);

  useEffect(() => {
    if (component.status !== 'ready') {
      setModels([]);
      return;
    }
    let cancelled = false;
    setModelsLoading(true);
    (async () => {
      try {
        const res = await authFetch(`/api/v1/components/${component.id}/models`);
        if (!res.ok || cancelled) return;
        const data = await res.json();
        const list: ComponentModelOption[] = (data.models || []).map((m: {
          filename: string;
          size_mb: number;
          is_default: boolean;
          modified_at?: string;
          verdict_label?: string | null;
          verdict_rank?: number | null;
          map50_95?: number | null;
        }) => ({
          filename: m.filename,
          sizeMb: m.size_mb,
          isDefault: m.is_default,
          modifiedAt: m.modified_at,
          verdictLabel: m.verdict_label as ComponentModelOption['verdictLabel'],
          verdictRank: m.verdict_rank,
          map50_95: m.map50_95,
        }));
        if (!cancelled) setModels(list);
      } catch {
        if (!cancelled) setModels([]);
      } finally {
        if (!cancelled) setModelsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [component.id, component.status]);

  useEffect(() => {
    if (modelsLoading || models.length === 0 || selectedModel) return;
    const userDefault = readModelLabDefaults()[component.id];
    const serverDefault = models.find((m) => m.isDefault)?.filename;
    const pick =
      userDefault && models.some((m) => m.filename === userDefault)
        ? userDefault
        : serverDefault || models[0]?.filename;
    if (pick) onModelChange(component.id, pick);
  }, [modelsLoading, models, selectedModel, component.id, onModelChange]);

  const activeModel =
    selectedModel ||
    readModelLabDefaults()[component.id] ||
    component.modelFile ||
    models.find((m) => m.isDefault)?.filename ||
    models[0]?.filename ||
    '';

  const activeModelMeta = models.find((m) => m.filename === activeModel);

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
      <div className="flex items-start justify-between mb-3">
        <label className={cn(
          'flex items-center gap-3 flex-1',
          !checkboxDisabled && 'cursor-pointer'
        )}>
          <input
            type="checkbox"
            checked={selected}
            onChange={() => !checkboxDisabled && onToggle(component.id)}
            disabled={checkboxDisabled}
            className="w-5 h-5"
          />
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="text-white font-semibold text-[14px]">{component.name}</h4>
              {bundledBadge && (
                <span className="text-[10px] font-bold uppercase tracking-wide text-[#3b82f6] border border-[#3b82f6]/40 bg-[#3b82f6]/10 px-1.5 py-0.5 rounded">
                  {bundledBadge}
                </span>
              )}
            </div>
            <p className="text-[#858585] text-xs mt-0.5">{component.description}</p>
            {pipelineNote && (
              <p className="text-[#6b9bd1] text-[10px] mt-1 leading-snug">{pipelineNote}</p>
            )}
          </div>
        </label>

        <span className={cn('px-2 py-1 rounded text-xs font-bold flex items-center gap-1.5 shrink-0', status.color, status.textColor)}>
          {status.icon} {status.label}
        </span>
      </div>

      <div className="text-xs text-[#858585] space-y-1 mb-3">
        {component.status === 'ready' && models.length > 0 ? (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <label className="text-[#858585] font-semibold" htmlFor={`model-${component.id}`}>
                Model weights
              </label>
              {activeModelMeta?.verdictLabel && (
                <ModelVerdictBadge label={activeModelMeta.verdictLabel} />
              )}
            </div>
            <ModelWeightsPicker
              id={`model-${component.id}`}
              models={models}
              value={activeModel}
              disabled={modelsLoading || !activeModel}
              onChange={(value) => {
                writeModelLabDefault(component.id, value);
                onModelChange(component.id, value);
              }}
            />
            {activeModelMeta?.map50_95 != null && (
              <p className="text-[10px] text-[#737373]">
                Val mAP50-95: {(activeModelMeta.map50_95 * 100).toFixed(1)}%
                {activeModelMeta.verdictRank != null ? ` · rank #${activeModelMeta.verdictRank}` : ''}
              </p>
            )}
          </div>
        ) : modelsLoading ? (
          <div
            className="rounded-md border border-[#10b981]/35 bg-[#10b981]/10 px-3 py-2.5"
            role="status"
            aria-live="polite"
            aria-busy="true"
          >
            <div className="flex items-center gap-2.5">
              <Spinner size="sm" />
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-semibold text-[#10b981] tracking-wide">
                  Loading model weights…
                </p>
                <p className="text-[10px] text-[#737373] mt-0.5">Fetching from server</p>
                <div className="mt-2 h-1 w-full rounded-full bg-[#2a2a2a] overflow-hidden">
                  <div className="h-full w-1/3 rounded-full bg-[#10b981]/75 project-loading-bar" />
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span>Model:</span>
            <span className="text-white font-mono truncate" title={activeModel}>
              {activeModel || component.modelFile || '—'}
            </span>
          </div>
        )}
        <div className="flex items-center gap-3">
          {component.accuracy != null && !isNaN(component.accuracy) && (
            <span>
              <span>Accuracy:</span>{' '}
              <span className="text-[#22c55e] font-semibold">{(component.accuracy * 100).toFixed(0)}%</span>
            </span>
          )}
          <span>
            <span>Classes:</span> <span className="text-white">{component.classes.join(', ')}</span>
          </span>
        </div>
      </div>

      {component.status === 'ready' && (
        <div className="pt-3 border-t border-[#3c3c3c]">
          <div className="flex justify-between items-center mb-2">
            <label
              className="text-xs text-[#858585] font-semibold"
              htmlFor={`confidence-${component.id}`}
            >
              Confidence Threshold
            </label>
            <span className="text-xs font-mono text-white bg-[#3c3c3c] px-2 py-0.5 rounded">
              {confidence.toFixed(2)}
            </span>
          </div>
          <input
            id={`confidence-${component.id}`}
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={confidence}
            onChange={(e) => onConfidenceChange(component.id, parseFloat(e.target.value))}
            className="w-full h-3 bg-[#3c3c3c] rounded-lg appearance-none cursor-pointer accent-[#10b981] [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#10b981] [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:cursor-pointer"
          />
          <div className="flex justify-between text-[10px] text-[#858585] mt-1">
            <span>↑ More detections</span>
            <span>Fewer, precise ↑</span>
          </div>
          <p className="text-[10px] text-[#525252] mt-1">
            Your setting · saved in this browser · not tied to model badge
          </p>
        </div>
      )}

      {component.status === 'training' && component.trainingProgress !== undefined && (
        <div className="pt-3 border-t border-[#3c3c3c]">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs text-[#f59e0b] font-semibold">Training in progress</span>
            <span className="text-xs font-mono text-[#f59e0b]">{(component.trainingProgress * 100).toFixed(0)}%</span>
          </div>
          <div className="h-2 bg-[#1e1e1e] rounded-full overflow-hidden border border-[#3c3c3c]">
            <div className="h-full bg-[#f59e0b] transition-all duration-300" style={{ width: `${component.trainingProgress * 100}%` }} />
          </div>
          <p className="text-[10px] text-[#858585] mt-2">ETA: ~{Math.ceil((1 - component.trainingProgress) * 40)} minutes</p>
        </div>
      )}

      {component.status === 'missing' && (
        <div className="pt-3 border-t border-[#3c3c3c] flex gap-2">
          <button className="text-xs px-3 py-1.5 bg-[#10b981] hover:bg-[#059669] text-white rounded transition-colors font-semibold">Train Model</button>
          <button className="text-xs px-3 py-1.5 border border-[#3c3c3c] text-[#858585] hover:text-white hover:border-[#858585] rounded transition-colors">Learn More</button>
        </div>
      )}
    </div>
  );
}
