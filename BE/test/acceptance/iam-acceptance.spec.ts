import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Server } from 'node:http';
import { AppModule } from '../../src/app.module';
import { ErrorCode } from '../../src/common/http/error-code';
import { CLOCK } from '../../src/platform/clock/clock.interface';
import { configureApp } from '../../src/setup-app';
import { IAM_ACCEPTANCE_ROUTES, type IamPersona } from '../support/acceptance/iam-route-matrix';
import {
  callRoute,
  seedIamPersonas,
  type IamPersonaFixtures,
} from '../support/acceptance/persona-session';
import { authAgent } from '../support/auth/auth-request';
import { FakeClock } from '../support/fake-clock';
import {
  applyIdentityMigrations,
  resetIdentityState,
} from '../support/identity/reset-identity-state';

const acceptanceEnabled = process.env.ACCEPTANCE_TESTS === '1';
const describeAcceptance = acceptanceEnabled ? describe : describe.skip;

interface ErrorResponseBody {
  error: { code: string; message: string; requestId?: string };
}

describeAcceptance('TST-S1-07 IAM acceptance on MySQL test database', () => {
  let app: INestApplication;
  let httpServer: Server;
  let personas: IamPersonaFixtures;

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
  }, 120_000);

  beforeEach(async () => {
    await resetIdentityState();
    personas = await seedIamPersonas(app);
  });

  afterAll(async () => {
    await app.close();
  });

  for (const routeCase of IAM_ACCEPTANCE_ROUTES) {
    describe(`${routeCase.id} (${routeCase.permission})`, () => {
      it.each(['admin', 'librarian', 'reader'] as const)(
        'returns expected status for %s',
        async (persona: IamPersona) => {
          const payload =
            routeCase.id === 'create-user'
              ? {
                  email: `invited.${persona}.${Date.now()}@test.local`,
                  displayName: `Invited ${persona}`,
                }
              : routeCase.body;

          const response = await callRoute(httpServer, personas[persona], {
            method: routeCase.method,
            path: routeCase.path,
            body: payload,
          });

          expect(response.status).toBe(routeCase.expected[persona]);

          if (response.status === 403) {
            const body = response.body as ErrorResponseBody;
            expect(body.error.code).toBe(ErrorCode.FORBIDDEN);
          }
        },
      );
    });
  }

  it('allows admin to create a user and denies librarian on the same route', async () => {
    const adminResponse = await callRoute(httpServer, personas.admin, {
      method: 'post',
      path: '/api/v1/users',
      body: { email: 'new.acceptance@test.local', displayName: 'New Acceptance User' },
    });
    expect(adminResponse.status).toBe(201);

    const librarianResponse = await callRoute(httpServer, personas.librarian, {
      method: 'post',
      path: '/api/v1/users',
      body: { email: 'blocked.acceptance@test.local', displayName: 'Blocked Acceptance User' },
    });
    expect(librarianResponse.status).toBe(403);
  });

  it('does not leak passwords or session secrets in auth error responses', async () => {
    const secretPassword = 'SecretPass-acceptance-12';
    const response = await authAgent(httpServer)
      .login('reader.acceptance@test.local', secretPassword)
      .expect(401);

    const serialized = JSON.stringify(response.body);
    expect(serialized).not.toContain(secretPassword);
    expect(serialized).not.toMatch(/passwordHash|password_hash|token_hash|csrf_hash/i);
    expect(serialized).not.toMatch(/stack/i);

    const body = response.body as ErrorResponseBody;
    expect(body.error.requestId).toBeTruthy();
  });

  it('does not leak secrets in forbidden responses', async () => {
    const response = await callRoute(httpServer, personas.reader, {
      method: 'get',
      path: '/api/v1/users',
    });
    expect(response.status).toBe(403);

    const serialized = JSON.stringify(response.body);
    expect(serialized).not.toContain('ValidPass123!');
    expect(serialized).not.toMatch(/password/i);
    expect(serialized).not.toMatch(/csrf/i);
  });
});
