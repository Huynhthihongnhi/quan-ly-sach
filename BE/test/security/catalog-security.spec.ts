import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Server } from 'node:http';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module';
import { ErrorCode } from '../../src/common/http/error-code';
import { CLOCK } from '../../src/platform/clock/clock.interface';
import { AccessRepository } from '../../src/modules/access/access.repository';
import { BootstrapService } from '../../src/modules/bootstrap/bootstrap.service';
import { hashPassword } from '../../src/modules/identity/password-hasher';
import { UserRepository } from '../../src/modules/identity/user.repository';
import { configureApp } from '../../src/setup-app';
import { auditAgent } from '../support/audit/audit-request';
import { authAgent, extractSessionCookie } from '../support/auth/auth-request';
import { catalogAgent } from '../support/catalog/catalog-request';
import { FakeClock } from '../support/fake-clock';
import {
  applyIdentityMigrations,
  resetIdentityState,
} from '../support/identity/reset-identity-state';

const securityEnabled = process.env.SECURITY_TESTS === '1';
const describeSecurity = securityEnabled ? describe : describe.skip;

interface LoginResponseBody {
  data: { csrfToken: string; user: { id: string } };
}

interface BookResponseBody {
  data: {
    id: string;
    title: string;
    state: string;
    version: string;
    isbn: string | null;
    availableCopies: null;
  };
}

interface CopyResponseBody {
  data: { id: string; barcode: string; version: string };
}

interface ErrorResponseBody {
  error: { code: string; message: string };
}

interface AuditListResponseBody {
  data: Array<{ action: string; targetId: string | null }>;
}

