import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Server } from 'node:http';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { ErrorCode } from '../../src/common/http/error-code';
import { CardsService } from '../../src/modules/cards/cards.service';
import { CLOCK } from '../../src/platform/clock/clock.interface';
import { configureApp } from '../../src/setup-app';
import { cardsAgent } from '../support/cards/cards-request';
import { FakeClock } from '../support/fake-clock';
import {
  applyIdentityMigrations,
  resetIdentityState,
} from '../support/identity/reset-identity-state';
import { seedIamPersonas, type IamPersonaFixtures } from '../support/acceptance/persona-session';

const securityEnabled = process.env.SECURITY_TESTS === '1';
const describeSecurity = securityEnabled ? describe : describe.skip;

interface CardResponseBody {
  data: {
    id: string;
    userId: string;
    cardNumber: string;
    state: string;
  };
}

interface CardListResponseBody {
  data: Array<{ id: string; state: string; cardNumber: string }>;
}

describeSecurity('TST-S4-01 library card security on MySQL', () => {
  let app: INestApplication;
  let httpServer: Server;
  let personas: IamPersonaFixtures;
  let cardsService: CardsService;
  let fakeClock: FakeClock;

  beforeAll(async () => {
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
    cardsService = app.get(CardsService);
  }, 120_000);

  beforeEach(async () => {
    fakeClock.set(new Date('2026-09-14T12:00:00.000Z'));
    await resetIdentityState();
    personas = await seedIamPersonas(app);
  });

  afterAll(async () => {
    await app.close();
  });

  it('requires unique card numbers and staff issuance', async () => {
    const staff = cardsAgent(httpServer, personas.librarian.cookie, personas.librarian.csrfToken);
    const expiresAt = '2027-09-14T12:00:00.000Z';

    const first = await staff
      .issueCard({
        userId: personas.reader.userId,
        cardNumber: 'CARD-READER-001',
        expiresAt,
      })
      .expect(201);
    expect((first.body as CardResponseBody).data.state).toBe('active');

    const duplicate = await staff
      .issueCard({
        userId: personas.reader.userId,
        cardNumber: 'CARD-READER-001',
        expiresAt,
      })
      .expect(409);
    expect((duplicate.body as { error: { code: string } }).error.code).toBe(
      ErrorCode.VERSION_CONFLICT,
    );
  });

  it('does not let reader A use reader B card even when the number is known', async () => {
    const staff = cardsAgent(httpServer, personas.librarian.cookie, personas.librarian.csrfToken);
    const expiresAt = '2027-09-14T12:00:00.000Z';

    await staff
      .issueCard({
        userId: personas.reader.userId,
        cardNumber: 'CARD-READER-B',
        expiresAt,
      })
      .expect(201);

    await expect(
      cardsService.assertCardUsableForUser({
        actingUserId: personas.admin.userId,
        cardNumber: 'CARD-READER-B',
      }),
    ).rejects.toMatchObject({
      code: ErrorCode.FORBIDDEN,
    });
  });

  it('rejects cards at expires_at even if state is still active', async () => {
    const staff = cardsAgent(httpServer, personas.librarian.cookie, personas.librarian.csrfToken);
    const issued = await staff
      .issueCard({
        userId: personas.reader.userId,
        cardNumber: 'CARD-EXPIRES-SOON',
        expiresAt: '2026-09-14T13:00:00.000Z',
      })
      .expect(201);
    const card = (issued.body as CardResponseBody).data;

    fakeClock.set(new Date('2026-09-14T13:00:00.000Z'));

    await expect(
      cardsService.assertCardUsableForUser({
        actingUserId: personas.reader.userId,
        cardNumber: card.cardNumber,
        at: fakeClock.now(),
      }),
    ).rejects.toMatchObject({
      code: ErrorCode.INVALID_TRANSITION,
    });
  });

  it('revokes the previous active card when issuing a replacement in one flow', async () => {
    const staff = cardsAgent(httpServer, personas.librarian.cookie, personas.librarian.csrfToken);
    const expiresAt = '2027-09-14T12:00:00.000Z';

    const first = await staff
      .issueCard({
        userId: personas.reader.userId,
        cardNumber: 'CARD-OLD',
        expiresAt,
      })
      .expect(201);
    const firstId = (first.body as CardResponseBody).data.id;

    const second = await staff
      .issueCard({
        userId: personas.reader.userId,
        cardNumber: 'CARD-NEW',
        expiresAt,
      })
      .expect(201);
    const secondId = (second.body as CardResponseBody).data.id;

    const adminList = await staff
      .listAdmin(`?userId=${personas.reader.userId}&pageSize=20`)
      .expect(200);
    const cards = (adminList.body as CardListResponseBody).data;
    expect(cards.find((item) => item.id === firstId)?.state).toBe('revoked');
    expect(cards.find((item) => item.id === secondId)?.state).toBe('active');
    expect(cards.filter((item) => item.state === 'active')).toHaveLength(1);
  });

  it('does not require a library card for guest catalog browsing', async () => {
    await request(httpServer).get('/api/v1/books?page=1&pageSize=5').expect(200);
  });

  it('lists only the signed-in reader cards on /me/library-cards', async () => {
    const staff = cardsAgent(httpServer, personas.librarian.cookie, personas.librarian.csrfToken);
    await staff
      .issueCard({
        userId: personas.reader.userId,
        cardNumber: 'CARD-ME-001',
        expiresAt: '2027-09-14T12:00:00.000Z',
      })
      .expect(201);

    const ownResponse = await cardsAgent(
      httpServer,
      personas.reader.cookie,
      personas.reader.csrfToken,
    )
      .listOwn('?page=1&pageSize=10')
      .expect(200);
    const ownBody = ownResponse.body as CardListResponseBody;
    expect(ownBody.data.every((card) => card.cardNumber === 'CARD-ME-001')).toBe(true);
    expect(ownBody.data.some((card) => card.cardNumber === 'CARD-ME-001')).toBe(true);
  });
});
