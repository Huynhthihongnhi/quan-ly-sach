import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { fetchMe, login as loginRequest, logout as logoutRequest } from '@/lib/api/auth';
import {
  isPublicAuthRecoveryPath,
  isSafeInternalPath,
  setCsrfToken,
  setUnauthorizedHandler,
} from '@/lib/api/client';
import { hasPermission } from '@/lib/permissions';

interface AuthState {
  userId: string | null;
  permissionCodes: string[];
  loading: boolean;
}

interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<string[]>;
  logout: () => Promise<void>;
  refresh: () => Promise<boolean>;
  can: (permission: string) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const navigate = useNavigate();
  const location = useLocation();
  const [state, setState] = useState<AuthState>({
    userId: null,
    permissionCodes: [],
    loading: true,
  });

  const refresh = useCallback(async (): Promise<boolean> => {
    try {
      const skipAuthRedirect = isPublicAuthRecoveryPath(location.pathname);
      const me = await fetchMe({ skipAuthRedirect });
      setState({
        userId: me.userId,
        permissionCodes: me.permissionCodes,
        loading: false,
      });
      return true;
    } catch {
      setState({ userId: null, permissionCodes: [], loading: false });
      setCsrfToken(null);
      return false;
    }
  }, [location.pathname]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    setUnauthorizedHandler((path) => {
      const pathname = path.split('?')[0] ?? path;
      if (isPublicAuthRecoveryPath(pathname)) {
        return;
      }
      const redirect = isSafeInternalPath(pathname) ? `?from=${encodeURIComponent(path)}` : '';
      navigate(`/login${redirect}`, { replace: true });
    });
  }, [navigate]);

  const login = useCallback(async (email: string, password: string): Promise<string[]> => {
    const result = await loginRequest(email, password);
    setCsrfToken(result.csrfToken);
    const me = await fetchMe();
    setState({
      userId: me.userId,
      permissionCodes: me.permissionCodes,
      loading: false,
    });
    return me.permissionCodes;
  }, []);

  const logout = useCallback(async () => {
    try {
      await logoutRequest();
    } finally {
      setCsrfToken(null);
      setState({ userId: null, permissionCodes: [], loading: false });
      navigate('/login', { replace: true });
    }
  }, [navigate]);

  const value = useMemo<AuthContextValue>(
    () => ({
      ...state,
      login,
      logout,
      refresh,
      can: (permission: string) => hasPermission(state.permissionCodes, permission),
    }),
    [state, login, logout, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
