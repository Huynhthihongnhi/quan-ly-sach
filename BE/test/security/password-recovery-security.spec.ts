import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { createConnection, type RowDataPacket } from 'mysql2/promise';
import { Server } from 'node:http';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module';
import { FORGOT_PASSWORD_ACCEPTED_MESSAGE } from '../../src/modules/auth/password-recovery.service';
import { ChallengeRepository } from '../../src/modules/challenge/challenge.repository';
import { PayloadCipherService } from '../../src/modules/messaging/payload-cipher.service';
import { ACTIVATION_EMAIL_ACCEPTED_MESSAGE } from '../../src/modules/users/users.service';
import { BootstrapService } from '../../src/modules/bootstrap/bootstrap.service';
import { hashPassword } from '../../src/modules/identity/password-hasher';
import { UserRepository } from '../../src/modules/identity/user.repository';
import { CLOCK } from '../../src/platform/clock/clock.interface';
import { configureApp } from '../../src/setup-app';
import { authAgent } from '../support/auth/auth-request';
import { FakeClock } from '../support/fake-clock';
import {
  applyIdentityMigrations,
  resetIdentityState,
} from '../support/identity/reset-identity-state';
import { usersAgent } from '../support/users/users-request';

const securityEnabled = process.env.SECURITY_TESTS === '1';
const describeSecurity = securityEnabled ? describe : describe.skip;

interface AcceptedResponseBody {
  data: { message: string };
}

