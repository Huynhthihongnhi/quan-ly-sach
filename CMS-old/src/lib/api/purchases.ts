import { apiRequest } from './client';
import type { PageMeta } from './types';

export interface PurchaseRequestRecord {
  id: string;
  requesterId: string;
  title: string;
  authorText: string;
  publicationYear: number;
  note: string | null;
  state: string;
  reviewedBy: string | null;
  reviewReason: string | null;
  reviewedAt: string | null;
  version: string;
  createdAt: string;
}

export interface CreatePurchaseRequestPayload {
  title: string;
  authorText: string;
  publicationYear: number;
  note?: string;
}

export interface ReviewPurchaseRequestPayload {
  decision: 'approved' | 'rejected';
  version: string;
  reason?: string;
}

interface ListResponse<T> {
  data: T[];
  meta: PageMeta;
}

interface DetailResponse<T> {
  data: T;
}

export async function submitPurchaseRequest(
  payload: CreatePurchaseRequestPayload,
  idempotencyKey: string,
): Promise<PurchaseRequestRecord> {
  const response = await apiRequest<DetailResponse<PurchaseRequestRecord>>('/purchase-requests', {
    method: 'POST',
    body: payload,
    headers: { 'Idempotency-Key': idempotencyKey },
  });
  return response.data;
}

export async function fetchOwnPurchaseRequests(params?: {
  state?: string;
  page?: number;
}): Promise<ListResponse<PurchaseRequestRecord>> {
  const search = new URLSearchParams();
  search.set('page', String(params?.page ?? 1));
  search.set('pageSize', '20');
  if (params?.state) {
    search.set('state', params.state);
  }
  return apiRequest<ListResponse<PurchaseRequestRecord>>(
    `/me/purchase-requests?${search.toString()}`,
  );
}

export async function fetchAdminPurchaseRequests(params?: {
  state?: string;
  page?: number;
}): Promise<ListResponse<PurchaseRequestRecord>> {
  const search = new URLSearchParams();
  search.set('page', String(params?.page ?? 1));
  search.set('pageSize', '50');
  if (params?.state) {
    search.set('state', params.state);
  }
  return apiRequest<ListResponse<PurchaseRequestRecord>>(
    `/admin/purchase-requests?${search.toString()}`,
  );
}

export async function reviewPurchaseRequest(
  id: string,
  body: ReviewPurchaseRequestPayload,
): Promise<PurchaseRequestRecord> {
  const response = await apiRequest<DetailResponse<PurchaseRequestRecord>>(
    `/admin/purchase-requests/${id}/review`,
    { method: 'POST', body },
  );
  return response.data;
}
