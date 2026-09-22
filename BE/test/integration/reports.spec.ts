import { createHash } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Server } from 'node:http';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module';
import { ErrorCode } from '../../src/common/http/error-code';
import { CatalogRepository } from '../../src/modules/catalog/catalog.repository';
import { CopyConditionState } from '../../src/modules/catalog/entities/book-copy.entity';
import { CLOCK } from '../../src/platform/clock/clock.interface';
import { configureApp } from '../../src/setup-app';
import { seedIamPersonas, type IamPersonaFixtures } from '../support/acceptance/persona-session';
import { cardsAgent } from '../support/cards/cards-request';
import { FakeClock } from '../support/fake-clock';
import {
  applyIdentityMigrations,
  resetIdentityState,
} from '../support/identity/reset-identity-state';
import { purchasesAgent } from '../support/purchases/purchases-request';
import { reportsAgent } from '../support/reports/reports-request';

const integrationEnabled = process.env.INTEGRATION_TESTS === '1';
const describeIntegration = integrationEnabled ? describe : describe.skip;

const REQUEST_HASH = createHash('sha256').update('reports-loan').digest();

interface ErrorBody {
  error: { code: string };
}

interface CirculationReportBody {
  data: {
    range: { from: string; to: string; timezone: string };
    period: { checkouts: number; returns: number; lost: number };
    asOf: { generatedAt: string; currentlyBorrowed: number; currentlyOverdue: number };
  };
}

interface InventoryReportBody {
  data: {
    asOf: string;
    titles: number;
    physicalCopies: number;
    available: number;
    reservedActive: number;
    borrowed: number;
    repair: number;
    lost: number;
    retired: number;
  };
}

interface PurchasesReportBody {
  data: {
    range: { from: string; to: string };
    submitted: number;
    approved: number;
    rejected: number;
    pendingNow: number;
  };
}

interface PurchaseBody {
  data: { id: string; version: string };
}

