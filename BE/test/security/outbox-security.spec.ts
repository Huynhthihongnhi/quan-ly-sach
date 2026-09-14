import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { createConnection, type RowDataPacket } from 'mysql2/promise';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module';
import { RateLimitRepository } from '../../src/modules/auth/rate-limit.repository';
import { ChallengeRepository } from '../../src/modules/challenge/challenge.repository';
import { ChallengeOutboxOrchestrator } from '../../src/modules/messaging/challenge-outbox.orchestrator';
import { OutboxProcessorService } from '../../src/modules/messaging/outbox-processor.service';
import { OutboxRepository } from '../../src/modules/messaging/outbox.repository';
import { MAIL_ADAPTER } from '../../src/modules/messaging/messaging.types';
import { BootstrapService } from '../../src/modules/bootstrap/bootstrap.service';
import { hashPassword } from '../../src/modules/identity/password-hasher';
import { UserRepository } from '../../src/modules/identity/user.repository';
import { CLOCK } from '../../src/platform/clock/clock.interface';
import { FakeClock } from '../support/fake-clock';
import { FakeMailAdapter } from '../support/messaging/fake-mail.adapter';
import {
  applyIdentityMigrations,
  resetIdentityState,
} from '../support/identity/reset-identity-state';

const securityEnabled = process.env.SECURITY_TESTS === '1';
const describeSecurity = securityEnabled ? describe : describe.skip;

