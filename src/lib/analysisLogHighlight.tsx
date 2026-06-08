import React from 'react';
import { AnalysisLogLine } from '../types';

type HighlightSpan = { start: number; end: number; className: string };

const DEFAULT_TEXT = 'text-[#cccccc]';

/** VS Code-style tokens with distinct text + background colors. */
const HL = {
  keyword:
    'text-[#9cdcfe] font-semibold bg-[#569cd6]/18 border border-[#569cd6]/25 rounded px-1 py-px',
  stage:
    'text-[#e2e2a8] bg-[#dcdcaa]/14 border border-[#dcdcaa]/20 rounded px-1 py-px',
  string:
    'text-[#ffb07a] bg-[#ce9178]/16 border border-[#ce9178]/22 rounded px-1 py-px',
  number:
    'text-[#b5cea8] bg-[#4ec9b0]/12 border border-[#4ec9b0]/18 rounded px-1 py-px tabular-nums',
  operator: 'text-[#808080] bg-[#ffffff]/5 rounded px-0.5',
  action:
    'text-[#6ee7b7] bg-[#10b981]/18 border border-[#10b981]/25 rounded px-1 py-px font-semibold',
  model:
    'text-[#7dd3fc] bg-[#0ea5e9]/14 border border-[#0ea5e9]/22 rounded px-1 py-px',
  pass:
    'text-[#6ee7b7] font-bold bg-[#10b981]/22 border border-[#10b981]/30 rounded px-1.5 py-px',
  fail:
    'text-[#fca5a5] font-bold bg-[#ef4444]/20 border border-[#ef4444]/30 rounded px-1.5 py-px',
  warn:
    'text-[#fde047] font-semibold bg-[#eab308]/16 border border-[#eab308]/28 rounded px-1.5 py-px',
} as const;

const HIGHLIGHT_RULES: { pattern: RegExp; className: string }[] = [
  { pattern: /\bModel:/g, className: HL.keyword },
  { pattern: /\bQueue started\b|\bQueue finished\b|\bQueue stopped\b|\bStop requested\b/g, className: HL.keyword },
  {
    pattern:
      /Connecting to backend…|Downloading PDF from server…|Job queued — polling status…|Uploading PDF\.{3}|Running YOLO detection\.{3}|Parsing text notes\.{3}|Validating results\.{3}|Saving artifacts\.{3}/g,
    className: HL.stage,
  },
  { pattern: /\[[\d]+\/[\d]+\]/g, className: HL.number },
  { pattern: /\(\d+%\)/g, className: HL.number },
  { pattern: /@ \d+%/g, className: HL.number },
  { pattern: /\b\d+ detection\(s\)/g, className: HL.number },
  { pattern: /\b[\w.-]+\.pt\b/g, className: HL.string },
  { pattern: /\([\w-]+\)/g, className: HL.model },
  { pattern: /\b[\w[\]().-]+\.pdf\b/gi, className: HL.string },
  { pattern: /→/g, className: HL.operator },
  { pattern: /▶/g, className: HL.action },
  { pattern: /· MISSING/g, className: HL.fail },
  { pattern: /· TRAINING/g, className: HL.warn },
  { pattern: /\bFAIL\b/g, className: HL.fail },
  { pattern: /\bPASS\b/g, className: HL.pass },
  { pattern: /\bNO-NOTE\b/g, className: HL.warn },
  { pattern: /\b\d+\.\d+% pass\b/g, className: HL.number },
];

function mergeNonOverlapping(spans: HighlightSpan[]): HighlightSpan[] {
  if (spans.length === 0) return [];
  const sorted = [...spans].sort((a, b) => a.start - b.start || b.end - a.end);
  const merged: HighlightSpan[] = [sorted[0]];
  for (let i = 1; i < sorted.length; i++) {
    const prev = merged[merged.length - 1];
    const cur = sorted[i];
    if (cur.start >= prev.end) {
      merged.push(cur);
    } else if (cur.end > prev.end && cur.end - cur.start > prev.end - prev.start) {
      merged[merged.length - 1] = cur;
    }
  }
  return merged;
}

function collectSpans(message: string): HighlightSpan[] {
  const spans: HighlightSpan[] = [];
  for (const { pattern, className } of HIGHLIGHT_RULES) {
    pattern.lastIndex = 0;
    let match = pattern.exec(message);
    while (match) {
      spans.push({
        start: match.index,
        end: match.index + match[0].length,
        className,
      });
      match = pattern.exec(message);
    }
  }
  return mergeNonOverlapping(spans);
}

export function getLogRowBackground(line: AnalysisLogLine): string {
  const msg = line.message;
  if (line.level === 'error' || /\bFAIL\b/.test(msg)) {
    return 'bg-[#ef4444]/10 border-l-2 border-[#ef4444]/40';
  }
  if (line.level === 'success' || (/\bPASS\b/.test(msg) && !/\bFAIL\b/.test(msg))) {
    return 'bg-[#10b981]/10 border-l-2 border-[#10b981]/35';
  }
  if (line.level === 'warn' || /\bNO-NOTE\b/.test(msg) || /stopped by user/i.test(msg)) {
    return 'bg-[#eab308]/10 border-l-2 border-[#eab308]/35';
  }
  if (msg.startsWith('Model:')) {
    return 'bg-[#569cd6]/10 border-l-2 border-[#569cd6]/30';
  }
  if (
    /Connecting to backend|Downloading PDF|Job queued|Uploading PDF|Running YOLO|Parsing text|Validating results|Saving artifacts/.test(
      msg,
    )
  ) {
    return 'bg-[#dcdcaa]/10 border-l-2 border-[#dcdcaa]/25';
  }
  if (/^\[\d+\/\d+\] ▶/.test(msg)) {
    return 'bg-[#10b981]/8 border-l-2 border-[#10b981]/25';
  }
  if (msg.startsWith('Queue started') || msg.startsWith('Queue finished')) {
    return 'bg-[#569cd6]/8 border-l-2 border-[#569cd6]/25';
  }
  return 'border-l-2 border-transparent hover:bg-[#2a2d2e]/50';
}

export function HighlightedLogMessage({
  message,
  baseClassName = DEFAULT_TEXT,
}: {
  message: string;
  baseClassName?: string;
}) {
  const spans = collectSpans(message);
  if (spans.length === 0) {
    return <span className={baseClassName}>{message}</span>;
  }

  const nodes: React.ReactNode[] = [];
  let cursor = 0;

  spans.forEach((span, i) => {
    if (span.start > cursor) {
      nodes.push(
        <span key={`t-${i}-pre`} className={baseClassName}>
          {message.slice(cursor, span.start)}
        </span>,
      );
    }
    nodes.push(
      <span key={`t-${i}-hl`} className={span.className}>
        {message.slice(span.start, span.end)}
      </span>,
    );
    cursor = span.end;
  });

  if (cursor < message.length) {
    nodes.push(
      <span key="t-tail" className={baseClassName}>
        {message.slice(cursor)}
      </span>,
    );
  }

  return <>{nodes}</>;
}
