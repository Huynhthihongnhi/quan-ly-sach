import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { AdminPurchaseQueuePage } from '@/features/purchases/AdminPurchaseQueuePage';
import { setMockSession } from '../../mocks/handlers';
import { server } from '../../mocks/server';
import { renderWithProviders } from '../../test-utils';

describe('admin purchase queue', () => {
  it('refreshes to the real state instead of reporting a fake success on a review conflict', async () => {
    setMockSession('librarian');
    const user = userEvent.setup();

    let listCall = 0;
    server.use(
      // After the conflict, the row moves to "approved" and the page must clear its
      // "pending" filter to keep showing it; a request that still says state=pending
      // would get an empty list here, so this handler catches a regression of that fix.
      http.get('/api/v1/admin/purchase-requests', ({ request }) => {
        listCall += 1;
        const row = {
          id: '801',
          requesterId: '2',
          title: 'Contested Request',
          authorText: 'Author B',
          publicationYear: 2019,
          note: null,
          state: listCall === 1 ? 'pending' : 'approved',
          reviewedBy: listCall === 1 ? null : '1',
          reviewReason: null,
          reviewedAt: listCall === 1 ? null : '2026-09-13T08:00:00.000Z',
          version: listCall === 1 ? '1' : '2',
          createdAt: '2026-09-10T08:00:00.000Z',
        };
        const requestedState = new URL(request.url).searchParams.get('state');
        const data = !requestedState || requestedState === row.state ? [row] : [];
        return HttpResponse.json({
          data,
          meta: { page: 1, pageSize: 50, total: data.length },
        });
      }),
      http.post('/api/v1/admin/purchase-requests/:id/review', () =>
        HttpResponse.json(
          {
            error: {
              code: 'VERSION_CONFLICT',
              message: 'Purchase request version is stale.',
            },
          },
          { status: 409 },
        ),
      ),
    );

    renderWithProviders(<AdminPurchaseQueuePage />, { csrf: 'csrf-librarian-token' });

    await screen.findByText('Contested Request');
    expect(screen.getByText('pending')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Approve' }));

    await waitFor(() => expect(screen.getByText('approved')).toBeInTheDocument());
    expect(
      screen.getByText(
        'This request was already reviewed elsewhere. The list now shows its current state.',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Approve' })).not.toBeInTheDocument();
  });

  it('renders a rejection reason as plain text, never as executable markup', async () => {
    setMockSession('librarian');
    const maliciousReason = '<img src=x onerror=alert(1)>ignored html';
    server.use(
      http.get('/api/v1/admin/purchase-requests', () =>
        HttpResponse.json({
          data: [
            {
              id: '802',
              requesterId: '2',
              title: 'Already Rejected',
              authorText: 'Author C',
              publicationYear: 2018,
              note: null,
              state: 'rejected',
              reviewedBy: '1',
              reviewReason: maliciousReason,
              reviewedAt: '2026-09-12T08:00:00.000Z',
              version: '2',
              createdAt: '2026-09-09T08:00:00.000Z',
            },
          ],
          meta: { page: 1, pageSize: 50, total: 1 },
        }),
      ),
    );

    renderWithProviders(<AdminPurchaseQueuePage />, { csrf: 'csrf-librarian-token' });

    await screen.findByText('Already Rejected');
    expect(screen.getByText(maliciousReason)).toBeInTheDocument();
    expect(document.querySelector('img')).toBeNull();
  });
});
