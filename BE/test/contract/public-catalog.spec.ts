import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Server } from 'node:http';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module';
import { ErrorCode } from '../../src/common/http/error-code';
import { CLOCK } from '../../src/platform/clock/clock.interface';
import { CatalogRepository } from '../../src/modules/catalog/catalog.repository';
import { BootstrapService } from '../../src/modules/bootstrap/bootstrap.service';
import { UserRepository } from '../../src/modules/identity/user.repository';
import { configureApp } from '../../src/setup-app';
import { FakeClock } from '../support/fake-clock';
import {
  applyIdentityMigrations,
  resetIdentityState,
} from '../support/identity/reset-identity-state';

const integrationEnabled = process.env.INTEGRATION_TESTS === '1';
const describeCatalogContract = integrationEnabled ? describe : describe.skip;

interface BookListResponse {
  data: Array<{ id: string; title: string; authors: Array<{ name: string }> }>;
  meta: { page: number; pageSize: number; total: number };
}

interface BookDetailResponse {
  data: {
    id: string;
    title: string;
    availableCopies: null;
    digitalAssets: unknown[];
  };
}

interface TaxonomyListResponse {
  data: Array<{ id: string; name: string }>;
  meta: { page: number; pageSize: number; total: number };
}

interface ErrorResponse {
  error: { code: string };
}

