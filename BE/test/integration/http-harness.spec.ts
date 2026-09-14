import { INestApplication } from '@nestjs/common';
import { ErrorCode } from '../../src/common/http/error-code';
import { createContractTestApp } from '../support/create-contract-test-app';
import { HttpTestHarness } from '../support/http-harness';

describe('TST-S0-04 HTTP harness allow/deny checks', () => {
  let app: INestApplication;
  let harness: HttpTestHarness;

  beforeAll(async () => {
    process.env.CONTRACT_TEST_ACTOR = '1';
    app = await createContractTestApp();
    harness = HttpTestHarness.fromApp(app);
  });

  afterAll(async () => {
    await app.close();
  });

  it('allows anonymous access to public routes', async () => {
    await harness.getPublic('/api/v1/demo/catalog').expect(200);
  });

  it('denies protected routes without an actor', async () => {
    const response = await harness.getPublic('/api/v1/demo/admin').expect(401);
    const body = response.body as { error: { code: string } };
    expect(body.error.code).toBe(ErrorCode.AUTHENTICATION_REQUIRED);
  });

  it('denies protected routes when permissions are missing', async () => {
    const response = await harness.getProtected('/api/v1/demo/admin', [], 'reader-a').expect(403);
    const body = response.body as { error: { code: string } };
    expect(body.error.code).toBe(ErrorCode.FORBIDDEN);
  });

  it('allows protected routes when required permissions are present', async () => {
    await harness.getProtected('/api/v1/demo/admin', ['demo.read'], 'librarian-a').expect(200);
  });
});
