import type { LucideIcon } from 'lucide-react';
import { AlertTriangle, CheckCircle, Clock, Loader2, XCircle } from 'lucide-react';
import type { DocumentFile } from '../types';
import { cn } from '../lib/utils';
import {
  statusBadgeClass,
  statusBadgeLabel,
  statusTextClass,
  statusWarnDetailTextClass,
  statusWarnHasDetail,
} from '../lib/analysisStatus';

const WARN_PREFIX_CLASS = 'text-[#f59e0b]';

const REPORT_STATUS_ICONS: Partial<Record<DocumentFile['status'], LucideIcon>> = {
  PASS: CheckCircle,
  FAIL: XCircle,
  'NO-NOTE': AlertTriangle,
  'NO-TUBE': AlertTriangle,
  WARN: AlertTriangle,
  PENDING: Clock,
  ANALYZING: Loader2,
  UPLOADING: Loader2,
};

const REPORT_CHIP_BASE =
  'inline-flex items-center gap-1 w-fit px-2 py-1 text-[10px] font-semibold rounded-sm border';

export function ReportStatusBadge({
  status,
  overallStatus,
  className,
}: {
  status: DocumentFile['status'];
  overallStatus?: string;
  className?: string;
}) {
  const Icon = REPORT_STATUS_ICONS[status] ?? AlertTriangle;
  const spinning = status === 'ANALYZING' || status === 'UPLOADING';

  return (
    <span className={cn(REPORT_CHIP_BASE, statusBadgeClass(status, overallStatus), className)}>
      <Icon className={cn('w-3 h-3 shrink-0', spinning && 'animate-spin')} />
      {statusBadgeLabel(status, overallStatus)}
    </span>
  );
}

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
