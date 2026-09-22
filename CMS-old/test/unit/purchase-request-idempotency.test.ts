import { describe, expect, it } from 'vitest';
import { buildPurchaseRequestIdempotencyKey } from '@/lib/purchases/purchase-request-idempotency';

describe('purchase request idempotency key', () => {
  it('reuses the same key for the same attempt id', () => {
    expect(buildPurchaseRequestIdempotencyKey('attempt-fixed')).toBe(
      buildPurchaseRequestIdempotencyKey('attempt-fixed'),
    );
  });

  it('keeps different attempts distinct', () => {
    expect(buildPurchaseRequestIdempotencyKey('attempt-a')).not.toBe(
      buildPurchaseRequestIdempotencyKey('attempt-b'),
    );
  });

  it('rejects an attempt id outside the allowed character set', () => {
    expect(() => buildPurchaseRequestIdempotencyKey('bad id!')).toThrow();
  });

  it('never exceeds 64 ASCII characters for a maximum-length attempt id', () => {
    const key = buildPurchaseRequestIdempotencyKey('a'.repeat(55));
    expect(key.length).toBeLessThanOrEqual(64);
  });
});
