const GUEST_VIEWER_KEY = 'elementiq:guest-viewer-id';

export function getGuestViewerId(): string {
  try {
    const existing = localStorage.getItem(GUEST_VIEWER_KEY);
    if (existing) return existing;
    const id = crypto.randomUUID();
    localStorage.setItem(GUEST_VIEWER_KEY, id);
    return id;
  } catch {
    return 'anonymous';
  }
}
