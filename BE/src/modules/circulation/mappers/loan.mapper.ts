import { Loan } from '../entities/loan.entity';
import { LoanEvent } from '../entities/loan-event.entity';

export interface LoanEventResponse {
  id: string;
  fromState: string | null;
  toState: string;
  reason: string | null;
  createdAt: string;
}

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

export interface AdminLoanResponse extends LoanResponse {
  userId: string;
}

export interface LoanDetailResponse extends LoanResponse {
  events: LoanEventResponse[];
}

export function toLoanEventResponse(event: LoanEvent): LoanEventResponse {
  return {
    id: event.id,
    fromState: event.fromState,
    toState: event.toState,
    reason: event.reason,
    createdAt: event.createdAt.toISOString(),
  };
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

export function toAdminLoanResponse(loan: Loan, bookId: string): AdminLoanResponse {
  return {
    ...toLoanResponse(loan, bookId),
    userId: loan.userId,
  };
}
