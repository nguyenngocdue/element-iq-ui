import type { PublicAccessLevel } from '../types';

export function normalizePublicAccessLevel(level?: string | null): PublicAccessLevel {
  if (level === 'run' || level === 'run_download') return level;
  return 'view';
}

export function resolveProjectCapabilities(
  isOwner: boolean,
  isPublic: boolean,
  level: PublicAccessLevel,
) {
  if (isOwner) {
    return { canRun: true, canDownload: true, isReadOnly: false };
  }
  if (!isPublic) {
    return { canRun: false, canDownload: false, isReadOnly: true };
  }
  return {
    canRun: level === 'run' || level === 'run_download',
    canDownload: level === 'run_download',
    isReadOnly: level === 'view',
  };
}

export function publicAccessLevelLabel(level: PublicAccessLevel): string {
  switch (level) {
    case 'run_download':
      return 'Run + Download';
    case 'run':
      return 'Run (local)';
    default:
      return 'View only';
  }
}
