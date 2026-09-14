import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Server } from 'node:http';
import { AppModule } from '../../src/app.module';
import { ErrorCode } from '../../src/common/http/error-code';
import { PayloadCipherService } from '../../src/modules/messaging/payload-cipher.service';
import { UserRepository } from '../../src/modules/identity/user.repository';
import { CLOCK } from '../../src/platform/clock/clock.interface';
import { configureApp } from '../../src/setup-app';
import { readLatestOutboxToken } from '../support/acceptance/outbox-token';
import { seedIamPersonas, type IamPersonaFixtures } from '../support/acceptance/persona-session';
import { authAgent, extractSessionCookie } from '../support/auth/auth-request';
import { FakeClock } from '../support/fake-clock';
import {
  applyIdentityMigrations,
  resetIdentityState,
} from '../support/identity/reset-identity-state';
import { accessAgent } from '../support/access/access-request';
import { usersAgent } from '../support/users/users-request';

const acceptanceEnabled = process.env.ACCEPTANCE_TESTS === '1';
const describeAcceptance = acceptanceEnabled ? describe : describe.skip;

interface ProfileResponseBody {
  data: { userId: string; displayName: string; phone: string | null; version: string };
}

interface MeResponseBody {
  data: { userId: string; permissionCodes: string[] };
}

interface ErrorResponseBody {
  error: { code: string; message: string };
}

interface CreateUserResponseBody {
  data: { id: string; status: string };
}

describeAcceptance('TST-S2-06 account milestone acceptance on MySQL test database', () => {
  let app: INestApplication;
  let httpServer: Server;
  let personas: IamPersonaFixtures;
  let payloadCipher: PayloadCipherService;
  let userRepository: UserRepository;
  let fakeClock: FakeClock;

  beforeAll(async () => {
    process.env.RESET_PASSWORD_TTL_MS = `${15 * 60 * 1000}`;
    process.env.ACTIVATION_TTL_MS = `${24 * 60 * 60 * 1000}`;
    process.env.APP_PUBLIC_ORIGIN = 'http://127.0.0.1:5174/cms';
    fakeClock = new FakeClock(new Date('2026-09-13T14:00:00.000Z'));
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
    payloadCipher = app.get(PayloadCipherService);
    userRepository = app.get(UserRepository);
  }, 120_000);

  beforeEach(async () => {
    fakeClock.set(new Date('2026-09-13T14:00:00.000Z'));
    await resetIdentityState();
    personas = await seedIamPersonas(app);
  });

  afterAll(async () => {
    await app.close();
  });

  it('completes invite, activation, login, profile update, and logout', async () => {
    const admin = usersAgent(httpServer, personas.admin.cookie, personas.admin.csrfToken);
    const created = await admin
      .create({ email: 'invited.acceptance@test.local', displayName: 'Invited Acceptance User' })
      .expect(201);
    const createdBody = created.body as CreateUserResponseBody;
    expect(createdBody.data.status).toBe('invited');

    await admin.sendActivationEmail(createdBody.data.id).expect(202);
    const activationPayload = await readLatestOutboxToken(payloadCipher, 'activate_account');

    await authAgent(httpServer).activate(activationPayload.token, 'ActivatedPass123!').expect(204);

    const login = await authAgent(httpServer)
      .login('invited.acceptance@test.local', 'ActivatedPass123!')
      .expect(200);
    const cookie = extractSessionCookie(login.headers['set-cookie']);
    const csrf = (login.body as { data: { csrfToken: string } }).data.csrfToken;

    const profile = await usersAgent(httpServer, cookie, csrf).getOwnProfile().expect(200);
    const profileBody = profile.body as ProfileResponseBody;

    const updated = await usersAgent(httpServer, cookie, csrf)
      .patchOwnProfile({
        displayName: 'Activated Reader',
        phone: '0901234567',
        version: profileBody.data.version,
      })
      .expect(200);
    expect((updated.body as ProfileResponseBody).data.displayName).toBe('Activated Reader');

    await authAgent(httpServer).logout(cookie, csrf).expect(204);
    await authAgent(httpServer).me(cookie).expect(401);
  });

  it('resets password from mailbox token once and rejects reuse and expiry', async () => {
    await authAgent(httpServer).forgotPassword('reader.acceptance@test.local').expect(202);
    const resetPayload = await readLatestOutboxToken(payloadCipher, 'reset_password');

    await authAgent(httpServer).resetPassword(resetPayload.token, 'ResetAcceptance1!').expect(204);

    await authAgent(httpServer).login('reader.acceptance@test.local', 'ValidPass123!').expect(401);
    await authAgent(httpServer)
      .login('reader.acceptance@test.local', 'ResetAcceptance1!')
      .expect(200);

    const reused = await authAgent(httpServer)
      .resetPassword(resetPayload.token, 'AnotherReset123!')
      .expect(409);
    expect((reused.body as ErrorResponseBody).error.code).toBe(ErrorCode.CHALLENGE_INVALID);

    await authAgent(httpServer).forgotPassword('reader.acceptance@test.local').expect(202);
    const freshPayload = await readLatestOutboxToken(payloadCipher, 'reset_password');
    fakeClock.advanceMs(Number(process.env.RESET_PASSWORD_TTL_MS));

    const expired = await authAgent(httpServer)
      .resetPassword(freshPayload.token, 'ExpiredReset123!')
      .expect(409);
    expect((expired.body as ErrorResponseBody).error.code).toBe(ErrorCode.CHALLENGE_INVALID);
  });

  it('blocks an active session when the user is blocked', async () => {
    const reader = personas.reader;
    await authAgent(httpServer).me(reader.cookie).expect(200);

    const readerUser = await userRepository.findByEmail('reader.acceptance@test.local');
    expect(readerUser).not.toBeNull();

    await usersAgent(httpServer, personas.admin.cookie, personas.admin.csrfToken)
      .updateStatus(readerUser!.id, { status: 'blocked', version: readerUser!.version })
      .expect(200);

    await authAgent(httpServer).me(reader.cookie).expect(401);
  });

  it('applies role changes to an open session on the next request', async () => {
    const reader = personas.reader;
    const meBefore = await authAgent(httpServer).me(reader.cookie).expect(200);
    expect((meBefore.body as MeResponseBody).data.permissionCodes.length).toBeGreaterThan(0);

    const adminAccess = accessAgent(httpServer, personas.admin.cookie, personas.admin.csrfToken);
    await adminAccess.replaceUserRoles(reader.userId, { roleIds: [], version: '1' }).expect(200);

    const meAfter = await authAgent(httpServer).me(reader.cookie).expect(200);
    expect((meAfter.body as MeResponseBody).data.permissionCodes).toEqual([]);
  });
});
