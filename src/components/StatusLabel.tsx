import type { DocumentFile } from '../types';
import { cn } from '../lib/utils';
import {
  statusBadgeLabel,
  statusTextClass,
  statusWarnDetailTextClass,
  statusWarnHasDetail,
} from '../lib/analysisStatus';

const WARN_PREFIX_CLASS = 'text-[#f59e0b]';

export function StatusLabel({
  status,
  overallStatus,
  className,
}: {
  status: DocumentFile['status'];
  overallStatus?: string;
  className?: string;
}) {
  if (status === 'WARN' && statusWarnHasDetail(overallStatus)) {
    const detail = overallStatus!.trim().toUpperCase();
    return (
      <span className={className}>
        <span className={WARN_PREFIX_CLASS}>WARN</span>
        <span className={statusWarnDetailTextClass(overallStatus)}>-{detail}</span>
      </span>
    );
  }

  return (
    <span className={cn(statusTextClass(status, overallStatus), className)}>
      {statusBadgeLabel(status, overallStatus)}
    </span>
  );
}
