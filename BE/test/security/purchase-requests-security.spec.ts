import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Server } from 'node:http';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module';
import { ErrorCode } from '../../src/common/http/error-code';
import { AccessRepository } from '../../src/modules/access/access.repository';
import { hashPassword } from '../../src/modules/identity/password-hasher';
import { UserRepository } from '../../src/modules/identity/user.repository';
import { CLOCK } from '../../src/platform/clock/clock.interface';
import { configureApp } from '../../src/setup-app';
import { seedIamPersonas, type IamPersonaFixtures } from '../support/acceptance/persona-session';
import { authAgent, extractSessionCookie } from '../support/auth/auth-request';
import { FakeClock } from '../support/fake-clock';
import {
  applyIdentityMigrations,
  resetIdentityState,
} from '../support/identity/reset-identity-state';
import { purchasesAgent } from '../support/purchases/purchases-request';

const securityEnabled = process.env.SECURITY_TESTS === '1';
const describeSecurity = securityEnabled ? describe : describe.skip;

const TEST_PASSWORD = 'ValidPass123!';

interface PurchaseBody {
  data: {
    id: string;
    state: string;
    title: string;
    requesterId?: string;
    reviewReason?: string | null;
    reviewedAt?: string | null;
  };
}

interface PurchaseListBody {
  data: Array<{ id: string; requesterId: string; state: string }>;
  meta: { page: number; pageSize: number; total: number };
}

interface ErrorBody {
  error: { code: string };
}

