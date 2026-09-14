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
import { auditAgent } from '../support/audit/audit-request';
import { authAgent, extractSessionCookie } from '../support/auth/auth-request';
import { FakeClock } from '../support/fake-clock';
import {
  applyIdentityMigrations,
  resetIdentityState,
} from '../support/identity/reset-identity-state';
import { usersAgent } from '../support/users/users-request';

const securityEnabled = process.env.SECURITY_TESTS === '1';
const describeSecurity = securityEnabled ? describe : describe.skip;

interface LoginResponseBody {
  data: { csrfToken: string; user: { id: string } };
}

interface ProfileResponseBody {
  data: {
    userId: string;
    displayName: string;
    phone: string | null;
    version: string;
  };
}

interface ErrorResponseBody {
  error: { code: string; message: string; fields?: Array<{ field: string; code: string }> };
}

interface AuditListResponseBody {
  data: Array<{ action: string; targetId: string | null; actorUserId: string | null }>;
}

describeSecurity('TST-S2-04 profile ownership, allowlist, and permission security', () => {
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
    const fakeClock = new FakeClock(new Date('2026-09-13T13:00:00.000Z'));
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
      requestId: 'profile-security-seed',
    });

    const login = await authAgent(httpServer)
      .login('admin@test.local', 'AdminPass123!')
      .expect(200);
    adminCookie = extractSessionCookie(login.headers['set-cookie']);
    adminCsrf = (login.body as LoginResponseBody).data.csrfToken;
    adminUserId = (login.body as LoginResponseBody).data.user.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('lets a reader update only their own profile through /me/profile', async () => {
    const readerA = await seedReaderSession('reader.a@test.local', 'Reader A');
    const readerBId = await createActiveUser('reader.b@test.local', 'Reader B', 'reader');
    const readerBProfileBefore = await userRepository.findProfileByUserId(readerBId);

    const ownProfile = await usersAgent(httpServer, readerA.cookie).getOwnProfile().expect(200);
    const ownBody = ownProfile.body as ProfileResponseBody;

    const updated = await usersAgent(httpServer, readerA.cookie, readerA.csrf)
      .patchOwnProfile({
        displayName: 'Reader A Updated',
        version: ownBody.data.version,
      })
      .expect(200);
    const updatedBody = updated.body as ProfileResponseBody;

    expect(updatedBody.data.displayName).toBe('Reader A Updated');
    expect(updatedBody.data).not.toHaveProperty('email');
    expect(updatedBody.data).not.toHaveProperty('status');
    expect(updatedBody.data).not.toHaveProperty('passwordHash');

    const readerBAfter = await userRepository.findProfileByUserId(readerBId);
    expect(readerBAfter?.displayName).toBe(readerBProfileBefore?.displayName);
  });

  it('blocks readers from reading or writing another user profile by id', async () => {
    const readerA = await seedReaderSession('reader.a@test.local', 'Reader A');
    const readerBId = await createActiveUser('reader.b@test.local', 'Reader B', 'reader');
    const readerBProfile = await userRepository.findProfileByUserId(readerBId);
    const users = usersAgent(httpServer, readerA.cookie, readerA.csrf);

    await users.getProfile(readerBId).expect(403);
    await users
      .patchProfile(readerBId, {
        displayName: 'Hijacked',
        version: readerBProfile!.version,
      })
      .expect(403);
  });

  it('rejects user_id tampering and forbidden profile fields', async () => {
    const readerA = await seedReaderSession('reader.a@test.local', 'Reader A');
    const readerBId = await createActiveUser('reader.b@test.local', 'Reader B', 'reader');
    const readerAProfile = await userRepository.findProfileByUserId(readerA.userId);
    const readerBProfileBefore = await userRepository.findProfileByUserId(readerBId);
    const users = usersAgent(httpServer, readerA.cookie, readerA.csrf);

    await users
      .patchOwnProfile({
        userId: readerBId,
        displayName: 'Tampered',
        version: readerAProfile!.version,
      })
      .expect(422);

    const forbiddenFields = ['email', 'role', 'password_hash', 'status'] as const;
    for (const field of forbiddenFields) {
      const response = await users
        .patchOwnProfile({
          [field]: 'forbidden-value',
          version: readerAProfile!.version,
        })
        .expect(422);
      expect((response.body as ErrorResponseBody).error.code).toBe(ErrorCode.VALIDATION_FAILED);
    }

    const readerBAfter = await userRepository.findProfileByUserId(readerBId);
    expect(readerBAfter?.displayName).toBe(readerBProfileBefore?.displayName);
  });

  it('validates displayName and phone length and stores HTML literally', async () => {
    const reader = await seedReaderSession('reader.validation@test.local', 'Reader Validation');
    const profile = await userRepository.findProfileByUserId(reader.userId);
    const users = usersAgent(httpServer, reader.cookie, reader.csrf);

    await users
      .patchOwnProfile({
        displayName: '',
        version: profile!.version,
      })
      .expect(422);

    await users
      .patchOwnProfile({
        displayName: 'x'.repeat(121),
        version: profile!.version,
      })
      .expect(422);

    await users
      .patchOwnProfile({
        phone: '1'.repeat(33),
        version: profile!.version,
      })
      .expect(422);

    const htmlName = '<script>alert(1)</script>';
    const updated = await users
      .patchOwnProfile({
        displayName: htmlName,
        version: profile!.version,
      })
      .expect(200);

    expect((updated.body as ProfileResponseBody).data.displayName).toBe(htmlName);
  });

  it('gates admin profile access on profiles.read and profiles.write with audit', async () => {
    const targetId = await createActiveUser('target@test.local', 'Target User', 'reader');
    const targetProfile = await userRepository.findProfileByUserId(targetId);
    const librarian = await seedReaderSession('librarian@test.local', 'Librarian', 'librarian');
    const admin = usersAgent(httpServer, adminCookie, adminCsrf);
    const librarianUsers = usersAgent(httpServer, librarian.cookie, librarian.csrf);

    await librarianUsers.getProfile(targetId).expect(403);
    await librarianUsers
      .patchProfile(targetId, {
        displayName: 'Blocked',
        version: targetProfile!.version,
      })
      .expect(403);

    const read = await admin.getProfile(targetId).expect(200);
    expect((read.body as ProfileResponseBody).data.userId).toBe(targetId);

    const patched = await admin
      .patchProfile(targetId, {
        displayName: 'Admin Updated',
        version: targetProfile!.version,
      })
      .expect(200);
    expect((patched.body as ProfileResponseBody).data.displayName).toBe('Admin Updated');

    const audit = await auditAgent(httpServer, adminCookie)
      .list('?action=profiles.update&page=1&pageSize=10')
      .expect(200);
    const auditBody = audit.body as AuditListResponseBody;
    expect(auditBody.data.some((event) => event.targetId === targetId)).toBe(true);
  });

  it('returns version conflict when profile update uses stale version', async () => {
    const reader = await seedReaderSession('reader.stale@test.local', 'Reader Stale');
    const profile = await userRepository.findProfileByUserId(reader.userId);
    const users = usersAgent(httpServer, reader.cookie, reader.csrf);

    const response = await users
      .patchOwnProfile({
        displayName: 'Stale Attempt',
        version: '999',
      })
      .expect(409);

    expect((response.body as ErrorResponseBody).error.code).toBe(ErrorCode.VERSION_CONFLICT);

    const unchanged = await userRepository.findProfileByUserId(reader.userId);
    expect(unchanged?.displayName).toBe(profile?.displayName);
    expect(unchanged?.version).toBe(profile?.version);
  });

  async function seedReaderSession(
    email: string,
    displayName: string,
    roleCode = 'reader',
  ): Promise<{ userId: string; cookie: string; csrf: string }> {
    const userId = await createActiveUser(email, displayName, roleCode);
    const login = await authAgent(httpServer).login(email, 'ReaderPass123!').expect(200);
    return {
      userId,
      cookie: extractSessionCookie(login.headers['set-cookie']),
      csrf: (login.body as LoginResponseBody).data.csrfToken,
    };
  }

  async function createActiveUser(
    email: string,
    displayName: string,
    roleCode: string,
  ): Promise<string> {
    const role = await accessRepository.findRoleByCode(roleCode);
    if (!role) {
      throw new Error(`Missing role ${roleCode}`);
    }

    const passwordHash = await hashPassword('ReaderPass123!');
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
        roleId: role.id,
        assignedBy: adminUserId,
      }),
    );

    return user.id;
  }
});
