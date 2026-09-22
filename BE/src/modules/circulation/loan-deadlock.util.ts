import { QueryFailedError } from 'typeorm';

export function isDeadlockError(error: unknown): boolean {
  if (!(error instanceof QueryFailedError)) {
    return false;
  }
  return (error as { code?: string }).code === 'ER_LOCK_DEADLOCK';
}

export async function runWithDeadlockRetry<T>(
  maxAttempts: number,
  run: () => Promise<T>,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      return await run();
    } catch (error) {
      lastError = error;
      if (!isDeadlockError(error) || attempt === maxAttempts - 1) {
        throw error;
      }
    }
  }
  throw lastError;
}
