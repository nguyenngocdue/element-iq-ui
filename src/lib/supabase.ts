/**
 * Supabase client for frontend — handles Auth (login/signup/session).
 * Files and analysis data go through FastAPI backend, NOT Supabase directly.
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://mejugvjfdblfhjmhdouy.supabase.co';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/**
 * Get the current session access token (JWT) for API calls.
 * Returns null if not authenticated.
 */
export async function getAccessToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

/**
 * Backend base URL — uses Vite proxy in dev (relative path),
 * or VITE_BACKEND_URL env var when running outside Vite dev server.
 */
const BACKEND_URL = (import.meta.env.VITE_BACKEND_URL as string | undefined) || '';

/**
 * Wrapper for fetch that automatically attaches the Supabase JWT.
 * Use this instead of raw fetch() for all /api/v1 calls.
 */
export async function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const token = await getAccessToken();
  const headers = new Headers(options.headers);
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  // Prepend backend URL if the path is relative and BACKEND_URL is set
  const fullUrl = url.startsWith('/') && BACKEND_URL ? `${BACKEND_URL}${url}` : url;
  return fetch(fullUrl, { ...options, headers });
}
