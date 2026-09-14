import { createHash } from 'node:crypto';
import { createConnection } from 'mysql2/promise';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Server } from 'node:http';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module';
import { ErrorCode } from '../../src/common/http/error-code';
import { CatalogRepository } from '../../src/modules/catalog/catalog.repository';
import { CirculationInventoryService } from '../../src/modules/circulation/circulation-inventory.service';
import { CardsService } from '../../src/modules/cards/cards.service';
import { CLOCK } from '../../src/platform/clock/clock.interface';
import { configureApp } from '../../src/setup-app';
import { seedIamPersonas, type IamPersonaFixtures } from '../support/acceptance/persona-session';
import { cardsAgent } from '../support/cards/cards-request';
import { catalogAgent } from '../support/catalog/catalog-request';
import { FakeClock } from '../support/fake-clock';
import {
  applyIdentityMigrations,
  resetIdentityState,
} from '../support/identity/reset-identity-state';

const integrationEnabled = process.env.INTEGRATION_TESTS === '1';
const describeLoansSchema = integrationEnabled ? describe : describe.skip;

const REQUEST_HASH = createHash('sha256').update('loan-request').digest();

describeLoansSchema('TST-S5-01 loans schema and catalog inventory on MySQL', () => {
  let app: INestApplication;
  let httpServer: Server;
  let dataSource: DataSource;
  let catalogRepository: CatalogRepository;
  let circulationInventory: CirculationInventoryService;
  let cardsService: CardsService;
  let personas: IamPersonaFixtures;
  let bookId: string;
  let copyId: string;
  let cardId: string;
  let readerBUserId: string;
  let cardBId: string;

  beforeAll(async () => {
    process.env.CIRCULATION_ENABLED = '1';
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
    catalogRepository = app.get(CatalogRepository);
    circulationInventory = app.get(CirculationInventoryService);
    cardsService = app.get(CardsService);
  }, 120_000);

  beforeEach(async () => {
    await resetIdentityState();
    personas = await seedIamPersonas(app);

    const staff = cardsAgent(httpServer, personas.librarian.cookie, personas.librarian.csrfToken);
    const seeded = await dataSource.transaction(async (manager) => {
      const category = await catalogRepository.createCategory(manager, {
        code: 'loan-cat',
        name: 'Loan Category',
      });
      const book = await catalogRepository.createBook(manager, {
        categoryId: category.id,
        title: 'Loan Schema Book',
        createdBy: personas.admin.userId,
        state: 'published',
      });
      const copy = await catalogRepository.createCopy(manager, {
        bookId: book.id,
        barcode: 'COPY-LOAN-001',
        conditionState: 'serviceable',
      });
      return { bookId: book.id, copyId: copy.id };
    });
    bookId = seeded.bookId;
    copyId = seeded.copyId;

    const issued = await staff
      .issueCard({
        userId: personas.reader.userId,
        cardNumber: 'CARD-READER-A',
        expiresAt: '2027-09-14T12:00:00.000Z',
      })
      .expect(201);
    cardId = (issued.body as { data: { id: string } }).data.id;

    readerBUserId = personas.admin.userId;
    const cardB = await staff
      .issueCard({
        userId: readerBUserId,
        cardNumber: 'CARD-READER-B',
        expiresAt: '2027-09-14T12:00:00.000Z',
      })
      .expect(201);
    cardBId = (cardB.body as { data: { id: string } }).data.id;
  });

  afterAll(async () => {
    delete process.env.CIRCULATION_ENABLED;
    await app.close();
  });

  async function insertLoan(input: {
    userId: string;
    cardId: string;
    copyId: string;
    state: string;
    requestKey: string;
    requestedDays: number;
    checkedOutAt?: Date | null;
    dueAt?: Date | null;
    closedAt?: Date | null;
  }): Promise<string> {
    const reservedAt = new Date('2026-09-14T12:00:00.000Z');
    const reservationExpiresAt = new Date('2026-09-15T12:00:00.000Z');
    const result: { insertId: number } = await dataSource.query(
      `INSERT INTO loans
       (user_id, card_id, copy_id, request_key, request_hash, state, requested_days,
        reserved_at, reservation_expires_at, checked_out_at, due_at, closed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        input.userId,
        input.cardId,
        input.copyId,
        input.requestKey,
        REQUEST_HASH,
        input.state,
        input.requestedDays,
        reservedAt,
        reservationExpiresAt,
        input.checkedOutAt ?? null,
        input.dueAt ?? null,
        input.closedAt ?? null,
      ],
    );
    return String(result.insertId);
  }

  it('blocks two active reserved/borrowed loans on the same copy', async () => {
    await insertLoan({
      userId: personas.reader.userId,
      cardId,
      copyId,
      state: 'reserved',
      requestKey: 'req-a',
      requestedDays: 7,
    });

    await expect(
      insertLoan({
        userId: readerBUserId,
        cardId: cardBId,
        copyId,
        state: 'borrowed',
        requestKey: 'req-b',
        requestedDays: 5,
        checkedOutAt: new Date('2026-09-14T13:00:00.000Z'),
        dueAt: new Date('2026-09-19T13:00:00.000Z'),
      }),
    ).rejects.toThrow();
  });

  it('allows a new active loan after the previous loan is returned', async () => {
    await insertLoan({
      userId: personas.reader.userId,
      cardId,
      copyId,
      state: 'returned',
      requestKey: 'req-returned',
      requestedDays: 3,
      checkedOutAt: new Date('2026-09-10T12:00:00.000Z'),
      dueAt: new Date('2026-09-13T12:00:00.000Z'),
      closedAt: new Date('2026-09-13T11:00:00.000Z'),
    });

    const nextId = await insertLoan({
      userId: readerBUserId,
      cardId: cardBId,
      copyId,
      state: 'reserved',
      requestKey: 'req-next',
      requestedDays: 4,
    });
    expect(nextId).toBeDefined();
  });

  it('enforces composite card ownership at the database and in card service checks', async () => {
    await expect(
      insertLoan({
        userId: personas.reader.userId,
        cardId: cardBId,
        copyId,
        state: 'reserved',
        requestKey: 'wrong-owner',
        requestedDays: 5,
      }),
    ).rejects.toThrow();

    await expect(
      cardsService.assertCardUsableForUser({
        actingUserId: personas.reader.userId,
        cardNumber: 'CARD-READER-B',
      }),
    ).rejects.toMatchObject({ code: ErrorCode.FORBIDDEN });
  });

  it('enforces requested_days between 1 and 15 and due_at rules for borrowed loans', async () => {
    await expect(
      dataSource.query(
        `INSERT INTO loans
         (user_id, card_id, copy_id, request_key, request_hash, state, requested_days,
          reserved_at, reservation_expires_at)
         VALUES (?, ?, ?, ?, ?, 'reserved', ?, ?, ?)`,
        [
          personas.reader.userId,
          cardId,
          copyId,
          'bad-days-zero',
          REQUEST_HASH,
          0,
          new Date('2026-09-14T12:00:00.000Z'),
          new Date('2026-09-15T12:00:00.000Z'),
        ],
      ),
    ).rejects.toThrow();

    await expect(
      dataSource.query(
        `INSERT INTO loans
         (user_id, card_id, copy_id, request_key, request_hash, state, requested_days,
          reserved_at, reservation_expires_at)
         VALUES (?, ?, ?, ?, ?, 'reserved', ?, ?, ?)`,
        [
          personas.reader.userId,
          cardId,
          copyId,
          'bad-days-sixteen',
          REQUEST_HASH,
          16,
          new Date('2026-09-14T12:00:00.000Z'),
          new Date('2026-09-15T12:00:00.000Z'),
        ],
      ),
    ).rejects.toThrow();

    await insertLoan({
      userId: personas.reader.userId,
      cardId,
      copyId,
      state: 'reserved',
      requestKey: 'reserved-no-due',
      requestedDays: 10,
    });

    const reservedRows: Array<{ due_at: Date | null }> = await dataSource.query(
      'SELECT due_at FROM loans WHERE request_key = ?',
      ['reserved-no-due'],
    );
    expect(reservedRows[0]?.due_at).toBeNull();
  });

  it('prevents deleting copies that have loan history and exposes real availableCopies when circulation is enabled', async () => {
    await insertLoan({
      userId: personas.reader.userId,
      cardId,
      copyId,
      state: 'reserved',
      requestKey: 'hold-copy',
      requestedDays: 2,
    });

    expect(await circulationInventory.countAvailableCopiesForBook(bookId)).toBe(0);

    const detail = await request(httpServer).get(`/api/v1/books/${bookId}`).expect(200);
    const detailBody = detail.body as { data: { availableCopies: number } };
    expect(detailBody.data.availableCopies).toBe(0);

    await expect(
      dataSource.query('DELETE FROM book_copies WHERE id = ?', [copyId]),
    ).rejects.toThrow();
  });

  it('blocks copy condition changes while a loan is active', async () => {
    await insertLoan({
      userId: personas.reader.userId,
      cardId,
      copyId,
      state: 'borrowed',
      requestKey: 'active-borrow',
      requestedDays: 5,
      checkedOutAt: new Date('2026-09-14T12:00:00.000Z'),
      dueAt: new Date('2026-09-19T12:00:00.000Z'),
    });

    const librarian = catalogAgent(
      httpServer,
      personas.librarian.cookie,
      personas.librarian.csrfToken,
    );
    const copyRow = await catalogRepository.findCopyById(copyId);
    if (!copyRow) {
      throw new Error('Missing copy row');
    }

    await librarian
      .patchCopy(copyId, { version: copyRow.version, conditionState: 'repair' })
      .expect(409);
  });

  it('keeps loan history when a book is archived', async () => {
    const loanId = await insertLoan({
      userId: personas.reader.userId,
      cardId,
      copyId,
      state: 'returned',
      requestKey: 'archive-history',
      requestedDays: 4,
      checkedOutAt: new Date('2026-09-01T12:00:00.000Z'),
      dueAt: new Date('2026-09-05T12:00:00.000Z'),
      closedAt: new Date('2026-09-05T10:00:00.000Z'),
    });

    const librarian = catalogAgent(
      httpServer,
      personas.librarian.cookie,
      personas.librarian.csrfToken,
    );
    const bookRow = await catalogRepository.findBookById(bookId);
    if (!bookRow) {
      throw new Error('Missing book row');
    }
    await librarian
      .patchBookState(bookId, { state: 'archived', version: bookRow.version })
      .expect(200);

    const rows: Array<{ id: string }> = await dataSource.query(
      'SELECT id FROM loans WHERE id = ?',
      [loanId],
    );
    expect(rows).toHaveLength(1);
  });

  it('fails readiness when circulation is enabled but loans schema is missing', async () => {
    const migrationConnection = await createConnection({
      host: process.env.DATABASE_HOST ?? '127.0.0.1',
      port: Number(process.env.DATABASE_PORT ?? 3306),
      user: process.env.DATABASE_MIGRATION_USERNAME ?? 'migration',
      password: process.env.DATABASE_MIGRATION_PASSWORD ?? 'local-migration-change-me',
      database: process.env.DATABASE_TEST_NAME ?? 'quan_ly_sach_test',
      multipleStatements: true,
    });

    try {
      await migrationConnection.query('DROP TABLE IF EXISTS notification_deliveries');
      await migrationConnection.query('DROP TABLE IF EXISTS loan_events');
      await migrationConnection.query('DROP TABLE IF EXISTS loans');
    } finally {
      await migrationConnection.end();
    }

    await request(httpServer).get('/health/ready').expect(503);
    await applyIdentityMigrations();
  });
});
