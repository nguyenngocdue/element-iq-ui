import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Beaker,
  Check,
  LayoutGrid,
  LayoutList,
  Pin,
  RefreshCw,
  Shield,
  Star,
  ThumbsDown,
  ThumbsUp,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useAdminProfile } from '../hooks/useAdminProfile';
import { ELEMENTIQ_ENGINE } from '../lib/engineBranding';
import { WorkspaceSidebar } from './WorkspaceSidebar';
import { UserProfileMenu } from './UserProfileMenu';
import { PanelLoading } from './LoadingScreen';
import {
  fetchModelAnalysis,
  type ModelAnalysisEntry,
  type ModelAnalysisGroup,
  type ModelAnalysisReport,
} from '../lib/modelLabApi';
import { AdminKpiCard } from './admin/AdminShared';
import {
  clearModelLabDefault,
  readModelLabDefaults,
  writeModelLabDefault,
  type ModelLabDefaultsMap,
} from '../lib/modelLabDefaults';
import { ModelCompareBars, ModelMetricRadar, TrainingCurveChart } from './model-lab/ModelLabCharts';
import { ModelVerdictBadge } from './model-lab/ModelVerdictBadge';

type ModelDetailsLayout = 'list' | 'panels';

const MODEL_LAB_LAYOUT_KEY = 'elementiq:model-lab-details-layout';

function readModelLabLayout(): ModelDetailsLayout {
  try {
    const v = localStorage.getItem(MODEL_LAB_LAYOUT_KEY);
    if (v === 'panels' || v === 'list') return v;
  } catch {
    // ignore private mode / quota
  }
  return 'list';
}

function writeModelLabLayout(layout: ModelDetailsLayout): void {
  try {
    localStorage.setItem(MODEL_LAB_LAYOUT_KEY, layout);
  } catch {
    // ignore
  }
}

function LayoutToggle({
  layout,
  onChange,
}: {
  layout: ModelDetailsLayout;
  onChange: (layout: ModelDetailsLayout) => void;
}) {
  const btn = (mode: ModelDetailsLayout, label: string, Icon: typeof LayoutList) => (
    <button
      type="button"
      onClick={() => onChange(mode)}
      title={mode === 'list' ? 'Accordion list — expand rows one by one' : 'Panel grid — all models visible'}
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] transition-colors border',
        layout === mode
          ? 'bg-[#2563eb] border-[#2563eb] text-white'
          : 'bg-transparent border-[#404040] text-[#b0b0b0] hover:text-white hover:border-[#525252]',
      )}
    >
      <Icon className="w-3.5 h-3.5" />
      {label}
    </button>
  );

  return (
    <div className="inline-flex items-center gap-1">
      {btn('list', 'List', LayoutList)}
      {btn('panels', 'Panels', LayoutGrid)}
    </div>
  );
}

