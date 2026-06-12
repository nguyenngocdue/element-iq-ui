import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAdminProfile } from '../hooks/useAdminProfile';
import { LoadingScreen } from './LoadingScreen';

export function RequireAdmin({ children }: { children: ReactNode }) {
  const { loading, isAdmin } = useAdminProfile();

  if (loading) {
    return (
      <LoadingScreen
        background="admin"
        showBrand
        eyebrow="Administration"
        title="Loading admin console"
        subtitle="Verifying permissions and preparing dashboard"
        showProgress={false}
      />
    );
  }

  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
