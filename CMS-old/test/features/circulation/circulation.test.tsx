import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Route, Routes } from 'react-router-dom';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { PublicLayout } from '@/components/layout/PublicLayout';
import { PublicBookDetailPage } from '@/features/catalog/PublicBookDetailPage';
import { LoanReceiptPage } from '@/features/circulation/LoanReceiptPage';
import { RequireAuth } from '@/lib/auth/RequireAuth';
import { RequirePermission } from '@/lib/auth/RequirePermission';
import * as loansApi from '@/lib/api/loans';
import {
  resetCirculationMocks,
  setBook106AvailableCopies,
  setSimulateNoCopyOnReserve,
} from '../../mocks/circulation-handlers';
import { getLoanCreateCount, setMockSession } from '../../mocks/handlers';
import { renderWithProviders } from '../../test-utils';

afterEach(() => {
  vi.restoreAllMocks();
  resetCirculationMocks();
});

describe('TST-S5-05 circulation UI', () => {
  it('shows no-copy messaging and updates availability when reserve fails', async () => {
    setMockSession('reader');
    setBook106AvailableCopies(1);
    setSimulateNoCopyOnReserve(true);
    const user = userEvent.setup();

    renderWithProviders(
      <Routes>
        <Route element={<PublicLayout />}>
          <Route path="/catalog/view/:id" element={<PublicBookDetailPage />} />
        </Route>
      </Routes>,
      { route: '/catalog/view/106', csrf: 'csrf-reader-token' },
    );

    expect(await screen.findByText(/available copies: 1/i)).toBeInTheDocument();
    await user.type(screen.getByLabelText('Library card number'), 'CARD-READER-MSW');
    await user.type(screen.getByLabelText(/account password/i), 'ReaderPass123!');
    await user.click(screen.getByRole('button', { name: 'Reserve copy' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/no copies are available/i);
    expect(screen.getByText(/available copies: 0/i)).toBeInTheDocument();
  });

  it('blocks reader A from viewing reader B loan receipt via URL', async () => {
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
            path="/me/loans/:id"
            element={
              <RequirePermission permission="loans.read.own">
                <LoanReceiptPage />
              </RequirePermission>
            }
          />
        </Route>
      </Routes>,
      { route: '/me/loans/911', csrf: 'csrf-reader-token' },
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(/does not belong/i);
  });

  it('does not create two loans when reserve is double-clicked', async () => {
    setMockSession('reader');
    setBook106AvailableCopies(2);
    const user = userEvent.setup();
    const createSpy = vi.spyOn(loansApi, 'createLoanReservation');

    renderWithProviders(
      <Routes>
        <Route element={<PublicLayout />}>
          <Route path="/catalog/view/:id" element={<PublicBookDetailPage />} />
        </Route>
      </Routes>,
      { route: '/catalog/view/106', csrf: 'csrf-reader-token' },
    );

    await screen.findByText('Borrowable Sample');
    await user.type(screen.getByLabelText('Library card number'), 'CARD-READER-MSW');
    await user.type(screen.getByLabelText(/account password/i), 'ReaderPass123!');
    const button = screen.getByRole('button', { name: 'Reserve copy' });
    await user.click(button);
    await user.click(button);

    await waitFor(() => expect(createSpy).toHaveBeenCalledTimes(1));
    expect(getLoanCreateCount()).toBe(1);
  });

  it('shows loan id, title, dates, and state on the printable receipt', async () => {
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
            path="/me/loans/:id"
            element={
              <RequirePermission permission="loans.read.own">
                <LoanReceiptPage />
              </RequirePermission>
            }
          />
        </Route>
      </Routes>,
      { route: '/me/loans/910', csrf: 'csrf-reader-token' },
    );

    expect(await screen.findByRole('heading', { name: /loan receipt #910/i })).toBeInTheDocument();
    expect(screen.getByText('Borrowable Sample')).toBeInTheDocument();
    expect(screen.getByText('reserved')).toBeInTheDocument();
    expect(screen.getByText(/requested days/i)).toBeInTheDocument();
  });

  it('does not mutate loans when printing fails', async () => {
    setMockSession('reader');
    const user = userEvent.setup();
    const createSpy = vi.spyOn(loansApi, 'createLoanReservation');
    const detailSpy = vi.spyOn(loansApi, 'fetchLoanDetail');
    vi.spyOn(window, 'print').mockImplementation(() => {
      throw new Error('Printer offline');
    });

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
            path="/me/loans/:id"
            element={
              <RequirePermission permission="loans.read.own">
                <LoanReceiptPage />
              </RequirePermission>
            }
          />
        </Route>
      </Routes>,
      { route: '/me/loans/910', csrf: 'csrf-reader-token' },
    );

    await screen.findByRole('heading', { name: /loan receipt #910/i });
    await user.click(screen.getByRole('button', { name: 'Print receipt' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/printing is unavailable/i);
    expect(createSpy).not.toHaveBeenCalled();
    expect(detailSpy).toHaveBeenCalledTimes(1);
  });
});