function ReasonText({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <span>
      {parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return (
            <strong key={i} className="text-white font-medium">
              {part.slice(2, -2)}
            </strong>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </span>
  );
}

function ModelCardTitleRow({
  model,
  userDefaultFilename,
}: {
  model: ModelAnalysisEntry;
  userDefaultFilename?: string | null;
}) {
  const v = model.verdict;
  const isUserDefault = !!userDefaultFilename && model.filename === userDefaultFilename;

  return (
    <>
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[13px] font-medium text-white truncate">{model.filename}</span>
        {isUserDefault && (
          <span className="text-[10px] uppercase text-[#93c5fd] border border-[#2563eb]/40 bg-[#2563eb]/10 px-1.5 py-0.5 rounded">
            Your default
          </span>
        )}
        {model.is_default && (
          <span className="text-[10px] uppercase text-[#fbbf24] border border-[#f59e0b]/30 px-1.5 py-0.5 rounded">
            default.yaml
          </span>
        )}
        {v && <ModelVerdictBadge label={v.label} />}
        {v?.rank === 1 && (
          <Star className="w-3.5 h-3.5 text-[#fbbf24] fill-[#fbbf24]" aria-label="Top rank" />
        )}
      </div>
      <p className="text-[11px] text-[#737373] mt-1">
        {model.size_mb} MB · {model.params_m ?? '?'}M params
        {model.base_model ? ` · ${model.base_model}` : ''}
        {model.training
          ? ` · best epoch ${model.training.best_epoch} · mAP ${(model.training.map50_95 * 100).toFixed(1)}%`
          : ''}
      </p>
    </>
  );
}

function SetDefaultAction({
  groupId,
  filename,
  userDefaultFilename,
  serverDefaultFilename,
  onSetDefault,
  onClearDefault,
}: {
  groupId: string;
  filename: string;
  userDefaultFilename?: string | null;
  serverDefaultFilename?: string | null;
  onSetDefault: (groupId: string, filename: string) => void;
  onClearDefault: (groupId: string) => void;
}) {
  const isUserDefault = userDefaultFilename === filename;

  if (isUserDefault) {
    return (
      <div className="flex flex-wrap items-center gap-2 rounded border border-[#2563eb]/30 bg-[#2563eb]/10 px-3 py-2">
        <span className="inline-flex items-center gap-1.5 text-[12px] text-[#93c5fd]">
          <Check className="w-3.5 h-3.5" />
          Your default for this group (saved in this browser)
        </span>
        <button
          type="button"
          onClick={() => onClearDefault(groupId)}
          className="text-[11px] text-[#b0b0b0] hover:text-white underline underline-offset-2"
        >
          Reset to server default
          {serverDefaultFilename ? ` (${serverDefaultFilename})` : ''}
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onSetDefault(groupId, filename)}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded border border-[#404040] text-[11px] text-[#b0b0b0] hover:text-white hover:border-[#525252] hover:bg-[#1a1a1a] transition-colors"
    >
      <Pin className="w-3.5 h-3.5" />
      Set as default
    </button>
  );
}

function ModelCardHeader({
  model,
  selected,
  registerRef,
  onToggle,
  collapsible = true,
  userDefaultFilename,
  groupId,
  onSetDefault,
}: {
  model: ModelAnalysisEntry;
  selected: boolean;
  registerRef?: (el: HTMLDivElement | null) => void;
  onToggle: () => void;
  collapsible?: boolean;
  userDefaultFilename?: string | null;
  groupId?: string;
  onSetDefault?: (groupId: string, filename: string) => void;
}) {
  const v = model.verdict;
  const isUserDefault = !!userDefaultFilename && model.filename === userDefaultFilename;
  const shellClass = cn(
    'border rounded-lg overflow-hidden transition-colors',
    selected && collapsible && 'rounded-b-none border-b-0',
    isUserDefault
      ? 'border-[#2563eb]/50 bg-[#2563eb]/5'
      : v?.label === 'recommended'
        ? 'border-[#10b981]/40 bg-[#10b981]/5'
        : 'border-[#262626] bg-[#141414]',
  );

  if (!collapsible) {
    return (
      <div ref={registerRef} className={shellClass}>
        <div className="px-4 py-3">
          <ModelCardTitleRow model={model} userDefaultFilename={userDefaultFilename} />
        </div>
      </div>
    );
  }

  return (
    <div ref={registerRef} className={shellClass}>
      <button
        type="button"
        aria-expanded={selected}
        onClick={onToggle}
        className="w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-[#1a1a1a]/50"
      >
        <div className="flex-1 min-w-0">
          <ModelCardTitleRow model={model} userDefaultFilename={userDefaultFilename} />
        </div>
        {!isUserDefault && groupId && onSetDefault && (
          <button
            type="button"
            title="Set as your default for this group"
            onClick={(e) => {
              e.stopPropagation();
              onSetDefault(groupId, model.filename);
            }}
            className="shrink-0 p-1.5 rounded border border-[#404040] text-[#737373] hover:text-[#93c5fd] hover:border-[#2563eb]/50 transition-colors"
          >
            <Pin className="w-3.5 h-3.5" />
          </button>
        )}
        {isUserDefault && (
          <Check className="w-4 h-4 text-[#93c5fd] shrink-0" aria-label="Your default" />
        )}
        <span className="text-[11px] text-[#737373] shrink-0">{selected ? '▲' : '▼'}</span>
      </button>
    </div>
  );
}

function ModelCardDetails({
  model,
  variant = 'accordion',
  groupId,
  userDefaultFilename,
  serverDefaultFilename,
  onSetDefault,
  onClearDefault,
}: {
  model: ModelAnalysisEntry;
  variant?: 'accordion' | 'panel';
  groupId: string;
  userDefaultFilename?: string | null;
  serverDefaultFilename?: string | null;
  onSetDefault: (groupId: string, filename: string) => void;
  onClearDefault: (groupId: string) => void;
}) {
  const v = model.verdict;

  return (
    <div
      className={cn(
        'px-4 pb-4 space-y-4 overflow-hidden',
        variant === 'accordion'
          ? 'border border-[#262626] bg-[#141414] border-t-0 rounded-b-lg -mt-3 pt-6'
          : 'pt-4 flex-1',
      )}
    >
      <SetDefaultAction
        groupId={groupId}
        filename={model.filename}
        userDefaultFilename={userDefaultFilename}
        serverDefaultFilename={serverDefaultFilename}
        onSetDefault={onSetDefault}
        onClearDefault={onClearDefault}
      />

      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-[#34d399] mb-2">
            <ThumbsUp className="w-3 h-3" /> Strengths
          </div>
          <ul className="space-y-1.5 text-[12px] text-[#b0b0b0]">
            {(v?.reasons_good ?? []).length === 0 && (
              <li className="text-[#737373]">No positive signals</li>
            )}
            {v?.reasons_good.map((r, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-[#34d399] shrink-0">+</span>
                <ReasonText text={r} />
              </li>
            ))}
          </ul>
        </div>
        <div>
          <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-[#f87171] mb-2">
            <ThumbsDown className="w-3 h-3" /> Watch outs
          </div>
          <ul className="space-y-1.5 text-[12px] text-[#b0b0b0]">
            {(v?.reasons_bad ?? []).length === 0 && (
              <li className="text-[#737373]">No warnings</li>
            )}
            {v?.reasons_bad.map((r, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-[#f87171] shrink-0">−</span>
                <ReasonText text={r} />
              </li>
            ))}
          </ul>
        </div>
      </div>

      {model.classes.length > 0 && (
        <p className="text-[11px] text-[#737373]">
          Classes in weights: {model.classes.join(', ')}
          {(model.unexpected_classes?.length ?? 0) > 0 && (
            <span className="text-[#fbbf24]">
              {' '}
              · unexpected: {model.unexpected_classes!.join(', ')}
            </span>
          )}
        </p>
      )}

      {v?.score_breakdown && v.score_breakdown.length > 0 && (
        <div className="rounded border border-[#262626] bg-[#101010] px-3 py-2">
          <p className="text-[10px] uppercase tracking-wide text-[#737373] mb-1.5">
            Composite score {v.score} (tie-breaker — rank uses val mAP50-95)
          </p>
          <ul className="space-y-0.5 text-[11px] text-[#b0b0b0] tabular-nums">
            {v.score_breakdown.map((line) => (
              <li key={line.label} className="flex justify-between gap-4">
                <span>{line.label}</span>
                <span className={line.value < 0 ? 'text-[#f87171]' : 'text-[#ccc]'}>
                  {line.value >= 0 ? '+' : ''}
                  {line.value.toFixed(2)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {model.training && (
        <div className="relative overflow-hidden isolate">
          <p className="text-[11px] text-[#737373] mb-2 uppercase tracking-wide">
            Training curve · {model.training.run_name}
          </p>
          <p className="text-[10px] text-[#525252] mb-2 font-mono">
            Source: {model.training.metrics_source} · best epoch {model.training.best_epoch} by
            metrics/mAP50-95(B)
          </p>
          <TrainingCurveChart model={model} />
        </div>
      )}

      {model.error && (
        <p className="text-[12px] text-[#f87171]">Failed to read file: {model.error}</p>
      )}
    </div>
  );
}

function ModelPanelCard({
  model,
  groupId,
  userDefaultFilename,
  serverDefaultFilename,
  onSetDefault,
  onClearDefault,
}: {
  model: ModelAnalysisEntry;
  groupId: string;
  userDefaultFilename?: string | null;
  serverDefaultFilename?: string | null;
  onSetDefault: (groupId: string, filename: string) => void;
  onClearDefault: (groupId: string) => void;
}) {
  const v = model.verdict;
  const isUserDefault = !!userDefaultFilename && model.filename === userDefaultFilename;

  return (
    <div
      className={cn(
        'rounded-lg overflow-hidden flex flex-col h-full',
        isUserDefault
          ? 'border border-[#2563eb]/50 bg-[#2563eb]/5'
          : v?.label === 'recommended'
            ? 'border border-[#10b981]/40 bg-[#10b981]/5'
            : 'border border-[#262626] bg-[#141414]',
      )}
    >
      <div className="px-4 py-3 border-b border-[#262626]/80 shrink-0">
        <ModelCardTitleRow model={model} userDefaultFilename={userDefaultFilename} />
      </div>
      <ModelCardDetails
        model={model}
        variant="panel"
        groupId={groupId}
        userDefaultFilename={userDefaultFilename}
        serverDefaultFilename={serverDefaultFilename}
        onSetDefault={onSetDefault}
        onClearDefault={onClearDefault}
      />
    </div>
  );
}

function expandedModelReducer(
  state: Set<string>,
  action:
    | { type: 'toggle'; filename: string }
    | { type: 'reset' }
    | { type: 'expandAll'; filenames: string[] },
): Set<string> {
  if (action.type === 'reset') return new Set();
  if (action.type === 'expandAll') return new Set(action.filenames);
  const next = new Set(state);
  if (next.has(action.filename)) next.delete(action.filename);
  else next.add(action.filename);
  return next;
}

function GroupPanel({
  group,
  expandedModels,
  dispatchExpanded,
  detailsLayout,
  onDetailsLayoutChange,
  userDefaultFilename,
  serverDefaultFilename,
  onSetDefault,
  onClearDefault,
}: {
  group: ModelAnalysisGroup;
  expandedModels: Set<string>;
  dispatchExpanded: (
    action:
      | { type: 'toggle'; filename: string }
      | { type: 'reset' }
      | { type: 'expandAll'; filenames: string[] },
  ) => void;
  detailsLayout: ModelDetailsLayout;
  onDetailsLayoutChange: (layout: ModelDetailsLayout) => void;
  userDefaultFilename?: string | null;
  serverDefaultFilename?: string | null;
  onSetDefault: (groupId: string, filename: string) => void;
  onClearDefault: (groupId: string) => void;
}) {
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const recommended = group.models.find((m) => m.filename === group.recommended);
  const selectableFilenames = group.models.map((m) => m.filename);
  const expandedCount = selectableFilenames.filter((f) => expandedModels.has(f)).length;

  const toggleModel = (filename: string) => {
    const willExpand = !expandedModels.has(filename);
    dispatchExpanded({ type: 'toggle', filename });
    if (willExpand) {
      requestAnimationFrame(() => {
        cardRefs.current[filename]?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      });
    }
  };

  return (
    <div className="space-y-6">
      {userDefaultFilename && (
        <div className="bg-[#2563eb]/10 border border-[#2563eb]/30 rounded-lg px-4 py-3">
          <p className="text-[12px] text-[#93c5fd] font-medium">
            Your default for {group.label}:{' '}
            <span className="text-white">{userDefaultFilename}</span>
          </p>
          <p className="text-[10px] text-[#737373] mt-1">
            Saved in this browser only — does not change server `default.yaml`
            {serverDefaultFilename && serverDefaultFilename !== userDefaultFilename
              ? ` · server uses ${serverDefaultFilename}`
              : ''}
          </p>
        </div>
      )}

      {recommended && (
        <div className="bg-[#10b981]/10 border border-[#10b981]/30 rounded-lg px-4 py-3">
          <p className="text-[12px] text-[#34d399] font-medium">
            Recommended for {group.label}: <span className="text-white">{group.recommended}</span>
          </p>
          <p className="text-[10px] text-[#737373] mt-1">
            Ranked #1 by val mAP50-95 on held-out split (`training-metrics/*/results.csv`)
          </p>
          {recommended.verdict?.reasons_good[0] && (
            <p className="text-[11px] text-[#b0b0b0] mt-1">
              <ReasonText text={recommended.verdict.reasons_good[0]} />
            </p>
          )}
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="bg-[#141414] border border-[#262626] rounded-lg p-5">
          <h3 className="text-[13px] font-medium text-white mb-1">mAP50-95 comparison (val)</h3>
          <p className="text-[11px] text-[#737373] mb-4">
            Best val epoch per model from `results.csv` — column `metrics/mAP50-95(B)`
          </p>
          <ModelCompareBars models={group.models} />
        </div>
        <div className="bg-[#141414] border border-[#262626] rounded-lg p-5">
          <h3 className="text-[13px] font-medium text-white mb-1">Val metrics table</h3>
          <p className="text-[11px] text-[#737373] mb-4">
            Precision / recall / mAP at each model&apos;s best val epoch (same row as chart)
          </p>
          <ModelMetricRadar models={group.models} />
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-[13px] font-medium text-white">Model details</h3>
            <p className="text-[11px] text-[#737373] mt-0.5">
              {detailsLayout === 'panels'
                ? 'All models expanded — scroll to compare training curves side by side'
                : 'Expand rows to inspect strengths, warnings, and curves'}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {detailsLayout === 'list' && (
              <>
                <button
                  type="button"
                  onClick={() => dispatchExpanded({ type: 'expandAll', filenames: selectableFilenames })}
                  className="px-2 py-1 rounded border border-[#404040] text-[10px] text-[#b0b0b0] hover:text-white hover:border-[#525252] transition-colors"
                >
                  Expand all
                </button>
                <button
                  type="button"
                  onClick={() => dispatchExpanded({ type: 'reset' })}
                  disabled={expandedCount === 0}
                  className="px-2 py-1 rounded border border-[#404040] text-[10px] text-[#b0b0b0] hover:text-white hover:border-[#525252] transition-colors disabled:opacity-40"
                >
                  Collapse all
                </button>
              </>
            )}
            <LayoutToggle layout={detailsLayout} onChange={onDetailsLayoutChange} />
          </div>
        </div>

        {detailsLayout === 'panels' ? (
          <div className="grid xl:grid-cols-2 gap-4 items-start">
            {group.models.map((m) => (
              <ModelPanelCard
                key={m.filename}
                model={m}
                groupId={group.id}
                userDefaultFilename={userDefaultFilename}
                serverDefaultFilename={serverDefaultFilename}
                onSetDefault={onSetDefault}
                onClearDefault={onClearDefault}
              />
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {group.models.map((m) => (
              <div key={m.filename} className="space-y-0">
                <ModelCardHeader
                  model={m}
                  selected={expandedModels.has(m.filename)}
                  registerRef={(el) => {
                    cardRefs.current[m.filename] = el;
                  }}
                  onToggle={() => toggleModel(m.filename)}
                  userDefaultFilename={userDefaultFilename}
                  groupId={group.id}
                  onSetDefault={onSetDefault}
                />
                {expandedModels.has(m.filename) && (
                  <ModelCardDetails
                    key={m.filename}
                    model={m}
                    groupId={group.id}
                    userDefaultFilename={userDefaultFilename}
                    serverDefaultFilename={serverDefaultFilename}
                    onSetDefault={onSetDefault}
                    onClearDefault={onClearDefault}
                  />
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function ModelLabConsole() {
  const navigate = useNavigate();
  const { profile } = useAdminProfile();
  const displayName = profile?.full_name || profile?.username || 'Admin';
  const userEmail = profile?.email ?? null;

  const [report, setReport] = useState<ModelAnalysisReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeGroup, setActiveGroup] = useState<string>('grout-tube');
  const [expandedModels, dispatchExpanded] = useReducer(expandedModelReducer, new Set<string>());
  const [detailsLayout, setDetailsLayout] = useState<ModelDetailsLayout>(() => readModelLabLayout());
  const [userDefaults, setUserDefaults] = useState<ModelLabDefaultsMap>(() => readModelLabDefaults());
  const [refreshKey, setRefreshKey] = useState(0);

  const handleSetDefault = useCallback((groupId: string, filename: string) => {
    setUserDefaults(writeModelLabDefault(groupId, filename));
  }, []);

  const handleClearDefault = useCallback((groupId: string) => {
    setUserDefaults(clearModelLabDefault(groupId));
  }, []);

  const handleDetailsLayoutChange = (layout: ModelDetailsLayout) => {
    setDetailsLayout(layout);
    writeModelLabLayout(layout);
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchModelAnalysis();
      setReport(data);
      if (data.groups.length && !data.groups.some((g) => g.id === activeGroup)) {
        setActiveGroup(data.groups[0].id);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [activeGroup]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  useEffect(() => {
    dispatchExpanded({ type: 'reset' });
  }, [activeGroup]);

  const currentGroup = report?.groups.find((g) => g.id === activeGroup) ?? report?.groups[0];
  const totalModels = report?.groups.reduce((n, g) => n + g.model_count, 0) ?? 0;
  const activeUserDefault = currentGroup ? userDefaults[currentGroup.id] : undefined;
  const serverDefaultForGroup =
    currentGroup?.models.find((m) => m.is_default)?.filename ?? report?.default_weights ?? null;
  const effectiveDefault = activeUserDefault ?? serverDefaultForGroup;
  const defaultMismatch =
    !!currentGroup?.recommended &&
    !!effectiveDefault &&
    effectiveDefault !== currentGroup.recommended;

  return (
    <div className="flex w-full h-screen overflow-hidden bg-[#0a0a0a] text-white">
      <WorkspaceSidebar
        activeNav="model-lab"
        displayName={displayName}
        userEmail={userEmail}
        showAdminLink
        showModelLabLink
        onCreateProject={() => navigate('/projects')}
        onNavigate={(nav) => {
          if (nav === 'dashboard') navigate('/');
          else if (nav === 'projects') navigate('/projects');
          else if (nav === 'account') navigate('/account');
          else if (nav === 'admin') navigate('/admin');
          else if (nav === 'model-lab') navigate('/model-lab');
        }}
        onAdmin={() => navigate('/admin')}
        onModelLab={() => navigate('/model-lab')}
        onHelp={() => {}}
      />

      <div className="flex-1 overflow-hidden flex flex-col">
        <header className="h-14 border-b border-[#1f1f1f] flex items-center justify-between px-6 shrink-0 bg-[#0a0a0a]">
          <div>
            <div className="flex items-center gap-2 text-white font-semibold">
              <Beaker className="w-4 h-4 text-[#60a5fa]" />
              Model Lab
            </div>
            <p className="text-[11px] text-[#737373] mt-0.5">
              Element IQ / Model Lab — compare YOLO weights &amp; training metrics
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate('/admin')}
              className="hidden sm:flex items-center gap-1.5 px-2 py-1 text-[11px] text-[#b0b0b0] hover:text-white border border-[#262626] rounded transition-colors"
            >
              <Shield className="w-3 h-3" /> Admin
            </button>
            <div className="hidden sm:flex items-center gap-1.5 px-2 py-1 bg-[#141414] border border-[#262626] rounded text-[10px] text-[#b0b0b0] uppercase">
              {ELEMENTIQ_ENGINE}
            </div>
            <button
              type="button"
              onClick={() => setRefreshKey((k) => k + 1)}
              className="p-2 rounded-md text-[#b0b0b0] hover:text-white hover:bg-[#141414] transition-colors"
              title="Refresh"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <UserProfileMenu variant="workspace" />
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6">
          {loading && !report && (
            <PanelLoading eyebrow="Model Lab" title="Scanning models &amp; training runs…" />
          )}

          {error && (
            <div className="bg-[#ef4444]/10 border border-[#ef4444]/30 rounded-lg px-4 py-3 text-[13px] text-[#f87171]">
              {error}
            </div>
          )}

          {report && (
            <>
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <AdminKpiCard
                  label="Models deployed"
                  value={String(totalModels)}
                  subtext={`models/ · metrics in training-metrics/`}
                  icon={Beaker}
                  accent="purple"
                />
                <AdminKpiCard
                  label={activeUserDefault ? 'Your default' : 'Default weights'}
                  value={effectiveDefault ?? '—'}
                  subtext={
                    activeUserDefault
                      ? defaultMismatch
                        ? 'Saved in this browser · differs from recommended rank #1'
                        : 'Saved in this browser · matches recommendation'
                      : defaultMismatch
                        ? 'Server default.yaml · differs from recommended — set yours below'
                        : 'From server default.yaml or matches recommendation'
                  }
                  icon={Star}
                  accent={defaultMismatch ? 'amber' : 'green'}
                />
                <AdminKpiCard
                  label="Component groups"
                  value={String(report.groups.length)}
                  subtext={report.groups.map((g) => g.label).join(' · ')}
                  icon={Beaker}
                />
                <AdminKpiCard
                  label="Updated"
                  value={new Date(report.generated_at).toLocaleTimeString()}
                  subtext={new Date(report.generated_at).toLocaleDateString()}
                  icon={RefreshCw}
                />
              </div>

              <div className="flex flex-wrap gap-2 mb-6 border-b border-[#262626] pb-3">
                {report.groups.map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => setActiveGroup(g.id)}
                    className={cn(
                      'px-3 py-1.5 rounded-md text-[12px] transition-colors',
                      activeGroup === g.id
                        ? 'bg-[#2563eb] text-white'
                        : 'text-[#b0b0b0] hover:text-white hover:bg-[#141414]',
                    )}
                  >
                    {g.label}
                    <span className="ml-1.5 text-[10px] opacity-70">({g.model_count})</span>
                  </button>
                ))}
              </div>

              {currentGroup && (
                <GroupPanel
                  key={currentGroup.id}
                  group={currentGroup}
                  expandedModels={expandedModels}
                  dispatchExpanded={dispatchExpanded}
                  detailsLayout={detailsLayout}
                  onDetailsLayoutChange={handleDetailsLayoutChange}
                  userDefaultFilename={activeUserDefault}
                  serverDefaultFilename={serverDefaultForGroup}
                  onSetDefault={handleSetDefault}
                  onClearDefault={handleClearDefault}
                />
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
