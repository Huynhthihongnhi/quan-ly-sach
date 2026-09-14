import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Server } from 'node:http';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module';
import { ErrorCode } from '../../src/common/http/error-code';
import { CLOCK } from '../../src/platform/clock/clock.interface';
import { AccessRepository } from '../../src/modules/access/access.repository';
import { BootstrapService } from '../../src/modules/bootstrap/bootstrap.service';
import { hashPassword } from '../../src/modules/identity/password-hasher';
import { UserRepository } from '../../src/modules/identity/user.repository';
import { configureApp } from '../../src/setup-app';
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

interface UserListResponseBody {
  data: Array<Record<string, unknown>>;
  meta: { page: number; pageSize: number; total: number };
}

interface UserResponseBody {
  data: Record<string, unknown>;
}

interface ErrorResponseBody {
  error: { code: string; message: string };
}

describeIntegration('TST-S1-03 user management on MySQL test database', () => {
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
      requestId: 'users-test-setup',
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

  async function createActiveReader(
    email: string,
    displayName: string,
    password: string,
  ): Promise<string> {
    const readerRole = await accessRepository.findRoleByCode('reader');
    expect(readerRole).not.toBeNull();

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
        roleId: readerRole!.id,
        assignedBy: adminUserId,
      }),
    );

    return user.id;
  }

  async function loginReader(
    email: string,
    password: string,
  ): Promise<{
    cookie: string;
    csrfToken: string;
  }> {
    const login = await authAgent(httpServer).login(email, password).expect(200);
    const body = login.body as LoginResponseBody;
    return {
      cookie: extractSessionCookie(login.headers['set-cookie']),
      csrfToken: body.data.csrfToken,
    };
  }

  it('denies readers from listing, creating, or blocking users', async () => {
    await createActiveReader('reader.a@test.local', 'Reader A', 'ReaderPass123!');
    const readerSession = await loginReader('reader.a@test.local', 'ReaderPass123!');
    const reader = usersAgent(httpServer, readerSession.cookie, readerSession.csrfToken);

    await reader.list().expect(403);
    await reader.create({ email: 'new@test.local', displayName: 'New User' }).expect(403);
    await reader.updateStatus('999', { status: 'blocked', version: '1' }).expect(403);
  });

  it('rejects privilege fields in create payload and returns invited users without credentials', async () => {
    const admin = usersAgent(httpServer, adminCookie, adminCsrf);

    const rejected = await admin
      .create({
        email: 'rejected@test.local',
        displayName: 'Rejected User',
        isAdmin: true,
        roleIds: ['admin'],
      })
      .expect(422);
    expect((rejected.body as ErrorResponseBody).error.code).toBe(ErrorCode.VALIDATION_FAILED);

    const response = await admin
      .create({
        email: 'Invited.User@test.local',
        displayName: 'Invited User',
      })
      .expect(201);

    const body = response.body as UserResponseBody;
    expect(body.data.email).toBe('invited.user@test.local');
    expect(body.data.status).toBe('invited');
    expect(body.data).not.toHaveProperty('passwordHash');
    expect(body.data).not.toHaveProperty('password');
    expect(JSON.stringify(body)).not.toMatch(/argon2|scrypt/i);
  });

  it('returns paginated user list without credential fields', async () => {
    const admin = usersAgent(httpServer, adminCookie, adminCsrf);
    await admin.create({ email: 'one@test.local', displayName: 'One' }).expect(201);
    await admin.create({ email: 'two@test.local', displayName: 'Two' }).expect(201);
    await admin.create({ email: 'three@test.local', displayName: 'Three' }).expect(201);

    const pageOne = await admin.list('?page=1&pageSize=2&sort=id').expect(200);
    const pageOneBody = pageOne.body as UserListResponseBody;
    expect(pageOneBody.data).toHaveLength(2);
    expect(pageOneBody.meta).toEqual({ page: 1, pageSize: 2, total: 4 });

    for (const item of pageOneBody.data) {
      expect(item).not.toHaveProperty('passwordHash');
      expect(item).not.toHaveProperty('password');
    }
  });

  it('revokes active sessions when a user is blocked', async () => {
    await createActiveReader('reader.b@test.local', 'Reader B', 'ReaderPass123!');
    const readerSession = await loginReader('reader.b@test.local', 'ReaderPass123!');
    const readerAuth = authAgent(httpServer);
    await readerAuth.me(readerSession.cookie).expect(200);

    const reader = await userRepository.findByEmail('reader.b@test.local');
    expect(reader).not.toBeNull();

    const admin = usersAgent(httpServer, adminCookie, adminCsrf);
    await admin
      .updateStatus(reader!.id, { status: 'blocked', version: reader!.version })
      .expect(200);

    await readerAuth.me(readerSession.cookie).expect(401);
  });

  it('rejects email changes via profile patch', async () => {
    await createActiveReader('reader.c@test.local', 'Reader C', 'ReaderPass123!');
    const user = await userRepository.findByEmail('reader.c@test.local');
    const profile = await userRepository.findProfileByUserId(user!.id);
    const admin = usersAgent(httpServer, adminCookie, adminCsrf);

    await admin
      .patchProfile(user!.id, {
        email: 'changed@test.local',
        version: profile!.version,
      })
      .expect(422);
  });

  it('rejects blocking or archiving the last active admin', async () => {
    const adminUser = await userRepository.findByEmail('admin@test.local');
    expect(adminUser).not.toBeNull();

    const admin = usersAgent(httpServer, adminCookie, adminCsrf);
    const blocked = await admin
      .updateStatus(adminUser!.id, { status: 'blocked', version: adminUser!.version })
      .expect(409);
    expect((blocked.body as ErrorResponseBody).error.code).toBe(ErrorCode.LAST_ADMIN_REQUIRED);

    const archived = await admin
      .updateStatus(adminUser!.id, { status: 'archived', version: adminUser!.version })
      .expect(409);
    expect((archived.body as ErrorResponseBody).error.code).toBe(ErrorCode.LAST_ADMIN_REQUIRED);
  });

  it('returns version conflict when status update uses stale version', async () => {
    const created = await usersAgent(httpServer, adminCookie, adminCsrf)
      .create({ email: 'stale@test.local', displayName: 'Stale User' })
      .expect(201);
    const createdBody = created.body as UserResponseBody;

    const admin = usersAgent(httpServer, adminCookie, adminCsrf);
    const response = await admin
      .updateStatus(String(createdBody.data.id), {
        status: 'blocked',
        version: '999',
      })
      .expect(409);

    expect((response.body as ErrorResponseBody).error.code).toBe(ErrorCode.VERSION_CONFLICT);
  });
});
