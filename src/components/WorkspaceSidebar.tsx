import { Plus, LayoutGrid, FolderKanban, MessageSquare, HelpCircle, User } from 'lucide-react';
import { cn } from '../lib/utils';

export type WorkspaceNav = 'dashboard' | 'projects' | 'account';

interface WorkspaceSidebarProps {
  activeNav: WorkspaceNav;
  displayName: string;
  onCreateProject: () => void;
  onNavigate: (nav: WorkspaceNav) => void;
  onAiChat?: () => void;
  onHelp?: () => void;
}

const MAIN_NAV = [
  { id: 'dashboard' as const, label: 'Dashboard', icon: LayoutGrid },
  { id: 'projects' as const, label: 'Projects', icon: FolderKanban },
  { id: 'ai-chat' as const, label: 'Ai Chat', icon: MessageSquare },
];

export function WorkspaceSidebar({
  activeNav,
  displayName,
  onCreateProject,
  onNavigate,
  onAiChat,
  onHelp,
}: WorkspaceSidebarProps) {
  return (
    <div className="w-[240px] border-r border-[#1f1f1f] flex flex-col shrink-0 bg-[#0a0a0a]">
      <div className="px-4 py-5 border-b border-[#1f1f1f]">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-9 h-9 rounded-md bg-[#141414] border border-[#262626] flex items-center justify-center shrink-0">
            <FolderKanban className="w-4 h-4 text-[#00e676]" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white truncate">Element IQ</p>
            <p className="text-[11px] text-[#666] truncate">{displayName}</p>
          </div>
        </div>
      </div>

      <div className="px-3 pt-4 pb-3">
        <button
          type="button"
          onClick={onCreateProject}
          className="w-full bg-[#00e676] hover:bg-[#00c968] text-black px-4 py-2.5 rounded-md font-semibold flex items-center justify-center gap-2 transition-colors text-sm"
        >
          <Plus className="w-4 h-4" />
          Create New Project
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-2">
        <div className="space-y-0.5">
          {MAIN_NAV.map((item) => (
            <button
              key={item.label}
              type="button"
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2.5 rounded-md transition-colors text-sm',
                item.id !== 'ai-chat' && activeNav === item.id
                  ? 'bg-[#141414] text-white font-medium border border-[#262626]'
                  : 'text-[#888] hover:text-white hover:bg-[#141414]/60',
              )}
              onClick={() => {
                if (item.id === 'ai-chat') {
                  onAiChat?.();
                  return;
                }
                onNavigate(item.id);
              }}
            >
              <item.icon className="w-4 h-4 shrink-0" />
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className="border-t border-[#1f1f1f] p-3 space-y-0.5">
        <button
          type="button"
          onClick={onHelp}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm text-[#888] hover:text-white hover:bg-[#141414]/60 transition-colors"
        >
          <HelpCircle className="w-4 h-4" />
          Help Center
        </button>
        <button
          type="button"
          onClick={() => onNavigate('account')}
          className={cn(
            'w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors',
            activeNav === 'account'
              ? 'bg-[#141414] text-white font-medium border border-[#262626]'
              : 'text-[#888] hover:text-white hover:bg-[#141414]/60',
          )}
        >
          <User className="w-4 h-4" />
          Account
        </button>
      </div>
    </div>
  );
}
