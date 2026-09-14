import { createHash } from 'node:crypto';

export function normalizeLoanCardNumber(cardNumber: string): string {
  return cardNumber.trim();
}

export function buildLoanRequestHash(input: {
  bookId: string;
  cardNumber: string;
  requestedDays: number;
}): Buffer {
  const canonical = JSON.stringify({
    bookId: String(input.bookId),
    cardNumber: normalizeLoanCardNumber(input.cardNumber),
    requestedDays: input.requestedDays,
  });
  return createHash('sha256').update(canonical, 'utf8').digest();
}
