import type { ApiError } from 'src/lib/http';

import { unwrap } from 'src/lib/http';
import axios, { endpoints } from 'src/lib/axios';
import { getCsrfToken, setCsrfToken, clearCsrfToken } from 'src/lib/csrf-store';

// ----------------------------------------------------------------------
// Session auth actions against the BE. No token is stored in the browser:
// the session lives in an HttpOnly cookie and the CSRF token stays in memory.
// ----------------------------------------------------------------------

export type SessionUser = {
  id: string;
  email: string;
  permissionCodes: string[];
};

export type SignInParams = { email: string; password: string };

type LoginResponse = { user: { id: string; email: string; status: string }; csrfToken: string };
type MeResponse = { userId: string; permissionCodes: string[] };
type CsrfResponse = { csrfToken: string | null };

/** Sign in. Stores the returned CSRF token in memory so later writes pass the BE guard. */
export async function signInWithPassword({ email, password }: SignInParams): Promise<SessionUser> {
  const response = await axios.post(endpoints.auth.login, { email, password });
  const { user, csrfToken } = unwrap<LoginResponse>(response);
  setCsrfToken(csrfToken);
  return { id: user.id, email: user.email, permissionCodes: [] };
}

/** Restore the session on load, and refresh the CSRF token so writes work after a reload. */
export async function fetchSession(): Promise<SessionUser> {
  const meResponse = await axios.get(endpoints.auth.me);
  const me = unwrap<MeResponse>(meResponse);

  // After a reload the in-memory token is gone; fetch it so the first write passes the CSRF guard.
  // Right after login the token is already set, so skip the extra round-trip.
  if (!getCsrfToken()) {
    try {
      const csrfResponse = await axios.get(endpoints.auth.csrf);
      const { csrfToken } = unwrap<CsrfResponse>(csrfResponse);
      if (csrfToken) {
        setCsrfToken(csrfToken);
      }
    } catch {
      // A missing CSRF token is not fatal for reads; a later write re-fetches it.
    }
  }

  return { id: me.userId, email: '', permissionCodes: me.permissionCodes };
}

/** Sign out and drop the in-memory CSRF token. */
export async function signOut(): Promise<void> {
  try {
    await axios.post(endpoints.auth.logout);
  } catch (error) {
    // An already-expired session answers logout with 401; that is still a successful sign-out.
    if ((error as ApiError).status !== 401) {
      throw error;
    }
  } finally {
    clearCsrfToken();
  }
}

/** Request a password reset. The BE responds the same whether or not the email exists. */
export async function forgotPassword(email: string): Promise<void> {
  await axios.post(endpoints.auth.forgotPassword, { email });
}

/** Complete a password reset with the token from the email link. */
export async function resetPassword(params: { token: string; newPassword: string }): Promise<void> {
  await axios.post(endpoints.auth.resetPassword, params);
}

/** Activate an invited account with the token from the email link. */
export async function activateAccount(params: {
  token: string;
  newPassword: string;
}): Promise<void> {
  await axios.post(endpoints.auth.activate, params);
}
