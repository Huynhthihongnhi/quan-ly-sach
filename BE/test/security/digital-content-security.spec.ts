import { createHash } from 'node:crypto';
import { mkdtemp } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Server } from 'node:http';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module';
import { ErrorCode } from '../../src/common/http/error-code';
import { DIGITAL_ASSET_MAX_BYTE_SIZE } from '../../src/modules/digital/digital.constants';
import { DIGITAL_FILE_STORAGE } from '../../src/modules/digital/digital-storage.tokens';
import { DigitalAssetsService } from '../../src/modules/digital/digital-assets.service';
import { LocalDigitalFileStorage } from '../../src/modules/digital/local-digital-file-storage';
import { CatalogRepository } from '../../src/modules/catalog/catalog.repository';
import { CardsService } from '../../src/modules/cards/cards.service';
import { configureApp } from '../../src/setup-app';
import { seedIamPersonas, type IamPersonaFixtures } from '../support/acceptance/persona-session';
import { cardsAgent } from '../support/cards/cards-request';
import { digitalAgent } from '../support/digital/digital-request';
import {
  applyIdentityMigrations,
  resetIdentityState,
} from '../support/identity/reset-identity-state';

const securityEnabled = process.env.SECURITY_TESTS === '1';
const describeSecurity = securityEnabled ? describe : describe.skip;

const PDF_BYTES = Buffer.from('%PDF-1.4 digital-security');

interface AdminAssetBody {
  data: { id: string; state: string };
}

