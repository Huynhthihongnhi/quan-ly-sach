import { randomBytes } from 'node:crypto';
import { sha256Digest } from './digest';

export function generateSessionToken(): Buffer {
  return randomBytes(32);
}

export function hashSessionToken(token: Buffer): Buffer {
  return sha256Digest(token);
}
