import { screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ReportsDashboardPage } from '@/features/reports/ReportsDashboardPage';
import { setMockSession } from '../../mocks/handlers';
import { renderWithProviders } from '../../test-utils';

describe('reports dashboard', () => {
  it('loads circulation, inventory, and purchases totals for the selected range', async () => {
    setMockSession('librarian');
    renderWithProviders(<ReportsDashboardPage />, { csrf: 'csrf-librarian-token' });

    await waitFor(() => expect(screen.getByText('Checkouts: 4')).toBeInTheDocument());
    expect(screen.getByText('Titles: 12')).toBeInTheDocument();
    expect(screen.getByText('Submitted: 5')).toBeInTheDocument();
  });

  it('links each report card to the same-origin CSV export with the selected range', async () => {
    setMockSession('librarian');
    renderWithProviders(<ReportsDashboardPage />, { csrf: 'csrf-librarian-token' });

    await waitFor(() => expect(screen.getByText('Checkouts: 4')).toBeInTheDocument());
    const links = screen.getAllByRole('link', { name: 'Export CSV' });
    expect(links[0]).toHaveAttribute(
      'href',
      expect.stringContaining('/api/v1/reports/circulation?from='),
    );
    expect(links[0]).toHaveAttribute('href', expect.stringContaining('&format=csv'));
    expect(links[1]).toHaveAttribute('href', '/api/v1/reports/inventory?format=csv');
  });
});
