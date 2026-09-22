import { useAuth } from '@/lib/auth/AuthProvider';
import { ForbiddenPage } from '@/components/layout/ForbiddenPage';

export function RequirePermission({
  permission,
  children,
}: {
  permission: string;
  children: React.ReactNode;
}): React.JSX.Element {
  const { can, loading } = useAuth();

  if (loading) {
    return (
      <div className="p-6 text-sm text-slate-600" role="status">
        Checking permissions...
      </div>
    );
  }

  if (!can(permission)) {
    return <ForbiddenPage />;
  }

  return <>{children}</>;
}
