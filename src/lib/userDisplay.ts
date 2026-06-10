import type { User } from '@supabase/supabase-js';

export interface UserDisplayInfo {
  username: string;
  fullName: string;
  email: string;
  uid: string;
  initials: string;
}

export function getUserDisplayFromAuth(user: User | null | undefined): UserDisplayInfo | null {
  if (!user) return null;
  const username = user.user_metadata?.username ?? user.email?.split('@')[0] ?? 'User';
  const fullName = user.user_metadata?.full_name ?? username;
  const email = user.email ?? '—';
  const uid = user.id ?? '—';
  const initials = fullName.charAt(0).toUpperCase();
  return { username, fullName, email, uid, initials };
}
