import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Server } from 'node:http';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module';
import { ErrorCode } from '../../src/common/http/error-code';
import { CLOCK } from '../../src/platform/clock/clock.interface';
import { configureApp } from '../../src/setup-app';
import { seedIamPersonas, type IamPersonaFixtures } from '../support/acceptance/persona-session';
import { FakeClock } from '../support/fake-clock';
import {
  applyIdentityMigrations,
  resetIdentityState,
} from '../support/identity/reset-identity-state';
import { purchasesAgent } from '../support/purchases/purchases-request';

const concurrencyEnabled = process.env.CONCURRENCY_TESTS === '1';
const describeConcurrency = concurrencyEnabled ? describe : describe.skip;

interface PurchaseBody {
  data: { id: string; state: string; version: string };
}

interface ErrorBody {
  error: { code: string };
}

describeConcurrency('TST-S6-02 purchase review concurrency', () => {
  let app: INestApplication;
  let httpServer: Server;
  let dataSource: DataSource;
  let personas: IamPersonaFixtures;

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
  });

  afterAll(async () => {
    await app.close();
  });

  function validPayload() {
    return {
      title: 'Concurrency purchase title',
      authorText: 'Author',
      publicationYear: 2024,
    };
  }

  async function createPendingRequest() {
    const reader = purchasesAgent(httpServer, personas.reader.cookie, personas.reader.csrfToken);
    const created = await reader.create(validPayload(), `pending-${Date.now()}`).expect(201);
    return (created.body as PurchaseBody).data;
  }

  it('forbids reviewers from approving their own requests', async () => {
    const librarian = purchasesAgent(
      httpServer,
      personas.librarian.cookie,
      personas.librarian.csrfToken,
    );
    const created = await librarian.create(validPayload(), 'self-review-key').expect(201);
    const requestId = (created.body as PurchaseBody).data.id;
    const version = (created.body as PurchaseBody).data.version;

    const forbidden = await librarian
      .review(requestId, { decision: 'approved', version })
      .expect(403);
    expect((forbidden.body as ErrorBody).error.code).toBe(ErrorCode.FORBIDDEN);
  });

  it('requires a reason when rejecting', async () => {
    const pending = await createPendingRequest();
    const reviewer = purchasesAgent(
      httpServer,
      personas.librarian.cookie,
      personas.librarian.csrfToken,
    );
    const validation = await reviewer
      .review(pending.id, { decision: 'rejected', version: pending.version })
      .expect(422);
    expect((validation.body as ErrorBody).error.code).toBe(ErrorCode.VALIDATION_FAILED);
  });

  it('allows only one concurrent review decision', async () => {
    const pending = await createPendingRequest();
    const librarian = purchasesAgent(
      httpServer,
      personas.librarian.cookie,
      personas.librarian.csrfToken,
    );
    const admin = purchasesAgent(httpServer, personas.admin.cookie, personas.admin.csrfToken);

    const [approveRes, rejectRes] = await Promise.all([
      librarian.review(pending.id, { decision: 'approved', version: pending.version }),
      admin.review(pending.id, {
        decision: 'rejected',
        version: pending.version,
        reason: 'Duplicate review attempt',
      }),
    ]);

    const statuses = [approveRes.status, rejectRes.status].sort();
    expect(statuses).toEqual([200, 409]);

    const stateRows: Array<{ state: string; version: string }> = await dataSource.query(
      `SELECT state, version FROM purchase_requests WHERE id = ?`,
      [pending.id],
    );
    expect(['approved', 'rejected']).toContain(stateRows[0]?.state);
    expect(Number(stateRows[0]?.version)).toBe(2);

    const eventRows: Array<{ count: string }> = await dataSource.query(
      `SELECT COUNT(*) AS count FROM purchase_request_events WHERE purchase_request_id = ? AND from_state = 'pending'`,
      [pending.id],
    );
    expect(Number(eventRows[0]?.count ?? 0)).toBe(1);

    const auditRows: Array<{ count: string }> = await dataSource.query(
      `SELECT COUNT(*) AS count FROM audit_events WHERE target_type = 'purchase_request' AND target_id = ? AND action = 'purchase_request.review'`,
      [pending.id],
    );
    expect(Number(auditRows[0]?.count ?? 0)).toBe(1);
  });

  it('rejects a second review with stale version or invalid transition', async () => {
    const pending = await createPendingRequest();
    const reviewer = purchasesAgent(
      httpServer,
      personas.librarian.cookie,
      personas.librarian.csrfToken,
    );

    const first = await reviewer
      .review(pending.id, { decision: 'approved', version: pending.version })
      .expect(200);
    const approved = (first.body as PurchaseBody).data;
    expect(approved.state).toBe('approved');

    const stale = await reviewer
      .review(pending.id, { decision: 'approved', version: pending.version })
      .expect(409);
    expect((stale.body as ErrorBody).error.code).toBe(ErrorCode.INVALID_TRANSITION);

    const again = await reviewer
      .review(pending.id, { decision: 'rejected', version: approved.version, reason: 'Too late' })
      .expect(409);
    expect((again.body as ErrorBody).error.code).toBe(ErrorCode.INVALID_TRANSITION);

    const auditRows: Array<{ count: string }> = await dataSource.query(
      `SELECT COUNT(*) AS count FROM audit_events WHERE target_type = 'purchase_request' AND target_id = ? AND action = 'purchase_request.review'`,
      [pending.id],
    );
    expect(Number(auditRows[0]?.count ?? 0)).toBe(1);
  });
});
