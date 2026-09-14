import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Server } from 'node:http';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module';
import { ErrorCode } from '../../src/common/http/error-code';
import { CLOCK } from '../../src/platform/clock/clock.interface';
import { AccessRepository } from '../../src/modules/access/access.repository';
import { AuthService } from '../../src/modules/auth/auth.service';
import { hashPassword } from '../../src/modules/identity/password-hasher';
import { UserRepository } from '../../src/modules/identity/user.repository';
import { configureApp } from '../../src/setup-app';
import { FakeClock } from '../support/fake-clock';
import { authAgent, extractSessionCookie } from '../support/auth/auth-request';
import {
  applyIdentityMigrations,
  resetIdentityState,
} from '../support/identity/reset-identity-state';

const integrationEnabled = process.env.INTEGRATION_TESTS === '1';
const describeIntegration = integrationEnabled ? describe : describe.skip;

const INVALID_CREDENTIALS_MESSAGE = 'Invalid email or password.';

interface LoginResponseBody {
  data: { csrfToken: string; user: { id: string; email: string; status: string } };
}

interface ErrorResponseBody {
  error: { code: string; message: string };
}

interface CsrfResponseBody {
  data: { csrfToken: string };
}

describeIntegration('TST-S1-02 auth session and CSRF on MySQL test database', () => {
  let app: INestApplication;
  let httpServer: Server;
  let fakeClock: FakeClock;
  let authService: AuthService;
  let userRepository: UserRepository;
  let accessRepository: AccessRepository;
  let dataSource: DataSource;

  beforeAll(async () => {
    process.env.LOGIN_RATE_LIMIT_MAX = '3';
    fakeClock = new FakeClock(new Date('2026-09-11T08:00:00.000Z'));

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
    authService = app.get(AuthService);
    userRepository = app.get(UserRepository);
    accessRepository = app.get(AccessRepository);
    dataSource = app.get(DataSource);
  }, 120_000);

  beforeEach(async () => {
    fakeClock.set(new Date('2026-09-11T08:00:00.000Z'));
    await resetIdentityState();
    await dataSource.transaction((manager) => accessRepository.seedRegistry(manager));
    await createUser('active@test.local', 'active', 'Active User', 'ValidPass123!');
    await createUser('blocked@test.local', 'blocked', 'Blocked User', 'ValidPass123!');
    await createUser('invited@test.local', 'invited', 'Invited User', 'ValidPass123!');
  });

  afterAll(async () => {
    await app.close();
  });

  async function createUser(
    email: string,
    status: 'active' | 'blocked' | 'invited',
    displayName: string,
    password: string,
  ): Promise<string> {
    const passwordHash = status === 'active' ? await hashPassword(password) : null;
    const { user } = await dataSource.transaction((manager) =>
      userRepository.createWithProfile(manager, {
        email,
        displayName,
        status,
        passwordHash,
      }),
    );
    if (status !== 'active') {
      await authService.setPasswordForUser(user.id, password);
    }
    return user.id;
  }

  it('creates a new session on valid login and rejects invalid, blocked, or invited accounts with the same message', async () => {
    const agent = authAgent(httpServer);

    const success = await agent.login('active@test.local', 'ValidPass123!').expect(200);
    const successBody = success.body as LoginResponseBody;
    expect(successBody.data.csrfToken).toEqual(expect.any(String));
    expect(extractSessionCookie(success.headers['set-cookie'])).toContain('library-session=');

    const wrongPassword = await agent.login('active@test.local', 'WrongPass123!').expect(401);
    expect((wrongPassword.body as ErrorResponseBody).error.message).toBe(
      INVALID_CREDENTIALS_MESSAGE,
    );

    const blocked = await agent.login('blocked@test.local', 'ValidPass123!').expect(401);
    expect((blocked.body as ErrorResponseBody).error.message).toBe(INVALID_CREDENTIALS_MESSAGE);

    const invited = await agent.login('invited@test.local', 'ValidPass123!').expect(401);
    expect((invited.body as ErrorResponseBody).error.message).toBe(INVALID_CREDENTIALS_MESSAGE);
  });

  it('revokes session on logout and rejects reuse of old cookie', async () => {
    const agent = authAgent(httpServer);
    const login = await agent.login('active@test.local', 'ValidPass123!').expect(200);
    const loginBody = login.body as LoginResponseBody;
    const cookie = extractSessionCookie(login.headers['set-cookie']);
    const csrfToken = loginBody.data.csrfToken;

    await agent.me(cookie).expect(200);
    await agent.logout(cookie, csrfToken).expect(204);
    await agent.me(cookie).expect(401);
  });

  it('rejects logout and other mutations without valid CSRF or origin', async () => {
    const agent = authAgent(httpServer);
    const login = await agent.login('active@test.local', 'ValidPass123!').expect(200);
    const loginBody = login.body as LoginResponseBody;
    const cookie = extractSessionCookie(login.headers['set-cookie']);

    await agent.logout(cookie, 'invalid-csrf').expect(403);

    await request(httpServer)
      .post('/api/v1/auth/logout')
      .set('Cookie', cookie)
      .set('X-CSRF-Token', loginBody.data.csrfToken)
      .expect(403);
  });

  it('reissues CSRF token after reload via GET /auth/csrf', async () => {
    const agent = authAgent(httpServer);
    const login = await agent.login('active@test.local', 'ValidPass123!').expect(200);
    const cookie = extractSessionCookie(login.headers['set-cookie']);

    const csrfResponse = await agent.csrf(cookie).expect(200);
    const csrfBody = csrfResponse.body as CsrfResponseBody;
    const loginBody = login.body as LoginResponseBody;
    expect(csrfBody.data.csrfToken).toBe(loginBody.data.csrfToken);
    expect(csrfResponse.headers['cache-control']).toContain('no-store');
  });

  it('expires idle sessions without extending expired sessions via last_seen updates', async () => {
    const agent = authAgent(httpServer);
    const login = await agent.login('active@test.local', 'ValidPass123!').expect(200);
    const cookie = extractSessionCookie(login.headers['set-cookie']);

    fakeClock.advanceMs(31 * 60 * 1000);
    await agent.me(cookie).expect(401);
  });

  it('rate limits repeated login attempts without revealing account existence', async () => {
    const agent = authAgent(httpServer);

    for (let attempt = 0; attempt < 3; attempt += 1) {
      await agent.login('unknown@test.local', 'WrongPass123!').expect(401);
    }

    const limited = await agent.login('unknown@test.local', 'WrongPass123!').expect(429);
    const limitedBody = limited.body as ErrorResponseBody;
    expect(limitedBody.error.message).toBe(INVALID_CREDENTIALS_MESSAGE);
    expect(limited.headers['retry-after']).toBeDefined();
    expect(limitedBody.error.code).toBe(ErrorCode.RATE_LIMITED);
  });
});
