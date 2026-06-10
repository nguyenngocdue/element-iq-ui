import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../store';
import { useAuth } from '../lib/auth-context';
import { authFetch } from '../lib/supabase';
import { Search, ChevronDown, Plus, Bell, LayoutGrid, Box, FolderKanban, X, List, Pencil, Trash2, EllipsisVertical, Upload, BarChart3, Clock } from 'lucide-react';
import { cn } from '../lib/utils';
import { ConfirmDialog } from './ConfirmDialog';
import { WorkspaceSidebar } from './WorkspaceSidebar';
import { UserProfileMenu } from './UserProfileMenu';
import { ProjectNameTooltip, UserTooltipContent } from './tooltipContent';
import { HoverTooltip } from './HoverTooltip';
import { UserAvatarTooltip } from './UserAvatarTooltip';

interface ProjectItem {
  id: string;
  name: string;
  description?: string | null;
  is_archived: boolean;
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

const STATUS_ACTIVE_CLASS =
  'inline-flex items-center text-[10px] font-medium uppercase tracking-wide text-[#5eead4] bg-[#14b8a6]/10 border border-[#14b8a6]/25 px-2 py-0.5 rounded-sm';

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

function ProjectCard({
  project: p,
  cardMenuId,
  setCardMenuId,
  onOpen,
  onEdit,
  onDelete,
}: {
  project: ProjectItem;
  cardMenuId: string | null;
  setCardMenuId: React.Dispatch<React.SetStateAction<string | null>>;
  onOpen: (p: ProjectItem) => void;
  onEdit: (p: ProjectItem, e: React.MouseEvent) => void;
  onDelete: (id: string, e: React.MouseEvent) => void;
}) {
  const thumbColors = projectThumbPalette(p.id || p.name);
  const fileCount = p.file_count ?? 0;
  const artifactCount = p.artifact_count ?? 0;

  return (
    <div
      onClick={() => onOpen(p)}
      className="group relative bg-[#141414] border border-[#262626] rounded-lg overflow-hidden cursor-pointer hover:border-[#14b8a6]/30 hover:shadow-[0_12px_32px_rgba(0,0,0,0.35)] transition-all duration-200 flex flex-col"
    >
      <div className="relative h-12 shrink-0 overflow-hidden border-b border-[#262626]/60">
        <div
          className="absolute inset-0"
          style={{ background: `linear-gradient(135deg, ${thumbColors.from} 0%, ${thumbColors.to} 100%)` }}
        />
        <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(255,255,255,0.06),rgba(0,0,0,0.35))]" />
        <div className="relative flex items-center justify-between px-3.5 h-full">
          <FolderKanban className="w-3.5 h-3.5 text-white/60" strokeWidth={1.75} />
          <div className="relative shrink-0">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setCardMenuId(prev => (prev === p.id ? null : p.id));
              }}
              className="p-1 rounded-md text-white/50 hover:text-white hover:bg-black/25 transition-colors opacity-0 group-hover:opacity-100"
              aria-label="Project actions"
            >
              <EllipsisVertical className="w-4 h-4" />
            </button>
            {cardMenuId === p.id && (
              <div
                className="absolute right-0 top-full mt-1 z-20 min-w-[128px] py-1 bg-[#1a1a1a] border border-[#333] rounded-lg shadow-xl"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  type="button"
                  onClick={(e) => { setCardMenuId(null); onEdit(p, e); }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs text-[#ccc] hover:bg-[#262626] hover:text-white transition-colors"
                >
                  <Pencil className="w-3.5 h-3.5" />
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
        </div>
      </div>

      <div className="flex flex-col flex-1 p-4 gap-2.5">
        <div className="flex items-start justify-between gap-2 min-w-0">
          <ProjectNameTooltip
            id={p.id}
            name={p.name}
            description={p.description}
            className="min-w-0 flex-1"
          >
            <h3 className="text-[15px] font-semibold text-white leading-snug truncate group-hover:text-[#5eead4] transition-colors cursor-default">
              {p.name}
            </h3>
          </ProjectNameTooltip>
          <span className={cn(STATUS_ACTIVE_CLASS, 'shrink-0')}>Active</span>
        </div>

        <p className={cn(
          'text-xs leading-relaxed whitespace-pre-wrap break-words',
          p.description?.trim() ? 'text-[#777]' : 'text-[#444]',
        )}>
          {p.description?.trim() || 'No description provided.'}
        </p>

        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-[#888]">
          <span className="inline-flex items-center gap-1 tabular-nums">
            <Upload className="w-3 h-3 text-[#666]" />
            {formatFileCount(fileCount)}
          </span>
          <span className="text-[#333]">·</span>
          <span className="inline-flex items-center gap-1 tabular-nums">
            <Box className="w-3 h-3 text-[#666]" />
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
              <span className="text-[11px] text-[#aaa] truncate cursor-default">
                {p.created_by || 'Unknown'}
              </span>
            </HoverTooltip>
          </div>
          <span className="text-[10px] text-[#666] shrink-0 tabular-nums uppercase tracking-wide">
            {formatProjectDate(p.created_at)}
          </span>
        </div>
      </div>
    </div>
  );
}

export function ProjectDashboard({ activeTab }: ProjectDashboardProps) {
  const navigate = useNavigate();
  const { setActiveProject } = useApp();
  const { user } = useAuth();
  const [projects, setProjects] = useState<ProjectItem[]>([]);
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

  const handleWorkspaceNavigate = (nav: 'dashboard' | 'projects' | 'account') => {
    if (nav === 'account') navigate('/account');
    else goToTab(nav);
  };

  const filteredAndSortedProjects = useMemo(() => {
    let result = projects.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()));
    
    switch (sortBy) {
      case 'alphabetical':
        result.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'recent':
        result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        break;
      case 'oldest':
        result.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        break;
    }
    return result;
  }, [projects, searchQuery, sortBy]);

  const workspaceStats = useMemo(() => {
    const totalFiles = projects.reduce((sum, p) => sum + (p.file_count ?? 0), 0);
    const withFiles = projects.filter(p => (p.file_count ?? 0) > 0).length;
    const utilization = projects.length ? Math.round((withFiles / projects.length) * 100) : 0;
    return { totalProjects: projects.length, totalFiles, withFiles, utilization };
  }, [projects]);

  const recentProjects = useMemo(() => {
    return [...projects]
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
      .slice(0, 8);
  }, [projects]);

  const displayName = user?.user_metadata?.username || user?.email?.split('@')[0] || 'User';

  // ── Load projects from API ─────────────────────────────────
  useEffect(() => {
    loadProjects();
  }, []);

  useEffect(() => {
    if (!cardMenuId && !sortMenuOpen) return;
    const closeMenus = () => {
      setCardMenuId(null);
      setSortMenuOpen(false);
    };
    document.addEventListener('click', closeMenus);
    return () => document.removeEventListener('click', closeMenus);
  }, [cardMenuId, sortMenuOpen]);

  async function loadProjects() {
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
      setProjects(data.map((p: ProjectItem) => ({ ...p, hasImage: false })));
    } catch (err: any) {
      setError(err.message || 'Failed to load projects');
      // Fallback: show empty state
      setProjects([]);
    } finally {
      setLoading(false);
    }
  }

  const handleOpenProject = (project: ProjectItem) => {
    setActiveProject({
      id: project.id,
      name: project.name,
      role: 'Owner',
      age: '',
      hasImage: project.hasImage ?? false,
    });
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
      setProjects(prev => prev.map(p => p.id === editingProject.id ? { ...p, ...updated } : p));
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
    const project = projects.find(p => p.id === id);
    if (project) setDeleteTarget(project);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      const res = await authFetch(`/api/v1/projects/${deleteTarget.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
      const data = await res.json();
      setProjects(prev => prev.filter(p => p.id !== deleteTarget.id));
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
      setProjects(prev => [{ ...created, hasImage: false }, ...prev]);
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

  const projectsToolbar = (
    <div className="flex items-center justify-end mb-6">
      <div className="inline-flex items-center bg-[#141414] border border-[#262626] rounded-md p-1 gap-1">
        <div className="flex items-center p-0.5">
          <button
            type="button"
            onClick={() => setViewMode('grid')}
            className={cn(
              'p-1.5 rounded-sm transition-colors',
              viewMode === 'grid' ? 'bg-[#262626] text-white' : 'text-[#666] hover:text-[#ccc]',
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
              viewMode === 'list' ? 'bg-[#262626] text-white' : 'text-[#666] hover:text-[#ccc]',
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
                : 'text-[#aaa] hover:bg-[#1a1a1a] hover:text-white',
            )}
          >
            <span className="flex-1 text-left text-[13px]">{sortLabel}</span>
            <ChevronDown className={cn('w-3.5 h-3.5 text-[#666] shrink-0 transition-transform', sortMenuOpen && 'rotate-180')} />
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

  const projectsContent = loading ? (
    <div className={PROJECT_GRID_CLASS}>
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="bg-[#141414] border border-[#262626] rounded-lg h-[220px] animate-pulse" />
      ))}
    </div>
  ) : viewMode === 'grid' ? (
    filteredAndSortedProjects.length === 0 ? (
      <div className="bg-[#141414] border border-[#262626] rounded-lg py-16 text-center">
        <FolderKanban className="w-10 h-10 text-[#333] mx-auto mb-3" />
        <p className="text-[#666] text-sm">No projects found</p>
        <button
          type="button"
          onClick={() => setIsCreateModalOpen(true)}
          className="mt-4 text-sm text-[#00e676] hover:underline"
        >
          Create your first project
        </button>
      </div>
    ) : (
      <div className={cn(PROJECT_GRID_CLASS, 'pb-8')}>
        {filteredAndSortedProjects.map(p => (
          <ProjectCard
            key={p.id}
            project={p}
            cardMenuId={cardMenuId}
            setCardMenuId={setCardMenuId}
            onOpen={handleOpenProject}
            onEdit={openEditModal}
            onDelete={handleDeleteProject}
          />
        ))}
      </div>
    )
  ) : (
    <div className="flex flex-col border border-[#262626] rounded-lg overflow-hidden bg-[#141414] mb-8">
      <div className="flex items-center px-4 py-2.5 border-b border-[#262626] bg-[#0a0a0a] text-[10px] font-semibold uppercase tracking-widest text-[#555]">
        <div className="flex-[1.2] min-w-0">Project</div>
        <div className="w-36 shrink-0">Created by</div>
        <div className="w-32 shrink-0">Created</div>
        <div className="w-20 shrink-0">Files</div>
        <div className="flex-1 min-w-0 hidden lg:block">Description</div>
        <div className="w-28 shrink-0 text-center">Status</div>
      </div>
      <div className="flex flex-col divide-y divide-[#1f1f1f]">
        {filteredAndSortedProjects.map(p => (
          <div
            key={p.id}
            onClick={() => handleOpenProject(p)}
            className="flex items-center px-4 py-3 hover:bg-[#1a1a1a] cursor-pointer transition-colors group"
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
            <div className="w-36 shrink-0 text-xs text-[#888] min-w-0 flex items-center gap-2">
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
            <div className="w-32 shrink-0 text-xs text-[#888] tabular-nums">{formatProjectDate(p.created_at)}</div>
            <div className="w-20 shrink-0 text-xs text-[#888] tabular-nums">{p.file_count ?? 0}</div>
            <div className="flex-1 min-w-0 hidden lg:block text-xs text-[#666] italic truncate pr-4">
              {p.description?.trim() || 'No description'}
            </div>
            <div className="w-28 shrink-0 flex items-center justify-center gap-2">
              <span className={STATUS_ACTIVE_CLASS}>Active</span>
              <div className="relative">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setCardMenuId(prev => (prev === p.id ? null : p.id));
                  }}
                  className="p-1 rounded-md text-[#666] hover:text-white hover:bg-[#262626] opacity-0 group-hover:opacity-100 transition-all"
                  aria-label="Project actions"
                >
                  <EllipsisVertical className="w-3.5 h-3.5" />
                </button>
                {cardMenuId === p.id && (
                  <div
                    className="absolute right-0 top-full mt-1 z-20 min-w-[128px] py-1 bg-[#1a1a1a] border border-[#333] rounded-xl shadow-xl"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button type="button" onClick={(e) => { setCardMenuId(null); openEditModal(p, e); }} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-[#ccc] hover:bg-[#262626] hover:text-white transition-colors">
                      <Pencil className="w-3.5 h-3.5" /> Edit
                    </button>
                    <button type="button" onClick={(e) => { setCardMenuId(null); handleDeleteProject(p.id, e); }} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-[#ef4444]/90 hover:bg-[#ef4444]/10 hover:text-[#ef4444] transition-colors">
                      <Trash2 className="w-3.5 h-3.5" /> Delete
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="flex w-full h-screen overflow-hidden bg-[#0a0a0a] text-white">
      <WorkspaceSidebar
        activeNav={activeTab}
        displayName={displayName}
        onCreateProject={() => setIsCreateModalOpen(true)}
        onNavigate={handleWorkspaceNavigate}
        onAiChat={() => showToast('Feature in development')}
        onHelp={() => showToast('Help Center coming soon')}
      />

      {/* Main Content */}
      <div className="flex-1 overflow-hidden flex flex-col bg-[#0a0a0a]">
        {/* Top bar */}
        <header className="h-14 border-b border-[#1f1f1f] flex items-center px-6 gap-4 shrink-0 bg-[#0a0a0a]">
          <div className="flex-1 relative max-w-2xl">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#555]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search projects, files..."
              className="w-full bg-[#141414] border border-[#262626] rounded-md pl-10 pr-4 py-2 text-sm text-white placeholder-[#555] focus:outline-none focus:border-[#00e676]/40 transition-colors"
            />
          </div>

          <div className="flex items-center gap-2 shrink-0 ml-auto">
            <button type="button" className="p-2 rounded-md text-[#666] hover:text-white hover:bg-[#141414] transition-colors">
              <Bell className="w-4 h-4" />
            </button>
            <UserProfileMenu variant="workspace" />
          </div>
        </header>

        <div className="flex-1 overflow-y-auto">
          <div className="w-full px-6 lg:px-8 py-7">
            {/* Page header */}
            <div className="mb-7">
              {activeTab === 'dashboard' ? (
                <>
                  <h1 className="text-2xl font-semibold text-white mb-1">Workspace Overview</h1>
                  <p className="text-sm text-[#666]">
                    Manage drawing projects, files, and analysis workflows in one place.
                  </p>
                </>
              ) : (
                <>
                  <h1 className="text-2xl font-semibold text-white mb-1">All Projects</h1>
                  <p className="text-sm text-[#666]">
                    {filteredAndSortedProjects.length} project{filteredAndSortedProjects.length === 1 ? '' : 's'} in your workspace.
                  </p>
                </>
              )}
            </div>

            {error && (
              <div className="mb-6 bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-xl text-sm">
                {error}
              </div>
            )}

            {activeTab === 'dashboard' && (
              <>
            {/* Summary widgets */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-8">
              {/* Featured / latest project */}
              <div className="bg-[#141414] border border-[#262626] rounded-lg p-5 min-h-[160px] flex flex-col">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-[#555] mb-3">Latest Project</p>
                {loading ? (
                  <div className="flex-1 animate-pulse space-y-2">
                    <div className="h-8 bg-[#262626] rounded w-12" />
                    <div className="h-4 bg-[#262626] rounded w-2/3" />
                  </div>
                ) : filteredAndSortedProjects[0] ? (
                  (() => {
                    const latest = filteredAndSortedProjects[0];
                    return (
                      <button
                        type="button"
                        onClick={() => handleOpenProject(latest)}
                        className="flex-1 text-left group"
                      >
                        <p className="text-lg font-semibold text-white group-hover:text-[#5eead4] transition-colors truncate mb-2">
                          {latest.name}
                        </p>
                        <p className="text-[11px] text-[#666] truncate">
                          {formatFileCount(latest.file_count)} · Updated {formatRelativeTime(latest.updated_at)}
                        </p>
                      </button>
                    );
                  })()
                ) : (
                  <p className="text-sm text-[#555] flex-1">No projects yet. Create one to get started.</p>
                )}
              </div>

              {/* Drawing files summary */}
              <div className="bg-[#141414] border border-[#262626] rounded-lg p-5 min-h-[160px] flex flex-col">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-[#555] mb-3">Drawing Files</p>
                <div className="flex items-baseline gap-2 mb-3">
                  <span className="text-3xl font-bold text-white tabular-nums">{workspaceStats.totalFiles}</span>
                  <span className="text-sm text-[#666]">/ {workspaceStats.totalProjects} project{workspaceStats.totalProjects === 1 ? '' : 's'}</span>
                </div>
                <div className="h-1.5 bg-[#262626] rounded-full overflow-hidden mb-2">
                  <div
                    className="h-full bg-[#00e676] rounded-full transition-all duration-500"
                    style={{ width: `${workspaceStats.utilization}%` }}
                  />
                </div>
                <p className="text-[11px] text-[#666] mt-auto">
                  {workspaceStats.utilization}% of projects contain drawing files
                </p>
              </div>

              {/* Quick actions */}
              <div className="bg-[#141414] border border-[#262626] rounded-lg p-5 min-h-[160px]">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-[#555] mb-3">Quick Actions</p>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: 'New Project', icon: Plus, action: () => setIsCreateModalOpen(true) },
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
                      <span className="text-[11px] text-[#888] leading-tight">{label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Recent activity */}
            <div className="bg-[#141414] border border-[#262626] rounded-lg overflow-hidden mb-8">
              <div className="px-5 py-4 border-b border-[#262626] flex items-center justify-between">
                <h2 className="text-sm font-semibold text-white">Recent Activity</h2>
                <span className="text-[11px] text-[#555]">{recentProjects.length} project{recentProjects.length === 1 ? '' : 's'}</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-[10px] font-semibold uppercase tracking-widest text-[#555] border-b border-[#262626]">
                      <th className="text-left px-5 py-3 font-semibold">Project</th>
                      <th className="text-left px-5 py-3 font-semibold hidden md:table-cell">Files</th>
                      <th className="text-left px-5 py-3 font-semibold hidden lg:table-cell">Artifacts</th>
                      <th className="text-left px-5 py-3 font-semibold hidden xl:table-cell">Action</th>
                      <th className="text-left px-5 py-3 font-semibold hidden sm:table-cell">User</th>
                      <th className="text-left px-5 py-3 font-semibold">Updated</th>
                      <th className="text-right px-5 py-3 font-semibold">Status</th>
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
                        <td colSpan={7} className="px-5 py-8 text-center text-[#555] text-sm">No recent activity</td>
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
                              <span className="text-sm text-[#aaa] tabular-nums">{p.file_count ?? 0}</span>
                              <p className="text-[11px] text-[#555] mt-0.5">{formatFileCount(p.file_count)}</p>
                            </td>
                            <td className="px-5 py-3 hidden lg:table-cell">
                              <span className="text-sm text-[#aaa] tabular-nums">{p.artifact_count ?? 0}</span>
                              <p className="text-[11px] text-[#555] mt-0.5 truncate max-w-[180px]">
                                {formatArtifactSummary(p.artifact_count, p.artifact_summary)}
                              </p>
                            </td>
                            <td className="px-5 py-3 text-[#888] hidden xl:table-cell">
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
                                  <span className="text-[#888] truncate max-w-[120px]">{p.created_by || 'Unknown'}</span>
                                </HoverTooltip>
                              </div>
                            </td>
                            <td className="px-5 py-3 text-[#888] whitespace-nowrap">
                              <span className="flex items-center gap-1.5">
                                <Clock className="w-3.5 h-3.5 shrink-0" />
                                {formatRelativeTime(p.updated_at)}
                              </span>
                            </td>
                            <td className="px-5 py-3 text-right">
                              <span className={STATUS_ACTIVE_CLASS}>
                                Active
                              </span>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
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
              <button onClick={() => setIsCreateModalOpen(false)} className="p-1 hover:bg-[#3c3c3c] rounded transition-colors text-[#858585] hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreateProject}>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-[#858585] uppercase tracking-wider mb-2">Project Name</label>
                  <input required autoFocus type="text" value={newProjectName} onChange={(e) => setNewProjectName(e.target.value)} placeholder="e.g. Utility 148" className="w-full bg-[#121212] border border-[#333] rounded px-3 py-2 text-sm focus:outline-none focus:border-[#10b981] transition-colors text-white placeholder-[#555]" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-[#858585] uppercase tracking-wider mb-2">Description (Optional)</label>
                  <textarea value={createDescription} onChange={(e) => setCreateDescription(e.target.value)} placeholder="Enter project description..." className="w-full bg-[#121212] border border-[#333] rounded px-3 py-2 text-sm focus:outline-none focus:border-[#10b981] transition-colors text-white placeholder-[#555] h-24 resize-none"></textarea>
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
              <button onClick={() => setEditingProject(null)} className="p-1 hover:bg-[#3c3c3c] rounded transition-colors text-[#858585] hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleEditProject}>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-[#858585] uppercase tracking-wider mb-2">Project Name</label>
                  <input required autoFocus type="text" value={newProjectName} onChange={(e) => setNewProjectName(e.target.value)} placeholder="e.g. Utility 148" className="w-full bg-[#121212] border border-[#333] rounded px-3 py-2 text-sm focus:outline-none focus:border-[#10b981] transition-colors text-white placeholder-[#555]" />
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
