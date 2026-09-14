import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Server } from 'node:http';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module';
import { ErrorCode } from '../../src/common/http/error-code';
import { CLOCK } from '../../src/platform/clock/clock.interface';
import { AccessRepository } from '../../src/modules/access/access.repository';
import { BootstrapService } from '../../src/modules/bootstrap/bootstrap.service';
import { hashPassword } from '../../src/modules/identity/password-hasher';
import { UserRepository } from '../../src/modules/identity/user.repository';
import { configureApp } from '../../src/setup-app';
import { accessAgent } from '../support/access/access-request';
import { auditAgent, auditMutationAgent } from '../support/audit/audit-request';
import { authAgent, extractSessionCookie } from '../support/auth/auth-request';
import { FakeClock } from '../support/fake-clock';
import {
  applyIdentityMigrations,
  resetIdentityState,
} from '../support/identity/reset-identity-state';
import { usersAgent } from '../support/users/users-request';

const integrationEnabled = process.env.INTEGRATION_TESTS === '1';
const describeIntegration = integrationEnabled ? describe : describe.skip;

interface LoginResponseBody {
  data: { csrfToken: string; user: { id: string } };
}

interface AuditListResponseBody {
  data: Array<{
    actorUserId: string | null;
    requestId: string;
    action: string;
    details: Record<string, unknown> | null;
  }>;
  meta: { page: number; pageSize: number; total: number };
}

interface ErrorResponseBody {
  error: { code: string; message: string };
}

