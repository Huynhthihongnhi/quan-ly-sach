import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Server } from 'node:http';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module';
import { ErrorCode } from '../../src/common/http/error-code';
import { AccessRepository } from '../../src/modules/access/access.repository';
import { CatalogRepository } from '../../src/modules/catalog/catalog.repository';
import { hashPassword } from '../../src/modules/identity/password-hasher';
import { UserRepository } from '../../src/modules/identity/user.repository';
import { CLOCK } from '../../src/platform/clock/clock.interface';
import { configureApp } from '../../src/setup-app';
import {
  seedIamPersonas,
  type IamPersonaFixtures,
  type PersonaSession,
} from '../support/acceptance/persona-session';
import { authAgent, extractSessionCookie } from '../support/auth/auth-request';
import { cardsAgent } from '../support/cards/cards-request';
import { FakeClock } from '../support/fake-clock';
import {
  applyIdentityMigrations,
  resetIdentityState,
} from '../support/identity/reset-identity-state';
import {
  assertActiveCopyInvariant,
  assertNoServiceableCopyWithUnhandledLostLoan,
  countActiveLoansForCopy,
  countLoanEvents,
  countLoansByRequestKey,
} from '../support/loans/loan-invariants';
import { adminLoansAgent, loansAgent } from '../support/loans/loans-request';
import { usersAgent } from '../support/users/users-request';

const concurrencyEnabled = process.env.CONCURRENCY_TESTS === '1';
const describeConcurrency = concurrencyEnabled ? describe : describe.skip;

const TEST_PASSWORD = 'ValidPass123!';

interface ErrorBody {
  error: { code: string };
}

interface LoanBody {
  data: { id: string; version: string; state: string; copyId: string };
}

interface CardBody {
  data: { id: string; state: string; version: string };
}

