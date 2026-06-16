const STORAGE_KEY = 'elementiq:model-lab-default-weights:v1';

/** Per component-group preferred weights filename (browser-only). */
export type ModelLabDefaultsMap = Record<string, string>;

export function readModelLabDefaults(): ModelLabDefaultsMap {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const out: ModelLabDefaultsMap = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value === 'string' && value.length > 0) out[key] = value;
    }
    return out;
  } catch {
    return {};
  }
}

function persist(next: ModelLabDefaultsMap): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // private mode / quota
  }
}

export function writeModelLabDefault(groupId: string, filename: string): ModelLabDefaultsMap {
  const next = { ...readModelLabDefaults(), [groupId]: filename };
  persist(next);
  return next;
}

export function clearModelLabDefault(groupId: string): ModelLabDefaultsMap {
  const next = { ...readModelLabDefaults() };
  delete next[groupId];
  persist(next);
  return next;
}
