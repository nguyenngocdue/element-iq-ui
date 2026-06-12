import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../lib/auth-context';
import { loginPath } from '../lib/authRoutes';
import { LoadingScreen } from './LoadingScreen';

export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <LoadingScreen
        showBrand
        eyebrow="Authentication"
        title="Checking your session"
        subtitle="Verifying sign-in status"
        showProgress={false}
      />
    );
  }

  if (!user) {
    const returnTo = `${location.pathname}${location.search}`;
    return <Navigate to={loginPath(returnTo)} replace />;
  }

  return <>{children}</>;
}
