import { Inject, Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { CLOCK, type Clock } from '../../platform/clock/clock.interface';
import { OutboxService } from '../messaging/outbox.service';
import { CirculationInventoryService } from './circulation-inventory.service';
import { computeDueReminderSendAt, isLoanOverdue } from './library-timezone.util';
import {
  LOAN_DUE_REMINDER_DAYS_BEFORE,
  LOAN_DUE_REMINDER_KIND,
  LOAN_DUE_REMINDER_LOCAL_HOUR,
  LOAN_DUE_REMINDER_TEMPLATE,
  buildLoanReminderDedupeKey,
} from './loan-reminder.constants';
import { LoansRepository } from './loans.repository';
import { NotificationDeliveriesRepository } from './notification-deliveries.repository';

interface ReminderCandidate {
  loanId: string;
  userId: string;
  dueAt: Date;
  email: string;
}

@Injectable()
export class LoanReminderSchedulerService {
  private readonly logger = new Logger(LoanReminderSchedulerService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly circulationInventory: CirculationInventoryService,
    private readonly loansRepository: LoansRepository,
    private readonly notificationDeliveriesRepository: NotificationDeliveriesRepository,
    private readonly outboxService: OutboxService,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async scanDueReminders(): Promise<number> {
    if (!this.circulationInventory.isEnabled()) {
      return 0;
    }
    await this.circulationInventory.assertSchemaReady();

    const now = this.clock.now();
    const candidates = await this.listReminderCandidates(now);
    let enqueued = 0;

    for (const candidate of candidates) {
      const reminderSendAt = computeDueReminderSendAt(candidate.dueAt, {
        daysBefore: LOAN_DUE_REMINDER_DAYS_BEFORE,
        localSendHour: LOAN_DUE_REMINDER_LOCAL_HOUR,
      });
      if (now.getTime() < reminderSendAt.getTime()) {
        continue;
      }
      if (isLoanOverdue(candidate.dueAt, now)) {
        continue;
      }

      const didEnqueue = await this.tryEnqueueReminder(candidate, now);
      if (didEnqueue) {
        enqueued += 1;
      }
    }

    if (enqueued > 0) {
      this.logger.log(`Enqueued ${enqueued} loan due reminders`);
    }
    return enqueued;
  }

  private async listReminderCandidates(now: Date): Promise<ReminderCandidate[]> {
    const rows: Array<{
      loanId: string;
      userId: string;
      dueAt: Date;
      email: string;
    }> = await this.dataSource.query(
      `SELECT l.id AS loanId, l.user_id AS userId, l.due_at AS dueAt, u.email AS email
       FROM loans l
       INNER JOIN users u ON u.id = l.user_id
       WHERE l.state = 'borrowed'
         AND l.due_at IS NOT NULL
         AND l.due_at > ?
         AND u.email IS NOT NULL
         AND u.status = 'active'
         AND NOT EXISTS (
           SELECT 1 FROM notification_deliveries nd
           WHERE nd.loan_id = l.id
             AND nd.due_at_snapshot = l.due_at
             AND nd.kind = ?
         )`,
      [now, LOAN_DUE_REMINDER_KIND],
    );

    return rows.map((row) => ({
      loanId: String(row.loanId),
      userId: String(row.userId),
      dueAt: row.dueAt,
      email: String(row.email),
    }));
  }

  private async tryEnqueueReminder(candidate: ReminderCandidate, now: Date): Promise<boolean> {
    try {
      return await this.dataSource.transaction(async (manager) => {
        const loan = await this.loansRepository.findByIdForUpdate(manager, candidate.loanId);
        if (!loan || loan.state !== 'borrowed' || !loan.dueAt) {
          return false;
        }
        if (loan.dueAt.getTime() !== candidate.dueAt.getTime()) {
          return false;
        }
        if (isLoanOverdue(loan.dueAt, now)) {
          return false;
        }

        const alreadySent = await this.notificationDeliveriesRepository.existsForLoanDueKind(
          manager,
          {
            loanId: loan.id,
            dueAtSnapshot: loan.dueAt,
            kind: LOAN_DUE_REMINDER_KIND,
          },
        );
        if (alreadySent) {
          return false;
        }

        const dedupeKey = buildLoanReminderDedupeKey(loan.id, loan.dueAt, LOAN_DUE_REMINDER_KIND);
        const dueIso = loan.dueAt.toISOString();

        const outboxId = await this.outboxService.enqueue(manager, {
          userId: loan.userId,
          challengeId: null,
          recipient: candidate.email,
          templateCode: LOAN_DUE_REMINDER_TEMPLATE,
          dedupeKey,
          payload: {
            token: loan.id,
            linkUrl: `/me/loans/${loan.id}`,
            loanId: loan.id,
            dueAtSnapshot: dueIso,
            kind: LOAN_DUE_REMINDER_KIND,
          },
          availableAt: now,
          expiresAt: loan.dueAt,
        });

        await this.notificationDeliveriesRepository.insertDelivery(manager, {
          loanId: loan.id,
          dueAtSnapshot: loan.dueAt,
          kind: LOAN_DUE_REMINDER_KIND,
          outboxId,
        });

        return true;
      });
    } catch (error) {
      this.logger.warn(`Skipped reminder enqueue for loan ${candidate.loanId}: ${String(error)}`);
      return false;
    }
  }
}
