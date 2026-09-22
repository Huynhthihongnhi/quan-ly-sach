import { createHash } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Server } from 'node:http';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module';
import { LoanReminderSchedulerService } from '../../src/modules/circulation/loan-reminder-scheduler.service';
import { LOAN_DUE_REMINDER_KIND } from '../../src/modules/circulation/loan-reminder.constants';
import { isLoanOverdue } from '../../src/modules/circulation/library-timezone.util';
import { CatalogRepository } from '../../src/modules/catalog/catalog.repository';
import { OutboxProcessorService } from '../../src/modules/messaging/outbox-processor.service';
import { OutboxRepository } from '../../src/modules/messaging/outbox.repository';
import { MAIL_ADAPTER } from '../../src/modules/messaging/messaging.types';
import { CLOCK } from '../../src/platform/clock/clock.interface';
import { configureApp } from '../../src/setup-app';
import { seedIamPersonas, type IamPersonaFixtures } from '../support/acceptance/persona-session';
import { cardsAgent } from '../support/cards/cards-request';
import { FakeClock } from '../support/fake-clock';
import { FakeMailAdapter } from '../support/messaging/fake-mail.adapter';
import {
  applyIdentityMigrations,
  resetIdentityState,
} from '../support/identity/reset-identity-state';

const integrationEnabled = process.env.INTEGRATION_TESTS === '1';
const describeIntegration = integrationEnabled ? describe : describe.skip;

const REQUEST_HASH = createHash('sha256').update('reminder-loan').digest();

