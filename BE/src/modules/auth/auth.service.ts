import { Inject, Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { ApiException } from '../../common/http/api.exception';
import { ErrorCode } from '../../common/http/error-code';
import { CLOCK, Clock } from '../../platform/clock/clock.interface';
import { AuditService } from '../audit/audit.service';
import { normalizeEmail } from '../identity/email-normalizer';
import { hashPassword, verifyPassword } from '../identity/password-hasher';
import { User } from '../identity/entities/user.entity';
import { UserRepository } from '../identity/user.repository';
import { AuthConfigService } from './auth-config.service';
import { deriveCsrfToken, hashCsrfToken } from './crypto/csrf-token';
import { generateSessionToken, hashSessionToken } from './crypto/session-token';
import { RateLimitRepository } from './rate-limit.repository';
import { SessionRepository } from './session.repository';

export interface LoginResult {
  user: { id: string; email: string; status: string };
  csrfToken: string;
  sessionToken: Buffer;
}

const INVALID_CREDENTIALS_MESSAGE = 'Invalid email or password.';

@Injectable()
export class AuthService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly userRepository: UserRepository,
    private readonly sessionRepository: SessionRepository,
    private readonly rateLimitRepository: RateLimitRepository,
    private readonly authConfig: AuthConfigService,
    private readonly auditService: AuditService,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async login(params: {
    email: string;
    password: string;
    requestId: string;
    clientIp: string;
  }): Promise<LoginResult> {
    const now = this.clock.now();
    const normalizedEmail = normalizeEmail(params.email);

    await this.assertLoginRateLimit(normalizedEmail, params.clientIp, now);

    const user = await this.userRepository.findByEmail(normalizedEmail);
    if (!user || user.status !== 'active') {
      await this.auditLoginFailure(null, params.requestId, 'invalid_credentials');
      throw new ApiException(401, ErrorCode.AUTHENTICATION_REQUIRED, INVALID_CREDENTIALS_MESSAGE);
    }

    const userWithHash = await this.dataSource
      .getRepository(User)
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('user.id = :id', { id: user.id })
      .getOne();

    const passwordValid = userWithHash?.passwordHash
      ? await verifyPassword(params.password, userWithHash.passwordHash)
      : false;

    if (!passwordValid) {
      await this.auditLoginFailure(user.id, params.requestId, 'invalid_credentials');
      throw new ApiException(401, ErrorCode.AUTHENTICATION_REQUIRED, INVALID_CREDENTIALS_MESSAGE);
    }

    const sessionToken = generateSessionToken();
    const tokenHash = hashSessionToken(sessionToken);
    const csrfToken = deriveCsrfToken(sessionToken, this.authConfig.csrfHmacSecret);
    const csrfHash = hashCsrfToken(csrfToken);
    const idleExpiresAt = new Date(
      Math.min(
        now.getTime() + this.authConfig.sessionIdleTtlMs,
        now.getTime() + this.authConfig.sessionAbsoluteTtlMs,
      ),
    );
    const absoluteExpiresAt = new Date(now.getTime() + this.authConfig.sessionAbsoluteTtlMs);

    await this.dataSource.transaction(async (manager) => {
      await this.sessionRepository.revokeAllForUser(manager, user.id, now);
      await this.sessionRepository.createSession(manager, {
        userId: user.id,
        tokenHash,
        csrfHash,
        authVersion: user.authVersion,
        now,
        idleExpiresAt,
        absoluteExpiresAt,
      });
      await this.auditService.append(manager, {
        actorUserId: user.id,
        action: 'auth.login',
        targetType: 'user',
        targetId: user.id,
        outcome: 'success',
        requestId: params.requestId,
      });
    });

    return {
      user: { id: user.id, email: user.email, status: user.status },
      csrfToken,
      sessionToken,
    };
  }

  async logout(params: { sessionId: string; userId: string; requestId: string }): Promise<void> {
    const now = this.clock.now();
    await this.dataSource.transaction(async (manager) => {
      await this.sessionRepository.revokeSession(manager, params.sessionId, now);
      await this.auditService.append(manager, {
        actorUserId: params.userId,
        action: 'auth.logout',
        targetType: 'session',
        targetId: params.sessionId,
        outcome: 'success',
        requestId: params.requestId,
      });
    });
  }

  async setPasswordForUser(userId: string, password: string): Promise<void> {
    const passwordHash = await hashPassword(password);
    await this.dataSource.getRepository(User).update({ id: userId }, { passwordHash });
  }

  async revokeAllSessionsForUser(userId: string): Promise<void> {
    const now = this.clock.now();
    await this.dataSource.transaction(async (manager) => {
      await this.revokeAllSessionsForUserInTransaction(manager, userId, now);
    });
  }

  async revokeAllSessionsForUserInTransaction(
    manager: EntityManager,
    userId: string,
    revokedAt: Date,
  ): Promise<void> {
    await this.sessionRepository.revokeAllForUser(manager, userId, revokedAt);
  }

  private async assertLoginRateLimit(email: string, clientIp: string, now: Date): Promise<void> {
    const windowStart = new Date(
      now.getTime() - (now.getTime() % this.authConfig.loginRateLimitWindowMs),
    );
    const expiresAt = new Date(windowStart.getTime() + this.authConfig.loginRateLimitWindowMs);

    await this.dataSource.transaction(async (manager) => {
      const emailHash = this.rateLimitRepository.hashSubject(
        this.authConfig.rateLimitHmacSecret,
        `login:email:${email}`,
      );
      const ipHash = this.rateLimitRepository.hashSubject(
        this.authConfig.rateLimitHmacSecret,
        `login:ip:${clientIp}`,
      );

      const emailResult = await this.rateLimitRepository.consume(manager, {
        scope: 'auth.login.email',
        subjectHash: emailHash,
        windowStart,
        expiresAt,
        maxRequests: this.authConfig.loginRateLimitMax,
        now,
      });
      const ipResult = await this.rateLimitRepository.consume(manager, {
        scope: 'auth.login.ip',
        subjectHash: ipHash,
        windowStart,
        expiresAt,
        maxRequests: this.authConfig.loginRateLimitMax * 3,
        now,
      });

      if (!emailResult.allowed || !ipResult.allowed) {
        const retryAfterMs = Math.max(emailResult.retryAfterMs, ipResult.retryAfterMs);
        throw new ApiException(
          429,
          ErrorCode.RATE_LIMITED,
          INVALID_CREDENTIALS_MESSAGE,
          undefined,
          Math.ceil(retryAfterMs / 1000),
        );
      }
    });
  }

  private async auditLoginFailure(
    userId: string | null,
    requestId: string,
    reason: string,
  ): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      await this.auditService.append(manager, {
        actorUserId: userId,
        action: 'auth.login',
        targetType: 'user',
        targetId: userId,
        outcome: 'denied',
        requestId,
        details: { reason },
      });
    });
  }
}
