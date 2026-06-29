import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../lib/auth-context';
import { loginPath } from '../lib/authRoutes';
import { authFetch } from '../lib/supabase';
import { Search, ChevronDown, Plus, Bell, LayoutGrid, Box, FolderKanban, X, List, Pencil, Trash2, EllipsisVertical, Upload, BarChart3, Clock, Globe, Lock } from 'lucide-react';
import { cn } from '../lib/utils';
import { ConfirmDialog } from './ConfirmDialog';
import { WorkspaceSidebar } from './WorkspaceSidebar';
import { UserProfileMenu } from './UserProfileMenu';
import { ProjectNameTooltip, UserTooltipContent } from './tooltipContent';
import { HoverTooltip } from './HoverTooltip';
import { UserAvatarTooltip } from './UserAvatarTooltip';
import { useAdminProfile } from '../hooks/useAdminProfile';

import type { PublicAccessLevel } from '../types';
import { publicAccessLevelLabel } from '../lib/projectAccess';

interface ProjectItem {
  id: string;
  name: string;
  description?: string | null;
  is_archived: boolean;
  is_public?: boolean;
  public_access_level?: PublicAccessLevel;
  created_at: string;
  updated_at: string;
  created_by?: string | null;
  owner_id?: string | null;
  owner_username?: string | null;
  file_count?: number;
  artifact_count?: number;
  artifact_summary?: Record<string, number>;
  hasImage?: boolean;
}

interface ProjectDashboardProps {
  activeTab: 'dashboard' | 'projects';
}

const PROJECT_GRID_CLASS =
  'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 min-[1800px]:grid-cols-6 gap-4';

const BADGE_BASE =
  'inline-flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide px-2 py-0.5 rounded-sm border';

const STATUS_PUBLIC_CLASS =
  `${BADGE_BASE} text-[#5eead4] bg-[#14b8a6]/10 border-[#14b8a6]/25`;

const STATUS_PRIVATE_CLASS =
  `${BADGE_BASE} text-[#c4b5fd] bg-[#7c3aed]/10 border-[#7c3aed]/25`;

const STATUS_PUBLIC_HEADER_CLASS =
  `${BADGE_BASE} text-[#5eead4] bg-[#14b8a6]/20 border-[#14b8a6]/35`;

const STATUS_PRIVATE_HEADER_CLASS =
  `${BADGE_BASE} text-[#c4b5fd] bg-[#7c3aed]/20 border-[#7c3aed]/35`;

function VisibilityBadge({
  isPublic,
  variant = 'default',
  className,
}: {
  isPublic?: boolean;
  variant?: 'default' | 'header';
  className?: string;
}) {
  const isPub = Boolean(isPublic);
  const label = isPub ? 'Public' : 'Private';
  const badgeClass = variant === 'header'
    ? (isPub ? STATUS_PUBLIC_HEADER_CLASS : STATUS_PRIVATE_HEADER_CLASS)
    : (isPub ? STATUS_PUBLIC_CLASS : STATUS_PRIVATE_CLASS);
  const iconClass = isPub ? 'text-[#2dd4bf]' : 'text-[#a78bfa]';

  return (
    <span className={cn(badgeClass, 'shrink-0', className)}>
      {isPub
        ? <Globe className={cn('w-3 h-3', iconClass)} strokeWidth={2} />
        : <Lock className={cn('w-3 h-3', iconClass)} strokeWidth={2} />}
      {label}
    </span>
  );
}

const SORT_OPTIONS = [
  { value: 'recent' as const, label: 'Most Recent' },
  { value: 'alphabetical' as const, label: 'Alphabetical' },
  { value: 'oldest' as const, label: 'Oldest' },
];

