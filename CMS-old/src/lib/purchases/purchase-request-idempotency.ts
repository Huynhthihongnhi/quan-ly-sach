/**
 * Stable idempotency key for a purchase-request submission so double-clicks reuse the same key.
 */
export function buildPurchaseRequestIdempotencyKey(attemptId: string): string {
  if (!/^[A-Za-z0-9-]{1,55}$/.test(attemptId)) {
    throw new Error('Invalid purchase request attempt id.');
  }
  return `purchase:${attemptId}`;
}

export function createPurchaseRequestAttemptId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
