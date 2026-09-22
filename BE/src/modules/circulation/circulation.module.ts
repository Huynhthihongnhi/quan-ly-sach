import { Global, Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppConfigModule } from '../../config/app-config.module';
import { OUTBOX_SEND_GATE } from '../messaging/outbox-send-gate.token';
import { LOAN_REMINDER_SCHEDULER } from '../messaging/outbox-worker.runner';
import { MessagingModule } from '../messaging/messaging.module';
import { AuthModule } from '../auth/auth.module';
import { AuditModule } from '../audit/audit.module';
import { CardsModule } from '../cards/cards.module';
import { CatalogModule } from '../catalog/catalog.module';
import { IdentityModule } from '../identity/identity.module';
import { AdminLoansController } from './admin-loans.controller';
import { CirculationConfigService } from './circulation-config.service';
import { CirculationInventoryService } from './circulation-inventory.service';
import { LoanEvent } from './entities/loan-event.entity';
import { Loan } from './entities/loan.entity';
import { NotificationDelivery } from './entities/notification-delivery.entity';
import { LoanReminderSchedulerService } from './loan-reminder-scheduler.service';
import { LoanReminderSendGateService } from './loan-reminder-send-gate.service';
import { MeLoansController } from './me-loans.controller';
import { LoansController } from './loans.controller';
import { LoansRepository } from './loans.repository';
import { LoansService } from './loans.service';
import { NotificationDeliveriesRepository } from './notification-deliveries.repository';

@Global()
@Module({
  imports: [
    AppConfigModule,
    MessagingModule,
    AuthModule,
    AuditModule,
    IdentityModule,
    CardsModule,
    forwardRef(() => CatalogModule),
    TypeOrmModule.forFeature([Loan, LoanEvent, NotificationDelivery]),
  ],
  controllers: [LoansController, MeLoansController, AdminLoansController],
  providers: [
    CirculationConfigService,
    CirculationInventoryService,
    LoansRepository,
    LoansService,
    NotificationDeliveriesRepository,
    LoanReminderSchedulerService,
    LoanReminderSendGateService,
    { provide: OUTBOX_SEND_GATE, useExisting: LoanReminderSendGateService },
    { provide: LOAN_REMINDER_SCHEDULER, useExisting: LoanReminderSchedulerService },
  ],
  exports: [
    CirculationInventoryService,
    CirculationConfigService,
    LoanReminderSchedulerService,
    OUTBOX_SEND_GATE,
    LOAN_REMINDER_SCHEDULER,
    TypeOrmModule,
  ],
})
export class CirculationModule {}
