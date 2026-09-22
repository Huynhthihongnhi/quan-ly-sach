import { describe, expect, it } from 'vitest';
import { buildBorrowIdempotencyKey } from '@/lib/circulation/borrow-idempotency';

describe('borrow idempotency key', () => {
  it('reuses the same key for identical attempt inputs', () => {
    const input = {
      bookId: '106',
      cardNumber: 'CARD-READER-MSW',
      requestedDays: 15,
      attemptId: 'attempt-fixed',
    };
    expect(buildBorrowIdempotencyKey(input)).toBe(buildBorrowIdempotencyKey(input));
  });

  it('never exceeds 64 ASCII characters', () => {
    const key = buildBorrowIdempotencyKey({
      bookId: '1'.repeat(40),
      cardNumber: 'C'.repeat(40),
      requestedDays: 15,
      attemptId: 'attempt-fixed',
    });
    expect(key.length).toBeLessThanOrEqual(64);
  });
});
