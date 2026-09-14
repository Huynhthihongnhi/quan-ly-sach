import { Inject, Injectable, Logger, OnModuleDestroy, Optional } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { MessagingConfigService } from './messaging-config.service';
import { OutboxProcessorService } from './outbox-processor.service';

export const LOAN_REMINDER_SCHEDULER = Symbol('LOAN_REMINDER_SCHEDULER');

export interface LoanReminderSchedulerHook {
  scanDueReminders(): Promise<number>;
}

@Injectable()
export class OutboxWorkerRunner implements OnModuleDestroy {
  private readonly logger = new Logger(OutboxWorkerRunner.name);
  private readonly workerId = `worker-${randomUUID()}`;
  private running = false;
  private stopRequested = false;

  constructor(
    private readonly processor: OutboxProcessorService,
    private readonly config: MessagingConfigService,
    @Optional()
    @Inject(LOAN_REMINDER_SCHEDULER)
    private readonly loanReminderScheduler?: LoanReminderSchedulerHook,
  ) {}

  onModuleDestroy(): void {
    this.stopRequested = true;
  }

  requestStop(): void {
    this.stopRequested = true;
  }

  async runUntilStopped(): Promise<void> {
    if (this.running) {
      return;
    }

    this.running = true;
    this.logger.log(`Outbox worker ${this.workerId} started`);

    while (!this.stopRequested) {
      await this.processor.runMaintenance();
      if (this.loanReminderScheduler) {
        await this.loanReminderScheduler.scanDueReminders();
      }
      const processed = await this.processor.processBatch(this.workerId);
      if (processed === 0) {
        await sleep(this.config.jobPollSeconds * 1000);
      }
    }

    this.running = false;
    this.logger.log(`Outbox worker ${this.workerId} stopped`);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
