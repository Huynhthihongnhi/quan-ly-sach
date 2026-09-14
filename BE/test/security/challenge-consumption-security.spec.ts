import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { createConnection, type RowDataPacket } from 'mysql2/promise';
import { Server } from 'node:http';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module';
import { CHALLENGE_INVALID_MESSAGE } from '../../src/modules/auth/challenge-consumption.service';
import { ErrorCode } from '../../src/common/http/error-code';
import { AuditService } from '../../src/modules/audit/audit.service';
import { PayloadCipherService } from '../../src/modules/messaging/payload-cipher.service';
import { hashPassword, verifyPassword } from '../../src/modules/identity/password-hasher';
import { User } from '../../src/modules/identity/entities/user.entity';
import { UserRepository } from '../../src/modules/identity/user.repository';
import { CLOCK } from '../../src/platform/clock/clock.interface';
import { configureApp } from '../../src/setup-app';
import { authAgent, extractSessionCookie } from '../support/auth/auth-request';
import { FakeClock } from '../support/fake-clock';
import {
  applyIdentityMigrations,
  resetIdentityState,
} from '../support/identity/reset-identity-state';
import { usersAgent } from '../support/users/users-request';
import { BootstrapService } from '../../src/modules/bootstrap/bootstrap.service';

const securityEnabled = process.env.SECURITY_TESTS === '1';
const describeSecurity = securityEnabled ? describe : describe.skip;

interface ErrorResponseBody {
  error: { code: string; message: string };
}