describeSecurity('TST-S6-01 purchase request security on MySQL', () => {
  let app: INestApplication;
  let httpServer: Server;
  let dataSource: DataSource;
  let personas: IamPersonaFixtures;
  let readerB: { userId: string; cookie: string; csrfToken: string };

  beforeAll(async () => {
    const fakeClock = new FakeClock(new Date('2026-09-14T12:00:00.000Z'));
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
  }, 120_000);

  beforeEach(async () => {
    await resetIdentityState();
    personas = await seedIamPersonas(app);
    readerB = await seedSecondReader(app);
  });

  afterAll(async () => {
    await app.close();
  });

  function validPayload(overrides: Record<string, unknown> = {}) {
    return {
      title: 'Requested title not in catalog',
      authorText: 'Author Name',
      publicationYear: 2024,
      ...overrides,
    };
  }

  it('requires authentication for submit and accepts valid reader requests without catalog book', async () => {
    await request(httpServer)
      .post('/api/v1/purchase-requests')
      .set('Origin', 'http://127.0.0.1:3000')
      .set('X-Requested-With', 'library-web')
      .set('Idempotency-Key', 'guest-key')
      .send(validPayload())
      .expect(401);

    const agent = purchasesAgent(httpServer, personas.reader.cookie, personas.reader.csrfToken);
    const created = await agent.create(validPayload(), 'reader-key-1').expect(201);
    expect((created.body as PurchaseBody).data.state).toBe('pending');
  });

  it('validates required title, author, and publication year', async () => {
    const agent = purchasesAgent(httpServer, personas.reader.cookie, personas.reader.csrfToken);
    const missingTitle = await agent.create(validPayload({ title: '' }), 'val-title').expect(422);
    expect((missingTitle.body as ErrorBody).error.code).toBe(ErrorCode.VALIDATION_FAILED);

    const badYear = await agent
      .create(validPayload({ publicationYear: 999 }), 'val-year')
      .expect(422);
    expect((badYear.body as ErrorBody).error.code).toBe(ErrorCode.VALIDATION_FAILED);
  });

  it('enforces ownership on read and keeps requester from being overridden', async () => {
    const agentA = purchasesAgent(httpServer, personas.reader.cookie, personas.reader.csrfToken);
    const created = await agentA.create(validPayload(), 'own-read-key').expect(201);
    const requestId = (created.body as PurchaseBody).data.id;

    await agentA.get(requestId).expect(200);

    const agentB = purchasesAgent(httpServer, readerB.cookie, readerB.csrfToken);
    const forbidden = await agentB.get(requestId).expect(403);
    expect((forbidden.body as ErrorBody).error.code).toBe(ErrorCode.FORBIDDEN);

    const rows: Array<{ requester_id: string }> = await dataSource.query(
      `SELECT requester_id FROM purchase_requests WHERE id = ?`,
      [requestId],
    );
    expect(String(rows[0]?.requester_id)).toBe(personas.reader.userId);
  });

  it('replays idempotent submits and rejects conflicting payload reuse', async () => {
    const agent = purchasesAgent(httpServer, personas.reader.cookie, personas.reader.csrfToken);
    const first = await agent.create(validPayload(), 'idem-key').expect(201);
    const second = await agent.create(validPayload(), 'idem-key').expect(200);
    expect((second.body as PurchaseBody).data.id).toBe((first.body as PurchaseBody).data.id);

    const conflict = await agent
      .create(validPayload({ title: 'Different title' }), 'idem-key')
      .expect(409);
    expect((conflict.body as ErrorBody).error.code).toBe(ErrorCode.IDEMPOTENCY_CONFLICT);

    const countRows: Array<{ count: string }> = await dataSource.query(
      `SELECT COUNT(*) AS count FROM purchase_requests WHERE requester_id = ? AND request_key = ?`,
      [personas.reader.userId, 'idem-key'],
    );
    expect(Number(countRows[0]?.count ?? 0)).toBe(1);
  });

  it('restricts the admin queue list to purchases.read.any', async () => {
    const reader = purchasesAgent(httpServer, personas.reader.cookie, personas.reader.csrfToken);
    await reader.create(validPayload(), 'queue-guard-key').expect(201);

    const forbidden = await reader.listAdmin().expect(403);
    expect((forbidden.body as ErrorBody).error.code).toBe(ErrorCode.FORBIDDEN);

    const librarian = purchasesAgent(
      httpServer,
      personas.librarian.cookie,
      personas.librarian.csrfToken,
    );
    const queue = await librarian.listAdmin('?state=pending').expect(200);
    const body = queue.body as PurchaseListBody;
    expect(body.meta.total).toBeGreaterThanOrEqual(1);
    expect(body.data.every((row) => row.state === 'pending')).toBe(true);
    expect(body.data.some((row) => row.requesterId === personas.reader.userId)).toBe(true);
  });

  it('does not create payment or charge records when submitting a request', async () => {
    const agent = purchasesAgent(httpServer, personas.reader.cookie, personas.reader.csrfToken);
    await agent.create(validPayload({ note: 'No payment expected' }), 'no-pay-key').expect(201);

    const tables: Array<{ table_name: string }> = await dataSource.query(
      `SELECT TABLE_NAME AS table_name
       FROM information_schema.TABLES
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME IN ('payments', 'charges', 'payment_intents')`,
    );
    expect(tables).toHaveLength(0);
  });
});

async function seedSecondReader(app: INestApplication): Promise<{
  userId: string;
  cookie: string;
  csrfToken: string;
}> {
  const dataSource = app.get(DataSource);
  const userRepository = app.get(UserRepository);
  const accessRepository = app.get(AccessRepository);
  const admin = await userRepository.findByEmail('admin.acceptance@test.local');
  if (!admin) {
    throw new Error('Admin seed missing');
  }
  const role = await accessRepository.findRoleByCode('reader');
  if (!role) {
    throw new Error('Reader role missing');
  }
  const passwordHash = await hashPassword(TEST_PASSWORD);
  const { user } = await dataSource.transaction((manager) =>
    userRepository.createWithProfile(manager, {
      email: 'reader-b-purchase@test.local',
      displayName: 'Reader B Purchase',
      status: 'active',
      passwordHash,
    }),
  );
  await dataSource.transaction((manager) =>
    accessRepository.assignRole(manager, {
      userId: user.id,
      roleId: role.id,
      assignedBy: admin.id,
    }),
  );
  const login = await authAgent(app.getHttpServer() as Server)
    .login('reader-b-purchase@test.local', TEST_PASSWORD)
    .expect(200);
  const body = login.body as { data: { csrfToken: string } };
  return {
    userId: user.id,
    cookie: extractSessionCookie(login.headers['set-cookie']),
    csrfToken: body.data.csrfToken,
  };
}