describeSecurity('TST-S4-03 digital content security on MySQL', () => {
  let app: INestApplication;
  let httpServer: Server;
  let personas: IamPersonaFixtures;
  let dataSource: DataSource;
  let catalogRepository: CatalogRepository;
  let digitalAssetsService: DigitalAssetsService;
  let cardsService: CardsService;
  let storageRoot: string;
  let publishedBookId: string;
  let draftBookId: string;

  beforeAll(async () => {
    storageRoot = await mkdtemp(join(tmpdir(), 'digital-security-'));
    process.env.DIGITAL_STORAGE_ROOT = storageRoot;
    await applyIdentityMigrations();

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(DIGITAL_FILE_STORAGE)
      .useValue(new LocalDigitalFileStorage(storageRoot))
      .compile();

    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();

    httpServer = app.getHttpServer() as Server;
    dataSource = app.get(DataSource);
    catalogRepository = app.get(CatalogRepository);
    digitalAssetsService = app.get(DigitalAssetsService);
    cardsService = app.get(CardsService);
  }, 120_000);

  beforeEach(async () => {
    await resetIdentityState();
    personas = await seedIamPersonas(app);

    publishedBookId = await dataSource.transaction(async (manager) => {
      const category = await catalogRepository.createCategory(manager, {
        code: 'dig-sec',
        name: 'Digital Security',
      });
      const published = await catalogRepository.createBook(manager, {
        categoryId: category.id,
        title: 'Published Security Book',
        createdBy: personas.admin.userId,
        state: 'published',
      });
      const draft = await catalogRepository.createBook(manager, {
        categoryId: category.id,
        title: 'Draft Security Book',
        createdBy: personas.admin.userId,
        state: 'draft',
      });
      draftBookId = draft.id;
      return published.id;
    });
  });

  afterAll(async () => {
    await app.close();
  });

  async function readyPublicAsset(bookId: string, suffix: string): Promise<string> {
    const librarian = digitalAgent(
      httpServer,
      personas.librarian.cookie,
      personas.librarian.csrfToken,
    );
    const uploaded = await librarian.uploadAsset(bookId, PDF_BYTES, `Rights ${suffix}`).expect(201);
    const assetId = (uploaded.body as AdminAssetBody).data.id;

    await librarian
      .patchAccess(assetId, {
        expectedState: 'quarantine',
        state: 'ready',
        readAccess: 'public',
        downloadRequiresCard: false,
      })
      .expect(200);

    return assetId;
  }

  it('rejects fake MIME, oversize uploads, traversal names, and not-ready content', async () => {
    const librarian = digitalAgent(
      httpServer,
      personas.librarian.cookie,
      personas.librarian.csrfToken,
    );

    const fakeMime = await librarian
      .uploadAsset(publishedBookId, Buffer.from('not-a-pdf'), 'Fake', 'fake.pdf')
      .expect(415);
    expect((fakeMime.body as { error: { code: string } }).error.code).toBe(
      ErrorCode.VALIDATION_FAILED,
    );

    const oversized = Buffer.alloc(DIGITAL_ASSET_MAX_BYTE_SIZE + 1, 0x25);
    oversized.write('%PDF-1.4', 0);
    await librarian.uploadAsset(publishedBookId, oversized, 'Too big', 'big.pdf').expect(413);

    const traversalUpload = await librarian
      .uploadAsset(publishedBookId, PDF_BYTES, 'Traversal', '../../etc/passwd.pdf')
      .expect(201);
    const traversalId = (traversalUpload.body as AdminAssetBody).data.id;
    const traversalRow: Array<{ storageKey: string }> = await dataSource.query(
      'SELECT storage_key AS storageKey FROM digital_assets WHERE id = ?',
      [traversalId],
    );
    expect(traversalRow[0]?.storageKey).toMatch(/^assets\/\d+\/[a-f0-9]{32}\.pdf$/);

    const quarantined = await librarian
      .uploadAsset(publishedBookId, PDF_BYTES, 'Still quarantined')
      .expect(201);
    const quarantineId = (quarantined.body as AdminAssetBody).data.id;

    await digitalAgent(httpServer).read(quarantineId).expect(409);
  });

  it('blocks read and download for draft books even when asset id is known', async () => {
    const assetId = await readyPublicAsset(draftBookId, 'draft-hidden');

    await digitalAgent(httpServer).read(assetId).expect(404);
    await digitalAgent(httpServer, personas.reader.cookie).download(assetId).expect(404);
  });

  it('requires the signed-in user own card for download when policy demands it', async () => {
    const librarian = digitalAgent(
      httpServer,
      personas.librarian.cookie,
      personas.librarian.csrfToken,
    );
    const staffCards = cardsAgent(
      httpServer,
      personas.librarian.cookie,
      personas.librarian.csrfToken,
    );
    const expiresAt = '2027-09-14T12:00:00.000Z';

    const uploaded = await librarian
      .uploadAsset(publishedBookId, PDF_BYTES, 'Card required')
      .expect(201);
    const assetId = (uploaded.body as AdminAssetBody).data.id;

    await librarian
      .patchAccess(assetId, {
        expectedState: 'quarantine',
        state: 'ready',
        readAccess: 'public',
        downloadRequiresCard: true,
      })
      .expect(200);

    await digitalAgent(httpServer, personas.reader.cookie).download(assetId).expect(403);

    await staffCards
      .issueCard({
        userId: personas.reader.userId,
        cardNumber: 'CARD-READER-OWN',
        expiresAt,
      })
      .expect(201);

    const download = await digitalAgent(httpServer, personas.reader.cookie)
      .download(assetId)
      .expect(200);
    expect(download.headers['content-disposition']).toContain('attachment');
    const downloadBody = download.body as Buffer;
    expect(downloadBody.length).toBeGreaterThan(0);
  });

  it('does not let reader A reuse reader B card eligibility', async () => {
    const staffCards = cardsAgent(
      httpServer,
      personas.librarian.cookie,
      personas.librarian.csrfToken,
    );
    const expiresAt = '2027-09-14T12:00:00.000Z';

    await staffCards
      .issueCard({
        userId: personas.reader.userId,
        cardNumber: 'CARD-READER-B-ONLY',
        expiresAt,
      })
      .expect(201);

    await expect(
      cardsService.assertCardUsableForUser({
        actingUserId: personas.admin.userId,
        cardNumber: 'CARD-READER-B-ONLY',
      }),
    ).rejects.toMatchObject({ code: ErrorCode.FORBIDDEN });
  });

  it('serves valid byte ranges and rejects malformed ranges with 416', async () => {
    const assetId = await readyPublicAsset(publishedBookId, 'range');

    const full = await digitalAgent(httpServer).read(assetId).expect(200);
    expect(full.headers['accept-ranges']).toBe('bytes');
    const fullBody = full.body as Buffer;
    expect(fullBody.equals(PDF_BYTES)).toBe(true);

    const partial = await digitalAgent(httpServer).read(assetId, 'bytes=0-4').expect(206);
    expect(partial.headers['content-range']).toBe(`bytes 0-4/${PDF_BYTES.length}`);
    const partialBody = partial.body as Buffer;
    expect(partialBody.equals(PDF_BYTES.subarray(0, 5))).toBe(true);

    await digitalAgent(httpServer).read(assetId, 'bytes=99999-100000').expect(416);
  });

  it('rejects traversal storage keys at read time', async () => {
    const hash = createHash('sha256').update(PDF_BYTES).digest();

    await expect(
      digitalAssetsService.registerMetadata(
        {
          bookId: publishedBookId,
          storageKey: '../../outside.pdf',
          mimeType: 'application/pdf',
          byteSize: PDF_BYTES.length,
          contentHash: hash,
          state: 'ready',
          readAccess: 'public',
          downloadRequiresCard: false,
          rightsNote: 'Traversal key',
          uploadedBy: personas.librarian.userId,
        },
        PDF_BYTES,
      ),
    ).rejects.toMatchObject({ code: ErrorCode.VALIDATION_FAILED });

    const insert: { insertId: number } = await dataSource.query(
      `INSERT INTO digital_assets
       (book_id, storage_key, mime_type, byte_size, content_hash, state, read_access, download_requires_card, rights_note, uploaded_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        publishedBookId,
        '../../outside.pdf',
        'application/pdf',
        PDF_BYTES.length,
        hash,
        'ready',
        'public',
        false,
        'Traversal row',
        personas.librarian.userId,
      ],
    );

    await digitalAgent(httpServer).read(String(insert.insertId)).expect(404);
  });
});
