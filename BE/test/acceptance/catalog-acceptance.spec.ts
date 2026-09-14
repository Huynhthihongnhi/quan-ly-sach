import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Server } from 'node:http';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { ErrorCode } from '../../src/common/http/error-code';
import { PUBLIC_TEXT_QUERY_MAX_LENGTH } from '../../src/modules/catalog/catalog-like.util';
import { CLOCK } from '../../src/platform/clock/clock.interface';
import { configureApp } from '../../src/setup-app';
import { seedIamPersonas, type IamPersonaFixtures } from '../support/acceptance/persona-session';
import { authAgent } from '../support/auth/auth-request';
import { catalogAgent } from '../support/catalog/catalog-request';
import { FakeClock } from '../support/fake-clock';
import {
  applyIdentityMigrations,
  resetIdentityState,
} from '../support/identity/reset-identity-state';

const acceptanceEnabled = process.env.ACCEPTANCE_TESTS === '1';
const describeAcceptance = acceptanceEnabled ? describe : describe.skip;

interface BookResponseBody {
  data: {
    id: string;
    title: string;
    state: string;
    version: string;
  };
}

interface PublicBookListBody {
  data: Array<{
    id: string;
    title: string;
    authors: Array<{ id: string; name: string }>;
    topics: Array<{ id: string; name: string }>;
    publicationYear: number | null;
  }>;
  meta: { total: number };
}

interface PublicBookDetailBody {
  data: Record<string, unknown> & {
    id: string;
    title: string;
    availableCopies: null;
    digitalAssets: unknown[];
  };
}

