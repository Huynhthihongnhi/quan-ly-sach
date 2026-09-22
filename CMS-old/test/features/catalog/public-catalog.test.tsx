import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, beforeEach } from 'vitest';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { PublicLayout } from '@/components/layout/PublicLayout';
import { CatalogAdminBooksPage } from '@/features/catalog/CatalogAdminBooksPage';
import { PublicCatalogPage } from '@/features/catalog/PublicCatalogPage';
import { AuthProvider } from '@/lib/auth/AuthProvider';
import { RequireAuth } from '@/lib/auth/RequireAuth';
import { RequirePermission } from '@/lib/auth/RequirePermission';
import { setCatalogNetworkFail } from '../../mocks/catalog-handlers';
import { resetMockSession, setMockSession } from '../../mocks/handlers';

function LocationProbe(): React.JSX.Element {
  const location = useLocation();
  return (
    <div data-testid="location">
      {location.pathname}
      {location.search}
    </div>
  );
}

function renderPublicCatalog(route = '/catalog'): void {
  render(
    <MemoryRouter initialEntries={[route]}>
      <AuthProvider>
        <>
          <LocationProbe />
          <Routes>
            <Route element={<PublicLayout />}>
              <Route path="/catalog" element={<PublicCatalogPage />} />
            </Route>
            <Route path="/login" element={<div>Login page</div>} />
          </Routes>
        </>
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe('TST-S3-04 public catalog UI', () => {
  beforeEach(() => {
    resetMockSession();
  });

  it('does not redirect guests to login while browsing the catalog', async () => {
    renderPublicCatalog('/catalog');

    await waitFor(() => {
      expect(screen.getByTestId('location')).toHaveTextContent('/catalog');
    });
    expect(screen.queryByText('Login page')).not.toBeInTheDocument();
    expect(await screen.findByText('Alpha Published')).toBeInTheDocument();
  });

  it('keeps selected filters in the URL for reload and sharing', async () => {
    renderPublicCatalog('/catalog?q=Alpha&categoryId=1&page=2');

    await waitFor(() => {
      expect(screen.getByLabelText('Search')).toHaveValue('Alpha');
    });
    expect(screen.getByTestId('location')).toHaveTextContent('categoryId=1');
    expect(screen.getByTestId('location')).toHaveTextContent('page=2');
    expect(screen.getByText('Page 2 of 1')).toBeInTheDocument();
  });

  it('ignores stale catalog responses when a newer search finishes first', async () => {
    const user = userEvent.setup();
    renderPublicCatalog('/catalog');

    await screen.findByText('Alpha Published');

    const search = screen.getByLabelText('Search');
    await user.clear(search);
    await user.type(search, 'slow');
    await user.clear(search);
    await user.type(search, 'fast');

    await waitFor(
      () => {
        expect(screen.getByText('Fast fresh result')).toBeInTheDocument();
      },
      { timeout: 3000 },
    );
    expect(screen.queryByText('Slow stale result')).not.toBeInTheDocument();
  });

  it('resets filters to the first page without clearing an existing network error', async () => {
    setCatalogNetworkFail(true);
    const user = userEvent.setup();
    renderPublicCatalog('/catalog?q=Alpha&page=2');

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Network request failed.');
    });

    await user.click(screen.getByRole('button', { name: 'Reset filters' }));

    await waitFor(() => {
      expect(screen.getByTestId('location')).toHaveTextContent('/catalog');
      expect(screen.getByTestId('location')).not.toHaveTextContent('page=2');
    });
    expect(screen.getByRole('alert')).toHaveTextContent('Network request failed.');
  });

  it('exposes keyboard-friendly search, filter selects, and pagination controls', async () => {
    renderPublicCatalog('/catalog');

    await screen.findByText('Alpha Published');

    expect(screen.getByLabelText('Search')).toBeInTheDocument();
    expect(screen.getByLabelText('Category')).toBeInTheDocument();
    expect(screen.getByLabelText('Topic')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Previous page' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next page' })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Catalog pagination' })).toBeInTheDocument();
  });

  it('shows CMS catalog metadata only for staff with catalog.read', async () => {
    setMockSession('librarian');

    render(
      <MemoryRouter initialEntries={['/catalog/manage/books']}>
        <AuthProvider>
          <Routes>
            <Route
              element={
                <RequireAuth>
                  <AdminLayout />
                </RequireAuth>
              }
            >
              <Route
                path="/catalog/manage/books"
                element={
                  <RequirePermission permission="catalog.read">
                    <CatalogAdminBooksPage />
                  </RequirePermission>
                }
              />
            </Route>
          </Routes>
        </AuthProvider>
      </MemoryRouter>,
    );

    expect(await screen.findByRole('link', { name: 'Catalog' })).toBeInTheDocument();
    expect(await screen.findByText('Draft title')).toBeInTheDocument();
    expect(await screen.findByText('Alpha Published')).toBeInTheDocument();
  });
});
