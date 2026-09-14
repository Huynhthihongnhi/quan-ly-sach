import { scryptSync, timingSafeEqual } from 'node:crypto';
import * as argon2 from 'argon2';

export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, { type: argon2.argon2id });
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  if (storedHash.startsWith('scrypt:')) {
    return verifyLegacyScrypt(password, storedHash);
  }

  try {
    return await argon2.verify(storedHash, password);
  } catch {
    return false;
  }
}

function verifyLegacyScrypt(password: string, storedHash: string): boolean {
  const [algorithm, saltHex, hashHex] = storedHash.split(':');
  if (algorithm !== 'scrypt' || !saltHex || !hashHex) {
    return false;
  }

  const salt = Buffer.from(saltHex, 'hex');
  const expected = Buffer.from(hashHex, 'hex');
  const actual = scryptSync(password, salt, expected.length);
  return timingSafeEqual(actual, expected);
}
