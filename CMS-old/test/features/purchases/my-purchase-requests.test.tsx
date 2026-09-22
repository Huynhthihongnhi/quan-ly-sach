import { screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { MyPurchaseRequestsPage } from '@/features/purchases/MyPurchaseRequestsPage';
import { setMockSession } from '../../mocks/handlers';
import { server } from '../../mocks/server';
import { renderWithProviders } from '../../test-utils';

describe('my purchase requests history', () => {
  it("shows only the signed-in reader's own requests, including a rejection reason", async () => {
    setMockSession('reader');
    server.use(
      http.get('/api/v1/me/purchase-requests', () =>
        HttpResponse.json({
          data: [
            {
              id: '701',
              requesterId: '2',
              title: 'My Own Request',
              authorText: 'Author A',
              publicationYear: 2021,
              note: null,
              state: 'rejected',
              reviewedBy: '3',
              reviewReason: 'Already in the catalog under a different edition.',
              reviewedAt: '2026-09-12T08:00:00.000Z',
              version: '2',
              createdAt: '2026-09-10T08:00:00.000Z',
            },
          ],
          meta: { page: 1, pageSize: 20, total: 1 },
        }),
      ),
    );

    renderWithProviders(<MyPurchaseRequestsPage />, { csrf: 'csrf-reader-token' });

    await waitFor(() => expect(screen.getByText('My Own Request')).toBeInTheDocument());
    expect(screen.getByText('rejected')).toBeInTheDocument();
    expect(
      screen.getByText('Reason: Already in the catalog under a different edition.'),
    ).toBeInTheDocument();
  });
});
