import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import * as authApi from '@/lib/api/auth';
import { ForgotPasswordPage } from '@/features/auth/ForgotPasswordPage';
import { LoginPage } from '@/features/auth/LoginPage';
import { ResetPasswordPage } from '@/features/auth/ResetPasswordPage';
import { AuthProvider } from '@/lib/auth/AuthProvider';
import { setCsrfToken } from '@/lib/api/client';
import { resolvePostLoginPath } from '@/lib/navigation';
import { ApiClientError } from '@/lib/api/types';
import {
  FORGOT_PASSWORD_ACCEPTED_MESSAGE,
  resetMockSession,
} from '../../mocks/handlers';

function LocationProbe(): React.JSX.Element {
  const location = useLocation();
  return (
    <div
      data-testid="location"
    >{`${location.pathname}${location.search}${JSON.stringify(location.state)}`}</div>
  );
}

function renderRecoveryRoutes(initialRoute: string): void {
  setCsrfToken(null);
  resetMockSession();
  render(
    <MemoryRouter initialEntries={[initialRoute]}>
      <AuthProvider>
        <>
          <LocationProbe />
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
          </Routes>
        </>
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe('TST-S2-05 auth recovery', () => {
  beforeEach(() => {
    vi.spyOn(authApi, 'fetchMe').mockRejectedValue(
      new ApiClientError(401, 'AUTHENTICATION_REQUIRED', 'Session expired.'),
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each(['missing@test.local', 'admin@test.local'])(
    'shows the same forgot-password message for %s',
    async (email) => {
      const user = userEvent.setup();
      renderRecoveryRoutes('/forgot-password');

      await user.type(screen.getByLabelText('Email'), email);
      await user.click(screen.getByRole('button', { name: 'Send reset instructions' }));

      expect(await screen.findByRole('alert')).toHaveTextContent(FORGOT_PASSWORD_ACCEPTED_MESSAGE);
    },
  );

  it('shows a field error when confirmation passwords do not match', async () => {
    const user = userEvent.setup();
    renderRecoveryRoutes('/reset-password?token=valid-reset-token');

    await waitFor(() => {
      expect(screen.getByTestId('location')).toHaveTextContent('/reset-password');
      expect(screen.getByTestId('location').textContent).not.toContain('token=');
    });

    await user.type(screen.getByLabelText('New password'), 'ValidPass123!');
    await user.type(screen.getByLabelText('Confirm password'), 'DifferentPass1!');
    await user.click(screen.getByRole('button', { name: 'Reset password' }));

    expect(await screen.findByText('Passwords do not match.')).toBeInTheDocument();
  });

  it('shows a field error when the password is too short', async () => {
    const user = userEvent.setup();
    renderRecoveryRoutes('/reset-password?token=valid-reset-token');

    await user.type(screen.getByLabelText('New password'), 'short');
    await user.type(screen.getByLabelText('Confirm password'), 'short');
    await user.click(screen.getByRole('button', { name: 'Reset password' }));

    expect(await screen.findByText('Password must be at least 12 characters.')).toBeInTheDocument();
  });

  it('maps server password policy errors to the new password field', async () => {
    vi.spyOn(authApi, 'resetPassword').mockRejectedValueOnce(
      new ApiClientError(422, 'VALIDATION_FAILED', 'Password does not meet policy requirements.', [
        { field: 'newPassword', code: 'TOO_SHORT' },
      ]),
    );

    const user = userEvent.setup();
    renderRecoveryRoutes('/reset-password?token=valid-reset-token');

    await user.type(screen.getByLabelText('New password'), 'ValidPass123!');
    await user.type(screen.getByLabelText('Confirm password'), 'ValidPass123!');
    await user.click(screen.getByRole('button', { name: 'Reset password' }));

    expect(await screen.findByText('Password must be at least 12 characters.')).toBeInTheDocument();
  });

  it('submits reset only once and does not auto-login afterward', async () => {
    const resetSpy = vi.spyOn(authApi, 'resetPassword').mockResolvedValue(undefined);
    const loginSpy = vi.spyOn(authApi, 'login');

    const user = userEvent.setup();
    renderRecoveryRoutes('/reset-password?token=valid-reset-token');

    await user.type(screen.getByLabelText('New password'), 'NewSecurePass1!');
    await user.type(screen.getByLabelText('Confirm password'), 'NewSecurePass1!');
    const submit = screen.getByRole('button', { name: 'Reset password' });
    await user.click(submit);
    await user.click(submit);

    await waitFor(() => {
      expect(screen.getByTestId('location')).toHaveTextContent('/login');
    });

    expect(resetSpy).toHaveBeenCalledTimes(1);
    expect(loginSpy).not.toHaveBeenCalled();
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Password updated. Sign in with your new password.',
    );
  });

  it('blocks unsafe client-provided redirect paths after login', () => {
    expect(resolvePostLoginPath('//evil.example.test/users', ['users.read'])).toBe('/users');
    expect(resolvePostLoginPath('https://evil.example.test/users', ['users.read'])).toBe('/users');
    expect(resolvePostLoginPath('/users', ['users.read'])).toBe('/users');
  });

  it('shows expiry guidance for invalid reset tokens', async () => {
    const user = userEvent.setup();
    renderRecoveryRoutes('/reset-password?token=expired-token');

    await user.type(screen.getByLabelText('New password'), 'NewSecurePass1!');
    await user.type(screen.getByLabelText('Confirm password'), 'NewSecurePass1!');
    await user.click(screen.getByRole('button', { name: 'Reset password' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'The link is invalid or has expired.',
    );
    expect(screen.getByRole('link', { name: 'Request a new reset link' })).toHaveAttribute(
      'href',
      '/forgot-password',
    );
  });
});
