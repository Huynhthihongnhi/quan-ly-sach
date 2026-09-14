import { Module } from '@nestjs/common';
import { AccessModule } from '../access/access.module';
import { AuditModule } from '../audit/audit.module';
import { AuthChallengeConfigModule } from '../auth/auth-challenge-config.module';
import { AuthModule } from '../auth/auth.module';
import { IdentityModule } from '../identity/identity.module';
import { MessagingModule } from '../messaging/messaging.module';
import { MeProfileController, UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [
    IdentityModule,
    AccessModule,
    AuditModule,
    AuthModule,
    MessagingModule,
    AuthChallengeConfigModule,
  ],
  controllers: [UsersController, MeProfileController],
  providers: [UsersService],
})
export class UsersModule {}
