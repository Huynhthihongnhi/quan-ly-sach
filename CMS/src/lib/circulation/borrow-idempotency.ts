/**
 * Stable idempotency key for a borrow attempt so double-clicks reuse the same reservation key.
 */
export function buildBorrowIdempotencyKey(input: {
  bookId: string;
  cardNumber: string;
  requestedDays: number;
  attemptId: string;
}): string {
  const card = input.cardNumber.trim();
  const raw = `borrow:${input.bookId}:${card}:${input.requestedDays}:${input.attemptId}`;
  if (raw.length <= 64) {
    return raw;
  }
  return raw.slice(0, 64);
}

export function createBorrowAttemptId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
