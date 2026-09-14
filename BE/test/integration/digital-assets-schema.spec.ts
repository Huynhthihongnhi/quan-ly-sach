import { createHash, randomBytes } from 'node:crypto';
import { mkdtemp } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Server } from 'node:http';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module';
import { ErrorCode } from '../../src/common/http/error-code';
import { DIGITAL_ASSET_MAX_BYTE_SIZE } from '../../src/modules/digital/digital.constants';
import { DIGITAL_FILE_STORAGE } from '../../src/modules/digital/digital-storage.tokens';
import type { DigitalFileStorage } from '../../src/modules/digital/digital-file-storage.interface';
import { DigitalAssetsService } from '../../src/modules/digital/digital-assets.service';
import { LocalDigitalFileStorage } from '../../src/modules/digital/local-digital-file-storage';
import { CatalogRepository } from '../../src/modules/catalog/catalog.repository';
import { BootstrapService } from '../../src/modules/bootstrap/bootstrap.service';
import { UserRepository } from '../../src/modules/identity/user.repository';
import { configureApp } from '../../src/setup-app';
import {
  applyIdentityMigrations,
  resetIdentityState,
} from '../support/identity/reset-identity-state';

const integrationEnabled = process.env.INTEGRATION_TESTS === '1';
const describeDigitalSchema = integrationEnabled ? describe : describe.skip;

