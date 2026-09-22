import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse, delay } from 'msw';
import { describe, expect, it } from 'vitest';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { AuthProvider } from '@/lib/auth/AuthProvider';
import { RequireAuth } from '@/lib/auth/RequireAuth';
import { SubmitPurchaseRequestPage } from '@/features/purchases/SubmitPurchaseRequestPage';
import { setCsrfToken } from '@/lib/api/client';
import { setMockSession } from '../../mocks/handlers';
import { server } from '../../mocks/server';
import { renderWithProviders } from '../../test-utils';

function LocationProbe(): React.JSX.Element {
  const location = useLocation();
  return <div data-testid="location">{`${location.pathname}${location.search}`}</div>;
}

describe('submit purchase request', () => {
  it('sends the form once even when the submit button is double-clicked', async () => {
    setMockSession('reader');
    let createCalls = 0;
    server.use(
      http.post('/api/v1/purchase-requests', async () => {
        createCalls += 1;
        await delay(50);
        return HttpResponse.json(
          {
            data: {
              id: '701',
              requesterId: '2',
              title: 'Clean Architecture',
              authorText: 'Robert C. Martin',
              publicationYear: 2017,
              note: null,
              state: 'pending',
              reviewedBy: null,
              reviewReason: null,
              reviewedAt: null,
              version: '1',
              createdAt: new Date().toISOString(),
            },
          },
          { status: 201 },
        );
      }),
    );

    const user = userEvent.setup();
    renderWithProviders(<SubmitPurchaseRequestPage />, { csrf: 'csrf-reader-token' });

    await user.type(screen.getByLabelText('Title'), 'Clean Architecture');
    await user.type(screen.getByLabelText('Author'), 'Robert C. Martin');
    await user.type(screen.getByLabelText('Publication year'), '2017');

    const submit = screen.getByRole('button', { name: 'Submit request' });
    // Fire the first click without awaiting the full (delayed) request so the
    // request is still in flight when the second click lands, exercising the
    // in-flight guard rather than relying on the first request already resolving.
    const firstClick = user.click(submit);
    await waitFor(() => expect(submit).toBeDisabled());
    await user.click(submit);
    await firstClick;

    await waitFor(() => expect(createCalls).toBe(1));
  });

  it('guides a guest to log in with an internal return path', async () => {
    setMockSession(null);
    setCsrfToken(null);

    render(
      <MemoryRouter initialEntries={['/purchase-requests/new']}>
        <AuthProvider>
          <>
            <LocationProbe />
            <Routes>
              <Route path="/login" element={<div>Sign in page</div>} />
              <Route
                path="/purchase-requests/new"
                element={
                  <RequireAuth>
                    <SubmitPurchaseRequestPage />
                  </RequireAuth>
                }
              />
            </Routes>
          </>
        </AuthProvider>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('location')).toHaveTextContent(
        '/login?from=%2Fpurchase-requests%2Fnew',
      );
    });
    expect(screen.getByText('Sign in page')).toBeInTheDocument();
    expect(screen.queryByLabelText('Title')).not.toBeInTheDocument();
  });
});
