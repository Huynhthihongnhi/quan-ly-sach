import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import * as authApi from '@/lib/api/auth';
import { LoginPage } from '@/features/auth/LoginPage';
import { AuthProvider } from '@/lib/auth/AuthProvider';
import { setCsrfToken } from '@/lib/api/client';
import { ApiClientError } from '@/lib/api/types';
import { adminPermissions, slowLoginHandler } from '../../mocks/handlers';
import { server } from '../../mocks/server';

function LocationProbe(): React.JSX.Element {
  const location = useLocation();
  return <div data-testid="location">{location.pathname}</div>;
}

function renderLogin(route = '/login'): void {
  setCsrfToken(null);
  render(
    <MemoryRouter initialEntries={[route]}>
      <AuthProvider>
        <>
          <LocationProbe />
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/users" element={<div>Users home</div>} />
          </Routes>
        </>
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe('TST-S1-06 login', () => {
  beforeEach(() => {
    vi.spyOn(authApi, 'fetchMe').mockRejectedValue(
      new ApiClientError(401, 'AUTHENTICATION_REQUIRED', 'Session expired.'),
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('redirects to users after successful login', async () => {
    vi.spyOn(authApi, 'login').mockResolvedValue({
      user: { id: '1', email: 'admin@test.local', status: 'active' },
      csrfToken: 'csrf-admin-token',
    });
    vi.spyOn(authApi, 'fetchMe')
      .mockRejectedValueOnce(
        new ApiClientError(401, 'AUTHENTICATION_REQUIRED', 'Session expired.'),
      )
      .mockResolvedValueOnce({
        userId: '1',
        permissionCodes: adminPermissions,
      });

    const user = userEvent.setup();
    renderLogin('/login');

    await waitFor(() => {
      expect(screen.getByLabelText('Email')).toBeInTheDocument();
    });

    await user.type(screen.getByLabelText('Email'), 'admin@test.local');
    await user.type(screen.getByLabelText('Password'), 'AdminPass123!');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    await waitFor(() => {
      expect(screen.getByTestId('location')).toHaveTextContent('/users');
    });
    expect(await screen.findByText('Users home')).toBeInTheDocument();
  });

  it('preserves form values and avoids duplicate submit on network failure', async () => {
    server.use(slowLoginHandler);
    const user = userEvent.setup();
    renderLogin('/login');

    await waitFor(() => {
      expect(screen.getByLabelText('Email')).toBeInTheDocument();
    });

    await user.type(screen.getByLabelText('Email'), 'admin@test.local');
    await user.type(screen.getByLabelText('Password'), 'AdminPass123!');
    const submit = screen.getByRole('button', { name: 'Sign in' });
    await user.click(submit);
    await user.click(submit);

    expect(await screen.findByRole('alert')).toHaveTextContent('Network request failed.');
    expect(screen.getByLabelText('Email')).toHaveValue('admin@test.local');
    expect(screen.getByLabelText('Password')).toHaveValue('AdminPass123!');
    expect(submit).not.toBeDisabled();
  });

  it('links labels to inputs for keyboard access', async () => {
    renderLogin('/login');
    expect(await screen.findByLabelText('Email')).toHaveAttribute('id', 'email');
    expect(screen.getByLabelText('Password')).toHaveAttribute('id', 'password');
  });
});
