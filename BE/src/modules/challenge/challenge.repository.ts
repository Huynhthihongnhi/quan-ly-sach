import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { IdentityChallenge } from './entities/identity-challenge.entity';
import type { ChallengePurpose } from './challenge.types';

@Injectable()
export class ChallengeRepository {
  constructor(
    @InjectRepository(IdentityChallenge)
    private readonly challenges: Repository<IdentityChallenge>,
  ) {}

  async create(
    manager: EntityManager,
    input: {
      userId: string;
      purpose: ChallengePurpose;
      tokenHash: Buffer;
      emailSnapshot: string;
      expiresAt: Date;
    },
  ): Promise<IdentityChallenge> {
    const entity = manager.create(IdentityChallenge, {
      userId: input.userId,
      purpose: input.purpose,
      tokenHash: input.tokenHash,
      emailSnapshot: input.emailSnapshot,
      expiresAt: input.expiresAt,
    });
    return manager.save(entity);
  }

  async countAll(manager?: EntityManager): Promise<number> {
    const repo = manager ? manager.getRepository(IdentityChallenge) : this.challenges;
    return repo.count();
  }

  async revokeActiveByUserAndPurpose(
    manager: EntityManager,
    input: {
      userId: string;
      purpose: ChallengePurpose;
      revokedAt: Date;
      exceptChallengeId?: string;
    },
  ): Promise<number> {
    const baseSql = `UPDATE identity_challenges
       SET revoked_at = ?
       WHERE user_id = ?
         AND purpose = ?
         AND consumed_at IS NULL
         AND revoked_at IS NULL`;
    const sql = input.exceptChallengeId ? `${baseSql} AND id != ?` : baseSql;
    const params = input.exceptChallengeId
      ? [input.revokedAt, input.userId, input.purpose, input.exceptChallengeId]
      : [input.revokedAt, input.userId, input.purpose];

    const result: unknown = await manager.query(sql, params);
    return readAffectedRows(result);
  }

  async findByTokenHashForUpdate(
    manager: EntityManager,
    tokenHash: Buffer,
  ): Promise<IdentityChallenge | null> {
    return manager
      .createQueryBuilder(IdentityChallenge, 'challenge')
      .setLock('pessimistic_write')
      .where('challenge.token_hash = :tokenHash', { tokenHash })
      .getOne();
  }

  async consumeIfEligible(
    manager: EntityManager,
    input: {
      challengeId: string;
      expectedPurpose: ChallengePurpose;
      now: Date;
    },
  ): Promise<boolean> {
    const result: unknown = await manager.query(
      `UPDATE identity_challenges
       SET consumed_at = ?
       WHERE id = ?
         AND purpose = ?
         AND consumed_at IS NULL
         AND revoked_at IS NULL
         AND expires_at > ?`,
      [input.now, input.challengeId, input.expectedPurpose, input.now],
    );
    return readAffectedRows(result) > 0;
  }

  async countActiveByUserAndPurpose(
    userId: string,
    purpose: ChallengePurpose,
    manager?: EntityManager,
  ): Promise<number> {
    const repo = manager ? manager.getRepository(IdentityChallenge) : this.challenges;
    return repo
      .createQueryBuilder('challenge')
      .where('challenge.user_id = :userId', { userId })
      .andWhere('challenge.purpose = :purpose', { purpose })
      .andWhere('challenge.consumed_at IS NULL')
      .andWhere('challenge.revoked_at IS NULL')
      .getCount();
  }

  async findLatestByUserAndPurpose(
    userId: string,
    purpose: ChallengePurpose,
    manager?: EntityManager,
  ): Promise<IdentityChallenge | null> {
    const repo = manager ? manager.getRepository(IdentityChallenge) : this.challenges;
    return repo.findOne({
      where: { userId, purpose },
      order: { id: 'DESC' },
    });
  }
}

function readAffectedRows(result: unknown): number {
  if (Array.isArray(result)) {
    return readAffectedRows(result[0]);
  }
  if (typeof result === 'object' && result !== null && 'affectedRows' in result) {
    return Number((result as { affectedRows?: number }).affectedRows ?? 0);
  }
  return 0;
}
