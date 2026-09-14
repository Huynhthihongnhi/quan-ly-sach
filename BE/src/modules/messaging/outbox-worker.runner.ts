import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { MessagingConfigService } from './messaging-config.service';
import { OutboxProcessorService } from './outbox-processor.service';

@Injectable()
export class OutboxWorkerRunner implements OnModuleDestroy {
  private readonly logger = new Logger(OutboxWorkerRunner.name);
  private readonly workerId = `worker-${randomUUID()}`;
  private running = false;
  private stopRequested = false;

  constructor(
    private readonly processor: OutboxProcessorService,
    private readonly config: MessagingConfigService,
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
