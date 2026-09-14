import { Injectable } from '@nestjs/common';
import { ConfigurationError } from '../../config/app-config.service';

@Injectable()
export class MessagingConfigService {
  readonly mailHost: string;
  readonly mailPort: number;
  readonly mailUser: string;
  readonly mailPassword: string;
  readonly mailFrom: string;
  readonly outboxActiveKeyId: string;
  readonly outboxEncryptionKey: Buffer;
  readonly jobBatchSize: number;
  readonly jobLeaseSeconds: number;
  readonly jobMaxAttempts: number;
  readonly jobPollSeconds: number;

  constructor() {
    this.mailHost = readString('MAIL_HOST', '127.0.0.1');
    this.mailPort = readNumber('MAIL_PORT', 1025);
    this.mailUser = readString('MAIL_USER', '');
    this.mailPassword = readString('MAIL_PASSWORD', '');
    this.mailFrom = readString('MAIL_FROM', 'noreply@local.test');
    this.outboxActiveKeyId = readString('OUTBOX_ENCRYPTION_KEY_ID', 'local-v1');
    this.outboxEncryptionKey = readEncryptionKey('OUTBOX_ENCRYPTION_KEY');
    this.jobBatchSize = readNumber('JOB_BATCH_SIZE', 10);
    this.jobLeaseSeconds = readNumber('JOB_LEASE_SECONDS', 30);
    this.jobMaxAttempts = readNumber('JOB_MAX_ATTEMPTS', 5);
    this.jobPollSeconds = readNumber('JOB_POLL_SECONDS', 1);
  }
}

function readString(key: string, fallback?: string): string {
  const value = process.env[key];
  if (value === undefined || value === '') {
    if (fallback !== undefined) {
      return fallback;
    }
    throw new ConfigurationError(`Missing required configuration: ${key}`);
  }
  return value;
}

function readNumber(key: string, fallback?: number): number {
  const value = process.env[key];
  if (value === undefined || value === '') {
    if (fallback !== undefined) {
      return fallback;
    }
    throw new ConfigurationError(`Missing required configuration: ${key}`);
  }
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new ConfigurationError(`Invalid integer configuration: ${key}`);
  }
  return parsed;
}

function readEncryptionKey(key: string): Buffer {
  const encoded = readString(key, 'MDEyMzQ1Njc4OTAxMjM0NTY3ODkwMTIzNDU2Nzg5MDE=');
  const decoded = Buffer.from(encoded, 'base64');
  if (decoded.length !== 32) {
    throw new ConfigurationError(`${key} must decode to 32 bytes`);
  }
  return decoded;
}
