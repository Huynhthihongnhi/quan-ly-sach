import { screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Route, Routes } from 'react-router-dom';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { UsersPage } from '@/features/users/UsersPage';
import { RequireAuth } from '@/lib/auth/RequireAuth';
import { RequirePermission } from '@/lib/auth/RequirePermission';
import { setMockSession } from '../../mocks/handlers';
import { renderWithProviders } from '../../test-utils';

describe('TST-S1-06 reader access', () => {
  it('hides admin navigation and shows forbidden page for direct users URL', async () => {
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
          <Route
            path="/users"
            element={
              <RequirePermission permission="users.read">
                <UsersPage />
              </RequirePermission>
            }
          />
        </Route>
      </Routes>,
      {
        route: '/users',
        csrf: 'csrf-reader-token',
      },
    );

    await waitFor(() => {
      expect(screen.queryByRole('link', { name: 'Users' })).not.toBeInTheDocument();
    });
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'You do not have permission to access this page.',
    );
  });
});
