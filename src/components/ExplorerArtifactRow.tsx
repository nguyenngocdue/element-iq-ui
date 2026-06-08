import React from 'react';
import { BarChart2, FileText, Image } from 'lucide-react';
import { cn } from '../lib/utils';
import {
  artifactDisplayName,
  formatFileSizeBytes,
  formatIsoDateTime,
} from '../lib/fileView';
import {
  ExplorerTooltipLocation,
  ExplorerTooltipRow,
  useExplorerHoverTooltip,
} from '../hooks/useExplorerHoverTooltip';
import { FileArtifact } from '../types';
import { TreeRow } from './TreeRow';

function artifactIcon(type: string) {
  if (type === 'ANNOTATED_PNG') return { Icon: Image, color: 'text-[#10b981]' };
  if (type === 'ANNOTATED_PDF') return { Icon: FileText, color: 'text-[#3b82f6]' };
  return { Icon: BarChart2, color: 'text-[#f59e0b]' };
}

function ArtifactTooltipContent({
  artifact,
  sourceFileName,
}: {
  artifact: FileArtifact;
  sourceFileName: string;
}) {
  const displayName = artifactDisplayName(artifact.type);
  const sizeStr = formatFileSizeBytes(artifact.fileSizeBytes ?? 0);
  const createdStr = formatIsoDateTime(artifact.createdAt);
  const locationStr = artifact.localPath ?? '—';

  return (
    <>
      <ExplorerTooltipRow label="ID" value={`${artifact.id.slice(0, 8)}...`} valueClassName="font-mono" />
      <ExplorerTooltipRow label="Artifact" value={displayName} valueClassName="font-medium" />
      <ExplorerTooltipRow label="Source" value={sourceFileName} />
      {artifact.originalFilename && (
        <ExplorerTooltipRow label="Filename" value={artifact.originalFilename} />
      )}
      <ExplorerTooltipRow label="Size" value={sizeStr} />
      {artifact.contentType && (
        <ExplorerTooltipRow label="MIME" value={artifact.contentType} valueClassName="font-mono text-[11px]" />
      )}
      <ExplorerTooltipRow label="Created" value={createdStr} />
      <ExplorerTooltipLocation path={locationStr} />
    </>
  );
}

export function ExplorerArtifactRow({
  artifact,
  sourceFileName,
  isActive,
  onSelect,
  variant,
  continuingGuides,
  isLast,
  className,
  spacerColumns = 0,
}: React.Attributes & {
  artifact: FileArtifact;
  sourceFileName: string;
  isActive: boolean;
  onSelect: () => void;
  variant: 'tree' | 'flat';
  continuingGuides?: boolean[];
  isLast?: boolean;
  className?: string;
  spacerColumns?: number;
}) {
  const { anchorRef, hoverProps, renderTooltip } = useExplorerHoverTooltip();
  const displayName = artifactDisplayName(artifact.type);
  const { Icon, color } = artifactIcon(artifact.type);
  const tooltip = renderTooltip(
    <ArtifactTooltipContent artifact={artifact} sourceFileName={sourceFileName} />,
  );

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect();
  };

  if (variant === 'tree') {
    return (
      <>
        {tooltip}
        <div ref={anchorRef} {...hoverProps}>
          <TreeRow
            spacerColumns={spacerColumns}
            continuingGuides={continuingGuides ?? []}
            isLast={isLast ?? true}
            active={isActive}
            onClick={handleClick}
            className={className}
          >
            <Icon className={cn('w-3.5 h-3.5 shrink-0', color)} />
            <span className="truncate">{displayName}</span>
          </TreeRow>
        </div>
      </>
    );
  }

  return (
    <>
      {tooltip}
      <div
        ref={anchorRef}
        {...hoverProps}
        onClick={handleClick}
        className={cn(
          'pl-[4.25rem] pr-4 py-1 flex items-center gap-2 cursor-pointer text-[11px] transition-colors',
          isActive ? 'bg-[#333748] text-white' : 'hover:bg-[#25272e] text-[#858585] hover:text-white',
          className,
        )}
      >
        <Icon className={cn('w-3.5 h-3.5 shrink-0', color)} />
        <span className="truncate">{displayName}</span>
      </div>
    </>
  );
}
