export interface LoanPrintFields {
  loanId: string;
  bookTitle: string;
  state: string;
  reservedAt: string;
  checkedOutAt: string | null;
  dueAt: string | null;
  reservationExpiresAt: string;
}

export function buildLoanPrintDocumentTitle(fields: LoanPrintFields): string {
  return `Loan ${fields.loanId} · ${fields.bookTitle}`;
}

export function formatLoanPrintDate(iso: string | null): string {
  if (!iso) {
    return '—';
  }
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }
  return date.toLocaleString();
}

export function loanPrintContainsSensitiveFields(text: string): boolean {
  const lowered = text.toLowerCase();
  return lowered.includes('password') || lowered.includes('cardnumber');
}
