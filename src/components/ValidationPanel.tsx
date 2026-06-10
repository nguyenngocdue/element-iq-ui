import React from 'react';
import { useApp } from '../store';
import {
  validationPanelAccentClass,
  validationAnnotationsNeedingReview,
} from '../lib/analysisStatus';
import {
  describeValidationAnnotation,
  sortValidationAnnotations,
  summarizeGroutCheck,
  TONE_STYLES,
  type AnnotationTone,
} from '../lib/validationCopy';
import { Detection, ValidationAnnotation } from '../types';
import { useResizable } from '../hooks/useResizable';
import { cn } from '../lib/utils';
import { ELEMENTIQ_ENGINE } from '../lib/engineBranding';
import { Download, Eye } from 'lucide-react';
import { artifactDisplayName, artifactIconMeta } from '../lib/fileView';

const CARD = 'rounded-md border border-[#3c3c3c] bg-[#1e1e1e]';

function statusAccent(tone: AnnotationTone): string {
  if (tone === 'fail') return 'border-l-2 border-l-[#c75c5c]';
  if (tone === 'warn') return 'border-l-2 border-l-[#b8923a]';
  if (tone === 'pass') return 'border-l-2 border-l-[#6b9e78]';
  return 'border-l-2 border-l-[#505050]';
}

function statCircleStyles(tone?: AnnotationTone) {
  if (!tone) {
    return {
      ring: 'border-[#525252] bg-[#252526]',
      text: 'text-[#f0f0f0]',
    };
  }
  const s = TONE_STYLES[tone];
  return { ring: cn(s.border, s.bg), text: s.text };
}

function StatCircle({
  value,
  unit,
  tone,
  compact = false,
}: {
  value: string;
  unit?: string;
  tone?: AnnotationTone;
  compact?: boolean;
}) {
  const digits = value.length;
  const circleSize = compact
    ? (digits > 2 ? 'h-9 w-9' : 'h-8 w-8')
    : (digits > 2 ? 'h-10 w-10' : 'h-9 w-9');
  const textSize = compact
    ? (digits > 2 ? 'text-xs' : 'text-sm')
    : (digits > 2 ? 'text-sm' : 'text-base');

  const circleStyle = statCircleStyles(tone);

  return (
    <div className="flex flex-col items-center justify-center gap-1">
      <div
        className={cn(
          'flex shrink-0 items-center justify-center rounded-full border-2',
          circleStyle.ring,
          circleSize,
        )}
      >
        <span className={cn('font-mono font-bold tabular-nums leading-none', circleStyle.text, textSize)}>
          {value}
        </span>
      </div>
      {unit && (
        <span className="max-w-[52px] text-center text-[9px] text-[#858585]">
          {unit}
        </span>
      )}
    </div>
  );
}

interface StatBadgeProps {
  tone: AnnotationTone;
  title: string;
  statNumber: string;
  statUnit?: string;
  statContent: string;
  compact?: boolean;
}

function StatBadge({
  tone,
  title,
  statNumber,
  statUnit,
  statContent,
  compact = false,
}: StatBadgeProps) {
  return (
    <div className={cn(CARD, statusAccent(tone), 'overflow-hidden')}>
      <div className="border-b border-[#3c3c3c] px-3 py-2">
        <span className="text-[11px] font-medium leading-snug text-[#e8e8e8]">
          {title}
        </span>
      </div>
      <div className="flex divide-x divide-[#3c3c3c]">
        <div
          className={cn(
            'flex shrink-0 items-center justify-center',
            compact ? 'w-[64px] px-1 py-2' : 'w-[72px] px-1 py-2.5',
          )}
        >
          <StatCircle value={statNumber} unit={statUnit} tone={tone} compact={compact} />
        </div>
        <div className={cn('flex min-w-0 flex-1 items-center', compact ? 'px-2.5 py-2' : 'px-3 py-2.5')}>
          <p className="text-[11px] leading-relaxed text-[#a8a8a8]">{statContent}</p>
        </div>
      </div>
    </div>
  );
}

