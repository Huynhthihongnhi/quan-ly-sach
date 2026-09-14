import { useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { createLoanReservation } from '@/lib/api/loans';
import { ApiClientError } from '@/lib/api/types';
import { useAuth } from '@/lib/auth/AuthProvider';
import {
  buildBorrowIdempotencyKey,
  createBorrowAttemptId,
} from '@/lib/circulation/borrow-idempotency';

interface BorrowBookPanelProps {
  bookId: string;
  bookTitle: string;
  availableCopies: number | null;
  onReserved?: () => void;
  onAvailabilityChange?: (copies: number | null) => void;
}

export function BorrowBookPanel({
  bookId,
  bookTitle,
  availableCopies,
  onReserved,
  onAvailabilityChange,
}: BorrowBookPanelProps): React.JSX.Element | null {
  const { can, userId, loading: authLoading } = useAuth();
  const [cardNumber, setCardNumber] = useState('');
  const [password, setPassword] = useState('');
  const [requestedDays, setRequestedDays] = useState('15');
  const [error, setError] = useState<string | null>(null);
  const [successLoanId, setSuccessLoanId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const attemptIdRef = useRef(createBorrowAttemptId());
  const inFlightRef = useRef(false);

  if (authLoading) {
    return null;
  }

  if (availableCopies === null) {
    return (
      <p className="text-xs text-slate-500">Available copies: not shown before circulation is enabled.</p>
    );
  }

  if (!userId) {
    return (
      <p className="text-sm text-slate-700">
        <Link to="/login" className="font-medium text-blue-700 hover:underline">
          Sign in
        </Link>{' '}
        to reserve a copy of {bookTitle}.
      </p>
    );
  }

  if (!can('loans.create.own')) {
    return (
      <p className="text-sm text-slate-600">Your account cannot create loan reservations.</p>
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (inFlightRef.current || submitting) {
      return;
    }
    inFlightRef.current = true;
    setSubmitting(true);
    setError(null);
    setSuccessLoanId(null);

    const days = Number(requestedDays);
    const idempotencyKey = buildBorrowIdempotencyKey({
      bookId,
      cardNumber,
      requestedDays: days,
      attemptId: attemptIdRef.current,
    });

    try {
      const loan = await createLoanReservation(
        {
          bookId,
          cardNumber,
          password,
          requestedDays: days,
        },
        idempotencyKey,
      );
      setSuccessLoanId(loan.id);
      setPassword('');
      if (availableCopies !== null && availableCopies > 0) {
        onAvailabilityChange?.(availableCopies - 1);
      }
      onReserved?.();
    } catch (caught) {
      if (caught instanceof ApiClientError && caught.code === 'NO_COPY_AVAILABLE') {
        setError('No copies are available right now. Availability was updated.');
        onAvailabilityChange?.(0);
      } else {
        setError(caught instanceof ApiClientError ? caught.message : 'Reservation failed.');
      }
    } finally {
      setSubmitting(false);
      inFlightRef.current = false;
    }
  }

  return (
    <section className="space-y-3 border-t border-slate-200 pt-4">
      <h2 className="text-sm font-semibold text-slate-900">Borrow this book</h2>
      <p className="text-sm text-slate-600">
        Available copies: {availableCopies}
        {availableCopies === 0 ? ' (none left to reserve)' : ''}
      </p>
      {error ? <Alert variant="destructive">{error}</Alert> : null}
      {successLoanId ? (
        <Alert>
          Reservation created.{' '}
          <Link to={`/me/loans/${successLoanId}`} className="font-medium underline">
            View loan receipt
          </Link>
        </Alert>
      ) : null}
      <form className="grid max-w-md gap-3" onSubmit={(event) => void handleSubmit(event)}>
        <div>
          <Label htmlFor="borrow-card">Library card number</Label>
          <Input
            id="borrow-card"
            autoComplete="off"
            value={cardNumber}
            onChange={(event) => setCardNumber(event.target.value)}
            required
          />
        </div>
        <div>
          <Label htmlFor="borrow-password">Account password (re-auth)</Label>
          <Input
            id="borrow-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </div>
        <div>
          <Label htmlFor="borrow-days">Requested days (1–15)</Label>
          <Input
            id="borrow-days"
            type="number"
            min={1}
            max={15}
            value={requestedDays}
            onChange={(event) => setRequestedDays(event.target.value)}
            required
          />
        </div>
        <Button type="submit" disabled={submitting || availableCopies === 0}>
          {submitting ? 'Submitting…' : 'Reserve copy'}
        </Button>
      </form>
    </section>
  );
}
