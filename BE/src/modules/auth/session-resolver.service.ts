import { Inject, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { CLOCK, Clock } from '../../platform/clock/clock.interface';
import { User } from '../identity/entities/user.entity';
import { AuthConfigService } from './auth-config.service';
import { deriveCsrfToken } from './crypto/csrf-token';
import { hashSessionToken } from './crypto/session-token';
import { PermissionResolverService } from './permission-resolver.service';
import { SessionRepository } from './session.repository';

export interface ResolvedSessionContext {
  sessionId: string;
  userId: string;
  csrfToken: string;
  permissionCodes: string[];
}

@Injectable()
export class SessionResolverService {
  constructor(
    private readonly sessionRepository: SessionRepository,
    private readonly permissionResolver: PermissionResolverService,
    private readonly authConfig: AuthConfigService,
    private readonly dataSource: DataSource,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async resolveFromSessionToken(sessionToken: Buffer): Promise<ResolvedSessionContext | null> {
    const now = this.clock.now();
    const tokenHash = hashSessionToken(sessionToken);
    const session = await this.sessionRepository.findActiveByTokenHash(tokenHash, now);
    if (!session) {
      return null;
    }

    const user = await this.dataSource
      .getRepository(User)
      .findOne({ where: { id: session.userId } });
    if (!user || user.status !== 'active' || user.authVersion !== session.authVersion) {
      return null;
    }

    const nextIdleExpiresAt = new Date(
      Math.min(
        now.getTime() + this.authConfig.sessionIdleTtlMs,
        session.absoluteExpiresAt.getTime(),
      ),
    );
    await this.sessionRepository.touchIdleIfValid(session.id, now, nextIdleExpiresAt);

    const permissionCodes = await this.permissionResolver.resolvePermissionCodesForUser(user.id);
    const csrfToken = deriveCsrfToken(sessionToken, this.authConfig.csrfHmacSecret);

    return {
      sessionId: session.id,
      userId: user.id,
      csrfToken,
      permissionCodes,
    };
  }
}
