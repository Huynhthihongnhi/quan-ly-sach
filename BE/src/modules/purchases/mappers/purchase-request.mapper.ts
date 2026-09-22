import { PurchaseRequestEvent } from '../entities/purchase-request-event.entity';
import { PurchaseRequest } from '../entities/purchase-request.entity';

export interface PurchaseRequestEventResponse {
  id: string;
  fromState: string | null;
  toState: string;
  reason: string | null;
  createdAt: string;
}

export interface PurchaseRequestResponse {
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

export interface PurchaseRequestDetailResponse extends PurchaseRequestResponse {
  events: PurchaseRequestEventResponse[];
}

export function toPurchaseRequestEventResponse(
  event: PurchaseRequestEvent,
): PurchaseRequestEventResponse {
  return {
    id: event.id,
    fromState: event.fromState,
    toState: event.toState,
    reason: event.reason,
    createdAt: event.createdAt.toISOString(),
  };
}

export function toPurchaseRequestResponse(row: PurchaseRequest): PurchaseRequestResponse {
  return {
    id: row.id,
    requesterId: row.requesterId,
    title: row.title,
    authorText: row.authorText,
    publicationYear: row.publicationYear,
    note: row.note,
    state: row.state,
    reviewedBy: row.reviewedBy,
    reviewReason: row.reviewReason,
    reviewedAt: row.reviewedAt ? row.reviewedAt.toISOString() : null,
    version: row.version,
    createdAt: row.createdAt.toISOString(),
  };
}
