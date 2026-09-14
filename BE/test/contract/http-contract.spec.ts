import { INestApplication } from '@nestjs/common';
import { Server } from 'node:http';
import request from 'supertest';
import { ErrorCode } from '../../src/common/http/error-code';
import { createContractTestApp } from '../support/create-contract-test-app';

const LARGE_ID = '9223372036854775807';
const TEST_ACTOR_HEADER = 'x-contract-test-actor';
const CONTRACT_ORIGIN = 'http://127.0.0.1:3000';

function withMutationHeaders(httpServer: Server, method: 'post', path: string) {
  return request(httpServer)
    [method](path)
    .set('Origin', CONTRACT_ORIGIN)
    .set('X-Requested-With', 'library-web');
}

interface ErrorEnvelope {
  error: {
    code: string;
    message: string;
    requestId: string;
    fields: Array<{ field: string; code: string }>;
  };
}

interface CatalogResponse {
  data: Array<{ id: string; label: string; version: string }>;
  meta: { page: number; pageSize: number; total: number };
}

describe('TST-S0-05 HTTP contract', () => {
  let app: INestApplication;
  let httpServer: Server;

  beforeAll(async () => {
    app = await createContractTestApp();
    httpServer = app.getHttpServer() as Server;
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns public catalog with string IDs and pagination meta', async () => {
    const response = await request(httpServer)
      .get('/api/v1/demo/catalog?page=1&pageSize=1')
      .expect(200);

    const body = response.body as CatalogResponse;
    expect(typeof response.headers['x-request-id']).toBe('string');
    expect(body.data).toHaveLength(1);
    expect(body.meta).toEqual({ page: 1, pageSize: 1, total: 2 });
    expect(body.data[0]?.id).toBe('1');
  });

  it('preserves large BIGINT IDs as decimal strings in JSON', async () => {
    const response = await request(httpServer)
      .get('/api/v1/demo/catalog?page=2&pageSize=1')
      .expect(200);

    const body = response.body as CatalogResponse;
    expect(body.data[0]?.id).toBe(LARGE_ID);
    expect(typeof body.data[0]?.id).toBe('string');
  });

  it('rejects pageSize above 100', async () => {
    const response = await request(httpServer).get('/api/v1/demo/catalog?pageSize=101').expect(422);

    const body = response.body as ErrorEnvelope;
    expect(body.error.code).toBe(ErrorCode.VALIDATION_FAILED);
    expect(typeof body.error.requestId).toBe('string');
  });

  it('rejects unknown sort fields with 422', async () => {
    const response = await request(httpServer)
      .get('/api/v1/demo/catalog?sort=unknownField')
      .expect(422);

    const body = response.body as ErrorEnvelope;
    expect(body.error.code).toBe(ErrorCode.VALIDATION_FAILED);
  });

  it('rejects unknown body fields on mutation', async () => {
    const response = await withMutationHeaders(httpServer, 'post', '/api/v1/demo/items')
      .send({ label: 'Valid', requestedDays: 10, passwordHash: 'secret' })
      .expect(422);

    const body = response.body as ErrorEnvelope;
    expect(body.error.code).toBe(ErrorCode.VALIDATION_FAILED);
    expect(JSON.stringify(body)).not.toContain('secret');
  });

  it('rejects invalid field types with validation envelope', async () => {
    const response = await withMutationHeaders(httpServer, 'post', '/api/v1/demo/items')
      .send({ label: '', requestedDays: 'abc' })
      .expect(422);

    const body = response.body as ErrorEnvelope;
    expect(body.error.fields.length).toBeGreaterThan(0);
  });

  it('returns 401 for protected route without session', async () => {
    const response = await request(httpServer).get('/api/v1/demo/admin').expect(401);

    const body = response.body as ErrorEnvelope;
    expect(body.error.code).toBe(ErrorCode.AUTHENTICATION_REQUIRED);
    expect(body.error.message).toBe('Authentication is required.');
    expect(typeof body.error.requestId).toBe('string');
    expect(body.error.fields).toEqual([]);
  });

  it('returns 403 for protected route with session but missing permission', async () => {
    const response = await request(httpServer)
      .get('/api/v1/demo/admin')
      .set(TEST_ACTOR_HEADER, JSON.stringify({ userId: '2', permissionCodes: [] }))
      .expect(403);

    const body = response.body as ErrorEnvelope;
    expect(body.error.code).toBe(ErrorCode.FORBIDDEN);
  });

  it('allows protected route when required permission is present', async () => {
    const response = await request(httpServer)
      .get('/api/v1/demo/admin')
      .set(TEST_ACTOR_HEADER, JSON.stringify({ userId: '2', permissionCodes: ['demo.read'] }))
      .expect(200);

    const body = response.body as { data: { message: string } };
    expect(body.data.message).toBe('Protected admin panel sample.');
  });

  it('returns uniform 404 for missing protected resources', async () => {
    const response = await request(httpServer)
      .get('/api/v1/demo/resources/999')
      .set(TEST_ACTOR_HEADER, JSON.stringify({ userId: '2', permissionCodes: ['demo.read'] }))
      .expect(404);

    const body = response.body as ErrorEnvelope;
    expect(body.error.code).toBe(ErrorCode.NOT_FOUND);
  });

  it('returns uniform 404 for missing public resources', async () => {
    const response = await request(httpServer)
      .get('/api/v1/demo/resources/999/public-shadow')
      .expect(404);

    const body = response.body as ErrorEnvelope;
    expect(body.error.code).toBe(ErrorCode.NOT_FOUND);
  });

  it('keeps health probes outside the API prefix', async () => {
    await request(httpServer).get('/health/live').expect(200);
  });
});
