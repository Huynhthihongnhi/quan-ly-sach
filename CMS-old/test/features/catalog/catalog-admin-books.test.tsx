import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { CatalogAdminBooksPage } from '@/features/catalog/CatalogAdminBooksPage';
import { setMockSession } from '../../mocks/handlers';
import { renderWithProviders } from '../../test-utils';

describe('CatalogAdminBooksPage', () => {
  it('filters the list by state', async () => {
    setMockSession('admin');
    const user = userEvent.setup();

    renderWithProviders(<CatalogAdminBooksPage />, {
      route: '/catalog/manage/books',
      csrf: 'csrf-admin-token',
    });

    await screen.findByText('Alpha Published');
    expect(screen.getByText('Draft title')).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText('State'), 'draft');

    await waitFor(() => {
      expect(screen.queryByText('Alpha Published')).not.toBeInTheDocument();
    });
    expect(screen.getByText('Draft title')).toBeInTheDocument();
  });

  it('creates a new book and reloads the list', async () => {
    setMockSession('admin');
    const user = userEvent.setup();

    renderWithProviders(<CatalogAdminBooksPage />, {
      route: '/catalog/manage/books',
      csrf: 'csrf-admin-token',
    });

    await screen.findByText('Alpha Published');
    await user.click(screen.getByRole('button', { name: 'Create book' }));

    await user.type(screen.getByLabelText('Title'), 'New Test Book');
    await user.selectOptions(screen.getByLabelText('Category'), '1');
    await user.click(screen.getByRole('button', { name: 'Create' }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });
});
