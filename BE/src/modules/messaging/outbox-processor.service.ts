import { Inject, Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { CLOCK, type Clock } from '../../platform/clock/clock.interface';
import { PayloadCipherService } from './payload-cipher.service';
import { MessagingConfigService } from './messaging-config.service';
import { OutboxRepository } from './outbox.repository';
import type { EmailOutbox } from './entities/email-outbox.entity';
import { MAIL_ADAPTER, type MailAdapter, type OutboxPayload } from './messaging.types';

export class OutboxProcessingError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly retryable: boolean,
  ) {
    super(message);
    this.name = 'OutboxProcessingError';
  }
}

@Injectable()
export class OutboxProcessorService {
  private readonly logger = new Logger(OutboxProcessorService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly outboxRepository: OutboxRepository,
    private readonly payloadCipher: PayloadCipherService,
    private readonly config: MessagingConfigService,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(MAIL_ADAPTER) private readonly mailAdapter: MailAdapter,
  ) {}

  async runMaintenance(): Promise<void> {
    const now = this.clock.now();
    await this.dataSource.transaction(async (manager) => {
      await this.outboxRepository.reclaimExpiredLeases(manager, now);
      await this.outboxRepository.cancelExpired(manager, now);
    });
  }

  async processBatch(workerId: string): Promise<number> {
    const now = this.clock.now();
    const leaseUntil = new Date(now.getTime() + this.config.jobLeaseSeconds * 1000);
    const claimed = await this.dataSource.transaction((manager) =>
      this.outboxRepository.claimBatch(manager, {
        workerId,
        batchSize: this.config.jobBatchSize,
        now,
        leaseUntil,
      }),
    );

    let processed = 0;
    for (const item of claimed) {
      await this.processClaimedItem(workerId, item);
      processed += 1;
    }
    return processed;
  }

  private async processClaimedItem(workerId: string, item: EmailOutbox): Promise<void> {
    const now = this.clock.now();

    if (item.expiresAt <= now) {
      await this.dataSource.transaction((manager) =>
        this.outboxRepository.markFailed(manager, {
          id: item.id,
          workerId,
          now,
          errorCode: 'outbox_expired',
        }),
      );
      return;
    }

    try {
      const payload = this.decryptPayload(item);
      await this.mailAdapter.send(this.buildMailMessage(item, payload));
      await this.dataSource.transaction(async (manager) => {
        const finalized = await this.outboxRepository.finalizeSent(manager, {
          id: item.id,
          workerId,
          now,
          sentAt: now,
        });
        if (!finalized) {
          throw new OutboxProcessingError(
            'Outbox finalize rejected stale lease',
            'stale_lease',
            false,
          );
        }
      });
    } catch (error) {
      await this.handleProcessingFailure(workerId, item, error);
    }
  }

  private decryptPayload(item: EmailOutbox): OutboxPayload {
    if (!item.encryptedPayload || !item.encryptionKeyId) {
      throw new OutboxProcessingError('Outbox payload missing', 'payload_missing', false);
    }

    try {
      return this.payloadCipher.decrypt(item.encryptedPayload, item.encryptionKeyId);
    } catch {
      throw new OutboxProcessingError('Outbox payload decrypt failed', 'payload_invalid', false);
    }
  }

  private buildMailMessage(item: EmailOutbox, payload: OutboxPayload) {
    return {
      to: item.recipient,
      subject: `[${item.templateCode}] Library notification`,
      text: `Template: ${item.templateCode}\nLink: ${payload.linkUrl}`,
    };
  }

  private async handleProcessingFailure(
    workerId: string,
    item: EmailOutbox,
    error: unknown,
  ): Promise<void> {
    const now = this.clock.now();
    const normalized =
      error instanceof OutboxProcessingError
        ? error
        : new OutboxProcessingError(
            error instanceof Error ? error.message : 'Unknown outbox error',
            'send_failed',
            true,
          );

    if (!normalized.retryable || item.attempts >= this.config.jobMaxAttempts) {
      await this.dataSource.transaction((manager) =>
        this.outboxRepository.markFailed(manager, {
          id: item.id,
          workerId,
          now,
          errorCode: normalized.code,
        }),
      );
      return;
    }

    const backoffMs = Math.min(300_000, 1000 * 2 ** Math.max(0, item.attempts - 1));
    const availableAt = new Date(now.getTime() + backoffMs);
    await this.dataSource.transaction((manager) =>
      this.outboxRepository.requeueForRetry(manager, {
        id: item.id,
        workerId,
        now,
        availableAt,
        errorCode: normalized.code,
      }),
    );
    this.logger.warn(`Requeued outbox ${item.id} after ${normalized.code}`);
  }
}