function formatProjectDate(iso: string | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function formatFileCount(count: number | undefined): string {
  const n = count ?? 0;
  return n === 1 ? '1 file' : `${n} files`;
}

const ARTIFACT_TYPE_LABELS: Record<string, string> = {
  ANNOTATED_PNG: 'PNG',
  ANNOTATED_PDF: 'PDF',
  REPORT_JSON: 'JSON',
};

function formatArtifactTypeLabel(type: string): string {
  return ARTIFACT_TYPE_LABELS[type] || type.replace(/^ANNOTATED_|^REPORT_/, '');
}

function formatArtifactSummary(count: number | undefined, byType?: Record<string, number>): string {
  const n = count ?? 0;
  if (n === 0) return '0 artifacts';
  if (!byType || Object.keys(byType).length === 0) {
    return n === 1 ? '1 artifact' : `${n} artifacts`;
  }
  return Object.entries(byType)
    .sort(([, a], [, b]) => b - a)
    .map(([type, typeCount]) => `${typeCount} ${formatArtifactTypeLabel(type)}`)
    .join(' · ');
}

function formatRelativeTime(iso: string | undefined): string {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins} min${mins === 1 ? '' : 's'} ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`;
  return formatProjectDate(iso);
}

const PROJECT_THUMB_PALETTES = [
  { from: '#0f4c5c', to: '#1a7a6d' },
  { from: '#3d2c5e', to: '#5a4a8a' },
  { from: '#4a3728', to: '#8b5a3c' },
  { from: '#1e3a5f', to: '#2d5a8e' },
  { from: '#4a1942', to: '#7a2d6b' },
  { from: '#2d4a22', to: '#4a7a38' },
  { from: '#5c3d1e', to: '#8f5e2a' },
  { from: '#1a4a4a', to: '#2d7373' },
] as const;

function projectThumbPalette(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  }
  return PROJECT_THUMB_PALETTES[Math.abs(hash) % PROJECT_THUMB_PALETTES.length];
}

function filterSortProjects(
  projects: ProjectItem[],
  searchQuery: string,
  sortBy: 'alphabetical' | 'recent' | 'oldest',
): ProjectItem[] {
  let result = projects.filter((p) =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()),
  );
  switch (sortBy) {
    case 'alphabetical':
      result.sort((a, b) => a.name.localeCompare(b.name));
      break;
    case 'recent':
      result.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
      break;
    case 'oldest':
      result.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      break;
  }
  return result;
}

function projectShareUrl(projectId: string): string {
  return `${window.location.origin}/projects/${projectId}`;
}

async function copyTextToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(textarea);
      return ok;
    } catch {
      return false;
    }
  }
}

function ProjectCard({
  project: p,
  cardMenuId,
  setCardMenuId,
  onOpen,
  onEdit,
  onDelete,
  onToggleVisibility,
  onSetAccessLevel,
  canManage,
}: {
  project: ProjectItem;
  cardMenuId: string | null;
  setCardMenuId: React.Dispatch<React.SetStateAction<string | null>>;
  onOpen: (p: ProjectItem) => void;
  onEdit: (p: ProjectItem, e: React.MouseEvent) => void;
  onDelete: (id: string, e: React.MouseEvent) => void;
  onToggleVisibility: (p: ProjectItem, e: React.MouseEvent) => void;
  onSetAccessLevel: (p: ProjectItem, level: PublicAccessLevel, e: React.MouseEvent) => void;
  canManage: boolean;
}) {
  const thumbColors = projectThumbPalette(p.id || p.name);
  const fileCount = p.file_count ?? 0;
  const artifactCount = p.artifact_count ?? 0;

  return (
    <div
      onClick={() => onOpen(p)}
      className={cn(
        'group relative bg-[#141414] border border-[#262626] rounded-lg cursor-pointer hover:border-[#14b8a6]/30 hover:shadow-[0_12px_32px_rgba(0,0,0,0.35)] transition-all duration-200 flex flex-col',
        cardMenuId === p.id && 'z-30',
      )}
    >
      <div className={cn(
        'relative h-[52px] shrink-0 rounded-t-lg border-b border-[#262626]/60',
        cardMenuId === p.id ? 'z-20' : 'z-10',
      )}>
        <div className="absolute inset-0 overflow-hidden rounded-t-lg pointer-events-none">
          <div
            className="absolute inset-0"
            style={{ background: `linear-gradient(135deg, ${thumbColors.from} 0%, ${thumbColors.to} 100%)` }}
          />
          <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(255,255,255,0.06),rgba(0,0,0,0.35))]" />
        </div>
        <div className="relative z-10 flex items-center justify-between gap-2 px-3.5 h-full">
          <FolderKanban className="w-3.5 h-3.5 text-white/60 shrink-0" strokeWidth={1.75} />
          <div className="flex items-center gap-1.5 shrink-0 ml-auto">
            <VisibilityBadge isPublic={p.is_public} variant="header" />
            {canManage && (
            <div className="relative z-20">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setCardMenuId(prev => (prev === p.id ? null : p.id));
                }}
                className="p-1 rounded-md text-white/70 hover:text-white hover:bg-black/30 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                aria-label="Project actions"
              >
                <EllipsisVertical className="w-4 h-4" />
              </button>
              {cardMenuId === p.id && (
                <div
                  className="absolute right-0 top-full mt-1.5 z-[100] min-w-[148px] py-1 bg-[#1a1a1a] border border-[#333] rounded-lg shadow-xl"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    type="button"
                    onClick={(e) => { setCardMenuId(null); onToggleVisibility(p, e); }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-[#ccc] hover:bg-[#262626] hover:text-white transition-colors"
                  >
                    {p.is_public
                      ? <Lock className="w-3.5 h-3.5 text-[#a78bfa]" />
                      : <Globe className="w-3.5 h-3.5 text-[#2dd4bf]" />}
                    {p.is_public ? 'Make Private' : 'Make Public'}
                  </button>
                  {p.is_public && (
                    <>
                      <div className="my-1 border-t border-[#333]" />
                      <p className="px-3 py-1 text-[10px] uppercase tracking-wide text-[#666]">Guest access</p>
                      {(['view', 'run', 'run_download'] as PublicAccessLevel[]).map((level) => (
                        <button
                          key={level}
                          type="button"
                          onClick={(e) => { setCardMenuId(null); onSetAccessLevel(p, level, e); }}
                          className={cn(
                            'w-full flex items-center gap-2 px-3 py-2 text-xs transition-colors',
                            (p.public_access_level ?? 'view') === level
                              ? 'text-[#5eead4] bg-[#14b8a6]/10'
                              : 'text-[#ccc] hover:bg-[#262626] hover:text-white',
                          )}
                        >
                          {publicAccessLevelLabel(level)}
                        </button>
                      ))}
                    </>
                  )}
                  <button
                    type="button"
                    onClick={(e) => { setCardMenuId(null); onEdit(p, e); }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-[#ccc] hover:bg-[#262626] hover:text-white transition-colors"
                  >
                    <Pencil className="w-3.5 h-3.5 text-[#94a3b8]" />
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={(e) => { setCardMenuId(null); onDelete(p.id, e); }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-[#ef4444]/90 hover:bg-[#ef4444]/10 hover:text-[#ef4444] transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Delete
                  </button>
                </div>
              )}
            </div>
            )}
          </div>
        </div>
      </div>

      <div className="relative z-0 flex flex-col flex-1 p-4 gap-2.5 rounded-b-lg">
        <ProjectNameTooltip
          id={p.id}
          name={p.name}
          description={p.description}
          className="min-w-0"
        >
          <h3 className="text-[15px] font-semibold text-white leading-snug truncate group-hover:text-[#5eead4] transition-colors cursor-default">
            {p.name}
          </h3>
        </ProjectNameTooltip>

        <p className={cn(
          'text-xs leading-relaxed whitespace-pre-wrap break-words',
          p.description?.trim() ? 'text-[#c4c4c4]' : 'text-[#909090]',
        )}>
          {p.description?.trim() || 'No description provided.'}
        </p>

        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-[#d1d1d1]">
          <span className="inline-flex items-center gap-1 tabular-nums">
            <Upload className="w-3 h-3 text-[#b0b0b0]" />
            {formatFileCount(fileCount)}
          </span>
          <span className="text-[#333]">·</span>
          <span className="inline-flex items-center gap-1 tabular-nums">
            <Box className="w-3 h-3 text-[#b0b0b0]" />
            {artifactCount === 1 ? '1 artifact' : `${artifactCount} artifacts`}
          </span>
        </div>

        <div className="mt-auto flex items-center justify-between gap-3 pt-3 border-t border-[#1f1f1f]">
          <div className="flex items-center gap-2 min-w-0">
            <UserAvatarTooltip
              userId={p.owner_id}
              displayName={p.created_by}
              username={p.owner_username}
              size="sm"
            />
            <HoverTooltip
              stopBubble
              className="min-w-0"
              content={
                <UserTooltipContent
                  userId={p.owner_id ?? '—'}
                  name={p.created_by}
                  username={p.owner_username}
                />
              }
            >
              <span className="text-[11px] text-[#d1d1d1] truncate cursor-default">
                {p.created_by || 'Unknown'}
              </span>
            </HoverTooltip>
          </div>
          <span className="text-[10px] text-[#b0b0b0] shrink-0 tabular-nums uppercase tracking-wide">
            {formatProjectDate(p.created_at)}
          </span>
        </div>
      </div>
    </div>
  );
}

export function ProjectDashboard({ activeTab }: ProjectDashboardProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading: authLoading } = useAuth();
  const { isAdmin } = useAdminProfile();
  const [myProjects, setMyProjects] = useState<ProjectItem[]>([]);
  const [communityProjects, setCommunityProjects] = useState<ProjectItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newProjectName, setNewProjectName] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [sortBy, setSortBy] = useState<'alphabetical' | 'recent' | 'oldest'>('recent');
  const [searchQuery, setSearchQuery] = useState('');
  const [cardMenuId, setCardMenuId] = useState<string | null>(null);
  const [sortMenuOpen, setSortMenuOpen] = useState(false);

  const goToTab = (tab: 'dashboard' | 'projects') => {
    navigate(tab === 'dashboard' ? '/' : '/projects');
  };

  const handleWorkspaceNavigate = (nav: 'dashboard' | 'projects' | 'account' | 'admin') => {
    if (nav === 'account') {
      if (!user) {
        navigate(loginPath('/account'));
        return;
      }
      navigate('/account');
      return;
    }
    if (nav === 'admin') {
      if (!user) {
        navigate(loginPath('/admin'));
        return;
      }
      navigate('/admin');
      return;
    }
    goToTab(nav);
  };

  const redirectToLogin = (returnTo?: string) => {
    navigate(loginPath(returnTo ?? `${location.pathname}${location.search}`));
  };

  const promptSignInForAction = () => {
    redirectToLogin(`${location.pathname}${location.search}`);
  };

  const filteredMyProjects = useMemo(
    () => filterSortProjects(myProjects, searchQuery, sortBy),
    [myProjects, searchQuery, sortBy],
  );
  const filteredMyPrivate = useMemo(
    () => filteredMyProjects.filter((p) => !p.is_public),
    [filteredMyProjects],
  );
  const filteredMyPublic = useMemo(
    () => filteredMyProjects.filter((p) => p.is_public),
    [filteredMyProjects],
  );
  const filteredCommunity = useMemo(
    () => filterSortProjects(communityProjects, searchQuery, sortBy),
    [communityProjects, searchQuery, sortBy],
  );

  const workspaceStats = useMemo(() => {
    const totalFiles = myProjects.reduce((sum, p) => sum + (p.file_count ?? 0), 0);
    const withFiles = myProjects.filter(p => (p.file_count ?? 0) > 0).length;
    const utilization = myProjects.length ? Math.round((withFiles / myProjects.length) * 100) : 0;
    return { totalProjects: myProjects.length, totalFiles, withFiles, utilization };
  }, [myProjects]);

  const recentProjects = useMemo(() => {
    return [...myProjects]
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
      .slice(0, 8);
  }, [myProjects]);

  const displayName = user?.user_metadata?.username || user?.email?.split('@')[0] || 'Guest';
  const userEmail = user?.email ?? null;

  // ── Load projects from API ────────────────────────────────
  useEffect(() => {
    if (authLoading) return;
    if (activeTab === 'dashboard') {
      void loadDashboard();
      return;
    }
    if (!user) {
      setMyProjects([]);
      setCommunityProjects([]);
      setLoading(false);
      setError(null);
      return;
    }
    void loadMyProjects();
  }, [user, authLoading, activeTab]);

  async function loadDashboard() {
    setLoading(true);
    setError(null);
    try {
      const requests: Promise<Response>[] = [authFetch('/api/v1/projects/public')];
      if (user) {
        requests.push(authFetch('/api/v1/projects'));
      }

      const [publicRes, myRes] = await Promise.all(requests);

      if (!publicRes.ok) {
        const detail = await publicRes.json().catch(() => ({}));
        throw new Error(typeof detail.detail === 'string' ? detail.detail : `HTTP ${publicRes.status}`);
      }

      const publicData = await publicRes.json();
      const publicList = publicData.map((p: ProjectItem) => ({ ...p, hasImage: false }));

      if (user && myRes) {
        if (!myRes.ok) {
          const detail = await myRes.json().catch(() => ({}));
          if (myRes.status === 502) {
            throw new Error(
              'HTTP 502 — backend không phản hồi. Chạy ./deploy.sh doctor và forward tunnel tới port 3080.',
            );
          }
          throw new Error(typeof detail.detail === 'string' ? detail.detail : `HTTP ${myRes.status}`);
        }
        const myData = await myRes.json();
        const myList = myData.map((p: ProjectItem) => ({ ...p, hasImage: false }));
        const myIds = new Set(myList.map((p: ProjectItem) => p.id));
        setMyProjects(myList);
        setCommunityProjects(publicList.filter((p: ProjectItem) => !myIds.has(p.id)));
      } else {
        setMyProjects([]);
        setCommunityProjects(publicList);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load projects');
      setMyProjects([]);
      setCommunityProjects([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!cardMenuId && !sortMenuOpen) return;
    const closeMenus = () => {
      setCardMenuId(null);
      setSortMenuOpen(false);
    };
    document.addEventListener('click', closeMenus);
    return () => document.removeEventListener('click', closeMenus);
  }, [cardMenuId, sortMenuOpen]);

  async function loadMyProjects() {
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch('/api/v1/projects');
      if (!res.ok) {
        const detail = await res.json().catch(() => ({}));
        if (res.status === 502) {
          throw new Error(
            'HTTP 502 — backend không phản hồi. Chạy ./deploy.sh doctor và forward tunnel tới port 3080.',
          );
        }
        throw new Error(typeof detail.detail === 'string' ? detail.detail : `HTTP ${res.status}`);
      }
      const data = await res.json();
      setMyProjects(data.map((p: ProjectItem) => ({ ...p, hasImage: false })));
    } catch (err: any) {
      setError(err.message || 'Failed to load projects');
      setMyProjects([]);
    } finally {
      setLoading(false);
    }
  }

  const patchProjectInLists = (projectId: string, patch: Partial<ProjectItem>) => {
    setMyProjects((prev) => prev.map((p) => (p.id === projectId ? { ...p, ...patch } : p)));
    setCommunityProjects((prev) => prev.filter((p) => p.id !== projectId));
  };

  const removeProjectFromLists = (projectId: string) => {
    setMyProjects((prev) => prev.filter((p) => p.id !== projectId));
    setCommunityProjects((prev) => prev.filter((p) => p.id !== projectId));
  };

  const handleToggleVisibility = async (project: ProjectItem, e: React.MouseEvent) => {
    e.stopPropagation();
    const nextPublic = !project.is_public;
    try {
      const res = await authFetch(`/api/v1/projects/${project.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_public: nextPublic }),
      });
      if (!res.ok) throw new Error('Failed to update visibility');
      const updated = await res.json();
      patchProjectInLists(project.id, updated);
      if (nextPublic) {
        const shareUrl = projectShareUrl(project.id);
        const copied = await copyTextToClipboard(shareUrl);
        showToast(
          copied
            ? 'Public link copied — paste and share anywhere'
            : `Now public. Share: ${shareUrl}`,
        );
      } else {
        showToast(`"${project.name}" is now private`);
      }
    } catch (err) {
      console.error('Toggle visibility error:', err);
      showToast('Failed to update project visibility');
    }
  };

  const handleSetPublicAccessLevel = async (
    project: ProjectItem,
    level: PublicAccessLevel,
    e: React.MouseEvent,
  ) => {
    e.stopPropagation();
    try {
      const res = await authFetch(`/api/v1/projects/${project.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_public: true, public_access_level: level }),
      });
      if (!res.ok) throw new Error('Failed to update sharing level');
      const updated = await res.json();
      patchProjectInLists(project.id, updated);
      showToast(`Guest access: ${publicAccessLevelLabel(level)}`);
    } catch (err) {
      console.error('Set access level error:', err);
      showToast('Failed to update guest access level');
    }
  };

  const canManageProject = (project: ProjectItem) =>
    Boolean(user?.id && project.owner_id === user.id);

  const handleOpenProject = (project: ProjectItem) => {
    navigate(`/projects/${project.id}`);
  };

  const [editingProject, setEditingProject] = useState<ProjectItem | null>(null);

  const handleEditProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName.trim() || !editingProject) return;

    try {
      const res = await authFetch(`/api/v1/projects/${editingProject.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newProjectName }),
      });
      if (!res.ok) throw new Error('Failed to update');
      const updated = await res.json();
      patchProjectInLists(editingProject.id, updated);
    } catch (err) {
      console.error('Edit project error:', err);
    }
    setEditingProject(null);
    setNewProjectName('');
  };

  const [deleteTarget, setDeleteTarget] = useState<ProjectItem | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const handleDeleteProject = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const project = myProjects.find(p => p.id === id);
    if (project) setDeleteTarget(project);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      const res = await authFetch(`/api/v1/projects/${deleteTarget.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
      const data = await res.json();
      removeProjectFromLists(deleteTarget.id);
      showToast(`Deleted: ${data.deleted_files} file(s), ${data.deleted_jobs} job(s) removed`);
    } catch (err) {
      console.error('Delete project error:', err);
      showToast('Failed to delete project');
    } finally {
      setDeleteLoading(false);
      setDeleteTarget(null);
    }
  };

  const openEditModal = (project: ProjectItem, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingProject(project);
    setNewProjectName(project.name);
  };

  const [createDescription, setCreateDescription] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName.trim()) return;
    setCreateError(null);

    try {
      const res = await authFetch('/api/v1/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newProjectName, description: createDescription || null }),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => null);
        if (res.status === 502) {
          throw new Error(
            'HTTP 502 — backend không phản hồi. Chạy ./deploy.sh doctor; tunnel phải trỏ port 3080.',
          );
        }
        const detail = errBody?.detail || `HTTP ${res.status}`;
        throw new Error(detail);
      }
      const created = await res.json();
      setMyProjects(prev => [{ ...created, hasImage: false }, ...prev]);
      setIsCreateModalOpen(false);
      setNewProjectName('');
      setCreateDescription('');
    } catch (err: any) {
      console.error('Create project error:', err);
      setCreateError(err.message || 'Failed to create project');
    }
  };

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const sortLabel = SORT_OPTIONS.find(o => o.value === sortBy)?.label ?? 'Most Recent';

  const renderProjectsContent = (
    projectList: ProjectItem[],
    emptyMessage: string,
    showCreateOnEmpty = false,
  ) => {
    if (loading) {
      return (
        <div className={PROJECT_GRID_CLASS}>
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="bg-[#141414] border border-[#262626] rounded-lg h-[220px] animate-pulse" />
          ))}
        </div>
      );
    }

    if (viewMode === 'grid') {
      if (projectList.length === 0) {
        return (
          <div className="bg-[#141414] border border-[#262626] rounded-lg py-12 text-center">
            <FolderKanban className="w-10 h-10 text-[#333] mx-auto mb-3" />
            <p className="text-[#b0b0b0] text-sm">{emptyMessage}</p>
            {showCreateOnEmpty && (
              <button
                type="button"
                onClick={() => (user ? setIsCreateModalOpen(true) : promptSignInForAction())}
                className="mt-4 text-sm text-[#00e676] hover:underline"
              >
                {user ? 'Create your first project' : 'Sign In'}
              </button>
            )}
          </div>
        );
      }

      return (
        <div className={cn(PROJECT_GRID_CLASS, 'pb-2')}>
          {projectList.map(p => (
            <ProjectCard
              key={p.id}
              project={p}
              cardMenuId={cardMenuId}
              setCardMenuId={setCardMenuId}
              onOpen={handleOpenProject}
              onEdit={openEditModal}
              onDelete={handleDeleteProject}
            onToggleVisibility={handleToggleVisibility}
            onSetAccessLevel={handleSetPublicAccessLevel}
            canManage={canManageProject(p)}
            />
          ))}
        </div>
      );
    }

    if (projectList.length === 0) {
      return (
        <div className="bg-[#141414] border border-[#262626] rounded-lg py-12 text-center mb-8">
          <p className="text-[#b0b0b0] text-sm">{emptyMessage}</p>
        </div>
      );
    }

    return (
      <div className="flex flex-col border border-[#262626] rounded-lg overflow-visible bg-[#141414] mb-2">
        <div className="flex items-center px-4 py-2.5 border-b border-[#262626] bg-[#0a0a0a] text-[10px] font-semibold uppercase tracking-widest text-[#a3a3a3]">
          <div className="flex-[1.2] min-w-0">Project</div>
          <div className="w-36 shrink-0">Created by</div>
          <div className="w-32 shrink-0">Created</div>
          <div className="w-20 shrink-0">Files</div>
          <div className="flex-1 min-w-0 hidden lg:block">Description</div>
          <div className="w-36 shrink-0 text-center">Visibility</div>
        </div>
        <div className="flex flex-col divide-y divide-[#1f1f1f]">
          {projectList.map(p => (
            <div
              key={p.id}
              onClick={() => handleOpenProject(p)}
              className={cn(
                'flex items-center px-4 py-3 hover:bg-[#1a1a1a] cursor-pointer transition-colors group',
                cardMenuId === p.id && 'relative z-30',
              )}
            >
              <div className="flex-[1.2] min-w-0 flex items-center gap-3">
                <div
                  className="w-8 h-8 shrink-0 rounded-sm border border-[#262626]/80"
                  style={{
                    background: (() => {
                      const c = projectThumbPalette(p.id || p.name);
                      return `linear-gradient(135deg, ${c.from} 0%, ${c.to} 100%)`;
                    })(),
                  }}
                />
                <ProjectNameTooltip id={p.id} name={p.name} description={p.description}>
                  <span className="text-sm font-semibold text-white truncate group-hover:text-[#5eead4] transition-colors cursor-default">
                    {p.name}
                  </span>
                </ProjectNameTooltip>
              </div>
              <div className="w-36 shrink-0 text-xs text-[#d1d1d1] min-w-0 flex items-center gap-2">
                <UserAvatarTooltip
                  userId={p.owner_id}
                  displayName={p.created_by}
                  username={p.owner_username}
                  size="sm"
                />
                <HoverTooltip
                  stopBubble
                  className="min-w-0 flex-1"
                  content={
                    <UserTooltipContent
                      userId={p.owner_id ?? '—'}
                      name={p.created_by}
                      username={p.owner_username}
                    />
                  }
                >
                  <span className="truncate block">{p.created_by || 'Unknown'}</span>
                </HoverTooltip>
              </div>
              <div className="w-32 shrink-0 text-xs text-[#d1d1d1] tabular-nums">{formatProjectDate(p.created_at)}</div>
              <div className="w-20 shrink-0 text-xs text-[#d1d1d1] tabular-nums">{p.file_count ?? 0}</div>
              <div className="flex-1 min-w-0 hidden lg:block text-xs text-[#b0b0b0] italic truncate pr-4">
                {p.description?.trim() || 'No description'}
              </div>
              <div className="w-36 shrink-0 flex items-center justify-center gap-2">
                <VisibilityBadge isPublic={p.is_public} />
                {canManageProject(p) && (
                <div className="relative z-20">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setCardMenuId(prev => (prev === p.id ? null : p.id));
                    }}
                    className="p-1 rounded-md text-[#b0b0b0] hover:text-white hover:bg-[#262626] opacity-0 group-hover:opacity-100 transition-all"
                    aria-label="Project actions"
                  >
                    <EllipsisVertical className="w-3.5 h-3.5" />
                  </button>
                  {cardMenuId === p.id && (
                    <div
                      className="absolute right-0 top-full mt-1 z-[100] min-w-[148px] py-1 bg-[#1a1a1a] border border-[#333] rounded-xl shadow-xl"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button type="button" onClick={(e) => { setCardMenuId(null); handleToggleVisibility(p, e); }} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-[#ccc] hover:bg-[#262626] hover:text-white transition-colors">
                        {p.is_public ? <Lock className="w-3.5 h-3.5 text-[#a78bfa]" /> : <Globe className="w-3.5 h-3.5 text-[#2dd4bf]" />}
                        {p.is_public ? 'Make Private' : 'Make Public'}
                      </button>
                      <button type="button" onClick={(e) => { setCardMenuId(null); openEditModal(p, e); }} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-[#ccc] hover:bg-[#262626] hover:text-white transition-colors">
                        <Pencil className="w-3.5 h-3.5 text-[#94a3b8]" /> Edit
                      </button>
                      <button type="button" onClick={(e) => { setCardMenuId(null); handleDeleteProject(p.id, e); }} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-[#ef4444]/90 hover:bg-[#ef4444]/10 hover:text-[#ef4444] transition-colors">
                        <Trash2 className="w-3.5 h-3.5" /> Delete
                      </button>
                    </div>
                  )}
                </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderDashboardSection = (
    title: string,
    description: string,
    icon: React.ReactNode,
    projectList: ProjectItem[],
    emptyMessage: string,
    options?: { showCreateOnEmpty?: boolean; hideWhenEmpty?: boolean },
  ) => {
    if (options?.hideWhenEmpty && !loading && projectList.length === 0) return null;

    return (
      <section className="mb-10">
        <div className="flex items-start gap-3 mb-4">
          <div className="p-2 rounded-md bg-[#141414] border border-[#262626] shrink-0">
            {icon}
          </div>
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-white">{title}</h2>
            <p className="text-sm text-[#b0b0b0]">{description}</p>
          </div>
          <span className="ml-auto text-[11px] text-[#a3a3a3] tabular-nums shrink-0 pt-1">
            {loading ? '…' : `${projectList.length} project${projectList.length === 1 ? '' : 's'}`}
          </span>
        </div>
        {renderProjectsContent(projectList, emptyMessage, options?.showCreateOnEmpty)}
      </section>
    );
  };

  const latestProject = filteredMyProjects[0] ?? filteredCommunity[0];

  const projectsToolbar = (
    <div className="flex items-center justify-end mb-6">
      <div className="inline-flex items-center bg-[#141414] border border-[#262626] rounded-md p-1 gap-1">
        <div className="flex items-center p-0.5">
          <button
            type="button"
            onClick={() => setViewMode('grid')}
            className={cn(
              'p-1.5 rounded-sm transition-colors',
              viewMode === 'grid' ? 'bg-[#262626] text-white' : 'text-[#b0b0b0] hover:text-[#ccc]',
            )}
            aria-label="Grid view"
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setViewMode('list')}
            className={cn(
              'p-1.5 rounded-sm transition-colors',
              viewMode === 'list' ? 'bg-[#262626] text-white' : 'text-[#b0b0b0] hover:text-[#ccc]',
            )}
            aria-label="List view"
          >
            <List className="w-4 h-4" />
          </button>
        </div>

        <div className="w-px h-6 bg-[#262626] shrink-0" />

        <div className="relative">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setSortMenuOpen(open => !open);
            }}
            className={cn(
              'flex items-center gap-2 rounded-sm px-2.5 py-1.5 text-sm transition-colors min-w-[132px]',
              sortMenuOpen
                ? 'bg-[#262626] text-white'
                : 'text-[#d1d1d1] hover:bg-[#1a1a1a] hover:text-white',
            )}
          >
            <span className="flex-1 text-left text-[13px]">{sortLabel}</span>
            <ChevronDown className={cn('w-3.5 h-3.5 text-[#b0b0b0] shrink-0 transition-transform', sortMenuOpen && 'rotate-180')} />
          </button>
          {sortMenuOpen && (
            <div
              className="absolute right-0 top-full mt-1 z-30 w-full min-w-[148px] py-1 bg-[#1a1a1a] border border-[#333] rounded-md shadow-lg"
              onClick={(e) => e.stopPropagation()}
            >
              {SORT_OPTIONS.map(option => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    setSortBy(option.value);
                    setSortMenuOpen(false);
                  }}
                  className={cn(
                    'w-full text-left px-3 py-2 text-[13px] transition-colors',
                    sortBy === option.value
                      ? 'text-[#5eead4] bg-[#14b8a6]/10'
                      : 'text-[#999] hover:bg-[#262626] hover:text-white',
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const projectsContent = renderProjectsContent(
    filteredMyProjects,
    user ? 'No projects found' : 'Sign in to view and manage your projects.',
    Boolean(user),
  );

  return (
    <div className="flex w-full h-screen overflow-hidden bg-[#0a0a0a] text-white">
      <WorkspaceSidebar
        activeNav={activeTab}
        displayName={displayName}
        userEmail={userEmail}
        onCreateProject={() => {
          if (!user) {
            promptSignInForAction();
            return;
          }
          setIsCreateModalOpen(true);
        }}
        onNavigate={handleWorkspaceNavigate}
        onAiChat={() => showToast('Feature in development')}
        onHelp={() => showToast('Help Center coming soon')}
        onAdmin={() => navigate('/admin')}
        showAdminLink={isAdmin}
      />

      {/* Main Content */}
      <div className="flex-1 overflow-hidden flex flex-col bg-[#0a0a0a]">
        {/* Top bar */}
        <header className="h-14 border-b border-[#1f1f1f] flex items-center px-6 gap-4 shrink-0 bg-[#0a0a0a]">
          <div className="flex-1 relative max-w-2xl">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#a3a3a3]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search projects, files..."
              className="w-full bg-[#141414] border border-[#262626] rounded-md pl-10 pr-4 py-2 text-sm text-white placeholder-[#999] focus:outline-none focus:border-[#00e676]/40 transition-colors"
            />
          </div>

          <div className="flex items-center gap-2 shrink-0 ml-auto">
            <button type="button" className="p-2 rounded-md text-[#b0b0b0] hover:text-white hover:bg-[#141414] transition-colors">
              <Bell className="w-4 h-4" />
            </button>
            {user ? (
              <UserProfileMenu variant="workspace" />
            ) : (
              <button
                type="button"
                onClick={() => redirectToLogin()}
                className="px-3 py-1.5 rounded-md bg-[#10b981] hover:bg-[#059669] text-white text-sm font-semibold transition-colors"
              >
                Sign In
              </button>
            )}
          </div>
        </header>

        <div className="flex-1 overflow-y-auto">
          <div className="w-full px-6 lg:px-8 py-7">
            {/* Page header */}
            <div className="mb-7">
              {activeTab === 'dashboard' ? (
                <>
                  <h1 className="text-2xl font-semibold text-white mb-1">Dashboard</h1>
                  <p className="text-sm text-[#b0b0b0]">
                    {user ? (
                      <>
                        {filteredMyPrivate.length} private · {filteredMyPublic.length} public · {filteredCommunity.length} community
                        {' '}project{(filteredMyPrivate.length + filteredMyPublic.length + filteredCommunity.length) === 1 ? '' : 's'}
                      </>
                    ) : (
                      <>
                        {filteredCommunity.length} public project{filteredCommunity.length === 1 ? '' : 's'} shared by the community
                      </>
                    )}
                  </p>
                </>
              ) : (
                <>
                  <h1 className="text-2xl font-semibold text-white mb-1">All Projects</h1>
                  <p className="text-sm text-[#b0b0b0]">
                    {filteredMyProjects.length} project{filteredMyProjects.length === 1 ? '' : 's'} in your workspace.
                  </p>
                </>
              )}
            </div>

            {error && (
              <div className="mb-6 bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-xl text-sm">
                {error}
              </div>
            )}

            {!user && !authLoading && (
              <div className="mb-6 rounded-lg border border-[#14b8a6]/25 bg-[#14b8a6]/10 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-[#d1d1d1]">
                  You are browsing as a guest. Public projects are view-only. Sign in to create and manage your own projects.
                </p>
                <button
                  type="button"
                  onClick={() => redirectToLogin()}
                  className="shrink-0 px-4 py-2 rounded-md bg-[#10b981] hover:bg-[#059669] text-white text-sm font-semibold transition-colors"
                >
                  Sign In
                </button>
              </div>
            )}

            {activeTab === 'dashboard' && (
              <>
            {/* Summary widgets */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-8">
              {/* Featured / latest project */}
              <div className="bg-[#141414] border border-[#262626] rounded-lg p-5 min-h-[160px] flex flex-col">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-[#a3a3a3] mb-3">Latest Project</p>
                {loading ? (
                  <div className="flex-1 animate-pulse space-y-2">
                    <div className="h-8 bg-[#262626] rounded w-12" />
                    <div className="h-4 bg-[#262626] rounded w-2/3" />
                  </div>
                ) : latestProject ? (
                  (() => {
                    const latest = latestProject;
                    return (
                      <button
                        type="button"
                        onClick={() => handleOpenProject(latest)}
                        className="flex-1 text-left group"
                      >
                        <p className="text-lg font-semibold text-white group-hover:text-[#5eead4] transition-colors truncate mb-2">
                          {latest.name}
                        </p>
                        <p className="text-[11px] text-[#b0b0b0] truncate">
                          {formatFileCount(latest.file_count)} · Updated {formatRelativeTime(latest.updated_at)}
                        </p>
                      </button>
                    );
                  })()
                ) : (
                  <div className="flex-1 flex flex-col justify-center gap-3">
                    <p className="text-sm text-[#a3a3a3]">
                      {user ? 'No projects yet. Create one to get started.' : 'Sign in to create and manage your projects.'}
                    </p>
                    {!user && (
                      <button
                        type="button"
                        onClick={() => redirectToLogin('/')}
                        className="self-start px-3 py-1.5 rounded-md border border-[#14b8a6]/30 text-[#5eead4] hover:bg-[#14b8a6]/10 text-sm font-medium transition-colors"
                      >
                        Sign In
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Drawing files summary */}
              <div className="bg-[#141414] border border-[#262626] rounded-lg p-5 min-h-[160px] flex flex-col">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-[#a3a3a3] mb-3">Drawing Files</p>
                <div className="flex items-baseline gap-2 mb-3">
                  <span className="text-3xl font-bold text-white tabular-nums">{workspaceStats.totalFiles}</span>
                  <span className="text-sm text-[#b0b0b0]">/ {workspaceStats.totalProjects} project{workspaceStats.totalProjects === 1 ? '' : 's'}</span>
                </div>
                <div className="h-1.5 bg-[#262626] rounded-full overflow-hidden mb-2">
                  <div
                    className="h-full bg-[#00e676] rounded-full transition-all duration-500"
                    style={{ width: `${workspaceStats.utilization}%` }}
                  />
                </div>
                <p className="text-[11px] text-[#b0b0b0] mt-auto">
                  {workspaceStats.utilization}% of projects contain drawing files
                </p>
              </div>

              {/* Quick actions */}
              <div className="bg-[#141414] border border-[#262626] rounded-lg p-5 min-h-[160px]">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-[#a3a3a3] mb-3">Quick Actions</p>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: 'New Project', icon: Plus, action: () => (user ? setIsCreateModalOpen(true) : promptSignInForAction()) },
                    { label: 'All Projects', icon: FolderKanban, action: () => goToTab('projects') },
                    { label: 'Import Files', icon: Upload, action: () => showToast('Open a project to import files') },
                    { label: 'Analytics', icon: BarChart3, action: () => showToast('Feature in development') },
                  ].map(({ label, icon: Icon, action }) => (
                    <button
                      key={label}
                      type="button"
                      onClick={action}
                      className="flex flex-col items-center justify-center gap-1.5 p-3 rounded-md border border-[#262626] bg-[#0a0a0a] hover:border-[#00e676]/25 hover:bg-[#111] transition-colors text-center"
                    >
                      <Icon className="w-4 h-4 text-[#00e676]" />
                      <span className="text-[11px] text-[#d1d1d1] leading-tight">{label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Recent activity — logged-in users only */}
            {user && (
            <div className="bg-[#141414] border border-[#262626] rounded-lg overflow-hidden mb-8">
              <div className="px-5 py-4 border-b border-[#262626] flex items-center justify-between">
                <h2 className="text-sm font-semibold text-white">Recent Activity</h2>
                <span className="text-[11px] text-[#a3a3a3]">{recentProjects.length} project{recentProjects.length === 1 ? '' : 's'}</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-[10px] font-semibold uppercase tracking-widest text-[#a3a3a3] border-b border-[#262626]">
                      <th className="text-left px-5 py-3 font-semibold">Project</th>
                      <th className="text-left px-5 py-3 font-semibold hidden md:table-cell">Files</th>
                      <th className="text-left px-5 py-3 font-semibold hidden lg:table-cell">Artifacts</th>
                      <th className="text-left px-5 py-3 font-semibold hidden xl:table-cell">Action</th>
                      <th className="text-left px-5 py-3 font-semibold hidden sm:table-cell">User</th>
                      <th className="text-left px-5 py-3 font-semibold">Updated</th>
                      <th className="text-right px-5 py-3 font-semibold">Visibility</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1f1f1f]">
                    {loading ? (
                      Array.from({ length: 4 }).map((_, i) => (
                        <tr key={i}>
                          <td colSpan={7} className="px-5 py-3">
                            <div className="h-4 bg-[#262626] rounded animate-pulse w-full" />
                          </td>
                        </tr>
                      ))
                    ) : recentProjects.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-5 py-8 text-center text-[#a3a3a3] text-sm">No recent activity</td>
                      </tr>
                    ) : (
                      recentProjects.map((p) => {
                        const isNew = p.created_at === p.updated_at || Math.abs(new Date(p.updated_at).getTime() - new Date(p.created_at).getTime()) < 60000;
                        return (
                          <tr
                            key={p.id}
                            onClick={() => handleOpenProject(p)}
                            className="hover:bg-[#1a1a1a] cursor-pointer transition-colors"
                          >
                            <td className="px-5 py-3">
                              <div className="flex items-center gap-3 min-w-0">
                                <div
                                  className="w-8 h-8 rounded-sm border border-[#262626]/80 shrink-0"
                                  style={{
                                    background: (() => {
                                      const c = projectThumbPalette(p.id || p.name);
                                      return `linear-gradient(135deg, ${c.from} 0%, ${c.to} 100%)`;
                                    })(),
                                  }}
                                />
                                <ProjectNameTooltip id={p.id} name={p.name} description={p.description}>
                                  <p className="font-medium text-white truncate cursor-default">{p.name}</p>
                                </ProjectNameTooltip>
                              </div>
                            </td>
                            <td className="px-5 py-3 hidden md:table-cell">
                              <span className="text-sm text-[#d1d1d1] tabular-nums">{p.file_count ?? 0}</span>
                              <p className="text-[11px] text-[#a3a3a3] mt-0.5">{formatFileCount(p.file_count)}</p>
                            </td>
                            <td className="px-5 py-3 hidden lg:table-cell">
                              <span className="text-sm text-[#d1d1d1] tabular-nums">{p.artifact_count ?? 0}</span>
                              <p className="text-[11px] text-[#a3a3a3] mt-0.5 truncate max-w-[180px]">
                                {formatArtifactSummary(p.artifact_count, p.artifact_summary)}
                              </p>
                            </td>
                            <td className="px-5 py-3 text-[#d1d1d1] hidden xl:table-cell">
                              {isNew ? 'Project created' : 'Project updated'}
                            </td>
                            <td className="px-5 py-3 hidden sm:table-cell">
                              <div className="flex items-center gap-2">
                                <UserAvatarTooltip
                                  userId={p.owner_id}
                                  displayName={p.created_by}
                                  username={p.owner_username}
                                  size="sm"
                                />
                                <HoverTooltip
                                  stopBubble
                                  className="min-w-0"
                                  content={
                                    <UserTooltipContent
                                      userId={p.owner_id ?? '—'}
                                      name={p.created_by}
                                      username={p.owner_username}
                                    />
                                  }
                                >
                                  <span className="text-[#d1d1d1] truncate max-w-[120px]">{p.created_by || 'Unknown'}</span>
                                </HoverTooltip>
                              </div>
                            </td>
                            <td className="px-5 py-3 text-[#d1d1d1] whitespace-nowrap">
                              <span className="flex items-center gap-1.5">
                                <Clock className="w-3.5 h-3.5 shrink-0" />
                                {formatRelativeTime(p.updated_at)}
                              </span>
                            </td>
                            <td className="px-5 py-3 text-right">
                              <VisibilityBadge isPublic={p.is_public} />
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            )}

            {projectsToolbar}

            {user ? (
              <>
                {renderDashboardSection(
                  'Your Private Projects',
                  'Only you can access these projects.',
                  <Lock className="w-4 h-4 text-[#a78bfa]" />,
                  filteredMyPrivate,
                  'No private projects yet.',
                  { showCreateOnEmpty: true },
                )}
                {renderDashboardSection(
                  'Your Public Projects',
                  'Shared with anyone who has the link.',
                  <Globe className="w-4 h-4 text-[#2dd4bf]" />,
                  filteredMyPublic,
                  'No public projects yet. Make a project public to share it.',
                  { hideWhenEmpty: !loading && filteredMyPublic.length === 0 && filteredMyPrivate.length > 0 },
                )}
                {renderDashboardSection(
                  'Community Public Projects',
                  'Public projects from other users — view only.',
                  <Globe className="w-4 h-4 text-[#5eead4]" />,
                  filteredCommunity,
                  'No community public projects yet.',
                )}
              </>
            ) : (
              renderDashboardSection(
                'Public Projects',
                'Browse public projects shared by the community — view only.',
                <Globe className="w-4 h-4 text-[#2dd4bf]" />,
                filteredCommunity,
                'No public projects yet.',
              )
            )}
              </>
            )}

            {activeTab === 'projects' && (
              <>
                {projectsToolbar}
                {projectsContent}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Create Project Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm shadow-2xl">
          <div className="bg-[#252526] border border-[#3c3c3c] rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-[#3c3c3c] bg-[#1e1e1e]">
              <h2 className="text-xl font-bold text-white tracking-wider">Create New Project</h2>
              <button onClick={() => setIsCreateModalOpen(false)} className="p-1 hover:bg-[#3c3c3c] rounded transition-colors text-[#b0b0b0] hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreateProject}>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-[#b0b0b0] uppercase tracking-wider mb-2">Project Name</label>
                  <input required autoFocus type="text" value={newProjectName} onChange={(e) => setNewProjectName(e.target.value)} placeholder="e.g. Utility 148" className="w-full bg-[#121212] border border-[#333] rounded px-3 py-2 text-sm focus:outline-none focus:border-[#10b981] transition-colors text-white placeholder-[#999]" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-[#b0b0b0] uppercase tracking-wider mb-2">Description (Optional)</label>
                  <textarea value={createDescription} onChange={(e) => setCreateDescription(e.target.value)} placeholder="Enter project description..." className="w-full bg-[#121212] border border-[#333] rounded px-3 py-2 text-sm focus:outline-none focus:border-[#10b981] transition-colors text-white placeholder-[#999] h-24 resize-none"></textarea>
                </div>
                {createError && (
                  <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-2 rounded-md text-sm">
                    {createError}
                  </div>
                )}
              </div>
              <div className="flex items-center justify-end p-5 border-t border-[#3c3c3c] bg-[#1e1e1e] gap-3">
                <button type="button" onClick={() => setIsCreateModalOpen(false)} className="px-6 py-2 text-sm font-semibold rounded bg-[#3c3c3c] hover:bg-[#4a4a4a] text-white transition-colors">
                  Cancel
                </button>
                <button type="submit" className="px-6 py-2 text-sm font-semibold flex items-center gap-2 rounded transition-colors shadow-lg bg-[#10b981] hover:bg-[#059669] text-white shadow-[#10b981]/20">
                  <Plus className="w-4 h-4" />
                  Create project
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Project Modal */}
      {editingProject && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm shadow-2xl">
          <div className="bg-[#252526] border border-[#3c3c3c] rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-[#3c3c3c] bg-[#1e1e1e]">
              <h2 className="text-xl font-bold text-white tracking-wider">Edit Project</h2>
              <button onClick={() => setEditingProject(null)} className="p-1 hover:bg-[#3c3c3c] rounded transition-colors text-[#b0b0b0] hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleEditProject}>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-[#b0b0b0] uppercase tracking-wider mb-2">Project Name</label>
                  <input required autoFocus type="text" value={newProjectName} onChange={(e) => setNewProjectName(e.target.value)} placeholder="e.g. Utility 148" className="w-full bg-[#121212] border border-[#333] rounded px-3 py-2 text-sm focus:outline-none focus:border-[#10b981] transition-colors text-white placeholder-[#999]" />
                </div>
              </div>
              <div className="flex items-center justify-end p-5 border-t border-[#3c3c3c] bg-[#1e1e1e] gap-3">
                <button type="button" onClick={() => setEditingProject(null)} className="px-6 py-2 text-sm font-semibold rounded bg-[#3c3c3c] hover:bg-[#4a4a4a] text-white transition-colors">
                  Cancel
                </button>
                <button type="submit" className="px-6 py-2 text-sm font-semibold flex items-center gap-2 rounded transition-colors shadow-lg bg-[#10b981] hover:bg-[#059669] text-white shadow-[#10b981]/20">
                  <Pencil className="w-4 h-4" />
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-[200] bg-[#333] text-white px-4 py-3 rounded shadow-xl border border-[#444] text-sm animate-in fade-in slide-in-from-bottom-4 duration-300">
          {toastMessage}
        </div>
      )}

      {/* Delete Project Confirmation Dialog */}
      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Project"
        description={`Are you sure you want to delete "${deleteTarget?.name}"? All files, analysis results, and artifacts will be permanently removed. This action cannot be undone.`}
        confirmLabel="Delete Project"
        variant="danger"
        loading={deleteLoading}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
