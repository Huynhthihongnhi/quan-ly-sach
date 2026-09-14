import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChallengeRepository } from './challenge.repository';
import { ChallengeService } from './challenge.service';
import { IdentityChallenge } from './entities/identity-challenge.entity';

@Module({
  imports: [TypeOrmModule.forFeature([IdentityChallenge])],
  providers: [ChallengeRepository, ChallengeService],
  exports: [ChallengeService, ChallengeRepository],
})
export class ChallengeModule {}
