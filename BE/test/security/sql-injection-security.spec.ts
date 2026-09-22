import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Server } from 'node:http';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module';
import { ErrorCode } from '../../src/common/http/error-code';
import { configureApp } from '../../src/setup-app';
import { seedIamPersonas, type IamPersonaFixtures } from '../support/acceptance/persona-session';
import { catalogAgent } from '../support/catalog/catalog-request';
import {
  applyIdentityMigrations,
  resetIdentityState,
} from '../support/identity/reset-identity-state';
import { purchasesAgent } from '../support/purchases/purchases-request';

const securityEnabled = process.env.SECURITY_TESTS === '1';
const describeSecurity = securityEnabled ? describe : describe.skip;

interface CatalogListBody {
  data: Array<{ id: string; title: string }>;
}

interface PurchaseBody {
  data: { id: string; title: string };
}

interface ErrorBody {
  error: { code: string };
}

// Verification suite: every raw-SQL call site is already parameterized, so this is expected green on first run.
describeSecurity('TST-S7-01 SQL injection adversarial input', () => {
  let app: INestApplication;
  let httpServer: Server;
  let dataSource: DataSource;
  let personas: IamPersonaFixtures;

  beforeAll(async () => {
    await applyIdentityMigrations();

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

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

  async function countUsers(): Promise<number> {
    const rows: Array<{ count: string }> = await dataSource.query(
      'SELECT COUNT(*) AS count FROM users',
    );
    return Number(rows[0]?.count ?? 0);
  }

  it('treats classic tautology and stacked-query payloads in public catalog search as literal text, not SQL', async () => {
    const usersBefore = await countUsers();

    // A real row must exist so 'OR 1=1'-style payloads have something to leak if the
    // query were ever unparameterized; against an empty table every assertion below
    // would pass vacuously regardless of whether the SQL is actually safe.
    const librarian = catalogAgent(
      httpServer,
      personas.librarian.cookie,
      personas.librarian.csrfToken,
    );
    const category = await librarian
      .createCategory({ code: `sqli-cat-${Date.now()}`, name: 'SQL Injection Fixture' })
      .expect(201);
    const categoryId = (category.body as { data: { id: string } }).data.id;
    const book = await librarian
      .createBook({
        categoryId,
        title: 'Genuine Searchable Title',
        publicationYear: 2024,
        authorIds: [],
        topicIds: [],
      })
      .expect(201);
    const bookBody = book.body as { data: { id: string; version: string } };
    await librarian
      .patchBookState(bookBody.data.id, { state: 'published', version: bookBody.data.version })
      .expect(200);

    const sanityCheck = await request(httpServer)
      .get(`/api/v1/books?title=${encodeURIComponent('Genuine Searchable')}`)
      .expect(200);
    expect(
      (sanityCheck.body as CatalogListBody).data.some((row) => row.id === bookBody.data.id),
    ).toBe(true);

    const payloads = [
      "' OR '1'='1",
      "'; DROP TABLE users; --",
      "x' UNION SELECT id, email, email, email, email, email, email, email, email, email, email FROM users -- ",
      '%' + "' OR 1=1 -- ",
    ];

    for (const payload of payloads) {
      const response = await request(httpServer)
        .get(`/api/v1/books?title=${encodeURIComponent(payload)}`)
        .expect(200);
      const body = response.body as CatalogListBody;
      expect(body.data).toEqual([]);
    }

    await request(httpServer)
      .get(`/api/v1/books?author=${encodeURIComponent("' OR '1'='1")}`)
      .expect(200);
    await request(httpServer)
      .get(`/api/v1/books?q=${encodeURIComponent("'; DROP TABLE books; --")}`)
      .expect(200);

    expect(await countUsers()).toBe(usersBefore);
  });

  it('stores an injection-shaped purchase request title as inert data and returns it unexecuted', async () => {
    const usersBefore = await countUsers();
    const reader = purchasesAgent(httpServer, personas.reader.cookie, personas.reader.csrfToken);
    const payloadTitle = "Requested'); DROP TABLE purchase_requests; --";

    const created = await reader
      .create(
        { title: payloadTitle, authorText: "O'Brien", publicationYear: 2024 },
        'sqli-purchase-key',
      )
      .expect(201);
    const body = created.body as PurchaseBody;
    expect(body.data.title).toBe(payloadTitle);

    const fetched = await reader.get(body.data.id).expect(200);
    expect((fetched.body as PurchaseBody).data.title).toBe(payloadTitle);
    expect(await countUsers()).toBe(usersBefore);
  });

  it('rejects a non-whitelisted admin queue state filter with validation, not a query error', async () => {
    const librarian = purchasesAgent(
      httpServer,
      personas.librarian.cookie,
      personas.librarian.csrfToken,
    );
    const response = await librarian
      .listAdmin(`?state=${encodeURIComponent("pending' OR '1'='1")}`)
      .expect(422);
    expect((response.body as ErrorBody).error.code).toBe(ErrorCode.VALIDATION_FAILED);
  });
});
