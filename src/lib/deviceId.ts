const DEVICE_ID_KEY = 'elementiq:device-id';

/** Persistent browser/device id — survives tab close; used for license seat counting. */
export function getDeviceId(): string {
  try {
    const existing = localStorage.getItem(DEVICE_ID_KEY);
    if (existing) return existing;
    const id = crypto.randomUUID();
    localStorage.setItem(DEVICE_ID_KEY, id);
    return id;
  } catch {
    return `fallback-${Date.now()}`;
  }
}
