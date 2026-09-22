import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { LoginPage } from '@/features/auth/LoginPage';
import { RequireAuth } from '@/lib/auth/RequireAuth';
import { AuthProvider } from '@/lib/auth/AuthProvider';
import { setCsrfToken } from '@/lib/api/client';

function LocationProbe(): React.JSX.Element {
  const location = useLocation();
  return <div data-testid="location">{`${location.pathname}${location.search}`}</div>;
}

describe('TST-S1-06 session expiry redirect', () => {
  it('returns to login and keeps a safe internal return path', async () => {
    setCsrfToken(null);

    render(
      <MemoryRouter initialEntries={['/users']}>
        <AuthProvider>
          <>
            <LocationProbe />
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route
                path="/users"
                element={
                  <RequireAuth>
                    <div>Protected users</div>
                  </RequireAuth>
                }
              />
            </Routes>
          </>
        </AuthProvider>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('location')).toHaveTextContent('/login?from=%2Fusers');
    });
    expect(screen.getByRole('heading', { name: 'Sign in to CMS' })).toBeInTheDocument();
  });
});
