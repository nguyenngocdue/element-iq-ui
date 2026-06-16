import type { ReactNode } from 'react';
import { useAdminProfile } from '../hooks/useAdminProfile';
import { AdminAccessDenied, type AdminArea } from './AdminAccessDenied';
import { LoadingScreen } from './LoadingScreen';

export function RequireAdmin({
  children,
  area = 'admin',
}: {
  children: ReactNode;
  area?: AdminArea;
}) {
  const { loading, isAdmin } = useAdminProfile();

  if (loading) {
    return (
      <LoadingScreen
        background="admin"
        showBrand
        spinnerSize="lg"
        eyebrow="Administration"
        title="Checking access"
        subtitle="Verifying your account role"
        showProgress={false}
      />
    );
  }

  if (!isAdmin) {
    return <AdminAccessDenied area={area} />;
  }

  return <>{children}</>;
}
