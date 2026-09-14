import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ApiException } from '../../common/http/api.exception';
import { ErrorCode } from '../../common/http/error-code';
import { CLOCK, Clock } from '../../platform/clock/clock.interface';
import { normalizeEmail } from '../identity/email-normalizer';
import { UserRepository } from '../identity/user.repository';
import { ChallengeOutboxOrchestrator } from '../messaging/challenge-outbox.orchestrator';
import { AuthChallengeConfigService } from './auth-challenge-config.service';
import { AuthConfigService } from './auth-config.service';
import { RateLimitRepository } from './rate-limit.repository';

export const FORGOT_PASSWORD_ACCEPTED_MESSAGE =
  'If an account exists for that email, password reset instructions will be sent shortly.';

@Injectable()
export class PasswordRecoveryService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly userRepository: UserRepository,
    private readonly rateLimitRepository: RateLimitRepository,
    private readonly authConfig: AuthConfigService,
    private readonly challengeConfig: AuthChallengeConfigService,
    private readonly challengeOutboxOrchestrator: ChallengeOutboxOrchestrator,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async requestForgotPassword(params: {
    email: string;
    clientIp: string;
  }): Promise<{ message: string }> {
    const now = this.clock.now();
    const normalizedEmail = normalizeEmail(params.email);

    await this.assertForgotRateLimit(normalizedEmail, params.clientIp, now);

    const user = await this.userRepository.findByEmail(normalizedEmail);
    if (user?.status === 'active') {
      const expiresAt = new Date(now.getTime() + this.challengeConfig.resetPasswordTtlMs);
      await this.dataSource.transaction(async (manager) => {
        await this.challengeOutboxOrchestrator.enqueueChallengeEmail(manager, {
          userId: user.id,
          purpose: 'reset_password',
          email: normalizedEmail,
          challengeExpiresAt: expiresAt,
          outboxExpiresAt: expiresAt,
          templateCode: 'reset_password',
          dedupeKey: `reset_password:${user.id}:${randomUUID()}`,
        });
      });
    }

    return { message: FORGOT_PASSWORD_ACCEPTED_MESSAGE };
  }

  private async assertForgotRateLimit(email: string, clientIp: string, now: Date): Promise<void> {
    const windowStart = new Date(
      now.getTime() - (now.getTime() % this.challengeConfig.forgotRateLimitWindowMs),
    );
    const expiresAt = new Date(
      windowStart.getTime() + this.challengeConfig.forgotRateLimitWindowMs,
    );

    await this.dataSource.transaction(async (manager) => {
      const emailHash = this.rateLimitRepository.hashSubject(
        this.authConfig.rateLimitHmacSecret,
        `forgot:email:${email}`,
      );
      const ipHash = this.rateLimitRepository.hashSubject(
        this.authConfig.rateLimitHmacSecret,
        `forgot:ip:${clientIp}`,
      );

      const emailResult = await this.rateLimitRepository.consume(manager, {
        scope: 'auth.forgot.email',
        subjectHash: emailHash,
        windowStart,
        expiresAt,
        maxRequests: this.challengeConfig.forgotRateLimitMax,
        now,
      });
      const ipResult = await this.rateLimitRepository.consume(manager, {
        scope: 'auth.forgot.ip',
        subjectHash: ipHash,
        windowStart,
        expiresAt,
        maxRequests: this.challengeConfig.forgotRateLimitMax * 3,
        now,
      });

      if (!emailResult.allowed || !ipResult.allowed) {
        const retryAfterMs = Math.max(emailResult.retryAfterMs, ipResult.retryAfterMs);
        throw new ApiException(
          429,
          ErrorCode.RATE_LIMITED,
          FORGOT_PASSWORD_ACCEPTED_MESSAGE,
          undefined,
          Math.ceil(retryAfterMs / 1000),
        );
      }
    });
  }
}
