import { mkdtemp } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Server } from 'node:http';
import { DataSource } from 'typeorm';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { ErrorCode } from '../../src/common/http/error-code';
import { DIGITAL_FILE_STORAGE } from '../../src/modules/digital/digital-storage.tokens';
import { LocalDigitalFileStorage } from '../../src/modules/digital/local-digital-file-storage';
import { CatalogRepository } from '../../src/modules/catalog/catalog.repository';
import { CLOCK } from '../../src/platform/clock/clock.interface';
import { configureApp } from '../../src/setup-app';
import { seedIamPersonas, type IamPersonaFixtures } from '../support/acceptance/persona-session';
import { cardsAgent } from '../support/cards/cards-request';
import { digitalAgent } from '../support/digital/digital-request';
import { FakeClock } from '../support/fake-clock';
import {
  applyIdentityMigrations,
  resetIdentityState,
} from '../support/identity/reset-identity-state';

const acceptanceEnabled = process.env.ACCEPTANCE_TESTS === '1';
const describeAcceptance = acceptanceEnabled ? describe : describe.skip;

const PDF_BYTES = Buffer.from('%PDF-1.4 acceptance-matrix');

interface AdminAssetBody {
  data: { id: string };
}

interface DigitalFixture {
  bookId: string;
  publicAssetId: string;
  authenticatedAssetId: string;
  cardAssetId: string;
  quarantineAssetId: string;
}

