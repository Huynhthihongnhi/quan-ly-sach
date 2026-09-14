import { Connection, RowDataPacket } from 'mysql2/promise';

interface LockRow extends RowDataPacket {
  lockResult: number | null;
}

export class AdvisoryLockError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AdvisoryLockError';
  }
}

export async function acquireAdvisoryLock(
  connection: Connection,
  lockName: string,
  timeoutSeconds: number,
): Promise<void> {
  const [rows] = await connection.query<LockRow[]>(`SELECT GET_LOCK(?, ?) AS lockResult`, [
    lockName,
    timeoutSeconds,
  ]);
  const result = rows[0]?.lockResult;
  if (result !== 1) {
    throw new AdvisoryLockError(`Could not acquire migration lock "${lockName}"`);
  }
}

export async function releaseAdvisoryLock(connection: Connection, lockName: string): Promise<void> {
  await connection.query(`SELECT RELEASE_LOCK(?)`, [lockName]);
}