describeCatalogContract('TST-S3-03 public catalog contract on MySQL', () => {
  let app: INestApplication;
  let httpServer: Server;
  let dataSource: DataSource;
  let catalogRepository: CatalogRepository;
  let userRepository: UserRepository;
  let bootstrapService: BootstrapService;
  let creatorUserId: string;
  let publishedId: string;
  let draftId: string;
  let archivedId: string;
  let categoryId: string;
  let topicId: string;

  beforeAll(async () => {
    const fakeClock = new FakeClock(new Date('2026-09-13T14:00:00.000Z'));
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
    userRepository = app.get(UserRepository);
    bootstrapService = app.get(BootstrapService);
  }, 120_000);

  beforeEach(async () => {
    await resetIdentityState();
    await bootstrapService.seedRegistryOnly();
    await bootstrapService.bootstrapAdmin({
      email: 'catalog.public@test.local',
      password: 'AdminPass123!',
      displayName: 'Catalog Public Admin',
      requestId: 'public-catalog-seed',
    });
    const admin = await userRepository.findByEmail('catalog.public@test.local');
    if (!admin) {
      throw new Error('Missing admin user');
    }
    creatorUserId = admin.id;
    const seeded = await seedCatalogFixture();
    publishedId = seeded.publishedId;
    draftId = seeded.draftId;
    archivedId = seeded.archivedId;
    categoryId = seeded.categoryId;
    topicId = seeded.topicId;
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns list, detail, and filters without a session cookie', async () => {
    const list = await request(httpServer).get('/api/v1/books?page=1&pageSize=20').expect(200);
    const listBody = list.body as BookListResponse;
    expect(listBody.meta.total).toBeGreaterThanOrEqual(2);
    expect(listBody.data.some((book) => book.id === publishedId)).toBe(true);

    const detail = await request(httpServer).get(`/api/v1/books/${publishedId}`).expect(200);
    const detailBody = detail.body as BookDetailResponse;
    expect(detailBody.data.availableCopies).toBeNull();
    expect(detailBody.data.digitalAssets).toEqual([]);

    const categories = await request(httpServer).get('/api/v1/categories').expect(200);
    expect((categories.body as TaxonomyListResponse).data.length).toBeGreaterThan(0);
  });

  it('hides draft and archived books from list, count, facets, and detail', async () => {
    const list = await request(httpServer).get('/api/v1/books?page=1&pageSize=50').expect(200);
    const ids = (list.body as BookListResponse).data.map((book) => book.id);
    expect(ids).toContain(publishedId);
    expect(ids).not.toContain(draftId);
    expect(ids).not.toContain(archivedId);

    await request(httpServer).get(`/api/v1/books/${draftId}`).expect(404);
    await request(httpServer).get(`/api/v1/books/${archivedId}`).expect(404);

    const topics = await request(httpServer).get('/api/v1/topics?page=1&pageSize=50').expect(200);
    const topicIds = (topics.body as TaxonomyListResponse).data.map((item) => item.id);
    expect(topicIds).toContain(topicId);
    expect((topics.body as TaxonomyListResponse).meta.total).toBeGreaterThan(0);
  });

  it('applies AND filters, empty results, last page, and stable sort ties', async () => {
    const filtered = await request(httpServer)
      .get(
        `/api/v1/books?categoryId=${categoryId}&topicId=${topicId}&year=2020&title=Tie&sort=title`,
      )
      .expect(200);
    const filteredBody = filtered.body as BookListResponse;
    expect(filteredBody.meta.total).toBe(2);
    expect(filteredBody.data.map((book) => book.title)).toEqual(['Tie Title A', 'Tie Title A']);

    const empty = await request(httpServer)
      .get(`/api/v1/books?year=1999&categoryId=${categoryId}`)
      .expect(200);
    expect((empty.body as BookListResponse).meta.total).toBe(0);

    const lastPage = await request(httpServer)
      .get('/api/v1/books?page=2&pageSize=2&sort=title')
      .expect(200);
    const lastBody = lastPage.body as BookListResponse;
    expect(lastBody.meta.total).toBeGreaterThanOrEqual(3);
    expect(lastBody.data.length).toBeGreaterThan(0);

    const firstPass = await request(httpServer)
      .get('/api/v1/books?sort=title&page=1&pageSize=10')
      .expect(200);
    const secondPass = await request(httpServer)
      .get('/api/v1/books?sort=title&page=1&pageSize=10')
      .expect(200);
    expect((firstPass.body as BookListResponse).data.map((b) => b.id)).toEqual(
      (secondPass.body as BookListResponse).data.map((b) => b.id),
    );
  });

  it('treats SQL injection and wildcard characters as literal search text', async () => {
    await request(httpServer)
      .get("/api/v1/books?q=' OR 1=1 --")
      .expect(200)
      .expect((res) => {
        expect((res.body as BookListResponse).meta.total).toBe(0);
      });

    await seedWildcardTitleBook('100%_wild');

    const percent = await request(httpServer).get('/api/v1/books?title=100%25').expect(200);
    expect((percent.body as BookListResponse).meta.total).toBe(1);

    const underscore = await request(httpServer).get('/api/v1/books?title=100%25_wild').expect(200);
    expect((underscore.body as BookListResponse).meta.total).toBe(1);
  });

  it('rejects an oversized q parameter with validation errors', async () => {
    const response = await request(httpServer)
      .get(`/api/v1/books?q=${'x'.repeat(201)}`)
      .expect(422);
    expect((response.body as ErrorResponse).error.code).toBe(ErrorCode.VALIDATION_FAILED);
  });

  it('finds Vietnamese titles with and without diacritics in q search', async () => {
    const withDiacritics = await request(httpServer)
      .get('/api/v1/books?q=' + encodeURIComponent('Đại số'))
      .expect(200);
    expect((withDiacritics.body as BookListResponse).meta.total).toBe(1);

    const withoutDiacritics = await request(httpServer)
      .get('/api/v1/books?q=' + encodeURIComponent('Dai so'))
      .expect(200);
    expect((withoutDiacritics.body as BookListResponse).meta.total).toBe(1);
  });

  it('does not duplicate books when multiple authors are linked', async () => {
    const list = await request(httpServer)
      .get('/api/v1/books?author=' + encodeURIComponent('Nguyễn'))
      .expect(200);
    const body = list.body as BookListResponse;
    const matching = body.data.filter((book) => book.id === publishedId);
    expect(matching).toHaveLength(1);
    expect(matching[0]?.authors.length).toBeGreaterThanOrEqual(2);
  });

  async function seedCatalogFixture(): Promise<{
    publishedId: string;
    draftId: string;
    archivedId: string;
    categoryId: string;
    topicId: string;
  }> {
    return dataSource.transaction(async (manager) => {
      const category = await catalogRepository.createCategory(manager, {
        code: 'math',
        name: 'Toán',
      });
      const authorAccent = await catalogRepository.createAuthor(manager, {
        name: 'Nguyễn Văn A',
      });
      const authorTwo = await catalogRepository.createAuthor(manager, { name: 'Tran B' });
      const topic = await catalogRepository.createTopic(manager, { name: 'Dai hoc' });

      const published = await catalogRepository.createBook(manager, {
        categoryId: category.id,
        title: 'Đại số cơ bản',
        createdBy: creatorUserId,
        publicationYear: 2020,
        state: 'published',
      });
      await catalogRepository.replaceAuthors(manager, {
        bookId: published.id,
        authorIds: [authorAccent.id, authorTwo.id],
      });
      await catalogRepository.replaceTopics(manager, {
        bookId: published.id,
        topicIds: [topic.id],
      });

      const tieOne = await catalogRepository.createBook(manager, {
        categoryId: category.id,
        title: 'Tie Title A',
        createdBy: creatorUserId,
        publicationYear: 2020,
        state: 'published',
      });
      const tieTwo = await catalogRepository.createBook(manager, {
        categoryId: category.id,
        title: 'Tie Title A',
        createdBy: creatorUserId,
        publicationYear: 2020,
        state: 'published',
      });
      await catalogRepository.replaceTopics(manager, {
        bookId: tieOne.id,
        topicIds: [topic.id],
      });
      await catalogRepository.replaceTopics(manager, {
        bookId: tieTwo.id,
        topicIds: [topic.id],
      });

      const draft = await catalogRepository.createBook(manager, {
        categoryId: category.id,
        title: 'Draft Hidden',
        createdBy: creatorUserId,
        state: 'draft',
      });

      const archived = await catalogRepository.createBook(manager, {
        categoryId: category.id,
        title: 'Archived Hidden',
        createdBy: creatorUserId,
        state: 'archived',
      });

      return {
        publishedId: published.id,
        draftId: draft.id,
        archivedId: archived.id,
        categoryId: category.id,
        topicId: topic.id,
      };
    });
  }

  async function seedWildcardTitleBook(title: string): Promise<void> {
    await dataSource.transaction(async (manager) => {
      const category = await catalogRepository.createCategory(manager, {
        code: `wild-${Date.now()}`,
        name: 'Wildcard',
      });
      await catalogRepository.createBook(manager, {
        categoryId: category.id,
        title,
        createdBy: creatorUserId,
        state: 'published',
      });
    });
  }
});
