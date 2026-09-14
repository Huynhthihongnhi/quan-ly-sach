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
  data: { csrfToken: string; user: { id: string; permissionCodes?: string[] } };
}

interface RoleResponseBody {
  data: Record<string, unknown>;
}

interface ErrorResponseBody {
  error: { code: string; message: string };
}

describeIntegration('TST-S1-04 roles and permissions on MySQL test database', () => {
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
      requestId: 'roles-test-setup',
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

  async function createActiveUser(
    email: string,
    displayName: string,
    password: string,
    roleCode: string,
  ): Promise<string> {
    const role = await accessRepository.findRoleByCode(roleCode);
    expect(role).not.toBeNull();

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
        roleId: role!.id,
        assignedBy: adminUserId,
      }),
    );

    return user.id;
  }

  it('denies readers from role management routes', async () => {
    await createActiveUser('reader.a@test.local', 'Reader A', 'ReaderPass123!', 'reader');
    const login = await authAgent(httpServer)
      .login('reader.a@test.local', 'ReaderPass123!')
      .expect(200);
    const loginBody = login.body as LoginResponseBody;
    const reader = accessAgent(
      httpServer,
      extractSessionCookie(login.headers['set-cookie']),
      loginBody.data.csrfToken,
    );

    await reader.listRoles().expect(403);
    await reader.replaceUserRoles(adminUserId, { roleIds: [], version: '1' }).expect(403);
  });

  it('lists roles and permissions for admin and blocks system role mutation', async () => {
    const admin = accessAgent(httpServer, adminCookie, adminCsrf);

    const roles = await admin.listRoles('?page=1&pageSize=10').expect(200);
    const rolesBody = roles.body as { data: Array<{ code: string }> };
    expect(rolesBody.data.some((role) => role.code === 'admin')).toBe(true);

    const permissions = await admin.listPermissions('?page=1&pageSize=5').expect(200);
    const permissionsBody = permissions.body as { data: Array<{ code: string }> };
    expect(permissionsBody.data.length).toBeGreaterThan(0);

    const adminRole = await accessRepository.findRoleByCode('admin');
    await admin
      .updateRole(adminRole!.id, { name: 'Changed Admin', version: adminRole!.version })
      .expect(403);
  });

  it('creates and deletes a custom role using If-Match', async () => {
    const admin = accessAgent(httpServer, adminCookie, adminCsrf);
    const created = await admin
      .createRole({ code: 'custom.reviewer', name: 'Custom Reviewer' })
      .expect(201);
    const createdBody = created.body as RoleResponseBody;

    await admin
      .deleteRole(String(createdBody.data.id), String(createdBody.data.version))
      .expect(204);
  });

  it('rejects unknown permissions and stale role versions', async () => {
    const admin = accessAgent(httpServer, adminCookie, adminCsrf);
    const created = await admin.createRole({ code: 'custom.ops', name: 'Custom Ops' }).expect(201);
    const createdBody = created.body as RoleResponseBody;
    const roleId = String(createdBody.data.id);

    const unknownPermission = await admin
      .replaceRolePermissions(roleId, {
        permissionCodes: ['not.registered.permission'],
        version: createdBody.data.version,
      })
      .expect(422);
    expect((unknownPermission.body as ErrorResponseBody).error.code).toBe(
      ErrorCode.VALIDATION_FAILED,
    );

    const stale = await admin
      .replaceRolePermissions(roleId, {
        permissionCodes: ['demo.read'],
        version: '999',
      })
      .expect(409);
    expect((stale.body as ErrorResponseBody).error.code).toBe(ErrorCode.VERSION_CONFLICT);
  });

  it('applies removed roles on the next request and unions permissions across roles', async () => {
    const admin = accessAgent(httpServer, adminCookie, adminCsrf);
    const created = await admin
      .createRole({ code: 'custom.demo', name: 'Custom Demo Reader' })
      .expect(201);
    const customRole = (created.body as RoleResponseBody).data;

    await admin
      .replaceRolePermissions(String(customRole.id), {
        permissionCodes: ['demo.read'],
        version: customRole.version,
      })
      .expect(200);

    const userId = await createActiveUser(
      'multi.role@test.local',
      'Multi Role',
      'MultiPass123!',
      'reader',
    );
    const user = await userRepository.findByEmail('multi.role@test.local');
    const readerRole = await accessRepository.findRoleByCode('reader');

    await admin
      .replaceUserRoles(userId, {
        roleIds: [readerRole!.id, String(customRole.id)],
        version: user!.version,
      })
      .expect(200);

    const login = await authAgent(httpServer)
      .login('multi.role@test.local', 'MultiPass123!')
      .expect(200);
    const cookie = extractSessionCookie(login.headers['set-cookie']);
    const me = await authAgent(httpServer).me(cookie).expect(200);
    const meBody = me.body as { data: { permissionCodes: string[] } };
    expect(meBody.data.permissionCodes).toEqual(
      expect.arrayContaining(['demo.read', 'digital.download.own']),
    );

    await request(httpServer).get('/api/v1/demo/admin').set('Cookie', cookie).expect(200);

    const updatedUser = await userRepository.findById(userId);
    await admin
      .replaceUserRoles(userId, {
        roleIds: [readerRole!.id],
        version: updatedUser!.version,
      })
      .expect(200);

    await request(httpServer).get('/api/v1/demo/admin').set('Cookie', cookie).expect(403);
  });

  it('blocks removing the last admin role and stale user version updates', async () => {
    const admin = accessAgent(httpServer, adminCookie, adminCsrf);
    const adminUser = await userRepository.findByEmail('admin@test.local');
    const adminRole = await accessRepository.findRoleByCode('admin');

    const removeAdmin = await admin
      .replaceUserRoles(adminUser!.id, {
        roleIds: [],
        version: adminUser!.version,
      })
      .expect(409);
    expect((removeAdmin.body as ErrorResponseBody).error.code).toBe(ErrorCode.LAST_ADMIN_REQUIRED);

    const stale = await admin
      .replaceUserRoles(adminUser!.id, {
        roleIds: [adminRole!.id],
        version: '999',
      })
      .expect(409);
    expect((stale.body as ErrorResponseBody).error.code).toBe(ErrorCode.VERSION_CONFLICT);
  });

  it('prevents readers from accessing another user profile by id', async () => {
    await createActiveUser('reader.a@test.local', 'Reader A', 'ReaderPass123!', 'reader');
    const readerBId = await createActiveUser(
      'reader.b@test.local',
      'Reader B',
      'ReaderPass123!',
      'reader',
    );

    const login = await authAgent(httpServer)
      .login('reader.a@test.local', 'ReaderPass123!')
      .expect(200);
    const cookie = extractSessionCookie(login.headers['set-cookie']);
    const users = usersAgent(httpServer, cookie);

    await users.getProfile(readerBId).expect(403);
  });
});
