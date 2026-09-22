import { describe, expect, it } from 'vitest';
import {
  buildLoanPrintDocumentTitle,
  formatLoanPrintDate,
  loanPrintContainsSensitiveFields,
} from '@/lib/circulation/loan-print';

describe('loan print helpers', () => {
  it('builds a document title with loan id, title, and state context', () => {
    const title = buildLoanPrintDocumentTitle({
      loanId: '910',
      bookTitle: 'Borrowable Sample',
      state: 'reserved',
      reservedAt: '2026-09-11T08:00:00.000Z',
      checkedOutAt: null,
      dueAt: null,
      reservationExpiresAt: '2026-09-12T08:00:00.000Z',
    });
    expect(title).toContain('910');
    expect(title).toContain('Borrowable Sample');
  });

  it('flags sensitive credential tokens in printable text', () => {
    expect(loanPrintContainsSensitiveFields('password=secret')).toBe(true);
    expect(loanPrintContainsSensitiveFields('Loan 910 reserved')).toBe(false);
  });

  it('formats missing dates as em dash', () => {
    expect(formatLoanPrintDate(null)).toBe('—');
  });
});
