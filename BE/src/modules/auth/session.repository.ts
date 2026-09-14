import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { AuthSession } from './entities/auth-session.entity';

export interface CreateSessionInput {
  userId: string;
  tokenHash: Buffer;
  csrfHash: Buffer;
  authVersion: string;
  now: Date;
  idleExpiresAt: Date;
  absoluteExpiresAt: Date;
}

@Injectable()
export class SessionRepository {
  constructor(
    @InjectRepository(AuthSession)
    private readonly sessions: Repository<AuthSession>,
  ) {}

  async findActiveByTokenHash(tokenHash: Buffer, now: Date): Promise<AuthSession | null> {
    return this.sessions
      .createQueryBuilder('session')
      .where('session.token_hash = :tokenHash', { tokenHash })
      .andWhere('session.revoked_at IS NULL')
      .andWhere('session.idle_expires_at > :now', { now })
      .andWhere('session.absolute_expires_at > :now', { now })
      .getOne();
  }

  async createSession(manager: EntityManager, input: CreateSessionInput): Promise<AuthSession> {
    const session = manager.create(AuthSession, {
      userId: input.userId,
      tokenHash: input.tokenHash,
      csrfHash: input.csrfHash,
      authVersion: input.authVersion,
      lastSeenAt: input.now,
      idleExpiresAt: input.idleExpiresAt,
      absoluteExpiresAt: input.absoluteExpiresAt,
      revokedAt: null,
    });
    return manager.save(AuthSession, session);
  }

  async revokeSession(manager: EntityManager, sessionId: string, revokedAt: Date): Promise<void> {
    await manager
      .createQueryBuilder()
      .update(AuthSession)
      .set({ revokedAt })
      .where('id = :sessionId', { sessionId })
      .andWhere('revoked_at IS NULL')
      .execute();
  }

  async revokeAllForUser(manager: EntityManager, userId: string, revokedAt: Date): Promise<void> {
    await manager
      .createQueryBuilder()
      .update(AuthSession)
      .set({ revokedAt })
      .where('user_id = :userId', { userId })
      .andWhere('revoked_at IS NULL')
      .execute();
  }

  async touchIdleIfValid(sessionId: string, now: Date, nextIdleExpiresAt: Date): Promise<boolean> {
    const result = await this.sessions
      .createQueryBuilder()
      .update(AuthSession)
      .set({ lastSeenAt: now, idleExpiresAt: nextIdleExpiresAt })
      .where('id = :sessionId', { sessionId })
      .andWhere('revoked_at IS NULL')
      .andWhere('idle_expires_at > :now', { now })
      .andWhere('absolute_expires_at > :now', { now })
      .execute();

    return (result.affected ?? 0) > 0;
  }
}
