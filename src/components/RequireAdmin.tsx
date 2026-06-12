import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAdminProfile } from '../hooks/useAdminProfile';

export function RequireAdmin({ children }: { children: ReactNode }) {
  const { loading, isAdmin } = useAdminProfile();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-[#10b981] border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-[#b0b0b0]">Loading admin console…</p>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
