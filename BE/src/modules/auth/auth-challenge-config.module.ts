import { Module } from '@nestjs/common';
import { AuthChallengeConfigService } from './auth-challenge-config.service';

@Module({
  providers: [AuthChallengeConfigService],
  exports: [AuthChallengeConfigService],
})
export class AuthChallengeConfigModule {}
