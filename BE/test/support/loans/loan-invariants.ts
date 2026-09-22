import type { DataSource } from 'typeorm';

export async function countActiveLoansForCopy(
  dataSource: DataSource,
  copyId: string,
): Promise<number> {
  const rows: Array<{ count: string }> = await dataSource.query(
    `SELECT COUNT(*) AS count FROM loans
     WHERE copy_id = ? AND state IN ('reserved', 'borrowed')`,
    [copyId],
  );
  return Number(rows[0]?.count ?? 0);
}

export async function assertActiveCopyInvariant(
  dataSource: DataSource,
  copyId: string,
): Promise<void> {
  const active = await countActiveLoansForCopy(dataSource, copyId);
  expect(active).toBeLessThanOrEqual(1);
}

export async function countLoanEvents(dataSource: DataSource, loanId: string): Promise<number> {
  const rows: Array<{ count: string }> = await dataSource.query(
    `SELECT COUNT(*) AS count FROM loan_events WHERE loan_id = ?`,
    [loanId],
  );
  return Number(rows[0]?.count ?? 0);
}

export async function assertNoServiceableCopyWithUnhandledLostLoan(
  dataSource: DataSource,
): Promise<void> {
  const rows: Array<{ id: string }> = await dataSource.query(
    `SELECT c.id
     FROM book_copies c
     INNER JOIN loans l ON l.copy_id = c.id AND l.state = 'lost'
     WHERE c.condition_state = 'serviceable'
     LIMIT 5`,
  );
  expect(rows).toHaveLength(0);
}

export async function countLoansByRequestKey(
  dataSource: DataSource,
  userId: string,
  requestKey: string,
): Promise<number> {
  const rows: Array<{ count: string }> = await dataSource.query(
    `SELECT COUNT(*) AS count FROM loans WHERE user_id = ? AND request_key = ?`,
    [userId, requestKey],
  );
  return Number(rows[0]?.count ?? 0);
}
