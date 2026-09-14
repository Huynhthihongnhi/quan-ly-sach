import { Inject, Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { ApiException } from '../../common/http/api.exception';
import { ErrorCode } from '../../common/http/error-code';
import { CLOCK, Clock } from '../../platform/clock/clock.interface';
import { AuditService } from '../audit/audit.service';
import { sha256Digest } from './crypto/digest';
import { ChallengeRepository } from '../challenge/challenge.repository';
import type { ChallengePurpose } from '../challenge/challenge.types';
import { IdentityChallenge } from '../challenge/entities/identity-challenge.entity';
import { assertNewPasswordPolicy } from '../identity/password-policy';
import { hashPassword } from '../identity/password-hasher';
import { User } from '../identity/entities/user.entity';
import { UserRepository } from '../identity/user.repository';
import { AuthService } from './auth.service';

export const CHALLENGE_INVALID_MESSAGE = 'The link is invalid or has expired.';

function throwChallengeInvalid(): never {
  throw new ApiException(409, ErrorCode.CHALLENGE_INVALID, CHALLENGE_INVALID_MESSAGE);
}

@Injectable()
export class ChallengeConsumptionService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly challengeRepository: ChallengeRepository,
    private readonly userRepository: UserRepository,
    private readonly authService: AuthService,
    private readonly auditService: AuditService,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async completeResetPassword(params: {
    token: string;
    newPassword: string;
    requestId: string;
  }): Promise<void> {
    await this.completePasswordChallenge('reset_password', 'auth.reset_password', params);
  }

  async completeActivation(params: {
    token: string;
    newPassword: string;
    requestId: string;
  }): Promise<void> {
    await this.completePasswordChallenge('activate_account', 'auth.activate_account', params);
  }

  private async completePasswordChallenge(
    purpose: ChallengePurpose,
    auditAction: string,
    params: { token: string; newPassword: string; requestId: string },
  ): Promise<void> {
    assertNewPasswordPolicy(params.newPassword);
    const passwordHash = await hashPassword(params.newPassword);
    await this.consumeChallenge({
      token: params.token,
      expectedPurpose: purpose,
      passwordHash,
      requestId: params.requestId,
      auditAction,
    });
  }

  private async consumeChallenge(params: {
    token: string;
    expectedPurpose: ChallengePurpose;
    passwordHash: string;
    requestId: string;
    auditAction: string;
  }): Promise<void> {
    const tokenHash = sha256Digest(params.token);
    const now = this.clock.now();

    await this.dataSource.transaction(async (manager) => {
      const challenge = await this.challengeRepository.findByTokenHashForUpdate(manager, tokenHash);
      this.assertChallengeEligible(challenge, params.expectedPurpose, now);

      const user = await this.userRepository.findByIdForUpdate(manager, challenge.userId);
      this.assertUserEligible(user, challenge, params.expectedPurpose);

      const updated = await this.applyUserCredentialChange(manager, {
        user,
        purpose: params.expectedPurpose,
        passwordHash: params.passwordHash,
        now,
      });
      if (!updated) {
        throwChallengeInvalid();
      }

      const consumed = await this.challengeRepository.consumeIfEligible(manager, {
        challengeId: challenge.id,
        expectedPurpose: params.expectedPurpose,
        now,
      });
      if (!consumed) {
        throwChallengeInvalid();
      }

      await this.challengeRepository.revokeActiveByUserAndPurpose(manager, {
        userId: challenge.userId,
        purpose: params.expectedPurpose,
        revokedAt: now,
        exceptChallengeId: challenge.id,
      });

      await this.authService.revokeAllSessionsForUserInTransaction(manager, challenge.userId, now);

      await this.auditService.append(manager, {
        actorUserId: challenge.userId,
        action: params.auditAction,
        targetType: 'user',
        targetId: challenge.userId,
        outcome: 'success',
        requestId: params.requestId,
      });
    });
  }

  private assertChallengeEligible(
    challenge: IdentityChallenge | null,
    expectedPurpose: ChallengePurpose,
    now: Date,
  ): asserts challenge is IdentityChallenge {
    if (
      !challenge ||
      challenge.purpose !== expectedPurpose ||
      challenge.consumedAt !== null ||
      challenge.revokedAt !== null ||
      challenge.expiresAt <= now
    ) {
      throwChallengeInvalid();
    }
  }

  private assertUserEligible(
    user: User | null,
    challenge: IdentityChallenge,
    purpose: ChallengePurpose,
  ): asserts user is User {
    const requiredStatus = purpose === 'reset_password' ? 'active' : 'invited';

    if (!user || user.email !== challenge.emailSnapshot || user.status !== requiredStatus) {
      throwChallengeInvalid();
    }
  }

  private async applyUserCredentialChange(
    manager: EntityManager,
    params: {
      user: User;
      purpose: ChallengePurpose;
      passwordHash: string;
      now: Date;
    },
  ): Promise<boolean> {
    if (params.purpose === 'reset_password') {
      return this.userRepository.applyPasswordReset(manager, {
        userId: params.user.id,
        passwordHash: params.passwordHash,
      });
    }

    return this.userRepository.applyActivation(manager, {
      userId: params.user.id,
      passwordHash: params.passwordHash,
      emailVerifiedAt: params.now,
    });
  }
}
