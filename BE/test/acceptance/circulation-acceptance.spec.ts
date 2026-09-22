import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Server } from 'node:http';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module';
import { ErrorCode } from '../../src/common/http/error-code';
import { LoanReminderSchedulerService } from '../../src/modules/circulation/loan-reminder-scheduler.service';
import { LOAN_DUE_REMINDER_KIND } from '../../src/modules/circulation/loan-reminder.constants';
import {
  computeDueReminderSendAt,
  isLoanOverdue,
} from '../../src/modules/circulation/library-timezone.util';
import { CirculationInventoryService } from '../../src/modules/circulation/circulation-inventory.service';
import { OutboxProcessorService } from '../../src/modules/messaging/outbox-processor.service';
import { MAIL_ADAPTER } from '../../src/modules/messaging/messaging.types';
import { CLOCK } from '../../src/platform/clock/clock.interface';
import { configureApp } from '../../src/setup-app';
import {
  seedIamPersonas,
  type IamPersonaFixtures,
  type PersonaSession,
} from '../support/acceptance/persona-session';
import { authAgent, extractSessionCookie } from '../support/auth/auth-request';
import { cardsAgent } from '../support/cards/cards-request';
import { catalogAgent } from '../support/catalog/catalog-request';
import { FakeClock } from '../support/fake-clock';
import { FakeMailAdapter } from '../support/messaging/fake-mail.adapter';
import {
  applyIdentityMigrations,
  resetIdentityState,
} from '../support/identity/reset-identity-state';
import { adminLoansAgent, loansAgent } from '../support/loans/loans-request';
import { assertNoServiceableCopyWithUnhandledLostLoan } from '../support/loans/loan-invariants';

const acceptanceEnabled = process.env.ACCEPTANCE_TESTS === '1';
const describeAcceptance = acceptanceEnabled ? describe : describe.skip;

const TEST_PASSWORD = 'ValidPass123!';

interface LoanBody {
  data: { id: string; version: string; state: string; copyId: string; dueAt?: string | null };
}

interface PublicDetailBody {
  data: { id: string; title: string; availableCopies: number | null };
}

