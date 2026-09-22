import { apiRequest } from './client';
import type { PageMeta } from './types';

export interface LoanRecord {
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

export interface AdminLoanRecord extends LoanRecord {
  userId: string;
}

export interface LoanEventRecord {
  id: string;
  fromState: string | null;
  toState: string;
  reason: string | null;
  createdAt: string;
}

export interface LoanDetailRecord extends LoanRecord {
  events: LoanEventRecord[];
}

export interface CreateLoanPayload {
  bookId: string;
  cardNumber: string;
  password: string;
  requestedDays: number;
}

interface ListResponse<T> {
  data: T[];
  meta: PageMeta;
}

interface DetailResponse<T> {
  data: T;
}

export async function createLoanReservation(
  payload: CreateLoanPayload,
  idempotencyKey: string,
): Promise<LoanRecord> {
  const response = await apiRequest<DetailResponse<LoanRecord>>('/loans', {
    method: 'POST',
    body: payload,
    headers: { 'Idempotency-Key': idempotencyKey },
  });
  return response.data;
}

export async function fetchOwnLoans(params?: {
  state?: string;
  overdue?: boolean;
  page?: number;
}): Promise<ListResponse<LoanRecord>> {
  const search = new URLSearchParams();
  search.set('page', String(params?.page ?? 1));
  search.set('pageSize', '20');
  if (params?.state) {
    search.set('state', params.state);
  }
  if (params?.overdue !== undefined) {
    search.set('overdue', params.overdue ? 'true' : 'false');
  }
  return apiRequest<ListResponse<LoanRecord>>(`/me/loans?${search.toString()}`);
}

export async function fetchLoanDetail(loanId: string): Promise<LoanDetailRecord> {
  const response = await apiRequest<DetailResponse<LoanDetailRecord>>(`/loans/${loanId}`);
  return response.data;
}

export async function fetchAdminLoans(params?: {
  overdue?: boolean;
  state?: string;
  page?: number;
}): Promise<ListResponse<AdminLoanRecord>> {
  const search = new URLSearchParams();
  search.set('page', String(params?.page ?? 1));
  search.set('pageSize', '50');
  if (params?.state) {
    search.set('state', params.state);
  }
  if (params?.overdue !== undefined) {
    search.set('overdue', params.overdue ? 'true' : 'false');
  }
  return apiRequest<ListResponse<AdminLoanRecord>>(`/admin/loans?${search.toString()}`);
}

export async function checkoutLoan(loanId: string, version: string): Promise<LoanRecord> {
  const response = await apiRequest<DetailResponse<LoanRecord>>(`/admin/loans/${loanId}/checkout`, {
    method: 'POST',
    body: { version },
  });
  return response.data;
}

export async function returnLoan(
  loanId: string,
  version: string,
  conditionState: 'serviceable' | 'repair',
): Promise<LoanRecord> {
  const response = await apiRequest<DetailResponse<LoanRecord>>(`/admin/loans/${loanId}/return`, {
    method: 'POST',
    body: { version, conditionState },
  });
  return response.data;
}
