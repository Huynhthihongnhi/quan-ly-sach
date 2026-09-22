import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { CirculationAdminPage } from '@/features/circulation/CirculationAdminPage';
import { MyLoansPage } from '@/features/circulation/MyLoansPage';
import type { AdminLoanRecord } from '@/lib/api/loans';
import { setMockSession } from '../../mocks/handlers';
import { server } from '../../mocks/server';
import { renderWithProviders } from '../../test-utils';

function loan(index: number): AdminLoanRecord {
  return {
    id: String(1050 - index), userId: '2', bookId: '106', copyId: String(600 + index),
    state: 'returned', requestedDays: 7, reservedAt: '2026-09-01T08:00:00Z',
    reservationExpiresAt: '2026-09-02T08:00:00Z', checkedOutAt: '2026-09-01T09:00:00Z',
    dueAt: '2026-09-08T09:00:00Z', version: '2',
  };
}

describe('loan list pagination', () => {
  it('lets staff find and return the 51st loan and reset the page when filtering', async () => {
    setMockSession('librarian');
    const user = userEvent.setup();
    const rows = Array.from({ length: 51 }, (_, index) => loan(index));
    rows[50]!.state = 'borrowed';
    const requests: string[] = [];
    let returnedId: string | undefined;
    server.use(
      http.get('/api/v1/admin/loans', ({ request }) => {
        const url = new URL(request.url);
        requests.push(url.search);
        const page = Number(url.searchParams.get('page'));
        const size = Number(url.searchParams.get('pageSize'));
        const state = url.searchParams.get('state');
        const filtered = rows.filter((row) => !state || row.state === state);
        return HttpResponse.json({ data: filtered.slice((page - 1) * size, page * size),
          meta: { page, pageSize: size, total: filtered.length } });
      }),
      http.post('/api/v1/admin/loans/:id/return', ({ params }) => {
        returnedId = String(params.id);
        rows[50]!.state = 'returned';
        return HttpResponse.json({ data: rows[50] });
      }),
    );
    renderWithProviders(<CirculationAdminPage />, { csrf: 'csrf-librarian-token' });
    await screen.findByText('Page 1 of 2');
    await user.click(screen.getByRole('button', { name: 'Next' }));
    await screen.findByText('1000');
    await user.click(screen.getByRole('button', { name: 'Return' }));
    await waitFor(() => expect(returnedId).toBe('1000'));
    await user.selectOptions(screen.getByLabelText('Loan status'), 'borrowed');
    await waitFor(() => expect(new URLSearchParams(requests.at(-1)).get('state')).toBe('borrowed'));
    expect(new URLSearchParams(requests.at(-1)).get('page')).toBe('1');
  });

  it('lets a reader open the receipt beyond the first 20 loans', async () => {
    setMockSession('reader');
    const user = userEvent.setup();
    const rows = Array.from({ length: 21 }, (_, index) => loan(index));
    server.use(http.get('/api/v1/me/loans', ({ request }) => {
      const page = Number(new URL(request.url).searchParams.get('page'));
      return HttpResponse.json({ data: rows.slice((page - 1) * 20, page * 20),
        meta: { page, pageSize: 20, total: rows.length } });
    }));
    renderWithProviders(<MyLoansPage />, { csrf: 'csrf-reader-token' });
    await screen.findByText('Page 1 of 2');
    await user.click(screen.getByRole('button', { name: 'Next' }));
    await screen.findByText('Loan #1030');
    expect(screen.getByRole('link', { name: 'Receipt' })).toHaveAttribute('href', '/me/loans/1030');
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
  });
});
