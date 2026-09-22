import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, In, Repository } from 'typeorm';
import { EmailOutbox } from './entities/email-outbox.entity';
import type { EnqueueOutboxInput, OutboxState } from './messaging.types';

@Injectable()
export class OutboxRepository {
  constructor(
    @InjectRepository(EmailOutbox)
    private readonly outbox: Repository<EmailOutbox>,
  ) {}

  async enqueue(
    manager: EntityManager,
    input: EnqueueOutboxInput & { encryptedPayload: Buffer; encryptionKeyId: string },
  ): Promise<EmailOutbox> {
    const entity = manager.create(EmailOutbox, {
      userId: input.userId,
      challengeId: input.challengeId,
      recipient: input.recipient,
      templateCode: input.templateCode,
      dedupeKey: input.dedupeKey,
      encryptedPayload: input.encryptedPayload,
      encryptionKeyId: input.encryptionKeyId,
      state: 'queued',
      attempts: 0,
      availableAt: input.availableAt,
      expiresAt: input.expiresAt,
    });
    return manager.save(entity);
  }

  async claimBatch(
    manager: EntityManager,
    params: {
      workerId: string;
      batchSize: number;
      now: Date;
      leaseUntil: Date;
    },
  ): Promise<EmailOutbox[]> {
    const rows = normalizeClaimRows(
      await manager.query(
        `SELECT id
         FROM email_outbox
         WHERE state = 'queued'
           AND available_at <= ?
           AND expires_at > ?
         ORDER BY available_at ASC, id ASC
         LIMIT ?
         FOR UPDATE SKIP LOCKED`,
        [params.now, params.now, params.batchSize],
      ),
    );

    if (rows.length === 0) {
      return [];
    }

    const ids = rows.map((row) => row.id);
    await manager.query(
      `UPDATE email_outbox
       SET state = 'processing',
           attempts = attempts + 1,
           lease_owner = ?,
           leased_until = ?
       WHERE id IN (${ids.map(() => '?').join(', ')})
         AND state = 'queued'`,
      [params.workerId, params.leaseUntil, ...ids],
    );

    return manager.find(EmailOutbox, { where: { id: In(ids) } });
  }

  async finalizeSent(
    manager: EntityManager,
    params: { id: string; workerId: string; now: Date; sentAt: Date },
  ): Promise<boolean> {
    const result: unknown = await manager.query(
      `UPDATE email_outbox
       SET state = 'sent',
           sent_at = ?,
           lease_owner = NULL,
           leased_until = NULL,
           encrypted_payload = NULL,
           encryption_key_id = NULL,
           last_error_code = NULL
       WHERE id = ?
         AND state = 'processing'
         AND lease_owner = ?
         AND leased_until >= ?`,
      [params.sentAt, params.id, params.workerId, params.now],
    );
    return readAffectedRows(result) > 0;
  }

  async requeueForRetry(
    manager: EntityManager,
    params: {
      id: string;
      workerId: string;
      now: Date;
      availableAt: Date;
      errorCode: string;
    },
  ): Promise<boolean> {
    const result: unknown = await manager.query(
      `UPDATE email_outbox
       SET state = 'queued',
           lease_owner = NULL,
           leased_until = NULL,
           available_at = ?,
           last_error_code = ?
       WHERE id = ?
         AND state = 'processing'
         AND lease_owner = ?
         AND leased_until >= ?`,
      [params.availableAt, params.errorCode, params.id, params.workerId, params.now],
    );
    return readAffectedRows(result) > 0;
  }

  async cancelProcessing(
    manager: EntityManager,
    params: { id: string; workerId: string; now: Date; errorCode: string },
  ): Promise<boolean> {
    const result: unknown = await manager.query(
      `UPDATE email_outbox
       SET state = 'cancelled',
           lease_owner = NULL,
           leased_until = NULL,
           encrypted_payload = NULL,
           encryption_key_id = NULL,
           last_error_code = ?
       WHERE id = ?
         AND state = 'processing'
         AND lease_owner = ?
         AND leased_until >= ?`,
      [params.errorCode, params.id, params.workerId, params.now],
    );
    return readAffectedRows(result) > 0;
  }

  async markFailed(
    manager: EntityManager,
    params: { id: string; workerId: string; now: Date; errorCode: string },
  ): Promise<boolean> {
    const result: unknown = await manager.query(
      `UPDATE email_outbox
       SET state = 'failed',
           lease_owner = NULL,
           leased_until = NULL,
           encrypted_payload = NULL,
           encryption_key_id = NULL,
           last_error_code = ?
       WHERE id = ?
         AND state = 'processing'
         AND lease_owner = ?
         AND leased_until >= ?`,
      [params.errorCode, params.id, params.workerId, params.now],
    );
    return readAffectedRows(result) > 0;
  }

  async reclaimExpiredLeases(manager: EntityManager, now: Date): Promise<number> {
    const result: unknown = await manager.query(
      `UPDATE email_outbox
       SET state = 'queued',
           lease_owner = NULL,
           leased_until = NULL,
           available_at = ?
       WHERE state = 'processing'
         AND leased_until IS NOT NULL
         AND leased_until < ?`,
      [now, now],
    );
    return readAffectedRows(result);
  }

  async cancelExpired(manager: EntityManager, now: Date): Promise<number> {
    const result: unknown = await manager.query(
      `UPDATE email_outbox
       SET state = 'cancelled',
           encrypted_payload = NULL,
           encryption_key_id = NULL,
           lease_owner = NULL,
           leased_until = NULL
       WHERE expires_at <= ?
         AND state IN ('queued', 'processing')`,
      [now],
    );
    return readAffectedRows(result);
  }

  async findById(id: string, manager?: EntityManager): Promise<EmailOutbox | null> {
    const repo = manager ? manager.getRepository(EmailOutbox) : this.outbox;
    return repo.findOne({ where: { id } });
  }

  async countByState(state: OutboxState, manager?: EntityManager): Promise<number> {
    const repo = manager ? manager.getRepository(EmailOutbox) : this.outbox;
    return repo.count({ where: { state } });
  }
}

interface OutboxClaimRow {
  id: string;
}

function normalizeClaimRows(value: unknown): OutboxClaimRow[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((entry) => {
    if (typeof entry !== 'object' || entry === null || !('id' in entry)) {
      throw new Error('Invalid outbox claim row');
    }
    return { id: String((entry as { id: string | number }).id) };
  });
}

function readAffectedRows(result: unknown): number {
  if (Array.isArray(result)) {
    return readAffectedRows(result[0]);
  }
  if (typeof result === 'object' && result !== null && 'affectedRows' in result) {
    return Number((result as { affectedRows?: number }).affectedRows ?? 0);
  }
  return 0;
}