function DrawingStatsBar({ tubeCount, viewChecks }: { tubeCount: number; viewChecks: number }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <div className={cn(CARD, 'overflow-hidden')}>
        <div className="flex divide-x divide-[#3c3c3c]">
          <div className="flex w-[64px] shrink-0 items-center justify-center py-2">
            <StatCircle value={String(tubeCount)} unit="tubes" tone="info" compact />
          </div>
          <div className="flex flex-1 items-center px-2.5 py-2">
            <p className="text-[10px] leading-snug text-[#a8a8a8]">
              Tubes found on drawing ({ELEMENTIQ_ENGINE})
            </p>
          </div>
        </div>
      </div>
      <div className={cn(CARD, 'overflow-hidden')}>
        <div className="flex divide-x divide-[#3c3c3c]">
          <div className="flex w-[64px] shrink-0 items-center justify-center py-2">
            <StatCircle value={String(viewChecks)} unit="views" tone="info" compact />
          </div>
          <div className="flex flex-1 items-center px-2.5 py-2">
            <p className="text-[10px] leading-snug text-[#a8a8a8]">
              Plan and reinforcement checks
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ValidationPanel() {
  const { state } = useApp();
  const canDownload = state.canDownload === true;
  const file = state.files.find(f => f.id === state.activeFileId);
  const { width, isDragging, handleMouseDown } = useResizable({ initialWidth: 350, minWidth: 250, maxWidth: 600, direction: 'right' });

  if (!file) return null;

  const annotations = sortValidationAnnotations(file.validationAnnotations ?? []);
  const reviewItems = validationAnnotationsNeedingReview(annotations);
  const hasValidationReports = annotations.length > 0;
  const tubeCount = file.tubeCount ?? file.detections.length;
  const summary = summarizeGroutCheck(annotations, tubeCount);

  const failDetections = file.detections.filter(d => d.status === 'FAIL');
  const warnDetections = file.detections.filter(d => d.status === 'WARN');

  return (
    <aside style={{ width }} className="bg-[#252526] border-l border-[#3c3c3c] flex flex-col shrink-0 relative">
       <div 
        onMouseDown={handleMouseDown}
        className={cn("absolute top-0 left-[-3px] bottom-0 w-[6px] cursor-col-resize z-50 hover:bg-[#505050] transition-colors", isDragging && "bg-[#707070]")}
      />
      <div className="p-4 flex flex-col gap-4 flex-1 overflow-y-auto">
        <div className={cn(CARD, 'p-4')}>
          <div className="flex justify-between items-start">
            <div>
              <div className="text-[11px] text-[#858585] uppercase tracking-wider mb-1">Quality Score</div>
              <div className="text-3xl font-light text-[#f0f0f0]">
                 {file.passRate ?? '--'} <span className="text-lg font-mono text-[#858585]">/ 100</span>
              </div>
            </div>
            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest ${validationPanelAccentClass(file.status)}`}>
              {file.status !== 'PENDING' && file.status !== 'ANALYZING' && file.status !== 'UPLOADING' ? file.status : 'WAIT'}
            </span>
          </div>
        </div>

        {(hasValidationReports || file.detections.length > 0) && reviewItems.length > 0 && (
          <div className="flex flex-col gap-2 flex-1">
            <div className="text-[11px] font-bold text-[#858585] uppercase">Issue Log</div>
            <div className="space-y-2 pr-1">
               {hasValidationReports
                 ? reviewItems.map(a => <ValidationIssueCard key={a.id} annotation={a} />)
                 : (
                   <>
                     {failDetections.map(d => <DetectionIssueCard key={d.id} detection={d} />)}
                     {warnDetections.map(d => <DetectionIssueCard key={d.id} detection={d} />)}
                   </>
                 )}
            </div>
          </div>
        )}

        <div className="mt-auto border-t border-[#3c3c3c] pt-4">
          {file.artifacts && file.artifacts.length > 0 && (
            <div className="mb-4">
              <div className="text-[11px] text-[#858585] mb-2 uppercase">Artifacts</div>
              <div className="space-y-1">
                {file.artifacts.map(a => {
                  const { Icon, color } = artifactIconMeta(a.type);
                  const openInViewer = () => {
                    window.dispatchEvent(new CustomEvent('elementiq:view-artifact', {
                      detail: {
                        id: a.id,
                        type: a.type,
                        downloadUrl: a.downloadUrl,
                        name: artifactDisplayName(a.type),
                        sourceFileId: file.id,
                      },
                    }));
                  };
                  return (
                  <button
                    key={a.id}
                    type="button"
                    onClick={async () => {
                      if (!canDownload) {
                        openInViewer();
                        return;
                      }
                      const { authFetch } = await import('../lib/supabase');
                      const sep = a.downloadUrl.includes('?') ? '&' : '?';
                      const res = await authFetch(`${a.downloadUrl}${sep}download=1`);
                      if (res.ok) {
                        const blob = await res.blob();
                        const url = URL.createObjectURL(blob);
                        const link = document.createElement('a');
                        link.href = url;
                        link.download = a.type === 'ANNOTATED_PNG' ? 'annotated.png' : a.type === 'ANNOTATED_PDF' ? 'annotated.pdf' : 'report.json';
                        document.body.appendChild(link); link.click(); document.body.removeChild(link); URL.revokeObjectURL(url);
                      }
                    }}
                    className="w-full text-left px-2 py-1.5 bg-[#1e1e1e] border border-[#3c3c3c] rounded text-[11px] text-[#e8e8e8] hover:bg-[#2a2a2a] flex items-center gap-2"
                  >
                    <Icon className={cn('w-3.5 h-3.5 shrink-0', color)} />
                    <span className="flex-1 truncate">{artifactDisplayName(a.type)}</span>
                    {canDownload
                      ? <Download className="w-3 h-3 text-[#858585] shrink-0" />
                      : <Eye className="w-3 h-3 text-[#858585] shrink-0" />}
                  </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="text-[11px] text-[#858585] mb-2 uppercase">Active Annotations</div>

          {hasValidationReports ? (
            <div className="flex flex-col gap-2">
              <StatBadge
                tone={summary.tone}
                title={summary.title}
                statNumber={summary.statNumber}
                statUnit={summary.statUnit}
                statContent={summary.statContent}
              />

              <div className="space-y-2">
                {annotations.map((ann) => {
                  const copy = describeValidationAnnotation(ann);
                  return (
                    <StatBadge
                      key={ann.id}
                      tone={copy.tone}
                      title={copy.title}
                      statNumber={copy.statNumber}
                      statUnit={copy.statUnit}
                      statContent={copy.statContent}
                      compact
                    />
                  );
                })}
              </div>

              <DrawingStatsBar tubeCount={tubeCount} viewChecks={annotations.length} />
            </div>
          ) : file.status === 'PENDING' ? (
            <div className="text-[11px] text-[#a8a8a8] bg-[#1e1e1e] border border-[#3c3c3c] rounded-md p-3">
              Run analysis to validate grout tubes and qty tags on this sheet.
            </div>
          ) : (
            <div className="text-[11px] text-[#858585]">
              {file.detections.length} detection(s) — no structured validation report.
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}

function ValidationIssueCard({ annotation }: { annotation: ValidationAnnotation }) {
  const copy = describeValidationAnnotation(annotation);

  return (
    <StatBadge
      tone={copy.tone}
      title={copy.title}
      statNumber={copy.statNumber}
      statUnit={copy.statUnit}
      statContent={copy.statContent}
      compact
    />
  );
}

function DetectionIssueCard({ detection }: { detection: Detection }) {
  const isFail = detection.status === 'FAIL';

  return (
    <div className={cn(CARD, 'p-3', isFail ? 'border-l-2 border-l-[#c75c5c]' : 'border-l-2 border-l-[#b8923a]')}>
       <div className="flex justify-between text-[11px] mb-1">
          <span className="text-[#e8e8e8] font-medium">Detected: {detection.type}</span>
          <span className="text-[#858585]">{isFail ? 'Failed' : 'Review'}</span>
       </div>
       <p className="text-[11px] text-[#a8a8a8] leading-relaxed">
         {detection.reason || `Detected ${detection.type} at ${(detection.confidence * 100).toFixed(0)}% confidence.`}
       </p>
    </div>
  );
}
