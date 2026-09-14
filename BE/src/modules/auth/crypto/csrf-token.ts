import { createHmac, randomBytes } from 'node:crypto';
import { sha256Digest } from './digest';

export function deriveCsrfToken(sessionToken: Buffer, secret: string): string {
  return createHmac('sha256', secret).update(sessionToken).update(':csrf').digest('base64url');
}

export function hashCsrfToken(token: string): Buffer {
  return sha256Digest(token);
}

export function generateCsrfSecret(): string {
  return randomBytes(32).toString('base64url');
}
