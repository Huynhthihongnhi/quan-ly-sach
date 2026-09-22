import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/lib/auth/AuthProvider';
import { isSafeInternalPath } from '@/lib/api/client';

export function RequireAuth({ children }: { children: React.ReactNode }): React.JSX.Element {
  const { userId, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-slate-600">
        Loading session...
      </div>
    );
  }

  if (!userId) {
    const from = isSafeInternalPath(location.pathname)
      ? `?from=${encodeURIComponent(location.pathname)}`
      : '';
    return <Navigate to={`/login${from}`} replace />;
  }

  return <>{children}</>;
}
