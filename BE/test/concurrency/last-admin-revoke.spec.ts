import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Server } from 'node:http';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module';
import { CLOCK } from '../../src/platform/clock/clock.interface';
import { AccessRepository } from '../../src/modules/access/access.repository';
import { BootstrapService } from '../../src/modules/bootstrap/bootstrap.service';
import { hashPassword } from '../../src/modules/identity/password-hasher';
import { UserRepository } from '../../src/modules/identity/user.repository';
import { configureApp } from '../../src/setup-app';
import { accessAgent } from '../support/access/access-request';
import { authAgent, extractSessionCookie } from '../support/auth/auth-request';
import { FakeClock } from '../support/fake-clock';
import {
  applyIdentityMigrations,
  resetIdentityState,
} from '../support/identity/reset-identity-state';

const concurrencyEnabled = process.env.CONCURRENCY_TESTS === '1';
const describeConcurrency = concurrencyEnabled ? describe : describe.skip;

interface LoginResponseBody {
  data: { csrfToken: string; user: { id: string } };
}

describeConcurrency('TST-S1-05 concurrent admin role revoke under IAM policy lock', () => {
  let app: INestApplication;
  let httpServer: Server;
  let dataSource: DataSource;
  let userRepository: UserRepository;
  let accessRepository: AccessRepository;
  let bootstrapService: BootstrapService;
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
      requestId: 'concurrency-setup',
    });

    const login = await authAgent(httpServer)
      .login('admin@test.local', 'AdminPass123!')
      .expect(200);
    adminUserId = (login.body as LoginResponseBody).data.user.id;
  });

  afterAll(async () => {
    await app.close();
  });

  async function createActiveAdmin(
    email: string,
    displayName: string,
    password: string,
  ): Promise<void> {
    const adminRole = await accessRepository.findRoleByCode('admin');
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

  it('preserves at least one active admin when two revoke requests run in parallel', async () => {
    await createActiveAdmin('admin.two@test.local', 'Admin Two', 'AdminTwoPass123!');

    const adminOneUser = await userRepository.findByEmail('admin@test.local');
    const adminTwoUser = await userRepository.findByEmail('admin.two@test.local');
    const readerRole = await accessRepository.findRoleByCode('reader');

    const adminOneLogin = await authAgent(httpServer)
      .login('admin@test.local', 'AdminPass123!')
      .expect(200);
    const adminOneBody = adminOneLogin.body as LoginResponseBody;
    const adminTwoLogin = await authAgent(httpServer)
      .login('admin.two@test.local', 'AdminTwoPass123!')
      .expect(200);
    const adminTwoBody = adminTwoLogin.body as LoginResponseBody;

    const adminOneAccess = accessAgent(
      httpServer,
      extractSessionCookie(adminOneLogin.headers['set-cookie']),
      adminOneBody.data.csrfToken,
    );
    const adminTwoAccess = accessAgent(
      httpServer,
      extractSessionCookie(adminTwoLogin.headers['set-cookie']),
      adminTwoBody.data.csrfToken,
    );

    const [first, second] = await Promise.all([
      adminOneAccess.replaceUserRoles(adminTwoUser!.id, {
        roleIds: [readerRole!.id],
        version: adminTwoUser!.version,
      }),
      adminTwoAccess.replaceUserRoles(adminOneUser!.id, {
        roleIds: [readerRole!.id],
        version: adminOneUser!.version,
      }),
    ]);

    expect(
      [first.status, second.status].filter((status) => status === 200).length,
    ).toBeLessThanOrEqual(1);
    expect(await countActiveAdmins()).toBeGreaterThanOrEqual(1);
  });
});
