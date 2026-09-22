import { act } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';

const { setUnauthorizedHandler, handlerRef } = vi.hoisted(() => {
  const ref: { current: null | (() => void) } = { current: null };
  return {
    setUnauthorizedHandler: vi.fn((fn: null | (() => void)) => {
      ref.current = fn;
    }),
    handlerRef: ref,
  };
});

vi.mock('src/lib/axios', () => ({ default: {}, endpoints: { auth: {} }, setUnauthorizedHandler }));

const { fetchSession } = vi.hoisted(() => ({ fetchSession: vi.fn() }));

vi.mock('src/auth/context/jwt/action', () => ({ fetchSession }));

import { AuthProvider } from 'src/auth/context/jwt';
import { useAuthContext } from 'src/auth/hooks';

function Probe() {
  const { loading, authenticated } = useAuthContext();
  return <div>{loading ? 'loading' : authenticated ? 'auth' : 'guest'}</div>;
}

function renderProvider(client: QueryClient) {
  return render(
    <QueryClientProvider client={client}>
      <AuthProvider>
        <Probe />
      </AuthProvider>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  fetchSession.mockReset();
  setUnauthorizedHandler.mockClear();
  handlerRef.current = null;
});

afterEach(cleanup);

describe('AuthProvider', () => {
  it('marks the session authenticated when /auth/me restores a user', async () => {
    fetchSession.mockResolvedValue({ id: 'u1', email: '', permissionCodes: [] });
    renderProvider(new QueryClient());
    expect(await screen.findByText('auth')).toBeTruthy();
  });

  it('marks the session unauthenticated when restore fails', async () => {
    fetchSession.mockRejectedValue({ status: 401 });
    renderProvider(new QueryClient());
    expect(await screen.findByText('guest')).toBeTruthy();
  });

  it('clears cached data and drops to guest when a 401 handler fires', async () => {
    fetchSession.mockResolvedValue({ id: 'u1', email: '', permissionCodes: [] });
    const client = new QueryClient();
    client.setQueryData(['book', '1'], { id: '1' });
    renderProvider(client);
    await screen.findByText('auth');

    act(() => handlerRef.current?.());

    expect(client.getQueryData(['book', '1'])).toBeUndefined();
    expect(await screen.findByText('guest')).toBeTruthy();
  });
});