describeAcceptance('TST-S3-06 catalog acceptance on MySQL test database', () => {
  let app: INestApplication;
  let httpServer: Server;
  let personas: IamPersonaFixtures;

  beforeAll(async () => {
    const fakeClock = new FakeClock(new Date('2026-09-14T10:00:00.000Z'));
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
  }, 120_000);

  beforeEach(async () => {
    await resetIdentityState();
    personas = await seedIamPersonas(app);
  });

  afterAll(async () => {
    await app.close();
  });

  it('lets guests search by title, author, topic, and year then open the matching detail', async () => {
    const librarianCatalog = catalogAgent(
      httpServer,
      personas.librarian.cookie,
      personas.librarian.csrfToken,
    );
    const category = await librarianCatalog
      .createCategory({ code: 'accept-cat', name: 'Khoa hoc tu nhien' })
      .expect(201);
    const categoryId = (category.body as { data: { id: string } }).data.id;

    const author = await librarianCatalog
      .createAuthor({ name: 'Nguyen Van Acceptance' })
      .expect(201);
    const authorId = (author.body as { data: { id: string } }).data.id;

    const topic = await librarianCatalog.createTopic({ name: 'Dai hoc' }).expect(201);
    const topicId = (topic.body as { data: { id: string } }).data.id;

    const draft = await librarianCatalog
      .createBook({
        title: 'Dai so co ban',
        categoryId,
        publicationYear: 2020,
        authorIds: [authorId],
        topicIds: [topicId],
      })
      .expect(201);
    const bookBody = draft.body as BookResponseBody;

    const published = await librarianCatalog
      .patchBookState(bookBody.data.id, {
        state: 'published',
        version: bookBody.data.version,
      })
      .expect(200);
    const publishedBody = published.body as BookResponseBody;

    const guest = request(httpServer);

    const byTitle = await guest.get('/api/v1/books?page=1&pageSize=20&title=Dai%20so').expect(200);
    expect(
      (byTitle.body as PublicBookListBody).data.some((book) => book.id === publishedBody.data.id),
    ).toBe(true);

    const byAuthor = await guest.get('/api/v1/books?page=1&pageSize=20&author=Nguyen').expect(200);
    expect((byAuthor.body as PublicBookListBody).data[0]?.authors[0]?.name).toContain('Nguyen');

    const byTopic = await guest
      .get(`/api/v1/books?page=1&pageSize=20&topicId=${topicId}`)
      .expect(200);
    expect(
      (byTopic.body as PublicBookListBody).data.some((book) => book.id === publishedBody.data.id),
    ).toBe(true);

    const byYear = await guest.get('/api/v1/books?page=1&pageSize=20&year=2020').expect(200);
    expect(
      (byYear.body as PublicBookListBody).data.some((book) => book.publicationYear === 2020),
    ).toBe(true);

    const byKeyword = await guest.get('/api/v1/books?page=1&pageSize=20&q=Dai%20hoc').expect(200);
    expect((byKeyword.body as PublicBookListBody).data.length).toBeGreaterThan(0);

    const detail = await guest.get(`/api/v1/books/${publishedBody.data.id}`).expect(200);
    const detailBody = detail.body as PublicBookDetailBody;
    expect(detailBody.data.title).toBe('Dai so co ban');
    expect(detailBody.data.availableCopies).toBeNull();
    expect(detailBody.data.digitalAssets).toEqual([]);
  });

  it('shows published books to guests and hides archived books after librarian state changes', async () => {
    const librarianCatalog = catalogAgent(
      httpServer,
      personas.librarian.cookie,
      personas.librarian.csrfToken,
    );
    const categoryId = (
      await librarianCatalog
        .createCategory({ code: 'state-cat', name: 'State Category' })
        .expect(201)
    ).body as { data: { id: string } };

    const created = await librarianCatalog
      .createBook({ title: 'Lifecycle Book', categoryId: categoryId.data.id })
      .expect(201);
    const book = (created.body as BookResponseBody).data;

    const guestList = () =>
      request(httpServer).get('/api/v1/books?page=1&pageSize=50&title=Lifecycle');

    await guestList()
      .expect(200)
      .expect((response) => {
        const body = response.body as PublicBookListBody;
        expect(body.data.some((item) => item.title === 'Lifecycle Book')).toBe(false);
      });

    const published = await librarianCatalog
      .patchBookState(book.id, { state: 'published', version: book.version })
      .expect(200);
    const publishedVersion = (published.body as BookResponseBody).data.version;

    await guestList()
      .expect(200)
      .expect((response) => {
        const body = response.body as PublicBookListBody;
        expect(body.data.some((item) => item.id === book.id)).toBe(true);
      });

    await librarianCatalog
      .patchBookState(book.id, { state: 'archived', version: publishedVersion })
      .expect(200);

    await guestList()
      .expect(200)
      .expect((response) => {
        const body = response.body as PublicBookListBody;
        expect(body.data.some((item) => item.id === book.id)).toBe(false);
      });

    await request(httpServer).get(`/api/v1/books/${book.id}`).expect(404);
  });

  it('does not expose borrower, copy, or account fields on public catalog responses', async () => {
    const librarianCatalog = catalogAgent(
      httpServer,
      personas.librarian.cookie,
      personas.librarian.csrfToken,
    );
    const categoryId = (
      await librarianCatalog.createCategory({ code: 'privacy-cat', name: 'Privacy' }).expect(201)
    ).body as { data: { id: string } };

    const created = await librarianCatalog
      .createBook({ title: 'Privacy Book', categoryId: categoryId.data.id })
      .expect(201);
    const book = (created.body as BookResponseBody).data;

    await librarianCatalog.createCopy(book.id, { barcode: 'SECRET-BARCODE-001' }).expect(201);

    const published = await librarianCatalog
      .patchBookState(book.id, { state: 'published', version: book.version })
      .expect(200);

    const list = await request(httpServer)
      .get('/api/v1/books?page=1&pageSize=20&title=Privacy')
      .expect(200);
    const detail = await request(httpServer)
      .get(`/api/v1/books/${(published.body as BookResponseBody).data.id}`)
      .expect(200);

    const serialized = JSON.stringify([list.body, detail.body]).toLowerCase();
    expect(serialized).not.toContain('secret-barcode-001');
    expect(serialized).not.toContain('reader.acceptance@test.local');
    expect(serialized).not.toContain('password');
    expect(serialized).not.toContain('borrower');
    expect(serialized).not.toContain('createdby');
    expect(serialized).not.toContain('userid');
  });

  it('records accepted public search limits aligned with temp.md lookup criteria', async () => {
    const oversizedQ = 'x'.repeat(PUBLIC_TEXT_QUERY_MAX_LENGTH + 1);
    const validation = await request(httpServer)
      .get(`/api/v1/books?q=${encodeURIComponent(oversizedQ)}`)
      .expect(422);
    expect((validation.body as { error: { code: string } }).error.code).toBe(
      ErrorCode.VALIDATION_FAILED,
    );

    await request(httpServer).get('/api/v1/books?pageSize=101').expect(422);

    await authAgent(httpServer).me(personas.reader.cookie).expect(200);
  });
});
