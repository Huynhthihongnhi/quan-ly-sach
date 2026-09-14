export const LOAN_DUE_REMINDER_KIND = 'loan_due_3_days';
export const LOAN_DUE_REMINDER_TEMPLATE = 'loan_due_3_days';
export const LOAN_DUE_REMINDER_DAYS_BEFORE = 3;
export const LOAN_DUE_REMINDER_LOCAL_HOUR = 8;

export function buildLoanReminderDedupeKey(
  loanId: string,
  dueAtSnapshot: Date,
  kind: string,
): string {
  const dueKey = dueAtSnapshot.toISOString();
  return `loan:${loanId}:due:${dueKey}:kind:${kind}`;
}
