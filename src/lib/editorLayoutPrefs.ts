/** Persist sidebar + validation panel open/closed across sessions. */

export interface EditorLayoutPrefs {
  isSidebarOpen: boolean;
  isValidationOpen: boolean;
}

const STORAGE_KEY = 'elementiq:layout';

const DEFAULTS: EditorLayoutPrefs = {
  isSidebarOpen: true,
  isValidationOpen: true,
};

export function readEditorLayoutPrefs(): EditorLayoutPrefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULTS };
    const parsed = JSON.parse(raw) as Partial<EditorLayoutPrefs>;
    return {
      isSidebarOpen: parsed.isSidebarOpen ?? DEFAULTS.isSidebarOpen,
      isValidationOpen: parsed.isValidationOpen ?? DEFAULTS.isValidationOpen,
    };
  } catch {
    return { ...DEFAULTS };
  }
}

export function writeEditorLayoutPrefs(prefs: EditorLayoutPrefs): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    /* quota / private mode */
  }
}

/** URL ?sb=0 / ?panel=0 overrides stored prefs when explicitly set. */
export function resolveLayoutOpenFromSearch(
  search: URLSearchParams,
  param: 'sb' | 'panel',
  storedDefault: boolean,
): boolean {
  if (!search.has(param)) return storedDefault;
  const value = search.get(param);
  if (value === '0' || value === 'false') return false;
  if (value === '1' || value === 'true') return true;
  return storedDefault;
}
