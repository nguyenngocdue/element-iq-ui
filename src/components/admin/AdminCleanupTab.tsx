import { AdminGarbagePanel } from './AdminGarbagePanel';

export function AdminCleanupTab({ refreshKey }: { refreshKey: number }) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-[#737373] max-w-2xl">
        Scan orphan files, stale jobs, artifact folders, and temp data. Use <strong className="text-[#b0b0b0]">Clean all</strong> to
        remove junk and prune analysis runs beyond retention.
      </p>
      <AdminGarbagePanel refreshKey={refreshKey} />
    </div>
  );
}
