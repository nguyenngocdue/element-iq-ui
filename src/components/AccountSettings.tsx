import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell } from 'lucide-react';
import { useAuth } from '../lib/auth-context';
import { authFetch } from '../lib/supabase';
import { WorkspaceSidebar } from './WorkspaceSidebar';
import { UserProfileMenu } from './UserProfileMenu';

interface ProfileData {
  id: string;
  username: string;
  full_name: string | null;
  role: string;
  created_at: string;
  updated_at: string;
}

function profileInitials(fullName: string | null, username: string): string {
  const source = fullName?.trim() || username;
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return (source.charAt(0) || '?').toUpperCase();
}

function formatMemberSince(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

export function AccountSettings() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const email = user?.email ?? '—';
  const userUuid = profile?.id ?? user?.id ?? '—';
  const displayName = profile?.full_name || profile?.username || user?.email?.split('@')[0] || 'User';

  useEffect(() => {
    loadProfile();
  }, []);

  async function loadProfile() {
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch('/api/v1/profile');
      if (!res.ok) {
        const detail = await res.json().catch(() => ({}));
        throw new Error(typeof detail.detail === 'string' ? detail.detail : `HTTP ${res.status}`);
      }
      const data: ProfileData = await res.json();
      setProfile(data);
      setUsername(data.username);
      setFullName(data.full_name ?? '');
    } catch (err: any) {
      setError(err.message || 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await authFetch('/api/v1/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: username.trim(),
          full_name: fullName.trim() || null,
        }),
      });
      if (!res.ok) {
        const detail = await res.json().catch(() => ({}));
        throw new Error(typeof detail.detail === 'string' ? detail.detail : `HTTP ${res.status}`);
      }
      const data: ProfileData = await res.json();
      setProfile(data);
      setUsername(data.username);
      setFullName(data.full_name ?? '');
      setSuccess('Profile updated successfully.');
    } catch (err: any) {
      setError(err.message || 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  }

  const handleNavigate = (nav: 'dashboard' | 'projects' | 'account') => {
    if (nav === 'dashboard') navigate('/');
    else if (nav === 'projects') navigate('/projects');
    else navigate('/account');
  };

  return (
    <div className="flex w-full h-screen overflow-hidden bg-[#0a0a0a] text-white">
      <WorkspaceSidebar
        activeNav="account"
        displayName={displayName}
        onCreateProject={() => navigate('/projects')}
        onNavigate={handleNavigate}
        onAiChat={() => {}}
        onHelp={() => {}}
      />

      <div className="flex-1 overflow-hidden flex flex-col bg-[#0a0a0a]">
        <header className="h-14 border-b border-[#1f1f1f] flex items-center justify-end px-6 gap-2 shrink-0">
          <button type="button" className="p-2 rounded-md text-[#b0b0b0] hover:text-white hover:bg-[#141414] transition-colors">
            <Bell className="w-4 h-4" />
          </button>
          <UserProfileMenu variant="workspace" />
        </header>

        <div className="flex-1 overflow-y-auto">
          <div className="w-full px-6 lg:px-8 py-7">
            <div className="mb-7">
              <h1 className="text-2xl font-semibold text-white mb-1">Account Settings</h1>
              <p className="text-sm text-[#b0b0b0]">Manage your profile and workspace identity.</p>
            </div>

            {error && (
              <div className="mb-6 bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-md text-sm">
                {error}
              </div>
            )}
            {success && (
              <div className="mb-6 bg-[#14b8a6]/10 border border-[#14b8a6]/25 text-[#5eead4] px-4 py-3 rounded-md text-sm">
                {success}
              </div>
            )}

            {loading ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {Array.from({ length: 2 }).map((_, i) => (
                  <div key={i} className="h-80 bg-[#141414] border border-[#262626] rounded-lg animate-pulse" />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pb-8">
                <form
                  onSubmit={handleSave}
                  className="bg-[#141414] border border-[#262626] rounded-lg p-5 flex flex-col"
                >
                  <div className="flex items-center justify-between mb-5">
                    <h2 className="text-sm font-semibold text-white">Personal Information</h2>
                    <button
                      type="submit"
                      disabled={saving}
                      className="text-sm font-medium text-[#5eead4] hover:text-[#99f6e4] disabled:opacity-50 transition-colors"
                    >
                      {saving ? 'Saving…' : 'Save Changes'}
                    </button>
                  </div>

                  <div className="flex gap-4 mb-5">
                    <div className="w-16 h-16 rounded-md bg-[#00e676]/15 border border-[#00e676]/25 flex items-center justify-center text-xl font-semibold text-[#5eead4] shrink-0">
                      {profileInitials(fullName, username)}
                    </div>
                    <div className="flex-1 min-w-0 pt-1">
                      <p className="text-sm font-medium text-white truncate">{fullName || username}</p>
                      <p className="text-xs text-[#b0b0b0] truncate mt-0.5">@{username}</p>
                    </div>
                  </div>

                  <div className="space-y-4 flex-1">
                    <div>
                      <label className="block text-[11px] font-medium uppercase tracking-wide text-[#b0b0b0] mb-1.5">
                        Username
                      </label>
                      <input
                        required
                        minLength={3}
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        className="w-full bg-[#0a0a0a] border border-[#262626] rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:border-[#14b8a6]/40 transition-colors"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium uppercase tracking-wide text-[#b0b0b0] mb-1.5">
                        Full Name
                      </label>
                      <input
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="Your display name"
                        className="w-full bg-[#0a0a0a] border border-[#262626] rounded-md px-3 py-2 text-sm text-white placeholder-[#999] focus:outline-none focus:border-[#14b8a6]/40 transition-colors"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium uppercase tracking-wide text-[#b0b0b0] mb-1.5">
                        Email
                      </label>
                      <input
                        readOnly
                        value={email}
                        className="w-full bg-[#0a0a0a]/50 border border-[#262626] rounded-md px-3 py-2 text-sm text-[#d1d1d1] cursor-not-allowed"
                      />
                      <p className="text-[11px] text-[#a3a3a3] mt-1.5">Email is managed by your login provider and cannot be changed here.</p>
                    </div>
                  </div>
                </form>

                <div className="bg-[#141414] border border-[#262626] rounded-lg p-5 flex flex-col">
                  <h2 className="text-sm font-semibold text-white mb-4">Account</h2>

                  <div className="flex items-center gap-3 pb-4 mb-4 border-b border-[#333]">
                    <div className="w-9 h-9 rounded-full bg-[#10b981] flex items-center justify-center text-white text-[15px] font-bold shrink-0">
                      {(fullName || username).charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="text-white text-sm font-semibold truncate">{fullName || username}</div>
                      <div className="text-[#b0b0b0] text-xs truncate">{username}</div>
                    </div>
                  </div>

                  <div className="space-y-3 mb-4">
                    <div>
                      <div className="text-[#b0b0b0] text-[10px] uppercase tracking-wide mb-0.5">Email</div>
                      <div className="text-[#cccccc] text-sm break-all">{email}</div>
                    </div>
                    <div>
                      <div className="text-[#b0b0b0] text-[10px] uppercase tracking-wide mb-0.5">User ID</div>
                      <div className="text-[#cccccc] text-xs font-mono break-all opacity-70">{userUuid}</div>
                    </div>
                    <div>
                      <div className="text-[#b0b0b0] text-[10px] uppercase tracking-wide mb-0.5">Role</div>
                      <div className="text-[#5eead4] text-sm uppercase tracking-wide">{profile?.role ?? 'USER'}</div>
                    </div>
                    <div>
                      <div className="text-[#b0b0b0] text-[10px] uppercase tracking-wide mb-0.5">Member Since</div>
                      <div className="text-[#cccccc] text-sm">
                        {profile ? formatMemberSince(profile.created_at) : '—'}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