describeSecurity('TST-S3-02 CMS catalog API security', () => {
  let app: INestApplication;
  let httpServer: Server;
  let dataSource: DataSource;
  let userRepository: UserRepository;
  let accessRepository: AccessRepository;
  let bootstrapService: BootstrapService;
  let adminUserId: string;
  let adminCookie: string;

  beforeAll(async () => {
    const fakeClock = new FakeClock(new Date('2026-09-13T13:00:00.000Z'));
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
    userRepository = app.get(UserRepository);
    accessRepository = app.get(AccessRepository);
    bootstrapService = app.get(BootstrapService);
  }, 120_000);

  beforeEach(async () => {
    await resetIdentityState();
    await bootstrapService.seedRegistryOnly();
    await bootstrapService.bootstrapAdmin({
      email: 'admin@test.local',
      password: 'AdminPass123!',
      displayName: 'Admin',
      requestId: 'catalog-security-seed',
    });

    const login = await authAgent(httpServer)
      .login('admin@test.local', 'AdminPass123!')
      .expect(200);
    adminCookie = extractSessionCookie(login.headers['set-cookie']);
    adminUserId = (login.body as LoginResponseBody).data.user.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('lets a librarian create, update, and publish books', async () => {
    const librarian = await seedStaffSession('librarian.a@test.local', 'librarian');
    const catalog = catalogAgent(httpServer, librarian.cookie, librarian.csrf);
    const categoryId = await seedCategory(catalog);

    const created = await catalog
      .createBook({
        title: 'Draft Title',
        categoryId,
      })
      .expect(201);
    const createdBody = created.body as BookResponseBody;
    expect(createdBody.data.state).toBe('draft');
    expect(createdBody.data.availableCopies).toBeNull();

    const updated = await catalog
      .patchBook(createdBody.data.id, {
        title: 'Updated Title',
        version: createdBody.data.version,
      })
      .expect(200);
    const updatedBody = updated.body as BookResponseBody;
    expect(updatedBody.data.title).toBe('Updated Title');

    const published = await catalog
      .patchBookState(updatedBody.data.id, {
        state: 'published',
        version: updatedBody.data.version,
      })
      .expect(200);
    expect((published.body as BookResponseBody).data.state).toBe('published');
  });

  it('blocks readers from catalog admin mutations', async () => {
    const librarian = await seedStaffSession('librarian.b@test.local', 'librarian');
    const reader = await seedStaffSession('reader.blocked@test.local', 'reader');
    const categoryId = await seedCategory(
      catalogAgent(httpServer, librarian.cookie, librarian.csrf),
    );
    const readerCatalog = catalogAgent(httpServer, reader.cookie, reader.csrf);

    await readerCatalog
      .createBook({
        title: 'Reader Book',
        categoryId,
      })
      .expect(403);

    const draft = await catalogAgent(httpServer, librarian.cookie, librarian.csrf)
      .createBook({ title: 'Draft Only', categoryId })
      .expect(201);
    const bookId = (draft.body as BookResponseBody).data.id;

    await readerCatalog.getBook(bookId).expect(403);
    await readerCatalog.patchBook(bookId, { title: 'Nope', version: '1' }).expect(403);
  });

  it('returns not found and duplicate errors for unknown ids and unique fields', async () => {
    const librarian = await seedStaffSession('librarian.c@test.local', 'librarian');
    const catalog = catalogAgent(httpServer, librarian.cookie, librarian.csrf);
    const categoryId = await seedCategory(catalog);

    await catalog.getBook('999999').expect(404);

    const first = await catalog
      .createBook({
        title: 'ISBN Book',
        categoryId,
        isbn: '978-0000000001',
      })
      .expect(201);
    const firstBody = first.body as BookResponseBody;

    const duplicate = await catalog
      .createBook({
        title: 'ISBN Duplicate',
        categoryId,
        isbn: '978-0000000001',
      })
      .expect(409);
    expect((duplicate.body as ErrorResponseBody).error.message).toMatch(/ISBN/i);

    const copy = await catalog
      .createCopy(firstBody.data.id, { barcode: 'BAR-UNIQUE-001' })
      .expect(201);

    const duplicateBarcode = await catalog
      .createCopy(firstBody.data.id, { barcode: 'BAR-UNIQUE-001' })
      .expect(409);
    expect((duplicateBarcode.body as ErrorResponseBody).error.message).toMatch(/Barcode/i);
    expect((copy.body as CopyResponseBody).data.barcode).toBe('BAR-UNIQUE-001');
  });

  it('rejects client-controlled loan or stock counters in book payloads', async () => {
    const librarian = await seedStaffSession('librarian.d@test.local', 'librarian');
    const catalog = catalogAgent(httpServer, librarian.cookie, librarian.csrf);
    const categoryId = await seedCategory(catalog);

    const response = await catalog
      .createBook({
        title: 'Stock Tamper',
        categoryId,
        onLoanCount: 3,
        availableCopies: 5,
      })
      .expect(422);
    expect((response.body as ErrorResponseBody).error.code).toBe(ErrorCode.VALIDATION_FAILED);
  });

  it('returns version conflict when two librarians update the same book', async () => {
    const librarianOne = await seedStaffSession('librarian.one@test.local', 'librarian');
    const librarianTwo = await seedStaffSession('librarian.two@test.local', 'librarian');
    const categoryId = await seedCategory(
      catalogAgent(httpServer, librarianOne.cookie, librarianOne.csrf),
    );

    const created = await catalogAgent(httpServer, librarianOne.cookie, librarianOne.csrf)
      .createBook({ title: 'Shared Book', categoryId })
      .expect(201);
    const book = (created.body as BookResponseBody).data;

    await catalogAgent(httpServer, librarianOne.cookie, librarianOne.csrf)
      .patchBook(book.id, { title: 'First Save', version: book.version })
      .expect(200);

    const conflict = await catalogAgent(httpServer, librarianTwo.cookie, librarianTwo.csrf)
      .patchBook(book.id, { title: 'Second Save', version: book.version })
      .expect(409);
    expect((conflict.body as ErrorResponseBody).error.code).toBe(ErrorCode.VERSION_CONFLICT);
  });

  it('records audit events for publish, archive, and copy changes', async () => {
    const librarian = await seedStaffSession('librarian.audit@test.local', 'librarian');
    const catalog = catalogAgent(httpServer, librarian.cookie, librarian.csrf);
    const categoryId = await seedCategory(catalog);

    const created = await catalog.createBook({ title: 'Audit Book', categoryId }).expect(201);
    const book = (created.body as BookResponseBody).data;

    const published = await catalog
      .patchBookState(book.id, { state: 'published', version: book.version })
      .expect(200);
    const publishedBody = published.body as BookResponseBody;

    const archived = await catalog
      .patchBookState(publishedBody.data.id, {
        state: 'archived',
        version: publishedBody.data.version,
      })
      .expect(200);
    const archivedBody = archived.body as BookResponseBody;

    const copy = await catalog
      .createCopy(archivedBody.data.id, { barcode: 'AUDIT-COPY-1', shelfLocation: 'A-1' })
      .expect(201);
    const copyBody = copy.body as CopyResponseBody;

    await catalog
      .patchCopy(copyBody.data.id, {
        shelfLocation: 'B-2',
        version: copyBody.data.version,
      })
      .expect(200);

    const audit = await auditAgent(httpServer, adminCookie).list('?page=1&pageSize=50').expect(200);
    const actions = (audit.body as AuditListResponseBody).data.map((event) => event.action);

    expect(actions).toContain('catalog.book.state');
    expect(actions).toContain('catalog.copy.create');
    expect(actions).toContain('catalog.copy.update');
  });

  async function seedCategory(catalog: ReturnType<typeof catalogAgent>): Promise<string> {
    const response = await catalog
      .createCategory({
        code: `cat-${Date.now()}`,
        name: 'General',
      })
      .expect(201);
    return (response.body as { data: { id: string } }).data.id;
  }

  async function seedStaffSession(
    email: string,
    roleCode: string,
  ): Promise<{ cookie: string; csrf: string }> {
    const role = await accessRepository.findRoleByCode(roleCode);
    if (!role) {
      throw new Error(`Missing role ${roleCode}`);
    }

    const passwordHash = await hashPassword('StaffPass123!');
    const { user } = await dataSource.transaction((manager) =>
      userRepository.createWithProfile(manager, {
        email,
        displayName: email,
        status: 'active',
        passwordHash,
      }),
    );

    await dataSource.transaction((manager) =>
      accessRepository.assignRole(manager, {
        userId: user.id,
        roleId: role.id,
        assignedBy: adminUserId,
      }),
    );

    const login = await authAgent(httpServer).login(email, 'StaffPass123!').expect(200);
    return {
      cookie: extractSessionCookie(login.headers['set-cookie']),
      csrf: (login.body as LoginResponseBody).data.csrfToken,
    };
  }
});
