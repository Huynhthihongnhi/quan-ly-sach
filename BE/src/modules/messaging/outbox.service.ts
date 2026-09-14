import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { PayloadCipherService } from './payload-cipher.service';
import { OutboxRepository } from './outbox.repository';
import type { EnqueueOutboxInput } from './messaging.types';

@Injectable()
export class OutboxService {
  constructor(
    private readonly outboxRepository: OutboxRepository,
    private readonly payloadCipher: PayloadCipherService,
  ) {}

  async enqueue(manager: EntityManager, input: EnqueueOutboxInput): Promise<string> {
    const encrypted = this.payloadCipher.encrypt(input.payload);
    const row = await this.outboxRepository.enqueue(manager, {
      ...input,
      encryptedPayload: encrypted.ciphertext,
      encryptionKeyId: encrypted.keyId,
    });
    return row.id;
  }
}
