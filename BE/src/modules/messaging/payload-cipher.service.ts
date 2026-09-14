import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { MessagingConfigService } from './messaging-config.service';
import type { OutboxPayload } from './messaging.types';

const NONCE_BYTES = 12;

@Injectable()
export class PayloadCipherService {
  constructor(private readonly config: MessagingConfigService) {}

  encrypt(payload: OutboxPayload): { ciphertext: Buffer; keyId: string } {
    const nonce = randomBytes(NONCE_BYTES);
    const cipher = createCipheriv('aes-256-gcm', this.config.outboxEncryptionKey, nonce);
    const plaintext = Buffer.from(JSON.stringify(payload), 'utf8');
    const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    const tag = cipher.getAuthTag();
    return {
      ciphertext: Buffer.concat([nonce, tag, encrypted]),
      keyId: this.config.outboxActiveKeyId,
    };
  }

  decrypt(ciphertext: Buffer, keyId: string): OutboxPayload {
    if (keyId !== this.config.outboxActiveKeyId) {
      throw new Error('Unsupported outbox encryption key id');
    }

    const nonce = ciphertext.subarray(0, NONCE_BYTES);
    const tag = ciphertext.subarray(NONCE_BYTES, NONCE_BYTES + 16);
    const encrypted = ciphertext.subarray(NONCE_BYTES + 16);
    const decipher = createDecipheriv('aes-256-gcm', this.config.outboxEncryptionKey, nonce);
    decipher.setAuthTag(tag);
    const plaintext = Buffer.concat([decipher.update(encrypted), decipher.final()]).toString(
      'utf8',
    );
    return JSON.parse(plaintext) as OutboxPayload;
  }
}
