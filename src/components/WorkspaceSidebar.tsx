import React from 'react';
import { Plus, LayoutGrid, FolderKanban, MessageSquare, HelpCircle, User, Shield } from 'lucide-react';
import { cn } from '../lib/utils';
import { useResizable } from '../hooks/useResizable';
import { HoverTooltip } from './HoverTooltip';
import { WorkspaceSidebarBrand } from './WorkspaceSidebarBrand';

export type WorkspaceNav = 'dashboard' | 'projects' | 'account' | 'admin';

interface WorkspaceSidebarProps {
  activeNav: WorkspaceNav;
  displayName: string;
  onCreateProject: () => void;
  onNavigate: (nav: WorkspaceNav) => void;
  onAiChat?: () => void;
  onHelp?: () => void;
  onAdmin?: () => void;
  /** Show Admin Manage link (ADMIN role only) */
  showAdminLink?: boolean;
}

const MAIN_NAV = [
  { id: 'dashboard' as const, label: 'Dashboard', icon: LayoutGrid },
  { id: 'projects' as const, label: 'Projects', icon: FolderKanban },
  { id: 'ai-chat' as const, label: 'Ai Chat', icon: MessageSquare },
];

const STORAGE_KEY = 'elementiq:workspace-sidebar';
const COLLAPSED_WIDTH = 64;
const EXPANDED_DEFAULT = 260;
const EXPANDED_MIN = 200;
const EXPANDED_MAX = 320;
const COLLAPSE_SNAP = 150;

function readSavedWidth(): number {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return EXPANDED_DEFAULT;
    const w = JSON.parse(raw)?.width;
    if (typeof w === 'number' && w >= COLLAPSED_WIDTH && w <= EXPANDED_MAX) return w;
  } catch {
    // ignore
  }
  return EXPANDED_DEFAULT;
}

function persistWidth(width: number): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ width }));
  } catch {
    // ignore quota / private mode
  }
}

function snapWidth(raw: number): number {
  if (raw <= COLLAPSE_SNAP) return COLLAPSED_WIDTH;
  if (raw < EXPANDED_MIN) return EXPANDED_MIN;
  return raw;
}

function NavButton({
  label,
  icon: Icon,
  active,
  collapsed,
  onClick,
}: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  active?: boolean;
  collapsed: boolean;
  onClick: () => void;
}) {
  const button = (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'w-full flex items-center rounded-md transition-colors text-sm',
        collapsed ? 'justify-center px-2 py-2.5' : 'gap-3 px-3 py-2.5',
        active
          ? 'bg-[#141414] text-white font-medium border border-[#262626]'
          : 'text-[#c4c4c4] hover:text-white hover:bg-[#141414]/60',
      )}
    >
      <Icon className="w-4 h-4 shrink-0" />
      {!collapsed && <span className="truncate">{label}</span>}
    </button>
  );

  if (!collapsed) return button;

  return (
    <HoverTooltip content={label} placement="right">
      {button}
    </HoverTooltip>
  );
}

export function WorkspaceSidebar({
  activeNav,
  displayName,
  onCreateProject,
  onNavigate,
  onAiChat,
  onHelp,
  onAdmin,
  showAdminLink = false,
}: WorkspaceSidebarProps) {
  const { width, setWidth, isDragging, handleMouseDown } = useResizable({
    initialWidth: readSavedWidth(),
    minWidth: COLLAPSED_WIDTH,
    maxWidth: EXPANDED_MAX,
    direction: 'left',
  });

  const isCollapsed = width <= COLLAPSED_WIDTH + 4;
  const wasDragging = React.useRef(false);

  React.useEffect(() => {
    if (wasDragging.current && !isDragging) {
      const snapped = snapWidth(width);
      if (snapped !== width) setWidth(snapped);
      persistWidth(snapped);
    }
    wasDragging.current = isDragging;
  }, [isDragging, width, setWidth]);

  const createButton = (
    <button
      type="button"
      onClick={onCreateProject}
      className={cn(
        'bg-[#00e676] hover:bg-[#00c968] text-black rounded-md font-semibold flex items-center justify-center transition-colors text-sm',
        isCollapsed ? 'w-10 h-10 mx-auto' : 'w-full px-4 py-2.5 gap-2',
      )}
    >
      <Plus className="w-4 h-4" />
      {!isCollapsed && 'Create New Project'}
    </button>
  );

  return (
    <div
      className={cn(
        'relative border-r border-[#1f1f1f] flex flex-col shrink-0 bg-[#0a0a0a]',
        !isDragging && 'transition-[width] duration-200 ease-out',
      )}
      style={{ width }}
    >
      <div
        onMouseDown={handleMouseDown}
        className={cn(
          'absolute top-0 right-[-3px] bottom-0 w-[6px] cursor-col-resize z-50 hover:bg-[#00e676]/40 transition-colors',
          isDragging && 'bg-[#00e676]/60',
        )}
      />

      <div className="relative border-b border-[#1f1f1f]">
        <div className="absolute inset-x-4 bottom-0 h-px bg-gradient-to-r from-transparent via-[#10b981]/25 to-transparent pointer-events-none" />
        {isCollapsed ? (
          <div className="px-2 py-3">
            <WorkspaceSidebarBrand collapsed />
          </div>
        ) : (
          <WorkspaceSidebarBrand collapsed={false} />
        )}
      </div>

      <div className={cn('pt-4 pb-3', isCollapsed ? 'px-2' : 'px-3')}>
        {isCollapsed ? (
          <HoverTooltip content="Create New Project" placement="right">
            {createButton}
          </HoverTooltip>
        ) : (
          createButton
        )}
      </div>

      <div className={cn('flex-1 overflow-y-auto py-2', isCollapsed ? 'px-2' : 'px-3')}>
        <div className="space-y-0.5">
          {MAIN_NAV.map((item) => (
            <NavButton
              key={item.label}
              label={item.label}
              icon={item.icon}
              collapsed={isCollapsed}
              active={item.id !== 'ai-chat' && activeNav === item.id}
              onClick={() => {
                if (item.id === 'ai-chat') {
                  onAiChat?.();
                  return;
                }
                onNavigate(item.id);
              }}
            />
          ))}
        </div>
      </div>

      <div className={cn('border-t border-[#1f1f1f] space-y-0.5', isCollapsed ? 'p-2' : 'p-3')}>
        <NavButton
          label="Help Center"
          icon={HelpCircle}
          collapsed={isCollapsed}
          onClick={() => onHelp?.()}
        />
        {showAdminLink && (
          <NavButton
            label="Admin Manage"
            icon={Shield}
            collapsed={isCollapsed}
            active={activeNav === 'admin'}
            onClick={() => (onAdmin ? onAdmin() : onNavigate('admin'))}
          />
        )}
        <NavButton
          label="Account"
          icon={User}
          collapsed={isCollapsed}
          active={activeNav === 'account'}
          onClick={() => onNavigate('account')}
        />
      </div>
    </div>
  );
}
