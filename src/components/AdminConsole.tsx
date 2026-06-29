import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Activity,
  Eraser,
  FileStack,
  FolderKanban,
  LayoutDashboard,
  Monitor,
  RefreshCw,
  Server,
  Shield,
  Users,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useAdminProfile } from '../hooks/useAdminProfile';
import { ELEMENTIQ_ENGINE } from '../lib/engineBranding';
import { WorkspaceSidebar } from './WorkspaceSidebar';
import { UserProfileMenu } from './UserProfileMenu';
import type { AdminTab } from '../lib/adminApi';
import { AdminOverviewTab } from './admin/AdminOverviewTab';
import { AdminFilesTab } from './admin/AdminFilesTab';
import { AdminProjectsTab } from './admin/AdminProjectsTab';
import { AdminUsersTab } from './admin/AdminUsersTab';
import { AdminJobsTab } from './admin/AdminJobsTab';
import { AdminCleanupTab } from './admin/AdminCleanupTab';
import { AdminSystemTab } from './admin/AdminSystemTab';
import { AdminSessionsTab } from './admin/AdminSessionsTab';

const TABS: { id: AdminTab; label: string; icon: typeof LayoutDashboard }[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'projects', label: 'Projects', icon: FolderKanban },
  { id: 'files', label: 'Files', icon: FileStack },
  { id: 'users', label: 'Users', icon: Users },
  { id: 'sessions', label: 'Sessions', icon: Monitor },
  { id: 'jobs', label: 'Jobs', icon: Activity },
  { id: 'cleanup', label: 'Cleanup', icon: Eraser },
  { id: 'system', label: 'System', icon: Server },
];

const TAB_LABELS: Record<AdminTab, string> = {
  overview: 'Overview',
  files: 'Files',
  projects: 'Projects',
  users: 'Users',
  sessions: 'Sessions',
  jobs: 'Jobs',
  cleanup: 'Cleanup',
  system: 'System',
};

function parseTab(value: string | null): AdminTab {
  if (value && TABS.some((t) => t.id === value)) return value as AdminTab;
  return 'overview';
}

export function AdminConsole() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = parseTab(searchParams.get('tab'));
  const [refreshKey, setRefreshKey] = useState(0);
  const { profile, isSuperAdmin } = useAdminProfile();

  const displayName = profile?.full_name || profile?.username || 'Admin';
  const userEmail = profile?.email ?? null;

  const setTab = (tab: AdminTab) => {
    setSearchParams({ tab }, { replace: true });
  };

  const content = useMemo(() => {
    switch (activeTab) {
      case 'overview':
        return <AdminOverviewTab refreshKey={refreshKey} />;
      case 'files':
        return <AdminFilesTab refreshKey={refreshKey} />;
      case 'projects':
        return <AdminProjectsTab refreshKey={refreshKey} />;
      case 'users':
        return <AdminUsersTab refreshKey={refreshKey} isSuperAdmin={isSuperAdmin} />;
      case 'sessions':
        return <AdminSessionsTab refreshKey={refreshKey} />;
      case 'jobs':
        return <AdminJobsTab refreshKey={refreshKey} />;
      case 'cleanup':
        return <AdminCleanupTab refreshKey={refreshKey} />;
      case 'system':
        return <AdminSystemTab refreshKey={refreshKey} />;
      default:
        return null;
    }
  }, [activeTab, refreshKey, isSuperAdmin]);

  return (
    <div className="flex w-full h-screen overflow-hidden bg-[#0a0a0a] text-white">
      <WorkspaceSidebar
        activeNav="admin"
        displayName={displayName}
        userEmail={userEmail}
        showAdminLink
        showModelLabLink
        onCreateProject={() => navigate('/projects')}
        onNavigate={(nav) => {
          if (nav === 'dashboard') navigate('/');
          else if (nav === 'projects') navigate('/projects');
          else if (nav === 'account') navigate('/account');
          else if (nav === 'admin') navigate('/admin');
          else if (nav === 'model-lab') navigate('/model-lab');
        }}
        onAdmin={() => navigate('/admin')}
        onModelLab={() => navigate('/model-lab')}
        onHelp={() => {}}
      />

      <div className="flex-1 overflow-hidden flex flex-col">
        <header className="h-14 border-b border-[#1f1f1f] flex items-center justify-between px-6 shrink-0 bg-[#0a0a0a]">
          <div>
            <div className="flex items-center gap-2 text-white font-semibold">
              <Shield className="w-4 h-4 text-[#10b981]" />
              Admin Console
            </div>
            <p className="text-[11px] text-[#737373] mt-0.5">
              Element IQ / Admin / {TAB_LABELS[activeTab]}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-1.5 px-2 py-1 bg-[#141414] border border-[#262626] rounded text-[10px] text-[#b0b0b0] uppercase">
              {ELEMENTIQ_ENGINE}
            </div>
            <button
              type="button"
              onClick={() => setRefreshKey((k) => k + 1)}
              className="p-2 rounded-md text-[#b0b0b0] hover:text-white hover:bg-[#141414] transition-colors"
              title="Refresh"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <UserProfileMenu variant="workspace" />
          </div>
        </header>

        <div className="flex flex-1 overflow-hidden">
          <nav className="w-[220px] border-r border-[#1f1f1f] p-3 shrink-0 overflow-y-auto bg-[#0a0a0a]">
            <p className="text-[10px] uppercase tracking-wider text-[#737373] px-3 mb-2 font-medium">Manage</p>
            <div className="space-y-0.5">
              {TABS.map((tab) => {
                const Icon = tab.icon;
                const active = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setTab(tab.id)}
                    className={cn(
                      'w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-colors',
                      active
                        ? 'bg-[#141414] text-white font-medium border border-[#262626]'
                        : 'text-[#c4c4c4] hover:text-white hover:bg-[#141414]/60',
                    )}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </nav>

          <main className="flex-1 overflow-y-auto px-6 lg:px-8 py-7">{content}</main>
        </div>
      </div>
    </div>
  );
}
