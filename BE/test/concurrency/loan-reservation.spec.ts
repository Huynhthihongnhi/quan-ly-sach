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
import { loansAgent } from '../support/loans/loans-request';

const concurrencyEnabled = process.env.CONCURRENCY_TESTS === '1';
const describeConcurrency = concurrencyEnabled ? describe : describe.skip;

const TEST_PASSWORD = 'ValidPass123!';

interface ErrorBody {
  error: { code: string; message: string };
}

interface LoanBody {
  data: { id: string; copyId: string; state: string; requestedDays: number };
}

describeConcurrency('TST-S5-02 loan reservation concurrency', () => {
  let app: INestApplication;
  let httpServer: Server;
  let dataSource: DataSource;
  let catalogRepository: CatalogRepository;
  let personas: IamPersonaFixtures;
  let readerB: PersonaSession;
  let bookId: string;
  let copyId: string;

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
  }, 120_000);

  beforeEach(async () => {
    await resetIdentityState();
    personas = await seedIamPersonas(app);
    readerB = await seedSecondReader(app);

    const staff = cardsAgent(httpServer, personas.librarian.cookie, personas.librarian.csrfToken);
    const seeded = await dataSource.transaction(async (manager) => {
      const category = await catalogRepository.createCategory(manager, {
        code: 'loan-res',
        name: 'Loan Reservation',
      });
      const book = await catalogRepository.createBook(manager, {
        categoryId: category.id,
        title: 'Reservation Concurrency Book',
        createdBy: personas.admin.userId,
        state: 'published',
      });
      const copy = await catalogRepository.createCopy(manager, {
        bookId: book.id,
        barcode: 'COPY-RES-001',
        conditionState: 'serviceable',
      });
      return { bookId: book.id, copyId: copy.id };
    });
    bookId = seeded.bookId;
    copyId = seeded.copyId;

    await staff
      .issueCard({
        userId: personas.reader.userId,
        cardNumber: 'CARD-READER-A',
        expiresAt: '2027-09-14T12:00:00.000Z',
      })
      .expect(201);

    await staff
      .issueCard({
        userId: readerB.userId,
        cardNumber: 'CARD-READER-B',
        expiresAt: '2027-09-14T12:00:00.000Z',
      })
      .expect(201);
  });

  afterAll(async () => {
    delete process.env.CIRCULATION_ENABLED;
    await app.close();
  });

  function loanPayload(cardNumber: string, requestedDays: number, password = TEST_PASSWORD) {
    return { bookId, cardNumber, password, requestedDays };
  }

  it('allows only one winner when two users reserve the last copy concurrently', async () => {
    const readerLoans = loansAgent(httpServer, personas.reader.cookie, personas.reader.csrfToken);
    const readerBLoans = loansAgent(httpServer, readerB.cookie, readerB.csrfToken);

    const [first, second] = await Promise.all([
      readerLoans.create(loanPayload('CARD-READER-A', 7), 'key-user-a'),
      readerBLoans.create(loanPayload('CARD-READER-B', 7), 'key-user-b'),
    ]);

    const statuses = [first.status, second.status].sort();
    expect(statuses).toEqual([201, 409]);
    const failure = first.status === 409 ? first : second;
    expect((failure.body as ErrorBody).error.code).toBe(ErrorCode.NO_COPY_AVAILABLE);
  });

  it('replays the same loan for the same idempotency key and payload', async () => {
    const agent = loansAgent(httpServer, personas.reader.cookie, personas.reader.csrfToken);
    const first = await agent.create(loanPayload('CARD-READER-A', 5), 'replay-key-1').expect(201);
    const second = await agent.create(loanPayload('CARD-READER-A', 5), 'replay-key-1').expect(200);
    expect((second.body as LoanBody).data.id).toBe((first.body as LoanBody).data.id);
  });

  it('returns idempotency conflict when the key is reused with a different payload', async () => {
    const agent = loansAgent(httpServer, personas.reader.cookie, personas.reader.csrfToken);
    await agent.create(loanPayload('CARD-READER-A', 5), 'conflict-key').expect(201);
    const conflict = await agent
      .create(loanPayload('CARD-READER-A', 6), 'conflict-key')
      .expect(409);
    expect((conflict.body as ErrorBody).error.code).toBe(ErrorCode.IDEMPOTENCY_CONFLICT);
  });

  it('rejects requestedDays outside 1..15 and accepts boundaries', async () => {
    const agent = loansAgent(httpServer, personas.reader.cookie, personas.reader.csrfToken);
    const tooLow = await agent.create(loanPayload('CARD-READER-A', 0), 'days-low').expect(422);
    expect((tooLow.body as ErrorBody).error.code).toBe(ErrorCode.VALIDATION_FAILED);

    const tooHigh = await agent.create(loanPayload('CARD-READER-A', 16), 'days-high').expect(422);
    expect((tooHigh.body as ErrorBody).error.code).toBe(ErrorCode.VALIDATION_FAILED);

    await agent.create(loanPayload('CARD-READER-A', 1), 'days-min').expect(201);
    await resetIdentityState();
    personas = await seedIamPersonas(app);
    readerB = await seedSecondReader(app);
    await seedBookAndCards();

    const agent2 = loansAgent(httpServer, personas.reader.cookie, personas.reader.csrfToken);
    await agent2.create(loanPayload('CARD-READER-A', 15), 'days-max').expect(201);
  });

  it('rejects another user card, blocked users, and excessive password failures', async () => {
    const agent = loansAgent(httpServer, personas.reader.cookie, personas.reader.csrfToken);
    const wrongCard = await agent.create(loanPayload('CARD-READER-B', 5), 'wrong-card').expect(403);
    expect((wrongCard.body as ErrorBody).error.code).toBe(ErrorCode.FORBIDDEN);

    await dataSource.query(`UPDATE users SET status = 'blocked' WHERE id = ?`, [
      personas.reader.userId,
    ]);
    const blocked = await agent.create(loanPayload('CARD-READER-A', 5), 'blocked-user').expect(401);
    expect((blocked.body as ErrorBody).error.code).toBe(ErrorCode.AUTHENTICATION_REQUIRED);

    await dataSource.query(`UPDATE users SET status = 'active' WHERE id = ?`, [
      personas.reader.userId,
    ]);

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const bad = await agent
        .create(loanPayload('CARD-READER-A', 5, 'WrongPass123!'), `bad-pass-${attempt}`)
        .expect(401);
      expect((bad.body as ErrorBody).error.code).toBe(ErrorCode.INVALID_CREDENTIALS);
    }

    const limited = await agent
      .create(loanPayload('CARD-READER-A', 5, 'WrongPass123!'), 'bad-pass-final')
      .expect(429);
    expect((limited.body as ErrorBody).error.code).toBe(ErrorCode.RATE_LIMITED);
  });

  it('releases the copy after reservation expiry so another user can reserve once', async () => {
    const readerLoans = loansAgent(httpServer, personas.reader.cookie, personas.reader.csrfToken);
    await readerLoans.create(loanPayload('CARD-READER-A', 4), 'expire-a').expect(201);

    await dataSource.query(
      `UPDATE loans
       SET reserved_at = '2026-09-12 10:00:00.000000',
           reservation_expires_at = '2026-09-12 11:00:00.000000'
       WHERE copy_id = ? AND state = 'reserved'`,
      [copyId],
    );

    const readerBLoans = loansAgent(httpServer, readerB.cookie, readerB.csrfToken);
    const second = await readerBLoans
      .create(loanPayload('CARD-READER-B', 4), 'expire-b')
      .expect(201);
    expect((second.body as LoanBody).data.copyId).toBe(copyId);
    expect((second.body as LoanBody).data.state).toBe('reserved');
  });

  async function seedBookAndCards(): Promise<void> {
    const staff = cardsAgent(httpServer, personas.librarian.cookie, personas.librarian.csrfToken);
    const seeded = await dataSource.transaction(async (manager) => {
      const category = await catalogRepository.createCategory(manager, {
        code: `loan-res-${Date.now()}`,
        name: 'Loan Reservation',
      });
      const book = await catalogRepository.createBook(manager, {
        categoryId: category.id,
        title: 'Reservation Book',
        createdBy: personas.admin.userId,
        state: 'published',
      });
      const copy = await catalogRepository.createCopy(manager, {
        bookId: book.id,
        barcode: `COPY-${Date.now()}`,
        conditionState: 'serviceable',
      });
      return { bookId: book.id, copyId: copy.id };
    });
    bookId = seeded.bookId;
    copyId = seeded.copyId;

    await staff
      .issueCard({
        userId: personas.reader.userId,
        cardNumber: 'CARD-READER-A',
        expiresAt: '2027-09-14T12:00:00.000Z',
      })
      .expect(201);
    await staff
      .issueCard({
        userId: readerB.userId,
        cardNumber: 'CARD-READER-B',
        expiresAt: '2027-09-14T12:00:00.000Z',
      })
      .expect(201);
  }
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
      email: 'reader-b.acceptance@test.local',
      displayName: 'Reader B',
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
    .login('reader-b.acceptance@test.local', TEST_PASSWORD)
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
