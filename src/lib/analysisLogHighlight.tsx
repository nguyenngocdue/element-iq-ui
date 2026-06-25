import React from 'react';
import { AnalysisLogLine } from '../types';
import { ELEMENTIQ_ENGINE } from './engineBranding';

type HighlightSpan = { start: number; end: number; className: string };

const DEFAULT_TEXT = 'text-[#cccccc]';

/** Keyword colors only — no badge/box styling. */
const HL = {
  keyword: 'text-[#9cdcfe] font-semibold',
  stage: 'text-[#e2e2a8]',
  string: 'text-[#ffb07a]',
  number: 'text-[#b5cea8] tabular-nums',
  operator: 'text-[#808080]',
  action: 'text-[#6ee7b7] font-semibold',
  pass: 'text-[#6ee7b7] font-bold',
  fail: 'text-[#fca5a5] font-bold',
  warn: 'text-[#fde047] font-semibold',
} as const;

const HIGHLIGHT_RULES: { pattern: RegExp; className: string }[] = [
  { pattern: /\bModel:/g, className: HL.keyword },
  { pattern: /\bQueue started\b|\bQueue finished\b|\bQueue stopped\b|\bStop requested\b/g, className: HL.keyword },
  {
    pattern:
      /Connecting to backend…|Downloading PDF from server…|Job queued — polling status…|ElementIQ Engine — [^(\n]+(?:…|\.\.\.)?/g,
    className: HL.stage,
  },
  { pattern: new RegExp(ELEMENTIQ_ENGINE.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), className: HL.keyword },
  { pattern: /\[W\d+\]/g, className: HL.keyword },
  { pattern: /\[[\d]+\/[\d]+\]/g, className: HL.number },
  { pattern: /\bConfig:|GPU:|Models:|Engine:/g, className: HL.keyword },
  { pattern: /\bPrepare ·|Scan ·|Read tags ·|Validate ·|Save report ·|Complete ·|layout ·|name ·|detach ·|grout ·/g, className: HL.stage },
  { pattern: /\bTOTAL\b/g, className: HL.pass },
  { pattern: /\(\d+%\)/g, className: HL.number },
  { pattern: /\bconf \d+%/g, className: HL.number },
  { pattern: /\b\d+ detection\(s\)/g, className: HL.number },
  { pattern: /\b[\w.-]+\.pt\b/g, className: HL.string },
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

export function getLogRowBackground(_line: AnalysisLogLine): string {
  return 'hover:bg-[#2a2d2e]/40';
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
