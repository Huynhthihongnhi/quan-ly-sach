import { Inject, Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { AuthChallengeConfigService } from '../auth/auth-challenge-config.service';
import { ChallengeRepository } from '../challenge/challenge.repository';
import { ChallengeService } from '../challenge/challenge.service';
import type { ChallengePurpose } from '../challenge/challenge.types';
import { CLOCK, type Clock } from '../../platform/clock/clock.interface';
import { OutboxService } from './outbox.service';

export interface EnqueueChallengeEmailInput {
  userId: string;
  purpose: ChallengePurpose;
  email: string;
  challengeExpiresAt: Date;
  outboxExpiresAt: Date;
  templateCode: string;
  dedupeKey: string;
}

export interface EnqueuedChallengeEmail {
  challengeId: string;
  outboxId: string;
  rawToken: string;
  linkUrl: string;
}

@Injectable()
export class ChallengeOutboxOrchestrator {
  constructor(
    private readonly challengeService: ChallengeService,
    private readonly challengeRepository: ChallengeRepository,
    private readonly outboxService: OutboxService,
    private readonly challengeConfig: AuthChallengeConfigService,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async enqueueChallengeEmail(
    manager: EntityManager,
    input: EnqueueChallengeEmailInput,
  ): Promise<EnqueuedChallengeEmail> {
    await this.challengeRepository.revokeActiveByUserAndPurpose(manager, {
      userId: input.userId,
      purpose: input.purpose,
      revokedAt: this.clock.now(),
    });

    const challenge = await this.challengeService.createChallenge(manager, {
      userId: input.userId,
      purpose: input.purpose,
      email: input.email,
      expiresAt: input.challengeExpiresAt,
    });

    const linkUrl = this.challengeConfig.buildChallengeLink(input.purpose, challenge.rawToken);

    const outboxId = await this.outboxService.enqueue(manager, {
      userId: input.userId,
      challengeId: challenge.id,
      recipient: input.email,
      templateCode: input.templateCode,
      dedupeKey: input.dedupeKey,
      payload: { token: challenge.rawToken, linkUrl },
      availableAt: this.clock.now(),
      expiresAt: input.outboxExpiresAt,
    });

    return {
      challengeId: challenge.id,
      outboxId,
      rawToken: challenge.rawToken,
      linkUrl,
    };
  }
}
