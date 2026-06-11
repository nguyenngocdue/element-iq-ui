import type { AnalysisLogLine } from '../types';

export function workerLogPrefix(workerId?: number): string {
  return workerId ? `[W${workerId}] ` : '';
}

export function formatWorkerLogMessage(message: string, workerId?: number): string {
  const prefix = workerLogPrefix(workerId);
  return prefix && !message.startsWith(prefix) ? `${prefix}${message}` : message;
}

export function parseJobIdFromStatusUrl(statusUrl: string): string | null {
  const match = statusUrl.match(/\/jobs\/([^/?]+)/);
  return match?.[1] ?? null;
}

const SERVER_STAGE_RE =
  /^(GPU:|Models:|Engine:|Prepare ·|Scan ·|Read tags ·|Validate ·|Save report ·|Complete ·|TOTAL\b)/i;

export function resolveQueueConcurrencyFromHealth(services?: Record<string, string>): number {
  const userSlots = Number.parseInt(services?.max_user_slots ?? '2', 10);
  const gpuSlots = Number.parseInt(services?.max_gpu_slots ?? '2', 10);
  const user = Number.isFinite(userSlots) && userSlots > 0 ? userSlots : 2;
  const gpu = Number.isFinite(gpuSlots) && gpuSlots > 0 ? gpuSlots : 2;
  return Math.min(user, gpu);
}

export function levelForServerLogLine(line: string): AnalysisLogLine['level'] {
  if (/waiting for GPU/i.test(line)) return 'dim';
  if (/error|failed/i.test(line)) return 'error';
  if (SERVER_STAGE_RE.test(line.trim())) return 'info';
  return 'dim';
}