describeSecurity('TST-S2-01 challenge, outbox, and worker security', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let orchestrator: ChallengeOutboxOrchestrator;
  let outboxRepository: OutboxRepository;
  let challengeRepository: ChallengeRepository;
  let processor: OutboxProcessorService;
  let rateLimitRepository: RateLimitRepository;
  let fakeClock: FakeClock;
  let fakeMail: FakeMailAdapter;
  let userId: string;

  beforeAll(async () => {
    fakeClock = new FakeClock(new Date('2026-09-13T10:00:00.000Z'));
    fakeMail = new FakeMailAdapter();
    await applyIdentityMigrations();

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(CLOCK)
      .useValue(fakeClock)
      .overrideProvider(MAIL_ADAPTER)
      .useValue(fakeMail)
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();

    dataSource = app.get(DataSource);
    orchestrator = app.get(ChallengeOutboxOrchestrator);
    outboxRepository = app.get(OutboxRepository);
    challengeRepository = app.get(ChallengeRepository);
    processor = app.get(OutboxProcessorService);
    rateLimitRepository = app.get(RateLimitRepository);
  }, 120_000);

  beforeEach(async () => {
    fakeMail.reset();
    fakeClock.set(new Date('2026-09-13T10:00:00.000Z'));
    await resetIdentityState();
    userId = await seedActiveUser(app);
  });

  afterAll(async () => {
    await app.close();
  });

  it('stores challenge digest and encrypted payload without plaintext token in database', async () => {
    const expiresAt = new Date('2026-09-13T11:00:00.000Z');
    let rawToken = '';

    await dataSource.transaction(async (manager) => {
      const result = await orchestrator.enqueueChallengeEmail(manager, {
        userId,
        purpose: 'reset_password',
        email: 'reader@test.local',
        challengeExpiresAt: expiresAt,
        outboxExpiresAt: expiresAt,
        templateCode: 'reset_password',
        dedupeKey: 'reset:reader@test.local:1',
      });
      rawToken = result.rawToken;
    });

    const connection = await openRawConnection();
    try {
      const [challengeRows] = await connection.query<RowDataPacket[]>(
        `SELECT token_hash, email_snapshot FROM identity_challenges WHERE user_id = ?`,
        [userId],
      );
      expect(challengeRows).toHaveLength(1);
      expect(challengeRows[0]?.token_hash).toBeInstanceOf(Buffer);
      expect(String(challengeRows[0]?.email_snapshot)).toBe('reader@test.local');

      const [outboxRows] = await connection.query<RowDataPacket[]>(
        `SELECT encrypted_payload, encryption_key_id FROM email_outbox WHERE user_id = ?`,
        [userId],
      );
      expect(outboxRows).toHaveLength(1);
      expect(outboxRows[0]?.encrypted_payload).toBeInstanceOf(Buffer);
      expect(outboxRows[0]?.encryption_key_id).toBe('test-v1');

      const serialized = JSON.stringify({ challengeRows, outboxRows });
      expect(serialized).not.toContain(rawToken);
    } finally {
      await connection.end();
    }
  });

  it('rolls back challenge and outbox enqueue when the transaction fails', async () => {
    const expiresAt = new Date('2026-09-13T11:00:00.000Z');

    await expect(
      dataSource.transaction(async (manager) => {
        await orchestrator.enqueueChallengeEmail(manager, {
          userId,
          purpose: 'activate_account',
          email: 'reader@test.local',
          challengeExpiresAt: expiresAt,
          outboxExpiresAt: expiresAt,
          templateCode: 'activate_account',
          dedupeKey: 'activate:reader@test.local:1',
        });
        throw new Error('forced rollback');
      }),
    ).rejects.toThrow('forced rollback');

    expect(await challengeRepository.countAll()).toBe(0);
    expect(await outboxRepository.countByState('queued')).toBe(0);
  });

  it('shares rate-limit buckets across parallel consumers for the same email hash', async () => {
    const secret = process.env.RATE_LIMIT_HMAC_SECRET ?? 'test-rate-limit-secret';
    const subjectHash = rateLimitRepository.hashSubject(secret, 'reader@test.local');
    const windowStart = new Date('2026-09-13T10:00:00.000Z');
    const expiresAt = new Date('2026-09-13T10:15:00.000Z');
    const now = fakeClock.now();
    const maxRequests = 3;

    const results = await Promise.all(
      Array.from({ length: 4 }, () =>
        dataSource.transaction((manager) =>
          rateLimitRepository.consume(manager, {
            scope: 'challenge.request',
            subjectHash,
            windowStart,
            expiresAt,
            maxRequests,
            now,
          }),
        ),
      ),
    );

    const allowedCount = results.filter((result) => result.allowed).length;
    expect(allowedCount).toBe(3);
    expect(results.some((result) => !result.allowed)).toBe(true);
  });

  it('allows only one worker to deliver a queued message when claims run concurrently', async () => {
    await enqueueSampleOutbox();

    const [firstProcessed, secondProcessed] = await Promise.all([
      processor.processBatch('worker-a'),
      processor.processBatch('worker-b'),
    ]);

    expect(firstProcessed + secondProcessed).toBe(1);
    expect(await outboxRepository.countByState('sent')).toBe(1);
    expect(fakeMail.sent).toHaveLength(1);
  });

  it('reclaims expired leases and rejects stale finalize attempts', async () => {
    await enqueueSampleOutbox();
    const outboxId = await getLatestOutboxId();
    const now = fakeClock.now();

    await dataSource.transaction((manager) =>
      outboxRepository.claimBatch(manager, {
        workerId: 'worker-stale',
        batchSize: 1,
        now,
        leaseUntil: new Date(now.getTime() + 30_000),
      }),
    );

    const stuck = await outboxRepository.findById(outboxId);
    expect(stuck?.state).toBe('processing');

    fakeClock.set(new Date('2026-09-13T10:01:00.000Z'));
    await processor.runMaintenance();

    const reclaimed = await outboxRepository.findById(outboxId);
    expect(reclaimed?.state).toBe('queued');

    const finalized = await dataSource.transaction((manager) =>
      outboxRepository.finalizeSent(manager, {
        id: outboxId,
        workerId: 'worker-stale',
        now: fakeClock.now(),
        sentAt: fakeClock.now(),
      }),
    );
    expect(finalized).toBe(false);
  });

  it('retries failed delivery without creating a new challenge', async () => {
    fakeMail.queueFailures(2);
    await enqueueSampleOutbox();

    await processor.processBatch('worker-retry');
    fakeClock.advanceMs(1_100);
    await processor.processBatch('worker-retry');
    expect(await challengeRepository.countAll()).toBe(1);
    expect(fakeMail.failCount).toBe(2);

    fakeMail.queueFailures(0);
    fakeClock.advanceMs(3_000);
    await processor.processBatch('worker-retry');
    expect(await outboxRepository.countByState('sent')).toBe(1);
    expect(await challengeRepository.countAll()).toBe(1);
  });

  it('clears encrypted payload after successful send', async () => {
    await enqueueSampleOutbox();
    await processor.processBatch('worker-send');

    const row = await outboxRepository.findById(await getLatestOutboxId());
    expect(row?.state).toBe('sent');
    expect(row?.encryptedPayload).toBeNull();
    expect(row?.encryptionKeyId).toBeNull();
  });

  it('cancels expired outbox rows and clears ciphertext', async () => {
    await enqueueSampleOutbox();
    fakeClock.set(new Date('2026-09-13T12:00:00.000Z'));
    await processor.runMaintenance();

    const row = await outboxRepository.findById(await getLatestOutboxId());
    expect(row?.state).toBe('cancelled');
    expect(row?.encryptedPayload).toBeNull();
  });

  async function enqueueSampleOutbox(): Promise<string> {
    const expiresAt = new Date('2026-09-13T11:00:00.000Z');
    return dataSource.transaction(async (manager) => {
      const result = await orchestrator.enqueueChallengeEmail(manager, {
        userId,
        purpose: 'reset_password',
        email: 'reader@test.local',
        challengeExpiresAt: expiresAt,
        outboxExpiresAt: expiresAt,
        templateCode: 'reset_password',
        dedupeKey: `reset:${Date.now()}`,
      });
      return result.outboxId;
    });
  }

  async function getLatestOutboxId(): Promise<string> {
    const rows: unknown = await dataSource.query(
      `SELECT id FROM email_outbox ORDER BY id DESC LIMIT 1`,
    );
    if (!Array.isArray(rows) || rows.length === 0) {
      throw new Error('Outbox row missing');
    }
    const first: unknown = rows[0];
    if (typeof first !== 'object' || first === null || !('id' in first)) {
      throw new Error('Invalid outbox id row');
    }
    return String((first as { id: string | number }).id);
  }
});

async function seedActiveUser(app: INestApplication): Promise<string> {
  const bootstrapService = app.get(BootstrapService);
  const userRepository = app.get(UserRepository);
  const dataSource = app.get(DataSource);

  await bootstrapService.seedRegistryOnly();
  const passwordHash = await hashPassword('ValidPass123!');
  const { user } = await dataSource.transaction((manager) =>
    userRepository.createWithProfile(manager, {
      email: 'reader@test.local',
      displayName: 'Reader Test',
      status: 'active',
      passwordHash,
    }),
  );
  return user.id;
}

async function openRawConnection() {
  return createConnection({
    host: process.env.DATABASE_HOST ?? '127.0.0.1',
    port: Number(process.env.DATABASE_PORT ?? 3306),
    user: process.env.DATABASE_MIGRATION_USERNAME ?? 'migration',
    password: process.env.DATABASE_MIGRATION_PASSWORD ?? 'local-migration-change-me',
    database: process.env.DATABASE_TEST_NAME ?? 'quan_ly_sach_test',
  });
}
