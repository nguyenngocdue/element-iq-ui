import React, { useEffect, useRef, useState } from 'react';
import { LogOut } from 'lucide-react';
import { useAuth } from '../lib/auth-context';
import { getUserDisplayFromAuth } from '../lib/userDisplay';
import { cn } from '../lib/utils';
import { HoverTooltip } from './HoverTooltip';
import { UserTooltipContent } from './tooltipContent';

type UserProfileMenuVariant = 'editor' | 'workspace';

interface UserProfileMenuProps {
  variant?: UserProfileMenuVariant;
  className?: string;
}

export function UserProfileMenu({ variant = 'editor', className }: UserProfileMenuProps) {
  const { user, signOut } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const display = getUserDisplayFromAuth(user);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!user || !display) return null;

  const { username, fullName, email, uid, initials } = display;

  const avatarButtonClass =
    variant === 'workspace'
      ? 'w-8 h-8 rounded-full bg-[#10b981] flex items-center justify-center text-white text-xs font-bold hover:opacity-80 transition-opacity'
      : 'w-6 h-6 rounded-full bg-[#10b981] flex items-center justify-center text-white text-[11px] font-bold hover:opacity-80 transition-opacity';

  return (
    <div className={cn('relative', className)} ref={menuRef}>
      <HoverTooltip
        className="inline-flex"
        content={
          <UserTooltipContent
            userId={uid}
            name={fullName}
            username={username}
            email={email}
          />
        }
      >
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className={avatarButtonClass}
        >
          {initials}
        </button>
      </HoverTooltip>

      {isOpen && (
        <div className="absolute top-[calc(100%+6px)] right-0 w-[260px] bg-[#1e1e1e] border border-[#333] rounded-md shadow-2xl py-3 z-50">
          <div className="flex items-center gap-3 px-4 pb-3 border-b border-[#333]">
            <div className="w-9 h-9 rounded-full bg-[#10b981] flex items-center justify-center text-white text-[15px] font-bold shrink-0">
              {initials}
            </div>
            <div className="min-w-0">
              <div className="text-white text-[12px] font-semibold truncate">{fullName}</div>
              <div className="text-[#858585] text-[11px] truncate">{username}</div>
            </div>
          </div>

          <div className="px-4 py-2 space-y-2">
            <div>
              <div className="text-[#858585] text-[10px] uppercase tracking-wide mb-0.5">Email</div>
              <div className="text-[#cccccc] text-[11px] truncate">{email}</div>
            </div>
            <div>
              <div className="text-[#858585] text-[10px] uppercase tracking-wide mb-0.5">User ID</div>
              <div className="text-[#cccccc] text-[10px] font-mono break-all opacity-70">{uid}</div>
            </div>
          </div>

          <div className="border-t border-[#333] mt-2 pt-1">
            <button
              type="button"
              onClick={() => {
                signOut();
                setIsOpen(false);
              }}
              className="w-full flex items-center gap-2 px-4 py-1.5 text-[12px] text-[#f87171] hover:bg-[#2d2d2d] transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