describeAcceptance('TST-S5-07 circulation acceptance on MySQL test database', () => {
  let app: INestApplication;
  let httpServer: Server;
  let dataSource: DataSource;
  let circulationInventory: CirculationInventoryService;
  let scheduler: LoanReminderSchedulerService;
  let processor: OutboxProcessorService;
  let fakeClock: FakeClock;
  let fakeMail: FakeMailAdapter;
  let personas: IamPersonaFixtures;

  beforeAll(async () => {
    process.env.CIRCULATION_ENABLED = '1';
    fakeClock = new FakeClock(new Date('2026-09-10T05:00:00.000Z'));
    fakeMail = new FakeMailAdapter();
    await applyIdentityMigrations();

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(CLOCK)
      .useValue(fakeClock)
      .overrideProvider(MAIL_ADAPTER)
      .useValue(fakeMail)
      .compile();

    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();

    httpServer = app.getHttpServer() as Server;
    dataSource = app.get(DataSource);
    circulationInventory = app.get(CirculationInventoryService);
    scheduler = app.get(LoanReminderSchedulerService);
    processor = app.get(OutboxProcessorService);
  }, 120_000);

  beforeEach(async () => {
    fakeMail.reset();
    fakeClock.set(new Date('2026-09-10T05:00:00.000Z'));
    await resetIdentityState();
    personas = await seedIamPersonas(app);
  });

  afterAll(async () => {
    delete process.env.CIRCULATION_ENABLED;
    await app.close();
  });

  async function seedPublishedBook(title: string): Promise<{ bookId: string; copyId: string }> {
    const librarian = catalogAgent(
      httpServer,
      personas.librarian.cookie,
      personas.librarian.csrfToken,
    );
    const category = await librarian
      .createCategory({ code: `acc-cat-${Date.now()}`, name: 'Acceptance Circulation' })
      .expect(201);
    const categoryId = (category.body as { data: { id: string } }).data.id;
    const book = await librarian
      .createBook({
        categoryId,
        title,
        publicationYear: 2024,
        authorIds: [],
        topicIds: [],
      })
      .expect(201);
    const bookBody = book.body as { data: { id: string; version: string } };
    const bookId = bookBody.data.id;
    await librarian
      .patchBookState(bookId, { state: 'published', version: bookBody.data.version })
      .expect(200);
    const copy = await librarian.createCopy(bookId, { barcode: `ACC-${Date.now()}` }).expect(201);
    const copyId = (copy.body as { data: { id: string } }).data.id;
    return { bookId, copyId };
  }

  async function issueReaderCard(cardNumber: string, expiresAt: string): Promise<void> {
    const staff = cardsAgent(httpServer, personas.librarian.cookie, personas.librarian.csrfToken);
    await staff
      .issueCard({
        userId: personas.reader.userId,
        cardNumber,
        expiresAt,
      })
      .expect(201);
  }

  async function reloginPersona(email: string, base: PersonaSession): Promise<PersonaSession> {
    const login = await authAgent(httpServer).login(email, TEST_PASSWORD).expect(200);
    const body = login.body as { data: { csrfToken: string } };
    return {
      ...base,
      cookie: extractSessionCookie(login.headers['set-cookie']),
      csrfToken: body.data.csrfToken,
    };
  }

  it('completes search, reserve, receipt, checkout, reminder, and return with inventory restored', async () => {
    const title = 'Circulation Acceptance Algebra';
    const { bookId } = await seedPublishedBook(title);
    await issueReaderCard('CARD-ACC-HAPPY', '2027-09-14T12:00:00.000Z');

    const search = await request(httpServer)
      .get(`/api/v1/books?page=1&pageSize=20&title=${encodeURIComponent('Acceptance Algebra')}`)
      .expect(200);
    const searchBody = search.body as { data: Array<{ id: string }> };
    expect(searchBody.data.some((row) => row.id === bookId)).toBe(true);

    const beforeDetail = await request(httpServer).get(`/api/v1/books/${bookId}`).expect(200);
    expect((beforeDetail.body as PublicDetailBody).data.availableCopies).toBe(1);

    const readerLoans = loansAgent(httpServer, personas.reader.cookie, personas.reader.csrfToken);
    const reserved = await readerLoans
      .create(
        {
          bookId,
          cardNumber: 'CARD-ACC-HAPPY',
          password: TEST_PASSWORD,
          requestedDays: 15,
        },
        'accept-happy-path',
      )
      .expect(201);
    const loan = (reserved.body as LoanBody).data;

    const receipt = await readerLoans.get(loan.id).expect(200);
    expect((receipt.body as LoanBody).data.state).toBe('reserved');

    const afterReserveDetail = await request(httpServer).get(`/api/v1/books/${bookId}`).expect(200);
    expect((afterReserveDetail.body as PublicDetailBody).data.availableCopies).toBe(0);

    const admin = adminLoansAgent(
      httpServer,
      personas.librarian.cookie,
      personas.librarian.csrfToken,
    );
    const borrowed = await admin.checkout(loan.id, { version: loan.version }).expect(200);
    const borrowedBody = (borrowed.body as LoanBody).data;
    expect(borrowedBody.state).toBe('borrowed');
    expect(borrowedBody.dueAt).toBeTruthy();

    const dueAt = new Date(borrowedBody.dueAt!);
    const sendAt = computeDueReminderSendAt(dueAt, { daysBefore: 3, localSendHour: 8 });
    fakeClock.set(new Date(sendAt.getTime() + 60_000));
    await scheduler.scanDueReminders();
    await processor.processBatch('acceptance-worker');
    expect(fakeMail.sent.length).toBeGreaterThanOrEqual(1);

    personas.librarian = await reloginPersona(
      'librarian.acceptance@test.local',
      personas.librarian,
    );
    const adminAfterReminder = adminLoansAgent(
      httpServer,
      personas.librarian.cookie,
      personas.librarian.csrfToken,
    );
    const versionBeforeReturn: Array<{ version: string }> = await dataSource.query(
      `SELECT version FROM loans WHERE id = ?`,
      [borrowedBody.id],
    );
    const returned = await adminAfterReminder
      .return(borrowedBody.id, {
        version: versionBeforeReturn[0].version,
        conditionState: 'serviceable',
      })
      .expect(200);
    expect((returned.body as LoanBody).data.state).toBe('returned');

    const afterReturnDetail = await request(httpServer).get(`/api/v1/books/${bookId}`).expect(200);
    expect((afterReturnDetail.body as PublicDetailBody).data.availableCopies).toBe(1);
    expect(await circulationInventory.countAvailableCopiesForBook(bookId)).toBe(1);
  });

  it('surfaces no-copy inventory errors when the last copy is held', async () => {
    const { bookId } = await seedPublishedBook('Single Copy Title');
    await issueReaderCard('CARD-ACC-SOLO', '2027-09-14T12:00:00.000Z');

    const readerLoans = loansAgent(httpServer, personas.reader.cookie, personas.reader.csrfToken);
    await readerLoans
      .create(
        {
          bookId,
          cardNumber: 'CARD-ACC-SOLO',
          password: TEST_PASSWORD,
          requestedDays: 5,
        },
        'solo-reserve',
      )
      .expect(201);

    const blocked = await readerLoans
      .create(
        {
          bookId,
          cardNumber: 'CARD-ACC-SOLO',
          password: TEST_PASSWORD,
          requestedDays: 5,
        },
        'solo-reserve-2',
      )
      .expect(409);
    expect((blocked.body as { error: { code: string } }).error.code).toBe(
      ErrorCode.NO_COPY_AVAILABLE,
    );

    const detail = await request(httpServer).get(`/api/v1/books/${bookId}`).expect(200);
    expect((detail.body as PublicDetailBody).data.availableCopies).toBe(0);
  });

  it('rejects reserve when the library card is no longer effective', async () => {
    const { bookId } = await seedPublishedBook('Expired Card Title');
    await issueReaderCard('CARD-ACC-EXP', '2027-09-14T12:00:00.000Z');
    const staff = cardsAgent(httpServer, personas.librarian.cookie, personas.librarian.csrfToken);
    const listed = await staff.listAdmin(`?userId=${personas.reader.userId}`).expect(200);
    const card = (listed.body as { data: Array<{ id: string; state: string }> }).data[0];
    await staff.patchState(card.id, { expectedState: card.state, state: 'expired' }).expect(200);

    const readerLoans = loansAgent(httpServer, personas.reader.cookie, personas.reader.csrfToken);
    const failed = await readerLoans
      .create(
        {
          bookId,
          cardNumber: 'CARD-ACC-EXP',
          password: TEST_PASSWORD,
          requestedDays: 5,
        },
        'expired-card',
      )
      .expect(409);
    expect((failed.body as { error: { code: string } }).error.code).toBe(
      ErrorCode.CARD_NOT_ELIGIBLE,
    );
  });

  it('lets staff list active and overdue loans while readers are forbidden from the admin queue', async () => {
    const { bookId, copyId } = await seedPublishedBook('Staff Queue Title');
    await issueReaderCard('CARD-ACC-STAFF', '2027-09-14T12:00:00.000Z');

    const readerLoans = loansAgent(httpServer, personas.reader.cookie, personas.reader.csrfToken);
    const reserved = await readerLoans
      .create(
        {
          bookId,
          cardNumber: 'CARD-ACC-STAFF',
          password: TEST_PASSWORD,
          requestedDays: 7,
        },
        'staff-queue',
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

    const readerLoansFresh = loansAgent(
      httpServer,
      personas.reader.cookie,
      personas.reader.csrfToken,
    );
    await readerLoansFresh.listOwn('?page=1').expect(200);
    await request(httpServer)
      .get('/api/v1/admin/loans?page=1')
      .set('Cookie', personas.reader.cookie)
      .expect(403);

    fakeClock.set(new Date('2026-09-20T12:00:00.000Z'));
    await dataSource.query(`UPDATE loans SET due_at = ? WHERE id = ?`, [
      new Date('2026-09-12T12:00:00.000Z'),
      borrowedBody.id,
    ]);
    const dueRow: Array<{ due_at: Date }> = await dataSource.query(
      `SELECT due_at FROM loans WHERE id = ?`,
      [borrowedBody.id],
    );
    expect(isLoanOverdue(dueRow[0].due_at, fakeClock.now())).toBe(true);

    personas.librarian = await reloginPersona(
      'librarian.acceptance@test.local',
      personas.librarian,
    );
    const adminFresh = adminLoansAgent(
      httpServer,
      personas.librarian.cookie,
      personas.librarian.csrfToken,
    );
    const staffList = await adminFresh.list('?overdue=true&page=1').expect(200);
    const staffBody = staffList.body as { data: Array<{ id: string; userId: string }> };
    expect(staffBody.data.some((row) => row.id === borrowedBody.id)).toBe(true);
    expect(staffBody.data.some((row) => row.userId === personas.reader.userId)).toBe(true);

    const versionRows: Array<{ version: string }> = await dataSource.query(
      `SELECT version FROM loans WHERE id = ?`,
      [borrowedBody.id],
    );
    await adminFresh
      .markLost(borrowedBody.id, {
        version: versionRows[0].version,
        reason: 'Acceptance lost path',
      })
      .expect(200);

    const copyRows: Array<{ condition_state: string }> = await dataSource.query(
      `SELECT condition_state FROM book_copies WHERE id = ?`,
      [copyId],
    );
    expect(copyRows[0]?.condition_state).toBe('lost');
    await assertNoServiceableCopyWithUnhandledLostLoan(dataSource);
  });

  it('delivers a due reminder using fake time without waiting real days', async () => {
    const { bookId } = await seedPublishedBook('Reminder Acceptance Title');
    await issueReaderCard('CARD-ACC-REM', '2027-09-14T12:00:00.000Z');

    const readerLoans = loansAgent(httpServer, personas.reader.cookie, personas.reader.csrfToken);
    const reserved = await readerLoans
      .create(
        {
          bookId,
          cardNumber: 'CARD-ACC-REM',
          password: TEST_PASSWORD,
          requestedDays: 10,
        },
        'reminder-flow',
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
    const dueAt = new Date(borrowedBody.dueAt!);
    const sendAt = computeDueReminderSendAt(dueAt, { daysBefore: 3, localSendHour: 8 });
    fakeClock.set(new Date(sendAt.getTime() + 30_000));

    const enqueued = await scheduler.scanDueReminders();
    expect(enqueued).toBeGreaterThanOrEqual(1);
    await processor.processBatch('acceptance-reminder');
    expect(fakeMail.sent.length).toBeGreaterThanOrEqual(1);

    const deliveries: Array<{ count: string }> = await dataSource.query(
      `SELECT COUNT(*) AS count FROM notification_deliveries WHERE kind = ? AND loan_id = ?`,
      [LOAN_DUE_REMINDER_KIND, borrowedBody.id],
    );
    expect(Number(deliveries[0]?.count ?? 0)).toBe(1);
  });
});
