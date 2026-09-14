import { Loan } from '../entities/loan.entity';

export interface LoanResponse {
  id: string;
  bookId: string;
  copyId: string;
  state: string;
  requestedDays: number;
  reservedAt: string;
  reservationExpiresAt: string;
  checkedOutAt: string | null;
  dueAt: string | null;
  version: string;
}

export function toLoanResponse(loan: Loan, bookId: string): LoanResponse {
  return {
    id: loan.id,
    bookId,
    copyId: loan.copyId,
    state: loan.state,
    requestedDays: loan.requestedDays,
    reservedAt: loan.reservedAt.toISOString(),
    reservationExpiresAt: loan.reservationExpiresAt.toISOString(),
    checkedOutAt: loan.checkedOutAt ? loan.checkedOutAt.toISOString() : null,
    dueAt: loan.dueAt ? loan.dueAt.toISOString() : null,
    version: loan.version,
  };
}
