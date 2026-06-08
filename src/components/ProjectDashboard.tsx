import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../store';
import { useAuth } from '../lib/auth-context';
import { authFetch } from '../lib/supabase';
import { Search, ChevronDown, Plus, Download, Bell, User, LayoutGrid, MessageSquare, Box, FolderKanban, Users, History, FileText, Code, X, List, Pencil, Trash2 } from 'lucide-react';
import { cn } from '../lib/utils';
import { ConfirmDialog } from './ConfirmDialog';

interface ProjectItem {
  id: string;
  name: string;
  description?: string | null;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
  role?: string;
  hasImage?: boolean;
}

export function ProjectDashboard() {
  const { setCurrentView, setActiveProject } = useApp();
  const { user, signOut } = useAuth();
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newProjectName, setNewProjectName] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [sortBy, setSortBy] = useState<'alphabetical' | 'recent' | 'oldest'>('alphabetical');
  const [searchQuery, setSearchQuery] = useState('');

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

  // ── Load projects from API ─────────────────────────────────
  useEffect(() => {
    loadProjects();
  }, []);

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
      setProjects(data.map((p: any) => ({ ...p, role: 'Owner', hasImage: false })));
    } catch (err: any) {
      setError(err.message || 'Failed to load projects');
      // Fallback: show empty state
      setProjects([]);
    } finally {
      setLoading(false);
    }
  }

  const handleOpenProject = (project: ProjectItem) => {
    setActiveProject(project);
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
      setProjects(prev => [{ ...created, role: 'Owner', hasImage: false }, ...prev]);
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

  const navItems = [
    { label: 'Projects', icon: LayoutGrid, active: true },
    { label: 'Ai Chat', icon: MessageSquare },
  ];

  return (
    <div className="flex w-full h-screen overflow-hidden bg-[#121212] text-white">
      {/* Left Sidebar */}
      <div className="w-64 border-r border-[#333] flex flex-col shrink-0">
        <div className="h-16 flex items-center justify-between px-4 border-b border-[#333]">
          <div className="flex items-center gap-2 font-bold text-xl tracking-tight">
            <span className="text-[#a0a5b5]">Element</span> <span className="text-white">IQ</span>
          </div>
          <Bell className="w-5 h-5 text-[#858585] cursor-pointer hover:text-white" />
        </div>
        
        <div className="flex-1 overflow-y-auto py-4">
          <div className="space-y-1 mb-6 px-3">
            {navItems.map((item, i) => (
              <button 
                key={i} 
                className={cn("w-full flex items-center gap-3 px-3 py-2 rounded-md transition-colors text-sm", item.active ? "bg-[#333] font-semibold" : "text-[#858585] hover:text-white hover:bg-[#252526]")}
                onClick={() => {
                  if (item.label === 'Ai Chat') {
                    showToast('Feature in development');
                  }
                }}
              >
                <item.icon className="w-4 h-4" />
                {item.label}
              </button>
            ))}
          </div>

        </div>

        <div className="border-t border-[#333] p-4 flex items-center gap-3 cursor-pointer hover:bg-[#252526]" onClick={signOut}>
          <div className="w-8 h-8 rounded-full bg-[#10b981] flex flex-shrink-0 items-center justify-center text-xs font-bold text-white overflow-hidden">
             <User className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate">{user?.user_metadata?.username || user?.email?.split('@')[0] || 'User'}</p>
            <p className="text-xs text-[#858585] border-transparent truncate">{user?.email || ''}</p>
          </div>
          <ChevronDown className="w-4 h-4 text-[#858585] ml-auto" />
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto flex flex-col bg-[#1a1a1a]">
        <div className="p-8 pb-4 flex flex-col gap-6">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-semibold mb-1">Welcome, {user?.user_metadata?.username || user?.email || 'User'}</h1>
              <p className="text-[#858585]">What are you up for today?</p>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={() => setIsCreateModalOpen(true)} className="bg-[#10b981] hover:bg-[#059669] text-white px-4 py-2 rounded font-semibold flex items-center gap-2 transition-colors shadow-lg">
                <Plus className="w-4 h-4" />
                Create Project
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4 flex-1">
              <div className="relative w-[300px]">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#858585]" />
                <input 
                  type="text" 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search project" 
                  className="w-full bg-[#121212] border border-[#333] rounded pl-10 pr-4 py-2 text-sm text-white focus:outline-none focus:border-[#10b981] transition-colors"
                />
              </div>
              <div className="flex items-center gap-2 bg-[#121212] border border-[#333] rounded px-3 py-2 text-sm cursor-pointer hover:bg-[#252526]">
                <span>All</span>
                <ChevronDown className="w-4 h-4 text-[#858585]" />
              </div>
              <div className="flex items-center gap-2 bg-[#121212] border border-[#333] rounded px-3 py-2 text-sm cursor-pointer hover:bg-[#252526]">
                <span>All</span>
                <ChevronDown className="w-4 h-4 text-[#858585]" />
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="flex items-center bg-[#121212] border border-[#333] rounded p-0.5">
                <button 
                  onClick={() => setViewMode('grid')}
                  className={cn("p-1.5 rounded transition-colors duration-200", viewMode === 'grid' ? "bg-[#333] text-white shadow-sm" : "text-[#858585] hover:text-white")}
                >
                  <LayoutGrid className="w-4 h-4" />
                </button>
                <button 
                  onClick={() => setViewMode('list')}
                  className={cn("p-1.5 rounded transition-colors duration-200", viewMode === 'list' ? "bg-[#333] text-white shadow-sm" : "text-[#858585] hover:text-white")}
                >
                  <List className="w-4 h-4" />
                </button>
              </div>
              
              <div className="relative">
                <select 
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="appearance-none bg-[#121212] border border-[#333] rounded pl-3 pr-8 py-2 text-sm cursor-pointer hover:bg-[#252526] focus:outline-none focus:border-[#10b981] text-white transition-colors"
                >
                  <option value="alphabetical">Alphabetical</option>
                  <option value="recent">Most Recent</option>
                  <option value="oldest">Oldest</option>
                </select>
                <ChevronDown className="w-4 h-4 text-[#858585] absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>
          </div>
        </div>

        <div className="px-8 pb-8 flex-1 overflow-y-auto">
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="bg-[#252526] border border-[#333] rounded-lg overflow-hidden flex flex-col h-[280px] animate-pulse">
                  <div className="p-4 flex flex-col flex-1 border-b border-[#333] bg-[#1e1e1e]">
                    <div className="h-4 bg-[#333] rounded w-16 mb-3" />
                    <div className="h-5 bg-[#333] rounded w-3/4 mb-2" />
                    <div className="h-3 bg-[#333] rounded w-1/2" />
                  </div>
                  <div className="h-[140px] bg-[#121212]" />
                </div>
              ))}
            </div>
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredAndSortedProjects.map(p => (
                <div 
                  key={p.id} 
                  onClick={() => handleOpenProject(p)}
                  className="bg-[#252526] border border-[#333] rounded-lg overflow-hidden cursor-pointer hover:border-[#10b981] transition-all group flex flex-col h-[280px]"
                >
                  <div className="p-4 flex flex-col flex-1 border-b border-[#333] bg-[#1e1e1e]">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#2eb886] border border-[#2eb886] bg-[#2eb886]/10 px-2 py-0.5 rounded">Active</span>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={(e) => openEditModal(p, e)} className="p-1 hover:bg-[#333] rounded text-[#858585] hover:text-white transition-colors">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={(e) => handleDeleteProject(p.id, e)} className="p-1 hover:bg-[#ef4444]/20 rounded text-[#858585] hover:text-[#ef4444] transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    <h3 className="font-semibold text-white truncate mb-2 group-hover:text-[#10b981] transition-colors">{p.name}</h3>
                    <div className="flex items-center gap-4 text-xs text-[#858585]">
                      <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" /> {p.role || 'Owner'}</span>
                      <span className="flex items-center gap-1"><History className="w-3.5 h-3.5" /> {p.created_at ? new Date(p.created_at).toLocaleDateString() : ''}</span>
                    </div>
                  </div>
                  
                  <div className="h-[140px] bg-[#121212] relative overflow-hidden flex items-center justify-center">
                    {p.hasImage ? (
                      <div className="absolute inset-0 bg-[#10b981]/20 flex items-center justify-center p-2">
                        <div className="w-full h-full bg-gradient-to-br from-[#1a1a1a] to-[#252526] border border-[#333] rounded flex items-center justify-center">
                           <Box className="w-10 h-10 text-[#10b981]/40" />
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-3 text-[#333]">
                        <Box className="w-10 h-10" />
                        <span className="text-xs font-bold uppercase tracking-widest text-[#555]">No Thumbnail</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col border border-[#333] rounded-lg overflow-hidden bg-[#1e1e1e]">
               <div className="flex items-center px-4 py-3 border-b border-[#333] bg-[#252526] text-xs font-semibold uppercase tracking-wider text-[#858585]">
                  <div className="flex-1">Name</div>
                  <div className="w-32">Role</div>
                  <div className="w-48">Last Modified</div>
                  <div className="w-32 text-center">Status</div>
               </div>
               <div className="flex flex-col divide-y divide-[#333]">
                 {filteredAndSortedProjects.map(p => (
                   <div 
                     key={p.id} 
                     onClick={() => handleOpenProject(p)}
                     className="flex items-center px-4 py-3 hover:bg-[#2a2a2a] cursor-pointer transition-colors group"
                   >
                      <div className="flex-1 flex items-center gap-3 w-0">
                         <div className="w-8 h-8 shrink-0 rounded bg-[#1a1a1a] border border-[#333] flex items-center justify-center">
                           <Box className={cn("w-4 h-4", p.hasImage ? "text-[#10b981]" : "text-[#555]")} />
                         </div>
                         <span className="font-semibold text-white truncate group-hover:text-[#10b981] transition-colors">{p.name}</span>
                      </div>
                      <div className="w-32 shrink-0 flex items-center gap-2 text-sm text-[#858585]">
                         <Users className="w-3.5 h-3.5" /> <span className="truncate">{p.role || 'Owner'}</span>
                      </div>
                      <div className="w-48 shrink-0 flex items-center gap-2 text-sm text-[#858585]">
                         <History className="w-3.5 h-3.5" /> <span className="truncate">{p.created_at ? new Date(p.created_at).toLocaleDateString() : ''}</span>
                      </div>
                      <div className="w-32 shrink-0 flex items-center justify-center gap-3">
                         <span className="text-[10px] font-bold uppercase tracking-wider text-[#2eb886] border border-[#2eb886] bg-[#2eb886]/10 px-2 py-0.5 rounded">Active</span>
                         <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={(e) => openEditModal(p, e)} className="p-1 hover:bg-[#333] rounded text-[#858585] hover:text-white transition-colors">
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={(e) => handleDeleteProject(p.id, e)} className="p-1 hover:bg-[#ef4444]/20 rounded text-[#858585] hover:text-[#ef4444] transition-colors">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                         </div>
                      </div>
                   </div>
                 ))}
               </div>
            </div>
          )}
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
