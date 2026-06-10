import React from 'react';
import { useAuth } from '../lib/auth-context';
import { getUserDisplayFromAuth } from '../lib/userDisplay';
import { cn } from '../lib/utils';
import { HoverTooltip } from './HoverTooltip';
import { UserTooltipContent } from './tooltipContent';

interface UserAvatarTooltipProps {
  userId?: string | null;
  displayName?: string | null;
  username?: string | null;
  email?: string | null;
  initials?: string;
  className?: string;
  size?: 'sm' | 'md';
}

function avatarInitials(displayName?: string | null, username?: string | null): string {
  const source = displayName?.trim() || username?.trim() || '?';
  return source.charAt(0).toUpperCase();
}

export function UserAvatarTooltip({
  userId,
  displayName,
  username,
  email,
  initials,
  className,
  size = 'sm',
}: UserAvatarTooltipProps) {
  const { user } = useAuth();
  const self = getUserDisplayFromAuth(user);
  const isSelf = Boolean(userId && self && userId === self.uid);

  const resolvedUserId = userId ?? self?.uid ?? '—';
  const resolvedName = isSelf ? self?.fullName : displayName;
  const resolvedUsername = isSelf ? self?.username : username;
  const resolvedEmail = isSelf ? self?.email : email;
  const resolvedInitials = initials ?? avatarInitials(resolvedName, resolvedUsername);

  const sizeClass =
    size === 'md'
      ? 'w-8 h-8 text-xs'
      : 'w-6 h-6 text-[10px]';

  return (
    <HoverTooltip
      stopBubble
      className="inline-flex shrink-0"
      content={
        <UserTooltipContent
          userId={resolvedUserId}
          name={resolvedName}
          username={resolvedUsername}
          email={resolvedEmail}
        />
      }
    >
      <div
        className={cn(
          'rounded-full bg-[#10b981] flex items-center justify-center font-bold text-white shrink-0 cursor-default',
          sizeClass,
          className,
        )}
      >
        {resolvedInitials}
      </div>
    </HoverTooltip>
  );
}
