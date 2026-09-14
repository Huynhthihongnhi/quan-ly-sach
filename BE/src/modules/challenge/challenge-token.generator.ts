import { randomBytes } from 'node:crypto';
import { sha256Digest } from '../auth/crypto/digest';

export interface GeneratedChallengeToken {
  rawToken: string;
  tokenHash: Buffer;
}

export function generateChallengeToken(): GeneratedChallengeToken {
  const rawToken = randomBytes(32).toString('base64url');
  return {
    rawToken,
    tokenHash: sha256Digest(rawToken),
  };
}
