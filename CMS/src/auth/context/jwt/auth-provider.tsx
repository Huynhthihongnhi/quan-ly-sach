import { useSetState } from 'minimal-shared/hooks';
import { useQueryClient } from '@tanstack/react-query';
import { useMemo, useEffect, useCallback } from 'react';

import { clearCsrfToken } from 'src/lib/csrf-store';
import { setUnauthorizedHandler } from 'src/lib/axios';

import { fetchSession } from './action';
import { AuthContext } from '../auth-context';

import type { AuthState } from '../../types';

// ----------------------------------------------------------------------

type Props = {
  children: React.ReactNode;
};

export function AuthProvider({ children }: Props) {
  const { state, setState } = useSetState<AuthState>({ user: null, loading: true });
  const queryClient = useQueryClient();

  const checkUserSession = useCallback(async () => {
    try {
      const user = await fetchSession();
      setState({ user, loading: false });
    } catch {
      setState({ user: null, loading: false });
    }
  }, [setState]);

  useEffect(() => {
    // On any 401 (expired or revoked session): drop CSRF, clear cached data, mark unauthenticated.
    // AuthGuard reacts to `authenticated` and redirects; no hard navigation lives in the transport.
    setUnauthorizedHandler(() => {
      clearCsrfToken();
      queryClient.clear();
      setState({ user: null, loading: false });
    });
    return () => setUnauthorizedHandler(null);
  }, [queryClient, setState]);

  useEffect(() => {
    checkUserSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const status = state.loading ? 'loading' : state.user ? 'authenticated' : 'unauthenticated';

  const memoizedValue = useMemo(
    () => ({
      user: state.user,
      checkUserSession,
      loading: status === 'loading',
      authenticated: status === 'authenticated',
      unauthenticated: status === 'unauthenticated',
    }),
    [checkUserSession, state.user, status]
  );

  return <AuthContext value={memoizedValue}>{children}</AuthContext>;
}
