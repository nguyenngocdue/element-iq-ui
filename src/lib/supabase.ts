/**
 * Supabase client for frontend — handles Auth (login/signup/session).
 * Files and analysis data go through FastAPI backend, NOT Supabase directly.
 */

import { createClient } from '@supabase/supabase-js';
import { getGuestViewerId } from './guestViewer';

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
 * Backend base URL for browser fetch().
 * Dev + Docker nginx: use relative `/api/v1/*` (same origin → Express/nginx proxy).
 * Production only: set VITE_BACKEND_URL if the API is on a different host.
 */
function apiBaseUrl(): string {
  if (!import.meta.env.PROD) return '';
  const url = (import.meta.env.VITE_BACKEND_URL as string | undefined)?.trim();
  return url ? url.replace(/\/$/, '') : '';
}

function isServerFileId(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
}

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
  headers.set('X-Guest-Viewer-Id', getGuestViewerId());
  // FormData must not set Content-Type manually — browser adds multipart boundary.
  if (options.body instanceof FormData) {
    headers.delete('Content-Type');
  }
  const fullUrl = url.startsWith('/') ? `${apiBaseUrl()}${url}` : url;
  return fetch(fullUrl, { ...options, headers });
}

export { isServerFileId };
