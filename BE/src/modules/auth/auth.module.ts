import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppConfigModule } from '../../config/app-config.module';
import { AccessModule } from '../access/access.module';
import { AuditModule } from '../audit/audit.module';
import { ChallengeModule } from '../challenge/challenge.module';
import { IdentityModule } from '../identity/identity.module';
import { MessagingModule } from '../messaging/messaging.module';
import { AuthChallengeConfigModule } from './auth-challenge-config.module';
import { AuthConfigService } from './auth-config.service';
import { ChallengeConsumptionService } from './challenge-consumption.service';
import { PasswordRecoveryService } from './password-recovery.service';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthSession } from './entities/auth-session.entity';
import { RateLimitBucket } from './entities/rate-limit-bucket.entity';
import { CsrfGuard } from './guards/csrf.guard';
import { MutationOriginGuard } from './guards/mutation-origin.guard';
import { SessionContextMiddleware } from './middleware/session-context.middleware';
import { PermissionResolverService } from './permission-resolver.service';
import { RateLimitRepository } from './rate-limit.repository';
import { SessionRepository } from './session.repository';
import { SessionResolverService } from './session-resolver.service';

@Module({
  imports: [
    AppConfigModule,
    IdentityModule,
    AccessModule,
    AuditModule,
    ChallengeModule,
    MessagingModule,
    AuthChallengeConfigModule,
    TypeOrmModule.forFeature([AuthSession, RateLimitBucket]),
  ],
  controllers: [AuthController],
  providers: [
    AuthConfigService,
    AuthService,
    ChallengeConsumptionService,
    PasswordRecoveryService,
    SessionRepository,
    RateLimitRepository,
    SessionResolverService,
    PermissionResolverService,
    SessionContextMiddleware,
    { provide: APP_GUARD, useClass: MutationOriginGuard },
    { provide: APP_GUARD, useClass: CsrfGuard },
  ],
  exports: [AuthService, SessionResolverService, AuthConfigService, RateLimitRepository],
})
export class AuthModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(SessionContextMiddleware).forRoutes('*');
  }
}
