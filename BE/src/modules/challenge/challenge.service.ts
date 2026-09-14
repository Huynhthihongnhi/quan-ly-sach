import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { generateChallengeToken } from './challenge-token.generator';
import { ChallengeRepository } from './challenge.repository';
import type { CreateChallengeInput, CreatedChallenge } from './challenge.types';

@Injectable()
export class ChallengeService {
  constructor(private readonly challengeRepository: ChallengeRepository) {}

  async createChallenge(
    manager: EntityManager,
    input: CreateChallengeInput,
  ): Promise<CreatedChallenge> {
    const { rawToken, tokenHash } = generateChallengeToken();
    const challenge = await this.challengeRepository.create(manager, {
      userId: input.userId,
      purpose: input.purpose,
      tokenHash,
      emailSnapshot: input.email,
      expiresAt: input.expiresAt,
    });

    return {
      id: challenge.id,
      tokenHash,
      rawToken,
    };
  }
}
