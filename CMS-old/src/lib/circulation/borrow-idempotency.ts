/**
 * Stable idempotency key for a borrow attempt so double-clicks reuse the same reservation key.
 */
export function buildBorrowIdempotencyKey(input: {
  bookId: string;
  cardNumber: string;
  requestedDays: number;
  attemptId: string;
}): string {
  // The form owns the attempt lifecycle; no reader data is put into the header.
  if (!/^[A-Za-z0-9-]{1,57}$/.test(input.attemptId)) {
    throw new Error('Invalid borrow attempt id.');
  }
  return `borrow:${input.attemptId}`;
}

export function createBorrowAttemptId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
