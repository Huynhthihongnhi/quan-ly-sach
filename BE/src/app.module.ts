import { Module } from '@nestjs/common';
import { AppConfigModule } from './config/app-config.module';
import { HttpCommonModule } from './common/http/http-common.module';
import { AuthModule } from './modules/auth/auth.module';
import { AccessModule } from './modules/access/access.module';
import { AuditModule } from './modules/audit/audit.module';
import { BootstrapModule } from './modules/bootstrap/bootstrap.module';
import { CardsModule } from './modules/cards/cards.module';
import { CatalogModule } from './modules/catalog/catalog.module';
import { CirculationModule } from './modules/circulation/circulation.module';
import { ChallengeModule } from './modules/challenge/challenge.module';
import { MessagingModule } from './modules/messaging/messaging.module';
import { ContractDemoModule } from './modules/contract-demo/contract-demo.module';
import { HealthModule } from './modules/health/health.module';
import { IdentityModule } from './modules/identity/identity.module';
import { UsersModule } from './modules/users/users.module';
import { ClockModule } from './platform/clock/clock.module';
import { DatabaseModule } from './platform/database/database.module';

@Module({
  imports: [
    AppConfigModule,
    HttpCommonModule,
    ClockModule,
    DatabaseModule,
    IdentityModule,
    AuthModule,
    AccessModule,
    AuditModule,
    BootstrapModule,
    HealthModule,
    ContractDemoModule,
    UsersModule,
    CatalogModule,
    CardsModule,
    CirculationModule,
    ChallengeModule,
    MessagingModule,
  ],
})
export class AppModule {}
