import type { SessionState } from '../types';
import {
  DEFAULT_EXPLORER_SORT,
  DEFAULT_EXPLORER_STATUS,
  type ExplorerSortKey,
  type ExplorerStatusFilter,
} from './fileView';

const SORT_KEYS: ExplorerSortKey[] = ['name-asc', 'name-desc', 'date-desc', 'size-desc'];
const STATUS_KEYS: ExplorerStatusFilter[] = ['all', 'PASS', 'FAIL', 'WARN', 'NO-NOTE'];
const SIDEBAR_TABS = ['explorer', 'search', 'analysis', 'reports', 'settings'] as const;

type SidebarTab = (typeof SIDEBAR_TABS)[number];

const TAB_TO_PARAM: Record<SidebarTab, string> = {
  explorer: 'drawings',
  search: 'search',
  analysis: 'analysis',
  reports: 'reports',
  settings: 'settings',
};

const PARAM_TO_TAB: Record<string, SidebarTab> = {
  drawings: 'explorer',
  explorer: 'explorer',
  search: 'search',
  analysis: 'analysis',
  reports: 'reports',
  settings: 'settings',
};

export type EditorUrlSnapshot = {
  fileId: string | null;
  page: number;
  tab: SidebarTab;
  sidebarOpen: boolean;
  validationOpen: boolean;
  artifactId: string | null;
  editorView: 'pdf' | 'artifact';
  explorerSort: ExplorerSortKey;
  explorerStatus: ExplorerStatusFilter;
  overlayQa: boolean;
  overlaySplit: boolean;
  overlayTitles: boolean;
  overlayViewports: boolean;
  overlayViewportCoords: boolean;
  overlayTags: boolean;
  overlayTagDetach: boolean;
};

function parseBoolParam(value: string | null, defaultValue: boolean): boolean {
  if (value === null || value === '') return defaultValue;
  if (value === '0' || value === 'false') return false;
  if (value === '1' || value === 'true') return true;
  return defaultValue;
}

export function parseEditorUrlParams(search: URLSearchParams): EditorUrlSnapshot {
  const tabRaw = search.get('tab');
  const tab = (tabRaw && PARAM_TO_TAB[tabRaw]) || 'explorer';
  const pageRaw = search.get('page');
  const page = pageRaw ? Math.max(1, parseInt(pageRaw, 10) || 1) : 1;
  const sortRaw = search.get('sort');
  const statusRaw = search.get('status');
  const viewRaw = search.get('view');

  return {
    fileId: search.get('file'),
    page,
    tab,
    sidebarOpen: parseBoolParam(search.get('sb'), true),
    validationOpen: parseBoolParam(search.get('panel'), true),
    artifactId: search.get('artifact'),
    editorView: viewRaw === 'artifact' ? 'artifact' : 'pdf',
    explorerSort: SORT_KEYS.includes(sortRaw as ExplorerSortKey)
      ? (sortRaw as ExplorerSortKey)
      : DEFAULT_EXPLORER_SORT,
    explorerStatus: STATUS_KEYS.includes(statusRaw as ExplorerStatusFilter)
      ? (statusRaw as ExplorerStatusFilter)
      : DEFAULT_EXPLORER_STATUS,
    overlayQa: parseBoolParam(search.get('qa'), true),
    overlaySplit: parseBoolParam(search.get('split'), true),
    overlayTitles: parseBoolParam(search.get('titles'), false),
    overlayViewports: parseBoolParam(search.get('viewports'), false),
    overlayViewportCoords: parseBoolParam(search.get('coords'), false),
    overlayTags: parseBoolParam(search.get('tags'), true),
    overlayTagDetach: parseBoolParam(search.get('tagscope'), false),
  };
}

export function buildEditorSearchParams(state: SessionState): string {
  const params = new URLSearchParams();

  if (state.activeFileId) params.set('file', state.activeFileId);
  if (state.activePage > 1) params.set('page', String(state.activePage));

  const tabParam = TAB_TO_PARAM[state.activeSidebarTab] ?? state.activeSidebarTab;
  if (tabParam !== 'drawings') params.set('tab', tabParam);

  if (!state.isSidebarOpen) params.set('sb', '0');
  if (!state.isValidationOpen) params.set('panel', '0');

  if (state.editorView === 'artifact' && state.activeArtifact?.id) {
    params.set('view', 'artifact');
    params.set('artifact', state.activeArtifact.id);
  }

  if (state.explorerSort !== DEFAULT_EXPLORER_SORT) params.set('sort', state.explorerSort);
  if (state.explorerStatus !== DEFAULT_EXPLORER_STATUS) params.set('status', state.explorerStatus);

  if (!state.overlayQa) params.set('qa', '0');
  if (!state.overlaySplit) params.set('split', '0');
  if (state.overlayTitles) params.set('titles', '1');
  if (state.overlayViewports) params.set('viewports', '1');
  if (state.overlayViewportCoords) params.set('coords', '1');
  if (!state.overlayTags) params.set('tags', '0');
  if (state.overlayTagDetach) params.set('tagscope', '1');

  return params.toString();
}

export function editorStateMatchesUrl(state: SessionState, search: string): boolean {
  const normalized = search.startsWith('?') ? search.slice(1) : search;
  return buildEditorSearchParams(state) === normalized;
}

export function normalizeEditorSearch(search: string): string {
  return search.startsWith('?') ? search.slice(1) : search;
}

export function explorerPrefsFromUrl(search: URLSearchParams): {
  sort: ExplorerSortKey;
  status: ExplorerStatusFilter;
} {
  const parsed = parseEditorUrlParams(search);
  return { sort: parsed.explorerSort, status: parsed.explorerStatus };
}
