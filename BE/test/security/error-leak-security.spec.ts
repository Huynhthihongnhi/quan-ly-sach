import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Server } from 'node:http';
import { AppModule } from '../../src/app.module';
import { ErrorCode } from '../../src/common/http/error-code';
import { AuditService } from '../../src/modules/audit/audit.service';
import { configureApp } from '../../src/setup-app';
import { seedIamPersonas } from '../support/acceptance/persona-session';
import { authAgent } from '../support/auth/auth-request';
import {
  applyIdentityMigrations,
  resetIdentityState,
} from '../support/identity/reset-identity-state';

const securityEnabled = process.env.SECURITY_TESTS === '1';
const describeSecurity = securityEnabled ? describe : describe.skip;

const FORBIDDEN_SUBSTRING = 'planted-secret-marker-do-not-leak';

interface ErrorBody {
  error: { code: string; message: string };
}

// Armed only for the one login call under test, so seedIamPersonas' own logins are unaffected.
const armed = { value: false };

// Verification suite: an unhandled exception mid-transaction must reach the client as a
// generic 500 with no internal detail, matching TST-S7-01 ("lỗi không lộ secret").
describeSecurity('TST-S7-01 unhandled-exception response does not leak internal detail', () => {
  let app: INestApplication;
  let httpServer: Server;

  beforeAll(async () => {
    await applyIdentityMigrations();

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(AuditService)
      .useValue({
        append: (_manager: unknown, input: { action: string }) => {
          if (armed.value && input.action === 'auth.login') {
            throw new Error(
              `QueryFailedError: Check constraint violated. session_token=${FORBIDDEN_SUBSTRING}`,
            );
          }
          return Promise.resolve();
        },
        listEvents: () => Promise.resolve({ data: [], meta: { page: 1, pageSize: 20, total: 0 } }),
      })
      .compile();

    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();

    httpServer = app.getHttpServer() as Server;
  }, 120_000);

  beforeEach(async () => {
    armed.value = false;
    await resetIdentityState();
    await seedIamPersonas(app);
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns a generic 500 body without the underlying error message', async () => {
    armed.value = true;
    const response = await authAgent(httpServer)
      .login('reader.acceptance@test.local', 'ValidPass123!')
      .expect(500);

    const body = response.body as ErrorBody;
    expect(body.error.code).toBe(ErrorCode.INTERNAL_ERROR);
    expect(body.error.message).toBe('An unexpected error occurred.');
    const rawBody = JSON.stringify(response.body);
    expect(rawBody).not.toContain(FORBIDDEN_SUBSTRING);
    expect(rawBody).not.toContain('QueryFailedError');
  });
});
