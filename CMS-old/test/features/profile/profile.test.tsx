import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Route, Routes } from 'react-router-dom';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { ProfilePage } from '@/features/profile/ProfilePage';
import { RequireAuth } from '@/lib/auth/RequireAuth';
import * as profileApi from '@/lib/api/profile';
import { ApiClientError } from '@/lib/api/types';
import { setMockSession } from '../../mocks/handlers';
import { renderWithProviders } from '../../test-utils';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('TST-S2-05 profile page', () => {
  it('loads and saves the signed-in user profile', async () => {
    setMockSession('reader');
    const user = userEvent.setup();

    renderWithProviders(
      <Routes>
        <Route
          element={
            <RequireAuth>
              <AdminLayout />
            </RequireAuth>
          }
        >
          <Route path="/profile" element={<ProfilePage />} />
        </Route>
      </Routes>,
      {
        route: '/profile',
        csrf: 'csrf-reader-token',
      },
    );

    expect(await screen.findByLabelText('Display name')).toHaveValue('Reader');

    await user.clear(screen.getByLabelText('Display name'));
    await user.type(screen.getByLabelText('Display name'), 'Reader Updated');
    await user.click(screen.getByRole('button', { name: 'Save profile' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Profile saved.');
    expect(screen.getByLabelText('Display name')).toHaveValue('Reader Updated');
  });

  it('shows library cards issued to the signed-in reader', async () => {
    setMockSession('reader');

    renderWithProviders(
      <Routes>
        <Route
          element={
            <RequireAuth>
              <AdminLayout />
            </RequireAuth>
          }
        >
          <Route path="/profile" element={<ProfilePage />} />
        </Route>
      </Routes>,
      {
        route: '/profile',
        csrf: 'csrf-reader-token',
      },
    );

    expect(await screen.findByText('CARD-READER-MSW')).toBeInTheDocument();
    expect(screen.getByText(/active · expires/i)).toBeInTheDocument();
  });

  it('shows a version conflict message when profile save is stale', async () => {
    setMockSession('admin');
    const user = userEvent.setup();

    vi.spyOn(profileApi, 'fetchOwnProfile').mockResolvedValue({
      userId: '1',
      displayName: 'Admin',
      phone: null,
      version: '1',
    });
    vi.spyOn(profileApi, 'updateOwnProfile').mockRejectedValue(
      new ApiClientError(409, 'VERSION_CONFLICT', 'Profile version is stale.'),
    );

    renderWithProviders(
      <Routes>
        <Route path="/profile" element={<ProfilePage />} />
      </Routes>,
      {
        route: '/profile',
        csrf: 'csrf-admin-token',
      },
    );

    await screen.findByLabelText('Display name');
    await user.click(screen.getByRole('button', { name: 'Save profile' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Profile changed elsewhere. Reload the page and try again.',
    );
  });
});
