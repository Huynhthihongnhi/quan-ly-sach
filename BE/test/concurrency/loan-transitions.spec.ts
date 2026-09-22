import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Server } from 'node:http';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module';
import { ErrorCode } from '../../src/common/http/error-code';
import { CatalogRepository } from '../../src/modules/catalog/catalog.repository';
import { CLOCK } from '../../src/platform/clock/clock.interface';
import { configureApp } from '../../src/setup-app';
import { seedIamPersonas, type IamPersonaFixtures } from '../support/acceptance/persona-session';
import { cardsAgent } from '../support/cards/cards-request';
import { FakeClock } from '../support/fake-clock';
import {
  applyIdentityMigrations,
  resetIdentityState,
} from '../support/identity/reset-identity-state';
import { adminLoansAgent, loansAgent } from '../support/loans/loans-request';

const concurrencyEnabled = process.env.CONCURRENCY_TESTS === '1';
const describeConcurrency = concurrencyEnabled ? describe : describe.skip;

const TEST_PASSWORD = 'ValidPass123!';

interface ErrorBody {
  error: { code: string };
}

interface LoanBody {
  data: { id: string; version: string; state: string; copyId: string };
}

describeConcurrency('TST-S5-03 loan transitions concurrency', () => {
  let app: INestApplication;
  let httpServer: Server;
  let dataSource: DataSource;
  let catalogRepository: CatalogRepository;
  let personas: IamPersonaFixtures;
  let fakeClock: FakeClock;
  let bookId: string;
  let copyId: string;

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
    await resetIdentityState();
    personas = await seedIamPersonas(app);

    const staff = cardsAgent(httpServer, personas.librarian.cookie, personas.librarian.csrfToken);
    const seeded = await dataSource.transaction(async (manager) => {
      const category = await catalogRepository.createCategory(manager, {
        code: `loan-tr-${Date.now()}`,
        name: 'Loan Transitions',
      });
      const book = await catalogRepository.createBook(manager, {
        categoryId: category.id,
        title: 'Transition Book',
        createdBy: personas.admin.userId,
        state: 'published',
      });
      const copy = await catalogRepository.createCopy(manager, {
        bookId: book.id,
        barcode: `COPY-TR-${Date.now()}`,
        conditionState: 'serviceable',
      });
      return { bookId: book.id, copyId: copy.id };
    });
    bookId = seeded.bookId;
    copyId = seeded.copyId;

    await staff
      .issueCard({
        userId: personas.reader.userId,
        cardNumber: 'CARD-TR-READER',
        expiresAt: '2027-09-14T12:00:00.000Z',
      })
      .expect(201);
  });

  afterAll(async () => {
    delete process.env.CIRCULATION_ENABLED;
    await app.close();
  });

  async function reserveLoan(): Promise<LoanBody['data']> {
    const readerLoans = loansAgent(httpServer, personas.reader.cookie, personas.reader.csrfToken);
    const created = await readerLoans
      .create(
        {
          bookId,
          cardNumber: 'CARD-TR-READER',
          password: TEST_PASSWORD,
          requestedDays: 5,
        },
        `reserve-${Date.now()}`,
      )
      .expect(201);
    return (created.body as LoanBody).data;
  }

  it('rejects checkout when reservation expired or card context fails', async () => {
    const loan = await reserveLoan();
    await dataSource.query(
      `UPDATE loans
       SET reserved_at = '2026-09-12 10:00:00.000000',
           reservation_expires_at = '2026-09-12 11:00:00.000000'
       WHERE id = ? AND state = 'reserved'`,
      [loan.id],
    );

    const admin = adminLoansAgent(
      httpServer,
      personas.librarian.cookie,
      personas.librarian.csrfToken,
    );
    const expired = await admin.checkout(loan.id, { version: loan.version }).expect(409);
    expect((expired.body as ErrorBody).error.code).toBe(ErrorCode.INVALID_TRANSITION);
  });

  it('returns a borrowed loan once and rejects duplicate return', async () => {
    fakeClock.set(new Date('2026-09-14T12:00:00.000Z'));
    const loan = await reserveLoan();
    const admin = adminLoansAgent(
      httpServer,
      personas.librarian.cookie,
      personas.librarian.csrfToken,
    );

    const borrowed = await admin.checkout(loan.id, { version: loan.version }).expect(200);
    const borrowedBody = (borrowed.body as LoanBody).data;
    expect(borrowedBody.state).toBe('borrowed');

    const returned = await admin
      .return(borrowedBody.id, { version: borrowedBody.version, conditionState: 'serviceable' })
      .expect(200);
    expect((returned.body as LoanBody).data.state).toBe('returned');

    const duplicate = await admin
      .return(borrowedBody.id, { version: borrowedBody.version, conditionState: 'serviceable' })
      .expect(409);
    expect((duplicate.body as ErrorBody).error.code).toBe(ErrorCode.VERSION_CONFLICT);
  });

  it('allows only one concurrent return or mark-lost transition', async () => {
    fakeClock.set(new Date('2026-09-14T12:00:00.000Z'));
    const loan = await reserveLoan();
    const admin = adminLoansAgent(
      httpServer,
      personas.librarian.cookie,
      personas.librarian.csrfToken,
    );
    const borrowed = await admin.checkout(loan.id, { version: loan.version }).expect(200);
    const version = (borrowed.body as LoanBody).data.version;
    const loanId = (borrowed.body as LoanBody).data.id;

    const [returnRes, lostRes] = await Promise.all([
      admin.return(loanId, { version, conditionState: 'repair' }),
      admin.markLost(loanId, { version, reason: 'Missing during audit' }),
    ]);

    const statuses = [returnRes.status, lostRes.status].sort();
    expect(statuses).toEqual([200, 409]);
  });

  it('rejects cancel after borrowed and keeps history intact', async () => {
    fakeClock.set(new Date('2026-09-14T12:00:00.000Z'));
    const loan = await reserveLoan();
    const admin = adminLoansAgent(
      httpServer,
      personas.librarian.cookie,
      personas.librarian.csrfToken,
    );
    const borrowed = await admin.checkout(loan.id, { version: loan.version }).expect(200);
    const borrowedBody = (borrowed.body as LoanBody).data;

    const readerLoans = loansAgent(httpServer, personas.reader.cookie, personas.reader.csrfToken);
    const cancel = await readerLoans
      .cancel(borrowedBody.id, { version: borrowedBody.version })
      .expect(409);
    expect((cancel.body as ErrorBody).error.code).toBe(ErrorCode.INVALID_TRANSITION);

    const rows: Array<{ state: string }> = await dataSource.query(
      `SELECT state FROM loans WHERE id = ?`,
      [borrowedBody.id],
    );
    expect(rows[0]?.state).toBe('borrowed');
  });

  it('marks lost and sets copy condition to lost without double inventory release', async () => {
    fakeClock.set(new Date('2026-09-14T12:00:00.000Z'));
    const loan = await reserveLoan();
    const admin = adminLoansAgent(
      httpServer,
      personas.librarian.cookie,
      personas.librarian.csrfToken,
    );
    const borrowed = await admin.checkout(loan.id, { version: loan.version }).expect(200);
    const borrowedBody = (borrowed.body as LoanBody).data;

    const lost = await admin
      .markLost(borrowedBody.id, { version: borrowedBody.version, reason: 'Not returned' })
      .expect(200);
    expect((lost.body as LoanBody).data.state).toBe('lost');

    const copyRows: Array<{ condition_state: string }> = await dataSource.query(
      `SELECT condition_state FROM book_copies WHERE id = ?`,
      [copyId],
    );
    expect(copyRows[0]?.condition_state).toBe('lost');

    const activeRows: Array<{ count: string }> = await dataSource.query(
      `SELECT COUNT(*) AS count FROM loans WHERE copy_id = ? AND state IN ('reserved','borrowed')`,
      [copyId],
    );
    expect(Number(activeRows[0]?.count ?? 0)).toBe(0);
  });
});