describeSecurity('TST-S2-03 reset-password and activation completion security', () => {
  let app: INestApplication;
  let httpServer: Server;
  let dataSource: DataSource;
  let userRepository: UserRepository;
  let payloadCipher: PayloadCipherService;
  let auditService: AuditService;
  let fakeClock: FakeClock;
  let adminCookie: string;
  let adminCsrf: string;

  beforeAll(async () => {
    process.env.RESET_PASSWORD_TTL_MS = `${15 * 60 * 1000}`;
    process.env.ACTIVATION_TTL_MS = `${24 * 60 * 60 * 1000}`;
    process.env.APP_PUBLIC_ORIGIN = 'http://127.0.0.1:5173';
    fakeClock = new FakeClock(new Date('2026-09-13T12:00:00.000Z'));
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
    payloadCipher = app.get(PayloadCipherService);
    auditService = app.get(AuditService);
  }, 120_000);

  beforeEach(async () => {
    fakeClock.set(new Date('2026-09-13T12:00:00.000Z'));
    jest.restoreAllMocks();
    await resetIdentityState();
    await seedAdminSession();
    await seedActiveUser('active.user@test.local', 'ValidPass123!');
    await seedInvitedUser('invited.user@test.local');
  });

  afterAll(async () => {
    await app.close();
  });

  it('allows only one concurrent reset with the same token', async () => {
    const token = await issueResetToken('active.user@test.local');
    const newPassword = 'ResetPass1234!';

    const [first, second] = await Promise.all([
      authAgent(httpServer).resetPassword(token, newPassword),
      authAgent(httpServer).resetPassword(token, newPassword),
    ]);

    const statuses = [first.status, second.status].sort();
    expect(statuses).toEqual([204, 409]);

    const successCount = [first, second].filter((response) => response.status === 204).length;
    expect(successCount).toBe(1);

    const consumedRows = await countConsumedChallenges();
    expect(consumedRows).toBe(1);

    const login = await authAgent(httpServer).login('active.user@test.local', newPassword);
    expect(login.status).toBe(200);
  });

  it('rejects wrong purpose, expired, and already-used tokens without changing password', async () => {
    const activationToken = await issueActivationToken('invited.user@test.local');
    const beforeHash = await readPasswordHash('invited.user@test.local');

    const wrongPurpose = await authAgent(httpServer)
      .resetPassword(activationToken, 'InvitedPass123!')
      .expect(409);
    expect((wrongPurpose.body as ErrorResponseBody).error.code).toBe(ErrorCode.CHALLENGE_INVALID);
    expect((wrongPurpose.body as ErrorResponseBody).error.message).toBe(CHALLENGE_INVALID_MESSAGE);
    expect(await readPasswordHash('invited.user@test.local')).toBe(beforeHash);

    const resetToken = await issueResetToken('active.user@test.local');
    fakeClock.advanceMs(Number(process.env.RESET_PASSWORD_TTL_MS));
    await authAgent(httpServer).resetPassword(resetToken, 'ExpiredPass123!').expect(409);
    expect(await passwordStillMatches('active.user@test.local', 'ValidPass123!')).toBe(true);

    fakeClock.set(new Date('2026-09-13T12:00:00.000Z'));
    const freshToken = await issueResetToken('active.user@test.local');
    await authAgent(httpServer).resetPassword(freshToken, 'FirstReset123!').expect(204);
    await authAgent(httpServer).resetPassword(freshToken, 'SecondReset123!').expect(409);
    expect(await passwordStillMatches('active.user@test.local', 'FirstReset123!')).toBe(true);
    expect(await passwordStillMatches('active.user@test.local', 'SecondReset123!')).toBe(false);
  });

  it('invalidates old password and sessions after reset without auto-login', async () => {
    const login = await authAgent(httpServer)
      .login('active.user@test.local', 'ValidPass123!')
      .expect(200);
    const cookie = extractSessionCookie(login.headers['set-cookie']);

    const token = await issueResetToken('active.user@test.local');
    const reset = await authAgent(httpServer).resetPassword(token, 'NewSecurePass1!').expect(204);
    expect(reset.headers['set-cookie']).toBeUndefined();

    await authAgent(httpServer).login('active.user@test.local', 'ValidPass123!').expect(401);
    await authAgent(httpServer).me(cookie).expect(401);

    const newLogin = await authAgent(httpServer)
      .login('active.user@test.local', 'NewSecurePass1!')
      .expect(200);
    expect(newLogin.headers['set-cookie']).toBeDefined();
  });

  it('does not consume token when password fails policy validation', async () => {
    const token = await issueResetToken('active.user@test.local');

    const weak = await authAgent(httpServer).resetPassword(token, 'short').expect(422);
    expect((weak.body as ErrorResponseBody).error.code).toBe(ErrorCode.VALIDATION_FAILED);

    await authAgent(httpServer).resetPassword(token, 'ValidAfterWeak123!').expect(204);
    expect(await passwordStillMatches('active.user@test.local', 'ValidAfterWeak123!')).toBe(true);
  });

  it('rolls back password and challenge consumption when audit write fails', async () => {
    const token = await issueResetToken('active.user@test.local');
    const authVersionBefore = await readAuthVersion('active.user@test.local');

    const originalAppend = auditService.append.bind(auditService);
    const appendSpy = jest
      .spyOn(auditService, 'append')
      .mockImplementation(async (manager, input) => {
        if (input.action === 'auth.reset_password') {
          throw new Error('audit write failed');
        }
        return originalAppend(manager, input);
      });

    await authAgent(httpServer).resetPassword(token, 'RollbackPass123!').expect(500);
    appendSpy.mockRestore();

    expect(await passwordStillMatches('active.user@test.local', 'ValidPass123!')).toBe(true);
    expect(await readAuthVersion('active.user@test.local')).toBe(authVersionBefore);

    const connection = await openRawConnection();
    try {
      const [rows] = await connection.query<RowDataPacket[]>(
        `SELECT consumed_at FROM identity_challenges WHERE purpose = 'reset_password'`,
      );
      expect(rows.every((row) => row.consumed_at === null)).toBe(true);
    } finally {
      await connection.end();
    }

    await authAgent(httpServer).resetPassword(token, 'RollbackPass123!').expect(204);
  });

  it('activates invited users and bumps auth_version', async () => {
    const token = await issueActivationToken('invited.user@test.local');
    const response = await authAgent(httpServer).activate(token, 'ActivatedPass123!').expect(204);
    expect(response.headers['set-cookie']).toBeUndefined();

    const user = await userRepository.findByEmail('invited.user@test.local');
    expect(user?.status).toBe('active');
    expect(user?.emailVerifiedAt).not.toBeNull();
    expect(await passwordStillMatches('invited.user@test.local', 'ActivatedPass123!')).toBe(true);

    await authAgent(httpServer).login('invited.user@test.local', 'ActivatedPass123!').expect(200);
  });

  async function seedAdminSession(): Promise<void> {
    const bootstrapService = app.get(BootstrapService);
    await bootstrapService.seedRegistryOnly();
    await bootstrapService.bootstrapAdmin({
      email: 'admin@test.local',
      password: 'AdminPass123!',
      displayName: 'Admin',
      requestId: 'challenge-consumption-seed',
    });

    const login = await authAgent(httpServer)
      .login('admin@test.local', 'AdminPass123!')
      .expect(200);
    adminCookie = login.headers['set-cookie']?.[0]?.split(';')[0] ?? '';
    adminCsrf = (login.body as { data: { csrfToken: string } }).data.csrfToken;
  }

  async function seedActiveUser(email: string, password: string): Promise<void> {
    const passwordHash = await hashPassword(password);
    await dataSource.transaction((manager) =>
      userRepository.createWithProfile(manager, {
        email,
        displayName: 'Active User',
        status: 'active',
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

  async function issueResetToken(email: string): Promise<string> {
    await authAgent(httpServer).forgotPassword(email).expect(202);
    const payload = await readLatestOutboxPayloadForPurpose('reset_password');
    return payload.token;
  }

  async function issueActivationToken(email: string): Promise<string> {
    const userId = await findUserId(email);
    await usersAgent(httpServer, adminCookie, adminCsrf).sendActivationEmail(userId).expect(202);
    const payload = await readLatestOutboxPayloadForPurpose('activate_account');
    return payload.token;
  }

  async function findUserId(email: string): Promise<string> {
    const user = await userRepository.findByEmail(email);
    if (!user) {
      throw new Error(`Missing user ${email}`);
    }
    return user.id;
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

  async function readPasswordHash(email: string): Promise<string | null> {
    const user = await userRepository.findByEmail(email);
    if (!user) {
      throw new Error(`Missing user ${email}`);
    }
    const withHash = await dataSource
      .getRepository(User)
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('user.id = :id', { id: user.id })
      .getOne();
    return withHash?.passwordHash ?? null;
  }

  async function passwordStillMatches(email: string, password: string): Promise<boolean> {
    const storedHash = await readPasswordHash(email);
    if (!storedHash) {
      return false;
    }
    return verifyPassword(password, storedHash);
  }

  async function readAuthVersion(email: string): Promise<string> {
    const user = await userRepository.findByEmail(email);
    if (!user) {
      throw new Error(`Missing user ${email}`);
    }
    return user.authVersion;
  }

  async function countConsumedChallenges(): Promise<number> {
    const connection = await openRawConnection();
    try {
      const [rows] = await connection.query<RowDataPacket[]>(
        `SELECT COUNT(*) AS count FROM identity_challenges WHERE consumed_at IS NOT NULL`,
      );
      return Number(rows[0]?.count ?? 0);
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
