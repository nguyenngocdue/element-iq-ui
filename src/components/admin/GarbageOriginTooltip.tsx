import type { ReactNode } from 'react';
import { HoverTooltip } from '../HoverTooltip';
import { cn } from '../../lib/utils';

export interface GarbageOrigin {
  chain?: string;
  disk_path?: string | null;
  db_path?: string | null;
  owner_id?: string;
  owner_username?: string | null;
  project_id?: string;
  project_name?: string | null;
  file_id?: string;
  file_version_id?: string;
  job_id?: string;
  filename?: string | null;
  artifact_id?: string;
  artifact_type?: string;
}

function OriginTooltipContent({ origin }: { origin: GarbageOrigin }) {
  const rows: Array<[string, string]> = [];
  const push = (label: string, value: string | null | undefined) => {
    if (value) rows.push([label, value]);
  };

  push('Chain', origin.chain);
  push('Disk path', origin.disk_path ?? undefined);
  push('DB path', origin.db_path ?? undefined);
  push('Owner', origin.owner_username ?? origin.owner_id);
  push('Project', origin.project_name ?? origin.project_id);
  push('File', origin.filename ?? undefined);
  push('File ID', origin.file_id);
  push('File version', origin.file_version_id);
  push('Job ID', origin.job_id);
  push('Artifact', origin.artifact_type);
  push('Artifact ID', origin.artifact_id);

  if (rows.length === 0) {
    return <span className="text-xs text-[#737373]">No origin metadata</span>;
  }

  return (
    <div className="text-[11px] space-y-1.5 max-w-[min(90vw,42rem)] py-0.5 select-text">
      {rows.map(([label, value]) => (
        <div key={label}>
          <div className="text-[#737373] uppercase tracking-wide text-[10px] mb-0.5">{label}</div>
          <div className="font-mono text-[#e5e5e5] break-all leading-snug whitespace-pre-wrap">{value}</div>
        </div>
      ))}
    </div>
  );
}

/** Horizontal scroll for long paths — shift+wheel or drag scrollbar */
export function ScrollPath({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'overflow-x-auto overflow-y-hidden max-w-full overscroll-x-contain',
        '[scrollbar-width:thin] [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-[#404040]',
        className,
      )}
      title={text}
    >
      <span className="font-mono text-xs text-[#b0b0b0] whitespace-nowrap inline-block py-0.5 pr-2">
        {text}
      </span>
    </div>
  );
}

function mergeOrigin(origin: GarbageOrigin | null | undefined, fallbackPath?: string): GarbageOrigin | null {
  if (origin && (origin.chain || origin.disk_path || origin.db_path)) {
    return origin;
  }
  if (fallbackPath) {
    return { disk_path: fallbackPath, chain: fallbackPath };
  }
  return origin ?? null;
}

export function GarbageOriginTooltip({
  origin,
  fallbackPath,
  children,
  className,
}: {
  origin?: GarbageOrigin | null;
  fallbackPath?: string;
  children: ReactNode;
  className?: string;
}) {
  const effective = mergeOrigin(origin, fallbackPath);
  if (!effective?.disk_path && !effective?.db_path && !effective?.chain) {
    return <div className={className}>{children}</div>;
  }

  return (
    <HoverTooltip
      placement="auto"
      delayMs={150}
      className={className}
      content={<OriginTooltipContent origin={effective} />}
    >
      {children}
    </HoverTooltip>
  );
}
