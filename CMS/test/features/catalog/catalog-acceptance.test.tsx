import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, beforeEach } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { PublicLayout } from '@/components/layout/PublicLayout';
import { PublicBookDetailPage } from '@/features/catalog/PublicBookDetailPage';
import { PublicCatalogPage } from '@/features/catalog/PublicCatalogPage';
import { AuthProvider } from '@/lib/auth/AuthProvider';
import { resetMockSession } from '../../mocks/handlers';

function renderGuestCatalog(route = '/catalog'): void {
  render(
    <MemoryRouter initialEntries={[route]}>
      <AuthProvider>
        <Routes>
          <Route element={<PublicLayout />}>
            <Route path="/catalog" element={<PublicCatalogPage />} />
            <Route path="/catalog/view/:id" element={<PublicBookDetailPage />} />
          </Route>
          <Route path="/login" element={<div>Login page</div>} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe('TST-S3-06 catalog acceptance UI', () => {
  beforeEach(() => {
    resetMockSession();
  });

  it('lets guests search by keyword, topic, and year without signing in', async () => {
    const user = userEvent.setup();
    renderGuestCatalog('/catalog');

    await screen.findByText('Alpha Published');

    await user.selectOptions(screen.getByLabelText('Topic'), '22');
    await user.clear(screen.getByLabelText('Publication year'));
    await user.type(screen.getByLabelText('Publication year'), '2020');

    await waitFor(() => {
      expect(screen.getByText('Đại số cơ bản')).toBeInTheDocument();
    });
    expect(screen.queryByText('Login page')).not.toBeInTheDocument();
  });

  it('opens book detail and shows accepted inventory placeholder for guests', async () => {
    renderGuestCatalog('/catalog/view/103');

    expect(await screen.findByRole('heading', { name: 'Đại số cơ bản' })).toBeInTheDocument();
    expect(screen.getByText(/Nguyễn Văn A/)).toBeInTheDocument();
    expect(
      screen.getByText('Available copies: not shown before circulation is enabled.'),
    ).toBeInTheDocument();
    expect(screen.queryByText(/barcode/i)).not.toBeInTheDocument();
  });

  it('exposes temp.md lookup dimensions in the catalog filter form', async () => {
    renderGuestCatalog('/catalog');

    await screen.findByText('Alpha Published');

    expect(screen.getByLabelText('Search')).toBeInTheDocument();
    expect(screen.getByLabelText('Category')).toBeInTheDocument();
    expect(screen.getByLabelText('Topic')).toBeInTheDocument();
    expect(screen.getByLabelText('Publication year')).toBeInTheDocument();
  });
});