describeIntegration('TST-S6-04 reports integration on MySQL', () => {
  let app: INestApplication;
  let httpServer: Server;
  let dataSource: DataSource;
  let catalogRepository: CatalogRepository;
  let fakeClock: FakeClock;
  let personas: IamPersonaFixtures;

  beforeAll(async () => {
    process.env.CIRCULATION_ENABLED = '1';
    fakeClock = new FakeClock(new Date('2026-09-14T12:00:00.000Z'));
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
  }, 120_000);

  beforeEach(async () => {
    fakeClock.set(new Date('2026-09-14T12:00:00.000Z'));
    await resetIdentityState();
    personas = await seedIamPersonas(app);
  });

  afterAll(async () => {
    delete process.env.CIRCULATION_ENABLED;
    await app.close();
  });

  async function createCopy(
    barcodeSuffix: string,
    conditionState: CopyConditionState = 'serviceable',
  ): Promise<string> {
    const seeded = await dataSource.transaction(async (manager) => {
      const category = await catalogRepository.createCategory(manager, {
        code: `rpt-${Date.now()}-${barcodeSuffix}`,
        name: 'Reports',
      });
      const book = await catalogRepository.createBook(manager, {
        categoryId: category.id,
        title: 'Reports Fixture Book',
        createdBy: personas.admin.userId,
        state: 'published',
      });
      const copy = await catalogRepository.createCopy(manager, {
        bookId: book.id,
        barcode: `RPT-${Date.now()}-${barcodeSuffix}`,
        conditionState,
      });
      return { copyId: copy.id };
    });
    return seeded.copyId;
  }

  async function issueCard(): Promise<string> {
    const staff = cardsAgent(httpServer, personas.librarian.cookie, personas.librarian.csrfToken);
    const issued = await staff
      .issueCard({
        userId: personas.reader.userId,
        cardNumber: `CARD-RPT-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        expiresAt: '2027-09-14T12:00:00.000Z',
      })
      .expect(201);
    return (issued.body as { data: { id: string } }).data.id;
  }

  async function insertLoan(params: {
    copyId: string;
    cardId: string;
    state: 'reserved' | 'borrowed' | 'returned' | 'cancelled' | 'expired' | 'lost';
    reservedAt: Date;
    reservationExpiresAt: Date;
    checkedOutAt?: Date | null;
    dueAt?: Date | null;
    closedAt?: Date | null;
  }): Promise<string> {
    const result: { insertId: number } = await dataSource.query(
      `INSERT INTO loans
       (user_id, card_id, copy_id, request_key, request_hash, state, requested_days,
        reserved_at, reservation_expires_at, checked_out_at, due_at, closed_at)
       VALUES (?, ?, ?, ?, ?, ?, 5, ?, ?, ?, ?, ?)`,
      [
        personas.reader.userId,
        params.cardId,
        params.copyId,
        `rpt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        REQUEST_HASH,
        params.state,
        params.reservedAt,
        params.reservationExpiresAt,
        params.checkedOutAt ?? null,
        params.dueAt ?? null,
        params.closedAt ?? null,
      ],
    );
    return String(result.insertId);
  }

  async function backdatePurchaseRequest(
    id: string,
    dates: { createdAt: Date; reviewedAt: Date | null },
  ): Promise<void> {
    await dataSource.query(
      `UPDATE purchase_requests SET created_at = ?, reviewed_at = ? WHERE id = ?`,
      [dates.createdAt, dates.reviewedAt, id],
    );
  }

  it('denies reports.read to a reader on all three reports', async () => {
    const reader = reportsAgent(httpServer, personas.reader.cookie);
    const circulation = await reader.circulation('?from=2026-09-01&to=2026-09-14').expect(403);
    expect((circulation.body as ErrorBody).error.code).toBe(ErrorCode.FORBIDDEN);

    const inventory = await reader.inventory().expect(403);
    expect((inventory.body as ErrorBody).error.code).toBe(ErrorCode.FORBIDDEN);

    const purchases = await reader.purchases('?from=2026-09-01&to=2026-09-14').expect(403);
    expect((purchases.body as ErrorBody).error.code).toBe(ErrorCode.FORBIDDEN);
  });

  it('reconciles circulation totals against a hand-computed fixture and separates the current snapshot from period counts', async () => {
    const cardId = await issueCard();
    const copyA = await createCopy('a');
    const copyB = await createCopy('b');
    const copyC = await createCopy('c');
    const copyD = await createCopy('d');
    const copyE = await createCopy('e');

    // A: checkout + return inside [2026-09-01, 2026-09-15) local -> +1 checkout, +1 return
    await insertLoan({
      copyId: copyA,
      cardId,
      state: 'returned',
      reservedAt: new Date('2026-09-04T10:00:00.000Z'),
      reservationExpiresAt: new Date('2026-09-05T10:00:00.000Z'),
      checkedOutAt: new Date('2026-09-05T10:00:00.000Z'),
      closedAt: new Date('2026-09-07T10:00:00.000Z'),
    });
    // B: checkout + lost inside range -> +1 checkout, +1 lost
    await insertLoan({
      copyId: copyB,
      cardId,
      state: 'lost',
      reservedAt: new Date('2026-09-01T09:00:00.000Z'),
      reservationExpiresAt: new Date('2026-09-02T09:00:00.000Z'),
      checkedOutAt: new Date('2026-09-02T09:00:00.000Z'),
      closedAt: new Date('2026-09-10T08:00:00.000Z'),
    });
    // C: entirely before the range -> excluded
    await insertLoan({
      copyId: copyC,
      cardId,
      state: 'returned',
      reservedAt: new Date('2026-05-31T09:00:00.000Z'),
      reservationExpiresAt: new Date('2026-06-01T09:00:00.000Z'),
      checkedOutAt: new Date('2026-06-01T09:00:00.000Z'),
      closedAt: new Date('2026-06-05T09:00:00.000Z'),
    });
    // D: still borrowed, checked out before the range, overdue "now" -> counts only in asOf
    await insertLoan({
      copyId: copyD,
      cardId,
      state: 'borrowed',
      reservedAt: new Date('2026-06-30T09:00:00.000Z'),
      reservationExpiresAt: new Date('2026-07-01T09:00:00.000Z'),
      checkedOutAt: new Date('2026-07-01T09:00:00.000Z'),
      dueAt: new Date('2026-07-08T09:00:00.000Z'),
    });
    // E: still borrowed, checked out inside the range, not yet due -> +1 period checkout, +1 asOf borrowed
    await insertLoan({
      copyId: copyE,
      cardId,
      state: 'borrowed',
      reservedAt: new Date('2026-09-09T09:00:00.000Z'),
      reservationExpiresAt: new Date('2026-09-10T09:00:00.000Z'),
      checkedOutAt: new Date('2026-09-10T09:00:00.000Z'),
      dueAt: new Date('2026-09-20T09:00:00.000Z'),
    });

    fakeClock.set(new Date('2026-09-14T12:00:00.000Z'));
    const librarian = reportsAgent(httpServer, personas.librarian.cookie);
    const response = await librarian.circulation('?from=2026-09-01&to=2026-09-14').expect(200);
    const body = (response.body as CirculationReportBody).data;

    expect(body.range).toEqual({
      from: '2026-09-01',
      to: '2026-09-14',
      timezone: 'Asia/Ho_Chi_Minh',
    });
    // Hand-computed: checkouts A+B+E=3, returns A=1, lost B=1.
    expect(body.period).toEqual({ checkouts: 3, returns: 1, lost: 1 });
    // Hand-computed: borrowed now = D+E=2, overdue now (due_at < 2026-09-14T12:00Z) = D only.
    expect(body.asOf.currentlyBorrowed).toBe(2);
    expect(body.asOf.currentlyOverdue).toBe(1);
  });

  it('keeps adjacent local-day ranges from double counting at the Asia/Ho_Chi_Minh midnight boundary', async () => {
    const cardId = await issueCard();
    const copyF = await createCopy('f');
    const copyG = await createCopy('g');

    // F: 2026-09-13T16:59:00Z = 2026-09-13 23:59 local (last minute of the 13th).
    await insertLoan({
      copyId: copyF,
      cardId,
      state: 'returned',
      reservedAt: new Date('2026-09-12T10:00:00.000Z'),
      reservationExpiresAt: new Date('2026-09-13T10:00:00.000Z'),
      checkedOutAt: new Date('2026-09-13T16:59:00.000Z'),
      closedAt: new Date('2026-09-13T16:59:30.000Z'),
    });
    // G: 2026-09-13T17:30:00Z = 2026-09-14 00:30 local (first half hour of the 14th).
    await insertLoan({
      copyId: copyG,
      cardId,
      state: 'returned',
      reservedAt: new Date('2026-09-12T10:00:00.000Z'),
      reservationExpiresAt: new Date('2026-09-13T10:00:00.000Z'),
      checkedOutAt: new Date('2026-09-13T17:30:00.000Z'),
      closedAt: new Date('2026-09-13T18:00:00.000Z'),
    });

    const librarian = reportsAgent(httpServer, personas.librarian.cookie);
    const day13 = await librarian.circulation('?from=2026-09-13&to=2026-09-13').expect(200);
    const day14 = await librarian.circulation('?from=2026-09-14&to=2026-09-14').expect(200);

    const body13 = (day13.body as CirculationReportBody).data.period;
    const body14 = (day14.body as CirculationReportBody).data.period;

    expect(body13).toEqual({ checkouts: 1, returns: 1, lost: 0 });
    expect(body14).toEqual({ checkouts: 1, returns: 1, lost: 0 });
  });

  it('reports the inventory snapshot using the same availability invariant as circulation', async () => {
    const cardId = await issueCard();
    await createCopy('avail');
    const copyBorrowed = await createCopy('borrowed');
    const copyReserved = await createCopy('reserved');
    await createCopy('repair', 'repair');
    await createCopy('lost', 'lost');
    await createCopy('retired', 'retired');

    await insertLoan({
      copyId: copyBorrowed,
      cardId,
      state: 'borrowed',
      reservedAt: new Date('2026-09-09T09:00:00.000Z'),
      reservationExpiresAt: new Date('2026-09-10T09:00:00.000Z'),
      checkedOutAt: new Date('2026-09-10T09:00:00.000Z'),
      dueAt: new Date('2026-09-20T09:00:00.000Z'),
    });
    await insertLoan({
      copyId: copyReserved,
      cardId,
      state: 'reserved',
      reservedAt: new Date('2026-09-14T09:00:00.000Z'),
      reservationExpiresAt: new Date('2026-09-15T00:00:00.000Z'),
    });

    fakeClock.set(new Date('2026-09-14T12:00:00.000Z'));
    const librarian = reportsAgent(httpServer, personas.librarian.cookie);
    const response = await librarian.inventory().expect(200);
    const body = (response.body as InventoryReportBody).data;

    expect(body.titles).toBe(6);
    expect(body.physicalCopies).toBe(6);
    expect(body.available).toBe(1);
    expect(body.reservedActive).toBe(1);
    expect(body.borrowed).toBe(1);
    expect(body.repair).toBe(1);
    expect(body.lost).toBe(1);
    expect(body.retired).toBe(1);

    const rejectedExtraQuery = await librarian
      .inventory('?from=2026-09-01&to=2026-09-01')
      .expect(422);
    expect((rejectedExtraQuery.body as ErrorBody).error.code).toBe(ErrorCode.VALIDATION_FAILED);
  });

  it('reconciles purchases totals by created_at/reviewed_at and validates the date range', async () => {
    const reader = purchasesAgent(httpServer, personas.reader.cookie, personas.reader.csrfToken);
    const librarian = purchasesAgent(
      httpServer,
      personas.librarian.cookie,
      personas.librarian.csrfToken,
    );

    function payload(title: string) {
      return { title, authorText: 'Author', publicationYear: 2024 };
    }

    // All HTTP calls stay at the beforeEach clock baseline so session idle/absolute
    // expiry never trips; the created_at/reviewed_at columns are backdated directly
    // afterwards to place each row precisely relative to the report range.
    const p1 = await reader
      .create(payload('Submitted and approved in range'), 'rpt-p1')
      .expect(201);
    await librarian
      .review((p1.body as PurchaseBody).data.id, {
        decision: 'approved',
        version: (p1.body as PurchaseBody).data.version,
      })
      .expect(200);
    await backdatePurchaseRequest((p1.body as PurchaseBody).data.id, {
      createdAt: new Date('2026-09-05T10:00:00.000Z'),
      reviewedAt: new Date('2026-09-06T10:00:00.000Z'),
    });

    const p2 = await reader
      .create(payload('Submitted in range, decided later'), 'rpt-p2')
      .expect(201);
    await librarian
      .review((p2.body as PurchaseBody).data.id, {
        decision: 'rejected',
        version: (p2.body as PurchaseBody).data.version,
        reason: 'Decided after the report window',
      })
      .expect(200);
    await backdatePurchaseRequest((p2.body as PurchaseBody).data.id, {
      createdAt: new Date('2026-09-03T10:00:00.000Z'),
      reviewedAt: new Date('2026-09-20T10:00:00.000Z'),
    });

    const p3 = await reader
      .create(payload('Submitted early, rejected in range'), 'rpt-p3')
      .expect(201);
    await librarian
      .review((p3.body as PurchaseBody).data.id, {
        decision: 'rejected',
        version: (p3.body as PurchaseBody).data.version,
        reason: 'Duplicate of an existing title',
      })
      .expect(200);
    await backdatePurchaseRequest((p3.body as PurchaseBody).data.id, {
      createdAt: new Date('2026-06-01T10:00:00.000Z'),
      reviewedAt: new Date('2026-09-08T10:00:00.000Z'),
    });

    const p4 = await reader.create(payload('Still pending'), 'rpt-p4').expect(201);
    await backdatePurchaseRequest((p4.body as PurchaseBody).data.id, {
      createdAt: new Date('2026-09-10T10:00:00.000Z'),
      reviewedAt: null,
    });

    const librarianReports = reportsAgent(httpServer, personas.librarian.cookie);
    const response = await librarianReports.purchases('?from=2026-09-01&to=2026-09-14').expect(200);
    const body = (response.body as PurchasesReportBody).data;

    expect(body.submitted).toBe(3);
    expect(body.approved).toBe(1);
    expect(body.rejected).toBe(1);
    expect(body.pendingNow).toBe(1);

    const badOrder = await librarianReports.purchases('?from=2026-09-14&to=2026-09-01').expect(422);
    expect((badOrder.body as ErrorBody).error.code).toBe(ErrorCode.VALIDATION_FAILED);

    const malformed = await librarianReports
      .purchases('?from=2026-09-01&to=not-a-date')
      .expect(422);
    expect((malformed.body as ErrorBody).error.code).toBe(ErrorCode.VALIDATION_FAILED);

    const tooLong = await librarianReports.purchases('?from=2025-01-01&to=2026-01-02').expect(422);
    expect((tooLong.body as ErrorBody).error.code).toBe(ErrorCode.VALIDATION_FAILED);
  });

  it('exports a purchases CSV that neutralizes formula-triggering titles, escapes commas, and omits requester identity', async () => {
    const reader = purchasesAgent(httpServer, personas.reader.cookie, personas.reader.csrfToken);
    const librarian = purchasesAgent(
      httpServer,
      personas.librarian.cookie,
      personas.librarian.csrfToken,
    );

    const created = await reader
      .create(
        { title: '=HYPERLINK("http://evil.example")', authorText: 'Author', publicationYear: 2024 },
        'rpt-csv-1',
      )
      .expect(201);
    await librarian
      .review((created.body as PurchaseBody).data.id, {
        decision: 'rejected',
        version: (created.body as PurchaseBody).data.version,
        reason: 'Not needed, ask again next term',
      })
      .expect(200);
    await backdatePurchaseRequest((created.body as PurchaseBody).data.id, {
      createdAt: new Date('2026-09-05T10:00:00.000Z'),
      reviewedAt: new Date('2026-09-06T10:00:00.000Z'),
    });

    const librarianReports = reportsAgent(httpServer, personas.librarian.cookie);
    const response = await librarianReports
      .purchases('?from=2026-09-01&to=2026-09-14&format=csv')
      .expect(200);

    expect(response.headers['content-type']).toContain('text/csv');
    expect(response.headers['content-disposition']).toContain('attachment');
    expect(response.headers['content-disposition']).toContain('purchases-report.csv');

    const csv = response.text;
    expect(
      csv.startsWith('id,title,authorText,publicationYear,state,createdAt,reviewedAt,reviewReason'),
    ).toBe(true);
    expect(csv).toContain('"\'=HYPERLINK(""http://evil.example"")"');
    expect(csv).toContain('"Not needed, ask again next term"');
    expect(csv).not.toContain('requesterId');
    expect(csv).not.toMatch(/reader(\.acceptance)?@test\.local/);
  });
});