describeIntegration('TST-S5-04 loan due reminder worker integration', () => {
  let app: INestApplication;
  let httpServer: Server;
  let dataSource: DataSource;
  let catalogRepository: CatalogRepository;
  let scheduler: LoanReminderSchedulerService;
  let processor: OutboxProcessorService;
  let outboxRepository: OutboxRepository;
  let fakeClock: FakeClock;
  let fakeMail: FakeMailAdapter;
  let personas: IamPersonaFixtures;
  let cardId: string;
  let copyId: string;

  beforeAll(async () => {
    process.env.CIRCULATION_ENABLED = '1';
    fakeClock = new FakeClock(new Date('2026-09-14T02:00:00.000Z'));
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
    catalogRepository = app.get(CatalogRepository);
    scheduler = app.get(LoanReminderSchedulerService);
    processor = app.get(OutboxProcessorService);
    outboxRepository = app.get(OutboxRepository);
  }, 120_000);

  beforeEach(async () => {
    fakeMail.reset();
    fakeClock.set(new Date('2026-09-14T02:00:00.000Z'));
    await resetIdentityState();
    personas = await seedIamPersonas(app);

    const staff = cardsAgent(httpServer, personas.librarian.cookie, personas.librarian.csrfToken);
    const seeded = await dataSource.transaction(async (manager) => {
      const category = await catalogRepository.createCategory(manager, {
        code: `rem-${Date.now()}`,
        name: 'Reminder',
      });
      const book = await catalogRepository.createBook(manager, {
        categoryId: category.id,
        title: 'Reminder Book',
        createdBy: personas.admin.userId,
        state: 'published',
      });
      const copy = await catalogRepository.createCopy(manager, {
        bookId: book.id,
        barcode: `BAR-${Date.now()}`,
        conditionState: 'serviceable',
      });
      return { copyId: copy.id };
    });
    copyId = seeded.copyId;

    const issued = await staff
      .issueCard({
        userId: personas.reader.userId,
        cardNumber: 'CARD-REM-01',
        expiresAt: '2027-09-14T12:00:00.000Z',
      })
      .expect(201);
    cardId = (issued.body as { data: { id: string } }).data.id;
  });

  afterAll(async () => {
    delete process.env.CIRCULATION_ENABLED;
    await app.close();
  });

  async function insertBorrowedLoan(dueAt: Date): Promise<string> {
    const reservedAt = new Date('2026-09-10T12:00:00.000Z');
    const reservationExpiresAt = new Date('2026-09-11T12:00:00.000Z');
    const checkedOutAt = new Date('2026-09-10T13:00:00.000Z');
    const result: { insertId: number } = await dataSource.query(
      `INSERT INTO loans
       (user_id, card_id, copy_id, request_key, request_hash, state, requested_days,
        reserved_at, reservation_expires_at, checked_out_at, due_at)
       VALUES (?, ?, ?, ?, ?, 'borrowed', 5, ?, ?, ?, ?)`,
      [
        personas.reader.userId,
        cardId,
        copyId,
        `rem-${Date.now()}-${Math.random()}`,
        REQUEST_HASH,
        reservedAt,
        reservationExpiresAt,
        checkedOutAt,
        dueAt,
      ],
    );
    return String(result.insertId);
  }

  it('enqueues reminders only for borrowed loans inside the due window', async () => {
    const dueAt = new Date('2026-09-17T12:00:00.000Z');
    const closedLoanId = await insertBorrowedLoan(new Date('2026-09-18T12:00:00.000Z'));
    await dataSource.query(`UPDATE loans SET state = 'returned', closed_at = NOW(6) WHERE id = ?`, [
      closedLoanId,
    ]);
    const activeLoanId = await insertBorrowedLoan(dueAt);

    await scheduler.scanDueReminders();
    await processor.processBatch('worker-a');

    const deliveries: Array<{ loan_id: string }> = await dataSource.query(
      `SELECT loan_id FROM notification_deliveries WHERE kind = ?`,
      [LOAN_DUE_REMINDER_KIND],
    );
    expect(deliveries).toHaveLength(1);
    expect(String(deliveries[0]?.loan_id)).toBe(activeLoanId);
    expect(fakeMail.sent).toHaveLength(1);
  });

  it('dedupes scheduler scans and parallel worker claims for the same reminder', async () => {
    await insertBorrowedLoan(new Date('2026-09-17T12:00:00.000Z'));

    await scheduler.scanDueReminders();
    await scheduler.scanDueReminders();

    await Promise.all([processor.processBatch('worker-a'), processor.processBatch('worker-b')]);

    const deliveries: Array<{ count: string }> = await dataSource.query(
      `SELECT COUNT(*) AS count FROM notification_deliveries WHERE kind = ?`,
      [LOAN_DUE_REMINDER_KIND],
    );
    expect(Number(deliveries[0]?.count ?? 0)).toBe(1);
    expect(fakeMail.sent.length).toBeGreaterThanOrEqual(1);
    expect(fakeMail.sent.length).toBeLessThanOrEqual(2);
  });

  it('cancels stale outbox sends when the loan is no longer borrowed before SMTP', async () => {
    const loanId = await insertBorrowedLoan(new Date('2026-09-17T12:00:00.000Z'));
    await scheduler.scanDueReminders();

    await dataSource.query(`UPDATE loans SET state = 'returned', closed_at = NOW(6) WHERE id = ?`, [
      loanId,
    ]);

    await processor.processBatch('worker-cancel');
    expect(fakeMail.sent).toHaveLength(0);

    const outboxRows: Array<{ state: string }> = await dataSource.query(
      `SELECT o.state FROM notification_deliveries nd
       JOIN email_outbox o ON o.id = nd.outbox_id
       WHERE nd.loan_id = ?`,
      [loanId],
    );
    expect(outboxRows[0]?.state).toBe('cancelled');
  });

  it('does not enqueue reminders after due_at and treats overdue from due_at boundary', async () => {
    const dueAt = new Date('2026-09-14T01:30:00.000Z');
    fakeClock.set(new Date('2026-09-14T01:00:00.000Z'));
    expect(isLoanOverdue(dueAt, fakeClock.now())).toBe(false);

    fakeClock.set(new Date('2026-09-14T02:00:00.000Z'));
    expect(isLoanOverdue(dueAt, fakeClock.now())).toBe(true);

    await insertBorrowedLoan(dueAt);
    const enqueued = await scheduler.scanDueReminders();
    expect(enqueued).toBe(0);
  });

  it('may deliver duplicate email when SMTP succeeds before finalize (at-least-once)', async () => {
    await insertBorrowedLoan(new Date('2026-09-17T12:00:00.000Z'));
    await scheduler.scanDueReminders();

    fakeMail.queueFailures(1);
    await processor.processBatch('worker-retry');
    fakeClock.advanceMs(5_000);
    await processor.runMaintenance();
    await processor.processBatch('worker-retry');

    expect(fakeMail.failCount).toBe(1);
    expect(fakeMail.sent.length).toBeGreaterThanOrEqual(1);

    const sentCount = await outboxRepository.countByState('sent');
    expect(sentCount).toBe(1);
  });
});
