import { beforeEach, describe, expect, it, vi } from 'vitest';

const { post, get } = vi.hoisted(() => ({ post: vi.fn(), get: vi.fn() }));

vi.mock('src/lib/axios', () => ({
  default: { post, get },
  endpoints: {
    auth: {
      login: '/auth/login',
      logout: '/auth/logout',
      me: '/auth/me',
      csrf: '/auth/csrf',
      forgotPassword: '/auth/forgot-password',
      resetPassword: '/auth/reset-password',
      activate: '/auth/activate',
    },
  },
}));

import {
  signOut,
  fetchSession,
  resetPassword,
  forgotPassword,
  activateAccount,
  signInWithPassword,
} from 'src/auth/context/jwt/action';
import { getCsrfToken, setCsrfToken, resetCsrfStore } from 'src/lib/csrf-store';

beforeEach(() => {
  post.mockReset();
  get.mockReset();
  resetCsrfStore();
});

describe('auth actions', () => {
  it('signs in, keeps the csrf token in memory and never writes it to browser storage', async () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    post.mockResolvedValueOnce({
      data: { data: { user: { id: 'u1', email: 'a@b.c', status: 'active' }, csrfToken: 'tok-1' } },
    });

    const user = await signInWithPassword({ email: 'a@b.c', password: 'secret1' });

    expect(post).toHaveBeenCalledWith('/auth/login', { email: 'a@b.c', password: 'secret1' });
    expect(user.id).toBe('u1');
    expect(getCsrfToken()).toBe('tok-1');
    expect(setItem).not.toHaveBeenCalled();
    setItem.mockRestore();
  });

  it('propagates the normalized error on a wrong login and keeps no csrf token', async () => {
    post.mockRejectedValueOnce({ status: 401, code: 'AUTHENTICATION_REQUIRED', message: 'x', fields: [] });

    await expect(signInWithPassword({ email: 'a@b.c', password: 'bad' })).rejects.toMatchObject({
      status: 401,
    });
    expect(getCsrfToken()).toBeNull();
  });

  it('restores the session and refreshes the csrf token', async () => {
    get.mockResolvedValueOnce({ data: { data: { userId: 'u1', permissionCodes: ['catalog.read'] } } });
    get.mockResolvedValueOnce({ data: { data: { csrfToken: 'tok-2' } } });

    const user = await fetchSession();

    expect(get).toHaveBeenNthCalledWith(1, '/auth/me');
    expect(get).toHaveBeenNthCalledWith(2, '/auth/csrf');
    expect(user.permissionCodes).toEqual(['catalog.read']);
    expect(getCsrfToken()).toBe('tok-2');
  });

  it('logs out and clears the csrf token', async () => {
    setCsrfToken('tok-x');
    post.mockResolvedValueOnce({ data: {} });

    await signOut();

    expect(post).toHaveBeenCalledWith('/auth/logout');
    expect(getCsrfToken()).toBeNull();
  });

  it('treats a 401 on logout as a successful sign-out and still clears the token', async () => {
    setCsrfToken('tok-x');
    post.mockRejectedValueOnce({ status: 401, code: 'AUTHENTICATION_REQUIRED', message: 'x', fields: [] });

    await expect(signOut()).resolves.toBeUndefined();
    expect(getCsrfToken()).toBeNull();
  });

  it('requests a password reset with the email only', async () => {
    post.mockResolvedValueOnce({ data: {} });

    await forgotPassword('a@b.c');

    expect(post).toHaveBeenCalledWith('/auth/forgot-password', { email: 'a@b.c' });
  });

  it('completes a password reset with the token and new password', async () => {
    post.mockResolvedValueOnce({ data: {} });

    await resetPassword({ token: 'tok-reset', newPassword: 'newpass12' });

    expect(post).toHaveBeenCalledWith('/auth/reset-password', {
      token: 'tok-reset',
      newPassword: 'newpass12',
    });
  });

  it('activates an account with the token and new password', async () => {
    post.mockResolvedValueOnce({ data: {} });

    await activateAccount({ token: 'tok-activate', newPassword: 'newpass12' });

    expect(post).toHaveBeenCalledWith('/auth/activate', {
      token: 'tok-activate',
      newPassword: 'newpass12',
    });
  });
});