describeIntegration('TST-S1-05 IAM bootstrap, last admin, and audit query', () => {
  let app: INestApplication;
  let httpServer: Server;
  let dataSource: DataSource;
  let userRepository: UserRepository;
  let accessRepository: AccessRepository;
  let bootstrapService: BootstrapService;
  let adminCookie: string;
  let adminCsrf: string;
  let adminUserId: string;

  beforeAll(async () => {
    const fakeClock = new FakeClock(new Date('2026-09-11T08:00:00.000Z'));
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
    accessRepository = app.get(AccessRepository);
    bootstrapService = app.get(BootstrapService);
  }, 120_000);

  beforeEach(async () => {
    await resetIdentityState();
    await bootstrapService.seedRegistryOnly();
    await bootstrapService.bootstrapAdmin({
      email: 'admin@test.local',
      password: 'AdminPass123!',
      displayName: 'Admin',
      requestId: 'iam-audit-setup',
    });

    const login = await authAgent(httpServer)
      .login('admin@test.local', 'AdminPass123!')
      .expect(200);
    const loginBody = login.body as LoginResponseBody;
    adminCookie = extractSessionCookie(login.headers['set-cookie']);
    adminCsrf = loginBody.data.csrfToken;
    adminUserId = loginBody.data.user.id;
  });

  afterAll(async () => {
    await app.close();
  });

  async function createActiveAdmin(
    email: string,
    displayName: string,
    password: string,
  ): Promise<string> {
    const adminRole = await accessRepository.findRoleByCode('admin');
    expect(adminRole).not.toBeNull();

    const passwordHash = await hashPassword(password);
    const { user } = await dataSource.transaction((manager) =>
      userRepository.createWithProfile(manager, {
        email,
        displayName,
        status: 'active',
        passwordHash,
      }),
    );

    await dataSource.transaction((manager) =>
      accessRepository.assignRole(manager, {
        userId: user.id,
        roleId: adminRole!.id,
        assignedBy: adminUserId,
      }),
    );

    return user.id;
  }

  async function loginAdmin(
    email: string,
    password: string,
  ): Promise<{ cookie: string; csrfToken: string; userId: string }> {
    const login = await authAgent(httpServer).login(email, password).expect(200);
    const body = login.body as LoginResponseBody;
    return {
      cookie: extractSessionCookie(login.headers['set-cookie']),
      csrfToken: body.data.csrfToken,
      userId: body.data.user.id,
    };
  }

  async function countActiveAdmins(): Promise<number> {
    const [row] = await dataSource.query<Array<{ count: string }>>(
      `SELECT COUNT(DISTINCT u.id) AS count
       FROM users u
       INNER JOIN user_roles ur ON ur.user_id = u.id
       INNER JOIN roles r ON r.id = ur.role_id AND r.code = 'admin'
       WHERE u.status = 'active'`,
    );
    return Number(row?.count ?? 0);
  }

  it('keeps bootstrap credentials unchanged on a second run and exposes no HTTP bootstrap route', async () => {
    const [userBefore] = await dataSource.query<Array<{ password_hash: string | null }>>(
      `SELECT password_hash FROM users WHERE email = ?`,
      ['admin@test.local'],
    );

    const second = await bootstrapService.bootstrapAdmin({
      email: 'admin@test.local',
      password: 'DifferentPass456!',
      displayName: 'Admin',
      requestId: 'iam-audit-second-bootstrap',
    });
    expect(second.created).toBe(false);

    const [userAfter] = await dataSource.query<Array<{ password_hash: string | null }>>(
      `SELECT password_hash FROM users WHERE email = ?`,
      ['admin@test.local'],
    );
    expect(userAfter?.password_hash).toBe(userBefore?.password_hash);

    const adminCount = await countActiveAdmins();
    expect(adminCount).toBe(1);

    await request(httpServer).post('/api/v1/bootstrap/admin').expect(404);
    await request(httpServer).post('/api/v1/admin/bootstrap').expect(404);
  });

  it('denies self-demotion or block of the last active admin', async () => {
    const adminAccess = accessAgent(httpServer, adminCookie, adminCsrf);
    const adminUsers = usersAgent(httpServer, adminCookie, adminCsrf);
    const adminUser = await userRepository.findByEmail('admin@test.local');
    const adminRole = await accessRepository.findRoleByCode('admin');

    const removeRole = await adminAccess
      .replaceUserRoles(adminUser!.id, {
        roleIds: [],
        version: adminUser!.version,
      })
      .expect(409);
    expect((removeRole.body as ErrorResponseBody).error.code).toBe(ErrorCode.LAST_ADMIN_REQUIRED);

    const blockAdmin = await adminUsers
      .updateStatus(adminUser!.id, { status: 'blocked', version: adminUser!.version })
      .expect(409);
    expect((blockAdmin.body as ErrorResponseBody).error.code).toBe(ErrorCode.LAST_ADMIN_REQUIRED);

    const staleRole = await adminAccess
      .replaceUserRoles(adminUser!.id, {
        roleIds: [adminRole!.id],
        version: '999',
      })
      .expect(409);
    expect((staleRole.body as ErrorResponseBody).error.code).toBe(ErrorCode.VERSION_CONFLICT);
  });

  it('keeps at least one active admin when two admins revoke each other concurrently', async () => {
    const secondAdminId = await createActiveAdmin(
      'admin.two@test.local',
      'Admin Two',
      'AdminTwoPass123!',
    );
    expect(await countActiveAdmins()).toBe(2);

    const adminOneUser = await userRepository.findByEmail('admin@test.local');
    const adminTwoUser = await userRepository.findByEmail('admin.two@test.local');
    const adminRole = await accessRepository.findRoleByCode('admin');
    const readerRole = await accessRepository.findRoleByCode('reader');

    const adminOneSession = await loginAdmin('admin@test.local', 'AdminPass123!');
    const adminTwoSession = await loginAdmin('admin.two@test.local', 'AdminTwoPass123!');

    const adminOneAccess = accessAgent(
      httpServer,
      adminOneSession.cookie,
      adminOneSession.csrfToken,
    );
    const adminTwoAccess = accessAgent(
      httpServer,
      adminTwoSession.cookie,
      adminTwoSession.csrfToken,
    );

    const [revokeTwo, revokeOne] = await Promise.all([
      adminOneAccess.replaceUserRoles(secondAdminId, {
        roleIds: [readerRole!.id],
        version: adminTwoUser!.version,
      }),
      adminTwoAccess.replaceUserRoles(adminOneUser!.id, {
        roleIds: [readerRole!.id],
        version: adminOneUser!.version,
      }),
    ]);

    const statuses = [revokeTwo.status, revokeOne.status];
    expect(statuses.filter((status) => status === 200).length).toBeLessThanOrEqual(1);
    expect(statuses.some((status) => status === 409 || status === 200)).toBe(true);

    const remainingAdmins = await countActiveAdmins();
    expect(remainingAdmins).toBeGreaterThanOrEqual(1);

    const adminUsers = await dataSource.query<Array<{ id: string }>>(
      `SELECT CAST(u.id AS CHAR) AS id
       FROM users u
       INNER JOIN user_roles ur ON ur.user_id = u.id
       INNER JOIN roles r ON r.id = ur.role_id AND r.code = 'admin'
       WHERE u.status = 'active'`,
    );
    expect(adminUsers.length).toBe(remainingAdmins);
    expect(adminUsers.some((row) => row.id === adminOneUser!.id || row.id === secondAdminId)).toBe(
      true,
    );

    expect(adminRole).not.toBeNull();
  });

  it('returns audit events with actor and requestId while masking sensitive details', async () => {
    await dataSource.query(
      `INSERT INTO audit_events
        (actor_user_id, action, target_type, target_id, outcome, request_id, details, created_at)
       VALUES (?, 'auth.login.test', 'user', ?, 'success', ?, ?, UTC_TIMESTAMP(6))`,
      [
        adminUserId,
        adminUserId,
        'audit-query-request-1',
        JSON.stringify({
          email: 'admin@test.local',
          password: 'must-not-leak',
          sessionId: 'session-secret',
          resetToken: 'reset-secret',
        }),
      ],
    );

    const audit = auditAgent(httpServer, adminCookie);
    const response = await audit.list('?page=1&pageSize=20&action=auth.login.test').expect(200);
    const body = response.body as AuditListResponseBody;

    expect(body.meta.total).toBeGreaterThanOrEqual(1);
    const event = body.data.find((item) => item.requestId === 'audit-query-request-1');
    expect(event).toBeDefined();
    expect(event?.actorUserId).toBe(adminUserId);
    expect(event?.details).toEqual({
      email: 'admin@test.local',
      password: '[REDACTED]',
      sessionId: '[REDACTED]',
      resetToken: '[REDACTED]',
    });

    const serialized = JSON.stringify(body.data);
    expect(serialized).not.toContain('must-not-leak');
    expect(serialized).not.toContain('session-secret');
    expect(serialized).not.toContain('reset-secret');
  });

  it('denies readers from audit query and exposes no audit mutation routes', async () => {
    const readerRole = await accessRepository.findRoleByCode('reader');
    const passwordHash = await hashPassword('ReaderPass123!');
    const { user } = await dataSource.transaction((manager) =>
      userRepository.createWithProfile(manager, {
        email: 'reader.audit@test.local',
        displayName: 'Reader Audit',
        status: 'active',
        passwordHash,
      }),
    );
    await dataSource.transaction((manager) =>
      accessRepository.assignRole(manager, {
        userId: user.id,
        roleId: readerRole!.id,
        assignedBy: adminUserId,
      }),
    );

    const login = await authAgent(httpServer)
      .login('reader.audit@test.local', 'ReaderPass123!')
      .expect(200);
    const readerCookie = extractSessionCookie(login.headers['set-cookie']);

    await auditAgent(httpServer, readerCookie).list().expect(403);

    const mutations = auditMutationAgent(httpServer, adminCookie, adminCsrf);
    await mutations.post().send({ action: 'fake' }).expect(404);
    await mutations.patch('1').send({ action: 'fake' }).expect(404);
    await mutations.delete('1').expect(404);
  });
});
