import { useCallback, useEffect, useState } from 'react';
import { authFetch } from '../lib/supabase';

export interface AdminProfile {
  id: string;
  username: string;
  full_name: string | null;
  email: string | null;
  role: string;
  is_super_admin: boolean;
}

export function useAdminProfile() {
  const [profile, setProfile] = useState<AdminProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch('/api/v1/profile');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setProfile(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load profile');
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const isAdmin = profile?.role === 'ADMIN';
  const isSuperAdmin = Boolean(profile?.is_super_admin);

  return { profile, loading, error, isAdmin, isSuperAdmin, reload };
}