describeSecurity('TST-S2-02 forgot-password and activation invite security', () => {
  let app: INestApplication;
  let httpServer: Server;
  let dataSource: DataSource;
  let userRepository: UserRepository;
  let challengeRepository: ChallengeRepository;
  let payloadCipher: PayloadCipherService;
  let fakeClock: FakeClock;
  let adminCookie: string;
  let adminCsrf: string;

  beforeAll(async () => {
    process.env.FORGOT_RATE_LIMIT_MAX = '3';
    process.env.APP_PUBLIC_ORIGIN = 'http://127.0.0.1:5173';
    fakeClock = new FakeClock(new Date('2026-09-13T11:00:00.000Z'));
    await applyIdentityMigrations();

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(CLOCK)
      .useValue(fakeClock)
      .compile();

    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    httpServer = app.getHttpServer() as Server;
    dataSource = app.get(DataSource);
    userRepository = app.get(UserRepository);
    challengeRepository = app.get(ChallengeRepository);
    payloadCipher = app.get(PayloadCipherService);
  }, 120_000);

  beforeEach(async () => {
    fakeClock.set(new Date('2026-09-13T11:00:00.000Z'));
    await resetIdentityState();
    await seedAdminSession();
    await seedActiveUser('active.user@test.local');
    await seedBlockedUser('blocked.user@test.local');
    await seedInvitedUser('invited.user@test.local');
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns the same 202 body for active, unknown, and blocked emails', async () => {
    const active = await authAgent(httpServer).forgotPassword('active.user@test.local').expect(202);
    const unknown = await authAgent(httpServer)
      .forgotPassword('missing.user@test.local')
      .expect(202);
    const blocked = await authAgent(httpServer)
      .forgotPassword('blocked.user@test.local')
      .expect(202);

    const activeBody = active.body as AcceptedResponseBody;
    const unknownBody = unknown.body as AcceptedResponseBody;
    const blockedBody = blocked.body as AcceptedResponseBody;

    expect(activeBody.data.message).toBe(FORGOT_PASSWORD_ACCEPTED_MESSAGE);
    expect(unknownBody.data.message).toBe(FORGOT_PASSWORD_ACCEPTED_MESSAGE);
    expect(blockedBody.data.message).toBe(FORGOT_PASSWORD_ACCEPTED_MESSAGE);
  });

  it('rate limits forgot-password without creating extra outbox rows', async () => {
    await authAgent(httpServer).forgotPassword('active.user@test.local').expect(202);
    await authAgent(httpServer).forgotPassword('active.user@test.local').expect(202);
    await authAgent(httpServer).forgotPassword('active.user@test.local').expect(202);
    await authAgent(httpServer).forgotPassword('active.user@test.local').expect(429);

    const outboxCount = await countOutboxRows();
    expect(outboxCount).toBe(3);
  });

  it('uses configured public origin even when Host header is spoofed', async () => {
    await authAgent(httpServer)
      .forgotPassword('active.user@test.local', 'evil.example.test')
      .expect(202);

    const payload = await readLatestOutboxPayload();
    expect(payload.linkUrl).toContain('http://127.0.0.1:5173/reset-password');
    expect(payload.linkUrl).not.toContain('evil.example.test');
  });

  it('revokes prior reset challenge when issuing a new one for the same user', async () => {
    await authAgent(httpServer).forgotPassword('active.user@test.local').expect(202);
    fakeClock.advanceMs(1_000);
    await authAgent(httpServer).forgotPassword('active.user@test.local').expect(202);

    const connection = await openRawConnection();
    try {
      const [rows] = await connection.query<RowDataPacket[]>(
        `SELECT id, revoked_at
         FROM identity_challenges
         WHERE user_id = ?
         ORDER BY id ASC`,
        [await findUserId('active.user@test.local')],
      );
      expect(rows).toHaveLength(2);
      expect(rows[0]?.revoked_at).not.toBeNull();
      expect(rows[1]?.revoked_at).toBeNull();
    } finally {
      await connection.end();
    }

    expect(
      await challengeRepository.countActiveByUserAndPurpose(
        await findUserId('active.user@test.local'),
        'reset_password',
      ),
    ).toBe(1);
  });

  it('stores activation and reset challenges under separate purposes and link paths', async () => {
    await authAgent(httpServer).forgotPassword('active.user@test.local').expect(202);

    const invitedId = await findUserId('invited.user@test.local');
    await usersAgent(httpServer, adminCookie, adminCsrf).sendActivationEmail(invitedId).expect(202);

    const resetPayload = await readLatestOutboxPayloadForPurpose('reset_password');
    const activationPayload = await readLatestOutboxPayloadForPurpose('activate_account');

    expect(resetPayload.linkUrl).toContain('/reset-password');
    expect(activationPayload.linkUrl).toContain('/activate');
    expect(resetPayload.linkUrl).not.toContain('/activate');
    expect(activationPayload.linkUrl).not.toContain('/reset-password');
  });

  it('accepts activation email only for invited users', async () => {
    const invitedId = await findUserId('invited.user@test.local');
    const response = await usersAgent(httpServer, adminCookie, adminCsrf)
      .sendActivationEmail(invitedId)
      .expect(202);
    expect((response.body as AcceptedResponseBody).data.message).toBe(
      ACTIVATION_EMAIL_ACCEPTED_MESSAGE,
    );

    const activeId = await findUserId('active.user@test.local');
    await usersAgent(httpServer, adminCookie, adminCsrf).sendActivationEmail(activeId).expect(409);
  });

  async function seedAdminSession(): Promise<void> {
    const bootstrapService = app.get(BootstrapService);
    await bootstrapService.seedRegistryOnly();
    await bootstrapService.bootstrapAdmin({
      email: 'admin@test.local',
      password: 'AdminPass123!',
      displayName: 'Admin',
      requestId: 'password-recovery-seed',
    });

    const login = await authAgent(httpServer)
      .login('admin@test.local', 'AdminPass123!')
      .expect(200);
    adminCookie = login.headers['set-cookie']?.[0]?.split(';')[0] ?? '';
    adminCsrf = (login.body as { data: { csrfToken: string } }).data.csrfToken;
  }

  async function seedActiveUser(email: string): Promise<void> {
    const passwordHash = await hashPassword('ValidPass123!');
    await dataSource.transaction((manager) =>
      userRepository.createWithProfile(manager, {
        email,
        displayName: 'Active User',
        status: 'active',
        passwordHash,
      }),
    );
  }

  async function seedBlockedUser(email: string): Promise<void> {
    const passwordHash = await hashPassword('ValidPass123!');
    await dataSource.transaction((manager) =>
      userRepository.createWithProfile(manager, {
        email,
        displayName: 'Blocked User',
        status: 'blocked',
        passwordHash,
      }),
    );
  }

  async function seedInvitedUser(email: string): Promise<void> {
    await dataSource.transaction((manager) =>
      userRepository.createWithProfile(manager, {
        email,
        displayName: 'Invited User',
        status: 'invited',
      }),
    );
  }

  async function findUserId(email: string): Promise<string> {
    const user = await userRepository.findByEmail(email);
    if (!user) {
      throw new Error(`Missing user ${email}`);
    }
    return user.id;
  }

  async function countOutboxRows(): Promise<number> {
    const connection = await openRawConnection();
    try {
      const [rows] = await connection.query<RowDataPacket[]>(
        `SELECT COUNT(*) AS count FROM email_outbox`,
      );
      return Number(rows[0]?.count ?? 0);
    } finally {
      await connection.end();
    }
  }

  async function readLatestOutboxPayload(): Promise<{ linkUrl: string; token: string }> {
    const connection = await openRawConnection();
    try {
      const [rows] = await connection.query<RowDataPacket[]>(
        `SELECT encrypted_payload, encryption_key_id
         FROM email_outbox
         ORDER BY id DESC
         LIMIT 1`,
      );
      const row = rows[0];
      if (!row?.encrypted_payload || !row.encryption_key_id) {
        throw new Error('Missing outbox payload');
      }
      return payloadCipher.decrypt(row.encrypted_payload as Buffer, String(row.encryption_key_id));
    } finally {
      await connection.end();
    }
  }

  async function readLatestOutboxPayloadForPurpose(
    templateCode: string,
  ): Promise<{ linkUrl: string; token: string }> {
    const connection = await openRawConnection();
    try {
      const [rows] = await connection.query<RowDataPacket[]>(
        `SELECT encrypted_payload, encryption_key_id
         FROM email_outbox
         WHERE template_code = ?
         ORDER BY id DESC
         LIMIT 1`,
        [templateCode],
      );
      const row = rows[0];
      if (!row?.encrypted_payload || !row.encryption_key_id) {
        throw new Error(`Missing outbox payload for ${templateCode}`);
      }
      return payloadCipher.decrypt(row.encrypted_payload as Buffer, String(row.encryption_key_id));
    } finally {
      await connection.end();
    }
  }
});

async function openRawConnection() {
  return createConnection({
    host: process.env.DATABASE_HOST ?? '127.0.0.1',
    port: Number(process.env.DATABASE_PORT ?? 3306),
    user: process.env.DATABASE_MIGRATION_USERNAME ?? 'migration',
    password: process.env.DATABASE_MIGRATION_PASSWORD ?? 'local-migration-change-me',
    database: process.env.DATABASE_TEST_NAME ?? 'quan_ly_sach_test',
  });
}
