import { authFetch } from './supabase';
import { getDeviceId } from './deviceId';
import { getDeviceInfo } from './deviceInfo';

const SESSION_KEY = 'elementiq:presence-session-id';
const HEARTBEAT_MS = 45_000;

let heartbeatTimer: ReturnType<typeof setInterval> | null = null;

function readSessionId(): string | null {
  try {
    return sessionStorage.getItem(SESSION_KEY);
  } catch {
    return null;
  }
}

function writeSessionId(id: string): void {
  try {
    sessionStorage.setItem(SESSION_KEY, id);
  } catch {
    /* ignore quota */
  }
}

function clearSessionId(): void {
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    /* ignore */
  }
}

function currentPath(): string {
  return `${window.location.pathname}${window.location.search}`;
}

function projectIdFromPath(): string | null {
  const m = window.location.pathname.match(/\/projects\/([0-9a-f-]{36})/i);
  return m?.[1] ?? null;
}

export async function sendPresenceHeartbeat(): Promise<void> {
  if (document.visibilityState === 'hidden') return;

  const device = getDeviceInfo();
  const body: Record<string, unknown> = {
    device_id: getDeviceId(),
    current_path: currentPath(),
    project_id: projectIdFromPath(),
    ...device,
  };
  const sessionId = readSessionId();
  if (sessionId) body.session_id = sessionId;

  try {
    const res = await authFetch('/api/v1/presence/heartbeat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) return;
    const data = (await res.json()) as { session_id?: string };
    if (data.session_id) writeSessionId(data.session_id);
  } catch {
    /* presence is best-effort */
  }
}

function sendPresenceEndBeacon(): void {
  const sessionId = readSessionId();
  if (!sessionId) return;
  try {
    const blob = new Blob([JSON.stringify({ session_id: sessionId })], {
      type: 'application/json',
    });
    navigator.sendBeacon('/api/v1/presence/end', blob);
  } catch {
    /* ignore */
  }
  clearSessionId();
}

export function startPresenceHeartbeat(): () => void {
  if (heartbeatTimer) return () => stopPresenceHeartbeat();

  void sendPresenceHeartbeat();
  heartbeatTimer = setInterval(() => {
    void sendPresenceHeartbeat();
  }, HEARTBEAT_MS);

  const onVisibility = () => {
    if (document.visibilityState === 'visible') void sendPresenceHeartbeat();
  };
  const onPageHide = () => sendPresenceEndBeacon();

  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('pagehide', onPageHide);

  return () => {
    document.removeEventListener('visibilitychange', onVisibility);
    window.removeEventListener('pagehide', onPageHide);
    stopPresenceHeartbeat();
  };
}

export function stopPresenceHeartbeat(): void {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
}
