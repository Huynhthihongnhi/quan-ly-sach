import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthChallengeConfigModule } from '../auth/auth-challenge-config.module';
import { ChallengeModule } from '../challenge/challenge.module';
import { ClockModule } from '../../platform/clock/clock.module';
import { ChallengeOutboxOrchestrator } from './challenge-outbox.orchestrator';
import { EmailOutbox } from './entities/email-outbox.entity';
import { MessagingConfigService } from './messaging-config.service';
import { OutboxProcessorService } from './outbox-processor.service';
import { OutboxRepository } from './outbox.repository';
import { OutboxService } from './outbox.service';
import { OutboxWorkerRunner } from './outbox-worker.runner';
import { PayloadCipherService } from './payload-cipher.service';
import { SmtpMailAdapter } from './smtp-mail.adapter';
import { MAIL_ADAPTER } from './messaging.types';

@Module({
  imports: [
    TypeOrmModule.forFeature([EmailOutbox]),
    ClockModule,
    ChallengeModule,
    AuthChallengeConfigModule,
  ],
  providers: [
    MessagingConfigService,
    PayloadCipherService,
    OutboxRepository,
    OutboxService,
    OutboxProcessorService,
    OutboxWorkerRunner,
    ChallengeOutboxOrchestrator,
    SmtpMailAdapter,
    { provide: MAIL_ADAPTER, useExisting: SmtpMailAdapter },
  ],
  exports: [
    OutboxService,
    OutboxRepository,
    OutboxProcessorService,
    OutboxWorkerRunner,
    ChallengeOutboxOrchestrator,
    PayloadCipherService,
    MessagingConfigService,
    MAIL_ADAPTER,
  ],
})
export class MessagingModule {}