describeDigitalSchema('TST-S4-02 digital assets schema and public catalog on MySQL', () => {
  let app: INestApplication;
  let httpServer: Server;
  let dataSource: DataSource;
  let catalogRepository: CatalogRepository;
  let digitalAssetsService: DigitalAssetsService;
  let fileStorage: DigitalFileStorage;
  let bootstrapService: BootstrapService;
  let userRepository: UserRepository;
  let creatorUserId: string;
  let publishedBookId: string;
  let storageRoot: string;

  beforeAll(async () => {
    storageRoot = await mkdtemp(join(tmpdir(), 'digital-assets-test-'));
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
    fileStorage = app.get(DIGITAL_FILE_STORAGE);
    bootstrapService = app.get(BootstrapService);
    userRepository = app.get(UserRepository);
  }, 120_000);

  beforeEach(async () => {
    await resetIdentityState();
    await bootstrapService.seedRegistryOnly();
    await bootstrapService.bootstrapAdmin({
      email: 'digital.schema@test.local',
      password: 'AdminPass123!',
      displayName: 'Digital Schema Admin',
      requestId: 'digital-schema-seed',
    });
    const admin = await userRepository.findByEmail('digital.schema@test.local');
    if (!admin) {
      throw new Error('Missing admin user');
    }
    creatorUserId = admin.id;

    publishedBookId = await dataSource.transaction(async (manager) => {
      const category = await catalogRepository.createCategory(manager, {
        code: 'digital-cat',
        name: 'Digital',
      });
      const book = await catalogRepository.createBook(manager, {
        categoryId: category.id,
        title: 'Digital Published Book',
        createdBy: creatorUserId,
        state: 'published',
      });
      return book.id;
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it('enforces book FK, unique storage_key, and domain CHECK constraints', async () => {
    const content = Buffer.from('%PDF-1.4 minimal');
    const hash = createHash('sha256').update(content).digest();

    await expect(
      digitalAssetsService.registerMetadata(
        {
          bookId: '999999',
          storageKey: 'assets/missing-book.pdf',
          mimeType: 'application/pdf',
          byteSize: content.length,
          contentHash: hash,
          state: 'quarantine',
          readAccess: 'authenticated',
          downloadRequiresCard: true,
          rightsNote: 'Test rights',
          uploadedBy: creatorUserId,
        },
        content,
      ),
    ).rejects.toThrow();

    const created = await digitalAssetsService.registerMetadata(
      {
        bookId: publishedBookId,
        storageKey: 'assets/unique-key.pdf',
        mimeType: 'application/pdf',
        byteSize: content.length,
        contentHash: hash,
        state: 'quarantine',
        readAccess: 'public',
        downloadRequiresCard: false,
        rightsNote: 'Licensed for campus use',
        uploadedBy: creatorUserId,
      },
      content,
    );

    await expect(
      digitalAssetsService.registerMetadata(
        {
          bookId: publishedBookId,
          storageKey: 'assets/unique-key.pdf',
          mimeType: 'application/pdf',
          byteSize: content.length,
          contentHash: hash,
          state: 'quarantine',
          readAccess: 'public',
          downloadRequiresCard: false,
          rightsNote: 'Duplicate key',
          uploadedBy: creatorUserId,
        },
        content,
      ),
    ).rejects.toThrow();

    await expect(
      dataSource.query(
        `INSERT INTO digital_assets
         (book_id, storage_key, mime_type, byte_size, content_hash, state, read_access, download_requires_card, rights_note, uploaded_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          publishedBookId,
          'assets/bad-state.pdf',
          'application/pdf',
          content.length,
          hash,
          'pending',
          'public',
          true,
          'Bad state',
          creatorUserId,
        ],
      ),
    ).rejects.toThrow();

    await expect(
      dataSource.query(
        `INSERT INTO digital_assets
         (book_id, storage_key, mime_type, byte_size, content_hash, state, read_access, download_requires_card, rights_note, uploaded_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          publishedBookId,
          'assets/bad-access.pdf',
          'application/pdf',
          content.length,
          hash,
          'quarantine',
          'anonymous',
          true,
          'Bad access',
          creatorUserId,
        ],
      ),
    ).rejects.toThrow();

    expect(created.id).toBeDefined();
    expect(Number(created.byteSize)).toBe(content.length);
  });

  it('rejects oversize metadata registration before content can be served', async () => {
    const tooLarge = DIGITAL_ASSET_MAX_BYTE_SIZE + 1;
    const content = randomBytes(64);
    const hash = createHash('sha256').update(content).digest();

    await expect(
      digitalAssetsService.registerMetadata(
        {
          bookId: publishedBookId,
          storageKey: 'assets/too-large.pdf',
          mimeType: 'application/pdf',
          byteSize: tooLarge,
          contentHash: hash,
          state: 'quarantine',
          readAccess: 'authenticated',
          downloadRequiresCard: true,
          rightsNote: 'Too large',
          uploadedBy: creatorUserId,
        },
        content,
      ),
    ).rejects.toMatchObject({ code: ErrorCode.VALIDATION_FAILED });
  });

  it('deletes storage objects when metadata is removed', async () => {
    const content = Buffer.from('%PDF-1.4 delete-me');
    const hash = createHash('sha256').update(content).digest();
    const storageKey = 'assets/delete-me.pdf';

    const asset = await digitalAssetsService.registerMetadata(
      {
        bookId: publishedBookId,
        storageKey,
        mimeType: 'application/pdf',
        byteSize: content.length,
        contentHash: hash,
        state: 'ready',
        readAccess: 'public',
        downloadRequiresCard: true,
        rightsNote: 'Delete test',
        uploadedBy: creatorUserId,
      },
      content,
    );

    expect(await fileStorage.objectExists(storageKey)).toBe(true);
    await digitalAssetsService.deleteMetadata(asset.id);
    expect(await fileStorage.objectExists(storageKey)).toBe(false);
  });

  it('blocks content delivery until asset is ready', async () => {
    const content = Buffer.from('%PDF-1.4 quarantine');
    const hash = createHash('sha256').update(content).digest();
    const asset = await digitalAssetsService.registerMetadata(
      {
        bookId: publishedBookId,
        storageKey: 'assets/quarantine.pdf',
        mimeType: 'application/pdf',
        byteSize: content.length,
        contentHash: hash,
        state: 'quarantine',
        readAccess: 'public',
        downloadRequiresCard: false,
        rightsNote: 'Quarantined',
        uploadedBy: creatorUserId,
      },
      content,
    );

    await expect(
      digitalAssetsService.assertReadyForContentDelivery(asset.id),
    ).rejects.toMatchObject({
      code: ErrorCode.INVALID_TRANSITION,
    });
  });

  it('exposes filtered ready public metadata on catalog detail without storage_key', async () => {
    const publicContent = Buffer.from('%PDF-1.4 public-ready');
    const publicHash = createHash('sha256').update(publicContent).digest();
    await digitalAssetsService.registerMetadata(
      {
        bookId: publishedBookId,
        storageKey: 'assets/public-ready.pdf',
        mimeType: 'application/pdf',
        byteSize: publicContent.length,
        contentHash: publicHash,
        state: 'ready',
        readAccess: 'public',
        downloadRequiresCard: true,
        rightsNote: 'Public ready asset',
        uploadedBy: creatorUserId,
      },
      publicContent,
    );

    const privateContent = Buffer.from('%PDF-1.4 auth-only');
    const privateHash = createHash('sha256').update(privateContent).digest();
    await digitalAssetsService.registerMetadata(
      {
        bookId: publishedBookId,
        storageKey: 'assets/auth-only.pdf',
        mimeType: 'application/pdf',
        byteSize: privateContent.length,
        contentHash: privateHash,
        state: 'ready',
        readAccess: 'authenticated',
        downloadRequiresCard: true,
        rightsNote: 'Authenticated only',
        uploadedBy: creatorUserId,
      },
      privateContent,
    );

    const detail = await request(httpServer).get(`/api/v1/books/${publishedBookId}`).expect(200);
    const serialized = JSON.stringify(detail.body);
    expect(serialized).not.toContain('storage_key');
    expect(serialized).not.toContain('assets/public-ready.pdf');

    const body = detail.body as {
      data: {
        digitalAssets: Array<{
          id: string;
          readAccess: string;
          downloadRequiresCard: boolean;
          rightsNote: string;
        }>;
      };
    };
    expect(body.data.digitalAssets).toHaveLength(1);
    expect(body.data.digitalAssets[0]?.readAccess).toBe('public');
    expect(body.data.digitalAssets[0]?.downloadRequiresCard).toBe(true);
  });
});
