import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Server } from 'node:http';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module';
import { ErrorCode } from '../../src/common/http/error-code';
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
import { adminLoansAgent, loansAgent } from '../support/loans/loans-request';
import { purchasesAgent } from '../support/purchases/purchases-request';
import { reportsAgent } from '../support/reports/reports-request';

const acceptanceEnabled = process.env.ACCEPTANCE_TESTS === '1';
const describeAcceptance = acceptanceEnabled ? describe : describe.skip;

const TEST_PASSWORD = 'ValidPass123!';
const REPORT_RANGE = '?from=2026-09-01&to=2026-09-30';

interface ErrorBody {
  error: { code: string };
}

interface PurchaseListBody {
  meta: { total: number };
}

interface PurchasesReportBody {
  data: { submitted: number; approved: number; rejected: number; pendingNow: number };
}

interface LoanBody {
  data: { id: string; version: string };
}

interface CirculationReportBody {
  data: {
    period: { checkouts: number; returns: number };
    asOf: { currentlyBorrowed: number };
  };
}

interface InventoryReportBody {
  data: { titles: number; physicalCopies: number; available: number };
}

describeAcceptance(
  'TST-S6-05 business acceptance across catalog, loan, purchase, and report',
  () => {
    let app: INestApplication;
    let httpServer: Server;
    let dataSource: DataSource;
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

    it('lets a guest browse the public catalog but blocks reports and the purchase admin queue with authentication required', async () => {
      await request(httpServer).get('/api/v1/books').expect(200);

      const protectedRoutes = [
        `/api/v1/reports/circulation${REPORT_RANGE}`,
        '/api/v1/reports/inventory',
        `/api/v1/reports/purchases${REPORT_RANGE}`,
        `/api/v1/reports/purchases${REPORT_RANGE}&format=csv`,
        '/api/v1/admin/purchase-requests',
      ];

      for (const route of protectedRoutes) {
        const response = await request(httpServer).get(route).expect(401);
        expect((response.body as ErrorBody).error.code).toBe(ErrorCode.AUTHENTICATION_REQUIRED);
      }
    });

    it('keeps the admin purchase queue and the purchases report reporting the same pending, approved, and rejected totals', async () => {
      const reader = purchasesAgent(httpServer, personas.reader.cookie, personas.reader.csrfToken);
      const librarian = purchasesAgent(
        httpServer,
        personas.librarian.cookie,
        personas.librarian.csrfToken,
      );

      function payload(title: string) {
        return { title, authorText: 'Author', publicationYear: 2024 };
      }

      const approved = await reader
        .create(payload('Approved by acceptance'), 'accept-p1')
        .expect(201);
      await librarian
        .review((approved.body as { data: { id: string; version: string } }).data.id, {
          decision: 'approved',
          version: (approved.body as { data: { id: string; version: string } }).data.version,
        })
        .expect(200);

      const rejected = await reader
        .create(payload('Rejected by acceptance'), 'accept-p2')
        .expect(201);
      await librarian
        .review((rejected.body as { data: { id: string; version: string } }).data.id, {
          decision: 'rejected',
          version: (rejected.body as { data: { id: string; version: string } }).data.version,
          reason: 'Not needed this term',
        })
        .expect(200);

      await reader.create(payload('Still pending by acceptance'), 'accept-p3').expect(201);

      const adminPending = await librarian.listAdmin('?state=pending').expect(200);
      const adminApproved = await librarian.listAdmin('?state=approved').expect(200);
      const adminRejected = await librarian.listAdmin('?state=rejected').expect(200);

      const librarianReports = reportsAgent(httpServer, personas.librarian.cookie);
      const report = await librarianReports.purchases(REPORT_RANGE).expect(200);
      const reportBody = (report.body as PurchasesReportBody).data;

      expect((adminPending.body as PurchaseListBody).meta.total).toBe(reportBody.pendingNow);
      expect((adminApproved.body as PurchaseListBody).meta.total).toBe(reportBody.approved);
      expect((adminRejected.body as PurchaseListBody).meta.total).toBe(reportBody.rejected);
      expect(reportBody.submitted).toBe(3);
    });

    it('completes a search, reserve, checkout, and return flow that reconciles with the circulation and inventory reports', async () => {
      const librarianCatalog = catalogAgent(
        httpServer,
        personas.librarian.cookie,
        personas.librarian.csrfToken,
      );
      const category = await librarianCatalog
        .createCategory({ code: `s6-05-cat-${Date.now()}`, name: 'S6-05 Acceptance' })
        .expect(201);
      const categoryId = (category.body as { data: { id: string } }).data.id;
      const book = await librarianCatalog
        .createBook({
          categoryId,
          title: 'S6-05 Acceptance Reconciliation',
          publicationYear: 2024,
          authorIds: [],
          topicIds: [],
        })
        .expect(201);
      const bookBody = (book.body as { data: { id: string; version: string } }).data;
      await librarianCatalog
        .patchBookState(bookBody.id, { state: 'published', version: bookBody.version })
        .expect(200);
      await librarianCatalog.createCopy(bookBody.id, { barcode: `S605-${Date.now()}` }).expect(201);

      const staff = cardsAgent(httpServer, personas.librarian.cookie, personas.librarian.csrfToken);
      const cardNumber = `CARD-S605-${Date.now()}`;
      await staff
        .issueCard({
          userId: personas.reader.userId,
          cardNumber,
          expiresAt: '2027-09-14T12:00:00.000Z',
        })
        .expect(201);

      const search = await request(httpServer)
        .get(`/api/v1/books?page=1&pageSize=20&title=${encodeURIComponent('S6-05 Acceptance')}`)
        .expect(200);
      expect(
        (search.body as { data: Array<{ id: string }> }).data.some((row) => row.id === bookBody.id),
      ).toBe(true);

      const readerLoans = loansAgent(httpServer, personas.reader.cookie, personas.reader.csrfToken);
      const reserved = await readerLoans
        .create(
          { bookId: bookBody.id, cardNumber, password: TEST_PASSWORD, requestedDays: 10 },
          's6-05-reserve',
        )
        .expect(201);
      const loan = (reserved.body as LoanBody).data;

      const admin = adminLoansAgent(
        httpServer,
        personas.librarian.cookie,
        personas.librarian.csrfToken,
      );
      const borrowed = await admin.checkout(loan.id, { version: loan.version }).expect(200);
      const borrowedBody = (borrowed.body as LoanBody).data;

      const versionRows: Array<{ version: string }> = await dataSource.query(
        `SELECT version FROM loans WHERE id = ?`,
        [borrowedBody.id],
      );
      await admin
        .return(borrowedBody.id, { version: versionRows[0].version, conditionState: 'serviceable' })
        .expect(200);

      const librarianReports = reportsAgent(httpServer, personas.librarian.cookie);
      const circulation = await librarianReports.circulation(REPORT_RANGE).expect(200);
      const circulationBody = (circulation.body as CirculationReportBody).data;
      // resetIdentityState wipes loans/books/copies before this test, so this loan is the
      // only row in scope: exact counts catch a report that double-counts, not just a report
      // that returns zero.
      expect(circulationBody.period.checkouts).toBe(1);
      expect(circulationBody.period.returns).toBe(1);
      expect(circulationBody.asOf.currentlyBorrowed).toBe(0);

      const inventory = await librarianReports.inventory().expect(200);
      const inventoryBody = (inventory.body as InventoryReportBody).data;
      expect(inventoryBody.titles).toBe(1);
      expect(inventoryBody.physicalCopies).toBe(1);
      expect(inventoryBody.available).toBe(1);
    });
  },
);
