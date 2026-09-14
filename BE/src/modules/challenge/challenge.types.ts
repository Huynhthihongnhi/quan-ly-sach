export type ChallengePurpose = 'reset_password' | 'activate_account';

export interface CreateChallengeInput {
  userId: string;
  purpose: ChallengePurpose;
  email: string;
  expiresAt: Date;
}

export interface CreatedChallenge {
  id: string;
  tokenHash: Buffer;
  rawToken: string;
}