describeAcceptance('TST-S4-05 digital rights acceptance on MySQL', () => {
  let app: INestApplication;
  let httpServer: Server;
  let personas: IamPersonaFixtures;
  let catalogRepository: CatalogRepository;
  let fixture: DigitalFixture;

  beforeAll(async () => {
    const storageRoot = await mkdtemp(join(tmpdir(), 'digital-acceptance-'));
    process.env.DIGITAL_STORAGE_ROOT = storageRoot;
    const fakeClock = new FakeClock(new Date('2026-09-14T12:00:00.000Z'));
    await applyIdentityMigrations();

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(CLOCK)
      .useValue(fakeClock)
      .overrideProvider(DIGITAL_FILE_STORAGE)
      .useValue(new LocalDigitalFileStorage(storageRoot))
      .compile();

    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    httpServer = app.getHttpServer() as Server;
    catalogRepository = app.get(CatalogRepository);
  }, 120_000);

  beforeEach(async () => {
    await resetIdentityState();
    personas = await seedIamPersonas(app);
    fixture = await seedDigitalFixture();
  });

  afterAll(async () => {
    await app.close();
  });

  async function seedDigitalFixture(): Promise<DigitalFixture> {
    const dataSource = app.get(DataSource);
    const bookId = await dataSource.transaction(async (manager) => {
      const category = await catalogRepository.createCategory(manager, {
        code: 's405',
        name: 'Acceptance Digital',
      });
      const book = await catalogRepository.createBook(manager, {
        categoryId: category.id,
        title: 'Digital Rights Acceptance Book',
        createdBy: personas.admin.userId,
        state: 'published',
      });
      return book.id;
    });

    const librarian = digitalAgent(
      httpServer,
      personas.librarian.cookie,
      personas.librarian.csrfToken,
    );

    async function uploadReady(
      rightsNote: string,
      readAccess: 'public' | 'authenticated' | 'card',
      downloadRequiresCard: boolean,
    ): Promise<string> {
      const uploaded = await librarian.uploadAsset(bookId, PDF_BYTES, rightsNote).expect(201);
      const assetId = (uploaded.body as AdminAssetBody).data.id;
      await librarian
        .patchAccess(assetId, {
          expectedState: 'quarantine',
          state: 'ready',
          readAccess,
          downloadRequiresCard,
        })
        .expect(200);
      return assetId;
    }

    const publicAssetId = await uploadReady('Public asset', 'public', false);
    const authenticatedAssetId = await uploadReady('Auth asset', 'authenticated', true);
    const cardAssetId = await uploadReady('Card asset', 'card', true);

    const quarantined = await librarian
      .uploadAsset(bookId, PDF_BYTES, 'Quarantined asset')
      .expect(201);
    const quarantineAssetId = (quarantined.body as AdminAssetBody).data.id;

    return {
      bookId,
      publicAssetId,
      authenticatedAssetId,
      cardAssetId,
      quarantineAssetId,
    };
  }

  async function issueReaderCard(cardNumber: string): Promise<void> {
    const staff = cardsAgent(httpServer, personas.librarian.cookie, personas.librarian.csrfToken);
    await staff
      .issueCard({
        userId: personas.reader.userId,
        cardNumber,
        expiresAt: '2027-09-14T12:00:00.000Z',
      })
      .expect(201);
  }

  it('records read access outcomes for guest, reader, and reader with card (see planning/acceptance/S4-05-digital-rights-matrix.md)', async () => {
    const guest = digitalAgent(httpServer);
    const reader = digitalAgent(httpServer, personas.reader.cookie);

    await guest.read(fixture.publicAssetId).expect(200);
    await guest.read(fixture.authenticatedAssetId).expect(401);
    await guest.read(fixture.cardAssetId).expect(401);

    await reader.read(fixture.publicAssetId).expect(200);
    await reader.read(fixture.authenticatedAssetId).expect(200);
    await reader.read(fixture.cardAssetId).expect(403);

    await issueReaderCard('CARD-S405-READ');
    await digitalAgent(httpServer, personas.reader.cookie).read(fixture.cardAssetId).expect(200);
  });

  it('records download outcomes and keeps enforcement on direct URLs', async () => {
    const guest = digitalAgent(httpServer);
    const reader = digitalAgent(httpServer, personas.reader.cookie);

    await guest.download(fixture.publicAssetId).expect(401);

    await reader.download(fixture.publicAssetId).expect(200);

    await reader.download(fixture.authenticatedAssetId).expect(403);

    await issueReaderCard('CARD-S405-DL');
    await digitalAgent(httpServer, personas.reader.cookie)
      .download(fixture.authenticatedAssetId)
      .expect(200);

    await guest.read('999999999').expect(404);
    await reader.download('999999999').expect(404);

    await guest.read(fixture.quarantineAssetId).expect(409);
    await digitalAgent(httpServer, personas.reader.cookie)
      .download(fixture.quarantineAssetId)
      .expect(409);
  });

  it('blocks new downloads after the reader card is revoked', async () => {
    const staff = cardsAgent(httpServer, personas.librarian.cookie, personas.librarian.csrfToken);
    const issued = await staff
      .issueCard({
        userId: personas.reader.userId,
        cardNumber: 'CARD-S405-REVOKE',
        expiresAt: '2027-09-14T12:00:00.000Z',
      })
      .expect(201);
    const cardId = (issued.body as { data: { id: string } }).data.id;

    await digitalAgent(httpServer, personas.reader.cookie)
      .download(fixture.authenticatedAssetId)
      .expect(200);

    await staff.patchState(cardId, { expectedState: 'active', state: 'revoked' }).expect(200);

    const denied = await digitalAgent(httpServer, personas.reader.cookie).download(
      fixture.authenticatedAssetId,
    );
    expect(denied.status).toBe(403);
    expect((denied.body as { error: { code: string } }).error.code).toBe(ErrorCode.FORBIDDEN);
  });

  it('keeps public catalog available without a library card', async () => {
    const list = await request(httpServer).get('/api/v1/books?page=1&pageSize=20').expect(200);
    const listBody = list.body as { data: Array<{ id: string }> };
    expect(listBody.data.some((book) => book.id === fixture.bookId)).toBe(true);

    const detail = await request(httpServer).get(`/api/v1/books/${fixture.bookId}`).expect(200);
    const detailBody = detail.body as {
      data: { id: string; digitalAssets: Array<{ id: string; readAccess: string }> };
    };
    expect(detailBody.data.digitalAssets.map((asset) => asset.id)).toEqual(
      expect.arrayContaining([fixture.publicAssetId]),
    );
    expect(JSON.stringify(detail.body)).not.toContain('storage_key');
  });

  it('does not grant librarian upload via reader-facing read/download URLs', async () => {
    const reader = digitalAgent(httpServer, personas.reader.cookie);
    await reader.uploadAsset(fixture.bookId, PDF_BYTES, 'Reader should not upload').expect(403);
  });
});
