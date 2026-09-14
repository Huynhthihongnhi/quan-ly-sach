import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Server } from 'node:http';
import { performance } from 'node:perf_hooks';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module';
import { ErrorCode } from '../../src/common/http/error-code';
import { CLOCK } from '../../src/platform/clock/clock.interface';
import { CatalogPublicRepository } from '../../src/modules/catalog/catalog-public.repository';
import { CatalogPublicService } from '../../src/modules/catalog/catalog-public.service';
import { BootstrapService } from '../../src/modules/bootstrap/bootstrap.service';
import { UserRepository } from '../../src/modules/identity/user.repository';
import { configureApp } from '../../src/setup-app';
import { FakeClock } from '../support/fake-clock';
import {
  applyIdentityMigrations,
  resetIdentityState,
} from '../support/identity/reset-identity-state';
import {
  resolvePerformanceBookTarget,
  seedCatalogPerformanceFixture,
} from '../support/catalog/seed-catalog-performance-fixture';
import { withSqlQueryCounter } from '../support/catalog/sql-query-counter';

const performanceEnabled = process.env.PERFORMANCE_TESTS === '1';
const describeCatalogPerformance = performanceEnabled ? describe : describe.skip;

function percentile(values: number[], ratio: number): number {
  if (values.length === 0) {
    return 0;
  }
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(sorted.length - 1, Math.ceil(sorted.length * ratio) - 1);
  return sorted[index] ?? 0;
}

describeCatalogPerformance('TST-S3-05 catalog performance on MySQL', () => {
  let app: INestApplication;
  let httpServer: Server;
  let dataSource: DataSource;
  let catalogPublicService: CatalogPublicService;
  let catalogPublicRepository: CatalogPublicRepository;
  let bootstrapService: BootstrapService;
  let userRepository: UserRepository;
  let fixture: Awaited<ReturnType<typeof seedCatalogPerformanceFixture>>;

  beforeAll(async () => {
    const fakeClock = new FakeClock(new Date('2026-09-14T02:00:00.000Z'));
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
    catalogPublicService = app.get(CatalogPublicService);
    catalogPublicRepository = app.get(CatalogPublicRepository);
    bootstrapService = app.get(BootstrapService);
    userRepository = app.get(UserRepository);

    await resetIdentityState();
    await bootstrapService.seedRegistryOnly();
    await bootstrapService.bootstrapAdmin({
      email: 'catalog.perf@test.local',
      password: 'AdminPass123!',
      displayName: 'Catalog Perf Admin',
      requestId: 'catalog-performance-seed',
    });
    const admin = await userRepository.findByEmail('catalog.perf@test.local');
    if (!admin) {
      throw new Error('Missing performance admin user');
    }

    fixture = await seedCatalogPerformanceFixture(dataSource, admin.id);
    expect(fixture.totalPublishedBooks).toBeGreaterThanOrEqual(resolvePerformanceBookTarget());
  }, 600_000);

  afterAll(async () => {
    await app.close();
  });

  it('uses idx_books_filter for category and year filters (EXPLAIN)', async () => {
    const year = 2022;
    const rows = await dataSource.query<Array<{ key: string | null; type: string }>>(
      `EXPLAIN SELECT book.id
       FROM books book
       WHERE book.state = 'published'
         AND book.category_id = ?
         AND book.publication_year = ?
       ORDER BY book.id ASC
       LIMIT 20`,
      [fixture.categoryId, year],
    );
    const plan = rows[0];
    if (!plan) {
      throw new Error('Missing EXPLAIN plan for filtered list.');
    }
    expect(plan.key).toMatch(/idx_books_filter|idx_books_public/);
    expect(plan.type).not.toBe('ALL');
  });

  it('records contains search as potentially slow before FULLTEXT (EXPLAIN)', async () => {
    const rows = await dataSource.query<Array<{ key: string | null; type: string; rows: number }>>(
      `EXPLAIN SELECT book.id
       FROM books book
       WHERE book.state = 'published'
         AND book.title LIKE ?
       ORDER BY book.id ASC
       LIMIT 20`,
      ['%Perf Catalog%'],
    );
    const plan = rows[0];
    if (!plan) {
      throw new Error('Missing EXPLAIN plan for contains search.');
    }
    // Leading-wildcard LIKE cannot use btree indexes; document instead of forcing FULLTEXT now.
    expect(plan.type === 'ALL' || plan.key === null || plan.rows > 100).toBe(true);
  });

  it('keeps SQL query count stable when author count per book changes', async () => {
    const listAuthorsForBook = jest.spyOn(catalogPublicRepository, 'listAuthorsForBook');
    const listAuthorsByBookIds = jest.spyOn(catalogPublicRepository, 'listAuthorsByBookIds');

    const manyAuthorsCount = await withSqlQueryCounter(dataSource, async (counter) => {
      await catalogPublicService.listBooks({
        page: 1,
        pageSize: 20,
        title: 'Perf Many Authors',
      });
      return counter.queryCount;
    });

    const fewAuthorsCount = await withSqlQueryCounter(dataSource, async (counter) => {
      await catalogPublicService.listBooks({
        page: 1,
        pageSize: 20,
        title: 'Perf Few Authors',
      });
      return counter.queryCount;
    });

    expect(listAuthorsForBook).not.toHaveBeenCalled();
    expect(listAuthorsByBookIds).toHaveBeenCalled();
    expect(Math.abs(manyAuthorsCount - fewAuthorsCount)).toBeLessThanOrEqual(2);

    listAuthorsForBook.mockRestore();
    listAuthorsByBookIds.mockRestore();
  });

  it('rejects page sizes above 100', async () => {
    const response = await request(httpServer).get('/api/v1/books?page=1&pageSize=101').expect(422);
    const body = response.body as { error: { code: string } };
    expect(body.error.code).toBe(ErrorCode.VALIDATION_FAILED);
  });

  it('logs baseline p95 for filtered list without publishing an SLA', async () => {
    const samples: number[] = [];
    const url = `/api/v1/books?page=1&pageSize=20&categoryId=${fixture.categoryId}&year=2022`;

    for (let warmup = 0; warmup < 5; warmup += 1) {
      await request(httpServer).get(url).expect(200);
    }

    for (let iteration = 0; iteration < 30; iteration += 1) {
      const started = performance.now();
      await request(httpServer).get(url).expect(200);
      samples.push(performance.now() - started);
    }

    const p95Ms = percentile(samples, 0.95);
    const errorRate = 0;
    console.info(
      JSON.stringify({
        benchmark: 'catalog-public-list-filtered',
        fixtureBooks: fixture.totalPublishedBooks,
        samples: samples.length,
        p95Ms: Math.round(p95Ms),
        errorRate,
        note: 'No SLA until D08; contains search remains LIKE until FULLTEXT decision.',
      }),
    );

    expect(p95Ms).toBeLessThan(30_000);
    expect(errorRate).toBe(0);
  });
});
