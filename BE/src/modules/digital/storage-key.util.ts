import { randomBytes } from 'node:crypto';

export function buildDigitalAssetStorageKey(bookId: string): string {
  const token = randomBytes(16).toString('hex');
  return `assets/${bookId}/${token}.pdf`;
}
