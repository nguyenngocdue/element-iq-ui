import React from 'react';
import { extractReportComponents, VIEW_SOURCE_LABELS } from '../lib/viewSplit';

export function ViewSplitSummary({ data }: { data: unknown }) {
  const components = extractReportComponents(data).filter((c) => c.view_split || c.view_regions);
  if (components.length === 0) return null;

  return (
    <div className="bg-[#252526] border border-[#3c3c3c] rounded-lg p-3 mb-3 space-y-3 shrink-0">
      <div className="text-[10px] uppercase tracking-wider text-[#858585] font-mono">View split diagnostics</div>
      {components.map((comp, idx) => {
        const split = comp.view_split;
        const regions = comp.view_regions;
        const ambiguous = (comp.report ?? []).some((r) => r.status === 'VIEW-AMBIGUOUS');
        const label = comp.component_id ?? `component-${idx + 1}`;

        return (
          <div key={label} className="space-y-2 text-xs font-mono">
            <div className="text-[#82aaff]">{label}</div>
            {split ? (
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[#cccccc]">
                <span className="text-[#858585]">mid_x</span>
                <span>{split.mid_x != null ? `${split.mid_x.toFixed(1)} px` : '—'}</span>
                <span className="text-[#858585]">source</span>
                <span className="text-[#dcdcaa]">
                  {split.source}
                  {VIEW_SOURCE_LABELS[split.source] ? ` — ${VIEW_SOURCE_LABELS[split.source]}` : ''}
                </span>
                {split.mid_title != null ? (
                  <>
                    <span className="text-[#858585]">mid_title</span>
                    <span>{split.mid_title.toFixed(1)} px</span>
                  </>
                ) : null}
                {split.mid_gap != null ? (
                  <>
                    <span className="text-[#858585]">mid_gap</span>
                    <span>{split.mid_gap.toFixed(1)} px</span>
                  </>
                ) : null}
              </div>
            ) : null}
            {regions ? (
              <div className="flex flex-wrap gap-2 pt-1">
                {Object.entries(regions).map(([viewName, region]) => (
                  <div
                    key={viewName}
                    className="px-2 py-1 rounded border border-[#3c3c3c] bg-[#1e1e1e] text-[10px] text-[#cccccc]"
                  >
                    <span className="text-[#4ec9b0]">{viewName}</span>
                    {' · '}
                    {region.tube_ids.length} tube(s): #{region.tube_ids.join(', #')}
                  </div>
                ))}
              </div>
            ) : null}
            {ambiguous ? (
              <div className="text-[#d4b238] text-[10px]">
                VIEW-AMBIGUOUS — review tubes near the split line (orange highlight on annotated PNG)
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
