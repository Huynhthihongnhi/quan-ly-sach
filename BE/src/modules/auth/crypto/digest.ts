import { createHash, timingSafeEqual } from 'node:crypto';

export function sha256Digest(value: Buffer | string): Buffer {
  return createHash('sha256').update(value).digest();
}

export function digestEquals(left: Buffer, right: Buffer): boolean {
  if (left.length !== right.length) {
    return false;
  }

  return timingSafeEqual(left, right);
}
