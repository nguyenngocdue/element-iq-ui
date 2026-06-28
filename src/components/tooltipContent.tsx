import type { ReactNode } from 'react';
import { ExplorerTooltipRow } from '../hooks/useExplorerHoverTooltip';
import { cn } from '../lib/utils';
import { HoverTooltip } from './HoverTooltip';

export function ProjectTooltipContent({  id,
  name,
  description,
}: {
  id: string;
  name: string;
  description?: string | null;
}) {
  return (
    <>
      <ExplorerTooltipRow label="UUID" value={id} copyText={id} valueClassName="font-mono text-[11px] break-all" />
      <ExplorerTooltipRow label="Project" value={name} copyText={name} valueClassName="font-medium" />
      {description?.trim() ? (
        <ExplorerTooltipRow label="Description" value={description.trim()} />
      ) : null}
    </>
  );
}

export function ProjectNameTooltip({
  id,
  name,
  description,
  className,
  children,
}: {
  id: string;
  name: string;
  description?: string | null;
  className?: string;
  children: ReactNode;
}) {
  return (
    <HoverTooltip
      stopBubble
      className={cn('inline-block min-w-0 max-w-full', className)}
      content={<ProjectTooltipContent id={id} name={name} description={description} />}
    >
      {children}
    </HoverTooltip>
  );
}

export function UserTooltipContent({
  userId,
  name,
  username,
  email,
}: {
  userId: string;
  name?: string | null;
  username?: string | null;
  email?: string | null;
}) {
  return (
    <>
      <ExplorerTooltipRow label="User ID" value={userId} copyText={userId} valueClassName="font-mono text-[11px] break-all" />
      {name ? (
        <ExplorerTooltipRow label="Name" value={name} copyText={name} valueClassName="font-medium" />
      ) : null}
      {username ? <ExplorerTooltipRow label="Username" value={username} /> : null}
      {email ? <ExplorerTooltipRow label="Email" value={email} /> : null}
    </>
  );
}