describeConcurrency('TST-S5-06 loan recovery and race invariants', () => {
  let app: INestApplication;
  let httpServer: Server;
  let dataSource: DataSource;
  let catalogRepository: CatalogRepository;
  let personas: IamPersonaFixtures;
  let readerB: PersonaSession;
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
    fakeClock.set(new Date('2026-09-14T12:00:00.000Z'));
    await resetIdentityState();
    personas = await seedIamPersonas(app);
    readerB = await seedSecondReader(app);
    await seedBookAndCards();
  });

  afterAll(async () => {
    delete process.env.CIRCULATION_ENABLED;
    await app.close();
  });

  async function seedBookAndCards(): Promise<void> {
    const staff = cardsAgent(httpServer, personas.librarian.cookie, personas.librarian.csrfToken);
    const seeded = await dataSource.transaction(async (manager) => {
      const category = await catalogRepository.createCategory(manager, {
        code: `loan-rcv-${Date.now()}`,
        name: 'Loan Recovery',
      });
      const book = await catalogRepository.createBook(manager, {
        categoryId: category.id,
        title: 'Recovery Race Book',
        createdBy: personas.admin.userId,
        state: 'published',
      });
      const copy = await catalogRepository.createCopy(manager, {
        bookId: book.id,
        barcode: `COPY-RCV-${Date.now()}`,
        conditionState: 'serviceable',
      });
      return { bookId: book.id, copyId: copy.id };
    });
    bookId = seeded.bookId;
    copyId = seeded.copyId;

    await staff
      .issueCard({
        userId: personas.reader.userId,
        cardNumber: 'CARD-RCV-A',
        expiresAt: '2027-09-14T12:00:00.000Z',
      })
      .expect(201);
    await staff
      .issueCard({
        userId: readerB.userId,
        cardNumber: 'CARD-RCV-B',
        expiresAt: '2027-09-14T12:00:00.000Z',
      })
      .expect(201);
  }

  function loanPayload(cardNumber: string, requestedDays = 7) {
    return {
      bookId,
      cardNumber,
      password: TEST_PASSWORD,
      requestedDays,
    };
  }

  async function reserveForReaderA(): Promise<LoanBody['data']> {
    const agent = loansAgent(httpServer, personas.reader.cookie, personas.reader.csrfToken);
    const created = await agent
      .create(loanPayload('CARD-RCV-A'), `reserve-a-${Date.now()}`)
      .expect(201);
    return (created.body as LoanBody).data;
  }

  it('keeps one active loan, one reserved event, and releases copy after concurrent reserve on last copy', async () => {
    const readerLoans = loansAgent(httpServer, personas.reader.cookie, personas.reader.csrfToken);
    const readerBLoans = loansAgent(httpServer, readerB.cookie, readerB.csrfToken);

    const [first, second] = await Promise.all([
      readerLoans.create(loanPayload('CARD-RCV-A'), 'race-res-a'),
      readerBLoans.create(loanPayload('CARD-RCV-B'), 'race-res-b'),
    ]);

    const statuses = [first.status, second.status].sort();
    expect(statuses).toEqual([201, 409]);

    await assertActiveCopyInvariant(dataSource, copyId);
    expect(await countActiveLoansForCopy(dataSource, copyId)).toBe(1);

    const winner =
      first.status === 201 ? (first.body as LoanBody).data : (second.body as LoanBody).data;
    expect(await countLoanEvents(dataSource, winner.id)).toBe(1);
    await assertNoServiceableCopyWithUnhandledLostLoan(dataSource);
  });

  it('allows reserve after TTL expiry while rejecting checkout on the expired reservation', async () => {
    const loan = await reserveForReaderA();
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
    const readerBLoans = loansAgent(httpServer, readerB.cookie, readerB.csrfToken);

    const [checkoutRes, reserveRes] = await Promise.all([
      admin.checkout(loan.id, { version: loan.version }),
      readerBLoans.create(loanPayload('CARD-RCV-B'), 'after-expire-b'),
    ]);

    expect(checkoutRes.status).toBe(409);
    expect((checkoutRes.body as ErrorBody).error.code).toBe(ErrorCode.INVALID_TRANSITION);
    expect(reserveRes.status).toBe(201);
    expect((reserveRes.body as LoanBody).data.copyId).toBe(copyId);

    await assertActiveCopyInvariant(dataSource, copyId);
    const expiredRows: Array<{ state: string }> = await dataSource.query(
      `SELECT state FROM loans WHERE id = ?`,
      [loan.id],
    );
    expect(expiredRows[0]?.state).toBe('expired');
  });

  it('serializes card revoke against checkout with a valid end state', async () => {
    const loan = await reserveForReaderA();
    const staff = cardsAgent(httpServer, personas.librarian.cookie, personas.librarian.csrfToken);
    const listed = await staff.listAdmin(`?userId=${personas.reader.userId}`).expect(200);
    const card = (listed.body as { data: CardBody['data'][] }).data[0];
    if (!card) {
      throw new Error('Expected issued card');
    }

    const admin = adminLoansAgent(
      httpServer,
      personas.librarian.cookie,
      personas.librarian.csrfToken,
    );

    const [revokeRes, checkoutRes] = await Promise.all([
      staff.patchState(card.id, { expectedState: card.state, state: 'revoked' }),
      admin.checkout(loan.id, { version: loan.version }),
    ]);

    const codes = [
      revokeRes.status === 200 ? 'revoked' : 'revoke-failed',
      checkoutRes.status === 200 ? 'checkout-ok' : (checkoutRes.body as ErrorBody).error.code,
    ];

    if (checkoutRes.status === 200) {
      expect(revokeRes.status).toBe(409);
      expect(codes).toContain('checkout-ok');
    } else {
      expect(checkoutRes.status).toBe(409);
      expect((checkoutRes.body as ErrorBody).error.code).toBe(ErrorCode.CARD_NOT_ELIGIBLE);
    }

    await assertActiveCopyInvariant(dataSource, copyId);
    await assertNoServiceableCopyWithUnhandledLostLoan(dataSource);
  });

  it('blocks concurrent reserve when user status is flipped to blocked mid-flight', async () => {
    const adminUsers = usersAgent(httpServer, personas.admin.cookie, personas.admin.csrfToken);
    const readerLoans = loansAgent(httpServer, personas.reader.cookie, personas.reader.csrfToken);
    const userRes = await adminUsers.get(personas.reader.userId).expect(200);
    const userVersion = (userRes.body as { data: { version: string } }).data.version;

    const [blockRes, reserveRes] = await Promise.all([
      adminUsers.updateStatus(personas.reader.userId, {
        status: 'blocked',
        version: userVersion,
      }),
      readerLoans.create(loanPayload('CARD-RCV-A'), 'block-race'),
    ]);

    expect(blockRes.status).toBe(200);
    if (reserveRes.status === 201) {
      expect(await countActiveLoansForCopy(dataSource, copyId)).toBe(1);
    } else {
      expect([401, 403, 409]).toContain(reserveRes.status);
      expect(await countActiveLoansForCopy(dataSource, copyId)).toBe(0);
    }
    await assertNoServiceableCopyWithUnhandledLostLoan(dataSource);
  });

  it('creates only one loan row when the same idempotency key is submitted concurrently', async () => {
    const agent = loansAgent(httpServer, personas.reader.cookie, personas.reader.csrfToken);
    const payload = loanPayload('CARD-RCV-A', 6);

    const [first, second] = await Promise.all([
      agent.create(payload, 'concurrent-idem-key'),
      agent.create(payload, 'concurrent-idem-key'),
    ]);

    expect([first.status, second.status].every((status) => status === 200 || status === 201)).toBe(
      true,
    );
    expect(
      await countLoansByRequestKey(
        dataSource,
        personas.reader.userId,
        'concurrent-idem-key',
      ),
    ).toBe(1);
    await assertActiveCopyInvariant(dataSource, copyId);
  });

  it('keeps return/lost races from leaving a serviceable copy on a lost loan', async () => {
    fakeClock.set(new Date('2026-09-14T12:00:00.000Z'));
    const loan = await reserveForReaderA();
    const admin = adminLoansAgent(
      httpServer,
      personas.librarian.cookie,
      personas.librarian.csrfToken,
    );
    const borrowed = await admin.checkout(loan.id, { version: loan.version }).expect(200);
    const borrowedBody = (borrowed.body as LoanBody).data;

    const [returnRes, lostRes] = await Promise.all([
      admin.return(borrowedBody.id, {
        version: borrowedBody.version,
        conditionState: 'serviceable',
      }),
      admin.markLost(borrowedBody.id, {
        version: borrowedBody.version,
        reason: 'Race during return',
      }),
    ]);

    expect([returnRes.status, lostRes.status].sort()).toEqual([200, 409]);
    await assertNoServiceableCopyWithUnhandledLostLoan(dataSource);
    await assertActiveCopyInvariant(dataSource, copyId);

    const copyRows: Array<{ condition_state: string }> = await dataSource.query(
      `SELECT condition_state FROM book_copies WHERE id = ?`,
      [copyId],
    );
    expect(['lost', 'serviceable', 'repair']).toContain(copyRows[0]?.condition_state);
    if (lostRes.status === 200) {
      expect(copyRows[0]?.condition_state).toBe('lost');
    }
  });

  it('records only one borrowed transition when checkout is duplicated concurrently', async () => {
    fakeClock.set(new Date('2026-09-14T12:00:00.000Z'));
    const loan = await reserveForReaderA();
    const admin = adminLoansAgent(
      httpServer,
      personas.librarian.cookie,
      personas.librarian.csrfToken,
    );

    const [first, second] = await Promise.all([
      admin.checkout(loan.id, { version: loan.version }),
      admin.checkout(loan.id, { version: loan.version }),
    ]);

    expect([first.status, second.status].sort()).toEqual([200, 409]);
    const borrowedId =
      first.status === 200 ? (first.body as LoanBody).data.id : (second.body as LoanBody).data.id;
    const borrowedEvents: Array<{ count: string }> = await dataSource.query(
      `SELECT COUNT(*) AS count FROM loan_events WHERE loan_id = ? AND to_state = 'borrowed'`,
      [borrowedId],
    );
    expect(Number(borrowedEvents[0]?.count ?? 0)).toBe(1);
    await assertActiveCopyInvariant(dataSource, copyId);
    await assertNoServiceableCopyWithUnhandledLostLoan(dataSource);
  });
});

async function seedSecondReader(app: INestApplication): Promise<PersonaSession> {
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
      email: 'reader-b-recovery@test.local',
      displayName: 'Reader B Recovery',
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
    .login('reader-b-recovery@test.local', TEST_PASSWORD)
    .expect(200);
  const body = login.body as { data: { csrfToken: string } };
  const cookie = extractSessionCookie(login.headers['set-cookie']);

  return {
    persona: 'reader',
    userId: user.id,
    email: user.email,
    cookie,
    csrfToken: body.data.csrfToken,
  };
}
