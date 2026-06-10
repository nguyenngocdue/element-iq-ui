import { memo, useState } from 'react';
import { cn } from '../../lib/utils';

type JsonLike =
  | null
  | string
  | number
  | boolean
  | JsonLike[]
  | { [key: string]: JsonLike };

interface JsonViewProps {
  data: unknown;
  name?: string;
  initialExpandDepth?: number;
  framed?: boolean;
  expandAll?: boolean;
}

function tryParseJson(value: unknown): JsonLike {
  if (typeof value !== 'string') {
    return value as JsonLike;
  }

  const trimmed = value.trim();
  const looksLikeJson =
    (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
    (trimmed.startsWith('[') && trimmed.endsWith(']'));
  if (!looksLikeJson) return value;

  try {
    return JSON.parse(value) as JsonLike;
  } catch {
    return value;
  }
}

function toPrettyString(value: unknown): string {
  try {
    return typeof value === 'string' ? value : JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function copyToClipboard(text: string) {
  void navigator.clipboard.writeText(text).catch(() => undefined);
}

export default memo(function JsonView({
  data,
  name,
  initialExpandDepth = 2,
  framed = false,
  expandAll = false,
}: JsonViewProps) {
  const normalized = tryParseJson(data);
  const rootKey = `${expandAll ? 'all' : 'depth'}-${initialExpandDepth}`;

  return (
    <div className={cn('w-full text-sm', framed ? 'rounded-lg border border-[#3c3c3c] bg-[#252526] overflow-hidden' : '')}>
      {framed ? (
        <div className="flex items-center gap-2 border-b border-[#3c3c3c] bg-[#1e1e1e]/60 px-3 py-2">
          <span className="text-xs font-medium text-[#858585]">{name ?? 'JSON'}</span>
          <div className="flex-1" />
          <button
            type="button"
            className="rounded border border-[#3c3c3c] bg-[#1e1e1e] px-2 py-1 text-xs text-[#cccccc] hover:bg-[#2d2d2d]"
            onClick={() => copyToClipboard(toPrettyString(normalized))}
            title="Copy JSON"
          >
            Copy
          </button>
        </div>
      ) : null}

      <div className={framed ? 'px-3 py-3' : ''}>
        <JsonNode
          key={rootKey}
          data={normalized}
          name={name}
          depth={0}
          initialExpandDepth={initialExpandDepth}
          expandAll={expandAll}
        />
      </div>
    </div>
  );
});

function JsonNode({
  data,
  name,
  depth,
  initialExpandDepth,
  expandAll,
}: {
  data: JsonLike;
  name?: string;
  depth: number;
  initialExpandDepth: number;
  expandAll: boolean;
}) {
  const kind = getKind(data);
  const defaultExpanded = expandAll || (kind !== 'string' && depth < initialExpandDepth);
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  const keyLabel = name ? <span className="mr-1 text-[#858585]">{name}:</span> : null;

  if (kind === 'object' || kind === 'array') {
    const isArray = kind === 'array';
    const entries = isArray
      ? (data as JsonLike[]).map((value, index) => [String(index), value] as const)
      : Object.entries(data as Record<string, JsonLike>);
    const open = isArray ? '[' : '{';
    const close = isArray ? ']' : '}';

    if (entries.length === 0) {
      return (
        <div className="flex items-center">
          {keyLabel}
          <span className="text-[#858585]">{isArray ? '[]' : '{}'}</span>
        </div>
      );
    }

    return (
      <div className="flex flex-col">
        <button
          type="button"
          className="flex -mx-1 items-center gap-1 rounded px-1 text-left hover:bg-[#3c3c3c]/40"
          onClick={() => setIsExpanded((value) => !value)}
          title={isExpanded ? 'Collapse' : 'Expand'}
        >
          {keyLabel}
          {isExpanded ? (
            <span className="text-[#858585]">{open}</span>
          ) : (
            <>
              <span className="text-[#858585]">{isArray ? '[ … ]' : '{ … }'}</span>
              <span className="ml-1 text-xs text-[#858585]">
                {entries.length} {entries.length === 1 ? 'item' : 'items'}
              </span>
            </>
          )}
        </button>

        {isExpanded ? (
          <>
            <div className="ml-3 border-l border-[#3c3c3c]/60 pl-3">
              {entries.map(([entryKey, entryValue]) => (
                <div key={entryKey} className="my-1">
                  <JsonNode
                    data={entryValue}
                    name={entryKey}
                    depth={depth + 1}
                    initialExpandDepth={initialExpandDepth}
                    expandAll={expandAll}
                  />
                </div>
              ))}
            </div>
            <span className="mt-0.5 text-[#858585]">{close}</span>
          </>
        ) : null}
      </div>
    );
  }

  if (kind === 'string') {
    const value = data as string;
    const max = 120;
    const tooLong = value.length > max;

    return (
      <div className="flex items-start">
        {keyLabel}
        <pre
          className={cn(
            'cursor-pointer whitespace-pre-wrap break-words text-[#2eb886] font-mono text-xs',
            tooLong ? 'hover:text-[#34d399]' : '',
          )}
          onClick={() => (tooLong ? setIsExpanded((current) => !current) : undefined)}
          title={tooLong ? (isExpanded ? 'Collapse' : 'Expand') : undefined}
        >
          &quot;{tooLong && !isExpanded ? `${value.slice(0, max)}...` : value}&quot;
        </pre>
      </div>
    );
  }

  return (
    <div className="flex items-start font-mono text-xs">
      {keyLabel}
      {kind === 'number' ? <span className="text-[#82aaff]">{String(data)}</span> : null}
      {kind === 'boolean' ? <span className="text-[#d4b238]">{String(data)}</span> : null}
      {kind === 'null' ? <span className="text-[#c678dd]">null</span> : null}
      {kind === 'undefined' ? <span className="text-[#858585]">undefined</span> : null}
    </div>
  );
}

function getKind(value: JsonLike): 'object' | 'array' | 'string' | 'number' | 'boolean' | 'null' | 'undefined' {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  if (typeof value === 'object') return 'object';
  if (typeof value === 'string') return 'string';
  if (typeof value === 'number') return 'number';
  if (typeof value === 'boolean') return 'boolean';
  return 'undefined';
}

export function parseJsonContent(content: string): unknown {
  try {
    return JSON.parse(content);
  } catch {
    return content;
  }
}
